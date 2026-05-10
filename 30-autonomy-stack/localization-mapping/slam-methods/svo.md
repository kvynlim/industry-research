# SVO

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "fallback", "gnss-denied", "indoor", "validation"]
  reason: "SVO is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use."
method-priority:end -->

## Executive Summary

SVO, or Semi-Direct Visual Odometry, is a lightweight visual odometry family from the Robotics and Perception Group at the University of Zurich. It sits between direct methods such as [LSD-SLAM / DSO](lsd-slam-dso.md) and feature-based systems such as [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md). The key idea is to use direct image alignment for fast frame-to-frame pose estimation while using sparse feature geometry and probabilistic depth estimation for mapping.

The original SVO was designed for fast monocular visual odometry on resource-constrained aerial robots. Later SVO 2.0 and SVO Pro broadened the system to monocular, stereo, wide-angle, fisheye/catadioptric, multi-camera, and visual-inertial configurations. Modern open SVO Pro includes visual odometry, visual-inertial odometry, and visual-inertial SLAM components with sliding-window optimization and loop-closure/global-map capabilities.

For autonomous vehicle work, SVO is best understood as a fast visual front-end and odometry engine, not as a complete production localization architecture by itself. It is valuable where low latency matters and where a sparse direct approach can track with fewer expensive descriptor operations. For airside ground vehicles, SVO is potentially useful as an auxiliary VO/VIO source in camera-rich areas, but it must be fused with RTK-GNSS, LiDAR scan matching, IMU, and wheel odometry through the estimator described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).

## Historical Context

The original SVO paper, "SVO: Fast Semi-Direct Monocular Visual Odometry," appeared at ICRA 2014. It targeted small aerial robots where compute, power, and latency were major constraints. At that time, many visual odometry systems relied heavily on feature extraction, descriptor matching, and bundle adjustment. SVO showed that a semi-direct design could achieve high frame rates by aligning image patches directly while maintaining a sparse feature map for geometry.

The later TRO paper, often referred to as SVO 2.0, expanded the method to monocular and multi-camera systems, including wide-angle cameras. This was important for robotics because drones and small robots often use fisheye or wide-FOV cameras rather than narrow pinhole cameras.

SVO Pro is the more recent research/industrial version released in open form by UZH RPG. It integrates several extensions developed over years of research projects: support for multiple camera models, stereo, active exposure control, visual-inertial odometry, sliding-window optimization, global bundle adjustment, and loop closure. As a result, the name "SVO" can refer to a narrow 2014 monocular VO algorithm or to a broader modern SVO Pro stack. This writeup uses "SVO" for the method family and calls out SVO Pro where system-level functionality matters.

## Sensor Assumptions

SVO variants can support:

- Monocular cameras.
- Stereo cameras.
- Multi-camera rigs.
- Pinhole, fisheye, and catadioptric/wide-angle models in later systems.
- Camera plus IMU in visual-inertial variants.

Core assumptions:

- Camera intrinsics and distortion are accurately calibrated.
- For stereo/multi-camera, rig extrinsics are stable and calibrated.
- For visual-inertial operation, camera-IMU extrinsics and time synchronization are accurate.
- The scene contains enough corners or high-gradient patches for sparse alignment.
- Motion between frames is small enough for direct alignment to converge or can be predicted well by a motion model/IMU.
- The scene is mostly static.
- Exposure and illumination changes are not so severe that patch alignment fails.

Compared with DSO, SVO is less purely photometric because it uses feature-level geometry and sparse patches. Compared with ORB-SLAM, it is more direct and front-end focused. For airside vehicles, the strongest configurations are stereo or multi-camera plus IMU, ideally with global-shutter cameras and controlled exposure.

## State/Map Representation

Original monocular SVO represents:

- Frame poses.
- Keyframes.
- Sparse 3D map points.
- Image patches associated with map points.
- Probabilistic depth estimates for newly observed features.

The map is sparse. It is used for tracking and local odometry, not for semantic navigation. New features are initialized with depth filters and refined as observations accumulate. Keyframes provide reference views for direct image alignment and geometric triangulation.

SVO's state can be viewed in two layers:

- Front-end state: current frame pose relative to the local sparse map, tracked patches/features, and candidate landmarks.
- Back-end state: keyframe poses, landmark depths/positions, and in modern versions visual-inertial states such as velocity and IMU biases.

SVO Pro broadens this representation:

- Visual odometry mode: sparse local map and camera poses.
- Visual-inertial odometry mode: SVO front-end plus a sliding-window visual-inertial optimization backend.
- Visual-inertial SLAM mode: globally optimized map using loop closure and global bundle adjustment.

For AV use, the SVO map should be considered a local visual landmark map. It does not replace the operational maps described in [Mapping and Localization](../overview/mapping-and-localization.md).

## Algorithm Pipeline

A typical SVO pipeline:

