# Cross-Architecture Knowledge Base Gap Fill 2026-05-09

This report records the 2026-05-09 multi-agent web sweep and second-pass research fill for knowledge-base gaps outside the dedicated perception and SLAM method audits.

It complements the [End-to-End AV Knowledge Gap Backlog](knowledge-gap-backlog.md), [Continuous Research Loop](continuous-research-loop.md), and [Perception and SLAM Gap Fill](perception-slam-gap-fill-2026-05-09.md). Its purpose is to turn broad backlog rows into source-backed, atomic-file candidates with enough evidence detail for the next writing wave.

## Agent Workflow

| Stage | Agents | Output |
|---|---:|---|
| Web gap scouts | 6 | Non-duplicate gap candidates across foundations, autonomy, platform, runtime/cloud, safety, operations, and industry intelligence. |
| Fill-in researchers | 6 | Source-backed briefs for six disjoint clusters. |
| Integration | 1 | This synthesis report and promotion queue. |

The scout pass treated a topic as a stronger gap when it was absent as an atomic file, present only as a backlog row, or covered only indirectly in broad overview pages.

## Highest-Leverage Gaps

| Priority | Gap Cluster | Why It Matters |
|---|---|---|
| P0 | Safety standards to evidence | ISO/TS 5083, ISO 34504/34505, HARA/STPA/SOTIF, PLd/SIL, ML assurance, and FAA AGVS approval need assessor-ready artifact models, not scattered references. |
| P0 | Runtime data and model governance | Model releases, data lineage, replay-to-simulation, runtime config, observability, and label budgets must be traceable to one release and one deployed fleet state. |
| P0 | Platform integration reliability | Zonal wiring, middleware, certifiable compute, thermal design, data recorders, calibration bays, clocks, and service infrastructure define whether autonomy can operate repeatedly. |
| P0 | Foundational assurance methods | Real-time scheduling, rare-event statistics, hazard analysis, and ODD/scenario coverage are reusable first-principles layers that explain the safety argument. |
| P0 | Closed-loop autonomy evaluation | VLA/VLM, scenario libraries, risk forecasting, real-to-sim, and safety critics need closed-loop evidence before they can support airside decisions. |
| P0 | Cross-domain deployment evidence | The repo needs a neutral deployment ledger and regulatory map to distinguish deployed autonomy from vendor claims. |

## 30-Page Promotion Wave

The follow-up writing wave promoted 30 source-backed atomic pages from this report and the latest scout pass.

