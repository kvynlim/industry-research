# K-Radar

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "benchmark"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["perception", "adverse-weather", "validation"]
  reason: "Key 4D radar dataset and benchmark for all-weather perception evaluation."
method-priority:end -->

## What It Is

- K-Radar is the KAIST-Radar 4D radar dataset and benchmark for autonomous driving.
- It provides raw 4D radar tensor data rather than only pre-filtered radar point clouds.
- The dataset is designed for object detection in diverse weather and road conditions.
- It includes synchronized auxiliary sensors for calibration, labeling, and fusion research.
- The official repository provides dataset tools, annotation tools, visualization, and baseline code.
- It is one of the core public references for 4D radar perception.

## Core Technical Idea

- Preserve full radar information across range, azimuth, elevation, and Doppler.
- Provide 4D radar tensors with power measurements instead of collapsing early to sparse point detections.
- Annotate 3D boxes so radar-native object detectors can be trained and benchmarked.
- Include difficult weather where radar should outperform optical sensors.
- Enable comparisons between 4D radar, LiDAR, camera, and fusion baselines.
- Demonstrate why elevation is important for 3D object detection from radar.

## Inputs and Outputs

- Dataset input: 4D radar tensor data with Doppler, range, azimuth, and elevation dimensions.
- Dataset input: calibrated high-resolution LiDAR.
- Dataset input: surround stereo camera data.
- Dataset input: IMU/RTK-GPS or pose-related auxiliary measurements.
- Labels: carefully annotated 3D bounding boxes for road objects.
- Benchmark output: trained detector predictions and standard 3D object detection metrics.

## Architecture or Dataset/Pipeline

- The dataset contains about 35K frames.
- Radar measurements are represented as 4DRT, or 4D radar tensor, in full RAED form.
- Conditions include fog, rain, snow, and other challenging weather.
- Road structures include urban, suburban, alleyway, and highway settings.
- The repository includes GUI tools for annotation, visualization, calibration, and inference inspection.
- Baseline neural networks are included for 4DRT-based object detection.

## Training and Evaluation

- The paper trains baseline neural networks on 4D radar tensors.
- It compares radar-based and similarly structured LiDAR-based networks under adverse weather.
- The authors show height/elevation information is crucial for 3D object detection.
- Evaluation focuses on 3D box detection from radar and sensor-fusion settings.
- Weather-conditioned analysis is one of the dataset's main values.
- The dataset should be treated as road-weather evidence, not direct airport evidence.

## Strengths

- Full RAED radar tensor supports research beyond sparse radar point-cloud detection.
- Adverse-weather coverage is directly relevant to robust autonomy.
- Synchronized LiDAR and camera support multimodal fusion experiments.
- Public tools make the dataset practical for radar detector development.
- 35K frames provide more scale than many earlier radar datasets.
- Useful for studying when radar remains stable while LiDAR or cameras degrade.

## Failure Modes

- Road scenes do not include aircraft, jet bridges, or ramp-specific clutter.
- Radar hardware characteristics may differ from production sensors selected for an airside vehicle.
- Tensor data is heavier than point clouds and may require specialized preprocessing.
- 3D boxes alone do not cover free space, semantics, or small FOD detection.
- Multipath near large metallic structures is underrepresented compared with airports.
- Weather diversity does not include de-icing spray, jet blast, glycol mist, or ramp floodlight glare.

## Airside AV Fit

- Strong evidence base for making 4D radar a primary perception input in adverse weather.
- Good starting dataset for radar detector pretraining before airside fine-tuning.
- Supports evaluating radar-LiDAR fusion when LiDAR density drops in rain, fog, or snow.
- Needs airport-specific data collection because aircraft surfaces and terminal infrastructure change radar clutter.
- Radar tensor access is valuable if production hardware allows low-level data export.
- Airside safety cases should cite K-Radar as supporting evidence, not as validation coverage.

## Implementation Notes

- Use K-Radar to evaluate candidate radar encoders before collecting airport data.
- Decide early whether the target radar exposes tensors or only point clouds; this changes model choice.
- Build conversion scripts to a common BEV coordinate frame shared with LiDAR.
- Compare tensor-based models against RadarPillars-style point-cloud models.
- Add weather metadata and point-count/tensor-energy diagnostics to validation reports.
- Plan for radar-specific annotation review because boxes can be visible in radar when LiDAR is weak.

## Sources

- Paper: https://arxiv.org/abs/2206.08171
- Official repository: https://github.com/kaist-avelab/K-Radar
- KAIST AVELab: https://ave.kaist.ac.kr/
- K-Radar repository dataset description: https://github.com/kaist-avelab/K-Radar#readme
