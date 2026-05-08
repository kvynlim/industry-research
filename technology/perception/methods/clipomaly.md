# Clipomaly

## What It Is

- Clipomaly is a language-guided open-world anomaly segmentation method for autonomous driving.
- The paper title is "Language-Guided Open-World Anomaly Segmentation".
- It is a CLIP-based zero-shot method that segments unknown objects and assigns human-readable names.
- It does not require anomaly-specific training data.
- It targets the gap between anomaly segmentation, which finds unknown regions, and open-vocabulary segmentation, which requires a fixed vocabulary.
- Clipomaly dynamically extends the inference vocabulary when it discovers anomalies.
- It is camera-image segmentation, not 3D detection.

## Core Technical Idea

- Use CLIP's shared image-text embedding space to detect regions that do not match known driving classes.
- Generate candidate names for unknown regions with either a dictionary strategy or an image tagging model such as RAM.
- Extend the segmentation vocabulary at inference time with those candidate names.
- Run an open-vocabulary segmentation model over the known classes plus the new candidate unknown labels.
- Produce both fine-grained semantic labels and a binary known/unknown anomaly mask.
- Avoid retraining when a new anomaly name is introduced.
- Use language to make anomalies interpretable rather than only marking them as "unknown".

## Inputs and Outputs

- Inputs are RGB driving images and a known-class vocabulary such as Cityscapes classes.
- Optional inputs include a candidate word dictionary or RAM-generated tags.
- The pipeline uses CLIP-region matching to score candidate unknown labels.
- Outputs include semantic segmentation for known classes.
- Outputs also include anomaly masks for unknown objects.
- Unknown regions are assigned labels such as object names or descriptive candidate terms.

## Architecture or Evaluation Protocol

- The method has three main stages: unknown mask prediction, anomaly naming, and open-vocabulary segmentation.
- Unknown mask prediction uses dense CLIP image-text similarity relative to known classes.
- Candidate naming can use a lightweight dictionary preselection strategy.
- A RAM-based variant uses an image tagging model for richer candidate words.
- The extended vocabulary is passed to an open-vocabulary segmentation backbone.
- Post-processing separates pixels assigned to known labels from pixels assigned to newly added unknown labels.
- Evaluation covers anomaly segmentation and open-world segmentation settings.

## Training and Evaluation

- Clipomaly is described as zero-shot with no anomaly-specific training data.
- It is evaluated on RoadAnomaly and Segment-Me-If-You-Can AnomalyTrack.
- The paper also discusses open-world settings with Cityscapes and BDD-Anomaly.
- Reported RoadAnomaly results include 57.8 mIoU and 84.74 AUPR for the RAM plus CLIP-Best variant.
- Reported SMIYC results include 75.1 mIoU and 94.74 AUPR for the same variant.
- A dictionary variant is lighter and still competitive, with reported RoadAnomaly mIoU above prior methods.

## Strengths

- Adds semantic names to anomalies, which helps triage and downstream reasoning.
- Zero-shot operation makes it useful before domain-specific anomaly labels exist.
- Dynamic vocabulary extension is better aligned with open-world deployment than fixed prompt lists.
- The method can reuse existing open-vocabulary segmentation backbones.
- It is directly motivated by autonomous driving anomaly segmentation benchmarks.
- The RAM and dictionary variants provide a tradeoff between semantic richness and compute.

## Failure Modes

- Candidate labels can be wrong, too generic, or operationally misleading.
- CLIP similarity can confuse visually similar objects with different hazards.
- RAM-based tagging is computationally heavier and may not fit embedded runtime budgets.
- Dictionary-based naming can miss airport-specific or local terminology.
- The method segments in 2D and does not estimate object depth, velocity, or 3D envelope.
- Known-class segmentation quality can degrade if the extended vocabulary introduces confusing terms.

## Airside AV Fit

- Clipomaly is relevant for camera anomaly alerts on ramps, service roads, and stand areas.
- Semantic anomaly labels could help remote operators distinguish debris, animals, equipment, and unusual vehicles.
- The dynamic vocabulary concept is attractive for airports because object taxonomies vary by operator and geography.
- It needs an airside candidate dictionary and evaluation set before use on apron video.
- Outputs should feed a 3D localization layer before vehicle planning reacts to them.
- It is best suited for perception monitoring, review, and data mining rather than sole safety perception.

## Implementation Notes

- Use an airport-specific known-class list and keep candidate anomaly labels separate from approved production classes.
- Log the candidate-name source, such as RAM or dictionary, for each anomaly.
- Validate false positives on markings, shadows, aircraft parts, reflections, and wet pavement.
- Pair 2D anomaly masks with LiDAR, stereo, or monocular depth before assigning hazard zones.
- Tune vocabulary extension conservatively so common known objects are not relabeled as unknowns.
- Build a review loop to promote repeated anomaly names into the training taxonomy.

## Sources

- arXiv paper: https://arxiv.org/abs/2512.01427
- Paper PDF via arXiv: https://arxiv.org/pdf/2512.01427
