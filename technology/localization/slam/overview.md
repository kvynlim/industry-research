# SLAM Method Library Overview

This directory is the method-level SLAM library. It should help a reader answer four questions before opening any individual method page:

1. What role does SLAM play relative to odometry, map construction, and production localization?
2. Which method family should be evaluated for a given AV, indoor, or outdoor environment?
3. Which benchmark and metric suite gives a fair result?
4. Which open-source stack is a reasonable starting point, and which is only a research reference?

For airside autonomous vehicles, the practical answer is not "run SLAM online forever." The production stack should separate offline map construction, online scan-to-map localization, high-rate state estimation, and loop-closure/relocalization. SLAM remains critical for survey mapping, map maintenance, fallback odometry, validation against map-localization failures, and research into future dense or neural map representations.

## Repo Cross-Links

| Topic | Read next | Why it matters for this library |
|---|---|---|
| Modern LiDAR odometry and SLAM front ends | [LiDAR SLAM Algorithms](../lidar-slam-algorithms.md) | Detailed treatment of [KISS-ICP](kiss-icp.md), [LIO-SAM](lio-sam.md), [FAST-LIO2](fast-lio-fast-lio2.md), Faster-LIO-style voxel LIO, [CT-ICP](ct-icp.md), and [Point-LIO](point-lio.md). |
| Production scan-to-map localization | [Production LiDAR Map Localization](../production-lidar-map-localization.md) | Explains why production AV localization should usually match live scans to a prebuilt map instead of relying only on online SLAM. |
| Loop closure and kidnapped-robot recovery | [LiDAR Place Recognition and Re-Localization](../lidar-place-recognition-relocalization.md) | SLAM without robust place recognition becomes odometry with drift; this doc covers descriptor and verification pipelines. |
| Offline survey processing | [Map Construction Pipeline](../map-construction-pipeline.md) | Shows where SLAM outputs become fleet-deployable HD maps, geodetic alignment, QA artifacts, and OTA packages. |
| Ego-state fusion and uncertainty | [Robust State Estimation Multi-Sensor](../robust-state-estimation-multi-sensor.md) | SLAM factors must land in an estimator with sane gating, covariance, fallback, and sensor-fault behavior. |
| Factor graph foundations | [GTSAM Factor Graphs](../../../foundations/gtsam-factor-graphs.md) | The common backend language for LIO-SAM, map optimization, loop closure, IMU preintegration, and production smoothing. |
| Dense/neural scene representations | [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md) | Useful for future dense mapping, semantic map QA, and simulation; not yet the primary safety-critical pose source. |
| Coverage audit and backlog | [SLAM Coverage Audit and Backlog](coverage-audit-2026.md) | Tracks missing first-class method pages found by parallel web-search agents so the library does not silently omit major techniques. |

## Scope Boundaries

| Term | Primary output | Updates a map? | Drift behavior | Production role | Typical methods |
|---|---:|---:|---|---|---|
| Odometry | Relative pose stream | Local map only | Unbounded without correction | Fallback, prediction, survey front-end | [KISS-ICP](kiss-icp.md), [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md), [CT-ICP](ct-icp.md) |
| SLAM | Trajectory plus map | Yes | Bounded by loop closures and global constraints | Survey mapping, map repair, exploratory operation | [LIO-SAM](lio-sam.md), KISS-SLAM, [Cartographer](cartographer-3d.md), RTAB-Map, [GLIM](glim.md) |
| Localization | Pose in an existing map | No, except quality overlays | Bounded by map quality and scan matching | Normal AV runtime | Autoware NDT, VGICP, MOLA localization, GTSAM scan-to-map factors |
| Relocalization | Global pose hypothesis | No | Recovers after losing track | Startup and fault recovery | Scan Context, MinkLoc3D, LCDNet, ICP/NDT verification |
| Mapping pipeline | Validated HD map package | Offline | Optimized globally | Airport onboarding and maintenance | Multi-session SLAM, GCP alignment, AMDB/Lanelet2 overlays |

## Canonical SLAM Pipeline

