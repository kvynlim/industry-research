# Multi-Sensor Calibration Release Benchmark

**Last updated:** 2026-05-09

## Purpose

This protocol defines release benchmarking for multi-sensor calibration packages used by perception, SLAM/localization, mapping, and runtime assurance. A calibration package is released only when it is accurate enough, compatible with the active artifact set, monitored in the field, and proven not to degrade downstream safety metrics.

## Benchmark Scope

| Pair or transform | Metrics | Downstream effect |
|---|---|---|
| Camera intrinsics | Reprojection error, distortion residual, coverage | Image detection, projection, LiDAR-camera calibration |
| LiDAR-camera extrinsics | Reprojection residual, edge alignment, calibration-status confidence | Fusion, unknown/OOD projection, semantic point labeling |
| LiDAR-LiDAR extrinsics | Overlap ICP residual, rotation/translation delta, fitness | Point-cloud aggregation, occupancy, map building |
| LiDAR-IMU extrinsics/time | Motion excitation residual, time offset, deskew quality | SLAM, localization, velocity, mapping |
| Radar-camera/LiDAR | Association residual, velocity consistency, time offset | Adverse-weather perception and tracking |
| Sensor-kit-to-base | Survey/CAD delta, ego box consistency, route clearance | Collision envelope and planner clearance |
| Map datum/frame | Survey residual, tile seam alignment, geofence delta | Localization and route/geofence correctness |

## Benchmark Tiers

| Tier | Purpose | Required for |
|---|---|---|
| K-B0 smoke | Schema, frame tree, serial, and manifest checks | Every calibration package |
| K-B1 lab target | Target-based static validation | New install or repaired sensor |
| K-B2 route targetless | Airside route/overlap validation | Production release |
| K-B3 fault injection | Known extrinsic/time perturbations | Monitor qualification and threshold changes |
| K-B4 downstream replay | Perception-SLAM metrics under candidate calibration | Behavior-affecting release |
| K-B5 field watch | Canary drift and alert performance | Site/fleet promotion |

## Procedure

1. Freeze candidate calibration package, active map, model, runtime, sensor firmware, and benchmark manifest.
2. Run K-B0 to verify package structure, sensor serials, TF tree hash, schema, and compatibility.
3. Run K-B1 using approved targets/fixtures when the physical installation changed.
4. Run K-B2 on route data with sufficient overlap, feature diversity, speed, lighting, and operational context.
5. Run K-B3 perturbations for each monitored sensor pair and verify monitor state/action.
6. Run K-B4 downstream replay for object detection, occupancy/free-space, localization, and map alignment.
7. Run K-B5 canary watch and compare drift metrics to release envelope.
8. Publish pass, pass with ODD restriction, inconclusive, or block.

## Metrics

| Metric | Definition | Release interpretation |
|---|---|---|
| Reprojection RMSE | Pixel error for projected 3D features/targets | Must pass by camera, range, and image region |
| LiDAR overlap residual | Registration error in shared FOV | Must pass with feature-quality prerequisite |
| Extrinsic delta | Difference from previous approved transform | Large unexplained delta requires physical inspection |
| Time offset | Estimated sensor-to-reference offset | Must be inside timestamp validation envelope |
| Deskew residual | Motion distortion left after time/extrinsic correction | Blocks SLAM/map release if high |
| Downstream ATE/RPE | Localization error under candidate calibration | No critical route regression |
| False-free-space delta | Change in protected-zone false-free-space | Any regression is safety review; blocker if false-free-space occurs |
| Unknown/OOD action delta | Change in unknown/OOD detection/action | Cannot suppress safety-relevant unknowns |
| Monitor detection latency | Time from injected drift to red/yellow state | Must be before unsafe consumer output |

## Suggested Gate Pattern

Exact thresholds are program-specific. A defensible release pattern is:

| Gate | Pass condition | Block condition |
|---|---|---|
| CAL-0 provenance | Package links sensors, vehicle, firmware, tool, route, operator, signatures | Unknown sensor or untraceable transform |
| CAL-1 static accuracy | Target/CAD/survey residuals inside installation envelope | Baseline is already outside tolerance |
| CAL-2 route robustness | Residuals pass in representative airside geometry | Pass only in easy lab scene |
| CAL-3 downstream no-regress | Localization, occupancy, object projection, map QA do not regress in critical slices | Calibration improves residual but harms safety metric |
| CAL-4 monitor action | Drift/time perturbations detected and consumed by runtime response | Monitor logs but planner/runtime does not act |
| CAL-5 compatibility | Package activates only on eligible vehicles, sensors, maps, and runtime | OTA can install on wrong serial or sensor kit |
| CAL-6 field watch | Canary residuals and alert rates remain inside envelope | Drift cluster or unresolved false-free-space event |

## Fault Injection

| Injection | Expected result |
|---|---|
| Camera yaw/pitch perturbation | Calibration monitor red/yellow and projection error increase |
| LiDAR vertical translation perturbation | Overlap residual or occupancy/free-space monitor detects inconsistency |
| LiDAR-IMU time offset | Deskew/localization metric degrades and timing/calibration monitor fires |
| Wrong sensor serial package | Compatibility matrix blocks activation |
| Feature-poor route segment | Monitor reports unknown/prerequisite failure, not false green |
| Wet/glare route slice | Downstream free-space and OOD conservatism remain valid |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Benchmark manifest | Candidate package, active artifacts, routes, datasets, sensor serials |
| Calibration report | Metrics by pair, route, range, image region, feature prerequisite |
| Downstream report | Detection/free-space/localization/map deltas and failure packets |
| Fault-injection report | Perturbation values, detection latency, monitor action |
| Compatibility record | Manifest eligibility and blocked negative tests |
| Canary report | Residual trends, alerts, maintenance findings, closure |
| Release recommendation | Pass, restricted pass, inconclusive, or block |

## Related Repository Docs

- `40-runtime-systems/software-operations/sensor-calibration-fleet-ops.md`
- `20-av-platform/sensors/calibration-tracking.md`
- `20-av-platform/sensors/multi-lidar-calibration.md`
- `60-safety-validation/verification-validation/slam-map-benchmark-protocol.md`
- `60-safety-validation/verification-validation/perception-slam-leaderboard-interpretation.md`
- `60-safety-validation/runtime-assurance/monitor-qualification-evidence.md`

## Sources

- Autoware/TIER IV CalibrationTools guide: https://autowarefoundation.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/creating-vehicle-and-sensor-model/calibrating-sensors/calibration-tools/
- Autoware calibration status classifier: https://autowarefoundation.github.io/autoware_universe/main/sensing/autoware_calibration_status_classifier/
- OpenCalib paper: https://arxiv.org/abs/2205.14087
- OpenCalib SensorsCalibration repository: https://github.com/PJLab-ADG/SensorsCalibration
- Hilti SLAM Challenge 2023 dataset: https://www.hilti-challenge.com/dataset-2023
- Hilti SLAM Challenge 2023 paper: https://arxiv.org/abs/2404.09765
- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
