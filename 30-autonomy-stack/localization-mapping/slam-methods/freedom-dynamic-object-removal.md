# FreeDOM Dynamic Object Removal

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "FreeDOM Dynamic Object Removal is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

## Executive Summary

FreeDOM is an online dynamic-object-removal framework for static LiDAR map construction. It estimates conservative free space, removes dynamic points from incoming scans in a scan-removal front end, and refines the map in a back end using incremental free-space evidence.

Compared with offline cleaners such as [ERASOR](erasor.md) and [Removert](removert.md), FreeDOM is designed to build a clean static map as scans arrive. It is a useful bridge between online dynamic filtering and [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md).

## What It Is

The 2025 paper "FreeDOM: Online Dynamic Object Removal Framework for Static Map Construction Based on Conservative Free Space Estimation" frames dynamic removal as a real-time static map construction problem. The method is learning-free, does not assume flat ground, and does not depend on semantic object classes. The authors report evaluation on SemanticKITTI, HeLiMOS, and indoor datasets with multiple LiDAR types, and provide a ROS/C++ repository.

## Core Technical Idea

FreeDOM uses a spatial motion cue: a point is dynamic if it falls inside space that has been conservatively estimated as free. To make this practical online, it maintains a multi-resolution map:

- FreeSpace is represented at voxel resolution for efficient conservative free-space estimation.
- StaticSpace is represented at subvoxel resolution for a higher-resolution static map.

The scan-removal front end raycasts each scan into FreeSpace, enhances missing ray directions where LiDAR has no background return, and labels scan voxels by DynamicLevel. The map-refinement back end then removes residual dynamic points from the accumulated static map as new free-space evidence arrives.

## Inputs and Outputs

| Item | Role |
|---|---|
| Streaming LiDAR scans | Current observations to segment and integrate. |
| Estimated poses | Required to integrate FreeSpace and StaticSpace in a world frame. |
| LiDAR FoV/scanning pattern | Used for raycast enhancement and depth-image handling. |
| FreeSpace parameters | Voxel size, conservativeness duration, neighborhoods, and recovery thresholds. |
| StaticSpace parameters | Subvoxel resolution and map integration policy. |
| Online static map | Incrementally built static voxel/point-cloud map. |
| Per-point DynamicLevel labels | Static, aggressive, moderate, or conservative dynamic labels for scan/map decisions. |

## Pipeline

1. Receive a LiDAR scan and its pose estimate.
2. Insert visibility information into a multi-resolution FreeSpace/StaticSpace map.
3. Use raycast enhancement to recover free-space evidence in directions without a normal background return.
4. Apply spatial and temporal conservative rules so FreeSpace is not marked from a single weak observation.
5. Label current scan voxels by whether they fall in or near FreeSpace.
6. Assign per-point DynamicLevel labels from scan-voxel labels.
7. Integrate lower-dynamic-level points into StaticSpace.
8. Use incremental FreeSpace to clear residual dynamic points from the map.
9. Save the generated static point-cloud or voxel map for QA.

## Evaluation

The arXiv paper reports evaluation on SemanticKITTI, HeLiMOS, and indoor datasets, with a stated average F1-score improvement of 9.7% over state-of-the-art methods. The official repository includes ROS launch files for SemanticKITTI, HeLiMOS, and indoor datasets and evaluation scripts using voxel sizes of 0.2 m outdoors and 0.1 m indoors by default.

For target deployment, evaluate:

- Online processing frequency under full sensor load.
- Static preservation and dynamic rejection against labeled or manually reviewed logs.
- Residual dynamic objects after map refinement, not only scan-level labels.
- Sensitivity to pose drift and time synchronization.
- Behavior with sparse, non-repetitive, or multi-LiDAR scan patterns.
- Localization quality on maps built online versus offline-cleaned maps.

## Strengths

- Online static map construction rather than only offline post-processing.
- Learning-free and class-agnostic.
- Does not rely on a flat-ground assumption.
- Multi-resolution map balances free-space computation and static-map resolution.
- Back-end refinement addresses accumulated scan-removal mistakes.
- Official ROS/C++ implementation is available.

## Failure Modes

- Conservative free-space estimation can leave residual dynamic points when evidence is insufficient.
- Pose drift can put static objects into estimated FreeSpace and create false positives.
- Slow-moving or repeatedly observed movable objects can be misclassified as static.
- Raycast enhancement depends on LiDAR FoV and sensor-specific return behavior.
- Aggressive neighborhoods can erode nearby static structure.
- Online operation does not remove the need for offline QA before publishing a production map.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron and service roads | Promising online map-build candidate | Class-agnostic free-space logic is attractive for aircraft and GSE, but large open spaces, pose drift, and sparse long-range returns require careful tuning. |
| Indoor warehouses/corridors | Good candidate | The paper includes indoor evaluation; validate around shelves, glass, doors, forklifts, ramps, and stairs. |
| Outdoor road/campus | Strong fit | Matches SemanticKITTI and HeLiMOS-style dynamic LiDAR scenes. |
| Real-time fleet map maintenance | Candidate with QA gate | Useful for incremental map candidates, but production map publication should still require review and multi-session evidence. |

## Implementation Notes

- Start from the official ROS/C++ implementation and reproduce its dataset launch flow.
- Version voxel size, subvoxel size, conservativeness duration, DynamicLevel thresholds, and raycast enhancement settings.
- Feed FreeDOM with the best available pose source; dynamic removal quality is coupled to pose quality.
- Preserve DynamicLevel layers rather than only exporting a final binary static map.
- Compare online FreeDOM output with offline ERASOR, Removert, MapCleaner, ERASOR++, and 4dNDF outputs.
- For airside maps, keep aircraft and GSE decisions in movable/dynamic layers until cross-session policy confirms permanence.

## Sources

- Paper: https://arxiv.org/abs/2504.11073
- arXiv DOI: https://doi.org/10.48550/arXiv.2504.11073
- Official repository: https://github.com/LC-Robotics/FreeDOM
- IEEE RA-L DOI: https://doi.org/10.1109/LRA.2025.3560881
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
- Local baselines: [ERASOR](erasor.md), [Removert](removert.md)
