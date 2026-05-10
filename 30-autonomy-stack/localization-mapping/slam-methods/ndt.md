# Normal Distributions Transform (NDT) for 3D SLAM and AV Localization

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "fielded-pattern"
  tags: ["runtime-localization", "road-av", "outdoor"]
  reason: "Mature scan-to-map localization pattern used in AV and robotics stacks."
method-priority:end -->

Related library pages: [Production LiDAR-to-Map Localization](../overview/production-lidar-map-localization.md) and [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md).

## Executive Summary

The Normal Distributions Transform (NDT) represents a point cloud as a grid of local Gaussian distributions. Instead of matching each live point to a discrete nearest neighbor, scan matching evaluates how likely transformed source points are under the target grid's Gaussian cells. This gives a smooth objective, avoids expensive nearest-neighbor search, and often has a larger convergence basin than ICP-family methods.

NDT is one of the most production-proven LiDAR localization methods. Autoware's `ndt_scan_matcher` uses NDT for position estimation and supports initial pose estimation, regularization, dynamic map loading, covariance estimation, and diagnostics. PCL provides a widely used `NormalDistributionsTransform` implementation. 3D-NDT variants have a long robotics history, including autonomous mining vehicles and compact distribution-to-distribution registration.

For AV localization, NDT is a strong coarse alignment and fallback method. It is robust when a map can be represented at meter-scale cells and when initial pose uncertainty is moderate. It is less precise than fine VGICP on dense maps, can blur small structures at coarse resolution, and becomes weak when cells are underpopulated or the scene is geometrically degenerate. For airside autonomy, NDT is valuable as a coarse scan-to-map stage and independent backup to VGICP, but it must not hide open-apron degeneracy behind a high likelihood score.

## Math / Objective

### Point-to-Distribution NDT

Partition the target/map point cloud into grid cells. For each populated cell \(c\), estimate:

```text
mu_c    = mean of points in cell c
Sigma_c = covariance of points in cell c
```

For each transformed source point:

```text
x_i(T) = R p_i + t
c_i    = grid cell containing x_i
```

The Gaussian likelihood is:

```text
P(x_i | c_i) proportional to exp( -0.5 (x_i - mu_c)^T Sigma_c^-1 (x_i - mu_c) )
```

Registration maximizes likelihood or minimizes negative log likelihood:

```text
min_T sum_i 0.5 (R p_i + t - mu_c)^T Sigma_c^-1 (R p_i + t - mu_c)
```

Many implementations use a mixture with an outlier term so that points outside good cells do not dominate the optimization.

The Jacobian resembles point-to-plane/GICP, but the residual is weighted by the target cell inverse covariance:

```text
d_i = R p_i + t - mu_c
J_i = [ -[R p_i]_x   I_3 ]
H   = sum_i J_i^T Sigma_c^-1 J_i
g   = sum_i J_i^T Sigma_c^-1 d_i
```

### Distribution-to-Distribution NDT

NDT-D2D variants represent both source and target as Gaussian cells and minimize a distance between distributions. A simplified Gaussian overlap cost is:

```text
d = mu_q - T mu_p
M = Sigma_q + R Sigma_p R^T
cost = d^T M^-1 d + log |M|
```

This is conceptually close to GICP/VGICP, but built from cell distributions rather than per-point local covariances.

## Algorithm Pipeline

1. **Build target NDT map**
   - Divide the map tile into regular grid cells or voxels.
   - Insert stable static map points.
   - For each cell with enough points, compute mean and covariance.
   - Regularize covariance eigenvalues to avoid singular inverse matrices.
   - Store inverse covariance, point count, occupancy, and optional semantic/stability metadata.

2. **Prepare live scan**
   - Deskew the scan.
   - Filter self hits, invalid ranges, rain/snow speckle, and known dynamic objects.
   - Downsample to a source voxel size appropriate for the NDT resolution.
   - Optionally remove or downweight ground if horizontal/yaw observability is weak.

3. **Initialize**
   - Use estimator prediction from IMU, wheel odometry, GNSS/RTK, or previous LiDAR localization.
   - For cold start, use GNSS plus Monte Carlo/grid initial pose search or place recognition.

