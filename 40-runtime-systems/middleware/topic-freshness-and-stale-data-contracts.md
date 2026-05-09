# Topic Freshness and Stale Data Contracts

**Last updated:** 2026-05-09

## Why It Matters

ROS 2 delivery does not automatically mean the data is still valid. A reliable
subscription can receive an old sample after a stall. A transient-local topic can
serve a previous map or state to a late joiner. A best-effort sensor stream can
drop the one frame that would have prevented a fusion blind spot. SLAM and
sensor fusion need per-topic freshness contracts that define when data is too
old to trust, how stale data is detected, and what downstream components do
when freshness is violated.

## Freshness Contract Fields

Each production topic should have a manifest entry:

| Field | Meaning |
|---|---|
| `topic` | Fully qualified ROS topic name. |
| `type` | ROS interface type and package version. |
| `publisher_owner` | Node/component responsible for the contract. |
| `expected_rate_hz` | Nominal publish rate or event semantics. |
| `max_interarrival_ms` | Maximum receive period before WARN/ERROR. |
| `max_age_ms` | Maximum `now - Header.stamp` before data is stale. |
| `max_transport_ms` | Maximum receive timestamp minus source timestamp where available. |
| `qos` | Reliability, durability, history, depth, deadline, lifespan, liveliness. |
| `freshness_action` | Drop, hold last with degraded flag, reset, safe stop, or block activation. |
| `replay_rule` | How the topic behaves under `/clock`, seek, split, and snapshot. |

## Topic Class Defaults

| Topic class | Freshness posture | Typical QoS posture |
|---|---|---|
| Raw LiDAR/camera/radar | Latest usable sample only; old samples are dropped before fusion. | Best effort or reliable by link quality, volatile, small depth, explicit age gate. |
| IMU | High-rate stream; gaps and stamp regressions are faults. | Best effort or reliable by hardware path, volatile, depth sized for preintegration. |
| GNSS/INS | Lower-rate absolute updates; stale updates can corrupt EKF. | Reliable where bandwidth allows, volatile, covariance and age gate. |
| Localization pose/twist | State estimate must be fresh before planning. | Reliable, volatile, tight depth, deadline/liveliness monitoring. |
| `/tf` dynamic | Must cover consumer query times, not merely latest wall time. | Standard TF QoS plus transform-age diagnostics. |
| `/tf_static` | Static until calibration artifact changes. | Transient local, reliable, repeat on bag split. |
| Maps and calibration | Versioned state, not high-rate stream. | Transient local/reliable with artifact version checks. |
| Commands | Stale commands are unsafe. | Reliable, volatile, lifespan/lease/sequence checks, watchdog timeout. |
| Diagnostics | Low-rate health with its own freshness budget. | Reliable enough for operations, stale diagnostics treated as unknown. |

## QoS and Freshness

| QoS policy | Freshness effect | Contract guidance |
|---|---|---|
| Deadline | Detects missing expected publications. | Use for periodic localization, control, and critical sensor health topics. |
| Lifespan | Drops samples after a validity duration. | Use where supported for commands and freshness-critical state, but still implement application age gates. |
| Liveliness | Detects publisher loss independent of message data. | Pair with topic monitors for critical publishers. |
| Reliability | Reliable delivery can increase tail latency under loss. | Use reliable only with bounded depth and age checks on high-rate data. |
| History/depth | Large depth increases stale-data risk. | Derive depth from allowed queue delay and input rate. |
| Durability | Transient local replays old state to late joiners. | Restrict to static/config/map data and validate version/age on receipt. |

## Failure Modes

| Failure mode | Symptom | Control |
|---|---|---|
| Old reliable sample | Callback fires after stall and fusion accepts stale data. | Age gate at callback start and QoS depth bound. |
| Latched stale state | Late node receives previous route/map/calibration as current. | Version checks, validity intervals, and explicit activation barriers. |
| Rate OK, age bad | `ros2 topic hz` passes but header age grows. | Monitor Topic Statistics message age and application age. |
| Deadline only | Deadline detects no publish but not delayed old publish. | Combine deadline with age and source-to-receive latency. |
| Stale diagnostics | `/diagnostics` reports old OK after component stalled. | Diagnostic freshness gate and liveliness checks. |
| Replay first-frame hazard | Bag starts after needed static/map state was published. | Repeat transient-local topics and include warmup pre-roll. |
| Multiple publishers | Topic alternates fresh and stale data from different owners. | Single-writer ownership or publisher GID/source identity validation. |

## Runtime Telemetry

| Metric | Purpose |
|---|---|
| `topic_received_hz` | Detect low frequency and bursts. |
| `topic_age_ms` | Detect stale physical/application data. |
| `topic_transport_ms` | Detect middleware/network delay. |
| `topic_deadline_missed_total` | Detect missed periodic contracts. |
| `topic_liveliness_lost_total` | Detect dead publisher or partition. |
| `topic_stale_drop_total` | Prove stale samples are rejected. |
| `topic_last_valid_stamp` | Support incident replay and operator dashboards. |
| `topic_publisher_gid` | Detect duplicate writers and source switches. |

## Acceptance Checks

- Every topic consumed by SLAM, localization, fusion, planning, control, or
  recorder trigger logic has a manifest freshness entry.
- Synthetic old messages are dropped or marked degraded before fusion output.
- Reliable high-rate topics cannot accumulate more data than the freshness
  budget allows.
- Transient-local topics include artifact version and activation checks.
- Topic monitors detect `NotReceived`, low rate, significantly low rate, and
  timeout conditions for critical topics.
- Replay clips include warmup state and prove freshness gates behave the same
  under `/clock`.

## Related Repository Docs

- [DDS Source and Receive Timestamp Contract](dds-source-receive-timestamp-contract.md)
- [Vehicle Middleware: DDS, SOME/IP, and Zenoh](vehicle-middleware-dds-someip-zenoh.md)
- [ROS 2 Timing Diagnostics and Observability](../monitoring-observability/ros2-timing-diagnostics-observability.md)
- [Message Filters Fusion Risk Patterns](../ros-autoware/message-filters-fusion-risk-patterns.md)
- [ROSBag / MCAP Time Provenance Contract](../data-logging/rosbag-mcap-time-provenance-contract.md)
- [On-Vehicle Supply Chain and Runtime Security](../software-operations/on-vehicle-supply-chain-runtime-security.md)

## Sources

- ROS 2 Documentation, [Quality of Service settings](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- ROS 2 Design, [QoS Deadline, Liveliness, and Lifespan](https://design.ros2.org/articles/qos_deadline_liveliness_lifespan.html)
- ROS 2 Documentation, [Topic statistics](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Topic-Statistics.html)
- ROS 2 rmw API, [rmw_message_info_s](https://docs.ros.org/en/rolling/p/rmw/generated/structrmw__message__info__s.html)
- Autoware Universe, [autoware_topic_state_monitor](https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/)
