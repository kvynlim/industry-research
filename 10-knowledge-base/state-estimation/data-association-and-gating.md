# Data Association and Gating

Data association decides which measurement, if any, should update which
predicted state. Gating decides which candidate pairings are physically and
statistically plausible before the assignment problem is solved. The first
principles view is simple: do not ask a combinatorial optimizer to choose
between pairings that violate the sensor model, motion model, or uncertainty
model.

---

## Related docs

- [Bayesian Filtering and Error-State Kalman Filters](bayesian-filtering-and-eskf.md)
- [Probabilistic Multi-Object Association](probabilistic-multi-object-association.md)
- [Particle Filters and Hypothesis Management](particle-filters-and-hypothesis-management.md)
- [Sensor Likelihoods, Noise, and Error Budgets](../sensors/sensor-likelihoods-noise-error-budgets.md)
- [Benchmarking, Metrics, and Statistical Validity](../systems-engineering/benchmarking-metrics-statistical-validity.md)

---

## Why it matters for AV, perception, SLAM, and mapping

Association errors are often more damaging than moderate measurement noise.
One wrong LiDAR cluster, radar Doppler point, lane marking, visual feature, or
map landmark can drag a tracker or localizer into a confident but wrong state.
For AV perception, association controls track continuity, velocity estimates,
and object identity through occlusion. For SLAM and mapping, association
controls whether a landmark update sharpens the map or corrupts it. For
localization, association determines whether scan-to-map residuals represent
the correct physical structure.

The production goal is not merely to find a minimum-cost matching. It is to
construct candidate measurements whose cost is meaningful, whose uncertainty is
calibrated, and whose rejection statistics can be monitored.

---

## Core math and algorithm steps

### Innovation and Mahalanobis gating

For a predicted track state `x_pred` with covariance `P_pred` and a measurement
model:

```
z = h(x) + v,    v ~ N(0, R)
```

linearize around the prediction:

```
H = dh/dx at x_pred
z_pred = h(x_pred)
y = z - z_pred
S = H P_pred H^T + R
```

The squared Mahalanobis distance is:

```
d2 = y^T S^-1 y
```

For a residual of dimension `m`, gate with a chi-squared threshold:

```
accept if d2 <= chi2_ppf(p_gate, m)
```

Typical `p_gate` values are 0.95, 0.99, or 0.997 depending on clutter, recovery
needs, and false-association risk. The threshold is not a magic distance in
meters; it is a probability mass under the modeled residual distribution.

### Negative log-likelihood cost

For a Gaussian residual, a principled association cost is:

```
cost_ij = 0.5 * y_ij^T S_ij^-1 y_ij
        + 0.5 * log(det(S_ij))
        - log(P_D)
```

where `P_D` is detection probability. Some implementations use only `d2` for
speed, but the `log(det(S))` term matters when different tracks have different
uncertainty volumes.

Add dummy assignments for missed detections and births:

```
track i -> miss:      cost = -log(1 - P_D)
measurement j -> new: cost = birth_cost(j)
```

### Linear assignment

For one-to-one matching between tracks and detections, construct a rectangular
cost matrix and solve:

```
min sum_i sum_j C[i,j] X[i,j]

subject to:
  sum_j X[i,j] <= 1
  sum_i X[i,j] <= 1
  X[i,j] in {0,1}
```

SciPy's `linear_sum_assignment` solves this problem for dense rectangular
matrices and, in current documentation, uses a modified Jonker-Volgenant
algorithm. It is frequently called a Hungarian-style assignment in tracking
literature, but current implementation details matter for performance and
rectangular cases.

### Hungarian, Jonker-Volgenant, and min-cost flow

