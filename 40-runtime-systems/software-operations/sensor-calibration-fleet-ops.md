# Sensor Calibration Fleet Operations

**Last updated:** 2026-05-09

## Purpose

This page defines fleet operations for sensor calibration after vehicles leave the lab. Calibration is treated as a controlled artifact with release gates, telemetry, drift response, maintenance triggers, rollback rules, and safety-case evidence. The goal is to prevent calibration drift from becoming a silent perception, localization, or free-space failure.

## Calibration Scope

| Calibration item | Examples | Runtime dependency |
|---|---|---|
| Intrinsics | Camera intrinsics/distortion, LiDAR beam correction, radar mounting model | Projection, detection, segmentation, calibration monitors |
| Extrinsics | LiDAR-camera, LiDAR-LiDAR, LiDAR-IMU, radar-camera, sensor-kit-to-base | Fusion, SLAM, occupancy, obstacle shape, localization |
| Time offsets | Sensor hardware timestamp offset, trigger skew, IMU/LiDAR temporal alignment | Deskew, tracking, scan matching, velocity estimation |
| Vehicle geometry | Base frame, wheelbase, ego box, sensor occlusion mask | Collision envelope, projection masks, route clearance |
| Map alignment | Sensor kit to map frame, datum, map tile transform | Localization, geofence, docking, stand clearance |

## Operating Model

1. Factory or installation calibration creates the baseline package.
2. Commissioning verifies the package on the target vehicle, route, map, and sensor firmware.
3. Runtime monitors watch calibration health continuously or periodically.
4. Fleet operations classify drift as green, yellow, red, or unknown.
5. Maintenance recalibrates or physically repairs the vehicle.
6. Release management signs a new calibration package and updates the compatibility manifest.

Calibration updates follow the same SUMS discipline as software because they can change vehicle behavior.

## Fleet Telemetry

| Field | Type | Notes |
|---|---|---|
| `calibration.package_id` | string | Signed calibration artifact |
| `calibration.sensor_kit_id` | string | Sensor kit and mount revision |
| `calibration.sensor_serials` | string array | All sensors used by the package |
| `calibration.frame_tree_hash` | string | Hash of safety-relevant TF tree |
| `calibration.last_verified_time` | timestamp | Last successful validation |
| `calibration.state` | enum | green, yellow, red, unknown |
| `calibration.pair.<pair>.translation_error_m` | double | Residual or drift proxy |
| `calibration.pair.<pair>.rotation_error_deg` | double | Residual or drift proxy |
| `calibration.pair.<pair>.time_offset_ms` | double | Estimated temporal offset |
| `calibration.pair.<pair>.confidence` | double | Method-specific confidence or validity |
| `calibration.prerequisite.reason` | enum | stationary, moving_fast, low_features, bad_weather, no_overlap, sensor_fault |
| `diagnostics.calibration.level` | enum | ROS/Autoware diagnostic level |

Publish diagnostic states through ROS diagnostics and fleet metrics through a versioned OpenTelemetry-compatible schema.

## Drift Classes

| State | Condition | Vehicle action | Fleet action |
|---|---|---|---|
| Green | Residuals inside release envelope and checks recently passed | Normal operation | Eligible for release evidence |
| Yellow | Residual trend or intermittent validation failure but safety margins remain | Continue with approved speed/margin limits | Maintenance ticket and canary watch |
| Red | Residual exceeds hard threshold, wrong sensor/package, or transform invalid | Remove modality or controlled stop per safety case | Incident, route hold, recalibration required |
| Unknown | Monitor missing, no overlap/features, telemetry schema broken, stale verification | Treat as degraded; exclude from release evidence | Repair telemetry or schedule validation run |

## Runbook

