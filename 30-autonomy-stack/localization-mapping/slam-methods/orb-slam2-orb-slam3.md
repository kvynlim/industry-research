# ORB-SLAM2 and ORB-SLAM3

## Executive Summary

ORB-SLAM2 and ORB-SLAM3 are the reference feature-based visual SLAM systems for many robotics research stacks. ORB-SLAM2 generalized the original monocular ORB-SLAM architecture to monocular, stereo, and RGB-D cameras with real-time tracking, local mapping, loop closing, relocalization, map reuse, and bundle-adjustment based optimization. ORB-SLAM3 extended the family to visual-inertial operation, fisheye models, and a multi-map "Atlas" representation that can start a new map after tracking loss and merge it later through place recognition.

For an autonomous vehicle or airside ground vehicle, the important point is not that ORB-SLAM is a production localization stack by itself. It is a strong visual SLAM baseline and a good source of design patterns: sparse feature tracking, keyframe management, covisibility graphs, loop closure, and map reuse. In a real airside deployment it should be treated as a visual odometry and visual relocalization component feeding the broader localization stack in [Mapping and Localization](../overview/mapping-and-localization.md) and [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md), not as the sole source of vehicle pose.

The practical recommendation is: use ORB-SLAM3, not ORB-SLAM2, for any new visual-SLAM experiment that needs IMU support, fisheye cameras, multi-session map reuse, or monocular metric scale. Use ORB-SLAM2 only when reproducing older baselines, using RGB-D/stereo-only pipelines with known compatibility, or comparing against classical feature-based SLAM. For airside AVs, prefer stereo-inertial ORB-SLAM3 as an experimental backup/localization signal and evaluate it against [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md) and [OpenVINS](openvins.md) before field use.

## Historical Context

The ORB-SLAM line emerged from the observation that earlier monocular SLAM systems either lacked robust place recognition and map reuse or were difficult to deploy outside controlled demonstrations. The original ORB-SLAM paper in 2015 showed that a fully feature-based monocular SLAM system could operate in real time indoors and outdoors by combining ORB features, keyframes, a covisibility graph, local bundle adjustment, and bag-of-words place recognition.

ORB-SLAM2 followed in 2016/2017 and became the widely cited open-source baseline because it added stereo and RGB-D support while preserving the same core architecture. Stereo and RGB-D observations give true metric scale, removing the arbitrary-scale limitation of pure monocular SLAM. ORB-SLAM2 also emphasized practical relocalization and localization-only modes, which made it useful for robotics experiments where a map is built once and reused later.

ORB-SLAM3 arrived in 2020/2021 as a broader visual and visual-inertial SLAM library. Its two major shifts were tightly integrated visual-inertial MAP estimation and multi-map operation. The multi-map Atlas was important because classical SLAM systems often fail catastrophically after long periods of poor visual information. ORB-SLAM3 can create a fresh active map after losing tracking and later merge maps when place recognition succeeds. That makes it conceptually closer to the operational reality discussed in [Mapping and Localization](../overview/mapping-and-localization.md): vehicles must survive temporary localization degradation and recover without operator intervention.

## Sensor Assumptions

ORB-SLAM2 supports monocular, stereo, and RGB-D cameras. ORB-SLAM3 supports monocular, stereo, RGB-D, monocular-inertial, and stereo-inertial operation, with pinhole and fisheye camera models. The assumptions differ by configuration:

- Monocular-only: scale is unobservable without additional priors. The system estimates trajectory and map up to an arbitrary scale, and scale drift can occur.
- Stereo or RGB-D: depth is directly available at initialization and during mapping, so the map has metric scale if calibration and depth are accurate.
- Visual-inertial: IMU measurements make scale, gravity direction, velocity, and IMU biases observable after sufficient excitation. Initialization quality matters.
- Feature visibility: scenes need enough repeatable ORB features. Painted tarmac with little texture, overexposed sky, motion blur, wet reflections, and large uniform walls reduce tracking quality.
- Calibration: camera intrinsics, distortion model, stereo extrinsics, camera-IMU extrinsics, and timestamp alignment must be accurate. Small calibration errors can produce large map deformation over long sequences.
- Static-world approximation: moving vehicles, aircraft, loaders, personnel, and jet blast shimmer should not dominate the feature tracks.

For airside vehicles, a forward-facing stereo or multi-camera fisheye rig plus a synchronized industrial IMU is more appropriate than monocular-only operation. Monocular ORB-SLAM3 is useful for research and fallback experiments, but metric navigation around aircraft, terminal structures, and stand markings should not depend on monocular scale observability alone.

