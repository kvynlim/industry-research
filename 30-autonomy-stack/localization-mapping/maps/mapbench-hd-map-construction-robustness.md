# MapBench HD Map Construction Robustness

**Last updated:** 2026-05-09

MapBench is a NeurIPS 2024 robustness benchmark for HD map construction under camera and LiDAR corruptions. It is important because map constructors often look strong on clean nuScenes validation data, but safety-relevant deployment needs to know how lane-divider, boundary, and crossing maps degrade when sensors face fog, snow, wet ground, motion blur, missing beams, and failures.

**Related pages:** [map construction pipeline](map-construction-pipeline.md), [SLAM map benchmark protocol](../../../60-safety-validation/verification-validation/slam-map-benchmark-protocol.md), [sensor corruption robustness benchmarks](../../perception/datasets-benchmarks/sensor-corruption-robustness-benchmarks.md)

---

## Scope

| Item | MapBench coverage |
|---|---|
| Primary domain | HD map construction from camera and LiDAR inputs |
| Base dataset | nuScenes validation set with controlled corruptions |
| Corruptions | 29 total camera/LiDAR corruption cases |
| Single-sensor corruption groups | Camera and LiDAR exterior, interior/sensor, and failure scenarios |
| Multi-sensor corruptions | 13 combined camera/LiDAR sensor-failure cases |
| Evaluated methods | 31 HD map constructors across camera-only, LiDAR-only, and fusion configurations |

The benchmark is not a map-change dataset. It asks whether a constructor can produce reliable vector map elements when sensor inputs are degraded.

---

## Sensors And Labels

| Asset | Notes |
|---|---|
| Camera inputs | Corruptions include examples such as brightness, low light, fog, snow, motion blur, and color quantization |
| LiDAR inputs | Corruptions include wet ground, fog, snow, motion blur, beam missing, crosstalk, incomplete echo, and cross-sensor cases |
| HD map elements | Pedestrian crossings, lane dividers, and road boundaries are the headline map classes |
| Input configurations | Camera-only, LiDAR-only, and camera-LiDAR fusion map construction |
| Severity | Easy, moderate, and hard severity levels |

The practical value is the combination of map-construction outputs with sensor-corruption slices, rather than object-detection-style corruptions alone.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Clean HD map construction | AP/mAP for divider, boundary, and pedestrian crossing |
| Corrupted map construction | AP/mAP under each corruption and severity |
| Robustness ranking | Relative drop from clean to corrupted inputs |
| Modality stress | Camera-only, LiDAR-only, and fusion degradation comparison |
| Release screening | Worst-slice performance and catastrophic topology errors |

For production map QA, add geometry checks that MapBench does not fully cover: route graph validity, geofence consistency, localization residuals, and false-free-space hazards.

---

## Best Use

Use MapBench to:

- screen map construction models for sensor-corruption brittleness;
- compare camera-only, LiDAR-only, and fusion map constructors;
- test whether augmentation improves robustness or only clean AP;
- build a corruption checklist for airport HD-map pipelines;
- choose which public corruptions should be replayed on private airport data.

It is a good public complement to object-detection corruption suites because map construction has different failure modes: missing dividers, shifted boundaries, broken topology, and false map elements.

---

## Airside Transfer

Airside maps include stand lead-in lines, stop bars, safety envelopes, service roads, geofences, no-go regions, and temporary closures. MapBench helps design airport map robustness tests:

- wet-ground and fog/snow corruptions for apron markings;
- camera/LiDAR failure combinations for map-construction fallback;
- per-element degradation reporting for markings, boundaries, and crossings;
- severity ladders before moving to real rain, glare, and sensor blockage logs.

Airport-specific acceptance must add classes and constraints that nuScenes does not contain: stand geometry, aircraft safety zones, jet bridge envelopes, blast fences, cones, chocks, FOD/hazard layers, and operational map-publication rules.

---

## Limitations

- Built on nuScenes road scenes, not airport aprons.
- Focuses on HD map construction, not runtime localization or map lifecycle approval.
- Corruptions are controlled benchmark perturbations, not a substitute for real sensor logs.
- It evaluates common road map elements, not airport stand or ramp semantics.
- A high corrupted AP does not prove route graph, geofence, or localization safety.

---

## Sources

- [MapBench project page](https://mapbench.github.io/)
- [MapBench arXiv paper](https://arxiv.org/abs/2406.12214)
- [MapBench code link from project page](https://github.com/haoxs23/MapBench)
