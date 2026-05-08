# KISS-ICP: Keep It Small and Simple ICP

Related localization docs: [SLAM algorithms](../overview/lidar-slam-algorithms.md), [production LiDAR map localization](../overview/production-lidar-map-localization.md), and [map construction pipeline](../maps/map-construction-pipeline.md).

## Executive Summary

KISS-ICP is a minimalist LiDAR odometry system from Vizzo, Guadagnino, Mersch, Wiesmann, Behley, and Stachniss, published in IEEE Robotics and Automation Letters in 2023. Its main claim is that point-to-point ICP, when engineered carefully, can match or exceed more complex LiDAR odometry systems without feature extraction, normals, IMU integration, loop closure, or dataset-specific tuning.

The system uses four core ideas: constant-velocity scan deskewing, voxel downsampling, adaptive correspondence thresholding, and robust point-to-point ICP against a bounded voxel-hash local map. It is LiDAR-only and designed to work across different sensors and platforms with the same parameter set.

For airside autonomous vehicles, KISS-ICP is one of the strongest practical baselines for LiDAR-only odometry. It is simple, inspectable, easy to run, and has a modern maintained implementation. It is not a full SLAM or production localization solution because it lacks loop closure, global optimization, semantic filtering, and map anchoring. Its best role is secondary odometry, map-building baseline, regression test, or fallback factor into a broader GTSAM localization stack.

## Historical Context

The LiDAR SLAM literature moved from original ICP to feature methods such as LOAM, surfel maps such as SuMa, implicit surfaces such as IMLS-SLAM, continuous-time methods such as CT-ICP, and many LiDAR-inertial systems. KISS-ICP deliberately moved in the opposite direction. It asked whether the complexity was always necessary.

The paper argues that many systems depend on hand-tuned feature extraction, normal estimation, motion-profile assumptions, or dataset-specific parameters. KISS-ICP removes most of those components and focuses on the minimum set needed for robust sequential LiDAR odometry. The authors evaluate across automotive platforms, UAV operation, segways, handheld LiDARs, and different LiDAR scan patterns.

The result is important for engineering: a small, well-tested baseline can outperform a complicated pipeline if the complicated pipeline is brittle. KISS-ICP has become a standard "first thing to try" for LiDAR-only odometry and a useful sanity check against more elaborate SLAM stacks.

## Sensor Assumptions

KISS-ICP assumes only a stream of 3D LiDAR point clouds, ideally with per-point relative timestamps for deskewing.

Key assumptions:

- Consecutive scans have enough overlap for ICP.
- The platform motion between scans is reasonably predicted by constant velocity.
- The scene has enough 3D geometric structure for point-to-point alignment.
- Dynamic objects do not dominate the scan.
- The LiDAR extrinsics are stable if data comes from a vehicle frame.
- Per-point timing or a reasonable scan-time model is available for motion compensation.

The method does not require:

- IMU.
- Wheel odometry.
- GNSS.
- Edge or plane features.
- Surface normals.
- Ground extraction.
- Sensor-specific feature thresholds.

This broad sensor compatibility is a major advantage for mixed LiDAR fleets and early data collection.

## Map Representation

KISS-ICP uses a bounded voxel-hash local map containing downsampled points.

Map details:

- The local map is a sparse voxel grid stored in a hash table.
- Each voxel stores a limited number of original points.
- The incoming scan is downsampled before registration.
- A separate downsampled version is used for map insertion.
- Voxels outside a configured range around the current pose are removed.
- The map remains local and bounded in memory.

The map is not a globally optimized HD map. It is a rolling registration target that supports odometry. The trajectory can be accumulated to build a point cloud, but without loop closure or external anchors the resulting map will drift over long distances.

## Algorithm Pipeline

1. **Motion prediction**
   - Predict the current pose from previous poses using a constant-velocity model.
   - Use this prediction as the initial guess for registration.

2. **Scan deskewing**
   - Use relative point timestamps and predicted motion to compensate rolling-shutter distortion within the scan.
   - No IMU is required.

3. **Voxel downsampling**
   - Downsample the deskewed scan spatially.
   - Use a reduced point set for ICP.
   - Keep another downsampled point set for local map update.

4. **Adaptive correspondence thresholding**
   - Estimate a correspondence distance threshold from the observed deviation between motion prediction and ICP corrections.
   - Increase tolerance when motion prediction is less reliable.
   - Tighten tolerance when registration is stable.

