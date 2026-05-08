# Bicycle Kinematic Model: First Principles

## The Vehicle Dynamics Foundation for the reference airside AV stack's Simulation and Control

---

## 1. Derivation from First Principles

### 1.1 Assumptions

1. **Rigid body:** Vehicle doesn't deform
2. **No tire slip:** Tire velocity is aligned with tire heading (kinematic, not dynamic)
3. **Planar motion:** Vehicle moves in the x-y plane only (no pitch, roll)
4. **Two-wheel equivalent:** Left and right wheels collapsed to single front and rear wheel on centerline

### 1.2 Geometry

```
            δ (steering angle)
            ↗
    ┌──────●──────┐  Front axle (steered)
    │      │      │
    │      │ L    │  L = wheelbase = 3.15m (third-generation tug)
    │      │      │
    │      ●      │  Rear axle (reference point)
    └─────────────┘
           ↑
     (x, y, θ) — state: position and heading of rear axle
```

### 1.3 Kinematic Equations (Continuous Time)

The rear axle traces a path. The front axle steers.

```
ẋ = v · cos(θ)           — x velocity
ẏ = v · sin(θ)           — y velocity
θ̇ = v · tan(δ) / L      — yaw rate (turning)

where:
  (x, y)  — rear axle position [m]
  θ       — heading angle [rad], 0 = east, π/2 = north
  v       — velocity at rear axle [m/s]
  δ       — front wheel steering angle [rad]
  L       — wheelbase [m] (distance between front and rear axles)
```

**Derivation of θ̇:**
```
The instantaneous turning radius R is related to steering angle by:
  tan(δ) = L / R

The yaw rate is:
  θ̇ = v / R = v · tan(δ) / L
```

### 1.4 Discrete-Time Model (Euler Integration)

the reference airside AV stack's pysim uses dt = 0.02s (50Hz):

```python
def kinematic_step(x, y, theta, v, delta, L=3.15, dt=0.02):
    """One step of the kinematic bicycle model."""
    x_new = x + v * math.cos(theta) * dt
    y_new = y + v * math.sin(theta) * dt
    theta_new = theta + (v * math.tan(delta) / L) * dt

    # Normalize theta to [-π, π]
    theta_new = (theta_new + math.pi) % (2 * math.pi) - math.pi

    return x_new, y_new, theta_new
```

**For better accuracy (RK4 integration):**
```python
def kinematic_step_rk4(x, y, theta, v, delta, L=3.15, dt=0.02):
    """Fourth-order Runge-Kutta integration."""
    def f(state):
        x, y, theta = state
        return np.array([
            v * np.cos(theta),
            v * np.sin(theta),
            v * np.tan(delta) / L
        ])

    state = np.array([x, y, theta])
    k1 = f(state)
    k2 = f(state + dt/2 * k1)
    k3 = f(state + dt/2 * k2)
    k4 = f(state + dt * k3)

    state_new = state + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
    return state_new[0], state_new[1], state_new[2]
```

---

## 2. third-generation tug Parameters

```python
# From airside_python_sim and av_comms config
third-generation tug_PARAMS = {
    'wheelbase': 3.15,              # meters (L_eff, validated from bag data)
    'max_steering_angle': 0.8762,   # radians (50.2 degrees)
    'max_speed': 6.67,              # m/s (24 km/h)
    'max_acceleration': 1.0,        # m/s² (approximate)
    'max_deceleration': 2.0,        # m/s² (hydraulic braking)
    'track_width': 1.8,             # meters (approximate)
    'vehicle_length': 5.5,          # meters (approximate)
    'vehicle_width': 2.0,           # meters (approximate)
    'turning_radius_min': 3.15 / math.tan(0.8762),  # = 2.63m at max steer
}
```

### 2.1 Effective Wheelbase (L_eff)

The kinematic bicycle model uses an "effective" wheelbase that may differ from the physical wheelbase due to:
- Tire compliance (cornering stiffness)
- Steering geometry (Ackermann approximation error)
- Load distribution

