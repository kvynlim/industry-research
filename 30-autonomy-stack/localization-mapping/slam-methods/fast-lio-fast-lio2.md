# FAST-LIO and FAST-LIO2

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "Core LiDAR-inertial baseline for mapping and localization fallback."
method-priority:end -->

## Executive Summary

FAST-LIO and FAST-LIO2 are tightly coupled LiDAR-inertial odometry systems from the HKU MARS Lab lineage. FAST-LIO introduced a fast iterated extended Kalman filter formulation for fusing LiDAR feature points and IMU data. FAST-LIO2 removed the feature extraction stage, directly registering raw LiDAR points to an incremental map maintained by an ikd-tree. The result is one of the most influential modern LIO baselines: fast, accurate, direct, and compatible with both spinning and solid-state LiDARs.

For AV and airside autonomy, FAST-LIO2 is best understood as a high-performance local odometry front end. It is not a complete global SLAM or production localization system by itself because the base implementation lacks loop closure, GPS factor integration, wheel odometry, and map-version handling. It should be paired with a robust state estimator or factor graph. See [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md), [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) for the surrounding stack.

## Historical Context

FAST-LIO was published as "A Fast, Robust LiDAR-inertial Odometry Package by Tightly-Coupled Iterated Kalman Filter." It targeted fast-motion, noisy, cluttered, and degenerate environments, with particular motivation from UAVs and solid-state LiDARs. Its key contribution was computational: use an iterated Kalman filter and a Kalman gain formula whose cost depends mainly on state dimension rather than the large LiDAR measurement dimension.

FAST-LIO2 followed as a major simplification and generalization. Instead of extracting edge and planar features as in LOAM, LeGO-LOAM, and LIO-SAM, it performs direct scan-to-map registration on raw points. This removed a hand-engineered feature module and made the method naturally suitable for non-repetitive scan patterns such as Livox solid-state LiDARs.

The second major FAST-LIO2 contribution was ikd-tree, an incremental k-d tree that supports point insertion, box-wise deletion, dynamic rebalancing, and downsampling. This made dense online mapping practical without rebuilding a full k-d tree at every scan.

## Sensor Assumptions

FAST-LIO2 assumes a 3D LiDAR and an IMU with known or calibrated extrinsics. Per-point timestamps are needed for motion compensation. The method supports mechanical spinning LiDARs such as Velodyne and Ouster and solid-state LiDARs such as Livox Avia, Horizon, and MID-series sensors in the reference ecosystem.

The IMU should be synchronized tightly enough that propagation and deskewing are meaningful. A typical operating regime is 100-500 Hz IMU data and 10-100 Hz LiDAR frame or packet groups. FAST-LIO2 estimates gravity in the state and does not require a magnetometer heading in the same way the original LIO-SAM README expects a 9-axis IMU, but initialization quality still matters.

The sensor frame convention is IMU-centric in the formulation. The LiDAR-to-IMU extrinsic transform is used to transform LiDAR points into the state frame. Any bias in time offset, extrinsic rotation, or extrinsic translation appears directly as map warping or systematic drift.

## State/Map Representation

The core state is an 18-dimensional manifold state:

```text
x = [R, p, v, b_g, b_a, g]

R   : orientation on SO(3)
p   : position in the global frame
v   : velocity in the global frame
b_g : gyroscope bias
b_a : accelerometer bias
g   : gravity vector
```

The covariance is maintained in the tangent error space. This is an error-state/iterated-EKF design, not a full trajectory smoother. The system estimates the current state and updates an incremental map, but it does not keep a globally optimized pose graph in the base implementation.

The map is a local/global point cloud indexed by ikd-tree. FAST-LIO2 stores raw map points after downsampling and supports:

- K-nearest-neighbor search for point-to-plane residual construction.
- Incremental insertion of newly accepted points.
- Lazy deletion of points outside a local map box.
- Tree rebalancing when subtrees become unbalanced.
- Downsampling integrated with tree operations.

