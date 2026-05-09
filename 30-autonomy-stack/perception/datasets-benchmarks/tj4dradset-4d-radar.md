# TJ4DRadSet 4D Radar

**Last updated:** 2026-05-09

TJ4DRadSet is an ITSC 2022 4D radar dataset for autonomous-driving perception. It provides synchronized and calibrated 4D radar, LiDAR, and camera data in KITTI-like format, with 3D boxes and track IDs, and is widely used for radar-only and radar-camera 3D detection baselines.

**Related pages:** [4D radar sensor overview](../../../20-av-platform/sensors/4d-radar.md), [View-of-Delft](view-of-delft-4d-radar.md), [Dual-Radar](dual-radar-4d-radar-adverse-weather.md)

---

## Scope

| Item | TJ4DRadSet coverage |
|---|---|
| Primary domain | Road driving in urban roads, elevated roads, and industrial zones |
| Scale | 7757 synchronized frames in 44 consecutive sequences |
| Conditions | Normal lighting, bright light, and darkness |
| Main use | 4D radar 3D detection and radar fusion |
| Format | KITTI-style folder structure, calibration, splits, and label files |

TJ4DRadSet is especially useful for teams that want a straightforward KITTI-style entry point into 4D radar point-cloud detection.

---

## Sensors And Labels

| Asset | Notes |
|---|---|
| 4D radar | Point-cloud detections with x, y, z, radial velocity, range, power, horizontal angle, and vertical angle |
| Camera | Synchronized camera imagery and calibration |
| LiDAR | Synchronized LiDAR listed in the dataset description; public release policy should be checked by subset |
| Calibration | Camera intrinsic and radar/camera extrinsic calibration in KITTI format |
| Labels | KITTI-style 3D object annotations and track IDs |

The GitHub README notes that, due to policy restrictions, the current public release focuses on the complete 4D radar data.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Radar-only 3D detection | 3D AP and BEV AP by class/range |
| Multi-frame radar detection | AP gain from temporal aggregation and Doppler use |
| Radar-camera fusion | AP gain over radar-only with image features |
| Tracking | Track continuity and ID-switch analysis using track IDs |
| Radar representation | Point, pillar, voxel, and BEV encoder ablations |

Use the KITTI-like structure for reproducible splits, but report sensor subset explicitly. "4D radar only" and "radar plus camera" are not the same benchmark.

---

## Best Use

Use TJ4DRadSet to:

- bring up a 4D radar data loader and detector quickly;
- compare radar point encoders on a public KITTI-style format;
- test Doppler/radial-velocity features in detection;
- benchmark radar-camera fusion against View-of-Delft and Dual-Radar;
- study radar detection in bright light and darkness where camera-only methods may degrade.

It is a good companion to View-of-Delft: VoD is mature and urban, while TJ4DRadSet adds a different radar platform, road mix, and lighting coverage.

---

## Airside Transfer

TJ4DRadSet can inform radar perception for airport vehicles by exercising:

- sparse point-cloud detection with radial velocity;
- radar-camera fusion in bright glare and darkness;
- KITTI-style training/evaluation infrastructure that can later ingest airport radar logs;
- multi-frame radar aggregation for slow-moving GSE and pedestrians.

Final airport evaluation must replace road classes and scenes with aircraft, ramp equipment, stand markings, cones, chocks, service roads, wet apron reflections, and de-icing/spray conditions.

---

## Limitations

- It is a road dataset and not designed around adverse weather, FOD, or airport operations.
- Current public access may not include all modalities at full scope due to policy restrictions.
- Dataset access is non-commercial and eligibility-limited.
- It is smaller than newer large-scale radar datasets.
- Radar points are preprocessed detections, not necessarily raw radar tensors.

---

## Sources

- [TJ4DRadSet GitHub repository](https://github.com/TJRadarLab/TJ4DRadSet)
- [TJ4DRadSet arXiv paper](https://arxiv.org/abs/2204.13483)
- [TJ4DRadSet IEEE DOI](https://doi.org/10.1109/ITSC55140.2022.9922539)
