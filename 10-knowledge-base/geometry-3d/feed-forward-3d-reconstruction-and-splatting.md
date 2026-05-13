# Feed-Forward 3D Reconstruction and Splatting

Feed-forward 3D reconstruction predicts geometry or renderable scene primitives in one or a few neural-network passes. It is different from classical SfM, bundle adjustment, SLAM, NeRF, and optimization-based 3D Gaussian Splatting. Instead of optimizing a scene from scratch, the model learns a prior over geometry and uses that prior to infer camera parameters, depth, pointmaps, tracks, or Gaussian primitives from sparse images.

The benefit is speed and robustness to limited views. The risk is that the model can hallucinate plausible structure where the measurements are weak.

## Related Docs

- [Volume Rendering, Radiance Fields, and Gaussian Splatting](volume-rendering-radiance-fields-gaussian-splatting.md)
- [Camera Projective Geometry, PnP, and Triangulation](camera-projective-geometry-pnp-triangulation.md)
- [Coordinate Frames, Projections, and SE(3)](coordinate-frames-projections-se3.md)
- [Neural Implicit SLAM and Differentiable Mapping](../mapping/neural-implicit-slam-differentiable-mapping-first-principles.md)
- [Photoreal City-Scale 4D Reconstruction](../../30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md)
- [SLAM3R and VGGT Foundation SLAM](../../30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md)

## What The Model Predicts

Feed-forward systems usually predict one or more of these objects:

| Output | Meaning | Autonomy caution |
|---|---|---|
| Camera parameters | intrinsics, extrinsics, or relative pose inferred from images | may be projective or scale ambiguous without metric constraints |
| Depth maps | per-pixel distance or inverse-depth estimates | may be smooth, plausible, and wrong in textureless or reflective regions |
| Pointmaps | dense 3D point per image pixel or patch | need frame, scale, and confidence checks before registration |
| Point tracks | 2D/3D correspondences across views | can fail on repeated structures, dynamic actors, glare, and low texture |
| 3D Gaussians | means, covariances, opacity, and color attributes | renderable primitives are not automatically clean surfaces or occupancy |
| Features | learned geometry or appearance descriptors | useful for retrieval or initialization, but not direct geometry evidence |

## VGGT-Style Geometry Prediction

VGGT, Visual Geometry Grounded Transformer, predicts camera attributes, depth maps, pointmaps, and point tracks from one or more images. In a SLAM wrapper, these predictions become local dense geometry that still needs streaming logic, submap alignment, loop closure, and consistency checks.

The key distinction is:

```text
VGGT prediction:
  images -> camera attributes + depth/pointmaps/tracks

VGGT-SLAM-style system:
  VGGT prediction -> submaps -> alignment -> loop constraints -> optimized trajectory/map
```

For AV and airside work, VGGT-like outputs are valuable for reconstruction priors, visual map QA, relocalization experiments, and dense geometry baselines. They are not sufficient as a production pose source without metric sensors, health monitoring, and validation.

## pixelSplat-Style Image-Pair Gaussian Prediction

pixelSplat predicts a 3D Gaussian radiance-field representation from image pairs. It learns to infer Gaussian positions and rendering attributes directly from visual evidence, then renders novel views through Gaussian splatting.

Its conceptual pattern is:

```text
image pair -> learned matching and depth distribution -> Gaussian primitives -> novel-view rendering
```

This is useful when the question is rapid view synthesis or sparse-view reconstruction. It is weaker when the question is certified geometry, map-frame localization, or planner-safe occupancy.

## AnySplat-Style Unconstrained-View Splatting

AnySplat targets feed-forward 3D Gaussian Splatting from unconstrained views. The practical attraction is that a model can produce a renderable Gaussian scene from less controlled image collections than classical SfM plus 3DGS pipelines require.

The implementation risk is that unconstrained views amplify ambiguity:

- unknown or weak camera calibration,
- inconsistent exposure and white balance,
- moving objects,
- sparse overlap,
- repeated building or terminal structures,
- sky and reflective surfaces,
- weak metric scale.

AnySplat-like systems should be evaluated with held-out views and geometric checks, not only visual render quality.

## Relationship To Classical Pipelines

| Pipeline | Core mechanism | Strength | Weakness |
|---|---|---|---|
| COLMAP/SfM + 3DGS | optimize camera poses and sparse points, then optimize Gaussians | explicit multi-view geometry and mature diagnostics | can fail in textureless, reflective, dynamic, or sparse-view scenes |
| SLAM + Gaussian mapping | track pose online while maintaining a Gaussian map | can produce pose and renderable map together | still fragile under dynamics, lighting, and weak uncertainty |
| Feed-forward geometry | learned model predicts depth, pointmaps, cameras, or tracks | fast and useful with sparse views | learned prior can hallucinate |
| Feed-forward splatting | learned model predicts Gaussian primitives | rapid novel-view rendering | render quality can hide geometry errors |

## Failure Modes

| Symptom | Likely cause | Diagnostic |
|---|---|---|
| plausible geometry with wrong scale | monocular or projective ambiguity | compare to LiDAR, surveyed dimensions, or RTK/INS trajectory |
| clean render with wrong surface depth | learned prior fills unobserved space | evaluate depth on held-out LiDAR or dense stereo |
| duplicated surfaces | pose, calibration, or dynamic-object inconsistency | inspect reprojection residuals and static-only layers |
| terminal facades or gates misregistered | repeated structure creates false correspondence | use route priors, geofences, or LiDAR verification |
| moving objects baked into static output | no dynamic layer or insufficient temporal reasoning | render static-only and dynamic-only outputs separately |
| uncertainty unavailable or uncalibrated | model outputs confidence-like scores not validated probabilities | calibrate against geometric error buckets |

## Practical Use In AV Mapping

Good uses:

- initialize 3DGS or neural mapping when SfM is weak,
- generate dense priors for visual QA,
- bootstrap offline reconstruction from sparse camera logs,
- compare learned geometry against LiDAR maps,
- support human inspection of map coverage or scene assets.

Weak uses:

- primary localization without metric constraints,
- occupancy/free-space authority,
- safety-case evidence without independent geometry checks,
- city-scale map updates without provenance and dynamic-layer policy.

## Sources

- Wang et al., "VGGT: Visual Geometry Grounded Transformer." https://arxiv.org/abs/2503.11651
- Charatan et al., "pixelSplat: 3D Gaussian Splats from Image Pairs for Scalable Generalizable 3D Reconstruction." CVPR 2024. https://cvpr.thecvf.com/virtual/2024/poster/30256
- AnySplat, "Feed-forward 3D Gaussian Splatting from Unconstrained Views." https://arxiv.org/abs/2505.23716
- Kerbl et al., "3D Gaussian Splatting for Real-Time Radiance Field Rendering." https://arxiv.org/abs/2308.04079
