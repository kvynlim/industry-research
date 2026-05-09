# LiDAR Bundle Adjustment Factors

## Executive Summary

LiDAR bundle adjustment adapts the bundle-adjustment idea from visual SLAM to point-cloud mapping. Instead of minimizing image reprojection error over camera poses and landmarks, LiDAR BA optimizes scan or keyframe poses against geometric feature constraints such as point-to-plane, point-to-line, voxelized plane, GICP, or integrated ICP residuals.

The BALM line is the canonical reference. BALM formulates LiDAR BA as minimizing distances from feature points to matched edge or plane features, then analytically eliminates feature parameters so the optimization depends mainly on scan poses. BALM2 and related implementations emphasize efficient plane association, consistency, and sliding-window use. Newer libraries such as `gtsam_points` expose point-cloud registration, BA, continuous-time ICP, and GPU-accelerated factors directly in a GTSAM-style factor graph.

This page focuses on the factor and state representation, not on one full odometry system. It connects to [Bundle Adjustment SLAM](bundle-adjustment-slam.md), [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md), [GICP/VGICP](gicp-vgicp.md), [LOAM](loam.md), [CT-ICP](ct-icp.md), and [GLIM](glim.md).

## Method Class

- LiDAR mapping backend.
- Sliding-window or batch nonlinear least squares.
- Geometric feature BA over scan/keyframe poses.
- Factor-graph point-cloud registration.
- Local map refinement layer for LiDAR odometry and LiDAR-inertial SLAM.

## Method Summary

Visual BA has observations:

```text
camera pose + 3D landmark -> image measurement residual
```

LiDAR BA replaces image measurements with geometric scan constraints:

```text
scan pose + feature correspondence -> point-to-plane / point-to-line / distribution residual
```

In BALM, point features from multiple LiDAR scans are associated with edge or plane features. The optimization can be written conceptually as:

```text
min_X,F sum || distance( T_i * p_ik, feature_j ) ||^2
```

where `X` are scan poses and `F` are geometric features. BALM's key observation is that the feature parameters can be solved analytically and eliminated, reducing the optimization scale to scan poses. This makes dense plane and edge features practical in a local window.

In factor-graph libraries, the same idea appears as factors:

```text
f_plane(X_i, point, plane_model)
f_line(X_i, point, line_model)
f_icp(X_i, X_j, scan_i, scan_j)
f_gicp(X_i, X_j, distribution_i, distribution_j)
f_ct_icp(control_points, point_time, map)
```

## Factor and State Representation

Typical state variables include:

```text
X_i: SE(3) pose of scan/keyframe i
v_i: velocity, optional for LiDAR-inertial windows
b_i: IMU bias, optional
T_LI: LiDAR-IMU extrinsic, optional calibration state
C_k: continuous-time B-spline control pose, optional
```

Common LiDAR BA factor families:

```text
point-to-plane:
  r = n^T (T_i p - q)

point-to-line:
  r = || (T_i p - a) x (T_i p - b) || / ||a - b||

GICP / VGICP:
  r = T_i p_i - T_j p_j
  weighted by combined local covariance

integrated ICP factor:
  residual summarizes a registration cost over many correspondences

BALM-style feature factor:
  feature parameters are solved/eliminated analytically
```

The backend can be:

- **scan-to-map:** current scan features are constrained to a local map or voxel map;
- **multi-scan BA:** many scan poses in a window share geometric feature constraints;
- **pose graph plus local BA:** loop closures optimize a pose graph, while BA refines local geometry;
- **continuous-time BA:** points are corrected by a trajectory spline rather than one rigid pose per scan.

## Front-End Mechanics

1. **Motion compensation.** Deskew LiDAR scans with IMU, wheel, or continuous-time estimates.

2. **Keyframe/window selection.** Keep a sliding window or submap set with enough parallax and overlap.

3. **Feature extraction.** Extract planes, edges, surfels, voxel covariances, or use all points with downsampling.

4. **Association.** Match points to planes/lines/voxels using nearest neighbors, adaptive voxelization, or local map search.

5. **Quality checks.** Reject weak planes, unstable lines, dynamic clusters, and correspondences with bad residuals or poor support.

6. **Initial pose.** Provide a reasonable initial guess from odometry, IMU propagation, scan matching, or a prior factor.

7. **Factor construction.** Add geometric factors, priors, odometry factors, IMU factors, and optional extrinsic calibration factors.

## Back-End Mechanics

LiDAR BA is solved with Gauss-Newton, Levenberg-Marquardt, iSAM2-style incremental updates, or custom second-order derivatives. BALM derives analytical derivatives up to second order for efficiency. GTSAM-based implementations can combine LiDAR factors with IMU preintegration, GNSS, loop closures, and calibration.

The main engineering tradeoff is between factor fidelity and runtime:

- explicit per-point factors are expressive but expensive;
- integrated factors summarize a registration cost and reduce graph size;
- voxelized covariance factors are faster but can hide local correspondence failures;
- continuous-time factors model spinning LiDAR motion more accurately but add spline states.

Robust losses are usually required:

```text
rho(r): Huber, Cauchy, Tukey, Geman-McClure, or GNC schedule
```

