# SLAM Decision Matrix for AV, Indoor, and Outdoor Systems

This file is a practical selection matrix for choosing SLAM, odometry, and localization methods by operating domain. It is intentionally biased toward deployability: sensor availability, timing, map product, failure detection, license, and maintenance matter as much as benchmark error.

## Repo Cross-Links

| Related area | Link | Use in this decision matrix |
|---|---|---|
| LiDAR front-end details | [LiDAR SLAM Algorithms](../lidar-slam-algorithms.md) | Method-level evidence for [KISS-ICP](kiss-icp.md), [LIO-SAM](lio-sam.md), [FAST-LIO2](fast-lio-fast-lio2.md), Faster-LIO-style voxel LIO, [CT-ICP](ct-icp.md), and [Point-LIO](point-lio.md). |
| Runtime map localization | [Production LiDAR Map Localization](../production-lidar-map-localization.md) | Use when a validated map exists and online SLAM should not be the global truth source. |
| Loop closure and recovery | [LiDAR Place Recognition and Re-Localization](../lidar-place-recognition-relocalization.md) | Required when the matrix recommends loop closure, multi-session mapping, or kidnapped-robot recovery. |
| Survey-to-map workflow | [Map Construction Pipeline](../map-construction-pipeline.md) | Use when choosing a stack for airport onboarding, map merging, or QA. |
| Multi-sensor fusion | [Robust State Estimation Multi-Sensor](../robust-state-estimation-multi-sensor.md) | Use when the decision depends on RTK, IMU, wheel, covariance, and fallback behavior. |
| Factor graph backend | [GTSAM Factor Graphs](../../../foundations/gtsam-factor-graphs.md) | Use when a method needs IMU preintegration, scan-matching factors, loop closure, GCP factors, or smoothing. |
| Dense/neural mapping | [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md) | Use for future dense maps, inspection, simulation, and semantic QA rather than primary safety pose. |

## Fast Selection Table

| Operating context | Primary recommendation | Secondary baseline | Recovery/loop closure | Do not choose as primary | Reasoning |
|---|---|---|---|---|---|
| Airport airside AV, mapped ODD | Scan-to-map VGICP/NDT + GTSAM fusion | [KISS-ICP](kiss-icp.md) odometry for independent fallback | Scan Context/MinkLoc3D + ICP/NDT verification | Pure online SLAM as runtime global truth | The environment is mapped, safety-critical, and georeferenced; bounded drift beats live map growth. |
| Airport survey mapping | [FAST-LIO2](fast-lio-fast-lio2.md) or GLIM + loop closure + GCP factors | [KISS-ICP](kiss-icp.md) or [CT-ICP](ct-icp.md) validation run | [LIO-SAM](lio-sam.md) style graph or KISS-SLAM | Visual-only SLAM | Survey needs geometric accuracy, map consistency, and independent checks against IMU/extrinsic mistakes. |
| Urban road AV, mapped ODD | HD-map localization with LiDAR/radar/GNSS/INS fusion | Autoware NDT or MOLA localization | Place recognition and map-change detection | Monocular SLAM-only | Road AV localization is a map-matching and state-estimation problem, not just local SLAM. |
| Warehouse AGV, flat floor | SLAM Toolbox or [Cartographer](cartographer-3d.md) 2D | 3D LiDAR odometry if racks/ramps matter | AMCL-style global localization, reflectors/AprilTags | Heavy 3D LIO unless needed | 2D maps are sufficient, cheap, explainable, and easy to integrate with Nav2. |
| Multi-floor indoor or construction | 3D LiDAR-inertial SLAM | RTAB-Map if RGB-D/cameras are strong | Multi-session loop closure | 2D grid-only SLAM | Stairs, ramps, shafts, and partial floors break planar assumptions. |
| Outdoor campus/service robot | KISS-SLAM, [LIO-SAM](lio-sam.md), or GLIM | [KISS-ICP](kiss-icp.md) local odometry | Long-term place recognition | One-session map with no maintenance plan | Campus changes seasonally and structurally; long-term relocalization matters. |
| UAV or fast handheld scanner | [Point-LIO](point-lio.md), [FAST-LIO2](fast-lio-fast-lio2.md), or [OpenVINS](openvins.md) depending payload | [VINS-Fusion](vins-mono-vins-fusion.md) visual-inertial baseline | Visual or LiDAR place recognition | Slow scan-to-scan ICP with no motion model | Aggressive motion and vibration require IMU-aware deskew and high-rate state output. |
| RGB-D indoor reconstruction | RTAB-Map, NICE-SLAM, SplaTAM | [ORB-SLAM3](orb-slam2-orb-slam3.md) RGB-D mode | DBoW/visual loop closure | Long-range outdoor LiDAR stacks | Dense geometry and appearance matter more than long-range AV robustness. |