FAST-LIO, the earlier version, used extracted features. FAST-LIO2 is the method most relevant for current AV comparison because it directly uses raw LiDAR points.

## Algorithm Pipeline

1. Buffer IMU and LiDAR packets or scans with timestamps.
2. Propagate the state forward using IMU measurements.
3. Use the propagated trajectory to undistort LiDAR points to the scan end time.
4. Downsample or filter points as configured.
5. For each selected point, find nearest map neighbors in the ikd-tree.
6. Fit a local plane from neighbors and compute a point-to-plane residual.
7. Run an iterated EKF update over all residuals.
8. Insert accepted points into the ikd-tree map and delete distant map regions.
9. Publish odometry, path, and optional accumulated map.

FAST-LIO2 is designed to keep this loop real time even when thousands of LiDAR residuals are used. The paper reports operation up to 100 Hz odometry and mapping in large outdoor environments.

## Formulation

The prediction model is an IMU-driven kinematic model on a compound manifold:

```text
R_dot = R * skew(omega_m - b_g - n_g)
p_dot = v
v_dot = R * (a_m - b_a - n_a) + g
b_g_dot = noise
b_a_dot = noise
g_dot = 0
```

where `omega_m` and `a_m` are gyroscope and accelerometer measurements. The state is propagated at IMU rate.

The LiDAR update uses direct point-to-plane residuals:

```text
r_i(x) = n_i^T * (T(x) * p_i - q_i)

p_i : undistorted LiDAR point
q_i : point or centroid on local map plane
n_i : plane normal estimated from nearby map points
T(x): transform implied by the current state and LiDAR-IMU extrinsic
```

The iterated EKF linearizes residuals around the current estimate, solves for an error-state correction, updates the state on the manifold, and repeats until convergence. FAST-LIO's efficiency contribution is the update algebra that avoids inverting matrices whose dimension grows with the number of LiDAR point residuals.

