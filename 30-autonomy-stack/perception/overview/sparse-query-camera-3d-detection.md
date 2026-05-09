# Sparse Query Camera 3D Detection

## What It Covers

- Sparse query camera 3D detection predicts 3D objects from surround cameras without constructing a full dense BEV tensor as the main representation.
- It uses object queries, sparse anchors, or adaptive sampling points to pull only object-relevant image features.
- This page covers SparseBEV, DETR4D, DySS, and their relationship to [Sparse4D](../methods/sparse4d.md) and [ForeSight](../methods/foresight.md).
- The deployment question is whether sparse queries can provide enough object recall at lower memory and latency than dense BEV pipelines.
- Sparse query methods are object-centric; they do not by default prove freespace or dense occupancy.

## Core Technical Ideas

- DETR4D uses sparse attention and projective cross-attention so 3D object queries directly sample multi-view image features.
- DETR4D also uses a heatmap-based query initialization bridge between 2D and 3D, plus hybrid temporal fusion over past object queries and image features.
- SparseBEV removes explicit dense BEV construction and adds scale-adaptive self-attention, adaptive spatio-temporal sampling, and adaptive mixing.
- Sparse4D represents objects as sparse 3D anchors with propagated instance features across time.
- DySS adds state-space learning over temporal sampled features and dynamically merges, removes, or splits queries to maintain a lean query set.
- ForeSight extends sparse temporal query memory from detection into joint detection and trajectory forecasting.

## Inputs and Outputs

- Input: multi-view camera images.
- Input metadata: camera intrinsics, extrinsics, image augmentations, ego pose, and timestamps.
- Optional input: query memory, temporal instance features, or state-space memory from previous frames.
- Training input: 3D boxes, class labels, velocities, and optionally tracking or forecasting labels.
- Output: 3D boxes with class scores, orientation, dimensions, location, and velocity.
- Optional output: track IDs or trajectory forecasts depending on method.
- Missing output: dense occupancy, freespace, and semantic map layers unless a separate head is added.

## Benchmark Signals

- SparseBEV reports 67.5 NDS on the nuScenes test split.
- SparseBEV reports 55.8 NDS on validation while maintaining 23.5 FPS.
- DETR4D reports efficient nuScenes multi-view 3D detection with sparse attention and temporal query/image fusion.
- DySS reports 65.31 NDS and 57.4 mAP on the nuScenes test split.
- DySS reports 56.2 NDS, 46.2 mAP, and 33 FPS on validation.
- ForeSight reports 54.9 EPA for joint detection and forecasting and a +9.3 point gain over previous methods.
- Fair comparison must control for backbone, image resolution, temporal history, online versus offline setting, and pretraining.

## Strengths

- Lower memory pressure than dense BEV feature maps.
- Computation can scale with query count rather than BEV grid area.
- Object queries naturally support temporal memory, tracking, and forecasting extensions.
- Sparse sampling avoids some expensive image-to-BEV lifting.
- Good fit for camera-only fallback or camera-primary object detection.
- Dynamic query management can reduce redundant computation over long video windows.

## Failure Modes

- Query budget can miss small, rare, low-contrast, or oddly shaped objects.
- Camera-only depth remains fragile at long range and under occlusion.
- Projection-based sampling is sensitive to calibration and image augmentation bookkeeping.
- Object-centric outputs cannot prove that the path is clear.
- Sparse methods can underrepresent non-boxy hazards such as hoses, tow bars, cones, chocks, dropped luggage, and FOD.
- Temporal memory can propagate false positives unless reset and health-gated.

## Airside AV Fit

- Useful for standard actor detection: tugs, buses, baggage tractors, service trucks, and pedestrians.
- Attractive for edge deployment where dense BEV memory is expensive.
- Query memory is useful for temporary occlusions behind aircraft, belt loaders, dollies, or jet bridges.
- Weak fit as a sole safety layer near aircraft because it lacks dense clearance and small-object coverage.
- Airside adaptation needs new classes, size priors, and prompts for GSE, aircraft parts, cones, chocks, tow bars, hoses, and ground crew.
- Pair with LiDAR/radar occupancy and map no-go zones for planning authority.

## Implementation Guidance

- Tune query count and anchor priors for airport object scales instead of nuScenes-only vehicle distributions.
- Keep temporal memory reset rules explicit for dropped frames, localization jumps, camera faults, and scene changes.
- Measure path-corridor false negatives, not only mAP or NDS.
- Run camera calibration perturbation tests because sparse projection failures can be silent.
- Add small-object and thin-object validation sets.
- Treat sparse camera detections as an object channel feeding a fused tracker or occupancy planner, not as complete scene understanding.

## Sources

- SparseBEV arXiv paper: https://arxiv.org/abs/2308.09244
- SparseBEV official repository: https://github.com/MCG-NJU/SparseBEV
- DETR4D arXiv paper: https://arxiv.org/abs/2212.07849
- DySS arXiv paper: https://arxiv.org/abs/2506.10242
- ForeSight arXiv paper: https://arxiv.org/abs/2508.07089
- Existing Sparse4D page: [Sparse4D](../methods/sparse4d.md)
