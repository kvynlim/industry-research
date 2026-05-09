# Perception and SLAM Gap Fill 2026-05-09

This report records the 2026-05-09 multi-agent web sweep and second-pass research fill for perception, SLAM, localization, mapping, first-principles foundations, and runtime reliability.

It does not replace the dedicated [perception coverage audit](../../30-autonomy-stack/perception/overview/coverage-audit-2026.md), [SLAM coverage audit](../../30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md), or [knowledge gap backlog](knowledge-gap-backlog.md). Its purpose is narrower: identify the strongest remaining gaps after the existing May 2026 promotion waves and give enough source-backed detail for the next atomic-file wave.

## Agent Workflow

| Stage | Agents | Output |
|---|---:|---|
| Web gap scouts | 6 | Non-duplicate gap candidates across perception methods, SLAM methods, benchmarks, KB foundations, runtime reliability, and neural-field/world-model boundaries. |
| Fill-in researchers | 5 | Source-backed briefs for the highest-leverage gap clusters. |
| Integration | 1 | This synthesis report and promotion queue. |

The scout pass treated a topic as a stronger gap when it was absent as an atomic file, present only as an audit/watchlist row, or covered only indirectly inside broader overview pages.

## Highest-Leverage Gaps

| Priority | Gap Cluster | Why It Matters |
|---|---|---|
| P0 | Resilient open-world occupancy | Occupancy is already covered, but deployable occupancy needs unknown-object scoring, missing-camera robustness, long-range sparse evidence, and open-ended label bootstrapping. |
| P0 | Degraded-assumption SLAM | Current methods now target radar-centric odometry, foundation dense SLAM, UWB/wheel/LiDAR/IMU fusion, dynamic-aware LIO, and multi-agent neural/Gaussian mapping. |
| P0 | Validation datasets for route repeat, drift, OOD, relocalization, and airside movement | The repo has many benchmarks, but needs stronger slice-based protocols for same-route change, continuous ODD drift, compound uncertainty, relocalization, and airport surface trajectories. |
| P0 | Estimator foundations not yet taught directly | Observability/gauge consistency, unknown-correlation fusion, out-of-sequence measurements, and localization integrity are structural prerequisites for trustworthy perception/SLAM safety cases. |
| P0 | Runtime telemetry and diagnostics contracts | Offline validation is not enough; deployed fleets need versioned schemas, diagnostics, localization health gates, and map QA release gates. |

## Resilient Open-World Occupancy

The current perception library covers camera occupancy, LiDAR-camera occupancy fusion, dynamic occupancy/free-space, Gaussian occupancy, open-world detection, OOD/anomaly benchmarks, and corruption tests. The missing layer is a focused "resilient open-world occupancy" cluster: methods that keep dense occupancy useful when objects are unknown, classes are long-tail, cameras are missing, evidence is sparse at long range, or manual labels are incomplete.

| Proposed file | Method | Contribution | Deployment Risk |
|---|---|---|---|
| `30-autonomy-stack/perception/methods/proood.md` | ProOOD | Prototype-guided semantic imputation, tail-class mining, and voxel-level OOD scoring for 3D occupancy. | Prototype bias; OOD score must trigger conservative behavior, not become an uncalibrated class label. |
| `30-autonomy-stack/perception/methods/m2-occ.md` | M2-Occ | Semantic occupancy under incomplete multi-camera inputs through masked reconstruction and feature memory. | Missing-view reconstruction can hallucinate occupancy or freespace unless confidence is exposed. |
| `30-autonomy-stack/perception/methods/self-supervised-sparse-sensor-fusion-long-range.md` | Self-supervised sparse sensor fusion | Sparse multimodal temporal encoding for long-range perception from unlabeled camera-LiDAR data. | Long-range sparse features must not replace near-field dense FOD and personnel detection. |
| `30-autonomy-stack/perception/methods/autoocc.md` | AutoOcc | Open-ended semantic occupancy auto-labeling using vision-language guidance and Gaussian splatting. | Auto-labeling needs human QA, negative examples, and adverse-condition splits before safety use. |

