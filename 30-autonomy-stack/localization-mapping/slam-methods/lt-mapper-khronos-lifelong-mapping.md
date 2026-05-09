# LT-Mapper, Khronos, and Lifelong Mapping

## Summary

Lifelong mapping is the map-lifecycle problem that starts after a robot can already build a usable map. It maintains a map across days, seasons, construction, furniture moves, aircraft stand changes, sensor replacements, and fleet sessions. The central question is not only "which points are dynamic?" but "what changed, when did it change, how persistent is it, and which map version should localization use?"

LT-mapper, Khronos, cloud-native lifelong mapping frameworks, and ELite represent this family. They combine multi-session alignment, dynamic removal, positive/negative change detection, temporal map state, and map-version management. This is broader than simple dynamic-object removal: a parked tug, removed barrier, newly installed sign, seasonal pile, or rearranged indoor asset may be static during one traversal but not stable enough for the canonical localization map.

## What It Is

Lifelong mapping manages a long-running spatial memory. It ingests repeated mapping sessions, aligns them into a common frame, estimates what is static, transient, movable, newly added, or removed, and publishes map products suitable for localization and planning.

Representative systems:

- **LT-mapper:** open-source LiDAR lifelong mapping with multi-session SLAM, high/low dynamic change detection, and positive/negative change management.
- **Khronos:** online metric-semantic SLAM that represents short-term dynamics and long-term changes in a spatio-temporal map.
- **Cloud-native lifelong 3D mapping:** hand-held and robot-mounted LiDAR framework with dynamic removal, multi-session alignment, change detection, and map version control.
- **ELite:** ephemerality-aided LiDAR lifelong mapping that models transiency over multiple time scales.

## Core Idea

The core idea is to treat map state as time-indexed evidence rather than a single accumulated point cloud. A lifelong mapper keeps session provenance, aligns sessions robustly, identifies changes, and stores map deltas or temporal states so the system can reconstruct the current map and reason about historical states.

This differs from dynamic-object removal:

- Dynamic removal removes inconsistent traces from a map build.
- Lifelong mapping maintains a continuously changing world model.
- Dynamic removal can be a submodule of lifelong mapping, but it does not solve map versioning, long-term change persistence, negative changes, or multi-session policy.

In airside and AV settings, this distinction matters because many objects are not simply "dynamic." Aircraft, GSE, cones, belt loaders, stairs, snow piles, and construction barriers can sit still long enough to look static in one run while remaining unsafe as permanent localization anchors.

## Inputs and Outputs

| Item | Role |
|---|---|
| Multi-session LiDAR scans or submaps | Repeated observations across time, routes, and operating conditions. |
| Session trajectories | Initial poses from SLAM, LIO, GNSS/INS, wheel odometry, or survey processing. |
| Loop closures or inter-session constraints | Align sessions and correct drift before change reasoning. |
| Semantic or instance cues | Optional labels for movable objects, infrastructure, people, vehicles, or indoor assets. |
| Time/session metadata | Needed to estimate persistence, recurrence, and map validity. |
| Static base map | Stable map used for localization and planning. |
| Delta maps | Positive additions, negative removals, and changed regions. |
| Temporal map state | Queryable map state at a given time or session. |
| QA diagnostics | Alignment residuals, change confidence, map erosion warnings, and localization impact. |

## Pipeline

1. **Session preprocessing**
   - Synchronize sensors, estimate trajectories, deskew scans, and preserve raw scan provenance.
   - Build per-session maps without immediately merging every point into a global map.

2. **Multi-session alignment**
   - Register sessions using place recognition, feature descriptors, pose-graph constraints, or anchor nodes.
   - Optimize inter-session alignment before labeling changes.

3. **Short-term dynamic handling**
   - Remove or downweight high-dynamic objects that violate per-session consistency.
   - Keep rejected evidence for review instead of discarding it.

4. **Change detection**
   - Compare aligned session maps to identify positive changes, negative changes, and uncertain regions.
   - Separate low-dynamic or movable-static objects from permanent structure.

5. **Temporal reasoning**
   - Estimate persistence or ephemerality over sessions.
   - Promote only sufficiently stable observations into the canonical localization map.

6. **Map management**
   - Store base map, deltas, boundaries, and session metadata.
   - Reconstruct current or historical map states without keeping every raw session map online.

7. **Publication and validation**
   - Publish map packages with version IDs, validity bounds, change logs, and localization regression results.

## Strengths

- Handles year-scale or season-scale environment variation better than one-shot map cleaning.
- Distinguishes positive changes, negative changes, transient objects, and persistent infrastructure.
- Supports map version control and historical queries.
- Reduces manual remapping by incorporating fleet or repeated-session evidence.
- Can improve localization by avoiding stale landmarks and preserving stable structure.
- Provides an operational framework for map QA, rollback, and change approval.

## Failure Modes

- Poor multi-session alignment creates false change detections.
- A repeatedly parked movable object can be promoted into the static map if policy is too aggressive.
- Rarely observed static objects can be misclassified as removed.
- Semantic models can fail on site-specific classes such as airport GSE or indoor industrial assets.
- Temporal evidence may be biased by route scheduling, weather, construction access, or traffic patterns.
- Delta-map complexity can grow until map publication and rollback become hard to reason about.
- Online lifelong mapping can overreact to temporary occlusion if persistence thresholds are too short.

## Airside/AV Fit

Lifelong mapping is a strong fit for airside autonomy because airport geometry changes slowly, but movable objects change constantly. The production map should not be a raw average of every stand traversal. It should separate terminal walls, poles, markings, curbs, blast fences, and approved landmarks from aircraft, stairs, loaders, buses, cones, baggage carts, and temporary work zones.

Recommended airside use:

- Maintain separate static, movable-static, dynamic, artifact, and change-candidate layers.
- Require multi-session evidence before promoting new structure into the localization map.
- Treat aircraft and GSE as non-permanent unless operations explicitly define a fixed installation.
- Keep positive and negative change records with timestamps and session IDs.
- Run localization regression tests before publishing a new map version.
- Combine LiDAR lifelong mapping with radar/GNSS/INS health checks in low-observability apron zones.

For AV fleets, lifelong mapping is the right abstraction for map freshness. It gives the autonomy stack a controlled path from repeated observations to map updates rather than relying on ad hoc remapping or blind dynamic-object filters.

## Implementation Notes

- Preserve provenance for every map element: session, timestamp, pose source, sensor, cleaner decision, and map version.
- Use robust multi-session SLAM before change detection; change logic should not absorb registration error.
- Store both positive and negative changes. Removed structure matters as much as newly observed structure.
- Use conservative promotion rules for movable-static objects.
- Keep raw or compressed evidence for audit, but publish compact base-plus-delta map products.
- Validate each update against localization metrics, not only visual map cleanliness.
- Design map rollback and side-by-side A/B localization before deploying fleet-wide updates.
- Prefer site-specific ephemerality thresholds over a binary static/dynamic rule.

## Sources

- LT-mapper paper: https://arxiv.org/abs/2107.07712
- LT-mapper official repository: https://github.com/gisbi-kim/lt-mapper
- Khronos official repository: https://github.com/MIT-SPARK/Khronos
- Lifelong 3D Mapping Framework for Hand-held & Robot-mounted LiDAR Mapping Systems: https://arxiv.org/abs/2501.18110
- ELite, "Ephemerality meets LiDAR-based Lifelong Mapping": https://arxiv.org/abs/2502.13452
- Local context: [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md), [dynamic-object-aware SLAM](dynamic-object-aware-slam.md), [loop closure and place recognition](loop-closure-place-recognition.md)
