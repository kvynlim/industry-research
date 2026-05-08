# Robust State Estimation and Multi-Sensor Localization Fusion for Airside Autonomous Vehicles

State estimation is the computational layer that transforms noisy, potentially degraded measurements from multiple sensors into a single coherent estimate of where the vehicle is, how fast it is moving, and how confident it is in those answers. For Aurrigo's airside autonomous GSE operating with 4-8 RoboSense LiDARs, a 500 Hz IMU, RTK-GPS, wheel encoders, and a GTSAM factor graph backend, the state estimation layer sits between raw sensor drivers and the SLAM/planning systems. It must produce a pose estimate at 200+ Hz (for control), handle sensor dropout gracefully (GPS multipath near aircraft, LiDAR blinding from de-icing spray), detect and reject faulty measurements (RTK false fixes from terminal reflections), maintain calibrated uncertainty (so the planning layer knows when to slow down), and do all of this within a 1-2 ms computational budget on NVIDIA Orin. The existing repository documents cover individual sensor modalities (RTK-GPS and IMU fundamentals in `10-knowledge-base/state-estimation/rtk-gps-imu-localization.md`), the GTSAM factor graph backend (`10-knowledge-base/state-estimation/gtsam-factor-graphs.md`), LiDAR odometry algorithms (`30-autonomy-stack/localization-mapping/overview/lidar-slam-algorithms.md`), place recognition for loop closure (`30-autonomy-stack/localization-mapping/overview/lidar-place-recognition-relocalization.md`), sensor health monitoring (`20-av-platform/sensors/sensor-degradation-health-monitoring.md`), and perception-level fusion (`30-autonomy-stack/perception/overview/sensor-fusion-architectures.md`). What is missing -- and what this document fills -- is the principled mathematical framework for combining all these sources into one robust ego-state estimate: the filter architectures (EKF, ESKF, UKF, IEKF), the sensor validation gates that catch faulty measurements before they corrupt the state, the multi-hypothesis tracking needed when the vehicle could be in multiple locations, the dead-reckoning budgets for GPS-denied operation, the covariance management that keeps uncertainty estimates honest, and the fleet-level consistency that ensures 20+ vehicles agree on where they are relative to each other and the airport map. The key finding: an Error-State Kalman Filter (ESKF) with quaternion error parameterization, chi-squared innovation gating, and adaptive noise estimation provides the optimal balance of robustness, computational efficiency (<0.5 ms per update on Orin), and certifiability for ISO 3691-4 compliance -- and it is what every major production AV system (Waymo, Apollo, Autoware) uses as its state estimation backbone.

---

## Table of Contents

