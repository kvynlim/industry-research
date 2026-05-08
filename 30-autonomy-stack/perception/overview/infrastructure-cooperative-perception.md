# Infrastructure-Cooperative Perception and V2X for Autonomous Vehicles
## Focus: Airport Airside Applications with Fixed Infrastructure Sensing

---

## Table of Contents

1. [The Cooperative Perception Paradigm](#1-the-cooperative-perception-paradigm)
   - 1.1 Why Infrastructure-Cooperative Perception Matters
   - 1.2 V2X Communication Modes
   - 1.3 Fusion Architectures: Early, Late, Intermediate
   - 1.4 Bandwidth and Latency Requirements
2. [Key Methods and Papers](#2-key-methods-and-papers)
   - 2.1 Foundational Datasets and Benchmarks
   - 2.2 Core Cooperative Perception Models (2021-2023)
   - 2.3 2024 Advances
   - 2.4 2025-2026 Frontier Research
   - 2.5 Open-Source Frameworks and Repos
3. [Infrastructure Sensor Deployment](#3-infrastructure-sensor-deployment)
   - 3.1 Roadside Perception Unit (RSPU) Architecture
   - 3.2 Sensor Configuration and Pole Design
   - 3.3 Coverage Planning and Placement Optimization
   - 3.4 Vehicle-Infrastructure Calibration
   - 3.5 Costs of Infrastructure Sensor Installation
   - 3.6 Companies: Derq, Miovision, Cavnue, and Others
4. [Airport-Specific Infrastructure Perception](#4-airport-specific-infrastructure-perception)
   - 4.1 Existing Airport Surveillance Systems
   - 4.2 A-SMGCS as Cooperative Perception Input
   - 4.3 Airport CCTV for Perception
   - 4.4 ADS-B as Cooperative Perception for Aircraft
   - 4.5 Stand-Level Sensing
   - 4.6 Airport LiDAR Deployments
   - 4.7 Architecture: Airside Cooperative Perception Stack
5. [Communication Infrastructure](#5-communication-infrastructure)
   - 5.1 DSRC vs C-V2X: The Technology Decision
   - 5.2 5G/C-V2X for Infrastructure-to-Vehicle
   - 5.3 Latency Budget for Cooperative Perception
   - 5.4 Edge Computing for Real-Time Fusion
   - 5.5 Airport 5G as Enabling Infrastructure
6. [Challenges and Solutions](#6-challenges-and-solutions)
   - 6.1 Sensor Calibration Drift
   - 6.2 Asynchronous Sensor Data
   - 6.3 Occlusion Handling (The Main Benefit)
   - 6.4 Cybersecurity of V2I Links
   - 6.5 Infrastructure Failure Modes and Graceful Degradation
   - 6.6 Heterogeneous Agent Fusion
7. [Airside Cooperative Perception Architecture](#7-airside-cooperative-perception-architecture)
   - 7.1 Proposed System Design
   - 7.2 Phased Deployment Strategy
   - 7.3 Cost Model for Airport Deployment
   - 7.4 Integration with Aurrigo Stack

---

## 1. The Cooperative Perception Paradigm

### 1.1 Why Infrastructure-Cooperative Perception Matters

Single-vehicle perception systems are fundamentally limited by line-of-sight constraints, sensor range, and occlusion. A vehicle approaching an aircraft stand cannot see around the fuselage. A baggage tractor cannot detect a ground crew member emerging from behind a belt loader. These are not edge cases on airport aprons -- they are the normal operating condition.

**Infrastructure-cooperative perception** solves this by deploying fixed sensors (cameras, LiDAR, radar) on poles, buildings, and structures throughout the environment, then fusing their data with vehicle-onboard perception in real time. This paradigm offers three fundamental advantages:

1. **Extended perception range**: Fixed sensors provide visibility into areas the vehicle cannot see (around corners, behind aircraft, in blind spots)
2. **Reduced per-vehicle cost**: Sharing high-quality infrastructure sensors across all vehicles reduces the sensor burden on each vehicle
3. **Persistent monitoring**: Infrastructure sensors operate continuously regardless of vehicle presence, enabling proactive safety alerts

**Why airports are the ideal deployment environment for cooperative perception:**

| Factor | Public Roads | Airport Airside |
|--------|-------------|-----------------|
| Infrastructure owner | Fragmented (city, state, federal) | Single operator (airport authority) |
| Sensor installation authority | Complex permitting | Airport controls all infrastructure |
| Communication network | Public cellular, heterogeneous | Private 5G/CBRS, controlled |
| Environment complexity | Unbounded, highly variable | Bounded, semi-structured |
| Vehicle fleet | Millions of heterogeneous vehicles | Tens to hundreds of known vehicles |
| Speed regime | 0-130 km/h | 0-30 km/h (typically <25 km/h) |
| Regulatory body | DOT, FHWA, state DMV | Airport authority + FAA (advisory) |
| ROI justification | Public safety (hard to monetize) | Direct operational savings (turnaround time, labor) |
| Latency tolerance | Tight (high speed) | More relaxed (low speed) |

The low-speed, bounded, single-operator nature of airports means cooperative perception is **far more tractable** than on public roads. The airport authority can install sensors wherever needed, control the communication network, and mandate that all vehicles participate.

### 1.2 V2X Communication Modes

Vehicle-to-Everything (V2X) encompasses four communication modes relevant to cooperative perception:

| Mode | Description | Airside Relevance |
|------|-------------|-------------------|
| **V2I** (Vehicle-to-Infrastructure) | Vehicle communicates with fixed roadside/infrastructure units | **Primary mode for airside** -- poles with sensors at stands, taxiways |
| **V2V** (Vehicle-to-Vehicle) | Vehicles share perception data directly | Useful for tug-to-tug coordination at busy stands |
| **V2N** (Vehicle-to-Network) | Vehicle communicates via cellular/5G network | Teleoperation, fleet management, cloud fusion |
| **V2P** (Vehicle-to-Pedestrian) | Vehicle detects/communicates with ground crew | Crew wearables with UWB/BLE beacons |

For airport airside, **V2I is the dominant paradigm** because:
- The airport controls all infrastructure and can install sensors optimally
- Vehicles operate in defined zones around stands, on taxiways, and along service roads
- Infrastructure sensors provide persistent coverage regardless of vehicle positioning
- The low speed regime (<25 km/h) relaxes latency requirements compared to highways

### 1.3 Fusion Architectures: Early, Late, Intermediate

The fundamental design choice in cooperative perception is **what** to share between infrastructure and vehicle:

#### Early Fusion (Raw Data Sharing)

Transmits raw sensor data (point clouds, images) from infrastructure to vehicle (or to an edge server).

| Aspect | Details |
|--------|---------|
| **What is shared** | Raw LiDAR point clouds, camera images |
| **Bandwidth** | 70-100+ Mbps per infrastructure node (LiDAR: ~100 Mbps for 128-beam at 10Hz; camera: ~20 Mbps per 2MP stream) |
| **Latency** | High transmission latency due to data volume |
| **Information quality** | Maximum -- all information preserved |
| **Processing** | Centralized fusion requires powerful edge compute |
| **When to use** | When bandwidth is abundant and latency can be absorbed |

**Formalization**: `X_CP = F_EarlyFusion({X_vehicle, X_infra_1, ..., X_infra_N})`

#### Late Fusion (Output Sharing)

Transmits final perception outputs (3D bounding boxes, tracks, semantic labels) from infrastructure to vehicle.

| Aspect | Details |
|--------|---------|
| **What is shared** | 3D bounding boxes (position, size, class, velocity, confidence) |
| **Bandwidth** | < 1 Mbps (typically 10-100 KB/s) |
| **Latency** | Low transmission latency |
| **Information quality** | Minimal -- only final detections, no raw evidence |
| **Processing** | Each node runs independent perception; simple output merge |
| **When to use** | When bandwidth is constrained or as baseline/fallback |

**Formalization**: `Y_CP = F_LateFusion({Y_vehicle, Y_infra_1, ..., Y_infra_N})`

**DAIR-V2X benchmark result**: Late fusion with Time Compensation (TCLF) improves AP by ~15% over single-vehicle detection, demonstrating that even simple output sharing provides significant benefit.

#### Intermediate Fusion (Feature Sharing) -- The Dominant Paradigm

Shares extracted neural network features (BEV feature maps, compressed representations) between agents.

| Aspect | Details |
|--------|---------|
| **What is shared** | BEV feature maps, compressed intermediate representations |
| **Bandwidth** | 1-20 Mbps (tunable via compression) |
| **Latency** | Moderate |
| **Information quality** | High -- rich features preserved, but compact |
| **Processing** | Requires compatible feature extractors across agents |
| **When to use** | Default choice for most cooperative perception systems |

**Formalization**: `F_CP = F_InterFusion({F_vehicle, F_infra_1, ..., F_infra_N})`

**Key insight**: Intermediate fusion dominates current research because it achieves 90-98% of early fusion performance at 1/10th to 1/100th the bandwidth. FFNet achieves 62.87% mAP@BEV on DAIR-V2X while requiring only ~1/100 of early fusion transmission cost.

**Compression Techniques for Intermediate Fusion:**

| Technique | Method | Paper |
|-----------|--------|-------|
| 1x1 conv autoencoder | Compress feature channels | DiscoNet (NeurIPS 2021) |
| Spatial confidence maps | Only send features for critical regions | Where2comm (NeurIPS 2022) |
| SENet channel attention | Weight and prune channels | Slim-FCP |
| Point cluster packing | Geometric compression of point features | V2X-PC |
| Codebook quantization | Transmit code indices, reconstruct locally | QuantV2X (2025) |
| Feature flow | Transmit temporal deltas, not full features | FFNet (NeurIPS 2023) |

### 1.4 Bandwidth and Latency Requirements

**Bandwidth Requirements by Fusion Type:**

| Fusion Type | Per-Infrastructure-Node Bandwidth | 10 Nodes Total | Compatible With |
|-------------|----------------------------------|-----------------|-----------------|
| Early (raw LiDAR) | 70-100 Mbps | 700 Mbps - 1 Gbps | 5G NR only |
| Early (raw camera) | 15-30 Mbps per camera | 150-300 Mbps | 5G NR |
| Intermediate (uncompressed BEV) | 5-20 Mbps | 50-200 Mbps | 5G / high-end C-V2X |
| Intermediate (compressed) | 0.5-5 Mbps | 5-50 Mbps | C-V2X / private 5G |
| Late (detections only) | 0.01-0.1 Mbps | 0.1-1 Mbps | Any (DSRC, WiFi, 4G) |

**Latency Budget for Cooperative Perception:**

For airside operations at <25 km/h, the perception-to-action latency budget is more relaxed than highway driving:

| Component | Typical Latency | Airside Budget |
|-----------|----------------|----------------|
| Infrastructure sensor capture | 50-100 ms | 100 ms |
| Feature extraction (infra edge) | 20-50 ms | 50 ms |
| Transmission (infra to vehicle) | 5-20 ms (5G) | 20 ms |
| Fusion on vehicle | 10-30 ms | 30 ms |
| **Total end-to-end** | **85-200 ms** | **<200 ms** |

At 25 km/h (6.9 m/s), 200 ms of latency corresponds to 1.4 m of travel -- well within safety margins for a vehicle with 10+ m stopping distance at that speed.

**Critical threshold**: Research shows cooperative perception performance degrades significantly beyond 300 ms latency. The LRCP framework (WACV 2025) demonstrates negligible performance reduction below 200 ms.

---

## 2. Key Methods and Papers

### 2.1 Foundational Datasets and Benchmarks

| Dataset | Venue/Year | Type | Scale | Modality | Collaboration Mode | Key Feature |
|---------|-----------|------|-------|----------|-------------------|-------------|
| **OPV2V** | ICRA 2022 | Simulated (CARLA) | 11,464 frames, 232,913 3D boxes, 73 scenes | LiDAR + Camera | V2V | First large-scale V2V dataset; OpenCOOD framework |
| **DAIR-V2X** | CVPR 2022 | Real-world (Beijing) | 71,254 LiDAR + 71,254 camera frames | LiDAR + Camera | V2I only | First real-world V2I dataset; +15% AP with infrastructure |
| **V2XSet** | ECCV 2022 | Simulated (CARLA) | Multi-agent V2X | LiDAR + Camera | V2V + V2I | Heterogeneous V2X scenarios |
| **V2V4Real** | CVPR 2023 (Highlight) | Real-world | 20K LiDAR, 40K RGB, 240K 3D boxes, 410 km | LiDAR + Camera | V2V | First real-world V2V dataset; 5 classes |
| **TUMTraf-V2X** | CVPR 2024 | Real-world (Munich) | 2,000 point clouds, 5,000 images, 30K 3D boxes | LiDAR + Camera (5 roadside + 4 onboard) | V2I + V2V | First real-world multi-sensor V2X; +14.36 mAP with cooperation |
| **V2X-Real** | ECCV 2024 | Real-world | 33K LiDAR, 171K camera, 1.2M 3D boxes | LiDAR + Camera | V2V + V2I + I2I | 2 vehicles + 2 infrastructure; 10 object classes; most comprehensive |
| **V2X-Radar** | NeurIPS 2025 (Spotlight) | Real-world | 20K LiDAR, 40K camera, 20K 4D radar, 350K boxes | LiDAR + Camera + 4D Radar | V2I | First cooperative 4D radar dataset; rain/night scenarios |
| **V2X-R** | CVPR 2025 | Simulated | 12,079 scenarios, 37,727 frames, 170,859 boxes | LiDAR + Camera + 4D Radar | V2X | Simulated V2X with 4D radar and denoising diffusion |
| **V2XPnP Sequential** | ICCV 2025 | Real-world | 40K LiDAR, 208K camera, 24 intersections | LiDAR + Camera | VC, IC, V2V, I2I | First sequential multi-agent V2X dataset with trajectories |

**DAIR-V2X Detail**: Collected at real Beijing intersections with vehicle-mounted and infrastructure-mounted LiDAR+camera pairs. Introduced the VIC3D task (Vehicle-Infrastructure Cooperative 3D Object Detection), which explicitly models temporal asynchrony and transmission cost. The Time Compensation Late Fusion (TCLF) baseline demonstrates that even simple cooperation yields 15% AP improvement.

**V2V4Real Detail**: Two vehicles equipped with LiDAR and cameras drove 410 km together through diverse road types (intersections, highway ramps, city roads). Introduced cooperative 3D tracking and Sim2Real domain adaptation benchmarks. GitHub: `ucla-mobility/V2V4Real`.

**Airport relevance**: No cooperative perception dataset exists for airport airside environments. This represents both a gap and an opportunity -- the first airside cooperative perception dataset would be a landmark contribution. The TUMTraf-V2X infrastructure setup (poles with LiDAR+camera at intersections) is the closest analog to what an airport deployment would look like.

### 2.2 Core Cooperative Perception Models (2021-2023)

#### DiscoNet -- Distilled Collaboration (NeurIPS 2021)

| Aspect | Detail |
|--------|--------|
| **Paper** | "Learning Distilled Collaboration Graph for Multi-Agent Perception" |
| **Key idea** | Teacher-student knowledge distillation for cooperative perception |
| **Teacher** | Early fusion with holistic-view inputs (upper bound) |
| **Student** | Intermediate fusion with single-view inputs (practical model) |
| **Innovation** | Matrix-valued edge weights in DiscoGraph -- each element reflects inter-agent attention at a specific spatial region |
| **Compression** | 1x1 convolutional autoencoder compresses features along channel dimension |
| **Result** | Better performance-bandwidth trade-off than prior methods |
| **GitHub** | `ai4ce/DiscoNet` |

**Airside relevance**: The teacher-student paradigm is directly applicable -- the "teacher" could be the full infrastructure perception view (what the airport sees from all cameras/LiDARs), and the "student" learns to replicate this from vehicle-only sensors. This enables training vehicles to approximate infrastructure-level perception even when infrastructure is unavailable.

#### V2X-ViT -- Vision Transformer for V2X (ECCV 2022)

| Aspect | Detail |
|--------|--------|
| **Paper** | "V2X-ViT: Vehicle-to-Everything Cooperative Perception with Vision Transformer" |
| **Key idea** | Unified Transformer architecture handling heterogeneous V2X agents |
| **Architecture** | Alternating layers of heterogeneous multi-agent self-attention and multi-scale window self-attention |
| **Innovation** | Handles asynchronous information, pose errors, and vehicle/infrastructure heterogeneity in a single architecture |
| **Result** | Outperforms SOTA intermediate fusion by 3.8%/1.7% AP@0.5/0.7; exceeds ideal early fusion by 0.2% AP@0.7 |
| **Robustness** | Under noise (pose error + time delay), prior methods degrade 15-21% AP@0.7; V2X-ViT degrades significantly less |
| **GitHub** | `DerrickXuNu/v2x-vit` |

**Airside relevance**: The ability to handle heterogeneous agents (vehicles vs. infrastructure with different sensor suites and viewpoints) is exactly what an airport system needs -- pole-mounted LiDAR/cameras have fundamentally different perspectives than vehicle-mounted sensors.

#### Where2comm -- Communication-Efficient Perception (NeurIPS 2022)

| Aspect | Detail |
|--------|--------|
| **Paper** | "Where2comm: Communication-Efficient Collaborative Perception via Spatial Confidence Maps" |
| **Key idea** | Only share features for perceptually critical regions, not entire feature maps |
| **Mechanism** | Each agent generates spatial confidence maps identifying critical areas; only non-zero features + indices transmitted |
| **Innovation** | Joint optimization of agent selection and information selection via sparse communication graphs |
| **Result** | Dramatically reduced bandwidth while maintaining perception accuracy |
| **Why it matters** | Directly addresses the bandwidth constraint of V2X communication |

**Airside relevance**: At an aircraft stand, the "critical regions" are the areas around the aircraft doors, the belt loader positions, and the paths where ground crew walk. Where2comm could adaptively focus infrastructure bandwidth on these operationally critical zones.

#### CoBEVT -- Cooperative BEV Transformer (CoRL 2022)

| Aspect | Detail |
|--------|--------|
| **Paper** | "CoBEVT: Cooperative Bird's Eye View Semantic Segmentation with Sparse Transformers" |
| **Key idea** | Axial-attention-based multi-agent perception in BEV space |
| **Architecture** | Sparse attention captures long-range spatial dependencies from multiple camera viewpoints |
| **Modality** | Camera-based (BEV segmentation), not LiDAR |
| **Innovation** | Generalizes to both cooperative BEV segmentation and 3D object detection |
| **GitHub** | Part of OpenCOOD |

#### CoAlign -- Alignment-Robust Perception (ICRA 2023)

| Aspect | Detail |
|--------|--------|
| **Paper** | "Robust Collaborative 3D Object Detection in Presence of Pose Errors" |
| **Key idea** | Agent-Object Pose Graph Optimization for pose consistency |
| **Problem solved** | Pose estimation errors from imperfect localization cause spatial misalignment in cooperative fusion |
| **Innovation** | Does NOT require ground-truth pose for training -- fully self-supervised alignment |
| **Method** | Multi-scale data fusion + pose graph optimization using detected objects as landmarks |
| **Result** | Significantly reduces relative localization error; SOTA detection under pose noise |
| **GitHub** | `yifanlu0227/CoAlign` |

**Airside relevance**: Critical for airport deployment -- even with RTK-GPS, there will be pose errors between vehicle and infrastructure coordinate frames. CoAlign's self-supervised approach means the system can maintain calibration without manual intervention.

#### FFNet -- Feature Flow (NeurIPS 2023)

| Aspect | Detail |
|--------|--------|
| **Paper** | "Flow-Based Feature Fusion for Vehicle-Infrastructure Cooperative 3D Object Detection" |
| **Key idea** | Transmit feature flow (temporal deltas) instead of full feature maps |
| **Problem solved** | Temporal asynchrony between vehicle and infrastructure sensors + bandwidth constraints |
| **Innovation** | Self-supervised feature flow prediction from raw infrastructure sequences; predicts future features to compensate for communication delay |
| **Result** | 62.87% mAP@BEV at ~1/100 transmission cost of early fusion |
| **Robustness** | Maintains performance across 100-500 ms latency range with a single model |
| **GitHub** | `haibao-yu/FFNet-VIC3D` |

**Airside relevance**: FFNet's robustness to latency variation (100-500 ms) is highly relevant -- airport private 5G should deliver <20 ms latency, but network congestion during peak operations could cause spikes. FFNet handles this gracefully.

### 2.3 2024 Advances

#### TUMTraf CoopDet3D (CVPR 2024)

First cooperative detection model validated on real-world multi-sensor V2X data. Achieves +14.36 3D mAP improvement with roadside sensors vs. vehicle-only. Uses camera-LiDAR fusion across infrastructure and vehicle nodes with 5 roadside and 4 onboard sensors.

#### V2X-Real Benchmarks (ECCV 2024)

The most comprehensive real-world V2X dataset, providing benchmarks across all collaboration modes (VC, IC, V2V, I2I). Demonstrates that infrastructure-centric perception often outperforms vehicle-centric in urban environments with high occlusion.

### 2.4 2025-2026 Frontier Research

#### V2XPnP (ICCV 2025)

| Aspect | Detail |
|--------|--------|
| **Full name** | Vehicle-to-Everything Spatio-Temporal Fusion for Multi-Agent Perception and Prediction |
| **Key advance** | First end-to-end framework combining cooperative perception AND prediction |
| **Architecture** | Unified Transformer modeling spatio-temporal relationships across agents, frames, and HD maps |
| **Dataset** | V2XPnP Sequential -- first real-world V2X sequential dataset (40K LiDAR, 208K camera, 24 intersections) |
| **Benchmarks** | Comprehensive comparison of 11 fusion models across early/late/intermediate and one-step/multi-step communication |

#### CooPre -- Cooperative Pretraining (IROS 2025, Oral)

| Aspect | Detail |
|--------|--------|
| **Key advance** | Self-supervised pretraining for cooperative perception using unlabeled V2X data |
| **Method** | Pretrain 3D encoder via LiDAR point cloud reconstruction from multi-agent data |
| **Result** | +4% mAP on V2X-Real; matches baseline performance using only 50% labeled data |
| **Transfer** | Demonstrates cross-domain transferability between datasets |
| **GitHub** | `ucla-mobility/CooPre` |

**Airside relevance**: CooPre's ability to pretrain on unlabeled data is critical -- there is no labeled airside cooperative perception dataset. A system could be pretrained on road V2X data (DAIR-V2X, V2X-Real) and fine-tuned on unlabeled airport data.

#### CoMamba (IROS 2025)

| Aspect | Detail |
|--------|--------|
| **Key advance** | First linear-complexity model for cooperative perception (replaces quadratic attention) |
| **Architecture** | Bidirectional state space models (Mamba) for cooperative 3D detection |
| **Modules** | Cooperative 2D-Selective-Scan + Global-wise Pooling |
| **Benefit** | Linear GFLOPs, latency, and GPU memory vs. number of agents |
| **Why it matters** | Scales efficiently as agent count grows -- relevant for airport with many infrastructure nodes |

#### V2X-R (CVPR 2025)

First cooperative perception framework with 4D radar. Uses denoising diffusion to handle radar noise. Directly relevant to airside where 4D radar is preferred for weather immunity (rain, fog, de-icing spray, jet exhaust).

#### V2X-Radar (NeurIPS 2025, Spotlight)

First real-world cooperative dataset with 4D radar + LiDAR + camera. Covers rain, nighttime, and dusk scenarios. Demonstrates that 4D radar significantly improves cooperative detection in adverse weather.

#### RCP-Bench (CVPR 2025)

| Aspect | Detail |
|--------|--------|
| **Key advance** | First comprehensive robustness benchmark for collaborative perception |
| **Datasets** | OPV2V-C, V2XSet-C, DAIR-V2X-C with 14 types of camera corruption |
| **Scenarios** | Global interference, ego interference, CAV-only interference |
| **Finding** | Current SOTA models degrade significantly under real-world corruptions |
| **Proposed fix** | RCP-Drop (training regularization) and RCP-Mix (feature augmentation) improve robustness |
| **GitHub** | `LuckyDush/RCP-Bench` |

**Airside relevance**: Airport environments have specific corruption modes not well-studied: jet exhaust heat shimmer, de-icing spray, night operations with bright ramp lighting, and reflections from wet tarmac. RCP-Bench's methodology should be extended to these airport-specific corruptions.

#### QuantV2X (2025)

| Aspect | Detail |
|--------|--------|
| **Key advance** | First fully quantized multi-agent system for cooperative perception |
| **Method** | End-to-end quantization of both neural networks and transmitted messages; codebook-based feature compression |
| **Result** | 3.2x system latency reduction; +9.5 mAP30 improvement over FP32 baselines under deployment constraints |
| **Significance** | Makes cooperative perception deployable on edge hardware (NVIDIA Orin) |
| **GitHub** | `ucla-mobility/QuantV2X` |

**Airside relevance**: Running cooperative perception on NVIDIA Orin (Aurrigo's target compute platform) requires quantization. QuantV2X demonstrates this is achievable with minimal accuracy loss.

### 2.5 Open-Source Frameworks and Repos

| Repository | Description | Stars | Status |
|------------|-------------|-------|--------|
| **OpenCOOD** (`DerrickXuNu/OpenCOOD`) | Official cooperative detection framework; OPV2V implementation; supports 16+ models | ~1.2K | Active, foundation for most papers |
| **V2X-ViT** (`DerrickXuNu/v2x-vit`) | Official ECCV 2022 implementation | ~400 | Stable |
| **CoAlign** (`yifanlu0227/CoAlign`) | Robust collaborative detection with pose correction | ~300 | Active |
| **DiscoNet** (`ai4ce/DiscoNet`) | Knowledge distillation for cooperative perception | ~200 | Stable |
| **FFNet** (`haibao-yu/FFNet-VIC3D`) | Feature flow for V2I cooperative detection | ~150 | Active |
| **DAIR-V2X** (`AIR-THU/DAIR-V2X`) | Dataset tools and benchmarks | ~800 | Active |
| **V2V4Real** (`ucla-mobility/V2V4Real`) | Real-world V2V dataset and benchmarks | ~200 | Active |
| **V2X-Real** (`ucla-mobility/V2X-Real`) | Comprehensive real-world V2X dataset | ~150 | Active |
| **CooPre** (`ucla-mobility/CooPre`) | Cooperative pretraining framework | New | Active |
| **QuantV2X** (`ucla-mobility/QuantV2X`) | Quantized cooperative perception | New | Active |
| **V2X-Radar** (`yanglei18/V2X-Radar`) | 4D radar cooperative perception | New | Active |
| **RCP-Bench** (`LuckyDush/RCP-Bench`) | Robustness benchmark for collaborative perception | New | Active |
| **Collaborative_Perception** (`Little-Podi/Collaborative_Perception`) | Comprehensive paper digest of all V2X perception research | ~500 | Actively maintained survey |

**UCLA Mobility Lab** (`ucla-mobility`) is the single most productive group in this space, responsible for OPV2V, V2V4Real, V2X-Real, V2XPnP, CooPre, and QuantV2X. They are based at UCLA under Prof. Jiaqi Ma.

---

## 3. Infrastructure Sensor Deployment

### 3.1 Roadside Perception Unit (RSPU) Architecture

A Roadside Perception Unit (RSPU) combines sensors, compute, and communication into a single pole-mounted or structure-mounted package:

```
RSPU Architecture:
  ├── Sensors
  │   ├── LiDAR (32-128 beam, 360-degree or sector scan)
  │   ├── Cameras (2-6 per node, covering different viewing angles)
  │   ├── 4D Radar (optional, for weather robustness)
  │   └── Environmental sensors (temperature, humidity, light level)
  ├── Edge Compute
  │   ├── GPU-accelerated SoC (NVIDIA Orin NX / Jetson AGX Orin)
  │   ├── Feature extraction pipeline (PointPillars/CenterPoint for LiDAR, BEV encoder for camera)
  │   ├── Object detection (local detections for late fusion fallback)
  │   └── Feature compression (for intermediate fusion transmission)
  ├── Communication
  │   ├── 5G/C-V2X radio (for vehicle communication)
  │   ├── Ethernet backhaul (fiber to edge server)
  │   └── Wi-Fi (maintenance access)
  └── Power
      ├── PoE++ (60-90W) or direct AC
      └── Optional battery backup (4-8 hours)
```

### 3.2 Sensor Configuration and Pole Design

**Typical Infrastructure Sensor Pole Configuration:**

| Component | Specification | Purpose |
|-----------|--------------|---------|
| Pole height | 6-10 m (typically 8 m for traffic; 5-6 m for airport stands) | Minimize occlusion, maximize coverage |
| LiDAR | 1x 32-128 beam (Ouster OS1/OS2, Hesai XT32/AT128, RoboSense RS-Ruby) | 3D point cloud for detection and tracking |
| Cameras | 2-4x 2-5 MP (FLIR/Basler industrial, or Hikvision for cost) | Semantic understanding, classification |
| Radar | 1x 4D imaging radar (Continental ARS548, Arbe Phoenix) | All-weather detection, velocity estimation |
| Compute | NVIDIA Jetson Orin NX (100 TOPS) or AGX Orin (275 TOPS) | Edge perception processing |
| Enclosure | IP67 weatherproof, -40 to +65C operating | Outdoor durability |
| Mounting | 200 mm pole clamp or custom bracket | Secure attachment |

**Coverage per node:**

- LiDAR (128-beam): Effective detection range 80-120 m radius, 360-degree
- Camera (5 MP): Effective detection range 50-150 m depending on lens, 60-120 degree FOV per camera
- 4D Radar: Effective range 200+ m, 120-degree azimuth

For airport stands: A single RSPU at 5-6 m height can cover one aircraft stand and the surrounding apron area (~100 m radius). Two RSPUs per stand provide redundancy and eliminate blind spots behind the aircraft fuselage.

**TUMTraf-V2X Configuration** (real-world reference):
- 5 roadside sensors at a single intersection
- Each with LiDAR + multi-view cameras
- Mounted on existing traffic infrastructure (poles, gantries)
- Connected via fiber to an edge server

**Cavnue I-94 Corridor Configuration** (real-world reference):
- Poles installed every 200 m along 3-mile corridor
- Equipped with radars, cameras, and wireless communication
- Connected to central digital twin

### 3.3 Coverage Planning and Placement Optimization

Optimal placement of infrastructure sensors is a non-trivial optimization problem. Research has formalized this as a chance-constrained stochastic simulation optimization problem:

**Objective**: Maximize detection coverage while minimizing number of infrastructure nodes.

**Constraints**:
- Minimum overlap between adjacent nodes (for handoff and redundancy)
- Maximum mounting height (structural and wind load limits)
- Line-of-sight requirements (no occlusion by permanent structures)
- Power and data connectivity availability

**Airport-specific placement strategy:**

```
Priority 1 -- Aircraft Stands:
  - 1-2 RSPUs per stand, mounted on terminal building or dedicated pole
  - Coverage: Aircraft fuselage perimeter, belt loader area, pushback zone
  - Why: Highest density of vehicles, crew, and occlusion sources

Priority 2 -- Taxiway Crossings:
  - 1 RSPU at each vehicle-aircraft crossing point
  - Coverage: Crossing zone + 50 m approach in each direction
  - Why: Highest-risk interaction point between vehicles and aircraft

Priority 3 -- Service Roads and Apron Corridors:
  - RSPUs every 150-200 m along main service roads
  - Coverage: Road surface + 30 m to each side
  - Why: High-speed vehicle movement, potential for collisions

Priority 4 -- Parking and Staging Areas:
  - 1-2 RSPUs covering vehicle staging/charging areas
  - Coverage: Entry/exit points and parking area
  - Why: Low-speed but high-density vehicle movements
```

### 3.4 Vehicle-Infrastructure Calibration

Aligning vehicle and infrastructure coordinate frames is a critical challenge:

**Initial Calibration:**
- Infrastructure sensors are surveyed to a fixed coordinate frame (airport grid / WGS84)
- Vehicle pose is obtained via RTK-GPS + IMU (Aurrigo uses GTSAM with GPU VGICP)
- The transformation `T_infra->vehicle = T_vehicle_pose^{-1} * T_infra_pose` aligns the frames

**Runtime Calibration Maintenance:**

| Method | Paper | Approach |
|--------|-------|----------|
| Object matching | CoAlign (ICRA 2023) | Use detected objects as shared landmarks for pose graph optimization |
| Point cloud registration | RoCo (ACM MM 2024) | Iterative ICP between infrastructure and vehicle point clouds |
| HD map grounding | FreeAlign | Use pre-mapped features (lane markings, curbs) as anchors |
| Feature correlation | SCOPE | Multi-scale feature interaction to compensate for misalignment |

**Airport advantage**: Airport aprons have many fixed reference points (stand markings, building corners, fixed equipment) that can serve as calibration anchors. The GTSAM localization already used by Aurrigo provides high-quality vehicle pose, making the calibration problem easier than on open roads.

### 3.5 Costs of Infrastructure Sensor Installation

**Per-node hardware costs (2025 estimates):**

| Component | Low-End | Mid-Range | High-End |
|-----------|---------|-----------|----------|
| LiDAR (32-beam) | $2,000 (Ouster OS0-32) | $5,000 (Hesai XT32) | $15,000 (128-beam) |
| Cameras (2-4x industrial) | $1,000 | $3,000 | $8,000 |
| 4D Radar | $500 | $1,500 | $3,000 |
| Edge compute (Orin NX) | $500 | $1,000 (AGX Orin) | $2,000 |
| Enclosure + mounting | $500 | $1,500 | $3,000 |
| 5G radio module | $300 | $800 | $1,500 |
| **Hardware subtotal** | **$4,800** | **$12,800** | **$32,500** |
| Installation + wiring | $3,000 | $8,000 | $15,000 |
| **Total per node** | **~$8,000** | **~$20,000** | **~$50,000** |

**Reference data points:**

| Source | Cost Figure |
|--------|------------|
| US DOT ITS Deployment Evaluation (2025) | RSU: $3,000-5,000 per unit; OBU: $2,000-3,000 per unit |
| US DOT intersection infrastructure average | $69,078 per signalized intersection (complete system) |
| CCTV camera (20-year DOT average, 2020 dollars) | $2,000-20,000 per camera |
| Fiber endpoint (remote location) | $50,000+ per endpoint |
| CBRS field router (DFW airport) | <$1,000 per router |

**Airport deployment cost model (estimate for 20-stand regional airport):**

| Item | Quantity | Unit Cost | Total |
|------|----------|-----------|-------|
| Stand-level RSPUs | 30 (1.5 per stand) | $20,000 | $600,000 |
| Taxiway crossing RSPUs | 8 | $20,000 | $160,000 |
| Service road RSPUs | 15 | $15,000 | $225,000 |
| Edge servers (per cluster of 8-10 RSPUs) | 6 | $25,000 | $150,000 |
| Fiber/network backbone | 1 | $200,000 | $200,000 |
| Software and integration | 1 | $300,000 | $300,000 |
| **Total infrastructure** | | | **~$1.6M** |

Compare with per-vehicle sensor cost reduction: If cooperative perception allows removing one LiDAR per vehicle ($5,000-15,000 savings), a 30-vehicle fleet saves $150,000-450,000 in vehicle sensor costs. The infrastructure investment pays back through fleet cost reduction, improved safety, and operational efficiency (fewer incidents, faster turnarounds).

### 3.6 Companies: Derq, Miovision, Cavnue, and Others

#### Derq

| Aspect | Detail |
|--------|--------|
| **Founded** | 2017 (Dubai/Detroit) |
| **Product** | INSIGHT -- real-time AI intersection analytics and traffic safety platform |
| **Technology** | AI analysis of roadside camera and radar feeds; real-time near-miss detection |
| **Deployments** | US, Canada, GCC region; 20+ patents |
| **Detroit** | 5 years of continuous INSIGHT deployment for roadway safety monitoring |
| **Sarasota, FL** | 33% crash reduction year-over-year; one intersection: 90% reduction |
| **2026 update** | Next-gen INSIGHT with agentic AI (natural language queries of road data); unveiled at Intertraffic 2026 |
| **Airside relevance** | Near-miss detection and safety analytics could be applied to airside vehicle-crew conflicts |

#### Miovision

| Aspect | Detail |
|--------|--------|
| **Founded** | 2005 (Kitchener, Canada) |
| **Product** | SmartView -- HD camera + AI software for intersection detection and adaptive signal control |
| **Technology** | Computer vision with AI-driven image processing; advance detection up to 500 ft (150 m) |
| **Deployments** | Detroit (600+ intersections upgraded); numerous North American cities |
| **2026 update** | Generative AI agent for traffic engineering -- natural language queries about congestion, near-misses, response times |
| **Acquisitions** | 7 acquisitions as of April 2025 (building integrated platform) |
| **Airside relevance** | Camera-based detection at intersections translates to stand-level activity monitoring |

#### Cavnue

| Aspect | Detail |
|--------|--------|
| **Founded** | 2020 (Ann Arbor, MI, subsidiary of Sidewalk Infrastructure Partners) |
| **Product** | Smart road infrastructure -- poles with sensors, radars, and wireless communication |
| **Flagship project** | I-94 Connected and Automated Vehicle (CAV) Corridor, Michigan |
| **Scale** | 3-mile initial deployment (completed May 2024); planned 39-mile full corridor (Ann Arbor to Detroit) |
| **Infrastructure** | Poles every 200 m with radars, cameras, wireless radio; connected to digital twin |
| **Partners** | Ford, GM, Honda, Hyundai, Toyota, May Mobility, Motional, Stellantis, and others |
| **Capabilities** | Real-time hazard notifications (debris, stalled vehicles); V2X communication |
| **Airside relevance** | Cavnue's "smart corridor" model directly maps to airport taxiway/service road instrumentation |

#### Other Relevant Companies

| Company | Product/Focus | Airside Relevance |
|---------|--------------|-------------------|
| **Ouster** | Digital LiDAR for traffic/ITS (OS series); BlueCity platform partnership | Infrastructure LiDAR for intersections; directly applicable to airside |
| **AEye** | Software-defined LiDAR for smart intersections | Adaptive scan patterns for detecting specific objects |
| **Seyond (formerly Innovusion)** | Infrastructure LiDAR with TCO calculator | Cost optimization for multi-node deployments |
| **Cepton** | Infrastructure LiDAR for highway and intersection monitoring | Long-range detection for taxiway approaches |
| **Outsight** | 3D Spatial AI software for LiDAR data processing | Deployed at DFW Airport for people/vehicle flow monitoring |
| **Blickfeld** | Airport-specific LiDAR security and monitoring | Deployed at Kassel Airport for runway transition monitoring; Percept software for detection/classification |
| **Dallmeier** | Panomera multifocal cameras for airport aprons | Covers large areas (runways, aprons) with few camera systems; feeds to turnaround analysis providers |
| **Assaia** | ApronAI -- camera-based turnaround monitoring | 21 airports, 450K+ turnarounds; camera-based event detection at stands |
| **ADB SAFEGATE** | AiPRON -- integrated apron management including FOD detection | Cameras + radar for continuous automated FOD detection on aprons |

---

## 4. Airport-Specific Infrastructure Perception

### 4.1 Existing Airport Surveillance Systems

Airports already have extensive surveillance infrastructure that can serve as inputs to cooperative perception:

| System | Technology | Coverage | Update Rate | Data Output |
|--------|-----------|----------|-------------|-------------|
| **Surface Movement Radar (SMR)** | Primary radar (X-band) | Entire movement area | 1 Hz (1 revolution/sec) | Range/azimuth targets |
| **MLAT** (Multilateration) | TDOA from Mode S/ADS-B transponders | Movement area + approaches | 1-4 Hz | Position, identity, velocity |
| **ADS-B** (ground stations) | 1090 MHz Extended Squitter | Movement area + airspace | 1-2 Hz (surface), up to 6 Hz (airborne) | GPS position, altitude, velocity, identity |
| **A-SMGCS** | Fusion of SMR + MLAT + ADS-B | Full surveillance, routing, guidance | Composite 1-4 Hz | Tracks with identity, route assignment |
| **CCTV** | IP cameras (thousands per airport) | Terminals, stands, aprons, perimeter | 25-30 fps | Video streams (increasingly with AI analytics) |
| **Ground radar (vehicle)** | Secondary radar on vehicles (limited) | Vehicle-specific | Variable | Vehicle position |

**A-SMGCS Market (2025-2026)**: The global A-SMGCS market reached $5.58 billion in 2025, growing to $5.93 billion in 2026 (6.3% CAGR). ~50% of current installations focus on multi-sensor data fusion. New Level 4 deployments (e.g., Navi Mumbai International with ADB SAFEGATE Airfield 4) integrate AI for predictive routing.

### 4.2 A-SMGCS as Cooperative Perception Input

A-SMGCS already performs multi-sensor fusion for surface surveillance. The system outputs fused tracks of all aircraft and equipped vehicles on the movement area. Feeding A-SMGCS track data into an autonomous vehicle's perception stack provides:

```
A-SMGCS Track Data (per target):
  ├── Position (lat/lon, accuracy ~3-7 m for SMR, ~1-3 m for MLAT)
  ├── Velocity (ground speed, heading)
  ├── Identity (callsign, Mode S address, squawk code)
  ├── Classification (aircraft, vehicle, unknown)
  ├── Route assignment (for aircraft with routing clearance)
  └── Conflict alerts (if system detects conflict)
```

**Integration approach for Aurrigo:**

1. **Data feed**: A-SMGCS outputs are available via ASTERIX Cat. 10/20/62 format over network
2. **ROS bridge**: An `a_smgcs_bridge` ROS node subscribes to ASTERIX feed, publishes as custom `AircraftTrack` messages
3. **Track fusion**: A-SMGCS tracks are fused with vehicle's own detections in the planner's world model
4. **Safety layer**: A-SMGCS conflict alerts trigger immediate yield/stop behavior

**Limitation**: A-SMGCS accuracy (3-7 m for SMR) is too coarse for close-range cooperative perception. It is best used as a long-range "early warning" layer, with infrastructure LiDAR/camera providing precise detection within 100 m.

### 4.3 Airport CCTV for Perception

Major airports deploy thousands of IP cameras. These existing cameras can serve as infrastructure perception inputs:

**Scale of existing deployment:**
- Large hub airport: 5,000-15,000+ cameras
- Medium airport: 1,000-5,000 cameras
- Many cover stands, aprons, and taxiways

**Current AI analytics on airport CCTV:**

| Vendor | Capability | Airports |
|--------|-----------|----------|
| **Assaia ApronAI** | Real-time turnaround event detection from stand cameras; predicts POBT/PRDT | 21 airports, 450K+ turnarounds |
| **Dallmeier** | Panomera multifocal sensor covers entire apron with few systems; tracks all turnaround events | Multiple airports |
| **Hikvision** | AI-powered airport solutions for stand monitoring, access control, perimeter | Extensive global deployment |
| **Pelco** | Airport-specific surveillance with analytics | North American airports |

**How CCTV feeds into cooperative perception:**

The key challenge is that existing CCTV cameras are typically 2D (no depth) and positioned for security viewing angles (elevated, wide-angle) rather than optimal 3D perception. However:

1. **Monocular depth estimation** (MonoDepth2, MiDaS) can extract approximate depth from single camera images
2. **Multi-camera triangulation**: Overlapping camera views at stands allow 3D reconstruction
3. **Camera-LiDAR fusion**: Adding infrastructure LiDAR to existing camera coverage creates a rich 3D perception system at minimal marginal cost
4. **Transfer learning**: Assaia/Dallmeier have already trained models to detect GSE types, crew, and aircraft components from stand cameras -- these detections can be shared as late-fusion inputs

**Practical recommendation**: Use existing CCTV as a late-fusion input (sharing detected object bounding boxes), and add dedicated infrastructure LiDAR at critical stands for intermediate-fusion cooperative perception.

### 4.4 ADS-B as Cooperative Perception for Aircraft

ADS-B is effectively a built-in cooperative perception system for aircraft. Every aircraft broadcasts its position, velocity, and identity. For autonomous airside vehicles, ADS-B provides:

**Surface-specific ADS-B (Type Codes 5-8):**
- Position accuracy: ~7.5 m (NACp 8) to ~3 m (NACp 10) for GPS-equipped aircraft
- Update rate: 1-2 Hz for surface position messages
- Velocity: Ground speed and heading from surface velocity messages
- Identity: Callsign, ICAO hex, squawk -- correlatable with AODB flight data

**Integration architecture** (detailed in `70-operations-domains/airside/operations/airport-data-integration.md`):
- RTL-SDR receiver ($20-25) or FlightAware Pro Stick on vehicle roof
- `readsb` decoder outputting Beast binary protocol
- Custom ROS node publishing `AircraftTrack` messages
- Planner uses aircraft tracks for yield decisions at taxiway crossings

**Limitation**: ADS-B does not detect vehicles, crew, or non-transponder-equipped objects. It is a single-class cooperative perception input (aircraft only).

### 4.5 Stand-Level Sensing

Aircraft stands are the highest-value location for infrastructure perception. A stand-level sensing system detects:

| Detection Target | Sensor | Relevance |
|-----------------|--------|-----------|
| Aircraft presence/absence | LiDAR, camera, ADS-B | Gate occupancy, turnaround timing |
| Aircraft type/size | Camera (classification model) | GSE positioning, clearance envelopes |
| Jet bridge position | LiDAR, camera | Safe zone definition |
| Belt loader position | LiDAR, camera | Dynamic obstacle for tug path planning |
| Ground crew presence | LiDAR (pedestrian detection), camera | Safety-critical -- crew protection |
| GSE positions | LiDAR, camera | Deconfliction, sequencing |
| FOD (Foreign Object Debris) | Camera + radar (ADB SAFEGATE AiPRON) | Safety, runway/apron clearance |
| Pushback zone clearance | LiDAR | Autonomous pushback safety |

**Assaia ApronAI as stand-level sensing reference:**
- Cameras at each stand capture turnaround events in real time
- AI detects: aircraft arrival, chocks on/off, bridge connect/disconnect, doors open/close, GSE arrival/departure, fueling start/stop, catering, cleaning, boarding, pushback
- Timing accuracy: seconds-level for each event
- Currently used for analytics/reporting -- could be extended to feed autonomous vehicle perception

**Proposed stand-level RSPU configuration:**

```
Stand RSPU (per aircraft stand):
  Pole 1 (near terminal, 5m height):
    ├── 1x 64-beam LiDAR (forward-facing hemisphere toward aircraft)
    ├── 2x 5MP cameras (wide-angle, covering aircraft and apron approach)
    └── 1x 4D radar (all-weather backup)
  
  Pole 2 (opposite side, if no terminal wall):
    ├── 1x 32-beam LiDAR (covering areas occluded by aircraft from Pole 1)
    └── 2x 5MP cameras (covering pushback zone and service road approach)
  
  Edge compute: 1x Orin NX per stand (shared between poles)
  Communication: Fiber to edge server + 5G to vehicles
```

### 4.6 Airport LiDAR Deployments

Several airports have already deployed infrastructure LiDAR:

| Airport | Vendor | Application | Details |
|---------|--------|-------------|---------|
| **DFW (Dallas)** | Outsight | People and vehicle flow monitoring | LiDAR-based platform for real-time airside monitoring |
| **Kassel (Germany)** | Blickfeld | Runway transition zone monitoring | Blickfeld Cube 1 LiDAR detecting unauthorized access; data processed by Percept software |
| **Vancouver (YVR)** | Quanergy (now acquired) | Passenger flow in terminal | LiDAR for anonymous passenger counting and flow optimization |
| **Multiple airports** | Blickfeld | Ramp/apron security | 3D LiDAR surveillance of parking, ramp, and apron areas |

**Outsight at DFW**: Awarded a major contract to deploy LiDAR-based 3D Spatial AI across DFW Airport. The system detects, classifies, and counts people and vehicle movements in real-time using point cloud data processed by Outsight's software. This represents the most advanced airport infrastructure LiDAR deployment currently operational.

**Blickfeld at airports**: Point cloud data from Blickfeld LiDARs is transmitted to the airport's IT system in real-time, where Percept software digests and interprets the data for detection, classification, and counting. Key advantage: privacy-preserving (no PII in point clouds, unlike camera images).

### 4.7 Architecture: Airside Cooperative Perception Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AIRSIDE COOPERATIVE PERCEPTION                     │
├──────────────────────────┬──────────────────────────────────────────┤
│   INFRASTRUCTURE SIDE    │           VEHICLE SIDE                    │
│                          │                                          │
│  Stand RSPUs (per stand) │  Aurrigo AV Sensors                      │
│  ├── LiDAR (64/128 beam) │  ├── 4-8x RoboSense LiDAR              │
│  ├── Cameras (2-4x)     │  ├── Cameras (if added)                  │
│  ├── 4D Radar            │  ├── 4D Radar (Continental ARS548)       │
│  └── Edge compute (Orin) │  ├── IMU + RTK-GPS + Wheel odom         │
│          │               │  └── ADS-B receiver                      │
│          ▼               │          │                                │
│  Feature extraction      │  Feature extraction                      │
│  (PointPillars/BEV)      │  (PointPillars/CenterPoint)             │
│          │               │          │                                │
│          ▼               │          ▼                                │
│  Feature compression     │                                          │
│  (Where2comm / QuantV2X) │                                          │
│          │               │                                          │
├──────────┼───────────────┤                                          │
│          │   5G / Fiber  │                                          │
│          └───────────────┼──────────► Cooperative Fusion Module      │
│                          │           (V2X-ViT / CoAlign)            │
│                          │                  │                        │
│                          │                  ▼                        │
│                          │           Fused BEV Perception            │
│                          │           (360° + infrastructure view)    │
│                          │                  │                        │
│                          │                  ▼                        │
│                          │           Frenet Planner                  │
│                          │           (existing Aurrigo)              │
├──────────────────────────┴──────────────────────────────────────────┤
│                      LONG-RANGE AWARENESS                            │
│  A-SMGCS tracks (ASTERIX) ──► Aircraft/Vehicle track overlay        │
│  ADS-B (1090 MHz)        ──► Aircraft position/velocity             │
│  AODB (SWIM/API)         ──► Flight schedule, turnaround status     │
│  A-CDM milestones        ──► TOBT, TSAT, stand allocation           │
└─────────────────────────────────────────────────────────────────────┘
```

**Fusion strategy by range:**

| Range | Source | Fusion Type | Latency Tolerance |
|-------|--------|-------------|-------------------|
| 0-10 m | Vehicle onboard sensors only | N/A (local) | N/A |
| 10-100 m | Vehicle + stand RSPU | Intermediate (BEV features) | <200 ms |
| 100-500 m | Vehicle + taxiway RSPUs | Late (object detections) | <500 ms |
| 500+ m | A-SMGCS + ADS-B tracks | Late (track-level) | <2 sec |

---

## 5. Communication Infrastructure

### 5.1 DSRC vs C-V2X: The Technology Decision

The V2X communication technology landscape has decisively shifted:

| Aspect | DSRC (IEEE 802.11p) | C-V2X (PC5 Direct) | 5G NR V2X |
|--------|-------------------|--------------------|-----------| 
| **Standard** | IEEE 802.11p / ETSI ITS-G5 | 3GPP Release 14-15 | 3GPP Release 16+ |
| **Frequency** | 5.9 GHz (being reallocated) | 5.9 GHz (PC5) | Sub-6 GHz + mmWave |
| **Range** | < 1 km | ~ 1 km (PC5) | Cellular range |
| **Throughput** | < 27 Mbps | ~ 20 Mbps (PC5) | > 1 Gbps |
| **Latency** | < 50 ms | 0.25 ms (measured) | < 1 ms (URLLC) |
| **Coverage** | Ad-hoc (needs RSUs) | Sidelink + network | Full cellular |
| **Status (2025)** | Being phased out; FCC reallocated 5.9 GHz spectrum | Production deployments | Early production |
| **Ecosystem** | Declining | Growing rapidly | Growing |
| **Cooperative perception support** | Late fusion only (bandwidth limited) | Intermediate fusion possible | Full early/intermediate fusion |

**The verdict**: DSRC is being deprioritized globally. The FCC reallocated the 5.9 GHz spectrum in 2024, designating C-V2X as the primary ITS technology. For new airport deployments, **C-V2X (with 5G NR V2X roadmap) is the clear choice**.

**Key data point**: C-V2X reduced latency by over 99% compared to DSRC in controlled testing (0.25 ms vs 50-55 ms transmission delay), and reduced traffic conflicts by 38% at 60% AV penetration.

### 5.2 5G/C-V2X for Infrastructure-to-Vehicle

For airport airside cooperative perception, the communication architecture should use:

**Primary path (high-bandwidth cooperative perception):**
- Private 5G (CBRS-based in US) from RSPU to vehicle
- URLLC mode for safety-critical data
- Supports intermediate fusion at 5-20 Mbps per node

**Backup path (degraded mode):**
- C-V2X PC5 direct sidelink (no network dependency)
- Late fusion only (< 1 Mbps)
- Operates even if 5G network fails

**Management path (non-real-time):**
- Standard 5G or WiFi 6
- Fleet management, OTA updates, telemetry upload

### 5.3 Latency Budget for Cooperative Perception

**End-to-end latency breakdown for airside cooperative perception:**

```
Infrastructure Sensor → Vehicle Planner Latency Budget (Target: <200 ms)

  Sensor capture + readout:          50 ms (LiDAR at 10-20 Hz)
  Infrastructure edge processing:     30 ms (feature extraction on Orin NX)
  Feature compression:                5 ms  (QuantV2X codebook encoding)
  5G transmission:                   10 ms  (private network, URLLC)
  Vehicle-side fusion:               20 ms  (V2X-ViT / cooperative fusion)
  ─────────────────────────────────────────
  Total:                            115 ms  (well within 200 ms budget)
  
  Safety margin:                     85 ms  (for network jitter, processing spikes)
```

**At 25 km/h (6.9 m/s):**
- 115 ms latency = 0.8 m of vehicle travel
- 200 ms latency = 1.4 m of vehicle travel
- Both well within braking distance at this speed (~5-10 m emergency stop)

**Research validation**: The LRCP framework (WACV 2025) demonstrates negligible cooperative perception performance reduction at latencies below 200 ms. FFNet maintains accuracy across 100-500 ms latency with a single model.

### 5.4 Edge Computing for Real-Time Fusion

Edge computing is essential for cooperative perception -- sending raw data to the cloud and back is too slow.

**Architecture options:**

| Architecture | Where Fusion Happens | Latency | Bandwidth Requirement | Resilience |
|-------------|---------------------|---------|----------------------|------------|
| **Vehicle-centric** | On vehicle Orin | Lowest (<150 ms) | Moderate (features sent to vehicle) | Best (vehicle independent if infra fails) |
| **Edge-centric** | On edge server near RSPUs | Low (<200 ms) | Low (fused result sent to vehicle) | Moderate (depends on edge server) |
| **Cloud-centric** | In airport data center | Higher (200-500 ms) | Highest (all data to cloud) | Lowest (depends on cloud + network) |

**Recommended for airside**: **Vehicle-centric fusion** with edge pre-processing.

- Each RSPU runs feature extraction on its Orin NX (edge pre-processing)
- Compressed features are transmitted to the vehicle via 5G
- Vehicle's Orin fuses infrastructure features with its own features
- If infrastructure link fails, vehicle operates on onboard sensors only (graceful degradation)

**Edge computing deployment at airports:**

| Component | Specification | Cost |
|-----------|--------------|------|
| Per-RSPU edge (Orin NX) | 100 TOPS, 15W | $500-1,000 |
| Cluster edge server (per 8-10 RSPUs) | 2x A100 or 4x Orin AGX, for multi-RSPU fusion | $15,000-25,000 |
| Airport MEC (Multi-access Edge Computing) | Co-located with 5G base station | Part of 5G deployment cost |

### 5.5 Airport 5G as Enabling Infrastructure

Private 5G/CBRS networks are being deployed at airports for broader operational purposes, and cooperative perception can ride on this infrastructure:

**Key deployments** (detailed in `20-av-platform/networking-connectivity/airport-5g-cbrs.md`):

| Airport | Network | Scale | Investment | Status |
|---------|---------|-------|------------|--------|
| DFW (Dallas) | AT&T + Nokia CBRS | 33 transmission sites, 200+ APs, 27 sq mi | $10M (5-year contract) | Operational |
| Changi (Singapore) | Private 5G | Supports autonomous tractors | Part of SATS/CAG investment | Operational |
| Purdue University Airport | Private 5G/CBRS | Flight coordination, drone detection, autonomous GSE | Research deployment | Active |

**DFW performance data:**
- Transaction speeds: 50-70% faster than public cellular
- Latency: "Much lower" than public cellular
- 40+ outdoor cameras operating solely on private wireless
- Cost: <$1,000 per field router vs. $50,000+ per fiber endpoint

**Why airport private 5G enables cooperative perception:**
1. **Guaranteed bandwidth**: No contention with public traffic
2. **Predictable latency**: URLLC can guarantee <10 ms
3. **Airport-wide coverage**: Already deployed for operational purposes
4. **Airport-controlled**: No dependency on public carrier
5. **Already justified**: 5G investment driven by broader operational needs (asset tracking, cameras, IoT); cooperative perception is an incremental use case

---

## 6. Challenges and Solutions

### 6.1 Sensor Calibration Drift

**Problem**: Infrastructure sensors drift over time due to thermal expansion, wind loading, vibration from aircraft engines, and physical impacts. Even small angular drift (0.1 degree) at a 6 m pole height creates ~10 cm of positional error at 50 m range.

**Airport-specific factors:**
- Jet blast causing pole vibration
- Thermal cycling (sun-baked tarmac during day, cold at night)
- Snow/ice loading on pole structures
- Physical contact from GSE or tow vehicles

**Solutions:**

| Approach | Method | Maintenance Burden |
|----------|--------|-------------------|
| **Scheduled recalibration** | Periodic survey with total station | High (manual, requires closure) |
| **Target-based auto-calibration** | Fixed calibration targets (checkerboards) in scene | Medium (targets must be maintained) |
| **Self-supervised online calibration** | CoAlign-style pose graph optimization using detected objects | Low (fully automated) |
| **Deep learning calibration** | RegNet / CalibNet: learn extrinsics from raw data | Low (requires retraining periodically) |
| **Map-based anchoring** | Use HD map features (lane markings, curbs) as fixed references | Low (works if map is accurate) |

**Recommendation for airside**: Use self-supervised online calibration (CoAlign approach) with map-based anchoring as the primary method, supplemented by scheduled verification during routine maintenance shutdowns. Airport aprons have many fixed reference features (stand markings, building edges, fixed equipment) that serve as reliable calibration anchors.

### 6.2 Asynchronous Sensor Data

**Problem**: Infrastructure and vehicle sensors are not time-synchronized. A LiDAR frame from an infrastructure pole may be 50-100 ms older than the vehicle's current LiDAR scan when it arrives. During this time, a vehicle at 25 km/h moves ~1.4-2.8 m and a taxiing aircraft moves ~2-5 m.

**Methods to handle asynchrony:**

| Method | Paper | Approach | Bandwidth |
|--------|-------|----------|-----------|
| **Time compensation** | DAIR-V2X TCLF | Adjust object positions by velocity * time_delta | Minimal |
| **Feature flow prediction** | FFNet (NeurIPS 2023) | Predict future infrastructure features from temporal sequence | ~1/100 of raw |
| **Latency-robust fusion** | LRCP (WACV 2025) | Learned compensation for variable latency | Standard |
| **Transformer temporal attention** | V2X-ViT (ECCV 2022) | Attention mechanism learns to weight features by temporal relevance | Standard |
| **Spatio-temporal Transformer** | V2XPnP (ICCV 2025) | Unified temporal modeling across agents and frames | Standard |

**Airport advantage**: The low speed regime (<25 km/h) significantly reduces the impact of asynchrony. At highway speeds (130 km/h), 100 ms of asynchrony means 3.6 m of positional error -- enough to miss a lane. At airside speeds, the same 100 ms means only 0.7 m of error, which is well within the size of the objects being detected (vehicles, aircraft, crew).

### 6.3 Occlusion Handling (The Main Benefit)

Occlusion resolution is the primary value proposition of infrastructure-cooperative perception. On airport aprons, the dominant occlusion sources are:

| Occlusion Source | What is Occluded | How Infrastructure Helps |
|-----------------|------------------|--------------------------|
| Aircraft fuselage | Ground crew and GSE on opposite side | Pole-mounted LiDAR/camera sees over/around aircraft |
| Belt loader | Crew behind loader, approaching tug | Elevated camera sees from above |
| Container/ULD stacks | Vehicles behind cargo | Side-mounted infrastructure sensor provides different angle |
| Other GSE vehicles | Smaller vehicles (follow-me, crew transport) | Overhead view from infrastructure resolves inter-vehicle occlusion |
| Building corners | Vehicles approaching from service roads | Infrastructure sensor pre-positioned at corner |

**Quantified benefit from research:**

| Dataset | Single Vehicle AP | Cooperative AP | Improvement |
|---------|------------------|----------------|-------------|
| DAIR-V2X (late fusion) | Baseline | +15% AP | +15% absolute |
| TUMTraf-V2X (CoopDet3D) | Baseline | +14.36 mAP | +14.36 absolute |
| OPV2V (V2X-ViT) | Baseline | +3.8% AP@0.5 | Over previous SOTA intermediate fusion |

These improvements are measured at road intersections. **Airport aprons likely show even larger improvements** because:
1. Occlusion density is higher (many large objects clustered at stands)
2. The threat objects (crew members) are smaller and harder to detect
3. Vehicle speed is lower, giving more time to benefit from extended perception

### 6.4 Cybersecurity of V2I Links

**Threat model for airside cooperative perception:**

| Attack Type | Method | Impact | Mitigation |
|-------------|--------|--------|------------|
| **Data fabrication** | Inject fake objects into infrastructure perception feed | Vehicle stops/swerves unnecessarily or ignores real threats | Anomaly detection (CAD), cross-validation with onboard sensors |
| **Replay attack** | Retransmit old infrastructure data | Vehicle acts on stale information | Timestamped + signed messages, sequence numbers |
| **Denial of service** | Jam 5G/C-V2X communication | Vehicle loses cooperative perception (falls back to onboard only) | Graceful degradation design; onboard sensors sufficient for safe stop |
| **Spoofing** | Impersonate infrastructure node | Inject malicious perception data | PKI-based authentication (SCMS), mutual TLS |
| **Man-in-the-middle** | Intercept and modify transmitted features | Subtly alter perception to cause wrong decisions | End-to-end encryption (AES-256-GCM), authenticated features |
| **Feature-level adversarial** | Craft adversarial perturbations in transmitted features | Cause missed detections | "Pretend Benign" defense (ICCV 2025), attention-based anomaly detection |

**Key research:**
- "On Data Fabrication in Collaborative Vehicular Perception" (USENIX Security 2023) -- demonstrates real-time data fabrication attacks
- "From Threat to Trust: Exploiting Attention Mechanisms for Attacks and Defenses" (USENIX Security 2025) -- attention-based attack and defense
- "Pretend Benign" (ICCV 2025) -- stealthy adversarial attack exploiting cooperative perception vulnerabilities
- Collaborative Anomaly Detection (CAD) -- detect fabricated data by cross-checking with other agents

**Airport advantage**: The closed, controlled network environment of an airport private 5G significantly reduces the attack surface compared to public road V2X. Infrastructure nodes are physically secured, the network is isolated, and all participants are known and authenticated.

**Recommendation**: See `60-safety-validation/cybersecurity/cybersecurity-airside-av.md` for the comprehensive cybersecurity framework. For cooperative perception specifically:
1. PKI-based mutual authentication between all infrastructure nodes and vehicles
2. End-to-end encryption of transmitted features
3. Cross-validation of infrastructure detections against onboard perception
4. Anomaly detection on received features (statistical bounds checking)
5. Graceful degradation to onboard-only perception if anomalies detected

### 6.5 Infrastructure Failure Modes and Graceful Degradation

**Failure modes:**

| Failure | Probability | Impact | Detection | Response |
|---------|------------|--------|-----------|----------|
| Single RSPU sensor failure (LiDAR/camera) | Medium | Reduced coverage at one stand | Self-diagnostics, missing heartbeat | Switch to remaining sensors on same node; alert maintenance |
| RSPU compute failure | Medium | No features from that node | Missing heartbeat | Fall back to late fusion from neighboring nodes |
| 5G link failure (single vehicle) | Medium | Vehicle loses cooperative input | Connection timeout | Fall back to onboard-only perception; reduce speed |
| 5G network failure (airport-wide) | Low | All vehicles lose cooperative input | Network monitor | All vehicles fall back to onboard-only; fleet speed reduction |
| Edge server failure | Low | Cluster of RSPUs loses coordination | Server health monitoring | RSPUs switch to direct vehicle transmission (bypass server) |
| Power failure (RSPU) | Low-Medium | Node goes dark | Battery backup alarm | Battery sustains 4-8 hours; maintenance dispatched |

**Critical design principle**: **The vehicle must always be able to operate safely on onboard sensors alone.** Infrastructure-cooperative perception is an enhancement, not a dependency. This is the Simplex architecture principle (see `synthesis/design-spec.md`):

```
Simplex Architecture for Cooperative Perception:
  
  High-Performance Controller (HPC):
    Uses cooperative perception (infrastructure + onboard fusion)
    Optimizes for throughput, efficiency, and speed
  
  Safety Controller (SC):
    Uses onboard sensors ONLY
    Conservative speed limits, larger safety margins
    Certified to safety standard (ISO 3691-4)
  
  Decision Module (DM):
    Monitors HPC and SC in real-time
    If HPC output is inconsistent with SC, switches to SC
    If infrastructure link fails, switches to SC
    
  Result: Vehicle operates at full capability when infrastructure is available,
  but can always fall back to safe onboard-only operation.
```

### 6.6 Heterogeneous Agent Fusion

**Problem**: Infrastructure and vehicle sensors differ fundamentally:

| Aspect | Infrastructure | Vehicle |
|--------|---------------|---------|
| Viewpoint | Elevated (5-8 m), fixed | Ground level (1-2 m), moving |
| Sensor suite | May differ from vehicle | Vehicle-specific |
| Feature space | Trained on top-down views | Trained on forward-facing views |
| Coordinate frame | Fixed (surveyed) | Moving (GPS/IMU) |
| LiDAR pattern | Different density distribution | Different density distribution |

**Solutions:**

| Method | Approach |
|--------|----------|
| V2X-ViT heterogeneous attention | Learns different attention weights for vehicle vs. infrastructure features |
| Domain adaptation | Train adapter networks to align infrastructure and vehicle feature spaces |
| BEV as common representation | Both infrastructure and vehicle project into shared BEV space for fusion |
| QuantV2X codebook | Shared codebook ensures compatible feature representations across agents |

The BEV representation is the standard solution -- both infrastructure and vehicle perception pipelines produce BEV (Bird's Eye View) feature maps in a common coordinate frame, which can then be fused regardless of the original viewpoint difference.

---

## 7. Airside Cooperative Perception Architecture

### 7.1 Proposed System Design

For Aurrigo's airport autonomous vehicle operations, the recommended cooperative perception system has three tiers:

**Tier 1: Stand-Level Cooperative Perception (Highest Value)**
- 1-2 RSPUs per aircraft stand
- Intermediate fusion via 5G (V2X-ViT or CoAlign)
- Primary benefit: See around aircraft fuselage, detect crew behind GSE
- Fusion on vehicle Orin

**Tier 2: Taxiway/Service Road Infrastructure (Moderate Value)**
- RSPUs at taxiway crossings and service road junctions
- Late fusion (object detections) via 5G or C-V2X
- Primary benefit: Early warning of approaching aircraft, vehicle deconfliction at blind corners

**Tier 3: Airport-Wide Awareness (Supplementary)**
- A-SMGCS track feed for aircraft awareness
- ADS-B for aircraft position/velocity
- AODB/A-CDM for flight schedule and turnaround status
- Late fusion / situational awareness layer

### 7.2 Phased Deployment Strategy

**Phase 1: Proof of Concept (3-6 months, ~$50K)**
- Deploy 2 RSPUs at a single aircraft stand
- Implement late fusion (share detected object lists) via WiFi
- Measure occlusion reduction and detection improvement
- No changes to vehicle safety system

**Phase 2: Intermediate Fusion Pilot (6-12 months, ~$200K)**
- Upgrade to intermediate fusion (BEV features) via private 5G
- Add CoAlign for self-supervised calibration maintenance
- Expand to 5 stands
- Quantify operational benefits (turnaround efficiency, safety margin reduction)

**Phase 3: Production Deployment (12-24 months, ~$1-2M)**
- Full deployment across all stands and key taxiway points
- QuantV2X for efficient edge deployment
- Integration with A-SMGCS and ADS-B for multi-tier awareness
- Simplex architecture for safety certification

**Phase 4: Optimization and Expansion (24+ months)**
- Where2comm-style adaptive bandwidth allocation
- CooPre-style self-supervised learning from accumulated unlabeled airport data
- Create and publish first airside cooperative perception dataset (research contribution)
- Extend to other airport sites

### 7.3 Cost Model for Airport Deployment

| Phase | Infrastructure Cost | Software/Integration | Annual OpEx | Total (Year 1) |
|-------|-------------------|---------------------|-------------|-----------------|
| Phase 1 (1 stand, 2 RSPUs) | $40,000 | $10,000 | $5,000 | $55,000 |
| Phase 2 (5 stands, 10 RSPUs) | $200,000 | $100,000 | $30,000 | $330,000 |
| Phase 3 (20 stands + taxiways) | $1,200,000 | $400,000 | $150,000 | $1,750,000 |
| Phase 4 (optimization) | $200,000 | $200,000 | $150,000 | $550,000 |

**ROI drivers:**
- Reduced per-vehicle sensor cost ($5K-15K per vehicle if sensors can be simplified)
- Faster turnaround times (Assaia reports: timely GSE positioning reduces turnaround by 2-5 min)
- Reduced incidents (27,000 ramp accidents/year industry-wide; infrastructure perception catches occluded crew)
- Aircraft damage prevention (average $250K per GSE-aircraft collision)
- Data asset value (first airside cooperative perception dataset)

### 7.4 Integration with Aurrigo Stack

**Current Aurrigo ROS Noetic architecture (from `/home/kvyn/ubuntu_20-04/z-aurrigo-ws/`):**

The cooperative perception integration requires these new ROS nodes:

```
New Nodes:
  /infra_receiver         -- Receives compressed features or detections from RSPUs via 5G
  /cooperative_fusion     -- Fuses infrastructure features with vehicle BEV features
  /a_smgcs_bridge         -- Subscribes to A-SMGCS ASTERIX feed, publishes aircraft tracks
  /adsb_bridge            -- Receives ADS-B via readsb, publishes aircraft tracks
  /infra_health_monitor   -- Monitors infrastructure link health, triggers fallback

Modified Nodes:
  /perception_pipeline    -- Add cooperative fusion output as additional input
  /planner                -- Accept fused perception (wider FOV, resolved occlusions)
  /safety_monitor         -- Add infrastructure link status to health monitoring
```

**Message types:**

```
# InfraFeatures.msg (for intermediate fusion)
Header header
uint32 infra_id           # Which RSPU sent this
float32[] bev_features    # Compressed BEV feature map
geometry_msgs/Pose infra_pose  # RSPU pose in map frame
float64 capture_timestamp # When infrastructure sensor captured data
float32 compression_ratio # How compressed the features are

# InfraDetections.msg (for late fusion)
Header header
uint32 infra_id
Detection3DArray detections  # Standard 3D detection array
float64 capture_timestamp
float32 confidence_threshold
```

**Key constraint**: The Aurrigo stack currently uses GTSAM for localization (GPU VGICP + IMU + RTK-GPS + wheel odometry). This provides the vehicle pose needed for coordinate frame alignment with infrastructure. The accuracy of GTSAM localization (~5-10 cm) is well within the tolerance needed for cooperative BEV fusion.

---

## Sources

### Papers and Venues
- DAIR-V2X (CVPR 2022): [Paper](https://openaccess.thecvf.com/content/CVPR2022/papers/Yu_DAIR-V2X_A_Large-Scale_Dataset_for_Vehicle-Infrastructure_Cooperative_3D_Object_Detection_CVPR_2022_paper.pdf)
- V2X-ViT (ECCV 2022): [arXiv](https://arxiv.org/abs/2203.10638)
- Where2comm (NeurIPS 2022): [OpenReview](https://openreview.net/forum?id=dLL1mQp3WP)
- DiscoNet (NeurIPS 2021): [GitHub](https://github.com/ai4ce/DiscoNet)
- CoAlign (ICRA 2023): [GitHub](https://github.com/yifanlu0227/CoAlign)
- FFNet (NeurIPS 2023): [Paper](https://proceedings.neurips.cc/paper_files/paper/2023/file/6ca5d2665de83394f437dad0c3746907-Paper-Conference.pdf)
- OPV2V (ICRA 2022): [UCLA Mobility Lab](https://mobility-lab.seas.ucla.edu/opv2v/)
- V2V4Real (CVPR 2023 Highlight): [GitHub](https://github.com/ucla-mobility/V2V4Real)
- TUMTraf-V2X (CVPR 2024): [Dataset](https://tum-traffic-dataset.github.io/tumtraf-v2x/)
- V2X-Real (ECCV 2024): [GitHub](https://github.com/ucla-mobility/V2X-Real)
- V2X-Radar (NeurIPS 2025 Spotlight): [GitHub](https://github.com/yanglei18/V2X-Radar)
- V2X-R (CVPR 2025): [GitHub](https://github.com/ylwhxht/V2X-R)
- V2XPnP (ICCV 2025): [UCLA Mobility Lab](https://mobility-lab.seas.ucla.edu/v2xpnp/)
- CooPre (IROS 2025 Oral): [GitHub](https://github.com/ucla-mobility/CooPre)
- RCP-Bench (CVPR 2025): [GitHub](https://github.com/LuckyDush/RCP-Bench)
- QuantV2X (2025): [GitHub](https://github.com/ucla-mobility/QuantV2X)
- LRCP (WACV 2025): [Paper](https://openaccess.thecvf.com/content/WACV2025/papers/Wang_Latency_Robust_Cooperative_Perception_using_Asynchronous_Feature_Fusion_WACV_2025_paper.pdf)

### Surveys and Repositories
- [V2X Cooperative Perception Survey](https://arxiv.org/html/2310.03525v5)
- [Collaborative Perception Paper Digest](https://github.com/Little-Podi/Collaborative_Perception)
- [Collaborative Perception Datasets Survey](https://github.com/frankwnb/Collaborative-Perception-Datasets-for-Autonomous-Driving)
- [OpenCOOD Framework](https://github.com/DerrickXuNu/OpenCOOD)

### Industry and Deployment
- [Derq INSIGHT 2026](https://en.derq.com/insight-2026)
- [Miovision Traffic Solutions](https://miovision.com/)
- [Cavnue Michigan I-94 Corridor](https://www.cavnue.com/michigan)
- [ITS Deployment Evaluation -- RSU Costs](https://www.itskrs.its.dot.gov/2025-sc00578)
- [A-SMGCS Market Outlook 2026-2030](https://www.globenewswire.com/news-release/2026/01/26/3225417/28124/en/Advanced-Surface-Movement-Guidance-Control-System-a-SMGCS-Market-Outlook-2026-2030.html)
- [DFW CBRS Deployment](https://ongoalliance.org/private-wireless-revolution-cbrs-at-dfw-airport/)
- [Outsight Airport LiDAR](https://www.airport-suppliers.com/supplier/outsight/)
- [Blickfeld Airport LiDAR](https://www.blickfeld.com/applications/security/airports/)
- [Assaia ApronAI](https://www.assaia.com/solutions/apron-ai)
- [Dallmeier Airport Solutions](https://www.dallmeier.com/solutions/airport)

### Cybersecurity
- [Data Fabrication in Collaborative Perception (USENIX Security 2023)](https://www.usenix.org/system/files/sec23winter-prepub-37-zhang-qingzhao.pdf)
- [Collaborative Perception Security Papers](https://github.com/yihangtao/Awesome-Collaborative-Perception-Security)
- [Pretend Benign (ICCV 2025)](https://openaccess.thecvf.com/content/ICCV2025/papers/Lin_Pretend_Benign_A_Stealthy_Adversarial_Attack_by_Exploiting_Vulnerabilities_in_ICCV_2025_paper.pdf)
