# Multi-LiDAR Extrinsic Calibration: Targetless, Online, and Recalibration Methods

## For 4-8 RoboSense LiDAR Stacks on Airside Autonomous Vehicles

*Last updated: 2026-04-11*

---

## Summary

Multi-LiDAR extrinsic calibration is the process of estimating the rigid SE(3) transformation between each LiDAR sensor's coordinate frame and the vehicle body frame, enabling fusion of 4-8 independent point clouds into a single coherent 3D representation. For Aurrigo's airside fleet (4-8 RoboSense RSHELIOS + RSBP per vehicle), calibration accuracy directly determines downstream perception, localization, and safety performance. A 0.1 degree angular error at the sensor produces 17 cm displacement at 100 m range — enough to shift an object between grid cells, create ghost detections at scan boundaries, or degrade GTSAM localization residuals. This document covers the full calibration lifecycle: target-based factory calibration, targetless field methods (ICP, feature-based, learning-based, motion-based), online/continuous calibration integrated with GTSAM, thermal drift compensation across the -10 C to +50 C airport tarmac range, temporal synchronization via PTP/PPS, overlap optimization for sensor placement, calibration quality metrics and health monitoring, and certification requirements under ISO 3691-4. Key finding: a combined approach — factory target-based initialization to <0.5 cm / <0.05 deg, followed by continuous GTSAM-integrated online refinement with thermal compensation lookup tables — achieves sustained sub-centimeter accuracy across operating conditions without manual intervention. For a fleet of 20+ vehicles, automated calibration management saves an estimated 400-800 hours of manual calibration labor per year while providing the traceability records required for safety certification.

---

## Table of Contents

