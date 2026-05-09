# Neural Scene Flow Priors

## What It Is

- Neural Scene Flow Prior is a NeurIPS 2021 scene-flow method for estimating 3D motion between point clouds.
- It does not train a feedforward model offline; it optimizes a coordinate MLP at runtime for each point-cloud pair.
- The learned function maps 3D point coordinates to 3D flow vectors.
- It is most useful as an offline teacher, pseudo-label generator, or diagnostic baseline for dynamic/static point removal.
- It complements MOS methods such as [LiDAR-MOS](lidar-mos.md), [4DMOS](4dmos.md), [InsMOS](insmos.md), and [StreamMOS](streammos.md), and can feed downstream occupancy-flow systems such as [StreamingFlow](streamingflow.md).

## Core Idea

- A randomly initialized MLP acts as an implicit smoothness prior over the scene flow field.
- Runtime optimization warps the source cloud toward the target cloud using the MLP-predicted flow.
- A reverse flow and cycle-consistency term discourage degenerate one-way correspondences.
- The continuous MLP representation can be sampled at any point, giving dense motion estimates even when the input clouds are sparse.
- After ego-motion removal, flow magnitude and consistency can be converted into moving/static masks.
- ZeroFlow later uses this kind of slow label-free optimization as a teacher for fast scene-flow distillation.

## Inputs/Outputs

- Input: two consecutive LiDAR point clouds, or a sequence handled as consecutive pairs.
- Input: ego-motion transform between sweeps.
- Input: optimizer settings, loss thresholds, and optional masks for ground or evaluation subsets.
- Output: per-point 3D scene flow vectors for the first cloud.
- Output: warped source cloud for alignment diagnostics.
- Output: dynamic/static labels if flow magnitude is thresholded after ego-motion compensation.
- Output: pseudo-labels for training faster students such as ZeroFlow-style feedforward networks.

## Pipeline

- Ego-motion-compensate the source and target clouds.
- Initialize forward and backward coordinate MLPs.
- Predict flow from source points and warp the source cloud.
- Minimize a cloud-matching loss, commonly Chamfer-style, between warped source and target.
- Add reverse-flow or cycle-consistency regularization to stabilize sparse and ambiguous regions.
- Export per-point flow vectors.
- Convert flow to a dynamic mask by thresholding residual motion, then use that mask for dynamic object removal or actor isolation.

## Evaluation

- NSFP is evaluated as a scene-flow method, not as a native MOS classifier.
- Metrics usually include endpoint error, strict/relaxed accuracy, and outlier rate on scene-flow benchmarks.
- Argoverse 2 defines 3D scene flow between successive 0.1 s LiDAR sweeps and includes an `is_dynamic` submission field.
- In Argoverse 2, a point is considered dynamic when the ego-motion-removed ground-truth flow norm is greater than 0.05 m.
- For removal tasks, add map-quality metrics: ghost artifacts removed, static structure retained, and dynamic points incorrectly fused into the map.
- Runtime matters: the original optimization is far too slow for online autonomy, but useful for offline labeling and benchmark diagnosis.

## Strengths

- Needs no human flow labels and no domain-specific training set.
- Robust starting point for new domains where road-trained MOS labels are missing.
- Produces continuous flow fields rather than only discrete class labels.
- Good teacher for distillation pipelines such as ZeroFlow.
- Useful for auditing whether a learned MOS model is missing low-speed or unusual motion.
- Can generate pseudo-labels for both dynamic removal and static-background removal workflows.

## Failure Modes

- Runtime optimization can take seconds to tens of seconds per pair on large point clouds.
- Chamfer-style matching can choose wrong correspondences in occlusion, repeated structure, or sparse far-range regions.
- It does not understand object class, instance identity, or operational intent.
- Thresholding flow into dynamic/static labels is sensitive to ego-motion error and scan timing.
- Static objects that are newly visible can look like motion; moving objects with little observed displacement can look static.
- It is an offline tool unless replaced by a distilled or otherwise accelerated student model.

## Airside fit

- Strong fit as an offline teacher for airport-apron scene-flow and MOS pseudo-label generation.
- Can bootstrap labels for tugs, carts, dollies, buses, pedestrians, aircraft pushback, and other actors without first building a full hand-labeled flow dataset.
- Needs careful thresholds below road-driving speeds; 0.05 m per 0.1 s corresponds to 0.5 m/s, which may miss very slow stand maneuvers.
- Use it to train or validate faster students, then deploy the student rather than NSFP itself.
- Inspect failure cases around aircraft geometry, jet bridges, reflective surfaces, and partial occlusion under wings.
- Pair generated labels with human review before using them in a safety case.

## Sources

- Correct NSFP paper: https://arxiv.org/abs/2111.01253
- NSFP project page and code link: https://lilac-lee.github.io/Neural_Scene_Flow_Prior/
- ZeroFlow paper: https://arxiv.org/abs/2305.10424
- ZeroFlow project page: https://vedder.io/zeroflow.html
- Argoverse 2 scene-flow task: https://argoverse.github.io/user-guide/tasks/3d_scene_flow.html
- Note: https://arxiv.org/abs/2111.13680 resolves to GMFlow optical flow, not Neural Scene Flow Prior.
