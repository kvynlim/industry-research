# GLIM and GTSAM Pipeline Hub

This is the cross-section hub for understanding GLIM as a SLAM pipeline and GTSAM as the mathematical backend behind that pipeline. It links the method pages to the knowledge-base pages that explain the probability, geometry, optimization, and sparse linear algebra layers.

Use this page when a question spans more than one file, for example: "how does a GLIM scan factor become a GTSAM solve?", "where do Bayes trees and Hessians enter the pipeline?", or "which KB page explains the failure I am seeing?"

## Core Spine

```text
sensor packets
  -> time sync, calibration, preprocessing, deskew
  -> range/IMU/GNSS/loop/custom residual factors
  -> GTSAM nonlinear factor graph over poses, velocities, biases, and submaps
  -> manifold linearization and whitening
  -> sparse Jacobian/Hessian or Bayes-tree solve
  -> marginals, diagnostics, trajectories, submaps, and map artifacts
```

The key point: GLIM is the SLAM/mapping framework; GTSAM is the graph optimization and inference machinery; the KB pages explain the math that makes the machinery inspectable.

## Pipeline Crosswalk

| GLIM pipeline stage | GTSAM object or operation | Mathematical topic | Diagnostic artifact |
|---|---|---|---|
| Sensor ingestion and calibration | measurements, timestamps, frame transforms | [Lie groups, SE(3), SO(3), and Jacobians](../../../10-knowledge-base/geometry-3d/lie-groups-se3-so3-jacobians.md), [Sensor Calibration and Time Synchronization](../../../10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md) | frame trace, TF chain, time-offset replay, lever-arm check |
| Deskew and inertial propagation | `PreintegratedImuMeasurements`, `ImuFactor`, `NavState`, bias variables | [IMU Error Models and Preintegration](../../../10-knowledge-base/state-estimation/imu-error-models-preintegration.md) | IMU residuals, bias trajectory, gravity alignment, deskew sharpness |
| Factor construction | `NonlinearFactorGraph`, `Values`, `NoiseModelFactorN`, custom factors | [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md), [Objective and Residual Design Audit](../../../10-knowledge-base/optimization/objective-residual-design-and-audit.md) | factor list, residual units, connected keys, zero-residual synthetic case |
| Probability model | priors, likelihood factors, robust noise models | [Probabilistic Graphical Models and Message Passing](../../../10-knowledge-base/probability-statistics/probabilistic-graphical-models-message-passing.md), [Likelihood, MAP, MLE, and Least Squares](../../../10-knowledge-base/probability-statistics/likelihood-map-mle-least-squares.md) | posterior factorization, prior policy, factor independence assumptions |
| Noise and whitening | `noiseModel::Diagonal`, Gaussian models, robust wrappers | [Gaussian Noise, Covariance, Information, Whitening, and Uncertainty Ellipses](../../../10-knowledge-base/probability-statistics/gaussian-noise-covariance-information.md), [Robust Losses and M-Estimators](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md) | whitened residual histograms, per-factor chi-square, robust weights |
| Scan matching and submap matching | `gtsam_points` scan/VGICP factors, loop factors, plane factors | [GICP and VGICP](gicp-vgicp.md), [LiDAR Bundle-Adjustment Factors](lidar-bundle-adjustment-factors.md), [Point Cloud Registration Math](../../../10-knowledge-base/geometry-3d/point-cloud-registration-math-icp-ndt-gicp.md) | inlier count, overlap, voxel covariance, scan Hessian, weak eigenvectors |
| Nonlinear step | Gauss-Newton, Levenberg-Marquardt, Dogleg, iSAM2 update policy | [Gauss-Newton, Levenberg-Marquardt, and Dogleg](../../../10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md), [Nonlinear Solver Diagnostics Crosswalk](../../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md) | cost trace, damping/radius, predicted-vs-actual reduction, accepted/rejected steps |
| Linearization and Hessian | `GaussianFactorGraph`, `JacobianFactor`, `HessianFactor`, `H = J^T J` | [Jacobians, Autodiff, and Manifold Linearization](../../../10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md), [Eigenvalues, Hessian Conditioning, and Observability](../../../10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md) | finite-difference checks, Hessian spectrum, nullspace, local observability |
| Sparse backend | ordered elimination, Cholesky, QR, Bayes net, Bayes tree | [Sparse Matrices, Fill-In, and Ordering](../../../10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md), [Cholesky, LDLT, and Normal Equations](../../../10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md), [QR, SVD, and Rank-Revealing Solvers](../../../10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md) | fill report, clique size, pivot warnings, QR/SVD rank snapshot |
| Fixed-lag and map refinement | fixed-lag smoother, marginal factors, global submap graph | [Schur Complement, Marginalization, and PCG](../../../10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md), [Square-Root Information and Covariance Recovery](../../../10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md) | dense prior rank, separator variables, selected marginal covariance |
| Pipeline-level SLAM method | GLIM odometry, global mapping, offline correction, multi-session merge | [GLIM](glim.md), [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md) | `odom_*.txt`, `traj_*.txt`, submap graph, exported PLY/map artifacts |

