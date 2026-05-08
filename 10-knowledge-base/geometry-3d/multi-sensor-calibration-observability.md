# Multi-Sensor Calibration Observability

Calibration is an estimation problem over geometry, time, and uncertainty. A
calibration value is only meaningful if the data made the parameter observable,
the residual model matched the sensor physics, and the resulting covariance is
usable by perception, SLAM, mapping, and validation.

This page focuses on observability: when a multi-sensor calibration is actually
identified by the data, and when an optimizer merely returns a plausible number.

---

## 1. Calibration Unknowns

Typical autonomy calibration states include:

| State | Examples | Main risk |
|---|---|---|
| Intrinsics | camera focal length, distortion, LiDAR beam angles, radar bias, IMU scale/misalignment | Factory or target calibration does not match deployed condition. |
| Extrinsics | `T_base_camera`, `T_base_lidar`, `T_base_radar`, `T_base_imu`, GNSS antenna lever arm | Mount movement, sign convention errors, unobservable motion. |
| Temporal offsets | camera-IMU, LiDAR-IMU, radar-vehicle, encoder-IMU | Motion residuals are incorrectly absorbed as spatial error. |
| Noise parameters | measurement covariance, bias random walk, wheel slip covariance | Fusion becomes overconfident or rejects good sensors. |
| Online drift states | small correction to nominal extrinsics or time offset | Online estimator chases scene degeneracy or dynamic objects. |

For production systems, the artifact should contain the estimate, covariance or
quality score, data provenance, transform direction, sensor serial numbers, and
validation status.

---

## 2. Hand-Eye Calibration: `AX = XB`

Hand-eye calibration estimates the fixed transform `X` between two moving
frames from paired relative motions:

```
A_i * X = X * B_i
```

where:

- `A_i` is motion measured in one frame chain.
- `B_i` is the corresponding motion measured in another frame chain.
- `X` is the fixed sensor-to-sensor or sensor-to-body transform.

Example for LiDAR-to-base or camera-to-IMU:

```
T_A_k0_k1 * T_A_B = T_A_B * T_B_k0_k1
```

The transform is observable only when the motion set excites the right degrees
of freedom. Repeated straight-line motion, pure yaw on flat ground, or static
data can leave translation, roll/pitch, scale, or temporal offset weakly
identified.

### 2.1 Motion Requirements

| Unknown | Helpful motion | Degenerate motion |
|---|---|---|
| Rotation between sensors | rotations about multiple non-parallel axes | one repeated yaw axis only |
| Translation lever arm | rotations plus translations | pure translation with no angular excitation |
| Camera intrinsics | target across image and depth range | target centered at one distance |
| Camera-IMU extrinsic | rotations and accelerations with visual texture | static or constant-velocity motion |
| LiDAR-IMU extrinsic | turns, acceleration, slopes, 3D structure | flat ground, straight constant speed |
| GNSS antenna lever arm | turns and heading changes with RTK quality | straight driving only |
| Temporal offset | time-varying angular/linear velocity | stationary, constant velocity, or periodic ambiguous motion |

The best calibration run is usually uncomfortable to drive: repeated speed
changes, left/right turns, figure-eights, pitch/roll excitation where safe, and
scene geometry visible across overlapping sensors.

---

## 3. SE(3) Covariance Propagation

Rigid transforms live on SE(3). Small pose errors live in the tangent space:

```
T_true = T_hat * Exp(xi)
xi = [dtheta_x, dtheta_y, dtheta_z, dx, dy, dz]^T
```

For composition:

```
T_A_C = T_A_B * T_B_C
```

first-order covariance propagation uses Jacobians or the SE(3) adjoint:

```
Sigma_A ~= J_B * Sigma_B * J_B^T + J_C * Sigma_C * J_C^T
```

For changing the frame of a tangent perturbation:

```
xi_A = Ad_T_A_B * xi_B
Sigma_A = Ad_T_A_B * Sigma_B * Ad_T_A_B^T
```

