# Likelihood, MAP, MLE, and Least Squares

Likelihood connects probabilistic modeling to optimization. Maximum likelihood
estimation (MLE) chooses parameters that make the observed data most probable.
Maximum a posteriori (MAP) estimation adds a prior. Under Gaussian residual
models, both become least-squares problems. This is the mathematical bridge
between Bayes filters, factor graphs, bundle adjustment, scan matching, and
calibration solvers.

## Related docs

- [Gaussian Noise, Covariance, Information, Whitening, and Uncertainty Ellipses](gaussian-noise-covariance-information.md)
- [Mahalanobis and Chi-Square Gating](mahalanobis-chi-square-gating.md)
- [GTSAM Factor Graph Optimization](../state-estimation/gtsam-factor-graphs.md)
- [Bayesian Filtering and Error-State Kalman Filters](../state-estimation/bayesian-filtering-and-eskf.md)
- [Robust Statistics, RANSAC, and Hypothesis Testing](robust-statistics-ransac-hypothesis-testing.md)

## Why it matters for AV, perception, SLAM, and mapping

Most "optimization" blocks in an autonomy stack are probabilistic estimators in
disguise:

- LiDAR scan matching maximizes the likelihood of points under a registration
  model.
- Camera calibration maximizes the likelihood of image observations under a
  projection model.
- Bundle adjustment and visual-inertial odometry compute MAP trajectory and
  landmark estimates.
- Factor graph SLAM multiplies local measurement likelihoods and priors, then
  solves the equivalent nonlinear least-squares problem.
- Tracking updates combine a predicted state prior with a measurement
  likelihood to form a posterior.

The value of the first-principles view is auditability. If a residual appears in
a cost function, engineers should know what noise model it implies, what units
it uses, and what prior assumptions it encodes.

## First-principles math

### Probability, likelihood, and parameters

For a measurement `z` generated from state or parameter `x`, the probability
model is

```text
p(z | x)
```

When `z` is observed and `x` is unknown, the same expression viewed as a
function of `x` is the likelihood:

```text
L(x; z) = p(z | x)
```

Likelihood is not a probability distribution over `x` unless it is normalized
with a prior. It is a score that says which values of `x` explain the observed
data better under the model.

For independent measurements `z_1, ..., z_N`,

```text
L(x; z_1:N) = product_i p(z_i | x)
```

Because products underflow and derivatives of sums are easier:

```text
log L(x) = sum_i log p(z_i | x)
```

### MLE

Maximum likelihood estimation chooses

```text
x_mle = argmax_x p(z_1:N | x)
```

Equivalently:

```text
x_mle = argmin_x -log p(z_1:N | x)
```

For a residual model

```text
z_i = h_i(x) + v_i
v_i ~ N(0, Sigma_i)
r_i(x) = z_i - h_i(x)
```

the likelihood is

```text
p(z_i | x) = const_i * exp(-0.5 * r_i(x)^T Sigma_i^-1 r_i(x))
```

The negative log-likelihood is

```text
-log p(z_1:N | x)
  = const + 0.5 * sum_i r_i(x)^T Sigma_i^-1 r_i(x)
```

Dropping constants independent of `x`:

```text
x_mle = argmin_x sum_i ||r_i(x)||^2_Sigma_i
```

where

```text
||r||^2_Sigma = r^T Sigma^-1 r
```

Thus Gaussian MLE is weighted least squares.

### MAP

Bayes' rule gives

```text
p(x | z) = p(z | x) p(x) / p(z)
```

The evidence `p(z)` does not depend on `x`, so MAP estimation is

```text
x_map = argmax_x p(z | x) p(x)
```

or

```text
x_map = argmin_x -log p(z | x) - log p(x)
```

If the prior is Gaussian,

```text
x ~ N(mu_0, P_0)
```

then

```text
-log p(x) = const + 0.5 * (x - mu_0)^T P_0^-1 (x - mu_0)
```

So MAP adds a prior residual:

```text
r_0(x) = x - mu_0
```

with covariance `P_0`. This is exactly how a prior factor anchors a factor
graph. GTSAM's tutorial presents factor graphs as products of probabilistic
factors and solves for the MAP assignment by minimizing nonlinear squared error.

### From nonlinear residuals to Gauss-Newton

Most AV models are nonlinear:

```text
r_i(x) = z_i - h_i(x)
```

At a current estimate `x0`, linearize:

```text
r_i(x0 + dx) ~= r_i(x0) + J_i dx
```

where

```text
J_i = d r_i / d x at x0
```

The local least-squares problem is

```text
min_dx 0.5 * sum_i (r_i + J_i dx)^T Sigma_i^-1 (r_i + J_i dx)
```

