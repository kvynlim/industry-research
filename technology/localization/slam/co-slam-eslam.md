# Co-SLAM and ESLAM

## Executive Summary

Co-SLAM and ESLAM are 2023 neural implicit RGB-D SLAM systems that made the post-[NICE-SLAM](nice-slam.md) generation faster and more detailed. Both replace a slow global neural field with hybrid representations that are easier to optimize online. Co-SLAM uses a joint coordinate and sparse parametric encoding: a multi-resolution hash grid for high-frequency detail plus one-blob encoding for surface coherence and completion. ESLAM uses multi-scale axis-aligned feature planes with shallow decoders that output TSDF and RGB values.

Indoor value is high for research-grade dense RGB-D reconstruction. Co-SLAM emphasizes real-time tracking, high-fidelity reconstruction, and global bundle adjustment over all keyframes through efficient ray sampling. ESLAM emphasizes efficiency, no pretraining, and fast dense SLAM with a hybrid signed-distance representation. Both are stronger practical neural baselines than [iMAP](imap.md), but neither is a production vehicle localization stack.

For AV and airside applications, treat Co-SLAM and ESLAM as dense indoor mapping and representation research. They can inform digital twin creation, inspection maps, and future map representations, but they lack the weather robustness, multi-sensor fusion, certified uncertainty, and failure monitoring needed for outdoor airside autonomy. For real-time renderable explicit alternatives, compare with Gaussian SLAM and perception methods in [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md).

## Historical Context

NICE-SLAM showed that hierarchical feature grids improved iMAP's scalability, but neural RGB-D SLAM still suffered from slow optimization, local detail limitations, and weak global consistency. Co-SLAM and ESLAM both appeared at CVPR 2023 and addressed these issues from different representation angles.

Co-SLAM, by Hengyi Wang, Jingwen Wang, and Lourdes Agapito, introduced joint coordinate and sparse parametric encodings for neural real-time SLAM. The project page reports real-time RGB-D SLAM with robust camera tracking, high-fidelity surface reconstruction, and 10 Hz style operation on standard indoor benchmarks. It explicitly compares against iMAP, NICE-SLAM, and ESLAM.

ESLAM, by Mohammad Mahdi Johari, Camilla Carta, and Francois Fleuret, introduced an efficient dense SLAM system based on a hybrid representation of signed distance fields. Its project page and CVF paper describe multi-scale axis-aligned perpendicular feature planes and shallow decoders, with no pretraining and strong efficiency claims over prior dense neural SLAM methods.

Together, the two methods mark the shift from "can a neural implicit map run online?" to "which hybrid representation makes neural dense SLAM efficient enough to be useful?"

## Sensor Assumptions

Both methods assume RGB-D input with known camera intrinsics and accurate depth scale. They are designed for indoor dense visual SLAM, not outdoor long-range vehicle localization.

Common assumptions:

- RGB and depth are synchronized and calibrated.
- Depth is dense enough for metric tracking and reconstruction.
- Scene geometry is mostly static.
- Camera motion is smooth enough for pose optimization.
- Scene bounds, sampling, and map resolution are configured appropriately.
- A CUDA-capable GPU is available.
- Dynamic objects are absent, masked, or not dominant.

Co-SLAM and ESLAM do not natively solve IMU preintegration, wheel odometry fusion, GNSS anchoring, lidar factors, or production safety monitoring. They can be extended or wrapped, but those components are outside the core papers.

## State/Map Representation

Co-SLAM represents the scene with a hybrid encoding:

```text
encoding(x) = {
  multi_resolution_hash_grid(x),
  one_blob_coordinate_encoding(x)
}

decoder(encoding(x)) -> {
  SDF_or_geometry,
  RGB
}
```

The hash grid converges quickly and captures high-frequency local detail. The one-blob encoding provides a coordinate-based smoothness prior that encourages coherent surfaces and completion in unobserved areas. Co-SLAM also keeps keyframe poses and can perform global bundle adjustment over all keyframes using efficient ray sampling.

ESLAM represents the scene with multi-scale axis-aligned perpendicular feature planes, typically analogous to XY, YZ, and XZ planes at multiple resolutions:

```text
features_at_x = interpolate(feature_planes_xy, yz, xz, x)
decoder(features_at_x, x) -> {
  TSDF,
  RGB
}
```

