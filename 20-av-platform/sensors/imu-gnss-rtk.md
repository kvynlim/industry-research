# IMU, GNSS, and RTK Hardware for Autonomous Vehicle Platforms

IMU/GNSS/RTK hardware provides the global and inertial backbone for localization.
The receiver, antenna, correction link, IMU class, timing wiring, and lever-arm
calibration are one system. A centimeter-grade RTK receiver installed with poor
antenna placement or weak timing can produce localization that looks precise but
is wrong for perception, SLAM, mapping, and validation.

This page covers platform hardware choices and integration risks for AV and
airside deployments.

---

## 1. Hardware Classes

### 1.1 GNSS Receiver Classes

| Class | Typical capability | Use |
|---|---|---|
| Consumer single-frequency GNSS | Meter-level position, limited raw observables. | Non-safety telemetry, rough geofence. |
| Multi-band RTK module | Centimeter-level RTK in good conditions, raw measurements, PPS/timepulse. | Cost-effective robotics and industrial AVs. |
| Survey/automotive GNSS receiver | Robust tracking, multi-constellation, quality flags, event inputs, better RF front end. | Production localization and mapping. |
| Integrated GNSS/INS | Tight coupling with IMU, lever-arm support, wheel sensor input, outage bridging. | High-integrity AV and airside operations. |
| Dual-antenna GNSS/INS | GNSS heading at low speed or stationary. | Tugs, low-speed airside vehicles, mapping vehicles. |

RTK accuracy is conditional. It depends on sky view, multipath, baseline length,
correction quality, antenna phase center, receiver configuration, and integrity
monitoring.

### 1.2 IMU Classes

| IMU class | Bias stability / behavior | Typical role |
|---|---|---|
| Consumer MEMS | Low cost, high drift. | Stabilization, short dead reckoning only. |
| Industrial MEMS | Better bias/noise, rugged packaging. | Robotics ESKF/factor graph propagation. |
| Tactical MEMS / FOG | Lower drift, better vibration and temperature behavior. | GNSS outage bridging and high-grade mapping. |
| Navigation grade | Very low drift, high cost. | Survey, aviation, long outage bridging. |

The IMU should be selected from the outage requirement. If the vehicle must hold
lane/stand-level localization for 30 seconds without GNSS, a consumer IMU is
not equivalent to an industrial or tactical unit even if both publish at 200 Hz.

---

## 2. Timing and Wiring

Preferred timing architecture:

```
GNSS receiver
  -> PPS / TIMEPULSE
  -> PTP grandmaster or time appliance
  -> Ethernet sensors and compute
  -> IMU event input or shared sync line where supported
```

Important signals:

| Signal | Purpose | Integration risk |
|---|---|---|
| PPS / TIMEPULSE | Precise one-second phase reference. | Missing association to GNSS time-of-week or UTC. |
| Event input | Timestamp camera trigger, LiDAR sync, or wheel pulse at receiver time. | Electrical edge polarity and debounce errors. |
| PTP/gPTP | Synchronize Ethernet sensors and compute clocks. | Hardware timestamping not enabled end-to-end. |
| Serial/NMEA/UBX/SBF logs | Receiver solution and diagnostics. | Serial arrival time confused with solution epoch. |
| CAN/Ethernet IMU messages | Inertial data path. | Bus jitter if messages lack hardware timestamps. |

The receiver solution timestamp should be the GNSS measurement epoch. The host
receive time is a latency diagnostic, not the localization timestamp.

---

## 3. Antenna Placement and Lever Arms

GNSS antennas measure at the antenna phase center, not at `base_link`.

Lever-arm correction:

```
p_base = p_ant - R_world_base * r_base_ant
```

where `r_base_ant` is the antenna position expressed in the vehicle body frame.

Design rules:

- Place antenna with clear sky view and minimal masking from aircraft, terminal
  structures, masts, and roof equipment.
- Use a ground plane or antenna design appropriate for multipath control.
- Document antenna phase-center convention and cable delays where relevant.
- Calibrate lever arm to the same `base_link` used by LiDAR, cameras, radar,
  and control.
- For dual antennas, calibrate baseline length and direction, and protect it
  mechanically from flex.

A 20 cm lever-arm sign error can be larger than RTK noise. During turns, an
uncorrected antenna offset appears as false lateral motion at the base frame.

---

## 4. RTK Corrections

