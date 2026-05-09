# CADC and CADC+: Canadian Winter Driving and Paired Clear/Snow Sequences

**Last updated:** 2026-05-09

CADC is a winter autonomous-driving dataset from Waterloo, Canada, with synchronized cameras, LiDAR, and GNSS/INS plus 3D object annotations. CADC+ extends it with matched clear-weather drives on the same roads, making it useful for measuring how much snow itself shifts the perception domain.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

CADC measures object detection and tracking under real Canadian winter driving conditions. The original dataset contains 7000 annotated frames collected with the Autonomoose platform in the Region of Waterloo. CADC+ measures the domain gap between snow and clear weather by pairing snowy CADC sequences with clear-weather sequences recorded on the same roads and in the same period.

For removal validation, CADC+ is valuable because it can test whether de-snowing or style-transfer methods actually recover clear-weather detection behavior instead of only producing visually cleaner point clouds.

---

## Sensors And Modalities

| Modality | CADC notes |
|---|---|
| Cameras | 8 Ximea MQ013CG-E2 cameras |
| LiDAR | Velodyne VLP-32C |
| GNSS/INS | Novatel OEM638 |
| Calibration | Intrinsic and extrinsic calibration included |
| Time sync | Sensors are synchronized |

CADC+ reuses the CADC format and adds the CADC-clear sequences through the Waterloo WISE Lab release.

---

## Labels And Tasks

| Label type | Use |
|---|---|
| 3D LiDAR bounding boxes | Object detection and tracking under snow |
| CADC-clear validation labels | Clear-weather detection benchmark for paired comparisons |
| Sparse CADC-clear training labels | Domain adaptation with reduced annotation budget |
| Sequence pairing metadata | Snow-vs-clear cross-evaluation on similar routes |

The CADC+ project page states that it has 74 sequence pairs, each with at least 100 frames. CADC-clear provides full validation labels and labels every 10th frame in training sequences.

---

## Weather And Environment

CADC is winter-road data from Waterloo, Canada. It captures snowy roads, snowbanks, reduced contrast, wet/icy pavement, and other winter driving conditions. CADC+ reduces unrelated domain shift by matching snowy and clear sequences as closely as possible by road and capture period.

This design is important: if a model fails on CADC snow but succeeds on CADC-clear for the matched route, the gap is more likely due to snow and winter appearance than map, traffic, or geometry differences.

---

## Benchmark Use For Perception And Removal

Use CADC/CADC+ for:

- 3D detection drop from clear to snow;
- detector uncertainty analysis under snow;
- de-snowing as a preprocessing step before detection;
- domain adaptation from clear to snowy data;
- clear-weather style-transfer realism checks.

For LiDAR removal, CADC is less direct than WADS because it provides object boxes rather than dense snow/no-snow point labels. Its value is downstream: does the removal method improve detection without destroying object geometry?

---

## Strengths

- Real winter driving rather than synthetic snow.
- 360-degree camera coverage and VLP-32C LiDAR.
- 3D object labels from a public adverse-weather AV dataset.
- CADC+ provides paired clear/snow evaluation, which is rare.
- Useful for measuring domain shift, not just point-cloud denoising accuracy.

---

## Limitations

- CADC is focused on winter snow; it is not a rain, fog, spray, dust, or steam dataset.
- Original labels are object boxes, not dense adverse-weather artifact labels.
- CADC+ clear training labels are sparse by design.
- Road scenes and object classes do not include aircraft, baggage carts, dollies, jet bridges, or ramp workers in reflective PPE.
- VLP-32C density may not match higher-resolution airside LiDAR stacks.

---

## Airside Transfer

CADC/CADC+ should be used as the public benchmark for snow-induced domain shift before airport-specific validation. Good airside checks include:

- whether a 3D detector trained in clear conditions maintains recall after snow removal;
- whether de-snowing improves small vehicle, pedestrian, and equipment detection;
- whether clear-vs-snow paired evaluation exposes false confidence in synthetic de-snowed data;
- whether winter road-edge ambiguity resembles apron markings hidden by slush or plowed snow.

Airside deployment still needs local data because CADC does not cover airport object taxonomies or de-icing/glycol spray.

---

## Sources

- [CADC arXiv paper](https://arxiv.org/abs/2001.10117)
- [CADC+ project page, Waterloo WISE Lab](https://uwaterloo.ca/waterloo-intelligent-systems-engineering-lab/cadc-plus)
- [CADC+ arXiv paper](https://arxiv.org/abs/2506.16531)
