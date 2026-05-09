# CM-LIUW-Odometry

Related docs: [FAST-LIO2](fast-lio-fast-lio2.md), [UWB / radio ranging SLAM](uwb-radio-ranging-slam.md), [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md), and [radar-LiDAR-inertial fusion](radar-lidar-inertial-fusion.md).

**Last updated:** 2026-05-09

## Executive Summary

CM-LIUW-Odometry is a LiDAR-IMU-UWB-wheel odometry system for extreme-degradation coal mine tunnels. Its key value is not a new LiDAR front end in isolation; it is a practical fusion policy for long, GPS-denied, feature-poor, slippery, uneven underground corridors where every single odometry source can fail.

The estimator is based on an iterated error-state Kalman filter. LiDAR-inertial odometry supplies local geometry, UWB provides absolute position anchors where infrastructure coverage exists, and wheel odometry is tightly fused with nonholonomic constraints and lever-arm compensation when UWB coverage is weak or absent. An adaptive motion-mode switch changes how the estimator trusts UWB, wheel, and LiDAR cues according to UWB range and environmental degradation.

## What It Adds

- Treats UWB as a global-coordinate constraint for a LiDAR-inertial system rather than a loose post-processing correction.
- Uses wheel odometry as a tight factor/update with nonholonomic constraints instead of a naive velocity prior.
- Compensates the vehicle lever arm, which matters when UWB antenna, wheel frame, IMU, and LiDAR are separated on a mine robot.
- Switches fusion mode based on coverage and degradation, which is closer to an operational policy than a static benchmark configuration.
- Targets coal-mine tunnel degeneracy explicitly: long feature-poor corridors, no GNSS, wheel slip, uneven ground, and intermittent ranging.

## Sensor and State Model

Typical sensor suite:

- 3D LiDAR.
- IMU.
- UWB anchors and tag.
- Wheel odometer or encoder-derived wheel odometry.

The operational state should include:

```text
x = [R, p, v, b_g, b_a, T_LI, T_UI, T_WI, delta_t_*]
```

where `T_LI`, `T_UI`, and `T_WI` are LiDAR-IMU, UWB-IMU, and wheel/vehicle-IMU extrinsics. The published method emphasizes UWB alignment, wheel tight coupling, nonholonomic constraints, and lever-arm compensation. A production implementation should also explicitly track time offsets or verify that all sensor timestamps are synchronized.

## Fusion Behavior

The useful pattern is a staged reliability model:

| Condition | Dominant constraints | Operational concern |
|---|---|---|
| UWB in range, LiDAR usable | LIO plus UWB absolute position | UWB NLOS and anchor geometry can bias the global frame |
| UWB weak, LiDAR usable | LIO plus wheel/NHC | Wheel slip and corridor yaw degeneracy remain |
| LiDAR degraded, UWB in range | UWB plus IMU and wheel | Absolute position may help but attitude/yaw can still drift |
| LiDAR and UWB degraded | IMU plus wheel/NHC dead reckoning | Only short bridging should be allowed |

This maps well to other GPS-denied industrial domains: tunnels, mines, warehouses, underpasses, terminal corridors, and covered service roads.

## Timing and Calibration

CM-LIUW-Odometry depends on calibration more than its acronym suggests:

- LiDAR-IMU extrinsic and temporal calibration control deskewing and scan matching.
- UWB antenna-to-IMU lever arm controls absolute-position residuals during turns.
- Wheel frame, wheel radius, baseline, encoder scale, and slip model control nonholonomic updates.
- UWB clocking, anchor survey quality, and NLOS detection control global consistency.

For deployment, treat calibration as a monitored state. A static YAML file is not enough if anchors move, wheels wear, suspension changes, or the robot payload alters the lever arm.

## Dynamic and Degenerate Scenes

The method is designed for geometric degeneracy but not for arbitrary dynamic clutter. Moving mine vehicles, personnel, reflective machinery, water, dust, and tunnel support structures can all corrupt one or more sensing modes. The most important production diagnostic is not only ATE; it is a per-mode health trace: UWB innovation, LiDAR residual eigenvalues, wheel slip indicator, and NHC residual.

## Evaluation Guidance

Use metrics that expose the failure modes:

- ATE/RPE in UWB-covered and UWB-denied segments.
- Drift per 100 m in straight feature-poor tunnels.
- Yaw drift during long corridor travel.
- UWB innovation under line-of-sight and NLOS.
- Wheel slip detection precision and false positives.
- Recovery time after re-entering UWB coverage.
- Map consistency across repeated mine routes.

Coal mine results are valuable, but airside, warehouse, and tunnel transfer still needs local validation because UWB infrastructure, ground material, and motion profiles differ.

## Integration Readiness

The reference code is public and the architecture is close to real robot integration because it uses common sensors and an IESKF-style estimator. The main blockers are operational rather than academic: UWB anchor deployment and survey, NLOS handling, wheel slip calibration, time synchronization, and safety policy when all absolute constraints disappear.

## Limitations

- UWB infrastructure is required for the global-coordinate benefit.
- UWB NLOS can create confident but wrong absolute corrections.
- Wheel constraints are fragile on wet, uneven, loose, or slippery ground.
- Long tunnels remain weakly observable in yaw without anchors, turns, or distinctive structure.
- The method is domain-specific; coal mine assumptions do not automatically transfer to open roads or airport aprons.
- Public benchmarking appears less mature than the code release, so independent reproduction should be expected.

## Sources

- CM-LIUW-Odometry arXiv paper: https://arxiv.org/abs/2511.01379
- CM-LIUW-Odometry repository: https://github.com/KJ-Falloutlast/CM-LIUW-Odometry
- FAST-LIO2 baseline context: https://arxiv.org/abs/2107.06829