RTK uses carrier-phase measurements and correction data from a base station or
network service. Common transports:

| Transport | Strength | Risk |
|---|---|---|
| Local radio | Independent of cellular network. | Range, licensing, and interference constraints. |
| NTRIP over cellular/private network | Scalable and common. | Correction latency, dropouts, credentials, caster availability. |
| Private base over IP | Site-controlled. | Requires surveyed base position and monitoring. |
| PPP/PPP-RTK service | Wide-area convenience. | Convergence, subscription, and service availability. |

Correction health signals:

- RTK fix/float/single state
- age of differential corrections
- baseline length to base or virtual reference station
- satellite count by constellation and band
- PDOP/HDOP/VDOP
- carrier-to-noise density `C/N0`
- cycle slip counts
- residuals and receiver integrity flags
- correction stream packet loss and latency

For airside use, a private base station or managed correction service should be
monitored like safety infrastructure. A wrong base coordinate can create a
precise, repeatable, and dangerous map offset.

---

## 5. Outage and Degradation Modes

| Mode | Cause | Localization effect | Mitigation |
|---|---|---|---|
| RTK float | Ambiguities unresolved, poor corrections, multipath. | 10 cm to meter-level uncertainty. | Inflate covariance, rely more on LiDAR/IMU/wheel. |
| RTK loss / single | No corrections or poor sky view. | Meter-level GNSS. | Degraded mode and map-based localization. |
| Multipath | Aircraft, terminals, metallic apron surfaces. | Biased position with plausible quality. | Antenna placement, elevation mask, receiver multipath mitigation, cross-checks. |
| Urban/terminal canyon | Satellite blockage. | Fewer satellites and poor geometry. | Multi-constellation, dual antenna, LiDAR fallback. |
| IMU saturation | Shock, vibration, high angular rate. | Propagation corrupts estimate. | Select sensor range, vibration isolation, saturation flags. |
| IMU thermal drift | Temperature changes. | Bias drift and covariance mismatch. | Temperature calibration and online bias estimation. |
| PPS/PTP loss | GNSS outage or time appliance fault. | Timestamp uncertainty grows. | Holdover monitoring and degraded policy. |
| Correction latency | Network delay or caster issue. | Position lag or fix degradation. | Monitor correction age and reject stale corrections. |

Outage handling belongs in the estimator and the safety case. Do not simply
drop GNSS on loss of RTK; downweight it according to quality and consistency.

---

## 6. Spoofing, Jamming, and Integrity Signals

GNSS is a weak RF signal and can be jammed or spoofed. Health monitoring should
not rely only on the receiver's position covariance.

Useful indicators:

- sudden `C/N0` drop across many satellites
- receiver automatic gain control changes
- loss of one band or constellation
- impossible position, velocity, or clock jumps
- GNSS velocity inconsistent with wheel odometry, IMU, or LiDAR odometry
- dual-antenna heading inconsistent with IMU yaw rate
- correction stream anomalies
- receiver RAIM/integrity, spoofing, or jamming flags where available
- disagreement between independent receivers or antennas

Airports are high-consequence GNSS environments. Vehicle localization should
survive GNSS degradation through LiDAR map matching, IMU, wheel odometry, radar,
and operational speed limits.

---

## 7. Fusion Interfaces

### 7.1 ESKF

An ESKF commonly propagates with IMU:

```
omega_m = omega_true + b_g + n_g
a_m     = a_true + R^T * g + b_a + n_a
```

and corrects with GNSS position/velocity, wheel odometry, LiDAR localization,
or visual odometry. Bias states are essential:

```
b_g_dot = n_bg
b_a_dot = n_ba
```

### 7.2 Factor Graph

Factor graph pattern:

```
IMU preintegration factor:  X_i, V_i, B_i -> X_j, V_j
GNSS factor:               X_k -> p_gnss corrected by lever arm
wheel factor:              X_i -> X_j relative motion
LiDAR map factor:          X_k -> scan-to-map pose
```

GNSS factors should use measurement covariance based on fix type, correction
age, receiver diagnostics, lever-arm uncertainty, and consistency checks. A
fixed "RTK is 2 cm" covariance is unsafe in multipath or during correction
outages.

---

## 8. Effects on Perception, SLAM, Mapping, and Validation

