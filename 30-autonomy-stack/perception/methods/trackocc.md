# TrackOcc

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "TrackOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- TrackOcc is an ICRA 2025 camera-based 4D panoptic occupancy tracking method.
- It introduces the task of camera-based 4D panoptic occupancy tracking: occupancy panoptic segmentation plus object tracking.
- The method processes camera inputs in a streaming, end-to-end manner using 4D panoptic queries.
- It targets temporally consistent dense voxel instance identity, not only per-frame semantic occupancy.
- OccTrack360 extends the problem setting to surround-view fisheye cameras, long sequences, and fisheye visibility masks.
- This page is about tracking occupancy through time. For camera-only occupancy forecasting, see [Cam4DOcc](cam4docc.md); for asynchronous occupancy flow, see [StreamingFlow](streamingflow.md).

## Core Idea

- Represent dynamic scene understanding as dense panoptic occupancy with persistent instance identity across 3D space and time.
- Use 4D panoptic queries to carry object or instance information in a streaming camera-only pipeline.
- Train with a localization-aware loss so tracked occupancy is spatially accurate, not only identity-consistent.
- Evaluate temporal consistency with metrics designed for occupancy tracking rather than borrowing box-tracking metrics directly.
- TrackOcc introduces OccSTQ for fair evaluation of the new task and adapts baselines from related domains.
- OccTrack360 adds fisheye-specific lifting and visibility modeling for surround-view wide-FOV camera rigs.
- The important distinction from forecasting is that TrackOcc asks "which occupied voxels belong to the same instance over time," not only "which voxels will be occupied."

## Inputs and Outputs

- Input: camera images, typically multi-view, with calibration, ego pose, and temporal ordering.
- Input metadata: camera intrinsics, extrinsics, frame timestamps, and voxel grid definition.
- Training input: panoptic occupancy labels with instance IDs across time.
- Output: voxel-wise semantic occupancy.
- Output: voxel-wise instance identity for tracked object occupancy over time.
- Optional output: panoptic occupancy visualizations where identical colors indicate the same instance across space and time.
- It does not require LiDAR at inference, but labels may be derived from LiDAR-heavy dataset pipelines.

## Architecture or Pipeline

- Image backbone extracts camera features.
- Camera features are lifted or transformed into a 3D/BEV occupancy representation.
- 4D panoptic queries interact with the scene representation to produce temporally persistent occupancy instances.
- The model runs in a streaming end-to-end setup rather than offline linking all frames after prediction.
- Localization-aware loss penalizes spatially inaccurate instance occupancy and improves tracking quality.
- The official TrackOcc repo includes model code, loaders, configs, training, test, inference, timing, and visualization scripts.
- OccTrack360's FoSOcc baseline adds a Center Focusing Module for instance-aware localization and a Spherical Lift Module for fisheye projection under the Unified Projection Model.

## Training and Evaluation

- TrackOcc is evaluated on Waymo-derived 4D panoptic occupancy tracking data.
- The official repo provides TrackOcc-Waymo data and labels, including 5-frame interval sampled data, through Hugging Face.
- TrackOcc proposes the OccSTQ metric for occupancy tracking quality.
- The repo targets a PyTorch 1.12.1, CUDA 11.3, MMDetection/MMDetection3D-style environment with custom CUDA extensions.
- OccTrack360 provides sequences from 174 to 2234 frames and includes all-direction occlusion masks plus MEI-based fisheye field-of-view masks.
- OccTrack360 evaluates on Occ3D-Waymo and its own benchmark and reports gains for geometrically regular categories with the FoSOcc baseline.
- Evaluation should report semantic quality, instance association, temporal stability, occlusion cases, and latency separately.

## Strengths

- Dense panoptic occupancy gives a planner richer state than boxes when actors have irregular visible shapes.
- Persistent voxel instance identity can reduce flicker in downstream occupancy planning.
- Camera-only inference is attractive for cost and packaging.
- Streaming design is closer to deployment than offline sequence association.
- OccSTQ makes tracking quality explicit instead of hiding identity failures inside occupancy IoU.
- OccTrack360's fisheye benchmark is relevant to compact surround-view rigs with very wide fields of view.

## Failure Modes

- Camera-only occupancy tracking is vulnerable to darkness, glare, precipitation, spray, dirty lenses, and textureless objects.
- Instance IDs can switch under occlusion, close interaction, or poor localization.
- Dense voxel labels derived from road datasets may not represent unusual airside shapes.
- Occupancy tracking can be temporally smooth but spatially wrong, which is dangerous for clearance.
- Fisheye lifting depends on accurate projection and field-of-view masks; calibration errors become 3D localization errors.
- The task does not itself provide future prediction or calibrated uncertainty.

## Airside AV Fit

- Useful for tracking dense occupied volumes of tugs, buses, baggage carts, dollies, and personnel around stands.
- Panoptic occupancy is valuable where boxes are too crude for articulated equipment or partially occluded actors.
- Camera-only runtime should be paired with radar or LiDAR for night, fog, spray, and aircraft-clearance cases.
- Fisheye support from OccTrack360 is relevant for low-speed apron vehicles that need near-360-degree awareness.
- Airport labels need persistent IDs for aircraft parts, GSE, cones, chocks, tow bars, hoses, and people near aircraft.
- Use tracked occupancy as a perception state input; do not treat identity continuity as proof of safety without geometry and uncertainty checks.

## Implementation Notes

- Keep instance IDs stable during label generation; small ID errors directly corrupt training.
- Version voxel grid ranges, class taxonomy, and visibility masks with the dataset.
- Audit occlusion masks, especially under aircraft wings and near jet bridges.
- Track identity metrics separately from occupancy IoU; a model can occupy the right space with the wrong identity.
- Run timing scripts on target hardware because streaming query models can have hidden latency.
- For fisheye rigs, validate the Unified Projection Model parameters and masks before training.
- Combine with [StreamingFlow](streamingflow.md) or scene-flow methods when future occupancy, not only current tracked occupancy, is required.

## Sources

- TrackOcc arXiv paper: https://arxiv.org/abs/2503.08471
- Official TrackOcc repository: https://github.com/Tsinghua-MARS-Lab/TrackOcc
- OccTrack360 arXiv paper: https://arxiv.org/abs/2603.08521
- Official OccTrack360 repository: https://github.com/YouthZest-Lin/OccTrack360
- Cam4DOcc method page: [Cam4DOcc](cam4docc.md)
- StreamingFlow method page: [StreamingFlow](streamingflow.md)
