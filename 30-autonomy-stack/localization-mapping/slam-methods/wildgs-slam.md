# WildGS-SLAM: Monocular Gaussian Splatting SLAM in Dynamic Environments

Related docs: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md), [ORB-SLAM2/ORB-SLAM3](orb-slam2-orb-slam3.md), [loop closure and place recognition](loop-closure-place-recognition.md), and [SLAM benchmarking](benchmarking-metrics-datasets.md).

## Executive Summary

WildGS-SLAM is a CVPR 2025 monocular Gaussian-splatting SLAM system designed for dynamic scenes. Given only RGB video, it tracks the camera and reconstructs a static 3D Gaussian map while suppressing dynamic distractors. Its key idea is uncertainty-aware geometric mapping: a shallow MLP predicts an uncertainty map from DINOv2-derived features, and that uncertainty is used to downweight unreliable regions during tracking and Gaussian map optimization.

This is important because dynamic content is one of the core blockers for Gaussian SLAM outside controlled indoor scans. Moving people, vehicles, shadows, and occluders create ghost geometry and bias camera tracking. WildGS-SLAM avoids requiring semantic labels or explicit object classes; instead, it learns which pixels are unreliable for the current sequence.

For autonomous vehicles and airport airside autonomy, WildGS-SLAM is a strong research reference for dynamic-object-aware Gaussian mapping, but it is not deployment-ready localization. It is monocular RGB, uses learned visual priors, reports research metrics such as ATE and novel-view quality, and has no native radar, LiDAR, IMU, wheel, or GNSS factors. Its ideas are relevant for static-map extraction from dynamic logs, not for primary safety-critical pose estimation.

## Historical Context

Classic SLAM systems generally assume a mostly static world. Dynamic-object variants such as DynaSLAM, StaticFusion, and ReFusion added semantic segmentation, residual checks, or depth cues to reduce moving-object contamination. Neural and Gaussian SLAM systems reopened the problem: their maps are visually rich, but dynamic content creates highly visible artifacts such as ghost people, smeared vehicles, and incorrect opacity.

Early Gaussian SLAM systems such as MonoGS, GS-SLAM, Splat-SLAM, and SplaTAM focused on dense reconstruction and rendering. They improved map quality but still inherited static-scene assumptions. Dynamic neural methods such as DG-SLAM, DDN-SLAM, DynaMoN, and NeRF-on-the-go showed that uncertainty and distractor handling could improve rendering, but many required poses, depth, semantics, or short sequences.

WildGS-SLAM extends this line by bringing uncertainty-aware reconstruction into an online monocular SLAM loop. The paper evaluates on a newly collected Wild-SLAM dataset, including motion-capture sequences and in-the-wild iPhone sequences, plus Bonn RGB-D Dynamic and TUM RGB-D dynamic sequences. The official repository is Apache-2.0 licensed and provides runnable configs for dynamic datasets.

## Sensor Assumptions

WildGS-SLAM assumes monocular RGB input with known camera intrinsics. It does not require depth camera input, LiDAR, radar, IMU, semantics, or manual dynamic masks.

Key assumptions:

- The scene has enough static visual content for camera tracking.
- Dynamic distractors are visually separable through uncertainty learned from image features and multi-view inconsistency.
- A pretrained visual feature backbone generalizes to the deployment environment.
- Camera intrinsics are known and stable.
- Motion blur, rolling shutter, exposure shifts, and lens artifacts are not severe enough to defeat feature/depth priors.
- Dynamic objects are not permanently stationary in the same place for most of the sequence.

The method is not designed around adverse weather. Fog, rain, snow, water droplets, glare, and night lighting are camera-domain failures. For adverse-weather autonomy, compare against [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md) and radar/LiDAR-inertial fusion methods rather than treating camera-only Gaussian SLAM as a robust fallback.

## State/Map Representation

WildGS-SLAM maintains:

- A monocular camera trajectory.
- Keyframes selected for tracking and map optimization.
- A 3D Gaussian map representing static scene elements.
- A learned uncertainty predictor that marks unreliable pixels or regions.

Each Gaussian primitive carries the usual Gaussian-splatting attributes: 3D location, anisotropic shape, opacity, and appearance parameters. Unlike semantic dynamic-SLAM systems, the map does not need an explicit class label saying "person" or "vehicle." Dynamic handling is represented through uncertainty and loss weighting rather than a semantic object database.

