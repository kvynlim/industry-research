# RadarSplat-RIO

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "prototype"
  tags: ["slam", "fallback", "gnss-denied", "outdoor", "adverse-weather"]
  reason: "RadarSplat-RIO is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions."
method-priority:end -->

Related docs: [Radar-Inertial Odometry](radar-inertial-odometry.md), [Radar Odometry and Radar SLAM](radar-odometry-radar-slam.md), [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md), [factor graphs and iSAM2](factor-graph-isam2-gtsam.md), and [Gaussian Splatting for Driving](../../perception/overview/gaussian-splatting-driving.md).

## Executive Summary

RadarSplat-RIO is a 2026 indoor radar-inertial odometry method that introduces Gaussian Splatting-based radar bundle adjustment. The core claim is that radar odometry has relied heavily on frame-to-frame motion estimates, while visual odometry benefits from local bundle adjustment over poses and maps. RadarSplat-RIO uses a differentiable Gaussian scene representation to jointly optimize radar poses and scene geometry from full range-azimuth-Doppler radar data.

The method is important because it moves radar SLAM toward multi-frame dense optimization rather than only Doppler ego-velocity or frame-to-frame scan matching. When integrated with an existing radar-inertial odometry front end, the paper reports large reductions in indoor translational and rotational error.

For AVs and airside autonomy, RadarSplat-RIO is a very relevant concept for adverse weather and GNSS-denied operation, but it is brand-new and indoor-focused. It should be evaluated as an emerging radar factor idea, not as a ready production stack.

## Core Idea

RadarSplat-RIO uses Gaussian Splatting to make radar bundle adjustment differentiable.

Core elements:

- Radar provides range, azimuth, and Doppler measurements.
- IMU provides high-rate motion propagation through a radar-inertial front end.
- Gaussian scene primitives form a dense differentiable radar map.
- A local bundle-adjustment window jointly optimizes radar poses and scene geometry.
- The radar renderer uses full radar data rather than only sparse detections.
- The optimized radar BA output reduces drift from the RIO front end.

The key shift is from:

```text
radar frame-to-frame odometry -> integrate motion -> drift
```

to:

```text
radar-inertial front end -> local radar Gaussian BA -> jointly corrected poses and map
```

## Pipeline

1. Collect radar range-azimuth-Doppler data and IMU measurements.
2. Run a radar-inertial odometry front end for initial pose estimates.
3. Initialize a local Gaussian radar scene representation.
4. Render or predict radar measurements from candidate poses and Gaussian map state.
5. Form radar residuals using range-azimuth-Doppler observations.
6. Jointly optimize local radar poses and Gaussian scene geometry.
7. Feed corrected local poses back into the odometry estimate.
8. Report pose drift reduction, robustness, and indoor benchmark results.

## Strengths

- Radar is more resilient than cameras and LiDAR to darkness, smoke, dust, fog, and some weather.
- Doppler provides direct velocity information unavailable to cameras and LiDAR.
- Multi-frame bundle adjustment can reduce drift without waiting for loop closure.
- Uses richer radar data than point-only frame matching.
- Indoor radar-inertial focus is relevant to tunnels, warehouses, terminals, mines, and hangars.
- The Gaussian representation creates a differentiable bridge between radar sensing and map optimization.

## Limitations

- The initial paper is indoor-focused; outdoor AV and airside validation remains open.
- Radar multipath can create false geometry, especially near metal, glass, walls, aircraft, and wet ground.
- Radar angular resolution and sidelobes can limit map detail.
- Moving objects violate static-scene assumptions used in BA.
- Doppler ambiguity, radar firmware filtering, and sensor-specific data products matter.
- Gaussian radar-map uncertainty is not yet a production integrity model.
- Local BA adds compute and latency that must be bounded.
- The method depends on a reliable RIO front end and accurate radar-IMU calibration.

## AV Relevance

RadarSplat-RIO is relevant because production AVs need localization during camera/LiDAR degradation. It may become useful for:

- Adverse-weather odometry support.
- Indoor or covered-area localization.
- Radar map factors in GNSS-denied zones.
- Drift reduction for radar-inertial front ends.
- Research into dense radar differentiable mapping.

It is not sufficient alone. Production AV localization should fuse radar with IMU, wheel odometry, LiDAR when healthy, GNSS/RTK when valid, HD-map priors, and conservative health metrics.

## Indoor/Outdoor Notes

**Indoor:** This is the main demonstrated regime. Radar works in darkness and dust, but indoor multipath is severe. Warehouses, hangars, tunnels, underground facilities, and terminals need careful validation.

**Outdoor:** Radar is attractive for fog, rain, dust, snow, spray, and night. Outdoor use needs tests with longer range, faster ego-motion, traffic, guardrails, signs, buildings, vegetation, and open areas.

**Airside:** Conceptually strong because airside autonomy needs adverse-weather resilience. However, aircraft bodies, wet tarmac, jet bridges, fences, and service vehicles create multipath and dynamic clutter. Use as a research factor until outdoor airside datasets prove reliability.

## Comparison

| Method | Sensor model | Optimization style | AV interpretation |
|---|---|---|---|
| RadarSplat-RIO | Range-azimuth-Doppler radar + IMU | Gaussian radar bundle adjustment after RIO front end | Emerging dense radar BA concept |
| Doppler RIO | Radar Doppler + IMU | EKF/factor velocity fusion | Practical adverse-weather odometry baseline |
| STEAM-RIO | Radar + IMU | Continuous-time GP trajectory optimization | Strong radar-inertial research baseline |
| iRIOM / Go-RIO | 4D radar + IMU | Radar inertial odometry/mapping | Outdoor 4D radar baselines |
| LiDAR-inertial SLAM | LiDAR + IMU | Scan matching/factor graph/filter | Strong in clear weather, weaker in dense adverse weather |

## Evaluation

Key metrics:

- ATE and RPE against motion capture, survey, or high-grade reference.
- Translational and rotational drift before and after radar BA.
- Velocity error and Doppler residuals.
- Radar inlier ratio and residual distribution.
- Runtime, local-window latency, and memory.
- Robustness to multipath, moving objects, and sparse returns.
- Sensitivity to radar-IMU extrinsic and time-offset errors.
- Failure detection when the radar scene is unobservable.

For AV/airside work, add rain/fog/wet-ground buckets, open-apron drift, low-speed stop-and-go drift, false confidence near moving aircraft/GSE, and disagreement against LiDAR/RTK/wheel fusion.

## Implementation Notes

- Preserve raw or minimally processed radar range-azimuth-Doppler data if possible; point-cloud-only radar may not expose enough information.
- Calibrate radar-IMU extrinsics and time offset carefully.
- Account for radar mounting lever arm and ego-vehicle reflections.
- Gate dynamic objects using Doppler, temporal consistency, and perception tracks.
- Log radar health diagnostics: return count, Doppler residuals, multipath indicators, and BA convergence.
- Keep BA corrections bounded and expose correction jumps to the fusion supervisor.
- Validate on the exact radar model and firmware intended for deployment.
- Treat indoor gains as encouraging but not proof of outdoor AV readiness.

## Practical Recommendation

Track RadarSplat-RIO as an important emerging radar SLAM direction. For current AV work, use it as a research experiment around a proven radar-inertial or radar-LiDAR-inertial front end. Do not make it the sole localization authority until outdoor, dynamic, adverse-weather, and airside-specific validation is available with calibrated uncertainty.

## Sources

- Kung, Tian, Li, Liu, Whitmire, Kienzle, and Benko, "RadarSplat-RIO: Indoor Radar-Inertial Odometry with Gaussian Splatting-Based Radar Bundle Adjustment." https://arxiv.org/abs/2604.13492
- Local context: [Radar-Inertial Odometry](radar-inertial-odometry.md)
- Local context: [Radar Odometry and Radar SLAM](radar-odometry-radar-slam.md)
- Local context: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md)
- Local context: [factor graphs and iSAM2](factor-graph-isam2-gtsam.md)
