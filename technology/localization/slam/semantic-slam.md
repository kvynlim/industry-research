# Semantic SLAM

## Executive Summary

Semantic SLAM augments geometric localization and mapping with class, instance, material, or scene-graph information. Instead of producing only points, surfels, voxels, meshes, poses, or occupancy, it tries to answer "what is this part of the map?" and sometimes uses those semantic labels to improve pose estimation, loop closure, dynamic filtering, and robot behavior.

For AV and airside deployments, semantic SLAM is production-useful as an aid: dynamic-object filtering, map QA, change detection, semantic HD-map layer maintenance, drivable-area validation, and scene understanding. It is usually research-stage as primary localization because semantic predictions are closed-set, detector-dependent, hard to calibrate, and vulnerable to domain shift. The pose backbone should remain explainable geometry and multi-sensor estimation, as described in [Production LiDAR Map Localization](../production-lidar-map-localization.md), [Robust State Estimation Multi-Sensor](../robust-state-estimation-multi-sensor.md), and the classical SLAM pages in this directory.

## Repo Cross-Links

| Related area | Link | Why it matters |
|---|---|---|
| SLAM family overview | [SLAM Method Library Overview](overview.md) | Places semantic SLAM in the broader odometry, SLAM, localization, and mapping taxonomy. |
| Learned mapping priors | [Semantic Mapping and Learned Priors](../semantic-mapping-learned-priors.md) | Semantic SLAM is one way learned priors become map layers and factors. |
| Dynamic scenes | [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md) | Semantic masks are often used to suppress moving or movable objects. |
| Object landmarks | [Object-Level SLAM](object-level-slam.md) | Object-level SLAM is a semantic SLAM subfamily that maps instances as landmarks. |
| Visual sparse SLAM | [ORB-SLAM2/ORB-SLAM3](orb-slam2-orb-slam3.md) | Many semantic visual SLAM systems extend ORB-SLAM2/3. |
| Dense/neural representations | [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md) | Gaussian and neural maps increasingly carry semantics, but remain research-stage for pose. |
| Production localization | [Production LiDAR Map Localization](../production-lidar-map-localization.md) | Semantic labels should support, not replace, bounded map-frame localization. |
| Metrics and datasets | [Benchmarking Metrics and Datasets](benchmarking-metrics-datasets.md) | Semantic SLAM needs both trajectory and map-understanding metrics. |

## Historical Context

Classical SLAM was geometric: estimate robot trajectory and map landmarks, grid cells, surfaces, or submaps. Semantic SLAM emerged when real-time dense RGB-D reconstruction and deep segmentation made it practical to fuse semantic labels into 3D maps. SemanticFusion is a key early dense example: it combined ElasticFusion with CNN predictions and probabilistically fused 2D semantic labels into a dense 3D map at interactive rates.

Semantic SLAM then split into several lines:

- Dense semantic mapping: surfels, voxels, TSDFs, meshes, or octrees with class probabilities.
- Semantic visual SLAM: ORB-SLAM-style tracking plus segmentation for feature filtering and semantic maps, as in DS-SLAM.
- Metric-semantic visual-inertial SLAM: Kimera-style pose, mesh, and semantic reconstruction.
- Object-level SLAM: SLAM++/CubeSLAM/QuadricSLAM/Fusion++/DSP-SLAM-style object landmarks and object maps.
- Panoptic/dynamic SLAM: instance segmentation and motion reasoning for maps that separate static background from dynamic agents.
- Neural and Gaussian semantic SLAM: semantic features attached to neural fields or 3D Gaussians.

The historical lesson is clear: semantics improves usefulness and map interpretation, but it does not automatically solve localization. It adds a perception model with its own domain shift, latency, false positives, and uncertainty.

## Sensor Assumptions

Semantic SLAM can use different sensor stacks:

- RGB-D camera: common in early dense indoor systems such as SemanticFusion, DS-SLAM, MaskFusion, and Fusion++.
- Monocular/stereo camera plus optional IMU: common in ORB-SLAM-derived semantic systems and Kimera-style VIO.
- LiDAR plus camera: common for AV-grade semantic mapping, where LiDAR geometry is fused with camera or LiDAR segmentation.
- LiDAR-only semantic SLAM: possible with LiDAR semantic segmentation networks, but class granularity and texture cues are limited.
- Multi-sensor AV stack: camera, LiDAR, radar, IMU, wheel odometry, and GNSS/RTK can all feed a metric-semantic map.

The semantic component assumes a trained segmentation, detection, panoptic, or open-vocabulary model. That model's taxonomy and training data become part of the SLAM system. If the model cannot reliably recognize aircraft stands, jet bridges, baggage carts, fuel trucks, cones, chocks, ground crew, and wet pavement, an airside semantic SLAM map can look precise while being semantically wrong.

## State/Map Representation

Semantic SLAM usually combines a geometric state with semantic variables:

```text
Trajectory state:
  T_0, T_1, ..., T_k

Metric map:
  points, surfels, voxels, TSDF, ESDF, mesh, occupancy, or submaps

Semantic state:
  per-element class probabilities
  per-object instance IDs
  dynamic/static probability
  optional scene-graph nodes and relations
```

Common map representations:

| Representation | Semantic payload | Strength | Limitation |
|---|---|---|---|
| Sparse landmarks | Class label per landmark or feature | Cheap, compatible with visual SLAM | Sparse and not directly useful for planning. |
| Occupancy/octree | Class probability per cell | Good for navigation and indoor robots | Can be memory-heavy or low resolution. |
| Surfels | Class distribution per surfel | Good dense RGB-D mapping | RGB-D range and outdoor sunlight limitations. |
| TSDF/mesh | Face/voxel semantic labels | Useful for inspection and planning | Updates and label fusion can be complex. |
| Objects | Pose, class, size, shape, instance ID | Compact and human-readable | Data association and detector dependence. |
| Scene graph | Places, objects, rooms/zones, relations | Strong high-level reasoning | Hard to validate for safety-critical pose. |
| Gaussians/neural fields | Per-primitive features or labels | High-fidelity rendering and QA | Immature uncertainty and compute profile. |

## Algorithm Pipeline

1. Run a geometric SLAM or odometry front end to estimate frame poses.
2. Run semantic perception on the current image, point cloud, or fused sensor packet.
3. Project semantic predictions into the current 3D frame using depth, stereo, LiDAR, or triangulation.
4. Associate predictions with existing map elements or instantiate new semantic elements.
5. Fuse labels probabilistically over time.
6. Use semantics to filter dynamic or low-trust features, if configured.
7. Optionally add semantic factors, object factors, or class-consistency costs to pose/map optimization.
8. Run local mapping, loop closure, and global optimization.
9. Export a metric-semantic map for planning, QA, change detection, or human review.

There are two different levels of semantic integration:

```text
Semantics after SLAM:
  estimate geometry first, attach labels later

Semantics inside SLAM:
  use labels/detections as factors, constraints, masks, or landmarks
```

The second is more powerful but riskier. Bad semantic predictions can directly corrupt pose.

## Formulation

A semantic map element can maintain a categorical distribution:

```text
p_i(c) = P(class = c for map element i)
```

A simple Bayesian fusion update is:

```text
logit p_i(c) <- logit p_i(c) + log P(z_t = c | class_i = c) - prior_term
```

For pose and map estimation, semantic SLAM can be written as a MAP problem:

```text
X*, M*, C* = argmin sum geometry residuals
                 + sum inertial / odometry / loop residuals
                 + sum semantic residuals
                 + sum object or scene-graph priors
```

Examples:

```text
feature mask:
  w_j = P(static | semantic_j, motion_j)
  cost = sum_j w_j * rho(reprojection_or_scan_residual_j)

semantic map fusion:
  p_i(c) proportional to p_i(c) * P(observed_label_t | c)

object semantic factor:
  residual links camera pose, object pose, detection box/mask, and class likelihood
```

