# Seeing Through Fog / DENSE

**Last updated:** 2026-05-09

Seeing Through Fog is the object-detection dataset from the DENSE adverse-weather perception project. It is a multimodal benchmark for fog, snow, rain, and controlled fog-chamber conditions, with visible, NIR, FIR, radar, and LiDAR sensing. It is one of the best public datasets for studying asymmetric sensor failure in fog and steam-like aerosols.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

Seeing Through Fog measures object detection and multimodal sensor fusion in adverse weather. The Princeton dataset page describes 12,000 real-world samples, 1,500 controlled fog-chamber samples, more than 10,000 km of driving in northern Europe, and about 100,000 labeled objects.

The dataset was designed to test whether models can learn robust redundancy between sensors when only some modalities are degraded by weather.

---

## Sensors And Modalities

| Modality | Notes |
|---|---|
| RGB stereo cameras | Left/right stereo imagery, raw and tone-mapped annotation views |
| Gated NIR camera | Multiple gated slices and accumulated gated images |
| FIR camera | Far-infrared reference camera |
| Radar | Radar target point cloud |
| LiDAR | Velodyne HDL64-S3D strongest/last echo and VLP32 strongest/last echo |
| Weather station | Temperature, humidity, dew point, and related metadata |
| Road friction | Road-friction measurements |
| CAN data | Wiper state, speed, and other vehicle signals |
| Calibration | ROS-style extrinsic transform tree |

This sensor range is broader than most public AV datasets and is especially valuable for fog because optical, NIR, FIR, radar, and LiDAR do not fail the same way.

---

## Labels And Tasks

| Label type | Use |
|---|---|
| 2D and 3D object annotations | Detection in adverse weather |
| KITTI-style annotation format | Reuse existing detection tooling |
| Weather, road-state, and illumination tags | Weather-stratified evaluation |
| Object classes | PassengerCars, Pedestrians, RidableVehicles, LargeVehicles, Vehicle fallback, Obstacle fallback |
| Recommended splits | Reproducible benchmark comparison |

The GitHub documentation also provides tools for visualization, TFRecord creation, simple fog simulation for LiDAR/RGB, and dataset statistics.

---

## Weather And Environment

The dataset includes fog, snow, rain, different illumination conditions, and controlled fog-chamber recordings. It also includes videos/examples for dense fog, heavy snowfall, snow dust, and fog-chamber scenes.

For airside work, dense fog and snow dust are useful proxies for steam-like aerosol and low-visibility particle clouds. However, the physics of heated exhaust, de-icing mist, and dust can differ from fog and snow.

---

## Benchmark Use For Perception And Removal

Use Seeing Through Fog/DENSE to validate:

- multimodal fusion under unknown adverse weather;
- fog-aware object detection;
- gated NIR and FIR value in low visibility;
- radar/LiDAR/camera confidence gating;
- whether artifact removal improves detection or only makes point clouds look cleaner;
- robustness when one sensor fails asymmetrically.

For LiDAR artifact removal, pair this dataset with a downstream detector. The strongest signal is whether removing fog/snow artifacts improves detection and fusion without hurting clear-weather or single-modality performance.

---

## Strengths

- Broad multimodal sensor suite across visible, mmWave, NIR, FIR, and LiDAR.
- Real-world adverse weather plus controlled fog-chamber samples.
- Weather, road-state, and illumination tags enable stratified evaluation.
- 2D/3D object annotations support downstream detection metrics.
- Built specifically around asymmetric sensor failure and fusion.

---

## Limitations

- It provides object boxes, not dense point-wise weather artifact labels.
- Access requires registration and large downloads.
- Road object classes do not match airside object taxonomies.
- Fog and snow dust are only partial proxies for steam, dust, and de-icing aerosols.
- Sensor setup is research-grade and may not match production airside hardware.

---

## Airside Transfer

Seeing Through Fog/DENSE is the public benchmark to use before claiming fog or steam robustness. Airside transfer checks should include:

- perception performance in dense fog before and after LiDAR filtering;
- whether radar/gated/FIR channels maintain detections when RGB and LiDAR degrade;
- confidence-gated fusion rather than fixed sensor weights;
- false positives caused by fog/snow dust near the ground plane;
- performance on fallback labels when object class is ambiguous.

It does not remove the need for apron fog, glycol mist, jet exhaust, and dust data. Use it to screen fusion approaches, then validate with airside recordings.

---

## Sources

- [Seeing Through Fog GitHub repository](https://github.com/princeton-computational-imaging/SeeingThroughFog)
- [Princeton automotive datasets page](https://light.princeton.edu/datasets/automated_driving_dataset/)
- [DENSE datasets page, University of Ulm](https://www.uni-ulm.de/en/in/institute-of-measurement-control-and-microtechnology/research/data-sets/dense-datasets/)
