# Map-Localization Release Gates for Timing Health

**Last updated:** 2026-05-09

## Purpose

This page defines release gates that tie map publication, localization release, and fleet rollout to timing health. A localization stack can pass nominal accuracy tests and still be unsafe if PTP, sensor timestamps, replay semantics, TF filters, or runtime latency are unverified. A map can pass geometric QA and still be unsafe if its source sessions were built from skewed or stale sensor data. These gates prevent timing defects from entering vehicle release evidence or permanent map layers.

This page consolidates evidence from [time-sync fault injection](robustness/time-sync-fault-injection-protocol.md), [timestamp shift sweep](timestamp-shift-sweep-protocol.md), [sensor dropout, latency, and jitter stress](sensor-dropout-latency-jitter-stress-protocol.md), [replay time semantics validation](replay-time-semantics-and-tf-message-filter-validation.md), [SLAM integrity under timing errors](slam-integrity-under-timing-errors.md), [SLAM map benchmark protocol](slam-map-benchmark-protocol.md), and the [SLAM timing health dashboard](../../50-cloud-fleet/observability/slam-timing-health-dashboard.md).

## Release Scope

| Release item | Timing evidence required |
|---|---|
| Localization software | PTP/PHC health, timestamp sweep margin, dropout/jitter stress, integrity under timing faults |
| Sensor driver or firmware | Timestamp source declaration, sensor-native clock mode tests, fallback detection |
| Map package | Source-session timing health, map-building replay validity, tile-level timing provenance |
| Calibration package | Time offset/extrinsic coupling evidence and calibration run timing health |
| Replay dataset | ROS time, `/clock`, TF, message-filter, MCAP/rosbag metadata validation |
| Fleet rollout | Dashboard coverage, alert thresholds, operational response, canary timing envelope |

## Required Setup

| Item | Requirement |
|---|---|
| Release manifest | Build, map, calibration, sensor manifest, PTP profile, timing thresholds, ODD scope |
| Timing evidence bundle | Fault injection, timestamp sweep, latency/jitter, replay semantics, and integrity reports |
| Map provenance | Source session IDs, tile IDs, map builder version, timing health tags, quarantine state |
| Fleet observability | SLAM timing health dashboard, alert routes, incident joins, and canary cohort labels |
| Owner approvals | V&V timing, perception/SLAM, mapping, runtime/platform, fleet operations, and safety sign-off |

## Pass and Block Gates

| Gate | Evidence | Pass condition | Block condition |
|---|---|---|---|
| MLT0 timing provenance | Sensor manifest, PTP profile, PHC mapping, GNSS/PPS wiring, driver config | Every timing source and clock domain is declared and versioned | Unknown timestamp source, mixed epochs, or undocumented fallback |
| MLT1 nominal timing health | PTP/PHC logs, sensor stamp age, inter-sensor skew, topic state | Nominal run stays inside approved green band by sensor and ODD slice | Offset/skew exceeds envelope without alert |
| MLT2 fault detection | Time-sync fault injection report | PTP loss, failover, drift, path asymmetry, and timestamp fallback are detected within budget | Timing fault remains silent to runtime and fleet telemetry |
| MLT3 timestamp margin | Timestamp shift sweep report | Monitor/degrade threshold is below unsafe shift with approved margin | Normal timing variation overlaps silent-failure region |
| MLT4 latency and jitter | Dropout/latency/jitter stress report | Queues, filters, and stale-data monitors fail closed under stress | Stale/future data consumed as current safety input |
| MLT5 replay validity | Replay time semantics report | Release replays preserve `/clock`, TF, message filters, message order, and MCAP/rosbag timing metadata | Invalid replay used for candidate selection or release claim |
| MLT6 SLAM integrity | Integrity report under timing errors | Pose bound contains truth or alert triggers before unsafe exposure | Hazardously misleading localization |
| MLT7 map-source timing | Map source-session timing tags and QA report | Every source traversal for published tile is timing-green or explicitly reviewed | Timing-degraded session contributes to permanent map without quarantine |
| MLT8 canary observability | Fleet dashboard and alert dry run | Timing health panels, alerts, and runbooks are live before rollout | Canary cannot detect or triage timing health regression |
| MLT9 incident evidence | Data contract and retention check | Timing telemetry joins to bag/MCAP, map, build, calibration, and incident IDs | Safety event cannot be reconstructed due to missing timing evidence |

## Metrics Required in Release Packet

