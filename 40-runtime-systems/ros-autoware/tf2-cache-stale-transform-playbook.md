# TF2 Cache and Stale Transform Playbook

**Last updated:** 2026-05-09

## Why It Matters

TF2 is the temporal join table for SLAM and fusion. A transform lookup is only
valid if the requested frame path exists at the message's timestamp and the
needed transform samples still live inside the buffer. A stale transform can
project a LiDAR scan into the wrong vehicle pose, rotate a map update, or make a
message filter drop all sensor data while the rest of the graph appears healthy.

TF2 buffers transforms over time and can interpolate inside the cache. The
default cache horizon is 10 seconds unless the buffer is constructed with a
different cache time. It cannot interpolate outside the cached history.

## Runtime Contract

| Contract item | Required rule | Failure prevented |
|---|---|---|
| Static transforms | Sensor extrinsics and rigid vehicle frames publish on `/tf_static` with transient-local durability. | Late joiners and bag splits have stable extrinsics. |
| Dynamic transforms | `map -> odom`, `odom -> base_link`, and moving sensor frames publish at a rate and stamp that cover every consumer query. | Future/past extrapolation in localization and projection. |
| Query timestamp | Consumers query TF at `msg.header.stamp` unless they intentionally want latest transform and document that choice. | Latest-transform projection of old sensor data. |
| Buffer horizon | TF cache length exceeds worst-case sensor delay, fusion queue delay, replay pause window, and transform publisher jitter. | "Earlier than all data in transform cache" drops. |
| Transform tolerance | Any future tolerance is bounded and lower than estimator prediction confidence. | Masking delayed TF with unsafe extrapolation. |
| Threading | Blocking `canTransform` / `lookupTransform` with timeout uses a dedicated TF listener thread or executor path that can keep populating the buffer. | Self-inflicted timeout while waiting for TF. |
| Diagnostics | Transform age, last update, lookup failures, and message-filter drop reasons are exported. | Silent stale-frame faults. |

## Common Symptoms and Fixes

| Symptom | Likely cause | Immediate check | Durable fix |
|---|---|---|---|
| `timestamp is earlier than all data in the transform cache` | Sensor stamp is old, TF cache too short, replay started mid-stream, or `/tf_static` missing from bag slice. | Compare `msg.header.stamp` to oldest TF sample for the frame path. | Increase buffer horizon, preserve `/tf_static`, or fix sensor timestamp provenance. |
| `lookup would require extrapolation into the future` | Transform publisher lags sensor stream or consumer asks for future tolerance beyond published TF. | Compare latest TF stamp to newest sensor stamp. | Raise TF publisher rate, reduce pipeline delay, or publish predicted transform with explicit validity. |
| Message filter queue full | TF never becomes available or queue is undersized for transform delay. | Inspect missing frame, queue depth, and transform age. | Fix frame tree, size queue from rate x delay, and alert on drops. |
| No transform from sensor to fixed frame | Frame ID mismatch, namespace error, missing static transform, or map/odom not initialized. | `tf2_tools view_frames`, `tf2_echo`, and topic list for `/tf_static`. | Add frame contract tests to launch CI and replay acceptance. |
| Pose jumps after bag seek | TF buffer or estimator state survived a backward time jump. | Count ROS time jumps and buffer clear events. | Clear TF/fusion caches on backward replay jumps. |
| Timeout always expires | Same executor waits for TF while no thread services incoming TF messages. | Check dedicated thread / executor callback groups. | Use a dedicated listener thread or non-blocking `canTransform` flow. |

## TF Timing Budget

For each consumer, define:

```
required_cache_sec =
  max_sensor_transport_delay_sec
  + max_executor_queue_delay_sec
  + max_message_filter_wait_sec
  + replay_seek_or_pause_allowance_sec
  + safety_margin_sec
```

Use the default 10-second cache only when this computed budget is below 10
seconds under vehicle, simulation, and replay conditions. Large caches increase
memory, but too-short caches turn small logging or executor stalls into
localization outages.

## SLAM / Fusion Rules

