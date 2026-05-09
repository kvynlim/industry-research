# STU 3D LiDAR Anomaly Segmentation Dataset

**Last updated:** 2026-05-09

Spotting the Unexpected (STU) is a CVPR 2025 dataset for 3D road-anomaly segmentation. It is important because most open-world driving benchmarks are image-first, while operational autonomous vehicles need a 3D hazard signal that can be projected into freespace, tracking, and planning.

**Related pages:** [open-world OOD and anomaly segmentation benchmarks](open-world-ood-anomaly-segmentation-benchmarks.md), [moving/static separation and MOS datasets](moving-static-separation-mos-datasets.md), [lidar semantic segmentation](../overview/lidar-semantic-segmentation.md), [uncertainty calibration](../overview/uncertainty-quantification-calibration.md), [production perception systems](../overview/production-perception-systems.md)

---

## Scope

| Item | Description |
|---|---|
| Core task | Point-level and object-level anomaly segmentation in 3D LiDAR point clouds. |
| Domain | Public-road driving with staged and naturalistic road anomalies. |
| Modalities | 128-beam LiDAR plus eight synchronized RGB cameras in a surround-view setup. |
| Label style | Dense point labels for inlier, anomaly, and unlabeled/questionable points; anomaly instance labels for object-level evaluation. |
| Temporal support | Sequential data, although the paper's reported baseline experiments focus on single scans. |
| Closest training context | SemanticKITTI and Panoptic-CUDAL-style road LiDAR semantics. |

STU is not a generic open-set semantic segmentation dataset. It is built around anomalies that should not overlap with the in-distribution training taxonomy, so it is closer to a safety monitor benchmark than to a "discover more classes" benchmark.

---

## Dataset And Task Definition

STU asks whether a model can separate unexpected hazardous objects from normal road-scene points when the objects are not part of the training classes. The paper defines anomalies as objects that can endanger the vehicle and passengers, especially objects on the driving surface that are absent from the training data.

The benchmark includes both out-of-distribution anomaly sequences and additional inlier-only sequences. This matters because an anomaly method must preserve normal inlier segmentation while detecting rare objects; otherwise, a model can inflate anomaly recall by flagging too much of the scene.

Key task variants:

| Task | Output | Use |
|---|---|---|
| Point-level anomaly scoring | An anomaly score or binary anomaly label per LiDAR point | Threshold-free screening, calibration, and small-object analysis. |
| Object-level anomaly segmentation | Coherent anomaly instances from point predictions | Planning and operator review, where scattered point alarms are weak evidence. |
| Inlier panoptic segmentation | Semantic/panoptic labels for normal road classes | Verifies that anomaly detection does not destroy base perception. |
| Temporal/multimodal follow-on | Use sequential LiDAR and camera views | Future work for long-range confirmation and multimodal anomaly reasoning. |

---

## Sensors And Labels

| Field | Details |
|---|---|
| Vehicle rig | Rigid vehicle-mounted frame. |
| Cameras | Eight hardware-triggered synchronized cameras. |
| LiDAR | High-resolution 128-beam LiDAR. |
| Calibration | Camera-LiDAR calibration repeated per camera; setup follows the Panoptic-CUDAL configuration. |
| Collection modes | Naturalistic road collection plus controlled low-speed staged object placement. |
| Post-processing | LiDAR odometry with KISS-ICP, KITTI-format pose export, image anonymization for faces and license plates. |
| Annotation tool | SemanticKITTI labeler workflow with pseudo-label initialization. |
| Labels | Inlier, anomaly/outlier, and unlabeled/questionable points, plus anomaly instance masks. |

The CVPR paper reports 51 test sequences across six streets, eight RGB cameras, 128-beam LiDAR, temporal support, and 8,022 test / 1,960 validation anomaly-label samples in its comparison table. The dataset is designed to avoid overlap between anomaly objects and common in-distribution classes.

---

## Metrics

