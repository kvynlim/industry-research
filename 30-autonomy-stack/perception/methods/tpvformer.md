# TPVFormer

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "TPVFormer is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- TPVFormer is a vision-based 3D semantic occupancy method built around a tri-perspective-view representation.
- It was introduced in "Tri-Perspective View for Vision-Based 3D Semantic Occupancy Prediction" at CVPR 2023.
- The method addresses BEV's loss of vertical structure by adding two orthogonal planes to the BEV plane.
- It predicts semantic occupancy from camera inputs while using much less memory than dense 3D voxel features.
- It is an occupancy representation and encoder method, not a 3D box detector.

## Core Technical Idea

- Represent the 3D scene with three feature planes: top, front, and side.
- Model a 3D point by projecting it onto all three planes and summing the corresponding features.
- Use image cross-attention to lift multi-camera 2D image features into TPV grid queries.
- Use cross-view hybrid attention so the three planes exchange information.
- Decode point or voxel semantics from the summed TPV features.
- The design seeks a middle ground between BEV efficiency and dense voxel expressiveness.
- It makes vertical and side structure visible to the model without materializing a full dense 3D tensor.

## Inputs and Outputs

- Inputs: multi-camera RGB images, camera intrinsics, camera extrinsics, and ego-frame geometry metadata.
- Training supervision in the original occupancy task: sparse semantic LiDAR labels rather than dense hand-labeled voxels.
- Output: semantic occupancy labels for voxels or queried 3D points.
- Output classes follow the task dataset, such as nuScenes lidar segmentation semantics or SemanticKITTI SSC classes.
- Intermediate output: three orthogonal TPV feature planes.
- It does not output 3D boxes, instance tracks, or explicit per-object shapes unless paired with another head.

## Architecture

- Image backbone extracts multi-scale features from each camera image.
- TPV queries are initialized on three orthogonal planes.
- Image cross-attention samples relevant 2D image features for each TPV query.
- Cross-view hybrid attention exchanges context across top, side, and front planes.
- A lightweight prediction head maps the sum of projected plane features to point or voxel labels.
- For voxel features, TPV planes can be broadcast along their orthogonal axes and summed.
- The official code is based on BEVFormer and Cylinder3D components.
- The repo includes configurations for nuScenes LiDAR segmentation, 3D semantic occupancy, and SemanticKITTI semantic scene completion.

## Training and Evaluation

- Benchmarks include Panoptic nuScenes/LiDAR segmentation style evaluation and SemanticKITTI semantic scene completion.
- The paper formulates vision-based 3D semantic occupancy with sparse LiDAR semantic labels during training.
- The CVPR paper reports that camera-only TPVFormer can be comparable with LiDAR-based methods on the nuScenes LiDAR segmentation task.
- The official README lists 6 camera images, 16 semantics, sparse LiDAR semantic labels, and about 290 ms inference on a single A100 for its Tesla Occupancy Network comparison.
- The repo provides a lower-memory 3090 configuration for occupancy training and separate SemanticKITTI support.
- Metrics depend on task: mIoU for LiDAR segmentation or semantic scene completion, and qualitative dense occupancy for the original sparse-supervision setup.
- Results should be interpreted with the supervision type stated clearly: sparse labels are not the same as dense occupancy labels.

## Strengths

- Preserves more vertical structure than a pure BEV plane.
- Much cheaper than dense 3D voxel attention or 3D convolution over the full volume.
- Works naturally with multi-camera image features and calibrated projection.
- Flexible enough to produce point features or dense voxel features.
- Good conceptual bridge between BEV detection and full semantic occupancy.
- Official implementation and project page make it easy to audit architecture choices.

## Failure Modes

- TPV is still a compressed representation; complex geometry can alias across planes.
- Sparse LiDAR supervision can produce plausible but unverified dense predictions in unseen voxels.
- Inference cost can still be high for embedded deployment.
- No temporal context in the original comparison limits handling of occlusion and motion.
- Calibration and camera coverage errors directly affect image cross-attention.
- Thin structures, overhangs, and rare classes can be missed if sparse labels do not cover them.

## Airside AV Fit

- Strong fit for representing airside vertical structure better than flat BEV: aircraft tails, loader masts, jet bridges, and service equipment.
- Useful for camera occupancy research where dense airside voxel labels are not yet available.
- Sparse LiDAR supervision is attractive if LiDAR survey vehicles can collect training labels.
- Needs validation on aircraft overhangs, tow bars, hoses, chocks, cones, personnel, and stand equipment.
- The original non-temporal setup is insufficient for safety-critical occlusion handling around parked aircraft.
- Best used as a representation baseline for airside occupancy, then extended with temporal context and uncertainty.

## Implementation Notes

- Keep top/front/side plane resolutions tied to the physical voxel grid so projected features align.
- Validate coordinate conventions carefully; plane projection bugs can silently corrupt training.
- If using dense labels from another pipeline, document that the supervision differs from the original TPVFormer setup.
- Profile attention memory before choosing range and resolution for apron-scale scenes.
- Add temporal fusion externally if operating around occluding aircraft or moving GSE.
- Use class-balanced losses or sampling for rare airside objects such as cones, chocks, and pedestrians.
- Compare against BEV-only and dense-voxel baselines to prove TPV's value in the target domain.

## Sources

- TPVFormer paper: https://arxiv.org/abs/2302.07817
- CVF open-access paper: https://openaccess.thecvf.com/content/CVPR2023/papers/Huang_Tri-Perspective_View_for_Vision-Based_3D_Semantic_Occupancy_Prediction_CVPR_2023_paper.pdf
- Official TPVFormer repository: https://github.com/wzzheng/TPVFormer
- TPVFormer project page: https://wzzheng.net/TPVFormer/
