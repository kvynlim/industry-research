# Trust Region and Line Search Globalization

## Related docs

- [Nonlinear Least Squares from First Principles](./nonlinear-least-squares-first-principles.md)
- [Gauss-Newton, Levenberg-Marquardt, and Dogleg](./gauss-newton-levenberg-marquardt-dogleg.md)
- [Jacobians, Autodiff, and Manifold Linearization](./jacobians-autodiff-manifold-linearization.md)
- [Factor Graph Solver Patterns: Ceres, GTSAM, and g2o](./factor-graph-solver-patterns-ceres-gtsam-g2o.md)
- [Factor Graph SLAM with iSAM2 and GTSAM](../../30-autonomy-stack/localization-mapping/slam-methods/factor-graph-isam2-gtsam.md)

## Why it matters for AV, perception, SLAM, and mapping

Linearization is local. AV perception and mapping systems often start from estimates that are good but not perfect: wheel odometry may drift, ICP may lock onto a nearby wall, GNSS may jump, visual matches may contain outliers, and loop closures may introduce large corrections. A raw Newton or Gauss-Newton step can increase the true nonlinear cost even if it minimizes the local quadratic model.

Globalization methods control the update so iterative optimization is more likely to converge from imperfect starts. Trust-region methods ask "how far can I trust this local model?" Line-search methods ask "given this direction, how far should I move?" Ceres explicitly presents these as the two major ways to control nonlinear least-squares step size.

## Core math and algorithm steps

At iterate `x_k`, build a local model:

```text
m_k(p) = f(x_k) + g_k^T p + 0.5 * p^T B_k p
```

For nonlinear least squares:

```text
f(x) = 0.5 * ||F(x)||^2
g_k = J_k^T F_k
B_k ~= J_k^T J_k
```

Without globalization, the update is:

```text
x_{k+1} = x_k boxplus p_k
```

where `p_k` solves the local model. Globalization modifies either the step length or the step computation.

## Trust-region methods

Trust-region methods solve:

```text
min_p m_k(p)
subject to ||p|| <= Delta_k
```

where `Delta_k` is the trust-region radius. The radius encodes how far the algorithm believes the local quadratic model is reliable.

After computing a trial step `p`, compare:

```text
actual reduction    = f(x_k) - f(x_k boxplus p)
predicted reduction = m_k(0) - m_k(p)
rho_k               = actual reduction / predicted reduction
```

Typical policy:

- If `rho_k` is high, accept the step and expand the region.
- If `rho_k` is acceptable, accept the step and keep or mildly adjust the region.
- If `rho_k` is poor, reject the step and shrink the region.

Common trust-region NLS methods:

- Levenberg-Marquardt: solves a damped system such as `(J^T J + lambda D) p = -J^T F`.
- Dogleg: combines the steepest-descent and Gauss-Newton steps within the trust region.

Ceres uses trust region as its default minimizer type and supports Levenberg-Marquardt and dogleg strategies. GTSAM provides Gauss-Newton, Levenberg-Marquardt, and Powell dogleg batch optimizers.

### Trust-region algorithm sketch

```text
given x_0 and Delta_0
repeat:
  evaluate F, J, f, g, H
  approximately solve min m_k(p) subject to ||p|| <= Delta_k
  evaluate f_trial = f(x_k boxplus p)
  rho = (f_k - f_trial) / (m_k(0) - m_k(p))
  if rho is acceptable:
    x_{k+1} = x_k boxplus p
  else:
    x_{k+1} = x_k
  update Delta_k using rho and boundary status
```

## Line-search methods

Line-search methods choose a descent direction `p_k`, then solve for a step length `alpha_k`:

```text
x_{k+1} = x_k boxplus (alpha_k * p_k)
```

The direction can be steepest descent, Newton, Gauss-Newton, nonlinear conjugate gradient, BFGS, or LBFGS. The step length is usually not solved exactly; it is chosen to satisfy sufficient decrease and sometimes curvature conditions.

