# UniScene Occupancy-Centric Generation

## Summary

UniScene is a CVPR 2025 framework for unified occupancy-centric driving scene generation. Its core move is to stop generating each sensor modality directly from a coarse layout. Instead, it first generates semantic occupancy as a geometry-and-semantics-rich meta scene representation, then uses that occupancy to generate multi-view video and LiDAR.

For autonomous-vehicle and airside work, UniScene matters because it treats occupancy as the shared backbone for synthetic data. That aligns better with planner-facing autonomy than pure image generation: the generated scene has an intermediate 3D representation that can be inspected, edited, and used as annotation.

## Problem

Most driving scene generation methods are single-modality:

- Video generators produce RGB but not metric LiDAR.
- LiDAR generators produce point clouds but not camera evidence.
- Layout-to-video methods depend on coarse BEV maps or boxes and must learn too much in one step.
- Synthetic data often lacks consistent annotations across modalities.

UniScene decomposes the problem:

```text
customized BEV layout
  -> semantic occupancy
  -> multi-view video
  -> LiDAR point clouds
```

The semantic occupancy step becomes the 3D contract that ties modalities together.

## Core Technical Idea

- Generate semantic occupancy first from customized scene layouts.
- Treat generated occupancy as a meta scene representation with geometry and semantics.
- Condition video generation on occupancy via Gaussian-based joint rendering.
- Condition LiDAR generation on occupancy via prior-guided sparse modeling.
- Preserve control by editing the input BEV layout or text prompt.
- Produce multiple data forms and corresponding annotations from one generated scene.

This is occupancy-centric generation rather than video-centric generation. The distinction matters for downstream perception because the synthetic camera and LiDAR are derived from a common 3D scene hypothesis.

## Architecture

### 1. Controllable Occupancy Generation

- Input: BEV layout and noise volume.
- Model: Occupancy Diffusion Transformer.
- Decoder: Occupancy VAE decoder.
- Output: semantic occupancy volume.

The occupancy model can be used for both generation and forecasting settings. In generation mode, it creates scenes from layout conditions. In forecasting mode, it can generate future occupancy conditioned on current or past scene state.

### 2. Occupancy-Based Video Generation

- Convert generated occupancy into 3D Gaussian primitives.
- Render semantic and depth maps from those Gaussians.
- Feed rendered conditions through ControlNet-style encoders.
- Decode with a video VAE or video generation module.
- Use text prompts for appearance attributes such as weather, lighting, and style.

The Gaussian rendering step gives the video generator structured depth and semantic conditions instead of asking it to infer 3D layout from coarse BEV alone.

### 3. Occupancy-Based LiDAR Generation

- Process semantic occupancy with sparse 3D modeling.
- Use geometric prior guidance to decide where LiDAR returns should appear.
- Generate point clouds with a LiDAR head.
- Preserve alignment with the same occupancy scene used for video generation.

This matters because LiDAR should respect visibility, object geometry, and sparsity patterns; it should not be a generic point-cloud texture applied after image generation.

## Inputs and Outputs

Inputs:

- Customized BEV layout.
- Optional text prompts for appearance attributes.
- Camera and LiDAR configuration for generated sensor outputs.
- Training data from nuScenes-style camera, LiDAR, and occupancy annotations.

Outputs:

- Semantic occupancy.
- Multi-view video.
- LiDAR point clouds.
- Generated annotations aligned through the occupancy representation.
- Edited variants from modified layouts.

Non-outputs:

- UniScene is not a closed-loop simulator by itself.
- It does not certify generated scenes as physically valid.
- It does not replace real airside data collection or validation.

## Why Occupancy Helps

Occupancy provides a useful intermediate because it is:

- 3D and metric enough to inspect geometry.
- Semantic enough to condition object and road/scene categories.
- Modality-neutral enough to drive both camera and LiDAR generation.
- Editable at the layout level.
- Closer to planner-facing perception than RGB pixels.

For map hygiene, occupancy can expose problems that pure image generation hides. If a synthetic camera image looks plausible but the occupancy places a vehicle inside a wall or leaves a ghost obstacle in a static lane, the intermediate representation makes that failure easier to catch.

## Training and Evaluation

- The CVPR 2025 paper evaluates occupancy, video, and LiDAR generation.
- It reports performance improvements over prior state-of-the-art methods across those generation tasks.
- It evaluates whether generated multi-modal data improves downstream perception tasks.
- The official project page reports occupancy reconstruction, occupancy generation and forecasting, video generation, LiDAR generation, and support for semantic occupancy prediction models.
- The official repository includes occupancy generation, video generation, LiDAR generation, and data-processing modules.
- The public code release includes pretrained model links for occupancy, LiDAR, and video components.

## Strengths

