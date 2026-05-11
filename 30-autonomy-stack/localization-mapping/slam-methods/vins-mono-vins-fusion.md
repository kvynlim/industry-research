# VINS-Mono and VINS-Fusion

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "fallback", "gnss-denied"]
  reason: "Widely used visual-inertial baseline for GNSS-denied motion estimation."
method-priority:end -->

## Executive Summary

VINS-Mono and VINS-Fusion are optimization-based visual-inertial state estimation systems from HKUST's Aerial Robotics Group. VINS-Mono is the classic monocular camera plus IMU estimator: it performs robust initialization, tightly coupled nonlinear optimization over visual features and IMU preintegration, relocalization, and 4-DoF pose-graph optimization. VINS-Fusion extends the family to multiple sensor configurations, including mono + IMU, stereo + IMU, stereo-only, and global sensor fusion such as GPS through a pose-graph framework.

For autonomous vehicles, the VINS family is more operationally relevant than pure visual SLAM or VO because it estimates metric 6-DoF motion using low-cost cameras and IMUs. It is a strong candidate for GPS-denied local odometry, indoor/outdoor transitions, and short-term localization continuity. It still should not be the sole pose source for airside deployment: camera/IMU VIO must be fused with RTK-GNSS, LiDAR scan-to-map, wheel odometry, and safety monitors as described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).

The practical recommendation is to use VINS-Fusion rather than VINS-Mono for new airside experiments, because stereo-inertial and global-fusion modes are more relevant to vehicles than monocular-only VIO. Use VINS-Mono as the baseline for understanding the algorithm and for monocular-inertial comparisons against [OpenVINS](openvins.md) and [ORB-SLAM3](orb-slam2-orb-slam3.md).

## Historical Context

Visual-inertial odometry became important because monocular visual SLAM alone lacks metric scale and fails during visually weak motion, while low-cost IMUs drift quickly if integrated alone. VIO combines the complementary strengths: cameras bound drift through visual geometry, and IMUs provide high-rate motion information, gravity direction, short-term propagation, and scale observability after excitation.

VINS-Mono, published as a journal paper in IEEE Transactions on Robotics, became one of the most widely used open-source optimization-based VIO systems. Its practical contributions were not only the estimator formulation but the whole system: robust initialization, failure recovery, online extrinsic calibration, relocalization, loop detection, and pose-graph optimization. It was deployed on MAVs and mobile devices, which demonstrated real-time practicality.

VINS-Fusion followed as a more general multi-sensor state estimator. It preserved the optimization-based local VIO core while supporting stereo and global sensor fusion. The associated global pose-estimation framework from Qin, Cao, Pan, and Shen formulates local odometry and global sensors such as GPS in a pose graph so that local accuracy and global drift correction can coexist.

In the method-level taxonomy, VINS sits between full sparse SLAM systems such as ORB-SLAM3 and filter-based VIO systems such as OpenVINS. It is a sliding-window nonlinear optimizer with marginalization, not an MSCKF-style EKF.

## Sensor Assumptions

VINS-Mono:

- Monocular camera.
- Synchronized IMU.
- Calibrated camera intrinsics.
- Camera-IMU extrinsics either known or estimated/refined.
- Sufficient motion excitation for initialization.

VINS-Fusion:

- Mono + IMU.
- Stereo + IMU.
- Stereo-only visual odometry.
- Optional GPS/global position fusion through a global pose graph.
- Multiple camera configurations depending on build and configuration.

General assumptions:

- Accurate timestamps and low camera-IMU time offset.
- IMU noise parameters reasonably matched to the hardware.
- Global-shutter cameras are preferred for vehicle motion.
- Visual features are trackable across frames.
- The scene is mostly static.
- Motion includes enough acceleration/rotation/translation to make scale, gravity, velocity, and biases observable.

For airside vehicles, stereo + IMU is preferred over mono + IMU. GPS fusion is useful, but airport GNSS has multipath near terminals and aircraft, so GPS measurements must still pass quality checks and innovation gates in the central estimator.

