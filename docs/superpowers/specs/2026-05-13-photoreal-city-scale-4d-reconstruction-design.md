# Photoreal City-Scale 4D Reconstruction Coverage Design

Date: 2026-05-13
Status: Ready for user review

## Summary

Add a focused coverage layer for photoreal city-scale 4D reconstruction across
the SLAM method library and first-principles knowledge base, with one
cross-section hub that points into existing perception, simulation, and
world-model material.

The repository already covers many pieces of the topic: Gaussian-LIC and
Gaussian-LIC2, SLAM3R/VGGT foundation SLAM, dynamic 4D Gaussian SLAM,
first-wave Gaussian SLAM, volume rendering, neural implicit SLAM,
DrivingGaussian, Street Gaussians, PVG, S3Gaussian, EmerNeRF, and airport
3DGS digital-twin pipelines. The missing artifact is a coherent reader path
that separates SLAM, reconstruction, feed-forward geometry, digital-twin use,
and planner-safe map claims.

## Approved Direction

Use option 3: a cross-section hub plus focused atomic SLAM and knowledge-base
gap fill.

This means:

1. Create one hub that gives a reader the full taxonomy and reading path.
2. Add first-principles KB coverage for feed-forward reconstruction and
   dynamic 4D neural/Gaussian reconstruction.
3. Update existing SLAM pages so Gaussian-LIC/LIC2, SLAM3R/VGGT, and dynamic
   Gaussian SLAM link into the new coverage without duplicating perception or
   simulation pages.
4. Keep reconstruction methods such as Street Gaussians, OmniRe, S3Gaussian,
   EmerNeRF, OG-Gaussian, PVG, and DrivingGaussian framed as scene
   reconstruction or simulation-support methods unless they actually estimate
   pose as SLAM systems.

## Audit Findings

### Existing Strong Coverage

| Topic | Existing coverage |
|---|---|
| Gaussian-LIC and Gaussian-LIC2 | `30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md` |
| SLAM3R, VGGT-SLAM, VGGT-SLAM++ | `30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md` |
| Dynamic 4D Gaussian SLAM | `30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md` |
| First-wave Gaussian SLAM | `gs-slam-monogs.md`, `splatam.md`, `splat-slam.md`, `photo-slam.md` |
| Volume rendering, NeRF, 3DGS fundamentals | `10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md` |
| Neural implicit SLAM foundations | `10-knowledge-base/mapping/neural-implicit-slam-differentiable-mapping-first-principles.md` |
| Continuous-time trajectories | `10-knowledge-base/state-estimation/continuous-time-trajectory-splines-gp-priors.md` |
| Calibration and timing foundations | `10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md`, `rolling-shutter-lidar-deskew-motion-distortion.md` |
| DrivingGaussian | `30-autonomy-stack/perception/methods/drivinggaussian.md` |
| SplatFlow, HUGS, DistillNeRF, SplatAD | `30-autonomy-stack/perception/methods/` and simulation pages |
| Street Gaussians, S3Gaussian, PVG, EmerNeRF | `30-autonomy-stack/simulation/neural-scene-reconstruction.md`, `neural-simulation-platforms.md`, and `30-autonomy-stack/world-models/occupancy-flow-4d-scenes.md` |
| Airport 3DGS digital twin | `30-autonomy-stack/simulation/3dgs-digital-twin.md` |

### Coverage Gaps

1. There is no canonical entry point for photoreal city-scale 4D
   reconstruction.
2. Existing coverage is split across SLAM, perception, simulation,
   world-models, and KB, so readers cannot quickly see which methods are
   SLAM backbones and which are reconstruction assets.
3. OmniRe has no local coverage.
4. AnySplat and pixelSplat have no local coverage.
5. OG-Gaussian is only briefly mentioned and is not discoverable as an
   occupancy-guided street-Gaussian method.
6. Street Gaussians, S3Gaussian, PVG, and EmerNeRF are covered, but mostly in
   long simulation/world-model pages rather than in a compact method taxonomy.
7. Feed-forward reconstruction methods are adjacent to VGGT-SLAM but lack a
   first-principles KB page that explains their role, outputs, and risks.

## Goals

1. Create a hub that answers how SLAM, neural reconstruction, feed-forward
   geometry, and digital-twin methods relate.
2. Make method coverage explicit for Street Gaussians, OmniRe, S3Gaussian,
   EmerNeRF, OG-Gaussian, PVG, DrivingGaussian, VGGT, AnySplat, pixelSplat,
   Gaussian-LIC, and Gaussian-LIC2.
3. Add KB explanations for feed-forward 3D reconstruction and dynamic 4D
   neural/Gaussian reconstruction.
4. Preserve clear boundaries between pose estimation, photoreal rendering,
   metric geometry, occupancy, map cleaning, and simulation.
