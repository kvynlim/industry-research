# SPLIN ISDOR PPLIO

**Last updated:** 2026-05-09

## Executive Summary

SPLIN is a structured plane-based LiDAR-inertial SLAM framework with online dynamic object removal. Its full title is "SPLIN: A Structured Plane-based LiDAR-Inertial SLAM with Dynamic Object Removal."

The system combines ISDOR, a lightweight dynamic-object removal module, with PPLIO, a tightly coupled point-plane LiDAR-inertial odometry estimator, then adds backend factor-graph optimization for long-horizon consistency.

## What It Is

The paper is listed in IEEE Transactions on Instrumentation and Measurement with DOI 10.1109/TIM.2025.3643083. The accessible abstract describes a complete LiDAR-inertial SLAM system rather than a narrow scan cleaner.

SPLIN is relevant when point-only LIO is weak because planes provide stronger structure. It is especially interesting for large indoor/outdoor spaces where dynamic objects and drift both matter.

## Core Technical Idea

SPLIN has three main pieces:

| Module | Role |
|---|---|
| ISDOR | Incremental Static-referenced Dynamic Object Removal at frame level. |
| PPLIO | Point-plane LiDAR-inertial odometry with an iterated Kalman filter. |
| Backend graph | Uncertainty-aware factor-graph optimization for drift reduction. |

ISDOR suppresses moving objects early enough to inform frontend pose estimation. PPLIO then uses plane extraction and adaptive downsampling to keep estimation efficient and robust across scenes with different scales and dynamics.

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scans | Source points for plane extraction, ISDOR, and odometry. |
| IMU stream | Propagation and tightly coupled estimation. |
| Static reference | Incremental context for dynamic-object removal. |
| Plane features | Structured constraints for PPLIO. |
| Downsampled point-plane set | Efficient measurement set for filtering. |
| Factor graph | Backend loop/drift correction. |
| Odometry and map | Primary SLAM outputs. |

## Pipeline

1. Synchronize LiDAR and IMU streams.
2. Propagate state and deskew the LiDAR scan.
3. Run ISDOR to detect and suppress moving objects at frame level.
4. Extract efficient plane features from retained points.
5. Apply adaptive downsampling based on scene scale and structure.
6. Update the PPLIO state with an iterated Kalman filter.
7. Insert static structured points into the map.
8. Add constraints to an uncertainty-aware backend factor graph.
9. Use loop closure or backend optimization to reduce long-term drift.
10. Export cleaned maps and corrected trajectories.

## Evaluation Snapshot

The accessible abstract reports that ISDOR improves average F1 by 13.47%, improves precision by 26.67%, and reduces runtime by 64.26% over state-of-the-art baselines. It also reports the lowest localization error on 28 of 34 sequences and real-time inference at 6.94-36 ms per frame.

For local evaluation, separate the effects of ISDOR, plane extraction, adaptive downsampling, and backend optimization. Measure odometry accuracy, map consistency, dynamic rejection, static preservation, and loop-closure contribution.

## Strengths

- Couples dynamic removal with frontend estimation instead of post-processing only.
- Plane constraints can improve observability where point-only features are weak.
- Adaptive downsampling is useful across scene scales.
- Backend factor graph addresses drift beyond local odometry.
- Reported metrics cover both dynamic removal and localization accuracy.

## Failure Modes

- Plane-based constraints can be weak in vegetation, clutter, open aprons, or irregular rubble.
- ISDOR depends on a reliable incremental static reference; early map contamination can persist.
- Loop closure can create false confidence if dynamic/movable structures dominate place recognition.
- Tight integration makes ablation and debugging more complex.
- Public code was not found from the starting sources, so reproduction may require full-paper access.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron | Moderate to promising | Planes from pavement/buildings help, but aircraft and large GSE can dominate if not removed. |
| Indoor warehouses | Strong candidate | Plane constraints match floors, walls, racks, and loading areas; validate around moving forklifts. |
| Outdoor campus/road | Strong research fit | Dynamic removal plus backend graph is useful for long traversals. |
| Static map publishing | Candidate front end | Use corrected trajectory and cleaned map as input to offline map QA. |

## Implementation Notes

- Reproduce with full module ablations before adopting the whole stack.
- Version ISDOR thresholds, plane extraction settings, downsampling policy, and backend graph factors.
- Inspect plane residuals separately from point residuals to detect overconfident structure.
- Keep dynamic removal labels through backend optimization for QA.
- Compare maps against [R-POD](rpod-two-stage-online-dynamic-removal-lio.md), [BTSA](dynamic-aware-lio-btsa.md), and offline cleaners.

## Sources

- IEEE DOI: https://doi.org/10.1109/TIM.2025.3643083
- ResearchGate abstract record: https://www.researchgate.net/publication/398603188_SPLIN_A_Structured_Plane-based_LiDAR-Inertial_SLAM_with_Dynamic_Object_Removal
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