| Track | New pages |
|---|---|
| Safety standards and certification | [Airside AGVS Regulatory Approval Playbook](../../60-safety-validation/standards-certification/airside-agvs-regulatory-approval-playbook.md), [Safety Functions PLd/SIL Validation](../../60-safety-validation/standards-certification/safety-functions-pld-sil-validation.md), [ML Assurance Data Governance](../../60-safety-validation/standards-certification/ml-assurance-data-governance.md), [ISO/TS 5083 ADS Safety V&V](../../60-safety-validation/standards-certification/iso-ts-5083-ads-safety-vv.md), and [IATA AHM 908 Autonomous GSE Standards](../../60-safety-validation/standards-certification/iata-ahm-908-autonomous-gse-standards.md). |
| Runtime, data, and release governance | [Model Governance Release Evidence](../../50-cloud-fleet/mlops/model-governance-release-evidence.md), [Data Catalog, Lineage, and Quality Ops](../../50-cloud-fleet/data-platform/data-catalog-lineage-quality-ops.md), [Replay Scenario Mining Ops](../../50-cloud-fleet/data-platform/replay-scenario-mining-ops.md), [Edge Runtime Supervision and Config Management](../../40-runtime-systems/software-operations/edge-runtime-supervision-config-management.md), and [Active Labeling Budget Ops](../../50-cloud-fleet/data-platform/active-labeling-budget-ops.md). |
| Platform integration | [Zonal E/E Harness and Connectors](../../20-av-platform/networking-connectivity/zonal-ee-harness-connectors.md), [Vehicle Middleware DDS/SOME-IP/Zenoh](../../40-runtime-systems/middleware/vehicle-middleware-dds-someip-zenoh.md), [Safety-Certified Runtime Compute](../../20-av-platform/compute/safety-certified-runtime-compute.md), [Vehicle Thermal Management](../../20-av-platform/thermal/vehicle-thermal-management.md), and [AV Data Recorder and DSSAD Hardware](../../40-runtime-systems/data-logging/av-data-recorder-dssad-hardware.md). |
| Autonomy evaluation | [Safety-Critical Scenario Libraries](../../60-safety-validation/verification-validation/safety-critical-scenario-libraries.md), [Closed-Loop VLM/VLA Evaluation](../../30-autonomy-stack/vla-vlm/closed-loop-vlm-vla-evaluation.md), [Risk Forecasting for Long-Tail Planning](../../30-autonomy-stack/planning/risk-forecasting-long-tail.md), [Real-to-Sim Closed-Loop Benchmarks](../../30-autonomy-stack/simulation/real-to-sim-closed-loop-benchmarks.md), and [Natural-Language Cooperative Autonomy](../../30-autonomy-stack/multi-agent-v2x/natural-language-cooperative-autonomy.md). |
| Regulation and deployment evidence | [2024-2026 Autonomy Deployment Index](../../80-industry-intel/deployments/2024-2026-autonomy-deployment-index.md), [Cross-Domain Autonomy Regulatory Map](../../80-industry-intel/regulations/cross-domain-autonomy-regulatory-map.md), [Airside AGVS FAA/CAAS Regulatory Map](../../80-industry-intel/regulations/airside-agvs-faa-caas-regulatory-map.md), [US Road ADS Approval and Reporting](../../80-industry-intel/regulations/us-road-ads-approval-reporting-nhtsa.md), and [EU ADS Type Approval 2022/1426 and 2026/481](../../80-industry-intel/regulations/eu-ads-type-approval-2022-1426-2026-481.md). |
| Company deployment evidence | [Fox Robotics Production Deployment](../../80-industry-intel/companies/fox-robotics/production-deployment.md), [Locus Robotics Production Deployment](../../80-industry-intel/companies/locus-robotics/production-deployment.md), [ISEE Production Deployment](../../80-industry-intel/companies/isee/production-deployment.md), [Outrider Tech Stack](../../80-industry-intel/companies/outrider/tech-stack.md), and [Kalmar Port Automation Tech Stack](../../80-industry-intel/companies/kalmar/port-automation-tech-stack.md). |

## Safety Standards and Certification Evidence

The safety section is already broad, but several high-value standards are not yet represented as first-class evidence packages. The missing layer is a set of practical files that turn standards into artifacts, traceability, and acceptance criteria.

| Priority | Proposed file | Gap Filled | Evidence Artifacts |
|---|---|---|---|
| P0 | `60-safety-validation/standards-certification/iso-ts-5083-ads-safety-vv.md` | ADS safety design and V&V anchor for airside autonomy, adapted from road ADS scope. | ADS item definition, ODD, safety objectives, safety-by-design argument, V&V matrix, residual-risk owners, field-monitor triggers. |
| P0 | `60-safety-validation/verification-validation/iso-3450x-airside-scenario-evidence.md` | Scenario categorization and test-case generation for assessor-ready airside evidence. | Scenario tag ontology, criticality scoring, OpenSCENARIO assets, test objectives, inputs, expected results, coverage dashboard. |
| P0 | `60-safety-validation/safety-case/airside-av-hara-stpa-sotif-analysis.md` | Integrated airside item definition, HARA, STPA, FMEA, and SOTIF trigger catalogue. | Control structure, unsafe control actions, safety goals, constraints, scenario tests, runtime monitors, minimum-risk condition. |
| P0 | `60-safety-validation/standards-certification/safety-functions-pld-sil-validation.md` | Machinery-style safety-function evidence for autonomous GSE. | PLr/SIL allocation, ISO 13849 blocks, IEC 62061/PFHd calculations, stop-distance tests, proof tests, fault injection. |
| P0 | `60-safety-validation/standards-certification/ml-assurance-data-governance.md` | ML safety management and data governance release model. | AI safety plan, model/data cards, dataset lineage, ODD balance, leakage checks, change-impact analysis, rollback plan, AIMS records. |
| P0 | `60-safety-validation/standards-certification/airside-agvs-regulatory-approval-playbook.md` | Airport sponsor and FAA AGVS approval workflow. | CONOPS, route map, human-monitor role, stakeholder notification, RF/aeronautical study, emergency procedures, signage, insurance, NOTAM checklist. |