This factorizes 3D space into feature planes, reducing memory and speeding updates compared with dense 3D grids. Shallow decoders map interpolated features to signed-distance and color predictions. The output TSDF-like field can be meshed for reconstruction.

Both representations are more local and efficient than iMAP's single global MLP.

## Algorithm Pipeline

Co-SLAM pipeline:

1. Receive an RGB-D frame.
2. Track the current camera pose by optimizing rendered RGB-D residuals against the neural map.
3. Select rays and pixels with an efficient sampling strategy.
4. Add or update keyframes.
5. Optimize scene encoding and camera poses with a bundle-adjustment-style objective.
6. Use the joint hash-grid and one-blob encoding to balance detail and surface coherence.
7. Extract meshes or render views for evaluation.

ESLAM pipeline:

1. Receive sequential RGB-D frames with unknown poses.
2. Track camera pose against the current feature-plane implicit map.
3. Sample rays from live and selected keyframes.
4. Decode TSDF and RGB values from multi-scale feature planes.
5. Optimize feature planes, shallow decoders if applicable, and pose variables.
6. Extract TSDF zero-level surfaces for dense reconstruction.
7. Continue incremental mapping without requiring offline pretraining.

Both systems retain the neural SLAM pattern: alternating or interleaving tracking and mapping through differentiable rendering.

## Formulation

Both methods minimize rendering losses over sampled rays:

```text
L = lambda_d * L_depth_or_sdf
  + lambda_c * L_color
  + lambda_fs * L_free_space_or_truncation
  + lambda_reg * L_regularization
```

For tracking:

```text
T_t = argmin_T L(render(map, T), RGBD_t)
```

For mapping:

```text
map_parameters, selected_poses =
  argmin sum_{keyframes, rays} L(render(map, T_k), RGBD_k)
```

Co-SLAM's notable formulation point is global bundle adjustment over all keyframes enabled by efficient ray sampling. Instead of only optimizing a small active keyframe set, it can use broader history while keeping runtime manageable.

ESLAM's notable formulation point is its hybrid SDF representation. It decodes TSDF and RGB from feature planes, combining neural rendering with a signed-distance geometry target that is more directly tied to surface reconstruction than pure density.

## Failure Modes

- RGB-D depth artifacts directly supervise wrong geometry.
- Dynamic objects are reconstructed unless explicitly masked or downweighted.
- Long featureless areas can still produce weak pose constraints.
- Repeated geometry can produce wrong revisits or overconfident local alignment.
- Neural completion can fill unobserved space incorrectly.
- Hash grids and feature planes depend on scene bounds and resolution choices.
- Co-SLAM global bundle adjustment can still fail if the underlying correspondences or render losses are wrong.
- ESLAM's efficient factorization can underrepresent geometry that does not align well with its feature-plane capacity or chosen resolution.
- Neither method provides mature loop-closure, relocalization, or multi-session map management comparable to RTAB-Map.
- Both require GPU support and research-code deployment assumptions.
- Neither provides certified uncertainty or fault isolation for safety-critical pose output.

## AV Relevance

Co-SLAM and ESLAM matter to AV research because they show practical ways to maintain dense neural scene maps online. A future AV map layer might use hybrid representations for inspection, simulation, semantic rendering, or change detection. They also provide better baselines for dense indoor reconstruction than early single-MLP neural maps.

They are not direct AV localization solutions. AVs need sensor redundancy, long-range operation, high-speed motion support, dynamic object handling, explicit covariance, map georeferencing, and safe correction behavior. Dense neural reconstruction quality does not imply localization safety.

Transferable ideas:

- Hybrid map representations that combine fast local features with coordinate priors.
- Efficient ray sampling for online bundle-adjustment-like optimization.
- SDF/TSDF neural outputs for explicit surface extraction.
- Neural map comparison against classical TSDF, surfel, and point-cloud maps.
- Separation of map quality metrics from pose accuracy metrics.

## Indoor/Outdoor Relevance

Indoor relevance is high for research. Both methods are evaluated on indoor RGB-D benchmarks such as Replica, ScanNet, TUM RGB-D, and synthetic RGB-D data. They are useful for rooms, apartments, offices, corridors, and controlled service areas.

Outdoor relevance is low for direct deployment. RGB-D cameras do not provide reliable long-range sunlit outdoor depth, and the methods do not include lidar-inertial or GNSS integration. The representations could inspire future outdoor neural maps if paired with lidar/camera inputs and robust state estimation, but the published systems are not outdoor AV localizers.

