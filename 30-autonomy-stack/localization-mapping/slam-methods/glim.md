# GLIM

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "GLIM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [GLIM and GTSAM Pipeline Hub](glim-gtsam-pipeline-hub.md), [GTSAM and iSAM2](factor-graph-isam2-gtsam.md), [GICP and VGICP](gicp-vgicp.md), [LiDAR Bundle-Adjustment Factors](lidar-bundle-adjustment-factors.md), [LIO-SAM](lio-sam.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [KISS-ICP](kiss-icp.md), [CT-ICP](ct-icp.md), [Open-Source SLAM Stack Comparison](open-source-stack-comparison.md), [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md), [Probabilistic Graphical Models and Message Passing](../../../10-knowledge-base/probability-statistics/probabilistic-graphical-models-message-passing.md), [Eigenvalues, Hessian Conditioning, and Observability](../../../10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md), [Sparse Estimation Backend Crosswalk](../../../10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md), and [Nonlinear Solver Diagnostics Crosswalk](../../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md).

## Executive Summary

GLIM is a modern, open-source 3D range-inertial localization and mapping framework focused on accurate map building with direct scan-matching factors on factor graphs. It is best understood as a complete research and prototyping SLAM/mapping stack, not just an optimizer and not merely a LiDAR odometry front end.

Its distinguishing idea is to replace the usual "estimate pairwise scan matches, then optimize relative pose constraints" pattern with GPU-accelerated registration-error factors that can be optimized directly in GTSAM-style factor graphs. In odometry, GLIM uses fixed-lag smoothing and keyframe-based multi-scan matching. In global mapping, it optimizes submap poses by directly minimizing matching costs between overlapping submaps.

For autonomous vehicles, GLIM is most useful for survey mapping, offline map refinement, research on robust range-inertial SLAM, and prototyping factor-graph localization extensions. It is less likely to be the production online localization stack unchanged, because production AV localization usually needs deterministic latency, map versioning, safety monitors, dynamic-object handling, calibrated covariance outputs, localization against a frozen map, and integration with GNSS, wheel odometry, IMU, perception, and fleet map operations.

## What It Is

GLIM is a versatile and extensible range-based 3D localization and mapping framework by Koide, Yokozuka, Oishi, and Banno. The paper title is "GLIM: 3D Range-Inertial Localization and Mapping with GPU-Accelerated Scan Matching Factors."

The official repository describes GLIM as a range-based 3D mapping framework designed for accuracy, ease of use, sensor versatility, and extensibility. It supports many range sensor types, including spinning LiDAR, non-repetitive LiDAR, solid-state LiDAR, RGB-D cameras, and other depth sensors, provided the sensor setup and calibration are handled correctly.

GLIM uses:

- GTSAM as the factor-graph optimization backend.
- `gtsam_points` for point-cloud SLAM factors, scan-matching factors, GPU VGICP factors, nearest-neighbor structures, and related optimizers.
- Optional CUDA for GPU-accelerated scan matching and global mapping.
- ROS 2 integration through `glim_ros2`.
- Offline viewer and map editor tools for manual loop creation, map correction, point removal, point-cloud export, and multi-session merging.
- Extension modules and global callback slots for adding constraints or accessing internal mapping state.

## Why It Matters

Most practical LiDAR SLAM systems separate the problem into a fast local odometry front end and a global pose-graph backend. That architecture is efficient, but it often compresses scan matching into relative pose measurements with approximate covariances. In difficult cases, such as small-overlap loops, degenerate point clouds, or changing sensor geometry, that approximation can be weak.

GLIM matters because it pushes direct registration cost into the graph itself:

```text
Instead of:
  scan matching -> relative pose + covariance -> pose graph optimization

GLIM emphasizes:
  point-cloud registration error factors -> direct graph optimization
```

This is computationally heavier, but GLIM makes it practical with GPU-accelerated factor evaluation and a system design that keeps odometry, local mapping, and global mapping organized as separate modules.

For AV mapping, this matters because mapping quality is often dominated by accumulated alignment errors, loop-closure quality, and the ability to repair or refine maps offline. GLIM is closer to an advanced mapping workbench than a minimal odometry package.

## Pipeline Spine

