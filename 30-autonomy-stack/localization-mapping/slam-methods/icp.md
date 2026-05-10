# Point-to-Point ICP for 3D SLAM and LiDAR Localization

<!-- method-priority:start
priority:
  learning: 5
  deployment: 5
  type: "method-family"
  stage: "foundation"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization"]
  reason: "Core registration primitive behind LiDAR odometry and scan-to-map localization."
method-priority:end -->

Related library pages: [Production LiDAR-to-Map Localization](../overview/production-lidar-map-localization.md) and [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md).

## Executive Summary

Iterative Closest Point (ICP) is the baseline rigid registration method for aligning two 3D point sets. In its classic point-to-point form, it alternates between nearest-neighbor correspondence assignment and a closed-form rigid transform update. The method is simple, fast, deterministic, easy to inspect, and still surprisingly competitive when the initial pose is good, the overlap is high, the scan is deskewed, and outliers are aggressively rejected.

For 3D SLAM and AV localization, point-to-point ICP is best understood as the control case: it tells us what can be achieved with geometry alone and almost no modeling assumptions. It is useful as a LiDAR odometry baseline, a fallback when normals/covariances are unreliable, a map-building primitive, and a diagnostic reference for more advanced methods. It should not be the primary production scan-to-map matcher for airside localization because it converges slowly on smooth surfaces, is sensitive to sampling density, and can invent artificial constraints from point discretization on planes.

Modern systems that appear to use "plain ICP" successfully usually add engineering around it: motion compensation, adaptive correspondence thresholds, [robust kernels](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md), voxelized local maps, trimming, multi-resolution schedules, and high-quality initialization. KISS-ICP is the current proof point: a carefully engineered point-to-point pipeline can compete with more complex LiDAR odometry systems, but it is still an odometry method rather than a full replacement for probabilistic scan-to-map registration.

## Math / Objective

Given a source scan \(P = \{p_i\}\), target cloud or map \(Q = \{q_j\}\), and rigid transform \(T = (R,t) \in SE(3)\), classic ICP solves the nonconvex problem:

```text
min_T  sum_i || R p_i + t - NN_Q(R p_i + t) ||_2^2
```

where `NN_Q(.)` returns the nearest target point under the current transform. ICP does not solve this objective globally. It solves a sequence of local least-squares problems:

1. Freeze transform \(T_k\) and assign correspondences:

```text
q_i = argmin_q in Q || T_k p_i - q ||_2
```

2. Freeze correspondences and solve:

```text
min_R,t sum_i w_i || R p_i + t - q_i ||_2^2
subject to R in SO(3)
```

For fixed correspondences, the update has a closed-form Procrustes/Kabsch solution. With weights \(w_i\):

```text
p_bar = (sum_i w_i p_i) / sum_i w_i
q_bar = (sum_i w_i q_i) / sum_i w_i
H     = sum_i w_i (p_i - p_bar)(q_i - q_bar)^T
H     = U S V^T
R     = V diag(1, 1, det(V U^T)) U^T
t     = q_bar - R p_bar
```

Production implementations usually change the raw objective to:

```text
min_T sum_i rho( w_i || R p_i + t - q_i ||_2^2 )
```

where:

- `rho` is a [robust loss such as Huber, Cauchy, Tukey, or Geman-McClure](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md).
- `w_i` may encode range, intensity, semantic class, local geometry, or per-LiDAR trust.
- Correspondences are gated by maximum distance, reciprocal matching, normal angle if normals are available, or trimmed residual rank.

The Hessian or information matrix used for covariance diagnostics can be approximated by linearizing residuals around the final pose. For a residual \(r_i = R p_i + t - q_i\), a small left perturbation \(\xi = [\omega, v]\) gives:

```text
J_i = [ -[R p_i]_x   I_3 ]
H   = sum_i J_i^T W_i J_i
```

For isotropic point-to-point ICP, \(W_i\) is typically scalar or diagonal. This information matrix is useful for localizability scoring, but it can be misleading on surfaces because point-to-point residuals penalize tangential offsets caused only by sampling.

## Algorithm Pipeline

Typical point-to-point ICP in a SLAM or localization stack:

1. **Input conditioning**
   - Merge or select LiDARs.
   - Remove invalid returns, near-field self hits, rain/snow speckle, and low-confidence returns.
   - Deskew points to a common timestamp using IMU, wheel odometry, or constant velocity.
   - Downsample with a voxel grid; keep enough points to preserve structure.

