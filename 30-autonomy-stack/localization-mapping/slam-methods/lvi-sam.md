# LVI-SAM

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "LVI-SAM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [LIO-SAM](lio-sam.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [FAST-LIVO and FAST-LIVO2](fast-livo-fast-livo2.md), [R2LIVE and R3LIVE](r2live-r3live.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Executive Summary

LVI-SAM is a tightly coupled LiDAR-visual-inertial odometry and mapping system by Shan, Englot, Ratti, and Rus. It builds on factor-graph smoothing and combines a visual-inertial subsystem (VIS) with a LiDAR-inertial subsystem (LIS). The subsystems help each other: LiDAR provides depth for visual features, visual-inertial estimates provide initial guesses for LiDAR scan matching, and loop closures are first detected visually and then refined by LiDAR.

LVI-SAM is best understood as a research-grade multi-sensor SLAM architecture in the LIO-SAM/VINS-Mono lineage. It is more robust than pure LIO or pure VIO in cases where one exteroceptive sensor degrades, but it also has heavier calibration, synchronization, and compute requirements.

For AV and airside applications, LVI-SAM is useful as a reference architecture for combining LiDAR, cameras, and IMU in a smoothing framework. It is not a drop-in production localization stack: production needs map-version handling, deterministic latency, dynamic-object filtering, calibrated uncertainty, health monitoring, and robust fallback behavior.

## Sensor, Noise, and Calibration Assumptions

LVI-SAM assumes a 3D LiDAR, a monocular camera, and an IMU with usable overlap in time and, for depth association, overlap in field of view. The LiDAR-to-IMU, camera-to-IMU, and camera intrinsic/distortion calibrations are central to the method because visual features are assigned LiDAR depth and LiDAR scan matching uses visual-inertial motion estimates.

Noise assumptions span all three modalities: IMU bias/noise must match preintegration settings, LiDAR features must remain geometrically informative, and camera tracking must survive lighting, exposure, blur, and texture changes. Calibration or time-offset errors can appear as wrong feature depths, scan-matching bias, map warping, or false loop closures.

## Core Idea

LVI-SAM couples two factor-graph systems:

- **VIS:** a visual-inertial subsystem adapted from VINS-Mono-style visual tracking and optimization.
- **LIS:** a LiDAR-inertial subsystem adapted from LIO-SAM-style LiDAR scan matching and smoothing.

The coupling is not just loose pose fusion. LiDAR helps vision by assigning depth to visual features, reducing monocular scale and feature-depth uncertainty. Vision helps LiDAR by providing motion priors and loop candidates. LiDAR then refines loop closures geometrically.

The practical philosophy is:

```text
LiDAR supplies metric geometry and depth.
Camera supplies texture, visual loops, and constraints in LiDAR-degenerate scenes.
IMU supplies high-rate propagation and motion compensation.
Factor graphs smooth the combined constraints.
```

## Pipeline

1. Receive synchronized LiDAR, camera, and IMU measurements.
2. Propagate motion with IMU preintegration.
3. Track visual features in the camera stream.
4. Associate LiDAR depth with selected visual features.
5. Optimize the visual-inertial subsystem with depth-aided feature constraints.
6. Use VIS estimates to initialize or support LiDAR scan matching.
7. Extract LiDAR features and register scans/submaps in the LIS.
8. Add LiDAR odometry, IMU, and visual constraints to factor graphs.
9. Detect loop closures in the visual subsystem.
10. Refine loop closures with LiDAR geometric registration.
11. Optimize the trajectory and map with smoothing.
12. Continue operation when one subsystem temporarily weakens, if the other remains healthy.

## Strengths

- Multi-sensor redundancy: LiDAR can help in low-texture scenes and vision can help in geometrically weak scenes.
- LiDAR depth improves visual feature constraints compared with pure monocular VIO.
- Visual loop detection can provide candidates that pure LiDAR methods might miss.
- LiDAR refinement reduces visual-loop false alignment risk.
- Factor-graph architecture is understandable and extensible for research.
- Built on familiar LIO-SAM and VINS-Mono concepts.
- Can operate across indoor, outdoor, handheld, vehicle, and mixed-scale datasets in the paper.

## Limitations

- Requires careful camera-LiDAR-IMU extrinsic calibration.
- Requires usable time synchronization across all sensors.
- More computationally complex than pure LIO or pure VIO.
- Camera performance depends on lighting, exposure, motion blur, weather, lens cleanliness, and texture.
- LiDAR performance still depends on geometry and dynamic-object filtering.
- Visual feature depth association can fail with sparse LiDAR, narrow camera/LiDAR overlap, rolling shutter, or calibration error.
- Base research implementation is ROS 1 oriented and older than current ROS 2 production stacks.
- It is not primarily a fixed-map production localizer.

## AV Relevance

LVI-SAM is relevant to AVs because it shows a concrete architecture for tight LiDAR-camera-IMU coupling:

- cameras reduce reliance on LiDAR geometry alone,
- LiDAR gives metric scale and depth to camera features,
- IMU supports high-rate prediction and deskewing,
- factor graphs handle delayed loop closures and multi-rate constraints.

