# EKF-SLAM

<!-- method-priority:start
priority:
  learning: 5
  deployment: 2
  type: "method-family"
  stage: "foundation"
  maturity: "historical"
  tags: ["slam", "indoor"]
  reason: "Foundation for estimator thinking, but rarely the direct modern AV stack."
method-priority:end -->

## Executive Summary

Extended Kalman Filter SLAM is the classical recursive formulation of simultaneous localization and mapping. It keeps a single joint Gaussian belief over the robot pose and all mapped landmarks, propagates that belief through the motion model, and updates it whenever landmarks are observed. Its main historical importance is that it proved SLAM could be solved probabilistically and gave robotics a concrete implementation pattern: keep cross-correlations between robot pose and landmarks, because those correlations are the information that makes loop closure possible.

EKF-SLAM is still useful as a teaching baseline, a small-landmark local mapper, and a fiducial or beacon-based estimator. It is not a good primary SLAM backend for large autonomous-vehicle maps. The dense covariance grows quadratically with landmark count, linearization creates consistency problems, and wrong data association can corrupt the whole map in one update. For airside autonomous ground support equipment, EKF-SLAM is best treated as a local precision module for deliberately placed landmarks, reflectors, docking aids, or small indoor work cells. The production global estimator should be a factor-graph or smoothing backend, as covered in [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) and [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).

## Historical Context

EKF-SLAM descends from stochastic mapping. Smith, Self, and Cheeseman introduced the idea that uncertain spatial relationships should be stored in a joint probabilistic map, including correlations between estimates. Dissanayake, Newman, Clark, Durrant-Whyte, and Csorba then gave the widely cited EKF-based solution to the SLAM problem, showing that the full covariance structure is not an implementation detail but the mechanism by which observing old landmarks reduces vehicle uncertainty.

Through the late 1990s and early 2000s, EKF-SLAM was the default SLAM formulation for range-bearing landmark maps. It was attractive because the Kalman filter was well understood, recursive, and implementable on embedded processors. The method also exposed the hard problems that drove later SLAM research: data association, map management, inconsistency under nonlinear motion and observation models, and poor scaling. FastSLAM attacked the covariance scaling problem with Rao-Blackwellized particle filters; GraphSLAM and factor graphs moved the field toward sparse smoothing and nonlinear least squares.

Bailey and Durrant-Whyte's tutorial papers and Bailey et al.'s consistency analysis are especially important for interpreting EKF-SLAM today. The key lesson is not that EKF-SLAM is "wrong"; it is that EKF-SLAM is reliable only when its linearization assumptions are actively protected by good initialization, small heading uncertainty, careful association, and bounded map size.

## Sensor Assumptions

EKF-SLAM assumes measurements can be expressed as differentiable functions of the current robot state and map landmarks. The canonical setup is a 2D robot with wheel odometry and a range-bearing sensor observing point landmarks:

```text
u_k = odometry or IMU-derived control input
z_k^i = [range_i, bearing_i] for landmark i
x_k = [robot_pose, landmark_1, ..., landmark_n]
```

The method can be extended to stereo cameras, fiducial tags, UWB beacons, radar reflectors, or 3D LiDAR-extracted primitives, but the assumptions remain the same:

- Sensor noise is approximately Gaussian after calibration and gating.
- Motion and observation models are smooth enough for first-order Taylor linearization.
- Landmarks are static, repeatably observable, and representable by a compact state.
- Data association is known or can be solved with high confidence.
- The number of active landmarks is small enough for a dense covariance matrix.

EKF-SLAM is poorly matched to raw dense LiDAR point clouds, image pixels, or large unstructured maps. Those observations need front-end feature extraction before the EKF can use them. For modern LiDAR AV stacks, the LiDAR front end normally produces scan-matching odometry, loop closures, or occupancy updates rather than individual EKF landmarks; see [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md) and [Real-Time Occupancy Grid Mapping](../maps/realtime-occupancy-grid-mapping.md).

## State and Map Representation

The EKF belief is a joint Gaussian:

```text
p(x_k | z_1:k, u_1:k) ~= N(mu_k, P_k)

mu_k = [x_r, y_r, theta_r, m_1_x, m_1_y, ..., m_n_x, m_n_y]^T
P_k  = dense covariance over robot pose and all landmarks
```

