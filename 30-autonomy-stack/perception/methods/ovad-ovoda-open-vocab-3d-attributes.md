# OVAD And OVODA Open-Vocabulary 3D Attributes

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "OVAD And OVODA Open-Vocabulary 3D Attributes is rated for open-world perception, annotation leverage, and long-tail validation workflows."
method-priority:end -->

**Last updated:** 2026-05-09

OVAD is an open-vocabulary attribute dataset built on nuScenes, and OVODA is the associated open-vocabulary multimodal 3D object and attribute detection framework. Together they move 3D detection beyond closed class names toward object attributes such as spatial relationships, motion state, interaction cues, material-like descriptors, and scene dynamics.

**Related pages:** [open-vocabulary detection](../overview/open-vocab-detection.md), [vision foundation models](../overview/vision-foundation-models.md), [nuScenes and Waymo practical guide](../datasets-benchmarks/nuscenes-waymo-practical-guide.md), [open-world OOD and anomaly segmentation benchmarks](../datasets-benchmarks/open-world-ood-anomaly-segmentation-benchmarks.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Is

| Item | Description |
|---|---|
| OVAD | Open Vocabulary Attribute Detection dataset released on Zenodo. |
| Base data | nuScenes metadata and sensor references, requiring the original nuScenes dataset. |
| OVODA | Framework for open-vocabulary multimodal 3D object detection with attributes. |
| Publication | BMVC 2025 oral paper according to the project/arXiv page. |
| Core problem | Detect novel 3D objects and describe their attributes without relying on fixed novel-class anchor sizes. |
| Modalities | nuScenes-style LiDAR, radar, cameras, ego pose, sweeps, and 3D boxes. |

The useful shift is from "there is a car" to "there is an unknown/known object with a spatial relation, motion state, and attribute set that changes how the autonomy stack should treat it."

---

## Dataset And Task Definition

OVAD supplements 3D detection data with attribute annotations. The Zenodo record describes attributes for spatial relationships, motion states, and interactions between objects, with metadata stored in `OVAD_infos_train.pkl`, `OVAD_infos_val.pkl`, `OVAD_infos_test.pkl`, and mini splits.

Core tasks:

| Task | Output | Why it matters |
|---|---|---|
| Open-vocabulary 3D detection | 3D boxes and class text for base and novel objects | Reduces closed-taxonomy blind spots. |
| Attribute detection | Attribute names per object | Captures state and interaction details not represented by class labels. |
| Spatial relationship detection | Relationship boxes/names such as relative spatial configurations | Helps interpret hazards and interactions. |
| Attribute-aware novel-object detection | Joint object and attribute predictions under novel-class conditions | Avoids treating unknown objects as purely unnamed obstacles. |

This is a method/dataset pair, not a final runtime monitor. It produces richer perception hypotheses that still need calibration, tracking, and downstream policy rules.

---

## Sensors, Labels, And Metadata

| Field | OVAD content |
|---|---|
| LiDAR | `lidar_path`, sweeps, number of LiDAR points per object. |
| Cameras | `cams` entries with nuScenes camera metadata. |
| Radar | Number of radar points per object where available in the metadata. |
| Ego/global pose | LiDAR-to-ego and ego-to-global translations and rotations. |
| Object labels | 3D boxes, object category names, velocities, validity flags. |
| Attribute labels | `gt_attribute_names` for object attributes. |
| Spatial labels | `gt_spatial_boxes` and `gt_spatial_names`. |
| Dataset format | Pickle metadata compatible with MMDetection3D-style workflows. |

OVAD's release is about metadata and labels layered on nuScenes. Users still need the original nuScenes data under its own license terms.

---

## OVODA Method Idea

OVODA uses foundation-model features and text prompts to bridge the semantic gap between 3D features and open-vocabulary text. The project description highlights feature concatenation, prompt tuning, perspective-specified prompts, and horizontal flip augmentation for attribute detection.

Pipeline view:

1. Extract multimodal 3D detection features from nuScenes-style LiDAR/camera inputs.
2. Add foundation-model semantic features that can align with text descriptions.
3. Use prompts for object classes and attributes rather than a fixed closed classifier only.
4. Predict 3D boxes, object text/class labels, and attribute labels jointly.
5. Evaluate base and novel categories under conditions where novel anchor sizes are not given.

The practical value is not just recognizing new nouns. Attributes such as moving/stopped, near/behind, attached/occluding, or unusual state can carry more operational meaning than the class name alone.

---

## Metrics And Evaluation

| Metric family | Use |
|---|---|
| 3D detection mAP / NDS-style metrics | Baseline object detection quality on nuScenes-style tasks. |
| Base vs novel class AP | Measures open-vocabulary transfer rather than closed-set memorization. |
| Attribute precision/recall/AP | Measures whether object state and descriptors are actually detected. |
| Spatial relationship accuracy | Measures relationship labels and spatial boxes where applicable. |
| Class-attribute joint accuracy | Penalizes correct box/class with wrong operational attribute. |
| Calibration / abstention metrics | Needed if open-vocabulary scores feed a safety monitor. |

For AV validation, class and attribute metrics should be sliced by range, occlusion, LiDAR point count, lighting, weather, and class novelty. Attribute false positives are not harmless: a wrongly predicted "stationary" or "not blocking" state can be worse than an unknown label.

---

## Failure Modes

- Text prompts can encode dataset bias and may produce fragile synonyms or over-specific descriptions.
- Foundation-model features may align with visual appearance while missing 3D geometry or motion state.
- Novel object localization can remain poor even when text retrieval gives a plausible label.
- Attribute annotations are not the same as causal scene understanding; "near" or "interacting" may be unstable across frames.
- nuScenes road scenes do not cover aircraft, GSE, jet bridges, stands, dollies, ULDs, or apron-specific FOD.
- Attribute labels may be sparse or ambiguous; unknown attributes should not be forced into positive/negative predictions.
- Open-vocabulary confidence is often poorly calibrated for safety thresholds.

---

## AV, Indoor, Outdoor, And Airside Relevance

| Environment | Fit | Notes |
|---|---|---|
| Public-road AV | Strong research fit | Built on nuScenes and Argoverse 2 evaluation context. |
| Airport airside | Moderate | Useful pattern for apron attributes, but needs airside vocabulary and labels. |
| Indoor logistics | Moderate | Attribute detection transfers conceptually to stateful objects and interactions. |
| Outdoor industrial sites | Moderate | Good for open-vocabulary equipment, but domain-specific labels are needed. |
| Runtime safety | Emerging | Needs calibration, temporal consistency, and fallback behavior before product use. |

Airside attributes that would be more useful than class names alone include "attached to aircraft," "under wing," "blocking stand entry," "moving toward path," "stationary near engine," "loose on pavement," "connected by cable," and "person near equipment."

---

## Validation And Data-Engine Use

1. Start with OVAD/OVODA as a schema and prompt-design reference, not as an airside-ready model.
2. Build an airport attribute ontology with positive, negative, and unknown states; avoid forcing uncertain attributes.
3. Evaluate object detection and attribute detection jointly, because a correct attribute on a wrong box is not useful.
4. Track prompt versions and synonym sets as model artifacts; prompt drift can change benchmark results.
5. Add temporal smoothing only after measuring whether attributes flicker frame to frame.
6. Use data-engine mining to find high-confidence open-vocabulary predictions on unknown airport objects, then route them to human review.
7. Calibrate attribute scores separately from class scores before using them in planning or operator alerts.

---

## Sources

- [OVODA project page](https://shanexiangh.github.io/xinhao-xiang/publication/ovoda/)
- [OVODA arXiv record](https://arxiv.org/abs/2508.16812)
- [OVAD Zenodo dataset record](https://zenodo.org/records/16904070)
- [Original Freiburg OVAD attribute visualization dataset](https://lmb.informatik.uni-freiburg.de/resources/datasets/ovad/)
- [nuScenes dataset](https://www.nuscenes.org/)
