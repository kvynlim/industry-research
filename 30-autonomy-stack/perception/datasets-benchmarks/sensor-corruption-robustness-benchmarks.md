# Sensor Corruption Robustness Benchmarks

**Last updated:** 2026-05-09

Sensor corruption benchmarks evaluate how perception models behave when inputs are degraded by sensor faults, synchronization errors, calibration drift, point loss, motion blur, cross-talk, incomplete echoes, and adverse-condition corruptions. This page focuses on robustness benchmark design rather than weather dataset coverage, which is handled separately in the weather robustness dataset index.

---

## Scope

| Benchmark family | Core question | Best use |
|---|---|---|
| Robo3D | How robust are LiDAR semantic segmentation, panoptic segmentation, and 3D detection models to common point-cloud corruptions? | LiDAR-only corruption screening and cross-dataset stress tests. |
| MultiCorrupt | How robust are LiDAR-camera 3D object detectors to camera, LiDAR, weather, and alignment corruptions on nuScenes-style data? | Fusion robustness, missing-modality tests, and calibration/synchronization sensitivity. |
| MSC-Bench | How robust are multimodal 3D detection and HD map construction models under multi-sensor corruptions? | End-to-end BEV/fusion perception stress tests, including map-construction degradation. |

These benchmarks are useful because clean validation accuracy hides brittleness. A model with high clean NDS, mAP, or mIoU may fail sharply when a camera frame is missing, a LiDAR beam group drops out, or camera-LiDAR calibration shifts.

---

## What They Measure

| Failure mode | Example corruptions | Validation signal |
|---|---|---|
| Environmental corruption | Fog, snow, wet ground | Robustness to visible and point-cloud degradation. |
| Camera degradation | Missing camera, brightness, darkness, motion blur, frame loss | Sensitivity to camera availability and image quality. |
| LiDAR degradation | Beam reducing, point reducing, beam missing, cross-talk, incomplete echo | Robustness to sparse or physically corrupted point clouds. |
| Fusion misalignment | Spatial misalignment, temporal misalignment, cross-sensor perturbation | Dependence on calibration and synchronization assumptions. |
| Multi-corruption interaction | Sensor crash with echo/talk/cross-sensor combinations | Whether models fail under combined faults, not only isolated corruptions. |

The benchmark target is not "weather robustness" alone. The main value is controlled perturbation across sensor and fusion failure modes.

---

## Sensors And Labels

| Benchmark | Modalities | Label/task basis |
|---|---|---|
| Robo3D | LiDAR point clouds from established datasets such as SemanticKITTI, nuScenes, KITTI, and Waymo Open Dataset variants | Semantic segmentation mIoU, panoptic segmentation, and 3D detection metrics depending on task. |
| MultiCorrupt | LiDAR-camera fusion data derived from nuScenes-style 3D detection workflows | nuScenes detection score and mAP for multimodal 3D object detection. |
| MSC-Bench | Camera and LiDAR inputs for 3D object detection and HD map construction | NDS for 3D detection and mAP/AP-style map construction metrics. |

Labels generally come from the underlying clean datasets. The corruption benchmark changes the input stream while preserving the evaluation target, which allows clean-to-corrupt degradation to be measured directly.

---

## Metrics And Tasks

| Metric | Meaning |
|---|---|
| Clean task metric | mIoU, PQ, NDS, mAP, or AP on the uncorrupted validation set. |
| Corrupt task metric | Same task metric under corruption type and severity. |
| mCE | Mean corruption error relative to a baseline; lower is better. |
| mRR | Mean resilience rate relative to clean performance; higher is better. |
| RA / mRA | Resistance ability across corruption types and severities. |
| RRA / mRRA | Relative resistance ability compared with a baseline model. |
| RS / RRS | Resilience score and relative resilience score in MSC-Bench-style reporting. |

For safety validation, always retain the raw per-corruption table. Aggregate robustness metrics can hide a single unacceptable failure mode such as missing pedestrians under temporal misalignment or losing map dividers under camera frame loss.

---

## Benchmark Strengths

- Provides repeatable perturbations with severity levels, enabling regression tests.
- Separates clean accuracy from robustness under foreseeable sensor degradation.
- Covers calibration and synchronization errors that many weather datasets do not test.
- MultiCorrupt and MSC-Bench expose multimodal fusion assumptions rather than LiDAR-only behavior.
- Robo3D supports LiDAR semantic segmentation and detection-style screening across multiple base datasets.
- Metrics such as mCE, mRR, RA, and RRA make robustness comparable across models.

---

## Gaps And Risks

- Corruptions are approximations; they are not a substitute for target-domain sensor fault injection and recorded failures.
- Weather corruptions do not capture all airport phenomena such as de-icing mist, jet blast dust, heated exhaust shimmer, glass reflections, and apron lighting glare.
- Most benchmarks preserve labels from clean datasets, so they may not expose label uncertainty introduced by actual degradation.
- Public-road categories do not cover aircraft, GSE, jet bridges, stand equipment, cones, chocks, or FOD.
- A model can improve aggregate robustness by being conservative while still failing safety-critical rare classes.

---

## AV And Airside Fit

| Airside validation need | Fit | How to use |
|---|---|---|
| Missing camera or sensor outage | Strong | Use missing-camera, camera crash, frame loss, and cross-sensor slices before airport-specific fault injection. |
| LiDAR point loss and beam faults | Strong | Use beam/point reducing, beam missing, cross-talk, and incomplete echo as pre-airside stress tests. |
| Calibration drift | Strong | Use spatial and temporal misalignment slices to set monitor thresholds. |
| Apron semantic taxonomy | Weak | Requires target-domain labels. |
| FOD perception | Weak proxy | Small debris needs dedicated FOD datasets and physical validation. |
| HD map construction degradation | Moderate to strong | MSC-Bench is useful where BEV map construction is part of the perception stack. |

For airport autonomy, treat these as bench tests that must precede apron scenario tests. They are good at exposing model brittleness early, but they cannot close the safety claim without airside recordings and sensor-specific fault-injection evidence.

---

## Implementation And Evaluation Notes

1. Evaluate clean, single-corruption, and selected multi-corruption cases. Do not skip clean results because resilience metrics depend on clean performance.
2. Pin corruption severity definitions and benchmark commit IDs in each experiment record.
3. Report class-level metrics for safety-critical classes rather than only aggregate NDS, mAP, or mIoU.
4. Keep sensor health monitor outputs in the log. A robust perception score is not enough if the system fails to recognize it is degraded.
5. Use calibration and timestamp perturbations to set operational thresholds for camera-LiDAR alignment monitors.
6. Add an "airside transfer" row to every benchmark report: which corruption maps to which airport hazard, and which hazards remain untested.
7. Run the same model checkpoint across all corruption suites where possible; otherwise separate architecture gains from robustness claims.

---

## Sources

- [Robo3D GitHub repository](https://github.com/worldbench/Robo3D)
- [Robo3D arXiv paper](https://arxiv.org/abs/2303.17597)
- [MultiCorrupt GitHub repository](https://github.com/ika-rwth-aachen/MultiCorrupt)
- [MultiCorrupt dataset on Hugging Face](https://huggingface.co/datasets/TillBeemelmanns/MultiCorrupt)
- [MSC-Bench project page](https://msc-bench.github.io/)