2. **Target map preparation**
   - For frame-to-frame odometry: use the previous scan or a rolling local submap.
   - For scan-to-map localization: extract a local map tile around the predicted pose.
   - Build a nearest-neighbor structure: kd-tree, nanoflann, PCL search tree, or voxel hash.

3. **Initialization**
   - Start from IMU/wheel/GNSS prediction, constant velocity, previous LiDAR odometry, place recognition, or NDT coarse alignment.
   - Reject ICP if the initial covariance is too wide for the method's convergence basin.

4. **Correspondence search**
   - Transform each source point with the current estimate.
   - Query nearest target point.
   - Gate by maximum distance, optionally by reciprocal match or per-point quality.
   - Track correspondence ratio and spatial coverage.

5. **Transform update**
   - Solve the fixed-correspondence Procrustes problem.
   - Compose the update with the current estimate.
   - Optionally damp the update or reject it if it increases residuals.

6. **Convergence test**
   - Stop on small pose increment, small cost reduction, maximum iterations, or poor correspondence quality.
   - Export final pose, inlier RMSE, fitness/overlap ratio, iteration count, and information matrix.

7. **Map update**
   - For odometry, insert downsampled points into the local map and evict stale or distant voxels.
   - For localization against an offline map, do not insert transient objects into the reference map.

## Initialization / Convergence

Point-to-point ICP is a local optimizer. It assumes the nearest-neighbor assignments from the current pose are mostly correct. If the source scan starts too far from the target, nearest neighbors come from the wrong surfaces and the method converges to a local minimum or diverges.

Practical initialization rules:

- **Frame-to-frame odometry:** constant velocity is often enough if the LiDAR frame rate is 10-20 Hz and motion distortion is compensated.
- **Scan-to-map localization:** use the fused state estimate from the estimator, not raw GPS alone. The local map should be cropped around the predicted pose.
- **Cold start:** use place recognition, GNSS, NDT, branch-and-bound, or feature matching first; ICP is a refiner.
- **Relocalization:** require independent validation, such as overlap score, innovation against the estimator, and consistency with heading/velocity.

Convergence behavior:

- Closed-form updates make each iteration cheap.
- It converges monotonically only for the fixed correspondence objective; changing correspondences can still produce bad local behavior.
- Point-to-point usually needs more iterations than point-to-plane or GICP on smooth scenes.
- It performs better when target sampling is dense and uniform.
- It performs worse when source and target have different scan patterns, different densities, or partial overlap.

Typical stopping thresholds for AV-scale LiDAR:

| Parameter | Common range | Notes |
|---|---:|---|
| Max iterations | 20-80 | 10-30 if initialization is strong; more for cold refinement |
| Max correspondence distance | 0.5-3.0 m | Should shrink in coarse-to-fine schedules |
| Translation epsilon | 0.001-0.01 m | Depends on map resolution and sensor noise |
| Rotation epsilon | 0.0001-0.001 rad | Lower only if timestamps/extrinsics are high quality |
| Minimum inlier ratio | 0.2-0.6 | Must be environment-specific |

## Degeneracy

Point-to-point ICP degeneracy has two forms: true environmental degeneracy and artificial sampling constraints.

True degeneracy occurs when the geometry does not constrain all pose directions:

- A single flat ground plane constrains vertical position, roll, and pitch, but not horizontal translation or yaw.
- A long corridor or tunnel weakly constrains motion along the corridor.
- A repetitive row of columns, taxiway lights, or terminal facade panels can create multiple similar minima.
- An open apron with only concrete and painted lines is weak for 3D LiDAR geometry.

Artificial constraints occur because point-to-point residuals penalize tangential displacement between sampled points. Two scans of the same wall rarely sample exactly the same surface locations. Even when the true surfaces are aligned, the algorithm may try to align scan samples rather than the physical plane. This is why point-to-plane ICP and GICP were developed.

Detection:

- Eigenvalues of the final approximate Hessian.
- Condition number of \(H\).
- Spatial distribution of correspondences across azimuth, range, and height.
- Innovation consistency against IMU/wheel/GNSS prediction.
- Residual anisotropy: many residuals pointing in the same directions imply weak constraints in others.

Handling:

- Inflate covariance in weak Hessian directions before inserting the LiDAR factor into a graph.
- Do not update the state in degenerate directions unless other sensors constrain them.
- Downweight ground-only correspondences when horizontal localization matters.
- Require structural coverage: poles, walls, curbs, aircraft contours, jet bridge geometry, baggage equipment, or terminal facade points.
- Fall back to NDT, GICP/VGICP, wheel odometry, RTK, or safe stop depending on mission criticality.

