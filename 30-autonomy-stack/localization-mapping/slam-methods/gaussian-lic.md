# Gaussian-LIC and Gaussian-LIC2

Related docs: [GS-LIVM](gs-livm.md), [GLIM](glim.md), [LIO-SAM](lio-sam.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).

## Executive Summary

Gaussian-LIC is a LiDAR-inertial-camera Gaussian SLAM line that couples robust metric pose estimation with photo-realistic 3D Gaussian mapping. The original Gaussian-LIC paper presents real-time photo-realistic SLAM by fusing LiDAR, IMU, and camera data, initializing Gaussians from both LiDAR points and triangulated visual points, and handling sky/exposure effects for outdoor rendering.

Gaussian-LIC2 extends the line with a continuous-time trajectory optimization framework, real-time RGB and depth novel-view rendering, LiDAR-supervised Gaussian optimization, and lightweight zero-shot depth completion to fill LiDAR-blind areas. It also explores feeding Gaussian-map photometric constraints back into odometry under LiDAR degradation.

For AVs, this family is more relevant than camera-only Gaussian SLAM because LiDAR and IMU provide metric geometry and high-rate motion constraints. It is still a research mapping stack, not a production AV localizer by itself.

## Core Idea

Gaussian-LIC marries classical LiDAR-inertial-camera state estimation with differentiable Gaussian mapping.

Core elements:

- LiDAR supplies metric range and geometric supervision.
- IMU supplies high-rate propagation and attitude observability.
- Camera supplies appearance and photometric constraints.
- 3D Gaussians provide a renderable map for RGB/depth views.
- Visual triangulation and LiDAR points initialize Gaussian primitives.
- Gaussian-LIC2 adds continuous-time trajectory optimization and depth completion for sparse or LiDAR-blind regions.

The production-relevant idea is not "replace LIO with Gaussians." It is "use LIO/LIC-style metric estimation to support a renderable Gaussian map, then cautiously test whether the Gaussian map can feed back useful photometric factors."

## Pipeline

1. Synchronize LiDAR, IMU, and camera streams.
2. Estimate platform motion with LiDAR-inertial-camera fusion.
3. Compensate motion distortion and maintain calibrated sensor extrinsics.
4. Initialize Gaussians from LiDAR points and triangulated visual points.
5. Model outdoor effects such as sky and varying exposure.
6. Render RGB and depth from the Gaussian map.
7. Optimize Gaussian geometry, opacity, and appearance using camera and LiDAR supervision.
8. In Gaussian-LIC2, use zero-shot depth completion to densify LiDAR-sparse regions.
9. In Gaussian-LIC2, incorporate photometric constraints from the Gaussian map into continuous-time factor optimization where beneficial.

## Strengths

- Metric LiDAR and IMU constraints reduce monocular scale and motion fragility.
- Camera images provide photo-realistic appearance for rendering and inspection.
- LiDAR depth supervises geometry instead of relying only on visual priors.
- Gaussian-LIC is implemented in C++/CUDA for online performance.
- Gaussian-LIC2 addresses sparse LiDAR coverage and LiDAR-blind regions with dense depth completion.
- Continuous-time optimization is a natural fit for rolling multi-rate sensors.
- More relevant to outdoor robotics than indoor RGB-D Gaussian SLAM alone.

## Limitations

- Sensor synchronization and extrinsic calibration are critical.
- Camera photometric factors remain vulnerable to exposure shifts, glare, rain, fog, night, and lens contamination.
- LiDAR degrades in fog, heavy rain, dust, smoke, spray, and reflective environments.
- Learned depth completion can hallucinate plausible but wrong geometry.
- Gaussian visual quality can hide geometric defects unless depth and trajectory QA are explicit.
- CUDA/C++ performance paths increase integration complexity.
- Public evidence remains research-benchmark oriented, not safety-case oriented.
- No complete production map lifecycle, covariance calibration, or fault-management framework is provided by the papers.

## AV Relevance

Gaussian-LIC is AV-relevant as a multi-sensor Gaussian mapping architecture:

- Build photo-realistic Gaussian layers from metric LiDAR/IMU/camera logs.
- Inspect map quality and coverage visually.
- Render RGB/depth views for simulation and regression.
- Study whether Gaussian photometric constraints help during LiDAR degeneracy.
- Compare Gaussian maps against point-cloud, surfel, voxel, and mesh maps.

