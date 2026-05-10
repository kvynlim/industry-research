# MSC-Bench

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "benchmark"
  stage: "reference"
  maturity: "fielded-pattern"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "MSC-Bench is rated as a benchmark or dataset reference for perception robustness and validation coverage."
method-priority:end -->

## What It Is

- MSC-Bench is a multi-sensor corruption benchmark for autonomous driving perception.
- The full paper title is "MSC-Bench: Benchmarking and Analyzing Multi-Sensor Corruption for Driving Perception."
- It evaluates robustness for both 3D object detection and HD map construction.
- The benchmark focuses on camera-LiDAR fusion systems.
- It was released as a 2025 arXiv work with a public project page.
- The benchmark exists because clean nuScenes validation scores hide severe degradation under sensor faults.

## Core Technical Idea

- Define a controlled set of camera and LiDAR corruptions.
- Apply corruptions individually and concurrently to multi-sensor inputs.
- Evaluate the same models under clean data and under increasing corruption severity.
- Compare not only accuracy but resilience across corruption families.
- Cover weather, interior sensor effects, and sensor failure scenarios.
- Expose which fusion designs rely too strongly on one sensor or on perfect synchronization.
- Extend robustness evaluation beyond a single task by including HD map construction.

## Inputs and Outputs

- Inputs are nuScenes-style multi-camera and LiDAR samples.
- Corruption inputs include type, severity level, and whether the corruption applies to one or multiple sensors.
- The benchmark produces corrupted perception datasets and evaluation configs.
- For 3D object detection, outputs are NDS, mAP, and related detection metrics.
- For HD map construction, outputs are map AP metrics.
- The project also reports resilience scores and relative resilience scores.
- The benchmark assumes models already support camera, LiDAR, or camera-LiDAR inputs.

## Architecture or Benchmark Protocol

- MSC-Bench defines 16 corruption types or combinations.
- Listed corruptions include fog, snow, motion blur, spatial misalignment, temporal misalignment, camera crash, frame lost, cross sensor, cross talk, and incomplete echo.
- Combined scenarios include camera crash or frame lost paired with cross sensor, cross talk, or incomplete echo.
- Corruptions are grouped into weather, interior, and sensor failure categories.
- The 3D object detection benchmark reports NDS over all corruption types and severities.
- The HD map benchmark reports mAP and class-specific map AP variants.
- Relative robustness visualizations compare methods to BEVFusion for detection and MapTR for maps.

## Training and Evaluation

- The paper evaluates six 3D object detection models.
- It also evaluates four HD map construction models.
- Baselines are grouped by input modality, backbone, BEV encoder, and image resolution.
- Evaluation is performed on the official nuScenes validation set with corruptions applied.
- Clean-set performance is reported alongside corrupted performance.
- Resilience Score is computed from metric degradation across severity levels.
- The key finding is substantial degradation under adverse weather and sensor failure, even for strong fusion models.

## Strengths

- Covers both object detection and map construction, two core AV perception outputs.
- Includes concurrent corruptions, not just one sensor fault at a time.
- The project page makes the benchmark definition and corruption examples easy to inspect.
- Resilience scores help compare methods with different clean-set accuracy.
- It directly tests camera-LiDAR assumptions such as synchronization and sensor completeness.
- It is useful for regression testing because corruption types and severities are repeatable.

## Failure Modes

- It is still a corruption benchmark built on an existing road dataset.
- Synthetic corruptions can miss real sensor physics, maintenance issues, and weather artifacts.
- nuScenes geography and object classes do not cover airside operations.
- HD map construction metrics do not directly measure apron lane markings, stand boundaries, or aircraft service zones.
- The benchmark may overemphasize modeled corruption families and underemphasize rare real failures.
- A high resilience score does not guarantee safe planning behavior.
- It does not replace field logging of actual sensor faults.

## Airside AV Fit

- MSC-Bench is useful as a template for airside perception robustness test matrices.
- Its combined failure cases map to realistic apron events such as fog plus camera dropout or vibration plus frame loss.
- The HD map portion is relevant to stand markings, stop lines, service roads, and no-go zones.
- Airside adaptation should add apron-specific classes, reflective aircraft, low-profile tow bars, and ground crew PPE.
- Weather corruptions should include de-icing spray, jet exhaust shimmer, wet pavement glare, and nighttime floodlights.
- Use MSC-Bench-style scoring to decide when autonomy should degrade to reduced speed or teleoperation.

## Implementation Notes

- Treat MSC-Bench as an offline validation suite, not a training-only augmentation set.
- Report clean accuracy and resilience score together; one alone is misleading.
- Run per-class and per-range breakdowns because small objects are often safety critical.
- Add planner-facing metrics such as false negatives inside braking distance.
- If reproducing, pin the benchmark version because corruption definitions may evolve.
- For airside transfer, clone the protocol rather than assuming nuScenes corruptions are sufficient.

## Sources

- arXiv paper: https://arxiv.org/abs/2501.01037
- Project page: https://msc-bench.github.io/
- ar5iv full text: https://ar5iv.labs.arxiv.org/html/2501.01037
