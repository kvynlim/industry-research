# FastSLAM and Particle SLAM

## Executive Summary

FastSLAM is the classical Rao-Blackwellized particle-filter solution to SLAM. Instead of maintaining one dense Gaussian over robot pose and all landmarks, it samples possible robot trajectories with particles and attaches an independent map estimate to each particle. Conditioned on a sampled trajectory, landmarks become independent, so the map can be represented as many small estimators rather than one dense covariance matrix. This factorization was the breakthrough that made particle-filter SLAM attractive for ambiguous data association and grid mapping.

FastSLAM is most important today for two reasons. First, it explains why sampling the hard part of the posterior and solving the conditionally easy part analytically is powerful. Second, its grid-mapping descendant, GMapping, became one of the most widely used 2D laser SLAM systems in ROS. For modern AV and airside autonomy, FastSLAM is not the preferred primary backend: high-dimensional vehicle state, long missions, large maps, and precise loop closure are better handled by graph optimization. But particle methods remain useful for global relocalization, kidnapped-robot recovery, multimodal hypotheses, and small 2D occupancy mapping tasks.

## Historical Context

FastSLAM was introduced by Montemerlo, Thrun, Koller, and Wegbreit in 2002 as a factored solution to SLAM with unknown data association. The insight was that the SLAM posterior can be decomposed into a posterior over robot paths and independent landmark posteriors conditioned on each path:

```text
p(x_1:t, m | z_1:t, u_1:t, c_1:t)
= p(x_1:t | z_1:t, u_1:t, c_1:t) * product_j p(m_j | x_1:t, z_1:t, c_1:t)
```

FastSLAM 1.0 sampled paths from the motion model, which is simple but inefficient when measurements are informative. FastSLAM 2.0 improved the proposal distribution by incorporating the latest observation, reducing particle requirements and giving stronger convergence behavior in landmark settings.

In parallel, Rao-Blackwellized particle filters were adapted to occupancy grid mapping. Grisetti, Stachniss, and Burgard's improved RBPF grid mapping method combined scan matching, an improved proposal, and adaptive resampling. That work underpins OpenSLAM GMapping and the ROS `slam_gmapping` package, which made RBPF SLAM mainstream for 2D indoor robots.

Particle SLAM has since been largely displaced in large-scale robotics by graph SLAM and factor graphs, but it remains a foundational method because it handles multimodality more naturally than EKF or Gauss-Newton methods.

## Sensor Assumptions

FastSLAM has two common sensor regimes.

**Landmark FastSLAM:**

- Odometry or inertial control input gives a proposal for robot motion.
- Range-bearing, bearing-only, stereo, or fiducial observations detect reusable landmarks.
- Each landmark can be estimated independently when the robot trajectory is known.
- Association may be known, sampled, or estimated per particle.

**Grid RBPF SLAM / GMapping:**

- A 2D planar laser scanner observes local geometry.
- Wheel odometry provides a motion prior.
- Scan matching gives an observation-informed proposal.
- Each particle carries a 2D occupancy grid map.
- The robot operates mostly on a plane; roll, pitch, and 3D structure are not central.

Particle SLAM assumes the posterior can be represented with enough particles. That assumption gets harder as the state dimension, environment size, speed, and ambiguity increase. A low-speed indoor robot with a 2D lidar is ideal. A multi-sensor AV with 6-DoF motion, IMU biases, RTK, LiDAR, cameras, and long trajectories is not.

## State and Map Representation

In landmark FastSLAM, each particle stores:

```text
particle i:
  weight w_i
  sampled path or current pose x_i
  map M_i = {landmark filters}

landmark j in particle i:
  mean mu_ij
  covariance P_ij
```

Conditioned on the particle trajectory, landmarks are independent:

```text
p(M_i | x_i, z) = product_j p(m_j | x_i, z)
```

This avoids the dense EKF-SLAM covariance, but it duplicates map state across particles. With `M` particles and `N` landmarks, storage is often `O(MN)` plus per-landmark covariance. Tree structures can reduce landmark lookup and copying cost.

In grid RBPF SLAM, each particle stores:

```text
particle i:
  weight w_i
  pose x_i
  occupancy grid map G_i
```

This is memory-heavy but conceptually simple. Resampling must be implemented carefully so maps are not copied unnecessarily.

## Algorithm Pipeline

1. **Initialize particles.** Create `M` particles with equal weights and either an empty landmark map or an empty occupancy grid.

2. **Sample or optimize pose proposal.**

FastSLAM 1.0:

```text
x_t^[i] ~ p(x_t | x_{t-1}^[i], u_t)
```

FastSLAM 2.0 and GMapping use the newest observation to form a better proposal:

```text
x_t^[i] ~ p(x_t | x_{t-1}^[i], u_t, z_t)
```

3. **Update the particle map.**

- For landmark SLAM, update the associated landmark EKF inside each particle or initialize a new landmark.
- For grid SLAM, integrate the laser scan into that particle's occupancy grid using inverse sensor models and log-odds updates.

