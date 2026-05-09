# Timestamp Shift Sweep Protocol

**Last updated:** 2026-05-09

## Purpose

This protocol measures how much signed timestamp error the perception-SLAM stack can tolerate before localization, fusion, occupancy, map-change detection, or safety monitoring becomes unsafe. It converts "time sync should be good" into response curves, alert thresholds, and release margins. The expected outcome is a sweep report showing where the stack degrades, where monitors trip, and where release must block because a wrong output remains nominal.

This protocol consumes the timing fault evidence from [time-sync fault injection](robustness/time-sync-fault-injection-protocol.md), supports [sensor dropout, latency, and jitter stress](sensor-dropout-latency-jitter-stress-protocol.md), [replay time semantics validation](replay-time-semantics-and-tf-message-filter-validation.md), and [SLAM integrity under timing errors](slam-integrity-under-timing-errors.md).

## Sweep Scope

| Target | Shift applied to | Safety question |
|---|---|---|
| LiDAR to IMU | LiDAR point cloud `header.stamp`, per-packet stamp if available, or IMU stream | Does motion compensation or scan matching use stale inertial motion? |
| Camera to LiDAR | Image `header.stamp` or point cloud stamp | Does cross-modal fusion create misplaced detections or free space? |
| Radar to ego pose | Radar track/return stamp | Are dynamic obstacles projected to the wrong pose? |
| GNSS to IMU | GNSS fix/PVT stamp or IMU stamp | Does global localization accept inconsistent absolute position? |
| Wheel odometry to IMU | Odometry or encoder stamp | Does preintegration or dead reckoning bias pose during wheel slip or turns? |
| TF transforms | Transform timestamp for `map`, `odom`, `base_link`, and sensor frames | Are transforms extrapolated incorrectly or accepted outside cache policy? |
| Map lookup time | Map tile/version selection timestamp or route overlay time | Can runtime use stale or future map state as current? |

## Required Setup

| Item | Requirement |
|---|---|
| Clean reference logs | Nominal Rosbag2/MCAP runs with raw sensors, TF, localization, objects, occupancy, maps, and diagnostics |
| Ground truth | Pose and object truth for measuring shift-induced error by route, speed, turn, and ODD slice |
| Timestamp editor | Deterministic tool that shifts `header.stamp`, TF stamp, or sensor-native timestamp without changing payload bytes unless declared |
| Replay harness | Fixed ROS time behavior, QoS settings, message order, and deterministic random seeds |
| Baseline run | Clean replay of unmodified log through the same candidate build and map package |
| Monitor set | Time health, topic state, TF/message-filter drops, localization integrity, stale-data, and safety action monitors |
| Sweep manifest | Shift axis, shift values, topics, build, map, calibration, dataset slice, and expected monitor response |

## Sweep Design

Run signed sweeps around zero and include both step and ramp variants.

| Sweep type | Values | Use |
|---|---|---|
| Fine near zero | 0, +/-1 ms, +/-2 ms, +/-5 ms | Detect tight fusion and interpolation assumptions |
| Operational band | +/-10 ms, +/-20 ms, +/-50 ms | Cover credible PTP, host, queue, and replay faults |
| Release boundary | Values around approved latency/fusion limit | Establish exact trip point and margin |
| Gross fault | +/-100 ms and one full sensor frame period where safe in replay | Verify fail-closed behavior |
| Ramp | 1, 5, 10 ms/min until alert/block limit | Detect slow drift and monitor trend response |
| Jitter overlay | Gaussian and bounded uniform jitter around selected offsets | Separate mean offset sensitivity from jitter sensitivity |

Do not mix multiple shifted modalities in the first pass. Establish single-axis sensitivity first, then run pairwise combinations for the highest-risk interactions.

## Procedure

1. Freeze candidate build, map package, calibration, replay config, and sweep manifest.
2. Run the baseline replay and store output hashes, metrics, and monitor traces.
3. For each target stream, apply one signed timestamp shift while preserving message order unless the test explicitly targets reordering.
4. Replay each shifted log at 1.0x with the same ROS time semantics as the baseline.
5. Record synchronized metrics, monitor events, TF/message-filter drops, and safety actions.
6. Repeat the same shift on at least one high-risk slice: turn, acceleration/braking, aircraft stand, person/GSE crossing, wet surface, or weak-feature zone.
7. Fit response curves for pose error, residual, uncertainty, detection error, and monitor time-to-alert versus shift.
8. Identify the first shift that violates alert limits, the first shift that triggers each monitor, and any silent-failure region.
9. Convert the result into release thresholds and fleet alert bands.

## Metrics

