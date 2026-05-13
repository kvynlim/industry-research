# Photoreal City-Scale 4D Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable SLAM + knowledge-base coverage layer for photoreal city-scale 4D reconstruction, including a cross-section hub and focused first-principles pages.

**Architecture:** This is a Markdown-only documentation change. The new hub lives under localization/mapping because it is the reader-facing bridge from SLAM and map construction into photoreal 4D reconstruction, while the two new KB pages own the first-principles concepts. Existing perception, simulation, world-model, and SLAM pages remain canonical for method-specific detail and are cross-linked rather than duplicated.

**Tech Stack:** Markdown, VitePress auto-generated sidebar, Node 20 test scripts, existing link/content/navigation checks.

---

## File Structure

- Create: `30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md`
  - Responsibility: cross-section hub, method coverage matrix, reading paths, and SLAM-versus-reconstruction boundary.
- Create: `10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md`
  - Responsibility: first-principles explanation of VGGT, AnySplat, pixelSplat, and feed-forward Gaussian/geometry prediction.
- Create: `10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md`
  - Responsibility: compact taxonomy for Street Gaussians, OmniRe, S3Gaussian, EmerNeRF, OG-Gaussian, PVG, DrivingGaussian, and adjacent 4D reconstruction methods.
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md`
  - Responsibility: link Gaussian-LIC/LIC2 into the hub and clarify its role as metric LIC Gaussian SLAM.
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md`
  - Responsibility: link VGGT-SLAM into feed-forward reconstruction context without treating AnySplat/pixelSplat as SLAM systems.
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md`
  - Responsibility: connect dynamic Gaussian SLAM to offline dynamic 4D reconstruction and sharpen the boundary.
- Modify: `30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md`
  - Responsibility: expose the hub from the broader mapping/localization overview.
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/overview.md`
  - Responsibility: expose the hub from the SLAM method library cross-links.
- Modify: `10-knowledge-base/geometry-3d/overview.md`
  - Responsibility: add feed-forward reconstruction to geometry reading paths and page list.
- Modify: `10-knowledge-base/mapping/overview.md`
  - Responsibility: add dynamic 4D neural/Gaussian reconstruction to mapping reading paths and page list.
- Modify: `INDEX.md`
  - Responsibility: add the new hub and KB pages to the repository-level index.
- Modify: `README.md`
  - Responsibility: add one high-level discovery row if the README has a relevant section for cross-section navigation.

No JavaScript, package scripts, generated VitePress files, images, or CI workflows are created.

---

### Task 1: Create The Cross-Section Hub

**Files:**
- Create: `30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md`

- [ ] **Step 1: Verify the hub is not already present**

Run:

```powershell
Test-Path '30-autonomy-stack\localization-mapping\overview\photoreal-city-scale-4d-reconstruction.md'
```

Expected:

```text
False
```

- [ ] **Step 2: Create the hub page**

Create `30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md` with this content:

```markdown
# Photoreal City-Scale 4D Reconstruction

Photoreal city-scale 4D reconstruction sits between SLAM, mapping, neural rendering, simulation, and world modeling. The key engineering question is not whether a method can render a convincing view. The key question is what role its output can safely play: pose source, reconstruction asset, digital twin, map QA layer, simulator scene, or planner-facing map.

This page is the cross-section entry point for Gaussian, NeRF, and feed-forward reconstruction methods that matter to autonomous driving and airside digital twins. It links the SLAM method library and first-principles knowledge base to existing perception, simulation, and world-model pages.

## Read This First

Use this page to separate four claims:

| Claim | What proves it | What does not prove it |
|---|---|---|
| Render quality | held-out RGB/depth/LiDAR render metrics, novel-view inspection, dynamic-region metrics | a visually impressive training-view video |
| Metric geometry | depth error, LiDAR residuals, surface accuracy, Chamfer/F-score, survey or RTK comparison | PSNR alone |
| Pose/localization quality | ATE/RPE, drift per distance/time, covariance or health behavior, loop-closure validation | a Gaussian map that looks aligned locally |
| Planner-safe occupancy | explicit free/occupied/unknown semantics, uncertainty, validation gates, safety-case evidence | a radiance field or Gaussian opacity map by itself |

## Method Role Taxonomy

| Role | Methods | Local starting point | How to use |
|---|---|---|---|
| Metric SLAM with Gaussian maps | Gaussian-LIC, Gaussian-LIC2, GS-LIVM, VIGS-SLAM, Splat-LOAM | [Gaussian-LIC and Gaussian-LIC2](../slam-methods/gaussian-lic.md) | Evaluate pose, timing, calibration, and Gaussian map quality separately. |
| Foundation/dense visual SLAM | SLAM3R, VGGT-SLAM, VGGT-SLAM++, MASt3R-SLAM, ViSTA-SLAM | [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md) | Use for reconstruction, visual map QA, and research baselines; do not assume safety localization. |
| Dynamic street 4D reconstruction | Street Gaussians, DrivingGaussian, OmniRe, S3Gaussian, PVG, OG-Gaussian, EmerNeRF | [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md) | Use for digital twins, replay, map cleaning, and simulation-support assets. |
| Feed-forward splatting and reconstruction | VGGT, AnySplat, pixelSplat, MVSplat-style methods | [Feed-Forward 3D Reconstruction and Splatting](../../../10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md) | Use for priors, initialization, quick reconstruction, and QA; audit hallucination and metric ambiguity. |
| Supporting first principles | volume rendering, 3DGS, neural implicit SLAM, continuous-time trajectories, calibration/timing | [Volume Rendering, Radiance Fields, and Gaussian Splatting](../../../10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md) | Use to debug why rendering, geometry, pose, and occupancy claims diverge. |

## Requested Method Coverage

| Method | Family | Current repo handling | Coverage action |
|---|---|---|---|
| Street Gaussians | tracked-object dynamic 3DGS | Covered in simulation/world-model pages | Summarized in the dynamic reconstruction KB taxonomy and linked from this hub. |
| OmniRe | omni dynamic urban 3DGS | Missing | Covered in the dynamic reconstruction KB taxonomy as full dynamic actor reconstruction. |
| S3Gaussian | self-supervised street 3DGS | Covered in simulation pages | Summarized in the dynamic reconstruction KB taxonomy. |
| EmerNeRF | self-supervised dynamic NeRF | Covered in simulation/world-model pages | Summarized in the dynamic reconstruction KB taxonomy as a NeRF-side decomposition baseline. |
| OG-Gaussian | occupancy-guided street Gaussian | Thin mention | Covered in the dynamic reconstruction KB taxonomy as occupancy-guided initialization and decomposition. |
| PVG | periodic vibration Gaussian | Covered in simulation/Gaussian overview pages | Summarized in the dynamic reconstruction KB taxonomy. |
| DrivingGaussian | composite surround-view 3DGS | Dedicated perception method page | Linked as the canonical atomic method page. |
| Gaussian-LIC | LiDAR-inertial-camera Gaussian SLAM | Dedicated SLAM method page | Linked as the metric Gaussian-SLAM baseline. |
| Gaussian-LIC2 | continuous-time LIC Gaussian SLAM | Covered in Gaussian-LIC page | Linked as the stronger continuous-time extension. |
| VGGT | feed-forward visual geometry model | Covered through VGGT-SLAM page | Covered in the feed-forward KB page and linked to foundation SLAM. |
| AnySplat | feed-forward 3DGS from unconstrained views | Missing | Covered in the feed-forward KB page. |
| pixelSplat | image-pair feed-forward 3DGS | Missing | Covered in the feed-forward KB page. |

## Reading Path By Intent

| Intent | Read in this order |
|---|---|
| I need a pose or SLAM method | [Production LiDAR Map Localization](production-lidar-map-localization.md) -> [Gaussian-LIC and Gaussian-LIC2](../slam-methods/gaussian-lic.md) -> [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md) -> [Dynamic 4D Gaussian SLAM](../slam-methods/dynamic-4d-gaussian-slam.md) |
| I need a photoreal digital twin | [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md) -> [3DGS Digital Twin Pipeline](../../simulation/3dgs-digital-twin.md) -> [Neural Scene Reconstruction](../../simulation/neural-scene-reconstruction.md) |
| I need feed-forward initialization or priors | [Feed-Forward 3D Reconstruction and Splatting](../../../10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md) -> [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md) |
| I need math and failure modes | [Volume Rendering, Radiance Fields, and Gaussian Splatting](../../../10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md) -> [Neural Implicit SLAM and Differentiable Mapping](../../../10-knowledge-base/mapping/neural-implicit-slam-differentiable-mapping-first-principles.md) -> [Continuous-Time Trajectory Splines and GP Priors](../../../10-knowledge-base/state-estimation/continuous-time-trajectory-splines-gp-priors.md) |
| I need occupancy or world-model context | [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md) -> [Occupancy Flow and 4D Scenes](../../world-models/occupancy-flow-4d-scenes.md) -> [DrivingGaussian](../../perception/methods/drivinggaussian.md) -> [SplatFlow](../../perception/methods/splatflow.md) |

## SLAM Versus Reconstruction Boundary

SLAM estimates trajectory and map state together. Dynamic Gaussian or radiance-field reconstruction may consume externally estimated poses, object tracks, camera calibrations, LiDAR priors, or dataset annotations and then optimize a renderable scene. That distinction determines whether a method belongs in the SLAM library or in reconstruction/simulation coverage.

Use this split:

| Output | Treat as |
|---|---|
| Real-time pose estimate plus map update loop | SLAM or odometry method |
| Renderable static/dynamic scene from known poses | reconstruction asset |
| RGB/depth/LiDAR novel views | simulator or QA artifact |
| Static-only layer after dynamic removal | map-cleaning candidate requiring validation |
| Occupancy, freespace, or traversability | planner-facing map only after explicit semantic and uncertainty validation |

## City-Scale Constraints

City-scale or airport-scale 4D reconstruction requires more than a good paper implementation.

| Constraint | Why it matters |
|---|---|
| Tiling and level of detail | One monolithic Gaussian scene will not scale to long routes, terminals, or full airport aprons. |
| Pose provenance | Reconstruction quality depends on whether poses came from SLAM, RTK/INS, LiDAR-inertial odometry, or dataset ground truth. |
| Calibration provenance | Camera-LiDAR-IMU errors can become duplicated surfaces, floaters, or dynamic-object ghosts. |
| Dynamic-layer lifecycle | Parked aircraft, parked GSE, cones, chocks, and shadows need policy before they become persistent infrastructure. |
| Held-out-view evaluation | Training-view render quality can hide overfitting and geometry errors. |
| Geometric checks | RGB metrics must be paired with depth, LiDAR, mesh, or survey comparisons. |
| Source-log lineage | Every rendered or edited asset needs route, timestamp, calibration, model, and edit provenance. |

## Airside And AV Deployment Cautions

- Use Gaussian/radiance reconstructions for simulation, visual QA, map cleaning research, and operator-facing digital twins before using them as autonomy authority.
- Keep a conservative multi-sensor localization stack as the pose authority until Gaussian map factors have calibrated health behavior.
- Validate reflective aircraft, wet pavement, glass, night floodlights, heat shimmer, rain, sparse geometry, parked movable objects, and repeated terminal structures separately.
- Separate observed real objects from edited or inserted simulated objects in metadata.
- Pair photoreal scene assets with occupancy/free-space validation when planners consume the output.

## Related Local Pages

- [Gaussian-LIC and Gaussian-LIC2](../slam-methods/gaussian-lic.md)
- [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md)
- [Dynamic 4D Gaussian SLAM](../slam-methods/dynamic-4d-gaussian-slam.md)
- [Feed-Forward 3D Reconstruction and Splatting](../../../10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md)
- [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md)
- [Volume Rendering, Radiance Fields, and Gaussian Splatting](../../../10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md)
- [Neural Implicit SLAM and Differentiable Mapping](../../../10-knowledge-base/mapping/neural-implicit-slam-differentiable-mapping-first-principles.md)
- [DrivingGaussian](../../perception/methods/drivinggaussian.md)
- [SplatFlow](../../perception/methods/splatflow.md)
- [Neural Scene Reconstruction](../../simulation/neural-scene-reconstruction.md)
- [3DGS Digital Twin Pipeline](../../simulation/3dgs-digital-twin.md)
- [Occupancy Flow and 4D Scenes](../../world-models/occupancy-flow-4d-scenes.md)

## Sources

- Gaussian-LIC repository: https://github.com/APRIL-ZJU/Gaussian-LIC
- Gaussian-LIC project page: https://xingxingzuo.github.io/gaussian_lic/
- Gaussian-LIC2 project page: https://xingxingzuo.github.io/gaussian_lic2/
- Street Gaussians: https://arxiv.org/abs/2401.01339
- S3Gaussian: https://arxiv.org/abs/2405.20323
- EmerNeRF ICLR 2024 page: https://proceedings.iclr.cc/paper_files/paper/2024/hash/47fc64d05a394955b1ae2487bfef1ab0-Abstract-Conference.html
- OmniRe: https://arxiv.org/abs/2408.16760
- PVG: https://arxiv.org/abs/2311.18561
- OG-Gaussian: https://arxiv.org/abs/2502.14235
- DrivingGaussian CVPR 2024: https://openaccess.thecvf.com/content/CVPR2024/html/Zhou_DrivingGaussian_Composite_Gaussian_Splatting_for_Surrounding_Dynamic_Autonomous_Driving_Scenes_CVPR_2024_paper.html
- VGGT: https://arxiv.org/abs/2503.11651
- AnySplat: https://arxiv.org/abs/2505.23716
- pixelSplat CVPR 2024: https://cvpr.thecvf.com/virtual/2024/poster/30256
```

