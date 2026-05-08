# Research Index

## Quick Navigation by Topic

### If you need to know about...

#### A specific company
| Company | Primary | Also mentioned in |
|---------|---------|------------------|
| **Waymo** | `companies/waymo/` (5 docs) | `technology/e2e-driving/company-approaches.md`, `operations/safety/safety-incidents-lessons.md`, `operations/deployment/ota-fleet-management.md`, `operations/deployment/fleet-management-dispatch.md`, `technology/perception/production-perception-systems.md` |
| **Tesla** | `companies/tesla/` (4 docs) | `technology/e2e-driving/company-approaches.md`, `operations/safety/safety-incidents-lessons.md`, `operations/deployment/ota-fleet-management.md`, `technology/perception/production-perception-systems.md` |
| **comma.ai** | `companies/comma-ai/` (2 docs) | `technology/world-models/opensource-implementations.md`, `operations/deployment/shadow-mode.md`, `cross-cutting/opensource-ecosystem.md` |
| **Aurrigo** | `companies/aurrigo/` (3 docs) | `operations/airside/industry-overview.md`, `operations/safety/iso-3691-4-deep-dive.md` |
| **UISEE** | `companies/uisee/tech-stack.md` | `companies/changi-programme/`, `operations/airside/industry-overview.md` |
| **TractEasy/EasyMile** | `companies/tracteasy/` (2 docs) | `operations/safety/iso-3691-4-deep-dive.md`, `operations/airside/industry-overview.md` |
| **Wayve** | `companies/wayve/` (4 docs) | `technology/e2e-driving/company-approaches.md`, `technology/world-models/overview.md` |
| **AeroVect** | `companies/aerovect/tech-stack.md` | `operations/airside/industry-overview.md` |
| **Assaia** | `companies/assaia/tech-stack.md` | `companies/moonware/halo-operations.md` |
| **Fernride** | `companies/fernride/tech-stack.md` | `operations/teleoperation/teleoperation-systems.md` |
| **Applied Intuition** | `companies/applied-intuition/tech-stack.md` | `technology/simulation/airport-digital-twins.md` |

#### World models
| Topic | Primary | Supporting |
|-------|---------|-----------|
| What are world models | `technology/world-models/overview.md` | `synthesis/master-synthesis.md` |
| Diffusion-based | `technology/world-models/diffusion-world-models.md` | `foundations/diffusion-models.md` |
| Occupancy-based | `technology/world-models/occupancy-world-models.md` | `technology/world-models/occupancy-networks-comparison.md` (20 methods) |
| Tokenized / JEPA | `technology/world-models/tokenized-and-jepa.md` | `foundations/vqvae-tokenization.md` |
| RL with world models | `technology/world-models/rl-with-world-models.md` | `technology/world-models/dreamer-world-model-rl.md` |
| OccWorld setup | `technology/world-models/occworld-implementation.md` | `technology/world-models/occupancy-networks-comparison.md` |
| Open-source repos | `technology/world-models/opensource-implementations.md` | 21 repos rated |
| Cutting edge 2026 | `technology/world-models/cutting-edge-2026.md` | Latest papers and SOTA |
| Occupancy on Orin | `technology/world-models/occupancy-deployment-orin.md` | FlashOcc TensorRT, nvblox, LiDAR voxelization, multi-resolution grids |
| LiDAR-native world models | `technology/world-models/lidar-native-world-models.md` | Copilot4D, UnO, LidarDM, LiDARCrafter, 4D occupancy forecasting, point cloud prediction, AD-L-JEPA, self-supervised training, Orin deployment |
| Occupancy flow & 4D scenes | `technology/world-models/occupancy-flow-4d-scenes.md` | Scene flow (ZeroFlow 0.028m EPE, DeFlow SOTA), 4D occupancy forecasting (UnO, OccSora, Cam4DOcc), dynamic 3D Gaussians, K-Planes 10900x compression, flow-guided Frenet planning, Mamba temporal, Orin 26-40ms FP16, $6-11K training |

#### Perception
| Topic | Primary | Supporting |
|-------|---------|-----------|
| BEV encoding | `technology/perception/bev-encoding.md` | `foundations/pointpillars.md` |
| Open-vocab detection | `technology/perception/open-vocab-detection.md` | YOLO-World, Grounding DINO |
| DINOv2 for driving | `technology/perception/dinov2-foundation-models-driving.md` | LoRA, adapter integration |
| CenterPoint/OpenPCDet | `technology/perception/openpcdet-centerpoint.md` | `hardware/compute/tensorrt-deployment-guide.md` |
| Production systems | `technology/perception/production-perception-systems.md` | Waymo/Tesla/comma sensor suites |
| Sensor fusion | `cross-cutting/sensor-fusion-architectures.md` | BEVFusion, masked modality training |
| Infrastructure cooperative perception | `technology/perception/infrastructure-cooperative-perception.md` | V2I fusion, fixed sensors, DAIR-V2X, airport existing systems |
| LiDAR foundation models | `technology/perception/lidar-foundation-models.md` | PTv3, Sonata, ScaLR, PointLoRA, 50-80% data savings |
| LiDAR semantic segmentation | `technology/perception/lidar-semantic-segmentation.md` | Cylinder3D, FlatFormer, PTv3, ALPINE panoptic, airside 18-class taxonomy |
| Model compression & edge | `technology/perception/model-compression-edge-deployment.md` | PTQ/QAT, distillation, pruning, TensorRT, ModelOpt, Orin recipes |
| Multi-object tracking | `technology/perception/multi-object-tracking.md` | CenterPoint tracker, SimpleTrack, MCTrack, HOTA, airside Re-ID |
| Camera fallback perception | `technology/perception/camera-fallback-perception.md` | Degraded mode when LiDAR fails: DepthAnything v2, stereo depth, BEVFormer-Tiny, confidence calibration, speed reduction |
| Collaborative fleet perception | `technology/perception/collaborative-fleet-perception.md` | V2V cooperative sensing, Where2comm bandwidth selection, CoBEVT/CoBEVFlow temporal fusion, HEAL heterogeneous agents, fleet occupancy map, collective FOD detection, 5G deployment |
| V2X protocols & airside messages | `technology/multi-agent/v2x-protocols-airside.md` | C-V2X vs DSRC (5G NR V2X preferred), ETSI ITS (CAM/DENM/CPM/MCM), 8 airside-specific messages (APA, SOS, GTA, DZN, EVP, RIP, FDA, JBW), protobuf specs, A-CDM/A-SMGCS/ADS-B bridge, PKI security, bandwidth planning (123 Mbps/50 vehicles), default-deny runway clearance, $270-450K full capability |
| Fleet task allocation & scheduling | `technology/multi-agent/fleet-task-allocation-scheduling.md` | MRTA MT-SR-TA formulation, MILP/CP-SAT (OR-Tools optimal in 10-60s for 200 vehicles), Hungarian O(n³) single-assignment, CBBA decentralized auction (95% optimal, <100ms), SSI real-time auction, A-CDM predictive scheduling (ELDT→pre-positioning, 60-75% delay reduction), online reactive scheduling (event-driven rescheduling, 85% stability), RL dispatch policy (<1ms inference), charging-aware scheduling, multi-objective (tardiness+energy+safety), priority-based task shedding, $42-67K/15-17 weeks |
| Ramp traffic conflict & deadlock prevention | `technology/multi-agent/ramp-traffic-conflict-deadlock-prevention.md` | Zone-capacity graph from Lanelet2, reservation-based traffic management, wait-die deadlock prevention (guarantees no circular wait), 9-level priority conflict resolution, stand turnaround sequencing, V2X decentralized fallback, token mutex for single-lane zones, MAPF (CBS/ECBS for offline, PIBT for real-time), livelock detection/resolution, capacity-constrained routing, dispatch-traffic integration, $50-75K/17 weeks |
| Self-supervised pre-training | `technology/perception/self-supervised-pretraining-driving.md` | Contrastive (SLidR, ScaLR), MAE (Voxel-MAE, GD-MAE, BEV-MAE), JEPA (AD-L-JEPA, V-JEPA 2), DINOv2, multi-modal pre-training, LoRA fine-tuning, 50-80% label reduction, airside curriculum strategy |
| 3DGS for perception & mapping | `technology/perception/gaussian-splatting-driving.md` | GaussianFormer (39.2 mIoU, 20 FPS), GaussianOcc (self-supervised), SplaTAM/MonoGS SLAM, LiDAR-Gaussian fusion, dynamic object tracking, semantic Gaussians, FOD detection, aircraft proximity, Orin deployment (92ms) |
| Uncertainty quantification | `technology/perception/uncertainty-quantification-calibration.md` | Epistemic/aleatoric decomposition, MC-Dropout (T=3, 21.5ms), deep ensembles (M=5, 0.93 AUROC), evidential deep learning (single pass, 7.5ms), conformal prediction (99% coverage guarantee), temperature scaling (ECE 0.03), LiDAR range-dependent uncertainty, multi-LiDAR fusion (65% reduction), teleop trigger criteria |
| Multi-task unified perception | `technology/perception/multi-task-unified-perception.md` | UniAD (CVPR 2023 Best Paper), SparseDrive (3x faster), VAD-Tiny (80ms Orin), StreamPETR, shared-backbone multi-head (14.8ms on Orin, 56% savings), task interference/PCGrad, uncertainty-weighted loss, incremental deployment, 14-class airside segmentation |
| Night operations & thermal fusion | `technology/perception/night-operations-thermal-fusion.md` | LiDAR-primary + thermal-augmented architecture, YOLO-Thermal INT8 (6-8ms Orin), asymmetric late fusion (+8-10ms), hi-vis paradox solved (84-88% camera AEB failure → 85-92% thermal AP), heated-target calibration (<0.5deg), jet blast/fuel spill thermal detection, night ODD (subset of daytime), DINOv2 LoRA thermal adapter, 22.8-25.8ms total pipeline (38-44 Hz), $6,700-22,600/vehicle |
| Streaming temporal perception | `technology/perception/streaming-temporal-perception.md` | StreamPETR (+6-8% NDS, <3ms overhead, implicit tracking), Sparse4D v3 (71.9% NDS SOTA), multi-sweep LiDAR accumulation (3-sweep: +2.5% mAP, +1.4ms), latency compensation (ASAP/LASP), temporal filtering eliminates transient noise (de-icing spray, jet blast shimmer), extended airside track persistence (10-30s for GSE occlusion), video backbones vs query propagation, turnaround phase detection, $38K/13 weeks |
| Active perception & sensor scheduling | `technology/perception/active-perception-sensor-scheduling.md` | Context-aware model switching (35-45% compute reduction), information-theoretic sensor selection (entropy-based attention), foveated LiDAR (89% voxel reduction), multi-LiDAR scheduling (3-4 of 8 LiDARs full at any time), early exit networks (48% average compute), risk-aware allocation (safety-critical always first), planner-guided attention, 30-36% power savings for electric GSE, $25-40K/10 weeks |