Airside transfer is strong because aprons and industrial yards contain non-catalog objects, unusual equipment, temporary clutter, partial camera views, long stopping distances, glare, spray, and domain-specific labels such as chocks, hoses, belt loaders, cones, covers, aircraft gear, and FOD. The runtime contract should expose unknown-voxel risk, missing-view confidence, long-range evidence quality, label provenance, and sensor-health inputs.

Useful P1 follow-ons: LOcc, GroundingOcc, GS-Occ3D, GaussianFlowOcc, and EmbodiedOcc.

Sources:

- ProOOD: https://arxiv.org/abs/2604.01081, https://github.com/7uHeng/ProOOD
- M2-Occ: https://arxiv.org/abs/2603.09737
- Self-Supervised Sparse Sensor Fusion for Long Range Perception: https://openaccess.thecvf.com/content/ICCV2025/html/Palladin_Self-Supervised_Sparse_Sensor_Fusion_for_Long_Range_Perception_ICCV_2025_paper.html, https://arxiv.org/abs/2508.13995
- AutoOcc: https://openaccess.thecvf.com/content/ICCV2025/html/Zhou_AutoOcc_Automatic_Open-Ended_Semantic_Occupancy_Annotation_via_Vision-Language_Guided_Gaussian_ICCV_2025_paper.html
- GroundingOcc: https://arxiv.org/abs/2508.01197
- GS-Occ3D: https://arxiv.org/abs/2507.19451
- GaussianFlowOcc: https://arxiv.org/abs/2502.17288
- EmbodiedOcc: https://arxiv.org/abs/2412.04380

## Degraded-Assumption SLAM

The SLAM library is strong on classical LiDAR, LIO/LIVO, radar SLAM, Gaussian SLAM, collaborative PGO, map cleaning, and alternative sensors. The remaining current gap is not another classic LOAM variant; it is SLAM under degraded assumptions: sparse/weather-friendly radar, uncalibrated foundation-model dense geometry, GNSS-denied multimodal fusion, dynamic-scene LIO, and multi-agent neural/Gaussian map merging.

| Proposed file | Method family | Contribution | Deployment Risk |
|---|---|---|---|
| `30-autonomy-stack/localization-mapping/slam-methods/super4dr.md` | Super4DR | 4D radar-centric learned odometry and Gaussian map optimization for poor weather/lighting. | Radar sparsity, multipath, weak covariance semantics, preprint maturity. |
| `30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md` | SLAM3R / VGGT-SLAM / VGGT-SLAM++ | Feed-forward/foundation dense SLAM from RGB, with pointmap/submap alignment and retrieval-assisted optimization. | Camera-only fragility, learned-prior hallucination, weak runtime safety evidence. |
| `30-autonomy-stack/localization-mapping/slam-methods/cm-liuw-odometry.md` | CM-LIUW-Odometry | LiDAR-IMU-UWB-wheel fusion for GPS-denied, feature-poor, slippery, or tunnel-like environments. | UWB NLOS, wheel slip, lever-arm/calibration errors, mode-switch tuning. |
| `30-autonomy-stack/localization-mapping/slam-methods/dynamic-aware-lio-btsa.md` | Breaking the Static Assumption | Dynamic-aware LIO using spatio-temporal normal analysis inside registration. | Dynamic filtering can remove useful structure or retain moving clutter if thresholds drift. |
| `30-autonomy-stack/localization-mapping/slam-methods/multi-agent-neural-gaussian-slam.md` | MAGiC-SLAM / MNE-SLAM | Multi-agent dense neural/Gaussian mapping and map fusion beyond classical collaborative pose graphs. | False map merges, bandwidth limits, dense-map consistency, safety-case immaturity. |

