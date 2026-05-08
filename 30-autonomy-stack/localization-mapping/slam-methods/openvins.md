# OpenVINS

## Executive Summary

OpenVINS is an open-source visual-inertial estimation platform centered on a sliding-window Multi-State Constraint Kalman Filter (MSCKF). It is a research and engineering framework rather than only a single algorithm release: it includes sparse feature tracking, inertial propagation, MSCKF updates, optional SLAM landmarks, online calibration for camera intrinsics/extrinsics and camera-IMU time offset, simulation, evaluation tools, and detailed derivations.

OpenVINS is the strongest filter-based counterpart to optimization-based systems such as [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md). Where VINS solves a nonlinear least-squares problem over a sliding window, OpenVINS maintains an EKF covariance over the current IMU state, cloned historical poses, calibration variables, and optional landmark states. Visual feature tracks constrain the cloned poses without necessarily keeping every feature as a persistent state, which is the defining MSCKF idea.

For autonomous vehicles, OpenVINS is valuable because it exposes covariance, consistency mechanisms, and calibration states more explicitly than many visual SLAM systems. It is well aligned with the estimator discipline in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md). For airside deployment, OpenVINS is a strong candidate VIO module for GPS-denied bridging, but it is not a full global SLAM/localization stack by itself: it needs LiDAR/GNSS/wheel/map factors and operational health monitoring around it.

## Historical Context

The MSCKF line predates modern sliding-window optimization VIO. Its key insight is that a visual feature observed across several camera poses can constrain those poses without adding the feature as a long-lived state in the filter. This keeps the state bounded while still exploiting multi-view geometry.

OpenVINS, presented at ICRA 2020 by Geneva, Eckenhoff, Lee, Yang, and Huang, was created to provide an open, documented, extensible platform for visual-inertial estimation research. Many VIO papers describe algorithms but release code that is hard to modify or poorly documented. OpenVINS explicitly targets the gap between research derivations and reusable engineering infrastructure.

Its design is also influenced by consistency research in VINS. Naive EKF linearization can violate the observability properties of visual-inertial systems, producing overconfident estimates. OpenVINS includes First-Estimate Jacobian (FEJ) treatments and careful state management to improve consistency. This makes it particularly relevant for safety-oriented localization studies where covariance quality matters, not only trajectory RMSE.

## Sensor Assumptions

OpenVINS supports:

- Monocular cameras.
- Synchronized stereo cameras.
- Binocular/multiple synchronized cameras depending on configuration.
- IMU as the core propagation sensor.
- KLT or descriptor-based sparse visual tracking.
- Optional ARUCO tag SLAM landmarks or sparse SLAM landmarks.
- Online estimation of camera intrinsics, camera-IMU extrinsics, camera-IMU time offset, and IMU intrinsics in supported configurations.

Core assumptions:

- Camera and IMU timestamps are known accurately enough for propagation and update.
- IMU measurements are available at higher rate than images.
- Camera intrinsics/extrinsics are initialized well enough for convergence, even if refined online.
- Feature tracks are long and well distributed enough to constrain motion.
- The scene is mostly static.
- The estimator receives enough motion excitation for scale, gravity, velocity, and biases to become observable.
- IMU noise parameters are realistic.

For airside vehicles, OpenVINS should be used with global-shutter cameras, hardware synchronization, an industrial IMU, and conservative calibration management. Online calibration is helpful but should not be treated as a replacement for good offline calibration.

## State/Map Representation

OpenVINS models the estimator state as a modular EKF state. The exact state depends on configuration, but typically includes:

- Current IMU orientation.
- Current IMU position.
- Current IMU velocity.
- Gyroscope bias.
- Accelerometer bias.
- A sliding window of cloned historical IMU poses at camera times.
- Camera-IMU extrinsic calibration states.
- Camera intrinsics if online calibration is enabled.
- Camera-IMU time offset if enabled.
- IMU intrinsic parameters if enabled.
- Optional SLAM landmarks.