- [ ] **Step 3: Verify the hub has the required method names**

Run:

```powershell
rg -n "Street Gaussians|OmniRe|S3Gaussian|EmerNeRF|OG-Gaussian|PVG|DrivingGaussian|Gaussian-LIC2|VGGT|AnySplat|pixelSplat" '30-autonomy-stack\localization-mapping\overview\photoreal-city-scale-4d-reconstruction.md'
```

Expected: at least one match for every method name in the command.

- [ ] **Step 4: Commit the hub page**

Run:

```powershell
git add -- '30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md'
git commit -m "docs: add photoreal 4d reconstruction hub"
```

Expected: a commit is created with only the new hub page.

---

### Task 2: Add The Feed-Forward Reconstruction KB Page

**Files:**
- Create: `10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md`

- [ ] **Step 1: Verify the KB page is not already present**

Run:

```powershell
Test-Path '10-knowledge-base\geometry-3d\feed-forward-3d-reconstruction-and-splatting.md'
```

Expected:

```text
False
```

- [ ] **Step 2: Create the feed-forward KB page**

Create `10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md` with this content:

```markdown
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
```

- [ ] **Step 3: Verify required headings exist**

Run:

```powershell
rg -n "^# Feed-Forward 3D Reconstruction and Splatting|^## What The Model Predicts|^## VGGT-Style Geometry Prediction|^## pixelSplat-Style Image-Pair Gaussian Prediction|^## AnySplat-Style Unconstrained-View Splatting|^## Failure Modes|^## Sources" '10-knowledge-base\geometry-3d\feed-forward-3d-reconstruction-and-splatting.md'
```