4. **Optimize**
   - Transform source points.
   - Look up the NDT cell for each transformed point.
   - Evaluate likelihood, gradient, and Hessian.
   - Update pose with Newton, More-Thuente line search, Levenberg-Marquardt, or another nonlinear optimizer.
   - Iterate until pose increment, score change, or iteration count threshold is reached.

5. **Quality gate**
   - Check convergence status, likelihood/score, valid-cell ratio, inlier count, Hessian conditioning, and innovation against the estimator.
   - Export pose and covariance only if diagnostics pass.

6. **Multi-resolution refinement**
   - Run coarse NDT at large cells to expand convergence basin.
   - Refine with smaller cells.
   - Optionally hand off to VGICP or point-to-plane ICP for final centimeter-level alignment.

## Initialization / Convergence

NDT often tolerates worse initial poses than point-to-point or point-to-plane ICP because the grid of Gaussians creates a smoother score field. However, the convergence basin depends strongly on cell size and environment geometry.

Practical initialization:

- **Normal tracking:** estimator pose prediction is enough if frame-to-frame drift is small.
- **GNSS-assisted startup:** use GNSS/RTK as a prior, then NDT scan matching.
- **Global relocalization:** sample pose hypotheses around GNSS or place-recognition candidates; keep hypotheses with high valid-cell likelihood and plausible heading.
- **Coarse-to-fine:** start at 2-5 m cells if uncertainty is large, refine at 0.5-1.0 m cells if the map supports it.

Resolution tradeoff:

| Cell size | Benefit | Risk |
|---|---|---|
| Large cells | Wide basin, robust to noise, fast map | Blurs small structures; lower final accuracy |
| Small cells | Higher precision, sharper local structure | Sparse invalid cells; smaller basin; more sensitive to map mismatch |
| Multi-resolution | Combines basin and precision | More tuning and runtime |

Convergence failure modes:

- Starting in the wrong repeated structure.
- Too few points per cell for stable covariance.
- Cell size mismatched to map density.
- Many live points falling outside valid cells.
- Dynamic objects producing high likelihood in wrong cells.
- Open areas where many poses have similar likelihood.

## Degeneracy

NDT's smooth likelihood does not remove geometric degeneracy. It can sometimes make degeneracy harder to notice because the score field looks smooth and stable even when it is flat in important directions.

Common degeneracies:

- Flat ground cells produce strong vertical/attitude constraints but weak horizontal/yaw constraints.
- Long walls or terminal facades weakly constrain along-wall translation.
- Repeated cell patterns can create multiple local optima.
- Sparse cells with poorly estimated covariance create numerical artifacts.
- Large cells in open apron areas can over-smooth the map until many poses look equivalent.

Detection:

```text
valid_cell_ratio
score / likelihood
Hessian eigenvalues and condition number
cell covariance eigenvalue ratios
normal/covariance orientation histogram
innovation versus RTK/IMU/wheel prediction
pose covariance from optimizer or empirical replay
```

Handling:

- Require a minimum number of well-populated cells.
- Reject cells whose covariance is singular or too elongated unless explicitly modeled.
- Use multi-resolution only if the fine-level Hessian remains well conditioned.
- Inflate covariance in weak directions before factor graph insertion.
- Treat ground-only NDT updates as z/roll/pitch observations, not full 6-DoF pose.
- Add regularization to GNSS/route priors carefully; regularization can stabilize but also hide map mismatch if over-weighted.

## Runtime

NDT avoids nearest-neighbor search during matching. Once the target grid is built, each source point needs a cell lookup and a Gaussian evaluation.

Runtime model:

```text
Map build:      O(M) for M target points, usually offline for localization
Per iteration:  O(N) for N source points with grid lookup
Solve/update:   O(N) accumulation + constant 6x6 solve
```

Runtime depends on:

- Number of source points.
- Number of valid NDT cells.
- Cell lookup data structure.
- Whether derivatives are analytic or numerical.
- Number of optimization iterations.
- Multi-resolution levels.
- CPU threading or GPU implementation.