The essential feature is that `P_k` contains cross-covariances:

```text
P =
[ P_rr  P_rm ]
[ P_mr  P_mm ]
```

`P_rr` is robot-pose uncertainty, `P_mm` is landmark uncertainty, and `P_rm`/`P_mr` encode how errors in the robot pose and map landmarks are correlated. These off-diagonal terms are why revisiting a known landmark can correct the robot pose and all correlated landmarks. Dropping them turns SLAM into independent localization plus mapping and loses global consistency.

Landmarks are usually represented as 2D points for range-bearing SLAM. Alternatives include line segments, planes, AprilTags, retroreflectors, visual landmarks with inverse-depth parameterization, or known fixed beacons. The representation should be minimal and observable from the available sensors. A large, ambiguous, or partially observable landmark representation quickly breaks the Gaussian approximation.

## Algorithm Pipeline

1. **Initialize the robot pose.** Start with `mu_0` and covariance `P_0`. If no global reference is available, the first pose defines the map frame.

2. **Predict with the motion model.** Apply odometry or IMU-derived control input:

```text
mu_r^- = f(mu_r, u_k)
P^-    = F P F^T + G Q G^T
```

Landmark means remain unchanged during prediction, but their covariance relative to the robot changes through cross-correlations.

3. **Predict landmark observations.** For each visible or candidate landmark:

```text
z_hat_i = h(mu_r^-, mu_i^-)
innovation_i = z_i - z_hat_i
S_i = H_i P^- H_i^T + R
```

4. **Associate observations.** Use nearest-neighbor Mahalanobis gating, joint compatibility branch and bound, known IDs, or a fiducial code. Association is the safety-critical step; a confident wrong association is worse than a missed update.

5. **Initialize new landmarks.** For unmatched measurements above confidence thresholds, invert the sensor model:

```text
m_new = g(mu_r, z_new)
```

Augment `mu` and `P` with the new landmark covariance and cross-correlation blocks.

6. **Update the joint belief.** Stack associated residuals and use the EKF update:

```text
K  = P^- H^T (H P^- H^T + R)^-1
mu = mu^- + K (z - h(mu^-))
P  = (I - K H) P^- (Joseph form preferred for numerical stability)
```

7. **Manage the map.** Remove unstable landmarks, merge duplicates, split submaps, and monitor consistency using innovation statistics.

## Formulation

The nonlinear state-space model is:

```text
x_k = f(x_{k-1}, u_k) + w_k,        w_k ~ N(0, Q_k)
z_k = h(x_k) + v_k,                 v_k ~ N(0, R_k)
```

Because `f` and `h` are nonlinear, EKF-SLAM linearizes around the current estimate:

```text
F_k = df/dx evaluated at mu_{k-1}, u_k
H_k = dh/dx evaluated at mu_k^-
```

Prediction:

```text
mu_k^- = f(mu_{k-1}, u_k)
P_k^-  = F_k P_{k-1} F_k^T + Q_k
```

Update:

```text
y_k = z_k - h(mu_k^-)
S_k = H_k P_k^- H_k^T + R_k
K_k = P_k^- H_k^T S_k^-1
mu_k = mu_k^- + K_k y_k
P_k = (I - K_k H_k) P_k^- (I - K_k H_k)^T + K_k R_k K_k^T
```

For a 2D range-bearing landmark `m_i = [m_x, m_y]` and robot pose `r = [x, y, theta]`:

```text
dx = m_x - x
dy = m_y - y
q  = dx^2 + dy^2

h(r, m_i) =
[ sqrt(q),
  atan2(dy, dx) - theta ]
```

The Jacobian has nonzero columns only for the robot pose and the observed landmark, but multiplication by the dense covariance still touches the full map. This gives the standard EKF-SLAM complexity profile:

- State size grows as `O(n)` for `n` landmarks.
- Covariance storage grows as `O(n^2)`.
- A single update is typically `O(n^2)` because all cross-correlations must be updated.
- Joint compatibility data association can be exponential in the number of simultaneous observations without pruning.

## Failure Modes

**Linearization inconsistency.** EKF-SLAM can become overconfident because first-order linearization changes the observability properties of the true nonlinear system. Heading uncertainty is especially dangerous: once true heading uncertainty grows beyond the local-linear regime, landmark updates can spuriously reduce unobservable global yaw uncertainty.

