# Point-to-Plane ICP for 3D SLAM and LiDAR Localization

<!-- method-priority:start
priority:
  learning: 5
  deployment: 4
  type: "method-family"
  stage: "foundation"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "validation"]
  reason: "Point-to-Plane ICP for 3D SLAM and LiDAR Localization is rated for foundational SLAM modeling, optimization, registration, or mapping concepts."
method-priority:end -->

Related library pages: [Production LiDAR-to-Map Localization](../overview/production-lidar-map-localization.md) and [Modern LiDAR SLAM and Odometry Algorithms](../overview/lidar-slam-algorithms.md).

## Executive Summary

Point-to-plane ICP replaces the classic ICP point-to-point distance with distance from each transformed source point to the tangent plane of its matched target surface. This is a small change with a large effect: it optimizes against the physical surface rather than the discrete target samples. As a result, it usually converges in fewer iterations and gives more accurate fine alignment on walls, ground, facades, road surfaces, aircraft bodies, and other locally smooth structures.

For 3D SLAM, point-to-plane ICP is the classical workhorse behind many "direct" LiDAR odometry and mapping systems. LOAM-style systems often express edge and planar feature residuals as point-to-line and point-to-plane terms; FAST-LIO-class systems use point-to-plane residuals against local map planes; RGB-D odometry and many dense mapping systems use the same residual. For AV scan-to-map localization, it is a strong CPU-friendly baseline when the reference map has stable normals and the live scan is well initialized.

Its weakness is observability. A single plane only constrains motion normal to the plane plus rotations that change the plane fit. A flat airport apron gives excellent constraints on height, roll, and pitch, but poor constraints on x, y, and yaw. Point-to-plane ICP must therefore be paired with Hessian eigenvalue diagnostics, robust outlier handling, and anisotropic covariance before being used as a safety-relevant localization factor.

## Math / Objective

Given source point \(p_i\), target correspondence \(q_i\), target unit normal \(n_i\), and transform \(T = (R,t)\), the point-to-plane residual is:

```text
r_i(T) = n_i^T (R p_i + t - q_i)
```

The objective is:

```text
min_T sum_i rho( w_i [ n_i^T (R p_i + t - q_i) ]^2 )
```

where:

- \(n_i\) is usually the target/map normal at \(q_i\).
- \(w_i\) can encode normal confidence, range, LiDAR ID, semantic class, or robust reweighting.
- `rho` is optional but strongly recommended in real scans.