- Never use `TimePointZero` / latest TF for raw sensor fusion unless the input
  is explicitly latest-state telemetry rather than a physical measurement.
- Stamp dynamic transforms at estimator validity time, not publish completion
  time.
- Preserve frame contracts: `map` is globally consistent, `odom` is locally
  continuous, `base_link` is the vehicle body frame, and sensors are fixed
  children unless the mount physically moves.
- Treat static transform changes as calibration artifact changes. Version them
  with the map, vehicle build, and bag metadata.
- If a LiDAR scan spans time, document whether deskewing queries per-point,
  per-packet, scan-start, scan-midpoint, or scan-end transforms.
- For accelerated replay, verify that TF listener threads and message filters
  can keep up at the selected real-time factor.

## Telemetry

| Metric | Definition | Alert condition |
|---|---|---|
| `tf_latest_age_ms{parent,child}` | Node ROS time minus latest transform stamp. | Exceeds consumer freshness budget. |
| `tf_oldest_age_ms{parent,child}` | Node ROS time minus oldest cached transform stamp. | Required query time is older than cache. |
| `tf_lookup_fail_count{reason}` | Lookup, connectivity, extrapolation, invalid frame, timeout. | Any sustained growth on production graph. |
| `tf_message_filter_drops{reason}` | Queue full, out the back, unknown, empty frame, no transform. | Any drop on localization-critical topics. |
| `tf_static_seen` | Required static frame edges observed after startup or bag split. | Missing edge blocks launch readiness. |
| `tf_buffer_clear_count` | Clears caused by lifecycle reset or time jump. | Must increment on backward replay jump. |

## Replay Behavior

Incident clips and validation bags must include:

- `/tf` for dynamic transforms.
- `/tf_static` for extrinsics and static frame edges.
- `/clock` when replay uses simulation time.
- Static calibration artifact identifiers for every sensor-to-base transform.
- Enough pre-roll to populate TF buffers before the first evaluation sample.

When trimming a bag, include a TF warmup window before the target time or repeat
transient-local `/tf_static` at the split. Do not evaluate first-frame SLAM or
projection errors until the frame tree is fully populated.

## Acceptance Checks

- `tf2_tools view_frames` shows one connected tree for the configured ODD,
  with no duplicate child frame ownership.
- A replay started 5 seconds before a localization event has all required
  transforms by the event timestamp.
- Message-filter drops stay at zero for localization-critical sensor topics
  during a 30-minute 1x replay.
- Transform lookup p99 latency and failure counts are exported to
  `/diagnostics` or metrics.
- Deliberately removing `/tf_static` from a test bag fails readiness before
  fusion output is trusted.
- A backward `/clock` jump clears buffers or restarts lifecycle nodes before
  new output is published.

## Related Repository Docs

- [ROS 2 Time Semantics Runtime Contract](ros2-time-semantics-runtime-contract.md)
- [Message Filters Fusion Risk Patterns](message-filters-fusion-risk-patterns.md)
- [Autoware Localization Timing Diagnostics](autoware-localization-timing-diagnostics.md)
- [ROSBag / MCAP Time Provenance Contract](../data-logging/rosbag-mcap-time-provenance-contract.md)
- [Autoware Universe Deep Dive](autoware-universe-deep-dive.md)

## Sources

- ROS Index, [tf2 package overview](https://index.ros.org/p/tf2/)
- ROS 2 tf2 API, [tf2::BufferCore](https://docs.ros.org/en/rolling/p/tf2/generated/classtf2_1_1BufferCore.html)
- ROS 2 tf2_ros API, [threading error guidance](https://docs.ros.org/en/ros2_packages/jazzy/api/tf2_ros/generated/variable_buffer_8hpp_1a98b0980dda9897cc6e352c149c78cc0b.html)
- ROS 2 Documentation, [Using stamped datatypes with tf2_ros::MessageFilter](https://docs.ros.org/en/rolling/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html)
- ROS 2 Documentation, [Clock and Time](https://design.ros2.org/articles/clock_and_time.html)
