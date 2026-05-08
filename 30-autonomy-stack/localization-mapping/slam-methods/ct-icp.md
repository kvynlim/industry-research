# CT-ICP: Continuous-Time ICP

Related localization docs: [SLAM algorithms](../overview/lidar-slam-algorithms.md), [production LiDAR map localization](../overview/production-lidar-map-localization.md), and [map construction pipeline](../maps/map-construction-pipeline.md).

## Executive Summary

CT-ICP is a LiDAR-only continuous-time odometry and SLAM method from Dellenbach, Deschaud, Jacquet, and Goulette, published at ICRA 2022. Its core idea is to estimate an elastic trajectory within each LiDAR scan instead of treating the scan as a rigid snapshot or deskewing it once before registration.

For each scan, CT-ICP optimizes two poses: one at the beginning of the scan and one at the end. Points are transformed using interpolation between these poses according to their timestamps. This lets the scan deform during ICP registration, improving accuracy on raw spinning-LiDAR data and during high-frequency motion. The method also includes a loop closure module based on elevation-image matching and a pose graph back end.

For airside autonomous vehicles, CT-ICP is most relevant when raw spinning LiDAR data has meaningful motion distortion: faster survey vehicles, rough pavement, high angular-rate turns, handheld mapping, or sensors with long scan periods. For low-speed GSE operation, its advantage over simpler deskewed ICP may be smaller. It is a strong research and survey-mapping candidate, but its complexity, runtime, and assumptions should be weighed against KISS-ICP and LiDAR-inertial systems.

## Historical Context

Most LiDAR odometry systems handle scan motion distortion in one of two ways: ignore it, or deskew the scan using a motion model before registration. LOAM estimates motion during the sweep; LeGO-LOAM uses ground-vehicle structure; KISS-ICP deskews with a constant-velocity model; LiDAR-inertial systems use IMU preintegration.

CT-ICP takes a different route. It embeds motion distortion directly in the registration objective. Instead of fixing a deskewed scan before ICP, it optimizes the trajectory used to deskew the points. The paper describes this as continuity within a scan and discontinuity between scans: points inside one scan follow an interpolated trajectory, while the beginning of the next scan is not forced to exactly equal the previous scan end, only constrained to remain close.

This design targets raw multi-beam LiDAR data where motion distortion is not already corrected. The paper evaluates on KITTI, KITTI-raw, KITTI-360, KITTI-CARLA, ParisLuco, Newer College, and NCLT, including driving and high-frequency motion scenarios.

## Sensor Assumptions

CT-ICP assumes a 3D LiDAR scan with point timing.

Primary assumptions:

- Multi-beam 3D LiDAR, commonly rotating LiDAR.
- Per-point relative timestamps, or a reliable way to infer them from scan geometry.
- Enough scan-to-map overlap for ICP.
- Local geometric structure suitable for point-to-plane residuals.
- Motion during a scan can be represented by interpolation between beginning and end poses.
- For loop closure, motion is mostly planar or gravity alignment is known so elevation images are meaningful.

The method does not require IMU, wheel odometry, GNSS, or camera input. However, if timestamps are missing or wrong, its continuous-time advantage disappears and can become a source of error.

## Map Representation

CT-ICP uses a dense local point cloud stored in a sparse voxel structure.

Map characteristics:

- Previous registered scans form a local map.
- Points are stored in sparse voxels for fast neighborhood lookup.
- Each voxel stores a bounded number of points.
- Neighbor searches use nearby voxels rather than a global KD-tree.
- Normals and planarity weights are computed from neighborhoods in the local map.
- Voxels are removed based on distance from the current scan center to keep the map bounded.

The SLAM extension adds:

- Local aggregated point-cloud windows.
- 2D elevation images for loop detection.
- Loop closure constraints.
- A pose graph optimized with a graph optimizer such as g2o.

The odometry map is local; the loop closure pose graph provides global correction when revisits are detected.

## Algorithm Pipeline

1. **Input scan preparation**
   - Load raw LiDAR scan with point coordinates and relative timestamps.
   - Sample points for registration using grid sampling.

2. **Initial pose prediction**
   - Initialize beginning and end poses for the current scan from previous motion.

3. **Continuous-time scan-to-map registration**
   - Interpolate each point's pose between scan beginning and scan end.
   - Transform points into the world frame.
   - Find local map neighborhoods.
   - Compute point-to-plane residuals, normals, and planarity weights.
   - Optimize beginning and end poses jointly.

