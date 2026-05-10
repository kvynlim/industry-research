# Kimera-Multi

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "validation", "runtime-localization"]
  reason: "Kimera-Multi is rated for robust or collaborative backend design in multi-session SLAM and validation."
method-priority:end -->

## Executive Summary

Kimera-Multi is a distributed multi-robot extension of the MIT-SPARK Kimera stack. Each robot runs local visual-inertial SLAM and metric-semantic meshing, then collaborates with peers through distributed place recognition, robust distributed pose graph optimization, and mesh deformation. The goal is a globally consistent, semantically annotated 3D mesh without relying on a central server.

The T-RO version frames Kimera-Multi as robust, distributed, dense metric-semantic SLAM for multi-robot systems. It combines local [Kimera-VIO](kimera-vio.md), distributed loop closure, robust distributed PGO using graduated non-convexity and distributed optimization, and local mesh optimization. The result is a reference architecture for teams that need both state estimation and a shared 3D map product.

Kimera-Multi should be read together with [Distributed Multi-Robot Pose Graph Optimization](distributed-multi-robot-pgo.md), [Kimera-RPGO and Pairwise Consistency Maximization](kimera-rpgo-pcm.md), and [Robust Pose Graph Optimization with GNC and riSAM](robust-pgo-gnc-risam.md).

## Method Class

- Distributed collaborative visual-inertial SLAM.
- Dense metric-semantic multi-robot mapping.
- Peer-to-peer place recognition and robust trajectory optimization.
- Mesh deformation after graph optimization.
- Research system built around the Kimera ecosystem.

## Method Summary

Each robot maintains local estimates:

```text
local trajectory
local visual-inertial keyframes
local 3D mesh
optional semantic labels on mesh faces
```

When robots can communicate, they exchange compact data for distributed place recognition. Inter-robot loop closures connect the local pose graphs. A robust distributed PGO backend estimates globally consistent trajectories while rejecting bad loop closures. Each robot then deforms its local mesh according to the optimized trajectory so the mesh aligns with the global solution.

The system is modular:

```text
local Kimera
  -> distributed loop closure detection
  -> robust distributed pose graph optimization
  -> local mesh optimization / deformation
  -> distributed metric-semantic mesh output
```

Kimera-Multi is important because it integrates three pieces that are often evaluated separately: collaborative trajectory estimation, outlier-robust inter-robot loop closure, and dense semantic map correction.

## Factor and State Representation

Core graph variables:

```text
X_i^a: pose of keyframe i for robot a
```

Factors:

```text
odometry / VIO edge:
  between X_i^a and X_(i+1)^a

intra-robot loop closure:
  between X_i^a and X_j^a

inter-robot loop closure:
  between X_i^a and X_j^b
```

Robust optimization uses switchable or graduated robust behavior conceptually:

```text
min_X,w sum odom ||e||^2
      + sum loop rho_mu( ||e_loop||^2 )
```

where the robust schedule reduces the influence of inconsistent loop closures. The distributed backend decomposes the pose graph by robot and communicates boundary variables or measurements needed by cross-robot factors.

The mesh is not optimized as a full volumetric state in the PGO. Instead, local mesh vertices/faces are corrected after trajectory optimization through mesh deformation tied to the optimized pose history.

## Front-End Mechanics

1. **Local visual-inertial estimation.** Each robot runs Kimera-style VIO to estimate local keyframe poses.

2. **Local meshing and semantics.** Each robot builds a local 3D mesh and can attach semantic labels from image segmentation.

3. **Communication trigger.** When communication is available, robots exchange information for place recognition.

4. **Distributed loop closure.** Candidate inter-robot loop closures are detected and geometrically checked.

5. **Outlier handling.** Incorrect inter-robot and intra-robot loop closures are handled by robust distributed optimization rather than blindly inserted.

6. **Trajectory update.** Optimized global trajectories are recovered in a common reference frame.

7. **Mesh deformation.** Each robot updates its local mesh using the corrected trajectory.

## Back-End Mechanics

Kimera-Multi's backend objective is collaborative PGO:

```text
min over all robot trajectories
  intra-robot odometry residuals
  + intra-robot loop residuals
  + inter-robot loop residuals
```

The distinguishing part is distribution and robustness:

- no single central optimizer is required;
- robots operate with local peer-to-peer communication;
- robust distributed GNC rejects perceptual-aliasing outliers;
- communication is designed to be parsimonious compared with sharing raw data or dense maps.

This is a map-level correction layer. High-rate control should continue to use each robot's local VIO/odometry frame, with a separate global correction transform applied to mapping, collaboration, and planning layers.

## Assumptions

- Each robot can run local VIO well enough to maintain a usable local trajectory.
- Robots observe enough common visual structure for inter-robot place recognition.
- Communication is intermittent but available often enough to exchange key loop-closure data.
- Inter-robot loop closures include enough correct constraints to connect the team graph.
- Semantic mesh quality depends on the segmentation model and camera coverage.
- Clock, frame, calibration, and robot identity conventions are consistent.