| Stage | Main job | Common choices | Outputs to preserve | Failure signal |
|---|---|---|---|---|
| Time sync and calibration | Make sensors geometrically and temporally coherent | PTP/hardware sync, Kalibr, targetless LiDAR-camera calibration, extrinsic graph | Timestamp residuals, extrinsic covariance, sensor health | Rolling-shutter/deskew artifacts, inconsistent IMU gravity, scan "swimming" |
| Motion compensation | Remove intra-scan motion distortion | Constant-velocity deskew, IMU preintegration, continuous-time trajectory | Deskewed cloud plus deskew model used | Sharp poles become curved; ICP residual depends on azimuth |
| Front-end association | Create frame-to-frame or frame-to-map constraints | Point-to-point ICP, point-to-plane ICP, GICP/VGICP, NDT, visual reprojection, photometric residuals | Residuals, inlier masks, degeneracy eigenvalues | Low inlier ratio, anisotropic information matrix, poor convergence |
| Local mapping | Maintain bounded map for matching | Voxel hash, ikd-tree, iVox, submaps, surfels, occupancy grids | Keyframes/submaps, map timestamps, dynamic-object masks | Memory growth, stale dynamic objects, repeated walls/stands |
| Loop closure | Detect revisits and add constraints | Scan Context, M2DP, DBoW2/3, NetVLAD, MinkLoc3D, geometric verification | Candidate score, verified transform, covariance | Perceptual aliasing, false positive loop, topology tear |
| Back-end optimization | Solve global state consistency | GTSAM/iSAM2, g2o, Ceres, pose graph, factor graph, bundle adjustment | Full graph, marginalized priors, robust kernels | Graph jumps, bad loop factor dominates, overconfident covariance |
| Map export and QA | Convert research map to operational artifact | Dense point cloud, voxel map, occupancy grid, Lanelet2, Gaussian/mesh overlays | Map version, georeference transform, QA report | Double walls, map-frame drift, unbounded map entropy |

## Method Taxonomy

| Family | Sensors | Core residual | Backend | Strengths | Weaknesses | Best fit |
|---|---|---|---|---|---|---|
| 2D LiDAR grid SLAM | 2D LiDAR, wheel odom, optional IMU | Scan correlation or point-to-line | Pose graph, occupancy grid | Simple, explainable, works well in planar indoor spaces | Cannot model ramps, multi-level structures, overhangs, aircraft geometry | Indoor mobile robots, AGVs, warehouses |
| 3D LiDAR odometry | 3D LiDAR | ICP/GICP/NDT | Local map, optional pose graph | Lighting independent, robust outdoors, simple failure metrics | Degenerate in open flat areas and repeated geometry; drift without loops | Survey validation, fallback odometry, outdoor robots |
| LiDAR-inertial odometry | 3D LiDAR plus IMU | Point-to-plane or direct point residual with IMU propagation | IEKF, factor graph, smoother | Best real-time geometry-based odometry for fast motion and vibration | Requires tight sync and good IMU calibration; can double-count IMU if fused again naively | AV survey mapping, UAVs, handheld mapping, rough ground |
| Visual SLAM | Mono/stereo/RGB-D camera | Reprojection or photometric residual | Bundle adjustment, pose graph | Cheap sensors, rich semantics, mature sparse mapping | Lighting, weather, texture, motion blur, scale for monocular | Indoor AR, inspection, visual QA |
| Visual-inertial odometry | Camera plus IMU | Reprojection plus IMU preintegration/MSCKF | EKF, sliding window, factor graph | High rate, scale observable with IMU, compact maps | Initialization and calibration sensitive; degraded by low texture | Drones, handheld, camera-rich indoor robots |
| RGB-D dense SLAM | RGB-D camera | ICP plus photometric/depth residual | Pose graph, TSDF/surfels | Dense indoor maps, object-level QA | Range limited, sunlight interference, not AV-range | Indoor mapping, manipulation, labs |
| Radar SLAM | FMCW radar, optional IMU | Correlation, learned descriptors, Doppler constraints | Pose graph/factor graph | Weather and dust robust; long-range structure | Lower angular resolution; clutter and multipath | All-weather outdoor localization research |
| Neural/Gaussian SLAM | RGB-D, RGB, LiDAR-camera | Rendering loss, depth loss, learned features | Differentiable optimization plus pose graph | Dense appearance maps, semantic rendering, simulation reuse | Compute-heavy, immature uncertainty, hard certification | Offline QA, simulation assets, inspection overlays |

