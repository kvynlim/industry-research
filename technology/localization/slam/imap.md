# iMAP

## Executive Summary

iMAP, "Implicit Mapping and Positioning in Real-Time," is the first widely cited neural implicit SLAM system to use a multilayer perceptron (MLP) as the only scene representation for real-time RGB-D SLAM. It trains a scene-specific neural field online from RGB-D frames and uses the same field for tracking by differentiable rendering. The method runs separate tracking and mapping processes, with reported tracking around 10 Hz and global map updating around 2 Hz.

Its historical value is high: it showed that neural implicit maps could be used inside a live SLAM loop rather than only for offline reconstruction. Its practical deployment value is limited. A single global MLP is compact and smooth, but it is slow to update, prone to over-smoothing and forgetting, difficult to scale to large scenes, and lacks classical loop closure, robust relocalization, and operational uncertainty.

For indoor research, iMAP is a landmark baseline. For outdoor AV or airside localization, it is not a candidate primary pose source. Its value is as the starting point for [NICE-SLAM](nice-slam.md), [Co-SLAM and ESLAM](co-slam-eslam.md), [NeRF-SLAM](nerf-slam.md), and the broader shift toward neural and Gaussian scene representations described in [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md).

## Historical Context

iMAP was published at ICCV 2021 by Edgar Sucar, Shikun Liu, Joseph Ortiz, and Andrew J. Davison. It arrived after the success of NeRF-style neural radiance fields for offline view synthesis and after earlier learned compact-map work such as CodeSLAM. The key question was whether a neural field could be optimized fast enough to support simultaneous tracking and mapping from a live RGB-D stream.

The answer was yes, but only with careful system design: sparse pixel sampling, keyframe memory, multiprocessing, and alternating tracking/mapping. The iMAP project page emphasizes that the MLP is trained online without prior data and is immediately used for camera tracking.

iMAP exposed both the promise and weakness of early neural SLAM. It gave watertight, smooth, predictive maps and a clean differentiable formulation. It also struggled with scale, local detail, and computational cost. NICE-SLAM directly addressed these limitations with hierarchical feature grids and pretrained decoders. Co-SLAM and ESLAM later replaced the single global MLP with faster hybrid representations.

## Sensor Assumptions

iMAP assumes a calibrated handheld RGB-D camera. The depth stream is central: it supervises geometry and gives enough metric information to make real-time neural mapping feasible. RGB provides color supervision and photometric tracking information. Camera intrinsics and depth scale must be accurate.

Important assumptions:

- The scene is static or nearly static during mapping.
- RGB and depth are synchronized.
- The camera moves smoothly enough for pose optimization to converge.
- The initial pose and subsequent tracking do not drift outside the local basin.
- A desktop-class GPU/CPU system can run PyTorch optimization online.
- Indoor depth quality is sufficient; sunlight, reflective surfaces, glass, and long-range outdoor geometry are not expected.

iMAP is not a monocular method. It is also not a general multi-sensor estimator. It does not natively fuse IMU, wheel odometry, lidar, GNSS, or surveyed maps in the way an operational robot or vehicle stack would require.

## State/Map Representation

The map is a neural implicit field:

```text
f_theta(x) -> {
  occupancy_or_density,
  color
}
```

The input `x` is a 3D coordinate. The output describes whether that point is occupied or dense and what color should be rendered along camera rays. The map is stored in the MLP weights `theta` rather than in a voxel grid, surfel cloud, or keyframe point map.

iMAP also stores a set of keyframes and their estimated camera poses. Keyframes form a memory bank that prevents the neural network from only fitting recent observations and forgetting older areas. The project page describes selecting keyframes based on information gain and allocating more pixel samples to higher-loss keyframes.

The state therefore includes:

- Current live camera pose.
- Keyframe camera poses.
- MLP scene weights.
- Keyframe RGB-D observations.
- A locked network copy used for keyframe selection and map snapshots.

This compact representation is elegant but hard to update locally. A global MLP can change predictions throughout the scene when trained on new observations.

