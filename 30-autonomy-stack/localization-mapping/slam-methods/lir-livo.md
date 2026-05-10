# LIR-LIVO

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "LIR-LIVO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [FAST-LIVO and FAST-LIVO2](fast-livo-fast-livo2.md), [LVI-SAM](lvi-sam.md), [R2LIVE and R3LIVE](r2live-r3live.md), [visual-inertial SLAM](vins-mono-vins-fusion.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

**Last updated:** 2026-05-09

## Executive Summary

LIR-LIVO is a lightweight LiDAR-inertial-visual odometry system designed for challenging illumination and degraded environments. It brings modern learned feature matching into LIVO: SuperPoint-style illumination-resilient features and LightGlue-style adaptive matching are combined with LiDAR depth association so visual features are better distributed in depth.

The method is interesting because it targets a common failure in LIVO stacks: direct photometric methods and hand-crafted visual features can struggle with lighting changes, low texture, exposure shifts, and motion blur. LIR-LIVO keeps LiDAR and IMU as geometric/inertial anchors while using learned features to make the visual channel more robust.

## What It Adds

- Illumination-resilient deep visual features inside a LiDAR-visual-inertial odometry pipeline.
- Adaptive feature matching using SuperPoint and LightGlue-style components.
- LiDAR depth association to encourage a more uniform feature-depth distribution.
- Benchmarking on NTU-VIRAL, Hilti 2022, and R3LIVE datasets.
- A lightweight positioning relative to heavier reconstruction-oriented LIVO systems.

## Sensor Model

Sensor suite:

- 3D LiDAR.
- Camera.
- IMU.

The visual front end depends on learned features and learned matching. LiDAR gives metric depth for visual features and stabilizes scale. IMU supplies high-rate propagation and attitude continuity.

## Timing and Calibration

LIR-LIVO inherits all LIVO calibration requirements:

- LiDAR-IMU extrinsics and time offset.
- Camera-IMU extrinsics and time offset.
- LiDAR-camera extrinsics.
- Camera intrinsics, distortion, exposure behavior, and rolling-shutter status.

The learned matcher does not remove synchronization requirements. A robust feature match with wrong timing is still a biased constraint.

## Dynamic and Degraded Scenes

The method targets:

- illumination changes,
- indoor/outdoor transitions,
- low-light or overexposed camera frames,
- LiDAR-degraded geometry where visual texture can help,
- visual degradation where LiDAR and IMU can maintain the estimate.

Dynamic objects need explicit masking or robust rejection. Learned features can match moving vehicles, people, screens, reflections, and temporary objects if the pipeline does not separate static localization structure from dynamic content.

## Evaluation Guidance

Use:

- ATE/RPE across lighting changes.
- Visual inlier count by illumination condition.
- Feature-depth distribution before and after LiDAR association.
- Runtime split for feature extraction, matching, LiDAR update, and filter/graph update.
- Ablations against classical visual features and LiDAR-only LIO.
- Failure cases under camera occlusion, motion blur, and poor LiDAR-camera overlap.

## Integration Readiness

LIR-LIVO is most useful as a research baseline for learned-feature LIVO in bad lighting. During this pass, the primary source was the paper; no official implementation was verified from the sources used here. That makes it less integration-ready than FAST-LIVO2, R3LIVE, or LVI-SAM unless code or reproducible configuration is obtained.

## Limitations

- Learned visual features can add GPU load and model-version dependency.
- Feature matching still fails under severe blur, saturation, dirt, or no texture.
- LiDAR-camera overlap matters for depth association.
- Training-domain bias can affect airport, tunnel, mine, or warehouse transfer.
- Without map lifecycle and dynamic-object filtering, it remains local odometry rather than production localization.

## Sources

- LIR-LIVO arXiv paper: https://arxiv.org/abs/2502.08676
- FAST-LIVO2 paper: https://arxiv.org/abs/2408.14035
- R3LIVE paper: https://arxiv.org/abs/2209.03666
- LVI-SAM paper: https://arxiv.org/abs/2104.10831
