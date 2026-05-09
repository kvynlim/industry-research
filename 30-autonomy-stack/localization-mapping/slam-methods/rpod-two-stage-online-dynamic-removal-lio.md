# R-POD Two-Stage Online Dynamic Removal LIO

**Last updated:** 2026-05-09

## Executive Summary

R-POD is an online dynamic-object-removal method for LiDAR-inertial SLAM. The full paper title is "Online dynamic object removal for LiDAR-inertial SLAM via region-wise pseudo occupancy and two-stage scan-to-map optimization."

The practical idea is to sandwich dynamic removal between two scan-to-map optimizations: first estimate a better pose, then remove dynamics using region-wise pseudo occupancy, then optimize again using the cleaned scan.

## What It Is

The paper is published in Displays, volume 88, article 103030, July 2025, DOI 10.1016/j.displa.2025.103030. The Technical University of Munich publication page provides an accessible abstract and bibliographic metadata.

R-POD is an online LIO/SLAM front-end strategy, not just an offline map cleaner. It is designed to reduce the localization accuracy loss that occurs when dynamic removal depends too heavily on IMU-only initial poses.

## Core Technical Idea

The method defines a volume of interest around the query frame and local map, then encodes both into a region-wise pseudo occupancy descriptor. A scan ratio test compares the query-frame R-POD with the local-map R-POD and filters dynamic objects region by region.

Two-stage scan-to-map optimization is the control loop:

| Stage | Purpose |
|---|---|
| Initial scan-to-map | Improve pose before dynamic-object identification. |
| R-POD filtering | Compare query and local map occupancy region by region. |
| Final scan-to-map | Refine pose after dynamic points are removed. |

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scan | Query frame for registration and R-POD encoding. |
| IMU stream | Initial motion prior and LIO propagation. |
| Local map | Reference for scan-to-map and occupancy comparison. |
| VOI | Spatial scope for descriptor construction. |
| R-POD descriptors | Region-wise pseudo occupancy for query and map. |
| Dynamic mask | Regions/points removed before final optimization. |
| Refined pose and map | Main output after two-stage optimization. |

## Pipeline

1. Propagate the state with IMU and prior odometry.
2. Run initial scan-to-map optimization against the local map.
3. Define a volume of interest for the query frame and local map.
4. Encode query-frame points into an R-POD descriptor.
5. Encode local-map points into a matching R-POD descriptor.
6. Run a scan ratio test between query and map descriptors.
7. Identify and filter dynamic objects region by region.
8. Run the second scan-to-map optimization on the cleaned scan.
9. Update the local map and publish odometry.

## Evaluation Snapshot

The TUM record reports evaluation over multiple MulRan and UrbanLoco sequences, with improved mapping results and SLAM accuracy in dynamic environments. The abstract emphasizes both accuracy and efficiency, especially when IMU-only initial poses are not enough for robust dynamic filtering.

For target validation, measure the benefit of the second scan-to-map stage, the false-removal rate by region size, runtime per scan, and behavior when the local map already contains dynamic-object ghosts.

## Strengths

- Explicitly addresses the pose-before-removal dependency.
- Region-wise descriptors are more structured than point-only thresholding.
- The scan ratio test is practical and interpretable.
- Two-stage optimization gives a clean comparison against one-stage baselines.
- Datasets include dynamic urban driving-style sequences.

## Failure Modes

- If the first scan-to-map optimization is already corrupted, R-POD descriptors may be misaligned.
- Region resolution and VOI size can trade false positives against residual dynamic clutter.
- Local maps containing previous dynamic ghosts can weaken the map/query comparison.
- Large movable-static objects may be retained if they persist across the local map.
- No official public implementation was found from the starting sources.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron | Promising | Two-stage optimization may help when aircraft/GSE dominate the first alignment, but local-map ghosts are a risk. |
| Indoor warehouses | Moderate to good | Region-wise occupancy can help around forklifts and pallets; tune VOI for narrow aisles. |
| Outdoor roads/campus | Strong fit | MulRan and UrbanLoco are close to the intended operating regime. |
| Static map publication | Supporting role | Use for online map building, followed by offline cleaner comparison. |

## Implementation Notes

- Implement ablations for one-stage scan-to-map, two-stage without R-POD, and full R-POD.
- Version VOI dimensions, region resolution, scan ratio thresholds, and local-map update policy.
- Keep raw query/map descriptors for debugging misclassified regions.
- Reject map updates in segments where dynamic ratio is high and static inlier count is low.
- Compare with [DR-REMOVER](dr-remover.md), [FreeDOM](freedom-dynamic-object-removal.md), and [STATIC-LIO](static-lio-dynamic-points-removal.md).

## Sources

- DOI: https://doi.org/10.1016/j.displa.2025.103030
- TUM publication record: https://portal.fis.tum.de/en/publications/online-dynamic-object-removal-for-lidar-inertial-slam-via-region-/
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
- Local context: [STATIC-LIO Dynamic Points Removal](static-lio-dynamic-points-removal.md)