4. **Motion regularization**
   - Add a proximity constraint between the previous scan end and current scan beginning.
   - Add a constant-velocity or acceleration-limiting constraint.

5. **Robust profile**
   - Detect difficult cases such as fast orientation changes or registration inconsistencies.
   - Retry with more conservative parameters when needed.
   - Avoid inserting likely misregistered scans into the map.

6. **Local map update**
   - Transform the scan using optimized continuous-time poses.
   - Insert accepted points into sparse voxels.
   - Remove distant voxels to bound memory.

7. **Loop closure**
   - Aggregate scan windows into local maps.
   - Project local maps into 2D elevation images.
   - Extract rotation-invariant 2D features.
   - Match candidates with RANSAC and refine with ICP.
   - Add loop constraints to the pose graph.

8. **Back-end optimization**
   - Optimize the pose graph when loop closures are added.
   - Correct the trajectory and map.

## Formulation

For each scan, CT-ICP optimizes two poses:

- `T_b`: pose at the beginning of the scan.
- `T_e`: pose at the end of the scan.

For a point `p_i` with relative timestamp `alpha_i` in `[0, 1]`, the pose is interpolated between `T_b` and `T_e`:

```text
T(alpha_i) = interpolate(T_b, T_e, alpha_i)
```

The point-to-plane residual against the local map is:

```text
r_i(T_b, T_e) = n_i^T * (T(alpha_i) * p_i - q_i)
```

where `q_i` and `n_i` come from the local map neighborhood.

The optimization is:

```text
T_b*, T_e* = arg min
    sum_i w_i * rho(r_i(T_b, T_e)^2)
  + lambda_c * || continuity(T_b, T_prev_e) ||^2
  + lambda_v * || velocity_consistency(T_b, T_e, history) ||^2
```

`w_i` favors planar neighborhoods, `rho` is a robust loss, the continuity term limits discontinuity between adjacent scans, and the velocity term discourages physically implausible acceleration. The important distinction is that point deskewing is not fixed before registration; it is refined as part of ICP.

## Failure Modes

- **Missing point timestamps:** Without reliable per-point timing, continuous-time registration is compromised.
- **Weak geometry:** Large flat aprons, open roads, and sparse scenes provide limited point-to-plane constraints.
- **Dynamic-object dominance:** Moving vehicles, people, aircraft, or GSE can corrupt registration and map insertion.
- **Loop closure assumptions:** The elevation-image loop detector assumes mostly planar motion or known gravity alignment.
- **Map pollution:** Incorrect scan insertion can harm subsequent registrations.
- **Runtime cost:** Robust profiles and high-frequency motion settings can be significantly slower than simple ICP.
- **Parameter profiles:** Driving and high-frequency motion profiles may need different settings.
- **Repeated structures:** Similar stands, building edges, or service corridors can create false loop candidates.
- **No IMU prior:** Although LiDAR-only is a strength, abrupt motion in poorly constrained geometry can still be unobservable.

## AV Relevance

CT-ICP is relevant to AVs because rolling-shutter distortion is real for spinning LiDAR. A vehicle moving during a 100 ms scan does not observe the world from one pose. Standard deskewing can be good enough at low speed, but faster motion, rough surfaces, turns, and high angular rates can make fixed deskewing inaccurate.

Strengths:

- Handles raw motion-distorted LiDAR data directly.
- LiDAR-only, no IMU dependency.
- Strong published benchmark performance.
- Includes loop closure and pose graph components.
- Good fit for survey mapping and high-dynamic data collection.

Limitations:

- More complex than KISS-ICP.
- Requires point timing discipline.
- Point-to-plane registration needs reliable local surface structure.
- Runtime can be higher, especially in robust modes.
- Loop closure is not a full semantic place-recognition system.
- Production deployment still needs monitoring, covariance, dynamic filtering, and sensor fusion.

For AVs, CT-ICP is an excellent candidate for offline mapping experiments and for evaluating whether continuous-time modeling materially improves a platform's LiDAR odometry.

## Indoor/Outdoor Relevance

**Indoor:** CT-ICP can handle handheld or cart-mounted mapping where motion can be irregular. Walls, floors, and columns provide good point-to-plane constraints. Long corridors remain degenerate, and loop closure must be validated in repetitive interiors.

**Outdoor:** The method is strong in structured driving environments and was evaluated on multiple outdoor driving datasets. It is especially relevant for raw spinning LiDAR logs where scans were not motion-corrected by GPS/INS.

