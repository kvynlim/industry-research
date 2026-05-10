# SplatAD

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["perception", "simulation", "validation", "road-av"]
  reason: "SplatAD is rated for neural scene representation learning and simulation-oriented perception research."
method-priority:end -->

## What It Is

- SplatAD is a CVPR 2025 method for real-time camera and LiDAR rendering with 3D Gaussian Splatting in autonomous-driving scenes.
- It is best read as sensor-realistic rendering, simulation, log replay, and map-support infrastructure.
- It is not a pose SLAM backend and does not replace odometry, factor-graph localization, or scan matching.
- The method extends 3DGS from camera-only novel view synthesis to joint camera and 360-degree spinning-LiDAR rendering.
- It is related to the broader 3DGS driving stack in [3D Gaussian Splatting for Driving](../overview/gaussian-splatting-driving.md) and to simulation-oriented 3DGS work in [3DGS Digital Twin](../../simulation/3dgs-digital-twin.md).

## Core Technical Idea

- Represent a dynamic driving scene with static-background Gaussians plus actor-attached Gaussians.
- Render both camera images and LiDAR point clouds from the same Gaussian scene representation.
- Replace standard 3DGS spherical-harmonic color modeling with per-Gaussian learnable features and sensor embeddings.
- Add LiDAR-specific projection into spherical coordinates, non-equidistant tiling matched to LiDAR beam layout, and custom CUDA rasterization.
- Decode rasterized features into RGB, LiDAR range, LiDAR intensity, and LiDAR ray-drop probability.
- Compensate rolling shutter for both cameras and LiDAR sweeps by adjusting projected Gaussian locations during rasterization.
- Preserve differentiability so collected logs can be optimized into sensor-realistic simulation assets.

## Inputs and Outputs

- Inputs for training: synchronized multi-camera images, LiDAR sweeps, sensor intrinsics, sensor extrinsics, ego poses, and dynamic actor tracks or annotations.
- Inputs for rendering: target camera or LiDAR pose, timestamp, selected sensor model, and optional edited actor or ego trajectory.
- Output: rendered RGB images from novel camera viewpoints.
- Output: rendered LiDAR point clouds with range, intensity, and ray-drop behavior.
- Intermediate output: optimized 3D Gaussians with position, covariance, opacity, color/features, sensor appearance embeddings, and actor assignment.
- Non-output: it does not directly produce ego pose estimates, loop closures, freespace grids, or semantic occupancy for a planner.

## Architecture or Pipeline

- Build a Gaussian scene graph with a static background and dynamic actor-local Gaussian sets.
- Compose actor Gaussians into the world frame at the requested time using actor poses and learnable offsets.
- For camera rendering, project Gaussians into image space, tile, sort by depth, rasterize RGB/features, apply rolling-shutter compensation, and decode view-dependent color.
- For LiDAR rendering, project Gaussians into azimuth, elevation, and range coordinates.
- Use LiDAR-aware tiling with fixed azimuth spans and vertical bins matched to the non-uniform diode pattern.
- Rasterize range and feature values on the LiDAR sampling grid, then decode intensity and ray-drop probability.
- Use custom CUDA kernels inherited from and extended beyond `gsplat` for real-time rendering.

## Training and Evaluation

- Evaluation covers PandaSet, Argoverse2, and nuScenes.
- Camera novel view synthesis is evaluated with PSNR, SSIM, LPIPS, render throughput, and training time.
- LiDAR rendering is evaluated with depth error, intensity error, ray-drop accuracy, Chamfer distance, and million-rays-per-second throughput.
- The paper reports state-of-the-art rendering quality across the tested automotive datasets.
- It reports up to about +2 PSNR for novel view synthesis and +3 PSNR for reconstruction, while rendering about an order of magnitude faster than NeRF-based baselines.
- The public repository currently provides the rendering components; the full SplatAD model, dataloading, and decoders are expected through `neurad-studio` according to the official README.
- Results should be interpreted as rendering and simulation quality, not perception accuracy.

## Strengths

- Brings LiDAR into a 3DGS rendering pipeline instead of approximating a 360-degree LiDAR as multiple depth cameras.
- Models sensor effects that matter in vehicle logs: rolling shutter, LiDAR intensity, and missing returns.
- Supports trajectory and actor edits for scenario simulation from real collected logs.
- Faster than NeRF-style sensor simulation, making large-scale replay and perturbation testing more practical.
- Can help perception validation by producing paired camera and LiDAR observations from a consistent scene representation.
- Useful for mapping QA because rendered views expose geometry, calibration, and actor-track inconsistencies.

## Failure Modes

- Rendering quality depends on accurate sensor calibration, timestamping, ego poses, and actor tracks.
- Actor-box decomposition can fail for articulated or deformable airside equipment such as belt loaders, jet bridges, baggage-cart trains, and tow bars.
- Reflective aircraft skins, wet pavement, glass terminal facades, and retroreflective markings can break simple learned appearance assumptions.
- Sparse LiDAR returns and ray-drop modeling may not capture rare materials or weather-induced attenuation without local data.
- Novel-view quality can degrade under large extrapolations outside the logged trajectory distribution.
- Because it is not a SLAM backend, using it as the source of truth for pose or map consistency would be a category error.

## Airside AV Fit

- Strong fit for airside simulation, sensor replay, digital twins, perception regression tests, and counterfactual scenario generation.
- Valuable for testing camera-plus-LiDAR stacks around aircraft, GSE, personnel, cones, chocks, and gate infrastructure.
- Useful for creating controlled perturbations: slight ego trajectory shifts, changed GSE placement, or alternative actor motion.
- Less suitable as the online localization or obstacle-detection core for a safety case.
- Airside deployment would need local training logs covering floodlights, night operations, rain, de-icing spray, wet concrete, and reflective aircraft.
- Best paired with production perception pages such as [Sensor Fusion Architectures](../overview/sensor-fusion-architectures.md) and [Production Perception Systems](../overview/production-perception-systems.md).

## Implementation Notes

- Treat SplatAD artifacts as simulation assets with versioned calibration, pose, and actor-track dependencies.
- Keep LiDAR beam model, vertical angle table, azimuth timing, and rolling-shutter timing per sensor SKU.
- Validate camera and LiDAR renders separately; a good RGB render does not guarantee realistic point-cloud dropout or intensity.
- Do not feed rendered data into safety-critical evaluation without domain-randomization and real-log holdout checks.
- Preserve the distinction between map optimization for rendering and pose optimization for localization.
- If using the public repository, budget for custom CUDA build and integration work around `gsplat`.
- For airside use, add scenario metadata so generated renders can be traced back to gate, weather, aircraft type, and operation phase.

## Sources

- CVPR 2025 paper page: https://openaccess.thecvf.com/content/CVPR2025/html/Hess_SplatAD_Real-Time_Lidar_and_Camera_Rendering_with_3D_Gaussian_Splatting_CVPR_2025_paper.html
- CVPR 2025 paper PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Hess_SplatAD_Real-Time_Lidar_and_Camera_Rendering_with_3D_Gaussian_Splatting_CVPR_2025_paper.pdf
- Official project page: https://research.zenseact.com/publications/splatad/
- Official repository: https://github.com/carlinds/splatad
- 3D Gaussian Splatting foundation paper: https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
