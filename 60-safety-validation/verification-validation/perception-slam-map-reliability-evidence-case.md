# Perception-SLAM Map Reliability Evidence Case

**Last updated:** 2026-05-09

## Purpose

This evidence case defines the safety argument and artifact package required to release a perception-SLAM stack and its HD/localization map for airside autonomous ground vehicle operation. It treats map reliability as a safety property: the vehicle must localize, perceive, and reason about free space without being misled by stale infrastructure, transient aircraft/GSE, sensor corruption, map ghosts, or uncalibrated uncertainty.

This file is the top-level evidence wrapper for:

- [Perception-SLAM statistical validity protocol](perception-slam-statistical-validity-protocol.md)
- [Uncertainty calibration and release gates](uncertainty-calibration-perception-slam-release-gates.md)
- [Perception-SLAM corruption and fault injection protocol](robustness/perception-slam-corruption-fault-injection-protocol.md)
- [SLAM map benchmark protocol](slam-map-benchmark-protocol.md)
- [Perception-SLAM fleet data contract](../../50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md)
- [Safety-case evidence traceability](../safety-case/safety-case-evidence-traceability.md)
- [Failure modes analysis](../safety-case/failure-modes-analysis.md)
- [Shadow mode validation](shadow-mode.md)

## Safety Claim

**Claim MSR-1:** For the approved airside ODD, the released perception-SLAM stack and map package provide localization, obstacle interpretation, static-world representation, and uncertainty signals that are reliable enough to support the operational safety case.

This claim is accepted only when the evidence below is complete, reproducible, and traceable to a specific vehicle configuration, map version, software build, sensor calibration, ODD, and release gate decision.

## Argument Structure

| Argument node | Required evidence | Acceptance rule |
|---|---|---|
| ODD is explicit | Airport, route class, speed envelope, lighting, weather, GNSS availability, apron/taxiway/service-road zone, aircraft proximity class | ODD file and scenario taxonomy are versioned; no test result is accepted without ODD tags |
| Map is geometrically reliable | Ground-truth survey, repeated traversals, ATE/RPE, scan-to-map residuals, loop-closure error, map tile QA | All mandatory benchmark slices pass the [SLAM map benchmark protocol](slam-map-benchmark-protocol.md) |
| Map is semantically reliable | Static/movable/dynamic/FOD/hazard layer labels, reviewer agreement, false-free-space analysis | No critical false-free-space defect in release-candidate tiles |
| Localization failures are bounded | Degradation detection, covariance/score calibration, relocalization latency, fallback behavior | Failures trigger speed reduction, controlled stop, map quarantine, or remote review within design limits |
| Perception and SLAM withstand credible corruptions | Sensor dropout, beam loss, fog/rain/spray, time skew, extrinsic drift, GNSS denial, stale map, moving-object injection | Corruption campaign passes release thresholds in the robustness protocol |
| Statistical claims are defensible | Pre-registered metrics, confidence intervals, sequential test rules, sample independence controls | Statistical release decision follows [perception-slam-statistical-validity-protocol.md](perception-slam-statistical-validity-protocol.md) |
| Uncertainty is useful operationally | Calibration curves, ECE/NLL/Brier, conformal coverage, risk bins, alert precision | Calibration gates pass in [uncertainty-calibration-perception-slam-release-gates.md](uncertainty-calibration-perception-slam-release-gates.md) |
| Fleet monitoring closes the loop | Data contract, event triggers, map defect reports, SGO-style incident metadata, post-release dashboards | Fleet data satisfies [perception-slam-fleet-data-contract.md](../../50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md) |

## ODD and Airside Relevance

The evidence case must be sliced by airside operating context, not only by aggregate mileage:

