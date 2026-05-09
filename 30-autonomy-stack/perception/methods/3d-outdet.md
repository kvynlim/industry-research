# 3D-OutDet

## What It Is

- 3D-OutDet is a learned outlier detector for 3D LiDAR point clouds captured in adverse weather.
- It targets precipitation outliers, especially falling snow and rain spray, with a focus on low memory footprint and fast execution.
- The project page shows de-snowing and rain-spray-removal examples.
- It operates directly on 3D point clouds rather than relying only on 2D range images.
- It is a useful comparator for [LiSnowNet](lisnownet.md), [TripleMixer](triplemixer.md), and [AdverseNet](adversenet.md).

## Core Technical Idea

- Use a lightweight neural architecture built around a neighborhood convolution that processes nearest neighbors only.
- Limit the model depth and computation so adverse-weather filtering can run on onboard systems.
- Precompute or compute KNN neighborhoods, then apply learned local feature aggregation to classify outliers.
- Trade a small amount of accuracy for substantial reductions in memory, operations, and execution time compared with heavier point-cloud networks.
- Treat noisy precipitation points as a binary outlier class that can be removed before downstream perception.
- Preserve enough 3D geometry to avoid some range-image projection failures.

## Inputs and Outputs

- Input: raw 3D LiDAR point clouds and KNN neighborhood information.
- Training input: labeled outlier datasets such as WADS, SnowyKITTI, and SemanticSpray.
- Intermediate output: nearest-neighbor features processed by the 3D-OutDet modules.
- Output: point-wise outlier predictions for snow or rain spray removal.
- Output: denoised point clouds after removing predicted outliers.
- Non-output: no object boxes, no weather classification beyond the trained outlier classes, no radar fusion, and no restored hidden surfaces.

## Architecture or Pipeline

- Remove duplicated points where needed, especially in WADS preprocessing, because duplicates distort nearest-neighbor neighborhoods.
- Generate or load KNN distances and neighbor indices for training and evaluation.
- Train a binary outlier detector for the selected dataset/weather target.
- Apply the learned neighborhood convolution on local point neighborhoods.
- Produce point-wise outlier labels and filter predicted noise points.
- Evaluate both direct denoising quality and downstream semantic segmentation effects.

## Training and Evaluation

- The paper reports experiments on WADS, SnowyKITTI, and SemanticSpray.
- The official repository includes separate WADS, KITTI desnowing, and spray-filtering training/evaluation scripts.
- The project reports competitive WADS performance with much lower memory and computation than larger baselines.
- The paper abstract reports a 0.16 percent mIoU sacrifice while reducing memory by 99.92 percent, operations by 96.87 percent, and execution time by 82.84 percent per point cloud on WADS.
- The repository reports a WADS benchmark update with RandLA-Net and 3D-OutDet, including 3D-OutDet precision 96.78, recall 92.76, F1 94.73, and mIoU 90.00.
- The authors note that a C++/TensorRT implementation is underway, which indicates deployment interest but not production readiness.

## Strengths

- More memory-conscious than many point-cloud denoising networks.
- Direct 3D processing avoids some failure modes of spherical range projections.
- Covers both de-snowing and rain-spray-removal examples.
- Public code includes dataset preprocessing, training, evaluation, and sample configs.
- Explicit duplicate-removal warning for WADS is practically useful for fair benchmarking.
- Can improve downstream semantic segmentation by removing weather outliers before the main model.

## Failure Modes

- KNN preprocessing is a dependency and can be distorted by duplicates, uneven density, ego-motion, or different scan patterns.
- It is trained as an outlier detector, so rare but valid sparse objects can be removed.
- Fog attenuation, de-icing mist, steam, dust, and multipath ghosts may not match the snow/spray training labels.
- Binary filtering does not distinguish weather noise from dynamic-object points unless the training data teaches that boundary.
- Removing points before tracking can make a downstream system overconfident if filtered points are not auditable.
- The public repository has research scripts and no release package, so integration maturity is limited.
- Production claims should be treated cautiously until embedded implementation, monitoring, and fail-safe behavior are demonstrated.

## Airside AV Fit

- Relevant for airport road spray, wet apron splash, and snowfall because those resemble the public examples more than pure fog.
- Needs careful false-positive evaluation on low-profile airside obstacles: chocks, cones, tow bars, dollies, cables, and personnel.
- SemanticSpray makes it more interesting for airside than snow-only methods, but de-icing mist and jet blast snow are still separate artifacts.
- Use radar and camera corroboration as described in [Radar-LiDAR Fusion in Adverse Weather](../overview/radar-lidar-fusion-adverse-weather.md).
- Follow [Production Perception Systems](../overview/production-perception-systems.md) for audit logging, health checks, and fallback behavior.
- Compare with [TripleMixer](triplemixer.md) for broader snow/fog/rain coverage and with [AdverseNet](adversenet.md) for unified rain/snow/fog denoising.

## Implementation Notes

- Make duplicate-point removal deterministic and record it separately from learned denoising.
- Cache KNN artifacts only when the exact point cloud, projection, and preprocessing version are fixed.
- Preserve point indices and removed-point masks for replay and incident analysis.
- Profile KNN search, model inference, and post-filtering separately on target hardware.
- Maintain separate configs for snow, spray, and any future mist/dust use case.
- Add regression tests for sparse valid objects and moving actors so the outlier detector does not become a small-object remover.
- Treat the C++/TensorRT path as future integration work unless it is available and verified in the target stack.

## Sources

- Official project page: https://sporsho.github.io/3DOutDet.html
- Official repository: https://github.com/sporsho/3D_OutDet
- IEEE Xplore record: https://ieeexplore.ieee.org/document/10588582/
- TechRxiv DOI record: https://doi.org/10.36227/techrxiv.24297166.v1
