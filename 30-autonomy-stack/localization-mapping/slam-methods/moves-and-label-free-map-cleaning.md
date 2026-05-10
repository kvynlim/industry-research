# MOVES and Label-Free Map Cleaning

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "MOVES and Label-Free Map Cleaning is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

## Summary

Label-free map cleaning removes moving and movable objects from LiDAR maps without requiring dense semantic segmentation labels. This gap matters because labeled dynamic-object data is expensive, domain-specific, and often unavailable for industrial, airport, warehouse, mining, or campus environments.

MOVES is the key representative: it learns to transform a dynamic LiDAR scan into a corresponding static reconstruction, then segments moving and movable objects from the difference, without segmentation labels. Related online and global-map methods such as TOSS, BeautyMap, and DUFOMap address static-map building and dynamic removal with tracking, voting, visibility, or efficient binary encodings.

## What It Is

Label-free map cleaning is a family of methods that use structure, correspondence, generative reconstruction, visibility, or temporal consistency instead of manual object labels. The target is not merely moving-object segmentation in a live scan. The target is a static map or static scene reconstruction that preserves localization-relevant structure while removing object traces and occlusion artifacts.

MOVES focuses on two hard classes:

- **Moving objects:** actors that are moving during the scan.
- **Movable objects:** objects that may be stationary now but are not reliable permanent map structure.

That second class is critical for AV maps. A parked vehicle, pallet, cart, cone, or temporary barrier may be static in one scan but should not become a permanent localization landmark.

## Core Idea

MOVES trains a GAN-style dynamic-to-static translation model. Given a dynamic LiDAR scan, it predicts the corresponding static background, including regions occluded by moving or movable objects. The dynamic/movable segmentation can then be inferred by comparing the input scan to the reconstructed static scan. MOVES-MMD extends the approach to datasets that lack paired static/dynamic correspondence by using unsupervised domain adaptation.

Other label-light methods use different evidence:

- **DUFOMap:** ray-cast visibility; if a region has been observed empty, later occupancy there is dynamic evidence.
- **TOSS:** online tracking-based moving-object segmentation plus voting-based static object recovery.
- **BeautyMap:** binary-encoded ground matrix and visibility-aware static restoration for global map dynamic-point removal.

The shared theme is to reduce dependence on hand-labeled object masks while preserving static structure.

## Inputs and Outputs

| Item | Role |
|---|---|
| Dynamic LiDAR scans or range images | Input observations containing static, moving, and movable objects. |
| Static/dynamic scan pairs | Useful for MOVES training when available. |
| Unpaired datasets | Used by MOVES-MMD with domain adaptation. |
| Poses or local alignment | Needed for map-level cleaning and static reconstruction evaluation. |
| Visibility or range evidence | Used by DUFOMap, BeautyMap, and restoration logic. |
| Static reconstruction | Predicted clean scan or map layer. |
| Dynamic/movable mask | Points or regions to remove, downweight, or review. |
| Cleaned map | Static point cloud or map product for localization/planning. |

## Pipeline

1. **Data preparation**
   - Collect LiDAR sequences in dynamic environments.
   - Build paired static/dynamic examples when possible, or separate static and dynamic domains for adaptation.

2. **Representation**
   - Convert point clouds into range images, local scans, voxels, or encoded ground matrices.
   - Preserve pose and scan provenance for map-level QA.

3. **Static reconstruction or dynamic evidence estimation**
   - Predict the static background with a generative model, or
   - Accumulate visibility/voting evidence from repeated observations.

4. **Mask extraction**
   - Compare dynamic input against predicted static output or visibility-consensus state.
   - Mark moving, movable, ghost, and uncertain regions.

5. **Static restoration**
   - Restore valid static structure that would otherwise be removed due to occlusion or one-sided observations.
   - Avoid turning unobserved space into free space.

6. **Map publication**
   - Publish static map, rejected object layer, uncertain layer, and cleaner diagnostics.

## Strengths

- Reduces dependence on costly semantic segmentation labels.
- Addresses movable objects, not only currently moving objects.
- Can reconstruct occluded static background rather than only deleting foreground points.
- Better suited to industrial and airport domains where public labels are sparse or mismatched.
- Visibility- and voting-based companions provide explainable baselines.
- Cleaned maps can improve localization by removing ghost tracks and transient clutter.

## Failure Modes

- Generative models can hallucinate plausible but wrong static structure.
- Static/dynamic paired data may still be expensive to collect.
- Domain adaptation can fail when LiDAR pattern, mounting, environment, or object types shift.
- Movable objects that remain present in most training data may be learned as background.
- Thin static structures, curbs, cones used as permanent markers, or aircraft stand equipment can be removed incorrectly.
- Removing too much clutter can reduce scan-matching observability in open areas.
- Label-free does not mean validation-free; manual QA and localization regression are still required.

## Airside/AV Fit

Label-free cleaning is highly relevant airside because airport-specific labels are expensive and public road datasets do not cover many key classes. Aircraft, tugs, stairs, dollies, belt loaders, buses, cones, temporary barriers, snow equipment, and maintenance assets create moving and movable clutter that can corrupt maps.

Recommended airside use:

- Use label-free methods to bootstrap map cleaning and identify high-value labeling gaps.
- Preserve rejected points and masks for QA; do not discard them.
- Treat aircraft and GSE as movable-static unless a site policy marks an installation as permanent.
- Evaluate map cleaning by localization performance and static preservation, not only visual cleanliness.
- Use multi-session evidence before promoting reconstructed or restored structure into the static map.
- Compare MOVES-style learned cleaning with DUFOMap/BeautyMap/TOSS-style geometric evidence.

For AV programs, label-free cleaning is best used as part of a map-building pipeline with validation gates. It is not a substitute for operational map policy.

## Implementation Notes

- Keep the cleaner decision per point or cell: kept, removed, restored, reconstructed, or uncertain.
- Store the model version, training domain, LiDAR configuration, and input representation with every cleaned map.
- Run conservative thresholds first and inspect false removals of localization anchors.
- Use route-specific regression tests: ATE/RPE, inlier counts, scan-matching residuals, degeneracy, and intervention risk.
- Avoid promoting hallucinated static reconstructions without repeated real observations.
- Include open-apron and high-clutter cases in validation; average urban benchmark performance is not enough.
- Pair learned methods with visibility reasoning to reduce hallucinated or occlusion-driven mistakes.

## Sources

- MOVES arXiv paper: https://arxiv.org/abs/2306.14812
- MOVES Pattern Recognition article: https://www.sciencedirect.com/science/article/abs/pii/S0031320324004023
- TOSS, "Real-time Tracking and Moving Object Segmentation for Static Scene Mapping": https://arxiv.org/abs/2408.05453
- BeautyMap, "Binary-Encoded Adaptable Ground Matrix for Dynamic Points Removal in Global Maps": https://arxiv.org/abs/2405.07283
- DUFOMap project page: https://kth-rpl.github.io/dufomap/
- DUFOMap paper: https://arxiv.org/abs/2403.01449
- Local context: [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md), [MapCleaner](mapcleaner.md), [ERASOR](erasor.md), [Removert](removert.md)
