# Perception Method Library Overview

This directory is the method-level perception library. Each page should represent one technique, method, benchmark, or dataset-backed evaluation primitive. Broad synthesis pages in `30-autonomy-stack/perception/overview/` remain useful for system design, but this library is where individual methods get enough space for architecture, data, benchmarks, failure modes, deployment fit, and airside relevance.

## Priority Ratings

Priority ratings are editorial reading and deployment triage signals. `Learning` answers what to read early for general autonomy understanding. `Deployment` answers what to evaluate early for AV deployment in the tagged context; it is not a certification or product-readiness claim.

<!-- priority-table:start -->
| Method | Rating | Stage | Maturity | Reason |
|---|---|---|---|---|
| [Availability-Aware Sensor Fusion](availability-aware-sensor-fusion.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `prototype` | Directly targets sensor degradation and availability-aware fusion. |
| [LiDAR-MOS](lidar-mos.md) | Learning: ★★★★☆<br>Deployment: ★★★★★ | `deployment-pattern` | `prototype` | Moving-object segmentation is central to map hygiene and dynamic-scene handling. |
| [4DSegStreamer](4dsegstreamer.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | 4DSegStreamer is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [AutoOcc](autoocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | AutoOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [BEVDepth](bevdepth.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Important depth-aware BEV bridge for camera-only 3D perception. |
| [BEVDet](bevdet.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Baseline camera BEV detector that organizes many later BEV methods. |
| [BEVStereo](bevstereo.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | BEVStereo is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Cam4DOcc](cam4docc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Cam4DOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Conformal Boxes](conformal-boxes.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | Practical uncertainty wrapper for detection risk and release gates. |
| [Cross-Domain LiDAR Scene Flow](cross-domain-lidar-scene-flow.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Cross-Domain LiDAR Scene Flow is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Dynamic Occupancy Freespace](dynamic-occupancy-freespace.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Dynamic Occupancy Freespace is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [FlashOcc](flashocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | FlashOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [GaussianOcc](gaussianocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | GaussianOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [GraphBEV](graphbev.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | GraphBEV is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [InsMOS](insmos.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | InsMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Instantaneous Motion Perception](instantaneous-motion-perception.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Instantaneous Motion Perception is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [LiDAR-Camera Occupancy Fusion](lidar-camera-occupancy-fusion.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | LiDAR-Camera Occupancy Fusion is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [M2-Occ](m2-occ.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | M2-Occ is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [MambaMOS](mambamos.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | MambaMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Mask4D](mask4d.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Mask4D is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [MotionSeg3D](motionseg3d.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | MotionSeg3D is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Neural Scene Flow Priors](neural-scene-flow-priors.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Neural Scene Flow Priors is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Open-Vocabulary Panoptic Occupancy](open-vocabulary-panoptic-occupancy.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Open-Vocabulary Panoptic Occupancy is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [OpenAD](openad.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Open-world benchmark for corner cases and unseen categories. |
| [RadarPillars](radarpillars.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `classic-baseline` | `prototype` | Core radar-native detection baseline for weather-robust perception. |
| [RenderOcc](renderocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | RenderOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [SegNet4D](segnet4d.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | SegNet4D is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [SelfOcc](selfocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | SelfOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [SOLOFusion](solo-fusion.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | SOLOFusion is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [SparseOcc](sparseocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | SparseOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Spatiotemporal Memory Occupancy Flow](spatiotemporal-memory-occupancy-flow.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Spatiotemporal Memory Occupancy Flow is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Streaming Gaussian Occupancy](streaming-gaussian-occupancy.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Streaming Gaussian Occupancy is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [StreamingFlow](streamingflow.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | StreamingFlow is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [StreamMOS](streammos.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | StreamMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [SurroundOcc](surroundocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Foundational camera occupancy reference for planning-facing perception. |
| [TPVFormer](tpvformer.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | TPVFormer is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [TrackOcc](trackocc.md) | Learning: ★★★★☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | TrackOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [3D-KNN Blind-Spot Desnowing](3d-knn-blind-spot-desnowing.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | 3D-KNN Blind-Spot Desnowing is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [4D Radar Road Boundaries and Freespace](4d-radar-road-boundaries-freespace.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | 4D Radar Road Boundaries and Freespace is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [4D Radar-Camera Occupancy](4d-radar-camera-occupancy.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | 4D Radar-Camera Occupancy is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [4DMOS](4dmos.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Extends LiDAR motion segmentation with temporal 4D reasoning. |
| [Adverse-Weather Radar-LiDAR 3D Detection](adverse-weather-radar-lidar-3d-detection.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | Adverse-Weather Radar-LiDAR 3D Detection is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [AdverseNet](adversenet.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | AdverseNet is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [AevaScenes](aevascenes.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | AevaScenes is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [AIDE](aide.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | AIDE is rated for operational perception validation, calibration, or safety-screening workflows. |
| [Classical LiDAR Outlier Removal](classical-lidar-outlier-removal.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | Classical LiDAR Outlier Removal is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [CVFusion](cvfusion.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Important radar-camera fusion method for degraded visual conditions. |
| [DenoiseCP-Net](denoisecp-net.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | DenoiseCP-Net is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [Ev-3DOD](ev-3dod.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | Ev-3DOD is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [EvOcc](evocc.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | EvOcc is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [Fail2Drive](fail2drive.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | Fail2Drive is rated for operational perception validation, calibration, or safety-screening workflows. |
| [K-Radar](k-radar.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `modern-core` | `fielded-pattern` | Key 4D radar dataset and benchmark for all-weather perception evaluation. |
| [LASP](lasp.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | LASP is rated for operational perception validation, calibration, or safety-screening workflows. |
| [LiDAR Weather Artifact Removal](lidar-weather-artifact-removal.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | LiDAR Weather Artifact Removal is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [LIORNet](liornet.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | LIORNet is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [LiSnowNet](lisnownet.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | LiSnowNet is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [M-detector LiDAR Point-Stream MED](m-detector-lidar-point-stream-med.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | M-detector LiDAR Point-Stream MED is rated for operational perception validation, calibration, or safety-screening workflows. |
| [MoME](mome.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Useful resilient fusion pattern for adverse sensor failure cases. |
| [MSC-Bench](msc-bench.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | MSC-Bench is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [MultiCorrupt](multicorrupt.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | MultiCorrupt is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [Occluded nuScenes](occluded-nuscenes.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | Occluded nuScenes is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [POD FMCW LiDAR Predictive Detection](pod-fmcw-lidar-predictive-detection.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | POD FMCW LiDAR Predictive Detection is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [ProOOD](proood.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | ProOOD is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [RaCFormer](racformer.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | RaCFormer is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [RC-AutoCalib](rc-autocalib.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | RC-AutoCalib is rated for operational perception validation, calibration, or safety-screening workflows. |
| [RobuRCDet](robucdet.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | RobuRCDet is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [S2R-Bench](s2r-bench.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `reference` | `fielded-pattern` | S2R-Bench is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [SLiDE](slide-lidar-desnowing.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | SLiDE is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [Sparse4D](sparse4d.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `modern-core` | `prototype` | Practical sparse-query direction for camera 3D detection and tracking. |
| [TripleMixer](triplemixer.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `pilot-proven` | TripleMixer is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [V2X-Radar](v2x-radar.md) | Learning: ★★★☆☆<br>Deployment: ★★★★☆ | `deployment-pattern` | `prototype` | V2X-Radar is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [3D-AVS](3d-avs.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | 3D-AVS is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [3D-OutDet](3d-outdet.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | 3D-OutDet is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [Clipomaly](clipomaly.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | Useful anomaly-detection reference for long-tail discovery workflows. |
| [CoHFF](cohff.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `prototype` | CoHFF is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [CoInfra](coinfra.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `prototype` | CoInfra is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [CoopTrack](cooptrack.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `prototype` | CoopTrack is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [CoSDH](cosdh.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | CoSDH is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [DetAny3D](detany3d.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | DetAny3D is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [DistillNeRF](distillnerf.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | DistillNeRF is rated for neural scene representation learning and simulation-oriented perception research. |
| [DrivingGaussian](drivinggaussian.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | DrivingGaussian is rated for neural scene representation learning and simulation-oriented perception research. |
| [ForeSight](foresight.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | ForeSight is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [GaussianFormer](gaussianformer.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | GaussianFormer is rated for neural scene representation learning and simulation-oriented perception research. |
| [HoloVIC](holovic.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `prototype` | HoloVIC is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [HUGS Urban Gaussians](hugs-urban-gaussians.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | HUGS Urban Gaussians is rated for neural scene representation learning and simulation-oriented perception research. |
| [Mosaic3D](mosaic3d.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | Mosaic3D is rated for open-vocabulary 3D segmentation, dataset leverage, and long-tail perception validation. |
| [OP3Det](op3det.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | OP3Det is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [Open3DTrack](open3dtrack-open-vocab-3d-tracking.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | Open3DTrack is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [OpenVox](openvox.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | OpenVox is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [OVAD And OVODA Open-Vocabulary 3D Attributes](ovad-ovoda-open-vocab-3d-attributes.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | OVAD And OVODA Open-Vocabulary 3D Attributes is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [OW-OVD](ow-ovd.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | OW-OVD is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [RCooper](rcooper.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `fielded-pattern` | Cooperative-perception dataset relevant to infrastructure-assisted sensing. |
| [S2M](s2m.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | S2M is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SAM 3](sam3.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | SAM 3 is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SAM4D](sam4d.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | SAM4D is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SAMFusion](samfusion.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | SAMFusion is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SOAC](soac.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | SOAC is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [SplatAD](splatad.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | SplatAD is rated for neural scene representation learning and simulation-oriented perception research. |
| [SplatFlow](splatflow.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `research` | SplatFlow is rated for neural scene representation learning and simulation-oriented perception research. |
| [TacoDepth](tacodepth.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | TacoDepth is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [V2X-ReaLO](v2x-realo.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `frontier` | `prototype` | V2X-ReaLO is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [WildDet3D](wilddet3d.md) | Learning: ★★★☆☆<br>Deployment: ★★★☆☆ | `modern-core` | `prototype` | WildDet3D is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
<!-- priority-table:end -->

## How to Use This Library

| Need | Start here |
|---|---|
| Camera BEV, occupancy, and freespace | [BEVDet](bevdet.md), [BEVDepth](bevdepth.md), [BEVStereo](bevstereo.md), [SOLOFusion](solo-fusion.md), [Sparse4D](sparse4d.md), [TPVFormer](tpvformer.md), [SurroundOcc](surroundocc.md), [SparseOcc](sparseocc.md), [FlashOcc](flashocc.md), [SelfOcc](selfocc.md), [RenderOcc](renderocc.md), [LiDAR-Camera Occupancy Fusion](lidar-camera-occupancy-fusion.md), [Dynamic Occupancy and Freespace](dynamic-occupancy-freespace.md), [Spatiotemporal Memory Occupancy Flow](spatiotemporal-memory-occupancy-flow.md) |
| Gaussian, 3DGS, 4DGS, and 4D occupancy | [SplatAD](splatad.md), [GaussianFormer](gaussianformer.md), [GaussianOcc](gaussianocc.md), [Streaming Gaussian Occupancy](streaming-gaussian-occupancy.md), [Cam4DOcc](cam4docc.md), [StreamingFlow](streamingflow.md), [DrivingGaussian](drivinggaussian.md), [HUGS](hugs-urban-gaussians.md), [SplatFlow](splatflow.md), [DistillNeRF](distillnerf.md) |
| LiDAR motion, scene flow, and temporal segmentation | [LiDAR-MOS](lidar-mos.md), [4DMOS](4dmos.md), [InsMOS](insmos.md), [StreamMOS](streammos.md), [4DSegStreamer](4dsegstreamer.md), [SegNet4D](segnet4d.md), [Mask4D](mask4d.md), [Instantaneous Motion Perception](instantaneous-motion-perception.md), [MotionSeg3D](motionseg3d.md), [MambaMOS](mambamos.md), [Neural Scene Flow Priors](neural-scene-flow-priors.md), [Cross-Domain LiDAR Scene Flow](cross-domain-lidar-scene-flow.md), [TrackOcc](trackocc.md) |
| LiDAR denoising, removal, and adverse weather | [LIORNet](liornet.md), [LiSnowNet](lisnownet.md), [SLiDE](slide-lidar-desnowing.md), [TripleMixer](triplemixer.md), [3D-KNN Blind-Spot Desnowing](3d-knn-blind-spot-desnowing.md), [3D-OutDet](3d-outdet.md), [AdverseNet](adversenet.md), [DenoiseCP-Net](denoisecp-net.md), [Classical LiDAR Outlier Removal](classical-lidar-outlier-removal.md), [LiDAR Weather Artifact Removal](lidar-weather-artifact-removal.md) |
| Radar, 4D radar, event, and FMCW perception | [RadarPillars](radarpillars.md), [K-Radar](k-radar.md), [V2X-Radar](v2x-radar.md), [TacoDepth](tacodepth.md), [RaCFormer](racformer.md), [CVFusion](cvfusion.md), [4D Radar-Camera Occupancy](4d-radar-camera-occupancy.md), [Adverse-Weather Radar-LiDAR 3D Detection](adverse-weather-radar-lidar-3d-detection.md), [RobuRCDet](robucdet.md), [SAMFusion](samfusion.md), [POD FMCW LiDAR Predictive Detection](pod-fmcw-lidar-predictive-detection.md), [Ev-3DOD](ev-3dod.md), [AevaScenes](aevascenes.md) |
| Open-world and open-vocabulary perception | [OpenAD](openad.md), [OP3Det](op3det.md), [WildDet3D](wilddet3d.md), [DetAny3D](detany3d.md), [OW-OVD](ow-ovd.md), [Clipomaly](clipomaly.md), [S2M](s2m.md), [SAM 3](sam3.md), [3D-AVS](3d-avs.md), [Mosaic3D](mosaic3d.md), [OpenVox](openvox.md), [OVAD/OVODA Open-Vocabulary 3D Attributes](ovad-ovoda-open-vocab-3d-attributes.md), [Open-Vocabulary Panoptic Occupancy](open-vocabulary-panoptic-occupancy.md) |
| Robust fusion and perception validation | [MoME](mome.md), [GraphBEV](graphbev.md), [SOAC](soac.md), [RC-AutoCalib](rc-autocalib.md), [ASF](availability-aware-sensor-fusion.md), [MSC-Bench](msc-bench.md), [MultiCorrupt](multicorrupt.md), [S2R-Bench](s2r-bench.md), [Occluded nuScenes](occluded-nuscenes.md), [Conformal Boxes](conformal-boxes.md) |
| Cooperative, online, and data-engine methods | [RCooper](rcooper.md), [HoloVIC](holovic.md), [CoInfra](coinfra.md), [V2X-ReaLO](v2x-realo.md), [CoHFF](cohff.md), [CoSDH](cosdh.md), [CoopTrack](cooptrack.md), [LASP](lasp.md), [Fail2Drive](fail2drive.md), [AIDE](aide.md) |

## File Boundary Rules

| Rule | Practical meaning |
|---|---|
| One file, one method | A page should not bundle multiple unrelated methods just because they share a modality. If two papers solve the same exact technique lineage, the page can compare versions, but the title must still name the primary method. |
| Overview pages link out | Existing files such as [BEV Encoding Architectures](../overview/bev-encoding.md), [Streaming Temporal Perception](../overview/streaming-temporal-perception.md), and [Infrastructure Cooperative Perception](../overview/infrastructure-cooperative-perception.md) should summarize families and point here for method-level details. |
| Benchmarks count as methods when they shape evaluation | Pages such as MSC-Bench, S2R-Bench, LASP, OpenAD, and Fail2Drive deserve first-class treatment because they define what a deployment team measures. |
| Airside fit is mandatory | Every page should explicitly say what transfers to airport apron autonomy, what does not, and what evidence would be required before using it in a safety case. |
| Sources stay close to claims | Each method page must include primary paper, project, dataset, or repository links so future refreshes can verify claims quickly. |

## Standard Page Shape

Each method page should include:

1. What the method is.
2. Core technical idea.
3. Inputs, outputs, and model/data assumptions.
4. Architecture or pipeline.
5. Training/evaluation setup and benchmark signals.
6. Strengths.
7. Failure modes and deployment risks.
8. Airside autonomous-vehicle fit.
9. Implementation notes.
10. Sources.

## Relationship to the Perception Stack

| Existing synthesis page | Method-library role |
|---|---|
| [BEV Encoding Architectures](../overview/bev-encoding.md) | Explains the BEV design space, then links to BEVDet/BEVDepth/BEVStereo/SOLOFusion and camera occupancy methods. |
| [Camera-Only Degraded Perception](../overview/camera-fallback-perception.md) | Uses camera BEV, occupancy, depth, and open-vocabulary method pages to define fallback modes. |
| [LiDAR Semantic Segmentation](../overview/lidar-semantic-segmentation.md) | Summarizes segmentation architecture choices, then links to LiDAR-MOS, 4DMOS, SegNet4D, Mask4D, MotionSeg3D, MambaMOS, neural scene-flow priors, and HeLiMOS-style evaluation. |
| [LiDAR Artifact Removal Techniques](../overview/lidar-artifact-removal-techniques.md) | Synthesizes learned denoisers, classical filters, weather artifact handling, ghost/multipath failures, validation, datasets, and map-cleaning links. |
| [Streaming Temporal Perception](../overview/streaming-temporal-perception.md) | Connects StreamMOS, 4DSegStreamer, MotionSeg3D, MambaMOS, LASP, sparse-query detection, scene flow, and temporal occupancy into a runtime stack. |
| [Open-Vocabulary and Zero-Shot Detection](../overview/open-vocab-detection.md) | Stays as the broad open-vocabulary primer; OpenAD, OP3Det, WildDet3D, DetAny3D, OW-OVD, Clipomaly, S2M, and SAM 3 get individual pages here. |
| [Infrastructure Cooperative Perception](../overview/infrastructure-cooperative-perception.md) | Synthesizes V2X deployment tradeoffs; RCooper, HoloVIC, CoInfra, V2X-ReaLO, CoHFF, CoSDH, and CoopTrack live here as atomic references. |
| [Production Perception Systems](../overview/production-perception-systems.md) | Uses this library as the evidence base for validation matrices, degradation policies, and sensor-suite decisions. |

## Expansion Backlog

The first waves focused on methods already identified as P0/P1 in the [Perception Coverage Audit](../overview/coverage-audit-2026.md). The 2026-05-09 loops promoted SplatAD, GaussianFormer, GaussianOcc, streaming Gaussian occupancy, Cam4DOcc, StreamingFlow, Sparse4D, TacoDepth, RaCFormer, LIORNet, learned LiDAR desnowing/denoising, broad artifact removal, classical outlier filtering, MotionSeg3D, MambaMOS, neural scene-flow priors, CVFusion, 4D radar-camera occupancy, POD/FMCW LiDAR, DrivingGaussian, HUGS, SplatFlow, DistillNeRF, TrackOcc, cross-domain scene flow, LiDAR-camera occupancy fusion, dynamic occupancy/free-space, radar-LiDAR adverse-weather detection, RobuRCDet, SAMFusion, spatiotemporal memory occupancy flow, OVAD/OVODA, and open-vocabulary panoptic occupancy into atomic files. Future waves should split remaining grouped rows into atomic pages, especially:

- VEON, EvOcc, ProOOD, SA-Occ, DR-REMOVER, and ExelMap.
- Drive-OccWorld and DFIT-OccWorld where they need separate world-model or planning-facing treatment beyond the dynamic occupancy page.
- SparseBEV, DETR4D, DySS, and ForeSight.
- DepthOcc, LinkOcc, missing-view occupancy, Gaussian-rendered occupancy, SAM4D, and related 2026 radar/occupancy follow-ons.
- SparseCoop, CoDS, JigsawComm, QuantV2X, TruckV2X, and collaborative Gaussian occupancy.
- DriveBench, Airport-FOD3S data-engine pages, DSERT-RoLL, CMHT, embodied robotics 3D perception, indoor open-vocabulary 3D instance segmentation, and airside-specific dust/de-icing-mist datasets.

## Sources

- Perception coverage audit and backlog: [coverage-audit-2026.md](../overview/coverage-audit-2026.md)
- Existing perception synthesis index: [Research Index - Perception](../../../INDEX.md#perception)
