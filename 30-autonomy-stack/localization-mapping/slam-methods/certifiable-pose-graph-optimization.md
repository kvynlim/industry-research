# Certifiable Pose Graph Optimization

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "architecture-pattern"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "validation", "runtime-localization"]
  reason: "Certifiable Pose Graph Optimization is rated for robust or collaborative backend design in multi-session SLAM and validation."
method-priority:end -->

## Executive Summary

Certifiable pose graph optimization asks a stronger question than normal SLAM backends: not only "what trajectory minimizes the graph cost?", but "can we prove this solution is globally optimal for the stated graph objective?" This matters because pose graph optimization is non-convex. Gauss-Newton, Levenberg-Marquardt, Dogleg, and iSAM2 can converge quickly, but they normally return a local optimum with no certificate.

The best-known certifiable PGO line is SE-Sync. It formulates synchronization over the special Euclidean group, builds a semidefinite relaxation, solves the relaxation efficiently through low-rank Riemannian optimization, rounds the result back to poses, and then checks whether the relaxation is tight. When the certificate succeeds, the returned solution is globally optimal for the maximum-likelihood PGO problem under the given measurements and noise model.

This page is about certifiability, not general graph SLAM. It should be read alongside [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md), which covers the standard formulation, and [Robust Pose Graph Optimization with GNC and riSAM](robust-pgo-gnc-risam.md), which covers outlier tolerance. Certifiable PGO assumes the graph objective is the right objective; it does not automatically make wrong loop closures correct.

## Method Class

- Certifiably correct pose graph optimization.
- Semidefinite relaxation and low-rank Riemannian optimization.
- Rotation synchronization and SE(d) synchronization.
- Global optimality verification for non-convex geometric estimation.
- Batch or distributed backend component, not a high-rate odometry estimator.

## Core Idea

PGO estimates poses from relative measurements:

```text
Z_ij = (R_ij, t_ij)
X_i = (R_i, t_i)
```

The maximum-likelihood objective is non-convex because rotations live on `SO(2)` or `SO(3)`:

```text
min_R,t sum_(i,j) kappa_ij ||R_j - R_i R_ij||_F^2
        + tau_ij ||t_j - t_i - R_i t_ij||_2^2
```

Classical solvers optimize this directly and can get stuck. Certifiable methods relax the problem into a convex semidefinite program or a related low-rank problem. Under moderate noise and correct measurements, the relaxation is tight: its solution corresponds exactly to a valid pose graph solution. The solver can then produce a dual certificate or equivalent optimality check.

The result is a different kind of backend answer:

```text
estimate + certificate status
```

If the certificate succeeds, downstream systems know the graph optimizer did not merely converge locally. If it fails, the result may still be useful, but it should be treated like a normal non-certifiable solution.

## Optimization Formulation

SE-Sync separates the PGO problem into a form where translations can be eliminated or handled linearly once rotations are known. The hard part becomes synchronization over rotations and poses.

A simplified rotation synchronization objective is:

```text
min_R sum_(i,j) kappa_ij ||R_j - R_i R_ij||_F^2
subject to R_i in SO(d)
```

The semidefinite relaxation lifts products of rotations into a matrix variable:

```text
Y = R^T R
Y >= 0
block constraints enforce rotation structure in relaxed form
```

The full SDP is too large for naive solvers on SLAM graphs. SE-Sync exploits low-rank structure and solves a rank-restricted problem on a product of Stiefel manifolds:

```text
min_Y trace(QY)
subject to Y = R^T R, R in St(d, r)^n
```

The rank `r` can be increased through a Riemannian staircase. If a second-order critical point satisfies the certificate conditions, the optimizer has found the global optimum of the relaxation, and if the relaxation is tight, the PGO solution is globally optimal.

Shonan rotation averaging applies a related idea specifically to rotation averaging. It "surfs" higher-dimensional rotation spaces `SO(p)^n` and can recover globally optimal rotation solutions under suitable noise assumptions while reusing high-performance local optimization machinery.

## Pipeline

1. **Build a pose graph.** Use relative pose measurements from odometry, visual/LiDAR registration, and loop closure.

2. **Validate the graph before certification.** Certifiable solvers certify the objective, not the semantic truth of the measurements.

3. **Anchor the gauge.** Fix one pose or add appropriate priors so the global frame is observable.

4. **Construct the synchronization problem.** Convert relative transforms and information weights into the matrix form used by the relaxation.

5. **Solve the low-rank relaxation.** Use a Riemannian trust-region or block-coordinate method rather than a generic dense SDP solver.

6. **Round to valid poses.** Project the relaxed solution back to `SO(d)` and recover translations.

7. **Run certificate checks.** Verify tightness and global optimality conditions. Record the certificate result with the map artifact.

