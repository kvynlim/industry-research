# Tesla FSD Perception Stack: Comprehensive Technical Deep Dive

**Last Updated:** March 2026

---

## Table of Contents

1. [Vision-Only Philosophy](#1-vision-only-philosophy)
2. [Camera Configuration](#2-camera-configuration)
3. [Image Signal Processing & Raw Data Pipeline](#3-image-signal-processing--raw-data-pipeline)
4. [Calibration](#4-calibration)
5. [HydraNet / Backbone Architecture](#5-hydranet--backbone-architecture)
6. [BEV (Bird's Eye View) Transformer](#6-bev-birds-eye-view-transformer)
7. [Occupancy Networks](#7-occupancy-networks)
8. [Temporal Module](#8-temporal-module)
9. [Object Detection & 3D Bounding Boxes](#9-object-detection--3d-bounding-boxes)
10. [Depth Estimation](#10-depth-estimation)
11. [Lane Detection & Road Geometry](#11-lane-detection--road-geometry)
12. [Traffic Light & Sign Detection](#12-traffic-light--sign-detection)
13. [Semantic Segmentation](#13-semantic-segmentation)
14. [Object Tracking](#14-object-tracking)
15. [End-to-End Architecture (v12+)](#15-end-to-end-architecture-v12)
16. [Neural Network Planner Integration](#16-neural-network-planner-integration)
17. [Auto-Labeling Pipeline](#17-auto-labeling-pipeline)
18. [Data Engine](#18-data-engine)
19. [Model Compilation & Inference](#19-model-compilation--inference)
20. [Key Architectural Evolution (HW2 to AI5)](#20-key-architectural-evolution-hw2-to-ai5)
21. [Model Sizes & Performance Numbers](#21-model-sizes--performance-numbers)
22. [Patents](#22-patents)
23. [Published Talks & Presentations](#23-published-talks--presentations)

---

## 1. Vision-Only Philosophy

### The Core Thesis

Tesla is the only major autonomous vehicle company pursuing a **pure camera-only perception approach** -- no LiDAR, no radar (removed 2021--2023), and no ultrasonic sensors (removed 2022--2023). The rationale, articulated most clearly by Andrej Karpathy (Tesla's former Sr. Director of AI, 2017--2022) and reinforced by Elon Musk, rests on a first-principles argument:

> "Humans drive with vision alone. A sufficiently capable neural network, given the same visual input as a human driver, should be able to match or exceed human driving performance."

This argument was formalized by Karpathy in his CVPR 2021 keynote, where he demonstrated that Tesla's new vision-only approach for Autopilot had **higher precision and recall** than the prior sensor-fusion approach that combined cameras with radar.

### Technical Justification

**1. Information Density**

Cameras capture far richer information than any other sensor modality:
- Texture, color, and contextual information that point-cloud systems cannot detect (e.g., text on road signs, traffic light colors, brake lights, turn signals)
- At 5.4 MP per camera (HW4), each frame contains roughly 43 million pixels of information across 8 cameras per timestep
- LiDAR point clouds are sparse by comparison -- typically 100K--300K points per scan, with no color or texture information

**2. Scalability**

Karpathy's central argument at CVPR 2021: camera-based perception scales in a way that LiDAR-based systems cannot.
- HD LiDAR maps are expensive to build and maintain, and become stale quickly as the road environment changes
- Vision-based perception requires no pre-mapped infrastructure -- it generalizes to any road on Earth
- Tesla's fleet of 9+ million vehicles acts as a distributed data-collection platform, generating the equivalent of **500 years of driving data every day** -- impossible to replicate with a LiDAR-equipped test fleet

**3. Cost Efficiency**

A camera module costs approximately $10--20; a high-end automotive LiDAR costs $500--10,000+. Tesla's camera suite for the entire vehicle costs a fraction of a single LiDAR unit, enabling deployment at consumer price points.

**4. Sensor Contention Elimination**

A recurring Musk argument: when LiDAR/radar and cameras disagree, the system must arbitrate. This "sensor contention" introduces a fundamental ambiguity. With cameras only, the neural network receives a single, unified modality and learns to interpret it end-to-end.

### Acknowledged Limitations

| Limitation | Description | Mitigation |
|-----------|-------------|------------|
| **Low-light / Night** | Cameras degrade in darkness; LiDAR is light-invariant | 120 dB HDR sensors (IMX490); IR-capable optics; 12-bit raw data with 4,096 brightness levels |
| **Direct sun / Glare** | Saturation and lens flare | Multi-exposure HDR; ISP tone mapping; sun visor occlusion handled via temporal persistence |
| **Heavy rain / Snow / Fog** | Reduced visibility | Temporal aggregation (remembers environment from before degradation); occupancy persistence from prior frames |
| **Depth accuracy at range** | Monocular depth estimation degrades with distance | Narrow FOV telephoto camera (250 m range); multi-frame triangulation; stereo from overlapping camera views |
| **No active ranging** | Cannot measure distance to featureless surfaces (e.g., flat walls) | SDF-based occupancy prediction learns surface geometry from training data |

### The "Bitter Lesson" Alignment

Tesla's research philosophy explicitly follows Rich Sutton's "Bitter Lesson": general methods that leverage computation and data at scale consistently outperform hand-engineered domain-specific approaches. Rather than engineering specialized sensor pipelines for each modality, Tesla bets that a sufficiently large neural network, trained on sufficiently large data, will learn to extract all necessary information from cameras.

---

## 2. Camera Configuration

### HW3 Camera System (2019--2023)

Eight external cameras plus one cabin-facing camera, all using the **ON Semiconductor (Aptina) AR0136AT** CMOS image sensor.

| Camera | Position | FOV | Max Range | Resolution | Frame Rate |
|--------|----------|-----|-----------|------------|------------|
| Narrow Forward | Windshield, center top | ~35 deg | 250 m | 1280 x 960 (1.2 MP) | 36 fps |
| Main Forward | Windshield, center top | ~50 deg | 150 m | 1280 x 960 (1.2 MP) | 36 fps |
| Wide Forward | Windshield, center top | ~150 deg (fisheye) | 60 m | 1280 x 960 (1.2 MP) | 36 fps |
| Left B-Pillar | Driver-side B-pillar | ~90 deg | 80 m | 1280 x 960 (1.2 MP) | 36 fps |
| Right B-Pillar | Passenger-side B-pillar | ~90 deg | 80 m | 1280 x 960 (1.2 MP) | 36 fps |
| Left Repeater | Left front fender (turn signal housing) | ~90 deg | 80 m | 1280 x 960 (1.2 MP) | 36 fps |
| Right Repeater | Right front fender (turn signal housing) | ~90 deg | 80 m | 1280 x 960 (1.2 MP) | 36 fps |
| Rear | Above license plate | ~130 deg | 50 m | 1280 x 960 (1.2 MP) | 36 fps |
| Cabin | Above rearview mirror | -- | -- | -- | IR-capable |

**AR0136AT Sensor Specifications:**
- Pixel size: 3.75 um
- 12-bit HDR output
- RCCC (Red-Clear-Clear-Clear) color filter array on most cameras
- Rolling shutter

**Three Forward Cameras** are co-located behind the windshield in a tri-focal cluster:
- The **narrow** camera provides long-range perception (up to 250 m) for highway-speed object detection
- The **main** camera covers the primary driving field of view
- The **wide** camera captures the full intersection scene, nearby vehicles, and pedestrians entering from the side

### HW4 (AI4) Camera System (2023--present)

| Camera | Position | FOV | Resolution | Sensor |
|--------|----------|-----|------------|--------|
| Main Forward | Windshield, center | Wide (~120 deg) | 2896 x 1876 (5.4 MP) | Sony IMX963 (custom IMX490 variant) |
| Narrow Forward | Windshield, center | Telephoto | 2896 x 1876 (5.4 MP) | Sony IMX963 |
| Wide Forward | Windshield, center (dummy/inactive on some models) | Fisheye | -- | Position retained for HW3 compatibility |
| Left B-Pillar | Driver-side B-pillar | ~90 deg (side + forward) | 2896 x 1876 (5.4 MP) | Sony IMX490 |
| Right B-Pillar | Passenger-side B-pillar | ~90 deg (side + forward) | 2896 x 1876 (5.4 MP) | Sony IMX490 |
| Left C-Pillar | Driver-side C-pillar (new position) | ~90 deg (side + rearward) | 2896 x 1876 (5.4 MP) | Sony IMX490 |
| Right C-Pillar | Passenger-side C-pillar (new position) | ~90 deg (side + rearward) | 2896 x 1876 (5.4 MP) | Sony IMX490 |
| Rear | Above license plate | Wide fisheye | 2896 x 1876 (5.4 MP) | Sony IMX490 |
| Cabin | Above rearview mirror | Wide | -- | IR + visible light |

**Sony IMX490/IMX963 Sensor Specifications:**
- Resolution: 5.4 MP (2896 x 1876)
- Pixel size: 3.0 um
- HDR: 120 dB dynamic range (on-sensor HDR via sub-pixel architecture)
- LED flicker mitigation (critical for reading electronic road signs and traffic lights at high frame rates)
- 12-bit raw output with 4,096 brightness levels per pixel
- Red-tinted lens coatings for improved HDR and low-light performance

**Key HW3-to-HW4 Camera Changes:**

| Feature | HW3 | HW4 |
|---------|-----|-----|
| Resolution per camera | 1.2 MP | 5.4 MP (4.5x) |
| Total pixels per frame (8 cams) | ~9.8 MP | ~43.2 MP |
| Sensor type | ON Semi AR0136AT | Sony IMX490 / IMX963 |
| Dynamic range | ~80 dB | ~120 dB |
| Color filter array | RCCC | RCCC (custom variant) |
| Flicker mitigation | No | Yes |
| Fender repeater cameras | Yes (front fender) | No (replaced by C-pillar) |
| C-pillar cameras | No | Yes (new position) |
| Forward camera count | 3 active | 2 active + 1 dummy |
| Camera input capacity | 8 | Up to 13 (future-proofed) |
| Front bumper cameras | No | Added in 2025 lineup update |

### Camera Placement Rationale

The C-pillar cameras (HW4) replace the fender-mounted repeaters (HW3), providing better rearward-lateral coverage. The B-pillar cameras were retained but now look more forward-and-side, while C-pillar cameras handle side-and-rearward views. This arrangement eliminates blind spots in the rear quarter and provides better overlap between camera fields of view for stereo-like depth estimation.

---

## 3. Image Signal Processing & Raw Data Pipeline

### Traditional ISP (HW3 On-Chip)

The HW3 FSD chip contains a dedicated **Image Signal Processor (ISP)** with the following specifications:

| Parameter | Specification |
|-----------|--------------|
| Pipeline depth | 24-bit internal processing |
| Throughput | Up to 1 billion pixels per second |
| Camera serial interface (CSI) | Up to 2.5 billion pixels per second input capacity |
| Tone mapping | Yes -- exposes details in shadows and bright spots |
| Noise reduction | Yes -- spatial and temporal |
| HDR processing | Multi-exposure merge |
| Video encoder | H.265 (HEVC) for dashcam, cloud clip logging |

The traditional ISP pipeline performs: demosaicing, white balance, color correction, noise reduction, sharpening, tone mapping, dynamic range compression, lens distortion correction, and compression (e.g., JPEG/H.265).

### The ISP Bypass: Tesla's Raw Vision Approach

Tesla has taken a **radical departure** from conventional image processing. Rather than feeding ISP-processed images to the neural network, Tesla bypasses the ISP and feeds **raw sensor data** directly into the neural network.

**Why bypass the ISP?**

Traditional ISP processing compresses 12-bit raw data (4,096 brightness levels) down to 8-bit RGB (256 levels). This compression discards information that is critical for autonomous driving:

| Data Stage | Bit Depth | Brightness Levels | Information |
|-----------|-----------|-------------------|-------------|
| Raw sensor output | 12-bit | 4,096 per pixel | Full photon count; maximum dynamic range |
| After ISP (standard) | 8-bit | 256 per pixel | Compressed; tuned for human viewing |
| Neural network receives | 12-bit raw | 4,096 per pixel | All information preserved |

**RCCC Color Filter Array:**

Most Tesla cameras use a non-standard **RCCC (Red-Clear-Clear-Clear)** color filter array instead of the conventional RGGB Bayer pattern:

- Three "clear" (unfiltered) sub-pixels capture raw photon counts across the full visible spectrum, maximizing light sensitivity
- One red-filtered sub-pixel is sufficient for detecting red traffic lights, brake lights, and emergency vehicle colors
- The RCCC configuration prioritizes luminance resolution and low-light sensitivity over color accuracy -- because the neural network does not need color-accurate images for driving; it needs maximum information about the scene geometry, edges, and motion

**Raw Data Pipeline:**

```
Photons -> RCCC Sensor (12-bit, 4096 levels)
  -> No demosaicing
  -> No color correction
  -> No dynamic range compression
  -> No JPEG encoding
  -> Raw 12-bit data -> Neural Network input
```

The neural network learns to interpret the raw RCCC mosaic pattern directly. This means:
- The network implicitly learns its own "demosaicing"
- The network decides what is "relevant" in the image, not a hand-tuned ISP
- In extreme lighting transitions (tunnels, sunrise/sunset), the raw data preserves far more recoverable information than an ISP-processed image would

**Practical Impact:**

The IMX490 sensor's 120 dB HDR combined with 12-bit raw output allows the neural network to perceive detail simultaneously in deep shadows and bright highlights. A standard ISP would compress this into a range optimized for human viewing on an 8-bit display -- losing precisely the information needed for safe autonomous driving in challenging lighting.

---

## 4. Calibration

### The Calibration Problem

Tesla ships 9+ million vehicles with cameras that are:
- Installed with manufacturing tolerances (slight position/angle variations)
- Subject to shift over time from vibrations, temperature cycling, and minor impacts
- Viewing through windshields with varying optical properties

For the neural network to produce consistent results across the entire fleet, all cameras must present a standardized view of the world.

### Online Calibration Neural Network

Tesla solves this with a **calibration neural network** that runs as the first stage of the perception pipeline:

1. **Camera Rectification Transform:** Each of the 8 cameras is warped by a learned transformation into a **synthetic virtual camera** with standardized intrinsic and extrinsic parameters
2. **Fleet Consistency:** After rectification, the image from any given camera position on any Tesla in the fleet should look the same, regardless of manufacturing variations
3. **Continuous Update:** The calibration is not a one-time process -- it updates continuously as the vehicle drives, compensating for any drift in camera alignment

**Calibration Process for New Vehicles:**

| Stage | Method | Duration |
|-------|--------|----------|
| Factory calibration (2025+) | Automated: vehicle drives autonomously ~2 km on factory grounds | Minutes |
| Post-delivery (legacy) | Manual driving on roads with clear lane markings | 20--25 miles typical; up to 100 miles maximum |
| Ongoing | Continuous background refincement while driving | Perpetual |

**Technical Implementation:**

The rectification transform converts all raw images into a common virtual camera coordinate system before they enter the backbone network. This is a geometric operation (homography + lens distortion correction) whose parameters are inferred by the calibration neural network from visual features (vanishing points, lane line parallelism, horizon position).

After rectification, the images are passed to the RegNet backbone. This two-stage approach (calibrate first, then extract features) ensures that the learned features in the backbone are invariant to camera mounting variations.

### Extrinsic Calibration Sources

The calibration network estimates the 6-DOF extrinsic pose (position + orientation) of each camera relative to the vehicle body frame using:
- **Vanishing point geometry** from parallel lines (lane markings, building edges)
- **Horizon detection** for pitch and roll estimation
- **Multi-camera consistency constraints** where overlapping FOVs must agree on 3D geometry
- **IMU data** for ground-truth orientation reference during calibration

---

## 5. HydraNet / Backbone Architecture

### Overview

**HydraNet** is Tesla's multi-task learning architecture, introduced at AI Day 2021. The name references the mythological Hydra -- a single body (shared backbone) with multiple heads (task-specific decoders).

### Architecture Pipeline

```
8 Raw Camera Images
  -> Calibration Neural Net (rectification to virtual camera)
  -> RegNet Backbone (per-camera feature extraction)
  -> BiFPN (multi-scale feature fusion)
  -> Transformer Module (image space -> BEV vector space)
  -> Feature Queue (temporal caching)
  -> Video Module / Spatial RNN (temporal aggregation)
  -> Task-Specific Trunks + Heads (detection, segmentation, etc.)
```

### Stage 1: RegNet Backbone

Tesla replaced an earlier ResNet-50-based backbone with **RegNets** (Regularized Networks), which provide better accuracy-latency tradeoffs through a simplified design-space approach.

**Multi-Scale Feature Extraction:**

Each camera image (1280 x 960 on HW3) is processed independently through the RegNet backbone, producing a feature pyramid at multiple resolutions:

| Feature Level | Spatial Resolution | Channel Count | Purpose |
|--------------|-------------------|---------------|---------|
| Level 1 (finest) | 160 x 120 | Low (~64) | Fine details: lane markings, text, small objects |
| Level 2 | 80 x 60 | Medium (~128) | Mid-range features: vehicle shapes, signs |
| Level 3 | 40 x 30 | Higher (~256) | Larger structures: building outlines, road geometry |
| Level 4 (coarsest) | 20 x 15 | Highest (~512) | Full-scene context: scene type, spatial layout |

The key tradeoff: low-level features have high spatial resolution but limited semantic context, while high-level features have rich semantic context but coarse spatial resolution.

### Stage 2: BiFPN (Bi-directional Feature Pyramid Network)

After the RegNet backbone extracts multi-scale features, they are fused through a **BiFPN** -- a weighted bi-directional feature pyramid network:

- **Bi-directional flow:** Information flows both top-down (high-level context enriches low-level detail) and bottom-up (fine details propagate to contextual features)
- **Weighted fusion:** The network learns the importance of each feature scale through learnable weights, with weight normalization for training stability
- **Efficiency optimization:** Single-input nodes are removed to reduce computation
- **Cross-scale communication:** Each scale can directly exchange information with adjacent scales, enabling the detection head for small, distant objects to benefit from high-level scene understanding

### Stage 3: Multi-Camera Fusion

After per-camera feature extraction and BiFPN fusion, the features from all 8 cameras must be combined into a single unified representation. Tesla uses a **transformer-based multi-camera fusion** module:

1. **Key-Value Generation:** Each camera's BiFPN features generate key and value vectors
2. **Query Generation:** A raster matching the desired output space (BEV grid or 3D volume) is tiled with positional encodings and encoded via MLP into query vectors
3. **Cross-Attention:** Queries attend to keys across all 8 cameras simultaneously, pulling relevant values from whichever camera(s) observe each spatial location
4. **Output:** A unified multi-camera feature map in the desired output coordinate system

### Stage 4: Task-Specific Heads

The fused features branch into multiple **trunks** (shared per-task-group computation) and **terminals** (task-specific output layers):

| Task Head | Output | Purpose |
|-----------|--------|---------|
| Object Detection | 3D bounding boxes + class labels + velocities | Detect vehicles, pedestrians, cyclists, etc. |
| Lane Lines | Polyline geometry in BEV + lane type | Lane boundary detection |
| Road Edges | Boundary curves | Drivable area delimitation |
| Road Surface | 3D height map | Ground plane estimation |
| Drivable Space | Binary mask in BEV | Where the vehicle can physically drive |
| Traffic Lights | Bounding box + state (color, arrow, relevance) | Traffic signal interpretation |
| Traffic Signs | Class + position | Speed limits, stop signs, yield signs |
| Depth | Per-pixel depth map | Monocular depth estimation |
| Semantic Segmentation | Per-pixel class labels | Road, sidewalk, vegetation, building, etc. |
| Velocity Estimation | Per-object velocity vectors | Dynamic object motion |

**Key Design Benefit -- Task Decoupling:**

Each head can be fine-tuned independently without affecting other tasks. If traffic light detection needs improvement, the traffic light head can be retrained while the backbone and other heads remain frozen. This dramatically accelerates iteration speed for a team of ~20 engineers all working on a single neural network simultaneously.

### Scale of the Modular Stack

At peak complexity (pre-v12), the HydraNet system comprised:
- **48 distinct neural networks** operating in concert
- Producing **1,000 distinct output tensors** per timestep
- Running on 2 NPUs across the dual FSD chips

---

## 6. BEV (Bird's Eye View) Transformer

### The Fundamental Problem

Cameras produce 2D images, but driving requires understanding 3D space. The BEV transformer solves the **2D-to-3D transformation problem**: converting multi-camera 2D image features into a unified top-down (bird's eye view) spatial representation where distances, sizes, and spatial relationships are metrically accurate.

### Architecture

Tesla's BEV transformer, first detailed at AI Day 2021, uses a **spatial cross-attention mechanism**:

#### Step 1: Initialize the BEV Grid

A regular 2D grid in BEV space (top-down view, centered on the vehicle) is initialized. Each grid cell represents a physical location in the world (e.g., 0.5 m x 0.5 m resolution covering an area around the vehicle).

#### Step 2: Positional Encoding

Each BEV grid cell is assigned positional encodings using:
- **Sinusoidal functions** (sine and cosine at different frequencies) encoding the (x, y) position of each cell in the physical world
- These positional encodings are processed through an **MLP** to produce a set of **query vectors** -- one per BEV grid cell

#### Step 3: Image Feature Key-Value Pairs

For each of the 8 cameras:
- The BiFPN features are projected into **key** and **value** vectors
- The keys encode "what spatial information is available at each position in this camera's image"
- The values encode "the actual feature content at that position"

#### Step 4: Cross-Attention

The BEV queries attend to the image keys across all cameras simultaneously:

```
Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V

where:
  Q = BEV positional queries (what 3D location am I asking about?)
  K = Image feature keys (where in the images can I find information?)
  V = Image feature values (what does the image say about that location?)
```

The attention weights learn the geometric mapping from BEV locations to camera pixel locations. Through training, the network discovers which camera pixels correspond to which 3D world positions, effectively learning the camera projection geometry implicitly.

#### Step 5: Multi-Head Attention

Multiple attention heads operate in parallel, each specializing in different aspects of the projection:
- Some heads may focus on near-field mapping
- Others on long-range correspondences
- Others on cross-camera overlap regions where stereo-like depth cues are available

#### Step 6: Output

The result is a **dense BEV feature map** -- a top-down spatial representation where each cell contains rich learned features about that location in the world. This BEV feature map is the primary intermediate representation consumed by downstream tasks (occupancy prediction, lane detection, object detection, planning).

### Why Transformers for BEV?

Before Tesla popularized this approach (sparking the academic BEVFormer line of work), BEV projection was done using explicit geometric transformations (inverse perspective mapping, depth-based lifting). These approaches required known camera intrinsics/extrinsics and explicit depth estimates.

The transformer-based approach is superior because:
- It **learns** the projection rather than computing it from calibration parameters, making it robust to calibration errors
- It handles **occluded and ambiguous geometry** by aggregating information across multiple cameras and multiple attention heads
- It naturally handles **varying camera configurations** across hardware generations (HW3 vs HW4) by learning different attention patterns

### Relationship to BEVFormer

Tesla's approach predates and inspired the academic **BEVFormer** paper (ECCV 2022, by Zhiqi Li et al.), which formalized similar ideas with:
- Spatial cross-attention between BEV queries and multi-camera image features
- Temporal self-attention between current and previous BEV features
- ResNet-101-DCN + FPN backbone (vs. Tesla's RegNet + BiFPN)

Tesla's implementation likely differs in many specifics (not publicly documented), but the core principle -- learned spatial cross-attention from images to BEV -- is shared.

---

## 7. Occupancy Networks

### Introduction

Occupancy Networks were introduced at **CVPR 2022** (workshop keynote by Ashok Elluswamy) and detailed at **AI Day 2022** (September 2022). They represent Tesla's approach to **general 3D scene understanding** -- replacing the need for explicit object detection for many safety-critical decisions.

### Core Concept

Rather than detecting objects and fitting bounding boxes, the occupancy network divides the 3D space around the vehicle into a dense grid of **voxels** (volumetric pixels -- small cubes) and predicts whether each voxel is free or occupied.

This approach handles:
- **Arbitrary geometry** that bounding boxes cannot capture (ladders on trucks, side trailers, overhanging structures, construction equipment)
- **Novel objects** never seen in training (the network only needs to predict "something is here," not "this is a bicycle")
- **Continuous surfaces** (curbs, walls, guardrails) that are poorly represented by individual bounding boxes

### Architecture

```
8 Camera Images
  -> RegNet + BiFPN Backbone (per-camera features)
  -> Spatial Attention Module (image features -> 3D occupancy feature volume)
    - Inputs: Image Key, Image Value, 3D Spatial Queries
  -> Temporal Fusion (merge with t-1, t-2, t-3, ... feature volumes)
  -> Deconvolution Layers
  -> Outputs: Occupancy Volume + Occupancy Flow
```

**Step-by-step (per Tesla patent US20240185445A1):**

1. **Camera Input (Step 210):** Eight camera feeds are captured simultaneously
2. **Featurization (Step 220):** RegNet + BiFPN extracts and fuses multi-scale features; generates multi-camera query embeddings
3. **3D Reconstruction (Step 230):** A transformer aggregates overlapping camera views into a unified 3D representation using 3D spatial queries on 2D featurized image data
4. **Temporal Fusion (Step 240):** The 3D representation at timestamp t is fused with representations from t-1, t-2, t-3 to produce spatial-temporal features
5. **Deconvolution (Step 250):** Mathematical operations reverse convolution effects, transforming fused features back to voxel space
6. **Volume Output (Step 260):** Generates per-voxel occupancy predictions

### Voxel Resolution

| Parameter | Value |
|-----------|-------|
| Default voxel size | 33 cm per edge (~1 foot cubes) |
| Refined voxel size (near ego, occupied) | 10 cm per edge |
| Adaptive refinement | Voxels near the vehicle or on occupied surfaces are dynamically subdivided |
| Sub-voxel analysis | Trilinear interpolation estimates occupancy within partially-occupied voxels |
| Resolution increase (v13) | 8x increase in voxel resolution vs. initial implementation |

### Output Categories

The occupancy network produces four categories of output per voxel:

| Output | Description |
|--------|-------------|
| **Occupancy Volume** | Binary or probabilistic designation: occupied (1) or free (0) for each voxel |
| **Occupancy Flow** | Velocity vector for each occupied voxel -- how fast and in what direction the mass is moving |
| **Shape Information** | Surface geometry of the occupied region, using regression to identify object shapes |
| **Semantic Labels** | Classification: car, truck, pedestrian, street curb, building, road surface, vegetation, etc.; plus static vs. moving |

### Signed Distance Fields (SDF)

Rather than binary occupied/free predictions, Tesla uses **Signed Distance Fields** for smoother, more precise geometry:

- For any point in the 3D grid, the model predicts its **distance to the nearest solid surface**
- **Positive values:** point is outside the object (in free space)
- **Negative values:** point is inside the object
- **Zero:** point is exactly on the surface
- The SDF provides continuous, sub-voxel geometry -- vastly more precise than binary occupancy

### Performance

| Metric | Value |
|--------|-------|
| Inference speed | >100 FPS (3x faster than camera frame rate) |
| Memory efficiency | "Super memory efficient" (Tesla's characterization) |
| Temporal persistence | Maintains 3D "Voxel Map" across time; tracks objects even when temporarily occluded |

### Occupancy Flow: Motion Understanding

The flow output uses color encoding for visualization:
- **Red:** Forward-moving voxels
- **Blue:** Backward-moving voxels
- **Grey:** Stationary voxels

This enables the system to:
- Distinguish parked cars from moving cars without explicit object detection
- Predict where occupied regions will be in the near future
- Handle objects whose velocity is difficult to estimate from a single frame (e.g., objects moving laterally)

### How Occupancy Networks Replace LiDAR

| Capability | LiDAR | Tesla Occupancy Network |
|-----------|-------|------------------------|
| 3D structure | Direct measurement (sparse points) | Predicted (dense voxels) |
| Range | ~200 m (automotive grade) | Entire camera range (~250 m narrow, ~60 m wide) |
| Refresh rate | 10--20 Hz | >100 Hz |
| Novel object detection | Natural (any physical object reflects) | Learned from training data; generalizes via SDF |
| Texture/color | None | Full (from camera images) |
| Weather robustness | Moderate (degrades in rain/fog) | Moderate (degrades in visual occlusion) |
| Cost per unit | $500--$10,000+ | $0 (software on existing cameras) |

### Temporal Persistence and Occlusion Handling

The occupancy map is persistent across time -- the vehicle maintains a **3D voxel map** of its surroundings that updates incrementally:
- When a pedestrian walks behind a parked car, their last known position and velocity are retained in the occupancy map
- The system continues to predict the occluded pedestrian's likely position based on their trajectory
- When the pedestrian re-emerges, the prediction is validated and updated

---

## 8. Temporal Module

### The Video Problem

A single-frame perception system cannot handle:
- Occlusion (objects hidden behind other objects)
- Velocity estimation (requires multiple frames)
- Road geometry prediction beyond the current visible extent
- Scene understanding in ambiguous situations (is that a shadow or a pothole?)

Tesla addresses this with a sophisticated **temporal processing pipeline** that turns the perception system from a "snapshot camera" into a "video understanding system."

### Feature Queue

The feature queue is the temporal memory of the perception system, caching features from recent timesteps:

**What is cached per timestep:**
- Multi-camera fused features (output of the multi-camera transformer)
- Ego-vehicle kinematics (position, velocity, heading from IMU + odometry)
- Positional encodings (encoding the vehicle's world position at that timestep)

**Two types of queues with different push rules:**

| Queue Type | Push Rule | Purpose |
|-----------|-----------|---------|
| **Time-based queue** | Push every ~27 milliseconds (36 Hz) | Handle occlusion: if an object disappears behind an obstacle, the time-based queue remembers it was there moments ago |
| **Space-based queue** | Push every 1 meter of vehicle travel | Road geometry prediction: road markings and road edges from 50 m behind the vehicle are used to predict the geometry ahead |

The feature queue concatenates: multi-camera features + kinematics + positional encodings for each cached timestep.

### Spatial RNN (Recurrent Neural Network)

The video module consumes the feature queue through a **spatial RNN** -- one of Tesla's most innovative architectural choices:

**Architecture:**
- RNN cells are organized as a **2D lattice** representing the two-dimensional surface the vehicle drives on
- Each cell in the lattice has a hidden state that tracks various aspects of the road at that location:
  - Lane centers
  - Road edges
  - Lane lines
  - Road surface characteristics

**Update Rules:**
- Hidden state cells are updated **only when the car is nearby or has visibility** of that region
- Kinematics (from IMU) are used to integrate the vehicle's position into the hidden feature grid, so that features are properly registered in world coordinates as the car moves
- This selective update is highly efficient: only a small fraction of the 2D lattice is updated at each timestep

**Why Spatial RNN (not just temporal attention)?**

A standard temporal attention module processes features frame-by-frame. The spatial RNN instead maintains a persistent **map-like representation** anchored in world coordinates. As the vehicle drives, the RNN builds up a spatial memory of the environment -- similar to how a human driver remembers the road they passed moments ago.

### Kinematics Integration

The IMU provides real-time kinematics (position, velocity, acceleration, angular rates) that are critical for temporal alignment:

- Features from frame t-1 must be registered to the vehicle's current position at frame t
- Without kinematics, temporal aggregation would fail due to ego-motion
- The kinematics are fed both to the feature queue (for positional encoding) and to the spatial RNN (for hidden state position tracking)

However, accurate alignment ultimately relies on the trained transformer network, not just raw IMU data -- the network learns to compensate for IMU noise and drift.

### Temporal Processing in v13+

FSD v13 introduced a **10-second recursive video buffer**:
- The system maintains the last 10 seconds of video context
- At 36 fps, this represents ~360 frames of temporal memory
- The occupancy network was upgraded to use **video instead of single-timestep images**, enabling:
  - Robustness to temporary occlusions
  - Prediction of occupancy flow (object trajectories)
  - Better depth estimation through multi-frame triangulation
  - Scene understanding from motion parallax

---

## 9. Object Detection & 3D Bounding Boxes

### Detection in Image Space vs. Vector Space

Tesla's object detection operates in two stages:

**Stage 1 -- Image-Space Detection:**
- Each camera's features (after backbone + BiFPN) produce a detection raster
- The raster contains **1 bit per position indicating whether there is an object** at that location
- Additional attributes per detection: class, 2D bounding box, partial 3D information

**Stage 2 -- Vector-Space 3D Detection:**
- After multi-camera fusion and BEV projection, objects are detected in the unified 3D vector space
- Each detection includes:
  - 3D bounding box (position, dimensions, orientation in world coordinates)
  - Object class
  - Velocity vector (speed + heading)
  - Acceleration estimate
  - Existence probability

### 3D Bounding Box Estimation from Cameras

Estimating 3D bounding boxes from 2D camera images requires solving two problems: **what** the object is and **where** it is in 3D space.

**Depth estimation for bounding boxes:**
- Monocular depth cues: apparent size, texture gradient, ground-plane constraints, learned priors
- Multi-frame triangulation: tracking the same object across consecutive frames as the ego vehicle moves provides stereo-like depth
- Multi-camera overlap: where multiple cameras see the same object, geometric triangulation provides precise depth
- Temporal aggregation: velocity integration from optical flow constrains depth

**Training approach:**
- Validation vehicles equipped with auxiliary sensors (LiDAR, radar) capture ground-truth 3D measurements
- By tracking objects across frames, the system correlates visual features with precise 3D positions
- This generates a massive, highly accurate training dataset that the fleet-deployed vision-only network learns from

### Detected Object Classes

**Vehicles:**
- Sedan / passenger car
- Minivan / SUV
- Pickup truck
- Small truck / box truck
- Tractor-trailer / semi
- Bus
- Motorcycle
- Emergency vehicles (ambulance, fire truck -- added v14)
- Garbage truck (added v14)
- Street sweeper (added v14)
- Golf cart (added v14)

**Vulnerable Road Users (VRUs):**
- Pedestrians (with walking animation for moving)
- Cyclists / bicycles
- Baby carriages / strollers
- Skateboarders
- Animals (dogs and similarly-sized animals)

**Road Infrastructure:**
- Traffic cones
- Construction barrels
- Debris / unidentified obstacles (added FSD Beta 10.69.2)
- Garbage/recycling bins
- Poles

**Foveated Processing Optimization:**

To manage computational cost on fixed hardware, Tesla uses a **foveated rendering** approach for detection:
- A **high-resolution crop** of the horizon region is processed at full resolution for detecting distant, small objects
- A **downsampled version** of the rest of the image is processed for closer, larger objects
- The two processed views are fused, providing long-range precision without processing every pixel at maximum resolution

This is analogous to foveated rendering in VR, but applied in reverse -- the system focuses computational resources on the region where driving decisions depend on detecting distant objects.

---

## 10. Depth Estimation

### The Core Challenge

Without active ranging sensors (LiDAR, radar, sonar), Tesla must estimate depth from 2D camera images alone. This is one of the most technically challenging aspects of the vision-only approach.

### Methods Used

#### 1. Self-Supervised Monocular Depth

The primary depth estimation approach uses **self-supervised learning**:
- During training, the network learns to predict depth from single images by exploiting the geometric consistency of consecutive frames
- If the depth prediction is correct, warping a previous frame to the current viewpoint (using the predicted depth and known ego-motion) should reproduce the current frame
- The photometric loss between the warped and actual frame drives the depth learning
- No ground-truth depth labels are required for this training signal

**Advantages:**
- Scales to Tesla's massive fleet data (billions of frames)
- No per-frame depth labels needed
- Captures scene-level depth (road surface, buildings, vegetation) not just object depth

#### 2. Multi-Frame Triangulation

By tracking features or objects across multiple frames as the vehicle moves:
- The ego-motion between frames creates a **baseline** (similar to stereo vision)
- Known features visible in multiple frames can be triangulated to estimate their 3D position
- The longer the temporal baseline, the more accurate the depth estimate (up to a point)

This is particularly effective for:
- Stationary objects (buildings, parked cars, signs) where ego-motion provides the stereo baseline
- Slow-moving objects where the object's own motion is small relative to ego-motion

#### 3. Multi-Camera Stereo

Several camera pairs have overlapping fields of view:
- **Left and right B-pillar cameras** create a wide stereo baseline
- **Forward cameras** overlap with side cameras at close range
- **B-pillar and C-pillar cameras** (HW4) have lateral overlap

Where cameras share overlapping views, classical stereo matching principles provide direct depth measurements.

#### 4. Learned Depth Priors

The neural network learns strong priors about depth from training data:
- Apparent object size (a car at 100 m appears much smaller than at 10 m)
- Ground-plane geometry (road markings converge at the vanishing point)
- Texture gradients (road texture becomes finer with distance)
- Atmospheric perspective (distant objects appear hazier)
- Object class constraints (pedestrians are ~1.7 m tall; stop signs are ~0.75 m wide)

#### 5. Training with Ground-Truth Sensors

Tesla's validation engineering vehicles are equipped with high-precision auxiliary sensors (including LiDAR and radar, ironically) to capture ground-truth depth measurements. These ground-truth datasets are used to:
- Supervise the depth estimation network during training
- Validate the self-supervised depth predictions
- Generate pseudo-LiDAR labels for the auto-labeling pipeline

The production vehicles do not have these sensors -- they learn to infer depth from cameras alone using the knowledge distilled from the ground-truth-equipped training fleet.

### Depth Estimation Accuracy

Per Tesla's claims and independent analyses, the vision-based depth estimation achieves **precision close to that of auxiliary sensors** for objects within the typical driving envelope (~0--200 m). Accuracy degrades:
- At extreme range (>200 m) where monocular cues become ambiguous
- For featureless surfaces (blank walls, snow-covered ground)
- In low-texture environments

---

## 11. Lane Detection & Road Geometry

### Lane Detection Architecture

Lane detection in Tesla's perception stack operates in BEV/vector space, not in image space:

1. **Image Features:** RegNet + BiFPN extract per-camera features including lane line responses
2. **BEV Projection:** The transformer module projects lane features from image space into the top-down BEV representation
3. **Spatial RNN Memory:** The space-based feature queue (push every 1 m of travel) remembers lane markings from the recent past -- markings from 50+ meters behind the vehicle constrain the predicted lane geometry ahead
4. **Lane Head:** A task-specific head predicts lane geometry in BEV coordinates

### Lane Representation

Rather than per-pixel segmentation of lane markings, Tesla predicts lane geometry as **structured polylines and graphs** in vector space:

| Output | Description |
|--------|-------------|
| Lane centerlines | Polyline geometry for each lane center |
| Lane boundaries | Left and right edge polylines per lane |
| Lane types | Solid, dashed, double, yellow, white |
| Road edges | Curbs, barriers, guardrails, grass/dirt edges |
| Road surface | 3D height map of the drivable surface |
| Drivable space | Binary mask of physically traversable area |

### Lane Connectivity Network

A particularly innovative component is the **Lane Connectivity Network**, which uses **transformer-based autoregressive blocks** to understand road layouts:

- Similar to how a language model generates text token-by-token, the lane connectivity network predicts the road graph node-by-node
- It reasons about intersection topology: which lanes connect to which at an intersection
- It predicts the number of lanes, their connectivity, merge/split points, and turn lanes
- This enables the vehicle to plan routes through complex intersections without HD maps

### Road Geometry Prediction

Beyond lane markings, the perception stack predicts:
- **Ground surface height:** The 3D height of the road surface, enabling the vehicle to handle hills, dips, speed bumps, and uneven terrain
- **Road curvature:** Predicted ahead of the visible extent using spatial memory
- **Road semantics:** Travel space, parking areas, driveways, turn pockets

### No HD Maps Required

A critical design decision: Tesla's lane detection works **without pre-built HD maps**. This is in stark contrast to Waymo, Cruise, and other AV companies that rely on centimeter-accurate maps. Tesla's lane network predicts road geometry on-the-fly from visual cues, making it operational on any road worldwide.

---

## 12. Traffic Light & Sign Detection

### Traffic Light Detection

Traffic lights are handled by a dedicated **task head** in the HydraNet architecture:

**Detection Pipeline:**
1. Full-resolution features from the backbone (especially fine-grained Level 1 features at 160x120) are used to localize small, distant traffic lights
2. The detection head outputs:
   - Bounding box around each traffic light
   - **State classification:** Red, yellow, green, flashing, off
   - **Arrow detection:** Left, right, straight, U-turn
   - **Relevance determination:** Which traffic light applies to the ego vehicle's lane

**Relevance is the hardest sub-problem:** at a complex intersection, there may be 10+ traffic lights visible, but only 1--2 are relevant to the ego vehicle's current lane and intended direction. The network learns relevance from training data showing which light the human driver obeyed.

**LED Flicker Mitigation (HW4):**
- LED traffic lights flicker at frequencies that can cause them to appear off in individual camera frames
- The Sony IMX490 sensor includes built-in LED flicker mitigation
- This was a known issue with HW3 cameras (AR0136AT), partially mitigated in software

### Traffic Sign Detection

Traffic signs are detected and classified by a separate task head:

| Sign Type | Detection Capability |
|-----------|---------------------|
| Speed limit signs | Detected and value extracted; displayed to driver |
| Stop signs | Detected; vehicle behavior triggered |
| Yield signs | Detected; context-aware behavior |
| Road name signs | Detected; text on predetermined road words recognized |
| Construction signs | Detected; associated with construction zones |
| School zone signs | Detected; speed reduction triggered |
| No-turn signs | Detected; route planning constraint |

### End-to-End Handling (v12+)

In the end-to-end architecture (FSD v12+), traffic light and sign detection are not separate explicit modules. Instead:
- The unified model learns to respond to traffic lights and signs implicitly through imitation learning
- Engineers can still "prompt" the model to output auxiliary traffic light/sign predictions for debugging and safety verification
- The model's internal representations still encode traffic light state, but this is a learned feature rather than an explicit detection head

---

## 13. Semantic Segmentation

### Segmentation Outputs

Tesla's perception stack performs dense semantic segmentation in both image space and BEV space:

**Image-Space Segmentation (per camera):**
| Class | Description |
|-------|-------------|
| Road surface | Paved driving surface |
| Lane markings | Solid lines, dashed lines, stop bars, crosswalks, arrows, chevrons |
| Curbs | Raised edges delimiting the road |
| Sidewalks | Pedestrian walkways |
| Vegetation | Trees, bushes, grass |
| Buildings | Permanent structures |
| Sky | Above the horizon |
| Vehicles | Cars, trucks, buses, motorcycles |
| Pedestrians | Persons |
| Cyclists | Bicycles with riders |
| Traffic infrastructure | Poles, signs, lights |

**BEV-Space Segmentation:**
| Class | Description |
|-------|-------------|
| Drivable area | Where the vehicle can physically drive |
| Road body | The paved road surface (displayed white on gray in FSD visualization) |
| Road edges | Boundaries of the drivable area (displayed red in FSD visualization) |
| Lane boundaries | Separations between lanes |
| Crosswalks | Pedestrian crossing zones |
| Parking spaces | Detected parking spots |

### 3D Semantic Occupancy Grid

The occupancy network extends segmentation into 3D:
- Each occupied voxel receives a semantic label
- Classes include: vehicle, pedestrian, curb, road surface, building, vegetation, low obstacle, generic occupied
- Static vs. dynamic classification per voxel
- This 3D segmentation is the primary input for safe navigation -- the planner knows not just where objects are, but what category they belong to

### Road Marking Detection

Tesla's system detects and classifies an extensive set of road markings:
- Single and double yellow/white lines (continuous and dashed)
- Stop bars
- Crosswalks
- Road arrows (turn, straight, merge)
- Road chevrons
- Bicycle lane markings
- Railroad crossings
- Handicap parking symbols
- Text on roads (from a predetermined vocabulary)

---

## 14. Object Tracking

### Multi-Camera Multi-Object Tracking

Object tracking in a camera-only system is challenging because:
- Objects move between cameras as they (or the ego vehicle) move
- There is no direct range measurement to disambiguate similar-looking objects
- Occlusions can cause objects to temporarily disappear

### Tracking Architecture

Tesla's tracking operates in the 3D vector space (BEV coordinates), not in individual camera images:

1. **Detection in 3D:** Objects are detected in the unified BEV/occupancy representation, providing 3D position estimates
2. **Data Association:** Across timesteps, detections are associated with existing tracks using:
   - Predicted position (from previous velocity + kinematics model)
   - Appearance features (learned embedding similarity)
   - Size and class consistency
3. **Track Maintenance:** Each tracked object maintains:
   - Position history (trajectory)
   - Velocity and acceleration estimates
   - Class label (with confidence)
   - Existence probability
4. **Occlusion Handling:** When an object is occluded:
   - The temporal persistence of the occupancy map retains its last known position and velocity
   - The track continues to predict the object's position based on its last known trajectory
   - When the object re-appears, it is re-associated with the persisted track

### Multi-Camera Association

When an object transitions from one camera's FOV to another:
- The 3D vector space representation provides a common coordinate frame
- An object detected by the left B-pillar camera at position (x, y, z) in world coordinates is the same object detected by the rear camera at the same (x, y, z)
- No explicit "handoff" between cameras is needed -- the fusion happens in the BEV transformer

### Tracking in End-to-End (v12+)

In the end-to-end architecture, tracking is implicit:
- The temporal module (10-second video buffer) provides the network with object persistence information
- The network learns to maintain internal representations of tracked objects through its recurrent/temporal structure
- Explicit track IDs may no longer be maintained; instead, the model reasons about "the world state" holistically

---

## 15. End-to-End Architecture (v12+)

### The Paradigm Shift

FSD v12 (November 2023) marked the most radical architectural change in Tesla's Autopilot history: replacing the **modular perception + planning pipeline** with a **single end-to-end neural network**.

**Before (Modular, v11 and earlier):**
```
Cameras -> Perception (HydraNet) -> Intermediate Representations
  -> Planning (MCTS + Rules) -> Control Commands
```
- ~300,000 lines of C++ code for planning and control
- Explicit rules for every driving scenario (e.g., "stop 3 seconds at stop signs")
- Human engineers manually encoded driving behavior
- Planning was a hybrid symbolic-learning system

**After (End-to-End, v12+):**
```
Cameras (8 cams x N frames) -> Single Neural Network -> Control Commands
  (steering angle, acceleration, braking)
```
- ~2,000--3,000 lines of "glue code" for network activation, safety monitors, and vehicle interface
- Driving behavior learned from **10+ million human driving video clips**
- No explicit rules; behavior emerges from data
- Fully differentiable end-to-end

### How It Works

**Input:**
- Raw pixel data from 8 cameras (12-bit RCCC sensor data)
- Temporal context from the last 10 seconds of video (~360 frames)
- Navigation data (desired route/destination)
- Vehicle kinematics (speed, steering angle, IMU data)
- Audio input (v14+, for emergency vehicle siren detection)

**Single Neural Network:**
- Processes all inputs through a unified architecture
- Internal representations include BEV features, occupancy predictions, lane understanding, and object awareness -- but these are **learned latent representations**, not explicitly engineered modules
- Gradients flow all the way from the control output back to the sensor inputs, optimizing the entire pipeline holistically

**Output:**
- Steering angle
- Acceleration/throttle command
- Braking command
- Turn signal activation
- (Future: horn, hazard lights)

### Training Approach

**Behavioral Cloning (Imitation Learning):**
- The network is trained to replicate expert human driving behavior
- Training data: millions of hours of human driving from Tesla's fleet, graded by driver quality
- The network learns the mapping: (visual input, route) -> control output
- High-quality drivers' data is weighted more heavily

**Reinforcement Learning:**
- Applied on top of the imitation-learned base policy
- Reward function evaluates:
  - Positive: safe navigation, smooth lane changes, comfortable ride
  - Negative: traffic violations, unsafe proximity, uncomfortable maneuvers, hesitant behavior
- Particularly important for safety-critical edge cases underrepresented in the imitation data

### Interpretability Despite End-to-End

Despite being a "black box" end-to-end model, the system maintains interpretability:
- Engineers can "prompt" the model to output **auxiliary predictions**: 3D occupancy, road boundaries, objects, signs, traffic lights, etc.
- These auxiliary outputs are for debugging and safety verification only -- they do not directly control vehicle behavior
- **Natural language querying** (v14+): engineers can ask the model why it made a certain decision
- The model outputs language descriptions of its reasoning (potentially via an integrated VLA -- Vision Language Action -- model, though Tesla has not confirmed this)

### Version Progression

| Version | Key Architecture Changes |
|---------|------------------------|
| **v12.0** (Nov 2023) | First end-to-end; replaces C++ planner with neural network for city driving |
| **v12.4** (Jun 2024) | Camera-based driver monitoring; improved E2E model |
| **v12.5** (Aug 2024) | E2E extended to highway driving (previously highway used modular stack); larger model |
| **v13.0** (Nov 2024) | Temporal-voxel transformer; 10-second recursive video buffer; HW4 only; 3x parameters vs v12; 8x voxel resolution; native HW4 camera resolution |
| **v13.3** (2025) | Single large Vision Transformer for entire pipeline |
| **v14.0** (Oct 2025) | ~10x parameter count vs v12; auto-regressive transformers; audio input; extended context |
| **v14.2** (Nov 2025) | 95% reduction in hesitant behaviors; refinements |

---

## 16. Neural Network Planner Integration

### Phase 2: Modular Planning (2021--2023)

In the modular architecture, perception outputs fed into a separate planning system:

**Perception Outputs -> Planning Inputs:**

| Perception Output | How Planning Used It |
|------------------|---------------------|
| 3D Vector Space (objects, lanes, signs) | Scene graph for rule-based and learned decisions |
| Occupancy Volume (free/occupied voxels) | Collision checking for candidate trajectories |
| Occupancy Flow (voxel velocities) | Prediction of future obstacle positions |
| Lane Graph (centerlines, boundaries, topology) | Route-following and lane change opportunities |
| Traffic Light State (color, relevance) | Stop/go decisions |
| Drivable Space (BEV mask) | Feasibility constraints for trajectory generation |

**Monte-Carlo Tree Search (MCTS) + Neural Network Planner:**

1. Generate multiple candidate trajectories from the current vehicle state
2. For each trajectory, the neural network scores it using a **cost function**:
   - Collision probability (from occupancy predictions)
   - Comfort (jerk, lateral acceleration)
   - Human-likeness (similarity to human driving behavior)
   - Intervention likelihood
   - Travel time / efficiency
3. MCTS explores the trajectory tree to select the optimal path
4. Selected trajectory is converted to steering, throttle, and brake commands

**Limitations of this approach:**
- Manual rules were required for edge cases (e.g., nudging around double-parked cars)
- ~300,000 lines of C++ encoded these rules
- Adding new driving behaviors required engineering effort, not just data
- Perception errors could not be compensated by planning (no gradient flow)

### Phase 3: End-to-End Planning (v12+)

In the end-to-end architecture, the separation between perception and planning dissolves:

- **No explicit intermediate representations** are passed between modules
- The neural network's internal activations contain perception-like features (BEV, occupancy, object representations), but these are latent -- they emerge from training, not engineering
- **Gradients flow end-to-end:** errors in planning (e.g., hesitating at an intersection) propagate back through the entire network, improving perception representations that are relevant for that driving scenario
- **Joint optimization:** perception learns to extract exactly the features that planning needs, rather than extracting "general" features that may not capture driving-relevant nuances

### Intermediate Representations in End-to-End

Even in the end-to-end model, internal representations are structured:
- The model still forms a **BEV-like spatial representation** internally
- Occupancy-like activations exist in the middle layers
- Object-like features emerge in intermediate representations
- But these are not constrained to match predefined formats -- the model discovers the most useful representation for driving

This can be verified by probing intermediate layers: when engineers add auxiliary loss functions (e.g., "also predict occupancy from layer N"), the model produces accurate occupancy maps -- confirming that the internal representation encodes rich 3D scene understanding.

---

## 17. Auto-Labeling Pipeline

### Overview

Tesla's auto-labeling pipeline is one of the most technically sophisticated and strategically important components of the perception system. It transforms raw fleet driving data into the labeled training datasets that the neural network learns from -- with minimal human intervention.

### Pipeline Stages

```
Fleet Vehicles (raw data) -> Cloud Upload -> Offline Processing ->
  4D Reconstruction -> Auto-Label Generation -> Human QA ->
  Training Dataset
```

#### Stage 1: Raw Data Ingestion

Fleet vehicles upload:
- 45-second to 1-minute video clips from all 8 cameras
- IMU data (accelerometer + gyroscope)
- GPS coordinates
- Wheel odometry
- Vehicle CAN bus data (speed, steering angle, brake pressure)

#### Stage 2: Offline Neural Network Processing

The key insight: offline processing has access to **both past AND future frames**, unlike real-time processing. Tesla runs a **much heavier, more accurate neural network** than could ever run in real-time on the vehicle:
- This offline model has unlimited compute budget
- It can process frames bidirectionally (forward and backward in time)
- It produces "near-perfect" labels as a first pass

As Karpathy described at CVPR 2021: "Using a much heavier model than you could ever use in production to do a first stab at data labeling offline, to then be cleaned up by a human, is very powerful."

#### Stage 3: 4D Vector Space Reconstruction

This is Tesla's most innovative labeling technique:

1. **Multi-camera fusion into 3D:** All 8 cameras' video streams are fused into 3D point clouds using structure-from-motion and learned depth
2. **Multi-frame temporal alignment:** Multiple frames are aligned using ego-motion and SLAM to build temporally consistent 3D reconstructions
3. **4D Vector Space (3D + time):** The reconstruction exists in 4D -- 3D geometry evolving over time
4. **Single label, many views:** A single label placed in the 4D vector space automatically projects into all 8 camera views across all frames -- making each labeling effort **100x more efficient** than per-image labeling

#### Stage 4: Multi-Trip Aggregation

Multiple Tesla vehicles driving through the same location at different times contribute to a shared reconstruction:

- Observations from multiple vehicles are aligned using road features (lane lines, road edges, landmarks)
- Static elements (buildings, signs, road geometry) are reinforced with each additional pass
- Moving objects are identified by their temporal inconsistency across trips -- they appear in some passes but not others
- The aggregated reconstruction becomes progressively more accurate with more data
- **Fleet averaging** solves individual-trip problems: blurred images, rain, fog, partial occlusion are averaged out across many observations

#### Stage 5: Moving Object Trajectory Extraction

For dynamic objects:
- Temporal inconsistencies reveal which objects are moving
- Full kinematic trajectories (position, velocity, acceleration over time) are extracted
- Even objects that were only partially visible or temporarily occluded can be fully reconstructed from multi-frame data
- These trajectories become training labels for the object detection and tracking heads

#### Stage 6: Human Quality Assurance

Auto-generated labels are spot-checked by Tesla's labeling team:
- High-confidence auto-labels are accepted without human review
- Edge cases, novel situations, and low-confidence predictions are flagged for human review
- The human labelers work in the 4D vector space representation, making corrections highly efficient

### Generative Gaussian Splatting for Ground Truth

Tesla has developed a **custom ultra-fast Gaussian Splatting system** for 3D scene reconstruction:

| Feature | Specification |
|---------|--------------|
| Speed | ~220 milliseconds per scene |
| Initialization | Not required (unlike standard 3DGS) |
| Dynamic objects | Can model moving objects |
| Joint training | Can be jointly trained with the end-to-end AI model |
| Camera views | Generates all 8 camera views simultaneously |
| Quality | Superior visual fidelity to standard Gaussian Splatting approaches |

Traditional 3D Gaussian Splatting struggles with driving scenes because vehicle motion is approximately linear (small stereo baseline between frames). Tesla's custom approach overcomes this limitation, producing high-quality 3D reconstructions from limited viewpoint variation.

Uses:
- Generating photo-realistic ground truth labels for training
- Creating synthetic training data with controlled variations
- Debugging by allowing engineers to virtually "fly through" reconstructed driving scenes
- Validating perception outputs against known 3D geometry

### NeRF (Neural Radiance Fields) for Validation

Tesla uses NeRFs as an offline validation tool:
- Predicted occupancy volumes are compared against NeRF-reconstructed 3D scenes
- Discrepancies indicate perception errors that need targeted data collection and retraining

---

## 18. Data Engine

### The Closed-Loop System

Tesla's Data Engine is the flywheel that continuously improves the perception stack:

```
Deploy Model -> Fleet Driving -> Shadow Mode + Triggers ->
  Identify Weaknesses -> Collect Targeted Data -> Auto-Label ->
  Retrain Model -> Validate -> Deploy Updated Model
```

### Shadow Mode

**What it is:** The FSD neural network runs silently in the background on **all Tesla vehicles** (not just FSD subscribers), comparing the system's predicted driving action against the human driver's actual action.

**How it works:**
1. FSD receives the same camera inputs as the human driver
2. FSD computes what it would do (steering, acceleration, braking)
3. If FSD's prediction diverges significantly from the human's action, a **disagreement event** is flagged
4. The flagged clip (video + telemetry) is uploaded to Tesla's servers

**Scale:** With 9+ million vehicles running Shadow Mode, Tesla effectively has the world's largest passive data-gathering network for autonomous driving.

### Trigger-Based Data Collection

Tesla uses **221+ manually-implemented triggers** (as of CVPR 2021) to identify scenarios worth collecting:

| Trigger Category | Examples | Priority |
|-----------------|---------|----------|
| **Hard clips** | AEB activation, sudden steering correction, collision | Highest -- novel and safety-critical |
| **Soft clips** | Model prediction diverges from human action | High -- systematic weaknesses |
| **Shadow disagreements** | Background FSD would have driven differently | Medium -- general improvement |
| **Novelty detection** | Object detector encounters unprecedented input | High -- data distribution gaps |
| **Uncertainty estimation** | Model outputs low-confidence prediction | Medium -- model improvement |
| **Scenario-based** | Unprotected left turns, construction zones, school zones | Configurable -- targeted collection |
| **Deep-learning queries** | Specific objects (bears, construction equipment) or situations (driving into sun, tunnel entry/exit) | Configurable -- specific gap filling |
| **Sensor contention** | Detection inconsistency between cameras | High -- system validation |

### Clip Mining

Active learning identifies the most informative training examples from the massive pool of uploaded clips:
- Searches for scenarios **similar to known failure modes**
- Prioritizes rare, safety-critical situations underrepresented in training data
- Examples: unusual intersection geometry, rare weather conditions, novel obstacle types
- Can search across the entire fleet's historical data for matching situations

### Data Scale

| Metric | Value |
|--------|-------|
| Fleet size | 9+ million vehicles |
| FSD subscribers | 1.1 million (Q4 2025) |
| Data collection vehicles | All Tesla vehicles (via Shadow Mode) |
| Video clips processed | 400,000 per second (fleet-wide) |
| Driving data equivalent generated daily | ~500 years |
| Training data per cycle | 1.5+ petabytes |
| Training video clips | 10+ million curated clips |

---

## 19. Model Compilation & Inference

### FSD Chip NPU Architecture (HW3)

The Neural Processing Unit is the largest and most important component on the FSD chip:

| Parameter | Specification |
|-----------|--------------|
| NPU count per chip | 2 |
| Chips per vehicle | 2 (dual redundant) |
| Total NPUs per vehicle | 4 |
| MAC array size | 96 x 96 = 9,216 MACs per NPU |
| MAC array type | Independent single-cycle feedback loops (NOT a systolic array; no inter-cell data shifting) |
| Data precision | 8-bit integer multiply with 32-bit integer accumulate |
| Clock speed | 2 GHz (production frequency) |
| Peak performance per NPU | 36.86 TOPS (INT8) |
| Total performance per chip | 73.7 TOPS |
| Total performance per vehicle | ~144 TOPS (dual chip) |
| Local SRAM cache | 32 MiB per NPU, highly banked |
| Cache read bandwidth | 384 bytes/cycle (256B data + 128B weights) |
| Cache peak bandwidth | 786 GB/s per NPU |
| Write-back throughput | 128 bytes/cycle to SRAM |
| NPU power | 7.5 W per NPU (~21% of chip power budget) |
| Power efficiency | ~4.9 TOPS/W |
| ISA | 8 instructions total (2 DMA, 3 dot-product variants, scale, element-wise add) |
| Instruction width | 32 to 256 bytes |

**Processing Pipeline:**
```
Data loaded from DRAM -> SRAM cache -> MAC array -> SIMD unit
  (sigmoid, tanh, argmax) -> Pooling unit (2x2, 3x3) ->
  Write-combine buffer -> SRAM (NO DRAM interaction after initial load)
```

The key design principle: once data is loaded into the 32 MiB SRAM, all compute happens in SRAM -- no DRAM interaction until the final output. This eliminates the memory bandwidth bottleneck that limits many neural network accelerators.

### Model Compilation

Tesla uses a custom **neural network compiler** (not TensorRT):

**Two-Stage Compilation:**

1. **Coarse Pass:** Topology mapping -- partitions the neural network into tile-based workloads, mapping each tile's weight matrices to specific SRAM banks
2. **Fine Pass:** Weight pruning and quantization, producing a highly optimized binary for the target chip revision

**Compiler Capabilities:**
- **Layer fusion:** Combines conv-scale-activation-pooling operations to maximize data reuse
- **SRAM bank allocation:** The compiler maps individual SRAM banks, controlling memory layout at the hardware level
- **Quantization-aware compilation:** Models are pre-quantized to INT8 during compilation
- **Hardware-specific optimization:** Different binaries for HW3, HW4, and future AI5

### Quantization Strategy

| Aspect | Detail |
|--------|--------|
| Training precision | FP32 / BF16 (in data center on GPUs) |
| Deployment precision | INT8 (on-vehicle NPU) |
| Quantization method | Quantization-aware training (QAT) |
| Weight storage | 8-bit integers |
| Activation storage | 8-bit integers |
| Accumulation | 32-bit integers |

**Quantization-Aware Training (QAT):**
- During training in the data center, the network is trained with simulated INT8 quantization
- The model learns to be robust to the precision loss of INT8 representation
- This produces higher-quality INT8 models than post-training quantization

### Multi-Hardware Deployment

Tesla's patent "System and method for adapting a neural network model on a hardware platform" describes how a single high-precision model is adapted for different hardware tiers:

| Hardware | Model Adaptation |
|----------|-----------------|
| HW3 | Aggressive pruning + INT8 quantization; lighter model variants; constrained to ~144 TOPS budget |
| HW4 | Full model with INT8 quantization; 3--5x more FLOPS budget; native 5.4 MP resolution |
| AI5 (future) | Full model with potentially mixed precision; 10x HW4 FLOPS; up to 800 W power envelope |

### Inference Latency

| Version | Hardware | Approximate Latency |
|---------|----------|-------------------|
| FSD v12 | HW3 | Runs within frame budget at 36 fps (~28 ms per frame) |
| FSD v13 | HW3 | Does NOT fit; HW3 stays on v12.6 |
| FSD v13 | HW4 | Runs within frame budget (3x parameters vs v12) |
| FSD v14 | HW4 | Runs within budget (10x parameters vs v12; likely uses efficient architectures like MoE) |

### On-Vehicle Deployment

1. **Containerization:** Trained and compiled model is packaged into a lightweight inference package
2. **Canary Release:** Internal test vehicles receive the update first; telemetry monitored for anomalies
3. **Staged Rollout:** ~10% of fleet per day, monitoring for regressions
4. **OTA Delivery:** Models distributed via over-the-air software updates

---

## 20. Key Architectural Evolution (HW2 to AI5)

### HW1: Mobileye Era (2014--2016)

| Aspect | Detail |
|--------|--------|
| Chip | Mobileye EyeQ3 (40 nm) |
| Cameras | 1 forward-facing |
| Perception | Mobileye's proprietary mono-camera perception |
| Capabilities | Lane keeping, basic forward collision warning |
| Tesla control | Minimal -- Mobileye provided a black-box solution |
| Limitation | Tesla had no ability to modify or improve the perception stack |

### HW2 / HW2.5: NVIDIA Era (2016--2019)

| Aspect | Detail |
|--------|--------|
| Chip | NVIDIA Drive PX2 (Parker SoC, 16 nm) |
| Performance | ~24 TOPS |
| Cameras | 8 external cameras (first full surround vision) |
| Radar | 1 forward-facing radar |
| Ultrasonics | 12 ultrasonic sensors |
| Perception | Tesla's first in-house neural networks; per-camera CNNs |
| Architecture | Early convolutional networks; no multi-camera fusion; per-camera processing |
| Frame rate | ~110 FPS processing capacity |
| Limitation | Insufficient compute for real-time multi-camera fusion or BEV transformers |

### HW3: Tesla's Own Silicon (2019--2023)

| Aspect | Detail |
|--------|--------|
| Chip | Tesla FSD Chip (14 nm Samsung, dual chip) |
| Performance | 144 TOPS (dual chip) |
| Cameras | 8 x 1.2 MP (AR0136AT) at 36 fps |
| Perception | HydraNet (shared backbone + multi-task heads); BEV transformer; occupancy networks |
| Architecture | RegNet backbone, BiFPN, transformer-based BEV projection, spatial RNN |
| Radar | Removed May 2021 |
| Ultrasonics | Removed Oct 2022 |
| Peak version | FSD v12.6 (end-to-end, but constrained by compute budget) |
| Limitation | Cannot run v13+ models (3x+ parameters); stuck on v12.6 branch |

**Key Architectural Innovations on HW3:**
- First deployment of BEV transformers in production vehicles (2021)
- First deployment of occupancy networks in production vehicles (2022)
- First end-to-end neural network for autonomous driving (v12, 2023)
- Spatial RNN for persistent environmental memory
- Multi-camera transformer fusion

### HW4 (AI4): Next-Generation Silicon (2023--present)

| Aspect | Detail |
|--------|--------|
| Chip | Tesla FSD Chip 2 (7 nm Samsung, dual chip) |
| Performance | 3--8x HW3 (~360--1,150 TOPS estimated) |
| Memory | 16 GB GDDR6 (2x HW3); 224 GB/s bandwidth (3.3x HW3) |
| Storage | 256 GB NVMe (4x HW3) |
| Cameras | 7--8 x 5.4 MP (Sony IMX490/IMX963) |
| Camera inputs | Up to 13 supported |
| Perception | Full v13/v14 E2E model; native 5.4 MP resolution; 3--10x parameter models |

**Key Perception Changes Enabled by HW4:**
- **Native 5.4 MP processing:** HW3 was limited to 1.2 MP; HW4 runs FSD at full sensor resolution (FSD v13.2.1 was the first version to use native resolution for all cameras)
- **Temporal-Voxel Transformer:** v13's 10-second video buffer requires substantially more compute and memory than HW3 can provide
- **8x voxel resolution increase:** Only possible with HW4's increased TOPS and memory bandwidth
- **Larger model capacity:** v14's 10x parameter model requires HW4's 3--5x FLOPS increase

**Initial HW4 Software Challenge:**
HW4 initially ran FSD by **emulating HW3** -- downsizing the 5.4 MP camera images to 1.2 MP and running the HW3 model. It took approximately 6 months before HW4-specific neural networks were trained and deployed. This highlights the challenge of training new models for a new sensor configuration while maintaining fleet compatibility.

### AI5: The Next Leap (Planned 2027)

| Aspect | Detail |
|--------|--------|
| Process | 5 nm (TSMC, Arizona) |
| Performance | ~10x HW4 (estimated 2,000+ TOPS) |
| Power | Up to 800 W when processing complex environments (vs. 100 W HW3, 160 W HW4) |
| Capability | Inference + training capable on-vehicle |
| Status | Production pushed to early 2027; design complete |
| Significance | Planned as the "last hardware iteration installed in vehicles" |

**AI5 Perception Implications:**
- Potentially enables on-device fine-tuning (not just inference)
- May support full-precision inference (FP16 or BF16) rather than INT8 quantization
- Could run perception models 10x+ larger than current v14
- Camera input support for even higher resolution sensors or additional cameras

### Software-Hardware Divergence (Late 2024+)

Starting November 2024, Tesla began shipping **different FSD versions for different hardware**:
- HW3 vehicles: capped at FSD v12.6.x (no upgrade path to v13 or v14)
- HW4 vehicles: receive FSD v13.x and v14.x
- This represents a permanent architectural fork -- HW3 cannot run the models that HW4 enables

---

## 21. Model Sizes & Performance Numbers

### Known Parameter Counts

| Version | Approximate Parameters | Source |
|---------|----------------------|--------|
| Pre-v12 HydraNet (48 networks) | ~10 million total (across all heads) | Industry estimates |
| FSD v12 E2E model | ~10 million (initial E2E baseline) | Industry reporting |
| FSD v13 | ~30 million (3x v12) | Tesla release notes |
| FSD v14 (initial) | ~45 million (4.5x v12) | Ashok Elluswamy |
| FSD v14 (full) | ~100 million (10x v12) | Musk / Elluswamy |
| Future AI5 models | ~1 billion+ (speculative) | Extrapolation from trends |

**Note:** These numbers are remarkably small by LLM standards (GPT-4 has ~1.7 trillion parameters). This reflects the efficiency of vision models and the extreme latency constraints of real-time autonomous driving.

### Hardware Compute Budgets

| Hardware | TOPS (INT8) | Memory | Memory BW | Power |
|----------|------------|--------|-----------|-------|
| HW3 (dual chip) | 144 | 8 GB LPDDR4 | 68 GB/s | ~72 W |
| HW4 (dual chip) | ~360--1,150 (est.) | 16 GB GDDR6 | 224 GB/s | ~160 W |
| AI5 (planned) | ~2,000+ (est.) | TBD | TBD | up to 800 W |

### Inference Characteristics

| Metric | Value |
|--------|-------|
| Camera frame rate | 36 fps |
| Per-frame latency budget | ~28 ms (at 36 fps) |
| Occupancy network speed | >100 fps (3x+ faster than cameras) |
| ISP throughput | 1 billion pixels/sec |
| Camera input bandwidth | Up to 2.5 billion pixels/sec |
| Total pixels processed per second (HW3) | ~353 million (8 cams x 1.2 MP x 36 fps) |
| Total pixels processed per second (HW4) | ~1.56 billion (8 cams x 5.4 MP x 36 fps) |

### Convolutional Operations Dominance

On the HW3 NPU, convolutional operations account for **98.1% of all operations** -- reflecting the heavy use of conv-based architectures (RegNet backbone, BiFPN, deconvolution layers). The remaining 1.9% covers attention mechanisms, normalization, and non-linear activations.

---

## 22. Patents

### Key Perception-Related Tesla Patents

| Patent / Application | Title | Key Technical Focus |
|---------------------|-------|---------------------|
| **US20240185445A1** | Artificial Intelligence Modeling Techniques for Vision-Based Occupancy Determination | Core occupancy network patent; describes camera-to-voxel pipeline, 33 cm default voxel size with 10 cm refinement, SDF-based shape prediction, temporal fusion, four categories of occupancy output |
| **WO2025193615** | AI Modeling Techniques for Vision-Based High-Fidelity Occupancy Determination and Assisted Parking | Extended occupancy patent for parking applications; sub-voxel accuracy; camera-only operation |
| **WO2024073033A1** | Automated Data Labeling System | Auto-labeling pipeline using fleet data; 3D environment reconstruction; automated label generation from multi-trip aggregation |
| **WO2019245618** | Data Pipeline and Deep Learning System for Autonomous Driving | Multi-layered image processing; preserves sensor data fidelity; avoids compression/downsampling that reduces signal quality |
| **US20230057509A1** | Vision-Based Machine Learning Model for Autonomous Driving with Adjustable Virtual Camera | Calibration and virtual camera system; adjustable viewpoint for training data augmentation |
| **System and Method for Obtaining Training Data** (Karpathy, sole inventor) | Fleet-sourced training data | Trigger classifiers on intermediate neural network results determine which sensor data to transmit from vehicles to cloud |
| **System and Method for Adapting a Neural Network Model on a Hardware Platform** | Multi-hardware model deployment | Quantization-aware training; compiler toolchains for CPU/GPU/NPU optimization; single model adapted for HW3/HW4/AI5 |
| **Systems and Methods for Training Machine Models with Augmented Data** | Training data augmentation | Augmented camera images for generalization; improved robustness for object detection |
| **Estimating Object Properties Using Image Data** | Object property estimation | Depth, size, velocity estimation from camera images |

### Patent Coverage Areas

Tesla's perception patent portfolio covers:

1. **3D Occupancy Prediction:** Camera-to-voxel transformation, SDF-based rendering, adaptive resolution
2. **Auto-Labeling:** Fleet-sourced data, trigger-based collection, 4D reconstruction, automated labeling
3. **Neural Network Optimization:** Hardware-adaptive deployment, quantization, pruning, compiler optimization
4. **Image Processing:** Raw data pipeline, ISP optimization, multi-resolution processing
5. **Depth Estimation:** Vision-based distance detection, monocular and stereo approaches
6. **Data Augmentation:** Synthetic data generation, augmented training images
7. **FSD Visualization:** 3D rendering of perception outputs for driver display
8. **Calibration:** Virtual camera systems, online extrinsic calibration

---

## 23. Published Talks & Presentations

### Major Presentations

#### Autonomy Day (April 2019)

| Detail | Content |
|--------|---------|
| Presenters | Elon Musk, Pete Bannon, Stuart Bowers |
| Key reveals | HW3 FSD Chip architecture; 144 TOPS; custom silicon strategy; dual-chip redundancy; ISP with 1B pixel/sec throughput |
| Perception content | Overview of camera-based perception; plans for end-to-end learning |

#### AI Day 2021 (August 2021)

| Detail | Content |
|--------|---------|
| Presenters | Andrej Karpathy (vision), others (Dojo, planning, bot) |
| Key perception reveals | HydraNet multi-task architecture; RegNet backbone with multi-scale features (160x120 to 20x15); BiFPN for feature fusion; transformer-based multi-camera fusion; BEV projection with positional encodings (sine/cosine via MLP); feature queue (time-based at 27 ms, space-based at 1 m); spatial RNN with 2D lattice hidden state; calibration neural network for fleet-wide virtual camera normalization; 48 networks producing 1,000 output tensors |
| Technical depth | Most detailed public disclosure of Tesla's perception architecture to date |

#### Andrej Karpathy -- CVPR 2021 Workshop on Autonomous Vehicles (June 2021)

| Detail | Content |
|--------|---------|
| Title | "Tesla's Vision-Only Approach to Autonomous Driving" |
| Key technical details | Vision-only superiority over sensor fusion (higher precision and recall); 221 manually-implemented triggers for fleet data collection; auto-labeling with heavyweight offline networks; 4D vector space labeling (100x efficiency); compute cluster: 80 nodes x 8 A100 GPUs = 5,760 GPUs, 10 PB NVMe, 640 Tbps networking; team of ~20 engineers training one neural network full-time |
| Scalability argument | HD LiDAR maps are unscalable; vision generalizes to any road |

#### Andrej Karpathy -- CVPR 2022 Workshop (June 2022)

| Detail | Content |
|--------|---------|
| Key technical details | Scaling training data; advanced auto-labeling techniques; multi-trip aggregation for 4D reconstruction; fleet averaging for robust 3D scene reconstruction |

#### AI Day 2022 (September 2022)

| Detail | Content |
|--------|---------|
| Presenters | Tesla AI team |
| Key perception reveals | Occupancy Networks (3D voxel predictions); occupancy flow; SDF-based geometry; >100 FPS performance; planning architecture (MCTS + neural network planner); cost function details |
| Significance | First public description of occupancy networks; sparked academic research wave |

#### Ashok Elluswamy -- CVPR 2023 (Keynote)

| Detail | Content |
|--------|---------|
| Title | "Building Foundational Models for Robotics at Tesla" (CVPR workshop) |
| Key content | First external presentation after Karpathy's departure; occupancy network architecture details; vision-based perception for both vehicles and robots |

#### Ashok Elluswamy -- ICCV 2024 (October 2024)

| Detail | Content |
|--------|---------|
| Title | "Building Foundational Models for Robotics at Tesla" |
| Key technical details | End-to-end FSD architecture confirmed; "billions of input tokens" from cameras, navigation maps, kinematic data; "Niagara Falls of data" from fleet (500 years of driving daily); neural world simulator generating 8 camera feeds simultaneously; Gaussian Splatting for 3D debugging; same architecture transfers to Optimus robot; auxiliary output probing for interpretability (3D occupancy, road boundaries, objects, signs, traffic lights); natural language querying for decision explanation |
| Multi-modal inputs | Camera video + navigation data + vehicle motion state + (later) audio |
| Output diversity | Panoramic segmentation, 3D occupancy, 3D Gaussian rendering, language output, action inference |
| Significance | First time Tesla publicly confirmed the full end-to-end architecture externally; most detailed post-Karpathy technical disclosure |

#### Ashok Elluswamy -- 2025 Presentations

| Detail | Content |
|--------|---------|
| Topics covered | Neural world simulator details; unified FSD + Optimus architecture; Generative Gaussian Splatting (~220 ms, no initialization needed, models dynamic objects); FSD v14 auto-regressive transformers; audio input integration; model scaling roadmap |

### Key Technical Blog Posts and Analyses

| Source | Title/Topic | Key Contribution |
|--------|-------------|------------------|
| ThinkAutonomous | "Tesla's HydraNet - How Tesla's Autopilot Works" | Detailed multi-stage pipeline breakdown; temporal processing; task head architecture |
| ThinkAutonomous | "A Look at Tesla's Occupancy Networks" | Architecture details; SDF explanation; NeRF validation; fleet averaging |
| ThinkAutonomous | "Tesla's Transition from Modular to E2E Deep Learning" | MCTS planning details; perception-planning integration; joint training |
| WikiChip Fuse | "Inside Tesla's Neural Processor in the FSD Chip" | NPU MAC array (96x96); ISA (8 instructions); SRAM architecture; power analysis |
| Kimbo Chen | "Tesla AI Day - Vision" | Feature queue specifics (27 ms time, 1 m space push rules); BEV positional encoding details; spatial RNN lattice architecture |

---

## Appendix: Architecture Diagram (Text)

### Phase 2 Architecture (2021--2023, Modular)

```
                    +-----------+
                    | 8 Cameras |
                    | (36 fps)  |
                    +-----+-----+
                          |
                    +-----v-----+
                    | Calibration|
                    | Neural Net |
                    | (rectify)  |
                    +-----+-----+
                          |
              +-----------v-----------+
              | RegNet Backbone       |
              | (per-camera, multi-   |
              |  scale: 160x120 ->    |
              |  20x15, ~64-512 ch)   |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | BiFPN                 |
              | (weighted bi-         |
              |  directional FPN)     |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Multi-Camera          |
              | Transformer Fusion    |
              | (cross-attention,     |
              |  positional enc.)     |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Feature Queue         |
              | (time: 27ms,          |
              |  space: 1m push)      |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Spatial RNN           |
              | (2D lattice,          |
              |  kinematics-aligned)  |
              +-----------+-----------+
                          |
       +------------------+------------------+
       |                  |                  |
  +----v----+      +------v------+    +------v------+
  | Object  |      | Occupancy   |    | Lane/Road   |
  | Detect. |      | Network     |    | Geometry    |
  | Head    |      | Head        |    | Head        |
  +---------+      +-------------+    +-------------+
       |                  |                  |
  +----v----+      +------v------+    +------v------+
  | Traffic |      | Depth       |    | Drivable    |
  | Lights  |      | Estimation  |    | Space       |
  | Head    |      | Head        |    | Head        |
  +---------+      +-------------+    +-------------+
       |                  |                  |
       +------------------+------------------+
                          |
              +-----------v-----------+
              | 3D Vector Space       |
              | (unified scene        |
              |  representation)      |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | MCTS + Neural Net     |
              | Planner               |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Vehicle Controls      |
              | (steering, throttle,  |
              |  brake)               |
              +--------- ------------+
```

### Phase 3 Architecture (v12+, End-to-End)

```
              +------------------+
              | 8 Cameras x      |
              | N frames (10 sec)|
              | + Navigation     |
              | + Kinematics     |
              | + Audio (v14+)   |
              +--------+---------+
                       |
              +--------v---------+
              |                  |
              |  Single Unified  |
              |  Neural Network  |
              |                  |
              |  (Vision Trans-  |
              |   former based,  |
              |   auto-regressive|
              |   transformer,   |
              |   ~100M params   |
              |   v14)           |
              |                  |
              |  Internal:       |
              |  - BEV features  |
              |  - Occupancy     |
              |  - Object repr.  |
              |  - Lane repr.    |
              |  - Traffic state |
              |                  |
              +--------+---------+
                       |
         +-------------+-------------+
         |             |             |
    +----v---+   +-----v----+  +----v----+
    |Steering|   |Accel/    |  | Brake   |
    |Angle   |   |Throttle  |  | Command |
    +--------+   +----------+  +---------+

    Auxiliary Outputs (for debugging/safety):
    - 3D Occupancy map
    - Detected objects
    - Lane boundaries
    - Traffic light states
    - Natural language explanations (v14+)
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **BEV** | Bird's Eye View -- top-down spatial representation centered on the vehicle |
| **BiFPN** | Bi-directional Feature Pyramid Network -- multi-scale feature fusion mechanism |
| **E2E** | End-to-End -- single differentiable model from sensor input to control output |
| **HydraNet** | Tesla's multi-task learning architecture with shared backbone and task-specific heads |
| **ISP** | Image Signal Processor -- hardware that converts raw sensor data to viewable images |
| **MAC** | Multiply-Accumulate -- fundamental operation in neural network inference |
| **MCTS** | Monte-Carlo Tree Search -- planning algorithm that explores trajectory trees |
| **NPU** | Neural Processing Unit -- specialized hardware accelerator for neural network inference |
| **QAT** | Quantization-Aware Training -- training with simulated lower precision |
| **RCCC** | Red-Clear-Clear-Clear -- color filter array used on Tesla cameras |
| **RegNet** | Regularized Network -- efficient CNN backbone architecture |
| **SDF** | Signed Distance Field -- continuous function representing distance to nearest surface |
| **TOPS** | Tera Operations Per Second -- measure of neural network accelerator performance |
| **VRU** | Vulnerable Road User -- pedestrians, cyclists, and similar road users |

---

*This document was compiled from publicly available information including Tesla AI Day 2021 and 2022 presentations, Andrej Karpathy's CVPR 2021 and 2022 workshop talks, Ashok Elluswamy's CVPR 2023 and ICCV 2024 presentations, Tesla patent filings (US and WIPO), WikiChip hardware analyses, independent teardown reports, technical blog analyses (ThinkAutonomous, NotATeslaApp, AutopilotReview), and industry reporting as of March 2026.*