Production systems should separate "semantic evidence" from "pose evidence" unless semantic reliability is validated. It is often safer to use semantics as a gate or weight than as a hard localization constraint.

## Failure Modes

- Closed-set labels miss target-domain classes.
- Detector or segmentation false positives create wrong landmarks or masks.
- Semantic labels are correlated with appearance and fail under night, glare, rain, snow, lens dirt, or sensor degradation.
- Projection errors from calibration or timing mistakes smear labels into the wrong 3D cells.
- Dynamic but currently stationary objects, such as parked service vehicles or aircraft, are hard to classify as map or non-map.
- Long-term semantic drift occurs when construction, seasonal equipment, or operational layouts change.
- Overconfident semantic factors can bias the pose graph.
- Instance data association fails when many similar objects appear.
- Compute latency causes semantic masks to be applied to the wrong frame.
- Map memory grows when every class distribution, feature vector, or instance is retained without lifecycle policy.

## AV Relevance

Semantic SLAM is highly relevant to AVs, but mostly around mapping and perception rather than primary pose. Production-useful roles include:

- Removing dynamic classes before scan matching.
- Maintaining semantic HD-map layers and change flags.
- Validating lane, curb, sign, pole, barrier, and drivable-area map content.
- Supporting route-level reasoning, such as "service road edge" or "stand boundary".
- Improving loop closure by rejecting semantically impossible matches.
- Generating QA artifacts for map operations teams.

As primary localization, semantic SLAM is risky. A detector can fail silently or confidently under domain shift. Geometry, inertial, wheel, GNSS, and scan-to-map residuals are easier to monitor and bound. Semantics should be used as a supporting signal with explicit fallbacks.

## Indoor/Outdoor Relevance

Indoors, semantic SLAM is mature enough for research prototypes, service robots, AR, inspection, and human-readable maps. RGB-D cameras work well at short range, and object categories such as chairs, desks, doors, and walls are common in public datasets. The strongest practical use is semantic mapping and task planning, not safety-critical global localization.

Outdoors, semantic SLAM is harder because of scale, weather, lighting, dynamic objects, long range, sparse returns, and map lifecycle. LiDAR geometry remains the robust backbone; semantic classes are useful for filtering and QA. AV-scale semantic SLAM must handle long-term changes, multiple sessions, and map versioning.

Airports sit between these worlds. Terminals and hangars resemble structured indoor/outdoor industrial spaces, while aprons are large outdoor dynamic scenes. A hybrid LiDAR-camera semantic mapping stack is more appropriate than camera-only semantic SLAM.

## Airside Deployment Notes

Airside semantic SLAM needs an airport-specific taxonomy:

- Static infrastructure: terminal walls, jet bridges, stands, poles, signs, barriers, markings, drains, service-road edges, blast fences.
- Movable but map-relevant assets: cones, chocks, temporary barriers, ULD racks, passenger stairs.
- Dynamic operational actors: aircraft, tugs, belt loaders, buses, fuel trucks, catering trucks, baggage carts, ground crew.
- Surface states: wet tarmac, snow/ice, paint markings, rubber deposits, FOD-like small objects.

Deployment guidance:

- Keep the localization backbone geometric and map-frame anchored.
- Use semantic masks to downweight dynamic or movable objects during map construction.
- Maintain separate static, movable, and dynamic map layers.
- Require cross-session evidence before promoting an object to the static map.
- Log semantic uncertainty, class confusion, and disagreement between camera and LiDAR labels.
- Validate semantic maps against surveyed HD-map layers and operations data.

Semantic SLAM is a strong aid for airside map maintenance and scene understanding. It is not the certified pose source.

## Datasets/Metrics

Relevant datasets:

