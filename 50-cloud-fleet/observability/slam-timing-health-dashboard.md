# SLAM Timing Health Dashboard

**Last updated:** 2026-05-09

## Purpose

This dashboard specification defines fleet observability for SLAM, localization, map-building, and sensor-fusion timing health. It turns PTP/PHC status, sensor timestamps, ROS time, TF/message-filter behavior, latency, jitter, and localization integrity into operational panels and alerts. The dashboard must catch timing regressions during canary, route expansion, map publication, and incident response before they become silent wrong-pose or stale-obstacle failures.

This dashboard supports the [perception-SLAM fleet data contract](../data-platform/perception-slam-fleet-data-contract.md), [map hygiene operational monitoring](map-hygiene-operational-monitoring.md), [time-sync fault injection](../../60-safety-validation/verification-validation/robustness/time-sync-fault-injection-protocol.md), [timestamp shift sweep](../../60-safety-validation/verification-validation/timestamp-shift-sweep-protocol.md), [sensor dropout, latency, and jitter stress](../../60-safety-validation/verification-validation/sensor-dropout-latency-jitter-stress-protocol.md), [replay time semantics validation](../../60-safety-validation/verification-validation/replay-time-semantics-and-tf-message-filter-validation.md), and [map-localization release gates for timing health](../../60-safety-validation/verification-validation/map-localization-release-gates-timing-health.md).

## Monitoring Goals

| Goal | Signal |
|---|---|
| Detect clock discipline degradation | PTP state, grandmaster ID, PHC offset, system-to-PHC offset, path delay |
| Detect sensor timestamp faults | Sensor timestamp source, stamp age, inter-sensor skew, fallback mode |
| Detect replay/data quality issues | `/clock` validity, MCAP/rosbag metadata, message order, replay determinism tags |
| Detect fusion timing loss | TF failures, message-filter drops, queue age, stale/future rejects |
| Detect latency and jitter risk | Source-to-output latency, inter-arrival jitter, callback age, executor delay |
| Detect localization integrity risk | Pose covariance/protection level, residuals, relocalization failures, alert-limit approach |
| Protect map publication | Source-session timing health, map tile quarantine, timing health tag coverage |
| Support incidents | Join vehicle, route, map, calibration, build, bag/MCAP, timing telemetry, and operator response |

## Required Setup

| Item | Requirement |
|---|---|
| Telemetry producers | Vehicle clock service, sensor drivers, ROS nodes, localization, map runtime, recorder, and fleet uploader |
| Schema registry | Versioned custom fields for timing, fusion, localization, map timing, and evidence IDs |
| Threshold inputs | Timestamp sweep, timing fault injection, latency/jitter stress, and SLAM integrity release thresholds |
| Alert routing | Vehicle response, fleet SRE, mapping, maintenance, release manager, and safety escalation owners |
| Incident joins | Vehicle ID, route, map, calibration, build, bag/MCAP, event ID, and operator action correlation |

## Telemetry Schema

