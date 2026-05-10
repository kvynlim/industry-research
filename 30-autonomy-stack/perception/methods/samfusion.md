# SAMFusion

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "architecture-pattern"
  stage: "frontier"
  maturity: "research"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "SAMFusion is rated for open-world perception, annotation leverage, and long-tail validation workflows."
method-priority:end -->

## Executive Summary

- SAMFusion is a sensor-adaptive multimodal 3D object detector for adverse weather.
- It fuses RGB cameras, LiDAR, radar, and NIR gated cameras, targeting failure modes that standard RGB-LiDAR fusion misses.
- The method uses attentive depth-based blending and BEV refinement to combine image and range evidence.
- A transformer decoder weights modalities based on distance and visibility, which is central to its adverse-weather behavior.
- SAMFusion reports large gains for vulnerable pedestrians at long range in foggy scenes, where conventional RGB-LiDAR fusion struggles.
- For airport, port, mine, and yard autonomy, SAMFusion is important because it treats visibility and sensor reliability as first-class fusion variables.

## Problem Fit

- Use SAMFusion when the ODD includes fog, snow, rain, low light, twilight, night, soiling, or other visibility degradation.
- It is most relevant for platforms that can carry richer sensor suites than camera-only or LiDAR-camera-only systems.
- It fits safety-critical detection where pedestrians or workers at range must remain detectable under bad visibility.
- It is less suitable for minimal low-cost platforms because gated NIR cameras and multi-sensor calibration add hardware and operational cost.
- It is an object detector, not a dense freespace or occupancy model.
- It should be considered when a system needs sensor-adaptive fusion rather than fixed feature concatenation.

## Method Mechanics

- SAMFusion extracts features from RGB/gated camera, LiDAR, and radar inputs.
- It transforms modalities into a depth-aware representation so image features and range features can be blended more coherently.
- The multimodal encoder performs attentive blending, combining image and range features while accounting for sensor-specific strengths.
- BEV refinement combines camera-specific features with range features for spatially grounded proposals.
- The decoder proposal module adapts weighting with distance, reflecting that cameras, LiDAR, radar, and gated cameras have different useful ranges and failure modes.
- A transformer decoder refines detection outputs while weighting modalities based on distance and visibility.
- The method is evaluated on adverse-weather settings, including fog, snow, rain, twilight, and night.
- Its design is broader than radar-camera or LiDAR-camera fusion because it explicitly includes gated NIR imaging as a low-light and fog-relevant modality.

## Inputs and Outputs

- Input: RGB camera images with intrinsics, extrinsics, timestamps, and exposure metadata.
- Input: NIR gated camera images or gated range-relevant imagery where available.
- Input: LiDAR point clouds with calibration and timestamps.
- Input: radar detections or radar features with range and velocity information.
- Optional input: visibility estimates, weather metadata, soiling state, and sensor health diagnostics.
- Output: 3D object detections with class, box, score, and orientation.
- Optional output: modality attention weights, BEV proposal maps, and visibility-conditioned fusion diagnostics.
- Downstream output after tracking: worker, pedestrian, vehicle, and equipment tracks with weather-aware confidence.

## Assumptions

- The platform can synchronize and calibrate RGB, gated camera, LiDAR, and radar streams.
- The deployment ODD justifies the additional hardware and maintenance burden.
- Gated camera data is available and matched to the adverse-weather scenarios that matter.
- Visibility estimates or learned attention weights remain calibrated under new weather, sensor aging, and lens contamination.
- The classes in the training data cover the safety-critical actors in the target site.
- Sensor failures are diagnosed; fusion attention is not a substitute for hardware health monitoring.

## Strengths

- Uses complementary sensors with genuinely different physical failure modes.
- Treats distance and visibility as fusion variables, not only spatial alignment variables.
- Gated cameras improve perception in low light and some fog scenarios where RGB cameras degrade.
- Radar provides long-range and weather-resistant cues, especially for moving actors.
- LiDAR provides metric geometry when returns are reliable.
- The project reports strong pedestrian gains in challenging fog and long-range scenes.
- The architecture gives a useful template for safety-oriented multimodal fusion beyond standard camera-LiDAR stacks.

