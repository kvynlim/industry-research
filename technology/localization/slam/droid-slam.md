# DROID-SLAM

## Executive Summary

DROID-SLAM is a deep visual SLAM system from Princeton that estimates camera poses and dense depth through learned recurrent updates and a differentiable Dense Bundle Adjustment layer. It supports monocular, stereo, and RGB-D video at test time, despite being trained on monocular synthetic data. It was one of the key systems that made learned SLAM credible against strong classical baselines such as [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), [LSD-SLAM / DSO](lsd-slam-dso.md), and [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md).

The method's central idea is optimization-inspired learning. Instead of predicting pose once, DROID-SLAM repeatedly updates dense correspondences, per-frame poses, and per-pixel depths using a neural update operator and a geometric bundle-adjustment layer. This gives it strong robustness on public benchmarks, including lower catastrophic failure rates than many classical visual SLAM systems.

For autonomous vehicles, DROID-SLAM is best viewed as a research-grade dense visual odometry/SLAM benchmark, not a near-term production localization module. Its dense map and learned correspondences are valuable, but it is GPU-intensive, camera-only unless paired externally with IMU/GNSS/LiDAR, and less interpretable than classical factor-graph VIO such as [Kimera-VIO](kimera-vio.md) or [OpenVINS](openvins.md). For airside autonomy, it is useful for offline benchmarking and learned-vision research under the broader [Mapping and Localization](../mapping-and-localization.md) architecture, but it should not be the primary real-time pose source.

## Historical Context

Before DROID-SLAM, learned visual odometry and learned SLAM often improved robustness but struggled to match the accuracy and generality of mature classical systems. Classical SLAM relied on feature matching, photometric alignment, bundle adjustment, loop closure, and careful engineering. Deep systems often predicted depth, pose, or flow in a feed-forward way and could fail to preserve the geometric consistency that makes SLAM work.

DROID-SLAM arrived in the wake of RAFT-style recurrent optical-flow networks. It reused the insight that iterative neural updates over a correlation volume are powerful, but moved the update target from optical flow to camera poses and depth. Its NeurIPS 2021 paper presented a system that combined learned features and learned update dynamics with a dense geometric optimization layer. This made it a bridge between deep learning and classical SLAM, not a pure black-box pose regressor.

DROID-SLAM also influenced later systems. [DPVO](dpvo.md) can be read as a sparse patch-based, faster descendant of the DROID design. DPV-SLAM adds loop closure to the DPVO family. [MASt3R-SLAM](mast3r-slam.md) takes a different learned route, using two-view 3D reconstruction priors rather than dense flow and dense bundle adjustment.

## Sensor Assumptions

DROID-SLAM can run with:

- Monocular video.
- Stereo video.
- RGB-D video.

Key assumptions:

- Images are time ordered and have enough overlap for visual correspondence.
- The camera calibration is known or provided in the expected format for metric operation.
- Stereo and RGB-D inputs provide extra scale/depth constraints at test time.
- The scene is mostly static.
- Motion blur, rolling shutter, exposure shock, and dynamic objects should not dominate the sequence.
- A CUDA-capable GPU is assumed for practical runtime.

DROID-SLAM does not natively fuse IMU, wheel odometry, GNSS, LiDAR, or vehicle motion constraints in the classical VIO/LIO sense. Those sensors must be fused outside the system, for example in the estimator described in [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md).

For airside vehicles, stereo is preferable to monocular because metric scale and robustness matter. RGB-D is less practical outdoors due to depth-sensor range and sunlight limitations. Monocular DROID-SLAM is valuable as a benchmark but not as a safety-critical vehicle odometry source.

## State/Map Representation

DROID-SLAM maintains a learned dense SLAM representation:

- A sequence of camera poses.
- Dense or semi-dense per-frame depth maps, depending on active frames and implementation settings.
- Dense feature maps extracted by the neural network.
- Correlation information between image pairs.
- A dynamic frame graph connecting frames for local optimization and loop-like refinement.
- Dense 3D reconstruction derived from optimized depths and poses.