**High-frequency motion:** CT-ICP is particularly useful for handheld mapping, segway-like platforms, rough terrain, and any setup where the LiDAR orientation changes quickly within a scan.

## Airside Deployment Notes

Airside GSE usually moves slowly, which reduces the need for continuous-time ICP. However, CT-ICP can still matter in several cases:

- Survey vehicles driving faster than operational GSE.
- Rough apron surfaces causing LiDAR vibration.
- Tight turns around stands.
- Multi-LiDAR rigs where individual sensors have different scan timing.
- Raw logs without IMU-based deskewing.
- Handheld or cart-based terminal/hangar mapping.

Deployment guidance:

- Use CT-ICP as a high-accuracy survey mapping candidate, especially when raw scan distortion is visible in maps.
- Compare against KISS-ICP and LiDAR-inertial methods on the same airside logs.
- Require per-point timestamp validation before trusting results.
- Add dynamic-object filtering before map insertion.
- Treat elevation-image loop closure carefully around repeated stand geometry.
- Use ground control, RTK/INS, or map alignment for final HD map acceptance.

For low-speed operational localization, production scan-to-map methods may provide better value than CT-ICP's continuous-time odometry. For map construction, CT-ICP can be a strong offline trajectory source when motion distortion would otherwise blur the survey map.

## Datasets/Metrics

The CT-ICP paper evaluated:

- KITTI corrected odometry.
- KITTI raw scans.
- KITTI-360.
- KITTI-CARLA.
- ParisLuco.
- Newer College Dataset.
- NCLT.

The paper reported an average KITTI Relative Translation Error of 0.59 percent among public-code methods at the time, with about 60 ms per scan on a single CPU thread for the benchmark configuration. It also showed stronger results on raw, uncorrected scans than methods that rely on fixed deskewing.

Recommended metrics:

- Relative translation error and relative rotation error.
- Absolute trajectory error against RTK/INS or surveyed control.
- Runtime per scan, including robust-profile retries.
- Map thickness before and after continuous-time correction.
- Deskew residuals on walls, poles, and ground planes.
- Loop closure precision/recall.
- Failure rate on rapid turns and rough-surface segments.
- Timestamp integrity checks.

Airside-specific metrics should include map blur at terminal walls, stand-pole repeatability, apron drift per kilometer, stand approach repeatability, and loop closure correctness in repeated gate layouts.

## Open-Source Implementations

- **jedeschaud/ct_icp:** Primary CT-ICP implementation, MIT license. It can run with ROS, as an independent library, or through provided scripts.
- **pyLiDAR-SLAM integration:** CT-ICP is integrated with pyLiDAR-SLAM, giving access to additional datasets and evaluation tooling.
- **ICRA-2022 release branch:** The repository notes that reproducing paper results may require the `ICRA-2022` release because later branches changed the code.

The implementation is more involved to build than KISS-ICP because of CMake, superbuild dependencies, optional visualization, and ROS wrapping.

## Practical Recommendation

Use CT-ICP when scan distortion is a first-order problem or when the evaluation specifically targets high-accuracy LiDAR-only odometry from raw spinning-LiDAR data.

For airside Part A:

- Include CT-ICP as the continuous-time ICP representative.
- Benchmark it against KISS-ICP on the same survey logs.
- Use it for offline map construction experiments where wall/curb/pole blur is visible.
- Do not default to it for low-speed production localization unless testing shows a clear benefit.
- Pair any CT-ICP trajectory with loop closure, RTK/GCP alignment, and map QA before HD map release.

The practical verdict is "excellent continuous-time research baseline and survey mapper; higher complexity than necessary for many low-speed airside runtime cases."

## Sources

- Pierre Dellenbach, Jean-Emmanuel Deschaud, Bastien Jacquet, and Francois Goulette, "CT-ICP: Real-time Elastic LiDAR Odometry with Loop Closure," ICRA 2022. https://arxiv.org/abs/2109.12979
- CT-ICP paper PDF via arXiv. https://arxiv.org/pdf/2109.12979
- jedeschaud/ct_icp repository. https://github.com/jedeschaud/ct_icp
- pyLiDAR-SLAM repository. https://github.com/Kitware/pyLiDAR-SLAM
- Newer College Dataset. https://ori.ox.ac.uk/datasets/newer-college-dataset/
- KITTI odometry benchmark. https://www.cvlibs.net/datasets/kitti/eval_odometry.php
