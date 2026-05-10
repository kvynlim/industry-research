# Dynamic 4D Gaussian SLAM

<!-- method-priority:start
priority:
  learning: 3
  deployment: 2
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["slam", "mapping", "simulation", "validation"]
  reason: "Dynamic 4D Gaussian SLAM is rated for neural or Gaussian SLAM research and future dense map representation workflows."
method-priority:end -->

Related docs: [WildGS-SLAM](wildgs-slam.md), [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md), [Semantic SLAM](semantic-slam.md), [Splat-SLAM](splat-slam.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).

## Executive Summary

Dynamic 4D Gaussian SLAM is a 2025-2026 research wave that extends Gaussian SLAM from static 3D scenes to time-varying scenes. Instead of treating moving objects only as outliers to remove, these methods try to represent motion explicitly through dynamic Gaussians, deformation fields, motion probabilities, static/dynamic splits, or time-aware reliability estimates.

The page covers the main taxonomy: 4DGS-SLAM, 4DTAM, D4DGS-SLAM, Dy3DGS-SLAM, and DAGS-SLAM. These systems differ in sensors and modeling choices, but they share the same core problem: dynamic objects can corrupt pose tracking and pollute maps, while modeling them increases dimensionality, ambiguity, and compute.

For AVs and airside autonomy, dynamic Gaussian SLAM is important but early. It is most useful for research, offline dynamic-scene reconstruction, map cleaning, and simulation. It is not yet a production localization replacement for multi-sensor state estimation.

## Core Idea

Static Gaussian SLAM assumes one persistent scene. Dynamic 4D Gaussian SLAM adds time:

```text
Static 3DGS map:
  G_i = position, covariance, opacity, appearance

Dynamic / 4D map:
  G_i(t) = position(t), deformation(t), opacity(t), appearance(t), motion/reliability state
```

Common approaches:

- Split Gaussians into static and dynamic sets.
- Add MLP or control-point deformation fields.
- Use optical flow, depth, masks, or semantics to supervise motion.
- Maintain per-Gaussian motion probability or reliability.
- Filter dynamic or unreliable points out of pose tracking.
- Optimize dynamic rendering and static localization jointly.

The hard part is that pose and scene motion can explain the same image residual. Without enough depth, priors, or temporal constraints, camera motion and object motion are ambiguous.

## Pipeline

Typical dynamic Gaussian SLAM pipeline:

1. Ingest RGB, RGB-D, or RGB plus predicted depth.
2. Estimate camera pose from static or reliable regions.
3. Generate dynamic cues such as optical flow, depth disagreement, segmentation, or uncertainty.
4. Classify pixels or Gaussians as static, dynamic, or unreliable.
5. Build a static Gaussian map for localization support.
6. Build dynamic Gaussians or deformation fields for moving regions.
7. Render RGB/depth/flow from the 4D map.
8. Optimize photometric, geometric, flow, and regularization losses.
9. Update motion probability, reliability, or dynamic state over time.
10. Evaluate trajectory, rendering, dynamic reconstruction, and map cleanliness.

## Method Taxonomy

| Method | Input | Dynamic model | Main idea |
|---|---|---|---|
| 4DGS-SLAM | RGB-D | Static/dynamic Gaussian sets plus control-point/MLP transformation fields | Reconstruct dynamic radiance fields instead of removing all dynamic content |
| 4DTAM | RGB with depth measurements or predictions | Dynamic surface Gaussians plus MLP warp field | Joint non-rigid tracking and mapping via differentiable rendering |
| D4DGS-SLAM | RGB-D-style dynamic scenes | 4DGS map with dynamics-aware InfoModule | Estimate dynamics, visibility, and reliability, then filter unstable dynamic points for tracking |
| Dy3DGS-SLAM | Monocular RGB | Probabilistic fusion of optical-flow and depth masks | Dynamic mask and motion loss for monocular dynamic Gaussian SLAM |
| DAGS-SLAM | RGB-D benchmarks | Per-Gaussian spatiotemporal motion probability | Use YOLO priors plus geometry and uncertainty scheduling to reduce semantic compute |

## Strengths

- Directly addresses dynamic-object contamination.
- Can preserve useful dynamic-scene information rather than deleting everything that moves.
- Produces time-varying visual assets useful for simulation and replay.
- Per-Gaussian motion or reliability states are a natural fit for map QA.
- Filtering unreliable dynamic regions can improve pose tracking.
- DAGS-SLAM-style scheduling points toward mobile compute tradeoffs.
- 4DTAM and 4DGS-SLAM create evaluation protocols for a difficult underexplored problem.

## Limitations

- The optimization problem is high-dimensional and ill-posed.
- Camera ego-motion and object motion are hard to disentangle.
- Motion masks, flow, segmentation, and depth priors can fail under blur, occlusion, lighting change, and reflective surfaces.
- Dynamic objects that stop for long periods can be mistaken for static map structure.
- Dynamic reconstruction quality does not guarantee pose accuracy.
- Compute and memory grow quickly with time-varying Gaussians.
- Many methods are benchmarked on indoor RGB-D or short dynamic sequences, not long AV routes.
- Uncertainty outputs are not yet calibrated safety covariances.