Use GLIM as a layered pipeline, not as one monolithic "SLAM algorithm." Each layer has a different state, factor set, artifact, and diagnostic signal.

| Layer | Main job | GLIM mechanism | Output artifact | What to inspect |
|---|---|---|---|---|
| Sensor ingestion | Bring range, IMU, and optional image streams into one time base | ROS 2 node or rosbag reader, sensor config, `T_lidar_imu`, topic config | Timestamped frames and sensor states | Topic timing, dropped scans, IMU rate, extrinsic direction |
| Preprocessing | Make point clouds usable for matching | Downsampling, deskewing or continuous-time path depending config, nearest-neighbor structures | Preprocessed frame cloud | Sharpness of poles/edges, outlier ratio, voxel density |
| Odometry estimation | Estimate short-horizon motion | Fixed-lag factor graph with scan-matching and IMU factors | `odom_imu.txt`, `odom_lidar.txt`, local trajectory | Per-frame residuals, smoother lag, weak geometry modes |
| Submapping | Group locally optimized frames into map chunks | Submap creation from optimized local frames | Submap graph and local point-cloud chunks | Submap overlap, local map sharpness, dynamic clutter |
| Global mapping | Correct long-range drift and align submaps | Submap factor graph with direct matching-cost factors and IMU constraints | `traj_imu.txt`, `traj_lidar.txt`, globally corrected map | Loop residuals, Hessian conditioning, graph jumps |
| Offline correction | Repair failures and produce map artifacts | Offline viewer, manual loop factors, plane BA constraints, map editor, point removal | Corrected dump, exported PLY map | Before/after residuals, edited-object provenance |
| Multi-session merge | Combine repeated mapping sessions | Manual alignment, fine registration, global matching-cost fusion | Merged map and trajectory set | Cross-session drift, common anchor consistency |
| Extension layer | Add domain-specific constraints | Global callback slots and extension modules | Custom factors and monitoring hooks | Thread safety, factor covariance, update timing |

The important design distinction is that odometry and global mapping are related but not the same product. Odometry should be stable and causal enough to support mapping. Global mapping may apply larger corrections after submap alignment, loop verification, or manual repair. A production vehicle control stack must not blindly consume global map jumps as its real-time control pose.

## Core Idea

GLIM formulates 3D range-inertial SLAM as factor-graph optimization with scan-matching factors that directly evaluate point-cloud registration error.

The main technical ideas are:

- **Direct multi-scan registration:** optimize scan or submap alignment by minimizing registration errors, not only precomputed relative-pose residuals.
- **GPU-accelerated scan-matching factors:** evaluate and linearize many point-cloud matching costs efficiently on GPU.
- **Voxelized GICP-style matching:** use distribution-to-distribution point/voxel alignment with voxel-based association.
- **Fixed-lag smoothing odometry:** keep recent states active for a few seconds instead of immediately freezing each state like a filter.
- **Keyframe-based point-cloud matching:** connect the latest frame to selected past keyframes to reduce drift.
- **Global submap optimization:** create submaps, then optimize their poses with global matching cost minimization.
- **Tightly coupled inertial constraints:** use IMU factors in odometry and global mapping to stabilize pose estimation, especially gravity-related degrees of freedom.
- **Extensibility:** add custom constraints, callbacks, visual features, GNSS factors, loop detectors, or other modules through extension points.

## Graph Anatomy

GLIM's graph structure is best understood through two connected estimation problems: the odometry graph and the global mapping graph.

### Odometry graph

The odometry graph is a fixed-lag smoother over recent frames. It keeps only a bounded time window active so recent states can be relinearized and corrected without turning every frame into a full batch problem.

Typical variables:

```text
X(i): IMU pose, usually T_odom_imu, stored as gtsam::Pose3
V(i): IMU velocity in the odometry frame, stored as gtsam::Vector3
B(i): IMU bias, stored as gtsam::imuBias::ConstantBias
```

Typical factors:

```text
prior(X0, V0, B0)
imu_preintegration(X(i), V(i), B(i), X(i+1), V(i+1), B(i+1))
scan_matching(X(i), X(j), local frame or keyframe point clouds)
bias_random_walk(B(i), B(i+1))
optional extension factors from callbacks
```

