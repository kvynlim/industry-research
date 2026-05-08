# Zoox Perception Stack — Technical Deep Dive

> Compiled March 2026 from Zoox journal articles, Amazon Science publications, CVPR/NeurIPS papers,
> NVIDIA blog posts, FLIR/Hesai datasheets, Zoox Safety Reports, arXiv papers, job postings, and patent filings.

---

## Table of Contents

1. [Sensor Hardware](#sensor-hardware)
2. [Sensor Calibration & Synchronization](#sensor-calibration--synchronization)
3. [Early Fusion Architecture (CVPR 2025)](#early-fusion-architecture-cvpr-2025)
4. [Sensor Staleness Innovation (CVPR 2025)](#sensor-staleness-innovation-cvpr-2025)
5. [Three Parallel Perception Systems](#three-parallel-perception-systems)
   - [System 2: Geometric CAS — Deep Dive](#system-2-geometric-collision-avoidance-cas) (corridor analysis, polygon collision, trajectory hierarchy, dynamic vs. static handling, patent summary, theoretical & research background)
6. [Published Neural Network Architectures](#published-neural-network-architectures)
7. [Next-Gen Unified Perception Model](#next-gen-unified-perception-model)
8. [Perception Outputs & BEV Representation](#perception-outputs--bev-representation)
9. [Perception → Prediction Interface](#perception--prediction-interface)
10. [Prediction Architecture (CNN + GNN)](#prediction-architecture-cnn--gnn)
11. [Vision-Language-Action Foundation Model](#vision-language-action-foundation-model)
12. [Inference & On-Vehicle Compute](#inference--on-vehicle-compute)
13. [Training Infrastructure](#training-infrastructure)
14. [Perception Team Organization](#perception-team-organization)
15. [Competitive Analysis](#competitive-analysis)
16. [What Remains Undisclosed](#what-remains-undisclosed)
17. [Sources](#sources)

---

## Sensor Hardware

### Overview

~64 sensors distributed across **four identical sensor pods** at the vehicle's four corners. Each corner achieves **270-degree FOV**, overlapping to provide full **360-degree coverage extending 150–200+ meters**.

### LiDAR

| Attribute | Detail |
|---|---|
| **Supplier** | Hesai Technology (multi-year, multi-generation partnership) |
| **Count** | 8 units (2 per corner pod — 1 long-range + 1 short-range) |
| **Wavelength** | 905 nm (Class 1 eye-safe) |
| **Certifications** | ISO 26262 ASIL B, ISO 21434 Cybersecurity |
| **IP rating** | IP6K7, IP6K9K |
| **Per-point data** | XYZ position, intensity, per-point timestamp |
| **Timestamp** | T_L = max(T_i) — sweep completion time |

**Long-range units (1 per corner) — Hesai Pandar128 / OT128:**

| Attribute | Detail |
|---|---|
| **Channels** | 128 |
| **Range** | 200 m at 10% reflectivity |
| **Points/sec** | 3.46M single-return, 6.91M dual-return |
| **Horizontal FOV** | 360° |
| **Vertical FOV** | 40° |
| **Angular resolution** | 0.1° (H) × 0.125° (V) |
| **Rotation rate** | 10 Hz |
| **Designed lifetime** | >30,000 hours |

**Short-range units (1 per corner) — Hesai QT128:**

| Attribute | Detail |
|---|---|
| **Channels** | 128 |
| **Range** | 20 m at 10% reflectivity (50 m max) |
| **Points/sec** | 1.15M single-return |
| **Horizontal FOV** | 360° |
| **Vertical FOV** | 105° (ultra-wide for near-field) |
| **Angular resolution** | 0.4° (H) × 0.4° (V) |
| **Weight** | 700 g |
| **Purpose** | Blind-spot coverage — pedestrians, animals, small objects at close range |

### Sensor Count Summary

| Modality | Count | Source |
|---|---|---|
| **RGB Cameras** | 14 | Zoox Safety Report / teardown analysis |
| **Radars** | 20 | Zoox Safety Report / teardown analysis |
| **LiDARs** | 8 | Zoox Safety Report / teardown analysis |
| **LWIR Thermal** | Multiple (exact count undisclosed) | FLIR partnership announcement |
| **Ultrasonics** | Multiple (close-range blind-spot fill) | Teardown analysis |
| **Microphones** | Multiple | Zoox journal |
| **Total** | ~64 sensors | Zoox official |

### Cameras

| Attribute | Detail |
|---|---|
| **Count** | 14 RGB cameras across the vehicle |
| **Types** | Wide field-of-view + telephoto lenses |
| **Frame rate** | 10 Hz |
| **Exposure** | 5–15 ms exposure, 25 μs row time (rolling shutter) |
| **Timestamp** | T_C = first-line exposure-stop time |
| **Sync** | Clock-synchronized and phase-locked with LiDAR |
| **Uses** | Color, texture, traffic lights, pedestrian gestures, fine-grained classification |

### Longwave Infrared (LWIR) Thermal Cameras

| Attribute | Detail |
|---|---|
| **Supplier** | Teledyne FLIR |
| **Model** | FLIR Boson + ADK |
| **Core** | Uncooled VOx microbolometer |
| **Resolution** | 640 × 512 pixels |
| **Spectral band** | 8–14 μm |
| **Pixel pitch** | 12 μm |
| **Thermal sensitivity** | < 50 mK NETD |
| **HFOV** | 75° |
| **Frame rate** | 30/60 Hz selectable |
| **Onboard VPU** | Intel Movidius Myriad 2 |
| **Interface** | USB, GMSL, Ethernet, FPD-Link III |
| **Ingress** | IP67-rated, heated window |
| **Operating temp** | -40°C to +85°C |
| **Weight** | ~100 g per unit |
| **Power** | ~4 W average |
| **Sensing mode** | Passive — no illumination needed |
| **Uses** | Pedestrian/cyclist/animal detection in darkness, sun glare, fog, smoke, rain, snow |

### Radar

| Attribute | Detail |
|---|---|
| **Count** | 20 units (~5 per corner, some mounted low on vehicle body) |
| **Supplier** | Not publicly disclosed |
| **Frequency** | 77 GHz with ~4 GHz bandwidth (industry standard) |
| **Type** | 4D imaging radar (range, azimuth, elevation, velocity) |
| **Sync** | NOT phase-locked to other sensors (variable firing frequencies with offsets) |
| **Data aggregation** | 1-second buffer |
| **Per-point data** | 3D position, RCS, SNR, Doppler interval, per-point timestamp |
| **Timestamp** | T_R = max(T_i) — latest radar point in buffer |
| **Uses** | Direct velocity (Doppler), long-range (hundreds of meters), weather-robust, penetrates occlusions |
| **Patent** | US 2019/0391250 — radar clustering and velocity disambiguation across multiple pulse-Doppler sensors |

### Microphones

| Attribute | Detail |
|---|---|
| **Type** | External acoustic array |
| **Use** | Emergency vehicle siren detection and directional approach determination |
| **Techniques** | ML models on acoustic data; Direction of Arrival (DoA) estimation |
| **Patent** | CN114586084A — emergency vehicle detection |

### Ultrasonic Sensors

| Attribute | Detail |
|---|---|
| **Use** | Close-range blind-spot fill around vehicle body |
| **Typical specs** | 40–100 kHz frequency, 0.3–2.5 m range, 120–160° angular detection |
| **Note** | Exact Zoox ultrasonic specifications not publicly disclosed |

### Additional Sensors (for Localization)

GPS receivers, accelerometers (IMU), gyroscopes, wheel speed sensors, steering angle sensors.

---

## Sensor Calibration & Synchronization

### Infrastructure-Free Calibration (CLAMS)

Zoox pioneered **automatic extrinsic calibration without calibration targets**:

- Identifies natural environmental features (building edges, tree trunks)
- Aligns **image gradients** from cameras with **depth edges** in LiDAR point clouds
- Runs **continuously** during operation — thermal cycling, shock, and vibration cause constant drift
- No external infrastructure required (unlike traditional checkerboard or target-based calibration)

### Clock Synchronization

| Modality | Sync Status | Timing |
|---|---|---|
| **LiDAR** | Phase-locked | Sweep completion timestamp |
| **Cameras** | Phase-locked to LiDAR | First-line exposure stop |
| **Radar** | NOT phase-locked | Variable firing with offsets |
| **LWIR** | Integration into main clock domain | 30/60 Hz |

**Perfectly synchronized camera timestamp formula:**

```
T_C = T_L - 0.1 × (θ_L - θ_C) / (2π)
```

where θ values are azimuth angles.

### The Staleness Problem

Even with clock synchronization, **processing and transmission delays** cause modalities to arrive at different times. Real deployment logs show staleness patterns of approximately **-0.1s to 0s** between camera and LiDAR, with multiple histogram peaks indicating systematic delay patterns.

---

## Early Fusion Architecture (CVPR 2025)

From the paper: *"Robust sensor fusion against on-vehicle sensor staleness"* (arXiv 2506.05780, CVPR 2025 Precognition Workshop). Authors: Meng Fan, Yifan Zuo, Patrick Blaes, Harley Montgomery, Subhasis Das (all Zoox Inc.).

### Architecture Overview

The early fusion operates in **perspective view** (not BEV):

```
Camera frames ──→ [YoloXPAFPN backbone] ──→ [B, C_C, H/8, W/8]
                                                    ↓
LiDAR points ───→ [PointPillar backbone] ──→ [B, C_L, H/8, W/8] ──→ [Dynamic Fusion] ──→ [FPN] ──→ [DINO Decoder]
                   (perspective-view pillars                                                              ↓
                    = camera frustum pillars)                                                    3D Detections
                                                    ↑
Radar points ───→ [PointPillar backbone] ──→ [B, C_R, H/8, W/8]
```

### Backbones (Per-Modality)

| Modality | Backbone | Notes |
|---|---|---|
| **Camera** | **YoloXPAFPN** (YOLOX Path Aggregation Feature Pyramid Network) | Output aligned to stride 8 |
| **LiDAR** | **PointPillar** in perspective view | Each "pillar" defined as a camera frustum (not BEV column) |
| **Radar** | **PointPillar** in perspective view | Same frustum-based pillar definition |

### Fusion Module

- **Dynamic fusion** combines the three backbone feature maps
- Followed by **Feature Pyramid Network (FPN)** at strides 8, 16, and 32

### Detection Head: DINO Decoder

Adapted **DINO** (DETR with Improved Denoising Anchor Boxes):

| Component | Loss Function |
|---|---|
| **Class head** | Focal loss |
| **2D box head** | GIoU loss |
| **3D box head** (center, extents, yaw, velocity) | L1 loss |
| **Assignment** | Hungarian matching (one-to-one query ↔ ground-truth) |

### Robustness Training

- **Feature-level sensor dropout**: 20% probability of zeroing out any one modality's backbone output during training
- Makes the model robust to real-world sensor failures or degradation

---

## Sensor Staleness Innovation (CVPR 2025)

### Two Model-Agnostic Innovations

**Innovation 1 — Per-Point Timestamp Offset Feature:**

For every LiDAR point and radar point, the model receives:
```
Δt_i = T_C - T_i
```
(time difference between camera frame timestamp and individual point capture timestamp)

This gives **fine-grained temporal awareness at the individual measurement level**.

**Innovation 2 — Synthetic Stale Data Augmentation:**

1. LiDAR data and ground truth remain unchanged (reference frame)
2. Compute ideal synchronized camera timestamp: T_C = T_L - 0.1 × (θ_L - θ_C)/(2π)
3. Generate random jitter: δt ~ Uniform(-0.1s, +0.1s)
4. Query closest actual camera frame at T' = T_C + δt
5. For radar: independently jitter T_R and update 1-second buffer
6. Mix augmented data at ratio **P_s** (optimal: ~0.01 = 1%)

### Experimental Results (Proprietary AV Dataset)

#### Under Perfect Synchronization (No Staleness)

| Metric | Cyclists F1 | Cars F1 | Pedestrians F1 |
|---|---|---|---|
| **Baseline** | 32.1% | 52.8% | 28.2% |
| **With augmentation** | 30.8% | 52.4% | 28.5% |

Minimal degradation — augmentation does NOT hurt synchronized performance.

#### Under 100 ms Camera Staleness

| Metric | Cyclists F1 | Cars F1 | Pedestrians F1 |
|---|---|---|---|
| **Baseline** | 14.1% | 36.6% | **6.3%** |
| **With augmentation** | 32.1% | 52.1% | **26.8%** |
| **Improvement** | 2.3× | 1.4× | **4.3×** |

The baseline **collapses** under staleness. The augmented model is virtually unaffected.

#### Precision/Recall Under 100 ms Staleness

| | Precision (Cyc/Car/Ped) | Recall (Cyc/Car/Ped) |
|---|---|---|
| **Baseline** | 10.2 / 30.6 / 7.1 | 22.9 / 45.6 / 5.7 |
| **With augmentation** | 23.3 / 40.3 / 22.0 | 51.3 / 73.7 / 34.4 |

### Deployment Recommendation

**150 ms threshold**: Use stale data (with augmentation-trained model) when staleness < 150 ms. Apply **modality dropout** (zero features) when staleness > 150 ms or sensor fails completely.

### Properties

- **Model-agnostic** — works with any fusion architecture
- **Negligible latency impact** — suitable for real-time on-vehicle deployment
- **Deployed summer 2025** on the Zoox production fleet

---

## Three Parallel Perception Systems

Zoox runs **three architecturally diverse, independent perception systems simultaneously**:

### System 1: Main AI Perception Stack

| Attribute | Detail |
|---|---|
| **Type** | ML-based (deep learning) |
| **Input** | All 5 sensor modalities via early fusion |
| **Outputs** | 3D bounding boxes + velocity, classification, tracking, semantic segmentation, occupancy, dense depth |
| **Feeds** | Prediction and planning modules |

### System 2: Geometric Collision Avoidance (CAS)

| Attribute | Detail |
|---|---|
| **Type** | Interpretable geometric algorithms + deep learning hybrid |
| **Input** | Raw sensor data (direct) — processes a **subset** of sensors (primarily LiDAR, radar, ToF); CAS team job postings confirm consumption of lidar, radar, vision, and LWIR |
| **Output** | Near-collision warnings along intended driving path; trajectory validation verdicts |
| **Design** | Higher integrity, lower complexity than System 1; shorter processing pipeline; more easily verifiable algorithms; designed for potential **ASIL-D certification** |
| **Response** | Ultra-fast braking ("like hitting the brakes if someone steps out") |
| **Implementation** | C++ with low-latency algorithm design |
| **Patent** | US20200211394 — Collision Avoidance System (dual-system architecture) |

#### CAS Perception: Geometric Algorithms

CAS Perception processes raw sensor data using **"a combination of geometric, interpretable algorithms and deep learning"** to detect near-collisions under **tight compute resource constraints**. The geometric algorithms are designed to be auditable and verifiable, avoiding the opacity of the Main AI's deep neural networks.

**Corridor-Based Spatial Analysis (US11500385B2):**

| Component | Detail |
|---|---|
| **Corridor definition** | Bounded region ahead of vehicle based on planned trajectory, vehicle dimensions, velocity, and steering offset |
| **Spatial filtering** | Only sensor data within the corridor is analyzed — dramatically reduces computational load |
| **Ground modeling** | Multi-degree polynomial or spline curves (Bezier, B-spline, NURBS) fitted to ground profile within corridor |
| **Knot formula** | Knot count = control points + curve degree + 1; control points determined from sensor channel density |
| **Object classification** | Points above the fitted ground curve (or exhibiting elevation discontinuities) are classified as objects; points within threshold distance below the curve are ground |
| **Regression** | Weighted least squares with **skewed loss function** — penalizes false negatives (missed objects) more heavily than false positives |
| **Pre-fitting** | Outlier elimination via clustering + RANSAC; data weighting by elevation (lower = heavier weight); binning by sensor channel density |
| **Post-fitting** | Control point elevation caps (max sensor data elevation + buffer); knot spacing optimization for uniform spatial distribution |
| **Multi-grade terrain** | Handles complex environments (e.g., negative grade → flat → negative grade) using higher-order polynomials; projects 3D data into 2D elevation profiles, fits curves, then projects back |
| **Estimators** | Uses M-estimators instead of neural networks for robustness and verifiability |
| **Patent** | US11500385B2 — Collision Avoidance Perception System; EP4037946A1 — Complex Ground Profile Estimation |

**Object Detection (Secondary System):**

| Component | Detail |
|---|---|
| **Approach** | Detects objects by sensor data analysis **without semantic classification** in many cases |
| **Output** | Object presence, position, velocity, acceleration, extent (size) — but NOT classification |
| **Tracking** | Historical position, velocity, acceleration, and orientation tracked over time |
| **Motion prediction** | Straight-line approximation based on current velocity (simple); Extended Kalman Filter / particle filter for sophisticated cases |
| **Ground removal** | Eigenvalue decomposition per voxel to filter drivable surfaces from LiDAR data |
| **Key distinction** | Uses probabilistic models (Kalman filters, particle filters) rather than neural networks |

#### CAS Trajectory Validation

The CAS acts as a **multiplexer** between the Main AI planner and vehicle drive controllers:

1. Main AI planner generates a **primary trajectory** and a **secondary/contingent trajectory** (backup)
2. Both trajectories are sent to CAS for independent validation
3. CAS runs its own perception, prediction, and collision checking on each trajectory
4. Validated trajectory is passed through to controllers; failed trajectories trigger escalation

**Two Simultaneous Distance Checks:**

| Check | Pass Condition |
|---|---|
| **Object distance** | Nearest detected object must be ≥ threshold distance |
| **Ground extent** | Furthest detected ground point must be ≥ threshold distance |

**Threshold distance** is dynamically calculated from: vehicle velocity, stopping distance estimates, environmental gradient, and coefficient of friction. If **either** check fails, the trajectory is rejected.

**Additional Validation Checks:**

| Check | Description |
|---|---|
| **Temporal freshness** | Trajectory must have been generated less than a threshold time ago |
| **Consistency** | Trajectory must be consistent with current or previous vehicle pose |
| **Feasibility** | Trajectory must respect vehicle steering limits, acceleration limits |
| **Collision detection** | Vehicle bounding box must not intersect with predicted object bounding boxes at any common timestep |

#### CAS Trajectory Hierarchy (4-Level Escalation)

| Level | Trajectory Type | Action | Comfort |
|---|---|---|---|
| **1** | Primary trajectory | Normal driving (acceleration, lane changes) | Normal |
| **2** | Secondary/contingent | Gentle stop (deceleration < maximum) | Moderate |
| **3** | Collision avoidance | Modified secondary with adjusted deceleration profile | Uncomfortable |
| **4** | Maximum deceleration | Emergency stop (emergency brakes, seatbelt pre-tensioners) | Emergency |

The system **selects the highest-level trajectory that passes validation** to minimize passenger discomfort. A state machine **prevents upward transitions** (returning to a higher-level trajectory) until an explicit release signal is received, preventing oscillation.

**Advisory vs. Override Logic:**

| Scenario | CAS Response |
|---|---|
| **Far-future collision** | Warning message to Main AI with time-to-collision, object extents, velocity, location, and collision point — allowing the AI to re-plan |
| **Imminent collision** | Direct command to secondary or collision avoidance trajectory |
| **System failure** | Monitor triggers immediate transition to maximum deceleration |

#### CAS Polygon & Geometric Collision Detection

**Bounding Box Collision Checking (Primary Method — US20200211394):**

Zoox represents all objects as **oriented bounding boxes (cuboids)** defined by eight corners with position, orientation, length, width, and height. Collision detection checks whether the ego vehicle's bounding box overlaps with obstacle bounding boxes at each projected timestep, with optional **safety margins** (enlarged bounding boxes for conservative detection).

**Path Polygon Corridors (US20210370921A1 — Perturbed Object Trajectories):**

| Component | Detail |
|---|---|
| **Path polygons** | Left/right trajectory boundaries forming a swept 2D region ("corridor") |
| **Boundary points** | Positioned at 0.2–0.5 second intervals along trajectory |
| **Turn adjustment** | Boundaries adjusted outward during turns based on curvature radius |
| **Collision test** | Time-space overlap analysis — checks temporal coincidence of vehicle and object occupancy within the corridor |
| **Perturbation** | M × N trajectory variants generated by perturbing acceleration and steering parameters |
| **Probability** | P(collision) = (trajectories causing collision) / (total perturbed trajectories), weighted by behavioral likelihood |
| **Position cones** | Min/max velocity envelopes provide conservative temporal bounds |

**Convex Polygon Buffer Regions (US20200398833 — Dynamic Collision Checking):**

| Region | Description |
|---|---|
| **Dilated region** | Largest drivable area extent — represents maximum available space |
| **Collision region** | Smaller drivable region within dilated — hard collision boundary |
| **Safety region** | Buffer zone between vehicle and collision boundary |
| **Method** | Front bumper position computed at points along center curve of predicted travel region; polygons generated for each position; polygons joined using convex shape-based algorithm to produce convex polygonal buffer |

**Cost-Based Trajectory Optimization (US20200139959 — Cost Scaling):**

Rather than binary collision/no-collision tests, Zoox uses **layered cost regions** with continuous distance-based costs. The planner optimizes trajectories against graduated penalties from lane boundaries, dilated regions, collision regions, and safety regions — enabling the planner to find optimal trajectories balancing safety margins against other objectives.

#### Dynamic vs. Static Object Handling

**Dynamic Objects (Vehicles, Pedestrians, Cyclists, Animals):**

| Aspect | Detail |
|---|---|
| **Representation** | Oriented bounding boxes (cuboids) with position, heading, velocity, acceleration |
| **BEV appearance** | Boxes in bird's-eye view — "different, smaller boxes" for pedestrians vs. vehicles |
| **Prediction** | CAS uses linear extrapolation (position + velocity) for simple cases; Extended Kalman Filter for complex cases |
| **Collision check** | Trajectory-level intersection: projected ego bounding box path checked against projected obstacle bounding box path at common time windows |
| **Perturbation analysis** | Multiple trajectory variants generated by perturbing object acceleration/steering; produces probabilistic collision assessment |
| **Radar contribution** | Direct Doppler velocity feeds dynamic object velocity estimation without relying on multi-frame tracking |

**Static / Map Objects (Road Boundaries, Buildings, Keep-Clear Zones):**

| Aspect | Detail |
|---|---|
| **Map representation** | ZRN uses polygon meshes for surfaces (US20240094009A1); crosswalks, lanes, drivable surfaces defined as polygon regions |
| **CAS map usage** | Secondary system performs **less localization processing** than primary; may determine pose relative to objects/surfaces rather than a full map |
| **Unmapped obstacles** | Detected via sensor data (parked cars, construction, debris) using corridor-based obstacle classification |
| **Ground removal** | Eigenvalue decomposition per voxel separates drivable ground from obstacles in LiDAR data |
| **Drivable area** | Defined with layered polygon boundaries (lane boundaries, dilated/collision/safety regions) |

**Key Distinction:** CAS applies **uniform bounding box intersection logic** across all object types. The differentiation between dynamic and static objects occurs primarily in the **prediction stage** — dynamic objects have their trajectories propagated forward using motion models, while static objects are checked as fixed obstacles within the corridor.

#### Algorithms NOT Used (Based on Patent Evidence)

Across all examined Zoox patents, the following computational geometry algorithms are **never mentioned**:
- GJK (Gilbert-Johnson-Keerthi) algorithm
- Separating Axis Theorem (SAT)
- Minkowski sum/difference
- Swept volume computation (as a formal algorithm)
- Convex hull decomposition for collision checking

This is consistent with industry practice — advanced polygon algorithms like GJK and Minkowski sum are more common in **robotics manipulation** and **game physics engines** (Bullet, FCL, Box2D). In AV motion planning, objects are typically simple rectangles where bounding box overlap suffices.

#### CAS Team Organization

| Sub-Team | Focus |
|---|---|
| **CAS Perception** | Raw sensor processing with geometric + DL algorithms for obstacle detection |
| **CAS Planner** | Motion planning with low-latency C++ algorithms |
| **CAS Verification & Validation** | Testing and certification of CAS components |

#### Real-World CAS Performance

No specific CAS intervention statistics (interventions/mile) have been publicly disclosed. However, real-world recalls reveal CAS-related behaviors:

| Date | Recall | Issue |
|---|---|---|
| **March 2025** | 25E-029 (258 vehicles) | Unexpected hard braking: (1) over-cautious braking when cyclist near adjacent crosswalk at newly green signal; (2) incorrect anticipation of collision from rapidly approaching motorcyclist/bicyclist from behind |
| **April 2025** | 25E-037 | At speeds >40 mph, "inaccurately confident predictions" of perpendicular vehicle behavior from driveways |
| **December 2025** | (332 vehicles) | Software causing lane crossings and crosswalk blocking near intersections |

CTO Jesse Levinson noted: *"It's really easy to overreact because the car can look at 300 things and think maybe one of them is going to run into it, causing the car to brake."*

#### CAS Patent Summary

| Patent | Title | Key Innovation |
|---|---|---|
| [US20200211394](https://www.freepatentsonline.com/y2020/0211394.html) | Collision Avoidance System | Primary/secondary dual-system architecture, trajectory hierarchy, state machine control |
| [US11500385B2](https://patents.google.com/patent/US11500385B2/en) | Collision Avoidance Perception System | Spline-based ground modeling, corridor analysis, weighted least squares classification |
| [EP4037946A1](https://patents.google.com/patent/EP4037946A1/en) | Complex Ground Profile Estimation | Multi-grade terrain handling, NURBS fitting, outlier elimination |
| [US20200398833](https://uspto.report/patent/app/20200398833) | Dynamic Collision Checking | Convex polygon buffer regions, bumper path projection, layered drivable area |
| [US20210370921A1](https://patents.google.com/patent/US20210370921A1/en) | Perturbed Object Trajectories | Probabilistic collision checking via Monte Carlo-style perturbation analysis |
| [US20200139959](https://www.freepatentsonline.com/y2020/0139959.html) | Cost Scaling in Trajectory Generation | Layered collision/safety regions with distance-based cost functions |
| [US20240094009A1](https://patents.google.com/patent/US20240094009A1) | Map Annotation Modification | Polygon mesh for map surfaces, polygon fitting for map element extents |
| [US10535138](https://uspto.report/patent/grant/10,535,138) | Sensor Data Segmentation | Cross-modal sensor data segmentation for perception |

Key inventors: Andrew Lewis King, Jefferson Bradfield Packer, Kristofer Sven Smeds, Robert Edward Somers, Marc Wimmershoff, Michael Carsten Bosse, Jacob Daniel Boydston, Joshua Kriser Cohen, Chuang Wang, Janek Hudecek, David Pfeiffer.

#### CAS Theoretical & Research Background

The CAS draws on decades of research across robust statistics, computational geometry, state estimation, safety engineering, and formal methods. This section traces each CAS technique to its foundational academic literature.

##### A. Architectural Design Philosophy

The dual-system architecture (Main AI + CAS) instantiates several well-established patterns from safety-critical systems engineering:

| Pattern | Seminal Work | Year | Key Idea | CAS Mapping |
|---|---|---|---|---|
| **N-Version Programming** | Avizienis, "The N-Version Approach to Fault-Tolerant Software," *IEEE TSE* | 1985 | Multiple independently developed implementations reduce common-cause failure probability | Main AI (neural network) and CAS (geometric) are architecturally dissimilar — different algorithms, different failure modes |
| **Design Diversity Critique** | Knight & Leveson, "An Experimental Evaluation of the Assumption of Independence in Multiversion Programming," *IEEE TSE* | 1986 | Correlated failures occur more often than independence assumption predicts — homogeneous redundancy is insufficient | Justifies why CAS uses fundamentally different algorithms (geometric/interpretable) rather than duplicating the Main AI |
| **Simplex Architecture** | Seto, Krogh, Sha & Chutinan, *ACC* 1998; Sha, "Using Simplicity to Control Complexity," *IEEE Software* | 1998/2001 | A verified simple controller bounds the behavior of an unverified complex controller; safety and performance decoupled | Main AI = advanced unverified controller; CAS = verified baseline safety controller with switching logic |
| **Monitor-Actuator (Doer-Checker)** | Koopman & Wagner, "Challenges in Autonomous Vehicle Testing and Validation," *SAE* 2016-01-0128 | 2016 | Complex "doer" produces outputs; simpler "checker" validates them; checker certifiable at higher ASIL due to reduced complexity | CAS monitors and validates Main AI trajectory outputs; can override with safe trajectory |
| **Responsibility-Sensitive Safety (RSS)** | Shalev-Shwartz, Shammah & Shashua, "On a Formal Model of Safe and Scalable Self-driving Cars," arXiv:1708.06374 | 2017 | Mathematical definitions of "dangerous situation" and "proper response"; formal safety distance calculations; blame attribution | CAS trajectory validation enforces formal safety constraints analogous to RSS proper-response rules |
| **SOTIF (ISO 21448)** | ISO/PAS 21448:2019 (full standard 2022), "Road vehicles — Safety of the intended functionality" | 2019 | Addresses hazards when system works as designed but has functional limitations (not hardware failure) — especially perception | CAS's dissimilar perception catches Main AI perception-limitation hazards that ISO 26262 does not address |

**ASIL-D and ISO 26262 Context:**

The CAS targets **ASIL-D** (the most stringent automotive safety integrity level), which requires:
- Single-Point Fault Metric (SPFM) ≥ 99%
- Latent Fault Metric (LFM) ≥ 90%
- Probabilistic Metric for Hardware Failure (PMHF) < 10⁻⁸/hour

Through **ASIL decomposition** (ISO 26262 Part 9), the overall ASIL-D safety goal is split between the complex Main AI (lower ASIL) and the simpler CAS (higher ASIL), with sufficient independence demonstrated through dissimilar redundancy. Lower-complexity interpretable systems are fundamentally easier to certify at higher ASIL levels because their state spaces are smaller, amenable to formal/semi-formal analysis, and have enumerable failure modes.

**Why Interpretable Algorithms Over Neural Networks for the Safety-Critical Path:**

Katz et al. (2017, "Reluplex," CAV) proved that verifying even simple properties of deep neural networks with ReLU activations is NP-complete. The CAS responds to this intractability by using geometric/analytic methods that provide: (1) deterministic outputs for given inputs, (2) bounded execution time amenable to WCET analysis, (3) enumerable failure modes, (4) formal provability of safety properties, and (5) transparency for certification authorities.

##### B. Ground Profile Estimation: Splines, Robust Fitting & Outlier Rejection

**B-Splines, Bezier Curves, and NURBS:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Spline functions introduced | I.J. Schoenberg, "Contributions to the Problem of Approximation of Equidistant Data," *Q. Appl. Math.* 4:45-99 | 1946 | Founded spline theory — smooth curve fitting to discrete noisy data, the core CAS ground-fitting problem |
| Bezier curves (unpublished) | Paul de Casteljau, internal Citroen documents | 1959 | First practical control-point curve evaluation algorithm |
| Bezier curves (published) | Pierre Bezier, Renault; UNISURF system | 1962–72 | First CAD/CAM system using polynomial control-point curves in production |
| Cox-de Boor recursion | Carl de Boor, "On Calculating with B-Splines," *J. Approx. Theory* 6:50-62; Maurice Cox independently | 1972 | Recursive B-spline basis function evaluation — computational backbone of all B-spline systems |
| B-splines for CAD | Richard Riesenfeld, PhD thesis, Syracuse | 1973 | Proved B-splines generalize and are superior to Bezier curves for CAD |
| NURBS | Kenneth Versprille, PhD thesis, Syracuse | 1975 | Extended B-splines with rational functions to represent conics and freeform curves in a unified framework |
| Knot vector theory monograph | Carl de Boor, *A Practical Guide to Splines*, Springer | 1978 | Definitive reference: derives m = n + p + 1 (knots = control points + degree + 1) from spline space dimension |
| B-spline ground estimation for AV | Wirges, Rosch, Bieder & Stiller, "Fast and Robust Ground Surface Estimation from LiDAR Measurements using Uniform B-Splines," FUSION | 2021 | Direct precedent — models ground surface as uniform B-spline solved via robust least squares on LiDAR data |

B-splines are ideal for CAS corridor ground modeling because: (a) **local control** — modifying one control point affects only a local curve segment (critical when a curb or pothole appears in one section); (b) **non-uniform point density handling** — gracefully adapts to LiDAR's distance-dependent density; (c) **tunable smoothness** trading off fidelity against noise rejection.

**Knot Vector Relationship:** The formula **m = n + p + 1** (knots = control_points + degree + 1) is a structural consequence of the Cox-de Boor recursion — each basis function of degree p is supported on at most p+1 consecutive knot spans, so defining n basis functions of degree p requires n+p+1 knot values. In the CAS, knot count controls model complexity (more knots → finer ground detail), knot placement controls local resolution (denser at curb transitions, sparser on flat road), and degree selection (typically cubic, p=3, for C² continuity) is physically reasonable for ground surfaces.

**Weighted Least Squares with Asymmetric Loss:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| LINEX asymmetric loss function | Hal Varian, "A Bayesian Approach to Real Estate Assessment" | 1975 | First formal asymmetric loss — penalizes overestimation and underestimation differently |
| Bayesian estimation under asymmetric loss | Arnold Zellner, "Bayesian Estimation and Prediction Using Asymmetric Loss Functions," *JASA* 81(394):446-451 | 1986 | Proved common estimators are inadmissible under asymmetric loss; established rigorous framework |

**Safety motivation:** In ground profile estimation, **underestimating** ground height can mask an obstacle whose base appears below the estimated ground surface — a potentially catastrophic false negative. **Overestimating** ground height creates a phantom obstacle — a nuisance but safe. The skewed loss function biases the fit low, ensuring objects on the ground are never masked by an overestimated ground plane.

**M-Estimators:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Robust estimation / Huber M-estimator | Peter J. Huber, "Robust Estimation of a Location Parameter," *Ann. Math. Stat.* 35(1):73-101 | 1964 | Founded robust statistics. Quadratic loss for small residuals (like least squares), linear for large residuals (like LAD). Minimizes worst-case asymptotic variance under contamination |
| Robust regression | Huber, "Robust Regression," *Ann. Stat.* 1(5):799-821 | 1973 | Extended M-estimator theory to regression problems |
| Bisquare redescending estimator | John Tukey | 1970s | Influence function drops to zero for gross outliers — complete rejection of extreme contamination |
| Influence function & breakdown point | Frank Hampel | 1970s | Theoretical framework for comparing robust estimators; breakdown point up to 0.5 (half the data can be corrupted) |

**Why M-estimators over neural networks for CAS:** (1) Deterministic, analyzable behavior — influence function, breakdown point, asymptotic efficiency are known quantities; (2) No training data dependency — no distribution shift vulnerability; (3) Formal safety certification — bounded influence provides direct evidence for ASIL-D; (4) Computational predictability — deterministic, bounded runtime essential for real-time guarantees.

**RANSAC:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Random Sample Consensus | Martin A. Fischler & Robert C. Bolles, "Random Sample Consensus," *Comm. ACM* 24(6):381-395 | 1981 | Inverted conventional fitting: hypothesize model from minimum samples, count consensus. De facto standard for outlier rejection in point cloud processing |

In the CAS corridor pipeline, RANSAC serves as **first-stage gross outlier removal** (vehicles, pedestrians, vegetation, sensor artifacts), followed by M-estimator-based B-spline fitting for robust fine fitting. This two-stage approach (RANSAC for gross outliers, M-estimator for moderate outliers) is a well-established pattern in robust estimation.

##### C. Object Tracking & Short-Term Prediction

**Extended Kalman Filter (EKF):**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Kalman filter | R.E. Kalman, "A New Approach to Linear Filtering and Prediction Problems," *ASME J. Basic Eng.* 82(1):35-45 | 1960 | Recursive optimal state estimation for linear systems from noisy measurements — predict, then update |
| Continuous-time extension | Kalman & Bucy, "New Results in Linear Filtering and Prediction Theory," *ASME J. Basic Eng.* 83(1):95-108 | 1961 | Extended to continuous-time systems; established duality between estimation and control |
| Extended Kalman Filter (nonlinear) | Stanley F. Schmidt, NASA Ames (Apollo program) | Early 1960s | Linearizes nonlinear system around current estimate via Jacobian matrices at each timestep; used on every Apollo lunar mission |
| Standard tracking reference | Bar-Shalom, Li & Kirubarajan, *Estimation with Applications to Tracking and Navigation* | 2001 | Definitive reference covering KF, EKF, UKF, IMM, data association for tracking |

The EKF serves as the CAS workhorse for object state estimation, maintaining per-object state vectors (position, velocity, heading) and recursively fusing LiDAR range-bearing and radar Doppler measurements. Its recursive, **constant-time-per-update** structure is essential for hard real-time latency constraints.

**Particle Filters / Sequential Monte Carlo:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Bootstrap filter | Gordon, Salmond & Smith, "Novel approach to nonlinear/non-Gaussian Bayesian state estimation," *IEE Proc. F* 140(2):107-113 | 1993 | Foundational particle filter — represents posterior as weighted random samples with resampling to prevent degeneracy |
| CONDENSATION | Isard & Blake, "Conditional Density Propagation for Visual Tracking," *IJCV* 29(1):5-28 | 1998 | Brought particle filtering to computer vision; demonstrated superiority over Kalman for multi-modal, cluttered tracking |

**Why particle filters for CAS pedestrian tracking:** The fundamental limitation of Kalman filter families is Gaussian (unimodal) posterior representation. A pedestrian approaching an intersection might turn left, continue straight, or stop — three distinct modes. A single Gaussian must compromise by placing its mean between these possibilities (potentially an implausible trajectory). Particle filters maintain multiple hypotheses simultaneously, naturally representing behavioral ambiguity, data association ambiguity, and occlusion recovery.

**Eigenvalue Decomposition for Ground Removal:**

For N LiDAR points within a voxel cell: compute centroid μ, compute 3×3 sample covariance matrix C, perform eigendecomposition C = VΛV^T yielding eigenvalues λ₁ ≥ λ₂ ≥ λ₃ ≥ 0.

| Eigenvalue Pattern | Geometric Interpretation |
|---|---|
| λ₁, λ₂ large; λ₃ ≈ 0 | **Planar** — points lie on a surface. If eigenvector v₃ is approximately vertical → ground |
| λ₁ large; λ₂, λ₃ small | **Linear** — pole, tree trunk, post |
| λ₁ ≈ λ₂ ≈ λ₃ | **Spherical** — no dominant structure |

Surface variation σ = λ₃/(λ₁ + λ₂ + λ₃) quantifies planarity (near zero = highly planar).

| Key Paper | Authors | Year | Contribution |
|---|---|---|---|
| PCA foundations | Karl Pearson, "On Lines and Planes of Closest Fit," *Phil. Mag.* | 1901 | Directions of maximum variance in data |
| Ground Plane Fitting | Zermas, Izzat & Papanikolopoulos, *ICRA* | 2017 | PCA-based plane estimation per sector with adaptive seed selection |
| Fast point cloud segmentation | Himmelsbach, Hundelshausen & Wuensche, *IEEE IV* | 2010 | Radial sector discretization for non-flat terrain ground estimation |
| Eigenvalue geometric features | Demantke, Mallet, David & Vallet, *ISPRS Workshop* | 2011 | Formalized linearity, planarity, sphericity features from eigenvalue ratios |

PCA-based ground removal is preferred over RANSAC for the CAS's safety-critical path because PCA is **deterministic** (unlike RANSAC which is stochastic and can produce different results on different runs), providing predictable, bounded runtime.

**Constant Velocity Models for Short-Horizon Prediction:**

| Key Paper | Authors | Year | Key Finding |
|---|---|---|---|
| CV model vs. deep learning | Scholler, Aravantinos, Lay & Knoll, "What the Constant Velocity Model Can Teach Us About Pedestrian Motion Prediction," *IEEE RA-L* 5(2):1696-1703 | 2020 | A parameter-free constant velocity model **outperformed** Social Force, Social LSTM, Social GAN on ETH/UCY benchmarks |
| Singer acceleration model | R.A. Singer, "Estimating Optimal Tracking Filter Performance," *IEEE T-AES* | 1970 | Exponentially correlated random acceleration for tracking filter process noise design |
| Maneuvering target survey | Li & Jilkov, "Survey of Maneuvering Target Tracking. Part I," *IEEE T-AES* 39(4):1333-1364 | 2003 | Comprehensive survey: constant velocity through coordinated turn and IMM approaches |

**Why simple models win at short horizons (bias-variance tradeoff):** E[Error] = Bias² + Variance + Irreducible Noise. Complex models (LSTMs, GANs) have low bias but high variance (sensitive to training data, scene-specific features). CV models have higher bias but near-zero variance (no learnable parameters). For prediction horizons under ~1-2 seconds, most objects continue at approximately constant velocity — the bias is small and the variance reduction more than compensates. The CAS's relevant prediction horizon (fractions of a second to ~1-2 seconds for last-resort collision avoidance) falls squarely in this regime.

**Voxel-Based LiDAR Processing:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Octree spatial data structure | Donald Meagher, "Geometric Modeling Using Octree Encoding," *CGIP* | 1982 | Hierarchical 3D space subdivision — ancestor of all voxel representations |
| Point Cloud Library | Rusu & Cousins, "3D is here: Point Cloud Library," *ICRA* | 2011 | Open-source standard for point cloud processing; VoxelGrid filter, octree indexing |
| VoxelNet | Zhou & Tuzel, "VoxelNet: End-to-End Learning for Point Cloud Based 3D Object Detection," *CVPR* | 2018 | Learned 3D detection from voxelized LiDAR; Voxel Feature Encoding layers |
| PointPillars | Lang, Vora, Caesar, Zhou, Yang & Beijbom, *CVPR* | 2019 | Collapsed vertical dimension into 2D pillars — dramatically faster while competitive |

The CAS uses voxel infrastructure (spatial binning, O(1) lookups, deterministic memory layout) but applies **geometric algorithms rather than learned detectors** — deterministic behavior, bounded compute, and interpretability take precedence over marginal accuracy gains from deep learning.

##### D. Geometric Collision Detection & Trajectory Validation

**Oriented Bounding Box (OBB) Collision Detection:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| OBBTree | Gottschalk, Lin & Manocha, *SIGGRAPH* | 1996 | Hierarchical OBB tree for rapid interference detection using the Separating Axis Theorem (SAT); <200 FLOPs per overlap test |
| Hyperplane Separation Theorem | Hermann Minkowski | c.1911 | Two disjoint convex sets in R^n can be separated by a hyperplane — mathematical foundation of SAT |
| Practical reference | Christer Ericson, *Real-Time Collision Detection*, Morgan Kaufmann | 2005 | Definitive implementation reference for SAT, AABBs, OBBs, k-DOPs, and BVH hierarchies |

**Why OBBs over AABBs:** AABBs fit poorly around rotated objects — a vehicle rotated 45° wastes ~50% of bounding area, creating excessive false-positive collision reports. OBBs align with the object's principal axes, providing dramatically tighter fits. For two OBBs in 2D (vehicle footprints on road), only 4 separating axes need testing (2 edge normals per rectangle). SAT's finite, deterministic nature makes it verifiable and suitable for safety-critical code paths.

**Convex Polygon Buffer Regions / Minkowski Sums:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Mathematical morphology (dilation/erosion) | Georges Matheron & Jean Serra, Ecole des Mines; Serra, *Image Analysis and Mathematical Morphology* | 1964/1982 | Dilation of set A by structuring element B = Minkowski sum A ⊕ B |
| Configuration-space obstacles | Tomas Lozano-Perez, "Spatial Planning: A Configuration Space Approach," *IEEE T-C* C-32(2):108-120 | 1983 | C-obstacle for translating robot = Minkowski sum of workspace obstacle and reflected robot shape |
| Comprehensive textbook | de Berg, van Kreveld, Overmars & Schwarzkopf, *Computational Geometry*, 3rd ed., Springer | 2008 | Standard reference: Minkowski sums in robot motion planning (Ch. 13) |
| Robot motion planning | Jean-Claude Latombe, *Robot Motion Planning*, Kluwer | 1991 | Comprehensive treatment of configuration space and Minkowski sum computation |

A **buffer zone** with clearance r around polygon P is formally P ⊕ D(r) where D(r) is a disk of radius r — precisely a Minkowski sum. The CAS's layered buffer regions (dilated/collision/safety) are concentric Minkowski sums with increasing structuring elements, creating graduated warning/action zones with mathematically guaranteed geometric properties.

**Monte Carlo Perturbation-Based Probabilistic Collision Checking:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Monte Carlo method | Metropolis & Ulam, "The Monte Carlo Method," *JASA* 44(247):335-341 | 1949 | Transforms intractable analytical problems into statistical sampling problems |
| Adaptive importance sampling for collision probability | Schmerling & Pavone, "Evaluating Trajectory Collision Probability through Adaptive Importance Sampling," *RSS* | 2017 | Variance reduction makes real-time probabilistic safety evaluation feasible (millisecond-scale); provides confidence intervals |
| Chance-constrained path planning | Blackmore, Ono & Williams, "Chance-Constrained Optimal Path Planning With Obstacles," *IEEE T-RO* 27(6) | 2011 | Plan trajectory distribution such that P(collision) < ε; theoretical framework for CAS's probabilistic collision threshold |
| Reachability-based safety verification | Althoff & Dolan, "Online Verification of Automated Road Vehicles Using Reachability Analysis," *IEEE T-RO* | 2014 | Formal online safety via reachable set computation; CAS perturbation approach is a practical relaxation of exact reachability |

The CAS generates M×N trajectory variants (M ego perturbations × N obstacle perturbations) by varying acceleration and steering parameters, then computes P(collision) = colliding pairs / total pairs, weighted by behavioral likelihood. This is a runtime implementation of a **chance constraint** — if the probability exceeds a threshold, the system escalates.

**Cost-Based / Potential Field Trajectory Optimization:**

| Contribution | Author(s) | Year | Significance |
|---|---|---|---|
| Artificial Potential Fields | Oussama Khatib, "Real-Time Obstacle Avoidance for Manipulators and Mobile Robots," *IJRR* 5(1):90-98 | 1986 | Continuous optimization: attractive potential toward goal + repulsive potentials from obstacles; enabled real-time collision avoidance |
| Navigation functions (no local minima) | Rimon & Koditschek, "Exact Robot Navigation Using Artificial Potential Functions," *IEEE T-RA* 8(5):501-508 | 1992 | Special potential functions guaranteed to have no local minima; resolved APF's fundamental limitation |
| Occupancy grids | Alberto Elfes | 1989 | Probabilistic environment representation in discrete cells — bridge from continuous potential fields to discrete cost maps |

The CAS's layered cost regions function as a discrete approximation to a navigation function. Each cost layer adds a "repulsive" cost increment, creating a gradient field steering trajectory optimization away from obstacles toward free space. This retains the gradient-descent intuition of potential fields while accommodating arbitrary cost structures (non-symmetric obstacles, road geometry, traffic rules).

**Trajectory Validation State Machines:**

The CAS's monotonic escalation state machine (no upward transitions without explicit release) is the software analog of a hardware **safety interlock** from aviation and industrial safety:

| Standard | Year | Key Principle |
|---|---|---|
| **DO-178C** (RTCA) — Airborne software certification | 2011 | Design Assurance Levels A-E; state machines are natural targets for formal verification via model checking |
| **DO-333** — Formal Methods Supplement to DO-178C | 2011 | Guidance on model checking and theorem proving for certification credit |
| **ISO 26262** — Automotive functional safety | 2011/2018 | Safety mechanisms must detect faults and maintain safe state; monotonic escalation ensures mechanism cannot be silently bypassed |
| **IEC 61508** — Industrial functional safety (parent standard) | 1998/2010 | Fail-safe states, safety interlocks, permissive interlocks formalized |

The pattern prevents **oscillation (chattering)** between states due to noisy sensor data and ensures the system errs on the side of safety. Formal model checkers can exhaustively verify properties like "once in EMERGENCY_BRAKE, the system never transitions to NOMINAL without passing through SAFE_STOP and receiving ALL_CLEAR."

**Stopping Distance Models:**

Total stopping distance = perception-reaction distance + braking distance:

```
d_total = v × t_pipeline + v² / (2g(μ + G))
```

where v = velocity, t_pipeline = sensor-to-actuator latency, g = 9.81 m/s², μ = tire-road friction coefficient, G = road gradient.

| Key Reference | Author(s) | Year | Contribution |
|---|---|---|---|
| Highway design standard | AASHTO, *A Policy on Geometric Design of Highways and Streets* ("Green Book") | Various | Standard stopping sight distance formulas used in road design |
| Vehicle dynamics | Thomas D. Gillespie, *Fundamentals of Vehicle Dynamics*, SAE R-114 | 1992 | Braking dynamics including weight transfer, ABS, friction-slip relationship |
| Tire force modeling (Magic Formula) | Hans B. Pacejka, *Tire and Vehicle Dynamics*, Elsevier | 2002/2012 | Nonlinear tire force model: F = D·sin(C·arctan(Bx - E(Bx - arctan(Bx)))); captures peak friction and tire saturation |
| Vehicle dynamics & control | Rajesh Rajamani, *Vehicle Dynamics and Control*, Springer | 2006/2011 | Bridge between physics models and control algorithms for autonomous braking |

The CAS dynamically computes threshold distance at each control cycle incorporating: current velocity, estimated friction coefficient (dry asphalt μ≈0.7-0.8; wet μ≈0.3-0.5; ice μ≈0.1-0.2), road gradient from map/IMU, brake system response time, and computational pipeline latency. If an obstacle falls within the stopping distance horizon, the state machine escalates.

##### E. Summary: Theoretical Lineage

| CAS Component | Primary Theoretical Foundations | Key Seminal Works |
|---|---|---|
| **Dual-system architecture** | N-version programming, Simplex architecture, design diversity | Avizienis 1985; Sha 2001; Knight & Leveson 1986 |
| **ASIL-D certification approach** | ASIL decomposition, dissimilar redundancy | ISO 26262; Koopman & Wagner 2016 |
| **Interpretability requirement** | NP-completeness of NN verification | Katz et al. 2017 (Reluplex) |
| **Ground profile fitting** | B-spline theory, Cox-de Boor recursion | Schoenberg 1946; de Boor 1972/1978 |
| **Asymmetric loss** | LINEX loss, Bayesian asymmetric estimation | Varian 1975; Zellner 1986 |
| **Robust estimation** | M-estimators, breakdown point theory | Huber 1964; Hampel |
| **Outlier rejection** | Random Sample Consensus | Fischler & Bolles 1981 |
| **Object tracking (unimodal)** | Kalman filter, Extended Kalman Filter | Kalman 1960; Schmidt (Apollo) |
| **Object tracking (multi-modal)** | Particle filters / Sequential Monte Carlo | Gordon, Salmond & Smith 1993; Isard & Blake 1998 |
| **Ground removal** | PCA / eigenvalue decomposition on voxelized LiDAR | Pearson 1901; Zermas et al. 2017 |
| **Short-horizon prediction** | Constant velocity models, bias-variance tradeoff | Scholler et al. 2020; Singer 1970 |
| **Spatial indexing** | Voxel grids, octrees | Meagher 1982; Rusu & Cousins 2011 |
| **Collision detection** | Oriented bounding boxes, Separating Axis Theorem | Gottschalk et al. 1996; Minkowski c.1911 |
| **Buffer zones** | Minkowski sums, mathematical morphology | Serra 1982; Lozano-Perez 1983 |
| **Probabilistic collision checking** | Monte Carlo methods, chance constraints | Metropolis & Ulam 1949; Blackmore et al. 2011 |
| **Cost-based planning** | Artificial potential fields, navigation functions | Khatib 1986; Rimon & Koditschek 1992 |
| **Safety state machine** | Safety interlocks, formal verification | DO-178C; ISO 26262; IEC 61508 |
| **Stopping distance** | Vehicle dynamics, tire force models | Gillespie 1992; Pacejka 2002 |
| **Formal safety model** | Responsibility-Sensitive Safety | Shalev-Shwartz et al. 2017 |
| **Functional limitation safety** | SOTIF | ISO 21448:2022 |

**Unifying principle:** Every CAS technique is chosen for **determinism, verifiability, and bounded behavior** — properties that enable formal safety argumentation. Where the Main AI trades interpretability for performance (deep learning), the CAS trades performance for certifiability (geometric/analytic methods). The two systems together cover the safety landscape that neither could address alone: the Main AI handles SOTIF's "unknown safe" scenarios through generalization, while the CAS handles "unknown unsafe" scenarios through formally verifiable safety constraints.

### System 3: Safety Net

| Attribute | Detail |
|---|---|
| **Type** | Separate ML algorithm (architecturally distinct from System 1) |
| **Coverage** | 360 degrees (unlike System 2 which focuses on intended driving path) |
| **Function** | Detection + short-horizon prediction |
| **Trigger** | Emergency stop when collision probability exceeds threshold |
| **Independence** | Bug in System 1 unlikely to affect System 3 |

**Design rationale:** Architectural diversity prevents common-cause failures. Systems 2 + 3 together form the Collision Avoidance System (CAS), parallel to the main AI stack. System 2 provides fast, interpretable geometric checking along the planned path, while System 3 provides ML-based 360-degree coverage as a final safety net.

**Degradation handling:** If a sensor degrades (debris, damage), diagnostics can activate cleaning systems or switch from bidirectional to unidirectional mode, placing the degraded sensor where it matters least.

---

## Published Neural Network Architectures

### PointFusion (CVPR 2018)

*"PointFusion: Deep Sensor Fusion for 3D Bounding Box Estimation"* — Danfei Xu, Dragomir Anguelov (Zoox), Ashesh Jain.

| Component | Architecture |
|---|---|
| **Image branch** | CNN for RGB feature extraction from cropped patches |
| **Point cloud branch** | PointNet variant for unordered 3D point sets |
| **Fusion** | Novel fusion network combining both streams |
| **Output** | Multiple 3D bounding box hypotheses with confidence scores |
| **Key innovation** | Dense fusion — per-point spatial offsets using 3D points as spatial anchors |
| **Evaluation** | KITTI (outdoor) + SUN-RGBD (indoor); dataset-agnostic |

### FISHING Net (CVPRW 2020)

*"FISHING Net: Future Inference of Semantic Heatmaps In Grids"* — Zoox's published BEV architecture.

**Core design:** Ensemble of per-modality networks, each producing a common **top-down BEV semantic grid**.

#### Per-Modality Network Design

**LiDAR Branch (8 input channels):**
1. Binary occupancy
2. Log-normalized LiDAR density
3. Maximum z-value
4. Sliced max z in 0.5m intervals from 0–2.5m (5 channels)
- Architecture: **U-Net encoder-decoder with skip connections**

**Radar Branch (6 input channels):**
1. Binary occupancy
2. Motion-compensated Doppler velocity (X, Y)
3. Radar cross section (RCS)
4. Signal-to-noise ratio (SNR)
5. Ambiguous Doppler interval
- Architecture: **U-Net encoder-decoder with skip connections**

**Camera Branch:**
- **MLP-based view transformation** (similar to VPN) to lift perspective images into BEV
- Single orthogonal feature transform, **without** skip connections

#### BEV Grid Specs

| Attribute | Detail |
|---|---|
| **Resolution** | 10 cm/pixel and 20 cm/pixel |
| **Semantic classes** | VRU (pedestrians, cyclists, motorists), cars, background |
| **Priority pooling** | VRU > cars > background |
| **Temporal input** | 5 historical frames |
| **Temporal output** | 5 future frames (deterministic BEV prediction) |
| **Fusion** | Late fusion at BEV level (each modality produces independent BEV, then combined) |

### Scenario Diffusion (NeurIPS 2023)

*"Scenario Diffusion: Controllable Driving Scenario Generation With Diffusion"* — Ethan Pronovost, Kai Wang (Zoox).

| Component | Detail |
|---|---|
| **Architecture** | Autoencoder + latent diffusion model |
| **Input** | BEV renderings of map and entities |
| **Output** | Sparse bounding box detections with trajectories |
| **Agent representation** | Feature vector: dimensions, orientation, trajectory |
| **Temporal window** | 2 sec past + 2 sec future per agent |
| **Controllable tokens** | Agent tokens (individual) + global scene tokens (traffic density) |
| **Generation speed** | ~1 second per scenario on a single GPU |
| **Training data** | Millions of driving scenarios (public + proprietary) |

---

## Next-Gen Unified Perception Model

Based on Zoox job postings (Sensor Fusion Detection team), the **next-generation architecture** unifies multiple representations:

### Input Representations

The model **unifies two LiDAR representations into one architecture**:
- **PixelSpace Range View** — native 2D projection of LiDAR scan (dense, preserves sensor resolution)
- **VoxelSpace** — 3D volumetric discretization of the point cloud

Additional inputs:
- Multi-frame temporal LiDAR point clouds
- Multi-frame temporal radar point clouds
- Multi-view camera images
- **Language and audio** inputs

### Tokenization

Zoox develops **effective tokenization techniques for Vision, LiDAR, and Radar modalities**, using **LLM techniques to align token embeddings across modalities into a common feature space**.

### Multi-Task Outputs

All produced simultaneously from a single model:
- 3D object detection (bounding boxes + velocity)
- 3D panoptic segmentation (instance + semantic contours)
- Occlusion estimation
- Occupancy prediction
- Scene flow (per-point/per-voxel motion vectors)
- Object attributes (classification, dimensions, heading)

### Efficiency

Exploits **sensor data sparsity** to reduce training/inference latency, enabling higher-resolution image consumption and increased detection range.

---

## Perception Outputs & BEV Representation

### Raw Perception Outputs

| Output | Description |
|---|---|
| **3D bounding boxes** | Position, dimensions, heading for every agent |
| **Velocity vectors** | Per-agent current motion |
| **Classification** | Vehicle type, pedestrian attributes (e.g., "holding smartphone") |
| **Tracking IDs** | Persistent identity across frames |
| **Semantic segmentation** | Per-point/per-pixel class labels |
| **Occupancy estimation** | Volumetric presence/absence |
| **Dense depth** | Per-pixel depth maps |

### The ~60-Channel BEV Representation

This is the **critical bridge between perception and prediction**. Before data reaches prediction, perception outputs are "instantly boiled down to their essentials, into a format optimized for machine learning."

| Attribute | Detail |
|---|---|
| **Format** | Top-down, spatially accurate bird's-eye-view image |
| **Center** | Ego vehicle (robotaxi) |
| **Channels** | ~60 semantic layers |
| **Example channels** | Agent bounding boxes, agent headings, velocity vectors, pedestrian attributes (phone=1), ZRN static infrastructure, lane geometry, road boundaries, traffic signal states, crosswalk status |

Each agent appears as a bounding box with heading, trajectory, and velocity within this multi-channel image. The ~60 channels provide the CNN with rich semantic context about every entity.

---

## Perception → Prediction Interface

### Data Flow

```
3D Perception outputs + ZRN semantic map
                ↓
    ~60-channel BEV rasterization
    (agent bboxes, headings, velocities,
     attributes, roads, signals, lanes...)
                ↓
        Prediction Module
                ↓
    Weighted trajectory distributions
    per agent (8s horizon, 10 Hz)
                ↓
        Planning Module
    (bidirectional feedback loop)
```

### ZRN Integration

The Zoox Road Network provides the static context layer:
- Speed limits, traffic lights, stop signs, lane markings
- Bike lanes, crosswalks, keep-clear zones, one-way streets
- **ZRN Monitor** detects real-time divergences from the map
- Localization at **200 Hz**, **centimeter accuracy**, sub-degree heading

---

## Prediction Architecture (CNN + GNN)

### CNN Stage

The ~60-channel BEV image feeds a **convolutional neural network** that:
- Extracts spatial features and relationships
- "Determines what distances matter, what relationships between agents matter"

### GNN Stage (Graph Neural Network)

On top of CNN features, a **message-passing GNN**:
- All agents and static elements interconnected as graph nodes
- **Explicit encoding of inter-agent relationships**
- Models how relationships develop temporally
- Produces "prediction of more natural behaviors between agents"

### Prediction Evolution: UAP → QTP

| Generation | Architecture | Limitation/Improvement |
|---|---|---|
| **UAP** (Unified Active Prediction) | Graph-based neural network | "Had trouble modeling unexpected outcomes like jaywalkers or illegal U-turns" |
| **QTP** (Query-centric Trajectory Prediction) | Query-centric paradigm (related to QCNet, CVPR 2023) | Data-driven behavior modeling without hand-crafted assumptions |

**QTP Key Features:**
- Scene encoding independent of global spacetime coordinates → enables **reuse of past computations**
- **Streaming scene encoding** + **parallel multi-agent decoding**
- **Anchor-free queries** for recurrent trajectory proposals at different horizons
- **Refinement module** using anchor-based queries
- Ranked **#1 on Argoverse 1 and Argoverse 2** motion forecasting benchmarks

### Prediction Specs

| Attribute | Detail |
|---|---|
| **Horizon** | Up to **8 seconds** |
| **Update rate** | **10 Hz** (every 100 ms) |
| **Output** | Probability distribution of trajectories per agent |
| **Coverage** | Trucks, cars, pedestrians, cyclists, animals |
| **Training** | Self-supervised: real future trajectories as ground truth (no manual labels) |

### Prediction-Planning Feedback Loop

The planner queries prediction with **conditional requests**:
- "If I perform action X, Y, or Z, how do agents react?"
- Creates **closed-loop feedback** between planning and prediction
- Enables **contingency-aware planning** that accounts for ego influence on the scene

---

## Vision-Language-Action Foundation Model

Disclosed at AWS re:Invent 2025, this represents a **paradigm shift** that collapses the modular perception→prediction→planning boundary.

### Architecture

| Attribute | Detail |
|---|---|
| **Core** | Large Language Model |
| **Base model** | Qwen 2/3 VL (vision-language model) |
| **Parameter sizes** | 400M → 7B → 32B (in development) |

### Inputs

- Text prompts (e.g., "You are the driver of a Zoox robotaxi, what should you do...")
- Camera/video through pre-trained vision encoders with projection layers
- Encoded LiDAR projected into LLM token space
- Encoded radar projected into LLM token space
- Existing perception stack outputs (3D bounding boxes)

### Outputs

- Robotic controls (acceleration, braking, steering)
- 3D object detections
- Visual question answering
- Scene descriptions / chain-of-thought reasoning

### Three-Stage Training

| Stage | Method | Data |
|---|---|---|
| **1** | Large-scale supervised fine-tuning (behavior cloning) | Tens of thousands of hours of human driving; millions of 3D detection labels |
| **2** | High-quality SFT | Rare objects, difficult scenarios, synthetic chain-of-thought |
| **3** | Reinforcement learning (GRPO + DAPO) | Hardest scenarios |

### Impact on Perception-Prediction Boundary

The foundation model **collapses the traditional modular boundary**:
- Instead of separate modules with the ~60-channel BEV handoff
- Processes raw sensor data **end-to-end**
- Outputs both 3D detections (traditionally perception) AND robotic controls (traditionally planning)
- Potentially subsumes prediction entirely within internal representations

### Zero-Shot Goal

Handle long-tail edge cases (jaywalkers, tanks, construction flaggers, fire hoses, animals, unusual vehicles) on **first encounter** without prior training examples.

---

## Inference & On-Vehicle Compute

### Hardware — NVIDIA DRIVE PX Pegasus (Dual Redundant)

| Component | Detail |
|---|---|
| **Platform** | 2× NVIDIA DRIVE PX Pegasus boards (full redundancy) |
| **Per-board performance** | >320 TOPS |
| **Per-board SoCs** | 2× Xavier SoCs (30 TOPS each, octa-core ARM + Volta GPU) + 2× discrete GPUs (~130 TOPS each) |
| **Per-board TDP** | 500W |
| **Memory bandwidth** | >1 TB/s combined per board |
| **Sensor inputs** | 16 dedicated high-speed inputs per board (camera/radar/LiDAR/ultrasonics) |
| **Connectivity** | CAN, FlexRay, multiple 10 GbE |
| **Safety certification** | Designed for ASIL D |
| **CPUs** | 4× Intel Xeon processors (additional to Pegasus) |
| **Redundancy** | Dual mirrored systems with cross-verified logic domains |
| **Data rate** | ~4 TB/hour of raw sensor data per vehicle |
| **Upload** | Hardwired AWS Data Transfer Terminals, up to 400 Gbps |

### Inference Performance

| Metric | Value |
|---|---|
| **Forward pass** (Inception-class network) | **1.767 ms** |
| **TensorRT speedup vs TensorFlow (FP32)** | **2–6×** |
| **TensorRT speedup vs TensorFlow (INT8)** | **9–19×** |
| **Precision modes** | FP32, FP16, INT8 (quantized) |
| **Execution** | Asynchronous and concurrent via CUDA streams |

### TensorRT Deployment Pipeline (4-Stage Validation)

Zoox uses a rigorous 4-stage process for deploying ML models via TensorRT on-vehicle:

| Stage | Description |
|---|---|
| **1. Conversion Checker** | Validates that the PyTorch → ONNX → TensorRT conversion succeeds without errors |
| **2. Output Deviation** | Compares TensorRT outputs against PyTorch reference on identical inputs; flags numerical drift |
| **3. Layer-by-Layer Inspection** | Traces precision loss to individual layers; decides per-layer FP32/FP16/INT8 mixed-precision config |
| **4. Maintenance** | Continuous monitoring in production; regression checks when TensorRT or driver versions update |

### Transformer Efficiency Techniques

For deploying transformer-based models (DINO decoder, VLA) on embedded NVIDIA hardware:

- **Token pruning** — drops low-attention tokens mid-inference to reduce compute
- **Token merging** — combines similar tokens to shrink sequence length without losing semantic content
- **Mixed-precision per-layer** — critical layers stay FP32, others quantized to FP16/INT8

### Deployment Stack

| Context | Tool |
|---|---|
| **On-vehicle production** | NVIDIA TensorRT (with 4-stage validation pipeline) |
| **On-vehicle VLA (in development)** | TensorRT-LLM |
| **Cloud offline** | vLLM |
| **Cloud batch** | Amazon EKS + Ray Serve |
| **Monitoring dashboards** | Looker, Grafana, Databricks |

---

## Training Infrastructure

### Cloud (AWS)

| Resource | Detail |
|---|---|
| **GPU instances** | P5 (H100), P6N |
| **Cluster orchestration** | SageMaker HyperPod (auto-recovery, health checks) |
| **Cluster size** | 500+ nodes, 64+ GPUs per training job |
| **Networking** | EFA at 3,200 Gbps/node (RDMA-enabled) |
| **GPU utilization** | 95% achieved |
| **Scaling** | Near-linear across multi-node |
| **Storage** | S3 (tens of PB active, ~1 EB cold), FSx for Lustre, EFS |

### On-Premises

| Resource | Detail |
|---|---|
| **GPUs** | Thousands of NVIDIA GPUs |
| **Storage** | Quobyte parallel filesystem — 3 clusters, 30 PB |
| **Previous** | Migrated from Ceph (performance/reliability issues) |
| **Tiering** | SSD → disk → cloud |

### Training Configuration

| Parameter | Detail |
|---|---|
| **Framework** | PyTorch (primary), JAX |
| **Distributed training** | HSDP + FSDP + DDP + tensor parallelism |
| **Precision** | BF16 with gradient checkpointing |
| **Optimization** | torch.compile |
| **Data loading** | Mosaic Data Streaming (MDS) — deterministic, resumable, mid-epoch |
| **Training cadence** | ~every 2 weeks |
| **Job duration** | 2–3 days per run |
| **Data pipeline** | Medallion architecture on S3 with Delta tables + Apache Spark |
| **Orchestration** | Apache Airflow |
| **Experiment tracking** | Comet ML |

### Annotation & Labeling

| Approach | Detail |
|---|---|
| **Platform** | **Dataloop** (external vendor) with custom integrations |
| **Auto-labeling** | ML-assisted algorithms reduce manual burden |
| **Embedding indexes** | CLIP-based embedding indexes for similarity search across driving scenarios |
| **Active learning** | Automated mining of high-uncertainty frames for human review |
| **Self-supervised** | Prediction uses actual future trajectories as ground truth |
| **Ground truth** | 3D bounding box annotations for BEV tasks |
| **Human labeling** | Dedicated Perception Labeling & Tools team with web-based tools |
| **Web tools** | React/Angular/Vue frontends + FastAPI/Django backends |

### Synthetic Data

| Method | Detail |
|---|---|
| **Scenario Diffusion** | Latent diffusion model; ~1 sec/scenario on single GPU |
| **3D Sensor Simulation** | GenAI/ML + modern 3D graphics to simulate cameras, LiDAR, radar |
| **Neural rendering** | Gaussian Splatting, NeRFs for 3D reconstruction |
| **Procedural worlds** | Houdini for world creation |

---

## Perception Team Organization

| Sub-Team | Focus |
|---|---|
| **Object Detection & Tracking** | All people and objects capable of moving |
| **Occupancy & Rare Events** | Foundation models as perception backbone; long-tail detection; generalization to new geofences |
| **Perception Attributes** | Vehicle classification, semantic enrichment, real-time inference |
| **Scene Understanding** | Advanced ML for hazard identification |
| **Perception Optimization** | Optimized inference pipelines for on-vehicle algorithms |
| **Perception Labeling & Tools** | Internal labeling platforms, auto-labeling |
| **Sensor Fusion Detection** | Next-gen unified multi-representation model |
| **CAS (Collision Avoidance)** | Geometric + ML parallel safety system |

**Director of Perception:** Bat-El Shlomo. Also Ruijie He (from Strio.AI acquisition, Boston).

**Locations:** Foster City (HQ), San Francisco, Boston, San Diego.

---

## Competitive Analysis

### Zoox vs Industry Perception Approaches

| Dimension | Zoox | Waymo | Tesla | Cruise | Aurora | Pony.ai |
|---|---|---|---|---|---|---|
| **Fusion strategy** | Early fusion (CVPR 2025) — perspective-view PointPillar + YoloXPAFPN | LEF (Learned Early Fusion) + PVTransformer | N/A (camera-only) | Mid-level fusion | S2A (Sensor-to-Autonomy) end-to-end | Undisclosed multi-sensor |
| **LiDAR representation** | Unified range view + voxel (next-gen) | VoxelNet, PointPillars (published) | None | Standard voxel | Range view → learned features | Voxel-based |
| **Sensor modalities** | 5 (camera, LiDAR, radar, LWIR, mics) | 4 (camera, LiDAR, radar, audio) | 1 (camera only) | 3 (camera, LiDAR, radar) | 3 (camera, LiDAR, radar) | 4 (camera, LiDAR, radar, mics) |
| **Sensor count** | ~64 (14 cam, 20 radar, 8 LiDAR, LWIR, mics) | ~40 (29 cam, 6 LiDAR, 4 radar) | 12 cameras | ~40 (camera, LiDAR, radar) | ~40 | Gen-7: 12 cam, 8 LiDAR, 6 radar |
| **LWIR thermal** | Yes (only AV company) | No | No | No | No | No |
| **Redundant perception** | Triple (AI + geometric + safety net) | Dual | Single | Dual | Dual | Dual |
| **Detection head** | DINO (DETR-based) | Custom transformer | Occupancy networks | Custom | End-to-end learned | Custom |
| **Staleness handling** | Published CVPR 2025 solution | Not published | N/A | Not published | Not published | Not published |
| **BEV representation** | ~60-channel semantic grid | Similar concept | Occupancy networks | Similar concept | Learned latent BEV | Similar concept |
| **Prediction** | QTP (ranked #1 Argoverse 1 & 2) | Custom motion forecasting | Neural net planner | Custom | Joint perception-prediction | Custom |
| **Vehicle advantage** | Purpose-built → optimal sensor placement | Retrofit → compromised placement | Consumer vehicle | Retrofit → compromised | Retrofit (trucks + passenger) | Retrofit |

### Key Competitive Differentiators by Company

**Waymo (LEF + PVTransformer):** Uses Learned Early Fusion to combine LiDAR range images with camera features before the backbone, and PVTransformer for cross-attention between perspective and voxel features. Most similar to Zoox's approach philosophically (early fusion), but Zoox's frustum-based PointPillar approach is architecturally distinct.

**Aurora (S2A):** Sensor-to-Autonomy is the most ambitious end-to-end approach in the industry — a single neural network from raw sensor input to driving commands. Focuses on trucking (Aurora Driver for trucks) but expanding to passenger vehicles.

**Motional:** Uses point-painting (projecting semantic labels from camera onto LiDAR points before 3D detection) — a simpler fusion approach than Zoox's joint backbone fusion.

**Pony.ai Gen-7:** Latest platform with 12 cameras, 8 LiDARs, 6 radars. Competing in China and US markets with a sensor suite approaching Zoox's density.

### Zoox's Unique Advantages

1. **Only AV company using LWIR thermal cameras** — critical for pedestrian detection in darkness/glare
2. **Triple-redundant perception** with architectural diversity
3. **Purpose-built vehicle** enables optimal sensor pod geometry
4. **Published CVPR 2025 staleness solution** — quantified robustness gains
5. **Unified next-gen model** consuming language + audio alongside traditional AV modalities
6. **QTP prediction ranked #1** on major public benchmarks
7. **Foundation model approach** collapsing perception/prediction/planning boundaries

---

## What Remains Undisclosed

- Exact **latency budget allocation** across perception/prediction/planning pipeline
- Exact **CAS latency** in milliseconds (confirmed "optimized for low-latency" but no specific ms figure)
- Exact **CAS update rate in Hz** (Main AI prediction is 10 Hz; CAS likely same or higher)
- Exact **perception update rate in Hz** (only 10 Hz prediction confirmed)
- Precise **BEV channel definitions** beyond ~60 count and examples
- Specific **CNN architecture** for BEV processing (layers, kernels, feature dims)
- Specific **GNN architecture** (message-passing rounds, edge/node feature dims)
- Exact **GPU model** on-vehicle (confirmed NVIDIA DRIVE, not which SoC)
- Exact **LWIR thermal camera count** (RGB cameras: 14, LiDAR: 8, radar: 20 now confirmed)
- **Occupancy grid resolution and update rate**
- **Joint perception-prediction training** details in modular stack
- Whether **LWIR feeds into the early fusion pipeline** alongside camera/LiDAR/radar, or is processed separately
- **Safety Net architecture** specifics (network type, parameters, latency)
- Specific **collision detection algorithm** used in CAS (SAT, GJK, or custom — patents describe bounding box overlap but not the implementation algorithm)
- **CAS intervention statistics** (interventions per mile, false positive rate)
- Whether **CAS checks static map boundaries** via ZRN polygon intersection or only sensor-detected obstacles

---

## Sources

### Zoox Official
- [Going beyond seeing to perceiving — Zoox Journal](https://zoox.com/journal/perception)
- [How Zoox uses prediction and gen AI simulations](https://zoox.com/journal/prediction-ai-technology)
- [Every journey needs a plan — Zoox Planner](https://zoox.com/journal/planner)
- [How Zoox drives autonomously](https://zoox.com/journal/how-zoox-drives-autonomously/)
- [A to Zoox](https://zoox.com/journal/atozoox)
- [Zoox Autonomy Page](https://zoox.com/autonomy/)
- [Zoox Safety Report Volume 3.0 (2024)](https://www.datocms-assets.com/106048/1725671135-zoox_safety_report_volume3_2024.pdf)
- [Zoox Safety Report Volume 2.0 (2021)](https://www.datocms-assets.com/106048/1696536139-zoox_safety_report_volume2_2021_v2.pdf)

### Research Papers
- [Robust sensor fusion against on-vehicle sensor staleness (arXiv 2506.05780, CVPR 2025)](https://arxiv.org/html/2506.05780)
- [PointFusion: Deep Sensor Fusion for 3D Bounding Box Estimation (CVPR 2018)](https://arxiv.org/abs/1711.10871)
- [FISHING Net: Future Inference of Semantic Heatmaps In Grids (CVPRW 2020)](https://openaccess.thecvf.com/CVPR2020_workshops)
- [Scenario Diffusion: Controllable Driving Scenario Generation (NeurIPS 2023)](https://proceedings.neurips.cc/paper_files/paper/2023/file/d95cb79a3421e6d9b6c9a9008c4d07c5-Paper-Conference.pdf)
- [Query-Centric Trajectory Prediction / QCNet (CVPR 2023)](https://openaccess.thecvf.com/content/CVPR2023/papers/Zhou_Query-Centric_Trajectory_Prediction_CVPR_2023_paper.pdf)

### Amazon Science
- [How the Zoox robotaxi predicts everything](https://www.amazon.science/latest-news/how-the-zoox-robotaxi-predicts-everything-everywhere-all-at-once)
- [How Zoox vehicles find themselves](https://www.amazon.science/latest-news/how-zoox-vehicles-find-themselves-in-an-ever-changing-world)
- [Scenario Diffusion blog](https://www.amazon.science/blog/scenario-diffusion-helps-zoox-vehicles-navigate-safety-critical-situations)

### NVIDIA & Compute
- [NVIDIA and Zoox Pave the Way](https://blogs.nvidia.com/blog/nvidia-zoox-autonomous-ride-hailing/)
- [Optimizing TensorRT for Real-time AV Inference](https://developer.nvidia.com/blog/optimizing-nvidia-tensorrt-conversion-for-real-time-inference-on-autonomous-vehicles/)
- [AWS re:Invent 2025 AMZ304](https://dev.to/kazuya_dev/aws-reinvent-2025-zoox-building-machine-learning-infrastructure-for-autonomous-vehicles-amz304-32o8)

### CAS & Collision Avoidance Patents
- [US20200211394 — Collision Avoidance System (dual-system architecture)](https://www.freepatentsonline.com/y2020/0211394.html)
- [US11500385B2 — Collision Avoidance Perception System (spline ground modeling)](https://patents.google.com/patent/US11500385B2/en)
- [EP4037946A1 — Complex Ground Profile Estimation (NURBS fitting)](https://patents.google.com/patent/EP4037946A1/en)
- [US20200398833 — Dynamic Collision Checking (convex polygon buffer regions)](https://uspto.report/patent/app/20200398833)
- [US20210370921A1 — Perturbed Object Trajectories (probabilistic collision)](https://patents.google.com/patent/US20210370921A1/en)
- [US20200139959 — Cost Scaling in Trajectory Generation](https://www.freepatentsonline.com/y2020/0139959.html)
- [US20240094009A1 — Map Annotation Modification (polygon mesh for map surfaces)](https://patents.google.com/patent/US20240094009A1)
- [US10535138 — Sensor Data Segmentation](https://uspto.report/patent/grant/10,535,138)
- [Zoox Patents on Justia](https://patents.justia.com/assignee/zoox-inc)
- [Zoox Robotaxi Patents Overview (GreyB)](https://insights.greyb.com/zoox-robotaxi-patents/)

### Sensor Hardware
- [FLIR to Provide Thermal Cameras for Zoox](https://oem.flir.com/about/news/flir-to-provide-thermal-imaging-cameras-for-zoox-robotaxi/)
- [FLIR ADK Specifications](https://www.wevolver.com/specs/flir.adk)
- [Hesai Partnership with Zoox](https://www.hesaitech.com/announcing-our-partnership-with-zoox/)
- [Zoox Radars in Autonomy](https://www.autonomousvehicleinternational.com/features/feature-zoox-radars-in-autonomy-current-landscape-challenges-and-the-future.html)
- [Radar Velocity Disambiguation Patent (US 2019/0391250)](https://www.freepatentsonline.com/y2019/0391250.html)

### Infrastructure
- [Quobyte + Zoox](https://blocksandfiles.com/2025/07/01/quobyte-zoox-robotaxi-training/)
- [Zoox AWS Case Study](https://aws.amazon.com/solutions/case-studies/zoox/)

### Safety & Recalls
- [TechCrunch — Zoox Braking Recall (March 2025)](https://techcrunch.com/2025/03/19/zoox-recalls-258-self-driving-cars-over-unexpected-braking/)
- [TechCrunch — Zoox Lane Crossing Recall (December 2025)](https://techcrunch.com/2025/12/23/zoox-issues-software-recall-over-lane-crossings/)
- [NHTSA Recall Report 25E-029](https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E029-4731.PDF)
- [TechCrunch — How Zoox Prevents Crashes](https://techcrunch.com/2021/06/22/how-amazon-owned-zoox-designed-its-self-driving-vehicles-to-prevent-crashes-and-protect-if-they-do/)
- [Zoox Safety Page](https://zoox.com/safety)

### Job Postings
- [Sensor Fusion Detection Intern](https://www.builtinsf.com/job/software-engineer-internshipco-op-3d-vision-1/2051566)
- [Perception ML Engineer Intern](https://jobs.lever.co/zoox/9b3ab3ee-b130-49b6-8413-7d8fd9c33ed3)
- [Senior ML Engineer — Perception Labeling](https://www.builtinsf.com/job/senior-machine-learning-engineer-perception-labeling/6286620)
- [Director, CAS](https://jobs.lever.co/zoox/7e845716-4dbe-4be5-adcb-37c3ae5cdaa3)
- [Senior SWE — CAS Motion Planning](https://jobs.lever.co/zoox/2cb20f08-8f89-47c7-88b6-3068056b4363)
- [ML Engineer — CAS](https://zoox.com/careers/aacead0e-8309-48ca-af2c-813d084f6233)

---

*Compiled from 10 parallel research agents scanning 100+ sources including CVPR/NeurIPS papers, arXiv preprints, Zoox Safety Reports, patent filings, sensor datasheets, job postings, and conference talks. Updated with corrected sensor counts, deployment pipeline details, and comprehensive CAS/geometric collision avoidance deep dive from 8 Zoox patents covering corridor analysis, polygon collision detection, trajectory hierarchy, and dynamic vs. static object handling.*
