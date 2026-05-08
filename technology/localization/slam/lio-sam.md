# LIO-SAM

## Executive Summary

LIO-SAM is a tightly coupled LiDAR-inertial SLAM system built around factor-graph smoothing. It is important because it made a practical, open-source, GTSAM-based architecture for combining IMU preintegration, LiDAR scan-to-map constraints, GPS factors, and loop-closure factors in one online mapper. For autonomous vehicle work, its greatest value is not raw odometry speed; it is the clean demonstration of how a LiDAR odometry front end can be embedded in a smoothing backend that accepts other absolute and relative measurements.

The method is a strong research and survey-mapping baseline when a mechanical spinning LiDAR, a good high-rate IMU, synchronized timestamps, and reliable extrinsic calibration are available. It is weaker as a direct production airside localization stack because it assumes LOAM-style ring-organized scans, extracts edge and planar features, and can degrade in open areas with few geometric constraints. For broader context, see the parent overview in [Modern LiDAR SLAM and Odometry Algorithms](../lidar-slam-algorithms.md), the production fusion discussion in [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md), and the backend math in [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Historical Context

LIO-SAM was published by Shan, Englot, Meyers, Wang, Ratti, and Rus at IROS 2020 as "Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping." It sits in the lineage from LOAM and LeGO-LOAM: the front end still extracts edge and planar LiDAR features, but the trajectory estimate is organized around smoothing and mapping rather than a purely local odometry chain.

The timing matters. Before FAST-LIO2 and newer direct LIO systems became popular, many LiDAR SLAM systems either used LiDAR-only odometry with separate IMU deskewing, or loosely coupled scan-matching outputs with inertial/GNSS estimates. LIO-SAM made the factor-graph architecture easy to inspect and reuse. The repository explicitly maintains two graphs: a persistent mapping graph for LiDAR odometry and GPS factors, and a periodically reset IMU graph that estimates high-rate odometry and IMU bias.

This makes LIO-SAM a useful bridge between academic LiDAR SLAM and production AV localization architectures. It resembles a production backend more closely than filter-only odometry methods, even though its LiDAR front end is still research oriented.

## Sensor Assumptions

LIO-SAM assumes a mechanically scanning 3D LiDAR whose ROS point cloud contains per-point relative time and ring/channel fields. The time field is used for IMU-based deskewing, and the ring field is used to organize the scan into a range-image-like matrix for feature extraction. The reference implementation notes that only mechanical LiDARs are supported in the original package; solid-state LiDARs require modifications or variants.

The IMU assumption is stronger than in many later LIO systems. The original README says LIO-SAM works with a 9-axis IMU that provides roll, pitch, and yaw estimates, with roll/pitch used for attitude initialization and yaw used when GPS is present. The authors used a 500 Hz Microstrain IMU and recommend at least 200 Hz. Correct IMU-LiDAR extrinsics are critical because raw IMU data are transformed into the LiDAR frame before deskewing and preintegration.

Optional GPS is supported as a unary factor. Wheel odometry is not part of the original architecture, but the factor-graph design makes it straightforward to add as another between-factor or velocity factor. Time synchronization is not optional in practice: the repository lists unsynchronized LiDAR/IMU timestamps as a common cause of zigzag or jerky behavior.

## State/Map Representation

The state is a sequence of keyframe states on SE(3), augmented in the IMU preintegration graph with velocity and IMU biases. In factor-graph terms:

```text
State per keyframe:
  pose_i     = T_world_body_i in SE(3)
  velocity_i = v_world_i
  bias_i     = [accelerometer_bias_i, gyroscope_bias_i]

Persistent map graph:
  variables: keyframe poses
  factors: LiDAR odometry, GPS, loop closure, priors

High-rate IMU graph:
  variables: pose, velocity, bias over a short horizon
  factors: IMU preintegration and LiDAR odometry constraints
  lifecycle: reset periodically for real-time operation
```

The map is stored as keyframes with associated edge and planar feature clouds. Local scan-to-map matching uses nearby keyframes to build a local submap. The global map is therefore not a single dense voxel grid; it is a pose-graph-indexed collection of feature clouds whose alignment is updated when the graph changes.

## Algorithm Pipeline

1. Receive raw LiDAR cloud and IMU measurements.
2. Deskew each point using IMU integration and the relative point timestamp.
3. Project the scan into a range-image organization using the ring field.
4. Extract sharp edge features and flat planar features following the LOAM/LeGO-LOAM style.
5. Build a local feature submap from nearby keyframes.
6. Solve scan-to-map registration using edge-to-line and plane-to-plane residuals.
7. Add the resulting LiDAR odometry constraint to the mapping factor graph.
8. Add GPS factors when configured and when measurements pass quality gates.
9. Search for loop-closure candidates by spatial proximity, verify them with ICP, and add loop factors.
10. Run iSAM2 incremental smoothing and publish odometry, keyframes, and map clouds.

The practical architecture separates latency-sensitive odometry from global consistency. The IMU preintegration module outputs high-rate odometry, while the mapping graph handles lower-rate keyframe optimization and loop closure.

## Formulation

LIO-SAM solves a maximum a posteriori estimation problem over a factor graph:

```text
X* = argmin_X sum_i ||r_i(X_i, z_i)||^2_Sigma_i
```

where each residual comes from one sensor or prior. The main factors are:

```text
IMU preintegration factor:
  r_imu = residual between predicted relative motion from IMU and states
          [pose_i, velocity_i, bias_i, pose_j, velocity_j, bias_j]

LiDAR odometry factor:
  r_lidar = Log(Delta_T_lidar^-1 * T_i^-1 * T_j)
  Delta_T_lidar is estimated by feature scan-to-local-map matching.

GPS factor:
  r_gps = p_i - p_gps_i
  Usually applied only to translation, with covariance based on fix quality.

Loop closure factor:
  r_loop = Log(Delta_T_loop^-1 * T_i^-1 * T_j)
  Delta_T_loop is accepted only after ICP verification.
```

The feature scan matcher uses point-to-line residuals for edge features and point-to-plane residuals for planar features:

```text
edge residual:
  distance from transformed point p to a line through two map edge points

plane residual:
  n^T * (T * p - q)
  n = local plane normal
  q = point on the plane
```

This is not a direct raw-point method. The quality of the LiDAR factor depends on extracting enough reliable geometric features and on the local submap representing stable structure.

## Failure Modes

- Missing per-point time or ring fields break deskewing and scan organization.
- LiDAR/IMU timestamp offset produces zigzag, jerky, or systematically biased odometry.
- Wrong IMU extrinsics can cause immediate vertical jumping or gravity inconsistency.
- Low-rate or noisy IMUs degrade deskewing, bias estimation, and high-rate odometry.
- Feature-poor scenes, such as long open aprons or broad flat ramps, can leave weak constraints in yaw or translation.
- Dynamic objects, aircraft, service vehicles, passengers, and jet bridges can become false geometric features if not filtered.
- Solid-state and non-repetitive LiDAR patterns do not match the original mechanical-LiDAR assumptions.
- GPS factors can corrupt the graph if multipath or false RTK fixes are inserted without robust validation.
- Loop closures based only on spatial proximity can be wrong in repetitive structures unless ICP verification and robust noise models are conservative.

## AV Relevance

LIO-SAM is highly relevant as an architectural reference for AV localization. It shows how to combine relative odometry, inertial preintegration, absolute position fixes, and loop closures in a smoothing backend. That maps directly to AV stacks that already use graph optimization, especially those that need to add or remove factors based on sensor health.

As a front-end odometry source, LIO-SAM is less universal than direct methods such as FAST-LIO2 because it depends on hand-engineered features and mechanical scan structure. As a backend pattern, it remains valuable: GPS, wheel odometry, map-matching, fiducials, and loop closures all fit naturally into the same graph abstraction.

## Indoor/Outdoor Relevance

Indoors, LIO-SAM works well in corridors, warehouses, laboratories, and parking structures when walls, pillars, shelving, or other planar/edge geometry are visible. It can struggle in glass-heavy spaces, featureless halls, and highly dynamic crowded spaces.

Outdoors, it is well suited to campus, urban, and suburban mapping with buildings, poles, curbs, vegetation, and facades. It is less reliable in open highways, large tarmac areas, snow-covered open spaces, or wide flat lots where the LiDAR sees mostly ground and distant sparse objects. GPS factors help outdoor drift but require gating and covariance management.

## Airside Deployment Notes

For airside operations, LIO-SAM is most useful for survey mapping, validation runs, and loop-closure/back-end design. A production airside deployment should not insert GPS factors blindly; RTK measurements near terminals, aircraft tails, and hangars should pass innovation checks as described in [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md).

A practical airside adaptation would:

- Treat LIO-SAM LiDAR odometry as one factor source, not the sole localization authority.
- Add wheel odometry and vehicle kinematic factors for low-speed ground vehicles.
- Add robust RTK-GNSS factors with chi-squared gating and covariance inflation under multipath.
- Use map-based localization against the maintained airport map for operational localization.
- Reserve loop closure for mapping/survey mode unless the operational safety case accepts global pose jumps.
- Replace or augment feature extraction if the LiDAR suite includes solid-state sensors or merged multi-LiDAR clouds.

The biggest airside risk is degeneracy: flat ground plus distant terminal facades can produce confident-looking but underconstrained scan matches. Degeneracy detection and covariance inflation are mandatory before feeding LIO-SAM-derived factors into a safety-critical graph.

## Datasets/Metrics

The LIO-SAM paper evaluates on public and self-collected sequences, and the repository provides walking, park, garden, rotation, and campus bags. Common evaluation metrics are:

- Absolute trajectory error after alignment.
- KITTI-style relative pose error over path segments.
- Drift percentage over distance.
- Loop-closure correction magnitude and residual.
- Runtime per LiDAR frame and high-rate IMU odometry latency.
- Factor-graph innovation statistics for LiDAR, GPS, and loop factors.

For airside evaluation, add domain metrics: lateral error against surveyed lane centerlines, yaw error near docking stands, localization availability under GNSS denial, recovery time after GPS multipath rejection, and false loop-closure rate in repetitive apron geometry.

## Open-Source Implementations

- `TixiaoShan/LIO-SAM`: original ROS1 C++ implementation using GTSAM. The repository has a ROS2 branch and is widely forked.
- `liorf`: a community variant that adds broader 6-axis IMU and LiDAR support.
- Scan Context based LIO-SAM forks: add stronger place recognition than the original radius-search loop closure.
- LVI-SAM: related lidar-visual-inertial smoothing-and-mapping system by the same broader lineage.

License and dependency review are required before product use. The original package depends on ROS, PCL, GTSAM, TF, and robot localization conventions.

## Practical Recommendation

Use LIO-SAM as the reference method for factor-graph LIO design and as an offline/online survey-mapping baseline. Do not adopt the original repository unchanged for production airside localization. For an airport GSE stack, the stronger path is to reuse the backend pattern: feed LiDAR map-matching, wheel odometry, IMU preintegration, RTK, and loop-closure constraints into a robust graph with explicit sensor validation.

If the objective is pure high-rate odometry, FAST-LIO2 is usually a better front end. If the objective is map-building with loop closures and multi-sensor factors, LIO-SAM remains one of the clearest open implementations to study.

## Sources

- Shan, T., Englot, B., Meyers, D., Wang, W., Ratti, C., and Rus, D. "LIO-SAM: Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping." IROS 2020. https://arxiv.org/abs/2007.00258
- Original LIO-SAM repository and README. https://github.com/TixiaoShan/LIO-SAM
- GTSAM factor-graph reference used by LIO-SAM. https://gtsam.org/
- Local context: [Modern LiDAR SLAM and Odometry Algorithms](../lidar-slam-algorithms.md)
- Local context: [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md)
- Local context: [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
