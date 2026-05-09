# Ground-Fusion, M2DGR, and M3DGR

Related docs: [LVI-SAM](lvi-sam.md), [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md), [FAST-LIO2](fast-lio-fast-lio2.md), [benchmarking metrics and datasets](benchmarking-metrics-datasets.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

**Last updated:** 2026-05-09

## Executive Summary

Ground-Fusion is a low-cost ground-robot SLAM system built around RGB-D, IMU, wheel odometry, and GNSS in a factor graph. M2DGR and M3DGR are the associated benchmark direction: rich ground-robot sensor suites, corner cases, and explicit degradation tests for real-world ground SLAM.

The important knowledge-base point is the benchmark philosophy. M2DGR showed that a ground robot dataset should include more than a single camera/LiDAR/IMU stack: surround fisheye cameras, sky-pointing camera, infrared camera, event camera, VI sensor, IMU, LiDAR, GNSS, and RTK/ground-truth sources expose failure modes that normal visual-inertial or LiDAR-only datasets hide. M3DGR extends this into a robustness benchmark with induced visual challenge, LiDAR degeneracy, wheel slippage, and GNSS denial, plus broad evaluation of many SLAM systems.

## What It Adds

- A low-cost ground SLAM reference stack for RGB-D-IMU-wheel-GNSS fusion.
- Explicit initialization paths for stationary, visual, and dynamic cases.
- Sensor anomaly and degradation handling as first-class modules.
- Dense color mapping coupled to localization, useful for indoor/outdoor ground robots.
- M2DGR and M3DGR benchmark coverage for elevators, darkness, GNSS changes, ground-vehicle motion, wheel slip, and LiDAR degeneracy.

## Sensors and Benchmarks

| Resource | Sensor suite / scope | Why it matters |
|---|---|---|
| M2DGR | Six fisheye RGB cameras, one sky-pointing RGB camera, infrared camera, event camera, VI sensor, IMU, LiDAR, consumer GNSS, GNSS-IMU RTK, and ground-truth sources | Rich ground-robot benchmark with indoor/outdoor sequences and difficult cases such as lifts and darkness |
| Ground-Fusion | RGB-D, IMU, wheel odometer, GNSS | Low-cost factor-graph SLAM baseline for ground vehicles |
| M2DGR-Plus / Ground-Challenge | Follow-on benchmark resources linked from Ground-Fusion | Corner-case evaluation for visual, wheel, and GNSS challenges |
| M3DGR | Sensor-rich benchmark with induced visual challenge, LiDAR degeneracy, wheel slip, and GNSS denial | Robustness benchmark for fusion policies, not only nominal accuracy |

## Fusion Pattern

Ground-Fusion uses a factor graph that fuses:

- RGB-D visual constraints.
- IMU preintegration.
- Wheel odometry constraints.
- GNSS factors when available and healthy.

The design lesson is that ground-robot SLAM needs explicit health logic. Wheel odometry is useful until slip dominates. GNSS is useful until multipath, low rate, or denial makes it misleading. RGB-D is useful indoors and at short range but can fail under darkness, glare, textureless walls, and outdoor sunlight. A robust graph should change factor weights and rejection policies by scene condition.

## Timing and Calibration

M2DGR emphasizes calibrated and synchronized sensor data. Ground-Fusion integration still depends on:

- Camera-IMU and RGB-D calibration.
- Wheel encoder scale, baseline, and frame alignment.
- GNSS antenna lever arm and covariance quality.
- Consistent timestamps across RGB-D frames, IMU packets, wheel odometry, and GNSS.

M3DGR-style degradation tests are useful because they expose temporal and calibration brittleness that average ATE can hide.

## Dynamic and Degenerate Scenes

The M2DGR/M3DGR family is valuable for:

- Visual degradation: darkness, exposure changes, low texture, and motion blur.
- LiDAR degeneracy: corridors, open or repetitive scenes, and weak geometric constraints.
- Wheel degradation: slippage and uneven ground.
- GNSS degradation: denial and low-quality outdoor fixes.
- Indoor/outdoor transitions that change every modality's reliability.

This is directly relevant to airports, warehouses, campuses, mines, and service roads where robots move across sensing regimes rather than staying inside a clean lab dataset.

## Metrics

Use metrics split by degradation cause:

- ATE/RPE by sequence and by induced degradation interval.
- Initialization success rate and time to usable covariance.
- GNSS innovation rejection rate.
- Wheel slip residual and recovery time.
- LiDAR degeneracy eigenvalues versus drift.
- RGB-D feature/track count, depth validity, and photometric residual.
- Dense map consistency before and after loop closure.

## Integration Readiness

Ground-Fusion is open source and ROS/catkin oriented, with Ubuntu 18.04/Melodic and 20.04/Noetic support noted by the repository. It is useful as a research baseline or as a source of design patterns for low-cost ground platforms. It should not be copied directly into a safety-critical autonomy stack without replacing ad hoc health handling with deterministic fault monitors, calibrated covariance, and map lifecycle controls.

## Limitations

- RGB-D cameras are short-range and lighting-sensitive.
- Low-rate consumer GNSS can be worse than no GNSS if fused without gating.
- Wheel odometry is platform-specific and slip-sensitive.
- M2DGR is broad but not airside-specific; aircraft, jet blast spray, wet apron concrete, and terminal multipath are not covered.
- M3DGR is a strong robustness benchmark, but any single benchmark can overfit fusion policies if used as the only acceptance gate.

## Sources

- M2DGR repository and dataset description: https://github.com/SJTU-ViSYS/M2DGR
- M2DGR arXiv paper: https://arxiv.org/abs/2112.13659
- Ground-Fusion repository: https://github.com/SJTU-ViSYS/Ground-Fusion
- M3DGR / robust ground SLAM benchmark arXiv paper: https://arxiv.org/abs/2507.08364
