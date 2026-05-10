# ERASOR++

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "ERASOR++ is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

## Executive Summary

ERASOR++ is a post-processing LiDAR map-cleaning method that extends [ERASOR](erasor.md) for static point-cloud map construction. It keeps ERASOR's egocentric pseudo-occupancy idea but replaces the simple vertical height-difference descriptor with a Height Coding Descriptor and adds tests that reduce false removal of static structure.

Its best role is an offline candidate in a [LiDAR map-cleaning and dynamic-removal](lidar-map-cleaning-dynamic-removal.md) evaluation set. It is not a semantic model and does not require training labels.

## What It Is

The ICRA 2024 paper "ERASOR++: Height Coding Plus Egocentric Ratio Based Dynamic Object Removal for Static Point Cloud Mapping" targets long dynamic-object traces in 3D point-cloud maps. The authors describe it as an enhanced ERASOR-style method for dynamic object removal after map generation, with a focus on preserving static points that original ERASOR can remove in occluded, vegetated, or unstructured areas.

## Core Technical Idea

ERASOR++ still compares a current scan and prior map in egocentric polar bins, but each bin stores more vertical information. The Height Coding Descriptor combines height-difference information with a bit-coded occupancy of vertical height layers. This lets the method reason about whether the scan and map share meaningful structure above the ground, rather than only comparing max-min height spread.

Three tests use that descriptor:

- Height Stack Test checks overlap of occupied height layers and helps avoid deleting static structure behind partial occlusions.
- Ground Layer Test estimates the relevant ground layer for the descriptor so vertical uncertainty in poses does not dominate the test.
- Surrounding Points Test suppresses isolated dynamic bins that are likely caused by drift, sparse observations, or local noise rather than real object trails.

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scan sequence | Source frames used to test map bins. |
| Per-scan poses | Align scans and prior map into a shared frame. |
| Prior/generated point-cloud map | Map containing dynamic traces to clean. |
| Volume-of-interest limits | Radial and height bounds for processing. |
| Ring/sector/layer parameters | Define egocentric bins and vertical coding resolution. |
| Cleaned static map | Main output for localization or map QA. |
| Dynamic/rejected points | Output for inspection and cleaner comparison. |

## Pipeline

1. Load the generated point-cloud map and scan poses.
2. For each scan, extract the scan and corresponding prior-map points inside a volume of interest.
3. Divide the volume into egocentric rings and sectors.
4. Encode each bin using the Height Coding Descriptor.
5. Run the Height Stack Test to identify candidate dynamic bins.
6. Use the Ground Layer Test to align tests with local ground-layer evidence.
7. Run the Surrounding Points Test to revert isolated dynamic-bin decisions.
8. Apply ERASOR-style ground/static retrieval where needed.
9. Remove dynamic-bin points from the map and export static and rejected layers.

## Evaluation

The paper evaluates on selected SemanticKITTI sequences and compares against the original ERASOR implementation. It reports preservation rate, rejection rate, F1 score, and average time, with ERASOR++ improving preservation rate and F1 score in the listed sequences while keeping runtime in the same practical range.

For target deployment, evaluate:

- Preservation/rejection metrics by object and infrastructure class.
- Static erosion around thin poles, vegetation, low curbs, signs, and airport stand equipment.
- Sensitivity to pose z error and LiDAR height calibration.
- Runtime per scan and per kilometer.
- Cleaner disagreement versus ERASOR, Removert, and MapCleaner.

## Strengths

- Learning-free and descriptor-based.
- More expressive vertical bin representation than ERASOR's height-difference-only descriptor.
- Specifically addresses bad static removal from blocked ground, vegetation, and isolated false dynamic bins.
- Maintains the ERASOR family's efficient post-processing style.
- Strong candidate for side-by-side evaluation with ERASOR on complex vertical scenes.

## Failure Modes

- Still depends on good scan poses; drift can create false bin disagreement.
- Layer and volume-of-interest settings are sensor and environment sensitive.
- Very sparse LiDARs may not populate enough height layers for robust tests.
- Large stationary movable objects can remain if they are consistent during the mapping window.
- Unusual airport geometry can violate assumptions about ground layer and neighboring dynamic-bin continuity.
- Public implementation maturity should be verified before production adoption.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron and service roads | Promising offline candidate | Height coding is attractive around aircraft, buses, and GSE with vertical structure, but ground-layer behavior must be validated near gear, chocks, jet bridges, ramps, and curbs. |
| Indoor warehouses | Moderate | Useful where LiDAR scans and poses are good; tune carefully around racks, mezzanines, stairs, and forklifts. |
| Outdoor road/campus | Strong research fit | Matches SemanticKITTI-style evaluation and the original dynamic-trace problem. |
| Vegetation-heavy scenes | Better than ERASOR baseline, still caution | The paper explicitly targets some ERASOR failure cases, but vegetation motion and partial occlusion remain hard. |

## Implementation Notes

- Start by reproducing ERASOR and ERASOR++ on the same logs to isolate the benefit of height coding.
- Version ring, sector, layer, height range, and neighborhood parameters with the map artifact.
- Do not accept a higher dynamic rejection rate if it damages static preservation around localization anchors.
- Keep rejected points as a review layer.
- Use multi-session checks before deleting parked aircraft, GSE, or staged objects from a production static map.
- If no maintained implementation is available, treat this as a research baseline before committing integration effort.

## Sources

- Paper: https://arxiv.org/abs/2403.05019
- arXiv DOI: https://doi.org/10.48550/arXiv.2403.05019
- IEEE DOI: https://doi.org/10.1109/ICRA57147.2024.10610396
- Local baseline: [ERASOR](erasor.md)
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md), [Removert](removert.md)
