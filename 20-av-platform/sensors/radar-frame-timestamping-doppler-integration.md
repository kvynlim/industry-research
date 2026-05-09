# Radar Frame Timestamping and Doppler Integration

**Last updated:** 2026-05-09

## Why It Matters

Automotive radar measures over an integration interval. A frame is built from a
sequence of chirps, and Doppler velocity comes from phase change across chirps
inside that interval. A single radar message timestamp therefore needs a clear
meaning: frame start, midpoint, end, first chirp, last chirp, or host receive
time. Fusion also needs to know whether reported velocity is radial, ego-motion
compensated, tracked-object velocity, or raw detection Doppler.

Bad radar timing creates false relative velocity, poor radar-camera association,
and inconsistent dynamic-object tracking during acceleration and turns.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| Frame reference | Define radar message timestamp as measurement midpoint unless the sensor contract requires another convention. |
| Integration window | Publish frame duration, chirp timing, and output cycle time where available. |
| Clock source | Radar follows vehicle PTP/gPTP, hardware trigger, or a documented CAN/Ethernet timebase with bounded conversion. |
| Velocity semantics | Distinguish raw radial Doppler, ego-compensated velocity, and tracker-estimated object velocity. |
| Host timing | Host receive time and CAN/Ethernet arrival time are diagnostics, not acquisition time. |
| Provenance | Log sensor timestamp mode, sequence, frame counter, sync state, firmware, and radar configuration. |
| Replay | Raw detections/tracks plus timing and chirp/frame config must reproduce fusion alignment offline. |

## Radar Time Model

```text
frame_start
  chirp 0
  chirp 1
  ...
  chirp N-1
frame_end

t_measurement ~= (frame_start + frame_end) / 2
```

For tracked objects, the timestamp should still identify the measurement update
epoch. The tracker may predict objects to another time, but that prediction time
must be explicit.

## Data Semantics

| Field | Required interpretation |
|---|---|
| `header.stamp` | Acquisition or measurement epoch, not publish time. |
| `frame_id` | Radar sensor frame with calibrated extrinsic to `base_link`. |
| Range/azimuth/elevation | Geometry at the measurement epoch. |
| Doppler/radial velocity | Velocity along the radar line of sight unless documented otherwise. |
| Cartesian velocity | Must state whether ego compensation and tracker smoothing were applied. |
| RCS/SNR/noise | Measurement quality and gating features, not timestamp substitutes. |
| Track age | Tracker internal history; does not replace measurement time. |

## Failure Modes

| Failure mode | Symptom | Response |
|---|---|---|
| Host receive timestamp used | Radar-camera association shifts with Ethernet/CAN load. | Use sensor acquisition time and log host latency separately. |
| Frame-start vs midpoint mismatch | Apparent radial velocity bias during ego acceleration. | Convert timestamps to the agreed measurement epoch. |
| Doppler treated as Cartesian velocity | Object tracker over- or under-compensates moving actors. | Keep radial velocity semantics through fusion or explicitly transform with geometry. |
| Ego compensation undocumented | Fusion subtracts ego motion twice or not at all. | Version radar output mode and test with static targets during vehicle turns. |
| Frame counter drops | Tracker sees impossible object jumps. | Detect sequence gaps and avoid updating tracks with partial frames. |
| Radar sync loss | Time drift appears as association errors rather than a timing fault. | Monitor sync state and last valid time conversion. |
| Variable chirp/profile mode | Timestamp and Doppler resolution change with mode. | Log radar profile ID and integration window per frame. |

## Telemetry and Validation Hooks

- Frame counter, sensor timestamp, converted vehicle timestamp, host receive
  timestamp, and latency distribution.
- Radar profile ID, frame period, chirp count, chirp interval, Doppler
  resolution, and maximum unambiguous velocity.
- Sync state, PTP/trigger lock, temperature, firmware, and dropped-frame count.
- Static-target ego compensation residual during straight driving, braking, and
  constant-radius turns.
- Radar-LiDAR-camera association residual against known reflectors, cones, and
  moving vehicles.
- Replay check that raw detections and tracks align to the same measurement
  epoch used online.

Acceptance checks:

1. Static reflectors report near-zero ego-compensated velocity after timestamp
   conversion during acceleration and turns.
2. Dropped frames and radar profile changes are visible in diagnostics and logs.
3. The fusion layer can tell raw detections from tracked objects and does not
   mix their timestamp semantics.

## Related Repository Docs

- [4D Imaging Radar](4d-radar.md)
- [GNSS, PPS, PTP Holdover, and Time Integrity](gnss-pps-ptp-holdover-time-integrity.md)
- [PTP and gPTP Profiles for Vehicle Ethernet](../networking-connectivity/ptp-gptp-profiles-vehicle-ethernet.md)
- [Time Sync Health Monitoring and Degraded Mode](../diagnostics/time-sync-health-monitoring-degraded-mode.md)
- [Radar Native World Models](../../30-autonomy-stack/world-models/radar-native-world-models.md)

## Sources

- Texas Instruments, [mmWave-L-SDK motion and presence detection demo guide](https://software-dl.ti.com/ra-processors/esd/MMWAVE-L-SDK/05_04_00_01/exports/api_guide_xwrL64xx/MMWAVE_DEMO.html)
- Texas Instruments, [mmWave SDK documentation](https://www.ti.com/tool/MMWAVE-SDK)
- NVIDIA DRIVE OS, [DriveWorks SDK documentation](https://developer.nvidia.com/docs/drive/drive-os/latest/public/driveworks-nvsdk/)
- ROS, [radar_msgs package documentation](https://docs.ros.org/en/rolling/p/radar_msgs/)
- Autoware, [radar tracks message integration references](https://autowarefoundation.github.io/autoware-documentation/main/)