The map is not a classical sparse landmark map like [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md). It is also not a TSDF, occupancy grid, HD map, semantic map, or factor graph with explicit sensor factors. It is a learned dense geometric representation optimized through the DROID update loop.

The representation has two important consequences:

- It can exploit much richer image information than sparse feature systems.
- It stores neural feature maps and dense optimization variables, which increases GPU memory and integration complexity.

For AV use, the output trajectory and dense reconstruction must be treated as perception products. They do not encode lane rules, airport stand boundaries, traffic procedures, or drivable-area semantics.

## Algorithm Pipeline

DROID-SLAM pipeline:

1. Image preprocessing:
   - Load monocular, stereo, or RGB-D frames.
   - Apply camera calibration and resizing expected by the model.
   - Extract learned feature maps.

2. Frame graph construction:
   - Maintain active frames and edges between frames.
   - Add edges based on temporal adjacency and proximity/loop-like relationships.
   - Use this graph to decide which image pairs participate in recurrent updates.

3. Correlation and matching:
   - Build correlation volumes between feature maps.
   - Predict correspondence updates through a recurrent neural operator.
   - Estimate confidence and residual information used by the optimizer.

4. Dense Bundle Adjustment:
   - Use the Dense Bundle Adjustment layer to update camera poses and pixelwise depth.
   - Apply Gauss-Newton-like geometric updates inside a differentiable layer.
   - Repeat recurrent updates to improve consistency.

5. Backend/global refinement:
   - Revisit older frame connections.
   - Perform additional dense BA over the graph.
   - Improve long trajectory consistency and handle loop closure behavior.

6. Output:
   - Camera trajectory.
   - Dense depth or point cloud reconstruction.
   - Optional visualization and trajectory export for evaluation.

The system is not a traditional front-end/back-end split where handcrafted matches feed a generic optimizer. The network and dense optimizer are coupled: learned features and update operators generate the information that the dense geometric layer uses.

## Formulation

DROID-SLAM estimates poses and depths by repeatedly solving learned geometric update problems. A simplified view is:

```text
Given frames I_i and I_j:
  extract learned features f_i, f_j
  build correlation C_ij
  recurrent update predicts flow/residual/confidence terms
  Dense BA updates poses T_i and depths D_i
```

The dense reprojection relation is:

```text
p_j_hat = project(T_j^-1 * T_i * backproject(p_i, D_i[p_i]))
```

The learned network predicts update information that encourages `p_j_hat` to agree with visual correspondence. Dense Bundle Adjustment then applies a geometric optimization over poses and pixelwise depths:

```text
min over T, D:
  sum_edges sum_pixels w_ij(p) *
    || target_ij(p) - project(T_j^-1 * T_i * backproject(p, D_i[p])) ||^2
```

This is only a conceptual expression. DROID-SLAM's actual implementation uses neural update states, learned confidence, correlation features, and a differentiable DBA layer. The method is "optimization-inspired" rather than merely "deep pose regression" because pose and depth are iteratively refined through geometric constraints.

Sensor modality changes the constraints:

- Monocular: scale is learned/estimated from motion priors and dataset statistics, but absolute scale remains a concern unless evaluated with alignment or external scale.
- Stereo: right-image constraints add metric depth information.
- RGB-D: measured depth constrains dense geometry directly.

## Failure Modes

DROID-SLAM failure modes:

- GPU memory exhaustion on long or high-resolution sequences.
- Runtime fluctuation and latency when the backend becomes expensive.
- Scale drift or scale ambiguity in monocular operation.
- Domain shift from training data to airport-specific imagery.
- Motion blur, rolling shutter, defocus, and exposure shock.
- Low-texture areas such as open tarmac, blank walls, sky, and smooth aircraft bodies.
- Specular reflections from wet pavement, glass, painted markings, and aircraft fuselage.
- Dynamic-scene dominance from aircraft, GSE, buses, workers, and baggage streams.
- Repeated visual structure causing incorrect graph connections or loop-like constraints.
- Calibration mismatch or image preprocessing mismatch.
- Lack of native IMU/wheel/GNSS constraints for vehicle dynamics.