| Function | IMU/GNSS/RTK effect |
|---|---|
| Perception | Provides ego-motion for LiDAR deskew, radar Doppler compensation, object tracking, and time-aligned fusion. Bad timing or lever arms create false object motion. |
| SLAM | IMU stabilizes high-rate propagation; GNSS anchors drift; RTK helps reject bad loop closures. Overconfident GNSS can pull SLAM into multipath errors. |
| Mapping | RTK/INS provides survey alignment, map tile georeferencing, and repeat-pass consistency. Wrong base coordinates or antenna lever arms shift the whole map. |
| Validation | Provides traceable time, position, velocity, and outage diagnostics. Safety cases need fix state, correction age, PTP/PPS state, and raw replay evidence. |

For airside mapping, the GNSS/INS system links vehicle maps to surveyed airport
geometry, stands, service roads, no-go zones, and aircraft clearance envelopes.
Its metadata is part of the map, not an optional log.

---

## 9. Platform Integration Checklist

Hardware:

- multi-band, multi-constellation receiver
- antenna with appropriate ground plane and cable
- PPS/timepulse output and event inputs
- PTP-capable compute/network path if Ethernet sensors need common time
- IMU range, noise, bias stability, vibration, and temperature ratings matched
  to outage and vehicle dynamics
- secure, monitored correction transport

Configuration:

- fixed `base_link` lever arms for antenna, IMU, and receiver frame
- receiver dynamic model appropriate for ground vehicle
- correction source, mountpoint, credentials, and max correction age
- output rates and message protocols
- covariance mapping by fix state
- spoofing/jamming and integrity diagnostics enabled

Validation:

- surveyed static antenna check
- known-route repeatability
- turn maneuvers for lever-arm sign validation
- GNSS outage replay
- correction dropout test
- RF interference monitoring
- comparison against LiDAR map localization and wheel/IMU odometry

---

## 10. Failure Modes

| Failure mode | Symptom | Mitigation |
|---|---|---|
| Antenna lever arm sign error | Position appears to swing around vehicle during turns. | Turn-test against IMU/LiDAR and projection sanity checks. |
| Wrong base station coordinate | RTK is stable but globally shifted. | Survey control, base monitoring, independent check points. |
| Serial arrival timestamp used | GNSS pose lags under host load. | Use receiver epoch timestamp and PPS/PTP. |
| RTK covariance fixed too low | Estimator jumps toward multipath fix. | Quality-dependent covariance and innovation gating. |
| IMU axes wrong | Gravity/yaw residuals inconsistent. | Axis convention test, static orientation check, REP-103/105 alignment. |
| Vibration-induced IMU noise | Bias and acceleration residuals grow on rough pavement. | Mounting, sensor class, vibration isolation, covariance tuning. |
| Spoofing/jamming ignored | Plausible but wrong position or sudden outage. | Monitor RF/receiver health and cross-check with non-GNSS sensors. |

---

## Sources

- u-blox ZED-F9P high precision GNSS module: https://www.u-blox.com/en/product/zed-f9p-module
- u-blox ZED-F9P integration manual: https://content.u-blox.com/sites/default/files/ZED-F9P_IntegrationManual_UBX-18010802.pdf
- Septentrio mosaic-X5 GNSS module: https://www.septentrio.com/en/products/gps/gnss-receiver-modules/mosaic-x5
- Hexagon NovAtel OEM7 receiver documentation: https://docs.novatel.com/OEM7/Content/Home.htm
- Hexagon NovAtel CPT7 GNSS+INS receiver: https://novatel.com/products/gnss-inertial-navigation-systems/combined-systems/cpt7
- NTRIP information from BKG: https://igs.bkg.bund.de/ntrip/
- NMEA 0183 standard information: https://www.nmea.org/nmea-0183.html
- GPS.gov GPS spectrum and interference issues: https://www.gps.gov/spectrum/
- GPS.gov information about GPS jamming: https://www.gps.gov/information-about-gps-jamming
- FAA GNSS Interference Resource Guide: https://www.faa.gov/about/office_org/headquarters_offices/avs/offices/afx/afs/afs400/afs410/GNSS
- CISA Positioning, Navigation, and Timing guidance: https://www.cisa.gov/topics/risk-management/positioning-navigation-and-timing
- Forster et al., "On-Manifold Preintegration for Real-Time Visual-Inertial Odometry": https://arxiv.org/abs/1512.02363
- GTSAM `PreintegratedImuMeasurements` documentation: https://borglab.github.io/gtsam/preintegratedimumeasurements/
