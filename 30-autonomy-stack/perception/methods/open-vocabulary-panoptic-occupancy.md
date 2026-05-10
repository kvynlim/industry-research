# Open-Vocabulary Panoptic Occupancy

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "Open-Vocabulary Panoptic Occupancy is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

**Last updated:** 2026-05-09

Open-vocabulary panoptic occupancy combines three trends: dense 3D occupancy prediction, panoptic instance-aware scene representation, and language-aligned open-vocabulary semantics. PanoOcc, LangOcc, OpenOcc, and newer instance-centric occupancy benchmarks point toward AV perception systems that represent not only boxes and lanes, but the occupied 3D world with semantics, instances, and queryable language labels.

**Related pages:** [occupancy flow and 4D occupancy benchmarks](../datasets-benchmarks/occupancy-flow-and-4d-occupancy-benchmarks.md), [vision foundation models](../overview/vision-foundation-models.md), [BEV encoding architectures](../overview/bev-encoding.md), [SparseOcc](sparseocc.md), [Streaming Gaussian Occupancy](streaming-gaussian-occupancy.md), [4D radar-camera occupancy](4d-radar-camera-occupancy.md)

---

## What It Is

| Component | Role |
|---|---|
| Occupancy prediction | Predict whether each 3D voxel is occupied, free, or unknown, often with semantic labels. |
| Panoptic occupancy | Adds instance identity for "thing" objects while preserving "stuff" classes such as road and vegetation. |
| Open-vocabulary occupancy | Aligns voxel features with language so queries can include labels not fixed at training time. |
| PanoOcc | Camera-based 3D panoptic segmentation via a unified occupancy representation. |
| LangOcc | Self-supervised open-vocabulary occupancy estimation via volume rendering and vision-language alignment. |
| OpenOcc | PyTorch codebase supporting multiple 3D occupancy benchmarks and extensible occupancy training/evaluation. |

The combined direction is attractive for autonomy because boxes are weak for irregular, partially visible, or unknown obstacles. Occupancy gives dense geometry; panoptic identity gives object coherence; language alignment gives a path to open-world labels.

---

## Task Definition

| Task | Input | Output | Metrics |
|---|---|---|---|
| Semantic occupancy | Multi-view images, LiDAR, or fused sensors | Voxel occupancy with semantic class | Occupied IoU, mIoU. |
| Panoptic occupancy | Multi-frame/multi-view images or LiDAR-camera features | Voxel semantics plus instance IDs | PQ, SQ, RQ, semantic mIoU. |
| Open-vocabulary occupancy | Images and language-aligned supervision/features | Voxel language features or query scores | Open-vocabulary IoU, query accuracy, text-class mIoU. |
| Dense occupancy benchmark implementation | Standard datasets such as nuScenes/Occ3D/OpenOccupancy | Train/eval pipeline outputs | Benchmark-specific IoU/mIoU and challenge metrics. |

Open-vocabulary panoptic occupancy is still a research category rather than a single standard benchmark. The practical architecture usually needs a closed-set safety layer in parallel until open-vocabulary confidence and temporal consistency are proven.

---

## Sensors And Labels

| System / resource | Sensors | Labels / supervision |
|---|---|---|
| PanoOcc | Multi-view, multi-frame camera images | nuScenes 3D semantic/panoptic outputs and Occ3D-style dense occupancy extension. |
| LangOcc | Camera images for self-supervised training | Volume-rendered language-aligned voxel features; avoids requiring dense 3D labels for all semantics. |
| OpenOcc | Dataset-dependent; supports nuScenes LiDAR segmentation, SurroundOcc, OpenOccupancy, and 3D occupancy challenge formats | Sparse LiDAR supervision or dense occupancy annotations depending on benchmark. |
| Occ3D / OpenOccupancy family | Typically nuScenes/Waymo-derived sensor data | Dense voxel occupancy and semantic labels. |
| CarlaOcc / ADMesh direction | Synthetic CARLA data and curated 3D assets | High-resolution instance-level panoptic occupancy ground truth. |

For airport autonomy, the missing ingredient is not only labels but geometry fidelity: aircraft wings, engine nacelles, ULD contours, tow bars, hoses, and FOD are precisely the shapes that box-centric labels simplify away.

---

## Method Pattern

1. Encode multi-view images or fused sensor inputs into BEV/voxel features.
2. Lift 2D features into 3D using depth, attention, projection, or sparse voxel queries.
3. Predict occupancy at voxel resolution, often with semantic logits.
4. Add instance grouping or mask decoding for foreground objects to obtain panoptic occupancy.
5. For open vocabulary, align voxel features with image/text embeddings or language-supervised rendering losses.
6. Post-process into freespace, object instances, unknown regions, and planner-consumable occupancy.