## Limitations and Failure Modes

- More sensors mean more calibration, synchronization, thermal, cleaning, and maintenance work.
- Gated camera performance depends on illumination, gating configuration, and scene reflectance.
- Radar can create ghosts near metal, glass, wet surfaces, vehicles, and aircraft.
- LiDAR can degrade under fog, snow, rain, spray, and backscatter.
- Adaptive fusion can overtrust a modality if confidence or visibility estimation is wrong.
- Public evaluation may not cover airport-specific reflective geometry, jet blast dust, de-icing mist, or glycol residue.
- A box detector still does not represent all free space, overhangs, or irregular obstacle extents.

## Evaluation Notes

- Report performance separately for clear day, rain, snow, fog, twilight, night, and soiling if available.
- Split AP by class and distance; SAMFusion's value is especially visible for vulnerable pedestrians at long range and low visibility.
- Compare against LiDAR-RGB, radar-camera, LiDAR-only, camera-only, and gated-camera variants.
- Evaluate modality-drop and sensor-failure cases, including blocked camera, dirty LiDAR cover, missing radar, and gated-camera exposure errors.
- Include calibration perturbation tests across all sensor pairs.
- Track runtime and sensor latency separately; a rich sensor suite can create hidden timing debt.
- For deployment, inspect false positives in fog/backscatter and false negatives near reflective equipment.

## AV and Indoor/Outdoor Relevance

- On-road AVs: strong fit for adverse-weather and nighttime pedestrian/vehicle detection.
- Airport AVs: high relevance for fog, rain, de-icing mist, night floodlights, reflective surfaces, and workers at range.
- Indoor robots: useful in smoke, steam, low light, and dust if hardware can be packaged, but radar/gated-camera reflections must be validated.
- Outdoor industrial robots: strong fit for mines, ports, depots, and logistics yards with dust, fog, rain, and mixed lighting.
- Airport adaptation should add classes for aircraft parts, GSE, cones, chocks, tow bars, belt loaders, baggage carts, and high-visibility clothing.
- SAMFusion should be paired with occupancy or freespace estimation before it becomes a planning safety layer.

## Implementation/Validation Checklist

- Define the sensor suite and calibration chain before adapting the architecture.
- Log weather, visibility, illumination, and soiling metadata with every frame.
- Validate gated camera timing and exposure separately from RGB camera timing.
- Keep per-modality diagnostic outputs and attention weights for audit.
- Run modality dropout tests during training and validation.
- Build a deployment-specific adverse-weather holdout, not only clear-weather performance tests.
- Validate false positives near fog backscatter, wet concrete, reflective signs, metallic structures, and aircraft skin.
- Measure end-to-end latency from sensor exposure to track publication.

## Local Cross-Links

- Related robust fusion methods: [RobuRCDet](robucdet.md), [Adverse-Weather Radar-LiDAR 3D Detection](adverse-weather-radar-lidar-3d-detection.md), [MoME](mome.md).
- Radar and all-weather references: [RadarPillars](radarpillars.md), [K-Radar](k-radar.md), [V2X-Radar](v2x-radar.md).
- LiDAR and weather handling: [LiDAR Weather Artifact Removal](lidar-weather-artifact-removal.md), [LiSnowNet](lisnownet.md), [3D-KNN Blind-Spot Desnowing](3d-knn-blind-spot-desnowing.md).
- Occupancy complements: [4D Radar-Camera Occupancy](4d-radar-camera-occupancy.md), [LiDAR-Camera Occupancy Fusion](lidar-camera-occupancy-fusion.md).

## Sources

- SAMFusion arXiv paper: https://arxiv.org/abs/2508.16408
- SAMFusion Princeton project page: https://light.princeton.edu/publication/samfusion/
- SAMFusion paper PDF: https://light.princeton.edu/wp-content/uploads/2024/09/SAMFusion.pdf
- Seeing Through Fog dataset: https://www.vision.rwth-aachen.de/page/seeing-through-fog
- BEVFusion baseline: https://arxiv.org/abs/2205.13542
- DeepInteraction baseline: https://arxiv.org/abs/2208.11112
