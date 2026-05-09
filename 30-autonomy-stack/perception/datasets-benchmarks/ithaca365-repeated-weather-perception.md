# Ithaca365 Repeated-Weather Perception

**Last updated:** 2026-05-09

Ithaca365 is a Cornell autonomous-driving dataset built around repeated traversals of the same 15 km route in different weather, lighting, traffic, and scene contexts. Its main value is not just adverse weather, but correspondence: the same places are observed across snow, rain, sun, day, night, urban, highway, rural, and campus segments.

**Related pages:** [weather robustness datasets](weather-robustness-datasets.md), [sensor corruption robustness benchmarks](sensor-corruption-robustness-benchmarks.md), [production perception systems](../overview/production-perception-systems.md)

---

## Scope

| Item | Ithaca365 coverage |
|---|---|
| Primary domain | Public-road driving around Ithaca, New York |
| Route structure | Repeated 15 km loop with campus, downtown, highway, urban, residential, and rural areas |
| Conditions | Snow, rain, sun, day, night, different traffic levels |
| Scale | 40 collections/traversals, 7000 annotated frames, full release about 10 TB |
| Core question | How perception degrades when the route is fixed but weather, time, and traffic change |

The repeated route design makes Ithaca365 more useful than a simple "snow dataset" for evaluating route-specific robustness, continual learning, object discovery, and anomaly detection.

---

## Sensors And Labels

| Asset | Notes |
|---|---|
| Cameras | Four camera views; amodal instance labels are on the leftmost front-facing camera |
| LiDAR | Point clouds used for 3D boxes and BEV road labeling |
| GPS/INS | High-precision pose source used to align observations across traversals |
| Amodal instance masks | Visible and occluded instance masks plus occlusion ordering |
| Amodal road masks | BEV road polygons projected back into image/depth masks |
| 2D and 3D boxes | Objects labeled in camera and LiDAR frames |

Foreground labels cover road actors such as cars, buses, trucks, pedestrians, bicyclists, and motorcyclists.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Amodal instance segmentation | Mask AP, visible-vs-amodal mask IoU, occlusion-order errors |
| Amodal road segmentation | Road IoU, boundary F-score, false-free-space near road edge |
| Depth estimation | AbsRel, RMSE, weather/time-conditioned error |
| 3D object detection | 3D AP/BEV AP by class and condition |
| Cross-traversal robustness | Score drop from clear/day reference to rain, snow, and night repeats |

For validation, report by route segment and condition rather than only aggregate score. The useful signal is whether the same detector behaves differently at the same location when snowbanks, wet roads, darkness, or different traffic appear.

---

## Best Use

Use Ithaca365 to test:

- same-route perception degradation under weather and lighting change;
- route-aware continual learning without forgetting clear-weather behavior;
- amodal segmentation under partial occlusion by traffic or snow;
- anomaly and object-discovery methods that need repeated observations of the same place;
- map/perception consistency checks where GPS/INS alignment lets observations be compared across traversals.

It is a good pre-airport proxy for "route repeats across shifts," which is exactly the shape of depot, apron, and service-road validation.

---

## Airside Transfer

Airport apron operations have repeated routes, repeated stands, and recurring traffic patterns. Ithaca365 is useful for designing public-data smoke tests before collecting airport data:

- compare the same route across weather/time before comparing the same stand across shifts;
- measure whether a detector overfits to a clear reference pass;
- evaluate amodal reasoning where vehicles, people, snow, and occluders hide road or object extent;
- prototype route-indexed validation dashboards that later use airport map tiles.

For airside release, replace road classes with aircraft, belt loaders, tugs, dollies, carts, cones, chocks, personnel, and FOD. Ithaca365 does not cover apron markings, jet bridges, wing/tail occlusions, or de-icing spray.

---

## Limitations

- Road-domain classes and geometry do not match airport ramps.
- LiDAR/camera data are the focus; there is no radar modality.
- The annotated set is much smaller than the full raw traversal release.
- Snow, rain, and night are useful, but not a complete weather envelope for fog, glycol, spray, steam, or wet-apron glare.
- It is not an official SLAM benchmark, even though the repeated route and GPS/INS are useful for localization experiments.

---

## Sources

- [Ithaca365 official project page](https://ithaca365.mae.cornell.edu/)
- [Ithaca365 arXiv paper](https://arxiv.org/abs/2208.01166)
- [Ithaca365 CVPR 2022 paper PDF](https://openaccess.thecvf.com/content/CVPR2022/papers/Diaz-Ruiz_Ithaca365_Dataset_and_Driving_Perception_Under_Repeated_and_Challenging_Weather_CVPR_2022_paper.pdf)
- [Ithaca365 devkit](https://github.com/cdiazruiz/ithaca365-devkit)
