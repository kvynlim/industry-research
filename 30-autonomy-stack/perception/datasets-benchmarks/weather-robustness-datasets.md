# Weather Robustness Datasets for Perception and Artifact Removal

**Last updated:** 2026-05-09

This index summarizes adverse-weather driving datasets that are useful for validating perception degradation, LiDAR artifact removal, and sensor-fusion fallback behavior. The emphasis is not only algorithm selection, but also whether the validation data can expose failures caused by snow, rain, fog, wet-road spray, steam-like aerosol, dust-like obscurants, and asymmetric sensor degradation.

**Related research pages:** [LiDAR artifact removal techniques](../overview/lidar-artifact-removal-techniques.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [production perception systems](../overview/production-perception-systems.md)

---

## Dataset Coverage Matrix

| Dataset | Primary adverse condition | Modalities | Labels | Best validation use |
|---|---|---|---|---|
| [WADS](wads-winter-adverse-driving-dataset.md) | Falling snow, accumulated snow, whiteout-like winter driving | LiDAR, visible/NIR/LWIR cameras, radar, GNSS/IMU | Dense point-wise LiDAR labels with snow classes | Snow removal, snow segmentation, snow-aware mapping |
| [CADC / CADC+](cadc-cadc-plus.md) | Canadian winter driving, paired snow and clear sequences | 8 cameras, VLP-32C LiDAR, GNSS/INS | 3D boxes; CADC+ adds paired clear/snow evaluation | Snow domain shift, de-snowing, 3D detection degradation |
| [SemanticSTF](semanticstf.md) | Rain, snow, light fog, dense fog | LiDAR, RGB imagery, calibration/weather metadata | Dense point-wise semantic labels | All-weather 3D semantic segmentation and domain generalization |
| [REHEARSE-3D](rehearse-3d.md) | Emulated heavy rain | LiDAR-256, 4D radar, rain-characteristic metadata | Point-wise rain/no-rain annotations | LiDAR point-cloud de-raining and radar-conditioned removal |
| [RainSense](rainsense.md) | Natural rainfall with measured intensity | Camera, LiDAR, 4D mmWave radar, disdrometer | 2D/3D target boxes by 10-second case | Rain-intensity response curves and modality degradation |
| [SemanticSpray++](semantic-spray.md) | Wet road surface and road spray | Camera, VLP32C LiDAR, Ibeo LiDARs, Aptiv radar | Camera 2D boxes, LiDAR 3D boxes/semantics, radar semantics | Spray/wet-road robustness and radar-LiDAR fusion checks |
| [RADIATE](radiate.md) | Rain, fog, snow, night, clear baselines | Navtech radar, stereo camera, 32-channel LiDAR, GPS/IMU | 2D radar-image boxes for 8 actor classes | Radar-first adverse-weather detection and fusion fallback |
| [Seeing Through Fog / DENSE](seeing-through-fog-dense.md) | Fog, snow, rain, fog chamber conditions | RGB stereo, gated NIR, FIR, radar, HDL64/VLP32 LiDAR, weather station | 2D/3D boxes, weather/illumination/road-state tags | Multimodal fog/fusion validation and asymmetric failure studies |

---

## Coverage by Airside Hazard

| Airside hazard | Strongest public proxies | What to validate |
|---|---|---|
| Falling snow | WADS, SemanticSTF, CADC | Snowflake clutter removal, snowbank segmentation, detection drop under sparse returns |
| Accumulated snow and ice | WADS, CADC/CADC+ | Drivable-area ambiguity, snowbank map drift, clear-vs-snow domain adaptation |
| Natural rain | RainSense, RADIATE, SemanticSTF | Point-density loss, camera blur, radar stability, rain-rate operating limits |
| Heavy rain artifacts | REHEARSE-3D, RainSense | Point-wise raindrop removal and radar-conditioned filtering |
| Wet-road spray | SemanticSpray++, RADIATE | Spray clutter, wet-surface reflection, radar/LiDAR disagreement |
| Fog and steam-like aerosol | Seeing Through Fog/DENSE, RADIATE, SemanticSTF | Visibility reduction, LiDAR wobble/clutter, gated/FIR/radar fallback |
| Dust and sand | No strong direct match in this set | Treat fog/spray/snow-dust data as partial proxy; collect airside dust/jet-blast samples |
| De-icing mist and glycol spray | SemanticSpray++, REHEARSE-3D, Seeing Through Fog/DENSE | Short-duration LiDAR occlusion, radar-primary fallback, sensor-cleaning trigger thresholds |

The key gap is dust/steam/de-icing fluid realism. Existing public data provides useful particle and aerosol proxies, but an airside validation program still needs local recordings around jet blast, de-icing trucks, apron dust, rubber residue, and sensor-window contamination.

---

## Recommended Validation Stack

1. **Point-level removal first:** use WADS for falling/accumulated snow, REHEARSE-3D for rain-point removal, and SemanticSTF for all-weather semantic segmentation stress tests.
2. **Object-level degradation next:** use CADC/CADC+ for snow-vs-clear 3D detection, RainSense for measured rain-rate curves, RADIATE for radar-first adverse-weather detection, and SemanticSpray++ for wet-road spray.
3. **Fusion robustness last:** use Seeing Through Fog/DENSE and RADIATE to validate that radar, gated NIR, FIR, camera, and LiDAR degrade asymmetrically rather than assuming one weather scalar applies to every sensor.
4. **Airside transfer gate:** after public-dataset screening, require a proprietary airside set with aircraft, GSE, cones, baggage carts, jet bridges, reflective markings, de-icing mist, dust, and heated exhaust plumes before production claims.

---

## Practical Selection Guidance

| If the model does this | Start with | Then add |
|---|---|---|
| LiDAR snow removal | WADS | SemanticSTF, CADC |
| LiDAR rain removal | REHEARSE-3D | RainSense |
| Weather-aware semantic segmentation | SemanticSTF | WADS |
| Snow domain adaptation or de-snowing | CADC+ | WADS |
| Radar fallback in adverse weather | RADIATE | RainSense, SemanticSpray++ |
| Fog/steam sensor fusion | Seeing Through Fog/DENSE | RADIATE |
| Spray robustness | SemanticSpray++ | RainSense, REHEARSE-3D |

---

## Source Notes

- WADS source records: [Michigan Tech dataset page](https://digitalcommons.mtu.edu/all-datasets/20/) and [Michigan Tech publication record](https://digitalcommons.mtu.edu/michigantech-p/16990/)
- CADC/CADC+: [CADC arXiv paper](https://arxiv.org/abs/2001.10117), [CADC+ project page](https://uwaterloo.ca/waterloo-intelligent-systems-engineering-lab/cadc-plus), [CADC+ arXiv paper](https://arxiv.org/abs/2506.16531)
- SemanticSTF: [GitHub](https://github.com/xiaoaoran/SemanticSTF), [Hugging Face](https://huggingface.co/datasets/AR-X/SemanticSTF), [CVPR 2023 arXiv paper](https://arxiv.org/abs/2304.00690)
- REHEARSE-3D: [arXiv paper](https://arxiv.org/abs/2504.21699), [Sensors article](https://www.mdpi.com/1424-8220/26/2/728)
- RainSense: [SAE paper record](https://saemobilus.sae.org/papers/rainsense-autonomous-driving-environmental-perception-dataset-rain-intensity-annotations-2025-01-7311), [GitHub release repository](https://github.com/IVtest-Lab/RainSense)
- SemanticSpray++: [project page](https://semantic-spray-dataset.github.io/), [arXiv paper](https://arxiv.org/abs/2406.09945)
- RADIATE: [project page](https://pro.hw.ac.uk/radiate/), [dataset documentation](https://pro.hw.ac.uk/radiate/doc/dataset/), [arXiv paper](https://arxiv.org/abs/2010.09076)
- Seeing Through Fog/DENSE: [GitHub](https://github.com/princeton-computational-imaging/SeeingThroughFog), [Princeton dataset page](https://light.princeton.edu/datasets/automated_driving_dataset/), [DENSE dataset page](https://www.uni-ulm.de/en/in/institute-of-measurement-control-and-microtechnology/research/data-sets/dense-datasets/)