The practical rule: do not rotate points without rotating their uncertainty.
If a LiDAR detection covariance is computed in the LiDAR frame and fused in
`base_link` or `map`, the covariance must follow the transform.

### 3.1 Calibration Covariance in Fusion

Calibration uncertainty is often ignored, but it creates range-dependent
measurement error:

```
e_projection ~= e_translation + range * e_rotation
```

At 30 m, a 0.1 deg yaw error is about:

```
30 * sin(0.1 deg) ~= 5.2 cm
```

For a camera-LiDAR projection, that can be larger than the LiDAR range noise.
For airside aircraft clearance, a small yaw or lever-arm error can move a
detected contour enough to affect docking and stop-distance margins.

---

## 4. Target-Based vs Targetless Calibration

| Method | Strength | Weakness | Production use |
|---|---|---|---|
| Checkerboard/AprilTag/Charuco | High precision for cameras and camera-IMU; controlled geometry. | Requires setup, lighting, and target visibility; may not represent service vibration/temperature. | Factory, maintenance bay, post-repair validation. |
| LiDAR-camera target | Direct cross-modal edges/corners. | Target must be visible in both modalities and well localized. | Build calibration and audit runs. |
| Multi-LiDAR ICP overlap | Uses natural scene; can monitor in service. | Degenerate on flat ground or sparse overlap; dynamic objects corrupt residuals. | Online health monitoring, not automatic correction without strict gates. |
| Radar-LiDAR targetless | Can use object tracks and ego-motion. | Radar angular resolution and multipath make residuals noisy. | Field validation and long-horizon consistency checks. |
| GNSS/INS lever-arm maneuvers | Uses RTK, IMU, and vehicle turns. | Needs high-quality fixes and enough angular excitation. | Commissioning and periodic survey checks. |
| Continuous-time batch calibration | Handles asynchronous sensors and temporal offsets. | Requires careful trajectory basis, data quality, and initialization. | Dataset calibration, high-end multi-sensor rigs. |

Target-based calibration gives clean residuals. Targetless calibration gives
deployment relevance. Production systems usually need both: target-based
absolute checks and targetless online drift detection.

---

## 5. Temporal Offset as a Calibration State

When sensor `j` is offset by `dt_j`, its measurement model is:

```
z_j = h_j(x(t + dt_j), T_base_j, intrinsics_j) + noise
```

Linearizing:

```
h(x(t + dt)) ~= h(x(t)) + (dh/dx) * x_dot(t) * dt
```

This shows why temporal offset and spatial calibration can be correlated.
During motion, a time offset creates apparent translation and rotation errors.
If `dt` is not estimated or tightly controlled by hardware synchronization, the
optimizer may "fix" timing by bending the extrinsic transform.

Temporal offset is observable when the trajectory has changing velocity or
angular velocity. It is weakly observable or ambiguous when the rig is static,
moves at constant velocity, or repeats highly periodic motion.

---

## 6. Observability Tests Before Trusting a Calibration

Use these checks before accepting a calibration artifact:

| Check | What it catches |
|---|---|
| Motion coverage report | Straight-line-only data and single-axis rotations. |
| Residual split by motion regime | Time offset hidden in turns or accelerations. |
| Residual split by image region or LiDAR sector | Intrinsic distortion, thermal shift, lens focus change, blocked optics. |
| Holdout dataset validation | Overfit to calibration target or one route. |
| Hessian rank / condition number | Parameters not identifiable from the dataset. |
| Parameter covariance magnitude | Estimate exists but is too uncertain for fusion. |
| Transform direction projection test | `T_A_B` vs `T_B_A` mistakes. |
| Cross-sensor consistency over time | Mount drift, vibration, and temperature effects. |

An optimizer converging is not evidence of observability. A low residual can be
produced by correlated wrong parameters, a poor scene, or an over-flexible time
model.

---

## 7. Online Calibration Health Checks

Runtime health checks should detect drift without casually rewriting calibrated
transforms.