5. Improve navigation from SLAM method pages into simulation/perception pages
   without duplicating detailed downstream content.
6. Keep the implementation limited to docs and navigation updates.

## Non-Goals

- Do not convert every reconstruction paper into a SLAM method page.
- Do not rewrite the existing airport 3DGS digital-twin report.
- Do not duplicate the DrivingGaussian atomic method page.
- Do not claim Gaussian or radiance maps are planner-safe occupancy maps.
- Do not add numerical benchmark claims unless backed by the target source
  page or paper reference.
- Do not add runtime code, schemas, build tooling, or visual assets in this
  change.

## Page Set

### Cross-Section Hub

Add:

`30-autonomy-stack/localization-mapping/overview/photoreal-city-scale-4d-reconstruction.md`

Purpose:

- Serve as the entry point for photoreal city-scale 4D reconstruction.
- Provide a method coverage matrix.
- Separate SLAM/localization methods from reconstruction and simulation
  methods.
- Provide a reader path into existing SLAM, KB, perception, simulation, and
  world-model pages.

Recommended sections:

1. Executive summary.
2. Method role taxonomy.
3. Coverage matrix for the requested methods.
4. Reading path by intent.
5. SLAM versus reconstruction boundary.
6. City-scale constraints: tiling, LoD, pose provenance, calibration, dynamic
   layers, held-out views, and geometry checks.
7. Deployment cautions for AV and airside use.
8. Related docs and sources.

### Feed-Forward Reconstruction KB Page

Add:

`10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md`

Purpose:

- Explain VGGT, AnySplat, pixelSplat, and related methods as feed-forward
  geometry or Gaussian prediction systems.
- Clarify how predicted camera parameters, depths, pointmaps, point tracks,
  and Gaussians differ from optimization-based SfM, SLAM, NeRF, and 3DGS.
- Explain use as initialization, rapid reconstruction, QA, and learned priors.
- Warn about hallucination, sparse-view ambiguity, scale/projective ambiguity,
  calibration-light failure modes, and weak planner-safety guarantees.

Recommended sections:

1. What feed-forward 3D reconstruction predicts.
2. VGGT-style pointmap and camera-attribute prediction.
3. pixelSplat-style image-pair Gaussian reconstruction.
4. AnySplat-style unconstrained-view feed-forward splatting.
5. Relationship to SLAM and Gaussian mapping.
6. Failure modes and diagnostics.
7. Practical use in AV mapping and city-scale reconstruction.
8. Sources.

### Dynamic 4D Neural/Gaussian Reconstruction KB Page

Add:

`10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md`

Purpose:

- Provide the compact taxonomy that the repo is missing.
- Cover Street Gaussians, OmniRe, S3Gaussian, EmerNeRF, OG-Gaussian, PVG,
  DrivingGaussian, SplatFlow, HUGS, DistillNeRF, and related 4D reconstruction
  methods by modeling strategy.
- Explain static/dynamic decomposition, object-local Gaussians,
  self-supervised decomposition, occupancy-guided initialization,
  deformation/periodic motion, LiDAR supervision, and city-scale partitioning.

Recommended sections:

1. Static scene, dynamic actor, and time-varying appearance layers.
2. Tracked-object decomposition: Street Gaussians and DrivingGaussian.
3. Full dynamic actor coverage: OmniRe.
4. Self-supervised decomposition: S3Gaussian, EmerNeRF, SplatFlow.
5. Unified temporal dynamics: PVG and deformation-field methods.
6. Occupancy-guided reconstruction: OG-Gaussian.
7. Reconstruction outputs versus planner-facing occupancy.
8. City-scale and airside-specific constraints.
9. Sources.

### SLAM Method-Library Updates

Update:

`30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md`

- Add links to the new hub and dynamic reconstruction KB page.
- Preserve its role as the primary Gaussian-LIC/LIC2 page.
- Emphasize Gaussian-LIC2 continuous-time LIC trajectory optimization, dense
  depth completion for LiDAR-blind regions, LiDAR-supervised Gaussian
  optimization, and optional Gaussian-map photometric factors.

Update:

`30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md`

- Add links to the feed-forward reconstruction KB page.
- Keep SLAM-specific content centered on SLAM3R, VGGT-SLAM, VGGT-SLAM++, and
  ViSTA-SLAM.
- Mention AnySplat and pixelSplat as feed-forward reconstruction/splatting
  relatives, not as SLAM systems unless a SLAM wrapper is discussed.

Update:

`30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md`

- Add links to the dynamic reconstruction KB page and hub.
- Clarify that dynamic Gaussian SLAM estimates pose while maintaining a
  time-aware Gaussian map, whereas Street Gaussians, PVG, S3Gaussian,
  EmerNeRF, OmniRe, OG-Gaussian, and DrivingGaussian are better treated as
  offline or simulation-oriented 4D reconstruction methods unless they include
  a live tracking/mapping loop.