LiDAR-only continuous-time configurations are different: they may not create velocity and bias variables, and the pose variable may represent the LiDAR pose directly. That matters when adding custom factors because a callback factor must attach to variables that actually exist in the active window.

### Global mapping graph

The global graph lifts the problem from frame-level motion to submap-level consistency.

Typical variables:

```text
X(k): submap pose, usually T_world_submap, stored as gtsam::Pose3
V(2k), V(2k+1): endpoint velocities when IMU constraints are active
B(2k), B(2k+1): endpoint biases when IMU constraints are active
```

Typical factors:

```text
submap_prior(X0)
relative or direct matching-cost factors between overlapping submaps
IMU constraints across submap endpoints
explicit loop factors created by the offline viewer
plane bundle-adjustment constraints created by the offline viewer
custom GNSS/GCP/map-anchor factors if added through extensions
```

This is why GLIM is different from a plain pose graph. A classical pose graph often optimizes compact relative-pose residuals:

```text
e_ij = Log(Z_ij^-1 * X_i^-1 * X_j)
```

GLIM's stronger pattern is to keep point-cloud registration error in the factor evaluation path:

```text
cost_ij(X_i, X_j) = sum over point/voxel correspondences of matching_cost(T_i, T_j, cloud_i, cloud_j)
```

That direct cost keeps the backend closer to the geometry that produced the constraint. The tradeoff is heavier evaluation, stronger dependence on initialization and correspondences, and more need for GPU acceleration.

## Factor Semantics

The following table is the practical map from GLIM concepts to GTSAM and knowledge-base foundations.

| GLIM concept | GTSAM / math object | What it means | Main KB topic |
|---|---|---|---|
| Pose, velocity, bias variables | `Values` keyed by `X(i)`, `V(i)`, `B(i)` | The current assignment for unknown states | [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) |
| Scan-matching factor | `NoiseModelFactor`-style nonlinear factor, implemented through `gtsam_points` | A geometric likelihood from point-cloud registration residuals | [GICP and VGICP](gicp-vgicp.md) |
| IMU factor | IMU preintegration factor | High-rate inertial data compressed between graph states | [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md) |
| Fixed-lag smoother | Marginalization and sliding active set | Old states leave the active window and become priors on remaining states | [Sparse Estimation Backend Crosswalk](../../../10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md) |
| Global submap graph | Sparse nonlinear least-squares problem | Submap poses are optimized against geometric matching and inertial constraints | [Factor Graph Solver Patterns](../../../10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md) |
| Hessian / information matrix | `H = J^T J` or `J^T Sigma^-1 J` | Local curvature and observability of the current graph | [Eigenvalues, Hessian Conditioning, and Observability](../../../10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md) |
| Bayes tree / iSAM2 | Incremental factorization structure | Efficiently updates affected cliques instead of solving the whole graph every time | [GTSAM and iSAM2](factor-graph-isam2-gtsam.md) |
| Loop factor | Long-range constraint | Revisits or manual matches reduce drift but can corrupt the map if false or overweighted | [Robust PGO / GNC / riSAM](robust-pgo-gnc-risam.md) |
| Manual plane BA factor | Geometric surface constraint | Human-added plane consistency factor to repair map geometry | [Objective and Residual Design Audit](../../../10-knowledge-base/optimization/objective-residual-design-and-audit.md) |

## GTSAM, Bayes Nets, And Hessians

GTSAM's name is "Smoothing and Mapping" because it estimates a trajectory or map state using all relevant measurements in a sparse posterior, not only the latest state. The probability model can be drawn as a Bayesian network, but GTSAM works most naturally with the equivalent factor graph:

```text
Bayesian-network view:
  p(x_0:T, z_1:T) = p(x_0) product_t p(x_t | x_{t-1}) p(z_t | x_t)

Factor-graph view:
  p(X | Z) proportional_to product_i phi_i(X_i)

Least-squares view:
  X* = argmin_X sum_i 0.5 * ||r_i(X_i)||^2_Sigma_i
```

For GLIM, this translation is concrete:

- `p(x_t | x_{t-1})` becomes IMU, motion, or scan-matching transition factors.
- `p(z_t | x_t)` becomes range-data matching factors against keyframes, submaps, or a map.
- Loop closures add non-Markov factors between distant submaps.
- Manual constraints add human-verified factors after inspecting the map.

