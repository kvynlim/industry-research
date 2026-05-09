# Time-Sync Fault Injection Protocol

**Last updated:** 2026-05-09

## Purpose

This protocol validates that perception, localization, SLAM, map lookup, and safety monitors remain safe when the vehicle timing fabric degrades. The target faults are PTP grandmaster loss, PHC drift, sensor timestamp mode errors, GNSS time faults, host clock steps, ROS time jumps, and network asymmetry. The goal is not to prove perfect synchronization. The goal is to prove that timing faults are detected, bounded, surfaced to runtime monitors, and prevented from becoming silent wrong-pose or stale-obstacle failures.

This protocol extends the [perception-SLAM corruption and fault injection protocol](perception-slam-corruption-fault-injection-protocol.md), feeds the [timestamp shift sweep protocol](../timestamp-shift-sweep-protocol.md), [sensor dropout, latency, and jitter stress protocol](../sensor-dropout-latency-jitter-stress-protocol.md), [SLAM integrity under timing errors](../slam-integrity-under-timing-errors.md), and the [SLAM timing health dashboard](../../../50-cloud-fleet/observability/slam-timing-health-dashboard.md).

## Fault Model

| Fault | Injection method | Safety concern |
|---|---|---|
| PTP grandmaster loss | Remove grandmaster, change BMCA priority, block event/general messages | Sensors free-run with increasing skew |
| PTP grandmaster failover | Switch to backup grandmaster with known offset or different time traceability | Small offset step masked as normal operation |
| PHC drift | Disable or bias `phc2sys`, apply controlled frequency offset | Host and NIC/sensor time diverge slowly |
| Clock step | Step system time, PHC, or simulated ROS `/clock` by signed offset | Future/past transforms, invalid fusion windows |
| Clock slew/ramp | Apply gradual offset ramp over seconds to minutes | Harder-to-detect localization bias |
| Path asymmetry | Add one-way delay/asymmetry on PTP path or sensor network | PTP reports lock while absolute sensor skew grows |
| Packet loss | Drop PTP sync/follow-up/delay request packets | Servo instability and intermittent lock |
| GNSS time degradation | Remove PPS/NMEA, bias GNSS time, force receiver holdover | IMU/GNSS timestamps remain plausible but wrong |
| Sensor timestamp fallback | Force LiDAR/IMU/camera from PTP/GNSS time to internal oscillator or host receive time | Mixed timestamp epochs across modalities |
| ROS time misuse | Replay with `/clock` disabled/enabled incorrectly or with non-monotonic clock | Offline replay passes while runtime semantics fail |

## Required Setup

| Item | Requirement |
|---|---|
| Isolated timing domain | Dedicated test network or HIL bench where PTP/GNSS faults cannot affect production systems |
| Reference clock | Independent reference, such as PPS-disciplined logger, second GNSS receiver, or calibrated time interval counter |
| Candidate build | Frozen software hash, runtime parameters, QoS profiles, time-sync monitor thresholds |
| Sensor manifest | Sensor serials, firmware, timestamp mode, PTP profile, clock source, PPS wiring, driver config |
| Clock telemetry | `ptp4l`, `phc2sys`, `pmc`, NIC PHC, system clock, `/clock`, and sensor diagnostics captured at 1 Hz or faster |
| Ground truth | Pose and object truth sufficient to measure timing-induced localization and fusion errors |
| Safety monitors | Runtime timing monitor, localization integrity monitor, stale-data watchdog, and controlled-stop path enabled |
| Evidence capture | Rosbag2/MCAP plus host logs, PTP logs, driver diagnostics, and fault injector timeline |

## Test Phases

| Phase | Environment | Goal |
|---|---|---|
| T0 static audit | Config and manifests | Confirm every sensor has declared timestamp source, clock domain, and expected epoch |
| T1 bench timing | Network timing bench | Measure PTP/PHC monitor response without motion or autonomy risk |
| T2 offline replay | Rosbag2/MCAP faulted replay | Verify timestamp manipulation, `/clock`, TF, and fusion behavior deterministically |
| T3 HIL/SIL | Vehicle compute with sensor/network emulator | Exercise drivers, middleware, queues, and watchdogs under realistic load |
| T4 closed course | Low-speed physical test | Confirm detection and safe response under controlled motion |
| T5 shadow watch | Supervised operational routes | Confirm production telemetry and alert rates without injecting unsafe faults |

