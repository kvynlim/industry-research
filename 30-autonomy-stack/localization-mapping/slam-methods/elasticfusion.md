# ElasticFusion

<!-- method-priority:start
priority:
  learning: 4
  deployment: 3
  type: "architecture-pattern"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "fallback", "gnss-denied", "indoor", "validation"]
  reason: "ElasticFusion is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use."
method-priority:end -->

## Executive Summary

ElasticFusion is a dense RGB-D SLAM system that builds a surfel map and maintains global consistency through non-rigid map deformation rather than a conventional pose graph. It performs dense frame-to-model tracking, fuses observations into an active surfel model, detects revisits, and deforms the map to close loops while continuing online operation.

Its indoor value is high for room-scale and medium-scale RGB-D reconstruction. Compared with [KinectFusion](kinectfusion.md), it avoids a fixed TSDF volume and can revisit areas with frequent local loop closure. Compared with pose-graph RGB-D systems, it is map-centric: the dense surface is the optimized object, not just a byproduct of optimized keyframe poses.

Its transfer to outdoor AV localization is limited. ElasticFusion assumes a handheld or robot-mounted RGB-D camera, short-range dense depth, mostly static indoor scenes, and GPU rendering. It does not provide a production safety estimator, lidar/GNSS/IMU fusion, weather robustness, certified uncertainty, or bounded correction behavior for vehicle control. It remains valuable as a reference for surfel maps, render-based alignment, map deformation, and dense correspondence. For Gaussian successors with explicit rasterizable primitives, see [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/overview/gaussian-splatting-driving.md).

## Historical Context

ElasticFusion was introduced at RSS 2015 as "Dense SLAM Without A Pose Graph" by Whelan, Leutenegger, Salas-Moreno, Glocker, and Davison, and later extended in an IJRR 2016 article on real-time dense SLAM and light source estimation. It sits between the fixed-volume TSDF era and modern neural/Gaussian mapping.

The method responded to a practical problem in KinectFusion-style scanning. TSDF fusion gave high-quality local surfaces, but global drift was hard to correct once frames had been fused. Pose graph RGB-D SLAM could optimize camera poses, but dense surfaces often remained inconsistent unless the system reprocessed or reintegrated old frames. ElasticFusion instead made the surfel map deformable. Loop closure becomes a surface alignment and deformation problem.

ElasticFusion influenced dense semantic mapping as well. SemanticFusion used ElasticFusion's dense, temporally consistent surfel map to accumulate CNN semantic predictions over time. SuMa later transferred surfel mapping ideas to rotating 3D lidar. This makes ElasticFusion a key bridge from indoor RGB-D dense mapping to outdoor surfel-based SLAM and modern dense map maintenance.

## Sensor Assumptions

ElasticFusion assumes an RGB-D camera with synchronized color and depth, calibrated intrinsics, and a rigid depth-to-color relationship. It uses depth for geometric tracking and color for photometric tracking, loop constraints, and surfel coloring. The input is an organized depth image, so projective association and GPU index maps are central to performance.

Operational assumptions:

- Short-range depth is dense enough for frame-to-model tracking.
- The camera motion is smooth enough for iterative tracking to converge.
- The scene is mostly static; moving objects are not the dominant geometry.
- Surfaces are Lambertian enough for photometric residuals to be useful.
- Depth and RGB timestamps are aligned.
- GPU/OpenGL/CUDA-style rendering resources are available.

The method can tolerate some texture weakness because geometry is dense, and it can tolerate some geometric weakness because RGB residuals help tracking. It still struggles when both geometry and appearance are ambiguous, such as long blank corridors, smooth hangar walls with little depth structure, or open concrete aprons.

## State/Map Representation

The map is a surfel model. A surfel is a local surface element with position, normal, color, confidence, radius, timestamp, and stability information:

```text
surfel = {
  position,
  normal,
  color,
  radius,
  confidence,
  last_seen_time,
  initialization_time
}
```

ElasticFusion divides the model into active and inactive parts. Recently visible surfels form the active model used for tracking and fusion. Older surfels can become inactive, reducing the online working set while preserving global map structure for loop closure and deformation.

Global consistency is handled by a deformation graph. Graph nodes carry local rigid transformations that influence nearby surfels. When loop closure constraints indicate that two surface regions should align, the deformation graph warps the map so those regions become consistent while preserving local rigidity. This differs from a pose graph, where the primary state is a set of camera poses and the map is reconstructed afterward.

