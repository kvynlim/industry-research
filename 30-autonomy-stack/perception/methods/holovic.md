# HoloVIC

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "frontier"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "data-engine"]
  reason: "HoloVIC is rated for cooperative perception and infrastructure-assisted sensing evaluation."
method-priority:end -->

## What It Is

HoloVIC is a CVPR 2024 dataset and benchmark for large-scale, holistic vehicle-infrastructure cooperative perception.

It is built around intelligent traffic intersections with many synchronized roadside sensors.

The benchmark emphasizes a global, multi-sensor view rather than a single ego vehicle.

The dataset includes monocular cameras, fisheye cameras, and LiDAR across multiple intersections.

It supports detection, tracking, and vehicle-infrastructure cooperative perception tasks.

## Core Technical Idea

HoloVIC treats an intersection as a sensor network.

Each roadside node observes only a partial view, but the full intersection can be reconstructed by combining synchronized sensors.

The central idea is "holographic" perception: produce a consistent global scene representation from heterogeneous infrastructure sensors.

The benchmark stresses:

- Wide-area coverage.
- Multi-sensor calibration.
- Cross-camera and cross-LiDAR consistency.
- Global object identity across devices and time.
- Cooperative perception between infrastructure and vehicle viewpoints.

This makes HoloVIC closer to a deployed traffic infrastructure system than a small paired-agent V2X dataset.

## Inputs and Outputs

Inputs:

- Roadside RGB camera streams.
- Roadside fisheye camera streams.
- Roadside LiDAR point clouds.
- Calibration between sensors and global coordinates.
- Time-synchronized frames.
- Optional vehicle-side observations for VIC settings.

Outputs:

- Monocular 3D detections.
- LiDAR 3D detections.
- Multi-sensor 3D detections.
- Multi-object tracks with global identities.
- Vehicle-infrastructure cooperative detections.

The annotation space is road-intersection-centric, not airport-centric.

## Architecture or Benchmark Protocol

HoloVIC is a dataset and benchmark suite, not one model.

The protocol separates tasks so methods can be evaluated by sensing mode and cooperation level.

Representative task families:

- Monocular 3D object detection.
- LiDAR 3D object detection.
- Multi-sensor detection and tracking.
- Vehicle-infrastructure cooperative perception.

The benchmark uses globally consistent annotations so predictions from different sensors can be compared in one frame.

This is important for measuring whether a cooperative model improves global intersection perception rather than only local agent perception.

## Training and Evaluation

Training uses synchronized multi-sensor sequences with calibration and 3D annotations.

Evaluation reports detection and tracking metrics appropriate to each task.

Typical signals include:

- 3D detection AP.
- Orientation-aware detection metrics for camera tasks.
- MOTA, IDF1, or related identity-continuity metrics for tracking.
- Performance differences between single-sensor, multi-sensor, and cooperative modes.

HoloVIC also supports held-out intersection evaluation, which is useful for measuring deployment transfer across sensor layouts.

## Strengths

- Large-scale real-world infrastructure dataset.
- Multiple intersections with different sensor layouts.
- Heterogeneous sensor coverage, including fisheye cameras.
- Global tracking annotations make it more useful for operations than frame-only detection.
- Supports both infrastructure-only and vehicle-infrastructure cooperative evaluation.
- Better match to fixed-site perception than vehicle-only datasets such as nuScenes or Waymo.

## Failure Modes

- Global performance can hide local blind spots near conflict points.
- Sensor synchronization quality constrains tracking and fusion accuracy.
- Fisheye and camera calibration errors can produce systematic 3D localization bias.
- Road traffic classes and behaviors do not cover aircraft or ramp-service operations.
- Intersections have clearer lane structure than apron stands.
- Privacy processing or visual degradation may affect camera-only baselines.

## Airside AV Fit

HoloVIC is highly relevant for instrumented airport stands and service-road intersections.

The key transferable idea is a fixed multi-sensor site model with global identities.

Airside use cases:

- Holographic stand monitoring from terminal, mast, and jet-bridge sensors.
- Long-lived tracking of GSE around an aircraft turnaround.
- Cooperative perception between an autonomous baggage tractor and stand infrastructure.
- Global occupancy and object state for ramp-control dashboards.

For safety use, HoloVIC would need an airport version with surveyed stand frames, aircraft geometry, service-equipment classes, worker pose or visibility tags, and night/weather splits.

## Implementation Notes

- Treat HoloVIC as a benchmark pattern for fixed-site perception, not as a drop-in airport model.
- Preserve per-sensor calibration metadata in any derived data loader.
- Do not collapse all camera views before checking which sensor actually contributes to each object.
- For airside, add per-zone metrics: under-wing area, equipment staging area, stand lead-in line, pushback lane, and service-road crossing.
- Use tracking IDs to evaluate handoff between infrastructure and onboard perception.
- Add latency and dropped-frame fields if adapting HoloVIC to real-time airport monitoring.

## Sources

- CVPR 2024 paper: https://openaccess.thecvf.com/content/CVPR2024/html/Yu_HoloVIC_Large-scale_Dataset_and_Benchmark_for_Multi-Sensor_Holographic_Intersection_and_Vehicle-Infrastructure_CVPR_2024_paper.html
- CVPR 2024 PDF: https://openaccess.thecvf.com/content/CVPR2024/papers/Yu_HoloVIC_Large-scale_Dataset_and_Benchmark_for_Multi-Sensor_Holographic_Intersection_and_Vehicle-Infrastructure_CVPR_2024_paper.pdf
- arXiv: https://arxiv.org/abs/2403.02640
- Official project page: https://holovic.net/
