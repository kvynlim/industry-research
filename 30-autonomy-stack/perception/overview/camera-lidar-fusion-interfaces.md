# Camera-LiDAR Fusion Interfaces

## What It Covers

- Camera-LiDAR fusion is not one architecture; it is a set of interface choices between image semantics and range geometry.
- The core interface question is where information crosses modality boundaries: raw points, image pixels, BEV features, object queries, voxels, or final detections.
- This page focuses on modern query, interaction, and occupancy fusion methods that complement broader BEV fusion coverage.
- Representative methods include FUTR3D, CMT, DeepInteraction, and MS-Occ.
- The goal for airside autonomy is not maximum leaderboard score alone; it is calibrated geometry, semantics, modality health, and graceful degradation.

## Interface Taxonomy

| Interface | What Crosses Modalities | Typical Methods | Main Risk |
|---|---|---|---|
| Projection augmentation | Image labels or features projected onto LiDAR points | PointPainting-style systems | Calibration and occlusion errors become point labels |
| BEV feature fusion | Camera BEV and LiDAR BEV tensors | BEVFusion, TransFusion-style systems | BEV flattening can hide vertical structure |
| Query feature sampling | Object queries sample both image and LiDAR/radar features | FUTR3D, CMT | Query budget can miss small or unusual objects |
| Modality interaction | Separate modality streams repeatedly exchange predictive features | DeepInteraction | More complex failure modes and latency |
| Voxel occupancy fusion | Camera semantics and LiDAR geometry combine in voxel space | MS-Occ | Semantic conflicts and sparse LiDAR labels |
| Late decision fusion | Boxes, tracks, or occupancy maps merge after independent inference | Production fallback systems | Loses low-level evidence and can double-count |

## Core Technical Ideas

- FUTR3D uses a Modality-Agnostic Feature Sampler (MAFS) so the same query-based detector can sample features from cameras, LiDAR, radar, or mixed sensor configurations.
- CMT frames multi-modal 3D detection as a cross-modal transformer problem, using transformer queries to integrate camera and LiDAR features efficiently.
- DeepInteraction keeps camera and LiDAR representations separate and lets them interact through dedicated modality interaction layers instead of collapsing one modality into the other early.
- MS-Occ applies fusion at multiple stages for semantic occupancy: Gaussian-Geo enriches image features with LiDAR-derived geometric priors, Semantic-Aware fusion enriches LiDAR voxels with image context, and late voxel fusion reconciles semantic conflicts.
- The deployment theme across these methods is that the interface should expose what each sensor contributed, not only the final fused answer.

## Inputs and Outputs

- Input: synchronized multi-view camera images.
- Input: LiDAR point clouds or voxel/pillar features.
- Input metadata: camera intrinsics, camera-LiDAR extrinsics, ego pose, timestamps, image augmentations, and LiDAR motion correction.
- Optional input: radar features, sensor-health masks, modality dropout masks, or calibration covariance.
- Output: 3D object detections, BEV segmentation, semantic occupancy, or fused BEV features.
- Monitoring output: modality contribution, feature alignment score, calibration residual, and per-modality confidence.

## Benchmark Signals

- FUTR3D reports that cameras plus a 4-beam LiDAR achieve 58.0 mAP on nuScenes, comparable to a CenterPoint 32-beam LiDAR baseline at 56.6 mAP.
- MS-Occ reports 32.1 IoU and 25.3 mIoU on nuScenes-OpenOccupancy, improving the cited state of the art by +0.7 IoU and +2.4 mIoU.
- DeepInteraction was a NeurIPS 2022 method designed around explicit modality interaction for multi-modal 3D detection.
- CMT focuses on fast, robust end-to-end multi-modal 3D object detection.
- Fair comparison requires matching sensors, LiDAR beam count, camera resolution, latency budget, temporal setting, and whether the model is detection-only or occupancy-capable.

## Deployment Risks

- Calibration errors can silently convert good image evidence into wrong 3D geometry.
- Time synchronization errors are amplified when fast-moving objects are fused across modalities.
- Camera features can dominate semantics while LiDAR dominates geometry, causing the system to look confident even when the two disagree.
- Sparse LiDAR returns can make small objects invisible, while camera-only depth can smear object extent.
- BEV fusion can lose vertical clearance information for wings, jet bridges, signs, and overhangs.
- Late-fused detections can double-count correlated evidence if covariance and source provenance are ignored.
- Training only on clean full-sensor data makes sensor dropout brittle.

## Airside AV Fit

- Camera-LiDAR fusion is essential for aircraft stands because semantics and precise geometry are both needed.
- LiDAR helps with clearance around aircraft, GSE, cones, chocks, tow bars, and pedestrians; cameras help classify equipment and interpret markings.
- Query fusion is attractive for standard actors such as tugs, buses, tractors, and trucks.
- Voxel occupancy fusion is stronger near irregular geometry such as wings, engines, dollies, hoses, and belt loaders.
- Airside stacks should expose modality health to planning: camera-only, LiDAR-only, and fused outputs should not have the same operational authority.
- Validate separately under floodlights, wet pavement, reflective aircraft skin, rain, fog, spray, jet exhaust, and camera occlusion.

## Implementation Guidance

- Start with a BEV or voxel fusion baseline that supports explicit modality dropout.
- Add query-level fusion when object detection latency and memory are more important than dense scene representation.
- Add occupancy fusion for clearance-critical areas where boxes are too coarse.
- Keep camera-LiDAR calibration versioned with every model and dataset artifact.
- Log per-object and per-voxel modality support so incident review can see which sensor drove the output.
- Train with missing modalities, degraded cameras, sparse LiDAR, and calibration perturbations.
- Require a conservative fallback when camera and LiDAR disagree inside the planned path.

## Sources

- FUTR3D arXiv paper: https://arxiv.org/abs/2203.10642
- FUTR3D CVF paper: https://openaccess.thecvf.com/content/CVPR2023W/WAD/papers/Chen_FUTR3D_A_Unified_Sensor_Fusion_Framework_for_3D_Detection_CVPRW_2023_paper.pdf
- CMT arXiv paper: https://arxiv.org/abs/2301.01283
- DeepInteraction NeurIPS paper page: https://proceedings.neurips.cc/paper_files/paper/2022/hash/0d18ab3b5fabfa6fe47c62e711af02f0-Abstract-Conference.html
- MS-Occ arXiv paper: https://arxiv.org/abs/2504.15888
- Existing fusion overview: [Sensor Fusion Architectures](sensor-fusion-architectures.md)
