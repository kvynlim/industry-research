# GraphSLAM and Pose Graph Optimization

## Executive Summary

GraphSLAM reframes SLAM as sparse nonlinear optimization. Instead of recursively maintaining a single filter belief, the system builds a graph: nodes are robot poses or landmarks, and edges are constraints from odometry, scan matching, GPS, visual matches, or loop closures. The solution is the set of poses and map variables that best satisfies all constraints. Pose graph optimization is the most common reduced form: optimize only robot/keyframe poses, then build the map by projecting sensor data through the optimized trajectory.

This method is the backbone of modern LiDAR SLAM, multi-session mapping, and offline HD map construction. It scales because most measurements connect only a few nearby variables, producing sparse Jacobians and sparse normal equations. It also handles loop closure naturally: a loop closure is just another edge between nonconsecutive poses. The price is that graph SLAM depends on a good front end. Bad scan matches, false loop closures, poor covariance estimates, or weak initialization can distort the whole map.

For AV and airside deployment, pose graph optimization is a primary method, especially for offline map construction and medium-rate localization backends. GTSAM/iSAM2 is the factor-graph version used for incremental operation; see [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md). Pose graph optimization should be paired with robust state estimation, validated loop closure, and deterministic mapping layers described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md), [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md), and [Map Construction Pipeline](../maps/map-construction-pipeline.md).

## Historical Context

The idea of globally consistent scan alignment predates the name GraphSLAM. Lu and Milios formulated range-scan mapping as a network of relative pose constraints, solving for globally consistent robot poses. Thrun and Montemerlo later popularized GraphSLAM as an offline algorithm that transforms the SLAM posterior into a sparse graphical network and solves it through variable elimination and optimization. Olson, Leonard, and Teller showed fast iterative pose-graph alignment even with poor initial estimates. Grisetti, Kummerle, Stachniss, and Burgard provided the tutorial treatment that made graph-based SLAM a standard robotics tool.

The open-source ecosystem then standardized the approach. g2o provided a general graph optimization framework for SLAM and bundle adjustment. GTSAM expressed the same family of problems as factor graphs with Bayes tree inference and iSAM2 incremental updates. Ceres Solver became a dominant general nonlinear least-squares engine, especially for bundle adjustment and large batch problems. Google Cartographer made submap-based 2D/3D pose graph SLAM broadly available.

GraphSLAM is now less a single algorithm than a design pattern: represent robot estimation as a sparse graph, solve it with modern nonlinear least squares, and protect it with robust front-end validation.

## Sensor Assumptions

Pose graph optimization assumes the front end can produce relative or absolute constraints between poses. Typical constraints include:

- Wheel odometry between consecutive poses.
- IMU preintegration between keyframes.
- LiDAR ICP/GICP/NDT relative transforms.
- Visual odometry relative transforms.
- GPS/RTK position priors.
- Magnetometer or heading priors, when trustworthy.
- Loop closure transforms from place recognition plus geometric verification.
- Ground control point or surveyed-map anchors for offline map construction.

The optimizer assumes each edge has:

```text
measurement z_ij
measurement model h_i_j(x_i, x_j)
information matrix Omega_ij = covariance^-1
```

Noise does not need to be perfectly Gaussian, but the basic least-squares formulation treats each residual as locally Gaussian. In production systems, robust losses, switchable constraints, max-mixtures, or graduated non-convexity are used to reduce sensitivity to outliers.

## State and Map Representation

Pose graph SLAM uses a graph:

```text
G = (V, E)

V: pose variables x_i in SE(2), SE(3), or Sim(3)
E: constraints z_ij between poses i and j
```

For 2D:

```text
x_i = [x, y, theta]
```

For 3D:

```text
X_i in SE(3), represented by translation plus rotation
```

The map is often not part of the optimized state. Instead, it is a derived product:

- LiDAR point map = all scans transformed by optimized poses.
- Occupancy grid = raycast scans through optimized poses.
- TSDF/ESDF = integrate depth/LiDAR using optimized poses.
- Visual sparse map = landmarks from bundle adjustment, if landmarks are included.

Full GraphSLAM may include landmarks, calibration variables, sensor biases, and semantic objects. Pose graph optimization is the reduced trajectory-only case and is usually sufficient when scan matching or visual odometry already condensed raw observations into relative pose constraints.

## Algorithm Pipeline

1. **Create keyframes.** Select poses based on distance, rotation, time, or information gain.

2. **Add odometry edges.** Connect consecutive keyframes using wheel odometry, visual odometry, LiDAR odometry, or inertial preintegration.

3. **Generate local map or submap edges.** For scan-matching systems, align each keyframe to a local submap and add the estimated relative transform.

4. **Detect loop closures.** Use place recognition or submap matching to find revisits. See [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md).