This is conceptually aligned with production localization, but production systems usually add more layers:

- fixed HD-map localization rather than open-ended SLAM,
- wheel odometry and vehicle kinematic constraints,
- GNSS/RTK with multipath rejection,
- semantic/dynamic-object filtering,
- calibrated covariance and fault detection,
- stable localization frames that do not jump after global graph updates.

For an AV team, LVI-SAM is a useful research baseline and design reference, especially when comparing tightly coupled LVI smoothing against faster filter-based LIO/LIVO methods.

## Indoor/Outdoor Notes

**Indoor:** LVI-SAM is strong when indoor scenes have either texture or LiDAR geometry. It can handle some textureless or featureless periods because the other modality may carry the estimate. Watch for glass, repeated corridors, low light, and dynamic crowds.

**Outdoor:** It is useful on campuses, urban roads, and mixed indoor-outdoor routes. Cameras help with loop candidates and visual landmarks, while LiDAR helps scale and geometry. Weather, sun glare, darkness, and dynamic traffic must be handled upstream.

**Airside:** Airside deployments benefit from multi-sensor redundancy near terminals, hangars, cargo areas, and service roads. Open aprons remain hard because LiDAR geometry can be weak and camera texture may be limited to markings and distant objects. Lighting transitions, rain, jet blast debris, aircraft occlusion, and moving GSE raise the calibration and filtering burden.

## Comparison

| Method | Sensors | Estimation style | Distinctive coupling | AV interpretation |
|---|---|---|---|---|
| LVI-SAM | LiDAR + camera + IMU | Factor-graph smoothing | LiDAR depth for visual features; visual loops refined by LiDAR | Clear LVI-SLAM reference architecture |
| LIO-SAM | LiDAR + IMU, optional GPS | Factor graph | LiDAR features + IMU preintegration | Simpler LIO baseline |
| FAST-LIO2 | LiDAR + IMU | Iterated EKF | Direct raw-point LiDAR update | Faster LIO odometry front end |
| FAST-LIVO2 | LiDAR + camera + IMU | ESIKF | Direct LiDAR and direct photometric updates in one voxel map | Modern direct LIVO odometry |
| R3LIVE | LiDAR + camera + IMU | LIO + VIO subsystems | Real-time RGB-colored map reconstruction | Reconstruction-oriented LIV lineage |
| GLIM | Range + IMU | Factor graph with scan-matching factors | Direct registration factors | Mapping/research workbench |

## Evaluation

Evaluate LVI-SAM both as a trajectory estimator and as a multi-sensor robustness strategy.

Useful metrics:

- absolute trajectory error and relative pose error,
- scale consistency of visual estimates,
- loop-closure precision and recall,
- LiDAR refinement success rate for visual loop candidates,
- performance when camera is degraded,
- performance when LiDAR geometry is degenerate,
- sensitivity to extrinsic and time-offset errors,
- runtime and latency on target hardware,
- map consistency after loop closure,
- failure recovery after one subsystem loses tracking.

For airside testing, include night/day transitions, terminal shadows, rain, apron-only routes, aircraft occlusion, repeated gates, and temporary equipment.

## Implementation Notes

- Start with the official `TixiaoShan/LVI-SAM` repository for reference behavior.
- Configure all sensor parameters in the package YAML files before running.
- Confirm camera intrinsics, distortion model, LiDAR-camera extrinsics, LiDAR-IMU extrinsics, and IMU noise parameters.
- Validate timestamp alignment with bag replay before interpreting SLAM accuracy.
- Use a LiDAR/camera setup with sufficient overlapping field of view if relying on LiDAR depth for visual features.
- Treat loop closures as map-building corrections; isolate them from a production control-pose stream.
- Expect ROS 1 integration work if the target AV stack is ROS 2.
- Add image quality, feature count, LiDAR residual, and IMU saturation monitors for production-like tests.

## Practical Recommendation

Use LVI-SAM as a reference for tightly coupled LiDAR-visual-inertial smoothing and for studying how LiDAR and vision can rescue each other in degraded scenes. It is especially useful as a comparison point against LIO-SAM, FAST-LIO2, FAST-LIVO2, and R3LIVE.

Do not deploy it unchanged as a production AV localizer. Treat it as research architecture and wrap any reused ideas in a production fusion stack with calibration management, fixed-map localization, health monitoring, dynamic-object filtering, and safety-oriented correction handling.

## Sources

- Shan, Englot, Ratti, and Rus, "LVI-SAM: Tightly-coupled Lidar-Visual-Inertial Odometry via Smoothing and Mapping," ICRA 2021. https://arxiv.org/abs/2104.10831
- LVI-SAM official repository. https://github.com/TixiaoShan/LVI-SAM
- LVI-SAM paper PDF in repository. https://raw.githubusercontent.com/TixiaoShan/LVI-SAM/master/doc/paper.pdf
- LIO-SAM paper. https://arxiv.org/abs/2007.00258
- LIO-SAM official repository. https://github.com/TixiaoShan/LIO-SAM
- VINS-Mono repository, cited by LVI-SAM as visual-inertial module lineage. https://github.com/HKUST-Aerial-Robotics/VINS-Mono
