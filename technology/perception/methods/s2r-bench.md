# S2R-Bench

## What It Is

- S2R-Bench is a sim-to-real evaluation benchmark for autonomous driving perception.
- The full title is "S2R-Bench: A Sim-to-Real Evaluation Benchmark for Autonomous Driving."
- It focuses on real-world sensor anomaly data and compares it with simulated anomaly data.
- The benchmark is published through Scientific Data and has an official GitHub repository.
- It is framed as a corruption robustness benchmark grounded in real scenarios rather than simulation only.
- The dataset targets camera, LiDAR, and 4D radar perception robustness.

## Core Technical Idea

- Existing robustness benchmarks often rely on simulated corruptions.
- S2R-Bench collects real sensor anomaly data under varied roads, weather, lighting, and time periods.
- It then compares real anomalies with simulated data to judge how well simulation transfers.
- The benchmark makes robustness evaluation more realistic by anchoring corruptions to captured sensor behavior.
- It supports both real anomaly testing and generated anomaly testing.
- It emphasizes the gap between clean benchmarks and safety-critical adverse conditions.
- The "sim-to-real" framing asks whether simulated corruption is a trustworthy proxy for real sensor failure.

## Inputs and Outputs

- Inputs include high-resolution camera images, 80-line LiDAR, and two 4D radar sources on the collection vehicle.
- The repository documents image data in PNG format and point cloud data in BIN format.
- Calibration files include camera intrinsics and sensor-to-camera transformations.
- Label files use a KITTI-like structure with class, truncation, occlusion, 2D box, 3D dimensions, location, rotation, score, and track ID.
- Outputs are benchmark datasets, model checkpoints, and evaluation results for object detection.
- The dataset includes car, pedestrian, cyclist, and other traffic classes.
- It is not a fusion architecture; it is an evaluation dataset and toolkit.

## Architecture or Benchmark Protocol

- Data collection was conducted in Beijing in December 2023.
- The README reports roughly 700 km of covered roads.
- Scenarios include city roads, suburban roads, motorways, tunnels, towns, villages, communities, campuses, parking, and roundabouts.
- The repository describes real and simulated anomaly data for light snow, moderate snow, fog, and brightness.
- Simulation tools can add adverse weather or noise to LiDAR, 4D radar, and image data.
- The benchmark includes separate evaluation tracks or train types referenced in the model zoo.
- Visualization and benchmarking scripts are available in the official repository.

## Training and Evaluation

- The repository reports 9981 labeled frames in its data statistics.
- Car, pedestrian, and cyclist dominate the labels, with approximate shares of 53%, 20%, and 19% in the README.
- Most annotated objects are within the near-to-mid range of the ego vehicle.
- The model zoo includes PointPillars, SMOKE, and Focals-Conv examples.
- Evaluations compare performance on real anomaly data and simulated anomaly data.
- The Scientific Data article states that data are publicly released through Figshare repositories.
- The GitHub repository provides visualization, setup, and benchmark code.

## Strengths

- Real anomaly data makes it more informative than synthetic-only corruption benchmarks.
- 4D radar inclusion is valuable for adverse weather perception research.
- Multi-road and day-night collection increases diversity.
- KITTI-like labels and calibration files make it familiar to many perception teams.
- The sim-to-real comparison is directly useful for deciding whether synthetic weather tests are enough.
- It can expose methods that look robust in simulation but fail on real sensor artifacts.

## Failure Modes

- The collection geography is Beijing roads, not airports or industrial aprons.
- The dataset is still finite and may not include rare airport-specific anomalies.
- Public access and repository instructions should be checked because data links and agreements can change.
- Class distribution is road-centric and omits aircraft, ground support equipment, cones, chocks, and tow bars.
- Radar hardware and mounting may differ from an airside vehicle.
- Evaluation results may depend on the exact split between real, clean, and simulated data.
- Real anomalies are harder to parameterize into clean severity levels than synthetic corruptions.

## Airside AV Fit

- S2R-Bench is valuable as evidence that real sensor anomalies can diverge from simulated corruptions.
- Its multi-modal camera, LiDAR, and 4D radar setup resembles robust airside sensor-suite goals.
- The benchmark logic should be copied for airport data collection: real fog, rain, spray, darkness, glare, and snow.
- Airside transfer requires new labels for aircraft, GSE, workers, safety cones, dollies, tow bars, and stand markings.
- It is especially relevant for validating whether synthetic de-icing spray or fog actually predicts field performance.
- Use it as a benchmark-design reference rather than a complete airside validation dataset.

## Implementation Notes

- Verify dataset access through the Nature article and official repository before planning experiments.
- Keep real and simulated anomaly splits separate in reports.
- Do not tune exclusively on simulated anomalies if the goal is field robustness.
- For airside work, collect paired real and simulated anomaly sets so the sim-to-real gap can be measured.
- Preserve calibration files and sensor timestamps because failure analysis often depends on alignment.
- Report per-condition metrics, not only aggregate AP, so ODD policies can use the results.

## Sources

- Scientific Data article: https://www.nature.com/articles/s41597-025-06255-3
- arXiv paper: https://arxiv.org/abs/2505.18631
- Official repository: https://github.com/liwang-thu/S2R-Bench
