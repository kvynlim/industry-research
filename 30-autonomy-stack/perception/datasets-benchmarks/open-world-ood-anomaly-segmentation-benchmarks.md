# Open-World OOD And Anomaly Segmentation Benchmarks

**Last updated:** 2026-05-09

Open-world anomaly segmentation benchmarks test whether a semantic perception model can localize objects or regions outside its closed training taxonomy. This matters for autonomy because high in-distribution segmentation accuracy does not prove that the model will detect an unknown object on the drivable surface, a dropped load, an unusual apron object, or a novel obstruction.

---

## Scope

| Benchmark | Scope | Best use |
|---|---|---|
| SegmentMeIfYouCan | Real-world road anomaly and road obstacle segmentation with public leaderboard and benchmark suite | Open-world image anomaly and obstacle localization. |
| RoadAnomaly21 | Pixel-wise anomaly segmentation where unknown categories can appear anywhere in the image | Strict semantic unknown detection. |
| RoadObstacle21 | Road-obstacle segmentation focused on objects on the drivable area, known or unknown | Drivable-surface hazard localization. |
| Fishyscapes | Anomaly detection for semantic segmentation, including real captured Lost and Found style data and changing web anomalies | Legacy/open-world comparison and uncertainty method screening. |

This page is about anomaly and OOD segmentation. It is not a weather robustness page and it is not a substitute for dedicated FOD datasets.

---

## What They Measure

| Measurement question | Why it matters |
|---|---|
| Can the model localize a previously unseen object category? | Closed-set segmentation often assigns unknown objects to known classes with high confidence. |
| Can it detect small obstacles on the road surface? | Small, low-profile hazards can be safety-critical even if their semantic class is unknown. |
| Does the anomaly score form coherent components? | Pixel-wise metrics can reward noisy masks that are poor for planning. |
| Does performance survive dataset and scene diversity? | Overfitting to a small set of anomalies is a known risk. |
| Does the system abstain or flag uncertainty instead of hallucinating a known class? | Runtime assurance needs a usable unknown/uncertain signal. |

SegmentMeIfYouCan explicitly separates anomalous object segmentation from road obstacle segmentation. That distinction is useful for AV and airside validation: an unknown object anywhere in the image is not the same hazard as an unknown object occupying the intended path.

---

## Sensors And Labels

| Dataset | Sensors | Labels |
|---|---|---|
| RoadAnomaly21 | RGB images | Pixel-wise anomaly, non-anomaly, and void labels; hidden test labels for leaderboard evaluation. |
| RoadObstacle21 | RGB images | Pixel-wise obstacle, non-obstacle, and void labels focused on the road region of interest. |
| Fishyscapes Lost and Found style data | RGB imagery captured with Cityscapes-like setup | Dense anomaly annotations for image-based semantic segmentation evaluation. |
| Fishyscapes web anomalies | RGB composites or changing web-sourced anomalies depending on benchmark mode | Anomaly masks designed to test open-world generalization. |

These are image segmentation benchmarks. They are not LiDAR, radar, or multimodal fusion datasets.

---

## Metrics And Tasks

| Metric family | Use |
|---|---|
| AUROC | Measures ranking quality between anomaly and normal pixels, but can hide poor localization under class imbalance. |
| AUPRC / AP | More informative for rare anomaly pixels; report anomaly-pixel AP separately. |
| FPR at high TPR | Useful for operational thresholds where missed hazards are costly. |
| Pixel-wise IoU / F1 | Measures segmentation overlap once a threshold is chosen. |
| Component-wise metrics | Measures object-level localization quality and reduces size bias. |
| Leaderboard score | Useful for external comparison, but preserve raw metric tables for safety review. |

For safety cases, choose an operating threshold before final test evaluation. Post-hoc threshold tuning on hidden or target-domain test data weakens the evidence.

---

## Strengths

- Directly targets the closed-set failure mode of semantic segmentation.
- SegmentMeIfYouCan provides both anomaly and road-obstacle tasks.
- RoadAnomaly21 and RoadObstacle21 emphasize real images and diverse scenes rather than only synthetic anomalies.
- Public leaderboards reduce the risk of unverifiable local-only comparisons.
- Component-wise metrics are more relevant to planning than pixel-only summaries.
- Fishyscapes remains a useful comparison point for anomaly and uncertainty methods.

---

## Gaps And Risks

- RGB-only benchmarks do not test LiDAR/radar confirmation of unknown obstacles.
- Road-domain anomalies do not cover aircraft servicing equipment, FOD, jet-bridge structures, cones, chocks, or baggage on aprons.
- Unknown-object definitions are tied to source training taxonomies such as Cityscapes; airside unknowns need a domain-specific taxonomy.
- Pixel-level anomaly detection can produce masks that are hard to convert into stable tracks.
- Very small debris can be below the spatial scale represented in road anomaly leaderboards.
- A high anomaly score is not a class label; downstream planning still needs localization, persistence, and risk classification.

---

## AV And Airside Fit

| Use case | Fit | Notes |
|---|---|---|
| Detecting unknown road obstacles | Strong | RoadObstacle21 is directly aligned with drivable-surface hazard detection. |
| Semantic OOD screening | Strong | RoadAnomaly21 and Fishyscapes expose overconfident closed-set models. |
| Airport apron unknown-object detection | Moderate proxy | Useful for method selection, but target-domain apron data is mandatory. |
| FOD detection | Weak to moderate | Use only as an OOD pre-screen; FOD requires small-object datasets and physical validation. |
| Runtime assurance | Moderate | Anomaly scores can feed monitors, but must be calibrated and tracked. |

For airside validation, use these benchmarks to select anomaly segmentation methods, then build an airport-specific unknown-object suite with objects such as loose straps, tools, chocks, cones in unusual positions, baggage, temporary signs, and maintenance equipment.

---

## Implementation And Evaluation Notes

1. Evaluate the normal semantic segmentation output and the anomaly head together. A model that detects anomalies by degrading normal segmentation may not be usable.
2. Report threshold-free metrics and thresholded operating-point metrics.
3. Add component-wise analysis for small, medium, and large anomaly regions.
4. Convert anomaly masks into obstacle hypotheses and test track persistence before using the score in planning.
5. For airside transfer, create separate classes for "known airside object," "unknown but obstacle," "unknown non-obstacle," and "void/ambiguous."
6. Include negative controls such as unusual textures, shadows, markings, reflections, and wet pavement so the anomaly detector does not flag every domain shift as an obstacle.
7. Do not use public benchmark results as final safety evidence unless the same thresholding, post-processing, and runtime monitor path is used in the product stack.

---

## Sources

- [SegmentMeIfYouCan benchmark](https://segmentmeifyoucan.com/)
- [SegmentMeIfYouCan NeurIPS Datasets and Benchmarks paper](https://datasets-benchmarks-proceedings.neurips.cc/paper_files/paper/2021/file/d67d8ab4f4c10bf22aa353e27879133c-Paper-round2.pdf)
- [SegmentMeIfYouCan code](https://github.com/SegmentMeIfYouCan/road-anomaly-benchmark)
- [Fishyscapes benchmark](https://fishyscapes.com/)
- [Fishyscapes paper DOI](https://doi.org/10.1109/ICCVW.2019.00349)
