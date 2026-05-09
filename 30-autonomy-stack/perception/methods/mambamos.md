# MambaMOS

## What It Is

- MambaMOS is an ACM MM 2024 LiDAR moving object segmentation method.
- It predicts point-wise moving/static labels using previous-scan motion information and a motion-aware state space model.
- It targets the weak temporal-spatial coupling seen in earlier LiDAR MOS methods.
- It is in the same dynamic mask family as [LiDAR-MOS](lidar-mos.md), [4DMOS](4dmos.md), [InsMOS](insmos.md), and [StreamMOS](streammos.md).
- Compared with occupancy forecasting methods such as [StreamingFlow](streamingflow.md), MambaMOS is a current-frame segmentation method rather than a future occupancy predictor.

## Core Idea

- Treat temporal clues as first-class inputs rather than simply concatenating timestamps or residual features.
- Use Time Clue Bootstrapping Embedding to strengthen the coupling between temporal and spatial point features.
- Use a Motion-aware State Space Model to model temporal correlations for the same object across time.
- State space modeling gives a sequence-style mechanism for point-cloud temporal reasoning without relying on quadratic self-attention over every point.
- The output remains a binary moving/static mask, so it can directly support dynamic point removal and static map cleanup.

## Inputs/Outputs

- Input: current and previous LiDAR scans with scan order and timestamp information.
- Input: ego-motion alignment or pose information so temporal changes are not dominated by the ego vehicle.
- Input: SemanticKITTI-format point clouds and labels for the public training recipe.
- Output: per-point moving/static logits or labels for the current scan.
- Output: dynamic mask for removing ghosting objects from maps.
- Output: static mask for retaining background points or isolating dynamic actors by subtraction.

## Pipeline

- Prepare a temporal LiDAR sequence in the SemanticKITTI-style directory layout.
- Build point features that preserve both spatial coordinates and temporal clues.
- Apply Time Clue Bootstrapping Embedding to emphasize motion-relevant temporal information.
- Run Motion-aware State Space Model blocks to couple temporal and spatial features.
- Decode point-wise moving/static predictions.
- Threshold and optionally smooth predictions before map filtering, tracking, or occupancy updates.

## Evaluation

- Primary benchmarks: SemanticKITTI-MOS and KITTI-Road.
- The paper reports state-of-the-art performance on those benchmarks at publication time.
- The public repository provides training and testing scripts based on a Pointcept-style codebase and SemanticKITTI splits.
- Main metrics are point-level moving/static segmentation scores, especially moving IoU.
- For airside transfer, evaluate slow-motion recall, static-map over-removal, and temporal consistency on apron clips.
- Compare against [4DMOS](4dmos.md) and [StreamMOS](streammos.md) to separate model-quality gains from windowing or memory gains.

## Strengths

- Explicitly addresses temporal-spatial coupling, a core limitation of many earlier MOS designs.
- Point-cloud-native processing avoids some range-view projection loss.
- State space modeling is attractive for long temporal contexts where attention cost is a concern.
- Public code and pretrained-model references lower reproduction cost.
- Binary output is simple to integrate with static map builders and dynamic obstacle filters.
- Strong candidate when a stack already supports CUDA point-cloud networks.

## Failure Modes

- The CUDA and Mamba/Pointcept dependency stack is more complex than a simple range-view CNN.
- State space modeling can preserve misleading temporal structure if poses, timestamps, or scan order are wrong.
- A model trained on road data can under-represent aircraft, GSE geometry, cones, FOD, and pedestrians near aircraft gear.
- Very slow movement, stop/start events, and towing operations may not match SemanticKITTI motion priors.
- It is not a full tracker; one-frame masks can still flicker without external temporal filtering.
- Strong moving/static IoU does not automatically prove safe use for occupancy clearing or localization map updates.

## Airside fit

- Good research candidate for higher-quality LiDAR dynamic masks once an airside MOS dataset exists.
- Useful for removing moving GSE and personnel points before static map fusion.
- Needs low-speed threshold tuning because apron actors often move much more slowly than road vehicles.
- Validate with aircraft pushback, tug coupling, belt-loader alignment, buses crossing stands, and ground crew walking behind occlusions.
- Keep a simpler fallback such as [LiDAR-MOS](lidar-mos.md) or [MotionSeg3D](motionseg3d.md) during early integration because MambaMOS has a heavier runtime stack.
- Fuse with radar Doppler or tracker evidence before using the mask as a hard planner signal.

## Sources

- MambaMOS arXiv: https://arxiv.org/abs/2404.12794
- OpenReview page: https://openreview.net/forum?id=oo7PyBieWB
- OpenReview PDF: https://openreview.net/pdf?id=oo7PyBieWB
- Official repository: https://github.com/Terminal-K/MambaMOS
- LiDAR-MOS lineage paper: https://arxiv.org/abs/2105.08971
- SemanticKITTI: https://semantic-kitti.org/index
