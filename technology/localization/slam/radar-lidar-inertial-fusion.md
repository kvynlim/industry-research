# Radar-LiDAR-Inertial Fusion for Robust Odometry and SLAM

Related docs: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md), [radar-inertial odometry](radar-inertial-odometry.md), [FAST-LIO2](fast-lio-fast-lio2.md), [LIO-SAM](lio-sam.md), [factor graphs and iSAM2](factor-graph-isam2-gtsam.md), and [robust multi-sensor localization](../robust-state-estimation-multi-sensor.md).

## Executive Summary

Radar-LiDAR-Inertial fusion combines three complementary sensing modes: LiDAR for dense metric geometry, radar for adverse-weather returns and Doppler velocity, and IMU for high-rate motion propagation. This is currently one of the most relevant research directions for outdoor autonomy under degradation because it addresses the main weakness of LiDAR-inertial odometry: LiDAR can be accurate in clear structured scenes, but it degrades in fog, dust, smoke, rain, snow, open spaces, tunnels, and repetitive geometry.

Representative methods include Degradation Resilient LiDAR-Radar-Inertial Odometry, GaRLIO, Doppler-SLAM, AF-RLIO-style adaptive fusion, and systems that extend LiDAR-inertial smoothers with radar velocity or radar scan factors. The best designs do not simply average sensors. They detect which axes are constrained by LiDAR, add radar Doppler or radar scan information where LiDAR is weak, and use robust factor graphs or filters to prevent one failing modality from corrupting the estimate.

For AV and airside deployment, this family is more compelling than camera-only Gaussian SLAM or radar-only SLAM. It still needs engineering hardening, but it matches the operational reality: LiDAR gives high-precision structure near terminals and stands, radar remains useful in adverse weather and around obscurants, and IMU/wheel/GNSS/map factors handle continuity and global reference.

## Historical Context

LiDAR-inertial odometry systems such as LIO-SAM, FAST-LIO2, Point-LIO, and CT-ICP-derived pipelines became strong baselines for metric odometry and mapping. Their weakness is not average clear-weather accuracy; it is degradation. A tunnel, corridor, open apron, smoke cloud, dust plume, heavy fog, or repeated geometry can make LiDAR scan matching underconstrained or wrong.

Radar-inertial odometry developed in parallel to exploit radar's weather robustness and Doppler velocity, but radar alone is too sparse and multipath-prone for LiDAR-level mapping in many scenes. Fusion methods combine the strengths:

- LiDAR supplies dense point-to-plane or scan-to-map constraints when geometry is good.
- Radar supplies Doppler velocity and sometimes sparse spatial constraints when LiDAR is weak.
- IMU supplies high-rate propagation and gravity/attitude continuity.
- Factor graphs allow modality-specific residuals, robust kernels, and degeneracy-aware weighting.

The 2024 Degradation Resilient LiDAR-Radar-Inertial Odometry paper explicitly targets LiDAR degeneracy with radar as a complementary modality. GaRLIO adds radar pointwise velocity for gravity and dynamic-object handling. Doppler-SLAM extends the idea into a Doppler-aided radar-inertial and LiDAR-inertial SLAM framework with online extrinsic calibration and loop closure.

## Sensor Assumptions

Typical sensor suite:

- 3D LiDAR or solid-state/spinning LiDAR with per-point timestamps.
- 4D radar or Doppler-capable FMCW radar with range, azimuth, elevation, and radial velocity.
- IMU with calibrated noise, bias, and axis conventions.
- Known or online-estimated extrinsics among LiDAR, radar, and IMU.
- Optional wheel odometry, GNSS/RTK, barometer, and vehicle kinematic constraints.

Assumptions:

- LiDAR and radar fields of view overlap enough to support shared motion estimation or cross-checking.
- Radar Doppler is calibrated and synchronized.
- Dynamic-object rejection is available for both LiDAR and radar.
- The estimator can detect LiDAR degeneracy rather than blindly trusting scan matching.
- Radar multipath and sparse returns are robustly downweighted.
- Sensor clocks are stable or time offsets are estimated.

For airside vehicles, sensor placement matters. Radar should not be shadowed by bumpers or implements, LiDAR should be cleaned and heated if needed, and the IMU should be isolated from severe vibration while maintaining a rigid transform.

## State/Map Representation

A production-oriented radar-LiDAR-inertial state commonly includes:

```text
x = [R, p, v, b_g, b_a, g,
     T_lidar_imu, T_radar_imu,
     delta_t_lidar, delta_t_radar]
```

Not every research method estimates every term online. At minimum, the estimator must model pose, velocity, IMU biases, and sensor extrinsics.

Map representations:

- LiDAR local map: voxel map, ikd-tree, surfels, feature points, or submaps.
- Radar local map: radar detections, radar keyframes, Doppler factors, or reflectivity submaps.
- Factor graph: IMU preintegration, LiDAR scan factors, radar Doppler factors, radar scan factors, loop closures, GNSS/map factors.
- Health model: modality-specific residuals, degeneracy eigenvalues, inlier counts, and covariance inflation rules.

