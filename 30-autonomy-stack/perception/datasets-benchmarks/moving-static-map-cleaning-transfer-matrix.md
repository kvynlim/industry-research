# Moving/Static Map-Cleaning Transfer Matrix

**Last updated:** 2026-05-09

## Why It Matters

Moving/static perception data does not transfer directly into map-cleaning policy. A MOS model can say a point is moving now; a map builder must decide whether a point belongs in a permanent static map, a movable-static layer, a current-world dynamic layer, or a review queue.

For airside autonomy, this distinction is central. Aircraft, tugs, belt loaders, buses, cones, barriers, chocks, dollies, and people can all be static in one pass and invalid for a persistent map in the next.

## Transfer Matrix

| Source family | Evidence type | Transfers well to map cleaning | Does not transfer directly | Airside action |
|---|---|---|---|---|
| SemanticKITTI-MOS / LiDAR-MOS | Point-wise static/moving labels on road LiDAR sequences | Baseline loaders, IoU metrics, road actor motion | Aircraft/GSE semantics, low-speed apron motion, multi-LiDAR rigs | Use for pipeline bring-up only |
| MF-MOS / CV-MOS | Range/residual-map learned MOS with strong SemanticKITTI scores | Modern learned dynamic masks and residual-feature baselines | Sensor pattern changes and movable-static policy | Evaluate after LiDAR-MOS/4DMOS baselines |
| 4D-CS | Multi-scan semantic and moving-state segmentation with cluster priors | Temporal consistency and object-level coherence | Map deletion thresholds and airport classes | Use as a consistency reference, not a map cleaner |
| HeLiMOS | MOS labels across four heterogeneous LiDAR sensors | Sensor-transfer stress test, solid-state scan-pattern issues | Airport actors and permanent map decisions | Run per-sensor before fused-airside MOS |
| MOE | Dense moving-event labels and MED benchmark | Dense dynamic stress tests, online/offline method comparison | Static preservation and map lifecycle policy | Add PR/RR and latency metrics before map use |
| M-detector | Point-stream moving-event output | Low-latency motion cue, training-data-free prefilter | Class, instance, and permanent-map validity | Use as advisory dynamic evidence |
| KTH Dynamic Map Benchmark | Clean-map output comparison and PR/RR-style evaluation | Map-level preservation/rejection workflow | Apron hazards, FOD, and movable-static classes | Reuse benchmark structure with local labels |
| ROADWork / RoSA | Camera work-zone objects and closed-zone masks | Cone/barrier taxonomy and temporary zone continuity | LiDAR map points and 3D static-map labels | Use for visual temporary-zone context |
| Local airside logs | Full sensor suite, poses, maps, and operational context | Final acceptance and safety-case evidence | General leaderboard comparability | Required before production map release |

## Map-Layer Policy

| Layer | Includes | Promotion rule | Removal rule |
|---|---|---|---|
| Permanent static | Buildings, poles, stand geometry, stable markings, fixed barriers | Multi-session agreement and localization benefit | Remove only after confirmed construction/change control |
| Movable-static | Parked GSE, staged carts, cones, barriers, chocks, temporary signs | Promote only with explicit operations decision | Quarantine or expire after absence across sessions |
| Current dynamic | Moving people, vehicles, aircraft, carts, sweeping equipment | Never promote to permanent map | Remove from mapping immediately but keep for current-world tracking |
| Hazard/FOD | Debris, small obstacles, unexpected objects | Keep as alert or review layer, not static map | Clear only after inspection, disappearance, or human confirmation |
| Artifact | Spray, dust, reflections, multipath, registration outliers | Never promote | Filter by sensor artifact logic and cross-sensor checks |
| Unknown/review | Disagreement between methods or sessions | Human or fleet-review decision | Time out only under defined map-governance policy |

## Metric Transfer

| Metric | Source benchmark | Map-cleaning interpretation | Airside threshold hint |
|---|---|---|---|
| Moving IoU | SemanticKITTI-MOS, HeLiMOS, MOE | Quality of point-wise dynamic masks | Gate by actor/range/speed, not only mean |
| Static IoU | MOS benchmarks | Risk of over-removing static points | Must stay high in localization-critical zones |
| MED latency | M-detector, MOE-style online tests | Time before moving points are blocked from map integration | Report point-out and frame-out separately |
| PR | KTH / HeLiMOS static map building | Fraction of valid static map retained | Near-zero erosion for stand geometry and markings |
| RR | KTH / HeLiMOS static map building | Fraction of dynamic/transient points rejected | High near stands, crossings, and GSE lanes |
| Ghost rate | Local map QA | Remaining transient structure per tile or stand | Direct operational QA metric |
| Localization delta | Local SLAM/localization replay | Whether cleaning improves or harms localization | Reject visually clean maps that hurt localization |
| False-free-space rate | Airside safety validation | Cleaning implies free space where hazard exists | Treat as safety-critical |

## Method Selection

| Deployment stage | Candidate methods | Success signal | Stop condition |
|---|---|---|---|
| Format bring-up | LiDAR-MOS, SemanticKITTI-MOS loaders | Reproduced public metric code | Label remap or pose alignment mismatch |
| Sensor transfer | 4DMOS, HeLiMOS baselines, MF-MOS/CV-MOS | Per-sensor scores remain stable | One sensor dominates failures hidden by fusion |
| Dense dynamics | MOE baselines, M-detector, Dynablox/DOD | Dynamic recall under crowded motion | High static erosion or missed slow motion |
| Offline map cleaning | ERASOR, Removert, MapCleaner, KTH benchmark tools | High PR/RR and better localization replay | Cleaner deletes localization landmarks |
| Airside acceptance | Best two independent cleaners plus human review | Low ghost rate, low false-free-space, stable route localization | Disagreement near aircraft, people, FOD, or temporary closures |

## Validation Guidance

1. Do not use MOS IoU as the only map-cleaning gate. Add PR, RR, ghost rate, false-free-space, and localization delta.
2. Separate "moving now" from "movable but static now" in labels and map layers.
3. Require cross-session evidence before deleting or promoting cones, barriers, parked GSE, and aircraft-adjacent equipment.
4. Keep rejected points and method disagreement as auditable artifacts for map QA.
5. Use ROADWork/RoSA-style temporary-zone perception to explain why a map tile is quarantined, not to write LiDAR map geometry.
6. For production airside maps, run at least two independent cleaners and require reviewer signoff in high-consequence zones.

## Sources

- SemanticKITTI MOS task: https://semantic-kitti.org/tasks.html
- MF-MOS arXiv: https://arxiv.org/abs/2401.17023
- CV-MOS arXiv: https://arxiv.org/abs/2408.13790
- 4D-CS arXiv: https://arxiv.org/abs/2501.02937
- HeLiMOS dataset: https://sites.google.com/view/helimos/dataset
- MOE dataset repository: https://github.com/DeepDuke/MOE-Dataset
- M-detector paper: https://www.nature.com/articles/s41467-023-44554-8
- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- ROADWork project: https://www.cs.cmu.edu/~ILIM/roadwork_dataset/
- RoSA OpenReview: https://openreview.net/forum?id=ygF6aFhdxC
- Local context: `30-autonomy-stack/localization-mapping/slam-methods/dynamic-map-cleaning-benchmarks.md`
- Local context: `60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md`
