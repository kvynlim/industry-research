# RADIATE

**Last updated:** 2026-05-09

RADIATE is a radar-centered adverse-weather automotive perception dataset from Heriot-Watt University. It is useful for validating radar-first object detection, sensor fusion, and fallback behavior when camera and LiDAR degrade in fog, snow, rain, or night conditions.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

RADIATE measures automotive perception with high-resolution scanning radar in adverse weather. The project page describes about 3 hours of annotated radar images and more than 200,000 labeled instances on public roads. The arXiv abstract reports an average of about 4.6 instances per radar image and 8 road-actor categories.

The dataset is particularly important because it treats radar as the primary weather-robust modality instead of an auxiliary sensor.

---

## Sensors And Modalities

| Modality | Sensor/details |
|---|---|
| Radar | Navtech CTS350-X scanning radar, 360-degree range-azimuth images, 4 Hz, 100 m range |
| Stereo camera | ZED stereo camera, 672 x 376, 15 FPS, waterproof housing |
| LiDAR | Velodyne HDL-32e, 10 Hz, 360-degree coverage |
| GPS/IMU | Advanced Navigation Spatial Dual |
| Calibration | Radar chosen as local coordinate origin; extrinsics provided in SDK config |

The documentation notes that radar images are provided in both Cartesian and polar forms, while LiDAR point clouds are stored with x, y, z, intensity, and ring.

---

## Labels And Tasks

| Label type | Use |
|---|---|
| Radar-image bounding boxes | Radar object detection and tracking |
| 8 actor categories | Car, van, truck, bus, motorbike, bicycle, pedestrian, group of pedestrians |
| Sensor calibration | Camera/radar/LiDAR fusion |
| Scenario tags | Weather and scenario-specific evaluation |
| SDK and pretrained models | Baseline radar perception workflows |

RADIATE supports object detection, tracking, scene understanding, SLAM, localization, and adverse-weather sensor fusion.

---

## Weather And Environment

The dataset documentation lists 7 scenarios:

- sunny parked;
- sunny/overcast urban;
- overcast motorway;
- night motorway;
- rain suburban;
- fog suburban;
- snow suburban.

The documentation also warns that camera images may be blurred, hazy, or blocked by rain drops, fog, or heavy snow, and that LiDAR can be missing, noisy, or incorrect in extreme weather. These notes are useful for validating asymmetric sensor degradation.

---

## Benchmark Use For Perception And Removal

Use RADIATE to validate:

- radar-only object detection under adverse weather;
- radar-to-camera and radar-to-LiDAR fusion;
- perception fallback when LiDAR and camera confidence drop;
- weather-specific tracking stability;
- radar map/localization behavior in fog and snow.

For LiDAR removal, RADIATE is mostly a downstream/fusion benchmark. It does not provide point-wise artifact labels, but it can show whether filtered LiDAR improves or harms fusion relative to a radar baseline.

---

## Strengths

- Radar-centered design with adverse-weather scenes.
- Includes rain, fog, snow, night, and clear/overcast baselines.
- Public SDK and calibration support fusion research.
- More than 200,000 labeled radar instances.
- Useful when validating radar as an operational fallback.

---

## Limitations

- Radar labels are 2D boxes on radar images, not dense 3D object boxes.
- Navtech scanning radar has no Doppler in this dataset, unlike modern 4D automotive radar.
- LiDAR and camera labels are not the primary annotation target.
- Weather range is useful but not airside-specific.
- Dust, steam, de-icing spray, and jet blast are not directly covered.

---

## Airside Transfer

RADIATE should be part of any airside all-weather validation plan because radar is the most credible fallback during fog, rain, snow, and spray. Use it to:

- benchmark radar detection before adding LiDAR;
- test fusion gating when camera/LiDAR degrade;
- compare radar scene understanding across fog and snow;
- validate that the system does not over-trust a degraded LiDAR channel.

For airside transfer, remember that airport objects differ strongly from road actors. Radar signatures for aircraft, belt loaders, tugs, baggage carts, and jet bridges must be collected separately.

---

## Sources

- [RADIATE project page](https://pro.hw.ac.uk/radiate/)
- [RADIATE dataset documentation](https://pro.hw.ac.uk/radiate/doc/dataset/)
- [RADIATE arXiv paper](https://arxiv.org/abs/2010.09076)
