# Scene Flow Datasets and Benchmarks

**Last updated:** 2026-05-09

## Why It Matters

Scene flow estimates 3D motion for points or voxels between frames. It is the motion primitive behind occupancy flow, dynamic object segmentation, point-cloud forecasting, and flow-aware planning. For airside autonomy, scene flow is useful because not all hazards are clean tracked boxes: a pushback tug, wing sweep, baggage train, walking ground crew, or loose object can be better represented as moving 3D structure than as a single centroid trajectory.

The benchmarks below span real LiDAR, stereo image scene flow, and synthetic dense supervision. Use them to separate algorithm capability from airside domain fit.

## Dataset/Benchmark Table

| Dataset / benchmark | Source URL | Domain and sensors | Labels / task | Best use | Main transfer risk |
|---|---|---|---|---|---|
| Argoverse 2 3D Scene Flow | https://argoverse.github.io/user-guide/tasks/3d_scene_flow.html | AV2 LiDAR sweeps at 0.1 s intervals with ego motion, object boxes, and ground masks | N x 3 flow vectors plus dynamic/static segmentation; object boxes generate piecewise-rigid labels | Real AV LiDAR scene flow, dynamic/static point segmentation, long-range road motion | Flow labels are box-derived and road-centric; aircraft articulation and low-speed GSE are absent |
| AV2 Scene Flow Challenge / Bucket Normalized EPE | https://www.argoverse.org/sceneflow.html | AV2 and multi-dataset challenge setup with leaderboard support | Supervised and unsupervised tracks with expanded range and cross-dataset generalization emphasis | Modern evaluation protocol that reduces bias toward easy/background points | Challenge success does not guarantee airport object taxonomy or multi-LiDAR deployment |
| Waymo Scene Flow Labels | https://waymo.com/research/scalable-scene-flow-from-point-clouds-in-the-real-world/ | Waymo Open Dataset LiDAR, labels derived from tracked 3D objects | Per-point motion direction and magnitude; metrics account for ego motion and object type | Large-scale real-world LiDAR flow training and full-cloud inference evaluation | Labels are derived from tracked boxes and urban road actors, not aircraft/GSE |
| KITTI Scene Flow 2015 | https://www.cvlibs.net/datasets/kitti/eval_scene_flow.php?benchmark=stereo | Stereo image pairs with dynamic scenes and semi-automatic ground truth | Stereo disparity at two times plus optical flow; scene flow outlier rate | Classic benchmark for image-based scene flow, optical-flow/depth consistency, and foreground/background breakdowns | Camera stereo benchmark is sparse for LiDAR-first AVs and much smaller than modern AV datasets |
| FlyingThings3D | https://lmb.informatik.uni-freiburg.de/resources/datasets/SceneFlowDatasets | Synthetic rendered scenes for disparity, optical flow, and scene flow | Dense synthetic ground truth for optical flow, disparity, disparity change, and scene flow | Pretraining, ablations, dense supervision, and sanity checks for geometry learning | Synthetic object motion and visual appearance must be bridged to real LiDAR/camera data |

## Metrics

| Metric | Benchmark family | What to report |
|---|---|---|
| EPE3D | LiDAR point scene flow | Mean and percentile Euclidean endpoint error in meters, split by static/dynamic, distance, and actor type |
| Bucket Normalized EPE | AV2 challenge-style evaluation | Bucketed error that reduces domination by background or high-frequency easy points |
| Dynamic/static segmentation F1 | AV2-style output and MOS coupling | Precision, recall, and F1 for dynamic points, with speed thresholds stated explicitly |
| Outlier rate | KITTI-style scene flow | D1, D2, Fl, and SF outlier percentages; report foreground, background, all, and non-occluded where applicable |
| Flow angular and speed error | Airside planning transfer | Direction error and speed magnitude error for slow GSE, walking personnel, and articulated equipment |
| Temporal consistency | World-model inputs | Jitter, sign flips, and frame-to-frame flow stability over multi-frame windows |
| Runtime | Deployment | Mean/P95/P99 latency on target hardware and full point-cloud size, not only downsampled points |

## Airside/Indoor/Outdoor Transfer

| Transfer path | Useful signal | Airside gap |
|---|---|---|
| AV2/Waymo road LiDAR to airside | Real LiDAR density, ego-motion compensation, tracked actor flow, dynamic/static segmentation | Low-speed apron vehicles, aircraft pushback, articulated aircraft parts, sparse open apron structure |
| KITTI stereo to airside cameras | Stereo/depth/flow consistency and foreground/background outlier accounting | Older sensor setup, small benchmark, and no airport traffic |
| FlyingThings3D to real data | Dense labels for pretraining and controlled geometric failure analysis | Synthetic-to-real domain gap in texture, LiDAR sparsity, weather, lighting, and scale |
| Scene flow to occupancy flow | Per-point motion vectors can supervise per-voxel flow and future occupancy | Voxelization can hide small FOD and thin moving structures unless resolution and labels are validated |

## Validation Guidance

1. Establish baseline EPE3D and dynamic F1 on AV2 or Waymo before training on private airside logs.
2. Report dynamic-object performance separately from static background. A model can look accurate by predicting mostly ego-motion on static surfaces.
3. Add low-speed thresholds relevant to apron motion. A 0.5 m/s dynamic cutoff may miss creeping GSE, tow bars, or aircraft pushback motion.
4. Evaluate long, thin, and articulated structures: belt-loader conveyors, baggage carts, dollies, aircraft tails/wings, jet bridges, and personnel partially occluded by equipment.
5. Validate multi-LiDAR flow before fusion and after fusion. Per-sensor time offset or extrinsic error can look like scene motion.
6. Feed scene-flow outputs into downstream occupancy, tracking, and planning tests. Standalone EPE is not enough for safety acceptance.

## Sources

- Argoverse 2 scene flow task: https://argoverse.github.io/user-guide/tasks/3d_scene_flow.html
- AV2 Scene Flow Challenge: https://www.argoverse.org/sceneflow.html
- BucketedSceneFlowEval repository: https://github.com/argoverse/BucketedSceneFlowEval
- Waymo scene flow research page: https://waymo.com/research/scalable-scene-flow-from-point-clouds-in-the-real-world/
- Waymo Open Dataset download page with scene flow labels: https://waymo.com/open/download
- Waymo scene flow paper: https://arxiv.org/abs/2103.01306
- KITTI Scene Flow 2015 benchmark: https://www.cvlibs.net/datasets/kitti/eval_scene_flow.php?benchmark=stereo
- KITTI Object Scene Flow paper: https://www.cvlibs.net/publications/Menze2015CVPR.pdf
- FlyingThings3D / Scene Flow Datasets: https://lmb.informatik.uni-freiburg.de/resources/datasets/SceneFlowDatasets
- Scene Flow Datasets paper: https://arxiv.org/abs/1512.02134