## Injection Matrix

| ID | Fault | Severity sweep | Required observation |
|---|---|---|---|
| TS-FI-01 | PTP grandmaster disconnect | 1 s, 5 s, 30 s, 5 min holdover | Monitor transitions from locked to holdover/fault; SLAM degrades or holds safely |
| TS-FI-02 | PTP grandmaster failover | 0 ms, 1 ms, 5 ms, 10 ms, 25 ms offset between grandmasters | Failover event logged with grandmaster identity and offset estimate |
| TS-FI-03 | PHC-to-system drift | 1, 5, 10, 50 ppm equivalent drift | Host receive time and sensor stamp skew alert before fusion becomes unsafe |
| TS-FI-04 | Step offset | +/-1 ms, +/-5 ms, +/-10 ms, +/-25 ms, +/-50 ms | Future/past data is rejected or degraded, not silently fused |
| TS-FI-05 | Ramp offset | 1 ms/min to release threshold, both signs | Residual and integrity monitors trend before pose error crosses alert limit |
| TS-FI-06 | PTP path asymmetry | 0.5 ms to release threshold one-way delay | Absolute reference detects skew even if PTP servo appears locked |
| TS-FI-07 | Packet loss/jitter | 1, 5, 10, 25 percent packet loss plus burst loss | Servo state, offset, and path delay alerts correlate with degradation |
| TS-FI-08 | GNSS/PPS dropout | 10 s, 60 s, 10 min outage | GNSS/IMU reports holdover status; localization confidence changes |
| TS-FI-09 | Sensor timestamp fallback | Per sensor: LiDAR, camera, radar, IMU/GNSS | Mixed time-source state is release-blocking unless explicitly supported |
| TS-FI-10 | ROS `/clock` jump | Forward/backward jump during replay and HIL sim | Replay, TF, and message filters fail closed with diagnosable drops |

Severity values are starting points. The release plan must set site-specific limits from speed, braking distance, sensor frame rate, fusion window, and localization alert limits.

## Metrics

| Metric | Definition | Use |
|---|---|---|
| PTP state dwell time | Time in listening, slave, master, fault, holdover, or uncalibrated state | Detects unstable or wrong BMCA behavior |
| Grandmaster identity changes | Count and timestamp of GM changes | Required for failover root cause |
| PHC offset | NIC/sensor PHC offset to selected master or reference | Primary sync health signal |
| System-to-PHC offset | `phc2sys` measured offset and frequency correction | Detects host clock divergence |
| Path delay and asymmetry proxy | PTP delay plus external one-way delay reference where available | Detects locked-but-wrong timing |
| Sensor stamp age | Host receive time minus message `header.stamp` | Detects stale/future data and fallback modes |
| Inter-sensor skew | Timestamp difference for physical same-time events | Direct fusion risk indicator |
| TF extrapolation failures | Future/past transform lookup failures by frame pair | Reveals replay and runtime time contract violations |
| Message filter drops | Dropped, late, out-of-cache, and no-transform messages | Measures fail-closed behavior in fusion input gates |
| Localization timing sensitivity | Pose error, covariance, scan-match residual, innovation, and availability under each fault | Shows whether time fault becomes wrong pose |
| Safety action latency | Time from injected timing fault to alert, degraded mode, stop, or route hold | Must fit safety budget |
| Evidence completeness | Required PTP, sensor, ROS, and localization logs present | Blocks unverifiable pass claims |