## Practical Selection Guidance

| Environment | First-choice family | Good candidate pages | Add-ons that make it production-ready | Avoid as primary source when |
|---|---|---|---|---|
| Airside AV apron, known map | LiDAR-to-map localization plus state estimation | [Production LiDAR Map Localization](../production-lidar-map-localization.md), [KISS-ICP](kiss-icp.md), [LIO-SAM](lio-sam.md) | RTK/GCP anchored maps, GTSAM scan-to-map factors, place recognition, degeneracy gating | Treating online SLAM as the only global reference; open tarmac is geometrically weak |
| Road AV in mapped ODD | Prebuilt HD map localization plus LiDAR/radar/camera odometry | [FAST-LIO2](fast-lio-fast-lio2.md), [GLIM](glim.md), [Autoware NDT](ndt.md) | GNSS/INS fusion, dynamic object removal, map versioning, online map-change detection | Using indoor RGB-D or monocular-only SLAM for safety-critical pose |
| Indoor warehouse, planar floors | 2D LiDAR SLAM or 3D LiDAR-inertial if tall racks matter | SLAM Toolbox, [Cartographer](cartographer-3d.md), RTAB-Map | Wheel odometry, reflector/AprilTag anchors, floor-zone maps, periodic relocalization | Forklifts or racks create persistent dynamic clutter without filtering |
| Underground/construction | 3D LiDAR-inertial with multi-session SLAM | [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md), [GLIM](glim.md), [CT-ICP](ct-icp.md) | Loop closure, cross-session map merging, robust kernels, lidar intensity if geometry repeats | Pure visual tracking in dust/dark or pure GNSS outdoors/indoors mixed |
| Outdoor campus/service robot | LiDAR-inertial plus place recognition | [KISS-ICP](kiss-icp.md), KISS-SLAM, [LIO-SAM](lio-sam.md), MOLA | Long-term dataset validation, seasonal map maintenance, semantic/dynamic filtering | Assuming one sunny-day map covers all seasons and construction changes |
| UAV/handheld inspection | Visual-inertial or LiDAR-inertial depending payload | [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md), [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md) | Rolling-shutter handling, aggressive-motion IMU validation, loop closure | Low-grade IMU plus unsynchronized camera/LiDAR under fast motion |

## Airside SLAM Architecture Recommendation

| Layer | Recommended role | Candidate implementation | Why |
|---|---|---|---|
| Survey odometry | Generate per-session trajectories and submaps | [FAST-LIO2](fast-lio-fast-lio2.md) or [GLIM](glim.md) as primary; [KISS-ICP](kiss-icp.md) as independent check | LIO gives robust deskewing and fast motion handling; LiDAR-only validation catches IMU/calibration-specific failures. |
| Loop closure | Correct drift across long apron loops and repeated passes | [LIO-SAM](lio-sam.md) loop module, KISS-SLAM, Scan Context from place-recognition library | Required to prevent multi-kilometer survey maps from accumulating meter-scale drift. |
| Global optimization | Fuse odometry, loop closure, GCP, RTK, and prior map constraints | GTSAM/iSAM2, see [GTSAM Factor Graphs](../../../foundations/gtsam-factor-graphs.md) | The same factor-graph representation can be reused by map construction and runtime localization. |
| Production runtime pose | Match live LiDAR to the validated HD map | GPU VGICP/NDT plus [Production LiDAR Map Localization](../production-lidar-map-localization.md) | Bounded drift and calibrated uncertainty are more important than online map growth during normal operation. |
| Recovery | Reinitialize after startup, tow, GPS loss, or bad scan matching | [LiDAR Place Recognition and Re-Localization](../lidar-place-recognition-relocalization.md) plus ICP/NDT verification | Avoids blindly trusting a local optimizer when the initial pose is wrong. |
| Dense/semantic QA | Inspect map quality and create simulation/visualization artifacts | [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md) | Valuable for map QA and digital twins; not yet mature enough as the certified pose backbone. |

## Decision Rules