1. [State Estimation Fundamentals for Driving](#1-state-estimation-fundamentals-for-driving)
2. [Error-State Kalman Filter Deep Dive](#2-error-state-kalman-filter-deep-dive)
3. [Multi-Sensor Fusion Architecture](#3-multi-sensor-fusion-architecture)
4. [Sensor Validation and Fault Detection](#4-sensor-validation-and-fault-detection)
5. [Multi-Hypothesis State Estimation](#5-multi-hypothesis-state-estimation)
6. [GPS-Denied and Degraded Operation](#6-gps-denied-and-degraded-operation)
7. [Covariance Management and Adaptive Estimation](#7-covariance-management-and-adaptive-estimation)
8. [Fleet-Level State Consistency](#8-fleet-level-state-consistency)
9. [Orin Implementation and Computational Budgets](#9-orin-implementation-and-computational-budgets)
10. [ROS Noetic Integration](#10-ros-noetic-integration)
11. [Airside-Specific Scenarios and Failure Analysis](#11-airside-specific-scenarios-and-failure-analysis)
12. [Key Takeaways](#12-key-takeaways)
13. [Cost and Implementation Roadmap](#13-cost-and-implementation-roadmap)
14. [References](#14-references)

---

## 1. State Estimation Fundamentals for Driving

### 1.1 The State Estimation Problem

An autonomous vehicle must continuously answer three questions: Where am I? How am I moving? How certain am I? The state estimation problem formalizes this as recursive Bayesian estimation over a state vector that captures the vehicle's pose (position + orientation), velocity, and sensor biases.

For Aurrigo's vehicles (ADT3, STL2, POD, ACA1) operating on airport aprons at 1-25 km/h:

```
Full state vector x ∈ R^16:

x = [p, q, v, b_a, b_g]

where:
  p   ∈ R^3     Position in world frame (East-North-Up or local airport frame)
  q   ∈ S^3     Orientation as unit quaternion (4 parameters, 1 constraint)
  v   ∈ R^3     Velocity in world frame
  b_a ∈ R^3     Accelerometer bias (slowly time-varying)
  b_g ∈ R^3     Gyroscope bias (slowly time-varying)

Total: 3 + 4 + 3 + 3 + 3 = 16 parameters
Degrees of freedom: 15 (quaternion has 1 constraint: ||q|| = 1)
```

For the ADT3 with crab steering, the state vector may be augmented:

```
Extended state for crab-steer vehicles:

x_ext = [p, q, v, b_a, b_g, δ_f, δ_r]

where:
  δ_f ∈ R       Front axle steering angle
  δ_r ∈ R       Rear axle steering angle (unique to crab-steer)

Total: 18 parameters, 17 DoF

Crab steering means the vehicle can translate laterally without
changing heading — the kinematic model differs from standard Ackermann:

  v_x = v * cos(β)
  v_y = v * sin(β)
  ω   = v * (tan(δ_f) - tan(δ_r)) / L

where β = atan((L_r*tan(δ_f) + L_f*tan(δ_r)) / L) is the sideslip angle
and L = L_f + L_r is the wheelbase.

In pure crab mode (δ_f = δ_r): ω = 0, β = δ_f, vehicle translates diagonally.
In standard Ackermann (δ_r = 0): reduces to classic bicycle model.
```

### 1.2 Filter Taxonomy

| Filter | Mathematical Basis | Linearity Assumption | Computational Cost | Typical Latency (Orin) | Best For |
|--------|-------------------|---------------------|--------------------|----------------------|----------|
| **EKF** | First-order Taylor | Locally linear | O(n^3) | 0.05-0.1 ms | Simple systems, small state |
| **ESKF** | Error-state + nominal | Error is small, linear | O(n^3) on error state | 0.1-0.3 ms | IMU-centric fusion (production AV standard) |
| **UKF** | Sigma points | Captures second-order | O(n^3), 2n+1 sigma pts | 0.3-0.8 ms | Highly nonlinear, no Jacobians needed |
| **IEKF** | Iterated update | Converges to MAP | O(n^3) * k iterations | 0.2-0.5 ms | Better linearization at update |
| **InEKF** | Lie group invariant | Group-affine dynamics | O(n^3) | 0.1-0.3 ms | SE_2(3) state, guaranteed convergence |
| **Particle Filter** | Monte Carlo sampling | None (fully nonlinear) | O(N_particles * n) | 5-50 ms | Multi-modal, kidnapped robot |
| **GTSAM/ISAM2** | Factor graph smoothing | Nonlinear least squares | Amortized incremental | 5-20 ms | Full trajectory optimization |

**Recommendation for Aurrigo:** ESKF as the primary high-rate filter (200-500 Hz), feeding into GTSAM ISAM2 as the backend smoother (10 Hz). This is the architecture used by Apollo, Autoware, and most production AV stacks. The ESKF provides low-latency pose estimates for vehicle control, while GTSAM provides globally consistent, smoothed estimates for mapping and planning.

### 1.3 Why EKF Fails for IMU Fusion

The standard Extended Kalman Filter applies directly to the full nonlinear state:

```
Prediction:  x̂_k|k-1 = f(x̂_k-1|k-1, u_k)
             P_k|k-1 = F_k * P_k-1|k-1 * F_k^T + Q_k

Update:      K_k = P_k|k-1 * H_k^T * (H_k * P_k|k-1 * H_k^T + R_k)^(-1)
             x̂_k|k = x̂_k|k-1 + K_k * (z_k - h(x̂_k|k-1))
             P_k|k = (I - K_k * H_k) * P_k|k-1
```

Three problems arise when applying EKF directly to IMU-based state estimation:

1. **Quaternion normalization**: The state includes a unit quaternion q with ||q|| = 1. After each EKF update, the quaternion must be re-normalized, violating the Gaussian assumption. The covariance P has a 4x4 block for the quaternion but only 3 degrees of freedom — the covariance matrix is inherently rank-deficient.

2. **Large prediction steps at 500 Hz**: While each IMU step is small, the integration of rotation involves multiplicative updates on SO(3), not additive updates in R^3. The EKF linearization around the full quaternion state introduces unnecessary error.

3. **Singularities in other rotation representations**: Euler angles suffer from gimbal lock. Rotation vectors avoid it but have poor linearization properties far from zero.

The Error-State Kalman Filter resolves all three issues by separating the large nominal state (propagated mechanistically) from the small error state (estimated by the filter).

### 1.4 Unscented Kalman Filter (UKF)

The UKF avoids Jacobian computation entirely by propagating sigma points through the nonlinear functions:

```python
def ukf_predict(x, P, f, Q, dt):
    """UKF prediction step using sigma points."""
    n = len(x)
    alpha, beta, kappa = 1e-3, 2.0, 0.0
    lam = alpha**2 * (n + kappa) - n

    # Generate 2n+1 sigma points
    L = np.linalg.cholesky((n + lam) * P)
    sigmas = np.zeros((2*n + 1, n))
    sigmas[0] = x
    for i in range(n):
        sigmas[i+1]     = x + L[i]
        sigmas[n+i+1]   = x - L[i]

    # Propagate through dynamics
    sigmas_pred = np.array([f(s, dt) for s in sigmas])

    # Weighted mean and covariance
    W_m = np.full(2*n + 1, 1.0 / (2*(n + lam)))
    W_c = np.full(2*n + 1, 1.0 / (2*(n + lam)))
    W_m[0] = lam / (n + lam)
    W_c[0] = lam / (n + lam) + (1 - alpha**2 + beta)

    x_pred = np.sum(W_m[:, None] * sigmas_pred, axis=0)
    P_pred = Q.copy()
    for i in range(2*n + 1):
        d = sigmas_pred[i] - x_pred
        P_pred += W_c[i] * np.outer(d, d)

    return x_pred, P_pred, sigmas_pred, W_m, W_c
```

**When UKF beats ESKF:**
- State vector includes highly nonlinear terms (e.g., range-bearing measurements to landmarks)
- Jacobians are difficult to derive or numerically unstable
- Second-order effects matter (large uncertainty, coarse sensor)

**When ESKF beats UKF:**
- High-rate updates (500 Hz IMU — computing 31 sigma points at 500 Hz costs 3-5x more than ESKF)
- State lives on a Lie group (SO(3), SE(3)) where sigma point generation requires special handling
- Production deployment where analytical Jacobians provide deterministic timing

For Aurrigo: **ESKF wins**. The 500 Hz IMU rate makes UKF's sigma point propagation expensive, and the rotation state is naturally handled by ESKF's error parameterization. However, UKF is useful for initializing the filter from ambiguous sensor data (e.g., GPS multipath scenarios with large initial uncertainty).

### 1.5 Particle Filters

Particle filters represent the posterior distribution as a set of weighted samples, making them the only filter family that handles arbitrary nonlinearities and multimodal distributions:

```
Particle filter (Sequential Monte Carlo):

Initialize: {x^(i), w^(i)}  for i = 1..N, w^(i) = 1/N

For each timestep:
  1. Predict:  x^(i)_k|k-1 ~ p(x_k | x^(i)_k-1, u_k)   (sample from dynamics)
  2. Update:   w^(i)_k = p(z_k | x^(i)_k|k-1)             (likelihood weighting)
  3. Normalize: w^(i)_k = w^(i)_k / Σ w^(j)_k
  4. Resample:  if N_eff < N/2, systematic resample

State estimate: x̂_k = Σ w^(i)_k * x^(i)_k
```

**Particle count requirements for localization:**

| State Dimension | Particles Needed | Orin Latency | Use Case |
|----------------|-----------------|-------------|----------|
| 3 (x, y, θ) | 100-1,000 | 0.5-5 ms | 2D relocalization |
| 6 (SE(3)) | 1,000-10,000 | 5-50 ms | 6-DoF kidnapped robot recovery |
| 15 (full state) | 100,000+ | Infeasible | Not practical for full state |

For Aurrigo, particle filters are useful only for specific sub-problems: global relocalization after kidnapped robot events and multi-hypothesis tracking when GPS gives ambiguous fixes. They should not replace the ESKF for continuous state estimation.

### 1.6 Invariant Extended Kalman Filter (InEKF)

The InEKF (Barrau & Bonnabel, 2017) exploits the Lie group structure of the state space. For autonomous driving, the state lives on SE_2(3) — the group of extended poses including rotation, velocity, and position:

```
State as matrix Lie group element X ∈ SE_2(3):

X = [R  v  p]     ∈ R^(5×5)
    [0  1  0]
    [0  0  1]

where R ∈ SO(3), v ∈ R^3, p ∈ R^3

Right-invariant error: η_R = X * X̂^(-1)
Left-invariant error:  η_L = X̂^(-1) * X

Key property: For group-affine dynamics (which IMU integration satisfies),
the error dynamics are INDEPENDENT of the state estimate.

Consequence: The InEKF's linearization error does not depend on
the quality of the current estimate — convergence is guaranteed
from any initial condition (for observable systems).
```

**InEKF vs ESKF:**
- InEKF has provably larger convergence basin (guaranteed for group-affine systems)
- ESKF is better understood, more widely implemented, and sufficient when initial uncertainty is modest
- InEKF implementations exist in C++ (invariant-ekf, IMSCKF) but are less mature than ESKF libraries

**Recommendation:** Start with ESKF (Section 2), consider InEKF upgrade if convergence issues arise in practice (e.g., after prolonged GPS denial with poor initialization).

---

## 2. Error-State Kalman Filter Deep Dive

### 2.1 The ESKF Concept

The ESKF separates the state into two parts:

```
x_true = x_nominal ⊕ δx

where:
  x_nominal  — Large, deterministic state propagated by IMU mechanization
  δx         — Small error state estimated by the Kalman filter
  ⊕          — Composition operator (additive for Euclidean, multiplicative for quaternion)

The key insight: δx is always small (near zero), so linearization is always valid.
The nominal state handles all the nonlinearity through direct integration.
```

### 2.2 Nominal State Propagation (IMU Mechanization)

At each IMU measurement (500 Hz for Aurrigo's Microstrain GX5), the nominal state is propagated:

```python
def propagate_nominal(state, imu, dt):
    """
    Propagate nominal state using IMU measurements.

    state: {p, v, q, b_a, b_g}  (position, velocity, quaternion, biases)
    imu: {a_m, w_m}  (measured acceleration, angular velocity)
    dt: time step (0.002s at 500 Hz)
    """
    # Remove bias from measurements
    a_body = imu.a_m - state.b_a     # Corrected acceleration in body frame
    w_body = imu.w_m - state.b_g     # Corrected angular velocity in body frame

    # Rotation matrix from body to world
    R = quaternion_to_rotation_matrix(state.q)

    # Position update (trapezoidal or RK4 for better accuracy)
    a_world = R @ a_body + g          # g = [0, 0, -9.81]^T in ENU
    state.p = state.p + state.v * dt + 0.5 * a_world * dt**2

    # Velocity update
    state.v = state.v + a_world * dt

    # Quaternion update (first-order integration)
    omega_quat = np.array([0, w_body[0], w_body[1], w_body[2]])
    state.q = state.q + 0.5 * quaternion_multiply(state.q, omega_quat) * dt
    state.q = state.q / np.linalg.norm(state.q)  # Normalize

    # Biases modeled as random walk — no change in nominal propagation
    # state.b_a unchanged
    # state.b_g unchanged

    return state
```

### 2.3 Error-State Dynamics

The error state uses a minimal parameterization — critically, the orientation error is a 3-vector (axis-angle), not a 4-vector quaternion:

```
Error state δx ∈ R^15:

δx = [δp, δv, δθ, δb_a, δb_g]

where:
  δp   ∈ R^3   Position error
  δv   ∈ R^3   Velocity error
  δθ   ∈ R^3   Orientation error (rotation vector / axis-angle)
  δb_a ∈ R^3   Accelerometer bias error
  δb_g ∈ R^3   Gyroscope bias error

The quaternion error relationship:
  q_true = q_nominal ⊗ δq
  δq ≈ [1, δθ/2]  (small-angle approximation, always valid for ESKF)

This avoids the rank-deficiency problem of EKF on quaternions.
The covariance P is 15×15, full rank, well-conditioned.
```

The error-state dynamics are linearized (and the linearization is accurate because δx is always small):

```
Error-state prediction:

δx_k+1 = F_k * δx_k + G_k * n_k

where n_k = [n_a, n_g, n_ba, n_bg] is the noise vector

    ┌          ┐   ┌                                                   ┐   ┌      ┐
    │ δp_k+1   │   │ I   I*dt   0        0       0                    │   │ δp_k  │
    │ δv_k+1   │   │ 0   I     -R[a]×dt  -R*dt   0                    │   │ δv_k  │
    │ δθ_k+1   │ = │ 0   0      Exp(-w*dt) 0     -I*dt                │ * │ δθ_k  │
    │ δb_a_k+1 │   │ 0   0      0        I       0                    │   │ δb_a_k│
    │ δb_g_k+1 │   │ 0   0      0        0       I                    │   │ δb_g_k│
    └          ┘   └                                                   ┘   └      ┘

where:
  R = rotation matrix from body to world
  [a]× = skew-symmetric matrix of corrected acceleration
  Exp(-w*dt) ≈ I - [w]×*dt  (first-order rotation)
  I = 3×3 identity

Covariance prediction:
  P_k+1 = F_k * P_k * F_k^T + G_k * Q * G_k^T

Process noise Q = diag(σ²_a, σ²_g, σ²_ba, σ²_bg):
  σ_a  = 80 µg/√Hz * √(500)  ≈ 0.018 m/s²  (Microstrain GX5 accel noise)
  σ_g  = 0.005°/s/√Hz * √(500) ≈ 0.0020 rad/s  (gyro noise)
  σ_ba = √(2 * 0.04mg/3600s)  ≈ 4.7e-5 m/s²/√s  (accel bias random walk)
  σ_bg = √(2 * 8°/hr/3600s)   ≈ 7.0e-5 rad/s/√s  (gyro bias random walk)
```

### 2.4 Sensor Update Equations

When a sensor measurement arrives, the error state is updated:

```python
def eskf_update(delta_x, P, z, h, H, R):
    """
    ESKF measurement update.

    delta_x: error state (15,)   — typically near zero before update
    P:       error covariance (15,15)
    z:       measurement vector
    h:       predicted measurement from nominal state
    H:       measurement Jacobian w.r.t. error state (not full state!)
    R:       measurement noise covariance
    """
    # Innovation
    y = z - h                              # Innovation (measurement residual)
    S = H @ P @ H.T + R                    # Innovation covariance

    # Kalman gain
    K = P @ H.T @ np.linalg.inv(S)        # Or solve via Cholesky: S \ (H @ P)

    # Error state update
    delta_x = delta_x + K @ y

    # Covariance update (Joseph form for numerical stability)
    I_KH = np.eye(15) - K @ H
    P = I_KH @ P @ I_KH.T + K @ R @ K.T

    return delta_x, P
```

After the update, the error state is **injected** back into the nominal state:

```python
def inject_error_state(nominal, delta_x):
    """
    Inject error state into nominal state and reset error to zero.
    This is the 'reset' step unique to ESKF.
    """
    # Position and velocity: additive
    nominal.p += delta_x[0:3]
    nominal.v += delta_x[3:6]

    # Orientation: multiplicative quaternion update
    delta_theta = delta_x[6:9]
    delta_q = np.array([1.0, delta_theta[0]/2, delta_theta[1]/2, delta_theta[2]/2])
    delta_q = delta_q / np.linalg.norm(delta_q)
    nominal.q = quaternion_multiply(nominal.q, delta_q)
    nominal.q = nominal.q / np.linalg.norm(nominal.q)

    # Biases: additive
    nominal.b_a += delta_x[9:12]
    nominal.b_g += delta_x[12:15]

    # Reset error state to zero
    delta_x = np.zeros(15)

    # Reset covariance rotation (accounts for the injection)
    # G = I - [delta_theta/2]×  (small rotation correction to P)
    # P = G @ P @ G.T  (typically negligible, omit for simplicity)

    return nominal, delta_x
```

### 2.5 Measurement Models for Each Sensor

**RTK-GPS (2 Hz):**

```
Measurement: z_gps = [lat, lon, alt, fix_type, HDOP, num_sats]

Converted to local frame: z_pos = [x, y, z] in airport ENU

h(x) = p_nominal + δp + R_nominal * lever_arm_gps

H_gps = [I_3   0_3   -R*[lever_arm]×   0_3   0_3]   (3×15)

Noise R_gps depends on fix quality:
  RTK fixed:  σ = [0.01, 0.01, 0.02] m  (1-2 cm)
  RTK float:  σ = [0.10, 0.10, 0.20] m  (10-20 cm)
  DGNSS:      σ = [0.50, 0.50, 1.00] m  (50-100 cm)
  SPS:        σ = [2.00, 2.00, 4.00] m  (2-4 m)
  No fix:     REJECT (do not update)
```

**VGICP Pose (10 Hz, from GTSAM LiDAR odometry):**

```
Measurement: z_vgicp = T_odom ∈ SE(3)  (relative pose from scan matching)

Convert to position + orientation increments:
  z_pos = T_odom.translation()
  z_rot = T_odom.rotation().log()   (rotation vector)

For relative odometry (BetweenFactor-style):
  h(x_k, x_k-1) = x_k-1^(-1) * x_k    (predicted relative motion)
  y = z_vgicp ⊖ h(x_k, x_k-1)          (SE(3) residual)

H is the Jacobian of the relative pose w.r.t. the error states at both times.

Noise: From VGICP Hessian inversion (see gtsam-factor-graphs.md Section 6)
  Typical σ_trans = [0.01-0.05] m, σ_rot = [0.001-0.01] rad
  Increases during degenerate geometry (long corridors, open aprons)
```

**Wheel Odometry (50-100 Hz):**

```
Measurement: z_wheel = [v_left, v_right, δ_front, δ_rear]

For standard Ackermann (STL2, POD):
  v = (v_left + v_right) / 2
  ω = (v_right - v_left) / track_width

For crab steer (ADT3):
  v_x = v * cos(β)
  v_y = v * sin(β)
  ω = v * (tan(δ_f) - tan(δ_r)) / L

Wheel odometry velocity in body frame:
  h(x) = R^T * (v_nominal + δv) + [ω]× * lever_arm_rear_axle

H_wheel depends on vehicle type:
  Ackermann: H = [0_3  R^T  0_3  0_3  0_3]  (velocity only)
  Crab steer: requires extended Jacobian for sideslip angle

Noise:
  σ_v = 0.02 * v + 0.01   (2% of speed + 1 cm/s floor, captures wheel slip)
  σ_ω = 0.05 rad/s         (depends on track width uncertainty)

Wheel slip detection (critical on wet tarmac):
  If |v_wheel - v_imu| > 3σ for >0.5s → flag slip, inflate R by 10x
```

**Place Recognition Loop Closure (event-triggered):**

```
Measurement: z_loop = T_relative ∈ SE(3)  (from ICP verification)

This is an absolute or relative pose constraint between current pose
and a previously mapped pose. In the ESKF, it acts as a position +
orientation update:

  h(x) = p_nominal + δp                    (if absolute)
  h(x) = T_map_pose^(-1) * T_current       (if relative)

H depends on the parameterization. For absolute position from loop closure:
  H_loop = [I_3  0_3  0_3  0_3  0_3]       (position only, 3×15)

For full 6-DoF loop closure:
  H_loop = [I_3  0_3  -[R*p_body]×  0_3  0_3]
           [0_3  0_3   I_3          0_3  0_3]

Noise: From ICP Hessian + descriptor confidence
  σ_trans = [0.05-0.20] m
  σ_rot = [0.005-0.02] rad
  
CRITICAL: Loop closures must pass chi-squared gate (Section 4) before update.
False loop closures are the most dangerous measurement fault.
```

### 2.6 Why ESKF Is the Production Standard

| Property | Standard EKF | ESKF | Why It Matters |
|----------|-------------|------|----------------|
| Orientation representation | Full quaternion (4D) | Error angle (3D) | No rank deficiency in covariance |
| Linearization point | Potentially far from truth | Always near zero | Linearization always accurate |
| Covariance size | 16x16 (with normalization issues) | 15x15 (minimal) | Clean, well-conditioned |
| IMU integration | Through filter (corrupts by linearization) | Direct mechanization (exact) | No linearization error in propagation |
| Quaternion normalization | Required after every update | Never needed on error state | No constraint violation |
| Bias estimation | Same framework, but less accurate | Naturally decoupled | Better observability analysis |
| Implementation | Simpler code, worse results | Slightly more code, robust results | Production systems need robustness |

Every production AV localization system the author is aware of uses ESKF or a close variant:

- **Apollo** (Baidu): ESKF with multi-sensor fusion module (MSF), 100 Hz output
- **Autoware** (Open Source): `ndt_scan_matcher` + `ekf_localizer` (ESKF-based)
- **Waymo**: Proprietary ESKF variant with learned noise models
- **comma.ai**: openpilot uses ESKF (called "locationd") with live calibration
- **LIO-SAM** (MIT): ESKF for IMU preintegration within factor graph

---

## 3. Multi-Sensor Fusion Architecture

### 3.1 Tightly-Coupled vs Loosely-Coupled

```
LOOSELY COUPLED:
  Each sensor has its own filter/estimator
  Outputs are fused in a master filter

  IMU + Wheel → Dead Reckoning Filter → pose_DR
  LiDAR → VGICP/SLAM → pose_SLAM               → Master EKF → Final pose
  GPS → RTK solution → pose_GPS

  Pro: Modular, each subsystem testable independently
  Con: Ignores cross-correlations, suboptimal, double-counts information
  Risk: If dead reckoning filter is overconfident, master filter trusts it too much

TIGHTLY COUPLED:
  All raw measurements go into one filter

  IMU (500 Hz)     ─┐
  Wheel (100 Hz)    ├─→  Single ESKF  → Final pose
  VGICP (10 Hz)    ─┤
  GPS (2 Hz)       ─┘

  Pro: Optimal (no information loss), proper cross-correlation handling
  Con: More complex, harder to debug, single point of failure
  Risk: Bad measurement from one sensor can corrupt entire state

RECOMMENDED FOR AURRIGO — Hybrid (Medium Coupling):
  IMU + Wheel → ESKF (500 Hz, tightly coupled)
  VGICP poses → ESKF correction (10 Hz, loosely coupled via pose)
  GPS → ESKF correction (2 Hz, loosely coupled via position)
  All the above → GTSAM ISAM2 backend (10 Hz, tightly coupled factor graph)

  This gives:
  - 500 Hz pose output for vehicle control (ESKF)
  - 10 Hz globally-consistent pose for planning (GTSAM)
  - Clear separation of concerns for debugging and certification
```

### 3.2 Sensor Timing and Synchronization

Correct sensor fusion requires careful handling of asynchronous, multi-rate measurements:

```
Timeline for one 100ms window:

Time(ms):  0    2    4    6    8    10 ... 50 ... 100
IMU:       |    |    |    |    |    |  ... |  ... |     (500 Hz, every 2ms)
Wheel:     |                   |          |       |     (100 Hz, every 10ms)
VGICP:                                    |             (10 Hz, every 100ms)
GPS:                                                 |  (2 Hz, every 500ms)
Loop:                                          [event]  (sporadic)

ESKF propagation: At EVERY IMU tick (500 Hz)
ESKF updates:     At sensor arrival time

Key challenge: Sensor measurements arrive with LATENCY:
  IMU:    <1 ms   (direct hardware interrupt)
  Wheel:  1-5 ms  (CAN bus)
  VGICP:  20-50 ms (LiDAR scan matching compute time)
  GPS:    50-200 ms (RTK solution + NTRIP)
  Loop:   50-150 ms (descriptor matching + ICP)
```

**Handling delayed measurements:**

```python
def handle_delayed_measurement(eskf, z, t_measurement, t_current, sensor_type):
    """
    Handle a measurement that arrives at t_current but
    was captured at t_measurement < t_current.

    Two approaches:
    """
    delay = t_current - t_measurement

    if delay < 50e-3:  # <50ms: propagate measurement to current time
        # Simple: treat measurement as if it arrived now
        # Acceptable for GPS (slow dynamics at 1-25 km/h)
        eskf.update(z, sensor_type)

    elif delay < 200e-3:  # 50-200ms: state augmentation or buffer replay
        # Option A: Maintain a buffer of recent ESKF states
        #           Roll back to t_measurement, apply update, re-propagate
        eskf.rollback_to(t_measurement)
        eskf.update(z, sensor_type)
        eskf.replay_imu_from(t_measurement, t_current)

        # Option B: Augment state with delayed clone
        #           (used in MSCKF for visual features)

    else:  # >200ms: discard or use as prior only
        log_warning(f"Measurement too old: {delay*1000:.0f}ms, discarding")
```

For Aurrigo, the practical approach is to maintain a circular buffer of the last 500 ms of ESKF states (250 entries at 500 Hz, ~60 KB of memory). When a delayed measurement arrives, roll back, apply, and replay. This is how LIO-SAM and FAST-LIO2 handle delayed GNSS measurements.

### 3.3 Full Fusion Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SENSOR HARDWARE                                │
│  Microstrain GX5 (500Hz)  |  RoboSense x4-8  |  u-blox F9P  |  CAN  │
└──────────┬────────────────────────┬──────────────────┬──────────┬──────┘
           │                        │                  │          │
     IMU raw data            Point clouds         RTCM + PVT    Encoders
     (500 Hz)                (10 Hz each)          (2 Hz)       (100 Hz)
           │                        │                  │          │
           ▼                        ▼                  ▼          ▼
┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  ┌────────┐
│ Bias Correction │  │ Multi-LiDAR      │  │ RTK Solution  │  │ Wheel  │
│ (subtract b_a,  │  │ Merge + VGICP    │  │ Fix/Float/SPS │  │ Odom   │
│  b_g from ESKF) │  │ (see SLAM docs)  │  │ + Lever Arm   │  │ Model  │
└────────┬────────┘  └────────┬─────────┘  └──────┬────────┘  └───┬────┘
         │                    │                    │               │
    IMU at 500 Hz       T_vgicp at 10 Hz    [x,y,z] at 2 Hz   [v,ω] at 100 Hz
         │                    │                    │               │
         ▼                    │                    │               │
┌────────────────────────────────────────────────────────────────────────┐
│                    ERROR-STATE KALMAN FILTER (ESKF)                     │
│                                                                        │
│  ┌────────────┐   ┌──────────────┐   ┌─────────────┐                  │
│  │ Nominal    │   │ Error State  │   │ Covariance  │                  │
│  │ Propagation│   │ δx ∈ R^15   │   │ P ∈ R^15×15 │                  │
│  │ (IMU mech) │   │ (near zero) │   │ (uncertainty)│                  │
│  └─────┬──────┘   └──────┬──────┘   └──────┬──────┘                  │
│        │                 │                  │                          │
│  Predict (500 Hz)   Update (per sensor) Propagate (500 Hz)            │
│        │                 │                  │                          │
│  ┌─────▼─────────────────▼──────────────────▼─────┐                   │
│  │              INNOVATION GATE                     │                   │
│  │    Chi-squared test on each measurement          │                   │
│  │    Mahalanobis distance check                    │                   │
│  │    Sensor health flag from degradation monitor   │                   │
│  └─────────────────────┬───────────────────────────┘                   │
│                        │                                               │
│  Output: pose @ 500 Hz, velocity, biases, covariance                  │
└────────────────────────┼───────────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
┌──────────────────────┐  ┌──────────────────────────────────────────┐
│ Vehicle Control      │  │ GTSAM ISAM2 Backend (10 Hz)              │
│ (500 Hz pose needed  │  │                                          │
│  for Stanley lateral │  │  Factors:                                │
│  + speed control)    │  │   - IMU preintegrated (between keyframes)│
│                      │  │   - VGICP scan match (between keyframes) │
│                      │  │   - GPS position (when available)        │
│                      │  │   - Wheel odometry (between keyframes)   │
│                      │  │   - Loop closure (event-triggered)       │
│                      │  │   - Place recognition (see relocal doc)  │
│                      │  │                                          │
│                      │  │  Output: smoothed trajectory, map        │
└──────────────────────┘  └──────────────────────────────────────────┘
```

### 3.4 Information Flow During Sensor Degradation

The architecture must handle every combination of sensor availability:

| GPS | LiDAR | IMU | Wheels | State | Max Duration | Speed Limit | Action |
|-----|-------|-----|--------|-------|-------------|-------------|--------|
| RTK Fix | OK | OK | OK | FULL | Unlimited | 25 km/h | Normal ops |
| RTK Float | OK | OK | OK | GOOD | Unlimited | 25 km/h | Log, monitor |
| No GPS | OK | OK | OK | GOOD | Minutes-hours | 20 km/h | LiDAR + odom, inflate GPS cov |
| RTK Fix | Degraded | OK | OK | DEGRADED | 30-60s | 10 km/h | GPS-anchored, reduced confidence |
| No GPS | Degraded | OK | OK | CRITICAL | 10-30s | 5 km/h | Dead reckoning, seek recovery |
| No GPS | No LiDAR | OK | OK | DEAD_RECK | 5-15s | STOP | IMU + wheels only, stop when covariance exceeds threshold |
| Any | Any | FAULT | Any | EMERGENCY | 0s | STOP | Immediate safe stop (IMU is backbone) |
| Any | Any | OK | FAULT | DEGRADED | 10-30s | 10 km/h | IMU-only propagation, inflate wheel cov |

**IMU failure is catastrophic** — without the 500 Hz propagation backbone, no high-rate pose estimate is possible. This is why aerospace and automotive systems use dual-redundant IMUs. For Aurrigo, a second IMU ($3-5K) provides hardware fault tolerance. The ESKF can be extended to dual-IMU with cross-validation:

```
Dual IMU fusion:
  If both healthy: weighted average based on noise characteristics
  If one degraded: switch to the healthy one, inflate noise
  If both degraded: immediate safe stop

Cross-check: |a_imu1 - a_imu2| > 5σ for >0.1s → flag discrepancy
  5σ threshold at Microstrain noise: ~0.09 m/s² (detectable bias shift)
```

---

## 4. Sensor Validation and Fault Detection

### 4.1 Chi-Squared Innovation Gating

The most important defense against faulty measurements is the chi-squared test on the innovation (measurement residual):

```python
def chi_squared_gate(y, S, alpha=0.01):
    """
    Chi-squared innovation gate.

    y: innovation vector (m,)
    S: innovation covariance (m, m)
    alpha: significance level (0.01 = 99% gate)

    Returns: True if measurement passes gate (is consistent with predicted state)
    """
    # Mahalanobis distance squared
    d2 = y.T @ np.linalg.inv(S) @ y

    # Chi-squared threshold for m degrees of freedom at significance alpha
    # Pre-computed thresholds (avoid scipy at runtime):
    chi2_thresholds = {
        # (degrees of freedom, alpha) → threshold
        (3, 0.01): 11.345,   # GPS position (3D)
        (3, 0.001): 16.266,  # GPS position (strict)
        (6, 0.01): 16.812,   # Full 6-DoF pose
        (6, 0.001): 22.458,  # Full 6-DoF (strict)
        (2, 0.01): 9.210,    # 2D position
        (1, 0.01): 6.635,    # Single scalar
    }

    m = len(y)
    threshold = chi2_thresholds.get((m, alpha), chi2_from_table(m, alpha))

    passed = d2 < threshold

    if not passed:
        log_warning(f"Chi-squared gate REJECTED: d²={d2:.1f} > threshold={threshold:.1f}, "
                    f"DoF={m}, measurement discrepancy = {np.sqrt(d2):.1f} sigma")

    return passed, d2
```

**Gate sizing for airside operations:**

| Sensor | DoF | Gate (99%) | Gate (99.9%) | Recommended | Why |
|--------|-----|-----------|-------------|-------------|-----|
| GPS position | 3 | 11.3 | 16.3 | 99.9% (strict) | GPS multipath is common near aircraft |
| VGICP pose | 6 | 16.8 | 22.5 | 99% (normal) | VGICP is generally reliable |
| Wheel velocity | 2 | 9.2 | 13.8 | 99% (normal) | Wheel slip detectable separately |
| Loop closure | 6 | 16.8 | 22.5 | 99.9% (strict) | False loop closures are catastrophic |

### 4.2 Normalized Innovation Squared (NIS) Monitoring

Beyond per-measurement gating, the NIS (Normalized Innovation Squared) over a sliding window reveals systematic filter issues:

```python
def nis_monitor(innovations, covariances, window_size=50):
    """
    Monitor filter consistency via windowed NIS.

    For a consistent filter, the average NIS should equal the measurement dimension.
    NIS too low → filter is overconfident (covariance too small)
    NIS too high → filter is underconfident or measurements are inconsistent
    """
    nis_values = []
    for y, S in zip(innovations, covariances):
        d2 = y.T @ np.linalg.inv(S) @ y
        nis_values.append(d2)

    avg_nis = np.mean(nis_values[-window_size:])
    m = len(innovations[0])  # Measurement dimension

    # Expected: avg_nis ≈ m
    # 95% confidence interval: m ± 2*sqrt(2*m/window_size)
    ci = 2 * np.sqrt(2 * m / window_size)

    if avg_nis < m - ci:
        return "OVERCONFIDENT", avg_nis  # P or R too large
    elif avg_nis > m + ci:
        return "UNDERCONFIDENT", avg_nis  # P or R too small, or model mismatch
    else:
        return "CONSISTENT", avg_nis
```

### 4.3 RAIM-Inspired Multi-Sensor Integrity Monitoring

RAIM (Receiver Autonomous Integrity Monitoring) was developed for GPS aviation applications to detect satellite faults. The same concept applies to multi-sensor AV localization:

```
RAIM concept adapted for multi-sensor AV:

Given N sensor sources, each providing an independent position estimate:
  - GPS → p_gps
  - VGICP → p_vgicp
  - Wheel dead reckoning → p_wheel
  - Place recognition → p_place (when available)

Step 1: Compute all-sensors solution (weighted least squares)
Step 2: For each sensor i, compute leave-one-out solution (exclude sensor i)
Step 3: Compare each leave-one-out with all-sensors

If excluding sensor i causes large change → sensor i may be faulty
If all leave-one-out solutions agree → no detectable fault

Fault detection:
  d_i = ||p_all - p_exclude_i||
  If d_i > T_fd for any i → fault detected

Fault exclusion (requires N >= 5 for position):
  After detection, exclude the sensor that maximizes consistency
  Verify remaining solution passes integrity check

Minimum sensors for:
  Detection: N >= 4 (for 3D position)
  Exclusion: N >= 5
  
Aurrigo has: GPS + VGICP + IMU + Wheels = 4 (minimum for detection)
Adding: Place recognition = 5 (enables exclusion when available)
```

```python
def raim_check(estimates, covariances, sensor_names):
    """
    RAIM-style consistency check across sensor position estimates.

    estimates: list of (3,) position vectors from each sensor
    covariances: list of (3,3) covariance matrices
    sensor_names: list of sensor names for logging
    """
    N = len(estimates)
    if N < 3:
        return "INSUFFICIENT_SENSORS", None, None

    # All-sensor weighted average
    W_total = np.zeros((3, 3))
    Wp_total = np.zeros(3)
    for p, C in zip(estimates, covariances):
        W = np.linalg.inv(C)
        W_total += W
        Wp_total += W @ p
    p_all = np.linalg.inv(W_total) @ Wp_total

    # Leave-one-out solutions
    faults = {}
    for i in range(N):
        W_loo = np.zeros((3, 3))
        Wp_loo = np.zeros(3)
        for j in range(N):
            if j == i:
                continue
            W = np.linalg.inv(covariances[j])
            W_loo += W
            Wp_loo += W @ estimates[j]
        p_loo = np.linalg.inv(W_loo) @ Wp_loo

        separation = np.linalg.norm(p_all - p_loo)
        faults[sensor_names[i]] = separation

    # Check for outlier
    max_sep_sensor = max(faults, key=faults.get)
    max_sep = faults[max_sep_sensor]

    threshold = 1.0  # meters — tunable, depends on environment
    if max_sep > threshold:
        return "FAULT_DETECTED", max_sep_sensor, faults
    else:
        return "CONSISTENT", None, faults
```

### 4.4 GPS-Specific Fault Detection

GPS on airport airside faces unique integrity challenges:

```
GPS fault modes on airside:

1. MULTIPATH near aircraft:
   - Large metallic fuselage reflects GPS signals
   - Creates position errors of 2-10m even with RTK
   - Signature: sudden position jump when aircraft parks/departs
   - Detection: velocity consistency — if GPS says we jumped 5m
     but IMU says we moved 0.1m, GPS is wrong
   
   Check: |p_gps_new - p_gps_old - v_imu * dt| < 5σ_gps + 5σ_imu*dt

2. FIX LOSS under terminal overhang:
   - Terminal building blocks satellites
   - RTK fix degrades: Fixed → Float → DGNSS → No solution
   - Predictable: Can be mapped (GPS quality map of airport)
   
   Action: Pre-build GPS quality heat map during initial mapping.
   In known poor-GPS zones, automatically inflate GPS noise.

3. INTEGER RE-INITIALIZATION artifacts:
   - After fix loss, RTK re-acquires with potentially wrong integer ambiguity
   - Can produce confident but wrong positions (worst case: 0.19m × N error)
   - Typically corrected within seconds, but initial re-fix may be wrong
   
   Detection: After any fix loss >5s, distrust first 3 fixes (30s at 2 Hz minimum)
   Apply 10x noise inflation for re-acquisition period.

4. NTRIP DROPOUT:
   - Internet connection to NTRIP caster lost
   - RTK corrections stop → gradual degradation from Fixed to Float to SPS
   - Position accuracy degrades over 30-120 seconds
   
   Action: Monitor age of corrections. If >30s old, inflate noise.
   If >120s, switch to SPS noise model.

5. INTERFERENCE from airport radio:
   - ILS/DME/VOR transmitters can interfere with GPS L-band
   - Rare but documented (EUROCONTROL reports)
   - Sudden loss of all satellites simultaneously
   
   Detection: If num_sats drops from >12 to <4 within 1 second, suspect interference.
```

### 4.5 Sensor Fault State Machine

```
                    ┌─────────┐
         ┌──────────│ HEALTHY │◄─────────────────────┐
         │          └────┬────┘                      │
         │               │                           │
    gate fail × 3   gate fail × 1              consistency
    in 10 sec       (logged)                   restored × 10
         │               │                     in 30 sec
         ▼               ▼                          │
    ┌─────────┐    ┌───────────┐              ┌─────┴─────┐
    │ SUSPECT │───►│ MONITORED │──gate pass──►│ RECOVERING│
    └────┬────┘    └───────────┘              └───────────┘
         │
    gate fail × 5
    in 5 sec OR
    RAIM excludes
         │
         ▼
    ┌──────────┐
    │ EXCLUDED │──────── timeout (60s) ──► SUSPECT (retry)
    └──────────┘

Per-sensor fault state:
  HEALTHY:     Full weight in fusion, normal noise model
  MONITORED:   Logged, 2x noise inflation, still fused
  SUSPECT:     5x noise inflation, marked for exclusion
  EXCLUDED:    Not fused, measurement logged for post-analysis
  RECOVERING:  Gradual noise deflation over 10 update cycles
```

---

## 5. Multi-Hypothesis State Estimation

### 5.1 When Single-Hypothesis Fails

The standard ESKF maintains a single Gaussian belief — one position estimate with one covariance. This fails in two airside scenarios:

1. **GPS multipath ambiguity**: The vehicle is near a large aircraft, and GPS gives two plausible positions (direct signal vs reflected signal). The true position is one or the other, not the average.

2. **Identical-stand problem**: After relocalization failure, the vehicle's place recognition returns matches to multiple similar-looking stands. The vehicle could be at Stand 12 or Stand 14 — both look geometrically identical.

In both cases, the posterior distribution is multimodal. A single Gaussian collapses the modes into a meaningless average between two possible locations.

### 5.2 Interacting Multiple Model (IMM) Estimator

The IMM maintains M parallel filters, each representing a different hypothesis, with probabilistic mode transitions:

```python
class IMM_Estimator:
    """
    Interacting Multiple Model (IMM) estimator.
    Maintains M parallel ESKF filters with mode probabilities.
    """
    def __init__(self, M, transition_matrix):
        """
        M: number of models (hypotheses)
        transition_matrix: M×M Markov transition probabilities
           π[i][j] = P(mode j at k | mode i at k-1)
        """
        self.filters = [ESKF() for _ in range(M)]
        self.mu = np.ones(M) / M              # Mode probabilities (uniform init)
        self.pi = transition_matrix            # Mode transition matrix

    def predict(self, imu_measurement, dt):
        # Step 1: Compute mixing probabilities
        c_j = self.pi.T @ self.mu              # Predicted mode probabilities
        mu_ij = np.zeros((self.M, self.M))     # Mixing weights
        for i in range(self.M):
            for j in range(self.M):
                mu_ij[i][j] = self.pi[i][j] * self.mu[i] / c_j[j]

        # Step 2: Mix states and covariances for each target model
        for j in range(self.M):
            x_mixed = sum(mu_ij[i][j] * self.filters[i].x for i in range(self.M))
            P_mixed = np.zeros_like(self.filters[0].P)
            for i in range(self.M):
                dx = self.filters[i].x - x_mixed
                P_mixed += mu_ij[i][j] * (self.filters[i].P + np.outer(dx, dx))
            self.filters[j].x = x_mixed
            self.filters[j].P = P_mixed

        # Step 3: Propagate each filter independently
        for f in self.filters:
            f.predict(imu_measurement, dt)

    def update(self, z, H, R):
        # Step 4: Update each filter with measurement
        likelihoods = np.zeros(self.M)
        for j, f in enumerate(self.filters):
            y = z - H @ f.x                    # Innovation
            S = H @ f.P @ H.T + R              # Innovation covariance
            # Likelihood = N(y; 0, S)
            likelihoods[j] = multivariate_normal_pdf(y, np.zeros_like(y), S)
            f.update(z, H, R)

        # Step 5: Update mode probabilities
        c_j = self.pi.T @ self.mu
        self.mu = likelihoods * c_j
        self.mu /= np.sum(self.mu)             # Normalize

    def get_estimate(self):
        """Combined estimate (if modes are close) or dominant mode."""
        if np.max(self.mu) > 0.9:
            # One mode dominates — return it
            best = np.argmax(self.mu)
            return self.filters[best].x, self.filters[best].P, self.mu

        # Modes comparable — return weighted combination
        # WARNING: Only valid if modes are nearby. If modes represent
        # different locations, return the dominant one instead.
        x_combined = sum(self.mu[j] * self.filters[j].x for j in range(self.M))
        P_combined = np.zeros_like(self.filters[0].P)
        for j in range(self.M):
            dx = self.filters[j].x - x_combined
            P_combined += self.mu[j] * (self.filters[j].P + np.outer(dx, dx))
        return x_combined, P_combined, self.mu
```

### 5.3 IMM Mode Definitions for Airside

```
Mode definitions for airside state estimation:

Model 1: NORMAL_GPS
  - GPS noise: RTK-level (σ = 0.02m)
  - GPS bias: none
  - Transition: stays in NORMAL_GPS with P = 0.95
  
Model 2: MULTIPATH_GPS
  - GPS noise: inflated 10x (σ = 0.2m)
  - GPS bias: [b_x, b_y, b_z] estimated as additional state
  - Transition: stays in MULTIPATH with P = 0.8
  
Model 3: NO_GPS
  - GPS measurement: ignored (infinite noise)
  - Pure dead reckoning with IMU + wheels + LiDAR
  - Transition: stays in NO_GPS with P = 0.9

Transition matrix π:
                To:  NORMAL  MULTIPATH  NO_GPS
From NORMAL:       [ 0.95     0.03      0.02  ]
From MULTIPATH:    [ 0.10     0.80      0.10  ]
From NO_GPS:       [ 0.05     0.05      0.90  ]

The IMM automatically adapts:
- In open apron with clear sky → NORMAL_GPS dominates (µ₁ > 0.95)
- Near parked aircraft → MULTIPATH rises (µ₂ increases as innovations grow)
- Under terminal overhang → NO_GPS dominates (µ₃ > 0.9)
```

### 5.4 Hypothesis Spawning for Relocalization

When the vehicle loses its position entirely (kidnapped robot), the IMM framework extends to spawn multiple hypotheses from place recognition candidates:

```
Relocalization hypothesis management:

1. Place recognition returns K candidates:
   {(pose_1, score_1), (pose_2, score_2), ..., (pose_K, score_K)}
   (See lidar-place-recognition-relocalization.md)

2. For each candidate with score > threshold:
   - Spawn a new ESKF initialized at pose_i
   - Initial covariance from ICP alignment quality
   - Initial mode probability proportional to descriptor score

3. Run all hypotheses in parallel:
   - Each receives the same IMU + wheel data
   - Each is updated by VGICP (which will converge differently per hypothesis)
   - GPS measurements (when available) strongly discriminate

4. Pruning:
   - If mode probability µ_i < 0.01: kill hypothesis i
   - If one mode µ_i > 0.99: collapse to single mode, resume normal ESKF
   - Maximum active hypotheses: 5 (computational budget)

5. Safety during multi-hypothesis:
   - Vehicle MUST be stationary or very slow (<2 km/h)
   - If no hypothesis reaches µ > 0.8 within 10 seconds: request teleop
```

### 5.5 Computational Cost of IMM

| M (modes) | State Dim | ESKF cost per mode | Total IMM cost | Orin latency |
|-----------|-----------|-------------------|----------------|-------------|
| 2 | 15 | 0.15 ms | 0.4 ms | Acceptable at 500 Hz |
| 3 | 15 | 0.15 ms | 0.6 ms | Acceptable at 500 Hz |
| 5 | 15 | 0.15 ms | 1.0 ms | Tight at 500 Hz (within 2 ms budget) |
| 10 | 15 | 0.15 ms | 1.8 ms | Only for relocalization (not continuous) |

The mixing step adds ~20% overhead on top of M parallel filter updates. For continuous operation, 3-mode IMM (normal GPS / multipath / no GPS) fits comfortably within the 2 ms budget. During relocalization events (rare, stationary), 5-10 hypotheses are acceptable since vehicle control demands are minimal.

---

## 6. GPS-Denied and Degraded Operation

### 6.1 Dead Reckoning Error Growth

When GPS is unavailable, the vehicle relies on IMU + wheel odometry + LiDAR. The key question is: how fast does uncertainty grow?

```
Error sources in dead reckoning:

1. IMU drift (dominant):
   Position: ε_p ≈ ½ * σ_a * t²  (accelerometer noise integrated twice)
   Heading:  ε_θ ≈ σ_g * t        (gyro noise integrated once)

   Microstrain GX5 at t seconds:
   σ_a_eff = 80 µg/√Hz ≈ 7.8e-4 m/s²/√Hz
   σ_g_eff = 0.005°/s/√Hz ≈ 8.7e-5 rad/s/√Hz

   Position error from accelerometer (3σ):
     t = 1s:   3 * ½ * 7.8e-4 * 1 = 0.001 m       (1 mm)
     t = 10s:  3 * ½ * 7.8e-4 * 100 = 0.12 m       (12 cm)
     t = 60s:  3 * ½ * 7.8e-4 * 3600 = 4.2 m        (4.2 m)

   Heading error from gyroscope (3σ):
     t = 1s:   3 * 8.7e-5 * 1 = 0.0003 rad          (0.015°)
     t = 10s:  3 * 8.7e-5 * 10 = 0.003 rad           (0.15°)
     t = 60s:  3 * 8.7e-5 * 60 = 0.016 rad           (0.9°)

2. Gyro bias drift (if not observed):
   Heading error from uncompensated bias:
     Bias stability: 8°/hr = 0.0022°/s
     t = 60s: 0.0022 * 60 = 0.13°
     t = 300s: 0.0022 * 300 = 0.67°
   This causes lateral position error = distance * sin(θ_error)
     At 10 km/h, 60s travel: 167m * sin(0.13°) = 0.38m

3. Wheel odometry errors:
   Scale factor error: ~1-2% (tire pressure, load)
   Slip: 0-10% (wet tarmac, heavy load)
   At 10 km/h for 60s: 167m * 2% = 3.3m (systematic)
```

**Combined dead reckoning budget (IMU + wheels, no GPS, no LiDAR):**

| Duration | Position Error (3σ) | Heading Error (3σ) | Acceptable? |
|----------|--------------------|--------------------|-------------|
| 1 s | 0.01 m | 0.02 deg | Yes — normal IMU gap |
| 5 s | 0.08 m | 0.08 deg | Yes — brief GPS dropout |
| 10 s | 0.25 m | 0.15 deg | Marginal — slow down |
| 30 s | 1.5 m | 0.5 deg | No — stop if no LiDAR |
| 60 s | 5.0 m | 1.0 deg | Unacceptable — safe stop required |

**With LiDAR VGICP (10 Hz corrections):**

LiDAR scan matching provides relative pose corrections at 10 Hz, bounding the dead reckoning drift:

| Duration (no GPS) | With VGICP | Without VGICP | Improvement |
|-------------------|-----------|--------------|-------------|
| 60 s | 0.10-0.30 m | 5.0 m | 17-50x |
| 300 s | 0.20-1.00 m | 50+ m | 50-250x |
| 3600 s | 0.50-5.00 m | Unbounded | Depends on drift rate |

VGICP drift depends on environment geometry:
- Rich geometry (near terminal, between stands): 0.01-0.05% over distance
- Degenerate geometry (open apron, long taxiway): 0.1-0.5% over distance
- VGICP + place recognition (loop closure): bounded to map accuracy

### 6.2 GPS Quality Map

Airports have predictable GPS quality zones that can be pre-mapped:

```
GPS Quality Zone Map (pre-built during initial mapping phase):

Zone classification:
  GREEN:  Open sky, >15 satellites, RTK fixed consistently
          Locations: open apron, taxiways away from buildings
          GPS noise model: σ = [0.02, 0.02, 0.04] m

  YELLOW: Partial obstruction, 8-15 satellites, RTK float common
          Locations: near single-story buildings, under jet bridges
          GPS noise model: σ = [0.20, 0.20, 0.50] m

  RED:    Severe obstruction, <8 satellites, SPS or no fix
          Locations: under terminal buildings, between hangars, parking garages
          GPS noise model: σ = [5.0, 5.0, 10.0] m  or EXCLUDE

  MULTIPATH: Open sky but strong reflectors, unreliable
          Locations: adjacent to large aircraft (A380, B777), near hangars
          GPS noise model: σ = [1.0, 1.0, 2.0] m + bias estimation mode

Building the map:
  1. Drive the airport with RTK + raw GNSS data logging
  2. At each grid cell (5m × 5m), record:
     - Median number of satellites
     - Median HDOP
     - Fix type distribution (% fixed, % float, % SPS)
     - Measured position variance (compared to VGICP ground truth)
  3. Classify each cell into zone
  4. Store as lightweight lookup table (~10 KB per airport)

Usage in ESKF:
  R_gps = lookup_gps_noise(current_position)  // instead of fixed noise
```

### 6.3 GPS-Denied Mode Switching

```python
class GPSDeniedManager:
    """
    Manages transitions between GPS availability modes.
    Integrates with ESKF and vehicle control.
    """
    # States
    GPS_FULL = "FULL"           # RTK fixed, normal operation
    GPS_DEGRADED = "DEGRADED"   # Float or SPS, increased noise
    GPS_DENIED = "DENIED"       # No fix, dead reckoning
    GPS_RECOVERING = "RECOVERING"  # Re-acquiring after denial

    def __init__(self, config):
        self.state = self.GPS_FULL
        self.denial_start_time = None
        self.max_denial_duration = config.max_dr_duration  # 30s without LiDAR, 300s with
        self.position_uncertainty_limit = config.max_pos_uncertainty  # 1.0m

    def on_gps_update(self, fix_type, hdop, num_sats, age_of_corrections):
        """Called at each GPS epoch (2 Hz)."""
        if fix_type == "RTK_FIXED" and hdop < 2.0 and num_sats >= 12:
            if self.state == self.GPS_DENIED:
                self.state = self.GPS_RECOVERING
                # Don't immediately trust — apply re-acquisition inflation
                return {"action": "INFLATE_10X", "duration_s": 15}
            else:
                self.state = self.GPS_FULL
                self.denial_start_time = None
                return {"action": "NORMAL"}

        elif fix_type in ("RTK_FLOAT", "DGNSS"):
            self.state = self.GPS_DEGRADED
            inflation = max(5.0, hdop / 1.0)  # Scale with HDOP
            return {"action": "INFLATE", "factor": inflation}

        else:  # NO_FIX or SPS with high HDOP
            if self.state != self.GPS_DENIED:
                self.denial_start_time = time.time()
            self.state = self.GPS_DENIED
            return {"action": "EXCLUDE_GPS"}

    def check_safety(self, position_covariance, lidar_healthy):
        """Called at ESKF rate to check dead reckoning limits."""
        if self.state != self.GPS_DENIED:
            return {"safe": True}

        pos_uncertainty = np.sqrt(np.max(np.linalg.eigvals(position_covariance[:3,:3])))
        duration = time.time() - self.denial_start_time

        max_duration = 300 if lidar_healthy else 30  # seconds

        if pos_uncertainty > self.position_uncertainty_limit:
            return {"safe": False, "reason": f"Position uncertainty {pos_uncertainty:.2f}m exceeds limit",
                    "action": "SAFE_STOP"}
        elif duration > max_duration:
            return {"safe": False, "reason": f"GPS denied for {duration:.0f}s exceeds {max_duration}s limit",
                    "action": "SAFE_STOP"}
        else:
            speed_limit = max(2.0, 25.0 * (1.0 - pos_uncertainty / self.position_uncertainty_limit))
            return {"safe": True, "speed_limit_kmh": speed_limit}
```

### 6.4 Airside GPS-Denied Scenarios

| Scenario | Duration | GPS Status | LiDAR Status | Strategy |
|----------|----------|-----------|-------------|----------|
| Pass under jet bridge | 5-15s | No fix | OK | Normal — VGICP bounds drift |
| Park at gate near A380 | Minutes | Multipath (2-5m bias) | OK | IMM switches to multipath model |
| Terminal ramp underpass | 20-60s | No fix | OK | VGICP + wheel odom, inflate GPS covariance |
| De-icing station | 30-120s | OK (open) | Degraded (spray) | GPS-primary, inflate LiDAR covariance |
| Under cargo terminal | 2-5 min | No fix | Partial (structure) | Dead reckoning with reduced speed, place recognition for recovery |
| System restart in hangar | N/A | No fix | No prior map | Kidnapped robot recovery (Section 5.4), require manual override if fail |

---

## 7. Covariance Management and Adaptive Estimation

### 7.1 The Covariance Consistency Problem

The most insidious failure mode in Kalman filtering is covariance inconsistency — when the filter's reported uncertainty does not match actual estimation error. This manifests in two ways:

```
OVERCONFIDENT (P too small):
  - Filter believes it knows position to 5cm, actual error is 50cm
  - Causes: unmodeled dynamics, incorrect process noise Q, sensor correlations
  - Danger: Planning trusts tight position → insufficient safety margins
  - Symptom: NIS consistently > expected (innovations look "too large")

UNDERCONFIDENT (P too large):
  - Filter believes uncertainty is 50cm, actual error is 5cm
  - Causes: excessive process noise, conservative sensor noise models
  - Danger: Overly conservative behavior, unnecessary stops
  - Symptom: NIS consistently < expected (innovations look "too small")

For safety-critical airside operations, SLIGHT OVERCONFIDENCE is acceptable
(conservative behavior is safe), but UNDERCONFIDENCE wastes operational time.
Strong overconfidence is DANGEROUS.
```

### 7.2 Covariance Inflation Strategies

```python
def apply_covariance_inflation(P, Q, context):
    """
    Inflate covariance based on operational context.
    
    Called at each ESKF prediction step.
    """
    # Base process noise Q is the nominal model
    Q_effective = Q.copy()

    # 1. Model mismatch inflation (constant)
    # Accounts for unmodeled vehicle dynamics (sideslip, tire deformation)
    Q_effective *= 1.1  # 10% base inflation

    # 2. Terrain-dependent inflation
    if context.surface == "WET_TARMAC":
        # Wheel slip more likely on wet surface
        Q_effective[3:6, 3:6] *= 2.0   # Velocity process noise 2x
    elif context.surface == "UNPAVED":
        Q_effective[3:6, 3:6] *= 3.0   # Gravel/grass areas
    elif context.surface == "ICE":
        Q_effective[3:6, 3:6] *= 5.0   # Winter conditions

    # 3. Dynamic environment inflation
    if context.near_aircraft_exhaust:
        # Jet blast causes vibration → IMU noise increase
        Q_effective[6:9, 6:9] *= 2.0   # Rotation process noise
        Q_effective[0:3, 0:3] *= 1.5   # Position

    # 4. Maneuver-dependent inflation
    if context.angular_rate > 0.5:  # rad/s, turning
        Q_effective[6:9, 6:9] *= 1.5   # Rotation uncertainty during turns

    if context.acceleration > 2.0:  # m/s², braking or accelerating
        Q_effective[3:6, 3:6] *= 1.5

    # 5. Absolute covariance bounds (prevent P from collapsing to zero)
    P_floor = np.diag([
        0.001, 0.001, 0.002,    # Position: 1mm minimum (never perfectly known)
        0.01, 0.01, 0.01,       # Velocity: 1cm/s minimum
        0.0001, 0.0001, 0.0001, # Orientation: 0.006° minimum
        1e-5, 1e-5, 1e-5,       # Accel bias: minimum uncertainty
        1e-6, 1e-6, 1e-6        # Gyro bias: minimum uncertainty
    ])
    P = np.maximum(P, P_floor)  # Element-wise (diagonal only)

    return P, Q_effective
```

### 7.3 Sage-Husa Adaptive Noise Estimation

The Sage-Husa filter adaptively estimates the process noise Q and measurement noise R from the innovation sequence:

```python
class SageHusaAdaptive:
    """
    Sage-Husa adaptive Kalman filter.
    Estimates Q and R online from innovation statistics.
    
    USE WITH CAUTION: Can diverge if multiple parameters adapted simultaneously.
    Recommended: adapt R only (measurement noise), keep Q fixed or slowly adapted.
    """
    def __init__(self, Q_init, R_init, forgetting_factor=0.98):
        self.Q = Q_init.copy()
        self.R = R_init.copy()
        self.b = forgetting_factor  # 0.95-0.99, higher = longer memory

    def adapt_measurement_noise(self, y, H, P_pred, step_k):
        """
        Adapt R from innovation sequence.
        
        y: innovation (z - h(x_pred))
        H: measurement Jacobian
        P_pred: predicted covariance
        """
        # Innovation-based R estimate
        R_est = np.outer(y, y) - H @ P_pred @ H.T

        # Ensure positive definiteness
        R_est = (R_est + R_est.T) / 2  # Symmetrize
        eigvals = np.linalg.eigvalsh(R_est)
        if np.min(eigvals) < 0:
            R_est += (-np.min(eigvals) + 1e-6) * np.eye(len(y))

        # Exponential moving average
        d_k = (1 - self.b) / (1 - self.b**(step_k + 1))  # Bias correction
        self.R = (1 - d_k) * self.R + d_k * R_est

        # Clamp to reasonable range (prevent divergence)
        self.R = np.clip(self.R, self.R_init * 0.1, self.R_init * 100)

        return self.R
```

**When to use adaptive estimation:**
- GPS noise varies significantly with environment (terminal proximity, multipath)
- LiDAR scan matching quality varies with geometry (degenerate vs rich features)
- Wheel odometry accuracy varies with surface condition

**When NOT to use adaptive estimation:**
- Safety-critical path where noise must be conservative (use fixed, pessimistic values)
- During sensor fault conditions (adaptive estimation may mask the fault)
- With very few measurements (insufficient innovation history)

### 7.4 Observability Analysis

Not all states are observable from all sensor combinations. Understanding observability determines which states can be accurately estimated under each degradation mode:

```
Observability analysis for state vector [p, v, θ, b_a, b_g]:

Full sensor suite (GPS + IMU + LiDAR + Wheels):
  All 15 states observable ✓
  Accelerometer bias: observable via GPS velocity + IMU comparison
  Gyro bias: observable via heading from GPS/LiDAR + IMU comparison

GPS only (no IMU, no LiDAR, no wheels):
  Observable: p (position)
  Unobservable: v (between epochs), θ (no heading from single antenna), b_a, b_g
  Note: Dual-antenna GPS provides heading → θ becomes observable

IMU + Wheels only (no GPS, no LiDAR):
  Observable: Relative motion (v, θ_change)
  Unobservable: Absolute p (drifts), b_a (no absolute reference), heading bias
  Partially observable: b_g (from wheel odometry heading comparison, slow)
  
  CRITICAL: Accelerometer bias and gyro bias become unobservable without
  an absolute reference. After ~60s of dead reckoning, biases can drift
  enough to cause significant position error.

IMU + LiDAR only (no GPS, no Wheels):
  Observable: p (from scan matching), v (from successive scans), θ
  Partially observable: b_a (via gravity direction + LiDAR position)
  Unobservable in degenerate geometry: translation along featureless axis
  
  This is the STANDARD airside mode under terminal buildings.
  LiDAR VGICP provides the position anchor that keeps biases observable.

IMU only:
  Observable: orientation (via gravity vector in accelerometer)
  Unobservable: position, velocity, accelerometer bias (X/Y components)
  Observable: gyro bias (if vehicle is stationary — zero-velocity updates)
  
  Duration limit: ~10s before position uncertainty exceeds safety threshold
```

### 7.5 Zero-Velocity Updates (ZUPT)

When the vehicle is stationary, powerful pseudo-measurements constrain the state:

```python
def zero_velocity_update(eskf, threshold_accel=0.1, threshold_gyro=0.01):
    """
    Apply zero-velocity update when vehicle is detected as stationary.
    
    Stationary detection from IMU:
      - Accelerometer magnitude ≈ g (only gravity, no motion)
      - Gyroscope readings ≈ 0
    
    Provides:
      1. v = 0 measurement (constrains velocity)
      2. Gyro bias observability (if ω_measured ≠ 0, it's bias)
    """
    # Check if stationary
    a_mag = np.linalg.norm(eskf.nominal.imu_accel)
    w_mag = np.linalg.norm(eskf.nominal.imu_gyro - eskf.nominal.b_g)

    is_stationary = (abs(a_mag - 9.81) < threshold_accel and w_mag < threshold_gyro)

    if not is_stationary:
        return

    # Zero-velocity measurement: v = 0
    z_vel = np.zeros(3)
    H_vel = np.zeros((3, 15))
    H_vel[0:3, 3:6] = np.eye(3)  # Velocity states
    R_vel = np.diag([0.001, 0.001, 0.001])**2  # Very tight: 1 mm/s

    eskf.update(z_vel, H_vel, R_vel)

    # Zero-angular-rate measurement: ω = 0, so measured ω = bias
    z_gyro_bias = eskf.nominal.imu_gyro  # Measured gyro when stationary = bias
    H_bias = np.zeros((3, 15))
    H_bias[0:3, 12:15] = np.eye(3)  # Gyro bias states
    R_bias = np.diag([1e-4, 1e-4, 1e-4])**2

    eskf.update(z_gyro_bias, H_bias, R_bias)
```

ZUPT is particularly valuable on the airside because vehicles spend significant time stationary: waiting at gates during turnaround, queuing for runway crossings, parked during charging. Each stationary period recalibrates the IMU biases for free.

---

## 8. Fleet-Level State Consistency

### 8.1 Why Fleet Consistency Matters

With 20+ vehicles operating simultaneously on an airport apron, each vehicle maintains its own ESKF state estimate. Without coordination, relative position errors accumulate:

```
Vehicle A thinks it is at (100.00, 200.00) ± 0.05m
Vehicle B thinks it is at (102.00, 200.00) ± 0.05m
Actual separation: 2.00m ± 0.10m (sum of individual uncertainties)

But if both vehicles observe the same landmark (e.g., terminal pillar):
  Vehicle A: landmark at (105.00, 198.00) in its frame
  Vehicle B: landmark at (107.00, 198.00) in its frame
  → Their maps disagree by 2.00m
  → Relative position uncertainty = 0.10m (much better than individual)

Fleet consistency ensures that relative positions between vehicles are
more accurate than individual positions — critical for:
  - Collision avoidance between vehicles
  - Cooperative task execution (e.g., two tugs at same aircraft)
  - Consistent fleet map updates
```

### 8.2 Relative Pose Constraints

When two vehicles detect each other (via LiDAR), a relative pose constraint is generated:

```
Vehicle A detects Vehicle B in its LiDAR scan:
  z_AB = T_A^(-1) * T_B   (relative pose of B in A's frame)

This provides a "between factor" connecting A's and B's state estimates:
  h(x_A, x_B) = x_A^(-1) * x_B
  
In GTSAM: BetweenFactor<Pose3>(X_A(k), X_B(k), z_AB, noise_AB)

Noise: From LiDAR detection range and angle
  At 20m: σ_trans = [0.10, 0.10, 0.05] m, σ_rot = [0.02, 0.02, 0.01] rad
  At 50m: σ_trans = [0.30, 0.30, 0.10] m, σ_rot = [0.05, 0.05, 0.02] rad
```

### 8.3 Decentralized vs Centralized Fleet Estimation

| Approach | Communication | Latency | Scalability | Single Point of Failure |
|----------|--------------|---------|------------|------------------------|
| Centralized | All measurements to server | 50-200 ms | Poor (O(N^2)) | Yes |
| Decentralized (DDF) | Pairwise between vehicles | 10-50 ms | Good (local) | No |
| Hybrid | Local estimation + periodic sync | 10-50 ms local, 100-500 ms sync | Good | Partial |

**Recommended for Aurrigo:** Hybrid approach.

```
Fleet state consistency architecture:

On-vehicle (real-time, <2ms):
  - ESKF with local sensors only
  - Detects other vehicles in LiDAR → relative pose estimates
  - Publishes: own_pose, own_covariance, relative_detections

Edge server (airport-local, 100ms):
  - Receives pose + covariance from all vehicles via 5G
  - Runs fleet-level factor graph (GTSAM)
  - Computes pairwise relative corrections
  - Publishes: pose_corrections back to each vehicle

On-vehicle (correction, 10Hz):
  - Receives fleet pose correction as a "virtual GPS" measurement
  - Applies via ESKF update with appropriate noise model
  - Does NOT override local ESKF — just adds a correction factor

Bandwidth per vehicle: ~500 bytes/update @ 10 Hz = 5 KB/s
For 20 vehicles: 100 KB/s total — trivial on airport 5G
```

### 8.4 Covariance Intersection for Information Fusion

When two vehicles share estimates that may have unknown correlations (e.g., both corrected by the same GPS base station), naive fusion double-counts information. Covariance Intersection (CI) provides a consistent fusion without knowing the cross-correlations:

```python
def covariance_intersection(x_A, P_A, x_B, P_B):
    """
    Covariance Intersection: fuse two estimates with unknown correlation.
    
    Conservative but guaranteed consistent — never overconfident.
    Used for fleet-level state fusion where cross-correlations
    are unknown or too expensive to track.
    """
    # Find optimal weighting omega ∈ [0, 1]
    # Minimize det(P_fused) or trace(P_fused)
    # Closed-form for scalar; numerical optimization for matrix

    best_omega = None
    best_det = float('inf')

    for omega in np.linspace(0.01, 0.99, 100):
        P_inv = omega * np.linalg.inv(P_A) + (1 - omega) * np.linalg.inv(P_B)
        P_fused = np.linalg.inv(P_inv)
        det = np.linalg.det(P_fused)
        if det < best_det:
            best_det = det
            best_omega = omega

    omega = best_omega
    P_inv = omega * np.linalg.inv(P_A) + (1 - omega) * np.linalg.inv(P_B)
    P_fused = np.linalg.inv(P_inv)
    x_fused = P_fused @ (omega * np.linalg.inv(P_A) @ x_A +
                          (1 - omega) * np.linalg.inv(P_B) @ x_B)

    return x_fused, P_fused
```

---

## 9. Orin Implementation and Computational Budgets

### 9.1 Timing Budget

The state estimation pipeline must fit within strict timing constraints on NVIDIA Orin AGX (275 TOPS, ARM Cortex-A78AE CPU):

```
IMU callback (500 Hz → 2ms period):
  ┌─────────────────────────────────────────────┐
  │ ESKF propagation                  0.10 ms   │
  │ Covariance prediction             0.08 ms   │
  │ Context-dependent Q inflation     0.02 ms   │
  │ ZUPT check                        0.01 ms   │
  │ Publish TF transform              0.02 ms   │
  │                                             │
  │ TOTAL:                            0.23 ms   │ (11.5% of 2ms budget)
  └─────────────────────────────────────────────┘

Sensor update (per measurement arrival):
  ┌─────────────────────────────────────────────┐
  │ Chi-squared innovation gate        0.01 ms  │
  │ ESKF measurement update            0.10 ms  │
  │ Joseph-form covariance update      0.08 ms  │
  │ Error state injection + reset      0.03 ms  │
  │ NIS monitoring                     0.01 ms  │
  │                                             │
  │ TOTAL per update:                  0.23 ms  │
  └─────────────────────────────────────────────┘

RAIM check (2 Hz, at GPS arrival):
  ┌─────────────────────────────────────────────┐
  │ Leave-one-out solutions (4 sensors) 0.15 ms │
  │ Fault detection logic               0.02 ms │
  │                                             │
  │ TOTAL:                              0.17 ms │
  └─────────────────────────────────────────────┘

IMM (3-mode, when active):
  ┌─────────────────────────────────────────────┐
  │ Mixing step                         0.05 ms │
  │ 3× ESKF propagation                 0.30 ms │
  │ Mode probability update             0.02 ms │
  │                                             │
  │ TOTAL:                              0.37 ms │ (18.5% of 2ms budget)
  └─────────────────────────────────────────────┘

GTSAM ISAM2 update (10 Hz):
  ┌─────────────────────────────────────────────┐
  │ Factor addition                     0.50 ms │
  │ ISAM2 incremental update            3-8 ms  │
  │ Marginals extraction                1-3 ms  │
  │                                             │
  │ TOTAL:                              5-12 ms │ (on CPU)
  └─────────────────────────────────────────────┘
```

### 9.2 Memory Budget

```
ESKF state + covariance:
  Nominal state:       16 doubles = 128 bytes
  Error state:         15 doubles = 120 bytes
  Covariance P:        15×15 doubles = 1,800 bytes
  Process noise Q:     15×15 doubles = 1,800 bytes
  IMM (3 modes):       3 × above = ~12 KB
  Total ESKF:          ~15 KB

State buffer (500ms replay):
  250 states × 128 bytes = 32 KB
  250 covariances × 1800 bytes = 450 KB
  Total buffer:        ~500 KB

GTSAM factor graph:
  Per keyframe: ~2 KB (pose + factors)
  1000 keyframes (100s at 10Hz): ~2 MB
  ISAM2 Bayes tree: ~5-10 MB
  Total GTSAM:     ~12 MB

GPS quality map:
  1000×1000 grid at 5m resolution = 1M cells × 1 byte = 1 MB

Grand total: ~14 MB (0.04% of Orin's 32 GB)
```

### 9.3 CPU Core Allocation

```
Orin AGX has 12 ARM Cortex-A78AE cores.

Recommended allocation:
  Core 0-1:  ESKF (real-time, SCHED_FIFO priority 99)
             - IMU callback at 500 Hz
             - Sensor updates at arrival
             - Must never be preempted
  
  Core 2-3:  GTSAM ISAM2 backend
             - 10 Hz update cycle
             - Can tolerate jitter
  
  Core 4-5:  Sensor drivers (LiDAR, GPS, CAN)
  Core 6-7:  VGICP scan matching (CPU portion)
  Core 8-11: Perception, planning, other nodes

Use Linux PREEMPT_RT kernel patch for deterministic ESKF timing.
Alternatively: isolcpus=0,1 to reserve cores for ESKF.
```

### 9.4 SIMD and NEON Optimization

Orin's ARM cores support NEON SIMD instructions. Key operations benefit:

```
Matrix operations in ESKF (15×15):
  Standard:  ~0.10 ms per 15×15 multiply
  NEON:      ~0.03 ms (3.3x speedup)
  Eigen library with NEON: automatic if compiled with -march=armv8.2-a+fp16

Quaternion operations:
  quaternion_multiply:    ~10 ns with NEON intrinsics
  quaternion_to_matrix:   ~15 ns
  At 500 Hz: 5 µs total (negligible)

Key optimization: Use Eigen::Map to avoid copies, Eigen::Matrix<double, 15, 15>
with fixed-size allocation to avoid heap allocation in the hot loop.
```

### 9.5 Numerical Stability Considerations

```
Floating-point precision for state estimation:

Double precision (64-bit) is REQUIRED for:
  - Covariance matrix P (condition number can reach 10^8)
  - GTSAM optimization (iterative solvers need precision)
  - GPS coordinate conversion (sub-cm at 10^7 m ECEF coordinates)

Single precision (32-bit) is ACCEPTABLE for:
  - IMU raw measurements (noise >> precision)
  - Quaternion operations (normalized, bounded)
  - Wheel encoder counts (integer-like)

Covariance symmetry enforcement:
  P = (P + P.T) / 2   // Apply every 100 steps (~0.2s)
  
  Without this, rounding errors accumulate and P becomes asymmetric,
  eventually causing negative eigenvalues → filter divergence.

Joseph form for covariance update:
  P = (I - K*H) * P * (I - K*H)' + K * R * K'
  
  Instead of simplified form:
  P = (I - K*H) * P   // Numerically unstable, can lose symmetry
  
  Joseph form is ~2x more expensive but guarantees symmetry and
  positive-semidefiniteness. ALWAYS use for production systems.

UD factorization (advanced):
  Store P = U * D * U' (upper triangular × diagonal)
  Update U and D directly → guaranteed positive-definite at all times
  ~30% overhead vs standard P update, but eliminates all numerical issues
  Used in aerospace-grade systems (GPS receivers, INS)
```

---

## 10. ROS Noetic Integration

### 10.1 robot_localization Package

The `robot_localization` package (http://docs.ros.org/en/noetic/api/robot_localization/html/) provides production-ready EKF and UKF nodes for ROS:

```
robot_localization provides:
  - ekf_localization_node: 15-state EKF (position, orientation, velocity, acceleration)
  - ukf_localization_node: Same states with Unscented transform
  - navsat_transform_node: GPS → local frame conversion

Limitations (why you may need custom ESKF):
  ✗ Not an Error-State KF — uses standard EKF on full state
  ✗ Quaternion handling is Euler-angle based internally
  ✗ No chi-squared innovation gating
  ✗ No multi-hypothesis support
  ✗ No adaptive noise estimation
  ✗ No GPS quality map lookup
  ✗ No sensor fault state machine
  ✓ Well-tested, widely deployed, good starting point
  ✓ Handles multi-rate sensors, odom + IMU + GPS
  ✓ Publishes proper TF transforms
  ✓ Configurable per-axis sensor trust

Recommendation:
  Phase 1: Use robot_localization as baseline (2 weeks)
  Phase 2: Replace with custom ESKF when limitations become blocking (6-8 weeks)
  Phase 3: Add IMM, RAIM, adaptive noise (4-6 weeks)
```

### 10.2 Configuration for robot_localization (Baseline)

```yaml
# ekf_localization.yaml — Baseline configuration for Aurrigo

ekf_localization_node:
  ros__parameters:
    frequency: 200          # Output rate (Hz) — limited by EKF, not ESKF
    sensor_timeout: 0.1     # Seconds before marking sensor stale
    two_d_mode: false       # Full 3D (airport apron has elevation changes)
    
    map_frame: map
    odom_frame: odom
    base_link_frame: base_link
    world_frame: map        # Fuse in map frame for absolute positioning

    # IMU (500 Hz)
    imu0: /imu/data
    imu0_config: [false, false, false,    # Don't use IMU position
                  true,  true,  true,     # Use IMU orientation (roll, pitch, yaw)
                  false, false, false,    # Don't use IMU velocity
                  true,  true,  true,     # Use angular velocity
                  true,  true,  true]     # Use linear acceleration
    imu0_queue_size: 10
    imu0_remove_gravitational_acceleration: true

    # Wheel odometry (100 Hz)
    odom0: /wheel_odom
    odom0_config: [false, false, false,   # Don't use odom position (use velocity)
                   false, false, false,   # Don't use odom orientation
                   true,  true,  false,   # Use X,Y velocity (not Z)
                   false, false, true,    # Use yaw rate
                   false, false, false]   # Don't use acceleration
    odom0_queue_size: 5

    # VGICP LiDAR odometry (10 Hz)
    odom1: /vgicp_odom
    odom1_config: [true,  true,  true,    # Use position (corrects drift)
                   true,  true,  true,    # Use orientation
                   false, false, false,   # Don't use velocity (noisy from finite diff)
                   false, false, false,
                   false, false, false]
    odom1_queue_size: 3

    # GPS (2 Hz)
    odom2: /gps_odom         # From navsat_transform_node
    odom2_config: [true,  true,  true,    # Use GPS position
                   false, false, false,   # Don't use GPS orientation (single antenna)
                   false, false, false,
                   false, false, false,
                   false, false, false]
    odom2_queue_size: 2
    odom2_differential: false  # Absolute position, not differential

    # Process noise (tuning critical — start conservative, tighten with data)
    process_noise_covariance: [
      0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   # x
      0, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    # y
      0, 0, 0.06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    # z
      0, 0, 0, 0.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    # roll
      0, 0, 0, 0, 0.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    # pitch
      0, 0, 0, 0, 0, 0.06, 0, 0, 0, 0, 0, 0, 0, 0, 0,    # yaw
      0, 0, 0, 0, 0, 0, 0.025, 0, 0, 0, 0, 0, 0, 0, 0,   # vx
      0, 0, 0, 0, 0, 0, 0, 0.025, 0, 0, 0, 0, 0, 0, 0,   # vy
      0, 0, 0, 0, 0, 0, 0, 0, 0.04, 0, 0, 0, 0, 0, 0,    # vz
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 0,    # vroll
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01, 0, 0, 0, 0,    # vpitch
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.02, 0, 0, 0,    # vyaw
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01, 0, 0,    # ax
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01, 0,    # ay
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.015    # az
    ]
```

### 10.3 Custom ESKF Node Architecture

```
Custom ESKF ROS node design:

Subscribers:
  /imu/data               (sensor_msgs/Imu, 500 Hz)
  /wheel_odom             (nav_msgs/Odometry, 100 Hz)
  /vgicp_pose             (geometry_msgs/PoseWithCovarianceStamped, 10 Hz)
  /gps/fix                (sensor_msgs/NavSatFix, 2 Hz)
  /gps/rtk_status         (custom_msgs/RTKStatus, 2 Hz)
  /loop_closure           (geometry_msgs/PoseWithCovarianceStamped, event)
  /sensor_health          (custom_msgs/SensorHealthArray, 1 Hz)

Publishers:
  /eskf/pose              (geometry_msgs/PoseWithCovarianceStamped, 500 Hz)
  /eskf/odometry          (nav_msgs/Odometry, 500 Hz)
  /eskf/diagnostics       (diagnostic_msgs/DiagnosticArray, 10 Hz)
  /eskf/innovation        (custom_msgs/InnovationArray, per-update)
  /eskf/mode              (std_msgs/String, 10 Hz: "FULL/DEGRADED/DENIED/...")
  /tf                     (tf2_msgs/TFMessage — map→odom→base_link)

Services:
  /eskf/reset             (std_srvs/Trigger — reset filter to GPS position)
  /eskf/set_gps_zone      (custom_srvs/SetGPSZone — manual GPS quality override)

Parameters:
  ~imu_topic, ~gps_topic, etc.
  ~process_noise_accel, ~process_noise_gyro
  ~gps_quality_map_path
  ~innovation_gate_alpha  (default: 0.01)
  ~max_gps_denied_duration_s  (default: 30)
  ~enable_imm             (default: false)
  ~enable_adaptive_noise  (default: true)
```

### 10.4 TF Tree Management

```
TF tree for localization:

earth
  └── map (airport local ENU frame, fixed to survey coordinates)
        └── odom (continuous, drift-free odometry frame)
              └── base_link (vehicle body frame, center of rear axle)
                    ├── imu_link (IMU mounting position)
                    ├── lidar_front (RoboSense RSHELIOS #1)
                    ├── lidar_rear  (RoboSense RSHELIOS #2)
                    ├── lidar_left  (RoboSense RSBP #3)
                    ├── lidar_right (RoboSense RSBP #4)
                    ├── gps_antenna (GPS antenna position)
                    └── [additional sensor frames]

The ESKF manages two transforms:
  map → odom:       Published by GTSAM backend (corrects odom drift)
                    Updated at 10 Hz (or on loop closure events)
  odom → base_link: Published by ESKF (high-rate odometry)
                    Updated at 500 Hz

Composition: map → base_link = (map → odom) * (odom → base_link)
  - ESKF updates odom → base_link at 500 Hz (smooth, no jumps)
  - GTSAM updates map → odom at 10 Hz (corrects accumulated drift)
  - Any downstream node looking up map → base_link gets both effects

CRITICAL: Never publish map → base_link directly at 500 Hz.
  GTSAM corrections would cause discontinuities. The two-layer
  TF structure absorbs corrections smoothly in the map → odom transform.
```

### 10.5 Diagnostic Publishing

```python
def publish_diagnostics(self):
    """
    Publish comprehensive state estimation diagnostics.
    Subscribe in rqt or custom monitoring dashboard.
    """
    msg = DiagnosticArray()
    msg.header.stamp = rospy.Time.now()

    # Filter health
    status = DiagnosticStatus()
    status.name = "ESKF/Health"
    status.level = DiagnosticStatus.OK  # or WARN, ERROR
    status.values = [
        KeyValue("mode", self.gps_manager.state),
        KeyValue("position_uncertainty_m", f"{self.position_uncertainty:.3f}"),
        KeyValue("heading_uncertainty_deg", f"{np.degrees(self.heading_uncertainty):.2f}"),
        KeyValue("gps_fix_type", self.last_gps_fix_type),
        KeyValue("gps_satellites", str(self.last_num_sats)),
        KeyValue("vgicp_fitness", f"{self.last_vgicp_fitness:.4f}"),
        KeyValue("wheel_slip_detected", str(self.wheel_slip_detected)),
        KeyValue("imu_bias_accel_norm", f"{np.linalg.norm(self.nominal.b_a):.4f}"),
        KeyValue("imu_bias_gyro_norm_deg_s", f"{np.degrees(np.linalg.norm(self.nominal.b_g)):.4f}"),
        KeyValue("nis_gps", f"{self.nis_gps:.2f}"),
        KeyValue("nis_vgicp", f"{self.nis_vgicp:.2f}"),
        KeyValue("sensor_fault_state_gps", self.fault_state['gps']),
        KeyValue("sensor_fault_state_vgicp", self.fault_state['vgicp']),
        KeyValue("filter_rate_hz", f"{self.actual_rate:.1f}"),
    ]

    if self.position_uncertainty > 0.5:
        status.level = DiagnosticStatus.WARN
        status.message = f"High position uncertainty: {self.position_uncertainty:.2f}m"
    if self.gps_manager.state == "DENIED" and not self.lidar_healthy:
        status.level = DiagnosticStatus.ERROR
        status.message = "GPS denied and LiDAR degraded — dead reckoning only"

    msg.status.append(status)
    self.diag_pub.publish(msg)
```

---

## 11. Airside-Specific Scenarios and Failure Analysis

### 11.1 Scenario Matrix

| # | Scenario | Sensors Affected | Expected Behavior | Recovery |
|---|----------|-----------------|-------------------|----------|
| 1 | A380 parks at adjacent stand | GPS multipath | IMM switches to MULTIPATH mode, GPS noise inflated 10x | Automatic when aircraft departs |
| 2 | De-icing spray engulfs vehicle | LiDAR degraded, camera blocked | ESKF relies on GPS + IMU + wheels, speed reduced to 5 km/h | Wait for spray to clear (30-60s) |
| 3 | Drive under terminal finger | GPS denied for 20-60s | ESKF continues with VGICP + IMU + wheels, uncertainty grows | GPS re-acquired on exit, re-acquisition inflation applied |
| 4 | Jet blast from departing aircraft | IMU vibration, LiDAR noise | Q inflation for rotation/velocity, LiDAR noise inflated | Automatic once aircraft clears |
| 5 | Heavy rain, standing water | Wheel slip, GPS degraded, LiDAR partial | Wheel slip detection, GPS noise from HDOP, VGICP still functional | Continuous adaptation |
| 6 | Night operations, -10C | No special sensor impact, but thermal drift | Thermal calibration tables for LiDAR extrinsics, IMU bias drift accelerated | ZUPT during stationary periods |
| 7 | RTK base station failure | No RTK corrections → float → SPS over 60s | Gradual noise inflation tracking age of corrections | Manual NTRIP failover or pure VGICP |
| 8 | Multi-LiDAR calibration jump | Sudden VGICP inconsistency | Chi-squared gate rejects anomalous VGICP poses | Automatic recalibration (see multi-lidar-calibration.md) |
| 9 | System restart at gate | No initial state, GPS may be multipath | Kidnapped robot recovery: place recognition → multi-hypothesis → converge | 10-30s recovery time |
| 10 | Two vehicles at same stand | Relative positioning critical | Fleet consistency via V2V LiDAR detection + covariance intersection | Continuous while co-located |

### 11.2 Worst-Case Analysis: Simultaneous GPS Denial + LiDAR Degradation

This is the most dangerous combination for state estimation. It occurs during de-icing under terminal overhang:

```
Simultaneous degradation timeline:

t=0s:   Vehicle enters terminal overhang zone
        GPS: float → SPS → no fix (over 30s)
        LiDAR: normal (terminal provides features)
        Status: OK — VGICP anchors position

t=60s:  De-icing spray begins
        GPS: no fix (under overhang)
        LiDAR: 30% point reduction, range reduced
        VGICP: fitness drops, noise inflated 3x
        Status: DEGRADED — vehicle slows to 10 km/h

t=120s: Heavy spray accumulation
        GPS: no fix
        LiDAR: 60% point reduction, near-field only
        VGICP: may fail (insufficient features)
        Status: CRITICAL — IMU + wheels only

t=180s: Position uncertainty exceeds 1.0m
        Action: SAFE STOP
        Covariance: P_position diagonal > 1.0 m²

Recovery: Wait for de-icing to complete, LiDAR clears,
          place recognition triggers relocalization,
          GPS re-acquired when vehicle exits overhang.

Total exposure: ~60-120s of degraded operation
Dead reckoning quality: ~0.5-2.0m error (IMU + wheels at 5 km/h)
Mitigation: Pre-mapped de-icing zones → proactive speed reduction before entering
```

### 11.3 Comparison with Production AV Systems

| Feature | Apollo MSF | Autoware EKF | LIO-SAM | Aurrigo Current | Aurrigo Proposed |
|---------|-----------|-------------|---------|----------------|-----------------|
| Filter type | ESKF | EKF (robot_localization) | IEKF | GTSAM + EKF | ESKF + GTSAM |
| IMU rate | 200 Hz | 100-200 Hz | 200-500 Hz | 500 Hz | 500 Hz |
| GPS handling | Multi-mode | Single noise | Optional | Fixed noise | IMM + quality map |
| Innovation gating | Chi-squared | None | None | None | Chi-squared + RAIM |
| Fault detection | Basic threshold | None | None | None | Full fault state machine |
| Multi-hypothesis | No | No | No | No | IMM (3-mode) |
| Adaptive noise | Limited | No | No | No | Sage-Husa on R |
| GPS-denied mode | Manual switch | Drops GPS | LiDAR-only | LiDAR-only | Automatic + budgets |
| Fleet consistency | No | No | No | No | Covariance intersection |
| Dead reckoning budget | Not published | Not published | Not tracked | Not tracked | Explicit with auto-stop |
| Certifiability | Low (monolithic) | Medium (open) | Low | Medium | High (modular, tested) |

---

## 12. Key Takeaways

1. **The Error-State Kalman Filter (ESKF) is the correct choice for Aurrigo's state estimation backbone.** It handles quaternion orientation without singularities, maintains a minimal 15-dimensional error state with well-conditioned covariance, and runs in <0.3 ms at 500 Hz on Orin. Every production AV system (Apollo, Waymo, Autoware) uses ESKF or a close variant. The standard EKF and UKF are inferior for IMU-centric fusion.

2. **The two-layer architecture (ESKF at 500 Hz + GTSAM at 10 Hz) provides both real-time control and global consistency.** The ESKF gives low-latency poses for vehicle control, while GTSAM ISAM2 provides smoothed, loop-closure-corrected trajectories for mapping and planning. The two communicate through the TF tree: ESKF publishes odom-to-base_link, GTSAM publishes map-to-odom.

3. **Chi-squared innovation gating is the most important single defense against faulty measurements.** A 99.9% gate (Mahalanobis distance threshold) on GPS measurements catches multipath errors, false RTK fixes, and integer re-initialization artifacts before they corrupt the state. Without gating, a single bad GPS measurement can shift the position estimate by meters — and the filter will confidently report the wrong location.

4. **GPS multipath near large aircraft is the dominant airside-specific challenge for state estimation.** An A380 fuselage reflects GPS signals creating 2-10 m position errors even with RTK. The IMM estimator with three modes (normal GPS / multipath / no GPS) automatically adapts by weighting mode probabilities based on innovation consistency — no manual switching required.

5. **A GPS quality map of the airport eliminates predictable degradation.** Pre-mapping GPS quality (number of satellites, HDOP, fix type) on a 5 m grid during the initial survey costs ~10 KB of storage per airport and allows the ESKF to proactively inflate GPS noise in known-bad zones before the innovation gate trips. This prevents the brief moment of bad data before the gate rejects it.

6. **Dead reckoning with IMU + wheel odometry alone is safe for 10-30 seconds at airside speeds.** Position uncertainty grows quadratically with time (IMU accelerometer noise) and linearly with distance (wheel encoder scale error). At 10 km/h, 30 seconds of dead reckoning produces ~1.5 m of uncertainty — acceptable for slow-speed airside operation. Adding VGICP LiDAR odometry at 10 Hz extends this to minutes or hours, bounded by SLAM drift.

7. **RAIM-inspired multi-sensor consistency checking requires at least 4 independent position sources for fault detection.** Aurrigo has exactly 4 (GPS, VGICP, IMU dead-reckoning, wheel odometry), enabling fault detection but not exclusion. Adding place recognition as a fifth source (when available) enables fault exclusion — automatically identifying and rejecting the faulty sensor.

8. **Wheel slip detection on wet tarmac is safety-critical and requires cross-sensor validation.** If the wheel encoder says the vehicle moved 2 m but the IMU says 0.5 m, the wheels are slipping. A simple velocity consistency check (|v_wheel - v_imu| > 3 sigma for >0.5 s) triggers noise inflation on wheel odometry. Airport tarmac is frequently wet from rain, de-icing, or fuel spills.

9. **Zero-Velocity Updates (ZUPT) during stationary periods are free IMU calibration.** Airside vehicles spend 30-50% of their time stationary (waiting at gates, queuing for runway crossings, charging). Each stationary period provides tight constraints on velocity (v = 0) and enables gyroscope bias observability. Failing to exploit ZUPT wastes the best bias calibration opportunity available.

10. **Covariance management requires both floors and ceilings.** The covariance must never collapse to zero (which would make the filter ignore all measurements) and must never explode to infinity (which would make the filter accept any measurement). Diagonal floors of 1 mm position and 0.001 rad orientation, combined with covariance symmetry enforcement every 100 steps, prevent numerical divergence over 16-hour operating shifts.

11. **The Sage-Husa adaptive noise estimator should be applied to measurement noise R, not process noise Q.** Adapting R online captures the varying quality of GPS (multipath zones vs open sky) and VGICP (feature-rich vs degenerate geometry) without requiring a pre-built quality map. Adapting Q simultaneously risks filter instability — keep Q fixed or slowly adapted with heavy damping.

12. **Fleet-level state consistency using covariance intersection provides conservative but guaranteed-consistent relative positioning.** When two vehicles detect each other in LiDAR, the relative pose measurement combined with covariance intersection ensures neither vehicle's state estimate becomes inconsistent with the other's — even when the correlation between their GPS corrections is unknown.

13. **The IMM estimator adds only 37% computational overhead (0.37 ms vs 0.23 ms) for 3-mode operation.** This buys automatic GPS mode switching, multipath robustness, and graceful degradation — a compelling return on 0.14 ms of additional latency. The IMM should run continuously, not just when problems are detected, because by the time you detect a problem with a single-hypothesis filter, the state may already be corrupted.

14. **robot_localization is an acceptable Phase 1 baseline but will need replacement.** It handles multi-rate sensor fusion and TF publishing correctly but lacks innovation gating, fault detection, adaptive noise, and multi-hypothesis support. Starting with robot_localization provides a working baseline in 2 weeks while the custom ESKF is developed over 6-8 weeks.

15. **Dual-redundant IMU is strongly recommended for certification.** IMU failure is the only single-sensor failure that causes immediate loss of high-rate state estimation (GPS and LiDAR can degrade gracefully). A second Microstrain GX5 ($3-5K) with cross-validation provides hardware fault tolerance that ISO 3691-4 auditors will expect for safety-critical localization.

16. **The Invariant EKF (InEKF) is the theoretically superior filter but practically unnecessary today.** InEKF's guaranteed convergence from any initial condition is attractive for kidnapped robot scenarios, but the ESKF + IMM + place recognition pipeline provides equivalent practical robustness. InEKF should be evaluated if convergence issues are observed in the field, particularly after prolonged GPS denial with poor initialization.

17. **Total ESKF computational footprint is 0.23 ms CPU time and 15 KB memory — negligible relative to the perception and planning stack.** State estimation is never the computational bottleneck on Orin. The investment is in engineering effort (correct implementation, thorough testing) rather than hardware resources.

18. **Estimated implementation cost: $40-65K over 14-20 weeks.** Phase 1 (robot_localization baseline, 2 weeks, $5K) provides immediate improvement. Phase 2 (custom ESKF with gating, 6-8 weeks, $15-25K) provides production-quality filtering. Phase 3 (IMM + RAIM + fleet consistency, 6-10 weeks, $20-35K) provides full robustness for certification.

---

## 13. Cost and Implementation Roadmap

| Phase | Scope | Duration | Cost | Deliverable |
|---|---|---|---|---|
| **Phase 1** | robot_localization baseline | 2 weeks | $5-8K | EKF fusion of IMU + wheel + VGICP + GPS, TF publishing |
| **Phase 2** | Custom ESKF with innovation gating | 6-8 weeks | $15-25K | ESKF at 500 Hz, chi-squared gate, GPS quality map, fault state machine |
| **Phase 3** | IMM + RAIM + adaptive noise | 4-6 weeks | $10-18K | 3-mode IMM, RAIM consistency, Sage-Husa, GPS-denied manager |
| **Phase 4** | Fleet consistency + relocalization | 4-6 weeks | $10-15K | Covariance intersection, V2V relative pose, multi-hypothesis relocalization |
| **Total** | End-to-end robust state estimation | 16-22 weeks | $40-66K | Certifiable multi-sensor fusion for 24/7 airside ops |

**Hardware additions (optional but recommended):**

| Item | Cost per Vehicle | Justification |
|---|---|---|
| Second IMU (Microstrain GX5) | $3,000-5,000 | Dual-redundant IMU for ISO 3691-4 safety case |
| Dual-antenna GPS | $500-1,500 | Heading observable from GPS (augments gyro) |
| TOTAL additional hardware | $3,500-6,500 | Per vehicle, one-time |

---

## 14. References

### Internal Repository

- [RTK-GPS and IMU Localization](../../../10-knowledge-base/state-estimation/rtk-gps-imu-localization.md) -- RTK fundamentals, IMU noise models, preintegration theory
- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) -- ISAM2 algorithm, factor types, noise models, custom factor development
- [LiDAR SLAM Algorithms](lidar-slam-algorithms.md) -- KISS-ICP, LIO-SAM, FAST-LIO2 comparison and VGICP details
- [LiDAR Place Recognition and Re-Localization](lidar-place-recognition-relocalization.md) -- Scan Context, MinkLoc3D, loop closure pipeline for kidnapped robot recovery
- [Sensor Degradation and Health Monitoring](../../../20-av-platform/sensors/sensor-degradation-health-monitoring.md) -- Per-sensor diagnostics feeding into fault state machine
- [Multi-LiDAR Extrinsic Calibration](../../../20-av-platform/sensors/multi-lidar-calibration.md) -- Calibration accuracy impact on VGICP and scan matching quality
- [Sensor Fusion Architectures](../../perception/overview/sensor-fusion-architectures.md) -- BEVFusion and perception-level fusion (complementary to state estimation fusion)
- [Uncertainty Quantification and Calibration](../../perception/overview/uncertainty-quantification-calibration.md) -- Perception uncertainty that feeds into state estimation covariance
- [Vehicle CAN Bus and DBW](../../../20-av-platform/drive-by-wire/can-bus-dbw.md) -- Wheel encoder data source and vehicle kinematic models
- [Mapping and Localization Overview](mapping-and-localization.md) -- Broader context for mapping paradigms
- [CBF Safety-Critical Planning](../../planning/safety-critical-planning-cbf.md) -- How localization covariance feeds into safety-critical control barriers
- [Runtime Verification and Monitoring](../../../60-safety-validation/runtime-assurance/runtime-verification-monitoring.md) -- STL monitors that consume localization confidence for safety assertions

### External References

- Sola, "Quaternion Kinematics for the Error-State Kalman Filter" (Technical Report, 2017) -- The definitive ESKF reference, free PDF, covers all derivations
- Forster et al., "IMU Preintegration on Manifold for Efficient Visual-Inertial Maximum-a-Posteriori Estimation" (RSS 2015, IJRR 2017) -- Preintegration theory used in GTSAM
- Barrau & Bonnabel, "The Invariant Extended Kalman Filter as a Stable Observer" (IEEE TAC, 2017) -- InEKF with convergence guarantees
- Kaess et al., "iSAM2: Incremental Smoothing and Mapping Using the Bayes Tree" (IJRR 2012) -- GTSAM's ISAM2 algorithm
- Bar-Shalom et al., "Estimation with Applications to Tracking and Navigation" (Wiley, 2001) -- IMM estimator, chi-squared gating, RAIM concepts
- Groves, "Principles of GNSS, Inertial, and Multisensor Integrated Navigation Systems" (2nd Ed., Artech House, 2013) -- Comprehensive multi-sensor navigation reference
- Moore & Stouch, "A Generalized Extended Kalman Filter Implementation for the Robot Operating System" (ISER 2014) -- robot_localization package paper
- Hartley et al., "Contact-Aided Invariant Extended Kalman Filter for Robot State Estimation" (RSS 2020) -- InEKF for legged robots, concepts transferable to wheeled vehicles
- Brossard et al., "AI-IMU Dead-Reckoning" (IEEE T-ITS 2020) -- Learned IMU noise models for improved dead reckoning
- Brown & Hwang, "Introduction to Random Signals and Applied Kalman Filtering" (4th Ed., Wiley, 2012) -- Sage-Husa adaptive estimation, UD factorization
- Blanch et al., "Advanced RAIM User Algorithm Description" (Stanford GPS Lab, 2012) -- RAIM concepts adapted for multi-sensor AV
- Julier & Uhlmann, "A Non-divergent Estimation Algorithm in the Presence of Unknown Correlations" (ACC 1997) -- Covariance Intersection original paper
- comma.ai, "openpilot locationd" (GitHub) -- Open-source ESKF implementation for driving, production-deployed
- Apollo, "Multi-Sensor Fusion Module" (GitHub, Apollo 8.0) -- Baidu's production ESKF for autonomous driving
- Qin et al., "VINS-Mono: A Robust and Versatile Monocular Visual-Inertial State Estimator" (IEEE T-RO 2018) -- ESKF + sliding window for visual-inertial odometry, widely cited
- Bloesch et al., "Iterated Extended Kalman Filter Based Visual-Inertial Odometry Using Direct Photometric Feedback" (IJRR 2017) -- IEKF for VIO, convergence analysis