1. Image preprocessing:
   - Undistort or use the calibrated camera model.
   - Build image pyramids.
   - Optionally control or account for exposure.

2. Sparse image alignment:
   - Estimate the current camera pose by directly aligning projected map patches from a reference/keyframe view to the current image.
   - Use a coarse-to-fine pyramid to handle moderate motion.
   - This step gives a fast initial pose without descriptor matching every frame.

3. Feature alignment and pose refinement:
   - Search for feature correspondences, often along epipolar lines when depth is uncertain.
   - Refine patch positions by local image alignment.
   - Use reprojection constraints to improve pose.

4. Mapping:
   - Detect new features in keyframes.
   - Initialize depth filters for new candidate points.
   - Update depth estimates as new frames observe the features.
   - Promote reliable candidates to map points.

5. Keyframe management:
   - Insert keyframes when motion, scene change, or tracking quality warrants it.
   - Maintain a bounded local map for real-time operation.

6. Optional VIO/SLAM extensions:
   - Preintegrate IMU measurements between frames/keyframes.
   - Optimize a sliding window over visual and inertial residuals.
   - Add loop closure and global bundle adjustment in SVO Pro SLAM configurations.

## Formulation

SVO uses a semi-direct objective. The first stage estimates pose by minimizing photometric patch residuals:

```text
r_p = I_current(project(T_current_ref * X_p)) - I_ref(p)
min over T_current_ref: sum rho(r_p^2)
```

where `X_p` is the 3D map point corresponding to a reference pixel/patch, and `T_current_ref` is the relative pose. The optimization is usually coarse-to-fine and benefits from a good initial pose.

Mapping and refinement use geometric constraints. A simplified reprojection residual is:

```text
r_ij = z_ij - project(T_i_w * X_j)
```

Depth filters estimate landmark inverse depth from multiple observations. For a monocular camera, a new feature starts with uncertain depth; as parallax accumulates, the depth distribution narrows. This is one of the main differences from stereo methods, where initial depth can be triangulated immediately from the baseline.

In visual-inertial variants, the optimization includes IMU residuals:

```text
min sum photometric/visual residuals
  + sum inertial preintegration residuals
  + marginalization priors
```

The exact back-end differs by SVO version. SVO Pro's visual-inertial backend is a sliding-window optimization architecture, conceptually closer to [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md) than to the original 2014 monocular-only SVO front-end.

## Failure Modes

SVO failure modes:

- Low texture or weak corners: sparse patch tracking needs enough usable image structure.
- Large frame-to-frame motion: direct alignment can fail if the initial pose is poor or if motion exceeds pyramid convergence basin.
- Motion blur and vibration: patch alignment and feature localization degrade quickly.
- Exposure changes: direct patch alignment assumes comparable appearance, though later SVO Pro includes active exposure support.
- Repeated texture: patches can align to wrong but similar local patterns.
- Dynamic objects: moving GSE, people, vehicles, and aircraft can corrupt local map points.
- Low parallax: monocular depth filters converge slowly or incorrectly.
- Pure rotation: monocular depth cannot improve without translation.
- Calibration errors: wide-angle and multi-camera systems require accurate camera models.
- IMU issues in VIO mode: poor time sync, bad noise parameters, weak excitation, or bias jumps degrade estimates.
- Lack of global correction in pure VO mode: drift accumulates unless SLAM/loop closure/global measurements are added.

For airport scenes, open tarmac and repeated gate equipment can be difficult. SVO is better in terminal-adjacent service roads, baggage halls, underpasses, and routes with stable structural texture.

## AV Relevance

SVO's AV relevance is mainly low-latency visual odometry:

- It is computationally attractive for embedded platforms.
- It can exploit sparse direct alignment without the full cost of descriptor matching on every frame.
- Multi-camera and fisheye support can use wide vehicle camera coverage.
- Visual-inertial versions can bridge short visual degradation and produce metric estimates.

Limitations for AV production:

- Pure VO drift is unbounded.
- A sparse visual map is not an operational safety map.
- Direct/semi-direct tracking still depends on lighting and texture.
- Outlier handling, dynamic-object masking, uncertainty calibration, and fault detection need production engineering.
- Licensing and version choice matter: original SVO and SVO Pro have different capabilities and dependencies.

For ground vehicles, SVO should be evaluated as an auxiliary source next to ORB-SLAM3, VINS-Fusion, and OpenVINS. It is not a substitute for the full localization stack described in [Mapping and Localization](../overview/mapping-and-localization.md).

## Indoor/Outdoor Relevance

Indoor:

- Good fit for warehouses, baggage halls, terminal corridors, maintenance areas, and indoor/outdoor transition zones with textured walls or equipment.
- Wide-angle camera support helps in confined areas.
- Controlled lighting improves reliability.

Outdoor:

- Works better in textured urban environments than in featureless open areas.
- Airside aprons are challenging due to low texture, strong shadows, reflections, and dynamic equipment.
- Terminal facades, signs, painted markings, and vertical structures improve performance.