5. **Point-to-point ICP**
   - Find nearest-neighbor correspondences in the voxel-hash local map.
   - Reject correspondences beyond the adaptive threshold.
   - Optimize a robust point-to-point registration objective.

6. **Local map update**
   - Insert the registered downsampled scan into the voxel map.
   - Maintain bounded memory by limiting voxel contents and removing distant voxels.

7. **Pose output**
   - Compose incremental estimates into a LiDAR odometry trajectory.

KISS-ICP is an odometry pipeline. Pose graph optimization and loop closure are intentionally outside the core design.

## Formulation

KISS-ICP estimates the pose correction that aligns the current scan to the local map.

For each downsampled source point `p_i`, find a nearest neighbor `q_i` in the local map subject to a distance threshold `tau_k`. The registration objective is:

```text
T* = arg min_T sum_i rho(|| T * p_i - q_i ||^2)
```

where:

- `T` is the SE(3) pose correction.
- `rho` is a robust kernel, specifically a strong outlier-rejection M-estimator in the paper.
- `tau_k` is adapted online from previous registration deviations.

The adaptive threshold is the central robustness mechanism. Fixed correspondence thresholds are brittle: too small and ICP fails during high motion, too large and it accepts outliers. KISS-ICP estimates how far the constant-velocity prediction tends to be from the corrected pose and uses that history to choose a threshold for future correspondence search.

The method also separates prediction and correction. Constant velocity provides an initial guess and deskewing model. ICP estimates the correction needed to align the scan with the map. This design gives much of the benefit of motion compensation without requiring IMU preintegration.

## Failure Modes

- **Low-overlap scans:** Rapid turns, occlusions, or sparse scans can leave too few correspondences.
- **Purely planar/open scenes:** A flat apron or empty road can make yaw and lateral translation weakly observable.
- **Dominant dynamic objects:** If aircraft, buses, tugs, baggage trains, or crowds dominate the scan, ICP may align to moving objects.
- **Repeated structures:** Similar gates, stand equipment, walls, or poles can create local minima.
- **Extreme acceleration:** Constant-velocity prediction can be too poor for deskewing and correspondence gating.
- **Map pollution:** Once a badly aligned scan is inserted, later scans can lock onto the wrong local map.
- **No loop closure:** Long trajectories drift.
- **No absolute reference:** GNSS, wheel odometry, IMU, or map factors are needed for production global consistency.
- **Adverse weather:** Rain, fog, dust, and spray can add outliers that must be filtered upstream.

KISS-ICP is robust for its size, but it is still an ICP odometry system. It needs health metrics and fallback behavior in safety-critical deployments.

## AV Relevance

KISS-ICP is highly relevant to autonomous vehicles as a baseline and secondary odometry source.

Strengths:

- LiDAR-only: independent of IMU and wheel odometry failure modes.
- Simple enough to audit and debug.
- Few parameters and broad sensor support.
- Modern maintained implementation.
- Works well as a regression test across datasets.
- Easy to run on merged multi-LiDAR clouds if timestamps and extrinsics are handled upstream.

Limitations:

- Odometry only, not global localization.
- No loop closure in the core.
- No dynamic-object reasoning.
- No covariance calibration by default for factor-graph fusion.
- Point-to-point ICP may be less precise than VGICP for scan-to-map localization against a high-quality map.

For an AV stack, KISS-ICP is best used as:

- A secondary LiDAR odometry factor.
- A survey mapping baseline.
- A fallback when IMU integration is suspect.
- A validation check against wheel/IMU odometry.
- A simple baseline for comparing more complex methods.

It should not replace production scan-to-map localization described in [production LiDAR map localization](../overview/production-lidar-map-localization.md).

## Indoor/Outdoor Relevance

**Indoor:** KISS-ICP works well in many indoor environments because walls, columns, shelving, and corners provide dense geometry. Failure cases include long symmetric corridors, glass, moving crowds, and low-overlap turns.

**Outdoor:** It performs well in structured urban, campus, forest, and road scenes when scans overlap and dynamic objects are not dominant. It is weaker in open fields, wide roads without vertical structure, and large planar aprons.

**Mixed platforms:** A key advantage is cross-platform robustness. The paper evaluates different robot types and LiDAR patterns, including automotive platforms, handheld LiDARs, UAV-related data, and segway-style motion.