For airport operations, the natural scope is indoor airside or landside-adjacent mapping: hangars, maintenance rooms, baggage halls, and terminal service corridors. Open apron localization should remain with lidar-inertial/GNSS/map localization.

## Airside Deployment Notes

Research uses:

- Dense reconstruction benchmarks on hangar and maintenance-bay RGB-D captures.
- Comparison of classical [RTAB-Map](rtab-map.md), [BundleFusion](bundlefusion.md), NICE-SLAM, Co-SLAM, and ESLAM.
- Neural map QA for indoor airport digital twins.
- Evaluating how feature-grid and feature-plane maps handle reflective aircraft surfaces and moved equipment.

Deployment cautions:

- Do not use neural completion as safety geometry around aircraft, engines, wings, or personnel.
- Mask dynamic equipment before mapping.
- Keep neural maps versioned and tied to raw measurements for audit.
- Check whether global updates change previously accepted geometry.
- Monitor latency, GPU memory, residuals, and tracking failure rates.
- Use independent pose sources for navigation and treat neural output as a map/inspection layer.

If the goal is a live airside vehicle, these methods should sit behind a classical localization and safety stack. If the goal is dense indoor digital-twin generation, they are worth evaluating.

## Datasets/Metrics

Co-SLAM reports results on ScanNet, TUM RGB-D, Replica, and Synthetic RGB-D benchmarks. ESLAM reports on Replica, ScanNet, and TUM RGB-D. Useful metrics:

- ATE/APE and RPE for camera trajectory.
- Reconstruction accuracy, completeness, Chamfer distance, F-score, and normal consistency.
- Rendered RGB PSNR/SSIM/LPIPS when appearance matters.
- Depth L1 error and SDF/TSDF surface error.
- Runtime in tracking Hz and mapping Hz.
- GPU memory and map parameter count.
- Forgetting or degradation after revisits.
- Robustness to dynamic objects and frame loss.
- Mesh extraction time and mesh resolution.

Airside-specific metrics should include moved-object ghosting, repeated-geometry false alignment, reflective-surface error, and map-change auditability between sessions.

## Open-Source Implementations

- `HengyiWang/Co-SLAM`: official CVPR 2023 code, Apache-2.0 license, with configs and scripts for common RGB-D datasets.
- `idiap/ESLAM`: official CVPR 2023 code, Apache-2.0 license, with configs, visualization, ATE evaluation, and reconstruction evaluation scripts.
- Both repositories are research implementations using Python/PyTorch and CUDA-oriented dependencies.

The code is suitable for benchmarking and experimentation. Production use would require sensor integration, logging, deterministic runtime controls, dynamic-object filtering, health metrics, and license/dependency review.

## Practical Recommendation

For neural RGB-D SLAM research in 2026, evaluate Co-SLAM and ESLAM after NICE-SLAM. Use Co-SLAM when testing high-fidelity reconstruction and global bundle-adjustment-style optimization. Use ESLAM when testing efficient TSDF-like neural SDF mapping with shallow decoders and no pretraining.

For airside autonomy, do not choose either as the pose backbone. Use them to create or inspect indoor dense maps, compare neural representations, and study future map layers. Keep [RTAB-Map](rtab-map.md), lidar-inertial SLAM, and surveyed map localization as the practical navigation baselines.

## Sources

- Wang, Wang, and Agapito, "Co-SLAM: Joint Coordinate and Sparse Parametric Encodings for Neural Real-Time SLAM," CVPR 2023. https://arxiv.org/abs/2304.14377
- Co-SLAM project page. https://hengyiwang.github.io/projects/CoSLAM
- Co-SLAM repository. https://github.com/HengyiWang/Co-SLAM
- Johari, Carta, and Fleuret, "ESLAM: Efficient Dense SLAM System Based on Hybrid Representation of Signed Distance Fields," CVPR 2023. https://openaccess.thecvf.com/content/CVPR2023/html/Johari_ESLAM_Efficient_Dense_SLAM_System_Based_on_Hybrid_Representation_of_CVPR_2023_paper.html
- ESLAM project page. https://www.idiap.ch/paper/eslam/
- ESLAM repository. https://github.com/idiap/ESLAM
- Local context: [iMAP](imap.md)
- Local context: [NICE-SLAM](nice-slam.md)
- Local context: [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md)