1. [Why Calibration Matters for Multi-LiDAR Stacks](#1-why-calibration-matters-for-multi-lidar-stacks)
2. [Calibration Fundamentals](#2-calibration-fundamentals)
3. [Target-Based Calibration](#3-target-based-calibration)
4. [Targetless Calibration Methods](#4-targetless-calibration-methods)
5. [Online and Continuous Calibration](#5-online-and-continuous-calibration)
6. [Thermal Drift Compensation](#6-thermal-drift-compensation)
7. [Multi-LiDAR Overlap Optimization](#7-multi-lidar-overlap-optimization)
8. [Temporal Synchronization](#8-temporal-synchronization)
9. [Calibration Quality Metrics](#9-calibration-quality-metrics)
10. [Certification Requirements](#10-certification-requirements)
11. [Practical Implementation](#11-practical-implementation)
12. [Key Takeaways](#12-key-takeaways)

---

## 1. Why Calibration Matters for Multi-LiDAR Stacks

### 1.1 The Multi-LiDAR Imperative

Aurrigo's airside vehicles deploy 4-8 RoboSense LiDARs per vehicle for comprehensive 360-degree perception. The specific sensor mix varies by platform:

| Platform | RSHELIOS Count | RSBP Count | Total LiDARs | Notes |
|----------|---------------|------------|---------------|-------|
| ADT3     | 4             | 4          | 8             | Full surround + near-field blind spot |
| STL2     | 4             | 2          | 6             | Forward-biased for towing |
| POD      | 2             | 2          | 4             | Compact platform |
| ACA1     | 4             | 4          | 8             | Full coverage for passenger ops |

Each LiDAR operates independently with its own coordinate frame. Without precise extrinsic calibration:

- Point clouds from adjacent sensors do not align at overlap boundaries
- Objects near sensor boundaries appear duplicated or split
- GTSAM localization residuals increase (degraded map matching)
- Detection networks receive inconsistent fused inputs
- Occupancy grids show artifacts at sensor boundaries

### 1.2 Error Propagation Analysis

The relationship between angular calibration error and point displacement at range:

```
Displacement = Range x tan(angular_error)

For angular_error = 0.1 deg:
  At  10 m:  1.7 cm displacement
  At  30 m:  5.2 cm displacement
  At  50 m:  8.7 cm displacement
  At 100 m: 17.5 cm displacement
  At 150 m: 26.2 cm displacement (RSHELIOS max range)
```

**Impact on downstream systems:**

| Calibration Error | Detection Impact | Localization Impact | Safety Impact |
|-------------------|------------------|---------------------|---------------|
| < 0.02 deg / 0.5 cm | Negligible | < 1 cm GTSAM residual increase | None |
| 0.05 deg / 1 cm | Minor boundary artifacts | 1-3 cm residual increase | Acceptable |
| 0.1 deg / 2 cm | Object splitting at boundaries | 3-5 cm residual increase | Marginal |
| 0.2 deg / 5 cm | Duplicate detections, gaps | 5-10 cm residual increase | Degraded |
| 0.5 deg / 10 cm | Perception failure at boundaries | GTSAM divergence risk | Unsafe |
| > 1.0 deg | Fused cloud unusable | Localization failure | Critical |

For airside operations where personnel detection at close range is safety-critical, even 5 cm displacement can shift a ground crew member's foot between occupied and free voxels in the occupancy grid (see `technology/perception/uncertainty-quantification-calibration.md` for uncertainty propagation details).

### 1.3 Calibration Challenges Specific to Airport Airside

Airport environments introduce unique calibration challenges beyond standard road driving:

**Environmental:**
- Extreme temperature range: -10 C (winter night) to +50 C (summer tarmac surface)
- Jet blast: 200+ km/h wind loads on sensor mounts (structural micro-deformation)
- Vibration: diesel tug engines, rough apron surfaces, speed bumps
- De-icing spray: chemical residue on sensor windows (changes return characteristics)

**Geometric:**
- Large flat surfaces (tarmac, aircraft fuselage) — poor features for registration
- Repetitive structures (terminal buildings, gate numbering) — ambiguous matches
- Massive scale variation: aircraft wingspan 30-65 m vs FOD at 2 cm

**Operational:**
- 24/7 operations — limited downtime for manual recalibration
- Multiple vehicle platforms with different sensor configurations
- Fleet-wide consistency required for reproducible perception
- Safety certification demands documented calibration status

### 1.4 Calibration Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                   CALIBRATION LIFECYCLE                          │
│                                                                 │
│  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌─────────┐ │
│  │ Factory   │───>│ Field     │───>│ Online   │───>│ Recal   │ │
│  │ (Target)  │    │(Targetless│    │(Continuous│    │(Trigger)│ │
│  │           │    │  Refine)  │    │  Monitor) │    │         │ │
│  └──────────┘    └───────────┘    └──────────┘    └─────────┘ │
│       │               │               │               │        │
│   ±0.5cm/0.05°    ±1cm/0.1°      Drift <2cm       Reset to    │
│   Controlled     Any location    GTSAM-fused     ±0.5cm/0.05° │
│   environment    Static vehicle   While driving   Automatic    │
│                                                                 │
│  Frequency:      Frequency:      Frequency:      Frequency:    │
│  Initial setup   Weekly or       Every scan      When drift    │
│  + major repair  after impact    (10 Hz)         > threshold   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Calibration Fundamentals

### 2.1 SE(3) Transformation

The extrinsic calibration between two LiDAR sensors (or between a LiDAR and the vehicle body frame) is a rigid body transformation in SE(3) — the Special Euclidean group in 3D:

```
T = [R | t]    ∈ SE(3) = SO(3) x R^3
    [0 | 1]

Where:
  R ∈ SO(3) is a 3x3 rotation matrix (3 DOF: roll, pitch, yaw)
  t ∈ R^3   is a 3x1 translation vector (3 DOF: x, y, z)
  Total: 6 degrees of freedom per sensor pair
```

For a vehicle with N LiDAR sensors, we need N-1 independent transformations (or equivalently, N transformations to the vehicle body frame). For Aurrigo's 8-LiDAR ADT3, this means **48 parameters** (8 sensors x 6 DOF each, relative to body frame).

**Rotation representations:**

| Representation | Parameters | Singularities | Interpolation | Use Case |
|---------------|------------|---------------|---------------|----------|
| Rotation matrix | 9 (6 constraints) | None | Nontrivial | GTSAM internal |
| Euler angles | 3 | Gimbal lock | Linear (naive) | Human-readable |
| Axis-angle | 3 | At 0 and pi | Nontrivial | Lie algebra / GTSAM |
| Quaternion | 4 (1 constraint) | None | SLERP | ROS TF, storage |
| Rodrigues vector | 3 | At pi | Nontrivial | OpenCV convention |

GTSAM and ROS TF use different internal representations but both support SE(3). The GTSAM `Pose3` class uses rotation matrix internally but accepts axis-angle for optimization on the Lie algebra (see `10-knowledge-base/state-estimation/gtsam-factor-graphs.md`).

### 2.2 Reference Frames

```
                    Vehicle Body Frame (base_link)
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     T_lidar0_body   T_lidar1_body   T_lidarN_body
           │               │               │
      ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
      │ LiDAR 0 │    │ LiDAR 1 │    │ LiDAR N │
      │ Frame   │    │ Frame   │    │ Frame   │
      └─────────┘    └─────────┘    └─────────┘

  Notation:
    T_lidarK_body : Transform that takes points from LiDAR K frame
                    into body frame
    p_body = T_lidarK_body * p_lidarK
```

**ROS TF convention:** Each LiDAR publishes its point cloud in its own frame (`rshelios_0`, `rsbp_0`, etc.). The calibration extrinsics define the static TF from each sensor frame to `base_link`. These are published as `static_transform_publisher` nodes or embedded in the URDF.

**Frame definitions for Aurrigo vehicles:**

| Frame | Origin | X-axis | Y-axis | Z-axis |
|-------|--------|--------|--------|--------|
| `base_link` | Rear axle center, ground plane | Forward | Left | Up |
| `rshelios_N` | LiDAR optical center | Per RoboSense convention (forward) | Left | Up |
| `rsbp_N` | LiDAR optical center (top of dome) | Forward | Left | Up (vertical axis) |
| `imu_link` | IMU center of measurement | Per IMU datasheet | — | — |
| `gps_link` | GPS antenna phase center | — | — | — |

### 2.3 Extrinsic vs Intrinsic Parameters

**Extrinsic parameters** (what this document focuses on):
- 6 DOF rigid transform between each sensor and the vehicle body frame
- Includes LiDAR-to-LiDAR, LiDAR-to-IMU, LiDAR-to-GPS transforms
- Can drift due to mechanical factors (vibration, thermal, impact)

**Intrinsic parameters** (typically factory-calibrated, not user-adjustable):
- Beam elevation angles (per-channel vertical angle)
- Beam azimuth offsets (per-channel horizontal correction)
- Range corrections (per-channel distance bias)
- Timing offsets (per-channel firing time)
- Intensity calibration curves

RoboSense RSHELIOS and RSBP intrinsics are factory-calibrated and embedded in the DIFOP (Device Information Output Protocol) packets. The `rslidar_sdk` ROS driver reads these automatically. Intrinsic errors are typically < 0.05 deg angular and < 1 cm range — much smaller than extrinsic errors from mount misalignment.

### 2.4 Mathematical Formulation

Given point `p_i` in LiDAR frame `i` and the corresponding point `p_j` in LiDAR frame `j`, the extrinsic calibration seeks:

```
T_ij = T_j_body^{-1} * T_i_body

Such that:
  p_j = T_ij * p_i + noise

Equivalently in the body frame:
  p_body = T_i_body * p_i = T_j_body * p_j
```

The calibration problem is formulated as optimization:

```
T* = argmin_T  Σ_k  || T * p_i^k - match(p_i^k, cloud_j) ||²

Where:
  match() is a correspondence function (nearest neighbor, feature, etc.)
  k indexes corresponding point pairs
```

This is a nonlinear least-squares problem on SE(3), solved iteratively via Gauss-Newton or Levenberg-Marquardt on the Lie algebra se(3).

---

## 3. Target-Based Calibration

### 3.1 Overview

Target-based calibration uses known geometric objects (planar boards, corner reflectors, fiducial markers) whose features can be precisely detected in each LiDAR's point cloud. By establishing correspondences between detections of the same target in multiple sensors, the relative transformation is computed directly.

### 3.2 Planar Target Methods

**Checkerboard/planar board approach:**

1. Place a large planar target (>1 m x 1 m) in the overlapping FOV of two or more LiDARs
2. Detect the plane in each sensor's point cloud via RANSAC
3. Extract plane normals and centroids
4. Repeat at 15-20 different positions/orientations to constrain all 6 DOF
5. Solve for the rigid transform that best aligns the planes

```python
import numpy as np
from scipy.spatial.transform import Rotation
from scipy.optimize import least_squares

def extract_plane_ransac(points, distance_threshold=0.02, max_iterations=1000):
    """
    Extract dominant plane from point cloud using RANSAC.
    Returns plane normal (unit vector), centroid, and inlier points.
    """
    best_inliers = []
    best_normal = None
    n_points = len(points)

    for _ in range(max_iterations):
        # Sample 3 random points
        idx = np.random.choice(n_points, 3, replace=False)
        p1, p2, p3 = points[idx]

        # Compute plane normal
        v1 = p2 - p1
        v2 = p3 - p1
        normal = np.cross(v1, v2)
        norm = np.linalg.norm(normal)
        if norm < 1e-10:
            continue
        normal /= norm

        # Signed distances from all points to plane
        d = (points - p1) @ normal
        inliers = np.where(np.abs(d) < distance_threshold)[0]

        if len(inliers) > len(best_inliers):
            best_inliers = inliers
            best_normal = normal

    inlier_points = points[best_inliers]
    centroid = np.mean(inlier_points, axis=0)

    # Refine normal via SVD on inlier points
    centered = inlier_points - centroid
    _, _, Vt = np.linalg.svd(centered)
    refined_normal = Vt[2]  # Smallest singular value direction

    # Ensure consistent normal orientation (pointing toward sensor)
    if refined_normal @ centroid < 0:
        refined_normal = -refined_normal

    return refined_normal, centroid, inlier_points


def calibrate_from_planes(normals_i, centroids_i, normals_j, centroids_j):
    """
    Estimate SE(3) transform from plane correspondences.
    normals_i, centroids_i: N planes detected in LiDAR i
    normals_j, centroids_j: Same N planes detected in LiDAR j

    Returns R, t such that p_j = R @ p_i + t
    """
    N = len(normals_i)
    assert N >= 5, "Need at least 5 plane observations for robust calibration"

    # Step 1: Estimate rotation from normal correspondences (Wahba's problem)
    # R * n_i = n_j for each plane
    H = sum(n_i.reshape(3, 1) @ n_j.reshape(1, 3)
            for n_i, n_j in zip(normals_i, normals_j))
    U, S, Vt = np.linalg.svd(H)
    d = np.linalg.det(Vt.T @ U.T)
    R = Vt.T @ np.diag([1, 1, d]) @ U.T

    # Step 2: Estimate translation from rotated centroids
    # R @ c_i + t = c_j  =>  t = mean(c_j - R @ c_i)
    rotated_centroids_i = (R @ centroids_i.T).T
    t = np.mean(centroids_j - rotated_centroids_i, axis=0)

    return R, t
```

### 3.3 Corner Reflector Targets

Trihedral corner reflectors provide high-intensity returns visible at long range and are easily detected as intensity peaks:

```
    ┌────────┐
    │  ////  │  Trihedral corner reflector
    │ ////   │  Three mutually perpendicular planes
    │////    │  Strong retroreflection at the corner point
    └────────┘

Detection: Intensity thresholding → clustering → centroid extraction
Accuracy: Sub-centimeter (point precisely located in each sensor)
```

**Advantages over planar targets:**
- Single-point correspondence (no plane fitting required)
- Detectable at longer ranges (high retroreflectivity)
- Less sensitive to LiDAR resolution (point source vs distributed surface)

**Practical protocol with corner reflectors:**

1. Place 4+ corner reflectors in overlapping FOV, non-coplanar arrangement
2. Acquire 10+ seconds of static scans (average for noise reduction)
3. Detect reflectors via intensity thresholding (>250 out of 255)
4. Cluster detections and extract centroids
5. Establish correspondences (manual or via spatial pattern matching)
6. Solve for SE(3) using SVD on corresponding point sets (Arun's method)

```python
def arun_method(points_i, points_j):
    """
    Arun's method (1987): Closed-form SE(3) from 3D point correspondences.
    Minimum 3 non-collinear point pairs. Optimal in least-squares sense.

    points_i: Nx3 array of points in frame i
    points_j: Nx3 array of corresponding points in frame j
    Returns R, t such that points_j ≈ R @ points_i + t
    """
    assert len(points_i) >= 3, "Need at least 3 point pairs"

    # Centroids
    ci = np.mean(points_i, axis=0)
    cj = np.mean(points_j, axis=0)

    # Center the points
    qi = points_i - ci
    qj = points_j - cj

    # Cross-covariance matrix
    H = qi.T @ qj  # 3x3

    # SVD
    U, S, Vt = np.linalg.svd(H)

    # Rotation (handle reflection case)
    d = np.linalg.det(Vt.T @ U.T)
    R = Vt.T @ np.diag([1, 1, d]) @ U.T

    # Translation
    t = cj - R @ ci

    return R, t
```

### 3.4 V-Shape and L-Shape Targets

V-shape or L-shape targets provide both plane features and edge features, offering more geometric constraints per observation:

```
    ┌─────────┐
    │         │
    │    V    │  V-shape target:
    │   / \   │  - Two planes: 2 normals + 2 centroids per observation
    │  /   \  │  - One edge: line direction + point on line
    │ /     \ │  - 5 constraints per observation (vs 3 for flat plane)
    └─────────┘
```

This reduces the minimum number of target positions from 15-20 (planar) to 5-8 (V-shape).

### 3.5 Target-Based Method Comparison

| Method | Accuracy | Min Observations | Setup Time | Advantages | Disadvantages |
|--------|----------|-----------------|------------|------------|---------------|
| Planar board | < 0.5 cm, < 0.05 deg | 15-20 positions | 30-45 min | Simple, robust | Many positions needed |
| Corner reflector | < 0.3 cm, < 0.03 deg | 4+ reflectors, 3+ positions | 20-30 min | Highest accuracy | Expensive targets |
| V/L-shape | < 0.5 cm, < 0.05 deg | 5-8 positions | 20-30 min | Fewer positions | Harder to detect edge |
| Fiducial board (April/Aruco) | < 1.0 cm, < 0.1 deg | 10-15 positions | 15-20 min | Also calibrates cameras | Lower LiDAR accuracy |

### 3.6 Limitations for Airside Operations

Target-based calibration, while accurate, has significant practical limitations for airport operations:

1. **Requires controlled environment**: Must place targets at known positions, hold static, move systematically
2. **Vehicle downtime**: 30-60 minutes per vehicle for full 8-sensor calibration
3. **Not available in-situ**: Cannot recalibrate on the active apron
4. **Does not capture thermal state**: Factory calibration at 20 C does not reflect 50 C tarmac conditions
5. **Fleet scaling**: 20 vehicles x 30 min = 10+ hours for fleet recalibration

Target-based methods are therefore best used for:
- Initial factory calibration (one-time, controlled environment)
- Post-repair/sensor-replacement calibration
- Ground truth for validating targetless methods

---

## 4. Targetless Calibration Methods

### 4.1 ICP-Based Registration

Iterative Closest Point (ICP) and its variants are the workhorses of targetless LiDAR-to-LiDAR calibration. They align two point clouds by iteratively finding closest-point correspondences and minimizing the distance between them.

#### 4.1.1 Point-to-Point ICP

The original ICP (Besl & McKay, 1992) minimizes:

```
E(T) = Σ_i || T * p_i - q_i* ||²

Where q_i* = argmin_q∈Q || T * p_i - q ||  (nearest neighbor in target cloud)
```

Each iteration:
1. Find nearest neighbors (KD-tree or voxel hash)
2. Solve for optimal T using SVD (Arun's method)
3. Apply T to source cloud
4. Repeat until convergence

**Limitations:** Slow convergence on planar surfaces (common on airport tarmac), requires good initial estimate (within ~15-30 deg and ~1 m).

#### 4.1.2 Point-to-Plane ICP

Minimizes point-to-plane distance instead of point-to-point:

```
E(T) = Σ_i ( (T * p_i - q_i*) · n_i )²

Where n_i is the surface normal at q_i*
```

Converges 10-50x faster than point-to-point on planar surfaces. This is critical for airport environments dominated by flat tarmac and building walls.

#### 4.1.3 Generalized ICP (GICP)

GICP (Segal et al., 2009) models each point as a Gaussian distribution, combining point-to-point and point-to-plane into a probabilistic framework:

```
E(T) = Σ_i  d_i^T (C_i^B + T C_i^A T^T)^{-1} d_i

Where:
  d_i = q_i* - T * p_i
  C_i^A = covariance of point p_i (source)
  C_i^B = covariance of point q_i* (target)
```

When covariances are set to:
- Identity: reduces to point-to-point ICP
- Rank-2 (degenerate along normal): reduces to point-to-plane ICP
- Full covariance: GICP (best general performance)

#### 4.1.4 Voxelized GICP (VGICP)

VGICP (Koide et al., 2021) — the same algorithm used in Aurrigo's GTSAM localization pipeline — voxelizes the target cloud and computes Gaussian distributions per voxel, dramatically reducing computation:

```cpp
// VGICP integration with gtsam_points (as used in Aurrigo's stack)
#include <gtsam_points/types/point_cloud.hpp>
#include <gtsam_points/factors/integrated_vgicp_factor.hpp>

// Voxelize target cloud
auto target_voxelized = gtsam_points::PointCloudGPU::create(target_cloud);
target_voxelized->voxelize(voxel_resolution);  // 0.5-1.0 m for calibration

// Create VGICP factor for calibration
auto factor = gtsam::make_shared<gtsam_points::IntegratedVGICPFactor>(
    key_source,    // Pose of source LiDAR
    key_target,    // Pose of target LiDAR (or body frame)
    source_cloud,
    target_voxelized
);

// Add to GTSAM factor graph
graph.add(factor);
```

**GPU-accelerated VGICP on Orin AGX:**

| Configuration | Points/Cloud | Voxel Size | Registration Time | Accuracy |
|--------------|-------------|------------|-------------------|----------|
| CPU (8 threads) | 100K | 0.5 m | 45-80 ms | < 1 cm |
| GPU (Orin) | 100K | 0.5 m | 8-15 ms | < 1 cm |
| GPU (Orin) | 300K | 1.0 m | 12-25 ms | < 1.5 cm |
| GPU (Orin) | 500K | 1.0 m | 20-40 ms | < 2 cm |

VGICP is the recommended ICP variant for Aurrigo's stack because it is already integrated with GTSAM and GPU-accelerated on Orin (see `10-knowledge-base/state-estimation/gtsam-factor-graphs.md` for GTSAM integration details).

### 4.2 Feature-Based Registration

Feature-based methods first extract geometric features (keypoints, descriptors) from each point cloud, then match features to establish correspondences before computing the transform. Advantages over ICP: wider convergence basin (works without good initial estimate), faster on large clouds (sparse features vs dense points).

#### 4.2.1 FPFH (Fast Point Feature Histograms)

FPFH (Rusu et al., 2009) computes a 33-dimensional descriptor encoding the local surface geometry around each point:

```python
import open3d as o3d
import numpy as np

def fpfh_registration(source_cloud, target_cloud, voxel_size=0.5):
    """
    Feature-based registration using FPFH descriptors.
    Good for initial coarse alignment before ICP refinement.
    """
    # Downsample
    source_down = source_cloud.voxel_down_sample(voxel_size)
    target_down = target_cloud.voxel_down_sample(voxel_size)

    # Estimate normals (required for FPFH)
    radius_normal = voxel_size * 2.0
    source_down.estimate_normals(
        o3d.geometry.KDTreeSearchParamHybrid(radius=radius_normal, max_nn=30))
    target_down.estimate_normals(
        o3d.geometry.KDTreeSearchParamHybrid(radius=radius_normal, max_nn=30))

    # Compute FPFH features
    radius_feature = voxel_size * 5.0
    source_fpfh = o3d.pipelines.registration.compute_fpfh_feature(
        source_down,
        o3d.geometry.KDTreeSearchParamHybrid(radius=radius_feature, max_nn=100))
    target_fpfh = o3d.pipelines.registration.compute_fpfh_feature(
        target_down,
        o3d.geometry.KDTreeSearchParamHybrid(radius=radius_feature, max_nn=100))

    # RANSAC registration using FPFH correspondences
    distance_threshold = voxel_size * 1.5
    result = o3d.pipelines.registration.registration_ransac_based_on_feature_matching(
        source_down, target_down,
        source_fpfh, target_fpfh,
        mutual_filter=True,
        max_correspondence_distance=distance_threshold,
        estimation_method=o3d.pipelines.registration.
            TransformationEstimationPointToPoint(False),
        ransac_n=3,
        checkers=[
            o3d.pipelines.registration.CorrespondenceCheckerBasedOnEdgeLength(0.9),
            o3d.pipelines.registration.CorrespondenceCheckerBasedOnDistance(
                distance_threshold)
        ],
        criteria=o3d.pipelines.registration.RANSACConvergenceCriteria(
            max_iteration=100000, confidence=0.999))

    return result.transformation, result.fitness, result.inlier_rmse
```

#### 4.2.2 ISS Keypoints + Feature Matching

Intrinsic Shape Signatures (ISS) detect repeatable keypoints based on the eigenvalue ratio of the local scatter matrix. Fewer but more discriminative than using all points:

```python
def iss_keypoints(cloud, salient_radius=0.5, non_max_radius=0.3,
                  gamma_21=0.975, gamma_32=0.975):
    """
    Extract ISS keypoints from point cloud.
    Returns indices of keypoint locations.
    """
    keypoints = o3d.geometry.keypoint.compute_iss_keypoints(
        cloud,
        salient_radius=salient_radius,
        non_max_radius=non_max_radius,
        gamma_21=gamma_21,
        gamma_32=gamma_32)
    return keypoints
```

#### 4.2.3 Line and Plane Feature Matching

Airports are rich in structural features (building edges, lamp posts, fences) that provide reliable line and plane features:

```
Airport Feature Types for Calibration:
  ┌─────────────────────┬───────────┬──────────────────────────┐
  │ Feature Type        │ Dimension │ Typical Sources          │
  ├─────────────────────┼───────────┼──────────────────────────┤
  │ Vertical lines      │ 1D        │ Lamp posts, bollards,    │
  │                     │           │ building corners         │
  ├─────────────────────┼───────────┼──────────────────────────┤
  │ Horizontal lines    │ 1D        │ Building edges, fences,  │
  │                     │           │ terminal roof edges      │
  ├─────────────────────┼───────────┼──────────────────────────┤
  │ Ground plane        │ 2D        │ Tarmac (dominant plane)  │
  ├─────────────────────┼───────────┼──────────────────────────┤
  │ Vertical planes     │ 2D        │ Building walls, aircraft │
  │                     │           │ fuselage                 │
  ├─────────────────────┼───────────┼──────────────────────────┤
  │ Corners             │ 0D        │ Building corners,        │
  │                     │           │ equipment edges          │
  └─────────────────────┴───────────┴──────────────────────────┘
```

Line-based calibration requires detecting corresponding lines in two overlapping scans and solving for the transform that best aligns them. The minimum is 3 non-parallel, non-coplanar lines for 6 DOF (in practice, use 10+ for robustness).

### 4.3 Learning-Based Registration

Deep learning methods learn to predict the registration transform directly from point cloud pairs, offering wider convergence basins and faster inference than classical methods.

#### 4.3.1 PointNetLK (Aoki et al., 2019)

Combines PointNet global features with the Lucas-Kanade iterative alignment framework:

```
Source PC ──► PointNet ──► Global Feature ──┐
                                            ├──► LK Alignment ──► SE(3)
Target PC ──► PointNet ──► Global Feature ──┘
```

- **Accuracy:** 0.5-2 cm translation, 0.1-0.5 deg rotation (on clean data)
- **Speed:** ~15 ms on Orin (TensorRT FP16)
- **Limitation:** Requires overlapping point clouds of similar density

#### 4.3.2 DCP (Deep Closest Point, Wang & Solomon, 2019)

Uses attention-based feature matching to learn soft correspondences:

- **Accuracy:** 0.3-1.5 cm translation, 0.1-0.3 deg rotation
- **Speed:** ~20 ms on Orin
- **Advantage:** Handles partial overlap better than PointNetLK

#### 4.3.3 RPMNet (Yew & Lee, 2020)

Robust Point Matching using differentiable Sinkhorn normalization:

- **Accuracy:** 0.2-1.0 cm translation, 0.05-0.2 deg rotation
- **Speed:** ~30 ms on Orin
- **Advantage:** Handles noise and outliers; soft correspondence

#### 4.3.4 GeoTransformer (Qin et al., 2022)

Geometric Transformer with superpoint matching — current SOTA for point cloud registration:

```
Source PC ──► KPConv Backbone ──► Superpoints ──┐
                                                ├──► Geometric Transformer
Target PC ──► KPConv Backbone ──► Superpoints ──┘   (cross-attention)
                                                         │
                                                    Correspondences
                                                         │
                                                  Weighted SVD ──► SE(3)
```

- **Accuracy:** 0.1-0.5 cm translation, 0.03-0.1 deg rotation (approaches target-based)
- **Speed:** ~50-80 ms on Orin (TensorRT FP16)
- **Advantage:** Best generalization, handles low overlap (>10%)
- **Limitation:** Heaviest compute; overkill for high-overlap LiDAR pairs

#### 4.3.5 Practical Recommendation for Learning-Based Methods

For Aurrigo's multi-LiDAR calibration, learning-based registration is most valuable as:
1. **Coarse initializer** for ICP refinement (replaces FPFH+RANSAC)
2. **Automatic recalibration trigger** (quickly detects miscalibration)
3. **Not recommended as sole calibration** due to lower accuracy ceiling vs ICP

### 4.4 Mutual Information Methods

Mutual information (MI) methods align point clouds by maximizing the statistical dependence between overlapping measurements. Unlike geometric methods, MI can align point clouds from sensors with different characteristics (e.g., different beam patterns).

```
MI(A, B) = H(A) + H(B) - H(A, B)

Where H is the Shannon entropy of the discretized point cloud
(voxelized occupancy or intensity histograms)
```

**Normalized Mutual Information (NMI):**
```
NMI(A, B) = 2 * MI(A, B) / (H(A) + H(B))

NMI ∈ [0, 1], where 1 = perfect alignment
```

MI-based calibration is particularly useful for RSHELIOS-to-RSBP calibration, where the vastly different beam patterns (32-channel 360 x 31.5 deg vs 32-channel 360 x 90 deg) make point-level correspondence unreliable. Voxelized MI compares occupancy patterns rather than individual points.

### 4.5 Motion-Based Calibration (Hand-Eye)

Motion-based calibration exploits ego-motion estimates from each sensor's own SLAM or odometry. If two sensors undergo the same rigid motion (because they are mounted on the same vehicle), the relative transformation can be recovered:

```
Given:
  A_k = motion of LiDAR i between time k and k+1 (from LiDAR i SLAM)
  B_k = motion of LiDAR j between time k and k+1 (from LiDAR j SLAM)
  X = unknown transform from LiDAR i to LiDAR j

Hand-eye equation:
  A_k * X = X * B_k

With N motions, solve for X ∈ SE(3) using:
  - Tsai-Lenz (1989): closed-form, rotation then translation
  - Park-Martin (1994): simultaneous, Lie group formulation
  - Nonlinear optimization on SE(3) manifold (preferred for accuracy)
```

```python
from scipy.optimize import minimize
from scipy.spatial.transform import Rotation

def hand_eye_calibration(motions_A, motions_B):
    """
    Solve AX = XB hand-eye calibration.
    motions_A: list of (R_A, t_A) tuples from sensor A odometry
    motions_B: list of (R_B, t_B) tuples from sensor B odometry
    Returns R_X, t_X (relative transform from A to B)
    """
    N = len(motions_A)
    assert N >= 3, "Need at least 3 distinct motions (2 rotations + 1 translation)"

    def residual(params):
        # params: [rx, ry, rz, tx, ty, tz] (axis-angle + translation)
        R_X = Rotation.from_rotvec(params[:3]).as_matrix()
        t_X = params[3:6]

        errors = []
        for (R_A, t_A), (R_B, t_B) in zip(motions_A, motions_B):
            # Rotation residual: R_A * R_X - R_X * R_B = 0
            R_err = R_A @ R_X - R_X @ R_B
            errors.extend(R_err.flatten())

            # Translation residual: R_A * t_X + t_A - R_X * t_B - t_X = 0
            t_err = R_A @ t_X + t_A - R_X @ t_B - t_X
            errors.extend(t_err)

        return np.array(errors)

    # Initial guess: identity
    x0 = np.zeros(6)
    result = minimize(lambda p: np.sum(residual(p)**2), x0, method='L-BFGS-B')

    R_X = Rotation.from_rotvec(result.x[:3]).as_matrix()
    t_X = result.x[3:6]

    return R_X, t_X
```

**Advantages of motion-based calibration:**
- No targets or special environments required
- Can be performed during normal driving
- Works even with zero overlap between sensors (FOV need not overlap)
- Naturally handles RSHELIOS-to-RSBP pairs with very different FOVs

**Requirements:**
- Sufficient ego-motion diversity: at least 2 distinct rotation axes and 1 translation
- Accurate per-sensor odometry (GPS drift and wheel slip degrade results)
- 30-60 seconds of varied driving (turns, curves, not just straight lines)

### 4.6 Targetless Method Comparison

| Method | Translation Accuracy | Rotation Accuracy | Initial Estimate Needed | Compute (Orin) | Overlap Required | Best Use Case |
|--------|---------------------|-------------------|------------------------|----------------|-----------------|---------------|
| Point-to-Point ICP | 1-3 cm | 0.1-0.3 deg | < 30 deg, < 1 m | 50-100 ms | > 50% | Simple refinement |
| Point-to-Plane ICP | 0.5-2 cm | 0.05-0.2 deg | < 30 deg, < 1 m | 30-70 ms | > 40% | Planar environments |
| GICP | 0.3-1 cm | 0.03-0.1 deg | < 30 deg, < 1 m | 40-80 ms | > 30% | General purpose |
| VGICP (GPU) | 0.3-1 cm | 0.03-0.1 deg | < 30 deg, < 1 m | 8-25 ms | > 30% | **Aurrigo primary** |
| FPFH + RANSAC | 2-5 cm | 0.1-0.5 deg | None | 100-300 ms | > 20% | Coarse init |
| GeoTransformer | 0.1-0.5 cm | 0.03-0.1 deg | None | 50-80 ms | > 10% | Low overlap, init |
| Mutual Information | 1-3 cm | 0.1-0.3 deg | < 45 deg, < 2 m | 200-500 ms | > 20% (voxel) | Cross-sensor type |
| Hand-Eye (motion) | 1-5 cm | 0.05-0.3 deg | None | N/A (offline) | 0% (no overlap) | Non-overlapping |

**Recommended pipeline for Aurrigo:**

```
┌─────────────────────────────────────────────────────────────┐
│             TARGETLESS CALIBRATION PIPELINE                  │
│                                                             │
│  Step 1: Feature Coarse Alignment (FPFH or GeoTransformer) │
│          → Accuracy: ~2-5 cm, ~0.3 deg                     │
│                        │                                    │
│  Step 2: VGICP Fine Alignment (GPU-accelerated)             │
│          → Accuracy: ~0.3-1 cm, ~0.05 deg                  │
│                        │                                    │
│  Step 3: Multi-view Joint Optimization (GTSAM)              │
│          → Accuracy: ~0.2-0.5 cm, ~0.03 deg                │
│          → All pairwise constraints jointly optimized        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Online and Continuous Calibration

### 5.1 Why Calibration Drifts

Even after precise factory calibration, extrinsic parameters drift over time due to:

| Drift Source | Typical Magnitude | Timescale | Detection Method |
|-------------|-------------------|-----------|-----------------|
| Thermal expansion/contraction | 0.5-3 mm, 0.01-0.1 deg | Minutes-hours | Temperature monitoring |
| Mechanical vibration (engine) | 0.1-0.5 mm, 0.005-0.02 deg | Continuous | ICP residual monitoring |
| Road shock / speed bumps | 0.5-2 mm per event | Discrete events | IMU shock detection |
| Minor impacts (contact with objects) | 1-10 mm, 0.1-1 deg | Discrete events | Sudden residual jump |
| Bolt loosening (long-term) | 1-5 mm, 0.05-0.5 deg | Weeks-months | Periodic check |
| Sensor replacement | Up to full misalignment | Discrete | Maintenance record |

Cumulative drift over a typical operating day:

```
Morning cold start (-5 C):    Baseline calibration
After 1 hour (ambient 15 C):  +0.3 mm thermal drift
After 4 hours (tarmac 40 C):  +1.5 mm thermal drift + 0.5 mm vibration
After speed bump:              +2.0 mm total (speed bump added 0.5 mm)
End of shift (cool down):      +0.8 mm residual (hysteresis)
```

Without online correction, accuracy degrades from factory-calibrated 0.3 cm to potentially 2+ cm within a single shift, pushing calibration into the "marginal" zone of our error impact table.

### 5.2 ICP-Based Drift Monitoring

The simplest online calibration check: periodically run VGICP between overlapping sensor pairs and compare the result against the stored calibration:

```python
import numpy as np
from scipy.spatial.transform import Rotation

class CalibrationDriftMonitor:
    """
    Monitors LiDAR extrinsic calibration drift using VGICP residuals.
    Runs at 1 Hz (every 10th scan at 10 Hz) on each overlapping sensor pair.
    """

    def __init__(self, sensor_pairs, stored_calibrations,
                 translation_warn=0.01, translation_alarm=0.02,
                 rotation_warn=0.05, rotation_alarm=0.1):
        """
        Args:
            sensor_pairs: list of (sensor_i, sensor_j) tuples
            stored_calibrations: dict mapping (i,j) to SE(3) transforms
            translation_warn/alarm: thresholds in meters
            rotation_warn/alarm: thresholds in degrees
        """
        self.sensor_pairs = sensor_pairs
        self.stored_calibrations = stored_calibrations
        self.t_warn = translation_warn
        self.t_alarm = translation_alarm
        self.r_warn = np.radians(rotation_warn)
        self.r_alarm = np.radians(rotation_alarm)
        self.drift_history = {pair: [] for pair in sensor_pairs}

    def compute_drift(self, T_measured, T_stored):
        """Compute translation and rotation drift between measured and stored."""
        T_delta = np.linalg.inv(T_stored) @ T_measured

        t_drift = np.linalg.norm(T_delta[:3, 3])
        R_delta = T_delta[:3, :3]
        r_drift = np.arccos(np.clip((np.trace(R_delta) - 1) / 2, -1, 1))

        return t_drift, r_drift

    def check_pair(self, pair, T_measured, timestamp):
        """
        Check calibration health for a sensor pair.
        Returns: status ('ok', 'warn', 'alarm', 'critical')
        """
        T_stored = self.stored_calibrations[pair]
        t_drift, r_drift = self.compute_drift(T_measured, T_stored)

        self.drift_history[pair].append({
            'timestamp': timestamp,
            't_drift': t_drift,
            'r_drift': r_drift
        })

        # Keep last 100 measurements for trend analysis
        if len(self.drift_history[pair]) > 100:
            self.drift_history[pair].pop(0)

        # Classification
        if t_drift > self.t_alarm or r_drift > self.r_alarm:
            return 'alarm', t_drift, r_drift
        elif t_drift > self.t_warn or r_drift > self.r_warn:
            return 'warn', t_drift, r_drift
        else:
            return 'ok', t_drift, r_drift

    def detect_sudden_shift(self, pair, threshold_multiplier=5.0):
        """
        Detect sudden calibration shift (impact event).
        Returns True if latest drift >> rolling average.
        """
        history = self.drift_history[pair]
        if len(history) < 10:
            return False

        recent = history[-1]['t_drift']
        rolling_avg = np.mean([h['t_drift'] for h in history[-10:-1]])
        rolling_std = np.std([h['t_drift'] for h in history[-10:-1]])

        return recent > rolling_avg + threshold_multiplier * max(rolling_std, 0.001)
```

### 5.3 Continuous Refinement from SLAM Residuals

Aurrigo's GTSAM-based SLAM pipeline already computes scan-matching residuals between the fused point cloud and the map. These residuals contain calibration error information that can be extracted:

**Insight:** If calibration is perfect, SLAM residuals are purely due to localization uncertainty. If calibration has drifted, SLAM residuals show systematic patterns — e.g., consistently higher residuals in regions covered by a specific sensor.

```
Per-sensor SLAM residual decomposition:

Total SLAM residual = Localization error + Calibration error + Noise

For sensor k:
  r_k = || T_body_to_map * T_lidarK_body * p_k - map_point ||

If T_lidarK_body has drifted by δT:
  r_k = || T_body_to_map * (T_lidarK_body + δT) * p_k - map_point ||
  r_k ≈ || T_body_to_map * T_lidarK_body * p_k - map_point ||
       + || T_body_to_map * δT * p_k ||    ← calibration contribution
```

**Practical implementation:** Compare per-sensor SLAM residuals. If one sensor consistently shows higher residuals than others, its calibration has likely drifted.

### 5.4 Joint Optimization with GTSAM

The most principled approach: include calibration parameters as variables in the GTSAM factor graph, estimated jointly with vehicle poses. This is the recommended production approach for Aurrigo.

```
Factor Graph with Calibration Variables:

  X_0 ──── X_1 ──── X_2 ──── ... ──── X_t    (vehicle poses)
   │╲       │╲       │╲                │╲
   │ ╲      │ ╲      │ ╲               │ ╲
   │  C_0   │  C_0   │  C_0            │  C_0  (calibration var, shared)
   │  C_1   │  C_1   │  C_1            │  C_1
   │  ...   │  ...   │  ...            │  ...
   │  C_N   │  C_N   │  C_N            │  C_N

  Where:
    X_t = vehicle pose at time t (gtsam::Pose3)
    C_k = extrinsic calibration of LiDAR k (gtsam::Pose3)

  Factors:
    - VGICP factors: f(X_t, C_k) = align(transform(cloud_k, C_k), map, X_t)
    - Prior on C_k: Gaussian centered at factory calibration
    - Between-calibration temporal prior: C_k(t) ~ C_k(t-1) + small noise
    - IMU preintegration factors: f(X_t, X_{t+1})
    - GPS factors: f(X_t)
```

```cpp
// GTSAM calibration factor (C++ pseudocode for ROS nodelet)
#include <gtsam/geometry/Pose3.h>
#include <gtsam/nonlinear/NonlinearFactorGraph.h>
#include <gtsam/nonlinear/ISAM2.h>
#include <gtsam/slam/BetweenFactor.h>

class CalibrationAwareSLAM {
public:
    CalibrationAwareSLAM(int n_lidars,
                         const std::vector<gtsam::Pose3>& initial_calibrations)
        : n_lidars_(n_lidars) {

        // ISAM2 parameters
        gtsam::ISAM2Params params;
        params.relinearizeThreshold = 0.01;
        params.relinearizeSkip = 1;
        isam2_ = std::make_unique<gtsam::ISAM2>(params);

        // Initialize calibration variables with factory values
        for (int k = 0; k < n_lidars; k++) {
            gtsam::Key calib_key = gtsam::Symbol('C', k);
            initial_values_.insert(calib_key, initial_calibrations[k]);

            // Strong prior on calibration (factory accuracy)
            // Translation: 5mm sigma, Rotation: 0.05 deg sigma
            auto calib_noise = gtsam::noiseModel::Diagonal::Sigmas(
                (gtsam::Vector(6) << 0.001, 0.001, 0.001,  // rotation (rad)
                                      0.005, 0.005, 0.005   // translation (m)
                ).finished());
            graph_.addPrior(calib_key, initial_calibrations[k], calib_noise);
        }
    }

    void addScanMatchFactor(int lidar_idx, int pose_idx,
                            const PointCloud& scan,
                            const VoxelizedMap& map) {
        gtsam::Key pose_key = gtsam::Symbol('X', pose_idx);
        gtsam::Key calib_key = gtsam::Symbol('C', lidar_idx);

        // Custom factor: error = align(T_map_body * T_body_lidar * scan, map)
        // Variables: X (pose), C (calibration)
        auto factor = CalibScanMatchFactor(
            pose_key, calib_key, scan, map, scan_match_noise_);
        graph_.add(factor);
    }

    void addCalibrationTemporalPrior(int lidar_idx) {
        // Prevent calibration from changing too fast
        // Very tight noise model: allows ~1mm/hour drift rate
        gtsam::Key calib_key = gtsam::Symbol('C', lidar_idx);
        auto temporal_noise = gtsam::noiseModel::Diagonal::Sigmas(
            (gtsam::Vector(6) << 0.0001, 0.0001, 0.0001,   // 0.006 deg
                                  0.0001, 0.0001, 0.0001    // 0.1 mm
            ).finished());

        // Between factor connecting calibration at consecutive timesteps
        // (In practice, calibration is a single shared variable with
        //  the prior doing the regularization, not temporal between factors)
    }

    gtsam::Pose3 getCalibration(int lidar_idx) {
        gtsam::Key calib_key = gtsam::Symbol('C', lidar_idx);
        return isam2_->calculateEstimate<gtsam::Pose3>(calib_key);
    }

private:
    int n_lidars_;
    std::unique_ptr<gtsam::ISAM2> isam2_;
    gtsam::NonlinearFactorGraph graph_;
    gtsam::Values initial_values_;
    gtsam::SharedNoiseModel scan_match_noise_;
};
```

**Key design decisions:**

1. **Calibration as shared variable**: One calibration variable per sensor (not per timestep). This is correct because calibration changes slowly compared to vehicle motion.

2. **Prior strength**: The prior noise model on calibration must be strong enough to prevent the optimizer from using calibration to "explain" localization error. Typical values: 5 mm translation sigma, 0.05 deg rotation sigma.

3. **Update frequency**: Update calibration estimate every 100-1000 scans (10-100 seconds), not every scan. This smooths out noise and prevents calibration variables from oscillating.

4. **Observability**: Calibration is only observable when the vehicle has moved and rotated sufficiently. Static vehicle scans constrain translation but not rotation well.

### 5.5 Trigger-Based Recalibration

Rather than continuous online refinement, a simpler approach monitors calibration health and triggers full recalibration only when needed:

```python
class RecalibrationTrigger:
    """
    Determines when to trigger targetless recalibration.
    Integrates with CalibrationDriftMonitor.
    """

    TRIGGERS = {
        'drift_threshold':    {'t': 0.015, 'r_deg': 0.08},
        'sudden_shift':       {'multiplier': 5.0},
        'temperature_delta':  {'delta_c': 30},  # 30C change from last cal
        'time_elapsed':       {'hours': 168},     # Weekly maximum
        'maintenance_event':  True,               # After any sensor work
        'slam_residual_jump': {'factor': 2.0},    # 2x normal residual
    }

    def should_recalibrate(self, drift_monitor, temperature_monitor,
                           slam_monitor, maintenance_log):
        """Returns (should_recal, reason) tuple."""

        # Check drift threshold
        for pair in drift_monitor.sensor_pairs:
            status, t, r = drift_monitor.check_pair_latest(pair)
            if status == 'alarm':
                return True, f"Drift alarm: pair {pair}, t={t*100:.1f}cm, " \
                             f"r={np.degrees(r):.3f}deg"

        # Check sudden shift (impact detection)
        for pair in drift_monitor.sensor_pairs:
            if drift_monitor.detect_sudden_shift(pair):
                return True, f"Sudden shift detected: pair {pair}"

        # Check temperature
        if temperature_monitor.delta_from_last_cal() > \
                self.TRIGGERS['temperature_delta']['delta_c']:
            return True, f"Temperature delta " \
                         f"{temperature_monitor.delta_from_last_cal():.1f}C"

        # Check time elapsed
        if drift_monitor.hours_since_last_calibration() > \
                self.TRIGGERS['time_elapsed']['hours']:
            return True, "Weekly recalibration due"

        # Check maintenance events
        if maintenance_log.has_sensor_event_since_last_cal():
            return True, "Post-maintenance recalibration required"

        return False, "Calibration healthy"
```

**Recalibration procedure when triggered:**

1. If vehicle is driving: accumulate 60 seconds of varied motion data
2. Run VGICP on all overlapping sensor pairs
3. Run hand-eye calibration on non-overlapping pairs
4. Joint optimize all pairwise constraints
5. Validate result against quality metrics (Section 9)
6. If validation passes: update stored calibration, log event
7. If validation fails: raise alarm, request manual inspection

### 5.6 Calibration State Machine

```
                        ┌──────────────┐
                 ┌─────>│   NOMINAL    │<─────────────────────┐
                 │      │  Online      │                      │
                 │      │  monitoring  │                      │
                 │      └──────┬───────┘                      │
                 │             │                              │
                 │      Drift exceeds                  Validation
                 │      warning threshold               passes
                 │             │                              │
                 │      ┌──────▼───────┐               ┌─────┴──────┐
                 │      │   WARNING    │──────────────>│ RECALIBRATE│
                 │      │  Log, reduce │  Drift exceeds│  Targetless│
                 │      │  max speed   │  alarm         │  pipeline  │
                 │      └──────┬───────┘               └─────┬──────┘
                 │             │                              │
                 │      Drift exceeds                  Validation
                 │      critical threshold              fails
                 │             │                              │
                 │      ┌──────▼───────┐               ┌─────▼──────┐
                 │      │   CRITICAL   │               │  DEGRADED  │
                 │      │  Stop vehicle│               │  Manual    │
                 └──────│  Request     │               │  inspect   │
                        │  maintenance │               │  required  │
                        └──────────────┘               └────────────┘
```

---

## 6. Thermal Drift Compensation

### 6.1 Temperature Range on Airport

Airport tarmac temperatures vary dramatically:

| Condition | Ambient Air | Tarmac Surface | Sensor Mount Temp | LiDAR Internal |
|-----------|------------|----------------|-------------------|----------------|
| Winter night (cold) | -10 C | -15 C | -10 C | +5 C (self-heating) |
| Winter day (mild) | 5 C | 5 C | 5 C | +15 C |
| Summer morning | 20 C | 25 C | 22 C | +35 C |
| Summer afternoon | 35 C | 55 C | 45 C | +55 C |
| Summer tarmac peak | 40 C | 65 C | 50 C | +60 C |

The RoboSense RSHELIOS operates within -40 C to +60 C (see `20-av-platform/sensors/robosense-lidar.md`), so thermal operation is within spec. However, the **sensor mount** undergoes thermal expansion that shifts the extrinsic calibration.

### 6.2 Material Expansion Analysis

**Linear thermal expansion:** Delta_L = alpha * L * Delta_T

| Material | Expansion Coefficient (alpha) | Expansion per 1m per 50 C Delta | Typical Use |
|----------|------------------------------|--------------------------------|-------------|
| Aluminum 6061 | 23.6 x 10^-6 /C | 1.18 mm | Sensor brackets |
| Steel (mild) | 11.7 x 10^-6 /C | 0.59 mm | Vehicle frame |
| Stainless 304 | 17.3 x 10^-6 /C | 0.87 mm | Mounting hardware |
| Carbon fiber | 0.5 x 10^-6 /C | 0.025 mm | Premium mounts |
| PEEK plastic | 47 x 10^-6 /C | 2.35 mm | Isolating spacers |

**Practical mount geometry analysis (ADT3 roof-mounted RSHELIOS):**

```
Sensor mount dimensions (typical):
  Bracket arm length: ~200 mm (from attachment to sensor center)
  Bracket height: ~100 mm
  Roof offset from vehicle CG: ~1500 mm

Aluminum bracket, Delta_T = 50 C (cold morning to hot afternoon):
  Arm expansion: 200 mm * 23.6e-6 * 50 = 0.236 mm
  Height expansion: 100 mm * 23.6e-6 * 50 = 0.118 mm

  Angular tilt from differential expansion:
    If top and bottom of bracket expand differently (temperature gradient):
    Gradient ~5 C across 100 mm bracket height
    Delta_angle ≈ alpha * Delta_T_gradient = 23.6e-6 * 5 ≈ 0.007 deg

  Total thermal-induced displacement at 100 m range:
    Translation: ~0.24 mm (negligible)
    Angular: 100 m * tan(0.007 deg) = 12 mm (significant!)
```

The angular contribution dominates. Even small temperature gradients across the mount cause meaningful angular drift at range. Steel mounts reduce this by ~50%, carbon fiber by ~97%.

### 6.3 Thermal Compensation Strategies

#### Strategy 1: Empirical Lookup Table (Recommended for Production)

Measure calibration at multiple temperatures during factory setup, fit a model:

```python
import numpy as np
from scipy.interpolate import CubicSpline

class ThermalCalibrationLUT:
    """
    Temperature-dependent calibration lookup table.
    Built during factory calibration at 5-7 temperature points.
    """

    def __init__(self):
        # Measured calibration offsets at each temperature
        # Per sensor, 6 DOF: [roll, pitch, yaw, x, y, z]
        self.temperatures = None  # shape: (N_temps,)
        self.offsets = None       # shape: (N_sensors, N_temps, 6)
        self.splines = None       # Cubic spline interpolators

    def build_from_measurements(self, temperatures, calibrations_per_temp,
                                reference_calibration):
        """
        Args:
            temperatures: list of N temperatures where calibration was measured
            calibrations_per_temp: dict[temp] -> list of SE(3) per sensor
            reference_calibration: list of SE(3) at reference temp (20C)
        """
        self.temperatures = np.array(temperatures)
        n_sensors = len(reference_calibration)
        n_temps = len(temperatures)
        self.offsets = np.zeros((n_sensors, n_temps, 6))

        for t_idx, temp in enumerate(temperatures):
            for s_idx in range(n_sensors):
                T_ref = reference_calibration[s_idx]
                T_temp = calibrations_per_temp[temp][s_idx]
                # Compute offset: T_temp = delta * T_ref
                delta = T_temp @ np.linalg.inv(T_ref)
                # Extract roll, pitch, yaw, x, y, z
                self.offsets[s_idx, t_idx, :3] = rotation_to_euler(delta[:3, :3])
                self.offsets[s_idx, t_idx, 3:] = delta[:3, 3]

        # Build cubic spline interpolators per sensor per DOF
        self.splines = {}
        for s_idx in range(n_sensors):
            self.splines[s_idx] = {}
            for dof in range(6):
                self.splines[s_idx][dof] = CubicSpline(
                    self.temperatures,
                    self.offsets[s_idx, :, dof],
                    bc_type='natural'
                )

    def get_correction(self, sensor_idx, temperature):
        """Get calibration correction for given sensor at given temperature."""
        correction = np.zeros(6)
        for dof in range(6):
            correction[dof] = self.splines[sensor_idx][dof](temperature)
        return correction  # [roll, pitch, yaw, x, y, z] offset

    def apply_correction(self, sensor_idx, temperature, T_reference):
        """Apply thermal correction to reference calibration."""
        correction = self.get_correction(sensor_idx, temperature)
        delta_T = euler_and_translation_to_SE3(correction[:3], correction[3:])
        return delta_T @ T_reference
```

**Factory characterization protocol:**

1. Place vehicle in climate chamber (or outdoors across seasons)
2. Measure calibration at: -10 C, 0 C, 10 C, 20 C (reference), 30 C, 40 C, 50 C
3. At each temperature, allow 30 min stabilization
4. Run target-based calibration (10 min per temperature)
5. Build lookup table per vehicle
6. Total time: ~4 hours per vehicle (one-time)

#### Strategy 2: Online Estimation (Complement to LUT)

Use the GTSAM joint optimization (Section 5.4) with temperature as a factor:

```
Calibration model:
  C_k(T) = C_k_ref + alpha_k * (T - T_ref)

Where:
  C_k_ref = calibration at reference temperature (factory)
  alpha_k = thermal sensitivity coefficients (6 DOF) per sensor
  T = current temperature
  T_ref = reference temperature (20 C)

GTSAM factor:
  Temperature prior factor constraining C_k based on measured temperature
```

This allows the system to learn thermal coefficients online, potentially more accurate than the LUT for a specific vehicle's actual operating conditions.

#### Strategy 3: Carbon Fiber Mounts (Hardware Mitigation)

| Mount Material | Cost/Mount | Thermal Drift | Weight | Recommended |
|---------------|-----------|---------------|--------|-------------|
| Aluminum bracket | $50-100 | High (baseline) | 0.5 kg | Development only |
| Steel bracket | $80-150 | Medium (50% of Al) | 1.2 kg | Budget production |
| Carbon fiber | $200-500 | Very low (2% of Al) | 0.3 kg | **Production** |
| Invar (Ni-Fe) | $300-800 | Extremely low | 1.5 kg | If carbon not viable |

Carbon fiber mounts with steel inserts for bolt holes provide the best tradeoff of thermal stability, weight, and cost. For a fleet of 20 vehicles with 8 sensors each, the incremental cost of carbon fiber over aluminum is approximately $2,400-6,400 per vehicle ($19,200-51,200 fleet total) but eliminates ~97% of thermal drift, potentially making thermal compensation software unnecessary.

### 6.4 Pre-Warming Stabilization

LiDAR units self-heat during operation (12 W for RSHELIOS). After cold start, the sensor housing temperature rises 15-30 C in the first 10-15 minutes, causing rapid thermal drift:

```
Cold Start Calibration Profile:

Time    Sensor Temp    Drift from Cold Cal    Drift from Warm Cal
─────   ───────────    ──────────────────     ──────────────────
 0 min     -5 C           0 mm (ref)           +1.5 mm (max)
 2 min     +5 C           +0.5 mm              +1.0 mm
 5 min    +12 C           +0.8 mm              +0.7 mm
10 min    +18 C           +1.2 mm              +0.3 mm
15 min    +22 C           +1.4 mm              +0.1 mm
20 min    +24 C           +1.5 mm              0 mm (ref)
```

**Recommendation:** Allow 15-20 minutes of warm-up before entering autonomous mode. During warm-up, run continuous online calibration to track the rapid initial drift. Flag calibration as "stabilizing" in the monitoring system.

---

## 7. Multi-LiDAR Overlap Optimization

### 7.1 Sensor Placement for Aurrigo Vehicles

Optimal sensor placement must satisfy multiple constraints simultaneously:
- 360-degree horizontal coverage with no gaps
- Sufficient vertical coverage for ground obstacles and overhead structures
- Adequate overlap between adjacent sensors for calibration and fusion
- Practical mounting locations on the vehicle

**ADT3 sensor placement (8 LiDAR, top view):**

```
                         FRONT
                           │
              RSHELIOS_1   │   RSHELIOS_0
                  ╲        │        ╱
                   ╲   RSBP_0     ╱
                    ╲     ┌─┐    ╱
                     ╲    │ │   ╱
                      ╲   │ │  ╱
           RSHELIOS_2──╲──┤ ├──╱──RSHELIOS_3
                        ╲ │ │ ╱
                         ╲│ │╱
                     RSBP_1│ │RSBP_2
                          │ │
                          │ │
                          │ │
           RSHELIOS_5──╱──┤ ├──╲──RSHELIOS_4
                      ╱   │ │  ╲
                     ╱    │ │   ╲
                    ╱     └─┘    ╲
                   ╱   RSBP_3     ╲
                  ╱        │        ╲
              RSHELIOS_6   │   RSHELIOS_7
                           │
                         REAR

    RSHELIOS: 360 x 31.5 deg, 150 m range (long-range perception)
    RSBP:     360 x 90 deg,  30 m range (near-field / blind spot)

    ┌──────────────────────────────────────────────────────┐
    │  Mounting Positions:                                  │
    │  RSHELIOS 0-3: Roof corners, angled outward 30-45°   │
    │  RSHELIOS 4-7: Lower body corners (if applicable)    │
    │  RSBP 0:      Front center, facing down/forward      │
    │  RSBP 1-2:    Side lower, facing down/outward        │
    │  RSBP 3:      Rear center, facing down/backward      │
    └──────────────────────────────────────────────────────┘
```

### 7.2 Overlap Requirements

For robust pairwise calibration, sensor pairs need sufficient overlap in their point clouds:

| Calibration Method | Minimum Overlap | Recommended Overlap | Notes |
|-------------------|-----------------|---------------------|-------|
| ICP (any variant) | 30% shared points | > 50% | Below 30%, convergence unreliable |
| Feature-based | 20% shared area | > 30% | Depends on feature density |
| Learning-based | 10% (GeoTransformer) | > 20% | Tolerates low overlap |
| Mutual information | 20% voxel overlap | > 30% | Occupancy-based, not point-based |
| Hand-eye (motion) | 0% (no overlap needed) | N/A | Uses ego-motion only |

**Overlap calculation for adjacent RSHELIOS sensors:**

```python
def compute_fov_overlap(sensor_a_config, sensor_b_config, range_limit=100.0):
    """
    Compute approximate overlap percentage between two LiDAR sensors.

    sensor_config: dict with keys:
        'position': (x, y, z) in vehicle frame
        'orientation': (roll, pitch, yaw) in radians
        'h_fov': horizontal FOV in degrees (360 for spinning)
        'v_fov': vertical FOV in degrees
        'max_range': max range in meters
    """
    # For 360-degree spinning LiDARs, overlap is determined by:
    # 1. Spatial proximity (overlapping 3D volumes)
    # 2. Vertical FOV overlap at the intersection
    # 3. Point density at the overlap region

    # Distance between sensors
    d = np.linalg.norm(
        np.array(sensor_a_config['position']) -
        np.array(sensor_b_config['position'])
    )

    if d > sensor_a_config['max_range'] + sensor_b_config['max_range']:
        return 0.0  # No overlap possible

    # For co-located spinning LiDARs (e.g., RSHELIOS + RSBP on same mount):
    # Overlap is determined by vertical FOV intersection
    if d < 0.5:  # Co-located
        v_overlap = compute_vertical_fov_overlap(
            sensor_a_config['v_fov'], sensor_a_config['orientation'][1],
            sensor_b_config['v_fov'], sensor_b_config['orientation'][1]
        )
        return v_overlap

    # For separated spinning LiDARs:
    # Rough estimate based on solid angle overlap
    # (Full calculation requires ray-casting simulation)
    effective_overlap_range = min(
        sensor_a_config['max_range'],
        sensor_b_config['max_range'],
        range_limit
    )

    # Fraction of each sensor's volume that overlaps
    overlap_volume_ratio = estimate_volume_overlap(
        sensor_a_config, sensor_b_config, effective_overlap_range)

    return overlap_volume_ratio
```

### 7.3 FOV Analysis for RoboSense Sensors

**RSHELIOS (Helios-1615 variant):**
- Horizontal: 360 deg (full rotation)
- Vertical: 31 deg (-16 deg to +15 deg)
- Effective perception cone: a thin disk around the sensor

**RSBP:**
- Horizontal: 360 deg (full rotation)
- Vertical: 90 deg (hemispherical, downward-biased)
- Effective perception cone: a wide dome below the sensor

```
Side View - Perception Volumes:

         RSHELIOS                          RSBP
         ────────                          ────

              +15°                              0°
             ╱    ╲                            ┌─┐
            ╱      ╲                          ╱   ╲
           ╱   ■    ╲                        ╱  ■  ╲
          ╱  sensor  ╲                      ╱ sensor╲
         ╱            ╲                    ╱         ╲
        ╱              ╲                  ╱           ╲
       ╱   31° total    ╲               ╱  90° total   ╲
      ╱                  ╲             ╱                 ╲
  ───╱────────────────────╲───     ───╱───────────────────╲───
       -16°              -16°              -90°
  Range: 150m                     Range: 30m

  RSHELIOS: Long-range, thin vertical slice
  RSBP: Short-range, wide vertical hemisphere (blind spot coverage)
```

**RSHELIOS-to-RSHELIOS overlap (adjacent roof sensors):**

For two RSHELIOS sensors separated by 2 m on the vehicle roof, both with 360 x 31.5 deg FOV:
- At 10 m range: ~85% point overlap (most of scene visible to both)
- At 50 m range: ~70% overlap (some angular divergence)
- At 100 m range: ~50% overlap (adequate for calibration)
- At 150 m range: ~30% overlap (marginal)

**RSHELIOS-to-RSBP overlap (co-located):**

When mounted on the same bracket (co-located):
- Vertical FOV overlap: +15 deg (RSHELIOS) to -16 deg (RSHELIOS) overlaps with 0 deg to -90 deg (RSBP)
- Overlap band: -16 deg to 0 deg (16 deg shared)
- Within RSBP range (30 m): good point density for calibration
- Method: VGICP on the overlapping 16 deg band, or hand-eye for full FOV

### 7.4 Coverage Gap Identification

```python
def identify_coverage_gaps(sensor_configs, resolution_deg=1.0,
                           min_range=0.5, max_range=100.0):
    """
    Identify angular directions with insufficient LiDAR coverage.
    Returns a spherical coverage map.
    """
    # Create spherical grid (azimuth x elevation)
    azimuths = np.arange(0, 360, resolution_deg)
    elevations = np.arange(-90, 90, resolution_deg)
    coverage_count = np.zeros((len(elevations), len(azimuths)), dtype=int)
    max_range_map = np.zeros_like(coverage_count, dtype=float)

    for config in sensor_configs:
        pos = np.array(config['position'])
        ori = np.array(config['orientation'])  # roll, pitch, yaw
        h_fov = config['h_fov']
        v_fov = config['v_fov']
        v_min = config.get('v_min', -v_fov / 2)
        v_max = config.get('v_max', v_fov / 2)
        sensor_range = config['max_range']

        # For each direction in the spherical grid, check if this sensor
        # can observe it (accounting for sensor orientation)
        for e_idx, elev in enumerate(elevations):
            for a_idx, azim in enumerate(azimuths):
                # Transform direction to sensor frame
                direction_vehicle = spherical_to_cartesian(azim, elev)
                direction_sensor = rotate_to_sensor_frame(
                    direction_vehicle, ori)
                sensor_azim, sensor_elev = cartesian_to_spherical(
                    direction_sensor)

                # Check if direction is within sensor FOV
                if (v_min <= sensor_elev <= v_max and
                    (h_fov >= 360 or is_in_h_fov(sensor_azim, h_fov))):
                    coverage_count[e_idx, a_idx] += 1
                    max_range_map[e_idx, a_idx] = max(
                        max_range_map[e_idx, a_idx], sensor_range)

    # Identify gaps
    gaps = np.where(coverage_count == 0)
    single_coverage = np.where(coverage_count == 1)  # No redundancy
    multi_coverage = np.where(coverage_count >= 2)    # Calibratable pairs

    return {
        'coverage_count': coverage_count,
        'max_range': max_range_map,
        'gap_directions': list(zip(elevations[gaps[0]], azimuths[gaps[1]])),
        'single_coverage_pct': len(single_coverage[0]) /
            coverage_count.size * 100,
        'multi_coverage_pct': len(multi_coverage[0]) /
            coverage_count.size * 100,
        'gap_pct': len(gaps[0]) / coverage_count.size * 100,
    }
```

**Typical ADT3 coverage analysis results:**

| Coverage Level | Percentage | Angular Region |
|---------------|------------|---------------|
| 0 sensors (gap) | ~5% | Directly above (+60 to +90 deg elevation), narrow bands between tilted RSHELIOS |
| 1 sensor only | ~25% | Extreme vertical angles, far-range edges |
| 2 sensors | ~40% | Most of the horizontal plane at medium range |
| 3+ sensors | ~30% | Close range (0-10 m), intersections of multiple FOVs |

### 7.5 Monte Carlo Placement Optimization

For new vehicle designs or when optimizing existing configurations, Monte Carlo simulation evaluates coverage quality across random sensor placements:

```python
def optimize_sensor_placement(vehicle_geometry, n_rshelios, n_rsbp,
                              n_iterations=10000):
    """
    Monte Carlo optimization of sensor placement on vehicle.
    Objective: maximize multi-coverage while minimizing gaps.
    """
    best_score = -np.inf
    best_config = None

    for _ in range(n_iterations):
        # Random placement within allowed mounting zones
        config = []
        for i in range(n_rshelios):
            pos = sample_mount_position(vehicle_geometry, 'roof')
            ori = sample_orientation(pitch_range=(-20, 10),
                                     yaw_range=(0, 360))
            config.append({
                'type': 'rshelios', 'position': pos, 'orientation': ori,
                'h_fov': 360, 'v_fov': 31.5, 'v_min': -16, 'v_max': 15,
                'max_range': 150
            })
        for i in range(n_rsbp):
            pos = sample_mount_position(vehicle_geometry, 'corner_low')
            ori = sample_orientation(pitch_range=(-60, -10),
                                     yaw_range=(0, 360))
            config.append({
                'type': 'rsbp', 'position': pos, 'orientation': ori,
                'h_fov': 360, 'v_fov': 90, 'v_min': -90, 'v_max': 0,
                'max_range': 30
            })

        # Evaluate
        analysis = identify_coverage_gaps(config)
        score = (
            -10 * analysis['gap_pct'] +           # Heavily penalize gaps
             2 * analysis['multi_coverage_pct'] +  # Reward overlap
            -5 * analysis['single_coverage_pct'] + # Penalize single-coverage
             1 * compute_calibration_feasibility(config)  # Reward pairwise observability
        )

        if score > best_score:
            best_score = score
            best_config = config

    return best_config, best_score
```

---

## 8. Temporal Synchronization

### 8.1 Why Temporal Sync Matters

Each spinning LiDAR acquires its point cloud over one full rotation period (50-200 ms depending on rotation speed). During vehicle motion, the sensor moves while scanning, causing motion distortion. When fusing multiple LiDARs, they must also be temporally aligned to avoid inter-sensor time offsets.

**Error from time offset:**

```
At vehicle speed v = 25 km/h (airside max):
  v = 6.94 m/s

Time offset impact:
   1 ms offset:  6.9 mm displacement
   5 ms offset: 34.7 mm displacement
  10 ms offset: 69.4 mm displacement
  50 ms offset: 347 mm displacement (catastrophic)
```

A 10 ms time offset between two LiDARs causes 7 cm displacement at 25 km/h — comparable to calibration error. Temporal synchronization must be < 1 ms for sub-centimeter fusion accuracy.

### 8.2 PTP/PPS Hardware Synchronization

**PTP (Precision Time Protocol, IEEE 1588):**

The RoboSense RSHELIOS supports PTP synchronization over Ethernet:

```
┌────────────┐      PTP      ┌────────────────┐
│  PTP Grand │──────────────>│  Network Switch │
│  Master    │  Sync msgs    │  (PTP-capable)  │
│  (GPS/NTP) │               │                 │
└────────────┘               └──┬──┬──┬──┬──┬──┘
                                │  │  │  │  │
                            ┌───┘  │  │  │  └───┐
                            │      │  │  │      │
                         ┌──▼──┐┌──▼─┐│┌─▼──┐┌──▼──┐
                         │LiDAR││LiDA││ │LiDA││LiDAR│
                         │  0  ││R 1 ││ │R 2 ││  3  │
                         └─────┘└────┘│ └────┘└─────┘
                                      │
                                   ┌──▼──┐
                                   │ Orin │
                                   │ AGX  │
                                   └──────┘

PTP achieves: < 1 us synchronization over Ethernet
Requirement:  PTP-capable Ethernet switch ($200-500)
```

**PPS (Pulse Per Second) synchronization:**

For sensors that do not support PTP (or for additional precision), a GPS-derived PPS signal provides a hardware time reference:

```
┌────────┐     PPS (1 Hz)      ┌──────────┐
│ GPS/   │─────────────────────│ Each     │
│ GNSS   │  1 pulse/second     │ LiDAR    │
│ Module │  Rising edge =      │ PPS-in   │
│        │  exact UTC second   │ port     │
└────────┘                     └──────────┘
```

RoboSense RSHELIOS supports PPS input via its connector. When PPS is connected, each point timestamp is referenced to the GPS UTC time, achieving < 100 ns accuracy.

### 8.3 Software Timestamp Alignment

When hardware sync is not available (or as a supplement), software-based timestamp alignment compensates for clock differences:

```python
import numpy as np
from collections import deque

class SoftwareTimestampAligner:
    """
    Aligns timestamps from multiple LiDARs using reference clock.
    Handles clock drift and jitter.
    """

    def __init__(self, n_sensors, buffer_size=100):
        self.n_sensors = n_sensors
        # Circular buffers for offset estimation
        self.offset_buffers = [deque(maxlen=buffer_size) for _ in range(n_sensors)]
        self.estimated_offsets = np.zeros(n_sensors)  # seconds
        self.estimated_drift_rates = np.zeros(n_sensors)  # seconds/second

    def update_offset(self, sensor_idx, sensor_timestamp, reference_timestamp):
        """
        Update offset estimate for a sensor.
        Called each time a scan is received.
        sensor_timestamp: timestamp from the LiDAR driver
        reference_timestamp: ROS system time or PTP reference
        """
        offset = reference_timestamp - sensor_timestamp
        self.offset_buffers[sensor_idx].append({
            'time': reference_timestamp,
            'offset': offset
        })

        # Estimate current offset and drift rate using linear regression
        if len(self.offset_buffers[sensor_idx]) >= 10:
            data = list(self.offset_buffers[sensor_idx])
            times = np.array([d['time'] for d in data])
            offsets = np.array([d['offset'] for d in data])

            # Linear fit: offset = a * time + b
            A = np.vstack([times, np.ones(len(times))]).T
            drift_rate, base_offset = np.linalg.lstsq(A, offsets, rcond=None)[0]

            self.estimated_drift_rates[sensor_idx] = drift_rate
            self.estimated_offsets[sensor_idx] = base_offset + \
                drift_rate * times[-1]

    def align_timestamp(self, sensor_idx, sensor_timestamp):
        """Correct a sensor timestamp to the reference clock."""
        return sensor_timestamp + self.estimated_offsets[sensor_idx]

    def get_sync_quality(self, sensor_idx):
        """Return estimated synchronization accuracy in milliseconds."""
        if len(self.offset_buffers[sensor_idx]) < 10:
            return float('inf')

        data = list(self.offset_buffers[sensor_idx])
        offsets = np.array([d['offset'] for d in data])
        residuals = offsets - np.mean(offsets)
        return np.std(residuals) * 1000  # Convert to ms
```

### 8.4 Motion Compensation (Ego-Motion Distortion Correction)

Each spinning LiDAR point was captured at a different time during the scan rotation. At 10 Hz (100 ms rotation period) and 25 km/h, the sensor moves 69 cm during one full rotation. Points acquired at the beginning of the scan are in a different vehicle position than points at the end.

**Motion distortion correction (de-skewing):**

```python
def deskew_point_cloud(points, point_timestamps, imu_data):
    """
    Correct motion distortion in a spinning LiDAR scan.

    points: Nx3 array of (x, y, z) in sensor frame
    point_timestamps: N array of per-point timestamps (relative to scan start)
    imu_data: list of (timestamp, angular_velocity, linear_acceleration)

    Returns: corrected Nx3 points, all projected to scan end time
    """
    scan_duration = point_timestamps[-1] - point_timestamps[0]
    reference_time = point_timestamps[-1]  # Project all points to scan end

    # Integrate IMU to get pose at each point's capture time
    # (Simplified: linear interpolation for small motions)
    corrected_points = np.copy(points)

    for i in range(len(points)):
        dt = reference_time - point_timestamps[i]

        # Get IMU state at this point's time
        omega, accel = interpolate_imu(imu_data, point_timestamps[i])

        # Small-angle rotation correction
        dtheta = omega * dt  # [wx, wy, wz] * dt
        R_correction = small_angle_rotation(dtheta)

        # Translation correction (assume constant velocity approximation)
        # Use velocity from IMU integration or wheel odometry
        v = get_velocity_at_time(imu_data, point_timestamps[i])
        dt_correction = v * dt

        # Apply correction
        corrected_points[i] = R_correction @ points[i] + dt_correction

    return corrected_points
```

**De-skewing is essential before calibration:** Running ICP on skewed point clouds from two sensors introduces systematic errors because the "ground truth" correspondences are themselves distorted. Always de-skew first, then calibrate.

**Aurrigo-specific:** The GTSAM pipeline already integrates IMU at 500 Hz, providing high-quality ego-motion for de-skewing. The per-point timestamps from `rslidar_sdk` are derived from the firing sequence and rotation encoder, providing ~microsecond relative timing within each scan.

### 8.5 Synchronization Quality Requirements

| Sync Level | Method | Accuracy | Suitable For |
|-----------|--------|----------|-------------|
| No sync | Independent clocks | 10-100 ms | Not suitable for fusion |
| Software NTP | ROS time_synchronizer | 1-10 ms | Development/debugging |
| Software PTP | linuxptp daemon | 10-100 us | Production (minimal hardware) |
| Hardware PTP | PTP-capable switch | < 1 us | **Recommended production** |
| Hardware PPS + PTP | GPS PPS + PTP | < 100 ns | Highest accuracy |

**Recommendation for Aurrigo:** Hardware PTP via PTP-capable Ethernet switch. Cost: $200-500 per switch (one per vehicle). Combined with IMU-based de-skewing, this provides < 1 mm temporal synchronization error at airside speeds.

---

## 9. Calibration Quality Metrics

### 9.1 Point Cloud Registration Error

The most direct metric: after applying calibration, how well do overlapping point clouds from different sensors agree?

```python
def compute_registration_error(cloud_a, cloud_b, T_a_to_b):
    """
    Compute registration error metrics between two calibrated point clouds.

    cloud_a: Nx3 points from sensor A (in sensor A frame)
    cloud_b: Mx3 points from sensor B (in sensor B frame)
    T_a_to_b: 4x4 SE(3) calibration transform (A to B)

    Returns dict of metrics.
    """
    from scipy.spatial import KDTree

    # Transform cloud_a into cloud_b's frame
    cloud_a_in_b = (T_a_to_b[:3, :3] @ cloud_a.T + T_a_to_b[:3, 3:4]).T

    # Find nearest neighbors
    tree_b = KDTree(cloud_b)
    distances, _ = tree_b.query(cloud_a_in_b)

    # Filter to overlap region (points with NN within threshold)
    overlap_mask = distances < 0.5  # 50 cm threshold for "overlapping"
    overlap_distances = distances[overlap_mask]

    if len(overlap_distances) < 100:
        return {'status': 'insufficient_overlap', 'overlap_points': len(overlap_distances)}

    return {
        'status': 'ok',
        'overlap_points': len(overlap_distances),
        'overlap_ratio': len(overlap_distances) / len(cloud_a),
        'mean_error_m': np.mean(overlap_distances),
        'median_error_m': np.median(overlap_distances),
        'rmse_m': np.sqrt(np.mean(overlap_distances**2)),
        'p95_error_m': np.percentile(overlap_distances, 95),
        'p99_error_m': np.percentile(overlap_distances, 99),
        'max_error_m': np.max(overlap_distances),
    }
```

**Quality thresholds:**

| Metric | Excellent | Good | Acceptable | Poor | Action Needed |
|--------|-----------|------|------------|------|---------------|
| Mean error | < 1 cm | 1-2 cm | 2-3 cm | 3-5 cm | > 5 cm |
| RMSE | < 1.5 cm | 1.5-3 cm | 3-5 cm | 5-8 cm | > 8 cm |
| P95 error | < 3 cm | 3-5 cm | 5-8 cm | 8-15 cm | > 15 cm |
| Overlap ratio | > 60% | 40-60% | 30-40% | 20-30% | < 20% |

### 9.2 Feature Alignment Metrics

Beyond raw point distance, check that geometric features (edges, corners, planes) align consistently:

```python
def compute_feature_alignment(cloud_a, cloud_b, T_a_to_b, voxel_size=0.2):
    """
    Compute feature-level alignment metrics.
    Detects edges and planes in each cloud and checks alignment.
    """
    # Transform cloud_a to common frame
    cloud_a_transformed = transform_cloud(cloud_a, T_a_to_b)

    # Extract edge points (high curvature)
    edges_a = extract_edges(cloud_a_transformed, curvature_threshold=0.1)
    edges_b = extract_edges(cloud_b, curvature_threshold=0.1)

    # Extract plane points (low curvature)
    planes_a = extract_planes(cloud_a_transformed, curvature_threshold=0.01)
    planes_b = extract_planes(cloud_b, curvature_threshold=0.01)

    # Edge alignment: nearest edge-to-edge distance
    if len(edges_a) > 0 and len(edges_b) > 0:
        tree_edges_b = KDTree(edges_b)
        edge_dists, _ = tree_edges_b.query(edges_a)
        edge_rmse = np.sqrt(np.mean(edge_dists[edge_dists < 0.5]**2))
    else:
        edge_rmse = float('inf')

    # Plane alignment: normal consistency + distance
    plane_consistency = compute_normal_consistency(planes_a, planes_b, voxel_size)

    return {
        'edge_rmse_m': edge_rmse,
        'plane_normal_consistency': plane_consistency,  # 0 to 1
    }
```

### 9.3 Cross-Sensor Detection Consistency

The ultimate downstream metric: do perception algorithms produce consistent detections from different sensors?

```
Detection Consistency Check:

For each detected object:
  1. Identify which LiDAR sensors observe it
  2. Run detection independently on each sensor's points
  3. Compare:
     - Bounding box center offset
     - Bounding box size difference
     - Classification agreement
     - Confidence difference

If calibration is correct:
  - Center offset < 10 cm for objects within 50 m
  - Size difference < 15%
  - Classification agreement > 95%

If calibration has drifted:
  - Center offset increases proportionally
  - Objects at sensor boundaries may be detected twice
  - Or missed entirely (split between sensors, neither has enough points)
```

### 9.4 Online Calibration Health Score

A composite health score combining all metrics, suitable for real-time monitoring:

```python
class CalibrationHealthScore:
    """
    Composite calibration health score for fleet monitoring.
    Published as ROS diagnostic at 1 Hz.
    """

    WEIGHTS = {
        'registration_rmse': 0.35,
        'feature_alignment': 0.20,
        'detection_consistency': 0.25,
        'thermal_stability': 0.10,
        'sync_quality': 0.10,
    }

    def compute_health(self, metrics):
        """
        Compute overall health score from individual metrics.
        Returns score in [0, 1] where 1 = perfect calibration.
        """
        scores = {}

        # Registration RMSE score (sigmoid-like mapping)
        rmse = metrics.get('registration_rmse_m', 0.05)
        scores['registration_rmse'] = np.clip(1.0 - rmse / 0.05, 0, 1)

        # Feature alignment score
        edge_rmse = metrics.get('edge_rmse_m', 0.03)
        scores['feature_alignment'] = np.clip(1.0 - edge_rmse / 0.03, 0, 1)

        # Detection consistency
        det_agreement = metrics.get('detection_agreement', 0.95)
        scores['detection_consistency'] = np.clip(det_agreement, 0, 1)

        # Thermal stability (how close to last known good temp)
        temp_drift = abs(metrics.get('temp_delta_from_cal', 0))
        scores['thermal_stability'] = np.clip(1.0 - temp_drift / 40.0, 0, 1)

        # Sync quality
        sync_ms = metrics.get('sync_quality_ms', 0.1)
        scores['sync_quality'] = np.clip(1.0 - sync_ms / 5.0, 0, 1)

        # Weighted combination
        total = sum(
            self.WEIGHTS[k] * scores[k] for k in self.WEIGHTS
        )

        # Level classification
        if total > 0.9:
            level = 'EXCELLENT'
        elif total > 0.75:
            level = 'GOOD'
        elif total > 0.6:
            level = 'ACCEPTABLE'
        elif total > 0.4:
            level = 'DEGRADED'
        else:
            level = 'CRITICAL'

        return {
            'total_score': total,
            'level': level,
            'component_scores': scores,
        }
```

### 9.5 When to Trigger Manual vs Automatic Recalibration

| Condition | Automatic Recalibration | Manual Inspection Required |
|-----------|------------------------|---------------------------|
| Drift 1-2 cm (slow) | GTSAM online correction | No |
| Drift 2-3 cm (slow) | Full targetless pipeline | Log for review |
| Drift > 3 cm (slow) | Attempt targetless | If auto fails, manual |
| Sudden shift > 1 cm | Attempt targetless | Always inspect mount |
| Sensor replacement | N/A | Full target-based required |
| Health score < 0.6 | Attempt targetless | If score stays < 0.6 |
| Health score < 0.4 | Stop autonomous ops | Mandatory manual |
| Post-maintenance | N/A | Full target-based required |
| Seasonal temperature shift | LUT correction | Verify LUT annually |

---

## 10. Certification Requirements

### 10.1 ISO 3691-4 Implications

ISO 3691-4 (Safety of industrial trucks — Driverless industrial trucks) applies to Aurrigo's airside vehicles and has implications for sensor calibration:

**Clause 4.10 — Sensor performance monitoring:**
- The safety system shall monitor sensor performance during operation
- Degraded sensor performance shall trigger a safe state
- Calibration is a precondition for sensor performance claims

**Clause 4.4.3 — Periodic verification:**
- Safety-related systems shall be periodically verified
- Verification intervals shall be defined and documented
- Calibration verification is part of periodic safety verification

**What this means for calibration:**

1. **Documented calibration procedure**: Written, version-controlled procedure for each vehicle type
2. **Calibration records**: Timestamped records of every calibration event (factory, field, automatic)
3. **Calibration monitoring**: Real-time monitoring with defined thresholds for safe operation
4. **Defined verification intervals**: Maximum time between calibration checks (e.g., weekly full check)
5. **Safe state on calibration failure**: Vehicle must stop if calibration degrades below safety threshold

### 10.2 ASIL Requirements for Calibration Monitoring

Under functional safety decomposition (ISO 26262 applied to airside vehicles):

| Component | ASIL Level | Requirement |
|-----------|-----------|-------------|
| Calibration monitoring (drift detection) | ASIL-B | Detect > 3 cm drift with 99% probability |
| Calibration alarm (threshold) | ASIL-B | False negative rate < 10^-7 / hour |
| Safe stop on calibration failure | ASIL-B | Response time < 500 ms from detection |
| Online calibration correction | QM (not safety) | Best-effort accuracy improvement |
| Calibration storage (EEPROM/file) | ASIL-A | Data integrity (CRC), write verification |

The key distinction: **monitoring and alarm** are safety-critical (must detect bad calibration), while **correction** is QM (nice to have, but safe stop is the safety fallback).

This means:
- The calibration health monitor (Section 9.4) must be developed to ASIL-B standards
- It must run on the safety-critical compute path (not just the performance path)
- It must have independent verification (not rely on the same GTSAM pipeline it monitors)
- The comma.ai Panda pattern applies: safety monitoring on dedicated MCU (see `operations/safety/runtime-verification-monitoring.md`)

### 10.3 Calibration Records and Traceability

Required records for each calibration event:

```
Calibration Record Schema:
{
  "vehicle_id": "ADT3-001",
  "event_id": "CAL-2026-04-11-001",
  "timestamp": "2026-04-11T08:30:00Z",
  "type": "automatic_online",        # factory / field_manual / automatic_online
  "trigger": "thermal_drift",         # scheduled / drift_alarm / maintenance / etc.
  "sensors": [
    {
      "sensor_id": "rshelios_0",
      "serial_number": "RS-H-00123",
      "firmware_version": "2.1.0",
      "pre_calibration": {
        "translation": [0.500, 1.200, 0.350],
        "quaternion": [1.0, 0.0, 0.0, 0.0],
        "health_score": 0.65
      },
      "post_calibration": {
        "translation": [0.501, 1.201, 0.351],
        "quaternion": [0.99999, 0.00012, -0.00005, 0.00003],
        "health_score": 0.95
      },
      "temperature_c": 35.2,
      "method": "vgicp_joint_optimization",
      "registration_rmse_m": 0.008,
      "validation_passed": true
    }
    // ... repeat for each sensor
  ],
  "environment": {
    "ambient_temp_c": 28.5,
    "tarmac_temp_c": 42.0,
    "wind_speed_ms": 3.2,
    "precipitation": "none"
  },
  "operator": "auto",                 # or operator name for manual
  "software_version": "aurrigo-cal-1.2.3",
  "approved_by": null,                # Required for manual calibrations
  "notes": ""
}
```

### 10.4 Periodic Verification Intervals

| Verification Type | Interval | Method | Duration | Record |
|------------------|----------|--------|----------|--------|
| Continuous monitoring | Every scan (10 Hz) | ICP residual check | < 1 ms | Aggregate statistics |
| Drift check | Every 10 seconds | VGICP pairwise | ~50 ms | Log if drift > warn |
| Health assessment | Every 60 seconds | Composite health score | ~100 ms | Always logged |
| Full targetless recal | Weekly or trigger | Full pipeline | ~5 min (static) | Full calibration record |
| Target-based verification | Quarterly | Factory procedure | ~30 min | Full record + sign-off |
| Annual certification audit | Yearly | External auditor review | 1 day | Formal report |

---

## 11. Practical Implementation

### 11.1 ROS Calibration Pipeline

**URDF sensor definitions:**

```xml
<!-- URDF excerpt for ADT3 LiDAR mounting -->
<robot name="adt3">
  <!-- Vehicle base -->
  <link name="base_link"/>

  <!-- RSHELIOS 0 - Front Right Roof -->
  <link name="rshelios_0">
    <visual>
      <geometry><cylinder radius="0.05" length="0.10"/></geometry>
    </visual>
  </link>
  <joint name="rshelios_0_joint" type="fixed">
    <parent link="base_link"/>
    <child link="rshelios_0"/>
    <!-- Calibrated extrinsics (updated by calibration system) -->
    <origin xyz="1.200 -0.600 1.850" rpy="0.0 0.087 -0.524"/>
    <!-- x=forward, y=left, z=up from base_link -->
    <!-- rpy: roll=0, pitch=5deg down, yaw=-30deg (right-forward) -->
  </joint>

  <!-- RSHELIOS 1 - Front Left Roof -->
  <link name="rshelios_1"/>
  <joint name="rshelios_1_joint" type="fixed">
    <parent link="base_link"/>
    <child link="rshelios_1"/>
    <origin xyz="1.200 0.600 1.850" rpy="0.0 0.087 0.524"/>
  </joint>

  <!-- RSBP 0 - Front Center Low -->
  <link name="rsbp_0"/>
  <joint name="rsbp_0_joint" type="fixed">
    <parent link="base_link"/>
    <child link="rsbp_0"/>
    <origin xyz="1.500 0.0 0.400" rpy="0.0 -0.785 0.0"/>
    <!-- pitch=-45deg (angled down for ground coverage) -->
  </joint>

  <!-- ... additional sensors ... -->
</robot>
```

**Launch file structure:**

```xml
<!-- calibration.launch -->
<launch>
  <!-- Load URDF with calibrated extrinsics -->
  <param name="robot_description"
         command="$(find xacro)/xacro '$(find adt3_description)/urdf/adt3.urdf.xacro'
                  calibration_file:='$(arg calibration_file)'" />

  <!-- Publish static TFs from URDF -->
  <node name="robot_state_publisher" pkg="robot_state_publisher"
        type="robot_state_publisher"/>

  <!-- Calibration monitoring node -->
  <node name="calibration_monitor" pkg="aurrigo_calibration"
        type="calibration_monitor_node" output="screen">
    <param name="check_rate_hz" value="1.0"/>
    <param name="drift_warn_translation_m" value="0.01"/>
    <param name="drift_warn_rotation_deg" value="0.05"/>
    <param name="drift_alarm_translation_m" value="0.02"/>
    <param name="drift_alarm_rotation_deg" value="0.1"/>
    <param name="thermal_compensation_enabled" value="true"/>
    <param name="thermal_lut_file"
           value="$(find adt3_calibration)/config/thermal_lut_ADT3-001.yaml"/>
    <rosparam param="sensor_pairs">
      - [rshelios_0, rshelios_1]
      - [rshelios_0, rshelios_3]
      - [rshelios_1, rshelios_2]
      - [rshelios_2, rshelios_5]
      - [rsbp_0, rshelios_0]
      - [rsbp_0, rshelios_1]
    </rosparam>
  </node>

  <!-- Online recalibration service -->
  <node name="online_recalibration" pkg="aurrigo_calibration"
        type="online_recalibration_node" output="screen">
    <param name="method" value="vgicp_joint"/>
    <param name="voxel_size" value="0.5"/>
    <param name="max_iterations" value="50"/>
    <param name="convergence_threshold" value="0.001"/>
  </node>
</launch>
```

**TF tree for 8-LiDAR ADT3:**

```
                              map
                               │
                           odom (GTSAM)
                               │
                           base_link
                    ╱    ╱    │    ╲    ╲
                   ╱    ╱     │     ╲    ╲
            rshelios_0  │  rsbp_0  │  rshelios_4
            rshelios_1  │  rsbp_1  │  rshelios_5
            rshelios_2  │  rsbp_2  │  rshelios_6
            rshelios_3     rsbp_3     rshelios_7
                          imu_link
                          gps_link

  All sensor frames connected to base_link via static transforms
  Updated by calibration system (re-published when changed)
```

### 11.2 Calibration Storage and Versioning

**YAML calibration file format:**

```yaml
# calibration/ADT3-001/extrinsics_v12.yaml
# Auto-generated by aurrigo_calibration. DO NOT EDIT MANUALLY.
vehicle_id: ADT3-001
calibration_version: 12
calibration_timestamp: "2026-04-11T08:30:00Z"
calibration_method: vgicp_joint_optimization
reference_temperature_c: 22.5
software_version: aurrigo-cal-1.2.3
validation_status: PASSED

sensors:
  rshelios_0:
    serial_number: RS-H-00123
    firmware: "2.1.0"
    frame_id: rshelios_0
    parent_frame: base_link
    translation:
      x: 1.2003
      y: -0.5998
      z: 1.8502
    quaternion:  # (x, y, z, w) ROS convention
      x: 0.00012
      y: 0.04357
      z: -0.25862
      w: 0.96501
    covariance_diagonal:  # [rx, ry, rz, tx, ty, tz] uncertainties
      - 0.00087  # rad
      - 0.00087  # rad
      - 0.00087  # rad
      - 0.0050   # m
      - 0.0050   # m
      - 0.0050   # m
    registration_rmse_m: 0.0082
    health_score: 0.95

  rshelios_1:
    serial_number: RS-H-00124
    firmware: "2.1.0"
    # ... (similar structure)

  # ... all 8 sensors

thermal_compensation:
  enabled: true
  lut_file: thermal_lut_ADT3-001.yaml
  reference_temperature_c: 20.0
```

**Version control strategy:**

```
aurrigo-ws/src/adt3_calibration/
├── config/
│   ├── factory/                      # Factory calibrations (gold standard)
│   │   ├── ADT3-001_factory.yaml
│   │   ├── ADT3-002_factory.yaml
│   │   └── ...
│   ├── active/                       # Currently active calibrations
│   │   ├── ADT3-001_active.yaml      # Symlink → latest version
│   │   └── ...
│   ├── history/                      # All calibration versions
│   │   ├── ADT3-001/
│   │   │   ├── extrinsics_v001.yaml  # Factory
│   │   │   ├── extrinsics_v002.yaml  # First field refinement
│   │   │   ├── ...
│   │   │   └── extrinsics_v012.yaml  # Current
│   │   └── ...
│   └── thermal/                      # Thermal LUTs per vehicle
│       ├── thermal_lut_ADT3-001.yaml
│       └── ...
├── scripts/
│   ├── run_target_calibration.py
│   ├── run_targetless_calibration.py
│   ├── validate_calibration.py
│   └── generate_thermal_lut.py
└── launch/
    ├── calibration.launch
    └── calibration_monitor.launch
```

### 11.3 Fleet-Wide Calibration Management

For a fleet of 20+ vehicles, manual calibration management becomes impractical. A centralized calibration management system tracks the calibration status of every sensor on every vehicle:

```
Fleet Calibration Dashboard:

Vehicle     Health  Last Cal    Temp    Status      Next Action
─────────   ──────  ──────────  ──────  ──────────  ───────────────────
ADT3-001    0.95    2h ago      28 C    NOMINAL     Scheduled: 5 days
ADT3-002    0.82    1d ago      32 C    GOOD        Monitor drift trend
ADT3-003    0.61    3d ago      41 C    DEGRADED    Auto-recal queued
ADT3-004    0.93    4h ago      25 C    NOMINAL     Scheduled: 6 days
STL2-001    0.48    7d ago      38 C    CRITICAL    STOP - Manual req
STL2-002    0.88    12h ago     29 C    GOOD        Scheduled: 4 days
POD-001     0.91    6h ago      27 C    NOMINAL     Scheduled: 6 days
...

Alerts:
  [CRITICAL] STL2-001: rshelios_2 drift 4.2 cm - vehicle stopped
  [WARNING]  ADT3-003: Overall health declining trend (0.82→0.61 in 2d)
  [INFO]     ADT3-001: Auto-recalibration completed successfully
```

**Fleet management ROS service interface:**

```python
# Fleet calibration manager (runs on central server, communicates via ROS bridge)
class FleetCalibrationManager:
    def __init__(self, fleet_config):
        self.vehicles = {}
        for vehicle_id in fleet_config:
            self.vehicles[vehicle_id] = VehicleCalibrationState(vehicle_id)

    def aggregate_fleet_statistics(self):
        """Compute fleet-wide calibration statistics."""
        health_scores = [v.health_score for v in self.vehicles.values()]
        return {
            'fleet_size': len(self.vehicles),
            'mean_health': np.mean(health_scores),
            'min_health': np.min(health_scores),
            'vehicles_nominal': sum(1 for h in health_scores if h > 0.75),
            'vehicles_degraded': sum(1 for h in health_scores if 0.4 < h <= 0.75),
            'vehicles_critical': sum(1 for h in health_scores if h <= 0.4),
            'recalibrations_today': self.count_recalibrations_today(),
            'manual_interventions_needed': self.count_manual_needed(),
        }
```

### 11.4 Cost and Time Estimates

**Initial setup (per vehicle):**

| Task | Time | Cost | Frequency |
|------|------|------|-----------|
| Factory target calibration | 1-2 hours | $200-400 (labor) | Once per vehicle |
| Thermal characterization | 4-6 hours | $400-800 (labor + climate chamber) | Once per vehicle |
| Software configuration | 1-2 hours | $200-400 (labor) | Once per vehicle type |
| Validation testing | 2-4 hours | $400-800 (labor) | Once per vehicle |
| **Total per vehicle** | **8-14 hours** | **$1,200-2,400** | **Initial setup** |

**Ongoing operations (per vehicle per year):**

| Task | Time/Year | Cost/Year | Frequency |
|------|-----------|-----------|-----------|
| Automatic online calibration | 0 (autonomous) | $0 | Continuous |
| Quarterly target verification | 4 x 30 min = 2 hr | $400 | Quarterly |
| Manual interventions (est.) | 4 x 1 hr = 4 hr | $800 | ~4 per year |
| Software maintenance | Shared across fleet | $5,000 (fleet) | Continuous |
| **Total per vehicle per year** | **~6 hours** | **$1,200 + fleet share** | — |

**Fleet economics (20 vehicles):**

| Scenario | Manual Calibration Only | With Automated System |
|----------|------------------------|----------------------|
| Initial software dev | $0 | $30,000-50,000 |
| Initial vehicle setup | $24,000-48,000 | $24,000-48,000 |
| Annual labor (20 vehicles) | $48,000-96,000 | $12,000-24,000 |
| Vehicle downtime cost/year | $40,000-80,000 | $5,000-10,000 |
| **3-year total** | **$188,000-336,000** | **$96,000-180,000** |
| **3-year savings** | — | **$92,000-156,000** |

The automated calibration system pays for itself within 1-2 years for a 20-vehicle fleet, primarily through reduced vehicle downtime and labor costs.

### 11.5 Implementation Roadmap

```
Phase 1: Foundation (Weeks 1-4) — $8,000-12,000
─────────────────────────────────────────────────
  - URDF models for each vehicle type
  - Static TF publishers from calibration files
  - Basic ICP-based drift monitoring node
  - Calibration YAML schema and storage
  - Manual target-based calibration procedure

Phase 2: Online Monitoring (Weeks 5-8) — $10,000-15,000
────────────────────────────────────────────────────────
  - VGICP pairwise registration at 1 Hz
  - Calibration health score computation
  - ROS diagnostics integration
  - Alert system (warn/alarm/critical)
  - Trigger-based recalibration (targetless)

Phase 3: GTSAM Integration (Weeks 9-12) — $12,000-18,000
─────────────────────────────────────────────────────────
  - Calibration variables in GTSAM factor graph
  - Joint pose + calibration optimization
  - Thermal compensation LUT
  - Temperature sensor integration
  - Online thermal coefficient estimation

Phase 4: Fleet Management (Weeks 13-16) — $8,000-12,000
────────────────────────────────────────────────────────
  - Fleet calibration dashboard
  - Calibration record database
  - Automated reporting for certification
  - Cross-vehicle calibration transfer (same type)
  - Annual thermal LUT verification procedure

Total: 16 weeks, $38,000-57,000
```

---

## 12. Key Takeaways

1. **Calibration accuracy directly impacts safety**: A 0.1 degree angular error produces 17.5 cm displacement at 100 m range — enough to cause object misdetection at sensor boundaries. For airside operations with personnel in close proximity to vehicles, sub-centimeter calibration accuracy is a safety requirement, not a nice-to-have.

2. **Use a layered calibration approach**: Factory target-based initialization (< 0.5 cm accuracy) followed by continuous GTSAM-integrated online refinement. Neither alone is sufficient — target-based cannot track drift, online cannot handle large misalignment.

3. **VGICP is the recommended ICP variant**: Already integrated with Aurrigo's GTSAM pipeline and GPU-accelerated on Orin. Achieves 0.3-1 cm accuracy at 8-25 ms per pairwise registration — fast enough for real-time monitoring.

4. **Thermal drift is the dominant drift source**: Aluminum sensor brackets can introduce 0.007 deg angular drift per 5 C temperature gradient, producing 12 mm displacement at 100 m. Carbon fiber mounts ($200-500 per bracket) reduce thermal drift by 97%, potentially eliminating the need for software thermal compensation.

5. **Motion-based (hand-eye) calibration handles non-overlapping sensors**: RSHELIOS and RSBP sensors on opposite sides of the vehicle have zero FOV overlap. Hand-eye calibration using ego-motion from per-sensor SLAM (or GTSAM) solves this without requiring any overlap.

6. **Temporal synchronization must be < 1 ms**: At 25 km/h, 1 ms time offset causes 7 mm displacement. Hardware PTP via PTP-capable Ethernet switch ($200-500 per vehicle) provides < 1 us synchronization — more than adequate.

7. **De-skew before calibration**: Motion distortion within a single spinning scan (up to 69 cm at 25 km/h, 10 Hz) is larger than calibration error. Always apply IMU-based de-skewing before running any calibration algorithm.

8. **Learning-based registration complements, does not replace, ICP**: GeoTransformer provides the widest convergence basin (handles initial misalignment > 30 deg) but achieves lower accuracy than VGICP. Use learning methods for coarse initialization, ICP for fine alignment.

9. **GTSAM joint optimization is the production approach**: Adding calibration variables to the existing GTSAM factor graph enables continuous, principled calibration refinement during normal driving, with proper uncertainty quantification. The prior noise model (5 mm translation, 0.05 deg rotation) prevents the optimizer from using calibration to compensate for localization errors.

10. **Online monitoring is ASIL-B, correction is QM**: Under functional safety decomposition, the system that detects bad calibration must meet ASIL-B integrity. The system that corrects calibration is quality management only — safe stop on detection is the safety function.

11. **Thermal compensation via empirical LUT is more reliable than physics-based**: While material expansion coefficients provide first-order predictions, real-world thermal drift depends on mount geometry, temperature gradients, bolt preload, and hysteresis. A 7-point empirical LUT built during factory characterization (4 hours per vehicle) captures all these effects.

12. **Calibration health score should be a composite metric**: No single metric captures calibration quality. The weighted combination of registration RMSE (35%), detection consistency (25%), feature alignment (20%), thermal stability (10%), and sync quality (10%) provides a robust single number for fleet monitoring.

13. **Weekly full recalibration is sufficient if online monitoring is active**: Continuous GTSAM-integrated monitoring catches drift within seconds. Full targetless recalibration is needed only when drift exceeds thresholds or on a weekly schedule. Target-based verification quarterly provides audit evidence.

14. **Fleet calibration management is essential at scale**: For 20+ vehicles with 8 sensors each, that is 160+ calibration states to track. Centralized management with automated reporting saves an estimated $36,000-72,000 per year in labor costs while providing the traceability records required for ISO 3691-4 certification.

15. **ADT3 coverage analysis shows 5% gap regions**: Directly above (+60 to +90 deg elevation) is uncovered. This is acceptable for airside operations (no overhead obstacles in those angles during normal driving), but should be documented in the safety case.

16. **The automated calibration system pays for itself within 1-2 years**: Initial development cost of $38,000-57,000 (16 weeks) yields $92,000-156,000 savings over 3 years for a 20-vehicle fleet, primarily from reduced downtime and labor. The break-even point improves as fleet size increases.

17. **All calibration events must be logged for certification**: ISO 3691-4 and emerging EU regulations require documented sensor calibration status. Every automatic recalibration, manual intervention, and health score transition must be recorded with timestamps, sensor IDs, environmental conditions, and pre/post metrics.

18. **Start with Phase 1-2 (monitoring + basic targetless)**: The monitoring infrastructure provides immediate safety value by detecting calibration degradation before it affects perception. Online targetless recalibration in Phase 2 handles most drift cases automatically. GTSAM integration (Phase 3) and fleet management (Phase 4) can follow as the fleet grows.

---

## References

**ICP and Registration:**
- Besl, P. and McKay, N. "A Method for Registration of 3-D Shapes." IEEE TPAMI, 1992.
- Segal, A., Haehnel, D., and Thrun, S. "Generalized-ICP." RSS, 2009.
- Koide, K., Yokozuka, M., Oishi, S., and Banno, A. "Voxelized GICP for Fast and Accurate 3D Point Cloud Registration." ICRA, 2021.

**Feature-Based:**
- Rusu, R.B., Blodow, N., and Beetz, M. "Fast Point Feature Histograms (FPFH) for 3D Registration." ICRA, 2009.
- Zhong, Y. "Intrinsic Shape Signatures: A Shape Descriptor for 3D Object Recognition." ICCV, 2009.

**Learning-Based:**
- Aoki, Y., et al. "PointNetLK: Robust & Efficient Point Cloud Registration using PointNet." CVPR, 2019.
- Wang, Y. and Solomon, J. "Deep Closest Point." ICCV, 2019.
- Yew, Z.J. and Lee, G.H. "RPM-Net: Robust Point Matching using Learned Features." CVPR, 2020.
- Qin, Z., et al. "Geometric Transformer for Fast and Robust Point Cloud Registration." CVPR, 2022.

**Hand-Eye Calibration:**
- Tsai, R.Y. and Lenz, R.K. "A New Technique for Fully Autonomous and Efficient 3D Robotics Hand/Eye Calibration." IEEE Trans. Robotics and Automation, 1989.
- Park, F.C. and Martin, B.J. "Robot Sensor Calibration: Solving AX=XB on the Euclidean Group." IEEE Trans. Robotics and Automation, 1994.

**Multi-LiDAR Systems:**
- Jiao, J., et al. "Automatic Calibration of Multiple 3D LiDARs in Urban Environments." IROS, 2019.
- Liu, Z., et al. "BALM: Bundle Adjustment for Lidar Mapping." IEEE RA-L, 2021.
- Lv, X., et al. "LiDAR-LiDAR Extrinsic Calibration using Segment Matching." ICRA, 2021.

**Temporal Synchronization:**
- IEEE 1588-2019. "IEEE Standard for a Precision Clock Synchronization Protocol for Networked Measurement and Control Systems."

**Related Documents in This Repository:**
- `20-av-platform/sensors/robosense-lidar.md` — RoboSense RSHELIOS and RSBP specifications
- `10-knowledge-base/state-estimation/gtsam-factor-graphs.md` — GTSAM factor graph optimization, VGICP details
- `technology/perception/uncertainty-quantification-calibration.md` — Uncertainty quantification and confidence calibration
- `operations/safety/runtime-verification-monitoring.md` — Runtime monitoring, safety MCU pattern
- `operations/safety/functional-safety-software.md` — MISRA C, ISO 26262, ASIL decomposition