## Score Legend

| Score | Meaning | Deployment interpretation |
|---|---|---|
| 5 | Strong default | Start here unless a hard constraint blocks it. |
| 4 | Good | Viable with standard engineering and validation. |
| 3 | Conditional | Works when assumptions match; needs careful testing. |
| 2 | Research or fallback | Useful as baseline, diagnostic, or constrained deployment. |
| 1 | Poor fit | Usually wrong for this domain. |

## Domain-Method Matrix

| Method family | Airside AV runtime | Airside survey mapping | Road AV | Indoor warehouse | Multi-floor indoor | Outdoor campus | UAV/handheld | Main reason |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Prebuilt-map LiDAR localization | 5 | 3 | 5 | 4 | 3 | 4 | 2 | Best when a validated map exists; not a map builder. |
| LiDAR-only odometry | 3 | 4 | 3 | 3 | 3 | 4 | 3 | Simple and independent, but drift is unbounded. |
| LiDAR-inertial odometry | 4 | 5 | 4 | 3 | 5 | 5 | 5 | Best real-time geometric front-end when timing is good. |
| Factor-graph LiDAR SLAM | 3 | 5 | 3 | 3 | 5 | 5 | 4 | Adds loop closures, GPS/GCP factors, and multi-session consistency. |
| 2D LiDAR graph SLAM | 1 | 1 | 1 | 5 | 2 | 2 | 1 | Excellent planar indoor fit; wrong abstraction for 3D AV geometry. |
| Visual SLAM | 2 | 2 | 2 | 3 | 3 | 3 | 4 | Useful with rich texture and cameras; fragile in glare, darkness, weather. |
| Visual-inertial odometry | 2 | 2 | 3 | 3 | 4 | 3 | 5 | Strong for drones/handheld; less robust than LiDAR in airside geometry. |
| RGB-D dense SLAM | 1 | 1 | 1 | 4 | 3 | 1 | 2 | Range-limited indoor mapping, not outdoor AV localization. |
| Radar odometry/SLAM | 3 | 2 | 4 | 1 | 1 | 3 | 1 | Weather-robust outdoor auxiliary; not yet a complete general replacement. |
| Gaussian/neural SLAM | 1 | 2 | 1 | 3 | 3 | 2 | 2 | Strong for dense maps and QA; immature for certified pose and uncertainty. |

## Airside AV Detailed Matrix

| Requirement | Weight | Scan-to-map VGICP/NDT | [FAST-LIO2](fast-lio-fast-lio2.md) | [LIO-SAM](lio-sam.md) | [KISS-ICP](kiss-icp.md) | [ORB-SLAM3](orb-slam2-orb-slam3.md) | Gaussian SLAM |
|---|---:|---:|---:|---:|---:|---:|---:|
| Bounded global drift in mapped airport | 5 | 5 | 2 | 3 | 2 | 1 | 1 |
| Robustness to night/glare/weather | 5 | 5 | 5 | 5 | 5 | 2 | 2 |
| Open apron degeneracy handling | 5 | 4 | 3 | 4 | 3 | 1 | 1 |
| Multi-LiDAR compatibility | 4 | 5 | 3 | 3 | 5 | 1 | 2 |
| Certifiable diagnostics | 4 | 4 | 3 | 4 | 4 | 3 | 1 |
| Map update discipline | 4 | 5 | 2 | 3 | 2 | 2 | 2 |
| RTK/GCP integration | 4 | 5 | 3 | 5 | 2 | 2 | 1 |
| Real-time Orin feasibility | 4 | 4 | 5 | 4 | 5 | 3 | 2 |
| License/deployment risk | 3 | 4 | 2 | 5 | 5 | 2 | 2 |
| Recommendation | - | Runtime primary | Survey/front-end | Survey/global graph | Fallback/validation | Auxiliary only | QA/research |

## Indoor Decision Matrix