Useful monitors:

- LiDAR-camera edge reprojection residuals by speed and yaw rate
- multi-LiDAR overlap ICP residual with geometric degeneracy checks
- radar track position/velocity residual vs LiDAR tracks and ego-motion
- GNSS innovation after lever-arm compensation
- IMU gravity direction residual relative to vehicle frame
- wheel odometry yaw residual vs IMU gyro
- estimated temporal offset trend by sensor pair
- calibration artifact ID and transform-tree consistency

Automatic correction should be gated by:

- sufficient geometric excitation
- repeated agreement over time
- bounded correction magnitude
- covariance improvement on holdout residuals
- no concurrent sensor degradation alarm
- no dynamic-object dominance in residuals

For airside autonomy, online calibration should feed degraded-mode policy:
reduce speed, disable a fusion path, request maintenance, or stop. It should
not silently modify the geometry used for aircraft clearance without traceable
approval.

---

## 8. Effects on Perception, SLAM, Mapping, and Validation

| Function | Calibration observability effect |
|---|---|
| Perception | Poor extrinsics misproject LiDAR points into images, degrade BEV fusion, create duplicate objects, and bias radar velocity interpretation. |
| SLAM | Unobservable LiDAR-IMU or camera-IMU calibration appears as trajectory drift, scan mismatch, or inconsistent loop closures. |
| Mapping | Map features smear or duplicate across passes; camera labels and LiDAR geometry disagree; stand markings shift relative to surveyed control. |
| Validation | Test failures become hard to attribute because model, sensor, calibration, and time errors are confounded. |

Airside relevance is direct: docking near aircraft, stand-line following, FOD
detection, pedestrian clearance, and incident replay all rely on calibrated
sensor geometry that was actually observable in the calibration data.

---

## 9. Failure Modes

| Failure mode | Symptom | Mitigation |
|---|---|---|
| Single-axis motion | Translation or roll/pitch covariance remains large. | Require multi-axis calibration maneuvers. |
| Time offset ignored | Residuals grow with speed and yaw rate. | Estimate temporal offset or enforce hardware sync. |
| Target only centered | Intrinsics work near center and fail at edges. | Fill image with target at multiple depths and positions. |
| Flat-scene targetless ICP | Calibration appears stable but yaw/height are weak. | Check local geometry eigenvalues and scene diversity. |
| Dynamic objects in residuals | Online monitor reports false drift. | Use static-scene filters, temporal consistency, and robust loss. |
| Wrong covariance frame | Fusion overweights or underweights detections after transform. | Store covariance frame and apply adjoint propagation. |
| Silent mount movement | Perception still runs but objects shift consistently. | Online residual monitoring and maintenance triggers. |

---

## Sources

- Tsai and Lenz, "A New Technique for Fully Autonomous and Efficient 3D Robotics Hand/Eye Calibration": https://ieeexplore.ieee.org/document/34770
- Park and Martin, "Robot Sensor Calibration: Solving AX = XB on the Euclidean Group": https://ieeexplore.ieee.org/document/326576
- Furgale et al., "Unified Temporal and Spatial Calibration for Multi-Sensor Systems": https://furgalep.github.io/bib/furgale_iros13.pdf
- Furgale et al., "Continuous-Time Batch Estimation using Temporal Basis Functions": https://furgalep.github.io/bib/furgale_icra12.pdf
- Li and Mourikis, "Online temporal calibration for camera-IMU systems": https://journals.sagepub.com/doi/pdf/10.1177/0278364913515286
- Kalibr camera-IMU calibration toolbox: https://github.com/ethz-asl/kalibr
- ROS REP-103 standard units and coordinate conventions: https://www.ros.org/reps/rep-0103.html
- ROS REP-105 coordinate frames for mobile platforms: https://www.ros.org/reps/rep-0105.html
- Barfoot, "State Estimation for Robotics" companion resources: https://github.com/utiasSTARS/liegroups