**Wrong data association.** A single false landmark association can pull the robot pose and correlated landmarks into a wrong configuration. Because the covariance is joint, the error spreads globally.

**Dense covariance scaling.** Large maps are expensive. Every landmark adds covariance rows and columns, so long AV-scale routes are impractical unless the map is partitioned into submaps.

**Poor landmark geometry.** Collinear landmarks, distant landmarks, and low-parallax observations produce weak constraints. The filter may look numerically stable while becoming geometrically unobservable.

**Dynamic objects.** If moving vehicles, people, aircraft, or baggage carts are admitted as static landmarks, the map is corrupted.

**Overconfident tuning.** Underestimated measurement noise causes filter divergence. In practice, `R` should include calibration error, timestamp error, association ambiguity, and environmental effects, not just the sensor datasheet noise.

**Map-frame gauge freedom.** Without a fixed prior or external reference, global translation and rotation are arbitrary. That is acceptable if the map frame is local, but it must be explicit when comparing with RTK or HD maps.

## AV Relevance

EKF-SLAM is not the right core architecture for an AV-scale localization stack. Modern AVs need multi-kilometer maps, multi-session map construction, loop closure, scan matching, camera constraints, GPS/RTK factors, and IMU preintegration. Those requirements favor smoothing and factor graphs, not a single dense EKF covariance.

EKF-SLAM remains relevant in narrow roles:

- Local fiducial or reflector maps for precision docking.
- Indoor work cells with a few known landmarks.
- Sensor health monitoring through innovation tests.
- Educational baselines for comparing consistency and covariance behavior.
- A short-horizon feature tracker feeding a graph backend.

For an airside vehicle, the high-rate state estimator should be an ESKF or related filter, while the global trajectory/map backend should be GTSAM/iSAM2. EKF-SLAM can be nested inside that architecture as a local landmark module, but it should not own the global map.

## Indoor/Outdoor Relevance

**Indoor:** EKF-SLAM works well in small indoor spaces with artificial landmarks, AprilTags, UWB anchors, retroreflectors, or clean range-bearing features. It is easy to validate with motion capture and closed-loop routes.

**Outdoor:** EKF-SLAM becomes fragile outdoors unless landmarks are deliberately engineered. Natural landmarks are harder to detect repeatably, data association is ambiguous, and map size grows rapidly. Outdoor AV systems usually use scan matching, GNSS/INS, HD maps, and factor graphs instead.

**Transition spaces:** Warehouses, tunnels, terminals, and depot yards can be good EKF-SLAM environments if landmark count is controlled and IDs are known. These are the strongest deployment cases.

## Airside Deployment Notes

Airside operations create both a use case and a warning. The use case is precision localization near stands, docking paths, charging points, maintenance bays, and terminal-adjacent GPS-denied areas. Carefully placed reflectors or tags can provide repeatable landmarks where GPS multipath is expected.

The warning is that the apron is dynamic and repetitive. Aircraft, belt loaders, tugs, containers, and personnel move frequently. Adjacent stands can look similar. Wet tarmac and aircraft skins create reflections. A naive EKF-SLAM landmark map will happily absorb dynamic objects and false associations.

Recommended airside pattern:

- Use EKF-SLAM only with intentionally selected landmark classes: fiducials, reflectors, fixed signs, surveyed poles, or stable building features.
- Gate every observation with Mahalanobis distance and semantic/ID checks.
- Keep maps local to an operational zone or docking maneuver.
- Reset or hand off to the main estimator after the local task completes.
- Feed accepted local pose constraints to the factor-graph backend rather than letting EKF-SLAM maintain global authority.
- Validate innovations with the same monitoring philosophy used in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).

## Datasets and Metrics

Useful datasets:

- **UTIAS MR.CLAM:** 2D indoor multi-robot dataset with odometry, range-bearing measurements, robot ground truth, and landmark ground truth. Good for EKF-SLAM, cooperative localization, and consistency checks.
- **Victoria Park:** Classic outdoor vehicle dataset with laser-observed tree landmarks. Historically important for EKF-SLAM and submap methods.
- **RADISH 2D laser datasets:** Useful when comparing landmark EKF baselines against grid and graph methods.
- **TUM RGB-D and EuRoC MAV:** More relevant for visual SLAM than classical EKF-SLAM, but useful when testing EKF-style landmark filters with visual features.

