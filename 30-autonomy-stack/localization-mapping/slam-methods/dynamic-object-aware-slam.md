# Dynamic-Object-Aware SLAM

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "Dynamic-Object-Aware SLAM is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

## Executive Summary

Dynamic-object-aware SLAM modifies odometry and mapping so moving or movable objects do not corrupt the estimated ego pose or static map. The core idea is simple: most SLAM systems assume a static world, but autonomous vehicles, indoor robots, and airside vehicles operate around people, cars, carts, aircraft, service equipment, doors, and temporary infrastructure. A robust system must decide which measurements belong to persistent map structure, which belong to dynamic actors, and which are uncertain.

For production AV and airside use, dynamic-object awareness is production-useful as an aid: it improves map cleanliness, scan matching, long-term localization, and change detection. It is research-stage as a primary localization method when implemented as a standalone semantic/dynamic SLAM stack. The production backbone should still be validated scan-to-map localization, LiDAR-inertial or wheel-inertial odometry, robust state estimation, and map lifecycle controls.

## Repo Cross-Links

| Related area | Link | Why it matters |
|---|---|---|
| Semantic SLAM | [Semantic SLAM](semantic-slam.md) | Dynamic filtering often uses semantic labels as priors. |
| Object-level maps | [Object-Level SLAM](object-level-slam.md) | Some systems track dynamic objects as separate map entities instead of discarding them. |
| Production map localization | [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md) | Dynamic clutter must be filtered before scan-to-map matching in operational systems. |
| Map maintenance | [HD Map Change Detection and Maintenance](../maps/hd-map-change-detection-maintenance.md) | Dynamic filtering and map-change detection are closely linked but not identical. |
| Classical LiDAR baselines | [KISS-ICP](kiss-icp.md), [GICP/VGICP](gicp-vgicp.md), [NDT](ndt.md) | Dynamic masks are most useful when they improve explainable scan matching. |
| LiDAR-inertial SLAM | [LIO-SAM](lio-sam.md), [FAST-LIO2](fast-lio-fast-lio2.md) | LIO front ends need dynamic filtering to avoid ghost maps in busy scenes. |
| Dense/neural maps | [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Neural/Gaussian maps need dynamic-scene handling before they can represent operational environments. |

## Historical Context

The static-world assumption has always been a weakness of SLAM. Early robust SLAM treated dynamic measurements as outliers. With RGB-D cameras and deep segmentation, systems such as DynaSLAM and DS-SLAM explicitly detected dynamic regions and removed or downweighted them. DynaSLAM extended ORB-SLAM2 with multi-view geometry, deep object detection, and background inpainting. DS-SLAM combined semantic segmentation with moving consistency checks and produced a dense semantic octree map.

Dense dynamic systems then moved beyond removal. MaskFusion, MID-Fusion, and EM-Fusion track and reconstruct multiple independently moving objects while maintaining a static background. In LiDAR mapping, dynamic object removal methods such as Removert and ERASOR focus on generating clean static point-cloud maps from scans contaminated by vehicles and pedestrians. RF-LIO-style methods integrate moving-object removal with LiDAR-inertial odometry.

The historical split is useful:

- Dynamic filtering for localization: remove bad measurements before pose estimation.
- Static map cleaning: remove transient objects from built maps.
- Dynamic object SLAM: estimate static background and moving object states together.
- Long-term mapping: decide whether changes are temporary, movable, or persistent.

Airside deployments need all four, but they should be implemented as separate layers with different safety implications.

## Sensor Assumptions

Dynamic-object-aware SLAM can be visual, RGB-D, LiDAR-only, LiDAR-inertial, or multi-modal:

- Monocular/stereo systems use 2D detection, segmentation, optical flow, epipolar consistency, and multi-view geometry.
- RGB-D systems use depth consistency, TSDF/surfel residuals, instance masks, and multi-body tracking.
- LiDAR systems use scan-to-map residuals, occupancy changes, ray clearing, range image motion cues, and LiDAR semantic segmentation.
- LiDAR-camera AV systems combine semantic segmentation with geometric residual checks.
- Radar can help identify moving actors via Doppler, but radar dynamic SLAM remains less mature.

The method must distinguish:

```text
static and persistent: terminal wall, pole, building, surveyed sign
movable but currently static: cone, cart, parked aircraft, belt loader
dynamic: moving tug, bus, passenger, aircraft, forklift
unknown: newly observed object without enough temporal evidence
```

That distinction is operational, not only geometric. A parked aircraft is static for a few minutes but should usually not become part of a long-term localization map.

## State/Map Representation

Dynamic-object-aware systems represent at least a static map and a dynamic mask:

```text
Ego state:
  T_k, velocity, IMU bias, wheel/vehicle state if available

Static map:
  points, voxels, surfels, TSDF, mesh, occupancy, or submaps

Dynamic state:
  per-measurement dynamic probability
  per-cell temporal occupancy evidence
  optional object tracks with pose, velocity, class, shape
```

Three common map models:

| Model | Representation | Use |
|---|---|---|
| Remove-only | Static map plus dynamic masks | Best for localization and map cleaning. |
| Layered map | Static, movable, dynamic, and unknown layers | Best for long-term deployments and map maintenance. |
| Multi-body map | Static background plus object-level dynamic maps | Best for RGB-D research and manipulation/AR, less common for AV production. |

For airside AVs, layered maps are the most practical. They allow a service vehicle to avoid treating aircraft/GSE as static localization structure while still preserving them for perception and planning.

## Algorithm Pipeline

1. Estimate a provisional ego motion using odometry, IMU, wheel, GNSS, or scan matching.
2. Predict where static map elements should appear in the current sensor frame.
3. Compute geometric residuals: reprojection, depth, scan-to-map distance, occupancy disagreement, or ray consistency.
4. Run semantic or instance perception if available.
5. Combine semantic priors and geometric residuals into dynamic probabilities.
6. Remove or downweight dynamic measurements for ego tracking.
7. Update the static map only with measurements that pass stability checks.
8. Optionally create or update dynamic object tracks and object maps.
9. Use temporal evidence across sessions to distinguish persistent changes from transient clutter.
10. Export diagnostics: dynamic ratio, static inliers, map-update decisions, and rejected regions.

For production localization, the key loop is:

```text
detect dynamic/movable points
  -> exclude/downweight them from scan-to-map matching
  -> estimate pose with robust geometry
  -> log disagreement for map maintenance
```

## Formulation

A common robust formulation weights each measurement by the probability that it belongs to the static world:

```text
cost(T) = sum_i w_i * rho(r_i(T))
w_i = P(static | semantic_i, motion_i, map_consistency_i)
```

For visual SLAM:

```text
r_i = reprojection_error(feature_i, T, landmark_i)
```

For LiDAR localization:

```text
r_i = point_to_plane_or_distribution_distance(T * p_i, static_map)
```

For occupancy-based dynamic removal:

```text
P(dynamic cell) increases when a cell is occupied in one observation
but contradicted by ray clearing or absent in repeated observations.
```

For multi-body dynamic SLAM:

```text
T_camera_k, T_object_m_k, map_static, map_object_m
```

are estimated jointly or alternately. Each moving object has its own SE(3) trajectory or motion model. This is powerful but much harder to certify than simply excluding dynamic measurements from ego localization.

## Failure Modes

- Stationary dynamic objects are promoted into the static map too quickly.
- Slowly moving objects are treated as static because frame-to-frame residuals are small.
- Semantic detectors miss target-domain objects or over-filter useful static structure.
- Ray-clearing falsely removes thin structures, glass, poles, fences, or distant sparse objects.
- Calibration or timing errors look like dynamic motion.
- Rolling-shutter, LiDAR motion distortion, or poor deskewing creates false dynamic residuals.
- Open-space degeneracy remains after dynamic filtering; removing points can make observability worse.
- Repeated revisits with the same parked object can make transient clutter look permanent.
- Dynamic masks add latency and may not align with the pose-estimation frame.
- Object-level trackers fail during occlusion and instance switches.

## AV Relevance

Dynamic-object awareness is essential for AV mapping and localization. Without it, maps accumulate ghost cars, pedestrians, carts, trucks, and aircraft; scan matchers can align to objects that are no longer there; and long-term localization becomes brittle.

Production-useful roles:

- Remove dynamic objects from survey maps.
- Downweight dynamic points during runtime scan-to-map localization.
- Separate map changes from transient traffic.
- Improve loop closure by preventing false matches to movable objects.
- Create negative examples for perception and localization testing.

Research-stage roles:

- Full dynamic SLAM where ego pose, static map, and all moving objects are jointly optimized online.
- Learned dynamic filtering used as the sole trust mechanism.
- Dense photorealistic dynamic maps without uncertainty and lifecycle policy.

For AVs, the most robust approach is layered and conservative: static-map localization for pose, dynamic perception for planning, and map maintenance logic for persistent changes.

## Indoor/Outdoor Relevance

Indoors, dynamic-object-aware RGB-D SLAM is mature as a research topic. People walking through TUM RGB-D sequences, movable chairs, doors, and handheld camera motion are well studied. RGB-D range limits and indoor lighting make dense reconstruction feasible.

Outdoors, LiDAR dynamic filtering is more relevant. Cars, cyclists, pedestrians, vegetation motion, construction equipment, and weather introduce large-scale nonstationarity. The map must be cleaned offline and guarded online.

Airside outdoor environments are especially dynamic but structured. Aircraft and GSE can be large enough to dominate a scan. Treating them as either always static or always dynamic is wrong; deployment needs a "movable infrastructure" layer and temporal evidence.

## Airside Deployment Notes

Airside dynamic-object-aware SLAM should explicitly model three time scales:

- Per-frame dynamics: moving tugs, buses, aircraft, ground crew.
- Operational-session changes: parked aircraft, GSE staging, cones, temporary barriers.
- Persistent map changes: construction, new markings, changed stand equipment, removed infrastructure.

Recommended deployment behavior:

- Exclude aircraft, GSE, buses, and people from the primary static localization map unless cross-session policy promotes them.
- Keep large movable objects in a separate dynamic/movable layer for planning and situational awareness.
- Use LiDAR ray consistency and multi-session evidence for map cleaning, not semantic labels alone.
- Use map-change detection to flag persistent differences, not to immediately change the localization map.
- Record the dynamic ratio and static inlier count as localization health metrics.
- Test around peak operations, night lighting, wet tarmac, parked aircraft, and terminal multipath.

The most dangerous failure is a confident scan match to a large movable object, such as a parked aircraft or bus, that was present in the map but absent or moved during operation.

## Datasets/Metrics

Relevant datasets:

- TUM RGB-D dynamic object sequences: visual/RGB-D dynamic SLAM trajectory evaluation.
- KITTI Odometry and raw sequences: outdoor LiDAR/vision with moving traffic.
- SemanticKITTI: point-wise semantic labels for dynamic/static class analysis.
- nuScenes and Waymo Open Dataset: AV-scale dynamic scenes and multi-sensor context.
- Apollo/urban LiDAR map datasets: useful for map cleaning and static map generation.
- Custom airside dynamic dataset: required for aircraft, GSE, and apron-specific behavior.

Metrics:

- ATE/RPE with and without dynamic filtering.
- Static map ghost rate and dynamic-object removal precision/recall.
- False removal rate for static infrastructure.
- Dynamic segmentation IoU or moving-object IoU.
- Scan-matching inlier ratio before/after filtering.
- Localization availability under dynamic clutter.
- Map completeness and accuracy after cleaning.
- Runtime latency and memory overhead.
- Long-term map stability across sessions.

Airside metrics:

- Pose error near parked/moving aircraft.
- Static inlier count after removing GSE and aircraft.
- False localization to movable objects.
- Persistent-change detection precision over AIRAC/survey cycles.
- Dynamic mask performance by class: tug, belt loader, bus, aircraft, crew, cone, chock.

## Open-Source Implementations

- `BertaBescos/DynaSLAM`: ORB-SLAM2-based visual dynamic SLAM with geometry/deep-learning dynamic detection and inpainting.
- `ivipsourcecode/DS-SLAM`: semantic visual SLAM for dynamic environments with semantic octree maps.
- `martinruenz/maskfusion`: real-time object-aware semantic/dynamic RGB-D SLAM.
- `smartroboticslab/mid-fusion`: object-level multi-instance dynamic RGB-D SLAM.
- `gisbi-kim/removert`: offline LiDAR moving-object removal for static point-cloud map construction.
- `LimHyungTae/ERASOR`: LiDAR dynamic object removal based on pseudo occupancy.
- RF-LIO and related LIO variants: research references for removal-first LiDAR-inertial odometry in highly dynamic scenes.

Most visual systems are research code with older dependencies and license constraints. LiDAR map-cleaning tools are often more directly useful for AV survey pipelines than full dynamic RGB-D SLAM stacks.

## Practical Recommendation

Use dynamic-object awareness in every serious mapping/localization pipeline, but keep the responsibilities narrow:

1. Use dynamic filtering to protect scan matching and map construction.
2. Maintain separate static, movable, and dynamic layers.
3. Require temporal and cross-session evidence before updating the static map.
4. Treat learned/semantic dynamic labels as aids, not ground truth.
5. Keep the pose backbone explainable, with residuals, covariance, and fallback behavior.

For airside AVs, dynamic-object-aware SLAM is production-useful as map cleaning, runtime masking, and change-detection support. Full dynamic SLAM as the primary localization stack remains research-stage.

## Sources

- Bescos, Berta, Jose M. Facil, Javier Civera, and Jose Neira. "DynaSLAM: Tracking, Mapping and Inpainting in Dynamic Scenes." RA-L/IROS 2018. https://arxiv.org/abs/1806.05620
- DynaSLAM repository. https://github.com/BertaBescos/DynaSLAM
- Yu et al. "DS-SLAM: A Semantic Visual SLAM towards Dynamic Environments." IROS 2018. https://arxiv.org/abs/1809.08379
- Runz, Martin, Maud Buffier, and Lourdes Agapito. "MaskFusion: Real-Time Recognition, Tracking and Reconstruction of Multiple Moving Objects." https://arxiv.org/abs/1804.09194
- MaskFusion repository. https://github.com/martinruenz/maskfusion
- Xu et al. "MID-Fusion: Octree-based Object-Level Multi-Instance Dynamic SLAM." ICRA 2019. https://arxiv.org/abs/1812.07976
- MID-Fusion repository. https://github.com/smartroboticslab/mid-fusion
- Lim, Hyungtae, Sungwon Hwang, and Hyun Myung. "ERASOR: Egocentric Ratio of Pseudo Occupancy-based Dynamic Object Removal for Static 3D Point Cloud Map Building." RA-L/ICRA 2021. https://arxiv.org/abs/2103.04316
- ERASOR repository. https://github.com/LimHyungTae/ERASOR
- Kim and Kim. "Remove, then Revert: Static Point cloud Map Construction using Multiresolution Range Images." IROS 2020, repository. https://github.com/gisbi-kim/removert
- Local context: [HD Map Change Detection and Maintenance](../maps/hd-map-change-detection-maintenance.md)
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
