# MotionSeg3D

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "mapping", "validation", "road-av"]
  reason: "MotionSeg3D is rated for motion segmentation, scene flow, or dynamic-object perception workflows."
method-priority:end -->

## What It Is

- MotionSeg3D is the IROS 2022 method "Efficient Spatial-Temporal Information Fusion for LiDAR-Based 3D Moving Object Segmentation."
- It predicts point-wise moving/static labels for the current LiDAR scan.
- The method sits in the same moving-object segmentation lineage as [LiDAR-MOS](lidar-mos.md), but adds stronger spatial-temporal fusion and point-level refinement.
- It is a practical dynamic object removal method: remove points predicted as moving before static mapping, localization map updates, or occupancy fusion.
- It complements later temporal methods such as [4DMOS](4dmos.md), [InsMOS](insmos.md), [StreamMOS](streammos.md), and flow/forecasting methods such as [StreamingFlow](streamingflow.md).

## Core Idea

- Use two range-image branches instead of one mixed input branch.
- The appearance branch encodes the current LiDAR range image.
- The motion branch encodes residual images generated from previous ego-motion-compensated scans.
- Motion-guided attention fuses the branches so temporal evidence can emphasize the parts of the current scan that are actually moving.
- A point refinement head back-projects range-view features to 3D points and uses sparse convolution to clean object borders.
- The design is coarse-to-fine: fast range-view segmentation first, point-space correction second.

## Inputs/Outputs

- Input: sequential rotating-LiDAR scans.
- Input: calibration, poses, or ego-motion estimates used to align previous scans to the current scan.
- Input: residual range images generated from current and past scans.
- Training input: SemanticKITTI-MOS labels and the authors' KITTI-Road-MOS labels.
- Output: per-point moving/static logits or labels for the current scan.
- Output: dynamic mask for removing moving objects, or static mask for preserving map-quality points.

## Pipeline

- Align recent scans into the current frame and generate temporal residual images.
- Project the current scan into a range image.
- Encode current appearance and temporal residual cues with separate branches.
- Fuse multi-scale features through motion-guided attention.
- Decode a range-view moving/static prediction.
- Back-project features and predictions to 3D points.
- Refine point labels with the point head, then threshold confidence for downstream removal.

## Evaluation

- Primary benchmark: SemanticKITTI-MOS.
- Additional training/evaluation data: KITTI-Road-MOS labels released with the MotionSeg3D codebase.
- Main metric: point-level moving-object IoU, usually reported with static/moving IoU and mIoU-style summaries.
- The paper reports online operation at sensor frame rate.
- For airside use, evaluate both MOS metrics and map effects: ghost removal, loss of static structure, and false static points left in the map.
- Compare against [LiDAR-MOS](lidar-mos.md) for a range-view baseline and [4DMOS](4dmos.md) for a 4D sparse-convolution baseline on the same clips.

## Strengths

- Improves over simple residual concatenation by explicitly separating appearance and motion branches.
- Keeps the fast range-view backbone style used by mature LiDAR segmentation stacks.
- Point-space refinement reduces boundary artifacts from range projection.
- Public code, pretrained-style workflows, and KITTI-Road-MOS labels make reproduction practical.
- Does not need object boxes or semantic instance IDs at inference time.
- Easier to deploy than heavier stateful or full 4D models when the vehicle already runs range-image LiDAR perception.

## Failure Modes

- Residual images are only as good as ego-motion compensation, timestamp alignment, and scan de-skewing.
- Very slow apron motion can fall below the learned residual pattern and be labeled static.
- Range projection can lose detail for multi-LiDAR rigs, non-repetitive solid-state LiDAR, and unusual vertical fields of view.
- The point refinement head improves borders but does not solve occlusion or sparse far-range actors.
- Training on road datasets can bias the model away from aircraft, belt loaders, dollies, cones, and crouched personnel.
- False positives can over-remove static map structure around curbs, stand markings, jet bridges, and parked equipment.

## Airside fit

- Good first upgrade beyond [LiDAR-MOS](lidar-mos.md) for LiDAR-only dynamic object removal on airport aprons.
- Particularly useful for cleaning SLAM or localization maps when tugs, baggage carts, buses, and ground crew pass through repeated survey routes.
- Needs airport-specific validation at 1-5 km/h and for stop/start behavior near aircraft stands.
- Multi-LiDAR vehicles should test per-sensor inference plus late fusion before forcing all sensors into one synthetic range image.
- Use conservative removal thresholds for online safety; a false static moving object is worse than losing some static map density.
- Pair with radar Doppler, object tracking, or [StreamMOS](streammos.md)-style temporal memory before using the output as a safety-critical dynamic declaration.

## Sources

- MotionSeg3D paper: https://arxiv.org/abs/2207.02201
- MotionSeg3D project page: https://npucvr.github.io/MotionSeg3D/
- Official repository: https://github.com/haomo-ai/MotionSeg3D
- LiDAR-MOS lineage paper: https://arxiv.org/abs/2105.08971
- SemanticKITTI: https://semantic-kitti.org/index
