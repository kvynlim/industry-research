# LiDAR Map Cleaning and Dynamic Removal

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "LiDAR Map Cleaning and Dynamic Removal is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

## Executive Summary

LiDAR map cleaning removes transient, dynamic, ghost, and artifact points from accumulated point-cloud maps so localization, planning, QA, and annotation operate on a stable representation of the environment. It is broader than online moving-object segmentation. A production airside stack needs both runtime dynamic masks and offline static-map cleaning.

Core methods include ERASOR, Removert, MapCleaner, ERASOR++, 4dNDF, and MOS-style evaluation such as LiDAR-MOS and HeLiMOS. The safest map lifecycle separates four layers:

- Static persistent map: surveyed structure used for localization.
- Movable-static layer: aircraft, GSE, cones, barriers, and staged equipment.
- Dynamic layer: moving objects observed during a run.
- Artifact layer: weather, ghost, multipath, saturation, and sensor contamination.

## Technique Taxonomy

| Family | Methods | Main evidence | Best use |
|---|---|---|---|
| Visibility/range-image cleaning | Removert | Query-to-map range inconsistency and multiresolution revert | Offline map cleaning with pose uncertainty. |
| Pseudo-occupancy cleaning | ERASOR | Egocentric pseudo-occupancy ratio and ground refinement | Removing object traces from accumulated maps. |
| Terrain and voting cleaning | MapCleaner | Terrain model, object-part separation, local observation voting | Learning-free map cleaning with ground-aware processing. |
| Enhanced occupancy coding | ERASOR++ | Height coding descriptor and dynamic-bin tests | More precise occupancy-based dynamic bin identification. |
| Neural implicit 4D mapping | 4dNDF | Time-dependent TSDF, sparse feature grids, learned static extraction | Research-grade dynamic scene reconstruction and map extraction. |
| Online MOS | LiDAR-MOS, 4DMOS, HeLiMOS-style evaluation | Moving/static point labels over time | Runtime masking and dataset evaluation. |
| Multi-session consensus | Fleet map lifecycle | Persistence across days/shifts | Production promotion or rejection of map changes. |

## Map Lifecycle Pipeline

1. Collect synchronized LiDAR, pose, GNSS/INS, wheel/IMU, weather, and sensor-health logs.
2. Produce a high-quality trajectory using LIO/SLAM plus loop closure and control points.
3. Build an initial raw map and preserve raw scan provenance.
4. Apply runtime dynamic masks if available, but do not trust them as final map truth.
5. Run offline cleaning with ERASOR, Removert, MapCleaner, ERASOR++, or another validated method.
6. Compare multiple cleaners or parameter sets and inspect disagreement.
7. Assign map points to static, movable-static, dynamic, artifact, or unknown layers.
8. Validate localization on the cleaned map and on raw-map baseline.
9. Publish a map package with cleaner configuration, diagnostics, and QA evidence.
10. Update production maps only through change-control and multi-session evidence.

## Deployment Decision Rules

| Scenario | Rule |
|---|---|
| Single survey pass with aircraft present | Do not promote aircraft surfaces into the static localization map. |
| Same object appears across one shift | Keep in movable-static or unknown until cross-session policy confirms persistence. |
| Cleaner removes static stand equipment | Reject or retune the map build; static erosion is a localization risk. |
| Cleaner disagreement is high | Route segment needs manual QA or more data. |
| Dynamic ratio is high in a segment | Add a dedicated quiet survey or use multi-session cleaning. |
| Open apron has low static inlier count after cleaning | Use additional anchors, GNSS/INS, radar, or map landmarks; do not over-clean. |
| Wet or reflective artifacts appear in map | Use artifact layer and avoid training/localization on those points. |

## Method Comparison

| Method | Strength | Weakness | Airside note |
|---|---|---|---|
| ERASOR | Fast, explainable pseudo-occupancy and ground-aware removal | Can erode static structure under pose/sparsity issues | Strong baseline for vehicle/person traces; validate around aircraft gear and stand objects. |
| Removert | Revert stage helps recover false removals from pose/projection error | Needs good poses and range-image adaptation | Good for preserving static airport geometry after aggressive removal. |
| MapCleaner | Terrain model plus observation voting; learning-free | Terrain assumptions can fail with ramps, curbs, and unusual apron equipment | Useful where ground/object separation is reliable. |
| ERASOR++ | Adds height coding and tests to improve bin decisions | Newer research baseline; implementation maturity must be checked | Promising for complex vertical structure. |
| 4dNDF | Learns a time-dependent implicit representation and extracts static map | GPU/optimization cost and research-stage deployment | Useful for offline QA and future dense reconstruction, not first production cleaner. |
| MOS networks | Runtime dynamic labels; can catch moving actors early | Training-domain and sensor-pattern sensitivity | HeLiMOS-style multi-LiDAR evaluation is valuable for airside rigs. |

## Failure Modes

- Dynamic objects parked during mapping become persistent static clutter.
- Temporarily absent static objects are interpreted as removed infrastructure.
- Static erosion removes thin or low structures needed by localization.
- Ground segmentation mistakes remove ramps, curbs, chocks, tow bars, or aircraft gear.
- Pose error creates false disagreement and aggressive removal.
- Learned dynamic masks fail on airport-specific classes not present in road datasets.
- Cleaned maps improve appearance but reduce scan-matching observability.

## Airside Validation Guidance

Build validation sets from:

- Quiet survey passes and busy operational passes on the same route.
- Stands with aircraft present and absent.
- GSE staging areas across multiple shifts.
- Wet and dry apron captures.
- Night and day captures with reflective markings.
- De-icing and winter operations where allowed.
- Repeated gate layouts to test localization aliasing.

Metrics:

- Static preservation rate by infrastructure class.
- Dynamic rejection rate by actor class.
- Movable-static classification accuracy.
- Map ghost rate per 100 m or per stand.
- Localization ATE/RPE, residual, inlier count, and degeneracy.
- Change-detection precision across map versions.
- Manual QA burden per kilometer or per stand.

## Implementation Notes

- Store point provenance: source scan, timestamp, pose, cleaner decision, and map layer.
- Use a rejected-points review workflow; do not discard dynamic or artifact layers.
- Compare ERASOR and Removert as complementary baselines before adopting a single default.
- Use MapCleaner/ERASOR++/4dNDF as evaluation candidates where their assumptions match the data.
- Treat 4dNDF as offline research/QA until runtime, uncertainty, and maintainability are proven.
- Use HeLiMOS-style labels to evaluate multi-LiDAR rigs separately and after fusion.

## Sources

- ERASOR paper: https://arxiv.org/abs/2103.04316
- ERASOR repository: https://github.com/LimHyungTae/ERASOR
- Removert repository: https://github.com/gisbi-kim/removert
- Removert paper record: https://snu.elsevierpure.com/en/publications/remove-then-revert-static-point-cloud-map-construction-using-mult
- MapCleaner: https://www.mdpi.com/2072-4292/14/18/4496
- ERASOR++: https://arxiv.org/abs/2403.05019
- 4dNDF paper: https://arxiv.org/abs/2405.03388
- 4dNDF repository: https://github.com/PRBonn/4dNDF
- HeLiMOS dataset: https://sites.google.com/view/helimos/dataset
- HeLiMOS toolbox: https://github.com/url-kaist/HeLiMOS-PointCloud-Toolbox