## State/Map Representation

ORB-SLAM2 stores a sparse landmark map made of keyframes and 3D MapPoints:

- Keyframes store camera pose, ORB keypoints, ORB descriptors, calibration, and connectivity to other keyframes.
- MapPoints store 3D landmark position, representative descriptor, viewing direction, visibility statistics, and observations from keyframes.
- The covisibility graph connects keyframes that share map points. It supports local map selection and local bundle adjustment.
- The essential graph is a sparsified graph used for loop-closure correction and global consistency.
- The keyframe database uses a visual bag-of-words representation for relocalization and loop detection.

ORB-SLAM3 generalizes this into an Atlas:

- An Atlas contains multiple maps, only one of which is active for normal tracking at a time.
- If tracking is lost and relocalization fails, a new map can be created rather than stopping the system.
- Place recognition can trigger loop closure within a map or map merging across disconnected maps.
- In visual-inertial modes, keyframes also carry IMU preintegration constraints, velocity estimates, and IMU bias estimates.

For AV localization, the sparse ORB map is not an occupancy map, semantic map, or drivable-area representation. It is a geometric localization scaffold. It can help estimate ego-pose, but it does not directly encode taxiway topology, safety envelopes, stop bars, stand boundaries, or dynamic obstacles. Those belong in the broader mapping and planning layers.

## Algorithm Pipeline

ORB-SLAM2 and ORB-SLAM3 follow a multi-threaded architecture:

1. Tracking:
   - Extract ORB features from the incoming frame.
   - Predict the pose from motion model or IMU propagation.
   - Match features to the previous frame or local map.
   - Estimate camera pose by minimizing reprojection error.
   - Decide whether to insert a new keyframe.

2. Local mapping:
   - Insert new keyframes.
   - Triangulate new map points from keyframe observations.
   - Cull low-quality map points and redundant keyframes.
   - Run local bundle adjustment over the active keyframe neighborhood.

3. Loop closing and map merging:
   - Query the bag-of-words database for place candidates.
   - Estimate a Sim(3) or SE(3) transform depending on sensor mode and scale observability.
   - Fuse duplicated map points.
   - Optimize the essential graph and optionally run full bundle adjustment.

4. Relocalization:
   - If tracking fails, use visual place recognition to find candidate keyframes.
   - Match ORB features and solve a PnP/RANSAC pose estimate.
   - Resume tracking if enough inliers support the pose.

5. Visual-inertial extensions in ORB-SLAM3:
   - Integrate IMU readings between frames/keyframes.
   - Estimate scale, gravity, velocity, and IMU biases during initialization.
   - Add inertial residuals to the optimization.
   - Refine the visual-inertial map using MAP estimation.

## Formulation

The visual core is bundle adjustment over camera poses and 3D landmarks. For each observation of landmark `X_j` in keyframe `i`, the system minimizes a robust reprojection residual:

```text
r_ij = z_ij - project(T_ci_w * X_j)
min over poses, landmarks: sum rho(||r_ij||^2_Sigma)
```

where `z_ij` is the measured feature location, `T_ci_w` maps world points into the camera frame, `project(.)` applies camera intrinsics and distortion, `Sigma` reflects feature measurement uncertainty and image pyramid scale, and `rho` is a robust loss used to reduce outlier influence.

Stereo and RGB-D add depth or right-image constraints, allowing landmarks to be initialized at metric scale. Monocular initialization uses two-view geometry and then refines structure and motion, but scale remains arbitrary unless another metric source is present.

Loop closure adds a pose-graph style correction. In monocular operation this is generally a Sim(3) constraint because scale drift must be corrected. In stereo/RGB-D/inertial operation the transform is typically metric SE(3). The essential graph optimization distributes the loop correction across the trajectory while preserving local map consistency.

ORB-SLAM3 adds IMU preintegration residuals between keyframes:

```text
min sum visual_reprojection_residuals
  + sum inertial_preintegration_residuals
  + prior terms from marginalization/initialization
```

The state includes keyframe pose, velocity, accelerometer bias, gyroscope bias, map points, and calibration-dependent parameters. The key methodological distinction from filter-based VIO such as [OpenVINS](openvins.md) is that ORB-SLAM3 is optimization-centric and reuses older map information through keyframe selection, loop closure, and map merging.

## Failure Modes

Common failure modes are:

- Low texture: blank walls, open tarmac, sky, clean aircraft fuselage surfaces, and uniform apron pavement provide too few repeatable ORB features.
- Motion blur and rolling shutter: vibration, fast turns, rough pavement, and low exposure can corrupt feature localization.
- Illumination changes: headlights, apron floodlights, sunrise/sunset glare, wet pavement reflections, and camera auto-exposure can change descriptors and reduce matching.
- Dynamic-scene dominance: baggage carts, tow tractors, aircraft, passengers, and ground crew can generate strong but non-static features.
- Weak parallax: long straight driving with small baseline to observed features makes triangulation and scale refinement weak.
- Monocular degeneracy: pure rotation, low translation, and planar scenes can make initialization or scale estimation fragile.
- IMU initialization problems: visual-inertial modes need enough motion excitation to estimate scale, gravity, velocity, and biases.
- Calibration and timing errors: stereo baseline, camera-IMU extrinsics, and timestamp offsets are critical in stereo-inertial operation.
- Map staleness: sparse visual maps built in daylight may not match night, rain, construction, seasonal equipment layouts, or repainted markings.

Airside operations combine several of these: wide low-texture pavement, large moving metallic objects, harsh lighting transitions, reflective wet surfaces, and repeated-looking gates/stands.

## AV Relevance

ORB-SLAM remains relevant to autonomous vehicles in four ways:

1. Sparse visual odometry: it can provide a camera-based relative pose signal when GNSS is degraded and LiDAR matching is weak.
2. Visual relocalization: its bag-of-words keyframe database is a classical place-recognition mechanism for recovering from tracking loss.
3. Map reuse: prebuilt sparse maps can support localization-only operation in known areas.
4. Algorithmic baseline: it is a standard comparison point for newer visual, visual-inertial, and learned SLAM systems.

However, production AV localization typically requires more than ORB-SLAM. It needs continuous uncertainty estimates, strict fault detection, sensor health management, deterministic integration with IMU/GNSS/wheel/LiDAR, and certified fallback behaviors. ORB-SLAM output should therefore be fused as a measurement inside the state-estimation architecture described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md), rather than published directly as the vehicle's authoritative pose.

## Indoor/Outdoor Relevance

Indoor relevance is high when environments contain stable visual texture: corridors, offices, warehouses, baggage halls, parking structures, and terminal service areas. RGB-D or stereo helps in tight indoor areas where metric scale and near-field geometry matter.

Outdoor relevance is mixed. Urban streets provide signs, facades, poles, parked vehicles, lane markings, and rich features. Open aprons and runways do not. Outdoor lighting variation is also much harder than indoor lighting. ORB-SLAM3's visual-inertial and multi-map capabilities improve robustness, but they do not remove the need for good image texture and calibration.

Indoor/outdoor transitions are a natural use case for ORB-SLAM3 because IMU propagation can bridge short visual dropouts and the Atlas can recover from broken tracking. But at a deployment level, the transition should be handled by a multi-sensor fusion layer that knows whether GNSS, LiDAR, vision, wheel odometry, or prior maps are currently trustworthy.

## Airside Deployment Notes

For airport airside work:

- Prefer stereo-inertial or multi-camera-inertial operation. Monocular-only SLAM is not adequate as a primary localization source for safety-critical ground vehicles.
- Use global-shutter cameras with high dynamic range and fixed/controlled exposure where possible. Avoid relying on consumer auto-exposure behavior.
- Put cameras where aircraft, GSE, and personnel do not dominate every frame. Side-facing cameras can see terminal structure and stand equipment; forward-only cameras may see mostly pavement and sky.
- Treat ORB-SLAM map points as localization landmarks, not map truth. They should not define drivable area, stop lines, or operational boundaries.
- Integrate with RTK-GNSS, LiDAR scan-to-map, wheel odometry, and IMU through a factor graph or ESKF, consistent with [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).
- Monitor tracking quality: number of tracked map points, inlier ratio, relocalization events, IMU initialization state, loop-closure corrections, and map-merging corrections.
- Use airport-specific validation sequences: dawn, night, rain, apron floodlights, aircraft parked at stands, jet bridge shadows, terminal overhangs, and repeated gate geometry.
- Do not rely on visual loop closure near safety-critical boundaries without independent checks. A wrong relocalization or false loop closure can create a confident but wrong pose.

## Datasets/Metrics

Common datasets for ORB-SLAM2/3 evaluation:

- KITTI Odometry: outdoor driving stereo sequences; reports average translational and rotational errors over subsequences.
- TUM RGB-D: indoor RGB-D SLAM sequences with motion-capture ground truth; commonly evaluated with ATE and RPE.
- EuRoC MAV: synchronized stereo cameras and IMU on a micro aerial vehicle; standard for visual-inertial and stereo SLAM.
- TUM-VI: high-resolution fisheye stereo and IMU with room/handheld sequences; useful for visual-inertial and fisheye evaluation.
- TUM monoVO: useful for monocular VO/SLAM drift studies, though more strongly associated with direct methods.

