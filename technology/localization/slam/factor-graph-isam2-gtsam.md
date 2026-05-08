# Factor Graph SLAM with iSAM2 and GTSAM

## Executive Summary

Factor graph SLAM is the modern generalization of graph-based state estimation. Variables represent unknowns such as poses, velocities, IMU biases, landmarks, calibration parameters, and map anchors. Factors represent probabilistic constraints from sensors and priors. GTSAM is the most influential robotics library for this formulation, and iSAM2 is its incremental smoothing algorithm based on the Bayes tree.

For AV and airside autonomous vehicles, this is the recommended backend architecture. It can fuse LiDAR odometry, loop closures, RTK/GPS, IMU preintegration, wheel odometry, fiducials, map priors, and calibration factors in one sparse optimization problem. Unlike EKF-SLAM, it does not force all uncertainty into one dense covariance matrix. Unlike simple pose graph optimization, it can represent heterogeneous variables and sensor factors naturally. Unlike batch-only solvers, iSAM2 updates only the affected part of the Bayes tree and supports real-time incremental operation.

This page is a method-level SLAM reference. For implementation details, custom factor examples, noise-model tuning, and GTSAM API notes, see [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Historical Context

Factor graphs come from graphical-model inference, where complex joint distributions are expressed as products of local factors. Dellaert and collaborators adapted this view to robotics through smoothing and mapping (SAM), showing that SLAM, structure from motion, and sensor fusion can be represented as sparse factor graphs. The original iSAM incrementally updated a square-root information matrix but still needed periodic batch relinearization and reordering. iSAM2 introduced the Bayes tree, fluid relinearization, and incremental variable reordering, making incremental smoothing practical for online SLAM.

GTSAM then became the reference library for factor-graph robotics. It supports manifold variables, sparse nonlinear optimization, IMU preintegration, GPS factors, projection factors, pose factors, robust noise models, fixed-lag smoothing, and custom factors. Many modern SLAM systems, including LiDAR-inertial systems such as LIO-SAM, use GTSAM for backend optimization.

Historically, factor graph SLAM sits after EKF-SLAM, FastSLAM, and GraphSLAM. EKF-SLAM showed why correlations matter. FastSLAM showed how conditional independence can reduce complexity. GraphSLAM showed sparse optimization at scale. Factor graphs unify these lessons in a compositional representation that matches real multi-sensor systems.

## Sensor Assumptions

Factor graph SLAM assumes each sensor can provide a residual function:

```text
e_i(X_i) = h_i(X_i) - z_i
```

or, on manifolds:

```text
e_i(X_i) = local_coordinates(z_i, h_i(X_i))
```

Common AV factors:

- Prior factor on initial pose or map anchor.
- Between factor from wheel odometry.
- IMU preintegration factor between keyframes.
- GPS/RTK position factor.
- LiDAR scan matching factor from ICP/GICP/NDT.
- Direct LiDAR matching-cost factor.
- Visual projection factor for landmarks.
- Loop closure factor from place recognition.
- Bias random-walk factor for IMU.
- Calibration/extrinsic factor.
- Plane, line, fiducial, or surveyed landmark factor.

The method does not require all sensors to operate at the same rate. High-rate IMU samples can be preintegrated, LiDAR keyframes can arrive at 5-20 Hz, GPS can arrive at 1-10 Hz, and loop closures can be rare.

The key assumption is not that all noise is perfectly Gaussian; it is that each factor's residual and uncertainty are modeled honestly enough for optimization. Outlier-heavy factors need robust losses or explicit switch/outlier models.

## State and Map Representation

A factor graph has variables and factors:

```text
Variables:
  X_i = pose at keyframe i
  V_i = velocity at keyframe i
  B_i = IMU bias at keyframe i
  L_j = landmark j
  C_k = calibration parameter k

Factors:
  f_prior(X_0)
  f_odom(X_i, X_{i+1})
  f_imu(X_i, V_i, B_i, X_j, V_j, B_j)
  f_gps(X_i)
  f_lidar(X_i, X_j)
  f_loop(X_i, X_j)
  f_projection(X_i, L_j)
```

The posterior factorizes as:

```text
p(X | Z) proportional_to product_i f_i(X_i)
```

GTSAM separates:

- `NonlinearFactorGraph`: the objective function / factor structure.
- `Values`: the current assignment for variables.
- `NoiseModel`: the uncertainty or robust loss attached to each factor.
- `ISAM2`: the incremental optimizer and Bayes tree manager.

The map can be explicit or derived:

- Sparse visual landmarks in the graph.
- Pose graph trajectory plus point cloud map outside the graph.
- Submaps with relative pose variables.
- Occupancy/TSDF/ESDF maps integrated from optimized poses.

For airside autonomy, the most practical state is a pose/velocity/bias graph with LiDAR and GPS constraints, while dense maps remain outside the optimizer as products of the optimized trajectory.

## Algorithm Pipeline

1. **Initialize graph and priors.** Add a prior on the first pose and, if inertial, velocity and IMU bias.

2. **Run front-end odometry.** Generate initial pose guesses from wheel, IMU, LiDAR odometry, visual odometry, or fused ESKF output.

3. **Create keyframes.** Add variables when the vehicle moves far enough, rotates enough, or accumulates enough information.

4. **Add incremental factors.**

- Wheel odometry between consecutive poses.
- IMU preintegration between keyframes.
- LiDAR scan-to-scan or scan-to-map constraints.
- GPS/RTK factors when quality gates pass.
- Bias random-walk factors.

5. **Call iSAM2 update.**

```text
isam.update(new_factors, new_values)
estimate = isam.calculateEstimate()
```

6. **Detect and verify loop closures.** Place recognition proposes candidates; geometric alignment estimates transform and covariance; consistency checks decide insertion.

7. **Add robust loop factors.** Use robust kernels or switchable/outlier-aware factors for loop closures.

8. **Relinearize and reorder incrementally.** iSAM2 handles affected Bayes tree cliques rather than re-solving everything.

9. **Publish global correction.** Use the optimized trajectory to update `map -> odom` or map products, not to create sudden control-frame jumps.

10. **Marginalize or fixed-lag smooth for bounded memory.** Long-running vehicles need fixed-lag smoothing, submaps, or offline batch refinement.

11. **Monitor health.** Track residuals, update time, marginal covariance, NIS/chi-square consistency, graph size, and loop closure corrections.

## Formulation

The MAP estimate is:

```text
X* = argmax_X p(X | Z)
   = argmin_X sum_i ||e_i(X_i)||^2_{Sigma_i}
```

where:

```text
||e||^2_Sigma = e^T Sigma^-1 e
```

For a relative pose factor:

```text
e_ij = Log( Z_ij^-1 * X_i^-1 * X_j )
```

For a GPS position factor:

```text
e_i = translation(X_i) - p_gps
```

For a camera projection factor:

```text
e_ij = z_ij - pi(K, X_i^-1 L_j)
```

For a robust factor:

```text
cost_i = rho( e_i^T Sigma_i^-1 e_i )
```

iSAM2 solves the nonlinear problem incrementally:

1. Linearize affected nonlinear factors around current values.
2. Represent the linearized problem as a Bayes tree.
3. Identify cliques affected by new factors and relinearized variables.
4. Remove affected cliques, add new factors, and re-eliminate locally.
5. Reattach unchanged subtrees.

This avoids full batch optimization on every timestep while preserving the smoothing formulation.

## Failure Modes

**Underconstrained variables.** Missing priors, unobservable landmarks, or isolated variables produce singular systems.

**Bad initialization.** Nonlinear optimization is local. LiDAR and visual factors need initial guesses inside the convergence basin.

**False loop closures.** Incorrect long-range factors can corrupt the graph unless robust mechanisms catch them.

**Overconfident noise models.** Tight covariance on weak scan matching, GPS multipath, or bad visual matches can dominate the solution.

**Linearization drift.** Variables far from their linearization point require relinearization. iSAM2 manages this, but thresholds must be tuned.

**Marginalization inconsistency.** Fixed-lag smoothing creates dense priors at old linearization points. Poor marginalization can introduce inconsistency.

**Numerical conditioning.** Mixing units, extreme covariance ratios, constrained noise models, and poorly observable geometry can destabilize sparse factorization.

**Compute spikes.** Large loop closures can affect many Bayes tree cliques and cause update-time spikes.

**Frame misuse.** Applying global graph corrections directly to control-frame odometry can create unsafe pose jumps.

## AV Relevance

Factor graph SLAM is directly relevant to AV localization and mapping:

- Supports heterogeneous sensors in one estimator.
- Handles loop closure and map reuse.
- Supports offline and online workflows.
- Provides marginal covariance for health monitoring.
- Can incorporate RTK/GPS without treating it as always trustworthy.
- Can represent IMU biases, wheel odometry, calibration, and map priors.

The usual production split is:

- ESKF/INS for high-rate, smooth control pose.
- Factor graph for global correction and map consistency.
- Occupancy/TSDF/ESDF maps for planning and collision checking.
- Place recognition for loop closure and relocalization.

That split is consistent with [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md).

## Indoor/Outdoor Relevance

**Indoor:** Factor graphs work well for visual-inertial, RGB-D, LiDAR, fiducial, and UWB fusion. Loop closures are frequent and GPS is absent, making smoothing valuable.

**Outdoor:** Factor graphs are standard for LiDAR-inertial-GNSS SLAM and HD map construction. Outdoor systems need robust GPS handling, dynamic object filtering, and weather-aware scan matching.

**Large-scale mixed environments:** Factor graphs are especially strong when switching between GPS-available and GPS-denied zones because factor weighting and gating can change by context.

## Airside Deployment Notes

For airport apron operation, a practical graph can include:

```text
X_i: vehicle pose at LiDAR keyframes
V_i: vehicle velocity
B_i: IMU bias

Factors:
  prior(X_0, V_0, B_0)
  imu(X_i, V_i, B_i, X_{i+1}, V_{i+1}, B_{i+1})
  wheel_odom(X_i, X_{i+1})
  lidar_gicp(X_i, X_{i+1} or submap)
  gps_rtk(X_i)
  loop_closure(X_i, X_j)
  gcp_or_map_anchor(X_i)
```

Airside-specific recommendations:

- Inflate GPS covariance near terminals, aircraft, and known multipath zones.
- Use robust losses for GPS and loop closure factors.
- Use semantic/dynamic filtering before LiDAR scan matching.
- Maintain a smooth odometry frame for control.
- Use GCPs and RTK only after quality gates for map construction.
- Log factor residuals for safety-case traceability.
- Bound online graph growth with fixed-lag smoothing or submap variables.
- Push full multi-session optimization to offline map construction.

Factor graph outputs should feed [Real-Time Occupancy Grid Mapping](../realtime-occupancy-grid-mapping.md) and the map products described in [Map Construction Pipeline](../map-construction-pipeline.md).

## Datasets and Metrics

Useful datasets:

- **KITTI odometry:** Outdoor vehicle trajectories for LiDAR/vision odometry and SLAM.
- **EuRoC MAV:** Visual-inertial factor graph evaluation.
- **TUM RGB-D:** RGB-D SLAM and pose graph evaluation.
- **Newer College:** LiDAR, inertial, and vision with ground truth.
- **MulRan:** Range-sensor place recognition and loop closure relevance.
- **RADISH / Intel / Freiburg / Killian Court:** Classic 2D graph SLAM datasets.
- **UTIAS MR.CLAM:** Landmark and multi-robot factor-graph experiments.

Metrics:

- ATE/RPE and drift per distance.
- Marginal covariance and consistency.
- Factor residual distributions by sensor.
- NIS/chi-square gating statistics.
- Loop closure precision, recall, and correction magnitude.
- iSAM2 update latency distribution, including loop closure spikes.
- Graph size, clique size, and memory growth.
- Map alignment error against GCPs or RTK ground truth.

For production, report not just mean accuracy but worst-case update latency and outlier rejection behavior.

## Open-Source Implementations

- **GTSAM official site:** https://gtsam.org/
- **GTSAM GitHub:** https://github.com/borglab/gtsam
- **GTSAM tutorials:** https://gtsam.org/tutorials/intro.html
- **GTSAM by Example:** https://gtbook.github.io/gtsam-examples/
- **LIO-SAM:** GTSAM-based LiDAR-inertial odometry and mapping: https://github.com/TixiaoShan/LIO-SAM
- **Kimera:** Visual-inertial and metric-semantic SLAM framework: https://github.com/MIT-SPARK/Kimera
- **gtsam_points:** GPU/point-cloud factors and GICP-related GTSAM extensions: https://github.com/koide3/gtsam_points
- **g2o and Ceres:** Important alternatives for batch graph optimization and BA: https://github.com/RainerKuemmerle/g2o and https://ceres-solver.org/

## Practical Recommendation

Use GTSAM/iSAM2 or an equivalent factor graph as the primary SLAM backend for airside autonomous vehicles. Keep the graph factor set conservative, observable, and diagnosable. The strongest architecture is:

- High-rate ESKF/INS for control.
- iSAM2 factor graph for global smoothing.
- Verified loop closure from place recognition.
- Robust RTK/GPS factors with adaptive covariance.
- LiDAR scan matching or matching-cost factors.
- Offline batch refinement for fleet map construction.

Avoid pushing every raw measurement into the graph. Use front ends to summarize high-rate data into well-characterized factors, and reserve graph complexity for variables that improve observability and map consistency.

## Related Repository Docs

- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md)
- [LiDAR Place Recognition and Re-Localization](../lidar-place-recognition-relocalization.md)
- [Real-Time Occupancy Grid Mapping](../realtime-occupancy-grid-mapping.md)
- [Map Construction Pipeline](../map-construction-pipeline.md)

