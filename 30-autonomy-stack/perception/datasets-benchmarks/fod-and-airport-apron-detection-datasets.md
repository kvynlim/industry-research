# FOD And Airport Apron Detection Datasets

**Last updated:** 2026-05-09

Foreign object debris and airport-apron datasets are needed because public-road perception datasets rarely contain the small debris, pavement textures, service equipment, aircraft-adjacent occlusions, and airport operating context that determine airside perception risk. This page focuses on datasets and benchmark fit, not FOD operations procedures.

---

## Scope

| Dataset | Scope | Best use |
|---|---|---|
| FOD-A | Image dataset of foreign object debris on runway or taxiway backgrounds | FOD object detection and environmental-slice evaluation. |
| IVFOD / dual-light FOD data | Infrared and visible-light small-scale FOD imagery from a dual-light camera setup | Visible/infrared small-target detection research. |
| Apron Dataset | Airport-apron logistics images with bounding boxes, object categories, and environmental metadata | Apron object detection, logistics scene understanding, and robustness by environmental parameter. |

These datasets help fill an airside benchmark gap, but none alone is sufficient for final airport autonomy acceptance. A deployment program still needs site-specific data for pavement, lighting, camera height, FOD types, GSE, aircraft mix, and operating procedures.

---

## What They Measure

| Measurement question | Relevant dataset |
|---|---|
| Can the detector find common FOD categories against runway/taxiway pavement? | FOD-A |
| Does performance change by light level or wet/dry condition? | FOD-A |
| Can infrared and visible sensors improve small FOD detection? | IVFOD / dual-light FOD work |
| Can apron logistics objects be detected under environmental variation? | Apron Dataset |
| Can an airside perception system distinguish debris from legitimate equipment? | Use FOD and apron datasets together, then validate locally. |

The key benchmark challenge is scale. FOD can be small, low contrast, reflective, partially occluded, or visually similar to pavement markings and rubber deposits.

---

## Sensors And Labels

| Dataset | Sensors | Labels and metadata |
|---|---|---|
| FOD-A | RGB imagery | Bounding boxes for FOD objects; light-level categories; dry/wet weather categories; Pascal VOC format is recommended for experimentation. |
| IVFOD / dual-light FOD | Visible and infrared cameras | FOD detection labels for small-target experiments; reported work uses infrared-visible fusion and YOLOv5-derived models. |
| Apron Dataset | Image data for airport apron logistics | Bounding boxes, object categories, and meta parameters for robustness against environmental influences. |

FOD-A reports 31 object categories and more than 30,000 annotation instances in the arXiv abstract. The GitHub release provides original and Pascal VOC versions, with tools for resizing annotations and converting formats.

---

## Metrics And Tasks

| Task | Metrics |
|---|---|
| 2D FOD detection | mAP by IoU threshold, AP-small, recall at fixed false positives per image, miss rate by object size |
| Small-object localization | Center error, box IoU, distance-to-lane/path threshold, minimum detectable size by range |
| Light/weather slicing | AP and recall by bright/dim/dark and dry/wet labels |
| Visible/IR fusion | Per-modality AP, fusion AP, false positives on hot pavement/reflections |
| Apron logistics detection | mAP by object class, class confusion, recall near aircraft and service areas |
| Safety-oriented scoring | Hazard-weighted miss rate, false-clear rate, time-to-detect, duplicate/track stability |

For airside autonomy, AP is not enough. The acceptance metric must include false-clear risk: the system says the path is clear while a hazardous object remains in the operating corridor.

---

## Strengths

- FOD-A is public and directly targeted at airport FOD detection.
- FOD-A includes environmental annotations, allowing light and wet/dry performance slicing.
- The Pascal VOC release and conversion tools make detector benchmarking straightforward.
- Dual-light FOD research highlights the value of visible/infrared sensing for small FOD targets.
- The Apron Dataset covers airport-apron logistics rather than only runway debris.
- Apron environmental metadata supports robustness analysis under operating variation.

---

## Gaps And Risks

- FOD-A backgrounds are runway/taxiway oriented; apron clutter and gate-area operations may differ.
- Public FOD datasets may not represent local debris distributions such as screws, cable ties, plastic wrap, luggage tags, straps, tools, and aircraft-specific items.
- 2D bounding boxes do not prove 3D localization accuracy, ground-plane contact, or planner relevance.
- Infrared-visible research may not transfer to the exact camera baseline, mounting height, or thermal environment of a vehicle.
- Apron object categories are broader logistics objects, not necessarily small FOD.
- Dataset images do not replace live tests with glare, rain, nighttime apron lighting, rubber deposits, de-icing residue, and moving GSE.

---

## AV And Airside Fit

| Airside need | Fit | Notes |
|---|---|---|
| FOD detector pretraining | Strong | FOD-A is the most direct public starting point. |
| Environmental slice testing | Moderate | FOD-A light and wet/dry annotations are useful but coarse. |
| Visible/IR sensor trade study | Moderate | Dual-light FOD work supports early modality selection. |
| Apron object detection | Strong for logistics | Apron Dataset is closer to airport operations than road datasets. |
| Full autonomous clearance claim | Insufficient alone | Requires site-specific collection, physical test articles, and operational acceptance rules. |

Recommended evidence flow: pretrain or screen on FOD-A, test sensor choices with visible/IR small-target data, validate apron-object recognition on the Apron Dataset, then run a target-airport FOD and apron hazard campaign.

---

## Implementation And Evaluation Notes

1. Split results by object size, pavement type, light condition, wet/dry state, and range where range can be estimated.
2. Preserve original-resolution evaluation for small objects. Training on resized images can hide detection limits.
3. Report false positives on markings, rubber deposits, cracks, reflections, shadows, leaves, bolts embedded in pavement, and normal airport hardware.
4. Convert detector outputs into a ground-plane hazard region and evaluate whether the planner would receive a usable obstacle.
5. Use hard-negative apron samples without FOD to tune false-alarm rates before operational trials.
6. Build a target-domain holdout set with site-specific debris and equipment, and keep it locked for acceptance testing.
7. For multimodal systems, score RGB-only, IR-only, and fused outputs to prove fusion benefit rather than assuming it.

---

## Sources

- [FOD-A GitHub repository](https://github.com/FOD-UNOmaha/FOD-data)
- [FOD-A arXiv paper](https://arxiv.org/abs/2110.03072)
- [Small-Scale Foreign Object Debris Detection Using Deep Learning and Dual Light Modes](https://www.mdpi.com/2076-3417/14/5/2162)
- [AIT Apron Dataset record](https://publications.ait.ac.at/de/datasets/apron-dataset/)
- [Apron Dataset GitHub repository](https://github.com/apronai/apron-dataset)
