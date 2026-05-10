# ROMAN Object Map Alignment

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["slam", "mapping", "validation"]
  reason: "ROMAN Object Map Alignment is rated as a supporting SLAM method for autonomy-stack triage and follow-up reading."
method-priority:end -->

Related docs: [Object-Level SLAM](object-level-slam.md), [Semantic SLAM](semantic-slam.md), [Loop Closure and Place Recognition](loop-closure-place-recognition.md), [Distributed Multi-Robot PGO](distributed-multi-robot-pgo.md), [Kimera-Multi](kimera-multi.md), and [Kimera-RPGO / PCM](kimera-rpgo-pcm.md).

**Last updated:** 2026-05-09

## Executive Summary

ROMAN, short for Robust Object Map Alignment Anywhere, is an object-map alignment method for robust global localization and multi-robot or multi-session loop closure. It creates maps of open-set, view-invariant objects and aligns object submaps even when robots observe the same environment from very different viewpoints.

The method is important because feature-based loop closure often fails under large viewpoint changes, sparse texture, perceptual aliasing, or opposite-direction traversals. ROMAN instead treats objects as higher-level map landmarks and solves global data association between object submaps using graph-theoretic matching with shape, semantic similarity, and a gravity-direction prior.

For airport autonomy, ROMAN is relevant because airside environments contain stable object landmarks: jet bridges, poles, signs, baggage equipment zones, hydrants, fixed barriers, terminal edges, light masts, and hangar fixtures. It is less suitable around movable aircraft and GSE unless the object map separates fixed infrastructure from transient equipment.

## What It Is

- Object-level global localization and map alignment.
- Open-set object map registration, not a dense geometric mapper by itself.
- Candidate loop-closure generator for multi-session or multi-robot SLAM.
- Viewpoint-robust alternative to purely image-feature or segment-only loop closure.
- Research code with RSS 2025 paper and public repository.

## Core Technical Idea

ROMAN aligns two object submaps:

```text
object submap A + object submap B -> object associations -> relative transform
```

Each object carries geometry and semantic information. ROMAN searches for a consistent association set between two object maps using:

- object shape similarity;
- semantic similarity from open-set object descriptions or embeddings;
- relative spatial consistency between object arrangements;
- a gravity direction prior to reduce impossible alignments;
- robust global data association to reject outliers.

Once a consistent object association is found, ROMAN estimates the relative pose between submaps. A SLAM backend can then use that relative transform as a loop or inter-robot constraint.

## Inputs and Outputs

Inputs:

- Object detections or object segments from a local mapping system.
- Object positions, shapes, extents, or descriptors.
- Semantic labels or open-set semantic embeddings.
- Gravity direction from IMU, VIO, or SLAM estimate.
- Candidate local object submaps from different sessions or robots.

Outputs:

- Candidate object correspondences.
- Relative transform between object submaps.
- Confidence or consistency score for the alignment.
- Loop-closure or inter-robot factor for pose graph optimization.

ROMAN does not replace the local odometry front end. It complements LiDAR, visual, visual-inertial, or object-SLAM systems by proposing higher-level associations.

## Pipeline

1. Run local SLAM or odometry to build a trajectory and local metric map.
2. Detect and represent objects as map entities.
3. Build object submaps over keyframes or route segments.
4. For a query submap, retrieve candidate database submaps.
5. Form a graph-theoretic association problem over objects.
6. Score object-pair compatibility using shape, semantic, and spatial consistency.
7. Apply gravity-prior constraints to reduce false matches.
8. Estimate the relative pose from the accepted object associations.
9. Insert a loop or inter-robot factor into a robust pose graph.
10. Audit the backend residuals and reject inconsistent factors.

## Strengths

- More viewpoint-invariant than raw image-feature matching.
- Can handle maps built from robots traveling in opposite directions.
- Useful in feature-sparse or perceptually aliased environments.
- Compact object maps are cheaper to share between robots than dense maps.
- Natural match for semantic mapping and long-term localization.
- Works across indoor, urban, and unstructured settings in the reported experiments.

## Failure Modes

- Object detectors can miss, merge, split, or misclassify objects.
- Movable objects create false persistent landmarks.
- Repetitive object layouts can alias, especially in terminals, warehouses, parking areas, and gate rows.
- Open-set semantics may drift under domain shift.
- Object extents are noisy when only partially observed.
- A correct object association can still produce poor metric alignment if objects are nearly collinear or coplanar.
- False loop closures can corrupt a graph unless robust PGO and residual audits are used.

## Airside, Indoor, and Outdoor Fit

**Indoor:** Strong fit for terminals, baggage halls, maintenance rooms, warehouses, and large indoor spaces with repeated but stable infrastructure. Needs careful alias handling in corridors and gate areas.

**Outdoor:** Useful for urban, industrial, campus, and forested environments where object-level landmarks persist across sessions.

**Airside:** Promising as a map alignment layer for fixed infrastructure. Avoid using movable aircraft, baggage carts, belt loaders, cones, and temporary barriers as persistent landmarks unless the map explicitly models object lifetime. Pair ROMAN with LiDAR registration, RTK/GNSS gates, and robust pose graph optimization.

## Implementation Notes

- Define which object classes are allowed to become persistent map landmarks.
- Store object lifetime, observation count, semantic confidence, and geometry uncertainty.
- Use gravity and route constraints before accepting object-map candidates.
- Add LiDAR or visual geometric verification after ROMAN association.
- Insert ROMAN factors through robust graph optimization, not directly into a fragile backend.
- Log rejected associations to improve object taxonomy and alias filters.
- Separate global localization use from semantic inventory use; a good asset map is not automatically a good localization map.

## Sources

- Peterson, Jia, Tian, Thomas, and How, "ROMAN: Open-Set Object Map Alignment for Robust View-Invariant Global Localization." https://arxiv.org/abs/2410.08262
- ROMAN project page. https://acl.mit.edu/ROMAN/
- Official ROMAN repository. https://github.com/mit-acl/roman
- RSS 2025 paper PDF. https://www.roboticsproceedings.org/rss21/p029.pdf
