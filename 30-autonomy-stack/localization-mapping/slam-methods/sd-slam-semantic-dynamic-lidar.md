# SD-SLAM Semantic Dynamic LiDAR

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "SD-SLAM Semantic Dynamic LiDAR is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

**Last updated:** 2026-05-09

## Executive Summary

SD-SLAM is a semantic LiDAR SLAM method for dynamic scenes. Its full title is "SD-SLAM: A Semantic SLAM Approach for Dynamic Scenes Based on LiDAR Point Clouds."

The method uses semantic information and Kalman filtering to distinguish dynamic, semi-static, and static landmarks, then uses the more reliable landmark classes to improve localization and build a static semantic map.

## What It Is

The arXiv version was submitted in February 2024. The starting source list also gives DOI 10.1016/j.iot.2024.101209. The paper evaluates on the KITTI odometry dataset and frames the problem as semantic SLAM for LiDAR point clouds rather than visual dynamic SLAM.

SD-SLAM is useful as a semantic dynamic-SLAM reference. It is less directly deployment-ready than simple runtime filters unless the semantic segmentation, landmark classification, and map lifecycle policy are validated for the target domain.

## Core Technical Idea

Many SLAM systems either remove dynamic objects or ignore semantics. SD-SLAM separates landmarks into dynamic, semi-static, and pure static categories using semantic information and Kalman filtering. It then uses semi-static and static semantic landmarks in the SLAM process instead of discarding all non-static-looking observations.

This distinction matters for real deployments:

| Landmark type | Interpretation | Use risk |
|---|---|---|
| Dynamic | Moving actor or transient observation | Usually reject from map/localization. |
| Semi-static | Parked or movable object with temporary stability | Useful only with caution and temporal policy. |
| Pure static | Persistent infrastructure | Preferred for localization and static map building. |

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR point clouds | Main geometric observations. |
| Semantic labels | Object or class cues for landmark classification. |
| Kalman filtering | Temporal estimation for dynamic/semi-static distinction. |
| Landmark map | Semantic static and semi-static structure. |
| Odometry/trajectory | SLAM pose output. |
| Static semantic map | Output map with multiple semantic classes. |

## Pipeline

1. Receive LiDAR point clouds.
2. Generate or ingest semantic labels for point-cloud landmarks.
3. Track landmark states through time with Kalman filtering.
4. Classify landmarks as dynamic, semi-static, or pure static.
5. Reject or downweight dynamic landmarks.
6. Use semi-static and pure static semantic landmarks for localization and mapping.
7. Update the semantic map with stable landmark evidence.
8. Publish trajectory and a static semantic map.

## Evaluation Snapshot

The arXiv abstract reports tests on the KITTI odometry dataset. It states that SD-SLAM mitigates adverse effects from dynamic objects, improves vehicle localization and mapping in dynamic scenes, and constructs a static semantic map with multiple semantic classes.

For local evaluation, measure trajectory error, map semantic consistency, dynamic/semi-static classification accuracy, localization sensitivity to semantic errors, and static-map contamination by movable objects.

## Strengths

- Explicitly models semi-static landmarks instead of treating all object-like observations as dynamic.
- Semantic map output is useful for navigation, QA, and higher-level reasoning.
- Kalman filtering adds temporal consistency to semantic decisions.
- LiDAR-only geometry avoids lighting dependence of camera-only semantic SLAM.
- KITTI evaluation makes it easy to compare with road-scene baselines.

## Failure Modes

- Semantic segmentation errors directly affect landmark use.
- Semi-static objects can be dangerous localization anchors in production maps.
- KITTI road classes do not cover airside or warehouse assets.
- No official code was found from the starting sources.
- The DOI/publisher record was less accessible than the arXiv page, so implementation details should be checked against the final article.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron | Research reference | Semantic classes must include aircraft, GSE, buses, crew, cones, chocks, and stand equipment. |
| Indoor warehouses | Research reference | Needs indoor semantic labels for racks, pallets, forklifts, doors, and people. |
| Outdoor roads/campus | Stronger fit | KITTI evaluation aligns with vehicles, roads, and urban structure. |
| Production static maps | Use cautiously | Semi-static landmarks should not be promoted without cross-session evidence. |

## Implementation Notes

- Treat semantic labels as uncertain measurements, not ground truth.
- Keep dynamic, semi-static, and static map layers separate.
- Require cross-session policy before promoting semi-static landmarks to a production localization map.
- Evaluate per-class false positives and false negatives before measuring aggregate trajectory error.
- Compare against [Semantic SLAM](semantic-slam.md), [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md), and geometry-only cleaners.

## Sources

- arXiv: https://arxiv.org/abs/2402.18318
- arXiv DOI: https://doi.org/10.48550/arXiv.2402.18318
- Journal DOI from starting source: https://doi.org/10.1016/j.iot.2024.101209
- Local context: [Semantic SLAM](semantic-slam.md)
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
