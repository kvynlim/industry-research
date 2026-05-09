# LiDAR-IMU Temporal Initialization

Related docs: [FAST-LIO2](fast-lio-fast-lio2.md), [FAST-LIVO2](fast-livo-fast-livo2.md), [continuous-time registration](continuous-time-registration.md), [sensor calibration and time synchronization](../../../10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

**Last updated:** 2026-05-09

## Executive Summary

LiDAR-IMU temporal initialization is the calibration step that estimates the time offset between LiDAR measurements and IMU measurements before, or at the start of, LiDAR-inertial odometry. LI-Init is the key reference implementation: it estimates temporal offset, LiDAR-IMU extrinsics, gravity, and IMU bias without a calibration target, extra sensor, prior map, or initial extrinsic/time-offset values.

This page matters because many LIO failures blamed on "bad scan matching" are actually timestamp and extrinsic failures. A LIO stack can deskew every point in the wrong direction if LiDAR and IMU time bases are misaligned.

## What LI-Init Adds

- Full real-time initialization for LiDAR-inertial systems.
- Temporal offset estimation between LiDAR and IMU.
- Extrinsic rotation and translation estimation.
- Gravity vector and IMU bias initialization.
- Automatic excitation detection and user guidance.
- Support for mechanical spinning LiDARs and solid-state LiDARs, including Hesai, Velodyne, Ouster, Livox Avia, and Livox Mid360 according to the repository.
- Seamless handoff into FAST-LIO2-style operation.

## Calibration Target

The initialization solves for:

```text
theta = [T_LI, delta_t_LI, g, b_g, b_a]
```

by aligning motion estimated from LiDAR odometry with motion measured by the IMU. Once solved, the extrinsic and time offset can be written into LIO configuration files.

## Operational Workflow

1. Start the LiDAR and IMU drivers.
2. Keep the platform still long enough to accumulate an initial map and stationary IMU statistics.
3. Move or rotate the platform with sufficient excitation.
4. Let the initializer detect whether excitation is adequate.
5. Record extrinsic, temporal offset, gravity, and bias estimates.
6. Start or continue FAST-LIO-style odometry with the initialized parameters.

The repository recommends staying still for more than five seconds after launch and running LI-Init while recording your own data so the system can guide excitation.

## Timing Caveat

A one-time time offset may not be valid forever. The LI-Init repository notes that some LiDARs use timestamp origins tied to power-on time. If the LiDAR timestamp resets when powered off, temporal initialization may be needed each power cycle unless the system has verified stable synchronization.

Production stacks should therefore log:

- estimated offset,
- boot ID or power-cycle status,
- driver timestamp source,
- PPS/PTP health,
- offset drift across temperature and runtime.

## Degenerate and Dynamic Scenes

Initialization needs motion excitation and enough stable LiDAR odometry. It can struggle when:

- the scene is geometrically degenerate,
- the platform barely moves or only moves in one uninformative direction,
- dynamic objects dominate the initial map,
- the IMU has wrong units or severe bias instability,
- LiDAR point timestamps are absent or wrong.

Use a known calibration route with turns, pitch/roll/yaw variation where safe, and static structure.

## Evaluation Guidance

Track:

- estimated time offset repeatability across boots,
- extrinsic repeatability across calibration runs,
- LIO ATE/RPE before and after initialization,
- deskew residuals and map sharpness,
- convergence time and excitation score,
- sensitivity to wrong IMU units or topic timestamps.

## Integration Readiness

LI-Init is public, widely referenced, and integrated with the FAST-LIO lineage. It is one of the most practical tools for custom LiDAR-IMU rigs. Product integration still needs license review, automated calibration acceptance thresholds, sensor-specific timestamp audits, and operator procedures for failed excitation.

## Limitations

- Requires sufficient excitation and static structure.
- Can produce misleading calibration if LiDAR odometry is poor during initialization.
- Does not solve camera, radar, wheel, or GNSS timing.
- GPL-2.0 licensing may affect commercial integration.
- Calibration outputs should be validated rather than blindly written into production configs.

## Sources

- LI-Init arXiv paper: https://arxiv.org/abs/2202.11006
- LI-Init repository: https://github.com/hku-mars/LiDAR_IMU_Init
- FAST-LIO / FAST-LIO2 repository: https://github.com/hku-mars/FAST_LIO
