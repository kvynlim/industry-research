# Omni-LIVO and Multi-LVI-SAM

Related docs: [LVI-SAM](lvi-sam.md), [FAST-LIVO and FAST-LIVO2](fast-livo-fast-livo2.md), [R2LIVE and R3LIVE](r2live-r3live.md), [LIR-LIVO](lir-livo.md), [multi-sensor robust state estimation](../overview/robust-state-estimation-multi-sensor.md), and [multi-LiDAR calibration](../../../20-av-platform/sensors/multi-lidar-calibration.md).

**Last updated:** 2026-05-09

## Executive Summary

Omni-LIVO and Multi-LVI-SAM are 2025 multi-camera LiDAR-visual-inertial odometry systems. They address a practical weakness in many LIVO systems: a wide-FOV LiDAR observes much more of the scene than a single conventional camera, so visual constraints cover only part of the LiDAR geometry. Multi-camera rigs reduce that mismatch.

Omni-LIVO is a tightly coupled multi-camera LIVO system. It introduces cross-view direct alignment for photometric consistency across non-overlapping views and extends an Error-State Iterated Kalman Filter with multi-view updates and adaptive covariance.

Multi-LVI-SAM extends the LVI-SAM/factor-graph style toward multiple fisheye cameras. It uses a panoramic visual feature model to unify multi-camera observations, adds extrinsic compensation for triangulation consistency, and integrates the panoramic model into a tightly coupled LiDAR-visual-inertial factor graph.

For airside autonomy, multi-camera LIVO is relevant because airport vehicles often need 360-degree perception around tugs, trailers, aircraft, and GSE. It is still a research direction unless calibration, synchronization, dynamic-object rejection, and health monitoring are engineered carefully.

## What They Add

| Method | Estimator style | Core visual idea | Practical value |
|---|---|---|---|
| Omni-LIVO | ESIKF fusion | Cross-view direct photometric alignment and adaptive covariance | Uses multiple cameras to exploit more LiDAR depth |
| Multi-LVI-SAM | Factor graph | Panoramic visual feature model for fisheye cameras | Unified multi-camera constraints and loop/global optimization |

## Inputs and Outputs

Inputs:

- 3D LiDAR.
- IMU.
- Multiple cameras, including conventional or fisheye rigs depending on method.
- Camera intrinsics, distortion models, and camera-LiDAR-IMU extrinsics.
- Accurate timestamps and exposure metadata.

Outputs:

- LiDAR-visual-inertial trajectory.
- Local map or colored point cloud/map products.
- Multi-view visual feature constraints.
- Loop or globally optimized trajectory in the graph-based case.

## Core Technical Ideas

Omni-LIVO focuses on the field-of-view mismatch. A LiDAR may cover a broad 3D region while a single camera covers only a narrow slice. Omni-LIVO uses multiple cameras and cross-view direct alignment so photometric consistency can be maintained even across non-overlapping views. Its ESIKF update incorporates multi-view measurements and adaptive covariance weighting.

Multi-LVI-SAM focuses on unified multi-camera geometry. Instead of treating each fisheye camera as a separate visual front end, it builds a panoramic visual feature model. This representation consolidates multi-view constraints and supports loop closure and global pose optimization. The extrinsic compensation module addresses triangulation inconsistency between individual camera frames and the panoramic frame.

## Pipeline

1. Synchronize LiDAR, IMU, and all camera streams.
2. Propagate state with IMU.
3. Deskew LiDAR and associate visual information with LiDAR depth where applicable.
4. Track multi-view visual features or direct photometric residuals.
5. Fuse geometric LiDAR residuals and visual residuals in an ESIKF or factor graph.
6. Apply adaptive covariance or compensation for camera-specific geometry.
7. Update the local map and publish odometry.
8. In graph-based pipelines, add loop closures and global optimization constraints.

## Strengths

- Better spatial coverage than single-camera LIVO.
- More robust visual constraints around the vehicle.
- Useful for 360-degree vehicle rigs and complex close-range maneuvers.
- LiDAR gives metric depth and geometric anchoring.
- IMU provides high-rate propagation and attitude stability.
- Fisheye/panoramic modeling is well matched to robots that need near-full-surround awareness.

## Failure Modes

- Multi-camera calibration is harder than single-camera calibration.
- Small extrinsic or timing errors create inconsistent visual constraints.
- Fisheye distortion and rolling shutter can bias feature triangulation or direct alignment.
- Cameras remain sensitive to glare, night, rain, lens dirt, motion blur, and exposure shifts.
- Dynamic objects can produce strong visual features and LiDAR returns.
- Photometric methods can fail on low texture, reflections, or sudden lighting changes.
- Compute grows with camera count unless feature selection and scheduling are controlled.

## Airside, Indoor, and Outdoor Fit

**Indoor:** Strong in terminals, baggage halls, warehouses, and hangars where multi-camera coverage helps tight navigation and LiDAR provides geometry.

**Outdoor:** Useful for vehicle rigs with good calibration, but cameras need exposure control, cleaning, weather handling, and robust feature rejection.

**Airside:** Highly relevant for tug and GSE platforms with multiple blind spots. Useful around aircraft stands, docking, trailer alignment, and terminal-edge driving. The production baseline should still fuse RTK/GNSS, wheel odometry, LiDAR map localization, and health checks. Multi-camera LIVO should degrade gracefully when cameras are blinded by floodlights, rain, spray, or contamination.

## Implementation Notes

- Use hardware triggering or audited timestamping for all cameras, LiDAR, and IMU.
- Calibrate each camera to IMU and LiDAR, then validate cross-camera consistency on real vehicle logs.
- Track per-camera health: exposure, blur, feature count, residuals, occlusion, and contamination.
- Avoid letting one bad camera dominate the estimator; use adaptive covariance and camera-level gating.
- Validate camera overlap with LiDAR across near-field and far-field zones.
- Use dynamic masks for aircraft, GSE, personnel, reflections, and screens.
- Benchmark against LVI-SAM, FAST-LIVO2, R3LIVE, and a LiDAR-inertial-only baseline.

## Sources

- Cao et al., "Omni-LIVO: Robust RGB-Colored Multi-Camera Visual-Inertial-LiDAR Odometry via Photometric Migration and ESIKF Fusion." https://arxiv.org/abs/2509.15673
- Zhang, Huang, Zhao, Yuan, and Feng, "Multi-LVI-SAM: A Robust LiDAR-Visual-Inertial Odometry for Multiple Fisheye Cameras." https://arxiv.org/abs/2509.05740
- Shan et al., "LVI-SAM: Tightly-coupled Lidar-Visual-Inertial Odometry via Smoothing and Mapping." https://arxiv.org/abs/2104.10831
- Local context: [FAST-LIVO and FAST-LIVO2](fast-livo-fast-livo2.md)
- Local context: [LIR-LIVO](lir-livo.md)
