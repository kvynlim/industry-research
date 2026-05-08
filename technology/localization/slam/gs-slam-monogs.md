# GS-SLAM and MonoGS

## Executive Summary

GS-SLAM and MonoGS are first-wave Gaussian Splatting SLAM systems from the 2023-2024 burst of work that adapted 3D Gaussian maps to online camera tracking and dense reconstruction. GS-SLAM focuses on dense visual RGB-D SLAM with adaptive Gaussian expansion and coarse-to-fine pose tracking. MonoGS, formally "Gaussian Splatting SLAM," demonstrates a dense SLAM system based on 3D Gaussian Splatting with monocular support and additional stereo/RGB-D modes.

Their importance is representational: they show that 3D Gaussians can be optimized online for both tracking and high-fidelity map rendering. Their production role is still limited. They are useful as research aids for dense visual mapping, simulation assets, inspection maps, and map QA. They are research-stage as primary localization for AVs or airside vehicles because they depend on photometric optimization, GPU renderers, fragile initialization, static scenes, and immature uncertainty/fault monitoring.

## Repo Cross-Links

| Related area | Link | Why it matters |
|---|---|---|
| Gaussian representation overview | [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md) | Broader AV context for 3D Gaussian Splatting and its limits. |
| SplaTAM | [SplaTAM](splatam.md) | Similar first-wave RGB-D Gaussian SLAM with explicit track-and-map design. |
| Photo-SLAM | [Photo-SLAM](photo-slam.md) | A more hybrid system that keeps ORB-SLAM3-style geometric localization with photorealistic Gaussian mapping. |
| Sparse visual SLAM | [ORB-SLAM2/ORB-SLAM3](orb-slam2-orb-slam3.md) | Mature visual SLAM baseline and a reminder that loop closure/relocalization matter. |
| Direct visual SLAM | [LSD-SLAM and DSO](lsd-slam-dso.md) | Photometric tracking predates Gaussian maps and has known lighting/failure limitations. |
| Production localization | [Production LiDAR Map Localization](../production-lidar-map-localization.md) | Gaussian visual SLAM should not replace validated map-frame localization. |
| Dynamic and semantic handling | [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md), [Semantic SLAM](semantic-slam.md) | First-wave Gaussian SLAM generally assumes static scenes and needs dynamic filtering. |

## Historical Context

The original 3D Gaussian Splatting work made real-time radiance-field rendering practical by replacing slow implicit volume rendering with explicit anisotropic Gaussian primitives and a fast rasterizer. SLAM researchers quickly explored whether Gaussians could act as the map in online tracking and mapping.

GS-SLAM, by Chi Yan, Delin Qu, Dan Xu, Bin Zhao, Zhigang Wang, Dong Wang, and Xuelong Li, was accepted at CVPR 2024 and presented a dense visual SLAM system using 3D Gaussian Splatting. It proposed adaptive expansion/deletion of Gaussians and a coarse-to-fine tracking strategy.

MonoGS, by Hidenobu Matsuki, Riku Murai, Paul H. J. Kelly, and Andrew J. Davison, was also a CVPR 2024 highlight and released as the `muskie82/MonoGS` repository. It is often called MonoGS because it demonstrates monocular Gaussian Splatting SLAM, while also supporting RGB-D and stereo modes.

Together with SplaTAM, Gaussian-SLAM, and Photo-SLAM, these systems define the first wave: dense maps look much better and render faster than many neural implicit SLAM systems, but pose robustness and production integration remain immature.

## Sensor Assumptions

GS-SLAM:

- RGB-D camera input.
- Known camera intrinsics and registered depth.
- Static scene assumption.
- Sufficient texture and depth quality for photometric/depth tracking.
- GPU differentiable Gaussian rasterization.

MonoGS:

- Monocular, RGB-D, and experimental stereo modes in the released repository.
- Monocular mode needs careful initialization and enough parallax/texture.
- The live demo guidance recommends a global-shutter RealSense-like camera and non-aggressive initial motion.
- GPU compute and a compatible CUDA/PyTorch stack.

Neither system is naturally matched to long-range outdoor AV localization. They are camera-centric dense SLAM systems. For vehicle-scale outdoor use, they need robust depth, dynamics handling, loop closure/global consistency, and integration with inertial/wheel/LiDAR priors.

## State/Map Representation

Both methods represent the scene as a set of 3D Gaussians:

```text
G_i = {
  mean position,
  covariance or scale/rotation,
  opacity,
  color / spherical harmonic / appearance parameters,
  optimization bookkeeping
}
```

