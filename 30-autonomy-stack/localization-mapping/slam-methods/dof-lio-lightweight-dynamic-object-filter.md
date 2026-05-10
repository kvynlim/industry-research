# DOF-LIO Lightweight Dynamic Object Filter

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "DOF-LIO Lightweight Dynamic Object Filter is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

**Last updated:** 2026-05-09

## Executive Summary

DOF-LIO is a LiDAR-inertial odometry system that tightly integrates a lightweight dynamic object filter into the LIO loop. Its full title is "DOF-LIO: LiDAR-Inertial Odometry with Lightweight Dynamic Object Filter."

The method extends visibility-based dynamic filtering with false-detection suppression, recovery logic, and voxel-based clustering, aiming to keep dynamic points out of the odometry map without adding a heavy semantic perception stack.

## What It Is

The DOI record is 10.1109/TIM.2026.3666055 in IEEE Transactions on Instrumentation and Measurement. At the time of writing, the most accessible technical summary is the author-uploaded accepted version mirrored on ResearchGate; no official public code was found from the starting sources.

DOF-LIO is closest to [RF-LIO](dynamic-object-aware-slam.md), [STATIC-LIO](static-lio-dynamic-points-removal.md), and [BTSA](dynamic-aware-lio-btsa.md): it is an online odometry front end that tries to protect the estimator from moving-object points.

## Core Technical Idea

Visibility-based dynamic detection compares current points against recent history. DOF-LIO keeps this lightweight cue but adds mechanisms to reduce false detections and recover useful static points.

The paper summary highlights three components:

| Component | Role |
|---|---|
| Visibility-based detection | Finds candidate dynamic points from range inconsistency over history. |
| False detection suppression | Uses outlier handling and clustering to reduce static false positives. |
| Voxel-based clustering | Speeds up point grouping for practical online operation. |

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scans | Current and historical point clouds for visibility comparison. |
| IMU stream | LIO propagation, deskewing, and pose estimation. |
| Sliding history | Recent scans/poses used for range-image comparisons. |
| Voxel clusters | Efficient candidate grouping and filtering. |
| Dynamic/static labels | Used to reject points from map insertion and registration. |
| LIO state and map | Primary odometry and mapping output. |

## Pipeline

1. Run the base LIO state propagation and scan deskewing.
2. Project current and historical scans into range-image or visibility structures.
3. Compare range differences to find candidate dynamic pixels/points.
4. Cluster candidate points using a voxel-based method.
5. Suppress false detections with outlier and cluster-level checks.
6. Recover points that are likely static despite initial dynamic evidence.
7. Feed retained static points into the LIO update.
8. Insert static points into the map and keep dynamic points out.
9. Publish odometry, static map, and filter diagnostics.

## Evaluation Snapshot

The accessible abstract reports validation on public datasets and real-world experiments. The available paper text mentions comparisons with Faster-LIO, FAST-LIO2, Point-LIO, IG-LIO, LIO-EKF, RF-LIO, and DOF-LIO variants across plaza, parking, and NCLT-style sequences.

For deployment, reproduce results on target hardware and logs. Measure ATE/RPE, dynamic rejection, static preservation, false-positive removals, per-module latency, and recovery behavior after pose drift.

## Strengths

- Lightweight compared with detector-based pipelines.
- Does not require semantic training labels or object classes.
- Voxel clustering is a practical way to reduce dynamic-candidate processing cost.
- Recovery and false-detection suppression directly address a common weakness of visibility filters.
- Online integration can improve both odometry and map cleanliness.

## Failure Modes

- Visibility tests depend on pose accuracy and time synchronization.
- Range-image assumptions can be sensitive to LiDAR pattern, FoV, and sparse returns.
- Slow or repeatedly observed movable objects can remain in the static map.
- Aggressive suppression may keep dynamic traces; aggressive filtering may remove static structure.
- No public code was found, so reproduction effort may be high.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron | Promising but unproven | Class-agnostic filtering is attractive, but long-range sparse returns and large aircraft need careful validation. |
| Indoor warehouses | Good candidate | Useful around forklifts and pedestrians; tune clustering for racks, glass, and narrow aisles. |
| Outdoor road/campus | Strong fit | Matches dynamic mobile-robot and urban LIO use cases. |
| Offline map publishing | Supporting role | Use as an online front end, then validate with offline cleaners before release. |

## Implementation Notes

- If code is unavailable, prototype only after obtaining the full paper and verifying equations.
- Keep the base LIO baseline unchanged when measuring the dynamic filter contribution.
- Version range-image resolution, history length, voxel size, and clustering thresholds.
- Preserve candidate, rejected, recovered, and final-static point layers.
- Use [DR-REMOVER](dr-remover.md), [ERASOR](erasor.md), or [Removert](removert.md) as offline QA baselines.

## Sources

- IEEE DOI: https://doi.org/10.1109/TIM.2026.3666055
- ResearchGate abstract/author version mirror: https://www.researchgate.net/publication/401128605_DOF-LIO_LiDAR-Inertial_Odometry_with_Lightweight_Dynamic_Object_Filter
- Local context: [STATIC-LIO Dynamic Points Removal](static-lio-dynamic-points-removal.md)
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
