# LiDAR Timestamping, PTP/GPS Sync, Deskew, and Provenance

**Last updated:** 2026-05-09

## Why It Matters

Spinning and scanning LiDARs do not measure a frame at one instant. A point
cloud can span tens or hundreds of milliseconds depending on scan rate, return
mode, and packetization. If the stack timestamps the cloud at packet receive
time or frame publish time, ego motion bends walls, stretches vehicles, shifts
ground planes, and corrupts scan matching.

The LiDAR integration contract must state what each timestamp means, how sensor
time is synchronized, and what metadata proves that deskew used the right clock.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| Sync mode | Configure each LiDAR for the approved mode: PTP/gPTP, GPS/PPS plus time message, or documented free-run fallback. |
| Point timing | Preserve per-point, per-column, per-block, or firing-offset timing needed for deskew. |
| Frame stamp | Define whether the ROS/cloud timestamp is scan start, scan end, midpoint, or first packet time. |
| Provenance | Log timestamp mode, sync lock, grandmaster/source identity, UTC offset, and conversion version. |
| Host timing | Record host receive time separately for latency diagnostics; do not substitute it for acquisition time. |
| Extrinsics | Version LiDAR-to-base calibration with the timing config because time offset can look like extrinsic error. |
| Replay | Raw packets plus calibration and timing metadata must be enough to reconstruct point acquisition times offline. |

## Timestamp Semantics

| Timestamp level | Meaning | Fusion use |
|---|---|---|
| Packet timestamp | Time associated with a UDP packet or packet block. | Useful for raw reconstruction, but not always a full point timestamp. |
| Firing/block timestamp | Time for a laser firing group or azimuth block. | Minimum useful input for deskew on spinning sensors. |
| Per-point offset | Relative firing time for each point within the scan. | Best for high-rate ego-motion compensation. |
| Frame timestamp | A chosen representative time for the cloud. | Useful for buffering only if scan duration and convention are known. |
| Host receive timestamp | NIC or software receive time. | Latency and packet-loss diagnostics, not geometry. |

Deskew rule:

```text
point_time = scan_reference_time + point_relative_offset
point_base = T_base_lidar(point_time) * point_lidar
```

For high-rate motion, use an IMU/wheel/continuous-time trajectory at
`point_time`. A single transform at frame midpoint is a validation shortcut, not
a production deskew strategy for moving vehicles.

## Vendor Integration Notes

| Vendor family | Relevant timing patterns | Integration risk |
|---|---|---|
| Ouster | Supports timestamp modes including PTP and sync-pulse based modes; packet data carries timing fields for scan reconstruction. | Ensure `timestamp_mode` matches the vehicle time domain and that metadata is logged with packets. |
| Hesai | Provides PTP and GPS/PPS synchronization guidance across supported models. | Confirm profile, domain, and whether timestamps are UTC/GPS/PTP or sensor local after lock loss. |
| Velodyne/Ouster legacy-style GPS sync | Often uses PPS plus NMEA or GPS time message. | PPS without valid ToD can create correct phase with wrong epoch. |
| ROS drivers | Often expose a header stamp plus packet/cloud fields. | Header stamp convention varies; audit code before using it as acquisition time. |

Do not assume all LiDARs in a rig share the same timestamp convention. Mixed
vendors or mixed firmware can publish clouds that look aligned but refer to
different scan reference times.

## Failure Modes

| Failure mode | Point-cloud symptom | Response |
|---|---|---|
| Host receive timestamp used | Walls curve during turns; scan matching residuals grow with network load. | Require raw timing metadata and reject host-only timing for localization clouds. |
| Scan-start vs scan-end mismatch | Constant pose error proportional to scan duration and speed. | Version frame-stamp convention and validate with motion targets. |
| PTP lock lost silently | Local clock drift appears as slowly changing extrinsic/time offset. | Monitor sync lock and last sync age from each LiDAR. |
| PPS ToD missing | LiDAR time has good phase but wrong absolute second. | Reject until PPS and time message are paired. |
| Packet loss in raw stream | Missing azimuth sectors or non-monotonic point offsets. | Log packet counters and avoid updating maps from corrupted sweeps. |
| Mixed dual-return timing | Returns from the same firing are handled as separate acquisition times. | Preserve return mode and firing offset semantics. |
| Firmware timestamp change | Same config publishes different timestamp scale after update. | Gate firmware and metadata schema through regression replay. |

## Telemetry and Validation Hooks

- Per-sensor sync state, timestamp mode, source identity, firmware, model, and
  metadata schema version.
- Packet sequence gaps, azimuth gaps, packet receive latency, and host RX
  timestamp jitter.
- Scan duration, frame-stamp convention, first/last point times, and monotonic
  point-offset checks.
- Deskew residual metrics: plane sharpness, map residual versus yaw rate, and
  cross-LiDAR alignment under deliberate turns.
- Replay test using raw packets, IMU, wheel odometry, and the recorded timing
  config, with online/offline cloud equivalence checks.

Acceptance checks:

1. Drive a constant-radius turn past poles or wall edges and verify deskewed
   points stay sharp.
2. Kill or isolate PTP and confirm LiDAR sync state changes before clouds are
   accepted for metric fusion.
3. Compare two LiDARs observing the same edge during acceleration; residuals
   should not vary with speed or yaw rate beyond the calibrated budget.

## Related Repository Docs

- [LiDAR Ghost and Multipath Artifacts](lidar-ghost-multipath-artifacts.md)
- [Multi-LiDAR Calibration](multi-lidar-calibration.md)
- [RoboSense LiDAR](robosense-lidar.md)
- [Hesai LiDAR](hesai-lidar.md)
- [GNSS, PPS, PTP Holdover, and Time Integrity](gnss-pps-ptp-holdover-time-integrity.md)
- [Sensor Calibration Time Synchronization](../../10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md)

## Sources

- Ouster, [Time synchronization](https://static.ouster.dev/sensor-docs/image_route1/image_route2/time_sync/time-sync.html)
- Ouster, [Sensor data and metadata](https://static.ouster.dev/sensor-docs/image_route1/image_route2/sensor_data/sensor-data.html)
- Hesai, [PTP synchronization application](https://hesaitechnology.github.io/dev/docs/how_to_guides/ptp_sync_application/)
- Hesai, [GPS synchronization application](https://hesaitechnology.github.io/dev/docs/how_to_guides/gps_sync_application/)
- Velodyne/Ouster, [Velodyne LiDAR Puck manual and GPS time synchronization resources](https://ouster.com/downloads/)
- ROS, [velodyne driver package](https://docs.ros.org/en/rolling/p/velodyne_driver/)
- Linux PTP Project, [ptp4l documentation](https://www.linuxptp.org/documentation/ptp4l/)
