# End-to-End AV Knowledge Gap Backlog

This backlog consolidates the 2026-05-08 parallel gap audit across the end-to-end autonomous vehicle knowledge architecture. It complements the dedicated [SLAM coverage audit](../../30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md) and [perception coverage audit](../../30-autonomy-stack/perception/overview/coverage-audit-2026.md), which already track method-level gaps in those two libraries.

## Audit Method

Six parallel research agents audited the corpus by architecture domain:

| Agent scope | Repo areas audited |
|---|---|
| Foundations | `10-knowledge-base/` |
| Platform | `20-av-platform/` |
| Autonomy stack | `30-autonomy-stack/` outside the existing perception and SLAM method libraries |
| Runtime and cloud | `40-runtime-systems/`, `50-cloud-fleet/` |
| Safety and validation | `60-safety-validation/`, related `90-synthesis/` risk docs |
| Operations and industry | `70-operations-domains/`, `80-industry-intel/` |

One autonomy-stack agent exceeded context because `30-autonomy-stack/` is the largest section, so the scope was split into two narrower replacement agents: planning/control/V2X and world-models/VLA/E2E/simulation/maps.

Priorities:

| Priority | Meaning |
|---|---|
| P0 | Structural gap that blocks the repo from being a generic end-to-end AV knowledge base. Create or expand before calling the section broadly complete. |
| P1 | High-value gap that improves currentness, deployability, or cross-domain transfer. |
| P2 | Useful follow-up, refresh, or extension after the P0/P1 backlog is under control. |

## Structural Findings

| Finding | Evidence | Implication |
|---|---|---|
| Generic operations scope was underbuilt | `00-start-here/repo-map.md` says `70-operations-domains/` should cover airside, indoor warehouse, outdoor campus, road AV, and deployment playbooks, but `README.md` and `INDEX.md` were airside-heavy. | P0 first wave added warehouse, logistics yard, port, mining, agriculture, construction, robotaxi, trucking, and sidewalk delivery robot operations files. |
| Platform tree promised power and thermal but lacked directories | `README.md` and `00-start-here/repo-map.md` describe power and thermal systems, while `20-av-platform/` had compute, sensors, drive-by-wire, and networking. | P0 first wave added power/electrical, diagnostics, ruggedization, and close-range safety sensing. P1 still tracks vehicle-level thermal management. |
| Foundations needed reusable primers | `10-knowledge-base/` was strong on selected deep dives, but lacked coordinate frames, Bayesian filtering, vehicle dynamics, planning taxonomy, calibration fundamentals, and sensor measurement models. | P0 first wave added five foundation primers. The 2026-05-09 loop added LiDAR, camera, IMU, GNSS/RTK, radar, event/thermal, wheel odometry, time synchronization, and calibration observability fundamentals. |
| Runtime and cloud needed operations discipline | Existing files covered telemetry, OTA, data pipelines, and MLOps, but not fleet SRE, incident command, SUMS governance, map ops, data governance, and runtime security operations. | P0 first wave added operator-facing runtime/cloud playbooks and evidence models. |
| Safety needed traceable evidence packages | Safety content was deep, but incident reporting, living safety-case traceability, and EU compliance dossiering were scattered. | P0 first wave added incident reporting, safety-case evidence traceability, and EU AI Act/Machinery/CRA dossier files. P1 still tracks ISO 3450x evidence, HARA/STPA, PLd/SIL, and ML assurance governance. |

## P0 First-Wave Completion (2026-05-09)

The P0 rows below were promoted into first-class research files by seven writing agents: six parallel workers plus one focused delivery-robot follow-up. The table remains as the provenance record for what was promoted. The next active queue is P1.

## Perception, SLAM, and Sensor Loop (2026-05-09)

A follow-up loop focused specifically on method-level perception, method-level SLAM, and sensor fundamentals for perception, SLAM, and mapping. The loop is tracked in [Continuous Research Loop](continuous-research-loop.md).

