# Perception Free-Space and Unknown-Object Safety Case

**Last updated:** 2026-05-09

## Purpose

This safety-case page defines the argument, evidence, monitors, and operational response for perception free-space and unknown-object handling. It focuses on the highest-risk failure: the autonomy stack believes space is traversable when it is occupied, unknown, out-of-distribution, stale, or insufficiently observed.

## Top-Level Claim

The vehicle only plans through free space that is sufficiently observed, current, aligned to the active map and pose, and valid for the current ODD. Unknown objects, unknown cells, OOD occupancy, and stale or conflicting evidence are handled conservatively before they can create an unsafe interaction with aircraft, people, GSE, infrastructure, FOD, or protected zones.

## Hazard Table

| Hazard | Cause | Safety requirement | Evidence |
|---|---|---|---|
| False free space near aircraft | Reflection, sparse LiDAR, bad map, wrong calibration | High-confidence free-space false positive is a release blocker in protected zones | Closed-course fixtures, replay labels, calibration drift injection |
| Unknown object ignored | Open-set object not in training ontology, low confidence, novel GSE | Unknown/OOD object in route corridor is treated as obstacle or review-triggering hazard | OpenAD/OOD tests, internal airside unknown-object set |
| Small hazard over-cleaned | FOD, chock, cone, hose classified as noise | Safety-relevant small objects are retained as current hazards until cleared | FOD benchmark, map-cleaning false-deletion test |
| Stale obstacle/free-space grid | Timing fault, dropped sensor, TF future/past extrapolation | Stale data is rejected and triggers degraded mode | Timestamp shift, latency/jitter, message-filter validation |
| Wrong pose makes map free space unsafe | Localization drift or wrong map tile | Pose integrity red blocks autonomous motion | SLAM benchmark, map-localization timing gates |
| Map says clear but site changed | Temporary GSE, parked aircraft, expired overlay | Perception-map disagreement creates ticket or route hold | Map hygiene monitoring and source-session evidence |
| ODD condition invalidates perception | Heavy rain, wet glare, fog, de-icing spray, low sun | ODD monitor restricts operation or increases conservatism | Adverse-condition replay, site shadow mode |

## Safety Requirements

| ID | Requirement | Runtime action |
|---|---|---|
| FS-01 | Unknown occupancy is not traversable inside route corridor, aircraft clearance envelope, pedestrian zone, geofence edge, or stop region | Planner treats unknown as blocked or reduces speed to validated crawl behavior |
| FS-02 | Free-space output includes observation age, source sensors, unknown ratio, and confidence/uncertainty | Monitor rejects stale or unsupported free-space |
| FS-03 | Unknown/OOD object score above threshold near route corridor produces an obstacle, stop, or remote-review request | Do not suppress solely on low class confidence |
| FS-04 | Free-space and object outputs are tied to valid pose, map tile, calibration, and time state | Contract violation marks perception-SLAM red/unknown |
| FS-05 | Map-cleaning and dynamic-object removal never delete FOD or temporary hazards without review evidence | Map tile quarantine and safety review |
| FS-06 | Any release-changing threshold has an owner, validation partition, locked test partition, and field monitor | SUMS/safety board approval |
| FS-07 | Field incidents preserve raw evidence before aggregation or retention expiry | Incident trace includes bag/MCAP, active manifest, monitor actions |

## Argument and Evidence

| Claim | Evidence needed | Acceptance rule |
|---|---|---|
| C1 free-space semantics are conservative | Interface contract, planner integration test, occupancy encoding test | Unknown/free/occupied encoding cannot be inverted or silently changed |
| C2 perception detects safety-relevant obstacles | Labeled object/FOD/aircraft/GSE/person slices, false-negative review | No high-risk class regression in locked release slice |
| C3 unknown and OOD are actionable | OOD/unknown benchmark, monitor-to-action test, field alert route | Unknown/OOD alert leads to obstacle, stop, route hold, or review |
| C4 timing and localization do not invalidate free-space | Timestamp sweep, TF/message-filter validation, pose integrity tests | Free-space is rejected when pose/time are red |
| C5 calibration drift is detected before unsafe output | Miscalibration injection and downstream free-space impact | Monitor red occurs before false-free-space threshold is exceeded |
| C6 maps do not overwrite current hazards | Map hygiene QA, FOD retention tests, overlay expiry tests | Hazard/current layer wins over stale permanent free-space |
| C7 safety case stays live after deployment | Dashboard, incident review, CAPA trace to claims | Field alerts update assumptions, thresholds, or ODD restrictions |

