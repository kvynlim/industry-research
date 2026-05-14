# Modern LiDAR SLAM and Odometry Algorithms: Deep Dive for Airside Autonomous Vehicles

---

## Table of Contents

1. [KISS-ICP](#1-kiss-icp)
2. [LIO-SAM](#2-lio-sam)
3. [Faster-LIO](#3-faster-lio)
4. [FAST-LIO2](#4-fast-lio2)
5. [CT-ICP](#5-ct-icp)
6. [Point-LIO](#6-point-lio)
7. [Comparison Table](#7-comparison-table)
8. [Best Algorithm for Airside Operations](#8-best-algorithm-for-airside-operations)
9. [Adding Learned Features](#9-adding-learned-features)
10. [Degeneracy Detection and Handling](#10-degeneracy-detection-and-handling)

---

## Cross-Section Hub

For the GLIM/GTSAM pipeline specifically, use [GLIM and GTSAM Pipeline Hub](../slam-methods/glim-gtsam-pipeline-hub.md). It maps LiDAR/range-inertial SLAM stages to GTSAM factor graph objects, Bayes-tree updates, Hessian diagnostics, sparse elimination, marginalization, and the relevant KB pages.

---

## 1. KISS-ICP

### 1.1 Overview

**KISS-ICP** (Keep It Small and Simple ICP) was introduced by Vizzo et al. (RAL 2023, University of Bonn / PRBonn group) as a deliberately minimalist LiDAR odometry system that achieves state-of-the-art performance through careful engineering rather than algorithmic complexity. The name reflects its core philosophy: strip away every unnecessary component and show that a well-designed ICP pipeline can match or exceed far more complex systems.

**Paper:** "KISS-ICP: In Defense of Point-to-Point ICP -- Simple, Accurate, and Robust Registration If Done Right" (IEEE RA-L, 2023)
**Code:** `https://github.com/PRBonn/kiss-icp` (MIT License, C++/Python, 4000+ GitHub stars)

### 1.2 Architecture

KISS-ICP consists of four stages, each carefully designed to be as simple as possible:

```
Raw Point Cloud
    │
    ├── 1. Motion Compensation (constant velocity model)
    │       - Deskew using predicted ego-motion from previous step
    │       - No IMU needed — uses previous frame's estimated velocity
    │
    ├── 2. Downsampling (voxel grid)
    │       - Voxelize incoming scan to fixed resolution
    │       - Typically 0.5m voxels for automotive LiDAR
    │       - Reduces 100K+ points to ~10K representatives
    │
    ├── 3. Point-to-Point ICP Registration
    │       - Correspondence: nearest-neighbor search in voxelized local map
    │       - Objective: minimize point-to-point distances
    │       - Solver: Procrustes (closed-form SVD solution)
    │       - Adaptive threshold for correspondence rejection
    │
    └── 4. Local Map Management
            - Voxelized spatial hash map
            - Fixed maximum number of points per voxel
            - Points older than N frames are culled
            - No separate mapping thread — map updated inline
```

#### The Adaptive Threshold

The key innovation is the **adaptive correspondence threshold** that automatically adjusts based on the registration quality:

```
Standard ICP: fixed threshold τ for rejecting correspondences
  → Too small: fails in high-motion scenarios
  → Too large: accepts outlier correspondences

KISS-ICP adaptive threshold:
  τ_k = √(3σ²_k) where σ²_k = model_error + registration_error_k

  model_error: constant term reflecting sensor noise
  registration_error_k: exponential moving average of residuals

  When registration is good (small residuals):
    → τ decreases, tighter matching, higher precision

  When registration struggles (large residuals):
    → τ increases, more permissive matching, higher robustness

  This makes KISS-ICP self-tuning — no manual parameter adjustment per dataset.
```

This adaptive threshold is what allows KISS-ICP to work across vastly different environments (indoor, outdoor, urban, highway, forest) without any parameter tuning, making it unique among LiDAR odometry systems.

#### Voxelized Local Map

The local map is maintained as a spatial hash map of voxels:

```
Map structure: HashMap<VoxelCoord, vector<Point3D>>

Insertion:
  1. Compute voxel coordinate: v = floor(point / voxel_size)
  2. If voxel exists and not full: append point
  3. If voxel does not exist: create new voxel with point
  4. Maximum points per voxel: 20 (prevents memory growth)

Correspondence search:
  For query point p:
    1. Compute voxel v = floor(p / voxel_size)
    2. Search 27 neighboring voxels (3x3x3 neighborhood)
    3. Find nearest point within adaptive threshold
    → O(1) average case due to spatial hashing (vs O(log N) for kd-tree)

Map cleanup:
  - Remove voxels outside a distance threshold from current pose
  - Maintains bounded map size regardless of trajectory length
```

### 1.3 Performance on Benchmarks

KISS-ICP achieves remarkably strong results given its simplicity:

| Dataset | ATE (m) | RPE Trans (%) | RPE Rot (deg/m) | Notes |
|---------|---------|---------------|-----------------|-------|
| KITTI (avg 00-10) | ~0.50 | 0.50 | 0.17 | Top 5 on KITTI leaderboard |
| MulRan (avg) | ~2.1 | - | - | Urban driving, Korea |
| NCLT (avg) | ~1.8 | - | - | Long-term campus dataset |
| Newer College | ~0.15 | - | - | Handheld, indoor+outdoor |
| KITTI-360 | ~0.60 | - | - | Extended sequences |

Key results:
- **Outperforms or matches** most LiDAR-inertial systems (which use additional IMU data) using LiDAR alone
- **Zero parameter tuning** — same configuration across all datasets
- **Sensor-agnostic**: works with Velodyne (16/32/64/128), Ouster, Livox, Hesai, Robosense, and even solid-state LiDARs
- **Runs at 100+ Hz** on modern hardware for typical automotive point clouds

### 1.4 Comparison with the reference airside AV stack's VGICP

| Aspect | KISS-ICP | reference airside AV stack VGICP |
|--------|----------|---------------|
| **Registration type** | Point-to-Point ICP | Generalized ICP (distribution-to-distribution) |
| **Map representation** | Spatial hash map (voxels with raw points) | Voxelized Gaussian distributions |
| **Correspondence** | Nearest-neighbor in voxel neighborhood | Point-to-voxel distribution matching |
| **Covariance modeling** | None (raw point distances) | Per-voxel covariance from local surface normals |
| **Hardware** | CPU only (no GPU needed) | GPU-accelerated (CUDA) |
| **Latency** | 5-15ms per scan (CPU) | 5-10ms per scan (GPU) |
| **Use case** | Odometry (frame-to-map) | Localization (scan-to-prebuilt-map) |
| **Map source** | Builds map online incrementally | Requires pre-built point cloud map |
| **Loop closure** | Not included | Not included (handled by GTSAM) |
| **Degeneracy handling** | Adaptive threshold provides implicit robustness | No explicit degeneracy handling |

**Key distinction:** KISS-ICP is an **odometry** system (estimates relative motion, builds map online), while the reference airside AV stack's VGICP is a **localization** system (matches against a pre-built map). They serve different roles in the stack:

```
KISS-ICP role:    Build map during survey; provide odometry when map unavailable
VGICP role:       Localize against known map during operations

For the reference airside AV stack's stack, KISS-ICP could:
  1. Replace the survey process — use KISS-ICP for initial map building
  2. Serve as odometry fallback when VGICP scan matching fails
  3. Provide an independent odometry factor in the GTSAM graph
```

VGICP is theoretically more accurate for scan-to-map matching because it models surface geometry through covariance matrices (point-to-plane is generally more precise than point-to-point). However, KISS-ICP's adaptive threshold compensates significantly, and its CPU-only operation removes the GPU dependency.

---

## 2. LIO-SAM

### 2.1 Overview

**LIO-SAM** (LiDAR Inertial Odometry via Smoothing and Mapping) was introduced by Shan et al. (IROS 2020, MIT/Nuance) as a tightly-coupled LiDAR-inertial odometry system built on a factor graph formulation using GTSAM. It is one of the most widely deployed LiDAR SLAM systems in robotics research and industry.

**Paper:** "LIO-SAM: Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping" (IROS 2020)
**Code:** `https://github.com/TixiaoShan/LIO-SAM` (BSD-3 License, C++/ROS, 3500+ GitHub stars)

### 2.2 Architecture and Factor Graph Formulation

LIO-SAM formulates the SLAM problem as a factor graph optimized by GTSAM's incremental solver (iSAM2), directly analogous to the reference airside AV stack's existing localization architecture:

```
Factor Graph Structure:
  Variable nodes: X = {x_1, x_2, ..., x_n} where x_i = SE(3) pose + velocity + IMU bias

  Factor types:
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  IMU Preintegration Factor (between consecutive poses)  │
  │    Connects: x_i → x_{i+1}                             │
  │    Measurement: ∫ IMU readings between keyframes        │
  │    Uses GTSAM's PreintegratedCombinedMeasurements       │
  │                                                         │
  │  LiDAR Odometry Factor (between consecutive poses)      │
  │    Connects: x_i → x_{i+1}                             │
  │    Measurement: scan-to-map registration (feature ICP)  │
  │    Edge + planar feature matching against local submap   │
  │                                                         │
  │  GPS Factor (unary, when available)                     │
  │    Connects: x_i to GPS measurement                    │
  │    Measurement: lat/lon/alt → local frame              │
  │    Noise model based on fix quality                     │
  │                                                         │
  │  Loop Closure Factor (between non-consecutive poses)    │
  │    Connects: x_i → x_j where |i-j| >> 1               │
  │    Measurement: ICP registration between keyframes      │
  │    Triggered by Euclidean proximity + scan matching      │
  │                                                         │
  └─────────────────────────────────────────────────────────┘

  Solver: iSAM2 (incremental Bayes tree optimization)
    → Only re-linearizes affected variables
    → O(log n) per update in typical cases
    → Same solver reference airside AV stack uses in their factor graph
```

### 2.3 IMU Preintegration

LIO-SAM uses IMU preintegration theory (Forster et al., TRO 2017) to efficiently incorporate high-rate IMU measurements:

```
IMU operates at 200-500 Hz, LiDAR at 10-20 Hz.
Rather than adding every IMU measurement as a separate factor:

Preintegration:
  Between keyframes i and j (e.g., 100ms apart at 10Hz LiDAR):
    Integrate ~50 IMU measurements into a single preintegrated measurement:

    Δp_ij = Σ R_k · (a_k - b_a) · dt²/2    (position change)
    Δv_ij = Σ R_k · (a_k - b_a) · dt        (velocity change)
    ΔR_ij = Π exp((ω_k - b_g) · dt)         (rotation change)

  Key property: preintegrated measurements are independent of the initial
  state estimate. When the graph is re-optimized and x_i changes, we do NOT
  need to re-integrate. Only the residual computation changes.

  Bias correction: First-order correction applied when bias estimates change:
    Δp_ij ≈ Δp_ij⁰ + ∂Δp/∂b_a · δb_a + ∂Δp/∂b_g · δb_g

  This makes re-optimization O(1) per IMU factor rather than O(N_imu).
```

### 2.4 LiDAR Feature Extraction and Matching

LIO-SAM inherits the LOAM-style feature extraction (from LeGO-LOAM, also by Shan):

```
Feature extraction per scan:
  1. Compute smoothness for each point:
     c = (1/|S|) · ||Σ_{j∈S} (p_j - p_i)||  where S = neighboring points

  2. Classify points:
     c > threshold_edge    → Edge feature (high curvature, corners/poles)
     c < threshold_planar  → Planar feature (low curvature, walls/ground)

  3. Edge features: matched to edge lines in map (point-to-edge distance)
     Planar features: matched to planar patches in map (point-to-plane distance)

  4. Optimization: Levenberg-Marquardt on the combined edge + planar residuals

Map management:
  - Keyframe-based: new keyframe when translation > 1m or rotation > 10°
  - Local submap: union of nearby keyframes within radius R
  - Voxel-downsampled for efficiency
  - Global map stored as keyframe poses + associated scans
```

### 2.5 GPS Factor Integration

```
GPS factor in LIO-SAM:
  Input: lat, lon, altitude from GNSS receiver
  Transform: Convert to local ENU frame using first GPS fix as origin

  Factor:
    GPSFactor(pose_key, gps_measurement, noise_model)

  Noise model:
    - Configurable per fix quality
    - Typical: σ_xy = 1.0m (autonomous GNSS), σ_z = 2.0m
    - With RTK: σ_xy = 0.02m, σ_z = 0.05m
    - When HDOP high or fix quality poor: increase noise or skip

  Integration strategy:
    - GPS added as unary factor on nearest keyframe
    - Prevents long-term drift even without loop closure
    - In GPS-denied areas: system relies on LiDAR+IMU factors only
```

### 2.6 Loop Closure

```
Loop closure pipeline:
  1. Candidate detection:
     - For each new keyframe, search keyframe history
     - Criterion: Euclidean distance < threshold AND temporal gap > minimum
     - Radius search in kd-tree of keyframe positions

  2. Candidate verification:
     - Extract local submap around candidate keyframe
     - Register current scan against candidate submap via ICP
     - Accept if: fitness score < threshold AND transformation is reasonable

  3. Factor addition:
     - Add loop closure BetweenFactor(x_i, x_j, ΔT_ij, noise)
     - Noise model based on ICP fitness

  4. Graph optimization:
     - iSAM2 propagates correction through the entire trajectory
     - All poses between i and j are adjusted
     - Map is updated to reflect corrected poses
```

### 2.7 Performance

| Dataset | ATE (m) | Drift (%) | Notes |
|---------|---------|-----------|-------|
| KITTI 00-10 | ~0.7-1.5 | 0.5-1.0 | Without loop closure |
| MulRan | ~2.0-5.0 | - | Urban, with GPS |
| Custom campus | ~0.3-0.5 | - | With loop closure |
| Outdoor (general) | 0.5-2.0 | 0.3-0.8 | Varies by environment |

**Strengths:** GPS integration, loop closure, direct GTSAM compatibility, well-tested in real deployments.
**Weaknesses:** Feature extraction assumes structured environments (walls, poles); degrades in featureless open areas. LOAM features can fail on solid-state LiDARs with limited FOV.

### 2.8 Relevance to the reference airside AV stack's Stack

LIO-SAM's architecture is directly analogous to the reference airside AV stack's existing factor graph:

```
reference airside AV stack factor graph:              LIO-SAM factor graph:
  IMU Preintegration Factor   ↔     IMU Preintegration Factor
  VGICP LiDAR Factor          ↔     LiDAR Odometry Factor
  GPS Factor                  ↔     GPS Factor
  Wheel Odometry Factor       ↔     (not included)
  Level Factor                ↔     (not included)
  (no loop closure)           ↔     Loop Closure Factor

Key difference: reference airside AV stack uses VGICP scan-to-map (localization against pre-built map)
while LIO-SAM uses feature-based scan-to-submap (online SLAM).
```

LIO-SAM's loop closure module could be added to the reference airside AV stack's graph to correct drift during extended operations or map-building surveys.

---

## 3. Faster-LIO

### 3.1 Overview

**Faster-LIO** was introduced by Bai et al. (RAL 2022, Tsinghua University) as a significant speedup of the FAST-LIO2 pipeline, replacing the ikd-tree with an **incremental voxel map** (iVox) data structure that achieves similar accuracy with 1.5-2x faster processing.

**Paper:** "Faster-LIO: Lightweight Tightly Coupled Lidar-Inertial Odometry Using Parallel Sparse Incremental Voxels" (IEEE RA-L, 2022)
**Code:** `https://github.com/gaoxiang12/faster-lio` (GPL-2.0 License, C++)

### 3.2 Architecture

Faster-LIO shares the same tightly-coupled LiDAR-inertial formulation as FAST-LIO2 but replaces the map data structure:

```
Pipeline:
  IMU measurements (high rate)
      │
      ├── Forward propagation (state prediction via IMU integration)
      │     State: [R, p, v, b_g, b_a, g]  (rotation, position, velocity, biases, gravity)
      │
      ├── Backward propagation (undistortion using predicted trajectory)
      │     Each point is projected to the end-of-scan timestamp
      │
      ├── State update (iterated Kalman filter)
      │     Measurement: point-to-plane residuals from map
      │     h_i = n_i^T · (R·p_i + t - q_i)  where n_i = plane normal, q_i = nearest point
      │     Iterate until convergence (typically 2-4 iterations)
      │
      └── Map update (incremental voxel map — iVox)
            Insert new points into iVox after state is finalized
```

### 3.3 Incremental Voxel Map (iVox)

The key contribution is replacing FAST-LIO2's ikd-tree with a simpler spatial hash structure:

```
iVox structure:
  - Spatial hash map: HashMap<VoxelCoord, Voxel>
  - Each voxel contains a fixed-size array of points
  - Two variants:
    a) iVox-Linear: linear search within each voxel
    b) iVox-PHC (Pseudo-Hilbert Curve): points sorted by space-filling curve
       for cache-friendly nearest-neighbor search

Nearest-neighbor search:
  Given query point p:
    1. Compute voxel index: v = floor(p / voxel_size)
    2. Search neighboring voxels (configurable neighborhood, typically 1-ring)
    3. Within each voxel: linear scan or PHC-ordered scan
    4. Return K nearest neighbors

  Complexity: O(K·M) where M = average points per voxel (bounded constant)
  vs ikd-tree: O(K·log N) where N = total map points

Why this is faster:
  - No tree rebalancing (ikd-tree requires periodic rebuilds)
  - Cache-friendly memory access patterns
  - O(1) insertion (hash table insert)
  - Parallelizable (each voxel independent)
  - PHC variant orders points to improve spatial locality

Insertion:
  1. Compute voxel for new point
  2. If voxel not full: append
  3. If voxel full: either reject or replace oldest point
  → No rebalancing, no tree rotations
```

### 3.4 Performance Comparison

| Metric | FAST-LIO2 (ikd-tree) | Faster-LIO (iVox) | Improvement |
|--------|---------------------|-------------------|-------------|
| Processing time (Avia) | ~12ms/scan | ~6ms/scan | 2x faster |
| Processing time (Velodyne) | ~35ms/scan | ~22ms/scan | 1.6x faster |
| ATE accuracy | Baseline | Comparable (within 5%) | Negligible loss |
| Memory usage | Higher (tree overhead) | Lower (hash map) | ~30% reduction |
| Map insertion | O(log N) with rebalancing | O(1) amortized | Significant |
| NN query | O(K·log N) | O(K·M) M=const | Faster for large maps |

**On limited compute (e.g., embedded ARM):**
- Faster-LIO achieves real-time on Livox scans at ~6ms per frame on desktop, ~25ms on ARM (Jetson Xavier)
- The hash map is simpler to implement on embedded platforms (no complex tree operations)
- Memory allocation is more predictable (no tree rebalancing spikes)

### 3.5 Comparison with LIO-SAM

| Aspect | Faster-LIO | LIO-SAM |
|--------|-----------|---------|
| **LiDAR-IMU coupling** | Tightly coupled (iterated EKF) | Tightly coupled (factor graph/iSAM2) |
| **Feature extraction** | None (direct point-to-plane) | LOAM features (edge + planar) |
| **Map structure** | iVox (incremental voxel map) | Keyframe submaps (voxel-downsampled) |
| **Loop closure** | No | Yes |
| **GPS integration** | No | Yes |
| **Optimization** | Iterated Extended Kalman Filter | Factor graph (GTSAM iSAM2) |
| **Speed** | Faster (~6ms/scan) | Slower (~50ms/scan) |
| **Accuracy** | Slightly better odometry | Better with loop closure |
| **Extensibility** | Hard to add factors | Easy to add new factors |
| **Code maturity** | Research grade | Well-maintained, widely used |

**Key insight:** Faster-LIO is superior for pure odometry speed, but LIO-SAM's factor graph formulation makes it far more extensible for multi-sensor fusion — a critical requirement for airside operations where GPS, wheel odometry, and other factors must be fused.

---

## 4. FAST-LIO2

### 4.1 Overview

**FAST-LIO2** (Fast LiDAR-Inertial Odometry 2) was introduced by Xu et al. (TRO 2022, University of Hong Kong, MARS Lab) as a direct, robust, and fast LiDAR-inertial odometry system. It eliminates feature extraction entirely and introduces the **ikd-tree** for efficient incremental map management.

**Paper:** "FAST-LIO2: Fast Direct LiDAR-Inertial Odometry" (IEEE TRO, 2022)
**Code:** `https://github.com/hku-mars/FAST_LIO` (GPL-2.0 License, C++/ROS, 3000+ GitHub stars)

### 4.2 Architecture

```
Pipeline overview:
  ┌──────────────────────────────────────────────────────┐
  │                    FAST-LIO2                         │
  │                                                      │
  │  IMU (200-500Hz) ──→ Forward Propagation             │
  │                       (State prediction via           │
  │                        IMU integration on manifold)   │
  │                              │                        │
  │  LiDAR (10-100Hz) ──→ Point Undistortion              │
  │                       (Using predicted trajectory     │
  │                        from backward propagation)     │
  │                              │                        │
  │                        Registration                   │
  │                       (Direct point-to-plane          │
  │                        against ikd-tree map)          │
  │                              │                        │
  │                        Iterated EKF Update            │
  │                       (State = [R,p,v,bg,ba,g]        │
  │                        18-dim state on manifold)      │
  │                              │                        │
  │                        Map Update                     │
  │                       (Insert new points into         │
  │                        ikd-tree incrementally)        │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### 4.3 Why No Feature Extraction?

Traditional LiDAR SLAM (LOAM, LeGO-LOAM, LIO-SAM) extracts edge and planar features. FAST-LIO2 argues this is unnecessary:

```
Feature extraction disadvantages:
  1. Information loss: only ~20% of points are kept as features
  2. Sensor dependency: smoothness-based features assume specific scan patterns
     → Fails on solid-state LiDARs (Livox) with non-repetitive scan patterns
  3. Computation overhead: feature classification costs time
  4. Tuning burden: thresholds vary by sensor and environment

FAST-LIO2 direct approach:
  - Use ALL points (after voxel downsampling)
  - For each point p_i, find nearest 5 neighbors in map
  - Fit local plane: normal n_i, centroid q_i
  - Residual: h_i = n_i^T · (T(x) · p_i - q_i)
  - This is point-to-plane ICP, but applied to raw points without classification

Result: works with ANY LiDAR — spinning, solid-state, prism, MEMS
```

### 4.4 ikd-Tree (Incremental K-D Tree)

The **ikd-tree** is FAST-LIO2's main data structure contribution:

```
Standard kd-tree problems for SLAM:
  - Rebuilding after inserting new points: O(N log N)
  - Deleting old points: not supported efficiently
  - For a map with 1M points, each rebuild takes ~100ms

ikd-Tree solution:
  Incremental operations:
    Insert: O(log N) per point
      - Insert into tree using standard kd-tree insertion
      - Lazy rebalancing: mark subtrees for rebuild when balance degrades
      - Rebuild happens in background thread when α-balance criterion violated:
        max(size(left), size(right)) > α · size(tree)  (α ≈ 0.75)
      - Background rebuild does not block queries or insertions

    Delete (box-wise):
      - Given bounding box (e.g., points too far from robot)
      - Lazy deletion: mark points as deleted without tree restructuring
      - Deleted points excluded from NN queries
      - Actual memory reclaimed during next rebalance

    NN Query: O(log N) with early termination
      - Standard kd-tree NN search with backtracking
      - Priority queue for K-NN

  Performance:
    - Insert 10K points: ~2ms (vs ~50ms for full rebuild)
    - NN query: ~0.5ms for 10K queries against 1M point map
    - Memory: ~1.5x overhead vs raw point storage
```

### 4.5 Iterated Extended Kalman Filter (IEKF)

```
State vector (18 dimensions on SE(3) manifold):
  x = [R, p, v, b_g, b_a, g]
  R ∈ SO(3): rotation (3 DoF)
  p ∈ R³: position
  v ∈ R³: velocity
  b_g ∈ R³: gyroscope bias
  b_a ∈ R³: accelerometer bias
  g ∈ R³: gravity vector (estimated online)

Prediction (IMU forward propagation):
  x̂_{k+1} = f(x̂_k, u_k)  where u_k = [ω_k, a_k] (gyro, accel)

Update (iterated):
  For iteration j = 1, 2, ..., J:
    1. Compute Jacobian H_j = ∂h/∂x at current estimate x̂_j
    2. Compute residual z_j = h(x̂_j) - measurements
    3. Kalman gain: K = P · H^T · (H · P · H^T + R)^{-1}
    4. Update: x̂_{j+1} = x̂_j ⊕ K · (z_j + H · (x̂_0 ⊖ x̂_j))
    5. Converged when ||x̂_{j+1} ⊖ x̂_j|| < ε

  ⊕, ⊖: operations on SE(3) manifold (boxplus/boxminus)

  Typical convergence: 2-4 iterations
  → Total update time: ~5ms for 10K measurement points
```

### 4.6 Performance

| Dataset | ATE (m) | Speed (ms/scan) | Notes |
|---------|---------|-----------------|-------|
| KITTI (avg) | 0.8-1.5 | 20-35 | 64-beam Velodyne |
| Newer College | 0.10-0.15 | 8-12 | Ouster OS0-128 |
| Custom indoor | 0.05-0.10 | 5-8 | Livox Avia |
| Custom outdoor | 0.30-0.50 | 10-15 | Livox Mid-360 |

**Strengths:**
- Works with any LiDAR sensor (especially strong with solid-state)
- Very fast (real-time even on ARM platforms)
- Robust without feature extraction
- Well-maintained open source with large community

**Weaknesses:**
- No loop closure (odometry only, accumulates drift)
- No GPS integration in base implementation
- EKF formulation less flexible than factor graph for multi-sensor fusion

---

## 5. CT-ICP

### 5.1 Overview

**CT-ICP** (Continuous-Time ICP) was introduced by Dellenbach et al. (ICRA 2022, Kitware / MINES ParisTech) to address the problem of motion distortion during LiDAR scans. Rather than treating each scan as a rigid snapshot, CT-ICP models the continuous trajectory of the sensor during the scan acquisition.

**Paper:** "CT-ICP: Real-time Elastic LiDAR Odometry with Loop Closure" (ICRA 2022)
**Code:** `https://github.com/jedeschaud/ct_icp` (MIT License, C++)

### 5.2 The Motion Distortion Problem

```
Standard ICP assumption:
  All points in a scan are captured at the same timestamp
  → A single rigid transform T aligns the scan to the map

Reality for spinning LiDARs:
  A Velodyne HDL-64E at 10Hz takes 100ms per revolution
  At 30 m/s (highway): vehicle moves 3 meters during one scan
  → Points at the start and end of the scan are captured 3m apart
  → Single rigid transform is wrong

Traditional solution: deskewing
  1. Use IMU or previous velocity estimate to predict motion during scan
  2. Transform each point to a common timestamp (start or end of scan)
  3. Then apply standard rigid ICP
  → Depends on accuracy of motion estimate (chicken-and-egg problem)

CT-ICP solution: optimize two poses simultaneously
```

### 5.3 Continuous-Time Formulation

```
Key idea: Instead of one transform T per scan, optimize TWO transforms:

  T_begin: pose at the start of the scan (time t_0)
  T_end:   pose at the end of the scan (time t_0 + Δt)

  For a point p_i captured at time t_i ∈ [t_0, t_0 + Δt]:
    α_i = (t_i - t_0) / Δt    (interpolation factor, 0 to 1)

    T(α_i) = SLERP(T_begin, T_end, α_i)    (spherical linear interpolation)

  The point in map frame:
    p_i^map = T(α_i) · p_i

  Objective: minimize point-to-plane distances with continuous-time transforms:
    min_{T_begin, T_end} Σ_i ||n_i^T · (T(α_i) · p_i - q_i)||²

  This jointly optimizes:
    - Motion compensation (each point gets its own transform)
    - Registration (alignment to map)
    → No separate deskewing step needed
    → More accurate because registration and deskewing are coupled

Elastic formulation:
  Additional regularization term:
    λ · ||T_begin^{-1} · T_end - I||²
  → Penalizes large intra-scan motion (smoothness prior)
  → Prevents degenerate solutions where T_begin and T_end diverge wildly
```

### 5.4 Performance

| Dataset | ATE (m) | RPE Trans (%) | RPE Rot (deg/m) | Notes |
|---------|---------|---------------|-----------------|-------|
| KITTI 00-10 (avg) | ~0.55 | 0.49 | 0.17 | State-of-the-art at publication |
| KITTI 00 | 0.60 | 0.51 | 0.18 | Long urban loop |
| KITTI 08 | 1.10 | 0.88 | 0.26 | Longest sequence |
| Newer College | 0.12 | - | - | Handheld |

**Handling aggressive motion:**
- CT-ICP excels when the vehicle is moving fast or rotating aggressively
- The continuous-time formulation inherently compensates for motion blur
- At 100 km/h: standard ICP produces ~10cm error per scan; CT-ICP reduces this by 40-60%
- Particularly relevant for highway driving and fast-moving robots

### 5.5 Loop Closure

CT-ICP includes an optional loop closure module:

```
1. Place recognition: radius search in position space + ICP verification
2. Pose graph optimization: correct accumulated drift
3. Elastic map correction: all poses in the loop are adjusted
```

### 5.6 Airside Relevance

For airport operations at low speed (5-25 km/h), the motion distortion problem is less severe. A vehicle moving at 10 km/h during a 100ms LiDAR scan moves only 28cm. Standard deskewing handles this adequately. CT-ICP's advantage is marginal at airside speeds, making it less relevant than systems optimized for other properties (robustness, multi-sensor fusion).

---

## 6. Point-LIO

### 6.1 Overview

**Point-LIO** was introduced by He et al. (Advanced Intelligent Systems, 2023, University of Hong Kong, MARS Lab — same group as FAST-LIO2) as a LiDAR-inertial odometry system that processes points individually rather than accumulating scans, achieving extremely low latency.

**Paper:** "Point-LIO: Robust High-Bandwidth Lidar-Inertial Odometry" (2023)
**Code:** `https://github.com/hku-mars/Point-LIO` (GPL-2.0 License, C++/ROS)

### 6.2 Key Innovation: Per-Point Processing

```
Conventional approach (FAST-LIO2, LIO-SAM, etc.):
  1. Accumulate all points in one LiDAR scan (~100ms for 10Hz LiDAR)
  2. Process entire scan as a batch
  3. Output one pose per scan
  → Latency = scan period (100ms at 10Hz)
  → Output rate = LiDAR rate (10-20Hz)

Point-LIO approach:
  1. Process each point as it arrives (streaming)
  2. IMU propagates state between points
  3. Each point triggers an EKF update
  4. Output pose at every point timestamp
  → Latency ≈ IMU propagation time (~0.1-0.5ms per point)
  → Output rate = point rate (100kHz-1MHz depending on LiDAR)
  → "Sub-millisecond" processing per point

Why this works:
  - Modern LiDARs output points sequentially (not all at once)
  - Each point provides one constraint (point-to-plane residual)
  - IMU provides high-rate prediction between points
  - EKF update with one measurement is very fast:
    Single-point update: O(n²) where n=18 (state dim) → ~10μs
```

### 6.3 Stochastic Process Model

```
Point-LIO models the IMU measurements as stochastic processes
rather than using standard IMU preintegration:

Standard approach:
  ω(t) = ω_true(t) + b_g + n_g           (gyroscope model)
  a(t) = R^T · (a_true(t) - g) + b_a + n_a  (accelerometer model)
  b_g, b_a modeled as random walks

Point-LIO:
  Adds angular acceleration and jerk as state variables:
  x = [R, p, v, ω, a, b_g, b_a, g]  (24-dim state)

  The angular velocity ω and linear acceleration a are estimated
  as part of the state, not just integrated from IMU.

  This allows:
  - Higher-order motion prediction between points
  - Better handling of aggressive/jerky motion
  - More accurate state at each point timestamp
```

### 6.4 Performance

| Dataset | ATE (m) | Processing per point | Notes |
|---------|---------|---------------------|-------|
| KITTI (avg) | 0.6-1.0 | ~0.1ms | With Velodyne HDL-64E |
| Aggressive motion | 0.3-0.5 | ~0.1ms | Custom aggressive datasets |
| Newer College | 0.08-0.12 | ~0.05ms | Ouster OS0-128 |

**Advantages:**
- Ultra-low latency — state available at every point timestamp
- Extremely robust to aggressive motion (high angular velocity, sudden stops)
- No motion distortion by construction (each point processed at its own timestamp)

**Disadvantages:**
- High CPU load (processing every point individually)
- Requires tightly synchronized IMU-LiDAR
- No loop closure
- Complex implementation
- Marginal benefit at low speeds

### 6.5 Airside Relevance

Point-LIO's primary advantages (sub-millisecond latency, aggressive motion robustness) are largely irrelevant for airside operations where vehicles move at 5-25 km/h with smooth trajectories. The computational overhead of per-point processing is not justified when standard 10Hz scan processing provides adequate latency for low-speed navigation. Point-LIO's stochastic process model is, however, theoretically interesting for handling sudden stops (e-braking) or unexpected jerks.

---

## 7. Comparison Table

### 7.1 Algorithm Feature Matrix

| Algorithm | Year | Sensors | Registration | Map Structure | Feature Extraction | Loop Closure | GPS Factor | Framework |
|-----------|------|---------|-------------|---------------|-------------------|-------------|-----------|-----------|
| **KISS-ICP** | 2023 | LiDAR only | Point-to-Point ICP | Voxel hash map | None (raw points) | No | No | Standalone |
| **LIO-SAM** | 2020 | LiDAR + IMU | Feature ICP (edge+plane) | Keyframe submaps | Yes (LOAM-style) | Yes | Yes | GTSAM (iSAM2) |
| **Faster-LIO** | 2022 | LiDAR + IMU | Point-to-Plane ICP | iVox (voxel hash) | None (direct) | No | No | IEKF |
| **FAST-LIO2** | 2022 | LiDAR + IMU | Point-to-Plane ICP | ikd-tree | None (direct) | No | No | IEKF |
| **CT-ICP** | 2022 | LiDAR only | Continuous-Time ICP | Voxel map | None (direct) | Optional | No | Standalone |
| **Point-LIO** | 2023 | LiDAR + IMU | Point-to-Plane (per-point) | ikd-tree | None (direct) | No | No | IEKF |
| **VGICP** (reference airside AV stack) | 2021 | LiDAR (+ GPU) | Distribution-to-Distribution | Voxel Gaussians | None (direct) | No | Via GTSAM | GTSAM |

### 7.2 Quantitative Performance Comparison (KITTI Benchmark)

| Algorithm | Avg ATE (m) | Avg RPE Trans (%) | Avg RPE Rot (deg/m) | Speed (Hz) | Compute |
|-----------|-------------|-------------------|---------------------|------------|---------|
| **KISS-ICP** | ~0.50 | ~0.50 | ~0.17 | 100+ | CPU |
| **LIO-SAM** | ~0.70 | ~0.55 | ~0.20 | 15-20 | CPU |
| **Faster-LIO** | ~0.65 | ~0.52 | ~0.18 | 50-100 | CPU |
| **FAST-LIO2** | ~0.80 | ~0.58 | ~0.19 | 30-50 | CPU |
| **CT-ICP** | ~0.55 | ~0.49 | ~0.17 | 15-30 | CPU |
| **Point-LIO** | ~0.60 | ~0.52 | ~0.18 | Per-point | CPU |
| **VGICP** | ~0.40* | ~0.45* | ~0.15* | 50-100 | GPU |

*VGICP numbers are for scan-to-map matching against a pre-built map (localization), not odometry. Direct comparison is not meaningful — VGICP has the advantage of a pre-built reference.

**Notes on KITTI performance:**
- KITTI numbers vary significantly by sequence (00-10 have different characteristics)
- Most algorithms perform best on sequences with abundant geometric structure (urban areas with buildings)
- Sequences 01 (highway) and 08 (long loop without closure) are hardest
- All modern methods achieve < 1% translational drift on KITTI, making differences marginal for most applications

### 7.3 Map Management Comparison

| Algorithm | Map Type | Insertion | NN Query | Memory | Dynamic Cleanup |
|-----------|----------|-----------|----------|--------|----------------|
| **KISS-ICP** | Voxel hash | O(1) | O(1) avg | Bounded (max pts/voxel) | Distance-based culling |
| **LIO-SAM** | Keyframe submaps | O(1) per keyframe | O(log N) via kd-tree | Grows with trajectory | Keyframe selection |
| **Faster-LIO** | iVox hash | O(1) | O(1) avg | Bounded (max pts/voxel) | Oldest point replacement |
| **FAST-LIO2** | ikd-tree | O(log N) | O(log N) | Grows with map | Box-wise lazy delete |
| **CT-ICP** | Voxel grid | O(1) | O(1) avg | Bounded | Sliding window |
| **Point-LIO** | ikd-tree | O(log N) | O(log N) | Grows with map | Box-wise lazy delete |

### 7.4 Code Availability and Ecosystem

| Algorithm | License | Language | ROS1 | ROS2 | Python API | Active Maintenance |
|-----------|---------|----------|------|------|------------|-------------------|
| **KISS-ICP** | MIT | C++/Python | Yes | Yes | Yes (pip install) | Very active (PRBonn) |
| **LIO-SAM** | BSD-3 | C++ | Yes | Yes (community) | No | Moderate |
| **Faster-LIO** | GPL-2.0 | C++ | Yes | No | No | Limited |
| **FAST-LIO2** | GPL-2.0 | C++ | Yes | Yes (community) | No | Active (MARS Lab) |
| **CT-ICP** | MIT | C++ | Partial | No | No | Limited |
| **Point-LIO** | GPL-2.0 | C++ | Yes | No | No | Active (MARS Lab) |

---

## 8. Best Algorithm for Airside Operations

### 8.1 Airside-Specific Requirements

Airport airside autonomous vehicles operate under a unique set of constraints:

```
Operational characteristics:
  1. Low speed: 5-25 km/h (baggage tractors, pushback tugs)
  2. Flat terrain: near-zero pitch/roll (aprons, taxiways)
  3. Large open areas: aprons with 100m+ of featureless flat concrete
  4. Multi-LiDAR: 4-8 sensors for 360° coverage around vehicle and cargo
  5. cm-level accuracy: stand positioning, centerline following
  6. Existing GTSAM stack: reference airside AV stack already uses iSAM2 factor graph
  7. GPS availability: intermittent (multipath from aircraft, terminals)
  8. Pre-built maps: currently used (PCD maps, 166-287MB)
  9. Dynamic obstacles: aircraft, GSE, ground crew
  10. Safety-critical: ISO 3691-4 compliance required
```

### 8.2 Algorithm Scoring Matrix for Airside

| Criterion | Weight | KISS-ICP | LIO-SAM | Faster-LIO | FAST-LIO2 | CT-ICP | Point-LIO |
|-----------|--------|----------|---------|------------|-----------|--------|-----------|
| Degeneracy robustness (open areas) | 25% | 6 | 5 | 7 | 7 | 5 | 7 |
| GTSAM integration | 20% | 5 | 10 | 3 | 3 | 3 | 3 |
| Multi-LiDAR support | 15% | 9 | 5 | 6 | 6 | 7 | 5 |
| cm-level accuracy | 15% | 7 | 7 | 8 | 8 | 7 | 7 |
| Compute efficiency | 10% | 9 | 5 | 8 | 7 | 6 | 4 |
| Loop closure | 5% | 0 | 10 | 0 | 0 | 5 | 0 |
| Code quality / maintenance | 5% | 10 | 7 | 4 | 7 | 4 | 5 |
| GPS factor support | 5% | 0 | 10 | 0 | 0 | 0 | 0 |
| **Weighted Score** | **100%** | **5.9** | **6.6** | **5.5** | **5.7** | **5.0** | **5.0** |

### 8.3 Recommended Architecture: Hybrid LIO-SAM + KISS-ICP

The optimal architecture for airside operations is not a single algorithm but a hybrid approach that leverages the strengths of multiple systems within the reference airside AV stack's existing GTSAM factor graph:

```
Recommended Airside Localization Stack:
═══════════════════════════════════════

  ┌────────────────────────────────────────────────────────────────┐
  │                    GTSAM Factor Graph (iSAM2)                 │
  │                                                                │
  │  Factor 1: IMU Preintegration (existing)                      │
  │    - 500Hz IMU → preintegrated between keyframes              │
  │    - Provides short-term motion prediction                    │
  │                                                                │
  │  Factor 2: VGICP LiDAR-to-Map (existing, primary)            │
  │    - Scan-to-map matching against pre-built PCD map           │
  │    - GPU-accelerated, 10Hz                                    │
  │    - PRIMARY localization source when map available            │
  │    - ADD: degeneracy detection → adjust noise model when      │
  │      matching quality degrades (see Section 10)                │
  │                                                                │
  │  Factor 3: KISS-ICP Odometry (NEW, secondary)                 │
  │    - Frame-to-frame odometry as BetweenFactor                 │
  │    - No GPU needed, runs on CPU                               │
  │    - Provides odometry when VGICP map matching fails          │
  │    - Adaptive threshold handles varying environments          │
  │    - Multi-LiDAR: merge point clouds, run single KISS-ICP     │
  │                                                                │
  │  Factor 4: GPS/RTK (existing)                                 │
  │    - Unary factor when fix available                          │
  │    - Noise scaled by fix quality                              │
  │                                                                │
  │  Factor 5: Wheel Odometry (existing)                          │
  │    - BetweenFactor from wheel encoders                        │
  │    - Reliable at low speed on flat terrain                    │
  │                                                                │
  │  Factor 6: Loop Closure (NEW, from LIO-SAM module)            │
  │    - ICP-based loop detection and verification                │
  │    - Adds BetweenFactor when revisiting locations             │
  │    - Critical for long autonomous operations (shift-length)   │
  │                                                                │
  │  Factor 7: Level Constraint (existing)                        │
  │    - Roll ≈ 0, pitch ≈ 0 prior                               │
  │    - Strong prior given flat airport terrain                  │
  │                                                                │
  │  Degeneracy Monitor (NEW):                                    │
  │    - Monitors eigenvalues of VGICP Hessian                   │
  │    - When min eigenvalue drops below threshold:               │
  │      → Inflate VGICP noise model (reduce trust)              │
  │      → Increase trust in wheel odometry + IMU                │
  │      → Log warning for operator                              │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

### 8.4 Why This Hybrid

**Why KISS-ICP as secondary odometry (not FAST-LIO2 or Faster-LIO):**
1. **No IMU dependency** — KISS-ICP uses LiDAR only, avoiding IMU double-counting since IMU is already in the factor graph as a separate preintegration factor
2. **Trivial multi-LiDAR** — merge 4-8 LiDAR point clouds into one, pass to KISS-ICP. No timestamp synchronization issues because KISS-ICP uses constant velocity model, not IMU
3. **CPU-only** — leaves GPU for VGICP (already GPU-dependent) and perception models
4. **Adaptive threshold** — self-tunes across structured (near terminal) and unstructured (open apron) areas
5. **MIT license** — no GPL concerns for commercial deployment
6. **pip-installable** — `pip install kiss-icp`, fastest path to integration and prototyping

**Why LIO-SAM's loop closure module (not full LIO-SAM):**
1. the reference airside AV stack's existing GTSAM graph already handles IMU + LiDAR + GPS + wheel odometry
2. Replacing the full stack with LIO-SAM would lose VGICP map-matching and wheel odometry
3. LIO-SAM's loop closure detection and factor addition are modular and can be extracted
4. The loop closure BetweenFactor is compatible with any GTSAM-based graph

**Why not replace VGICP entirely:**
1. VGICP scan-to-map matching provides **absolute** positioning (within the pre-built map frame)
2. Odometry (KISS-ICP, FAST-LIO2) provides only **relative** positioning — drift accumulates
3. For cm-level accuracy at aircraft stands, absolute positioning is essential
4. VGICP is already integrated, tested, and GPU-accelerated in the reference airside AV stack's stack

### 8.5 Multi-LiDAR Handling

```
the reference airside AV stack's multi-LiDAR setup (4-8 sensors):

Option A: Merge-then-register (recommended for KISS-ICP odometry)
  1. Transform all LiDAR points to vehicle body frame using known extrinsics
  2. Merge into single point cloud (100K-500K points depending on sensor count)
  3. Voxel downsample to ~20K points
  4. Run KISS-ICP on merged cloud
  → Simple, robust, one odometry estimate per frame
  → Requires accurate extrinsic calibration

Option B: Per-sensor odometry with fusion
  1. Run separate KISS-ICP instance per LiDAR
  2. Each produces an odometry factor in the GTSAM graph
  3. GTSAM optimally fuses all estimates
  → More robust to individual sensor failures
  → Higher computational cost (4-8x)
  → Extrinsic calibration errors affect each estimate differently

Option C: Multi-LiDAR VGICP (current reference airside AV stack approach)
  1. Merge point clouds in vehicle frame
  2. Match merged cloud against pre-built map via VGICP
  → Works well when map is available
  → Fails in unmapped areas

Recommendation: Option A for KISS-ICP odometry + Option C for VGICP localization
  → KISS-ICP provides relative motion (always available)
  → VGICP provides absolute position (when map available)
  → GTSAM fuses both optimally
```

### 8.6 Implementation Roadmap

```
Phase 1: Add KISS-ICP odometry factor (2-3 weeks)
  - pip install kiss-icp
  - Write ROS node that subscribes to merged LiDAR topic
  - Compute relative transform between consecutive scans
  - Publish as BetweenFactor to GTSAM graph
  - Validate: compare KISS-ICP odometry vs wheel odometry
  - Test: temporarily disable VGICP, drive on KISS-ICP + IMU + wheel only

Phase 2: Degeneracy detection (2-3 weeks)
  - Instrument VGICP with Hessian eigenvalue monitoring
  - Define threshold for degeneracy warning
  - Implement adaptive noise model scaling
  - Test on open apron areas — verify system remains stable

Phase 3: Loop closure (3-4 weeks)
  - Extract LIO-SAM loop closure module
  - Integrate with GTSAM graph as additional factor
  - Implement place recognition (scan context or radius search)
  - Test on multi-hour autonomy runs — verify drift correction

Phase 4: Map building with KISS-ICP (2-3 weeks)
  - Use KISS-ICP + loop closure for initial map generation
  - Compare against current manual survey process
  - Goal: reduce per-airport mapping time from days to hours
```

---

## 9. Adding Learned Features

### 9.1 Motivation

Classical ICP-based methods match points based on geometric proximity. In featureless environments (open aprons, flat terrain with minimal structure), geometric matching degenerates because many points look identical. Learned features add discriminative power by encoding local and global context.

### 9.2 Deep ICP and Neural Point Matching

**DCP (Deep Closest Point)** (Wang & Solomon, ICCV 2019):
```
Architecture:
  1. DGCNN feature extraction: encode each point with local neighborhood context
     Input: (N, 3)  →  Output: (N, 512)  per-point features
  2. Attention-based soft correspondence:
     Instead of nearest-neighbor: learn attention weights between source and target
     Correspondence matrix: A = softmax(F_source · F_target^T / √d)
  3. SVD-based pose estimation:
     From soft correspondences → weighted SVD → rigid transform

Advantages over classical ICP:
  - Correspondences are learned (robust to partial overlap, noise)
  - Global context via attention (not just local geometry)
  - Differentiable end-to-end (can be trained with supervision)

Limitations:
  - Requires training data with known ground truth transforms
  - Generalization across domains is limited
  - Slower than classical ICP (~50ms vs ~5ms)
```

**PointNetLK** (Aoki et al., CVPR 2019):
```
Combines PointNet global features with Lucas-Kanade alignment:
  1. PointNet extracts global feature vector φ(P)
  2. Iteratively aligns source to target by minimizing ||φ(T·P) - φ(Q)||²
  3. Jacobian computed analytically from PointNet

→ Robust to initialization, works with partial overlap
→ But: global feature loses local detail, poor on large point clouds
```

**GenZ-ICP** (2024):
```
Specifically designed for degeneracy-robust ICP:
  1. Adaptive per-point weighting based on learned geometric saliency
  2. Points in geometrically distinctive areas get higher weight
  3. Points on flat/featureless surfaces get lower weight
  → ICP focuses on informative points, ignoring degenerate dimensions

Directly relevant to airside: learns to downweight ground plane points
(which dominate in open apron) and upweight structural elements
(terminal walls, equipment, aircraft geometry)
```

### 9.3 OverlapTransformer for Place Recognition

**OverlapTransformer** (Ma et al., RAL 2022):

```
Purpose: LiDAR-based place recognition for loop closure detection

Architecture:
  1. Range image generation: project 3D point cloud to 2D range image
     (H × W × C where H=64 elevation bins, W=900 azimuth bins, C=1 range channel)

  2. Feature extraction: lightweight CNN (NetVLAD-style) on range image
     → Compact descriptor vector (256-dim)

  3. Overlap estimation: transformer-based overlap predictor
     Takes two descriptors → predicts overlap ratio and yaw offset

  4. Loop closure: find previous frames with high overlap
     → Database search with descriptor matching (cosine similarity)
     → Yaw-invariant matching handles different approach directions

Performance:
  - KITTI: 94.7% recall@1 (top-1 retrieval accuracy)
  - Runs at 100+ Hz on GPU
  - Compact descriptors enable fast retrieval in large databases

Integration with KISS-ICP/GTSAM:
  1. Maintain database of OverlapTransformer descriptors at each keyframe
  2. For each new keyframe: query database for similar frames
  3. If match found: verify with ICP registration
  4. If ICP succeeds: add loop closure BetweenFactor to GTSAM graph
```

**Alternative: Scan Context** (Kim & Kim, IROS 2018):
```
Handcrafted descriptor (no learning required):
  1. Divide polar space around sensor into sectors and rings
  2. Encode maximum height in each bin → 2D matrix
  3. Match by column-shifted cosine distance (rotation invariant)

Simpler, faster, no training needed, but less robust than learned methods.
Already used in LIO-SAM and many SLAM systems.
```

### 9.4 Learned Feature Integration Architecture

```
Proposed architecture for airside:

  LiDAR Point Cloud
      │
      ├── Classical: KISS-ICP registration (always runs)
      │     → Relative transform T_classical
      │     → Fitness score s_classical
      │
      ├── Learned: Per-point feature extraction (when quality drops)
      │     → GenZ-ICP adaptive weighting
      │     → Enhanced ICP with learned saliency
      │     → Relative transform T_learned
      │     → Fitness score s_learned
      │
      └── Place Recognition: OverlapTransformer (at keyframe rate)
            → Loop closure candidates
            → Verified by ICP
            → Loop closure factor

  Selection logic:
    if s_classical > threshold:
      use T_classical (fast, reliable)
    else:
      use T_learned (slower, more robust)

  This two-tier approach avoids the computational cost of neural inference
  except when classical methods struggle.
```

### 9.5 Training Data for Airport Domain

```
Challenge: no public dataset of airport LiDAR data for training learned features.

Approach 1: Self-supervised learning
  - Use KISS-ICP on the reference airside AV stack's collected data to generate pseudo-ground-truth
  - Train contrastive features: same location → similar features, different → dissimilar
  - No manual annotation needed

Approach 2: Simulation
  - Generate synthetic airport scans in CARLA/IsaacSim
  - Train initial model on synthetic data
  - Fine-tune on real airport data (sim-to-real transfer)

Approach 3: Transfer from road domain
  - Pre-train on KITTI/nuScenes (abundant labeled data)
  - Fine-tune on airport data
  - Geometric features largely transfer (ground plane, vertical structures)
```

---

## 10. Degeneracy Detection and Handling

### 10.1 What is Degeneracy?

Degeneracy in LiDAR SLAM occurs when the environment provides insufficient geometric constraints to uniquely determine the sensor pose. The optimization problem becomes ill-conditioned — multiple poses produce equally good alignment scores.

```
Classic degenerate environments:
  1. Long corridors: unconstrained along corridor axis
  2. Open fields: unconstrained in all horizontal directions (only ground plane)
  3. Tunnels: unconstrained along tunnel axis
  4. Flat terrain with no vertical features: unconstrained in x, y, yaw
  5. Symmetric environments: multiple solutions with similar cost

Airport-specific degeneracy scenarios:
  ┌─────────────────────────────────────────────────────┐
  │  Open apron (worst case):                           │
  │    - 100m+ of flat concrete with painted lines      │
  │    - No vertical structures nearby                  │
  │    - Ground plane constrains z, roll, pitch only    │
  │    - x, y, yaw are UNCONSTRAINED                   │
  │    → LiDAR odometry will drift in these 3 DoF      │
  │                                                     │
  │  Near terminal (best case):                         │
  │    - Building facade provides planar constraint     │
  │    - Jet bridges provide edge features              │
  │    - Parked aircraft provide rich 3D structure      │
  │    - All 6 DoF well-constrained                     │
  │                                                     │
  │  Taxiway between buildings (moderate):              │
  │    - Some structure from buildings at distance       │
  │    - Long straight sections may be under-constrained │
  │    - Taxiway lights provide periodic point features  │
  └─────────────────────────────────────────────────────┘
```

### 10.2 Detection Methods

#### 10.2.1 Hessian Eigenvalue Analysis (Most Common)

```
The ICP objective function:
  E(T) = Σ_i ||n_i^T · (T · p_i - q_i)||²

The Hessian H = ∂²E/∂T² is a 6×6 matrix (for SE(3)):
  H = J^T · J  where J is the stacked Jacobian of all residuals

Eigenvalue decomposition: H = V · Λ · V^T
  Eigenvalues λ_1 ≥ λ_2 ≥ ... ≥ λ_6

Interpretation:
  λ_i large  → pose is well-constrained in direction v_i
  λ_i small  → pose is poorly constrained in direction v_i
  λ_i ≈ 0   → pose is completely unconstrained in direction v_i

Degeneracy detection:
  if λ_min < τ_degen:
    DEGENERATE — at least one direction is unconstrained

  Degeneracy ratio: r = λ_min / λ_max
  if r < τ_ratio (e.g., 0.001):
    ILL-CONDITIONED — some directions much weaker than others

Example for open apron:
  λ_1 ≈ 10000 (z constrained by ground plane)
  λ_2 ≈ 10000 (roll constrained by ground plane)
  λ_3 ≈ 10000 (pitch constrained by ground plane)
  λ_4 ≈ 5     (x poorly constrained — no features)
  λ_5 ≈ 5     (y poorly constrained — no features)
  λ_6 ≈ 2     (yaw poorly constrained — no features)
  → r = 2/10000 = 0.0002 → DEGENERATE in x, y, yaw
```

#### 10.2.2 Zhang and Singh's Solution-Remapping (LOAM)

```
From Zhang & Singh (IROS 2013, CMU):

After solving ICP for the transform δx:
  1. Compute H = J^T · J
  2. Eigendecompose: H = V · Λ · V^T
  3. Identify degenerate directions: eigenvalues below threshold
  4. Construct "safe" transform by zeroing out degenerate components:

     V_safe = columns of V corresponding to λ_i > τ
     δx_safe = V_safe · V_safe^T · δx

  This projects the solution onto the well-constrained subspace.
  Degenerate directions retain the IMU/odometry prediction instead.

Effect: the system "trusts" LiDAR only in directions where it provides
good constraints, and falls back to IMU in unconstrained directions.
```

#### 10.2.3 DALI-SLAM Degeneracy-Aware Approach

```
DALI-SLAM (2024) extends degeneracy detection with:

  1. Geometric degeneracy classification:
     - Analyze point cloud distribution using PCA on local neighborhoods
     - Classify regions as: planar, linear, spherical, or degenerate
     - Count informative (non-planar) points per direction

  2. Adaptive weighting in factor graph:
     - Directions with many informative points: low noise (high trust)
     - Directions with few informative points: high noise (low trust)
     - Noise model becomes direction-dependent (anisotropic)

  3. Distortion correction:
     - Novel continuous-time distortion correction
     - Handles cases where motion estimate is poor due to degeneracy
```

#### 10.2.4 GenZ-ICP Approach

```
GenZ-ICP (2024) handles degeneracy through learned adaptive weighting:

  1. For each point correspondence (p_i, q_i):
     Compute geometric features:
       - Local planarity (from PCA of neighborhood)
       - Local linearity
       - Normal consistency between source and target

  2. Neural network predicts per-correspondence weight w_i:
     w_i = f_θ(geometric_features_i)

  3. Weighted ICP objective:
     E(T) = Σ_i w_i · ||n_i^T · (T · p_i - q_i)||²

  4. Points on degenerate surfaces (flat ground) get low weight
     Points on distinctive features (corners, edges) get high weight

  → ICP automatically focuses on informative correspondences
  → Graceful degradation rather than catastrophic failure
```

### 10.3 Handling Strategies for Airside

```
Strategy 1: Sensor fusion with adaptive noise (RECOMMENDED)
  ┌──────────────────────────────────────────────────────┐
  │  Degeneracy Monitor continuously evaluates:          │
  │    - VGICP Hessian eigenvalues                       │
  │    - KISS-ICP registration fitness                   │
  │    - Number of inlier correspondences                │
  │                                                      │
  │  When degeneracy detected:                           │
  │    1. Inflate LiDAR factor noise (in GTSAM graph)    │
  │       σ_lidar → σ_lidar × (λ_max / λ_min)^{0.5}    │
  │    2. Increase trust in wheel odometry               │
  │       (reliable at low speed on flat ground)          │
  │    3. Increase trust in GPS/RTK (if available)       │
  │    4. Engage "degeneracy mode" warning to operator   │
  │                                                      │
  │  The GTSAM graph automatically reweights factors:    │
  │    - In structured areas: LiDAR dominates            │
  │    - In open areas: wheel odom + GPS dominate        │
  │    - Transition is smooth (no hard switching)         │
  └──────────────────────────────────────────────────────┘

Strategy 2: Solution-space remapping (more aggressive)
  - Apply Zhang-Singh solution remapping to VGICP
  - Only trust LiDAR in well-constrained directions
  - Use IMU/wheel odometry for unconstrained directions
  - Requires modifying VGICP to expose Hessian
  - More complex but theoretically optimal

Strategy 3: Environment augmentation (infrastructure-based)
  - Place retroreflective targets or poles in open areas
  - LiDAR easily detects high-intensity reflectors
  - Provides reliable geometric features in otherwise featureless areas
  - Cost: minimal (reflective posts/signs)
  - Limitation: requires installation and maintenance at each airport

Strategy 4: Multi-LiDAR viewpoint diversity
  - 4-8 LiDARs at different heights and orientations
  - Ground-pointing LiDAR may see surface texture/markings
  - Elevated LiDAR may see distant structures not visible from low mount
  - Different viewpoints reduce the chance of total degeneracy
  - Already partially implemented in the reference airside AV stack's sensor configuration
```

### 10.4 Quantifying Degeneracy Risk at Airports

```
Risk assessment by airport zone:

  Terminal/Gate area:     LOW degeneracy risk
    - Rich structure: building facades, jet bridges, parked aircraft
    - Typical λ_min/λ_max > 0.1
    - LiDAR provides cm-level accuracy

  Taxiway near buildings: LOW-MEDIUM risk
    - Some structure from buildings at 50-100m
    - Taxiway lights and signs provide features
    - Typical λ_min/λ_max > 0.01
    - LiDAR accuracy: 5-10cm

  Open apron (no aircraft): HIGH risk
    - Flat concrete with only painted markings
    - Nearest structure may be >100m away
    - Typical λ_min/λ_max < 0.001
    - LiDAR may provide <1m accuracy in x,y
    - Must rely on GPS + wheel odometry

  Apron with parked aircraft: LOW-MEDIUM risk
    - Aircraft fuselage and engines provide rich geometry
    - But geometry changes as aircraft arrive/depart
    - Pre-built map may not match current aircraft positions
    - Need online mapping capability

  Runway crossing:        MEDIUM risk
    - Wide open area (45-60m wide)
    - Approach lights and signs at edges
    - Short duration crossing reduces drift accumulation

Mitigation priority:
  Focus degeneracy handling on open apron operations.
  This is where the vehicle is most likely to operate without
  nearby structure and where GPS multipath is also common
  (signal reflection from aircraft fuselage).
```

### 10.5 Testing Degeneracy Detection

```
Recommended test protocol:

Test 1: Progressive feature removal
  - Drive near terminal (rich features) → record baseline accuracy
  - Drive to open apron (fewer features) → measure accuracy degradation
  - Monitor λ_min/λ_max throughout
  - Verify: degeneracy detector triggers before accuracy drops below threshold

Test 2: Simulated GPS outage + degeneracy
  - In open area: mask GPS factor (set σ → ∞)
  - Run on LiDAR + IMU + wheel odometry only
  - Measure: how far can the vehicle travel before position error exceeds 50cm?
  - With degeneracy detection: system should report uncertainty honestly

Test 3: Reference trajectory comparison
  - Use RTK-GPS as ground truth
  - Compare LiDAR-only odometry error vs fused estimate error
  - In structured area: both should be similar
  - In open area: fused estimate should be significantly better

Test 4: Retroreflector test
  - Place retroreflective poles in open apron area
  - Measure: how many poles needed per area to maintain cm-level accuracy?
  - Expected: 3-4 poles visible at any time sufficient for full 6-DoF constraint
```

---

## References

### Primary Papers

1. Vizzo, I., Guadagnino, T., Mersch, B., Wiesmann, L., Behley, J., & Stachniss, C. (2023). "KISS-ICP: In Defense of Point-to-Point ICP -- Simple, Accurate, and Robust Registration If Done Right." *IEEE Robotics and Automation Letters (RA-L)*, 8(2), 1029-1036.

2. Shan, T., Englot, B., Meyers, D., Wang, W., Ratti, C., & Daniela, R. (2020). "LIO-SAM: Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping." *IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS)*.

3. Bai, C., Xiao, T., Chen, Y., Wang, H., Zhang, F., & Gao, X. (2022). "Faster-LIO: Lightweight Tightly Coupled Lidar-Inertial Odometry Using Parallel Sparse Incremental Voxels." *IEEE Robotics and Automation Letters (RA-L)*, 7(2), 4861-4868.

4. Xu, W., Cai, Y., He, D., Lin, J., & Zhang, F. (2022). "FAST-LIO2: Fast Direct LiDAR-Inertial Odometry." *IEEE Transactions on Robotics (TRO)*, 38(4), 2053-2073.

5. Dellenbach, P., Deschaud, J.E., Jacquet, B., & Goulette, F. (2022). "CT-ICP: Real-time Elastic LiDAR Odometry with Loop Closure." *IEEE International Conference on Robotics and Automation (ICRA)*.

6. He, D., Xu, W., Chen, N., Kong, F., Yuan, C., & Zhang, F. (2023). "Point-LIO: Robust High-Bandwidth Lidar-Inertial Odometry." *Advanced Intelligent Systems*, 5(7).

7. Koide, K., Yokozuka, M., Oishi, S., & Banno, A. (2021). "Voxelized GICP for Fast and Accurate 3D Point Cloud Registration." *IEEE International Conference on Robotics and Automation (ICRA)*.

### Degeneracy and Robustness

8. Zhang, J. & Singh, S. (2016). "On Degeneracy of Optimization-based State Estimation Problems." *IEEE International Conference on Robotics and Automation (ICRA)*.

9. Hinduja, A., Kaess, M., & Scherer, S. (2019). "Degeneracy-Aware Factors with Applications to Underwater SLAM." *IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS)*.

10. DALI-SLAM (2024). "Degeneracy-Aware LiDAR-Inertial SLAM with Novel Distortion Correction."

11. GenZ-ICP (2024). "Generalizable and Degeneracy-Robust LiDAR Odometry with Adaptive Weighting."

### Learned Features and Place Recognition

12. Wang, Y. & Solomon, J. (2019). "Deep Closest Point." *IEEE International Conference on Computer Vision (ICCV)*.

13. Ma, J., Zhang, J., Xu, J., Ai, R., Gu, W., & Chen, X. (2022). "OverlapTransformer: An Efficient and Yaw-Angle-Invariant Transformer Network for LiDAR-Based Place Recognition." *IEEE Robotics and Automation Letters (RA-L)*.

14. Kim, G. & Kim, A. (2018). "Scan Context: Egocentric Spatial Descriptor for Place Recognition within 3D Point Cloud Map." *IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS)*.

### Factor Graphs and IMU Preintegration

15. Forster, C., Carlone, L., Dellaert, F., & Scaramuzza, D. (2017). "On-Manifold Preintegration for Real-Time Visual-Inertial Odometry." *IEEE Transactions on Robotics (TRO)*, 33(1), 1-21.

16. Kaess, M., Johannsson, H., Roberts, R., Ila, V., Leonard, J., & Dellaert, F. (2012). "iSAM2: Incremental Smoothing and Mapping Using the Bayes Tree." *International Journal of Robotics Research (IJRR)*, 31(2), 216-235.

### Code Repositories

- KISS-ICP: `https://github.com/PRBonn/kiss-icp` (MIT)
- LIO-SAM: `https://github.com/TixiaoShan/LIO-SAM` (BSD-3)
- FAST-LIO2: `https://github.com/hku-mars/FAST_LIO` (GPL-2.0)
- Faster-LIO: `https://github.com/gaoxiang12/faster-lio` (GPL-2.0)
- CT-ICP: `https://github.com/jedeschaud/ct_icp` (MIT)
- Point-LIO: `https://github.com/hku-mars/Point-LIO` (GPL-2.0)
- OverlapTransformer: `https://github.com/haomo-ai/OverlapTransformer`
- GTSAM: `https://github.com/borglab/gtsam` (BSD)