| Method | Best fit | Notes |
|---|---|---|
| Nearest neighbor | tiny problems, debug baselines | Greedy; can fail when two tracks compete for one measurement. |
| Hungarian / Kuhn-Munkres | dense one-frame bipartite assignment | Classic polynomial-time global assignment. |
| Jonker-Volgenant | dense rectangular assignment | Efficient practical solver used by SciPy. |
| Min-cost flow | multi-frame linking, births/deaths, capacities | Natural for tracking-by-detection over time windows. |
| Integer programming | complex logical constraints | Powerful but harder to bound for real time. |

Min-cost flow generalizes assignment by representing detections as graph nodes
and possible temporal transitions as directed edges:

```
source -> birth -> detection_t -> transition -> detection_t+1 -> death -> sink
```

Costs encode detection likelihood, transition likelihood, birth, death, and
false positive penalties. The flow conservation constraints enforce coherent
track paths.

### Basic global nearest neighbor pipeline

```
for each sensor frame:
  predict all tracks to measurement timestamp
  build candidate pairs using geometry and class compatibility
  compute innovation y and covariance S for each candidate
  reject candidates with d2 above chi-squared gate
  fill cost matrix with likelihood costs and dummy costs
  solve assignment
  update matched tracks
  mark unmatched tracks as missed
  initialize candidate births from unmatched detections
  prune or confirm tracks using lifecycle logic
```

---

## Implementation notes

- Gate before assignment. A large finite cost can still be chosen if the matrix
  is crowded; use explicit disallowed edges for impossible pairings.
- Use timestamp-correct predictions. Associating at arrival time instead of
  acquisition time creates speed-dependent residuals.
- Keep class, extent, Doppler, and map constraints as separate explainable
  terms before collapsing into one scalar cost.
- Use numerically stable linear solves for `S^-1 y`; avoid explicit matrix
  inverse in hot paths.
- Normalize angle residuals before computing distance.
- Model sensor-specific residuals. Radar range/radial velocity residuals should
  not be treated like Cartesian LiDAR centroids.
- Track the cost components for diagnostics: geometry gate, Mahalanobis gate,
  class compatibility, Doppler compatibility, and dummy assignment cost.
- Use sparse representations when most pairs are gated out.

---

## Failure modes and diagnostics

| Failure mode | Symptom | Diagnostic |
|---|---|---|
| Gate too tight | Tracks drop during turns, occlusion, or sensor delay. | NIS histogram above expected chi-squared quantiles; high unmatched rate. |
| Gate too loose | Identity switches and improbable long jumps. | Large accepted `d2`; association edges crossing in time-space plots. |
| Wrong covariance | Good detections rejected or bad detections accepted. | Compare residual distribution to modeled `S`; inspect NIS by class/range. |
| Frame mismatch | Association biased by heading or lever arm. | Residual mean changes with ego yaw, pitch, or sensor mount. |
| Assignment without dummy costs | Forced bad matches when detections are missing. | Every track remains matched even in known dropout intervals. |
| Correlated measurements | Overconfident tracks after fusing derived outputs. | Covariance shrinks faster than independent evidence permits. |
| Class hard-gate error | Pedestrian/cyclist/vehicle track fragments after classifier flips. | Association failure coincides with low-confidence class changes. |
| Min-cost flow over-linking | Tracks bridge long occlusions incorrectly. | Long edges with weak transition likelihood dominate lifecycle costs. |

---

## Sources

- SciPy `linear_sum_assignment` documentation: https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.linear_sum_assignment.html
- Crouse, "On implementing 2D rectangular assignment algorithms": https://doi.org/10.1109/TAES.2016.140952
- SciPy chi-squared distribution documentation: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.chi2.html
- SciPy Mahalanobis distance documentation: https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.mahalanobis.html
- Google OR-Tools min-cost flow guide: https://developers.google.com/optimization/flow/mincostflow
- NetworkX `min_cost_flow` documentation: https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.flow.min_cost_flow.html
- Reid, "An Algorithm for Tracking Multiple Targets": https://graphics.stanford.edu/courses/cs428-03-spring/Papers/readings/CollaborativeProcessing/Reid_MHT_ieee_trans_ac_1979.pdf