#### Method-level SLAM
| Topic | Primary | Supporting |
|-------|---------|-----------|
| SLAM method library | `technology/localization/slam/overview.md` | 59 focused files covering classical, LiDAR, visual, RGB-D, neural, Gaussian, radar, and fusion SLAM |
| SLAM coverage audit | `technology/localization/slam/coverage-audit-2026.md` | Source-backed P0/P1/P2 backlog for missing methods: LVI-SAM, FAST-LIVO/R3LIVE, KISS-SLAM, MOLA, robust global registration, Scan Context, LiDAR BA/BALM, radar RIO, BAD SLAM, OKVIS/ROVIO/BASALT, COLMAP, SLAM3R/VGGT |
| AV / indoor / outdoor selection | `technology/localization/slam/av-indoor-outdoor-decision-matrix.md` | Method fit by GNSS availability, dynamics, map dependence, compute budget, and safety criticality |
| Benchmarks and datasets | `technology/localization/slam/benchmarking-metrics-datasets.md` | ATE/RPE, KITTI drift, loop closure, map quality, dynamic-scene metrics, KITTI/KITTI-360, EuRoC, TUM, Oxford, Boreas, MulRan |
| Open-source stacks | `technology/localization/slam/open-source-stack-comparison.md` | ORB-SLAM3, RTAB-Map, Cartographer, OpenVINS, Kimera, KISS-ICP, LIO-SAM, FAST-LIO2, GLIM, GTSAM, Open3D |
| Classical SLAM foundations | `technology/localization/slam/graphslam-pose-graph-optimization.md` | `ekf-slam.md`, `fastslam-particle-slam.md`, `bundle-adjustment-slam.md`, `factor-graph-isam2-gtsam.md`, `loop-closure-place-recognition.md`, `occupancy-grid-tsdf-esdf-mapping.md` |
| Point-cloud registration | `technology/localization/slam/gicp-vgicp.md` | `icp.md`, `point-to-plane-icp.md`, `ndt.md`, `continuous-time-registration.md` |
| 3D LiDAR SLAM | `technology/localization/slam/kiss-icp.md` | `loam.md`, `lego-loam.md`, `hdl-graph-slam.md`, `ct-icp.md`, `lio-sam.md`, `fast-lio-fast-lio2.md`, `point-lio.md`, `glim.md`, `cartographer-3d.md`, `suma.md` |
| Visual and visual-inertial SLAM | `technology/localization/slam/orb-slam2-orb-slam3.md` | `lsd-slam-dso.md`, `svo.md`, `vins-mono-vins-fusion.md`, `openvins.md`, `kimera-vio.md`, `droid-slam.md`, `dpvo.md`, `mast3r-slam.md` |
| Indoor and dense SLAM | `technology/localization/slam/rtab-map.md` | `kinectfusion.md`, `elasticfusion.md`, `bundlefusion.md`, `imap.md`, `nice-slam.md`, `co-slam-eslam.md`, `nerf-slam.md` |
| Learned, semantic, and Gaussian SLAM | `technology/localization/slam/splatam.md` | `lo-net-learned-lidar-odometry.md`, `regformer-learned-registration.md`, `semantic-slam.md`, `dynamic-object-aware-slam.md`, `object-level-slam.md`, `gs-slam-monogs.md`, `photo-slam.md` |
| Outdoor Gaussian and radar SLAM | `technology/localization/slam/splat-loam.md` | `gigaslam.md`, `wildgs-slam.md`, `radar-odometry-radar-slam.md`, `radar-inertial-odometry.md`, `radar-lidar-inertial-fusion.md` |

#### Localization & mapping
| Topic | Primary | Supporting |
|-------|---------|-----------|
| Mapping & localization overview | `technology/localization/mapping-and-localization.md` | MapTR, NMP, Tesla/Mobileye, SLAM |
| Map-free driving for airports | `technology/localization/map-free-driving.md` | Three-layer map, AIXM prior, 10-25x faster deployment |
| HD map standards (airside) | `technology/localization/hd-map-standards-airside.md` | OpenDRIVE, AMDB/AMXM, NDS, NOTAM integration, AIRAC cycle |
| Neural online mapping SOTA | `technology/localization/neural-online-mapping-sota.md` | MapTracker, StreamMapNet, NMP, topology (TopoMLP, LaneSegNet) |
| LiDAR SLAM algorithms | `technology/localization/lidar-slam-algorithms.md` | KISS-ICP, LIO-SAM, FAST-LIO2, Point-LIO, degeneracy handling |
| Semantic mapping & learned priors | `technology/localization/semantic-mapping-learned-priors.md` | Neural Map Prior (NMP +5.4 mAP), PriorDrive, T2SG topology graphs, conformal map uncertainty, fleet-based incremental updates, 7-layer semantic map, multi-airport LoRA adapters |
| HD map change detection & maintenance | `technology/localization/hd-map-change-detection-maintenance.md` | Point cloud differencing, semantic change detection, RTMap (ICCV 2025 centimeter-level), Bayesian fleet consensus, AIRAC integration, temporal decay models, light-map alternative (~720 KB), NMP implicit maintenance, OTA canary deployment, construction zone detection, cost 60-80% reduction vs manual re-survey, $45-70K/28 weeks |
| LiDAR place recognition & re-localization | `technology/localization/lidar-place-recognition-relocalization.md` | Scan Context (<5ms CPU) + MinkLoc3D (97.5% recall@1, 15ms GPU) two-stage pipeline, PointNetVLAD, LoGG3D-Net, LCDNet (integrated pose), PPT few-shot, BEVPlace, FAISS million-scale retrieval (<1ms), GTSAM loop closure factors, kidnapped robot recovery, fleet shared descriptors, identical-stands disambiguation, seasonal databases, $33-57K/12-16 weeks |
| Robust state estimation & multi-sensor fusion | `technology/localization/robust-state-estimation-multi-sensor.md` | ESKF (Error-State Kalman Filter) with quaternion error parameterization, chi-squared innovation gating, Mahalanobis sensor validation, multi-hypothesis tracking (IMM), GPS-denied dead-reckoning budgets, adaptive noise estimation (Sage-Husa), covariance management, fleet-level state consistency, <0.5ms per update on Orin, robot_localization integration |
| Real-time occupancy grid mapping | `technology/localization/realtime-occupancy-grid-mapping.md` | Log-odds Bayesian update, OctoMap/VDBFusion/nvblox comparison, GPU raycasting (CUDA), multi-LiDAR fusion (4-8 sensors at 10Hz), dynamic object separation, multi-resolution grids (0.1-0.8m), TSDF/ESDF for planning, costmap generation for Frenet planner, fleet-shared occupancy over 5G, airside-specific (aircraft stands, jet blast), $25-40K |
| HD map construction pipeline | `technology/localization/map-construction-pipeline.md` | End-to-end offline map building: survey drive planning (3 drive patterns), multi-session SLAM (FAST-LIO2+GTSAM), point cloud post-processing (dynamic object removal via multi-session voting), geodetic alignment (RTK+GCPs ±5-10cm global), AMDB overlay and co-registration, automated annotation (SAM+CLIP 85-92% accuracy), Lanelet2 generation, QA validation (20 automated checks), map packaging and OTA deployment, DVC version control, map CI/CD pipeline, 5-7 days per airport at $20-35K, scaling to $12-19K/airport at 20 airports |
| Production LiDAR-to-map localization | `technology/localization/production-lidar-map-localization.md` | Runtime scan-to-map matching pipeline: ICP/GICP/VGICP/NDT algorithm comparison, multi-resolution coarse-to-fine (NDT→VGICP), eigenvalue-based degeneracy detection and handling, airside-specific challenges (40-70% dynamic content at stands, jet blast shimmer, ground reflectivity), multi-LiDAR fusion strategies (merge-then-match, match-then-fuse, selective), GTSAM factor graph integration with adaptive noise models, 5-level fallback hierarchy (VGICP→NDT→GPS→dead reckoning→safe stop), learned registration (GeoTransformer for cold start), Orin GPU deployment (15-25ms typical), $30-53K/12 weeks |
| Map tile versioning & distribution | `technology/localization/map-tile-versioning-distribution.md` | Map lifecycle from build to vehicle: spatial tiling (50-200m tiles), content-addressable versioning (SHA-256 Merkle tree), differential updates (bsdiff, 2-8% of full tile), distribution over airport 5G (<30s/tile), NVMe vehicle-side storage, atomic map swap protocol (zero perception gaps), AIRAC 28-day cycle integration, cryptographic signing (Ed25519), fleet version synchronization, in-flight consistency, <500 MB/month fleet updates, $40-65K/14 weeks |

