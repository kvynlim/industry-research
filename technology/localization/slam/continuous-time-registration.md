# Continuous-Time Registration for LiDAR SLAM and AV Localization

Related library pages: [Production LiDAR-to-Map Localization](../production-lidar-map-localization.md) and [Modern LiDAR SLAM and Odometry Algorithms](../lidar-slam-algorithms.md).

## Executive Summary

Continuous-time registration estimates a trajectory during a LiDAR scan instead of assigning one rigid pose to the entire scan. This matters because spinning and scanning LiDARs acquire points over tens of milliseconds while the vehicle is moving. If every point is treated as if it was captured at the same time, the scan is distorted. The error is often called motion distortion, rolling-shutter distortion, or deskew error.

Most production AV stacks handle this with a separate deskew step driven by IMU/wheel odometry, then run a discrete-time scan matcher such as VGICP or NDT. Continuous-time registration goes further: it estimates the within-scan motion as part of registration. CT-ICP is the best-known modern LiDAR-only example. It assigns each scan an elastic trajectory, allowing the scan to deform onto the map during matching while preserving discontinuity between scans. The CT-ICP paper reports strong results across KITTI, KITTI-raw, KITTI-360, KITTI-CARLA, ParisLuco, Newer College, and NCLT, with 0.59 percent average KITTI relative translation error and 60 ms average time per scan on a single CPU thread.

For airside AV localization, continuous-time registration is not necessarily the first production method because speeds are lower than highways and the stack usually has IMU/wheel odometry for deskew. It is highly relevant for map construction, multi-LiDAR calibration validation, high-accuracy replay, poor time synchronization, aggressive turns, uneven pavement, and cases where LiDAR-only odometry must remain accurate without trusting inertial deskew.

## Math / Objective

### Discrete-Time Assumption

Standard scan matching assumes one pose for the whole scan:

```text
x_i_map = T_k p_i
min_T sum_i residual(T p_i, map)
```

This is only correct if the scan is instantaneous or the vehicle is stationary during acquisition.

### Continuous-Time Trajectory

Continuous-time registration assigns each point a timestamp \(t_i\) and evaluates a trajectory \(T(t_i)\):

```text
x_i_map = T(t_i) p_i
min_trajectory sum_i residual(T(t_i) p_i, map)
```

The trajectory can be parameterized in several ways:

| Parameterization | Description | Use |
|---|---|---|
| Start/end pose interpolation | One pose at scan start and one at scan end; interpolate per point | Simple, CT-ICP-style elastic scan |
| Constant velocity | Pose and velocity define motion through the scan | Lightweight deskew |
| B-spline on SE(3) | Smooth trajectory controlled by knots | Accurate for continuous-time SLAM and mapping |
| Gaussian process trajectory | Prior over smooth motion with GP interpolation | Principled uncertainty, heavier compute |
| IMU-preintegrated trajectory | High-rate IMU provides motion prior between knots | Common in LiDAR-inertial systems |

For a point-to-plane continuous-time residual:

```text
r_i = n_i^T ( T(t_i) p_i - q_i )
```

For a GICP/VGICP continuous-time residual:

```text
d_i = q_i - T(t_i) p_i
M_i = C_q + R(t_i) C_p R(t_i)^T
r_i = d_i^T M_i^-1 d_i
```

Optimization variables are trajectory parameters rather than one rigid pose. For a start/end scan model:

```text
variables: T_start, T_end
point time alpha_i in [0,1]
T(t_i) = interpolate_SE3(T_start, T_end, alpha_i)
```

Kitware's CT-ICP summary describes this as moving from 6 degrees of freedom per scan to 12 degrees of freedom per scan, allowing elastic registration during acquisition.

## Algorithm Pipeline

1. **Preserve per-point time**
   - Keep timestamp, firing time, ring, azimuth, or packet time for every point.
   - Normalize point time within the scan.
   - Validate LiDAR clock synchronization and packet ordering.

2. **Initial trajectory prediction**
   - Use constant velocity from previous poses, IMU/wheel odometry, or fused estimator output.
   - For LiDAR-only CT-ICP, predict motion from previous scan registration.
   - For multi-LiDAR rigs, account for each sensor's acquisition window and extrinsic transform.

