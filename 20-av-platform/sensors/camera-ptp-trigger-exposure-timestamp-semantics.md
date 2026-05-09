# Camera PTP, Trigger, Exposure, and Timestamp Semantics

**Last updated:** 2026-05-09

## Why It Matters

A camera frame timestamp is only useful if it says which physical instant it
represents. For global shutter it might be trigger time, exposure start,
exposure midpoint, or exposure end. For rolling shutter it might refer to the
first row while other rows were exposed later. For HDR it may represent multiple
exposure intervals. If the stack treats all of these as "image time", LiDAR
projection, visual SLAM, stereo, radar-camera fusion, and incident replay drift
under motion.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| Clock source | Cameras either follow the vehicle PTP/gPTP domain or are triggered by a controller whose clock is traceable to it. |
| Trigger policy | Multi-camera rigs use hardware trigger, scheduled action commands, or a validated PTP trigger method with trigger counters. |
| Frame stamp | Define the image header timestamp as exposure midpoint unless a sensor-specific reason says otherwise. |
| Rolling shutter | Publish row readout time and frame-start convention for rolling-shutter cameras. |
| Exposure metadata | Log exposure time, gain, HDR mode, trigger ID, chunk timestamp, dropped-frame counter, and PTP lock state. |
| Host timing | Host receive time is a latency diagnostic, not the acquisition timestamp. |
| Replay | Raw image, chunk metadata, calibration, trigger log, and timing config must reproduce acquisition times offline. |

## Timestamp Semantics

| Concept | Definition | Fusion use |
|---|---|---|
| Trigger time | External signal or scheduled command reaches the camera trigger input. | Useful only after trigger delay is calibrated or specified. |
| Exposure start | Sensor begins integrating light for a frame or row. | Needed for rolling-shutter and strobe timing. |
| Exposure midpoint | Midpoint of the effective integration interval. | Preferred representative timestamp for global-shutter fusion. |
| Exposure end | Sensor completes integration. | Useful for some camera APIs and validation, but must be converted deliberately. |
| Readout complete | Frame is available for transport. | Latency diagnostic, not scene time. |
| Host receive | Driver or NIC receives image data. | Transport diagnostic only. |

Global shutter conversion:

```text
t_image = t_exposure_start + exposure_time / 2
```

Rolling shutter conversion:

```text
t_row = t_frame_start + row_index * row_readout_time + exposure_time / 2
```

For multi-exposure HDR, publish enough metadata to identify which exposure
interval was used for the perception image or calibration target.

## PTP and Trigger Patterns

| Pattern | Strength | Risk |
|---|---|---|
| PTP-synchronized free-run | Simple Ethernet camera array; frames carry PTP-based timestamps. | Cameras may not expose simultaneously unless frame phases are controlled. |
| Hardware trigger fanout | Tight simultaneity across cameras and strobes. | Trigger controller must be traceable to vehicle time and cable delays must be known. |
| Scheduled action command | Ethernet command can trigger multiple cameras at a target PTP time. | Requires switch, camera, and driver support; validate missed actions and network load. |
| Software trigger | Useful for lab capture and low-rate tools. | Not acceptable for metric fusion under load unless bounded and measured. |

## Failure Modes

| Failure mode | Symptom | Response |
|---|---|---|
| Header stamp is publish time | Projection residuals grow with CPU load and image size. | Require camera chunk/hardware timestamps and log host time separately. |
| Trigger counter mismatch | Surround frame set combines different exposure instants. | Drop or mark the set; do not fuse as simultaneous. |
| PTP lock lost | Camera free-runs but still publishes frames. | Mark degraded timing and stop using frames for metric fusion after the holdover budget. |
| Rolling shutter ignored | Vertical objects lean during turns; VO residuals correlate with yaw rate. | Use row-time model or restrict the camera to non-metric perception. |
| Auto-exposure changes silently | Motion blur and saturation change measurement quality. | Record exposure/gain/HDR metadata and feed health monitoring. |
| HDR timestamp ambiguous | Bright and dark regions represent different intervals. | Version HDR mode and define which exposure controls the frame timestamp. |
| Strobe delay unmodeled | Close-range inspection image appears shifted relative to LiDAR. | Calibrate strobe and trigger delays as part of camera timing config. |

## Telemetry and Validation Hooks

- PTP lock/status, grandmaster identity where available, timestamp latch values,
  and camera clock drift.
- Trigger input counter, frame ID, dropped frame count, exposure active signal,
  and action command status.
- Chunk timestamp, exposure time, gain, HDR mode, white balance/ISP config, and
  readout time.
- Multi-camera skew measured by imaging the same LED or timing target.
- LiDAR-camera reprojection residual versus vehicle speed and yaw rate.
- Rolling-shutter validation using a rotating target or controlled vehicle turn.

Acceptance checks:

1. Frame-set trigger IDs match across all cameras for fused surround frames.
2. PTP loss changes camera health state and fusion policy within the configured
   timeout.
3. Reprojection residuals do not correlate with exposure time, frame rate, or
   host CPU load.

## Related Repository Docs

- [Visible Cameras](visible-cameras.md)
- [Sensor Calibration Time Synchronization](../../10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md)
- [GNSS, PPS, PTP Holdover, and Time Integrity](gnss-pps-ptp-holdover-time-integrity.md)
- [PTP and gPTP Profiles for Vehicle Ethernet](../networking-connectivity/ptp-gptp-profiles-vehicle-ethernet.md)
- [Time Sync Health Monitoring and Degraded Mode](../diagnostics/time-sync-health-monitoring-degraded-mode.md)

## Sources

- Basler, [Precision Time Protocol](https://docs.baslerweb.com/precision-time-protocol)
- Basler, [Scheduled Action Commands](https://docs.baslerweb.com/scheduled-action-commands)
- Basler, [Data Chunks](https://docs.baslerweb.com/data-chunks)
- Teledyne FLIR, [Spinnaker SDK documentation](https://softwareservices.flir.com/spinnaker/latest/)
- ROS 2, [spinnaker_camera_driver](https://docs.ros.org/en/ros2_packages/kilted/api/spinnaker_camera_driver/index.html)
- Linux kernel docs, [Timestamping](https://docs.kernel.org/networking/timestamping.html)