- Unified camera, LiDAR, and occupancy generation from one scene representation.
- Generated occupancy acts as an annotation layer rather than requiring post-hoc labeling.
- Layout editing gives direct control over object placement and geometry.
- Gaussian-based conditioning helps video generation respect 3D structure.
- Sparse LiDAR modeling better matches point-cloud generation than dense image-style generation.
- Synthetic data can be used for downstream perception augmentation, not just visual demos.

## Failure Modes

- Generated occupancy can still violate physics, traffic rules, or operational constraints if the layout is invalid.
- The method inherits the taxonomy and geometry biases of its training dataset, primarily road-driving data.
- Occupancy resolution may erase small safety-critical objects such as chocks, cones, FOD, tow bars, and low ground equipment.
- Video realism does not guarantee LiDAR realism, and LiDAR realism does not guarantee safe occupancy semantics.
- BEV-layout control is too coarse for many airside details unless the layout schema is expanded.
- Closed-loop behavior, actor intent, and interaction dynamics remain outside the core generation contract.

## Airside AV Fit

UniScene is attractive for airside synthetic data because the airport problem is inherently multi-modal and annotation-hungry.

High-value uses:

- Generate aligned camera, LiDAR, and occupancy examples for rare stand scenarios.
- Create controlled layout edits: misplaced cones, parked baggage carts, blocked service-road crossings, workers near equipment, aircraft pushback zones.
- Pretrain perception models on semantically annotated 3D scenes before enough real airside labels exist.
- Stress-test map hygiene by inserting or removing movable assets and checking whether perception distinguishes infrastructure from transient objects.
- Build scenario libraries where occupancy is the primary source of truth and sensor views are derived evidence.

Required adaptations:

- Replace road BEV layouts with airport stand, taxi-lane, service-road, equipment-staging, and gate layouts.
- Add aircraft geometry and swept-volume constraints.
- Add GSE classes and articulated equipment.
- Add operational zones: under-wing, engine hazard zone, pushback corridor, jet-bridge envelope, service-road crossing.
- Add small-object classes for chocks, cones, dollies, baggage, tools, and FOD.
- Condition on lighting, rain, wet pavement, night floodlights, and aircraft reflectance.

## Simulation and Map Hygiene

Occupancy-centric generation is useful only if the intermediate scene remains inspectable.

For simulation:

- Version every generated occupancy volume and derived sensor render.
- Keep layout edits explicit and machine-readable.
- Export scenario metadata describing which objects were generated, moved, deleted, or reclassified.
- Validate camera and LiDAR outputs against the same generated occupancy.

For map hygiene:

- Use generated occupancy to mark which objects are intended to be static infrastructure and which are movable.
- Do not train map builders on generated scenes where movable objects are labeled as static.
- Use negative examples where dynamic assets are removed from the static layer.
- Audit generated scenes for physically impossible overlaps before using them for perception augmentation.

## Evaluation Checklist for Airside Transfer

- Occupancy class accuracy for aircraft, GSE, people, cones, chocks, FOD, and markings.
- Geometric validity: no object intersections, no floating vehicles, no ground penetration.
- Sensor consistency: camera object position agrees with LiDAR returns and occupancy.
- Small-object retention at final occupancy resolution.
- Dynamic/movable attribute correctness, even for parked objects.
- Appearance slices: day, night, rain, wet pavement, floodlights, shadows, de-icing residue.
- Downstream impact on real airside validation, not only synthetic test sets.
- Failure discovery rate in perception regression tests.

## Implementation Notes

- Start by generating static airport layouts before adding dynamic actors.
- Define an airport occupancy taxonomy before training; retrofitting classes after generation will create inconsistent annotations.
- Use real surveyed maps and stand geometry as layout constraints.
- Keep generated occupancy separate from real map truth in data stores.
- Require generated sensor data to carry provenance, random seed, layout version, model checkpoint, and prompt.
- Use synthetic data for augmentation and stress testing, not as a substitute for real-log validation.

## Relationship to Other Pages

- [Diffusion World Models](diffusion-world-models.md) covers video-centric and diffusion-centric driving generation.
- [Occupancy World Models](occupancy-world-models.md) covers occupancy prediction and world-model families.
- [Synthetic Data Generation](../../50-cloud-fleet/data-platform/synthetic-data-generation.md) covers dataset operations and augmentation.
- [3DGS Digital Twin](../simulation/3dgs-digital-twin.md) covers reconstruction-driven simulation assets.

## Sources

- CVPR 2025 paper page: https://openaccess.thecvf.com/content/CVPR2025/html/Li_UniScene_Unified_Occupancy-centric_Driving_Scene_Generation_CVPR_2025_paper.html
- CVPR 2025 paper PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Li_UniScene_Unified_Occupancy-centric_Driving_Scene_Generation_CVPR_2025_paper.pdf
- Official project page: https://arlo0o.github.io/uniscene/
- Official repository: https://github.com/Arlo0o/UniScene-Unified-Occupancy-centric-Driving-Scene-Generation
- UniScene arXiv: https://arxiv.org/abs/2412.05435