The learned component can be more robust than handcrafted features, but it can also fail opaquely. A classical VIO stack often exposes feature counts, reprojection residuals, IMU residuals, and bias states. DROID-SLAM exposes useful internal signals, but interpreting them for a safety case is harder.

## AV Relevance

DROID-SLAM is relevant to AVs in four ways:

- It is a strong learned visual SLAM benchmark for monocular, stereo, and RGB-D data.
- It produces dense geometry, not just sparse landmarks.
- It demonstrates how learned correspondences and differentiable optimization can outperform handcrafted pipelines on difficult public datasets.
- It provides a research reference for future learned localizers that may be fused with vehicle sensors.

Its current production relevance is limited:

- It needs GPU resources that compete with perception networks.
- It does not natively model IMU, wheel odometry, GNSS, LiDAR, or vehicle kinematics.
- Dense visual maps are not operational HD maps.
- Model generalization and failure detection must be validated for each ODD.
- Memory usage makes very long routes challenging without careful graph/window management.

For an AV stack, DROID-SLAM is better used as an offline or shadow-mode comparator to classical visual-inertial and LiDAR-inertial odometry than as the main estimator. It can help answer whether learned dense vision adds value in GNSS-degraded or LiDAR-degraded segments.

## Indoor/Outdoor Relevance

Indoor:

- Strong on RGB-D and visually rich indoor sequences.
- Useful where dense geometry is valuable for reconstruction.
- Can outperform classical systems on difficult texture/motion cases.
- Still vulnerable to repeated corridors, glass, reflective floors, motion blur, and dynamic people/equipment.

Outdoor:

- Stereo operation is the most relevant outdoor mode.
- Monocular operation is useful for research but less defensible for metric vehicle localization.
- Open-air apron scenes are harder than urban streets because of lower texture, long feature distances, sky, uniform pavement, and reflective aircraft surfaces.
- Outdoor lighting and weather create domain-shift risks.

Indoor/outdoor transitions are possible from a visual tracking perspective, but DROID-SLAM should be supervised by a multi-sensor estimator that can downweight or reject it during exposure shocks, texture loss, or GNSS/map disagreement.

## Airside Deployment Notes

Airside use should be conservative:

- Treat DROID-SLAM as a research/benchmark module, not a primary navigation source.
- Prefer stereo input for metric scale.
- Use high-quality global-shutter cameras with synchronized timestamps.
- Log raw images and calibration so failures can be replayed.
- Run in shadow mode against RTK-GNSS, LiDAR scan-to-map, wheel odometry, and a classical VIO baseline such as [Kimera-VIO](kimera-vio.md) or [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md).
- Monitor frame rate, GPU memory, graph size, tracking resets, trajectory discontinuities, and disagreement against other sensors.
- Test repeated gate/stand geometry explicitly to detect false loop-like corrections.
- Include rain, night, glare, wet pavement, terminal shadow, aircraft parked/absent, baggage traffic, and long straight apron traversals.
- Do not use dense DROID reconstruction directly as obstacle truth without independent perception and temporal filtering.

The main airside research question is not "Can DROID-SLAM run on a public benchmark?" It is whether learned dense visual constraints provide additional availability or lower drift than classical VIO when GNSS and LiDAR localization are degraded.

## Datasets/Metrics

Common datasets used around DROID-SLAM:

- TartanAir: synthetic training/evaluation and SLAM challenge context.
- EuRoC MAV: stereo-inertial dataset often evaluated in monocular or stereo visual SLAM mode.
- TUM RGB-D: indoor RGB-D SLAM benchmark.
- ETH3D: RGB-D / reconstruction-oriented benchmark used to stress robustness.
- KITTI Odometry: outdoor driving stereo benchmark.
- Custom vehicle and airport datasets are required for airside evaluation.