Using a left perturbation \(T' = exp(\xi^) T\), with \(\xi = [\omega_x,\omega_y,\omega_z,t_x,t_y,t_z]^T\), the linearized residual is:

```text
r_i(T') ~= r_i(T) + J_i xi
J_i = n_i^T [ -[R p_i]_x   I_3 ]
```

The Gauss-Newton normal equations are:

```text
H delta = -g
H = sum_i J_i^T W_i J_i
g = sum_i J_i^T W_i r_i
T <- exp(delta^) T
```

For small rotations, Low's linear least-squares derivation uses the approximations `sin(theta) ~= theta` and `cos(theta) ~= 1` to produce a direct linear system in the six pose parameters. In modern SLAM code, the Lie algebra formulation is usually cleaner and composes correctly on `SE(3)`.

The key geometric difference from point-to-point ICP:

```text
Point-to-point:   penalizes all 3 residual directions equally
Point-to-plane:   penalizes only the target surface normal direction
```

That is why point-to-plane ICP does not fight harmless tangential sampling differences on a wall or ground plane.

## Algorithm Pipeline

1. **Preprocess the live scan**
   - Deskew to a common time.
   - Remove self hits, invalid ranges, weather speckle, and known dynamic masks if available.
   - Downsample using a voxel size matched to target map density.
   - Optionally retain higher density near poles, curbs, walls, and other structured features.

2. **Prepare target normals**
   - For offline maps, compute normals once during map build.
   - Estimate each normal from a k-nearest-neighbor or voxel neighborhood PCA.
   - Store normal confidence from eigenvalue spread, point count, and multi-session stability.
   - Orient normals consistently if point-to-plane sign is used for diagnostics; squared residuals do not require global orientation.

3. **Initialize pose**
   - Use the estimator's prediction from IMU, wheel odometry, GNSS/RTK, or the previous LiDAR factor.
   - For cold start, use NDT, place recognition, or global registration first.

4. **Find correspondences**
   - Transform each source point.
   - Query nearest target point or target voxel centroid.
   - Reject matches beyond a distance threshold.
   - Reject matches whose target normal is low confidence.
   - Optionally reject source-target normal angle outliers if source normals are available.

5. **Build residuals**
   - Residual: `n_i dot (T p_i - q_i)`.
   - Weight by normal confidence, range, semantic stability, and [robust loss](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md).
   - Downweight ground in x/y/yaw-sensitive localization zones if it dominates the correspondence set.

6. **Solve and update**
   - Accumulate a 6x6 Hessian and 6x1 gradient.
   - Solve with Cholesky/LDLT/SVD, with damping if ill-conditioned.
   - Compose the update on `SE(3)`.
   - Recompute correspondences and repeat.

7. **Quality and covariance**
   - Export RMSE, robust cost, inlier ratio, Hessian eigenvalues, normal coverage, and iteration count.
   - Convert the final Hessian into an information estimate only after degeneracy checks.

## Initialization / Convergence

Point-to-plane ICP has a wider practical convergence basin than point-to-point ICP for smooth surfaces, but it is still a local method. Nearest-neighbor correspondences must be mostly correct. If the initialization places a scan near the wrong facade, wrong aircraft side, or wrong repeated gate structure, the optimizer can confidently converge to the wrong place.

Good initialization sources:

- High-rate state prediction from IMU and wheel odometry.
- RTK/GNSS pose with map-frame calibration.
- Previous scan-to-map result in a rolling estimator.
- Multi-resolution NDT for coarse alignment.
- Place recognition plus ICP verification for relocalization.

Convergence tuning:

| Parameter | Practical guidance |
|---|---|
| Voxel size | 0.2-0.5 m for near-field AV localization; coarser for first stage |
| Normal neighborhood | Large enough to suppress LiDAR noise, small enough to avoid blending edges |
| Max correspondence distance | Start 1-3 m coarse, shrink to 0.3-1 m fine |
| Iterations | 10-30 with good initial pose; 30-60 for coarse refinement |
| Damping | Use LM or trust region when Hessian condition number is high |
| [Outlier weighting](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) | Required near vehicles, aircraft, pedestrians, rain, and temporary equipment |

Point-to-plane ICP converges fastest when:

- The target map has stable, accurately estimated normals.
- The live scan and map have similar geometry after dynamic filtering.
- Correspondences cover multiple non-parallel planes or curved structures.
- Motion distortion and time offsets are smaller than the map resolution.

It degrades when:

- Normals are noisy or computed from too few points.
- A single plane dominates the scene.
- The initial yaw or lateral error is outside the nearest-neighbor basin.
- Dynamic objects create many plausible planar correspondences.

## Degeneracy

The Hessian makes point-to-plane degeneracy especially visible. Each residual contributes one scalar constraint in the target normal direction:

```text
H = sum_i J_i^T W_i J_i
```

If all normals are similar, the rank and conditioning of \(H\) are poor. A flat ground plane produces strong constraints for z, roll, and pitch, but weak constraints for x, y, and yaw. A single vertical wall constrains translation normal to the wall and some rotations, but not translation along the wall.

Common degeneracy cases:

| Geometry | Strong constraints | Weak constraints |
|---|---|---|
| Flat ground | z, roll, pitch | x, y, yaw |
| Single wall | wall-normal translation, some yaw/roll | along-wall translation |
| Corridor | lateral position, yaw | along-corridor translation |
| Open apron | z/roll/pitch from ground | horizontal pose |
| Repeated gate facade | local plane fit | global association |
| Parked aircraft only | rich shape if static | map mismatch if aircraft moved |

Degeneracy handling:

- Eigen-decompose the Hessian and inflate covariance along small-eigenvalue directions.
- Project the pose update onto the well-constrained subspace when necessary.
- Maintain prior constraints from IMU, wheel odometry, RTK, and map route priors.
- Limit state correction magnitude when structural coverage is low.
- Detect "one-surface" correspondence sets by normal histogram entropy.
- Require vertical structures for high-confidence x/y/yaw updates in open airport zones.

Avoid the common mistake of using final residual alone as a quality score. A ground-only point-to-plane alignment can have very low residual and still be unusable for horizontal localization.

## Runtime

Point-to-plane ICP has similar correspondence cost to point-to-point ICP, but each residual is scalar and the 6x6 solve is cheap.

Runtime components:

| Step | Cost driver | Notes |
|---|---|---|
| Normal lookup | Target map storage | Precompute for offline maps |
| Correspondence search | Source point count and target index | kd-tree or voxel hash dominates |
| Residual accumulation | Inlier count | Parallel reduction is straightforward |
| Linear solve | Constant | 6x6 solve is negligible |
| Iterations | Initialization and scene quality | Usually fewer than point-to-point |

Typical AV-scale CPU runtime:

- 5k-20k points, local map target: 5-25 ms.
- 20k-60k points, larger map crop: 20-80 ms.
- With voxelized map and parallel residual accumulation: real-time at 10-20 Hz is practical.

GPU acceleration is possible but often unnecessary unless the system is matching many LiDARs independently or running multiple hypotheses. On NVIDIA Orin, point-to-plane can be CPU fallback while VGICP/NDT use GPU.

## AV Role

Point-to-plane ICP is a strong AV method for:

- **Fine scan-to-map localization:** after NDT or estimator-based initialization.
- **LiDAR odometry:** direct scan-to-submap alignment in structured environments.
- **Map construction:** refining survey passes against local surfel maps.
- **Factor graph measurements:** generating relative or absolute LiDAR pose factors with an information matrix.
- **Fallback from GICP/VGICP:** if covariance estimation for GICP fails but normals remain valid.

It is also a bridge between simple ICP and probabilistic methods. GICP can be viewed as a probabilistic generalization that models covariance on both source and target instead of only using the target tangent plane.

## Indoor / Outdoor Relevance

| Environment | Relevance | Notes |
|---|---|---|
| Warehouses | High | Walls, racks, pillars, and floors give strong planar structure |
| Offices/hospitals | High | Good geometry, but dynamic people and glass need filtering |
| Tunnels | Medium | Cross-section is constrained, along-axis remains weak |
| Urban streets | High | Facades, curbs, poles, and road surfaces provide diverse normals |
| Highways | Medium | Works near barriers/signs; weak in open lanes |
| Forests | Medium-low | Normals are noisy on vegetation; point-to-point or GICP may be better |
| Airports | High near terminal, low on open apron | Must separate vertical-structure matches from ground-only matches |
| Construction/mining | High with stable geometry | Dust, moving machinery, and sparse long-range returns require [robust loss](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) |

## Airside Deployment Notes

Point-to-plane ICP maps well to airside geometry but needs strict quality control:

- **Ground dominance:** A vehicle-mounted LiDAR sees many apron points. Downsampling must prevent the ground from overwhelming vertical structures.
- **Vertical structure requirement:** High-confidence x/y/yaw correction should require non-ground normals from terminal facades, jet bridges, poles, signs, barriers, parked static infrastructure, or building corners.
- **Dynamic planar objects:** Aircraft fuselage, buses, cargo loaders, and containers produce clean planes that may not exist in the reference map. Treat semantic dynamic classes as low weight unless the map explicitly models them as temporary landmarks.
- **Weather and reflectivity:** Wet concrete and glass can bias normals or create sparse returns. Use normal confidence and intensity/range filters.
- **Multi-LiDAR normal consistency:** If LiDAR extrinsics drift, merged clouds create smeared planes. Monitor residual by LiDAR ID and reject one sensor rather than corrupting the pose.
- **Certification evidence:** Log Hessian eigenvalues, normal histograms, inlier spatial coverage, and covariance inflation decisions for every accepted factor.

Recommended airside acceptance tests:

- Empty apron with no nearby aircraft.
- Stand occupied by aircraft not present in the static map.
- Terminal facade approach with jet bridge geometry.
- Rain/wet concrete replay.
- Long straight taxi-lane drive with RTK truth.
- Sensor time-offset injection to verify deskew sensitivity.

## Benchmarks

Benchmark point-to-plane ICP at two levels.

Component benchmarks:

| Test | Expected insight |
|---|---|
| Synthetic plane/corner/corridor | Verify rank, degeneracy, and update direction |
| Same scan with controlled perturbations | Measure convergence basin |
| Downsample sweep | Tune voxel size versus accuracy/runtime |
| Normal radius sweep | Tune normal stability versus edge preservation |
| Dynamic object injection | Validate [robust loss](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) and rejection thresholds |

System benchmarks:

| Dataset / route | Value |
|---|---|
| KITTI / KITTI-360 | Outdoor AV odometry and scan-to-map replay |
| MulRan | Urban repeated structures and revisits |
| Newer College | Indoor-outdoor handheld, motion distortion sensitivity |
| Hilti SLAM | Aggressive motion and indoor/outdoor transitions |
| Airport private data | Required for airside deployment; public road data does not cover apron degeneracy |

Metrics:

- ATE/RPE against RTK or survey truth.
- Lateral/yaw error, not just 3D RMSE.
- Inlier RMSE and robust cost.
- Hessian eigenvalues and eigenvectors.
- Percentage of accepted factors with covariance inflation.
- Runtime p50/p95/p99.
- Failure detection latency.

Open3D's ICP tutorial demonstrates the practical convergence difference: point-to-plane reaches tight alignment within the default iteration budget where point-to-point may require many more iterations. That behavior is consistent with robotics practice, but production validation must be done on the target sensor and map pipeline.

## Open-Source Implementations

| Implementation | Notes |
|---|---|
| Open3D `TransformationEstimationPointToPlane` | Easy Python/C++ experiments; supports [robust kernels](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) in registration pipeline |
| PCL registration stack | Mature C++ base; point-to-plane variants commonly built with custom estimators |
| libpointmatcher | Flexible filters/outlier models; useful for research and tuning |
| LOAM / LeGO-LOAM / LIO-SAM family | Use point-to-plane-like planar feature residuals in LiDAR odometry |
| FAST-LIO / Faster-LIO family | Direct point-to-plane residuals against incremental local maps |
| GTSAM custom factors | Recommended when adding point-to-plane residuals directly into a factor graph |

Production implementation requirements:

- Store target normal, normal confidence, and source LiDAR ID with each residual.
- Provide a [robust loss](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) and distance/normal-angle gates.
- Expose the full 6x6 Hessian or information matrix.
- Mark factors as partially degenerate when eigenvalue ratios fail thresholds.
- Support multi-resolution operation with shrinking correspondence gates.

## Practical Recommendation

Use point-to-plane ICP as the default CPU fine-registration baseline for structured scenes and as the conceptual stepping stone to GICP/VGICP.

For airside localization:

1. Use point-to-plane ICP only after a good pose prior or coarse method.
2. Precompute normals and normal confidence in the static map.
3. Separate ground and non-ground residual metrics.
4. Require non-ground structural coverage before applying high-confidence horizontal/yaw corrections.
5. Insert anisotropic covariance into the estimator; never use a scalar "ICP noise" value for all scenes.
6. Prefer VGICP as the primary production matcher when GPU budget is available, with point-to-plane ICP retained as a readable fallback and diagnostic baseline.

## Sources

- Chen, Y. and Medioni, G. (1992). "Object modelling by registration of multiple range images." Image and Vision Computing. DOI: `10.1016/0262-8856(92)90066-C`. https://cir.nii.ac.jp/crid/1360282588962492672
- Besl, P. J. and McKay, N. D. (1992). "A Method for Registration of 3-D Shapes." IEEE TPAMI. DOI: `10.1109/34.121791`. https://cir.nii.ac.jp/crid/1363107368959994496
- Low, K.-L. (2004). "Linear Least-Squares Optimization for Point-to-Plane ICP Surface Registration." UNC technical report TR04-004. https://www.comp.nus.edu.sg/~lowkl/publications/lowk_point-to-plane_icp_techrep.pdf
- Rusinkiewicz, S. and Levoy, M. (2001). "Efficient Variants of the ICP Algorithm." 3DIM. DOI: `10.1109/IM.2001.924423`.
- Open3D ICP documentation, including point-to-plane objective and API. https://www.open3d.org/docs/latest/tutorial/pipelines/icp_registration.html
- Zhang, J. and Singh, S. (2014/2017). "LOAM: Lidar Odometry and Mapping in Real-time." Robotics: Science and Systems / Autonomous Robots.
- Xu, W. et al. (2022). "FAST-LIO2: Fast Direct LiDAR-Inertial Odometry." IEEE Transactions on Robotics. DOI: `10.1109/TRO.2022.3141876`.
