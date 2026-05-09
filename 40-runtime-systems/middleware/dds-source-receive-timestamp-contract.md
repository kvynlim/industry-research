# DDS Source and Receive Timestamp Contract

**Last updated:** 2026-05-09

## Why It Matters

ROS 2 sensor fusion often has three different timestamps for the same message:
the application header stamp, the middleware source timestamp, and the
subscriber receive timestamp. They answer different questions. The header stamp
usually describes when the physical measurement is valid. The DDS/RMW source
timestamp describes when the publisher wrote the sample. The receive timestamp
describes when the subscription received it.

Using the wrong one hides root cause. A stale LiDAR frame can look fresh if the
driver restamps on publish. A network backlog can look like sensor delay if the
only recorded time is `Header.stamp`. A replay can look deterministic while the
original DDS source/receive gap is missing.

## Runtime Contract

| Timestamp | Owner | Meaning | Use for |
|---|---|---|---|
| `msg.header.stamp` | Application / driver / estimator | Measurement acquisition time or estimator validity time. | Fusion alignment, TF query time, physical age. |
| `rmw_message_info.source_timestamp` | RMW / middleware publisher path | Time when the publisher published the message. Exact sampling point is implementation-specific but should be consistent. | Pub-to-sub latency, queue/backlog diagnosis, recorder publish time. |
| `rmw_message_info.received_timestamp` | RMW / middleware subscription path | Time when the subscription received the message. Exact sampling point is implementation-specific but should be consistent. | Middleware receive latency and recorder receive time. |
| DDS `SampleInfo.source_timestamp` | DDS DataWriter | Time provided when the DataWriter wrote the sample. | Vendor-level transport analysis. |
| DDS `SampleInfo.reception_timestamp` | DDS DataReader | Time when the sample entered reader history. | Vendor-level receive analysis. |
| Recorder `recv_timestamp` | rosbag2 recorder | Nanosecond time when recorder received the message. | Bag log time, incident reconstruction. |
| Recorder `send_timestamp` | rosbag2 recorder / RMW | Nanosecond time when message was published; falls back to receive time if unavailable. | MCAP publish time, source-order replay analysis. |

The contract is: fusion uses `Header.stamp`; latency analysis uses source and
receive metadata; replay evidence preserves both when available.

## Implementation Pattern

Use subscription callbacks that receive `rclcpp::MessageInfo` on timing-critical
topics:

```cpp
void lidar_callback(
  sensor_msgs::msg::PointCloud2::ConstSharedPtr msg,
  const rclcpp::MessageInfo & info)
{
  const auto & rmw_info = info.get_rmw_message_info();
  // msg->header.stamp: acquisition or validity time
  // rmw_info.source_timestamp: publisher-side middleware time
  // rmw_info.received_timestamp: subscriber-side middleware time
  // rmw_info.publication_sequence_number: gap detection with publisher GID
}
```

Store these fields in diagnostics or sidecar metadata for raw sensor topics,
localization pose, `/tf`, and fused state outputs. Do not rewrite the application
header to match middleware time unless the message type explicitly defines that
as its semantics.

## Failure Modes

| Failure mode | Symptom | Control |
|---|---|---|
| Header equals publish time | Fusion appears aligned but physical sensor skew remains. | Driver tests compare hardware timestamp, header stamp, source timestamp, and receive timestamp. |
| Unsynced host clocks | Source-to-receive latency is negative or implausible across machines. | Chrony/PTP/gPTP offset monitoring and per-host clock metadata. |
| Reliable QoS backlog | Receive intervals look smooth while header age grows. | Alert on `receive_timestamp - header_stamp` and queue depth, not only topic rate. |
| Best-effort gaps hidden | SLAM drops scans with no visible exception. | Track publication sequence gaps when supported and sensor frame counters. |
| Vendor timestamp semantics drift | Middleware change alters measured latency. | Include RMW vendor/version in timing evidence and regression tests. |
| Recorder-only timestamp | Incident bag cannot separate sensor delay from DDS delay. | MCAP/rosbag provenance contract requires send and receive timestamps where supported. |
| Sequence wrap or unsupported value | False gap alarms. | Treat unsupported sentinel values and wraparound as explicit states. |