Ceres documents Armijo and Wolfe line searches. It also notes that its line-search minimizer cannot handle bounds constraints, while trust-region methods can be augmented for bounded problems.

### Armijo sufficient decrease

A candidate step should reduce the objective enough relative to the directional derivative:

```text
f(x + alpha p) <= f(x) + c1 * alpha * g^T p
```

where `0 < c1 < 1`.

### Wolfe curvature condition

Strong Wolfe line search adds a gradient condition along the search direction:

```text
|d/d alpha f(x + alpha p)| <= c2 * |g^T p|
```

Ceres notes that Wolfe line search is required for the assumptions behind BFGS and LBFGS direction updates.

### Line-search algorithm sketch

```text
given x_0
repeat:
  evaluate f and gradient g
  choose descent direction p
  find alpha satisfying line-search conditions
  x_{k+1} = x_k boxplus alpha p
```

## Trust region versus line search

Nocedal and Wright frame the difference as order of decisions:

- Line search first chooses a direction, then chooses a distance along that direction.
- Trust region first chooses a maximum distance, then chooses the best step within that distance.

In AV estimation:

- Trust region is usually the default for sparse nonlinear least squares because LM and dogleg fit the residual/Jacobian structure directly.
- Line search is useful for very large problems where storing or factoring the full Jacobian is too expensive, or when a low-accuracy solution is sufficient.
- LBFGS line search can be attractive for dense learned calibration or map-alignment objectives where Hessian factorization is not practical.
- Trust region is usually easier to reason about when steps can become invalid because of local geometry, rank deficiency, or poor initialization.

## Implementation notes

- Compute predicted reduction from the same local model used to generate the step. A mismatch makes the gain ratio meaningless.
- Define the trust-region norm in tangent space for manifold variables, not in quaternion ambient coordinates.
- Use robust losses after whitening. Robustification changes the effective residual weights and therefore changes the local model.
- Do not blindly accept nonmonotonic cost changes unless the solver is configured for nonmonotonic steps and downstream consumers can tolerate them.
- For online SLAM, cap per-update work. A theoretically robust globalization strategy can still violate real-time budgets if it performs too many rejected trial evaluations.
- For loop closure, use stricter gating before insertion. Globalization should not be the only defense against a bad loop closure.
- For map updates, separate optimizer convergence from map publication. Publishing every rejected or intermediate trial state can cause downstream map flicker.

## Failure modes and diagnostics

- **Many rejected trust-region steps:** The model is not predictive. Check Jacobians, initialization, robust loss threshold, and inconsistent factors.
- **Trust region shrinks to tiny radius:** The solver is cautious because trial steps fail. Inspect outlier factors and residual discontinuities.
- **Line search cannot find sufficient decrease:** Direction may not be descent, gradient may be wrong, or objective may be nonsmooth.
- **LBFGS breakdown:** Curvature conditions may fail; use Wolfe search and inspect gradient consistency.
- **Cost decreases but trajectory worsens:** The objective is misweighted. Check covariance scales and factor units.
- **Converges to wrong basin:** Globalization improves local convergence, not global data association. Revisit front-end association, loop verification, and initialization.
- **Step valid in vector space but invalid on manifold:** Retraction, angle normalization, or quaternion layout is wrong.

## Sources

- Ceres Solver, "Solving Non-linear Least Squares": https://ceres-solver.readthedocs.io/latest/nnls_solving.html
- Ceres Solver, solver feature overview: https://ceres-solver.readthedocs.io/latest/features.html
- GTSAM docs, nonlinear optimizer module: https://borglab.github.io/gtsam/nonlinear
- GTSAM Doxygen, `NonlinearOptimizer`: https://gtsam.org/doxygen/a05103.html
- Nocedal and Wright, "Numerical Optimization": https://convexoptimization.com/TOOLS/nocedal.pdf
- Kuemmerle et al., "g2o: A General Framework for Graph Optimization": https://ais.informatik.uni-freiburg.de/publications/papers/kuemmerle11icra.pdf
