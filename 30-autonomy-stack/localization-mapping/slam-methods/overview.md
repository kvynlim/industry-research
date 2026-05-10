# SLAM Method Library Overview

This directory is the method-level SLAM library. It should help a reader answer four questions before opening any individual method page:

1. What role does SLAM play relative to odometry, map construction, and production localization?
2. Which method family should be evaluated for a given AV, indoor, or outdoor environment?
3. Which benchmark and metric suite gives a fair result?
4. Which open-source stack is a reasonable starting point, and which is only a research reference?

For airside autonomous vehicles, the practical answer is not "run SLAM online forever." The production stack should separate offline map construction, online scan-to-map localization, high-rate state estimation, and loop-closure/relocalization. SLAM remains critical for survey mapping, map maintenance, fallback odometry, validation against map-localization failures, and research into future dense or neural map representations.

## Priority Ratings

Priority ratings are editorial reading and deployment triage signals. `Learning` answers what to read early for SLAM/localization understanding. `Deployment` answers what to evaluate early for AV deployment in the tagged context; it is not a certification or product-readiness claim.

<!-- priority-table:start -->
| Method | Rating | Stage | Maturity | Reason |
|---|---|---|---|---|
| [Point-to-Point ICP for 3D SLAM and LiDAR Localization](icp.md) | Learning: ★★★★★<br>Deployment: ★★★★★ | `foundation` | `fielded-pattern` | Core registration primitive behind LiDAR odometry and scan-to-map localization. |
| [DO-Removal LIO](do-removal-lio.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | DO-Removal LIO is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [DOF-LIO Lightweight Dynamic Object Filter](dof-lio-lightweight-dynamic-object-filter.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | DOF-LIO Lightweight Dynamic Object Filter is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [DR-REMOVER](dr-remover.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | DR-REMOVER is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | Dynamic-Object-Aware SLAM is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [ERASOR](erasor.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | ERASOR is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [ERASOR++](erasor-plus-plus.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | ERASOR++ is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | Core LiDAR-inertial baseline for mapping and localization fallback. |
| [FAST-LIVO and FAST-LIVO2](fast-livo-fast-livo2.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | FAST-LIVO and FAST-LIVO2 is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [FreeDOM Dynamic Object Removal](freedom-dynamic-object-removal.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | FreeDOM Dynamic Object Removal is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [GLIM](glim.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | GLIM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [HDL Graph SLAM: 3D LiDAR-Based Graph SLAM](hdl-graph-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | HDL Graph SLAM: 3D LiDAR-Based Graph SLAM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [KISS-Matcher](kiss-matcher.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | KISS-Matcher is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [KISS-SLAM](kiss-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | KISS-SLAM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [LeGO-LOAM: Lightweight and Ground-Optimized LiDAR Odometry and Mapping](lego-loam.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | LeGO-LOAM: Lightweight and Ground-Optimized LiDAR Odometry and Mapping is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | LiDAR Map Cleaning and Dynamic Removal is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [LIO-SAM](lio-sam.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | Canonical factor-graph LIO reference for LiDAR, IMU, GPS, and loop factors. |
| [LOAM: Lidar Odometry and Mapping in Real-time](loam.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | LOAM: Lidar Odometry and Mapping in Real-time is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [LT-Mapper, Khronos, and Lifelong Mapping](lt-mapper-khronos-lifelong-mapping.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | LT-Mapper, Khronos, and Lifelong Mapping is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [LVI-SAM](lvi-sam.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | LVI-SAM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [MapCleaner](mapcleaner.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | MapCleaner is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [MOLA, MOLA-LO, and MOLA-LIO](mola.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | MOLA, MOLA-LO, and MOLA-LIO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [MOVES and Label-Free Map Cleaning](moves-and-label-free-map-cleaning.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | MOVES and Label-Free Map Cleaning is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [Normal Distributions Transform (NDT) for 3D SLAM and AV Localization](ndt.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `fielded-pattern` | Mature scan-to-map localization pattern used in AV and robotics stacks. |
| [Omni-LIVO and Multi-LVI-SAM](omni-livo.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | Omni-LIVO and Multi-LVI-SAM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [Point-LIO](point-lio.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | Point-LIO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [R-POD Two-Stage Online Dynamic Removal LIO](rpod-two-stage-online-dynamic-removal-lio.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | R-POD Two-Stage Online Dynamic Removal LIO is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [Removert](removert.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | Removert is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [RTMap, DUFOMap, and Recursive Map Maintenance](rtmap-dufomap-recursive-maintenance.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | RTMap, DUFOMap, and Recursive Map Maintenance is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [Scan Context Family](scan-context-family.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `fielded-pattern` | Core LiDAR place-recognition pattern for loop closure and relocalization. |
| [SD-SLAM Semantic Dynamic LiDAR](sd-slam-semantic-dynamic-lidar.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | SD-SLAM Semantic Dynamic LiDAR is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [STATIC-LIO Dynamic Points Removal](static-lio-dynamic-points-removal.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | STATIC-LIO Dynamic Points Removal is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [SuMa](suma.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `modern-core` | `fielded-pattern` | SuMa is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [TRLO Dynamic Tracking Removal LiDAR Odometry](trlo-dynamic-tracking-removal-lidar-odometry.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `pilot-proven` | TRLO Dynamic Tracking Removal LiDAR Odometry is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps. |
| [Bundle Adjustment SLAM](bundle-adjustment-slam.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Bundle Adjustment SLAM is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [Continuous-Time Registration for LiDAR SLAM and AV Localization](continuous-time-registration.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Continuous-Time Registration for LiDAR SLAM and AV Localization is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [CT-ICP: Continuous-Time ICP](ct-icp.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | CT-ICP: Continuous-Time ICP is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Backend pattern for smoothing, loop closure, and multi-sensor pose estimation. |
| [FastSLAM and Particle SLAM](fastslam-particle-slam.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | FastSLAM and Particle SLAM is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [GenZ-ICP and GenZ-LIO](genz-icp-genz-lio.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | GenZ-ICP and GenZ-LIO is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [GICP and VGICP for 3D SLAM and LiDAR Localization](gicp-vgicp.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | GICP and VGICP for 3D SLAM and LiDAR Localization is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Core graph formulation behind mapping, loop closure, and smoothing. |
| [Learned LiDAR Place Recognition](learned-lidar-place-recognition.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Learned LiDAR Place Recognition is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [LiDAR Bundle Adjustment Factors](lidar-bundle-adjustment-factors.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | LiDAR Bundle Adjustment Factors is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [Loop Closure and Place Recognition](loop-closure-place-recognition.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Loop Closure and Place Recognition is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [Occupancy Grid, TSDF, and ESDF Mapping](occupancy-grid-tsdf-esdf-mapping.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Occupancy Grid, TSDF, and ESDF Mapping is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [Point-to-Plane ICP for 3D SLAM and LiDAR Localization](point-to-plane-icp.md) | Learning: ★★★★★<br>Deployment: ★★★★☆ | `foundation` | `fielded-pattern` | Point-to-Plane ICP for 3D SLAM and LiDAR Localization is rated for foundational SLAM modeling, optimization, registration, or mapping concepts. |
| [BEV-LIO(LC)](bev-lio-lc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | BEV-LIO(LC) is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [Certifiable Pose Graph Optimization](certifiable-pose-graph-optimization.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Certifiable Pose Graph Optimization is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [CLIC and Coco-LIC](clic-coco-lic.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | CLIC and Coco-LIC is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [CM-LIUW-Odometry](cm-liuw-odometry.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | CM-LIUW-Odometry is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [COVINS and COVINS-G](covins-covins-g.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | COVINS and COVINS-G is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [D2SLAM](d2slam.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | D2SLAM is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [Distributed Multi-Robot Pose Graph Optimization](distributed-multi-robot-pgo.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Distributed Multi-Robot Pose Graph Optimization is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [Dynamic Map Cleaning Benchmarks](dynamic-map-cleaning-benchmarks.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | Dynamic Map Cleaning Benchmarks is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [Dynamic-Aware LIO BTSA](dynamic-aware-lio-btsa.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Dynamic-Aware LIO BTSA is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [FusionPortableV2 Multi-Platform SLAM Dataset](fusionportablev2-multiplatform-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | FusionPortableV2 Multi-Platform SLAM Dataset is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [GEODE Degenerate LiDAR Benchmark](geode-degenerate-lidar-benchmark.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | GEODE Degenerate LiDAR Benchmark is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [Ground-Fusion, M2DGR, and M3DGR](ground-fusion-m2dgr-m3dgr.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | Ground-Fusion, M2DGR, and M3DGR is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [HeRCULES Radar Benchmark](hercules-radar-benchmark.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | HeRCULES Radar Benchmark is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [Kimera-Multi](kimera-multi.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Kimera-Multi is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [Kimera-RPGO and Pairwise Consistency Maximization](kimera-rpgo-pcm.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Kimera-RPGO and Pairwise Consistency Maximization is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [Kimera-VIO](kimera-vio.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Kimera-VIO is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [KISS-ICP: Keep It Small and Simple ICP](kiss-icp.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Strong LiDAR-only odometry baseline for evaluating registration stacks. |
| [LiDAR-IMU Temporal Initialization](lidar-imu-temporal-initialization.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | LiDAR-IMU Temporal Initialization is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [LIR-LIVO](lir-livo.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | LIR-LIVO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [MA-LIO](ma-lio.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | MA-LIO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [MM-LINS](mm-lins.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | MM-LINS is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [Multi-Agent Neural and Gaussian SLAM](multi-agent-neural-gaussian-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Multi-Agent Neural and Gaussian SLAM is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [OKVIS2-X](okvis2-x.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | OKVIS2-X is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [Open-Source SLAM Stack Comparison](open-source-stack-comparison.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | Open-Source SLAM Stack Comparison is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [OpenVINS](openvins.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Practical VIO baseline for camera-IMU state estimation and fallback odometry. |
| [PG-LIO](pg-lio.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | PG-LIO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [R2LIVE and R3LIVE](r2live-r3live.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | R2LIVE and R3LIVE is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [Robust Pose Graph Optimization with GNC and riSAM](robust-pgo-gnc-risam.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Robust Pose Graph Optimization with GNC and riSAM is rated for robust or collaborative backend design in multi-session SLAM and validation. |
| [Semantic-LiDAR-Inertial-Wheel Odometry](semantic-liw-odometry.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Semantic-LiDAR-Inertial-Wheel Odometry is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [SLAM Benchmarking Metrics and Datasets](benchmarking-metrics-datasets.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | SLAM Benchmarking Metrics and Datasets is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [SLAM Decision Matrix for AV, Indoor, and Outdoor Systems](av-indoor-outdoor-decision-matrix.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | SLAM Decision Matrix for AV, Indoor, and Outdoor Systems is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [SNAIL Radar Benchmark](snail-radar-benchmark.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | SNAIL Radar Benchmark is rated as a SLAM benchmark or reference page for comparing methods and deployments. |
| [SPLIN ISDOR PPLIO](splin-isdor-pplio.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | SPLIN ISDOR PPLIO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks. |
| [SVO](svo.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | SVO is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Widely used visual-inertial baseline for GNSS-denied motion estimation. |
| [4D Imaging Radar RIO and SLAM](4d-imaging-radar-rio-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | 4D Imaging Radar RIO and SLAM is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [Cartographer 3D](cartographer-3d.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `classic-baseline` | `fielded-pattern` | Mature submap SLAM reference for indoor and robotics mapping. |
| [Radar Teach-Repeat Localization](radar-teach-repeat-localization.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | Radar Teach-Repeat Localization is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [Radar-Inertial Odometry](radar-inertial-odometry.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | Radar-Inertial Odometry is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [Radar-Inertial Online Temporal Calibration](radar-inertial-online-temporal-calibration.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | Radar-Inertial Online Temporal Calibration is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [Radar-to-LiDAR Map Localization](radar-to-lidar-map-localization.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | Radar-to-LiDAR Map Localization is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [RadarSplat-RIO](radarsplat-rio.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | RadarSplat-RIO is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [RTAB-Map](rtab-map.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `fielded-pattern` | Practical multi-sensor robotics SLAM stack with broad deployment use. |
| [BundleFusion](bundlefusion.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | BundleFusion is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [Co-SLAM and ESLAM](co-slam-eslam.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | Co-SLAM and ESLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [DPVO and DPV-SLAM](dpvo.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | DPVO and DPV-SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [DROID-SLAM](droid-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | DROID-SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [ElasticFusion](elasticfusion.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | ElasticFusion is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [Event-Camera VIO and SLAM](event-camera-vio-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | Event-Camera VIO and SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [KinectFusion](kinectfusion.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | KinectFusion is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [LSD-SLAM and DSO](lsd-slam-dso.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `classic-baseline` | `historical` | LSD-SLAM and DSO are rated for direct visual SLAM foundations and camera-only fallback concepts. |
| [MASt3R-SLAM](mast3r-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | MASt3R-SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [Object-Level SLAM](object-level-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | Object-Level SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `classic-baseline` | `fielded-pattern` | Strong visual SLAM baseline, but not a primary AV localization backbone. |
| [Semantic SLAM](semantic-slam.md) | Learning: ★★★★☆<br>Deployment: ★★★☆☆ | `modern-core` | `fielded-pattern` | Semantic SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use. |
| [GPR Localization and Ground Encoding](gpr-localization-ground-encoding.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `deployment-pattern` | `prototype` | GPR Localization and Ground Encoding is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [GS-LIVM](gs-livm.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | GS-LIVM is rated as a supporting SLAM method for autonomy-stack triage and follow-up reading. |
| [LO-Net Learned LiDAR Odometry](lo-net-learned-lidar-odometry.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | LO-Net Learned LiDAR Odometry is rated as a supporting SLAM method for autonomy-stack triage and follow-up reading. |
| [Radar Odometry and Radar SLAM](radar-odometry-radar-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `deployment-pattern` | `prototype` | Radar Odometry and Radar SLAM is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [Radar Place Recognition: 4DRaL and SHeRLoc](radar-place-recognition-4dral-sherloc.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `deployment-pattern` | `prototype` | Radar Place Recognition: 4DRaL and SHeRLoc is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [Radar-LiDAR-Inertial Fusion for Robust Odometry and SLAM](radar-lidar-inertial-fusion.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `deployment-pattern` | `prototype` | Radar-LiDAR-Inertial Fusion for Robust Odometry and SLAM is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [RegFormer Learned Registration](regformer-learned-registration.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | RegFormer Learned Registration is rated as a supporting SLAM method for autonomy-stack triage and follow-up reading. |
| [ROMAN Object Map Alignment](roman-object-map-alignment.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | ROMAN Object Map Alignment is rated as a supporting SLAM method for autonomy-stack triage and follow-up reading. |
| [Super4DR](super4dr.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | Super4DR is rated as a supporting SLAM method for autonomy-stack triage and follow-up reading. |
| [Thermal-Inertial SLAM and Odometry](thermal-inertial-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `deployment-pattern` | `prototype` | Thermal-Inertial SLAM and Odometry is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [UWB and Radio Ranging SLAM](uwb-radio-ranging-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `deployment-pattern` | `prototype` | UWB and Radio Ranging SLAM is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions. |
| [EKF-SLAM](ekf-slam.md) | Learning: ★★★★★<br>Deployment: ★★☆☆☆ | `foundation` | `historical` | Foundation for estimator thinking, but rarely the direct modern AV stack. |
| [4dNDF](4dndf.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | 4dNDF is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [Dynamic 4D Gaussian SLAM](dynamic-4d-gaussian-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | Dynamic 4D Gaussian SLAM is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [Gaussian-LIC and Gaussian-LIC2](gaussian-lic.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | Gaussian-LIC and Gaussian-LIC2 is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [GigaSLAM: Large-Scale Monocular SLAM with Hierarchical Gaussian Splats](gigaslam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | GigaSLAM: Large-Scale Monocular SLAM with Hierarchical Gaussian Splats is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [GS-SLAM and MonoGS](gs-slam-monogs.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | GS-SLAM and MonoGS is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [iMAP](imap.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | iMAP is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [NeRF-SLAM](nerf-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | NeRF-SLAM is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [NICE-SLAM](nice-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | NICE-SLAM is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [Photo-SLAM](photo-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | Photo-SLAM is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [PIN-SLAM Neural LiDAR Mapping](pin-slam-neural-lidar-mapping.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | PIN-SLAM Neural LiDAR Mapping is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [S3PO-GS](s3po-gs.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | S3PO-GS is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [SLAM3R and VGGT Foundation SLAM](slam3r-vggt-foundation-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | SLAM3R and VGGT Foundation SLAM is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [Splat-LOAM: Gaussian Splatting LiDAR Odometry and Mapping](splat-loam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | Splat-LOAM: Gaussian Splatting LiDAR Odometry and Mapping is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [Splat-SLAM](splat-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | Useful Gaussian SLAM reference, but not a runtime pose backbone. |
| [SplaTAM](splatam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | SplaTAM is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [VIGS-SLAM and VINGS-Mono](vigs-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | VIGS-SLAM and VINGS-Mono is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
| [WildGS-SLAM: Monocular Gaussian Splatting SLAM in Dynamic Environments](wildgs-slam.md) | Learning: ★★★☆☆<br>Deployment: ★★☆☆☆ | `frontier` | `research` | WildGS-SLAM: Monocular Gaussian Splatting SLAM in Dynamic Environments is rated for neural or Gaussian SLAM research and future dense map representation workflows. |
<!-- priority-table:end -->

## Repo Cross-Links

| Topic | Read next | Why it matters for this library |
|---|---|---|
| Modern LiDAR odometry and SLAM front ends | [LiDAR SLAM Algorithms](../overview/lidar-slam-algorithms.md) | Detailed treatment of [KISS-ICP](kiss-icp.md), [KISS-SLAM](kiss-slam.md), [MOLA](mola.md), [LIO-SAM](lio-sam.md), [LVI-SAM](lvi-sam.md), [FAST-LIO2](fast-lio-fast-lio2.md), [FAST-LIVO2](fast-livo-fast-livo2.md), [R2LIVE/R3LIVE](r2live-r3live.md), [CT-ICP](ct-icp.md), and [Point-LIO](point-lio.md). |
| Production scan-to-map localization | [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md) | Explains why production AV localization should usually match live scans to a prebuilt map instead of relying only on online SLAM. |
| Loop closure and kidnapped-robot recovery | [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md) and [Scan Context Family](scan-context-family.md) | SLAM without robust place recognition becomes odometry with drift; these docs cover descriptor, retrieval, and verification pipelines. |
| Offline survey processing | [Map Construction Pipeline](../maps/map-construction-pipeline.md) | Shows where SLAM outputs become fleet-deployable HD maps, geodetic alignment, QA artifacts, and OTA packages. |
| Ego-state fusion and uncertainty | [Robust State Estimation Multi-Sensor](../overview/robust-state-estimation-multi-sensor.md) | SLAM factors must land in an estimator with sane gating, covariance, fallback, and sensor-fault behavior. |
| Factor graph foundations | [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) and [LiDAR Bundle-Adjustment Factors](lidar-bundle-adjustment-factors.md) | The common backend language for LIO-SAM, map optimization, loop closure, IMU preintegration, LiDAR BA, and production smoothing. |
| Robust, certifiable, and collaborative backends | [Robust PGO / GNC / riSAM](robust-pgo-gnc-risam.md), [Kimera-Multi](kimera-multi.md), [COVINS/COVINS-G](covins-covins-g.md), [D2SLAM](d2slam.md) | Adds robust graph optimization, certifiable PGO, PCM loop-closure validation, and collaborative SLAM systems as explicit backend families rather than hidden implementation details. |
| Alternative and degraded-sensor localization | [UWB / Radio Ranging SLAM](uwb-radio-ranging-slam.md), [Event-Camera VIO/SLAM](event-camera-vio-slam.md), [Thermal-Inertial SLAM](thermal-inertial-slam.md), [4D Imaging Radar RIO/SLAM](4d-imaging-radar-rio-slam.md), [Radar-to-LiDAR Map Localization](radar-to-lidar-map-localization.md) | Covers GNSS-denied indoor/outdoor transitions, HDR/low-light operation, smoke/dust/night, and all-weather map localization fallbacks. |
| Dynamic map cleaning and object removal | [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md) | Connects ERASOR, Removert, MapCleaner, ERASOR++, 4dNDF, FreeDOM, STATIC-LIO, temporal visibility, semantic masks, MOS/scene-flow evidence, and multi-session consensus to production map construction. |
| Lifelong and alternative localization | [LT-Mapper, Khronos, and Lifelong Mapping](lt-mapper-khronos-lifelong-mapping.md) | Connects recursive map maintenance, MOVES-style label-free map cleaning, GPR localization, and radar teach-repeat fallbacks for changed scenes and adverse weather. |
| Dense/neural scene representations | [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Connects [Splat-SLAM](splat-slam.md), [S3PO-GS](s3po-gs.md), [Gaussian-LIC](gaussian-lic.md), [GS-LIVM](gs-livm.md), [VIGS-SLAM](vigs-slam.md), [Dynamic 4D Gaussian SLAM](dynamic-4d-gaussian-slam.md), and [RadarSplat-RIO](radarsplat-rio.md) to future dense mapping, semantic map QA, and simulation. |
| Coverage audit and backlog | [SLAM Coverage Audit and Backlog](coverage-audit-2026.md) | Tracks missing first-class method pages found by parallel web-search agents so the library does not silently omit major techniques. |

## Scope Boundaries

| Term | Primary output | Updates a map? | Drift behavior | Production role | Typical methods |
|---|---:|---:|---|---|---|
| Odometry | Relative pose stream | Local map only | Unbounded without correction | Fallback, prediction, survey front-end | [KISS-ICP](kiss-icp.md), [FAST-LIO2](fast-lio-fast-lio2.md), [FAST-LIVO2](fast-livo-fast-livo2.md), [Point-LIO](point-lio.md), [CT-ICP](ct-icp.md) |
| SLAM | Trajectory plus map | Yes | Bounded by loop closures and global constraints | Survey mapping, map repair, exploratory operation | [LIO-SAM](lio-sam.md), [LVI-SAM](lvi-sam.md), [KISS-SLAM](kiss-slam.md), [Cartographer](cartographer-3d.md), RTAB-Map, [GLIM](glim.md), [MOLA](mola.md) |
| Localization | Pose in an existing map | No, except quality overlays | Bounded by map quality and scan matching | Normal AV runtime | Autoware NDT, VGICP, [MOLA](mola.md) localization, [KISS-Matcher](kiss-matcher.md), GTSAM scan-to-map factors |
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
| Airside AV apron, known map | LiDAR-to-map localization plus state estimation | [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md), [KISS-ICP](kiss-icp.md), [LIO-SAM](lio-sam.md) | RTK/GCP anchored maps, GTSAM scan-to-map factors, place recognition, degeneracy gating | Treating online SLAM as the only global reference; open tarmac is geometrically weak |
| Road AV in mapped ODD | Prebuilt HD map localization plus LiDAR/radar/camera odometry | [FAST-LIO2](fast-lio-fast-lio2.md), [GLIM](glim.md), [Autoware NDT](ndt.md) | GNSS/INS fusion, dynamic object removal, map versioning, online map-change detection | Using indoor RGB-D or monocular-only SLAM for safety-critical pose |
| Indoor warehouse, planar floors | 2D LiDAR SLAM or 3D LiDAR-inertial if tall racks matter | SLAM Toolbox, [Cartographer](cartographer-3d.md), RTAB-Map | Wheel odometry, reflector/AprilTag anchors, floor-zone maps, periodic relocalization | Forklifts or racks create persistent dynamic clutter without filtering |
| Underground/construction | 3D LiDAR-inertial with multi-session SLAM | [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md), [GLIM](glim.md), [CT-ICP](ct-icp.md) | Loop closure, cross-session map merging, robust kernels, lidar intensity if geometry repeats | Pure visual tracking in dust/dark or pure GNSS outdoors/indoors mixed |
| Outdoor campus/service robot | LiDAR-inertial plus place recognition | [KISS-ICP](kiss-icp.md), [KISS-SLAM](kiss-slam.md), [LIO-SAM](lio-sam.md), [MOLA](mola.md) | Long-term dataset validation, seasonal map maintenance, semantic/dynamic filtering | Assuming one sunny-day map covers all seasons and construction changes |
| UAV/handheld inspection | Visual-inertial or LiDAR-inertial depending payload | [OpenVINS](openvins.md), [VINS-Fusion](vins-mono-vins-fusion.md), [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md) | Rolling-shutter handling, aggressive-motion IMU validation, loop closure | Low-grade IMU plus unsynchronized camera/LiDAR under fast motion |

## Airside SLAM Architecture Recommendation

| Layer | Recommended role | Candidate implementation | Why |
|---|---|---|---|
| Survey odometry | Generate per-session trajectories and submaps | [FAST-LIO2](fast-lio-fast-lio2.md) or [GLIM](glim.md) as primary; [KISS-ICP](kiss-icp.md) as independent check | LIO gives robust deskewing and fast motion handling; LiDAR-only validation catches IMU/calibration-specific failures. |
| Loop closure | Correct drift across long apron loops and repeated passes | [LIO-SAM](lio-sam.md) loop module, [KISS-SLAM](kiss-slam.md), [KISS-Matcher](kiss-matcher.md), Scan Context from place-recognition library | Required to prevent multi-kilometer survey maps from accumulating meter-scale drift. |
| Global optimization | Fuse odometry, loop closure, GCP, RTK, and prior map constraints | GTSAM/iSAM2, see [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) | The same factor-graph representation can be reused by map construction and runtime localization. |
| Production runtime pose | Match live LiDAR to the validated HD map | GPU VGICP/NDT plus [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md) | Bounded drift and calibrated uncertainty are more important than online map growth during normal operation. |
| Recovery | Reinitialize after startup, tow, GPS loss, or bad scan matching | [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md) plus ICP/NDT verification | Avoids blindly trusting a local optimizer when the initial pose is wrong. |
| Dense/semantic QA | Inspect map quality and create simulation/visualization artifacts | [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Valuable for map QA and digital twins; not yet mature enough as the certified pose backbone. |

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
| [KISS-SLAM](kiss-slam.md) | LiDAR-only SLAM | When is a lightweight LiDAR-only SLAM system enough for survey mapping? |
| [KISS-Matcher](kiss-matcher.md) | Global point-cloud registration | When can a robust matcher support relocalization, loop verification, or map merging? |
| [LIO-SAM](lio-sam.md) | Factor-graph LiDAR-inertial SLAM | How should LiDAR, IMU, GPS, and loop factors be structured in GTSAM? |
| [LVI-SAM](lvi-sam.md) | LiDAR-visual-inertial SLAM | When does adding visual information to LiDAR-inertial smoothing improve robustness? |
| [FAST-LIO2](fast-lio-fast-lio2.md) | Direct LiDAR-inertial odometry | When is a tightly coupled IEKF front-end the best real-time mapper? |
| [FAST-LIVO2](fast-livo-fast-livo2.md) | Direct LiDAR-inertial-visual odometry | When should a stack use camera constraints with FAST-LIO-style direct mapping? |
| [R2LIVE/R3LIVE](r2live-r3live.md) | LiDAR-inertial-visual reconstruction | When are colorized maps and dense LIV reconstruction useful for survey QA? |
| Faster-LIO family | iVox LiDAR-inertial odometry | What are the speed/accuracy trade-offs of incremental voxels versus trees? |
| [Point-LIO](point-lio.md) | High-bandwidth point-wise LIO | When do aggressive motion and high-rate control justify point-level updates? |
| [CT-ICP](ct-icp.md) | Continuous-time LiDAR odometry | How should a method model intra-scan motion without relying on IMU? |
| [Cartographer](cartographer-3d.md) | Submap and branch-and-bound SLAM | Why is it still relevant for 2D/3D submap SLAM and loop closure? |
| RTAB-Map | RGB-D/visual/LiDAR graph SLAM | When is a mature multi-sensor robotics stack more useful than a leaderboard method? |
| [ORB-SLAM3](orb-slam2-orb-slam3.md) | Visual and visual-inertial SLAM | What is the strongest sparse feature baseline for cameras? |
| [OpenVINS](openvins.md) | Filter-based VIO | When is MSCKF-style VIO preferable to full bundle adjustment? |
| [GLIM](glim.md) | Range-inertial factor-graph mapping | How do GPU scan-matching factors, GTSAM, and manual map correction fit together? |
| [MOLA](mola.md) | Modular LiDAR odometry, mapping, and localization | When is a ROS 2-ready modular mapping/localization framework useful? |
| [Autoware NDT](ndt.md) | Production scan-to-map localization | What can the AV open-source ecosystem teach about diagnostics and integration? |
| [Scan Context Family](scan-context-family.md), [LiDAR Bundle-Adjustment Factors](lidar-bundle-adjustment-factors.md) | Loop-closure and LiDAR backend factors | How should LiDAR descriptors and LiDAR-specific BA factors support relocalization, map refinement, and offline QA? |
| [Robust PGO / GNC / riSAM](robust-pgo-gnc-risam.md), [Certifiable Pose-Graph Optimization](certifiable-pose-graph-optimization.md), [Kimera-RPGO / PCM](kimera-rpgo-pcm.md), [Distributed Multi-Robot PGO](distributed-multi-robot-pgo.md), [Kimera-Multi](kimera-multi.md), [COVINS/COVINS-G](covins-covins-g.md), [D2SLAM](d2slam.md) | Robust and collaborative SLAM backends | How should loop-closure outliers, high-outlier graph optimization, certifiable initialization, and multi-session/multi-robot SLAM systems be handled? |
| [ERASOR](erasor.md), [Removert](removert.md), [MapCleaner](mapcleaner.md), [ERASOR++](erasor-plus-plus.md), [4dNDF](4dndf.md), [FreeDOM](freedom-dynamic-object-removal.md), [STATIC-LIO](static-lio-dynamic-points-removal.md), [Dynamic Map Cleaning Benchmarks](dynamic-map-cleaning-benchmarks.md), [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md) | Dynamic map cleaning | How should a static operational map be built from dynamic scenes without deleting valid structure or preserving ghost objects? |
| [LT-Mapper / Khronos](lt-mapper-khronos-lifelong-mapping.md), [RTMap / DUFOMap](rtmap-dufomap-recursive-maintenance.md), [GPR Localization](gpr-localization-ground-encoding.md), [Radar Teach-Repeat Localization](radar-teach-repeat-localization.md), [MOVES](moves-and-label-free-map-cleaning.md) | Lifelong map maintenance and alternative localization | How should a robot maintain maps across long-term changes, localize when visual/LiDAR assumptions degrade, and clean static-but-wrong objects without labels? |
| [OKVIS2-X](okvis2-x.md), [MM-LINS](mm-lins.md), [Event-Camera VIO/SLAM](event-camera-vio-slam.md), [Thermal-Inertial SLAM](thermal-inertial-slam.md), [UWB / Radio Ranging SLAM](uwb-radio-ranging-slam.md) | Alternative sensor and degraded-scene SLAM | Which non-standard sensors or robustness mechanisms help in GNSS-denied, low-light, smoke/dust, corridor, or weak-geometry settings? |
| [4D Imaging Radar RIO/SLAM](4d-imaging-radar-rio-slam.md), [Radar-to-LiDAR Map Localization](radar-to-lidar-map-localization.md) | Radar localization and cross-modal map matching | How should radar support all-weather odometry or localization against existing LiDAR maps? |
| [Splat-SLAM](splat-slam.md), [S3PO-GS](s3po-gs.md) | Gaussian visual SLAM | What can RGB-only Gaussian maps do, and why are scale and uncertainty still limiting? |
| [Gaussian-LIC](gaussian-lic.md), [GS-LIVM](gs-livm.md), [VIGS-SLAM](vigs-slam.md) | Multi-sensor Gaussian SLAM | How do LiDAR, camera, and IMU constraints stabilize neural/Gaussian maps? |
| [Dynamic 4D Gaussian SLAM](dynamic-4d-gaussian-slam.md), [RadarSplat-RIO](radarsplat-rio.md) | Dynamic/radar Gaussian SLAM | How should dynamic scenes and radar measurements be handled before these maps are trusted? |

## Key Takeaways

| Takeaway | Practical meaning |
|---|---|
| SLAM is a mapping and correction system, not a substitute for a production localization architecture. | Use it to build and maintain maps; use scan-to-map localization for normal mapped operation. |
| The front-end is environment-dependent; the backend pattern is reusable. | ICP/NDT/visual residuals differ, but factor graphs, robust kernels, covariance, and loop closures recur. |
| Public benchmark wins do not imply airside readiness. | Airports need repeated-stand negatives, dynamic aircraft/GSE changes, wet tarmac, night lighting, and geodetic map QA. |
| Removal belongs in both perception and mapping. | Online denoising protects detection and tracking; offline dynamic-object removal protects map quality, localization residuals, and long-term change detection. |
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
