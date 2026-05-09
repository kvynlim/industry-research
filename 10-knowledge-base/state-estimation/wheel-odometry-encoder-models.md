# Wheel Odometry and Encoder Models

Wheel odometry is the lowest-latency motion source on many ground vehicles. It
does not depend on lighting, texture, map features, or GNSS visibility, but it
is also the easiest source to over-trust. Its errors are systematic under
miscalibration and non-systematic under slip, tire deformation, load transfer,
and surface changes.

This page covers encoder equations, differential and Ackermann kinematics,
calibration, covariance, and how wheel odometry affects perception, SLAM,
mapping, and validation.

---

## 1. Encoder Measurement Model

For an incremental rotary encoder:

```
delta_phi = 2 * pi * delta_ticks / ticks_per_revolution
delta_s   = r * delta_phi
v         = delta_s / dt
```

where:

- `delta_ticks` is the count change over the interval.
- `r` is effective rolling radius.
- `dt` is the timestamped integration interval.

For quadrature encoders, resolution is often quoted before or after edge
multiplication. Make the convention explicit:

```
ticks_per_wheel_rev = encoder_lines * quadrature_multiplier * gear_ratio
```

Quantization floor:

```
sigma_s_quant ~= (2 * pi * r / ticks_per_wheel_rev) / sqrt(12)
```

At low speed, quantization and timestamp jitter can dominate. At high speed,
slip and wheel-radius calibration often dominate.

---

## 2. Differential Drive Kinematics

For left and right wheel displacements `ds_L`, `ds_R` and track width `b`:

```
ds     = (ds_R + ds_L) / 2
dtheta = (ds_R - ds_L) / b
```

Midpoint integration:

```
x_k+1     = x_k + ds * cos(theta_k + dtheta / 2)
y_k+1     = y_k + ds * sin(theta_k + dtheta / 2)
theta_k+1 = theta_k + dtheta
```

Velocity form:

```
v     = r / 2 * (omega_R + omega_L)
omega = r / b * (omega_R - omega_L)
```

Differential odometry is highly sensitive to track width. A small error in `b`
accumulates as heading error on turns, which then becomes lateral position
error.

---

## 3. Ackermann and Bicycle Kinematics

For Ackermann steering with rear-wheel speed `v`, wheelbase `L`, and steering
angle `delta`:

```
beta   ~= 0                    # simple rear-axle bicycle model
yaw_rate = v * tan(delta) / L

x_dot     = v * cos(theta)
y_dot     = v * sin(theta)
theta_dot = yaw_rate
```

For integration over `dt`:

```
ds     = v * dt
dtheta = ds * tan(delta) / L
```

If steering angle is measured at the steering wheel rather than road wheel:

```
delta_road = steering_scale * (delta_sensor - steering_bias)
```

For high steering angles, inner and outer wheel geometry matters:

```
tan(delta_inner) = L / (R - W/2)
tan(delta_outer) = L / (R + W/2)
```

where `W` is track width. Production odometry should define which steering
angle the model consumes: virtual bicycle angle, inner wheel angle, outer wheel
angle, rack position, or steering-wheel angle.

---

## 4. Skid-Steer, Crab, and Articulated Vehicles

Airside and industrial vehicles often deviate from passenger-car bicycle
assumptions:

| Vehicle type | Odometry issue |
|---|---|
| Skid-steer loader | Turning requires lateral tire slip; geometric differential model is biased. |
| Tug with rear steering | Reference point may be rear axle, hitch, or vehicle center. |
| Four-wheel steering | Front and rear steering angles change instantaneous center of rotation. |
| Crab steering | Vehicle translates laterally with near-zero yaw. |
| Articulated tractor/trailer | Hitch angle and trailer axle geometry affect swept path and map alignment. |

Do not hide these modes behind one `nav_msgs/Odometry` topic without recording
the active kinematic mode and covariance change.

---

## 5. Error Sources