SVO's strongest airport niche is probably not open runway/taxiway localization. It is more relevant for routes near buildings, baggage halls, service roads, and complex ground-service areas where camera texture is rich and GNSS may be degraded by multipath or roof structures.

## Airside Deployment Notes

Deployment guidance:

- Prefer stereo or multi-camera SVO Pro plus IMU for operational experiments.
- Use global-shutter HDR cameras and fixed/controlled exposure.
- Mount cameras to see stable structure: terminal walls, signage, cargo buildings, service-road edges, and equipment racks.
- Avoid using cameras that mostly see open pavement and sky as the primary SVO input.
- Use dynamic-object masking or robust outlier rejection around active stands.
- Feed SVO/VIO poses into a central estimator with covariance and innovation gating.
- Validate the system under rain, night lighting, wet tarmac, engine heat shimmer, and shadow transitions.
- Track health metrics: number of tracked patches, alignment residuals, keyframe insertion rate, depth-filter convergence, IMU residuals, and relocalization/loop events if using SVO Pro SLAM.

For airside certification or safety arguments, SVO is easier to justify as a supplemental odometry signal than as an independent safety-critical localization source.

## Datasets/Metrics

Datasets:

- EuRoC MAV: common for visual-inertial and stereo evaluation.
- TUM-VI: useful for fisheye/stereo-inertial evaluation.
- KITTI Odometry: useful for automotive-style outdoor motion, though SVO is historically MAV-oriented.
- TUM monoVO: useful for monocular VO drift and photometric behavior.
- UZH FPV and drone racing datasets: relevant to high-speed visual-inertial tracking, though less ground-vehicle-specific.
- Custom airside datasets are essential because public datasets do not capture apron lighting, aircraft, or airport markings.

Metrics:

- ATE/APE and RPE.
- Drift percentage over distance.
- Tracking success rate.
- Frame processing latency and maximum sustainable FPS.
- Initialization time.
- Depth convergence time for monocular points.
- Failure/recovery count.
- VIO consistency metrics if IMU is used: innovation residuals, bias estimates, scale stability, gravity alignment.

Airside-specific metrics should include drift through GNSS-denied terminal overhangs, tracking loss rate on open apron routes, performance in nighttime floodlights, and false constraints from moving aircraft/GSE.

## Open-Source Implementations

- `uzh-rpg/rpg_svo`: original open-source SVO implementation for semi-direct visual odometry.
- `uzh-rpg/rpg_svo_pro_open`: open SVO Pro repository with modern SVO front-end, multiple camera models, visual odometry, visual-inertial odometry, and visual-inertial SLAM capabilities.
- RPG project pages and papers: primary reference for SVO and SVO 2.0.

Implementation cautions:

- The original SVO and SVO Pro have different assumptions, build systems, and capabilities.
- Many old examples target ROS1 and older Ubuntu versions.
- Wide-angle camera models need careful calibration and validation.
- Visual-inertial mode requires IMU noise parameters, extrinsics, and time offset calibration.
- GPLv3 licensing in open repositories must be reviewed for product use.

## Practical Recommendation

For visual SLAM Part A, include SVO as the semi-direct baseline:

- It is more lightweight and front-end oriented than ORB-SLAM.
- It is less purely photometric than DSO.
- It is historically important for fast onboard robotics visual odometry.
- SVO Pro is relevant to modern multi-camera and visual-inertial experiments.

For airside AVs, test SVO Pro only as an auxiliary odometry/VIO component, preferably with stereo or multi-camera plus IMU. Do not use original monocular SVO as a primary localization system. In the method library, position SVO between [LSD-SLAM / DSO](lsd-slam-dso.md) and [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md): fast and practical, but requiring robust fusion and operational safeguards before deployment.

## Sources

### Primary Papers and Project Pages

- Forster, Pizzoli, and Scaramuzza, "SVO: Fast Semi-Direct Monocular Visual Odometry": https://ieeexplore.ieee.org/document/6906584
- SVO 2.0 project page: https://rpg.ifi.uzh.ch/svo2.html
- Forster et al., "SVO: Semi-Direct Visual Odometry for Monocular and Multi-Camera Systems": https://rpg.ifi.uzh.ch/docs/TRO16_Forster-SVO.pdf
- Original SVO repository: https://github.com/uzh-rpg/rpg_svo
- SVO Pro open repository: https://github.com/uzh-rpg/rpg_svo_pro_open

### Datasets and Benchmarks

- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- TUM Visual-Inertial Dataset: https://cvg.cit.tum.de/data/datasets/visual-inertial-dataset
- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- TUM Monocular Visual Odometry Dataset: https://cvg.cit.tum.de/data/datasets/mono-dataset

### Internal Cross-Links

- [Mapping and Localization](../overview/mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
- [LSD-SLAM and DSO](lsd-slam-dso.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [OpenVINS](openvins.md)
