# DenoiseCP-Net

## What It Is

- DenoiseCP-Net is a 2025 LiDAR-based collective perception method for adverse weather.
- It jointly performs voxel-level denoising and 3D object detection for cooperative vehicles.
- The key motivation is that adverse-weather noise hurts perception and also wastes communication bandwidth when noisy LiDAR features are shared.
- It addresses rain, snow, and fog in a simulated OPV2V extension.
- It is not a standalone single-vehicle denoiser like [LiSnowNet](lisnownet.md), [TripleMixer](triplemixer.md), or [AdverseNet](adversenet.md); it is tied to cooperative perception.

## Core Technical Idea

- Denoise before communication so cooperative vehicles do not transmit non-informative weather noise.
- Integrate voxel-level noise filtering and object detection into a unified sparse convolution backbone.
- Avoid a two-stage pipeline where denoising and detection run separate backbones over the same LiDAR data.
- Remove weather-corrupted voxels while preserving detection accuracy.
- Reduce inference latency, compute, and collective-perception bandwidth together.
- Extend OPV2V with realistic rain, snow, and fog simulations to study collective perception under adverse weather.

## Inputs and Outputs

- Input: voxelized LiDAR point clouds from ego and cooperative vehicles.
- Input: cooperative perception data shared among vehicles or agents.
- Training input: OPV2V scenes augmented with simulated rain, snow, and fog.
- Intermediate output: shared sparse-convolution features used for both denoising and detection.
- Output: voxel-level noise filtering decisions.
- Output: 3D object detections for collective perception.
- Non-output: no camera/radar fusion, no real airport communication protocol, and no direct model for road spray, de-icing mist, dust, steam, or multipath.

## Architecture or Pipeline

- Simulate adverse weather on OPV2V LiDAR scenes for rain, snow, and fog.
- Voxelize noisy LiDAR observations from cooperative agents.
- Process the voxel grid with a sparse convolution backbone.
- Attach denoising and object-detection heads to the shared computation path.
- Remove or suppress weather-noise voxels before communication or downstream fusion.
- Perform collective perception with reduced transmitted noise and maintained detection accuracy.
- Evaluate detection, denoising accuracy, bandwidth, and latency as coupled system metrics.

## Training and Evaluation

- The paper claims the first study of LiDAR-based collective perception under diverse adverse weather conditions.
- It evaluates on an OPV2V extension with simulated rain, snow, and fog.
- The arXiv abstract reports near-perfect denoising accuracy in adverse weather.
- It reports bandwidth reduction up to 23.6 percent while maintaining the same detection accuracy.
- It also reports reduced inference latency for cooperative vehicles by eliminating redundant two-stage computation.
- Evidence is simulation-centered and should not be read as proof of real-world production readiness.

## Strengths

- Addresses a system-level issue that single-vehicle denoisers miss: noisy weather points consume V2X bandwidth and latency budget.
- Joint denoising and detection avoids redundant feature extraction.
- Sparse convolution is a practical representation for voxel-level cooperative perception.
- Evaluation couples denoising with object detection, bandwidth, and latency.
- Rain, snow, and fog are all in scope.
- The approach fits connected autonomy better than a filter that only cleans the ego cloud after communication.

## Failure Modes

- OPV2V is simulated; the reported weather extension may not capture airport de-icing mist, road spray, steam, dust, wet concrete reflections, or multipath ghosts.
- Cooperative perception depends on synchronization, calibration, pose accuracy, packet loss, and trust between agents.
- Removing voxels before communication can delete rare safety-critical evidence if the denoising head is wrong.
- Fog and heavy precipitation can cause missing returns, not just extra noisy voxels.
- Dynamic objects seen by one agent and not another can be confused with noise without robust temporal/fusion logic.
- The arXiv paper does not establish a production communication standard or safety case.
- Real deployment needs cybersecurity, V2X scheduling, latency bounds, and fallback behavior beyond the denoising model.

## Airside AV Fit

- Strong conceptual fit for airports with connected AVs, smart infrastructure, or cooperative ramp vehicles.
- Bandwidth-aware denoising matters when multiple vehicles share LiDAR around gates, service roads, and aprons.
- Needs real airside V2X data, not only OPV2V simulation, before drawing operational conclusions.
- Must include non-road artifacts: aircraft, GSE, jet bridges, cones, chocks, personnel, reflective surfaces, de-icing clouds, and service-vehicle spray.
- Pair with [Radar-LiDAR Fusion in Adverse Weather](../overview/radar-lidar-fusion-adverse-weather.md) because radar may preserve object evidence when LiDAR denoising is uncertain.
- Use [Production Perception Systems](../overview/production-perception-systems.md) for deployment constraints around monitoring, fallbacks, and auditability.

## Implementation Notes

- Preserve both pre-denoising and post-denoising voxel sets in logs so communication savings can be audited against missed detections.
- Track denoising mistakes by object class, range, weather type, and agent viewpoint.
- Validate the method under packet loss, timestamp jitter, pose error, and mismatched LiDAR models.
- Do not tune solely for bandwidth reduction; enforce minimum detection recall for small and low-profile hazards.
- Add airside weather labels for snow, rain, fog, road spray, de-icing mist/steam, dust, ghost/multipath, and dynamic-object disagreement.
- Compare against running [AdverseNet](adversenet.md) or [TripleMixer](triplemixer.md) before communication as separate baselines.
- Treat simulation gains as a hypothesis until verified with real cooperative logs.

## Sources

- arXiv abstract: https://arxiv.org/abs/2507.06976
- arXiv DOI: https://doi.org/10.48550/arXiv.2507.06976
