# Time Sync, PTP, Timestamping, and Latency Models

Time synchronization is a state-estimation input, not an infrastructure detail.
Every fused measurement asks: what physical event happened, in which frame, and
at what acquisition time? PTP, hardware timestamping, sensor clocks, middleware
timestamps, and latency models determine whether that answer is accurate enough
for perception, SLAM, mapping, and control.

---

## Related docs

- [Sensor Calibration and Time Synchronization](../geometry-3d/sensor-calibration-time-synchronization.md)
- [Time Synchronization Error Budgets](time-synchronization-error-budgets.md)
- [Sensor Likelihoods, Noise, and Error Budgets](../sensors/sensor-likelihoods-noise-error-budgets.md)
- [Information Filters and Smoothers](../state-estimation/information-filters-and-smoothers.md)
- [Benchmarking, Metrics, and Statistical Validity](benchmarking-metrics-statistical-validity.md)

---

## Why it matters for AV, perception, SLAM, and mapping

At vehicle speed, timing error becomes spatial error:

```
position_error ~= speed * time_error
```

At 20 m/s, a 10 ms timestamp error is about 0.2 m before considering yaw,
rolling shutter, LiDAR scan motion, or radar frame integration. During turns,
an angular-rate timing error rotates sensor rays and map residuals. A perception
stack can appear geometrically miscalibrated when the root cause is time.

Time quality affects:

- camera-LiDAR calibration and projection
- radar Doppler ego compensation
- LiDAR deskewing
- IMU preintegration
- multi-camera association
- map alignment and loop closure residuals
- latency budgets for planning and control

---

## Core math and algorithm steps

### Clock model

A local clock can be modeled as:

```
t_local = a * t_ref + b + epsilon(t)
```

where:

- `a` is clock rate or skew
- `b` is offset
- `epsilon(t)` is jitter, wander, quantization, and measurement noise

Offset error creates a constant time shift. Skew creates error that grows with
elapsed time:

```
offset_error(t) = b_error + (a_error - 1) * t
```

### Sensor acquisition time versus arrival time

Use acquisition time for fusion:

```
t_acq = time when photons, laser returns, RF echoes, IMU samples, or encoder
        edges were physically measured
```

Arrival time is:

```
t_arrival = t_acq + sensor_pipeline_delay + transport_delay + scheduling_delay
```

Arrival time is useful for latency monitoring, not as a substitute for
measurement time.

### PTP roles

IEEE 1588 Precision Time Protocol synchronizes clocks over a network. In a
typical Linux deployment:

```
grandmaster clock
  -> network PTP messages
  -> NIC PTP hardware clock (PHC)
  -> system clock via phc2sys
  -> application timestamps
```

`ptp4l` disciplines the PTP hardware clock using network PTP messages.
`phc2sys` synchronizes the system clock to a PHC or another selected clock.
Hardware timestamping reduces timestamp uncertainty by taking timestamps close
to the network hardware instead of after OS scheduling.

### Latency budget

Separate deterministic delay and jitter:

```
latency_total =
  exposure_or_integration_time +
  sensor_readout_delay +
  sensor_processing_delay +
  transport_delay +
  driver_queue_delay +
  middleware_queue_delay +
  application_processing_delay
```

For fusion, represent known delay as a time offset and uncertainty as noise:

```
t_measurement = t_stamp - calibrated_offset
sigma_time^2 = sigma_clock^2 + sigma_jitter^2 + sigma_model^2
```

Convert to state residual uncertainty when needed:

```
sigma_position_time ~= ||v|| * sigma_time
sigma_yaw_time ~= |yaw_rate| * sigma_time
```

### Timestamp validation procedure

```
identify the clock domain for every timestamp
verify whether timestamp is acquisition, mid-exposure, start-of-frame, or arrival
measure fixed offset using hardware trigger, PPS, LED flash, motion rig, or replay
measure jitter under CPU, network, and sensor load
fit offset/skew model if clocks free-run
propagate timing uncertainty into sensor residual covariance
monitor offset and message age online
```

---

## Implementation notes

- Record both acquisition timestamp and receive timestamp when possible.
- Include clock domain metadata: sensor clock, PHC, system monotonic, UTC, GPS,
  TAI, ROS time, or simulation time.
- Prefer hardware trigger or hardware timestamping for high-rate, high-speed
  fusion paths.
- For cameras, define whether the timestamp is exposure start, midpoint, or
  end. Mid-exposure is often the right geometric reference for global shutter.
- For rolling shutter cameras and spinning LiDAR, a single frame timestamp is
  insufficient; per-row, per-point, or per-packet timing may be required.
- For radar, timestamp the coherent processing interval consistently. Doppler
  estimates span a frame, not an instantaneous sample.
- Monitor queue age separately from sensor age. A fresh callback can contain an
  old measurement.
- Treat NTP, PTP software timestamping, PTP hardware timestamping, PPS, and
  hardware trigger as different accuracy classes.

---

## Failure modes and diagnostics

| Failure mode | Symptom | Diagnostic |
|---|---|---|
| Arrival-time stamping | Residuals grow with CPU or network load. | Compare acquisition stamp to receive stamp. |
| Clock drift | Fusion slowly degrades between sync events. | Offset versus time has nonzero slope. |
| Wrong PTP domain | Devices appear synchronized but disagree. | Inspect domain number, grandmaster ID, and PHC offsets. |
| Software timestamp jitter | Good average offset but noisy residuals. | Timestamp variance increases under load. |
| Camera midpoint error | Projection offset during fast motion. | Residual changes with exposure time and velocity. |
| LiDAR deskew error | Curved walls or doubled edges. | Residual varies over scan azimuth/time. |
| Radar frame-time ambiguity | Doppler compensation biased. | Velocity residual changes with frame duration or chirp timing. |
| Hidden buffering | Latency spikes without sensor faults. | Queue depth and message age metrics. |

---

## Sources

- IEEE SA, IEEE 1588-2019 standard page: https://standards.ieee.org/standard/1588-2019.html
- NIST IEEE 1588 tutorial: https://www.nist.gov/system/files/documents/el/isd/ieee/tutorial-basic.pdf
- Linux PTP `ptp4l` documentation: https://www.linuxptp.org/documentation/ptp4l/
- Linux PTP `phc2sys` documentation: https://www.linuxptp.org/documentation/phc2sys/
- Linux kernel PTP hardware clock documentation: https://www.kernel.org/doc/html/v5.17/driver-api/ptp.html
- Linux kernel timestamping documentation: https://www.kernel.org/doc/html/v6.8/networking/timestamping.html
- ROS `std_msgs/Header` documentation: https://docs.ros.org/hydro/api/std_msgs/html/msg/Header.html
- OpenVINS calibration documentation: https://docs.openvins.com/gs-calibration.html