For mapping, run local BA online and reserve larger batch BA for offline map production unless the platform has substantial compute headroom.

## Assumptions

- Initial poses are close enough for geometric association.
- Static structure dominates the selected features.
- Point timestamps and extrinsics are calibrated well enough.
- Feature support is rich enough; long tunnels, open aprons, and flat fields can be degenerate.
- Correspondence search uses consistent frames and deskewing.
- Covariance or robust loss reflects registration uncertainty realistically.

## Strengths

- Reduces drift beyond frame-to-frame odometry.
- Uses dense LiDAR geometry rather than sparse visual landmarks.
- Handles illumination-independent mapping.
- Fits factor-graph fusion with IMU, GNSS, wheel odometry, loop closures, and calibration.
- BALM-style elimination keeps large feature sets tractable.
- Continuous-time variants handle motion distortion and asynchronous sensors.

## Limitations

- Correspondence errors can dominate if the initial pose is poor.
- Dynamic objects and temporary structures create inconsistent factors.
- Geometric degeneracy can leave yaw, translation, or height weakly observable.
- Full BA over large maps is expensive without submap/window management.
- Point-to-plane costs can overfit local planes while missing semantic map correctness.
- Many open-source packages are research code with ROS, compiler, and dependency constraints.

## Datasets and Benchmarks

Useful benchmarks include:

- **KITTI Odometry.** Outdoor driving, common for LiDAR odometry drift and mapping.
- **Newer College.** Campus-scale LiDAR with rich geometry and revisits.
- **HILTI SLAM Challenge.** Handheld, indoor/outdoor, construction-like scenes with motion distortion and difficult geometry.
- **VIRAL / UrbanLoco.** Multi-sensor datasets relevant for LiDAR-inertial and UWB/visual fusion.
- **Custom AV mapping drives.** Required for route-scale validation, dynamic-object frequency, and map-product accuracy.

Metrics:

- ATE/RPE against ground truth;
- local map consistency and point-to-plane residuals;
- loop-closure corrected map error;
- runtime per window and memory per keyframe;
- convergence rate under disturbed initial poses;
- sensitivity to dynamic-object removal.

## AV Relevance

LiDAR BA is highly relevant to AV map production and high-quality localization-map maintenance. A vehicle can run a fast odometry stack online, then use LiDAR BA to refine local submaps, align repeated passes, and produce cleaner lane/curb/pole geometry.

For production autonomy, BA should not be the only live state estimator. Use it as:

- a local refinement layer behind LiDAR-inertial odometry;
- an offline or cloud map-building stage;
- a verification tool for map updates;
- a factor type inside a larger estimator that also includes GNSS, IMU, wheel, and loop closure.

## Indoor and Outdoor Relevance

- **Outdoor:** Excellent for roads, campuses, industrial yards, tunnels, and airside maps when static infrastructure is available.
- **Indoor:** Strong in offices, warehouses, factories, and construction sites with planes and edges; weak in repetitive corridors without distinctive geometry.
- **Mixed:** Continuous-time or deskewed factors matter when moving between open high-speed outdoor segments and tight indoor turns.

## Integration Checklist

- Decide whether the BA state is scan poses, keyframe poses, submap poses, or continuous-time spline controls.
- Define exact LiDAR timestamp, deskewing, and extrinsic conventions.
- Start with scan-to-map or small-window BA before global BA.
- Use robust losses and dynamic-object filtering.
- Validate correspondence quality before inserting factors.
- Add degeneracy detection from Hessian eigenvalues or covariance.
- Keep raw points, downsampled points, and feature metadata versioned with the map.
- Benchmark online runtime and offline batch cost separately.
- Compare against a non-BA baseline such as [KISS-ICP](kiss-icp.md), [LIO-SAM](lio-sam.md), or [FAST-LIO/FAST-LIO2](fast-lio-fast-lio2.md).
- For GTSAM integration, wrap large point-cloud costs as efficient factors rather than millions of scalar residual objects.

## Related Repository Docs

- [Bundle Adjustment SLAM](bundle-adjustment-slam.md)
- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
- [GICP and VGICP](gicp-vgicp.md)
- [CT-ICP](ct-icp.md)
- [LOAM](loam.md)
- [LIO-SAM](lio-sam.md)
- [GLIM](glim.md)

## Sources

- Liu and Zhang, "BALM: Bundle Adjustment for Lidar Mapping," arXiv, 2020: https://arxiv.org/abs/2010.08215
- BALM official repository: https://github.com/hku-mars/BALM
- BALM IEEE Xplore entry: https://ieeexplore.ieee.org/document/9361125
- `gtsam_points` official repository: https://github.com/koide3/gtsam_points
- `gtsam_points` Zenodo DOI: https://doi.org/10.5281/zenodo.13378352
- Koide et al., "Globally Consistent 3D LiDAR Mapping with GPU-accelerated GICP Matching Cost Factors," IEEE RA-L, 2021: https://doi.org/10.1109/LRA.2021.3059587
- Huang et al., "On Bundle Adjustment for Multiview Point Cloud Registration," IEEE RA-L, 2021: https://doi.org/10.1109/LRA.2021.3060773

