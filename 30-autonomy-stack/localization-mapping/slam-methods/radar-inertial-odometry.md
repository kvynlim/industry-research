# Radar-Inertial Odometry

Related docs: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md), [radar odometry and radar SLAM](radar-odometry-radar-slam.md), [factor graphs and iSAM2](factor-graph-isam2-gtsam.md), [EKF-SLAM](ekf-slam.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

## Executive Summary

Radar-Inertial Odometry (RIO) fuses radar measurements with IMU data to estimate ego-motion. The radar contributes weather-robust range, angle, and often Doppler radial velocity; the IMU contributes high-rate propagation and short-term attitude observability. RIO is one of the most important adverse-weather localization families because it can keep producing motion constraints when cameras are blind and LiDAR is degraded by fog, dust, smoke, rain, or spray.

RIO methods range from EKF systems using Doppler ego-velocity, to factor-graph estimators, to continuous-time Gaussian-process smoothers, to 4D imaging-radar inertial mapping systems such as iRIOM and Go-RIO. The central technical advantage is Doppler: radar measures radial velocity directly in a single frame, which gives a physical motion cue that cameras and LiDAR do not provide.

For AVs and airside autonomy, RIO is more deployable than radar-only SLAM but still not sufficient by itself for all safety-critical localization. Radar is sparse and multipath-prone, and IMUs drift without aiding. A production stack should fuse RIO with wheel odometry, LiDAR when available, map localization, and GNSS/RTK when valid.

## Historical Context

Visual-inertial and LiDAR-inertial odometry became mainstream before radar-inertial odometry because camera and LiDAR feature geometry was easier to exploit. Radar was historically lower resolution and used mainly for object tracking. As 77 GHz FMCW radar and 4D imaging radar matured, researchers began using radar point clouds and Doppler velocity for ego-motion.

Early radar-inertial systems often estimated ego-velocity from Doppler returns and fused it with an IMU through an EKF. Later systems moved to factor graphs and continuous-time trajectories, improving delayed measurement handling, temporal calibration, and multi-radar support. Recent work includes:

- **iRIOM:** 4D imaging radar inertial odometry and mapping with submaps, robust ego-velocity estimation, scan-to-submap matching, an iterated EKF, and loop closure.
- **STEAM-RIO:** continuous-time radar-inertial odometry using a Gaussian-process motion prior in the STEAM framework.
- **Go-RIO:** ground-optimized 4D radar-inertial odometry using continuous velocity integration and Gaussian processes.
- **ethz-asl/rio:** graph-based sparse radar-inertial odometry with barometer support and zero-velocity tracking for multicopter navigation.
- **RIO-T and temporal-calibration variants:** systems that explicitly estimate radar-IMU time offset.

The field is moving fast because 4D radar is becoming a production sensor class for harsh environments.

## Sensor Assumptions

RIO assumes at least:

- A radar providing detections, point clouds, or radar images.
- An IMU providing accelerometer and gyroscope data.
- Known or estimated radar-IMU extrinsics.
- Sufficient timestamp quality, or an online temporal calibration state.

Radar measurements may include:

- Range.
- Azimuth.
- Elevation for 4D radar.
- Doppler radial velocity.
- Radar cross section or intensity.

Important assumptions:

- A useful fraction of radar detections comes from static scene points.
- Dynamic objects can be rejected or robustly downweighted.
- Radar Doppler ambiguity and aliasing are handled by the sensor configuration or estimator.
- IMU biases evolve slowly enough for the chosen model.
- The radar mounting location and lever arm are accurately modeled.
- Ground vehicles obey motion constraints that can be exploited when appropriate.

Airside vehicles benefit from low-speed nonholonomic constraints and wheel odometry, but radar still needs static reflectors to constrain position and yaw over time.

## State/Map Representation

RIO states commonly include:

```text
x = [R, p, v, b_g, b_a, g, T_radar_imu, delta_t]
```

where:

- `R, p, v` are platform orientation, position, and velocity.
- `b_g, b_a` are gyroscope and accelerometer biases.
- `g` is gravity.
- `T_radar_imu` is radar-to-IMU extrinsic calibration when estimated.
- `delta_t` is radar-IMU time offset when estimated.

Depending on the method, the estimator may be:

- An error-state EKF.
- An iterated EKF.
- A fixed-lag factor graph.
- A continuous-time Gaussian-process trajectory.
- A submap-based SLAM system with loop closure.

The map can be minimal or explicit. Doppler-only RIO may not build a map. iRIOM-style systems maintain radar submaps. Factor-graph systems may retain keyframes, scan-matching factors, loop closures, and calibration states.

## Algorithm Pipeline

1. **Time synchronization and calibration**
   - Transform radar detections into the IMU/body frame.
   - Apply known or estimated time offsets.

2. **Radar preprocessing**
   - Filter detections by range, RCS, velocity consistency, elevation, and quality.
   - Reject likely dynamic objects, multipath, and ego-vehicle reflections.

3. **Doppler ego-velocity estimation**
   - Use radial velocity constraints from static points.
   - Solve robustly using RANSAC, graduated non-convexity, M-estimation, or factor-graph residuals.

4. **IMU propagation**
   - Propagate pose, velocity, biases, and covariance at IMU rate.
   - Deskew or time-align radar measurements when possible.

5. **Radar scan matching or submap matching**
   - Register radar detections to previous scans or submaps if spatial radar data is used.
   - Add scan-to-submap factors or EKF measurement updates.

6. **Fusion**
   - Combine Doppler velocity, spatial radar constraints, IMU preintegration, gravity constraints, barometer/wheel constraints, and loop closures as available.

7. **Output and health monitoring**
   - Publish pose, velocity, covariance, radar inlier count, Doppler residuals, and estimator consistency diagnostics.

## Formulation

For a static radar return, the measured Doppler radial velocity constrains body velocity and angular velocity:

```text
z_i = u_i^T * ( v_body + omega_body x r_i ) + noise
```

where `u_i` is the unit vector from radar to target, `v_body` is ego velocity in the radar/body frame, `omega_body` is angular velocity, and `r_i` is the target or lever-arm vector. Robust ego-velocity estimation solves:

```text
v* = arg min_v sum_i rho( (z_i - u_i^T v)^2 )
```

with extensions for angular velocity, lever arm, and dynamic-object rejection.

IMU propagation follows the usual inertial model:

```text
R_dot = R * skew(omega_m - b_g)
p_dot = v
v_dot = R * (a_m - b_a) + g
```

Factor-graph RIO combines residuals:

```text
X* = arg min_X
      sum_imu      || r_imu(X_i, X_j) ||^2
    + sum_doppler  rho(|| r_doppler(X_k, z_i) ||^2)
    + sum_scan     rho(|| r_radar_scan(X_k, M) ||^2)
    + sum_prior    || r_prior(X_k) ||^2
```

Observability depends on radar geometry. Doppler constrains velocity along measured radial directions; position and yaw require either integrated motion over time, scan matching, external constraints, or map features.

## Failure Modes

- **Dynamic-object contamination:** Moving vehicles, aircraft, tugs, carts, and people violate the static-scene Doppler assumption.
- **Multipath:** Metal surfaces and wet ground can create false range/velocity measurements.
- **Poor radial geometry:** If all useful returns are in similar directions, some velocity components are weakly observable.
- **Yaw drift:** Doppler strongly aids velocity but may not fully constrain yaw without spatial matching or other sensors.
- **Sparse detections:** Open aprons, fields, and smooth tunnels can provide too few stable radar returns.
- **Doppler ambiguity:** Aliasing or incorrect velocity unwrapping can create large outliers.
- **Time-offset error:** Radar-IMU temporal misalignment directly corrupts velocity fusion.
- **Extrinsic error:** Radar lever-arm and rotation errors bias Doppler residuals.
- **IMU vibration/saturation:** Ground-support equipment and aircraft ramp vibration can degrade IMU propagation.
- **False confidence:** Robust costs can hide systematic radar failures unless health metrics are explicit.

## AV Relevance

RIO is highly relevant for AVs because it provides a physically different motion cue. It is especially valuable when:

- Cameras are blinded by darkness, glare, rain, or fog.
- LiDAR is degraded by fog, dust, snow, or spray.
- GNSS is multipath-corrupted near buildings or aircraft.
- Wheel odometry slips on wet, icy, or painted surfaces.

However, RIO alone is not a complete localization stack. It should be fused with:

- Wheel odometry and vehicle kinematic constraints.
- LiDAR odometry when LiDAR is healthy.
- HD map localization.
- GNSS/RTK after innovation gating.
- Radar maps or radar landmarks where available.

For AV safety, the key is not just better average ATE. The estimator must detect when radar observability is poor and inflate uncertainty before the vehicle becomes overconfident.

## Indoor/Outdoor Relevance

**Indoor:** RIO can work in smoke, dust, darkness, and textureless areas, but multipath is severe. It is promising for tunnels, mines, warehouses, and hangars with careful filtering.

**Outdoor:** Strong fit for roads, campuses, ports, mines, farms, and airports. Outdoor radar has longer sight lines and less enclosed multipath, but dynamic traffic and sparse open spaces remain hard.

**Mixed indoor/outdoor:** RIO is valuable for transitions where cameras adapt slowly and LiDAR may see abrupt density changes. Continuous-time methods can help when sensors have different rates and latencies.

## Airside Deployment Notes

RIO is one of the most relevant adverse-weather localization families for airside vehicles.

Deployment notes:

- Mount radar with clear field of view and known lever arm to the IMU.
- Calibrate radar-IMU time offset; re-check after firmware or network changes.
- Use Doppler residual health metrics to detect moving-object domination.
- Fuse wheel odometry and nonholonomic constraints for low-speed GSE.
- Use terminal edges, poles, signs, fences, and service-road infrastructure as radar-observable structure.
- Add artificial radar reflectors in open apron zones if allowed by airport operations.
- Treat aircraft as dynamic and multipath-producing.
- Validate in fog, rain, wet tarmac, night, and de-icing spray.

RIO should be a core fallback factor, not a standalone authority. When radar returns are sparse or inconsistent, the vehicle should slow, switch to a constrained mode, or request a safer localization source.

## Datasets/Metrics

Useful datasets:

- **Boreas:** radar, LiDAR, camera, IMU/GNSS data across seasons with high-quality poses.
- **Oxford Radar RobotCar:** long-term radar driving with route repeats and weather variation.
- **MulRan:** radar/LiDAR urban sequences for odometry and place recognition.
- **Coloradar:** 4D radar, LiDAR, cameras, IMU, and motion-capture/ground-truth resources.
- **iRIOM author data:** 4D imaging radar inertial sequences used in iRIOM evaluations.
- **Go-RIO datasets:** 4D radar-inertial experiments released with the Go-RIO work.

Metrics:

- ATE and RPE with fixed SE(3) alignment rules.
- Velocity RMSE, especially body-frame longitudinal/lateral/vertical components.
- Yaw drift and vertical drift.
- Doppler inlier ratio and residual distribution.
- IMU bias stability.
- Time-offset estimate stability.
- Runtime and deadline misses.
- Availability during adverse weather or LiDAR/camera degradation.
- Estimator consistency with NEES/NIS where ground truth is available.

Airside tests should add apron-only drift, stand approach repeatability, low-speed stop-and-go drift, false confidence near moving aircraft, and holdover time during GNSS denial.

## Open-Source Implementations

- **utiasASRL/steam_icp:** continuous-time LiDAR, radar, LiDAR-inertial, and radar-inertial odometry; includes STEAM-RO and STEAM-RIO variants for Boreas radar.
- **ethz-asl/rio:** graph-based sparse radar-inertial odometry with barometer support and zero-velocity tracking.
- **wooseongY/Go-RIO:** ICRA 2025 ground-optimized 4D radar-inertial odometry.
- **spearwin/ekf-rio-tc:** EKF-based radar-inertial odometry with online temporal calibration.
- **robotics-upo/4D-Radar-Odom:** ROS2 Humble package for 4D radar and IMU odometry.
- **iRIOM:** primary paper reference for 4D imaging radar inertial odometry and mapping; code availability should be verified for the intended sensor.

Before reuse, check radar model support, ROS version, license, timestamp handling, and whether the implementation estimates or assumes radar-IMU extrinsics.

## Practical Recommendation

For outdoor AVs and airside vehicles, evaluate RIO as a required adverse-weather component. Start with a proven implementation such as STEAM-RIO, Go-RIO, or a ROS2 4D radar odometry package, then fuse its output or factors into the main localization backend.

Do not publish a safety pose from RIO alone unless the route has been specifically validated for radar observability and the estimator has conservative health monitoring. The most practical architecture is radar-inertial odometry plus wheel constraints and map/LiDAR/GNSS factors.

## Sources

- Zhuang, Y., Wang, B., Huai, J., and Li, M. "4D iRIOM: 4D Imaging Radar Inertial Odometry and Mapping." RA-L / arXiv, 2023. https://arxiv.org/abs/2303.13962
- Burnett, K., Schoellig, A. P., and Barfoot, T. D. "Continuous-Time Radar-Inertial and Lidar-Inertial Odometry using a Gaussian Process Motion Prior." arXiv, 2024. https://arxiv.org/abs/2402.06174
- STEAM-ICP repository. https://github.com/utiasASRL/steam_icp
- ethz-asl/rio repository. https://github.com/ethz-asl/rio
- Go-RIO repository. https://github.com/wooseongY/Go-RIO
- EKF-RIO-TC repository. https://github.com/spearwin/ekf-rio-tc
- 4D-Radar-Odom repository. https://github.com/robotics-upo/4D-Radar-Odom
- Local context: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md)