| Rule | Practical test | Reason |
|---|---|---|
| Prefer localization over online SLAM when a validated map exists | Can the vehicle load a current map tile with known georeference and uncertainty? | Runtime map growth creates certification and fleet-consistency problems; localization against a validated map is easier to monitor. |
| Treat LiDAR-only odometry as a drift source, not a global truth source | Disable loop closures and run a 1-3 km loop; measure closure error | Even excellent odometry drifts; loop closure or external anchors are required for maps. |
| Add IMU only if timing and extrinsics are under control | Compare deskewed pole/edge sharpness and IMU residual statistics | Bad sync makes LIO worse than LiDAR-only ICP because errors become systematic. |
| Publish covariance that reflects degeneracy | Inspect Hessian eigenvalues, innovation gates, and scan-matching score distributions | Overconfident bad factors corrupt GTSAM more severely than missing factors. |
| Benchmark on target-like negatives | Include open aprons, repeated gates, wet tarmac, aircraft changes, night, rain, and GPS multipath | Public datasets rarely include airport-specific perceptual aliasing and dynamic aircraft/GSE clutter. |
| Keep method evaluation separate from product stack selection | Evaluate accuracy, then license, ROS version, maintenance, and compute | A top leaderboard method can still be unusable because of GPL obligations, missing ROS 2 support, or fragile calibration assumptions. |

## Failure Modes and Mitigations

| Failure mode | Common in | Symptom | Detection | Mitigation |
|---|---|---|---|---|
| Planar/open-space degeneracy | Aprons, parking lots, long corridors | Pose update is confident along observable axes but unconstrained laterally/yaw | Small Hessian eigenvalues, high condition number, low vertical/edge diversity | Inflate covariance, fuse GNSS/wheel/IMU, require landmarks or map priors |
| Dynamic-object contamination | Airports, roads, warehouses | Map contains ghost aircraft, trucks, pallets, pedestrians | Repeated observations disagree by time/session; semantic dynamic masks | Dynamic filtering, temporal occupancy, multi-session consensus |
| Perceptual aliasing | Similar gates, warehouse aisles, tunnels | False loop closure or wrong relocalization | Descriptor top-K ambiguity, failed geometric verification | Use geometry verification, semantic priors, map-zone constraints, robust loop kernels |
| Time-sync error | LIO, VIO, multi-LiDAR rigs | Curved poles, residual depends on scan angle, IMU bias grows | Deskew residual by azimuth, calibration replay, timestamp diagnostics | Hardware sync/PTP, online temporal calibration, reject suspect sensors |
| Extrinsic drift or mounting flex | Multi-LiDAR AVs, handheld rigs | Per-sensor clouds disagree after motion | Cross-sensor residuals, loop-consistency by sensor | Rigid mounting, periodic targetless calibration, per-sensor health factors |
| Poor visual texture or lighting | Indoor/off-road/airside night glare | Visual tracker loses features or scale | Track count, reprojection error, exposure/blur metrics | Prefer LiDAR/radar, active illumination, inertial propagation, visual only as auxiliary |
| Map staleness | Long-term AV deployments | Good odometry but poor map matching in changed zones | Local residual clusters, change detection, fleet disagreement | Map-change workflow, dynamic layers, AIRAC/survey updates |

## Method Pages This Library Should Contain

| Page | Method class | Primary question it should answer |
|---|---|---|
| [KISS-ICP](kiss-icp.md) | LiDAR-only odometry | How far can a simple point-to-point ICP pipeline go, and when is it the right baseline? |
| KISS-SLAM | LiDAR-only SLAM | When is a lightweight LiDAR-only SLAM system enough for survey mapping? |
| [LIO-SAM](lio-sam.md) | Factor-graph LiDAR-inertial SLAM | How should LiDAR, IMU, GPS, and loop factors be structured in GTSAM? |
| [FAST-LIO2](fast-lio-fast-lio2.md) | Direct LiDAR-inertial odometry | When is a tightly coupled IEKF front-end the best real-time mapper? |
| Faster-LIO family | iVox LiDAR-inertial odometry | What are the speed/accuracy trade-offs of incremental voxels versus trees? |
| [Point-LIO](point-lio.md) | High-bandwidth point-wise LIO | When do aggressive motion and high-rate control justify point-level updates? |
| [CT-ICP](ct-icp.md) | Continuous-time LiDAR odometry | How should a method model intra-scan motion without relying on IMU? |
| [Cartographer](cartographer-3d.md) | Submap and branch-and-bound SLAM | Why is it still relevant for 2D/3D submap SLAM and loop closure? |
| RTAB-Map | RGB-D/visual/LiDAR graph SLAM | When is a mature multi-sensor robotics stack more useful than a leaderboard method? |
| [ORB-SLAM3](orb-slam2-orb-slam3.md) | Visual and visual-inertial SLAM | What is the strongest sparse feature baseline for cameras? |
| [OpenVINS](openvins.md) | Filter-based VIO | When is MSCKF-style VIO preferable to full bundle adjustment? |
| [GLIM](glim.md) | Range-inertial factor-graph mapping | How do GPU scan-matching factors, GTSAM, and manual map correction fit together? |
| [Autoware NDT](ndt.md) | Production scan-to-map localization | What can the AV open-source ecosystem teach about diagnostics and integration? |

