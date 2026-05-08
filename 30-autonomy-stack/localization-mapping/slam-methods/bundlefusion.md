# BundleFusion

## Executive Summary

BundleFusion is a real-time RGB-D reconstruction system that estimates globally optimized camera poses online and continuously reintegrates the surface so the dense map remains globally consistent. It combines sparse feature correspondences, dense geometric and photometric matching, robust relocalization, global pose optimization, and TSDF surface reintegration in one scanning pipeline.

Its indoor value is very high for high-quality RGB-D scanning. It directly addresses the key weakness of [KinectFusion](kinectfusion.md): once poses drift, in-place TSDF fusion cannot correct the already-fused surface. BundleFusion can update poses and reintegrate frames, so the map can be corrected while scanning continues. Compared with [ElasticFusion](elasticfusion.md), BundleFusion is more explicitly pose-optimization-centric and produces globally consistent volumetric reconstructions.

For AV and airside work, BundleFusion is best viewed as a dense reconstruction and map QA reference, not a live vehicle localization stack. It is computationally heavy, RGB-D and indoor-oriented, old in its released dependencies, and not designed for weather, high-speed vehicle motion, multi-sensor navigation, or safety-certified pose output. Its global optimization and reintegration ideas remain important for any system that must revise dense maps after loop closure.

## Historical Context

BundleFusion was published in ACM Transactions on Graphics in 2017 by Angela Dai, Matthias Niessner, Michael Zollhoefer, Shahram Izadi, and Christian Theobalt. It came after KinectFusion, Kintinuous, ElasticFusion, and many RGB-D pose-graph systems. The central problem was scalability: dense online reconstruction looked good locally but accumulated drift, and correcting the dense model often required slow offline processing.

The method moved RGB-D scanning closer to offline structure-from-motion quality while keeping an online workflow. It did this by optimizing poses using the complete history of input frames through an efficient hierarchical strategy, while also supporting relocalization after gross tracking failures. The surface is not a one-way accumulation; it is re-estimated when the pose graph changes.

BundleFusion also helped define the standard for RGB-D reconstruction datasets and evaluation. Its project page provides RGB-D scanning data for seven large indoor scenes with color, depth, calibration, and poses. That makes it a useful practical benchmark for dense indoor reconstruction beyond small tabletop sequences.

## Sensor Assumptions

BundleFusion assumes a calibrated RGB-D camera with synchronized color and depth. The released project notes development with Structure Sensor data and an iPad color camera, plus optional Kinect/PrimeSense support. Accurate depth-to-color calibration matters because the optimization uses both geometric and photometric terms.

Operational assumptions:

- Dense depth is available at indoor range.
- Camera intrinsics and depth/color extrinsics are known.
- The scene is mostly static during scanning.
- The operator or robot motion creates enough overlap and visual/geometric constraints.
- GPU compute is available for dense alignment, fusion, and TSDF operations.
- The platform can tolerate the latency and complexity of global pose optimization and reintegration.

BundleFusion is more robust than simple frame-to-frame methods when tracking fails, but it is not sensor agnostic. Outdoor sunlight, long range, weather, reflective surfaces, dynamic vehicles, and high-speed platform motion remain outside its natural envelope.

## State/Map Representation

BundleFusion keeps a history of RGB-D frames and optimized camera poses. The pose state is a set of camera-to-world transformations:

```text
trajectory = {T_0, T_1, ..., T_N}
```

Constraints between frames come from sparse visual feature matches and dense geometric/photometric correspondences. The optimization maintains global consistency across the history rather than only a sliding local window.

The dense map is a volumetric surface representation, typically TSDF-like, generated from the current optimized poses. The key feature is surface reintegration. If a frame pose changes after global optimization, the system can remove or revise its old contribution and integrate it again at the corrected pose. This is the dense-map equivalent of updating a factor graph after loop closure.

This representation is powerful but expensive. It requires retaining enough input history or integration bookkeeping to update the model. That is very different from classic KinectFusion's simple in-place weighted averaging.

## Algorithm Pipeline