## Runtime

Runtime is dominated by correspondence search:

```text
Per iteration: O(N log M) with kd-tree target of M points and N source points
Per iteration: near O(N) average with bounded voxel-hash neighborhoods
Solve step:    O(N) to accumulate centroids/covariance + constant-time SVD
```

Typical runtime ranges:

| Scenario | Points after downsampling | Expected runtime |
|---|---:|---:|
| Frame-to-frame, CPU kd-tree | 5k-30k | 5-30 ms |
| Local map, CPU kd-tree | 10k-50k | 10-60 ms |
| Voxel-hash map, CPU | 10k-50k | 5-25 ms |
| Embedded CPU with heavy filtering | 5k-15k | 10-40 ms |

The method is memory-light: target points plus the search structure. It does not require normals or covariance matrices. This makes it attractive for low-power fallback operation, high-rate odometry, or diagnostic comparisons on embedded platforms.

Runtime pitfalls:

- Rebuilding a kd-tree every scan can dominate cost if the map is large.
- Poor correspondence thresholds increase outliers and iterations.
- High-density ground points waste compute and worsen degeneracy.
- Multi-LiDAR merged clouds can exceed the useful point count; structural sampling is better than uniform retention.

## AV Role

Point-to-point ICP can support several AV localization roles:

- **LiDAR odometry baseline:** estimate short-term relative motion when a prebuilt map is unavailable.
- **Fallback odometry:** continue dead-reckoning support during map tile loading, GNSS dropout, or GICP/NDT failure.
- **Map construction:** align survey passes after coarse initialization.
- **Regression test:** compare advanced methods against a simple baseline to catch tuning regressions.
- **Covariance sanity check:** expose whether a scene has enough raw geometric constraint.

It is usually not the best production scan-to-map method for centimeter-level localization. For that role, point-to-plane ICP, GICP/VGICP, or NDT provide better surface modeling and more reliable uncertainty.

## Indoor / Outdoor Relevance

| Environment | Relevance | Notes |
|---|---|---|
| Warehouses | High | Repetitive racks can cause aliasing; good wheel odometry helps |
| Tunnels/corridors | Medium | Strong lateral constraints but weak along-axis constraint |
| Parking garages | Medium | Columns and walls help; ramps and repeated bays create false matches |
| Urban roads | Medium | Works for odometry with high overlap; dynamic traffic must be filtered |
| Highways/open roads | Low-medium | Fewer nearby structures and high speed make deskewing critical |
| Airports/aprons | Low-medium | Excellent near terminal structures, poor in open stands/taxi lanes |
| Indoor handheld mapping | High if deskewed | Needs continuous-time or IMU deskew under fast hand motion |

## Airside Deployment Notes

Airside localization stresses point-to-point ICP in specific ways:

- **Open aprons:** flat concrete creates poor horizontal/yaw constraints. Plain ICP can report a tight-looking RMSE while the pose is weakly observable.
- **Dynamic aircraft and GSE:** aircraft, belt loaders, tugs, buses, baggage carts, and people can dominate correspondences near stands. Static-map localization must reject or downweight them.
- **Ground markings:** painted lines are useful if intensity is available, but pure XYZ point-to-point geometry does not exploit appearance.
- **Multi-LiDAR rigs:** merging 4-8 LiDARs increases coverage but also creates calibration and time-offset failure modes. Deskew and extrinsic validation are mandatory.
- **Terminal-side operation:** walls, jet bridges, signs, light poles, and parked equipment give enough geometry for ICP to be useful as a fallback.
- **Runway/taxiway crossings:** long low-feature sections require RTK, wheel odometry, IMU, and map priors. ICP should not be allowed to overrule the estimator in weak geometry.

Production acceptance should require:

- Per-zone localizability thresholds.
- Outlier rejection tuned for aircraft/GSE churn.
- Degenerate-direction covariance inflation.
- Comparison against RTK survey truth or total-station checkpoints.
- Replay tests with empty apron, occupied stand, rain, night, and high-reflectance ground.

## Benchmarks

Point-to-point ICP is usually benchmarked as a component rather than a standalone localization product.

Recommended benchmark metrics:

| Metric | Why it matters |
|---|---|
| Relative Pose Error (RPE) | Measures odometry drift over fixed intervals |
| Absolute Trajectory Error (ATE) | Measures global drift after alignment or loop closure |
| Inlier RMSE | Useful but not sufficient; can be low in degenerate scenes |
| Fitness / overlap | Detects partial overlap and bad map extraction |
| Iteration count | Tracks convergence basin and runtime |
| Correspondence spatial coverage | Detects ground-only or one-sided matches |
| Hessian eigenvalue ratio | Detects localizability and covariance reliability |
| Runtime p50/p95/p99 | Required for deterministic AV deployment |

