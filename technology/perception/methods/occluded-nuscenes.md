# Occluded nuScenes

## What It Is

- Occluded nuScenes is a controlled multi-sensor occlusion extension of the nuScenes dataset.
- The full paper title is "Occluded nuScenes: A Multi-Sensor Dataset for Evaluating Perception Robustness in Automated Driving."
- It was released as a 2025 arXiv descriptor.
- The dataset targets perception robustness under partial sensor failures and environmental occlusions.
- It focuses on reproducible, parameterized degradations across camera, radar, and LiDAR.
- It is a benchmark resource, not a new perception model.

## Core Technical Idea

- Real datasets contain sensor noise, but they rarely provide controlled failure levels.
- Occluded nuScenes starts from nuScenes scenes and adds parameterized occlusions.
- Camera occlusions are released for both full and mini nuScenes versions.
- Radar and LiDAR occlusions are generated with scripts so users can vary degradation parameters.
- The benchmark enables repeatable comparisons between fusion models under the same occlusion conditions.
- It isolates partial sensor failure from other dataset changes.
- It is designed to support robustness analysis and safety-critical perception evaluation.

## Inputs and Outputs

- Inputs are nuScenes camera, radar, and LiDAR samples.
- Camera inputs can be replaced with occluded image variants.
- Radar and LiDAR inputs can be degraded through parameterized scripts.
- Outputs are occluded multi-sensor samples compatible with nuScenes-style evaluation.
- Downstream outputs depend on the tested perception model: boxes, tracks, segmentation, occupancy, or map elements.
- The key benchmark output is performance as a function of sensor modality and occlusion severity.
- The dataset assumes users already have access to nuScenes where required.

## Architecture or Benchmark Protocol

- Camera modality includes four occlusion types.
- Two camera occlusion types are adapted from public implementations.
- Two camera occlusion types are newly designed by the authors.
- Radar modality includes three parameterized degradation scripts.
- LiDAR modality includes three parameterized degradation scripts.
- Degradations can be applied independently to a modality or used to study fusion under multiple impaired sensors.
- The protocol emphasizes controlled and reproducible adverse conditions.

## Training and Evaluation

- The descriptor frames the resource as an evaluation dataset for automated driving perception robustness.
- Typical usage is to evaluate a trained detector or fusion model on clean nuScenes and then on occluded variants.
- Results should be reported by modality, occlusion type, and severity parameter.
- The benchmark is especially useful for comparing camera-only, LiDAR-only, radar-only, and fused detectors.
- It can be used to locate failure thresholds, such as percent occlusion where mAP or recall collapses.
- It complements corruption benchmarks by emphasizing occlusion and partial sensor failure.
- It should not be treated as a replacement for real contaminated-sensor datasets.

## Strengths

- It provides controlled, repeatable sensor occlusion rather than relying on chance failures in logs.
- It covers camera, radar, and LiDAR instead of camera-LiDAR only.
- Full and mini camera releases support both lightweight and full-scale experiments.
- Parameterized radar and LiDAR scripts make severity sweeps possible.
- It is built on nuScenes, so many existing perception stacks can evaluate on it.
- It helps separate true fusion resilience from overfitting to clean multi-sensor inputs.

## Failure Modes

- Parameterized occlusions are not full physical simulations of dirt, water, ice, snow, or sensor electronics.
- The resource inherits nuScenes object taxonomy and urban-road bias.
- The arXiv descriptor is the primary source found here; release details should be verified before production use.
- Occlusion alone does not test time skew, calibration drift, packet loss, or rolling shutter.
- Multiple real failures can be correlated in ways that controlled scripts may not capture.
- Radar and LiDAR occlusion parameters need mapping to physical sensor degradation before safety claims.
- Results can be sensitive to whether models were trained with similar occlusions.

## Airside AV Fit

- Occluded nuScenes is useful for designing airside sensor-occlusion test logic.
- Camera occlusion maps to dirty lenses, rain streaks, de-icing spray, sun glare blocks, and service-vehicle blockage.
- LiDAR and radar degradations map to blocked windows, spray, snow, and equipment shadowing.
- Airside adaptation must add airport-specific sensor placements and occluders such as aircraft bodies and GSE.
- The benchmark can help define graceful degradation thresholds for apron speed limits.
- Production evidence still needs real airport sensor occlusion data and human-safety metrics.

## Implementation Notes

- Use clean nuScenes results as the baseline for every occlusion sweep.
- Report both absolute performance and relative degradation.
- Evaluate per-range and per-class behavior because near-field misses are safety critical.
- Avoid training and testing on the same occlusion patterns when claiming generalization.
- Log the exact script parameters used for radar and LiDAR occlusions.
- Combine with MultiCorrupt and MSC-Bench to cover non-occlusion corruption families.

## Sources

- arXiv descriptor: https://arxiv.org/abs/2510.18552
- nuScenes dataset: https://www.nuscenes.org/nuscenes