## Key Takeaways

| Takeaway | Practical meaning |
|---|---|
| SLAM is a mapping and correction system, not a substitute for a production localization architecture. | Use it to build and maintain maps; use scan-to-map localization for normal mapped operation. |
| The front-end is environment-dependent; the backend pattern is reusable. | ICP/NDT/visual residuals differ, but factor graphs, robust kernels, covariance, and loop closures recur. |
| Public benchmark wins do not imply airside readiness. | Airports need repeated-stand negatives, dynamic aircraft/GSE changes, wet tarmac, night lighting, and geodetic map QA. |
| The safest baseline is hybrid. | LiDAR-inertial for survey, LiDAR-only validation, GTSAM global optimization, place recognition for loop/recovery, and production VGICP/NDT for runtime localization. |
| Neural/Gaussian SLAM is a map-representation opportunity, not yet the pose backbone. | Use it for dense QA, semantic overlays, and simulation until uncertainty and failure monitoring mature. |

## Sources

- Vizzo et al., "KISS-ICP: In Defense of Point-to-Point ICP - Simple, Accurate, and Robust Registration If Done the Right Way", IEEE RA-L 2023, and official repo: https://github.com/PRBonn/kiss-icp
- Guadagnino et al., "KISS-SLAM: A Simple, Robust, and Accurate 3D LiDAR SLAM System With Enhanced Generalization Capabilities", arXiv 2025, and official repo: https://github.com/PRBonn/kiss-slam
- Shan et al., "LIO-SAM: Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping", IROS 2020, and official repo: https://github.com/TixiaoShan/LIO-SAM
- Xu et al., "FAST-LIO2: Fast Direct LiDAR-inertial Odometry", IEEE T-RO 2022, and official repo: https://github.com/hku-mars/FAST_LIO
- Bai et al., "Faster-LIO: Lightweight Tightly Coupled Lidar-Inertial Odometry Using Parallel Sparse Incremental Voxels", IEEE RA-L 2022, and official repo: https://github.com/gaoxiang12/faster-lio
- He et al., "Point-LIO: Robust High-Bandwidth Lidar-Inertial Odometry", and official repo: https://github.com/hku-mars/Point-LIO
- Deschaud, "CT-ICP: Real-time Elastic LiDAR Odometry with Loop Closure", ICRA 2022, and official repo: https://github.com/jedeschaud/ct_icp
- Google Cartographer official documentation: https://google-cartographer.readthedocs.io/
- RTAB-Map official project: https://introlab.github.io/rtabmap/
- Campos et al., "ORB-SLAM3: An Accurate Open-Source Library for Visual, Visual-Inertial and Multi-Map SLAM", IEEE T-RO 2021, and official repo: https://github.com/UZ-SLAMLab/ORB_SLAM3
- Geneva et al., "OpenVINS: A Research Platform for Visual-Inertial Estimation", ICRA 2020, and official docs: https://docs.openvins.com/
- Koide et al., "GLIM: 3D Range-Inertial Localization and Mapping with GPU-Accelerated Scan Matching Factors", Robotics and Autonomous Systems 2024, and official repo: https://github.com/koide3/glim
- GTSAM official docs and repo: https://gtsam.org/docs/ and https://github.com/borglab/gtsam
- Autoware NDT scan matcher official documentation: https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- SplaTAM and Gaussian SLAM references: https://arxiv.org/abs/2312.02126 and https://github.com/google-research/Splat-SLAM