The MSCKF portion uses feature tracks that span multiple cloned poses. When a feature track is mature or lost, its measurement residual is projected into the nullspace of the feature Jacobian. That allows the feature to update the cloned poses and IMU state without being directly kept as a persistent map landmark.

OpenVINS can also include SLAM features as explicit landmark states. This hybrid capability means it can behave like a pure MSCKF estimator, an MSCKF plus sparse SLAM landmark estimator, or an estimator with special environmental landmarks such as tags.

This is not the same map representation as [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md). ORB-SLAM is keyframe/landmark-map centered with loop closure and map reuse. OpenVINS is filter-state centered and primarily odometric unless extended with external global correction.

## Algorithm Pipeline

OpenVINS pipeline:

1. IMU propagation:
   - Integrate high-rate IMU measurements.
   - Propagate nominal state and covariance on the appropriate manifold.
   - Track gyro and accelerometer biases.

2. Image processing and feature tracking:
   - Track sparse features using KLT or descriptor-based methods.
   - Maintain feature tracks across camera frames.
   - Support monocular or stereo observations depending on configuration.

3. State cloning:
   - Clone the IMU pose at camera timestamps.
   - Keep a bounded sliding window of clones.

4. MSCKF update:
   - For completed feature tracks, form visual residuals across all observing clones.
   - Linearize the measurement model.
   - Project out the feature state so the update constrains poses without adding the feature permanently.
   - Apply the EKF update to the state and covariance.

5. SLAM landmark update, if enabled:
   - Initialize selected landmarks into the state.
   - Update landmarks and platform state when reobserved.

6. Calibration update, if enabled:
   - Estimate camera intrinsics/extrinsics, time offset, and IMU intrinsic parameters online.

7. Marginalization and cleanup:
   - Remove old clones and features to keep state size bounded.
   - Preserve covariance consistency through the state helper/type system.

8. Evaluation and simulation:
   - Use included tools to run datasets, compare trajectories, and test estimator variants.

## Formulation

OpenVINS is an EKF/MSCKF estimator. The IMU propagation step predicts:

```text
x_k|k-1 = f(x_k-1, imu_measurements)
P_k|k-1 = F P_k-1 F^T + G Q G^T
```

where `x` is the nominal state on manifolds such as SO(3)/SE(3), `P` is the covariance, `F` is the linearized error-state transition, and `Q` is IMU process noise.

For a feature observed from multiple cloned poses:

```text
r = z - h(x_clones, feature)
r ~= H_x * dx + H_f * df + n
```

MSCKF eliminates the feature perturbation `df` by projecting the residual into the left nullspace of `H_f`:

```text
N^T r ~= N^T H_x * dx + N^T n
```

The resulting residual updates the platform state and clones without adding the feature as a long-lived state. This is the defining computational advantage of MSCKF.

OpenVINS also emphasizes First-Estimate Jacobians. FEJ linearizes certain terms at first-estimate values rather than repeatedly changing all linearization points. The purpose is to preserve the correct unobservable directions of the VIO problem, improving estimator consistency and reducing overconfidence.

Compared with [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md):

- OpenVINS: recursive EKF/MSCKF, explicit covariance, efficient updates, consistency-focused.
- VINS: batch/sliding-window nonlinear optimization, marginalization prior, often higher accuracy in some settings but different consistency/runtime tradeoffs.

## Failure Modes

OpenVINS failure modes:

- Poor initialization: bad gravity, scale, velocity, or bias initialization can destabilize early estimates.
- Weak feature tracks: low texture, motion blur, overexposure, and rain reduce update quality.
- Dynamic features: moving aircraft, workers, baggage carts, and service vehicles can corrupt visual residuals.
- Poor feature geometry: features concentrated in one image region or at similar depths weaken observability.
- Degenerate vehicle motion: long constant-velocity straight segments with weak visual parallax can make some states hard to estimate.
- Time synchronization errors: camera-IMU offset errors are damaging even if online calibration is enabled.
- Calibration observability problems: online calibration needs appropriate motion; otherwise parameters can drift or couple with pose errors.
- IMU vibration/saturation: rough pavement, engine vibration, or sensor mounting resonance can violate noise assumptions.
- Filter inconsistency: despite FEJ, poor tuning or bad outlier rejection can make covariance overconfident.
- No built-in global loop closure equivalent to ORB-SLAM3: drift remains unless external global updates are fused.