The system still tracks a current camera pose, but the long-lived representation is the deformable dense surfel map.

## Algorithm Pipeline

1. Acquire synchronized RGB-D frames.
2. Build live vertex, normal, and color maps from the incoming depth/RGB pair.
3. Render the active surfel model from the predicted camera pose into index, vertex, normal, and color maps.
4. Track the camera by minimizing geometric point-to-plane residuals and photometric residuals against the rendered model.
5. Fuse the new RGB-D observation into the active surfel map.
6. Update surfel confidence, radius, normal, color, and visibility timestamps.
7. Move surfels between active and inactive sets based on visibility and age.
8. Detect local loop closures through model-to-model alignment when revisiting nearby map regions.
9. Detect larger loop closures using visual/place-recognition style cues and dense verification.
10. Build a deformation graph over the relevant surfels.
11. Optimize deformation graph node transforms using loop constraints and regularization.
12. Apply the deformation to surfels and continue tracking against the corrected map.

The core design goal is to keep the map near a globally consistent mode through frequent small corrections rather than waiting for a large pose-graph optimization pass.

## Formulation

The tracking objective combines geometry and color:

```text
E_track(T) = E_icp(T) + lambda_rgb * E_rgb(T)

E_icp = sum_i rho( n_i^T * (T * p_i - q_i) )^2
E_rgb = sum_j rho( I_live(j) - I_model(project(T * p_j)) )^2
```

`p_i` are live depth vertices, `q_i` and `n_i` come from the rendered surfel model, and `T` is the live camera pose. Correspondences are projective and depend on the current pose estimate.

The deformation graph objective is conceptually:

```text
E_deform = E_loop + lambda_reg * E_as_rigid_as_possible + lambda_pin * E_pinning
```

Loop terms pull matched source and target surface regions together. Regularization keeps neighboring deformation nodes locally coherent. Pinning or stability terms prevent unconstrained parts of the map from drifting. After optimization, each surfel is transformed by a weighted blend of nearby deformation nodes.

The important formulation difference from pose graph SLAM is that the optimized variables are local map deformations, not only camera poses. That allows the dense map itself to remain usable after correction without rebuilding from all historical frames.

## Failure Modes

- Wrong loop closures can non-rigidly warp the map into a plausible but false shape.
- Dynamic objects fused into the surfel map create ghosts and can attract later alignment.
- Repetitive rooms, corridors, gates, baggage belts, or aircraft stand layouts can confuse loop recognition.
- Low geometric structure and low visual texture together produce weak tracking.
- Reflective, transparent, black, wet, or sunlight-exposed surfaces degrade depth and color residuals.
- Large fast camera motion can exceed the convergence basin of frame-to-model tracking.
- Non-rigid deformation can hide accumulated error instead of exposing it as a trajectory inconsistency.
- GPU rendering and older code dependencies complicate production integration.
- There is no full multi-sensor state estimator with IMU, wheel odometry, GNSS, map priors, and health monitoring.
- The surfel map is dense and useful for visualization, but it is not an occupancy or safety map by itself.

## AV Relevance

ElasticFusion is relevant to AVs as a dense map-maintenance concept. Surfels are explicit, local, updateable surface primitives. They can carry color, normals, confidence, semantics, age, and stability. Those attributes are useful for deciding what parts of a map are persistent infrastructure and what parts are likely transient clutter.

It is not appropriate as the authoritative AV localization backbone. AVs require long-range lidar/radar/camera perception, weather robustness, tight inertial fusion, deterministic failure monitoring, and safe handling of map corrections. ElasticFusion's non-rigid map deformation is powerful for reconstruction but problematic if pose output is consumed directly by a controller.

The most useful transferable ideas are:

- Dense surfel map as a registration target.
- Active/inactive map management.
- Tracking with combined geometric and photometric residuals.
- Map deformation for dense loop correction.
- Per-surfel confidence and temporal stability.
- Semantic accumulation over a dense map, as demonstrated by SemanticFusion.

## Indoor/Outdoor Relevance

Indoor relevance is high. ElasticFusion was designed for RGB-D cameras in rooms and indoor workspaces. It performs well when surfaces are within depth range, lighting is manageable, and the operator revisits areas with loopy motion. It is especially useful for dense semantic mapping, AR, inspection, and scanning.

Outdoor relevance is low to moderate only in constrained near-field scenes. RGB-D depth does not scale to open outdoor driving distances, and consumer active depth is unreliable in sunlight. Outdoor vehicle motion is faster, the scene is more dynamic, and long-range localization needs global anchors. A surfel representation can transfer outdoors when the sensor is lidar, as in SuMa-style systems, but ElasticFusion itself is RGB-D and indoor-oriented.

