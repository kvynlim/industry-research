# SelfOcc

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "SelfOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- SelfOcc is a self-supervised vision-based 3D occupancy prediction method.
- It learns occupancy from video sequences and poses rather than dense 3D occupancy annotations.
- The method was accepted at CVPR 2024.
- It can use BEV or TPV 3D representations and then converts them into an SDF-style field.
- It is mainly a training paradigm for occupancy geometry and semantics, not a detector.

## Core Technical Idea

- Lift image features into a 3D representation using attention or related view-transform modules.
- Treat the 3D representation as a signed distance field so occupancy boundaries are geometrically meaningful.
- Render previous and future frames from the learned field to provide self-supervision.
- Use temporal consistency from video sequences as the training signal.
- Introduce an MVS-embedded strategy that optimizes SDF-induced rendering weights with multiple depth proposals.
- Add smoothness, sparsity, and rendering losses tailored to occupancy.
- For semantic output on nuScenes, use pseudo semantic labels from an off-the-shelf open-vocabulary segmentation model.

## Inputs and Outputs

- Inputs: monocular or surround-view RGB video, camera calibration, and ground-truth or estimated poses.
- Training supervision: video photometric/depth rendering signals, not manual dense 3D voxel labels.
- Optional semantic supervision: pseudo 2D segmentation labels, such as OpenSeeD outputs in the paper.
- Output: 3D occupancy geometry, optionally semantic occupancy.
- Intermediate output: BEV or TPV 3D representation.
- Intermediate output: SDF field, color, and semantic logits from an MLP decoder.

## Architecture

- 2D backbone: ResNet50 with FPN in the reported implementation details.
- 3D encoder: BEVFormer-style or TPVFormer-style representation depending on the chosen variant.
- Decoder: two-layer MLP that maps 3D features to SDF, color, and optional semantic logits.
- Rendering module samples along camera rays and integrates SDF-induced weights.
- MVS-embedded depth learning uses multiple depth proposals along epipolar geometry to improve depth optimization.
- Losses vary by task: depth losses for depth estimation, rendering and depth losses for novel depth synthesis, plus smoothness/sparsity/semantic terms for occupancy.
- Official code is based on TPVFormer and PointOcc, with links to related occupancy projects.

## Training and Evaluation

- Benchmarks include Occ3D-nuScenes, SemanticKITTI, KITTI-2015, and nuScenes depth estimation.
- The CVPR paper reports 45.01 IoU and 9.30 mIoU on Occ3D for surround-view occupancy using only video supervision.
- For monocular occupancy on SemanticKITTI, it reports 21.97 IoU versus SceneRF's 13.84 IoU, a 58.7% relative improvement.
- It also evaluates novel depth synthesis and depth estimation as proxies for learned 3D geometry quality.
- Implementation details include AdamW, 1e-4 initial learning rate, cosine decay, 12 epochs on nuScenes, and 24 epochs on SemanticKITTI/KITTI-2015.
- Evaluation must distinguish self-supervised geometry from semantic pseudo-label quality.
- The method's reported value is label reduction, not top fully supervised occupancy accuracy.

## Strengths

- Reduces dependence on expensive dense 3D occupancy labels.
- Uses ordinary video and pose signals, which are easier to collect at scale.
- SDF representation gives a cleaner occupancy boundary than unconstrained density fields.
- MVS-embedded depth learning directly attacks sparse-view depth ambiguity.
- Works with both monocular and surround-camera settings.
- Valuable for bootstrapping domains where 3D labels are scarce.

## Failure Modes

- Requires accurate camera poses; pose error becomes geometry supervision noise.
- Photometric supervision is fragile under exposure change, glare, shadows, rain, and moving objects.
- Dynamic objects can violate static scene assumptions during temporal rendering.
- Pseudo semantic labels inherit 2D segmentation errors and open-vocabulary biases.
- Self-supervised geometry may be plausible but not safety-calibrated in occluded space.
- Training can be sensitive to depth proposal sampling and loss weighting.

## Airside AV Fit

- Highly relevant for airside because dense 3D annotation of aircraft stands is expensive.
- Video self-supervision can exploit repeated routes around gates, service roads, baggage areas, and stands.
- Pose accuracy is critical; use RTK/INS/LiDAR-SLAM-quality poses when collecting training data.
- Reflective aircraft, night floodlights, wet pavement, and moving GSE are major photometric failure cases.
- SelfOcc can pretrain an airside occupancy model, but final safety use still needs LiDAR/radar validation and labeled test sets.
- Particularly useful for learning static apron geometry and camera depth priors before supervised fine-tuning.

## Implementation Notes

- Do not evaluate only rendered image quality; measure 3D occupancy, depth, and clearance errors.
- Filter or mask dynamic objects during self-supervised training when motion labels are unavailable.
- Track pose uncertainty and exclude segments with poor localization.
- Use airside-specific pseudo-label taxonomies if semantics matter.
- Compare BEV and TPV variants; TPV may better capture aircraft overhangs and tall equipment.
- Add held-out lighting and weather slices because photometric training can overfit to capture conditions.
- Treat self-supervised outputs as pretraining or weak supervision unless validated against independent 3D ground truth.

## Sources

- SelfOcc paper: https://arxiv.org/abs/2311.12754
- CVF open-access paper: https://openaccess.thecvf.com/content/CVPR2024/papers/Huang_SelfOcc_Self-Supervised_Vision-Based_3D_Occupancy_Prediction_CVPR_2024_paper.pdf
- Official SelfOcc repository: https://github.com/huang-yh/SelfOcc
- SelfOcc project page: https://huang-yh.github.io/SelfOcc/
