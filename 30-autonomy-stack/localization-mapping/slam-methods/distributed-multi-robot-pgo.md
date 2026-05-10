# Distributed Multi-Robot Pose Graph Optimization

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "architecture-pattern"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "validation", "runtime-localization"]
  reason: "Distributed Multi-Robot Pose Graph Optimization is rated for robust or collaborative backend design in multi-session SLAM and validation."
method-priority:end -->

## Executive Summary

Distributed multi-robot pose graph optimization is the backend problem behind collaborative SLAM: each robot has its own trajectory and local measurements, while inter-robot loop closures connect robots into a shared map. A centralized backend sends all robot graphs to one machine. A distributed backend lets robots optimize jointly while communicating only with neighbors or teammates that share measurements.

The leading modern line is DPGO: distributed pose graph optimization based on sparse semidefinite relaxation, low-rank Riemannian optimization, and distributed optimality verification. It extends the certifiable PGO idea to collaborative SLAM. Related work adds asynchronous operation so robots do not need to wait for global synchronization, and robust multi-robot systems such as Kimera-Multi combine distributed optimization with outlier rejection and dense metric-semantic mapping.

This page focuses on collaborative backend consistency: how to solve and validate the multi-robot graph when communication, privacy, outliers, and initialization are all difficult. It is distinct from single-robot [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md) and from generic robust single-graph methods such as [Robust Pose Graph Optimization with GNC and riSAM](robust-pgo-gnc-risam.md).

## Method Class

- Collaborative SLAM backend.
- Distributed pose graph optimization.
- Multi-robot relative pose synchronization.
- Certifiable and asynchronous Riemannian optimization.
- Communication-aware map merging and trajectory alignment.

## Core Idea

Each robot `a` has local poses:

```text
X_i^a, i in robot a trajectory
```

Local odometry and loop closures connect poses within the same robot. Inter-robot loop closures connect poses from different robots:

```text
Z_ij^(a,b): relative transform from robot a pose i to robot b pose j
```

The centralized objective is one large PGO problem:

```text
min_X sum intra_robot_edges ||e_ij||^2_Omega
    + sum inter_robot_edges ||e_ij||^2_Omega
```

Distributed PGO partitions this objective by robot. Each robot optimizes its own variables while exchanging only the information needed for shared inter-robot factors. The communication graph is induced by robot-to-robot loop closures or network connectivity.

DPGO adds a stronger theoretical layer: it uses a sparse semidefinite relaxation and a distributed low-rank Riemannian staircase. Robots perform local block updates, communicate boundary variables, and can run distributed verification to certify global optimality under suitable conditions.

## Optimization Formulation

For robot `a`, let `X_a` be its trajectory variables. The objective can be decomposed:

```text
F(X_1, ..., X_N) =
  sum_a F_a_intra(X_a)
  + sum_(a,b) F_ab_inter(X_a, X_b)
```

Distributed block coordinate descent updates one robot or block at a time:

```text
X_a <- argmin_Xa F_a_intra(X_a) + sum_b F_ab_inter(X_a, X_b_fixed)
```

In DPGO's certifiable formulation, the relaxed problem is optimized over a product of Riemannian manifolds:

```text
Y_a in low-rank manifold block for robot a
min sum_a trace(Q_aa Y_a Y_a^T)
  + sum_(a,b) trace(Q_ab Y_a Y_b^T)
```

Robots only need to exchange block variables with neighbors that share inter-robot factors. The Riemannian staircase increases rank when needed and runs verification/saddle-escape checks to determine whether a recovered critical point is globally optimal.

Asynchronous variants remove the need for all robots to update in lockstep. Robots optimize and communicate with bounded delay:

```text
use latest available neighbor block, even if stale
```

This is important for real teams where wireless links are intermittent and robots have different compute loads.

## Pipeline

1. **Run local SLAM per robot.** Each robot creates local odometry, local loop closures, and local keyframe graphs.

2. **Detect inter-robot loop closures.** Robots exchange descriptors, submaps, or candidate places subject to bandwidth and privacy limits.

3. **Verify inter-robot geometry.** Estimate relative transforms and covariance for accepted candidates.

4. **Reject outlier inter-robot factors.** Use PCM, GNC, switchable constraints, or robust multi-robot consistency checks before trusting cross-robot edges.

5. **Partition graph by robot.** Assign each robot's trajectory variables to that robot; inter-robot factors become coupling terms.

6. **Initialize relative frames.** Use inter-robot closures, rendezvous, GPS, fiducials, or known deployment priors.

7. **Run distributed optimization.** Use synchronous RBCD, asynchronous ASAPP-style updates, ADMM-style alternatives, or another distributed PGO method.

8. **Exchange only boundary data.** Communicate poses or low-rank blocks needed by inter-robot factors, not full raw maps unless required.

9. **Verify and monitor.** Track convergence, residuals, certificate status if supported, communication load, and stale-neighbor delay.

10. **Publish map alignment.** Each robot maintains a local smooth odometry frame while sharing a global map frame transform.

## Assumptions

- Each robot has a locally connected graph.
- The inter-robot measurement graph connects the team enough to align frames.
- Communication is available often enough for convergence.
- Inter-robot loop closures are geometrically verified and not dominated by outliers.
- Robots can share the variables or summaries required by the optimizer.
- Time synchronization and frame conventions are consistent.
- The team can tolerate iterative convergence rather than instant global agreement.

