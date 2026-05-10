# Object-Level SLAM

<!-- method-priority:start
priority:
  learning: 4
  deployment: 3
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "fallback", "gnss-denied", "indoor", "validation"]
  reason: "Object-Level SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use."
method-priority:end -->

## Executive Summary

Object-level SLAM represents objects as map entities with pose, class, size, shape, and sometimes motion, rather than treating the world only as points, voxels, surfels, or grid cells. It can make maps more compact, human-readable, and useful for planning and interaction. Important examples include SLAM++, CubeSLAM, QuadricSLAM, Fusion++, MaskFusion, MID-Fusion, and DSP-SLAM.

For AV and airside use, object-level SLAM is production-useful as an aid for semantic map QA, landmark-based loop closure, movable-object reasoning, object inventory, and change detection. It is generally research-stage as primary localization because it depends on detection, instance association, shape priors, and assumptions about object rigidity and persistence. Production pose should remain tied to robust metric localization and state estimation.

## Repo Cross-Links

| Related area | Link | Why it matters |
|---|---|---|
| Semantic map family | [Semantic SLAM](semantic-slam.md) | Object-level SLAM is an instance-centric semantic SLAM subfamily. |
| Dynamic scenes | [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md) | Objects can be tracked as dynamic entities instead of discarded. |
| Sparse visual SLAM | [ORB-SLAM2/ORB-SLAM3](orb-slam2-orb-slam3.md) | Many object-level systems extend ORB-style tracking and bundle adjustment. |
| Factor graph backend | [Factor Graph / iSAM2 / GTSAM](factor-graph-isam2-gtsam.md) | Object landmarks naturally fit into graph optimization. |
| Production map localization | [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md) | Object landmarks should augment, not replace, scan-to-map localization. |
| Semantic map priors | [Semantic Mapping and Learned Priors](../maps/semantic-mapping-learned-priors.md) | Object shape and class priors are learned semantic priors. |
| Dense/neural maps | [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Future object maps may combine object-level structure with Gaussian/neural appearance. |

## Historical Context

SLAM++ introduced "SLAM at the level of objects" by recognizing known object models in RGB-D data and using them as persistent map nodes. This was a major conceptual shift: a map could consist of chairs, tables, monitors, and other object instances, not just low-level geometry.

Later systems relaxed or changed the assumptions:

- CubeSLAM used cuboid objects and monocular multi-view constraints to improve camera pose and object detection.
- QuadricSLAM represented objects as dual quadrics constrained by 2D detections, providing compact ellipsoid-like landmarks in a factor graph.
- Fusion++ built per-object TSDF reconstructions and stored objects in an optimizable 6-DoF pose graph.
- MaskFusion and MID-Fusion handled multiple recognized or arbitrary moving objects with RGB-D data.
- DSP-SLAM used deep shape priors to reconstruct dense foreground objects while maintaining sparse background landmarks.

The field keeps returning to the same tension: objects are semantically meaningful and compact, but object detection and data association are fragile. Geometry-only maps are less intelligent but more directly observable.

## Sensor Assumptions

Object-level SLAM commonly assumes one of these sensor configurations:

- RGB-D camera for dense object masks, depth fusion, and object TSDFs.
- Monocular camera with 2D detections, vanishing points, cuboid hypotheses, and bundle adjustment.
- Stereo camera for metric scale and stronger object triangulation.
- Stereo plus LiDAR for AV-scale object shape cues, as in DSP-SLAM-style KITTI experiments.
- Camera plus IMU for better motion prediction and scale.

Object-level SLAM also assumes:

- A detector or segmenter that can identify relevant object instances.
- A data association mechanism across frames and revisits.
- A geometric object model: CAD, cuboid, quadric, TSDF, SDF latent shape, mesh, or Gaussian object primitive.
- Rigid or approximately rigid objects.
- A policy for dynamic, moved, and disappeared objects.

For airside operations, the object taxonomy is unusual. Aircraft, jet bridges, tugs, belt loaders, buses, cones, chocks, fuel trucks, and baggage carts are not the same distribution as indoor chairs or KITTI cars.

## State/Map Representation

A generic object-level SLAM state is:

```text
Camera/vehicle poses:
  T_wb_k

Background:
  sparse points, planes, surfels, voxels, or submaps

Object landmarks:
  object_id
  class
  T_wo
  size / scale
  shape parameters
  semantic confidence
  dynamic state, optional
```

Different object representations:

| Method family | Object representation | Strength | Limitation |
|---|---|---|---|
| SLAM++ | Known CAD object instances | Strong recognition and relocalization | Requires known object models. |
| CubeSLAM | 3D cuboids | Good for vehicles/furniture and monocular constraints | Crude for non-box objects. |
| QuadricSLAM | Dual quadrics/ellipsoids | Compact and factor-graph friendly | Approximate shape, detection-sensitive. |
| Fusion++ | Per-object TSDF volumes | Dense object reconstruction | RGB-D range, compute, instance association. |
| DSP-SLAM | DeepSDF-like latent shape plus sparse background | Completes partial objects | Category prior and detector dependence. |
| Dynamic object SLAM | Per-object pose/motion plus object map | Handles moving instances | Hard multi-body data association. |

## Algorithm Pipeline

1. Run a base odometry or SLAM front end.
2. Detect or segment object instances in the current frame.
3. Estimate each object's 3D pose, size, shape, or bounding representation.
4. Associate detections with existing map objects or create new object landmarks.
5. Add object observations as graph factors or mapping updates.
6. Optimize camera poses, object poses, background landmarks, and sometimes shape codes.
7. Use objects for relocalization, loop closure, map compression, or task reasoning.
8. Handle object lifecycle: new, confirmed, moved, dynamic, disappeared, or deprecated.

Two integration patterns are common:

```text
Objects as landmarks:
  object observations constrain camera pose and map.

Objects as map products:
  camera pose comes from normal SLAM, objects are mapped afterward.
```

The first can improve localization but can also corrupt it. The second is safer for production.

## Formulation

Object-level SLAM can be written as a factor graph:

```text
X = {camera poses, background landmarks, object poses, object shapes}

X* = argmin_X
     sum reprojection residuals
   + sum odometry / IMU / loop residuals
   + sum object measurement residuals
   + sum shape / size / semantic priors
```

Examples of object residuals:

```text
2D box factor:
  predicted_box = project(object_model, T_wc, T_wo, shape)
  r_box = observed_box - predicted_box

mask factor:
  r_mask = silhouette_error(render(object_model), observed_mask)

quadric factor:
  observed 2D conic constrains projected dual quadric

cuboid factor:
  object cuboid edges align with image edges, vanishing points, and detections

shape prior:
  r_shape = ||latent_code|| or category-specific SDF prior residual
```

For production localization, the object factor should be robustly gated. A wrong object association is equivalent to a false loop closure: it can pull the trajectory into a plausible but wrong configuration.

## Failure Modes

- Detector false positives create phantom landmarks.
- Missed detections break object continuity.
- Instance association switches objects across frames.
- Partial occlusion causes wrong size, pose, or shape.
- Symmetric objects create ambiguous orientation.
- Cuboids/quadrics are too crude for irregular objects.
- Deep shape priors hallucinate plausible but wrong geometry.
- Dynamic or moved objects are incorrectly treated as persistent landmarks.
- Object class distribution changes across domains.
- Object factors become overconfident and corrupt camera pose.
- Runtime and dependency load are high for detector plus SLAM plus shape optimization.

## AV Relevance

Object-level SLAM is relevant to AVs because roads, yards, and airports contain meaningful object landmarks: poles, signs, barriers, cones, parked vehicles, aircraft, stand equipment, loading bridges, and terminal structures. Objects can support map QA and high-level reasoning better than raw point clouds.

Production-useful roles:

- Semantic inventory of mapped objects.
- Map-change detection for added, removed, or moved assets.
- Landmark candidates for relocalization, after geometric verification.
- Object-level QA for HD-map and operational maps.
- Dynamic/movable object layers for planning and scene understanding.

Primary localization risk:

- The object detector becomes part of the localization chain.
- Object layout changes often.
- Similar objects cause aliasing.
- Large movable objects can dominate the pose estimate.

For AVs, object-level constraints should usually be secondary factors or map QA outputs, not the highest-trust pose source.

## Indoor/Outdoor Relevance

Indoors, object-level SLAM is intuitive and often useful. RGB-D depth is reliable at short range, objects are close, and classes such as chairs, tables, monitors, doors, and shelves are semantically meaningful. Object maps help manipulation, AR, inventory, and human-robot interaction.

Outdoors, object-level SLAM is harder. Objects are farther away, partially observed, more dynamic, and more domain-specific. Cuboids work for vehicles but poorly for irregular infrastructure. LiDAR and multi-camera systems help, but shape, association, and persistence remain difficult.

Airside environments have many large, movable, operational objects. Object-level mapping is valuable for operations and QA, but unsafe as the sole localization source unless constrained by a validated static map and strict object lifecycle policy.

## Airside Deployment Notes

Airside object-level SLAM should distinguish object categories by map persistence:

- Persistent landmarks: poles, fixed signs, blast fences, terminal walls, fixed stand equipment.
- Semi-persistent assets: jet bridges, ULD racks, barriers, cones in maintained zones.
- Operational dynamic objects: aircraft, tugs, belt loaders, buses, fuel trucks, catering trucks, baggage carts, crew.
- Small safety objects: chocks, cones, FOD-like items, tools.

Deployment guidance:

- Do not use aircraft or parked GSE as static localization landmarks without explicit operational policy.
- Use object maps to flag changes and support planning, not to replace scan-to-map pose.
- Require geometric verification before object-based loop closures.
- Maintain per-object evidence over multiple sessions before promotion to the static map.
- Use surveyed infrastructure as object landmarks where possible.
- Treat object-level maps as a separate semantic layer over the metric HD map.

The highest-value airside applications are inventory, map maintenance, stand QA, temporary-object detection, and human-readable scene summaries.

## Datasets/Metrics

Relevant datasets:

- TUM RGB-D: indoor trajectory and dynamic sequences.
- SUN RGB-D: 3D object detection/cuboid context.
- KITTI Odometry and KITTI object detection: outdoor vehicle-scale object and odometry evaluation.
- YCB-Video and YCB object datasets: object reconstruction and pose references.
- Redwood-OS and Freiburg object sequences: object reconstruction and DSP-SLAM-style evaluation.
- ScanNet and Replica: indoor dense semantic/object mapping.
- Custom airside object dataset: required for aircraft/GSE/stand taxonomy.

Metrics:

- ATE and RPE for camera/vehicle trajectory.
- Object pose error in translation, rotation, and scale.
- 3D IoU for cuboids or object volumes.
- ADD/ADD-S style object pose metrics for known objects.
- Chamfer distance, F-score, or mesh accuracy for reconstructed objects.
- Instance association precision/recall.
- Loop-closure precision from object landmarks.
- Map inventory precision/recall by object class.
- False promotion of movable objects into the static map.

For AVs, report both pose and map-object metrics. A method can reconstruct objects well while degrading localization, or improve trajectory on one dataset while creating unsafe persistent object maps.

## Open-Source Implementations

- `shichaoy/cube_slam`: CubeSLAM code for monocular 3D object detection and object SLAM.
- `qcr/quadricslam`: QuadricSLAM demonstrations using quadrics as landmarks.
- `smartroboticslab/mid-fusion`: object-level multi-instance dynamic RGB-D SLAM.
- `martinruenz/maskfusion`: object-aware semantic and dynamic RGB-D SLAM.
- `JingwenWang95/DSP-SLAM`: 3DV 2021 object-oriented SLAM with deep shape priors, GPL-3.0 due ORB-SLAM2 lineage.
- Fusion++ paper and code references exist, but dependency state and maintenance should be checked before reuse.

Most object-level systems are research prototypes. For production, reusing concepts is usually safer than embedding the full research stack.

## Practical Recommendation

Use object-level SLAM for semantic map products and secondary constraints. Do not make object detection the primary localization authority in a safety-critical AV.

For airside work:

1. Start with a robust metric map and scan-to-map localization stack.
2. Add object extraction as a map QA and operations layer.
3. Use persistent infrastructure objects as optional landmarks only after cross-session validation.
4. Keep aircraft and GSE in movable/dynamic layers by default.
5. Use object-level loop closures only with geometric and zone verification.

Object-level SLAM is production-useful as an aid for map interpretation, QA, and change detection. It remains research-stage as primary localization.

## Sources

- Salas-Moreno, Renato F., Richard A. Newcombe, Hauke Strasdat, Paul H. J. Kelly, and Andrew J. Davison. "SLAM++: Simultaneous Localisation and Mapping at the Level of Objects." CVPR 2013. https://openaccess.thecvf.com/content_cvpr_2013/html/Salas-Moreno_SLAM_Simultaneous_Localisation_2013_CVPR_paper.html
- Yang, Shichao, and Sebastian Scherer. "CubeSLAM: Monocular 3D Object SLAM." IEEE T-RO 2019. https://arxiv.org/abs/1806.00557
- CubeSLAM repository. https://github.com/shichaoy/cube_slam
- Nicholson, Lachlan, Michael Milford, and Niko Suenderhauf. "QuadricSLAM: Dual Quadrics from Object Detections as Landmarks in Object-oriented SLAM." RA-L 2018. https://arxiv.org/abs/1804.04011
- QuadricSLAM repository. https://github.com/qcr/quadricslam
- McCormac, John, Ronald Clark, Michael Bloesch, Andrew J. Davison, and Stefan Leutenegger. "Fusion++: Volumetric Object-Level SLAM." 3DV 2018. https://arxiv.org/abs/1808.08378
- Wang, Jingwen, Martin Runz, and Lourdes Agapito. "DSP-SLAM: Object Oriented SLAM with Deep Shape Priors." 3DV 2021. https://arxiv.org/abs/2108.09481
- DSP-SLAM repository. https://github.com/JingwenWang95/DSP-SLAM
- Xu et al. "MID-Fusion: Octree-based Object-Level Multi-Instance Dynamic SLAM." ICRA 2019. https://arxiv.org/abs/1812.07976
- Local context: [Semantic Mapping and Learned Priors](../maps/semantic-mapping-learned-priors.md)
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
