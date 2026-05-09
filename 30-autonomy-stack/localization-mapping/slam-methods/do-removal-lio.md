# DO-Removal LIO

**Last updated:** 2026-05-09

## Executive Summary

DO-Removal is an online LiDAR-inertial odometry method for dynamic scenes. Its full title is "DO-Removal: Dynamic Object Removal for LiDAR-Inertial Odometry Enabled by Front-End Real-Time Strategy."

The method is front-end focused: it separates dynamic and static elements before they damage feature extraction and optimization, then uses confidence-aware residual weighting to keep the estimator robust.

## What It Is

The paper appears in IEEE Internet of Things Journal, volume 12, issue 9, pages 11553-11567, 2025, with DOI 10.1109/JIOT.2024.3519577. IEEE Xplore is the primary record, while accessible abstract details are available through secondary bibliographic mirrors.

DO-Removal sits between feature-based LIO and dynamic filtering. It does not rely only on a semantic detector; it uses ground fitting, geometric seed points, region growing, and clustering confidence.

## Core Technical Idea

The method uses ground fitting as a reference and starts region growing from point-cloud measurements with significant geometric features. Clustering results then provide confidence for dynamic-element segmentation. These confidence values influence feature use and residual optimization.

It also introduces multiline LiDAR feature extraction that considers neighboring context beams. This is meant to make features more meaningful for multi-beam LiDAR scans in dynamic environments.

## Inputs and Outputs

| Item | Role |
|---|---|
| Multiline LiDAR scans | Main feature and dynamic-removal input. |
| IMU stream | LIO propagation and motion compensation. |
| Ground model | Reference for separating ground-supported structures. |
| Geometric seed points | Starting points for region growing. |
| Cluster confidence | Dynamic/static confidence for segmentation and weighting. |
| Weighted features | Inputs to the LIO residual optimization. |
| Odometry and map | Main runtime outputs. |

## Pipeline

1. Synchronize LiDAR and IMU data.
2. Run ground fitting to establish a geometric reference.
3. Extract multiline LiDAR features using context beams.
4. Select significant geometric feature measurements as region-growing seeds.
5. Grow candidate regions and cluster points.
6. Use clustering results to estimate confidence for dynamic segmentation.
7. Separate dynamic and static elements.
8. Build residuals with distance truncation and confidence-based contributions.
9. Adaptively weight features at different distances.
10. Update LIO state and map with dynamic suppression.

## Evaluation Snapshot

The accessible abstract reports extensive testing on KITTI and a self-collected dataset. It reports competitive results with absolute trajectory error and absolute rotation error reduced to 0.51% and 0.19 deg/100 m, respectively.

For target use, evaluate separately on odometry error, dynamic-object segmentation confidence, map ghosting, false static removal, feature count after filtering, and runtime under full sensor load.

## Strengths

- Front-end strategy protects feature extraction and pose optimization early.
- Does not require a full semantic object detector.
- Confidence-aware residuals can reduce the damage from uncertain segmentation.
- Multiline feature extraction is designed around real LiDAR beam structure.
- Published in a high-visibility IEEE IoT journal with clear quantitative claims.

## Failure Modes

- Ground fitting can fail on ramps, curbs, stairs, loading docks, and uneven apron surfaces.
- Region-growing quality depends on feature seeds and local point density.
- Clustering confidence can be brittle when objects are sparse or partially occluded.
- Distance truncation and adaptive weighting add parameters that need scene-specific validation.
- Full implementation details may require IEEE access; no official repository was found from the starting sources.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron | Candidate | Ground reference is useful, but aircraft/GSE geometry and uneven pavement require targeted tests. |
| Indoor warehouses | Moderate | Works around forklifts and people if ground/ramp handling is tuned. |
| Outdoor roads/campus | Strong fit | KITTI-style multiline LiDAR scenes align with the paper evaluation. |
| Offline static maps | Supporting role | Helps produce cleaner online maps, but still needs offline QA before map publication. |

## Implementation Notes

- Reproduce the KITTI-style setup before adapting to non-road sensors.
- Version ground-fitting parameters, region-growing thresholds, confidence rules, and distance truncation settings.
- Log confidence maps, not only binary dynamic/static labels.
- Compare against FAST-LIO2, STATIC-LIO, RF-LIO, and a no-removal baseline.
- For airside use, inspect false removals near aircraft landing gear, jet bridges, cones, chocks, and GSE.

## Sources

- IEEE DOI: https://doi.org/10.1109/JIOT.2024.3519577
- IEEE Xplore record: https://ieeexplore.ieee.org/document/10807109/
- CoLab bibliographic abstract: https://colab.ws/articles/10.1109%2Fjiot.2024.3519577
- dblp context: https://dblp.org/rec/journals/iotj/XingWSZLLZ25
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