| Track | Files promoted |
|---|---|
| Perception methods | SplatAD, GaussianFormer, GaussianOcc, streaming Gaussian occupancy, Cam4DOcc, StreamingFlow, Sparse4D, TacoDepth, and RaCFormer. |
| SLAM methods | MOLA, KISS-SLAM, KISS-Matcher, LVI-SAM, FAST-LIVO/FAST-LIVO2, R2LIVE/R3LIVE, Splat-SLAM, S3PO-GS, Gaussian-LIC, GS-LIVM, VIGS-SLAM, dynamic 4D Gaussian SLAM, and RadarSplat-RIO. |
| Sensor and estimation fundamentals | LiDAR, camera, IMU, GNSS/RTK, radar, event/thermal, time synchronization, multi-sensor calibration observability, wheel odometry, visible-camera hardware, and IMU/GNSS/RTK hardware. |

The next active queue is no longer just P1 cross-architecture work. It also includes method-library loops for temporal occupancy, radar-camera/4D-radar perception, robust SLAM backends, alternative localization sensors, and sensor calibration operations.

## First-Principles Foundations Loop (2026-05-09)

Five web/discovery rounds audited probability/statistics, nonlinear optimization, numerical linear algebra, data association, geometry, mapping, sensors, signal processing, and statistical validation. Five writing agents then promoted the highest-priority gaps into 33 atomic knowledge-base files.

| Track | Files promoted |
|---|---|
| Probability and statistics | Gaussian noise/covariance/information, Mahalanobis and chi-square gating, likelihood/MAP/MLE, robust statistics/RANSAC, and mixture models. |
| Optimization and solvers | Nonlinear least squares, Gauss-Newton/Levenberg-Marquardt/dogleg, trust regions and line search, Jacobians/autodiff/manifold linearization, and Ceres/GTSAM/g2o solver patterns. |
| Numerical linear algebra | Cholesky/LDLT, QR/SVD, Hessian conditioning, sparse fill-in/orderings, square-root information/covariance recovery, and Schur/marginalization/PCG. |
| Geometry, mapping, and geodesy | Lie groups, projective geometry/PnP/triangulation, ICP/GICP/NDT registration, correspondence search structures, occupancy Bayes/evidential/dynamic grids, and map projections/datums. |
| Association, filters, sensors, and validation | Data association, JPDA/MHT/RFS, information filters/smoothers, particle filters, sensor likelihoods, FFT/filtering, radar ambiguity, CFAR, timestamping, and benchmarking statistical validity. |

## P0 Backlog

