# GigaSLAM: Large-Scale Monocular SLAM with Hierarchical Gaussian Splats

Related docs: [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md), [SLAM benchmarking](benchmarking-metrics-datasets.md), [loop closure and place recognition](loop-closure-place-recognition.md), and [ORB-SLAM2/ORB-SLAM3](orb-slam2-orb-slam3.md).

## Executive Summary

GigaSLAM is a 2025 monocular RGB Gaussian-splatting SLAM system aimed at kilometer-scale outdoor mapping. Its main contribution is not another small-room dense visual SLAM pipeline, but a scale-oriented design for unbounded urban scenes: a hierarchical sparse voxel representation whose neural decoders generate Gaussian splats at multiple levels of detail, plus a front end that combines learned metric depth, epipolar geometry, PnP tracking, image retrieval, and Bag-of-Words loop closure.

The method matters because most early 3D Gaussian Splatting SLAM systems were demonstrated on bounded indoor RGB-D or monocular scenes. GigaSLAM explicitly targets outdoor driving datasets such as KITTI, KITTI-360, 4Seasons, and A2D2, making it one of the clearest research references for Gaussian SLAM beyond room-scale reconstruction.

For autonomous vehicles, GigaSLAM should be treated as an outdoor neural-mapping research system, not a production localization stack. It is monocular-camera-first, depends on learned depth and visual features, and is vulnerable to lighting, weather, dynamic traffic, lens contamination, and calibration drift. It is useful for studying scalable Gaussian maps, visual replay, and map compression, but airside deployment would require LiDAR/radar/IMU/GNSS fusion, safety-rated health monitoring, and a separate production map-localization layer.

## Historical Context

3D Gaussian Splatting became popular as an efficient radiance-field representation because it can render novel views much faster than classic NeRF-style volume rendering. SLAM researchers quickly adapted it for dense mapping, but early systems such as SplaTAM, MonoGS, GS-SLAM, and Splat-SLAM were mostly evaluated on small indoor scenes or short bounded trajectories. Those systems showed that Gaussians are attractive as a differentiable map representation, but they did not solve large outdoor scale, map growth, loop correction, or long-term memory management.

Outdoor autonomous driving created different constraints: long trajectories, unbounded backgrounds, repeated structures, large sky regions, moving vehicles, changing illumination, and sparse revisits. A single dense global Gaussian cloud is hard to optimize and hard to render efficiently at that scale. GigaSLAM responds by making the map hierarchical and sparse, then decoding Gaussians where needed rather than treating every scene primitive as one flat optimized list.

The front end also reflects a pragmatic trend in visual SLAM after DROID-SLAM and recent metric-depth models: instead of relying only on handcrafted features or purely photometric tracking, use learned depth and learned correspondences to provide robust metric pose initialization. The official repository uses components such as UniDepth, DISK, LightGlue, DBoW2, and 3DGS rasterization modules, showing that GigaSLAM is a systems integration around a new scalable Gaussian map.

## Sensor Assumptions

GigaSLAM assumes a monocular RGB camera stream with calibrated intrinsics. It does not require LiDAR, stereo, radar, GNSS, or IMU in the base method, which is a research strength but an operational weakness.

Key assumptions:

- Camera intrinsics are known and stable.
- Images have enough texture and overlap for feature matching and epipolar geometry.
- A learned metric depth model generalizes to the deployment domain.
- Dynamic objects do not dominate the matched features or the Gaussian map updates.
- The camera exposure, motion blur, rolling shutter, and weather artifacts remain within the tolerance of the feature and depth networks.
- Revisits contain enough visual similarity for Bag-of-Words loop detection.
- GPU resources are available for Gaussian rendering, neural decoding, and optimization.

For AV use, these assumptions are fragile. Night airside scenes, rain droplets, de-icing spray, glare from floodlights, low-texture concrete, and repetitive stand geometry can all break monocular tracking or produce false loop closures. Radar and LiDAR should be considered complementary sensors rather than optional accessories.

## State/Map Representation

The state is a camera trajectory with selected keyframes and estimated poses in a metric visual SLAM frame. The base formulation is camera-centric and does not include IMU bias, wheel slip, radar Doppler, or GNSS states.

The map is the core novelty:

- A hierarchical sparse voxel structure covers large unbounded outdoor space.
- Neural decoders produce Gaussian parameters from voxel-level features.
- The representation supports multiple levels of detail, so distant or low-detail regions do not need the same primitive density as nearby geometry.
- Renderable Gaussian primitives carry position, covariance/scale/orientation, opacity, and color appearance parameters.
- Loop closure and correction must update the trajectory and keep the decoded map consistent with corrected poses.

This map is best understood as a neural Gaussian city-scale reconstruction, not as an occupancy map or a safety-certified HD localization map. It can support rendering and possibly map QA, but planners and safety monitors still need explicit drivable surfaces, object layers, uncertainty, and map versioning.

## Algorithm Pipeline

1. **Input and calibration**
   - Load a monocular image sequence and camera intrinsics.
   - Configure dataset paths and image resolution.

