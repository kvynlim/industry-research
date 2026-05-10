# ERASOR

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "ERASOR is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

## What It Is

ERASOR is a LiDAR dynamic object removal method for building static 3D point-cloud maps from scan sequences that contain moving objects. The name stands for Egocentric Ratio of Pseudo Occupancy-based Dynamic Object Removal. It was published in RA-L with ICRA 2021 option and has an official ROS/PCL implementation.

ERASOR is not a general detector. Its primary role is offline or batch map cleaning: remove dynamic-object traces such as vehicles and pedestrians so the resulting map supports localization and navigation.

## Core Technical Idea

ERASOR compares local occupancy evidence from scans and an accumulated map in an egocentric polar-style representation. Dynamic objects tend to create inconsistent pseudo-occupancy because they occupy a bin in one view but not across stable observations. Candidate dynamic regions are then refined with region-wise ground plane fitting so ground points are preserved.

The useful engineering idea is to classify map bins before deleting points. This is safer than deleting every point that is inconsistent with one scan, because pose error, occlusion, and sparse sampling can all create apparent disagreement.

## Inputs and Outputs

| Item | Role |
|---|---|
| Sequential LiDAR scans | Raw observations used to build and test occupancy consistency. |
| Poses from odometry, SLAM, GNSS/INS, or survey processing | Required to align scans into a map frame. |
| Initial accumulated map | The map to be cleaned. |
| Ground model parameters | Used by region-wise ground plane fitting. |
| Output static map | Cleaned point-cloud map. |
| Output rejected dynamic points | Useful for QA, relabeling, and safety investigation. |

## Architecture or Pipeline

1. Accumulate registered LiDAR scans into an initial map.
2. Represent occupancy in egocentric pseudo-occupancy bins.
3. Compute occupancy-ratio disagreement between scans and the map.
4. Mark candidate dynamic bins where pseudo-occupancy is inconsistent.
5. Apply region-wise ground plane fitting to avoid deleting valid ground.
6. Remove candidate dynamic points and preserve static structure.
7. Evaluate preservation and rejection metrics against labeled data or manual QA.

## Training and Evaluation

ERASOR is learning-free. It is evaluated as a geometric map-cleaning algorithm, commonly against SemanticKITTI-derived dynamic/static labels and with preservation/rejection style metrics.

For production evaluation, add:

- Static preservation rate for ground, poles, signs, walls, curbs, and aircraft stand equipment.
- Dynamic rejection rate for vehicles, people, aircraft, tugs, carts, buses, and temporary equipment.
- Localization residual and inlier count before and after map cleaning.
- Cross-session map consistency.
- QA of rejected cloud to catch static erosion.

## Strengths

- Explainable and does not require semantic labels.
- Designed specifically for static point-cloud map building.
- Handles dynamic traces that corrupt accumulated maps.
- Ground plane fitting helps preserve drivable surfaces.
- Official implementation and evaluation assets are available.
- Useful baseline for map-cleaning comparisons with Removert, MapCleaner, ERASOR++, and 4dNDF.

## Failure Modes

- Pose errors can make static structure look dynamic.
- Sparse or unusual LiDAR scan patterns can weaken occupancy ratios.
- Tall or overhanging static structures may be misclassified if ground assumptions dominate.
- Parked but movable objects can remain if they are consistently observed.
- Static erosion can occur around thin structures, curbs, poles, aircraft gear, and ground equipment.
- It is not a runtime planner obstacle filter; removed map points do not imply current space is free.

## Airside AV Fit

ERASOR is a strong airside map-cleaning candidate because airports contain large dynamic or movable objects that can dominate a survey run. It should be used offline with multi-session validation.

Recommended airside use:

- Clean survey maps around stands, service roads, terminals, and baggage areas.
- Keep aircraft, buses, tugs, carts, and temporary barriers out of the long-term localization map unless map policy explicitly promotes them.
- Preserve a rejected dynamic layer for QA and operations review.
- Pair with semantic or MOS masks where aircraft and GSE geometry confuses purely geometric logic.
- Validate against open apron degeneracy and repeated gate layouts.

## Implementation Notes

- Use high-quality poses; map cleaning cannot fix poor registration.
- Run with conservative parameters first and inspect rejected static structure.
- Store ERASOR configuration with the generated map version.
- Compare against Removert and MapCleaner on the same route before adopting a default cleaner.
- Do not update production maps automatically from one ERASOR run; use map lifecycle approval.

## Sources

- Paper: https://arxiv.org/abs/2103.04316
- Official repository: https://github.com/LimHyungTae/ERASOR
- IEEE DOI: https://doi.org/10.1109/LRA.2021.3061363
- Dynamic-object-aware SLAM context: dynamic-object-aware-slam.md
