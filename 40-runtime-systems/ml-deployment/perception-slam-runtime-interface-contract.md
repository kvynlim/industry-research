# Perception-SLAM Runtime Interface Contract

**Last updated:** 2026-05-09

## Purpose

This contract defines the runtime interface between perception, SLAM/localization, maps, runtime assurance, planning, logging, diagnostics, and fleet observability. It is written for production airside vehicles where an incorrect "free", stale pose, incompatible model, bad calibration, or silent monitor failure can create an unsafe vehicle-aircraft, vehicle-person, or vehicle-GSE interaction.

The contract is intentionally stricter than a ROS topic list. A message is acceptable only when its time base, frame, provenance, quality state, uncertainty, and compatibility metadata are valid for the current ODD and active release manifest.

## Contract Model

| Contract layer | Required guarantee | Runtime owner |
|---|---|---|
| Data shape | Message type, coordinate frame, units, covariance, enum domain, schema version | Component owner |
| Time | Source timestamp, receive timestamp, clock state, age, skew, replay policy | Runtime platform |
| Provenance | Build, model, map, calibration, config, sensor-kit, route, site, and evidence IDs | Release manager |
| Quality | Diagnostic state, uncertainty, out-of-scope flag, OOD/unknown score, stale/future reject count | Producing component |
| Action | Planner/monitor behavior for green, yellow, red, unknown, and missing state | Runtime assurance |
| Observability | Metrics and logs that allow incident reconstruction and release-gate comparison | Fleet SRE |

## Interface Inventory

| Interface | Producer | Primary consumers | Contract requirements | Fail-closed rule |
|---|---|---|---|---|
| Dynamic objects | Perception object recognition | Planner, tracker, monitor, logger | Track ID, class, shape, velocity, existence probability, covariance, source sensors, ODD validity | Do not remove a safety-relevant object solely because class confidence is low |
| Obstacle point cloud | Obstacle segmentation | Planner, occupancy, map disagreement monitor | Frame ID, source sensor set, ground removal policy, point age, intensity/ring where available | Stale or frame-invalid cloud is rejected and raises perception degraded |
| Occupancy/free-space grid | Occupancy mapping | Planner, safety monitor, map QA | Occupied/free/unknown semantics, resolution, origin frame, timestamp, update horizon, blind-spot policy | Unknown is not traversable in protected zones |
| Ego pose | Localization/SLAM | Planner, map runtime, logger, safety monitor | Frame tree, covariance/protection level, residuals, relocalization state, map tile ID | Pose red or unknown blocks autonomous motion outside approved degraded mode |
| Map lookup | Map runtime | Localization, planning, monitor | Signed bundle ID, tile ID, layer IDs, active overlay IDs, frame datum, expiry | Wrong or expired map/overlay blocks dispatch |
| Calibration state | Calibration monitor | Fusion, map runtime, maintenance, release gate | Sensor pair, transform version, residual, confidence, last verified time, drift state | Red calibration removes affected modality or stops according to safety case |
| Runtime diagnostic graph | ROS/Autoware diagnostics | HMI, fleet SRE, runtime assurance | `DiagnosticStatus` levels, graph struct/status, latch policy, reset authority | Missing critical diagnostic is treated as unknown, not green |
| Model runtime health | Inference runtime | Fleet SRE, release gate, monitor | Model ID, engine ID, latency, queue time, memory, precision, hardware compatibility | Engine mismatch or p99 latency violation blocks promotion |
| Evidence event | Runtime assurance/logger | Incident system, safety case | Event ID, trigger, active manifest, raw log pointer, action taken, operator response | Safety events preserve raw evidence before log rotation |

Autoware interface names are useful anchors: `/perception/object_recognition/objects`, `/perception/obstacle_segmentation/pointcloud`, and `/perception/occupancy_grid_map/map` map directly to the dynamic-object, obstacle, and occupancy contracts. They are not sufficient by themselves without the metadata above.

## Message Acceptance Rules

| Rule | Pass | Reject or degrade |
|---|---|---|
| Frame | `header.frame_id` resolves through the approved TF tree at message time | Missing transform, future transform, stale transform, unapproved frame alias |
| Time | Source timestamp uses approved PTP/GNSS/PPS/vehicle clock source and age is inside validated envelope | Host-receive fallback for safety sensor without approved degraded mode |
| Schema | Message type and custom fields match active schema URL/version | Unknown field semantics, missing required field, undocumented enum value |
| Provenance | Message can be joined to active manifest and component version | No build/model/map/calibration/config ID for release vehicle |
| Quality | Producer publishes explicit green/yellow/red/unknown state and uncertainty | Silent success with no quality field |
| Replay | Replay messages declare `sim_time`, bag/MCAP ID, and deterministic replay policy | Mixed wall time and sim time in release evidence |