For airside autonomy, Super4DR and CM-LIUW are the strongest runtime-adjacent candidates. SLAM3R/VGGT and MAGiC/MNE are more useful for offline mapping, site digitization, inspection, relocalization candidates, and simulation map building than as immediate safety pose sources.

Sources:

- Super4DR: https://arxiv.org/abs/2512.09608
- SLAM3R: https://openaccess.thecvf.com/content/CVPR2025/papers/Liu_SLAM3R_Real-Time_Dense_Scene_Reconstruction_from_Monocular_RGB_Videos_CVPR_2025_paper.pdf
- VGGT-SLAM: https://arxiv.org/abs/2505.12549
- VGGT-SLAM++: https://arxiv.org/abs/2604.06830
- CM-LIUW-Odometry: https://arxiv.org/abs/2511.01379
- Breaking the Static Assumption / BTSA: https://arxiv.org/abs/2510.22313, https://github.com/thisparticle/btsa
- MAGiC-SLAM: https://openaccess.thecvf.com/content/CVPR2025/html/Yugay_MAGiC-SLAM_Multi-Agent_Gaussian_Globally_Consistent__SLAM_CVPR_2025_paper.html, https://github.com/VladimirYugay/MAGiC-SLAM
- MNE-SLAM: https://openaccess.thecvf.com/content/CVPR2025/papers/Deng_MNE-SLAM_Multi-Agent_Neural_SLAM_for_Mobile_Robots_CVPR_2025_paper.pdf

## Benchmark and Dataset Gaps

The benchmark gap is not simply "more datasets." The missing validation pattern is slice-based evidence: same route across conditions, continuous ODD drift, compound weather+OOD uncertainty, global relocalization under appearance change, and airside surface movement forecasting.

| Proposed file or update | Benchmark | Measures | Validation Use |
|---|---|---|---|
| `30-autonomy-stack/perception/datasets-benchmarks/ithaca365-repeated-weather-perception.md` | Ithaca365 | Repeated traversals across weather, season, time, traffic, cameras, LiDAR, GPS/INS, masks, and boxes. | Validate "same route, different day" perception and localization degradation. |
| `30-autonomy-stack/perception/datasets-benchmarks/shift-continuous-domain-shift.md` | SHIFT | Continuous shifts in weather, lighting, traffic, and pedestrian density. | Plot degradation curves and ODD cliff points instead of binary clear/adverse tests. |
| `30-autonomy-stack/perception/datasets-benchmarks/muad-multiple-uncertainties.md` | MUAD | Weather, day/night, OOD, segmentation, depth, object and instance detection. | Test compound uncertainty: normal, OOD-only, weather-only, weather+OOD. |
| `30-autonomy-stack/localization-mapping/datasets-benchmarks/pit30m-global-localization.md` | Pit30M | Large-scale image/LiDAR localization with season, weather, time, traffic, occlusion metadata. | Separate relocalization metrics from odometry metrics: recall, false-place matches, map age, time to relocalize. |
| `70-operations-domains/airside/datasets-benchmarks/amelia-airport-surface-forecasting.md` | Amelia / Amelia-42 | Airport surface movement trajectories, routing graphs, forecasting, anomaly detection. | Add airside multi-agent risk, topology transfer, route compliance, and runway-incursion-style anomaly protocols. |

Secondary audit rows: CODA for corner-case objects, Waymo Open Sim Agents Challenge for stochastic multi-agent simulation, CARLA Leaderboard 2.1 for closed-loop route/infraction scoring, and RobotCar Seasons for long-term visual localization.

Sources:

- Ithaca365: https://arxiv.org/abs/2208.01166
- SHIFT: https://arxiv.org/abs/2206.08367
- MUAD: https://muad-dataset.github.io/, https://arxiv.org/abs/2203.01437
- Pit30M: https://arxiv.org/abs/2012.12437
- Amelia: https://ameliacmu.github.io/, https://ameliacmu.github.io/amelia-dataset/
- CODA: https://coda-dataset.github.io/
- Waymo Open Sim Agents Challenge: https://waymo.com/research/the-waymo-open-sim-agents-challenge/
- CARLA Leaderboard 2.1: https://leaderboard.carla.org/get_started_v2_1/
- RobotCar Seasons / Visual Localization Benchmark: https://www.visuallocalization.net/datasets/

## First-Principles KB Gaps

The knowledge base is strong on filters, factor graphs, covariance, information, data association, time synchronization, continuous-time trajectories, and registration math. The structural gaps below are important because they explain why a perception/SLAM system can be numerically impressive but still unsafe or overconfident.

| Proposed file | Topic | What It Should Teach | Failure Mode Avoided |
|---|---|---|---|
| `10-knowledge-base/state-estimation/slam-vio-observability-fej-nullspace-consistency.md` | SLAM/VIO observability and consistency | Physical vs linearized observability, gauge modes, FEJ, nullspace projection, NEES/NIS, rank diagnostics. | Estimator invents information in unobservable directions and reports overconfident covariance. |
| `10-knowledge-base/state-estimation/fusion-unknown-correlations-covariance-intersection.md` | Unknown-correlation fusion | Cross-correlation, data incest, Covariance Intersection, track-to-track fusion, consistency vs conservatism. | Double-counted information in V2X, infrastructure perception, shared maps, or distributed tracking. |
| `10-knowledge-base/state-estimation/out-of-sequence-measurements-fixed-lag-smoothing.md` | Delayed and out-of-sequence measurements | Measurement time vs arrival time, retrodiction, fixed-lag smoothing, buffering, OOSM filters/factor graphs. | Stale camera/radar/V2X/map updates are fused as current state and corrupt tracks or ego pose. |
| `10-knowledge-base/state-estimation/localization-integrity-protection-levels-raim.md` | Localization integrity | Integrity vs accuracy, alert limits, protection levels, RAIM/ABAS, hazardous misleading localization. | Low average error hides unbounded risk of undetected wrong pose. |

These pages require the KB visual pipeline: each new `10-knowledge-base` page needs a curated visual block, SVG asset, and `tools/knowledge-base/visual-taxonomy.mjs` assignment before tests will pass.

Sources:

- Observability-based EKF SLAM consistency: https://journals.sagepub.com/doi/pdf/10.1177/0278364909353640
- VINS observability/consistency: https://intra.ece.ucr.edu/~mourikis/papers/Huang2011-IROS.pdf
- Covariance Intersection: https://colab.ws/articles/10.1109%2FACC.1997.609105
- Distributed fusion under unknown correlation: https://www.mdpi.com/1424-8220/17/11/2472
- Dependent-error track-to-track association: https://isif.org/media/multisensor-track-track-association-tracks-dependent-errors
- Stone Soup OOSM example: https://stonesoup.readthedocs.io/en/stable/auto_examples/oosm/PF_OOSM_example.html
- Bayesian OOSM treatment: https://www.sciencedirect.com/science/article/pii/S156625350300037X
- Nonlinear robot localization with OOSM: https://pmc.ncbi.nlm.nih.gov/articles/PMC3376572/
- FAA GNSS/RAIM overview: https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/techops/navservices/gnss/
- Integrity monitoring for Kalman-filter localization: https://journals.sagepub.com/doi/10.1177/0278364920960517
- Multimodal perception localization integrity: https://www.mdpi.com/1424-8220/20/16/4654

## Runtime Reliability and Fleet Operations

The operational gap is a versioned telemetry and diagnostics contract. Offline perception/SLAM validation does not prove the deployed fleet can compare evidence across builds, map versions, calibration packages, airports, and time. The runtime layer must turn sensor health, localization residuals, map QA, diagnostics, and safety actions into versioned, auditable telemetry.

