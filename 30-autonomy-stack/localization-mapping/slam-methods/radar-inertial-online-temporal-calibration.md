# Radar-Inertial Online Temporal Calibration

Related docs: [radar-inertial odometry](radar-inertial-odometry.md), [4D imaging radar RIO and SLAM](4d-imaging-radar-rio-slam.md), [radar-LiDAR-inertial fusion](radar-lidar-inertial-fusion.md), [sensor calibration and time synchronization](../../../10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

**Last updated:** 2026-05-09

## Executive Summary

Radar-inertial odometry is unusually sensitive to time alignment because radar Doppler measures velocity at the radar measurement time while the IMU propagates a high-rate trajectory. A few tens of milliseconds of radar-IMU offset can turn into biased velocity and pose updates during turns, acceleration, braking, and vibration.

Two recent lines are useful: EKF-RIO-TC estimates the radar-IMU time offset online inside an EKF radar-inertial odometry framework, and RIO-T estimates a temporal offset state in a factor graph with IMU and radar ego-velocity factors. Both highlight the same production lesson: hardware triggering helps, but it does not prove that radar measurements and IMU states are temporally aligned.

## What It Adds

- Treats temporal offset as an estimated state, not a fixed assumption.
- Uses radar ego-velocity from a single scan as the measurement affected by time offset.
- Aligns radar and IMU updates to a common time stream.
- Demonstrates that online temporal calibration can reduce odometry error even without radar scan matching or target tracking.
- Provides public code for the EKF-RIO-TC variant.

## Sensor and Factor Model

Sensor suite:

- Doppler-capable radar or 4D radar.
- IMU.
- Optional ground truth for calibration validation.

EKF-style abstraction:

```text
x = [R, p, v, b_g, b_a, delta_t_RI]
z_radar_velocity(t_r) = h(x(t_r + delta_t_RI)) + noise
```

Factor-graph abstraction:

```text
X* = arg min_X
      sum || r_imu ||^2
    + sum || r_radar_velocity(delta_t_RI) ||^2
    + sum || r_constant_time_offset ||^2
```

RIO-T adjusts the radar ego-velocity factor using recent IMU acceleration after bias and gravity correction, assuming locally constant acceleration around the relevant interval.

## Observability and Motion Requirements

Temporal offset is easiest to observe when motion changes quickly:

- acceleration and braking,
- turns and yaw-rate changes,
- vibration or aggressive platform motion,
- radar velocity discrepancy that changes with offset.

Smooth constant-velocity motion can make the offset weakly observable. Calibration validation should therefore include intentional excitation rather than only straight, slow driving.

## Dynamic and Degraded Scenes

Temporal calibration does not solve radar outliers. It should be combined with:

- static-return selection for Doppler ego-velocity,
- dynamic-object rejection,
- multipath gating,
- radar health metrics,
- IMU saturation checks.

The benefit is strongest in adverse weather or GNSS-denied environments where radar-inertial odometry becomes a primary fallback and time misalignment cannot be hidden by stronger LiDAR/camera/map factors.

## Evaluation Guidance

Track:

- ATE/RPE with and without estimated time offset.
- Estimated offset convergence time.
- Sensitivity to injected artificial delays.
- Velocity RMSE during acceleration and turning.
- Radar ego-velocity residual before and after compensation.
- Robustness under hardware triggering, software timestamping, and replayed bags.

EKF-RIO-TC reports evaluation on simulated and real-world datasets, including a self-collected seven-sequence radar/IMU dataset with OptiTrack ground truth, plus ICINS2021 and ColoRadar. RIO-T reports real-world radar/IMU experiments focused on temporal delay impact.

## Integration Readiness

The EKF-RIO-TC implementation is public and directly useful for radar-IMU timing studies. For production stacks, temporal calibration should be one part of a larger synchronization strategy: PTP/PPS where possible, driver timestamp audits, bag replay tests, temperature and boot-cycle checks, and runtime alarms if estimated offsets move outside calibrated bounds.

## Limitations

- Online offset estimation needs excitation.
- A constant time offset model may be insufficient for variable driver latency or clock drift.
- Time calibration cannot compensate bad radar extrinsics.
- Radar ego-velocity still assumes enough static returns.
- Factor-graph or EKF tuning can overfit one radar model or motion profile.

## Sources

- EKF-RIO-TC arXiv paper: https://arxiv.org/abs/2502.00661
- EKF-RIO-TC repository: https://github.com/spearwin/EKF-RIO-TC
- RIO-T project page: https://rio-online-t.github.io/
- RIO-T paper PDF: https://lamor.fer.hr/images/50050805/Impact_of_Temporal_Delay_on_Radar_Inertial_Odometry.pdf
- Classic camera-IMU online temporal calibration context: https://journals.sagepub.com/doi/pdf/10.1177/0278364913515286