Expected: one match for each listed heading.

- [ ] **Step 4: Commit the feed-forward KB page**

Run:

```powershell
git add -- '10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md'
git commit -m "docs: add feed-forward reconstruction foundations"
```

Expected: a commit is created with only the new feed-forward KB page.

---

### Task 3: Add The Dynamic 4D Reconstruction KB Page

**Files:**
- Create: `10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md`

- [ ] **Step 1: Verify the KB page is not already present**

Run:

```powershell
Test-Path '10-knowledge-base\mapping\dynamic-4d-neural-gaussian-reconstruction.md'
```

Expected:

```text
False
```

- [ ] **Step 2: Create the dynamic reconstruction KB page**

Create `10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md` with this content:

```markdown
# Dynamic 4D Neural and Gaussian Reconstruction

Dynamic 4D reconstruction builds a renderable representation of a scene over space and time. In autonomous driving and airside domains, the hard part is not only rendering the background. The hard part is separating persistent infrastructure, parked-but-movable assets, active vehicles, people, shadows, weather artifacts, and dynamic appearance changes.

This page covers the method taxonomy behind photoreal dynamic NeRF and Gaussian reconstruction. It is a mapping and reconstruction foundation page, not a production localization recommendation.

## Related Docs

- [Photoreal City-Scale 4D Reconstruction](../../30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md)
- [Volume Rendering, Radiance Fields, and Gaussian Splatting](../geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md)
- [Neural Implicit SLAM and Differentiable Mapping](neural-implicit-slam-differentiable-mapping-first-principles.md)
- [Feed-Forward 3D Reconstruction and Splatting](../geometry-3d/feed-forward-3d-reconstruction-and-splatting.md)
- [DrivingGaussian](../../30-autonomy-stack/perception/methods/drivinggaussian.md)
- [SplatFlow](../../30-autonomy-stack/perception/methods/splatflow.md)
- [3DGS Digital Twin Pipeline](../../30-autonomy-stack/simulation/3dgs-digital-twin.md)

## Core Representation Problem

Dynamic 4D scenes need at least three concepts:

```text
static layer: infrastructure, road, terminal, poles, markings
dynamic layer: vehicles, aircraft, people, GSE, movable assets
time model: pose, deformation, flow, appearance, illumination, or occupancy change
```

A method can represent these concepts with object-local Gaussians, dynamic neural fields, deformation fields, periodic motion parameters, occupancy-guided point sets, or learned motion-flow fields.

## Method Taxonomy

| Strategy | Methods | Core idea | Main risk |
|---|---|---|---|
| Tracked-object decomposition | Street Gaussians, DrivingGaussian | split static background and tracked foreground actors | depends on object boxes, IDs, and pose quality |
| Full dynamic actor coverage | OmniRe | reconstruct diverse dynamic objects beyond vehicles in a driving log | actor diversity increases segmentation and tracking failure modes |
| Self-supervised decomposition | S3Gaussian, EmerNeRF, SplatFlow | infer static/dynamic split from temporal consistency, fields, flow, or features | can confuse shadows, reflections, ego-motion, and slow movers |
| Unified temporal dynamics | PVG, deformation-field 3DGS | give primitives time-dependent motion instead of hard object splits | motion model can be elegant but physically ambiguous |
| Occupancy-guided reconstruction | OG-Gaussian | use occupancy grids from surround-view cameras to initialize or separate scene elements | inherits occupancy-network errors and camera blind spots |
| LiDAR-supervised simulation reconstruction | SplatAD, GS-LiDAR, LiDAR-GS | render camera/LiDAR/depth from Gaussian scenes | sensor realism still needs calibration, timing, and ray-drop checks |

## Tracked-Object Decomposition

Street Gaussians and DrivingGaussian use an explicit split between static background and dynamic foreground objects.

```text
calibrated cameras + LiDAR/pose + object tracks
  -> static background Gaussians
  -> object-local dynamic Gaussians
  -> compose at timestamp for rendering