4. **Compute particle weights.** The weight is proportional to the observation likelihood under the particle's pose and map:

```text
w_i <- w_i * p(z_t | x_t^[i], M^[i])
```

5. **Normalize weights.**

```text
w_i <- w_i / sum_j w_j
```

6. **Resample when needed.** Use effective sample size:

```text
N_eff = 1 / sum_i w_i^2
```

Resample only when `N_eff` falls below a threshold to avoid unnecessary particle impoverishment.

7. **Estimate output.** Publish the best particle, a weighted mean pose, or a consensus map. For navigation, the maximum-weight particle is often more coherent than an averaged map.

## Formulation

The SLAM posterior is:

```text
p(x_1:t, m | z_1:t, u_1:t)
```

FastSLAM applies Rao-Blackwellization:

```text
p(x_1:t, m | z_1:t, u_1:t)
= p(x_1:t | z_1:t, u_1:t) * p(m | x_1:t, z_1:t)
```

For landmark maps:

```text
p(m | x_1:t, z_1:t) = product_j p(m_j | x_1:t, z_1:t)
```

The path posterior is approximated with particles:

```text
p(x_1:t | z_1:t, u_1:t) ~= sum_i w_i delta(x_1:t - x_1:t^[i])
```

Each landmark filter is usually an EKF:

```text
mu_j, P_j <- EKFUpdate(mu_j, P_j, z_t, x_t^[i])
```

For occupancy grids, each particle's map is updated through log-odds:

```text
l_t(c) = l_{t-1}(c) + inverse_sensor_model(c, x_t, z_t) - l_0
```

GMapping's major improvements are:

- Scan matching to sharpen the proposal distribution.
- Adaptive resampling based on `N_eff`.
- Selective map updates to reduce particle depletion.
- Better use of laser observations than motion-model-only proposals.

## Failure Modes

**Particle depletion.** After repeated resampling, many particles share a common ancestor and diversity collapses. Once the correct hypothesis disappears, it cannot be recovered.

**Proposal mismatch.** If particles are sampled from a weak motion model while observations are highly informative, most particles receive tiny weights. FastSLAM 2.0 and scan-matching proposals mitigate this.

**High-dimensional state.** Particle filters scale poorly with dimension. Sampling full 6-DoF pose, velocity, IMU biases, calibration, and map states is not practical for AV-scale localization.

**Long-loop inconsistency.** Particles represent local trajectory hypotheses. Long-range loop closure can require globally coordinated corrections that particle SLAM handles less cleanly than pose-graph optimization.

**Per-particle map memory.** Occupancy grids or large landmark maps replicated over many particles are expensive.

**Data association ambiguity.** FastSLAM can maintain different associations per particle, which is a strength, but if the particle count is too low the correct association hypothesis may vanish.

**Dynamic environments.** Moving obstacles integrated into per-particle maps create inconsistent maps and misleading scan likelihoods.

**Degenerate scan matching.** Long corridors, large open aprons, glass/metal reflections, and sparse features can make the observation likelihood broad or multimodal.

## AV Relevance

FastSLAM is not a modern AV global backend. AVs need long-horizon smoothing, multi-sensor calibration, loop closure, HD map alignment, and robust optimization. Factor graphs are a better fit.

Particle methods remain relevant in AV subsystems:

- Global localization over a prior map when the initial pose is unknown.
- Kidnapped-robot recovery after a restart or tow.
- Maintaining multiple hypotheses during GPS multipath or ambiguous place recognition.
- 2D local mapping for low-speed indoor or depot robots.
- Tracking discrete mode hypotheses, such as "GPS normal" versus "GPS multipath".

In an AV stack, particle filtering is usually a frontend or recovery tool, not the long-term SLAM map owner.

## Indoor/Outdoor Relevance

**Indoor:** RBPF grid mapping is strong for 2D indoor robots with wheel odometry and planar lidar. This is the classic GMapping operating regime. It can generate usable occupancy maps for offices, warehouses, corridors, and small facilities.

**Outdoor:** Outdoor particle SLAM is harder because maps are larger, features are sparser, surfaces are less constrained to 2D, and vehicle dynamics are faster. It can work for small outdoor UGVs, but AV-scale outdoor mapping is better served by LiDAR odometry plus graph optimization.

**Mixed indoor/outdoor:** Particle methods are useful at transition points where global initialization is ambiguous, but once initialized, smoothing backends are preferred for continuous operation.

## Airside Deployment Notes

Airside aprons are a poor fit for GMapping-style 2D RBPF as the main map builder. Large open areas, repeated stand layouts, aircraft movement, reflective surfaces, and GPS/RTK integration requirements push the problem beyond 2D particle-grid assumptions.

Useful airside roles:

- Kidnapped-robot recovery over a coarse prior map with a small set of pose hypotheses.
- Local 2D mapping in baggage halls, maintenance bays, or charging depots.
- Multi-hypothesis localization when GNSS is degraded near terminal structures.
- Conservative fallback when graph-based localization temporarily loses loop closure confidence.

Operational cautions:

- Do not use dynamic aircraft/GSE returns as stable map evidence.
- Keep particle count adaptive and monitor `N_eff`.
- Use semantic masks and temporal decay if integrating occupancy.
- Hand off to the main [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) backend after a recovery hypothesis is verified.
- Use place recognition from [LiDAR Place Recognition and Re-Localization](../lidar-place-recognition-relocalization.md) to seed hypotheses rather than relying only on random global particles.

## Datasets and Metrics

Useful datasets:

- **RADISH:** Classic 2D laser datasets including Intel Research Lab, Freiburg, and Killian Court.
- **UTIAS MR.CLAM:** Range-bearing landmarks and ground truth for particle landmark SLAM experiments.
- **KITTI odometry:** Useful for showing the limits of particle methods in outdoor vehicle-scale settings.
- **TUM RGB-D:** Useful for comparing particle-map localization concepts against visual/RGB-D SLAM systems.
- **Newer College:** Modern LiDAR/vision/inertial dataset; more relevant for graph methods but useful for relocalization experiments.

Metrics:

- ATE and RPE for trajectory accuracy.
- Occupancy-map quality against reference maps, when available.
- Particle effective sample size over time.
- Resampling frequency.
- Loop closure success rate.
- Kidnapped-robot recovery time and success probability.
- Runtime and memory versus particle count and map size.
- Map entropy or occupancy consistency.

For particle SLAM, report failure rate across repeated runs. Sampling methods can produce variable outcomes even with the same dataset.

## Open-Source Implementations

- **OpenSLAM GMapping:** Canonical RBPF grid-mapping implementation: https://openslam-org.github.io/gmapping.html
- **ROS `slam_gmapping`:** ROS wrapper around OpenSLAM GMapping: https://wiki.ros.org/slam_gmapping
- **MRPT RBPF-SLAM:** C++ RBPF SLAM implementations and tutorials: https://www.mrpt.org/tutorials/slam-algorithms/rbpf-slam_algorithms/
- **MRPT repository:** https://github.com/MRPT/mrpt
- **PythonRobotics FastSLAM examples:** https://github.com/AtsushiSakai/PythonRobotics
- **Cartographer:** Not FastSLAM, but an important 2D/3D SLAM comparison point using submaps and pose-graph optimization: https://github.com/cartographer-project/cartographer

## Practical Recommendation

Use FastSLAM or RBPF grid mapping for small 2D robots, education, and recovery/localization modules that genuinely need multimodal hypotheses. Do not build an AV-scale airside SLAM architecture around per-particle maps.

For airside deployment:

- Use factor-graph smoothing for the production trajectory and map.
- Use particle filtering only for global relocalization or short-horizon ambiguous localization.
- Use occupancy grid/TSDF/ESDF mapping from [Real-Time Occupancy Grid Mapping](../realtime-occupancy-grid-mapping.md) for planning maps.
- Use [Map Construction Pipeline](../map-construction-pipeline.md) for offline airport map building.

## Related Repository Docs

- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md)
- [LiDAR Place Recognition and Re-Localization](../lidar-place-recognition-relocalization.md)
- [Real-Time Occupancy Grid Mapping](../realtime-occupancy-grid-mapping.md)
- [Map Construction Pipeline](../map-construction-pipeline.md)

## Sources

- Montemerlo, Thrun, Koller, and Wegbreit, "FastSLAM: A Factored Solution to the Simultaneous Localization and Mapping Problem," AAAI 2002: https://ai.stanford.edu/~koller/Papers/Montemerlo+al:AAAI02.pdf
- Montemerlo et al., "FastSLAM 2.0: An Improved Particle Filtering Algorithm for Simultaneous Localization and Mapping," IJCAI 2003: https://www.cs.cmu.edu/~mmde/mmdeijcai2003.pdf
- Grisetti, Stachniss, and Burgard, "Improved Techniques for Grid Mapping with Rao-Blackwellized Particle Filters," IEEE T-RO, 2007: https://people.eecs.berkeley.edu/~pabbeel/cs287-fa13/optreadings/GrisettiStachnissBurgard_gMapping_T-RO2006.pdf
- Bailey, Nieto, and Nebot, "Consistency of the FastSLAM Algorithm," ICRA 2006: https://www-personal.acfr.usyd.edu.au/tbailey/papers/icra06.pdf
- OpenSLAM GMapping project page: https://openslam-org.github.io/gmapping.html
- MRPT RBPF-SLAM tutorial: https://www.mrpt.org/tutorials/slam-algorithms/rbpf-slam_algorithms/
- RADISH dataset repository: https://radish.sourceforge.net/
- UTIAS MR.CLAM dataset: https://asrl.utias.utoronto.ca/datasets/mrclam/
- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
