# RainSense

**Last updated:** 2026-05-09

RainSense is a multi-sensor autonomous-driving perception dataset collected under natural rainfall with fine-grained rainfall intensity annotations. Its main value is not dense point-wise rain labels, but calibrated rain-rate stratification across camera, LiDAR, and 4D radar data.

**Related pages:** [dataset index](weather-robustness-datasets.md), [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## What It Measures

RainSense measures how perception sensors degrade as natural rainfall intensity increases. The SAE record describes 728 ten-second cases across five conditions:

| Condition | Cases |
|---|---:|
| Clear | 145 |
| Light rain | 214 |
| Moderate rain | 204 |
| Heavy rain | 98 |
| Torrential rain | 67 |

The dataset uses a laser-optical disdrometer to measure rainfall intensity in mm/h while synchronized sensor data is recorded. This makes RainSense useful for setting quantitative operating thresholds such as "LiDAR confidence falls below target at this rain intensity, but radar remains stable."

---

## Sensors And Modalities

| Modality | Notes |
|---|---|
| Camera | Image degradation and blur under rainfall |
| LiDAR | Point sparsity and weakened returns under rain |
| 4D mmWave radar | Weather-resilient comparison channel |
| Laser-optical disdrometer | High-precision rain intensity measurement, identified as Parsivel-2 in the GitHub README |
| Static/dynamic targets | Dummy target placed at different distances in representative scenes |

---

## Labels And Tasks

| Label type | Use |
|---|---|
| 2D target boxes | Camera detection degradation by rain level |
| 3D target boxes | LiDAR/radar target detection under rain |
| Rain intensity annotation | Response curves by mm/h and rain class |
| 10-second case windows | Sensor stability and temporal degradation |

RainSense supports sensor performance characterization, SOTIF trigger analysis, target detection under rain, and radar-vs-LiDAR robustness comparisons.

---

## Weather And Environment

The SAE abstract states that RainSense was recorded in nine representative campus intersection scenarios under natural rain. The GitHub README describes five rainfall levels: clear, light, medium, heavy, and torrential.

Because rainfall is natural and measured, RainSense is more suitable than synthetic data for validating rain-rate thresholds. It is less suitable for broad object taxonomy testing because the SAE abstract describes a single dummy target placed at various distances.

---

## Benchmark Use For Perception And Removal

Use RainSense to validate:

- camera blur and detection loss as rainfall increases;
- LiDAR point-count and intensity degradation by rain class;
- radar stability across rain levels;
- rain-aware confidence calibration;
- operational rain thresholds for slow, stop, or radar-primary modes.

For removal validation, RainSense should be paired with REHEARSE-3D. Use REHEARSE-3D for point-wise rain removal, then use RainSense to check whether the cleaned perception stack behaves better under real rainfall intensity bins.

---

## Strengths

- Natural rainfall rather than only simulated rain.
- Fine-grained rain intensity measurement with a disdrometer.
- Camera, LiDAR, and 4D radar recorded synchronously.
- Clear distribution across rain levels.
- Open GitHub repository and release metadata are available.

---

## Limitations

- The SAE abstract describes a single dummy target rather than dense real traffic.
- It is intersection/campus data, not full-route driving.
- It is rain-focused and does not cover snow, fog, dust, steam, or de-icing spray directly.
- Labels are target boxes, not dense point-wise rain/no-rain annotations.
- Published paper access is through SAE; verify license and download terms before redistribution.

---

## Airside Transfer

RainSense is useful for airside rainfall ODD definition:

- define rain-rate thresholds for LiDAR degradation;
- validate radar as the stable modality under heavy/torrential rain;
- test target detection at known ranges under measured rainfall;
- calibrate perception health monitors against mm/h rather than vague weather tags.

It is a weak proxy for de-icing mist because the particle type, temperature, and sensor-window contamination differ from natural rain. Treat it as a rain-intensity baseline, not a glycol-spray validation set.

---

## Sources

- [SAE paper record: RainSense](https://saemobilus.sae.org/papers/rainsense-autonomous-driving-environmental-perception-dataset-rain-intensity-annotations-2025-01-7311)
- [RainSense GitHub repository](https://github.com/IVtest-Lab/RainSense)