After linearization, each factor contributes Jacobian blocks. The backend builds a local system:

```text
min_delta 0.5 ||J delta + r||^2
H delta = -g
H = J^T J
g = J^T r
```

For whitened residuals, `H` is the local information matrix. In GLIM diagnostics, the small eigenvalues and eigenvectors of this Hessian tell you which motion directions are weakly constrained. On a flat apron, for example, ground returns may constrain height, roll, and pitch while leaving yaw and horizontal translation weak. A low scalar matching cost does not remove that observability limit.

The Bayes tree matters when the graph is updated incrementally. New scan-matching, IMU, loop, or manual factors affect only part of the graph. iSAM2 updates the affected cliques, relinearizes variables whose estimates changed enough, and preserves sparse structure where possible. That is the computational reason factor graphs can be practical in online SLAM, and the same idea explains why false loop closures can cause compute spikes or large map corrections.

## Pipeline

1. Receive range data, IMU data, and optional camera/image inputs.
2. Preprocess point clouds with downsampling and nearest-neighbor preparation.
3. Deskew or motion-compensate point clouds using inertial prediction when applicable.
4. Build an odometry factor graph over recent frames.
5. Add IMU preintegration factors between consecutive states.
6. Add GPU scan-matching factors between the latest frame and selected keyframes.
7. Run fixed-lag smoothing so recent states can still be corrected.
8. Create local submaps from optimized local frames.
9. Add submap-level scan-matching factors for global consistency.
10. Run global trajectory optimization over submaps.
11. Export trajectories and map data.
12. Use the offline viewer or map editor for manual loop closure, plane constraints, map cleanup, point removal, PLY export, or multi-session merging.

GLIM separates odometry estimation, local mapping, and global mapping, but the modules are designed as one integrated process for efficiency.

## Artifact Contract

Treat every GLIM run as producing both numeric estimates and audit artifacts.

| Artifact | Meaning | Use |
|---|---|---|
| `odom_imu.txt` | IMU-frame odometry before global loop correction | Inspect local drift and real-time odometry behavior |
| `odom_lidar.txt` | LiDAR-frame odometry before global loop correction | Compare sensor-frame trajectory and map export alignment |
| `traj_imu.txt` | IMU-frame trajectory after global mapping | Use for globally corrected map reconstruction and evaluation |
| `traj_lidar.txt` | LiDAR-frame trajectory after global mapping | Use for point-cloud export and downstream map QA |
| Dump directory | Graph, submaps, trajectory, and mapping state | Reopen in offline viewer for loops, planes, edits, exports |
| Exported PLY | Dense point-cloud map artifact | Feed map QA, localization-map construction, meshing, or digital twin pipelines |

For production-style map work, the dump is more valuable than a final point cloud alone. It preserves enough context to audit loop constraints, remove objects, adjust map corrections, and reproduce export decisions.

## Where It Fits

GLIM fits in the SLAM stack as a full 3D range-inertial mapping framework:

```text
Sensors:
  LiDAR / depth / range camera + IMU + optional cameras

Front end:
  direct scan matching, keyframes, fixed-lag smoothing

Backend:
  GTSAM-based factor graphs with gtsam_points scan-matching factors

Map layer:
  submaps, dense point-cloud outputs, offline correction tools

Best use:
  research, mapping, offline refinement, prototyping advanced factor constraints
```

It should not be confused with GTSAM. GTSAM is a general C++ factor-graph library. GLIM is an application-level SLAM system that uses GTSAM and `gtsam_points` to solve range-inertial mapping problems.

It should also not be confused with FAST-LIO, LIO-SAM, or KISS-ICP:

- FAST-LIO/FAST-LIO2 are fast tightly coupled LiDAR-inertial odometry systems using filtering-style estimation. They are strong online odometry front ends.
- LIO-SAM is a factor-graph LiDAR-inertial SLAM system with LOAM-style features, IMU preintegration, GPS factors, and loop closure.
- KISS-ICP is a simple LiDAR-only odometry baseline built around point-to-point ICP and a local voxel map.
- GLIM is heavier, more globally optimized, and more map-workflow-oriented, with GPU scan-matching factors and offline correction tooling.