## Strengths

- Fully distributed architecture rather than a centralized server.
- Integrates dense metric-semantic mapping, not just sparse PGO.
- Robust to incorrect loop closures through distributed robust optimization.
- Modular enough to run without semantics or without dense reconstruction when needed.
- Good reference design for peer-to-peer robot teams.
- Demonstrated in simulation, public benchmarks, and outdoor robot datasets.

## Limitations

- Visual-inertial front ends can fail in low texture, blur, glare, darkness, or adverse weather.
- Dense semantic meshing increases compute and bandwidth requirements.
- Distributed optimization convergence depends on communication and graph connectivity.
- Inter-robot place recognition remains vulnerable to perceptual aliasing.
- The official repository is an index/integration project with ROS dependencies and research-system complexity.
- Production safety requires deterministic deployment, monitoring, fallback modes, and map-version controls beyond the paper.

## Datasets and Benchmarks

Kimera-Multi reports evaluation in:

- photorealistic simulation;
- SLAM benchmark datasets;
- challenging outdoor datasets with ground robots;
- MIT campus multi-robot datasets released with the project.

For independent evaluation, use:

- EuRoC/TUM-style VIO sequences for local front-end sanity checks;
- multi-session or multi-robot visual datasets for collaborative PGO;
- in-house campus, warehouse, or airside routes with repeated structures;
- map-quality checks for mesh consistency and semantic labeling.

Metrics:

- ATE/RPE per robot before and after collaboration;
- inter-robot frame alignment error;
- loop-closure inlier/outlier decisions;
- communication bytes per accepted constraint;
- mesh surface consistency before and after deformation;
- semantic mesh label accuracy if semantics are enabled.

## AV Relevance

Kimera-Multi is most directly relevant to fleets of small robots, drones, inspection robots, and mixed indoor/outdoor autonomous platforms. For road AVs, the architecture is more relevant to fleet map building than live vehicle control. For airside autonomy, it is a useful reference for multiple survey or service vehicles contributing to a shared terminal/apron map while preserving local autonomy during communication gaps.

For full-size AV stacks, LiDAR and radar front ends may be more robust than pure visual-inertial collaboration, but the backend pattern remains valuable:

```text
local autonomy first
compact inter-vehicle constraints
robust distributed graph optimization
map correction separate from control state
```

## Indoor and Outdoor Relevance

- **Indoor:** Strong for visually textured offices, labs, industrial spaces, and multi-robot inspection with semantic meshing.
- **Outdoor:** Demonstrated outdoors, but visual robustness and lighting/weather must be validated carefully.
- **Indoor/outdoor transitions:** Mesh deformation and robust PGO help, but exposure changes and feature scarcity can degrade VIO and loop closure.

## Integration Checklist

- Decide whether the deployment needs dense semantic meshes or only collaborative trajectories.
- Keep each robot's local estimator independent and fail-operational.
- Define robot IDs, frame naming, time sync, and global-frame selection before multi-robot tests.
- Use conservative inter-robot place-recognition gates.
- Validate robust loop closure on deliberately aliased environments.
- Track communication load per module: descriptors, loop closures, graph variables, mesh updates.
- Separate live odometry, global map frame correction, and mesh output.
- Add rollback/quarantine for suspicious inter-robot loop closures.
- Benchmark with disconnected, delayed, and partitioned communication.
- Audit ROS, GTSAM, Kimera, and Docker dependencies before production use.

## Related Repository Docs

- [Kimera-VIO](kimera-vio.md)
- [Kimera-RPGO and Pairwise Consistency Maximization](kimera-rpgo-pcm.md)
- [Distributed Multi-Robot Pose Graph Optimization](distributed-multi-robot-pgo.md)
- [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md)
- [Loop Closure and Place Recognition](loop-closure-place-recognition.md)
- [COVINS/COVINS-G](covins-covins-g.md)

## Sources

- Tian et al., "Kimera-Multi: Robust, Distributed, Dense Metric-Semantic SLAM for Multi-Robot Systems," arXiv, 2021 / IEEE T-RO, 2022: https://arxiv.org/abs/2106.14386
- Chang et al., "Kimera-Multi: a System for Distributed Multi-Robot Metric-Semantic Simultaneous Localization and Mapping," ICRA 2021: https://arxiv.org/abs/2011.04087
- Official Kimera-Multi repository: https://github.com/MIT-SPARK/Kimera-Multi
- Kimera repository: https://github.com/MIT-SPARK/Kimera
- Kimera-VIO repository: https://github.com/MIT-SPARK/Kimera-VIO
- Kimera-RPGO repository: https://github.com/MIT-SPARK/Kimera-RPGO
- Tian et al., "Resilient and Distributed Multi-Robot Visual SLAM: Datasets, Experiments, and Lessons Learned," arXiv, 2023: https://arxiv.org/abs/2304.04362

