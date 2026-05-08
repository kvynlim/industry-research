# RTAB-Map

## Executive Summary

RTAB-Map, short for Real-Time Appearance-Based Mapping, is a mature open-source graph-SLAM library and application for RGB-D, stereo, lidar, and 2D laser robots. It combines visual or lidar odometry, appearance-based loop closure, proximity detection, graph optimization, map/database management, and ROS integration. For practical indoor RGB-D robotics, it is the most deployable method in this group.

RTAB-Map is not a single dense reconstruction algorithm like [KinectFusion](kinectfusion.md), [ElasticFusion](elasticfusion.md), or [BundleFusion](bundlefusion.md). It is a configurable SLAM framework. Dense point clouds, occupancy grids, OctoMap-style outputs, textured meshes, and local maps are built around a graph of poses and sensor data. Its core contribution is scalable online loop closure and memory management for long-term operation.

Indoor value is strong because RTAB-Map supports Kinect/Realsense-style RGB-D cameras, stereo, wheel odometry, IMU inputs, 2D lasers, and ROS workflows. Outdoor and AV transfer is possible mainly through lidar/stereo configurations, but production airside localization still needs a broader estimator, GNSS/RTK or surveyed map anchoring, safety monitoring, and dynamic-object handling. For future dense appearance maps, RTAB-Map is a practical classical baseline to compare against neural and Gaussian representations such as [NICE-SLAM](nice-slam.md), [Co-SLAM and ESLAM](co-slam-eslam.md), and [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md).

## Historical Context

RTAB-Map began as an appearance-based loop-closure detector with memory management for large-scale and long-term online operation. Labbe and Michaud's early work focused on real-time loop closure detection under bounded computation. The system then evolved into a full open-source SLAM library that supports visual and lidar front ends, graph optimization, localization mode, multi-session workflows, and mobile/ROS deployments.

The official RTAB-Map overview describes it as an RGB-D, stereo, and lidar graph-based SLAM approach based on an incremental appearance-based loop closure detector. When a loop closure is accepted, RTAB-Map adds a constraint to the graph and runs graph optimization. The memory management system limits how many locations are actively used for loop closure and optimization so real-time constraints can be respected in larger environments.

Compared with dense RGB-D research systems, RTAB-Map is less about one novel map representation and more about integration. It is widely used because it handles sensors, databases, ROS topics, odometry sources, map exports, and practical robot workflows. The 2019 Journal of Field Robotics paper frames RTAB-Map as an open-source lidar and visual SLAM library for large-scale and long-term online operation.

## Sensor Assumptions

RTAB-Map can use several sensor configurations:

- RGB-D camera alone for 6-DoF visual SLAM.
- Stereo camera with visual odometry.
- 2D laser plus wheel odometry for 3-DoF indoor mapping.
- 3D lidar with ICP/lidar odometry.
- RGB-D or stereo plus lidar for more robust constraints.
- External odometry from wheel encoders, visual-inertial odometry, lidar odometry, or robot localization.
- IMU and GPS/GNSS inputs in supported configurations, depending on build and ROS integration.

The assumptions depend on the selected front end. RGB-D operation needs calibrated color/depth, adequate depth coverage, and manageable lighting. Stereo needs texture and calibration. Lidar operation needs sufficient geometric structure and correct extrinsics. All modes depend heavily on timestamps, TF transforms, odometry quality, and correct covariance/noise tuning.

RTAB-Map is more tolerant than single-sensor dense methods because it can accept external odometry and multiple sensing modalities. However, it is still a graph-SLAM system: wrong loop closures, bad time sync, poor calibration, or weak odometry can damage the map.

## State/Map Representation

The central state is a graph:

```text
node = {
  pose,
  sensor signature,
  visual words or scan descriptors,
  local occupancy/point cloud data,
  timestamp,
  links to neighboring and loop-closure nodes
}

edge = {
  relative transform,
  information/covariance,
  type: odometry, loop closure, proximity, landmark, GPS, ...
}
```

Nodes are stored in an on-disk database and managed through working memory and long-term memory. This lets RTAB-Map scale beyond the set of nodes that can be actively compared at every frame. Locations can be retrieved when they become relevant for loop closure or localization.

Map outputs are derived from the optimized graph. Depending on configuration, RTAB-Map can produce:

- 2D occupancy grids.
- 3D colored point clouds.
- OctoMap/voxel-style occupancy.
- Meshes and textured meshes.
- Local obstacle maps for navigation.
- Pose graph and localization transforms.

This separation is important: the optimized graph is the localization backbone, while dense maps are products generated from stored sensor data and optimized poses.

## Algorithm Pipeline