```python
# From fit_wheelbase.py — fitted to real third-generation tug bag data
# Method: minimize error between model prediction and GPS/odometry trajectory
# Result: L_eff = 3.15m
# Validation error: mean 4.76m over 116m trajectory (4.1%)
```

### 2.2 Minimum Turning Radius

```
R_min = L / tan(δ_max) = 3.15 / tan(0.8762) = 3.15 / 1.198 = 2.63m

This is the minimum turning radius of the rear axle.
The outer front wheel traces a larger radius:
R_outer = sqrt(R_min² + L²) = sqrt(2.63² + 3.15²) = 4.10m

The vehicle body sweeps an area between R_inner ≈ 1.73m and R_outer ≈ 4.10m
```

---

## 3. Ackermann Steering Geometry

### 3.1 Ideal Ackermann

In reality, the inner and outer wheels must steer at different angles to avoid tire scrub:

```
    δ_outer        δ_inner
       ↗              ↗
  ●────────────────────●   Front axle
  │         L          │
  │                    │
  ●────────────────────●   Rear axle
        R (turning radius)

Ideal Ackermann:
  cot(δ_outer) - cot(δ_inner) = W / L

  where W = track width = 1.8m, L = wheelbase = 3.15m

  For the bicycle model, δ is the equivalent single-wheel angle:
  δ ≈ (δ_inner + δ_outer) / 2  (approximation)
  More precisely: tan(δ) = L / R
```

### 3.2 third-generation tug Steering Conversion

From `airside_av_comms`:
```
Steering command (ROS): angular.z in radians
  → Convert: angle_rad → sign-inverted percentage counts
  → third-generation tug: ±95 counts = ±50.2° (0.8762 rad)
  → Scale: counts = angle_rad * (95 / 0.8762) = angle_rad * 108.4

Feedback: steering position sensor → percentage counts → radians
```

---

## 4. Crab Steering (third-generation tug Side Drive)

### 4.1 Crab Mode Kinematics

In crab mode, all four wheels steer in the same direction:

```
    δ_crab         δ_crab
       ↗              ↗
  ●────────────────────●   Front axle
  │                    │
  │                    │
  ●────────────────────●   Rear axle
       ↗              ↗
    δ_crab         δ_crab

Kinematic equations in crab mode:
  ẋ = v · cos(θ + δ_crab)    — moves sideways!
  ẏ = v · sin(θ + δ_crab)
  θ̇ = 0                      — heading doesn't change

This is pure translation at angle δ_crab relative to heading.
```

### 4.2 Transition Mode

third-generation tug can transition between Ackermann and crab steering:
```
State machine: ACKERMANN → TRANSITION → CRAB → TRANSITION → ACKERMANN

During transition, front and rear wheels steer at different rates
to smoothly change from differential to parallel steering.
```

---

## 5. Model Predictive Control (MPC) with Bicycle Model

### 5.1 Linearized State Space

For MPC, linearize around the current state:

```
State: x = [X, Y, θ, v]ᵀ
Input: u = [a, δ]ᵀ (acceleration, steering)

Continuous: ẋ = f(x, u)
Linearized: ẋ ≈ A·x + B·u

A = ∂f/∂x = [0  0  -v·sin(θ)  cos(θ)]
             [0  0   v·cos(θ)  sin(θ)]
             [0  0   0         tan(δ)/L]
             [0  0   0         0       ]

B = ∂f/∂u = [0               0            ]
             [0               0            ]
             [0               v/(L·cos²(δ))]
             [1               0            ]

Discretized: x_{k+1} = A_d·x_k + B_d·u_k
  A_d = I + A·dt,  B_d = B·dt  (Euler)
```

### 5.2 MPC Formulation

```
min_{u_0,...,u_{N-1}} Σ_{k=0}^{N-1} [x_k^T Q x_k + u_k^T R u_k] + x_N^T P x_N

subject to:
  x_{k+1} = f(x_k, u_k)            — bicycle model dynamics
  |δ| ≤ δ_max = 0.8762 rad          — steering limits
  |v| ≤ v_max = 6.67 m/s            — speed limits
  |a| ≤ a_max = 2.0 m/s²            — acceleration limits
  |δ̇| ≤ δ̇_max (steering rate limit)  — actuator rate limit

Q = diag(q_x, q_y, q_θ, q_v)  — state tracking weights
R = diag(r_a, r_δ)             — input effort weights
P = solution of discrete-time algebraic Riccati equation (terminal cost)
```