The map used for navigation should remain metric and inspectable. Radar data may be a factor layer or reflectivity map; it should not silently overwrite a LiDAR HD map with multipath artifacts.

## Algorithm Pipeline

1. **Sensor synchronization and calibration**
   - Time-align LiDAR packets, radar frames, and IMU samples.
   - Apply known extrinsics or estimate them online when supported.

2. **IMU propagation**
   - Propagate state at high rate.
   - Deskew LiDAR and radar measurements if timing supports it.

3. **LiDAR front end**
   - Extract features or use direct scan-to-map residuals.
   - Compute point-to-plane, point-to-line, GICP, or voxel-map constraints.
   - Estimate degeneracy or observability directions.

4. **Radar front end**
   - Filter radar detections by RCS, Doppler, range, and geometric consistency.
   - Estimate Doppler ego-velocity.
   - Optionally perform radar scan matching or submap matching.
   - Detect dynamic radar returns.

5. **Adaptive fusion**
   - Add LiDAR factors where geometry is well constrained.
   - Add radar velocity or spatial factors where LiDAR is weak.
   - Use robust losses and gating to reject multipath/dynamic objects.

6. **Back-end optimization**
   - Run an EKF, iterated EKF, fixed-lag smoother, or pose graph.
   - Add loop closures, GNSS, wheel, and map factors when available.

7. **Diagnostics and output**
   - Publish pose, velocity, covariance, modality residuals, degeneracy status, and fallback state.

## Formulation

A generic factor-graph objective is:

```text
X* = arg min_X
      sum_imu     || r_imu(X_i, X_j) ||^2
    + sum_lidar   rho_l(|| r_lidar(X_k, M_l) ||^2)
    + sum_dopp    rho_r(|| r_doppler(X_k, z_r) ||^2)
    + sum_rscan   rho_r(|| r_radar_scan(X_k, M_r) ||^2)
    + sum_loop    rho(|| r_loop(X_a, X_b) ||^2)
    + sum_abs     rho(|| r_gnss_map(X_k) ||^2)
```

LiDAR residuals often use point-to-plane geometry:

```text
r_lidar = n^T * (T_k * p_i - q_i)
```

Radar Doppler residuals constrain velocity:

```text
r_doppler = z_i - u_i^T * (v_body + omega_body x r_i)
```

Degeneracy-aware fusion modifies the information matrix or factor selection. If LiDAR is weak along a direction, the estimator should preserve LiDAR information in well-constrained axes while allowing radar, IMU, wheel, or map factors to constrain weak axes. This is more robust than accepting or rejecting a whole LiDAR update as one scalar decision.

## Failure Modes

- **Bad extrinsics:** Small radar-LiDAR-IMU calibration errors create biased fusion and false disagreement.
- **Temporal offset:** Radar Doppler and LiDAR deskewing are highly sensitive to time alignment.
- **Conflicting outliers:** LiDAR may see fog/dust artifacts while radar sees multipath; robust fusion must reject both when needed.
- **Dynamic scenes:** Moving aircraft, tugs, buses, and pedestrians can pollute both LiDAR and radar factors.
- **LiDAR degeneracy not detected:** The graph may trust a confident but unobservable LiDAR registration.
- **Radar multipath:** Radar can add false constraints near metal, glass, wet ground, fences, and aircraft.
- **Overweighting radar velocity:** Doppler helps velocity but does not fully solve position and yaw drift.
- **Compute complexity:** Multi-sensor fixed-lag smoothing can miss deadlines on embedded hardware.
- **Map contamination:** Radar or LiDAR returns from temporary objects can enter persistent maps.
- **Weather-specific bias:** Rain/fog/snow can alter both sensor point distributions and learned filters.

## AV Relevance

Radar-LiDAR-Inertial fusion is directly relevant to AV localization because it improves both accuracy and availability:

- LiDAR provides centimeter-scale local geometry in clear structured scenes.
- Radar improves robustness in adverse weather and low-visibility conditions.
- Doppler adds direct velocity information.
- IMU preserves continuity between lower-rate exteroceptive updates.
- Factor graphs support map, GNSS, wheel, and loop constraints.

This is a better production direction than choosing between LiDAR and radar. The important engineering question is how to arbitrate and validate the sensors, not which single modality wins a benchmark.

Production requirements:

- Per-modality health metrics.
- Conservative covariance inflation under degradation.
- Fault injection tests for each sensor.
- Deterministic timing on target compute.
- Map governance and dynamic-object exclusion.
- Clear fallback and safe-stop behavior.

## Indoor/Outdoor Relevance

**Indoor:** Useful in smoke, dust, darkness, mines, tunnels, warehouses, and hangars. Radar multipath can be severe, but LiDAR provides geometry where visible and IMU bridges gaps.

**Outdoor:** Strong fit for roads, ports, airports, agriculture, mining, and construction. Outdoor scenes benefit from radar range and weather robustness while LiDAR handles precise structure.

**Mixed indoor/outdoor:** Especially strong for terminal edges, covered roads, tunnels, hangars, and urban canyons where GNSS and lighting can change abruptly.

