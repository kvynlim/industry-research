# HeRCULES Radar Benchmark

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "benchmark"
  stage: "reference"
  maturity: "fielded-pattern"
  tags: ["slam", "validation", "data-engine", "outdoor", "adverse-weather"]
  reason: "HeRCULES Radar Benchmark is rated as a SLAM benchmark or reference page for comparing methods and deployments."
method-priority:end -->

Related docs: [4D imaging radar RIO and SLAM](4d-imaging-radar-rio-slam.md), [SNAIL Radar Benchmark](snail-radar-benchmark.md), [radar odometry and radar SLAM](radar-odometry-radar-slam.md), [radar-LiDAR-inertial fusion](radar-lidar-inertial-fusion.md), and [loop closure and place recognition](loop-closure-place-recognition.md).

**Last updated:** 2026-05-09

## Executive Summary

HeRCULES is a heterogeneous radar dataset for multi-session radar SLAM in complex urban environments. Its distinguishing feature is that it combines a 4D radar and a spinning radar on the same platform, alongside FMCW LiDAR, stereo cameras, IMU, and RTK-GPS. That makes it useful for cross-radar place recognition, radar-LiDAR fusion, and multi-session mapping where future robots may not carry identical radar hardware.

The dataset includes repeated paths, diverse weather and lighting, dynamic traffic, mountain/bridge/stream/street/campus settings, individual sensor ground truth, and ROS tooling.

## Sensor Suite

The project site lists:

- 4D radar: Continental ARS548.
- Spinning radar: Navtech RAS6.
- FMCW LiDAR: Aeva Aeries II.
- Stereo cameras: FLIR Blackfly S.
- IMU: Xsens MTi-300.
- RTK-GPS/INS: SPAN-CPT7.

Reported data rates include 4D radar at 20 Hz, spinning radar at 4 Hz, FMCW LiDAR at 10 Hz, stereo camera at 15 Hz, IMU at 100 Hz, and INS at 50 Hz.

## Timing and Calibration

HeRCULES exposes individual sensor ground truth in `[time, x, y, z, qx, qy, qz, qw]` form. The site explains that ground truth is generated per sensor using extrinsic calibration and B-spline interpolation so each sensor's own acquisition timestamp and installation point are represented.

Calibration references include:

- LiDAR to spinning radar using a Boreas-style method.
- LiDAR, 4D radar, and camera using a joint radar-camera-LiDAR calibration tool.
- LiDAR to IMU initialization using LI-Init.

This is important because place recognition evaluation can be biased if all sensors are treated as if they were captured at one body-center pose.

## Benchmark Tasks

HeRCULES supports:

- radar odometry,
- radar-inertial SLAM,
- radar-LiDAR fusion,
- heterogeneous radar place recognition,
- multi-session mapping,
- cross-sensor loop closure,
- radar point upsampling and representation learning.

The site also tracks recent SLAM and place-recognition research using the dataset, including radar-inertial SLAM, Doppler-aided radar-inertial/LiDAR-inertial SLAM, and heterogeneous radar place recognition.

## Scenes and Degradation

Sequence categories include mountain, library, sports complex, parking lot, river island, bridge, street, and stream. Conditions include clear weather, snow, rain, night, dusk, congestion, rough roads, rolling/pitching motion, and repeated traversals.

For AV and airside transfer, the bridge and street sequences are especially relevant because they combine high speed, weather, dynamic objects, and repetitive structure. The dataset still does not capture aircraft-scale reflectors, open apron sparsity, or airport terminal multipath.

## Integration Readiness

HeRCULES provides dataset downloads, ROS file players, radar format conversion, and point-cloud tooling. It is more integration-friendly than papers that release only bags without calibration context. Teams should still budget time for converting radar formats and deciding which coordinate frame and ground-truth stream to use for each benchmark.

## Limitations

- The value is highest for radar research; it is not a general AV perception dataset.
- Radar hardware is specific, and transfer to other 4D or spinning radar models must be tested.
- Urban Korean routes do not cover every ODD.
- Ground truth relies on calibration and interpolation choices that should be understood before fine-grained leaderboard claims.
- Large multi-sensor logs require careful sequence, frame, and timestamp governance.

## Sources

- HeRCULES arXiv paper: https://arxiv.org/abs/2502.01946
- HeRCULES dataset site: https://sites.google.com/view/herculesdataset/home
- HeRCULES system page: https://sites.google.com/view/herculesdataset/system
- HeRCULES sequences page: https://sites.google.com/view/herculesdataset/sequences
- HeRCULES paper PDF: https://minwoo0611.github.io/publications/icra2025-hercules.pdf
