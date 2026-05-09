# ROS 2 Time Semantics Runtime Contract

**Last updated:** 2026-05-09

## Why It Matters

SLAM and sensor fusion are timestamp contracts before they are algorithm
contracts. A localization stack can have correct math and still fail if one
node stamps camera frames with callback arrival time, another node uses
hardware acquisition time, and a replay node advances `/clock` faster than the
fusion queue can drain.

ROS 2 deliberately separates `SystemTime`, `SteadyTime`, and `ROSTime`.
`ROSTime` follows wall/system time until a ROS time source is active; when
`use_sim_time` is enabled and `/clock` is present, it follows the latest clock
message. That makes replay and simulation possible, but it also means every
runtime node must declare which time base it uses for public message headers,
TF queries, timers, diagnostics, and hardware timeouts.

## Runtime Contract

| Contract item | Required rule | SLAM / fusion consequence |
|---|---|---|
| Public message time | `std_msgs/Header.stamp` is acquisition or estimator-validity time in the same ROS time domain as the rest of the graph. | Fusion aligns sensor facts, not callback delivery order. |
| Node clock | Nodes that publish time-bearing messages use `node->get_clock()` / `this->now()` only when the intended stamp is ROS graph time. | Nodes respect `use_sim_time` during replay. |
| Hardware timeout clock | Hardware watchdogs, serial timeouts, CAN receive waits, and thread sleeps use steady time internally. | Sim pause or replay time jumps do not block hardware safety logic. |
| `/clock` readiness | If `use_sim_time=true`, lifecycle activation waits for the first non-zero `/clock` tick. | Startup does not publish zero-stamped poses, TF, or sensor facts. |
| Time jumps | Nodes with integrators, caches, filters, or TF buffers register jump handling or reset on replay seek/backward jumps. | EKF, scan matching, and message filters do not carry stale state across bag seeks. |
| Clock source manifest | Vehicle, simulation, and replay launches record the intended clock source and all nodes using `use_sim_time`. | Mixed wall-time/sim-time deployments are caught before driving. |
| `/clock` QoS | `/clock` subscriber QoS is explicitly configured where defaults are not sufficient. | Late clock ticks or dropped ticks do not silently desynchronize replay. |

## Time Domains

| Domain | Use for | Do not use for |
|---|---|---|
| `ROSTime` | Message headers, TF timestamps, `/diagnostics` timestamps, replay, simulation, algorithm-validity time. | Hardware timeouts that must progress when sim time is paused. |
| `SystemTime` | Wall-clock logging, fleet correlation after NTP/PTP/chrony discipline, file naming, operator event timelines. | Fusion alignment unless all publishers are explicitly system-time based. |
| `SteadyTime` | Durations, watchdogs, monotonic latency measurement inside one process, executor stall checks. | Public ROS message timestamps, bag replay semantics, TF timestamps. |

For vehicle operation, `Header.stamp` should normally represent the sensor
acquisition instant or estimator validity instant, not the time a driver callback
finished. For replay, the bag's `/clock` and message timestamps must reproduce
the original ordering and inter-message gaps expected by the fusion code.

## Failure Modes

| Failure mode | Symptom | Control |
|---|---|---|
| Mixed `use_sim_time` | Some nodes publish 1970/zero or wall-time stamps while replay runs in bag time. | Launch audit that every SLAM/fusion node has the same `use_sim_time` value. |
| Zero ROS time | First messages have stamp `0` and poison TF or filters. | Lifecycle activation waits for non-zero clock when sim time is enabled. |
| Header stamped on receive | Sensor age looks small although the physical sample is old. | Driver contract requires hardware/acquisition stamp and exposes receive stamp separately. |
| Backward replay jump | EKF, IMU preintegration, or scan accumulators produce discontinuous poses. | Time-jump callbacks clear integrators, message-filter queues, and TF caches. |
| Fast replay hides latency bugs | Algorithms pass in bag replay but fail on vehicle because wall-clock compute cannot keep up. | Record both ROS time and steady-time processing latency; replay at 1x for acceptance. |
| Paused sim breaks watchdog | Safety timeout uses ROS time and stops expiring while sim is paused. | Safety watchdogs use steady time and report ROS time only as context. |
| `/clock` QoS mismatch | Nodes start but never see replay clock. | Startup check subscribes to `/clock`, validates rate, and fails the launch on timeout. |