Acceptance rule: every safety objective should trace to a design requirement, verification method, validation result, residual-risk owner, runtime monitor, and field trigger. A standard summary alone is not enough.

Sources:

- ISO/TS 5083:2025: https://www.iso.org/standard/81920.html
- ISO 34504:2024: https://www.iso.org/standard/78953.html
- ISO 34505:2025: https://www.iso.org/standard/78954.html
- ASAM OpenSCENARIO DSL: https://publications.pages.asam.net/standards/ASAM_OpenSCENARIO/ASAM_OpenSCENARIO_DSL/latest/scope.html
- ISO 21448 SOTIF: https://www.iso.org/standard/77490.html
- MIT STPA Handbook: https://psas.scripts.mit.edu/home/books-and-handbooks/
- ISO 3691-4:2023: https://www.iso.org/standard/83545.html
- ISO 13849-1:2023: https://www.iso.org/standard/73481.html
- IEC 62061:2021: https://webstore.iec.ch/en/publication/59927
- ISO/PAS 8800:2024: https://www.iso.org/standard/83303.html
- ISO/IEC TR 5469:2024: https://www.iso.org/standard/81283.html
- FAA AGVS guidance: https://www.faa.gov/airports/new_entrants/agvs_on_airports

## Runtime, Cloud, Data, and MLOps Operations

The current runtime and cloud sections cover telemetry, OTA, fleet SRE, map ops, and data pipelines. The missing layer is a release-evidence operating model that connects data, model, scenario, config, fleet state, and deployed behavior.

| Priority | Proposed file or update | Gap Filled | Operating Evidence |
|---|---|---|---|
| P0 | `50-cloud-fleet/mlops/model-governance-release-evidence.md` or promote `50-cloud-fleet/mlops/model-lifecycle-governance.md` | Model release evidence registry. | One release ID tying model registry version, dataset snapshot, training run, eval bundle, model card, approval, canary criteria, deployed fleet manifest, rollback trigger, and post-release logs. |
| P0 | `50-cloud-fleet/data-platform/data-catalog-lineage-quality-ops.md` | AV data catalog, lineage, and quality operations. | Raw logs, extracted streams, labels, scenes, embeddings, splits, synthetic assets, deletion propagation, schema versions, quality gates, replay reproducibility. |
| P0 | `50-cloud-fleet/data-platform/replay-scenario-mining-ops.md` | Operational pipeline from field events to replay, simulation, and regression tests. | Event mining, OpenLABEL/OpenSCENARIO assets, scenario tags, regression queues, ownership states, simulator compatibility records, acceptance metrics. |
| P0 | `40-runtime-systems/software-operations/edge-runtime-supervision-config-management.md` | Runtime config control plane. | Signed config bundles, feature flags, schema validation, watchdog policy, local fallback, offline operation, compatibility matrix, last-known-safe rollback. |
| P1 | `50-cloud-fleet/data-platform/active-labeling-budget-ops.md` or update selective upload | Fleet upload and labeling budget optimization. | Selected/not-selected audit trail, bandwidth/storage constraints, uncertainty and diversity scores, label ROI, bias checks. |
| P1 | `50-cloud-fleet/observability/ml-observability-trace-correlation.md` | Model-aware trace correlation. | Model/config version, route/site/weather, input slices, inference latency, GPU pressure, drift, safety events, operator interventions, incident IDs. |
| P1 | Update `50-cloud-fleet/data-platform/synthetic-data-generation.md` | Synthetic and world-model data governance. | Generator version, prompt/control provenance, real/synthetic mix policy, contamination checks, synthetic-to-real validation, evidence that synthetic data improved release metrics. |
| P1 | `50-cloud-fleet/cloud-operations/finops-capacity-planning.md` | GPU and AI FinOps. | Cost per training run, replay batch, labeling batch, simulation hour, synthetic generation batch, queue policy, capacity-block decision records, utilization, idle burn. |

The highest-value first file is model-governance release evidence, because it can cross-link OTA, SUMS, data lineage, validation, safety case, and deployed fleet manifest content.

Sources:

- EU AI Act Article 12 record keeping: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-12
- ISO/IEC 5259-5 data quality governance: https://www.iso.org/standard/84150.html
- MLflow Model Registry: https://www.mlflow.org/docs/3.0.1/model-registry
- Microsoft AVOps DataOps: https://learn.microsoft.com/en-us/industry/mobility/architecture/autonomous-vehicle-operations-dataops-content
- OpenLineage: https://openlineage.io/
- ASAM OpenLABEL: https://www.asam.net/news-media/detail/news/asam-releases-asam-openlabel-v100/
- ASAM OpenSCENARIO DSL: https://www.asam.net/standards/detail/openscenario-dsl/
- NVIDIA Cosmos AV workflow: https://developer.nvidia.com/blog/simplify-end-to-end-autonomous-vehicle-development-with-new-nvidia-cosmos-world-foundation-models/
- Eclipse uProtocol: https://projects.eclipse.org/projects/automotive.uprotocol
- DUAL fleet upload and active labeling: https://proceedings.mlr.press/v305/akcin25a.html
- OpenTelemetry GenAI conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/
- AWS EC2 Capacity Blocks for ML: https://aws.amazon.com/ec2/capacityblocks/

## Platform Hardware and Physical Integration

The platform tree is strong on sensors, compute, drive-by-wire, TSN, power, ruggedization, and diagnostics. The remaining gaps are integration artifacts: how physical wiring, middleware, timing, compute safety, heat, recorders, calibration, and service infrastructure are specified and verified as one vehicle.

| Priority | Proposed file or update | Gap Filled | Architecture Decisions |
|---|---|---|---|
| P0 | `20-av-platform/networking-connectivity/zonal-ee-harness-connectors.md` | Zonal E/E, Single Pair Ethernet, sensor SerDes, connectors, serviceability. | Network classes, connector ratings, harness service loops, EMI controls, failure isolation, inspection and replacement evidence. |
| P0 | `40-runtime-systems/middleware/vehicle-middleware-dds-someip-zenoh.md` | DDS, SOME/IP, Zenoh, ROS 2 RMW, AUTOSAR bridge policy. | Transport, discovery scope, QoS, deadline/liveliness, zero-copy path, serialization, bridge owner, monitor hooks. |
| P0 | `20-av-platform/compute/safety-certified-runtime-compute.md` | Safety-certified OS, hypervisor, RTOS/Linux partitioning, safety island. | Safe-stop ownership, watchdog/reset tree, mixed-criticality scheduling, lockstep MCU handoff, autonomy-supervised-not-trusted boundary. |
| P0 | `20-av-platform/thermal/vehicle-thermal-management.md` | Whole-vehicle thermal budget. | Worst-case ambient, solar load, sealed enclosure, GPU saturation, SSD sustained write, battery/charger heat, sensor heaters, derating policy. |
| P1 | `40-runtime-systems/data-logging/av-data-recorder-dssad-hardware.md` | AV recorder and DSSAD/EDR evidence hardware. | Tamper-evident local retention, secure time, config/model versions, command state, operator state, sensor health, removable media chain of custody. |
| P1 | `20-av-platform/sensors/calibration-bay-fixtures.md` and `50-cloud-fleet/operations/fleet-calibration-operations.md` | Depot calibration fixtures and fleet calibration workflow. | Fixture ID, target geometry, floor conditions, serials, firmware, extrinsics, residuals, thresholds, work order, technician, drift closure. |
| P1 | Extend `20-av-platform/networking-connectivity/deterministic-networking-tsn.md` or add `whole-vehicle-timebase.md` | Clock-domain and timestamp provenance policy. | Grandmaster ID, offset, drift, holdover state, timestamp origin, timestamp uncertainty, replay/DSSAD traceability. |
| P1 | `20-av-platform/power-electrical/autonomous-charging-service-infrastructure.md` | Autonomous service bay and depot infrastructure. | Charging, cleaning, inspection, data sync, queue orchestration, human exclusion zones, fault recovery, emergency access, airport sponsor approval. |

The runtime rule should be simple: safety island or independent safety controller owns the permissive path to motion and safe stop; Linux/GPU autonomy provides proposals and evidence, not final safety authority.

Sources:

- OPEN Alliance Automotive Ethernet: https://opensig.org/
- ADI 10BASE-T1S zonal architecture: https://www.analog.com/en/resources/analog-dialogue/articles/how-10base-t1s-ethernet-simplifies-zonal-architectures.html
- AUTOSAR DDS service communication: https://www.autosar.org/fileadmin/standards/R25-11/FO/AUTOSAR_FO_PRS_DDSCommunicationProtocol.pdf
- ROS 2 middleware vendors and Zenoh support: https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Different-Middleware-Vendors.html
- QNX OS for Safety: https://qnx.software/en/software/products-and-solutions/qnx-os-and-os-for-safety
- NXP S32G vehicle network processors: https://www.nxp.com/products/processors-and-microcontrollers/s32-automotive-platform/s32g-vehicle-network-processors%3AS32G-PROCESSORS
- IEEE 802.1AS timing: https://1.ieee802.org/maintenance/802-1as-2020-rev/
- Eurotech ADAS/HIL logger: https://www.eurotech.com/products/dynacor-62-10-adas-hil-logger-edition/
- IEEE 1616.1 DSSAD: https://standards.ieee.org/ieee/1616.1/10939/
- Bosch ADAS calibration: https://boschdiagnostics.com/products/adas-calibration-solution
- Hunter Ultimate ADAS: https://www.hunter.com/adas-equipment/ultimate-adas/
- FAA AGVS guidance: https://www.faa.gov/airports/new_entrants/agvs_on_airports

## Foundational Assurance Methods

The knowledge base has many strong estimation, optimization, geometry, probability, and machine-learning primers. The remaining foundations are not another perception or SLAM method; they are the systems-assurance methods that make runtime and safety arguments defensible.

| Priority | Proposed file | What It Should Teach | Airside Evidence Artifact |
|---|---|---|---|
| P0 | `10-knowledge-base/systems-engineering/real-time-scheduling-wcet-mixed-criticality.md` | Task model `(C, T, D, J)`, RM, deadline-monotonic, EDF, response-time analysis, WCET evidence tiers, mixed-criticality mode switch. | Timing budget for perception, planning, brake command, watchdog, safety monitor, teleop link, and minimum-risk condition. |
| P0 | `10-knowledge-base/probability-statistics/rare-event-statistics-safety-validation.md` | Why zero failures only bounds risk, importance sampling, subset simulation, adaptive rare-event sampling, EVT tail modeling, SPRT gates. | Accelerated validation plan for aircraft clearance breach, pedestrian occlusion, FOD, towbar mismatch, stand-entry conflict, low-visibility docking. |
| P0 | `10-knowledge-base/systems-engineering/fault-trees-stpa-hazard-analysis.md` | FMEA, FTA, event trees, minimal cut sets, STPA unsafe control actions, control-loop flaws, human/automation interactions. | Hazard-to-safety-goal trace that links component failures, unsafe control actions, SOTIF triggers, requirements, tests, and GSN claims. |
| P0 | `10-knowledge-base/systems-engineering/odd-scenario-ontology-coverage.md` | ODD taxonomy, scenario categories, logical/concrete scenario generation, marginal/pairwise/t-wise/risk-weighted coverage. | Scenario coverage dashboard that maps hazards and ODD attributes to replay, simulation, HIL, VIL, and field evidence. |

These are `10-knowledge-base` pages, so promotion should include the visual/taxonomy pipeline in the same change: curated visual block, SVG asset, and taxonomy assignment.

Sources:

- AbsInt aiT WCET analysis: https://www.absint.com/ait/index.htm
- Dense deep-reinforcement-learning safety validation: https://www.nature.com/articles/s41586-023-05732-2
- Curse of rarity in autonomous-driving safety validation: https://www.nature.com/articles/s41467-024-49194-0
- NRC Fault Tree Handbook: https://www.nrc.gov/reading-rm/doc-collections/nuregs/staff/sr0492/index
- MIT STPA Handbook: https://psas.scripts.mit.edu/home/books-and-handbooks/
- SAE J3307 STPA standard: https://saemobilus.sae.org/standards/j3307_202503-system-theoretic-process-analysis-stpa-standard-industries
- NIST ADS operating envelope specification: https://www.nist.gov/publications/automated-driving-system-safety-measurement-part-1-operating-envelope-specification
- ISO 34503 ODD taxonomy: https://www.iso.org/standard/78952.html
- ISO 34504 scenario categorization: https://www.iso.org/standard/78953.html
- ISO 34505 test-case generation: https://www.iso.org/standard/78954.html

## Closed-Loop Autonomy Evaluation

The autonomy stack already covers VLA/VLM reliability, end-to-end driving, planning, world models, and simulation. The current gap is a closed-loop evaluation protocol that ties language/action models, scenario libraries, risk forecasting, real-to-sim, and field-event regression into one release gate.

