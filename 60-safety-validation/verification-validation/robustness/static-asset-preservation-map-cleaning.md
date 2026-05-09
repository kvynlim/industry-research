# Static Asset Preservation in Map Cleaning

**Last updated:** 2026-05-09

Dynamic-object removal is only acceptable when it preserves the static structure that localization, planning, geofencing, and operator review depend on. A cleaner that removes parked vehicles but also erodes curbs, stand markings, terminal edges, poles, gates, or docking aids has reduced map clutter by creating a safety defect.

This page defines the static-preservation validation case for airside LiDAR map cleaning.

## Preservation Claim

For the approved airside ODD and map layer, the map-cleaning pipeline removes transient dynamic clutter while preserving surveyed or repeatedly observed static assets that are required for localization, semantic map alignment, operational boundaries, and safety review.

The claim is limited to the sensor rig, map resolution, cleaner version, route/stand set, weather slices, and review process in the release evidence package.

## Asset Classification

| Asset class | Examples | Map treatment | Review owner |
|---|---|---|---|
| Permanent static | Terminal walls, jet bridge fixed bases, light poles, hydrants, curbs, surveyed stand markings | Preserve in localization or semantic layer | Mapping lead |
| Safety static | stop bars, hold lines, restricted-area paint, service-road boundaries | Preserve and cross-check against vector map | Safety and airport ops |
| Movable-static | cones, chocks, barriers, dollies, belt loaders, parked buses, staged carts | Keep out of permanent layer unless approved as an overlay | Map operations |
| Current dynamic | aircraft, tugs, people, moving GSE, temporary work crew | Remove from static layer; retain as replay evidence | Perception and ops |
| FOD/hazard | debris, loose hardware, straps, pavement fragments | Do not erase as noise; preserve as alert evidence | Safety and FOD owner |
| Unknown/review | occluded, sparse, low-confidence, or disagreement regions | Quarantine tile or require human review | Release approver |

## Test Matrix

| Static feature | False deletion mode | Required test slice | Evidence to keep |
|---|---|---|---|
| Stand and service-road markings | Removed as low-height ground clutter | wet/dry, day/night, worn paint | before/after point cloud, intensity image, line residual |
| Curbs and wheel stops | Removed by terrain or ground filters | shallow incidence, sparse range, near aircraft stand | cross-section profile and retained-point ratio |
| Poles and signs | Removed as isolated outliers | open apron, terminal edge, reflective surfaces | object-level retention and localization impact |
| Docking aids and fixed cabinets | Classified as parked equipment | aircraft present/absent paired sessions | asset ID, bounding volume, reviewer decision |
| Terminal glass/edges | Over-cleaned due to multipath | sun glare, night lighting, wet surface | raw scans, rejected points, ghost/real label |
| Low fixtures | Removed as FOD/noise | chocks nearby, hoses, drains, covers | semantic label and close-range inspection |

## Metrics

| Metric | Definition | Gate use |
|---|---|---|
| Static preservation rate | retained ground-truth static points divided by all ground-truth static points | Primary preservation metric by asset class |
| Static erosion by asset | false-deleted points or cells inside an approved static asset volume | Blocks publication for safety-critical assets |
| Localization delta | change in NDT/ICP residuals, inliers, covariance, relocalization success, ATE/RPE | Cleaned map must not degrade localization in release zones |
| Semantic alignment delta | distance between retained point cloud features and Lanelet2/vector features | Protects stop lines, boundaries, stands, and route graph |
| Removed-layer review rate | percentage of rejected points accepted as legitimate deletion by human review | Detects overly aggressive cleaners |
| Quarantine rate | percentage of tiles requiring unknown/review disposition | Measures operational scalability |

## Publication Gates

| Gate | Pass condition | Blocker |
|---|---|---|
| Source provenance | raw scans, poses, calibration, map version, cleaner config, and rejected layer are archived | missing rejected points or untraceable cleaner version |
| Ground-truth coverage | every safety-critical asset class has labels in affected zones | only aggregate PR/RR metrics are available |
| Localization replay | candidate map is neutral or better on residuals, inliers, covariance, and recovery | scan matching worsens in any approved route segment |
| Semantic validation | vector map and point cloud agree within the site tolerance | disconnected, shifted, or stale semantic features |
| Human review | false deletions are resolved or tile is quarantined | reviewer cannot inspect before/after evidence |
| Rollback | prior map bundle and compatible config remain deployable | no signed rollback target |

## Release Checklist

1. Freeze the raw survey bundle and cleaner configuration before running acceptance metrics.
2. Score static preservation per asset class, not only aggregate map-cleaning score.
3. Compare at least one conservative baseline and one production candidate on the same logs.
4. Review the rejected layer around stands, gates, pedestrian paths, and service-road boundaries.
5. Run localization replay on raw, cleaned, and candidate-over-cleaned maps.
6. Keep movable-static assets out of the permanent map unless a lifecycle policy approves them.
7. Link every accepted false deletion to a reviewer decision or a non-safety artifact class.
8. Reject or quarantine any tile with unresolved erosion of safety-critical static structure.

## Sources

- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- Dynamic Points Removal Benchmark paper: https://arxiv.org/abs/2307.10593
- MapCleaner article: https://www.mdpi.com/2072-4292/14/18/4496
- RI-DVP sparse LiDAR map-cleaning article: https://www.mdpi.com/2072-4292/18/5/821
- Autoware map component design: https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture/map/
- Autoware NDT scan matcher: https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- Local context: ../airside-dynamic-map-cleaning-benchmark.md
