# MapCleaner

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "MapCleaner is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

## Executive Summary

MapCleaner is a learning-free LiDAR map-cleaning method for removing moving-object traces from point-cloud maps built in autonomous-driving scenarios. It is an offline or post-processing cleaner: it takes a registered point-cloud map and the source scan sequence, separates terrain from above-ground obstacle structure, and uses frame-level visibility evidence to decide which obstacle-map points are dynamic.

Relative to [ERASOR](erasor.md) and [Removert](removert.md), MapCleaner is useful as a terrain-aware baseline for [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md). Its main operating assumption is that many dynamic objects sit above a locally modelable terrain surface, so the method first protects terrain and then evaluates obstacle points.

## What It Is

The Remote Sensing 2022 paper, "MapCleaner: Efficiently Removing Moving Objects from Point Cloud Maps in Autonomous Driving Scenarios," targets ghost trails left by moving cars and similar actors in accumulated maps. The authors present it as an efficient map post-processing method, not as a semantic detector or a runtime perception stack.

MapCleaner is especially relevant when a team already has a globally registered LiDAR survey and wants to publish a static map for localization, QA, or downstream annotation without training a dynamic-object network.

## Core Technical Idea

MapCleaner first builds a terrain model, then splits the map into noise below terrain, terrain points, and obstacle points above terrain. The dynamic-removal decision is then applied mainly to the obstacle cloud. For each frame, obstacle-map points are projected into the local scan coordinate system and compared against that frame's range-image evidence. Per-frame decisions are fused to produce the final static/dynamic classification.

The important engineering pattern is "protect the terrain before removing object points." This reduces the risk that range-image disagreement deletes drivable surfaces, curbs, or other ground-adjacent map structure. It also makes the cleaning problem smaller because the expensive dynamic test is concentrated on obstacle points.

## Inputs and Outputs

| Item | Role |
|---|---|
| Registered LiDAR point-cloud map | Raw map containing static structure, terrain, ghost trails, and moving-object traces. |
| Source LiDAR scans | Frame-level observations used to compare local visibility and range consistency. |
| Per-scan poses | Required to project the global obstacle map into each scan's local frame. |
| Terrain model parameters | Control ground/terrain extraction and above-ground obstacle separation. |
| Cleaned static map | Map after dynamic obstacle traces are removed. |
| Removed dynamic/obstacle points | QA layer for checking false removals and residual dynamic ghosts. |

## Pipeline

1. Build or load a registered LiDAR map from the scan sequence.
2. Run terrain modeling over the map.
3. Divide map points into below-terrain noise, terrain, and above-terrain obstacle points.
4. Preserve or separately process the terrain layer.
5. For each scan, transform obstacle-map points into the scan's local coordinates.
6. Compare projected obstacle points with the scan's range-image representation.
7. Fuse per-frame voting/comparison results across observations.
8. Remove points classified as moving objects and export the cleaned map.
9. Inspect removed points and static preservation before accepting the map.

## Evaluation

The paper reports SemanticKITTI-based terrain-modeling and map-cleaning experiments. Its table compares MapCleaner with Octomap, Peopleremover, Removert, and ERASOR using static-map-oriented preservation/rejection metrics. Across listed SemanticKITTI sequences, the reported MapCleaner scores show high static preservation and competitive dynamic rejection.

For production evaluation, use the same method on target logs and measure:

- Preservation rate for terrain, curbs, poles, stand equipment, walls, docking aids, and low airport fixtures.
- Rejection rate for cars, buses, tugs, carts, pedestrians, aircraft, and temporary barriers.
- Localization residual, scan-matching inlier count, and pose availability before and after cleaning.
- Manual QA rate on the removed layer.
- Residual ghost trails per route segment or stand.

## Strengths

- Learning-free and explainable.
- Terrain modeling protects a major static layer before object removal.
- Uses scan-level evidence rather than a single global heuristic.
- Designed directly for static point-cloud map cleaning.
- Strong comparison baseline alongside ERASOR and Removert.
- Practical when semantic labels or target-domain training data are unavailable.

## Failure Modes

- Terrain assumptions can break on ramps, stairs, loading docks, curbs, drains, banking, rough pavement, and non-road surfaces.
- Static objects above terrain can be removed if visibility evidence is sparse or poses are poor.
- Parked but movable objects may remain if they look persistent during the mapping run.
- Large occluders can hide static structure and bias voting.
- Sparse or irregular LiDAR patterns may weaken range-image comparisons.
- It is not a runtime free-space source; removed map points do not prove current space is safe.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron and service roads | Good offline candidate | Useful for cleaning vehicle and GSE traces, but terrain assumptions must be checked around ramps, jet bridges, docking aids, chocks, tow bars, and aircraft gear. |
| Indoor warehouses | Moderate | Works where floors are smooth and LiDAR range images are reliable; weaker around multi-level racks, stairs, mezzanines, ramps, and moving doors. |
| Outdoor road/campus | Strong | Matches the original autonomous-driving motivation and public evaluation setting. |
| Unstructured outdoor terrain | Caution | Terrain modeling may be the dominant failure source. |

## Implementation Notes

- Treat MapCleaner as a map-build step after pose optimization, not as a replacement for SLAM.
- Store the raw map, cleaned map, terrain layer, obstacle layer, and removed layer with the map version.
- Run ERASOR, Removert, and MapCleaner on the same logs to identify cleaner disagreement.
- Tune terrain parameters conservatively first; static erosion is usually more damaging than a small residual ghost trail.
- Keep scan provenance so false removals can be traced back to source frames and poses.
- Use multi-session evidence before promoting or deleting large movable objects such as aircraft or staged equipment.

## Sources

- Paper: https://www.mdpi.com/2072-4292/14/18/4496
- DOI: https://doi.org/10.3390/rs14184496
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
- Local baselines: [ERASOR](erasor.md), [Removert](removert.md)
