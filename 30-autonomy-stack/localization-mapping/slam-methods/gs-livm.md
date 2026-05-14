# GS-LIVM

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["slam", "mapping", "validation"]
  reason: "GS-LIVM is rated as a supporting SLAM method for autonomy-stack triage and follow-up reading."
method-priority:end -->

Related docs: [Gaussian-LIC and Gaussian-LIC2](gaussian-lic.md), [RMGS-SLAM](rmgs-slam.md), [GLIM](glim.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [Splat-LOAM](splat-loam.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).

## Executive Summary

GS-LIVM is an ICCV 2025 LiDAR-inertial-visual mapping method that uses Gaussian Splatting for real-time photo-realistic outdoor mapping. It is designed for large, unbounded outdoor scenes rather than bounded indoor RGB-D rooms.

The method combines LiDAR, IMU, and camera data with a voxel-based 3D Gaussian map. It uses Gaussian Process Regression to mitigate sparse and uneven LiDAR observations, and it follows a covariance-centered design where estimated covariance initializes Gaussian scale/rotation and updates GPR parameters.

For AV and airside work, GS-LIVM is a strong research reference for metric Gaussian map construction from vehicle-like sensors. It should still be viewed as a mapping and rendering framework, not a complete production localization stack.

## Core Idea

GS-LIVM turns a LiDAR-inertial-visual trajectory into a real-time renderable Gaussian map.

Core elements:

- LiDAR supplies metric sparse geometry.
- IMU stabilizes motion estimation and deskewing.
- Camera supplies appearance for photo-realistic rendering.
- Voxel-based 3D Gaussians make large outdoor maps more tractable.
- Gaussian Process Regression fills or smooths sparse/uneven LiDAR observations.
- Covariance estimates guide Gaussian shape and GPR updates.
- Custom CUDA kernels accelerate mapping.

The practical insight is that Gaussian scale and orientation should reflect sensor uncertainty and local geometry, not be arbitrary render-only parameters.

## Pipeline

1. Synchronize LiDAR, IMU, and camera data.
2. Estimate LiDAR-inertial-visual motion and per-point/map covariance.
3. Voxelize the map and initialize 3D Gaussians from metric observations.
4. Use covariance to initialize Gaussian scale and orientation.
5. Apply Gaussian Process Regression to compensate for sparse or uneven LiDAR sampling.
6. Render RGB views from the Gaussian map.
7. Optimize Gaussian attributes using photometric and geometric losses.
8. Use CUDA kernels for online large-scene performance.
9. Evaluate rendering quality, mapping efficiency, and runtime on outdoor datasets.

## Strengths

- Built for outdoor unbounded scenes, not just indoor RGB-D scans.
- Uses metric LiDAR and IMU rather than monocular RGB alone.
- Voxel-based Gaussians help control map organization at scale.
- Covariance-centered initialization is well aligned with robotics estimation.
- GPR addresses sparse and uneven LiDAR returns.
- Public GitHub repository is available.
- Good reference for integrating Gaussian rendering with LIV mapping.

## Limitations

- Mapping quality depends on accurate time synchronization and sensor extrinsics.
- GPR can smooth or infer geometry that should still be validated against real measurements.
- Camera appearance remains fragile under glare, night, weather, exposure jumps, and lens dirt.
- LiDAR still suffers in dense fog, rain, dust, smoke, spray, and reflective scenes.
- CUDA dependency and custom kernels complicate deployment.
- Photo-realistic maps do not by themselves provide AV-grade occupancy or localization integrity.
- Dynamic objects must be filtered before persistent map use.
- Public evidence is research-oriented; production safety diagnostics are not the focus.

## AV Relevance

GS-LIVM is relevant for:

- Building photo-realistic Gaussian map layers from LiDAR/IMU/camera logs.
- Visual QA of survey routes and map coverage.
- Simulation and novel-view synthesis from real mapped environments.
- Comparing Gaussian map quality with point clouds, meshes, surfels, and voxels.
- Research on uncertainty-shaped Gaussian primitives.

For production AV localization, GS-LIVM should be wrapped by a conventional state estimator and map-governance system. Its Gaussian map may become an auxiliary appearance/geometry layer, but it is not an authoritative HD map by default.

## Indoor/Outdoor Notes

**Indoor:** Applicable to large indoor spaces if LiDAR/camera calibration is good, but the paper emphasis is outdoor mapping. Glass, narrow corridors, and dynamic people/equipment need special handling.

**Outdoor:** Strong fit for campuses, urban roads, industrial yards, ports, mines, and airports where LiDAR geometry and camera appearance are both available.

**Airside:** Useful for offline mapping around terminals, service roads, gates, fences, light poles, signs, and hangar edges. Open aprons with sparse vertical structure and movable aircraft/GSE require extra constraints, object filtering, and survey control.

## Comparison

| Method | Sensors | Gaussian map idea | AV interpretation |
|---|---|---|---|
| GS-LIVM | LiDAR + IMU + camera | Voxel 3DGS, GPR, covariance-centered outdoor mapping | Strong LIV Gaussian mapping baseline |
| RMGS-SLAM | LiDAR + IMU + camera | Feed-forward plus voxel-PCA Gaussian initialization and Gaussian-GICP loop closure | Emerging large-scale LIV Gaussian SLAM baseline |
| Gaussian-LIC2 | LiDAR + IMU + camera | Continuous-time LIC with depth completion and LiDAR-supervised Gaussians | Closely related real-time LIC SLAM |
| Splat-LOAM | LiDAR | 2D Gaussian LiDAR map/rendering | LiDAR-only Gaussian odometry baseline |
| GLIM | Range + IMU | Direct scan-matching factors, not Gaussian rendering | Strong metric mapping baseline |
| FAST-LIO2 | LiDAR + IMU | ikd-tree LIO front end | Practical online odometry baseline |

## Evaluation

Key metrics:

- Rendering PSNR, SSIM, and LPIPS.
- Depth/rendered geometry error against LiDAR or survey reference.
- Mapping runtime and throughput.
- GPU memory and primitive count.
- Sensitivity to LiDAR sparsity and point distribution.
- Pose error inherited from the LIV estimator.
- Map consistency across route repeats.
- Effect of covariance initialization and GPR ablations.

For AV/airside use, add georeferenced residuals against control points, dynamic-object contamination, open-apron drift, day/night/weather splits, and downstream localization impact when the map is used by a separate localizer.

## Implementation Notes

- Start from the official repository and reproduce a published dataset before custom data.
- Pin CUDA, compiler, and third-party rasterizer dependencies.
- Calibrate LiDAR-camera extrinsics carefully; small angular errors create visible and geometric misalignment.
- Check timestamp latency between camera exposure, LiDAR scan, and IMU integration.
- Monitor covariance outputs for numerical stability before using them to shape Gaussians.
- Validate GPR-filled regions against held-out measurements.
- Keep dynamic-object removal and map release QA outside the core mapper.
- Do not infer safety availability from rendering FPS alone.

## Practical Recommendation

Evaluate GS-LIVM when the goal is outdoor, metric, photo-realistic Gaussian mapping with LiDAR/IMU/camera data. For production AV work, use it as a mapping and QA component around a conservative localization stack, not as the sole online state estimator.

## Sources

- Xie, Huang, Wu, and Ma, "GS-LIVM: Real-Time Photo-Realistic LiDAR-Inertial-Visual Mapping with Gaussian Splatting." https://arxiv.org/abs/2410.17084
- GS-LIVM ICCV 2025 open-access paper. https://openaccess.thecvf.com/content/ICCV2025/papers/Xie_GS-LIVM_Real-Time_Photo-Realistic_LiDAR-Inertial-Visual_Mapping_with_Gaussian_Splatting_ICCV_2025_paper.pdf
- Official GS-LIVM repository. https://github.com/xieyuser/GS-LIVM
- Local context: [Gaussian-LIC and Gaussian-LIC2](gaussian-lic.md)
- Local context: [Splat-LOAM](splat-loam.md)
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