| Field | Type | Notes |
|---|---|---|
| `time.ptp.state` | enum | listening, slave, master, fault, uncalibrated, holdover |
| `time.ptp.grandmaster_id` | string | Required for failover and site clock audits |
| `time.ptp.offset_from_master_ns` | int64 | From `ptp4l` or equivalent |
| `time.ptp.mean_path_delay_ns` | int64 | Track path-delay spikes and asymmetry proxies |
| `time.phc.system_offset_ns` | int64 | Host system clock to PHC offset from `phc2sys` |
| `time.phc.frequency_ppb` | double | Clock servo correction trend |
| `sensor.<name>.timestamp_source` | enum | ptp, gnss, pps, host_receive, internal, unknown |
| `sensor.<name>.stamp_age_ms` | double | Host receive or processing time minus message stamp |
| `sensor.<name>.inter_arrival_jitter_ms` | double | Rolling p95/p99 per topic |
| `sensor.<name>.dropout_rate` | double | Missing messages over expected rate |
| `fusion.tf.lookup_failures` | int | By frame pair and reason |
| `fusion.filter.drop_count` | int | By filter instance and drop reason |
| `fusion.filter.queue_age_ms` | double | Oldest queued message age |
| `localization.pose.covariance_xy` | double array | Or derived error ellipse |
| `localization.integrity.protection_level_m` | double | If implemented by stack |
| `localization.residual.scan_match` | double | NDT/ICP/factor residual or equivalent |
| `localization.relocalization_events` | int | Include map/tile/frame context |
| `map.source_timing_health` | enum | green, yellow, red, unknown |
| `map.tile_timing_quarantine` | bool | True if timing evidence blocks use/publication |
| `replay.time_policy` | enum | sim_time, wall_time, mixed, invalid |
| `evidence.mcap_id` | string | Immutable bag/MCAP reference |
| `release.id` | string | Release/canary cohort correlation |

Use OpenTelemetry semantic conventions where standard fields fit, and publish a versioned schema for custom robotics fields so dashboards can evolve without silently changing meaning.

## Metrics

| Metric | Definition | Operational use |
|---|---|---|
| Clock offset band | PTP/PHC/system offset classified green, yellow, red, or unknown | Drives timing health state |
| Sensor stamp age | Processing or receive time minus source stamp by sensor | Detects stale/future data |
| Inter-sensor skew | Pairwise skew for synchronized physical events or frame groups | Detects fusion timing risk |
| Topic freshness | Rate, dropout, inter-arrival jitter, and last-message age | Detects sensor or middleware degradation |
| TF/filter health | Lookup failures, extrapolation direction, sync misses, and queue age | Detects fusion fail-closed behavior |
| Localization integrity margin | Protection level or covariance margin to alert limit | Detects wrong-pose risk |
| Runtime latency tail | Source-to-output p95, p99, p99.9, burst maximum | Detects tail latency that can consume stale data |
| Map timing coverage | Fraction of source sessions and active tiles with green timing provenance | Controls map publication and quarantine |

## Dashboard Views

| View | Panels |
|---|---|
| Fleet timing overview | Vehicles by timing state, PTP lock, offset bands, active alerts, canary cohort |
| Clock discipline | Grandmaster identity, PTP state dwell, PHC/system offset, path delay, frequency correction |
| Sensor timestamp health | Timestamp source, stamp age, skew matrix, dropout, jitter, fallback events |
| Fusion timing | TF failures, message-filter drops, sync match rate, queue age, stale/future rejects |
| Localization integrity | Residuals, covariance/protection level, relocalization, unsafe-with-alert, unsafe-without-alert |
| Latency budget | Source-to-output latency p50/p95/p99/p99.9, executor delay, CPU/GPU/logging load |
| Map timing provenance | Source-session timing health by tile, quarantine state, map bundle/canary rollout |
| Replay evidence | Bags/MCAPs by time policy validity, `/clock` anomalies, conversion warnings |
| Incident drilldown | Vehicle, route, time window, bag/MCAP, map/calibration/build IDs, timing trace, safety action |

## Alerts