#### Hardware
| Topic | Primary | Supporting |
|-------|---------|-----------|
| NVIDIA Orin | `hardware/compute/nvidia-orin-technical.md` | 275 TOPS, 8 power modes, benchmarks |
| NVIDIA Thor | `hardware/compute/nvidia-drive-thor.md` | ~1000 TOPS, FP8, OEM commitments |
| TensorRT deployment | `hardware/compute/tensorrt-deployment-guide.md` | DLA, quantization, Lidar_AI_Solution |
| Hesai LiDAR | `hardware/sensors/hesai-lidar.md` | XT32, AT128 ASIL-B, FMC500 SoC |
| RoboSense LiDAR | `hardware/sensors/robosense-lidar.md` | RSHELIOS, RSBP, 7-sensor layout |
| 4D radar | `hardware/sensors/4d-radar.md` | Continental ARS548, weather immunity |
| Thermal/IR cameras | `hardware/sensors/thermal-ir-cameras.md` | FLIR Boson 640, LWIR fusion, night personnel, jet blast |
| Multi-LiDAR calibration | `hardware/sensors/multi-lidar-calibration.md` | Target-based + targetless (ICP, feature, learning-based), GTSAM-integrated online refinement, thermal drift compensation (-10C to +50C), PTP/PPS synchronization, overlap optimization for 4-8 RoboSense, calibration health monitoring, ISO 3691-4 traceability, 400-800h/year labor savings for 20+ vehicle fleet |
| Sensor degradation & health monitoring | `hardware/sensors/sensor-degradation-health-monitoring.md` | Degradation taxonomy (optical/mechanical/environmental/electronic), 10 airside contamination sources, per-sensor diagnostics (LiDAR 7-check, radar SNR/coverage, thermal NUC/dead pixel, camera exposure/blur), cross-sensor consistency scoring, EMA-based temporal tracking with z-score anomaly, response matrix (4 sensors × 4 severity), fleet health analytics (zone correlation, seasonal patterns), predictive maintenance (linear extrapolation), cleaning schedules, 1 Hz ROS monitoring at <2ms, $35K/11 weeks |
| Automated sensor cleaning | `hardware/sensors/automated-sensor-cleaning.md` | Physical self-maintenance for 16-20 hr/day tarmac ops: cleaning modality comparison (air curtains, air burst, wipers, washer fluid, ultrasonic, heated windows, hydrophobic coatings, UV photocatalytic), contamination-to-cleaning mapping (de-icing glycol requires chemical cleaning — air jets spread it), per-sensor architecture (germanium thermal windows air-only, no wipers), health monitor closed-loop integration, power/weight budget (15-40W, 1.5-3.0 kg), $200-500/vehicle hardware, 15-25% availability improvement, 60-80% fewer depot cleaning visits |
| Solid-state LiDAR & photonics | `hardware/sensors/solid-state-lidar-photonics.md` | FMCW vs ToF measurement principles, silicon photonics integration (SiPh LiDAR-on-chip), OPA beam steering (GHz point-to-point, 0.01-0.05° angular resolution), MEMS mirror reliability, flash LiDAR for docking, per-point velocity (jet blast detection, zero-latency approaching-object detection), 1550nm eye safety (100x margin), Aeva Atlas/Voyant Helium/SiLC comparison, 50-200x longer MTBF (100K+ hrs), $150-450K/year fleet savings, Orin GTSAM velocity factor, adaptive resolution for active perception, phased migration strategy, $110-175K over 48 weeks |
| Energy-efficient inference 24/7 | `hardware/compute/energy-efficient-inference-24-7.md` | Orin 15W/30W/50W power modes vs throughput, dynamic model switching (40-60% time in low-complexity), thermal throttling curves (-10C to +50C tarmac), battery-aware compute (SoC-correlated power budgets), DLA+GPU concurrent scheduling, per-model watt measurements, sleep/wake with <500ms wake-up, fleet-level energy optimization, 8-15% more daily operating hours, 12-18C lower junction temp |
| Edge-cloud hybrid inference | `hardware/compute/edge-cloud-hybrid-inference.md` | Three-tier architecture (on-vehicle Orin + airport MEC edge + cloud), model placement decision framework, split inference patterns, bandwidth/latency analysis, NVIDIA Triton on edge servers, graceful degradation (vehicle always autonomous), security, cost-benefit ($2,500/vehicle for shared edge vs $2,000-5,000 per Thor upgrade), industry approaches, airport advantage (bounded geography + private 5G) |
| Airport 5G | `hardware/connectivity/airport-5g-cbrs.md` | `hardware/connectivity/airport-5g-case-studies.md` |
| Deterministic networking (TSN) | `hardware/connectivity/deterministic-networking-tsn.md` | IEEE 802.1 TSN standards (gPTP <100ns sync, TAS time-aware scheduling, FRER redundancy, frame preemption), mixed-criticality traffic classes (safety <100μs, sensors <5ms, best-effort), CAN bus migration (50-200x latency improvement for safety messages), zonal architecture, automotive TSN silicon (NXP SJA1110, Marvell 88Q6113), CAN-TSN gateway (NXP S32G3), 5G TSN bridge for V2X, Orin native TSN support, ASIL decomposition via TSN isolation, $230-440/vehicle hardware, $53-87K implementation |

