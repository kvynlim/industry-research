# Cam4DOcc

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "Cam4DOcc is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- Cam4DOcc is a CVPR 2024 benchmark for camera-only 4D occupancy forecasting.
- It extends camera occupancy estimation from "what is occupied now" to "what will be occupied in the near future."
- The benchmark is built from public driving datasets rather than a new raw-sensor dataset.
- It provides standardized tasks, generated labels, and baseline implementations for future occupancy.
- The central method baseline is OCFNet, an end-to-end occupancy forecasting network.
- It is not a Gaussian occupancy representation and not a box-only detection method.

## Core Technical Idea

- Represent the scene as a dense 3D voxel occupancy field over time.
- Use historical surround-camera observations to estimate both present occupancy and future occupancy states.
- Reorganize nuScenes, nuScenes-Occupancy, and Lyft-Level5 into sequential occupancy labels.
- Include 3D backward centripetal flow so future occupied voxels can be related to motion.
- Evaluate several baseline families: static-world copy, point-cloud-prediction voxelization, 2D-3D instance prediction, and OCFNet.
- Separate evaluation levels for coarse general movable objects, finer categories, general static objects, and free space.
- The important framing is that future occupancy is evaluated as a spatiotemporal perception output, not only as tracked object trajectories.

## Inputs and Outputs

- Input at inference: surround camera images across a short history window.
- Input metadata: camera intrinsics, extrinsics, ego pose, and temporal frame ordering.
- Training inputs: public dataset annotations transformed into occupancy and flow labels.
- Output: current and future 3D occupancy grids in ego coordinates.
- Optional output: voxel-wise class labels depending on the benchmark task version.
- Optional output: 3D flow or instance-related occupancy information used by forecasting baselines.
- The benchmark default range is road-scale, not aircraft-stand scale.

## Architecture or Pipeline

- Dataset pipeline converts existing sequential datasets into Cam4DOcc occupancy samples.
- The repo integrates label generation into dataloaders, with an option to generate only the dataset cache.
- Camera features are lifted into a 3D occupancy representation through the OpenOccupancy-style codebase.
- OCFNet uses observed occupancy features and temporal modules to forecast future voxel states.
- Baselines compare static copying against explicit point or instance prediction and the end-to-end network.
- Evaluation treats present occupancy and future occupancy separately, so temporal degradation is visible.
- Visualization tools show changing occupancy states and predicted future occupancy sequences.

## Training and Evaluation

- Primary datasets: nuScenes, nuScenes-Occupancy, and Lyft-Level5.
- The official repo lists 23,930 nuScenes training sequences and 5,119 validation frames for its current setup.
- The default voxel size is 0.2 m with a nominal range of x/y +/-51.2 m and z from -5 m to 3 m.
- Baseline settings use 3 observation frames and 4 future frames, with extensions for additional prediction frames.
- OCFNet V1.1 forecasts inflated general movable objects versus others.
- OCFNet V1.2 separates movable classes such as bicycle, bus, car, construction vehicle, motorcycle, trailer, truck, and pedestrian.
- Metrics include occupancy forecasting quality across the benchmark's preset tasks rather than only object-box mAP.

## Strengths

- Makes future occupancy a repeatable benchmark instead of an ad hoc visualization.
- Camera-only input keeps the runtime sensor bill low and stresses vision-centric world modeling.
- Dense voxel outputs can represent irregular occupied space better than 3D boxes.
- Multiple task levels expose whether a method only learns moving-object blobs or also handles static geometry and free space.
- Public dataset grounding makes it easier to compare new forecasting models.
- Useful baseline for planning stacks that want occupancy risk maps rather than only actor trajectories.

## Failure Modes

- Camera-only forecasting is weak under occlusion, glare, night lighting, and unusual object geometry.
- Future occupancy can become overconfident when a static-world baseline is accidentally competitive on slow scenes.
- Road-dataset priors do not cover aircraft, jet bridges, belt loaders, dollies, baggage trains, or apron markings.
- Voxel labels derived from existing datasets inherit annotation limits and temporal alignment errors.
- Near-future evaluation does not prove long-horizon behavior under dense operational choreography.
- The benchmark does not solve uncertainty calibration; planners still need conservative risk handling.

## Airside AV Fit

- High research fit for apron autonomy because airside driving needs free-space and swept-volume forecasts, not only object boxes.
- Needs an airport-specific occupancy taxonomy for aircraft fuselages, wings, engines, cones, chocks, tow bars, GSE, and personnel.
- Camera-only runtime is attractive around stands, but should be fused with radar or LiDAR for clearance-critical zones.
- Strong candidate for predicting future blocked space around pushback, servicing, and baggage-cart flows.
- Must be evaluated under floodlights, wet concrete, reflective aircraft skin, rain, fog, and de-icing spray.
- Airside deployment should treat forecast occupancy as an advisory planning layer unless uncertainty is explicitly calibrated.

## Implementation Notes

- Keep camera timestamps, ego poses, and rig calibration exact; small temporal errors create false future occupancy.
- Rebuild voxel ranges for airport scenes; aircraft-scale geometry may exceed nuScenes-oriented limits.
- Add airport-specific label generation before comparing OCFNet-style models to box trackers.
- Track metrics by horizon, object type, range, and occlusion state instead of reporting one aggregate score.
- Use static-copy and constant-velocity baselines as mandatory sanity checks.
- Validate that future occupancy does not erase static hazards such as cones, chocks, and parked equipment.
- Store generated occupancy caches separately from raw datasets to avoid silent label-version drift.

## Sources

- CVPR 2024 paper page: https://openaccess.thecvf.com/content/CVPR2024/html/Ma_Cam4DOcc_Benchmark_for_Camera-Only_4D_Occupancy_Forecasting_in_Autonomous_Driving_CVPR_2024_paper.html
- arXiv paper: https://arxiv.org/abs/2311.17663
- Official Cam4DOcc repository: https://github.com/haomo-ai/Cam4DOcc
- nuScenes dataset: https://www.nuscenes.org/nuscenes
- nuScenes-Occupancy project: https://github.com/FANG-MING/occupancy-for-nuscenes
- Lyft Level 5 dataset: https://level-5.global/data/
