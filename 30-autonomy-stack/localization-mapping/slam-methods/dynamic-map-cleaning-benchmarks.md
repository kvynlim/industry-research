# Dynamic Map Cleaning Benchmarks

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "benchmark"
  stage: "reference"
  maturity: "fielded-pattern"
  tags: ["slam", "validation", "data-engine", "outdoor"]
  reason: "Dynamic Map Cleaning Benchmarks is rated as a SLAM benchmark or reference page for comparing methods and deployments."
method-priority:end -->

**Last updated:** 2026-05-09

## Why It Matters

Dynamic map cleaning removes ghost trails, parked-then-removed objects, moving actors, and transient clutter from point-cloud maps. It is not the same as runtime obstacle detection. A cleaned map is used for localization, simulation, annotation, map QA, and change control, so false deletion of static structure can be as damaging as leaving dynamic ghosts behind.

For airside autonomy, the risk is amplified: aircraft, tugs, carts, buses, cones, barriers, and service equipment can dominate a survey pass but should not automatically become permanent localization structure.

## Dataset/Benchmark Table

| Benchmark / method | Source URL | Scope | Evaluation style | Best use | Main transfer risk |
|---|---|---|---|---|---|
| KTH Dynamic Map Benchmark | https://kth-rpl.github.io/DynamicMap_Benchmark/ | Unified dynamic-point removal benchmark for point-cloud maps; includes KITTI, Argoverse 2, KTH campus, semi-indoor, and two-floor sequences | Methods output clean maps; evaluation extracts labels from the output cloud and compares against human-labeled ground truth where available | Reproducible comparison across offline and online cleaners such as OctoMap variants, ERASOR, Removert, Dynablox, DUFOMap, BeautyMap, and DeFlow | Some sequences have no ground truth; road/campus/semi-indoor data does not capture aircraft-scale movable objects |
| ERASOR | https://github.com/LimHyungTae/ERASOR | Egocentric pseudo-occupancy ratio and ground-aware refinement for static 3D map building | Preservation/rejection style metrics on SemanticKITTI-derived labels | Strong explainable offline baseline for removing dynamic traces while preserving ground | Pose error, sparse scan patterns, and ground-plane assumptions can erode ramps, curbs, low objects, or aircraft gear |
| Removert | https://github.com/gisbi-kim/removert | Multiresolution range-image remove-then-revert map construction | Validated on KITTI using SemanticKITTI labels as dynamic/static ground truth | Complementary baseline that explicitly recovers likely false removals | Requires good poses and projection parameters; parked objects seen consistently can remain static |
| MapCleaner | https://www.mdpi.com/2072-4292/14/18/4496 | Terrain modeling plus local-observation voting for moving-point identification | Reports PR, RR, and score on SemanticKITTI sequences 00, 01, 02, 05, and 07 | Learning-free map cleaning with explicit terrain/object separation | Terrain model can fail on non-road surfaces, overhangs, ramps, and apron equipment |

## Metrics

| Metric | Definition / reporting guidance | Acceptance signal |
|---|---|---|
| Preservation rate (PR) | Fraction of ground-truth static map points retained in the clean map | High PR for localization landmarks, lane/stand markings, poles, curbs, terminal edges, and docking features |
| Rejection rate (RR) | Fraction of ground-truth dynamic points removed from the clean map | High RR for moving or transient vehicles, people, carts, buses, and aircraft/GSE ghosts |
| Combined score | Benchmark-specific aggregate of preservation and rejection, reported with PR and RR rather than alone | Useful for ranking, but do not let a high score hide static erosion in safety-critical areas |
| Static erosion by class | False removal rate for ground, walls, poles, signs, curbs, chocks, stand equipment, and aircraft-adjacent infrastructure | Near-zero erosion for features used by localization or collision margins |
| Ghost rate | Remaining dynamic or transient points per 100 m, per stand, or per map tile | Low ghost density in planning and localization layers |
| Localization impact | Scan-to-map residuals, inlier ratio, covariance, ATE/RPE, and relocalization success before and after cleaning | Cleaned map must improve or preserve localization health |
| Runtime and resource use | Offline processing time per km or per stand, memory, GPU/CPU, and parameter sensitivity | Predictable processing for fleet map operations |

## Airside/Indoor/Outdoor Transfer

| Domain | What transfers | What must be revalidated |
|---|---|---|
| Road driving | Dynamic vehicle and pedestrian trails, SemanticKITTI/KITTI formatting, range-image and occupancy baselines | Aircraft geometry, low-speed GSE, repetitive stands, reflective paint, open concrete, and temporary ramp equipment |
| Campus / semi-indoor | People around platforms, clutter, repeated scans, non-road movement | Airside traffic rules, large moving aircraft, equipment staging, and apron weather exposure |
| Indoor multi-floor | Irregular LiDAR patterns, non-road structure, vertical complexity | Long-range outdoor map quality, GNSS/INS alignment, and geodetic map control |
| Airside | Map lifecycle policy, movable-static layering, aircraft-present/absent comparisons | Must be measured with local sensors, local ODD, and airport operations constraints |

## Validation Guidance

1. Benchmark at least ERASOR, Removert, and MapCleaner on the same input maps before selecting a default cleaner.
2. Preserve raw scans, poses, and rejected points. A production map package should be auditable back to the source observations and cleaner decisions.
3. Run cleaning on both quiet survey passes and busy operational passes. A cleaner that only works on sparse dynamics is not enough for aircraft stands.
4. Compare localization on raw, cleaned, and over-cleaned maps. Reject a cleaner if the map looks cleaner but localization residuals, degeneracy, or relocalization failures worsen.
5. Keep movable-static objects in a separate layer until cross-session evidence decides whether they are persistent infrastructure, temporary equipment, or dynamic clutter.
6. Add fault injection: pose jitter, missing LiDAR, time offset, wet ground, nighttime reflections, and low static-feature apron segments.

## Sources

- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- KTH Dynamic Map Benchmark repository: https://github.com/KTH-RPL/DynamicMap_Benchmark
- Dynamic Points Removal Benchmark paper: https://arxiv.org/abs/2307.10593
- ERASOR paper: https://arxiv.org/abs/2103.04316
- ERASOR repository: https://github.com/LimHyungTae/ERASOR
- Removert repository: https://github.com/gisbi-kim/removert
- Removert paper record: https://snu.elsevierpure.com/en/publications/remove-then-revert-static-point-cloud-map-construction-using-mult
- Removert paper PDF: https://gisbi-kim.github.io/publications/gkim-2020-iros.pdf
- MapCleaner article: https://www.mdpi.com/2072-4292/14/18/4496