For production localization, the trusted pose should still come from a conservative multi-sensor state estimator with health checks. Gaussian map factors can be evaluated as auxiliary constraints after they prove robustness and uncertainty behavior.

## Indoor/Outdoor Notes

**Indoor:** Useful in large indoor spaces, tunnels, warehouses, hangars, and terminals where LiDAR geometry and camera appearance both help. Multipath is not the main issue, but glass, reflectance, and low texture remain concerns.

**Outdoor:** Stronger fit than RGB-only Gaussian SLAM because LiDAR provides metric structure. Urban roads, campuses, industrial yards, ports, and airports are plausible research environments.

**Airside:** Relevant for mapping terminal facades, stands, service roads, hangars, poles, lights, fences, and equipment zones. Must filter aircraft and movable GSE before persistent map release and validate under rain, wet pavement, night lighting, heat shimmer, and GNSS multipath.

## Comparison

| Method | Sensors | Main role | AV interpretation |
|---|---|---|---|
| Gaussian-LIC | LiDAR + IMU + camera | Real-time photo-realistic LIC Gaussian SLAM | Strong research mapper with metric sensors |
| Gaussian-LIC2 | LiDAR + IMU + camera | Continuous-time LIC Gaussian SLAM with dense depth completion | More complete 2025 extension |
| GS-LIVM | LiDAR + IMU + camera | Outdoor Gaussian LIV mapping with GPR/covariance-centered design | Closely related outdoor mapper |
| FAST-LIO2 | LiDAR + IMU | Fast metric odometry | Production-adjacent front-end baseline |
| GLIM | Range + IMU | Direct scan-matching factor-graph mapping | Strong map-building baseline |

## Evaluation

Evaluate separately:

- Pose ATE/RPE against motion capture, RTK/INS, or survey truth.
- Drift per kilometer and per minute.
- Depth-rendering accuracy against LiDAR or dense depth ground truth.
- Novel-view PSNR, SSIM, and LPIPS.
- Reconstruction accuracy, completeness, Chamfer distance, and F-score.
- Runtime, CUDA utilization, and GPU memory.
- Sensitivity to LiDAR sparsity and blind regions.
- Impact of Gaussian photometric constraints under LiDAR-degraded sequences.
- Calibration error sensitivity.

For AV/airside work, add dynamic-object ghosting, wet reflective surface behavior, day/night/weather buckets, map alignment to control points, and localization health behavior when a sensor degrades.

## Implementation Notes

- Treat time synchronization as a first-order requirement.
- Maintain rigorous camera-LiDAR-IMU extrinsic calibration and re-check after vibration or sensor replacement.
- Keep LiDAR depth supervision in the QA loop; do not rely only on RGB render quality.
- Store Gaussian maps with provenance: route, date, calibration, sensor versions, and filtering policy.
- Segment or erase dynamic objects before using maps for repeated localization experiments.
- Validate depth-completion outputs against held-out LiDAR or survey scans.
- Separate mapping-time global corrections from any real-time control pose.
- Review licenses and third-party CUDA/rasterizer dependencies before product use.

## Practical Recommendation

Use Gaussian-LIC and Gaussian-LIC2 as serious research baselines for metric, multi-sensor Gaussian mapping. For AV deployment, keep a conventional LIO/LIC/RIO fusion stack as the authority and evaluate Gaussian map factors as auxiliary constraints or visual QA layers until covariance, failure detection, and map lifecycle are solved.

## Sources

- Lang, Li, Wu, Zhao, Liu, Liu, Lv, and Zuo, "Gaussian-LIC: Real-Time Photo-Realistic SLAM with Gaussian Splatting and LiDAR-Inertial-Camera Fusion." https://arxiv.org/abs/2404.06926
- Gaussian-LIC project page. https://xingxingzuo.github.io/gaussian_lic/
- Official Gaussian-LIC repository. https://github.com/APRIL-ZJU/Gaussian-LIC
- Lang, Lv, Tang, Li, Huang, Liu, Liu, and Zuo, "Gaussian-LIC2: LiDAR-Inertial-Camera Gaussian Splatting SLAM." https://arxiv.org/abs/2507.04004
- Gaussian-LIC2 project page. https://xingxingzuo.github.io/gaussian_lic2/
- Local context: [GLIM](glim.md)
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
