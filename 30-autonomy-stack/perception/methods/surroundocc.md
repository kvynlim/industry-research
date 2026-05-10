# SurroundOcc

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation"]
  reason: "Foundational camera occupancy reference for planning-facing perception."
method-priority:end -->

## What It Is

- SurroundOcc is a multi-camera 3D semantic occupancy prediction method for autonomous driving.
- It predicts dense voxel occupancy from surround-view images instead of only boxes or sparse points.
- The method was published at ICCV 2023 and released with code and generated dense occupancy labels.
- Its main contribution is both an architecture and a label-generation pipeline for dense occupancy supervision.
- It is a camera occupancy method, not a detection-only BEV method.

## Core Technical Idea

- Lift multi-scale image features directly into 3D volume features using spatial 2D-3D attention.
- Preserve 3D voxel structure instead of collapsing everything to BEV.
- Apply 3D convolutions to progressively upsample volume features.
- Supervise multiple volume levels with decayed weighted losses.
- Generate dense occupancy ground truth by separately fusing multi-frame LiDAR scans of dynamic objects and static scenes.
- Use dense labels to avoid the sparse-output limitation of methods trained only on LiDAR point labels.
- The method makes occupancy a direct volumetric prediction problem for surround cameras.

## Inputs and Outputs

- Inputs: synchronized multi-camera images plus camera intrinsics and extrinsics.
- Training inputs: sparse LiDAR scans, semantic labels, poses, and generated dense occupancy labels.
- Output: dense 3D voxel grid with empty/non-empty state and semantic class probabilities.
- Typical nuScenes-derived grids cover a fixed ego-centric range with discrete height bins.
- Intermediate output: multi-scale 3D volume features after 2D-3D attention.
- It does not primarily output object instances, tracks, or 3D boxes.

## Architecture

- 2D backbone extracts multi-scale feature maps from every camera.
- Spatial 2D-3D attention maps image features to voxel queries in the 3D volume.
- Low-resolution volume features are progressively upsampled with 3D convolutions.
- Skip or multi-scale fusion combines high-resolution and low-resolution volume representations.
- Occupancy heads at multiple levels produce auxiliary predictions for deep supervision.
- The label-generation pipeline accumulates static-scene LiDAR separately from dynamic-object LiDAR to reduce motion smearing.
- Official implementation is an MMDetection3D-style codebase with custom occupancy data preparation.

## Training and Evaluation

- Benchmarks: nuScenes-derived occupancy and SemanticKITTI semantic scene completion.
- Metrics include scene-completion IoU for geometry and semantic-scene-completion mIoU for semantic occupancy.
- The paper reports superior performance over prior vision-based methods on nuScenes and SemanticKITTI.
- The CVF paper reports state-of-the-art results on its generated dense nuScenes occupancy labels and on SemanticKITTI.
- The paper emphasizes that dense generated labels improve results over sparse LiDAR-point supervision.
- Training cost is higher than BEV-only methods because dense 3D volume features and 3D convolutions are used.
- Evaluation should state the occupancy label pipeline because different nuScenes occupancy datasets are not identical.

## Strengths

- Produces dense volumetric output, including occluded space, instead of only visible depth.
- More suitable than boxes for arbitrary shapes and long-tail objects.
- Dense supervision gives a stronger training signal than sparse point labels.
- Multi-scale volume decoding can recover finer structure than a single low-resolution voxel grid.
- The generated-label pipeline is valuable for bootstrapping occupancy datasets.
- Direct 3D output is easier to connect to collision checking than image-space depth.

## Failure Modes

- Dense 3D volumes are memory- and compute-heavy.
- Generated labels inherit LiDAR sparsity, pose error, semantic labeling mistakes, and dynamic-object fusion artifacts.
- 3D convolution can hallucinate plausible occupancy in occluded areas without calibrated uncertainty.
- Camera-only input remains vulnerable to lighting, weather, glare, and camera obstruction.
- Fixed voxel grids can miss very thin structures or smear vertical details.
- Domain shift in the label-generation pipeline can be severe outside road-driving scenes.

## Airside AV Fit

- Strong candidate for apron occupancy because dense shape matters more than bounding boxes near aircraft and equipment.
- Useful for aircraft wings, loader booms, tow bars, cones, hoses, dollies, and partially occluded service vehicles.
- Airside label generation can use repeated LiDAR passes around stands, but must handle parked aircraft that move between sessions.
- Needs explicit validation for large overhangs, shiny aircraft surfaces, jet bridges, night floodlights, and wet pavement.
- Camera-only occupancy should be fused with LiDAR/radar or conservative map priors before safety-critical use.
- The generated labels could seed an airside occupancy dataset if QA includes manual checks around aircraft clearance zones.

## Implementation Notes

- Define the voxel grid around operational clearance requirements, not only nuScenes ranges.
- Separate static apron structure from dynamic GSE and aircraft when fusing labels.
- Track label provenance per voxel so safety evaluation can distinguish observed, fused, and completed occupancy.
- Use class-balanced training for rare but safety-critical airside objects.
- Profile 3D convolution memory before scaling range or height resolution.
- Add uncertainty or visibility masks; dense occupancy without confidence is risky for planners.
- Keep dataset naming explicit because "SurroundOcc-nuScenes", "Occ3D-nuScenes", and custom labels differ.

## Sources

- SurroundOcc paper: https://arxiv.org/abs/2303.09551
- CVF open-access paper: https://openaccess.thecvf.com/content/ICCV2023/papers/Wei_SurroundOcc_Multi-camera_3D_Occupancy_Prediction_for_Autonomous_Driving_ICCV_2023_paper.pdf
- Official SurroundOcc repository: https://github.com/weiyithu/SurroundOcc
- SurroundOcc project page: https://weiyithu.github.io/SurroundOcc/