| Indoor condition | Recommended stack | Why | Add-ons | Watch-outs |
|---|---|---|---|---|
| Flat warehouse, differential or Ackermann robot | SLAM Toolbox + Nav2 + wheel odometry | Occupancy grid and 2D pose graph are simple and adequate. | AMCL, reflectors/AprilTags, map zones | Racks and pallets create aliasing; update maps deliberately. |
| Warehouse with tall racks, mezzanine, ramps | 3D LiDAR-inertial SLAM or [Cartographer](cartographer-3d.md) 3D | 2D maps lose vertical structure and can confuse floors. | Floor segmentation, elevator/stair constraints | Repeated aisles require strong relocalization verification. |
| Construction site or underground | GLIM, [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md) | Low light, dust, and non-planarity favor LiDAR plus IMU. | Multi-session mapping, robust kernels, dynamic filtering | Sensor protection and sync are often bigger risks than algorithm choice. |
| Office/RGB-D mapping | RTAB-Map or RGB-D visual SLAM | Dense colored maps and object context are useful. | Loop closure, TSDF/surfel export | Sunlight and glass degrade depth cameras. |
| AR/headset room-scale tracking | [OpenVINS](openvins.md), [ORB-SLAM3](orb-slam2-orb-slam3.md), visual-inertial stack | Cameras and IMU are the native sensors. | Relocalization maps, anchors | Monocular scale and initialization need strong handling. |

## Outdoor Decision Matrix

| Outdoor condition | Recommended stack | Why | Add-ons | Watch-outs |
|---|---|---|---|---|
| Mapped road or airport ODD | Scan-to-map localization + state estimator | Existing map should bound drift. | GNSS/INS, wheel odometry, map-change detection | Map staleness and dynamic-object residuals. |
| Unmapped survey drive | [FAST-LIO2](fast-lio-fast-lio2.md) or GLIM + loop closures | Builds accurate geometry quickly. | [KISS-ICP](kiss-icp.md) validation, GCP/RTK factors | Direct LIO map may still drift without loops/anchors. |
| Long-term campus route | KISS-SLAM, [LIO-SAM](lio-sam.md), GLIM | Needs revisits, loops, and changing-season robustness. | NCLT/Oxford RobotCar style validation | Vegetation, snow, construction, and traffic change the map. |
| Tunnel/urban canyon | LiDAR-inertial plus wheel/vehicle kinematics | GNSS weak; geometry and IMU dominate. | Radar, map priors, loop closures | Tunnels can be longitudinally degenerate and repetitive. |
| Rain/snow/fog test vehicle | LiDAR/radar/GNSS fusion | Radar and GNSS reduce dependence on degraded LiDAR/camera. | Boreas/Oxford long-term benchmark | No single sensor is enough across all weather. |

## Sensor Availability Matrix

| Sensors available | Good method families | Candidate pages | Minimum extra checks |
|---|---|---|---|
| 2D LiDAR + wheel | 2D graph SLAM, AMCL/localization | SLAM Toolbox, [Cartographer](cartographer-3d.md) | Wheel scale, laser extrinsic, scan rate, planar assumption |
| 3D LiDAR only | LiDAR odometry/SLAM | [KISS-ICP](kiss-icp.md), KISS-SLAM, [CT-ICP](ct-icp.md) | Degeneracy, loop closures, deskew model |
| 3D LiDAR + IMU | LIO | [FAST-LIO2](fast-lio-fast-lio2.md), Faster-LIO family, [Point-LIO](point-lio.md), [LIO-SAM](lio-sam.md) | Time sync, IMU noise model, extrinsics, saturation |
| Multi-LiDAR + IMU + wheels | Production AV localization/fusion | [Production LiDAR Map Localization](../production-lidar-map-localization.md), [Robust State Estimation Multi-Sensor](../robust-state-estimation-multi-sensor.md) | Per-sensor extrinsics, covariance, hot-path memory, fault isolation |
| Stereo/RGB-D + IMU | VIO/RGB-D SLAM | [ORB-SLAM3](orb-slam2-orb-slam3.md), [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md), RTAB-Map | Exposure/blur, camera-IMU calibration, feature count |
| Radar + LiDAR/IMU | All-weather localization research | Radar odometry, radar place recognition, LiDAR-radar fusion | Radar calibration, multipath, Doppler models |

## Compute and Integration Matrix

| Constraint | Prefer | Avoid | Notes |
|---|---|---|---|
| NVIDIA Orin with CUDA available | GPU VGICP, GLIM, gtsam_points factors | CPU-only algorithms that cannot meet multi-LiDAR throughput | CUDA improves scan matching, but certification still needs bounded timing and fallbacks. |
| Raspberry Pi / low-power CPU | [KISS-ICP](kiss-icp.md), 2D SLAM, light VIO | Heavy neural/Gaussian SLAM | Keep map bounded and downsample aggressively. |
| ROS 2 production stack | Autoware localization, SLAM Toolbox, MOLA, GLIM ROS 2 | ROS 1-only research stacks unless wrapped | ROS version is often a schedule driver. |
| GPL avoidance for closed deployment | MIT/BSD/Apache stacks, in-house scan matcher | GPL-2/GPL-3 libraries as linked product code | Verify legal interpretation before product integration. |
| Need factor-level fusion | GTSAM-based pipelines | Black-box pose output only | Factor graphs expose residuals, covariance, robust kernels, and graph diagnostics. |
| Need explainable safety case | Classical scan matching + explicit diagnostics | Neural-only pose estimation | Explainable residuals are easier to gate and audit. |

