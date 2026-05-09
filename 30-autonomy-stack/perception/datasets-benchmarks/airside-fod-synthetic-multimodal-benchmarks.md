# Airside FOD Synthetic And Multimodal Benchmarks

**Last updated:** 2026-05-09

Foreign object debris (FOD) detection is a high-consequence small-object perception problem. Public benchmarks now include real FOD images, visible/infrared small-target datasets, runway RGB-IR datasets, and synthetic augmentation pipelines, but they remain pre-operational evidence rather than a substitute for site-specific airport validation.

**Related pages:** [FOD and airport apron detection datasets](fod-and-airport-apron-detection-datasets.md), [open-world OOD and anomaly segmentation benchmarks](open-world-ood-anomaly-segmentation-benchmarks.md), [sensor corruption robustness benchmarks](sensor-corruption-robustness-benchmarks.md), [night operations and thermal fusion](../overview/night-operations-thermal-fusion.md), [production perception systems](../overview/production-perception-systems.md)

---

## Scope

| Resource | Type | Best use |
|---|---|---|
| FOD-A | Real RGB FOD object-detection dataset | Baseline runway/taxiway FOD detection and environmental slicing. |
| Airport-FOD3S | Synthetic FOD insertion and realism pipeline | Data augmentation, small-object diversity, and sim-to-real ablation. |
| IVFOD / dual-light FOD | Infrared-visible FOD imagery from a dual-light camera setup | Sensor trade study for visible/IR small FOD. |
| RDD5000 | Real visible-infrared runway detection dataset | Runway-region detection and multimodal alignment stress, not FOD object detection by itself. |
| FOD-S2R | Real/synthetic sim-to-real FOD detection dataset for aircraft fuel-tank imagery | Sim-to-real methodology reference; weak direct runway transfer. |
| FAA FOD guidance | Operational definition and program context | Defines what must be managed in airport environments. |

This page focuses on benchmark design and data-engine use for airside perception. It does not replace airport FOD management procedures or certified detection-equipment procurement guidance.

---

## Operational Definition

The FAA defines FOD as any object, living or not, located in an inappropriate place in the airport environment that can injure personnel or damage aircraft. That broad definition is important for perception: the target class is not a closed list of "debris categories." It includes ordinary objects in the wrong place, such as tools, metal fragments, loose pavement, straps, baggage pieces, wildlife, broken light hardware, chocks, and plastic wrap.

For autonomy, the perception task should therefore be framed as:

| Question | Required evidence |
|---|---|
| Is there an unexpected object on a safety-critical surface? | Detection or anomaly localization on runway, taxiway, stand, or vehicle path. |
| Is it hazardous for the planned operation? | Ground-plane position, size/range estimate, persistence, and path intersection. |
| Is it a known legitimate airside object? | Distinguish cones, chocks, belt loaders, dollies, tugs, stairs, and temporary equipment from debris. |
| Can the system avoid false-clear decisions? | Recall and false-clear rate at locked operating thresholds. |

---

## Dataset And Task Details

| Dataset / benchmark | Sensors | Labels | Notes |
|---|---|---|---|
| FOD-A | RGB imagery of FOD on runway/taxiway backgrounds | Bounding boxes, object categories, light-level and weather categories | Public baseline dataset for computer-vision FOD detection. |
| Airport-FOD3S | RGB FOD images plus synthesized FOD composites | Detection labels from augmented data | Three-stage framework: scale transformation, seamless blending, and style transfer for realism. |
| IVFOD | Infrared and visible-light camera imagery | Four FOD categories in the cited paper: screw, nut, key, bottle | Captured on concrete/asphalt surfaces at 5 m, 10 m, and 15 m across time-of-day variation. |
| RDD5000 | DJI drone visible camera and infrared camera | Runway salient-object / runway-region style labels | 5,000 visible/IR image pairs from real airport runway scenes; useful for region-of-interest and multimodal robustness. |
| FOD-S2R | Real and synthetic images in a simulated aircraft fuel tank | Object-detection labels for fuel-tank FOD | Sim-to-real benchmark outside open runway/apron geometry. |

FOD-A remains the most direct public runway/taxiway FOD dataset. Airport-FOD3S is best treated as an augmentation and data-engine pipeline around scarce real FOD images. RDD5000 is valuable for RGB-IR runway perception and non-perfect alignment, but it is not a replacement for FOD object labels.

---

## Metrics

| Metric | Why it matters |
|---|---|
| mAP / AP by IoU | Standard detector comparison. |
| AP-small / recall by object size | FOD is often small, low, and low contrast. |
| Recall at fixed false positives per image or per kilometer | Operational teams need a manageable alert rate. |
| False-clear rate | Safety-critical: path reported clear while hazardous FOD remains. |
| Range-sliced recall | Determines practical detection distance for braking or stopping. |
| Environmental slices | Light, wet/dry surface, glare, rain, snow, night, thermal contrast. |
| Modality ablation | RGB-only, IR-only, fused, and synthetic-augmented variants. |
| Track persistence | Ensures a one-frame detection becomes a stable hazard, not flicker. |

