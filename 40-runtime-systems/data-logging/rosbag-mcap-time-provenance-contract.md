# ROSBag and MCAP Time Provenance Contract

**Last updated:** 2026-05-09

## Why It Matters

Incident replay is only as good as its time provenance. For SLAM and fusion, a
bag must answer: when was the physical sample valid, when did the publisher send
it, when did the recorder receive it, which clock source was active, and whether
TF/static calibration state was present at the same time. Without those answers,
replay can reproduce message bytes while losing the timing fault that caused the
vehicle behavior.

MCAP and modern rosbag2 can preserve both receive/log time and publish/send
time. The application `Header.stamp` remains inside the serialized message and
must be interpreted with the run's time-source manifest.

## Provenance Contract

| Artifact | Required content | Purpose |
|---|---|---|
| Bag storage | MCAP for production incident and regression logs unless a project-specific exception is documented. | Indexed, schema-carrying, chunked recording with publish/log time fields. |
| Time base manifest | `use_sim_time`, `/clock` source, host clock sync source, RMW vendor/version, recorder host ID. | Makes timestamp interpretation reproducible. |
| Message metadata | Bag receive/log timestamp and send/publish timestamp when available. | Separates recording time from publisher time. |
| Application stamps | Original `Header.stamp` preserved without restamping. | Preserves acquisition and estimator-validity time. |
| Frame state | `/tf`, `/tf_static`, static calibration artifact IDs, map/version IDs. | Allows correct projection and localization replay. |
| QoS snapshot | Offered/requested QoS for recorded topics or launch manifest hash. | Explains missing transient-local, reliability, or lifespan behavior. |
| Recorder state | Split/snapshot events, pause/resume mode, dropped cache counts, disk pressure. | Identifies recorder-induced gaps. |

## Timestamp Semantics

| Field | Meaning |
|---|---|
| MCAP `log_time` | Time at which the message was recorded. |
| MCAP `publish_time` | Time at which the message was published; if unavailable it is set to `log_time`. |
| rosbag2 `recv_timestamp` | Nanosecond timestamp when the recorder received the message. |
| rosbag2 `send_timestamp` | Nanosecond timestamp when the message was published; if unavailable it is set to receive time. |
| ROS message `Header.stamp` | Application-defined acquisition or validity timestamp inside the message. |

Do not assume these are equal. For sensor fusion, `Header.stamp` usually drives
alignment. For recorder and middleware analysis, use send/publish and
receive/log timestamps. For fleet incident timelines, map all three to the
documented clock source and host clock offset.

## Recording Profile

Recommended production profile for SLAM/fusion evidence:

```bash
ros2 bag record -s mcap \
  --all \
  --include-hidden-topics \
  --repeat-all-transient-local 1 \
  --storage-config-file mcap_storage.yaml
```

For simulation or deterministic replay capture:

```bash
ros2 bag record -s mcap --use-sim-time --all
```

Minimum topic set when selective recording is required:

| Group | Topics |
|---|---|
| Time | `/clock`, recorder diagnostics, host time sync status. |
| Frames | `/tf`, `/tf_static`, calibration metadata topic or manifest. |
| Localization | Raw/preprocessed LiDAR, IMU, GNSS, vehicle twist, NDT pose, EKF pose/twist, localization diagnostics. |
| Fusion | Camera/LiDAR/radar inputs, synchronized outputs, message-filter diagnostics. |
| Runtime | `/diagnostics`, `/statistics`, node lifecycle events, QoS manifest, map/config/model versions. |

## MCAP Writer Options

| Option class | Guidance |
|---|---|
| Chunking | Keep chunking enabled for indexed access unless an emergency fast-write profile requires otherwise. |
| Compression | Prefer MCAP chunk compression (`Lz4` or `Zstd`) over rosbag2 file/message compression when indexed reads matter. |
| Summary/index | Do not ship validation bags without summary/index unless a post-process step repairs them. |
| CRC | Disable CRC only when write bandwidth is the limiting factor and storage health is covered elsewhere. |
| Split policy | Split by time and size so incident windows are bounded and uploadable. Preserve transient-local data on splits. |