| ODD slice | Reliability concern | Minimum evidence |
|---|---|---|
| Apron stand approach | Aircraft geometry, temporary GSE, personnel, chocks, cones, jet bridge occlusion | Stand-specific map QA, aircraft-present/absent traversals, movable-static classification review |
| Service road transit | Repeated route localization, occluding parked vehicles, road markings, speed bumps | Multi-session localization drift and relocalization tests |
| Taxiway crossing support | Geofence precision, clearance state, line marking interpretation, wide open spaces with weak features | Map-to-geofence consistency, GNSS/INS degradation tests, route-level hazard review |
| Depot/maintenance area | Dense parked vehicles, charging equipment, frequent layout changes | High-frequency map-change detection and quarantine evidence |
| Night/wet/heavy rain | LiDAR/camera degradation, reflections, missing ground returns | Weather-tagged benchmark and corruption campaign results |
| De-icing or jet blast adjacency | Spray, thermal distortion, debris, visibility changes | Operational exclusion or explicit sensor robustness evidence |

## Evidence Artifacts

Each release candidate creates an immutable evidence bundle:

| Artifact | Owner | Required content |
|---|---|---|
| Evidence manifest | Safety validation lead | Build ID, map ID, calibration ID, vehicle config, ODD, test campaign IDs, approval status |
| Map package manifest | Mapping lead | Tile hashes, coordinate frames, source sessions, survey reference, semantic layer versions |
| Dataset manifest | Data platform owner | Bag/MCAP IDs, scenario tags, weather/light tags, sensor health, privacy/export controls |
| Benchmark report | V&V lead | Metric tables, confidence intervals, failed slices, residual risk notes |
| Robustness campaign report | Perception owner | Corruption matrix, fault injection seeds, severity levels, observed failure modes |
| Calibration report | ML/perception owner | Reliability diagrams, ECE/NLL/Brier, conformal coverage, calibration-set provenance |
| Shadow-mode report | Fleet ops owner | Disengagements, interventions, map-localization alerts, route exposure, operator notes |
| Defect disposition log | Safety board | Open defects, severity, mitigations, waiver rationale, expiry date |
| Release decision record | Release manager | Gate results, sign-offs, rollback target, post-release monitoring window |

## Core Metrics

| Metric | Definition | Safety interpretation |
|---|---|---|
| Absolute trajectory error (ATE) | Global pose error against ground truth or surveyed trajectory | Long-horizon localization and map alignment health |
| Relative pose error (RPE) | Local motion error over fixed intervals | Short-horizon stability relevant to planning and control |
| Scan-to-map residual | Distance/intensity/semantic residual between current scan and map | Online indicator of stale map or localization degradation |
| Relocalization success | Fraction of localization-loss events recovered within time/distance budget | Ability to recover without unsafe drift |
| False-free-space rate | Cases where the map/perception stack marks occupied or hazardous space as traversable | Critical safety metric; zero tolerance in protected zones |
| Static preservation | Fraction of valid static structure retained across map updates | Protects localization features and infrastructure geometry |
| Dynamic ghost rate | Transient aircraft/GSE/person points promoted to static map | Prevents stale obstacles and localization bias |
| Movable-static review precision | Correct routing of temporary barriers, cones, carts, and parked GSE to review/quarantine | Prevents unsafe automatic map publication |
| Uncertainty coverage | Empirical error rate inside declared pose/object/map confidence sets | Determines whether runtime monitors can trust uncertainty |

## Release Gates

| Gate | Entry condition | Pass condition | Block condition |
|---|---|---|---|
| G0 configuration freeze | Candidate software, sensor calibration, and map package are hashed | No untracked binary/model/map artifacts | Missing config traceability |
| G1 offline benchmark | Public/proxy and internal airside datasets are processed | All critical metrics pass by ODD slice | Any critical false-free-space or localization-loss defect |
| G2 corruption and fault injection | Baseline benchmark has passed | No unmitigated catastrophic/high-severity failure under credible corruptions | Sensor fault produces silent overconfidence |
| G3 statistical validity | Sample plan and metric definitions are locked | Confidence/credible intervals meet the statistical protocol | Cherry-picked data, leaked test set, or underpowered claim |
| G4 uncertainty calibration | Independent calibration and test partitions exist | ECE/NLL/conformal coverage gates pass by risk slice | Overconfident errors near aircraft, people, or geofence boundaries |
| G5 shadow mode | Vehicle operates non-autonomously or under safety operator | No unresolved critical events; intervention rate below threshold | Repeated unexplained localization or map inconsistency alerts |
| G6 safety board release | All reports are complete | Safety, mapping, perception, data, fleet ops, and release owner sign | Open critical defect without approved ODD restriction |
| G7 post-release watch | OTA/map release is deployed to limited fleet | 7-day watch passes with no new critical regression | Rollback, route disable, or map quarantine triggered |