For indoor-outdoor transitions, treat ElasticFusion output as a local dense map layer. Do not expect it to bridge from a terminal interior to an open apron without external pose support.

## Airside Deployment Notes

Potential airside uses:

- Dense scanning of hangars, workshops, terminal service areas, baggage rooms, and jet bridge interiors.
- Semantic mapping experiments where surfels accumulate labels for fixed indoor infrastructure.
- Map QA overlays showing surface changes over time.
- Training data generation for indoor robot perception.

High-risk airside uses:

- Primary apron localization.
- Near-aircraft control based on deformed map pose.
- Outdoor scanning in direct sun, rain, spray, glycol contamination, or dust.
- Static map updates in areas dominated by parked aircraft and ground service equipment.

An airside deployment would need an external estimator for pose, explicit dynamic-object segmentation, map-change controls, and a rule that dense map corrections cannot produce unbounded pose jumps in the vehicle navigation frame. For operational localization, compare against lidar-inertial and graph-SLAM methods in [Open-Source SLAM Stack Comparison](open-source-stack-comparison.md) and [AV Indoor/Outdoor SLAM Decision Matrix](av-indoor-outdoor-decision-matrix.md).

## Datasets/Metrics

ElasticFusion is commonly evaluated on indoor RGB-D datasets:

- TUM RGB-D for camera trajectory error and tracking robustness.
- ICL-NUIM for synthetic trajectory and geometry ground truth.
- Room-scale live Kinect-style scans for qualitative reconstruction.
- Co-Fusion and dynamic RGB-D captures when testing moving-object robustness.

Useful metrics:

- ATE/APE and RPE for trajectory error.
- Tracking success rate and number of relocalization or loop correction events.
- Reconstruction accuracy, completeness, Chamfer distance, F-score, and normal consistency.
- Loop-closure precision and false-deformation rate.
- Surface ghosting around dynamic objects.
- Runtime per frame, GPU memory, and map size.
- Stability and age distribution of surfels.

For airside indoor testing, add repeated stand/door geometry, moving equipment, reflective aircraft or tool surfaces, harsh lighting, and long low-texture corridors.

## Open-Source Implementations

- `mp3guy/ElasticFusion`: original research implementation for real-time dense visual SLAM with RGB-D input. It is the primary codebase to study.
- ROS/community wrappers exist, but they vary in maintenance quality and should be audited before use.
- SemanticFusion used ElasticFusion as the dense map backbone for semantic label fusion.
- `mp3guy/Kintinuous` is the earlier spatially extended KinectFusion lineage and is useful for understanding the evolution into ElasticFusion.

The original codebase is research software with GPU and graphics dependencies. Treat license, build environment, sensor drivers, and CUDA/OpenGL compatibility as integration risks.

## Practical Recommendation

Use ElasticFusion when the goal is to understand or prototype surfel-based dense RGB-D mapping, not when the goal is production vehicle localization. It is a strong baseline for indoor dense reconstruction and semantic map accumulation, and it is historically important for map-centric loop closure.

For practical indoor robots, [RTAB-Map](rtab-map.md) is usually easier to deploy and maintain. For highest-quality scanning, [BundleFusion](bundlefusion.md) is a stronger global reconstruction reference. For future dense map research, compare surfels against neural SDF methods such as [NICE-SLAM](nice-slam.md), [Co-SLAM and ESLAM](co-slam-eslam.md), and Gaussian representations in [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/overview/gaussian-splatting-driving.md).

## Sources

- Whelan et al., "ElasticFusion: Dense SLAM Without A Pose Graph," RSS 2015. https://www.roboticsproceedings.org/rss11/p01.pdf
- Whelan et al., "ElasticFusion: Real-time dense SLAM and light source estimation," IJRR 2016. https://doi.org/10.1177/0278364916669237
- ElasticFusion repository. https://github.com/mp3guy/ElasticFusion
- ElasticFusion project page, Imperial Dyson Robotics Lab. https://www.imperial.ac.uk/dyson-robotics-lab/projects/elasticfusion/
- SemanticFusion paper. https://arxiv.org/abs/1609.05130
- Local context: [KinectFusion](kinectfusion.md)
- Local context: [BundleFusion](bundlefusion.md)
- Local context: [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/overview/gaussian-splatting-driving.md)
