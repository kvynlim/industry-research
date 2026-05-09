# Sensor Dropout, Latency, and Jitter Stress Protocol

**Last updated:** 2026-05-09

## Purpose

This protocol validates localization, SLAM, perception fusion, and safety monitors under missing, delayed, bursty, and reordered sensor data. It covers both sensor-origin faults and runtime delivery faults: network congestion, middleware queues, CPU/GPU saturation, logging overhead, driver stalls, and replay bursts. A passing system must degrade predictably, bound uncertainty, reject stale data, and preserve enough evidence for operational response.

This protocol complements [time-sync fault injection](robustness/time-sync-fault-injection-protocol.md), [timestamp shift sweep](timestamp-shift-sweep-protocol.md), [replay time semantics and TF/message-filter validation](replay-time-semantics-and-tf-message-filter-validation.md), [SLAM integrity under timing errors](slam-integrity-under-timing-errors.md), and the [perception-SLAM corruption protocol](robustness/perception-slam-corruption-fault-injection-protocol.md).

## Stress Model

| Stress | Injection method | Expected safe behavior |
|---|---|---|
| Random dropout | Drop messages independently by topic and rate | Fusion handles sparse data or degrades without false certainty |
| Burst dropout | Remove contiguous frames or packets | Localization availability drops only inside approved bounds or monitor stops |
| Latency offset | Delay topic delivery without changing source timestamp | Stale-data monitor rejects or marks output uncertain |
| Latency jitter | Add variable delivery delay | Queues and synchronizers avoid unbounded lag |
| Reordering | Deliver older messages after newer messages | Consumers reject out-of-order data or process deterministically |
| Duplication | Replay duplicate frames or transforms | Deduplication or idempotent processing prevents false confidence |
| Rate collapse | Lower sensor publish rate or driver poll rate | Topic state monitor and fusion health detect degraded input |
| Compute saturation | Add CPU/GPU/memory/logging load | Real-time watchdogs trip before stale outputs reach planner |
| Middleware queue pressure | Reduce queue depth, change QoS, or burst playback | Drops are visible and bounded |
| Mixed fault | Combine dropout with jitter and timing skew | Safety action remains conservative under realistic compound faults |

## Required Setup

| Item | Requirement |
|---|---|
| Candidate stack | Frozen build, map, calibration, QoS profiles, queue sizes, and runtime parameters |
| Fault injector | Deterministic topic/network/runtime injector with seed and exact fault schedule |
| Replay/HIL coverage | Offline replay for breadth, HIL/SIL for middleware behavior, closed course for critical physical confirmation |
| Ground truth | Pose, objects, occupancy, and route/zone labels for each tested slice |
| Runtime telemetry | Per-topic rate, inter-arrival time, source stamp age, callback latency, queue depth, executor delay, CPU/GPU/memory |
| Monitor set | Topic state, stale-data, time sync, TF/message-filter, localization integrity, safety action, and data recorder health |
| Evidence capture | Rosbag2/MCAP with raw and derived topics, diagnostics, fault schedule, and host logs |

## Fault Matrix

| Modality | Dropout cases | Latency/jitter cases | High-risk metric |
|---|---|---|---|
| LiDAR | Packet/beam/frame dropout, partial sensor blackout | Frame delay, point packet skew, motion-compensation delay | Scan-match residual, false free space, pose drift |
| Camera | Frame drops, exposure pipeline stalls | Variable image arrival, multi-camera skew | Misprojected detections, track age, fusion drops |
| Radar | Track dropout, return thinning | Delayed tracks during moving actors | Dynamic obstacle position error |
| IMU | Sample loss, burst gaps | Delayed or jittered high-rate samples | Preintegration residual, yaw/velocity drift |
| GNSS/INS | Fix loss, degraded status, delayed fixes | Stale absolute updates | Global pose jump, covariance consistency |
| Wheel odometry | Encoder drop, duplicated ticks | Delayed odom during acceleration/turning | Local odometry drift and slip misclassification |
| TF | Missing transforms, delayed frame tree updates | Future/past transform availability | Extrapolation failures and wrong-frame outputs |
| Map runtime | Tile lookup delay, stale overlay, failed tile load | Map bundle/tile metadata delay | Route/geofence mismatch and map quarantine recall |

## Procedure

1. Freeze the candidate build, map, calibration, QoS, queue, and fault-injection manifest.
2. Run clean baseline replay/HIL for every dataset slice and record deterministic output hashes where possible.
3. Inject single-modality dropout sweeps at light, moderate, severe, and release-boundary levels.
4. Inject latency sweeps using fixed delay, variable jitter, burst delay, and reordering.
5. Run compute-stress cases with logging enabled at the production event-capture tier.
6. Run compound cases for the highest-risk sensor pairs, such as LiDAR plus IMU jitter, camera plus LiDAR skew, and GNSS plus wheel odometry dropout.
7. Compare shifted/stressed output against clean baseline and ground truth.
8. Verify monitors, dashboards, and safety actions trip within budget.
9. Create failure packets for any wrong-pose, false-free-space, stale-obstacle, or missing-diagnostic event.

