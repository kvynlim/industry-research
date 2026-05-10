# Robust Pose Graph Optimization with GNC and riSAM

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "architecture-pattern"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "validation", "runtime-localization"]
  reason: "Robust Pose Graph Optimization with GNC and riSAM is rated for robust or collaborative backend design in multi-session SLAM and validation."
method-priority:end -->

## Executive Summary

Robust pose graph optimization is the backend layer that tries to keep SLAM globally consistent when the front end supplies bad loop closures, bad inter-session matches, or overconfident registration factors. Standard pose graph optimization assumes mostly Gaussian inlier errors. In real mapping systems, especially long-range LiDAR or visual loop closure, the graph often contains a small number of high-leverage outliers that can fold the whole trajectory.

Graduated Non-Convexity (GNC) is a practical robust-estimation strategy for this setting. It starts with a smoother, easier objective and gradually turns it into a strongly robust non-convex objective. The goal is to avoid the poor local minima that appear when hard robust losses are applied from the beginning. riSAM extends this idea to online incremental SLAM: it keeps the iSAM-style incremental backend but adds a GNC-based robust optimization schedule suitable for streaming measurements.

This page is distinct from the general [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md) and [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md) pages. Those describe the graph abstraction and sparse smoothing machinery. This page focuses on the robustness layer that decides how much a suspect measurement should influence the backend.

## Method Class

- Robust SLAM backend.
- Outlier-tolerant pose graph optimization.
- Graduated non-convex robust estimation.
- Incremental robust smoothing for online SLAM.
- Complement to loop-closure front-end validation, not a replacement for it.

## Core Idea

In ordinary least-squares PGO, each edge contributes a quadratic penalty:

```text
cost_ij = ||e_ij||^2_Omega
```

Large residuals dominate a quadratic objective, so one wrong loop closure can overpower many correct odometry edges. Robust kernels cap or downweight large residuals:

```text
cost_ij = rho(||e_ij||^2_Omega)
```

The problem is that useful robust kernels are usually non-convex. They reduce the effect of outliers, but they also create bad local minima and make the solution more sensitive to initialization.

GNC addresses this by solving a sequence of related problems. Early iterations use a convexified or less aggressive loss that gives the optimizer a wide convergence basin. Later iterations increase non-convexity so outliers are downweighted strongly. In Black-Rangarajan form, each measurement also receives an outlier weight:

```text
min_X,w sum_ij w_ij ||e_ij(X)||^2_Omega + Phi_mu(w_ij)
```

where `w_ij` is near 1 for inliers and near 0 for outliers. The control parameter `mu` changes through the GNC schedule. The optimizer alternates between updating the state `X` and updating the weights `w`.

riSAM brings this to incremental smoothing. Instead of repeatedly solving a full batch robust problem after each new measurement, riSAM updates a robust incremental backend and manages the GNC schedule around the newly affected part of the graph.

## Optimization Formulation

For SE(3) pose graph optimization:

```text
X* = argmin_X sum_(i,j in E) rho_mu(s_ij)

s_ij = e_ij(X_i, X_j)^T Omega_ij e_ij(X_i, X_j)
e_ij = Log(Z_ij^-1 X_i^-1 X_j)
```

`Z_ij` is the measured relative transform and `Omega_ij` is the information matrix. A GNC robust optimizer solves:

```text
for mu in schedule:
  repeat until convergence:
    w_ij <- argmin_w w s_ij + Phi_mu(w)
    X <- argmin_X sum w_ij s_ij
```

The weighted least-squares step can reuse standard sparse PGO machinery:

```text
H dx = -g
H = J^T W Omega J
g = J^T W Omega e
```

The robustness is therefore mostly in the loss schedule and edge weights, while the numerical core remains a sparse nonlinear least-squares backend.

riSAM's contribution is not a new pose residual; it is an incremental robust optimization strategy that makes GNC usable in online SLAM. It is designed for the same split used by iSAM-style systems:

```text
front end proposes factors -> backend updates estimate -> map/global frame is corrected
```

but it makes the backend less brittle to unavoidable data-association errors.

## Pipeline

1. **Build a normal pose or factor graph.** Add odometry, scan-matching, GPS, visual, and loop-closure factors with covariances.

2. **Classify risky edges.** Treat loop closures, inter-session closures, GPS under multipath, and weak registrations as robust candidates. Consecutive odometry can be robust too, but in many systems it is trusted more than long-range closures.

3. **Initialize the graph.** Use odometry chaining, local SLAM output, or previous incremental estimates. GNC is more tolerant than direct non-convex robust losses, but not magic.

4. **Start with a softened robust loss.** Choose a GNC loss such as Geman-McClure-style or truncated least squares with a large control parameter.

5. **Alternate state and weight updates.** Solve weighted PGO, recompute residuals, and update edge weights.

6. **Increase non-convexity.** Continue the schedule until the loss behaves like the target robust cost.

7. **Reject or quarantine low-weight edges.** Low final weights identify suspect loop closures. Production systems should log and optionally remove them rather than silently hiding the issue.

8. **Incrementally update online.** In riSAM-style operation, new factors trigger localized robust updates while preserving online efficiency.