## Failure Modes Covered

| Failure mode | Detection evidence | Mitigation evidence |
|---|---|---|
| Stale map after stand layout change | Map-change detector, reviewer report, scan-to-map residual | Tile quarantine, temporary ODD restriction, remote operator bulletin |
| Aircraft/GSE ghost in static map | Dynamic rejection test, aircraft-present/absent pair comparison | Movable-static layer, human review, map publication block |
| False free space around FOD or chocks | FOD/hazard slice evaluation, airside dynamic map cleaning checks | Preserve as current-world alert, reduce speed, route block |
| GNSS denial or multipath | GNSS dropout and spoofing tests | LiDAR-inertial fallback, covariance inflation, controlled stop |
| Sensor extrinsic drift | Calibration residual monitors, cross-sensor consistency | Maintenance hold, calibration refresh, fault isolation |
| Time synchronization skew | Timestamp fault injection, residual jump detection | Time-sync alert, data invalidation, degraded mode |
| Weather-induced overconfidence | Rain/fog/wet-ground corruption tests and calibration bins | Sensor health gating, radar/thermal fallback, ODD restriction |
| Loop closure into wrong place | Repeated-route benchmark, topological consistency checks | Candidate loop review, map rollback, relocalization guard |
| Overfit benchmark release | Dataset lineage, holdout controls, pre-registration | Locked test set, blind review, fleet validation |

## Owner Handoffs

| From | To | Handoff package |
|---|---|---|
| Mapping | V&V | Map package, source traversals, survey reference, map-change log |
| Perception/SLAM | V&V | Build, model weights, calibration, runtime diagnostics schema |
| V&V | Safety board | Benchmark, robustness, calibration, and statistical decision reports |
| Data platform | V&V and safety | Dataset manifests, data quality report, retention/legal flags |
| Fleet operations | Safety board | Shadow-mode exposure, interventions, operator reports, route restrictions |
| Safety board | Release management | Signed release decision, ODD restrictions, rollback conditions |
| Release management | Fleet operations | Deployment plan, watch metrics, rollback package, communication notes |

## Minimum Evidence by Release Type

| Release type | Required gates | Notes |
|---|---|---|
| Patch with no perception/SLAM/map behavior change | G0, regression subset, G6, G7 | Requires static proof that behavior is unaffected |
| Map tile update inside existing airport | G0, G1 tile benchmark, G3 sample check, G5 limited shadow, G6, G7 | Use stricter rules near aircraft stands and taxiway crossings |
| New airport or materially new ODD | G0 through G7 | Treat as a new validation campaign |
| Sensor calibration update | G0, G1, G2 extrinsic/time-sync faults, G4, G6, G7 | Include cross-sensor alignment and calibration drift evidence |
| Model/perception update affecting uncertainty | G0 through G7 | Calibration and conformal evidence cannot be waived |

## Sources

- ISO 34502:2022, scenario-based safety evaluation framework: https://www.iso.org/standard/78951.html
- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
- UL 4600 Ed. 3, Evaluation of Autonomous Products: https://webstore.ansi.org/standards/ul/ul4600ed2023
- RAND, "Driving to Safety": https://www.rand.org/content/dam/rand/pubs/research_reports/RR1400/RR1478/RAND_RR1478.pdf
- Waymo Safety Methodologies and Safety Readiness Determinations: https://arxiv.org/abs/2011.00054
- Waymo Safety Impact Hub: https://waymo.com/safety/impact/
- NHTSA Standing General Order on Crash Reporting: https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting
- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- TUM RGB-D SLAM Dataset and Benchmark: https://cvg.cit.tum.de/data/datasets/rgbd-dataset
- Oxford RobotCar Dataset: https://robotcar-dataset.robots.ox.ac.uk/
- Boreas multi-season autonomous driving dataset: https://www.boreas.utias.utoronto.ca/
- SLAMBench open-source framework: https://github.com/pamela-project/slambench