The trajectory state is a sequence of camera poses:

```text
T_wc_0, T_wc_1, ..., T_wc_k
```

The rendered map provides:

```text
RGB_hat, depth_hat, alpha/silhouette_hat
```

GS-SLAM emphasizes adaptive map expansion and deletion to cover newly observed scene geometry and remove noisy Gaussians. MonoGS emphasizes a Gaussian-only dense SLAM representation with camera pose gradients in the rasterizer and practical support for mono/RGB-D/stereo datasets.

The missing production state is explicit uncertainty:

- Pose covariance calibrated for fusion.
- Degeneracy detection.
- Dynamic-object state.
- Map-element lifecycle policy.
- Geodetic or HD-map anchoring.

## Algorithm Pipeline

GS-SLAM high-level pipeline:

1. Initialize Gaussians from RGB-D observations.
2. Render the Gaussian map from a candidate camera pose.
3. Use a coarse-to-fine pose tracking process to align rendered and observed RGB-D.
4. Select reliable Gaussians for tracking to reduce runtime and improve robustness.
5. Add Gaussians in newly observed regions.
6. Delete noisy or redundant Gaussians.
7. Optimize Gaussian parameters for dense mapping and rendering.

MonoGS high-level pipeline:

1. Initialize camera pose and Gaussian map from early frames.
2. Run tracking against the current Gaussian map.
3. Insert keyframes and update the Gaussian map.
4. Optimize Gaussians and camera poses through differentiable rendering losses.
5. Render dense maps and report trajectory/rendering metrics.
6. Support monocular, RGB-D, stereo, and live RealSense-like inputs through configuration.

Both systems are online dense mapping systems, but they are not full AV localization stacks.

## Formulation

Tracking is generally:

```text
T_k* = argmin_T L(render(G, T), observation_k)
```

For RGB-D:

```text
L = lambda_rgb * L_rgb(RGB_hat, RGB)
  + lambda_depth * L_depth(D_hat, D)
  + optional alpha/silhouette/regularization terms
```

For monocular:

```text
L = photometric loss + geometry/depth/regularization from the system's internal priors
```

Mapping is:

```text
G* = argmin_G sum_k L(render(G, T_k), observation_k)
```

In backend form, this resembles dense direct visual SLAM, but the map is explicit Gaussians rather than pixels, voxels, surfels, or an implicit neural field. The key practical limitation is that the cost is photometric and rendering-based. It does not automatically provide the integrity signals expected from LiDAR scan-to-map localization or factor-graph sensor fusion.

## Failure Modes

- Initialization failure, especially in monocular mode with low parallax or aggressive motion.
- Scale ambiguity or scale drift in monocular operation without metric priors.
- Tracking failure under motion blur, rolling shutter, low texture, or fast exposure changes.
- Dynamic objects fused into the map and then used for tracking.
- Lighting changes, shadows, specular surfaces, rain, glare, and night scenes corrupt photometric residuals.
- Gaussian map growth and GPU memory pressure in large scenes.
- Limited loop closure/global consistency compared with mature visual SLAM.
- Dependency fragility around CUDA, custom rasterizers, PyTorch versions, and GUI/headless operation.
- Visual rendering quality can hide geometric or pose errors.
- No production-grade covariance or integrity monitor.

## AV Relevance

AV relevance is strongest for map representation and QA:

- Dense visual digital twins for depots, terminals, tunnels, and indoor facilities.
- Human review of map quality.
- Simulation and novel-view generation.
- Research into semantic Gaussian maps and visual localization aids.
- Potential future compact appearance maps for relocalization after robust verification.

AV relevance is weak for primary localization:

- Cameras degrade under weather, glare, night, dirt, and low texture.
- Photometric tracking is hard to certify.
- Dynamic traffic and GSE are not naturally modeled.
- Long-range map-frame localization needs geodetic alignment and lifecycle management.

In production, use Gaussian SLAM maps as downstream artifacts generated from trusted trajectories, or as auxiliary perception research layers.

## Indoor/Outdoor Relevance

Indoors, GS-SLAM and MonoGS are compelling for dense RGB-D/visual reconstruction. They can produce visually rich maps of rooms and corridors and support AR-like visualization. MonoGS monocular mode is attractive when depth sensors are unavailable, but it needs careful motion and enough visual texture.

Outdoors, these methods are much less mature. Outdoor operation needs robust exposure handling, moving-object filtering, metric depth, large-scale map management, and loop closure. For road or airside AVs, LiDAR/IMU/wheel/GNSS localization remains the practical backbone.

