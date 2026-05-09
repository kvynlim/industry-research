# SemanticSpray++

**Last updated:** 2026-05-09

SemanticSpray++ is a multimodal wet-surface dataset for autonomous driving. It focuses on highway-like road-spray and wet-road conditions with camera, LiDAR, and radar labels, making it one of the best public proxies for spray-induced perception degradation.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

SemanticSpray++ measures perception in wet-surface driving where spray and road moisture degrade camera and LiDAR while radar remains useful. The project page states that the dataset includes scenes captured by camera, LiDAR, and radar, with labels for all three modalities.

For removal validation, the key use is testing whether a filter can remove spray-like LiDAR clutter without harming vehicles and road geometry, and whether radar labels can support a weather-resilient fallback.

---

## Sensors And Modalities

| Modality | Sensor/setup |
|---|---|
| Camera | 1 front camera |
| Top LiDAR | 1 Velodyne VLP32C |
| Low-resolution LiDAR | 2 Ibeo LUX 2010 units, front and rear |
| Radar | 1 Aptiv ESR 2.5 radar |
| Ego pose | `poses.txt`, following SemanticKITTI convention |
| Scene metadata | `metadata.txt`, including fields such as ego velocity |

---

## Labels And Tasks

| Label type | Folder/format notes | Use |
|---|---|---|
| Camera 2D boxes | `object_labels/camera` JSON | Camera object detection under spray |
| LiDAR 3D boxes | `object_labels/lidar` JSON | 3D object detection under wet-surface effects |
| LiDAR semantic labels | `labels` | Spray/weather semantic analysis in point clouds |
| Radar semantic labels | `radar_labels` NPY | Radar-target semantic evaluation |
| Raw sensor data | `image_2`, `velodyne`, `ibeo_front`, `ibeo_rear`, `delphi_radar` | Multimodal fusion and degradation studies |

The dataset supports label-efficient LiDAR semantic segmentation, adverse-weather effect detection in LiDAR data, and LiDAR/radar fusion for rainy conditions.

---

## Weather And Environment

SemanticSpray++ focuses on wet surface conditions in highway-like scenarios. It is less about falling rainfall measurement and more about spray and wet-road interaction at speed.

That distinction matters for airside work: road spray is closer to tire spray, runway/apron water plume, and some de-icing overspray effects than a generic rain dataset, but it is still not chemically or thermally equivalent to glycol mist or engine steam.

---

## Benchmark Use For Perception And Removal

Use SemanticSpray++ to validate:

- LiDAR spray/noise filtering in wet-surface scenarios;
- camera and LiDAR object detection under spray;
- radar semantic robustness when optical sensors degrade;
- fusion methods that combine LiDAR boxes with radar labels;
- speed-dependent spray effects using metadata.

A strong removal benchmark should compare raw LiDAR, filtered LiDAR, radar-only, and fused outputs. The goal is not simply to remove spray points; it is to improve object detection while keeping small and low-reflectivity obstacles intact.

---

## Strengths

- Multimodal labels across camera, LiDAR, and radar.
- Explicitly targets wet-surface adverse conditions.
- Includes radar semantic labels, which are rare.
- Provides raw data, labels, ego poses, and metadata.
- Useful for validating radar-LiDAR disagreement under spray.

---

## Limitations

- Highway-like scenes do not match airport-apron geometry.
- Spray conditions are road-surface driven, not de-icing fluid or steam.
- Radar is Aptiv ESR 2.5, not modern high-density 4D imaging radar.
- Object taxonomy is road-focused.
- It is not a measured rain-intensity dataset; pair it with RainSense for rain-rate thresholds.

---

## Airside Transfer

SemanticSpray++ is the best public starting point for apron spray and wet-pavement robustness. Use it to test:

- spray-clutter removal around moving vehicles;
- radar/LiDAR fusion when LiDAR sees water artifacts;
- wet-surface false positives near the ground plane;
- high-speed water plume effects as a proxy for runway spray.

For de-icing trucks, glycol mist, aircraft wash, and heated steam, public-road spray is only a partial proxy. Collect airport-specific sensor recordings before production validation.

---

## Sources

- [SemanticSpray project page](https://semantic-spray-dataset.github.io/)
- [SemanticSpray++ arXiv paper](https://arxiv.org/abs/2406.09945)
