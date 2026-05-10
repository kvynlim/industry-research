# GICP and VGICP for 3D SLAM and LiDAR Localization

<!-- method-priority:start
priority:
  learning: 5
  deployment: 4
  type: "method-family"
  stage: "foundation"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "validation"]
  reason: "GICP and VGICP for 3D SLAM and LiDAR Localization is rated for foundational SLAM modeling, optimization, registration, or mapping concepts."
method-priority:end -->

Related library pages: [Production LiDAR-to-Map Localization](../overview/production-lidar-map-localization.md) and [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md).

## Executive Summary

Generalized ICP (GICP) is the probabilistic registration method that unifies point-to-point and point-to-plane ICP. Instead of treating correspondences as exact points or using only the target normal, GICP assigns local covariance models to both source and target. The residual is weighted by the combined uncertainty of the two local surface distributions. On planar surfaces, this behaves like plane-to-plane registration; in less structured geometry, it smoothly falls back toward point-to-point behavior.

Voxelized GICP (VGICP) keeps the GICP objective but replaces expensive nearest-neighbor and per-point target covariance work with voxelized Gaussian target distributions. Koide et al. reported 30 Hz CPU and 120 Hz GPU processing for 15,000-point clouds in the ICRA 2021 VGICP paper. The open-source `fast_gicp` implementation provides multi-threaded GICP, multi-threaded VGICP, CUDA VGICP, and CUDA NDT-style registration. `small_gicp` is a newer compact implementation with cleaner interfaces and strong CPU scalability.

For AV localization, GICP/VGICP is usually the best classical scan-to-map registration family when a dense LiDAR map is available. It is more accurate and physically meaningful than point-to-point ICP, less dependent on hand-chosen target normals than point-to-plane ICP, and faster than classic GICP when voxelized and parallelized. Its main risks are local minima, covariance degeneracy, map mismatch from dynamic objects, and overconfidence in weak geometry.

## Math / Objective

For a source point \(p_i\) and corresponding target point or voxel \(q_i\), define:

```text
d_i(T) = q_i - T p_i
```

Each source point has covariance \(C_i^P\), each target point or voxel has covariance \(C_i^Q\). GICP minimizes the Mahalanobis residual:

```text
min_T sum_i d_i(T)^T [ C_i^Q + R C_i^P R^T ]^-1 d_i(T)
```

where \(T = (R,t)\). More generally:

```text
M_i(T) = C_i^Q + R C_i^P R^T
r_i(T) = d_i(T)^T M_i(T)^-1 d_i(T)
```

Interpretation:

- If both covariances are isotropic, GICP reduces toward point-to-point ICP.
- If the covariances represent locally planar surfaces with high variance tangent to the surface and low variance normal to it, GICP behaves like plane-to-plane ICP.
- If only target covariance is anisotropic, the behavior approaches point-to-plane ICP.

Covariance construction:

1. Estimate local covariance from neighbors around each point.
2. Eigendecompose the covariance.
3. Regularize eigenvalues so the normal direction is small but nonzero.
4. Store the covariance in each point's local frame or global frame.

A typical planar regularization:

```text
C = R_eig diag(epsilon, 1, 1) R_eig^T
```

where `epsilon` is small in the surface normal direction. The exact ordering depends on the eigenvector convention.

VGICP changes target representation. Instead of finding a target point with a per-point covariance, it voxelizes the target/map and aggregates distributions in each voxel:

```text
voxel mean:       mu_v = average(q_j in voxel v)
voxel covariance: C_v  = aggregate local point covariances and/or positions
residual:         d_i = mu_v - T p_i
objective:        d_i^T [ C_v + R C_i^P R^T ]^-1 d_i
```

This removes repeated target neighbor searches and makes residual computation parallel across source points.

## Algorithm Pipeline

### Classic GICP

1. **Preprocess source and target**
   - Deskew live scan.
   - Remove dynamic or low-quality points.
   - Downsample to a resolution that preserves local geometry.

2. **Estimate local covariances**
   - For each source and target point, collect k-nearest neighbors or voxel neighbors.
   - Compute local covariance.
   - Regularize eigenvalues to avoid singular matrices.
   - Cache target covariances for static maps.

3. **Initialize pose**
   - Use state estimator prediction, GNSS/RTK, wheel odometry, NDT coarse result, or previous scan-to-map output.

4. **Correspondence assignment**
   - Transform source points.
   - Find nearest target point or compatible neighborhood.
   - Reject by max distance, normal/covariance compatibility, and robust residual.

5. **Nonlinear optimization**
   - Minimize the GICP cost with Gauss-Newton, Levenberg-Marquardt, or BFGS-style optimization.
   - Recompute correspondences at each outer iteration.
   - Export pose, cost, correspondence count, Hessian, and convergence reason.