| Domain | Proposed file | Topic | Why it matters | Source anchors |
|---|---|---|---|---|
| Foundations | `10-knowledge-base/geometry-3d/coordinate-frames-projections-se3.md` | Coordinate frames, projections, SE(3), ENU/NED, ROS frame conventions | Every AV stack depends on correct transforms, uncertainty propagation, and sensor frame semantics. | https://www.ros.org/reps/rep-0103.html, https://autoware.one/docs/tf |
| Foundations | `10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md` | Calibration and temporal alignment fundamentals | Multi-sensor fusion fails silently when extrinsics or timestamps drift. | https://tier4.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/creating-vehicle-and-sensor-description/calibrating-sensors/, https://pmc.ncbi.nlm.nih.gov/articles/PMC12431046/ |
| Foundations | `10-knowledge-base/state-estimation/bayesian-filtering-and-eskf.md` | Bayesian filtering, ESKF, UKF, particle filters, consistency | High-rate recursive state estimation is a foundation for localization, tracking, control, and safety monitors. | https://pmc.ncbi.nlm.nih.gov/articles/PMC12526605/, https://autowarefoundation.github.io/autoware.universe_planning/pr-5583/localization/ekf_localizer/ |
| Foundations | `10-knowledge-base/controls/vehicle-dynamics-and-control.md` | Kinematic/dynamic bicycle models, tire/slip, PID/LQR/MPC, actuator delay | The corpus has Frenet math but not the lower-level vehicle dynamics/control fundamentals that make plans executable. | https://saemobilus.sae.org/papers/a-survey-vehicle-dynamics-models-autonomous-driving-2024-01-2325, https://autowarefoundation.github.io/autoware_universe/main/control/autoware_smart_mpc_trajectory_follower/ |
| Foundations | `10-knowledge-base/robotics/planning-taxonomy-and-trajectory-generation.md` | Route, behavior, motion, speed, and validation layers | Creates the reusable planning vocabulary for road AVs, indoor robots, yards, and airside vehicles. | https://tier4.github.io/autoware-documentation/latest/design/autoware-architecture/planning/, https://arxiv.org/abs/2402.01443 |
| Platform | `20-av-platform/power-electrical/autonomy-power-distribution.md` | Power distribution, hold-up, load shedding, safe-stop energy | Sensors, compute, DBW, and safety I/O need deterministic power during faults and charger/battery transitions. | https://www.infineon.com/products/power/smart-power-switches/efuses, https://www.vicorpower.com/resource-library/articles/automotive/future-proof-advanced-evs |
| Platform | `20-av-platform/diagnostics/functional-diagnostics-uds-doip-sovd.md` | UDS, DoIP, SOVD, DTCs, remote service workflow | Fleet AVs need diagnostic sessions, fault memory, maintenance access, and traceable health states. | https://www.autosar.org/fileadmin/standards/R24-11/AP/AUTOSAR_AP_SWS_Diagnostics.pdf, https://www.iso.org/standard/87961.html |
| Platform | `20-av-platform/ruggedization/environmental-emc-qualification.md` | Environmental, EMC, IP, vibration, mechanical qualification | Indoor washdown, outdoor dust/rain, and airside EMI/de-icing/jet blast need a qualification matrix. | https://www.iso.org/standard/77579.html, https://www.iso.org/standard/77580.html, https://www.iso.org/standard/76116.html |
| Platform | `20-av-platform/networking-connectivity/deterministic-networking-tsn.md` | Extend: whole-vehicle timebase, timestamp provenance, holdover | gPTP/PTP is present, but incident reconstruction and fusion need clock-domain policy and timestamp uncertainty. | https://1.ieee802.org/tsn/802-1dg/, https://www.autosar.org/fileadmin/standards/R24-11/AP/AUTOSAR_AP_EXP_PlatformDesign.pdf |
| Platform | `20-av-platform/sensors/close-range-proximity-safety-sensors.md` | Safety laser scanners, ultrasonic/proximity, tactile bumpers, safety PLC fields | Low-speed AVs still need certified near-field protection around workers, pallets, aircraft, and docking targets. | https://www.iso.org/standard/83545.html, https://www.sick.com/us/en/sick-launches-first-ever-outdoor-safety-laser-scanner-outdoorscan3/w/press-outdoorscan3/ |
| Autonomy | `30-autonomy-stack/end-to-end-driving/evaluation-benchmarks-navsim-bench2drive.md` | NAVSIM, Bench2Drive, closed-loop E2E evaluation | Open-loop imitation metrics do not reliably predict closed-loop behavior. | https://proceedings.neurips.cc/paper_files/paper/2024/hash/32768f7faf1995026ef9821c696f3404-Abstract-Datasets_and_Benchmarks_Track.html, https://arxiv.org/abs/2406.03877 |
| Autonomy | `30-autonomy-stack/planning/airside-closed-loop-planning-benchmark.md` | Airside closed-loop planning benchmark and metrics | Airside planning needs scenario-level progress, comfort, rule, and safety metrics, not only model descriptions. | https://arxiv.org/abs/2406.15349, https://arxiv.org/abs/2406.03877 |
| Autonomy | `30-autonomy-stack/planning/trajectory-tracking-control.md` | Nominal trajectory tracking and vehicle dynamics control | The planner/controller boundary is where delay, saturation, slip, actuator faults, and comfort show up. | https://autowarefoundation.github.io/autoware_universe/pr-10047/control/autoware_trajectory_follower_node/, https://arxiv.org/abs/2503.10559 |
| Autonomy | `30-autonomy-stack/planning/behavior-planning-maneuver-arbitration.md` | Tactical behavior planning and maneuver arbitration | Generic AVs need a layer that turns goals, ODD state, rules, V2X, and fallback policy into maneuvers. | https://arxiv.org/abs/2406.01587, https://link.springer.com/article/10.1007/s44267-025-00095-w |
| Autonomy | `30-autonomy-stack/multi-agent-v2x/v2x-cooperative-planning.md` | End-to-end V2X cooperative planning | V2X should change prediction, behavior, and trajectory decisions, not only perception and protocol messages. | https://arxiv.org/abs/2405.03971, https://arxiv.org/abs/2408.09251 |
| Autonomy | `30-autonomy-stack/vla-vlm/vlm-vla-reliability-benchmarks.md` | Driving VLM/VLA reliability, hallucination, and robustness benchmarks | Language reasoning is useful only if prompt failures, sensor corruption, and wrong answers are measured. | https://arxiv.org/abs/2501.04003, https://openaccess.thecvf.com/content/WACV2025/html/Chen_Automated_Evaluation_of_Large_Vision-Language_Models_on_Self-Driving_Corner_Cases_WACV_2025_paper.html |
| Autonomy | `30-autonomy-stack/end-to-end-driving/airside-autonomy-benchmark-spec.md` | Airside autonomy benchmark and dataset specification | Road and indoor benchmarks do not cover stands, ramps, aircraft, GSE, FOD, marshalling, and airport rules. | https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles, https://arxiv.org/abs/2406.03877 |
| Autonomy | `30-autonomy-stack/end-to-end-driving/cooperative-v2x-e2e-driving.md` | Cooperative V2X and infrastructure-augmented autonomy | Infrastructure sensors and shared context matter for occlusions, indoor/outdoor campuses, and airside fleets. | https://arxiv.org/abs/2408.09251, https://mobility-lab.seas.ucla.edu/v2x-real/ |
| Autonomy | `30-autonomy-stack/world-models/radar-native-world-models.md` | 4D radar-native world models and radar simulation | Radar is the weather/lighting fallback modality; world models should not be only camera/LiDAR-native. | https://arxiv.org/abs/2411.10962, https://arxiv.org/abs/2504.00859 |
| Runtime/cloud | `50-cloud-fleet/operations/fleet-sre-incident-response.md` | Fleet SRE, incident command, runbooks, postmortems | Fleet safety depends on operational ownership, severity taxonomy, fleet-stop policy, and post-incident learning. | https://opentelemetry.io/docs/what-is-opentelemetry/, https://foxglove.dev/blog/observability-for-robotics-systems, https://waymo.com/blog/2025/06/safe-to-deploy |
| Runtime/cloud | `50-cloud-fleet/map-operations/hd-map-lifecycle-operations.md` | Map lifecycle operations: survey, diff, validate, deploy, rollback | Maps are safety-critical runtime artifacts across warehouses, yards, roads, and airports. | https://arxiv.org/abs/2406.01961, https://www.here.com/products/automotive/hd-live-map |
| Runtime/cloud | `50-cloud-fleet/data-governance/fleet-data-privacy-governance.md` | Data governance, privacy, retention, access control | AV logs capture people, facilities, routes, operators, and sensitive operational data. | https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/05/cars-consumer-data-unlawful-collection-use, https://docs.aws.amazon.com/iot-fleetwise/latest/developerguide/what-is-iotfleetwise.html |
| Runtime/cloud | `40-runtime-systems/software-operations/on-vehicle-supply-chain-runtime-security.md` | Signed artifacts, SBOM, secure boot, CVE triage, secrets, certs | Runtime security is scattered across OTA, ROS, and ML deployment docs; it needs an operations file. | https://csrc.nist.gov/pubs/sp/800/218/final, https://www.nhtsa.gov/research/vehicle-cybersecurity, https://uptane.org |
| Runtime/cloud | `50-cloud-fleet/ota/software-update-management-system-ops.md` | SUMS governance for code, models, maps, config, calibration | OTA mechanics exist, but release approval, rollback drills, cohorts, and readiness gates need a separate playbook. | https://www.vehicle-certification-agency.gov.uk/connected-and-automated-vehicles/cyber-security-and-software-updating/, https://waymo.com/blog/2025/06/safe-to-deploy |
| Safety | `60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md` | Incident reporting, near-miss, forensics, post-market monitoring | Transparency and post-deployment monitoring are central to regulator trust and safety-case maintenance. | https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting, https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02, https://www.easa.europa.eu/en/node/138789 |
| Safety | `60-safety-validation/safety-case/safety-case-evidence-traceability.md` | Living safety-case evidence and traceability architecture | Claims, assumptions, evidence IDs, logs, change impact, and review workflows need one artifact model. | https://www.shopulstandards.com/ProductDetail.aspx?productid=UL4600, https://arxiv.org/abs/2404.05444, https://www.york.ac.uk/assuring-autonomy/guidance/amlas/ |
| Safety | `60-safety-validation/standards-certification/eu-ai-act-machinery-compliance-dossier.md` | EU AI Act, Machinery Regulation, CRA, aviation cyber dossier | Date-sensitive compliance is scattered; the high-risk AI timing changed in May 2026 negotiations. | https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng, https://digital-strategy.ec.europa.eu/en/news/eu-agrees-simplify-ai-rules-boost-innovation-and-ban-nudification-apps-protect-citizens, https://digital-strategy.ec.europa.eu/en/policies/cra-summary |
| Operations | `70-operations-domains/warehouse/operations/amr-autonomous-forklift-operations.md` | Indoor warehouse AMR and autonomous forklift operations | Adds GNSS-denied WMS-integrated indoor autonomy, dock staging, charging, and robot safety. | https://www.businesswire.com/news/home/20240305945069/en/Walmart-and-Fox-Robotics-Expand-Partnership-for-Autonomous-Forklifts, https://group.dhl.com/en/media-relations/press-releases/2024/dhl-supply-chain-passes-unprecedented-500-million-picks-milestone-using-locus-robotics-autonomous-mobile-robots.html |
| Operations | `70-operations-domains/logistics-yards/operations/autonomous-yard-truck-operations.md` | Autonomous yard truck and outdoor industrial yard operations | Adds YMS/TMS/WMS integration, trailer spotting, RTK/private wireless, and mixed manual/autonomous yard traffic. | https://venturebeat.com/business/isee-commercially-deploys-worlds-first-fully-autonomous-truck-yard/, https://www.outrider.ai/resources/design-checklist-distribution-yards |
| Operations | `70-operations-domains/ports/operations/autonomous-terminal-tractor-port-operations.md` | Autonomous port terminal tractor and container yard operations | Adds TOS integration, quay-yard-stack routing, vessel schedules, terminal safety, and workforce constraints. | https://hhla.de/en/media/news/detail-view/automated-and-sustainable-logistics-hhla-and-fernride-launch-pilot-project-in-estonia, https://www.kalmarglobal.com/news--insights/articles/2025/20250219_kalmar_unveils_kalmar_one_automation_system/ |
| Operations | `70-operations-domains/mining/operations/autonomous-haulage-operations.md` | Autonomous mining and quarry haulage operations | Mining is one of the most mature AV domains and teaches fleet dispatch, private-road ODDs, haul-road design, and exclusion zones. | https://www.komatsu.com/en/newsroom/2024/komatsu-autonomous-haulage-system-achieves-7-billion-tonnes-of-material-moved/, https://www.cat.com/en_US/by-industry/mining/autonomous-solutions.html |
| Operations | `70-operations-domains/agriculture/operations/autonomous-tractor-field-operations.md` | Autonomous tractor and field operations | Adds seasonal ODDs, field boundaries, implement safety, remote supervision, crop-row maps, and low-connectivity workflows. | https://www.deere.com/en/news/all-news/john-deere-reveals-autonomous-machines-at-ces-2025/, https://www.iso.org/standard/73915.html |
| Operations | `70-operations-domains/construction/operations/autonomous-earthmoving-site-operations.md` | Autonomous construction and earthmoving site operations | Adds temporary layouts, changing work zones, machine control, teleoperation fallback, and site-production KPIs. | https://www.cat.com/en_US/news/machine-press-releases/caterpillar-demonstrates-first-battery-electric-autonomous-haul-truck.html, https://global.kawasaki.com/en/corp/newsroom/news/detail/?f=20240930_3166 |
| Operations | `70-operations-domains/road-av/operations/robotaxi-service-operations.md` | Robotaxi service operations | Company profiles exist, but the operations layer needs depots, rider support, remote assistance, launch gates, and incident response. | https://waymo.com/blog/, https://www.nhtsa.gov/laws-regulations/av-step |
| Operations | `70-operations-domains/road-av/operations/autonomous-trucking-lane-operations.md` | Autonomous trucking lane operations | Adds hub-to-hub lane design, terminal ops, inspections, enforcement, remote support, and launch governance. | https://blog.aurora.tech/aurora-driver/aurora-launches-commercial-driverless-trucking-service, https://www.gov.uk/government/news/self-driving-vehicles-set-to-be-on-roads-by-2026-as-automated-vehicles-act-becomes-law |
| Operations | `70-operations-domains/delivery-robots/operations/sidewalk-delivery-robot-operations.md` | Sidewalk delivery robot operations | Adds sidewalk/curb ODDs, pedestrian interaction, municipal permitting, accessibility constraints, and store handoff. | https://www.serverobotics.com/news/serve-robotics-announces-expansion-of-delivery-operations-to-miami-metro-area, https://www.starship.xyz/press/ |

