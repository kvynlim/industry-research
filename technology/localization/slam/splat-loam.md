# Splat-LOAM: Gaussian Splatting LiDAR Odometry and Mapping

Related docs: [LOAM](loam.md), [CT-ICP](ct-icp.md), [KISS-ICP](kiss-icp.md), [FAST-LIO2](fast-lio-fast-lio2.md), [SLAM benchmarking](benchmarking-metrics-datasets.md), and [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md).

## Executive Summary

Splat-LOAM is a 2025 LiDAR odometry and mapping method that uses Gaussian primitives as the sole scene representation. Instead of maintaining a point-cloud map, voxel map, TSDF, surfel map, or neural implicit field, it builds a local 2D Gaussian-splatting representation and registers incoming LiDAR scans by rendering spherical range/normal/intensity-like images from that model.

The method is important because it bridges classical LiDAR odometry and recent Gaussian mapping. It keeps the physically measured geometry of LiDAR while adopting a compact, differentiable, renderable map. The paper reports competitive odometry and strong reconstruction metrics on datasets such as Newer College, Oxford Spires, Vision Benchmark in Rome, and Mai City, with modest GPU requirements compared with heavier neural mapping systems.

For AV and airside autonomy, Splat-LOAM is promising as a research map representation, but it is early-stage. The base method is LiDAR-only, lacks IMU integration, lacks loop closure, does not yet solve motion skewing, and the public README explicitly warns that car-like odometry configurations are still being ported. It is a candidate for evaluation, not a production localization stack.

## Historical Context

Classical LiDAR SLAM methods such as LOAM, LeGO-LOAM, CT-ICP, SuMa, KISS-ICP, and FAST-LIO2 typically maintain maps as point clouds, voxels, surfels, or local geometric features. These representations are simple and metric, but reconstruction quality, memory growth, and differentiable rendering are limited.

Neural implicit LiDAR mapping methods such as NeRF-LOAM and PIN-SLAM improved reconstruction and continuous map queries, but introduced training and runtime costs. Gaussian Splatting provided a middle ground: explicit primitives with differentiable rendering and much faster rasterization than NeRF-style volume rendering.

Splat-LOAM adapts Gaussian Splatting specifically to LiDAR. Its paper claims the first LiDAR odometry and mapping pipeline using 2D Gaussian primitives as the only scene representation. The method uses a custom tile-based rasterizer for spherical LiDAR images, letting LiDAR scans supervise Gaussian refinement without RGB cameras.

## Sensor Assumptions

Splat-LOAM assumes timestamped 3D LiDAR point clouds. Ground-truth or externally estimated poses can be supplied for mapping-only mode, but online odometry uses LiDAR scan registration against the Gaussian local model.

Key assumptions:

- The LiDAR provides enough points and field of view for spherical projection.
- Consecutive scans have sufficient overlap.
- Motion distortion is limited or externally handled; the paper lists pose/velocity estimation for motion compensation as future work.
- LiDAR intensity or reflectivity cues are useful when photometric LiDAR losses are enabled.
- Static geometry dominates the local scene.
- A CUDA-capable NVIDIA GPU is available.
- Calibration and timestamps are consistent enough for scan-to-model registration.

Unlike FAST-LIO2 or LIO-SAM, Splat-LOAM does not make an IMU a core part of the base estimator. That simplifies the method but makes fast vehicle motion, vibration, and scan deskewing harder.

## State/Map Representation

The state is a sequence of LiDAR poses. The public code supports dataset readers and trajectory readers in formats such as KITTI, TUM, and VILENS, but the estimator itself is not a full multi-sensor factor graph.

The map is a local model made of 2D Gaussian primitives. Each primitive behaves like a surface-oriented splat rather than a volumetric blob. The map can be rasterized into spherical LiDAR views, including rendered depth/range and normal information. The rendered products are used both for tracking and for reconstruction evaluation.

Outputs include:

- Estimated trajectory.
- Gaussian local map.
- Rendered depth and normal maps.
- Optional mesh extracted from the SLAM output, typically by sampling rendered maps and applying Poisson reconstruction.

The representation is attractive for map compression and surface reconstruction, but it is not directly an occupancy grid, HD lane map, or safety validation layer.

## Algorithm Pipeline

1. **Dataset ingestion**
   - Read timestamped point clouds from supported dataset formats.
   - Optionally read poses for mapping-only or evaluation.