## Decision Tree

| Question | If yes | If no |
|---|---|---|
| Is there a validated, current map of the operating area? | Use scan-to-map localization as the runtime primary and SLAM only for map maintenance/fallback. | Use SLAM/odometry to build an initial map, then convert to localization mode. |
| Is the vehicle safety-critical in a bounded ODD? | Require covariance, fault detection, relocalization, and map version control. | A research SLAM stack may be acceptable for prototyping. |
| Is the environment mostly planar and indoor? | Evaluate 2D SLAM first. | Use 3D LiDAR/LIO or visual-inertial depending sensors. |
| Does the system experience aggressive motion, vibration, or spinning LiDAR distortion? | Use IMU-aware or continuous-time methods. | A simple LiDAR-only ICP baseline may be enough. |
| Are repeated structures a core hazard? | Add place-recognition verification, zone priors, and robust loop closure gates. | Simpler loop closure may be acceptable. |
| Is the map product part of an HD-map pipeline? | Select methods that export trajectories, submaps, graph constraints, and QA metrics. | A black-box pose stream can still be useful for navigation demos. |

## Recommended Shortlists

| Goal | Shortlist | Why this set |
|---|---|---|
| Airside map survey proof-of-concept | [FAST-LIO2](fast-lio-fast-lio2.md), [KISS-ICP](kiss-icp.md), [LIO-SAM](lio-sam.md), GTSAM GCP factors | Tests LIO accuracy, LiDAR-only independence, and graph correction. |
| Airside production localization prototype | GPU VGICP/NDT, Autoware NDT diagnostics, GTSAM/iSAM2, Scan Context recovery | Matches the production split: map localization, state estimation, recovery. |
| Indoor warehouse product | SLAM Toolbox, AMCL/Nav2, reflectors/AprilTags, optional RTAB-Map | Fastest route to a reliable 2D navigation product. |
| Construction/underground mapping | GLIM, [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md), Hilti benchmark | Handles 3D geometry, dark spaces, platform diversity, multi-session mapping. |
| Camera-first robotics research | [ORB-SLAM3](orb-slam2-orb-slam3.md), [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md), EuRoC/TUM-VI | Strong visual/VIO baselines and standard datasets. |
| Dense map/semantic QA research | RTAB-Map, SplaTAM, NICE-SLAM, [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md) | Focuses on reconstruction quality and appearance, not just pose. |

## Sources

- KITTI odometry benchmark official evaluation page: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- TUM RGB-D benchmark tools and ATE/RPE definitions: https://cvg.cit.tum.de/data/datasets/rgbd-dataset/tools
- OpenVINS evaluation metrics documentation: https://docs.openvins.com/eval-metrics.html
- PRBonn KISS-ICP official repo: https://github.com/PRBonn/kiss-icp
- PRBonn KISS-SLAM official repo: https://github.com/PRBonn/kiss-slam
- TixiaoShan LIO-SAM official repo: https://github.com/TixiaoShan/LIO-SAM
- HKU-MARS FAST-LIO/FAST-LIO2 official repo: https://github.com/hku-mars/FAST_LIO
- gaoxiang12 Faster-LIO official repo: https://github.com/gaoxiang12/faster-lio
- HKU-MARS Point-LIO official repo: https://github.com/hku-mars/Point-LIO
- CT-ICP official repo: https://github.com/jedeschaud/ct_icp
- GLIM official repo and documentation: https://github.com/koide3/glim and https://koide3.github.io/glim/
- Google Cartographer official docs: https://google-cartographer.readthedocs.io/
- SLAM Toolbox official ROS docs and repo: https://docs.ros.org/en/jazzy/p/slam_toolbox/ and https://github.com/SteveMacenski/slam_toolbox
- RTAB-Map official project page: https://introlab.github.io/rtabmap/
- ORB-SLAM3 paper and repo: https://arxiv.org/abs/2007.11898 and https://github.com/UZ-SLAMLab/ORB_SLAM3
- OpenVINS official documentation: https://docs.openvins.com/
- VINS-Fusion official repo: https://github.com/HKUST-Aerial-Robotics/VINS-Fusion
- Autoware NDT scan matcher official documentation: https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- MOLA localization official documentation: https://docs.mola-slam.org/latest/localization.html
