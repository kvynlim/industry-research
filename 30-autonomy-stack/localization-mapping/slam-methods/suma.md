# SuMa

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "SuMa is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

## Executive Summary

SuMa, short for Surfel-based Mapping, is a dense 3D LiDAR SLAM method by Behley and Stachniss. It builds a surfel map from rotating 3D laser scans, renders synthetic model views from that map, and performs projective point-to-plane alignment between the current scan and the rendered map. It also includes loop-closure detection and pose-graph optimization to produce globally consistent maps.

SuMa is historically important because it brought dense surfel mapping ideas from RGB-D SLAM into large-scale outdoor LiDAR mapping and ran online on KITTI-scale data. It is less suitable as a modern production airside localization method because it assumes ordered rotating LiDAR scans, depends on GPU/OpenGL rendering, lacks tight IMU fusion, and predates current direct LIO front ends. Its surfel stability and semantic extension, SuMa++, are still useful ideas for map maintenance and dynamic-object filtering. For comparison with newer methods, see [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md), [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Historical Context

SuMa was published at Robotics: Science and Systems in 2018 as "Efficient Surfel-Based SLAM using 3D Laser Range Data in Urban Environments." It was developed at the University of Bonn by Jens Behley and Cyrill Stachniss.

The method was inspired by dense RGB-D systems such as ElasticFusion, but it targeted the harder setting of outdoor rotating LiDAR: sparse point clouds, large-scale maps, fast vehicle motion, and dynamic urban traffic. At the time, many 3D LiDAR systems used sparse features, voxelized maps, or point subsampling. SuMa argued for using a dense map representation that can still be rendered and matched efficiently.

SuMa++ later added semantic segmentation to filter moving objects and add semantic constraints, improving robustness in dynamic scenes such as KITTI highway sequences.

## Sensor Assumptions

SuMa assumes a rotating 3D laser scanner, with the repository explicitly mentioning Velodyne HDL-64E as the reference sensor. It expects ordered scan structure that can be projected into a spherical/range-image representation. Correct vertical field of view and scan-line count are important configuration parameters.

Unlike LIO methods, SuMa does not require an IMU in its core formulation. That makes it simpler as a LiDAR-only mapper, but it also means roll, pitch, yaw, and motion-distortion handling depend heavily on scan-to-map registration and the prior pose estimate. The method expects enough static scene structure for projective data association to be meaningful.

The implementation uses OpenGL for fast map rendering and visualization. A GPU-capable platform is therefore part of the practical sensor/compute assumption.

## State/Map Representation

The map is a surfel map. A surfel is a small local surface element, typically storing:

```text
surfel = {
  position,
  normal,
  radius or support size,
  confidence / stability,
  timestamps or visibility information
}
```

The map is maintained in a rolling grid and rendered from candidate sensor poses. Rendering the surfel map creates a synthetic view with vertex and normal information. The current LiDAR scan is also projected into a spherical image. Projective association then matches current scan pixels with rendered map pixels.

The trajectory is represented by poses and loop-closure constraints in a pose graph. The paper reports using GTSAM and Levenberg-Marquardt optimization for pose graph optimization. The optimized poses are integrated back into the surfel map to improve global consistency.

## Algorithm Pipeline

1. Load or receive a rotating LiDAR scan.
2. Project the scan into a spherical range image.
3. Render the current surfel map from the predicted pose to create a model view.
4. Use projective data association between the live scan and rendered model view.
5. Estimate the new pose with point-to-plane ICP.
6. Update surfels with new observations and stability estimates.
7. Maintain the rolling grid and GPU-resident map data.
8. Detect loop-closure candidates using a map-based criterion and virtual map views.
9. Verify loop closures through alignment checks.
10. Add loop constraints to a pose graph and optimize.
11. Update the map according to optimized poses.

The key idea is that rendering converts nearest-neighbor search into projective association. This is fast when the sensor viewpoint prediction is good and when scan structure matches the map rendering assumptions.

## Formulation

The odometry step minimizes a point-to-plane alignment objective:

```text
min_T sum_i rho( n_i^T * (T * p_i - q_i) )

p_i : point from the current LiDAR scan
q_i : corresponding surfel/model point from the rendered map view
n_i : corresponding surfel normal
T   : current sensor pose update
rho : robust weighting or correspondence filtering
```

Correspondences are found projectively rather than through k-d tree nearest-neighbor search. The current scan and rendered map are images over the LiDAR's angular domain, so nearby pixels are candidate correspondences.

Loop closure uses the same map representation. SuMa composes virtual views of the map before a potential loop closure and verifies candidates before adding pose graph constraints. The global objective is then:

```text
min_{T_1...T_N}
  sum odometry_constraints
  + sum loop_closure_constraints
```

The graph optimization is conceptually aligned with the factor-graph material in [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md), though SuMa uses its own mapping pipeline around the graph.

## Failure Modes

- Limited or wrong scan organization breaks spherical projection assumptions.
- Large pose prediction errors reduce projective correspondence quality.
- Open scenes with mostly ground and distant sparse objects provide weak surfel constraints.
- Dynamic objects can corrupt the map before stability filtering removes them.
- No tight IMU coupling makes high-rate rotations and scan distortion harder than in LIO systems.
- GPU/OpenGL dependency complicates headless embedded deployment.
- Reflective, wet, dusty, rainy, or spray-filled scenes can create unstable surfels.
- Loop closure is not a full global place-recognition solution; large accumulated drift can prevent candidates from being considered.
- The method is older and has a smaller maintenance ecosystem than FAST-LIO2 or LIO-SAM.

## AV Relevance

SuMa is relevant to AVs as a dense mapping and map-maintenance reference. Surfels preserve surface orientation and stability, which can help identify persistent infrastructure and reject transient objects. SuMa++ shows how semantics can be added to remove moving classes and improve alignment.

It is less relevant as a primary AV localization method. Modern AV stacks usually need tight inertial fusion, wheel odometry, GNSS/RTK integration, HD-map localization, and explicit health monitoring. SuMa's LiDAR-only surfel tracking does not provide those components.

The most transferable ideas are:

- Stable surface elements instead of raw accumulated points.
- Rendering-based scan-to-model association.
- Map stability scores for dynamic-object filtering.
- Semantic filtering for vehicles and pedestrians.
- Pose graph correction for dense maps.

## Indoor/Outdoor Relevance

Outdoors, SuMa was designed for urban driving data and evaluated on KITTI. It handles city streets with buildings, poles, vegetation, and traffic better than purely frame-to-frame ICP because the surfel map aggregates past observations. It is challenged by highways and other sparse-structure scenes.

Indoors, SuMa can work with a rotating 3D LiDAR in large structured spaces such as warehouses or hangars, but close-range clutter, narrow corridors, and occlusions can stress projective association. RGB-D-style surfel methods are natural indoors, but SuMa's implementation and assumptions are specifically LiDAR-oriented.

## Airside Deployment Notes

For airside operations, SuMa is more appropriate for offline mapping research than live localization. Aprons contain large open regions, moving aircraft and vehicles, jet blast/dust/spray, and repetitive stand geometry. Those conditions are hard for a LiDAR-only surfel tracker.

Potentially useful airside roles:

- Offline dense map creation for hangars and structured service roads.
- Surface-stability analysis to distinguish fixed infrastructure from movable equipment.
- Semantic SuMa++-style filtering for aircraft, vehicles, and people before map update.
- Research comparison against point-cloud and voxel map representations.

Operational deployment would need IMU/wheel/RTK fusion outside SuMa, robust dynamic filtering, and explicit prevention of global correction jumps in the control frame.

## Datasets/Metrics

The SuMa paper evaluates on the KITTI Vision/Odometry Benchmark using Velodyne HDL-64E scans at 10 Hz. It reports online operation around 20 Hz average processing, and paper results include approximately 1.4 percent average translational error and 0.0032 deg/m average rotational error on KITTI test sequences. The paper emphasizes that loop closures improve global consistency even when short-segment KITTI metrics do not fully show the benefit.

Useful metrics include:

- KITTI translational and rotational relative pose error.
- Absolute trajectory error where ground truth supports it.
- Runtime per scan including odometry, map update, and loop verification.
- Loop closure precision and recall.
- Map consistency after revisits.
- Surfel stability distribution and dynamic-object rejection rate.
- GPU memory use and rolling-grid upload/download cost.

For airside evaluation, add map ghosting around parked/moving aircraft, repeatability of stand geometry, drift over open apron traversals, and robustness under rain, spray, and low-angle reflective returns.

## Open-Source Implementations

- `jbehley/SuMa`: original MIT-licensed C++/OpenGL implementation.
- `PRBonn/semantic_suma`: semantic extension lineage associated with SuMa++ and related Bonn work.
- Dependencies include Qt5, OpenGL, Eigen, Boost, and GLEW-style graphics support.
- The original repository runs through a visualizer workflow and KITTI-format data rather than a turnkey production ROS localization node.

The code is valuable for study, but product use would require substantial integration work.

## Practical Recommendation

Do not use SuMa as the primary airside localization method. Use it as a dense mapping reference and as a source of ideas for surfel stability, dynamic-object filtering, and semantic map maintenance.

For operational airside vehicles, prefer a modern LiDAR-inertial odometry front end plus robust multi-sensor fusion. If a surfel map is desired, integrate surfels as a map layer or scan-matching target inside a broader estimator rather than adopting SuMa as the whole localization stack.

## Sources

- Behley, J. and Stachniss, C. "Efficient Surfel-Based SLAM using 3D Laser Range Data in Urban Environments." RSS 2018. https://jbehley.github.io/papers/behley2018rss.pdf
- Original SuMa repository. https://github.com/jbehley/SuMa
- SuMa++ semantic extension paper. https://arxiv.org/abs/2105.11320
- Semantic SuMa repository. https://github.com/PRBonn/semantic_suma
- Local context: [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md)
- Local context: [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- Local context: [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
