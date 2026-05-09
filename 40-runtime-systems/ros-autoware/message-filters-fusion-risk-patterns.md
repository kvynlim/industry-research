# Message Filters Fusion Risk Patterns

**Last updated:** 2026-05-09

## Why It Matters

`message_filters` is convenient for camera/LiDAR/IMU/GNSS fusion, but it can
turn timing assumptions into hidden queues. A synchronizer can create plausible
but wrong sensor tuples, hold old data until TF is available, or drop the only
scan that explains a localization event. SLAM deployment should treat every
filter as an explicit runtime contract: input timestamps, slop, queue depth,
drop policy, and replay behavior.

## Synchronizer Contract

| Filter behavior | Contract | Risk if unspecified |
|---|---|---|
| Exact synchronization | Use only when sensors are hardware synchronized or generated from the same clock tick. | Starvation because stamps differ by microseconds. |
| Approximate synchronization | `slop` is smaller than the physical fusion tolerance and larger than measured timestamp jitter. | Fusion of stale or causally impossible samples. |
| Queue size | Queue depth is derived from input rate x maximum tolerated wait time. | Old tuples emitted after compute stalls or TF recovery. |
| Header requirement | All fusion inputs carry valid `Header.stamp`; headerless inputs are adapted before the synchronizer. | Arrival-time synchronization hides transport and executor jitter. |
| Known offsets | Per-sensor fixed offsets are calibrated and configured through explicit offset handling. | Calibration delay is hidden in a large slop value. |
| Drop visibility | Every filter exports dropped, processed, queued, and age/skew metrics. | The graph appears healthy while fusion is starved. |
| TF dependency | TF wait queues are budgeted separately from message synchronization queues. | Filter emits a matched tuple that is immediately dropped by TF. |

## Risk Patterns

| Pattern | How it appears | Runtime control |
|---|---|---|
| Slop as a band-aid | Increasing `slop` makes drops disappear but localization gets softer or inconsistent. | Establish max physical skew per sensor pair and fail config above it. |
| Arrival-time sync | `sync_arrival_time` or callback-time stamps make live tests pass until network load changes. | Synchronize on acquisition/validity stamps; use arrival time only for non-physical telemetry. |
| Headerless data | `allow_headerless=true` admits messages with current ROS time. | Wrap data into stamped messages at source or exclude from physical fusion. |
| Queue hiding overload | CPU stall builds a queue, then fusion processes old tuples after the vehicle moved. | Lifespan/freshness gate before fusion callback; drop tuples older than budget. |
| Asymmetric sensor rates | A 100 Hz IMU floods a queue while 10 Hz LiDAR controls tuple release. | Downsample or preintegrate high-rate streams before multi-topic synchronization. |
| Replay acceleration | At 5x replay, message filters drop or pair differently than on vehicle. | Acceptance replay at 1x and stress replay separately with expected drop envelopes. |
| TF after sync | Tuple matched successfully but transform at tuple stamp is missing. | Treat message sync and TF readiness as one end-to-end budget with separate metrics. |
| Mixed time domains | One sensor uses wall time, another uses `/clock`. | Launch-time stamp-domain validation and sample header sanity checks. |

## Parameter Guidance

| Parameter | Sizing rule |
|---|---|
| `slop` | `max(sensor_timestamp_jitter + calibrated_offset_uncertainty + transport_jitter_seen_before_sync)`, capped by the fusion algorithm's physical tolerance. |
| `queue_size` | At least `ceil(max_wait_sec * highest_input_rate_hz) + burst_margin`, but bounded so stale data cannot exceed freshness budget. |
| `queue_offset` | Use only for measured fixed offsets; record calibration source and sign convention. |
| `allow_headerless` | `false` for SLAM/fusion. If unavoidable, isolate as degraded mode and tag outputs. |
| `sync_arrival_time` | `false` for physical sensors. Use only for diagnostics where arrival order is the fact being measured. |

## Fusion Telemetry

| Metric | Definition | Alert |
|---|---|---|
| `sync_tuple_skew_ms` | Max header stamp minus min header stamp inside emitted tuple. | Above configured slop or physical tolerance. |
| `sync_tuple_age_ms` | Callback start ROS time minus newest and oldest tuple stamp. | Above fusion freshness budget. |
| `sync_drop_count{input,reason}` | Drops by queue full, out-of-order, stale, no TF, bad stamp. | Any sustained growth outside tested envelope. |
| `sync_queue_depth{input}` | Current queued messages per input. | Approaches configured queue size. |
| `sync_emit_rate_hz` | Tuples emitted per second. | Below expected fusion output rate. |
| `input_stamp_regression_count` | Header stamp decreases on a topic. | Any non-replay occurrence is fault. |
| `input_clock_domain_fault` | Stamp is implausibly far from node ROS time. | Blocks fusion activation. |

## Replay Behavior

Message filters are sensitive to bag ordering, clock rate, and `/tf` warmup.
Replay validation should run these cases:

| Case | Expected result |
|---|---|
| 1x full-rate replay | Tuple rate, skew distribution, and drops match vehicle envelope. |
| Replay with backward seek | Queues clear before output resumes. |
| Replay with missing topic | Node enters degraded or error state, not partial silent fusion. |
| Replay with delayed `/tf` | Drops are attributed to TF readiness, not generic queue full. |
| Accelerated replay | Drop behavior is measured and marked non-acceptance unless it matches 1x. |

## Acceptance Checks

- Every physical fusion synchronizer has a documented `slop`, `queue_size`,
  freshness cutoff, and drop policy.
- `allow_headerless=false` and `sync_arrival_time=false` on production
  SLAM/fusion inputs.
- Synthetic skew injection above the configured slop produces drops or degraded
  state, not fused output.
- CPU-stall fault injection does not emit tuples older than the freshness budget
  after recovery.
- Message filter metrics are visible in `/diagnostics`, `/statistics`, or the
  fleet metrics pipeline.
- Replay at 1x reproduces tuple count and skew histograms within the accepted
  tolerance.

## Related Repository Docs

- [ROS 2 Time Semantics Runtime Contract](ros2-time-semantics-runtime-contract.md)
- [TF2 Cache and Stale Transform Playbook](tf2-cache-stale-transform-playbook.md)
- [Autoware Localization Timing Diagnostics](autoware-localization-timing-diagnostics.md)
- [Topic Freshness and Stale Data Contracts](../middleware/topic-freshness-and-stale-data-contracts.md)
- [ROS 2 Timing Diagnostics and Observability](../monitoring-observability/ros2-timing-diagnostics-observability.md)

## Sources

- ROS 2 message_filters API, [ApproximateTimeSynchronizer and Cache](https://docs.ros.org/en/rolling/p/message_filters/message_filters.html)
- ROS 2 Documentation, [Using stamped datatypes with tf2_ros::MessageFilter](https://docs.ros.org/en/rolling/Tutorials/Intermediate/Tf2/Using-Stamped-Datatypes-With-Tf2-Ros-MessageFilter.html)
- ROS 2 Documentation, [Topic statistics](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Topic-Statistics.html)
- ROS 2 Documentation, [Quality of Service settings](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
