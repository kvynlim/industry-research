# SOAC

## What It Is

- SOAC is a targetless spatio-temporal calibration method for multi-sensor autonomous driving rigs.
- The full paper title is "SOAC: Spatio-Temporal Overlap-Aware Multi-Sensor Calibration using Neural Radiance Fields."
- It was accepted at CVPR 2024.
- The method calibrates cameras and LiDAR without checkerboards, boxes, or manually placed calibration targets.
- It uses Neural Radiance Fields as a shared differentiable scene representation.
- The key deployment problem is extrinsic and timing drift across sensors mounted on a moving platform.

## Core Technical Idea

- Learn implicit scene representations from raw sensor sequences.
- Register sensors by optimizing their poses and time offsets against the learned scene.
- Use only scene regions that are visible to overlapping sensors.
- Avoid forcing non-overlapping sensor regions into the calibration loss.
- Alternate between training camera-specific NeRF scenes and registering other sensors to those scenes.
- Treat calibration as self-supervised gradient optimization rather than supervised regression.
- Use semantic filtering to reduce dynamic-object contamination when needed.

## Inputs and Outputs

- Inputs include camera images, LiDAR scans, timestamps, initial calibration estimates, and vehicle trajectory information.
- The method assumes a reference sensor or known trajectory is available.
- It can estimate spatial extrinsics between sensors.
- It can estimate temporal offsets when the sequence and sensors support the problem.
- Outputs are corrected rigid transformations and time alignment parameters.
- Intermediate outputs are NeRF scene models and overlap-aware losses.
- The method is intended for calibration workflows, not direct object detection output.

## Architecture or Benchmark Protocol

- SOAC builds one or more implicit scene representations from captured driving sequences.
- Each camera-specific NeRF models the static visual scene seen by that camera.
- LiDAR rays and camera rays are compared through the shared implicit scene only where their visibility overlaps.
- The optimizer updates both NeRF parameters and sensor registration parameters.
- The overlap-aware partitioning reduces local minima from regions seen by only one sensor.
- Dynamic objects can be filtered with semantic segmentation so they do not corrupt the static scene model.
- The protocol evaluates recovered rotation, translation, and timing errors after injecting initial calibration perturbations.

## Training and Evaluation

- Evaluation is reported on outdoor urban driving datasets including KITTI-360, nuScenes, and PandaSet.
- Metrics include rotation error, translation error, and temporal error where temporal calibration is evaluated.
- The paper compares against targetless, supervised, and NeRF-based calibration baselines.
- Reported nuScenes and PandaSet experiments cover multiple cameras and LiDAR registration.
- The paper notes better robustness than earlier NeRF-based calibration that does not isolate overlap regions.
- It also reports sensitivity to scene structure, especially open scenes with long LiDAR rays.
- Training time increases with the number of cameras because multiple implicit scenes are trained.

## Strengths

- Does not require calibration targets, which helps fleet-scale recalibration.
- Handles both spatial and temporal calibration in a unified optimization view.
- Overlap-aware losses directly address a weakness of naive multi-sensor NeRF calibration.
- Works from raw outdoor driving data, not only indoor calibration sequences.
- Can reuse operational logs if they contain enough static structure and sensor overlap.
- Provides physical calibration parameters that downstream perception stacks can consume.

## Failure Modes

- Wide open scenes reduce translation observability because rays hit distant structures.
- Dynamic objects can corrupt NeRF learning unless filtered.
- The method depends on a reference trajectory or reference sensor assumption.
- It is computationally heavier than regression-based online calibration.
- It is not designed for instant recovery during a mission.
- Sparse texture, repeating structures, reflections, and moving aircraft can create ambiguous alignment.
- Scaling to many cameras increases training time significantly.

## Airside AV Fit

- SOAC is useful for depot, hangar, or scheduled airside fleet recalibration using normal driving logs.
- Airport aprons offer static structures such as terminal walls, markings, signs, and equipment stands.
- They also include hard cases: large empty pavement, aircraft reflections, service traffic, and movable GSE.
- The method can support a maintenance safety case by detecting and correcting slow calibration drift.
- It should not be relied on as a real-time fallback when a tug is already operating near an aircraft.
- Airside datasets should include calibration sequences around terminals, stands, gates, and open ramp areas.

## Implementation Notes

- Use SOAC offline first; online use would require careful compute and convergence guarantees.
- Capture calibration logs with deliberate parallax and nearby static structure.
- Remove moving aircraft, people, vehicles, jet bridges, and belt loaders from the optimization masks where possible.
- Validate recovered extrinsics against independent target-based or surveyed checks before deployment.
- Track calibration confidence and reject runs with too little sensor overlap.
- Pair SOAC with detector-side robustness such as GraphBEV for residual alignment errors.

## Sources

- CVPR 2024 paper: https://openaccess.thecvf.com/content/CVPR2024/papers/Herau_SOAC_Spatio-Temporal_Overlap-Aware_Multi-Sensor_Calibration_using_Neural_Radiance_Fields_CVPR_2024_paper.pdf
- CVPR open-access page: https://openaccess.thecvf.com/content/CVPR2024/html/Herau_SOAC_Spatio-Temporal_Overlap-Aware_Multi-Sensor_Calibration_using_Neural_Radiance_Fields_CVPR_2024_paper.html
- arXiv abstract: https://arxiv.org/abs/2311.15803
- Project page: https://qherau.github.io/SOAC/