3. **Map / target preparation**
   - Use a dense local map, voxel map, surfel map, NDT map, or rolling submap.
   - Keep target geometry fixed during one optimization iteration.
   - Use robust filtering for dynamic objects.

4. **Point transformation**
   - For each source point, evaluate \(T(t_i)\).
   - Transform the point to the map frame.
   - Find correspondence or voxel association.

5. **Residual construction**
   - Use point-to-plane, GICP/VGICP, NDT, or implicit-surface residuals.
   - Weight by timestamp confidence, range, LiDAR ID, semantic class, and robust kernel.

6. **Trajectory optimization**
   - Optimize pose knots or start/end poses.
   - Recompute correspondences as the trajectory changes.
   - Regularize motion so the trajectory remains physically plausible.
   - Optionally add IMU/wheel priors between trajectory knots.

7. **Insert corrected scan**
   - Use corrected per-point poses to insert points into the local map.
   - Export a representative scan pose, trajectory segment, and covariance.
   - Record deskew residuals and timing diagnostics.

## Initialization / Convergence

Continuous-time registration has more degrees of freedom than rigid scan matching, so initialization and regularization matter more.

Good initializers:

- Constant velocity from previous LiDAR odometry.
- IMU preintegration through the scan.
- Wheel odometry for ground vehicles.
- Discrete-time VGICP/NDT result as a scan-level pose, then refine elastically.
- GNSS/RTK and heading prior for scan-to-map localization.

Convergence considerations:

- If the scan-level pose is wrong, the continuous-time solver can deform the scan toward a wrong local minimum.
- If motion regularization is too weak, the trajectory can overfit map noise or dynamic objects.
- If regularization is too strong, the result collapses back to rigid registration and does not correct distortion.
- Per-point timestamps must be correct. A timing bug can look like a trajectory-estimation problem.
- For low-speed vehicles, the benefit may be smaller than the added complexity unless high map quality is required.

Practical convergence gates:

| Gate | Purpose |
|---|---|
| Max within-scan velocity/acceleration | Prevent overfitting and impossible motion |
| Start/end pose innovation | Detect conflict with estimator prediction |
| Residual by time bucket | Detect time offset or rolling-shutter model errors |
| Residual by LiDAR ID | Detect extrinsic/time sync errors in multi-LiDAR rigs |
| Knot covariance | Detect poorly constrained trajectory segments |
| Final rigid-equivalent correction | Decide how to feed the estimator |

## Degeneracy

Continuous-time registration can improve motion-distorted scans, but it introduces new degeneracy modes because more variables must be constrained.

Classic geometric degeneracy still applies:

- Ground-only scans weakly constrain x/y/yaw.
- Corridors weakly constrain along-axis translation.
- Repeated structures create false local minima.
- Dynamic objects create plausible but wrong correspondences.

Continuous-time-specific degeneracy:

- **Time-motion ambiguity:** A time offset can mimic a velocity error.
- **Elastic overfit:** The scan can bend to dynamic objects if regularization is weak.
- **Weak within-scan motion observability:** If the vehicle moves slowly or the scene lacks structure, start and end poses may not be separately observable.
- **Multi-LiDAR coupling:** Extrinsic error, clock offset, and trajectory error can explain the same residuals.
- **Map feedback:** If corrected scans are inserted into a map immediately, a wrong trajectory can pollute the map and become self-reinforcing.

Handling:

- Use motion priors from IMU/wheel odometry even if the registration is LiDAR-dominant.
- Limit the number of trajectory knots unless data supports more.
- Track Hessian eigenvalues for the full trajectory block, not only the representative scan pose.
- Validate residuals over point time. A monotonic residual trend often indicates timing or deskew error.
- Do not insert scans into the map when trajectory covariance or dynamic-object residuals are high.
- For factor graphs, marginalize the trajectory segment into a pose factor only after preserving uncertainty from weak directions.

## Runtime

Continuous-time registration is heavier than rigid registration because each point requires trajectory interpolation and each optimization has more state variables.

Runtime drivers:

| Driver | Effect |
|---|---|
| Number of trajectory knots | Increases state size and solve cost |
| Point count | Increases interpolation and residual evaluation |
| Correspondence search | Still dominates if using nearest neighbors |
| Residual type | GICP/VGICP and NDT add covariance/grid costs |
| Regularization factors | Add sparse block structure |
| Recomputed correspondences | Outer iterations can be expensive |