## AV Relevance

Dynamic 4D Gaussian SLAM matters to AVs because roads, depots, terminals, and airports are never perfectly static. It can help with:

- Offline removal or modeling of dynamic objects in mapping logs.
- Dynamic scene replay and simulation.
- Static-background extraction from traffic-heavy routes.
- Visual QA of ghost artifacts.
- Research into motion-aware visual localization.

It should not replace production tracking or localization. AVs need explicit object tracking, occupancy prediction, LiDAR/radar/camera fusion, map-frame localization, and safety monitors. Dynamic Gaussian maps may become useful supporting artifacts, but the production stack must still know what is currently occupied and what is safe to drive through.

## Indoor/Outdoor Notes

**Indoor:** Strong fit for labs, rooms, corridors, robots, people, and handheld RGB-D dynamic benchmarks. Multipath is less central than occlusion, texture, and moving people.

**Outdoor:** Harder because dynamic objects are larger, faster, farther away, and more numerous. Lighting and weather also vary more.

**Airside:** Airside scenes are a severe dynamic test: aircraft, tugs, belt loaders, buses, people, cones, baggage carts, fuel trucks, jet bridges, shadows, wet pavement, and reflections. Dynamic 4D Gaussian methods are useful for offline analysis, but not as a primary stand-approach pose source.

## Comparison

| Family | What it does with dynamics | Production caveat |
|---|---|---|
| Classical dynamic-aware SLAM | Remove or downweight moving objects | Less photorealistic, often stronger pose assumptions |
| WildGS-SLAM | Uncertainty-weight dynamic distractors in monocular Gaussian SLAM | Static-map extraction, not full 4D motion field |
| 4DGS-SLAM / 4DTAM | Model dynamic geometry over time | High-dimensional and early-stage |
| Dy3DGS-SLAM | Monocular dynamic masks and motion loss | Depends on learned/estimated masks and depth |
| DAGS-SLAM | Per-Gaussian motion probability with scheduled semantics | Practical direction, still benchmark-stage |

## Evaluation

Evaluate both localization and dynamic reconstruction:

- ATE/RPE for camera tracking.
- Static-map accuracy and ghost-object rate.
- Dynamic-object reconstruction quality.
- Flow/depth rendering error where ground truth exists.
- PSNR, SSIM, LPIPS for static and dynamic views.
- Motion-mask precision/recall.
- Tracking robustness during occlusion.
- Runtime, memory, and model growth over time.
- Ability to relocalize after dynamic occlusions.

For AV/airside work, add false-static insertions, false-dynamic removal of real infrastructure, effect on downstream localization, repeated-day consistency, and tests with stopped aircraft or parked GSE that later move.

## Implementation Notes

- Keep static localization maps separate from dynamic replay maps.
- Store dynamic object state with timestamps and provenance.
- Do not let one route with parked equipment define permanent infrastructure.
- Validate semantic and flow dependencies on local camera domains.
- Use LiDAR/radar/RTK truth where possible to separate camera error from dynamic-scene modeling error.
- Monitor GPU memory as a first-class metric.
- Treat per-Gaussian motion probability as a QA signal, not a safety-certified occupancy probability.
- For airside, use operations metadata when available to distinguish parked aircraft from infrastructure.

## Practical Recommendation

Use dynamic 4D Gaussian SLAM for research, replay, simulation, and map-cleaning studies. For production AV localization, keep dynamic objects in the perception/tracking stack and keep static map localization tied to validated metric maps. Dynamic Gaussian maps are promising supporting evidence, not operational authority.

## Sources

- Li, Fang, Zhu, Li, Ding, and Tombari, "4D Gaussian Splatting SLAM." https://arxiv.org/abs/2503.16710
- 4D Gaussian Splatting SLAM ICCV 2025 open-access paper. https://openaccess.thecvf.com/content/ICCV2025/html/Li_4D_Gaussian_Splatting_SLAM_ICCV_2025_paper.html
- 4DGS-SLAM project page. https://yanyan-li.github.io/project/gs/4dgsslam.html
- 4DGS-SLAM repository. https://github.com/yanyan-li/4DGS-SLAM
- Matsuki, Bae, and Davison, "4DTAM: Non-Rigid Tracking and Mapping via Dynamic Surface Gaussians." https://arxiv.org/abs/2505.22859
- 4DTAM project page. https://muskie82.github.io/4dtam/
- Sun, Lo, and Hu, "Embracing Dynamics: Dynamics-aware 4D Gaussian Splatting SLAM." https://arxiv.org/abs/2504.04844
- Li, Zhou, Zhou, Hu, Roemer, Wang, and Osman, "Dy3DGS-SLAM: Monocular 3D Gaussian Splatting SLAM for Dynamic Environments." https://arxiv.org/abs/2506.05965
- Zhang, Liu, Jiang, Huang, Li, and Zhang, "DAGS-SLAM: Dynamic-Aware 3DGS SLAM via Spatiotemporal Motion Probability and Uncertainty-Aware Scheduling." https://arxiv.org/abs/2602.21644
- Local context: [WildGS-SLAM](wildgs-slam.md)
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