## Strengths

- Strong mapping orientation: submap optimization, loop refinement, manual correction, and multi-session workflows are first-class concerns.
- Direct registration costs avoid relying only on approximate relative-pose constraints.
- Fixed-lag smoothing can recover from short periods of geometric degeneracy better than purely causal scan-to-model pipelines.
- Supports a broad class of range sensors rather than being tied to one mechanical LiDAR pattern.
- GPU acceleration makes computationally expensive multi-scan and submap matching practical.
- Built on GTSAM, making the graph structure familiar to robotics researchers.
- `gtsam_points` exposes reusable point-cloud factors and optimizers beyond GLIM itself.
- Extension modules make it suitable for research on GNSS, visual constraints, loop detection, velocity constraints, calibration checks, or domain-specific factors.
- Offline viewer and map editor are valuable for real mapping operations where fully automatic SLAM is not enough.

## Knowledge-Base Reading Path

Read GLIM through this sequence when the goal is to understand the full pipeline:

| Question | Read |
|---|---|
| Where is the compact cross-section hub for the whole GLIM/GTSAM pipeline? | [GLIM and GTSAM Pipeline Hub](glim-gtsam-pipeline-hub.md) |
| What is the probability model behind a SLAM graph? | [Probabilistic Graphical Models and Message Passing](../../../10-knowledge-base/probability-statistics/probabilistic-graphical-models-message-passing.md) |
| How does GTSAM represent variables, factors, and nonlinear optimization? | [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) |
| How does a factor graph become a MAP least-squares problem? | [Likelihood, MAP, MLE, and Least Squares](../../../10-knowledge-base/probability-statistics/likelihood-map-mle-least-squares.md) and [Nonlinear Least Squares from First Principles](../../../10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md) |
| How should factor noise, covariance, information, and whitening be interpreted? | [Gaussian Noise, Covariance, Information, Whitening, and Uncertainty Ellipses](../../../10-knowledge-base/probability-statistics/gaussian-noise-covariance-information.md) and [Square-Root Information and Covariance Recovery](../../../10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md) |
| How do pose updates work on SE(3) instead of ordinary vector space? | [Lie Groups SE(3), SO(3), Adjoints, and Jacobians](../../../10-knowledge-base/geometry-3d/lie-groups-se3-so3-jacobians.md) and [Jacobians, Autodiff, and Manifold Linearization](../../../10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md) |
| Which nonlinear step is being taken: Gauss-Newton, LM, or Dogleg? | [Gauss-Newton, Levenberg-Marquardt, and Dogleg](../../../10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md) |
| How does iSAM2 update a graph incrementally? | [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md) |
| What are the point-cloud residuals GLIM relies on? | [GICP and VGICP](gicp-vgicp.md) and [LiDAR Bundle-Adjustment Factors](lidar-bundle-adjustment-factors.md) |
| How do IMU factors stabilize deskew, velocity, bias, and poor LiDAR geometry? | [IMU Error Models and Preintegration](../../../10-knowledge-base/state-estimation/imu-error-models-preintegration.md) |
| Why do weak geometric scenes break scan matching? | [Eigenvalues, Hessian Conditioning, and Observability](../../../10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md) |
| What happens inside sparse elimination and variable ordering? | [Sparse Matrices, Fill-In, and Ordering](../../../10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md), [Cholesky, LDLT, and Normal Equations](../../../10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md), and [QR, SVD, and Rank-Revealing Solvers](../../../10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md) |
| What happens when old states leave a fixed-lag window? | [Sparse Estimation Backend Crosswalk](../../../10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md) and [Schur Complement, Marginalization, and PCG](../../../10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md) |
| How do gauges, nullspaces, and fake certainty show up in SLAM/VIO? | [SLAM/VIO Observability, FEJ, Nullspace, and Consistency](../../../10-knowledge-base/state-estimation/slam-vio-observability-fej-nullspace-consistency.md) |
| How should false loops, dynamic points, and GNSS jumps be handled? | [Robust Losses and M-Estimators](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) and [Robust Statistics, RANSAC, and Hypothesis Testing](../../../10-knowledge-base/probability-statistics/robust-statistics-ransac-hypothesis-testing.md) |
| How do I debug a converged but wrong map? | [Nonlinear Solver Diagnostics Crosswalk](../../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md) and [Objective and Residual Design Audit](../../../10-knowledge-base/optimization/objective-residual-design-and-audit.md) |