2. **Spherical projection**
   - Convert LiDAR point clouds into spherical image-like measurements.
   - Preserve range/depth and optional LiDAR photometric cues.

3. **Gaussian local-model rendering**
   - Rasterize the current 2D Gaussian map into a spherical view.
   - Produce rendered depth/range, normals, and diagnostic maps.

4. **Tracking**
   - Register the incoming scan to the rendered Gaussian model.
   - Combine geometric and photometric LiDAR residuals when configured.
   - Estimate the current LiDAR pose.

5. **Mapping**
   - Update Gaussian primitives using LiDAR measurement residuals.
   - Densify, prune, or refine primitives as needed.
   - Maintain the local model for subsequent frames.

6. **Mesh extraction**
   - Render range and normal maps from keyframes.
   - Sample points and reconstruct a mesh, for example using Poisson reconstruction.

7. **Evaluation**
   - Compute odometry RPE when reference trajectories are available.
   - Compute reconstruction accuracy, completeness, Chamfer-L1, and F-score against reference point clouds.

## Formulation

The core mapping objective compares LiDAR measurements to spherical renderings of the Gaussian model:

```text
M* = arg min_M sum_k [ L_geo(R(M, T_k), Z_k)
                    + lambda_i * L_photo(R_i(M, T_k), I_k)
                    + regularization(M) ]
```

where `M` is the 2D Gaussian map, `T_k` is the LiDAR pose for scan `k`, `Z_k` is the measured range/depth image after spherical projection, and `I_k` is an optional intensity-like LiDAR image.

Tracking estimates the pose by matching a new measurement to the rendered local model:

```text
T_k* = arg min_T L_geo(R_depth(M, T), Z_k)
             + lambda_n * L_normal(R_normal(M, T), N_k)
             + lambda_i * L_photo(R_intensity(M, T), I_k)
```

The paper reports that combining geometric and photometric terms improves tracking. Unlike point-to-plane ICP, correspondences are mediated through differentiable rendering of the Gaussian local model.

The current formulation is local odometry and mapping. Loop closure, global pose-graph optimization, and velocity-aware deskewing are identified as future work.

## Failure Modes

- **Motion distortion:** Without integrated pose/velocity estimation for deskewing, fast vehicle motion can warp LiDAR scans.
- **No IMU:** Pitch/roll observability and high-rate propagation are weaker than in LIO methods.
- **No loop closure:** Long routes can accumulate drift and maps can remain globally inconsistent.
- **Dynamic objects:** Vehicles, pedestrians, aircraft, and GSE can become Gaussian map artifacts.
- **Open flat scenes:** Large aprons, roads, fields, and parking lots provide weak 3D constraints.
- **Spherical projection assumptions:** Unusual LiDAR scan patterns or multi-LiDAR rigs need careful adaptation.
- **GPU dependency:** The method is lightweight relative to some neural approaches, but it still requires CUDA.
- **Implementation maturity:** The public README notes that odometry configurations for car-like scenarios are still not fully ported.
- **Weather degradation:** LiDAR still degrades in dense fog, rain, snow, dust, and spray; the method does not add radar observability.

## AV Relevance

Splat-LOAM is relevant to AVs because it keeps LiDAR as the metric sensor while improving the map representation. Potential benefits include:

- Compact local surface maps.
- Differentiable map optimization.
- Rendered range/normal diagnostics.
- Mesh extraction for map QA and simulation.
- Stronger reconstruction quality than simple point accumulation.

Production gaps are significant:

- No built-in IMU, wheel, GNSS, radar, or HD-map factor.
- No global loop closure in the current paper.
- No explicit dynamic-object policy.
- No covariance, health monitoring, or safety envelope.
- Research-code maturity.

For AV research, compare Splat-LOAM against KISS-ICP, CT-ICP, FAST-LIO2, LIO-SAM, and PIN-SLAM. For production localization, use it as a mapping candidate or auxiliary surface representation, not as the main estimator.

## Indoor/Outdoor Relevance

**Indoor:** Suitable for high-detail indoor/outdoor campus and building-scale scans when LiDAR coverage is dense. Oxford Spires contains indoor/outdoor architectural structure that is especially relevant.

