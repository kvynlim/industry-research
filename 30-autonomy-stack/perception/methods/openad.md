# OpenAD

## What It Is

- OpenAD is a benchmark for open-world 3D object detection in autonomous driving.
- It is method-like because it defines a dataset construction pipeline, evaluation protocol, and challenge tooling.
- The benchmark targets two gaps at once: domain generalization and open-vocabulary corner-case recognition.
- It samples real scenes from five public driving datasets rather than synthetic-only anomaly sources.
- Source datasets include nuScenes, Argoverse 2, KITTI, ONCE, and Waymo.
- The released repository describes 2,000 selected scenes with 6,597 added 3D corner-case annotations.
- With original dataset annotations included, the benchmark covers 19,761 objects across 206 categories.

## Core Technical Idea

- Start from real driving datasets that already contain calibrated camera and LiDAR data.
- Discover candidate corner cases with a multimodal large language model and human verification.
- Normalize annotations from heterogeneous source datasets into a unified 2D and 3D box format.
- Evaluate both general open-world methods and specialized driving detectors under one protocol.
- Treat unknown and rare categories as first-class objects rather than background or ignored clutter.
- Use the benchmark to measure whether a detector can handle new domains, sensor setups, and uncommon objects.

## Inputs and Outputs

- Inputs are source-dataset camera images, LiDAR sweeps, calibration, ego poses, and original annotations.
- Added labels are 2D and 3D boxes for corner-case objects with semantic category names.
- Evaluation inputs are model predictions in OpenAD's unified format.
- Outputs are detection metrics for 2D and 3D open-world object detection.
- The toolkit also outputs organized OpenAD data built from local copies of the five source datasets.
- OpenAD is not a runtime perception model; it is a benchmark and evaluation suite.

## Architecture or Evaluation Protocol

- The construction pipeline filters scenes likely to contain unusual objects or objects outside common driving taxonomies.
- MLLM-assisted discovery proposes corner cases, then humans correct and validate the annotations.
- The benchmark keeps both original known-category objects and newly labeled corner-case objects.
- Evaluation compares open-world methods, specialized closed-set detectors, and ensemble variants.
- The paper also proposes a vision-centric 3D open-world object detection baseline.
- An ensemble fuses general open-world and specialized detector outputs to mitigate low precision.
- The online challenge is hosted through EvalAI for 2D and 3D submissions.

## Training and Evaluation

- OpenAD itself is assembled rather than trained.
- Baseline training depends on each detector family and its supported data format.
- The toolkit requires users to download the underlying source datasets under their original terms.
- The repository provides scripts to create the OpenAD root from dataset roots and OpenAD annotations.
- Evaluation is intended to expose cross-dataset generalization, open-vocabulary recall, and corner-case precision.
- Reported paper evaluations cover 2D open-world models, 3D open-world models, specialized detectors, and ensembles.

## Strengths

- Uses real driving sensor data, which makes the domain shift more relevant than synthetic obstacle-only tests.
- Covers multiple sensor rigs and geographies through five source datasets.
- Adds 3D boxes for rare and abnormal objects, not only 2D anomaly masks.
- Separates benchmark tooling from model design, so new detectors can be compared consistently.
- Provides an immediate airside-relevant template for evaluating unknown ground support equipment and debris.
- The category count is far broader than typical closed-set autonomous driving benchmarks.

## Failure Modes

- Corner-case discovery depends on the MLLM and human review policy, so annotation coverage is not exhaustive.
- Source dataset licenses and access requirements complicate reproducibility for commercial teams.
- The 2,000-scenario scale is useful for stress testing but not enough to estimate every rare-event tail.
- Category names may contain synonym, granularity, and hierarchy inconsistencies across datasets.
- Benchmark success does not prove closed-loop safety because planning, tracking, and behavior prediction are outside scope.
- Airport apron objects and procedures are not directly represented unless they appear in the source driving datasets.

## Airside AV Fit

- OpenAD is a strong evaluation pattern for apron autonomy because airports contain many rare, movable object classes.
- A direct airside variant should include belt loaders, dollies, chocks, tow bars, cones, jet bridges, FOD, and personnel equipment.
- The multi-dataset construction idea maps well to mixed camera/LiDAR fleets and different airport layouts.
- The benchmark's open-ended category handling is relevant for maintenance objects and temporary work-zone artifacts.
- It is not enough as a safety case because it lacks apron-specific rules, aircraft proximity constraints, and operational scenarios.
- Use it as a template for challenge design and metric selection, not as evidence that a detector works airside.

## Implementation Notes

- Treat OpenAD as an evaluation harness before using it as a training source.
- Preserve source-dataset metadata so camera/LiDAR extrinsics and coordinate frames remain auditable.
- Keep original labels and added corner-case labels separate in downstream error analysis.
- For airside adaptation, define a controlled vocabulary plus an unknown-object tier to avoid synonym drift.
- Use per-category and per-size metrics; rare small objects are often the safety-critical failures.
- Because the repository license is non-commercial, check terms before using the annotations in product development.

## Sources

- Paper on arXiv: https://arxiv.org/abs/2411.17761
- NeurIPS 2025 OpenReview page: https://openreview.net/forum?id=T9UDyN5Tw6
- Official GitHub repository: https://github.com/VDIGPKU/OpenAD
- NeurIPS 2025 poster page: https://nips.cc/virtual/2025/poster/121632