## State Machine

| State | Meaning | Vehicle action | Fleet action |
|---|---|---|---|
| Green | Contract valid and all critical margins inside release envelope | Normal operation | Eligible for canary promotion |
| Yellow | Contract valid but margin degraded or watch condition active | Continue only inside approved ODD, usually with speed/margin limits | Open reliability ticket; pause automatic promotion |
| Red | Contract violated or safety-critical margin crossed | Controlled stop, remote assist, or modality removal if validated | Open incident; block release/map publication |
| Unknown | Telemetry missing, schema incompatible, monitor absent, or evidence cannot be joined | Treat as yellow for availability only when the safety case permits; red for release evidence | Exclude from metrics claims until repaired |

## Timing and QoS Budget

| Path | Required metric | Gate pattern |
|---|---|---|
| Sensor source to perception input | Stamp age, inter-arrival jitter, dropout rate | p99 within timestamp-shift and latency-jitter validation envelope |
| Perception input to object/free-space output | Source-to-output latency, queue age, dropped frame count | p99 and p99.9 below planner stale-data thresholds |
| Localization source to pose output | Pose age, covariance/protection-level margin, residual | No pose consumed after validated maximum age |
| TF lookup | Lookup failure count by frame pair and reason | No persistent past/future extrapolation in release cohort |
| Diagnostic propagation | On-vehicle detect-to-action latency, cloud alert latency | P0 vehicle action visible in operational SLA |

Use ROS diagnostics for component status and OpenTelemetry-compatible metrics/logs for fleet aggregation. Custom robotics fields must be versioned with a schema URL so dashboards can detect breaking telemetry changes.

## Runtime Gating

| Gate | Blocks if |
|---|---|
| R0 manifest join | Any critical message cannot be joined to active release, map, calibration, and vehicle IDs |
| R1 clock and TF | Time source, skew, or transform validity is red or unknown |
| R2 calibration | A consumed sensor pair is outside approved extrinsic/time calibration envelope |
| R3 uncertainty actionability | High uncertainty does not trigger a defined planner or monitor action |
| R4 free-space conservatism | Unknown/low-observation cells are promoted to traversable free space in protected zones |
| R5 OOD/unknown object | OOD or unknown object evidence near route corridor is suppressed without obstacle treatment |
| R6 diagnostics coverage | Required diagnostic graph node is absent, stale, or unlatched contrary to policy |
| R7 logging | Safety event cannot preserve raw bag/MCAP, manifest IDs, and monitor trace |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Interface contract manifest | Message types, topic names, frames, schemas, QoS, thresholds, owners |
| Active runtime manifest | Build/model/map/calibration/config IDs and compatibility hash |
| Monitor action proof | Tests showing planner/runtime assurance consumes red/yellow/unknown states |
| Timing validation report | Timestamp sweep, TF/message-filter failure envelope, latency/jitter stress |
| Calibration validation report | Sensor-pair residuals, transform versions, drift thresholds |
| Free-space/unknown-object report | False-free-space, unknown conservatism, OOD/unknown object handling |
| Incident join proof | Example event reconstructed from telemetry, raw logs, manifests, operator action |

## Related Repository Docs

- `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md`
- `40-runtime-systems/ros-autoware/autoware-localization-timing-diagnostics.md`
- `40-runtime-systems/middleware/topic-freshness-and-stale-data-contracts.md`
- `50-cloud-fleet/observability/slam-timing-health-dashboard.md`
- `60-safety-validation/runtime-assurance/online-perception-monitoring-odd-enforcement.md`
- `60-safety-validation/verification-validation/map-localization-release-gates-timing-health.md`
- `60-safety-validation/verification-validation/uncertainty-calibration-perception-slam-release-gates.md`

## Sources

- Autoware AD API diagnostics: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Autoware perception component interfaces: https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture-v1/interfaces/components/perception/
- Autoware diagnostic graph aggregator: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_diagnostic_graph_aggregator/
- ROS 2 diagnostic_updater README: https://docs.ros.org/en/ros2_packages/rolling/api/diagnostic_updater/__README.html
- ROS 2 diagnostic_msgs package: https://docs.ros.org/en/rolling/p/diagnostic_msgs/
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- OpenTelemetry telemetry schemas: https://opentelemetry.io/docs/specs/otel/schemas/
- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
