# Thermal-Inertial SLAM and Odometry

Related docs: [event and thermal camera models](../../../10-knowledge-base/geometry-3d/event-thermal-camera-models.md), [thermal IR cameras](../../../20-av-platform/sensors/thermal-ir-cameras.md), [night operations thermal fusion](../../perception/overview/night-operations-thermal-fusion.md), [OpenVINS](openvins.md), [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md), [SVO](svo.md), [LSD-SLAM / DSO](lsd-slam-dso.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

## Executive Summary

Thermal-inertial SLAM/VIO fuses long-wave infrared (LWIR) or thermal camera measurements with IMU propagation. It targets environments where visible cameras fail: darkness, smoke, fog, dust, weak lighting, and strong visible-spectrum illumination changes. Representative work includes KTIO, ROVTIO, TP-TIO, DeepTIO, and RGB-thermal-inertial variants.

Thermal cameras are not simply grayscale cameras. Their images encode emitted radiance and temperature contrast, not visible texture. They suffer from nonuniformity correction events, low spatial resolution, temperature drift, changing radiometric scale, and weak gradients when objects have similar temperatures. Successful thermal-inertial methods therefore either work on full radiometric data directly, learn thermal keypoints, or carefully manage cross-spectral fusion.

For AV and airside use, thermal-inertial odometry is a useful night/adverse-visibility fallback and a strong indoor/subterranean research direction. It is not a complete localization stack; it should be fused with LiDAR, radar, wheel odometry, GNSS/RTK, and map localization.

## Problem Fit

Thermal-inertial SLAM fits:

- Darkness and poor visible lighting.
- Smoke, fog, dust, or airborne obscurants where visible cameras degrade.
- Search/rescue, mines, tunnels, hangars, and industrial facilities.
- Night airside operations with people, engines, tires, and vehicles producing thermal contrast.
- Aerial robots where LiDAR payload may be limited.

It is weaker for:

- Thermally uniform environments.
- Hot days where background and objects have similar apparent temperature.
- Scenes with frequent thermal camera flat-field correction interruptions.
- Long-term map reuse where thermal appearance changes with weather, sun exposure, and equipment state.

## Sensor Model

Thermal cameras measure infrared radiance, often represented as 14-bit or 16-bit radiometric frames:

```text
I_T(u, v, t) = radiance / temperature-correlated intensity
```

Methods may use:

- Raw radiometric thermal images.
- Rescaled 8-bit thermal images.
- Learned thermal feature maps.
- RGB + thermal + IMU.
- Thermal + LiDAR + IMU in newer multimodal systems.

The VIO state is familiar:

```text
x = [R, p, v, b_g, b_a, T_thermal_imu, camera_intrinsics]
```

If RGB-T is used:

```text
x += [T_rgb_thermal, T_rgb_imu, optional temporal offsets]
```

Thermal-specific nuisance states may include gain/offset or frame normalization parameters, though many systems handle these in preprocessing rather than the estimator state.

## Pipeline

1. **Thermal image acquisition**
   - Capture raw radiometric frames when possible.
   - Detect or handle nonuniformity correction / flat-field correction interruptions.

2. **Preprocessing**
   - Avoid naive per-frame rescaling when it destroys temporal consistency.
   - Use radiometric normalization, denoising, or learned thermal keypoint detection.

3. **Front-end tracking**
   - KTIO-style direct methods track radiometric patches/landmarks.
   - TP-TIO uses ThermalPoint features and radiometric tracking.
   - ROVTIO-style visual-thermal-inertial systems combine visible and thermal cues.
   - RGB-T methods use cross-modal feature selection or handover.

4. **IMU integration**
   - Preintegrate IMU between keyframes.
   - Use IMU priors for scale, gravity, velocity, and robustness to fast motion.

5. **Back-end optimization**
   - Optimize reprojection/direct thermal residuals with IMU residuals.
   - Maintain keyframes, landmarks, and marginalization priors.

6. **Mapping**
   - Usually sparse or semi-dense.
   - Dense thermal maps are less reusable than geometric maps due to changing radiometry.

## Mathematical Mechanics

KTIO-style direct thermal-inertial odometry minimizes radiometric and inertial residuals:

```text
X* = arg min_X
    sum_imu      || r_imu(x_i, x_j) ||^2
  + sum_thermal  rho(|| I_k(u) - I_ref(warp(u, T, d)) ||^2)
  + sum_prior    || r_prior ||^2
```

Feature-based thermal-inertial methods use learned or classical keypoints:

```text
r_reproj = z_uv - pi(T_CW p_W)
```

TP-TIO improves the front end with ThermalPoint:

```text
thermal image -> keypoint detector -> radiometric tracking -> VIO graph
```

RGB-T-inertial systems can use modality-dependent residuals:

```text
X* = arg min_X
    sum_imu      || r_imu ||^2
  + sum_rgb      rho(|| r_rgb_reproj ||^2)
  + sum_thermal  rho(|| r_thermal ||^2)
  + sum_cross    rho(|| r_rgb_thermal_consistency ||^2)
```

The central technical issue is measurement stability. Visible VIO assumes photometric or feature repeatability under lighting changes; thermal VIO must reason about radiometric drift, thermal contrast, and sensor correction events.

## Assumptions

- Thermal camera intrinsics and distortion are calibrated.
- Thermal-IMU extrinsics and timestamps are accurate.
- The scene has enough thermal gradients.
- Dynamic thermal sources do not dominate tracking.
- Radiometric values are stable enough for the chosen residual.
- Nonuniformity correction events are detected and handled.
- IMU excitation is sufficient for scale/gravity/bias observability.
- RGB-T methods have stable cross-spectral calibration.

## Strengths

- Works in darkness without active illumination.
- More robust than visible cameras in some smoke/dust/fog conditions.
- Useful for people, vehicles, engines, tires, brakes, and powered equipment at night.
- Radiometric direct methods can exploit information lost by 8-bit rescaling.
- Learned thermal keypoints can improve correspondence under noise.
- Complements LiDAR/radar by adding passive semantic/thermal structure.

## Limitations

- Low thermal contrast can be worse than visible imagery.
- Thermal appearance changes over time, weather, sun exposure, and equipment state.
- LWIR cameras often have lower resolution and lower frame rate than RGB cameras.
- Flat-field/nonuniformity correction can interrupt frames and shift appearance.
- Glass and some materials behave very differently in thermal imagery.
- Long-term thermal maps are hard to reuse without geometric anchoring.
- Thermal cameras are useful for detection, but thermal-only SLAM is not enough for certified vehicle localization.

## Datasets and Benchmarks

Relevant datasets:

- **KTIO / ARL thermal-inertial field datasets:** underground mines, indoor lab, and urban/parking deployments.
- **TP-TIO datasets:** smoke-filled and visually degraded environments from the ThermalPoint work.
- **ROVTIO thesis data:** visual, thermal, and inertial data for flying robot odometry.
- **Caltech Aerial RGB-Thermal Dataset:** includes RGB-thermal benchmarks and VIO/SLAM relevance.
- **UMA-VI:** low-texture/dynamic illumination visual-inertial dataset; not thermal, but useful as a visible-camera stress baseline.
- **Custom airside thermal data:** required for night floodlights, hot engines, cold rain, wet tarmac, and de-icing.

Metrics:

- ATE/RPE against motion capture, LiDAR odometry, RTK, or surveyed ground truth.
- Tracking survival under darkness, smoke, fog, dust, and low thermal contrast.
- Feature track length and spatial distribution.
- NUC/FFC interruption recovery time.
- Thermal residual stability over sensor warm-up.
- Runtime and frame-drop rate.
- Cross-modal consistency for RGB-T systems.

## AV Relevance

Thermal-inertial odometry is relevant to AVs as a degraded-visibility aiding channel, especially at night and in smoke/fog/dust. It can provide relative motion constraints when RGB cameras fail and can simultaneously support perception of people and warm machinery.

Production AV use should be as a factor or fallback:

- Fuse thermal VIO with LiDAR/radar/wheel/GNSS/map localization.
- Use thermal only when its health metrics show enough contrast and stable tracking.
- Prefer geometric map localization for global pose.
- Treat thermal output as relative odometry unless globally anchored.

## Indoor/Outdoor Relevance

**Indoor:** Strong for dark, smoky, dusty, or GPS-denied spaces. Weak in thermally uniform corridors, cold concrete, and reflective thermal surfaces.

**Outdoor:** Useful at night and in some visibility degradation. Daytime sun loading can either help or hurt by changing thermal contrast.

**Mixed indoor/outdoor:** Challenging because thermal gain, background temperature, and contrast can change abruptly. Health monitoring must detect these transitions.

## Airside Deployment Notes

Airside thermal-inertial use cases:

- Night operations around stands and service roads.
- Crew and warm GSE detection while contributing relative odometry.
- Smoke, fog, rain, and de-icing spray fallback.
- Hangars and maintenance areas where visible lighting is uneven.

Risks:

- Aircraft and wet tarmac can produce reflections or low thermal contrast.
- Engine/APU heat plumes and exhaust can be dynamic thermal clutter.
- Thermal signatures vary by aircraft state and weather.
- Long-term thermal maps are not reliable enough as primary HD maps.

Recommended deployment pattern:

- Use thermal-inertial as an odometry factor with confidence gating.
- Keep LiDAR/radar/wheel/GNSS/map localization as primary sources.
- Validate by temperature, weather, time of day, and aircraft operating state.

## Validation Checklist

- Calibrate thermal intrinsics and thermal-IMU extrinsics at operating temperature.
- Record warm-up behavior and residual drift.
- Detect NUC/FFC events and suppress affected residuals.
- Test low-gradient scenes, hot/cold backgrounds, and rapid temperature transitions.
- Compare raw radiometric vs 8-bit rescaled operation.
- Evaluate dynamic heat sources and moving people/vehicles.
- Run sensor-ablation tests with RGB and LiDAR unavailable.
- Verify covariance inflation when thermal feature count or contrast collapses.
- Test rain, fog, smoke, dust, night floodlights, and de-icing spray.

## Sources

- Khattak, Papachristos, Alexis, "Keyframe-based Direct Thermal-Inertial Odometry," arXiv/ICRA, 2019: https://arxiv.org/abs/1903.00798
- Flemmen, "ROVTIO: RObust Visual Thermal Inertial Odometry," NTNU thesis, 2021: https://ntnuopen.ntnu.no/ntnu-xmlui/handle/11250/2828783
- Zhao et al., "TP-TIO: A Robust Thermal-Inertial Odometry with Deep ThermalPoint," arXiv/IROS, 2020: https://arxiv.org/abs/2012.03455
- DeepTIO: https://arxiv.org/abs/1909.07231
- Caltech Aerial RGB-Thermal Dataset: https://data.caltech.edu/records/cks6g-ps927