Airside indoor/hangar/terminal use is plausible for inspection and digital twins. Apron localization is research-stage.

## Airside Deployment Notes

Potential airside uses:

- Hangar or terminal interior 3D visual reconstruction.
- Jet bridge, cabin, or equipment inspection maps.
- Operator-facing QA of survey data.
- Synthetic camera data generation from reconstructed spaces.
- Research comparison between Gaussian and classical dense maps.

Airside cautions:

- Aircraft and GSE are dynamic or movable and should not become static localization anchors.
- Wet tarmac, glass, metallic aircraft surfaces, and night lighting create photometric failure cases.
- Long-range apron geometry is beyond normal RGB-D assumptions.
- Camera-only Gaussian tracking should not drive safety-critical pose.
- Any Gaussian map used operationally must be georeferenced and checked against the validated HD map.

## Datasets/Metrics

GS-SLAM datasets:

- Replica.
- TUM RGB-D.

MonoGS repository datasets:

- TUM RGB-D.
- Replica.
- EuRoC MAV.
- Live RealSense-style demos.

Metrics:

- ATE/RPE for trajectory.
- PSNR, SSIM, LPIPS for rendering.
- Depth error for RGB-D modes.
- Runtime tracking FPS and mapping FPS.
- Number of Gaussians and GPU memory.
- Tracking failure rate.
- Reconstruction accuracy/completeness when surface evaluation is available.

Airside additions:

- Georeferenced error against survey LiDAR or photogrammetry.
- Dynamic-object ghost rate.
- Robustness under glare, night, rain, reflective aircraft, and terminal glass.
- Scale and drift over long apron/hangar trajectories.
- Availability after deliberate relocalization or kidnapped-camera events.

## Open-Source Implementations

- GS-SLAM project page provides the paper and modified rasterization code for SLAM-related depth/pose support. A full production-grade maintained stack should not be assumed from the project page alone.
- `yanchi-3dv/diff-gaussian-rasterization-for-gsslam`: modified differential Gaussian rasterizer for GS-SLAM.
- `muskie82/MonoGS`: official Gaussian Splatting SLAM implementation with mono/RGB-D/stereo configurations and live RealSense demo guidance.
- `VladimirYugay/Gaussian-SLAM`: related first-wave Gaussian-SLAM codebase with submap organization.
- `spla-tam/SplaTAM`: related RGB-D Gaussian SLAM baseline.

License and dependency review are required. Several projects combine custom CUDA rasterizers, third-party Gaussian Splatting code, Open3D, PyTorch, and visual SLAM components.

## Practical Recommendation

Use GS-SLAM and MonoGS to understand first-wave Gaussian SLAM design and to evaluate dense visual map quality. Do not use them as primary AV or airside localization stacks. Their best production-adjacent use is as a dense map/visual QA layer generated from or checked against a trusted localization pipeline.

For airside work:

1. Generate or validate camera poses using classical SLAM/localization first.
2. Build Gaussian maps as visual artifacts.
3. Add semantic/dynamic filtering before using operational scenes.
4. Treat Gaussian tracking output as research data unless covariance, OOD behavior, relocalization, and map lifecycle are solved.

GS-SLAM and MonoGS are production-useful as research and QA aids. They are research-stage as primary localization.

## Sources

- Yan, Chi, Delin Qu, Dan Xu, Bin Zhao, Zhigang Wang, Dong Wang, and Xuelong Li. "GS-SLAM: Dense Visual SLAM with 3D Gaussian Splatting." CVPR 2024. https://arxiv.org/abs/2311.11700
- GS-SLAM project page. https://gs-slam.github.io/
- GS-SLAM modified rasterization repository. https://github.com/yanchi-3dv/diff-gaussian-rasterization-for-gsslam
- Matsuki, Hidenobu, Riku Murai, Paul H. J. Kelly, and Andrew J. Davison. "Gaussian Splatting SLAM." CVPR 2024. https://github.com/muskie82/MonoGS
- MonoGS project page. https://rmurai.co.uk/projects/GaussianSplattingSLAM/
- Yugay, Vladimir, Yue Li, Theo Gevers, and Martin R. Oswald. "Gaussian-SLAM: Photo-realistic Dense SLAM with Gaussian Splatting." https://arxiv.org/abs/2312.10070
- Gaussian-SLAM repository. https://github.com/VladimirYugay/Gaussian-SLAM
- Local context: [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md)
- Local context: [Production LiDAR Map Localization](../production-lidar-map-localization.md)