## Runtime Monitors

| Monitor | Signal | Red condition |
|---|---|---|
| Free-space conservatism | Unknown area, observation age, sensor support, false-free-space sentinel zones | Free cell lacks current observation in protected route zone |
| Unknown/OOD object | OOD voxel/object score, open-world detector, track persistence, cross-modal disagreement | Novel/unknown object overlaps route corridor or aircraft clearance |
| Sensor-fusion consistency | LiDAR/radar/camera disagreement, track residuals, point density | Redundant modalities disagree beyond validated envelope |
| Pose-map integrity | Pose covariance/protection level, scan-match residual, map tile ID | Pose uncertainty exceeds route threshold or wrong tile active |
| Calibration health | Pair residuals, projection confidence, time offset | A consumed pair exceeds red threshold |
| Timing health | PTP/PHC state, stamp age, skew, TF failures | Stale/future data could feed planner |

## Release Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| S0 traceability | Each requirement maps to hazard, test, monitor, and release evidence | Orphaned free-space or unknown-object requirement |
| S1 nominal | Free-space/object metrics pass by airside ODD slice | Aggregate pass hides aircraft/person/FOD slice failure |
| S2 open-world | Unknown/OOD objects produce conservative action in replay and closed-course tests | Unknown object is confidently mapped to free space |
| S3 corruption | Rain, beam loss, glare, timing skew, extrinsic drift increase uncertainty or trigger degradation | Silent overconfidence under credible corruption |
| S4 closed-course | Fixtures for aircraft/GSE/FOD/cones/chocks/protected zones pass | Any false-free-space in protected zone |
| S5 shadow mode | Field disagreement and unknown-object alert rate inside validation envelope | Alert cluster unresolved or operator intervention pattern worsens |
| S6 operations | Runbooks, training, incident evidence retention, and stop authority are active | No operational response for red monitor |

## Operational Response

| Event | Vehicle response | Fleet response |
|---|---|---|
| Unknown object in route corridor | Slow, stop, or remote-assist according to route risk | Create event; preserve log window; review label/ontology |
| Free-space monitor red | Controlled stop unless validated crawl mode applies | Block canary promotion; inspect timing, calibration, map, weather |
| Map-perception disagreement cluster | Avoid/hold affected zone | Quarantine tile or create temporary overlay |
| ODD boundary exceeded | Enforce ODD restriction | Update site operations and safety-case assumption |
| Repeated false alarm | Keep safe behavior; tune only through release process | Analyze false positives with safety lead approval |

## Residual Risk Rules

- Public datasets and leaderboards do not prove airside safety; they only support generic comparability and regression detection.
- Low false-positive pressure cannot justify suppressing unknown objects near aircraft, people, geofence boundaries, or FOD-sensitive zones.
- A monitor that only logs but does not affect behavior is diagnostic evidence, not a safety control.
- Unknown telemetry or missing diagnostics cannot be counted as safe exposure.

## Related Repository Docs

- `60-safety-validation/safety-case/safety-case-evidence-traceability.md`
- `60-safety-validation/runtime-assurance/online-perception-monitoring-odd-enforcement.md`
- `60-safety-validation/runtime-assurance/monitor-qualification-evidence.md`
- `60-safety-validation/verification-validation/uncertainty-calibration-perception-slam-release-gates.md`
- `60-safety-validation/verification-validation/robustness/fod-retention-map-cleaning-safety-case.md`
- `50-cloud-fleet/observability/map-hygiene-operational-monitoring.md`

## Sources

- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
- ISO/TS 5083:2025, Road vehicles - Safety for automated driving systems: https://www.iso.org/standard/81920.html
- UL 4600 Ed. 3, Evaluation of Autonomous Products: https://webstore.ansi.org/standards/ul/ul4600ed2023
- Waymo, "Building a Credible Case for Safety": https://arxiv.org/abs/2306.01917
- Waymo, "Safety Methodologies and Safety Readiness Determinations": https://arxiv.org/abs/2011.00054
- ProOOD, Prototype-Guided Out-of-Distribution 3D Occupancy Prediction: https://arxiv.org/abs/2604.01081
- OpenAD benchmark repository: https://github.com/VDIGPKU/OpenAD
- Testing the Fault-Tolerance of Multi-Sensor Fusion Perception: https://arxiv.org/abs/2504.13420
