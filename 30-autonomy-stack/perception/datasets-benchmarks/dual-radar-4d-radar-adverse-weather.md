# Dual-Radar 4D Radar Adverse-Weather Dataset

**Last updated:** 2026-05-09

Dual-Radar is a 2025 Scientific Data dataset for comparing two different 4D radar point-cloud styles in the same driving scenes. It combines camera, LiDAR, Arbe Phoenix 4D radar, and Continental/Aumovio ARS548 RDI radar data, so it is especially useful for studying radar density, radar noise, and multimodal fusion under varied lighting and weather.

**Related pages:** [4D radar sensor overview](../../../20-av-platform/sensors/4d-radar.md), [View-of-Delft](view-of-delft-4d-radar.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md)

---

## Scope

| Item | Dual-Radar coverage |
|---|---|
| Primary domain | Road driving, including city and tunnel scenarios |
| Scale | 151 sequences, most about 20 seconds long |
| Annotated frames | 10,007 synchronized and annotated frames |
| Annotated objects | 103,272 high-quality annotated objects |
| Conditions | Sunny, cloudy, rainy/adverse weather, normal light, backlight, day, dusk, night |
| Core question | How different 4D radar point-cloud densities and noise levels affect detection and fusion |

The dataset is not just "radar plus LiDAR." Its differentiator is that Arbe Phoenix and ARS548 RDI observe the same scenes with different sparsity/noise characteristics.

---

## Sensors And Labels

| Asset | Notes |
|---|---|
| Camera | High-resolution front camera imagery |
| LiDAR | 80-line LiDAR point clouds |
| Arbe Phoenix 4D radar | Dense/noisier point cloud style |
| ARS548 RDI 4D radar | Sparser/longer-range point cloud style |
| Calibration | Separate folders and calibration files for LiDAR, Arbe, and ARS548 variants |
| Labels | KITTI-style 3D boxes with track IDs |

The GitHub statistics note that about two-thirds of the data is normal weather and about one-third is rainy/cloudy, with 577 rainy frames, about 5.5% of the dataset.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Radar-only 3D detection | KITTI-style 3D AP/BEV AP for car, pedestrian, and cyclist |
| Radar-LiDAR fusion | AP gain and failure cases compared with LiDAR-only and radar-only |
| Camera-radar fusion | AP and false positives in backlight, dusk, night, and rain |
| Tracking | Track continuity and ID switches where track IDs are used |
| Radar comparison | Same-scene performance difference between Arbe and ARS548 |

The public framework reports easy/moderate/hard AP tables with thresholds such as car 3D@0.5 and pedestrian/cyclist 3D@0.25.

---

## Best Use

Use Dual-Radar to:

- compare dense and sparse 4D radar behavior on identical scenes;
- test radar filtering before detection;
- validate radar-camera and radar-LiDAR fusion under rain, clouds, backlight, dusk, and night;
- quantify whether a method depends on one vendor-specific radar density;
- study tracking where radar Doppler and persistence help with sparse geometry.

For production radar decisions, Dual-Radar is more informative than single-radar datasets because it exposes sensor-specific tradeoffs under matched scenes.

---

## Airside Transfer

Airside sensor suites may combine different radar types around the vehicle: long-range front radar, short-range corner radar, and dense imaging radar. Dual-Radar helps design:

- radar-specific filtering and confidence models;
- fusion policies that do not assume all radars have the same point density;
- adverse-weather fallback tests where camera and LiDAR confidence fall;
- radar vendor selection experiments before collecting local airport data.

Airport transfer still requires apron-specific radar logs. Metallic aircraft, fuel trucks, tugs, dollies, baggage carts, jet bridges, wet tarmac, and blast fences will create different multipath and RCS patterns.

---

## Limitations

- The road/tunnel domain does not contain airport geometry or objects.
- Rainy frames are useful but still a minority slice.
- It covers front perception rather than full-vehicle airport surround perception.
- Radar point-cloud preprocessing is sensor-specific; results may not transfer cleanly to raw tensor radar products.
- The public benchmark emphasizes 3D detection and tracking, not freespace, FOD, or map localization.

---

## Sources

- [Dual-Radar Scientific Data article](https://www.nature.com/articles/s41597-025-04698-2)
- [Dual-Radar GitHub repository](https://github.com/adept-thu/Dual-Radar)
- [Dual-Radar DOAJ metadata](https://doaj.org/article/d8964831faba4c5aa89eea19b8b17963)