| Error | Type | Effect |
|---|---|---|
| Wheel radius error | Systematic | Forward distance scale bias. |
| Left/right radius mismatch | Systematic | Heading drift during straight driving. |
| Track width error | Systematic | Turn angle bias. |
| Steering scale or bias | Systematic | Curvature bias in Ackermann odometry. |
| Encoder quantization | Random/interval-dependent | Low-speed velocity noise. |
| Timestamp jitter | Random/systematic | Velocity and IMU alignment error. |
| Tire slip | Non-systematic | Sudden or sustained pose error. |
| Tire wear and pressure | Slowly varying | Effective radius changes over time. |
| Load transfer | Context-dependent | Radius and slip change under towing or braking. |
| Surface change | Context-dependent | Wet apron, painted lines, snow, ice, rubber dust. |

Wheel odometry is often precise but not accurate. It can provide excellent
short-term relative motion while still drifting globally.

---

## 6. Calibration Parameters

### 6.1 Differential Drive

Common calibration parameters:

```
r_L, r_R  # effective left/right radius
b         # effective track width
k_L, k_R  # tick-to-distance scale
```

A simple model:

```
ds_L = k_L * delta_ticks_L
ds_R = k_R * delta_ticks_R
dtheta = (ds_R - ds_L) / b
```

Straight-line runs estimate average scale and radius mismatch. Turn-in-place or
known-arc runs estimate track width. Calibration should be validated on a
separate path, not only the path used for fitting.

### 6.2 Ackermann

Common calibration parameters:

```
r_drive
L_effective
steering_scale
steering_bias
latency_encoder_to_imu
```

Fit steering scale and bias with circles or figure-eights against RTK/INS,
LiDAR SLAM, or motion-capture ground truth:

```
yaw_rate_meas ~= v * tan(steering_scale * (delta_sensor - bias)) / L
```

For airside tugs, calibration should be repeated under loaded and unloaded
conditions when towing load significantly changes tire compression or slip.

---

## 7. Covariance for Filters and Factor Graphs

Wheel odometry can be fused as:

- velocity measurement in an ESKF
- relative pose factor in a factor graph
- preintegrated wheel factor between keyframes
- nonholonomic constraint, such as low lateral velocity

For a differential drive interval:

```
u = [ds_L, ds_R]^T
g(u) = [ds, dtheta]^T

ds     = (ds_R + ds_L) / 2
dtheta = (ds_R - ds_L) / b

J = d g / d u =
    [ 1/2      1/2  ]
    [ -1/b     1/b ]

Sigma_[ds,dtheta] = J * Sigma_u * J^T + Sigma_model
```

Then propagate into pose using the motion-model Jacobian:

```
Sigma_pose_k+1 =
    F * Sigma_pose_k * F^T
  + G * Sigma_[ds,dtheta] * G^T
```

For factor graphs, a relative pose factor might use:

```
z_ij = odom_preintegrated_delta(i, j)
r_ij = Log(z_ij^-1 * (X_i^-1 * X_j))
```

The covariance should increase when:

- wheel speed differs strongly from IMU acceleration or GNSS velocity
- yaw rate differs from IMU gyro
- ABS/traction/slip indicators are active
- steering angle changes faster than the model supports
- surface classification indicates wet, icy, painted, or loose material
- encoder interval is long or timestamp quality is poor

Never use zero covariance to mean "unknown." In ROS messages, zero covariance
is often interpreted as overconfident by downstream filters unless the consumer
has special handling.

---

## 8. Slip Detection

Slip cannot be calibrated away. It must be detected and represented as higher
uncertainty or a rejected measurement.

Useful residuals:

```
r_yaw = gyro_z - v * tan(delta) / L
r_v   = gnss_speed_or_lidar_speed - wheel_speed
r_acc = imu_longitudinal_accel - d(wheel_speed)/dt
```

Slip indicators:

- large yaw residual during steering
- wheel speed changes without matching IMU acceleration
- LiDAR scan-to-map velocity disagrees with encoder speed
- GNSS Doppler speed disagrees with wheel speed
- high throttle/brake command on low-friction surface
- one wheel encoder diverges from paired wheel on the same axle

Airside-specific slip cases include wet painted markings, rubber deposits,
de-icing fluid, snow, standing water, and tug operations under heavy tow load.

---

## 9. Effects on Perception, SLAM, Mapping, and Validation

| Function | Wheel odometry effect |
|---|---|
| Perception | Provides ego-motion for radar Doppler compensation, LiDAR deskew, object tracking, and prediction during sensor gaps. Bad odometry creates false object velocity. |
| SLAM | Stabilizes short-term scan matching and visual-inertial estimation. Overconfident wheel factors can force the trajectory through slip errors. |
| Mapping | Determines local consistency between passes when GNSS is weak. Radius or steering calibration bias bends maps and shifts lane/stand features. |
| Validation | Enables repeatable latency, stopping-distance, and degraded-mode tests. Covariance and slip labels are needed to explain failures. |

For airside operations, wheel odometry bridges GNSS outages near terminals and
under aircraft, helps low-speed docking, and provides a cross-check against
LiDAR/RTK. Its covariance should expand aggressively on surfaces where slip is
likely.

---

## 10. Logging and Replay Requirements

Log:

- raw encoder counts and timestamps
- integrated wheel distances and active kinematic mode
- wheel radius, track width, steering scale, and calibration artifact ID
- steering sensor raw value and converted road-wheel angle
- IMU yaw rate and longitudinal acceleration used for slip checks
- covariance or quality score per interval
- traction, brake, ABS, or motor-controller diagnostic flags
- surface/weather context when available

Replay should be able to regenerate odometry from raw ticks. Logging only the
final fused odometry hides quantization, timestamp, and calibration failures.

---

## 11. Failure Modes

| Failure mode | Symptom | Mitigation |
|---|---|---|
| Wrong ticks-per-revolution | Constant distance scale error. | Bench test one wheel revolution and compare to config. |
| Radius changes with tire pressure/load | Odometry works unloaded and fails under tow. | Calibrate under representative loads; monitor GNSS/LiDAR residual. |
| Track width too small/large | Turns over-rotate or under-rotate. | Known-circle calibration and holdout path validation. |
| Steering bias | Vehicle curves when odometry predicts straight. | Estimate bias from straight runs and gyro residuals. |
| Timestamp jitter | Velocity spikes and poor IMU alignment. | Timestamp encoder edges or controller integration intervals. |
| Slip treated as measurement | Filter jumps or maps bend after braking/turning. | Inflate covariance or gate wheel factors during slip. |
| Zero covariance | Fusion becomes overconfident. | Publish realistic covariance and quality flags. |

---

## Sources

- Borenstein et al., "Mobile Robot Positioning: Sensors and Techniques": https://deepblue.lib.umich.edu/handle/2027.42/34938
- Borenstein et al., "Where Am I? Sensors and Methods for Mobile Robot Positioning": https://hdl.handle.net/2027.42/4856
- ROS 2 `diff_drive_controller` documentation: https://docs.ros.org/en/ros2_packages/rolling/api/diff_drive_controller/index.html
- ROS 2 `diff_drive_controller` user documentation: https://docs.ros.org/en/rolling/p/diff_drive_controller/doc/userdoc.html
- `robot_localization` preparing sensor data documentation: https://docs.ros.org/en/lunar/api/robot_localization/html/preparing_sensor_data.html
- ROS REP-105 coordinate frames: https://www.ros.org/reps/rep-0105.html
- Forster et al., "On-Manifold Preintegration for Real-Time Visual-Inertial Odometry": https://arxiv.org/abs/1512.02363
- GTSAM `ImuFactor` documentation: https://borglab.github.io/gtsam/imufactor/
