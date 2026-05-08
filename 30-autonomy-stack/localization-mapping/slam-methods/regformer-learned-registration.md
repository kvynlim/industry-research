# RegFormer Learned Registration

## Executive Summary

RegFormer is a learned large-scale LiDAR point-cloud registration network. It uses a projection-aware hierarchical transformer to align outdoor LiDAR scans without the classical two-stage pattern of handcrafted descriptors plus RANSAC. Its importance for SLAM is that it pushes learned registration toward outdoor, vehicle-scale scans rather than only object-level or indoor point clouds.

For AV localization, RegFormer is useful as a research front end for pairwise registration, odometry initialization, and learned outlier handling. It is not a production localization stack by itself: it is a learned scan registration method, not a complete SLAM system with loop closure, map versioning, uncertainty calibration, sensor-fault handling, or certified scan-to-map localization. Production-useful deployment would use RegFormer-like learned proposals or masks as aids to [GICP/VGICP](gicp-vgicp.md), [NDT](ndt.md), [KISS-ICP](kiss-icp.md), or a factor-graph map-localization system.

## Repo Cross-Links

| Related area | Link | Why it matters |
|---|---|---|
| Classical point-cloud registration | [ICP](icp.md), [Point-to-Plane ICP](point-to-plane-icp.md), [GICP/VGICP](gicp-vgicp.md), and [NDT](ndt.md) | RegFormer should be compared against explainable geometric optimizers. |
| Simple LiDAR odometry baseline | [KISS-ICP](kiss-icp.md) | A learned registration method must beat simple geometry under target ODD conditions, not only public splits. |
| Learned LiDAR odometry predecessor | [LO-Net](lo-net-learned-lidar-odometry.md) | LO-Net is an earlier range-image learned odometry approach; RegFormer adds transformer-based global association. |
| LiDAR-inertial production survey baselines | [FAST-LIO2](fast-lio-fast-lio2.md), [Point-LIO](point-lio.md), [LIO-SAM](lio-sam.md) | Learned scan registration still needs comparison to tight LIO under motion distortion and weak geometry. |
| Production runtime localization | [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md) | Pairwise learned registration does not replace bounded scan-to-map localization in a validated map. |
| Dense/neural map context | [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Learned registration and Gaussian maps are separate research lines that may later meet in dense map QA. |
| Metrics and datasets | [Benchmarking Metrics and Datasets](benchmarking-metrics-datasets.md) | KITTI and nuScenes need target-specific negatives before airside claims. |

## Historical Context

Point-cloud registration research evolved through several families. Classical methods such as ICP, point-to-plane ICP, GICP, and NDT optimize an explicit geometric objective. Learned local-feature methods such as 3DMatch-style descriptors and FCGF improved correspondence search but often still relied on RANSAC or robust post-processing. Flow-style and scene-flow-inspired LiDAR odometry networks attempted to learn motion directly. LO-Net used projection images and CNNs for LiDAR odometry.

RegFormer, published at ICCV 2023 by Jiuming Liu, Guangming Wang, Zhe Liu, Chaokang Jiang, Marc Pollefeys, and Hesheng Wang, targets the large-scale outdoor registration gap. The paper argues that object-level and indoor registration do not capture the point count, outliers, sparsity, and distribution shifts of vehicle LiDAR. It introduces a projection-aware hierarchical transformer with linear complexity and a bijective association transformer for initial transform regression.

As of 2026, RegFormer sits in the middle ground between classical registration and end-to-end learned localization. It is stronger than early learned odometry as a registration architecture, but it is still not an operational localization system.

## Sensor Assumptions

RegFormer assumes large-scale 3D LiDAR scans, typically outdoor vehicle-mounted scans in KITTI and nuScenes-like settings. Its projection-aware design benefits from the regularity of spinning LiDAR. The model is trained and evaluated on dataset-specific scan patterns, motion statistics, and environment distributions.

Important assumptions:

- 3D LiDAR point clouds with sufficient overlap between source and target scans.
- A projection or neighborhood structure compatible with the network's feature hierarchy.
- Training data from a similar sensor, mounting height, scan density, and motion profile.
- A static-enough scene for rigid registration to be meaningful after outlier filtering.
- GPU compute suitable for PyTorch/CUDA inference.
- No inherent IMU, wheel, GNSS, or HD map dependency in the core pairwise registration problem.

The strongest hidden assumption is that learned correspondences generalize. For production airside localization, that must be proven across aircraft stands, open aprons, terminal roads, hangars, rain, night, heat shimmer, wet pavement, seasonal equipment layouts, and different LiDAR models.

## State/Map Representation

RegFormer estimates a rigid transform between two point clouds:

```text
Input:
  P = {p_i} source scan
  Q = {q_j} target scan

Output:
  T = [R, t] in SE(3)
```

It does not define a persistent SLAM map. If used for odometry, each transform is composed into a trajectory. If used for scan-to-map matching, the target `Q` could be a local map or submap, but that is an integration choice outside the core paper.

Internally, the state is learned:

| Component | Role |
|---|---|
| Projected point features | Efficient spatial organization for large outdoor scans. |
| Hierarchical transformer features | Long-range context and outlier filtering. |
| Bijective association features | Mutual or two-way association cues for reducing mismatches. |
| Regressed transform | Initial or final rigid alignment output. |

For a production factor graph, the missing representation is a calibrated information matrix:

```text
factor residual = Log(T_meas^-1 * T_i^-1 * T_j)
```

RegFormer can provide `T_meas`; it does not by default provide production-grade covariance, degeneracy state, or fault labels.

## Algorithm Pipeline

1. Load a source and target LiDAR scan pair.
2. Downsample or organize points for efficient processing.
3. Project or encode point clouds into a projection-aware hierarchy.
4. Extract point features using hierarchical transformer blocks.
5. Model long-range dependencies while keeping complexity close to linear.
6. Use a bijective association transformer to reduce mismatched correspondences.
7. Regress the relative transform between the source and target point clouds.
8. Train end-to-end using pose/registration losses on KITTI and nuScenes-style data.
9. Use the output transform for pairwise registration, odometry, or as an initialization to geometric refinement.

The practical integration pattern is:

```text
RegFormer proposal -> robust geometric verification -> covariance assignment -> factor graph or scan-to-map update
```

Skipping the verification step is the main production risk.

## Formulation

The geometric registration problem is:

```text
T* = argmin_T sum_i rho(d(T * p_i, Q))
```

Classical methods explicitly define `d`, correspondences, and robust loss `rho`. RegFormer learns much of that process:

```text
T_pred = f_theta(P, Q)
```

A simplified training objective is:

```text
L = lambda_R * L_R(R_pred, R_gt)
    + lambda_t * ||t_pred - t_gt||
    + lambda_align * Chamfer_or_point_alignment(P transformed by T_pred, Q)
    + optional auxiliary hierarchy losses
```

The paper's key algorithmic idea is not a new SE(3) optimizer; it is learned association and feature aggregation at outdoor scan scale. In a SLAM backend, the output would still become a standard between-pose factor:

```text
r_ij = Log(T_pred^-1 * T_i^-1 * T_j)
cost = r_ij^T * Omega_ij * r_ij
```

The hard part is choosing `Omega_ij`. Classical methods can approximate information from residual Hessians and inlier distributions. Learned methods need empirical calibration, ensemble uncertainty, evidential outputs, or a downstream verifier before their factors can be trusted.

## Failure Modes

- Sensor-domain shift from training LiDAR to another channel count, vertical FoV, range noise model, or scan pattern.
- Environment-domain shift from road data to airports, ports, warehouses, construction, tunnels, or snow.
- Low overlap between scans due to fast motion, narrow FoV, occlusion, or wide baseline.
- Dynamic clutter that the network has not learned to ignore.
- Open-space degeneracy where rigid alignment is weak but the network still returns a confident transform.
- Repetitive geometry causing learned association to lock onto the wrong region.
- Lack of calibrated covariance for fusion and gating.
- Poor explainability when a registration fails.
- GPU dependency and software stack fragility compared with small C++ geometric registration libraries.
- Training split leakage or benchmark overfitting if consecutive-frame pairs are not carefully handled.

## AV Relevance

RegFormer is relevant to AVs because registration is a core primitive for odometry, localization, map change detection, multi-session map alignment, and loop-closure verification. Learned registration can help in three places:

- Initializing scan matching when geometry optimizers have a poor initial guess.
- Learning robust association under sparse or partially dynamic scans.
- Providing a second-opinion odometry stream for offline evaluation.

It is weak as a primary AV localization method. Production localization needs bounded pose in a known map, monitorable residuals, graceful degradation, map-version awareness, and fault handling. RegFormer provides a pairwise transform, not the surrounding safety architecture.

The strongest practical architecture is hybrid:

```text
learned registration proposal
  -> geometric registration and residual checks
  -> state estimator with conservative covariance
  -> map-frame localization and recovery logic
```

## Indoor/Outdoor Relevance

RegFormer is primarily outdoor and vehicle-scale. It was designed for large-scale point cloud alignment on KITTI and nuScenes, not for small indoor RGB-D reconstruction. It can be tested indoors if retrained, but indoor environments differ in scan density, range, object distribution, and motion.

Outdoors, it is most relevant to urban driving, campus robots, yards, ports, and airside service roads where LiDAR scans contain enough repeated structure for training and validation. It is least reliable in open fields, open apron zones, long featureless corridors, and highly repetitive parking or stand layouts unless verification rejects ambiguous transforms.

## Airside Deployment Notes

Airside deployment should start with the assumption that RegFormer is not trained for airports. The airport domain has:

- Large aircraft that appear and disappear between sessions.
- Long open tarmac areas with weak local geometry.
- Repeated gate layouts and service-road markings.
- Seasonal and operational equipment changes.
- Strong GNSS multipath near terminals, which can corrupt automatically generated labels.
- Safety requirements that demand a monitorable failure state.

Production-useful uses:

- Offline registration proposals for aligning survey passes before robust ICP/GICP.
- Learned initial guess for scan-to-map localization when GNSS startup is poor.
- Dynamic/outlier association research for GSE-heavy sequences.
- Cross-checking classical scan matching in non-safety-critical validation.

Not recommended:

- Directly feeding RegFormer odometry into the vehicle pose stack as authoritative localization.
- Treating KITTI or nuScenes performance as evidence for apron readiness.
- Using learned transforms without geometric verification and covariance inflation.

## Datasets/Metrics

Core datasets:

- KITTI Odometry: standard vehicle LiDAR odometry and registration benchmark.
- nuScenes: different LiDAR setup, urban dynamics, and multi-sensor context.
- Waymo Open Dataset: useful for domain transfer, although not always used by the paper.
- SemanticKITTI and nuScenes-lidarseg: useful for analyzing dynamic/static and class-conditioned failures.

Metrics:

- Relative translation error and rotation error.
- Registration recall at translation/rotation thresholds.
- Inlier ratio after geometric verification.
- ATE and RPE after composing pairwise estimates.
- Runtime and memory on target GPU.
- Failure rate under low overlap and high dynamic clutter.
- Covariance calibration if used as a factor.
- Downstream map-localization success after learned initialization.

Airside-specific metrics:

- Registration success by zone: open apron, stand, terminal frontage, service road, hangar, tunnel.
- False registration rate between visually similar gates or stands.
- Drift during GNSS-denied terminal-edge runs.
- Inlier geometry diversity after excluding aircraft and GSE.
- Disagreement between learned registration, VGICP/NDT, and wheel/IMU/GNSS priors.

## Open-Source Implementations

- `IRMVLab/RegFormer`: official ICCV 2023 PyTorch/CUDA implementation with KITTI and nuScenes instructions. The repository includes training/testing scripts and custom point operations. Check license and dependency status before product use.
- Follow-up work such as RegFormer++ appeared by 2026, but should be treated as research until independently reproduced and licensed for the intended use.
- Classical comparison stacks: [KISS-ICP](kiss-icp.md), [GICP/VGICP](gicp-vgicp.md), [NDT](ndt.md), and [CT-ICP](ct-icp.md).

The open-source implementation is valuable for experiments, but production integration would likely reimplement only selected concepts after legal, compute, reproducibility, and validation review.

## Practical Recommendation

Use RegFormer to evaluate learned large-scale LiDAR registration, not to replace production scan matching. Its most practical role is as an initialization or correspondence proposal stage followed by robust geometric verification. If it consistently improves convergence on target data, keep it as an aid. If it merely matches classical methods on public benchmarks, prefer the simpler, monitorable geometry stack.

For airside AV work:

1. Build a target dataset with repeated gates, open apron, dynamic GSE, and different weather/lighting.
2. Compare RegFormer against KISS-ICP, VGICP, NDT, and LIO survey outputs.
3. Require geometric verification for every learned transform.
4. Calibrate covariance empirically before inserting factors into a graph.
5. Keep runtime localization anchored to a validated map.

RegFormer is production-useful as a learned registration aid. It remains research-stage as primary localization.

## Sources

- Liu, Jiuming, Guangming Wang, Zhe Liu, Chaokang Jiang, Marc Pollefeys, and Hesheng Wang. "RegFormer: An Efficient Projection-Aware Transformer Network for Large-Scale Point Cloud Registration." ICCV 2023. https://arxiv.org/abs/2303.12384
- Official RegFormer repository. https://github.com/IRMVLab/RegFormer
- Local context: [ICP](icp.md)
- Local context: [GICP/VGICP](gicp-vgicp.md)
- Local context: [Production LiDAR Map Localization](../overview/production-lidar-map-localization.md)
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)
