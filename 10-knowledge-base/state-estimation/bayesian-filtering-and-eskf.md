# Bayesian Filtering and Error-State Kalman Filters

Recursive state estimation is the machinery that turns noisy, asynchronous
measurements into the state used by localization, tracking, control, prediction,
runtime monitors, and safety fallback. The core problem is always the same:
estimate the current state and uncertainty from prior state, motion, and sensor
evidence.

This page covers Bayesian filtering, Kalman-family filters, particle filters,
and the error-state Kalman filter (ESKF) pattern used in many vehicle
localization stacks.

---

## 1. AV, Indoor, Outdoor, and Airside Relevance

| Domain | Estimation role | Typical state |
|---|---|---|
| Road AV | Fuse GNSS/INS, wheel odometry, LiDAR localization, radar tracks, camera odometry, and map constraints. | pose, velocity, attitude, IMU bias, wheel scale, covariance. |
| Indoor AMR | Maintain pose in GNSS-denied maps using LiDAR/vision/odometry and dock/fiducial updates. | 2D or 3D pose, velocity, wheel bias, localization health. |
| Outdoor industrial | Bridge GNSS multipath/dropouts with IMU, wheel odometry, LiDAR/radar localization, and site maps. | 6-DoF or ground-plane state with terrain and slip uncertainty. |
| Airside AV | Keep centimeter-to-decimeter localization near aircraft, terminals, markings, and surveyed zones while proving uncertainty for safety monitors. | RTK/INS/LiDAR/wheel fused state, timestamped covariance, map-frame validity. |

---

## 2. Bayesian Filtering Foundation

### 2.1 Recursive State Estimation

Let:

- `x_t` be the hidden state at time `t`
- `u_t` be control or motion input
- `z_t` be a measurement
- `p(x_t | z_1:t)` be the belief after measurements through `t`

The Bayes filter has two steps.

**Prediction:**

```
p(x_t | z_1:t-1) =
  integral p(x_t | x_{t-1}, u_t) p(x_{t-1} | z_1:t-1) dx_{t-1}
```

**Update:**

```
p(x_t | z_1:t) =
  eta * p(z_t | x_t) p(x_t | z_1:t-1)
```

where `eta` normalizes the distribution.

Every practical filter is an approximation to this recursion.

### 2.2 Filter Families

| Filter | Belief representation | Strength | Main risk |
|---|---|---|---|
| Kalman filter | single Gaussian, linear dynamics | Optimal for linear-Gaussian systems; fast and analyzable. | Not valid for nonlinear geometry without linearization. |
| Extended Kalman filter (EKF) | single Gaussian with local Jacobians | Simple and fast for moderate nonlinearity. | Can become inconsistent after poor linearization. |
| Error-state Kalman filter (ESKF) | nominal nonlinear state plus small Gaussian error | Strong fit for IMU and attitude estimation on manifolds. | Requires careful error reset, frame convention, and Jacobians. |
| Unscented Kalman filter (UKF) | sigma points through nonlinear functions | Avoids hand-coded Jacobians in some systems. | More compute; sigma-point tuning can be fragile. |
| Particle filter | weighted samples | Handles multi-modal beliefs and non-Gaussian likelihoods. | Particle degeneracy and high-dimensional state explosion. |
| IMM filter | mixture over motion models | Tracks mode changes such as stop/go/slip. | Mode probabilities can be overconfident. |
| Fixed-lag smoother / factor graph | windowed trajectory posterior | Better consistency and delayed measurement handling. | More compute and graph management complexity. |

---

## 3. Kalman Filter Core

For linear-Gaussian dynamics:

```
x_t = F x_{t-1} + B u_t + w_t,   w_t ~ N(0, Q)
z_t = H x_t     + v_t,           v_t ~ N(0, R)
```

Prediction:

```
x_pred = F x_prev + B u
P_pred = F P_prev F^T + Q
```

Update:

```
y = z - H x_pred
S = H P_pred H^T + R
K = P_pred H^T S^-1
x_new = x_pred + K y
P_new = (I - K H) P_pred
```

The innovation `y`, innovation covariance `S`, and gain `K` are also health
signals. A production estimator should monitor them, not just output pose.

---

## 4. Error-State Kalman Filter

### 4.1 Why Error-State?

Vehicle navigation states include orientation, and orientation does not live in
a flat vector space. The ESKF keeps a nonlinear nominal state and estimates only
a small local error.