For airside operations, the most important risk is not simply trajectory RMSE; it is silent overconfidence during visual degradation. Health metrics and innovation monitoring are mandatory.

## AV Relevance

OpenVINS is relevant to AVs because:

- It estimates pose, velocity, and IMU biases in a form compatible with vehicle state estimation.
- It maintains covariance, making it easier to fuse with GNSS, LiDAR, and wheel odometry.
- It supports online calibration states, useful for long-lived robotic platforms.
- It is computationally efficient compared with full bundle-adjustment SLAM.
- It has strong documentation and evaluation tooling.

Limitations:

- It is local odometry/VIO, not complete global localization.
- It does not by itself encode map semantics, drivable space, or airport topology.
- It does not replace LiDAR scan-to-map localization or RTK-GNSS in open-sky areas.
- It needs robust measurement validation before contributing to a safety-critical estimate.

For a production-style AV stack, OpenVINS is best used as a VIO measurement source feeding the central filter/factor graph. Its covariance and consistency focus make it a good match for the architecture described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).

## Indoor/Outdoor Relevance

Indoor:

- Strong fit for GPS-denied indoor areas such as baggage halls, tunnels, warehouses, maintenance bays, and terminal service corridors.
- Stereo/multi-camera support helps when texture is close and parallax is available.
- Controlled lighting improves feature tracking and calibration stability.

Outdoor:

- Useful for local odometry near terminals, service roads, and apron areas with visual structure.
- Open aprons and runways can be difficult due to low texture and long feature range.
- Outdoor lighting, rain, reflections, and shadows require robust feature rejection and estimator gating.

Indoor/outdoor transitions:

- OpenVINS can bridge periods where GNSS degrades or disappears.
- The central estimator should manage the transition between GNSS/global map frame and local VIO frame.
- OpenVINS covariance growth during GNSS denial is an operational signal for speed limiting or safe stop decisions.

## Airside Deployment Notes

Deployment guidance:

- Use stereo or multi-camera OpenVINS for vehicle testing where possible.
- Use hardware-synchronized global-shutter cameras and IMU.
- Calibrate offline, then enable online calibration conservatively if needed.
- Tune IMU noise and bias parameters from stationary and motion logs.
- Feed OpenVINS output to the central estimator with covariance and innovation gating.
- Monitor feature count, feature track length, spatial distribution, update residuals, covariance growth, clone count, bias estimates, and calibration drift.
- Add dynamic masks for aircraft, vehicles, personnel, and GSE if visual features on moving objects dominate.
- Treat online calibration changes as diagnostic events; large calibration movement may indicate mechanical shift or bad observability.
- Validate with airport-specific sequences: terminal overhangs, baggage halls, long apron drives, night/rain, wet pavement, aircraft occlusion, and repeated stands.
- Do not allow OpenVINS alone to authorize movement near runway/taxiway safety boundaries without independent localization/map agreement.

OpenVINS is especially interesting for airside vehicles because it can provide a covariance-aware local odometry source through GNSS multipath zones, which are common near terminals and large aircraft.

## Datasets/Metrics

Datasets commonly used with OpenVINS:

- EuRoC MAV: synchronized stereo + IMU with high-quality ground truth.
- TUM-VI: fisheye stereo + IMU sequences.
- KAIST Urban and KAIST VIO datasets: useful for vehicle-scale/urban evaluation.
- UZH-FPV drone racing dataset: useful for aggressive motion and VIO stress testing.
- RPNG/OpenVINS datasets and simulator examples.
- Custom airport datasets are required for airside conclusions.

