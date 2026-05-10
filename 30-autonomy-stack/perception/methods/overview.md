# Perception Method Library Overview

This directory is the method-level perception library. Each page should represent one technique, method, benchmark, or dataset-backed evaluation primitive. Broad synthesis pages in `30-autonomy-stack/perception/overview/` remain useful for system design, but this library is where individual methods get enough space for architecture, data, benchmarks, failure modes, deployment fit, and airside relevance.

## Priority Ratings

Priority ratings are editorial reading and deployment triage signals. `Learning` answers what to read early for general autonomy understanding. `Deployment` answers what to evaluate early for AV deployment in the tagged context; it is not a certification or product-readiness claim.

<!-- priority-table:start -->
| Method | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |
|---|---|---|---|---|---|---|---|
| [Availability-Aware Sensor Fusion](availability-aware-sensor-fusion.md) | ★★★★☆ | ★★★★★ | `architecture-pattern` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation` | Directly targets sensor degradation and availability-aware fusion. |
| [LiDAR-MOS](lidar-mos.md) | ★★★★☆ | ★★★★★ | `method-family` | `deployment-pattern` | `prototype` | `perception`, `mapping`, `validation` | Moving-object segmentation is central to map hygiene and dynamic-scene handling. |
| [4DSegStreamer](4dsegstreamer.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | 4DSegStreamer is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [AutoOcc](autoocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | AutoOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [BEVDepth](bevdepth.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av` | Important depth-aware BEV bridge for camera-only 3D perception. |
| [BEVDet](bevdet.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av` | Baseline camera BEV detector that organizes many later BEV methods. |
| [BEVStereo](bevstereo.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | BEVStereo is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Cam4DOcc](cam4docc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | Cam4DOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Conformal Boxes](conformal-boxes.md) | ★★★★☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `validation` | Practical uncertainty wrapper for detection risk and release gates. |
| [Cross-Domain LiDAR Scene Flow](cross-domain-lidar-scene-flow.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | Cross-Domain LiDAR Scene Flow is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Dynamic Occupancy Freespace](dynamic-occupancy-freespace.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | Dynamic Occupancy Freespace is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [FlashOcc](flashocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | FlashOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [GaussianOcc](gaussianocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | GaussianOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [GraphBEV](graphbev.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | GraphBEV is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [InsMOS](insmos.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | InsMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Instantaneous Motion Perception](instantaneous-motion-perception.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | Instantaneous Motion Perception is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [LiDAR-Camera Occupancy Fusion](lidar-camera-occupancy-fusion.md) | ★★★★☆ | ★★★★☆ | `architecture-pattern` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | LiDAR-Camera Occupancy Fusion is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [M2-Occ](m2-occ.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | M2-Occ is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [MambaMOS](mambamos.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | MambaMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Mask4D](mask4d.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | Mask4D is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [MotionSeg3D](motionseg3d.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | MotionSeg3D is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Neural Scene Flow Priors](neural-scene-flow-priors.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | Neural Scene Flow Priors is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [Open-Vocabulary Panoptic Occupancy](open-vocabulary-panoptic-occupancy.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | Open-Vocabulary Panoptic Occupancy is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [OpenAD](openad.md) | ★★★★☆ | ★★★★☆ | `benchmark` | `modern-core` | `fielded-pattern` | `perception`, `validation`, `data-engine` | Open-world benchmark for corner cases and unseen categories. |
| [RadarPillars](radarpillars.md) | ★★★★☆ | ★★★★☆ | `method` | `classic-baseline` | `prototype` | `perception`, `adverse-weather` | Core radar-native detection baseline for weather-robust perception. |
| [RenderOcc](renderocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | RenderOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [SegNet4D](segnet4d.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | SegNet4D is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [SelfOcc](selfocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | SelfOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [SOLOFusion](solo-fusion.md) | ★★★★☆ | ★★★★☆ | `architecture-pattern` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | SOLOFusion is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [SparseOcc](sparseocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | SparseOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Spatiotemporal Memory Occupancy Flow](spatiotemporal-memory-occupancy-flow.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | Spatiotemporal Memory Occupancy Flow is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [Streaming Gaussian Occupancy](streaming-gaussian-occupancy.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | Streaming Gaussian Occupancy is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [StreamingFlow](streamingflow.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | StreamingFlow is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [StreamMOS](streammos.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation`, `road-av` | StreamMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows. |
| [SurroundOcc](surroundocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation` | Foundational camera occupancy reference for planning-facing perception. |
| [TPVFormer](tpvformer.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | TPVFormer is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [TrackOcc](trackocc.md) | ★★★★☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation`, `mapping` | TrackOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks. |
| [3D-KNN Blind-Spot Desnowing](3d-knn-blind-spot-desnowing.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback` | 3D-KNN Blind-Spot Desnowing is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [4D Radar Road Boundaries and Freespace](4d-radar-road-boundaries-freespace.md) | ★★★☆☆ | ★★★★☆ | `method-family` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | 4D Radar Road Boundaries and Freespace is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [4D Radar-Camera Occupancy](4d-radar-camera-occupancy.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | 4D Radar-Camera Occupancy is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [4DMOS](4dmos.md) | ★★★☆☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation` | Extends LiDAR motion segmentation with temporal 4D reasoning. |
| [Adverse-Weather Radar-LiDAR 3D Detection](adverse-weather-radar-lidar-3d-detection.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | Adverse-Weather Radar-LiDAR 3D Detection is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [AdverseNet](adversenet.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback` | AdverseNet is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [AevaScenes](aevascenes.md) | ★★★☆☆ | ★★★★☆ | `benchmark` | `reference` | `fielded-pattern` | `perception`, `validation`, `data-engine`, `road-av` | AevaScenes is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [AIDE](aide.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `validation`, `data-engine`, `road-av` | AIDE is rated for operational perception validation, calibration, or safety-screening workflows. |
| [Classical LiDAR Outlier Removal](classical-lidar-outlier-removal.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback`, `mapping` | Classical LiDAR Outlier Removal is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [CVFusion](cvfusion.md) | ★★★☆☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `adverse-weather` | Important radar-camera fusion method for degraded visual conditions. |
| [DenoiseCP-Net](denoisecp-net.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback` | DenoiseCP-Net is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [Ev-3DOD](ev-3dod.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | Ev-3DOD is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [EvOcc](evocc.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | EvOcc is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [Fail2Drive](fail2drive.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `validation`, `data-engine`, `road-av` | Fail2Drive is rated for operational perception validation, calibration, or safety-screening workflows. |
| [K-Radar](k-radar.md) | ★★★☆☆ | ★★★★☆ | `benchmark` | `modern-core` | `fielded-pattern` | `perception`, `adverse-weather`, `validation` | Key 4D radar dataset and benchmark for all-weather perception evaluation. |
| [LASP](lasp.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `validation`, `data-engine`, `road-av` | LASP is rated for operational perception validation, calibration, or safety-screening workflows. |
| [LiDAR Weather Artifact Removal](lidar-weather-artifact-removal.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback`, `mapping` | LiDAR Weather Artifact Removal is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [LIORNet](liornet.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback` | LIORNet is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [LiSnowNet](lisnownet.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback` | LiSnowNet is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [M-detector LiDAR Point-Stream MED](m-detector-lidar-point-stream-med.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `validation`, `data-engine`, `road-av` | M-detector LiDAR Point-Stream MED is rated for operational perception validation, calibration, or safety-screening workflows. |
| [MoME](mome.md) | ★★★☆☆ | ★★★★☆ | `method` | `modern-core` | `prototype` | `perception`, `fallback`, `validation` | Useful resilient fusion pattern for adverse sensor failure cases. |
| [MSC-Bench](msc-bench.md) | ★★★☆☆ | ★★★★☆ | `benchmark` | `reference` | `fielded-pattern` | `perception`, `validation`, `data-engine`, `road-av` | MSC-Bench is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [MultiCorrupt](multicorrupt.md) | ★★★☆☆ | ★★★★☆ | `benchmark` | `reference` | `fielded-pattern` | `perception`, `validation`, `data-engine`, `road-av`, `adverse-weather` | MultiCorrupt is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [Occluded nuScenes](occluded-nuscenes.md) | ★★★☆☆ | ★★★★☆ | `benchmark` | `reference` | `fielded-pattern` | `perception`, `validation`, `data-engine`, `road-av` | Occluded nuScenes is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [POD FMCW LiDAR Predictive Detection](pod-fmcw-lidar-predictive-detection.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | POD FMCW LiDAR Predictive Detection is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [ProOOD](proood.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback` | ProOOD is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [RaCFormer](racformer.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | RaCFormer is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [RC-AutoCalib](rc-autocalib.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `validation`, `data-engine`, `road-av` | RC-AutoCalib is rated for operational perception validation, calibration, or safety-screening workflows. |
| [RobuRCDet](robucdet.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | RobuRCDet is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [S2R-Bench](s2r-bench.md) | ★★★☆☆ | ★★★★☆ | `benchmark` | `reference` | `fielded-pattern` | `perception`, `validation`, `data-engine`, `road-av` | S2R-Bench is rated as a benchmark or dataset reference for perception robustness and validation coverage. |
| [SLiDE](slide-lidar-desnowing.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback`, `mapping` | SLiDE is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [Sparse4D](sparse4d.md) | ★★★☆☆ | ★★★★☆ | `method-family` | `modern-core` | `prototype` | `perception`, `road-av` | Practical sparse-query direction for camera 3D detection and tracking. |
| [TripleMixer](triplemixer.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `pilot-proven` | `perception`, `adverse-weather`, `validation`, `fallback` | TripleMixer is rated for cleaning, stress testing, or failure detection in degraded perception conditions. |
| [V2X-Radar](v2x-radar.md) | ★★★☆☆ | ★★★★☆ | `method` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation`, `adverse-weather`, `road-av` | V2X-Radar is rated for alternative-sensor perception and adverse-weather fallback evaluation. |
| [3D-AVS](3d-avs.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | 3D-AVS is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [3D-OutDet](3d-outdet.md) | ★★★☆☆ | ★★★☆☆ | `method` | `modern-core` | `prototype` | `perception`, `validation`, `road-av` | 3D-OutDet is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [Clipomaly](clipomaly.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine` | Useful anomaly-detection reference for long-tail discovery workflows. |
| [CoHFF](cohff.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `prototype` | `perception`, `road-av`, `validation`, `data-engine` | CoHFF is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [CoInfra](coinfra.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `prototype` | `perception`, `road-av`, `validation`, `data-engine` | CoInfra is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [CoopTrack](cooptrack.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `prototype` | `perception`, `road-av`, `validation`, `data-engine` | CoopTrack is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [CoSDH](cosdh.md) | ★★★☆☆ | ★★★☆☆ | `method` | `modern-core` | `prototype` | `perception`, `validation`, `road-av` | CoSDH is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [DetAny3D](detany3d.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | DetAny3D is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [DistillNeRF](distillnerf.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `simulation`, `validation`, `road-av` | DistillNeRF is rated for neural scene representation learning and simulation-oriented perception research. |
| [DrivingGaussian](drivinggaussian.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `simulation`, `validation`, `road-av` | DrivingGaussian is rated for neural scene representation learning and simulation-oriented perception research. |
| [ForeSight](foresight.md) | ★★★☆☆ | ★★★☆☆ | `method` | `modern-core` | `prototype` | `perception`, `validation`, `road-av` | ForeSight is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [GaussianFormer](gaussianformer.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `simulation`, `validation`, `road-av` | GaussianFormer is rated for neural scene representation learning and simulation-oriented perception research. |
| [HoloVIC](holovic.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `prototype` | `perception`, `road-av`, `validation`, `data-engine` | HoloVIC is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [HUGS Urban Gaussians](hugs-urban-gaussians.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `simulation`, `validation`, `road-av` | HUGS Urban Gaussians is rated for neural scene representation learning and simulation-oriented perception research. |
| [Mosaic3D](mosaic3d.md) | ★★★☆☆ | ★★★☆☆ | `method-family` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av`, `mapping` | Mosaic3D is rated for open-vocabulary 3D segmentation, dataset leverage, and long-tail perception validation. |
| [OP3Det](op3det.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | OP3Det is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [Open3DTrack](open3dtrack-open-vocab-3d-tracking.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | Open3DTrack is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [OpenVox](openvox.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | OpenVox is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [OVAD And OVODA Open-Vocabulary 3D Attributes](ovad-ovoda-open-vocab-3d-attributes.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | OVAD And OVODA Open-Vocabulary 3D Attributes is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [OW-OVD](ow-ovd.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | OW-OVD is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [RCooper](rcooper.md) | ★★★☆☆ | ★★★☆☆ | `benchmark` | `frontier` | `fielded-pattern` | `perception`, `validation`, `road-av` | Cooperative-perception dataset relevant to infrastructure-assisted sensing. |
| [S2M](s2m.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | S2M is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SAM 3](sam3.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | SAM 3 is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SAM4D](sam4d.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | SAM4D is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SAMFusion](samfusion.md) | ★★★☆☆ | ★★★☆☆ | `architecture-pattern` | `frontier` | `research` | `perception`, `validation`, `data-engine`, `road-av` | SAMFusion is rated for open-world perception, annotation leverage, and long-tail validation workflows. |
| [SOAC](soac.md) | ★★★☆☆ | ★★★☆☆ | `method` | `modern-core` | `prototype` | `perception`, `validation`, `road-av` | SOAC is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [SplatAD](splatad.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `simulation`, `validation`, `road-av` | SplatAD is rated for neural scene representation learning and simulation-oriented perception research. |
| [SplatFlow](splatflow.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `research` | `perception`, `simulation`, `validation`, `road-av` | SplatFlow is rated for neural scene representation learning and simulation-oriented perception research. |
| [TacoDepth](tacodepth.md) | ★★★☆☆ | ★★★☆☆ | `method` | `modern-core` | `prototype` | `perception`, `validation`, `road-av` | TacoDepth is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
| [V2X-ReaLO](v2x-realo.md) | ★★★☆☆ | ★★★☆☆ | `method` | `frontier` | `prototype` | `perception`, `road-av`, `validation`, `data-engine` | V2X-ReaLO is rated for cooperative perception and infrastructure-assisted sensing evaluation. |
| [WildDet3D](wilddet3d.md) | ★★★☆☆ | ★★★☆☆ | `method` | `modern-core` | `prototype` | `perception`, `validation`, `road-av` | WildDet3D is rated as a supporting perception method for autonomy-stack triage and follow-up reading. |
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