| Priority | Proposed update | Gap Filled | Evaluation Content |
|---|---|---|---|
| P0 | Update `30-autonomy-stack/vla-vlm/vlm-vla-reliability-benchmarks.md` | Bench2ADVLM, SafeVL, DSBench, DriveAction. | Closed-loop VLM/VLA evaluation, safety-critic scoring, action-level checks, hallucination and prompt-failure slices. |
| P0 | Update `30-autonomy-stack/end-to-end-driving/airside-autonomy-benchmark-spec.md` | Airside closed-loop VLA/VLM protocol. | Static QA, replay QA, CARLA/AWSIM closed loop, real-to-sim from airport logs, physical low-speed cart tests. |
| P0 | `60-safety-validation/verification-validation/safety-critical-scenario-libraries.md` | Safety2Drive-style scenario library. | Regulatory scenario tags, corruptions, adversarial variants, hazard-to-scenario mapping, scenario-to-validation workflow. |
| P1 | `30-autonomy-stack/planning/risk-forecasting-long-tail.md` or update motion prediction | RiskNet-style future risk fields. | Interaction risk for converging GSE, personnel, wingtip clearance, service-road merges, stand conflicts. |
| P1 | Update airside and neural simulation pages | RealEngine and DriveE2E real-to-sim closed-loop benchmark pattern. | Field-event mining, scene reconstruction, counterfactual actors/weather/lighting, simulator acceptance metrics. |
| P1 | Update `30-autonomy-stack/multi-agent-v2x/v2x-cooperative-planning.md` | LangCoop as a bounded side-channel. | Natural-language intent summaries only with structured schema, provenance, expiry, contradiction handling, and safety limits. |
| P1 | Update `60-safety-validation/safety-case/safety-case-evidence-traceability.md` | Driver-Simulator-Critic flywheel. | Field event to scenario to critic to fix to regression evidence to release gate. |

Release gate: no VLA/VLM update passes unless it improves or preserves closed-loop collision rate, intervention rate, rule violations, false-clear rate, hallucination rate, and scenario-family coverage. Safety critics should remain advisory unless backed by independent geometric and runtime assurance monitors.

Sources:

- Bench2ADVLM: https://arxiv.org/abs/2508.02028
- Safety2Drive: https://arxiv.org/abs/2505.13872
- SafeVL: https://safevl.github.io/
- DSBench: https://arxiv.org/abs/2511.14592
- DriveAction: https://arxiv.org/abs/2506.05667
- RiskNet: https://arxiv.org/abs/2504.15541
- RealEngine: https://arxiv.org/abs/2505.16902
- DriveE2E: https://arxiv.org/abs/2509.23922
- LangCoop: https://arxiv.org/abs/2504.13406
- Waymo demonstrably safe AI: https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/
- Waymo World Model: https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/
- ASAM OpenSCENARIO DSL: https://publications.pages.asam.net/standards/ASAM_OpenSCENARIO/ASAM_OpenSCENARIO_DSL/latest/index.html

## Cross-Domain Operations, Regulation, and Deployment Evidence

The operations domain now covers airside, warehouse, yard, port, mining, agriculture, construction, trucking, robotaxi, and delivery robots. The remaining gap is cross-domain evidence: a regulatory map and source-dated deployment ledger that let readers compare maturity without relying on vendor narratives.

| Priority | Proposed file | Gap Filled | Required Fields |
|---|---|---|---|
| P0 | `80-industry-intel/regulations/cross-domain-autonomy-regulatory-map.md` | Approval matrix across airside, warehouse, yard, port, mining, agriculture/construction, and sidewalk robots. | Domain, equipment class, site authority, standards, human supervision, reporting duty, approval artifacts, safety-function evidence. |
| P0 | `80-industry-intel/deployments/2024-2026-autonomy-deployment-index.md` | Neutral deployment ledger. | Operator, site, ODD, vehicle type, scale, safety-driver status, approval basis, metrics, source date, caveats. |
| P0 | `60-safety-validation/standards-certification/airside-agvs-regulatory-approval-playbook.md` | Airside deployment approval workflow. | Controlled tests, closed movement-area rules, human monitor, RF/aeronautical study, airport sponsor signoff, tenant coordination. |
| P1 | `80-industry-intel/companies/<company>/tech-stack.md` | Deployment-proof company profiles. | ISEE, Outrider, Fox Robotics, Locus, Kalmar, Komatsu, Caterpillar, John Deere, Serve Robotics, Starship. |
| P1 | `70-operations-domains/cross-domain/mapping-operations/indoor-outdoor-map-ops-playbook.md` | Cross-domain mapping operations. | Site survey, map owner, route approval, geofence release, map-change control, WMS/YMS/TOS/AODB integration. |