## Failure Modes

**Bad inter-robot loop closures.** A few false cross-robot factors can corrupt the entire team map.

**Disconnected communication or measurement graph.** Robots without inter-robot links cannot be globally aligned.

**Poor relative initialization.** Some distributed methods are sensitive to initial frame offsets.

**Network delay and packet loss.** Synchronous methods can stall on slow robots or weak links.

**Bandwidth pressure.** Descriptor exchange, submaps, and boundary variables compete with mission traffic.

**Privacy and data ownership.** Some systems cannot share raw sensor data or full local maps.

**Frame convention mistakes.** Cross-robot transforms are easy to invert, timestamp incorrectly, or apply in the wrong frame.

**Overconfident covariances.** Inter-robot registrations often have worse uncertainty than intra-robot odometry.

**Certificate failure.** Distributed certifiable methods may converge to a useful solution without proving optimality.

## AV and Airside Fit

Distributed multi-robot PGO is relevant to airside autonomy in two main workflows:

- **Fleet map construction.** Multiple survey vehicles or service vehicles contribute trajectories and submaps to a shared airport map.
- **Collaborative operation.** Robots working around terminals, stands, and service roads share constraints when they observe the same infrastructure.

Airside constraints make a fully distributed design attractive:

- Wireless coverage is uneven around terminals, hangars, and aircraft.
- Raw sensor sharing may be bandwidth-heavy.
- Each vehicle still needs local autonomy if disconnected.
- Fleet maps need cross-session alignment over days and weather conditions.

Recommended airside usage:

- Keep each vehicle's local estimator independent and smooth.
- Share descriptors and compact submaps first; send raw data only for offline map building.
- Treat inter-robot loop closures as high-risk factors requiring strong verification.
- Use RTK/GNSS or surveyed airport control points as optional anchors with adaptive covariance.
- Run distributed optimization as a map/refinement layer, not as the high-rate control state.
- Log communication delay, accepted cross-robot edges, and graph corrections for audit.

## Implementation Notes

- DPGO is C++ and provides synchronous/asynchronous distributed PGO examples plus a ROS wrapper.
- Kimera-Multi uses DPGO as a distributed backend in a broader robust, distributed, dense metric-semantic SLAM system.
- COSMO-Bench provides collaborative optimization datasets in JSON Robot Log format with intra-robot and inter-robot loop closure labels, including outlier factors for evaluation.
- Start evaluation with centralized optimization as a reference solution, then compare distributed convergence, communication, and residuals.
- Use one canonical transform convention for all inter-robot factors and encode it in tests.
- Bound graph growth with submaps or keyframes; full keyframe sharing can become expensive.
- Measure communication bytes per iteration and convergence per byte, not only final ATE.
- Separate map optimization from live control-frame pose publication.

## Open-Source Implementations and Benchmarks

- DPGO official repository: https://github.com/mit-acl/dpgo
- Kimera-Multi official repository: https://github.com/MIT-SPARK/Kimera-Multi
- Kimera-RPGO robust PGO component: https://github.com/MIT-SPARK/Kimera-RPGO
- COSMO-Bench dataset portal: https://www.cosmobench.com/
- JSON Robot Log format: https://github.com/MarineRoboticsGroup/jrl

## Practical Recommendation

Use distributed PGO when a robot team needs shared map consistency but cannot reliably centralize all data during operation. For airside systems, keep the live autonomy stack local and use distributed PGO for collaborative map alignment, cross-vehicle loop closure validation, and fleet map refinement.

A practical architecture is:

```text
local SLAM per vehicle
  -> compact place/submap exchange
  -> inter-robot geometric verification
  -> robust cross-robot factor selection
  -> distributed PGO
  -> map-frame alignment and offline audit
```

For final map release, run a centralized or certifiable backend as an additional validation pass when data can be collected after the mission.

## Related Repository Docs

- [Certifiable Pose Graph Optimization](certifiable-pose-graph-optimization.md)
- [Kimera-RPGO and Pairwise Consistency Maximization](kimera-rpgo-pcm.md)
- [Robust Pose Graph Optimization with GNC and riSAM](robust-pgo-gnc-risam.md)
- [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md)
- [Loop Closure and Place Recognition](loop-closure-place-recognition.md)

## Sources

- Tian, Khosoussi, Rosen, and How, "Distributed Certifiably Correct Pose-Graph Optimization," IEEE T-RO, 2021: https://arxiv.org/abs/1911.03721
- DPGO official repository: https://github.com/mit-acl/dpgo
- Tian, Koppel, Bedi, and How, "Asynchronous and Parallel Distributed Pose Graph Optimization," RA-L/IROS, 2020: https://arxiv.org/abs/2003.03281
- Tian et al., "Kimera-Multi: Robust, Distributed, Dense Metric-Semantic SLAM for Multi-Robot Systems," IEEE T-RO, 2022, repository link from DPGO: https://github.com/MIT-SPARK/Kimera-Multi
- COSMO-Bench dataset portal: https://www.cosmobench.com/
- McGann, Potokar, and Kaess, "COSMO-Bench: A Benchmark for Collaborative SLAM Optimization," 2025: https://arxiv.org/abs/2508.16731
