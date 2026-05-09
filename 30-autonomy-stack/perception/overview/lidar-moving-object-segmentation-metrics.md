# LiDAR Moving Object Segmentation Metrics

**Last updated:** 2026-05-09

## Why It Matters

Moving object segmentation (MOS), moving event detection (MED), and dynamic map cleaning use similar words but optimize different failures. MOS labels current scan points as static or moving. MED emphasizes immediate moving events, often at point-stream latency. Map cleaning decides which accumulated map points should remain in a persistent static layer.

For airside autonomy, a single aggregate IoU is not enough. A false negative can put a moving tug or person into occupancy history, while a false positive can delete stand markings, poles, edges, or other localization structure.

## Confusion Matrix

| Case | MOS meaning | Map-cleaning meaning | Operational risk |
|---|---|---|---|
| True positive | Moving point correctly predicted moving | Dynamic/transient point removed or quarantined | Desired dynamic suppression |
| False positive | Static point predicted moving | Static structure eroded from the map | Localization degradation and false map change |
| False negative | Moving point predicted static | Dynamic object leaks into static map or current-world history | Ghost obstacles, false free-space assumptions, or bad tracking priors |
| True negative | Static point predicted static | Static map point retained | Desired map preservation |

## Core MOS Metrics

| Metric | Formula / report | Use | Caveat |
|---|---|---|---|
| Moving IoU | `TP_m / (TP_m + FP_m + FN_m)` | Primary dynamic-class score | Moving points are sparse, so confidence intervals and per-sequence scores matter |
| Static IoU | `TP_s / (TP_s + FP_s + FN_s)` | Static preservation | Can look high even when dynamic recall is poor |
| Mean IoU | Average of moving and static IoU | SemanticKITTI-MOS-style ranking | Class-balanced but still hides distance, class, and latency failures |
| Precision | `TP_m / (TP_m + FP_m)` | Static erosion control | High precision alone can miss many moving actors |
| Recall | `TP_m / (TP_m + FN_m)` | Ghost leakage control | High recall alone can over-delete map structure |
| F1 | Harmonic mean of precision and recall | Threshold selection | Less interpretable than separate precision/recall for map policy |

## Sequence and Time Metrics

| Metric | What to report | When to prefer it |
|---|---|---|
| Pooled sequence IoU | Sum TP/FP/FN over a whole sequence before computing IoU | Stable leaderboard comparison on long sequences |
| Mean per-scan IoU | Compute IoU per scan, then average | MED protocols where sparse dynamic frames should not disappear inside a long sequence |
| Distance-banded IoU | 0-10 m, 10-30 m, 30-50 m, and beyond if used | Safety envelopes and far-field work-zone/aircraft detection |
| Temporal flicker rate | Label changes for the same tracked voxel/object without physical explanation | Streaming MOS, memory models, and map update stability |
| Start/stop latency | Time between physical motion change and correct label change | Low-speed GSE and aircraft pushback |
| Deadline miss rate | Fraction of scans/points that miss the consumer deadline | Runtime perception and occupancy updates |

## MED Metrics

| Metric | MED-specific interpretation | Practical use |
|---|---|---|
| Point-event IoU | IoU where moving points are the positive class | MOE-style moving event benchmark |
| Point-out latency | Time from point arrival to event/non-event label | M-detector-style point-stream safety check |
| Frame-out latency | Time after accumulating and refining a frame or short window | Higher accuracy mode for mapping or QA |
| Event burst recall | Recall during sudden object emergence, start motion, or crossing | Avoid missing first motion near aircraft or blind corners |
| False event density | False moving points per scan, meter, or map tile | Prevent noisy MED from eroding static surfaces |

## Static Map Metrics

| Metric | Definition | Why it matters |
|---|---|---|
| Preservation rate (PR) | Fraction of ground-truth static map points retained | Protect localization and simulation geometry |
| Rejection rate (RR) | Fraction of ground-truth dynamic/transient map points removed | Remove ghost trails and temporary actors |
| Map-cleaning F1 / score | Benchmark-specific combination of preservation and rejection | Useful only when PR and RR are also shown |
| Ghost rate | Remaining transient points per route, stand, tile, or 100 m | More operational than visual inspection alone |
| False-free-space rate | Cases where cleaning implies free space while a hazard exists | Safety-critical for planners and reviewers |
| Localization delta | Residuals, inlier ratio, covariance, ATE/RPE before and after cleaning | A cleaner map must improve or preserve localization health |

## Reporting Slices

| Slice | Required breakdown |
|---|---|
| Sensor | Per LiDAR sensor before fused-cloud averages, especially for spinning vs. solid-state patterns |
| Motion speed | Stopped, creeping, normal, fast, and start/stop transitions |
| Actor type | Vehicle/GSE, pedestrian/worker, bicycle/cart, aircraft-adjacent equipment, cone/barrier where labeled |
| Range and density | Distance, incidence angle, beam count, and low-point objects |
| Environment | Day/night, rain/wet ground, glare, dust/spray, open apron, cluttered stand, indoor/semi-indoor |
| Map layer | Permanent static, movable-static, current dynamic, FOD/hazard, artifact, unknown/review |

## Acceptance Guidance

1. Always publish moving IoU, static IoU, precision, recall, and latency together.
2. Treat leaderboard mIoU as a screening metric, not a safety metric.
3. For map updates, require PR/RR and localization delta before promoting cleaned points into a release map.
4. Separate "currently moving" from "movable but static now"; MOS labels alone do not encode map lifecycle policy.
5. For airside work, make false-negative dynamic leakage and false-positive static erosion separate acceptance gates.
6. Add pose/time fault injection because most temporal MOS methods rely on ego-motion compensation.

## Sources

- SemanticKITTI MOS task and metric: https://semantic-kitti.org/tasks.html
- SemanticKITTI dataset format: https://semantic-kitti.org/dataset.html
- LiDAR-MOS paper: https://arxiv.org/abs/2105.08971
- MOE dataset and benchmark: https://github.com/DeepDuke/MOE-Dataset
- HeLiMOS tasks and map-building metrics: https://sites.google.com/view/helimos/tasks
- M-detector Nature Communications paper: https://www.nature.com/articles/s41467-023-44554-8
- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- Local context: `30-autonomy-stack/localization-mapping/slam-methods/dynamic-map-cleaning-benchmarks.md`