## Metrics

| Metric | Definition | Required slicing |
|---|---|---|
| Topic availability | Fraction of expected messages received and accepted | Sensor, route, ODD, fault severity |
| Inter-arrival jitter | Distribution of time between message arrivals | p50, p95, p99, p99.9 and burst max |
| Source stamp age | Host receive or processing time minus source stamp | Sensor and consumer node |
| End-to-end latency | Source stamp to safety-relevant output or control input | p50, p95, p99, p99.9 |
| Queue age and depth | Age of oldest queued message and queue occupancy | Node and executor |
| Message-filter miss rate | Messages dropped due to sync window, queue, or no transform | Filter instance and topic pair |
| TF availability | Transform lookup success/failure, extrapolation past/future, cache miss | Frame pair and consumer |
| Localization availability | Time pose remains valid inside alert/protection limit | Route and fault severity |
| Pose integrity | Pose error, covariance/protection level, NEES/NIS, residuals | ODD slice and modality fault |
| Perception safety | False free space, missed obstacle, stale track use, object age | Critical actor class and zone |
| Safety action latency | Fault start to alert, degrade, stop, or route hold | Fault type and severity |
| Data evidence completeness | Presence of raw, diagnostics, fault schedule, and monitor traces | Every release-critical run |

## Pass and Block Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| DLJ0 baseline | Clean baseline meets existing localization, perception, and runtime gates | Baseline already violates release thresholds |
| DLJ1 topic health | Dropout, rate collapse, and burst gaps are detected within monitor budget | Topic loss is invisible to diagnostics |
| DLJ2 stale rejection | Delayed, reordered, or duplicate data is rejected or clearly marked stale | Consumer accepts stale/future data as current |
| DLJ3 bounded queueing | Queue age and executor latency stay below approved output age limits or trigger degraded mode | Queue backlog grows while outputs remain nominal |
| DLJ4 graceful degradation | Accuracy/availability degrades according to severity and uncertainty increases with error | Confidence remains nominal while error grows |
| DLJ5 safety output | No high-confidence false free space or stale obstacle near aircraft, people, FOD, or geofence | Any critical stale/false-safe output |
| DLJ6 recovery | After fault removal, outputs recover without map-frame discontinuity or unexplained relocalization | Recovery creates a pose jump or hidden map mismatch |
| DLJ7 observability | Fleet telemetry contains enough fields to explain the stress event | Missing topic, queue, timestamp, or monitor evidence |

## Operational Response

| Condition | Response |
|---|---|
| Brief dropout inside validated envelope | Continue mission, increment reliability counter, retain compressed event context |
| Sustained dropout or rate collapse | Degrade speed/route, increase uncertainty, create maintenance or sensor-health ticket |
| Stale safety-critical input | Controlled stop or remote-assist handoff; mark session unsafe for map building |
| Compute-induced latency spike | Reduce logging tier if approved, shed non-safety workload, or controlled stop if latency persists |
| Repeated route-specific jitter | Open infrastructure/network investigation and pause route expansion |
| Map-building run with timing/data stress | Quarantine generated map tile and exclude log from release dataset until reviewed |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Stress manifest | Fault type, sensor/topic, severity, start/end time, seed, expected monitor response |
| Runtime metrics report | Rates, latency percentiles, jitter, queue age, executor delay, CPU/GPU/memory |
| Fusion health report | Message-filter drops, TF failures, sync matches, object/track age, stale-data rejects |
| Localization report | Pose error, covariance/protection level, residuals, availability, recovery |
| Safety action report | Alert/degrade/stop timing and planner/control response |
| Failure packet | Minimal reproducible slice, fault schedule, screenshots/plots, defect ID |
| Release disposition | Pass, block, inconclusive, or pass with ODD/route/logging restriction |

## Sources

- ROS 2 Kilted documentation, message_filters: https://docs.ros.org/en/kilted/p/message_filters/
- ROS 2 Kilted documentation, tf2 `MessageFilter`: https://docs.ros.org/en/kilted/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html
- ROS 2 documentation, Quality of Service settings: https://docs.ros.org/en/kilted/Concepts/Intermediate/About-Quality-of-Service-Settings.html
- rosbag2 README and playback options: https://github.com/ros2/rosbag2
- Autoware topic state monitor: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/
- Autoware diagnostics API: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Autoware NDT scan matcher documentation: https://autowarefoundation.github.io/autoware_core/main/localization/autoware_ndt_scan_matcher/
- MCAP specification: https://mcap.dev/spec
- Ouster sensor time synchronization guide: https://static.ouster.dev/sensor-docs/image_route1/image_route2/time_sync/time-sync.html