## Algorithm Pipeline

1. Receive an RGB-D frame.
2. Use the current neural field to render predicted depth and color at sampled pixels.
3. Track the live frame by optimizing the current camera pose while holding the network fixed.
4. Select informative pixels rather than rendering every pixel.
5. Decide whether the frame should become a keyframe based on information gain and scene coverage.
6. Add selected keyframes to the memory bank.
7. Run a mapping process that samples pixels from the current keyframe set.
8. Jointly optimize the MLP weights and selected keyframe poses against depth and color rendering losses.
9. Update keyframe sampling probabilities based on reconstruction loss.
10. Continue alternating tracking and mapping online.

The pipeline is PTAM-like in structure: tracking estimates current pose quickly, while mapping improves the scene model and keyframe poses in parallel. The unusual part is that the map is not sparse landmarks or TSDF voxels; it is a continuously optimized neural function.

## Formulation

iMAP uses differentiable rendering from the neural field. A simplified rendering loss is:

```text
L = lambda_d * sum_r ||D_rendered(r; theta, T) - D_observed(r)||_1
  + lambda_c * sum_r ||C_rendered(r; theta, T) - C_observed(r)||_1
```

For tracking:

```text
T_t = argmin_T L(theta_fixed, T, RGBD_t)
```

For mapping:

```text
theta, {T_k} = argmin_{theta,{T_k}} sum_{keyframes k} L(theta, T_k, RGBD_k)
```

The rendered depth and color are computed by sampling points along camera rays and integrating predictions from the neural field. Instead of optimizing over every pixel, iMAP samples a sparse set of informative pixels. The project page notes that rendering and optimizing all pixels would be expensive, so the method uses sparse random and active sampling.

This formulation makes SLAM differentiable end to end, but it also ties tracking success to the current learned map. If the map is wrong, the pose optimization can be confidently wrong.

## Failure Modes

- Global MLP representation over-smooths fine details and sharp geometry.
- Continual online training can forget older areas or distort unobserved regions.
- Large scenes are hard because all geometry shares one network.
- Tracking can fail when the learned map is incomplete or hallucinated.
- No strong place-recognition or loop-closure mechanism is built into the original system.
- Dynamic objects become part of the learned scene unless masked.
- Depth holes, reflective surfaces, glass, sunlight, and black materials produce wrong supervision.
- Sparse pixel sampling can miss small but important structures.
- Runtime depends on neural optimization and is sensitive to GPU load.
- The method produces plausible completion, which can be dangerous if treated as measured geometry.
- Uncertainty is not mature enough for safety-critical pose fusion.

## AV Relevance

iMAP is relevant to AVs mainly as a concept: a compact neural field can act as both a map and a renderer for localization. It points toward future systems where dense geometry, appearance, semantics, and map completion are jointly optimized and queried continuously.

It is not relevant as a production AV localization method. The system is RGB-D, indoor, short-range, computationally heavy, and lacks the multi-sensor redundancy and failure monitoring required for vehicles. Plausible neural completion is especially risky for AV safety because unobserved free space and hallucinated surfaces must not be treated as certified map truth.

Transferable ideas:

- Differentiable rendering as a tracking residual.
- Keyframe memory for neural field training.
- Active pixel sampling based on information or loss.
- Joint pose and map optimization in a learned representation.
- Dense map representations that can fill small holes for visualization or QA.

## Indoor/Outdoor Relevance

Indoor relevance is high for research and controlled RGB-D mapping. iMAP is best understood in small to medium indoor rooms with static scenes, calibrated depth, and manageable motion. It is useful for studying neural map behavior and for comparing against later neural implicit methods.

Outdoor relevance is very low. RGB-D depth assumptions do not transfer to sunlit airside spaces, and neural field optimization is not robust enough for long vehicle-scale trajectories. Monocular or lidar-camera neural field variants are more relevant outdoors, but they need different front ends and much stronger safety wrappers.

