# MUAD Multiple Uncertainties

**Last updated:** 2026-05-09

MUAD is a synthetic autonomous-driving dataset designed to separate and combine multiple uncertainty sources: adverse weather, day/night appearance, and out-of-distribution objects. It is useful when robustness evaluation needs explicit compound slices such as OOD-only, weather-only, and weather plus OOD.

**Related pages:** [open-world OOD and anomaly segmentation benchmarks](open-world-ood-anomaly-segmentation-benchmarks.md), [weather robustness datasets](weather-robustness-datasets.md), [uncertainty quantification and calibration](../overview/uncertainty-quantification-calibration.md)

---

## Scope

| Item | MUAD coverage |
|---|---|
| Primary domain | Synthetic road-driving imagery |
| Scale | 10,413 annotated images |
| Split shape | 3420 train, 492 validation, 6501 test images |
| Uncertainty axes | Normal, no-shadow, OOD, low/high adverse weather, low/high adverse weather with OOD |
| Weather | Rain, snow, and fog at different intensities |
| Lighting | Day and night, with about two-thirds day and one-third night in the described sets |

The dataset is intentionally structured so that uncertainty sources can be isolated instead of mixed into one aggregate score.

---

## Sensors And Labels

| Asset | Notes |
|---|---|
| RGB image | Synthetic rendered driving image |
| Semantic labels | Fine-grained labels aggregated into Cityscapes-style classes |
| Depth | Dense depth supervision |
| Object detection | Detection annotations for object-level tasks |
| Instance detection | Instance-level object labels |
| OOD object labels | Animals and object-anomaly categories are included in the label ontology |

The project page lists 155 fine-grained classes, aggregated for easier use with common autonomous-driving label sets.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Semantic segmentation | mIoU by normal, OOD, adverse, and adverse+OOD subsets |
| Depth estimation | AbsRel/RMSE split by weather intensity and night/day |
| Object detection | AP by known class plus OOD-induced false positives |
| Instance detection | Instance AP and mask quality where instance labels are used |
| Uncertainty estimation | Calibration error, selective risk, AUROC/AUPR for OOD or failure prediction |

For safety evaluation, the important table is a 2x2 slice: normal versus OOD crossed with clear versus adverse weather. A model that handles OOD in clear conditions but collapses when fog or snow is added has not solved compound uncertainty.

---

## Best Use

Use MUAD to:

- test whether uncertainty scores rise on OOD objects and severe weather;
- distinguish aleatoric degradation from semantic novelty;
- validate abstention or fallback policies for segmentation, depth, and detection;
- compare multi-task uncertainty across depth and semantic outputs;
- build small, controlled regression tests before moving to real adverse-weather logs.

MUAD is most valuable as a structured uncertainty benchmark, not as a photorealistic replacement for real-world adverse-weather data.

---

## Airside Transfer

Airside autonomy sees compound uncertainty constantly: unknown equipment, temporary objects, unusual aircraft configurations, reflective wet aprons, low light, fog, rain, snow, and personnel in high-visibility PPE. MUAD can help prototype:

- "unknown object plus adverse weather" evaluation slices;
- abstention thresholds for segmentation and depth;
- test reports that separate OOD failures from weather failures;
- training curricula where normal, OOD, adverse, and adverse+OOD are balanced.

Airport validation still needs real or high-fidelity synthetic airport scenes with aircraft, GSE, cones, chocks, FOD, ground markings, jet bridges, de-icing rigs, and apron lighting.

---

## Limitations

- Synthetic images do not fully reproduce sensor noise, lens effects, radar/LiDAR behavior, spray, or wet-surface multipath.
- It is camera-centric and does not provide a real multi-sensor AV rig.
- There are no temporal sequences for tracking, forecasting, or online adaptation.
- The road-scene ontology is not an airport ontology.
- OOD categories are curated; production unknowns will be more open-ended.

---

## Sources

- [MUAD project page](https://muad-dataset.github.io/)
- [MUAD arXiv paper](https://arxiv.org/abs/2203.01437)
- [MUAD BMVC 2022 paper PDF](https://bmvc2022.mpi-inf.mpg.de/0398.pdf)
