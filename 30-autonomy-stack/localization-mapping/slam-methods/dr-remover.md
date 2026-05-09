# DR-REMOVER

**Last updated:** 2026-05-09

## Executive Summary

DR-REMOVER is an offline dynamic-object remover for static 3D point-cloud map construction. Its full title is "DR-REMOVER: An Efficient Dynamic Object Remover Using Dual-Resolution Occupancy Grids for Constructing Static Point Cloud Maps."

The key idea is dual resolution: coarse grids quickly find regions likely to contain dynamic objects, and fine grids verify dynamic points while reverting static points that were removed too aggressively.

## What It Is

The paper appears in IEEE Transactions on Intelligent Vehicles, volume 9, issue 12, pages 8027-8039, 2024. Bibliographic records list the DOI as 10.1109/TIV.2024.3406334.

DR-REMOVER is closer to [ERASOR](erasor.md), [Removert](removert.md), and [LiDAR map cleaning](lidar-map-cleaning-dynamic-removal.md) than to online LIO front ends. It assumes an accumulated mapping pipeline and focuses on producing a cleaner static map.

## Core Technical Idea

Dynamic objects create inconsistent occupancy in an accumulated map. DR-REMOVER first uses low-resolution occupancy grids to identify candidate regions with dynamic-object traces. It then uses high-resolution grids to verify individual dynamic points and restore static points that should not be deleted.

This two-level strategy is designed to balance speed and preservation:

| Resolution | Main role | Practical effect |
|---|---|---|
| Low resolution | Find dynamic-object candidate regions | Reduces search cost and handles sparse point clouds. |
| High resolution | Verify and revert point decisions | Improves static preservation near dynamic objects. |

## Inputs and Outputs

| Item | Role |
|---|---|
| Registered LiDAR scans | Source observations for occupancy comparison. |
| Estimated poses | Needed to accumulate scans into a shared map frame. |
| Low-resolution grid | Candidate dynamic-region detection. |
| High-resolution grid | Point-level verification and static reversion. |
| Static/dynamic labels | Map-point decisions for QA and export. |
| Clean static map | Main output for localization, planning, or annotation. |

## Pipeline

1. Build or load an accumulated point-cloud map with scan poses.
2. Encode map observations into dual-resolution occupancy grids.
3. Use the low-resolution grid to locate bins likely to contain dynamic traces.
4. Refine candidate bins using a high-resolution grid.
5. Verify dynamic points while considering nearby environment structure.
6. Revert false removals where high-resolution evidence supports static structure.
7. Export static and removed-point layers for map QA.
8. Evaluate preservation rate, rejection rate, and localization impact.

## Evaluation Snapshot

The TRID record reports evaluation on SemanticKITTI, Apollo, and an unmanned ground vehicle dataset with highly crowded environments. It reports more than 95% preservation rate for static points and rejection rate for dynamic points on all experimental sequences.

For local validation, reproduce PR/RR and add production metrics: localization residuals on cleaned maps, false removal by infrastructure class, ghost rate per route segment, and cleaner disagreement against ERASOR, Removert, MapCleaner, and FreeDOM.

## Strengths

- Focused on static map construction, which is directly useful for AV map publication.
- Dual-resolution design targets both efficiency and preservation.
- Reversion step reduces the risk of deleting real static structure.
- Reported evaluation includes SemanticKITTI, Apollo, and crowded UGV data.
- Class-agnostic geometry can cover actors not present in semantic training sets.

## Failure Modes

- Output quality depends on pose quality; bad registration creates false occupancy disagreement.
- Temporarily parked objects can still look static if observations are insufficient.
- Thin poles, signs, curbs, aircraft gear, and sparse long-range points can be over-removed.
- Offline operation does not protect real-time odometry unless paired with an online filter.
- The IEEE article appears closed access, so implementation details need full-paper access or reproduction.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside static maps | Strong candidate | Good fit for removing GSE, buses, aircraft traces, and crowd artifacts from survey maps. |
| Indoor warehouses | Moderate | Useful for forklift/person traces, but grid resolution must preserve racks, posts, and loading-dock edges. |
| Outdoor roads/campus | Strong | Aligns with SemanticKITTI/Apollo-style static map cleaning. |
| Runtime LIO | Limited | Use as offline map cleaning; it is not a real-time odometry front end by itself. |

## Implementation Notes

- Treat DR-REMOVER as a map-build stage after trajectory optimization.
- Preserve both static output and removed dynamic layers for manual QA.
- Tune grid resolution per sensor, route scale, and expected thin infrastructure.
- Test localization on both raw and cleaned maps before accepting a cleaner configuration.
- Use quiet-survey passes to measure false removal of static apron assets.

## Sources

- DOI: https://doi.org/10.1109/TIV.2024.3406334
- TRID record: https://trid.trb.org/View/2591781
- dblp record: https://dblp.org/rec/journals/tiv/ZhangZWH24
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
- Local baselines: [ERASOR](erasor.md), [Removert](removert.md)
