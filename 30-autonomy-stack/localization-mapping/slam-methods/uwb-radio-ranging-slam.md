# UWB and Radio Ranging SLAM

## Executive Summary

UWB and radio ranging SLAM uses distance measurements from radio transceivers as localization constraints. Unlike cameras and LiDAR, range measurements can remain useful in darkness, smoke, dust, textureless corridors, and visually degraded indoor spaces. The measurement is usually simple:

```text
z_range = || p_tag - p_anchor || + noise
```

but the estimation problem is difficult because range-only measurements are nonlinear, ambiguous without motion or anchors, and vulnerable to non-line-of-sight (NLOS) bias.

Modern systems combine UWB with visual, inertial, LiDAR, or wheel odometry. VIR-SLAM adds UWB ranging to visual-inertial SLAM for single- and multi-robot systems. VIRAL SLAM tightly couples camera, IMU, UWB, and LiDAR. C2VIR-SLAM and related systems use collaborative visual-inertial-range constraints. Recent CT-VIR work moves toward continuous-time spline-based visual-inertial-ranging fusion with sparse anchors and asynchronous measurements.

This page focuses on radio range factors and cooperative localization/SLAM patterns.

## Method Class

- Range-only SLAM and localization.
- UWB-aided visual-inertial or LiDAR-inertial SLAM.
- Cooperative multi-robot localization with robot-robot ranges.
- Anchor-based and anchor-free radio factor graphs.
- Indoor GNSS-denied localization layer.

## Method Summary

Range-only SLAM uses distance observations between:

```text
robot tag <-> fixed anchor
robot tag <-> unknown beacon/landmark
robot tag <-> robot tag
```

The range residual is:

```text
r = || p_i + R_i t_tag - p_anchor || - z
```

For robot-robot ranging:

```text
r = || (p_i^a + R_i^a t_tag_a) - (p_j^b + R_j^b t_tag_b) || - z_ab
```

With only range, bearing is unobserved at a single instant. Motion, multiple anchors, multiple robots, or visual-inertial priors are required to make the state observable. This is why range-only SLAM often appears as a factor added to a stronger odometry system rather than as a standalone estimator.

## Factor and State Representation

State variables can include:

```text
X_i: robot pose at time i
v_i: velocity
b_i: IMU bias
A_k: anchor position
B_k: unknown radio beacon/landmark position
T_tag_body: UWB tag extrinsic on the robot
delta_t: clock or time offset, optional
spline control poses: for continuous-time VIR fusion
```

Factor types:

```text
range-to-known-anchor:
  || p(X_i, tag) - A_known || - z

range-to-unknown-anchor:
  || p(X_i, tag) - A_k || - z

robot-robot range:
  || p(X_i^a, tag_a) - p(X_j^b, tag_b) || - z

VIO / IMU factors:
  visual reprojection, IMU preintegration, marginalization priors

LiDAR factors:
  scan matching, point-to-plane, loop closure

NLOS robust factor:
  robust loss, switch variable, bias state, or covariance inflation
```

Continuous-time methods such as CT-VIR parameterize the trajectory with B-splines and attach visual, inertial, and ranging factors at their native timestamps:

```text
X(t) = spline(control_poses, t)
r_range(t_k) = || p(X(t_k), tag) - A || - z_k
```

This avoids forcing asynchronous UWB, IMU, and camera measurements into one discrete timestamp grid.

## Front-End Mechanics

1. **Ranging protocol.** Use two-way ranging, time-of-flight, TDoA, or vendor-specific UWB measurements.

2. **Timestamping.** Record range timestamps in the estimator clock and calibrate offsets if needed.

3. **Anchor management.** Decide whether anchors are surveyed, estimated online, virtual, or attached to other robots.

4. **NLOS detection.** Use RSSI, channel impulse response, residual history, environment maps, or robust statistical tests.

5. **Data association.** Known anchor IDs are easy; unknown beacons or peer robots require ID and frame management.

6. **Odometry prior.** Use VIO, LIO, wheel odometry, or IMU propagation to carry short-term motion.

7. **Outlier gating.** Reject impossible ranges based on max speed, map walls, anchor geometry, and residuals.

## Back-End Mechanics

Range factors can be used in:

- **EKF range-only SLAM.** Classical approach, efficient but sensitive to linearization and delayed initialization.
- **Multi-hypothesis filters.** Useful because a single range creates circular/spherical ambiguity for unknown landmarks.
- **Sliding-window factor graphs.** Common in visual-inertial-ranging systems.
- **Batch graph optimization.** Useful for anchor calibration and map production.
- **Continuous-time graph optimization.** Useful for asynchronous UWB and high-rate IMU/camera fusion.
- **Federated cooperative filters.** Share information across robots without centralizing every state.

The backend must handle gauge freedom. With no surveyed anchors or shared global prior, the map is only observable up to a global transform. With only one anchor, some degrees of freedom remain weak unless motion and other sensors provide constraints.

## Assumptions

- UWB ranges are sufficiently frequent and correctly timestamped.
- Anchor or peer IDs are known.
- NLOS bias is detected, modeled, or robustly downweighted.
- Motion provides enough excitation to resolve range-only ambiguity.
- Anchor geometry is not degenerate; all anchors on one line or plane can leave weak modes.
- Tag extrinsics are calibrated.
- Radio regulations, interference, and antenna placement are compatible with the deployment site.

## Strengths