### Navigation Updates

Update likely navigation and discovery points:

- `30-autonomy-stack/localization-mapping/overview/overview.md` if present or
  the nearest localization/mapping overview index.
- `30-autonomy-stack/localization-mapping/slam-methods/overview.md`.
- `10-knowledge-base/geometry-3d/overview.md`.
- `10-knowledge-base/mapping/overview.md`.
- `INDEX.md`.
- `README.md` only if the hub is prominent enough for top-level discovery.

The exact link set should follow existing local patterns when implementing.

## Information Architecture

The hub should organize methods by role:

| Role | Methods | Reader guidance |
|---|---|---|
| Metric SLAM with Gaussian maps | Gaussian-LIC, Gaussian-LIC2, GS-LIVM, VIGS-SLAM, Splat-LOAM | Evaluate pose, timing, calibration, and Gaussian map quality separately. |
| Foundation/dense visual SLAM | SLAM3R, VGGT-SLAM, VGGT-SLAM++, MASt3R-SLAM, ViSTA-SLAM | Useful for reconstruction and visual map QA; weak as safety localization without metric constraints. |
| Dynamic street 4D reconstruction | Street Gaussians, DrivingGaussian, OmniRe, S3Gaussian, PVG, OG-Gaussian, EmerNeRF | Treat as digital-twin, simulation, replay, and map-cleaning research unless a SLAM loop is present. |
| Feed-forward splatting/reconstruction | VGGT, AnySplat, pixelSplat, MVSplat-style methods | Useful for priors, initialization, rapid reconstruction, and QA; watch hallucination and metric ambiguity. |
| Supporting first principles | Volume rendering, 3DGS, neural implicit SLAM, continuous-time trajectories, calibration/timing | Use these pages to understand why rendering, geometry, pose, and occupancy are separate claims. |

## Editorial Guardrails

Every new or touched page should preserve these distinctions:

- Photorealism is not metric map correctness.
- Gaussian/radiance maps are not planner-safe occupancy unless free/occupied
  semantics, uncertainty, and validation are explicitly derived.
- Reconstruction quality, pose quality, geometry quality, and closed-loop
  autonomy performance are separate metrics.
- Dynamic-object layers must be versioned separately from persistent static
  infrastructure layers.
- Research benchmark performance is not deployment readiness.
- Feed-forward models can supply useful priors but can hallucinate plausible
  geometry in weakly observed regions.
- City-scale reconstruction requires tiling, level of detail, map provenance,
  calibration provenance, held-out-view evaluation, geometric checks, and
  dynamic-layer lifecycle policy.

## Data Flow

Reader flow:

```text
Hub
  -> SLAM methods when the question is pose/localization
  -> KB pages when the question is representation or failure mode
  -> perception/simulation pages when the question is digital-twin use
  -> world-model pages when the question is occupancy flow or 4D scene use
```

Conceptual reconstruction flow:

```text
calibrated logs and poses
  -> feed-forward or optimized geometry/reconstruction prior
  -> static and dynamic Gaussian/neural scene layers
  -> RGB/depth/LiDAR/flow rendering or inspection products
  -> simulation, map QA, map cleaning, or research evaluation
```

Safety boundary:

```text
renderable 4D scene
  != validated localization map
  != calibrated occupancy grid
  != safety-certified planner world model
```

## Validation Plan

Run the repo's existing verification after implementation:

```powershell
npm test
```

Expected checks:

- Link and navigation tests pass.
- Content smoke tests pass.
- No broken relative links from the new hub or KB pages.
- New pages appear in the relevant overview or index paths.
- No placeholder markers remain in committed docs.

## Sources To Use During Implementation

Primary sources and existing local pages should be preferred.

External source anchors:

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

Local source anchors:

- `30-autonomy-stack/localization-mapping/slam-methods/gaussian-lic.md`
- `30-autonomy-stack/localization-mapping/slam-methods/slam3r-vggt-foundation-slam.md`
- `30-autonomy-stack/localization-mapping/slam-methods/dynamic-4d-gaussian-slam.md`
- `10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md`
- `10-knowledge-base/mapping/neural-implicit-slam-differentiable-mapping-first-principles.md`
- `30-autonomy-stack/perception/methods/drivinggaussian.md`
- `30-autonomy-stack/perception/methods/splatflow.md`
- `30-autonomy-stack/simulation/neural-scene-reconstruction.md`
- `30-autonomy-stack/simulation/neural-simulation-platforms.md`
- `30-autonomy-stack/simulation/3dgs-digital-twin.md`
- `30-autonomy-stack/world-models/occupancy-flow-4d-scenes.md`
