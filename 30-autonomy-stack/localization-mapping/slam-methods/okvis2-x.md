# OKVIS2-X

Related docs: [OpenVINS](openvins.md), [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md), [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), [Kimera-VIO](kimera-vio.md), [factor graphs and iSAM2](factor-graph-isam2-gtsam.md), [occupancy / TSDF / ESDF mapping](occupancy-grid-tsdf-esdf-mapping.md), [production LiDAR map localization](../overview/production-lidar-map-localization.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

## Executive Summary

OKVIS2-X is a 2025 extension of the OKVIS/OKVIS2 keyframe-based visual-inertial SLAM line. Its important contribution is not just adding more sensors to VIO. It turns the sparse keyframe estimator into a configurable multi-sensor SLAM system that can use visual-inertial measurements, dense depth, learned depth, LiDAR, and GNSS while maintaining dense volumetric submaps that remain tied to the estimator through map-alignment factors.

This makes OKVIS2-X a bridge between classical VIO, dense navigation maps, and production-style multi-sensor localization. It is attractive for robots that need both accurate pose and a map usable by navigation, not only sparse features. The reported evaluation covers EuRoC, Hilti22, and large VBR sequences up to kilometer scale, with the authors emphasizing scalability through submapping and robustness through tight estimator-map coupling.

For AV and airside autonomy, OKVIS2-X is best viewed as a high-quality research architecture for local SLAM and mapping, not a complete production localization authority. It can fuse camera/IMU, depth/LiDAR, and GNSS, but a deployed vehicle still needs wheel odometry, map governance, sensor health, adverse-weather fallback, and conservative covariance handling around it.

## Problem Fit

OKVIS2-X fits cases where the platform needs:

- Metric pose estimation with visual-inertial accuracy.
- Dense local geometry for planning, obstacle clearance, or map reuse.
- Configurable operation across camera-only, RGB-D, learned-depth, LiDAR, and GNSS-aided deployments.
- Large-environment scalability without running one monolithic dense map.
- Keyframe SLAM behavior with relocalization and global consistency rather than pure fixed-lag odometry.

It is less appropriate when:

- Cameras are chronically unreliable due to darkness, glare, smoke, spray, or low texture.
- The navigation stack requires certified deterministic behavior rather than research-grade mapping.
- The platform already has a mature LiDAR/IMU/map localization stack and only needs a narrow sensor fallback.
- Dense volumetric map memory and maintenance are too expensive for the compute target.

## Sensor Model

OKVIS2-X assumes a core visual-inertial model and optional exteroceptive/georeferenced inputs:

- One or more cameras with calibrated intrinsics and camera-IMU extrinsics.
- IMU with accelerometer and gyroscope noise/bias models.
- Optional dense depth from RGB-D, stereo, learned depth, or LiDAR.
- Optional GNSS measurements for global reference.
- Optional online camera extrinsic calibration.

The core state follows the VIO pattern:

```text
x_k = [R_WI, p_WI, v_WI, b_g, b_a, camera_extrinsics, optional_calibration]
```

Dense submaps introduce additional variables:

```text
M_j = [T_WM_j, volumetric occupancy / TSDF-like map data, active keyframe links]
```

The important modeling choice is that maps are not passive products. Submap poses participate in optimization through alignment factors, allowing dense map consistency to feed back into trajectory estimation.

## Pipeline

1. **IMU propagation**
   - Integrate IMU data between image/keyframe times.
   - Propagate pose, velocity, and IMU biases.

2. **Visual front end**
   - Track sparse features across frames.
   - Select keyframes.
   - Form reprojection residuals for keyframe optimization.

3. **Depth/range integration**
   - If depth or LiDAR is available, integrate range observations into local dense volumetric submaps.
   - Use submap boundaries to keep memory and optimization bounded.

4. **Estimator-submap coupling**
   - Add map alignment factors between active keyframe states and submap frames.
   - Optimize keyframe poses, IMU states, calibration variables, and submap poses as appropriate.

5. **Global constraints**
   - Add loop closures, relocalization constraints, and GNSS factors where configured.
   - Maintain global map consistency through pose graph or bundle-adjustment style correction.

6. **Output**
   - Publish local/global pose.
   - Export dense volumetric maps usable by navigation.
   - Expose calibration estimates and map/estimator diagnostics.

## Mathematical Mechanics

The objective can be written as a multi-factor MAP problem:

```text
X*, M* = arg min_X,M
    sum_imu      || r_imu(x_i, x_j) ||^2
  + sum_visual   rho(|| r_reproj(x_k, l_m, z_km) ||^2)
  + sum_depth    rho(|| r_depth(x_k, M_j, d_k) ||^2)
  + sum_align    rho(|| r_align(x_k, T_WM_j, M_j) ||^2)
  + sum_loop     rho(|| r_loop(x_a, x_b) ||^2)
  + sum_gnss     rho(|| r_gnss(x_k, z_gnss) ||^2)
  + sum_prior    || r_prior ||^2
```

Visual residuals are standard reprojection errors:

```text
r_reproj = z_uv - pi(T_CI * T_IW * p_W)
```

IMU terms use preintegration between keyframes:

```text
r_imu = Log( Delta_ij^-1 * f(x_i, x_j, b_g, b_a) )
```

Depth and LiDAR measurements add surface/occupancy evidence. In an OKVIS2-X style architecture, the key issue is not the exact voxel update alone, but whether the estimator can shift submap frames and keyframes jointly so that dense geometry remains globally coherent.

## Assumptions

- Camera-IMU synchronization is good enough for tight VIO.
- The visual scene has enough static texture or repeatable features.
- Learned depth, if used, is sufficiently calibrated and uncertainty-aware for geometry constraints.
- LiDAR/depth observations can be integrated into submaps without dynamic-object contamination dominating.
- GNSS is either accurate enough or robustly gated before being inserted.
- Submap alignment residuals are not allowed to overrule clear sensor failure.
- Online calibration is excited by motion and bounded by sensible priors.

## Strengths

- Unifies sparse VIO, dense depth/LiDAR mapping, and GNSS-aided global constraints.
- Dense volumetric submaps are more useful for navigation than sparse landmark clouds.
- Submapping makes large environments practical.
- Tight estimator-map coupling can improve consistency versus treating mapping as a downstream product.
- Online extrinsic calibration is valuable for long-lived mobile robots.
- Strong fit for research comparisons against OpenVINS, VINS, ORB-SLAM3, Kimera, and LiDAR-aided systems.

## Limitations

- Dense maps increase memory, compute, and map lifecycle complexity.
- Visual features remain vulnerable to low texture, darkness, glare, rain, and motion blur.
- Learned depth can introduce scale or shape bias if used outside its training domain.
- GNSS factors can corrupt the graph under multipath if innovation gating is weak.
- Dynamic objects can contaminate dense submaps.
- Loop closure and submap correction can create discontinuities that downstream controllers must handle.
- Research benchmark success does not prove production safety under degraded sensors.

## Datasets and Benchmarks

Relevant datasets:

- **EuRoC MAV:** visual-inertial indoor MAV benchmark; useful for VIO accuracy and initialization.
- **Hilti SLAM Challenge / Hilti22:** multi-sensor construction-site benchmark with handheld/robotic motion and difficult geometry.
- **VBR dataset:** large-scale visual benchmark used by OKVIS2-X authors to show kilometer-scale operation.
- **KITTI / urban LiDAR-camera datasets:** useful when testing LiDAR/depth variants, though not always matched to OKVIS2-X assumptions.
- **Custom airside data:** required for wet tarmac, low texture, aircraft reflections, GNSS multipath, and dynamic GSE.

Metrics:

- ATE/RPE under fixed alignment rules.
- Drift per distance and per time.
- Map consistency before/after loop closure.
- Dense occupancy/TSDF completeness and false surface rate.
- Reprojection residuals, IMU bias stability, and submap alignment residuals.
- Runtime, memory, keyframe count, submap count, and relocalization latency.
- Covariance/health consistency when sensors are dropped or degraded.

## AV Relevance

OKVIS2-X is relevant to AVs as a modular research template for fusing camera/IMU, dense depth/LiDAR, and GNSS. It is strongest in structured areas with enough visual signal and useful depth/range geometry. Dense maps can support local navigation, local obstacle clearance, or mapping in areas where a prior HD map is unavailable.

For production AV localization, it should be wrapped by:

- Wheel odometry and vehicle kinematic constraints.
- LiDAR or radar fallback in adverse weather.
- GNSS/RTK with multipath detection.
- Persistent map versioning and dynamic-object filtering.
- Explicit estimator health states and covariance inflation.

The most valuable idea for production is the estimator-map coupling: dense maps should not be treated as unaudited visualization artifacts. If they affect navigation, they need residual checks, ownership, and lifecycle rules.

## Indoor/Outdoor Relevance

**Indoor:** Strong when visual texture and depth are available. Useful for warehouses, labs, terminals, and service corridors. Weak in smoke, darkness without active/depth sensing, featureless walls, and highly dynamic crowds.

**Outdoor:** Useful in campuses, construction, logistics yards, and airports when cameras and depth/LiDAR are healthy. GNSS can improve global consistency, but multipath near terminals and aircraft must be gated.

**Mixed indoor/outdoor:** One of the better fits because the system can switch from GNSS-aided outdoor constraints to VIO/depth-dominated indoor constraints while preserving a common graph abstraction.

## Airside Deployment Notes

Airside use should be conservative:

- Use OKVIS2-X-style dense submaps for local mapping around stands, service roads, and indoor maintenance areas.
- Do not rely on visual features alone near reflective aircraft, floodlights, jet blast spray, or heavy rain.
- Add LiDAR, radar, wheel odometry, and RTK/GNSS factors in the central localization graph.
- Treat aircraft, carts, belt loaders, fuel trucks, people, and baggage as dynamic for map integration.
- Validate submap correction behavior before connecting output directly to motion control.
- Maintain a separate surveyed map/localization layer for safety-critical stand geometry.

## Validation Checklist

- Verify camera/IMU/depth/LiDAR/GNSS timestamp alignment under load.
- Confirm extrinsic calibration before and after vibration/thermal cycling.
- Run sensor-ablation tests: camera loss, depth loss, GNSS spoof/multipath, LiDAR dropout.
- Compare VIO-only, depth-aided, LiDAR-aided, and GNSS-aided modes on the same routes.
- Check map consistency after loop closure and relocalization.
- Measure dynamic-object contamination in dense submaps.
- Report P95/P99 runtime and memory on target compute.
- Audit covariance/health outputs during visual degradation.
- Test transitions between indoor, covered, and open-sky zones.

## Sources

- Boche, Jung, Barbas Laina, Leutenegger, "OKVIS2-X: Open Keyframe-based Visual-Inertial SLAM Configurable with Dense Depth or LiDAR, and GNSS," arXiv, 2025: https://arxiv.org/abs/2510.04612
- OKVIS original implementation lineage: https://github.com/ethz-asl/okvis
- Leutenegger et al., "Keyframe-based visual-inertial odometry using nonlinear optimization" / OKVIS lineage: https://www.roboticsproceedings.org/rss09/p37.html
- ORB-SLAM3 baseline context: https://arxiv.org/abs/2007.11898
- OpenVINS baseline context: https://arxiv.org/abs/1910.13455