| Trigger | First 5 minutes | Next action | Closure evidence |
|---|---|---|---|
| LiDAR-camera miscalibration red | Preserve image, point cloud, projection preview, calibration package ID | Stop autonomous use of affected fusion path; inspect mount and lens/cover | Recalibration report and replay pass |
| LiDAR-LiDAR overlap residual high | Check sensor health, point density, TF tree, route geometry | Reduce speed or stop if occupancy/fusion depends on pair | Residual back inside threshold over validation route |
| LiDAR-IMU time offset high | Check PTP/GNSS/PPS state and IMU driver timestamp source | Block map-building and localization release evidence | Timing validation and replay RPE pass |
| Wrong calibration package active | Stop dispatch or force reload approved package | Audit OTA manifest and vehicle inventory | Active manifest matches signed compatibility matrix |
| Monitor unavailable | Mark calibration unknown and alert fleet SRE | Repair diagnostic producer or schema pipeline | Monitor emits valid green/yellow/red state |

## Release Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| K0 provenance | Calibration package links vehicle, sensor kit, serials, firmware, method, operator/tool version | Package cannot be traced to physical sensors |
| K1 static validation | Target-based or surveyed validation inside installation tolerance | Baseline residual exceeds release threshold |
| K2 route validation | Targetless route/overlap validation passes on representative apron geometry | Only lab target evidence for airside release |
| K3 downstream impact | Localization, free-space, object projection, and map alignment metrics do not regress | Calibration passes alone but perception-SLAM regresses |
| K4 drift monitor | Runtime monitor detects injected perturbations before unsafe output | Red drift is silent or action is not consumed |
| K5 maintenance recovery | Recalibration workflow restores package and evidence without manual database edits | Field support can leave invisible local override |
| K6 compatibility | OTA manifest prevents package on wrong vehicle/sensor/map/runtime | Cross-vehicle calibration reuse possible |

## Maintenance Rules

- Recalibrate after sensor replacement, mount adjustment, collision/strike, windshield/camera service, LiDAR bracket repair, IMU replacement, firmware timestamp-mode change, or map datum/frame change.
- Do not auto-apply online calibration corrections to safety-relevant transforms unless a separate safety case validates correction limits, scene degeneracy checks, and rollback.
- Keep local field overrides time-limited, ticketed, and visible as config drift.
- Preserve before/after bags and projection/registration previews for every red calibration event.
- Do not use calibration-red logs for map publication or release claims.

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Calibration package | Intrinsics, extrinsics, time offsets, frame tree, sensor serials, signatures |
| Tool manifest | Calibration tool version, method, parameters, operator, environment |
| Validation report | Residuals, confidence, route/scene coverage, prerequisites, failed attempts |
| Fault-injection report | Perturbation magnitude, monitor response, alert latency, false alarm notes |
| Maintenance ticket | Physical finding, replaced parts, photos, torque/fixture checks |
| Runtime trend | Residual history, state transitions, route/weather context |
| Release record | Compatibility manifest, safety-case claim IDs, approval, rollback package |

## Related Repository Docs

- `20-av-platform/sensors/calibration-tracking.md`
- `20-av-platform/sensors/multi-lidar-calibration.md`
- `40-runtime-systems/ros-autoware/autoware-localization-timing-diagnostics.md`
- `50-cloud-fleet/observability/slam-timing-health-dashboard.md`
- `60-safety-validation/verification-validation/multi-sensor-calibration-release-benchmark.md`
- `60-safety-validation/runtime-assurance/monitor-qualification-evidence.md`

## Sources

- Autoware/TIER IV CalibrationTools guide: https://autowarefoundation.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/creating-vehicle-and-sensor-model/calibrating-sensors/calibration-tools/
- Autoware calibration status classifier: https://autowarefoundation.github.io/autoware_universe/main/sensing/autoware_calibration_status_classifier/
- OpenCalib paper: https://arxiv.org/abs/2205.14087
- OpenCalib SensorsCalibration repository: https://github.com/PJLab-ADG/SensorsCalibration
- Hilti SLAM Challenge 2023 dataset: https://www.hilti-challenge.com/dataset-2023
- Hilti SLAM Challenge 2023 paper: https://arxiv.org/abs/2404.09765
- ROS 2 diagnostic_updater README: https://docs.ros.org/en/ros2_packages/rolling/api/diagnostic_updater/__README.html
