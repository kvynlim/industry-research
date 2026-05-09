# Replay Time Semantics and TF Message Filter Validation

**Last updated:** 2026-05-09

## Purpose

This protocol validates that offline replay, regression tests, and incident reconstruction preserve the same timing semantics that the runtime stack depends on. It focuses on ROS 2 time, `/clock`, rosbag2/MCAP record and playback metadata, TF cache behavior, `tf2_ros::MessageFilter`, and `message_filters` synchronizers. A replay result is not valid release evidence unless message stamps, publish/receive ordering, transform availability, and simulated time behavior are understood and tested.

This protocol supports [timestamp shift sweep](timestamp-shift-sweep-protocol.md), [sensor dropout, latency, and jitter stress](sensor-dropout-latency-jitter-stress-protocol.md), [SLAM integrity under timing errors](slam-integrity-under-timing-errors.md), and [map-localization release gates for timing health](map-localization-release-gates-timing-health.md).

## Time Domains

| Domain | Examples | Validation concern |
|---|---|---|
| Sensor source time | LiDAR packet/frame stamp, camera exposure time, GNSS/IMU time | Physical measurement time used by fusion |
| ROS message stamp | `std_msgs/Header.stamp` in sensor and derived messages | Timestamp used by TF, filters, localization, and replay metrics |
| Record time | Time recorder received/wrote a message | May differ from measurement time under latency or burst queues |
| Publish time | Time message is republished during replay | Determines consumer callback timing |
| ROS simulated time | `/clock` time when `use_sim_time` is enabled | Drives timers, TF buffer, and time-aware nodes |
| Wall/system time | Host system clock when `use_sim_time` is disabled | Can mask replay defects if mixed with ROS time |
| MCAP log/publish time | MCAP message timing fields and profile conventions | Required for cross-tool replay and indexing |

## Required Setup

| Item | Requirement |
|---|---|
| Replay manifest | Bag/MCAP ID, storage format, compression, metadata, topic list, QoS overrides, playback options |
| Candidate stack | Same build, map, calibration, parameters, and topic remappings used in timing validation |
| Time policy | Explicit `use_sim_time` value per node and expected `/clock` publisher |
| TF policy | TF buffer cache duration, `/tf_static` durability, frame tree, transform publication rates |
| Filter policy | Exact sync type, queue size, slop/window, target frames, and drop callbacks for each filter |
| Reference outputs | Baseline deterministic output hashes or accepted metric tolerance |
| Instrumentation | Callback timestamps, filter matches/drops, TF lookup failures, message age, queue depth, and `/clock` trace |

## Validation Cases

| ID | Case | Expected behavior |
|---|---|---|
| RT-01 | Play with `--clock` and all nodes using simulated time | Timers, TF, and filters use replay time; no wall-time leakage |
| RT-02 | Play without `/clock` when nodes require simulated time | Test fails clearly; no release evidence accepted |
| RT-03 | Record with simulated time before valid `/clock` starts | Recorder avoids zero-time ambiguity or run is rejected |
| RT-04 | Pause/resume and rate changes during replay | Nodes do not treat pause as sensor dropout unless policy says so |
| RT-05 | Burst playback after pause | Queues and stale-data filters prevent false current outputs |
| RT-06 | Reverse or backward `/clock` jump in replay | Time-aware components clear, reset, or fail closed deterministically |
| RT-07 | Message order by receive/log time versus source stamp | Metrics identify ordering mode; synchronizers behave as expected |
| RT-08 | Missing or delayed `/tf_static` | Consumers block or fail closed, not infer wrong static transform |
| RT-09 | TF future/past extrapolation | Failures are diagnosable by frame pair, requested time, and cache bounds |
| RT-10 | `message_filters` exact/approx sync window boundary | Match/drop behavior is deterministic and recorded |
| RT-11 | `tf2_ros::MessageFilter` target-frame availability | Messages are released only when required transform is available |
| RT-12 | Multi-bag or split-bag replay | Topic continuity, `/clock`, and TF caches are correct across file boundaries |
| RT-13 | MCAP conversion from rosbag2 or other tools | Header stamps, schema, channel metadata, and timing fields remain consistent |

## Procedure

1. Freeze replay manifest, candidate build, map, calibration, parameters, and expected time policy.
2. Run a baseline replay with clean logs and record output hashes, metric summaries, and monitor traces.
3. Run each validation case and capture `/clock`, TF, filter, queue, and callback instrumentation.
4. For filters, log accepted pairs/sets, dropped messages, source stamps, target frame, and reason for drop.
5. For TF, log lookup time, source/target frame, latest/oldest available transform, and extrapolation direction.
6. Compare outputs across repeated runs to confirm deterministic behavior or document approved nondeterminism.
7. Tag replay artifacts with whether they are valid for release evidence, debugging only, or rejected.

