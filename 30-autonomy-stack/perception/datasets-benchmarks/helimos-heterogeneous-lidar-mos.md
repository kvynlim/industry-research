# HeLiMOS Heterogeneous LiDAR MOS

**Last updated:** 2026-05-09

## Why It Matters

Most LiDAR MOS work was built around mechanically spinning automotive LiDAR. HeLiMOS is important because it tests moving object segmentation across four heterogeneous LiDAR sensors, including solid-state sensors with irregular scan patterns.

That makes it a strong proxy for airside vehicles using mixed LiDAR suites. It is still an urban-campus benchmark, not an airport apron benchmark.

## Dataset Snapshot

| Field | HeLiMOS detail | Practical note |
|---|---|---|
| Paper | IROS 2024 dataset for MOS in 3D point clouds from heterogeneous LiDAR sensors | Use as a sensor-transfer benchmark |
| Base data | KAIST05 sequence from the HeLiPR dataset | Single route/sequence family, repeated urban locations |
| Sensors | Velodyne VLP-16, Ouster OS2-128, Livox Avia, Aeva Aeries II | Two spinning omnidirectional sensors and two solid-state sensors |
| Dynamic actors | Buses, pedestrians, bicyclists, cars, and other urban moving objects | Good for sensor pattern effects, limited for GSE and aircraft |
| Labels | SemanticKITTI-MOS-style `unlabeled`, `static`, `dynamic` | Easy to adapt existing MOS loaders |
| Size | 12,188 labeled point clouds on the public site | Large enough for per-sensor evaluation |
| Download | KAIST05 IROS 2024 zip, listed as 35 GB and 48 GB decompressed | Plan storage and data governance up front |
| Point clouds | Deskewed point clouds are provided | Reduces one source of temporal label noise |

## Sensor Transfer Matrix

| Sensor | Pattern | What it tests | Airside lesson |
|---|---|---|---|
| Velodyne VLP-16 | Low-channel spinning | Sparse conventional LiDAR | Low-density edge cases near cones, legs, tow bars, and distant GSE |
| Ouster OS2-128 | High-channel spinning | Dense conventional LiDAR | Strong reference sensor for static/dynamic separation |
| Livox Avia | Solid-state irregular | Non-repetitive field coverage | Range-image MOS assumptions can break on irregular scans |
| Aeva Aeries II | FMCW solid-state | Solid-state scan pattern with velocity-capable sensor family | Check whether the deployed stack uses raw point patterns, velocity, or both |

## Tasks and Metrics

| Task | Metric | Use |
|---|---|---|
| Moving object segmentation | Intersection-over-Union for static and dynamic MOS labels | Compare MOS methods across sensors |
| Sensor generalization | Per-sensor mIoU before fused averages | Expose scan-pattern dependence |
| Cross-training | Train on SemanticKITTI or HeLiMOS and evaluate per sensor | Separate road-data generalization from sensor adaptation |
| Static map building | Preservation rate, rejection rate, and F1 score | Bridge MOS masks into map-cleaning decisions |
| Qualitative review | Per-sensor dynamic masks on the same scene | Find geometry failures hidden by aggregate metrics |

## Labeling and Tooling

| Component | Source detail | Why it matters |
|---|---|---|
| Automatic labeling | Paper describes instance-aware static map building and tracking-based false-label filtering | Reduces manual labeling burden but is not a perfect oracle |
| Site tooling | HeLiMOS site notes ERASOR2 + TOSS for the automatic labeling pipeline | Important for understanding label biases |
| Toolbox saver | Deskews and saves individual LiDAR and pose data in HeLiMOS format | Useful when adapting private multi-LiDAR logs |
| Toolbox merger | Synchronizes and merges individual LiDAR data into one cloud | Supports multi-sensor label propagation |
| Toolbox propagator | Backpropagates labels from merged clouds to individual clouds | Enables per-sensor MOS evaluation |

## Comparison With Other MOS Data

| Dataset | What HeLiMOS adds | Remaining gap |
|---|---|---|
| SemanticKITTI-MOS | Heterogeneous sensors and solid-state patterns | Less benchmark history and one core HeLiPR sequence |
| LiDAR-MOS / LMNet | Sensor-transfer stress test for range-view residual methods | Does not solve semantic class or map lifecycle policy |
| MOE | Sensor-pattern generalization rather than dense moving-event scenes | MOE-style MED latency and competition split are separate |
| KTH map cleaning | Per-point MOS labels that can feed static map building | Map-level PR/RR still needs accumulated maps |

## Airside Transfer

| Airside question | Use HeLiMOS for | Still collect locally |
|---|---|---|
| Which LiDAR pattern fails first? | Per-sensor MOS degradation across spinning and solid-state LiDAR | Actual mounted sensors, extrinsics, vibration, and apron ranges |
| Should MOS run per sensor or fused? | Compare single-sensor labels and merged-cloud behavior | Multi-LiDAR synchronization and blind zones on the vehicle |
| Can road-trained MOS generalize? | Test SemanticKITTI-trained baselines on HeLiMOS | Aircraft, GSE, cones, chocks, FOD, reflective markings, and wet concrete |
| Can MOS help map cleaning? | Use static-map metrics from the HeLiMOS task page | Permanent vs movable-static map layer decisions |

## Validation Guidance

1. Report per-sensor results before any fused average.
2. Keep sensor model, mount pose, deskewing status, and timestamp policy in the benchmark artifact.
3. Compare range-view, BEV, point-based, and 4D sparse methods because scan-pattern sensitivity differs by representation.
4. Use HeLiMOS labels to stress sensor transfer, then use local apron data to stress object taxonomy and low-speed motion.
5. For map cleaning, track both dynamic rejection and static preservation; MOS IoU alone does not prove map safety.
6. Audit automatic labels around stopped or starting objects, because tracking-based cleanup can encode assumptions about motion history.

## Sources

- HeLiMOS paper: https://arxiv.org/abs/2408.06328
- HeLiMOS dataset page: https://sites.google.com/view/helimos/dataset
- HeLiMOS tasks page: https://sites.google.com/view/helimos/tasks
- HeLiMOS download page: https://sites.google.com/view/helimos/download
- HeLiMOS tools page: https://sites.google.com/view/helimos/tools-codes
- HeLiMOS point-cloud toolbox: https://github.com/url-kaist/HeLiMOS-PointCloud-Toolbox
- Local context: `30-autonomy-stack/perception/datasets-benchmarks/moving-static-separation-mos-datasets.md`
