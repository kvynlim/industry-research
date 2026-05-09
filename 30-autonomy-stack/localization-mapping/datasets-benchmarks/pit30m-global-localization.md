# Pit30M Global Localization

**Last updated:** 2026-05-09

Pit30M, now released through Aurora as the Aurora Multi-Sensor Dataset, is a large-scale benchmark for city-scale retrieval-based global localization. It is important because it asks whether image and LiDAR retrieval can support sub-meter localization at the scale and diversity required by self-driving vehicles.

**Related pages:** [SLAM benchmarking metrics and datasets](../slam-methods/benchmarking-metrics-datasets.md), [LiDAR place recognition and relocalization](../overview/lidar-place-recognition-relocalization.md), [production LiDAR map localization](../overview/production-lidar-map-localization.md)

---

## Scope

| Item | Pit30M coverage |
|---|---|
| Primary domain | Pittsburgh metropolitan road driving |
| Scale | More than 30 million image/LiDAR frames |
| Time span | Captured between January 2017 and February 2018 |
| Conditions | Seasons, weather, time of day, traffic, and occlusion variation |
| Main use | Sub-meter retrieval-based global localization at city scale |
| Data access | Public AWS Open Data S3 bucket under non-commercial academic terms |

Pit30M is a relocalization benchmark, not just an odometry dataset. It is intended to test whether a system can retrieve the correct place under large-scale long-term variation.

---

## Sensors And Metadata

| Asset | Notes |
|---|---|
| Cameras | Seven 1920 x 1200 cameras, including a forward stereo pair and five wide-angle cameras for 360-degree coverage |
| LiDAR | 64-beam Velodyne HDL-64E point clouds |
| Localization ground truth | Accurate vehicle localization ground truth from the collection platform |
| Weather metadata | Historical weather annotations |
| Astronomical metadata | Time-of-day and sun-related metadata |
| Semantic segmentation | Image and LiDAR semantic segmentation used as a proxy for occlusion |
| SDK | Python package and log-based readers |

The semantic and weather metadata make Pit30M useful for stratified localization analysis: a failed retrieval can be related to occlusion, weather, season, or traffic rather than treated as a single error.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Image retrieval localization | Recall@K within 1 m, 5 m, and 10 m; median and P95 position error |
| LiDAR retrieval localization | Recall@K, false-place matches, distance-to-nearest true match |
| Cross-condition relocalization | Recall by season, weather, time of day, and occlusion proxy |
| Map age robustness | Performance as database/query dates separate |
| Startup recovery | Time or frames needed to accept a correct global pose |

For production use, report false accepts separately from missed localization. A missed match can trigger relocalization; a confident wrong place can corrupt routing and geofence logic.

---

## Best Use

Use Pit30M to:

- benchmark place-recognition descriptors at city scale;
- compare image-only, LiDAR-only, and cross-modal retrieval;
- test long-term map aging and appearance change;
- evaluate relocalization under traffic occlusion and weather metadata;
- separate global localization metrics from local odometry metrics.

It is a strong public anchor before building an airport-specific relocalization benchmark with repeated stands, service roads, depot routes, and terminal-side aliasing.

---

## Airside Transfer

Airport autonomy has strong global-localization needs: startup at a depot, recovery after tow, route handoff between map tiles, and relocalization near visually similar gates. Pit30M can inform:

- retrieval recall and false-accept thresholds;
- map-age reporting by date and condition;
- occlusion-aware evaluation where parked aircraft or GSE block landmarks;
- database/query split design for repeated airport routes.

Airport transfer is not direct. Road-scale Pittsburgh data lacks repeated gate geometry, aircraft occlusion, apron markings, GSE clutter, terminal overhangs, and airport geofencing rules.

---

## Limitations

- It benchmarks retrieval-based localization more than full online SLAM.
- The dataset is very large and requires careful storage/streaming strategy.
- It is road-domain data, not airside or industrial-yard data.
- Sensor and calibration assumptions may differ from a production airport vehicle.
- License terms are non-commercial academic; review terms before commercial use.

---

## Sources

- [Pit30M arXiv paper](https://arxiv.org/abs/2012.12437)
- [Pit30M/Aurora Multi-Sensor Dataset on AWS Open Data](https://registry.opendata.aws/aurora_msds)
- [Pit30M Python SDK](https://github.com/pit30m/pit30m)
- [Pit30M project site](https://pit30m.github.io/)
