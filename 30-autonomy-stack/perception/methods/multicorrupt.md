# MultiCorrupt

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "benchmark"
  stage: "reference"
  maturity: "fielded-pattern"
  tags: ["perception", "validation", "data-engine", "road-av", "adverse-weather"]
  reason: "MultiCorrupt is rated as a benchmark or dataset reference for perception robustness and validation coverage."
method-priority:end -->

## What It Is

- MultiCorrupt is a multi-modal robustness dataset and benchmark for LiDAR-camera 3D object detection.
- The full paper title is "MultiCorrupt: A Multi-Modal Robustness Dataset and Benchmark of LiDAR-Camera Fusion for 3D Object Detection."
- It was presented at IEEE Intelligent Vehicles Symposium 2024.
- The benchmark is built around corrupted nuScenes data generation.
- It tests how fusion detectors respond to weather, sensor loss, sampling issues, and alignment errors.
- The official repository includes generation code, benchmark material, and dataset instructions.

## Core Technical Idea

- Start from clean nuScenes samples.
- Generate repeatable camera and LiDAR corruptions at three severity levels.
- Evaluate strong camera-LiDAR fusion detectors under each corruption.
- Analyze which fusion strategies remain robust to which perturbation types.
- Cover both sensor content corruption and sensor relationship corruption.
- Make the generation pipeline open so teams can compile corrupted datasets locally.
- Use the benchmark to expose brittle dependence on dense LiDAR, complete camera coverage, and precise calibration.

## Inputs and Outputs

- Inputs are clean nuScenes data, selected corruption type, severity level, and random seed where applicable.
- Camera corruptions modify image data.
- LiDAR corruptions modify point cloud data and sweeps.
- Outputs are corrupted nuScenes-format datasets.
- Benchmark outputs are detection scores such as mAP and nuScenes Detection Score.
- The dataset supports model-by-model robustness comparisons.
- It does not output a new perception architecture; it is an evaluation and data-generation resource.

## Architecture or Benchmark Protocol

- MultiCorrupt defines ten distinct corruption types.
- The repository lists missing camera, motion blur, points reducing, snow, temporal misalignment, spatial misalignment, beams reducing, brightness, dark, and fog.
- Each corruption is provided at severity levels 1, 2, and 3.
- Image corruptions can be generated with `img_converter.py`.
- LiDAR corruptions can be generated with corresponding point cloud conversion scripts.
- Snow simulation uses LiDAR snow simulation resources.
- The repository supports Hugging Face dataset download and local compilation from nuScenes.

## Training and Evaluation

- The paper evaluates five state-of-the-art multi-modal 3D detectors.
- Models are tested on corrupted validation data to measure robustness by corruption type.
- The benchmark is intended for evaluation, but the generated corruptions can also be used for robustness training.
- The analysis compares resistance ability across detector fusion strategies.
- The protocol highlights that robustness is corruption-specific; a model can be strong for one failure and weak for another.
- nuScenes format compatibility reduces integration friction for existing mmdetection3d and OpenPCDet workflows.
- Evaluation should include clean nuScenes scores to avoid rewarding robustness with unacceptable clean accuracy.

## Strengths

- The corruption list is practical and close to common sensor degradation modes.
- Three severity levels make it useful for capability-curve development.
- Open generation code is valuable for reproducibility and local adaptation.
- It covers both spatial and temporal misalignment, which are common silent fusion failures.
- It is narrower than MSC-Bench but deeper for LiDAR-camera 3D detection.
- It can be plugged into many existing nuScenes training and evaluation stacks.

## Failure Modes

- It inherits nuScenes road-scene bias and object taxonomy.
- Simulated weather and sensor faults may not match specific hardware physics.
- It does not include radar, thermal, or infrastructure sensors.
- Severity levels are benchmark-defined and may not correspond to physical measurements such as mm/hour rain or lens occlusion percentage.
- It can underrepresent correlated real failures, for example rain plus glare plus dirty lens plus LiDAR spray.
- A detector that performs well on MultiCorrupt can still fail on real apron sensor anomalies.
- Download and dataset compilation require substantial storage and compute.

## Airside AV Fit

- MultiCorrupt is directly useful for first-pass robustness testing of camera-LiDAR airside perception.
- Missing camera, dark, fog, snow, beam reduction, and temporal misalignment map to apron operations.
- Points reducing and beams reducing are relevant to spray, dust, de-icing fluid, and partial LiDAR obstruction.
- Airside adaptation should add aircraft occlusion, reflective metal surfaces, ground markings, cones, chocks, tow bars, and personnel.
- It should be extended with radar and real airport weather captures for production safety evidence.
- Severity levels should be calibrated against actual airport sensor logs where possible.

## Implementation Notes

- Use the official repository scripts rather than reimplementing corruptions by hand.
- Pin the nuScenes version, corruption severity, and random seeds for reproducible regression tests.
- Store corrupted datasets separately from clean nuScenes to avoid accidental training contamination.
- Track per-sensor availability and corruption metadata alongside each evaluation sample.
- Add airside-specific corruption modules only after baseline MultiCorrupt results are reproducible.
- Use the benchmark as a gate for fusion changes that claim improved robustness.

## Sources

- arXiv paper: https://arxiv.org/abs/2402.11677
- Official implementation: https://github.com/ika-rwth-aachen/MultiCorrupt
- RWTH Aachen project page: https://www.ika.rwth-aachen.de/en/competences/publications/presentations-and-articles/vehicle-intelligence-automated-driving/multicorrupt-dataset.html