## Pass and Block Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| TS0 provenance | Sensor timestamp source, PTP profile, clock domain, and expected epoch are declared for every sensor | Unknown or mixed timestamp modes in release candidate |
| TS1 nominal lock | PTP/PHC offset, path delay, and sensor stamp age remain inside approved envelope in nominal run | Offset envelope exceeded without alert |
| TS2 detection | Injected loss, step, ramp, and fallback faults produce timing health alerts within detection budget | Fault remains invisible to diagnostics or fleet telemetry |
| TS3 fail closed | Fusion rejects, buffers, degrades, or stops when data is stale, future-dated, or from an invalid clock source | Stale/future data is consumed as current safety input |
| TS4 localization integrity | Pose error remains within alert/protection limit, or integrity monitor trips before violation | Hazardously misleading pose or false nominal covariance |
| TS5 replay parity | Offline replay fault reproduces HIL fault direction and monitor outcome | Replay semantics hide the runtime failure mode |
| TS6 recovery | After fault removal, clocks relock and localization recovers without unexplained map jump | Recovery produces pose discontinuity, wrong map frame, or unlogged relocalization |
| TS7 evidence | Fault timeline, clock telemetry, raw logs, derived metrics, and monitor actions are retained | Missing evidence for any release-critical run |

## Operational Response

| Alert level | Trigger pattern | Required response |
|---|---|---|
| Advisory | Minor offset trend, one missed PTP interval, or brief sensor stamp-age warning | Continue at nominal behavior, raise fleet watch, attach evidence to session |
| Degraded | Sustained offset, PHC drift, packet loss, or sensor fallback inside controllable envelope | Reduce speed, widen fusion uncertainty, avoid map publication from session |
| Stop | Invalid time source, backwards/large clock jump, stale safety-critical modality, or integrity alert | Controlled stop or remote-assist handoff; preserve pre/post event logs |
| Quarantine | Timing fault affects map-building, calibration, or release evidence | Quarantine map tile/log partition; exclude from release metrics until reviewed |
| Maintenance | Repeated PTP unlock, GNSS/PPS fault, sensor oscillator drift, or cable/NIC fault | Remove vehicle or sensor rig from service pending timing health check |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Timing manifest | PTP profile, grandmaster ID, sensor timestamp modes, PHC/system clock mapping |
| Fault schedule | Injected fault type, severity, start/end time, injector version, random seed if applicable |
| Clock telemetry bundle | `ptp4l`, `phc2sys`, `pmc`, NIC PHC, sensor diagnostics, `/clock`, host receive stamps |
| Fusion and localization report | TF/message-filter drops, pose error, covariance, residuals, availability, recovery behavior |
| Safety action report | Alert, degraded mode, stop, remote-assist, route hold, map quarantine timing |
| Release disposition | Pass, pass with ODD restriction, inconclusive, or block with defect IDs |

## Owner Handoffs

| Owner | Responsibility |
|---|---|
| V&V timing lead | Fault matrix, severity sweep, pass/block decision |
| Platform/runtime owner | PTP, PHC, ROS time, diagnostics, and watchdog implementation |
| Perception/SLAM owner | Fusion behavior, localization residuals, map impact analysis |
| Sensor owner | Timestamp mode, firmware, PPS/PTP wiring, driver diagnostics |
| Fleet operations | Operational response, maintenance workflow, dashboard acknowledgement |
| Safety lead | Timing alert limits, residual risk acceptance, ODD restrictions |

## Sources

- ROS 2 design, Clock and Time: https://design.ros2.org/articles/clock_and_time.html
- ROS 2 Kilted documentation, tf2 `MessageFilter`: https://docs.ros.org/en/kilted/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html
- ROS 2 Kilted documentation, message_filters Approximate Time Synchronizer: https://docs.ros.org/en/kilted/p/message_filters/doc/Tutorials/Approximate-Synchronizer-Python.html
- rosbag2 README and command-line options: https://github.com/ros2/rosbag2
- MCAP specification: https://mcap.dev/spec
- linuxptp project: https://linuxptp.nwtime.org/
- linuxptp `ptp4l` man page: https://www.linuxptp.org/documentation/ptp4l/
- linuxptp `phc2sys` man page: https://www.linuxptp.org/documentation/phc2sys/
- linuxptp `pmc` man page: https://www.linuxptp.org/documentation/pmc/
- Autoware topic state monitor: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/
- Autoware diagnostics API: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Ouster sensor time synchronization guide: https://static.ouster.dev/sensor-docs/image_route1/image_route2/time_sync/time-sync.html
- NovAtel OEM7 message time stamps: https://docs.novatel.com/oem7/Content/Messages/Message_Time_Stamps.htm
