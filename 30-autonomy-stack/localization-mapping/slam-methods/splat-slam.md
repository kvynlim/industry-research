# Splat-SLAM

<!-- method-priority:start
priority:
  learning: 3
  deployment: 2
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["slam", "mapping", "simulation"]
  reason: "Useful Gaussian SLAM reference, but not a runtime pose backbone."
method-priority:end -->

Related docs: [GS-SLAM and MonoGS](gs-slam-monogs.md), [SplaTAM](splatam.md), [WildGS-SLAM](wildgs-slam.md), [MASt3R-SLAM](mast3r-slam.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).

## Executive Summary

Splat-SLAM is a globally optimized RGB-only Gaussian SLAM method. It uses a dense 3D Gaussian map, but unlike many early Gaussian SLAM systems it does not rely only on local frame-to-model tracking. Its main contribution is making the Gaussian map adapt to globally optimized keyframe poses and depth updates, so tracking, mapping, and rendering benefit from global corrections.

The method matters because it directly attacks a weakness of first-wave Gaussian SLAM: visually rich maps can look good locally while the trajectory and geometry remain globally inconsistent. Splat-SLAM keeps the renderable Gaussian representation, but ties it to global pose/depth optimization and active map deformation.

For AV and airside autonomy, Splat-SLAM is best treated as a research reference for RGB-only dense mapping and global Gaussian map correction. It is not a production localization stack. It has no native IMU, LiDAR, radar, wheel, GNSS, HD-map, safety covariance, or adverse-weather robustness.

## Core Idea

Splat-SLAM represents the scene as 3D Gaussians and estimates camera motion from monocular RGB. The key idea is that the Gaussian map should follow global bundle-adjustment-style updates instead of staying fixed after local insertion.

Core elements:

- RGB-only input with known camera intrinsics.
- Dense 3D Gaussian scene map.
- Globally optimized keyframe poses and depths.
- Online deformation of the Gaussian map when keyframe pose/depth estimates change.
- Optional monocular depth-estimator refinement in inaccurate depth regions.
- Differentiable rendering for RGB/depth/map optimization.

This makes Splat-SLAM closer to globally optimized visual SLAM with a renderable dense map than to a pure local neural mapper.

## Pipeline

1. Ingest monocular RGB frames and camera calibration.
2. Estimate and update keyframe camera poses and depth maps.
3. Initialize or update 3D Gaussians from the current keyframe geometry.
4. Render the Gaussian map from candidate camera poses.
5. Optimize camera tracking using rendering and geometric consistency losses.
6. Run global pose/depth optimization over keyframes.
7. Deform or update the Gaussian map when optimized keyframe states change.
8. Refine weak depth regions with a monocular depth estimator where useful.
9. Evaluate trajectory, reconstruction, rendering quality, runtime, and map size.

## Strengths

- Addresses global consistency more directly than local-only Gaussian SLAM.
- Uses compact, renderable 3D Gaussians rather than implicit neural fields.
- Does not require RGB-D depth input.
- Produces dense visual maps useful for inspection and novel-view rendering.
- Evaluated on common indoor RGB/RGB-D-derived benchmarks such as Replica, TUM RGB-D, and ScanNet.
- The official Google Research repository makes the method reproducible for research.

## Limitations

- Monocular RGB has scale ambiguity unless constrained by priors or alignment.
- Camera-only tracking is exposed to blur, rolling shutter, glare, low texture, exposure changes, night operation, rain, fog, and dirty lenses.
- Dynamic objects can bias both pose and map unless handled externally.
- Global optimization can correct maps, but it can also introduce pose-frame jumps that production control stacks must isolate.
- Monocular depth priors are learned estimates, not calibrated range measurements.
- Rendering quality is not equivalent to metric localization integrity.
- No native inertial, wheel, GNSS, LiDAR, or radar factors.
- No production-grade covariance, health monitor, map versioning, or safety case.

## AV Relevance

Splat-SLAM is useful for AV research when the question is how to maintain a globally consistent Gaussian appearance/geometry map from RGB video. It is relevant for:

- Offline visual reconstruction from camera logs.
- Static-scene visual map QA.
- Benchmarking RGB-only Gaussian SLAM against MonoGS, SplaTAM, WildGS-SLAM, and MASt3R-SLAM.
- Studying how Gaussian maps should respond to global pose/depth corrections.

It should not be used as the main AV pose source. Production localization still needs metric sensor fusion, bounded latency, robust dynamic-object filtering, calibrated uncertainty, map governance, and independent degradation handling.

## Indoor/Outdoor Notes

**Indoor:** Best matched to rooms, corridors, labs, and small building-scale scans with stable lighting and enough texture. RGB-only operation is attractive where depth cameras are unavailable.

**Outdoor:** More difficult. Outdoor scale, dynamic traffic, exposure variation, long-range geometry, weather, and low-texture pavement stress the monocular assumptions.

**Airside:** Use only as an offline visual reconstruction baseline. Wet tarmac, aircraft surfaces, night floodlights, glare, fog, and moving GSE are outside the comfort zone of camera-only Gaussian tracking.

## Comparison

| Method | Sensors | Main distinction | AV interpretation |
|---|---|---|---|
| Splat-SLAM | Monocular RGB | Globally optimized RGB-only 3D Gaussian SLAM | Research reference for global Gaussian map correction |
| MonoGS | Mono/RGB-D/stereo | First-wave online Gaussian SLAM | Strong baseline, limited production maturity |
| SplaTAM | RGB-D | Simple track-and-map Gaussian RGB-D design | Indoor dense mapping reference |
| WildGS-SLAM | Monocular RGB | Dynamic-scene uncertainty weighting | Better dynamic handling, still camera-only |
| MASt3R-SLAM | Monocular RGB | Learned pointmap priors and loop closure | Foundation-style dense visual SLAM baseline |

## Evaluation

Important evaluation dimensions:

- ATE/RPE after explicitly documented alignment.
- Scale drift in monocular operation.
- Reconstruction accuracy, completeness, and depth error.
- PSNR, SSIM, and LPIPS for rendering.
- Loop/global optimization impact before and after correction.
- Map size, number of Gaussians, runtime, and GPU memory.
- Failure rate under blur, low texture, exposure change, and dynamic objects.

For AV and airside studies, add metric alignment against RTK/LiDAR survey truth, dynamic-object ghost rate, night/rain/fog/glare buckets, and disagreement against a production localization baseline.

## Implementation Notes

- Use the official repository as research code, not as a deployment component.
- Pin CUDA, PyTorch, rasterizer, and dependency versions.
- Record whether evaluation uses SE(3), Sim(3), or scale-only alignment.
- Keep generated Gaussian maps separate from operational HD maps.
- Run dynamic-object filtering before map release.
- Treat monocular depth-estimator outputs as priors with unknown calibration.
- Do not feed global optimization jumps directly to a vehicle controller.
- Export trajectories and maps for independent QA against LiDAR, GNSS/INS, or surveyed control points.

## Practical Recommendation

Use Splat-SLAM to study globally corrected Gaussian RGB mapping and to compare against first-wave Gaussian SLAM. Do not treat it as AV-grade localization. If used in an AV pipeline, use it offline or as a non-authoritative visual map layer aligned to a trusted metric map.

## Sources

- Sandstrom, Tateno, Oechsle, Niemeyer, Van Gool, Oswald, and Tombari, "Splat-SLAM: Globally Optimized RGB-only SLAM with 3D Gaussians." https://arxiv.org/abs/2405.16544
- Splat-SLAM CVPRW 2025 open-access paper. https://openaccess.thecvf.com/content/CVPR2025W/VOCVALC/papers/Sandstrom_Splat-SLAM_Globally_Optimized_RGB-only_SLAM_with_3D_Gaussians_CVPRW_2025_paper.pdf
- Official Splat-SLAM repository. https://github.com/google-research/Splat-SLAM
- Local context: [GS-SLAM and MonoGS](gs-slam-monogs.md)
- Local context: [SplaTAM](splatam.md)
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
