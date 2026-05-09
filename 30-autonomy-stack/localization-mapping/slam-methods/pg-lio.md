# PG-LIO

Related docs: [FAST-LIO2](fast-lio-fast-lio2.md), [COIN-LIO / intensity-aided context](radar-lidar-inertial-fusion.md), [continuous-time registration](continuous-time-registration.md), [LiDAR degeneracy](../overview/production-lidar-map-localization.md), and [factor graphs and iSAM2](factor-graph-isam2-gtsam.md).

**Last updated:** 2026-05-09

## Executive Summary

PG-LIO is a photometric-geometric LiDAR-inertial odometry method. It addresses a classic LIO weakness: geometry-only scan matching becomes ill-conditioned in tunnels, corridors, flat walls, and self-similar spaces. PG-LIO adds photometric information sampled by the LiDAR, such as intensity-image patch residuals, alongside geometric and IMU constraints in a real-time sliding-window factor graph.

The reported result that matters most is the degenerate-tunnel case: the paper reports about 1 m drift over a 1 km manually piloted aerial trajectory through a geometrically self-similar tunnel at 7.5 m/s average speed. That is the kind of scenario where pure point-to-plane LIO often looks confident while drifting.

## What It Adds

- Photometric residuals from LiDAR return/intensity structure, not camera imagery.
- Geometric point-to-plane scan-to-map residuals retained for normal scenes.
- IMU preintegration in a sliding-window factor graph.
- Degenerate-scene robustness without requiring visual cameras.
- A modular implementation direction through the `mimosa` framework, which supports LiDAR geometric/photometric factors, radar, odometry, and IMU.

## Sensor and Factor Model

Sensor suite:

- Ouster-style LiDAR with usable intensity/range image structure for photometric residuals.
- IMU.
- Optional additional odometry or radar factors through the underlying framework.

Generic objective:

```text
X* = arg min_X
      sum_imu    || r_imu ||^2
    + sum_geom   rho(|| n^T(T p_i - q_i) ||^2)
    + sum_photo  rho(|| I_k(u) - I_map(pi(T p)) ||^2)
```

The exact implementation depends on how the LiDAR provides intensity images and how patches are selected. The repository notes that the photometric LiDAR factor is implemented only for Ouster LiDARs.

## Timing and Calibration

PG-LIO still needs the normal LIO prerequisites:

- LiDAR-IMU extrinsic calibration.
- LiDAR point timing for deskewing.
- IMU noise and bias settings.
- Photometric calibration or normalization enough to make intensity residuals comparable.

The photometric channel adds sensor-specific sensitivity: intensity scaling, automatic gain, range falloff, incidence angle, material reflectivity, rain/dust, and firmware processing can all change the residual distribution.

## Degeneracy Handling

PG-LIO is strongest when geometry is weak but LiDAR return texture remains informative:

- long tunnels,
- repeated corridors,
- smooth walls with surface reflectivity patterns,
- underground or indoor spaces where cameras are unreliable,
- aerial robots with fast motion and little geometric parallax.

It is less helpful when both geometry and photometry are uninformative, for example uniformly painted tunnels, wet surfaces with unstable reflectivity, fog/dust backscatter, or LiDARs with poor intensity repeatability.

## Evaluation Guidance

Use:

- ATE/RPE in well-conditioned and degenerate segments.
- Drift per kilometer in self-similar tunnels.
- Geometry-only versus photometric-geometric ablation.
- Photometric inlier rate and residual distribution.
- Runtime of patch extraction and graph optimization.
- Cross-LiDAR generalization, especially non-Ouster sensors.

## Integration Readiness

The public `mimosa` repository makes PG-LIO easier to study than many recent LIO papers. It is still research-grade for production AV stacks: verify supported LiDAR models, license compatibility, deterministic timing, covariance calibration, and behavior under weather or dirty sensor windows.

## Limitations

- Photometric factors are sensor-model dependent.
- Intensity is not a stable physical property across LiDAR vendors, ranges, and incidence angles.
- Dynamic objects can create both geometric and photometric outliers.
- Degenerate scenes with weak reflectivity texture remain hard.
- Sliding-window graph tuning can be sensitive to factor weights.

## Sources

- PG-LIO arXiv paper: https://arxiv.org/abs/2506.18583
- `mimosa` multi-modal SLAM repository: https://github.com/ntnu-arl/mimosa
- COIN-LIO intensity-aided LIO context: https://github.com/ethz-asl/COIN-LIO
