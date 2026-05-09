# Map Cleaning False Deletion Test Protocol

**Last updated:** 2026-05-09

False deletion is the safety-critical failure mode where a map-cleaning pipeline removes real structure, real hazards, or review-required evidence. This protocol validates that dynamic-object removal does not create an over-cleaned map that looks tidy but is less truthful.

## Scope

| Include | Exclude |
|---|---|
| offline point-cloud map cleaning, rejected-layer review, localization replay, semantic map checks | runtime obstacle deletion decisions |
| static assets, movable-static assets, FOD-like objects, unknown/occluded regions | general perception model benchmarking |
| airside stands, service roads, apron routes, terminal edges, gate equipment zones | final airport-wide operating approval by itself |

## Required Inputs

| Input | Minimum requirement |
|---|---|
| Raw survey logs | LiDAR packets/frames, camera where available, ego pose, TF, timestamps, calibration |
| Candidate map | raw accumulated map, cleaned static map, removed layer, restored layer, unknown layer |
| Ground truth | ASAM OpenLABEL or equivalent IDs for static, movable-static, dynamic, FOD/hazard, artifact, unknown |
| Map context | tile ID, route/stand, ODD slice, semantic map version, coordinate frame, release target |
| Cleaner record | algorithm, model/config version, thresholds, commit/package hash, operator |

## Procedure

| Step | Action | Pass evidence |
|---|---|---|
| 1 | Freeze raw logs, labels, and cleaner configuration | immutable manifest with checksums |
| 2 | Run cleaner on baseline and holdout sequences | reproducible command and output bundle |
| 3 | Compare removed layer against ground truth | false-deletion table by class and zone |
| 4 | Inspect safety-critical removals manually | reviewer disposition with screenshot or point-cloud view |
| 5 | Replay localization on raw and cleaned maps | residual, covariance, inlier, and relocalization report |
| 6 | Validate semantic map consistency | Lanelet2/vector diff and geometry tolerance report |
| 7 | Package unresolved risks | waiver, quarantine, rollback, or remediation decision |

## Test Matrix

| Scenario | False deletion target | Required slices |
|---|---|---|
| Quiet baseline survey | permanent static assets | dry/day and at least one low-light or wet slice if in ODD |
| Busy stand survey | static assets behind aircraft/GSE | aircraft present, aircraft absent, GSE staged, GSE removed |
| FOD placed-object run | low-height hazards | small metal, rubber, plastic, fabric, reflective object |
| Movable-static run | cones, chocks, barriers, carts | approved overlay, unapproved temporary, moved between sessions |
| Sparse LiDAR run | thin poles, curbs, low fixtures | range bins, beam dropout, pose jitter |
| Hard-negative run | markings, cracks, drains, rubber deposits | no FOD and no temporary asset present |
| Regression run | previous map incidents and near misses | exact map/version/config reproduction |

## Metrics

| Metric | Report by | Gate |
|---|---|---|
| False deletion rate | class, tile, route, range, weather, LiDAR density | zero unresolved for safety-critical classes |
| Static preservation rate | asset class and localization feature class | above release threshold before publication |
| FOD evidence retention | object, size, material, corridor | all placed hazardous FOD has retained evidence |
| Unknown-to-free error | occluded or unobserved region | zero in planner-consumed layers |
| Localization degradation | route segment and stand | no release-zone regression beyond threshold |
| Reviewer agreement | sampled removed objects | disagreement triggers tile quarantine or relabeling |

## Acceptance Rules

| Rule | Rationale |
|---|---|
| A clean visual map is not an acceptance criterion. | visual cleanliness can hide false deletion |
| Removed points are safety evidence and must be archived. | incident review needs the evidence that was deleted |
| FOD-like removals require explicit disposition. | temporary and small does not mean safe to erase |
| Unknown space must remain unknown. | map cleaning must not assert current free space |
| Localization replay is mandatory. | preserved points matter because the vehicle must localize |
| Thresholds are locked before the holdout run. | prevents acceptance-set tuning |
| Quarantined tiles cannot be silently published. | unresolved uncertainty must not reach production |

## Release Artifact

| Artifact | Contents |
|---|---|
| False-deletion report | metric tables, examples, reviewer decisions, unresolved risks |
| Rejected-layer archive | removed, restored, and unknown points with provenance |
| Localization replay report | raw vs cleaned map comparison and failure cases |
| Semantic diff | vector/point-cloud consistency and topology checks |
| Publication decision | accept, accept with overlay, quarantine, rerun, or reject |

## Sources

- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- Dynamic Points Removal Benchmark paper: https://arxiv.org/abs/2307.10593
- MapCleaner article: https://www.mdpi.com/2072-4292/14/18/4496
- RI-DVP sparse LiDAR map-cleaning article: https://www.mdpi.com/2072-4292/18/5/821
- ASAM OpenLABEL: https://www.asam.net/standards/detail/openlabel/
- Autoware Lanelet2 map validator: https://github.com/tier4/autoware_lanelet2_map_validator
- Lanelet2 validation package: https://docs.ros.org/en/humble/p/lanelet2_validation/
- Local context: airside-dynamic-map-cleaning-benchmark.md
