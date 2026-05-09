# ExelMap: Element-Based HD Map Change Detection and Update

**Last updated:** 2026-05-09

## Why It Matters

ExelMap reframes HD map maintenance from "is this frame inconsistent with the map?" to "which map element changed, and should the element be inserted, deleted, or preserved?" That distinction is operationally important because fleet map updates need reviewable evidence, not only a scalar anomaly score.

For airside autonomy, the same pattern applies to stand lead-in lines, stop bars, service-road markings, temporary construction geometry, barrier placements, and docking landmarks. A vehicle can detect a discrepancy, but map operations need the exact element, change type, persistence evidence, and rollback impact before publishing a map tile.

## Paper Snapshot

| Item | ExelMap position | Airside interpretation |
|---|---|---|
| Core task | Explainable element-based HD map change detection and update | Identify the changed stand, marking, lanelet, barrier, or map feature rather than only flagging the route |
| Inputs | 360-degree camera features plus stale HD map prior | Sensor evidence plus active airport map tile |
| Backbone | LaneSegNet-style vector map generation | Compatible with lanelet/segment representations, but airport semantics need custom classes |
| Prior encoding | Geometry and semantic attributes from the stale map | Use prior linework, markings, and feature type as a second input |
| Change heads | Separate element-wise insertion and deletion heads | Produce reviewable "add this feature" and "remove this feature" proposals |
| Output | Updated local HD map plus change map | Candidate map patch plus audit trail |
| Demonstration | Argoverse 2 Map Change/TbV pedestrian-crossing changes | Road-crossing evidence, not direct apron validation |

## What It Adds

| Problem with prior work | ExelMap response | Practical value |
|---|---|---|
| Frame-level change labels do not say what changed | Element-level change status | Human reviewers can inspect specific elements |
| Standard mAP hides whether a model updated the stale region | Separate change-detection and updated-map evaluation views | Avoids inflated results from simply copying most unchanged prior elements |
| Prior-aided generation can silently pass stale map content through | Explicit change heads beside generation heads | Makes the "trusted prior vs current sensor" decision visible |
| Synthetic changes may not generalize to real changes | Evaluation on real Argoverse 2 map changes | Useful warning for airside synthetic-change generators |
| Single-frame evidence is unstable under occlusion | Paper identifies need for true multi-frame handling | Airside deployment should aggregate across passes before map publication |

## Evaluation Checklist

| Evaluation question | Metric family | Airside acceptance use |
|---|---|---|
| Did the system detect that any change exists? | Type-agnostic change/no-change accuracy | Alert routing and tile quarantine |
| Did it detect the right change type? | Type-aware insertion/deletion accuracy | Decide whether to add, delete, or keep a feature |
| Did it localize the changed element? | Changed-element IoU/localization accuracy | Send a precise patch to map QA |
| Is the updated map geometrically good? | LaneSegNet-style AP on updated map | Confirm planner/localizer quality after patch |
| Is unchanged prior preserved? | Unchanged-element preservation | Prevent map erosion from noisy perception |
| Does evidence persist over time? | Multi-frame or multi-pass aggregation | Required before publishing an airside static-layer update |

## Airside Translation

| Airside element | Candidate change | Default policy |
|---|---|---|
| Stand lead-in/lead-out marking | Inserted, repainted, shifted, removed | Quarantine tile and require visual or survey review |
| Service-road lanelet | Geometry or lane-count change | Require multi-pass evidence and route-regression test |
| Stop bar / hold line | Inserted, deleted, shifted | Human approval; never auto-delete from production map |
| Temporary barrier / cone line | Inserted obstacle or work-zone edge | Live restriction first; static map update only if persistent and approved |
| GSE parking outline | Repainted or newly observed marking | Low-risk update if repeated and not conflicting with airport ops data |
| Aircraft/GSE object | Apparent deletion/insertion in point cloud | Do not update permanent map; route to movable-static or dynamic layer |

## Implementation Guidance

1. Keep the ExelMap-style "change map" separate from the updated map. The change map is the review artifact; the updated map is only a candidate product.
2. Extend the change vocabulary beyond insertion/deletion before airside use: geometry edit, marking type, regulatory status, topology, movable-static, and unknown.
3. Do not rely on standard map-generation mAP alone. Report update quality separately for changed and unchanged elements.
4. Require temporal evidence for any deletion. A missing marking can be occluded by aircraft, wet surface glare, snow, service vehicles, or camera exposure.
5. Apply stricter thresholds near aircraft stands, hold points, terminal edges, and pedestrian crossings than on open service roads.
6. Store original prior element ID, proposed replacement geometry, sensor frames, timestamp, vehicle pose quality, and reviewer decision with every candidate patch.
7. Use ExelMap as a design pattern, not a deployable airside model: its public experiment focuses on pedestrian crossings in road scenes.

## Fit With Existing Map Stack

| Existing repo concept | ExelMap connection |
|---|---|
| `moved-object-and-map-change-datasets.md` | ExelMap is the element-level complement to scenario/frame-level map-change datasets |
| `hd-map-change-detection-maintenance.md` | Supplies the detection/update primitive needed by fleet map maintenance |
| `map-tile-versioning-distribution.md` | Candidate element patches should become tile diffs only after QA and localization regression |
| `lt-mapper-khronos-lifelong-mapping.md` | Multi-session lifelong evidence should decide promotion, not a single ExelMap frame |

## Sources

- ExelMap arXiv abstract and paper: https://arxiv.org/abs/2409.10178
- ExelMap HTML version: https://ar5iv.org/html/2409.10178v1
- Argoverse 2 Map Change Dataset overview: https://www.argoverse.org/av2.html
- Argoverse TbV user guide: https://argoverse.github.io/user-guide/datasets/map_change_detection.html
- Trust, but Verify paper: https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/file/2b8a61594b1f4c4db0902a8a395ced93-Paper-round2.pdf
- Local context: [Moved-Object and Map-Change Datasets](moved-object-and-map-change-datasets.md)
- Local context: [HD Map Change Detection, Maintenance, and Fleet-Based Updates](hd-map-change-detection-maintenance.md)
