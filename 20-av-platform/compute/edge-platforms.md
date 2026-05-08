# Compute Hardware, Model Optimization & Deployment Infrastructure for World Models on Autonomous Vehicles

**Comprehensive Technical Report -- March 2026**

---

## Table of Contents

1. [Edge Compute Platforms for AV](#1-edge-compute-platforms-for-av)
2. [Model Optimization for Edge Deployment](#2-model-optimization-for-edge-deployment)
3. [Running Large Models On-Vehicle](#3-running-large-models-on-vehicle)
4. [Infrastructure](#4-infrastructure)
5. [Airside-Specific Deployment](#5-airside-specific-deployment)

---

## 1. Edge Compute Platforms for AV

### 1.1 NVIDIA DRIVE AGX Family

#### DRIVE AGX Orin (Current Generation -- In Production)

| Specification | Value |
|---|---|
| AI Performance | 254 TOPS (single SoC); stackable to ~1,000 TOPS (4x) |
| GPU Architecture | Ampere |
| CPU | Arm Cortex-A78AE |
| Process Node | 7nm Samsung |
| Power Envelope | 15--60W configurable (Jetson variant); ~45W typical automotive |
| Memory | Up to 64 GB LPDDR5 |
| Peak Performance | 275 TOPS (Jetson AGX Orin 64GB variant) |
| Module Price | ~$399 (32GB) to ~$1,599 (64GB production module) |

DRIVE Orin is the current workhorse for L2+ through L4 development. It supports multi-sensor fusion (cameras, LiDAR, radar, ultrasonic) and runs the full NVIDIA DRIVE software stack including DriveWorks, DRIVE OS, and DRIVE AV. Its configurability from 15W to 60W makes it suitable for both low-power ADAS and high-performance autonomous driving applications.

#### DRIVE AGX Thor (Next Generation -- Entering Production 2025-2026)

| Specification | Value |
|---|---|
| AI Performance | 1,000 TOPS sparse INT8 / 1,000 sparse FP8 TFLOPS (single SoC) |
| Dual-Chip Config | ~2,000 TOPS via NVLink-C2C |
| GPU Architecture | Blackwell (2,560 CUDA cores, 96 5th-gen Tensor Cores) |
| CPU | 14-core Arm Neoverse V3AE |
| Process Node | 4nm TSMC |
| Power Envelope | ~130W (confirmed for Jetson AGX Thor variant) |
| Memory | Up to 128 GB LPDDR5X |
| FP8 Support | Native via on-chip Transformer Engine |
| Safety | ASIL-D with virtualization |

Thor represents an ~8x leap over Orin in AI performance. It is designed as a centralized vehicle computer unifying autonomous driving, ADAS, cockpit, infotainment, and parking into a single architecture. The on-chip Transformer Engine with native FP8 support is particularly significant for running transformer-based world models. The first production vehicle (Lynk & Co 900) has shipped with Thor, and partners including Zeekr, BYD, and others plan 2025-2026 integration.

**Key advantage for world models:** Thor's Transformer Engine with FP8 precision and 128GB memory headroom make it the first automotive SoC that can plausibly run mid-scale world models (~1B parameters) in real time.

---

### 1.2 NVIDIA Jetson AGX Series

The Jetson line is the development/robotics counterpart to the DRIVE automotive line, sharing the same SoC architectures:

| Module | TOPS | Power | Memory | Price |
|---|---|---|---|---|
| Jetson Orin Nano | 67 | 7--25W | 8 GB | ~$249 (dev kit) |
| Jetson AGX Orin 32GB | 200 | 15--40W | 32 GB | ~$399 (module) |
| Jetson AGX Orin 64GB | 275 | 15--60W | 64 GB | ~$1,599 (module) |
| Jetson AGX Thor | 2,070 FP4 TFLOPS | ~130W | 128 GB | TBD (2026) |

Jetson modules are relevant for non-automotive-certified applications such as airport ground vehicles, warehouse robots, and prototype fleets where automotive-grade (AEC-Q100) certification is not required. They offer the same silicon at lower cost and with broader software ecosystem access.

---

### 1.3 Qualcomm Snapdragon Ride

| Specification | Value |
|---|---|
| Peak AI (single chip) | Up to 640 TOPS (QAM8797P Ultimate Edition) |
| Dual-Chip Config | Up to 1,280 TOPS |
| Architecture | Kryo Gen-6 CPU, Adreno 663 GPU, Hexagon Tensor Processor (HVX + HMX) |
| Process Node | 5nm |
| Safety | ASIL-D with integrated safety island |
| Key Feature | Mixed-criticality: ADAS + cockpit on single SoC |

Snapdragon Ride Flex is the industry's first commercialized mixed-criticality platform integrating cockpit and ADAS on a single chip. Over 20 ADAS/AD projects worldwide are planned for 2025-2026 launch, with automakers including BMW (2026 MY), GM, Ford, Volkswagen, Mercedes-Benz, Honda, Leapmotor, FAW, Geely, and Chery.

**Strengths:** Cost efficiency through domain consolidation, broad OEM adoption, strong Qualcomm AI toolchain.
**Limitations:** Less raw single-chip AI performance than Thor; more suited to L2+/L3 than full L4/L5.

---

### 1.4 Mobileye EyeQ Family

| Chip | TOPS (INT8) | Target | Power | Status |
|---|---|---|---|---|
| EyeQ6 Lite (EyeQ6L) | ~16 | L1-L2 ADAS | Very low (~3-5W est.) | In production |
| EyeQ6 High (EyeQ6H) | ~34 | L2+ to L3 | ~25% more than EyeQ5H | Launched 2025 |
| EyeQ Ultra | ~176 | L4 consumer AV | TBD | Planned |

EyeQ6L is designed as a one-box windshield solution with 4.5x more computing power than EyeQ4M at half the physical space. EyeQ6H provides 3x the compute of EyeQ5H with only 25% more power.

**Strengths:** Extremely power-efficient, proven at scale (100M+ chips shipped historically), strong perception algorithms built in.
**Limitations:** Closed ecosystem, limited flexibility for custom world model deployment, lower absolute TOPS compared to NVIDIA/Qualcomm.

---

### 1.5 Tesla FSD Chips

| Chip | TOPS | Process | CPU | Memory | Storage | Power (est.) | Status |
|---|---|---|---|---|---|---|---|
| HW3 (FSD Chip) | 144 | 14nm Samsung | 12x Cortex-A72 @ 2.6 GHz | 16 GB | 256 GB | ~72W | Legacy |
| HW4 (FSD Computer 2) | ~500-720 | 7nm Samsung | 20 cores @ 2.35 GHz | 32 GB | 512 GB | ~160W | All 2023+ vehicles |
| HW4.5 | ~1,150 (est. 8x HW3) | Improved 7nm | Enhanced | 32+ GB | 512+ GB | TBD | Late 2025/2026 |
| HW5 / AI5 | 2,000-5,000 (est.) | 5nm or below | TBD | TBD | TBD | TBD | 2027 (Robotaxi) |

Tesla's approach is unique: vertically integrated custom silicon designed specifically for their vision-only FSD pipeline. HW4 includes dual redundant compute nodes for safety failover and supports 11 cameras (upgraded to 5MP from 1.2MP). HW4.5 is the hardware Tesla believes will achieve SAE Level 4 autonomy.

**Strengths:** Massive fleet data advantage (millions of vehicles), co-designed hardware + software, vision-only simplicity.
**Limitations:** Not commercially available to third parties, tightly coupled to Tesla's neural network architecture.

---

### 1.6 Ambarella CV3

| Specification | Value |
|---|---|
| AI Performance | Up to 500 eTOPS |
| CPU | Up to 16x Arm Cortex-A78AE |
| Process Node | 5nm Samsung |
| Target | L2+ through L4 |
| Key Advantage | Industry-leading AI performance per watt |

The CV3-AD family includes the flagship CV3-AD685 (L3/L4), CV3-AD635 and CV3-AD655 (L2+). Ambarella emphasizes single-chip processing for multi-sensor perception including vision, radar, and ultrasonic fusion with path planning.

**Strengths:** Excellent power efficiency, single-chip full-stack solution, strong ISP for camera processing.
**Limitations:** Smaller software ecosystem than NVIDIA, fewer third-party integrations.

---

### 1.7 AMD Xilinx Versal AI Edge

| Specification | Value |
|---|---|
| AI Performance | Up to 479 TOPS (INT4) at 75W; up to 171 TOPS at lower power |
| Low-Power Mode | 14 TOPS (INT4) at 6W |
| Architecture | FPGA + AI Engine + Arm CPU (adaptive SoC) |
| Automotive Variant | Versal AI Edge "XA" (automotive-grade) |
| Gen 2 (2025) | 3x higher TOPS/watt, 10x more scalar compute |

Subaru has chosen Versal AI Edge Gen 2 for its next-generation EyeSight ADAS. The FPGA-based architecture provides unique flexibility for custom sensor fusion pipelines and real-time signal processing.

**Strengths:** Unmatched flexibility (FPGA reconfigurability), excellent for sensor fusion and custom pipelines, strong power efficiency.
**Limitations:** Higher development complexity, less mature AI software stack compared to GPU-based solutions.

---

### 1.8 Texas Instruments TDA4x / TDA5

| Chip | TOPS | Power Efficiency | Target |
|---|---|---|---|
| TDA4VM | 8 | High | L1-L2 ADAS |
| TDA4VH-Q1 | 32 | High | L2+ ADAS |
| TDA5 (2026) | 10-1,200 | 24 TOPS/W | Up to L3 |

TI's approach emphasizes extreme power efficiency and cost-effectiveness. The TDA4x achieves 60%+ higher deep-learning performance per watt compared to leading GPU architectures. The new TDA5 family (announced January 2026) scales from 10 to 1,200 TOPS while maintaining 24 TOPS/W efficiency.

**Strengths:** Best-in-class power efficiency, very low BOM cost, proven automotive reliability, scalable family.
**Limitations:** Lower absolute TOPS for high-end autonomy, less suited for large model inference.

---

### 1.9 Comprehensive Platform Comparison

| Platform | Peak TOPS | Power (W) | TOPS/W | Process | Memory | Target Level | Est. Cost |
|---|---|---|---|---|---|---|---|
| **NVIDIA Thor** | 2,000 (dual) | ~130 | ~15.4 | 4nm | 128 GB | L2-L5 | High ($$$) |
| **Tesla HW4** | ~720 | ~160 | ~4.5 | 7nm | 32 GB | L2-L4 | N/A (captive) |
| **Qualcomm Ride Ultimate** | 1,280 (dual) | TBD | TBD | 5nm | Config. | L2-L4 | Medium ($$) |
| **Ambarella CV3-AD685** | 500 | Low | Very high | 5nm | Config. | L2-L4 | Medium ($$) |
| **AMD Versal XA Gen2** | 479 | 75 | ~6.4 | 7nm+ | Config. | L2-L4 | Medium ($$) |
| **TI TDA5 (max)** | 1,200 | ~50 (est.) | ~24 | Advanced | Config. | L2-L3 | Low ($) |
| **NVIDIA Orin** | 275 | 60 | ~4.6 | 7nm | 64 GB | L2-L4 | ~$1,600 |
| **Mobileye EyeQ6H** | 34 | ~15 (est.) | ~2.3 | 7nm | Fixed | L2-L3 | Low ($) |
| **Mobileye EyeQ6L** | 16 | ~5 (est.) | ~3.2 | 7nm | Fixed | L1-L2 | Very low |
| **TI TDA4VH** | 32 | ~15 (est.) | ~2.1 | 16nm | Fixed | L2+ | Very low |

---

## 2. Model Optimization for Edge Deployment

### 2.1 Quantization

Quantization is the single most impactful optimization for deploying world models on edge hardware. It reduces model size, memory bandwidth requirements, and compute latency simultaneously.

#### Precision Formats and Trade-offs

| Format | Bits | Memory Reduction vs FP32 | Typical Accuracy Loss | Hardware Support |
|---|---|---|---|---|
| FP32 | 32 | Baseline | None | Universal |
| FP16 | 16 | 2x | <0.5% | All modern GPUs |
| BF16 | 16 | 2x | <0.5% | Ampere+, Thor |
| FP8 (E4M3/E5M2) | 8 | 4x | 0.5-2% | Thor (native), Blackwell |
| INT8 | 8 | 4x | 1-3% | Orin, Thor, all modern |
| INT4 | 4 | 8x | 2-5% | Thor, Versal, limited |
| FP4 | 4 | 8x | 3-7% | Thor (2,070 FP4 TFLOPS) |

#### Quantization Approaches

**Post-Training Quantization (PTQ):** Most practical for edge deployment. Eliminates retraining. Selective INT8/FP8 PTQ has been demonstrated to reduce inference latency for multi-camera 3D detection models while maintaining competitive accuracy. PTQ is favored for edge deployment because of its simplicity and efficiency.

**Quantization-Aware Training (QAT):** Simulates quantization during training for better accuracy at low bit-widths. Essential when pushing to INT4/FP4 where PTQ accuracy losses become unacceptable. Adds 10-30% to training time but can recover 1-2% accuracy over PTQ.

**Key Results (2025-2026):**
- YOLO26 retains nearly identical mAP when exported to INT8, enabling deployment on Jetson Orin and Qualcomm Snapdragon AI accelerators with minimal accuracy impact.
- FP8 quantization on Thor's Transformer Engine achieves near-FP16 accuracy for transformer-based perception models with 2x throughput improvement.
- Vision transformers quantized to INT8 via TensorRT show 2-3x speedup on Orin with <1% mAP loss for object detection tasks.

---

### 2.2 Knowledge Distillation

Knowledge distillation trains compact "student" networks to emulate larger "teacher" models. For autonomous driving:

- **Compression ratios:** Student networks with 5-8x fewer parameters achieve accuracy within 2-3% of their teacher counterparts on perception tasks.
- **Multi-task distillation:** Recent research (2025) combines task-aware safe pruning with feature-level knowledge distillation, achieving 32.7% parameter reduction while maintaining competitive accuracy across perception, prediction, and planning.
- **Practical pipeline:** Train a large world model on GPU clusters -> distill to a compact model -> quantize -> deploy on edge.

**Application to world models:** A 7B-parameter world model teacher can be distilled to a 1-2B student model, then quantized to INT8, fitting within the memory and compute constraints of Thor (128 GB, 1,000 TOPS).

---

### 2.3 Pruning and Sparsity

Pruning removes unimportant parameters from trained models:

- **Structured pruning:** Removes entire channels, attention heads, or layers. Directly translates to faster inference without specialized sparse hardware.
- **Unstructured pruning:** Removes individual weights. Achieves higher compression but requires hardware support for sparse computation (Thor's Tensor Cores support structured sparsity natively with 2:4 patterns).
- **Results:** 40-60% of weights can typically be pruned with <1% accuracy loss. For autonomous driving perception models, saliency-aware pruning preserves detection accuracy for critical objects (pedestrians, vehicles) while aggressively pruning less safety-critical features.

**NVIDIA TensorRT Model Optimizer** combines pruning and distillation in a single pipeline: prune a large model to remove redundant parameters, then distill from the original to recover accuracy, achieving 2-4x compression with minimal accuracy impact.

---

### 2.4 Inference Runtimes

#### TensorRT (NVIDIA)

The gold standard for NVIDIA hardware deployment. Supports FP32, FP16, FP8, INT8, INT4, FP4 precision. Applies graph optimizations (layer fusion, kernel auto-tuning, dynamic tensor memory) that are critical for meeting automotive latency budgets. Essential for deploying on Orin and Thor.

#### ONNX Runtime

Hardware-agnostic inference engine with Execution Provider framework supporting:
- NVIDIA GPUs (CUDA and TensorRT EPs)
- Intel Hardware (OpenVINO and oneDNN EPs)
- AMD GPUs (ROCm and MIGraphX EPs)
- Qualcomm SoCs (QNN EP)
- Mobile/Edge SoCs (NNAPI, CoreML)

Graph optimizations (node fusion, constant folding) significantly reduce inference latency. Best choice when targeting heterogeneous hardware or multi-vendor fleets.

#### OpenVINO (Intel)

Optimized for Intel CPUs, GPUs, and NPUs. Supports inference on x86 and ARM CPUs. Converting models to OpenVINO IR format offers best results for Intel-based deployments, minimizing first-inference latency. Can be used as an ONNX Runtime backend via the OpenVINO Execution Provider.

#### Comparison for Autonomous Driving

| Runtime | Best Hardware | Quantization | Latency | Ecosystem |
|---|---|---|---|---|
| TensorRT | NVIDIA (Orin, Thor) | FP8, INT8, INT4, FP4 | Lowest on NVIDIA | Largest AV ecosystem |
| ONNX Runtime | Multi-vendor | INT8, FP16 | Good, portable | Most flexible |
| OpenVINO | Intel, ARM | INT8, FP16 | Good on Intel | Growing |

---

### 2.5 Neural Architecture Search (NAS)

NAS automates the design of efficient neural network architectures within hardware constraints:

- **Hardware-aware NAS:** Searches for architectures that maximize accuracy while fitting within a target latency/power budget on specific hardware (e.g., 10ms inference on Orin).
- **Once-for-all networks:** Train a single super-network, then extract sub-networks for different hardware targets without retraining.
- **Application:** NAS-designed backbones for BEV perception models can be 2-3x more efficient than hand-designed architectures while maintaining accuracy.

---

### 2.6 Mixture of Experts (MoE) for Conditional Computation

MoE enables conditional computation where only a subset of model parameters are activated per input:

- **Routing efficiency:** Only 2-4 experts (out of 8-64) are activated per token/frame, reducing effective FLOPs by 4-16x while maintaining the model's full capacity.
- **Relevance to world models:** MoE can enable larger world models that fit within edge compute budgets by activating only task-relevant experts (e.g., highway driving vs. intersection navigation vs. parking).
- **Challenges on edge:** Expert routing adds overhead; memory must hold all experts even if only a subset is active; expert load balancing becomes critical for real-time guarantees.
- **MoE-SpeQ (2025):** Novel approach using speculative decoding with lightweight draft models to optimize I/O latency for MoE inference, employing hardware-aware control and fused kernels for quantized MoE operations.

---

### 2.7 Speculative Decoding for Autoregressive World Models

For world models that generate future predictions autoregressively (token by token), speculative decoding can significantly reduce latency:

- **Mechanism:** A small, fast "draft" model proposes multiple future tokens; the larger "target" model verifies them in a single forward pass. Correctly predicted tokens are accepted without additional computation.
- **Speedup:** 2-3x latency reduction for autoregressive generation with no accuracy loss (mathematically equivalent output).
- **EAGLE-3 (2025):** Uses a lightweight autoregressive prediction head attached to the target model's internal layers, eliminating the need for a separate draft model and improving acceptance rates.
- **SP-MoE (2025):** Combines speculative decoding with expert prefetching, hiding I/O latency by loading the next expert while the current one computes.
- **Relevance to world models:** Autoregressive world models that predict future frames/states sequentially (like video prediction models) can use speculative decoding to generate multi-step predictions faster, critical for planning horizons that need to evaluate multiple future trajectories.

---

## 3. Running Large Models On-Vehicle

### 3.1 Can World Models Run in Real-Time on Current Hardware?

**Short answer: Partially yes, with significant constraints. Full-scale world models cannot run in real time on current production hardware, but distilled/compressed variants can.**

#### Current State of the Art (March 2026)

**What works today:**
- Perception-only transformer models (BEV encoders, 3D object detection) run at 10-30 Hz on Orin with INT8 quantization.
- Latent world models operating in compressed representation spaces achieve "orders-of-magnitude faster roll-outs on modest hardware" by planning in latent space rather than pixel space.
- T3Former achieves real-time, camera-only occupancy prediction deployment through sparse triplane attention mechanisms.
- SSR compresses dense BEV features into just 16 navigation-guided tokens, dramatically cutting FLOPs while maintaining accuracy.

**What does not work yet:**
- Full-resolution video generation world models (e.g., Cosmos-scale models at billions of parameters) cannot run in real time on any current edge hardware.
- End-to-end VLA (Vision-Language-Action) models with chain-of-thought reasoning require cloud-scale compute for training and near-cloud-scale for real-time inference.
- Multi-view, multi-frame world models with high-resolution outputs remain too compute-intensive for edge.

**What Thor enables (2025-2026):**
- Thor's 1,000 TOPS with native FP8 and 128GB memory opens the door for ~1B parameter world models at ~5-10 Hz, sufficient for planning but not perception-rate inference.
- Dual-Thor configurations (2,000 TOPS) could potentially support 1-2B parameter world models at planning-relevant frequencies (~5 Hz) with aggressive quantization and token compression.

---

### 3.2 Latency Budgets

Autonomous driving systems operate under strict, safety-critical latency budgets:

| Pipeline Stage | Latency Budget | Frequency | Notes |
|---|---|---|---|
| **Perception** (detection, segmentation) | 50-100 ms | 10-20 Hz | Must match sensor frame rate |
| **Prediction** (trajectory forecasting) | 20-50 ms | 10-20 Hz | Often runs parallel with perception |
| **Planning** (trajectory generation) | 50-200 ms | 5-10 Hz | Can tolerate slightly longer latency |
| **Control** (actuation commands) | 5-10 ms | 50-100 Hz | Hard real-time, typically on dedicated MCU |
| **End-to-end total** | 100-300 ms | - | Sensor-to-actuator |
| **World model rollout** | 50-200 ms | 5-10 Hz | For trajectory evaluation |

**Key constraint:** Edge AI on-vehicle achieves response times under 10ms for simple inference, vs. ~100ms for cloud-based processing. For world models, the relevant budget is the planning cycle (50-200ms), since world models serve prediction and planning rather than low-level perception.

---

### 3.3 Memory Requirements

| Model Type | Parameters | FP16 Memory | INT8 Memory | INT4 Memory |
|---|---|---|---|---|
| BEV Encoder (e.g., BEVFormer) | 50-200M | 0.1-0.4 GB | 0.05-0.2 GB | 0.025-0.1 GB |
| 3D Detection Transformer | 100-500M | 0.2-1.0 GB | 0.1-0.5 GB | 0.05-0.25 GB |
| Small World Model (distilled) | 500M-1B | 1-2 GB | 0.5-1 GB | 0.25-0.5 GB |
| Medium World Model | 2-7B | 4-14 GB | 2-7 GB | 1-3.5 GB |
| Large World Model (Cosmos-scale) | 12-40B | 24-80 GB | 12-40 GB | 6-20 GB |
| VLA Foundation Model | 40B+ | 80+ GB | 40+ GB | 20+ GB |

**Hardware memory constraints:**
- Orin 64GB: Can host medium world models (INT8) with room for perception stack
- Thor 128GB: Can host large world models (INT4/FP8) or full VLA models (heavily quantized)
- Tesla HW4 32GB: Limited to small-medium models; insufficient for large world models

**Activation memory** (intermediate tensors during inference) typically adds 2-5x the model weight memory, which must be factored into deployment planning. Streaming inference architectures that process frames incrementally can reduce peak activation memory by 3-5x.

---

### 3.4 Streaming Inference Architectures

To meet real-time constraints, streaming architectures process sensor data incrementally rather than in large batches:

- **Temporal token caching:** Reuse attention key-value caches from previous frames, only processing new visual tokens. Reduces per-frame compute by 40-70% for video-based models.
- **Sliding window attention:** Limits attention span to recent frames, bounding memory and compute growth.
- **Adaptive visual encoders:** Dynamically adjust resolution and token count based on scene complexity (e.g., more tokens at intersections, fewer on highways).
- **Streaming token compression:** Compress visual tokens on-the-fly before feeding to the world model, with recent advances showing promising latency reductions.
- **Multi-hop layer skipping:** Adaptively skip redundant transformer layers based on score change rates, achieving up to 28% layer sparsity and 29% latency reduction.

---

### 3.5 Cloud-Edge Hybrid Architectures

Given that full-scale world models exceed current edge compute budgets, hybrid architectures are essential:

#### Architecture Tiers

```
Tier 1: On-Vehicle (Hard Real-Time)
  - Perception (object detection, lane detection, free space)
  - Basic prediction (constant velocity, simple maneuvers)
  - Planning (trajectory generation from pre-computed cost maps)
  - Control (actuation, emergency braking)
  - Latency: <100ms, no network dependency

Tier 2: Roadside/Airport Edge Server (Soft Real-Time)
  - Enhanced prediction (complex interaction modeling)
  - World model inference (compressed/distilled variants)
  - Multi-vehicle coordination
  - V2X communication hub
  - Latency: 10-50ms over 5G/private network

Tier 3: Cloud (Non-Real-Time)
  - Full world model training and evaluation
  - Large-scale simulation and scenario generation
  - Fleet-wide model updates
  - Data aggregation and mining
  - Latency: seconds to minutes
```

#### Offloading Strategies

- **Selective offloading:** Computationally intensive but latency-tolerant tasks (long-horizon prediction, route planning, world model rollouts beyond the immediate planning horizon) are offloaded to edge servers or cloud.
- **Fallback architecture:** Vehicle operates autonomously using on-board compute; edge/cloud enhance performance when available but are never required for safety.
- **Data volume challenge:** Modern AVs produce 1.4-19 TB/hour. The Automotive Edge Computing Consortium forecasts 100 petabytes/month from 100M connected vehicles by 2025-2030.
- **Energy/cost benefit:** Hybrid edge-cloud reduces energy consumption by ~10,000 kWh per device annually and cuts costs by ~$1,500/year compared to centralized cloud processing.

---

## 4. Infrastructure

### 4.1 Data Collection and Upload from Fleet

#### Data Generation Scale

| Source | Data Rate | Notes |
|---|---|---|
| Single camera (5MP, 30fps) | ~200 MB/s raw | 8-12 cameras per vehicle |
| LiDAR (128-channel) | ~300 MB/s | Point cloud data |
| Radar | ~10-50 MB/s | Multiple radar units |
| IMU/GPS/CAN | ~1 MB/s | Vehicle telemetry |
| **Total per vehicle** | **~1-4 TB/hour** | Varies by sensor suite |
| Fleet (1,000 vehicles, 8hr/day) | **8-32 PB/day** | Before compression |

#### Upload Strategies

**Physical media transfer** remains the primary method for bulk sensor data. Wireless upload of terabytes per vehicle per day is impractical with current cellular bandwidth. Rivian's approach uses AWS Data Transfer Terminal, a managed facility with purpose-built hardware for sustained high-volume transfer from physical drives to S3.

**Selective upload** via edge processing on-vehicle: Only upload "interesting" data (edge cases, disengagements, near-misses, novel scenarios). On-vehicle ML models identify and flag data worth uploading, reducing upload volume by 90-99%.

**Depot-based upload:** Vehicles upload data when parked at depots via high-bandwidth wired connections (10-100 Gbps Ethernet). For airport GSE, this could leverage depot WiFi 6E or wired connections during charging.

**Future:** Integration of upload with charging infrastructure. As autonomous EVs charge, they simultaneously upload data through high-bandwidth connections embedded in charging stations.

---

### 4.2 OTA Model Updates

The automotive OTA market is growing at 17% CAGR (2025-2035), reflecting the criticality of remote model updates for autonomous fleets.

#### Update Architecture

- **Delta updates:** Only transmit model weight differences, reducing update size by 80-95% compared to full model replacement.
- **Segmented transmission:** Large updates broken into smaller segments that can resume from where they left off, handling intermittent connectivity.
- **Staged rollout:** Updates deployed to a limited number of vehicles first, with performance monitoring before broader release.
- **Rollback capability:** Retain previous software versions for immediate reversion if issues are detected.
- **Dual-partition boot:** Vehicle maintains two software partitions; updates are written to the inactive partition and atomically switched on reboot.

#### Safety Considerations

- Updates must not interrupt safety-critical operations
- Validation in digital twin environments before deployment
- Cryptographic signing and verification of all model artifacts
- Compliance with UNECE WP.29 R156 (software update management)

---

### 4.3 Model Versioning and A/B Testing

#### Shadow Mode Deployment

Tesla pioneered shadow mode, where new FSD software runs silently alongside the production stack, making driving decisions without controlling the vehicle. This turns the entire fleet into a massive validation network:
- New model predictions are compared against human driver actions
- Metrics collected: intervention rate, prediction accuracy, comfort scores
- No safety risk since shadow model never controls actuators

#### Fleet A/B Testing Framework

```
Production Fleet
  |
  +-- Control Group (90%): Current production model v2.3
  |
  +-- Treatment A (5%): Candidate model v2.4-alpha
  |
  +-- Treatment B (5%): Candidate model v2.4-beta
  |
  +-- All groups: Shadow evaluation of v3.0-experimental
```

#### MLOps Stack for AV

| Component | Tools | Purpose |
|---|---|---|
| Experiment tracking | Weights & Biases, MLFlow | Track training runs, hyperparameters, metrics |
| Data versioning | lakeFS, DVC | Git-like version control for petabyte-scale data lakes |
| Model registry | MLFlow, custom | Version models with metadata, lineage, validation status |
| Pipeline orchestration | Argo Workflows, Kubeflow | Automate train -> validate -> deploy pipeline |
| Deployment | Kubernetes, custom OTA | Canary, shadow, A/B deployment strategies |
| Monitoring | Prometheus, Grafana, custom | Fleet-wide model performance metrics |

---

### 4.4 GPU Clusters for Training World Models

#### Scale Requirements

Training world models for autonomous driving requires massive compute:

| Model Scale | Training Compute | GPU Hours (H100) | Estimated Cost |
|---|---|---|---|
| Small WM (1B params) | ~10^21 FLOPs | ~5,000 | ~$15K |
| Medium WM (7B params) | ~10^22 FLOPs | ~50,000 | ~$150K |
| Large WM (40B+ params) | ~10^23 FLOPs | ~500,000 | ~$1.5M |
| VLA Foundation (40B, DeepRoute) | ~10^23-24 FLOPs | ~1M+ | ~$3-5M+ |

#### Infrastructure Advances (2025-2026)

- **Thousand-GPU distributed training:** Cloud-based platforms have achieved 40x speedup for embodied AI models (GR00T-N1.5 training reduced from 15 hours to 22 minutes on 1,000-GPU cluster).
- **Key enablers:** 3.2 Tbps RDMA networking, high-performance parallel storage, Ray-driven elastic scheduling.
- **NVIDIA Cosmos pipeline:** End-to-end from raw fleet sensor data -> curation (Cosmos Curator) -> scene reconstruction (Omniverse NuRec) -> world model training (Cosmos Predict/Transfer/Reason) -> closed-loop simulation validation.
- **Grace Blackwell NVL72:** NVIDIA's latest training platform enables real-time world generation for simulation.

#### Data Pipeline Architecture

```
Fleet Vehicles --> Physical Upload / Selective Wireless
       |
  Raw Data Lake (S3/GCS, petabyte-scale)
       |
  Curation & Labeling Pipeline (NVIDIA Cosmos Curator, Scale AI)
       |
  Training Dataset (curated, balanced, privacy-scrubbed)
       |
  Multi-GPU Training Cluster (H100/B200, 256-1024 GPUs)
       |
  Model Registry + Validation (simulation + replay)
       |
  OTA Deployment Pipeline --> Fleet
```

---

## 5. Airside-Specific Deployment

### 5.1 Power Constraints on Electric GSE

#### Battery and Charging Landscape

Electric GSE adoption is accelerating across global airports:
- Zurich Airport: 44% electric GSE fleet (target: 55% by end of 2025)
- Schiphol Airport: Invested EUR 2.5M in electric vehicles; 58 new electric apron buses; target 100% electric by 2030
- US airports: Rapidly embracing eGSE driven by EPA regulations and cost savings

#### Power Budget for Compute

| GSE Type | Battery (est.) | Operating Hours | Compute Power Budget |
|---|---|---|---|
| Electric baggage tug | 30-60 kWh | 6-8 hrs | 100-300W for compute |
| Electric belt loader | 40-80 kWh | 6-8 hrs | 100-300W for compute |
| Electric pushback tractor | 100-300 kWh | 8-12 hrs | 200-500W for compute |
| Autonomous shuttle | 60-150 kWh | 10-16 hrs | 200-500W for compute |

**Key constraint:** Compute power must be a small fraction (<5%) of total vehicle power to avoid significantly impacting range. For a 60 kWh battery operating 8 hours, the total energy budget is 7.5 kW average. A 200W compute system consumes 2.7% of this budget -- acceptable. A 500W system (dual-Thor) consumes 6.7% -- borderline.

**Recommendation:** NVIDIA Orin (60W) or single Thor (130W) with aggressive model quantization is the sweet spot for electric GSE. The additional range impact of 60-130W is 0.8-1.7% of a 60 kWh battery -- negligible.

---

### 5.2 Ruggedization Requirements

Airport airside environments present challenging conditions:

| Factor | Requirement | Standard |
|---|---|---|
| **Temperature** | -30C to +55C operating (tarmac heat in summer, cold climates) | MIL-STD-810H Method 501.7/502.7 |
| **Vibration** | Continuous exposure from vehicle operation on uneven surfaces | MIL-STD-810H Method 514.8 |
| **Shock** | Impact from loading/unloading operations | MIL-STD-810H Method 516.8 |
| **Ingress Protection** | Rain, snow, de-icing fluids, jet fuel splash, FOD | IP67 minimum (dust-tight, temporary immersion) |
| **EMI/EMC** | Airport radar, radio, and navigation system interference | DO-160G / MIL-STD-461G |
| **Humidity** | 0-100% RH, condensation | MIL-STD-810H Method 507.6 |
| **Salt Fog** | Coastal airports | MIL-STD-810H Method 509.7 |

**Compute enclosure requirements:**
- IP67-rated sealed enclosure with precision-machined metal housing
- Passive cooling (fanless) or sealed active cooling to maintain IP rating
- Conformal coating on PCBs for moisture protection
- Shock-mounted to isolate sensitive electronics
- Wide-temperature-range components (-40C to +85C automotive grade)

**NVIDIA Jetson AGX Orin** has existing ruggedized solutions from companies like Premio Inc., offering fanless, IP67-rated in-vehicle AI computing platforms validated against MIL-STD-810H. These are directly applicable to airport GSE.

**Cost adder for ruggedization:** Typically 2-4x the base compute module cost for a fully ruggedized enclosure with thermal management.

---

### 5.3 Connectivity on Airside

#### Private 5G Networks

Private 5G is emerging as the connectivity backbone for airside autonomous operations:

- **DFW Airport:** 200+ access points and private 5G backbone supporting asset tracking, autonomous vehicle trials, and digital twins. Full coverage across airside, hangars, gates, and maintenance areas.
- **Schiphol, Changi:** Early adopters of private 5G for ground operations.
- **Key advantage:** Sub-millisecond latency for autonomous vehicle coordination -- critical for real-time navigation that traditional WiFi cannot deliver.
- **Providers:** Nokia (via MCA Aviation), NTT, Ericsson providing turnkey private 5G solutions for airports.

#### Connectivity Options Comparison

| Technology | Latency | Bandwidth | Range | Coverage | Cost |
|---|---|---|---|---|---|
| **Private 5G** | 1-10 ms | 1-10 Gbps | 500m-2km per cell | Airside-wide | High (infrastructure) |
| **WiFi 6/6E** | 5-20 ms | 1-10 Gbps | 50-100m | Spot coverage | Medium |
| **Mesh WiFi** | 10-50 ms | 500 Mbps-2 Gbps | Extendable | Flexible | Medium |
| **LTE/4G** | 20-50 ms | 100-300 Mbps | Carrier coverage | Variable | Low (subscription) |
| **V2X (C-V2X)** | 5-10 ms | 10-50 Mbps | 300-500m | Vehicle-to-vehicle | Medium |

**Recommendation for airside autonomous GSE:** Private 5G as primary backbone with WiFi 6 fallback at gates/hangars. Vehicles must operate safely with full autonomy even during connectivity loss (Tier 1 on-vehicle compute handles all safety-critical functions independently).

---

### 5.4 Edge Server at Airport vs. On-Vehicle Compute

#### Hybrid Architecture for Airside

```
                    Cloud (Azure/AWS/GCP)
                         |
                    Airport Data Center
                    (GPU-equipped edge servers)
                         |
               Private 5G / WiFi 6 Backbone
                    |         |         |
               [GSE 1]   [GSE 2]   [GSE N]
           (Orin/Thor)  (Orin/Thor) (Orin/Thor)
```

#### Edge Server Benefits

- **Enhanced world model inference:** Run larger, more capable world models that exceed on-vehicle compute
- **Multi-vehicle coordination:** Central optimizer for fleet routing, conflict resolution, gate assignments
- **Monitoring and telemetry:** Real-time fleet monitoring, anomaly detection, safety oversight
- **Model update staging:** Local cache for OTA updates, reducing WAN bandwidth needs
- **Digital twin:** Real-time airport digital twin for simulation and planning

#### Edge Server Specifications (Recommended)

| Component | Specification | Purpose |
|---|---|---|
| GPU | 2-4x NVIDIA L40S or A100 | World model inference, fleet optimization |
| CPU | AMD EPYC 9004 or Intel Xeon 5th Gen | Data processing, coordination |
| Memory | 256-512 GB | Model hosting, fleet state |
| Storage | 10-50 TB NVMe | Local data cache, model repository |
| Networking | 25-100 GbE + 5G gateway | Fleet communication |
| Power | 2-5 kW per server | Data center or ruggedized cabinet |
| Redundancy | N+1 servers, UPS | 99.99% availability |

#### Decision Framework: On-Vehicle vs. Edge Server

| Function | On-Vehicle | Edge Server | Cloud |
|---|---|---|---|
| Emergency braking | Required | N/A | N/A |
| Object detection | Required | Optional enhancement | N/A |
| Path planning (immediate) | Required | Optional enhancement | N/A |
| World model (short horizon) | Preferred | Fallback | N/A |
| World model (long horizon) | Optional | Preferred | Fallback |
| Fleet coordination | N/A | Required | Fallback |
| Model training | N/A | N/A | Required |
| Data aggregation | Buffer only | Staging | Required |

---

### 5.5 Cost Considerations for Fleet Deployment

#### Per-Vehicle Compute Cost

| Configuration | Hardware Cost | Ruggedization | Total per Vehicle |
|---|---|---|---|
| Orin 32GB (basic) | ~$400 (module) | ~$800-1,600 | ~$1,200-2,000 |
| Orin 64GB (full) | ~$1,600 (module) | ~$1,600-3,200 | ~$3,200-4,800 |
| Thor (when available) | ~$3,000-5,000 (est.) | ~$2,000-4,000 | ~$5,000-9,000 |
| Sensor suite (cameras, radar) | $2,000-10,000 | Included | $2,000-10,000 |
| **Total per vehicle** | - | - | **$5,000-20,000** |

#### Fleet-Scale Cost Model (50-vehicle airport fleet)

| Item | Cost | Notes |
|---|---|---|
| Compute + sensors (50 vehicles) | $250K-$1M | Depends on configuration |
| Edge server infrastructure | $50K-$200K | 2-4 servers, networking |
| Private 5G network | $500K-$2M | Airport-wide coverage |
| Software development/integration | $1M-$5M | Custom stack, safety validation |
| Annual connectivity (5G/WiFi) | $100K-$300K | Recurring |
| Annual cloud compute (training) | $200K-$500K | Model training, simulation |
| Annual OTA/fleet management | $50K-$200K | Platform licensing |
| **Total Year 1** | **$2.1M-$9.2M** | Capital + operational |
| **Annual recurring** | **$350K-$1M** | Operational |

#### ROI Drivers

- **Labor savings:** Autonomous GSE can operate 24/7 vs. 1-2 shifts for human operators. At $50K-$70K fully loaded cost per operator, a 50-vehicle fleet replacing 100+ operators saves $5-7M/year.
- **Efficiency gains:** Autonomous routing optimization can improve turnaround time by 15-25%, increasing gate utilization.
- **Safety improvements:** Reduced ramp incidents (currently costing the industry $10B+/year globally).
- **Estimated payback period:** 1-3 years depending on fleet size and labor market conditions.

---

## Key Takeaways and Recommendations

### For Airside Autonomous GSE Deployment

1. **Hardware selection:** Start with NVIDIA Jetson AGX Orin 64GB ($1,600/module) for development and initial deployment. Plan migration to Thor when available and proven in 2026-2027 for enhanced world model capabilities.

2. **Model architecture:** Deploy a distilled, quantized (INT8/FP8) world model in the 500M-1B parameter range on Orin. Use latent-space world models (not pixel-space generation) for real-time planning at 5-10 Hz.

3. **Connectivity:** Invest in private 5G infrastructure for airside coverage. Design the autonomy stack to function fully on-vehicle with degraded-but-safe operation during connectivity loss.

4. **Hybrid compute:** Deploy 2-4 GPU-equipped edge servers at the airport for fleet coordination, enhanced world model inference, and local model update staging. Never depend on edge servers for safety-critical functions.

5. **Power management:** Orin's 60W power draw is negligible for electric GSE with 30-100 kWh batteries. Thor at 130W remains acceptable (<2% of energy budget).

6. **Ruggedization:** Budget 2-4x compute module cost for IP67, MIL-STD-810H rated enclosures. Use existing ruggedized Jetson solutions from vendors like Premio.

7. **Data pipeline:** Implement depot-based wired upload during charging cycles. Use on-vehicle edge processing to filter and compress data before upload, targeting <5% of raw sensor data actually uploaded.

8. **Fleet economics:** Target 50+ vehicle fleets for cost-effectiveness. Expected payback in 1-3 years through labor savings and efficiency gains, with Year 1 all-in cost of $2-9M depending on scope.

---

## Sources

### Edge Compute Platforms
- [NVIDIA DRIVE AGX Thor Deep Dive](https://www.nevsemi.com/blog/what-is-nvidia-drive-agx-thor-a-deep-dive-into-nvidia-s-automotive-ai-supercomputer)
- [NVIDIA Jetson AGX Orin](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/)
- [NVIDIA Jetson Thor](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-thor/)
- [NVIDIA DRIVE Thor Announcement](https://nvidianews.nvidia.com/news/nvidia-unveils-drive-thor-centralized-car-computer-unifying-cluster-infotainment-automated-driving-and-parking-in-a-single-cost-saving-system)
- [NVIDIA Drive - Wikipedia](https://en.wikipedia.org/wiki/Nvidia_Drive)
- [Self-Driving Supercomputer Showdown: Thor vs Tesla HW4 vs Ride Flex](https://ts2.tech/en/self-driving-supercomputer-showdown-nvidia-drive-thor-vs-tesla-fsd-hardware-4-vs-qualcomm-snapdragon-ride-flex/)
- [Qualcomm Snapdragon Ride](https://www.qualcomm.com/automotive/solutions/snapdragon-ride)
- [Qualcomm Digital Chassis Momentum 2026](https://www.qualcomm.com/news/releases/2026/01/qualcomm-drives-the-future-of-mobility-with-strong-snapdragon-di)
- [Mobileye EyeQ6](https://www.mobileye.com/blog/eyeq6-system-on-chip/)
- [Tesla Autopilot Hardware - Wikipedia](https://en.wikipedia.org/wiki/Tesla_Autopilot_hardware)
- [Tesla HW5/AI5 Rumored Specs](https://www.notateslaapp.com/news/2805/teslas-next-gen-fsd-computer-hw5-ai5-rumored-to-deliver-5x-more-power)
- [Tesla HW4.5 vs HW3](https://www.teslaacessories.com/blogs/news/hw-4.5-vs.-hw-3.0-the-inconvenient-truth-about-the-path-to-unsupervised-autonomy)
- [Top 20 Autonomous Driving Chips 2025](https://www.nevsemi.com/blog/top-20-most-advanced-autonomous-driving-chips-2025)
- [Ambarella CV3 Family](https://www.ambarella.com/news/ambarella-launches-ai-domain-controller-soc-family-for-single-chip-multi-sensor-perception-fusion-and-path-planning-in-adas-to-l4-autonomous-vehicles/)
- [AMD Versal AI Edge for Automotive](https://www.electronicdesign.com/markets/automotive/article/21280264/electronic-design-amd-equips-automotive-grade-soc-with-advanced-ai-engine)
- [AMD Versal Gen 2](https://www.therobotreport.com/?p=578606)
- [TI TDA4VM Datasheet](https://www.ti.com/product/TDA4VM)
- [TI TDA5 24 TOPS/W](https://www.powerelectronicsnews.com/ti-tda5-automotive-soc-delivers-24-tops-w/)
- [TI Expanded Automotive Portfolio 2026](https://www.ti.com/about-ti/newsroom/news-releases/2026/2026-01-05-ti-accelerates-the-shift-toward-autonomous-vehicles-with-expanded-automotive-portfolio.html)

### Model Optimization
- [TensorRT SDK](https://developer.nvidia.com/tensorrt)
- [TensorRT Quantized Types](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-quantized-types.html)
- [Pruning and Distilling with TensorRT Model Optimizer](https://developer.nvidia.com/blog/pruning-and-distilling-llms-using-nvidia-tensorrt-model-optimizer/)
- [Vision Transformers on the Edge Survey](https://arxiv.org/html/2503.02891v1)
- [Multi-Task Model Compression for AD](https://arxiv.org/abs/2511.05557)
- [Knowledge Distillation Survey](https://arxiv.org/pdf/2503.12067)
- [ONNX Runtime](https://www.ultralytics.com/glossary/onnx-open-neural-network-exchange)
- [OpenVINO for ONNX Runtime](https://onnxruntime.ai/docs/execution-providers/OpenVINO-ExecutionProvider.html)
- [Comparative Analysis: TensorRT vs ONNX Runtime vs OpenVINO](https://uplatz.com/blog/a-comparative-analysis-of-modern-ai-inference-engines-for-optimized-cross-platform-deployment-tensorrt-onnx-runtime-and-openvino/)
- [Speculative Decoding Introduction (NVIDIA)](https://developer.nvidia.com/blog/an-introduction-to-speculative-decoding-for-reducing-latency-in-ai-inference/)
- [MoE-SpeQ](https://arxiv.org/html/2511.14102v1)
- [SP-MoE](https://arxiv.org/html/2510.10302v1)

### World Models and Real-Time Inference
- [Survey of World Models for Autonomous Driving](https://arxiv.org/html/2501.11260v4)
- [Latent World Model for End-to-End AD](https://arxiv.org/abs/2406.08481)
- [World4Drive](https://arxiv.org/abs/2507.00603)
- [Waymo World Model (Genie 3)](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [NVIDIA Cosmos World Foundation Models](https://www.nvidia.com/en-us/ai/cosmos/)
- [NVIDIA Cosmos Predict 2.5](https://github.com/nvidia-cosmos/cosmos-predict2.5)
- [NVIDIA Alpamayo-R1](https://research.nvidia.com/labs/avg/publication/tan.chitta.etal.arxiv2025/)
- [DeepRoute.ai 40B VLA at GTC 2026](https://www.manilatimes.net/2026/03/17/tmt-newswire/pr-newswire/deeprouteai-presents-40b-vision-language-action-foundation-model-at-nvidia-gtc-2026-accelerating-autonomous-driving-at-scale/2301943)

### Infrastructure
- [AWS + NVIDIA AV Data Pipeline](https://aws.amazon.com/blogs/industries/building-an-end-to-end-physical-ai-data-pipeline-for-autonomous-vehicle-3-0-on-aws-with-nvidia/)
- [Rivian AWS Data Transfer](https://aws.amazon.com/blogs/industries/how-rivian-transformed-its-autonomy-data-ingestion-with-aws-data-transfer-terminal/)
- [AV Data Collection 2025](https://labelyourdata.com/articles/autonomous-vehicle-data-collection)
- [Applied Intuition OTA Updates](https://www.appliedintuition.com/blog/future-proofing-via-ota-updates)
- [Mender OTA for Autonomous Vehicles](https://mender.io/blog/driving-towards-the-future-the-role-of-ota-updates-in-autonomous-vehicles)
- [Tesla Shadow Mode](https://www.notateslaapp.com/news/3108/teslas-fsd-shadow-mode-what-it-is-and-how-it-improves-fsd)
- [Thousand-GPU Training Infrastructure](https://arxiv.org/html/2603.11101v1)
- [Shadow Deployment in ML](https://medium.com/mlops-community/questions-answered-shadow-deployment-in-machine-learning-5ee5a8854e10)

### Airside Deployment
- [Autonomous GSE at Airports](https://www.airportsinternational.com/article/autonomous-gse-shape-things-come)
- [FAA Autonomous Ground Vehicle Systems](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [IATA Ground Ops of the Future](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-ops-of-the-future/)
- [Airport Electrification (WSP)](https://www.wsp.com/en-gl/insights/electrification-of-airports-from-landside-to-airside)
- [eGSE Adoption at Airports](https://evinfo.net/2025/01/airports-quickly-embracing-electric-ground-support-equipment/)
- [Private 5G at Airports](https://blog.privatenetworks.technology/2025/05/why-private-5g-networks-are-taking-off.html)
- [Airport Connectivity Infrastructure](https://tecknexus.com/the-infrastructure-imperative-at-airports-5g-wi-fi-6-private-networks-edge/)
- [Nokia Private Wireless for Airports](https://callmc.com/private-wireless-airports/)
- [Edge Computing in Aviation 2025](https://www.moment.tech/news/the-future-of-edge-computing-in-aviation-beyond-the-technological-buzzword)
- [Kempower Charging at Schiphol](https://kempower.com/america/news/kempower-powers-schiphol-airport-with-charging-infrastructure-for-electric-ground-fleet/)
- [Rugged In-Vehicle AI with Jetson Orin (Premio)](https://premioinc.com/blogs/blog/rugged-in-vehicle-ai-computing-with-nvidia-jetson-orin)
- [DFW Airport GSE Electrification Assessment](https://www.osti.gov/biblio/2586884)
