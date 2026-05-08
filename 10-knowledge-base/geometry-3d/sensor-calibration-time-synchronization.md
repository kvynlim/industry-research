# Sensor Calibration and Time Synchronization Fundamentals

Multi-sensor autonomy depends on two promises: every sensor is placed correctly
in space, and every measurement is placed correctly in time. Calibration and
time synchronization failures often look like model errors, perception false
positives, localization drift, or controller instability because the stack is
working with a subtly inconsistent world.

This page covers the foundation needed before LiDAR-camera fusion, radar
tracking, GNSS/INS localization, online mapping, docking, and incident replay.

---

## 1. AV, Indoor, Outdoor, and Airside Relevance

| Domain | Calibration priority | Time priority |
|---|---|---|
| Road AV | Multi-camera/LiDAR/radar extrinsics, camera intrinsics, radar velocity alignment, IMU and GNSS antenna lever arms. | Hardware timestamps, PPS/PTP, camera trigger alignment, LiDAR deskew under vehicle motion. |
| Indoor AMR / forklift | Camera/depth/LiDAR to base frame, safety scanner fields, dock or pallet fiducial alignment. | Host clock monotonicity, trigger latency, wheel odometry and scanner alignment at low speed. |
| Outdoor yard / mine / campus | Multi-LiDAR coverage, RTK antenna lever arm, radar and thermal sensors for weather. | GNSS time, PTP over vehicle Ethernet, packet delay under private wireless or logging load. |
| Airside AV | Surveyed map to vehicle sensor suite, aircraft stand/docking geometry, jet-blast and FOD sensor alignment. | GNSS/PTP traceable logs for incident reconstruction, low-speed docking timestamps, synchronized multi-LiDAR near aircraft. |

---

## 2. Calibration Types

### 2.1 Intrinsic Calibration

Intrinsic calibration estimates parameters internal to a sensor.

| Sensor | Typical intrinsic parameters | Deployment note |
|---|---|---|
| Camera | focal length, principal point, distortion coefficients, rolling-shutter model | Recalibrate or validate after lens replacement, focus change, housing change, or thermal stress. |
| LiDAR | beam angles, range bias, intensity correction, per-channel timing | Usually factory calibrated, but multi-LiDAR systems still need extrinsic calibration and timing checks. |
| Radar | antenna alignment, range/Doppler bias, azimuth/elevation bias | Radar velocity signs and mounting yaw errors are frequent fusion hazards. |
| IMU | scale factor, axis misalignment, gyro/accelerometer bias and noise | Needed for preintegration, ESKF propagation, and motion compensation. |
| Wheel odometry | wheel radius, track width, steering ratio, encoder scale | Tire wear and load change can move these parameters over time. |

### 2.2 Extrinsic Calibration

Extrinsic calibration estimates the rigid transform between frames, usually
`T_base_sensor` or `T_sensor_base`.

```
p_base = T_base_lidar * p_lidar
p_camera = T_camera_base * T_base_lidar * p_lidar
```

Common extrinsic pairs:

- LiDAR to camera for colorization, camera-LiDAR fusion, and projection QA
- LiDAR to LiDAR for surround point-cloud merging
- radar to base frame for object tracking and radial velocity interpretation
- IMU to base frame for inertial propagation
- GNSS antenna to base frame for lever-arm compensation
- safety scanner to base frame for certified protective fields

Extrinsics are mechanical and probabilistic facts. Treat them as versioned
calibration artifacts, not constants buried in code.

### 2.3 Temporal Calibration

Temporal calibration estimates offsets and latencies between sensors:

```
t_true = t_sensor_stamp + clock_offset + transport_delay + processing_delay
```

Important distinctions:

- **Acquisition time:** when photons, laser returns, RF echoes, or IMU samples were measured.
- **Driver timestamp:** when the driver assigned a time.
- **Arrival time:** when the host received the message.
- **Processing time:** when a perception or fusion node consumed the message.

Fusion should use acquisition time whenever possible. Arrival time is rarely
good enough for moving vehicles.

---

## 3. Time Synchronization Architecture

### 3.1 Clock Domains