This is a useful distinction for airports. A belt loader or aircraft tug may not be recognized by an off-the-shelf urban semantic model, but it can still be treated as unreliable if it violates multi-view static-scene consistency. However, static aircraft parked for long periods can still be absorbed into the map unless the data collection protocol or map policy excludes them.

## Algorithm Pipeline

1. **RGB frame ingestion**
   - Read monocular video frames and camera intrinsics.
   - Select keyframes for optimization.

2. **Feature and uncertainty prediction**
   - Extract pretrained visual features, including DINOv2-style features.
   - Train or update a shallow MLP to predict a per-pixel uncertainty map.

3. **Uncertainty-aware tracking**
   - Use dense bundle adjustment and image/depth cues for camera tracking.
   - Downweight uncertain pixels so dynamic distractors do not dominate the pose update.

4. **Gaussian map optimization**
   - Render the current Gaussian map from keyframe poses.
   - Optimize Gaussian attributes using image reconstruction losses.
   - Weight mapping losses by uncertainty so moving objects are not fused into the static map.

5. **Static-scene rendering**
   - Render input or novel views from the cleaned static Gaussian map.
   - Evaluate both trajectory and rendering quality when ground truth exists.

6. **Output**
   - Camera trajectory.
   - Static Gaussian map with reduced dynamic artifacts.
   - Rendered views and uncertainty visualizations.

## Formulation

WildGS-SLAM can be summarized as weighted visual SLAM plus weighted Gaussian map optimization.

For tracking, the pose update minimizes geometric and photometric residuals with uncertainty-based weights:

```text
T* = arg min_T sum_p w(p) * rho(r_track(p, T)^2)
```

where `w(p)` is low for pixels predicted to be unreliable, such as dynamic objects or shadows, and high for static scene regions.

For mapping, the Gaussian map is optimized through differentiable rendering:

```text
M* = arg min_M sum_k sum_p w_k(p) *
        [ L_rgb(render_rgb(M, T_k, p), I_k(p))
        + lambda_d * L_depth(render_depth(M, T_k, p), D_k(p)) ]
```

The uncertainty predictor is trained incrementally from the sequence, using pretrained image features as input. The practical effect is that pose and map optimization are guided toward static, repeatable evidence while ignoring regions that would otherwise create ghost geometry.

Because the method is monocular, evaluation commonly uses Sim(3) alignment unless metric scale is otherwise constrained. For AV deployment, any scale alignment freedom must be reported separately because metric pose is operationally required.

## Failure Modes

- **Uncertainty false negatives:** A moving object may be treated as reliable and fused into the map.
- **Uncertainty false positives:** Real static structure may be downweighted, reducing tracking constraints.
- **Stationary dynamic objects:** Parked aircraft, parked buses, stopped tugs, and temporary barriers may look static during mapping and become permanent map artifacts.
- **Low texture:** Apron concrete, sky, blank walls, and uniform hangar doors weaken monocular tracking.
- **Lighting and weather:** Night glare, wet surfaces, reflections, rain, fog, and lens contamination break RGB-only assumptions.
- **Long outdoor scale:** The paper targets dynamic scenes, but it is not primarily a kilometer-scale outdoor mapping system like GigaSLAM.
- **No physical velocity cue:** Unlike radar, the method has no direct Doppler measurement for moving-object separation.
- **No safety covariance:** The uncertainty map is not a full estimator covariance suitable for a safety monitor.
- **Compute dependency:** Gaussian rendering and feature networks require GPU resources.
- **Domain shift:** DINOv2 and depth/visual priors may not handle rare airside vehicles and aircraft geometries reliably.

## AV Relevance

WildGS-SLAM is most relevant to AVs as a dynamic-scene map-cleaning reference. Fleet logs are full of moving cars, pedestrians, buses, maintenance vehicles, and transient objects. A Gaussian map that can reconstruct the static background while rejecting dynamic distractors is valuable for:

- Visual simulation and replay.
- Map-change inspection.
- Camera localization research.
- Perception regression environments.
- Dataset cleaning and static-background extraction.

It is much less relevant as a runtime localization core. AVs need metric scale, bounded error, failure detection, deterministic latency, and robustness when cameras are degraded. WildGS-SLAM provides useful ideas for visual map construction, but runtime autonomy should fuse physical sensors such as LiDAR, radar, IMU, wheel odometry, and GNSS.

## Indoor/Outdoor Relevance

**Indoor:** Strong fit for offices, labs, corridors, and rooms with moving people or robots. The Wild-SLAM MoCap, Bonn RGB-D Dynamic, and TUM RGB-D evaluations are closest to this regime.