## Sources

- Dellaert, "Factor Graphs and GTSAM: A Hands-on Introduction," technical report and updated tutorial: https://gtsam.org/tutorials/intro.html
- Dellaert technical report page: https://www.borg.cc.gatech.edu/papers/gtsam.html
- Kaess et al., "iSAM2: Incremental Smoothing and Mapping Using the Bayes Tree," IJRR, 2012: https://www.cs.cmu.edu/~kaess/pub/Kaess12ijrr.pdf
- Kaess et al., "iSAM2: Incremental Smoothing and Mapping with Fluid Relinearization and Incremental Variable Reordering," ICRA 2011: https://people.csail.mit.edu/kaess/pub/Kaess11icra.pdf
- GTSAM GitHub repository: https://github.com/borglab/gtsam
- GTSAM ISAM2 Doxygen: https://gtsam.org/doxygen/a01966.html
- GTSAM robust noise model tutorial/blog: https://gtsam.org/2019/09/20/robust-noise-model.html
- Forster et al., "IMU Preintegration on Manifold for Efficient Visual-Inertial Maximum-a-Posteriori Estimation": https://arxiv.org/abs/1512.02363
- LIO-SAM repository: https://github.com/TixiaoShan/LIO-SAM
- GTSAM by Example SFM/SLAM examples: https://gtbook.github.io/gtsam-examples/