## Airside Deployment Notes

This is the most practical adverse-weather SLAM direction for airside autonomy.

Airside deployment notes:

- Use LiDAR for high-resolution stand, curb, terminal, pole, and equipment geometry when clear.
- Use radar Doppler and radar scan factors to preserve motion estimates in fog, rain, de-icing spray, dust, and glare.
- Fuse wheel odometry and nonholonomic constraints for low-speed GSE.
- Treat aircraft and mobile GSE as dynamic objects in both LiDAR and radar maps.
- Add radar reflectors or surveyed infrastructure landmarks in open apron zones where natural structure is weak.
- Monitor LiDAR degeneracy eigenvalues and radar Doppler inlier geometry by operating zone.
- Use RTK/GNSS only after multipath innovation gating near terminals and aircraft.
- Validate with wet tarmac, night floodlights, precipitation, jet blast spray, and sensor blockage.

The estimator should expose an operational state such as `nominal`, `lidar_degraded_radar_aiding`, `radar_degraded_lidar_only`, `global_reference_degraded`, and `safe_stop_required`.

## Datasets/Metrics

Relevant datasets:

- **LiDAR degeneracy datasets from NTNU ARL:** real-world tests for LiDAR-radar-inertial fusion under geometric self-similarity and obscurant occlusion.
- **Boreas:** radar, LiDAR, cameras, and GNSS/INS across seasons.
- **Oxford Radar RobotCar:** radar and road revisits under long-term conditions.
- **MulRan:** radar/LiDAR sequences for odometry and place recognition.
- **Coloradar:** 4D radar, LiDAR, camera, IMU, and ground-truth resources.
- **Go-RIO/GaRLIO datasets:** 4D radar and LiDAR-inertial experiments associated with recent radar fusion work.
- **Custom airside data:** required for apron openness, aircraft multipath, dynamic GSE, and weather.

Metrics:

- ATE and RPE by scene type and weather.
- Drift during LiDAR-degraded intervals.
- Drift during radar-degraded intervals.
- Velocity RMSE from Doppler-aided estimation.
- Vertical drift and gravity estimate stability.
- Degeneracy detection precision/recall.
- Dynamic-object map contamination.
- Covariance consistency, NEES/NIS, and innovation rejection rate.
- Runtime P95/P99 and deadline misses.
- Availability before safe stop under sensor faults.

Airside acceptance should be scenario-based. A single average ATE across clear-weather public datasets is not enough.

## Open-Source Implementations

- **Wayne-DWA/Doppler-SLAM:** Doppler-aided radar-inertial and LiDAR-inertial SLAM with code and dataset release.
- **ChiyunNoh/GaRLIO:** gravity-enhanced radar-LiDAR-inertial odometry with public source code.
- **ntnu-arl/lidar_degeneracy_datasets:** datasets for LiDAR-radar-inertial fusion under degraded LiDAR conditions.
- **utiasASRL/steam_icp:** continuous-time radar, LiDAR, radar-inertial, and LiDAR-inertial odometry; useful baseline infrastructure.
- **robotics-upo/4D-Radar-Odom:** 4D radar-IMU ROS2 package; useful for radar-inertial components before full RLIO fusion.
- **FAST-LIO2/LIO-SAM baselines:** not radar-fusion systems by themselves, but important LiDAR-inertial baselines for comparison.

Code maturity is mixed. Most packages are research-oriented and require careful adaptation to the target radar, LiDAR, IMU, ROS version, and vehicle timing architecture.

## Practical Recommendation

For an airside AV program, prioritize radar-LiDAR-inertial fusion as the adverse-weather localization path. Start from a proven LIO stack, add radar Doppler velocity factors and radar health monitoring, then graduate to radar scan/submap factors only after multipath and dynamic-object handling are validated.

Do not build a monolithic black-box fusion system without per-sensor diagnostics. The practical architecture is a robust estimator that can use LiDAR when geometry is strong, radar when visibility or degeneracy is poor, and conservative fallbacks when neither modality is trustworthy.

## Sources

- Nissov, M., Khedekar, N., and Alexis, K. "Degradation Resilient LiDAR-Radar-Inertial Odometry." ICRA 2024. https://arxiv.org/abs/2403.05332
- Noh, C., Yang, W., Jung, M., Jung, S., and Kim, A. "GaRLIO: Gravity enhanced Radar-LiDAR-Inertial Odometry." arXiv, 2025. https://arxiv.org/abs/2502.07703
- Wang, D. et al. "Doppler-SLAM: Doppler-Aided Radar-Inertial and LiDAR-Inertial Simultaneous Localization and Mapping." RA-L, 2025. https://arxiv.org/abs/2504.11634
- Doppler-SLAM repository. https://github.com/Wayne-DWA/Doppler-SLAM
- GaRLIO repository. https://github.com/ChiyunNoh/GaRLIO
- NTNU LiDAR degeneracy datasets. https://github.com/ntnu-arl/lidar_degeneracy_datasets
- STEAM-ICP repository. https://github.com/utiasASRL/steam_icp
- Local context: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md)