For airside autonomy, detector mAP should be secondary to a locked-threshold safety report: miss rate by hazard type, false-clear cases, false-alarm burden, and planner handoff quality.

---

## Synthetic Data And Sim-to-Real Use

Airport-FOD3S is useful because real FOD examples are expensive, disruptive, and unevenly distributed. Its realism pipeline explicitly addresses common synthetic-data failures: wrong object scale, obvious paste artifacts, and style mismatch between the inserted object and pavement/weather context.

Recommended uses:

1. Expand rare FOD categories and long-tail appearances before target-airport collection is complete.
2. Generate controlled slices for object size, material, shadow, wet pavement, glare, and clutter.
3. Train with synthetic augmentation, but keep a real-only validation set and a locked real acceptance holdout.
4. Compare real-only, synthetic-only, and mixed training to prove synthetic data helps target-domain recall.
5. Reject gains that only improve easy large objects while leaving screws, washers, cable ties, and dark debris unchanged.

Synthetic data is a data-engine lever, not final safety evidence. A high score on augmented FOD-A can still fail on site-specific pavement texture, rubber deposits, painted markings, jet-blast debris patterns, de-icing residue, and apron lighting.

---

## Failure Modes

- Small metallic or dark objects disappear after resizing, compression, denoising, or aggressive augmentation.
- Synthetic pasted objects can create shortcut artifacts that detectors learn instead of FOD geometry.
- Visible and infrared frames may be misaligned; late fusion must tolerate imperfect correspondence.
- Hot pavement, reflections, standing water, rubber marks, cracks, leaves, and embedded hardware cause false positives.
- FOD datasets often lack hard negative apron clutter such as chocks, cones, cable covers, wheel stops, locks, straps, and service equipment.
- Bounding boxes do not prove ground contact, 3D size, or whether the object lies inside the vehicle's swept path.
- Fuel-tank FOD sim-to-real results do not automatically transfer to runway or apron scenes.
- Public datasets rarely encode operational consequences such as runway closure threshold, inspection response, or vehicle stop distance.

---

## AV, Indoor, Outdoor, And Airside Relevance

| Environment | Fit | Notes |
|---|---|---|
| Airport runway/taxiway | Strong | FOD-A, Airport-FOD3S, IVFOD, and FAA guidance are directly relevant. |
| Airport apron | Moderate | Need more GSE, aircraft-adjacent clutter, jet bridge, stand, and ground-handling labels. |
| Public-road AV | Moderate | Small road debris and unknown obstacle lessons transfer, but runway surfaces are simpler than roads. |
| Indoor industrial | Moderate | FOD-S2R and small-object sim-to-real lessons transfer to inspection workflows. |
| General outdoor robotics | Moderate | Useful for small unexpected objects, but environmental and operational constraints differ. |

Airside relevance is strongest when these datasets are used together: FOD-A for base detection, IVFOD/RDD5000 for multimodal sensing, Airport-FOD3S for augmentation, and site-specific data for acceptance.

---

## Validation And Data-Engine Use

1. Build a source matrix that records dataset, sensor, object class, surface, lighting, weather, and whether each sample is real or synthetic.
2. Keep synthetic and real samples separable through training, validation, and reporting.
3. Use hard-negative mining from empty runways, painted markings, rubber deposits, puddles, shadows, runway lights, drains, and normal hardware.
4. Evaluate on original resolution and deployment-like resolution; do not let resize settings hide sub-10 cm failures.
5. Add 3D localization checks for any AV use: camera-only boxes must become ground-plane hazard polygons or be confirmed by LiDAR/radar.
6. Maintain a target-airport holdout set with local debris, pavement, aircraft types, lighting, and apron operations.
7. In safety reports, separate "detected object" from "actionable FOD alert" and from "vehicle stopped or rerouted correctly."

---

## Sources

- [FAA Foreign Object Debris Program](https://www.faa.gov/airports/airport_safety/fod)
- [FAA AC 150/5210-24A Airport Foreign Object Debris Management](https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5210-24)
- [FAA AC 150/5220-24 Foreign Object Debris Detection Equipment](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentNumber/150_5220-24)
- [FOD-A GitHub repository](https://github.com/FOD-UNOmaha/FOD-data)
- [FOD-A arXiv paper](https://arxiv.org/abs/2110.03072)
- [Airport-FOD3S Sensors paper](https://www.mdpi.com/1424-8220/25/15/4565)
- [Small-Scale FOD Detection Using Dual Light Modes / IVFOD](https://www.mdpi.com/2076-3417/14/5/2162)
- [RDD5000 RGB-IR runway detection paper](https://www.mdpi.com/2072-4292/17/4/669)
- [FOD-S2R arXiv record](https://arxiv.org/abs/2512.01315)
