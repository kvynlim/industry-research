# Moved-Object and Map-Change Datasets

**Last updated:** 2026-05-09

## Why It Matters

Map-change detection decides whether the world has changed enough to invalidate a map, trigger a survey, quarantine a tile, or update a route. Moved-object detection is a related but lower-level problem: identify added, removed, or displaced geometry between observations. Both matter for airside autonomy because temporary barriers, parked GSE, aircraft position, construction, lane/stand markings, and FOD can all create discrepancies between the production map and the current apron.

The datasets below cover outdoor HD-map changes, indoor object rearrangement, street-level point-cloud change, simulated stereo V-SLAM change, and urban point-cloud change. They are best used as complementary proxies.

## Dataset/Benchmark Table

| Dataset / benchmark | Source URL | Domain and sensors | Labels / task | Best use | Main transfer risk |
|---|---|---|---|---|---|
| Argoverse 2 Map Change / Trust but Verify (TbV) | https://www.argoverse.org/av2.html | Outdoor AV logs from six U.S. cities with ring cameras, LiDAR, ego pose, and HD maps | Temporal labels indicate whether a map change is within 30 m of the AV; 1,000 scenarios with 200 real-world HD-map changes | HD-map freshness, lane/crosswalk/marking discrepancy detection, map-conditioned perception | Road lane changes do not cover apron stand markings, temporary closures, aircraft/GSE occupancy, or FOD |
| 3RScan | https://github.com/WaldJohannaU/3RScan | Naturally changing indoor RGB-D environments, textured meshes, camera poses, semantic instances | 1,482 reconstructions of 478 environments with object-level alignment and changed-object transforms | Moved-object relocalization, object-level change, indoor long-term SLAM | Indoor furniture/object changes are useful for reasoning but not for outdoor geodetic maps |
| 3DCDNet / SLPCCD | https://github.com/wangle53/3DCDNet | Street-level point-cloud change detection derived from SHREC 2021 | Point-based changed/unchanged learning benchmark with downloadable SLPCCD data | Street-scene point-cloud change segmentation and neural baseline comparison | Street point clouds differ from apron geometry, sensor motion, and map-update policy |
| PPCA-VINS | https://lnexenl.github.io/PPCA-VINS/ | Unreal Engine environments, stereo cameras, IMU, ground-truth pose, prior point clouds | Added and removed building point clouds, V-SLAM based point-cloud change detection metrics and baseline | Low-cost camera/IMU change detection and controlled ablation for lighting/mirrors | Synthetic buildings and noiseless sensors require real-world validation before map operations use |
| Urb3DCD | https://github.com/JorgesNofulla/Point-Cloud-Urban-Change-detection | Simulated urban 3D point clouds for change detection and categorization | Bi-temporal urban point-cloud change classes and benchmark scripts | Urban-scale multiclass change detection, synthetic-to-real experiments, point-level mIoU | Aerial/urban simulation does not capture apron operations or sensor placement on AGVS/GSE |

## Metrics

| Metric | Applies to | What to report |
|---|---|---|
| Frame/event precision and recall | Argoverse 2 Map Change, airside map-change alerts | Alert quality for "map stale near vehicle" at frame and scenario level |
| F1 / AUROC / PR-AUC | Binary map-change or changed-point detection | Class-imbalance-resistant summary with operating threshold |
| Point-level IoU / mIoU | SLPCCD, Urb3DCD, PPCA-VINS, custom point-cloud change | Per-class changed/unchanged or added/removed/moved IoU |
| Added/removed/moved breakdown | 3RScan, PPCA-VINS, airside map lifecycle | Separate new object, missing object, displaced object, and geometry deformation |
| Object pose error | 3RScan-style moved objects | Translation, rotation, and correspondence success for moved objects |
| Distance-to-change | HD map and airside validation | Distance from detected alert region to ground-truth changed geometry or map element |
| Localization impact | Map operations | Scan-to-map residual, false relocalization, covariance, and route-level acceptance before and after a change |
| Time-to-detect | Fleet operations | Number of passes, frames, or hours before a persistent map change is flagged |

## Airside/Indoor/Outdoor Transfer

| Source domain | Useful transfer | Airside gap |
|---|---|---|
| AV2 / TbV outdoor roads | HD-map staleness framing, sensor-map cross-checking, temporal alert labels | Airport stand markings, closed areas, temporary cones/barriers, and aircraft/GSE objects are not represented |
| 3RScan indoor | Object moved/removed/added reasoning, instance consistency across rescans | No GNSS/INS, no outdoor weather, no vehicle-scale geodetic map |
| Street-level point clouds | Point-level changed geometry segmentation | Road furniture and building facades differ from apron surfaces and ground equipment |
| Synthetic V-SLAM | Controlled ablations for illumination, mirrors, and sensor cost | Simulator realism, no airport physics, and no operational traffic |
| Urban simulated change | Multiclass point-change pipelines and pretraining | Must be retuned for apron object taxonomy and map-layer semantics |

## Validation Guidance

1. Separate map-change detection from map update. A high-confidence alert should quarantine or request review before modifying a production map.
2. Use AV2/TbV to validate HD-map discrepancy models, but build an airside label set for stand markings, stop bars, service roads, aircraft safety envelopes, temporary work zones, and blocked routes.
3. Use 3RScan-style object alignment ideas for moved GSE and equipment, but add large-object partial observations such as aircraft tails, wings, belt loaders, and buses.
4. Report "changed but safe" and "changed and safety-critical" separately. A new painted line and a newly parked aircraft should not have the same operational priority.
5. Validate change persistence across multiple passes, shifts, weather states, and viewpoints before promoting a change into the static map.
6. Track false positives per km and per stand. A fleet map operation that floods reviewers with harmless alerts will fail operationally even if recall is high.

## Sources

- Argoverse 2 dataset overview and Map Change Dataset: https://www.argoverse.org/av2.html
- Argoverse TbV user guide: https://argoverse.github.io/user-guide/datasets/map_change_detection.html
- Trust, but Verify paper: https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/file/2b8a61594b1f4c4db0902a8a395ced93-Paper-round2.pdf
- 3RScan toolkit: https://github.com/WaldJohannaU/3RScan
- RIO / 3RScan paper: https://arxiv.org/abs/1908.06109
- Objects Can Move paper using 3RScan: https://arxiv.org/abs/2208.09870
- 3DCDNet / SLPCCD repository: https://github.com/wangle53/3DCDNet
- SLPCCD source paper DOI: https://doi.org/10.1109/TGRS.2023.3295386
- PPCA-VINS project: https://lnexenl.github.io/PPCA-VINS/
- PPCA-VINS paper: https://arxiv.org/abs/2207.00246
- Urb3DCD change-detection repository: https://github.com/JorgesNofulla/Point-Cloud-Urban-Change-detection
- DC3DCD paper using simulated and real public 3D change datasets: https://arxiv.org/abs/2305.05421
