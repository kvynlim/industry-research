# Kimera-VIO

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "fallback", "gnss-denied", "indoor", "validation"]
  reason: "Kimera-VIO is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use."
method-priority:end -->

## Executive Summary

Kimera-VIO is the visual-inertial odometry component of the MIT-SPARK Kimera stack. It is an optimization-based VIO system built around stereo cameras plus IMU, with optional mono + IMU operation. The full Kimera library extends the VIO front end into robust pose-graph optimization, local and global mesh reconstruction, and semantic 3D reconstruction; this page focuses on Kimera-VIO as a method-level SLAM/VIO component.

Kimera-VIO is important because it packages several production-relevant design choices into an open-source C++ system: IMU preintegration, structureless visual factors, fixed-lag smoothing in GTSAM/iSAM2, robust geometric verification, loop-closure support through Kimera-RPGO, and mesh outputs that make visual-inertial state estimation useful to downstream spatial perception. Relative to [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md), it is more tightly connected to GTSAM and metric-semantic reconstruction. Relative to [OpenVINS](openvins.md), it is smoothing/factor-graph centered rather than MSCKF/filter centered. Relative to newer learned systems such as [DROID-SLAM](droid-slam.md), [DPVO](dpvo.md), and [MASt3R-SLAM](mast3r-slam.md), Kimera-VIO is classical, interpretable, and easier to integrate with deterministic sensor-fusion stacks.

For autonomous vehicles and airport airside autonomy, Kimera-VIO is best treated as a high-quality visual-inertial local odometry and local mesh module, not as the authoritative global localization stack. It should feed the broader architecture in [Mapping and Localization](../overview/mapping-and-localization.md), with RTK-GNSS, LiDAR scan-to-map localization, wheel odometry, and fault detection handled by the central estimator described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).

## Historical Context

Kimera came from the MIT-SPARK line of research around robust spatial perception. The 2020 ICRA paper presented Kimera as an open-source real-time metric-semantic localization and mapping library, combining VIO, robust pose-graph optimization, lightweight meshing, and dense semantic reconstruction. At the time, many open-source systems were either strong VIO/SLAM libraries without dense semantic mapping, or RGB-D semantic mapping systems requiring GPU-heavy reconstruction. Kimera's contribution was to put these pieces into one modular, CPU-oriented C++ stack.

Kimera-VIO itself builds on the factor-graph VIO tradition: IMU preintegration on manifolds, structureless smart vision factors, fixed-lag smoothing, and iSAM2 incremental optimization. These are also foundations for many robotics localization stacks using GTSAM. Kimera's distinctive system-level contribution is not a single new residual but the practical integration of a robust front end, VIO back end, pose graph, local mesh, and semantic reconstruction pipeline.

The full Kimera stack is useful in a method library because it bridges older visual-inertial odometry and newer spatial-perception systems. It predates the current wave of learned dense visual SLAM, but it already frames SLAM as a source of geometry and semantics rather than only a camera trajectory. That makes it a useful classical counterpart to [MASt3R-SLAM](mast3r-slam.md), which also targets dense geometry but uses learned two-view reconstruction priors instead of stereo VIO and TSDF-style fusion.

## Sensor Assumptions

Primary Kimera-VIO assumptions:

- Stereo camera plus synchronized IMU is the reference configuration.
- Mono + IMU operation is supported but less attractive for vehicle deployment.
- Camera intrinsics, stereo extrinsics, and camera-IMU extrinsics must be calibrated.
- Accurate timestamps are essential; camera/IMU offset errors directly corrupt preintegration and visual residuals.
- Global-shutter cameras are preferred for mobile robots and vehicles.
- The IMU should have known noise density, random walk, saturation limits, and bias behavior.
- The scene should be mostly static for feature tracking and loop closure.
- VIO initialization needs enough visual texture, parallax, and inertial excitation.

Kimera's full metric-semantic pipeline adds more assumptions:

- Dense stereo is used by Kimera-Semantics for global TSDF-style reconstruction.
- Optional semantic labels are assumed to come from an external 2D segmentation network or ground-truth labels in simulation.
- Mesh generation quality depends on accurate VIO poses and stereo depth quality.

For airside vehicles, the practical configuration is stereo + IMU with hardware synchronization, rigid mounts, fixed or well-controlled exposure, and calibration procedures that can be repeated after maintenance. Mono + IMU is useful for comparison but should not be the baseline for operational vehicle localization.

## State/Map Representation

Kimera-VIO estimates a local visual-inertial state over keyframes:

- IMU/camera pose.
- Velocity.
- Gyroscope bias.
- Accelerometer bias.
- Camera-IMU extrinsics if configured.
- A fixed-lag smoother state over recent keyframes.
- Marginalization priors for states leaving the lag window.

The visual map in the VIO module is sparse and structureless. Visual feature tracks are used to constrain the camera trajectory, but 3D landmarks are not retained as full persistent optimization variables in the same way as a classical landmark BA system. Instead, structureless vision factors triangulate or eliminate feature positions analytically, keeping the optimized state focused on poses and inertial variables.

The broader Kimera stack adds multiple map representations:

- A pose graph over keyframes for global trajectory correction through Kimera-RPGO.
- Odometry edges from Kimera-VIO and loop-closure edges from visual place recognition.
- A local per-frame or multi-frame triangular mesh from tracked sparse features.
- A slower global TSDF-derived mesh from dense stereo.
- Optional semantic probabilities or labels attached to the global mesh.

For AV use, the sparse VIO graph and mesh are not equivalent to an HD map, drivable-area map, or airport operational map. They are localization and local geometry products that should be fused with or referenced against the map layers discussed in [Mapping and Localization](../overview/mapping-and-localization.md).

## Algorithm Pipeline

Kimera-VIO and the related Kimera modules can be summarized as follows:

1. Sensor ingestion:
   - Receive stereo or monocular images and high-rate IMU measurements.
   - Buffer and synchronize measurements.
   - Publish high-rate propagated estimates when required.

2. Visual front end:
   - Detect Shi-Tomasi-style corner features in keyframes.
   - Track features with Lucas-Kanade optical flow.
   - Find left-right stereo correspondences.
   - Apply mono geometric verification, typically with 5-point RANSAC.
   - Apply stereo geometric verification, typically with 3-point RANSAC.
   - Optionally exploit IMU rotation priors for lower-point RANSAC variants.

3. Inertial front end:
   - Preintegrate raw IMU measurements between consecutive keyframes.
   - Produce compact relative motion constraints with covariance and bias Jacobians.

4. VIO back end:
   - Add preintegrated IMU factors and structureless visual factors to a GTSAM factor graph.
   - Optimize with iSAM2.
   - Run as fixed-lag smoothing for bounded runtime, or full smoothing for offline evaluation.
   - Marginalize states outside the time horizon.

5. Loop closure and global correction:
   - Use DBoW2 visual place recognition to propose loop closures.
   - Verify loop closures geometrically.
   - Pass loop constraints to Kimera-RPGO.
   - Reject inconsistent loop closures with PCM-style consistency checking.
   - Optimize the pose graph for a globally consistent trajectory.

6. Meshing and semantics:
   - Build low-latency local meshes from tracked feature structure.
   - Fuse dense stereo into a global TSDF-style representation.
   - Extract a global mesh and optionally propagate semantic labels from 2D segmentation.

The important architectural point is modularity. Kimera-VIO can be run alone as VIO, or the full Kimera stack can add loop closure, mesh reconstruction, and semantics.

## Formulation

Kimera-VIO is a maximum-a-posteriori fixed-lag smoothing problem over recent states:

```text
min_X {
  ||r_prior||^2
  + sum IMU factors ||r_imu(x_i, x_j, b_i, b_j; z_imu)||^2
  + sum structureless vision factors ||r_vision(T_i, T_j, ...; z_uv)||^2
}
```

Each state includes pose, velocity, and IMU biases. IMU preintegration converts high-rate inertial samples into a relative constraint between keyframes:

```text
r_imu = [
  rotation_error(Delta_R_ij, R_i, R_j, b_g)
  velocity_error(Delta_v_ij, v_i, v_j, g, b_a, b_g)
  position_error(Delta_p_ij, p_i, p_j, v_i, g, b_a, b_g)
  bias_random_walk_terms
]
```

The visual component uses structureless factors. For a feature track observed by multiple frames, the 3D point can be triangulated and eliminated from the optimization, leaving a constraint only on the observing camera poses. This has two practical benefits:

- The state dimension is bounded by poses and inertial quantities rather than a large number of landmarks.
- Degenerate or low-parallax points can be rejected before they corrupt the smoother.

Kimera-RPGO then solves a pose-graph problem:

```text
min over keyframe poses:
  sum odometry_edges ||log(Z_ij^-1 * T_i^-1 * T_j)||^2
  + sum accepted_loop_edges ||log(Z_lc^-1 * T_a^-1 * T_b)||^2
```

The key robustness layer is loop-closure consistency selection. Kimera-RPGO uses pairwise consistency ideas so that visually plausible but geometrically inconsistent loop closures are rejected before graph optimization.

