# FusionPortableV2 Multi-Platform SLAM Dataset

Related docs: [benchmarking metrics and datasets](benchmarking-metrics-datasets.md), [LVI-SAM](lvi-sam.md), [FAST-LIVO2](fast-livo-fast-livo2.md), [event-camera VIO/SLAM](event-camera-vio-slam.md), and [M2DGR / M3DGR ground fusion](ground-fusion-m2dgr-m3dgr.md).

**Last updated:** 2026-05-09

## Executive Summary

FusionPortableV2 is a multi-sensor, multi-platform SLAM dataset for testing generalization across platforms and environments. It contains 27 sequences, more than 2.5 hours of data, about 38.7 km of travel, four platforms, ground-truth trajectories, calibration files, and RGB point-cloud maps covering about 0.3 square km.

The key value is platform diversity. A SLAM algorithm that works on a handheld rig may fail on a legged robot, UGV, or vehicle because motion profiles, vibration, wheel/leg proprioception, speed, camera exposure, and LiDAR degeneracy all change.

## Sensor Suite

The dataset documentation and paper describe a portable multi-sensor suite with:

- 128-beam Ouster OS1 LiDAR and its internal IMU.
- Stereo FLIR frame cameras.
- Stereo DAVIS event cameras and event-camera IMUs.
- STIM300 IMU.
- 3DM-GQ7-GNSS/INS.
- Platform-specific sensors such as UGV wheel encoders and Unitree A1 joint, contact, and IMU signals.

The system also provides calibration files for handheld, UGV, vehicle, and legged-robot sequences.

## Platforms and Scenarios

Platforms:

- handheld suite,
- legged robot,
- UGV,
- vehicle.

Example environments from the dashboard include escalator, corridor, underground parking lot, campus, and outdoor parking lot. The paper adds buildings, campuses, and urban areas.

This mix is valuable for testing whether a method is robust to motion pattern, not just scene appearance.

## Timing and Calibration

FusionPortableV2 emphasizes synchronization and calibration details:

- FPGA/PPS-based triggering is used for multiple sensors.
- The LiDAR rotation is phase-locked with camera capture timing for better LiDAR-camera integration.
- Non-triggerable sensors such as wheel encoders can have internal timestamp offsets relative to the trigger system.
- Calibration files are published by sequence/platform group.

This makes the dataset useful for studying practical timing issues in multi-sensor SLAM, especially when comparing LiDAR, frame-camera, event-camera, IMU, GNSS/INS, wheel, and legged proprioception.

## Benchmark Use

Use FusionPortableV2 to evaluate:

- LiDAR-inertial odometry.
- Visual-inertial odometry.
- LiDAR-visual-inertial odometry.
- Event-camera fusion.
- Wheel/proprioceptive fusion.
- Cross-platform SLAM generalization.
- Monocular depth and mapping side tasks.

Metrics:

- ATE/RPE by platform.
- Initialization success by platform and environment.
- Robustness to high dynamics, legged vibration, and vehicle speed.
- Map consistency and RGB point-cloud quality.
- Performance with and without platform-specific proprioception.
- Calibration sensitivity and time-offset sensitivity.

## Dynamic and Map-Quality Notes

The dashboard notes that some dynamic objects remain in the ground-truth maps and recommends using maps from the original FusionPortable dataset for clear-map experiments. That is an important warning: if the benchmark is used for localization-to-map or map-quality evaluation, dynamic-object contamination must be accounted for.

## Integration Readiness

FusionPortableV2 is a dataset rather than a runtime stack, but it is integration-friendly because it publishes data, ground truth, calibration files, development tools, and experiment pages. It is a good acceptance gate before claiming that a SLAM method generalizes beyond one robot form factor.

## Limitations

- It is not airside-, mine-, or port-specific.
- Dynamic objects in maps can affect localization and map-quality metrics.
- Platform-specific sensors make comparisons unfair unless sensor usage is reported.
- Multi-sensor synchronization details must be understood before drawing fine-grained timing conclusions.
- A method tuned on all 27 sequences may overfit the dataset's platform mix.

## Sources

- FusionPortableV2 arXiv paper: https://arxiv.org/abs/2404.08563
- FusionPortableV2 dataset dashboard: https://fusionportable.github.io/dataset/fusionportable_v2/
- FusionPortableV2 IJRR article: https://journals.sagepub.com/doi/10.1177/02783649241303525
- FusionPortable dataset tools: https://github.com/fusionportable/fusionportable_dataset_tools
