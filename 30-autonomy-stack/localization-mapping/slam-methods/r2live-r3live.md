# R2LIVE and R3LIVE

Related docs: [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [FAST-LIVO and FAST-LIVO2](fast-livo-fast-livo2.md), [LVI-SAM](lvi-sam.md), [GLIM](glim.md), and [robust state estimation and multi-sensor localization fusion](../overview/robust-state-estimation-multi-sensor.md).

## Executive Summary

R2LIVE and R3LIVE are LiDAR-inertial-visual systems from the HKU MARS Lab lineage. R2LIVE is a robust, real-time, tightly coupled state estimator and mapping system that combines LiDAR, inertial, and camera measurements with a high-rate filter-based odometry path and a lower-rate factor-graph optimization path. R3LIVE builds on R2LIVE and focuses on robust real-time RGB-colored 3D mapping and reconstruction.

R3LIVE consists of a LiDAR-inertial odometry subsystem and a visual-inertial subsystem. The LIO subsystem builds the geometric map, while the VIO subsystem directly fuses visual data by minimizing frame-to-map photometric error and assigning color/texture to the 3D map. R3LIVE++ later extends this direction toward radiance-map reconstruction with photometric calibration and exposure estimation.

For AVs, this lineage is most relevant as a real-time LIV state-estimation and colorized mapping reference. It is valuable for reconstruction, inspection, and degraded-sensor research, but it is not a complete production localization stack.

## Sensor, Noise, and Calibration Assumptions

R2LIVE and R3LIVE assume LiDAR, IMU, and camera data with known extrinsic calibration and sufficiently accurate synchronization. R3LIVE-style colorized mapping also requires reliable camera intrinsics, distortion parameters, exposure behavior, and camera-LiDAR overlap so that images can be projected onto LiDAR-supported geometry.

The noise model is multi-modal: IMU bias/noise affects propagation, LiDAR noise and degeneracy affect geometric map construction, and camera photometric noise affects visual alignment and coloring. Calibration drift, rolling shutter, changing exposure, moving objects, or sparse LiDAR geometry can produce maps that look visually plausible but are geometrically inconsistent.

## Core Idea

R2LIVE combines three sensor types in a tightly coupled estimator:

- LiDAR provides metric geometry and robustness to lighting changes.
- IMU provides high-rate propagation and motion compensation.
- Camera provides visual constraints that can help in LiDAR-degenerate scenes.

R2LIVE uses an error-state iterated Kalman filter for real-time odometry and factor-graph optimization to refine keyframe poses and visual landmarks.

R3LIVE shifts the emphasis toward real-time reconstruction and colored maps:

```text
LIO subsystem:
  estimate pose and reconstruct geometric 3D points

VIO subsystem:
  use camera + inertial data and direct photometric frame-to-map error
  recover color/texture for the LiDAR-supported geometry
```

The result is a state-estimation and mapping system that can produce dense RGB-colored point-cloud maps in real time.

## Pipeline

1. Receive LiDAR, IMU, and camera streams.
2. Propagate motion with IMU measurements.
3. Extract or register LiDAR geometric information for LIO.
4. Track or align visual information for VIO.
5. Fuse measurements in a tightly coupled filter-based odometry path.
6. Update local map geometry from LiDAR-supported estimates.
7. Use camera measurements to color or texture the 3D map.
8. For R2LIVE, refine keyframe poses and visual landmarks with factor-graph optimization.
9. For R3LIVE, minimize direct frame-to-map photometric error in the VIO subsystem.
10. Publish real-time pose, map, and RGB-colored reconstruction outputs.
11. Optionally run offline utilities for mesh/texturing applications in the R3LIVE ecosystem.

## Strengths

- Tightly couples LiDAR, IMU, and camera measurements for robustness across degraded scenes.
- R2LIVE combines high-rate filter odometry with lower-rate graph refinement.
- R3LIVE produces real-time RGB-colored 3D maps, useful for inspection and reconstruction.
- LiDAR geometry stabilizes metric scale and 3D structure.
- Visual photometric constraints add appearance information beyond raw LiDAR geometry.
- Demonstrated in indoor, outdoor, and mixed environments.
- Open-source repositories include code and hardware/software utilities.
- The lineage directly influenced later systems such as FAST-LIVO/FAST-LIVO2.

## Limitations

- Requires accurate camera-LiDAR-IMU extrinsics and time synchronization.
- Camera constraints are sensitive to lighting, exposure, motion blur, weather, and lens contamination.
- Small-FOV LiDAR/camera rigs need careful trajectory and overlap assumptions.
- Dynamic objects can pollute both geometry and color.
- Colorized maps can look visually convincing while still containing geometric errors.
- Filter-plus-graph behavior introduces complexity in timing, correction handling, and output interpretation.
- The original repositories are research code, not production AV middleware.
- GPLv2 licensing in the HKU MARS repositories requires review for product use.

## AV Relevance

R2LIVE/R3LIVE are relevant to AV research in four areas:

- **Degraded-environment odometry:** vision can help LiDAR-degenerate geometry, while LiDAR can help vision scale and lighting-independent structure.
- **Colorized mapping:** RGB point clouds can support inspection, labeling, map QA, and operator review.
- **Architecture comparison:** they are useful contrasts to LVI-SAM's smoothing design and FAST-LIVO2's newer direct unified voxel-map design.
- **Hardware lessons:** the systems highlight the importance of synchronization, calibration, and sensor field-of-view overlap.

Production caveats:

- AV runtime localization should usually localize against a validated fixed map, not continuously reconstruct an RGB map as the only reference.
- The stack needs dynamic-object masking before map persistence.
- Pose output needs health metrics, covariance calibration, and fault handling.
- Visual failures from glare, night, rain, dirt, or overexposure must be detected.
- LiDAR degeneracy on open aprons or highways must be fused with GNSS, wheel odometry, and vehicle constraints.

## Indoor/Outdoor Notes

**Indoor:** R2LIVE/R3LIVE are strong in structured and textured spaces such as buildings, labs, warehouses, tunnels, and hangars. R3LIVE's colorized output is useful for inspection and human map review. Watch for low light, glass, repeated corridors, and moving people.

**Outdoor:** They are useful in campuses, urban scenes, forests, and mixed routes. Direct visual mapping must handle sunlight, exposure changes, shadows, rain, and dust.

**Airside:** The lineage is useful for mapping terminal edges, hangars, cargo areas, service roads, and equipment yards where colorized maps help operations and QA. Open aprons remain challenging because LiDAR geometry is weak, visual texture is sparse or repetitive, and moving aircraft/GSE can dominate the scene.

## Comparison

| Method | Sensors | Estimation style | Map output | AV interpretation |
|---|---|---|---|---|
| R2LIVE | LiDAR + camera + IMU | ESIKF odometry plus factor graph | Dense 3D map | Robust LIV state-estimation research baseline |
| R3LIVE | LiDAR + camera + IMU | LIO + direct VIO subsystems | Real-time RGB-colored 3D map | Reconstruction/colorized mapping reference |
| R3LIVE++ | LiDAR + camera + IMU | LIV estimator with radiance reconstruction | Radiance/HDR-oriented map | Advanced reconstruction lineage |
| FAST-LIVO2 | LiDAR + camera + IMU | Unified ESIKF, direct LiDAR and visual updates | Unified voxel map, reconstruction products | Newer direct LIVO odometry baseline |
| LVI-SAM | LiDAR + camera + IMU | Factor-graph smoothing | SLAM map with visual/LiDAR loop coupling | Graph-based LVI reference |
| FAST-LIO2 | LiDAR + IMU | ESIKF | Geometric point map | Pure LIO baseline |

## Evaluation

Evaluate trajectory and reconstruction separately:

- absolute trajectory error,
- relative pose error and drift,
- robustness when LiDAR geometry is degenerate,
- robustness when visual tracking or photometric alignment degrades,
- map geometric consistency after revisits,
- RGB/color consistency across viewpoints and exposure changes,
- runtime on onboard hardware,
- sensitivity to calibration and synchronization errors,
- dynamic-object map contamination,
- failure detection when one modality becomes unreliable.

For airside, include apron/open-space routes, repeated stand geometry, bright sun and nighttime runs, wet pavement, aircraft occlusion, and moving GSE.

## Implementation Notes

- Use the official `hku-mars/r2live` and `hku-mars/r3live` repositories for reference behavior.
- Calibrate camera intrinsics, distortion, LiDAR-camera extrinsics, LiDAR-IMU extrinsics, and time offsets before tuning algorithmic parameters.
- Validate LiDAR-inertial operation before enabling visual/color mapping.
- Treat colorized maps as visualization products unless they pass separate geometric QA.
- Add dynamic-object filtering before persistent map export.
- Monitor photometric residuals, image exposure, feature/patch availability, LiDAR residuals, and IMU health.
- Expect integration work for modern ROS 2 and production vehicle stacks.
- Review GPLv2/commercial licensing before product use.

## Practical Recommendation

Use R2LIVE/R3LIVE as research references for real-time LiDAR-inertial-visual state estimation and RGB-colored mapping. They are especially useful for understanding the transition from LIO to LIV reconstruction and for comparing older filter-plus-graph designs with newer FAST-LIVO2-style direct fusion.

For production AV localization, use the lineage for ideas and benchmarks, not as a complete runtime stack. Pair any reused components with fixed-map localization, multi-sensor fusion, map QA, health monitoring, and strict dynamic-object handling.

## Sources

- Lin, Zheng, Xu, and Zhang, "R2LIVE: A Robust, Real-time, LiDAR-Inertial-Visual tightly-coupled state Estimator and mapping." https://arxiv.org/abs/2102.12400
- R2LIVE official repository. https://github.com/hku-mars/r2live
- R2LIVE IEEE RA-L DOI. https://doi.org/10.1109/LRA.2021.3095515
- Lin and Zhang, "R3LIVE: A Robust, Real-time, RGB-colored, LiDAR-Inertial-Visual tightly-coupled state Estimation and mapping package." https://arxiv.org/abs/2109.07982
- R3LIVE official repository. https://github.com/hku-mars/r3live
- R3LIVE ICRA DOI. https://doi.org/10.1109/ICRA46639.2022.9811935
- Lin and Zhang, "R3LIVE++: A Robust, Real-time, Radiance reconstruction package with a tightly-coupled LiDAR-Inertial-Visual state Estimator." https://arxiv.org/abs/2209.03666
- FAST-LIVO2 official repository for later lineage. https://github.com/hku-mars/FAST-LIVO2
