# Runtime Monitor Qualification Evidence

**Last updated:** 2026-05-09

## Purpose

Runtime monitors are safety controls only when they are specified, validated, integrated, observed, and maintained. This page defines the evidence needed to qualify monitors that supervise perception, SLAM/localization, timing, calibration, free-space, unknown/OOD objects, maps, and ODD boundaries.

## Qualification Levels

| Level | Meaning | Release use |
|---|---|---|
| MQ0 | Diagnostic only; logs a signal but has no validated action | Cannot support a safety claim |
| MQ1 | Thresholded alert with owner and dashboard | Supports operations watch only |
| MQ2 | Validated alert with replay/fault-injection evidence and runbook | Supports canary gates |
| MQ3 | On-vehicle action integrated and tested under nominal/fault cases | Supports safety control claim |
| MQ4 | Field performance monitored with periodic requalification and change control | Supports steady-state production claim |

## Evidence Model

| Evidence | Minimum contents |
|---|---|
| Monitor requirement | Hazard, claim, signal, threshold, ODD scope, consumer action |
| Algorithm spec | Inputs, timing, filtering, state machine, latch/reset, assumptions, known limits |
| Data validity | Required schemas, units, frames, time source, missing-data handling |
| Threshold derivation | Calibration partition, locked test partition, confidence interval, slice analysis |
| Fault injection | Injected fault, expected detection, detection latency, false negative result |
| Integration proof | Planner/runtime/vehicle action test for yellow, red, unknown, missing monitor |
| Resource budget | CPU/GPU/memory/latency and interference analysis |
| False alarm analysis | Rate by ODD slice, suppression policy, operator workload |
| Field monitoring | Precision/recall proxy, alert outcomes, missed-event review, drift |
| Change record | Version, thresholds, schema, evidence IDs, approval |

## Monitor Classes

| Monitor | Safety purpose | Qualification focus |
|---|---|---|
| Timing monitor | Prevent stale/future/misaligned sensor data | Timestamp sweep, PTP/PHC failure, TF/message-filter reject behavior |
| Localization integrity | Prevent wrong-pose operation | Residual-to-error calibration, covariance/protection-level coverage, relocalization loss |
| Free-space monitor | Prevent false traversable space | Protected-zone false-free-space tests, unknown conservatism |
| Unknown/OOD monitor | Prevent novel object suppression | Open-world/OOD benchmarks, closed-course unknown fixtures, actionability |
| Calibration monitor | Detect extrinsic/time drift | Miscalibration injection, scene degeneracy handling, maintenance workflow |
| Map disagreement monitor | Catch stale/wrong map assumptions | Map tile disagreement, overlay expiry, field ticket closure |
| Model-runtime monitor | Prevent overloaded or incompatible inference | Engine compatibility, p99 latency, GPU memory, model readiness |
| ODD monitor | Keep operation inside validated domain | Weather/site/routing boundary detection and enforced restriction |

## Qualification Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| Q0 trace | Monitor maps to hazard, claim, requirement, and action | Monitor exists only as dashboard panel |
| Q1 input validity | Inputs include frame/time/provenance/schema and missing-data policy | Missing signal can be interpreted as green |
| Q2 threshold | Threshold derived from independent data and locked before test | Threshold tuned on incident or test set without record |
| Q3 detection | Injected credible faults are detected before unsafe consumer output | Fault remains silent until after planner consumes unsafe state |
| Q4 action | Vehicle/planner/runtime response occurs for yellow/red/unknown | Alert fires but no safety action occurs where claimed |
| Q5 robustness | False alarm and false negative behavior reviewed by ODD slice | Aggregate metric hides high-risk route or weather slice |
| Q6 observability | Alert joins evidence IDs and reaches owner | Cannot reconstruct monitor decision |
| Q7 change control | Monitor version and threshold changes go through release process | Field threshold edited without safety review |

## Fault-Injection Patterns

| Fault | Expected monitor behavior |
|---|---|
| Sensor timestamp offset | Timing state yellow/red before fusion accepts stale/future data |
| LiDAR-camera yaw perturbation | Calibration state red or unknown-object/free-space conservatism increases |
| LiDAR beam dropout | Sensor/perception uncertainty rises and false-free-space remains blocked |
| Map tile mismatch | Map mismatch alert and route hold |
| Pose covariance under-reporting | Integrity monitor catches residual/protection-level inconsistency |
| Unknown object in route | OOD/unknown monitor produces obstacle/stop/review action |
| Model engine mismatch | Runtime monitor prevents activation or marks model unavailable |

## Field Performance Review

| Cadence | Review item |
|---|---|
| Every release | Monitor versions, thresholds, evidence freshness, changed consumers |
| Weekly during canary | Alert counts, unresolved P0/P1, suppression list, false alarm burden |
| Monthly steady state | Missed events, incident linkage, drift trends, maintenance correlation |
| After incident | Whether monitor fired, fired late, action failed, or evidence was insufficient |
| After ODD/site change | Requalification for affected slices and assumptions |

## Evidence Artifacts

| Artifact | Storage target |
|---|---|
| Monitor qualification report | Safety evidence store |
| Threshold manifest | Release artifact registry |
| Fault-injection logs | Data lake with bag/MCAP pointers |
| Monitor-to-action integration test | CI/HIL report |
| Alert/runbook closure records | Incident system |
| Field performance dashboard export | Fleet SRE evidence |
| Safety-case trace update | Evidence graph |

## Related Repository Docs

- `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`
- `60-safety-validation/runtime-assurance/online-perception-monitoring-odd-enforcement.md`
- `60-safety-validation/runtime-assurance/simplex-safety-architecture.md`
- `60-safety-validation/verification-validation/sensor-dropout-latency-jitter-stress-protocol.md`
- `60-safety-validation/verification-validation/robustness/perception-slam-corruption-fault-injection-protocol.md`
- `50-cloud-fleet/observability/perception-slam-alert-runbooks.md`

## Sources

- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
- ISO/TS 5083:2025, ADS safety design, verification and validation: https://www.iso.org/standard/81920.html
- UL 4600 Ed. 3, Evaluation of Autonomous Products: https://webstore.ansi.org/standards/ul/ul4600ed2023
- Waymo, "Building a Credible Case for Safety": https://arxiv.org/abs/2306.01917
- Testing the Fault-Tolerance of Multi-Sensor Fusion Perception: https://arxiv.org/abs/2504.13420
- Autoware AD API diagnostics: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- OpenTelemetry telemetry schemas: https://opentelemetry.io/docs/specs/otel/schemas/