- NYUv2: indoor RGB-D semantic segmentation and early SemanticFusion evaluation context.
- TUM RGB-D: trajectory evaluation, dynamic-object sequences, RGB-D SLAM baselines.
- ScanNet and Replica: dense indoor reconstruction and semantic mapping.
- Matterport3D and Gibson/Habitat-style datasets: larger indoor semantic mapping and navigation research.
- KITTI, SemanticKITTI, nuScenes, nuScenes-lidarseg, Waymo Open Dataset, SemanticPOSS: outdoor LiDAR/camera semantic and driving context.
- Custom airside data: required for aircraft/GSE/marking taxonomy and operational validity.

Metrics:

- ATE and RPE for trajectory.
- mIoU for semantic map labels.
- Panoptic quality for instance-aware maps.
- 3D semantic IoU by voxel, point, mesh face, surfel, or object.
- Map completeness, accuracy, and surface reconstruction quality.
- Dynamic-object false-static and false-dynamic rates.
- Loop-closure precision/recall with semantic constraints.
- Runtime latency, GPU memory, and map memory growth.
- Calibration sensitivity of projected labels.

For production, include task metrics: localization availability after dynamic masking, map-change detection precision/recall, and false map-edit rate.

## Open-Source Implementations

- Kimera and Kimera-Semantics: MIT-SPARK open-source metric-semantic visual-inertial SLAM and semantic reconstruction ecosystem.
- DS-SLAM: ORB-SLAM2-derived semantic visual SLAM for dynamic environments with semantic octree mapping.
- MaskFusion: object-aware semantic and dynamic RGB-D SLAM.
- MID-Fusion: object-level multi-instance dynamic RGB-D SLAM.
- RTAB-Map: practical robotics graph SLAM with RGB-D and semantic integration options in broader workflows.
- OpenMMLab, Detectron2, Segment Anything, MMSegmentation, and LiDAR segmentation stacks are perception components often paired with SLAM, not SLAM systems by themselves.

License review matters. Many visual SLAM derivatives inherit GPL terms from ORB-SLAM2/3 or include deep-learning dependencies with separate model licenses.

## Practical Recommendation

Use semantic SLAM to make maps more useful, not to make pose estimates magically safe. For airside AV work, the highest-value deployment path is:

1. Use validated LiDAR map localization and state estimation for primary pose.
2. Use semantic perception to filter dynamic/movable clutter before mapping and scan matching.
3. Fuse semantic labels into map QA layers with uncertainty and cross-session evidence.
4. Promote only stable, validated semantic elements into operational HD maps.
5. Keep semantic factors optional and conservatively weighted until target-domain failure rates are measured.

Semantic SLAM is production-useful as an aid for filtering, QA, and map maintenance. It is research-stage as primary localization.

## Sources

- McCormac, John, Ankur Handa, Andrew Davison, and Stefan Leutenegger. "SemanticFusion: Dense 3D Semantic Mapping with Convolutional Neural Networks." ICRA 2017. https://arxiv.org/abs/1609.05130
- Yu, Chao, Zuxin Liu, Xinjun Liu, Fugui Xie, Yi Yang, Qi Wei, and Qiao Fei. "DS-SLAM: A Semantic Visual SLAM towards Dynamic Environments." IROS 2018. https://arxiv.org/abs/1809.08379
- DS-SLAM official repository. https://github.com/ivipsourcecode/DS-SLAM
- Rosinol, Antoni, Marcus Abate, Yun Chang, and Luca Carlone. "Kimera: an Open-Source Library for Real-Time Metric-Semantic Localization and Mapping." https://arxiv.org/abs/1910.02490
- MIT-SPARK Kimera repository. https://github.com/MIT-SPARK/Kimera
- Runz, Martin, Maud Buffier, and Lourdes Agapito. "MaskFusion: Real-Time Recognition, Tracking and Reconstruction of Multiple Moving Objects." https://arxiv.org/abs/1804.09194
- Local context: [Semantic Mapping and Learned Priors](../semantic-mapping-learned-priors.md)
- Local context: [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md)