## Failure Routing

| Symptom | First route |
|---|---|
| Low scalar cost but wrong map | [Objective and Residual Design Audit](../../../10-knowledge-base/optimization/objective-residual-design-and-audit.md), then scan/loop residual pages |
| Cholesky or indeterminate linear-system failure | [Cholesky, LDLT, and Normal Equations](../../../10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md), then [Eigenvalues, Hessian Conditioning, and Observability](../../../10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md) |
| iSAM2 update-time spike | [Sparse Matrices, Fill-In, and Ordering](../../../10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md), then [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md) |
| Covariance looks too confident | [Gaussian Noise, Covariance, Information, Whitening, and Uncertainty Ellipses](../../../10-knowledge-base/probability-statistics/gaussian-noise-covariance-information.md), then [SLAM/VIO Observability, FEJ, Nullspace, and Consistency](../../../10-knowledge-base/state-estimation/slam-vio-observability-fej-nullspace-consistency.md) |
| Loop closure bends a map | [Robust Losses and M-Estimators](../../../10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md), [Loop Closure and Place Recognition](loop-closure-place-recognition.md), and [Nonlinear Solver Diagnostics Crosswalk](../../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md) |
| Open-area drift or repeated-structure ambiguity | [Eigenvalues, Hessian Conditioning, and Observability](../../../10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md), [GICP and VGICP](gicp-vgicp.md), and [GLIM](glim.md) |
| Custom factor behaves unexpectedly | [Jacobians, Autodiff, and Manifold Linearization](../../../10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md), [Lie Groups SE(3), SO(3), Adjoints, and Jacobians](../../../10-knowledge-base/geometry-3d/lie-groups-se3-so3-jacobians.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) |

## Reading Paths

For the full GLIM pipeline, read [GLIM](glim.md), then [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md), then [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md).

For the math behind the solve, read [Likelihood, MAP, MLE, and Least Squares](../../../10-knowledge-base/probability-statistics/likelihood-map-mle-least-squares.md), [Nonlinear Least Squares from First Principles](../../../10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md), [Jacobians, Autodiff, and Manifold Linearization](../../../10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md), and [Gauss-Newton, Levenberg-Marquardt, and Dogleg](../../../10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md).

For sparse backend behavior, read [Sparse Estimation Backend Crosswalk](../../../10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md), then [Sparse Matrices, Fill-In, and Ordering](../../../10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md), [Cholesky, LDLT, and Normal Equations](../../../10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md), [QR, SVD, and Rank-Revealing Solvers](../../../10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md), and [Schur Complement, Marginalization, and PCG](../../../10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md).

For production-style debugging, start with [Nonlinear Solver Diagnostics Crosswalk](../../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md), then route to objective design, noise whitening, Jacobians, rank/conditioning, sparse backend, or state-estimation observability.

## Boundary Notes

- GLIM owns the concrete range-inertial mapping workflow: odometry, submaps, global mapping, offline correction, multi-session merge, extension modules, and exported artifacts.
- GTSAM owns the graph abstraction and inference machinery: factor graphs, values, noise models, nonlinear optimization, elimination, Bayes tree/iSAM2, marginals, and fixed-lag smoothing.
- The KB pages own reusable theory. They should explain the math so that a GLIM/GTSAM issue can be debugged without treating either codebase as a black box.