### VGICP

1. **Build or load target voxel map**
   - For static scan-to-map localization, precompute voxel means and covariances per map tile.
   - Keep multiple resolutions if using coarse-to-fine matching.
   - Store voxel occupancy, point count, covariance, normal/planarity, semantic stability, and map version.

2. **Voxelize source scan**
   - Downsample source points.
   - Estimate or approximate source covariances.
   - Optional: one representative per voxel for speed, or multiple points for accuracy.

3. **Voxel association**
   - Transform each source point into the target grid.
   - Associate to the target voxel at the transformed coordinate and optionally neighboring voxels.
   - Use nearest voxel, multi-voxel averaging, or trilinear interpolation depending on implementation.

4. **Parallel residual evaluation**
   - Compute Mahalanobis residuals independently for each point.
   - Reduce the cost, gradient, and Hessian in parallel.
   - Run CPU multi-threading or CUDA kernels.

5. **Quality gate**
   - Require enough valid voxel associations.
   - Require reasonable cost, spatial coverage, and Hessian conditioning.
   - Inflate uncertainty or reject if map covariance is weak or dynamic mismatch is high.

## Initialization / Convergence

GICP and VGICP remain local optimizers. Their objective is better shaped than plain ICP in many scenes, but wrong correspondences still create wrong minima.

Good initialization practices:

- Use the fused estimator pose as the default initial guess.
- Use multi-resolution schedules: large voxels/coarse thresholds first, smaller voxels/fine thresholds last.
- Use NDT or place recognition for cold start and global relocalization.
- Limit per-cycle correction relative to prediction unless relocalization mode is active.
- For scan-to-map, crop target tiles around the predicted pose to avoid far-away false associations.

Convergence behavior:

| Property | Classic GICP | VGICP |
|---|---|---|
| Objective quality | High | High, with voxel approximation |
| Correspondence cost | High due nearest-neighbor search | Low with voxel lookup |
| Parallelism | Moderate | Excellent |
| Sensitivity to voxel size | N/A or downsampling only | High |
| Static map reuse | Good | Excellent |
| Embedded deployment | CPU feasible but heavier | CPU/GPU production-friendly |

Tuning knobs:

- Source downsampling resolution.
- Target voxel resolution.
- Number of neighboring voxels searched.
- Covariance neighborhood size.
- Covariance regularization epsilon.
- Max correspondence distance.
- Robust kernel.
- Maximum iterations and convergence thresholds.

Common convergence failure modes:

- Initial pose outside the local basin.
- Voxel resolution too coarse, causing lost structure.
- Voxel resolution too fine, causing sparse invalid covariances.
- Dynamic objects dominating correspondences.
- Covariance regularization too aggressive or too weak.
- Map tile crop missing useful structure.

## Degeneracy

GICP/VGICP model local surfaces better than point-to-point ICP, but they do not remove fundamental observability limits.

Degenerate cases:

- Flat open apron: ground covariances constrain z/roll/pitch, weakly constrain x/y/yaw.
- Long terminal wall: wall-normal translation is strong, along-wall translation is weak.
- Symmetric gate structures: multiple local minima with similar covariance patterns.
- Sparse distant structure: covariance estimates are noisy and over-smoothed.
- Dynamic aircraft: rich geometry exists, but it may be absent from the reference map.

Diagnostics:

```text
H = final Gauss-Newton Hessian / information matrix
lambda_min / lambda_max       -> condition ratio
eigenvectors(lambda small)    -> weak pose directions
valid voxel association ratio -> map overlap
normal/covariance entropy     -> structural diversity
residual by semantic class    -> dynamic-object contamination
residual by LiDAR ID          -> extrinsic/time-offset problems
```

Handling strategy:

- Reject or downweight ground-only solutions for horizontal localization.
- Inflate factor covariance in weak eigen-directions.
- Use robust losses and semantic masks for aircraft, vehicles, pedestrians, and temporary equipment.
- Require map overlap across multiple azimuth sectors and height bands.
- Fuse with wheel odometry, IMU, and RTK/GNSS; do not rely on LiDAR in unobservable directions.
- Record degeneracy state as part of the localization health output.

Important: GICP residuals can look statistically well modeled even when the scene itself is unobservable. The covariance model describes local surface uncertainty, not global pose uniqueness.

## Runtime

Classic GICP is heavier than ICP because it needs local covariance estimation and Mahalanobis residuals. VGICP is designed to remove that cost from the hot path.

Runtime comparison:

| Method | Main cost | Typical production implication |
|---|---|---|
| Point-to-point ICP | nearest-neighbor search | Fast but less accurate on surfaces |
| Point-to-plane ICP | nearest-neighbor + normals | Fast if normals are precomputed |
| Classic GICP | nearest-neighbor + covariances + nonlinear solve | Accurate but can be slow |
| VGICP | voxel lookup + parallel Mahalanobis residuals | Best speed/accuracy tradeoff for dense maps |

The VGICP paper reports processing 15,000-point clouds at 30 Hz on CPU and 120 Hz on GPU. The `fast_gicp` repository reports approximate rates for its implementations: FastGICP around 40 FPS, FastVGICP around 70 FPS, CUDA FastVGICP around 120 FPS, and CUDA NDT around 500 FPS under the authors' benchmark conditions. Treat those as implementation benchmarks, not guaranteed vehicle-runtime numbers.

Runtime factors for AV deployment:

- Map tile size and memory layout.
- Voxel resolution and number of active voxels.
- Number of source points retained after downsampling.
- Whether source covariances are computed online or approximated.
- GPU memory transfer overhead.
- Multi-LiDAR merge versus per-LiDAR matching.
- Number of hypotheses for relocalization.

On an Orin-class platform, VGICP is appropriate for a 10 Hz LiDAR localization loop if buffers are preallocated, map tiles are resident, and point counts are bounded.

## AV Role

GICP/VGICP is well suited to production AV localization:

- **Primary scan-to-map matcher:** dense LiDAR scan against prebuilt voxel/covariance map.
- **LiDAR odometry:** scan-to-submap registration when map localization is unavailable.
- **Map construction:** align repeated survey passes with surface-aware residuals.
- **Graph factors:** provide a pose measurement and information matrix for GTSAM/iSAM2.
- **Multi-LiDAR fusion:** either merge scans into one source cloud or run per-LiDAR VGICP and fuse factors.
- **Health monitoring:** expose covariance, overlap, and degeneracy metrics.

VGICP is especially attractive for airside autonomy because the map can be preprocessed offline into a tiled voxel-Gaussian representation. The runtime system then does bounded lookup and optimization instead of expensive target geometry estimation.

## Indoor / Outdoor Relevance

| Environment | Relevance | Notes |
|---|---|---|
| Warehouses | Very high | Stable planar racks/walls; dynamic forklifts need filtering |
| Parking garages | Very high | Good surfaces; repeated bays require good initialization |
| Urban roads | Very high | Facades, curbs, poles, and road surfaces fit covariance modeling |
| Highways | Medium | Barriers/signs help; open lanes remain weak |
| Forests | Medium | Tree trunks help; foliage covariances are noisy/dynamic |
| Mines/tunnels | High but degenerate | Good local shape, weak along-axis direction |
| Airports | Very high near structures, medium overall | Excellent around terminals, weak on empty aprons |
| Indoor handheld | High with deskew | Continuous-time handling may matter more than objective choice |

## Airside Deployment Notes

Recommended airside VGICP map representation:

```text
Voxel:
  mean_xyz
  covariance_3x3
  inverse_covariance_3x3
  point_count
  planarity / linearity / scattering
  semantic class
  stability score from multi-session mapping
  last map version / tile ID
```

Deployment considerations:

- **Ground management:** Keep ground for z/roll/pitch, but cap its contribution so it does not dominate horizontal updates.
- **Stability scoring:** Static terminal facades and fixed poles should carry higher weight than areas often occupied by aircraft or GSE.
- **Dynamic masks:** Segment aircraft, buses, baggage carts, belt loaders, people, cones, and temporary barriers when possible.
- **Map versioning:** VGICP should report which map tile version produced each factor so localization failures can be tied to stale maps.
- **Multi-LiDAR calibration:** Residual-by-sensor diagnostics are mandatory. One bad extrinsic can bias the combined covariance field.
- **GPU determinism:** Preallocate CUDA buffers; bound source points; avoid runtime allocation and unbounded neighbor searches.
- **Fallbacks:** NDT is a useful coarse/fallback method; point-to-plane or KISS-ICP-style odometry can support degraded mode.

Airside zones:

| Zone | Expected VGICP behavior |
|---|---|
| Terminal frontage | Strong 6-DoF constraints from facades, jet bridges, poles, signs |
| Occupied stand | Good live geometry but map mismatch risk from movable aircraft/GSE |
| Empty apron | Weak x/y/yaw; rely on RTK/wheel/IMU and inflate LiDAR covariance |
| Service roads | Usually good if buildings/barriers/signage are visible |
| Taxiway/runway edge | Medium; edge lights/signs help but long open stretches remain weak |

## Benchmarks

Benchmark both accuracy and production behavior.

Method benchmarks:

- Compare point-to-point ICP, point-to-plane ICP, GICP, VGICP, and NDT on the same scan pairs.
- Sweep voxel size, covariance neighborhood, robust kernel, and source point count.
- Measure convergence basin by applying controlled perturbations in x/y/z/roll/pitch/yaw.
- Test map mismatch by removing/adding aircraft and GSE clusters.
- Test degeneracy by selecting ground-only and facade-only map crops.

Public datasets:

- KITTI and KITTI-360 for automotive outdoor odometry/localization.
- MulRan for urban repeated structures.
- Newer College for indoor-outdoor variation.
- NCLT for long-term changes.
- Hilti SLAM for aggressive motion and indoor complexity.

Airside private benchmark requirements:

| Metric | Requirement |
|---|---|
| Lateral position error | Track separately from 3D RMSE |
| Yaw error | Critical for docking and lane following |
| Covariance calibration | Error should match reported uncertainty |
| Degeneracy recall | Detector should trigger before large pose drift |
| Runtime p99 | Must fit localization cycle budget |
| Map-change robustness | Dynamic aircraft/GSE should not silently corrupt pose |
| Recovery | Relocalization after GNSS/scan-match dropout |

Useful acceptance pattern:

```text
structured zones: VGICP should dominate estimator corrections
open apron:       VGICP should report weak horizontal observability
dynamic stands:   VGICP should reject or downweight moving/non-map objects
```

## Open-Source Implementations

| Implementation | Methods | Notes |
|---|---|---|
| PCL `GeneralizedIterativeClosestPoint` | GICP | Mature C++ baseline |
| Open3D `RegistrationGeneralizedICP` | GICP | Good research/prototyping API |
| `koide3/fast_gicp` | FastGICP, FastVGICP, CUDA VGICP, CUDA NDT | Widely used high-performance implementation |
| `koide3/small_gicp` | GICP, VGICP, ICP, point-to-plane | Newer compact C++/Python library with strong threading |
| GLIM / hdl_graph_slam ecosystem | GICP/VGICP factors | Relevant for graph-based mapping and localization |
| Autoware integrations | Usually NDT primary, GICP variants in ecosystem | Useful production reference patterns |

Production selection notes:

- Use `fast_gicp` or `small_gicp` for practical evaluation before writing custom kernels.
- Prefer a library that exposes convergence status, Hessian/information, residuals, and correspondence counts.
- Check license compatibility before embedding in product code.
- Keep a deterministic wrapper around all third-party registration calls.

## Practical Recommendation

Use VGICP as the primary classical scan-to-map matcher for a dense 3D LiDAR map when GPU or strong multi-core CPU budget is available.

Recommended stack:

1. Precompute tiled voxel-Gaussian maps from stable multi-session survey data.
2. Run multi-resolution VGICP initialized by the fused estimator pose.
3. Use robust kernels and dynamic-object masks.
4. Export full quality diagnostics and anisotropic covariance to the factor graph.
5. Fall back to NDT for coarse recovery and point-to-plane/KISS-ICP-style odometry for degraded operation.
6. In open apron zones, let wheel/IMU/RTK dominate horizontal pose unless VGICP observes vertical structure with good spatial coverage.

Do not deploy GICP/VGICP as a black box that returns only a pose and scalar score. The method is strong enough for production only when covariance, degeneracy, overlap, and map-change diagnostics are first-class outputs.

## Sources

- Segal, A., Haehnel, D., and Thrun, S. (2009). "Generalized-ICP." Robotics: Science and Systems. DOI: `10.15607/RSS.2009.V.021`. https://www.roboticsproceedings.org/rss05/p21.html
- Segal, A., Haehnel, D., and Thrun, S. "Generalized-ICP" PDF. https://www.robots.ox.ac.uk/~avsegal/resources/papers/Generalized_ICP.pdf
- Koide, K., Yokozuka, M., Oishi, S., and Banno, A. (2021). "Voxelized GICP for Fast and Accurate 3D Point Cloud Registration." ICRA. DOI: `10.1109/ICRA48506.2021.9560835`. https://staff.aist.go.jp/k.koide/assets/pdf/icra2021_02.pdf
- `fast_gicp` repository. https://github.com/koide3/fast_gicp
- `small_gicp` repository and docs. https://github.com/koide3/small_gicp
- PCL `GeneralizedIterativeClosestPoint` documentation. https://pointclouds.org/documentation/classpcl_1_1_generalized_iterative_closest_point.html
- Open3D Generalized ICP API. https://open3d.org/docs/latest/cpp_api/_generalized_i_c_p_8h.html
- Koide, K. et al. (2021). "Globally Consistent 3D LiDAR Mapping with GPU-accelerated GICP Matching Cost Factors." arXiv. https://arxiv.org/abs/2109.07073