Metrics:

- ATE/APE: absolute trajectory or pose error after alignment to ground truth.
- RPE: relative pose error over fixed intervals.
- KITTI drift: translational percent error and rotational error per meter over path segments.
- Tracking success rate: fraction of sequence completed without unrecovered tracking loss.
- Relocalization latency and correctness: important for operational recovery.
- Loop-closure correction magnitude: large corrections may indicate accumulated drift or false associations.
- Runtime, CPU/GPU load, and frame latency: needed for embedded AV use.

For airside evaluation, add operational metrics: maximum outage duration tolerated, pose covariance growth during GNSS denial, false relocalization rate in repeated stand geometry, and localization error near painted hold lines or stand stop positions.

## Open-Source Implementations

- ORB-SLAM2 official repository: GPLv3 C++ implementation for monocular, stereo, and RGB-D cameras. It is mature but older, with dependencies and build assumptions from the Ubuntu 14.04/16.04 era.
- ORB-SLAM3 official repository: GPLv3 C++ implementation for visual, visual-inertial, and multi-map SLAM with monocular, stereo, RGB-D, pinhole, and fisheye examples. It is the main reference implementation for new work.
- ROS wrappers: many community wrappers exist for ROS1 and ROS2, but their quality varies. Treat wrappers as integration code to audit, not as part of the core method.
- Commercial licensing: the official repositories are GPLv3; closed-source product integration requires licensing review or separate arrangements.

Implementation cautions:

- Reproduce paper datasets before using custom airside footage.
- Calibrate camera intrinsics/extrinsics and camera-IMU timing with tools such as Kalibr or equivalent.
- Disable or tightly control camera settings during data collection.
- Log raw images, IMU, timestamps, and calibration for every failure investigation.
- Keep ORB-SLAM's internal map frame separate from the vehicle's certified navigation frame until fused and validated.

## Practical Recommendation

For visual SLAM Part A, ORB-SLAM3 should be the primary feature-based SLAM baseline. It is more relevant than ORB-SLAM2 because it supports visual-inertial operation and multi-map recovery, both of which matter for GPS-degraded airside operation. ORB-SLAM2 remains useful as a historical baseline and for RGB-D/stereo comparisons.

For airside AV deployment, do not select ORB-SLAM3 as the primary localization architecture without LiDAR/GNSS/wheel/IMU fusion. Use it as:

- an experimental stereo-inertial visual odometry source,
- a visual relocalization baseline,
- a sparse visual map reuse study,
- a comparator against [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md), [OpenVINS](openvins.md), [SVO](svo.md), and [LSD-SLAM / DSO](lsd-slam-dso.md).

The most defensible deployment path is stereo-inertial ORB-SLAM3 feeding a robust multi-sensor estimator, with LiDAR scan-to-map or RTK-GNSS as the primary absolute anchor where available.

## Sources

### Primary Papers and Repositories

- Mur-Artal and Tardos, "ORB-SLAM2: an Open-Source SLAM System for Monocular, Stereo and RGB-D Cameras": https://arxiv.org/abs/1610.06475
- ORB-SLAM2 official repository: https://github.com/raulmur/ORB_SLAM2
- Campos, Elvira, Gomez, Montiel, and Tardos, "ORB-SLAM3: An Accurate Open-Source Library for Visual, Visual-Inertial and Multi-Map SLAM": https://arxiv.org/abs/2007.11898
- ORB-SLAM3 official repository: https://github.com/UZ-SLAMLab/ORB_SLAM3
- Original ORB-SLAM paper, "ORB-SLAM: a Versatile and Accurate Monocular SLAM System": https://arxiv.org/abs/1502.00956

### Datasets and Benchmarks

- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- TUM RGB-D SLAM Dataset and Benchmark: https://cvg.cit.tum.de/data/datasets/rgbd-dataset
- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- TUM Visual-Inertial Dataset: https://cvg.cit.tum.de/data/datasets/visual-inertial-dataset
- TUM Monocular Visual Odometry Dataset: https://cvg.cit.tum.de/data/datasets/mono-dataset

### Internal Cross-Links

- [Mapping and Localization](../overview/mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [LSD-SLAM and DSO](lsd-slam-dso.md)
- [SVO](svo.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [OpenVINS](openvins.md)
