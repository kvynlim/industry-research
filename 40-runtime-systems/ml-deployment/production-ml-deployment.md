# Production ML Deployment for Autonomous Vehicles

## Practical Engineering of Running Neural Networks on Moving Vehicles

This document covers the hard engineering problems of deploying ML models -- particularly world models, BEV encoders, and perception networks -- on production autonomous vehicles. The focus is on NVIDIA hardware (Orin/Thor), TensorRT optimization, and the operational realities of running safety-critical inference 24/7 on moving machines.

---

## Table of Contents

1. [TensorRT Production Deployment](#1-tensorrt-production-deployment)
2. [NVIDIA Triton on Vehicles](#2-nvidia-triton-on-vehicles)
3. [Model Monitoring in Production](#3-model-monitoring-in-production)
4. [GPU Reliability](#4-gpu-reliability)
5. [Inference Determinism](#5-inference-determinism)
6. [Multi-Model Orchestration](#6-multi-model-orchestration)
7. [Memory Management](#7-memory-management)
8. [Startup and Initialization](#8-startup-and-initialization)
9. [Logging and Debugging](#9-logging-and-debugging)
10. [A/B Testing ML Models](#10-ab-testing-ml-models)
11. [Regulatory Requirements for ML Updates](#11-regulatory-requirements-for-ml-updates)
12. [Real-World Latency](#12-real-world-latency)
13. [Power Management](#13-power-management)

---

## 1. TensorRT Production Deployment

### What TensorRT Does

TensorRT is NVIDIA's SDK for optimizing and accelerating deep learning inference. It takes a trained model (typically exported as ONNX), applies layer fusion, kernel auto-tuning, precision calibration, and memory optimization, then produces a serialized "engine" file that runs at maximum speed on the target GPU. For autonomous vehicles, TensorRT is not optional -- it is the standard path from trained model to production inference on NVIDIA hardware.

The production workflow:
1. Train model in PyTorch/JAX
2. Export to ONNX
3. Build TensorRT engine on the target hardware (or same GPU architecture)
4. Serialize the engine to disk
5. At runtime, deserialize and run inference

### Engine Caching and Serialization

**The critical constraint**: TensorRT engines are hardware-specific. An engine built on an A100 will not run on an Orin. An engine built with TensorRT 8.x will not deserialize with TensorRT 10.x. Even minor driver updates can invalidate cached engines.

Production caching strategy:
- **Build engines offline** on identical hardware to the target vehicle, never during boot on the vehicle itself
- **Serialize to plan files** in binary format for fast loading
- **Version-tag every engine** with: TensorRT version, CUDA version, GPU architecture, model hash, calibration data hash
- **Invalidate caches** when any of the above change -- stale engines either fail silently or crash

There are three cache types relevant to production:
1. **Engine cache**: The serialized engine itself. Loading from cache avoids the multi-minute build process entirely.
2. **Timing cache**: Stores per-layer kernel profiling results. Speeds up rebuilds from minutes to seconds when model topology is unchanged but engine needs regeneration.
3. **Runtime cache**: Introduced in TensorRT-RTX, caches JIT-compiled kernels at execution context creation time for faster context initialization.

File permission management matters in production -- concurrent processes accessing the same cache need proper locking. Use lock files or atomic rename patterns.

### Dynamic Shapes

Real-world inputs are not fixed-size. Camera resolution changes between models, the number of detected objects varies frame-to-frame, and BEV grid resolution may be configurable. TensorRT handles this through optimization profiles.

Each optimization profile specifies three dimension sets per input tensor:
- **MIN**: Lower bound for runtime dimensions
- **OPT**: Dimensions the auto-tuner optimizes for (this is where you get peak performance)
- **MAX**: Upper bound for runtime dimensions

Example for a multi-camera BEV encoder:
```
Input "images": MIN=[1,6,3,448,800] OPT=[1,6,3,640,960] MAX=[1,6,3,900,1600]
```

At runtime, set actual dimensions via `context.setInputShape()` after selecting a profile with `context.setOptimizationProfileAsync()`.

**Performance implications**:
- Performance is best at the OPT dimensions. Deviation costs throughput.
- Some layer implementations only support MIN=OPT=MAX and get disabled when values differ.
- Convolution and deconvolution require channel dimension as a build-time constant.
- INT8 quantization also mandates constant channel dimensions.
- Dynamic output shapes require `IOutputAllocator` for deferred memory allocation, adding complexity.

### Multi-Profile Engines

A single engine can contain multiple optimization profiles, each tuned for different input shape ranges. This is useful when the same model serves different operational modes (e.g., high-resolution for parking vs. lower-resolution for highway).

In the newer `enqueueV3` interface, profile selection uses name-based tensor addressing, eliminating the binding index complexity of the older `enqueueV2` API.

**Production recommendation**: Use 2-3 profiles covering your actual operational input ranges. More profiles increase engine build time and memory consumption without benefit.

### Precision and Quantization

TensorRT 10 supports FP32, FP16, BF16, FP8, INT8, and INT4 (AWQ). For production autonomous vehicles:

- **FP16** is the default for most perception models -- 2x speedup over FP32 with negligible accuracy loss
- **INT8** provides another 2x speedup but requires careful calibration with representative data
- **FP8** on Orin's Ampere GPU provides a middle ground
- Mixed precision (different layers at different precisions) is the practical reality

The `kOBEY_PRECISION` builder flag forces TensorRT to use the specified precision for all layers, which can speed up build times but may fail if hardware lacks FP16 support for certain operations.

---

## 2. NVIDIA Triton on Vehicles

### Why Use an Inference Server on a Vehicle?

A production AV runs 5-15 models simultaneously: camera backbone, BEV encoder, 3D object detector, lane detection, traffic light classifier, occupancy prediction, world model, motion forecasting, safety monitor, and potentially more. Managing these as independent processes leads to resource contention, duplicated preprocessing, and operational chaos. Triton provides a structured framework.

### Deployment Architecture

Triton supports two deployment modes relevant to vehicles:

1. **Server mode**: Full HTTP/gRPC server with model management APIs. Useful during development and fleet management.
2. **Shared library mode (C API)**: Triton's full functionality compiled into a shared library and linked directly into the AV application. This eliminates network overhead and is the production choice for vehicles.

The shared library approach uses `TRITONSERVER_ServerNew()` to create an in-process inference server, avoiding the latency of serializing requests over a network stack.

### Model Ensembles

Triton ensembles stitch multiple models and pre/post-processing operations into a single pipeline with connected inputs and outputs. A single inference request triggers the entire chain.

Example pipeline for a vehicle perception stack:
```
Camera Images -> Image Preprocessing -> BEV Encoder -> Detection Head
                                                    -> Occupancy Head
                                                    -> Lane Head
```

The ensemble scheduler manages data flow between models, handles batching at each stage, and ensures outputs are correctly routed to downstream models. This avoids the application code managing tensor transfers between models.

### Dynamic Batching

Triton's dynamic batcher accumulates inference requests up to a configurable latency threshold, then executes them as a single batch. This is transparent to the client.

For vehicle applications, dynamic batching is most useful for:
- **Post-detection classification**: After detecting N objects, batch the crop-and-classify operations
- **Multi-camera processing**: If cameras trigger at slightly different times, batch their frames together
- **Multi-frame temporal models**: Accumulate sequential frames before world model inference

Configuration per model:
```
dynamic_batching {
  preferred_batch_size: [4, 8]
  max_queue_delay_microseconds: 5000
}
```

### Concurrent Model Execution

Triton maximizes GPU utilization by running multiple models concurrently. The constraint is GPU memory -- you can run as many models simultaneously as fit in memory. For each model, you configure the number of execution instances:

```
instance_group [
  { count: 2, kind: KIND_GPU }
]
```

Two instances means Triton can process two requests for that model in parallel, useful for high-throughput models.

### Health Monitoring

Triton exposes health endpoints:
- `/v2/health/live` -- liveness probe (is the server process running?)
- `/v2/health/ready` -- readiness probe (are all models loaded and ready?)

For Kubernetes-managed vehicle fleets, configure startup probes with generous timeouts:
```yaml
startupProbe:
  httpGet:
    path: /v2/health/ready
    port: 8000
  failureThreshold: 30
  periodSeconds: 10
```

Model loading can take several minutes depending on model sizes. If startup probe timeout is too short, Kubernetes restarts the pod in an infinite loop.

Triton also exposes per-model metrics (inference count, latency percentiles, queue time) via Prometheus-compatible endpoints. The model control API enables live model updates -- loading and unloading models without restarting the server.

---

## 3. Model Monitoring in Production

### The Ground Truth Problem

The fundamental challenge of monitoring ML models on vehicles: you rarely have ground truth labels in real time. You cannot know whether a detection was correct until a human annotates the data, which happens days or weeks later. Monitoring must work without ground truth.

### Proxy Metrics When Labels Are Unavailable

**Prediction distribution monitoring**: Track the distribution of model outputs over time. If your object detector suddenly starts producing far more high-confidence detections, or the confidence distribution shifts, something has changed. Use Kolmogorov-Smirnov tests, Population Stability Index (PSI), or Wasserstein distance to quantify distribution shift.

**Input data drift detection**: Monitor statistical properties of input features -- mean pixel intensity, image contrast, feature histograms. If the input distribution drifts from the training distribution, model performance will likely degrade. Statistical tests (KS test, Chi-squared) and divergence metrics (KL divergence) quantify drift.

**Confidence calibration monitoring**: A well-calibrated model should be correct ~80% of the time when it predicts with 0.8 confidence. Track calibration curves over time. Degrading calibration is an early signal of model drift, even without labels.

**Cross-sensor consistency**: Compare detections across redundant sensors. If the camera-based detector disagrees with LiDAR-based detection more often than baseline, one system is degrading.

**Self-consistency checks**: Track prediction stability across consecutive frames. A flickering detection that appears and disappears frame-to-frame indicates model uncertainty, even if individual predictions look confident.

### What to Monitor

Organized by the monitoring pyramid from system health up to business metrics:

| Layer | Metrics | Frequency |
|-------|---------|-----------|
| System Health | GPU utilization, memory usage, inference latency (p50/p90/p99), throughput, error rates | Real-time |
| Data Quality | Missing data rates, schema validation, feature value ranges, anomaly rates | Per-inference |
| Data Drift | Feature distribution shift (KS statistic), input statistics (mean, std, percentiles) | Hourly/daily |
| Prediction Drift | Output distribution changes, confidence score distributions | Hourly/daily |
| Model Quality | Accuracy on delayed labels when available, cross-sensor agreement rates | Daily/weekly |

### Practical Architecture

On-vehicle:
- Lightweight monitoring agent computes summary statistics and drift indicators
- Buffer recent predictions and inputs for periodic upload
- Alert on threshold violations (latency spike, confidence collapse, OOM)

Off-vehicle (fleet level):
- Aggregate statistics across fleet using Prometheus + Grafana
- Evidently AI or similar tools for drift analysis
- Automated retraining triggers when drift exceeds thresholds

### Autonomous Vehicle-Specific Drift Sources

- **Seasonal changes**: Snow, rain, lighting conditions shift input distributions
- **Infrastructure changes**: New road markings, construction zones, new vehicle types (scooters, e-bikes)
- **Sensor degradation**: Dirty cameras, misaligned LiDAR, aging sensors produce subtly different inputs
- **Operational domain expansion**: Moving from one airport to another, new terminal buildings, different GSE types

---

## 4. GPU Reliability

### NVIDIA Orin Reliability Data

The Jetson AGX Orin Industrial is the module positioned for safety-critical deployments. Key reliability specifications:

- **Operating lifetime rating**: 87,000 hours at 85 degrees C TTP (thermal test point) for the Industrial variant
- **Third-party MTBF estimate**: ~101,399 hours (~11.6 years) for ruggedized Orin implementations, calculated per MIL-HDBK-217F2
- **FIT rates**: Documented in Table 7.6 of the AGX Orin datasheet, temperature-dependent (lower junction temperature = better FIT rates)
- **ISO 26262 compliance**: DRIVE Orin SoC meets ASIL D systematic requirements and ASIL B random fault management requirements

For context, 87,000 hours at 85C is approximately 10 years of continuous operation. At lower operating temperatures (which are achievable with proper cooling), reliability improves significantly per Arrhenius modeling.

### ECC Memory

**DRAM ECC**: Available exclusively on Orin Industrial modules. Managed by the FSI (Functional Safety Island) firmware with HSM (Hardware Safety Manager). Tracks Single Bit Errors (SBE) and Double Bit Errors (DBE).

**Behavior on errors**:
- Single-bit errors: Silently corrected in hardware. Counters exist in registers but are not easily accessible from Linux userspace (registers at physical addresses like 0x02c70ac4 are firewall-blocked from the CCPLEX context).
- Double-bit errors: System reboots. The FSI R5 processor maintains records of bad pages, with logs visible during bootloader initialization.

**Critical gap**: No production-supported Linux userland API exists for runtime ECC monitoring. The EDAC driver is not supported because "this driver runs from the same RAM which could get these ECC errors while executing." Monitoring ECC errors currently requires devmem workarounds or UART console logging.

**GPU memory ECC**: Exists as a separate configuration from DRAM/cache ECC, but detailed specifications are not publicly documented for the Orin platform.

### Watchdog and Fault Detection

NVIDIA DRIVE platform incorporates 22,000+ platform safety monitors across the SoC. The safety architecture includes:

- **Lockstep processing**: Dual-core lockstep on safety-critical CPU cores (Cortex-R5 on FSI)
- **ECC on memory and buses**: Error-correcting code throughout the memory hierarchy
- **Built-in self-test (BIST)**: Hardware mechanisms for testing logic at boot and periodically
- **Safety Island (FSI)**: Independent Cortex-R5 microcontroller that monitors the main system and can trigger safe shutdown
- **Thermal monitoring**: THERM_SHDN and THERM_ALERT signals trigger notifications to the Error Handler module

For GPU fault detection specifically:
- On DriveOS, GPU faults are detected through hardware error reporting mechanisms
- The safety monitor framework can detect GPU hangs and trigger recovery
- Unlike desktop GPUs with TDR (Timeout Detection and Recovery at ~2 seconds), automotive platforms use custom watchdog timers tuned for safety-critical operation

### Thermal Management

The Orin SoC has consistent thermal thresholds across variants:

| Event | Temperature |
|-------|-------------|
| Software throttling | 99.0 C |
| Hardware throttling | 103.0 C |
| Software shutdown | 104.5 C |
| Hardware shutdown | 105.0 C |

The Industrial variant uses elevated thresholds (112-118 C range).

Thermal monitoring interfaces:
- `tegrastats` provides real-time junction temperature readings
- Soctherm debug registers under `/sys/kernel/debug/bpmp/debug/soctherm/`
- Thermal trip thresholds are configurable (default hot=105C, cold=-28C)
- Two INA3221 triple-channel power monitors on internal I2C (addresses 0x40, 0x41) provide voltage/current monitoring
- VMON blocks with droop/spike detection at base address 0x0c360000

**Limitation**: Only instantaneous temperature readings are available natively. There is no built-in historical trending for cumulative thermal damage modeling. Production systems need to implement their own thermal history logging.

### SPE (Sensor Processing Engine)

The always-on Cortex-R5 microcontroller (SPE) has independent I2C, timers, and 256KB SRAM. It can monitor silicon health independently of the main CCPLEX, making it suitable for implementing custom reliability monitoring that persists even if the main system crashes.

---

## 5. Inference Determinism

### Is TensorRT Deterministic?

**For the same engine, same input, on the same GPU: generally yes.** NVIDIA states: "If you are using same engine with same input, TensorRT should be deterministic."

But there are important caveats:

**Engine building is non-deterministic**: Tactic selection during engine building involves profiling kernel performance, and timing variations lead to different optimal tactic choices across builds. Different tactics can change the order of floating-point operations, producing numerically different results. Use a custom algorithm selector with cached tactics to make builds more reproducible.

**FP16 introduces more variability**: Some FP16 kernels use atomic operations where the order of data entering computation is non-deterministic. For "most simple models it is deterministic, and for more complex models it is deterministic enough."

**Dynamic shapes reduce determinism**: With dynamic shapes, the kernel selection at runtime may vary based on actual input dimensions, potentially using different tactics for different shapes.

**Cross-GPU non-determinism**: Even with cached tactics, results may have small floating-point differences across GPUs with different architectures. An engine built on Orin will produce slightly different numerics than one built on Xavier for the same model.

### Handling Non-Determinism in Safety-Critical Systems

For autonomous vehicles, bit-exact reproducibility of inference results is not the right goal. Instead:

1. **Design the system to tolerate small numerical variations**: Safety decisions should never depend on the exact value of a single floating-point output. Use thresholds with hysteresis, temporal filtering, and voting across multiple frames.

2. **Validate the model over a distribution of outputs**: Rather than asserting "the model must output exactly X for input Y," validate "the model's outputs over the test set must meet accuracy/recall targets."

3. **Use deterministic post-processing**: Even if inference has minor floating-point variation, NMS thresholds, tracking logic, and planning should be deterministic given the same (rounded) inputs.

4. **Redundancy and diversity**: Run diverse models (different architectures or training runs) and compare outputs. If both agree, confidence is high regardless of minor numerical drift in either.

5. **Lock down the build**: In production, never rebuild engines unnecessarily. Ship pre-built, validated engines. Keep TensorRT version, CUDA version, and driver version identical across the fleet.

### Timing Determinism vs. Numerical Determinism

TensorRT inference timing is NOT deterministic -- execution time varies based on system load, GPU thermal state, memory bus contention, and OS scheduling. This is distinct from numerical determinism (whether the output values are identical). Production systems must handle timing variance through deadline-aware scheduling (see Section 6).

---

## 6. Multi-Model Orchestration

### The Scheduling Problem

A production AV runs multiple neural networks simultaneously on a single GPU (or GPU + DLAs). Typical models in an airside AV perception stack:

| Model | Typical Latency | Priority |
|-------|-----------------|----------|
| Camera backbone / BEV encoder | 15-30 ms | High |
| 3D object detection | 13-20 ms | Critical |
| Occupancy prediction | 10-15 ms | High |
| World model (future prediction) | 20-40 ms | Medium |
| Traffic sign / marking detection | 8-12 ms | Medium |
| Safety monitor network | 5-10 ms | Critical |

These models compete for GPU compute, memory bandwidth, and power. Naive scheduling (run everything as fast as possible) leads to resource contention, missed deadlines, and unpredictable latency.

### CUDA Stream-Based Scheduling

CUDA streams enable concurrent kernel execution. Commands in different streams can be interleaved and run concurrently when hardware resources allow. However, commodity GPUs lack efficient preemptive scheduling:

- GPU kernel execution is non-preemptive: once a kernel starts, it runs to completion
- No hardware priority preemption on consumer/embedded GPUs
- The GPU scheduler uses Time Division Multiple Access (TDMA) among channels, with priority-weighted slot allocation

**The practical consequence**: A long-running world model inference kernel can block a high-priority safety monitor kernel from executing for its entire duration.

### Research Solutions for Real-Time Multi-Model Scheduling

**UrgenGo** (2025) provides urgency-aware transparent GPU scheduling for autonomous driving:
- Dynamically schedules GPU kernels based on changing urgency levels (tasks become more urgent as deadlines approach)
- Intercepts CUDA function calls by replacing the default CUDA dynamic library -- no source code modification needed
- Works transparently with closed-source frameworks like TensorRT and ROS2
- Three-level approach: CPU priority mapping (SCHED_FIFO), dynamic GPU stream binding, and kernel-level launch control
- Results: 61% reduction in deadline miss ratio vs. state-of-the-art, with only 1% GPU execution time overhead
- Evaluated on a real self-driving bus with NVIDIA RTX 3070Ti over two weeks

Measured task chain latencies from UrgenGo's autonomous driving evaluation:
- 3D object detection (PointPillars): 13.4 +/- 1.3 ms
- Particle filtering localization: 15.0 +/- 2.8 ms
- 2D object detection: 19.8 +/- 1.2 ms
- Image segmentation: 11.5 +/- 1.2 ms
- Path planning: 8.0 +/- 2.9 ms
- LLM processing (LLAMA2-7B): 17.8 +/- 4.6 ms

**TimelyNet** (2025) takes a different approach -- adaptive neural architecture that samples subnets with varying inference latency to meet dynamic deadlines. When the vehicle is moving faster and needs shorter inference latency, it selects a smaller subnet. Overhead: 2.5 ms for subnet search, compared to pipeline latency of 41+ ms.

### GPU + DLA Heterogeneous Scheduling

The NVIDIA Orin SoC contains up to two Deep Learning Accelerators (DLAs) in addition to the GPU. DLAs are 3-5x more power-efficient than the GPU for supported operations.

DLA contribution by power mode:
- MAXN (60W): DLA provides 38% of total 275 TOPS (105 TOPS from 2x DLA)
- 50W: DLA provides 46% of total 200 TOPS
- 30W: DLA provides 69% of total 131 TOPS
- 15W: DLA provides 74% of total 54 TOPS

**Production strategy**: Offload suitable models (typically perception backbones, detection heads) to DLA, freeing the GPU for models that need GPU-specific features (custom layers, dynamic shapes, large activations). The NVIDIA DRIVE AV team achieved 2.5x latency improvement by mapping DNNs to DLA while reserving GPU for non-DNN tasks.

Measured DLA + GPU concurrent performance on Orin (30W mode):
| Model | GPU Only | DLA Only | GPU + 2x DLA |
|-------|----------|----------|--------------|
| PeopleNet-ResNet18 (960x544) | 218 FPS | 128 FPS | 346 FPS |
| TrafficCamNet (960x544) | 251 FPS | 174 FPS | 425 FPS |

### Practical Orchestration Pattern

For a production AV stack:

1. **Critical-path models** (safety monitor, primary detection) get highest CUDA stream priority and run on GPU
2. **Backbone/encoder** offloaded to DLA where supported, with GPU fallback for unsupported layers
3. **World model and prediction** run on GPU in a lower-priority stream, with deadline-aware scheduling
4. **Auxiliary models** (sign classification, traffic light) run in best-effort mode, skipping frames if overloaded
5. **Pipeline DAG** managed by Triton ensemble or custom orchestrator with explicit dependency tracking

---

## 7. Memory Management

### GPU Memory on Embedded Systems

The Jetson AGX Orin has 32GB or 64GB of unified memory shared between CPU and GPU (no discrete VRAM). Every byte of GPU memory consumed by ML models is a byte unavailable to the rest of the system. OOM on a moving vehicle is a safety event.

### TensorRT Memory Architecture

TensorRT memory consumption breaks down into three categories:

1. **Weight memory**: Model parameters loaded into GPU memory. Size is fixed per model and reported by `ICudaEngine::getEngineStat(kTOTAL_WEIGHTS_SIZE)`.

2. **Activation memory**: Intermediate tensor storage during inference. TensorRT optimizes this by sharing memory across activation tensors with disjoint lifetimes -- it does NOT allocate N copies for N transformer blocks, because memory is reused for later blocks.

3. **Scratch memory**: Temporary workspace for layer implementations. Can occupy unused activation memory where feasible. Bounded by `setMemoryPoolLimit()`.

Total runtime device memory = weights + max(activation memory across all layers) + scratch memory.

### Memory Sharing Between Engines

For running multiple models, TensorRT provides `createExecutionContextWithoutDeviceMemory()`. This allows:

- Creating execution contexts for multiple engines without pre-allocating device memory
- Allocating a single device memory buffer sized to the maximum requirement across all engines
- Assigning that same buffer to multiple contexts that execute sequentially in the same CUDA stream

This is critical for memory-constrained vehicles. If you have 10 models that each need 200MB of activation memory but never run simultaneously, you allocate 200MB once instead of 2GB.

```cpp
// Get max memory needed across all engines
size_t maxMem = 0;
for (auto& engine : engines) {
    maxMem = std::max(maxMem, engine->getDeviceMemorySizeV2());
}

// Allocate once
void* deviceMem;
cudaMalloc(&deviceMem, maxMem);

// Assign to each context before execution
for (auto& ctx : contexts) {
    ctx->setDeviceMemory(deviceMem);
}
```

### Preventing Memory Fragmentation

GPU memory fragmentation is a significant cause of OOM crashes in long-running systems. Fragmentation occurs because memory gets allocated and freed in irregular patterns, leaving small unusable gaps. Even with sufficient total VRAM available, fragmentation can prevent allocation of large contiguous blocks.

**Mitigation strategies for production vehicles**:

1. **Pre-allocate memory pools**: Allocate all GPU memory at startup in large contiguous blocks. Sub-allocate from these pools during operation. This eliminates runtime cudaMalloc calls.

2. **Use CUDA stream-ordered allocator**: `cudaMallocAsync` (CUDA 11.2+) provides a stream-ordered memory allocator that reduces fragmentation through pool-based allocation.

3. **Avoid frequent small allocations**: Batch allocations, reuse buffers, and use memory pools for variable-size outputs.

4. **Custom GPU allocator**: Implement `IGpuAllocator` interface for TensorRT, providing application-controlled sub-allocation from pre-allocated pools instead of direct CUDA allocation.

5. **Memory budgeting**: At system design time, compute the worst-case memory consumption of every component and ensure it fits within the physical memory with margin. On a 32GB Orin, a practical budget might be:
   - OS and system services: 4GB
   - Sensor drivers and preprocessing: 4GB
   - ML model weights: 8GB
   - ML activation/scratch memory: 6GB
   - Planning and control: 2GB
   - Logging and diagnostics: 4GB
   - Safety margin: 4GB

### OOM Prevention

- **Never use dynamic allocation during inference**: All buffers should be pre-allocated at startup
- **Monitor GPU memory usage continuously**: Use `tegrastats` or programmatic CUDA memory queries
- **Set hard memory limits per process**: Use cgroups or CUDA memory limits to prevent any single process from consuming all memory
- **Implement graceful degradation**: If memory pressure is detected, reduce model resolution or skip non-critical models rather than crashing
- **Periodic memory accounting**: Log memory usage patterns over 24+ hour periods to detect slow leaks

---

## 8. Startup and Initialization

### The Cold Start Problem

When an autonomous vehicle boots, it must load and initialize all ML models before it can drive. This is not instantaneous. Cold start involves:

1. **System boot**: Orin boot sequence from power-on to OS ready (~30-60 seconds for standard JetPack Linux)
2. **Sensor initialization**: Camera, LiDAR, radar bring-up (5-15 seconds)
3. **Model loading**: Deserializing TensorRT engines from disk into GPU memory
4. **Warm-up inference**: First inference pass to initialize CUDA contexts and JIT-compile any remaining kernels
5. **System health check**: Verify all models produce expected outputs on test inputs

### TensorRT Engine Loading Time

**Engine deserialization** (loading a pre-built plan file) is relatively fast -- typically 1-5 seconds per model depending on size. But there are pitfalls:

**First inference is always slow**: The first TensorRT inference after loading can take 10-50x longer than steady-state. One measured example showed 200ms warm inference vs. 10,000ms cold first inference. This is because:
- CUDA context initialization happens lazily
- GPU kernel JIT compilation occurs on first invocation
- Memory allocation and caching structures are initialized

**Engine building on device is prohibitively slow**:
- FP32 engine build: 1.5-3 minutes per model
- FP16 engine build: Up to 40 minutes per model
- 10 models at FP16: 50+ minutes of build time

This is why engines must be pre-built offline and shipped as cached plan files.

### Warm-Up Strategy

Triton provides a model warmup configuration option:
```
model_warmup {
  name: "warmup_requests"
  batch_size: 1
  inputs {
    key: "input"
    value: {
      data_type: TYPE_FP32
      dims: [3, 640, 960]
      random_data: true
    }
  }
  count: 5
}
```

This runs 5 synthetic inference passes before the model is marked as ready, ensuring all CUDA initialization is complete before the system accepts real inputs.

For a custom (non-Triton) deployment:
1. Deserialize all engines at boot
2. Create execution contexts
3. Allocate I/O buffers
4. Run 3-5 warm-up inferences per model with dummy data
5. Verify outputs are within expected ranges
6. Only then signal "perception ready" to the vehicle controller

### Boot Time Optimization

For production vehicles, total startup time matters -- the vehicle should be ready to drive within 60-90 seconds of power-on.

Optimization techniques:
- **Parallel model loading**: Load multiple engines concurrently from SSD (models are I/O bound during deserialization)
- **NVMe SSD**: Use fast storage to minimize engine file read time
- **Minimal OS**: Strip unnecessary services from the boot image
- **Engine file optimization**: Larger engines with weight streaming can reduce initial memory pressure
- **Staged readiness**: Enable basic safety functions (emergency stop, obstacle detection) first, then load world model and prediction models

---

## 9. Logging and Debugging

### The Challenge of Debugging ML on Vehicles

When a neural network makes a wrong prediction on a vehicle, you need to understand why. But the vehicle is in the field, the moment has passed, and you cannot replay the exact conditions. The solution is comprehensive data recording that enables offline reproduction.

### Data Recording Architecture

**Rosbag / MCAP recording**: The standard practice in ROS-based AV stacks is to record all sensor data, model inputs, and model outputs to rosbag (ROS 1) or MCAP (ROS 2) files.

What to record:
- **Raw sensor data**: Camera images, LiDAR point clouds, radar returns, IMU, GPS
- **Model inputs**: Preprocessed tensors fed to each model (after any normalization, cropping, augmentation)
- **Model outputs**: Raw network outputs (before and after post-processing), detection lists, confidence scores
- **System state**: Vehicle speed, steering angle, control commands, operational mode
- **Timing data**: Timestamps at each pipeline stage (sensor capture, preprocess start/end, inference start/end, postprocess start/end)
- **Model metadata**: Which model version, TensorRT engine version, calibration data version

**Storage scale**: Each vehicle can generate 2-10 GB per hour of raw sensor data. A fleet of 20 vehicles operating 8 hours/day produces 320-1600 GB per day. Budget accordingly.

### Smart Recording

Recording everything continuously is impractical at scale. Use triggered recording:

1. **Event-triggered**: Record a circular buffer (e.g., last 30 seconds) of full data when an anomaly is detected -- high model uncertainty, sensor disagreement, safety intervention, unusual object detection
2. **Periodic sampling**: Record 1-minute segments every 15 minutes for baseline monitoring
3. **Edge case detection**: Record when model confidence is near decision boundaries, when tracking objects are lost/reacquired, or when predictions disagree across frames

The Smart Black Box (SBB) concept uses anomaly detection to determine recording priority. It caches short-term data as buffers through a deterministic state machine, optimizing the trade-off between data value and storage cost.

### Offline Reproduction

The core debugging workflow:
1. Identify an incident (bad detection, missed object, false positive)
2. Retrieve the recorded data segment from the vehicle
3. Replay the sensor data through the perception pipeline in simulation
4. Compare simulation outputs with recorded vehicle outputs (should match if recording is complete)
5. Visualize intermediate representations (BEV features, attention maps, detection heatmaps)
6. If the model is at fault, add the case to the test/training set

**Deterministic replay requirement**: Rosbag playback must be deterministic -- playing the same bag N times must produce the same message sequence N times. This requires correct timestamping of each message during recording.

### Remote Diagnostics

For fleet operations:
- **OTA diagnostic queries**: Push diagnostic scripts that run specific test inputs through models and report results
- **Remote telemetry**: Continuous upload of model performance metrics (latency, confidence distributions, error counts)
- **Remote model versioning**: Query which exact model version each vehicle is running
- **Log aggregation**: Centralized logging with structured fields (vehicle ID, model ID, timestamp, event type) for fleet-wide analysis

### IEEE 1616.1 and Regulatory Recording

IEEE 1616.1 (ratified 2023) specifies event data recorder requirements for autonomous vehicles. The EDR provides "what-happened info" while the DSSAD (Data Storage System for Automated Driving) provides "why it happened info." The DSSAD must report the status of the autonomous driving system and who or what (human or software) was in control at each point.

---

## 10. A/B Testing ML Models

### Deployment Strategies for Model Updates

Updating ML models on production vehicles is high-stakes. A regression in object detection could cause a collision. Three strategies provide progressively increasing confidence:

### Shadow Mode (Safest)

The new model runs alongside the production model, processing the same sensor data, but its outputs are **not used for vehicle control**. Both models' predictions are logged for offline comparison.

Implementation:
- Duplicate sensor data to both models
- Production model drives all decisions
- Shadow model outputs are logged only
- Compare metrics offline: detection recall, precision, confidence calibration, latency

Shadow mode catches:
- Accuracy regressions on real-world data
- Latency increases that would violate real-time constraints
- Edge cases where new model fails but old model succeeds

Shadow mode misses:
- How the new model interacts with downstream planning/control
- Performance under closed-loop feedback
- Resource contention from running two models simultaneously

**Duration**: Run shadow mode for 1-2 weeks across diverse conditions before proceeding.

### Canary Deployment (Gradual)

Deploy the new model to a small fraction of the fleet:
1. Start with 1-5% of vehicles
2. Monitor closely for 1 week
3. Increase to 20%, monitor for 1 week
4. Increase to 50%, then 100%

At each stage, compare safety metrics (interventions, near-misses, disengagements) between canary and control groups. Roll back immediately if metrics degrade.

For a small airport fleet (5-20 vehicles), this might mean upgrading 1 vehicle first, then 3, then all.

### A/B Testing (Experimental)

Run two model versions simultaneously across the fleet with random assignment. Unlike canary (where you eventually want 100% on the new version), A/B testing is about determining which model is objectively better.

Metrics for A/B comparison:
- Detection recall at fixed precision
- False positive rate
- Tracking consistency (ID switches, track fragmentation)
- Inference latency (p50, p95, p99)
- Confidence calibration error
- Safety-critical metric: missed detections of humans/vehicles within safety zone

### Model Promotion Criteria

A new model should be promoted (replace the production model) when:
1. Shadow mode shows no accuracy regression across all operational domains
2. Canary deployment shows no increase in safety interventions
3. Latency is within budget (p99 < deadline)
4. Memory consumption fits within budget
5. Performance is validated across all weather/lighting conditions encountered during evaluation
6. Regulatory requirements are met (see Section 11)

---

## 11. Regulatory Requirements for ML Updates

### ISO/PAS 8800:2024 -- Safety and AI for Road Vehicles

ISO/PAS 8800:2024, published December 2024, is the first international standard specifically addressing AI/ML safety in automotive systems. It extends ISO 26262 (functional safety) and ISO 21448 (SOTIF) to cover the unique risks of machine learning.

### Structure (15 Clauses)

1-5: Definitions and references
6: Context for AI within road vehicles, basic safety concepts
7: AI safety management
8: Assurance arguments for AI systems
9: Derivation of AI safety requirements
10: Selection of AI technologies and architectural measures
11: Data-related considerations (training data quality, completeness, representativeness)
12: Verification and validation of AI systems
13: Safety analysis of AI systems
14: **Measures during operation** (field monitoring, model updates, change management)
15: Confidence in AI frameworks and software tools

### What Happens When You Update a Model?

ISO/PAS 8800 does not prescribe a simple "re-certify everything" requirement, but it does mandate:

1. **Change management process**: Any model update triggers formal change management. The change must be assessed for its impact on safety requirements.

2. **Re-verification of affected safety requirements**: If the model update could affect safety-relevant behavior, the V&V activities from Clause 12 must be repeated for the affected scope. This does not necessarily mean re-testing everything, but the portions of the safety case that depend on model performance must be re-validated.

3. **Field monitoring dataset validation**: Post-update, field monitoring (Clause 14) must confirm the updated model performs as expected in production. Data collected post-release monitors ongoing performance and triggers corrective actions if anomalies are detected.

4. **Assurance argument update**: The safety assurance argument (Clause 8) must be updated to reflect the model change. If the argument depends on specific model performance metrics, those metrics must be re-established.

### Compensation Through Non-AI Monitors

ISO/PAS 8800 explicitly allows reducing ML performance requirements by compensating with non-AI monitors or supervisors. For example, a safety monitor that detects when the ML model's outputs are physically implausible can catch failures that the model itself cannot prevent. This is directly relevant to airside AV operations where a rule-based safety layer can enforce hard constraints (stay within taxiway boundaries, stop if any object detected within N meters).

### Practical Impact on Model Updates

For an airside AV fleet:
- **Minor model updates** (retraining on more data, same architecture): Repeat V&V test suite, run shadow mode, update field monitoring baseline. If pass rates are maintained, update assurance argument.
- **Major model updates** (new architecture, new capabilities): Full safety analysis, updated HARA (Hazard Analysis and Risk Assessment), new V&V campaign, extended shadow mode, updated safety case.
- **Calibration-only updates** (INT8 calibration data change): Validate numerical equivalence within tolerance, run regression tests on known edge cases.

### Related Standards

- **UNECE R155/R156**: Cybersecurity and software update management for vehicles. Requires secure OTA infrastructure.
- **ISO 21434**: Cybersecurity engineering for road vehicles. Applies to the update mechanism itself.
- **ISO 26262**: Functional safety. The ML model is an element within a safety-relevant system, and changes to that element trigger change management per Part 8.
- **ISO/IEC 42001**: AI management systems (more general, not automotive-specific).
- **ISO/IEC 5469**: Design guidance for functional safety with AI systems.

### Note on Airport Airside Operations

Airside AV operations may fall under different regulatory frameworks than public road vehicles. Airport authorities, national aviation authorities (e.g., FAA, EASA), and ICAO guidance may apply in addition to or instead of automotive standards. However, ISO/PAS 8800 provides a strong engineering framework regardless of regulatory jurisdiction, and using it proactively demonstrates safety diligence.

---

## 12. Real-World Latency

### End-to-End Latency Budget

The total time from "photon hits camera sensor" to "actuator begins executing command" defines the responsiveness of an AV. This camera-to-actuator latency determines how fast the vehicle can react to new information.

Typical latency budget for an airside AV operating at 10-25 km/h:

| Component | Typical Latency | Notes |
|-----------|----------------|-------|
| Camera sensor exposure + readout | 5-15 ms | Rolling shutter adds complexity |
| Image ISP processing | 2-5 ms | Debayering, denoising, tone mapping |
| Data transfer to GPU | 1-3 ms | CSI interface, DMA transfer |
| Image preprocessing | 5-10 ms | Resize, normalize, format conversion |
| Neural network inference | 15-50 ms | Depends on model complexity and precision |
| Post-processing (NMS, tracking) | 2-10 ms | Non-maximum suppression, object association |
| Sensor fusion | 5-15 ms | Fusing camera + LiDAR + radar results |
| Prediction / world model | 10-30 ms | Forecasting other agents' trajectories |
| Planning | 5-20 ms | Path planning and trajectory optimization |
| Control command generation | 1-3 ms | PID / MPC controller |
| CAN bus transmission | 1-5 ms | Command to actuator ECU |
| Actuator response | 20-50 ms | Mechanical response of brakes/steering |
| **Total** | **72-216 ms** | |

### Measured Real-World Numbers

**Waymo** reported most neural networks running on their vehicles provide results in less than 10 ms (2019), though their overall perception pipeline is more complex.

**Perception pipeline on Jetson Orin Nano Super** (measured):
- Preprocessing: 8.5 ms average
- GPU inference (FP16): 19.1 ms
- Postprocessing (NMS + decode): 5.1 ms
- Total: ~32.7 ms for object detection alone

**YOLO models on Jetson Orin (measured)**:
- YOLOv8n INT8: 23.16 ms average iteration
- YOLOv8n FP16: 26.70 ms
- YOLOv8s INT8: 28.25 ms

**UrgenGo self-driving bus evaluation** (measured on RTX 3070Ti):
- 3D detection (PointPillars): 13.4 ms
- 2D detection: 19.8 ms
- Segmentation: 11.5 ms
- Path planning: 8.0 ms

**BEV perception (Fast-BEV, academic)**: 52.6 FPS = ~19 ms per frame on capable hardware.

**BI3D stereo network on DLA**: ~46 FPS = ~22 ms, providing 30 ms latency on Jetson AGX Orin.

### Sources of Latency Variance

In production, latency is NOT constant. Key sources of variance:

1. **GPU thermal throttling**: When the GPU hits 99 C, software throttling reduces clock frequency, increasing inference time by 20-50%
2. **Memory bandwidth contention**: Multiple models accessing GPU memory simultaneously causes bank conflicts
3. **CPU scheduling jitter**: OS preemption of data preprocessing threads adds 1-5 ms of jitter
4. **Dynamic input complexity**: Models with dynamic shapes (variable number of detections, variable-size inputs) have input-dependent inference time
5. **CUDA context switching**: When multiple CUDA contexts share the GPU, context switching adds overhead
6. **Power mode**: Inference latency varies significantly with power mode (15W vs 30W vs MAXN)
7. **Sensor synchronization**: Waiting for all cameras to deliver frames can add up to one frame period of delay

**Tail latency matters most**: p99 latency determines whether the system meets real-time deadlines. A model averaging 20 ms but spiking to 80 ms at p99 is worse for safety than a model consistently at 30 ms.

### Speed-Dependent Deadlines

The required perception latency depends on vehicle speed. At higher speeds, more frequent control updates are needed:

- Walking speed (5 km/h): 200+ ms budget is acceptable
- Airside operational speed (15 km/h): 100-150 ms budget
- Airside transit (25 km/h): 80-100 ms budget
- Highway (100 km/h): 50-60 ms budget

TimelyNet demonstrated adaptive architecture selection based on dynamic deadlines -- using larger, more accurate subnets when the vehicle moves slowly, and smaller, faster subnets at higher speeds.

---

## 13. Power Management

### Power Budget Reality

On an electric GSE vehicle, every watt consumed by compute is a watt not available for propulsion. The GPU compute system directly impacts vehicle range and operational duration.

### Jetson AGX Orin Power Modes

The AGX Orin 64GB supports these pre-configured power modes:

| Mode | TDP | CPU Cores | CPU Freq | GPU TPCs | GPU Freq | DLA |
|------|-----|-----------|----------|----------|----------|-----|
| 15W | 15W | 4 | ~1.2 GHz | 3 | ~400 MHz | 1 |
| 30W (default) | 30W | 8 | ~1.5 GHz | 6 | ~600 MHz | 2 |
| 50W | 50W | 12 | ~1.7 GHz | 8 | ~900 MHz | 2 |
| MAXN | 60W | 12 | max | 8 | max | 2 |

The AGX Orin 32GB supports 15W, 30W, and 40W modes.

**MAXN mode caution**: "This mode does not guarantee the best performance for all use cases because hardware throttling is engaged when the total module power exceeds the TDP budget." In practice, sustained MAXN operation causes thermal throttling within minutes on many carrier boards.

Power mode selection: `sudo /usr/sbin/nvpmodel -m <mode_id>`. Settings persist across power cycles.

### Power-Efficient Inference with DLA

DLA is the single most effective tool for reducing power consumption while maintaining inference performance:

- DLA is 3-5x more power-efficient than the GPU for supported operations
- At 15W mode, DLA provides 74% of total AI compute (40 of 54 TOPS)
- At 30W mode, DLA provides 69% of total AI compute (90 of 131 TOPS)

**Strategy**: Run as many models as possible on DLA, reserving GPU for models with unsupported operations. The efficiency gap is largest at lower power budgets, making DLA critical for battery-powered vehicles.

### Thermal Throttling Behavior

When the module approaches thermal limits:

| Temperature | Action |
|-------------|--------|
| Rising | Fan speed increases (if fan-cooled) |
| 99 C | Software clock throttling begins -- GPU/CPU frequencies reduced |
| 103 C | Hardware throttling -- forced frequency reduction |
| 104.5 C | Software shutdown initiated |
| 105 C | Hardware emergency shutdown |

The NAFLL (Noise Aware Frequency Lock Loop) manages clock domains. Higher frequencies require higher voltages, so DVFS (Dynamic Voltage Frequency Scaling) reduces both frequency and voltage under thermal pressure.

Fan profiles:
- **Cool**: Active cooling at lower temperatures (aggressive fan use)
- **Quiet**: Delayed fan activation, higher temperature threshold before cooling (default for NX/Nano)

For airside AV operations in hot climates (desert airports, summer tarmac), the thermal environment is hostile. Ambient temperatures of 50 C+ on tarmac are common, leaving very little thermal headroom before throttling. Carrier board thermal design is critical.

### Power Monitoring Tools

- **tegrastats**: Command-line tool reporting real-time CPU/GPU frequency, temperature, and power consumption per rail
- **jtop (jetson-stats)**: GUI-based monitoring with historical graphs
- **Jetson Power GUI**: Data logging and visualization of power channels across GPU, CPU, SOC, and voltage regulators
- **INA3221 power monitors**: Hardware current/voltage sensors at I2C addresses 0x40 and 0x41

### Practical Power Management for Electric GSE

For a battery-powered airport tug or baggage tractor with an Orin compute system:

1. **Use 30W mode as baseline**: Provides good inference performance while limiting power draw. The DLA provides majority of compute at this power level.

2. **Dynamic power mode switching**: During straight-line driving (low perception demand), drop to 15W. During complex maneuvers (approaching aircraft, crossing active taxiway), switch to 50W for maximum perception capability.

3. **Thermal design for tarmac**: Ensure the carrier board thermal solution handles 55 C ambient (conservative for sun-exposed tarmac). Liquid cooling or high-capacity heat pipes may be necessary.

4. **Battery impact estimation**: At 30W continuous, the Orin module consumes 0.72 kWh over a 24-hour shift. This is negligible compared to propulsion (a typical electric tug has a 20-40 kWh battery). Even at MAXN (60W), compute is ~0.05% of propulsion energy. The real concern is not energy consumption but heat generation and thermal management.

5. **Sleep modes**: When the vehicle is parked and not needed, use SC7 deep sleep mode to minimize power draw while maintaining fast wake capability.

6. **PVA (Programmable Vision Accelerator)**: Available on Orin for traditional CV operations (rectification, stereo matching). Even more power-efficient than DLA for supported operations.

---

## References and Sources

### NVIDIA Documentation
- [TensorRT Dynamic Shapes Documentation](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-dynamic-shapes.html)
- [TensorRT Architecture - How TensorRT Works](https://docs.nvidia.com/deeplearning/tensorrt/latest/architecture/how-trt-works.html)
- [TensorRT Runtime Cache](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-runtime-cache.html)
- [Triton Inference Server at the Edge](https://developer.nvidia.com/blog/simplifying-ai-model-deployment-at-the-edge-with-triton-inference-server/)
- [Maximizing Deep Learning Performance with DLA](https://developer.nvidia.com/blog/maximizing-deep-learning-performance-on-nvidia-jetson-orin-with-dla/)
- [Power Optimization with NVIDIA Jetson](https://developer.nvidia.com/blog/power-optimization-with-nvidia-jetson/)
- [Jetson Orin Power and Performance Guide](https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/PlatformPowerAndPerformance/JetsonOrinNanoSeriesJetsonOrinNxSeriesAndJetsonAgxOrinSeries.html)
- [NVIDIA DRIVE Safety](https://www.nvidia.com/en-us/self-driving-cars/safety/)
- [ML Model Monitoring in Production](https://developer.nvidia.com/blog/a-guide-to-monitoring-machine-learning-models-in-production/)
- [DRIVE AGX Thor Developer Kit](https://developer.nvidia.com/blog/accelerate-autonomous-vehicle-development-with-the-nvidia-drive-agx-thor-developer-kit/)
- [DLA Getting Started on Orin](https://developer.nvidia.com/blog/getting-started-with-the-deep-learning-accelerator-on-nvidia-jetson-orin/)

### TensorRT Determinism and Memory
- [TensorRT Determinism Discussion (GitHub Issue #44)](https://github.com/NVIDIA/TensorRT/issues/44)
- [TensorRT Determinism Forum Discussion](https://forums.developer.nvidia.com/t/is-tensorrt-inference-deterministic-reproducibile/159955)
- [TensorRT Memory Sharing (GitHub Issue #3276)](https://github.com/NVIDIA/TensorRT/issues/3276)
- [TensorRT Build Time Discussion](https://forums.developer.nvidia.com/t/tensorrt-model-build-time-and-deployment/198323)
- [TensorRT Cold Start Forum](https://forums.developer.nvidia.com/t/tensorrt-cold-start-first-time-inference/294358)

### Orin Reliability
- [Orin Silicon Health Telemetry (NASA/AFWERX Context)](https://forums.developer.nvidia.com/t/nasa-afwerx-context-accessing-jetson-orin-silicon-health-wear-telemetry-for-long-term-missions-thermal-ecc-voltage/363454)
- [AGX Orin Industrial ECC Information](https://forums.developer.nvidia.com/t/agx-orin-industrial-ecc-information/262834)
- [AGX Orin Boot Time Optimization](https://forums.developer.nvidia.com/t/agx-orin-boot-time-improve/336992)
- [Jetson AGX Orin Thermal Design Guide](https://www.mouser.com/pdfDocs/Jetson_AGX_Orin_Series_TDG-10943-001_v11.pdf)

### Safety Standards
- [ISO/PAS 8800:2024 Standard](https://www.iso.org/standard/83303.html)
- [ISO/PAS 8800 Overview (LHPES)](https://www.lhpes.com/blog/what-is-iso-pas-8800)
- [ISO 8800 Safety and AI (SecuRESafe)](https://sres.ai/functional-safety/safety-and-artificial-intelligence-a-look-into-the-iso-8800-standard/)
- [ISO/PAS 8800 Safety Systems (UL Solutions)](https://www.ul.com/sis/blog/safety-related-systems-road-vehicles-artificial-intelligence-are-addressed-isopas-88002024)
- [NVIDIA DRIVE Safety Milestones](https://blogs.nvidia.com/blog/nvidia-drive-safety-milestones/)

### GPU Scheduling Research
- [UrgenGo: Urgency-Aware GPU Scheduling for Autonomous Driving](https://arxiv.org/html/2509.12207)
- [TimelyNet: Adaptive Neural Architecture for Autonomous Driving](https://dl.acm.org/doi/10.1145/3762652)
- [GPU Sharing for Real-Time Autonomous Driving Systems (UNC Dissertation)](https://www.cs.unc.edu/~anderson/diss/mingdiss.pdf)

### ML Monitoring
- [Evidently AI: ML Monitoring Metrics](https://www.evidentlyai.com/blog/ml-monitoring-metrics)
- [Data Drift Detection (Evidently AI)](https://www.evidentlyai.com/ml-in-production/data-drift)
- [Model Drift Best Practices (Encord)](https://encord.com/blog/model-drift-best-practices/)
- [ML Monitoring and Drift Detection (BentoML)](https://www.bentoml.com/blog/a-guide-to-ml-monitoring-and-drift-detection)

### Deployment Strategies
- [Shadow Deployment vs. Canary Release (JFrog ML)](https://www.qwak.com/post/shadow-deployment-vs-canary-release-of-machine-learning-models)
- [Model Deployment Strategies (Neptune.ai)](https://neptune.ai/blog/model-deployment-strategies)
- [Shadow Testing in Autonomous Vehicles (ResearchGate)](https://www.researchgate.net/publication/385733470_Shadow_Testing_in_Autonomous_Vehicles_A_Novel_Approach_to_Validating_Full_Self-Driving_AI_Systems)

### Data Recording and Debugging
- [AV Black Box Requirements (Machine Design)](https://www.machinedesign.com/mechanical-motion-systems/article/21836355/independent-thinking-why-the-black-box-is-needed-for-autonomous-vehicle-deployments)
- [Debugging Autonomous Driving Systems (arXiv)](https://arxiv.org/html/2601.04293v1)
- [Tier4 Data Recording System (GitHub)](https://github.com/tier4/data_recording_system)

### Latency Measurements
- [MLPerf Automotive Benchmark](https://arxiv.org/html/2510.27065v1)
- [Perception Latency Mitigation (PLM-Net)](https://arxiv.org/html/2407.16740)
- [RT-BEV: Real-Time BEV Perception](https://rtcl.eecs.umich.edu/rtclweb/assets/publications/2024/rtss24-liu.pdf)
