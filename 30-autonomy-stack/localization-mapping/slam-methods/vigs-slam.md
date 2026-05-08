# VIGS-SLAM and VINGS-Mono

Related docs: [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md), [OpenVINS](openvins.md), [GS-SLAM and MonoGS](gs-slam-monogs.md), [S3PO-GS](s3po-gs.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).

## Executive Summary

VINGS-Mono and VIGS-SLAM are visual-inertial Gaussian SLAM systems from the 2025-2026 wave. They address a clear weakness of pure visual Gaussian SLAM: photometric tracking and Gaussian map optimization degrade under blur, low texture, exposure changes, and large-scale outdoor motion.

VINGS-Mono targets monocular large-scene Gaussian mapping with a VIO front end, 2D Gaussian map, novel-view-synthesis loop closure, and Dynamic Eraser. It reports kilometer-scale outdoor capability and a smartphone-style camera plus low-frequency IMU use case.

VIGS-SLAM tightens the visual-inertial formulation by jointly optimizing camera poses, depths, and IMU states in a unified framework, with robust IMU initialization, time-varying bias modeling, loop closure, and consistent Gaussian updates. For AVs, this lineage is more relevant than camera-only Gaussian SLAM, but it is still not a production-grade localization stack.

## Core Idea

The common idea is to let inertial sensing stabilize Gaussian visual SLAM.

Core elements:

- Monocular RGB supplies appearance and visual geometry.
- IMU supplies high-rate motion and gravity constraints.
- Gaussian maps provide dense, renderable scene representation.
- VIO front ends provide metric or scale-stabilized trajectories.
- Loop closure corrects trajectory and Gaussian map consistency.
- Dynamic-object handling tries to prevent transient objects from polluting maps.

VINGS-Mono emphasizes large-scale system design. VIGS-SLAM emphasizes tighter visual-inertial optimization and IMU-state modeling.

## Pipeline

VINGS-Mono:

1. Process RGB frames and low-rate IMU data in a VIO front end.
2. Use dense bundle adjustment and uncertainty estimation to recover geometry and pose.
3. Incrementally build a 2D Gaussian map.
4. Use a sample-based rasterizer, score manager, and pose refinement for efficient mapping.
5. Use NVS loop closure to detect and correct loops through Gaussian rendering.
6. Use Dynamic Eraser to reduce dynamic-object artifacts.

VIGS-SLAM:

1. Initialize visual-inertial state robustly.
2. Track camera poses with visual and inertial constraints.
3. Jointly refine camera poses, depths, and IMU states.
4. Model time-varying IMU biases.
5. Build and update a 3D Gaussian map.
6. Apply loop closure with consistent Gaussian map updates.
7. Render dense maps for reconstruction and evaluation.

## Strengths

- IMU improves robustness over purely visual Gaussian SLAM.
- Gravity and inertial propagation help with blur, low texture, and fast motion.
- VINGS-Mono addresses large outdoor scenes and reports up to tens of millions of Gaussian ellipsoids.
- NVS-based loop closure is a novel use of Gaussian rendering.
- Dynamic Eraser acknowledges real outdoor dynamic content.
- VIGS-SLAM models IMU initialization and time-varying bias explicitly.
- Both methods are closer to practical robotics than RGB-only indoor Gaussian SLAM.

## Limitations

- Monocular visual-inertial scale and bias observability still require good excitation and calibration.
- Camera appearance remains fragile under weather, night, glare, lens dirt, and low texture.
- Low-frequency phone IMUs are not equivalent to automotive-grade synchronized IMUs.
- Dynamic-object modules can miss stationary or slow-moving temporary objects.
- NVS loop closure can be confused by repeated gates, corridors, road segments, or stands.
- Gaussian map quality and pose quality must be evaluated separately.
- No native LiDAR, radar, wheel odometry, GNSS, or HD-map constraints in the core descriptions.
- Production covariance, integrity, and failover behavior remain open.

## AV Relevance

This lineage is relevant to AVs because visual-inertial Gaussian SLAM is the natural bridge between camera-only Gaussian maps and classical VIO.

Potential roles:

- Dense visual map construction with IMU-stabilized poses.
- Visual-inertial benchmark against OpenVINS, VINS-Fusion, ORB-SLAM3, DROID-SLAM, and MASt3R-SLAM.
- Offline reconstruction for depots, terminals, service roads, and structured urban scenes.
- Research into Gaussian-rendering loop closure and visual map QA.

Production use still needs multi-sensor fusion. A road or airside AV should combine VIO with wheel odometry, LiDAR/radar, GNSS/RTK when valid, map constraints, dynamic-object policies, and safety monitors.

## Indoor/Outdoor Notes

**Indoor:** Visual-inertial Gaussian SLAM is useful for corridors, warehouses, terminals, hangars, labs, and AR-like mapping, especially where IMU helps through texture-poor segments.

**Outdoor:** VINGS-Mono is explicitly aimed at large outdoor scenes. VIGS-SLAM targets challenging visual-inertial conditions. Outdoor success still depends on lighting, texture, calibration, and dynamic-object control.

**Airside:** Potentially useful for offline mapping and visual inspection around terminals and service roads. For open aprons, repeated stands, wet pavement, aircraft motion, and night floodlights make standalone visual-inertial Gaussian localization risky.

## Comparison

| Method | Sensors | Main distinction | AV interpretation |
|---|---|---|---|
| VINGS-Mono | Monocular RGB + optional/low-rate IMU | Large-scene 2D Gaussian map, NVS loop closure, Dynamic Eraser | Large-scale visual-inertial Gaussian mapping baseline |
| VIGS-SLAM | RGB + IMU | Tight VI optimization of poses, depths, IMU states, loop-consistent Gaussians | More estimator-centered VI Gaussian SLAM |
| S3PO-GS | Monocular RGB | Scale-consistent pointmap Gaussian outdoor SLAM | Foundation geometry without IMU |
| ORB-SLAM3/OpenVINS | Camera + IMU | Mature sparse VIO/SLAM | Strong classical baselines |
| Gaussian-LIC2 | LiDAR + IMU + camera | Metric LIC Gaussian map | More AV-practical sensor mix |

## Evaluation

Key metrics:

- ATE/RPE with explicit alignment.
- Scale drift and yaw drift over long routes.
- IMU bias stability and initialization success.
- Loop-closure precision, recall, and correction magnitude.
- Rendering metrics: PSNR, SSIM, LPIPS.
- Map size, primitive count, runtime, and GPU memory.
- Dynamic-object ghost rate.
- Failure count under blur, exposure change, low texture, and aggressive motion.

For AV/airside use, add drift per kilometer, lateral/yaw error at operational waypoints, repeated-route consistency, false loop closures in repeated infrastructure, and performance under night/rain/glare.

## Implementation Notes

- Use hardware-synchronized camera and IMU logs for serious evaluation.
- Calibrate camera intrinsics, camera-IMU extrinsics, and temporal offset.
- Record IMU rate and grade; do not generalize phone-IMU results to vehicle IMUs or the reverse.
- Keep VIO health outputs separate from rendering metrics.
- Validate NVS loop closures against independent pose truth before applying them to maps.
- Maintain a dynamic-object map policy for parked vehicles, aircraft, GSE, and temporary barriers.
- Pin CUDA, PyTorch, and rasterizer dependencies if using released research code.

## Practical Recommendation

Use VINGS-Mono and VIGS-SLAM to understand the visual-inertial Gaussian SLAM direction. For AV and airside systems, benchmark them offline against classical VIO and multi-sensor localization. Do not use them as standalone operational localization until metric integrity, loop-closure safety, dynamic handling, and adverse-condition behavior are independently validated.

## Sources

- Wu, Zhang, Tie, Ai, Gan, and Ding, "VINGS-Mono: Visual-Inertial Gaussian Splatting Monocular SLAM in Large Scenes." https://arxiv.org/abs/2501.08286
- Zhu, Zhang, Li, Haala, Pollefeys, and Barath, "VIGS-SLAM: Visual Inertial Gaussian Splatting SLAM." https://arxiv.org/abs/2512.02293
- VIGS-SLAM project page. https://vigs-slam.github.io/
- Local context: [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- Local context: [OpenVINS](openvins.md)
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