9. **Post-check the solution.** Inspect residuals, edge weights, map deformation, and consistency with absolute priors.

## Assumptions

- Most constraints are correct or at least mutually consistent.
- The graph has enough odometry or local constraints to keep each trajectory connected.
- Outliers produce larger residuals than inliers under a reasonable intermediate estimate.
- Covariances are not wildly overconfident for weak edges.
- The optimizer starts close enough for the GNC schedule to find the correct basin.
- Loop closures are not adversarially arranged to form a self-consistent wrong map.

## Failure Modes

**Self-consistent outlier clusters.** If many wrong loop closures agree with each other, GNC can prefer the wrong consensus.

**Bad information matrices.** A false edge with extremely tight covariance can still dominate early iterations.

**Poor initialization.** GNC improves convergence behavior but does not remove all local minima.

**Ambiguous repeated structure.** Airports, parking decks, warehouses, and corridors can produce wrong closures with plausible residuals.

**Overusing robust kernels.** Making every factor aggressively robust can weaken observability and let the graph drift.

**Hidden failures.** Downweighted edges can make a graph look healthy while the front end keeps producing bad associations. The weights must be monitored.

**Runtime spikes.** Robust schedules require multiple weighted solves. Incremental approaches reduce this but do not make the cost free.

## AV and Airside Fit

Robust PGO is highly relevant to autonomous vehicles and airside mapping because the dominant catastrophic backend failure is a false global association. Airside environments contain repeated stands, repeated markings, terminal facades, parked aircraft that appear and disappear, and dynamic ground-support equipment. A normal least-squares backend is not enough for this setting.

Recommended airside usage:

- Use GNC or riSAM-style robust optimization for loop closures, multi-session closures, and inter-vehicle constraints.
- Keep geometric verification and geofence gating before backend insertion.
- Log robust weights per edge and require alarms for repeated low-weight closures in the same zone.
- Keep high-rate control on a smooth local odometry frame; publish graph corrections through `map -> odom`.
- Use RTK/GNSS and surveyed control points as robust or quality-gated priors, not always-trusted truth.
- Treat robust optimization as a last line of defense after descriptor, semantic, and geometric checks.

Robust PGO is best for offline HD-map construction, fleet map merging, and medium-rate global correction. It is not a substitute for a safety-certified localization health monitor.

## Implementation Notes

- Start with a standard GTSAM, g2o, Ceres, or Kimera-RPGO pose graph before adding robust scheduling.
- Use robust losses only on factors that can plausibly be outliers. Consecutive odometry and IMU factors usually need different treatment from loop closures.
- Store per-edge residual, weight, covariance, source module, and acceptance history.
- Tune robust thresholds from real residual distributions, not only benchmark defaults.
- In incremental operation, bound update time and measure loop-closure-induced latency.
- If using riSAM, track dependency versions carefully; the reference repository notes sensitivity to GTSAM and Kimera-RPGO versions.
- Use robust weights for diagnostics but do not expose them as the only safety decision.

## Open-Source Implementations

- riSAM reference implementation: https://github.com/rpl-cmu/risam
- Kimera-RPGO robust pose graph optimizer: https://github.com/MIT-SPARK/Kimera-RPGO
- GTSAM robust noise model support: https://gtsam.org/2019/09/20/robust-noise-model.html
- GTSAM: https://github.com/borglab/gtsam
- g2o: https://github.com/RainerKuemmerle/g2o
- Ceres Solver robust loss functions: https://ceres-solver.org/nnls_modeling.html#lossfunction

## Practical Recommendation

Use robust PGO as the default backend policy for any SLAM system that accepts long-range loop closures or multi-session constraints. For online operation, prefer incremental robust smoothing such as riSAM or a carefully engineered robust iSAM2 pipeline. For offline mapping, batch GNC can be slower but gives better auditability and repeatability.

The production rule is simple: a loop closure should pass front-end verification before insertion and still be allowed to lose influence in the backend if it conflicts with the graph.

## Related Repository Docs

- [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md)
- [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md)
- [Loop Closure and Place Recognition](loop-closure-place-recognition.md)
- [Kimera-RPGO and PCM](kimera-rpgo-pcm.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)

## Sources

- Yang, Antonante, Tzoumas, and Carlone, "Graduated Non-Convexity for Robust Spatial Perception: From Non-Minimal Solvers to Global Outlier Rejection," RA-L/ICRA, 2020: https://arxiv.org/abs/1909.08605
- McGann, Rogers, and Kaess, "Robust Incremental Smoothing and Mapping (riSAM)," ICRA, 2023: https://arxiv.org/abs/2209.14359 and https://danmcgann.com/papers/ICRA_2023_riSAM.pdf
- riSAM official repository: https://github.com/rpl-cmu/risam
- Choi et al., "Adaptive Graduated Non-Convexity for Pose Graph Optimization," IROS ROPEM workshop, 2023: https://arxiv.org/abs/2308.11444
- Kang et al., "Efficient Graduated Non-Convexity for Pose Graph Optimization," 2023: https://arxiv.org/abs/2310.06765
- GTSAM robust noise model tutorial: https://gtsam.org/2019/09/20/robust-noise-model.html