## Failure Modes

Kimera-VIO failure modes:

- Poor feature tracking on low-texture pavement, sky, blank walls, clean aircraft fuselage, or motion-blurred images.
- Stereo failure on textureless or reflective surfaces.
- Bad IMU/camera synchronization.
- Incorrect camera intrinsics, stereo baseline, or camera-IMU extrinsics.
- Insufficient motion excitation during initialization.
- Long smooth motion with weak parallax and weak inertial excitation.
- IMU vibration, saturation, or badly tuned noise parameters.
- Rolling shutter distortion.
- Dynamic objects dominating tracks: aircraft, belt loaders, baggage carts, tugs, buses, and ground crew.
- False loop closures in repeated corridors, stands, gates, jet bridges, or service-road layouts.
- Dense stereo artifacts in textureless, reflective, wet, or low-light scenes.
- Semantic-map errors if the 2D segmentation model is out of domain.

Kimera's robust pose-graph optimizer reduces loop-closure risk but does not remove the need for independent validation. A wrong loop closure accepted into a localization stack can create a confident but wrong global pose. In airside autonomy, loop closures near visually similar stands should be treated as advisory until verified by LiDAR, GNSS, surveyed landmarks, or map constraints.

## AV Relevance

Kimera-VIO is relevant to AVs because it provides:

- Metric local odometry from cameras and IMU.
- High-rate inertial propagation with lower-rate visual correction.
- A factor-graph formulation compatible with broader estimation back ends.
- Loop-closure and pose-graph concepts useful for map building and survey validation.
- Local mesh output that can support obstacle-aware spatial perception research.

Its limitations for AV production are equally important:

- It is not a full safety-certified localization system.
- It does not provide lane/taxiway semantics, drivable-area rules, or regulatory map elements by itself.
- Its local mesh is not a substitute for a validated occupancy map.
- Camera-heavy localization is fragile under weather, glare, nighttime lighting, and dynamic apron activity.
- The open-source stack is research software and must be audited before any product use.

For an airside autonomous vehicle, Kimera-VIO is a strong classical baseline for the visual-inertial layer. It should be compared with [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md), [OpenVINS](openvins.md), and [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), while learned dense methods such as [DROID-SLAM](droid-slam.md), [DPVO](dpvo.md), and [MASt3R-SLAM](mast3r-slam.md) should be evaluated as research alternatives rather than immediate production replacements.

## Indoor/Outdoor Relevance

Indoor relevance:

- Strong in warehouses, baggage halls, service tunnels, terminals, and maintenance spaces with enough visual texture.
- Stereo + IMU can handle GPS-denied areas and short feature dropouts better than visual-only SLAM.
- Mesh output is useful for local spatial perception and mapping experiments.
- Repetitive corridors and low-texture walls still create tracking and loop-closure risks.

Outdoor relevance:

- Useful in structured outdoor environments with terminal facades, signs, poles, road markings, equipment edges, and textured infrastructure.
- Weaker on open aprons and taxiways where the camera may see large uniform pavement, sky, and distant structures.
- Stereo range and dense stereo quality degrade on far, low-texture, reflective, or overexposed surfaces.
- GNSS availability outdoors is useful but should be fused outside Kimera-VIO with robust gates.

Indoor/outdoor transition is a natural role. Kimera-VIO can bridge from a GNSS-rich service road into a terminal underpass or baggage hall, but the global frame management should remain in the central localization stack.

## Airside Deployment Notes

Recommended deployment pattern:

- Use Kimera-VIO as a local VIO factor source, not as the sole navigation pose.
- Prefer stereo + IMU with hardware timestamping and global-shutter HDR cameras.
- Mount cameras to see stable structure: terminal facades, signs, jet bridge structure, building edges, stand equipment, and painted features. Avoid camera views dominated by pavement and sky.
- Calibrate camera intrinsics, stereo extrinsics, camera-IMU extrinsics, and time offset after installation and after mechanical service.
- Validate IMU vibration behavior on real ground-support equipment, not only handheld or MAV datasets.
- Log feature counts, stereo match counts, RANSAC inliers, IMU residuals, bias estimates, marginalization status, loop-closure candidates, PCM accept/reject decisions, and mesh quality indicators.
- Treat loop closure as disabled or advisory until false-positive rates are measured in repeated stand/gate layouts.
- Fuse with RTK-GNSS, LiDAR scan-to-map, wheel odometry, and airport map constraints.
- Use LiDAR or radar as the primary geometric safety sensor in wet, dark, glare-heavy, or low-texture outdoor apron conditions.

