# 4dNDF

## Executive Summary

4dNDF is a neural implicit LiDAR mapping method for dynamic scenes. It fits a time-dependent truncated signed distance function (TSDF) to a sequence of LiDAR scans, then uses the learned 4D representation to extract a static map and segment dynamic points.

Unlike [ERASOR](erasor.md), [Removert](removert.md), or ERASOR++, 4dNDF is not a lightweight hand-engineered cleaner. It is an offline neural reconstruction method that can produce more complete static geometry, but it requires optimization, GPU-oriented dependencies, and reliable input poses. It belongs in research/QA evaluation for [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md), not as the first production map-cleaning default.

## What It Is

The CVPR 2024 paper "3D LiDAR Mapping in Dynamic Environments Using a 4D Implicit Neural Representation" proposes a spatio-temporal implicit neural map for LiDAR sequences. The official PRBonn repository implements the method and provides scripts for static mapping, surface reconstruction evaluation, and dynamic-object segmentation evaluation.

## Core Technical Idea

4dNDF models the scene as a time-varying TSDF. Spatial information is stored in sparse feature grids; a shared decoder maps queried spatial features to coefficients for time-dependent basis functions. Querying a location and time gives a TSDF value, so the system can reconstruct scene surfaces at different times.

The static world is the part of the representation that remains consistent over time. Dynamic objects are separated because their geometry varies across the temporal basis. This reframes map cleaning as optimizing a 4D scene model rather than deleting points through local visibility or occupancy rules.

## Inputs and Outputs

| Item | Role |
|---|---|
| LiDAR scan sequence | Observations used to optimize the 4D implicit representation. |
| Estimated poses | Required by the published method; pose estimation is not solved jointly. |
| Voxel/grid and training config | Controls spatial resolution, sampling, losses, and optimization. |
| GPU-capable environment | Needed for practical training and evaluation. |
| Static mesh or point cloud | Extracted static map for QA or downstream comparison. |
| Dynamic point segmentation | Identified dynamic parts of the input sequence. |
| Time-specific meshes/TSDF queries | Useful for dynamic-scene inspection and research visualization. |

## Pipeline

1. Prepare scan sequence and poses in the expected dataset format.
2. Initialize sparse feature grids and shared decoder.
3. Sample spatial-temporal points from LiDAR observations.
4. Optimize the time-dependent TSDF representation with the paper's piecewise supervision losses.
5. Query the learned field at selected times for reconstruction.
6. Extract the time-consistent static map by filtering dynamic parts.
7. Export static mesh/point cloud and dynamic segmentation results.
8. Compare against geometric baselines such as ERASOR and Removert.

## Evaluation

The paper evaluates both static map reconstruction quality and dynamic point segmentation. The repository documents surface-reconstruction evaluation on Co-Fusion and Newer College data, plus dynamic-object segmentation evaluation on the KTH DynamicMap Benchmark. The code README notes that the sanity test trains on 20 KITTI sequence 00 frames and outputs a static mesh and dynamic segmentation visualization.

For production-style evaluation, add:

- Runtime, GPU memory, and batch processing cost per route length.
- Static-map completeness around thin poles, curbs, signs, stand equipment, and building edges.
- Dynamic rejection for vehicles, people, aircraft, buses, tugs, carts, and temporary barriers.
- Robustness to pose noise, time-sync error, and scan sparsity.
- Comparison to simpler cleaners on localization residual, not only reconstruction metrics.

## Strengths

- Represents space and time jointly instead of making only local deletion decisions.
- Can produce complete static reconstructions while removing dynamic parts.
- Handles dynamic segmentation and static mapping in one learned representation.
- Official code is available from PRBonn.
- Valuable as an offline QA tool and research benchmark against classical cleaners.

## Failure Modes

- The paper explicitly notes reliance on poses from a separate SLAM approach.
- The method is offline, not online or incremental in the published form.
- Optimization cost and GPU dependencies complicate production map factories.
- Failure modes can be harder to explain than bin, ray, or range-image cleaners.
- Over-smoothed or hallucinated geometry may look clean while harming localization.
- Domain-specific airport actors and sparse long-range LiDAR data need separate validation.

## Airside/Indoor/Outdoor Fit

| Environment | Fit | Notes |
|---|---|---|
| Airside apron and service roads | Research/QA fit | Useful for evaluating dense static reconstruction in dynamic operations, but not the first production cleaner because of offline optimization and uncertainty questions. |
| Indoor dynamic scenes | Good research fit | Can model people and movable objects in bounded spaces if poses and coverage are good. |
| Outdoor road/campus | Strong research fit | Matches LiDAR dynamic-map benchmarks and Newer College/KITTI-style experiments. |
| Large fleet map factory | Caution | Compute, reproducibility, and explainability must be proven before adoption. |

## Implementation Notes

- Use the official repository as the reference implementation before reimplementing.
- Reproduce the repository sanity test before running custom data.
- Store exact config, commit hash, input poses, and training logs with generated maps.
- Compare generated static maps against ERASOR, Removert, MapCleaner, and FreeDOM using the same map QA metrics.
- Treat 4dNDF output as an additional candidate layer until localization testing confirms it improves scan matching.
- Keep raw scans and dynamic segmentation outputs for manual review; do not only archive the mesh.

## Sources

- Paper: https://arxiv.org/abs/2405.03388
- arXiv DOI: https://doi.org/10.48550/arXiv.2405.03388
- Official repository: https://github.com/PRBonn/4dNDF
- CVPR record DOI: https://doi.org/10.1109/CVPR52733.2024.01460
- Local context: [LiDAR Map Cleaning and Dynamic Removal](lidar-map-cleaning-dynamic-removal.md)
- Local baselines: [ERASOR](erasor.md), [Removert](removert.md)
