# Occupancy Flow and 4D Occupancy Benchmarks

**Last updated:** 2026-05-09

## Why It Matters

3D occupancy tells a planner where space is free, occupied, or unknown. Occupancy flow and 4D occupancy add time: where occupied space is moving now and where it may be in future frames. This is useful for airside autonomy because hazards are not limited to tracked road vehicles. Moving ground crew, baggage carts, tugs, aircraft during pushback, belt-loader conveyors, and unknown obstacles all need spatial and temporal reasoning.

The benchmarks below cover BEV occupancy flow, semantic 3D occupancy, dense nuScenes-derived occupancy, multi-camera volumetric occupancy, and camera-only 4D forecasting.

## Dataset/Benchmark Table

| Dataset / benchmark | Source URL | Domain and representation | Labels / task | Best use | Main transfer risk |
|---|---|---|---|---|---|
| Waymo Occupancy Flow / Occupancy Flow Fields | https://waymo.com/research/occupancy-flow-fields-for-motion-forecasting-in-autonomous-driving/ | Spatio-temporal BEV grid with occupancy probabilities and 2D flow vectors | Predict occupied grid cells, flow, and agent identity recovery for observed and speculative agents | Motion forecasting when trajectories are too object-centric; BEV occupancy/flow planning interface | Agent-centric road forecasting does not cover aircraft/GSE geometry, 3D height, or small FOD |
| Waymo Occupancy and Flow Prediction Challenge | https://waymo.com/open/challenges/ | Waymo Open Dataset challenge track | BEV roadway occupancy and motion flow for observed and occluded vehicles | Leaderboard benchmarking and reproducible challenge protocol | Vehicle-focused roadway domain, not apron equipment or 3D semantic occupancy |
| Occ3D | https://github.com/Tsinghua-MARS-Lab/Occ3D | Occ3D-Waymo and Occ3D-nuScenes semantic 3D voxel occupancy | Label generation from accumulated LiDAR and human annotations; evaluation uses camera-visible masks and mIoU | Standard semantic occupancy prediction benchmark over nuScenes/Waymo | Current-frame semantic occupancy, not full future occupancy flow; road classes differ from airside |
| OpenOccupancy | https://github.com/JeffWang987/OpenOccupancy | nuScenes-Occupancy dense semantic occupancy benchmark | Dense semantic occupancy annotations and CONet baseline | High-resolution surrounding occupancy perception and camera/LiDAR fusion evaluation | nuScenes urban driving does not capture airport-apron object taxonomy or operational map layers |
| SurroundOcc | https://github.com/weiyithu/SurroundOcc | Multi-camera 3D occupancy prediction with dense labels generated from sparse LiDAR and semantic/detection labels | Volumetric occupancy prediction and dense occupancy ground-truth generation pipeline | Multi-camera occupancy lifting, dense label generation, and private-data adaptation | Camera-only/multi-camera road scenes may fail under apron glare, night lighting, reflective fuselage, and weather |
| Cam4DOcc | https://github.com/haomo-ai/Cam4DOcc | Camera-only 4D occupancy forecasting based on nuScenes, nuScenes-Occupancy, and Lyft-Level5 | Present and future occupancy, 3D backward centripetal flow, 3 observation frames, 4 future frames, 0.2 m voxels in current release | Future occupancy forecasting benchmark and baseline for 4D occupancy research | Camera-only forecasting is difficult for occluded apron hazards and small/low objects; labels remain road-data-derived |

## Metrics

| Metric | Applies to | What to report |
|---|---|---|
| Occupancy IoU / semantic mIoU | Occ3D, OpenOccupancy, SurroundOcc, Cam4DOcc | Per-class IoU, mean IoU, free/occupied confusion, and mask policy for unknown/unobserved voxels |
| Future occupancy IoU | Cam4DOcc and airside 4D occupancy | IoU at each future horizon, not only averaged over time |
| Flow endpoint error | Waymo occupancy flow, Cam4DOcc flow, voxel-flow models | Per-cell or per-voxel motion vector error, split by actor class and speed |
| Occupancy-flow consistency | Occupancy flow fields | Whether predicted flow transports occupied cells into future occupied cells |
| Observed vs occluded occupancy | Waymo-style prediction | Separate metrics for currently visible actors and speculative or occluded future occupancy |
| Calibration under uncertainty | Safety validation | Reliability diagrams, expected calibration error, and false-free-space rate for occupied/unknown voxels |
| Runtime and memory | Deployment | Mean/P95/P99 latency, voxel resolution, active voxel count, memory, and target hardware |

## Airside/Indoor/Outdoor Transfer

| Transfer path | Useful signal | Airside gap |
|---|---|---|
| Road occupancy to apron occupancy | Voxel/grid representations, mIoU evaluation, unknown-space masking, camera-visible masks | Aircraft, belt loaders, tugs, dollies, cones, chocks, ground crew postures, reflective markings, and FOD |
| BEV occupancy flow to airside planning | Grid-cell motion scoring and speculative occluded actors | 3D height, wing/tail sweep, pushback articulation, and small debris are not captured by 2D BEV alone |
| Camera-only 4D forecasting to airside | Temporal occupancy forecasting and future horizon reporting | Night glare, backlight, jet bridge shadows, rain/fog, and camera occlusion require LiDAR/radar fallback |
| Dense semantic occupancy to map operations | Static/dynamic spatial layers and map QA visualization | Production maps need persistence, provenance, and versioning beyond per-frame occupancy |

## Validation Guidance

1. Start with Occ3D/OpenOccupancy/SurroundOcc to validate current-frame occupancy before adding future flow.
2. Evaluate future horizons separately, for example 0.5 s, 1 s, 2 s, and 5 s. Airside speeds are low, but interactions can last longer than road cut-ins.
3. Report false-free-space rate. For safety, a voxel predicted free when it is occupied is more dangerous than an unknown voxel.
4. Add airside semantic classes before production claims: aircraft, tug, belt loader, baggage cart, dolly, cone, chock, barrier, personnel, FOD, jet bridge, and stand marking.
5. Validate camera-only and LiDAR-first variants separately under night, wet apron, glare, fog, and de-icing mist.
6. Couple occupancy-flow metrics to planner outcomes: collision margin, hard-brake rate, stop/yield correctness, and deadlock behavior near stands.

## Sources

- Waymo Occupancy Flow Fields paper page: https://waymo.com/research/occupancy-flow-fields-for-motion-forecasting-in-autonomous-driving/
- Waymo Occupancy Flow Fields paper: https://arxiv.org/abs/2203.03875
- Waymo Open Dataset challenges page: https://waymo.com/open/challenges/
- Occ3D repository: https://github.com/Tsinghua-MARS-Lab/Occ3D
- Occ3D paper: https://arxiv.org/abs/2304.14365
- OpenOccupancy repository: https://github.com/JeffWang987/OpenOccupancy
- OpenOccupancy paper: https://arxiv.org/abs/2303.03991
- SurroundOcc repository: https://github.com/weiyithu/SurroundOcc
- SurroundOcc paper: https://arxiv.org/abs/2303.09551
- Cam4DOcc repository: https://github.com/haomo-ai/Cam4DOcc
- Cam4DOcc CVPR paper page: https://openaccess.thecvf.com/content/CVPR2024/html/Ma_Cam4DOcc_Benchmark_for_Camera-Only_4D_Occupancy_Forecasting_in_Autonomous_Driving_CVPR_2024_paper.html
- Cam4DOcc paper: https://arxiv.org/abs/2311.17663