## Airside Deployment Notes

KISS-ICP is a strong candidate for airside secondary odometry, but not as the only localization source.

Good airside fit:

- Low-speed GSE motion helps the constant-velocity deskewing model.
- Multi-LiDAR rigs can provide large overlap and 360-degree structure if merged correctly.
- LiDAR-only independence is useful when GNSS is degraded near terminals or IMU faults are suspected.
- Simple runtime makes it attractive on embedded platforms.

Airside risks:

- Open apron geometry is often underconstrained.
- Aircraft and GSE motion can dominate the scan.
- Repeated stand layouts can create local minima.
- Ground markings are mostly 2D texture and do not help raw 3D ICP much.
- Safety-critical use requires covariance, monitors, and fallback states.

Recommended deployment pattern:

- Run KISS-ICP as a secondary odometry factor in GTSAM, alongside IMU, wheel, RTK, and scan-to-map factors.
- Gate its factor covariance using ICP residuals, correspondence count, overlap, and Hessian/eigenvalue degeneracy.
- Prevent dynamic objects from entering any persistent map product.
- Use it to validate survey-drive trajectories before final map construction.
- Do not use it as a stand-alone map-localization replacement.

## Datasets/Metrics

The KISS-ICP paper evaluates on a broad set of datasets and operating conditions, including automotive, handheld, UAV-related, and high-dynamic platforms. It reports operation faster than sensor frame rate across the presented datasets and emphasizes using the same parameters across sensors.

Important benchmarks and contexts:

- KITTI odometry.
- MulRan.
- NCLT.
- Newer College-style handheld data.
- Datasets with different LiDAR scan patterns and motion profiles.

Recommended metrics:

- KITTI relative translation and rotation error.
- Absolute trajectory error against RTK/INS or ground truth.
- Drift per kilometer and per minute.
- Runtime per scan and CPU load.
- Correspondence count, inlier ratio, and adaptive threshold value.
- Degeneracy indicators from the registration system.
- Map thickness and local consistency.
- Failure recovery behavior after low-overlap frames.

For airside evaluation, add metrics for apron-only drift, terminal-edge drift, route repeatability, docking approach repeatability, and consistency against surveyed control points.

## Open-Source Implementations

- **PRBonn/kiss-icp:** Primary implementation, MIT license, C++ core with Python and ROS support.
- **Python package:** Installable with `pip install kiss-icp`.
- **ROS2 wrapper:** Current supported ROS integration path.
- **ROS1 support:** Deprecated in newer KISS-ICP releases; older versions remain available for legacy systems.

The repository is actively maintained and is one of the easiest modern LiDAR odometry baselines to deploy.

## Practical Recommendation

KISS-ICP should be included in any serious 3D LiDAR SLAM Part A evaluation.

Use it as:

- The primary LiDAR-only odometry baseline.
- A secondary odometry factor candidate for airside GTSAM fusion.
- A survey-drive sanity check.
- A regression test for sensor changes and preprocessing.
- A simple benchmark against CT-ICP, LeGO-LOAM, LIO-SAM, and FAST-LIO2.

Do not use it alone for:

- Final HD map construction without loop closure or anchors.
- Safety-critical runtime localization.
- Long GNSS-denied operation without map matching.
- Dynamic clutter-heavy scenes without filtering.

The practical verdict is "best simple LiDAR-only baseline; pair it with graph fusion and map localization for production."

## Sources

- Ignacio Vizzo, Tiziano Guadagnino, Benedikt Mersch, Louis Wiesmann, Jens Behley, and Cyrill Stachniss, "KISS-ICP: In Defense of Point-to-Point ICP -- Simple, Accurate, and Robust Registration If Done the Right Way," IEEE Robotics and Automation Letters, 2023. https://arxiv.org/abs/2209.15397
- KISS-ICP paper DOI, IEEE RA-L. https://doi.org/10.1109/LRA.2023.3236571
- PRBonn/kiss-icp repository. https://github.com/PRBonn/kiss-icp
- KISS-ICP project page and PDF. https://www.ipb.uni-bonn.de/wp-content/papercite-data/pdf/vizzo2023ral.pdf
- PRBonn research group. https://github.com/PRBonn
- CT-ICP paper for comparison with continuous-time ICP. https://arxiv.org/abs/2109.12979