## P1 Backlog

| Domain | Proposed file or update | Topic |
|---|---|---|
| Foundations | Promoted: `10-knowledge-base/state-estimation/data-association-and-gating.md`, `10-knowledge-base/state-estimation/probabilistic-multi-object-association.md` | Kalman/Hungarian/JPDA/MHT, track lifecycle, data association fundamentals. |
| Foundations | Promoted: `10-knowledge-base/mapping/occupancy-bayes-evidential-dynamic-grids.md` | Log-odds occupancy, inverse sensor models, inflation, dynamic occupancy, costmap semantics. |
| Foundations | `10-knowledge-base/systems-engineering/robotics-middleware-real-time.md` | ROS 2/DDS QoS, executors, deadlines, jitter, lifecycle, deterministic messaging. |
| Foundations | `10-knowledge-base/systems-engineering/odd-scenario-based-assurance.md` | ODD, OpenSCENARIO, ISO 34502, ISO/PAS 8800, safety-case fundamentals. |
| Platform | `20-av-platform/networking-connectivity/zonal-ee-harness-connectors.md` | Zonal E/E, automotive Ethernet PHYs, sensor SerDes, harnessing, serviceability. |
| Platform | `20-av-platform/sensors/visible-camera-hardware.md` | Camera hardware, optics, HDR/LFM, ISP, triggers, synchronization. |
| Platform | `20-av-platform/sensors/gnss-ins-imu-odometry-hardware.md` | PNT resilience, GNSS/INS/IMU, wheel odometry, spoofing/denial. |
| Platform | `20-av-platform/sensors/calibration-bay-fixtures.md` | Calibration bay targets, fixtures, surveyed references, fleet workflow. |
| Platform | `20-av-platform/thermal/vehicle-thermal-management.md` | Vehicle-level thermal budget across compute, sensors, enclosures, battery, heaters. |
| Platform | `20-av-platform/drive-by-wire/can-bus-dbw.md` | Extend or split actuator redundancy, E-stop, STO, brake/steer safety I/O. |
| Autonomy | `30-autonomy-stack/planning/motion-prediction.md` | Extend with calibrated prediction uncertainty for planner margins and fallback policy. |
| Autonomy | `30-autonomy-stack/planning/world-model-simulation-planning.md` | World-model rollouts for planning, rare-event generation, and scenario synthesis. |
| Autonomy | `30-autonomy-stack/multi-agent-v2x/cooperative-perception-benchmarks.md` | Latency, bandwidth, pose-error, packet-loss, and mAP metrics for cooperative perception. |
| Autonomy | `30-autonomy-stack/planning/planner-preference-optimization.md` | Human feedback, comfort, assertiveness, yielding, and procedural preference optimization. |
| Autonomy | `30-autonomy-stack/multi-agent-v2x/v2x-protocols-airside.md` | Extend with NR-V2X Release 18/19 conformance and QoS profile. |
| Autonomy | `30-autonomy-stack/end-to-end-driving/data-engine-long-tail-curation.md` | Long-tail mining, VLM-assisted curation, auto-labeling, and training-set repair. |
| Autonomy | `30-autonomy-stack/world-models/planning-oriented-world-models-rft.md` | Planning-optimized latent world models, RL, and reinforcement fine-tuning. |
| Autonomy | `30-autonomy-stack/vla-vlm/action-heads-control-interfaces.md` | VLA action heads, trajectory tokens, diffusion policies, and safe planner/controller handoff. |
| Autonomy | `30-autonomy-stack/simulation/dynamic-agent-behavior-models-airside.md` | Reactive aircraft, GSE, personnel, vehicle, and mixed-traffic behavior models. |
| Autonomy | `30-autonomy-stack/simulation/closed-loop-safety-benchmarks.md` | NeuroNCAP-style closed-loop safety benchmark patterns. |
| Runtime/cloud | `50-cloud-fleet/fleet-management/fleet-operations-center-playbooks.md` | Fleet ops center authority model, shift handover, emergency stop, site coordination. |
| Runtime/cloud | `50-cloud-fleet/mlops/model-lifecycle-governance.md` | Model cards, approval gates, eval datasets, canary criteria, rollback triggers, audit history. |
| Runtime/cloud | `50-cloud-fleet/data-platform/data-catalog-lineage-quality-ops.md` | Data catalog, lineage, schemas, quality gates, deletion propagation, replay reproducibility. |
| Runtime/cloud | `40-runtime-systems/software-operations/edge-runtime-supervision-config-management.md` | Watchdogs, config schemas, feature flags, offline-first operation, local fallback. |
| Safety | `60-safety-validation/verification-validation/iso-3450x-airside-scenario-evidence.md` | ISO 34501-34505 scenario evidence mapping, including ISO 34504/34505. |
| Safety | `60-safety-validation/safety-case/airside-av-hara-stpa-sotif-analysis.md` | Item definition, HARA, STPA, FMEA, SOTIF triggering conditions, safety goals. |
| Safety | `60-safety-validation/standards-certification/safety-functions-pld-sil-validation.md` | Per-function PLd/SIL evidence for braking, E-stop, personnel detection, geofence. |
| Safety | `60-safety-validation/standards-certification/ml-assurance-data-governance.md` | ML assurance lifecycle, data requirements, model change safety case, ISO/IEC 42001 and TR 5469 alignment. |
| Operations/industry | `80-industry-intel/regulations/cross-domain-av-regulatory-map.md` | Cross-domain standards map across industrial mobile robots, road AVs, mining, agriculture, airside, and delivery robots. |
| Operations/industry | `80-industry-intel/market-competitive/cross-domain-autonomy-competitive-landscape.md` | Competitive landscape by domain maturity, deployments, vendors, and business models. |
| Operations/industry | `80-industry-intel/companies/<company>/tech-stack.md` | First-wave company profiles: Fox Robotics, Locus, Outrider, ISEE, Kalmar, Komatsu, Caterpillar, John Deere, Serve Robotics, Starship. |
| Operations/industry | `70-operations-domains/cross-domain/mapping-operations/indoor-outdoor-map-ops-playbook.md` | Operational map lifecycle: site survey, map ownership, route approvals, geofence releases, WMS/YMS/TOS/AODB integration. |