| Alert | Trigger pattern | Severity | Required action |
|---|---|---|---|
| PTP unlock | PTP state not locked for longer than approved holdover | P1 or P0 if moving in autonomous mode | Degrade or controlled stop depending on route risk |
| Grandmaster change | Unexpected GM identity or offset step on failover | P1 | Compare against allowlist and watch localization residuals |
| PHC drift | System-to-PHC offset or frequency correction exceeds yellow/red band | P1/P0 | Route hold if persistent; maintenance ticket |
| Sensor timestamp fallback | Any safety-relevant sensor switches to host/internal/unknown time | P0 | Controlled stop or remove modality; block map-building use |
| Stamp age high | Message age exceeds validated stale-data threshold | P1/P0 | Reject stale data, degrade, or stop |
| Inter-sensor skew high | Skew exceeds timestamp sweep green/yellow/red threshold | P1/P0 | Degrade fusion; open timing fault event |
| TF failure spike | Past/future extrapolation or missing transform exceeds threshold | P1 | Investigate frame/time source; pause release promotion |
| Filter drop spike | Sync or transform filter drop rate exceeds validation envelope | P1 | Inspect sensor skew, queue size, and topic rate |
| Localization integrity alert | Protection level, residual, or covariance crosses red threshold | P0 | Controlled stop/remote assist; preserve incident evidence |
| Timing-red map source | Map tile built from timing-red/unknown source session | P0 for map ops | Quarantine tile and block publication |
| Replay invalid evidence | Release run uses mixed/invalid replay time policy | P0 for release | Invalidate release metric until replay is corrected |

## Operational Runbook

| State | Vehicle operation | Fleet/map operation |
|---|---|---|
| Green | Continue mission and canary promotion if other gates pass | Use logs for release and map-building if data contract is complete |
| Yellow | Continue only inside approved ODD; reduce speed if configured | Watch canary, prevent automatic map publication, create reliability ticket |
| Red | Controlled stop, remote-assist, or route hold according to safety budget | Quarantine logs/maps, open incident, block release promotion |
| Unknown | Treat as yellow for availability, red for release evidence | Exclude from release claims and map publication until telemetry is repaired |

## Pass and Fail Rules

| Rule | Pass condition | Fail condition |
|---|---|---|
| Dashboard coverage | Every release/canary vehicle publishes required timing, fusion, localization, and map fields | Missing required field for active release cohort |
| Alert alignment | Green/yellow/red thresholds match validated timestamp sweep and integrity gates | Dashboard threshold differs from release evidence without approval |
| Incident join | Timing telemetry joins to vehicle, route, map, calibration, build, bag/MCAP, and operator event | Incident cannot reconstruct timing state |
| Map quarantine | Timing-red or unknown source sessions are blocked from automatic map publication | Timing-red data reaches active map without review |
| Alert latency | Dashboard alert and on-vehicle action are visible within operational SLA | Alert arrives too late for operator response |
| False alarm management | Yellow alerts have review queue and suppression rules with owner approval | Alert fatigue causes unacknowledged timing regressions |

## Evidence and Retention

| Evidence | Retention rule |
|---|---|
| P0 timing/localization event | Preserve raw bag/MCAP, clock telemetry, diagnostics, map/build/calibration IDs, operator notes |
| Canary timing alert | Preserve dashboard trace and event window through release review period |
| Map timing quarantine | Preserve source-session logs, tile IDs, review decision, and release disposition |
| Replay invalidation | Preserve invalid replay manifest and corrected rerun for audit trail |
| Maintenance timing ticket | Preserve sensor serial, firmware, cabling/NIC/clock changes, and post-repair timing check |

## Sources

- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- OpenTelemetry telemetry schemas: https://opentelemetry.io/docs/specs/otel/schemas/
- Autoware diagnostics API: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Autoware topic state monitor: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/
- Autoware NDT scan matcher documentation: https://autowarefoundation.github.io/autoware_core/main/localization/autoware_ndt_scan_matcher/
- ROS 2 design, Clock and Time: https://design.ros2.org/articles/clock_and_time.html
- ROS 2 Kilted documentation, tf2 `MessageFilter`: https://docs.ros.org/en/kilted/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html
- ROS 2 Kilted documentation, message_filters: https://docs.ros.org/en/kilted/p/message_filters/
- rosbag2 README and command-line options: https://github.com/ros2/rosbag2
- MCAP specification: https://mcap.dev/spec
- linuxptp project: https://linuxptp.nwtime.org/
- Ouster sensor time synchronization guide: https://static.ouster.dev/sensor-docs/image_route1/image_route2/time_sync/time-sync.html