1. Receive synchronized sensor data and TF transforms.
2. Estimate short-term odometry using RGB-D, stereo, ICP, external odom, or a fused source.
3. Create a new node/signature when motion or timing criteria are met.
4. Extract visual words, descriptors, scan features, or local map data.
5. Query the appearance-based memory for loop-closure candidates.
6. Verify candidates geometrically with visual feature matching, PnP, ICP, or combined methods.
7. Add accepted loop or proximity constraints to the graph.
8. Reject suspicious constraints if graph optimization produces excessive error.
9. Optimize the pose graph with the configured optimizer.
10. Update map-to-odom transforms and map outputs.
11. Move nodes between working and long-term memory to keep computation bounded.
12. In localization mode, match live observations to an existing map without expanding it, if configured.

RTAB-Map's strength is that each block is configurable. That flexibility is also a risk: bad configuration can look like a bad algorithm. Sensor sync, frame IDs, odometry covariance, loop-closure thresholds, database size, and map update rates must be tuned for the robot.

## Formulation

The graph optimization objective is the standard pose-graph least-squares problem:

```text
min_{T_0...T_N} sum_(i,j) || Log( Z_ij^-1 * T_i^-1 * T_j ) ||^2_Omega_ij
```

`T_i` and `T_j` are node poses, `Z_ij` is the measured relative transform from odometry, loop closure, proximity detection, or a landmark/GPS factor, and `Omega_ij` is the information matrix.

Loop detection is appearance-based in the original RTAB-Map lineage:

```text
score(current_signature, past_signature) -> loop hypothesis
geometric_verification(loop hypothesis) -> accepted edge or rejected edge
```

The exact descriptor, detector, and verification method depend on configuration. RGB-D systems may use visual words and depth-supported PnP or 3D feature correspondences. Lidar systems may use ICP or scan matching. Robust graph optimization and loop rejection are critical because a single high-confidence false loop can warp the map.

## Failure Modes

- Bad odometry causes graph nodes to be too far from true poses for loop candidates and proximity detection to work.
- False loop closures in repeated corridors, airport gates, baggage halls, or parking structures can corrupt the graph.
- Low texture, motion blur, exposure changes, and repetitive patterns reduce visual loop closure reliability.
- Dynamic objects can dominate visual words or ICP geometry.
- Poor time synchronization or TF tree errors create systematic transform mistakes.
- RGB-D cameras fail on sunlight, reflective surfaces, glass, black materials, and long-range outdoor scenes.
- Lidar-only configurations can drift in long featureless corridors, open aprons, or repeated structural geometry.
- Database and memory management parameters can trade accuracy for real-time behavior in surprising ways.
- Large loop corrections can cause map-to-odom jumps that downstream navigation must handle.
- ROS wrapper, build options, OpenCV nonfree features, and optimizer choices affect behavior and licensing.

## AV Relevance

RTAB-Map is relevant to AV engineering as an open, configurable SLAM baseline and integration reference. It supports visual and lidar sensors, graph optimization, map databases, localization mode, and ROS workflows. For small indoor autonomous robots, it can be a practical mapping stack. For AV research, it is a good baseline for loop closure, graph management, and map reuse.

It is not a complete production AV localization architecture. A vehicle operating airside needs precise map georeferencing, RTK/GNSS handling, wheel/IMU fusion, health monitoring, uncertainty propagation, perception-driven dynamic-object exclusion, and safety rules for global correction. RTAB-Map can feed or support such a system, but it should not be the only source of safety-critical pose without a surrounding estimator and monitors.

Most useful roles:

- Indoor RGB-D/stereo/lidar mapping baseline.
- ROS-based rapid prototyping.
- Loop-closure and relocalization benchmark.
- Dense point-cloud or occupancy-map generation from robot data.
- Localization-only mode against a prebuilt map for controlled environments.

## Indoor/Outdoor Relevance

Indoor relevance is high. RTAB-Map is commonly used with RGB-D cameras, 2D lidars, wheel odometry, and ROS navigation. It is well matched to offices, labs, terminals, baggage areas, service corridors, warehouses, and hangars when sensor placement and odometry are good.

