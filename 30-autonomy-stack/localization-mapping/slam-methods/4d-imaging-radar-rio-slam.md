# 4D Imaging Radar RIO and SLAM

Related docs: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md), [radar FMCW/MIMO/Doppler](../../../10-knowledge-base/signal-processing/radar-fmcw-mimo-doppler.md), [radar ambiguity and Doppler limits](../../../10-knowledge-base/signal-processing/radar-ambiguity-chirp-design-doppler-limits.md), [radar-inertial odometry](radar-inertial-odometry.md), [radar odometry and radar SLAM](radar-odometry-radar-slam.md), [radar-LiDAR-inertial fusion](radar-lidar-inertial-fusion.md), [RadarSplat RIO](radarsplat-rio.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

## Executive Summary

4D imaging radar RIO/SLAM uses radar detections with range, azimuth, elevation, Doppler, and often intensity/RCS, fused with IMU measurements. Compared with older 2D scanning radar or sparse automotive radar, 4D imaging radar adds vertical structure and denser point clouds, making radar-inertial mapping more plausible.

Representative systems include iRIOM, Go-RIO, RIO-Vehicle, and x-RIO/multi-radar yaw-aiding work. iRIOM introduced a submap-based 4D radar-inertial odometry and mapping pipeline with robust Doppler ego-velocity, scan-to-submap matching, an iterated EKF, and loop closure. Go-RIO adds ground-optimized radar filtering and continuous velocity preintegration with Gaussian processes to better handle asynchronous radar/IMU streams and ground-vehicle assumptions.

For AV and airside autonomy, this is one of the most important adverse-weather localization directions. Radar can continue operating through fog, dust, smoke, rain, spray, darkness, and glare. The caveat is equally important: radar is noisy, sparse, multipath-prone, and dynamic-object-sensitive. RIO should be a robust aiding layer, not an unchecked sole authority.

## Problem Fit

4D imaging radar RIO fits:

- Fog, rain, dust, smoke, snow, spray, darkness, and glare.
- Open outdoor environments where cameras and LiDAR can degrade.
- Ground vehicles that can exploit nonholonomic and ground-plane assumptions.
- Long-term localization where radar reflectors and static structures remain visible.
- Safety fallback when LiDAR/camera health is poor.

It is weaker for:

- Dense indoor metal environments with severe multipath.
- Scenes dominated by moving objects.
- Very open spaces with few radar reflectors.
- Applications requiring dense geometric maps comparable to LiDAR.

## Sensor Model

4D radar detections typically include:

```text
z_i = [range_i, azimuth_i, elevation_i, doppler_i, rcs_i, t_i]
```

Converted to radar-frame points:

```text
p_i^R = range_i * [cos(el) cos(az), cos(el) sin(az), sin(el)]
```

Doppler radial velocity constrains relative motion:

```text
v_d,i = u_i^T ( v_R + omega_R x p_i^R ) + noise
```

The inertial state is:

```text
x = [R, p, v, b_g, b_a, g, T_RI, delta_t_RI]
```

where `T_RI` is radar-IMU extrinsic calibration and `delta_t_RI` is the time offset when estimated or modeled.

Maps may be:

- Local radar point submaps.
- Reflectivity/intensity submaps.
- Gaussian or distributional radar maps.
- Pose graphs with loop closure.

## Pipeline

1. **Radar preprocessing**
   - Filter by range, RCS, elevation, Doppler validity, and sensor-specific quality.
   - Reject ego-vehicle reflections, multipath, and dynamic-object candidates.
   - Model ground and remove unreliable ground points when useful.

2. **Doppler ego-velocity**
   - Use static returns to estimate body velocity.
   - Apply RANSAC, GNC, M-estimation, or robust filtering to reject moving objects.

3. **IMU propagation**
   - Propagate pose, velocity, and biases at IMU rate.
   - Deskew radar points or integrate radar velocity asynchronously.

4. **Radar scan-to-map matching**
   - Register current 4D radar points to local submaps.
   - Use point-to-distribution, distribution-to-distribution, NDT/GICP, or radar-specific distances.

5. **Fusion**
   - iRIOM-style systems fuse ego-velocity and scan-to-submap matches in an iterated EKF.
   - Go-RIO-style systems use continuous velocity integration and Gaussian-process interpolation.
   - Factor-graph variants add wheel, vehicle, GNSS, loop closure, or multi-radar yaw constraints.

6. **Loop closure and mapping**
   - Detect revisits using radar place recognition or scan descriptors.
   - Optimize pose graph/submaps to reduce drift.

## Mathematical Mechanics

Robust Doppler velocity estimation:

```text
v_R* = arg min_v sum_i rho( z_d,i - u_i^T v_R )
```

with angular velocity/lever-arm extension:

```text
z_d,i = u_i^T ( v_R + omega_R x p_i^R )
```

iRIOM-style fusion:

```text
x_k^- = propagate_imu(x_k-1, u_imu)
x_k^+ = IEKF_update(x_k^-, r_doppler, r_scan_to_submap)
```

Scan-to-submap matching can be represented as:

```text
r_scan = D( T_k p_i, M_submap )
```

where `D` is a radar-robust distributional distance rather than simple nearest-neighbor Euclidean distance.

Go-RIO emphasizes continuous velocity preintegration:

```text
Delta p_ij = integral_i^j R(t) v_radar(t) dt
```

with Gaussian-process interpolation to align asynchronous IMU and radar velocity observations. This addresses a common RIO weakness: discretized propagation can misuse radar velocity when timestamps and rates differ.

A generic factor graph:

```text
X* = arg min_X
    sum_imu      || r_imu ||^2
  + sum_dopp     rho(|| r_doppler ||^2)
  + sum_rscan    rho(|| r_radar_scan ||^2)
  + sum_vehicle  || r_nonholonomic ||^2
  + sum_loop     rho(|| r_loop ||^2)
```

## Assumptions

- A sufficient fraction of radar returns are static.
- Radar-IMU extrinsics and timing are known or estimated.
- Doppler ambiguity and velocity wrapping are handled.
- Radar elevation estimates are accurate enough for 3D matching.
- Multipath and ghost detections are robustly rejected or downweighted.
- Ground vehicle constraints are valid when used.
- Radar submaps are not polluted by moving vehicles or temporary objects.

## Strengths

- Strong adverse-weather and low-light robustness.
- Doppler gives direct velocity information in a single scan.
- 4D radar adds vertical structure absent in 2D scanning radar.
- IMU closes short-term gaps and stabilizes orientation.
- Submaps and loop closure can reduce drift.
- Multi-radar configurations can improve yaw and coverage.
- Good complement to LiDAR/camera localization in safety stacks.

## Limitations

- Radar point clouds are noisy and sparse relative to LiDAR.
- Multipath is severe near metal, wet ground, glass, fences, and aircraft.
- Dynamic objects violate static Doppler assumptions.
- Yaw and position can drift without good spatial radar structure.
- Open areas may have too few stable returns.
- Radar maps are less geometrically interpretable than LiDAR maps.
- Sensor-specific signal processing affects transfer across radar models.

## Datasets and Benchmarks

Relevant datasets:

- **iRIOM author and third-party datasets:** used for 4D radar-inertial mapping evaluation.
- **Go-RIO datasets:** 4D radar-inertial experiments released with the method.
- **Coloradar:** 4D radar, LiDAR, camera, IMU, and ground truth resources.
- **Boreas:** radar/LiDAR/camera/IMU/GNSS across seasons.
- **Oxford Radar RobotCar:** long-term radar driving, primarily scanning radar.
- **MulRan:** radar/LiDAR urban data for odometry and place recognition.
- **K-Radar:** 4D radar dataset useful for perception and radar robustness context.
- **Custom airside radar data:** required for aircraft multipath, terminal reflections, rain, spray, and open apron sparsity.

Metrics:

- ATE/RPE by weather and scene type.
- Velocity RMSE and Doppler inlier rate.
- Yaw drift.
- Scan-to-submap residual distribution.
- Loop closure precision/recall.
- Map consistency and ghost-object contamination.
- Availability under LiDAR/camera degradation.
- Runtime P95/P99 on embedded compute.

## AV Relevance

4D imaging radar RIO is highly relevant for AVs because it supplies a physically different localization signal. It can continue when cameras and LiDAR are degraded and can directly measure radial velocity.

Production use should include:

- Wheel odometry and nonholonomic constraints.
- LiDAR and camera factors when healthy.
- GNSS/RTK with multipath gating.
- HD map or radar-map localization.
- Per-modality health and covariance inflation.
- Dynamic-object filtering shared with perception.

The strongest production pattern is not radar replacing LiDAR. It is radar preserving observability when LiDAR/camera constraints are weak.

## Indoor/Outdoor Relevance

**Indoor:** Useful in smoke, dust, darkness, tunnels, mines, warehouses, and hangars, but multipath is a major risk.

**Outdoor:** Strong fit for roads, ports, airports, mines, construction, and agriculture.

**Mixed indoor/outdoor:** Useful for transitions through hangars, underpasses, and terminal edges where lighting/GNSS/LiDAR conditions change.

## Airside Deployment Notes

Airside is one of the strongest fits:

- Radar works in fog, rain, night, and de-icing spray.
- Terminal walls, signs, poles, fences, service vehicles, and gate infrastructure provide radar reflectors.
- Aircraft provide strong returns but also multipath and dynamic/non-map geometry.
- Open apron zones may need artificial reflectors or surveyed radar landmarks.

Recommended architecture:

- Use RIO as an adverse-weather odometry factor.
- Fuse wheel and nonholonomic constraints for low-speed GSE.
- Gate aircraft returns as dynamic or map-transient unless explicitly modeled.
- Monitor Doppler inlier geometry and multipath indicators.
- Use surveyed radar/LiDAR map localization for global pose where available.

## Validation Checklist

- Calibrate radar-IMU extrinsics and time offset.
- Validate Doppler sign convention, mounting lever arm, and velocity scale.
- Test moving-object contamination with aircraft, tugs, buses, carts, and pedestrians.
- Test multipath near aircraft fuselage, terminal glass/metal, fences, and wet tarmac.
- Compare Doppler-only, scan-matching-only, and fused modes.
- Log inlier geometry, residuals, covariance, and degradation state.
- Test radar sensor blockage and water film effects.
- Validate loop closures under route repeats and seasonal/weather changes.
- Measure runtime and latency with full radar point rate.

## Sources

- Zhuang et al., "4D iRIOM: 4D Imaging Radar Inertial Odometry and Mapping," arXiv/RA-L, 2023: https://arxiv.org/abs/2303.13962
- Yang, Jang, Kim, "Ground-Optimized 4D Radar-Inertial Odometry via Continuous Velocity Integration using Gaussian Process," arXiv/ICRA, 2025: https://arxiv.org/abs/2502.08093
- Go-RIO official implementation: https://github.com/wooseongY/Go-RIO
- Coloradar dataset: https://arpg.github.io/coloradar/
- Boreas dataset: https://www.boreas.utias.utoronto.ca/
- Oxford Radar RobotCar dataset: https://oxford-robotics-institute.github.io/radar-robotcar-dataset/