This reading path is intentionally broader than GLIM. GLIM is the application layer; the reason it works is the interaction among probabilistic graphical models, sparse nonlinear least squares, LiDAR registration residuals, and state-estimation observability.

The shortest mental model is:

```text
sensor packets
  -> motion-compensated range data and IMU increments
  -> residual factors with covariance/noise models
  -> GTSAM nonlinear graph over poses, velocities, biases, and submap poses
  -> tangent-space linearization
  -> sparse Jacobian/Hessian/Bayes-tree solve
  -> updated trajectory, submaps, marginals, diagnostics, and exported map artifacts
```

If the pipeline is being audited, track each GLIM artifact back to a GTSAM layer. A trajectory jump is usually a factor, initialization, robust-kernel, loop-closure, or marginalization issue. A Cholesky exception is usually a gauge, rank, ordering, or bad-Hessian issue. A locally smooth but globally warped map is often a weak prior, false loop, bad covariance, or unmodeled dynamic-object issue.

## Limitations

- GPU acceleration is central to GLIM's practical value; CPU-only configurations exist but may not deliver the same throughput or mapping quality.
- The stack is more complex than minimal odometry systems and has more integration surface: GTSAM, `gtsam_points`, CUDA, ROS 2, sensor calibration, configuration files, and visualization tools.
- Fixed-lag smoothing only protects against degeneration within the optimization window. Long-term range-data degeneracy still needs another source such as camera, radar, wheel odometry, GNSS, or a motion prior.
- Direct scan-matching factors can still fail when geometry is dynamic, repetitive, sparse, reflective, or dominated by moving objects.
- Offline correction is a strength for mapping, but it also signals that production map generation may require human-in-the-loop QA.
- The open-source extension modules are examples or proofs of concept and may carry separate maintenance and license considerations.
- Dense maps and submap graphs can become heavy at city or fleet scale; large-scale production mapping may need distributed optimization, tiling, map versioning, and cloud processing around GLIM.
- It is not a drop-in safety-certified localization component.

## AV Relevance

For autonomous vehicles, GLIM is most relevant in four roles:

1. **Survey mapping and HD-map construction:** GLIM's dense point-cloud mapping, submap optimization, manual correction, and multi-session merge tools are useful for building high-quality 3D maps from repeated drives.
2. **Research baseline:** It is a strong method to compare against FAST-LIO2, LIO-SAM, KISS-ICP, CT-ICP, Cartographer 3D, and LiDAR bundle-adjustment methods when evaluating mapping accuracy and robustness.
3. **Prototyping factor-graph localization:** Because it exposes callback slots and uses GTSAM-style variables, it is a practical environment for adding GNSS, wheel odometry, map priors, camera constraints, loop detectors, or custom vehicle-motion factors.
4. **Offline refinement:** GLIM is well suited to post-processing recorded routes, repairing failed loops, removing transient objects, and exporting cleaned maps.

For production AV online localization, GLIM should usually be treated as a component or reference implementation rather than the full answer. A production stack normally needs:

- Localization against a frozen, versioned prior map.
- Bounded-latency pose output independent of global optimization jumps.
- Robust dynamic-object filtering.
- Covariance calibration and health metrics.
- GNSS/INS/wheel odometry fusion with gating.
- Degradation modes and fallback estimators.
- Integration with map release, QA, and fleet data pipelines.
- Operational monitoring and replayable safety evidence.

A practical AV architecture may use GLIM offline to build maps, then use a leaner online scan-to-map localizer or fusion backend for vehicle operation.

## Indoor/Outdoor Notes

**Indoor:** GLIM is strong for corridors, warehouses, campuses, tunnels, stairs, labs, industrial spaces, and mixed indoor/outdoor trajectories. Its surface-orientation validation and multi-resolution voxel maps are especially relevant indoors where thin walls, opposite wall faces, and tight geometry can cause wrong correspondences.