| Metric group | Required fields |
|---|---|
| Clock discipline | Grandmaster ID, PTP state, PHC offset, system-to-PHC offset, path delay, frequency correction |
| Sensor timing | Timestamp source, stamp age, inter-arrival jitter, inter-sensor skew, fallback status |
| ROS/replay timing | `/clock` policy, record/log/publish time, message order, replay determinism |
| TF and filters | TF lookup failures, cache bounds, message-filter match/drop reasons, queue age |
| Runtime latency | Source stamp to localization/perception output, p50/p95/p99/p99.9, burst max |
| Localization integrity | Pose error, covariance/protection level, residuals, NEES/NIS, time-to-alert |
| Map provenance | Source session IDs, timing health tags, tile IDs, map build time, quarantine/review state |
| Operations | Alert counts, route/ODD slice, vehicle ID, operator response, maintenance ticket, rollback/quarantine action |

## Decision Rules

| Decision | Rule |
|---|---|
| Software release pass | All gates MLT0 through MLT6 pass for intended ODD slices; MLT8 and MLT9 active for canary |
| Map publication pass | MLT0, MLT1, MLT5, MLT7, and map QA gates pass for every source traversal and tile |
| Calibration release pass | Calibration run timing health is green and timestamp offset/extrinsic coupling is documented |
| Canary only | Minor timing margin gap has approved mitigation, dashboard is active, and route/ODD is restricted |
| Block | Any hazardously misleading localization, stale safety input, invalid replay evidence, or timing-corrupted map source |
| Inconclusive | Evidence is missing, replay semantics are invalid, or test slice coverage is insufficient |

## Operational Response

| Release finding | Required action |
|---|---|
| PTP/PHC margin below target | Hold release or restrict ODD; fix clock source, network path, or monitor threshold |
| Sensor timestamp fallback not detected | Block affected sensor driver/firmware release |
| Replay semantics invalid | Re-run release metrics after replay harness correction; invalidate prior timing-sensitive claims |
| SLAM integrity unsafe without alert | Block release and require monitor/fusion/covariance redesign |
| Map source session timing-degraded | Quarantine affected tile or rebuild from timing-healthy source traversals |
| Canary timing alert spike | Pause rollout, route hold if safety-critical, compare against validation envelope |
| Missing incident timing fields | Block canary expansion until data contract and dashboard joins are fixed |

## Evidence Package Checklist

| Artifact | Required content |
|---|---|
| Timing release manifest | Build/map/calibration IDs, sensor timing modes, PTP profile, thresholds, ODD scope |
| Fault injection report | Time-sync fault matrix, monitor response, recovery, safety actions |
| Timestamp sweep report | Response curves, silent-failure analysis, release margins |
| Latency/jitter report | Topic rates, queue age, filter drops, stale-data rejects, runtime latency percentiles |
| Replay validation report | `/clock`, TF, message filters, rosbag2/MCAP timing semantics, determinism |
| Integrity report | Protection-level containment, alert timing, unsafe-without-alert intervals |
| Map timing provenance | Source traversal timing health, tile quarantine/review decisions |
| Dashboard readiness | Panels, alert thresholds, runbook links, incident routing, owner acknowledgements |

## Owner Handoffs

| Owner | Responsibility |
|---|---|
| Release manager | Enforce MLT gates before software, map, calibration, or canary promotion |
| V&V timing lead | Own fault injection, timestamp sweep, latency/jitter, and replay validation reports |
| Perception/SLAM owner | Fix fusion/localization defects and define timing margins |
| Mapping owner | Enforce timing provenance and map-source quarantine |
| Runtime/platform owner | Maintain PTP/PHC, ROS time, TF/filter telemetry, and alert implementation |
| Fleet operations | Monitor canary timing health and execute route holds/maintenance workflows |
| Safety lead | Approve alert limits, residual risk, ODD restrictions, and release disposition |

## Sources

- ROS 2 design, Clock and Time: https://design.ros2.org/articles/clock_and_time.html
- ROS 2 Kilted documentation, tf2 `MessageFilter`: https://docs.ros.org/en/kilted/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html
- ROS 2 Kilted documentation, message_filters: https://docs.ros.org/en/kilted/p/message_filters/
- rosbag2 README and command-line options: https://github.com/ros2/rosbag2
- MCAP specification: https://mcap.dev/spec
- linuxptp project: https://linuxptp.nwtime.org/
- Autoware topic state monitor: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/
- Autoware diagnostics API: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Autoware NDT scan matcher documentation: https://autowarefoundation.github.io/autoware_core/main/localization/autoware_ndt_scan_matcher/
- Ouster sensor time synchronization guide: https://static.ouster.dev/sensor-docs/image_route1/image_route2/time_sync/time-sync.html
