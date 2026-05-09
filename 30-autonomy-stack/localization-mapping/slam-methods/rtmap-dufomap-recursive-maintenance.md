# RTMap, DUFOMap, and Recursive Map Maintenance

## Summary

Recursive map maintenance keeps an operational map alive while the robot or fleet continues to localize, detect changes, and update a prior. It is related to lifelong mapping, but the emphasis is online recursion: the current map is both a localization reference and an evolving memory that receives new observations.

RTMap and DUFOMap cover complementary parts of this gap. RTMap focuses on real-time recursive HD mapping with change detection and localization against a crowdsourced prior. DUFOMap focuses on efficient dynamic-awareness mapping using ray-cast evidence about fully observed empty space. TOSS and similar real-time static-scene mapping systems add online tracking and voting to support map building while moving objects are present.

## What It Is

Recursive map maintenance is a map update loop:

```text
prior map + live observations -> localization + change evidence -> updated map state -> next prior map
```

It differs from offline map cleaning because it must operate with limited latency, partial observability, occlusion, and uncertainty. It also differs from pure SLAM because the goal is not only estimating the current trajectory; the system maintains a reusable prior and detects when the world has changed enough to alter that prior.

Representative methods:

- **RTMap:** recursive online HD mapping that models map-element uncertainty, localizes with respect to a crowdsourced prior, and detects possible road-structure changes.
- **DUFOMap:** efficient online dynamic-awareness mapping that uses ray casting to classify fully observed empty regions and detect points that must be dynamic.
- **TOSS:** real-time tracking and moving-object segmentation with static map building and static-object recovery by voting.

## Core Idea

The map is treated as probabilistic state with memory. Observations update map elements only when they are geometrically visible, sufficiently localized, and consistent with the update policy. Empty-space evidence is as important as occupied evidence: if a region has been fully observed empty, an object seen there at another time is likely dynamic or temporary.

RTMap applies this idea to vectorized HD map elements and crowdsourced online mapping. DUFOMap applies it to geometric dynamic-awareness mapping through visibility reasoning. Both move beyond one-pass perception by recursively using a maintained prior.

## Inputs and Outputs

| Item | Role |
|---|---|
| Live sensor observations | Cameras, LiDAR, or fused perception depending on the system. |
| Prior map | HD map, occupancy map, static scene map, or crowdsourced map memory. |
| Ego-motion and localization priors | Needed to align new evidence with the map. |
| Visibility/ray-casting model | Determines what was actually observed free or occupied. |
| Map-element uncertainty | Prevents overconfident updates from noisy detections. |
| Change candidates | Possible additions, removals, moved objects, or road-structure changes. |
| Updated map | Recursive prior for the next traversal or next frame. |
| Localization output | Pose with respect to the maintained prior and uncertainty diagnostics. |

## Pipeline

1. **Live localization against prior**
   - Align the current agent to the prior map or map elements.
   - Account for uncertainty in both pose and map geometry.

2. **Observation extraction**
   - Detect map elements, occupancy, freespace, or static-scene candidates.
   - Track moving objects when available.

3. **Visibility reasoning**
   - Use ray casting, frustum checks, or sensor-specific observability tests.
   - Record which cells or map elements were actually visible, occluded, or unknown.

4. **Change detection**
   - Compare observed evidence with prior state.
   - Distinguish probable dynamic occupancy, newly added structure, removed structure, and uncertain disagreement.

5. **Recursive update**
   - Update map elements using probabilistic or voting rules.
   - Keep uncertainty and avoid irreversible promotion from one observation.

6. **Publication**
   - Expose the updated map as the next prior or as a change proposal for backend approval.
   - Log residuals, visibility masks, and change candidates for QA.

## Strengths

- Supports map freshness without waiting for full offline remapping.
- Uses prior maps to improve localization and new observations to improve the prior.
- Visibility-aware methods avoid treating occluded areas as negative evidence.
- Recursive uncertainty helps prevent brittle overwrite behavior.
- DUFOMap-style empty-space evidence is efficient and can work online with fixed parameters across varied scenarios.
- RTMap-style HD-map recursion is relevant for fleets because multiple agents can contribute observations.

## Failure Modes

- Localization error contaminates the map update and can create self-reinforcing drift.
- Dense traffic or airside congestion can hide static structure for long periods.
- Occlusion mistakes can turn "not observed" into false negative changes.
- One vehicle's sensor bias or calibration error can pollute a crowdsourced prior.
- Repeated temporary objects can become accepted map elements without persistence policy.
- Real-time constraints can force coarse visibility checks or delayed QA.
- Vector HD map updates can miss non-vector geometric hazards, while occupancy updates can lack semantic intent.

## Airside/AV Fit

Recursive maintenance is useful for AVs and airside vehicles when the map must stay fresh but updates cannot bypass safety review. Airside deployments should treat recursive outputs as change proposals unless the changed layer is explicitly allowed to update online.

Recommended airside use:

- Use online recursion to flag blocked lanes, temporary barriers, changed cone lines, closed stands, and newly detected fixed obstacles.
- Keep terminal walls, markings, signs, and surveyed infrastructure under stricter promotion rules.
- Require multi-agent or multi-session agreement for permanent map edits.
- Store visibility evidence so a hidden stand marking is not treated as removed.
- Gate map updates by localization confidence and sensor health.
- Separate operational overlays from the certified localization map.

For road AVs, RTMap-like recursive HD mapping is relevant to freshness, but production stacks still need backend validation, map contracts, rollback, and change-control workflows.

## Implementation Notes

- Never update the map from poses that failed localization health checks.
- Carry uncertainty for map elements and pose; avoid binary overwrite semantics.
- Store visibility masks and occlusion state alongside occupancy or vector updates.
- Keep a changelog that can reconstruct why a map element was added, removed, or marked uncertain.
- Separate online local updates from globally published fleet map versions.
- Benchmark with high-occlusion scenes, repeated routes, and adverse weather, not only clean map-building runs.
- Evaluate localization before and after recursive updates; a visually fresher map can still be worse for scan matching.

## Sources

- RTMap, "Real-Time Recursive Mapping with Change Detection and Localization," ICCV 2025: https://openaccess.thecvf.com/content/ICCV2025/html/Du_RTMap_Real-Time_Recursive_Mapping_with_Change_Detection_and_Localization_ICCV_2025_paper.html
- DUFOMap paper: https://arxiv.org/abs/2403.01449
- DUFOMap official project page: https://kth-rpl.github.io/dufomap/
- TOSS, "Real-time Tracking and Moving Object Segmentation for Static Scene Mapping": https://arxiv.org/abs/2408.05453
- Local context: [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md), [dynamic map cleaning benchmarks](dynamic-map-cleaning-benchmarks.md), [occupancy grid, TSDF, and ESDF mapping](occupancy-grid-tsdf-esdf-mapping.md)