1. Acquire a calibrated RGB-D frame.
2. Estimate an initial pose using temporal tracking or relocalization against previous globally optimized frames.
3. Extract and match sparse visual features between selected frames.
4. Establish dense geometric and photometric correspondences.
5. Build frame-to-frame and frame-to-model constraints.
6. Run hierarchical global pose optimization over the active history.
7. Detect and recover from gross tracking failure through relocalization.
8. Identify frames whose poses changed enough to affect the fused model.
9. Deintegrate or revise old surface contributions where necessary.
10. Reintegrate frames into the TSDF at optimized poses.
11. Render or extract the updated globally consistent dense reconstruction.

The pipeline is designed around "globally optimized poses in real time." The dense model is subordinate to the optimized trajectory, which makes the system attractive for high-quality scanning but complex for embedded robotics.

## Formulation

BundleFusion optimizes camera poses using a mixture of sparse and dense residuals:

```text
min_{T_0...T_N}
  sum sparse_feature_residuals(T_i, T_j)
  + lambda_g * sum dense_geometric_residuals(T_i, T_j)
  + lambda_p * sum dense_photometric_residuals(T_i, T_j)
```

A simplified dense geometric term is:

```text
r_geo = n_j^T * (T_j^-1 * T_i * p_i - q_j)
```

where `p_i` is a live or source depth point, `q_j` and `n_j` come from a corresponding target frame or model view, and `T_i`, `T_j` are optimized frame poses. Photometric terms compare colors after projection. Sparse feature constraints improve robustness over large viewpoint changes, while dense residuals provide local surface accuracy.

Surface reintegration can be viewed as maintaining:

```text
map = integrate({depth_i, T_i} for all selected frames)
```

When `T_i` changes, the map should reflect the new pose set rather than the old fused history. This is why BundleFusion is more globally correct than one-way TSDF fusion, but also why it is more demanding.

## Failure Modes

- Repeated indoor structure can create incorrect feature correspondences or false relocalization.
- Dynamic objects can produce inconsistent sparse and dense constraints and leave ghost geometry.
- Reflective, transparent, black, or sunlight-exposed surfaces corrupt depth and photometric matching.
- Global optimization and surface reintegration are compute-heavy and can produce latency spikes.
- Old released dependencies such as VS2013, CUDA 7, and DirectX-era assumptions make reproduction and integration difficult.
- The non-commercial research license limits direct product use without review.
- Large global corrections can be unsafe if a downstream controller assumes smooth real-time pose.
- The method is RGB-D and indoor-oriented; it does not handle long-range outdoor vehicle sensing by itself.
- Memory grows with history unless the system aggressively manages active frames and reintegration data.
- There is no production-grade multi-sensor estimator with IMU, GNSS, wheel odometry, and explicit fault state.

## AV Relevance

BundleFusion's main AV relevance is dense map construction after pose correction. Autonomous systems often need to update maps when loop closure, GNSS correction, or offline bundle adjustment changes the trajectory. BundleFusion shows how a dense volumetric model can be kept consistent with optimized poses instead of remaining a distorted accumulation.

As a live AV localization stack, BundleFusion is not a good fit. It assumes indoor RGB-D sensing, has heavy GPU and legacy software requirements, and prioritizes reconstruction quality over deterministic safety behavior. AV localization also needs continuous uncertainty, high-speed motion support, map-frame anchoring, sensor redundancy, and dynamic-object exclusion.

Transferable ideas:

- Combining sparse features with dense geometric/photometric constraints.
- Relocalization after gross tracking failure.
- Global pose optimization during live reconstruction.
- Deintegrating/reintegrating dense map observations after pose correction.
- Treating dense reconstruction quality as a first-class metric, not only trajectory error.

## Indoor/Outdoor Relevance

Indoor relevance is high. BundleFusion was built for large indoor RGB-D scanning: apartments, offices, copy rooms, and similar environments. It handles operator motion and revisits better than pure frame-to-model fusion because it can globally revise poses and recover after tracking loss.

Outdoor relevance is low for direct deployment. RGB-D cameras have limited range and sunlight sensitivity; open outdoor spaces provide less dense near-field structure; and vehicle motion creates larger baselines and more severe dynamics. For outdoor AVs, the useful idea is not the sensor stack but the reintegration principle: if a dense lidar, voxel, mesh, neural, or Gaussian map is built from poses that later change, the map needs a correction strategy.