CT-ICP's reported 60 ms single-thread CPU runtime is strong for LiDAR-only odometry, but production scan-to-map localization with multi-LiDAR inputs and additional diagnostics must be budgeted separately. If the main loop target is 10 Hz, continuous-time registration can fit; if the target is 20-50 Hz on embedded hardware, a separate IMU deskew plus rigid VGICP may be more practical.

Optimization strategies:

- Use two-pose start/end model before adding more knots.
- Use voxel hash maps for fast neighborhood search.
- Keep point counts bounded with structure-aware sampling.
- Parallelize per-point residuals.
- Precompute interpolation coefficients.
- Run continuous-time refinement only when motion distortion metrics justify it.

## AV Role

Continuous-time registration can play several roles:

- **Map construction:** produce cleaner maps from survey drives by correcting within-scan distortion.
- **LiDAR-only odometry:** maintain accuracy when IMU is absent, unreliable, or not fused.
- **High-speed operation:** correct large within-scan displacement.
- **Aggressive maneuvers:** handle rapid yaw, pitch, or vibration better than constant-velocity deskew.
- **Multi-LiDAR validation:** expose timing/extrinsic residual patterns across sensors.
- **Offline replay truthing:** compare rigid-deskew pipeline against an elastic registration reference.
- **Fallback research path:** provide LiDAR-only resilience if inertial pipeline fails.

For a production AV localization loop, the most pragmatic architecture is usually:

```text
IMU/wheel deskew -> rigid VGICP/NDT scan-to-map -> factor graph
continuous-time registration -> survey mapping, replay validation, or selected high-distortion cases
```

## Indoor / Outdoor Relevance

| Environment | Relevance | Notes |
|---|---|---|
| High-speed roads | Very high | Within-scan displacement can be large |
| Urban driving | High | Turns and bumps create distortion; structure supports estimation |
| Indoor handheld | Very high | Rapid rotations make rigid scans poor |
| Warehouses | Medium-high | Low speed but vibration and tight turns can matter |
| Mines/tunnels | High | Vehicle motion and rough terrain distort scans; along-axis degeneracy remains |
| Airports | Medium-high | Speeds are moderate, but multi-LiDAR timing and map quality matter |
| Open apron | Medium | Less geometric support for extra trajectory DoF |
| Terminal/gate areas | High | Rich structure supports elastic correction |

## Airside Deployment Notes

Airside vehicles often move slower than highway vehicles, but continuous-time effects still matter:

- **Long LiDAR sweep duration:** 10 Hz spinning LiDARs acquire over roughly 100 ms. Even at low speed, tight turns near stands can distort geometry.
- **Multi-LiDAR rigs:** 4-8 LiDARs with different firing times and packet delays create a compound rolling-shutter problem. Per-point time and per-sensor time offsets must be logged.
- **Map construction quality:** Survey maps should use the best available deskew/continuous-time correction. A distorted map makes every later scan-to-map method worse.
- **Docking and close maneuvers:** Small pose errors near aircraft stands or terminal equipment can matter more than in open-road driving.
- **Vibration:** GSE platforms can experience vibration from pavement seams, ramps, towing loads, and engine vibration; IMU priors help.
- **Open apron observability:** Extra trajectory degrees of freedom should be disabled or strongly regularized when the scan sees only ground.
- **Operational validation:** Compare rigid deskew, IMU deskew, and continuous-time registration on the same replay to determine if CT complexity is justified.

Recommended deployment pattern:

1. Preserve per-point timestamps in all recorded data.
2. Implement and validate IMU/wheel deskew first.
3. Use continuous-time registration offline for survey map production and replay diagnostics.
4. Enable online CT refinement only in zones or maneuvers where rigid residual-by-time diagnostics show measurable distortion.
5. Never use CT refinement to compensate for unknown extrinsic or clock calibration without reporting that calibration fault.

## Benchmarks

Continuous-time benchmarks should isolate motion distortion rather than only final trajectory error.

Benchmark tests:

| Test | Purpose |
|---|---|
| Rigid vs deskewed vs continuous-time replay | Quantify benefit over production baseline |
| Controlled yaw-rate sequences | Measure turn distortion correction |
| Time-offset injection | Verify residual-by-time diagnostics |
| Multi-LiDAR extrinsic perturbation | Separate timing/extrinsic/trajectory errors |
| High-frequency vibration route | Test regularization and IMU priors |
| Open-apron route | Confirm CT does not overfit weak geometry |
| Survey map quality comparison | Measure map sharpness and downstream localization improvement |

Metrics:

- ATE/RPE against RTK/survey truth.
- Relative translation/rotation error over short intervals.
- Map sharpness: plane thickness, pole radius, facade crispness.
- Residual as a function of point time.
- Start/end pose covariance and correlation.
- Runtime p50/p95/p99.
- Downstream scan-to-map localization accuracy using the produced map.

Public references:

- CT-ICP reports evaluation on KITTI, KITTI-raw, KITTI-360, KITTI-CARLA, ParisLuco, Newer College, and NCLT.
- Hilti-style handheld datasets are useful for aggressive motion, though they may be harsher than airside vehicle motion.
- KITTI high-speed sequences are useful for clear rolling-shutter effects.

Airside private data is still required because aircraft stands, wide aprons, multi-LiDAR rigs, and low-speed docking maneuvers are not represented well in public driving datasets.

## Open-Source Implementations

| Implementation | Notes |
|---|---|
| CT-ICP (`jedeschaud/ct_icp`) | MIT-licensed C++ implementation of Continuous-Time LiDAR Odometry; ROS and library usage |
| pyLiDAR-SLAM | Python project integrating CT-ICP bindings and dataset tooling |
| Kitware LiDAR SLAM / LidarView ecosystem | Production-oriented LiDAR SLAM context from the CT-ICP collaborators |
| KISS-ICP | Not continuous-time optimization, but includes practical motion compensation baseline |
| LOAM/LIO-SAM/FAST-LIO families | Usually perform deskew with IMU or motion model rather than full CT optimization |
| STEAM / GP continuous-time SLAM research code | Relevant for Gaussian-process trajectory formulations |

Implementation requirements:

- Per-point timestamp preserved from driver to registration.
- Explicit sensor extrinsics and time offsets.
- Bounded trajectory parameter count.
- Motion priors and robust losses.
- Residual logging by point time and LiDAR ID.
- Safe rejection path when trajectory block is ill-conditioned.

## Practical Recommendation

For airside production localization, do not replace a proven IMU/wheel deskew plus rigid VGICP/NDT pipeline with continuous-time registration by default. Use continuous-time registration where it has clear value:

1. Survey map construction and map QA.
2. Offline replay to quantify motion distortion and time-sync errors.
3. High-distortion maneuvers such as tight turns, rough surfaces, ramps, or high yaw-rate operation.
4. LiDAR-only fallback research when inertial inputs are degraded.
5. Multi-LiDAR calibration and timestamp validation.

The practical target architecture is hybrid: preserve all timing data, deskew every scan with the estimator, run rigid VGICP/NDT for the real-time factor, and keep CT-ICP-style refinement available for mapping, diagnostics, and selected online conditions where it demonstrably improves accuracy without overfitting.

## Sources

- Dellenbach, P., Deschaud, J.-E., Jacquet, B., and Goulette, F. (2022). "CT-ICP: Real-time Elastic LiDAR Odometry with Loop Closure." ICRA. DOI: `10.1109/ICRA46639.2022.9811849`; arXiv: `2109.12979`. https://arxiv.org/abs/2109.12979
- CT-ICP repository. https://github.com/jedeschaud/ct_icp
- Kitware CT-ICP overview. https://www.kitware.com/presenting-ct-icp-a-kitware-europe-state-of-the-art-lidar-only-odometry-and-mapping-presented-at-icra-2022/
- Bosse, M. and Zlot, R. (2009). "Continuous 3D scan-matching with a spinning 2D laser." ICRA.
- Anderson, S. and Barfoot, T. (2013/2015). Continuous-time trajectory estimation and Gaussian-process motion priors for robotics.
- Zhang, J. and Singh, S. (2014/2017). "LOAM: Lidar Odometry and Mapping in Real-time." RSS / Autonomous Robots.
- Vizzo, I. et al. (2023). "KISS-ICP: In Defense of Point-to-Point ICP - Simple, Accurate, and Robust Registration If Done the Right Way." https://arxiv.org/abs/2209.15397
