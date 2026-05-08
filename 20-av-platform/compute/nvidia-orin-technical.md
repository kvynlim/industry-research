# NVIDIA Jetson AGX Orin: Deep Technical Reference for AV Deployment

**Last Updated:** 2026-03-22
**Applicable SKUs:** Jetson AGX Orin 32GB, 64GB, Industrial

---

## Table of Contents

1. [SoC Architecture Overview](#1-soc-architecture-overview)
2. [CPU Subsystem](#2-cpu-subsystem)
3. [GPU Subsystem](#3-gpu-subsystem)
4. [Deep Learning Accelerator (NVDLA v2.0)](#4-deep-learning-accelerator-nvdla-v20)
5. [TOPS Breakdown](#5-tops-breakdown)
6. [Memory Subsystem](#6-memory-subsystem)
7. [Power Modes and Performance Scaling](#7-power-modes-and-performance-scaling)
8. [JetPack SDK Versions](#8-jetpack-sdk-versions)
9. [TensorRT and DLA-Compatible Layers](#9-tensorrt-and-dla-compatible-layers)
10. [Multi-Process GPU Sharing (MPS)](#10-multi-process-gpu-sharing-mps)
11. [Isaac ROS Packages](#11-isaac-ros-packages)
12. [Thermal Management](#12-thermal-management)
13. [I/O and Peripheral Interfaces](#13-io-and-peripheral-interfaces)
14. [Real-World Inference Benchmarks](#14-real-world-inference-benchmarks)
15. [Industrial Variant Specifications](#15-industrial-variant-specifications)
16. [Competitive Landscape](#16-competitive-landscape)
17. [Jetson AGX Orin vs DRIVE Orin](#17-jetson-agx-orin-vs-drive-orin)
18. [Successor: Jetson Thor](#18-successor-jetson-thor)
19. [Pricing and Availability](#19-pricing-and-availability)
20. [AV Deployment Considerations](#20-av-deployment-considerations)

---

## 1. SoC Architecture Overview

The Jetson AGX Orin is built on the NVIDIA Orin SoC, a heterogeneous compute platform integrating multiple accelerator types on a single die. The SoC combines an Arm CPU complex, NVIDIA Ampere-architecture GPU, two second-generation Deep Learning Accelerators (NVDLA v2.0), a Programmable Vision Accelerator (PVA v2.0), video encode/decode engines, and an Image Signal Processor (ISP).

| Feature | AGX Orin 32GB | AGX Orin 64GB |
|---------|---------------|---------------|
| Process Node | Samsung 8nm | Samsung 8nm |
| SoC | NVIDIA Orin | NVIDIA Orin |
| GPU Architecture | NVIDIA Ampere | NVIDIA Ampere |
| AI Performance (Sparse INT8) | 200 TOPS | 275 TOPS |
| Module Dimensions | 100mm x 87mm | 100mm x 87mm |
| Pin Compatibility | AGX Xavier compatible | AGX Xavier compatible |

The Orin SoC uses a unified memory architecture where CPU, GPU, DLA, PVA, and other engines share the same LPDDR5 DRAM pool. This eliminates data copy overhead between accelerators but requires careful memory bandwidth management when running concurrent workloads.

---

## 2. CPU Subsystem

| Specification | AGX Orin 32GB | AGX Orin 64GB |
|---------------|---------------|---------------|
| Core Architecture | Arm Cortex-A78AE | Arm Cortex-A78AE |
| ISA | ARMv8.2-A (64-bit) | ARMv8.2-A (64-bit) |
| Core Count | 8 cores | 12 cores |
| Cluster Configuration | 2 clusters x 4 cores | 3 clusters x 4 cores |
| Max Clock Frequency | 2.2 GHz | 2.2 GHz |
| L2 Cache | 2 MB (per cluster) | 2 MB (per cluster) |
| L3 Cache | 4 MB | 6 MB |

The Cortex-A78AE is the automotive-enhanced variant of the A78, providing:

- **Lock-step mode support** for safety-critical computations (split-lock configuration)
- **ECC on caches** for data integrity
- **ARMv8.2 extensions** including dot-product instructions beneficial for quantized inference pre/post-processing

The 12-core configuration on the 64GB variant provides 1.7x the CPU throughput of the 8-core Jetson AGX Xavier, relevant for non-GPU-accelerated pipeline stages such as point cloud preprocessing, ROS node orchestration, and sensor data marshalling.

---

## 3. GPU Subsystem

The Orin's GPU is based on the NVIDIA Ampere architecture, the same generation as the data-center A100/A30 but in a mobile-optimized configuration.

### 3.1 GPU Configuration

| Specification | AGX Orin 32GB | AGX Orin 64GB |
|---------------|---------------|---------------|
| Graphics Processor Clusters (GPC) | 2 | 2 |
| Texture Processor Clusters (TPC) | 7 | 8 |
| Streaming Multiprocessors (SM) | 14 | 16 |
| CUDA Cores (128 per SM) | 1792 | 2048 |
| 3rd-Gen Tensor Cores (4 per SM) | 56 | 64 |
| L1 Cache per SM | 192 KB | 192 KB |
| L2 Cache | 4 MB | 4 MB |
| Max GPU Clock | 930.75 MHz | 1300 MHz |

### 3.2 Compute Performance

| Precision | AGX Orin 32GB | AGX Orin 64GB |
|-----------|---------------|---------------|
| FP32 (CUDA cores) | ~3.8 TFLOPS | 5.3 TFLOPS |
| FP16 (CUDA cores) | ~7.6 TFLOPS | 10.6 TFLOPS |
| FP16 (Tensor Cores) | ~60 TFLOPS | 85 TFLOPS |
| INT8 Dense (Tensor Cores) | ~60 TOPS | 85 TOPS |
| INT8 Sparse (Tensor Cores) | ~120 TOPS | 170 TOPS |

### 3.3 Ampere Architecture Advantages for AV

- **Structured sparsity (2:4):** The 3rd-generation Tensor Cores support fine-grained structured sparsity, doubling INT8 throughput for networks pruned to the 2:4 pattern. This is particularly relevant for deploying optimized perception models.
- **TF32 precision:** Available for training/fine-tuning workflows directly on the device.
- **Asynchronous copy:** Hardware-accelerated data movement from global memory to shared memory, reducing CUDA kernel latency.

---

## 4. Deep Learning Accelerator (NVDLA v2.0)

The Orin integrates **two independent NVDLA v2.0 cores**, representing a 9x performance improvement over the first-generation DLA found on Xavier.

### 4.1 DLA Architecture

| Specification | Value |
|---------------|-------|
| DLA Cores | 2 (independently schedulable) |
| SRAM per DLA Core | 1 MiB dedicated |
| Supported Precisions | INT8, FP16 |
| INT8 Sparse TOPS (both DLAs) | 105 TOPS |
| INT8 Dense TOPS (both DLAs) | ~52.5 TOPS |

### 4.2 DLA Power Efficiency

DLA performance per watt is 3-5x superior to the GPU, depending on the power mode and workload. This efficiency makes DLA critical for meeting the full 275 TOPS within the platform power envelope.

DLA contribution by power mode:

| Power Mode | DLA TOPS | Total TOPS | DLA Contribution |
|------------|----------|------------|------------------|
| MAXN (60W) | 105 | 275 | 38% |
| 50W | 92 | 200 | 46% |
| 30W | 90 | 131 | 69% |
| 15W | 40 | 54 | 74% |

At lower power budgets, DLA becomes the dominant compute engine. This is a key architectural insight for AV systems that need to operate in reduced-power thermal states.

### 4.3 DLA Throughput Benchmarks (GPU + 2x DLA Combined)

| Model | FPS (GPU + 2x DLA) |
|-------|---------------------|
| PeopleNet (ResNet18) | 346 |
| TrafficCamNet | 425 |
| FaceDetect-IR | 2,381 |
| VehicleMakeNet | 3,600 |

---

## 5. TOPS Breakdown

The headline 275 Sparse INT8 TOPS for the AGX Orin 64GB is the sum of concurrent GPU Tensor Core and DLA execution:

```
275 TOPS (Sparse INT8) = 170 TOPS (GPU Tensor Cores, Sparse)
                        + 105 TOPS (2x NVDLA v2.0, Sparse)
```

### 5.1 Dense vs Sparse Performance

| Accelerator | INT8 Sparse | INT8 Dense | FP16 |
|-------------|-------------|------------|------|
| GPU Tensor Cores (64GB) | 170 TOPS | 85 TOPS | 85 TFLOPS |
| 2x NVDLA v2.0 | 105 TOPS | ~52.5 TOPS | — |
| GPU CUDA Cores (64GB) | — | — | 10.6 TFLOPS |
| **Total** | **275 TOPS** | **~138 TOPS** | — |

**Key consideration for AV deployment:** The 275 TOPS figure assumes both structured sparsity (2:4 pruning) in all weight matrices AND concurrent GPU+DLA utilization. Real-world AV perception pipelines typically achieve a fraction of peak TOPS due to:

- Not all layers being sparsity-compatible
- Memory bandwidth bottlenecks on complex models
- Pipeline stage serialization
- DLA layer coverage gaps requiring GPU fallback

### 5.2 PVA v2.0 (Programmable Vision Accelerator)

The PVA is not included in the TOPS figure but provides additional compute for classical computer vision kernels:

- Image warping and undistortion
- Fast Fourier Transform (FFT)
- Image pyramid generation
- Stereo disparity computation
- Harris/FAST feature detection
- Optical flow

PVA is particularly useful for offloading camera preprocessing from the GPU in multi-camera AV perception stacks.

---

## 6. Memory Subsystem

| Specification | AGX Orin 32GB | AGX Orin 64GB |
|---------------|---------------|---------------|
| Memory Type | LPDDR5 | LPDDR5 |
| Capacity | 32 GB | 64 GB |
| Bus Width | 256-bit | 256-bit |
| Clock Speed | 3200 MHz | 3200 MHz |
| Data Rate | 6400 Mbps/pin | 6400 Mbps/pin |
| Bandwidth | 204.8 GB/s | 204.8 GB/s |
| ECC Support | No (standard module) | No (standard module) |
| Storage | 64 GB eMMC 5.1 | 64 GB eMMC 5.1 |

### 6.1 Memory Bandwidth Analysis for AV Workloads

At 204.8 GB/s, the memory bandwidth is shared across all SoC engines (CPU, GPU, DLA, PVA, video codecs, ISP). For a multi-sensor AV stack running concurrent LiDAR 3D detection, multi-camera perception, and sensor fusion:

- **BEVFusion (6-camera + LiDAR):** Consumes significant bandwidth for feature map storage and BEV grid generation
- **Multi-camera backbone inference:** Each camera stream requires feature extraction bandwidth
- **Point cloud processing:** Voxelization and sparse convolution are memory-intensive

The unified memory architecture means there are no PCIe transfer bottlenecks between CPU and GPU (unlike discrete GPU systems), but total bandwidth is the hard constraint.

### 6.2 Memory Capacity Recommendations

- **32 GB:** Sufficient for single-pipeline perception (e.g., 1 LiDAR + 4 cameras) with moderate model complexity
- **64 GB:** Required for multi-pipeline AV stacks, BEVFusion with 6+ cameras, concurrent perception + planning + mapping, or development/profiling workloads

---

## 7. Power Modes and Performance Scaling

The Orin supports multiple pre-configured power modes via the `nvpmodel` utility, plus custom mode creation.

### 7.1 AGX Orin 64GB Power Modes

| Parameter | MAXN (Mode 0) | 50W (Mode 3) | 30W (Mode 2) | 15W (Mode 1) |
|-----------|---------------|--------------|--------------|--------------|
| Power Budget | No cap (~60W) | 50W | 30W | 15W |
| Online CPU Cores | 12 | 12 | 8 | 4 |
| CPU Max Freq (MHz) | 2201.6 | 1497.6 | 1728 | 1113.6 |
| GPU TPC Count | 8 | 8 | 4 | 3 |
| GPU Max Freq (MHz) | 1301 | 828.75 | 624.75 | 420.75 |
| DLA Cores | 2 | 2 | 2 | 2 |
| Memory Max Freq (MHz) | 3200 | 3200 | 3200 | 2133 |
| AI Performance (TOPS) | 275 | ~200 | ~131 | ~54 |

### 7.2 AGX Orin 32GB Power Modes

| Parameter | MAXN (Mode 0) | 40W (Mode 3) | 30W (Mode 2) | 15W (Mode 1) |
|-----------|---------------|--------------|--------------|--------------|
| Power Budget | No cap (~40W) | 40W | 30W | 15W |
| Online CPU Cores | 8 | 8 | 8 | 4 |
| CPU Max Freq (MHz) | 2188.8 | 1497.6 | 1728 | 1113.6 |
| GPU TPC Count | 7 | 7 | 4 | 3 |
| GPU Max Freq (MHz) | 930.75 | 828.75 | 624.75 | 420.75 |
| DLA Cores | 2 | 2 | 2 | 2 |
| Memory Max Freq (MHz) | 3200 | 3200 | 3200 | 2133 |
| AI Performance (TOPS) | 200 | — | — | — |

### 7.3 Power Mode Selection for AV

- **MAXN:** Development and benchmarking; maximum performance with no power cap
- **50W:** Recommended for production AV systems with active cooling; best balance of performance and thermal manageability
- **30W:** Viable for limited perception stacks (e.g., camera-only) or failover/limp-home modes
- **15W:** Standby/monitoring modes; insufficient for full AV perception

Custom power modes can be created to tune CPU/GPU frequencies independently, enabling application-specific optimization (e.g., higher GPU clocks with fewer CPU cores for inference-heavy workloads).

---

## 8. JetPack SDK Versions

JetPack is the comprehensive SDK for Jetson, bundling the BSP (Jetson Linux), CUDA toolkit, TensorRT, cuDNN, and AI frameworks.

### 8.1 JetPack 5.x Series (Legacy)

| Component | JetPack 5.1.1 | JetPack 5.1.2 |
|-----------|---------------|---------------|
| Jetson Linux (L4T) | R35.3.1 | R35.4.1 |
| CUDA | 11.4 | 11.4 |
| TensorRT | 8.5.2 | 8.5.2 |
| cuDNN | 8.6 | 8.6 |
| VPI | 2.3 | 2.3 |

### 8.2 JetPack 6.x Series (Current)

| Component | JetPack 6.0 (GA) | JetPack 6.1 | JetPack 6.2 |
|-----------|-------------------|-------------|-------------|
| Jetson Linux (L4T) | R36.3 | R36.4 | R36.4.3 |
| CUDA | 12.2 | 12.5 | 12.6 |
| TensorRT | 8.6 | 10.1 | 10.3 |
| cuDNN | 8.9 | 9.1 | 9.3 |
| VPI | 3.1 | 3.2 | 3.2 |
| DLA Compiler | 3.14 | 3.17 | 3.1 |
| DLFW | — | — | 24.0 |

### 8.3 Key JetPack 6 Features for AV

- **Upgradable compute stack:** CUDA, TensorRT, cuDNN, DLA, and VPI can be upgraded independently without reflashing the entire Jetson Linux image.
- **Over-The-Air (OTA) updates:** Supports field updates from JetPack 5 to JetPack 6 and incremental JetPack 6 updates.
- **Jetson Platform Services:** Pre-built containerized services for AI application deployment, including video analytics, API gateway, and fleet management integration.
- **PREEMPT_RT kernel support:** Real-time Linux kernel for deterministic latency, critical for AV control loops.
- **Container support:** Native Docker and Kubernetes support for modular AV software deployment.
- **MPS support (JetPack 6.1+):** Multi-Process Service for GPU sharing across concurrent inference processes.

---

## 9. TensorRT and DLA-Compatible Layers

### 9.1 TensorRT Capabilities

TensorRT is NVIDIA's inference optimization engine that performs:

- **Layer fusion:** Combines sequential operations (Conv + BN + ReLU) into single kernels
- **Precision calibration:** FP32 to FP16/INT8 quantization with calibration datasets
- **Kernel auto-tuning:** Selects optimal CUDA kernels for each layer based on input dimensions
- **Dynamic tensor memory:** Minimizes memory footprint through buffer reuse
- **DLA offloading:** Automatically partitions networks between GPU and DLA

Current version on JetPack 6.2: **TensorRT 10.3**

### 9.2 DLA-Compatible Layers (TensorRT)

The following layers can execute on DLA. Unsupported layers automatically fall back to GPU.

#### Fully Supported on DLA

| Layer Type | Supported Operations | Constraints |
|------------|---------------------|-------------|
| **Convolution** | Standard, depthwise, grouped | Kernel [1,32], stride [1,8], padding [0,31], channels [1,8192] |
| **Deconvolution** | Transposed convolution | Kernel [1,32], padding must be 0, no grouped deconv |
| **Fully Connected** | Dense layers | Same constraints as convolution |
| **Activation** | ReLU, Sigmoid, TanH, Clipped ReLU, Leaky ReLU | TanH/Sigmoid auto-upgrade to FP16 in INT8 mode |
| **Pooling** | Max, Average | Window [1,8], stride [1,16], padding [0,7] |
| **ElementWise** | Sum, Sub, Product, Max, Min, Div, Pow | Broadcasting supported (NCHW, NC11, N111) |
| **Scale** | Uniform, Per-Channel, ElementWise | Scale and shift only |
| **Concatenation** | Along channel axis only | Min 2 inputs, same spatial dims |
| **LRN** | Across-channels | Window sizes: 3, 5, 7, 9 only |
| **Parametric ReLU** | PReLU | Slope must be build-time constant |
| **Softmax** | Orin only (not Xavier) | Axis dimension limit: 1024 |
| **Resize** | Nearest-neighbor, bilinear | Scale [1,32] nearest, [1,4] bilinear |
| **Slice** | Static slicing on CHW | 4D inputs only |
| **Shuffle** | Reshape/transpose | 4D tensors, batch dim excluded |
| **Reduce** | MAX only | 4D tensors, dims [1,8192] |
| **Comparison** | Equal, Greater, Less | INT8 precision only, requires Cast |
| **Unary** | ABS, SIN, COS, ATAN | SIN/COS/ATAN require INT8 input |

#### Notable DLA Limitations

- **No support for:** GroupNorm, LayerNorm, InstanceNorm, attention mechanisms, dynamic shapes, batch sizes > 4096
- **No separate accelerator assignment** for activation vs. parent layer
- **Formatting overhead:** Transitions between GPU and DLA incur data reformatting cost. Minimizing GPU-DLA transitions is critical for performance
- **1 MiB SRAM per DLA core** (vs. 4 MiB shared on Xavier); larger activation maps spill to DRAM
- **No dynamic dimensions:** All tensor shapes must be known at engine build time

### 9.3 DLA Deployment Best Practices for AV Models

1. **Profile before committing:** Use `trtexec --useDLACore=0 --allowGPUFallback` to identify which layers run on DLA vs. GPU
2. **Minimize DLA-GPU transitions:** Consecutive DLA-compatible layers execute efficiently; interleaved unsupported layers cause costly reformatting
3. **Use INT8 on DLA:** DLA's INT8 throughput is significantly higher than FP16, and quantization-aware training (QAT) preserves accuracy
4. **Run both DLA cores:** Schedule independent models or pipeline stages on DLA0 and DLA1 concurrently
5. **Combine GPU + DLA:** Run the camera backbone on GPU while running the LiDAR detection head on DLA

---

## 10. Multi-Process GPU Sharing (MPS)

### 10.1 MPS Availability

| JetPack Version | CUDA Version | MPS Support |
|-----------------|-------------|-------------|
| JetPack 5.x | CUDA 11.4 | Not supported |
| JetPack 6.0 | CUDA 12.2 | Not supported |
| JetPack 6.1 | CUDA 12.5 | Supported |
| JetPack 6.2 | CUDA 12.6 | Supported |

MPS was historically unavailable on Tegra (Jetson) devices. Support was introduced with JetPack 6.1 / CUDA 12.5.

### 10.2 How MPS Works on Jetson

MPS shifts GPU sharing from **temporal multiplexing** (time-slicing, where processes take turns) to **spatial sharing** (concurrent execution on different SMs). This provides:

- Reduced context-switch overhead
- Better GPU utilization for bursty inference workloads
- Lower tail latency for multi-model AV stacks

### 10.3 Enabling MPS

```bash
export CUDA_MPS_PIPE_DIRECTORY=/tmp/mps-pipe
export CUDA_MPS_LOG_DIRECTORY=/tmp/mps-log
mkdir -p /tmp/mps-pipe /tmp/mps-log
sudo -E nvidia-cuda-mps-control -d
```

Thread percentage allocation per process:
```bash
export CUDA_MPS_ACTIVE_THREAD_PERCENTAGE=50  # Allocate 50% of GPU SMs
```

### 10.4 Known Limitations

- **Single-user constraint:** Once an MPS server starts under one user, only that user's processes can access the GPU
- **Kubernetes issues:** MPS within containerized K8s deployments has reported compatibility issues with the NVIDIA k8s-device-plugin
- **Thread percentage enforcement:** At lower allocation thresholds (< 30%), priority enforcement is inconsistent on the integrated GPU
- **No hardware partitioning:** Unlike NVIDIA MIG on data-center GPUs, MPS on Orin provides software-level isolation only

### 10.5 AV Multi-Process Architecture Implications

For AV stacks running concurrent perception models (e.g., camera detection + LiDAR detection + tracking + freespace), consider:

- **MPS for lightweight concurrent models:** Good for running 2-3 small models simultaneously
- **DLA offloading preferred:** Offload one pipeline to DLA and run another on GPU, achieving true hardware-level parallelism without MPS overhead
- **Batch consolidation:** Where possible, batch multiple inference requests through a single process to avoid MPS overhead entirely

---

## 11. Isaac ROS Packages

NVIDIA Isaac ROS provides GPU-accelerated ROS 2 packages optimized for Jetson platforms. These maintain standard ROS 2 APIs while leveraging NVIDIA hardware acceleration.

### 11.1 Perception Packages Relevant to AV

| Package | Description | AV Relevance |
|---------|-------------|--------------|
| `isaac_ros_visual_slam` (cuVSLAM) | GPU-accelerated Visual SLAM | Localization without GNSS |
| `isaac_ros_nvblox` | 3D scene reconstruction | Real-time occupancy mapping |
| `isaac_ros_detectnet` | 2D object detection (DetectNet) | Vehicle/pedestrian detection |
| `isaac_ros_yolov8` | YOLOv8 inference pipeline | Real-time 2D detection |
| `isaac_ros_rt_detr` | RT-DETR detection | Transformer-based detection |
| `isaac_ros_foundationpose` | 6-DOF pose estimation | Object pose tracking |
| `isaac_ros_centerpose` | CenterPose 6D estimation | Object pose from single image |
| `isaac_ros_depth_image_proc` | Depth image processing | Stereo/depth camera pipeline |
| `isaac_ros_ess` | ESS stereo depth | Dense depth estimation |
| `isaac_ros_foundationstereo` | Foundation stereo depth | Learned stereo matching |
| `isaac_ros_occupancy_grid_localizer` | LiDAR-based localization | Map-relative positioning |
| `isaac_ros_image_pipeline` | Camera calibration/rectification | Multi-camera preprocessing |
| `isaac_ros_h264_encoder` | H.264 video compression | Bandwidth-efficient recording |
| `isaac_ros_cumotion` | GPU-accelerated motion planning | Trajectory generation |

### 11.2 NITROS (NVIDIA Isaac Transport for ROS)

NITROS is a zero-copy GPU-accelerated transport layer for ROS 2 that:

- Eliminates CPU-GPU memory copies between consecutive Isaac ROS nodes
- Uses CUDA shared memory for inter-node data transfer
- Provides 2-5x throughput improvement over standard ROS 2 message passing

### 11.3 Isaac Perceptor

A reference workflow combining multiple Isaac ROS packages for autonomous navigation:

- Multi-camera 3D detection
- Visual SLAM with loop closure
- Real-time 3D reconstruction (nvblox)
- Obstacle avoidance and path planning

Current release: Isaac ROS 4.2 (as of early 2026), supporting ROS 2 Humble and Jazzy.

---

## 12. Thermal Management

### 12.1 Thermal Specifications

| Parameter | Value |
|-----------|-------|
| SoC Junction Temperature (Tj max) | 105 C |
| Thermal Trip (hardware reset) | 105 C |
| Recommended Operating Tj | < 95 C for sustained operation |
| Module TDP (MAXN, 64GB) | ~60W |
| Module TDP (MAXN, 32GB) | ~40W |
| Industrial Variant TDP | Up to 75W |

### 12.2 Cooling Solution Design

#### Active Cooling (Recommended for AV)

Active fanned heatsinks are recommended for AV deployment due to:

- Sustained high-power operation under MAXN or 50W modes
- Enclosed vehicle cabin thermal environments
- Ambient temperature variability in outdoor AV operations

NVIDIA's reference design uses a top-mounted heatsink with embedded fan, connected to the module via thermal interface material (TIM). Dynamic fan control adjusts speed based on SoC temperature thresholds configured in the thermal management configuration file.

#### Passive Cooling

Passive heatsinks (aluminum fin arrays, natural convection) are viable only for:

- Lower power modes (15W-30W)
- Open-air or well-ventilated enclosures
- Low ambient temperature environments

#### Design Guidelines

- **Mounting:** Heatsink should mount directly to carrier board for structural support and load relief on the SoM connector
- **Thermal gap pads:** Embedded between module components and heatsink for maximum heat transmission
- **Contact pressure:** Uniform contact to the Orin SoC die is critical; uneven pressure causes hotspots
- **Airflow:** For active solutions, ensure intake/exhaust paths are not obstructed by enclosure geometry

### 12.3 Thermal Throttling Behavior

The Orin implements progressive thermal management:

1. **Software throttling:** As Tj approaches warning threshold, `nvpmodel` dynamically reduces GPU/CPU clocks
2. **Hardware thermal trip:** At 105 C, hardware forces system reset to prevent damage
3. **Fan ramp-up:** Dynamic fan control increases speed proportionally with temperature rise

For AV systems, maintaining stable thermal performance is critical. Design the cooling solution to keep Tj below 90 C under sustained maximum load to avoid clock throttling that impacts inference latency consistency.

---

## 13. I/O and Peripheral Interfaces

### 13.1 High-Speed Interfaces

| Interface | Specification |
|-----------|--------------|
| PCIe | 7 controllers, 22 lanes total, Gen 4 (16 Gbps/lane) |
| Ethernet | 1x GbE + 4x XFI (10GbE) |
| USB | USB 3.2 Gen 2 (10 Gbps) |
| NVMe Storage | Via PCIe Gen 4 x4 |
| Display | DisplayPort 1.4a |

### 13.2 Camera and Sensor Interfaces

| Interface | Specification |
|-----------|--------------|
| MIPI CSI-2 | 16 lanes total |
| CSI Configuration | Up to 6x 2-lane or 4x 4-lane |
| D-PHY | v2.1 (up to 4.5 Gbps/lane, 40 Gbps aggregate) |
| C-PHY | v2.0 (up to 164 Gbps aggregate) |
| Camera Support | Up to 6 cameras simultaneously |

### 13.3 Video Encode/Decode (64GB Variant)

| Capability | Specification |
|------------|--------------|
| **Encode** | 2x 4K60, 4x 4K30, 8x 1080p60, 16x 1080p30 (H.265/H.264/AV1) |
| **Decode** | 1x 8K30, 3x 4K60, 7x 4K30, 11x 1080p60, 22x 1080p30 (H.265/H.264/VP9/AV1) |

### 13.4 Low-Speed Interfaces

| Interface | Count |
|-----------|-------|
| UART | 4 |
| SPI | 3 |
| I2C | 8 |
| CAN (FD-capable) | 2 |
| GPIO | Multiple |
| I2S/TDM Audio | 4x DAP ports |
| DMIC | 2x PDM |

### 13.5 AV-Relevant I/O Notes

- **CAN FD:** Two CAN interfaces (LS and FD) for vehicle bus communication; sufficient for basic CAN integration but may need external CAN controllers for multi-bus AV architectures
- **PCIe Gen 4:** 22 lanes enable connection of NVMe storage, additional Ethernet NICs, FPGA co-processors, or LiDAR interface cards
- **10GbE via XFI:** Four 10GbE interfaces support high-bandwidth sensor data ingestion (e.g., multiple LiDAR units, high-res cameras over Ethernet)
- **CSI cameras:** Direct MIPI CSI connection for up to 6 cameras eliminates USB/Ethernet camera latency

---

## 14. Real-World Inference Benchmarks

### 14.1 MLPerf v3.1 Official Benchmarks (Jetson AGX Orin 64GB)

Tested with JetPack 5.1.1, TensorRT 8.5.2, CUDA 11.4:

| Model | Task | Single-Stream Latency | Offline Throughput | Power |
|-------|------|-----------------------|--------------------|-------|
| ResNet-50 | Image Classification | 0.64 ms | 6,424 samples/s | 23.6W |
| RetinaNet | Object Detection | 11.67 ms | 149 samples/s | 22.3W |
| BERT-Large | NLP (SQuAD) | 5.71 ms | 554 samples/s | — |
| RNN-T | Speech-to-Text | 94.01 ms | 1,170 samples/s | — |
| 3D-UNet | Medical Imaging | 4,371 ms | 0.51 samples/s | — |

### 14.2 3D LiDAR Object Detection Benchmarks

#### PointPillars (TensorRT, Jetson AGX Orin)

| Precision | Latency (ms) | FPS | mAP (KITTI) |
|-----------|-------------|-----|-------------|
| FP32 | 32.91 | ~30 | 64.64 |
| FP16 | 18.27 | ~55 | ~64.5 |
| INT8 | 14.77 | ~68 | ~63.8 |
| Mixed (FP16:1) | 14.29 | ~70 | 64.47 (QAT) |

Source: Mixed Precision PointPillars (arXiv:2601.12638), TensorRT 10.3

From the MDPI Sensors benchmark study (full pipeline, not TensorRT-optimized for all models):

| Detector | FPS (AGX Orin) | GPU Util | CPU Util | Power |
|----------|----------------|----------|----------|-------|
| PointPillar | 9.7 | ~80% | >60% | ~29W |
| SECOND | 5.21 | — | — | — |
| CIA-SSD | 5.79 | — | — | — |
| SE-SSD | 5.82 | — | — | — |
| PointRCNN | 1.98 | — | — | — |
| Part-A2 | 2.54 | — | — | — |
| PV-RCNN | 2.27 | — | — | — |
| FastPillars | 18 | — | — | — |

#### CenterPoint (NVIDIA CUDA-CenterPoint, TensorRT, AGX Orin)

| Pipeline Stage | Latency (ms) FP16 | Latency (ms) INT8 |
|----------------|--------------------|--------------------|
| Voxelization | 1.36 | 1.36 |
| 3D Backbone (Sparse Conv) | 22.3 | 22.3 |
| RPN + Detection Head | 11.3 | 7.0 |
| Decode + NMS | 4.4 | 4.4 |
| **Total** | **~40.0** | **~35.7** |

Effective throughput: ~23-28 FPS. The 3D sparse convolution backbone is the primary bottleneck, consuming ~56% of total latency.

Cross-platform comparison (CenterPoint total latency):

| Platform | FP16 Total | Mixed Total |
|----------|------------|-------------|
| Tesla A30 (data center) | 21.3 ms | 20.0 ms |
| Jetson AGX Orin | 40.0 ms | 35.7 ms |

#### BEVFusion (NVIDIA CUDA-BEVFusion, TensorRT, AGX Orin)

Tested on nuScenes validation set (6019 samples):

| Configuration | FPS (AGX Orin) | mAP | NDS |
|---------------|----------------|-----|-----|
| ResNet50, FP16 | 18 | 67.89 | 70.98 |
| ResNet50, FP16+INT8 (PTQ) | 25 | 67.66 | 70.81 |

For reference, Swin-Tiny BEVFusion on RTX 3090 (PyTorch FP32+FP16): 8.4 FPS, 68.52 mAP.

The number of LiDAR points per frame is the dominant factor affecting BEVFusion FPS. A lighter camera backbone (e.g., ResNet34 instead of ResNet50) reduces latency with minimal accuracy impact.

### 14.3 YOLOv8 2D Detection Benchmarks (TensorRT, AGX Orin)

| Model | FP32 Latency | FP32 FPS | INT8 Latency | INT8 FPS |
|-------|-------------|----------|-------------|----------|
| YOLOv8n | ~2.0 ms | ~500 | ~1.2 ms | ~830 |
| YOLOv8s | 7.2 ms | 139 | 3.2 ms | 313 |
| YOLOv8m | ~12 ms | ~83 | ~6 ms | ~167 |
| YOLOv8l | ~18 ms | ~56 | ~10 ms | ~100 |
| YOLOv8x | ~25 ms | ~40 | ~13 ms | ~75 |

Note: YOLOv8 shows +4 to +9 mAP improvement over YOLOv5 at similar runtime on AGX Orin with TensorRT FP16.

### 14.4 NVIDIA DRIVE AV Reference

The NVIDIA DRIVE AV perception pipeline achieved a **2.5x latency reduction** by leveraging DLA for suitable network components, demonstrating the importance of GPU+DLA co-scheduling in production AV stacks.

---

## 15. Industrial Variant Specifications

The Jetson AGX Orin Industrial is designed for harsh-environment deployment including outdoor autonomous vehicles, agriculture, construction, aerospace, and energy applications.

### 15.1 Key Differences from Standard Module

| Parameter | AGX Orin 64GB (Standard) | AGX Orin Industrial |
|-----------|--------------------------|---------------------|
| AI Performance | 275 TOPS | 248 TOPS |
| Power Range | 15-60W | 15-75W |
| Memory | 64 GB LPDDR5 | 64 GB LPDDR5 + Inline ECC |
| Operating Temp (TTP) | -25 C to +80 C | -40 C to +85 C |
| Operational Shock | — | 50G, 11 ms |
| Non-Operational Shock | 140G, 2 ms | 140G, 2 ms |
| Operational Vibration | — | 5G |
| Non-Operational Vibration | 3G | 3G |
| Humidity Tolerance | — | 85 C / 85% RH, 1000 hrs powered |
| Operating Lifetime | — | 10 years; 87,000 hrs @ 85 C |
| Production Lifecycle | — | 10 years (through 2033) |
| Mechanical Protection | Standard | SoC corner bonding + component underfill |

### 15.2 ECC Memory

The Industrial variant includes **inline ECC** on its LPDDR5 memory, which:

- Detects and corrects single-bit errors
- Detects double-bit errors
- Reduces effective memory capacity by ~12.5% (ECC overhead)
- Critical for safety-relevant AV compute where memory bit-flips could cause perception errors

### 15.3 TOPS Reduction Explanation

The Industrial variant's 248 TOPS (vs. 275 TOPS standard) results from slightly reduced clock frequencies to maintain reliability across the extended -40 C to +85 C temperature range. The 75W maximum power budget compensates with additional thermal headroom.

### 15.4 AV Deployment Recommendation

For production AV deployment, the Industrial variant is strongly recommended due to:

- Extended temperature range covering outdoor operational extremes
- ECC memory protecting against radiation-induced bit-flips
- Vibration and shock ratings appropriate for vehicle-mounted compute
- 10-year production lifecycle providing supply chain stability
- Component underfill preventing solder joint failures under vibration

---

## 16. Competitive Landscape

### 16.1 Edge AI Compute Comparison

| Platform | AI Performance | Power | Architecture | Target Application |
|----------|---------------|-------|-------------|-------------------|
| **NVIDIA Jetson AGX Orin 64GB** | 275 TOPS (INT8 Sparse) | 15-60W | Ampere GPU + DLA | Robotics, AV (non-automotive) |
| **NVIDIA DRIVE Orin** | 254 TOPS | — | Same SoC, automotive grade | L2-L4 automotive (ASIL-D) |
| **Qualcomm Snapdragon Ride Elite** | 300 TOPS | — | Kryo CPU + Adreno GPU | L3 automotive ADAS |
| **Qualcomm Snapdragon Ride Flex** | 10-1000 TOPS (scalable) | — | Kryo + Adreno | L1-L4 scalable |
| **TI TDA4VM** | 8 TOPS | 5-20W | C7x DSP + MMA | L2-L3 ADAS (camera+radar) |
| **Hailo-8** | 26 TOPS | 2.5W | Dataflow architecture | Inference-only accelerator |
| **Hailo-8L** | 13 TOPS | ~1.5W | Dataflow architecture | Low-power inference |
| **Intel Movidius Myriad X** | 4 TOPS | ~1.5W | VPU | Low-power vision |
| **Qualcomm RB5** | 15 TOPS | ~15W | AI Engine + Hexagon DSP | Robotics |

### 16.2 Comparative Analysis for AV

**NVIDIA Jetson AGX Orin Strengths:**

- Highest single-module TOPS in the Jetson class
- Full CUDA ecosystem (TensorRT, cuDNN, CUDA kernels) for custom model development
- Unified memory architecture eliminates host-device transfers
- DLA + GPU heterogeneous compute for power-efficient inference
- Comprehensive software stack (JetPack, Isaac ROS, DeepStream)
- Active developer community and extensive documentation

**NVIDIA Jetson AGX Orin Weaknesses:**

- Not automotive-safety certified (no ASIL-D; use DRIVE Orin for that)
- Higher power consumption than specialized accelerators (Hailo, TDA4)
- 8nm process vs. competitors on 4-5nm nodes
- TOPS/watt lower than dedicated inference accelerators

**Hailo-8 as Complementary Accelerator:**

Hailo-8 modules (M.2 form factor) can be paired with Jetson AGX Orin via PCIe to add dedicated inference capacity for specific perception models, freeing the GPU for complex models like BEVFusion while Hailo handles simpler 2D detection tasks.

### 16.3 Market Position

NVIDIA holds an estimated 25-35% global share in autonomous driving compute (H1 2025). Qualcomm Snapdragon Ride is emerging in L2+ ADAS with ~5% share. TI TDA4 dominates the lower-TOPS L2 camera/radar ADAS segment.

---

## 17. Jetson AGX Orin vs DRIVE Orin

Both use the same Orin SoC, but target different markets:

| Aspect | Jetson AGX Orin | DRIVE Orin |
|--------|----------------|------------|
| Target Market | Robotics, industrial, non-automotive AV | Automotive L2-L5 |
| Safety Certification | None (no ASIL) | ISO 26262 ASIL-D systematic, ASIL-B random |
| Operating System | Jetson Linux (Ubuntu-based) | DriveOS (safety-certified RTOS) |
| Software Stack | JetPack, Isaac ROS | DRIVE SDK, DriveWorks |
| Functional Safety | Not designed for safety-critical | Hardware lockstep, safety island, ECC |
| Availability | Module + dev kit, broad distribution | Automotive Tier-1 channel |
| Pricing | $999 (32GB module) | OEM/Tier-1 pricing |

**For airport airside AV operations:** Jetson AGX Orin (Industrial) is appropriate because:

- Airport airside is a controlled, geo-fenced environment with lower speed requirements
- ASIL-D certification is typically not required for non-road autonomous vehicles
- The JetPack/Isaac ROS software ecosystem provides faster development iteration
- The Industrial variant's temperature/vibration ratings meet outdoor vehicle requirements

---

## 18. Successor: Jetson Thor

Jetson AGX Thor, powered by NVIDIA Blackwell architecture, became generally available in August 2025.

| Specification | AGX Orin 64GB | AGX Thor |
|---------------|---------------|----------|
| GPU Architecture | Ampere | Blackwell |
| AI Performance | 275 TOPS | 2,070 FP4 TFLOPS |
| AI Improvement | Baseline | 7.5x over Orin |
| Energy Efficiency | Baseline | 3.5x better than Orin |
| Memory | 64 GB | 128 GB |
| Power Range | 15-60W | 40-130W |
| Dev Kit Price | $1,999 | $3,499 |

Thor is positioned for next-generation physical AI and foundation model inference at the edge. For AV stacks requiring transformer-based models (BEVFormer, UniAD, end-to-end driving models), Thor's increased memory and compute may be necessary.

However, AGX Orin remains the production-proven platform with broader ecosystem maturity and lower power requirements, making it suitable for AV deployments where the perception stack fits within 275 TOPS.

---

## 19. Pricing and Availability

| Product | Price (USD) | Status |
|---------|-------------|--------|
| Jetson AGX Orin 32GB Module | $999 | Production |
| Jetson AGX Orin 64GB Module | ~$1,599 | Production |
| Jetson AGX Orin 64GB Dev Kit | $1,999 | Production |
| Jetson AGX Orin Industrial Module | Contact NVIDIA | Production (through 2033) |

Modules are available through NVIDIA's authorized distribution network (Arrow, Mouser, DigiKey) and ecosystem partners (Connect Tech, Seeed Studio, etc.). Carrier boards from third-party vendors (Connect Tech, Stereolabs, etc.) provide ruggedized and application-specific form factors.

---

## 20. AV Deployment Considerations

### 20.1 Perception Stack Sizing

For a typical airport airside AV with 6 cameras + 1 LiDAR + 3 radars:

| Pipeline Stage | Model | Estimated Latency (AGX Orin) | Accelerator |
|----------------|-------|------------------------------|-------------|
| Camera 2D Detection | YOLOv8s (INT8) | ~3.2 ms | GPU |
| LiDAR 3D Detection | CenterPoint (INT8) | ~35 ms | GPU |
| Camera-LiDAR Fusion | BEVFusion (FP16+INT8) | ~40 ms | GPU |
| Freespace Segmentation | Custom UNet (INT8) | ~5 ms | DLA |
| Tracking | Kalman/ByteTrack | ~1 ms | CPU |
| Planning | Custom planner | ~10 ms | CPU |
| **Total Pipeline** | | **~50-80 ms (target)** | |

The 64GB variant is recommended to accommodate BEVFusion's memory requirements and allow headroom for mapping/localization workloads.

### 20.2 Recommended Configuration

- **Module:** Jetson AGX Orin Industrial (64GB, ECC)
- **Power Mode:** 50W for production, MAXN for development
- **Cooling:** Active heatsink with ducted airflow, rated for +50 C ambient
- **Storage:** NVMe SSD via PCIe Gen 4 x4 for data logging
- **Networking:** 10GbE for LiDAR data ingestion; GbE for vehicle CAN gateway
- **Software:** JetPack 6.2+, TensorRT 10.3, Isaac ROS for perception, custom ROS 2 nodes for planning/control

### 20.3 Key Risk Factors

1. **Memory bandwidth saturation:** Multi-camera BEVFusion can saturate the 204.8 GB/s bandwidth; profile with `nsys` and `tegrastats`
2. **Thermal derating:** In enclosed vehicle compute boxes, sustained thermal loads may trigger clock throttling; validate cooling under worst-case ambient
3. **DLA coverage gaps:** Transformer-based models (attention layers) cannot run on DLA; future perception architectures trending toward transformers may underutilize DLA
4. **Supply chain:** Plan for the Industrial variant's 10-year lifecycle; coordinate with NVIDIA for volume commitments
5. **No functional safety certification:** For operations requiring safety certification, a separate safety controller (e.g., TI TDA4 or dedicated safety MCU) may be needed alongside the Orin for monitoring and fallback

---

## Sources

- [NVIDIA Jetson AGX Orin Technical Brief v1.2 (PDF)](https://www.nvidia.com/content/dam/en-zz/Solutions/gtcf21/jetson-orin/nvidia-jetson-agx-orin-technical-brief.pdf)
- [NVIDIA Jetson AGX Orin Product Page](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/)
- [Jetson AGX Orin Power Modes - Jetson Linux Developer Guide](https://docs.nvidia.com/jetson/archives/r35.1/DeveloperGuide/text/SD/PlatformPowerAndPerformance/JetsonOrinNxSeriesAndJetsonAgxOrinSeries.html)
- [Maximizing Deep Learning Performance on NVIDIA Jetson Orin with DLA - NVIDIA Technical Blog](https://developer.nvidia.com/blog/maximizing-deep-learning-performance-on-nvidia-jetson-orin-with-dla/)
- [Working with DLA - NVIDIA TensorRT Documentation](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-dla.html)
- [Jetson AGX Orin TOPS / CUDA Cores Explained - NVIDIA Developer Forums](https://forums.developer.nvidia.com/t/jetson-agx-orin-tops-cuda-cores-explained/252426)
- [JetPack SDK 6.2 - NVIDIA Developer](https://developer.nvidia.com/embedded/jetpack-sdk-62)
- [NVIDIA Isaac ROS Documentation](https://nvidia-isaac-ros.github.io/)
- [Jetson AGX Orin Industrial - NVIDIA Technical Blog](https://developer.nvidia.com/blog/step-into-the-future-of-industrial-grade-edge-ai-with-nvidia-jetson-agx-orin-industrial)
- [NVIDIA Jetson Benchmarks (MLPerf)](https://developer.nvidia.com/embedded/jetson-benchmarks)
- [Run Your 3D Object Detector on NVIDIA Jetson Platforms: A Benchmark Analysis - MDPI Sensors](https://www.mdpi.com/1424-8220/23/8/4005)
- [NVIDIA CUDA-BEVFusion (GitHub)](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution/tree/master/CUDA-BEVFusion)
- [NVIDIA CUDA-CenterPoint (GitHub)](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution/blob/master/CUDA-CenterPoint/README.md)
- [Mixed Precision PointPillars for Efficient 3D Object Detection with TensorRT (arXiv:2601.12638)](https://arxiv.org/html/2601.12638)
- [Profiling Concurrent Vision Inference on NVIDIA Jetson (arXiv:2508.08430)](https://arxiv.org/html/2508.08430v1)
- [NVIDIA Jetson AGX Orin Series Thermal Design Guide](https://www.mouser.com/pdfDocs/Jetson_AGX_Orin_Series_TDG-10943-001_v11.pdf)
- [GPU Isolation and MPS - NVIDIA Developer Forums](https://forums.developer.nvidia.com/t/gpu-isolation-and-mps/352452)
- [NVIDIA Jetson Thor Announcement](https://nvidianews.nvidia.com/news/nvidia-blackwell-powered-jetson-thor-now-available-accelerating-the-age-of-general-robotics)
- [Jetson Product Lifecycle - NVIDIA Developer](https://developer.nvidia.com/embedded/lifecycle)
- [Comparing SoCs for Automotive ADAS - Medium](https://medium.com/@hemanthchakravarthy/comparing-the-titans-a-technical-deep-dive-into-socs-for-automotive-adas-and-automated-driving-68955f9a2c73)
- [Edge AI Hardware Comparison - Hailo vs NVIDIA Jetson Orin](https://www.peila-international.com/blog/hailo-vs-nvidia-jetson-orin-which-edge-ai-solution-fits-your-project)
- [NVIDIA DRIVE Orin Safety Milestones](https://blogs.nvidia.com/blog/nvidia-drive-safety-milestones/)
- [NVIDIA Jetson DLA Tutorial (GitHub)](https://github.com/NVIDIA-AI-IOT/jetson_dla_tutorial)
