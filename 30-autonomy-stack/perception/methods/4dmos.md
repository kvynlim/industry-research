# 4DMOS

## What It Is

- 4DMOS is PRBonn's sparse-convolution method for receding moving object segmentation in 3D LiDAR data.
- It predicts moving-object confidence for LiDAR points using a temporal 4D point representation.
- The method targets online MOS while allowing predictions to be refined as later scans arrive.
- It is geometry-driven and does not depend on semantic class labels at inference time.
- The public implementation is designed around a receding window of aligned scans.
- It is a stronger temporal MOS reference than single-frame or range-image residual baselines.

## Core Technical Idea

- Aggregate several aligned LiDAR scans into a sparse 4D point cloud over x, y, z, and time.
- Voxelize the receding temporal window and run sparse 4D convolutions.
- Extract spatial and temporal features jointly rather than projecting them to range images.
- Predict moving-object scores for points in the sequence.
- Use a receding horizon so online predictions can be updated with new observations.
- Integrate repeated predictions for a scan through a binary Bayes filter for robustness.

## Inputs and Outputs

- Input: a sequence of LiDAR point clouds.
- Input: ego poses or scan alignment to place scans in a common frame.
- Input: a receding temporal window whose length controls latency and temporal evidence.
- Output: per-point moving-object confidence or binary moving/static label.
- Output: cleaned static point cloud when dynamic points are removed.
- Optional output in the repo: visualization and evaluation artifacts for supported datasets.

## Architecture or Dataset/Pipeline

- The implementation uses MinkowskiEngine sparse 4D convolutions.
- The updated repository aligns scans internally with KISS-ICP for broad point-cloud format support.
- The pipeline accepts common formats including bin, pcd, ply, xyz, and rosbags.
- Supported evaluation loaders include SemanticKITTI, nuScenes, HeLiMOS, labeled KITTI Tracking sequence 19, and Apollo sequences.
- Original paper results are preserved in the tagged release noted by the authors.
- The model is LiDAR-only and focuses on geometric motion cues.

## Training and Evaluation

- The paper evaluates on the SemanticKITTI moving object segmentation challenge.
- It reports more accurate predictions than earlier methods on SemanticKITTI MOS.
- It also evaluates generalization on Apollo, highlighting that the geometry-only design transfers across environments.
- Training requires cached temporal samples from aligned scan sequences.
- Metrics are point-level MOS measures, especially moving-class IoU and combined mIoU.
- Runtime depends on window size, voxel resolution, sparse tensor occupancy, and GPU support.

## Strengths

- 4D sparse convolution keeps temporal geometry explicit.
- Receding prediction can improve a scan after additional evidence appears.
- Does not require object boxes, semantic labels, or camera data at inference time.
- Public code is actively usable and supports multiple point-cloud formats.
- Geometry-only design is attractive for unusual domains where semantic classes differ from road datasets.
- Cleaner dynamic masks can directly benefit localization and mapping.

## Failure Modes

- Receding windows introduce latency or delayed confidence for newly moving objects.
- Bayes filtering can retain stale beliefs after abrupt stop/start events.
- Incorrect ego-motion alignment can create false dynamic structure.
- Sparse far-range objects may not generate enough temporal evidence.
- Slow airport vehicles can fall below the motion signal learned from road datasets.
- Heavy dependence on MinkowskiEngine and CUDA makes embedded deployment non-trivial.

## Airside AV Fit

- Strong candidate for LiDAR-only airside map maintenance and dynamic-object masking.
- Better than range residuals when multiple LiDARs can be fused into a common 4D voxel frame.
- Useful for detecting tugs, baggage carts, dollies, and service vehicles that move against static aircraft/terminal geometry.
- Needs tuning for 1-5 km/h motion, because apron interactions often occur below road-driving speeds.
- Should not be the sole personnel detector; low point count and partial occlusion around aircraft can hide people.
- Pair with radar Doppler and track-level logic for start/stop events near aircraft and stand boundaries.

## Implementation Notes

- Validate alignment and timestamping first; 4D convolutions amplify temporal registration errors.
- Use a short window for safety reactions and a longer offline window for map cleanup.
- Export point-level probability, not just thresholded labels, so downstream modules can apply risk-specific thresholds.
- Benchmark against LMNet on the same airside clips to quantify whether 4D sparse compute is justified.
- For ROS Noetic, wrap the Python inference node as an offline evaluator before considering real-time deployment.
- Track GPU memory and latency on the target Orin profile before integrating into the autonomy loop.

## Sources

- Paper: https://arxiv.org/abs/2206.04129
- Official repository: https://github.com/PRBonn/4DMOS
- MinkowskiEngine dependency: https://github.com/NVIDIA/MinkowskiEngine
- KISS-ICP alignment used by updated repo: https://github.com/PRBonn/kiss-icp