## P2 Backlog And Extension Queue

| Domain | Proposed file or update | Topic |
|---|---|---|
| Foundations | `10-knowledge-base/machine-learning/av-data-evaluation-fundamentals.md` | Dataset splits, scenario coverage, benchmark interpretation, open-loop versus closed-loop metrics. |
| Platform | `20-av-platform/networking-connectivity/vehicle-middleware-dds-someip-zenoh.md` | DDS, SOME/IP, zero-copy IPC, Zenoh, service discovery, bridge policy. |
| Platform | `20-av-platform/sensors/automated-sensor-cleaning.md` | Extend with cleaning verification, fluid logistics, freeze/de-ice, pump/nozzle telemetry. |
| Platform | `20-av-platform/compute/safety-certified-runtime-compute.md` | Safety-certified runtime compute and mixed-criticality partitioning. |
| Autonomy | `30-autonomy-stack/localization-mapping/overview/infrastructure-aided-localization.md` | UWB, fiducials, RFID, infrastructure-aided localization for terminals, hangars, docks, and repetitive structures. |
| Autonomy | `30-autonomy-stack/end-to-end-driving/learned-autonomy-safety-assurance.md` | Evidence arguments for world models, VLA, and E2E driving. |
| Autonomy | `30-autonomy-stack/planning/map-free-online-map-planning.md` | Planning when HD maps are stale, unavailable, or wrong. |
| Autonomy | `30-autonomy-stack/planning/safety-critical-planning-cbf.md` | Extend with reachability and runtime assurance beyond CBF. |
| Autonomy | `30-autonomy-stack/planning/reactive-sim-agents-planner-validation.md` | Reactive simulation agents for planner validation. |
| Runtime/cloud | `40-runtime-systems/software-operations/sensor-calibration-fleet-ops.md` | Calibration artifact versioning, drift remediation, maintenance gates. |
| Runtime/cloud | `50-cloud-fleet/cloud-operations/finops-capacity-planning.md` | Fleet data/cloud FinOps and capacity planning. |
| Runtime/cloud | `50-cloud-fleet/fleet-management/fleet-interoperability-standards.md` | VDA 5050, Open-RMF, MassRobotics interoperability and adapter policy. |
| Safety | `60-safety-validation/cybersecurity/cybersecurity-airside-av.md` | Extend with CSMS/SUMS evidence matrix, SBOM ownership, vulnerability reporting, red-team cadence, SOC exercises. |
| Safety | `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md` | Extend with monitor qualification, threshold calibration, WCET proof, false-positive/false-negative acceptance, monitor failure handling. |
| Safety | `60-safety-validation/standards-certification/airside-agvs-regulatory-approval-playbook.md` | FAA, EASA/ICAO, CAAS/TR68 approval path for airside AGVS deployments. |
| Operations/industry | Airside refresh set | Update airside industry, regulatory trajectory, reference airside AV stack production deployment, and TractEasy production deployment for 2024-2026 changes. |
| Operations/industry | `70-operations-domains/deployment-playbooks/generic-site-onboarding-checklist.md` | Generic AV site onboarding checklist with domain overlays. |
| Operations/industry | `80-industry-intel/deployments/2024-2026-autonomy-deployment-index.md` | Neutral deployment ledger by domain, site, vehicle type, autonomy level, safety operator status, regulatory basis, and source date. |

## Execution Order

1. Treat P0 as completed at the first-file level, then revisit individual files only for deeper expansion or source refreshes.
2. Promote P1 files where they unlock multiple downstream docs, especially model lifecycle governance, ISO 3450x evidence, VLA reliability, and cross-domain regulatory/competitive maps.
3. Keep P2 as extension work unless a new deployment or repo goal makes a topic urgent.
4. When a P1/P2 gap is completed, move it from this backlog into the relevant domain overview or audit and update `README.md`, `INDEX.md`, and `METHODOLOGY.md` counts.