Set the derivative to zero:

```text
(sum_i J_i^T Sigma_i^-1 J_i) dx
  = -sum_i J_i^T Sigma_i^-1 r_i
```

Define

```text
H = sum_i J_i^T Sigma_i^-1 J_i
g = sum_i J_i^T Sigma_i^-1 r_i
```

Then

```text
H dx = -g
```

This is Gauss-Newton. Levenberg-Marquardt and trust-region methods modify the
step to improve convergence when the local quadratic approximation is poor.

### Whitened least squares

Let `R_i^T R_i = Sigma_i^-1`. Then

```text
r_i^T Sigma_i^-1 r_i = ||R_i r_i||^2
```

A weighted least-squares problem can be implemented as an ordinary least-squares
problem over whitened residuals:

```text
e_i = R_i r_i
A_i = R_i J_i
```

The local problem becomes

```text
min_dx 0.5 * sum_i ||e_i + A_i dx||^2
```

This is why square-root information matrices are common in SLAM and bundle
adjustment. They make the probabilistic weighting explicit while allowing stable
linear algebra.

### Priors, regularization, and pseudo-measurements

A quadratic regularizer is a Gaussian prior. Ridge-style damping

```text
lambda ||x||^2
```

corresponds to a zero-mean Gaussian prior with covariance proportional to
`1 / lambda`. A soft constraint such as "extrinsic yaw should remain near the
factory calibration" is a prior factor. A hard constraint is the limiting case
of covariance approaching zero, but hard constraints are often numerically and
operationally brittle.

## Implementation notes

- Name residuals by their measurement model: `camera_reprojection_residual`,
  `lidar_plane_residual`, `gnss_position_residual`, not generic `error`.
- Keep residual sign conventions consistent. Squared costs hide sign mistakes,
  but Jacobians and diagnostics do not.
- Whiten residuals before feeding them to generic least-squares solvers if the
  solver does not support covariance directly.
- Do not mix robust losses with unwhitened residuals. Robust loss scale should
  usually be in whitened units.
- Use sparse Jacobians for factor graphs and bundle adjustment. The math is the
  same as dense least squares, but exploiting sparsity is the difference between
  real-time and offline-only behavior.
- Treat priors as explicit factors. Hidden regularization makes later debugging
  much harder.
- Separate model residuals from sensor preprocessing. For example, do not
  silently compensate timestamp offsets inside a residual without logging the
  assumed offset.
- In nonlinear problems, report final residuals, optimizer status, iteration
  count, and covariance/information diagnostics; a low cost alone does not prove
  the solution is physically correct.

## Failure modes and diagnostics

| Symptom | Likely cause | Diagnostic |
|---|---|---|
| Low cost but wrong solution | Ambiguity, wrong data association, or gauge freedom | Check priors, nullspaces, and alternative hypotheses. |
| One sensor dominates | Covariance too small or duplicated factors | Inspect per-factor whitened costs. |
| Optimizer diverges | Bad initialization or invalid linearization | Plot cost per iteration and step norm. |
| Normal equations singular | Gauge freedom or unobservable parameter | Examine rank, marginal covariance, and factor connectivity. |
| Parameter sticks to prior | Prior covariance too tight | Compare prior residual cost to measurement residual cost. |
| Residual histograms have heavy tails | Gaussian likelihood mismatch | Add robust losses, gates, or mixture models. |
| Reprojection residuals biased by image region | Calibration or distortion model mismatch | Bin residuals by pixel location and range. |
| Scan residuals biased by surface class | Wrong geometric noise model | Segment residuals by road, vehicle, vegetation, building, and curb. |

## Sources

- GTSAM, "Factor Graphs and GTSAM: A Hands-on Introduction": https://gtsam.org/tutorials/intro.html
- Frank Dellaert and Michael Kaess, "Factor Graphs for Robot Perception": https://www.cs.cmu.edu/~kaess/pub/Dellaert17fnt.html
- GTSAM Doxygen, `gtsam::JacobianFactor`: https://gtsam.org/doxygen/a04391.html
- SciPy, `scipy.optimize.least_squares`: https://docs.scipy.org/doc/scipy-1.13.0/reference/generated/scipy.optimize.least_squares.html
- Simo Sarkka, "Bayesian Filtering and Smoothing," Cambridge University Press contents: https://www.cambridge.org/core/books/bayesian-filtering-and-smoothing/contents/21BB5F04E9132436BB4518D841BFBC37
- Sebastian Thrun, Wolfram Burgard, and Dieter Fox, "Probabilistic Robotics," MIT Press: https://mitpress.mit.edu/9780262201629/probabilistic-robotics/