PanoOcc's important contribution is unifying camera-based 3D segmentation and occupancy through voxel queries and coarse-to-fine spatiotemporal aggregation. LangOcc's contribution is reducing dependence on dense 3D labels by aligning a 3D occupancy field with language through self-supervised rendering. OpenOcc is useful because it makes occupancy experiments more reproducible across benchmark formats.

---

## Metrics

| Metric | Interpretation |
|---|---|
| Occupied IoU | Geometry quality for occupied vs empty space. |
| Semantic mIoU | Class quality over occupied voxels. |
| PQ / SQ / RQ | Panoptic quality, mask quality, and recognition quality for voxel instances. |
| Thing/stuff split | Separates movable foreground actors from background surfaces. |
| Open-vocabulary query IoU | Measures whether a text query localizes the right 3D region. |
| Free-space false negative rate | Safety metric for occupied space incorrectly predicted free. |
| Unknown/uncertain occupancy rate | Runtime assurance metric for areas where the model should abstain. |

For safety validation, add a planner-facing metric: whether the final occupancy grid would block, slow, reroute, or allow the vehicle in the correct cases. Voxel mIoU alone does not prove safe behavior.

---

## Failure Modes

- Camera-only occupancy can hallucinate geometry in occluded regions or miss low-contrast objects.
- Voxel resolution can erase thin or small hazards such as cables, straps, chocks, cones, and FOD.
- Panoptic grouping can split one large object into multiple instances or merge adjacent objects in clutter.
- Open-vocabulary labels can be semantically plausible but geometrically misplaced.
- Language alignment can overfit to image texture and ignore 3D evidence.
- Dense occupancy labels derived from existing datasets may inherit annotation gaps and class-taxonomy limits.
- Synthetic occupancy benchmarks may have clean geometry that overstates real-world performance under calibration, motion blur, rolling shutter, rain, or LiDAR sparsity.

---

## AV, Indoor, Outdoor, And Airside Relevance

| Environment | Fit | Notes |
|---|---|---|
| Public-road AV | Strong research fit | Occupancy is already central to camera-only and fused driving perception. |
| Airport apron | High potential | Dense geometry helps with aircraft clearances and irregular GSE, but public airport labels are missing. |
| Indoor robots | Strong conceptually | Occupancy and open-vocabulary querying are useful, though benchmarks differ. |
| Outdoor industrial sites | Strong | Handles irregular obstacles and open-world equipment better than boxes alone. |
| Runtime planning | Strong if calibrated | Planner needs conservative occupied/unknown/free states more than class names. |

For airside use, the best role is a conservative occupancy layer: aircraft envelopes, wings, engines, stands, cones, personnel, dollies, and unknown occupied voxels. Open-vocabulary labels should aid operator interpretation, not override geometry-based stopping rules.

---

## Validation And Data-Engine Use

1. Validate geometry first: occupied/free/unknown errors matter more than language labels near safety envelopes.
2. Slice by voxel height and size; many airside hazards are low-profile.
3. Compare camera-only, LiDAR-only, radar-assisted, and fused occupancy where sensors are available.
4. Treat unknown voxels as operationally meaningful, not as ignored background.
5. Log text queries, prompt templates, and embedding versions for reproducible open-vocabulary evaluation.
6. Use language queries to mine rare objects from logs, then convert reviewed findings into closed safety labels where needed.
7. Add local acceptance scenes for aircraft pushback, ULD train crossing, belt loader under wing, cone line, chock left in path, hose/cable across stand, and FOD on wet pavement.

---

## Sources

- [PanoOcc CVPR 2024 paper PDF](https://openaccess.thecvf.com/content/CVPR2024/papers/Wang_PanoOcc_Unified_Occupancy_Representation_for_Camera-based_3D_Panoptic_Segmentation_CVPR_2024_paper.pdf)
- [PanoOcc arXiv record](https://arxiv.org/abs/2306.10013)
- [PanoOcc GitHub repository](https://github.com/Robertwyq/PanoOcc)
- [LangOcc arXiv record](https://arxiv.org/abs/2407.17310)
- [LangOcc OpenReview PDF](https://openreview.net/pdf?id=KhjlXNbYea)
- [OpenOcc GitHub repository](https://github.com/wzzheng/OpenOcc)
- [OpenScene / occupancy benchmark repository](https://github.com/OpenDriveLab/OpenScene)
- [Instance-Centric Panoptic Occupancy / CarlaOcc arXiv record](https://arxiv.org/abs/2603.27238)