2. **Metric depth and feature extraction**
   - Predict metric depth from RGB images using a pretrained depth model.
   - Extract and match visual features using learned local features and matchers.

3. **Front-end pose estimation**
   - Use epipolar geometry for relative pose constraints.
   - Use depth-supported 2D-3D correspondences and PnP for metric pose estimates.
   - Select keyframes for mapping and loop-closure indexing.

4. **Hierarchical Gaussian map update**
   - Allocate or update sparse voxels in the active map region.
   - Decode Gaussian splats from hierarchical neural features.
   - Render views from the current pose and optimize the map using image reconstruction losses and geometry/depth consistency.

5. **Loop detection**
   - Use an image-retrieval or Bag-of-Words module to identify revisits.
   - Verify candidate loop constraints before accepting them.

6. **Loop correction and map consistency**
   - Correct accumulated trajectory drift through loop constraints.
   - Propagate pose corrections to the Gaussian map representation.

7. **Outputs**
   - Estimated camera trajectory.
   - Hierarchical Gaussian map for rendering.
   - Novel-view renderings and evaluation metrics.

## Formulation

GigaSLAM combines classical geometric pose estimation with differentiable Gaussian rendering.

A simplified tracking objective uses correspondences and metric depth:

```text
T_t = arg min_T sum_i rho(|| project(T * P_i) - u_i ||^2)
```

where `P_i` is a 3D point obtained from predicted metric depth or a prior keyframe, `u_i` is a matched image point, `T_t` is the current camera pose, and `rho` is a robust loss.

The mapping objective uses differentiable rendering from the Gaussian map:

```text
M* = arg min_M sum_k L_rgb(render(M, T_k), I_k)
              + lambda_d * L_depth(render_depth(M, T_k), D_k)
              + regularization(M)
```

where `M` is the hierarchical Gaussian map, `I_k` are keyframe images, `D_k` are learned or estimated depths, and `T_k` are camera poses. The exact implementation decodes Gaussian parameters from sparse hierarchical features, which reduces memory pressure relative to a flat global list of Gaussians.

Loop closure adds pose-graph-style constraints:

```text
T* = arg min_T sum_odometry || log(Z_ij^-1 * T_i^-1 * T_j) ||_Omega^2
              + sum_loop     || log(Z_lm^-1 * T_l^-1 * T_m) ||_Omega^2
```

For AV evaluation, the important point is that scale and observability come from learned depth and visual geometry. This is not the same reliability class as metric LiDAR, radar Doppler, wheel odometry, or RTK.

## Failure Modes

- **Depth-prior domain shift:** Learned metric depth can fail on airport aprons, wet concrete, aircraft bodies, glass terminal facades, snow, and night lighting.
- **Dynamic traffic:** Cars, buses, aircraft, loaders, and pedestrians can corrupt correspondences and map appearance if not filtered.
- **Low texture:** Concrete, sky, painted walls, and homogeneous buildings reduce feature support.
- **Repeated structure:** Similar gates, jet bridges, service doors, and stand markings can cause false place-recognition matches.
- **Illumination change:** Shadows, glare, headlights, floodlights, sun angle, and weather-dependent exposure break photometric assumptions.
- **Camera-only weather fragility:** Rain, fog, lens droplets, de-icing fluid, and dirt directly degrade the only sensor.
- **Scale and drift risk:** Monocular metric scale is learned, not physically measured by the sensor.
- **Rolling shutter and motion blur:** Fast turns and vibration can bias pose estimates.
- **Compute and memory pressure:** Hierarchical maps reduce growth but do not remove GPU dependency.
- **No safety semantics:** A high-fidelity rendering map is not equivalent to a validated drivable-area or obstacle map.

## AV Relevance

GigaSLAM is relevant to AV research in three ways:

- It shows how Gaussian maps can be made more scalable for outdoor driving scenes.
- It gives a route toward visually rich replay maps for simulation, perception debugging, and synthetic camera data.
- It links classic SLAM components - PnP, epipolar geometry, loop closure - with neural map representations.

It is not yet a production AV localization method. Production AV localization needs bounded error, covariance, fault detection, deterministic latency, map change handling, and robustness to weather and sensor degradation. GigaSLAM is camera-only and optimized for trajectory/rendering quality rather than safety-rated pose output.

The most plausible AV role is offline or semi-offline map enrichment: build a Gaussian visual layer aligned to an HD map, then use it for inspection, simulation, visual localization research, or perception regression testing. For runtime autonomy, it should be fused with LiDAR/radar/IMU/GNSS estimators and compared against the production localization stack rather than replacing it.

## Indoor/Outdoor Relevance

**Indoor:** GigaSLAM can inherit the advantages of Gaussian visual SLAM in textured indoor spaces, but it is not primarily an indoor method. Indoor rooms are better served by smaller RGB-D or monocular Gaussian SLAM systems if scale is limited.

