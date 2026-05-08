# LOAM: Lidar Odometry and Mapping in Real-time

Related localization docs: [SLAM algorithms](../lidar-slam-algorithms.md), [production LiDAR map localization](../production-lidar-map-localization.md), and [map construction pipeline](../map-construction-pipeline.md).

## Executive Summary

LOAM is the canonical feature-based 3D LiDAR SLAM baseline. Introduced by Ji Zhang and Sanjiv Singh at RSS 2014, it split LiDAR state estimation into a high-rate odometry thread and a lower-rate mapping thread. The odometry thread estimates frame-to-frame motion from sparse edge and planar features; the mapping thread refines the pose by matching a larger feature set into a growing local map.

The core contribution was not a new global graph optimizer, but a practical decomposition that made real-time 6-DoF LiDAR mapping feasible on commodity CPU hardware. LOAM showed that carefully selected geometric features could reduce the registration problem enough to run online while preserving map accuracy. Its feature extraction, edge-to-line residuals, plane-to-plane residuals, scan deskewing, and separate odometry/mapping rates became the template for LeGO-LOAM, A-LOAM, F-LOAM, LIO-SAM, and many later LiDAR-inertial systems.

For production autonomous vehicles, LOAM is best understood as a historical and algorithmic reference, not a deployable airside localization stack by itself. It has no native loop closure, weak handling of dynamic objects, no factor-graph fusion, and strong assumptions about scan organization and geometric features. Still, the method remains valuable as a baseline for survey mapping, as a feature-registration reference, and as the origin of many degeneracy and feature-quality checks used in modern LiDAR pipelines.

## Historical Context

Before LOAM, accurate 3D LiDAR mapping often required offline batch optimization, expensive global registration, or dense ICP variants that were hard to run in real time on a moving platform. Visual odometry had already adopted the idea of fast front-end tracking plus slower back-end refinement; LOAM brought the same systems design to spinning LiDAR.

The 2014 paper described two algorithms running in parallel. The first algorithm estimates velocity at high frequency but with lower fidelity. The second registers the point cloud to a map at about an order of magnitude lower frequency for fine alignment. The authors evaluated the system in indoor corridors and lobbies, outdoor vegetated roads and orchards, and the KITTI odometry benchmark. The paper explicitly noted that the original method did not perform loop closure, leaving global drift correction as future work.

LOAM's influence is larger than the original codebase. A-LOAM simplified the implementation. LeGO-LOAM added range-image segmentation, ground optimization, and GTSAM-based pose graph components. LIO-SAM reused the LOAM-style edge and planar feature pipeline inside a tightly coupled LiDAR-inertial smoothing architecture. Many production systems no longer run original LOAM, but they still use LOAM's decomposition: fast scan odometry, slower map alignment, feature quality filters, and explicit degeneracy handling.

## Sensor Assumptions

LOAM assumes a 3D LiDAR stream with enough angular structure to organize points by scan line and local neighborhood. The method works best with mechanically scanned multi-beam LiDAR or a spinning 2D/3D setup where relative point timing and ring ordering can be inferred.

Key assumptions:

- The platform motion within one scan can be approximated well enough for deskewing by the estimated sweep motion.
- The environment contains repeatable sharp edges and planar patches.
- Consecutive scans have sufficient overlap.
- The LiDAR extrinsics, timing, and scan-line organization are stable.
- Moving objects occupy a minority of the selected features.
- Optional IMU preprocessing can help with fast nonlinear motion, but the core method is LiDAR-centric.

The method is less natural for non-repetitive solid-state LiDARs, very sparse sensors, or multi-LiDAR rigs unless the clouds are reorganized into a compatible feature-extraction representation.

## Map Representation

LOAM maintains a sparse geometric feature map rather than a dense occupancy map.

The map contains:

- Edge features, representing locally sharp line-like structures.
- Planar features, representing locally smooth surface patches.
- A spatial subdivision into local cubes, so only nearby map regions are searched for correspondences.
- Downsampled feature clouds, typically voxel filtered before insertion.

The odometry thread uses a smaller feature set for speed and matches against the previous sweep. The mapping thread uses a larger feature set and aligns the current sweep into the accumulated map. In the original formulation, map points are organized into cubic regions, and relevant cubes are extracted into KD-trees for nearest-neighbor search.

The output map is a point-feature map with local consistency. Because the original method has no loop closure, long trajectories can be locally sharp but globally warped.

## Algorithm Pipeline

1. **Scan organization**
   - Project or organize the raw LiDAR scan by scan line and angular order.
   - Remove invalid points and points likely to be occluded or unreliable.

2. **Feature smoothness calculation**
   - For each point, compute a curvature or smoothness score from neighboring points in the same scan line.
   - High-curvature points become edge candidates.
   - Low-curvature points become planar candidates.

3. **Feature selection**
   - Divide each scan line into angular sectors to distribute features.
   - Select sharp edge points, less-sharp edge points, flat planar points, and less-flat planar points.
   - Suppress neighboring points after a feature is selected to avoid clustered features from one object.