For indoor-to-outdoor operations, use iMAP only as a research baseline for indoor dense mapping. It should not be expected to localize a vehicle across a terminal-to-apron transition.

## Airside Deployment Notes

Possible airside research uses:

- Dense neural reconstruction of controlled hangar or workshop scenes.
- Comparison against [KinectFusion](kinectfusion.md), [ElasticFusion](elasticfusion.md), and [NICE-SLAM](nice-slam.md) on indoor airside captures.
- Studying how neural completion behaves around aircraft parts, tools, and service equipment.
- Generating visualizations for non-safety simulation or operator review.

Deployment risks:

- Hallucinated geometry around aircraft, carts, hoses, and equipment can look plausible but be wrong.
- Moving objects are learned unless segmented.
- Global MLP updates may change old map regions unexpectedly.
- There is no certified uncertainty, loop-closure gate, or recovery stack.
- Outdoor apron sensing is outside the method's sensor assumptions.

If used in an airside project, keep iMAP output offline or advisory. Do not feed iMAP pose directly to a vehicle controller. Compare its reconstruction against measured lidar/RGB-D data and a classical pose source.

## Datasets/Metrics

iMAP is evaluated in the neural RGB-D SLAM literature on indoor datasets such as Replica and TUM RGB-D, and later methods often use an iMAP reimplementation for comparison. Metrics should cover both localization and reconstruction:

- ATE/APE and RPE for camera trajectory.
- Depth L1 error for rendered depth.
- RGB rendering PSNR, SSIM, and LPIPS where view synthesis quality matters.
- Mesh accuracy, completeness, Chamfer distance, F-score, and normal consistency.
- Runtime split between tracking and mapping.
- Keyframe count, sampled pixels per update, and GPU memory.
- Forgetting tests: revisit old areas after mapping new rooms.
- Dynamic-object ghosting and hallucination rate.

For airside indoor testing, use repeated scans with moved equipment and independently measured geometry. The key question is not only whether the scene looks good, but whether the geometry and pose remain trustworthy after revisits and changes.

## Open-Source Implementations

- iMAP project page: paper, video, method description, and citation.
- The project page does not present a production-grade official code release.
- NICE-SLAM includes an `iMAP*` reimplementation used for comparison.
- Community PyTorch implementations exist, but they should be treated as educational or experimental reproductions unless validated carefully.

For practical experiments, it is usually better to start from [NICE-SLAM](nice-slam.md), [Co-SLAM and ESLAM](co-slam-eslam.md), or another maintained neural SLAM codebase, then use iMAP as the historical baseline.

## Practical Recommendation

Use iMAP to understand the origin of real-time neural implicit SLAM. Do not choose it for deployment. Its single-MLP representation is elegant but has known scalability and detail limitations.

For an indoor dense RGB-D research benchmark, include iMAP conceptually and compare against [NICE-SLAM](nice-slam.md), [Co-SLAM and ESLAM](co-slam-eslam.md), and classical baselines. For any airside or AV application, keep iMAP in the "research visualization and map representation" category, not the "localization backbone" category.

## Sources

- Sucar et al., "iMAP: Implicit Mapping and Positioning in Real-Time," ICCV 2021. https://openaccess.thecvf.com/content/ICCV2021/html/Sucar_iMAP_Implicit_Mapping_and_Positioning_in_Real-Time_ICCV_2021_paper.html
- iMAP paper PDF. https://openaccess.thecvf.com/content/ICCV2021/papers/Sucar_iMAP_Implicit_Mapping_and_Positioning_in_Real-Time_ICCV_2021_paper.pdf
- iMAP arXiv. https://arxiv.org/abs/2103.12352
- iMAP project page. https://edgarsucar.github.io/iMAP/
- NICE-SLAM project page and iMAP* comparison. https://pengsongyou.github.io/nice-slam
- Local context: [NICE-SLAM](nice-slam.md)
- Local context: [Co-SLAM and ESLAM](co-slam-eslam.md)
- Local context: [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md)