Public datasets:

- KITTI Odometry and KITTI-360 for automotive outdoor odometry.
- MulRan for urban driving with repeated structures and multiple routes.
- NCLT for long-term outdoor operation and changing conditions.
- Newer College for handheld/robotic indoor-outdoor motion.
- Hilti SLAM Challenge for aggressive handheld/robot motion, where plain LiDAR-only ICP is heavily stressed.

KISS-ICP is the key modern comparison point. It uses point-to-point ICP with adaptive correspondence thresholding, [robust loss](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md), motion compensation, and voxelized mapping, and reports state-of-the-art-class odometry across multiple platforms without IMU. That result should not be interpreted as "plain ICP is enough"; it shows that careful pipeline design can make the simple objective competitive for odometry.

For airside work, public road benchmarks are not sufficient. Airport-specific validation must include open apron traversals, gate areas with aircraft churn, terminal facade operation, and long taxi-lane segments.

## Open-Source Implementations

| Implementation | Notes |
|---|---|
| PCL `IterativeClosestPoint` | Mature C++ implementation, easy integration, kd-tree based |
| Open3D `registration_icp` | Python/C++ API with point-to-point and point-to-plane estimators; good for experiments |
| KISS-ICP | High-quality modern LiDAR odometry using point-to-point ICP plus robust engineering |
| libpointmatcher | Research-friendly ICP framework with many filters and outlier models |
| CloudCompare | Practical desktop ICP tool for map QA and manual inspection |
| MRPT ICP | Useful for robotics experiments and 2D/3D variants |

Implementation details to require in production code:

- Deterministic max iterations and bounded correspondence count.
- [Robust kernel](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) and trimmed matching.
- Adaptive correspondence threshold or multi-resolution threshold schedule.
- Per-result quality struct with fitness, RMSE, covariance/information, iteration count, and rejection reasons.
- Optional fixed seed for randomized subsampling.
- Instrumentation for map tile ID, LiDAR IDs, timestamp span, and deskew status.

## Practical Recommendation

Use point-to-point ICP as a baseline and fallback, not as the primary centimeter-level scan-to-map localizer.

Recommended airside role:

1. Keep a KISS-ICP-style point-to-point odometry module for map-unavailable fallback and independent sanity checks.
2. Use it in map construction and replay validation because it is simple enough to expose data quality issues.
3. Do not let it inject high-confidence scan-to-map factors in open apron, ground-only, or low-overlap scenes.
4. Prefer point-to-plane ICP, GICP/VGICP, or NDT for production scan-to-map localization.
5. Always export anisotropic or inflated covariance when Hessian eigenvalues show weak directions.

If engineering resources are limited, implement point-to-point ICP first because it is the easiest registration primitive to make deterministic and testable. Then treat its failure cases as the requirements list for the next method in the library.

## Sources

- Besl, P. J. and McKay, N. D. (1992). "A Method for Registration of 3-D Shapes." IEEE TPAMI. DOI: `10.1109/34.121791`. https://cir.nii.ac.jp/crid/1363107368959994496
- Chen, Y. and Medioni, G. (1992). "Object modelling by registration of multiple range images." Image and Vision Computing. DOI: `10.1016/0262-8856(92)90066-C`. https://cir.nii.ac.jp/crid/1360282588962492672
- Rusinkiewicz, S. and Levoy, M. (2001). "Efficient Variants of the ICP Algorithm." 3DIM. DOI: `10.1109/IM.2001.924423`.
- Open3D ICP documentation. https://www.open3d.org/docs/latest/tutorial/pipelines/icp_registration.html
- PCL ICP documentation. https://pointcloudlibrary.gitlab.io/documentation/classpcl_1_1_iterative_closest_point.html
- Vizzo, I. et al. (2023). "KISS-ICP: In Defense of Point-to-Point ICP - Simple, Accurate, and Robust Registration If Done the Right Way." IEEE RA-L. DOI: `10.1109/LRA.2023.3236571`. https://arxiv.org/abs/2209.15397
- PRBonn KISS-ICP repository. https://github.com/PRBonn/kiss-icp
- Censi, A. (2007). "An accurate closed-form estimate of ICP's covariance." ICRA. DOI: `10.1109/ROBOT.2007.363961`.
