# TRLO Dynamic Tracking Removal LiDAR Odometry

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["slam", "mapping", "validation", "runtime-localization", "outdoor"]
  reason: "TRLO Dynamic Tracking Removal LiDAR Odometry is rated for dynamic-object filtering and map-cleaning workflows that protect localization maps."
method-priority:end -->

**Last updated:** 2026-05-09

## Executive Summary

TRLO is an efficient LiDAR odometry method that combines 3D dynamic-object detection, tracking, removal, and cleaned-scan odometry. Its full paper title is "TRLO: An Efficient LiDAR Odometry with 3D Dynamic Object Tracking and Removal."

Unlike purely geometric map cleaners, TRLO uses object-level detection and tracking to decide which points should be removed before odometry. This makes it attractive when vehicles, cyclists, and pedestrians dominate the scene, but it also makes detector domain fit a core risk.

## What It Is

The arXiv version was submitted in October 2024. The GitHub repository says the paper was accepted by IEEE Transactions on Instrumentation and Measurement in April 2025, and bibliographic records list DOI 10.1109/TIM.2025.3561381.

The repository provides ROS Noetic/C++ code, TensorRT/CUDA dependencies for detection, and services to save generated maps and trajectories. The implementation can run with or without IMU input, but the method is best read as dynamic-aware LiDAR odometry rather than a full map-cleaning-only tool.

## Core Technical Idea

TRLO detects object bounding boxes with a deep-learning detector, tracks objects through time with a UKF and nearest-neighbor association, removes dynamic objects from the scan, and estimates odometry from the cleaned static point cloud.

It also reuses detected bounding boxes as posture consistency constraints. This is important because TRLO does not simply throw away every object-like cluster; object tracks and box consistency contribute to pose refinement.

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scans | Main input for detection, tracking, removal, and odometry. |
| Optional IMU | ROS implementation supports IMU-assisted operation. |
| 3D detector | Produces object boxes for vehicles/cyclists and related classes. |
| Object tracks | UKF/NN tracking estimates object state and velocity. |
| Static point cloud | Cleaned scan used for odometry. |
| Keyframe database | Hash-based access to keyframes/submaps. |
| Odometry and map | Main runtime outputs. |

## Pipeline

1. Receive a LiDAR scan and optional IMU stream.
2. Run a 3D object detector, implemented efficiently with TensorRT in the reported system.
3. Track detected objects using UKF prediction/update and nearest-neighbor association.
4. Classify tracked objects by motion state, including dynamic and semi-static behavior.
5. Remove points inside dynamic object boxes from the scan.
6. Build a submap using hash-based keyframe database access.
7. Run a fast two-stage nearest-point or GICP-style scan-matching solver.
8. Apply bounding-box posture consistency constraints.
9. Publish trajectory, keyframes, and a cleaner point-cloud map.

## Evaluation Snapshot

The arXiv paper reports evaluation and ablations on KITTI and UrbanLoco. The abstract states that TRLO improves state-estimation accuracy and map cleanliness compared with baselines. The repository states the system targets real-time operation, and the paper text available through mirrors reports over 20 Hz in its tested setup.

For target evaluation, measure detector recall by local actor class, odometry ATE/RPE, map ghost rate, dynamic rejection, static preservation, GPU latency, and behavior when the detector misses domain-specific objects.

## Strengths

- Object tracking gives temporal consistency beyond frame-level segmentation.
- UKF/NN tracking is explainable and relatively lightweight compared with end-to-end dynamic SLAM.
- Bounding-box consistency constraints reuse perception outputs for pose refinement.
- Hash-based keyframe management is designed for fast submap access.
- Public code makes it easier to reproduce than closed-only IEEE papers.

## Failure Modes

- Detector class coverage is a hard dependency; unknown actors may remain in the static scan.
- False boxes can remove static structure and reduce scan-matching observability.
- Stationary objects may be classified as semi-static and still pollute long-term maps.
- TensorRT/CUDA dependencies increase deployment complexity.
- Airside classes such as aircraft, belt loaders, tugs, chocks, and baggage carts need retraining or explicit tests.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron | Conditional | Strong if the detector is trained for aircraft/GSE; weak if only road classes are covered. |
| Indoor warehouses | Conditional | Works if forklifts/people/pallet movers are detected; otherwise use geometry-first filters. |
| Outdoor road/campus | Strong research fit | KITTI and UrbanLoco match the intended dynamic urban setting. |
| Offline map cleaning | Supporting role | Good front-end map builder, but still run offline cleaners and cross-session QA. |

## Implementation Notes

- Reproduce the official ROS workflow before adapting detector classes.
- Version detector weights, thresholds, TensorRT build, and object-speed thresholds with the map build.
- Log all boxes, tracks, removed points, and retained static points.
- Compare against no-detector LIO and geometry-only dynamic filters on the same logs.
- For airside use, audit false negatives by asset class before trusting the static map.

## Sources

- arXiv: https://arxiv.org/abs/2410.13240
- arXiv DOI: https://doi.org/10.48550/arXiv.2410.13240
- Official repository: https://github.com/Yaepiii/TRLO
- IEEE DOI: https://doi.org/10.1109/TIM.2025.3561381
- Local context: [Dynamic-Object-Aware SLAM](dynamic-object-aware-slam.md)
