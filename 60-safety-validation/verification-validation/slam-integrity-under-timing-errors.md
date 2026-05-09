# SLAM Integrity Under Timing Errors

**Last updated:** 2026-05-09

## Purpose

This protocol defines how to measure localization and SLAM integrity when timing faults affect sensor fusion. Accuracy alone is insufficient. The stack must either keep the true pose inside its stated uncertainty/protection bound or alert before the pose becomes unsafe for planning, geofencing, map updates, or obstacle projection. The critical failure is hazardously misleading localization: a wrong pose, wrong map alignment, or wrong dynamic-object projection that remains reported as valid.

This protocol uses evidence from [time-sync fault injection](robustness/time-sync-fault-injection-protocol.md), [timestamp shift sweep](timestamp-shift-sweep-protocol.md), [sensor dropout, latency, and jitter stress](sensor-dropout-latency-jitter-stress-protocol.md), and [replay time semantics validation](replay-time-semantics-and-tf-message-filter-validation.md). It feeds [map-localization release gates for timing health](map-localization-release-gates-timing-health.md) and the [uncertainty calibration release gates](uncertainty-calibration-perception-slam-release-gates.md).

## Integrity Claims

| Claim | Required evidence |
|---|---|
| Pose uncertainty is conservative under timing faults | Coverage, NEES/NIS, protection-level containment, and high-risk slice results |
| Timing faults are observable before unsafe localization | Monitor time-to-alert versus time-to-alert-limit crossing |
| Wrong-map or wrong-frame states are rejected | TF, map ID, tile ID, scan residual, and geofence consistency checks |
| Sensor fusion fails closed under stale/future data | Message-filter, stale-data, and topic-state drop evidence |
| Map-building excludes timing-corrupted sessions | Timing health tags and map publication quarantine proof |

## Required Setup

| Item | Requirement |
|---|---|
| Ground truth | Survey, RTK/INS reference, closed-course tracking, or adjudicated trajectory with uncertainty |
| Alert limits | Route/ODD-specific horizontal, vertical, heading, velocity, and map-alignment limits |
| Protection model | Pose covariance, protection level, integrity risk, particle dispersion, or equivalent bound |
| Fault datasets | Clean and timing-faulted logs from timestamp shift, dropout/jitter, and PTP/PHC fault campaigns |
| Map context | Map bundle, tile IDs, geofence, route graph, static landmarks, and temporary overlays |
| Monitor telemetry | Timing health, localization diagnostics, residuals, TF/filter drops, stale-data rejects, safety actions |
| Replay parity | Evidence that replay time semantics do not hide runtime timing failures |

## Timing-Induced Failure Modes

| Failure mode | Timing cause | Integrity symptom |
|---|---|---|
| Motion-distorted LiDAR scan | LiDAR/IMU skew or delayed IMU samples | Scan residual rises, pose covariance should inflate |
| Wrong dynamic-object projection | Delayed camera/radar/LiDAR track with current ego pose | Object appears displaced but track confidence remains high |
| GNSS/INS false correction | GNSS or INS timestamp lag under acceleration/turning | Global pose jump or slow bias with low covariance |
| TF extrapolation misuse | Transform requested outside valid cache window | Future/past transform failure or silent wrong-frame result |
| Stale map association | Runtime map lookup uses wrong map time or tile version | Scan-to-map residual cluster and geofence mismatch |
| Delayed loop closure | Loop closure applied with shifted trajectory time | Map or pose graph discontinuity |
| Replay-only pass | `/clock`, record time, or filter behavior differs from runtime | Offline integrity evidence is invalid |

## Metrics

| Metric | Definition | Integrity use |
|---|---|---|
| Alert-limit exceedance | Pose or map-alignment error beyond approved safety limit | Defines unsafe localization event |
| Protection-level containment | Fraction of true errors inside reported bound | Core integrity claim |
| Integrity risk | Rate of error outside bound without alert | Release-blocking if above safety allocation |
| Time to alert | Fault start or error onset to integrity alert/degrade/stop | Must precede unsafe exposure |
| Time unsafe without alert | Duration pose is unsafe while reported valid | Should be zero for critical slices |
| NEES/NIS | Normalized estimation/innovation consistency against expected distribution | Detects overconfident filters |
| Residual-to-error lead | How early scan, IMU, GNSS, or map residual rises before pose error | Supports early warning threshold |
| Relocalization correctness | Recovery to correct map frame/tile after timing fault | Prevents wrong-frame recovery |
| False-free-space from pose error | Occupancy/free-space error caused by ego-pose timing fault | Links localization integrity to safety output |
| Map corruption recall | Timing-corrupted sessions blocked from map publication | Prevents persistence of timing faults into maps |

