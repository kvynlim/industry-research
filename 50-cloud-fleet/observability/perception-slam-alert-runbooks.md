# Perception-SLAM Alert Runbooks

**Last updated:** 2026-05-09

## Purpose

This page defines fleet runbooks for perception, SLAM/localization, map, calibration, timing, model-runtime, and compatibility alerts. Alerts are operational controls only when they route to an owner, trigger a vehicle or fleet action, preserve evidence, and close with a disposition.

## Severity Model

| Severity | Meaning | Response target | Examples |
|---|---|---|---|
| P0 | Immediate safety risk or vehicle action required | Vehicle action immediately; fleet incident within operational SLA | Free-space red, pose integrity red, wrong map active, calibration red while moving |
| P1 | Safety margin degraded or release/canary at risk | Triage during shift; pause promotion | Timing yellow/red, repeated TF failures, unknown-object cluster |
| P2 | Reliability issue with owner action | Ticket within normal operations | Intermittent diagnostics stale, map disagreement watch |
| P3 | Evidence or dashboard hygiene | Backlog with expiry | Missing optional field, dashboard panel regression |

## Alert Schema

| Field | Requirement |
|---|---|
| `alert.id` | Stable ID for deduplication and evidence |
| `alert.severity` | P0/P1/P2/P3 plus safety/event class |
| `vehicle.id`, `site.id`, `route.id` | Required for all vehicle alerts |
| `manifest.*` | Build, model, map, calibration, config, diagnostics graph |
| `time.window` | Start, detect, acknowledge, vehicle-action, clear |
| `state.before_after` | Green/yellow/red/unknown transitions |
| `operator.action` | Stop, route hold, remote assist, suppress with owner, no action |
| `evidence.links` | Bag/MCAP, trace, dashboard, incident, ticket |
| `schema.url` | Telemetry schema used to interpret custom fields |

## Runbook Matrix

| Alert | Trigger pattern | Vehicle action | Fleet action | Owner |
|---|---|---|---|---|
| Free-space red | Traversable cell lacks current observation or conflicts with protected-zone obstacle | Controlled stop unless validated crawl mode applies | Open P0, preserve logs, block release/canary | Runtime assurance |
| Unknown/OOD object cluster | Unknown object/OOD occupancy overlaps route corridor or protected zone repeatedly | Treat as obstacle, slow/stop/remote assist | Label review, ontology/model review, route watch | Perception owner |
| Pose integrity red | Protection level/covariance/residual crosses hard threshold | Controlled stop or remote-assist handoff | Block map/release evidence, inspect map/calibration/timing | Localization owner |
| Timing red | PTP unlock, stamp age, skew, TF future/past failure beyond threshold | Reject stale data; degrade or stop | Timing incident, exclude logs from map/release evidence | Runtime platform |
| Calibration red | Sensor pair residual/time offset exceeds hard threshold | Remove affected modality or stop | Maintenance ticket, recalibration required | Calibration owner |
| Map mismatch | Active map differs from dispatch expectation or overlay expired | Stop dispatch or force approved reload | Quarantine route/map bundle | Mapping owner |
| Model runtime red | Engine mismatch, deserialization failure, p99 latency, GPU OOM | Keep previous artifact or stop affected perception path | Abort rollout; rebuild or rollback | ML runtime owner |
| Diagnostics graph unknown | Critical diagnostic node missing/stale/unlatched | Treat dependent function as unknown | Repair producer/config; evidence invalid until fixed | Fleet SRE |
| OTA compatibility failure | Candidate artifact set fails matrix | Do not activate | Stop rollout; update eligibility or manifest | Release manager |

## P0 Free-Space Red

1. Confirm vehicle state: autonomous, speed, route segment, active map/calibration/model IDs.
2. Verify vehicle executed the expected stop/degrade action.
3. Preserve raw sensor logs, occupancy/free-space output, pose, map tile, calibration state, diagnostics graph, and operator event.
4. Check for timing red, calibration red, pose red, map mismatch, and ODD/adverse-condition alert in the same window.
5. Block canary or route expansion until root cause and replay evidence are attached.
6. Close only with a safety-lead disposition: defect fixed, ODD restricted, threshold changed through release process, or false alarm accepted with rationale.

## P0 Pose Integrity Red

1. Confirm pose output was not consumed after red state.
2. Compare scan-match residual, covariance/protection level, relocalization state, map tile, and timing health.
3. Preserve route segment and map tile evidence.
4. Hold affected route if alert clusters by tile or feature-poor zone.
5. Require replay plus closed-course or site validation before clearing a systemic issue.

## P1 Unknown/OOD Cluster

1. Pull event frames, object/occupancy outputs, raw sensor data, and map context.
2. Label whether the object is aircraft/GSE/person/FOD/infrastructure/artifact/novel.
3. Check whether planner treated it conservatively.
4. If conservative action occurred and cluster is operationally acceptable, keep watch and add data to training/evaluation queue.
5. If suppression or false-free-space occurred, escalate to P0.

## P1 Calibration Drift

1. Confirm sensor serials, calibration package, TF tree hash, and recent maintenance.
2. Inspect projection/overlap residual preview and prerequisites such as route features and weather.
3. If drift is physical, stop autonomous use until maintenance and recalibration.
4. If monitor false alarm, retain event and update monitor qualification evidence before tuning threshold.

## Suppression Rules

| Rule | Requirement |
|---|---|
| Time-limited | Every suppression has expiry and owner |
| Scoped | Vehicle/site/route/artifact specific; no fleetwide wildcard for safety alerts |
| Evidence-preserving | Raw events are still stored |
| Release-aware | Suppressed alerts are visible in release reviews |
| Safety-reviewed | P0 suppressions require safety lead approval and compensating control |

## Closure Package

| Artifact | Required for P0/P1 closure |
|---|---|
| Timeline | Detect, acknowledge, vehicle action, operator action, clear |
| Manifest | Active build/model/map/calibration/config/schema |
| Root cause | Confirmed, probable, or unknown with further action |
| Evidence | Logs, trace, dashboards, replay, labels, screenshots if relevant |
| Impact | Vehicles, routes, missions, exposure denominator |
| Corrective action | Fix, rollback, ODD restriction, maintenance, threshold release |
| Safety-case update | Claim/assumption/hazard link or rationale for no change |

## Related Repository Docs

- `50-cloud-fleet/observability/slam-timing-health-dashboard.md`
- `50-cloud-fleet/observability/map-hygiene-operational-monitoring.md`
- `50-cloud-fleet/operations/fleet-sre-incident-response.md`
- `60-safety-validation/runtime-assurance/monitor-qualification-evidence.md`
- `60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md`
- `40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md`

## Sources

- Autoware AD API diagnostics: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Autoware diagnostic graph aggregator: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_diagnostic_graph_aggregator/
- ROS 2 diagnostic_updater README: https://docs.ros.org/en/ros2_packages/rolling/api/diagnostic_updater/__README.html
- ROS 2 diagnostic_msgs package: https://docs.ros.org/en/rolling/p/diagnostic_msgs/
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- OpenTelemetry telemetry schemas: https://opentelemetry.io/docs/specs/otel/schemas/
- Waymo, "Building a Credible Case for Safety": https://arxiv.org/abs/2306.01917