- Works where cameras and LiDAR struggle: darkness, smoke, dust, low texture, and visually repetitive spaces.
- Direct metric distance constraints reduce VIO/LIO drift.
- UWB tags are small and relatively low power.
- Robot-robot ranging helps cooperative localization even without shared visual features.
- Sparse anchors can provide global corrections in GNSS-denied spaces.
- Range factors integrate naturally in factor graphs with IMU, camera, LiDAR, wheel, and loop closure.

## Limitations

- Range-only constraints are ambiguous without good geometry and motion.
- NLOS and multipath can create large positive biases.
- Anchor installation and surveying can be operationally expensive.
- UWB performance depends on antenna placement, body occlusion, frequency regulation, and interference.
- Sparse anchors can be worse than no anchors if overtrusted.
- Robot-robot ranges do not identify bearing, relative yaw, or full 6-DOF transform by themselves.
- Many papers evaluate with simulated UWB on public datasets; real-radio validation is essential.

## Datasets and Benchmarks

Relevant benchmarks include:

- **VIR-SLAM evaluations.** Public visual-inertial datasets with simulated UWB plus real-robot tests.
- **VIRAL dataset/system.** Camera, IMU, UWB, and LiDAR fusion contexts.
- **UWB indoor robot datasets.** Needed for NLOS, anchor geometry, and real-radio error modeling.
- **TurtleBot3 / ROS 2 cooperative range-only experiments.** Recent cooperative RO-SLAM work reports robot-landmark and robot-robot ranges.
- **In-house industrial/airside tests.** Required because metal structures, vehicles, aircraft, racks, and walls strongly affect radio paths.

Metrics:

- ATE/RPE with and without UWB;
- range residual distribution by anchor and line-of-sight label;
- NLOS detection precision/recall;
- anchor position error if anchors are estimated;
- cooperative relative pose error;
- outage recovery time after visual/LiDAR degradation;
- robustness under sparse anchors.

## AV Relevance

For road AVs, UWB is not a replacement for GNSS, LiDAR, radar, or cameras. Its stronger role is in infrastructure-assisted localization: depots, factories, underground roads, tunnels, garages, charging bays, warehouses, and airport service areas where GNSS is weak and surveyed anchors are feasible.

For airside autonomy, UWB can be useful around hangars, terminal service roads, baggage areas, and indoor-outdoor handoff zones. It is less attractive on open aprons unless anchors can be installed and maintained. Metal aircraft, ground support equipment, and terminal structures create NLOS and multipath risks, so range factors must be robust and monitored.

## Indoor and Outdoor Relevance

- **Indoor:** Strong fit when anchors can be deployed and surveyed; especially useful for warehouses, hospitals, factories, mines, and smoke/dust environments.
- **Outdoor:** Useful for yards and campuses with installed anchors; less compelling for wide-area roads with GNSS/RTK.
- **Mixed:** Valuable for GNSS-denied transitions, but anchor geometry and NLOS classification must change across zones.

## Integration Checklist

- Decide whether anchors are fixed, estimated, mobile, or virtual.
- Survey anchor coordinates and covariances if using fixed anchors.
- Calibrate tag-to-body extrinsics and timestamp offsets.
- Model range noise per anchor/link rather than one global sigma.
- Add NLOS detection, robust loss, and residual monitoring before field deployment.
- Keep range factors as aiding constraints, not hard truth.
- Test observability with sparse anchors and planned trajectories.
- Separate robot-robot range from full relative-pose constraints.
- Validate in the real radio environment, not only with simulated ranges.
- Fuse with [Factor Graph / iSAM2 / GTSAM](factor-graph-isam2-gtsam.md), VIO, LIO, or wheel odometry for robustness.

## Related Repository Docs

- [Factor Graph / iSAM2 / GTSAM](factor-graph-isam2-gtsam.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [OpenVINS](openvins.md)
- [FAST-LIO/FAST-LIO2](fast-lio-fast-lio2.md)
- [Radar-Inertial Odometry](radar-inertial-odometry.md)
- [Distributed Multi-Robot Pose Graph Optimization](distributed-multi-robot-pgo.md)
- [D2SLAM](d2slam.md)

## Sources

- Cao and Beltrame, "VIR-SLAM: Visual, Inertial, and Ranging SLAM for single and multi-robot systems," arXiv, 2020: https://arxiv.org/abs/2006.00420
- Nguyen et al., "VIRAL SLAM: Tightly Coupled Camera-IMU-UWB-Lidar SLAM," arXiv, 2021: https://arxiv.org/abs/2105.03296
- Liu and Zhang, "CT-VIR: Continuous-Time Visual-Inertial-Ranging Fusion for Indoor Localization with Sparse Anchors," arXiv, 2026: https://arxiv.org/abs/2604.14545
- Bianchi and Martinelli, "A cooperative approach to Range-Only SLAM with undelayed initialization," Robotics and Autonomous Systems, 2026: https://doi.org/10.1016/j.robot.2025.105230
- Kurth, "Range-Only Robot Localization and SLAM with Radio," CMU-RI-TR-04-29, 2004: https://www.ri.cmu.edu/publications/range-only-robot-localization-and-slam-with-radio/
- C2VIR-SLAM, "Centralized Collaborative Visual-Inertial-Range Simultaneous Localization and Mapping," Drones, 2022: https://www.mdpi.com/2504-446X/6/11/312
- Range-SLAM, "Ultra-Wideband-Based Smoke-Resistant Real-Time Localization and Mapping," arXiv, 2024: https://arxiv.org/abs/2409.09763