## Procedure

1. Define alert limits and integrity allocation for each route, speed band, geofence class, and map-building mode.
2. Freeze candidate build, map, calibration, timing thresholds, and replay policy.
3. Run clean baseline localization and verify nominal coverage, residuals, and uncertainty calibration.
4. Run signed timestamp-shift sweeps and identify the first unsafe shift and first monitor alert for each axis.
5. Run dropout, latency, jitter, and PTP/PHC fault cases for the same slices.
6. Compute pose error, map alignment error, covariance/protection bounds, NEES/NIS, residuals, and safety output errors.
7. Label every interval as valid, degraded, stopped, unsafe-with-alert, or unsafe-without-alert.
8. Review failure packets for any unsafe-without-alert or wrong-map/wrong-frame recovery.
9. Update release thresholds, dashboard alerts, and map-building quarantine rules.

## Pass and Block Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| INT0 nominal basis | Clean baseline passes accuracy, coverage, residual, and map alignment gates | Timing test starts from invalid nominal localization |
| INT1 bound containment | Pose error remains inside approved uncertainty/protection bound or alert triggers first | Error exceeds bound while state remains nominal |
| INT2 no hazardously misleading pose | Unsafe pose intervals without alert are zero in protected zones | Any wrong valid pose near aircraft, people, FOD, geofence, or route boundary |
| INT3 residual lead | At least one diagnostic or integrity signal leads unsafe error by approved margin | Error crosses alert limit before any diagnosable signal |
| INT4 recovery correctness | Recovery returns to correct map frame/tile with logged relocalization state | Wrong-frame recovery, map jump, or hidden relocalization |
| INT5 map isolation | Sessions outside timing health envelope cannot publish or update maps | Timing-corrupted data enters permanent map layer |
| INT6 replay validity | Integrity results come only from replay artifacts that passed replay time validation | Invalid replay used for release evidence |
| INT7 operational action | Fleet response is defined for every timing integrity alert level | Alert exists without route, speed, stop, quarantine, or maintenance action |

## Operational Response

| Integrity state | Vehicle action | Fleet/map action |
|---|---|---|
| Valid | Continue mission | Retain normal timing telemetry |
| Degraded but bounded | Reduce speed, increase margins, avoid tight geofence operations | Mark session degraded; exclude from map-building by default |
| Integrity alert | Controlled stop or remote-assist handoff | Open incident ticket and attach timing/SLAM evidence |
| Unsafe with alert | Safety review; release may pass only if exposure and response are inside approved budget | Quarantine related logs and map tiles |
| Unsafe without alert | Block release | Root cause, monitor redesign, retest full affected sweep |
| Wrong-map/wrong-frame | Controlled stop and map reload only under approved procedure | Quarantine map package/tile and route until triaged |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Integrity manifest | Alert limits, protection model, safety allocation, dataset slices, build/map/calibration IDs |
| Timing fault linkage | Fault schedule, timestamp shift values, dropout/jitter cases, PTP/PHC faults |
| Integrity report | Error, protection level, coverage, NEES/NIS, residuals, time-to-alert, unsafe-without-alert |
| Map impact report | Map tile, geofence, route, scan-to-map residual, wrong-frame/wrong-tile checks |
| Failure packet | Minimal log slice, plots, monitor traces, expected/actual response, defect ID |
| Release disposition | Pass, block, inconclusive, or pass with ODD/route/map-building restriction |

## Sources

- Joerger and Pervan, "Integrity Monitoring for Kalman Filter Based Integrated Navigation Systems": https://ieeexplore.ieee.org/document/6696459
- Sensors 2025, "Integrity Monitoring for Safe Localization of Automated Vehicles": https://www.mdpi.com/1424-8220/25/2/358
- Autoware NDT scan matcher documentation: https://autowarefoundation.github.io/autoware_core/main/localization/autoware_ndt_scan_matcher/
- Autoware localization documentation: https://autowarefoundation.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/creating-maps/localization/
- Autoware diagnostics API: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- ROS 2 Kilted documentation, tf2 `MessageFilter`: https://docs.ros.org/en/kilted/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html
- ROS 2 Kilted documentation, message_filters: https://docs.ros.org/en/kilted/p/message_filters/
- ROS 2 design, Clock and Time: https://design.ros2.org/articles/clock_and_time.html
- Ouster sensor time synchronization guide: https://static.ouster.dev/sensor-docs/image_route1/image_route2/time_sync/time-sync.html