Nominal state example:

```
x = [p, v, q, b_a, b_g]
```

where:

- `p`: position
- `v`: velocity
- `q`: orientation quaternion
- `b_a`: accelerometer bias
- `b_g`: gyroscope bias

Error state example:

```
delta_x = [delta_p, delta_v, delta_theta, delta_b_a, delta_b_g]
```

The filter propagates the nominal state with IMU integration and propagates a
small Gaussian covariance over `delta_x`.

### 4.2 Propagation

For IMU measurements:

```
omega = omega_meas - b_g - n_g
a_body = a_meas - b_a - n_a
```

Nominal propagation:

```
q_dot = 0.5 * q * omega
v_dot = R(q) * a_body + g
p_dot = v
```

Biases are often modeled as random walks:

```
b_a_dot = n_ba
b_g_dot = n_bg
```

The covariance is propagated through the linearized error dynamics:

```
P_pred = F_x P F_x^T + F_i Q_i F_i^T
```

### 4.3 Measurement Update and Error Injection

Measurements update the error state, not the nominal state directly.

```
delta_x = K * innovation
```

Then inject the error into the nominal state:

```
p <- p + delta_p
v <- v + delta_v
q <- q * Exp(delta_theta)
b_a <- b_a + delta_b_a
b_g <- b_g + delta_b_g
```

After injection, reset the error mean to zero and transform covariance if the
error definition requires it. This reset step is one of the most important
differences between a correct ESKF and an EKF that merely stores a quaternion.

### 4.4 Measurement Examples

| Measurement | Residual example | Notes |
|---|---|---|
| GNSS position | `z_gnss - (p + R(q) lever_arm)` | Must include antenna lever arm and GNSS covariance quality. |
| Wheel odometry | measured forward speed minus predicted body-frame speed | Slip and steering geometry affect noise. |
| LiDAR localization | `Log(T_lidar_map_meas^-1 * T_lidar_map_pred)` | Use pose covariance from scan matching, not a fixed guess only. |
| Magnetometer / heading | wrapped yaw residual | Risky near vehicles, aircraft, buildings, motors. |
| Zero velocity update | `v_body = 0` | Useful for stops and docking if truly stationary. |
| Level / gravity update | roll/pitch residual to gravity | Ground vehicles can use cautiously; slopes and ramps matter. |

---

## 5. Consistency, Gating, and Health

### 5.1 Innovation Gating

Use Mahalanobis distance to gate measurements:

```
d^2 = y^T S^-1 y
```

Reject or down-weight measurements when `d^2` exceeds a chi-squared threshold
for the residual dimension. This prevents a single GNSS multipath point or bad
scan match from corrupting the estimator.

### 5.2 NIS and NEES

The normalized innovation squared (NIS) checks measurement consistency:

```
NIS = y^T S^-1 y
```

The normalized estimation error squared (NEES) checks state consistency when
ground truth is available:

```
NEES = e^T P^-1 e
```

If NIS/NEES are consistently too high, the filter is overconfident or the model
is wrong. If they are consistently too low, the filter may be too conservative
or measurement noise may be overestimated.

### 5.3 Delays and Out-of-Sequence Measurements

Autonomy sensors are asynchronous. A camera detection, LiDAR scan, or GNSS fix
may arrive after newer IMU propagation has already happened.

Production options:

- maintain a state history and update at the measurement timestamp
- use fixed-lag smoothing
- compensate known delay in the measurement model
- reject measurements that arrive beyond a maximum age

Ignoring delay is equivalent to injecting a spatial error proportional to speed
and yaw rate.

---

## 6. Practical Deployment Notes

### 6.1 Estimator Architecture

A common vehicle estimator structure:

```
High-rate IMU propagation: 100-1000 Hz
Wheel odometry update:     20-100 Hz
LiDAR localization update:  5-20 Hz
GNSS update:                1-20 Hz
Output fused state:        20-100 Hz
Health monitor:            every update
```

The estimator should publish:

- pose and velocity
- covariance
- frame ID and child frame ID
- timestamp of the estimate
- status of each sensor update path
- innovation/gating diagnostics
- degraded-state reason codes

### 6.2 Noise Tuning

Good noise models come from three sources:

1. **Datasheets:** start with IMU noise density, bias instability, GNSS fix quality, encoder resolution.
2. **Static and controlled tests:** estimate bias, timestamp jitter, and stationary covariance.
3. **Replay validation:** compare residual distributions against expected chi-squared behavior.

Avoid tuning covariance only until the path "looks smooth." Smooth wrong
localization is worse than visibly uncertain localization.

### 6.3 Filter vs Smoother

Use a filter when:

- bounded compute and latency dominate
- the state is mostly current-time pose and velocity
- sensor delays are small and well characterized

Use a smoother or factor graph when:

- delayed measurements are important
- loop closures or scan-to-map corrections matter
- calibration variables or biases need joint estimation
- incident replay and map building require full trajectory consistency

Many production stacks use both: an ESKF for low-latency state output and a
fixed-lag smoother or factor graph for higher-consistency localization.

---

## 7. Failure Modes and Risks

| Failure mode | Symptom | Mitigation |
|---|---|---|
| Overconfident covariance | Filter rejects good measurements or accepts bad state as certain. | NIS/NEES checks, covariance inflation, empirical residual calibration. |
| Unobservable state | Yaw, bias, scale, or lateral position drifts without clear residuals. | Analyze observability; add constraints or degrade when conditions are insufficient. |
| Wrong frame for covariance | Gating and fusion behave inconsistently across turns. | Define covariance frame and transform covariance with rotation/adjoint. |
| Double-counted measurements | Filter becomes artificially certain because correlated sources are fused as independent. | Track measurement lineage; avoid fusing both raw and derived signals as independent. |
| Delayed timestamp | Pose is biased during turns and acceleration. | Update at acquisition time or use delay compensation/history. |
| Bad initialization | EKF/ESKF converges to wrong local state or diverges. | Use robust initialization, staged sensor enabling, and reset policies. |
| Particle depletion | Particle filter collapses to too few hypotheses. | Resample carefully, increase particles, improve proposal distribution. |
| Bias model mismatch | IMU/wheel bias changes faster than the filter allows. | Model random walk realistically and detect shocks or maintenance events. |
| Measurement gating too aggressive | Estimator ignores recovery measurements after degradation. | Use recovery-specific gates or multi-hypothesis logic. |

---

## Related Repository Documents

- [GTSAM Factor Graph Optimization](gtsam-factor-graphs.md)
- [RTK-GPS, IMU, and Multi-Sensor Localization](rtk-gps-imu-localization.md)
- [Coordinate Frames, Projections, and SE(3)](../geometry-3d/coordinate-frames-projections-se3.md)
- [Sensor Calibration and Time Synchronization](../geometry-3d/sensor-calibration-time-synchronization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../../30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md)
- [Production LiDAR-to-Map Localization](../../30-autonomy-stack/localization-mapping/overview/production-lidar-map-localization.md)
- [LiDAR SLAM Algorithms](../../30-autonomy-stack/localization-mapping/overview/lidar-slam-algorithms.md)

---

## Sources

- Kalman, "A New Approach to Linear Filtering and Prediction Problems": https://www.cs.unc.edu/~welch/kalman/media/pdf/Kalman1960.pdf
- Welch and Bishop, "An Introduction to the Kalman Filter": https://www.cs.unc.edu/~welch/media/pdf/kalman_intro.pdf
- Sola, "Quaternion kinematics for the error-state Kalman filter": https://arxiv.org/abs/1711.02508
- Sola et al., "A micro Lie theory for state estimation in robotics": https://arxiv.org/abs/1812.01537
- Julier and Uhlmann, "Unscented Filtering and Nonlinear Estimation": https://www.cs.unc.edu/~welch/kalman/media/pdf/ACC02-IEEE1357.PDF
- Doucet, de Freitas, and Gordon, "Sequential Monte Carlo Methods in Practice": https://link.springer.com/book/10.1007/978-1-4757-3437-9
- Autoware `ekf_localizer` documentation: https://autowarefoundation.github.io/autoware.universe_planning/pr-5583/localization/ekf_localizer/
- ROS `robot_localization` state estimation nodes: https://docs.ros.org/en/kinetic/api/robot_localization/html/state_estimation_nodes.html
- GTSAM IMU factor notes: https://gtsam.org/notes/IMU-Factor.html
- Forster et al., "On-Manifold Preintegration for Real-Time Visual-Inertial Odometry": https://arxiv.org/abs/1512.02363
