# STATIC-LIO Dynamic Points Removal

## Executive Summary

STATIC-LIO is a LiDAR-inertial odometry framework that couples dynamic point removal with pose estimation. Its name expands to Sliding window and Terrain AssisTed dynamIC points removal LiDAR Inertial Odometry. Instead of treating odometry as a prerequisite for later map cleaning, it feeds retained static points back into the LIO process so dynamic filtering and ego-motion estimation improve each other.

It is adjacent to [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md), but its primary role is online LIO in dynamic environments rather than standalone offline map post-processing like [ERASOR](erasor.md) or [Removert](removert.md).

## What It Is

The 2025 Information Fusion paper presents STATIC-LIO as a sliding-window, terrain-assisted LIO framework for dynamic scenes. It fuses geometric, terrestrial, and motion information. The terrestrial information comes from a progressive ground segmentation module, and the motion decision comes from an online point-wise dynamic point voting mechanism.

The published abstract reports evaluation on public and real-world datasets with multiple LiDAR types, with localization error reductions up to 92.4% compared with a state-of-the-art LIO framework.

## Core Technical Idea

STATIC-LIO makes dynamic removal part of the odometry loop. IMU measurements deskew and level the scan, progressive ground segmentation extracts terrain information, and point-wise voting uses that terrestrial context to identify dynamic points. The sliding-window LIO then estimates odometry from geometric correspondences built from ground and static points instead of blindly using all scan points.

The key distinction from offline cleaners is feedback: dynamic filtering improves odometry, and improved odometry supports cleaner dynamic decisions. This is important in busy scenes where dynamic objects corrupt scan matching before a global map-cleaning stage ever runs.

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scans | Main geometric observations for LIO and dynamic point voting. |
| IMU stream | Deskewing, leveling, and state propagation. |
| Sliding-window state | Short-term trajectory/submap context for odometry and dynamic decisions. |
| Progressive ground model | Terrain coefficients updated as the scenario evolves. |
| Static/dynamic point labels | Point-wise decisions used to select odometry correspondences. |
| Odometry estimate | Primary runtime output. |
| Cleaner point-cloud map | Secondary mapping output with fewer dynamic traces. |

## Pipeline

1. Synchronize LiDAR and IMU data.
2. Use high-frequency IMU measurements to deskew and level LiDAR points.
3. Predict the current transformation from IMU integration.
4. Run progressive ground segmentation and update terrain coefficients.
5. Use terrain information as a constraint for point-wise dynamic voting.
6. Remove or downweight points voted dynamic.
7. Build geometric correspondences from ground and retained static points.
8. Optimize the sliding-window LIO state.
9. Insert static points into the map and provide odometry for downstream localization/mapping.

## Evaluation

The ScienceDirect article preview lists public and real-world evaluation over diverse LiDAR sensors, including NCLT, GrAco, TIERS, and real-world Livox Mid-360 sequences. The paper also tests simplified versions called STA-LIO and SIC-LIO. Reported outcomes emphasize odometry accuracy, mapping quality, loop-closure support, and dynamic point removal.

For target evaluation, measure:

- ATE/RPE and scan-matching residuals in dynamic and quiet scenes.
- Static preservation and dynamic rejection in the generated map.
- Performance with different LiDAR scan patterns, including spinning, solid-state, and non-repetitive sensors.
- Latency and CPU/GPU budget in the full AV stack.
- Failure behavior when ground segmentation is uncertain.
- Whether dynamic removal improves or harms loop closure and relocalization.

## Strengths

- Dynamic removal is coupled to LIO rather than bolted on after mapping.
- Progressive ground segmentation is designed for multiple LiDAR types.
- Point-wise low-latency dynamic voting supports online operation.
- Retained static points improve odometry constraints in dynamic scenes.
- Useful for reducing ghost trails while also improving pose estimates.

## Failure Modes

- The article preview notes preservation rates below 85% on two sequences because incremental online scanning can remove some static points.
- Ground/terrain assumptions can fail on ramps, stairs, curbs, uneven apron pavement, loading docks, or multi-level indoor areas.
- Removing points can reduce observability in open or sparse scenes.
- IMU calibration, time sync, and deskew errors can masquerade as object motion.
- Slow or stationary movable objects can still be treated as static.
- It is not a substitute for offline map QA when the final product is a certified static map.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron and service roads | Useful online LIO candidate | Dynamic filtering during odometry is valuable around tugs, buses, aircraft, and GSE, but open-apron degeneracy and terrain assumptions need strong validation. |
| Indoor warehouses | Moderate to good | Helpful around forklifts and pedestrians; validate ground segmentation near ramps, thresholds, racks, and mezzanines. |
| Outdoor road/campus | Strong fit | Aligns with the paper's robotics/autonomous-driving motivation and multi-dataset evaluation. |
| Offline static map publishing | Supporting role | Use as a survey front end, then still run offline cleaners and map lifecycle QA. |

## Implementation Notes

- Treat STATIC-LIO as a front-end odometry/mapping candidate, not as only a map cleaner.
- Benchmark against FAST-LIO2, LIO-SAM, and a no-dynamic-removal baseline on the same logs.
- Preserve both removed dynamic points and retained static points for QA.
- Tune ground segmentation separately for each LiDAR mounting height and scan pattern.
- Monitor static inlier count after removal; over-filtering can make scan matching less observable.
- Pair with offline cleaners such as ERASOR, Removert, MapCleaner, or FreeDOM before publishing a production map.

## Sources

- Article preview: https://www.sciencedirect.com/science/article/pii/S1566253525002052
- DOI: https://doi.org/10.1016/j.inffus.2025.103132
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
- Local baselines: [ERASOR](erasor.md), [Removert](removert.md)
