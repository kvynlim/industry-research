# ROS 2 Timing Diagnostics and Observability

**Last updated:** 2026-05-09

## Why It Matters

Timing faults in SLAM and fusion rarely announce themselves as timing faults.
They show up as pose instability, intermittent object jumps, TF extrapolation,
or planning oscillation. The runtime needs first-class timing observability:
topic age, period, transport delay, executor backlog, callback duration, TF
lookup health, message-filter drops, and recorder health.

ROS 2 provides building blocks through `/diagnostics`, `diagnostic_updater`,
Topic Statistics, QoS events, ros2_tracing, and CLI tools. Autoware adds topic
state monitors and localization diagnostics. The deployment task is to wire
these into one acceptance and operations contract.

## Observability Contract

| Layer | Required signals | Tooling |
|---|---|---|
| Application stamp | Header age, stamp regression, tuple skew, freshness gate result. | Node metrics, `/diagnostics`, fusion debug topics. |
| Middleware | Source timestamp, receive timestamp, sequence gaps, QoS deadline/liveliness. | `rclcpp::MessageInfo`, RMW metadata, QoS event callbacks. |
| Topic flow | Period, rate, age, missing topic, low frequency, timeout. | Topic Statistics, Autoware topic state monitor, `ros2 topic hz/bw/info -v`. |
| Executor | Callback queue delay, callback duration, timer jitter, dropped work. | ros2_tracing/LTTng, custom tracepoints. |
| TF | Transform age, lookup latency, extrapolation, missing frame, message-filter drops. | tf2 tools, diagnostics, message-filter metrics. |
| Recorder | Bag cache size, write latency, dropped messages, split/snapshot timing. | rosbag2 diagnostics and recorder service state. |
| Fleet | p50/p95/p99 age and latency by route, sensor, software version, and host. | Metrics pipeline and incident dashboards. |

## Minimum Metrics

| Metric | Unit | Scope | Alerting use |
|---|---|---|---|
| `topic_period_ms{topic}` | ms | Subscription side | Detect low or bursty rate. |
| `topic_age_ms{topic}` | ms | Subscription side | Detect stale data. |
| `source_to_receive_ms{topic}` | ms | Middleware | Detect network/RMW delay. |
| `callback_duration_ms{node,callback}` | ms | Executor | Detect compute overrun. |
| `callback_queue_delay_ms{node,callback}` | ms | Executor | Detect starvation/backpressure. |
| `tf_lookup_fail_count{reason}` | count | TF consumer | Detect missing/stale transforms. |
| `message_filter_drop_count{reason}` | count | Fusion synchronizer | Detect starvation and queue overflow. |
| `clock_jump_count{node}` | count | Time-sensitive nodes | Verify replay seek handling. |
| `bag_write_latency_ms` | ms | Recorder | Detect logging interference and evidence gaps. |

## Diagnostic Severity Mapping

| Severity | Timing condition | Vehicle behavior |
|---|---|---|
| OK | All freshness, period, TF, and execution budgets are within nominal envelope. | Normal autonomy. |
| WARN | p95 age/period or callback duration exceeds warning threshold but output remains within safety budget. | Continue with degraded confidence, log event, increase monitoring. |
| ERROR | Output is stale, missing, or produced after a required deadline. | Block downstream trust, request fallback behavior, capture incident clip. |
| STALE | Diagnostic publisher itself is late or missing. | Treat component as unknown health; do not assume OK. |

Diagnostics should report both state and numbers. "NDT delayed" without
`sensor_points_delay_time_sec`, input stamp, and current threshold is not enough
for incident triage.

## Tooling Pattern

Use fast CLI checks during development:

```bash
ros2 topic info -v /localization/kinematic_state
ros2 topic hz /sensing/lidar/top/pointcloud_raw
ros2 topic bw /sensing/lidar/top/pointcloud_raw
ros2 topic echo /diagnostics
ros2 topic echo /statistics
```

Use trace runs for executor and callback timing:

```bash
ros2 trace -s slam_fusion_timing
```

Use Autoware monitors for operational topic health:

| Monitor | Detects |
|---|---|
| `autoware_topic_state_monitor` | Not received, low frequency, significantly low frequency, timeout. |
| NDT diagnostics | Scan delay, transform success, point count, matching score, execution time. |
| EKF diagnostics | Pose/twist delay, no update, gate rejection, state validity. |

## Failure Modes

| Failure mode | Symptom | Control |
|---|---|---|
| Only rate is monitored | Topic remains 10 Hz but messages are 500 ms old. | Monitor both period and age. |
| Average hides tails | Mean callback time looks fine while p99 misses deadlines. | Export histograms or rolling p95/p99. |
| Diagnostics backlog | `/diagnostics` arrives late and reports old OK state. | Monitor diagnostic message age and publisher liveliness. |
| CLI observer perturbs system | Extra reliable subscriber changes network or CPU load. | Use low-impact metrics paths and profile observer overhead. |
| Trace disabled in release | Timing fault cannot be root-caused after incident. | Keep low-overhead tracepoints compiled and enable capture on trigger. |
| Fleet dashboard loses time base | Cross-host latency charts are negative or impossible. | Include host clock offset and time-source metadata. |

## Acceptance Checks

- Every SLAM/fusion input has rate and age monitoring, not rate alone.
- Every fusion synchronizer reports tuple skew, tuple age, drops, and queue
  depth.
- Every localization output has a freshness gate before planning/control
  consumption.
- ros2_tracing or equivalent tracepoints can measure callback duration and
  executor delay in a representative run.
- Diagnostic messages older than their own freshness budget are treated as
  stale health, not OK health.
- Fault injection for delayed sensor, missing TF, executor stall, and recorder
  disk pressure produces distinct diagnostic signatures.

## Related Repository Docs

- [HMI and Operator Interface](hmi-operator-interface.md)
- [ROS 2 Time Semantics Runtime Contract](../ros-autoware/ros2-time-semantics-runtime-contract.md)
- [DDS Source and Receive Timestamp Contract](../middleware/dds-source-receive-timestamp-contract.md)
- [Topic Freshness and Stale Data Contracts](../middleware/topic-freshness-and-stale-data-contracts.md)
- [Autoware Localization Timing Diagnostics](../ros-autoware/autoware-localization-timing-diagnostics.md)
- [Fleet SRE Incident Response](../../50-cloud-fleet/operations/fleet-sre-incident-response.md)

## Sources

- ROS 2 Documentation, [Topic statistics](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Topic-Statistics.html)
- ROS 2 diagnostic_updater API, [README](https://docs.ros.org/en/ros2_packages/rolling/api/diagnostic_updater/__README.html)
- ROS 2, [ros2_tracing](https://github.com/ros2/ros2_tracing)
- ROS 2 Documentation, [Quality of Service settings](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- Autoware Universe, [autoware_topic_state_monitor](https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/)
- Autoware Core, [autoware_ndt_scan_matcher diagnostics](https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/)
