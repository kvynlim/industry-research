# CLIC and Coco-LIC

Related docs: [continuous-time registration](continuous-time-registration.md), [LVI-SAM](lvi-sam.md), [FAST-LIVO2](fast-livo-fast-livo2.md), [R2LIVE and R3LIVE](r2live-r3live.md), and [factor graphs and iSAM2](factor-graph-isam2-gtsam.md).

**Last updated:** 2026-05-09

## Executive Summary

CLIC and Coco-LIC are continuous-time LiDAR-inertial-camera SLAM/odometry systems from the APRIL-ZJU line of work. They are important because heterogeneous sensors arrive at different rates and timestamps: LiDAR points are collected over a scan, cameras expose frames at discrete times, and IMUs stream at high rate. Continuous-time trajectories let the estimator query the pose at each measurement time instead of forcing every sensor into a single discrete pose.

CLIC uses continuous-time fixed-lag smoothing with bounded temporal and keyframe windows, marginalization, and analytical Jacobians. Coco-LIC extends the idea with non-uniform B-splines, dynamically placing control points according to motion so the sliding window can stay short and real-time.

## What They Add

| System | Core idea | Practical value |
|---|---|---|
| CLIC | Continuous-time fixed-lag smoothing for LiDAR-inertial and LiDAR-inertial-camera SLAM | Natural handling of asynchronous multi-rate sensors and online time-offset calibration |
| Coco-LIC | Non-uniform B-spline continuous-time LIC odometry | Real-time accuracy with fewer control points where motion is simple and more where motion is complex |

Both systems use factor-graph optimization and support tightly coupled LIC data. CLIC emphasizes fixed-lag smoothing and marginalization. Coco-LIC emphasizes adaptive control-point placement, LiDAR-map-assisted visual depth, and short-window fusion.

## Sensor and Factor Model

Sensor suite:

- LiDAR, including Livox-style support in repositories.
- IMU.
- Camera.
- Coco-LIC also notes multimodal multiple-LiDAR support.

Continuous-time state:

```text
T(t) = spline(control_points, t)
r_lidar = D(T(t_i) p_i, map)
r_camera = reprojection(T(t_frame), landmark_or_lidar_depth)
r_imu = inertial_spline_residual(T(t), imu)
```

The key advantage is that `T(t_i)` can be evaluated at each LiDAR point time, camera exposure time, or IMU time.

## Timing and Calibration

CLIC naturally supports online time-offset calibration. Coco-LIC's design also targets asynchronous LIC data and uses non-uniform control points to keep continuous-time optimization efficient.

Required calibration:

- LiDAR-IMU extrinsics and time offset.
- Camera-IMU extrinsics and time offset.
- LiDAR-camera extrinsics.
- Camera intrinsics and distortion.
- LiDAR per-point timing.

Continuous-time modeling is not a substitute for calibration. It is a better mathematical surface on which to estimate or compensate calibration parameters.

## Degenerate and Dynamic Scenes

Coco-LIC's repository highlights performance in degenerated cases and support for multiple LiDARs. The continuous-time formulation helps with aggressive motion and motion distortion, but dynamic objects remain a data-association and map-contamination problem. Moving vehicles, people, aircraft, carts, and reflections need semantic or geometric rejection before they become persistent map constraints.

## Evaluation Guidance

Track:

- ATE/RPE on asynchronous high-motion sequences.
- Accuracy with and without online time-offset calibration.
- Runtime versus number of control points.
- Uniform versus non-uniform spline ablation.
- LiDAR-only, LiDAR-inertial, and full LIC modes.
- Performance under LiDAR degeneracy and camera degradation.

Common evaluation datasets include NTU-VIRAL, Newer College, R3LIVE, FAST-LIVO, and LVI-SAM datasets according to the repositories.

## Integration Readiness

Both repositories are public and ROS/catkin oriented. CLIC is GPL-3.0. Coco-LIC has practical example configurations and is easier to use as a current LIC baseline. Production integration requires ROS 2 porting, deterministic compute, license review, sensor-driver timestamp audits, and map lifecycle work.

## Limitations

- Continuous-time optimization is more complex to configure and debug than filter-based LIO.
- Bad timestamps, missing per-point timing, or wrong camera exposure modeling can still bias the result.
- Camera constraints remain sensitive to lighting, blur, and dynamic objects.
- The reference implementations are research code, not safety-certified localization stacks.
- Non-uniform control-point logic adds tuning and failure modes under unusual motion.

## Sources

- CLIC arXiv paper: https://arxiv.org/abs/2302.07456
- CLIC repository: https://github.com/APRIL-ZJU/clic
- Coco-LIC arXiv paper: https://arxiv.org/abs/2309.09808
- Coco-LIC repository: https://github.com/APRIL-ZJU/Coco-LIC
- Coco-LIC paper PDF: https://april.zju.edu.cn/core/papercite-data/pdf/lang2023lic.pdf