**Outdoor:** Stronger fit than camera-only Gaussian SLAM for metric outdoor geometry because LiDAR provides scale. The Vision Benchmark in Rome and Newer College evaluations show relevance to streets, campuses, vegetation, and urban detail.

**Airside-style open outdoor:** More difficult. A concrete apron has fewer vertical structures than urban datasets, and dynamic aircraft/GSE can dominate the scan. Radar or GNSS/wheel constraints are still needed.

## Airside Deployment Notes

Splat-LOAM is not currently a primary airside localization method, but it is worth evaluating for map construction and surface QA.

Airside considerations:

- Use LiDAR passes near terminal facades, poles, blast fences, light masts, stand equipment, and service-road curbs to improve observability.
- Avoid inserting aircraft and movable GSE into persistent Gaussian maps.
- Add IMU/wheel/GNSS constraints externally if collecting at vehicle speeds.
- Test wet concrete, rain, fog, de-icing spray, and dust directly; LiDAR-only evaluation in clear weather is insufficient.
- Treat mesh outputs as QA artifacts, not operational collision geometry until validated.
- Align maps to RTK/GCP control before use in any airside HD map process.

The strongest airside use is offline survey enrichment: create a compact Gaussian/mesh layer from LiDAR and compare it to point-cloud or voxel maps for reconstruction quality and storage.

## Datasets/Metrics

Datasets cited or supported by the Splat-LOAM ecosystem:

- **Newer College Dataset:** handheld indoor/outdoor campus LiDAR with survey-grade reference maps.
- **Oxford Spires:** handheld LiDAR sequences with survey-grade prior maps and indoor/outdoor architectural detail.
- **Vision Benchmark in Rome (VBR):** urban Rome sequences with OS1-64 and OS0-128 LiDARs, dynamic objects, and centimeter-level reference trajectories from LiDAR/IMU/RTK fusion.
- **Mai City:** synthetic car-like LiDAR sequences with mesh ground truth.

Metrics:

- Relative Pose Error for odometry, with deltas adapted to trajectory length.
- Reconstruction accuracy.
- Reconstruction completeness.
- Chamfer-L1.
- F-score, often at a fixed distance threshold.
- Runtime and GPU memory.
- Map primitive count and mesh extraction time.
- Sensitivity to geometric-only versus photometric-plus-geometric tracking.

For airside evaluation, add open-apron drift, repeated-stand map consistency, dynamic-object ghosting rate, weather buckets, and RTK/GCP residuals.

## Open-Source Implementations

- **rvp-group/Splat-LOAM:** official BSD-3-Clause repository. It includes configs, Docker/Pixi/Conda setup, a `run.py` entry point, dataset readers, Gaussian renderer, tracking/mapping modules, mesh extraction, odometry evaluation, and reconstruction evaluation.
- Supported dataset reader types listed in the repository include VBR, KITTI-style bins, Newer College, Oxford Spires, Oxford Spires with VILENS trajectory, and generic point-cloud formats.
- The implementation requires an NVIDIA CUDA-capable GPU and has been tested with CUDA 11.8 and 12.6.

The repository is a strong research starting point. Teams should budget engineering time for ROS2 integration, multi-sensor synchronization, vehicle-motion deskewing, and production diagnostics.

## Practical Recommendation

Evaluate Splat-LOAM as a promising Gaussian LiDAR mapping baseline. It is especially interesting if the project needs compact surface reconstruction or differentiable LiDAR map rendering.

Do not deploy it as-is for outdoor AV or airside localization. For production-oriented work, pair its map representation with an established LiDAR-inertial or radar-LiDAR-inertial estimator, add loop closure and map QA, and compare against conventional LIO baselines before adopting the Gaussian representation.

## Sources

- Giacomini, E., Di Giammarino, L., De Rebotti, L., Grisetti, G., and Oswald, M. R. "Splat-LOAM: Gaussian Splatting LiDAR Odometry and Mapping." arXiv, 2025. https://arxiv.org/abs/2503.17491
- Official Splat-LOAM repository. https://github.com/rvp-group/Splat-LOAM
- Newer College Dataset. https://ori-drs.github.io/newer-college-dataset/
- Oxford Spires Dataset. https://ori-drs.github.io/oxford_spires_dataset/
- Brizi, L. et al. "VBR: A Vision Benchmark in Rome." ICRA 2024. https://vbr-benchmark.github.io/
- Local context: [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md)