Airside acceptance tests should include terminal overhangs, night apron lighting, rain and wet pavement, parked aircraft at stands, aircraft absent from stands, repeated gate geometry, long straight service roads, baggage hall entry/exit, and rough-pavement vibration.

## Datasets/Metrics

Common datasets:

- EuRoC MAV: the central benchmark for Kimera-VIO and many stereo-inertial systems.
- TUM-VI: useful for high-resolution fisheye visual-inertial testing, though Kimera examples are more EuRoC-centered.
- KITTI Odometry: relevant for vehicle-scale stereo visual odometry comparisons, but not a direct VIO benchmark.
- KAIST Urban / KAIST VIO: useful for vehicle-like VIO assessment.
- Custom airport datasets are required for final airside claims.

Metrics:

- ATE/APE RMSE in meters after SE(3) alignment when scale is metric.
- RPE over fixed time and distance intervals.
- Drift per 100 m and per minute.
- Initialization success rate and time to initialize.
- Tracking uptime and reset rate.
- Bias convergence and IMU residual consistency.
- Loop-closure precision/recall and false-positive rate.
- Pose-graph correction magnitude after loop closure.
- Mesh accuracy, completeness, and Chamfer-style distance when dense reconstruction is evaluated.
- Runtime, CPU load, frame latency, and IMU-rate output availability.

Airside-specific metrics should include pose error during GNSS outages, covariance growth under terminal cover, false loop closures across visually similar stands, mesh artifacts from aircraft and moving GSE, and localization error near stand stop lines, hold markings, and service-road boundaries.

## Open-Source Implementations

- Kimera-VIO official repository: C++ core VIO implementation with GTSAM, OpenCV, DBoW2, Kimera-RPGO, and evaluation/debugging tooling.
- Kimera-VIO-ROS official repository: ROS wrapper for live and dataset operation.
- Kimera-RPGO: robust pose-graph optimization component used by the broader Kimera stack.
- Kimera-Semantics and related Kimera packages: useful when evaluating metric-semantic mesh reconstruction rather than VIO alone.

Implementation cautions:

- The reference stack is ROS1/C++ research software; modern ROS2 or production integration will require wrapping and audit work.
- GTSAM version, compiler, and dependency choices matter.
- Dataset launch success does not imply field readiness.
- Camera/IMU calibration dominates performance.
- BSD licensing is favorable compared with GPL systems, but third-party dependency licenses still need review.

## Practical Recommendation

For the method-level library, Kimera-VIO should be treated as the strongest classical GTSAM-based stereo-inertial VIO and local meshing reference. It is a better architectural study for factor-graph VIO and mesh-aware spatial perception than pure visual SLAM systems such as [LSD-SLAM / DSO](lsd-slam-dso.md).

For airside AVs, evaluate Kimera-VIO in stereo-inertial mode as an auxiliary local odometry and local mesh module. Fuse its output with LiDAR localization, RTK-GNSS, wheel odometry, and IMU in the central estimator. Do not rely on Kimera loop closure or dense stereo mesh as operational truth until airport-specific false-positive, weather, lighting, and dynamic-object tests are passed.

## Sources

### Primary Papers and Repositories

- Rosinol, Abate, Chang, and Carlone, "Kimera: an Open-Source Library for Real-Time Metric-Semantic Localization and Mapping": https://arxiv.org/abs/1910.02490
- Kimera-VIO official repository: https://github.com/MIT-SPARK/Kimera-VIO
- Kimera-VIO-ROS official repository: https://github.com/MIT-SPARK/Kimera-VIO-ROS
- Forster, Carlone, Dellaert, and Scaramuzza, "On-Manifold Preintegration for Real-Time Visual-Inertial Odometry": https://arxiv.org/abs/1512.02363
- Carlone et al., "Eliminating Conditionally Independent Sets in Factor Graphs: A Unifying Perspective based on Smart Factors": https://www.cc.gatech.edu/~dellaert/pub/Carlone14icra.pdf
- Rosinol, Sattler, Pollefeys, and Carlone, "Incremental Visual-Inertial 3D Mesh Generation with Structural Regularities": https://arxiv.org/abs/1903.01067

### Datasets and Tools

- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- TUM Visual-Inertial Dataset: https://cvg.cit.tum.de/data/datasets/visual-inertial-dataset
- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- evo trajectory evaluation toolkit: https://github.com/MichaelGrupp/evo

### Internal Cross-Links

- [Mapping and Localization](../overview/mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [OpenVINS](openvins.md)
- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
- [DROID-SLAM](droid-slam.md)
- [DPVO](dpvo.md)
- [MASt3R-SLAM](mast3r-slam.md)