## Telemetry

Publish or export these values for every timing-critical node:

| Metric | Definition | Normal use |
|---|---|---|
| `message_age_ms` | `node_now_ros - msg.header.stamp` at callback start. | Detect stale sensor or pose inputs. |
| `source_to_receive_ms` | RMW receive timestamp minus RMW source timestamp where available. | Separate middleware delay from sensor delay. |
| `callback_queue_delay_ms` | Callback start steady time minus middleware receive steady time, if instrumented. | Detect executor backlog. |
| `processing_ms` | Callback end steady time minus callback start steady time. | Bound scan matching, fusion, and projection stages. |
| `clock_rate_hz` | `/clock` tick rate and monotonicity in current run mode. | Detect replay pause, accelerated replay, or dropped clock ticks. |
| `time_jump_count` | Count of backward/large forward ROS time jumps handled by node. | Prove replay seek handling and state reset. |

## Replay Behavior

Replay launches must make the time base explicit:

```bash
ros2 bag play scenario_001 --clock
ros2 launch localization_stack replay.launch.py use_sim_time:=true
```

Recorders used for replay evidence should also be explicit:

```bash
ros2 bag record -s mcap --use-sim-time --all
```

If `--use-sim-time` is enabled on `ros2 bag record`, the recorder writes bag
timestamps using the latest received `/clock` value and waits until the first
clock message before writing data. Do not mix bags recorded with system-time
receive stamps and replay runs that assume sensor acquisition stamps unless the
time-provenance manifest documents the difference.

## Acceptance Checks

- `ros2 param get <node> use_sim_time` matches the launch manifest for every
  SLAM, fusion, TF, recorder, and diagnostic node.
- With `use_sim_time=true`, no timing-critical node publishes a non-static
  message before the first non-zero `/clock` tick.
- A replay seek backward clears EKF history, message filter queues, scan
  accumulators, and cached fusion state.
- Sensor `Header.stamp` values are within the expected acquisition-to-receive
  latency budget, not merely callback time.
- Safety watchdogs continue to expire under paused `/clock`.
- Every production incident bag records `/clock`, `/tf`, `/tf_static`,
  diagnostics, and the time-source manifest.

## Related Repository Docs

- [TF2 Cache and Stale Transform Playbook](tf2-cache-stale-transform-playbook.md)
- [Message Filters Fusion Risk Patterns](message-filters-fusion-risk-patterns.md)
- [Autoware Localization Timing Diagnostics](autoware-localization-timing-diagnostics.md)
- [ROSBag / MCAP Time Provenance Contract](../data-logging/rosbag-mcap-time-provenance-contract.md)
- [ROS 2 Migration](ros2-migration.md)
- [Runtime Verification and Monitoring](../../60-safety-validation/runtime-assurance/runtime-verification-monitoring.md)

## Sources

- ROS 2 Design, [Clock and Time](https://design.ros2.org/articles/clock_and_time.html)
- ROS 2 rclcpp API, [Class TimeSource](https://docs.ros.org/en/ros2_packages/rolling/api/rclcpp/generated/classrclcpp_1_1TimeSource.html)
- ROS 2 rmw API, [rmw_message_info_s](https://docs.ros.org/en/rolling/p/rmw/generated/structrmw__message__info__s.html)
- ROS 2 rosbag2, [Recording data and simulation time](https://github.com/ros2/rosbag2)
- ROS 2 Documentation, [Topic statistics](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Topic-Statistics.html)
