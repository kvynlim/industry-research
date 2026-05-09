# Self-Supervised Occupancy Flow

## Summary

Self-supervised occupancy flow is the research line that trains 3D occupancy and motion prediction without dense 3D occupancy-flow labels. The immediate motivation is simple: static occupancy tells a planner where matter is now, while occupancy flow estimates how occupied space moves. Dense 3D labels for that joint problem are expensive on road datasets and largely nonexistent for airport airside operations.

This page focuses on Let Occ Flow and SelfOccFlow because they directly address the missing annotation path. It does not duplicate the broader [Occupancy Flow and 4D Scene Understanding](occupancy-flow-4d-scenes.md) survey, LiDAR-native world models, or radar-native world models. The practical question here is narrower: can a fleet learn dynamic occupancy and static/dynamic decomposition from synchronized sensor logs, 2D cues, rendering losses, and temporal consistency rather than manually labeled 3D flow?

## What Problem It Solves

- Planner-facing systems need occupied, free, unknown, and moving-space estimates.
- Static occupancy misses imminent conflicts such as a baggage tractor crossing a route or an aircraft tail sweeping during pushback.
- Supervised occupancy-flow labels require dense 3D occupancy, semantic labels, and per-voxel motion, which are costly and ambiguous.
- Camera-only methods can collect data cheaply but need a way to lift 2D cues into 3D.
- New domains such as airside autonomy lack dense labels for aircraft, GSE, personnel, chocks, cones, dollies, FOD, and ground markings.

## Core Representations

Occupancy flow extends a 3D occupancy field with motion:

```text
O(x, y, z, t) -> occupied / free / unknown
F(x, y, z, t) -> velocity or displacement of occupied matter
```

Self-supervised approaches usually add a differentiable rendering contract:

```text
3D field -> render depth / semantics / optical flow / RGB-related signals
rendered signal -> compare with 2D or temporal cues
```

The method learns a 3D representation because only the right 3D geometry and motion can explain multi-view, multi-frame observations.

## Let Occ Flow

Let Occ Flow is a CoRL 2024 / PMLR 2025 method for self-supervised joint 3D occupancy and occupancy-flow prediction from camera inputs.

Its main design:

- Use TPV, or tri-perspective view, as the unified 3D scene representation.
- Aggregate multi-view image features with deformable attention.
- Fuse temporal features with BEV-based backward-forward attention to capture dynamic object dependencies.
- Refine the volume with a 3D refine module for fine-grained geometry.
- Decode separate volumetric signed-distance and flow fields with MLPs.
- Extend differentiable rendering from static occupancy to 3D volumetric flow fields.
- Use reprojection consistency, zero-shot 2D segmentation, optical-flow cues, and optional LiDAR ray supervision.

The key static/dynamic idea is that 2D optical flow and segmentation cues can supervise dynamic decomposition without 3D dynamic labels. That makes the method attractive for fleets that can collect video, poses, and occasional LiDAR but cannot label every moving object in 3D.

## SelfOccFlow

SelfOccFlow is a 2026 IEEE Robotics and Automation Letters method for end-to-end self-supervised 3D occupancy-flow prediction.

Its main design:

- Estimate both 3D occupancy and motion around the vehicle.
- Avoid human-produced annotations, external flow supervision, velocity labels from boxes, and pretrained optical-flow dependency.
- Disentangle the scene into separate static and dynamic signed-distance fields.
- Learn motion implicitly through temporal aggregation.
- Add a self-supervised flow cue from feature cosine similarities.
- Evaluate on SemanticKITTI, KITTI-MOT, and nuScenes.

The separate static and dynamic SDFs are especially important for map hygiene. Static surfaces should anchor the permanent world; dynamic surfaces should explain actors that move and should not pollute static maps.

## Training Signals

Self-supervised occupancy-flow methods combine several weak signals:

- Multi-view geometric consistency from calibrated cameras.
- Temporal consistency from adjacent frames.
- Differentiable rendering of depth, semantics, or flow-like projections.
- 2D segmentation from zero-shot or foundation models.
- Optical flow in Let Occ Flow, when used as a 2D dynamic cue.
- Feature-similarity motion cues in SelfOccFlow.
- Optional LiDAR ray supervision to constrain free space and occupied endpoints.
- Smoothness, sparsity, and SDF regularization to avoid degenerate volumes.

For airside use, the best recipe is mixed supervision: camera self-supervision for scale, LiDAR rays for metric geometry, and small human audits for safety-critical classes.

## Static/Dynamic Decomposition and Map Hygiene

The main operational value is separating permanent structure from transient occupied space.

Useful static layer:

- Stand markings.
- Curbs and islands.
- Terminal walls.
- Fixed poles and signs.
- Gate-side barriers.
- Permanent equipment storage boundaries.

