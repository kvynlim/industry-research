# Open-Source SLAM Stack Comparison

This comparison is for engineering selection, not leaderboard admiration. A SLAM stack is useful when its sensor assumptions, license, ROS support, diagnostics, map outputs, runtime behavior, and maintenance model match the deployment. For airside AVs, the likely production architecture is a hybrid: offline LiDAR-inertial SLAM and factor-graph map optimization for survey, validated scan-to-map localization for runtime, and place-recognition recovery for startup and faults.

## Repo Cross-Links

| Related area | Link | Why it matters |
|---|---|---|
| LiDAR algorithm detail | [LiDAR SLAM Algorithms](../overview/lidar-slam-algorithms.md) | Deeper comparison of [KISS-ICP](kiss-icp.md), [LIO-SAM](lio-sam.md), [FAST-LIO2](fast-lio-fast-lio2.md), Faster-LIO-style voxel LIO, [CT-ICP](ct-icp.md), and [Point-LIO](point-lio.md). |
| Runtime localization | [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md) | The open-source stack should plug into or inform scan-to-map localization, not replace safety architecture blindly. |
| Place recognition | [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md) | Most stacks need external loop/relocalization strengthening for production. |
| Map construction | [Map Construction Pipeline](../maps/map-construction-pipeline.md) | Stack output must be compatible with survey processing, GCP alignment, map QA, and OTA deployment. |
| State estimation | [Robust State Estimation Multi-Sensor](../overview/robust-state-estimation-multi-sensor.md) | Pose output quality is not enough; covariance, gating, dropout, and sensor health matter. |
| Backend math | [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) | Essential for understanding LIO-SAM, GLIM, map optimization, and production factor insertion. |
| Gaussian/neural maps | [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Good future-facing map/QA representation, but not yet a primary certified pose stack. |
| Coverage audit | [SLAM Coverage Audit and Backlog](coverage-audit-2026.md) | Tracks missing stack pages such as MOLA, KISS-SLAM, FAST-LIVO/R3LIVE, LOCUS/LAMP, DLIO/DLIOM, and cuVSLAM. |

## Comparison Criteria

| Criterion | What to check | Red flag |
|---|---|---|
| Sensor assumptions | LiDAR type, camera model, IMU grade, wheel/GNSS support, time sync | Demo works only on one sensor bag with hard-coded fields |
| Map representation | Voxel map, submaps, occupancy grid, sparse landmarks, Gaussians, factor graph | No export path to production map format |
| Backend | IEKF, pose graph, factor graph, bundle adjustment, Ceres/g2o/GTSAM | Black-box pose output with no residual/covariance access |
| ROS and middleware | ROS 1/ROS 2, standalone API, bag replay, message types | ROS 1-only when product stack is ROS 2 and wrappers are nontrivial |
| Runtime determinism | P95/P99 latency, memory growth, thread model | Mean-only timing or unbounded map growth |
| Diagnostics | Residuals, inlier ratio, degeneracy, covariance, loop acceptance | Only publishes pose and point cloud |
| License | MIT/BSD/Apache/GPL/commercial constraints | GPL stack linked into closed product without legal review |
| Maintenance | Active issues, releases, build support, CI, dependency age | Unmaintained fork with old Ubuntu/ROS only |
| Production gap | Safety case, fault handling, QA, calibration, maps | "Works on KITTI" used as production readiness proof |

## Stack Comparison

| Stack | Sensors | Backend/optimization | License | ROS/standalone | Strengths | Caveats | Best fit |
|---|---|---|---|---|---|---|---|
| [KISS-ICP](kiss-icp.md) | 3D LiDAR | Point-to-point ICP, voxel local map | MIT | Standalone, Python, ROS 2; ROS 1 deprecated in current repo | Very simple, strong baseline, easy to run, low integration risk | Odometry only; no global loop closure in base pipeline | Fallback odometry, survey validation, method baseline |
| KISS-SLAM | 3D LiDAR | KISS-ICP front-end, loop closure, g2o | MIT | Python package/standalone | Simple LiDAR-only SLAM, indoor parameter guidance, reproducible paper tag | Newer than KISS-ICP; production maturity still emerging | Lightweight LiDAR SLAM, survey prototypes |
| [LIO-SAM](lio-sam.md) | 3D LiDAR, IMU, optional GPS | GTSAM factor graphs, IMU preintegration, feature-based LiDAR factors | BSD-3 | ROS 1 original; ROS 2 branch/community variants | Excellent teaching/reference architecture for factor-graph LIO with GPS/loops | Feature extraction and ROS 1 assumptions can be brittle; needs careful IMU setup | Survey mapping, factor-graph design reference |
| [FAST-LIO2](fast-lio-fast-lio2.md) | 3D LiDAR, IMU | Tightly coupled iterated EKF, ikd-tree map | GPL-2.0 | ROS 1 | High-rate direct LIO, supports spinning and solid-state LiDAR, strong real-time performance | GPL integration risk; no native loop closure in core; timing calibration critical | Survey front-end, GPS-denied odometry, UAV/handheld |
| Faster-LIO family | 3D LiDAR, IMU | Tightly coupled LIO, iVox incremental voxels | GPL-family repo terms require review | ROS 1 | Faster map structure than tree-based LIO in many cases | Voxel-size sensitivity; less common production adoption | Speed-focused LIO experiments |
| [Point-LIO](point-lio.md) | 3D LiDAR, IMU | Point-wise LIO with high-rate output | GPL-2.0 repo terms require review | ROS 1 | High-bandwidth odometry, aggressive motion/vibration robustness | IMU synchronization and saturation configuration are non-negotiable | UAV, vibration-heavy platforms, high-rate control |
| [CT-ICP](ct-icp.md) | 3D LiDAR | Continuous-time ICP, LiDAR-only elastic model | Check repo license before product use | Standalone/ROS wrappers | Models intra-scan motion without IMU; good LiDAR-only reference | Less natural multi-sensor fusion than factor-graph LIO | LiDAR-only vehicles, motion-distortion studies |
| [GLIM](glim.md) | Range sensors, IMU optional, RGB-D capable | Direct multi-scan registration on factor graphs, GPU scan-matching factors via gtsam_points | MIT | ROS 2 and standalone ecosystem | Modern, extensible, GPU-aware, GTSAM-based, manual map correction | Newer stack; dependencies include GTSAM/gtsam_points/CUDA for full benefit | Serious 3D mapping research and survey tooling |
| [Cartographer](cartographer-3d.md) | 2D/3D LiDAR, IMU, odom | Submaps, scan matching, sparse pose adjustment | Apache-2.0 | ROS integrations, standalone core | Mature submap architecture, branch-and-bound loop closure, strong 2D heritage | Google project is effectively mature/maintenance-mode; configuration-heavy | 2D/3D robotics mapping reference, indoor SLAM |
| RTAB-Map | RGB-D, stereo, LiDAR, IMU/odom inputs | Graph SLAM, appearance-based loop closure | BSD-style core; verify dependencies | ROS 1/2 and standalone | Very practical robotics tool, broad sensor support, visualization | Many knobs; not a minimal AV localization core | Indoor mapping, RGB-D, multi-sensor robot prototypes |
| [ORB-SLAM3](orb-slam2-orb-slam3.md) | Monocular, stereo, RGB-D, visual-inertial | Sparse features, bundle adjustment, multi-map SLAM | GPL-3.0 | Standalone examples, community ROS wrappers | Strong visual/VIO baseline, multi-map recovery | GPL; visual degradation in glare/weather/low texture | Camera-first robotics and research benchmark |
| [OpenVINS](openvins.md) | Mono/stereo cameras, IMU | MSCKF/EKF visual-inertial estimator | GPL-3.0 | ROS 1/2 and ROS-free | Excellent documentation, evaluation tools, covariance discipline | Sparse VIO, not full dense mapper; GPL | VIO research, estimator consistency reference |
| [VINS-Fusion](vins-mono-vins-fusion.md) | Mono+IMU, stereo+IMU, stereo, GPS example | Sliding-window optimization with Ceres, loop fusion | GPL-3.0 | ROS 1 | Widely used VIO baseline with multi-sensor modes | Older dependencies; GPL; calibration-sensitive | Visual-inertial baseline, GPS fusion reference |
| SLAM Toolbox | 2D LiDAR, odom | Pose graph, scan solvers, occupancy grid | BSD-3 | ROS 2 | Practical ROS 2 indoor mapping/localization stack, Nav2 integration | 2D only; not for 3D AV maps | Warehouses, service robots, Nav2 products |
| Autoware NDT | 3D LiDAR, map, EKF/GNSS inputs | NDT scan matching, Monte Carlo initial pose | Apache-2.0 ecosystem | ROS 2/Autoware | Production-oriented diagnostics, dynamic map loading, covariance, services | Localization stack, not full SLAM; tied to Autoware interfaces | Road/yard/airside localization reference |
| MOLA | LiDAR/LO/LIO/GNSS/kinematics/maps | Modular localization and mapping, metric maps, particle filters | BSD-family/MRPT ecosystem; verify modules | ROS 2 and standalone | Strong modularity, localization-only modes, georeferenced workflows | Smaller ecosystem than Autoware/ROS Nav2 | Research-to-product mapping/localization bridge |
| gtsam_points | LiDAR/range factors | GICP/VGICP/colored ICP factors, CPU/GPU options | MIT | Library with GLIM integration | Direct bridge from scan matching to GTSAM graphs | Library, not a complete robot stack | Custom factor-graph SLAM/localization |

## Backend and Toolkit Comparison

| Toolkit | Role | License | Strengths | Caveats | Use here |
|---|---|---|---|---|---|
| GTSAM | Factor graphs, smoothing, iSAM2, IMU preintegration | BSD | Robotics-native factors, manifolds, incremental smoothing, Python/MATLAB wrappers | API/version migration needs attention; not a turnkey SLAM system | Primary backend reference for airside SLAM/map/localization factors |
| g2o | General graph optimization | BSD | Lightweight, proven in visual SLAM and pose graphs | Less sensor-fusion-oriented than GTSAM | Loop closure and pose-graph systems such as KISS-SLAM/ORB-style stacks |
| Ceres Solver | Nonlinear least squares | Apache-2.0 | Mature, robust, production-proven, excellent for bundle adjustment/calibration | No native factor-graph semantics; user handles graph structure | Visual BA, calibration, scan-matching optimization |
| Open3D | 3D data processing | MIT | Registration, point-cloud processing, visualization, Python workflows | Not a full SLAM product by itself | Map QA, prototyping, post-processing |
| PCL | Point-cloud algorithms | BSD | Broad point-cloud ecosystem, ICP/NDT filters | Legacy APIs and performance vary | Reference implementations and offline tools |
| FAISS | Similarity search | MIT | Fast descriptor retrieval at scale | Not geometric verification | Place recognition database acceleration |

## AV, Indoor, Outdoor Shortlists

| Domain | Shortlist | Stack role | Expected additions |
|---|---|---|---|
| Airside runtime localization | Autoware NDT diagnostics, custom GPU VGICP/gtsam_points, GTSAM/iSAM2, Scan Context/MinkLoc3D | Runtime pose in validated map | Multi-LiDAR calibration, covariance gating, RTK/wheel/IMU factors, safe fallback |
| Airside survey mapping | [FAST-LIO2](fast-lio-fast-lio2.md), [GLIM](glim.md), [LIO-SAM](lio-sam.md), [KISS-ICP](kiss-icp.md), KISS-SLAM | Build and validate maps | GCP factors, map QA, dynamic filtering, geodetic export |
| Indoor warehouse product | SLAM Toolbox, AMCL/Nav2, RTAB-Map for RGB-D | Occupancy map and navigation | Reflectors/AprilTags, map versioning, aisle relocalization |
| Construction/underground mapping | [GLIM](glim.md), [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md), RTAB-Map | 3D mapping in hard geometry | Multi-session loop closure, dust/dark testing, Hilti-style benchmark |
| Camera-first robot | [ORB-SLAM3](orb-slam2-orb-slam3.md), [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md) | Visual/VIO baseline | Exposure/blur checks, robust relocalization, calibration automation |
| Dense visual map research | RTAB-Map, NICE-SLAM, SplaTAM, Splat-SLAM | Reconstruction/QA/simulation | Classical pose fallback, uncertainty estimation, static/dynamic segmentation |

## Integration Patterns

| Pattern | Components | When to use | Main risk |
|---|---|---|---|
| LiDAR-only independent fallback | [KISS-ICP](kiss-icp.md) running beside production scan-to-map | Detect IMU/map-localization failures and provide dead-reckoning fallback | Drift if used too long; must have safe-stop budget |
| LIO survey front-end plus graph backend | [FAST-LIO2](fast-lio-fast-lio2.md) or [Point-LIO](point-lio.md) producing odometry into GTSAM | Build high-quality survey maps with external anchors | Double-counting IMU if factors are not modeled correctly |
| Full factor-graph SLAM | [LIO-SAM](lio-sam.md) or [GLIM](glim.md)-style graph | Need loop closure, GPS/GCP, multi-session constraints | Bad loop factors can corrupt full map without robust gating |
| Localization-only mode | Autoware NDT, MOLA localization, custom VGICP | Production operation in a known map | Wrong initial pose and map staleness |
| Visual auxiliary | [ORB-SLAM3](orb-slam2-orb-slam3.md), [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md) feeding health or relative motion | Cameras already available and lighting is acceptable | Visual failure under glare/weather if treated as primary |
| Dense/neural QA overlay | Gaussian/RGB-D stack after classical pose/map generation | Inspect map, create digital twin, support simulation | Overinterpreting rendering quality as localization certainty |

## License and Product-Risk Matrix

| License/status | Examples | Product implication |
|---|---|---|
| MIT/BSD/Apache-friendly | [KISS-ICP](kiss-icp.md), KISS-SLAM, GTSAM, Ceres, [GLIM](glim.md), SLAM Toolbox, Autoware | Usually easier to integrate, but still review dependencies and modifications. |
| GPL-family | [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md), [ORB-SLAM3](orb-slam2-orb-slam3.md), [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md) | Excellent research baselines; product linking/distribution requires legal review or clean-room reimplementation. |
| Research/new stack | Splat-SLAM, many Gaussian SLAM projects, newer LIO variants | Useful for experimentation; require extra maturity assessment and failure monitoring. |
| Dataset license restrictions | Hilti non-commercial, some AV datasets | Good for benchmarking, not necessarily for commercial training/product use. |

## Stack-Specific Caveats

| Stack | Caveat | Mitigation |
|---|---|---|
| [KISS-ICP](kiss-icp.md) | No global correction; local map only | Pair with loop closure or use as odometry/fallback baseline. |
| [LIO-SAM](lio-sam.md) | Requires correct IMU orientation, extrinsics, deskewing, and feature parameters | Build a calibration replay test before trusting results. |
| [FAST-LIO2](fast-lio-fast-lio2.md) | Great front-end but not a full map lifecycle | Feed outputs into loop closure/GTSAM/GCP map optimization. |
| [Point-LIO](point-lio.md) | High-rate point updates expose sensor timestamp mistakes quickly | Add IMU saturation checks and time-sync health metrics. |
| [CT-ICP](ct-icp.md) | Continuous-time LiDAR-only modeling can be compute/config sensitive | Compare against IMU-deskewed LIO on same motion profiles. |
| [GLIM](glim.md) | Powerful but newer and dependency-rich | Freeze versions and benchmark CUDA/GTSAM compatibility on target hardware. |
| [Cartographer](cartographer-3d.md) | Tuning submaps and loop closure can dominate project time | Use when submap behavior is needed and configuration effort is acceptable. |
| RTAB-Map | Broad feature set can hide complexity | Lock a narrow sensor mode and parameter set for deployment. |
| [ORB-SLAM3](orb-slam2-orb-slam3.md) | Visual-only failure under airport glare/night/rain | Use as auxiliary or camera-first research baseline, not primary airside pose. |
| [OpenVINS](openvins.md) | Filter consistency depends on calibration and feature tracking assumptions | Use its NEES/evaluation tooling to validate covariance. |
| Autoware NDT | NDT can fail in sparse or changed geometry | Add GNSS/IMU/wheel priors, covariance monitoring, and fallback matching. |

## Recommended Stack for This Library

| Layer | Recommended open-source reference | Production interpretation |
|---|---|---|
| Primary LiDAR-only baseline | [KISS-ICP](kiss-icp.md) | Keep as a simple benchmark and independent odometry monitor. |
| Primary LIO survey baseline | [FAST-LIO2](fast-lio-fast-lio2.md) and [GLIM](glim.md) | Use to generate survey trajectories/submaps; check license before product embedding. |
| Factor-graph reference | [LIO-SAM](lio-sam.md), GTSAM, [GLIM](glim.md)/gtsam_points | Reuse concepts for IMU, GPS/GCP, loop, scan-matching, and map factors. |
| Indoor navigation reference | SLAM Toolbox, [Cartographer](cartographer-3d.md), RTAB-Map | Use for warehouse/AGV scenarios, not as airside AV default. |
| Visual/VIO reference | [ORB-SLAM3](orb-slam2-orb-slam3.md), [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md) | Use to benchmark camera contribution and calibration, not primary all-weather pose. |
| Runtime AV localization reference | Autoware NDT and MOLA localization | Study diagnostics/interfaces; production stack may use custom VGICP/GTSAM. |
| Dense/neural map reference | SplaTAM, Splat-SLAM, NICE-SLAM | Treat as map QA/simulation research; require classical pose fallback. |

## Sources

- PRBonn KISS-ICP official repo: https://github.com/PRBonn/kiss-icp
- PRBonn KISS-SLAM official repo and paper link: https://github.com/PRBonn/kiss-slam
- TixiaoShan LIO-SAM official repo and paper: https://github.com/TixiaoShan/LIO-SAM and https://arxiv.org/abs/2007.00258
- HKU-MARS FAST-LIO/FAST-LIO2 official repo and paper: https://github.com/hku-mars/FAST_LIO and https://arxiv.org/abs/2107.06829
- gaoxiang12 Faster-LIO official repo and paper PDF: https://github.com/gaoxiang12/faster-lio and https://raw.githubusercontent.com/gaoxiang12/faster-lio/main/doc/faster-lio.pdf
- HKU-MARS Point-LIO official repo: https://github.com/hku-mars/Point-LIO
- CT-ICP official repo and paper: https://github.com/jedeschaud/ct_icp and https://arxiv.org/abs/2109.12979
- GLIM official repo and documentation: https://github.com/koide3/glim and https://koide3.github.io/glim/
- gtsam_points official documentation: https://koide3.github.io/gtsam_points/index.html
- GTSAM official docs and repo: https://gtsam.org/docs/ and https://github.com/borglab/gtsam
- g2o official repo: https://github.com/RainerKuemmerle/g2o
- Ceres Solver official docs: https://ceres-solver.org/
- Google Cartographer official documentation: https://google-cartographer.readthedocs.io/
- RTAB-Map official project page: https://introlab.github.io/rtabmap/
- ORB-SLAM3 paper and official repo: https://arxiv.org/abs/2007.11898 and https://github.com/UZ-SLAMLab/ORB_SLAM3
- OpenVINS official docs and repo link: https://docs.openvins.com/
- VINS-Fusion official repo: https://github.com/HKUST-Aerial-Robotics/VINS-Fusion
- SLAM Toolbox official ROS docs and repo: https://docs.ros.org/en/jazzy/p/slam_toolbox/ and https://github.com/SteveMacenski/slam_toolbox
- Autoware NDT scan matcher official docs: https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- MOLA official localization docs: https://docs.mola-slam.org/latest/localization.html
- SplaTAM paper, NICE-SLAM repo, and Splat-SLAM repo: https://arxiv.org/abs/2312.02126, https://github.com/cvg/nice-slam, and https://github.com/google-research/Splat-SLAM