Typical production behavior:

- CPU NDT can run at 10 Hz for moderate point counts and local map crops.
- GPU NDT can be much faster when point count and hypotheses are high.
- Coarse NDT is attractive for relocalization because map memory is compact.
- Fine NDT can become slower or less stable if many cells are sparse.

PCL's tutorial notes scale-sensitive parameters such as transformation epsilon, step size, and grid resolution. These must be tuned to environment scale; room-scale settings do not transfer directly to airport-scale maps.

## AV Role

NDT is used in AV stacks for:

- **Map-based localization:** live LiDAR scan against prebuilt NDT map.
- **Initial pose estimation:** Monte Carlo or grid search over NDT likelihood.
- **Coarse alignment:** initialize VGICP or point-to-plane ICP.
- **Fallback from VGICP:** provide independent objective and map representation.
- **Compact map representation:** store Gaussian cells instead of dense points.
- **Covariance estimation:** derive local information from the Hessian or score landscape.

NDT is especially useful when:

- The initial pose is not precise enough for ICP/GICP.
- The map is large and nearest-neighbor queries are expensive.
- The system needs a compact representation for dynamic map loading.
- Production maintainability favors a mature, widely deployed method.

It is less suitable as the final fine matcher when the task requires maximum centimeter-level accuracy on dense local maps and GPU VGICP is available.

## Indoor / Outdoor Relevance

| Environment | Relevance | Notes |
|---|---|---|
| Warehouses | High | Works well with stable walls/racks; repeated aisles need priors |
| Mines/tunnels | High | 3D-NDT was demonstrated for autonomous mining vehicles; along-axis degeneracy remains |
| Parking garages | High | Compact maps and smooth convergence; repeated bays require initialization |
| Urban roads | High | Common in autonomous driving localization |
| Highways | Medium | Sparse structures and high speed challenge observability |
| Forests | Medium | Vegetation can make covariance unstable |
| Airports | High as coarse/fallback, medium as sole fine localizer | Strong near terminals; weak in open apron |
| Indoor handheld | Medium-high | Needs good deskew or continuous-time handling under rapid motion |

## Airside Deployment Notes

NDT is attractive for airport operations because map tiles can be compact and dynamic loading can be straightforward. It also gives a separate registration path from VGICP, which is valuable for fault detection.

Airside guidance:

- **Use multi-resolution:** coarse 3-5 m cells for recovery, 1-2 m cells for normal operation, finer only if map density supports stable covariances.
- **Track valid-cell ratio:** a scan in an open or changed area may hit many invalid or low-confidence cells.
- **Separate ground from structure:** ground cells help attitude but not horizontal localization.
- **Dynamic map loading:** airport routes can span large areas; load local NDT tiles based on route and predicted pose.
- **GNSS regularization:** useful near open apron, but monitor when LiDAR and GNSS disagree. Do not silently pull NDT to a bad GNSS fix.
- **Aircraft churn:** parked aircraft are large Gaussian structures if included in the live scan but may not be in the static map. Dynamic masks are important.
- **Certification logging:** store NDT score, iteration count, cell resolution, valid-cell ratio, covariance, and regularization terms.

Recommended fallback hierarchy:

```text
VGICP fine localization
  -> NDT coarse/fallback localization
  -> RTK + wheel + IMU dead reckoning with inflated uncertainty
  -> reduced speed / safe stop if uncertainty exceeds zone limits
```

## Benchmarks

NDT benchmark design:

| Benchmark | Purpose |
|---|---|
| Resolution sweep | Find basin/accuracy/runtime tradeoff |
| Initial pose perturbation | Quantify convergence basin |
| Sparse cell test | Verify covariance regularization and rejection |
| Dynamic object replay | Test aircraft/GSE mismatch robustness |
| Degenerate apron replay | Confirm weak directions are detected |
| Multi-resolution handoff | Validate NDT-to-VGICP transition |
| Regularization ablation | Ensure GNSS/route priors do not mask bad matching |

Metrics:

- ATE/RPE and lateral/yaw error.
- NDT score or transformation likelihood.
- Valid-cell ratio and used point count.
- Hessian eigenvalues and covariance calibration.
- Convergence rate from controlled perturbations.
- Runtime p50/p95/p99.
- False-accept rate under wrong initial hypotheses.

Public datasets:

- KITTI/KITTI-360 for outdoor driving.
- MulRan for repeated urban structure and long routes.
- NCLT for long-term change.
- Newer College for indoor-outdoor operation.
- Mining/tunnel datasets when evaluating NDT-specific degeneracy.

Airside datasets should include terminal, open apron, aircraft-occupied stands, service roads, night/rain, and long straight taxiway segments. Public road benchmarks do not adequately test the airside failure modes.

## Open-Source Implementations

| Implementation | Notes |
|---|---|
| PCL `NormalDistributionsTransform` | Mature C++ implementation; exposes resolution, step size, transformation epsilon, outlier ratio |
| Autoware `ndt_scan_matcher` | Production-oriented ROS 2 localization package with diagnostics, regularization, dynamic map loading, and covariance-related features |
| `fast_gicp` `NDTCuda` | CUDA-accelerated D2D NDT-style implementation in Koide's registration library |
| `ndt_omp` | Popular OpenMP-accelerated NDT implementation used in ROS ecosystems |
| `hdl_localization` / `hdl_graph_slam` ecosystem | Practical NDT/GICP localization and mapping references |

Production wrapper requirements:

- Bound source point count and iterations.
- Log cell resolution and map tile version.
- Expose convergence reason and score.
- Expose valid-cell ratio and Hessian.
- Support multiple map resolutions.
- Support covariance inflation or factor rejection on degeneracy.

## Practical Recommendation

Use NDT as the production coarse alignment and fallback method, and as a viable primary matcher when implementation simplicity and map compactness matter more than maximum fine accuracy.

For an airside localization stack:

1. Keep VGICP as the fine scan-to-map matcher when GPU resources are available.
2. Use NDT for initial alignment, relocalization, and fallback.
3. Maintain multi-resolution NDT maps in the same tile/versioning system as dense LiDAR maps.
4. Do not accept NDT pose updates without valid-cell, Hessian, and innovation checks.
5. Treat open-apron NDT as partially observable unless non-ground structure is present.
6. Benchmark NDT and VGICP against the same route replays so fallback transitions are quantifiable.

NDT is not obsolete. It remains one of the most useful production methods because it is compact, mature, and robust to moderate initial error. Its best role is to complement VGICP rather than replace it.

## Sources

- Biber, P. and Strasser, W. (2003). "The Normal Distributions Transform: A New Approach to Laser Scan Matching." IROS. DOI: `10.1109/IROS.2003.1249285`. https://cir.nii.ac.jp/crid/1360011145398001024
- Magnusson, M., Lilienthal, A., and Duckett, T. (2007). "Scan registration for autonomous mining vehicles using 3D-NDT." Journal of Field Robotics. DOI: `10.1002/rob.20204`. https://portal.fis.tum.de/en/publications/scan-registration-for-autonomous-mining-vehicles-using-3d-ndt/
- Magnusson, M. (2009). "The Three-Dimensional Normal-Distributions Transform - an Efficient Representation for Registration, Surface Analysis, and Loop Detection." PhD thesis, Orebro University.
- Stoyanov, T., Magnusson, M., Andreasson, H., and Lilienthal, A. J. (2012). "Fast and accurate scan registration through minimization of the distance between compact 3D NDT representations." IJRR. DOI: `10.1177/0278364912460895`. https://journals.sagepub.com/doi/10.1177/0278364912460895
- PCL NDT tutorial. https://pointclouds.org/documentation/tutorials/normal_distributions_transform.html
- PCL `NormalDistributionsTransform` API. https://pointclouds.org/documentation/classpcl_1_1_normal_distributions_transform.html
- Autoware `ndt_scan_matcher` documentation. https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- Koide `fast_gicp` repository, including CUDA NDT implementation. https://github.com/koide3/fast_gicp