Metrics:

- Absolute Trajectory Error (ATE) after alignment.
- Relative Pose Error (RPE) over fixed time or distance windows.
- Landmark RMSE against surveyed landmarks.
- Normalized Innovation Squared (NIS) for measurement consistency.
- Normalized Estimation Error Squared (NEES) when ground truth is available.
- Data association precision/recall.
- Loop closure correction magnitude.
- Runtime and memory versus landmark count.

The key metric for EKF-SLAM is not only trajectory accuracy; it is consistency. A filter that reports 2 cm uncertainty while making 30 cm errors is worse than a conservative filter that reports 50 cm uncertainty.

## Open-Source Implementations

- **PythonRobotics EKF-SLAM:** Clear reference implementation for education and small simulations: `https://github.com/AtsushiSakai/PythonRobotics`
- **MRPT `kf-slam`:** C++ implementation in the Mobile Robot Programming Toolkit for range-bearing landmark SLAM: `https://docs.mrpt.org/reference/latest/tutorial-slam-algorithms.html`
- **MRPT repository:** Robotics toolkit including Kalman filters, particle filters, maps, and SLAM applications: `https://github.com/MRPT/mrpt`
- **GTSAM examples:** Not EKF-SLAM, but useful for understanding the smoothing alternative that replaced EKF-SLAM in many systems: `https://gtsam.org/tutorials/intro.html`

## Practical Recommendation

Use EKF-SLAM when the environment has fewer than a few hundred reliable landmarks, associations are known or strongly gated, and the objective is local mapping rather than fleet-scale map construction. Do not use it as the primary backend for an autonomous-vehicle or airport-scale SLAM system.

For airside autonomy, the practical recommendation is:

- Primary high-rate state estimator: ESKF or invariant/error-state filter.
- Primary SLAM backend: factor graph with iSAM2/GTSAM.
- Mapping: LiDAR scan matching plus occupancy/TSDF/ESDF layers.
- EKF-SLAM role: small local landmark module for controlled precision zones.

For map construction workflows, prefer the pipeline in [Map Construction Pipeline](../maps/map-construction-pipeline.md). For live occupancy and planning representations, use [Real-Time Occupancy Grid Mapping](../maps/realtime-occupancy-grid-mapping.md).

## Related Repository Docs

- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md)
- [Real-Time Occupancy Grid Mapping](../maps/realtime-occupancy-grid-mapping.md)
- [Map Construction Pipeline](../maps/map-construction-pipeline.md)

## Sources

- Smith, Self, and Cheeseman, "Estimating Uncertain Spatial Relationships in Robotics" / stochastic maps: https://robotics.usc.edu/~maja/teaching/cs584/papers/smith90stochastic.pdf
- Dissanayake, Newman, Clark, Durrant-Whyte, and Csorba, "A Solution to the Simultaneous Localization and Map Building (SLAM) Problem," IEEE T-RA, 2001: https://web.mit.edu/2.166/www/handouts/dissa_et_al_ieeetra_2001.pdf
- Durrant-Whyte and Bailey, "Simultaneous Localization and Mapping: Part I," IEEE Robotics and Automation Magazine, 2006: https://doi.org/10.1109/MRA.2006.1638022
- Bailey and Durrant-Whyte, "Simultaneous Localization and Mapping: Part II," IEEE Robotics and Automation Magazine, 2006: https://doi.org/10.1109/MRA.2006.1678144
- Bailey, Nieto, Guivant, Stevens, and Nebot, "Consistency of the EKF-SLAM Algorithm," IROS 2006: https://www-personal.acfr.usyd.edu.au/tbailey/papers/ekfslam.pdf
- UTIAS Multi-Robot Cooperative Localization and Mapping Dataset: https://asrl.utias.utoronto.ca/datasets/mrclam/
- RADISH robotics dataset repository: https://radish.sourceforge.net/
- MRPT SLAM algorithms documentation: https://docs.mrpt.org/reference/latest/tutorial-slam-algorithms.html
- PythonRobotics SLAM examples: https://github.com/AtsushiSakai/PythonRobotics