Transfer lessons:

- Airside AGVS approval is staged: sponsor risk acceptance, route markings, remote supervision, worker redesign, and regulator coordination matter as much as vehicle autonomy.
- Yard autonomy is the closest airside analog: mixed traffic, precise coupling/backing, YMS/WMS/TMS integration, factory acceptance, and site acceptance.
- Warehouse and port autonomy show that repeatable brownfield workflows and control-system integration beat general autonomy claims.
- Mining autonomy shows the value of site design, dispatch discipline, exclusion zones, maintenance workflows, and support tooling.
- Sidewalk robots show that public or shared-space autonomy can fail politically before it fails technically; airside programs have analogous tenant, union, insurer, and airport-ops acceptance gates.

Sources:

- FAA AGVS guidance: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- UISEE Changi launch: https://www.uisee.com/en/article226-news2.html
- EU Machinery Regulation 2023/1230: https://osha.europa.eu/en/legislation/directive/regulation-20231230eu-machinery
- ISO 3691-4:2023: https://www.iso.org/standard/83545.html
- ISEE/TICO autonomous yard trucks: https://www.isee.ai/news/business-wire-isee-and-tico-announce-strategic-partnership-to-deliver-industry-first-fully-integrated-autonomous-yard-trucks-to-customer-operations
- Outrider safety system: https://www.outrider.ai/press-releases/outrider-builds-first-in-industry-safety-system-for-driverless-yard-operations/
- Fox/Walmart autonomous forklifts: https://foxrobotics.com/blog/walmart-and-fox-robotics-enter-into-multi-year-commercial-agreement-walmart-invests-growth-capital/
- DHL/Locus 500M picks: https://group.dhl.com/en/media-relations/press-releases/2024/dhl-supply-chain-passes-unprecedented-500-million-picks-milestone-using-locus-robotics-autonomous-mobile-robots.html
- Kalmar One standalone software: https://www.kalmarglobal.com/news--insights/articles/2025/kalmar-one-now-available-as-standalone-software-solution/
- Komatsu 1,000 autonomous haul trucks: https://www.komatsu.com/en-us/newsroom/2026/komatsu-becomes-first-oem-to-commission-1000-ultra-class-autonomous-haul-trucks
- Caterpillar autonomy scaling: https://www.caterpillar.com/en/news/caterpillarNews/2026/scaling-autonomy-system.html
- John Deere CES 2025 autonomy: https://www.deere.com/en/news/all-news/autonomous-9RX/
- Serve FY2025 robot deployment: https://ir.serverobotics.com/node/9401/pdf
- San Francisco Public Works Code Sec. 794: https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_publicworks/0-0-0-48516

## Promotion Queue

Use this order for the next atomic-file wave:

1. Create the safety standards and evidence package: ISO/TS 5083, ISO 3450x scenario evidence, airside HARA/STPA/SOTIF, PLd/SIL safety functions, ML assurance governance, and airside AGVS approval.
2. Create the runtime release-evidence package: model governance release evidence, data catalog/lineage/quality ops, replay-scenario mining ops, and edge runtime supervision/config management.
3. Create the platform integration package: zonal E/E harness/connectors, vehicle middleware decision guide, safety-certified runtime compute, vehicle thermal management, and DSSAD recorder hardware.
4. Create the four foundational assurance pages with the `10-knowledge-base` visual/taxonomy pipeline.
5. Update VLA/VLM reliability and airside benchmark specs with closed-loop evaluation, safety-critic, scenario-library, risk-forecasting, and real-to-sim gates.
6. Add the cross-domain regulatory map and deployment index before expanding individual company profiles, so company pages can inherit a shared evidence schema.

## Do Not Over-Promote Yet

Keep these as watchlist or advisory patterns until stronger evidence exists: direct VLA actuation without independent monitors, natural-language V2X as sole authority, synthetic/world-model data gains without contamination and holdout checks, company-scale claims without dated deployment-source ledgers, and standards pages that summarize rules without producing artifact-level acceptance criteria.