Compared with factor-graph methods, this filter formulation is faster and lower latency, but less flexible for delayed, nonlocal, or loop-closure measurements. Those are better handled by a backend like the one described in [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Failure Modes

- No loop closure means drift accumulates on long missions.
- Featureless or geometrically degenerate scenes can leave yaw, lateral position, or height weakly constrained.
- Large moving objects can be inserted into the map and create future false correspondences.
- Missing or incorrect per-point timestamps degrade motion compensation.
- IMU-LiDAR time offset creates systematic distortion that the filter may absorb as bias or map error.
- Wrong extrinsics cause tilted maps, scale-like drift, or inconsistent scan alignment.
- IMU saturation and severe vibration can break the standard motion model; Point-LIO was partly designed to address this regime.
- Map memory and compute must be bounded explicitly for long routes.
- Base FAST-LIO2 does not validate GNSS, wheel odometry, or external map measurements because it does not include those factors.
- GPL-family licensing in common HKU MARS repositories may constrain direct product integration and requires legal review.

## AV Relevance

FAST-LIO2 is directly relevant as a local odometry engine. It can provide a high-rate relative motion estimate when GNSS is degraded, when the prebuilt map is unavailable, or during survey map creation. It is especially attractive for mixed LiDAR hardware because it does not depend on LOAM-style ring feature extraction.

Its limitation is global consistency. Production AV localization usually needs fixed-frame constraints from HD maps, RTK, wheel odometry, lane/curb landmarks, or airport infrastructure. FAST-LIO2 can feed such a system as a relative odometry factor, but it should not replace the backend fusion layer. The correct production pattern is:

```text
FAST-LIO2 relative odometry
  -> robust gating and covariance estimation
  -> ESKF or factor graph
  -> map/RTK/wheel/loop constraints
  -> safety-rated localization output
```

## Indoor/Outdoor Relevance

Indoors, FAST-LIO2 performs well in cluttered warehouses, tunnels, multi-floor buildings, and hangars where walls, equipment, pillars, and ceiling structure provide LiDAR constraints. It can outperform feature-based systems when geometry is subtle but still informative because it uses raw points rather than a small feature subset.

Outdoors, it is strong on campus, urban, yard, and mixed indoor-outdoor routes. It is less sufficient on open highways, open aprons, or large flat lots unless external constraints are fused. It has no inherent mechanism to correct long-term drift after revisiting a place.

## Airside Deployment Notes

For airside GSE, FAST-LIO2 is a good candidate for secondary odometry, survey mapping, and GPS-denied fallback. It should be deployed with conservative validity checks:

- Monitor residual distribution, correspondence count, and local map conditioning.
- Inflate covariance in flat open areas and near large moving aircraft.
- Prevent dynamic apron objects from entering the persistent map when possible.
- Fuse wheel odometry and nonholonomic constraints for low-speed vehicles.
- Use RTK/GNSS only after innovation gating and multipath checks.
- Keep the local map bounded to avoid long-route memory growth.
- Treat any global correction as a backend responsibility, not a FAST-LIO2 feature.

Multi-LiDAR airside platforms need an integration decision. Either merge synchronized point clouds into one calibrated LiDAR frame before FAST-LIO2, or run separate odometry front ends and fuse their outputs. The first path is simpler but more sensitive to cross-LiDAR timing and extrinsics.

## Datasets/Metrics

FAST-LIO2 reports exhaustive benchmark comparisons on 19 sequences from open LiDAR datasets, plus real-world experiments with solid-state LiDARs and aggressive rotations. Useful metrics include:

- Absolute trajectory error against motion-capture, GNSS/INS, or benchmark ground truth.
- Relative pose error and drift percentage over path segments.
- Runtime per LiDAR frame and maximum latency.
- CPU load and memory growth over distance.
- Number of residuals used, rejected, and accepted.
- Degeneracy indicators from the residual Jacobian or covariance.
- Map quality metrics such as plane sharpness, ghosting, and revisit alignment.

For airport testing, add availability under GNSS denial, lateral docking-lane error, map alignment across repeated shifts, and false-confidence events in open apron geometry.

## Open-Source Implementations

- `hku-mars/FAST_LIO`: primary open-source repository for FAST-LIO and FAST-LIO2.
- `hku-mars/ikd-Tree`: incremental k-d tree data structure associated with FAST-LIO2.
- `hku-mars/IKFoM`: iterated Kalman filtering on manifolds used in the broader MARS ecosystem.
- Faster-LIO and Faster-LIO-style forks replace ikd-tree with incremental voxel maps for speed, but they are separate methods.

The reference implementation is ROS/C++ oriented and commonly used with Livox, Velodyne, and Ouster data. Product use should review license, dependency, and maintenance status.

## Practical Recommendation

Use FAST-LIO2 as the default modern baseline for pure LiDAR-inertial odometry. It is faster and more sensor-general than LIO-SAM's feature front end. It is not enough as a standalone airside localization system because it lacks global correction and robust multi-sensor validation.

For a production airside stack, pair FAST-LIO2 with a backend that already handles RTK, wheel odometry, map matching, and fault detection. If the project needs interpretable factor insertion and loop closure more than raw odometry speed, study LIO-SAM alongside FAST-LIO2.

## Sources

- Xu, W. and Zhang, F. "FAST-LIO: A Fast, Robust LiDAR-inertial Odometry Package by Tightly-Coupled Iterated Kalman Filter." https://arxiv.org/abs/2010.08196
- Xu, W., Cai, Y., He, D., Lin, J., and Zhang, F. "FAST-LIO2: Fast Direct LiDAR-inertial Odometry." IEEE Transactions on Robotics, 2022. https://arxiv.org/abs/2107.06829
- Original FAST-LIO repository and README. https://github.com/hku-mars/FAST_LIO
- FAST-LIO2 author publication page. https://jiaronglin.com/publication/paper_fast_lio2/
- Local context: [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md)
- Local context: [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- Local context: [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