5. **Verify geometry.** Run ICP/GICP/NDT, PnP, essential-matrix checks, or multi-stage geometric validation. Estimate covariance from the Hessian, residual distribution, or empirical calibration.

6. **Add robust loop edges.** Use robust kernels, switchable constraints, max-mixtures, or consistency checks before inserting the edge.

7. **Anchor the gauge.** Add a prior on the first pose, GPS/RTK factors, or ground control points. Without an anchor, the global frame is arbitrary.

8. **Optimize.** Run Gauss-Newton, Levenberg-Marquardt, Dogleg, or incremental smoothing.

9. **Update map products.** Rebuild or deform point clouds, occupancy grids, TSDFs, and localization maps from optimized poses.

10. **Monitor health.** Track residuals, covariance, loop closure innovation, condition number, solver time, and map deformation magnitude.

## Formulation

For a pose graph with relative pose measurements `Z_ij`, the MAP estimate is:

```text
X* = argmin_X sum_(i,j in E) e_ij(X_i, X_j)^T Omega_ij e_ij(X_i, X_j)
```

For SE(3), a common residual is:

```text
e_ij = Log( Z_ij^-1 * X_i^-1 * X_j )
```

where:

- `X_i` and `X_j` are pose variables.
- `Z_ij` is the measured relative transform from pose i to pose j.
- `Log(.)` maps the pose error from SE(3) to a 6D tangent vector.
- `Omega_ij` is the information matrix.

Linearize around the current estimate:

```text
e(X + dx) ~= e(X) + J dx
```

Then solve the sparse normal equations:

```text
H dx = -g

H = J^T Omega J
g = J^T Omega e
```

Apply `dx` on the manifold using pose retraction:

```text
X_i <- X_i * Exp(dx_i)
```

The sparse structure is the reason graph SLAM scales. Consecutive odometry edges connect neighboring poses, while loop closures add a limited number of long-range edges. Variable ordering and sparse Cholesky/QR factorization determine performance.

Robust pose graph optimization replaces squared loss with a robust objective:

```text
min sum rho( ||e_ij||_Omega^2 )
```

Common choices are Huber, Cauchy, Tukey, dynamic covariance scaling, switchable constraints, and max-mixtures.

## Failure Modes

**False loop closures.** One high-confidence wrong loop closure can fold the map. This is the dominant catastrophic failure mode.

**Poor initialization.** Nonlinear optimizers are local. If odometry drift is too large or a loop closure is inserted with the wrong basin of attraction, the solution can converge to a wrong local minimum.

**Gauge freedom.** Without a prior or absolute measurement, the graph has unobservable global translation and rotation. Solvers may fail or return arbitrary frames.

**Degenerate geometry.** Long corridors, planar walls, open aprons, and repeated structures produce weak scan constraints. The front end may report overconfident covariances in directions that are actually unobservable.

**Bad information matrices.** If covariance is too tight, a weak or wrong edge dominates. If covariance is too loose, useful constraints are ignored.

**Dynamic environments.** Scan matching against moving vehicles, aircraft, pedestrians, or temporary equipment can create inconsistent edges.

**Numerical fill-in.** Poor variable ordering or dense loop closures increase fill-in and runtime.

**Map deformation side effects.** A large loop closure correction can move old map elements abruptly. Downstream localization, planning, and change detection must handle this explicitly.

## AV Relevance

Pose graph optimization is highly relevant to autonomous vehicles:

- Offline HD map construction uses pose graphs to align survey runs, loop closures, RTK/GCP priors, and multi-session constraints.
- Online LiDAR SLAM often uses a local odometry front end plus pose graph backend.
- Fleet map maintenance can add cross-session and cross-vehicle constraints.
- GPS/RTK can be fused as absolute priors.
- Loop closure keeps long missions globally consistent.

However, production AVs usually separate rates:

- High-rate control pose from EKF/ESKF/INS.
- Medium-rate local odometry from LiDAR/visual-inertial front end.
- Lower-rate graph optimization for global correction.

This separation avoids feeding discontinuous graph corrections directly into control.

## Indoor/Outdoor Relevance

**Indoor:** Pose graph SLAM is excellent for office, warehouse, tunnel, terminal, and factory mapping. Loop closures are frequent, trajectories are slow, and 2D/3D LiDAR constraints are strong if geometry is not too repetitive.

**Outdoor:** Pose graphs are the standard for outdoor large-scale mapping, especially with LiDAR, GNSS, and inertial constraints. The challenge is robust front-end matching under larger speeds, dynamic objects, weather, and sparse features.

**Large facilities:** Multi-session pose graphs are particularly useful for campuses, airports, depots, and industrial yards, where one map is assembled from many survey runs.

## Airside Deployment Notes

Airside is a strong pose-graph use case because operations need centimeter-to-decimeter map consistency over large but structured areas. The recommended airside graph contains:

- Consecutive LiDAR odometry edges.
- IMU preintegration edges where available.
- Wheel odometry edges for low-speed motion.
- RTK-GPS factors when fix quality is high.
- GCP or surveyed landmark priors for map construction.
- Loop closure edges from verified place recognition.
- Robust kernels on GPS and loop closures.

Airside-specific cautions:

- Adjacent stands can be perceptually aliased; loop closures need geographic and odometric gating.
- Aircraft and GSE should be removed or downweighted before scan matching.
- RTK can fail near terminals and aircraft, so GPS edges need adaptive covariance.
- De-icing spray, rain, and wet tarmac can degrade LiDAR constraints.
- Map corrections should flow through `map -> odom`, not create discontinuous `odom -> base_link` jumps.

For new airport onboarding, pose graph optimization belongs in the offline map construction workflow described in [Map Construction Pipeline](../maps/map-construction-pipeline.md).

## Datasets and Metrics

Useful datasets:

- **Manhattan 3500 / M3500:** Classic 2D pose graph benchmark.
- **Intel Research Lab and Freiburg datasets via RADISH:** 2D laser pose graph and grid mapping benchmarks.
- **KITTI odometry:** Outdoor vehicle trajectories with camera and LiDAR data.
- **TUM RGB-D:** Indoor visual/RGB-D SLAM benchmark.
- **EuRoC MAV:** Visual-inertial indoor trajectories with ground truth.
- **Newer College:** LiDAR, inertial, and vision with ground truth for modern mapping.
- **MulRan and NCLT:** Long-range place recognition and multi-session mapping relevance.

Metrics:

- ATE and RPE.
- Translational and rotational drift per distance.
- Final graph chi-square cost and residual distributions.
- Loop closure precision/recall and false-positive rate.
- Map consistency at revisited locations.
- Ground-control-point residuals.
- Solver runtime, memory, and incremental update latency.
- Robustness under injected false loop closures.

## Open-Source Implementations

- **g2o:** General graph optimization framework for SLAM and bundle adjustment: https://github.com/RainerKuemmerle/g2o
- **GTSAM:** Factor graph and iSAM2 smoothing library: https://gtsam.org/ and https://github.com/borglab/gtsam
- **Ceres Solver:** General nonlinear least-squares solver with robust losses and sparse Schur options: https://ceres-solver.org/
- **Google Cartographer:** 2D/3D SLAM with submaps and pose graph optimization: https://github.com/cartographer-project/cartographer
- **RTAB-Map:** Graph-based RGB-D/LiDAR SLAM with loop closure: https://github.com/introlab/rtabmap
- **Kimera:** Metric-semantic visual-inertial SLAM components with pose graph optimization: https://github.com/MIT-SPARK/Kimera

## Practical Recommendation

Use pose graph optimization as the default global SLAM backend for LiDAR and multi-session map construction. It is the right abstraction for loop closures, GPS/RTK anchoring, GCP alignment, and fleet map refinement.

For airside AVs:

- Use a factor-graph implementation such as GTSAM/iSAM2 for online operation.
- Use batch Ceres/g2o/GTSAM for offline map construction.
- Require geometric verification before adding loop closures.
- Use robust losses and switchable/outlier-tolerant factors for loop closures and GPS.
- Keep high-rate control on a smooth local odometry frame.
- Build occupancy/TSDF/ESDF products from optimized poses, not from raw odometry.

## Related Repository Docs

- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md)
- [Real-Time Occupancy Grid Mapping](../maps/realtime-occupancy-grid-mapping.md)
- [Map Construction Pipeline](../maps/map-construction-pipeline.md)

## Sources

- Lu and Milios, "Globally Consistent Range Scan Alignment for Environment Mapping," Autonomous Robots, 1997: https://doi.org/10.1023/A:1008854305733
- Thrun and Montemerlo, "The GraphSLAM Algorithm with Applications to Large-Scale Mapping of Urban Structures," IJRR, 2006: https://robots.stanford.edu/papers/thrun.graphslam.html
- Olson, Leonard, and Teller, "Fast Iterative Alignment of Pose Graphs with Poor Initial Estimates," ICRA 2006: https://april.eecs.umich.edu/pdfs/olson2006icra.pdf
- Grisetti, Kummerle, Stachniss, and Burgard, "A Tutorial on Graph-Based SLAM": https://dl.icdst.org/pdfs/files3/61fa1e7f10231c96465d22fcec3d0a89.pdf
- Kummerle et al., "g2o: A General Framework for Graph Optimization," ICRA 2011: https://ais.informatik.uni-freiburg.de/publications/papers/kuemmerle11icra.pdf
- g2o GitHub: https://github.com/RainerKuemmerle/g2o
- Ceres Solver documentation: https://ceres-solver.org/
- GTSAM tutorial: https://gtsam.org/tutorials/intro.html
- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- TUM RGB-D benchmark: https://cvg.cit.tum.de/data/datasets/rgbd-dataset