Metrics:

- ATE/APE after appropriate SE(3) or Sim(3) alignment.
- RPE over distance and time.
- KITTI translational and rotational drift.
- Catastrophic failure rate.
- Sequence completion rate.
- Loop/global-refinement correction magnitude.
- Dense depth/reconstruction accuracy where ground truth depth or point clouds exist.
- Runtime, frame latency, GPU memory, and minimum frame rate.
- Scale error in monocular mode.

Airside-specific metrics should include drift during GNSS outages, visual-only survival time on open apron routes, disagreement against LiDAR scan-to-map, false corrections in repeated stands, and performance under night/rain/glare domain shift.

## Open-Source Implementations

- Official DROID-SLAM repository: PrincetonVL C++/Python/CUDA implementation under a permissive BSD-3-Clause license.
- The repository includes evaluation scripts and examples for common datasets.
- Community forks and Docker files exist, but the official repository should remain the reference for method-level comparison.

Implementation cautions:

- CUDA, PyTorch, and custom extension compatibility can require environment pinning.
- Full backend operation can require high-memory GPUs on long sequences.
- Reproducibility depends on exact preprocessing, model weights, and dataset formatting.
- The system is not a ROS-native production localization component.
- Integration with vehicle state estimation must define coordinate frames, timestamp behavior, covariance/quality output, and failure gating explicitly.

## Practical Recommendation

For the method library, DROID-SLAM should be documented as the canonical learned dense visual SLAM baseline. It is the right comparison point for [DPVO](dpvo.md) and [MASt3R-SLAM](mast3r-slam.md), and the learned counterpart to classical visual systems such as [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), [LSD-SLAM / DSO](lsd-slam-dso.md), and [Kimera-VIO](kimera-vio.md).

For airside AV work, use DROID-SLAM in offline evaluation and shadow-mode experiments only. It may reveal useful dense visual constraints, but the production pose stack should remain LiDAR/GNSS/IMU/wheel centered with camera SLAM as an auxiliary signal. DPVO/DPV-SLAM are better candidates when learned visual odometry speed and memory matter more than dense reconstruction.

## Sources

### Primary Papers and Repositories

- Teed and Deng, "DROID-SLAM: Deep Visual SLAM for Monocular, Stereo, and RGB-D Cameras": https://arxiv.org/abs/2108.10869
- DROID-SLAM NeurIPS 2021 paper: https://proceedings.neurips.cc/paper/2021/file/89fcd07f20b6785b92134bd6c1d0fa42-Paper.pdf
- DROID-SLAM official repository: https://github.com/princeton-vl/DROID-SLAM

### Related Learned SLAM Sources

- Teed, Lipson, and Deng, "Deep Patch Visual Odometry": https://arxiv.org/abs/2208.04726
- Lipson, Teed, and Deng, "Deep Patch Visual SLAM": https://arxiv.org/abs/2408.01654
- DPVO official repository: https://github.com/princeton-vl/DPVO
- Murai, Dexheimer, and Davison, "MASt3R-SLAM: Real-Time Dense SLAM with 3D Reconstruction Priors": https://arxiv.org/abs/2412.12392

### Datasets and Benchmarks

- TartanAir dataset and benchmark: https://theairlab.org/tartanair-dataset/
- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- TUM RGB-D dataset: https://cvg.cit.tum.de/data/datasets/rgbd-dataset
- ETH3D benchmark: https://www.eth3d.net/
- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php

### Internal Cross-Links

- [Mapping and Localization](../mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md)
- [Kimera-VIO](kimera-vio.md)
- [DPVO](dpvo.md)
- [MASt3R-SLAM](mast3r-slam.md)
- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
- [LSD-SLAM and DSO](lsd-slam-dso.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
