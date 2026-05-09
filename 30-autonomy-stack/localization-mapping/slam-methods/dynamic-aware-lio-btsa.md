# Dynamic-Aware LIO BTSA

**Last updated:** 2026-05-09

## Executive Summary

BTSA is a dynamic-aware LiDAR-inertial odometry framework built around spatio-temporal normal analysis. The paper title is "Breaking the Static Assumption: A Dynamic-Aware LIO Framework Via Spatio-Temporal Normal Analysis."

The useful idea is to stop treating dynamic filtering as a separate preprocessing stage. BTSA brings dynamic awareness into registration itself, so pose estimation and dynamic-point decisions can improve together when moving objects dominate the scan.

## What It Is

The arXiv paper describes a dynamic-aware ICP front end for LIO in crowded, sparse, or geometrically degenerate scenes. It was submitted in October 2025 and is listed as accepted to IEEE Robotics and Automation Letters. The authors also provide a public GitHub repository and dataset link.

Compared with simple remove-then-register pipelines, BTSA targets the circular dependency in dynamic LIO: good localization needs static features, but reliable dynamic detection often needs a good pose first.

## Core Technical Idea

BTSA models points in four-dimensional space-time and computes spatio-temporal normals over a short temporal sliding window. The temporal component of the normal is used as a motion cue, and unstable points are iteratively filtered during pose optimization.

The repository describes three main blocks:

| Block | Role |
|---|---|
| Input preprocessing | IMU preintegration and LiDAR motion-distortion correction. |
| Dynamic-aware registration | Spatio-temporal normal computation and stable/unstable point classification. |
| Static map building | DBSCAN-style candidate grouping and spatial consistency checks to reduce false removals. |

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scans | Geometric observations for registration and dynamic analysis. |
| IMU stream | Propagation, preintegration, and deskew support. |
| Temporal local map | Short history used to estimate space-time normals. |
| Dynamic labels | Stable/unstable point decisions used inside registration. |
| Static map | Output map after spatial consistency verification. |
| Odometry | Main runtime output for localization and downstream mapping. |

## Pipeline

1. Synchronize LiDAR and IMU data.
2. Deskew scans and propagate an initial state with IMU information.
3. Maintain a short temporal sliding-window map.
4. Compute space-time normals for candidate points.
5. Classify unstable points from the temporal normal component.
6. Optimize registration while excluding or downweighting unstable points.
7. Cluster dynamic candidates to reason at object scale.
8. Apply spatial consistency checks to avoid removing newly observed static areas.
9. Insert verified static points into the map.
10. Publish odometry, static map updates, and dynamic diagnostics.

## Evaluation Snapshot

The paper reports significant gains over state-of-the-art LIO systems in challenging dynamic environments with limited static geometry. The repository states real-time performance around 50 ms per scan, but this should be reproduced on target hardware and sensor configuration.

For deployment evaluation, compare against FAST-LIO2, LIO-SAM, STATIC-LIO, and a no-filter baseline on the same logs. Track ATE/RPE, scan-matching residuals, static inlier counts, dynamic rejection rate, and failure behavior when most nearby returns come from moving actors.

## Strengths

- Dynamic filtering is part of registration, not only a pre-registration mask.
- Space-time normals give a geometric motion cue without requiring semantic classes.
- Spatial consistency checks help distinguish true dynamics from new static observations.
- Public code and dataset links make reproduction more practical than closed-only papers.
- Useful in corridors, tunnels, sparse areas, and crowded scenes where static features are limited.

## Failure Modes

- The temporal window must be well aligned; timing or deskew errors can look like motion.
- Dynamic points that move slowly or stop may appear static.
- Heavy over-filtering can remove the few points that make scan matching observable.
- DBSCAN-style clustering needs careful tuning for sensor density and range.
- Repository maturity, licensing, and data formats should be checked before production use.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron | Promising research candidate | Useful around aircraft, buses, and GSE, but open-space degeneracy and large movable objects need validation. |
| Indoor warehouses | Good candidate | Handles pedestrians/forklifts without class labels; verify ramps, shelving, glass, and tight corridors. |
| Outdoor road/campus | Strong research fit | Matches the paper motivation of dynamic urban scenes with limited reliable static structure. |
| Offline static-map publishing | Supporting role | Use BTSA as an odometry/map-building front end, then still run map cleaning QA. |

## Implementation Notes

- Start from the official repository and reproduce the provided dataset flow before changing parameters.
- Version the temporal-window length, normal threshold, clustering radius, and spatial consistency settings.
- Store removed points as a QA layer rather than discarding them.
- Monitor static inlier count after filtering; a cleaner map is not useful if localization becomes underconstrained.
- Pair with offline cleaners such as [DR-REMOVER](dr-remover.md), [ERASOR](erasor.md), or [Removert](removert.md) before publishing a production map.

## Sources

- arXiv: https://arxiv.org/abs/2510.22313
- arXiv DOI: https://doi.org/10.48550/arXiv.2510.22313
- Official repository: https://github.com/thisparticle/btsa
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