## State/Map Representation

VINS-Mono local estimator state includes a sliding window of keyframe states:

- Pose: position and orientation.
- Velocity.
- Gyroscope bias.
- Accelerometer bias.
- Camera-IMU extrinsic parameters if estimated.
- Feature depths or inverse depths for tracked landmarks.
- Marginalization prior from states/features removed from the window.

The local map is a sparse feature structure observed by the active sliding window. It is not a dense map or semantic map.

The system also maintains:

- IMU preintegrations between frames/keyframes.
- A feature manager for tracked visual features.
- A relocalization and loop-detection database.
- A pose graph for global consistency.

VINS-Mono's global pose graph is commonly described as 4-DoF because gravity makes roll and pitch observable locally, while loop closure mainly optimizes position and yaw. VINS-Fusion adds global sensor factors, for example GPS, and estimates the transform between local VIO coordinates and global coordinates through graph optimization.

## Algorithm Pipeline

VINS-Mono pipeline:

1. Sensor preprocessing:
   - Receive image frames and high-rate IMU measurements.
   - Track visual features across frames, commonly with KLT-style tracking.
   - Preintegrate IMU measurements between image timestamps.

2. Initialization:
   - Recover visual structure and camera motion up to scale.
   - Align visual-only structure with inertial measurements.
   - Estimate scale, gravity, velocity, and IMU biases.
   - Initialize camera-IMU extrinsics if needed.

3. Sliding-window optimization:
   - Optimize poses, velocities, biases, extrinsics, and feature depths.
   - Use visual reprojection residuals and IMU preintegration residuals.
   - Apply marginalization to keep the window bounded.

4. Failure detection and recovery:
   - Detect bad tracking or estimator inconsistency.
   - Reinitialize when needed.

5. Relocalization and loop closure:
   - Detect loop candidates using visual place recognition.
   - Add constraints to a pose graph.
   - Optimize global consistency with low computational overhead.

VINS-Fusion pipeline adds:

1. Stereo constraints when stereo cameras are available.
2. Stereo-only mode when no IMU is used.
3. Global fusion module that aligns local VIO/VO estimates with GPS or other global sensors in a pose graph.
4. Output of both local odometry and globally corrected trajectory.

## Formulation

The local estimator is a nonlinear least-squares problem over a fixed-lag sliding window:

```text
min_X {
  ||r_prior||^2
  + sum IMU factors ||r_imu(z_imu, X_i, X_j)||^2
  + sum visual factors rho(||r_cam(z_uv, X_i, feature_l)||^2)
}
```

where `X_i` includes pose, velocity, and IMU biases at time/keyframe `i`. IMU preintegration compresses many high-rate IMU measurements between two frames into one factor. Visual residuals are reprojection errors of tracked features.

For a visual observation:

```text
r_cam = z_ij - project(T_cam_imu * T_imu_world_i * X_feature_j)
```

For IMU preintegration, the residual constrains relative rotation, velocity, and position between consecutive states, while accounting for bias linearization and covariance.

Marginalization keeps the optimization real time:

- Old states or features are removed.
- Their information is converted into a prior on the remaining states.
- This prior must be handled carefully because incorrect marginalization or linearization can make the estimator inconsistent.

For fixed-lag symptoms caused by stale linearization, gauge handling, rank, or marginalization priors, use the [Sparse Estimation Backend Crosswalk](../../../10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md).

Global fusion in VINS-Fusion can be expressed as pose-graph optimization:

```text
min over global poses and local-to-global transform:
  sum local_odometry_relative_pose_factors
  + sum global_position_sensor_factors
  + optional loop/relocalization factors
```

This allows precise local VIO to be corrected by drift-free but noisier global sensors such as GPS.

## Failure Modes

VINS failure modes:

- Poor initialization due to insufficient acceleration, insufficient parallax, or bad visual-only structure.
- Bad camera-IMU time synchronization.
- Wrong camera-IMU extrinsics or changing mechanical calibration.
- IMU saturation, vibration, or incorrect noise parameters.
- Low visual texture, motion blur, overexposure, rain, glare, or nighttime noise.
- Dynamic visual features from moving vehicles, aircraft, personnel, and baggage equipment.
- Rolling shutter distortion.
- Degenerate motion: long straight constant-velocity motion with weak lateral/parallax excitation can weaken observability.
- Feature loss during rapid turns or occlusion.
- Incorrect loop closure or relocalization in repeated-looking structures.
- GPS fusion corruption if multipath or false RTK fixes are accepted as valid global factors.

Airside operations have several VINS-specific risks: long smooth driving with little excitation, high vibration on rough pavement, multipath near aircraft/terminals, and repeated gate/stand visual patterns that can confuse loop closure.

## AV Relevance

VINS is highly relevant to AVs because it provides:

- Metric local odometry in GNSS-degraded areas.
- High-rate propagation through IMU integration.
- Drift reduction through visual feature constraints.
- Recovery and loop closure through visual place recognition.
- Optional global fusion in VINS-Fusion.

For airside ground vehicles, VINS can cover gaps where GNSS is blocked under terminal fingers, near aircraft, inside baggage halls, or around service tunnels. It can also provide smooth short-term motion between lower-rate LiDAR or GNSS updates.

Limitations:

- Visual-inertial odometry still drifts without global correction.
- It can become overconfident if calibration, timing, or noise assumptions are wrong.
- It is not a semantic or occupancy mapper.
- Failure detection must be tied into the vehicle's operational state machine.
- Open-source research code is not certification-ready.

The right AV architecture is VINS-Fusion or similar VIO feeding a central estimator, with LiDAR/GNSS/wheel constraints and health monitoring.

## Indoor/Outdoor Relevance

Indoor:

- Strong relevance in GPS-denied interiors, baggage halls, tunnels, maintenance areas, and terminal service corridors.
- Visual-inertial fusion handles short feature dropouts better than visual-only SLAM.
- Stereo helps with near-field scale and low-excitation starts.

Outdoor:

- Useful in urban/service-road scenes with visual texture.
- On open aprons, visual constraints can weaken because of low texture and long feature distances.
- GPS fusion helps outdoors but must be robust to multipath.

Indoor/outdoor transitions are a core use case. VINS can carry metric local motion through the transition while GNSS availability changes. The central estimator should manage the frame relationship between local VIO, airport map, and global GNSS coordinates.

## Airside Deployment Notes

Deployment guidance:

- Prefer VINS-Fusion stereo-inertial mode for vehicle experiments.
- Use industrial global-shutter cameras with stable mounting and hardware synchronization.
- Calibrate camera intrinsics, stereo extrinsics, camera-IMU extrinsics, and time offset with repeatable procedures.
- Use IMUs with known noise density and bias stability; tune noise parameters from data.
- Integrate VINS output as a factor or measurement, not as the authoritative pose.
- Add innovation gates before accepting GPS/global factors in VINS-Fusion.
- Disable or constrain loop closure in repeated gate/stand layouts until false-positive rates are measured.
- Use wheel odometry to improve ground-vehicle observability, but fuse it in the central estimator rather than modifying VINS blindly.
- Log feature counts, IMU residuals, bias estimates, initialization state, marginalization warnings, loop closures, and GPS factor residuals.
- Test long straight taxiway/apron routes, terminal overhangs, baggage halls, night/rain sequences, and aircraft-occlusion scenarios.

For an airside fleet, VINS is most valuable as the vision/IMU bridge between absolute updates from RTK-GNSS and LiDAR map matching.

## Datasets/Metrics

Common datasets:

- EuRoC MAV: standard VIO benchmark with stereo cameras and IMU.
- TUM-VI: high-resolution fisheye stereo-inertial dataset.
- KITTI Odometry and raw KITTI: vehicle motion; useful for stereo/visual odometry and outdoor evaluation, though not a perfect VIO benchmark.
- KAIST Urban / KAIST VIO: urban vehicle-like multi-sensor sequences, often used by OpenVINS and VIO researchers.
- Custom vehicle and airport datasets are required for final airside assessment.

Metrics:

- ATE/APE after SE(3), Sim(3), or yaw/gravity-aligned evaluation depending on sensor mode.
- RPE over distance/time.
- Drift per meter or per minute.
- Initialization success rate and initialization time.
- Scale error for monocular-inertial runs.
- Bias convergence and stability.
- Loop-closure precision/recall and false-positive rate.
- GPS/global fusion residuals and global drift.
- Real-time latency and CPU load.

Airside-specific metrics should include pose error during GNSS outages, recovery after exiting terminal overhangs, drift over repeated baggage routes, and false relocalization near visually similar stands.

## Open-Source Implementations

- VINS-Mono official repository: ROS/C++ implementation of monocular visual-inertial state estimation with loop closure/relocalization.
- VINS-Fusion official repository: optimization-based multi-sensor state estimator supporting mono + IMU, stereo + IMU, stereo-only, and GPS/global fusion examples.
- VINS-Mobile / iOS demonstrations: useful historically for showing deployability, but less relevant to vehicle integration.

Implementation cautions:

- The original repositories are research code and may require dependency/version work on modern ROS distributions.
- Camera-IMU calibration quality dominates results.
- Dataset success does not imply robust field performance.
- GPS fusion should not bypass the vehicle's main fault-detection logic.
- License and third-party dependencies must be reviewed before commercial deployment.

## Practical Recommendation

For the method-level library:

- Treat VINS-Mono as the canonical optimization-based monocular VIO baseline.
- Treat VINS-Fusion as the practical extension for vehicle experiments, especially stereo-inertial and GPS-aided runs.
- Compare against [OpenVINS](openvins.md) to understand optimization-based versus MSCKF/filter-based tradeoffs.
- Compare against [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md) for map reuse and loop-closure behavior.
- Compare against [SVO](svo.md) and [LSD-SLAM / DSO](lsd-slam-dso.md) for visual front-end design.

For airside AVs, choose VINS-Fusion stereo-inertial as the first visual-inertial experiment. Fuse its local pose into the central estimator and use RTK-GNSS, LiDAR scan-to-map, and wheel odometry as independent constraints. Do not rely on VINS loop closure or GPS fusion without airport-specific false-positive and multipath validation.

## Sources

### Primary Papers and Repositories

- Qin, Li, and Shen, "VINS-Mono: A Robust and Versatile Monocular Visual-Inertial State Estimator": https://arxiv.org/abs/1708.03852
- VINS-Mono official repository: https://github.com/HKUST-Aerial-Robotics/VINS-Mono
- VINS-Fusion official repository: https://github.com/HKUST-Aerial-Robotics/VINS-Fusion
- Qin, Cao, Pan, and Shen, "A General Optimization-based Framework for Global Pose Estimation with Multiple Sensors": https://arxiv.org/abs/1901.03642
- Forster et al., "IMU Preintegration on Manifold for Efficient Visual-Inertial Maximum-a-Posteriori Estimation": https://arxiv.org/abs/1512.02363

### Datasets and Benchmarks

- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- TUM Visual-Inertial Dataset: https://cvg.cit.tum.de/data/datasets/visual-inertial-dataset
- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- OpenVINS supported datasets list, including EuRoC, TUM-VI, KAIST, and UZH-FPV: https://docs.openvins.com/gs-datasets.html

### Internal Cross-Links

- [Mapping and Localization](../overview/mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
- [LSD-SLAM and DSO](lsd-slam-dso.md)
- [SVO](svo.md)
- [OpenVINS](openvins.md)
