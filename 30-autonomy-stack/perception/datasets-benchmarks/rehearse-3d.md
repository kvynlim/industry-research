# REHEARSE-3D

**Last updated:** 2026-05-09

REHEARSE-3D is a multi-modal emulated-rain dataset for 3D point-cloud de-raining. It is directly relevant to validating rain artifact removal because it provides point-wise rain annotations, high-resolution LiDAR-256 data, 4D radar point clouds, and rain-characteristic metadata from a controlled weather environment.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

REHEARSE-3D measures how heavy rain creates point-cloud artifacts and how well algorithms can detect and remove rain points. The Sensors article reports 9.2 billion annotated points and states that the dataset benchmarks raindrop detection and removal in fused LiDAR and 4D radar point clouds.

The dataset is designed for point-level weather reasoning rather than only downstream object-detection metrics. That makes it a strong complement to RainSense, which measures natural rain intensity effects at the case level.

---

## Sensors And Modalities

| Modality | Notes |
|---|---|
| LiDAR-256 | High-resolution LiDAR point clouds |
| 4D radar | Radar point clouds collected alongside LiDAR |
| Day/night recordings | Both daytime and nighttime conditions |
| Rain-characteristic metadata | Useful for noise modeling and point-level weather impact analysis |
| Controlled weather environment | Emulated rain enables repeatable severity experiments |

---

## Labels And Tasks

| Label type | Use |
|---|---|
| Point-wise rain annotations | Supervised rain/no-rain segmentation |
| Rain-characteristic data | Physics-aware rain artifact modeling |
| Fused LiDAR/radar inputs | Radar-conditioned rain removal |
| Benchmark splits | Compare statistical filters and deep models |

The paper evaluates statistical filtering and deep-learning baselines. It explicitly discusses models such as SalsaNext, LiSnowNet-L1, and 3D-OutDet for rain point detection/removal.

---

## Weather And Environment

REHEARSE-3D uses emulated rain in a controlled weather environment. This improves repeatability and point-level labeling quality, but it is not the same as open-road natural rain with splashes, road spray, dirty sensor windows, windshield effects, and mixed traffic.

For validation, treat it as the controlled test bench for rain artifacts and then use RainSense or RADIATE for natural-weather confirmation.

---

## Benchmark Use For Perception And Removal

Use REHEARSE-3D to validate:

- rain point detection precision, recall, IoU, and false-removal rate;
- supervised vs unsupervised de-raining methods;
- radar-conditioned LiDAR filtering;
- robustness across day/night captures;
- latency vs removal quality tradeoffs.

Recommended production-oriented metrics:

| Metric | Why it matters |
|---|---|
| Rain-point recall | Measures whether clutter is removed |
| Non-rain precision | Measures whether real obstacles are preserved |
| Downstream segmentation/detection delta | Catches filters that over-clean geometry |
| Radar/LiDAR consistency after filtering | Checks whether fusion improves rather than masks failures |
| Runtime | Filters must fit inside the perception cycle |

---

## Strengths

- Directly targets point-cloud de-raining.
- Very large point-wise annotated release according to the Sensors article.
- High-resolution LiDAR and 4D radar make it useful for modern fusion stacks.
- Controlled rain supports repeatable ablations.
- Includes day and night conditions.

---

## Limitations

- Emulated rain may not reproduce all natural rainfall and road-spray effects.
- It focuses on rain; it is not a snow, fog, dust, or steam dataset.
- Controlled conditions may underrepresent dirty optics, tire spray, puddles, mixed traffic, and apron contaminants.
- Airside object classes and airport geometry are absent.
- Public release mechanics should be verified from the authors before large-scale training.

---

## Airside Transfer

REHEARSE-3D is the best public candidate for validating rain-removal logic before testing de-icing mist or heavy apron rain. Use it to:

- train binary rain-point classifiers;
- compare statistical and learned de-raining filters;
- test whether 4D radar can condition LiDAR cleaning;
- define conservative thresholds for switching to radar-primary perception.

It is only a partial proxy for de-icing spray and steam. Glycol aerosols, heated exhaust plumes, and sensor-window droplets require local airport collection.

---

## Sources

- [REHEARSE-3D arXiv paper](https://arxiv.org/abs/2504.21699)
- [REHEARSE-3D Sensors article](https://www.mdpi.com/1424-8220/26/2/728)
