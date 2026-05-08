# Waymo Perception Stack: Exhaustive Technical Deep Dive

*Last updated: March 2026*

---

## Table of Contents

1. [System-Level Perception Architecture](#1-system-level-perception-architecture)
2. [Sensor Fusion Architecture](#2-sensor-fusion-architecture)
3. [Neural Network Architectures](#3-neural-network-architectures)
4. [Object Detection](#4-object-detection)
5. [Object Tracking](#5-object-tracking)
6. [Semantic, Instance, and Panoptic Segmentation](#6-semantic-instance-and-panoptic-segmentation)
7. [Occupancy Networks and Occupancy Flow](#7-occupancy-networks-and-occupancy-flow)
8. [Coordinate Frame Architecture](#8-coordinate-frame-architecture)
9. [Point Cloud Processing](#9-point-cloud-processing)
10. [Camera Perception Pipeline](#10-camera-perception-pipeline)
11. [LiDAR Perception Pipeline](#11-lidar-perception-pipeline)
12. [Radar Perception Pipeline](#12-radar-perception-pipeline)
13. [Temporal Fusion](#13-temporal-fusion)
14. [3D Scene Understanding](#14-3d-scene-understanding)
15. [Traffic Light and Sign Detection](#15-traffic-light-and-sign-detection)
16. [Lane Detection](#16-lane-detection)
17. [Pedestrian and VRU Detection](#17-pedestrian-and-vru-detection)
18. [Long-Range Perception](#18-long-range-perception)
19. [Non-ML Perception Components](#19-non-ml-perception-components)
20. [Auto-Labeling and Data Engine](#20-auto-labeling-and-data-engine)
21. [Foundation Model Integration](#21-foundation-model-integration)
22. [Key Patents](#22-key-patents)
23. [Key Papers](#23-key-papers)
24. [Open Dataset Design](#24-open-dataset-design)

---

## 1. System-Level Perception Architecture

### Overview

Waymo's perception system transforms raw sensor data from LiDAR, cameras, radar, and external audio receivers into a structured understanding of the driving environment. The system identifies, classifies, tracks, and predicts the behavior of all relevant objects and road features in real time. It feeds outputs to downstream prediction and planning modules and is a core component of the Waymo Driver.

### Waymo Foundation Model Architecture (Production, 2025-2026)

Waymo's production perception system has evolved from a traditional modular pipeline into a unified foundation model architecture employing a **Think Fast / Think Slow** dual-processing design ([Waymo Blog, Dec 2025](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)):

| Component | Role | Inputs | Outputs |
|---|---|---|---|
| **Sensor Fusion Encoder (System 1)** | Rapid perception; processes all sensor modalities in real time | Camera, LiDAR, radar, temporal history | Objects, semantic attributes, rich learned embeddings |
| **Driving VLM (System 2)** | Deep reasoning for rare/novel scenarios | Scene context, language prompts, Gemini world knowledge | Semantic understanding, exception handling |
| **World Decoder** | Unified downstream consumer | Embeddings from both encoders | Behavior predictions, HD maps, ego trajectories, trajectory validation signals |

Key architectural properties:
- Uses **learned embeddings as a rich interface** between model components, rather than hard-coded intermediate representations.
- Supports **full end-to-end signal backpropagation** during training across perception, prediction, and planning.
- Produces **compact, materialized structured representations** -- objects, semantic attributes, and roadgraph elements -- alongside dense embeddings.
- Teacher-student **knowledge distillation**: large teacher models train smaller student models suitable for real-time onboard inference and large-scale simulation.
- Trained on **Google TPU pods** (v4, v5e, Trillium/v6) using JAX.

### Traditional Pipeline (Still Coexisting)

```
Sensors --> Preprocessing --> Feature Extraction --> Sensor Fusion --> Detection --> Tracking --> Output
  |              |                  |                    |              |            |
  v              v                  v                    v              v            v
LiDAR      Motion Comp.     Voxel/Pillar/Range    Multi-modal     3D Boxes    Temporal
Camera     ISP/Calib.       Image Backbone        Attention       Classes     Association
Radar      Ego-motion       Point Encoders        BEV Fusion      Scores      State Est.
Audio      Filtering        Radar Features        Cross-attn      Velocity    Prediction
```

The perception system produces:
- **3D bounding boxes** (oriented cuboids) with class labels, confidence scores, and velocities
- **Tracking IDs** -- globally unique, persistent across frames
- **Semantic segmentation** -- per-point (LiDAR) and per-pixel (camera) labels
- **Free space / drivable area** estimation
- **Traffic signal states** -- light colors, arrow directions
- **Road graph elements** -- lane boundaries, crosswalks, curbs
- **Human keypoints** -- 14-point skeletal pose for pedestrians and cyclists

---

## 2. Sensor Fusion Architecture

### Fusion Philosophy

Waymo's sensor fusion strategy is built on the principle that **no single sensor modality is sufficient** and that combining modalities amplifies the strengths of each while compensating for individual weaknesses ([Waymo Driver Handbook: Perception, Oct 2021](https://waymo.com/blog/2021/10/the-waymo-driver-handbook-perception/)):

| Sensor | Strengths | Weaknesses |
|---|---|---|
| **LiDAR** | Precise 3D geometry, depth at all ranges, works in darkness | No color/texture, degraded in heavy precipitation, sparse at long range |
| **Camera** | Rich texture, color, semantics, high resolution at distance | No direct depth, affected by glare/darkness, ambiguous 3D geometry |
| **Radar** | Instant velocity (Doppler), weather-robust, long range | Low angular resolution, no color/texture, elevation ambiguity |

### Multi-Level Fusion Approach

Waymo uses **multi-level fusion** combining elements of early, mid, and late fusion, tailored per task:

#### 1. Late-to-Early Fusion (LEF)

Waymo's signature temporal fusion paradigm, published at IROS 2023 ([LEF paper](https://arxiv.org/abs/2309.16870)):
- Object-aware **late-stage features** (learned embeddings encoding object identity and state) are fed back into **early-stage processing** of the current frame.
- Recurrent feature fusion uses **window-based attention blocks** over temporally calibrated and aligned **sparse pillar tokens**.
- BEV foreground pillar segmentation reduces the number of sparse history features by **10x**, enabling efficient real-time operation.
- **FrameDrop training**: stochastic-length frame dropping during training generalizes the model to variable frame counts at inference without retraining.

#### 2. Deep Feature Fusion (DeepFusion)

Published at CVPR 2022 ([DeepFusion paper](https://arxiv.org/abs/2203.08195)):
- Fuses **deep LiDAR features** with **deep camera features** rather than decorating raw LiDAR points with camera data.
- **InverseAug**: stores geometric augmentation parameters, then inverts them at fusion time to ensure accurate LiDAR-to-camera pixel alignment despite training-time data augmentation.
- **LearnableAlign**: cross-attention module with learned queries that dynamically captures correlations between image features and LiDAR voxel features. Uses FC layers with 256 filters for embedding, cross-attention with 30% dropout on the affinity matrix, and an MLP with 192 filters post-attention.
- Improves pedestrian detection by **+6.7 to +8.9 L2 APH** over strong baselines (PointPillars, CenterPoint, 3D-MAN).

#### 3. Multi-View Fusion (MVF)

Published at CoRL 2019 ([MVF paper](https://arxiv.org/abs/1910.06528)):
- Fuses **bird's-eye view (BEV)** and **perspective (range) view** representations of the same LiDAR point cloud.
- Introduces **dynamic voxelization**: no fixed tensor pre-allocation, no stochastic point dropout, deterministic voxel embeddings, bi-directional point-voxel relationship.
- Each point learns to fuse context from both views.
- Significantly improves over single-view PointPillars baseline on Waymo Open Dataset.

#### 4. Camera-Radar Fusion (CramNet)

Published at ECCV 2022 ([CramNet paper](https://arxiv.org/abs/2210.09267)):
- **Ray-constrained cross-attention** resolves geometric ambiguity between camera (unknown depth) and radar (unknown elevation).
- Camera and radar features are aligned in a joint 3D space using geometric ray constraints.
- Supports **sensor modality dropout** during training -- if a camera or radar sensor fails at runtime, the model maintains robust detection.
- Demonstrated on RADIATE dataset and Waymo Open Dataset.

#### 5. 4D Multi-Modal Alignment (4D-Net)

Published at ICCV 2021 ([4D-Net paper](https://arxiv.org/abs/2109.01066)):
- Processes **32 LiDAR point clouds** and **16 RGB camera frames** temporally -- the first approach to combine both modalities across time.
- Dynamic connection learning across feature representations and abstraction levels with geometric constraints.
- Processes all inputs within **164 ms**.
- Particularly effective for **distant object detection** by leveraging high-resolution camera information combined with LiDAR depth.

### Cross-Sensor Validation

Waymo's perception system performs explicit cross-sensor validation:
- If a camera detects a stop sign, LiDAR verifies whether it is a real sign or a reflection/advertisement.
- If LiDAR detects a partially occluded shape, camera texture confirms the object class.
- Radar provides instant velocity measurement to validate whether camera/LiDAR-detected objects are static or moving.

---

## 3. Neural Network Architectures

### Comprehensive Architecture Catalog

#### 3.1 LiDAR-Primary Detection Architectures

| Architecture | Year | Venue | Input | Key Innovation | Performance |
|---|---|---|---|---|---|
| **PointPillars** | 2019 | CVPR | Point cloud | Encodes points into vertical pillars; 2D CNN backbone; **62 Hz** inference | Fast baseline for pillar-based detection |
| **StarNet** | 2019 | NeurIPS WS | Point cloud | Entirely point-based, no global info, data-dependent anchors, sampling-based | +7 mAP on pedestrians vs. conv baselines |
| **MVF (Multi-View Fusion)** | 2019 | CoRL | Point cloud | Dynamic voxelization; BEV + perspective view fusion | Improves over PointPillars |
| **RCD (Range Conditioned Dilated Conv.)** | 2020 | CoRL | Range image | Continuous dilation rate conditioned on range; soft range gating | SOTA for range-based detection, best at long range |
| **RSN (Range Sparse Net)** | 2021 | CVPR | Range image | 2D conv on range images selects foreground points; sparse conv on selected points; **>60 FPS** | #1 on WOD leaderboard (APH/L1, Nov 2020) |
| **To the Point** | 2021 | CVPR | Range image | Graph convolution kernels on range images for 3D detection | Efficient range-image-based detection |
| **SWFormer** | 2022 | ECCV | Voxels | Sparse window transformer; bucketing for variable-length windows; voxel diffusion | **73.36 L2 mAPH** (vehicle+ped), SOTA single-stage |
| **LidarNAS** | 2022 | ECCV | Multi-view | Unified NAS framework; evolutionary search over view transforms + neural layers | Outperforms SOTA; discovers same macro-architecture for vehicle and pedestrian |
| **PVTransformer** | 2024 | ICRA | Points+voxels | Replaces PointNet pooling with attention for point-to-voxel aggregation | **76.5 L2 mAPH**, +1.7 over SWFormer |
| **CenterPoint** | 2021 | CVPR | Voxels/pillars | Anchor-free center-based detection; keypoint heatmap; two-stage refinement | 71.9 mAPH on WOD, 11+ FPS |

#### 3.2 Multi-Modal Detection Architectures

| Architecture | Year | Venue | Inputs | Key Innovation |
|---|---|---|---|---|
| **DeepFusion** | 2022 | CVPR | LiDAR + camera | InverseAug + LearnableAlign cross-attention |
| **4D-Net** | 2021 | ICCV | LiDAR + camera (temporal) | Dynamic connection learning across 4D (3D + time) |
| **CramNet** | 2022 | ECCV | Camera + radar | Ray-constrained cross-attention; modality dropout |
| **MoDAR** | 2023 | CVPR | LiDAR + motion forecasting | Virtual points from predicted trajectories augment point clouds; +11.1 mAPH over CenterPoint |

#### 3.3 Temporal Detection Architectures

| Architecture | Year | Venue | Key Innovation |
|---|---|---|---|
| **3D-MAN** | 2021 | CVPR | Multi-frame attention with memory bank; multi-view alignment and aggregation |
| **LEF** | 2023 | IROS | Late-to-early recurrent fusion; BEV foreground segmentation; FrameDrop training |
| **Streaming Detection** | 2020 | ECCV | Pipelined inference on partial LiDAR rotations; **1/15th to 1/3rd peak latency** (30 ms vs. 120 ms) |

#### 3.4 Prediction Architectures

| Architecture | Year | Venue | Key Innovation |
|---|---|---|---|
| **VectorNet** | 2020 | CVPR | Hierarchical GNN on vectorized map + trajectory; 18% better than ResNet-18 at 29% parameters, 20% FLOPs |
| **MultiPath** | 2019 | CoRL | Fixed anchor trajectories; Gaussian mixture output per timestep; single forward pass |
| **MultiPath++** | 2022 | ICRA | Learned latent anchor embeddings; multi-context gating fusion; trajectory aggregation |
| **Scene Transformer** | 2022 | ICLR | Joint multi-agent prediction; factorized attention over agent-time axes; masking strategy for conditioning |
| **MotionLM** | 2023 | ICCV | Motion forecasting as language modeling; discrete motion tokens; autoregressive joint decoding; #1 on WOMD interactive leaderboard |
| **STINet** | 2020 | CVPR | Joint pedestrian detection + trajectory prediction; interaction graph; 80.73 BEV AP, 33.67 cm ADE |

#### 3.5 Segmentation Architectures

| Architecture | Year | Venue | Key Innovation |
|---|---|---|---|
| **Superpixel Transformers** | 2023 | ICCV | Decomposes pixel space into superpixels via local cross-attention; global self-attention on superpixels; SOTA efficiency |
| **LESS** | 2022 | ECCV | Label-efficient LiDAR segmentation; prototype learning; multi-scan distillation; competitive at 0.1% labels |
| **3D Open-Vocab Panoptic Seg.** | 2024 | ECCV | Frozen CLIP + learned LiDAR features; object-level and voxel-level distillation losses; handles novel classes |
| **Panoramic Video Panoptic Seg.** | 2022 | ECCV | 28 semantic categories; 5 cameras; DeepLab-family baselines; 100k labeled images |

#### 3.6 End-to-End / Foundation Models

| Architecture | Year | Venue | Key Innovation |
|---|---|---|---|
| **EMMA** | 2024/2025 | ICLR 2025 | Gemini Nano-1 base; camera-to-trajectory; VQA formulation; chain-of-thought; SOTA nuScenes planning |
| **Waymo Foundation Model** | 2025-2026 | Production | Think Fast/Slow; sensor fusion encoder + Driving VLM; World Decoder; end-to-end backprop |

---

## 4. Object Detection

### 3D Object Detection

#### Output Format

Waymo's 3D detections are represented as **oriented 3D cuboids** (7-DOF bounding boxes):

| Parameter | Description |
|---|---|
| **Center (x, y, z)** | 3D position in the vehicle coordinate frame |
| **Dimensions (l, w, h)** | Length, width, height in meters |
| **Heading (yaw)** | Orientation angle around the vertical axis |
| **Velocity (vx, vy)** | Estimated 2D velocity in the ground plane |
| **Class label** | Object category (vehicle, pedestrian, cyclist, sign, etc.) |
| **Confidence score** | Detection confidence [0, 1] |
| **Tracking ID** | Globally unique identifier for temporal association |

#### Object Classes

The perception system detects **100+ object classes**. The primary taxonomy from the Waymo Open Dataset includes:

**3D-labeled classes (LiDAR):**
- Vehicle (car, truck, bus, etc.)
- Pedestrian
- Cyclist
- Sign

**Semantic segmentation classes (23 LiDAR classes):**
Car, Truck, Bus, Motorcyclist, Bicyclist, Pedestrian, Sign, Traffic Light, Pole, Construction Cone, Bicycle, Motorcycle, Building, Vegetation, Tree Trunk, Curb, Road, Lane Marker, Walkable, Sidewalk, Other Ground, Other Vehicle, Undefined

**Camera semantic segmentation classes (28 categories):**
Extended taxonomy covering finer-grained categories across the same broad groups.

#### Detection Heads

Waymo has explored multiple detection head designs:

1. **Anchor-based heads**: Traditional approach using pre-defined anchor boxes at multiple scales and orientations, regressing offsets.
2. **Center-based heads (CenterPoint)**: Anchor-free; predicts center heatmaps, then regresses size, orientation, velocity per center. Two-stage refinement using point features.
3. **Transformer-based heads (SWFormer, PVTransformer)**: Attention-based decoding with voxel diffusion for handling sparse features. PVTransformer achieves **76.5 L2 mAPH** on WOD.
4. **Range-image heads (RSN, RCD, To the Point)**: 2D convolution or graph convolution on native range images, followed by 3D box regression.

#### Detection Ranges

| Range Category | Typical Detection Distance | Primary Sensor |
|---|---|---|
| **Close range** | 0-30 m | Short-range LiDAR, cameras |
| **Mid range** | 30-100 m | Main LiDAR, cameras, radar |
| **Long range** | 100-300 m | Main LiDAR, high-res cameras, radar |
| **Ultra-long range** | 300-500+ m | Cameras (primary), radar |

#### Confidence Estimation

- Detection confidence scores represent the model's estimated probability that a detection is a true positive.
- Waymo uses **two difficulty levels** in evaluation: LEVEL_1 (objects with >= 5 LiDAR points) and LEVEL_2 (objects with >= 1 LiDAR point).
- The primary evaluation metric is **APH** (Average Precision weighted by Heading accuracy), which penalizes heading errors.

### 2D Object Detection

- Camera-based 2D bounding boxes are tight-fitting, axis-aligned rectangles.
- 2D labels cover vehicles, pedestrians, and cyclists.
- 2D detections serve as inputs to camera-LiDAR fusion pipelines and as standalone outputs for camera-only perception.

---

## 5. Object Tracking

### Multi-Object Tracking Architecture

Waymo has published two primary tracking paradigms:

#### 5.1 SoDA: Soft Data Association (2020)

([SoDA paper](https://waymo.com/research/soda-multi-object-tracking-with-soft-data-association/))

Traditional MOT commits to hard assignment between detections and tracks, which can cause irrecoverable errors. SoDA replaces this with:

- **Attention-based track embeddings** that encode spatiotemporal dependencies between observed objects.
- **Soft data associations**: instead of committing to a single detection-track pair, the model aggregates information from all detections probabilistically.
- **Learned occlusion reasoning**: maintains track estimates for occluded objects using the latent space from soft associations.
- Evaluated on Waymo Open Dataset; performs favorably vs. state-of-the-art visual MOT.

#### 5.2 STT: Stateful Tracking with Transformers (ICRA 2024)

([STT paper](https://arxiv.org/abs/2405.00236))

- Jointly optimizes **data association** and **state estimation** (position, velocity, acceleration) in a single transformer model.
- Consumes rich appearance, geometry, and motion signals through long-term detection history.
- Introduces **S-MOTA** and **MOTPS** metrics that capture combined association + state estimation quality.
- Evaluated on WOD: 798 training / 202 validation / 150 test sequences, 20 sec at 10 Hz, LEVEL_2 difficulty for vehicles and pedestrians.

#### 5.3 Classical Tracking Baseline

Many systems on the Waymo Open Dataset use the AB3DMOT paradigm:
- **Kalman filter** for state prediction and update.
- **Hungarian algorithm** for detection-track assignment using 3D IoU or Mahalanobis distance.
- **Heuristic track management**: birth (new tracks from unmatched detections), death (tracks deleted after N consecutive misses).
- Runs at **200+ FPS**, making it suitable as a lightweight real-time baseline.

#### Track Management

| Event | Trigger | Action |
|---|---|---|
| **Track birth** | Unmatched detection exceeding confidence threshold | Initialize new track with unique ID |
| **Track update** | Matched detection | Update state via Kalman filter or transformer |
| **Track coast** | No matching detection (occlusion) | Predict forward using motion model; maintain for T frames |
| **Track death** | Coasting exceeds maximum age | Delete track |
| **Track re-identification** | Previously coasting track matches new detection | Resume tracking with same ID |

---

## 6. Semantic, Instance, and Panoptic Segmentation

### 6.1 LiDAR Semantic Segmentation

#### Classes (23 fine-grained categories)

| Category Group | Classes |
|---|---|
| **Vehicles** | Car, Truck, Bus, Other Vehicle, Motorcycle, Bicycle |
| **VRUs** | Pedestrian, Motorcyclist, Bicyclist |
| **Infrastructure** | Sign, Traffic Light, Pole, Construction Cone, Building |
| **Vegetation** | Vegetation, Tree Trunk |
| **Ground** | Road, Lane Marker, Sidewalk, Walkable, Curb, Other Ground |
| **Other** | Undefined |

Labels are provided at **2 Hz** for every LiDAR point across the full dataset, captured by the high-resolution top LiDAR sensor.

#### Architectures

- **AutoML/NAS-discovered architectures**: Waymo and Google Brain explored 10,000+ architectures using RL and random search. The resulting NAS cells yield **8-10% lower error rates** at same latency or **20-30% lower latency** at same quality ([Waymo AutoML Blog, Jan 2019](https://waymo.com/blog/2019/01/automl-automating-design-of-machine)).
- **LidarNAS** (ECCV 2022): unified framework factorizing networks into view transforms + neural layers; evolutionary NAS discovers optimal designs for both vehicle and pedestrian classes.
- **LESS** (ECCV 2022): label-efficient approach using heuristic pre-segmentation, prototype learning, and multi-scan distillation. Competitive with fully supervised methods using only **0.1% labeled points**.
- **Superpixel Transformers** (ICCV 2023): for camera-based segmentation; decomposes images into superpixels via local cross-attention, then applies global self-attention. SOTA accuracy with reduced parameters and latency.

### 6.2 Camera Semantic and Instance Segmentation

- **28 semantic categories** across 5 cameras.
- Labels for **100,000 camera images** in 2,860 temporal sequences.
- Instance segmentation labels provided for the same subset.
- Baselines use **DeepLab-family** models for panoramic video panoptic segmentation ([ECCV 2022](https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136890052.pdf)).

### 6.3 Panoptic Segmentation

- Combines semantic and instance segmentation into unified scene understanding.
- **Panoramic Video Panoptic Segmentation** benchmark (ECCV 2022): temporal consistency across 5-camera panoramic video.
- **3D Open-Vocabulary Panoptic Segmentation** (ECCV 2024): fuses learned LiDAR features with frozen CLIP vision features; novel object-level and voxel-level distillation losses enable detection of unseen classes not in training data.

### 6.4 Cross-Modal Consistency

- **Instance Segmentation with Cross-Modal Consistency** (IROS 2022): exploits camera-LiDAR consistency constraints to improve instance segmentation without additional annotation overhead.

---

## 7. Occupancy Networks and Occupancy Flow

### Occupancy Flow Fields

Waymo introduced **Occupancy Flow Fields** as a unified representation for motion forecasting (RA-L, 2022; [paper](https://arxiv.org/abs/2203.03875)):

#### Representation

A **spatio-temporal BEV grid** where each cell contains:
1. **Occupancy probability**: likelihood that the cell is occupied by any agent.
2. **2D flow vector**: direction and magnitude of motion at that cell.

This dual representation overcomes shortcomings of:
- **Trajectory sets**: cannot represent uncertainty well over large regions.
- **Standard occupancy grids**: cannot capture motion direction or agent identity.

#### Key Features

- **Flow trace loss**: novel loss function enforcing consistency between occupancy and flow predictions (tracing flow vectors backwards should recover the source occupancy).
- **Speculative agents**: predicts currently-occluded agents that may appear in the future -- a novel problem formulation.
- **Three evaluation metrics**: occupancy prediction quality, motion estimation accuracy, agent ID recovery.
- **Temporal horizon**: predicts BEV occupancy and flow for **8 seconds** into the future given 1 second of past agent tracks.

#### Waymo Open Dataset Challenge

The Occupancy and Flow Prediction challenge asks participants to predict BEV occupancy and flow for all currently-observed and currently-occluded vehicles. Notable results:
- **STrajNet**: multi-modal Swin Transformer with trajectory-based interaction awareness via cross-attention.
- **OFMPNet** (Neurocomputing 2024): achieved **52.1% Soft IoU** and **76.75% AUC** for Flow-Grounded Occupancy.

---

## 8. Coordinate Frame Architecture

### Reference Frames

| Frame | Description | Primary Use |
|---|---|---|
| **Sensor frame** | Origin at each sensor (LiDAR, camera, radar) | Raw data acquisition |
| **Vehicle frame** | Origin at the rear axle center of the ego vehicle | Perception outputs, detection, tracking |
| **Global frame (UTM)** | Georeferenced coordinate system | Map alignment, localization, HD map storage |

Each sensor has a **4x4 extrinsic transformation matrix** mapping from sensor frame to vehicle frame. Camera intrinsics (focal length, principal point, distortion) are also provided.

### BEV Representation

Waymo's perception system projects sensor data into a **bird's-eye view (BEV)** representation -- a top-down 2D grid centered on the ego vehicle:

| Parameter | Typical Value |
|---|---|
| **Grid extent** | 150 m x 150 m centered on ego (some models use larger) |
| **Grid resolution** | 0.1-0.32 m per cell (varies by model) |
| **Feature channels** | Varies (64-256 typical for BEV feature maps) |
| **Coordinate system** | Ego-centric, aligned with vehicle heading |

BEV features are generated from:
- **LiDAR**: via pillarization (PointPillars) or voxelization followed by height compression.
- **Camera**: via depth estimation and Lift-Splat-style projection, or via transformer-based BEV queries (BEVFormer-style).
- **Radar**: via range-azimuth projection or learned 3D feature placement.

### Voxel Grid Specifications

For voxel-based methods (SWFormer, CenterPoint):

| Parameter | Value |
|---|---|
| **Voxel size (typical)** | 0.1 m x 0.1 m x 0.15 m (x, y, z) |
| **Pillar size (PointPillars)** | 0.2 m x 0.2 m (x, y) -- no height limit |
| **Detection range** | [-75.2, 75.2] x [-75.2, 75.2] x [-2, 4] m (varies) |
| **Max points per voxel** | Typically 5-20 (varies by model) |
| **Max voxels** | ~40,000-60,000 non-empty voxels per frame |

---

## 9. Point Cloud Processing

### 9.1 Raw Point Cloud Characteristics

Waymo's LiDAR suite produces point clouds with the following characteristics:

| Parameter | 5th Gen | 6th Gen |
|---|---|---|
| **Number of LiDAR units** | 5 (1 roof + 4 perimeter) | 4 (1 roof + 3 perimeter) |
| **Points per frame (combined)** | ~177,000-300,000 | Similar (improved per-sensor density) |
| **Frame rate** | 10 Hz | 10 Hz |
| **Top LiDAR type** | 64-beam rotating | Next-gen design with zooming capability |
| **Return mode** | Dual return (first + strongest) | Dual return |
| **Max range** | >300 m | >300 m (improved fidelity at range) |
| **Range accuracy** | Centimeter-level | Centimeter-level |

Each LiDAR point carries:
- **Range** (distance from sensor origin)
- **Intensity** (return strength)
- **Elongation** (pulse elongation, indicating target properties)
- **Timestamp** (acquisition time within the scan)
- **Beam inclination** and **azimuth** (for range image reconstruction)

### 9.2 Range Image Representation

Waymo's LiDAR data is natively captured as **range images** -- 2D arrays where each pixel encodes the range measurement at a specific (azimuth, inclination) pair:

- Range images preserve the **native sensor topology** and enable efficient 2D convolution operations.
- Architectures like **RSN**, **RCD**, and **To the Point** operate directly on range images rather than converting to 3D point clouds first.
- Range images are stored for both the first and strongest returns, effectively providing two range images per LiDAR per frame.

### 9.3 Voxelization

The process of converting point clouds into regular 3D grid representations:

1. **Point assignment**: each point is assigned to the voxel cell it falls within based on its (x, y, z) coordinates.
2. **Feature aggregation**: points within each voxel are aggregated via PointNet (max-pooling over per-point MLPs) or via **PVTransformer's attention-based aggregation** (replacing PointNet pooling with cross-attention for better scalability).
3. **Sparse representation**: only non-empty voxels are stored and processed, exploiting the inherent sparsity of LiDAR data (typically <0.1% of voxels are occupied).

### 9.4 Pillarization

PointPillars-style encoding treats the point cloud as an array of vertical pillars (no height discretization):

1. Points are assigned to 2D (x, y) grid cells.
2. Per-pillar features are computed via a simplified PointNet.
3. The resulting pseudo-image is processed by a standard 2D CNN backbone.
4. Achieves **62 Hz** inference, making it suitable for real-time deployment.

### 9.5 Multi-Sweep Aggregation

Multiple consecutive LiDAR scans are combined to increase point density and enable velocity estimation:

1. **Ego-motion compensation**: each historical point cloud is transformed into the current frame's coordinate system using ego vehicle pose (from IMU + localization).
2. **Concatenation**: compensated historical points are concatenated with the current frame's points, with a temporal channel encoding the time offset.
3. **Typical window**: 2-5 frames (0.2-0.5 seconds at 10 Hz); some models use up to **18 seconds** (MoDAR).
4. **Benefits**: denser point clouds, implicit velocity information, better coverage of occluded regions.

### 9.6 Motion Compensation

During a single LiDAR rotation (~100 ms), the ego vehicle may move significantly, causing distortion in the point cloud:

1. **Ego-motion estimation**: from IMU, wheel odometry, and localization against the HD map.
2. **Per-point correction**: each point's timestamp determines the ego pose at acquisition time; the point is transformed to the reference pose (typically the scan midpoint or end).
3. **Rolling shutter correction**: analogous to camera rolling shutter; critical for high-speed driving.

### 9.7 LiDAR Data Compression (RIDDLE)

**RIDDLE** (CVPR 2022): Range Image Deep Delta Encoding for LiDAR data compression. Uses learned delta encoding on range images to reduce data transmission bandwidth from fleet to cloud infrastructure.

---

## 10. Camera Perception Pipeline

### 10.1 Camera Hardware

**5th Generation (Jaguar I-PACE):**
- 29 cameras providing 360-degree overlapping coverage
- Can identify stop signs at >500 m

**6th Generation (Waymo Ojai):**
- 13 cameras (42% fewer than 5th gen, but higher individual capability)
- **17-megapixel imager** -- a generation ahead of other automotive cameras
- High dynamic range, exceptional thermal stability across automotive temperature ranges (-40C to +85C)
- Miniature wipers on front sensor pod for debris clearing

### 10.2 Image Backbone

Waymo's camera perception pipeline uses state-of-the-art image feature extractors:

| Component | Options Used |
|---|---|
| **Image backbone** | ResNet (for DeepFusion), Vision Transformers (ViTs) for newer models |
| **Feature pyramid** | Multi-scale feature extraction for objects at varying distances |
| **Resolution** | Dataset images: 1920x1280 (front), smaller for side cameras |
| **Processing** | Image features extracted by 2D CNN or ViT; lifted to 3D via depth estimation or cross-attention |

### 10.3 2D Detection

- Tight-fitting, axis-aligned 2D bounding boxes for vehicles, pedestrians, cyclists.
- Used as input to camera-LiDAR fusion (e.g., DeepFusion's LearnableAlign uses 2D feature locations to find cross-attention correspondences).

### 10.4 Depth Estimation and Camera-to-3D Lifting

Multiple approaches are used:

1. **Lift-Splat-Shoot (LSS) style**: predict per-pixel depth distribution, then scatter image features into 3D voxels weighted by depth probabilities.
2. **Cross-attention lifting (BEVFormer-style)**: BEV queries attend to multi-camera image features via deformable attention; no explicit depth prediction required.
3. **Reference-based depth (R4D)** (ICLR 2022): uses reference objects with known sizes/distances in the scene to estimate depth of target objects. Builds a graph connecting targets to references, with attention weighting the importance of each reference. First framework for accurate long-range distance estimation.
4. **Monocular depth from geometry**: using known camera intrinsics and object size priors to estimate distance.

### 10.5 Camera-Primary Detection

- **EMMA** (ICLR 2025) operates camera-only, directly mapping images to trajectories and 3D detections.
- **LET-3D-AP** (ICRA 2024): a specialized evaluation metric that accounts for camera-specific longitudinal measurement uncertainty, enabling fairer assessment of camera-only 3D detection.

---

## 11. LiDAR Perception Pipeline

### 11.1 In-House LiDAR Technology

Waymo is one of the only AV companies to design and manufacture LiDAR sensors entirely in-house, across three distinct sensor categories:

#### Long-Range LiDAR (Roof-Mounted)
- Custom "Laser Bear Honeycomb" lineage
- 360-degree rotation
- Range: >300 m
- 5th-gen: 95-degree vertical field of view
- 6th-gen: improved illumination, better weather penetration, reduced point cloud distortion near reflective signs

#### Short-Range / Perimeter LiDAR
- Positioned around vehicle sides (4 units in 5th gen, 3 in 6th gen)
- Uninterrupted close-range surround coverage
- Critical for VRU detection in close proximity
- Centimeter-scale accuracy

#### High-Resolution Forward LiDAR
- **First-of-its-kind zooming capability**: dynamically focuses on distant objects
- Provides detailed point clouds at extended ranges
- Particularly useful for highway scenarios

### 11.2 LiDAR Processing Pipeline

```
Range Image --> Point Cloud --> Voxelization/Pillarization --> Sparse 3D Conv/Attention --> BEV Features
     |                                    |
     v                                    v
Range-Image CNN                    3D Detection Heads
(RSN, RCD, To the Point)          (CenterPoint, SWFormer, PVTransformer)
```

#### Range Image Processing Path
1. Raw range images (first + strongest returns) from each LiDAR.
2. 2D CNN or graph convolution on the range image.
3. Foreground point selection (RSN: select likely foreground points from range image features).
4. 3D box regression from range-image features.
5. **Advantages**: preserves sensor topology, efficient 2D operations, natural scale variation handling via RCD.

#### Point Cloud / Voxel Processing Path
1. Range images converted to 3D point clouds via inverse projection.
2. Multi-LiDAR points concatenated in vehicle frame.
3. Voxelization or pillarization with feature aggregation (PointNet or PVTransformer attention).
4. Sparse 3D convolution (VoxelNet, CenterPoint) or sparse window attention (SWFormer).
5. Height compression to BEV feature map.
6. Detection heads predict center heatmaps, box parameters, velocity.

### 11.3 Key LiDAR Detection Results (Waymo Open Dataset)

| Model | Year | L2 mAPH (Vehicle+Ped) | Speed | Notes |
|---|---|---|---|---|
| PointPillars | 2019 | Baseline | 62 Hz | Pillar-based, fast |
| RSN | 2020 | #1 on leaderboard (Nov 2020) | >60 FPS | Range-sparse; foreground selection |
| CenterPoint | 2021 | 71.9 | 11+ FPS | Anchor-free center-based |
| SWFormer | 2022 | 73.36 | Efficient | Sparse window transformer |
| PVTransformer | 2024 | 76.5 | -- | Point-to-voxel attention |
| MoDAR + SWFormer | 2023 | ~81.9 (est.) | -- | +8.5 over SWFormer with motion virtual points |

---

## 12. Radar Perception Pipeline

### 12.1 In-House Imaging Radar

Waymo developed one of the world's first automotive **imaging radar** systems:

| Specification | Detail |
|---|---|
| **Count** | 6 units (both 5th and 6th gen) |
| **Type** | Custom in-house imaging radar |
| **Range** | >500 m |
| **Field of view** | Continuous 360-degree coverage |
| **Velocity measurement** | Instantaneous Doppler velocity |
| **Angular resolution** | Higher than conventional automotive radar (exact specs not disclosed) |
| **MIMO antennas** | Used for improved resolution, range, and precision |
| **Weather robustness** | Operates in rain, fog, snow, direct sunlight |
| **Object types** | Detects static, barely moving, and fully moving objects |

### 12.2 Radar Data Representation

Waymo's imaging radar produces:
- **Dense temporal maps**: continuous tracking of distance, velocity, and size of objects.
- **Range-Doppler** representation: 2D map of range vs. radial velocity.
- **Range-azimuth** projection: radar returns projected into a 2D spatial grid.
- Point-cloud-like representations for fusion with LiDAR/camera features.

### 12.3 Camera-Radar Fusion (CramNet)

The key challenge in camera-radar fusion is geometric ambiguity:
- **Camera**: knows azimuth and elevation but not depth.
- **Radar**: knows range and azimuth but not elevation.

CramNet resolves this via **ray-constrained cross-attention**:
1. Camera features are lifted along camera rays in 3D.
2. Radar features are extended along the elevation axis.
3. Cross-attention operates at the intersections of these geometric constraints.
4. **Modality dropout** during training ensures the model degrades gracefully if a sensor fails.

### 12.4 Radar-Specific Capabilities

- **Instantaneous velocity**: unlike LiDAR/camera which require multi-frame observation for velocity estimation, radar provides per-return Doppler velocity in a single measurement.
- **Weather penetration**: radar's longer wavelength penetrates rain, fog, and snow where LiDAR and cameras degrade.
- **6th-gen improvements**: new in-house algorithms for improved rain/snow performance; dense temporal mapping for real-time speed, size, and trajectory tracking.

---

## 13. Temporal Fusion

### Multi-Frame Aggregation Strategies

Waymo has explored several approaches to leveraging temporal information:

#### 13.1 Input-Level Temporal Fusion (Multi-Sweep)

- Concatenate ego-motion-corrected point clouds from consecutive frames.
- Add temporal channel encoding the time offset of each point.
- Typical window: 2-5 frames (0.2-0.5 s).
- **Benefits**: denser point clouds, implicit velocity information.
- **Used by**: CenterPoint, PointPillars, most standard detectors.

#### 13.2 Feature-Level Temporal Fusion

**3D-MAN** (CVPR 2021):
- Single-frame detector generates proposals and feature maps stored in a **memory bank**.
- Multi-view alignment and aggregation module uses **attention** to combine features from different perspectives across time.
- Particularly effective for objects seen from multiple viewpoints over time.
- Achieves **78.71% AP / 78.28% APH** for vehicles on WOD test set.

**LEF** (IROS 2023):
- Late-to-early recurrent fusion: object-aware late-stage embeddings are injected into early-stage processing.
- **Window-based attention** on sparse pillar tokens, temporally aligned.
- BEV foreground segmentation reduces sparse history features by **10x**.
- FrameDrop training enables variable-length temporal context at inference.

#### 13.3 Motion-Augmented Detection (MoDAR)

**MoDAR** (CVPR 2023):
- Uses **motion forecasting** outputs as a virtual sensing modality.
- Predicted future trajectories generate **virtual points** that augment the raw LiDAR point cloud.
- Virtual points propagate object information from extra-long temporal contexts (up to **18 seconds**) into the current frame.
- Can use any off-the-shelf point cloud detector as backbone.
- Improves CenterPoint by **+11.1 mAPH** and SWFormer by **+8.5 mAPH**.
- Particularly helps **long-range and occluded objects**.

#### 13.4 Streaming Detection (Temporal Pipelining)

**Streaming Object Detection** (ECCV 2020):
- Instead of waiting for a complete 360-degree LiDAR rotation, inference is performed on **partial rotations** as data streams in.
- Computation is pipelined across the acquisition time.
- Reduces peak latency from ~120 ms to ~**30 ms** (1/15th to 1/3rd reduction).
- Maintains competitive detection accuracy.

#### 13.5 4D Multi-Modal Temporal Fusion (4D-Net)

**4D-Net** (ICCV 2021):
- Processes **32 LiDAR frames + 16 camera frames** jointly across time.
- Dynamic connection learning across 4D (3D spatial + temporal) feature representations.
- Total inference: **164 ms** for the full temporal stack.
- Especially effective for **distant objects** where camera provides high-resolution detail and LiDAR provides depth across time.

---

## 14. 3D Scene Understanding

### 14.1 Scene Flow Estimation

Waymo introduced large-scale scene flow annotations (2021) and a benchmark:

- **Scene flow**: 3D motion vector for each point in the point cloud, describing how each point moves between consecutive frames.
- Dataset is **~1,000x larger** than previous real-world scene flow datasets in annotated frames.
- Scene flow is derived from tracked 3D object annotations and ego-motion compensation.
- Enables understanding of which scene elements are static vs. dynamic and their motion directions.

Paper: **"Scalable Scene Flow from Point Clouds in the Real World"** (2021)

### 14.2 Free Space Estimation

- **Free space** (drivable area) is estimated as the complement of occupied space.
- LiDAR ground segmentation identifies traversable surfaces.
- Occupancy grids encode which cells are occupied, free, or unknown.
- The EMMA model outputs road graph elements including drivable area boundaries.

### 14.3 3D Reconstruction

**Block-NeRF** (CVPR 2022):
- Neural radiance field for **city-scale** 3D reconstruction.
- Built from **2.8 million images** spanning 13.4 hours of driving across 1,330 data collection runs.
- Renders an entire San Francisco neighborhood.
- Handles transient objects via segmentation-based masking during training.
- Used for simulation, data augmentation, and map verification.

**GINA-3D** (CVPR 2023):
- Generates implicit neural 3D assets from sensor observations.
- Creates realistic 3D objects for simulation and augmentation.

**NeRDi** (CVPR 2023):
- Single-view NeRF synthesis using language-guided diffusion priors.
- Reconstructs 3D scenes from single camera images.

---

## 15. Traffic Light and Sign Detection

### Detection Capabilities

The Waymo Driver detects and classifies:
- **Traffic light states**: red, yellow, green (solid and arrow variants, including left/right/straight arrows)
- **Flashing lights**: flashing red, flashing yellow
- **Stop signs**: including temporary stop signs at construction zones
- **Speed limit signs**
- **Construction zone signage**
- **School zone indicators**
- **Yield signs**
- **Other regulatory and warning signs**

### Technical Approach

1. **Camera-primary detection**: traffic signals are primarily detected by cameras due to the need for color classification. Cameras can identify traffic signals from **hundreds of meters away**.
2. **LiDAR-assisted localization**: LiDAR confirms the 3D position and distance of detected signals; helps distinguish real signs from reflections or advertisements.
3. **HD Map prior**: traffic signal locations are pre-mapped in the HD map with 3D positions and orientations, providing strong spatial priors for detection.
4. **State classification**: deep learning models classify the current state (color, arrow direction) from camera imagery.

### Patent: Traffic Signal Mapping and Detection

**US20110182475A1** -- "Traffic signal mapping and detection":
- Automatically extrapolates 3D position, location, and orientation of traffic lights from two or more images.
- Generates 3D maps of traffic signal locations.
- Enables client devices to anticipate and predict traffic lights.

**US9707960** -- "Traffic signal response for autonomous vehicles":
- Determines whether a vehicle should continue through an intersection based on traffic signal state.

### Police Hand Signal Recognition

Waymo has trained its AI to detect and respond to arm movements of traffic controllers, demonstrating perception capability beyond standard traffic signals.

---

## 16. Lane Detection

### Approach: HD Map + Real-Time Perception

Waymo uses a **dual approach** combining pre-built HD maps with real-time perception:

#### HD Map Lane Information

HD maps contain detailed, pre-surveyed lane data:

| Element | Representation |
|---|---|
| **Lane centers** | Polylines defining the center of each lane |
| **Lane boundaries** | Polylines with boundary type (solid, dashed, double, etc.) |
| **Road boundaries** | Outer edges of the road surface |
| **Crosswalks** | Polygons defining pedestrian crossing areas |
| **Speed bumps** | Location and geometry |
| **Stop signs** | Point locations with orientation |
| **Driveways** | Entry/exit points |

Lane boundaries are stored as **protocol buffer segments** with start/end indices into the lane polyline, supporting multiple boundary types adjacent to a single lane as it passes different road features.

#### Real-Time Lane Perception

The Waymo Driver augments HD maps with real-time perception:
- Detects **construction zones** and **road closures** not reflected in maps.
- Identifies **temporary lane markings** and **detour routes**.
- Adapts to **snow-covered roads** where lane markings are obscured.
- Camera-based lane boundary detection provides redundancy against map errors.

#### EMMA's Lane Perception

The EMMA model produces **road graph elements** directly from camera imagery, including lane boundaries and road topology, as natural language text tokens. This provides a map-free perception capability for environments without HD map coverage.

---

## 17. Pedestrian and VRU Detection

### 17.1 Dedicated Architectures

#### STINet: Spatio-Temporal-Interactive Network (CVPR 2020)

([Paper](https://arxiv.org/abs/2005.04255))

- **Joint detection + trajectory prediction** for pedestrians.
- Models temporal information by predicting current and past locations in the first stage.
- Links pedestrians across frames for comprehensive spatio-temporal feature capture.
- **Interaction graph**: models interactions among neighboring objects.
- **Results**: 80.73 BEV detection AP, 33.67 cm trajectory ADE for pedestrians on WOD.

### 17.2 Keypoint and Pose Estimation

([Waymo Blog, Feb 2022](https://waymo.com/blog/2022/02/utilizing-key-point-and-pose-estimation/))

Waymo provides **14 body keypoints** for human pose estimation:
- Nose
- Right/Left Shoulder
- Right/Left Elbow
- Right/Left Wrist
- Right/Left Hip
- Right/Left Knee
- Right/Left Ankle

#### Detection Method

- Real-time keypoint localization from LiDAR point clouds and camera images using neural network models.
- Proprietary methodology generates high-quality 3D joint labels for training.
- Optimized for **real-time, low-latency** onboard execution.

#### Applications

| Capability | Description |
|---|---|
| **Gesture recognition** | Detects cyclist hand signals, traffic controller gestures from raw sensor data |
| **Partial occlusion understanding** | Interprets partially visible bodies (e.g., leg visible under a car door) |
| **Action prediction** | Distinguishes movement patterns (wheelchair user, jogger, child) for trajectory prediction |
| **Intent estimation** | Body orientation and pose reveal pedestrian crossing intent |

#### Related Papers

- **3D Human Keypoints Estimation From Point Clouds in the Wild Without Human Labels** (CVPR 2023): self-supervised keypoint detection from LiDAR without manual annotation.
- **HUM3DIL: Semi-supervised Multi-modal 3D Human Pose Estimation** (CoRL 2022): multi-modal pose estimation with limited labeled data.
- **Pedestrian Crossing Action Recognition and Trajectory Prediction with 3D Human Keypoints** (ICRA 2023): uses pose information to predict crossing behavior.
- **Multi-modal 3D Human Pose Estimation with 2D Weak Supervision** (2021): leverages weak 2D supervision for 3D pose.

### 17.3 Dataset Support

The Waymo Open Dataset provides:
- **172,600 object annotations** with 2D camera keypoints.
- **10,000 object annotations** with 3D LiDAR keypoints.
- Specifically annotated for pedestrians in diverse poses and occlusion levels.

---

## 18. Long-Range Perception

### The Challenge

At distances beyond 100 m, LiDAR point density drops dramatically (inverse-square relationship), making geometry-based detection unreliable. Waymo addresses this through multiple strategies:

### 18.1 Camera-Primary Long-Range Detection

- Cameras maintain resolution at distance (angular resolution is constant).
- **17-megapixel imagers** (6th gen) provide exceptional detail for distant objects.
- Can identify stop signs at **>500 m**.
- Traffic signal colors and temporary road signs are detected primarily by cameras at long range.

### 18.2 R4D: Reference-Based Distance Estimation (ICLR 2022)

([Paper](https://arxiv.org/abs/2206.04831))

- First framework for accurate **long-range distance estimation** using reference objects.
- Builds a graph connecting target objects to reference objects with known distances.
- **Attention module** weighs reference importance and combines them into a distance prediction.
- Inspiration: humans use contextual cues (known object sizes) to estimate distance.

### 18.3 Range-Conditioned LiDAR Processing (RCD)

([Paper](https://arxiv.org/abs/2005.09927))

- **Range-conditioned dilation**: dynamically adjusts convolution dilation rate as a function of measured range.
- At long range where points are sparse, larger dilation captures more context.
- At close range where points are dense, smaller dilation preserves detail.
- **Soft range gating**: localized gating improves robustness in occluded areas.
- Sets new baseline for range-based 3D detection with **unparalleled long-range performance**.

### 18.4 High-Resolution Forward LiDAR

- The 6th-generation system includes a **zooming LiDAR** that dynamically focuses on distant objects.
- Provides denser point clouds at extended ranges compared to standard scanning patterns.

### 18.5 MoDAR: Motion-Augmented Long-Range Detection

- Virtual points from motion forecasting (up to 18 seconds of context) specifically help **long-range and occluded objects**.
- Objects first seen at close range generate trajectory predictions that create virtual points at the object's predicted future/past positions.

### 18.6 Radar for Long-Range Backup

- Imaging radar detects objects at **>500 m** with instant Doppler velocity.
- Particularly effective for detecting approaching vehicles at highway speeds.
- Can detect motorcyclists from **hundreds of meters away**.

---

## 19. Non-ML Perception Components

### 19.1 Sensor Preprocessing

#### Image Signal Processing (ISP)

- **Auto-exposure**: adjusts exposure settings for varying lighting conditions (tunnels, direct sunlight, night).
- **HDR correction**: high dynamic range processing for simultaneous bright/dark regions.
- **Noise reduction**: sensor-specific denoising.
- **White balance**: color consistency across lighting conditions.
- **Lens distortion correction**: removes optical distortion using calibrated intrinsic parameters.
- **Rolling shutter correction**: compensates for row-by-row readout timing.

#### LiDAR Preprocessing

- **Range image formation**: raw laser returns organized into range images indexed by beam angle.
- **Multi-return processing**: first and strongest returns processed separately or jointly.
- **Near-field filtering**: removal of returns from the vehicle body or sensor housing.
- **Intensity normalization**: compensates for range-dependent intensity falloff.
- **Motion compensation**: per-point ego-motion correction using IMU and localization.

#### Radar Preprocessing

- **Clutter removal**: filtering ground reflections, multipath artifacts, and interference.
- **CFAR detection**: Constant False Alarm Rate thresholding for target detection.
- **Doppler processing**: FFT-based velocity estimation from phase shift.
- **MIMO beamforming**: synthesizing higher angular resolution from multiple transmit/receive antenna pairs.

### 19.2 Calibration

| Calibration Type | Method |
|---|---|
| **Camera intrinsics** | Focal length, principal point, distortion coefficients; factory-calibrated and refined in-field |
| **Camera-LiDAR extrinsics** | 4x4 transformation matrices mapping between sensor and vehicle frames |
| **Multi-LiDAR registration** | All LiDAR units registered to a common vehicle frame |
| **Camera-radar extrinsics** | Geometric alignment for cross-modal projection |
| **Temporal synchronization** | Hardware-triggered synchronization across all sensors; timestamps provided per measurement |
| **Online re-calibration** | Runtime monitoring and adjustment for thermal drift, vibration-induced changes |

### 19.3 Geometric Methods

- **Ground plane estimation**: RANSAC-based or learned ground segmentation for separating ground from above-ground objects.
- **Scan matching / ICP**: Iterative Closest Point for LiDAR-to-map alignment during localization.
- **Epipolar geometry**: for multi-camera depth estimation and cross-camera object matching.
- **Coordinate transformations**: rigid-body transforms between sensor, vehicle, and global frames.

### 19.4 Post-Processing

- **Non-Maximum Suppression (NMS)**: removes duplicate detections; oriented 3D IoU-based for 3D boxes.
- **Track smoothing**: Kalman filter or transformer-based state smoothing for jitter-free trajectories.
- **Confidence calibration**: ensuring detection confidence scores are well-calibrated probabilities.

---

## 20. Auto-Labeling and Data Engine

### 20.1 3D Auto Labeling Pipeline (3DAL)

Published at CVPR 2021 as **"Offboard 3D Object Detection from Point Cloud Sequences"** ([paper](https://arxiv.org/abs/2103.05073)):

#### Pipeline Architecture

```
Multi-frame LiDAR --> MVF++ Detector --> Per-frame 3D Boxes
                                              |
                                              v
                                     Multi-Object Tracker
                                              |
                                              v
                                    Object Track Extraction
                                              |
                                              v
                              Object-Centric Auto Labeling
                              (Static model / Dynamic model)
                                              |
                                              v
                                     Refined 3D Bounding Boxes
```

#### Key Design Principles

1. **Offboard processing**: not constrained by onboard latency; can use future frames for temporal context.
2. **Multi-frame aggregation**: the MVF++ detector uses multiple LiDAR frames for denser point clouds.
3. **Object-centric refinement**: specialized models for static and dynamic objects.
   - **Static object model**: aggregates all points from the track into a canonical frame for high-quality box estimation.
   - **Dynamic object model**: sliding window approach over the track, refining the center frame's box using temporal context.
4. **Motion state classification**: automatically classifies objects as static or dynamic to select the appropriate refinement model.

#### Quality

- Labels data **on a par with or better than expert human labelers**.
- Used to annotate the **Waymo Open Motion Dataset** (103,354 segments).
- **10x more data efficient** than training without augmentation.

### 20.2 Data Augmentation

**Automated Data Augmentation** ([Waymo Blog, Apr 2020](https://waymo.com/blog/2020/04/using-automated-data-augmentation-to/)):
- **LidarAugment** (ICRA 2023): automated search for optimal LiDAR data augmentation strategies.
- **PseudoAugment** (ECCV 2022): self-supervised augmentation using unlabeled point cloud data.
- Standard augmentations: random rotation, scaling, flipping, global/local translations, ground truth sampling, point dropout.

### 20.3 Active Learning and Data Selection

- **Data mining pipelines** find rare cases and situations where models are uncertain or inconsistent over time.
- **Active learning**: identifies the most informative unlabeled examples to send for annotation.
- Focus on **long-tail distribution**: most driving data is common scenarios; the challenge is finding rare, safety-critical cases.
- **Pseudo-labeling** (2021): self-training approach generating pseudo-labels to reduce manual annotation needs.

### 20.4 Semi-Supervised and Unsupervised Learning

- **SPG** (ICCV 2021): generates semantic points to recover missing object parts caused by occlusion, weather, or low reflectance, bridging domain gaps.
- **Motion Inspired Unsupervised Perception** (ECCV 2022): uses motion cues for self-supervised learning.
- **Unsupervised 3D Perception with 2D Vision-Language Distillation** (ICCV 2023): leverages vision-language models for unsupervised 3D perception.
- **Multi-Class 3D Detection with Single-Class Supervision** (ICRA 2022): enables multi-class detection from limited labeled supervision.

### 20.5 Long-Tail Handling

- **Improving Intra-class Long-tail in 3D Detection via Rare Example Mining** (ECCV 2022): systematically incorporates underrepresented object variations.
- **GradTail** (2021): gradient-based sample weighting for class-imbalanced perception data.

---

## 21. Foundation Model Integration

### 21.1 EMMA: End-to-End Multimodal Model for Autonomous Driving

Published October 2024 (arXiv: 2410.23262), accepted at ICLR 2025 ([paper](https://arxiv.org/abs/2410.23262)):

#### Architecture

| Component | Detail |
|---|---|
| **Base model** | Gemini 1.0 Nano-1 (smallest Gemini variant) |
| **Input** | Raw camera images + natural language text (navigation instructions, ego vehicle status, historical context) |
| **Output** | All outputs as natural language text tokens: planner trajectories, 3D object detections, road graph elements |
| **Training** | End-to-end fine-tuning on driving-specific tasks |
| **Multi-task** | Co-trained on motion planning, object detection, road graph prediction |

#### Task Formulation

EMMA recasts all driving tasks as **Visual Question Answering (VQA)** problems:
- **Motion planning**: "Given these camera views and navigation instruction, what trajectory should the ego vehicle follow?"
- **3D detection**: "What objects are visible and where are they in 3D space?"
- **Road graph**: "What are the lane boundaries and road topology?"

All non-sensor inputs and all outputs are encoded as **natural language text**, enabling unified processing.

#### Chain-of-Thought Reasoning

EMMA generates intermediate reasoning steps before producing final outputs:
- Improves planning performance by **6.7%**.
- Provides **interpretable rationale** for driving decisions.
- Inherits world knowledge from Gemini pre-training.

#### Performance

| Benchmark | Result |
|---|---|
| **nuScenes motion planning** | State-of-the-art |
| **WOMD** | Competitive |
| **WOD 3D detection (camera-only)** | Competitive |

#### Limitations

- Processes only a **small number of image frames** (limited context window vs. continuous driving).
- **No LiDAR or radar input** -- camera only.
- **Computationally expensive** -- LLM inference cost is high.
- Not yet deployed in production (research demonstration).

### 21.2 Waymo Foundation Model (Production)

The production Waymo Driver uses a foundation model with key differences from EMMA:

| Aspect | EMMA (Research) | Production Foundation Model |
|---|---|---|
| **Sensor inputs** | Camera only | Camera + LiDAR + radar + audio |
| **Architecture** | Single Gemini-based model | Dual System 1/System 2 architecture |
| **Perception** | Text-output 3D boxes | Dense embeddings + structured representations |
| **Processing** | Offline/batch | Real-time onboard |
| **Deployment** | Research paper | Serving hundreds of thousands of riders weekly |

The production model uses:
- **Sensor Fusion Encoder (System 1)**: processes all modalities in real time.
- **Driving VLM (System 2)**: Gemini-based reasoning for complex/novel scenarios.
- **World Decoder**: unified consumer producing predictions, maps, trajectories, and validation signals.
- **End-to-end training**: full backpropagation across all components.
- **Teacher-student distillation**: large models train compact onboard models.

### 21.3 MotionLM: Motion Forecasting as Language Modeling (ICCV 2023)

([Paper](https://arxiv.org/abs/2309.16534))

Bridges language modeling and autonomous driving:
- Represents continuous trajectories as **discrete motion tokens** from a finite vocabulary.
- Casts multi-agent prediction as **autoregressive language modeling**.
- No anchors or latent variable optimization needed -- uses standard language modeling objective (maximize average log probability over tokens).
- Produces **joint distributions** over interactive agent futures in a single decoding process (no post-hoc interaction heuristics).
- **Temporally causal**: supports conditional rollouts.
- **#1 on WOMD interactive challenge leaderboard**; improves ranking joint mAP by **+6%**.

---

## 22. Key Patents

Waymo holds an extensive patent portfolio with **3,476 patents globally** (1,898 granted), with a **97.07% grant rate**. The top citing companies are Ford Motor, Toyota, and GM Global Technology Operations. Below are notable perception-related patents:

### LiDAR Technology

| Patent | Title/Description |
|---|---|
| **US9,383,753B1** | Most-cited patent in Waymo portfolio (344 citations from Uber, Luminar, Qualcomm); LiDAR-related |
| **US9,097,800** | LiDAR system generating 3D point map of the area surrounding the vehicle |
| **US9,086,273** | LiDAR sensor technology for autonomous vehicles |
| **US8,195,394** | Early LiDAR/sensor patent (one of the earliest in the portfolio) |

### Traffic Signal and Detection

| Patent | Title/Description |
|---|---|
| **US20110182475A1** | Traffic signal mapping and detection -- automatically extrapolates 3D position of traffic lights from multiple images |
| **US9,707,960** | Traffic signal response for autonomous vehicles -- determines whether to proceed through an intersection |

### Sensor Fusion and 3D Detection

| Patent | Title/Description |
|---|---|
| **US11,733,369** | Techniques for 3D object detection and localization using radar units and neural networks for processing sensor data |

### Portfolio Overview

- **Total patents globally**: 3,476
- **Granted patents**: 1,898
- **Active patents**: >92%
- **Patent applications at USPTO**: 1,237
- **Granted at USPTO**: 929
- **20+ patent families** related to LiDAR sensors alone
- Portfolio extends from patent **8,195,394** through **12,352,900+**

Waymo's patents page lists over 1,000 patent numbers that may cover their ride-hailing service ([waymo.com/legal/patents](https://waymo.com/legal/patents/)).

---

## 23. Key Papers

### Comprehensive Publication List (Perception-Related)

Waymo has published **60+ perception-related papers** across top venues. Publication distribution: CVPR (24), ECCV (13), ICLR (3), NeurIPS (6), ICCV, ICRA, CoRL, IROS, and others.

#### 3D Object Detection

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **Scalability in Perception for Autonomous Driving: Waymo Open Dataset** | CVPR | 2020 | Foundational large-scale perception dataset; 2,030 segments with 2D+3D labels |
| **StarNet: Targeted Computation for Object Detection in Point Clouds** | NeurIPS WS | 2019 | Point-based detector; data-dependent anchors; +7 mAP on pedestrians |
| **End-to-End Multi-View Fusion for 3D Object Detection in LiDAR Point Clouds (MVF)** | CoRL | 2019 | Dynamic voxelization; BEV + perspective fusion |
| **Range Conditioned Dilated Convolutions for Scale Invariant 3D Object Detection (RCD)** | CoRL | 2020 | Range-conditioned dilation; SOTA long-range detection |
| **RSN: Range Sparse Net for Efficient, Accurate LiDAR 3D Object Detection** | CVPR | 2021 | Foreground selection from range images; >60 FPS; #1 on WOD |
| **To the Point: Efficient 3D Object Detection in the Range Image with Graph Convolution Kernels** | CVPR | 2021 | Graph convolutions on range images |
| **3D-MAN: 3D Multi-frame Attention Network for Object Detection** | CVPR | 2021 | Temporal attention with memory bank; 78.71% AP vehicles |
| **Offboard 3D Object Detection from Point Cloud Sequences** | CVPR | 2021 | 3D auto-labeling pipeline; on par with human labelers |
| **SWFormer: Sparse Window Transformer for 3D Object Detection in Point Clouds** | ECCV | 2022 | Sparse window attention; voxel diffusion; 73.36 L2 mAPH |
| **LidarNAS: Unifying and Searching Neural Architectures for 3D Point Clouds** | ECCV | 2022 | Unified NAS framework; evolutionary architecture search |
| **Improving the Intra-class Long-tail in 3D Detection via Rare Example Mining** | ECCV | 2022 | Long-tail handling in 3D detection |
| **Multi-Class 3D Object Detection with Single-Class Supervision** | ICRA | 2022 | Semi-supervised multi-class detection |
| **MoDAR: Using Motion Forecasting for 3D Object Detection in Point Cloud Sequences** | CVPR | 2023 | Virtual points from motion forecasting; +11.1 mAPH over CenterPoint |
| **PVTransformer: Point-to-Voxel Transformer for Scalable 3D Object Detection** | ICRA | 2024 | Attention-based point-to-voxel; 76.5 L2 mAPH |
| **Streaming Object Detection for 3-D Point Clouds** | ECCV | 2020 | Pipelined inference on streaming LiDAR; 30 ms latency |

#### Sensor Fusion

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **DeepFusion: Lidar-Camera Deep Fusion for Multi-Modal 3D Object Detection** | CVPR | 2022 | InverseAug + LearnableAlign; deep feature fusion |
| **4D-Net for Learned Multi-Modal Alignment** | ICCV | 2021 | 4D (3D+time) multi-modal fusion; 32 LiDAR + 16 camera frames |
| **CramNet: Camera-Radar Fusion with Ray-Constrained Cross-Attention** | ECCV | 2022 | Ray-constrained attention; modality dropout |
| **LEF: Late-to-Early Temporal Fusion for LiDAR 3D Object Detection** | IROS | 2023 | Late-to-early recurrent fusion; FrameDrop training |

#### Tracking

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **SoDA: Multi-Object Tracking with Soft Data Association** | arXiv | 2020 | Attention-based soft associations; learned occlusion reasoning |
| **STT: Stateful Tracking with Transformers for Autonomous Driving** | ICRA | 2024 | Joint association + state estimation; S-MOTA metric |
| **Depth Estimation Matters Most: Improving Per-Object Depth for Monocular 3D Detection and Tracking** | ICRA | 2022 | Depth estimation for camera-based tracking |

#### Segmentation

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **Waymo Open Dataset: Panoramic Video Panoptic Segmentation** | ECCV | 2022 | 28-class panoptic segmentation; 5 cameras; 100k images |
| **LESS: Label-Efficient Semantic Segmentation for LiDAR Point Clouds** | ECCV | 2022 | 0.1% labels competitive with full supervision |
| **Instance Segmentation with Cross-Modal Consistency** | IROS | 2022 | Camera-LiDAR consistency for instance segmentation |
| **Superpixel Transformers for Efficient Semantic Segmentation** | ICCV | 2023 | Superpixel-level attention; SOTA efficiency |
| **3D Open-Vocabulary Panoptic Segmentation with 2D-3D Vision-Language Distillation** | ECCV | 2024 | Open-vocabulary; CLIP + LiDAR; novel class detection |

#### Prediction and Motion Forecasting

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **VectorNet: Encoding HD Maps and Agent Dynamics from Vectorized Representation** | CVPR | 2020 | Hierarchical GNN; 18% better than ResNet-18 at 29% params |
| **MultiPath: Multiple Probabilistic Anchor Trajectory Hypotheses** | CoRL | 2019 | Fixed anchors; Gaussian mixture outputs |
| **MultiPath++: Efficient Information Fusion and Trajectory Aggregation** | ICRA | 2022 | Learned anchors; multi-context gating fusion |
| **Scene Transformer: A Unified Architecture for Predicting Multiple Agent Trajectories** | ICLR | 2022 | Joint multi-agent prediction; factorized attention |
| **MotionLM: Multi-Agent Motion Forecasting as Language Modeling** | ICCV | 2023 | Discrete motion tokens; autoregressive decoding; #1 WOMD |
| **STINet: Spatio-Temporal-Interactive Network for Pedestrian Detection and Trajectory Prediction** | CVPR | 2020 | Joint detection + prediction; interaction graph |
| **Occupancy Flow Fields for Motion Forecasting in Autonomous Driving** | RA-L | 2022 | Occupancy + flow grid; speculative agents |

#### Pedestrian and Human Pose

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **3D Human Keypoints Estimation From Point Clouds in the Wild Without Human Labels** | CVPR | 2023 | Self-supervised keypoint detection from LiDAR |
| **HUM3DIL: Semi-supervised Multi-modal 3D Human Pose Estimation** | CoRL | 2022 | Multi-modal pose with limited labels |
| **Pedestrian Crossing Action Recognition and Trajectory Prediction with 3D Human Keypoints** | ICRA | 2023 | Pose-informed crossing prediction |
| **Multi-modal 3D Human Pose Estimation with 2D Weak Supervision** | arXiv | 2021 | Weak 2D supervision for 3D pose |

#### Domain Adaptation and Data Efficiency

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **SPG: Unsupervised Domain Adaptation for 3D Object Detection via Semantic Point Generation** | ICCV | 2021 | Semantic point generation; recovers missing object parts |
| **Unsupervised 3D Perception with 2D Vision-Language Distillation** | ICCV | 2023 | VLM-based unsupervised 3D perception |
| **Motion Inspired Unsupervised Perception and Prediction** | ECCV | 2022 | Self-supervised from motion cues |
| **Pseudo-labeling for Scalable 3D Object Detection** | arXiv | 2021 | Self-training with pseudo-labels |
| **LidarAugment: Searching for Scalable 3D LiDAR Data Augmentations** | ICRA | 2023 | Automated augmentation search |
| **PseudoAugment: Learning to Use Unlabeled Data for Data Augmentation in Point Clouds** | ECCV | 2022 | Self-supervised point cloud augmentation |

#### Camera Perception and Distance Estimation

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **R4D: Utilizing Reference Objects for Long-Range Distance Estimation** | ICLR | 2022 | Reference-based depth; graph + attention |
| **LET-3D-AP: Longitudinal Error Tolerant 3D Average Precision for Camera-Only 3D Detection** | ICRA | 2024 | Fair camera-3D evaluation metric |

#### Scene Reconstruction

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **Block-NeRF: Scalable Large Scene Neural View Synthesis** | CVPR | 2022 | City-scale NeRF; 2.8M images; entire SF neighborhood |
| **GINA-3D: Learning to Generate Implicit Neural Assets in the Wild** | CVPR | 2023 | 3D asset generation from sensor data |
| **NeRDi: Single-View NeRF Synthesis with Language-Guided Diffusion** | CVPR | 2023 | Single-image 3D reconstruction |

#### Compression and Efficiency

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **RIDDLE: LiDAR Data Compression with Range Image Deep Delta Encoding** | CVPR | 2022 | Learned LiDAR data compression |

#### End-to-End and Foundation Models

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **EMMA: End-to-End Multimodal Model for Autonomous Driving** | ICLR | 2025 | Gemini-based; VQA formulation; chain-of-thought; SOTA nuScenes planning |

#### Scene Flow

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **Scalable Scene Flow from Point Clouds in the Real World** | arXiv | 2021 | 1,000x larger real-world scene flow dataset |

---

## 24. Open Dataset Design

### Dataset Overview

The **Waymo Open Dataset** (WOD) is one of the largest and most comprehensive autonomous driving datasets, reflecting Waymo's perception architecture and priorities.

### Dataset Components

| Dataset | Segments | Description |
|---|---|---|
| **Perception Dataset** | 2,030 (20 sec each) | High-resolution synchronized LiDAR + camera data with exhaustive 2D + 3D labels |
| **Motion Dataset** | 103,354 | Object trajectories + 3D maps for behavior prediction and motion forecasting |
| **End-to-End Driving Dataset** | -- | Raw sensor data supporting end-to-end driving research |

### Sensor Configuration (Reflected in Dataset)

| Sensor | Count | Key Specifications |
|---|---|---|
| **LiDAR (top)** | 1 | 64-beam, 360-degree rotation, dual returns (first + strongest) |
| **LiDAR (perimeter)** | 4 | Short-range surround coverage |
| **Total LiDAR points/frame** | ~177,000-300,000 | After fusing all 5 LiDAR units |
| **Cameras** | 5 | Front, Front-Left, Front-Right, Side-Left, Side-Right |
| **Camera resolution** | 1920 x 1280 | Downsampled/cropped from raw sensor images |
| **Camera HFOV** | ~50.4 degrees | Per camera |
| **Frame rate** | 10 Hz | LiDAR and camera synchronized |
| **Segment length** | 20 seconds | 200 frames per segment |

### Label Types

| Label Type | Details |
|---|---|
| **3D bounding boxes (LiDAR)** | 7-DOF (center, dimensions, heading) in vehicle frame; tracking IDs; classes: Vehicle, Pedestrian, Cyclist, Sign |
| **2D bounding boxes (camera)** | Axis-aligned tight-fitting; tracking IDs; classes: Vehicle, Pedestrian, Cyclist |
| **LiDAR semantic segmentation** | 23 classes at 2 Hz for every point from the top LiDAR |
| **Camera semantic segmentation** | 28 classes for 100k images across 2,860 sequences |
| **Camera instance segmentation** | Instance masks for the same 100k image subset |
| **2D keypoints (camera)** | 172,600 object annotations with 14 body keypoints |
| **3D keypoints (LiDAR)** | 10,000 object annotations |
| **No Label Zones (NLZ)** | Polygons in global frame marking unlabeled areas; boolean per-point annotation |

### Difficulty Levels

| Level | Definition |
|---|---|
| **LEVEL_1** | Objects with >= 5 LiDAR points inside the 3D box |
| **LEVEL_2** | Objects with >= 1 LiDAR point inside the 3D box |

### Evaluation Metrics

| Metric | Description |
|---|---|
| **AP** | Average Precision (area under precision-recall curve) |
| **APH** | Average Precision weighted by Heading accuracy |
| **mAPH** | Mean APH across classes |
| **MOTA/MOTP** | Multi-Object Tracking Accuracy / Precision |
| **S-MOTA / MOTPS** | Waymo-proposed stateful tracking metrics |
| **Soft IoU** | For occupancy prediction |
| **AUC** | For flow-grounded occupancy |
| **ADE / FDE** | Average / Final Displacement Error for trajectories |

### Challenge Tracks

The Waymo Open Dataset hosts annual challenges (in conjunction with CVPR):

1. **3D Detection** (LiDAR and camera)
2. **3D Tracking**
3. **2D Detection** (camera)
4. **2D Tracking** (camera)
5. **LiDAR Semantic Segmentation**
6. **Camera Semantic Segmentation**
7. **Motion Prediction**
8. **Occupancy and Flow Prediction**
9. **Sim Agents**
10. **Keypoint Detection**

### How the Dataset Reflects Waymo's Architecture

The Waymo Open Dataset design choices reveal key aspects of Waymo's internal perception architecture:

1. **Range image format**: LiDAR data is released as range images, suggesting Waymo's internal pipeline processes range images natively (confirmed by RSN, RCD, To the Point papers).
2. **Independent LiDAR and camera labels**: 3D boxes are independently annotated in LiDAR (not projected from camera or vice versa), reflecting Waymo's multi-modal independent processing before fusion.
3. **23-class LiDAR segmentation**: the granular class taxonomy (e.g., distinguishing Tree Trunk from Vegetation, Curb from Sidewalk) reflects the needs of Waymo's planning system.
4. **Tracking IDs across modalities**: globally unique IDs enable cross-modal association research, mirroring Waymo's internal tracking approach.
5. **Occupancy and flow challenges**: directly reflect Waymo's internal use of occupancy representations for motion forecasting.
6. **Keypoint annotations**: reflects Waymo's investment in pose estimation for VRU understanding.
7. **Auto-labeled motion dataset**: the 103,354-segment motion dataset was labeled using the 3DAL auto-labeling pipeline, demonstrating Waymo's confidence in and reliance on automated annotation.

---

## Appendix: Key Numbers at a Glance

| Metric | Value |
|---|---|
| **Total autonomous miles** | >200 million (as of 2026) |
| **Total simulated miles** | >20 billion |
| **Weekly rides** | >450,000 (scaling toward 1M) |
| **Sensor data throughput** | ~20 GB/s per vehicle |
| **End-to-end latency** | ~3 ms (sensor to actuation) |
| **LiDAR frame rate** | 10 Hz |
| **Camera resolution (6th gen)** | 17 megapixels |
| **Max detection range (camera + radar)** | >500 m |
| **Max LiDAR range** | >300 m |
| **3D detection SOTA (PVTransformer)** | 76.5 L2 mAPH on WOD |
| **Pedestrian detection (STINet)** | 80.73 BEV AP |
| **Pedestrian trajectory ADE** | 33.67 cm |
| **Prediction horizon** | 8-11 seconds |
| **Waymo Open Dataset segments (perception)** | 2,030 |
| **Waymo Open Dataset segments (motion)** | 103,354 |
| **LiDAR semantic segmentation classes** | 23 |
| **Camera segmentation classes** | 28 |
| **Body keypoints per person** | 14 |
| **NAS architectures explored** | >10,000 |
| **Patent portfolio** | 3,476 globally (1,898 granted) |
| **Perception papers published** | 60+ |

---

## Sources

### Waymo Official
- [Waymo Driver Technology](https://waymo.com/waymo-driver/)
- [Waymo Driver Handbook: Perception](https://waymo.com/blog/2021/10/the-waymo-driver-handbook-perception/)
- [AI and ML at Waymo](https://waymo.com/blog/2024/10/ai-and-ml-at-waymo/)
- [Demonstrably Safe AI for Autonomous Driving](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)
- [6th Generation Waymo Driver](https://waymo.com/blog/2024/08/meet-the-6th-generation-waymo-driver/)
- [6th Gen Autonomous Operations](https://waymo.com/blog/2026/02/ro-on-6th-gen-waymo-driver/)
- [AutoML for Autonomous Driving](https://waymo.com/blog/2019/01/automl-automating-design-of-machine)
- [Keypoint and Pose Estimation](https://waymo.com/blog/2022/02/utilizing-key-point-and-pose-estimation/)
- [Waymo Research Publications](https://waymo.com/research/)
- [Waymo Open Dataset](https://waymo.com/open/about/)
- [Waymo Patents](https://waymo.com/legal/patents/)
- [LiDAR Solutions](https://waymo.com/blog/2022/09/informing-smarter-lidar-solutions-/)

### Papers (arXiv / Conference Proceedings)
- [EMMA (arXiv:2410.23262)](https://arxiv.org/abs/2410.23262)
- [SWFormer (arXiv:2210.07372)](https://arxiv.org/abs/2210.07372)
- [DeepFusion (arXiv:2203.08195)](https://arxiv.org/abs/2203.08195)
- [VectorNet (arXiv:2005.04259)](https://arxiv.org/abs/2005.04259)
- [MultiPath++ (Waymo Research)](https://waymo.com/research/multipath++-efficient-information-fusion-and-trajectory-aggregation-for-behavior-prediction/)
- [CramNet (arXiv:2210.09267)](https://arxiv.org/abs/2210.09267)
- [4D-Net (arXiv:2109.01066)](https://arxiv.org/abs/2109.01066)
- [LEF (arXiv:2309.16870)](https://arxiv.org/abs/2309.16870)
- [STINet (arXiv:2005.04255)](https://arxiv.org/abs/2005.04255)
- [SoDA (Waymo Research)](https://waymo.com/research/soda-multi-object-tracking-with-soft-data-association/)
- [STT (arXiv:2405.00236)](https://arxiv.org/abs/2405.00236)
- [MotionLM (arXiv:2309.16534)](https://arxiv.org/abs/2309.16534)
- [Scene Transformer (arXiv:2106.08417)](https://arxiv.org/abs/2106.08417)
- [Offboard 3D Detection (arXiv:2103.05073)](https://arxiv.org/abs/2103.05073)
- [RSN (CVPR 2021)](https://openaccess.thecvf.com/content/CVPR2021/papers/Sun_RSN_Range_Sparse_Net_for_Efficient_Accurate_LiDAR_3D_Object_CVPR_2021_paper.pdf)
- [RCD (arXiv:2005.09927)](https://arxiv.org/abs/2005.09927)
- [PVTransformer (arXiv:2405.02811)](https://arxiv.org/abs/2405.02811)
- [LidarNAS (arXiv:2210.05018)](https://arxiv.org/abs/2210.05018)
- [MoDAR (arXiv:2306.03206)](https://arxiv.org/abs/2306.03206)
- [R4D (arXiv:2206.04831)](https://arxiv.org/abs/2206.04831)
- [Block-NeRF (CVPR 2022)](https://waymo.com/research/block-nerf/)
- [Occupancy Flow Fields (arXiv:2203.03875)](https://arxiv.org/abs/2203.03875)
- [LESS (ECCV 2022)](https://arxiv.org/abs/2210.08064)
- [Superpixel Transformers (arXiv:2309.16889)](https://arxiv.org/abs/2309.16889)
- [3D Open-Vocab Panoptic Seg. (arXiv:2401.02402)](https://arxiv.org/abs/2401.02402)
- [SPG (arXiv:2108.06709)](https://arxiv.org/abs/2108.06709)
- [RIDDLE (CVPR 2022)](https://waymo.com/research/riddle-lidar-data-compression-with-range-image-deep-delta-encoding/)
- [Streaming Detection (ECCV 2020)](https://waymo.com/research/streaming-object-detection-for-3-d-point-clouds/)
- [Scalable Scene Flow (2021)](https://waymo.com/research/scalable-scene-flow-from-point-clouds-in-the-real-world/)
- [WOD CVPR 2020 Paper](https://openaccess.thecvf.com/content_CVPR_2020/papers/Sun_Scalability_in_Perception_for_Autonomous_Driving_Waymo_Open_Dataset_CVPR_2020_paper.pdf)

### Third-Party Analysis
- [Waymo Patent Analysis (GreyB)](https://insights.greyb.com/waymo-patents/)
- [Waymo Technical Study (Medium)](https://justinkek.medium.com/alphabets-waymo-a-technical-study-on-autonomous-vehicle-tech-c128180ab2c5)
- [Google Research Blog: DeepFusion](https://research.google/blog/lidar-camera-deep-fusion-for-multi-modal-3d-detection/)
- [Google Research Blog: 4D-Net](https://research.google/blog/4d-net-learning-multi-modal-alignment-for-3d-and-image-inputs-in-time/)