#### Safety & certification
| Topic | Primary | Supporting |
|-------|---------|-----------|
| ISO 3691-4 | `operations/safety/iso-3691-4-deep-dive.md` | 27 functions, $130K-380K |
| Full certification guide | `operations/safety/certification-guide.md` | UL 4600, AMLAS, ISO 26262 |
| Regulatory trajectory | `operations/safety/regulatory-trajectory-deep-dive.md` | FAA, EASA, CAAS, predicted timeline |
| Safety incidents | `operations/safety/safety-incidents-lessons.md` | Cruise, Waymo, Tesla, Uber ATG |
| Failure modes | `operations/safety/failure-modes-analysis.md` | SOTIF, hallucination taxonomy |
| Simplex architecture | `operations/safety/simplex-safety-architecture.md` | RSS, OOD detection, ROS dual-stack |
| Ground crew safety | `operations/safety/ground-crew-pedestrian-safety.md` | 27K accidents/yr, hi-vis paradox |
| Insurance & liability | `operations/safety/insurance-liability-airside.md` | EU PLD, $35M exposure |
| Functional safety software | `operations/safety/functional-safety-software.md` | MISRA C, ISO 26262 Part 6, static analysis, CI/CD, ROS safety patterns |
| Scenario taxonomy & edge cases | `operations/safety/airside-scenario-taxonomy.md` | ISO 34502 adapted for airside, SOTIF hazard catalog (H1-H8+), 115 functional scenarios, ODD definition, Pegasus 6-layer, STPA, risk matrix, regulatory mapping |
| Testing & validation methodology | `operations/safety/testing-validation-methodology.md` | V-model, scenario-based testing (ASAM OpenSCENARIO 2.0), coverage metrics (N-wise covering arrays), corner case/adversarial testing (CMA-ES falsification, LLM scenario generation, metamorphic testing), SIL/HIL/VIL, statistical safety (Zhao-Weng, Bayesian), shadow mode, regression/CI/CD, digital twin, airside test protocols, $105K first airport |
| Runtime verification & monitoring | `operations/safety/runtime-verification-monitoring.md` | STL monitors (<1ms, 20 airside specs), OOD detection (energy+Mahalanobis+ensemble, 95-98% AUROC), maximally permissive shields (1-5% intervention), safety MCU (STM32H725), METAR ODD monitoring, WCET <5.5ms, ISO 26262 ASIL decomposition, UL 4600 compliance, DO-178C credit, fleet anomaly correlation, $115-200K/32 weeks |
| Online perception monitoring & ODD enforcement | `operations/safety/online-perception-monitoring-odd-enforcement.md` | ML-specific silent degradation detection (domain shift, model staleness, adversarial natural conditions), input distribution monitoring (KL divergence, MMD on backbone features), output consistency checking (CUSUM/EWMA on detection counts, class distributions, tracking metrics), cross-modal consistency (LiDAR vs radar vs camera agreement), OOD detection integration (energy + Mahalanobis), ODD boundary state machine (NORMAL→DEGRADED→RESTRICTED→SUSPENDED with hysteresis), Perception Health Score (Bayesian fusion of monitors), calibration drift detection, temporal anomaly detection, <5ms total on Orin, ISO 3691-4/UL 4600/EU AI Act compliance |
| Formal verification of neural networks | `operations/safety/formal-verification-neural-networks.md` | SMT/MILP complete verification (<100K params), alpha-beta-CROWN over-approximation (millions of params, VNN-COMP winner), IBP/SABR certified training, Lipschitz bounds for safety margins, layered strategy: complete for safety-critical (policy, CBF, Simplex), scalable for perception (PointPillars, CenterPoint), runtime for residual, ISO 3691-4/UL 4600/EU AI Act compliance |
| Fail-operational architecture | `operations/safety/fail-operational-architecture.md` | 1oo2D, TMR, monitor-actuator patterns, dual-Orin compute, Orin FSI (DCLS R52), ASIL decomposition, sensor/actuator/power/CAN redundancy, degradation tiers, MRC planning, airside-specific (runway incursion HW geofence, jet blast hardening, EMI), $155-260K phased implementation |
| Weather-adaptive ODD management | `operations/safety/weather-adaptive-odd-management.md` | 5-level ODD (A-E) with asymmetric transitions (fast degradation, slow recovery), METAR/TAF/ATIS automated parsing, on-vehicle environmental sensing (LiDAR return rate→visibility), fleet consensus, capability curves (sensor performance vs weather), continuous speed envelope, jet blast zone integration (ADS-B+thermal), seasonal adaptation profiles, dawn/dusk transition management, ISO 34502/21448/3691-4 compliance, EU AI Act transparency, $30-50K/8-12 weeks |

#### Planning, VLA & scene understanding
| Topic | Primary | Supporting |
|-------|---------|-----------|
| VLA for driving | `technology/vla/vla-for-driving.md` | Alpamayo, RT-2, PaLM-E, teacher-student distillation |
| Alpamayo setup | `technology/vla/alpamayo-camera-only.md` | Camera-only, non-commercial, 10B params |
| VLM scene understanding | `technology/vla/vlm-scene-understanding.md` | DriveVLM, DriveLM, NOTAM interpretation, turnaround assessment, FOD classification, VLM as 1-2Hz co-pilot |
| Spatial foundation models | `technology/vla/spatial-foundation-models-airport.md` | 4M unified multimodal, SpatialVLM spatial reasoning, RT-2/RT-X robotics transformers, Octo open-source policy, pi0 flow matching, HPT cross-embodiment, precision docking with spatial VLMs, gate identification, FOD detection/characterization, two-tier deployment (cloud+edge), distillation for Orin, in-context learning for new airports, Simplex integration, $55-95K phased |
| Neural motion planning | `technology/planning/neural-motion-planning.md` | SparseDrive, DiffusionDrive, GameFormer, Simplex safety integration |
| Frenet augmentation | `technology/planning/frenet-augmentation.md` | Augmenting Aurrigo's existing planner |
| Motion prediction | `technology/planning/motion-prediction.md` | Trajectory prediction, interaction modeling |
| LLM reasoning for planning | `technology/planning/llm-reasoning-driving.md` | Chain-of-thought, interpretable decisions |
| Diffusion trajectory planning | `technology/planning/diffusion-trajectory-planning.md` | Diffusion-based motion generation |
| Safety-critical planning (CBF) | `technology/planning/safety-critical-planning-cbf.md` | Control Barrier Functions, CBF-QP safety filter, neural CBF synthesis, game-theoretic interaction (GameFormer, GIME), multi-agent CBFs (GCBF+), HJ reachability, CBF-Simplex integration, airside safety formulations |
| Neuro-symbolic scene graphs | `technology/planning/neuro-symbolic-scene-graphs.md` | Driving scene graphs, GNN interaction (LaneGCN, HiVT, HDGT), knowledge graphs for traffic rules, STL-constrained planning, compositional reasoning, LLM-symbolic hybrid, airside right-of-way encoding, NOTAM rule injection, interpretable decisions |
| Causal reasoning & counterfactuals | `technology/planning/causal-reasoning-counterfactual.md` | SCMs for driving, Pearl's 3 levels, counterfactual trajectory analysis, Halpern-Pearl causation, NOTEARS causal discovery, IRM cross-airport transfer, off-policy evaluation, LLM+SCM hybrid, KING counterfactual generation, EU PLD 2024/2853 compliance, causal ROS node at 2 Hz, $40-65K Phase 1+2 |
| RL driving policy | `technology/planning/reinforcement-learning-driving-policy.md` | CaRL (CoRL 2025 SOTA, PPO + simple rewards), IQL (best offline RL), SAC/TD3/TQC/CrossQ, BC→offline RL→online RL pipeline, safe RL (CPO, Lagrangian, CBF filter), privileged-to-sensor distillation, policy head <0.5ms Orin, $45-75K/32 weeks |
| Imitation learning & behavioral cloning | `technology/planning/imitation-learning-behavioral-cloning.md` | BC from teleop, MDN multimodal BC, Diffusion BC (DDIM 3-5 steps), DAgger with Frenet expert, MaxEnt IRL cost learning, GAIL, style-conditioned multi-operator BC, CBF safety filtering, Simplex integration, $35-55K/10-14 weeks |
| Joint prediction-planning | `technology/planning/joint-prediction-planning.md` | Predict-then-plan failure modes, PDM-Closed baseline, conditional prediction, game-theoretic (Stackelberg, level-K), contingency planning, occupancy flow scoring, NAVSIM/nuPlan benchmarks, Frenet planner augmentation with prediction costs, airside interaction modeling, 50-100ms on Orin |
| Autonomous docking & precision positioning | `technology/planning/autonomous-docking-precision-positioning.md` | Two-phase architecture (coarse Frenet → fine docking), visual servoing (IBVS/PBVS), LiDAR ICP template alignment (+-1-2cm), AprilTag fiducials (+-0.5cm at 2m), MPC docking controller (CasADi 2-5ms), impedance control for pushback contact, per-GSE tolerances (+-5cm belt loader to +-30cm fuel truck), ADT3 crab steering advantage, safety PLC + personnel exclusion zones, 20 key takeaways, $53-90K/12-18 weeks |

#### Airport operations
| Topic | Primary | Supporting |
|-------|---------|-----------|
| Industry overview | `operations/airside/industry-overview.md` | All competitors, regulatory gaps |
| Airport data APIs | `operations/airside/airport-data-integration.md` | `operations/airside/airport-data-systems-detailed.md` (real endpoints) |
| FOD & jet blast | `operations/airside/fod-and-jetblast.md` | B737 148m zone, CFD tables |
| Turnaround prediction | `operations/airside/turnaround-prediction.md` | Moonware HALO, Assaia |
| Pushback systems | `operations/airside/pushback-systems.md` | Mototok, TaxiBot, WheelTug |
| Electric GSE market | `operations/airside/electric-gse-market.md` | $2.8B→$5.2B, autonomy rankings |
| Aviation ecosystem | `operations/airside/aviation-ground-ops-ecosystem.md` | Strategic context, business case |
| Battery & charging | `operations/airside/battery-charging-infrastructure.md` | LiFePO4, 0.84yr payback, autonomous self-charging |
| Ground control instructions | `operations/airside/ground-control-instructions.md` | A-CDM/A-SMGCS integration, D-TAXI, NOTAM parsing, marshaller gesture recognition, NLU, instruction-to-trajectory |

