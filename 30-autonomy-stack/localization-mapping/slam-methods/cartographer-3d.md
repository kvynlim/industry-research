# Cartographer 3D

## Executive Summary

Cartographer is Google's real-time SLAM system for 2D and 3D mapping across multiple platforms and sensor configurations. Cartographer 3D combines local submap construction, scan-to-submap matching, IMU-aided pose extrapolation, and a global pose graph that searches for loop-closure constraints in background threads. It is historically important because it provided a production-quality open-source submap and loop-closure architecture, even though active development has largely stopped.

For modern AV use, Cartographer 3D is better treated as a reference architecture or offline mapping tool than as the first-choice production odometry front end. Its 3D mode requires an IMU, needs careful tuning, and is heavier than modern LIO methods such as FAST-LIO2. Its strongest ideas are still relevant: local submaps, background constraint building, branch-and-bound scan matching, robust global optimization, and a serialized map state. Related local docs: [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md), [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Historical Context

Cartographer became widely known through the 2016 ICRA paper "Real-Time Loop Closure in 2D LIDAR SLAM" by Hess, Kohler, Rapp, and Andor. The open-source project later exposed both 2D and 3D SLAM through a standalone C++ library and a ROS integration layer.

Cartographer's influence is architectural. It separated local SLAM from global SLAM:

- Local SLAM builds locally consistent submaps and accepts drift.
- Global SLAM searches for constraints between nodes and submaps, then optimizes the pose graph.

The official repository now states that Cartographer is no longer actively maintained, with only rare critical pull requests expected. That maintenance status matters for production decisions in 2026.

## Sensor Assumptions

Cartographer 3D expects range data from one or more LiDAR or point-cloud sources and requires IMU data. The official ROS documentation states that IMU is optional in 2D but required in 3D. Gravity is used to define the z direction and to reduce roll/pitch search complexity during scan matching.

Supported ROS inputs include:

- `sensor_msgs/LaserScan` for 2D and some 3D configurations using rotating planar scanners.
- `sensor_msgs/MultiEchoLaserScan`.
- `sensor_msgs/PointCloud2` for 3D point clouds.
- `sensor_msgs/Imu`, required in 3D.
- Optional `nav_msgs/Odometry`.
- Optional `sensor_msgs/NavSatFix`.
- Optional landmark lists.

The ROS wrapper requires correct TF transforms from incoming sensor frames to the configured tracking and published frames. The configuration also assumes all sensor data are strictly time ordered and collated. For 3D backpacks, Cartographer may accumulate many point-cloud packets into one matched scan; the official FAQ gives an example with VLP-16 UDP packets accumulated into larger point clouds for matching.

## State/Map Representation

Cartographer's map representation is submap based. In 3D, each submap uses two hybrid probability grids:

- A high-resolution grid for close measurements.
- A low-resolution grid for far measurements.

The trajectory is represented as nodes with local poses and as submap poses in a global pose graph. Nodes and submaps are connected by constraints. Some constraints are local/intra-submap constraints; others are global/inter-submap constraints used for loop closure.

The serialized map state is stored in Cartographer's `pbstream` format. ROS tools can publish submap lists, query submaps, write state, run final optimization, and convert serialized state into assets such as point clouds or occupancy grids.

This is conceptually similar to a factor graph, although Cartographer uses Ceres and its own pose-graph machinery rather than GTSAM. For the common graph-optimization ideas, see [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Algorithm Pipeline

1. Collate timestamped range, IMU, odometry, GPS, and landmark inputs.
2. Filter range data using min/max range and voxel filtering.
3. Use the pose extrapolator to predict the next scan pose from IMU and optional odometry.
4. Assemble accumulated range data into a scan for matching.
5. Run local scan matching against the active submap.
6. Insert accepted range data into the active high/low resolution submap grids.
7. Use a motion filter to avoid inserting redundant nodes.
8. Mark submaps complete after configured range-data counts.
9. In background, search for node-submap constraints.
10. Use Fast Correlative Scan Matching for candidate loop matches.
11. Refine accepted candidates with Ceres scan matching.
12. Run sparse pose adjustment/global optimization over submap and node poses.
13. Write `pbstream`, publish submap lists, and optionally produce occupancy grids or assets.

The system is deliberately asynchronous: local SLAM stays online while global SLAM works in background threads.

## Formulation

Local scan matching is a nonlinear least-squares problem. The Ceres scan matcher optimizes the pose that best aligns filtered scan points with occupied space in the submap while respecting translation and rotation priors from the pose extrapolator:

```text
min_T
  w_occ * occupied_space_cost(T, scan, submap)
  + w_trans * ||translation(T) - translation(T_prior)||^2
  + w_rot * ||rotation(T) - rotation(T_prior)||^2
```

In 3D, the scan matcher uses high-resolution and low-resolution filtered point clouds against corresponding hybrid grids. The official tuning walkthrough describes first aligning far low-resolution points with the low-resolution grid, then refining with close high-resolution points.

Global SLAM builds a constraint graph:

```text
Variables:
  node poses
  submap poses
  optional IMU/extrinsic/fixed-frame related quantities

Constraints:
  local scan-to-submap constraints
  loop closure constraints
  IMU acceleration and rotation residuals
  local SLAM pose residuals
  optional odometry and fixed-frame/GPS residuals
```

Fast Correlative Scan Matching performs a branch-and-bound search over possible scan-to-submap alignments. Candidates above a score threshold are refined by Ceres. Outlier influence is controlled with a Huber loss in the optimization problem.

## Failure Modes

- Wrong IMU orientation, gravity direction, or extrinsics can break 3D scan matching.
- Missing or delayed TF transforms stop data from entering the correct tracking frame.
- Poor timestamp ordering or dropped sensor data can stall the collator.
- Open spaces and flat ground create weak 3D occupancy constraints.
- Dynamic objects can pollute probability grids and create false constraints.
- Excessive constraint sampling misses loop closures; excessive sampling breaks real-time behavior.
- Bad loop-closure scores or thresholds can insert wrong global constraints.
- Occupancy-grid generation can be slow for large maps.
- The codebase's limited maintenance increases integration risk on modern ROS distributions.
- Cartographer's local odometry is not as specialized or lightweight as modern LIO front ends.

## AV Relevance

Cartographer 3D remains relevant as a map-building and submap-backend reference. Its submap abstraction, serialized state, constraint builder, and background loop-closure pipeline are useful patterns for AV mapping systems.

It is less compelling as the primary real-time AV odometry module in 2026. Modern LIO front ends provide better latency, easier LiDAR support, and stronger inertial coupling. For production AV localization, Cartographer-like submaps may still be useful, but the state output should be fused with wheel odometry, RTK, map matching, and health monitoring in a separate robust estimator.

## Indoor/Outdoor Relevance

Indoors, Cartographer 3D is useful for backpack mapping, warehouses, mines, tunnels, multi-level buildings, and robot survey platforms when IMU and LiDAR timing are well calibrated. It benefits from walls, ceilings, columns, and other persistent occupancy structure.

Outdoors, it works best in structured campuses and urban environments. It is weaker in broad open areas, vegetation-heavy scenes, and highly dynamic traffic unless tuned carefully. The 3D probability-grid approach is heavier than sparse feature maps or direct LIO maps for low-latency odometry.

## Airside Deployment Notes

For airports, Cartographer 3D could be useful for offline mapping of hangars, terminals, service roads, tunnels, and apron-adjacent structures. It should not be the sole operational localization module for safety-critical GSE.

Airside-specific precautions:

- Use RTK/GNSS as a fixed-frame input only with robust gating.
- Keep aircraft, buses, tugs, belt loaders, and passengers out of persistent submaps where possible.
- Tune min/max range to exclude self-returns and unreliable far returns.
- Validate gravity alignment on sloped ramps and uneven pavement.
- Disable or isolate global optimization jumps from the control frame during operations.
- Prefer frozen-map localization or offline mapping mode for production map updates.
- Account for maintenance status and ROS compatibility before long-term adoption.

## Datasets/Metrics

Cartographer's official ROS documentation includes public demo bags and tooling for offline processing. For 3D evaluation, use:

- ATE/RPE against motion-capture, survey, or GNSS/INS ground truth.
- Submap alignment error before and after loop closure.
- Constraint acceptance rate and false-positive loop closures.
- Scan matcher score distributions.
- Global optimization runtime and final residual histograms.
- Memory usage and submap count over route length.
- Occupancy-grid or point-cloud asset quality after `pbstream` export.

For airside, add absolute error against surveyed airport control points, map consistency across repeated shifts, localization continuity near terminals, and false loop closures in repetitive stand/gate geometry.

## Open-Source Implementations

- `cartographer-project/cartographer`: standalone C++ library, Apache-2.0, no longer actively maintained according to the repository README.
- `cartographer-project/cartographer_ros`: ROS wrapper and tools, maintained only in limited capacity.
- ROS forks used by distributions may differ from the upstream repository.
- Viam and other platforms expose Cartographer-derived SLAM modules, but those are product-specific integrations rather than the original library.

The open-source ecosystem is mature but dated. Any deployment should begin with a maintenance and dependency risk review.

## Practical Recommendation

Do not choose Cartographer 3D as the primary new LIO method for an airside AV stack. Use it as a reference for submaps, loop closure, and serialized map-state workflows, or as an offline mapping baseline when its tooling is convenient.

For production, prefer a modern LIO front end such as FAST-LIO2, a robust fusion backend, and explicit map-localization factors. Borrow Cartographer's separation between local consistency and global correction, but avoid depending on an unmaintained stack for safety-critical odometry.

## Sources

- Cartographer documentation. https://google-cartographer.readthedocs.io/en/latest/
- Cartographer ROS algorithm walkthrough. https://google-cartographer-ros.readthedocs.io/en/latest/algo_walkthrough.html
- Cartographer ROS FAQ on 3D IMU requirement. https://google-cartographer-ros.readthedocs.io/en/latest/faq.html
- Cartographer ROS API reference. https://google-cartographer-ros.readthedocs.io/en/latest/ros_api.html
- Cartographer repository and maintenance note. https://github.com/cartographer-project/cartographer
- Hess, W., Kohler, D., Rapp, H., and Andor, D. "Real-Time Loop Closure in 2D LIDAR SLAM." ICRA 2016. https://research.google/pubs/pub45466/
- Local context: [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md)
- Local context: [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- Local context: [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
