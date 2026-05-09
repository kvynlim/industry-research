# D2SLAM

## Executive Summary

D2SLAM is a decentralized and distributed collaborative visual-inertial SLAM system for aerial swarms. The name refers to the combination of decentralized operation, with no required central node, and distributed computation, where the estimation work is split across robots rather than redundantly repeated everywhere.

The system addresses two different collaboration regimes. Near-field estimation provides accurate real-time relative localization when UAVs are close enough to share visual overlap and communicate at low latency. Far-field estimation provides globally consistent trajectories when UAVs are farther apart, out of line of sight, or communicating through weaker links. The 2024 IEEE T-RO version reports stereo and omnidirectional-camera support, ADMM-based distributed visual-inertial state estimation, and ARock-based asynchronous distributed pose graph optimization.

D2SLAM is best understood as a swarm-oriented counterpart to [Kimera-Multi](kimera-multi.md) and a decentralized alternative to server-based [COVINS/COVINS-G](covins-covins-g.md).

## Method Class

- Decentralized collaborative visual-inertial SLAM.
- Distributed near-field VIO and far-field PGO.
- Aerial swarm relative localization.
- Multi-camera/stereo front end with learned and geometric visual features.
- Dense mapping extension through RGB-D/TSDF integration.

## Method Summary

D2SLAM splits collaborative state estimation into:

```text
near-field:
  high-accuracy ego-motion and relative state for nearby UAVs
  visual overlap + good communication
  collaborative VINS sliding-window optimization

far-field:
  globally consistent trajectories over larger separations
  loop closure + distributed pose graph optimization
  resilient to weaker or delayed communication
```

The front end accepts stereo cameras or omnidirectional camera rigs. Omnidirectional vision is used to reduce field-of-view constraints in close-range aerial collaboration, where relative localization can fail if conventional cameras are not facing the same scene.

The backend uses:

- a distributed visual-inertial state estimator based on ADMM for near-field collaboration;
- asynchronous distributed PGO based on ARock for far-field consistency;
- map merging at runtime using relative measurements and reference-frame selection.

## Factor and State Representation

Near-field VINS state:

```text
X_i^a: pose of UAV a at keyframe i
v_i^a: velocity
b_i^a: IMU biases
landmark observations in sliding window
```

Near-field factors:

```text
IMU preintegration factor
visual reprojection factor
multi-view feature matching factor
multi-UAV shared landmark / relative observation factor
prior from marginalization
```

Far-field PGO state:

```text
G_i^a: keyframe pose for UAV a in the shared graph
```

Far-field factors:

```text
local odometry edge
intra-UAV loop edge
inter-UAV loop edge
map-merge relative transform
```

The system does not force every robot to share one dense landmark map. In compact modes, it shares descriptors and only sends more detailed keyframe information when needed for matching or state estimation.

## Front-End Mechanics

1. **Camera preprocessing.** Stereo or quad-fisheye/omnidirectional images are rectified or reprojected into usable views.

2. **Feature extraction.** The paper describes global descriptors for retrieval and SuperPoint-style sparse features for matching, with LK-tracked features used for robust ego-motion.

3. **Keyframe selection.** New keyframes are selected based on parallax and feature conditions.

4. **Multi-UAV feature matching.** Nearby UAVs exchange keyframe data when predicted to be close enough and communication allows.

5. **Distributed loop closure.** Compact descriptors support loop detection without always broadcasting full keyframe data.

6. **Relative pose extraction.** PnP/RANSAC and multi-camera refinement estimate loop or inter-UAV relative pose constraints.

7. **Degradation.** If features or communication are insufficient, the system degrades toward standalone VIO.

## Back-End Mechanics

Near-field state estimation is a collaborative VINS problem solved in a distributed manner. Conceptually:

```text
min sum IMU residuals
  + sum visual residuals
  + sum cross-UAV feature residuals
  + priors
```

The distributed formulation uses ADMM-like consensus so robots exchange only necessary boundary/consensus information rather than centralizing all landmarks and states.

Far-field estimation is distributed PGO:

```text
min sum local odometry residuals
  + sum loop closure residuals
  + sum inter-UAV relative pose residuals
```

D2SLAM uses an asynchronous distributed optimization approach based on ARock so robots can update with stale or delayed neighbor information, which better matches ad hoc aerial networks.

The near-field and far-field modules feed each other. Far-field PGO can initialize relative frames when robots meet, while near-field VINS and loop detection provide constraints for PGO.

## Assumptions