Dynamic or movable layer:

- Aircraft during pushback or taxi.
- Baggage tractors and cart trains.
- Belt loaders, loaders, fuel trucks, buses, catering trucks.
- Ground crew and pedestrians.
- Cones, chocks, temporary barricades, bags, and tools.
- Parked GSE that may remain for long periods but should not become infrastructure.

The hard case is stopped movable equipment. A self-supervised method may see a belt loader parked for an entire clip and classify it as static. Airside map hygiene therefore needs repeated-day evidence, operations metadata, and explicit "movable even if stopped" class handling.

## AV and Airside Transfer

Self-supervised occupancy flow transfers well in principle because it reduces label dependence, but airside transfer is not automatic.

Promising transfer:

- Repeated routes around stands provide many self-supervised camera rays.
- LiDAR-equipped vehicles can supply free-space and endpoint constraints without dense labels.
- Slow-moving airside traffic gives longer temporal context for flow learning.
- Static/dynamic decomposition directly supports clean map generation.

Transfer risks:

- Road-trained priors underrepresent aircraft geometry and under-wing occlusion.
- Optical flow can fail under floodlights, reflective fuselage, wet pavement, rain, de-icing spray, and shadows.
- Camera-only supervision struggles with black tires, glass, jet bridges, and thin tow bars.
- Slow stop-start motion makes dynamic objects look static.
- Personnel and FOD are small but safety-critical, so high mIoU on road classes is not enough.

## Deployment Pattern

A practical airside stack should not consume self-supervised occupancy flow as a sole obstacle source. A safer pattern is:

1. Train with large unlabeled camera/LiDAR logs using self-supervised rendering and temporal losses.
2. Validate geometry against held-out LiDAR, surveyed maps, and sparse human 3D labels.
3. Export planner-facing grids with separate channels for occupied, free, unknown, static, dynamic, stale, and inferred.
4. Fuse with production LiDAR/radar occupancy and explicit object tracks.
5. Use the flow output as a predictive prior and confidence signal, not as hard safety truth.
6. Use static/dynamic decomposition offline to clean maps and simulation assets.

## Evaluation Checklist

- Occupancy IoU and mIoU on available road benchmarks.
- Flow endpoint error or voxel displacement error where labels exist.
- Dynamic/static decomposition precision and recall.
- False-static rate for movable objects.
- False-dynamic rate for permanent infrastructure.
- Clearing time after a dynamic object moves away.
- Persistence under occlusion.
- Calibration sensitivity under camera/LiDAR timing error.
- Airside slices for night, rain, wet pavement, reflective aircraft, under-wing areas, crowded stands, and long parked equipment.
- Planner-facing impact: collision prediction, unnecessary stop rate, route blockage forecast accuracy, and stale-obstacle behavior.

## Implementation Notes

- Keep observed, inferred, and stale occupancy separate in any planner API.
- Use confidence decay for carried temporal state; old occupancy cannot remain authoritative indefinitely.
- Do not let unlabeled self-supervised training replace independent validation.
- Treat 2D foundation-model labels as weak labels with versioned provenance.
- Mask or separately model rain, spray, and shadows so they do not become dynamic obstacles.
- Use repeated-day logs to decide whether a voxel belongs to static infrastructure or movable equipment.
- For airside, define metrics by zone: stand centerline, under-wing, service road, equipment staging area, jet-bridge envelope, and aircraft pushback corridor.

## Relationship to Other Pages

- [Occupancy Flow and 4D Scene Understanding](occupancy-flow-4d-scenes.md) covers the wider field including scene flow, UnO, and planner integration.
- [Occupancy World Models](occupancy-world-models.md) covers broader occupancy prediction and generation models.
- [Scene Flow for Dynamic Object Removal](scene-flow-for-dynamic-object-removal.md) covers point-level motion and map cleaning.
- [SelfOcc](../perception/methods/selfocc.md) and [RenderOcc](../perception/methods/renderocc.md) cover related self-supervised occupancy without the same flow emphasis.

## Sources

- Let Occ Flow PMLR page: https://proceedings.mlr.press/v270/liu25e.html
- Let Occ Flow project page: https://eliliu2233.github.io/letoccflow/
- Let Occ Flow arXiv: https://arxiv.org/abs/2407.07587
- Let Occ Flow official repository: https://github.com/eliliu2233/occ-flow
- SelfOccFlow arXiv: https://arxiv.org/abs/2602.23894
- SelfOccFlow IEEE RA-L DOI: https://doi.org/10.1109/LRA.2026.3665447
- SelfOcc: https://arxiv.org/abs/2311.12754
- RenderOcc: https://arxiv.org/abs/2309.09502