```

This is strong for editing and replay because an object can be removed, inserted, or reposed. The cost is reliance on object tracks and IDs. If an aircraft, baggage train, cone cluster, or parked tug is mislabeled, it can end up in the wrong layer.

## OmniRe And Full Dynamic Actor Coverage

OmniRe targets complete dynamic urban reconstruction rather than only vehicle-centric foreground modeling. Its relevance to AV and airside logs is coverage: pedestrians, cyclists, small objects, and non-vehicle actors matter in real scenes.

The implementation question is whether the actor decomposition remains robust when moving objects are numerous, partially observed, slow, stopped, articulated, or visually unusual.

## Self-Supervised Decomposition

S3Gaussian, EmerNeRF, and SplatFlow reduce dependence on explicit 3D boxes or manual dynamic labels.

| Method | Representation | Self-supervised signal |
|---|---|---|
| S3Gaussian | 3D Gaussians plus spatial-temporal field network | 4D consistency separates static and dynamic elements |
| EmerNeRF | static and dynamic neural fields plus induced flow | reconstruction losses and temporal feature aggregation produce emergent decomposition |
| SplatFlow | static 3D Gaussians plus dynamic 4D Gaussians in neural motion flow field | LiDAR motion priors, temporal correspondences, and feature distillation |

Self-supervision is attractive for fleet logs because annotation is expensive. It still needs explicit validation for false-static and false-dynamic errors.

## Unified Temporal Dynamics

PVG, Periodic Vibration Gaussian, models urban dynamics by adding learnable temporal vibration parameters to Gaussian primitives. Static elements can converge toward near-zero motion, while dynamic elements learn time-varying displacement.

This avoids a hard static/dynamic object inventory, but the learned motion may not correspond to physical object state. For simulation and map cleaning, inspect dynamic-only and static-only renderings rather than trusting a single composite render.

## Occupancy-Guided Reconstruction

OG-Gaussian uses occupancy grids generated from surround-view cameras as a substitute or complement for expensive LiDAR and object annotations. The occupancy prior helps separate dynamic vehicles from static street background and initialize reconstruction.

This is relevant when LiDAR coverage is sparse or unavailable. It also couples reconstruction quality to the occupancy network's camera-domain errors, blind spots, and semantic confusion.

## Outputs And Non-Outputs

| Product | Safe interpretation |
|---|---|
| RGB novel views | visual simulation or QA artifact |
| rendered depth | geometry hypothesis requiring depth validation |
| rendered LiDAR | sensor-simulation artifact requiring ray and intensity checks |
| dynamic mask or flow | reconstruction-derived motion evidence, not a certified tracker |
| static-only Gaussian layer | map-cleaning candidate requiring repeated-log validation |
| object-edited scene | counterfactual simulation asset with explicit edit provenance |
| occupancy or freespace | planner-facing only after independent semantic, uncertainty, and safety validation |

## City-Scale And Airside Constraints

- Tile large scenes by route, stand, block, or geographic cell.
- Store source log IDs, calibration IDs, pose source, model version, and edit provenance with every scene.
- Evaluate held-out viewpoints and held-out trajectories separately.
- Check geometry with LiDAR, RTK/INS, survey control, or repeated passes.
- Separate permanent infrastructure, long-parked movable assets, active vehicles, aircraft, personnel, cones, chocks, shadows, weather artifacts, and reflections.
- Never let edited simulation objects contaminate observed-map evidence.

## Sources

- Yan et al., "Street Gaussians: Modeling Dynamic Urban Scenes with Gaussian Splatting." https://arxiv.org/abs/2401.01339
- Zhou et al., "DrivingGaussian: Composite Gaussian Splatting for Surrounding Dynamic Autonomous Driving Scenes." https://openaccess.thecvf.com/content/CVPR2024/html/Zhou_DrivingGaussian_Composite_Gaussian_Splatting_for_Surrounding_Dynamic_Autonomous_Driving_Scenes_CVPR_2024_paper.html
- OmniRe, "Omni Urban Scene Reconstruction." https://arxiv.org/abs/2408.16760
- Huang et al., "S3Gaussian: Self-Supervised Street Gaussians for Autonomous Driving." https://arxiv.org/abs/2405.20323
- Yang et al., "EmerNeRF: Emergent Spatial-Temporal Scene Decomposition via Self-Supervision." https://proceedings.iclr.cc/paper_files/paper/2024/hash/47fc64d05a394955b1ae2487bfef1ab0-Abstract-Conference.html
- Chen et al., "Periodic Vibration Gaussian: Dynamic Urban Scene Reconstruction and Real-time Rendering." https://arxiv.org/abs/2311.18561
- Shen et al., "OG-Gaussian: Occupancy Based Street Gaussians for Autonomous Driving." https://arxiv.org/abs/2502.14235
- Sun et al., "SplatFlow: Self-Supervised Dynamic Gaussian Splatting in Neural Motion Flow Field." https://openaccess.thecvf.com/content/CVPR2025/html/Sun_SplatFlow_Self-Supervised_Dynamic_Gaussian_Splatting_in_Neural_Motion_Flow_Field_CVPR_2025_paper.html
```

- [ ] **Step 3: Verify required method names and headings exist**

Run:

```powershell
rg -n "Street Gaussians|OmniRe|S3Gaussian|EmerNeRF|OG-Gaussian|PVG|DrivingGaussian|SplatFlow|^## Method Taxonomy|^## Outputs And Non-Outputs" '10-knowledge-base\mapping\dynamic-4d-neural-gaussian-reconstruction.md'
```

Expected: matches for every method name and both headings.

- [ ] **Step 4: Commit the dynamic reconstruction KB page**

Run:

```powershell
git add -- '10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md'
git commit -m "docs: add dynamic neural gaussian reconstruction foundations"
```

Expected: a commit is created with only the new dynamic reconstruction KB page.

---

### Task 4: Cross-Link The SLAM Method Pages