#### Deployment & operations
| Topic | Primary | Supporting |
|-------|---------|-----------|
| Deployment playbook | `operations/deployment/deployment-playbook.md` | 4,500 lines, full checklists |
| Shadow mode | `operations/deployment/shadow-mode.md` | Tesla/Waymo/comma approaches |
| OTA & fleet management | `operations/deployment/ota-fleet-management.md` | Canary deployment, A/B testing |
| Production ML | `operations/deployment/production-ml-deployment.md` | TensorRT, Triton, GPU reliability |
| Fleet dispatch | `operations/deployment/fleet-management-dispatch.md` | VRPTW, A-CDM triggers |
| Multi-airport adaptation | `operations/deployment/multi-airport-adaptation.md` | AMDB bootstrapping, PointLoRA fine-tuning (500 labels), GNSS multipath mapping, 8-week onboarding, $75-150K per airport |
| HMI & operator interface | `operations/deployment/hmi-operator-interface.md` | Dashboard design, trust calibration, 4-mode control, handoff procedures, operator training, incident reporting |
| Teleoperation | `operations/teleoperation/teleoperation-systems.md` | Fernride, Waymo 1:41 ratio |
| Workforce transition | `operations/deployment/workforce-transition.md` | 1.5-2M workers affected, union considerations, retraining |
| CI/CD & DevOps pipeline | `operations/deployment/av-cicd-devops-pipeline.md` | End-to-end AV CI/CD: code CI (MISRA, static analysis), ML model CI (DVC, TensorRT optimization), SIL/HIL/VIL simulation gates, map/config CI, artifact versioning, fleet deployment (canary, staged rollout), ML regression detection, safety assurance integration, airside-specific pipeline requirements, industry approaches |
| Fleet TCO & business case | `operations/deployment/fleet-tco-business-case.md` | Per-vehicle CAPEX ($95-210K floor), OPEX breakdown, 3-shift labor savings ($150K/year), NPV $45-80M at 200 vehicles, break-even Year 2-4, RaaS $10-14K/month, certification cost $530K-1.95M across 5 jurisdictions, UISEE 40-60% cost advantage threat, airport cluster strategy |
| EV fleet energy co-optimization | `operations/deployment/ev-fleet-energy-co-optimization.md` | Joint charging-routing-task EVRP optimization, LiFePO4 degradation models (cycle counting, throughput, temperature), optimal C-rate selection, V2G for airports (~1-2 MWh dispatchable storage, $50-200/MWh demand response), grid-aware scheduling (demand charge management), stochastic EVRP under uncertainty, MILP/RL/MPC approaches, OCPP 2.0.1 integration |
| Fleet anomaly root-cause attribution | `operations/deployment/fleet-anomaly-root-cause-attribution.md` | Automated causal attribution for fleet-level anomalies: CUSUM/EWMA statistical monitoring, hierarchical anomaly detection (fleet→airport→vehicle→subsystem), causal discovery (NOTEARS, PC algorithm), Shapley-value attribution, Bayesian diagnosis trees, OTA regression detection, map staleness attribution, environmental correlation, streaming pipeline (Kafka/Flink), MTTR reduction |
| Fleet predictive maintenance | `operations/deployment/fleet-predictive-maintenance.md` | PHM framework (ISO 13381, 4-level architecture), Weibull failure analysis (LiDAR β=1.8-2.2/25-40K hrs, motors β=3.5/40-60K hrs), correlated failure modes (de-icing, salt spray, heat events), ML prediction (LSTM/XGBoost/autoencoder anomaly), multi-echelon spare parts inventory (4-level), cold-start sizing for new airports, joint maintenance-operations scheduling (CP-SAT), fleet availability modeling (95%+ vehicle, 98%+ fleet), seasonal profiles, ROS diagnostics integration, $7-19.5K/vehicle/year maintenance cost, 30-40% cost reduction with predictive vs reactive, $50-80K implementation |

#### Mathematical foundations
| Topic | Primary |
|-------|---------|
| PointPillars | `foundations/pointpillars.md` — tensor shapes, TensorRT |
| VQ-VAE / FSQ | `foundations/vqvae-tokenization.md` — straight-through estimator, codebook collapse |
| Transformers | `foundations/transformer-world-models.md` — causal attention, KV-cache, scaling laws |
| Diffusion models | `foundations/diffusion-models.md` — DDPM, DiT, flow matching |
| GTSAM | `foundations/gtsam-factor-graphs.md` — ISAM2, VGICP, neural factors |
| Lanelet2 | `foundations/lanelet2-maps.md` — airport extensions, AIXM conversion |
| Frenet planning | `foundations/frenet-trajectory-math.md` — Werling 2010, quintic polynomials |
| RTK/GPS/IMU | `foundations/rtk-gps-imu-localization.md` — preintegration, NTRIP |
| Mamba SSM | `foundations/mamba-ssm-for-driving.md` — DriveMamba, O(n) vs O(n²) |
| Theory | `foundations/theoretical-foundations.md` — POMDP, free energy, PAC bounds |
| Architecture | `foundations/architecture-innovations.md` — MoE, DiT, flow matching, FSQ |
| Sparse attention for 3D | `foundations/sparse-attention-3d-perception.md` — PTv3 serialized attention (80.4% mIoU, 3x faster), FlatFormer flattened windows (4.6x faster than SST), LitePT (CVPR 2026, 3.6x fewer params), SparseOcc, deformable attention, FlashAttention on Orin, TensorRT custom ops, hybrid SpConv+attention, multi-LiDAR cross-attention, window size 256-512 optimal for Orin |

#### Cross-cutting topics
| Topic | Primary |
|-------|---------|
| Sensor fusion | `cross-cutting/sensor-fusion-architectures.md` |
| Synthetic data | `cross-cutting/synthetic-data-generation.md` |
| Evaluation benchmarks | `cross-cutting/evaluation-benchmarks.md` |
| nuScenes/Waymo guide | `cross-cutting/nuscenes-waymo-practical-guide.md` |
| Transfer learning | `cross-cutting/transfer-learning.md` |
| ROS 2 migration | `cross-cutting/ros2-migration.md` |
| Autoware Universe | `cross-cutting/autoware-universe-deep-dive.md` |
| Open-source ecosystem | `cross-cutting/opensource-ecosystem.md` |
| Embodied AI crossover | `cross-cutting/embodied-ai-crossover.md` |
| Data engine from bags | `cross-cutting/data-engine-from-bags.md` |
| Continual learning | `cross-cutting/continual-learning.md` |
| 3D annotation tools | `cross-cutting/3d-annotation-tools.md` |
| Isaac ROS for airside | `cross-cutting/isaac-ros-for-airside.md` |
| Test-time adaptation | `technology/robustness/test-time-adaptation-airside.md` | TENT, CoTTA, SAR, SFDA, OOD detection, active learning, multi-airport deployment |
| Test-time training for airport onboarding | `technology/robustness/test-time-training-airport-onboarding.md` | TTT vs TTA distinction (gradient-based auxiliary tasks), TTT++ multi-head, TTT-MAE, TTT layers as RNN, online LoRA with MAE loss, LiDAR-specific TTT (point cloud MAE), safety-bounded TTT on Orin (compute budget), catastrophic forgetting prevention (EWC, anchor loss), Simplex integration (TTT as AC, frozen as BC), airport onboarding protocol, comparison with PointLoRA, $25-45K/10-14 weeks |
| Fleet data pipeline | `cross-cutting/fleet-data-pipeline.md` | RosBag management, DVC versioning, labeling workflows, fleet telemetry, storage costs |
| Data flywheel (closed-loop) | `cross-cutting/data-flywheel-airside.md` | Trigger-based collection (50GB/day budget), auto-labeling (70-85% cost reduction), active learning (40-50% fewer labels), model training orchestration, A/B testing, scenario mining, multi-airport LoRA, flywheel breakeven ~Month 18, mAP trajectory 45%→82% over 24 months |
| Radar-LiDAR fusion for adverse weather | `cross-cutting/radar-lidar-fusion-adverse-weather.md` | L4DR (AAAI 2025, +20% mAP dense fog), Continental ARS548 4D radar ($500-1500), asymmetric mid-level fusion (LiDAR-primary, radar-augmented), radar-guided densification, cross-attention LiDAR→radar, adaptive fusion gating (weather-aware weights), de-icing spray detection, track-level Kalman fusion, 4-mode degradation management (NORMAL→EMERGENCY), ROS integration, $35-55K/12 weeks |
| Federated learning (fleet) | `cross-cutting/federated-learning-fleet.md` | FedAvg/FedProx/SCAFFOLD, hybrid centralized+federated LoRA (97% comm reduction), FedBN for multi-airport, on-vehicle Orin LoRA training, DP privacy (epsilon 10-50), Byzantine-robust FLTrust, federated continual learning, hierarchical aggregation, FedDF for heterogeneous models, Flower/FLARE, break-even ~10 airports, $130K/year at 50 airports vs $1.3M centralized |
| LiDAR data augmentation | `cross-cutting/lidar-data-augmentation.md` | GT-database sampling (+15-25% rare class AP), 3D copy-paste, PolarMix (CVPR 2022, +3-7% mAP), LaserMix (CVPR 2023), LiDAR corruptions (rain/fog/beam dropout/de-icing), intensity augmentation, class-balanced sampling with safety priority, cross-airport GT database sharing, 40-60% labeling reduction ($15-45K savings/airport) |
| Cloud backend infrastructure | `cross-cutting/cloud-backend-infrastructure.md` | Fleet data backend: three-zone data lake (Raw/Bronze → Processed/Silver → Curated/Gold), S3 event-driven ingestion (Lambda), streaming telemetry (MQTT→IoT Core→TimeStream→Grafana), Apache Airflow DAG catalog (7 DAGs), rosbag processing K8s jobs, feature store (Feast), auto-labeling pipeline integration, map construction data flow, multi-airport data isolation, cost modeling ($200-460/vehicle/month), monitoring/observability, $80-135K/28 weeks |
| On-vehicle data triage & upload | `cross-cutting/on-vehicle-data-triage-selective-upload.md` | Vehicle-side data management: multi-tier ring buffers (LiDAR/camera/IMU/CAN/GTSAM, NVMe 1-4TB), event-triggered clip extraction (safety events, perception anomalies, localization failures, operator flags), edge scenario classification (lightweight CNN/DLA), bandwidth-aware upload scheduling (priority queue, 50GB/day budget), compression (LZ4 point clouds, H.265 camera, delta poses), rosbag split/trim/mcap, active learning integration, fleet upload coordination (deduplication, coverage diversity), GDPR camera data handling, ROS node architecture |