## Failure Modes

| Failure mode | Symptom | Control |
|---|---|---|
| Missing `/clock` | Replay uses wall time or starts with zero-time ambiguity. | Record `/clock` and manifest `use_sim_time`; fail replay launch if absent. |
| Restamped bag | Header stamps no longer match original acquisition time. | Preserve serialized messages; use sidecar metadata for alternate time views. |
| Missing `/tf_static` after trim | First replay samples cannot transform or use wrong extrinsics. | Repeat transient-local topics on split and include TF warmup in clips. |
| Receive-time-only evidence | Cannot distinguish network backlog from sensor delay. | Use rosbag2/MCAP path that preserves send/publish time where available. |
| Unindexed fast-write file | Scenario mining and random-access replay are slow or incomplete. | Post-process fast-write bags before upload and validation. |
| Snapshot too small | Triggered event lacks pre-roll needed for TF and message filters. | Size snapshot cache by sensor rate, TF cache, and fusion queue budgets. |
| QoS override mismatch | Recorder misses best-effort or transient-local topics. | Version recorder QoS overrides and verify topic discovery before motion. |

## Replay Contract

| Replay mode | Rule |
|---|---|
| Timing regression | Run at 1x with `--clock`; compare age, skew, and drop histograms. |
| Algorithm stress | Accelerated replay allowed, but results cannot replace 1x acceptance. |
| Bag seek | Backward seek must reset filters, TF caches, EKF history, and scan accumulators. |
| Trimmed incident clip | Include pre-roll for `/tf`, `/tf_static`, maps, and slow topic warmup. |
| Cross-version replay | Preserve schema definitions, message package versions, map/config/model IDs, and RMW metadata. |

## Acceptance Checks

- A recorded incident can answer all three timing questions for critical topics:
  header/acquisition time, publish/send time, and receive/log time.
- `ros2 bag info -s mcap <bag>` succeeds and shows expected topic coverage.
- `/tf_static` and map/calibration metadata are available to a late-joining
  replay node before localization output is evaluated.
- Replay with `use_sim_time=true` does not publish trusted localization output
  before `/clock` is non-zero.
- Bag split and snapshot tests preserve transient-local state and recorder
  metadata.
- A post-processed MCAP is indexed and supports timestamp-bounded reads for
  scenario mining.

## Related Repository Docs

- [On-Vehicle Data Triage and Selective Upload Prioritization](on-vehicle-data-triage-selective-upload.md)
- [AV Data Recorder and DSSAD Hardware](av-data-recorder-dssad-hardware.md)
- [ROS 2 Time Semantics Runtime Contract](../ros-autoware/ros2-time-semantics-runtime-contract.md)
- [DDS Source and Receive Timestamp Contract](../middleware/dds-source-receive-timestamp-contract.md)
- [TF2 Cache and Stale Transform Playbook](../ros-autoware/tf2-cache-stale-transform-playbook.md)
- [Fleet Data Pipeline](../../50-cloud-fleet/data-platform/fleet-data-pipeline.md)

## Sources

- MCAP, [Format Specification](https://mcap.dev/spec)
- MCAP, [ROS 2 guide](https://mcap.dev/guides/getting-started/ros-2)
- ROS Index, [rosbag2_storage_mcap](https://index.ros.org/p/rosbag2_storage_mcap/)
- ROS 2 rosbag2, [Recording, simulation time, split, snapshot, and services](https://github.com/ros2/rosbag2)
- ROS 2 rosbag2_storage API, [SerializedBagMessage](https://docs.ros.org/en/rolling/p/rosbag2_storage/generated/structrosbag2__storage_1_1SerializedBagMessage.html)