**Outdoor:** Relevant for outdoor dynamic visual scenes, especially when the task is static-background reconstruction rather than precise metric navigation. The iPhone in-the-wild sequences show broader scene diversity, but AV-scale outdoor validation remains limited.

**Mixed indoor/outdoor:** Potentially useful for terminal entrances, hangars, covered service roads, and mixed lighting conditions, but transition robustness must be tested directly.

## Airside Deployment Notes

Airport airside environments contain exactly the kind of dynamic clutter that motivates WildGS-SLAM, but also contain camera conditions that exceed the method's current maturity.

Deployment notes:

- Use it offline to extract static visual backgrounds from logs with aircraft, tugs, belt loaders, buses, and pedestrians.
- Do not allow static aircraft or long-parked equipment to become permanent map layers without operations metadata.
- Add data-collection passes when stands are empty if the goal is a stable map.
- Treat shadows, reflections on wet pavement, and heat shimmer as dynamic-like appearance changes.
- Validate near repeated gates because visual ambiguity can create false map alignment.
- Use radar or LiDAR to verify whether an uncertain visual region is actually moving.
- Keep the Gaussian map as an appearance layer, not the authoritative operational map.

For an airside AV, WildGS-SLAM is a useful research tool for cleaning and visualizing map logs. It should not be the pose source used to control the vehicle near aircraft.

## Datasets/Metrics

Datasets used or supported in the WildGS-SLAM ecosystem:

- **Wild-SLAM MoCap Dataset:** dynamic indoor/outdoor-style scenes with ground-truth camera poses and distractors such as people, robots, balls, tables, and umbrellas.
- **Wild-SLAM iPhone Dataset:** in-the-wild monocular RGB sequences without ground-truth camera poses.
- **Bonn RGB-D Dynamic Dataset:** dynamic RGB-D benchmark used for tracking comparison.
- **TUM RGB-D Dynamic sequences:** standard RGB-D dynamic scenes used for SLAM evaluation.

Metrics:

- ATE RMSE, commonly reported in centimeters when ground truth exists.
- Sim(3) alignment details for monocular evaluation.
- PSNR, SSIM, and LPIPS for novel-view synthesis.
- Tracking failure count.
- Dynamic-object removal quality by visual inspection and static-view rendering.
- Runtime, memory, and GPU usage.

For AV/airside work, add dynamic-object map-contamination rate, false static insertions, performance under night/rain/fog/glare, and relocalization ambiguity near repeated stands.

## Open-Source Implementations

- **GradientSpaces/WildGS-SLAM:** official Apache-2.0 repository with configs, scripts, dynamic dataset support, and evaluation utilities.
- The repository acknowledges code adapted from MonoGS, DROID-SLAM, Splat-SLAM, GIORIE-SLAM, NeRF-on-the-go, and Metric3D V2.
- It provides scripts for Wild-SLAM iPhone, TUM RGB-D dynamic sequences, and custom RGB folders.
- Pose evaluation is saved in TUM trajectory format when ground truth is available.

The open-source status is good for research. Product use still requires replacing research assumptions with calibrated sensor fusion, runtime diagnostics, map governance, and deterministic deployment infrastructure.

## Practical Recommendation

Use WildGS-SLAM when the research question is: "Can we build a clean static Gaussian map from monocular video containing dynamic distractors?" It is one of the strongest primary references for that problem.

Do not use WildGS-SLAM alone for outdoor AV or airside localization. If the architecture needs Gaussian maps, use WildGS-SLAM-style uncertainty to clean the visual layer, then align that layer to a metric LiDAR/radar/HD map. Runtime pose should remain a multi-sensor state-estimation problem.

## Sources

- Zheng, J., Zhu, Z., Bieri, V., Pollefeys, M., Peng, S., and Armeni, I. "WildGS-SLAM: Monocular Gaussian Splatting SLAM in Dynamic Environments." CVPR 2025. https://openaccess.thecvf.com/content/CVPR2025/papers/Zheng_WildGS-SLAM_Monocular_Gaussian_Splatting_SLAM_in_Dynamic_Environments_CVPR_2025_paper.pdf
- arXiv page for WildGS-SLAM. https://arxiv.org/abs/2504.03886
- Official WildGS-SLAM repository. https://github.com/GradientSpaces/WildGS-SLAM
- WildGS-SLAM project page. https://wildgs-slam.github.io/
- Local context: [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md)

