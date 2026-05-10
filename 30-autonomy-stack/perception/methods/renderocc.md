# RenderOcc

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "RenderOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- RenderOcc is a vision-centric 3D occupancy method trained with 2D rendering supervision.
- It reduces dependence on complete 3D occupancy labels by using 2D semantic and depth labels.
- The method was published at ICRA 2024, with an arXiv preprint and official code.
- It extracts a NeRF-style 3D volume representation from multi-view images and renders it back to 2D.
- It is a weakly supervised occupancy training paradigm, not a box detector.

## Core Technical Idea

- Predict a 3D volume from multi-view camera images.
- Interpret the volume as a semantic density field with per-voxel density and semantic logits.
- Use differentiable volume rendering to produce 2D depth and semantic renderings.
- Compare rendered 2D outputs against available 2D depth and semantic labels.
- Introduce auxiliary rays from adjacent frames to improve sparse-view supervision.
- Use sequential frames to provide more rays over objects and reduce viewpoint sparsity.
- The method supervises 3D structure through 2D consistency instead of direct 3D voxel labels.

## Inputs and Outputs

- Inputs: multi-view images, camera intrinsics/extrinsics, and temporal frame poses for auxiliary rays.
- Training labels: 2D semantic labels and depth labels; no dense 3D occupancy labels are required in the core setup.
- Output: 3D semantic occupancy grid inferred from the learned density and semantic field.
- Intermediate output: NeRF-style volume features, densities, and semantic logits.
- Intermediate output: rendered 2D depth and semantic maps used for loss computation.
- It does not output object instances or trajectories unless combined with another module.

## Architecture

- 2D-to-3D network extracts volume features from multi-view image input.
- The official model zoo lists a Swin-Base backbone with BEVStereo as the 2D-to-3D component.
- Density head predicts occupancy-related volume density.
- Semantic head predicts class logits for sampled volume points or voxels.
- Differentiable volume rendering integrates along camera rays to synthesize 2D semantics and depth.
- Auxiliary Ray method samples rays from adjacent frames to increase supervision coverage.
- Weighted or dynamic auxiliary-ray sampling filters misaligned rays and limits training overhead.

## Training and Evaluation

- Benchmarks include nuScenes-derived occupancy settings and comparisons to fully supervised 3D-label methods.
- Metrics include 3D occupancy mIoU as well as rendered 2D semantic/depth losses during training.
- The arXiv paper reports performance comparable to models trained with full 3D labels under its experimental settings.
- Official README model zoo reports RenderOcc Swin-Base with BEVStereo, 12 epochs, 2D supervision, and 24.46 mIoU.
- Training and evaluation commands in the official repo use distributed MMDetection3D-style scripts.
- Evaluation must state whether the model uses only 2D labels, sparse LiDAR, dense voxels, or combined supervision.
- The key benchmark question is label-efficiency versus fully supervised occupancy accuracy.

## Strengths

- Reduces the need for costly and ambiguous dense 3D occupancy annotation.
- Makes use of abundant 2D segmentation and depth supervision pipelines.
- Volume rendering encourages multi-view geometric consistency.
- Auxiliary rays address the sparse camera-view problem common in driving datasets.
- Compatible with strong 2D-to-3D backbones such as BEVStereo.
- Useful for domains where 3D labels lag behind camera data collection.

## Failure Modes

- Quality depends on the accuracy of 2D semantic and depth labels.
- Volume rendering can suffer from depth bleeding and ambiguous density along a ray.
- Auxiliary rays require accurate temporal poses and can be wrong around moving objects.
- Sparse camera viewpoints may still underconstrain occluded 3D space.
- Rendered 2D consistency does not guarantee safety-calibrated 3D occupancy.
- Training can be heavier than direct supervised heads because ray sampling and rendering are added.

## Airside AV Fit

- Relevant for airside because 2D labels are much cheaper than dense 3D voxel labels around stands.
- Auxiliary rays could exploit repeated passes around aircraft stands, gates, and service roads.
- Needs careful dynamic masking for moving aircraft, GSE, people, and shadows.
- 2D depth labels must be reliable on reflective aircraft, wet pavement, glass, and night floodlights.
- Good candidate for weakly supervised pretraining, followed by LiDAR-validated fine-tuning and safety evaluation.
- Do not use rendered consistency alone to certify clearance near wings, engines, tow bars, or jet bridges.

## Implementation Notes

- Separate the supervision contract in configs: 2D-only, LiDAR-sparse, dense-3D, or mixed.
- Calibrate auxiliary ray pose transforms carefully; small temporal errors can create wrong 3D supervision.
- Use motion masks or tracking to avoid supervising dynamic objects as static density.
- Track rendered 2D metrics and 3D occupancy metrics separately; either can improve while the other fails.
- For airside, add depth QA for reflective, low-light, and low-texture apron regions.
- Use conservative uncertainty or visibility masks when consuming RenderOcc outputs in planning.
- Compare against SelfOcc when choosing between self-supervised video and 2D-label rendering supervision.

## Sources

- RenderOcc paper: https://arxiv.org/abs/2309.09502
- Official RenderOcc repository: https://github.com/pmj110119/RenderOcc
- RenderOcc IEEE/ICRA citation in official repo: https://github.com/pmj110119/RenderOcc#bibtex
- BEVStereo paper: https://arxiv.org/abs/2209.10248