**Files:**
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md`

- [ ] **Step 1: Update Gaussian-LIC related docs line**

In `30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md`, replace the existing `Related docs:` paragraph with:

```markdown
Related docs: [Photoreal City-Scale 4D Reconstruction](../overview/photoreal-city-scale-4d-reconstruction.md), [GS-LIVM](gs-livm.md), [GLIM](glim.md), [LIO-SAM](lio-sam.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).
```

- [ ] **Step 2: Add a Gaussian-LIC boundary paragraph**

In `gaussian-lic.md`, after the existing paragraph that ends with `It is still a research mapping stack, not a production AV localizer by itself.`, insert:

```markdown
Within the broader photoreal 4D reconstruction stack, Gaussian-LIC and Gaussian-LIC2 belong on the SLAM side of the boundary because they estimate motion while maintaining a renderable Gaussian map. Street Gaussians, PVG, S3Gaussian, EmerNeRF, OmniRe, OG-Gaussian, and DrivingGaussian are better treated as reconstruction or simulation-support methods unless they include a live pose-estimation loop.
```

- [ ] **Step 3: Update SLAM3R/VGGT related docs line**

In `30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md`, replace the existing `Related docs:` paragraph with:

```markdown
Related docs: [Photoreal City-Scale 4D Reconstruction](../overview/photoreal-city-scale-4d-reconstruction.md), [Feed-Forward 3D Reconstruction and Splatting](../../../10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md), [MASt3R-SLAM](mast3r-slam.md), [DROID-SLAM](droid-slam.md), [DPVO](dpvo.md), [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), [NeRF-SLAM](nerf-slam.md), and [Gaussian SLAM / MonoGS](gs-slam-monogs.md).
```

- [ ] **Step 4: Add feed-forward adjacency paragraph to SLAM3R/VGGT**

In `slam3r-vggt-foundation-slam.md`, after the table that lists `SLAM3R`, `VGGT-SLAM`, `VGGT-SLAM++`, and `ViSTA-SLAM`, insert:

```markdown
Adjacent feed-forward splatting methods such as pixelSplat and AnySplat are relevant because they also predict 3D structure or Gaussian primitives from sparse images. They should be read as reconstruction and initialization relatives, not as SLAM systems, unless wrapped with streaming state, submap management, loop closure, and trajectory optimization.
```

- [ ] **Step 5: Update dynamic 4D Gaussian SLAM related docs line**

In `30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md`, replace the existing `Related docs:` paragraph with:

```markdown
Related docs: [Photoreal City-Scale 4D Reconstruction](../overview/photoreal-city-scale-4d-reconstruction.md), [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md), [WildGS-SLAM](wildgs-slam.md), [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md), [Semantic SLAM](semantic-slam.md), [Splat-SLAM](splat-slam.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).
```

- [ ] **Step 6: Add boundary paragraph to dynamic 4D Gaussian SLAM**

In `dynamic-4d-gaussian-slam.md`, after the paragraph that begins `For AVs and airside autonomy, dynamic Gaussian SLAM is important but early.`, insert:

```markdown
Keep the boundary explicit: dynamic Gaussian SLAM estimates pose while maintaining a time-aware Gaussian map. Dynamic street reconstruction methods such as Street Gaussians, DrivingGaussian, OmniRe, S3Gaussian, PVG, OG-Gaussian, and EmerNeRF usually consume externally estimated poses, tracks, or priors and produce renderable 4D scene assets. They are important adjacent methods, but they should not be counted as SLAM backbones without a live tracking and mapping loop.
```

- [ ] **Step 7: Verify the cross-links are present**

Run:

```powershell
rg -n "Photoreal City-Scale 4D Reconstruction|Feed-Forward 3D Reconstruction and Splatting|Dynamic 4D Neural/Gaussian Reconstruction|AnySplat|pixelSplat|OmniRe|OG-Gaussian" '30-autonomy-stack\localization-mapping\slam-methods\gaussian-lic.md' '30-autonomy-stack\localization-mapping\slam-methods\slam3r-vggt-foundation-slam.md' '30-autonomy-stack\localization-mapping\slam-methods\dynamic-4d-gaussian-slam.md'
```

Expected: each of the three files has at least one match.

- [ ] **Step 8: Commit SLAM cross-links**

Run:

```powershell
git add -- '30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md' '30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md' '30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md'
git commit -m "docs: cross-link gaussian reconstruction slam methods"
```

Expected: a commit is created with only the three SLAM method pages.

---

### Task 5: Update Overview And Index Discovery

**Files:**
- Modify: `30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/overview.md`
- Modify: `10-knowledge-base/geometry-3d/overview.md`
- Modify: `10-knowledge-base/mapping/overview.md`
- Modify: `INDEX.md`
- Modify: `README.md`

- [ ] **Step 1: Add the hub to mapping-and-localization**

In `30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md`, after the `## Table of Contents` block and before `## 1. Map-Free / Map-Lite Autonomous Driving`, insert:

```markdown
## Cross-Section Reading Path

For photoreal 4D reconstruction, Gaussian maps, dynamic neural scene assets, and feed-forward splatting, start with [Photoreal City-Scale 4D Reconstruction](photoreal-city-scale-4d-reconstruction.md). That page separates SLAM pose sources from reconstruction assets and links into the relevant knowledge-base, simulation, perception, and world-model pages.

---
```

- [ ] **Step 2: Add hub link to SLAM overview cross-links**

In `30-autonomy-stack/localization-mapping/slam-methods/overview.md`, find the `Dense/neural scene representations` row in the `Repo Cross-Links` table and replace it with:

```markdown
| Dense/neural scene representations | [Photoreal City-Scale 4D Reconstruction](../overview/photoreal-city-scale-4d-reconstruction.md) and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md) | Connects [Splat-SLAM](splat-slam.md), [S3PO-GS](s3po-gs.md), [Gaussian-LIC](gaussian-lic.md), [GS-LIVM](gs-livm.md), [VIGS-SLAM](vigs-slam.md), [Dynamic 4D Gaussian SLAM](dynamic-4d-gaussian-slam.md), and [RadarSplat-RIO](radarsplat-rio.md) to future dense mapping, semantic map QA, simulation, and photoreal 4D reconstruction. |
```

- [ ] **Step 3: Add feed-forward KB page to geometry overview reading path**

In `10-knowledge-base/geometry-3d/overview.md`, replace the sentence:

```markdown
For learned 3D perception geometry, read [PointPillars](pointpillars.md), [3D Object Detection Losses and Assignment](3d-object-detection-losses-assignment-first-principles.md), and [Point Cloud Segmentation Losses and Metrics](point-cloud-segmentation-losses-metrics-first-principles.md).
```

with:

```markdown
For learned 3D perception and reconstruction geometry, read [PointPillars](pointpillars.md), [3D Object Detection Losses and Assignment](3d-object-detection-losses-assignment-first-principles.md), [Point Cloud Segmentation Losses and Metrics](point-cloud-segmentation-losses-metrics-first-principles.md), and [Feed-Forward 3D Reconstruction and Splatting](feed-forward-3d-reconstruction-and-splatting.md).
```

- [ ] **Step 4: Add feed-forward KB page to geometry overview page list**

In `10-knowledge-base/geometry-3d/overview.md`, under `Point-cloud perception and learned 3D representations:`, add this bullet after `Volume Rendering, Radiance Fields, and Gaussian Splatting`:

```markdown
- [Feed-Forward 3D Reconstruction and Splatting](feed-forward-3d-reconstruction-and-splatting.md)
```

- [ ] **Step 5: Add dynamic 4D KB page to mapping overview reading path**

In `10-knowledge-base/mapping/overview.md`, after the paragraph:

```markdown
For differentiable or neural map updates, read [Neural Implicit SLAM and Differentiable Mapping](neural-implicit-slam-differentiable-mapping-first-principles.md) after the occupancy and representation notes.
```

insert:

```markdown
For photoreal dynamic scene reconstruction, digital twins, and Gaussian or NeRF static/dynamic decomposition, read [Dynamic 4D Neural and Gaussian Reconstruction](dynamic-4d-neural-gaussian-reconstruction.md), then use [Photoreal City-Scale 4D Reconstruction](../../30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md) to connect the foundation to SLAM, simulation, and perception pages.
```

- [ ] **Step 6: Add dynamic 4D KB page to mapping overview page list**

In `10-knowledge-base/mapping/overview.md`, under `## Pages In This Section`, add this bullet before `Neural Implicit SLAM and Differentiable Mapping`:

```markdown
- [Dynamic 4D Neural and Gaussian Reconstruction](dynamic-4d-neural-gaussian-reconstruction.md)
```

- [ ] **Step 7: Add index entries**

In `INDEX.md`, add a row near the existing dynamic Gaussian/neural-field or outdoor Gaussian SLAM entries:

```markdown
| Photoreal city-scale 4D reconstruction | `30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md`, `10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md`, `10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md` | Cross-section hub and first-principles pages for Gaussian-LIC/LIC2, VGGT, AnySplat, pixelSplat, Street Gaussians, OmniRe, S3Gaussian, EmerNeRF, OG-Gaussian, PVG, and DrivingGaussian |
```

If the nearest section is a Markdown table with a different column order, keep the same content but match that table's existing columns exactly.

- [ ] **Step 8: Add README discovery row**

In `README.md`, add one concise row or bullet in the nearest existing cross-section, recent-additions, or navigation section:

```markdown
- [Photoreal city-scale 4D reconstruction](30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md) links Gaussian SLAM, VGGT/feed-forward reconstruction, dynamic 4D Gaussian/NeRF methods, and digital-twin simulation coverage.
```

If the README uses a table instead of bullets in the relevant section, add this as a matching table row while preserving the same link text and summary.

- [ ] **Step 9: Verify overview and index links**

Run:

```powershell
rg -n "photoreal-city-scale-4d-reconstruction|feed-forward-3d-reconstruction-and-splatting|dynamic-4d-neural-gaussian-reconstruction" '30-autonomy-stack\localization-mapping\overview\mapping-and-localization.md' '30-autonomy-stack\localization-mapping\slam-methods\overview.md' '10-knowledge-base\geometry-3d\overview.md' '10-knowledge-base\mapping\overview.md' 'INDEX.md' 'README.md'
```

Expected: matches in all six files.

- [ ] **Step 10: Commit discovery updates**

Run:

```powershell
git add -- '30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md' '30-autonomy-stack/localization-mapping/slam-methods/overview.md' '10-knowledge-base/geometry-3d/overview.md' '10-knowledge-base/mapping/overview.md' 'INDEX.md' 'README.md'
git commit -m "docs: expose photoreal reconstruction reading path"
```

