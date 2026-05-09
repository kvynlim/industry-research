# Autoware Localization Timing Diagnostics

**Last updated:** 2026-05-09

## Why It Matters

Autoware localization combines delayed, high-rate, and compute-heavy inputs:
LiDAR scans, NDT scan matching, EKF pose/twist fusion, GNSS/IMU, vehicle twist,
and TF publication. Timing faults often look like localization faults: low NDT
score, pose jump, map mismatch, or planning instability. The deployment contract
must make delay, execution time, skipped outputs, and TF readiness visible before
pose estimates reach planning.

## Localization Timing Contract

| Component | Contract | Diagnostic signal |
|---|---|---|
| LiDAR preprocessing | `points_raw` header stamp is scan validity time; preprocessing preserves or documents scan midpoint/end semantics. | Point cloud age and NDT `sensor_points_delay_time_sec`. |
| NDT scan matcher | Scan matching publishes only when input delay, TF transform, point count, score, and execution time pass configured gates. | `scan_matching_status`, `exe_time_ms`, transform probability, skipped publish count. |
| EKF localizer | Pose and twist inputs carry sensor-valid stamps; additional delay parameters compensate known fixed delays only. | Pose/twist delay gates, no-update counts, Mahalanobis rejections. |
| TF output | `map -> odom` and `odom -> base_link` are stamped at estimator validity time and published at configured rate. | TF age, lookup failures, output period. |
| Diagnostics | Timing diagnostics publish even when localization output is withheld. | `/diagnostics` and debug topics remain live in degraded state. |
| Replay | Result bags include localization inputs, outputs, `/tf`, `/tf_static`, `/clock`, debug timing topics, and diagnostics. | Offline diagnostics plots and flag checks reproduce event timing. |

## Key Autoware Signals

| Signal | Why it matters |
|---|---|
| `sensor_points_delay_time_sec` | Rejects or warns on delayed point clouds before NDT trusts the scan. |
| `is_succeed_transform_sensor_points` | Separates TF timing/frame failures from scan matching failures. |
| `execution_time` / `exe_time_ms` | Shows whether NDT compute exceeds the configured critical upper bound. |
| `skipping_publish_num` | Counts consecutive rejected NDT estimations that can starve EKF/planning. |
| `transform_probability` and related scores | Distinguish timing-related bad input from geometric map mismatch. |
| EKF `pose_additional_delay` / `twist_additional_delay` | Compensate fixed timing offsets; should not be used to hide variable latency. |
| EKF `pose_measure_uncertainty_time` | Models timestamp uncertainty in pose measurement covariance. |
| Autoware topic state monitor statuses | `NotReceived`, `WarnRate`, `ErrorRate`, and `Timeout` catch missing or low-rate inputs. |

## Failure Modes

| Failure mode | Symptom | Control |
|---|---|---|
| Delayed point cloud | NDT output skipped; pose freezes or EKF extrapolates. | Gate on `sensor_points_delay_time_sec` and alert before planning consumes stale pose. |
| NDT overrun | Pose output period becomes irregular; planner sees pose bursts. | Bound `exe_time_ms`, CPU/GPU profile, and degrade before deadline miss cascades. |
| TF unavailable for scan | Scan matching reports transform failure; message filters fill. | TF warmup checks, static extrinsics in bag, transform age diagnostics. |
| Pose/twist timestamp mismatch | EKF yaw or velocity estimate oscillates. | Validate derivative consistency and tune additional delays only from measured offsets. |
| Stale GNSS regularization | NDT pulled toward old or poor GNSS pose. | Apply freshness and covariance gates before regularization input is accepted. |
| Replay clock mismatch | Offline result differs from vehicle event. | Enforce `use_sim_time`, record `/clock`, and run 1x replay acceptance. |
| Silent localization starvation | Planning keeps last pose after localization stops publishing. | Topic freshness contract and heartbeat on localization outputs. |

## Telemetry

| Metric | Definition | Target behavior |
|---|---|---|
| `localization_input_age_ms{topic}` | Node ROS time minus input `Header.stamp`. | Below topic-specific freshness budget. |
| `ndt_execution_ms` | NDT scan matching execution time. | p99 below configured upper bound with margin. |
| `ndt_publish_period_ms` | Period between accepted NDT outputs. | Stable within localization design rate. |
| `ekf_output_age_ms` | Node ROS time minus EKF output header stamp. | Below planning freshness budget. |
| `tf_map_odom_age_ms` | Node ROS time minus latest `map -> odom` stamp. | Below TF consumer tolerance. |
| `localization_skip_count` | Consecutive rejected or withheld outputs. | Zero in nominal operation; bounded degraded response. |
| `diagnostic_state{component}` | OK/WARN/ERROR from localization diagnostics. | Fleet alerting uses WARN as early action, ERROR as autonomy gate. |

## Replay and Evaluation

Use replay as a timing regression test, not just an accuracy test:

```bash
ros2 bag play localization_event.mcap --clock
ros2 launch autoware_launch localization.launch.xml use_sim_time:=true
```

Acceptance replay should export:

- `/diagnostics` for `ndt_scan_matcher`, EKF, pose instability, and topic state.
- NDT debug topics including `exe_time_ms` and scan matching scores.
- Pose, twist, `/tf`, `/tf_static`, and raw/preprocessed point clouds.
- A manifest of `sensor_points.timeout_sec`, EKF additional delay settings, and
  localization output rates.

Autoware localization evaluation scripts can process result bags and diagnostic
flags. Use them to assert that delay gates trip at known injected faults and stay
negative during nominal scenarios.

## Acceptance Checks

- `sensor_points_delay_time_sec` rises under injected LiDAR delay and blocks or
  degrades NDT output according to the launch contract.
- NDT p99 `exe_time_ms` remains below the configured critical bound during
  representative airport routes and dense point cloud scenes.
- EKF rejects or increases uncertainty for deliberately delayed pose/twist
  inputs instead of silently fusing them as current.
- Planning never consumes localization output older than its freshness budget.
- A missing static sensor transform fails readiness before localization
  publishes trusted pose.
- Replay of a known localization event reproduces diagnostics state transitions
  within the defined timestamp tolerance.

## Related Repository Docs

- [Autoware Universe Deep Dive](autoware-universe-deep-dive.md)
- [ROS 2 Time Semantics Runtime Contract](ros2-time-semantics-runtime-contract.md)
- [TF2 Cache and Stale Transform Playbook](tf2-cache-stale-transform-playbook.md)
- [Message Filters Fusion Risk Patterns](message-filters-fusion-risk-patterns.md)
- [ROS 2 Timing Diagnostics and Observability](../monitoring-observability/ros2-timing-diagnostics-observability.md)
- [SLAM Map Benchmark Protocol](../../60-safety-validation/verification-validation/slam-map-benchmark-protocol.md)

## Sources

- Autoware Core, [autoware_ndt_scan_matcher](https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/)
- Autoware Core, [autoware_ekf_localizer](https://autowarefoundation.github.io/autoware_core/latest/localization/autoware_ekf_localizer/)
- Autoware Universe, [autoware_topic_state_monitor](https://autowarefoundation.github.io/autoware_universe/main/system/autoware_topic_state_monitor/)
- Autoware Tools, [autoware_localization_evaluation_scripts](https://autowarefoundation.github.io/autoware_tools/main/localization/autoware_localization_evaluation_scripts/)
- Autoware Documentation, [Localization component design](https://tier4.github.io/autoware-documentation/latest/design/autoware-architecture/localization/)