4. **High-rate LiDAR odometry**
   - Match current edge points to line correspondences in the previous scan.
   - Match current planar points to plane correspondences in the previous scan.
   - Solve the relative pose with nonlinear least squares.
   - Estimate motion during the scan and undistort the point cloud.

5. **Low-rate LiDAR mapping**
   - Transform the undistorted current feature cloud into the world frame.
   - Select nearby map cubes and build search structures.
   - Match edge features to local map lines and planar features to local map planes.
   - Refine the pose with a larger optimization problem.
   - Insert downsampled feature points into the map.

6. **Pose composition**
   - Combine high-rate odometry with the latest mapping correction.
   - Publish a continuous pose estimate at odometry rate.

## Formulation

LOAM optimizes poses on SE(3) using geometric feature residuals.

For an edge feature point, the correspondence is a line estimated from two nearby edge points in the previous scan or local map. The residual is the point-to-line distance:

```text
r_edge(T) = distance(T * p_i, line(q_j, q_k))
```

For a planar feature point, the correspondence is a plane estimated from nearby planar points. The residual is the point-to-plane distance:

```text
r_plane(T) = n^T * (T * p_i - q_plane)
```

The pose is estimated by minimizing the sum of robustified feature residuals:

```text
T* = arg min_T sum_i rho(r_edge_i(T)^2) + sum_j rho(r_plane_j(T)^2)
```

where `T` is the current scan pose or relative motion, and `rho` is a robust loss or weighting term used to reduce outlier influence.

LOAM's scan deskewing uses the estimated motion during the sweep. Points are transformed according to their relative time within the scan so that the sweep can be treated as if acquired at a common reference time. The mapping stage then solves a scan-to-map version of the same problem with more features and local map correspondences.

The original system is not a full pose-graph SLAM optimizer. It is an odometry-plus-mapping system with incremental map refinement and no global loop closure.

## Failure Modes

- **Open, flat, or weakly structured scenes:** A single apron plane or a long empty roadway provides weak constraints, especially in yaw and horizontal translation.
- **Geometric degeneracy:** Corridors, tunnels, walls, parallel curbs, and repeated pillars can make one or more pose dimensions poorly observable.
- **Dynamic objects:** Vehicles, pedestrians, aircraft servicing equipment, jet bridges in motion, and baggage trains can be selected as features and pollute the map.
- **Vegetation and nonrigid surfaces:** Grass, leaves, and flexible objects generate unstable edge/plane features.
- **Motion distortion:** Fast acceleration or aggressive rotation during a scan can break the constant-motion deskewing assumption.
- **No loop closure:** Long trajectories accumulate drift and cannot self-correct when revisiting a place.
- **Scan-pattern dependence:** Feature extraction depends on ordered scan lines; changing LiDAR resolution, mounting, or scan pattern often requires retuning.
- **Sparse LiDAR:** Low-channel sensors may not provide enough vertical structure for stable edge and plane correspondences.
- **Calibration and timing errors:** Small extrinsic or timestamp errors create systematic map blur and biased odometry.

## AV Relevance

LOAM is foundational for autonomous vehicle LiDAR odometry, but the original algorithm is not sufficient for production AV localization.

Relevant strengths:

- Establishes a clean feature front end for edge and planar geometry.
- Provides interpretable residuals and degeneracy signals.
- Runs without cameras, GNSS, or IMU in many structured environments.
- Produces survey-quality local maps when driven carefully.
- Influenced production-grade LiDAR-inertial systems through its feature pipeline.

Production gaps:

- No native global optimization or loop closure.
- No robust multi-sensor fusion.
- No semantic dynamic-object filtering.
- Limited support for multi-LiDAR calibration and asynchronous scan timing.
- Requires environment-specific retuning and careful monitoring.

In an AV stack, LOAM-style odometry can be a front-end factor into a GTSAM/ISAM2 back end, but production localization should rely on scan-to-map matching against a validated HD map, as covered in [production LiDAR map localization](../production-lidar-map-localization.md).

## Indoor/Outdoor Relevance

**Indoor:** LOAM can build sharp maps of corridors, lobbies, warehouses, and terminal-like interiors if there are walls, corners, columns, and stable planar surfaces. Long corridors remain degenerate along the corridor axis, and multi-floor transitions require extra care because the system has no semantic floor model.

**Outdoor:** LOAM performs well in structured urban scenes, vegetated roads with enough trunks and road edges, and campus-like environments. It degrades in open fields, featureless roads, parking lots, and large aprons unless augmented with GNSS, IMU, wheel odometry, or map priors.

**Mixed indoor/outdoor:** The method is useful for survey mapping across hangars, service roads, and terminal-adjacent areas, but global consistency must come from loop closure or external anchors.

## Airside Deployment Notes

LOAM is not the recommended primary airside localization method, but it is useful as a reference and survey baseline.

Airside considerations:

- **Apron openness:** Large concrete aprons provide abundant ground points but limited 3D constraints. Pure LOAM features may not observe yaw and lateral motion reliably.
- **Terminal and stand structure:** Building facades, poles, ground equipment, stand markings with associated 3D objects, blast fences, and service-road curbs improve observability.
- **Dynamic clutter:** Aircraft, tugs, belt loaders, dollies, catering trucks, and passengers should be filtered or excluded from map insertion.
- **Speed profile:** Low-speed GSE motion helps reduce scan distortion, but stop-and-go maneuvers and tight turns near aircraft can still stress deskewing.
- **Map QA:** Use loop closure, RTK ground control, or offline map alignment before using a LOAM-derived map as a production reference.
- **Operational role:** Suitable as a secondary survey mapper, algorithmic benchmark, or feature front end. Not suitable as the only production pose source for safety-critical airside autonomy.

For an airside HD map workflow, LOAM output should be treated as an intermediate survey product that feeds the [map construction pipeline](../map-construction-pipeline.md), not as the final map-localization authority.

## Datasets/Metrics

Primary evaluations in the LOAM paper included:

- Indoor corridor and lobby experiments.
- Outdoor vegetated road and orchard experiments.
- KITTI odometry benchmark evaluation.
- Optional IMU-assisted handheld/staircase experiments.

Reported paper-level observations:

- Indoor closed-loop drift around 1 percent of distance traveled in the reported corridor tests.
- Outdoor orchard drift around 2.5 percent in the reported experiments.
- Accuracy competitive with state-of-the-art offline batch methods on KITTI at the time.

Recommended metrics for current evaluation:

- KITTI-style relative translation error and relative rotation error over fixed path lengths.
- Absolute trajectory error after alignment to RTK/INS or motion-capture ground truth.
- Relative pose error over 1 s, 10 s, and 100 m windows.
- Map cloud thickness on planar walls, floors, and curbs.
- Loop closure residual before and after global optimization.
- Feature count and degeneracy eigenvalue diagnostics by scene type.
- Runtime split between feature extraction, odometry, mapping, and map update.

Airside-specific metrics should include apron-only drift, terminal-edge drift, stand approach repeatability, GNSS-denied holdover time, and map consistency at ground-control checkpoints.

## Open-Source Implementations

- **Original LOAM ROS packages:** The paper referenced `loam_back_and_forth` and `loam_continuous` on the ROS wiki. These are historically important but not the easiest starting point for modern systems.
- **laboshinl/loam_velodyne:** A ROS port of LOAM for Velodyne sensors, commonly used as an accessible baseline.
- **HKUST A-LOAM:** A cleaned and widely used academic implementation using Eigen and Ceres.
- **LeGO-LOAM:** A ground-optimized descendant for UGVs.
- **LIO-SAM:** A later LiDAR-inertial smoothing system that reuses LOAM-style features inside a factor graph.

For modern evaluation, use LOAM as a baseline but compare against KISS-ICP, CT-ICP, LIO-SAM, FAST-LIO2, and production scan-to-map localization.

## Practical Recommendation

Use LOAM to understand feature-based LiDAR odometry and to benchmark later methods, but do not build a new production airside stack around original LOAM.

Recommended use:

- Historical baseline.
- Feature-extraction reference.
- Degeneracy analysis reference.
- Offline survey experiment in structured areas.
- Comparison point for LeGO-LOAM, LIO-SAM, and KISS-ICP.

Not recommended:

- Primary runtime localization for airside AVs.
- Long-term map construction without loop closure or ground-control alignment.
- Multi-LiDAR production deployment without a stronger fusion back end.
- Operation in large open aprons without external constraints.

For airside autonomy, a better architecture is: robust survey mapping with LiDAR-inertial or graph-SLAM back end, validated HD map construction, and runtime scan-to-map localization using VGICP/NDT with GTSAM fusion. LOAM contributes useful ideas to that stack, but should not be the stack.

## Sources

- Ji Zhang and Sanjiv Singh, "LOAM: Lidar Odometry and Mapping in Real-time," Robotics: Science and Systems, 2014. https://www.ri.cmu.edu/publications/loam-lidar-odometry-and-mapping-in-real-time/
- LOAM paper PDF, CMU Robotics Institute. https://publications.ri.cmu.edu/storage/publications/pub_files/2014/7/Ji_LidarMapping_RSS2014_v8.pdf
- laboshinl/loam_velodyne ROS implementation. https://github.com/laboshinl/loam_velodyne
- HKUST A-LOAM implementation. https://github.com/HKUST-Aerial-Robotics/A-LOAM
- Tixiao Shan and Brendan Englot, "LeGO-LOAM: Lightweight and Ground-Optimized Lidar Odometry and Mapping on Variable Terrain," IROS 2018. https://personal.stevens.edu/~benglot/Shan_Englot_IROS_2018_Preprint.pdf
- Tixiao Shan et al., "LIO-SAM: Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping," IROS 2020. https://github.com/TixiaoShan/LIO-SAM
