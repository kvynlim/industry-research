# SplaTAM

<!-- method-priority:start
priority:
  learning: 3
  deployment: 2
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["slam", "mapping", "simulation", "validation"]
  reason: "SplaTAM is rated for neural or Gaussian SLAM research and future dense map representation workflows."
method-priority:end -->

## Executive Summary

SplaTAM, short for Splat, Track and Map, is a dense RGB-D SLAM method that uses 3D Gaussian primitives as the online map representation. It tracks camera pose by rendering the current Gaussian map and optimizing pose against incoming RGB-D frames, and it maps by adding and optimizing Gaussians for newly observed scene regions. Its significance is that it helped establish 3D Gaussian Splatting as a viable explicit, differentiable, real-time-ish map representation for dense SLAM.

For AV and airside work, SplaTAM is production-useful as a research aid for dense reconstruction, scene QA, digital-twin generation, simulation assets, and inspection-style mapping. It is research-stage as primary localization. It assumes RGB-D input, static scenes, a GPU differentiable renderer, and photometric/depth optimization without the fault monitoring expected from production localization. For operational airside pose, it should sit behind or beside classical state estimation and scan-to-map localization, not replace them.

## Repo Cross-Links

| Related area | Link | Why it matters |
|---|---|---|
| Gaussian perception and mapping | [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Broader AV-oriented discussion of Gaussian scene representations. |
| First-wave Gaussian SLAM comparison | [GS-SLAM and MonoGS](gs-slam-monogs.md), [Photo-SLAM](photo-slam.md) | SplaTAM is one of several 2023-2024 Gaussian SLAM systems with different tracking/map choices. |
| Dense visual baselines | [LSD-SLAM and DSO](lsd-slam-dso.md), [ORB-SLAM2/ORB-SLAM3](orb-slam2-orb-slam3.md) | Gaussian SLAM should be compared against mature sparse/direct visual SLAM. |
| Runtime localization | [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md) | SplaTAM dense maps are not a certified localization replacement. |
| Map construction | [Map Construction Pipeline](../maps/map-construction-pipeline.md) | Gaussian outputs need map QA, georeferencing, and lifecycle management before operational use. |
| Semantic and dynamic extensions | [Semantic SLAM](semantic-slam.md), [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md) | Static-scene Gaussian maps need semantic/dynamic filtering in real deployments. |

## Historical Context

3D Gaussian Splatting became prominent in 2023 as an explicit radiance-field representation that could render high-quality novel views much faster than NeRF-style ray marching. SLAM researchers quickly asked whether the same representation could support online camera tracking and mapping.

SplaTAM, published at CVPR 2024 by Nikhil Keetha, Jay Karhade, Krishna Murthy Jatavallabhula, Gengshan Yang, Sebastian Scherer, Deva Ramanan, and Jonathon Luiten, was one of the first major dense RGB-D SLAM systems built around 3D Gaussians. It emphasized a simple online system: track camera pose against a Gaussian map, map new regions by adding Gaussians, and use a silhouette signal to understand which parts of the scene have been represented.

SplaTAM should be understood as part of the first Gaussian SLAM wave alongside GS-SLAM, MonoGS, Gaussian-SLAM, and Photo-SLAM. These systems were exciting because they produced visually rich maps online, but they inherited the fragility of visual tracking, static-scene assumptions, and GPU-heavy differentiable optimization.

## Sensor Assumptions

SplaTAM assumes an RGB-D camera stream:

- RGB image with known intrinsics.
- Depth image registered to the RGB frame.
- Sequential camera frames with sufficient overlap.
- A mostly static scene.
- Known camera calibration and depth scale.
- GPU support for differentiable Gaussian rendering.

The RGB-D assumption is important. Consumer RGB-D sensors are short-range and can fail outdoors in sunlight, rain, fog, reflective surfaces, and long-range AV scenes. SplaTAM can be conceptually adapted to depth from LiDAR or stereo, but the original method is best matched to indoor RGB-D sequences such as Replica, TUM RGB-D, and ScanNet-style data.

For airside use, raw SplaTAM is more plausible for indoor terminal/hangar/cabin inspection or close-range infrastructure reconstruction than for apron-scale vehicle localization.

## State/Map Representation

The map is a set of 3D Gaussian primitives:

```text
G_i = {
  mean position,
  scale / covariance parameters,
  color or appearance parameters,
  opacity,
  optional bookkeeping for visibility and optimization
}
```

The state includes:

```text
Camera poses:
  T_wc_0, T_wc_1, ..., T_wc_k

Gaussian map:
  G = {G_1, G_2, ..., G_N}
```

Compared with TSDF or voxel maps, Gaussians are explicit, continuous, and renderable. Compared with sparse visual landmarks, they can represent dense appearance and surface occupancy. Compared with NeRF-style implicit fields, they render quickly and can be incrementally added.

The map is not a production HD map. It lacks stable lane/asset semantics, geodetic frame alignment, covariance, long-term update policy, and deterministic map-tile packaging.

## Algorithm Pipeline

1. Initialize a Gaussian map from the first RGB-D frame.
2. Render the current Gaussian map from a candidate camera pose.
3. Compare rendered color, depth, and silhouette/visibility with the incoming RGB-D frame.
4. Optimize the current camera pose for tracking.
5. Select mapping frames or keyframes.
6. Identify newly observed or underrepresented regions using depth and silhouette cues.
7. Add new Gaussians for unmapped geometry.
8. Optimize Gaussian parameters using color, depth, and silhouette losses over selected frames.
9. Repeat tracking and mapping online.
10. Evaluate trajectory, reconstruction, and novel-view synthesis quality.

The silhouette mask is central. It helps decide whether a pixel is already represented by the Gaussian map, which makes map expansion more structured than blindly densifying from color residuals.

## Formulation

SplaTAM uses differentiable rendering:

```text
render(G, T_wc, K) -> RGB_hat, D_hat, silhouette_hat
```

Tracking estimates the camera pose:

```text
T_wc* = argmin_T
        lambda_rgb * L_rgb(RGB_hat(T), RGB_obs)
      + lambda_depth * L_depth(D_hat(T), D_obs)
      + lambda_sil * L_silhouette(S_hat(T), S_obs)
```

Mapping optimizes Gaussian parameters:

```text
G* = argmin_G sum over selected frames L(render(G, T_k), observation_k)
```

This is a photometric/geometric rendering objective, not a classical scan-matching residual with a straightforward Hessian-based covariance. It can produce excellent visual maps while still being hard to use as a safety-critical pose estimator.

## Failure Modes

- RGB-D depth failure outdoors, in sunlight, over long range, on reflective/transparent surfaces, or on low-texture/low-return regions.
- Camera tracking loss under fast motion, motion blur, rolling shutter, or low texture.
- Dynamic objects are fused into the Gaussian map unless filtered.
- Photometric changes, exposure shifts, shadows, and lighting changes bias tracking.
- Loop closure and global consistency are limited compared with mature pose-graph SLAM.
- Map growth can become memory-heavy in large scenes.
- Gaussian optimization is sensitive to initialization, keyframe selection, and hyperparameters.
- No production-grade covariance, integrity monitoring, or fault isolation.
- Visual quality can be misleading: a map can render well from trained viewpoints while geometry or pose is wrong.

## AV Relevance

SplaTAM is relevant to AVs as a dense map representation and QA tool, not as a primary pose stack. Useful AV applications include:

- Dense reconstruction of garages, depots, terminals, cabins, and controlled indoor areas.
- Human-inspectable map QA overlays.
- Simulation or synthetic data asset generation.
- Comparing planned camera views against a reconstructed scene.
- Research into future semantic/Gaussian map layers.

Weak AV applications:

- Long-range outdoor localization.
- Safety-critical pose estimation in weather and dynamic traffic.
- High-speed vehicle odometry.
- Certified HD-map localization.

For production AVs, the Gaussian map should be downstream of trusted poses, or used as a non-safety visualization/QA layer.

## Indoor/Outdoor Relevance

Indoors, SplaTAM is well matched to RGB-D sensors and static scenes. It is useful for rooms, labs, warehouses, and AR-like use cases where dense visual quality matters. It should still be compared to mature RGB-D SLAM and reconstruction baselines when pose accuracy is the priority.

Outdoors, the original RGB-D assumption is the limiting factor. Depth cameras are range-limited, and visual appearance changes rapidly. Outdoor Gaussian SLAM needs robust depth from stereo/LiDAR, dynamic filtering, exposure handling, and loop closure.

Airside outdoor use is research-stage. Indoor airside use, such as terminal, baggage room, hangar, or cabin inspection, is more plausible.

## Airside Deployment Notes

Airside use cases where SplaTAM may help:

- Close-range reconstruction of indoor terminal or baggage handling areas.
- Hangar inspection and visual digital twins.
- Cabin or jet-bridge inspection with controlled motion.
- Offline visualization of survey areas if poses/depth are supplied by a trusted system.
- QA overlays for map operations teams.

Airside use cases where SplaTAM should not be primary:

- Apron vehicle localization.
- Aircraft stand approach pose.
- Long-range outdoor map matching.
- Dynamic GSE-heavy scenes without filtering.

If evaluated airside, feed it poses from a trusted SLAM/localization stack first, then compare Gaussian reconstruction quality. Do not infer localization readiness from rendering quality.

## Datasets/Metrics

Common datasets:

- Replica: synthetic indoor scenes with RGB-D and ground truth.
- TUM RGB-D: real RGB-D camera trajectories.
- ScanNet: real RGB-D indoor reconstruction and tracking context.
- NICE-SLAM/iMAP-style processed datasets: often used for neural dense SLAM comparisons.

Metrics:

- ATE/RPE for camera trajectory.
- PSNR, SSIM, and LPIPS for novel-view rendering.
- Depth L1 or depth RMSE for rendered depth.
- Reconstruction accuracy/completeness and F-score if mesh/point evaluation is used.
- Runtime per frame and mapping throughput.
- Number of Gaussians and GPU memory.
- Tracking failure rate under motion blur, low texture, and dynamics.

Airside metrics should add:

- Georeferenced reconstruction error against survey scans.
- Dynamic-object ghost rate.
- Inspection-view coverage.
- Performance under indoor/outdoor transitions and reflective aircraft/terminal materials.

## Open-Source Implementations

- `spla-tam/SplaTAM`: official CVPR 2024 implementation, BSD-3-Clause license, with dataset scripts and modified differentiable rasterization with depth support.
- Related first-wave references: MonoGS, GS-SLAM, Gaussian-SLAM, and Photo-SLAM.
- Rendering infrastructure: modified 3D Gaussian rasterizers and CUDA/PyTorch environments are core dependencies.

The official repo is useful for research reproduction. Production embedding would require dependency hardening, deterministic builds, memory controls, and a separate safety-rated pose source.

## Practical Recommendation

Use SplaTAM for dense RGB-D mapping research and visual QA. Do not use it as primary localization for AV or airside vehicles. If dense Gaussian maps are desired, generate them from validated trajectories and use them as inspection, simulation, or operator-facing artifacts.

Recommended airside stance:

1. Trust LiDAR/IMU/wheel/GNSS/map localization for pose.
2. Use SplaTAM-like Gaussian mapping offline or in supervised indoor workflows.
3. Add semantic/dynamic filtering before mapping operational scenes.
4. Evaluate rendering quality separately from localization integrity.

SplaTAM is production-useful as a dense reconstruction and QA aid. It is research-stage as primary localization.

## Sources

- Keetha, Nikhil, Jay Karhade, Krishna Murthy Jatavallabhula, Gengshan Yang, Sebastian Scherer, Deva Ramanan, and Jonathon Luiten. "SplaTAM: Splat, Track and Map 3D Gaussians for Dense RGB-D SLAM." CVPR 2024. https://arxiv.org/abs/2312.02126
- SplaTAM official repository. https://github.com/spla-tam/SplaTAM
- SplaTAM project/publication page. https://publications.ri.cmu.edu/splatam-splat-track-map-3d-gaussians-for-dense-rgb-d-slam
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
- Local context: [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md)
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
