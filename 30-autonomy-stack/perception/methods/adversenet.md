# AdverseNet

## What It Is

- AdverseNet is an IEEE Sensors Journal 2025 LiDAR point-cloud denoising network for rainy, snowy, and foggy weather.
- It is a unified learned denoiser rather than a snow-only filter.
- The official repository describes it as using Cylindrical Tri-Perspective View, CTPV, representation and a two-stage training strategy.
- It targets point-wise removal of weather noise points from LiDAR clouds before downstream perception.
- It is relevant to broader adverse-weather stacks alongside [TripleMixer](triplemixer.md), [3D-OutDet](3d-outdet.md), and [DenoiseCP-Net](denoisecp-net.md).

## Core Technical Idea

- Represent the point cloud with CTPV so the network can process cylindrical and tri-perspective structure.
- Learn generic adverse-weather features first across rain, snow, and fog.
- Fine-tune or specialize in a second stage for weather-specific features.
- Use a unified model rather than separate filters for each weather type.
- Train/evaluate on DENSE and SnowyKITTI to cover controlled rain/fog and snow-corrupted point clouds.
- Output denoising labels that suppress weather artifacts while retaining scene points.

## Inputs and Outputs

- Input: LiDAR point clouds with coordinate and intensity-like features, converted into AdverseNet's CTPV representation.
- Training input: DENSE and SnowyKITTI data after repository-specific format conversion and invalid-point filtering.
- Intermediate output: stage-1 model weights that learn generic weather-noise features.
- Intermediate output: stage-2 model weights specialized by weather-feature learning.
- Output: point-wise denoising segmentation for rain, snow, and fog artifacts.
- Non-output: no object detector, no cooperative perception message, no radar evidence, and no explicit restoration of missing returns.

## Architecture or Pipeline

- Convert dataset formats into the repository's text representation and filter invalid points.
- Construct the CTPV representation from the point cloud.
- Train stage 1 to learn shared features across adverse-weather noise types.
- Train stage 2 with weather-specific objectives or flags to improve specialization.
- Run segmentation-style evaluation to classify and remove weather noise points.
- Feed the denoised cloud to downstream modules only after preserving the removed-point mask for audit.

## Training and Evaluation

- The official repository links the IEEE Sensors Journal paper and includes training scripts for stage 1 and stage 2.
- The paper citation is IEEE Sensors Journal, volume 25, number 5, pages 8950-8961, 2025.
- The repository reports comparative experiments on DENSE and SnowyKITTI.
- The reported mean IoU values are 94.67 percent on DENSE and 99.33 percent on SnowyKITTI.
- The setup depends on PyTorch, mmdetection3d, mmcv, mmdet, mmsegmentation, torch_scatter, spconv, and related packages.
- Results are best interpreted as point-wise denoising benchmark results, not full autonomous-driving safety validation.

## Strengths

- Explicitly covers three major LiDAR weather degradations: rain, snow, and fog.
- Two-stage training separates generic weather-noise structure from weather-specific cues.
- Public code, configs, weights, and scripts make replication more practical than paper-only methods.
- CTPV is designed to preserve more geometric context than a single flat projection.
- DENSE plus SnowyKITTI gives broader weather coverage than snow-only WADS evaluation.
- It can act as a learned preprocessing module before detection, segmentation, mapping, or tracking.

## Failure Modes

- DENSE and SnowyKITTI do not cover every real airport artifact, especially de-icing mist, glycol spray, steam, dust, jet blast snow, and wet apron splash.
- Fog often causes attenuation and missing returns, not just removable foreground points.
- Controlled-weather or synthetic datasets can overstate transfer to real mixed-weather operations.
- The model may remove sparse valid objects if they resemble weather noise in CTPV space.
- Dynamic-object points and multipath ghosts are not the same class as weather particles.
- The dependency stack is heavy and may be difficult to integrate into low-latency embedded perception without simplification.
- It is not production-ready without calibration, runtime monitoring, domain validation, and fallback behavior.

## Airside AV Fit

- Strong candidate for research when rain, snow, and fog must be handled by one LiDAR denoising module.
- Needs additional airside data for de-icing operations, aircraft reflections, service-road spray, night lighting, and wet concrete.
- CTPV may help around complex 3D geometry, but airport-specific thin and low objects require targeted false-positive tests.
- Should be combined with [Radar-LiDAR Fusion in Adverse Weather](../overview/radar-lidar-fusion-adverse-weather.md) rather than trusted as a LiDAR-only decision maker.
- Use [Production Perception Systems](../overview/production-perception-systems.md) as the deployment gate for monitoring, redundancy, and safety fallback.
- Compare with [TripleMixer](triplemixer.md) for benchmark breadth and with [3D-OutDet](3d-outdet.md) for lower-memory filtering.

## Implementation Notes

- Reproduce the repository's data conversion and invalid-point filtering exactly before comparing metrics.
- Track stage-1 and stage-2 weights, weather flags, and lambda values as part of model versioning.
- Preserve raw and denoised clouds plus removed masks for every replay.
- Benchmark the full mmdetection3d/spconv pipeline on target hardware before planning real-time use.
- Add airport-specific evaluation classes for snow, rain, fog, road spray, de-icing mist/steam, dust, multipath ghosts, and dynamic objects.
- Monitor downstream performance separately; high denoising mIoU can still degrade detection of rare low-profile hazards.
- Avoid using DENSE/SnowyKITTI metrics as direct evidence for apron production readiness.

## Sources

- Official repository: https://github.com/Naclzno/AdverseNet
- IEEE Xplore record: https://ieeexplore.ieee.org/document/10832503/
- DOI: https://doi.org/10.1109/JSEN.2024.3505234