**Outdoor:** This is the intended regime. The hierarchical sparse voxel map directly addresses large unbounded scenes and long driving sequences. It is most suitable for urban roads, campuses, and structured outdoor spaces with abundant visual landmarks.

**Mixed indoor/outdoor:** Transitions through hangars, terminal edges, tunnels, and covered service roads are possible research targets, but exposure shifts and visual appearance changes must be tested explicitly.

## Airside Deployment Notes

GigaSLAM should not be used as the primary airside localization source. Airport airside autonomy has conditions that are hostile to monocular visual SLAM:

- Wide concrete aprons contain large low-texture regions.
- Aircraft and ground-support equipment are large moving objects that can dominate the camera view.
- Gates and stands are deliberately repetitive, increasing false loop-closure risk.
- Night operations, glare, rain, fog, jet blast spray, snow, and lens contamination are routine.
- Safety cases require confidence estimates and fault responses, not just visually plausible maps.

Useful airside roles:

- Build a visual Gaussian layer for simulator backgrounds and operator review.
- Compare learned Gaussian rendering against camera logs to detect map staleness.
- Provide research baselines for outdoor neural SLAM at airport scale.
- Augment a survey-grade LiDAR/radar/GNSS map with appearance for perception regression.

Any deployment experiment should anchor GigaSLAM output to surveyed control points, RTK/INS, or a validated HD map, and should treat loop closures near repeated gates as high-risk events requiring geometric verification.

## Datasets/Metrics

Public datasets associated with GigaSLAM-style evaluation:

- **KITTI Odometry:** urban/suburban driving with stereo, LiDAR, and GPS/INS reference.
- **KITTI-360:** longer urban sequences with richer annotations and outdoor scale.
- **4Seasons:** long-term outdoor driving across time and seasonal appearance changes.
- **A2D2:** automotive camera/LiDAR dataset useful for appearance diversity.

Metrics to report:

- Absolute Trajectory Error after clearly stated alignment.
- Relative Pose Error over distance and time windows.
- Loop-closure precision/recall and false-positive rate.
- Novel-view PSNR, SSIM, and LPIPS.
- Rendering FPS and optimization latency.
- GPU memory versus route length.
- Map growth in number of voxels, decoded Gaussians, and disk footprint.
- Failure count by weather, lighting, dynamics, and low-texture scene type.

For AV or airside evaluation, add fixed-frame RTK/GCP residuals, covariance consistency from the fused estimator, relocalization false accepts near repeated gates, and performance under lens contamination.

## Open-Source Implementations

- **DengKaiCQ/GigaSLAM:** official MIT-licensed implementation. The repository includes `slam.py`, hierarchical Gaussian modules, DBoW2/DPRetrieval loop-closure components, UniDepth integration, and CUDA/C++ Gaussian rendering dependencies.
- **3DGS rasterization dependencies:** GigaSLAM builds on differentiable Gaussian rasterization and simple-knn modules commonly used in the 3DGS ecosystem.
- **Loop-closure dependencies:** DBoW2 and an ORB vocabulary are used in the official setup.
- **Depth and feature dependencies:** The repository references UniDepth V2, DISK, and LightGlue weights.

Implementation maturity caveat: the public code is valuable for research reproduction, but it is not a drop-in ROS2 AV localization package. Product teams should expect GPU setup friction, dataset-specific configuration, and no safety monitoring.

## Practical Recommendation

Use GigaSLAM as the reference method for large-scale outdoor Gaussian SLAM with monocular RGB input. It is the right page to cite when discussing whether Gaussian maps can scale beyond rooms.

Do not use it as the localization core for an airside AV. If Gaussian maps are desired, use GigaSLAM offline to create an appearance layer and align that layer to a conventional metric map. Runtime pose should come from LiDAR/radar/IMU/GNSS fusion, with camera-Gaussian matching treated as an auxiliary visual factor only after rigorous outlier rejection.

## Sources

- Deng, K., Zhang, Y., Yang, J., and Xie, J. "GigaSLAM: Large-Scale Monocular SLAM with Hierarchical Gaussian Splats." arXiv, 2025. https://arxiv.org/abs/2503.08071
- Official GigaSLAM repository. https://github.com/DengKaiCQ/GigaSLAM
- Kerbl, B. et al. "3D Gaussian Splatting for Real-Time Radiance Field Rendering." ACM TOG, 2023. https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
- Matsuki, H. et al. "Gaussian Splatting SLAM." CVPR 2024. https://openaccess.thecvf.com/content/CVPR2024/html/Matsuki_Gaussian_Splatting_SLAM_CVPR_2024_paper.html
- Keetha, N. et al. "SplaTAM: Splat, Track & Map 3D Gaussians for Dense RGB-D SLAM." CVPR 2024. https://openaccess.thecvf.com/content/CVPR2024/html/Keetha_SplaTAM_Splat_Track__Map_3D_Gaussians_for_Dense_RGB-D_SLAM_CVPR_2024_paper.html
- Local context: [Gaussian Splatting for Driving](../../perception/gaussian-splatting-driving.md)

