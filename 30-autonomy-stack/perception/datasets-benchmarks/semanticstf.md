# SemanticSTF

**Last updated:** 2026-05-09

SemanticSTF is an adverse-weather LiDAR semantic-segmentation dataset built from the Seeing Through Fog/STF data. It adds dense point-level labels for studying 3D semantic segmentation under rain, snow, light fog, and dense fog.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

SemanticSTF measures how 3D semantic segmentation models fail when point clouds are captured in adverse weather instead of normal clear weather. The CVPR 2023 paper frames two key tasks:

- domain adaptation from normal-weather point clouds to adverse-weather point clouds;
- domain generalization, where the model must work in adverse weather after training on normal-weather data.

For removal validation, SemanticSTF is useful after artifact filtering: a good rain/snow/fog filter should improve semantic segmentation in adverse weather without erasing real objects or drivable-surface structure.

---

## Sensors And Modalities

| Modality | Notes |
|---|---|
| LiDAR point clouds | Primary modality for point-wise semantic segmentation |
| RGB images | Hugging Face dataset card describes synchronized RGB images |
| Calibration | Hugging Face dataset card lists camera intrinsics and LiDAR-to-camera transforms |
| Weather metadata | Per-frame adverse-weather metadata is listed in the Hugging Face release |

The GitHub release organizes data in train, validation, and test folders with `velodyne`, `labels`, and a `semanticstf.yaml` class configuration.

---

## Labels And Tasks

| Label type | Use |
|---|---|
| Dense point-wise semantic labels | 3D semantic segmentation in adverse weather |
| Weather-conditioned splits | Evaluate rain, snow, light fog, and dense fog separately |
| Class configuration file | Map label IDs for training/evaluation |
| Source-domain benchmark configs | SemanticKITTI-to-SemanticSTF and SynLiDAR-to-SemanticSTF experiments |

The release is especially useful for comparing whether a model is robust because it understands adverse-weather geometry, or whether it simply overfits to a weather condition seen during training.

---

## Weather And Environment

SemanticSTF covers real adverse-weather point clouds from the STF/Seeing Through Fog collection, including rain, snow, light fog, and dense fog. It inherits road-driving environments rather than controlled chamber-only data.

Because its base data is from a multimodal adverse-weather collection, SemanticSTF pairs well with Seeing Through Fog/DENSE when a workflow needs both dense LiDAR semantics and multimodal fusion evidence.

---

## Benchmark Use For Perception And Removal

Use SemanticSTF to evaluate:

- semantic segmentation mIoU under each adverse weather type;
- clear-to-adverse domain adaptation;
- domain generalization from SemanticKITTI or SynLiDAR into real adverse weather;
- whether artifact removal improves segmentation without removing small semantic classes;
- weather-aware confidence calibration for segmentation outputs.

For removal pipelines, run the segmenter on raw and filtered point clouds. A filter that only improves visual cleanliness but lowers mIoU for pedestrians, vehicles, signs, poles, or drivable surfaces is not acceptable for autonomy.

---

## Strengths

- Dense point-level labels under multiple adverse weather types.
- More general than snow-only datasets because it includes rain and fog.
- Built around standard 3D semantic-segmentation workflows.
- Public code provides baseline domain adaptation/generalization configurations.
- Useful bridge between removal metrics and downstream scene-understanding metrics.

---

## Limitations

- It is primarily a semantic segmentation dataset, not an object detection or tracking benchmark.
- It does not provide a direct paired clear/adverse route design like CADC+.
- It is still public-road data, not airside data.
- Dust, steam, de-icing mist, and jet-blast shimmer are not directly represented.
- For some details, the Hugging Face preview and GitHub structure should be checked against the downloaded release manifest before training.

---

## Airside Transfer

SemanticSTF is a good proxy for all-weather LiDAR parsing before collecting airside labels. Use it to test:

- whether LiDAR artifact removal preserves semantic structure;
- whether segmentation can distinguish real infrastructure from particle clutter;
- whether fog/snow/rain-specific failures are different enough to require separate health monitors;
- whether a model trained on clear roads degrades gracefully when weather tags change.

For apron deployment, extend the class map with airside objects such as aircraft, tugs, belt loaders, baggage carts, cones, dollies, and workers.

---

## Sources

- [SemanticSTF GitHub repository](https://github.com/xiaoaoran/SemanticSTF)
- [SemanticSTF Hugging Face dataset](https://huggingface.co/datasets/AR-X/SemanticSTF)
- [CVPR 2023 arXiv paper](https://arxiv.org/abs/2304.00690)