A vehicle commonly contains several clocks:

```
GNSS receiver clock
  -> PPS / time-of-week
PTP grandmaster
  -> vehicle Ethernet clocks
sensor hardware clocks
  -> camera, LiDAR, radar, IMU
host system clocks
  -> ROS / middleware timestamps
```

Good systems make the clock domain explicit in every driver and log.

### 3.2 Synchronization Methods

| Method | Typical use | Strength | Risk |
|---|---|---|---|
| Hardware trigger | Cameras, strobes, some LiDARs | Deterministic exposure start. | Trigger time is not always readout completion time. |
| PPS from GNSS | GNSS/INS, time server, PTP grandmaster | Global traceability. | GNSS outage or antenna fault can break holdover assumptions. |
| IEEE 1588 PTP / gPTP | Ethernet sensors and compute | Sub-microsecond to microsecond class on supported hardware. | Requires hardware timestamping and switch support. |
| Software timestamping | Low-cost sensors and prototypes | Easy to deploy. | Host load and transport jitter can dominate. |
| Offline alignment | Datasets and calibration runs | Can estimate unknown offsets from motion. | Poor observability can create plausible but wrong offsets. |

### 3.3 Why Milliseconds Matter

Position error from timestamp offset is approximately:

```
position_error = vehicle_speed * time_offset
```

Examples:

| Speed | 20 ms offset | 50 ms offset |
|---|---:|---:|
| 2 m/s low-speed docking | 0.04 m | 0.10 m |
| 10 m/s yard or campus | 0.20 m | 0.50 m |
| 25 m/s road AV | 0.50 m | 1.25 m |

Yaw-rate error also matters. A vehicle turning at `20 deg/s` with a `50 ms`
offset has a one-degree angular mismatch before any sensor noise is considered.

---

## 4. Data Collection for Good Calibration

### 4.1 Observability

Calibration needs motion and geometry that excite the unknowns.

| Unknown | Useful data | Poor data |
|---|---|---|
| camera intrinsics | target fills image at different depths and positions | target only centered and far away |
| LiDAR-camera extrinsic | sharp edges, checkerboards, AprilTags, or high-contrast targets visible in both sensors | flat wall with little 3D structure |
| IMU-camera time offset | rotations and translations with visual texture | static scenes |
| LiDAR-IMU extrinsic | varied turns, acceleration, slopes, and non-degenerate 3D structure | straight constant-speed driving |
| GNSS lever arm | turns and heading changes with high-quality RTK | straight driving only |

### 4.2 Calibration Bay and Field Validation

Recommended deployment pattern:

1. **Factory or build calibration:** full intrinsic and extrinsic calibration after sensor installation.
2. **Calibration bay check:** quick target-based validation after maintenance or impact.
3. **Field residual monitoring:** online checks using reprojection residuals, LiDAR overlap, radar-track alignment, and localization innovation.
4. **Recalibration gate:** require recalibration before returning to autonomous service when residuals exceed thresholds.

For airside and outdoor sites, include thermal soak, vibration, washdown, and
weather exposure in the validation plan. A transform that is correct in a depot
may be wrong after heat, cold, de-icing fluid, or mount flex.

---

## 5. Practical Deployment Notes

### 5.1 Calibration Artifact Format

Every calibration artifact should include:

- sensor serial number and mount position
- vehicle ID and build version
- transform direction and parent/child frames
- timestamp and operator/tool version
- covariance or quality score where available
- source data bag or dataset ID
- approval status and rollback target

For ROS/Autoware deployments, static transforms can be distributed through
URDF, YAML, launch files, or calibration packages. The key is not the file type;
the key is that the transform is versioned, reviewed, and loaded consistently.

### 5.2 Online Monitoring Signals

Useful runtime monitors:

- LiDAR-camera reprojection edge residuals
- multi-LiDAR overlap ICP residuals
- radar object velocity residual vs ego-motion prediction
- GNSS innovation after lever-arm correction
- IMU bias and gravity direction residuals
- PTP offset, path delay, and grandmaster changes
- message age and out-of-order timestamps