| Metric | Level | Interpretation |
|---|---|---|
| AP | Point | Threshold-free anomaly ranking; sensitive to rare anomaly points. |
| AUROC | Point | Ranking separation between anomaly and normal points; can look high under class imbalance. |
| FPR95 | Point | False-positive rate at 95 percent anomaly true-positive rate; useful for operating-threshold stress. |
| PQ | Object/panoptic | Penalizes false positives and poor mask quality; closer to usable object hypotheses. |
| UQ | Object/open-set | Emphasizes recall of unknown objects without penalizing false positives as strongly as PQ. |
| Inlier PQ | Panoptic | Checks whether normal semantic/panoptic perception remains intact. |

The benchmark evaluates points within 50 m and objects with at least five LiDAR points. That is a practical choice for road anomaly work, but it also means sub-five-point objects at long range remain an explicit residual risk for AV and airside transfer.

---

## Failure Modes Exposed

- 3D anomaly points are extremely sparse relative to a full scan, so point-level AP can be low even when the scene looks easy to a human.
- Small or distant anomaly objects may contain only a few points and can be swallowed by ground, curb, or vehicle classes.
- Large unusual objects in familiar contexts can be confidently predicted as known classes such as pedestrian or other-vehicle.
- Ground-plane removal and clustering heuristics can miss low-profile or sparse hazards before the anomaly model sees them.
- A model can have good SemanticKITTI inlier performance but still be overconfident on unknown objects.
- Single-scan baselines underuse the temporal and camera data that STU makes available.
- Point labels do not by themselves prove that the resulting obstacle hypothesis is stable enough for tracking or planning.

---

## AV, Indoor, Outdoor, And Airside Relevance

| Environment | Fit | Notes |
|---|---|---|
| Public-road AV | Strong | Directly targets road debris and unexpected road objects in 3D. |
| Outdoor campus / industrial autonomy | Moderate | Useful for dropped objects and temporary hazards, but taxonomy and surfaces differ. |
| Indoor robots | Weak to moderate | The anomaly task transfers conceptually, but the sensor range, clutter, and object scale are different. |
| Airport apron / taxiway | Moderate proxy | The task resembles FOD, chocks, loose straps, and dropped tools, but airport surfaces and object types require target data. |
| Runtime assurance | Strong research proxy | Anomaly scores can feed monitors when calibrated with false-positive and persistence rules. |

For airside autonomy, STU is a better proxy than RGB-only anomaly benchmarks because LiDAR points can be converted into a ground-plane hazard. It is still not an airside acceptance dataset: it lacks aircraft, GSE, pavement markings, jet bridges, apron lighting, FOD taxonomies, and airport operating procedures.

---

## Validation And Data-Engine Use

1. Use STU to benchmark whether the LiDAR stack has any credible unknown-object signal before collecting airport data.
2. Report both threshold-free and operating-point metrics; set the threshold before the target-domain test run.
3. Convert anomaly points into object hypotheses and score track persistence, ground contact, and planner handoff.
4. Slice by range, number of anomaly points, object size, surface type, and whether the object lies in the intended path.
5. Preserve removed/ignored points so a denoising or ground-removal stage does not silently erase the anomaly.
6. Mine false positives on curbs, signs, vegetation, shadows projected into LiDAR-camera fusion, and normal road hardware.
7. For airside transfer, recreate the protocol with chocks, cones, tie-down straps, bolts, tools, luggage fragments, plastic wrap, and low dollies.

---

## Sources

- [CVPR 2025 Open Access paper page](https://openaccess.thecvf.com/content/CVPR2025/html/Nekrasov_Spotting_the_Unexpected_STU_A_3D_LiDAR_Dataset_for_Anomaly_CVPR_2025_paper.html)
- [STU CVPR 2025 paper PDF](https://openaccess.thecvf.com/content/CVPR2025/papers/Nekrasov_Spotting_the_Unexpected_STU_A_3D_LiDAR_Dataset_for_Anomaly_CVPR_2025_paper.pdf)
- [STU arXiv record](https://arxiv.org/abs/2505.02148)
- [STU supplementary material](https://openaccess.thecvf.com/content/CVPR2025/supplemental/Nekrasov_Spotting_the_Unexpected_CVPR_2025_supplemental.pdf)
- [STU project page](https://vision.rwth-aachen.de/stu-dataset)