Expected: a commit is created with only the six discovery files.

---

### Task 6: Run Verification And Fix Link Errors

**Files:**
- Modify only files touched in Tasks 1-5 if verification reports a broken link, malformed heading, or navigation issue.

- [ ] **Step 1: Run content and navigation tests**

Run:

```powershell
npm test
```

Expected:

```text
# tests pass with exit code 0
```

- [ ] **Step 2: Run explicit link check**

Run:

```powershell
npm run links:check
```

Expected:

```text
# command exits with code 0
```

- [ ] **Step 3: Run full documentation verification**

Run:

```powershell
npm run verify
```

Expected:

```text
# npm test passes
# priority metadata check passes
# VitePress build exits with code 0
```

- [ ] **Step 4: If verification reports a broken relative link, fix only that link**

Use these known relative-link bases:

```text
From 30-autonomy-stack/localization-mapping/overview/:
  to SLAM methods: ../slam-methods/<file>.md
  to knowledge base: ../../../10-knowledge-base/<section>/<file>.md
  to simulation: ../../simulation/<file>.md
  to perception: ../../perception/<subdir>/<file>.md
  to world models: ../../world-models/<file>.md

From 10-knowledge-base/geometry-3d/:
  to mapping KB: ../mapping/<file>.md
  to 30-autonomy-stack: ../../30-autonomy-stack/<subdir>/<file>.md

From 10-knowledge-base/mapping/:
  to geometry KB: ../geometry-3d/<file>.md
  to 30-autonomy-stack: ../../30-autonomy-stack/<subdir>/<file>.md

From 30-autonomy-stack/localization-mapping/slam-methods/:
  to localization overview: ../overview/<file>.md
  to knowledge base: ../../../10-knowledge-base/<section>/<file>.md
  to perception overview: ../../perception/overview/<file>.md
```

After a link fix, rerun:

```powershell
npm run links:check
```

Expected: exit code 0.

- [ ] **Step 5: Scan for placeholder markers and whitespace errors**

Run:

```powershell
$redFlagPattern = @(
  ('T' + 'BD'),
  ('T' + 'ODO'),
  ('PLACE' + 'HOLDER'),
  ('FIX' + 'ME'),
  '\?\?'
) -join '|'
rg -n $redFlagPattern '30-autonomy-stack\localization-mapping\overview\photoreal-city-scale-4d-reconstruction.md' '10-knowledge-base\geometry-3d\feed-forward-3d-reconstruction-and-splatting.md' '10-knowledge-base\mapping\dynamic-4d-neural-gaussian-reconstruction.md' '30-autonomy-stack\localization-mapping\slam-methods\gaussian-lic.md' '30-autonomy-stack\localization-mapping\slam-methods\slam3r-vggt-foundation-slam.md' '30-autonomy-stack\localization-mapping\slam-methods\dynamic-4d-gaussian-slam.md' '30-autonomy-stack\localization-mapping\overview\mapping-and-localization.md' '30-autonomy-stack\localization-mapping\slam-methods\overview.md' '10-knowledge-base\geometry-3d\overview.md' '10-knowledge-base\mapping\overview.md' 'INDEX.md' 'README.md'
git diff --check
```

Expected:

```text
# rg exits with code 1 because there are no matches
# git diff --check exits with code 0
```

- [ ] **Step 6: Commit verification fixes if any were needed**

If Tasks 6.4 or 6.5 required edits, run:

```powershell
git add -- '30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md' '10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md' '10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md' '30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md' '30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md' '30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md' '30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md' '30-autonomy-stack/localization-mapping/slam-methods/overview.md' '10-knowledge-base/geometry-3d/overview.md' '10-knowledge-base/mapping/overview.md' 'INDEX.md' 'README.md'
git commit -m "docs: fix photoreal reconstruction links"
```

Expected: a commit is created only if verification fixes were needed. If no fixes were needed, skip this step and report that no verification-fix commit was required.

---

## Implementation Notes

- Keep content source-backed. Use the links in the design spec and in each new page's Sources section.
- Do not add priority metadata blocks to the two KB pages or the hub. Priority metadata belongs in method pages that already follow that pattern.
- Do not edit generated `.vitepress` output.
- Do not remove existing content from long simulation or perception pages.
- Keep the tone consistent with the repo: technical, concise, and deployment-aware.

## Self-Review Checklist

Before handing off:

1. The hub names all requested methods: Street Gaussians, OmniRe, S3Gaussian, EmerNeRF, OG-Gaussian, PVG, DrivingGaussian, Gaussian-LIC, Gaussian-LIC2, VGGT, AnySplat, and pixelSplat.
2. The feed-forward KB page explains VGGT, AnySplat, and pixelSplat.
3. The dynamic reconstruction KB page explains Street Gaussians, OmniRe, S3Gaussian, EmerNeRF, OG-Gaussian, PVG, DrivingGaussian, and SplatFlow.
4. Gaussian-LIC/LIC2 remains framed as SLAM; dynamic street reconstruction remains framed as reconstruction unless a live tracking/mapping loop exists.
5. All new public pages are linked from overview or index pages.
6. `npm test`, `npm run links:check`, and `npm run verify` pass.