| Metric | Definition | Interpretation |
|---|---|---|
| Baseline delta | Candidate metric under shift minus clean replay metric | Removes scenario difficulty from timing sensitivity |
| Shift-to-alert | Smallest signed shift that triggers a timing, fusion, or integrity alert | Must be below unsafe shift threshold |
| Shift-to-unsafe | Smallest signed shift causing pose, object, occupancy, or map error beyond alert limit | Defines timing hazard boundary |
| Silent-failure interval | Shift range where output is wrong but confidence/diagnostics remain nominal | Release-blocking for safety-critical outputs |
| Pose error curve | ATE, RPE, yaw error, drift rate, relocalization failure by shift | Shows localization timing margin |
| Residual curve | Scan-match residual, IMU/GNSS innovation, reprojection error, factor residual by shift | Should rise before unsafe pose error |
| Covariance/integrity curve | Pose covariance, protection level, NEES/NIS, integrity alert state by shift | Detects overconfidence under timing faults |
| Fusion drop curve | Message-filter misses, TF extrapolation failures, queue overflows by shift | Shows whether bad timing fails closed |
| Occupancy/free-space error | False free space, unknown-space growth, stale obstacle use by shift | Critical safety metric near aircraft, people, FOD, and geofences |
| Recovery hysteresis | Difference between alert-on and alert-clear shift thresholds | Prevents alert flapping in operations |

## Pass and Block Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| SW0 reproducibility | Baseline and repeated shifted runs are deterministic within approved tolerance | Replay nondeterminism prevents threshold claims |
| SW1 monotonic risk | Error/residual/uncertainty generally worsens with larger absolute shift or documented non-monotonic behavior is bounded | Unexplained safe/unsafe oscillation near release limit |
| SW2 monitor-before-hazard | Timing, residual, uncertainty, or integrity monitor trips before the shift-to-unsafe boundary | Unsafe output occurs before any monitor action |
| SW3 no silent wrong pose | Wrong-pose cases exceed covariance/protection level or trigger degraded mode | Pose is wrong while reported as nominal |
| SW4 no stale safety input | Stale/future detections, occupancy, or transforms are dropped or marked uncertain | Stale obstacle/free-space output is consumed as current |
| SW5 release margin | Approved operational timing envelope is below shift-to-unsafe by the safety margin set in the release plan | Normal timing variation overlaps unsafe region |
| SW6 slice coverage | High-risk ODD slices pass individually | Aggregate pass hides timing sensitivity in one slice |
| SW7 evidence | Sweep manifest, shifted-log hashes, metrics, plots, and failure packets are complete | Missing evidence for threshold-setting run |

## Threshold Pattern

Exact values are program-specific. A defensible release pattern is:

| Threshold | Required relationship |
|---|---|
| Green band | Normal fleet inter-sensor skew and stamp age remain well below monitor alert threshold |
| Yellow band | Alert threshold is below the first measured safety-relevant degradation point |
| Red band | Controlled-stop or hard-degrade threshold is below the first silent wrong-pose or false-free-space point |
| Release margin | Worst credible PTP/PHC/sensor jitter plus replay uncertainty is lower than yellow threshold by approved margin |
| Map-building margin | Map publication uses stricter limits than runtime because timing faults can corrupt future maps |

## Operational Response

| Sweep result | Fleet action |
|---|---|
| Wide margin, no silent failures | Promote thresholds to fleet dashboard and release gate |
| Narrow margin on one sensor pair | Tighten sensor timing monitor, reduce speed/ODD for affected slice, or redesign fusion window |
| Silent failure for a modality | Block release until monitor, covariance model, or fusion fail-closed behavior is fixed |
| Replay-only failure | Fix replay semantics before using the dataset for release claims |
| Map-building sensitivity | Quarantine map builds from sessions outside timing health envelope |
| High variance across routes | Require route-specific or ODD-specific timing thresholds |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Sweep manifest | Topics, shift values, dataset slices, build/map/calibration IDs |
| Shifted log index | Hashes of clean and shifted MCAP/rosbag artifacts plus timestamp edit description |
| Response plots | Error, residual, uncertainty, drops, alerts, and safety action versus shift |
| Threshold recommendation | Green/yellow/red bands, release margin, and dashboard alert values |
| Failure packets | Minimal log slice, shift value, expected/actual monitor behavior, defect ID |
| Release disposition | Pass, block, inconclusive, or pass with ODD/map-building restriction |

## Sources

- ROS 2 design, Clock and Time: https://design.ros2.org/articles/clock_and_time.html
- ROS 2 Kilted documentation, message_filters: https://docs.ros.org/en/kilted/p/message_filters/
- ROS 2 Kilted documentation, tf2 `MessageFilter`: https://docs.ros.org/en/kilted/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html
- rosbag2 README and playback options: https://github.com/ros2/rosbag2
- MCAP specification: https://mcap.dev/spec
- Autoware topic state monitor: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/
- Autoware NDT scan matcher documentation: https://autowarefoundation.github.io/autoware_core/main/localization/autoware_ndt_scan_matcher/
- Ouster sensor time synchronization guide: https://static.ouster.dev/sensor-docs/image_route1/image_route2/time_sync/time-sync.html
- NovAtel OEM7 message time stamps: https://docs.novatel.com/oem7/Content/Messages/Message_Time_Stamps.htm
