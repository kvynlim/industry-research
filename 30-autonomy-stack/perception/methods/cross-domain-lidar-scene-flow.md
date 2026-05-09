# Cross-Domain LiDAR Scene Flow

## What It Is

- Cross-domain LiDAR scene flow estimates per-point 3D motion while trying to transfer across sensors, datasets, ranges, and temporal gaps.
- The problem matters because many scene-flow methods perform well only on the dataset and LiDAR configuration they were trained on.
- UniFlow studies zero-shot transfer by training one feedforward model across multiple large-scale autonomous-driving scene-flow datasets.
- SSF targets sparse long-range scene flow where dense feature grids scale poorly.
- VoteFlow adds local rigidity as an architectural bias for self-supervised scene-flow models.
- ICP-Flow is a learning-free rigid-motion baseline that can also generate pseudo labels for faster students.
- This page complements [Neural Scene Flow Priors](neural-scene-flow-priors.md), which is an optimization-time prior rather than a cross-domain feedforward benchmark.

## Core Idea

- Treat motion estimation as a low-level geometric task that may transfer better than semantics or object detection.
- Train on diverse LiDAR datasets when possible instead of assuming one sensor distribution is enough.
- Use sparse 3D backbones for long range so compute does not grow quadratically with spatial extent.
- Add rigid-motion priors because many autonomous-driving objects move as local rigid bodies over short intervals.
- Use learning-free or self-supervised methods to create pseudo labels when target-domain flow labels are missing.
- Evaluate on unseen datasets, sensors, and temporal gaps to expose whether the method learned motion or dataset-specific density.
- Preserve ego-motion compensation and timestamp fidelity because scene flow errors can come from preprocessing rather than the model.

## Inputs and Outputs

- Input: two consecutive or temporally separated LiDAR point clouds.
- Input: ego-motion transform between sweeps and per-point timestamps if the sensor is not globally shuttered.
- Optional input: semantic masks, instance proposals, or ground masks for rigid grouping or evaluation subsets.
- Training input: supervised scene-flow labels, self-supervised reconstruction losses, or pseudo labels from ICP-Flow or NSFP-style teachers.
- Output: per-point 3D scene-flow vectors for the source cloud.
- Optional output: dynamic/static flags derived from ego-motion-compensated flow magnitude.
- Optional output: pseudo-label files for training real-time feedforward students.

## Architecture or Pipeline

- UniFlow uses a feedforward scene-flow model trained jointly on multiple large-scale LiDAR scene-flow datasets with diverse sensor placements and point densities.
- SSF replaces dense feature grids with a sparse-convolution backbone for long-range scalability.
- SSF handles sparse feature-map mismatch between sequential scans by adding virtual voxels at missing locations before feature fusion.
- SSF adds a range-wise metric so far-range points receive appropriate importance.
- VoteFlow introduces a differentiable voting module over discretized translation space to encourage nearby points to share rigid motion.
- VoteFlow operates on pillars for efficiency and can be plugged into existing model designs.
- ICP-Flow segments or associates objects over scans, initializes likely translation with histograms, applies ICP, and recovers scene flow from rigid transforms.

## Training and Evaluation

- UniFlow reports state-of-the-art results on Waymo and nuScenes after cross-dataset training, with reported improvements of 5.1% and 35.2%.
- UniFlow also reports zero-shot gains on unseen TruckScenes and [AevaScenes](aevascenes.md), outperforming prior dataset-specific models by 30.1% and 22.5%.
- SSF reports state-of-the-art results on Argoverse 2 for long-range scene flow and was accepted to ICRA 2025.
- VoteFlow evaluates on Argoverse 2 and Waymo and reports gains over baseline models with marginal compute overhead.
- ICP-Flow reports strong results on Waymo, competitive results on Argoverse 2 and nuScenes, and meaningful flow over longer temporal gaps up to 0.4 s.
- Metrics typically include endpoint error, strict/relaxed accuracy, outlier rate, and dynamic-object subsets.
- Domain-transfer evaluation should always disclose train datasets, test datasets, LiDAR type, range limit, point density, and time gap.

## Strengths

- Cross-dataset training can improve robustness without changing architecture when the task is low-level motion.
- Sparse long-range design makes scene flow more relevant for high-speed and early-warning perception.
- Rigid-motion priors reduce physically implausible pointwise noise on vehicles and equipment.
- Learning-free ICP-style baselines are useful diagnostic tools and pseudo-label generators.
- Scene flow gives planners and trackers motion before stable object identity is available.
- Transfer to AevaScenes suggests relevance to velocity-rich FMCW LiDAR research, though FMCW-specific handling is still separate.

## Failure Modes

- Cross-domain success can still depend on having similar motion distributions, not just similar geometry.
- Very slow motion can fall below dynamic thresholds after ego-motion compensation.
- Sparse far-range objects may have too few points for reliable local rigidity or ICP alignment.
- Occlusion, disocclusion, and newly visible surfaces can be mistaken for motion.
- Rigid assumptions break for articulated objects, pedestrians, baggage trains, and deformable or carried loads.
- Pseudo-label pipelines can reinforce teacher errors if not audited in the target domain.

## Airside AV Fit

- Strong fit as an offline labeling and online motion layer for apron autonomy.
- Cross-domain training is attractive because public road datasets do not include airport-specific actors.
- Long-range flow can help detect approaching buses, tugs, and vehicles across open aprons before object tracks stabilize.
- Local rigidity is useful for tugs, carts, dollies, and trucks, but less reliable for pedestrians and articulated baggage trains.
- Airport datasets should include very slow stand maneuvers, pushback, equipment coupling, and partial occlusions under wings.
- Scene flow should feed occupancy and tracking modules rather than replace object classification or safety-zone logic.

## Implementation Notes

- Store ego-motion transforms, point timestamps, and LiDAR model metadata with every scene-flow sample.
- Use [Neural Scene Flow Priors](neural-scene-flow-priors.md) or ICP-Flow as pseudo-label baselines before hand-labeling a full airside dataset.
- Evaluate separately by range band; long-range improvements can disappear in aggregate metrics.
- Keep dynamic thresholds below road defaults for slow aircraft-stand motion.
- Test cross-domain models on the target LiDAR before assuming robustness from Waymo, nuScenes, or Argoverse results.
- Preserve velocity fields when using [AevaScenes](aevascenes.md) or FMCW LiDAR so flow models can later exploit direct radial velocity.
- Add visual audits for false motion on static aircraft, jet bridges, fences, and reflective ground equipment.

## Sources

- UniFlow arXiv paper: https://arxiv.org/abs/2511.18254
- SSF arXiv paper: https://arxiv.org/abs/2501.17821
- VoteFlow arXiv paper: https://arxiv.org/abs/2503.22328
- ICP-Flow arXiv paper: https://arxiv.org/abs/2402.17351
- Argoverse 2 scene-flow task: https://argoverse.github.io/user-guide/tasks/3d_scene_flow.html
- AevaScenes method page: [AevaScenes](aevascenes.md)
- Neural Scene Flow Priors method page: [Neural Scene Flow Priors](neural-scene-flow-priors.md)