Metrics:

- ATE/APE and RPE.
- NEES/NIS or other consistency measures when covariance is available.
- Feature track statistics: count, length, spatial distribution, outlier rate.
- Bias convergence and stability.
- Calibration parameter stability.
- Covariance growth during visual or GNSS outages.
- Runtime and memory as clone/window size changes.
- Failure/reinitialization count.

For airside evaluation, the key metrics are covariance honesty during degradation, drift rate while GNSS is denied, consistency with LiDAR/GNSS/wheel updates, and false confidence near low-texture apron regions.

## Open-Source Implementations

- OpenVINS official repository: `rpng/open_vins`, an open-source platform for visual-inertial navigation research.
- OpenVINS documentation: detailed getting-started guides, derivations, state definitions, FEJ explanations, calibration notes, supported datasets, and evaluation tools.
- Core modules:
  - `ov_core`: tracking utilities, math types, initialization, simulation support.
  - `ov_msckf`: filter-based visual-inertial estimator.
  - `ov_eval`: evaluation tooling.

Implementation cautions:

- OpenVINS is more configurable than many VIO systems; wrong configuration can produce misleading results.
- Online calibration should be enabled only when the motion makes the calibration observable.
- Feature tracking choices affect estimator consistency and robustness.
- Dataset configs should not be copied blindly to custom sensors.
- Integrating with ROS vehicle stacks requires careful frame conventions and timestamp handling.

## Practical Recommendation

For visual-inertial SLAM Part A, OpenVINS should be the primary filter-based VIO reference. It complements [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md):

- Choose OpenVINS when covariance quality, estimator consistency, online calibration research, or embedded efficiency matters.
- Choose VINS-Fusion when stereo-inertial optimization and built-in global/GPS fusion examples are the immediate priority.
- Compare both on the same airside logs before making architecture decisions.

For airside AVs, OpenVINS is a strong candidate for local VIO inside a multi-sensor localization stack. It should be fused with RTK-GNSS, LiDAR scan-to-map, wheel odometry, and map priors, and it should be downweighted or rejected when feature quality, residuals, or covariance diagnostics indicate degradation. It is not a standalone replacement for the broader localization architecture in [Mapping and Localization](../overview/mapping-and-localization.md).

## Sources

### Primary Papers and Repositories

- Geneva, Eckenhoff, Lee, Yang, and Huang, "OpenVINS: A Research Platform for Visual-Inertial Estimation": https://udel.edu/~pgeneva/downloads/papers/c10.pdf
- OpenVINS official documentation: https://docs.openvins.com/
- OpenVINS official repository: https://github.com/rpng/open_vins
- OpenVINS getting started documentation: https://docs.openvins.com/getting-started.html
- OpenVINS FEJ documentation: https://docs.openvins.com/fej.html
- OpenVINS State class documentation: https://docs.openvins.com/classov__msckf_1_1State.html

### Related Methods and Background

- Mourikis and Roumeliotis, "A Multi-State Constraint Kalman Filter for Vision-aided Inertial Navigation": https://ieeexplore.ieee.org/document/4209642
- Qin, Li, and Shen, "VINS-Mono: A Robust and Versatile Monocular Visual-Inertial State Estimator": https://arxiv.org/abs/1708.03852
- Forster et al., "IMU Preintegration on Manifold for Efficient Visual-Inertial Maximum-a-Posteriori Estimation": https://arxiv.org/abs/1512.02363

### Datasets and Benchmarks

- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- TUM Visual-Inertial Dataset: https://cvg.cit.tum.de/data/datasets/visual-inertial-dataset
- OpenVINS supported datasets: https://docs.openvins.com/gs-datasets.html
- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php

### Internal Cross-Links

- [Mapping and Localization](../overview/mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
- [LSD-SLAM and DSO](lsd-slam-dso.md)
- [SVO](svo.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
