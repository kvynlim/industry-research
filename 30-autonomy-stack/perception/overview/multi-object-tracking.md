# Multi-Object Tracking (MOT) for LiDAR-Primary Airside Autonomous Vehicles

## Comprehensive Technical Survey (2021-2026) for Airport Ground Operations

---

## Table of Contents

1. [Introduction: Why MOT Matters for Airside](#1-introduction)
2. [3D MOT Fundamentals](#2-3d-mot-fundamentals)
3. [LiDAR-Based 3D MOT Methods (SOTA 2021-2026)](#3-lidar-based-3d-mot-methods)
4. [Camera-LiDAR Fusion Tracking](#4-camera-lidar-fusion-tracking)
5. [Airside-Specific Tracking Challenges](#5-airside-specific-tracking-challenges)
6. [Tracking Metrics](#6-tracking-metrics)
7. [ROS Integration](#7-ros-integration)
8. [Deployment on NVIDIA Orin](#8-deployment-on-nvidia-orin)
9. [Comparison Table](#9-comparison-table)
10. [Recommended Architecture for Airside](#10-recommended-architecture-for-airside)
11. [References](#11-references)

---

## 1. Introduction: Why MOT Matters for Airside {#1-introduction}

Multi-object tracking (MOT) is the perception subsystem that assigns persistent identities to detected objects across time. For airport airside autonomous vehicles, MOT is not optional -- it is the bridge between raw detection and every downstream module that needs temporal context: motion prediction, path planning, collision avoidance, and fleet coordination.

### 1.1 The Airside Tracking Problem

Airport aprons present a uniquely challenging tracking environment:

| Challenge | Road Driving | Airport Airside |
|-----------|-------------|-----------------|
| Object size range | Cars 4-5m, trucks 8-12m | Personnel 0.5m, baggage carts 3m, A380 wingspan 79.8m |
| Speed range | 30-130 km/h | Pushback 1-3 km/h, taxiing 15-30 km/h, tugs 5-25 km/h |
| Object density | 10-50 objects in urban scenes | 5-30 objects per stand, but clustered tightly around aircraft |
| Occlusion patterns | Vehicle-to-vehicle | Aircraft fuselage creates massive 30-65m blind zones |
| Identity requirements | Class + track ID | Class + track ID + tail number + flight + GSE fleet ID |
| Interaction modeling | Lane-following vehicles | Tractor-aircraft coupling, belt loader-cargo door alignment |

### 1.2 What Goes Wrong Without Tracking

Without robust MOT, an airside AV faces critical failures:

- **Phantom braking**: A detected baggage cart that disappears behind the fuselage for 3 seconds and reappears is seen as two different objects -- the planner brakes for the "new" detection.
- **Collision with occluded crew**: Ground crew walk behind the nose gear, vanish from LiDAR for 5-8 frames, and reappear in the vehicle's path. Without track prediction, the planner has no model of their continued existence.
- **Incorrect interaction modeling**: A tractor backing toward aircraft must be understood as a single persistent entity on a known trajectory, not a series of independent detections drifting toward the aircraft.
- **Fleet dispatch failures**: If the system cannot maintain stable identities across frames, it cannot report "Tug #47 is at Stand B12" to the fleet management system.

### 1.3 Scope of This Document

This document covers 3D multi-object tracking for autonomous vehicles, with emphasis on:
- LiDAR-primary methods (matching the reference airside AV stack's 4-8 RoboSense sensor stack)
- Real-time deployment on NVIDIA Jetson AGX Orin (275 TOPS)
- Practical ROS 1 (Noetic) integration with nodelet architecture
- Airside-specific adaptations for aircraft, GSE, and personnel tracking

---

## 2. 3D MOT Fundamentals {#2-3d-mot-fundamentals}

### 2.1 Tracking-by-Detection Paradigm

Nearly all production 3D MOT systems follow the **tracking-by-detection** (TBD) paradigm:

```
Frame t:  Point Cloud -> 3D Detector -> Detections_t
                                              |
                                              v
          Tracks_{t-1} -> Motion Prediction -> Predicted_Tracks_t
                                              |
                                              v
                                        Data Association
                                        (Hungarian / Greedy)
                                              |
                                              v
                                        State Update (Kalman)
                                              |
                                              v
                                  Track Management (birth/death)
                                              |
                                              v
                                        Tracks_t -> Output
```

The pipeline decouples detection from association, allowing each component to be optimized independently. This is critical for deployment: the detector can be TensorRT-accelerated on GPU while the tracker runs on CPU at minimal cost.

### 2.2 State Representation

The standard 3D MOT state vector follows AB3DMOT's formulation, extended for airside use:

```python
# AB3DMOT state vector (11D):
# T = [x, y, z, theta, l, w, h, s, vx, vy, vz]
#
# where:
#   x, y, z    = 3D center position (world frame)
#   theta      = heading angle (yaw)
#   l, w, h    = bounding box dimensions (length, width, height)
#   s          = detection confidence score
#   vx, vy, vz = velocity components

# Extended state vector for airside GSE tracking (15D):
# T_airside = [x, y, z, theta, l, w, h, vx, vy, vz, ax, ay, omega, class_id, fleet_id]
#
# Additional fields:
#   ax, ay     = longitudinal and lateral acceleration
#   omega      = yaw rate (rad/s) -- critical for turning tugs
#   class_id   = semantic class (aircraft, tug, belt_loader, crew, ...)
#   fleet_id   = persistent fleet identifier (from Re-ID or ADS-B)
```

### 2.3 Kalman Filter for 3D Object Tracking

The Kalman filter remains the dominant motion model in production 3D MOT. For the constant-velocity (CV) model used by AB3DMOT, CenterPoint, and SimpleTrack:

```python
import numpy as np

class KalmanFilter3D:
    """
    Constant-velocity Kalman filter for 3D bounding box tracking.
    State: [x, y, z, theta, l, w, h, vx, vy, vz]  (10D)
    Measurement: [x, y, z, theta, l, w, h]  (7D)
    """
    def __init__(self, detection):
        # State vector: [x, y, z, theta, l, w, h, vx, vy, vz]
        self.x = np.zeros(10)
        self.x[:7] = detection[:7]  # Initialize position + box from detection

        # State transition matrix (constant velocity)
        dt = 0.1  # 10 Hz LiDAR
        self.F = np.eye(10)
        self.F[0, 7] = dt   # x += vx * dt
        self.F[1, 8] = dt   # y += vy * dt
        self.F[2, 9] = dt   # z += vz * dt

        # Measurement matrix (observe position + box, not velocity)
        self.H = np.zeros((7, 10))
        self.H[:7, :7] = np.eye(7)

        # Process noise covariance
        self.Q = np.eye(10)
        self.Q[7:, 7:] *= 0.01   # Low velocity process noise
        self.Q[:3, :3] *= 0.1    # Position uncertainty
        self.Q[3, 3] *= 0.01     # Heading uncertainty
        self.Q[4:7, 4:7] *= 0.01 # Size is nearly constant

        # Measurement noise covariance
        self.R = np.eye(7)
        self.R[:3, :3] *= 0.5    # Position measurement noise
        self.R[3, 3] *= 0.1      # Heading measurement noise
        self.R[4:7, 4:7] *= 0.1  # Size measurement noise

        # State covariance
        self.P = np.eye(10)
        self.P[7:, 7:] *= 100.0  # High initial velocity uncertainty

    def predict(self):
        """Predict next state."""
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q
        return self.x[:7]  # Return predicted measurement

    def update(self, measurement):
        """Update state with new measurement."""
        y = measurement - self.H @ self.x          # Innovation
        S = self.H @ self.P @ self.H.T + self.R    # Innovation covariance
        K = self.P @ self.H.T @ np.linalg.inv(S)   # Kalman gain
        self.x = self.x + K @ y                     # State update
        self.P = (np.eye(10) - K @ self.H) @ self.P # Covariance update
        return self.x[:7]
```

**Airside-specific tuning considerations:**

| Parameter | Road Driving Default | Airside Adaptation | Rationale |
|-----------|---------------------|-------------------|-----------|
| Position process noise | 0.1 m^2 | 0.05 m^2 | Lower speeds mean less position uncertainty |
| Velocity process noise | 0.01 m^2/s^2 | 0.005 m^2/s^2 | Vehicles accelerate more gradually |
| Heading process noise | 0.01 rad^2 | 0.05 rad^2 | Tugs with Ackermann+crab steering turn more aggressively |
| Size process noise | 0.01 m^2 | 0.001 m^2 | Size is constant for rigid vehicles and aircraft |
| dt (frame interval) | 0.1s (10 Hz) | 0.1s (10 Hz) | Standard LiDAR rate, but consider 20 Hz for crew tracking |

### 2.4 Hungarian Algorithm for Data Association

The Hungarian (Kuhn-Munkres) algorithm solves the optimal bipartite assignment between existing tracks and new detections:

```
HUNGARIAN_ASSIGNMENT(cost_matrix C, threshold tau):
    Input: C[N_tracks x M_detections] -- cost matrix (e.g., 3D IoU, center distance, GIoU)
           tau -- gating threshold (reject assignments above cost)

    1. For each row i in C:
       a. Subtract row minimum: C[i,:] -= min(C[i,:])

    2. For each column j in C:
       a. Subtract column minimum: C[:,j] -= min(C[:,j])

    3. Find minimum set of lines to cover all zeros:
       While num_covering_lines < min(N, M):
           a. Identify uncovered zeros
           b. Find minimum uncovered element
           c. Subtract from all uncovered elements
           d. Add to elements at line intersections

    4. Extract assignments from zero positions in reduced matrix

    5. Gate assignments:
       For each (track_i, detection_j) pair:
           If original_cost(track_i, detection_j) > tau:
               Mark track_i as unmatched
               Mark detection_j as unmatched

    Output: matched_pairs, unmatched_tracks, unmatched_detections
```

**Complexity**: O(n^3) for the standard Hungarian algorithm. For airside scenes with typically 5-30 objects per frame, this completes in <1 ms on CPU.

**Distance metrics commonly used:**

| Metric | Formula | Best For |
|--------|---------|----------|
| Center distance (L2) | sqrt((x1-x2)^2 + (y1-y2)^2 + (z1-z2)^2) | Fast baseline, works for well-separated objects |
| 3D IoU | Volume(intersection) / Volume(union) | Dense scenes with overlapping boxes |
| BEV IoU | Area(intersection) / Area(union) in BEV | Most common in practice; z-axis is noisy |
| GIoU | IoU - (Area(enclosing) - Area(union)) / Area(enclosing) | Handles non-overlapping boxes better than IoU |
| Mahalanobis distance | (d - mu)^T * S^{-1} * (d - mu) | Accounts for prediction uncertainty |

### 2.5 Track Lifecycle Management

Every MOT system must manage three lifecycle events:

1. **Track Birth**: A new detection not matched to any existing track. Typically requires `N_init` consecutive matches (usually 2-3 frames) before the track is confirmed.

2. **Track Dormancy**: A confirmed track fails to match any detection. The track continues via Kalman prediction only. After `T_max_age` frames without a match, it transitions to death.

3. **Track Death**: A dormant track exceeds the maximum prediction horizon. It is removed from the active track set.

**Critical design choice**: The dormancy-to-death threshold (`T_max_age`) dramatically affects tracking quality:

| T_max_age | Effect | Suitable For |
|-----------|--------|-------------|
| 3-5 frames (0.3-0.5s) | Fast cleanup, few ghost tracks | Dense urban driving |
| 10-20 frames (1-2s) | Tolerates brief occlusions | Highway, parking lots |
| 30-50 frames (3-5s) | Handles aircraft fuselage occlusion | **Airside operations** |
| "Never delete" (ImmortalTracker) | Maximum Re-ID, zero premature termination | Structured environments with known occlusion patterns |

---

## 3. LiDAR-Based 3D MOT Methods (SOTA 2021-2026) {#3-lidar-based-3d-mot-methods}

### 3.1 AB3DMOT -- The Classical Baseline (IROS 2020)

AB3DMOT established the canonical baseline for 3D MOT by combining the 3D Kalman filter with the Hungarian algorithm. Despite its simplicity, it remains surprisingly competitive.

**Architecture**: 3D Kalman filter (constant velocity) + Hungarian assignment with 3D IoU cost.

**State vector**: 11D -- [x, y, z, theta, l, w, h, s, vx, vy, vz]

**Key results**:
- KITTI Car: 83.84% MOTA (with PointRCNN detections)
- nuScenes: 17.87% AMOTA (limited by 2019-era detections)
- Speed: **207.4 FPS** on KITTI -- the fastest among all 3D MOT methods

**Why it matters**: AB3DMOT proved that a well-implemented classical pipeline is sufficient when the detector is strong. It runs entirely on CPU, adding negligible latency to the detection pipeline. For airside deployment, this is the natural starting point.

**Code**: https://github.com/xinshuoweng/AB3DMOT

### 3.2 CenterPoint Tracker (CVPR 2021)

CenterPoint's tracking module is even simpler than AB3DMOT -- it replaces the Hungarian algorithm with greedy closest-point matching on center locations, leveraging CenterPoint's built-in velocity estimation.

**Architecture**: Greedy matching by center distance + velocity-predicted position.

**How it works**:
1. CenterPoint detects object centers and regresses velocity vectors as part of the detection head
2. Previous track centers are extrapolated forward by their estimated velocity
3. Each detection is greedily assigned to the nearest predicted track center
4. Assignment threshold: typically 2.0m for vehicles, 1.0m for pedestrians

**Key results**:
- nuScenes test: **63.8% AMOTA** (with CenterPoint voxel detector)
- nuScenes val: 66.5% AMOTA
- Speed: Tracking adds <1ms to detection (greedy matching on CPU)

**Why it matters for airside**: The CenterPoint tracker is the most commonly used baseline in the field. Its simplicity makes it trivial to integrate, debug, and tune. The velocity regression from the detection head eliminates the need for Kalman filter velocity estimation in the first frames. However, it lacks multi-stage association, shape modeling, and occlusion handling -- all of which matter significantly for airside.

**Code**: https://github.com/tianweiy/CenterPoint

### 3.3 SimpleTrack (ECCV 2022 Workshop)

SimpleTrack decomposes 3D MOT into four modular components and systematically evaluates their impact: (1) detection pre-processing, (2) association, (3) motion model, and (4) lifecycle management.

**Key innovation -- Two-Stage Association**:
- **Stage 1**: Associate high-confidence detections (score > T_high, typically 0.5) with existing tracks using Hungarian assignment
- **Stage 2**: Associate remaining low-confidence detections (score > T_low = 0.1) with unmatched tracks from Stage 1

This two-stage approach reduces premature track termination by **86%** for vehicles and **70%** for pedestrians, because weak detections that would otherwise be discarded are used to extend existing tracks.

**Key results**:
- Waymo validation: Achieved MOTA/L2 improvements over CenterPoint tracker
- The paper demonstrated that the lifecycle management module contributes more to tracking quality than the choice of motion model

**Airside relevance**: The two-stage association is directly applicable. Ground crew members at 50+ meters produce sparse point clouds with low detection confidence. Using these weak detections to maintain existing crew tracks -- rather than discarding them -- prevents dangerous identity loss.

**Code**: https://github.com/tusen-ai/SimpleTrack

### 3.4 ImmortalTracker (arXiv 2021, ICCV 2023 extension)

ImmortalTracker challenges the fundamental assumption that tracks should be deleted after a fixed dormancy period. Its core thesis: **premature tracklet termination is the dominant cause of identity switches in 3D MOT**.

**Key innovation -- "Never Delete" Strategy**:
- Tracklets are never terminated, regardless of how long the object has been undetected
- When an object is undetected, its position is predicted forward using the last estimated velocity
- When a matching detection reappears, the tracklet is seamlessly resumed

**Implementation**:
1. Kalman filter with constant-velocity model for prediction during occlusion
2. A confidence score decays during dormancy but never reaches a deletion threshold
3. Re-association uses expanded matching distance (velocity-compensated position + shape similarity)

**Key results**:
- Waymo test set: **96% reduction in vehicle identity switches** from premature termination
- Mismatch ratio at the 0.0001 level (near-zero ID switches)
- Competitive MOTA while maintaining dramatically better ID consistency

**Airside relevance**: This is perhaps the most important tracking method for airside operations. Aircraft fuselage creates sustained occlusions of 5-15 seconds for vehicles moving behind the aircraft body. A conventional tracker with T_max_age = 5 frames (0.5s) would kill these tracks. ImmortalTracker maintains them, predicting the tug or crew member's position behind the fuselage until they reappear. The tradeoff is increased false positives from ghost tracks, but in the structured airside environment, this is manageable because:
- Objects that leave the apron are known (they exit via defined taxilanes)
- ADS-B and fleet management data can confirm whether an object still exists
- The Simplex safety architecture provides a classical fallback if ghost tracks cause planning issues

**Code**: https://github.com/ImmortalTracker/ImmortalTracker

### 3.5 ShaSTA (RA-L 2023)

ShaSTA (Shape and Spatio-Temporal Affinities) models the geometric relationship between tracks and detections across consecutive frames, learning affinity matrices that capture shape similarity and spatio-temporal context.

**Key innovations**:
- **Shape-aware affinity**: Learns to compare the point cloud shape signatures of tracks and detections, not just center distances. Critical for distinguishing similarly-positioned but differently-shaped objects (e.g., a belt loader vs. a fuel truck at the same stand position)
- **Spatio-temporal context**: Encodes the relative motion patterns between all object pairs, exploiting the fact that objects near each other tend to move in coordinated ways
- **Learned lifecycle management**: Uses the affinity network to improve false-positive elimination, false-negative propagation (hallucinating missed detections), and newborn track initialization

**Key results**:
- nuScenes tracking benchmark: **1st place among LiDAR-only trackers** (using CenterPoint detections)
- Significant reduction in false-positive and false-negative tracks
- Increased true-positive track count through better lifecycle management

**Extension -- ShaSTA-Fuse**: Adds camera-LiDAR fusion for learning affinities, combining 2D appearance features with 3D geometric features for more robust association in visually ambiguous scenes.

**Airside relevance**: Shape-aware tracking is particularly valuable on the apron. GSE vehicles have distinctive shapes (belt loaders have an extended conveyor arm, catering trucks have a raised platform, fuel trucks have a tanker body) that persist even when center distance alone would produce ambiguous matches. Learning shape-based affinity could dramatically reduce ID switches between closely-positioned GSE at a busy stand.

**Code**: https://github.com/tsadja/ShaSTA

### 3.6 PolarMOT (ECCV 2022)

PolarMOT frames 3D MOT as an edge classification problem on a graph, using a lightweight GNN with polar coordinate encoding.

**Key innovation -- Polar Coordinate Encoding**:
- Detections are encoded as nodes in a bipartite graph (track nodes vs. detection nodes)
- Pairwise spatial and temporal relations are encoded on graph edges
- Relations are computed in **localized polar coordinates** (distance + angle relative to each node), not Cartesian coordinates
- Polar encoding provides invariance to global transforms -- the relationship between two detections of a moving object remains stable regardless of the object's absolute position or route geometry

**Architecture**:
- Graph neural network with 3-4 layer MLPs
- Only **71K parameters** -- extremely lightweight
- Edge classification: each edge is classified as "same object" or "different object"
- Final assignment is extracted from the classified edges

**Key results**:
- nuScenes: State-of-the-art at time of publication
- Generalizes across Boston, Singapore, and Karlsruhe (nuScenes + KITTI) without retraining
- Cross-dataset generalization is exceptional due to polar encoding invariance

**Airside relevance**: The cross-location generalization is directly applicable. An airside tracker trained on one airport's apron layout should generalize to other airports. The polar encoding naturally handles the fact that the same tug-aircraft interaction looks geometrically different at different stands (different absolute positions) but has the same relative structure. The 71K parameter count means the entire GNN inference adds negligible compute to the pipeline.

### 3.7 3DMOTFormer (ICCV 2023)

3DMOTFormer replaces hand-crafted association with a learned Edge-Augmented Graph Transformer that reasons over the track-detection bipartite graph.

**Architecture**:
- Builds a bipartite graph between tracks and detections each frame
- Edge-Augmented Graph Transformer processes the graph, attending to both node features (detection attributes) and edge features (pairwise geometric relations)
- Edge classification outputs association decisions
- **Online training strategy**: Autoregressive + recurrent forward pass with sequential batch optimization to reduce train-test distribution mismatch

**Key results**:
- nuScenes validation: **71.2% AMOTA**
- nuScenes test: **68.2% AMOTA**
- Generalizes across different detectors (CenterPoint, TransFusion, LargeKernel3D)

**Airside relevance**: The learned association via graph transformer can capture complex interaction patterns (e.g., a tractor that decelerates as it approaches the aircraft nose, reverses direction, then accelerates away -- a pushback maneuver). However, the transformer inference adds computational overhead compared to greedy or Hungarian methods. The cross-detector generalization is valuable: it means the tracker can be trained once and work with different detection backends as they evolve.

### 3.8 MCTrack (IROS 2025) -- Current Unified SOTA

MCTrack is the first 3D MOT method to achieve state-of-the-art performance simultaneously across KITTI, nuScenes, and Waymo, ranking 1st on KITTI and nuScenes and 2nd on Waymo.

**Key innovation -- Multi-Cue Association from Different Perspectives**:
Rather than performing multi-stage association with different thresholds (like SimpleTrack), MCTrack performs multi-perspective matching:

1. **Stage 1 (BEV Plane)**: Project all 3D detections and predicted tracks onto the bird's-eye-view plane. Apply Hungarian assignment with a novel Ro_GDIoU (Rotated Generalized DIoU) cost metric. Most associations are resolved here.

2. **Stage 2 (Range View Plane)**: Project unmatched detections and tracks onto the range-view (image) plane. Apply secondary matching with SDIoU (Spherical DIoU). This specifically addresses depth estimation instabilities that cause BEV matching failures.

**Unified framework**: MCTrack converts KITTI, nuScenes, and Waymo into a common "BaseVersion" format and operates entirely in world coordinates, enabling a single codebase to handle all three benchmarks.

**Key results**:

| Dataset | Metric | Score | Rank |
|---------|--------|-------|------|
| nuScenes test | AMOTA | 76.3% | 1st (at submission) |
| nuScenes test | MOTA | 63.4% | - |
| nuScenes test | IDS | 242 | Lowest |
| KITTI (online) | HOTA | 80.78% | 1st |
| KITTI (offline) | HOTA | 82.75% | 1st |
| KITTI (offline) | AssA | 86.55% | 1st |
| KITTI (offline) | MOTA | 91.79% | - |
| KITTI (offline) | IDSW | 11 | Lowest |
| Waymo test | MOTA/L1 | 75.04% | 2nd |
| Waymo test | MOTA/L2 | 73.44% | 2nd |

**Runtime**: Fully implemented in Python on CPU, no GPU required for tracking.

**Airside relevance**: MCTrack's multi-perspective matching directly addresses a key airside problem. Aircraft on the apron appear very differently in BEV (plan view shows wingspan) vs. range view (side view shows fuselage length). BEV matching may fail for objects at similar depths but different heights (e.g., a pushback tug under the fuselage), while range-view matching resolves these cases. The unified format and world-coordinate operation align well with the reference airside AV stack's multi-LiDAR setup, which already fuses point clouds into a single world frame.

**Code**: https://github.com/megvii-research/MCTrack

### 3.9 OptiPMB (IEEE T-ITS 2025) -- Random Finite Set Approach

OptiPMB takes a fundamentally different approach to 3D MOT by using a Poisson Multi-Bernoulli (PMB) filter from the random finite set (RFS) theory.

**Key innovation -- Principled Birth/Death Modeling**:
- Unlike heuristic-based trackers (fixed T_max_age, N_init thresholds), RFS-based methods model object birth, survival, and death probabilistically
- **Measurement-driven hybrid adaptive birth model**: New tracks are initialized based on detection measurements rather than fixed spatial birth models
- **Adaptive detection probability**: Accounts for the fact that occluded objects have lower detection probability, allowing the filter to maintain tracks for partially occluded objects without heuristic parameters

**Key results**:
- nuScenes test: **76.7% AMOTA** (ranked 1st at submission, March 2025)
- KITTI: Competitive with MCTrack
- Provides theoretically grounded confidence scores for track existence

**Airside relevance**: The RFS framework's principled handling of object birth and death is attractive for safety-critical applications. Rather than tuning heuristic thresholds (T_max_age, N_init, confidence thresholds), the filter provides mathematically grounded existence probabilities that can be directly used by the safety system. However, RFS filters are more complex to implement and tune than Kalman + Hungarian pipelines, and community familiarity is lower.

### 3.10 NEMOT (2025) -- Current nuScenes Leader

NEMOT holds the top position on the nuScenes tracking leaderboard as of March 2025.

**Key results**:
- nuScenes test: **77.9% AMOTA** (highest recorded)
- AMOTP: 0.436m
- MOTAR: 81.7%
- MOTA: 65.6%
- MOTP: 0.307m
- Uses both LiDAR and Camera modalities

### 3.11 S2-Track (ICML 2025) -- End-to-End Paradigm

S2-Track represents the emerging end-to-end tracking paradigm, jointly optimizing detection and tracking within a single transformer.

**Key innovations**:
- **2D-Prompted Query Initialization**: Leverages predicted 2D object and depth information to initialize 3D queries, avoiding the cold-start problem of random query initialization
- **Uncertainty-aware Probabilistic Decoder**: Captures environmental uncertainty in complex driving scenarios
- **Hierarchical Query Denoising**: Enhances training robustness by denoising queries at multiple granularities

**Key results**:
- nuScenes test: **66.3% AMOTA** (1st among end-to-end methods, surpassing previous best by 8.9%)
- Note: End-to-end methods currently trail TBD methods by ~10% AMOTA, but the gap is closing

**Airside relevance**: End-to-end methods are not yet recommended for airside deployment. The tracking-by-detection paradigm provides explicit intermediate representations (detected objects with confidence scores) that are essential for safety monitoring and explainability in certified systems. However, S2-Track demonstrates the direction the field is heading.

---

## 4. Camera-LiDAR Fusion Tracking {#4-camera-lidar-fusion-tracking}

While the reference airside AV stack's current stack is LiDAR-only, camera-LiDAR fusion tracking becomes relevant as cameras are added for Re-ID (tail numbers, GSE fleet markings) and for detecting distant incoming aircraft.

### 4.1 EagerMOT (ICRA 2021)

EagerMOT is the foundational camera-LiDAR fusion tracker. It "eagerly" integrates all available observations from both modalities.

**Architecture**:
1. Run 2D image detector (e.g., Faster R-CNN) and 3D LiDAR detector (e.g., PointPillars) independently
2. **Fusion step 1**: Match 3D detections to 2D detections by projecting 3D boxes onto the image plane and computing 2D IoU
3. **Fusion step 2**: Matched pairs get fused features (3D localization from LiDAR + appearance from camera)
4. **Association**: Match fused detections to tracks using a combined distance metric (3D center distance + 2D appearance similarity)
5. **Key advantage**: Objects detected only by camera (at long range, beyond LiDAR reach) are tracked in 2D until they enter LiDAR range, then seamlessly transitioned to 3D tracks

**Key results**:
- KITTI: State-of-the-art at time of publication
- nuScenes: Improved tracking of distant objects that cameras detect before LiDAR

**Airside relevance**: EagerMOT's long-range camera tracking is valuable for airside because aircraft approach the stand from taxiways at 100+ meters, initially visible only to cameras. The smooth 2D-to-3D transition allows the tracker to maintain identity as the aircraft enters LiDAR range at 50-70m.

### 4.2 DeepFusionMOT (RA-L 2022, IROS 2022)

DeepFusionMOT extends EagerMOT with a learned deep association mechanism.

**Key innovation -- Deep Feature Association**:
- Learns to extract and match appearance features from camera images for Re-ID
- When an object is far away (camera-only), tracking operates in 2D
- As the object enters LiDAR range, the 2D trajectory is updated with 3D information
- The transition from 2D to 3D is learned, not heuristic

**Key results**:
- KITTI: Improved over EagerMOT in both accuracy and speed
- Achieves good trade-off between tracking accuracy and processing speed

**Airside relevance**: The deep feature association could be trained on GSE visual features (fleet livery, vehicle shape silhouettes) to provide camera-based Re-ID that supplements LiDAR geometric tracking.

### 4.3 FutrTrack (VISAPP 2026)

FutrTrack is the most recent camera-LiDAR fusion tracker, using a transformer-based architecture.

**Architecture**:
- Camera features extracted via 2D ResNet, LiDAR features via voxel-based encoder
- Both projected to BEV and fused via cross-attention
- **Temporal smoother**: Processes sequences of bounding boxes over a moving window to reduce jitter and improve spatial consistency
- **Fusion tracker**: Assigns and propagates identities using both geometric and semantic cues, with no explicit motion model (the transformer implicitly learns motion)

**Key results**:
- nuScenes test: **74.7% AMOTA** (best among transformer-based trackers)
- Reduced identity switches compared to non-fusion methods

**Airside relevance**: The temporal smoother is particularly interesting for airside, where low-speed vehicles (pushback at 1-3 km/h) produce noisy velocity estimates. Smoothing over a temporal window of 5-10 frames (0.5-1.0s) can significantly improve trajectory quality without adding latency, since the smoother operates on past frames only.

### 4.4 IMM-MOT (2025) -- Interacting Multiple Model

IMM-MOT addresses a fundamental limitation of single-motion-model trackers: real objects do not follow a single motion pattern.

**Key innovation -- Multiple Motion Models**:
- Maintains multiple motion hypotheses per track (e.g., constant velocity, constant turn rate, stationary)
- An **Interacting Multiple Model (IMM)** filter blends the outputs of these models based on model likelihood
- The model probability adapts online: a parked tug has high "stationary" probability; once it starts moving, the "constant velocity" model takes over; during turns, the "constant turn rate" model dominates

**Airside relevance**: IMM is highly relevant because airside vehicles frequently switch motion modes:
- A pushback tug starts stationary, accelerates, turns, and stops
- Ground crew walk, stop to inspect, then walk again
- Aircraft taxi at constant speed, decelerate, and park
A single constant-velocity model handles none of these transitions well.

---

## 5. Airside-Specific Tracking Challenges {#5-airside-specific-tracking-challenges}

### 5.1 Extreme Object Size Range

The airside environment contains the widest object size range of any AV deployment:

| Object Class | Typical Dimensions (L x W x H) | LiDAR Points at 30m | Tracking Challenge |
|---|---|---|---|
| FOD (debris) | 0.05 x 0.05 x 0.02 m | 0-2 points | Below detection threshold, not tracked |
| Ground crew | 0.5 x 0.5 x 1.8 m | 5-20 points | Sparse, high miss rate, critical safety |
| Baggage cart | 2.0 x 1.2 x 1.0 m | 30-80 points | Moderate, often in trains (connected carts) |
| Belt loader | 6.0 x 2.5 x 3.5 m | 200-500 points | Good coverage, distinctive shape |
| Pushback tug | 5.0 x 2.5 x 2.0 m | 150-400 points | Good, but occluded under fuselage during pushback |
| Fuel truck | 8.0 x 2.5 x 3.0 m | 300-800 points | Well-detected, distinctive tanker shape |
| Catering truck | 7.0 x 2.5 x 4.0 m | 400-1000 points | Tall, well-detected, scissor lift is distinctive |
| Narrow-body aircraft (A320) | 37.6 x 35.8 x 11.8 m | 5000-20000+ points | Massive, L-shaped in BEV (fuselage + wings) |
| Wide-body aircraft (A380) | 72.7 x 79.8 x 24.1 m | 10000-40000+ points | Fills sensor FOV, partial detection only |

**Implication for tracking**: The detector's bounding box regression must handle boxes spanning 3+ orders of magnitude in volume. Standard NMS thresholds tuned for car-sized objects will either over-suppress large aircraft detections or under-suppress small GSE detections. Class-specific NMS thresholds are essential.

### 5.2 Low-Speed Target Tracking

Road driving trackers are optimized for highway speeds (60-130 km/h). Airside speeds are fundamentally different:

| Motion Pattern | Speed | Displacement per Frame (10 Hz) |
|---|---|---|
| Aircraft pushback | 1-3 km/h | 0.03-0.08 m |
| Crew walking | 3-5 km/h | 0.08-0.14 m |
| Baggage tug | 10-25 km/h | 0.28-0.69 m |
| Aircraft taxiing | 15-30 km/h | 0.42-0.83 m |
| Typical highway car | 100 km/h | 2.78 m |

At pushback speeds, an object moves only 3-8 cm between frames. This is within the LiDAR measurement noise floor for many sensors. Consequences:
- **Velocity estimation is noisy**: The Kalman filter velocity estimate takes 5-10 frames to converge, and the velocity signal-to-noise ratio is poor
- **Static/moving disambiguation**: A parked tug and a tug in pushback are nearly indistinguishable based on inter-frame displacement alone
- **CenterPoint velocity regression fails**: The velocity head learns from inter-frame displacements in the training data, which are dominated by highway-speed objects. Fine-tuning on low-speed data is required

**Mitigation**: Use acceleration constraints in the Kalman filter (low-speed objects cannot have high accelerations), and supplement velocity estimation with heading change (yaw rate) from consecutive bounding box orientations.

### 5.3 Occlusion by Aircraft Fuselage

The most distinctive airside occlusion pattern is the aircraft fuselage shadow. Consider a narrow-body aircraft (A320) at a stand:

```
                    ┌─────────── 35.8m wingspan ───────────┐
                    │                                       │
         ───────────┼───────────────────────────────────────┼───────────
                    │         FUSELAGE (37.6m)              │
         ───────────┼───────────────────────────────────────┼───────────
                    │                                       │
                    └───────────────────────────────────────┘

    VISIBLE ZONE                OCCLUDED ZONE              VISIBLE ZONE
    (nose area)              (behind fuselage)              (tail area)
    
    ← AV approaches from here
```

**Occlusion characteristics**:
- Duration: 5-15 seconds for a tug driving behind the fuselage at 10 km/h
- Width: 3.95m (A320 fuselage diameter) blocks LiDAR line-of-sight
- Objects transitioning behind the fuselage lose points gradually (partial occlusion) before disappearing completely
- Re-appearing objects may have changed heading (e.g., a tug that entered from the nose side exits from the tail side)

**Required tracker behavior**:
1. Detect partial occlusion onset (point count dropping but not zero)
2. Switch to prediction-only mode when object fully occluded
3. Maintain track for 5-15 seconds (50-150 frames at 10 Hz)
4. Expand association gate when object begins to reappear
5. Handle heading change during occlusion (the tug may have turned)

This is exactly the scenario ImmortalTracker's "never delete" strategy addresses. A standard tracker with T_max_age = 5 frames would lose the track at frame 5 and create a new identity when the tug reappears -- producing a dangerous identity switch.

### 5.4 Re-Identification: Beyond Track IDs

Airside operations require tracking identities that go beyond anonymous track IDs:

**Aircraft identification**:
- **ADS-B transponder**: Broadcasts ICAO 24-bit address, flight callsign, and GPS position at 1-2 Hz. The FAA mandates ADS-B Out for airport vehicle transponders (VTU-20 units, ~$3K each). ADS-B provides ground truth identity but at low spatial resolution (~3-10m GPS accuracy)
- **Tail number (visual)**: OCR on tail registration (e.g., "G-EUPH") via camera. Requires visibility of the vertical stabilizer or fuselage marking
- **Silhouette matching**: Aircraft type can be inferred from LiDAR point cloud shape (wingspan, fuselage length, engine count/position). This provides class-level identification without cameras

**GSE identification**:
- **Fleet management system**: Each GSE vehicle has a fleet ID (e.g., "TUG-047") broadcast via WiFi/cellular to the airport operations system (e.g., ADB SAFEGATE A-SMGCS)
- **Vehicle livery**: Distinctive paint schemes (airline-specific) detectable by camera
- **Geometric fingerprinting**: Each GSE type has a unique shape signature in LiDAR (belt loader arm angle, fuel truck tank diameter, catering truck platform height)

**Personnel identification**:
- Not individually identified (privacy constraints)
- Tracked by role via PPE detection: hi-vis vest color (airline vs. handling agent), hard hat presence, marshalling wand
- Re-ID after occlusion: gait analysis, height, and last-known position

### 5.5 Interaction Modeling: Who Serves Which Aircraft

The tracker must understand operational interactions, not just individual trajectories:

| Interaction | Tracking Requirement |
|---|---|
| Tractor-aircraft pushback | Detect coupling event (tractor stops at nose gear, reverses direction with aircraft) |
| Belt loader-cargo door | Belt loader extends arm to fuselage, becomes quasi-static for 10-30 minutes |
| Fuel truck connection | Fuel truck parks at wing, hose extends (not visible in LiDAR), vehicle remains static |
| Catering truck lift | Platform rises (height change in bounding box), docks with forward door |
| Crew transit | Personnel walk between vehicles and aircraft doors in predictable patterns |

These interactions can be modeled as:
1. **Proximity events**: Track A enters proximity threshold of Track B
2. **Velocity coupling**: Track A's velocity becomes correlated with Track B's velocity (pushback)
3. **State transitions**: Track changes from "moving" to "docked" to "active" to "departing"

Interaction modeling is downstream of MOT but depends on stable track identities.

---

## 6. Tracking Metrics {#6-tracking-metrics}

### 6.1 Metric Definitions

| Metric | Full Name | Formula | What It Measures |
|--------|-----------|---------|------------------|
| **MOTA** | Multiple Object Tracking Accuracy | 1 - (FN + FP + IDSW) / GT | Detection quality with ID switch penalty. Dominated by detection recall |
| **MOTP** | Multiple Object Tracking Precision | Mean IoU of matched pairs | Localization accuracy of matched track-detection pairs |
| **IDF1** | ID F1 Score | 2*IDTP / (2*IDTP + IDFN + IDFP) | Association quality. Ratio of correctly identified detections |
| **HOTA** | Higher Order Tracking Accuracy | sqrt(DetA * AssA) | Geometric mean of detection accuracy and association accuracy |
| **DetA** | Detection Accuracy | TP / (TP + FN + FP) | Jaccard index of detection |
| **AssA** | Association Accuracy | Mean alignment of matched trajectories | Average trajectory consistency |
| **AMOTA** | Average MOTA | Mean MOTA over recall thresholds | nuScenes primary metric; averages over confidence thresholds |
| **AMOTP** | Average MOTP | Mean MOTP over recall thresholds | nuScenes localization metric |
| **IDS** | Identity Switches | Count of track ID changes for same GT object | Raw count of Re-ID failures |

### 6.2 Which Metric Matters for Airside

**HOTA** is the most balanced metric because it equally weights detection and association through its decomposition into DetA and AssA. However, for airside safety:

- **IDS (Identity Switches)** is the most safety-critical metric. A single identity switch on a pushback tug could cause the planner to lose track of a vehicle directly in the AV's path.
- **AssA (Association Accuracy)** directly measures trajectory consistency, which is what the motion prediction and planning modules depend on.
- **MOTA** is useful as a coarse metric but is dominated by detection performance (FN/FP) and can be misleadingly high even with poor association.

**Recommended evaluation protocol for airside**:
1. Primary: **IDS per 1000 frames** (airside-specific, measures safety-critical association failures)
2. Secondary: **HOTA** (balanced detection + association)
3. Tertiary: **AMOTA** (for comparison with published benchmarks)
4. Report: **AssA** separately to isolate association quality from detection quality

### 6.3 Benchmark Reference Numbers

Current SOTA on public benchmarks (for calibrating expectations on custom airside data):

| Method | nuScenes AMOTA | nuScenes IDS | KITTI HOTA | KITTI MOTA | Waymo MOTA/L2 |
|--------|---------------|-------------|------------|------------|---------------|
| NEMOT | 77.9% | - | - | - | - |
| OptiPMB | 76.7% | - | ~80% | ~90% | - |
| MCTrack | 76.3% | 242 | 82.75% | 91.79% | 73.44% |
| FutrTrack | 74.7% | - | - | - | - |
| 3DMOTFormer | 68.2% | - | - | - | - |
| S2-Track (E2E) | 66.3% | - | - | - | - |
| CenterPoint | 63.8% | ~700+ | - | - | - |
| AB3DMOT | ~18% | - | 83.84% MOTA | 83.84% | - |

Note: Direct comparison is imperfect because methods use different detectors. Tracking performance is heavily dependent on detector quality.

---

## 7. ROS Integration {#7-ros-integration}

### 7.1 Message Type Definitions

For ROS 1 (Noetic), there is no standardized TrackedObject message. Autoware's ROS 2 `autoware_perception_msgs/TrackedObject` provides a reference design. Here is a ROS 1 adaptation:

```
# TrackedObject.msg
# A tracked 3D object with persistent identity

# Header with timestamp and frame_id
std_msgs/Header header

# Unique track identifier (persistent across frames)
uint32 track_id

# Track state: 0=TENTATIVE, 1=CONFIRMED, 2=DORMANT
uint8 state
uint8 STATE_TENTATIVE = 0
uint8 STATE_CONFIRMED = 1
uint8 STATE_DORMANT = 2

# Object class
uint8 classification
uint8 CLASS_UNKNOWN = 0
uint8 CLASS_AIRCRAFT = 1
uint8 CLASS_TUG = 2
uint8 CLASS_BELT_LOADER = 3
uint8 CLASS_FUEL_TRUCK = 4
uint8 CLASS_CATERING_TRUCK = 5
uint8 CLASS_BAGGAGE_CART = 6
uint8 CLASS_CREW = 7
uint8 CLASS_OTHER_VEHICLE = 8
float32 classification_confidence

# 3D pose (center of bounding box in world frame)
geometry_msgs/PoseWithCovariance pose

# Velocity (in world frame)
geometry_msgs/TwistWithCovariance twist

# Acceleration (in world frame)
geometry_msgs/Accel accel

# 3D bounding box dimensions
float64 length
float64 width
float64 height

# Track metadata
uint32 age            # Frames since track creation
uint32 hits           # Total successful associations
uint32 misses         # Consecutive frames without association
float32 existence_probability  # Track existence confidence [0, 1]

# Re-ID fields (airside-specific)
string fleet_id       # GSE fleet identifier (e.g., "TUG-047")
string ads_b_icao     # ADS-B ICAO code for aircraft
string tail_number    # Aircraft registration (from visual OCR)
```

```
# TrackedObjectArray.msg
std_msgs/Header header
TrackedObject[] objects
```

### 7.2 ROS Nodelet Architecture for 10 Hz Tracking

```
                    ┌────────────────────────────────────────────────┐
                    │          Perception Nodelet Manager            │
                    │                                                │
  PointCloud2       │  ┌──────────┐  Detection3D   ┌────────────┐  │  TrackedObjectArray
  (10 Hz)   ───────►│  │ Detector │  Array (10 Hz)  │  Tracker   │──┼──► (10 Hz)
                    │  │ Nodelet  │ ───────────────► │  Nodelet   │  │
                    │  └──────────┘                  └────────────┘  │
                    │       │                             │          │
                    │       │ (shared memory,             │          │
                    │       │  zero-copy in               │          │
                    │       │  same nodelet               │          │
                    │       │  manager)                   │          │
                    └───────┼─────────────────────────────┼──────────┘
                            │                             │
                            ▼                             ▼
                    GPU (TensorRT)                  CPU (tracking)
                    ~50-100ms                       ~1-3ms
```

**Key design decisions**:

1. **Detector and Tracker as separate nodelets in the same manager**: Zero-copy message passing between detection and tracking. The detector publishes Detection3DArray; the tracker subscribes within the same process, avoiding serialization overhead.

2. **Tracker runs on CPU only**: Kalman filter prediction, Hungarian assignment, and lifecycle management are purely CPU operations. Even MCTrack's multi-cue association runs on CPU in <3ms for 30 objects.

3. **Synchronous pipeline**: The tracker processes each detection frame synchronously. At 10 Hz with 100ms between frames, the tracker's 1-3ms processing time is negligible.

4. **Thread model**: Single-threaded tracker nodelet is sufficient. The association + Kalman update for 30 objects completes well within the 100ms frame budget.

### 7.3 Implementation Skeleton (ROS 1 Nodelet)

```cpp
#include <nodelet/nodelet.h>
#include <pluginlib/class_list_macros.h>
#include <ros/ros.h>
#include "perception_msgs/Detection3DArray.h"
#include "perception_msgs/TrackedObjectArray.h"

namespace airside_tracking {

class TrackerNodelet : public nodelet::Nodelet {
public:
    void onInit() override {
        ros::NodeHandle& nh = getNodeHandle();
        ros::NodeHandle& pnh = getPrivateNodeHandle();
        
        // Parameters
        pnh.param("max_age", max_age_, 50);           // 5 seconds at 10 Hz
        pnh.param("min_hits", min_hits_, 3);           // 3 frames to confirm
        pnh.param("iou_threshold", iou_threshold_, 0.1);
        pnh.param("max_objects", max_objects_, 64);
        
        // Subscribers and publishers
        det_sub_ = nh.subscribe("detections", 1,
            &TrackerNodelet::detectionCallback, this);
        track_pub_ = nh.advertise<perception_msgs::TrackedObjectArray>(
            "tracked_objects", 1);
    }
    
private:
    void detectionCallback(
        const perception_msgs::Detection3DArray::ConstPtr& msg) {
        
        // 1. Predict existing tracks forward
        for (auto& track : tracks_) {
            track.predict();
        }
        
        // 2. Build cost matrix (BEV IoU or center distance)
        auto cost_matrix = buildCostMatrix(tracks_, msg->detections);
        
        // 3. Hungarian assignment
        auto [matched, unmatched_tracks, unmatched_dets] =
            hungarianAssignment(cost_matrix, iou_threshold_);
        
        // 4. Update matched tracks
        for (auto& [track_idx, det_idx] : matched) {
            tracks_[track_idx].update(msg->detections[det_idx]);
        }
        
        // 5. Handle unmatched tracks (dormancy / deletion)
        for (auto idx : unmatched_tracks) {
            tracks_[idx].incrementMiss();
            if (tracks_[idx].misses() > max_age_) {
                tracks_[idx].markDead();
            }
        }
        
        // 6. Create new tracks for unmatched detections
        for (auto idx : unmatched_dets) {
            tracks_.emplace_back(msg->detections[idx], next_track_id_++);
        }
        
        // 7. Publish confirmed tracks
        perception_msgs::TrackedObjectArray output;
        output.header = msg->header;
        for (const auto& track : tracks_) {
            if (track.hits() >= min_hits_ && !track.isDead()) {
                output.objects.push_back(track.toMsg());
            }
        }
        track_pub_.publish(output);
        
        // 8. Prune dead tracks
        tracks_.erase(
            std::remove_if(tracks_.begin(), tracks_.end(),
                [](const Track& t) { return t.isDead(); }),
            tracks_.end());
    }
    
    std::vector<Track> tracks_;
    uint32_t next_track_id_ = 0;
    int max_age_, min_hits_, max_objects_;
    double iou_threshold_;
    ros::Subscriber det_sub_;
    ros::Publisher track_pub_;
};

}  // namespace airside_tracking

PLUGINLIB_EXPORT_CLASS(airside_tracking::TrackerNodelet, nodelet::Nodelet)
```

### 7.4 Track Lifecycle Parameters for Airside

```yaml
# tracker_params.yaml
tracker:
  # Association
  association_method: "hungarian"   # "hungarian" or "greedy"
  cost_metric: "bev_iou"           # "bev_iou", "center_distance", "giou"
  iou_threshold: 0.1               # Minimum BEV IoU for valid match
  distance_threshold: 4.0          # Maximum center distance (meters) for match gate
  
  # Lifecycle: class-specific parameters
  aircraft:
    max_age: 300                    # 30 seconds -- aircraft don't just disappear
    min_hits: 5                     # Need 5 frames to confirm (avoid false aircraft)
    init_score_threshold: 0.5       # High confidence required for aircraft birth
    
  gse_vehicle:
    max_age: 50                     # 5 seconds -- handles fuselage occlusion
    min_hits: 3                     # Standard confirmation
    init_score_threshold: 0.3       # Lower threshold for smaller vehicles
    
  personnel:
    max_age: 100                    # 10 seconds -- crew may be occluded for extended periods
    min_hits: 3                     # Quick confirmation for safety
    init_score_threshold: 0.2       # Accept weak detections for safety
    
  # Kalman filter
  motion_model: "constant_velocity" # "constant_velocity" or "constant_acceleration" or "imm"
  process_noise_position: 0.05      # Lower than road driving (slower speeds)
  process_noise_velocity: 0.005     # Very low velocity uncertainty
  process_noise_heading: 0.05       # Moderate heading uncertainty (tugs turn)
  measurement_noise_position: 0.3   # Multi-LiDAR fusion gives good position
  measurement_noise_heading: 0.05   # Good heading from oriented boxes
```

---

## 8. Deployment on NVIDIA Orin {#8-deployment-on-nvidia-orin}

### 8.1 Compute Budget Analysis

The full perception pipeline on Orin AGX (275 TOPS, 64GB) must fit within the 100ms frame budget:

| Component | Compute Device | Latency (Orin AGX) | Notes |
|-----------|---------------|-------------------|-------|
| Point cloud preprocessing | CPU | 2-5 ms | Voxelization, coordinate transform |
| LiDAR detection (PointPillars INT8) | DLA + GPU | 6.8 ms | TensorRT INT8, see openpcdet-centerpoint.md |
| LiDAR detection (CenterPoint FP16) | GPU | 20-30 ms | TensorRT FP16 |
| LiDAR detection (FlatFormer) | GPU | ~15 ms | Estimated, based on 4.6x over SST |
| NMS + post-processing | CPU | 1-2 ms | Class-specific NMS |
| **3D MOT (Kalman + Hungarian)** | **CPU** | **1-3 ms** | **30 objects, 10 Hz** |
| **3D MOT (GNN-based, PolarMOT)** | **CPU** | **2-5 ms** | **71K params, MLP only** |
| **3D MOT (MCTrack multi-cue)** | **CPU** | **2-4 ms** | **BEV + range view matching** |
| Occupancy grid update | GPU | 5-10 ms | Voxel raycasting |
| Total pipeline | Mixed | 40-75 ms | Well within 100ms budget |

**Key insight**: 3D MOT tracking adds negligible compute to the pipeline. Even the most complex tracking methods (MCTrack, 3DMOTFormer) process at 200+ FPS on CPU because the input is a small set of detected bounding boxes (typically 5-30 per frame), not raw point clouds or images.

### 8.2 GNN Inference on Orin

For GNN-based trackers (PolarMOT, 3DMOTFormer):

- **PolarMOT**: 71K parameters, 3-4 layer MLPs. Runs at ~500 FPS on CPU. No GPU needed.
- **3DMOTFormer**: Edge-Augmented Graph Transformer. Heavier than PolarMOT but still processes at ~100 FPS on CPU for typical scene sizes (20-30 objects).
- **Recommendation**: Run GNN tracking on CPU, reserving GPU entirely for detection and occupancy. The Orin's 12-core ARM Cortex-A78AE CPU has ample capacity for graph inference on small graphs.

### 8.3 Memory Footprint

| Component | Memory Usage | Notes |
|-----------|-------------|-------|
| Active tracks (64 max) | ~50 KB | State vectors + covariance matrices |
| Track history (last 100 frames) | ~5 MB | For trajectory smoothing and visualization |
| Cost matrix (64 x 64) | ~32 KB | Pre-allocated, reused each frame |
| GNN model (PolarMOT) | ~300 KB | 71K parameters in FP32 |
| GNN model (3DMOTFormer) | ~5 MB | Larger transformer model |
| **Total tracker memory** | **<15 MB** | **Negligible vs. detection model (100-500 MB)** |

### 8.4 Latency Optimization

For achieving consistent 10 Hz tracking:

1. **Pre-allocate cost matrix**: Avoid dynamic memory allocation in the hot loop. Pre-allocate a max-size cost matrix (64 x 64) and reuse it.

2. **SIMD Kalman filter**: The Kalman filter predict/update involves matrix multiplications on 10x10 matrices. ARM NEON SIMD intrinsics can accelerate this by 2-4x, though the absolute time saving is small (sub-microsecond per track).

3. **Parallel prediction**: Predict all tracks in parallel using OpenMP. Each track's Kalman prediction is independent.

4. **Batch IoU computation**: Compute all pairwise BEV IoUs in a single vectorized operation rather than nested loops. This dominates the cost matrix computation time.

5. **Avoid unnecessary copies**: Use ROS nodelet zero-copy for detection-to-tracker message passing. The tracker should take a const reference to the detection message, not copy it.

---

## 9. Comparison Table {#9-comparison-table}

### 9.1 Complete Method Comparison

| Method | Year | Venue | Modality | Motion Model | Association | nuScenes AMOTA | KITTI HOTA | Waymo MOTA/L2 | Params | Speed (FPS) | Code |
|--------|------|-------|----------|-------------|-------------|---------------|------------|---------------|--------|-------------|------|
| AB3DMOT | 2020 | IROS | L | Kalman (CV) | Hungarian (3D IoU) | ~18% | - | - | 0 | 207 | [link](https://github.com/xinshuoweng/AB3DMOT) |
| CenterPoint Tracker | 2021 | CVPR | L | Velocity regression | Greedy (center dist) | 63.8% | - | - | 0 | 1000+ | [link](https://github.com/tianweiy/CenterPoint) |
| SimpleTrack | 2022 | ECCV-W | L | Kalman (CV) | Two-stage Hungarian | ~65% | - | ~65% | 0 | 200+ | [link](https://github.com/tusen-ai/SimpleTrack) |
| ImmortalTracker | 2021/23 | arXiv/ICCV | L | Kalman (CV) | Hungarian + never-delete | - | - | Comp. MOTA | 0 | 200+ | [link](https://github.com/ImmortalTracker/ImmortalTracker) |
| PolarMOT | 2022 | ECCV | L | Learned (GNN) | Edge classification | ~65%* | ~78%* | - | 71K | 500+ | [link](https://polarmot.github.io/) |
| ShaSTA | 2023 | RA-L | L | Learned affinity | Affinity matrix | 1st L-only | - | - | ~100K | 100+ | [link](https://github.com/tsadja/ShaSTA) |
| EagerMOT | 2021 | ICRA | L+C | Kalman (CV) | Multi-modal Hungarian | ~40% | - | - | 0 | 100+ | [link](https://github.com/aleksandrkim61/EagerMOT) |
| DeepFusionMOT | 2022 | RA-L | L+C | Kalman (CV) | Deep feature assoc. | - | 84.6% MOTA | - | ~1M | 50+ | [link](https://github.com/wangxiyang2022/DeepFusionMOT) |
| 3DMOTFormer | 2023 | ICCV | L | Learned (Transformer) | Edge classification | 68.2% | - | - | ~500K | 100+ | [link](https://github.com/dsx0511/3DMOTFormer) |
| MCTrack | 2025 | IROS | L (+ C optional) | Kalman (CV) | Multi-cue Hungarian | **76.3%** | **82.75%** | **73.44%** | 0 | 200+ | [link](https://github.com/megvii-research/MCTrack) |
| OptiPMB | 2025 | T-ITS | L | PMB filter (RFS) | Measurement-driven | **76.7%** | ~80% | - | 0 | ~100 | - |
| NEMOT | 2025 | - | L+C | - | - | **77.9%** | - | - | - | - | - |
| FutrTrack | 2026 | VISAPP | L+C | Learned (Transformer) | Fusion tracker | 74.7% | - | - | ~2M | ~50 | - |
| IMM-MOT | 2025 | arXiv | L | IMM (multi-model) | Hungarian | Competitive | - | - | 0 | 100+ | - |
| S2-Track (E2E) | 2025 | ICML | L+C | End-to-end | Joint det+track | 66.3% | - | - | ~10M+ | ~20 | - |

*PolarMOT numbers are from time of publication (2022); later methods have surpassed them on the same benchmark.

Note: "0 params" means the tracking module has no learned parameters (pure Kalman + assignment). FPS numbers for the tracker only (not including detection).

### 9.2 Feature Comparison for Airside Suitability

| Feature | CenterPoint | SimpleTrack | ImmortalTracker | MCTrack | OptiPMB | ShaSTA |
|---------|------------|-------------|-----------------|---------|---------|--------|
| Handles long occlusion (5-15s) | No (kills at ~0.5s) | Partial (tunable) | **Yes (never delete)** | Partial (tunable) | Yes (adaptive prob.) | Partial |
| Shape-aware association | No | No | No | No | No | **Yes** |
| Multi-perspective matching | No | No | No | **Yes (BEV + range)** | No | No |
| Class-specific parameters | No | No | No | Yes | Yes | Yes |
| Principled existence probability | No | No | No | No | **Yes (RFS theory)** | Partial |
| Cross-dataset generalization | Moderate | Moderate | Good | **Best (3 datasets)** | Good | Moderate |
| Implementation complexity | Trivial | Low | Low | Low | **High** | Moderate |
| GPU required for tracking | No | No | No | No | No | No |
| Open source | Yes | Yes | Yes | Yes | No | Yes |

---

## 10. Recommended Architecture for Airside {#10-recommended-architecture-for-airside}

### 10.1 Phased Implementation Plan

Given the reference airside AV stack's current stack (ROS Noetic, 4-8 RoboSense LiDARs, no cameras in perception loop, GTSAM localization), the recommended tracking architecture builds incrementally:

#### Phase 1: Baseline Tracker (1-2 weeks)

**Goal**: Get functional 3D MOT integrated with the existing detector.

**Architecture**: CenterPoint-style greedy tracker with extended lifecycle management.

```
Multi-LiDAR Point Cloud (10 Hz)
       │
       ▼
CenterPoint/PointPillars Detector (TensorRT on GPU)
       │
       ▼ Detection3DArray
       │
MCTrack-style Multi-Cue Tracker (CPU):
  ├── Stage 1: BEV IoU Hungarian assignment
  ├── Stage 2: Center distance assignment for unmatched
  ├── Kalman filter (CV model) state estimation
  └── Class-specific lifecycle management
       │
       ▼ TrackedObjectArray
       │
  Motion Prediction → Frenet Planner
```

**Implementation**:
- Use OpenPCDet CenterPoint or PointPillars as detector (already documented in openpcdet-centerpoint.md)
- Implement tracker as a C++ nodelet using Eigen for matrix operations
- Use scipy.optimize.linear_sum_assignment (via Python) or a C++ Hungarian implementation (dlib or custom)
- Class-specific lifecycle parameters from Section 7.4

**Expected performance**: ~60-65% AMOTA equivalent on road driving benchmarks. On airside data, expect lower numbers initially due to domain shift (object size distribution, speed distribution) but stable tracking for vehicles within 50m.

#### Phase 2: Occlusion-Robust Tracking (2-4 weeks after Phase 1)

**Goal**: Handle aircraft fuselage occlusion without identity loss.

**Add**:
1. **ImmortalTracker-style never-delete for vehicles**: GSE tracks predicted through occlusion for up to 30 seconds (300 frames). Use velocity + heading extrapolation.
2. **Confidence decay during dormancy**: Track existence probability decreases linearly during prediction-only mode. The safety system uses this probability to modulate planning aggressiveness.
3. **Expanded re-association gate**: When a dormant track's predicted position is within 5m of a new detection with matching class and similar dimensions, attempt re-association with shape similarity check.

**Implementation additions**:
- Add track state machine: TENTATIVE -> CONFIRMED -> DORMANT -> (re-association or DEAD)
- Add shape descriptor: oriented bounding box aspect ratio (L/W, L/H) as a lightweight shape fingerprint
- Add per-class T_max_age from Section 7.4

**Expected improvement**: 90%+ reduction in identity switches during fuselage occlusion events.

#### Phase 3: Shape-Aware and Multi-Cue Tracking (4-8 weeks after Phase 2)

**Goal**: Integrate MCTrack's multi-perspective matching and ShaSTA's shape awareness.

**Add**:
1. **MCTrack BEV + range-view dual matching**: Implement Stage 1 BEV matching with Ro_GDIoU and Stage 2 range-view matching with SDIoU for unmatched pairs. This resolves depth ambiguities common when multiple GSE vehicles cluster at a stand.
2. **ShaSTA-style shape affinity**: Compute point cloud shape signatures (using a small MLP trained on airside data) for improved association when center distance alone is ambiguous.
3. **IMM motion model**: Replace single constant-velocity Kalman with interacting multiple model (CV + constant turn rate + stationary) for better prediction of mode-switching GSE behavior.

**Expected performance**: Near-SOTA tracking quality with minimal identity switches in complex multi-vehicle stand scenarios.

#### Phase 4: Camera-Augmented Re-ID (future, when cameras are added)

**Goal**: Persistent identity across sessions using visual features.

**Add**:
1. **Aircraft tail number OCR**: Camera-based recognition of aircraft registration, linked to ADS-B identity
2. **GSE livery matching**: Camera-based vehicle appearance encoding for cross-session Re-ID
3. **EagerMOT-style fusion**: 2D camera tracking for distant incoming aircraft (100-200m), transitioning to 3D LiDAR tracking at 50-70m

### 10.2 Architecture Diagram

```
                         ┌─────────────────────────────────────────┐
                         │         AIRSIDE MOT SYSTEM              │
                         │                                         │
  Multi-LiDAR            │  ┌──────────────────────────────────┐  │
  Fused Cloud ──────────►│  │     3D DETECTOR (GPU)            │  │
  (10 Hz)                │  │  PointPillars / CenterPoint      │  │
                         │  │  TensorRT INT8 / FP16            │  │
                         │  └──────────┬───────────────────────┘  │
                         │             │ Detection3DArray          │
                         │             ▼                           │
                         │  ┌──────────────────────────────────┐  │
                         │  │   MULTI-CUE TRACKER (CPU)        │  │
                         │  │                                  │  │
                         │  │  ┌─────────────┐                 │  │
                         │  │  │ BEV IoU     │ Stage 1         │  │
                         │  │  │ Hungarian   │ (primary)       │  │
                         │  │  └──────┬──────┘                 │  │
                         │  │         │ unmatched               │  │
                         │  │         ▼                         │  │
                         │  │  ┌─────────────┐                 │  │
                         │  │  │ Center Dist │ Stage 2         │  │
                         │  │  │ Matching    │ (rescue)        │  │
                         │  │  └──────┬──────┘                 │  │
                         │  │         │                         │  │
                         │  │         ▼                         │  │
                         │  │  ┌─────────────┐                 │  │
                         │  │  │ IMM Kalman  │ State           │  │
                         │  │  │ Filter      │ Estimation      │  │
                         │  │  └──────┬──────┘                 │  │
                         │  │         │                         │  │
                         │  │         ▼                         │  │
                         │  │  ┌─────────────┐                 │  │
                         │  │  │ Lifecycle   │ Birth/Dormancy  │  │
                         │  │  │ Manager     │ /Death          │  │
                         │  │  │ (Immortal)  │                 │  │
                         │  │  └──────┬──────┘                 │  │
                         │  └─────────┼────────────────────────┘  │
                         │            │ TrackedObjectArray          │
                         │            ▼                             │
                         │  ┌──────────────────────────────────┐  │
  ADS-B / Fleet Mgmt ──►│  │   IDENTITY FUSION (CPU)          │  │
  (1-2 Hz)               │  │  Match track IDs to:             │  │
                         │  │  - ADS-B ICAO (aircraft)         │  │
                         │  │  - Fleet ID (GSE)                │  │
                         │  │  - Tail number (if camera avail) │  │
                         │  └──────────┬───────────────────────┘  │
                         │             │ EnrichedTrackedObjectArray │
                         │             ▼                           │
                         │       Motion Prediction                 │
                         │       Frenet Planner                    │
                         │       Fleet Dispatch                    │
                         └─────────────────────────────────────────┘
```

### 10.3 Critical Design Decisions

**Decision 1: Tracking-by-detection, not end-to-end.**
End-to-end trackers (S2-Track) are closing the gap but do not yet match TBD methods in absolute performance, and they lack the intermediate Detection3DArray representation needed for safety monitoring and explainability. For ISO 3691-4 and future FAA certification, explicit detection outputs with confidence scores are required.

**Decision 2: ImmortalTracker strategy for GSE, bounded deletion for personnel.**
GSE vehicles are persistent objects that do not spontaneously appear or disappear -- they follow defined routes on the apron. Never-delete with velocity prediction is appropriate. Personnel, however, can enter/exit vehicles (disappearing from the scene), so a bounded max_age of 10 seconds is more appropriate to avoid ghost pedestrian tracks.

**Decision 3: Hungarian assignment, not greedy matching.**
Greedy matching (CenterPoint) fails when multiple objects are at similar distances. At a busy stand with 3-4 GSE vehicles clustered within 5m of each other, greedy matching will produce more identity switches than Hungarian optimal assignment. The O(n^3) cost is negligible for n < 64.

**Decision 4: CPU-only tracking, GPU reserved for detection.**
All recommended tracking methods run on CPU. This leaves the full GPU/DLA compute budget for detection, occupancy, and future learned components. The tracker's 1-5ms CPU latency is a rounding error in the overall pipeline.

**Decision 5: Class-specific lifecycle parameters.**
A single set of birth/death thresholds cannot simultaneously handle aircraft (massive, always present, never disappears) and ground crew (small, frequently occluded, may enter vehicles). Class-specific parameters are essential.

### 10.4 Estimated Development Effort

| Phase | Effort | Dependencies | Deliverable |
|-------|--------|-------------|-------------|
| Phase 1: Baseline | 1-2 weeks | Working 3D detector in ROS | TrackedObjectArray at 10 Hz |
| Phase 2: Occlusion-robust | 2-4 weeks | Phase 1 + airside test data | Fuselage occlusion handling |
| Phase 3: Multi-cue + shape | 4-8 weeks | Phase 2 + labeled airside data | Near-SOTA tracking quality |
| Phase 4: Camera Re-ID | 8-12 weeks | Camera hardware + Phase 3 | Persistent cross-session identity |

### 10.5 Data Requirements

| Dataset Need | Purpose | Minimum Size | Source |
|-------------|---------|-------------|--------|
| nuScenes trainval | Pre-training / baseline evaluation | 300 GB | [nuScenes download](https://www.nuscenes.org/download) |
| Airside LiDAR recordings | Domain-specific evaluation | 50-100 hours | reference airside AV stack field deployments |
| Airside 3D box annotations | Tracker evaluation on airside | 500-1000 annotated frames | Manual annotation or auto-label |
| ADS-B ground truth logs | Identity ground truth | Concurrent with LiDAR | UAT/1090ES receiver at apron |

---

## 11. References {#11-references}

### Papers

1. **AB3DMOT**: Weng, X., et al. "AB3DMOT: A Baseline for 3D Multi-Object Tracking and New Evaluation Metrics." IROS 2020. [arXiv:2008.08063](https://arxiv.org/abs/2008.08063)

2. **CenterPoint**: Yin, T., Zhou, X., & Krahenbuhl, P. "Center-based 3D Object Detection and Tracking." CVPR 2021. [arXiv:2006.11275](https://arxiv.org/abs/2006.11275)

3. **SimpleTrack**: Pang, Z., et al. "SimpleTrack: Understanding and Rethinking 3D Multi-object Tracking." ECCV 2022 Workshop. [arXiv:2111.09621](https://arxiv.org/abs/2111.09621)

4. **ImmortalTracker**: Wang, Q., Chen, Y., & Pang, Z. "Immortal Tracker: Tracklet Never Dies." [arXiv:2111.13672](https://arxiv.org/abs/2111.13672)

5. **ShaSTA**: Sadjadpour, T., et al. "ShaSTA: Modeling Shape and Spatio-Temporal Affinities for 3D Multi-Object Tracking." RA-L 2023. [arXiv:2211.03919](https://arxiv.org/abs/2211.03919)

6. **PolarMOT**: Kim, A., et al. "PolarMOT: How Far Can Geometric Relations Take Us in 3D Multi-Object Tracking?" ECCV 2022. [arXiv:2208.01957](https://arxiv.org/abs/2208.01957)

7. **3DMOTFormer**: Ding, S., et al. "3DMOTFormer: Graph Transformer for Online 3D Multi-Object Tracking." ICCV 2023. [arXiv:2308.06635](https://arxiv.org/abs/2308.06635)

8. **MCTrack**: Megvii Research. "MCTrack: A Unified 3D Multi-Object Tracking Framework for Autonomous Driving." IROS 2025. [arXiv:2409.16149](https://arxiv.org/abs/2409.16149)

9. **OptiPMB**: "OptiPMB: Enhancing 3D Multi-Object Tracking with Optimized Poisson Multi-Bernoulli Filtering." IEEE T-ITS 2025. [arXiv:2503.12968](https://arxiv.org/abs/2503.12968)

10. **EagerMOT**: Kim, A., Osep, A., & Leal-Taixe, L. "EagerMOT: 3D Multi-Object Tracking via Sensor Fusion." ICRA 2021. [arXiv:2104.14682](https://arxiv.org/abs/2104.14682)

11. **DeepFusionMOT**: Wang, X., et al. "DeepFusionMOT: A 3D Multi-Object Tracking Framework Based on Camera-LiDAR Fusion with Deep Association." RA-L / IROS 2022. [arXiv:2202.12100](https://arxiv.org/abs/2202.12100)

12. **FutrTrack**: "FutrTrack: A Camera-LiDAR Fusion Transformer for 3D Multiple Object Tracking." VISAPP 2026. [arXiv:2510.19981](https://arxiv.org/abs/2510.19981)

13. **S2-Track**: "S2-Track: A Simple yet Strong Approach for End-to-End 3D Multi-Object Tracking." ICML 2025.

14. **IMM-MOT**: "IMM-MOT: A Novel 3D Multi-object Tracking Framework with Interacting Multiple Model Filter." 2025. [arXiv:2502.09672](https://arxiv.org/abs/2502.09672)

15. **HOTA Metric**: Luiten, J., et al. "HOTA: A Higher Order Metric for Evaluating Multi-Object Tracking." IJCV 2021. [arXiv:2009.07736](https://arxiv.org/abs/2009.07736)

### Benchmarks

- **nuScenes Tracking**: https://www.nuscenes.org/tracking
- **Waymo Open Dataset**: https://waymo.com/open/challenges/
- **KITTI Tracking**: https://www.cvlibs.net/datasets/kitti/eval_tracking.php
- **TrackEval (HOTA)**: https://github.com/JonathonLuiten/TrackEval

### Code Repositories

| Repository | Stars | Language | License |
|-----------|-------|---------|---------|
| [AB3DMOT](https://github.com/xinshuoweng/AB3DMOT) | 1.8K+ | Python | MIT |
| [CenterPoint](https://github.com/tianweiy/CenterPoint) | 3.5K+ | Python | MIT |
| [SimpleTrack](https://github.com/tusen-ai/SimpleTrack) | 400+ | Python | Apache 2.0 |
| [ImmortalTracker](https://github.com/ImmortalTracker/ImmortalTracker) | 200+ | Python | MIT |
| [ShaSTA](https://github.com/tsadja/ShaSTA) | 100+ | Python | MIT |
| [MCTrack](https://github.com/megvii-research/MCTrack) | 300+ | Python | Apache 2.0 |
| [3DMOTFormer](https://github.com/dsx0511/3DMOTFormer) | 200+ | Python | MIT |
| [DeepFusionMOT](https://github.com/wangxiyang2022/DeepFusionMOT) | 200+ | Python | MIT |

### Airside Infrastructure

- **FAA AC 150/5220-26**: Airport Ground Vehicle ADS-B Out Squitter Equipment. [FAA Document](https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5220_26.pdf)
- **Saab Airport Vehicle Tracking**: https://www.saab.com/products/airport-vehicle-tracking
- **uAvionix VTU-20**: Airport Vehicle ADS-B Transmitter. https://uavionix.com/products/vtu-20/
- **Autoware Perception Messages**: https://github.com/autowarefoundation/autoware_msgs/blob/main/autoware_perception_msgs/msg/TrackedObject.msg
