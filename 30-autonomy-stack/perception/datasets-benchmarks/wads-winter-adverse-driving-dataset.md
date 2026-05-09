# WADS: Winter Adverse Driving Dataset

**Last updated:** 2026-05-09

WADS is a Michigan Tech winter-driving dataset focused on severe snow, whiteout-like visibility loss, and LiDAR snow artifacts. It is one of the most useful public datasets for validating falling-snow removal because its released labeled subset includes dense point-wise LiDAR annotations with explicit active-snow and accumulated-snow classes.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

WADS measures how severe winter weather changes autonomous-driving sensor data. The useful signal for removal validation is the separation between:

- active falling snow, which appears as transient LiDAR clutter and near-field false returns;
- accumulated snow, which changes ground/curb/roadside geometry and can break ground removal or localization;
- normal semantic road-scene classes, which must be preserved after filtering.

The Michigan Tech publication record describes three winter seasons of collection, more than 36 TB of adverse winter data, and a labeled LiDAR subset of around 1000 sequential scenes totaling more than 7 GB and 3.6 billion labeled points. The WADS sequence-26 data page describes the released sequence as SemanticKITTI-format labels with all SemanticKITTI classes plus falling and accumulated snow.

---

## Sensors And Modalities

| Modality | Notes |
|---|---|
| High-resolution LiDAR | Primary source for dense point labels and snow-removal validation |
| Side-mounted LiDARs | Part of the sensor-pod concept used in the collection platform |
| Visible camera | Forward-facing visual context in winter weather |
| Near-infrared camera | Helps compare visible and NIR degradation in snow |
| Long-wave infrared camera | Useful for thermal contrast under low-visibility winter conditions |
| Forward radar | Weather-resilient comparison channel |
| GNSS/IMU | Pose information for sequence aggregation and mapping studies |

---

## Labels And Tasks

| Label type | Use |
|---|---|
| Dense point-wise LiDAR semantic labels | Train/evaluate snow segmentation and snow removal |
| Active-snow class | Direct target for falling snow clutter filtering |
| Accumulated-snow class | Detect snowbanks, snow-covered drivable surfaces, and changing roadside geometry |
| SemanticKITTI-style classes | Check that removal preserves roads, vehicles, vegetation, buildings, and pedestrians |
| Sequential scans with pose | Evaluate temporal filters, mapping, and scan aggregation |

WADS supports semantic segmentation, panoptic-style scene parsing, snow/noise removal, localization and mapping under snow, and object-detection robustness after filtering.

---

## Weather And Environment

WADS was collected in Michigan's Upper Peninsula, a snow-belt region that provides frequent severe winter events. The paper record emphasizes moderate-to-severe winter weather, heavy snowfall, occasional whiteout conditions, rural and semi-rural settings, and winter behaviors such as snow-covered sidewalks, altered pedestrian paths, and snowbanks near drivable surfaces.

This matters for airside work because airport aprons have similar open exposure: blowing snow, plowed snow ridges, low-contrast pavement markings, and large unobstructed surfaces where wind moves snow across the LiDAR path.

---

## Benchmark Use For Perception And Removal

Use WADS as the first public validation set for snow removal:

1. Train or tune filters on active-snow labels.
2. Measure false-removal of non-snow classes before and after filtering.
3. Evaluate semantic segmentation on raw point clouds and filtered point clouds.
4. Check temporal consistency across sequential scans.
5. Evaluate accumulated-snow handling separately from falling-snow removal.

For removal algorithms, the most important metric is not just how many snow points are removed. A production filter must preserve small obstacles, curbs, cones, pedestrians, and vehicle edges while removing transient snow returns.

---

## Strengths

- Direct point-wise labels for falling snow, which many adverse-weather datasets lack.
- Explicit accumulated-snow class for snowbank and road-edge ambiguity.
- Severe winter collection rather than light cosmetic snowfall.
- Sequential scans with pose support temporal and mapping experiments.
- Multimodal collection allows radar/camera context even when LiDAR is the labeled focus.

---

## Limitations

- The labeled public subset is much smaller than the full raw collection.
- It is snow-focused; it does not validate rain, fog, spray, dust, or steam directly.
- Object diversity is lower than urban AV datasets because severe winter driving reduces traffic and pedestrian frequency.
- Rural/semi-rural scenes transfer imperfectly to dense apron operations with aircraft, GSE, cones, dollies, and jet bridges.
- License and access terms should be checked per bundle; the sequence-26 page lists a CC BY 4.0 license.

---

## Airside Transfer

WADS is the strongest public proxy for airside snow operations. It should be used to validate:

- falling-snow clutter removal near the sensor;
- snowbank and plowed-edge segmentation;
- preservation of small vertical obstacles after filtering;
- performance of LiDAR-only perception before radar fallback;
- snow-aware map matching where accumulated snow changes expected geometry.

It does not cover de-icing spray or jet-blast steam. For those, use WADS only as a particle-clutter pretest and then require apron recordings around de-icing areas and aircraft exhaust.

---

## Sources

- [Michigan Tech WADS sequence-26 data page](https://digitalcommons.mtu.edu/all-datasets/20/)
- [Michigan Tech publication record for "Winter adverse driving dataset for autonomy in inclement winter weather"](https://digitalcommons.mtu.edu/michigantech-p/16990/)
- [SPIE Optical Engineering DOI landing page](https://www.spiedigitallibrary.org/journals/optical-engineering/volume-62/issue-03/031207/Winter-adverse-driving-dataset-for-autonomy-in-inclement-winter-weather/10.1117/1.OE.62.3.031207.full)
