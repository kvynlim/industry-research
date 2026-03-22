# Motional Perception Stack: Exhaustive Deep Dive

*Last updated: March 2026*

---

## Table of Contents

1. [nuTonomy Heritage](#1-nutonomy-heritage)
2. [Sensor Fusion Architecture](#2-sensor-fusion-architecture)
3. [LiDAR Perception](#3-lidar-perception)
4. [Camera Perception](#4-camera-perception)
5. [Radar Perception](#5-radar-perception)
6. [3D Object Detection](#6-3d-object-detection)
7. [Object Tracking](#7-object-tracking)
8. [Prediction](#8-prediction)
9. [Large Driving Models (LDM) Pivot](#9-large-driving-models-ldm-pivot)
10. [nuScenes Dataset Architecture](#10-nuscenes-dataset-architecture)
11. [nuPlan Planning Dataset](#11-nuplan-planning-dataset)
12. [Semantic Segmentation](#12-semantic-segmentation)
13. [Occupancy Prediction](#13-occupancy-prediction)
14. [BEV Representation](#14-bev-representation)
15. [Temporal Fusion](#15-temporal-fusion)
16. [Traffic Infrastructure](#16-traffic-infrastructure)
17. [Pedestrian Detection](#17-pedestrian-detection)
18. [Non-ML Components](#18-non-ml-components)
19. [Auto-Labeling](#19-auto-labeling)
20. [Key Papers](#20-key-papers)
21. [Key Patents](#21-key-patents)
22. [Perception Metrics](#22-perception-metrics)

---

## 1. nuTonomy Heritage

### Founding and Formal Methods Roots

Motional's perception stack traces its intellectual lineage to **nuTonomy**, co-founded in 2013 by **Dr. Karl Iagnemma** (director of MIT's Robotic Mobility Group) and **Dr. Emilio Frazzoli** (MIT professor of Aeronautics and Astronautics, now at ETH Zurich). nuTonomy was a spinout from MIT research with a distinguishing technical philosophy: the use of **formal methods** -- formal logic, sampling-based motion planning, and model checking -- to produce provably correct autonomous driving behaviors.

| Attribute | Detail |
|---|---|
| **Founded** | 2013, as MIT spinout |
| **Technical Distinction** | Formal logic-based decision making; provable safety guarantees |
| **Key IP** | Sampling-based motion planning with completeness, correctness, and optimality guarantees |
| **Acquired By** | Delphi Automotive (now Aptiv) for ~$450M in October 2017 |

### Singapore Deployment: The World's First Robotaxi

In **August 2016**, nuTonomy launched the **world's first public robotaxi pilot** in Singapore's one-north business district, using modified Renault Zoes and Mitsubishi i-MiEVs. The perception system for this deployment was comparatively early-generation but established several foundational principles that persist in Motional's architecture today:

- **Multi-modal sensing**: The Singapore vehicles carried LiDARs on the roof and around the front bumper, radar, and cameras providing near-complete surround coverage -- establishing the pattern of overlapping multi-sensor fields of view that Motional's IONIQ 5 would later scale to 30+ sensors.
- **LiDAR-centric localization**: nuTonomy used LiDAR data as the primary source for localization, providing more accurate determination of the vehicle's position within its environment than GPS alone.
- **Formal logic for behavior**: Rather than purely reactive control, nuTonomy's cars used decision-making software based on formal logic. As Karl Iagnemma described it: "a rigorous algorithmic process that's translating specifications on how the car should behave into verifiable software." The formal logic told the taxis when low-priority "rules of the road" could be broken safely (e.g., crossing a center line to navigate around a double-parked vehicle) while maintaining safety invariants.

### Perception Architecture Evolution: nuTonomy to Motional

The progression from nuTonomy to Motional represents three distinct architectural eras:

**Era 1: nuTonomy (2013-2017) -- Formal Methods + Classical Perception**
- Classical computer vision and early deep learning for object detection
- LiDAR-centric perception with camera augmentation
- Formal methods for decision making with provable guarantees
- Rule-based behavior specifications using formal languages and model checking
- Compositional data-driven approaches for formal collision risk estimation

**Era 2: Aptiv/Early Motional (2017-2024) -- Modular ML Stack**
- Progressive replacement of classical perception with deep neural networks
- Introduction of PointPillars, PointPainting, and other ML-based detectors
- Modular pipeline: Perception --> Prediction --> Planning --> Control
- Each module independently developed and optimized
- Transformer neural networks (TNNs) adopted for perception
- BEV representations introduced for multi-camera fusion

**Era 3: AI-First / LDM (2024-present) -- End-to-End Foundation Models**
- Perception integrated into Large Driving Models (LDMs) as part of unified perception-prediction-planning
- Shared transformer backbone across all modules
- End-to-end training replacing stitched module outputs
- Safety guardrail system running in parallel for edge cases
- Embodied foundation models trained on diverse multi-city datasets

### Key nuTonomy/Motional Perception Researchers

| Name | Role | Key Contributions |
|---|---|---|
| **Oscar Beijbom** | Sr. Director of ML at Motional (now at Zoox/Nyckel) | nuScenes, PointPillars, PointPainting; PhD in CV/ML from UCSD |
| **Holger Caesar** | Research Scientist (now Asst. Prof. at TU Delft) | nuScenes, nuPlan, Panoptic nuScenes |
| **Alex H. Lang** | Research Scientist (later at Waymo) | PointPillars, PointPainting |
| **Sourabh Vora** | ML Research Engineer | PointPillars, PointPainting |
| **Whye Kit Fong** | Research Scientist | Panoptic nuScenes, nuScenes expansions |
| **Lubing Zhou** | Research Scientist | PointPillars, Panoptic nuScenes |

---

## 2. Sensor Fusion Architecture

### IONIQ 5 Robotaxi Sensor Suite

The Hyundai IONIQ 5 robotaxi carries an industry-leading **30+ sensor** configuration providing 360-degree perception with redundant overlapping coverage:

| Sensor Type | Count | Specifications | Role |
|---|---|---|---|
| **Cameras** | 13 | Multiple focal lengths and FOVs; varying lenses for near-field and far-field | High-resolution imaging, object classification, lane/sign recognition |
| **Radar** | 11 | Aptiv FLR4+ long-range radars; 360-degree coverage; 200m+ range; 77GHz mmWave | Doppler velocity measurement, all-weather detection, AEB |
| **LiDAR (Long-Range)** | 1+ | Ouster Alpha Prime VLS-128; 300m range; 0.1-degree resolution; 360-degree | Primary 3D depth sensing, surround point cloud |
| **LiDAR (Short-Range)** | 4 | Hesai Technology units | Close-range around-vehicle coverage |
| **GPS** | Yes | Position reference | Coarse localization |
| **IMU** | Yes | Inertial measurement | Motion tracking, ego-motion estimation |

**Key design principle**: Hyundai and Motional teams spent months co-designing sensor placement locations for every sensor. Unlike earlier AV platforms where sensors were bolted on as aftermarket additions, the IONIQ 5's sensors are aesthetically integrated into the body design while achieving 360-degree perception with no blind spots.

### Fusion Architecture: Multi-Level, Multi-Modal

Motional's sensor fusion operates at multiple levels, combining data from all three primary modalities (camera, LiDAR, radar) using neural network-based fusion:

```
                        ┌─────────────────────────────────────┐
                        │         Unified BEV Feature Space    │
                        │   (Bird's-Eye View Representation)   │
                        └──────────────┬──────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
            ┌───────┴───────┐  ┌──────┴──────┐  ┌───────┴───────┐
            │ Camera Branch │  │ LiDAR Branch│  │ Radar Branch  │
            │               │  │             │  │               │
            │ 13 cameras    │  │ 5+ LiDARs   │  │ 11 radars     │
            │ Image backbone│  │ Voxelization│  │ Point cloud   │
            │ View transform│  │ 3D backbone │  │ ML processing │
            │ --> BEV feats │  │ --> BEV feats│  │ --> BEV feats │
            └───────────────┘  └─────────────┘  └───────────────┘
```

#### Level 1: Point-Level Fusion (PointPainting)

Motional's first major fusion approach, **PointPainting** (CVPR 2020), established a sequential fusion paradigm:

1. Run a 2D image semantic segmentation network on camera images
2. Project LiDAR points into the segmented image space
3. Append per-class segmentation scores to each LiDAR point
4. Feed the "painted" point cloud to any LiDAR-only 3D detector

This approach allowed LiDAR detectors (PointPillars, VoxelNet, PointRCNN) to benefit from camera semantic information without requiring architectural modifications to the detector itself. On the nuScenes benchmark, PointPainting improved detection performance across all tested backbones.

#### Level 2: Neural Network Point Cloud Fusion (LiDAR + Radar)

Motional uses a **neural network to fuse LiDAR and radar point clouds**, preserving more information than processing each point cloud separately. The fused LiDAR-radar point cloud is then combined with camera data via PointPainting, creating a three-modality fusion:

```
Radar Point Cloud ──┐
                    ├── Neural Net Fusion ──> Fused Point Cloud ──> PointPainting with Camera ──> Detection
LiDAR Point Cloud ──┘
```

This approach is significant because radar provides instantaneous Doppler velocity measurements that neither LiDAR nor cameras can directly measure, while LiDAR provides precise 3D geometry that radar lacks.

#### Level 3: BEV-Space Fusion (TransFusion / BEVFusion)

More recent fusion approaches operate in the BEV feature space, where features from all modalities are projected into a common bird's-eye-view representation:

- **TransFusion** (CVPR 2022) uses a **soft-association mechanism** via transformer attention to fuse LiDAR and camera features, avoiding the brittleness of hard geometric projection. A two-layer transformer decoder first generates initial bounding boxes from LiDAR, then adaptively fuses with camera features using attention-based spatial and contextual relationships.

- **BEVFusion** (ICRA 2023, MIT Han Lab) unifies multi-modal features in a shared BEV space, applying modality-specific encoders before transforming all features into BEV. It achieves 1.3% higher mAP/NDS on nuScenes detection and 13.6% higher mIoU on BEV map segmentation with 1.9x lower computation cost.

#### Level 4: End-to-End LDM Fusion (Current Architecture)

In Motional's current LDM architecture, sensor fusion is subsumed into the end-to-end model. Raw sensor inputs from all modalities feed into the Large Driving Model, which jointly learns perception, prediction, and planning representations. This eliminates the information loss that occurred at module boundaries in the modular stack.

### Redundancy and Graceful Degradation

The 30+ sensor configuration provides multiple layers of redundancy:

- **Cross-modal redundancy**: Any single sensor failure (e.g., a camera failure) is compensated by other modalities (LiDAR, radar) covering the same region
- **Within-modality redundancy**: 13 cameras provide overlapping fields of view; 11 radars provide 360-degree coverage with overlap
- **Weather resilience**: Radar maintains functionality in rain, snow, fog, and darkness where cameras and LiDAR may degrade
- **Range coverage**: Long-range LiDAR (300m) and radar (200m+) cover far-field; short-range LiDAR and cameras cover near-field

---

## 3. LiDAR Perception

### Hardware: Ouster Alpha Prime VLS-128 (Long-Range)

| Specification | Value |
|---|---|
| **Supplier** | Ouster (exclusive long-range LiDAR supplier through 2026) |
| **Model** | Alpha Prime VLS-128 |
| **Beams** | 128 channels |
| **Range** | Up to 300 meters |
| **Resolution** | Up to 0.1-degree vertical and horizontal |
| **Coverage** | 360-degree surround view |
| **Data Output** | Real-time 3D point cloud |
| **Points/Second** | Up to ~2.6 million (128 channels x 20Hz rotation) |

The Alpha Prime VLS-128 represents a significant upgrade from the **Velodyne HDL-32E** (32-beam, 70m range, ~1.39M pts/sec) used in the nuScenes data collection era. The 4x increase in beam count and 4x increase in range provide substantially denser point clouds at greater distances, improving detection of small objects (pedestrians, cyclists) at long range.

### Hardware: Hesai Technology (Short-Range)

| Specification | Value |
|---|---|
| **Supplier** | Hesai Technology |
| **Count** | 4 units per vehicle |
| **Coverage** | Close-range, around-the-car perimeter |
| **Purpose** | Near-field blind spot coverage, low-speed maneuvering, parking |

The Hesai units fill the near-field coverage gaps that the roof-mounted Ouster cannot see (e.g., small objects directly adjacent to the vehicle, curbs, low obstacles).

### Historical Context: Velodyne HDL-32E (nuScenes Era)

The nuScenes dataset was collected using a **Velodyne HDL-32E**, which constrains the characteristics of all models trained and evaluated on nuScenes:

| Specification | Value |
|---|---|
| **Beams** | 32 |
| **Capture Frequency** | 20 Hz |
| **Points per Ring** | ~1,080 (+/- 10) |
| **Usable Range** | Up to 70 meters |
| **Accuracy** | +/- 2 cm |
| **Points/Second** | Up to ~1.39 million |

### LiDAR Point Cloud Processing Pipeline

Motional's LiDAR processing follows a well-established pipeline that has evolved through their published research:

```
Raw Point Cloud --> Preprocessing --> Feature Extraction --> Detection Head --> 3D Bounding Boxes
                        │                    │                    │
                   - Range filter       - Voxelization       - Heatmap head
                   - Ground removal       (VoxelNet)           (center detection)
                   - Ego-motion comp.   - Pillarization      - Regression heads
                   - Multi-sweep         (PointPillars)        (size, orientation,
                     aggregation        - Sparse 3D conv        velocity)
                                        - BEV flattening
```

#### Voxelization (VoxelNet-Based)

The 3D space around the vehicle is divided into a regular grid of voxels (3D pixels). Points within each voxel are encoded using a small PointNet-like network that captures local geometry. Sparse 3D convolutions process the voxel features, and the resulting 3D feature volume is flattened along the height dimension to produce a 2D BEV feature map.

#### Pillarization (PointPillars-Based)

**PointPillars** (CVPR 2019), developed by nuTonomy researchers Alex Lang, Sourabh Vora, Holger Caesar, and Oscar Beijbom, introduced a faster alternative to voxelization:

- The point cloud is organized into **vertical columns (pillars)** instead of 3D voxels
- A simplified PointNet encodes the points within each pillar
- The resulting representation is a 2D pseudo-image (BEV) where each pixel corresponds to a pillar
- **All subsequent operations are standard 2D convolutions**, enabling GPU-efficient processing

Performance characteristics:
- **62 Hz** detection rate (vs. ~2-10 Hz for earlier methods)
- A faster variant matched state-of-the-art at **105 Hz**
- Despite using LiDAR only, outperformed fusion methods on KITTI bird's-eye view detection
- Became the backbone for auto-labeling in the nuPlan dataset

#### Multi-Sweep Aggregation

For temporal context, multiple LiDAR sweeps (typically 10 sweeps = 0.5 seconds at 20 Hz) are aggregated after ego-motion compensation. Each point is tagged with its relative timestamp, providing the network with motion cues (moving objects produce "trails" in the aggregated cloud). This temporal aggregation was used extensively in CenterPoint and subsequent detectors.

---

## 4. Camera Perception

### 13-Camera Pipeline

The IONIQ 5 robotaxi uses **13 cameras** with varying focal lengths and fields of view to achieve 360-degree visual coverage. This represents a significant expansion from the 6-camera setup used in nuScenes data collection.

| Camera Configuration | nuScenes (Historical) | IONIQ 5 (Current) |
|---|---|---|
| **Count** | 6 | 13 |
| **Model** | Basler acA1600-60gc | Undisclosed (production-grade) |
| **Resolution** | 1600x900 ROI | Higher resolution (undisclosed) |
| **Capture Rate** | 12 Hz | Higher (undisclosed) |
| **Coverage** | 360-degree with 1 rear camera | 360-degree with multiple focal lengths |

### Surround-View Image Networks (Transformer-Based)

Motional uses **Surround-View Image Networks built on Transformer Neural Networks (TNNs)** to convert camera inputs into BEV representations. The key technical aspects:

**Why Transformers over CNNs**: Motional adopted transformers because they "capture global dependencies and long-range interactions within the data." Traditional CNNs process local patches with limited receptive fields, while transformers can attend to any part of the image, enabling better understanding of scene context. TNNs excel at "blocking background noise" and focusing on critical objects through their "long-distance attention module."

**Camera-to-BEV View Transformation**: The fundamental challenge in camera perception for autonomous driving is converting 2D perspective images into 3D world-frame representations. As Motional describes it: "we must convert that two-dimensional, street-level image into a 3D object viewable from overhead." This view transformation is performed by the Surround-View Image Network, which:

1. Encodes each camera image independently using a vision transformer backbone
2. Lifts 2D features into 3D using depth estimation and camera intrinsic/extrinsic parameters
3. Projects the 3D features into a unified BEV grid
4. Applies BEV-space feature processing for downstream tasks

**Inference Optimization**: In their CVPR 2023 Workshop paper "Training Strategies for Vision Transformers for Object Detection," Motional evaluated strategies to optimize inference time of vision transformer-based detection. They achieved a **63% improvement in inference time at the cost of only 3% performance drop** through:
- Reduced input resolution
- Image pre-cropping
- Query embedding adjustments
- On-vehicle network pruning and quantization

### Camera-Only Detection Capabilities

Cameras provide capabilities that LiDAR and radar cannot:
- **Color and texture recognition**: Distinguishing between a pedestrian and a traffic cone based on visual appearance
- **Traffic light state detection**: Red/green/yellow recognition requires color discrimination
- **Sign reading**: Speed limit, stop sign, construction zone identification
- **Lane marking detection**: Dashed vs. solid lines, lane colors
- **Fine-grained classification**: Vehicle make/model, pedestrian attributes (adult vs. child, carrying objects)

---

## 5. Radar Perception

### Hardware Configuration

Motional uses **11 radar units** (more than double the typical L2/L3 vehicle configuration) providing 360-degree coverage:

| Specification | Value |
|---|---|
| **Count** | 11 units |
| **Primary Model** | Aptiv FLR4+ long-range radar |
| **Frequency** | 77 GHz millimeter-wave (mmWave) |
| **Detection Range** | Beyond 200 meters |
| **Coverage** | Full 360-degree (front, sides, rear) |
| **Key Capability** | Direct Doppler velocity measurement |
| **Weather Resilience** | Functional in rain, snow, fog, dust, darkness |

Unlike Level 2/3 vehicles that typically mount a single forward-facing radar for adaptive cruise control, Motional deploys radars in a surround configuration including rear-facing units -- critical for detecting vehicles approaching from behind during lane changes.

### Low-Level Radar Data: The Paradigm Shift

Motional has made a deliberate strategic decision to move beyond conventional radar processing. Traditional automotive radar systems use on-chip Digital Signal Processors (DSPs) that process raw data locally and output only a sparse set of detections (a few hundred per frame). This pre-processing **discards significant semantic information** from the low-level radar signal.

Motional's approach replaces this with a **centralized low-level radar architecture**:

```
Traditional Approach:
  Radar Frontend --> On-Chip DSP --> Sparse Detections (~100-300 points/frame)

Motional's Approach:
  Radar Frontend --> Raw ADC Data --> Central Computer --> ML Pipeline --> Dense Radar Imagery
  (multi-Gbps)       (preserved)     (GPU processing)    (end-to-end)   (20M+ pts/sec equiv.)
```

Key innovations in Motional's imaging radar architecture:

1. **Raw ADC Processing**: The end-to-end perception model is trained directly from the radar's raw Analog-to-Digital Converter (ADC) output, bypassing traditional signal processing entirely.

2. **Multi-Channel Multi-Scan (MCMS) Aggregation**: An ML module aggregates low-level radar data across multiple channels and multiple scans, producing high-fidelity radar images.

3. **Radar Point Cloud Density**: The system generates the equivalent of **over 20 million points per second** -- comparable to "a LiDAR system generating 2 million points per second" -- a dramatic improvement from conventional systems producing "merely a few hundred detections per frame."

4. **Update Rate**: High-fidelity, low-latency radar images are produced at **20 Hz**, matching LiDAR frame rates.

5. **VRU Detection**: The ML-trained radar perception achieves **3x Average Precision (AP) improvement** in Vulnerable Road User (VRU) detection compared to conventional radar processing.

### Radar Dataset

Motional has curated a **petabyte-scale multi-modality dataset** that integrates low-level radar output with synchronized camera and LiDAR data. This dataset is enriched through both automated labeling and manual annotation methods, enabling iterative improvement of the radar perception pipeline.

### Radar as Primary Sensor: The Strategic Vision

Motional has publicly articulated a vision for radar to become "the central sensing modality" for future AV platforms, potentially reducing dependence on expensive LiDAR:

| Factor | Radar Advantage |
|---|---|
| **Cost** | Automotive-grade radars cost 5-10x less than LiDAR |
| **Maturity** | 70+ years of industrial and defense applications |
| **Durability** | Solid-state electronics, no moving parts |
| **Weather** | Retains functionality in rain, snow, fog, dust, darkness |
| **Velocity** | Direct Doppler measurement provides instantaneous velocity (critical for prediction) |
| **Range Fidelity** | Scans maintain fidelity beyond 200 meters |

Motional is "studying whether future iterations could utilize radars as more of a central sensing modality, without sacrificing performance" -- a strategy that could "enable a faster pathway to profit" by dramatically reducing per-vehicle sensor costs.

### Radar-LiDAR-Camera Fusion

The current radar fusion pipeline:

1. **Radar point cloud** generated from low-level data via ML
2. **Neural network** fuses radar and LiDAR point clouds, preserving more data than separate processing
3. **PointPainting** projects the fused point cloud onto camera imagery
4. **Detection head** produces 3D bounding boxes with velocity estimates

Motional is collaborating with Aptiv to improve AI/ML radar classification capabilities for distinguishing vehicles, pedestrians, and cyclists using radar data alone.

---

## 6. 3D Object Detection

### Detection Architectures Used and Developed by Motional/nuTonomy

#### PointPillars (CVPR 2019) -- Developed at nuTonomy

Authors: Alex H. Lang, Sourabh Vora, Holger Caesar, Lubing Zhou, Jiong Yang, Oscar Beijbom

PointPillars is a LiDAR-only 3D detector that organizes point clouds into vertical pillars and processes them with 2D convolutions. It was the first real-time 3D detector that could run at automotive-grade speeds.

| Feature | Detail |
|---|---|
| **Encoding** | Points organized into vertical columns (pillars); PointNet encodes each pillar |
| **Processing** | Entirely 2D convolutional after pillar encoding |
| **Speed** | 62 Hz standard; 105 Hz fast variant |
| **Output** | 3D bounding boxes with class, position, size, orientation |
| **Significance** | First real-time LiDAR detector; used as backbone in nuPlan auto-labeling |

#### PointPainting (CVPR 2020) -- Developed at Motional

Authors: Sourabh Vora, Alex H. Lang, Bassam Helou, Oscar Beijbom

PointPainting is a sequential camera-LiDAR fusion method:

1. Run image semantic segmentation on camera images
2. Project LiDAR points into segmented images
3. Append per-class scores to each point's feature vector
4. Feed "painted" point cloud to any LiDAR detector

Results showed large improvements when applied to PointRCNN, VoxelNet, and PointPillars on both KITTI and nuScenes. The "painted" PointRCNN achieved state-of-the-art on KITTI bird's-eye view detection.

#### CenterPoint (CVPR 2021) -- Key Researchers Later at Motional

Authors: Tianwei Yin, Xingyi Zhou, Philipp Krahenbuhl (UT Austin)

CenterPoint became a dominant detection architecture on the nuScenes benchmark and is widely used in the AV industry. While developed at UT Austin rather than directly at Motional, it became foundational to the nuScenes ecosystem and was used in nuPlan auto-labeling alongside PointPillars.

| Feature | Detail |
|---|---|
| **Approach** | Center-based detection: detect object centers first, then regress attributes |
| **Backbone** | VoxelNet or PointPillars for point cloud feature extraction |
| **BEV Flattening** | 3D features flattened to BEV; keypoint detector applied to BEV map |
| **Detection Heads** | Center heatmap head (K-channel for K classes); regression heads for 3D size, orientation, velocity |
| **Two-Stage Refinement** | Second stage refines estimates using additional point features on detected objects |
| **Tracking** | Simplifies 3D MOT to greedy closest-point matching on detected centers |
| **Performance** | 65.5 NDS, 63.8 AMOTA on nuScenes (single model); 1st place among LiDAR-only submissions on Waymo Open Dataset |
| **Impact** | 3 out of top 4 entries in NeurIPS 2020 nuScenes 3D Detection Challenge used CenterPoint |

#### TransFusion (CVPR 2022)

Authors: Xuyang Bai, Zeyu Hu, Xinge Zhu, et al.

TransFusion addresses the brittleness of hard LiDAR-camera association (via calibration matrices) with a transformer-based **soft-association** mechanism:

| Feature | Detail |
|---|---|
| **Architecture** | Two-layer transformer decoder |
| **Layer 1** | Generates initial bounding boxes from LiDAR using sparse object queries |
| **Layer 2** | Adaptively fuses object queries with image features via attention |
| **Key Innovation** | Attention determines where and what information to extract from images |
| **Robustness** | Resilient to degraded image quality and calibration errors |
| **Query Initialization** | Image-guided strategy for objects difficult to detect in point clouds |
| **Performance** | 1st place on nuScenes tracking leaderboard |

#### BEVFusion (ICRA 2023, MIT Han Lab)

Authors: Zhijian Liu, Haotian Tang, et al.

BEVFusion unifies multi-modal features in a shared BEV representation:

| Feature | Detail |
|---|---|
| **Approach** | Modality-specific encoders; unified BEV feature space |
| **Key Bottleneck** | Identified and resolved camera-to-BEV transformation as latency bottleneck |
| **Optimization** | BEV pooling optimization reduces view transformation latency by 40x |
| **Multi-Task** | Supports 3D detection and BEV segmentation with same architecture |
| **Improvement over CenterPoint** | +3.0-7.1% mAP with LiDAR-camera fusion |
| **Improvement over PointPillars** | +18.4% mAP |
| **BEV Segmentation** | +13.6% mIoU vs. prior methods |
| **Computation** | 1.9x lower cost than comparable methods |

#### MVFuseNet (CVPR 2021 Workshop) -- Developed at Motional

Authors: Ankit Laddha, Shivam Gautam, et al. (Motional)

MVFuseNet is Motional's internally developed multi-view temporal fusion network:

| Feature | Detail |
|---|---|
| **Innovation** | First to use both Range View (RV) and BEV for LiDAR feature learning |
| **Temporal Fusion** | Sequential aggregation of sweeps by projecting between consecutive sweeps |
| **Multi-Scale** | Multi-view features at multiple spatial scales in backbone |
| **Tasks** | Joint object detection and motion forecasting (end-to-end) |
| **Performance** | State-of-the-art on large-scale self-driving datasets |
| **Efficiency** | Scales to large operating ranges while maintaining real-time performance |

### Detection Classes

The 10 classes used in the nuScenes detection challenge (merged from the full 23):

| Class | Description |
|---|---|
| **car** | Passenger vehicles |
| **truck** | Cargo vehicles |
| **bus** | Public transit buses (bendy + rigid merged) |
| **trailer** | Towed cargo units |
| **construction_vehicle** | Bulldozers, excavators, etc. |
| **pedestrian** | Adults, children, construction workers, police (merged) |
| **motorcycle** | Two-wheeled motorized vehicles |
| **bicycle** | Human-powered two-wheeled vehicles |
| **barrier** | Road barriers, Jersey barriers |
| **traffic_cone** | Orange/safety cones |

The full 23 nuScenes annotation classes provide finer granularity:

| Category | Subclasses |
|---|---|
| **vehicle** | car, truck, bus.bendy, bus.rigid, construction, trailer, motorcycle, bicycle, emergency.ambulance, emergency.police |
| **human.pedestrian** | adult, child, construction_worker, police_officer, personal_mobility, stroller, wheelchair |
| **movable_object** | barrier, debris, pushable_pullable, trafficcone |
| **static_object** | bicycle_rack |
| **animal** | (single class) |

---

## 7. Object Tracking

### Unified End-to-End Tracking Model

Motional has developed a **unified end-to-end tracking model** that consolidates traditionally separate tracking components into a single inference pass. The tracking module operates between detection and prediction in the pipeline and handles three fundamental tasks:

1. **Data Association**: Linking detections across individual time frames to form coherent object trajectories
2. **Motion Estimation**: Providing position, velocity, acceleration, and other kinematic estimates for each tracked object
3. **Information Fusion**: Combining detection data, segmentation masks, and fine-grained object attributes from upstream perception

### Architecture

Rather than using multiple individual models for each tracking subtask, Motional designed a single unified model that performs all tracking components in one inference pass:

```
Detections (per frame) ──> Unified Tracking Model ──> Tracked Objects (with trajectories)
                                    │
                            ┌───────┼───────┐
                            │       │       │
                      Data Assoc.  Motion  Info
                                   Est.    Fusion
                            │       │       │
                            └───────┼───────┘
                                    │
                            Feature Sharing
                            (common features)
```

**Key advantages of the unified approach**:

- **Feature sharing**: Context features learned for data association can be reused for motion estimation, making the model easier to train and more parameter-efficient
- **Single inference**: Only one forward pass needed at runtime, reducing latency
- **Polygon support**: Through the data-driven approach, the model processes irregular polygon-shaped objects (not just bounding boxes), better representing objects like construction barriers or oddly-shaped vehicles

### CenterPoint Tracking

CenterPoint simplified 3D multi-object tracking to **greedy closest-point matching**: detected object centers in the current frame are matched to tracked object centers from the previous frame using closest-point association. This simple approach achieved 63.8 AMOTA on nuScenes, demonstrating that strong detection reduces the complexity of the tracking problem.

### Tracking Metrics (nuScenes)

| Metric | Description |
|---|---|
| **AMOTA** (primary) | Average Multi-Object Tracking Accuracy; averages MOTA across 40 recall thresholds |
| **AMOTP** | Average Multi-Object Tracking Precision; averages MOTP across recall thresholds |
| **IDS** | Identity Switches -- how often a track is associated with the wrong detection |
| **FP** | False Positives -- tracks reported where no real object exists |
| **FN** | False Negatives -- real objects not tracked |

AMOTA and AMOTP are computed using 40-point interpolation over the MOTA/MOTP curves, excluding points with recall < 0.1 to avoid noise.

---

## 8. Prediction

### Behavior Prediction Architecture

Motional uses a **Graph Attention Network (GAT)** processed through the vehicle's onboard compute for trajectory prediction. The system models the prediction problem as a graph where:

- **Agent nodes** (blue in Motional's visualizations): Represent vehicles, pedestrians, cyclists, and other dynamic agents
- **Map element nodes** (orange): Represent lane segments, crosswalks, traffic signals, and other static infrastructure

The graph attention mechanism **learns attention weights from data** to understand how agents interact with each other and with the road geometry.

### Input Features

For each agent, the prediction model ingests:
- **Position** (x, y in world coordinates)
- **Velocity** (magnitude and direction)
- **Acceleration** (magnitude and direction)
- **Road geometry** (lane boundaries, curvature, connectivity)
- **Historical trajectory** (past positions over multiple timesteps)

### Multi-Modal Trajectory Prediction

Rather than predicting a single future trajectory, the system generates **multiple trajectories with associated probabilities**. This is critical because:

- A vehicle at an intersection might go straight, turn left, or turn right
- A uni-modal prediction model would predict the average of multiple modes, producing an unrealistic trajectory (e.g., predicting a car will drive into the median, which is the average of "go straight" and "turn left")
- Each predicted trajectory waypoint is represented with a **2D Gaussian distribution** (mean center position + covariance matrix), providing uncertainty estimates

### Integration with Planning

The prediction system runs **thousands of times per minute** and directly informs the planning module. The multi-modal predictions with confidence scores allow the planner to:
- Plan around the most likely trajectories of other agents
- Maintain contingency plans for less likely but dangerous scenarios
- Adjust confidence dynamically as new observations arrive

### Training Data

The prediction model is trained on **thousands of hours of auto-labeled data** from Motional's fleet operations. The Continuous Learning Framework continuously identifies high-error prediction scenarios for targeted retraining, enabling "the prediction model to continuously improve with every mile."

---

## 9. Large Driving Models (LDM) Pivot

### The 2024 Strategic Decision

In 2024, Motional made a fundamental decision to redesign its autonomous driving system architecture around AI, transitioning from a traditional modular stack to **Large Driving Models (LDMs)**. This decision was described as "an important turning point in autonomous driving technology development" and coincided with the company's major restructuring.

### LDM Architecture for Perception

LDMs are described by Motional as **"embodied foundation models"** -- not generic language models, but purpose-built models that understand the physical world through sensor data.

```
MODULAR STACK (Pre-2024):
  Sensors --> Perception --> Prediction --> Planning --> Control
                Module         Module        Module      Module
              (separate ML)  (separate ML) (separate ML)

LDM ARCHITECTURE (2024-present):
  Sensors ──────────> Large Driving Model ──────────> Control
                            │
                   ┌────────┼────────┐
                   │        │        │
              Perception Prediction Planning
              (shared transformer backbone)
                   │        │        │
                   └────────┼────────┘
                            │
                    Safety Guardrail System (parallel)
```

### How LDM Changes Perception

The LDM architecture transforms perception in several fundamental ways:

1. **Shared Representations**: Instead of perception producing a fixed intermediate representation (e.g., a list of detected objects) that prediction and planning consume, the LDM learns shared embeddings that serve all downstream tasks simultaneously. Features useful for detection are also useful for prediction and planning.

2. **Joint Training**: Perception, prediction, and planning are co-trained, enabling **bidirectional knowledge transfer**. Planning requirements can influence what perception learns to focus on, and perception features directly inform prediction without lossy intermediate representations.

3. **PredictNet as Scene Encoder**: Motional's PredictNet component learns "spatiotemporal relationships between vehicles, pedestrians, and static map elements, encoding each scene's semantic contexts into a structured, high-dimensional latent representation." These embeddings "retain rich contextual information" and reason about future behaviors to inform planning.

4. **Self-Attention Across Modalities**: The transformer backbone encodes relationships between agent-agent, agent-ego, and ego-environment interactions using self-attention. This allows the model to track multi-agent interactions over time.

5. **Encoder-Generator-Ranker Pipeline**: The architecture follows:
   - **PredictNet** generates transformer-based embeddings capturing agent interactions
   - An **optimization-based trajectory generator** creates motion plan candidates
   - An **ML ranker** evaluates trajectories using multi-objective loss balancing safety, comfort, and human-likeness

### Training Methodology

LDM training incorporates:
- **Supervised learning** on expert driving demonstrations
- **Unsupervised learning** for representation learning from raw sensor data
- **Reinforcement learning** in simulated environments for closed-loop performance
- **Closed-loop training** with distributed infrastructure to address distribution shift

Training data comes from "extremely diverse" datasets collected across Las Vegas, Pittsburgh, Boston, Los Angeles, and Singapore.

### Safety Guardrail System

A critical complement to the LDM is a parallel **safety guardrail system**:

| Aspect | Detail |
|---|---|
| **Coverage** | Handles ~1% edge cases (unexpected events) |
| **Approach** | Rule-based, deterministic, validated over extended period |
| **Function** | Prevents LDM from making erroneous decisions in unusual scenarios |
| **Independence** | Runs in parallel with, not inside, the LDM |
| **Validation** | Has been validated extensively on real-world data |

For ~90% of general driving situations, the E2E LDM handles all decisions. The guardrail system provides deterministic safety guarantees for edge cases where the learned model may have insufficient training data -- a design philosophy influenced by nuTonomy's formal methods heritage.

### Key LDM Design Principles

Motional identifies four requirements for their LDMs:
1. **Achieve driverless safety benchmarks**
2. **Reduce costs for rapid geographic scaling** (a single model architecture that works across cities)
3. **Enable efficient training across vast datasets**
4. **Provide sufficient introspection** to understand and solve long-tail issues (unlike black-box E2E models)

The emphasis on **introspection** is notable: Motional explicitly states their LDMs provide "enough introspection to really understand what's happening so that we can more easily improve the system and solve long tail issues." This suggests the LDM maintains some internal structure (not a fully opaque end-to-end model) that allows engineers to diagnose failure modes.

---

## 10. nuScenes Dataset Architecture

### Overview

**nuScenes** (nuTonomy Scenes) is the first large-scale, multimodal dataset to provide data from the full autonomous vehicle sensor suite, released by Motional (then nuTonomy) and published at CVPR 2020. It has become the de facto benchmark for 3D perception in autonomous driving.

| Attribute | Value |
|---|---|
| **Paper** | "nuScenes: A multimodal dataset for autonomous driving" (CVPR 2020) |
| **Authors** | Holger Caesar, Varun Bankiti, Alex H. Lang, Sourabh Vora, Venice Erin Liong, Qiang Xu, Anush Krishnan, Yu Pan, Giancarlo Baldan, Oscar Beijbom |
| **Downloads** | 12,000+ |
| **Citing Publications** | 600+ (as of initial reports; now substantially higher -- 8,000+ researchers have used the dataset) |
| **Impact** | Pioneered AV data sharing movement; 10+ new public datasets released industry-wide in following 18 months |

### Sensor Configuration

Data was collected using two Renault Zoe supermini electric cars with identical sensor layouts in **Boston** and **Singapore**:

| Sensor | Model | Count | Frequency | Specifications |
|---|---|---|---|---|
| **LiDAR** | Velodyne HDL-32E | 1 | 20 Hz | 32 beams; ~1,080 pts/ring; 70m range; +/-2cm accuracy |
| **Cameras** | Basler acA1600-60gc | 6 | 12 Hz | 1600x900 ROI; 360-degree surround view |
| **Radar** | Continental ARS 408-21 | 5 | 13 Hz | 77 GHz; up to 250m; FMCW; measures distance and velocity |
| **GPS/IMU** | Advanced Navigation Spatial | 1 | -- | 20mm position accuracy |

### Dataset Scale

| Component | Count |
|---|---|
| **Scenes** | 1,000 (each 20 seconds long) |
| **Keyframes** | 40,000 (annotated at 2 Hz) |
| **Camera Images** | ~1.4 million |
| **LiDAR Sweeps** | ~390,000 |
| **Radar Sweeps** | ~1.4 million |
| **3D Bounding Boxes** | ~1.4 million (across 40,000 keyframes) |
| **Data Split** | 700 train, 150 val, 150 test scenes |

### Annotation Architecture

Each object in every keyframe is annotated with:

| Annotation | Detail |
|---|---|
| **Semantic Category** | One of 23 object classes |
| **Attributes** | Visibility level, activity state, pose |
| **Instance Identifier** | Unique ID linking same object across frames |
| **3D Bounding Box** | x, y, z (center), width, length, height, yaw angle |
| **Velocity** | 2D velocity vector derived from consecutive annotations |

### Coordinate System

nuScenes uses three coordinate frames:

| Frame | Description | Use |
|---|---|---|
| **Global** | Fixed world coordinate frame | All annotations are stored in global coordinates |
| **Ego Vehicle** | Defined at the midpoint of the rear axle | Extrinsic sensor calibrations are relative to ego frame |
| **Sensor** | Each sensor's local coordinate frame | Raw sensor data (e.g., radar points) are in sensor coordinates |

Transformations between frames use 4x4 rigid-body transformation matrices:
- **Sensor-to-Ego**: `calibrated_sensor` table provides rotation (quaternion) and translation
- **Ego-to-Global**: `ego_pose` table provides rotation (quaternion: w, x, y, z) and translation (meters: x, y, z)

### The 23 Object Classes (Full Taxonomy)

| Category | Subclass | Detection Class (Merged) |
|---|---|---|
| vehicle.car | -- | car |
| vehicle.truck | -- | truck |
| vehicle.bus.bendy | -- | bus |
| vehicle.bus.rigid | -- | bus |
| vehicle.trailer | -- | trailer |
| vehicle.construction | -- | construction_vehicle |
| vehicle.motorcycle | -- | motorcycle |
| vehicle.bicycle | -- | bicycle |
| vehicle.emergency.ambulance | -- | (excluded from detection) |
| vehicle.emergency.police | -- | (excluded from detection) |
| human.pedestrian.adult | -- | pedestrian |
| human.pedestrian.child | -- | pedestrian |
| human.pedestrian.construction_worker | -- | pedestrian |
| human.pedestrian.police_officer | -- | pedestrian |
| human.pedestrian.personal_mobility | -- | (excluded from detection) |
| human.pedestrian.stroller | -- | (excluded from detection) |
| human.pedestrian.wheelchair | -- | (excluded from detection) |
| movable_object.barrier | -- | barrier |
| movable_object.debris | -- | (excluded from detection) |
| movable_object.pushable_pullable | -- | (excluded from detection) |
| movable_object.trafficcone | -- | traffic_cone |
| static_object.bicycle_rack | -- | (excluded from detection) |
| animal | -- | (excluded from detection) |

### How nuScenes Reflects Motional's Perception Architecture

The nuScenes sensor configuration (1 LiDAR + 6 cameras + 5 radars) represents a scaled-down version of Motional's production architecture (5+ LiDARs + 13 cameras + 11 radars). The design principles are identical:
- **Multi-modal coverage**: Every point in space is observed by multiple sensor types
- **Complementary modalities**: LiDAR for geometry, cameras for semantics, radar for velocity
- **360-degree surround**: No azimuthal blind spots
- **Temporal annotations**: Instance tracking across keyframes enables temporal perception research

The class taxonomy directly reflects Motional's operational priorities on public roads: vehicles of all types, vulnerable road users (pedestrians, cyclists), and road infrastructure (barriers, traffic cones).

---

## 11. nuPlan Planning Dataset

### Overview

nuPlan is the **world's first closed-loop ML-based planning benchmark** for autonomous vehicles, developed and open-sourced by Motional.

| Attribute | Detail |
|---|---|
| **Paper** | "nuPlan: A closed-loop ML-based planning benchmark for autonomous vehicles" |
| **Scale** | 1,500 hours of human driving data |
| **Cities** | Boston, Pittsburgh, Las Vegas, Singapore |
| **Data Types** | Auto-labeled object tracks, traffic light data, camera images, LiDAR point clouds, localization, steering inputs |
| **Total Data Volume** | 200+ TB (full dataset) |
| **Sensor Data Release** | 120 hours of raw sensor data (~16 TB) -- 10% of full dataset |
| **Images** | ~500 million (full dataset) |
| **LiDAR Scans** | ~100 million (full dataset) |
| **Sensors** | 8 cameras, 5 LiDARs |
| **Availability** | Free for academic use; commercial licensing; hosted on AWS Open Data Registry |

### How Perception Feeds Planning

nuPlan bridges perception and planning by providing perception outputs as inputs to the planning benchmark:

1. **Auto-Labeling**: Object tracks in nuPlan are generated using Motional's offline perception system, employing state-of-the-art detectors including **PointPillars** and **CenterPoint**
2. **Noise Injection**: To capture the realistic uncertainty of online perception, uniform noise is injected into the auto-labeled detections, with variance calibrated by comparing offline and online perception outputs
3. **Scenario Mining**: Attributes for scenario mining (vehicle speed, lane occupancy, agent proximity, etc.) are inferred from offline perception tracks and traffic light states
4. **Closed-Loop Evaluation**: Unlike open-loop benchmarks that compare planned trajectories to recorded expert trajectories (using L2 distance, which is "not suitable for fairly evaluating long-term planning"), nuPlan provides closed-loop simulation where simulated agents react to the ego vehicle's planned trajectory

### Three Core Components

1. **Large-Scale Driving Dataset**: 1,500 hours of real-world driving across 4 cities
2. **Lightweight Closed-Loop Simulator**: Reactive simulation environment
3. **Planning-Specific Metrics**: Traffic rule compliance, vehicle dynamics, goal achievement, passenger comfort (e.g., acceleration in turns)

---

## 12. Semantic Segmentation

### nuScenes-lidarseg

Released in July 2020, **nuScenes-lidarseg** provides per-point semantic annotations for every LiDAR point in the nuScenes keyframes.

| Attribute | Value |
|---|---|
| **Annotated Points** | 1.4 billion |
| **Pointclouds** | 40,000 (all keyframes from 1,000 scenes) |
| **Classes** | 32 (23 foreground "things" + 9 background "stuff") |
| **Challenge Classes** | 16 (merged/filtered for benchmark evaluation) |
| **Annotation** | Each LiDAR point assigned exactly one semantic label |
| **Split** | 850 scenes (train/val), 150 scenes (test) |

### The 32 Semantic Classes

**Foreground Classes (Things) -- 23 classes**: The same 23 object classes used for bounding box annotation (vehicles, pedestrians, movable objects, etc.)

**Background Classes (Stuff) -- 9 classes**:

| Class | Description |
|---|---|
| **flat.driveable_surface** | All paved or unpaved surfaces a car can drive on |
| **flat.sidewalk** | Sidewalks, pedestrian walkways, bike paths |
| **flat.terrain** | Natural horizontal surfaces: ground-level vegetation, grass, hills, soil, sand, gravel |
| **flat.other** | Other flat surfaces |
| **static.manmade** | Ground-level structures not in other categories (walls, fences, buildings) |
| **static.vegetation** | Trees, bushes, hedges (non-ground-level vegetation) |
| **static.other** | Other static objects |
| **vehicle.ego** | The ego vehicle itself |
| **noise** | Points that are noise/artifacts |

### 16 Challenge Classes

For the official lidar segmentation challenge, similar classes are merged and rare classes are removed, resulting in 16 evaluation classes.

### How Per-Point Segmentation Works

Per-point semantic segmentation assigns a class label to every individual point in the LiDAR point cloud. This is fundamentally different from 3D bounding box detection:

- **Bounding boxes** provide coarse object localization (a box around a car)
- **Per-point segmentation** provides fine-grained scene understanding (which points belong to the road, which to the sidewalk, which to vegetation)

This enables understanding of **free space** (drivable area), **road boundaries**, and **scene layout** -- critical for planning and localization.

### Evaluation Metrics for Segmentation

| Metric | Description |
|---|---|
| **mIoU** | Mean Intersection-over-Union; primary metric; averaged across all classes |
| **fwIoU** | Frequency-weighted IoU; weights each class by its frequency in the dataset |

### Panoptic nuScenes

Motional extended nuScenes further with **Panoptic nuScenes** (2021), providing:
- **Panoptic segmentation**: Combined semantic and instance segmentation (each point gets both a class label and an instance ID)
- **Panoptic tracking**: Instance tracking across frames in the panoptic segmentation
- **Scale**: 1,000 scenes with over 1.1 billion annotated points
- **Authors**: Whye Kit Fong, Rohit Mohan, Juana Valeria Hurtado, Lubing Zhou, Holger Caesar, Oscar Beijbom, Abhinav Valada

---

## 13. Occupancy Prediction

### nuScenes-Based Occupancy Benchmarks

While Motional has not published a dedicated occupancy prediction method, the nuScenes dataset has become the foundation for the field's primary occupancy benchmarks:

#### Occ3D-nuScenes

| Attribute | Detail |
|---|---|
| **Source** | Tsinghua-MARS Lab (built on nuScenes) |
| **Task** | Dense 3D semantic occupancy prediction |
| **Annotation** | Dense voxel annotations with robust occlusion reasoning |
| **Sensors Used** | Synchronized 6 cameras, LiDAR, radars from nuScenes |
| **Evaluation** | Per-class IoU, mIoU, RayIoU |

#### SurroundOcc

SurroundOcc produces dense occupancy labels using spatial attention to reproject 2D camera features back into 3D voxel space. It has been evaluated on nuScenes with missing-view protocols.

### Relationship to BEV Perception

Semantic occupancy prediction extends BEV perception from 2D overhead maps to **dense 3D voxel grids**. Two mainstream approaches (BEVDet and BEVFormer) have been adapted for occupancy by replacing detection decoders with occupancy decoders while retaining their BEV feature encoders.

### Relevance to Motional

Occupancy prediction is relevant to Motional's architecture because:
- It provides a sensor-agnostic scene representation (every voxel is classified as occupied/free/unknown)
- It can detect **arbitrarily-shaped obstacles** that bounding boxes poorly represent (e.g., fallen trees, construction debris, unusual structures)
- Motional's patent portfolio includes work on **dynamic occupancy grids (DOGs)** generated from LiDAR data combined with semantic maps

---

## 14. BEV Representation

### What Is BEV and Why Motional Uses It

Bird's-Eye View (BEV) representation is a top-down 2D feature map where each pixel corresponds to a location in the ground plane around the vehicle. Motional uses BEV as the central representation for multi-sensor fusion because:

1. **LiDAR is naturally BEV**: After voxelization and height flattening, LiDAR features are inherently in BEV
2. **Camera-to-BEV is the key challenge**: Motional's Surround-View Image Networks perform the view transformation from perspective camera images to BEV
3. **Radar projects easily to BEV**: Radar returns (range, azimuth, velocity) map directly to BEV
4. **Fusion is straightforward**: With all modalities in BEV, fusion becomes element-wise operations on aligned feature maps
5. **Planning operates in BEV**: Motion planning is naturally performed in the ground plane

### Motional's BEV Pipeline

```
Cameras (13) ──> Vision Transformer Backbone ──> View Transformation ──> Camera BEV Features ──┐
                                                                                                │
LiDARs (5+) ──> Voxelization/Pillarization ──> 3D Backbone ──> Height Flatten ──> LiDAR BEV ──>├──> Fused BEV ──> Detection/Tracking/Prediction
                                                                                                │
Radars (11) ──> ML Point Cloud Generation ──> Radar Feature Extraction ──> Radar BEV Features ──┘
```

### Coordinate Frames in BEV

Motional's BEV representation uses the ego vehicle coordinate frame (centered at the midpoint of the rear axle):

| Axis | Direction | Convention |
|---|---|---|
| **X** | Forward (longitudinal) | Positive ahead of vehicle |
| **Y** | Left (lateral) | Positive to the left |
| **Z** | Up (vertical) | Positive upward |

The BEV grid typically covers a region such as [-50m, 50m] x [-50m, 50m] around the ego vehicle, with resolution determined by the grid cell size (e.g., 0.25m per cell = 400x400 grid).

### Temporal BEV Aggregation

BEV features from multiple timesteps can be aggregated to provide temporal context:
- Previous BEV frames are ego-motion compensated (warped to current ego frame)
- Deformable attention or feature concatenation merges temporal features
- This captures agent motion and provides velocity cues without explicit flow estimation

---

## 15. Temporal Fusion

### Multi-Sweep LiDAR Aggregation

Temporal fusion of LiDAR data is a fundamental technique used throughout Motional's perception pipeline:

**Standard Multi-Sweep Aggregation**:
- Typically 10 past LiDAR sweeps (0.5 seconds at 20 Hz) are aggregated
- Each past sweep is ego-motion compensated using the vehicle's odometry
- Points are tagged with relative timestamps, allowing the network to learn motion
- Stationary objects produce dense point clusters; moving objects produce trailing patterns

**MVFuseNet Temporal Fusion** (Motional):
- Sequential aggregation projecting data from one sweep to the next in the temporal sequence
- Operates in both Range View (RV) and BEV for richer spatio-temporal features
- Enables joint detection and motion forecasting from temporal LiDAR sequences

### Video-Based Camera Perception

Temporal fusion for camera perception extends single-frame detection to video understanding:

- **Temporal BEV fusion**: BEV features from consecutive camera frames are aligned via ego-motion and aggregated
- **Recurrent architectures**: Systems like OnlineBEV use recurrent structures with spatio-temporal deformable attention to align BEV features across frames
- **Motion context**: Features from adjacent frames are used to extract motion context, improving velocity estimation and handling of occluded objects

### Temporal Fusion in the LDM

In Motional's current LDM architecture, temporal fusion is implicit in the transformer backbone. The self-attention mechanism operates over temporal sequences, allowing the model to:
- Track objects through occlusions using learned object permanence
- Estimate velocity and acceleration from sequential observations
- Build contextual understanding of evolving traffic scenarios

---

## 16. Traffic Infrastructure

### Traffic Light Detection

Traffic light detection is handled by the camera perception pipeline, as it requires color discrimination that neither LiDAR nor radar can provide:

- **Detection**: Camera backbone identifies traffic light regions in images
- **State Classification**: The system classifies traffic light state (red, green, yellow, flashing, arrow states)
- **Association**: Detected traffic lights are associated with specific lanes and intersections using the HD map
- **Temporal tracking**: Traffic light state is tracked across frames to prevent erroneous state changes from single-frame noise

In nuScenes and nuPlan, traffic light data is provided as auto-labeled annotations, and nuPlan specifically includes traffic light states as inputs to the planning benchmark.

### Traffic Sign Detection

Traffic sign detection in Motional's stack relies on:
- Camera-based recognition using deep learning classifiers
- HD map prior knowledge (sign locations are encoded in the semantic map layer)
- Cross-validation between detected signs and map expectations

### Lane Marking and Road Boundary Detection

Lane markings and road boundaries are detected through:
- Camera-based semantic segmentation (distinguishing dashed lines, solid lines, road edges)
- LiDAR-based curb detection (height discontinuities at road edges)
- HD map matching for validation

---

## 17. Pedestrian Detection

### VRU Detection: The Core Challenge

Vulnerable Road User (VRU) detection is one of the most safety-critical perception tasks. Motional's perception stack must detect and classify:
- Adult pedestrians
- Children
- Construction workers
- Police officers
- People in wheelchairs
- People pushing strollers
- Cyclists
- Scooter riders

### Las Vegas Strip: The Ultimate Edge Case Environment

Las Vegas presents uniquely challenging perception scenarios that no other testing environment provides:

**Unusual Pedestrian Appearances**:
- Performers in large feathery costumes (wings, elaborate headdresses)
- People walking on stilts
- Costumed characters (clowns, showgirls, mascots)
- Tourists carrying oversized objects (yard-long drinks, large signs)

In a documented edge case from Motional's testing, a clown juggling pins on the sidewalk dropped a pin and stepped into the street to retrieve it directly in front of an IONIQ 5 robotaxi. Despite the bizarre costume and unexpected behavior, the vehicle recognized the risk in advance and stopped safely.

**Unusual Vehicle Types**:
- Stretch limousines (much longer than standard cars)
- Billboard trucks (large flat surfaces, unusual geometry)
- Trike motorcycles
- Classic and exotic cars (Rolls Royce, Lamborghini -- unusual shapes)

**Environmental Challenges**:
- Bright neon signs and dynamic lighting on The Strip
- Large crowds with dense pedestrian clusters
- Jaywalking across wide boulevards
- Costumed performers who may appear as non-human objects to naive detectors

### VRU Detection in Radar

Motional's imaging radar architecture specifically targets VRU detection improvement. The ML-trained radar perception achieves **3x Average Precision (AP) improvement** in VRU detection compared to conventional radar processing. This is critical because:
- Pedestrians have small radar cross-sections
- Cyclists and scooter riders move at varying speeds
- Traditional radar processing often cannot distinguish pedestrians from clutter

### How the Perception Stack Handles Edge Cases

1. **Multi-modal verification**: A pedestrian in an unusual costume may confuse one sensor modality but is unlikely to confuse all three (camera, LiDAR, radar) simultaneously
2. **Continuous Learning Framework**: Edge cases encountered in Las Vegas (costumed performers, unusual vehicles) are mined from fleet data and used to retrain perception models
3. **Offline perception with object permanence**: Temporarily occluded pedestrians are maintained in the scene model using temporal reasoning
4. **Conservative default behavior**: When perception confidence is low, the AV defaults to treating ambiguous objects as vulnerable road users

---

## 18. Non-ML Components

### Sensor Calibration

Calibration is a critical classical (non-ML) component that ensures all sensors are correctly aligned in the vehicle's coordinate frame:

**Intrinsic Calibration**:
- Camera intrinsics (focal length, principal point, distortion coefficients) are calibrated using standard checkerboard procedures
- LiDAR intrinsics are factory-calibrated by the manufacturer

**Extrinsic Calibration**:
- The 6-DOF rigid-body transformation (rotation + translation) between each sensor and the ego vehicle body frame
- In nuScenes, a laser liner is used to accurately measure the relative location of the LiDAR to the ego frame
- For the IONIQ 5 with 30+ sensors, extrinsic calibration is performed at Motional's Autonomous Vehicle Integration Center at HMGICS in Singapore
- Includes camera-to-LiDAR, radar-to-LiDAR, camera-to-ego, and sensor-to-sensor calibrations

**Cross-Sensor Temporal Calibration**:
- Sensors operate at different frame rates (cameras at 12 Hz, LiDAR at 20 Hz, radar at 13 Hz in nuScenes)
- Temporal synchronization is required to align data from non-synchronized sensors
- Motional holds a patent (DK180393B1) on data fusion for vehicles equipped with non-synchronized perception sensors

### Sensor Preprocessing

**LiDAR Preprocessing**:
- Range filtering (removing returns beyond maximum reliable range)
- Ground plane removal (optional; separates ground points from object points)
- Ego-motion compensation (correcting for vehicle motion during a single LiDAR rotation)
- Point cloud accumulation (aggregating multiple sweeps with timestamp tagging)
- Coordinate transformation (sensor frame --> ego frame --> global frame)

**Camera Preprocessing**:
- Lens distortion correction using intrinsic calibration parameters
- Exposure and white balance normalization
- Image cropping/resizing to model input resolution
- Data augmentation during training (random flipping, scaling, rotation, color jitter)

**Radar Preprocessing** (Traditional):
- CFAR (Constant False Alarm Rate) detection for target extraction
- Clustering of radar returns into object hypotheses
- Doppler velocity estimation

**Radar Preprocessing** (Motional's ML Approach):
- Bypasses traditional DSP entirely
- Raw ADC data streamed to central computer
- ML pipeline processes raw data end-to-end

### Classical Algorithms Still in Use

| Component | Algorithm | Purpose |
|---|---|---|
| **Ego-Motion Estimation** | IMU integration, wheel odometry | Dead reckoning between LiDAR/GPS updates |
| **Map Matching** | ICP, NDT, or learned matching | Localization against HD map |
| **Ground Segmentation** | RANSAC plane fitting or height thresholding | Separating ground from non-ground points |
| **Coordinate Transforms** | Rigid-body transformations (4x4 matrices) | Converting between sensor, ego, and global frames |
| **SLAM** | Graph SLAM (for map creation) | Building geometric maps from sensor data |
| **AEB** | Rule-based emergency braking | Time-to-collision computation for safety-critical braking |
| **Kalman Filtering** | Extended/Unscented Kalman Filter | State estimation, sensor fusion (in classical tracking) |

---

## 19. Auto-Labeling

### Offline Perception System

Motional's auto-labeling system is built on a cloud-based **offline perception** pipeline that operates fundamentally differently from the real-time onboard (online) perception:

| Aspect | Online Perception | Offline Perception |
|---|---|---|
| **Environment** | Onboard vehicle computer | Cloud-based distributed computing |
| **Latency** | Must run in real-time (~50-100ms) | No latency constraints |
| **Compute** | Limited to onboard GPUs | Multiple machines and GPUs in parallel |
| **Temporal Access** | Causal only (past + present) | Full temporal access (past + present + future) |
| **Processing Time** | Hours --> hours (massive parallelism) | Weeks --> hours for training data |

### Foresight and Hindsight

The key innovation of offline perception is **temporal analysis with both foresight and hindsight**:

- **Hindsight**: Using past observations to confirm present detections. A distant light at night can be confirmed as an approaching vehicle by checking earlier frames when it was closer.
- **Foresight**: Using future frames to validate current detections. A truck's dimensions can be assessed from a better vantage point after the ego vehicle overtakes it.
- **Object Permanence**: The system infers that "a pedestrian that has been observed in the past and in the future, must also be there in the present" -- even if the pedestrian is momentarily occluded (e.g., hidden behind a tree) in the current frame.

This produces a **"globally consistent estimate of the scene"** that approaches human-level annotation accuracy while operating at orders of magnitude greater speed.

### Continuous Learning Framework Integration

Auto-labeling powers Motional's Continuous Learning Framework (CLF) in several ways:

1. **Scenario Mining**: By comparing online and offline perception outputs, the system automatically identifies perception failures:
   - Online perception misses a pedestrian behind a tree, but offline perception detects it through object permanence
   - This disagreement is flagged as a scenario for targeted retraining

2. **Error Attribution**: Discrepancies between online and offline perception are decomposed into:
   - Detection errors (missed objects, false positives)
   - Tracking errors (ID switches, fragmented tracks)
   - Prediction errors (incorrect trajectory forecasts)

3. **Auto-Labeled Training Data at Scale**: Motional can now "annotate any amount of data collected by its fleet with a system that approaches the same level of accuracy as human-labeled data," reducing annotation time from weeks to hours.

4. **nuPlan Dataset**: The nuPlan dataset (1,500 hours, eventually described as 1,800 hours) is entirely auto-labeled using this offline perception system, representing unprecedented scale for AV ML development.

### Omnitag: ML-Powered Multimodal Data Mining

**Omnitag** is Motional's framework for transforming raw driving data into targeted training data. It operates on three pillars:

**Pillar 1: Multimodal Encoding**
- Uses pretrained multimodal foundation models from the open-source community
- Encodes preprocessed data (image, video, audio, LiDAR, world-state) into high-dimensional embeddings preserving semantic and contextual information
- Cross-modal disambiguation (e.g., using LiDAR to clarify visual occlusions)

**Pillar 2: RAG-Driven Few-Shot Dataset Creation**
- Retrieval-Augmented Generation (RAG) loop surfaces informative positive and negative examples
- Users interactively curate few-shot datasets with minimal manual effort
- Both few-shot decoding (lightweight decoders on cached embeddings) and zero-shot decoding (in-context prompting) are supported

**Pillar 3: Encoder-Decoder Adaptation**
- Domain-specific fine-tuning on representative data from target operational domains
- Continuous feedback loop with incremental model adaptation as rare events are discovered
- Supports the "teacher-student paradigm" where powerful offline models prepare high-quality datasets for lighter on-car models

### Scenario Mining Pipeline

```
AV Sensor Logs ──> ML-Powered Offline Perception ──> Auto Ground-Truth Labels
                                                            │
                                                  Attribute Computation
                                                  (hundreds of searchable attributes)
                                                            │
                                                 ┌──────────┼──────────┐
                                                 │          │          │
                                             AV State   Agent-Based  Error
                                             Attributes  Attributes  Attributes
                                             (speed,    (type, dist, (detection,
                                              lane)      speed)      prediction)
                                                 │          │          │
                                                 └──────────┼──────────┘
                                                            │
                                                 Searchable Scenario Database
                                                            │
                                                  SQL-Based Queries
                                                  ("find all scenarios where
                                                   online perception missed
                                                   a pedestrian at > 50m")
```

---

## 20. Key Papers

### Papers Authored by Motional/nuTonomy Researchers

| Year | Paper | Venue | Authors (Affiliation) | Contribution |
|---|---|---|---|---|
| 2019 | **PointPillars: Fast Encoders for Object Detection from Point Clouds** | CVPR 2019 | Alex H. Lang, Sourabh Vora, Holger Caesar, Lubing Zhou, Jiong Yang, Oscar Beijbom (nuTonomy) | First real-time LiDAR detector (62 Hz); pillar-based encoding; KITTI SOTA |
| 2020 | **nuScenes: A Multimodal Dataset for Autonomous Driving** | CVPR 2020 | Holger Caesar, Varun Bankiti, Alex H. Lang, Sourabh Vora, Venice Erin Liong, Qiang Xu, Anush Krishnan, Yu Pan, Giancarlo Baldan, Oscar Beijbom (Motional) | First full-sensor-suite AV dataset; 23 classes; NDS metric; 12,000+ downloads |
| 2020 | **PointPainting: Sequential Fusion for 3D Object Detection** | CVPR 2020 | Sourabh Vora, Alex H. Lang, Bassam Helou, Oscar Beijbom (Motional) | Sequential camera-LiDAR fusion; improved all tested LiDAR detectors |
| 2021 | **nuPlan: A Closed-Loop ML-Based Planning Benchmark for Autonomous Vehicles** | arXiv/ICRA | Holger Caesar et al. (Motional) | World's first ML planning benchmark; 1,500 hours; 4 cities |
| 2021 | **MVFuseNet: Improving End-to-End Object Detection and Motion Forecasting through Multi-View Fusion of LiDAR Data** | CVPR 2021 Workshop (WAD) | Ankit Laddha, Shivam Gautam et al. (Motional) | First dual RV+BEV LiDAR temporal fusion; joint detection + forecasting |
| 2021 | **Panoptic nuScenes: A Large-Scale Benchmark for LiDAR Panoptic Segmentation and Tracking** | IEEE RA-L 2021 | Whye Kit Fong, Rohit Mohan, Juana Valeria Hurtado, Lubing Zhou, Holger Caesar, Oscar Beijbom, Abhinav Valada (Motional + U. Freiburg) | 1.1B annotated points; panoptic segmentation + tracking |
| 2023 | **Training Strategies for Vision Transformers for Object Detection** | CVPR 2023 Workshop (WAD) | (Motional) | 63% inference speedup with 3% performance drop for ViT-based detection |
| 2023 | **Offline Tracking with Object Permanence** | CVPR/arXiv 2023 | (Related research) | Temporal reasoning for occluded object tracking |
| 2024 | **nuScenes Revisited: Progress and Challenges in Autonomous Driving** | arXiv 2024 | Whye Kit Fong, Venice Erin Liong, Kok Seang Tan, Holger Caesar | Retrospective on nuScenes impact and future directions |

### Closely Related Papers (Built on Motional's Ecosystem)

| Year | Paper | Venue | Relevance to Motional |
|---|---|---|---|
| 2021 | **CenterPoint: Center-based 3D Object Detection and Tracking** | CVPR 2021 | State-of-the-art on nuScenes; used in nuPlan auto-labeling |
| 2022 | **TransFusion: Robust LiDAR-Camera Fusion for 3D Object Detection with Transformers** | CVPR 2022 | 1st place on nuScenes tracking; soft-association fusion approach |
| 2022/23 | **BEVFusion: Multi-Task Multi-Sensor Fusion with Unified Bird's-Eye View Representation** | NeurIPS 2022 / ICRA 2023 | SOTA on nuScenes detection and BEV segmentation; unified BEV fusion |
| 2023 | **Occ3D: A Large-Scale 3D Occupancy Prediction Benchmark for Autonomous Driving** | NeurIPS 2023 | Built on nuScenes; occupancy prediction benchmark |

### nuTonomy Foundational Research

| Topic | Contribution |
|---|---|
| **Sampling-Based Motion Planning** | Algorithms (RRT*, PRM) with provable guarantees of completeness, correctness, and optimality |
| **Formal Language Specifications** | Translating driving rules into formal logic that can be verified |
| **Model Checking** | Automated verification of control software against formal specifications |
| **Formal Collision Risk Estimation** | Compositional data-driven approaches for probabilistic collision risk |
| **Rules of the Road Compliance** | Formal methods for traffic law compliance in dynamic environments |

---

## 21. Key Patents

### Motional AD LLC Patent Portfolio

Motional AD LLC holds patents across perception, planning, and safety. In the LiDAR software sector specifically, Motional holds **5 patent assets** in the Software section of Automobile Vision: LIDAR -- the second most behind only General Motors.

#### Perception-Related Patents

| Patent | Title | Technology Area |
|---|---|---|
| **US20210080558A1** | Extended Object Tracking Using RADAR | Radar-based extended object tracking using RLS-based velocity estimation; originally assigned to Aptiv, reassigned to Motional AD LLC (2020) |
| **US20190004159A1** | LiDAR Sensor Alignment System | Imaging device + LiDAR alignment; object classification for orientation confirmation; assigned Aptiv --> Motional (2020) |
| **US10598791B2** | Object Detection Based on LiDAR Intensity | Determining object characteristics from LiDAR intensity values |
| **US10366294B2** | Transparency-Characteristic Based Object Classification | Object classification for automated vehicles using LiDAR; assigned Aptiv --> Motional (2022) |
| **DK180393B1** | Data Fusion System for Non-Synchronized Perception Sensors | Temporal synchronization of multi-sensor data with different timestamps (filed 2018, granted 2021) |
| **US10126136B2** | Route Planning for an Autonomous Vehicle | Route planning algorithms (nuTonomy heritage) |
| **US9645577** | Facilitating Vehicle Driving and Self-Driving | Core autonomous driving facilitation (nuTonomy heritage) |
| **(Unpublished)** | Scene-Dependent Object Queries for Bounding Box Generation | Perception system generating bounding boxes using scene-dependent object queries |
| **(Unpublished)** | Dynamic Occupancy Grid from LiDAR + Semantic Map | DOG generation with per-cell probability density functions from LiDAR data |

#### Planning and Safety Patents

| Patent | Title | Technology Area |
|---|---|---|
| **EP3593337A4** | Planning for Unknown Objects by an Autonomous Vehicle | Handling unknown/novel objects in motion planning |
| **DE112019005425T5** | Redundancy in Autonomous Vehicles | Sensor and compute redundancy architecture |

#### Patent Portfolio Characteristics

- **Heritage transfer**: Multiple patents were originally assigned to Aptiv Technologies Limited and subsequently reassigned to Motional AD LLC upon JV formation
- **Karl Iagnemma**: 50+ issued/filed patents across his career (many in the Motional/nuTonomy portfolio)
- **Focus areas**: LiDAR processing, radar tracking, sensor fusion, object classification, motion planning, safety systems

---

## 22. Perception Metrics

### nuScenes Detection Score (NDS)

The **nuScenes Detection Score (NDS)** is the primary metric for evaluating 3D object detection on the nuScenes benchmark. It was designed by Motional's research team to provide a single number that captures both detection accuracy and the quality of additional object attributes.

#### NDS Formula

```
NDS = (1/10) * [5 * mAP + sum(1 - min(1, mTP_i)) for i in {ATE, ASE, AOE, AVE, AAE}]
```

Or equivalently:

```
NDS = (1/10) * [5*mAP + (1-min(1,mATE)) + (1-min(1,mASE)) + (1-min(1,mAOE)) + (1-min(1,mAVE)) + (1-min(1,mAAE))]
```

**Weighting**: mAP receives weight 5; each of the 5 True Positive (TP) metrics receives weight 1; the total (5+5=10) is normalized.

#### Component Metrics

| Metric | Full Name | Description | Unit |
|---|---|---|---|
| **mAP** | Mean Average Precision | Detection accuracy; uses **2D center distance** on ground plane (not IoU) as matching criterion | -- |
| **mATE** | Mean Average Translation Error | 2D Euclidean center distance (on ground plane) | meters |
| **mASE** | Mean Average Scale Error | 1 - IOU after aligning centers and orientation | -- |
| **mAOE** | Mean Average Orientation Error | Smallest yaw angle difference between prediction and ground truth | radians |
| **mAVE** | Mean Average Velocity Error | Absolute velocity error (2D) | m/s |
| **mAAE** | Mean Average Attribute Error | 1 - accuracy of attribute classification (e.g., parked vs. moving) | -- |

#### mAP Matching: Center Distance, Not IoU

A critical design decision: nuScenes uses **2D center distance on the ground plane** instead of intersection-over-union (IoU) for matching detections to ground truth. This was deliberate because:

- At long range, small errors in size estimation can drastically change IoU even when the center is well-localized
- Center distance is more interpretable (in meters) than IoU (dimensionless)
- Size and orientation errors are captured separately by mASE and mAOE

The matching thresholds for mAP are: {0.5m, 1.0m, 2.0m, 4.0m} for 2D center distance.

#### Decomposability

NDS is designed to be **decomposable on multiple levels**:
- The overall NDS breaks down into mAP and 5 TP metrics
- Each TP metric is an average across all 10 detection classes
- mAP can be examined per-class to understand which object types are hardest to detect
- This allows detailed analysis of model strengths and weaknesses

### nuScenes Tracking Metrics

| Metric | Description |
|---|---|
| **AMOTA** (primary) | Average Multi-Object Tracking Accuracy; integrates MOTA over 40 recall thresholds (n=40 point interpolation); excludes recall < 0.1 |
| **AMOTP** | Average Multi-Object Tracking Precision; integrates MOTP over recall thresholds |
| **MOTA** | Multi-Object Tracking Accuracy (at a single threshold) |
| **MOTP** | Multi-Object Tracking Precision (position error of matched tracks) |
| **IDS** | Identity Switches |
| **FP** | False Positives |
| **FN** | False Negatives |

AMOTA is the primary ranking metric for the nuScenes tracking challenge. It remedies limitations of single-threshold MOTA by averaging across a range of recall rates, providing a more robust evaluation.

### Segmentation Metrics

| Metric | Task | Description |
|---|---|---|
| **mIoU** | Semantic/Panoptic Segmentation | Mean Intersection-over-Union across all classes |
| **fwIoU** | Semantic Segmentation | Frequency-weighted IoU (class-weighted by frequency) |
| **PQ** | Panoptic Segmentation | Panoptic Quality = SQ * RQ (segmentation quality * recognition quality) |

### Motional Internal Metrics (Inferred)

While Motional has not fully disclosed its internal evaluation metrics, the following are known or inferred:

- **High-performance metric computation framework**: A flexible system designed for efficient evaluation at scale (referenced in CLF documentation)
- **Online vs. Offline disagreement rate**: Used in scenario mining to identify perception failures
- **VRU detection AP**: Specifically tracked for radar perception improvement (3x improvement cited)
- **Safety-relevant detection metrics**: False negative rate for safety-critical objects (pedestrians, vehicles in path) is almost certainly tracked with tighter thresholds than general mAP

---

## Sources

### Motional Official Sources
- [Motional - Improving AV Perception Through Transformative ML](https://motional.com/news/technically-speaking-improving-av-perception-through-transformative-machine-learning)
- [Motional - Imaging Radar Architecture](https://motional.com/news/technically-speaking-motionals-imaging-radar-architecture-paves-road-major-improvements)
- [Motional - Rethinking the Role of Radars](https://motional.com/news/rethinking-role-radars-robotaxis-mature)
- [Motional - Auto-Labeling with Offline Perception](https://motional.com/news/technically-speaking-auto-labeling-offline-perception)
- [Motional - Predicting the Future in Real Time](https://motional.com/news/technically-speaking-predicting-future-real-time-safer-autonomous-driving)
- [Motional - End-to-End ML Tracking](https://motional.com/news/building-towards-end-end-machine-learning-autonomy-improving-multi-object-tracking-single)
- [Motional - Transitioning to ML-Powered Motion Planning](https://motional.com/news/technical-speaking-transitioning-rule-based-ml-powered-motion-planning)
- [Motional - Large Driving Models (LDMs)](https://motional.com/news/how-motional-accelerating-scale-affordability-and-safety-large-driving-models-ldms)
- [Motional - Learning with Every Mile Driven](https://motional.com/news/technically-speaking-learning-every-mile-driven)
- [Motional - Mining for Scenarios](https://motional.com/news/technically-speaking-mining-scenarios-help-better-train-our-avs)
- [Motional - Omnitag Data Mining Framework](https://motional.com/news/technical-speaking-omnitag-ml-powered-multimodal-data-mining-framework)
- [Motional - PointPainting](https://motional.com/news/pointpainting-sequential-fusion-3d-object-detection)
- [Motional - Las Vegas Perception Challenges](https://motional.com/news/jackpot-how-las-vegas-helped-make-motionals-driverless-vehicles-ready-consumers)
- [Motional - IONIQ 5 Robotaxi](https://motional.com/news/ioniq-5-robotaxi-production-vehicle-tailor-made-robotaxi-service)
- [Motional - Panoptic nuScenes](https://motional.com/news/panoptic-nuscenes-dataset-large-scale-benchmark-lidar-panoptic-segmentation-and-tracking)
- [Motional - nuPlan Dataset](https://motional.com/news/motionals-nuplan-dataset-set-usher-next-generation-autonomous-vehicles)
- [Motional - nuPlan Benchmark](https://motional.com/news/nuplan-closed-loop-ml-based-planning-benchmark-autonomous-vehicles)
- [Motional Builds Radars into Perception System (Aptiv)](https://www.aptiv.com/en/insights/article/motional-builds-radars-into-perception-system)

### Research Papers
- [PointPillars (CVPR 2019)](https://arxiv.org/abs/1812.05784)
- [nuScenes (CVPR 2020)](https://openaccess.thecvf.com/content_CVPR_2020/papers/Caesar_nuScenes_A_Multimodal_Dataset_for_Autonomous_Driving_CVPR_2020_paper.pdf)
- [PointPainting (CVPR 2020)](https://arxiv.org/abs/1911.10150)
- [CenterPoint (CVPR 2021)](https://arxiv.org/abs/2006.11275)
- [MVFuseNet (CVPR 2021 Workshop)](https://arxiv.org/abs/2104.10772)
- [nuPlan (arXiv 2021)](https://arxiv.org/abs/2106.11810)
- [nuPlan (ICRA 2024)](https://arxiv.org/abs/2403.04133)
- [Panoptic nuScenes (IEEE RA-L 2021)](https://arxiv.org/abs/2109.03805)
- [TransFusion (CVPR 2022)](https://arxiv.org/abs/2203.11496)
- [BEVFusion (NeurIPS 2022 / ICRA 2023)](https://arxiv.org/abs/2205.13542)
- [Occ3D (NeurIPS 2023)](https://arxiv.org/abs/2304.14365)
- [Offline Tracking with Object Permanence (2023)](https://arxiv.org/abs/2310.01288)
- [nuScenes Revisited (2024)](https://arxiv.org/abs/2512.02448)

### nuScenes Devkit and Documentation
- [nuScenes Detection Evaluation README](https://github.com/nutonomy/nuscenes-devkit/blob/master/python-sdk/nuscenes/eval/detection/README.md)
- [nuScenes Lidarseg Instructions](https://github.com/nutonomy/nuscenes-devkit/blob/master/docs/instructions_lidarseg.md)
- [nuScenes Tracking Evaluation](https://github.com/nutonomy/nuscenes-devkit/tree/master/python-sdk/nuscenes/eval/tracking)
- [nuScenes Schema](https://github.com/nutonomy/nuscenes-devkit/blob/master/docs/schema_nuscenes.md)
- [BEVFusion GitHub (MIT Han Lab)](https://github.com/mit-han-lab/bevfusion)
- [CenterPoint GitHub](https://github.com/tianweiy/CenterPoint)
- [TransFusion GitHub](https://github.com/XuyangBai/TransFusion)

### Patents
- [US20210080558A1 - Extended Object Tracking Using RADAR](https://patents.google.com/patent/US20210080558A1/en)
- [US20190004159A1 - LiDAR Sensor Alignment System](https://patents.google.com/patent/US20190004159A1/en)
- [US10598791B2 - Object Detection Based on LiDAR Intensity](https://patents.google.com/patent/US10598791B2/en)
- [US10366294B2 - Transparency-Based Object Classification](https://patents.google.com/patent/US10366294B2/en)
- [DK180393B1 - Data Fusion for Non-Synchronized Sensors](https://patents.google.com/patent/DK180393B1/en)
- [Motional AD LLC Patent Portfolio (Patent Forecast)](https://www.patentforecast.com/2022/05/27/motional-ad-llcs-patents-are-driving-the-autonomous-vehicle-sector-forward/)
- [Motional AD LLC Patents (Justia)](https://patents.justia.com/assignee/motional-ad-llc)

### Other Sources
- [nuTonomy Wikipedia](https://en.wikipedia.org/wiki/NuTonomy)
- [MIT News - nuTonomy Driverless Taxi](https://news.mit.edu/2016/startup-nutonomy-driverless-taxi-service-singapore-0324)
- [IEEE Spectrum - nuTonomy Singapore](https://spectrum.ieee.org/after-mastering-singapores-streets-nutonomys-robotaxis-are-poised-to-take-on-new-cities)
- [Motional L4 Robotaxis 2026 (ADAS International)](https://www.autonomousvehicleinternational.com/news/ai-sensor-fusion/motional-to-launch-fully-driverless-level-4-robotaxis-in-las-vegas-by-end-of-2026.html)
- [Hyundai IONIQ 5 Robotaxi Safety Campaign](https://www.hyundai.com/worldwide/en/brand-journal/mobility-solution/ioniq5robotaxi)
- [Oscar Beijbom - Google Scholar](https://scholar.google.com/citations?user=XP_Hxm4AAAAJ&hl=en)
- [nuScenes Detection Score (NDS) - Emergent Mind](https://www.emergentmind.com/topics/nuscenes-detection-score-nds-1ca43951-25cb-4fd2-879a-6efee5cc80d3)
- [nuScenes on AWS Open Data Registry](https://registry.opendata.aws/motional-nuscenes/)