**Outdoor:** GLIM is relevant for urban roads, campuses, industrial yards, ports, mines, airports, and large facilities where submap optimization and loop closure matter. Outdoor use benefits from rich structure such as buildings, poles, curbs, walls, vegetation, and parked assets.

**Open areas:** Large aprons, fields, highways, ramps, and sparse lots can still be geometrically underconstrained. IMU helps, but long-term degeneration needs additional constraints such as RTK-GNSS, wheel odometry, camera/radar factors, map priors, or surveyed control points.

**Dynamic scenes:** Vehicles, aircraft, pedestrians, baggage carts, forklifts, and temporary equipment can pollute maps. GLIM's map editor helps remove objects offline, but online dynamic-object handling must be solved upstream or through extensions.

## Comparison

| Method | Main role | Estimation style | Map/global correction | AV interpretation |
|---|---|---|---|---|
| GLIM | Range-inertial 3D SLAM and mapping framework | Factor graph with direct scan-matching factors | Strong submap/global optimization and offline tools | Excellent mapping/research stack; production localization needs wrapping |
| GTSAM | Optimization library | Generic factor graphs | Not a SLAM system by itself | Backend building block, not a localization product |
| `gtsam_points` | Point-cloud SLAM factors and optimizers | GTSAM-compatible scan-matching factors | Supports GLIM and related experiments | Useful library for custom LiDAR/range graph systems |
| FAST-LIO2 | Real-time LiDAR-inertial odometry | Iterated Kalman filtering, scan-to-map | No full mapping workbench by default | Strong online odometry front end |
| LIO-SAM | LiDAR-inertial SLAM | GTSAM factor graph with feature scan matching | Loop closure and GPS factors | Clear educational/reference architecture |
| KISS-ICP | LiDAR-only odometry | Simple ICP against local map | No loop closure in core | Strong baseline/fallback odometry |
| Cartographer 3D | Submap SLAM | Local scan matching plus pose graph | Mature submap loop closure, older stack | Useful reference/offline mapper, less modern as LIO front end |

## Evaluation

The GLIM paper evaluates robustness under degenerate range data, cross-sensor mapping, Newer College sequences, and NTU VIRAL-style LiDAR/visual-inertial datasets. Reported comparisons include FAST-LIO2, LIO-SAM, LINS, CLINS, DLO, VoxelMap, BALM, SLICT, and visual-LiDAR-inertial methods.

Evaluation dimensions that matter for AV use:

- Absolute trajectory error against survey-grade ground truth, RTK/INS, motion capture, or control points.
- Relative trajectory error over fixed path lengths.
- Drift per kilometer and per minute.
- Map consistency after loop closure.
- Submap alignment error before and after global optimization.
- Runtime per frame and per submap on target hardware.
- GPU memory and CPU/GPU utilization.
- Failure behavior under long open-road or apron-like degeneracy.
- Robustness to dynamic objects and temporary infrastructure.
- Repeatability across different vehicle speeds, LiDAR models, weather, and traffic conditions.
- Localization impact when using GLIM-generated maps in a separate online localizer.

Solver and graph diagnostics to record:

- Per-factor raw and whitened residual histograms for scan-matching, IMU, loop, plane, GNSS, or custom factors.
- Final cost by factor family, not only total graph cost.
- Hessian or approximate information eigenvalues for odometry windows and global submap solves.
- Weak eigenvectors grouped by pose/velocity/bias/submap variable so degeneracy is interpretable.
- Accepted step size, predicted-vs-actual reduction, and damping or trust-region state when available.
- iSAM2 or fixed-lag update time distribution, especially after adding loop or manual factors.
- Marginal covariance queries for key poses or submaps, interpreted with gauge and anchor policy documented.
- Factor insertion and removal events when variables leave the fixed-lag window.

For airport or industrial-yard AVs, add:

- Lateral error against surveyed lane centerlines.
- Yaw error during docking or stand approach.
- Map cleanliness after removing aircraft, vehicles, and temporary objects.
- Cross-session consistency across different days and traffic states.
- GNSS-denied or GNSS-multipath performance near buildings, hangars, terminals, and jet bridges.

## Implementation Notes