---

#### Synthesis & strategy
| Topic | Primary |
|-------|---------|
| Master synthesis | `synthesis/master-synthesis.md` — Executive summary, tiered recommendations |
| Design spec | `synthesis/design-spec.md` — 891-line Simplex architecture |
| POC proposals | `synthesis/poc-proposals.md` — 8 models with code and costs |
| Competitive landscape | `synthesis/competitive-landscape.md` — All players compared, strategic quadrant |
| Technology readiness | `synthesis/technology-readiness.md` — TRL per POC, go/no-go criteria |
| Getting started | `synthesis/getting-started.md` — Day 1 guide with runnable code |

---

## Recently Added (Latest Sessions)

| Document | Key Contribution |
|----------|-----------------|
| `technology/localization/production-lidar-map-localization.md` | Production scan-to-map matching: VGICP/NDT/ICP comparison, multi-resolution coarse-to-fine, eigenvalue degeneracy detection, multi-LiDAR fusion strategies, GTSAM adaptive noise, 5-level fallback, GeoTransformer cold start, 15-25ms Orin, $30-53K |
| `cross-cutting/on-vehicle-data-triage-selective-upload.md` | Vehicle-side data management: ring buffers (NVMe 1-4TB), event-triggered clips (safety/perception/localization), edge scenario classification, bandwidth-aware upload (50GB/day), compression, rosbag/mcap, fleet upload coordination, active learning integration |
| `operations/safety/online-perception-monitoring-odd-enforcement.md` | ML silent degradation detection: input distribution monitoring, output consistency (CUSUM/EWMA), cross-modal agreement, OOD integration, ODD state machine with hysteresis, Perception Health Score, calibration drift, temporal anomaly, <5ms on Orin |
| `technology/localization/map-tile-versioning-distribution.md` | Map distribution lifecycle: spatial tiling, content-addressable versioning (Merkle tree), differential updates (2-8% of full tile), atomic swap protocol, AIRAC integration, cryptographic signing, fleet synchronization, <500 MB/month |
| `operations/deployment/ev-fleet-energy-co-optimization.md` | Joint EV fleet energy co-optimization: EVRP formulation, LiFePO4 degradation, V2G demand response ($50-200/MWh), grid-aware scheduling, stochastic optimization, MILP/RL/MPC, OCPP 2.0.1 |
| `technology/multi-agent/ramp-traffic-conflict-deadlock-prevention.md` | Ramp traffic coordination: zone-capacity graph, reservation protocol, wait-die deadlock prevention, 9-level priority, stand sequencing, V2X fallback, MAPF (CBS/PIBT), $50-75K |
| `technology/robustness/test-time-training-airport-onboarding.md` | TTT for rapid airport onboarding: gradient-based auxiliary tasks, TTT-MAE, online LoRA, safety-bounded on Orin, catastrophic forgetting prevention, Simplex integration |
| `operations/deployment/fleet-anomaly-root-cause-attribution.md` | Fleet anomaly attribution: CUSUM/EWMA monitoring, causal discovery (NOTEARS), Shapley values, Bayesian diagnosis, OTA regression, map staleness, environmental correlation |
| `cross-cutting/cloud-backend-infrastructure.md` | Fleet data backend: three-zone data lake, S3+Lambda ingestion, MQTT streaming telemetry, Airflow orchestration, rosbag K8s processing, Feast feature store, auto-labeling, multi-airport isolation, $200-460/vehicle/month |
| `technology/localization/map-construction-pipeline.md` | End-to-end HD map construction: survey drives → multi-session SLAM → alignment → annotation → Lanelet2 → QA → deployment. 5-7 days at $20-35K per airport, AMDB bootstrap, SAM+CLIP auto-annotation |
| `hardware/compute/edge-cloud-hybrid-inference.md` | Three-tier compute (vehicle+edge+cloud): model placement, split inference, graceful degradation, Triton edge server, $2,500/vehicle shared edge, airport private 5G advantage |
| `hardware/sensors/automated-sensor-cleaning.md` | Physical self-maintenance: air curtains + burst + washer + wiper + heated windows, contamination mapping, germanium-safe thermal cleaning, health monitor closed-loop, $200-500/vehicle, 15-25% availability gain |
| `hardware/sensors/solid-state-lidar-photonics.md` | Solid-state LiDAR: FMCW per-point velocity, silicon photonics OPA, Voyant Helium/Aeva Atlas/SiLC comparison, 100K+ hr MTBF, 1550nm eye safety, $150-450K/year fleet savings, phased migration strategy |
| `hardware/connectivity/deterministic-networking-tsn.md` | Deterministic networking: IEEE 802.1 TSN (gPTP <100ns, TAS scheduling, FRER redundancy), safety messages <10μs (50-200x faster than CAN), mixed-criticality scheduling, CAN-TSN gateway, 5G TSN bridge, $230-440/vehicle |
| `technology/vla/spatial-foundation-models-airport.md` | Spatial foundation models: 4M, SpatialVLM, RT-2/Octo/pi0 for airport robotics, precision docking, FOD characterization, two-tier cloud+edge deployment, distillation for Orin |
| `operations/deployment/fleet-predictive-maintenance.md` | Fleet predictive maintenance: PHM framework, Weibull failure models, correlated airside failures, ML prediction, multi-echelon spare parts, cold-start sizing, joint scheduling, fleet availability modeling, 30-40% cost reduction |
| `technology/planning/imitation-learning-behavioral-cloning.md` | IL for airside: BC from teleop (BEV+GRU), MDN multimodal, Diffusion BC (DDIM 3-5 steps, 15-30ms Orin), DAgger with Frenet expert, MaxEnt IRL cost learning, GAIL, style-conditioned multi-operator, CBF post-processing, Simplex three integration modes, $35-55K |
| `technology/planning/joint-prediction-planning.md` | Joint prediction-planning: PDM-Closed baseline, conditional prediction, game-theoretic (Stackelberg, level-K), contingency planning, occupancy flow scoring, NAVSIM/nuPlan, Frenet augmentation with prediction costs (70-80% benefit at 10% cost) |
| `operations/safety/fail-operational-architecture.md` | Fail-operational HW redundancy: 1oo2D, TMR, monitor-actuator, dual-Orin + FSI (DCLS R52 ASIL D), ASIL decomposition (ASIL B(D) + ASIL B(D)), sensor/actuator/power/CAN redundancy, degradation tiers (T0-T5), MRC planning, runway incursion HW geofence, $155-260K phased |
| `operations/deployment/av-cicd-devops-pipeline.md` | AV CI/CD pipeline: code CI (MISRA/static analysis), ML model CI (DVC/TensorRT), SIL/HIL/VIL simulation gates, map/config CI, artifact versioning, fleet deployment (canary rollout), ML regression detection, safety assurance, airside-specific requirements |
| `technology/multi-agent/fleet-task-allocation-scheduling.md` | Fleet GSE scheduling: MILP/CP-SAT optimal, CBBA decentralized, A-CDM predictive, RL dispatch, charging-aware, multi-objective |
| `operations/safety/weather-adaptive-odd-management.md` | 5-level ODD with METAR/TAF/sensor fusion, capability curves, continuous speed envelope, jet blast zones, seasonal profiles |
| `technology/localization/robust-state-estimation-multi-sensor.md` | ESKF deep dive, chi-squared gating, multi-hypothesis IMM, GPS-denied budgets, fleet state consistency, <0.5ms on Orin |
| `technology/localization/realtime-occupancy-grid-mapping.md` | Log-odds occupancy, GPU raycasting, multi-LiDAR fusion, nvblox/VDBFusion, TSDF/ESDF, fleet-shared grids, costmap for Frenet |
| `cross-cutting/fleet-data-pipeline.md` | End-to-end fleet data: 200GB/day/vehicle, DVC versioning, rosbag processing, labeling workflows ($15-45/frame), fleet telemetry (Grafana), storage tiers, 5-100 vehicle scaling |
| `technology/simulation/sim-to-real-transfer-airside.md` | Sim-to-real for airside: LiDAR simulation fidelity, domain randomization, UniSim/LidarDM, curriculum learning, reality gap measurement, CARLA/Isaac airport env, $50-75K first airport |
| `technology/robustness/test-time-adaptation-airside.md` | TTA/domain adaptation for multi-airport: TENT, CoTTA, SAR, SFDA (SHOT/NRC), OOD triggers, active learning, LiDAR-specific adaptation, fleet-scale strategy, per-airport cost |
| `technology/perception/lidar-semantic-segmentation.md` | LiDAR segmentation SOTA: Cylinder3D, FlatFormer, PTv3, SalsaNext; ALPINE training-free panoptic; 18-class airside taxonomy; Orin real-time (18-35ms); PointLoRA fine-tuning path |
| `technology/perception/model-compression-edge-deployment.md` | Unified compression guide: PTQ/QAT quantization, knowledge distillation (TinyBEV), structured pruning, ModelOpt, per-model Orin recipes, 5-15x speedup at 1-3% accuracy loss |
| `technology/perception/multi-object-tracking.md` | 3D MOT for airside: CenterPoint tracker, SimpleTrack, MCTrack, HOTA metrics, airside Re-ID (tail numbers, fleet IDs), ROS integration, 10Hz on Orin |
| `technology/world-models/occupancy-deployment-orin.md` | Occupancy on Orin: FlashOcc TensorRT (197 FPS), SparseOcc, LiDAR voxelization, nvblox ROS bridge, multi-resolution strategy, INT8 calibration |
| `hardware/sensors/thermal-ir-cameras.md` | Thermal cameras for airside: LWIR/MWIR bands, FLIR Boson 640 vs Seek Mosaic, night personnel detection, jet blast visualization, Orin MIPI integration, $8-22K/vehicle |
| `technology/planning/neural-motion-planning.md` | Neural/learned motion planning SOTA (2023-2026): IL planners (PlanTF, UniAD, VAD, SparseDrive, GenAD, Diffusion-Planner), game-theoretic (GameFormer, MARC), differentiable optimization (DIPP, DTPP), VLA planning (DriveVLM, Alpamayo, PlanAgent), safety (CBF, RSS, SafeDreamer, Simplex), NAVSIM benchmark, Orin deployment |
| `technology/localization/hd-map-standards-airside.md` | OpenDRIVE, AMDB/AMXM, NDS comparison; AMXM→Lanelet2 pipeline; NOTAM integration; cost estimates |
| `technology/localization/neural-online-mapping-sota.md` | MapTracker (+69% consistency), StreamMapNet, NMP, topology reasoning (TopoMLP, LaneSegNet), airside adaptation strategy |
| `technology/perception/infrastructure-cooperative-perception.md` | V2I fusion for airports, V2X-ViT/Where2comm/CoBEVT, existing airport systems (SMR/MLAT/ADS-B/CCTV), 0.5-1.5yr payback |
| `technology/perception/lidar-foundation-models.md` | PTv3/Sonata/ScaLR, pre-training saves 50-80% labels, FlatFormer real-time on Orin, PointLoRA for fine-tuning |
| `technology/localization/lidar-slam-algorithms.md` | KISS-ICP, LIO-SAM, FAST-LIO2, Point-LIO comparison; degeneracy detection; airside algorithm selection |
| `operations/safety/cybersecurity-airside-av.md` | Threat models, ISO/SAE 21434, EASA requirements, sensor security, incident response |
| `operations/deployment/workforce-transition.md` | 1.5-2M workers affected, union considerations, retraining, SATS case study |
| `synthesis/decision-framework.md` | Architectural decision framework and diffusion planning guide |
| `technology/vla/vlm-scene-understanding.md` | VLM as co-pilot (not controller): DriveVLM CoT reasoning, DriveLM graph QA, NOTAM interpretation, turnaround status, FOD classification, anomaly detection, InternVL2-2B on Orin (300ms), $30-55K phased deployment |
| `operations/safety/airside-scenario-taxonomy.md` | ISO 34502 adapted for airside ODD, Pegasus 6-layer model, 115 functional / 566 logical scenarios, SOTIF hazard catalog (H1-H8+), STPA control structure, risk matrix, testing strategy, regulatory coverage mapping |
| `operations/airside/ground-control-instructions.md` | Airside instruction hierarchy (A-CDM→ATC→marshaller), A-SMGCS integration, D-TAXI digital clearance, NOTAM machine-readable parsing pipeline, marshaller gesture recognition (ViTPose+LSTM), NLU for ground control phraseology, instruction-to-trajectory mapping, conflict resolution priority, phased deployment $30-50K→$50-100K |
| `technology/perception/camera-fallback-perception.md` | Camera-only degraded mode when LiDAR fails: Metric3D v2, DepthAnything v2 (15ms INT8 Orin), stereo depth (RAFT-Stereo, ZED 2i), BEVFormer-Tiny (35-50ms), confidence calibration, thermal stress, degraded mode architecture with speed reduction, Simplex integration |
| `operations/deployment/multi-airport-adaptation.md` | Multi-airport scaling playbook: domain shift analysis, AMDB map bootstrapping (free FAA data saves 60-70% mapping cost), PointLoRA perception adaptation (500 labels), GNSS multipath mapping, seasonal adaptation, 8-week onboarding protocol, cost model ($75-150K per additional airport) |
| `operations/deployment/hmi-operator-interface.md` | HMI design for airside AV: ISO 3691-4 operator interface, monitoring dashboard (ROS + Foxglove/web), trust calibration, 4-mode control architecture, handoff procedures (2-5s budget), operator training (40-80h), incident reporting → active learning, external crew communication (LED/audio), $5-15K per station |
| `technology/localization/semantic-mapping-learned-priors.md` | Semantic maps + learned priors: Neural Map Prior (NMP, +5.4 mAP, +8.2 at night), PriorDrive unified prior encoding, T2SG topology scene graphs, conformal prediction for map uncertainty, fleet-based incremental map updates, 7-layer semantic map architecture, multi-airport LoRA adapters |
| `technology/planning/safety-critical-planning-cbf.md` | Formal safety for neural planners: CBF math framework (ECBF, HOCBF, stochastic/robust), neural CBF synthesis + conformal calibration (CP-NCBF), CBF-QP filter (<1ms on Orin), HJ reachability (DeepReach), game-theoretic planning (GameFormer level-K, GIME, Stackelberg), multi-agent CBFs (GCBF+ 1024 agents), CBF-Simplex three-layer architecture, airside-specific CBFs (aircraft proximity, jet blast, personnel, geofence, runway incursion) |
| `technology/world-models/lidar-native-world-models.md` | LiDAR-native world models: Copilot4D (65% Chamfer improvement), UnO (self-supervised occupancy), LidarDM (diffusion LiDAR generation), LiDARCrafter (language-guided 4D), 4D occupancy forecasting, point cloud prediction networks, AD-L-JEPA, self-supervised training for airside, Orin deployment (50-100ms), safety applications |
| `technology/perception/collaborative-fleet-perception.md` | V2V cooperative perception: OPV2V/V2X-ViT/CoBEVT/CoBEVFlow SOTA, Where2comm bandwidth selection (95% perf at 1/64 bandwidth), HEAL heterogeneous agents, fleet occupancy map, collective FOD detection, 5G deployment, phased $15K→$115K |
| `technology/planning/neuro-symbolic-scene-graphs.md` | Neuro-symbolic reasoning: driving scene graphs, GNN interaction modeling (LaneGCN, HiVT, HDGT), knowledge graphs for traffic rules, STL-constrained planning (differentiable), compositional reasoning, LLM-symbolic hybrid, airport right-of-way encoding (9-level priority), NOTAM rule injection, interpretable decisions, certification argument structure |
| `operations/safety/testing-validation-methodology.md` | AV testing methodology: V-model, ASAM OpenSCENARIO 2.0, N-wise covering arrays (1,280→40 tests), CMA-ES falsification, LLM scenario generation, metamorphic testing, SIL/HIL/VIL, Zhao-Weng formula (4,600 tests for 99.9% reliability), Bayesian safety, shadow mode criteria, regression CI/CD, digital twin, $105K first airport |
| `technology/perception/self-supervised-pretraining-driving.md` | Unified SSL pre-training: contrastive (SLidR, ScaLR, PPKT), MAE (Voxel-MAE, GD-MAE, BEV-MAE), JEPA (AD-L-JEPA, V-JEPA 2), DINOv2 for driving, multi-modal pre-training (UniPAD, BEVDistill), LoRA fine-tuning, 50-80% label reduction, airside curriculum (road SSL→road supervised→airside SSL→airside supervised), $5-15K compute vs $80K+ labeling |
| `technology/perception/gaussian-splatting-driving.md` | 3DGS for real-time perception/mapping: GaussianFormer (39.2 mIoU, 20 FPS, 3.2x less memory), GaussianFormer v2 (41.1 mIoU), GaussianOcc self-supervised (80% gap closure, zero labels), SplaTAM SLAM (<0.4cm ATE), MonoGS, LiDAR-Gaussian fusion, multi-LiDAR merging via covariance intersection, dynamic object tracking, semantic/panoptic Gaussians, LangSplat language grounding, FOD detection via map anomaly, aircraft proximity monitoring, hybrid PointPillars+GaussianFormer architecture, Orin ~92ms, $90K/12-18mo integration |
| `cross-cutting/data-flywheel-airside.md` | Closed-loop data flywheel: trigger-based collection (50GB/day/vehicle, 100% safety capture), auto-labeling (SAM+CLIP foundation models, 70-85% cost reduction to $1.50-3/frame), active learning (40-50% fewer labels, safety-weighted), continuous retraining (monthly cycle), shadow mode validation (1-2 weeks), A/B fleet testing, scenario mining (power-law long-tail), synthetic data ($23K for 35K frames), multi-airport LoRA ($2-8K/airport), mAP trajectory 45%→82% over 24mo, breakeven Month 18, $205K Year 1 |
| `operations/safety/runtime-verification-monitoring.md` | Runtime verification: STL quantitative robustness as unified safety metric, 20 airside-specific STL specs (aircraft proximity, zone speed, geofence, runway incursion, jet blast), RTAMT tool for ROS, combined OOD detection (energy+Mahalanobis+ensemble, 95-98% AUROC), conformal prediction coverage guarantees, 9 airside OOD triggers, maximally permissive shields (1-5% intervention), Shield+CBF+Simplex three-layer defense-in-depth, safety MCU (STM32H725, $50-200/vehicle), METAR→ODD monitoring, WCET <5.5ms full suite, ISO 26262 ASIL decomposition, UL 4600 compliance, DO-178C formal methods credit, fleet-level anomaly correlation, $115-200K/32 weeks |
| `technology/world-models/occupancy-flow-4d-scenes.md` | Occupancy flow & 4D scene understanding: static→dynamic occupancy, scene flow (NSFP, ZeroFlow 0.028m EPE3D, DeFlow 0.023m SOTA), 4D forecasting (UnO self-supervised winner, OccSora diffusion, Cam4DOcc benchmark, SelfOccFlow), dynamic 3DGS (StreetGaussians, 4D-GS, K-Planes 10900x compression), flow-guided Frenet planning (60-70% collision reduction), temporal modeling (attention+GRU hybrid), sparse voxels (18x compression), Orin 26-40ms FP16 pipeline, class-agnostic motion prediction, $6-11K training cost |
| `technology/perception/streaming-temporal-perception.md` | Streaming temporal perception: StreamPETR object-centric propagation (+6-8% NDS, <3ms overhead, implicit AMOTA 65.3%), Sparse4D v3 (71.9% NDS SOTA), multi-sweep LiDAR (3-sweep +2.5% mAP at +1.4ms), BEV temporal fusion (BEVFormer +10.1% NDS), latency-aware streaming (ASAP/LASP), temporal consistency filtering (eliminates de-icing/jet blast transients), extended airside track persistence (30s GSE, 300 frames aircraft), turnaround phase detection, video backbone comparison, $38K/13 weeks |
| `technology/perception/active-perception-sensor-scheduling.md` | Active perception & sensor scheduling: context-aware model switching (35-45% compute savings), entropy-based attention allocation, foveated LiDAR (89% voxel reduction), multi-LiDAR scheduling (3-4 of 8 at full, 44% savings), early exit networks (48% average compute), risk-aware allocation, planner-guided attention, predictive load scheduling via A-CDM, safe model switching (3-frame overlap), 30-36% power savings for electric GSE, $25-40K/10 weeks |
| `operations/safety/formal-verification-neural-networks.md` | Formal verification of neural networks: SMT (Reluplex, Marabou) and MILP for complete verification (<100K params), alpha-beta-CROWN over-approximation (VNN-COMP winner, millions of params), DeepPoly/PRIMA abstract interpretation, IBP/SABR certified training, Lipschitz bounds for safety margins, randomized smoothing, layered strategy (complete for policy/CBF/Simplex, scalable for PointPillars/CenterPoint, runtime for residual), auto_LiRPA code examples, ISO 3691-4/UL 4600/EU AI Act/EU Machinery Regulation compliance |
| `hardware/compute/energy-efficient-inference-24-7.md` | Energy-efficient 24/7 inference: Orin 15W/30W/50W power modes deep dive, dynamic model switching (40-60% low-complexity time), thermal management (-10C to +50C tarmac, throttling curves), battery-aware compute (SoC-correlated budgets), DLA offloading (5-10W concurrent), sleep/wake (<500ms wake-up), per-model watt profiling, fleet-level energy optimization, 8-15% more daily operating hours, 12-18C lower junction temperature, $15-25K implementation |
| `technology/planning/reinforcement-learning-driving-policy.md` | RL driving policy: CaRL (CoRL 2025 SOTA, PPO + route completion reward scales with batch size), IQL (best offline RL, consistent across traffic densities), SAC/TD3/TQC/CrossQ off-policy comparison, BC→offline RL→online RL three-phase pipeline, CQL conservative lower-bound Q-values, Decision Transformer (RL as sequence modeling), safe RL (CPO, Lagrangian PPO, CBF-QP filter decouples safety from performance), Recovery RL (emergency maneuvers), privileged-to-sensor distillation (comma.ai approach), DAgger with Frenet planner as oracle, RLPD 50/50 mixing for offline-to-online, policy head 0.5ms FP16 on Orin, Simplex integration (RL advanced + Frenet fallback), $45-75K over 32 weeks |
| `technology/localization/hd-map-change-detection-maintenance.md` | HD map change detection and maintenance: point cloud differencing (ICP-based, KD-tree), semantic change detection (class-based filtering), RTMap (ICCV 2025, centimeter-level recursive map maintenance), Bayesian fleet consensus (per-vehicle reliability, posterior >0.99 for safety-critical), DBSCAN spatial clustering, temporal decay model (feature-type half-lives: structures 365d, barriers 30d, equipment 7d), AIRAC 28-day cycle integration (dual-layer: regulatory AIRAC + operational fleet), light-map alternative (720 KB topology+safety+regulatory), NMP implicit maintenance, 3DGS map updates (opacity decay), OTA canary deployment (10% fleet first, 2h monitoring), construction zone + NOTAM corroboration, cost: $45-70K/28 weeks, 60-80% reduction vs manual re-survey, break-even at 2-3 airports |
| `operations/deployment/fleet-tco-business-case.md` | Fleet TCO and business case: per-vehicle CAPEX ($95-210K floor at scale), LiDAR-only sensor kit $29-60K, full suite $47-84K, vehicle integration $20-30K, 3-shift labor savings $150K/year per position, accident avoidance $150-750K/year for 20 vehicles, scale dynamics (pilot $400-650K/vehicle → mature $155-330K), multi-airport marginal cost $600K→$115K, certification $530K-1.95M across 5 jurisdictions, operator ratio 1:5→1:10+ as key OPEX lever, break-even Year 2-4, 10-year NPV $45-80M at 200 vehicles (8% discount), RaaS $10-14K/month, probability-weighted expected NPV ~$25M, regulatory delay -$8-15M/year NPV impact, UISEE 40-60% cost advantage, airport cluster deployment strategy, $2-6B TAM at 10% penetration |
| `technology/multi-agent/v2x-protocols-airside.md` | V2X communication protocols for airside: C-V2X over private 5G/CBRS (preferred, sub-ms URLLC), DSRC comparison, ETSI ITS message architecture (CAM 1-10 Hz, DENM events, CPM perception sharing, MCM maneuver coordination), 8 custom airside messages (Aircraft Proximity Alert, Stand Operation Status, GSE Task Assignment, De-Icing Zone, Emergency Vehicle Priority, Runway Incursion Prevention default-deny model, FOD Detection Alert, Jet Blast Warning — highest criticality invisible hazard), protobuf field-level specs with example payloads, A-CDM/A-SMGCS/ADS-B/AODB bridge architecture, bandwidth planning (123 Mbps for 50 vehicles, zone filtering needed at 200+), PKI with airport-managed CA hierarchy, misbehavior detection trust scoring, fallback safe behavior without V2X (5 km/h + 2x margins), cooperative perception +15-25% AP, standards predicted 2028-2030, $270-450K full implementation, V2X hardware $200-600/vehicle on existing 5G |

---

## Document Statistics

| Metric | Value |
|--------|-------|
| Total documents | 306 |
| Total lines | ~221,000 |
| Companies covered | 21 |
| Technology domains | 9 |
| Method-level SLAM files | 59 |
| Safety documents | 18 |
| Hardware specs | 20 |
| Foundation theory | 12 |
| Synthesis documents | 8 |
| Cross-cutting | 26 |
| Localization/mapping | 72 |
| Planning documents | 12 |
| Multi-agent/fleet | 5 |
| Papers referenced | 400+ |
| Open-source repos evaluated | 50+ |
| Occupancy methods compared | 20 |
| Online mapping methods compared | 16 |
| Cooperative perception methods | 10+ |
| Airport deployments documented | 15+ |