## QoS Interaction

| QoS policy | Timing implication | Fusion recommendation |
|---|---|---|
| Reliability | Reliable can preserve old samples and increase tail latency under loss; best effort may drop. | Raw high-rate sensors often prefer best effort plus freshness gates; state estimates often require reliable with tight depth. |
| History/depth | Deep queues can deliver old data after compute stalls. | Set depth from rate x acceptable queue delay, not arbitrary defaults. |
| Deadline | Detects missed publish periods. | Configure for critical periodic topics and subscribe to deadline-missed events or diagnostics. |
| Lifespan | Prevents old samples from being delivered after validity expires. | Use for commands, local maps, and freshness-critical state where supported by RMW. |
| Liveliness | Detects publisher/process absence. | Use with topic monitors for localization, safety, and command publishers. |
| Durability | Transient local can deliver old latched data to late joiners. | Use for maps and static transforms, not raw sensor or command streams. |

## Telemetry

| Metric | Definition | Purpose |
|---|---|---|
| `header_to_source_ms` | `source_timestamp - Header.stamp` | Driver and publisher queue delay. |
| `source_to_receive_ms` | `received_timestamp - source_timestamp` | Middleware/network delay. |
| `receive_to_callback_ms` | Callback start steady time minus receive time when instrumented. | Executor backlog. |
| `header_to_callback_ms` | Callback start ROS time minus `Header.stamp`. | End-to-end data age. |
| `publication_seq_gap` | Difference between consecutive publisher sequence numbers. | Middleware/sample loss detection. |
| `clock_offset_ms{host}` | Time sync offset from reference. | Trust gate for cross-host latency metrics. |

## Acceptance Checks

- Timing-critical subscriptions expose `MessageInfo` metadata in debug logs,
  metrics, or bag sidecars.
- A controlled network-delay test increases `source_to_receive_ms` without
  changing sensor `Header.stamp`.
- A controlled driver-delay test increases `header_to_source_ms` without being
  misclassified as DDS delay.
- Sequence gaps are detected for supported RMW implementations and reported as
  unsupported otherwise.
- QoS compatibility is checked at startup with `ros2 topic info -v` or an
  equivalent manifest validation.
- Incident bags preserve receive and send/publish timestamps when the storage
  stack supports them.

## Related Repository Docs

- [Topic Freshness and Stale Data Contracts](topic-freshness-and-stale-data-contracts.md)
- [Vehicle Middleware: DDS, SOME/IP, and Zenoh](vehicle-middleware-dds-someip-zenoh.md)
- [ROSBag / MCAP Time Provenance Contract](../data-logging/rosbag-mcap-time-provenance-contract.md)
- [ROS 2 Timing Diagnostics and Observability](../monitoring-observability/ros2-timing-diagnostics-observability.md)
- [ROS 2 Time Semantics Runtime Contract](../ros-autoware/ros2-time-semantics-runtime-contract.md)

## Sources

- ROS 2 rmw API, [rmw_message_info_s](https://docs.ros.org/en/rolling/p/rmw/generated/structrmw__message__info__s.html)
- ROS 2 rosbag2_storage API, [SerializedBagMessage](https://docs.ros.org/en/rolling/p/rosbag2_storage/generated/structrosbag2__storage_1_1SerializedBagMessage.html)
- eProsima Fast DDS, [SampleInfo](https://fast-dds.docs.eprosima.com/en/latest/fastdds/api_reference/dds_pim/subscriber/sampleinfo.html)
- ROS 2 Documentation, [Quality of Service settings](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- ROS 2 rosbag2, [Recorder services and publish/receive-time modes](https://github.com/ros2/rosbag2)