## Metrics

| Metric | Definition | Use |
|---|---|---|
| Replay determinism | Output hash or metric delta across repeated identical replays | Required for regression and release claims |
| Clock consistency | Difference between ROS time, message stamps, record time, and wall time | Detects mixed time domains |
| Clock jump count | Forward/backward jumps, zero-time intervals, and discontinuities | Identifies invalid or special-case replay |
| TF lookup failure rate | Past/future extrapolation, no connection, no static transform, cache miss | Reveals frame/time contract problems |
| Message filter match rate | Matched messages divided by candidates for exact/approx sync | Measures usable fusion input |
| Filter drop reason rate | Queue overflow, out of slop, no transform, out-of-cache, stale/future | Makes failure modes actionable |
| Callback age | Processing time minus message source stamp | Detects stale outputs and burst replay artifacts |
| Publication burst factor | Replay publish interval versus recorded inter-arrival interval | Explains queue and latency artifacts |
| `/tf_static` readiness time | Time until all required static transforms are available | Prevents first-message failures from hiding bugs |
| Evidence validity flag | Release evidence, debugging only, or rejected | Prevents invalid replay from entering release packet |

## Pass and Block Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| RT0 time policy | Every replay test declares `use_sim_time`, `/clock`, rate, pause, and ordering mode | Unknown or mixed wall/ROS time policy |
| RT1 deterministic replay | Repeated replay produces identical outputs or bounded documented tolerance | Nondeterminism affects release metrics |
| RT2 no wall-time leakage | Time-aware nodes use ROS time under replay when required | Node uses wall time and changes behavior between replay/runtime |
| RT3 TF fail-closed | Missing/future/past transforms create drops or diagnostics, not wrong-frame output | Consumer extrapolates or substitutes invalid transform silently |
| RT4 filter observability | Match/drop behavior and reasons are logged for all safety-relevant filters | Fusion input loss cannot be explained |
| RT5 bag semantics | Header stamps, record/log time, publish time, and MCAP/rosbag metadata are preserved through conversion | Conversion changes time semantics without manifest update |
| RT6 static transforms | Required static transforms are durable and available before dependent outputs are trusted | Startup messages processed with missing static transform |
| RT7 invalid runs excluded | Replays with zero time, clock jumps outside test scope, or missing metadata are marked invalid | Invalid replay included in release evidence |

## Operational Response

| Finding | Response |
|---|---|
| Replay-only timing defect | Fix replay harness before accepting metrics; do not tune stack to invalid replay artifacts |
| Runtime-equivalent TF/filter defect | Create stack defect and add to timing fault regression suite |
| Missing timing metadata in bag/MCAP | Quarantine artifact from release evidence; repair only if original raw timing source is available |
| `/clock` or wall-time mismatch | Enforce launch-time checks and CI replay smoke tests |
| High filter drop rate under valid replay | Investigate timestamp sync, QoS, queue size, and sensor health thresholds |
| MCAP conversion inconsistency | Pin converter version and add conversion round-trip check to data pipeline |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Replay manifest | Bag/MCAP IDs, playback options, time policy, QoS, map/calibration/build IDs |
| Time trace | `/clock`, wall time, message stamps, record/log time, publish intervals |
| TF report | Frame tree, static transform readiness, lookup failures, cache bounds |
| Filter report | Sync matches, drops, queue age, slop/window, target frame, drop reasons |
| Determinism report | Repeated-run hashes, metric deltas, approved tolerances |
| Evidence validity register | Which replay artifacts are valid for release, debugging only, or rejected |

## Sources

- ROS 2 design, Clock and Time: https://design.ros2.org/articles/clock_and_time.html
- ROS 2 Kilted documentation, tf2 `MessageFilter`: https://docs.ros.org/en/kilted/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html
- ROS 2 Kilted documentation, message_filters: https://docs.ros.org/en/kilted/p/message_filters/
- ROS 2 Kilted Approximate Time Synchronizer tutorial: https://docs.ros.org/en/kilted/p/message_filters/doc/Tutorials/Approximate-Synchronizer-Python.html
- rosbag2 README and command-line options: https://github.com/ros2/rosbag2
- rosbag2 storage MCAP plugin: https://github.com/ros-tooling/rosbag2_storage_mcap
- MCAP specification: https://mcap.dev/spec
- Foxglove MCAP documentation: https://docs.foxglove.dev/docs/visualization/mcap/
- Autoware topic state monitor: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/
