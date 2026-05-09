# HKCD: Urban 3D Point Cloud Change Detection

**Last updated:** 2026-05-09

## Why It Matters

HKCD is a realistic urban-scale 3D point-cloud change-detection dataset from Hong Kong. It is useful for airport mapping research because it stresses the hard part of change detection: sparse real changes inside a huge mostly unchanged point cloud, with additions, removals, and replacements distributed across urban structures.

It is not an airport dataset. Its value is as a proxy for large-area 3D change labeling, long-tailed change distribution, and point-level evaluation before collecting airside-specific captures.

## Dataset Snapshot

| Item | HKCD / PGN3DCD | Airside relevance |
|---|---|---|
| Source paper | PGN3DCD: Prior-Knowledge-Guided Network for Urban 3D Point Cloud Change Detection | Method and dataset for point-level map-change detection |
| DOI | 10.1109/TGRS.2024.3436854 | Peer-reviewed TGRS source |
| Dataset | Hong Kong Change Detection (HKCD) | Realistic urban 3D point-cloud change proxy |
| Scale | About 8.1 km^2 and nearly 128 million annotated points | Comparable scale challenge to large airport surfaces |
| Labels | Binary changed/unchanged point labels | Useful first stage before semantic airport labels |
| Change types | Additions, subtractions/removals, replacements | Maps to new barriers, removed structures, replaced assets |
| Classes discussed | Buildings, terrain, street furniture, trees, vehicles | Airport-specific classes still missing |
| Method | Prior-knowledge-guided 3D change detection network | Shows value of explicit geometric/texture priors |

## What Transfers

| HKCD capability | Airside transfer | Required adaptation |
|---|---|---|
| Large bi-temporal point-cloud comparison | Compare previous airport survey tile to current fleet map | Airport ENU frame, survey control, and vehicle-pose uncertainty |
| Point-level binary change masks | Train a changed/unchanged detector | Add semantic labels for FOD, GSE, aircraft, markings, barriers |
| Long-tail class imbalance | Mirrors rare but critical airport changes | Report PR-AUC, mIoU, and safety-weighted recall |
| Added/removed point reasoning | Candidate map patch generation | Occlusion-aware negative evidence before deletion |
| Urban object replacement | Asset replacement or work-zone transition | Operations metadata and human review |
| Public code/dataset page | Reproducible baseline experiments | Confirm dataset access, license, and preprocessing before training |

## Benchmark Use

| Experiment | How to run | Airside learning |
|---|---|---|
| Binary changed-point baseline | Train/evaluate PGN3DCD or Siamese point model on HKCD | Establish expected performance on realistic urban changes |
| Add/remove split | Score old-time changed points as removals and new-time changed points as additions | Build separate thresholds for deletion vs insertion |
| Registration stress | Perturb alignment before inference | Quantify false changes from pose/map-frame error |
| Sparse-change stress | Downsample changed points or vary class prevalence | Understand recall under long-tail changes |
| Airport pretraining | Pretrain on HKCD, fine-tune on apron captures | Measure urban-to-airside transfer gap |
| Reviewer workload simulation | Cluster changed points into objects/regions | Estimate number of map QA tickets per airport shift |

## Airside Gaps

| Gap | Why it matters |
|---|---|
| No airport apron semantics | Aircraft, tugs, belt loaders, cones, chocks, jet bridges, and FOD have different policy treatment |
| Binary labels only | Airside needs permanent static, movable-static, current dynamic, hazard, artifact, and unknown/review |
| Photogrammetric point clouds | Vehicle LiDAR/radar/camera maps have different density, noise, occlusion, and viewpoints |
| Urban vertical structure bias | Apron changes include low-profile markings, painted surfaces, and small debris |
| No operational status | Airport map updates depend on closures, NOTAM/AIRAC, and sponsor approval |

## Recommended Metrics

| Metric | Why use it |
|---|---|
| Changed-point recall | Missing true map changes is the primary safety risk |
| Precision / false positives per hectare | Reviewer burden must remain manageable |
| mIoU changed vs unchanged | Standard point-level benchmark comparison |
| PR-AUC | Handles class imbalance better than accuracy |
| Added vs removed F1 | Insertions and deletions have different operational risks |
| Cluster-level recall | Map QA acts on objects/regions, not isolated points |
| Localization delta | A change detector is only useful if the updated map improves or preserves localization |

## Implementation Guidance

1. Use HKCD to harden 3D change-detection models before airside data exists, but do not claim airside validity from HKCD alone.
2. Preserve added and removed point sets separately. Airport deletion decisions require stronger evidence than insertion alerts.
3. Test sensitivity to registration error; false changes from misalignment can dominate real apron changes.
4. Convert point masks into object/region proposals before map QA. Human reviewers need clustered features with before/after evidence.
5. Fine-tune on airside captures with low-profile markings and small hazards, which are underrepresented in urban building/street-furniture data.
6. Add a policy layer after binary change detection so aircraft/GSE and FOD do not flow into the permanent static map.

## Sources

- PGN3DCD DOI: https://doi.org/10.1109/TGRS.2024.3436854
- HKCD dataset repository: https://github.com/zhanwenxiao/HKCD
- PGN3DCD code repository: https://github.com/zhanwenxiao/PGN3DCD
- DOI metadata summary: https://colab.ws/articles/10.1109%2Ftgrs.2024.3436854
- Local context: [Moved-Object and Map-Change Datasets](moved-object-and-map-change-datasets.md)
- Local context: [Airside Dynamic Map Cleaning Benchmark](../../../60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md)
