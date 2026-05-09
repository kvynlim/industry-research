# Moving/Static Separation and MOS Datasets

**Last updated:** 2026-05-09

## Why It Matters

Moving object segmentation (MOS) is the bridge between raw perception and map-safe autonomy. Semantic labels can say "car" or "person", but MOS answers whether that object is moving now, was moving during mapping, or should be excluded from a persistent map. This distinction is critical for airside operations because aircraft, tugs, belt loaders, dollies, buses, cones, and ground crew can alternate between static, movable-static, and dynamic states within the same stand.

The public benchmarks below are useful for screening algorithms, but none is a complete airport-apron benchmark. Use them to test point-wise motion separation, sensor-pattern robustness, and map-cleaning inputs before collecting local airside data.

## Dataset/Benchmark Table

| Dataset / benchmark | Source URL | Domain and sensors | Labels / task | Best use | Main transfer risk |
|---|---|---|---|---|---|
| SemanticKITTI / SemanticKITTI-MOS | https://semantic-kitti.org/index.html | KITTI odometry urban driving, 10 Hz spinning automotive LiDAR | Point-wise semantic labels with moving and non-moving traffic-participant classes; MOS task added later | Baseline for moving-vs-static segmentation, class-conditioned dynamic analysis, and compatibility with many LiDAR methods | Road traffic and one sensor family do not cover aircraft geometry, low-speed GSE, or multi-LiDAR apron rigs |
| LiDAR-MOS / LMNet | https://github.com/PRBonn/LiDAR-MOS | Sequential spinning LiDAR with ego-motion compensation, evaluated on SemanticKITTI MOS | Binary per-point moving/static output from temporal range residuals | Fast learned MOS baseline for SLAM filtering, map pre-cleaning, and dynamic occupancy masking | Residual features are sensitive to ego-pose error, timestamp drift, rolling LiDAR distortion, and non-rotating LiDAR patterns |
| HeLiMOS | https://sites.google.com/view/helimos/dataset | KAIST05 from HeLiPR with Velodyne VLP-16, Ouster OS2-128, Livox Avia, and Aeva Aeries II | 12,188 labeled point clouds using SemanticKITTI-MOS-style unlabeled/static/dynamic labels | Sensor-transfer benchmark for heterogeneous and solid-state LiDAR MOS | Urban campus dynamics are still not apron dynamics; labels are MOS only, not aircraft/GSE semantics |
| MOE | https://sites.google.com/view/moe-dataset | Ten simulated and real LiDAR sequences with dense moving-object activity | Moving Event Detection (MED) benchmark and CodaLab competition over held-out sequences | Stress testing dense moving-event detection and comparing offline, online, and learned methods | MED emphasizes moving events, so static preservation and map-layer policy still need separate evaluation |
| Dynablox dataset | https://projects.asl.ethz.ch/datasets/dynablox/ | Indoor and outdoor OS0-128 LiDAR sequences with pedestrians and atypical motion such as bouncing balls and rolling luggage | Dynamic-object detection for incremental mapping and object-aware planning | Testing detection of non-road, non-vehicle dynamic objects in cluttered indoor/outdoor spaces | Small mobility-platform scenes do not validate long-range road or airport-scale open-area performance |

## Metrics

| Metric | What to report | Why it matters |
|---|---|---|
| Moving IoU / IoU_MOS | IoU for the dynamic or moving class, per sequence and per distance band | The moving class is sparse; mean scores can hide missed dynamic actors |
| Static IoU / static preservation | IoU or precision for static points, with thin-structure breakdowns | Over-removing static points can damage localization maps and occupancy priors |
| Mean IoU / F1 | Class-balanced aggregate over static and dynamic labels | Useful for leaderboard comparison, but not sufficient for safety decisions |
| Dynamic precision and recall | False dynamic and missed dynamic rates, split by actor class where labels allow | Airside planners care more about missed moving GSE and people than a single aggregate |
| Latency and deadline misses | Mean, P95, P99 per scan on target hardware | A MOS mask that arrives late cannot protect mapping, tracking, or planning |
| Ego-motion sensitivity | Score under pose noise, timestamp offsets, and per-LiDAR extrinsic perturbations | Temporal residual MOS can degrade when localization is imperfect |
| Sensor-pattern robustness | Per-sensor scores before and after multi-LiDAR fusion | HeLiMOS shows why spinning and solid-state LiDAR cannot be assumed equivalent |

## Airside/Indoor/Outdoor Transfer

| Transfer path | Use public data for | Do not claim until validated locally |
|---|---|---|
| Outdoor road to airside | Algorithm bring-up, SemanticKITTI compatibility, moving vehicle and pedestrian masks | Aircraft, wing/tail sweep, belt-loader conveyors, dollies, chocks, cones, FOD, reflective markings, and jet-bridge occlusions |
| Heterogeneous LiDAR to airside | Per-sensor MOS behavior, solid-state scan-pattern failures, multi-LiDAR fusion policy | Final sensor placement and synchronized fused-cloud behavior on the target vehicle |
| Indoor/outdoor clutter to airside | Unusual moving objects and occlusion around ramps, stairs, corridors, and clutter | Open apron degeneracy, long flat concrete, aircraft-scale occluders, and weather/floodlighting |
| MOS to map cleaning | First-pass dynamic masks before SLAM or offline map cleaners | Permanent deletion from the localization map without multi-session evidence |

## Validation Guidance

1. Reproduce SemanticKITTI-MOS or LiDAR-MOS results first to verify data formatting, ego-motion compensation, and label remapping.
2. Run HeLiMOS per sensor, not only on a fused cloud. Treat large score differences across VLP-16, OS2-128, Livox, and Aeva-style patterns as deployment risks.
3. Add MOE and Dynablox to expose dense dynamic scenes and non-vehicle motion before tuning on private airside data.
4. For airside acceptance, label at least parked, starting-to-move, moving, and stopped-again states for GSE and aircraft-adjacent equipment. A single moving/static binary label is not enough for map lifecycle decisions.
5. Keep false-positive static erosion and false-negative dynamic leakage separate. False positives reduce map density; false negatives can put moving objects into maps or occupancy history.
6. Report MOS results alongside downstream effects: SLAM residuals, static-map ghost rate, tracker false tracks, and planner hard-brake events.

## Sources

- SemanticKITTI dataset and MOS task: https://semantic-kitti.org/index.html
- LiDAR-MOS repository: https://github.com/PRBonn/LiDAR-MOS
- LiDAR-MOS paper: https://arxiv.org/abs/2105.08971
- HeLiMOS dataset: https://sites.google.com/view/helimos/dataset
- HeLiMOS toolbox: https://github.com/url-kaist/HeLiMOS-PointCloud-Toolbox
- HeLiMOS paper: https://arxiv.org/abs/2408.06328
- MOE dataset: https://sites.google.com/view/moe-dataset
- MOE paper record: https://researchportal.hkust.edu.hk/en/publications/moe-a-dense-lidar-moving-event-dataset-detection-benchmark-and-le-2/
- Dynablox dataset: https://projects.asl.ethz.ch/datasets/dynablox/
- Dynablox repository: https://github.com/ethz-asl/dynablox
- Dynablox paper: https://arxiv.org/abs/2304.10049