- Use the ROS 2 path first for current integration; `glim_ros2` is the active ROS integration.
- CUDA is optional in the build, but GLIM's headline performance depends on GPU acceleration.
- Official docs list Ubuntu 22.04/24.04, CUDA 12.x/13.x options, and NVIDIA Jetson Orin testing.
- Build and version alignment matter: GLIM depends on compatible GTSAM and `gtsam_points` versions.
- Keep `BUILD_WITH_MARCH_NATIVE` conservative unless all dependent libraries are built consistently.
- Sensor extrinsics are critical. Range sensor, IMU, and camera transforms must be known and stable.
- For ROS 2 configuration, manage config paths carefully; installed package configs may require rebuilds unless using symlink install or external config paths.
- GLIM writes dump data and trajectory files that can be inspected and edited offline.
- The offline viewer can create explicit loop constraints, plane bundle-adjustment constraints, and export map point clouds.
- The map editor can remove selected points or segmented objects, useful for cleaning dynamic objects before map release.
- Multi-session merge supports indoor and outdoor registration presets, manual alignment, fine registration, and global matching cost fusion.
- Extension callbacks run across odometry, submapping, and global mapping threads, so extension modules must be thread-safe.
- For AV deployments, isolate global map optimization from the control pose stream. Global optimization corrections are useful for mapping, but online vehicle control needs a stable localization frame with explicit correction handling.

## Failure-Triage Checklist

Use this checklist when GLIM produces a map that looks wrong, jumps after correction, or appears overconfident.

| Symptom | First suspect | Evidence to inspect | Likely fix |
|---|---|---|---|
| Curved poles or smeared edges | Time sync, deskew, extrinsics | Residual by scan azimuth, IMU timing, `T_lidar_imu` direction | Recalibrate timing/extrinsics before tuning graph weights |
| Good local map, bad loop closure | False loop or poor loop covariance | Before/after loop residuals, alignment overlay, robust weights | Reject loop, weaken covariance, add geometric verification |
| Low cost but wrong open-area pose | Observability weakness | Hessian eigenvectors, valid correspondence distribution, height-band coverage | Inflate weak modes, add GNSS/GCP/wheel/map anchors |
| Cholesky or solve instability | Gauge, rank, bad Jacobian, poor scaling | Factorization warning, rank spectrum, whitened residual magnitudes | Check priors, covariance units, factor Jacobians, robust loss placement |
| Offline correction improves view but hurts metric QA | Objective mismatch | Survey residuals, held-out control points, point-cloud alignment | Add/weight metric anchors and evaluate against held-out geometry |
| Map contains aircraft, vehicles, or temporary equipment | Dynamic-object contamination | Object masks, repeated-session disagreement, map editor history | Remove dynamic points, keep edit provenance, rerun localization QA |
| Extension factor causes thread or graph errors | Callback lifecycle issue | Thread logs, variable IDs, smoother window membership | Attach only to live variables and make extension state thread-safe |

## Practical Recommendation

Use GLIM when the goal is high-quality 3D mapping, offline refinement, multi-session map construction, or research on direct range-inertial factor graphs. It is especially compelling when GPU hardware is available and when map quality matters more than minimal runtime complexity.

Do not treat GLIM as a finished production AV localization stack by itself. For production, use it as a mapping and research component, then build or select a separate online localization layer that localizes against validated maps, fuses vehicle sensors, handles dynamic objects, exposes health metrics, and satisfies latency and safety requirements.

## Sources

- GLIM official repository. https://github.com/koide3/glim
- GLIM documentation. https://koide3.github.io/glim/
- GLIM getting started and offline viewer documentation. https://koide3.github.io/glim/quickstart.html
- GLIM multi-session merging documentation. https://koide3.github.io/glim/merge.html
- GLIM manual object removal documentation. https://koide3.github.io/glim/edit.html
- GLIM extension documentation. https://koide3.github.io/glim/extend.html
- GLIM API list and related repositories. https://koide3.github.io/glim/api.html
- Koide, Yokozuka, Oishi, and Banno, "GLIM: 3D Range-Inertial Localization and Mapping with GPU-Accelerated Scan Matching Factors." https://arxiv.org/abs/2407.10344
- `gtsam_points` official repository. https://github.com/koide3/gtsam_points
- GTSAM official site. https://gtsam.org/