These monitors should feed degraded-mode policy. If a calibration or clock
monitor fails, the stack should know whether to slow down, disable a sensor
fusion path, request service, or stop.

### 5.3 Logging Requirements

For incident replay, log:

- raw sensor timestamps and host receipt timestamps
- clock status diagnostics, including PTP/PPS lock
- static transform tree and calibration artifact IDs
- dynamic transforms at sufficient rate
- driver latency statistics
- sensor trigger state and dropped-frame counters

An incident log without clock and calibration provenance is incomplete evidence.

---

## 6. Failure Modes and Risks

| Failure mode | Effect | Mitigation |
|---|---|---|
| Silent extrinsic drift | Perception boxes, maps, and detections are biased but still look plausible. | Monitor residuals and require service after impact, mount work, or residual threshold breach. |
| Wrong transform direction | Sensor fusion appears offset or mirrored. | Use `T_target_source` naming and projection tests in CI. |
| Unsynchronized clocks | Moving objects smear; estimator innovation grows during turns. | Use hardware timestamps and PTP/PPS where available. |
| Timestamping at arrival time | Latency changes with CPU/network load. | Timestamp at acquisition in the sensor or driver boundary. |
| LiDAR scan motion distortion | Point clouds bend during turns or acceleration. | Deskew using high-rate IMU/odometry and per-point timing. |
| Rolling-shutter camera mismatch | Projection error changes by image row. | Use global-shutter cameras for safety-critical geometry or model rolling shutter. |
| PTP grandmaster failover | Clock jumps or offset ramps during operation. | Monitor grandmaster identity and holdover state; define degraded policy. |
| Bad calibration dataset | Optimizer finds a plausible but unobservable solution. | Use calibration motions and targets that excite all unknowns; cross-validate on separate runs. |
| Temperature or vibration sensitivity | Calibration is correct in the depot but wrong in service. | Validate across operating temperature/vibration envelope. |
| Correlated sensors treated as independent | Fusion becomes overconfident. | Preserve calibration covariance and avoid double-counting measurements from shared sources. |

---

## Related Repository Documents

- [Coordinate Frames, Projections, and SE(3)](coordinate-frames-projections-se3.md)
- [RTK-GPS, IMU, and Multi-Sensor Localization](../state-estimation/rtk-gps-imu-localization.md)
- [GTSAM Factor Graph Optimization](../state-estimation/gtsam-factor-graphs.md)
- [Multi-LiDAR Calibration](../../20-av-platform/sensors/multi-lidar-calibration.md)
- [Sensor Degradation and Health Monitoring](../../20-av-platform/sensors/sensor-degradation-health-monitoring.md)
- [Calibration Tracking](../../20-av-platform/sensors/calibration-tracking.md)
- [Deterministic Networking and TSN](../../20-av-platform/networking-connectivity/deterministic-networking-tsn.md)
- [Production LiDAR-to-Map Localization](../../30-autonomy-stack/localization-mapping/overview/production-lidar-map-localization.md)

---

## Sources

- Autoware sensor calibration guide: https://autowarefoundation.github.io/autoware-documentation/main/how-to-guides/integrating-autoware/creating-vehicle-and-sensor-description/calibrating-sensors/
- TIER IV Autoware sensor calibration guide: https://tier4.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/creating-vehicle-and-sensor-description/calibrating-sensors/
- Kalibr camera-IMU calibration toolbox: https://github.com/ethz-asl/kalibr
- Maye et al., "Self-supervised Calibration for Robotic Systems": https://ieeexplore.ieee.org/document/6696437
- Sensors 2025 review on sensor calibration for autonomous systems: https://www.mdpi.com/1424-8220/25/17/5409
- IEEE 1588 Precision Time Protocol overview: https://standards.ieee.org/ieee/1588/6825/
- IEEE 802.1AS timing and synchronization standard: https://1.ieee802.org/tsn/802-1as/
- linuxptp project documentation: https://linuxptp.sourceforge.net/
- ROS 2 time design article: https://design.ros2.org/articles/clock_and_time.html
- ROS message_filters documentation: https://docs.ros.org/en/rolling/p/message_filters/