- UAVs have enough compute for visual-inertial front-end processing.
- Close-range relative localization requires visual overlap, line of sight, and adequate communication.
- Omnidirectional cameras reduce but do not eliminate field-of-view and feature-availability constraints.
- Far-field consistency requires enough valid loop or inter-UAV constraints.
- Wireless ad hoc communication has bounded enough delay for asynchronous convergence.
- Visual features are present; open, textureless, reflective, or dark spaces degrade performance.

## Strengths

- Designed for aerial swarms rather than static multi-session mapping alone.
- Separates close-range relative accuracy from long-range global consistency.
- Decentralized design avoids dependence on a single server.
- Distributed computation improves scalability compared with redundant decentralized optimization.
- Supports stereo and omnidirectional camera configurations.
- Explicit degradation to standalone VIO improves operational robustness.

## Limitations

- Visual dependence is risky in low texture, glare, night, rain, fog, and fast motion blur.
- Near-field relative accuracy depends on common visual features and line of sight.
- Learned feature/descriptors and GPU acceleration create deployment complexity.
- Communication logic is more complex than centralized systems.
- Dense mapping is an extension, not the core estimator.
- The system is tuned for UAV swarms; ground AV integration requires rethinking sensors, dynamics, and compute budgets.

## Datasets and Benchmarks

The official repository and paper discuss:

- custom aerial swarm datasets;
- HKUST RI multi-drone scenarios;
- TUM-style single-robot evaluation modes;
- real experiments on aerial platforms;
- support tooling to emulate multi-robot datasets on one PC.

Metrics:

- ego-motion ATE/RPE;
- near-field relative pose error between UAVs;
- global trajectory consistency after distributed PGO;
- convergence under network delay;
- communication volume in compact vs greedy modes;
- failure/degradation rate under missing overlap or feature-poor scenes.

## AV Relevance

D2SLAM is most relevant to drone swarms, cooperative inspection, and airspace/warehouse teams. For ground AVs, the architectural lesson is more important than the exact visual front end:

```text
local estimator remains autonomous
nearby vehicles exchange richer relative-localization data
farther vehicles exchange compact loop/pose graph data
distributed backend tolerates network delay
```

For airside autonomy, D2SLAM is relevant to drone inspection around terminals, hangars, and aircraft stands. For ground service vehicles, LiDAR/radar/GNSS fusion would likely replace much of the visual-only collaboration.

## Indoor and Outdoor Relevance

- **Indoor:** Strong fit for drone swarms in warehouses, labs, and industrial inspection when visual features and wireless communication are good.
- **Outdoor:** Good for aerial platforms with sufficient texture and lighting; weather and glare are major risks.
- **Mixed:** The near-field/far-field split is useful for robots moving between confined indoor spaces and open outdoor regions, but front-end exposure and feature changes must be monitored.

## Integration Checklist

- Decide whether the mission needs near-field relative localization, far-field map consistency, or both.
- Choose stereo for lower compute and simpler deployment; choose omnidirectional rigs when field of view is the limiting factor.
- Define communication modes and bandwidth budgets before tuning SLAM thresholds.
- Keep standalone VIO stable before enabling collaboration.
- Validate multi-UAV feature matching with deliberate viewpoint, yaw, and lighting changes.
- Test delayed, dropped, and partitioned network conditions.
- Separate control-frame odometry from global graph corrections.
- Log map-merge decisions and reference-frame changes.
- Audit GPU/CUDA, ROS, Docker, and embedded deployment constraints.
- For non-UAV AVs, replace visual constraints with LiDAR/radar/range factors where appropriate.

## Related Repository Docs

- [Distributed Multi-Robot Pose Graph Optimization](distributed-multi-robot-pgo.md)
- [Kimera-Multi](kimera-multi.md)
- [COVINS/COVINS-G](covins-covins-g.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [Loop Closure and Place Recognition](loop-closure-place-recognition.md)
- [UWB and Radio Ranging SLAM](uwb-radio-ranging-slam.md)

## Sources

- Xu, Liu, Chen, and Shen, "D2SLAM: Decentralized and Distributed Collaborative Visual-inertial SLAM System for Aerial Swarm," arXiv, 2022-2024: https://arxiv.org/abs/2211.01538
- Official D2SLAM repository: https://github.com/HKUST-Aerial-Robotics/D2SLAM
- IEEE T-RO record cited by the official repository, 2024: https://doi.org/10.1109/TRO.2024.3422003
- HKUST Aerial Robotics group: https://uav.hkust.edu.hk/