| Proposed update | Contract or Gate | Required Content |
|---|---|---|
| `50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md` | Versioned telemetry schema | `schema_url`, `schema_version`, signal namespace, migration ID, software build, map package, calibration, model ID, diagnostics contract version, severity, safety action, raw-log references. |
| `40-runtime-systems/ros-autoware/autoware-universe-deep-dive.md` or new diagnostics file | ROS/Autoware diagnostics contract | REP-107 style summary/detail split, `DiagnosticArray` naming, `diagnostic_updater` checks, Autoware diagnostics DAG, fleet severity mapping. |
| `60-safety-validation/runtime-assurance/online-perception-monitoring-odd-enforcement.md` | Localization health gate | Health states: localized, degraded, uncertain, relocalizing, lost, map mismatch, time-sync fault; gates on covariance, NDT score, residual drift, skipped publication, delay. |
| `50-cloud-fleet/map-operations/hd-map-lifecycle-operations.md` | Map QA release gate | Lanelet2 validation, Autoware/TIER IV validators, semantic diff, signed manifest, tile consistency, pointcloud alignment, cohort/canary plan, rollback target. |

The AWS IoT FleetWise dependency should be treated carefully: AWS says FleetWise stops accepting new customers on April 30, 2026, and will receive no new feature development. Existing references can remain, but new schema strategy should not anchor on FleetWise alone.

Sources:

- COVESA Vehicle Signal Specification: https://covesa.global/project/vehicle-signal-specification/, https://covesa.github.io/vehicle_signal_specification/introduction/overview/
- Eclipse KUKSA: https://projects.eclipse.org/projects/automotive.kuksa
- OpenTelemetry schemas: https://opentelemetry.io/docs/specs/otel/schemas/
- AWS IoT FleetWise availability change: https://docs.aws.amazon.com/iot-fleetwise/latest/developerguide/iotfleetwise-availability-change.html
- ROS REP-107 diagnostics: https://www.ros.org/reps/rep-0107.html
- ROS 2 `diagnostic_updater`: https://docs.ros.org/en/jazzy/p/diagnostic_updater/
- Autoware diagnostics API: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Autoware NDT scan matcher diagnostics: https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- Autoware localization interface: https://tier4.github.io/autoware-documentation/latest/design/autoware-interfaces/components/localization/
- Lanelet2 validation: https://docs.ros.org/en/rolling/p/lanelet2_validation/
- TIER IV Autoware Lanelet2 map validator: https://github.com/tier4/autoware_lanelet2_map_validator
- Autoware.Auto Lanelet2 map requirements: https://autowarefoundation.gitlab.io/autoware.auto/AutowareAuto/lanelet2-map-for-autoware-auto.html

## Promotion Queue

Use this order for the next atomic-file wave:

1. Create the four resilient open-world occupancy pages: ProOOD, M2-Occ, self-supervised sparse sensor fusion, and AutoOcc.
2. Create the three most deployment-relevant SLAM pages: Super4DR, CM-LIUW-Odometry, and BTSA dynamic-aware LIO. Add SLAM3R/VGGT as a foundation-SLAM survey page if time allows.
3. Add Ithaca365, SHIFT, MUAD, Pit30M, and Amelia as benchmark pages or audit rows, then connect them to validation protocols.
4. Add the runtime reliability updates before broadening the method library further, because diagnostics and schema contracts are needed to make method evidence operational.
5. Promote the four first-principles KB pages only with the visual/taxonomy pipeline in the same change.

## Do Not Over-Promote Yet

Keep these as watchlist or cross-link items until source maturity, code availability, or validation relevance improves: many 2026 Gaussian occupancy variants, learned radar odometry variants without repeated external evaluation, neural/Gaussian multi-agent SLAM as runtime pose sources, diffusion occupancy completion as a safety primitive, and open-ended VLM labels without human QA or adverse-condition calibration.