---

## 6. Integration with World Model

### 6.1 Physics Prior for Predictions

The bicycle model provides a **physics prior** for the world model:

```python
def enforce_kinematic_feasibility(predicted_trajectory, dt=0.2):
    """Check if a world model prediction is kinematically feasible."""
    for t in range(1, len(predicted_trajectory)):
        x0, y0, theta0 = predicted_trajectory[t-1]
        x1, y1, theta1 = predicted_trajectory[t]

        # Implied velocity
        v = math.sqrt((x1-x0)**2 + (y1-y0)**2) / dt

        # Implied steering angle
        dtheta = theta1 - theta0
        if abs(v) > 0.01:
            delta = math.atan(dtheta * L / (v * dt))
        else:
            delta = 0

        # Check feasibility
        if abs(v) > third-generation tug_PARAMS['max_speed']:
            return False, f"Speed {v:.1f} exceeds max {third-generation tug_PARAMS['max_speed']}"
        if abs(delta) > third-generation tug_PARAMS['max_steering_angle']:
            return False, f"Steering {delta:.2f} exceeds max {third-generation tug_PARAMS['max_steering_angle']}"

    return True, "Feasible"
```

### 6.2 World Model Loss Regularization

Add a kinematic feasibility loss to world model training:

```python
def kinematic_loss(predicted_ego_trajectory, dt=0.2, L=3.15):
    """Penalize kinematically infeasible ego predictions."""
    positions = predicted_ego_trajectory[:, :2]  # (T, 2)
    headings = predicted_ego_trajectory[:, 2]     # (T,)

    velocities = torch.diff(positions, dim=0) / dt  # (T-1, 2)
    speeds = velocities.norm(dim=1)                   # (T-1,)
    heading_rates = torch.diff(headings) / dt          # (T-1,)

    # Implied steering angles
    implied_steering = torch.atan(heading_rates * L / (speeds + 1e-6))

    # Penalize exceeding limits
    speed_violation = F.relu(speeds - 6.67)
    steering_violation = F.relu(implied_steering.abs() - 0.8762)

    return speed_violation.mean() + steering_violation.mean()
```

---

## 7. Validation: the reference airside AV stack's 4.1% Error Result

```
Test: Replay real third-generation tug bag data commands through kinematic bicycle model
  Input: Recorded steering and velocity commands from CAN
  Output: Predicted trajectory from bicycle model
  Ground truth: GPS/odometry trajectory from bag

Result:
  Total distance: 116m
  Mean position error: 4.76m (4.1%)
  Max position error: ~8m at end of trajectory (accumulated)

Error sources:
  1. No tire slip modeling (dynamic effects at turns)
  2. Hydraulic steering actuator delay (not modeled)
  3. Effective wheelbase varies with load
  4. GPS/odometry ground truth has its own errors
  5. Euler integration numerical error (small at 50Hz)
```

**4.1% is good enough for:**
- Nav stack testing (trajectory following, behavior FSM)
- Scenario-based validation (waypoint reaching, obstacle response)
- World model training data augmentation (approximate physics)

**Not good enough for:**
- Precise docking (< 5cm accuracy needed)
- Safety-critical collision prediction (need better dynamic model)
- Crab steering mode (different kinematics not in bicycle model)

---

## Sources

- Rajamani, R. "Vehicle Dynamics and Control." Springer, 2012
- Kong et al. "Kinematic and Dynamic Vehicle Models for Autonomous Driving Control Design." IV, 2015
- Werling et al. "Optimal Trajectory Generation for Dynamic Street Scenarios in a Frenet Frame." ICRA, 2010
- reference airside AV stack airside_python_sim source code (validated model)
- reference airside AV stack fit_wheelbase.py (parameter identification)