Outdoor relevance is configuration-dependent. RGB-D outdoor use is limited by active depth range and sunlight, but stereo and lidar configurations can work in outdoor environments if there is enough visual or geometric structure. For vehicle-scale outdoor AVs, RTAB-Map should be compared with lidar-inertial systems such as [LIO-SAM](lio-sam.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [KISS-ICP](kiss-icp.md), and [Cartographer 3D](cartographer-3d.md).

For indoor-outdoor transitions, RTAB-Map can be useful as a local SLAM and relocalization component, but the global navigation stack should decide when to trust RGB-D, lidar, GNSS, wheel odometry, and prior maps.

## Airside Deployment Notes

Good candidate use cases:

- Mapping terminal service corridors, baggage handling areas, maintenance rooms, and hangar interiors.
- Indoor localization for slow autonomous tugs, inspection carts, or maintenance robots.
- Building local 3D maps for obstacle-aware navigation in controlled zones.
- Comparing RGB-D, stereo, 2D lidar, and 3D lidar configurations on the same robot.
- Localization against a prebuilt map in a known indoor facility.

High-risk use cases:

- Open apron localization with RGB-D as the primary sensor.
- Safety-critical control during large graph correction events.
- Long-term maps without dynamic-object filtering in areas where aircraft, carts, loaders, and pallets move frequently.
- Repeated stand/gate geometry without strong external anchors.

Deployment notes:

- Use wheel odometry and IMU as stable short-term odometry sources when available.
- Gate loop closures using geometry, covariance, and operational zones.
- Log the RTAB-Map database, TF, raw sensor data, and optimizer events for replay.
- Keep `map->odom` correction behavior explicit in downstream navigation.
- Build airport-specific tests for night, floodlights, wet floors, metallic surfaces, repeated gates, and moving ground support equipment.

## Datasets/Metrics

The RTAB-Map lidar/visual SLAM paper compares across real-world datasets such as KITTI, EuRoC, TUM RGB-D, and MIT Stata Center PR2 data. Useful dataset choices depend on sensor mode:

- TUM RGB-D for indoor RGB-D trajectory and loop closure.
- EuRoC MAV for stereo/visual-inertial style comparisons, though RTAB-Map configuration must match available odometry.
- KITTI Odometry for outdoor stereo/lidar vehicle-scale comparison.
- MIT Stata Center for large indoor robot mapping.
- Custom airside indoor/outdoor datasets for operational validation.

Metrics:

- ATE/APE and RPE.
- Loop-closure precision, recall, and false-positive rate.
- Graph optimization error before and after loop closure.
- Map consistency after revisits.
- Tracking/odometry dropout rate.
- CPU/GPU load, database size, memory, and per-node processing time.
- Occupancy map accuracy and obstacle false positives.
- Localization recovery time after kidnapping or tracking loss.

Airside-specific metrics should include false loop closures in repeated stands, maximum correction jump, map staleness under equipment churn, and localization error near hold lines, doors, and stand stop positions.

## Open-Source Implementations

- `introlab/rtabmap`: core RTAB-Map library and standalone application.
- `rtabmap_ros`: ROS/ROS 2 integration, nodes, demos, and launch workflows.
- RTAB-Map desktop and mobile applications for scanning and visualization.
- Build options include different feature detectors, graph optimizers, and map export paths. Licensing can depend on OpenCV nonfree modules; the official site notes BSD use when OpenCV is built without nonfree modules and research-only constraints when SURF is used.

RTAB-Map is actively useful, but configuration discipline matters. Treat launch files, TF tree, calibration, odometry source, and database parameters as part of the method, not mere plumbing.

## Practical Recommendation

For a real indoor RGB-D robot, RTAB-Map is the most practical first choice among the methods in this Worker 8 set. It has mature code, ROS integration, loop closure, map outputs, and operational tuning knobs. Use it as the classical baseline before investing in neural implicit SLAM.

For outdoor airside vehicles, use RTAB-Map only as a component or benchmark. Prefer lidar-inertial localization, RTK/GNSS, wheel/IMU fusion, and surveyed maps for the primary pose backbone. RTAB-Map can still be valuable for indoor service areas, localization recovery, and map-building experiments. When evaluating dense map outputs, compare classical RTAB-Map maps against neural and Gaussian methods rather than assuming a photorealistic neural map is a better localization source.

## Sources

- RTAB-Map official site. https://introlab.github.io/rtabmap/
- RTAB-Map repository. https://github.com/introlab/rtabmap
- Labbe and Michaud, "RTAB-Map as an Open-Source Lidar and Visual SLAM Library for Large-Scale and Long-Term Online Operation," Journal of Field Robotics 2019 / arXiv. https://arxiv.org/abs/2403.06341
- Labbe and Michaud, "Appearance-Based Loop Closure Detection for Online Large-Scale and Long-Term Operation," IEEE Transactions on Robotics 2013. https://arxiv.org/abs/1303.6138
- RTAB-Map wiki. https://github.com/introlab/rtabmap/wiki
- Local context: [Open-Source SLAM Stack Comparison](open-source-stack-comparison.md)
- Local context: [AV Indoor/Outdoor SLAM Decision Matrix](av-indoor-outdoor-decision-matrix.md)
- Local context: [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md)