For airport environments, BundleFusion is most relevant inside hangars, workshops, terminals, and baggage areas, not on open aprons or runways.

## Airside Deployment Notes

Potential uses:

- Offline or semi-online dense reconstruction of hangars and indoor airport service areas.
- High-quality scans for simulation, training, and operator visualization.
- Map QA after a separate localization system has produced optimized poses.
- Benchmarking neural and Gaussian dense SLAM against a strong classical RGB-D reconstruction baseline.

Operational cautions:

- Do not use BundleFusion pose output directly for safety-critical vehicle control.
- Treat global correction as an offline or supervisory map update unless a downstream estimator can safely absorb corrections.
- Exclude dynamic aircraft, vehicles, ground crew, luggage, carts, doors, and movable maintenance equipment before map update.
- Verify license and dependency status before any commercial work.
- Expect significant porting work for modern Windows/Linux, CUDA, ROS 2, and embedded GPUs.

For outdoor airside mapping, prefer lidar-inertial mapping and HD-map workflows. Dense RGB-D reconstruction can supplement indoor digital twins, but it should not replace lidar/GNSS/IMU localization in the vehicle stack.

## Datasets/Metrics

BundleFusion provides RGB-D scanning data for seven large scenes, with average trajectory length around 60 m and average frame count around 5833 on the project page. It also evaluates against common RGB-D reconstruction baselines and datasets.

Useful datasets:

- BundleFusion large indoor RGB-D scanning data.
- TUM RGB-D for trajectory accuracy and RGB-D tracking.
- ICL-NUIM for synthetic depth/trajectory/mesh ground truth.
- SUN3D and Redwood-style indoor reconstruction sequences for larger-scale RGB-D behavior.
- Replica and ScanNet for modern reconstruction comparisons, with protocol care.

Useful metrics:

- ATE/APE and RPE after appropriate alignment.
- Reconstruction accuracy, completeness, Chamfer distance, F-score, normal consistency, and visual mesh quality.
- Scan completeness and number of unrecovered tracking failures.
- Relocalization success rate and latency.
- Magnitude and frequency of global pose corrections.
- Reintegration cost per correction and total runtime.
- GPU memory, frame history size, and map update latency.

For airside indoor datasets, include long hangar traversals, repeated bays, movable equipment, metallic aircraft surfaces, wet floors, and large feature-poor walls.

## Open-Source Implementations

- `niessner/BundleFusion`: original SIGGRAPH 2017 code release. The repository states non-commercial use with attribution and notes development under Visual Studio 2013, DirectX SDK June 2010, CUDA 7.0, and Structure Sensor testing.
- BundleFusion project page: paper, dataset, slides, reconstructed data, and source links.
- Some later reconstruction systems borrow ideas from BundleFusion, but the original release remains the reference implementation.

The code is important for research reproduction, but it is not a drop-in ROS/ROS 2 localization package. Treat build modernization, license review, sensor support, and headless deployment as major tasks.

## Practical Recommendation

Use BundleFusion as the classical high-quality RGB-D reconstruction reference when evaluating dense indoor mapping. It is especially useful when the question is: "What would the dense map look like if global pose correction and reintegration were handled well?"

Do not select it as the operational airside localization stack. For real robots, use [RTAB-Map](rtab-map.md) for practical RGB-D/stereo/lidar graph SLAM experiments, or use modern lidar-inertial localization outdoors. For dense neural and Gaussian research, use BundleFusion as a quality baseline and compare against [NICE-SLAM](nice-slam.md), [Co-SLAM and ESLAM](co-slam-eslam.md), [NeRF-SLAM](nerf-slam.md), and [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/overview/gaussian-splatting-driving.md).

## Sources

- Dai et al., "BundleFusion: Real-time Globally Consistent 3D Reconstruction using On-the-fly Surface Re-integration," arXiv. https://arxiv.org/abs/1604.01093
- BundleFusion project page and dataset. https://graphics.stanford.edu/projects/bundlefusion/
- BundleFusion repository. https://github.com/niessner/BundleFusion
- Local context: [KinectFusion](kinectfusion.md)
- Local context: [ElasticFusion](elasticfusion.md)
- Local context: [Bundle Adjustment SLAM](bundle-adjustment-slam.md)
- Local context: [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/overview/gaussian-splatting-driving.md)
