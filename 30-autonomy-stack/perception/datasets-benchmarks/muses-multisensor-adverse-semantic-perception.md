# MUSES Multi-Sensor Adverse Semantic Perception

**Last updated:** 2026-05-09

MUSES is an ECCV 2024 multi-sensor semantic perception dataset for dense 2D understanding under adverse conditions and uncertainty. It is useful when a validation program needs more than camera-only adverse-weather evidence: each scene combines RGB imagery with LiDAR, radar, event-camera, and GNSS/IMU context, and the benchmark targets semantic, panoptic, uncertainty-aware panoptic, and detection-style perception tasks.

This page treats MUSES as a robustness and fusion benchmark. It does not replace weather-specific LiDAR datasets or an airport-apron validation set.

---

## Scope

| Scope item | Coverage |
|---|---|
| Primary domain | Public-road driving under clear and adverse visual conditions |
| Main use | Dense semantic perception, panoptic segmentation, and uncertainty-aware evaluation |
| Dataset size | 2,500 multi-modal scenes in the public SDK description |
| Sensor emphasis | RGB frame camera as the annotated view, supported by LiDAR, radar, event camera, and GNSS/IMU |
| Benchmark emphasis | Robust dense perception under uncertainty, not SLAM accuracy or airside object taxonomy |

MUSES is best used to answer whether a perception stack can use complementary modalities to keep semantic parsing reliable when the image is degraded, rather than treating weather as a single scalar applied uniformly to every sensor.

---

## What It Measures

MUSES measures dense semantic perception under conditions where visual evidence is uncertain, degraded, or only recoverable with support from other sensors. The paper introduces multi-modal recordings with 2D panoptic annotations for images captured under varied weather and illumination, and frames uncertainty-aware panoptic segmentation as a key task.

For autonomy validation, the useful measurement questions are:

- Does panoptic quality degrade gracefully across clear, rain, fog, snow, day, and night slices?
- Do LiDAR, radar, and event-camera projections help preserve labels in camera regions affected by adverse conditions?
- Does the model expose uncertainty where class or instance boundaries are ambiguous?
- Does fusion improve small-object and drivable-area parsing without hallucinating structure from sparse modalities?

---

## Sensors And Labels

| Asset | Notes |
|---|---|
| Frame camera | Primary annotated image stream; anonymized images are available in the release. |
| LiDAR | Used as a complementary modality and can be projected into the camera frame through SDK utilities. |
| Radar | Useful for studying robustness when camera evidence is weak or motion/reflectivity cues matter. |
| Event camera | Provides asynchronous visual evidence for high-dynamic-range and difficult illumination cases. |
| GNSS/IMU | Supports motion context and scene metadata; not sufficient for SLAM benchmarking by itself. |
| Calibration and metadata | Release structure includes calibration and metadata files. |
| Labels | Panoptic, semantic, uncertainty, and detection annotations are described in the SDK layout. |
| Reference frames | Clear-weather/daytime reference images are provided for corresponding adverse-condition scenes. |

The annotation process is important: MUSES uses the available sensor data to label image regions that may be degraded in the frame camera but still discernible in other modalities. That makes the dataset especially relevant for evaluating whether annotation and model training treat "hard to see in RGB" differently from "not present."

---

## Metrics And Tasks

| Task | Metrics and outputs |
|---|---|
| Semantic segmentation | Class mIoU, per-condition mIoU, class-wise degradation from clear to adverse slices |
| Panoptic segmentation | PQ, RQ, SQ, thing/stuff split, per-condition PQ |
| Uncertainty-aware panoptic segmentation | AUPQ-style uncertainty-aware panoptic quality from the SDK |
| Object detection | Detection AP by class and condition where detection labels are used |
| Challenge-style robustness | Weather-aware wPQ, wRQ, and wSQ in the URVIS MUSES-AXPS challenge |

For production screening, report both clean and adverse scores. A model that maximizes aggregate PQ by ignoring adverse slices is not acceptable evidence for an ODD that includes night, fog, snow, rain, apron glare, or degraded camera regions.

---

## Strengths

- Combines RGB, LiDAR, radar, event camera, and GNSS/IMU in one semantic perception dataset.
- Provides dense panoptic and semantic labels instead of only object boxes.
- Includes explicit uncertainty-aware evaluation, which is rare in public adverse-condition perception datasets.
- Clear/adverse reference framing supports degradation analysis rather than only single-frame scoring.
- SDK exposes loading, projection, visualization, motion compensation, and AUPQ computation utilities.
- Public benchmarks are available on Codabench for semantic and panoptic segmentation.

---

## Gaps And Risks

- It is a road-driving dataset, not an airport-apron or runway dataset.
- The annotated view is 2D camera-centric; it is not a direct LiDAR semantic segmentation benchmark like SemanticSTF.
- It does not validate SLAM, localization observability, map maintenance, or loop-closure robustness.
- Airside objects such as aircraft, tugs, belt loaders, dollies, chocks, cones, jet bridges, and workers require a separate target-domain class map.
- Event-camera and radar fusion maturity may vary across baselines; do not assume all models use every modality effectively.
- Non-commercial license terms must be reviewed before commercial use.

---

## AV And Airside Fit

| Use case | Fit | Notes |
|---|---|---|
| Multimodal adverse semantic perception | Strong | Good public benchmark for camera-centric dense perception with complementary sensors. |
| Uncertainty-aware segmentation | Strong | Directly aligned with MUSES AUPQ and uncertainty labels. |
| Sensor-fusion fallback analysis | Moderate | Useful for modality ablations, but still road-domain and 2D-label focused. |
| Airport apron perception | Moderate proxy | Useful before airside data collection; not a substitute for apron-specific labels. |
| FOD detection | Weak | FOD is too small and domain-specific for final evidence. |
| SLAM/localization validation | Weak | Use only as perception context, not as SLAM ground truth. |

For airside autonomy, MUSES should sit early in the evidence chain: first prove the model can handle multi-sensor adverse semantic perception on public data, then repeat the same analysis on local apron data with airside classes and hazards.

---

## Implementation And Evaluation Notes

1. Start with RGB-only semantic and panoptic baselines, then add projected LiDAR, radar, and event-camera channels one at a time.
2. Report per-condition performance rather than only the aggregate validation score.
3. Include a modality-ablation table: RGB, RGB+LiDAR, RGB+radar, RGB+event, and full fusion.
4. Track uncertainty calibration separately from segmentation quality. A model can segment well but be overconfident in degraded regions.
5. For airside transfer, remap outputs into a narrower safety ontology: drivable surface, fixed infrastructure, vehicle/equipment, person, aircraft, unknown obstacle, and void/uncertain.
6. Preserve raw sensor timestamps and calibration versions in experiment artifacts so fusion regressions can be traced to data alignment rather than model changes.
7. Treat URVIS MUSES-AXPS weather-aware scores as robustness evidence, not as final safety acceptance criteria.

---

## Sources

- [MUSES GitHub SDK](https://github.com/timbroed/MUSES)
- [MUSES arXiv paper](https://arxiv.org/abs/2401.12761)
- [URVIS 2026 MUSES-AXPS challenge page](https://urvis-workshop.github.io/challenge-Muses.html)
- [MUSES dataset download site](https://muses.ethz.ch/)
- [MUSES panoptic segmentation benchmark on Codabench](https://www.codabench.org/competitions/13987/)
- [MUSES semantic segmentation benchmark on Codabench](https://www.codabench.org/competitions/14005/)
