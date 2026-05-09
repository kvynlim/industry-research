# Removert

## What It Is

Removert is a static point-cloud map construction method for dynamic environments. The name summarizes the core strategy: remove dynamic candidates first, then revert points that were likely removed by mistake. It was published at IROS 2020 as "Remove, then Revert: Static Point cloud Map Construction using Multiresolution Range Images" and has a public ROS/PCL implementation.

Its main role is offline LiDAR map cleaning after a route has been scanned and registered.

## Core Technical Idea

Removert compares scans and map points in range-image space. Dynamic objects tend to create inconsistencies between a query scan and the map. A purely aggressive removal step can delete static points because poses are imperfect and projections are quantized. Removert therefore uses multiresolution range images: first remove conservatively or aggressively according to visible disagreement, then recover uncertain static points by enlarging association windows and using coarser range-image reasoning.

This remove-then-revert structure is useful because map cleaning has asymmetric costs. Leaving a dynamic ghost is bad, but eroding static structure can also damage localization and map QA.

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scans | Query observations used for map comparison. |
| Per-scan poses | Required to associate scans with the accumulated map. |
| Initial map | Noisy map containing dynamic traces. |
| Range-image parameters | Control projection resolution and association windows. |
| Cleaned static map | Primary output for localization or map QA. |
| Dynamic/removed submap | Output for inspection and downstream labeling. |

## Architecture or Pipeline

1. Pair each LiDAR scan with its pose.
2. Accumulate an initial point-cloud map.
3. Project query scans and map points into range images.
4. Compare query-to-map range consistency.
5. Remove points likely caused by dynamic objects.
6. Revert likely static points using multiresolution association to reduce sensitivity to pose and projection errors.
7. Export static and dynamic submaps for QA.

## Training and Evaluation

Removert is learning-free. The paper validates on KITTI using SemanticKITTI labels as ground truth for dynamic/static evaluation. The repository supports offline use with pre-saved scans and poses and reports practical map-building workflows.

For airside validation, measure:

- Dynamic ghost trail removal rate.
- Static preservation around thin and low structures.
- Localization residual before and after cleaning.
- Performance under pose jitter.
- Differences between high-resolution and low-resolution LiDARs.
- Quality of rejected dynamic layer for map QA.

## Strengths

- Designed for static map construction in dynamic outdoor environments.
- Range-image representation is efficient and interpretable.
- Revert stage directly addresses false deletion from imperfect poses.
- Does not require semantic labels or training data.
- Public implementation is available and can process prepared scans offline.
- Useful complement to MOS networks and ERASOR-style occupancy methods.

## Failure Modes

- Requires reliable scan poses; severe registration error can corrupt range-image comparison.
- Sparse solid-state or irregular LiDAR patterns may need adaptation.
- Parked objects seen consistently across the batch can be treated as static.
- Occlusion can make real static points look inconsistent.
- Range-image projection can smear thin structures or vertical airport equipment.
- The public repository notes that some practical workflows emphasize removal; teams should confirm which revert functionality is present in the code path they run.

## Airside AV Fit

Removert is well suited for offline airside map construction where dynamic clutter is expected. Its revert concept is attractive around airports because static erosion is dangerous: poles, stand equipment, docking aids, curbs, and small obstacles may be sparse but important for localization and QA.

Recommended use:

- Run on survey routes after high-quality pose estimation.
- Compare with ERASOR and MapCleaner on the same stand and service-road data.
- Use multi-session evidence to decide whether parked aircraft or GSE should remain out of the static localization map.
- Keep removed and reverted points as review layers.
- Validate with aircraft, buses, belt loaders, baggage carts, and personnel labels.

## Implementation Notes

- Start with KITTI-format scan/pose export because the repository documents that path.
- Version range-image resolution, association windows, and batch size with the map package.
- Inspect dynamic submaps manually before accepting a production map.
- Combine with LiDAR-MOS or HeLiMOS-style moving labels when available; online MOS can remove obvious moving points before Removert performs finer static-map cleanup.
- Do not confuse "static map" with "currently free space"; runtime perception still owns obstacle detection.

## Sources

- Official repository: https://github.com/gisbi-kim/removert
- Paper record and abstract: https://snu.elsevierpure.com/en/publications/remove-then-revert-static-point-cloud-map-construction-using-mult
- Paper PDF: https://gisbi-kim.github.io/publications/gkim-2020-iros.pdf
- IEEE DOI: https://doi.org/10.1109/IROS45743.2020.9340856
