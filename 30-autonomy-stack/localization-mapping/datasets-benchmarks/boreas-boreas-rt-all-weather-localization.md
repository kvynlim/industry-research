# Boreas and Boreas-RT All-Weather Localization

**Last updated:** 2026-05-09

Boreas is a multi-season autonomous-driving dataset for evaluating localization and perception under repeated routes, seasonal change, rain, snow, night, and radar/LiDAR/camera variation. Boreas-RT extends the idea to more challenging routes and additional Doppler-capable sensors, making the pair one of the strongest public anchors for all-weather localization research.

**Related pages:** [SLAM benchmarking metrics and datasets](../slam-methods/benchmarking-metrics-datasets.md), [radar odometry and radar SLAM](../slam-methods/radar-odometry-radar-slam.md), [production LiDAR map localization](../overview/production-lidar-map-localization.md)

---

## Scope

| Item | Boreas | Boreas-RT |
|---|---|---|
| Primary domain | Repeated Toronto-area road route over 1 year | 9 real-world challenging routes |
| Scale | More than 350 km, 44 sequences | 60 sequences, 643 km |
| Conditions | Sun, cloud, rain, night, snow, seasons | Repeated routes with varying traffic and, on some routes, weather |
| Main benchmark | Odometry, metric localization, 3D object detection | Odometry and metric localization |
| Core question | Robust long-term localization across season/weather | Generalization beyond simple repeated routes |

Boreas is valuable because it combines repeated routes, radar, high-density LiDAR, camera, and centimeter-grade reference poses.

---

## Sensors And Labels

| Asset | Boreas notes |
|---|---|
| LiDAR | Velodyne Alpha Prime 128-channel 360-degree LiDAR |
| Radar | Navtech 360-degree scanning radar in Boreas; Boreas-RT uses a Doppler-enabled Navtech RAS6 |
| Camera | 5 MP FLIR Blackfly S camera |
| Ground truth | Post-processed Applanix POS LV GNSS/INS with centimeter-level accuracy |
| Additional Boreas-RT sensors | Aeva Aeries II FMCW Doppler-enabled LiDAR, IMU, and wheel encoder |
| 3D boxes | Boreas provides 3D object labels for a sunny-weather subset |
| Devkit | pyboreas supports data access, radar scans, pointcloud deskewing, Lie groups, and benchmark utilities |

The original Boreas paper reports 7.1k annotated object frames and 320k boxes for Boreas-Objects-V1.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Odometry | KITTI-style translational drift percent and rotational drift over 100-800 m segments |
| Metric localization | Absolute pose error, relocalization success, false accept rate, convergence time |
| Radar/LiDAR comparison | Same-sequence drift and localization availability by weather/season |
| 3D object detection | Per-class mAP where sunny labeled subset is used |
| Cross-route generalization | Boreas-RT route-level degradation and failure case rate |

For airside-style release decisions, report per-condition and per-route results rather than only a leaderboard mean.

---

## Best Use

Use Boreas and Boreas-RT to:

- compare radar, LiDAR, and camera localization under weather and season change;
- stress map aging across repeated routes;
- evaluate long-route odometry drift with centimeter-grade reference poses;
- validate metric localization leaderboards before private map-release tests;
- test whether methods overfit to simple urban loops and fail on harder routes.

Boreas is one of the strongest public datasets for radar-vs-LiDAR localization tradeoffs in adverse weather.

---

## Airside Transfer

Airports need localization that survives rain, snow, night, wet pavement, repeated geometry, and map aging. Boreas can shape:

- public B1 localization benchmark tiers before airport replay;
- radar fallback evaluation when LiDAR/camera degrade;
- map-age and route-repeat split design;
- false relocalization analysis on repeated structures.

Airside validation still needs private airport routes. Boreas road scenes lack open aprons, terminal overhang GNSS multipath, stand/gate aliasing, aircraft/GSE occlusion, cones/chocks, and operational no-go zones.

---

## Limitations

- Boreas is road-domain and not an airport map benchmark.
- 3D object labels are not available for all conditions; the labeled subset is sunny-weather focused.
- Spinning radar is excellent for localization but differs from sparse automotive 4D radar point-cloud detection.
- Strong GNSS/INS ground truth does not remove the need to validate GNSS-denied or multipath airport zones.
- Boreas-RT is a newer 2026 preprint-era extension; pin release versions for reproducible comparisons.

---

## Sources

- [Boreas official dataset site](https://www.boreas.utias.utoronto.ca/)
- [Boreas IJRR paper](https://journals.sagepub.com/doi/10.1177/02783649231160195)
- [Boreas arXiv paper](https://arxiv.org/abs/2203.10168)
- [Boreas-RT arXiv paper](https://arxiv.org/abs/2602.16870)
- [pyboreas devkit](https://github.com/utiasASRL/pyboreas)
- [Boreas AWS Open Data registry](https://registry.opendata.aws/boreas/)
