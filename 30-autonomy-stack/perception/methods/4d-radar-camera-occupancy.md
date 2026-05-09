# 4D Radar-Camera Occupancy

## What It Is

- 4D radar-camera occupancy covers dense 3D semantic occupancy prediction from imaging radar, cameras, or both.
- The main research gap is all-weather dense scene representation without depending entirely on LiDAR.
- 4DRC-OCC studies direct 4D radar and camera fusion for semantic occupancy.
- RadarOcc is a radar-only 4D imaging radar occupancy baseline built around raw radar tensor processing.
- 4D-ROLLS learns radar occupancy with LiDAR-derived weak supervision.
- Doracamom extends the fusion problem to joint 3D detection and semantic occupancy with multi-view 4D radars and cameras.
- This page is about dense occupancy. For camera-only future occupancy, see [Cam4DOcc](cam4docc.md); for radar-camera detection, see [RaCFormer](racformer.md).

## Core Idea

- Use 4D radar range, azimuth, elevation, and Doppler to add metric geometry and motion cues where cameras are weak.
- Use cameras to supply texture and semantic evidence that sparse or noisy radar point returns cannot provide alone.
- Lift image features into 3D using depth cues or radar-guided geometric priors.
- Convert radar data into voxel, BEV, spherical, or tensor features before fusing with camera features.
- Predict dense occupied/free/semantic voxels rather than only object boxes.
- Treat LiDAR labels, LiDAR height maps, or automatically generated pseudo labels as supervision when manual voxel labels are expensive.
- Keep radar-specific artifacts visible in the design instead of pretending 4D radar behaves like sparse LiDAR.

## Inputs and Outputs

- Input: multi-view camera images with intrinsics, extrinsics, timestamps, and ego poses.
- Input: 4D imaging radar data as point clouds, sweeps, tensors, or voxelized radar features.
- Optional input: LiDAR point clouds during training for pseudo occupancy labels or height-map supervision.
- Output: dense 3D semantic occupancy grid in ego coordinates.
- Optional output: BEV segmentation, point-cloud occupancy, or object detections in multi-task systems such as Doracamom.
- Optional output: radar-only occupancy for degraded camera conditions.
- The output is a spatial scene representation, not a track graph or future forecast unless combined with a temporal module.

## Architecture or Pipeline

- RadarOcc processes the 4D radar tensor directly to preserve details that can be lost when only sparse radar points are used.
- RadarOcc uses Doppler-bin descriptors, sidelobe-aware spatial sparsification, range-wise self-attention, spherical feature encoding, and spherical-to-Cartesian feature aggregation.
- 4DRC-OCC combines radar and camera features for semantic occupancy and explicitly studies depth cues for lifting camera pixels into 3D.
- 4D-ROLLS generates pseudo-LiDAR occupancy queries and LiDAR height maps, then aligns radar occupancy predictions to LiDAR-derived occupancy maps.
- Doracamom initializes voxel queries with a Coarse Voxel Queries Generator using 4D radar geometric priors and image semantic features.
- Doracamom adds a Dual-Branch Temporal Encoder over BEV and voxel spaces and a Cross-Modal BEV-Voxel Fusion module for joint detection and occupancy.
- Practical systems should expose modality-specific confidence so planners can distinguish radar-supported occupied space from camera-only hallucination.

## Training and Evaluation

- RadarOcc benchmarks radar occupancy on [K-Radar](k-radar.md) and compares radar, LiDAR, and camera baselines.
- 4D-ROLLS uses LiDAR point clouds as weak supervision and reports qualitative robustness under smoke, rain, snow, and fog.
- 4D-ROLLS reports downstream transfer to BEV segmentation and point-cloud occupancy prediction, with about 30 Hz inference on an RTX 4060-class GPU.
- Doracamom evaluates joint detection and occupancy on OmniHD-Scenes, View-of-Delft, and TJ4DRadSet.
- 4DRC-OCC introduces automatically labeled data for semantic occupancy training, reducing manual voxel-label cost.
- Evaluation should separate camera-only, radar-only, late-fusion, BEV-fusion, tensor-fusion, and query-fusion variants.
- Report occupancy IoU by class, range, weather, lighting, velocity state, and occlusion; one aggregate score can hide radar-specific failures.

## Strengths

- Directly targets adverse-weather occupancy, a weakness of camera-only and many LiDAR-heavy pipelines.
- Dense occupancy can represent irregular hazards better than 3D boxes.
- Radar Doppler helps distinguish static from dynamic occupied space when geometry is sparse.
- Camera features add semantics that radar alone often cannot resolve.
- LiDAR-supervised radar training provides a practical bootstrap path before dense radar occupancy labels exist.
- Multi-task detection plus occupancy can share geometry while exposing both object-level and dense-space outputs.

## Failure Modes

- Radar multipath and sidelobes can create persistent false occupied voxels near metal structures.
- Camera lifting still depends on depth quality; bad depth can smear semantic labels through 3D space.
- Sparse radar returns may miss thin obstacles, low-RCS objects, cones, chocks, tow bars, or pedestrians near clutter.
- Automatically generated labels inherit errors from LiDAR visibility, occlusion handling, and temporal alignment.
- BEV-only fusion can erase vertical structure that matters for wings, loading bridges, signs, and overhangs.
- Radar-camera calibration drift can look like semantic confusion rather than an obvious sensor fault.

## Airside AV Fit

- Strong fit for airport autonomy because rain, fog, spray, night floodlights, and reflective surfaces are common operational stressors.
- Occupancy is more useful than boxes near aircraft stands because wings, engines, chocks, cones, and belt loaders have awkward shapes.
- 4D radar can add motion evidence for tugs, buses, carts, and personnel before camera-only trackers stabilize.
- Airport deployment needs a taxonomy beyond road classes: aircraft parts, GSE, cones, chocks, tow bars, hoses, cables, ground crew, and jet bridges.
- Radar multipath around aircraft fuselages and terminal glass must be tested explicitly; this is not a minor corner case.
- Treat the output as a conservative planning layer only after uncertainty and false-positive persistence are characterized.

## Implementation Notes

- Preserve native radar fields, including Doppler, elevation, radar cross-section or power, and per-sweep timestamps.
- Do not discard raw radar tensors prematurely if using RadarOcc-style processing; point extraction can remove useful weak returns.
- Keep camera-radar-LiDAR calibration versioned with the generated occupancy labels.
- Train and evaluate with sensor dropout and modality degradation, not only clean synchronized frames.
- Use LiDAR-supervised radar labels as bootstrap data, then audit them manually on airport-specific static hazards.
- Tune voxel range and height limits for aircraft stands; road-dataset z-ranges are often too small.
- Add downstream occupancy sanity checks against known map geometry and static exclusion zones.

## Sources

- 4DRC-OCC arXiv paper: https://arxiv.org/abs/2603.07794
- 4D-ROLLS arXiv paper: https://arxiv.org/abs/2505.13905
- RadarOcc arXiv paper: https://arxiv.org/abs/2405.14014
- Doracamom arXiv paper: https://arxiv.org/abs/2501.15394
- K-Radar method page: [K-Radar](k-radar.md)
- Cam4DOcc method page: [Cam4DOcc](cam4docc.md)
- RaCFormer method page: [RaCFormer](racformer.md)
