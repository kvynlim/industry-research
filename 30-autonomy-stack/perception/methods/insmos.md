# InsMOS

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "mapping", "validation", "road-av"]
  reason: "InsMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows."
method-priority:end -->

## What It Is

- InsMOS is an instance-aware moving object segmentation method for LiDAR data.
- It predicts point-wise moving labels while also detecting instance information for main traffic participants.
- The method was published at IROS 2023 and has an official MIT-licensed implementation.
- It addresses a key MOS weakness: fragmented moving labels without object-level consistency.
- The authors later extend the line of work into SegNet4D.
- It is best understood as MOS with instance reasoning, not a full 4D panoptic segmentation system.

## Core Technical Idea

- Use a sequence of point clouds as input.
- Quantize the temporal sequence into 4D voxels.
- Run 4D sparse convolutions to extract motion features.
- Inject the motion features into the current scan.
- Detect instance information in the current scan so object-level motion can guide point labels.
- Fuse spatio-temporal features and predicted instance information through an upsample fusion module.

## Inputs and Outputs

- Input: sequential LiDAR point clouds.
- Input: ego-motion aligned temporal context.
- Training input: point MOS labels plus instance or bounding-box labels for traffic participants.
- Output: per-point moving/static labels.
- Output: detected instance information for vehicles, pedestrians, cyclists, or similar actor classes.
- Output use case: instance-consistent dynamic masks for tracking, mapping, and prediction.

## Architecture or Dataset/Pipeline

- The public code organizes dataloaders, model modules, scripts, and visualization utilities.
- The method uses 4D sparse voxel motion encoding as the temporal backbone.
- It extracts current-frame instance features to determine which detected instances are actually moving.
- The upsample fusion module maps fused features back to point-wise MOS predictions.
- The repository provides dataset preparation for SemanticKITTI, KITTI-road, and added instance labels.
- It is a LiDAR-only model at inference time.

## Training and Evaluation

- The paper evaluates on the LiDAR-MOS benchmark based on SemanticKITTI.
- It compares against prior state of the art for moving object segmentation.
- It reports improved MOS performance by integrating instance information.
- It also reports generalization to Apollo using a model pre-trained on SemanticKITTI.
- Training requires more annotation structure than pure binary MOS because instance supervision is part of the design.
- Evaluation remains point-level MOS, with instance quality acting as an internal mechanism rather than the main metric.

## Strengths

- Instance reasoning improves spatial integrity of moving-object masks.
- Better handles temporarily static actors by reasoning about object instances rather than isolated points.
- Directly useful for track birth because moving labels can be associated with object hypotheses.
- Public code and pretrained model release lower reproduction cost.
- Bridges binary MOS and richer 4D segmentation without requiring full panoptic labels.
- Good conceptual fit for mixed static/dynamic fleets around airport stands.

## Failure Modes

- Requires instance labels or bounding boxes during training, increasing airside annotation cost.
- Instance detector bias can suppress unusual airport actors such as belt loaders, aircraft tugs, dollies, cones, and FOD.
- Very large objects such as aircraft may not match road-object scale assumptions.
- Slow motion and stop-start behavior can still be ambiguous.
- False instance grouping can move static points into dynamic masks or split one moving object.
- Sparse far-range points reduce both instance and motion confidence.

## Airside AV Fit

- High fit for GSE and personnel because object-level consistency matters more than isolated moving points.
- Useful for distinguishing parked GSE from GSE beginning to maneuver near an aircraft.
- Needs airport-specific instance taxonomy and bounding boxes before safety use.
- Aircraft should probably be treated as separate static/movable structural classes, not generic vehicles.
- Instance-aware masks can support apron prediction and right-of-way logic when fused with trackers.
- Should be paired with conservative obstacle persistence for safety around crouched workers and occluded dollies.

## Implementation Notes

- Build an airside label schema that separates instance actor classes from static background.
- Start with SemanticKITTI pretrained weights only for representation transfer, not final acceptance.
- Add annotation examples for low-speed starts, reversing, stopped-before-moving, and towing interactions.
- Inspect object-level false positives, not only point-level IoU.
- For ROS integration, publish both point labels and instance IDs when available.
- Use temporal smoothing outside the network to prevent one-frame dynamic mask flicker.

## Sources

- Paper: https://arxiv.org/abs/2303.03909
- Official repository: https://github.com/nubot-nudt/InsMOS
- IROS 2023 citation in repository: https://github.com/nubot-nudt/InsMOS#citation
- SemanticKITTI dataset: https://semantic-kitti.org/index