8. **Optionally polish locally.** A local least-squares pass may refine numerical residuals, but it should not invalidate the certificate story without rechecking.

9. **Report residuals and certificate status.** A failed certificate is useful information; do not hide it.

## Assumptions

- Measurements are mostly inliers and follow the modeled noise.
- Noise is below the regime where the relaxation loses tightness.
- The graph is connected and properly anchored.
- Relative pose covariances are reasonable.
- Outlier rejection has already removed or downweighted false loop closures.
- Batch or near-batch computation is acceptable.

## Failure Modes

**Certifying the wrong objective.** A graph with false but self-consistent loop closures can still have a globally optimal wrong solution.

**Relaxation not tight.** High noise, bad topology, or bad weights can prevent the relaxation from producing a rank-consistent pose solution.

**Scale and memory pressure.** Certifiable methods are more complex than ordinary sparse least squares, especially for large 3D maps.

**Weak anchoring.** Gauge freedom or disconnected subgraphs can make the certificate meaningless or cause numerical issues.

**Overconfident outliers.** Certifiability does not replace robust estimation. A false high-weight edge is still part of the objective.

**Numerical certificate fragility.** Tightness checks depend on tolerances, sparse linear algebra, and conditioning.

## AV and Airside Fit

Certifiable PGO is most valuable in workflows where a map or multi-session alignment becomes a long-lived asset:

- Offline HD map construction.
- Post-mission survey validation.
- Multi-session map alignment.
- Regression testing of loop-closure and backend changes.
- Safety-case evidence for map generation tooling.

For airside autonomy, certifiable PGO is attractive because airport maps are operational infrastructure. If a final map alignment can be accompanied by residual reports and an optimality certificate, the mapping pipeline becomes easier to audit.

It is less attractive as a high-rate online localization backend. Online AV stacks need bounded latency, fault handling, and smooth output. Certifiable PGO can run offline, in the cloud, or as a lower-rate validation backend, while the vehicle uses ESKF/INS and incremental factor graphs for live state estimation.

## Implementation Notes

- Use certifiable PGO after robust outlier filtering, not before.
- Record whether the certificate succeeded, not just the final trajectory.
- Keep the raw graph, solver settings, weights, and certificate logs with the map build.
- Compare against standard GTSAM/g2o/Ceres solutions to catch modeling mistakes.
- Use Shonan rotation averaging when the dominant ambiguity is rotational averaging in SfM or multi-camera-style graphs.
- Use SE-Sync-style solvers when full SE(d) synchronization and PGO optimality matter.
- For collaborative SLAM, see distributed certifiable PGO rather than forcing all robot data through a central machine.

## Open-Source Implementations

- SE-Sync official repository: https://github.com/david-m-rosen/SE-Sync
- DPGO distributed certifiable backend: https://github.com/mit-acl/dpgo
- GTSAM, including Shonan averaging components: https://github.com/borglab/gtsam
- GTSAM Shonan class documentation: https://docs.ros.org/en/api/gtsam/html/classgtsam_1_1ShonanAveraging.html

## Practical Recommendation

Use certifiable PGO as an audit and map-build backend, especially for finalizing maps after loop closure and multi-session merging. Pair it with robust outlier rejection. The certificate says the optimizer solved the graph objective globally; it does not say the graph contains only true measurements.

For airside map production, the strongest workflow is:

```text
front-end verification -> robust PGO/outlier pruning -> certifiable PGO -> residual and certificate report
```

This creates a traceable map artifact that is much stronger than a local least-squares solution alone.

## Related Repository Docs

- [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md)
- [Robust Pose Graph Optimization with GNC and riSAM](robust-pgo-gnc-risam.md)
- [Distributed Multi-Robot Pose Graph Optimization](distributed-multi-robot-pgo.md)
- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
- [Map Construction Pipeline](../maps/map-construction-pipeline.md)

## Sources

- Rosen, Carlone, Bandeira, and Leonard, "SE-Sync: A Certifiably Correct Algorithm for Synchronization over the Special Euclidean Group": https://arxiv.org/abs/1612.07386
- SE-Sync official repository: https://github.com/david-m-rosen/SE-Sync
- Dellaert, Rosen, Wu, Mahony, and Carlone, "Shonan Rotation Averaging: Global Optimality by Surfing SO(p)^n," ECCV, 2020: https://www.ecva.net/papers/eccv_2020/papers_ECCV/papers/123510290.pdf
- Tian, Khosoussi, Rosen, and How, "Distributed Certifiably Correct Pose-Graph Optimization," IEEE T-RO, 2021: https://arxiv.org/abs/1911.03721
- DPGO official repository: https://github.com/mit-acl/dpgo
- GTSAM Shonan averaging documentation: https://docs.ros.org/en/api/gtsam/html/classgtsam_1_1ShonanAveraging.html
