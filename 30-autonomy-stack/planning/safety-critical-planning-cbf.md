# Safety-Critical Planning with Control Barrier Functions and Game-Theoretic Interaction Modeling

## Formal Safety Guarantees for Autonomous Vehicles on Airport Airside

**Last updated:** 2026-04-11

---

> **Key Takeaway:** Control Barrier Functions (CBFs) provide mathematically provable collision avoidance by enforcing forward invariance of a safe set via a lightweight QP solved at 100-200 Hz. For Aurrigo's airside AV stack, CBFs serve as a safety filter on *both* the neural AC and classical BC paths of the Simplex architecture -- providing formal guarantees regardless of which planner is active. Combined with game-theoretic interaction modeling (GameFormer-style level-k reasoning adapted for airside multi-agent scenarios), this creates a planning stack that is simultaneously safe, interactive, and certifiable. The CBF-QP solves in 50-500 us on Orin, well within the 10 ms latency budget, and directly addresses ISO 3691-4 requirements for provable braking safety and personnel clearance. This is the missing formal safety layer between Aurrigo's existing Frenet planner and the aspirational neural planning stack.

---

## Table of Contents

1. [Control Barrier Functions: Mathematical Foundations](#1-control-barrier-functions-mathematical-foundations)
2. [CBF for Airside Safety Constraints](#2-cbf-for-airside-safety-constraints)
3. [Game-Theoretic Interaction Modeling](#3-game-theoretic-interaction-modeling)
4. [CBF + Neural Planner Integration](#4-cbf--neural-planner-integration)
5. [Multi-Agent CBF for Fleet Coordination](#5-multi-agent-cbf-for-fleet-coordination)
6. [Formal Verification and Safety Proofs](#6-formal-verification-and-safety-proofs)
7. [Practical Implementation](#7-practical-implementation)
8. [Integration with Simplex Architecture](#8-integration-with-simplex-architecture)
9. [References](#9-references)

---

## 1. Control Barrier Functions: Mathematical Foundations

### 1.1 Definitions and Core Theory

A **Control Barrier Function** is a mathematical tool that guarantees a system remains within a defined safe set for all time. Unlike Lyapunov functions (which prove stability), CBFs prove safety -- that the system state never enters an unsafe region.

**Safe Set.** Given a continuously differentiable function `h: R^n -> R`, the safe set is:

```
C = { x in R^n : h(x) >= 0 }
```

The boundary of C is `dC = { x : h(x) = 0 }`, and the interior is `Int(C) = { x : h(x) > 0 }`.

**Intuition:** h(x) is like a "distance to danger." When h(x) > 0, we are safe. When h(x) = 0, we are at the boundary. When h(x) < 0, we have violated safety. A CBF ensures h(x) never becomes negative.

**Control-Affine Dynamics.** Consider a nonlinear control-affine system:

```
x_dot = f(x) + g(x) * u

where:
  x in R^n       -- state vector
  u in U <= R^m  -- control input (bounded)
  f: R^n -> R^n  -- drift dynamics
  g: R^n -> R^(n x m)  -- control matrix
```

This form captures the bicycle kinematic model (Aurrigo's ADT3), robotic vehicles, and most control systems of practical interest.

**Definition (Control Barrier Function).** A continuously differentiable function `h: R^n -> R` is a **Control Barrier Function** for the system `x_dot = f(x) + g(x)u` on the set C = {x : h(x) >= 0} if there exists a class-K_inf function alpha such that:

```
sup_{u in U} [ L_f h(x) + L_g h(x) * u ] >= -alpha(h(x))    for all x in C
```

where:
- `L_f h(x) = dh/dx * f(x)` is the Lie derivative of h along f
- `L_g h(x) = dh/dx * g(x)` is the Lie derivative of h along g
- `alpha` is a class-K_inf function (continuous, strictly increasing, alpha(0) = 0)

**What This Means:** At every state x in the safe set, there exists at least one control input u that keeps h(x) from decreasing too fast. Specifically, the rate of decrease of h is bounded by alpha(h(x)), which goes to zero as h approaches the boundary. This ensures the system cannot "escape" the safe set.

**Theorem (Forward Invariance).** If h is a valid CBF for the system on C, then any Lipschitz continuous controller u(x) satisfying:

```
L_f h(x) + L_g h(x) * u(x) >= -alpha(h(x))
```

renders C forward invariant. That is, if x(0) in C, then x(t) in C for all t >= 0.

**Proof sketch:** By contradiction. Suppose h(x(t*)) = 0 for the first time at t*. Then h_dot(x(t*)) = L_f h + L_g h * u >= -alpha(h(x(t*))) = -alpha(0) = 0. So h cannot decrease through zero.

### 1.2 The CBF-QP Formulation

The key practical insight: the CBF condition is **linear in the control input u**. This means we can find the minimally invasive safe control by solving a Quadratic Program.

**CBF-QP (Safety Filter):**

```
u* = argmin_u  (1/2) * ||u - u_nom||^2

subject to:
  L_f h(x) + L_g h(x) * u >= -alpha(h(x))     (CBF constraint)
  u_min <= u <= u_max                             (actuator limits)
```

where `u_nom` is the nominal control input from any upstream planner (neural, Frenet, or otherwise).

**Properties:**
- If `u_nom` already satisfies the CBF constraint, then `u* = u_nom` (no modification)
- If `u_nom` violates safety, `u*` is the closest safe input to `u_nom` in the L2 sense
- This is a convex QP with linear constraints -- solvable in **50-500 microseconds**
- The QP always has a feasible solution if h is a valid CBF (by definition)

**Class-K_inf Function Choices:**

| alpha(h) | Name | Behavior |
|----------|------|----------|
| gamma * h | Linear | Most common. gamma controls aggressiveness. Higher gamma = more permissive near boundary |
| gamma * h^3 | Cubic | Gentler far from boundary, aggressive near boundary |
| gamma * h^(1/3) | Fractional | More aggressive far from boundary |
| gamma * arctan(h) | Bounded | Saturates for large h -- prevents excessive conservatism |

For airside operations at 5-25 km/h, **linear alpha with gamma = 1.0-3.0** provides the right balance between safety and maneuverability.

### 1.3 CBF with the Bicycle Kinematic Model

Aurrigo's ADT3 uses a bicycle kinematic model (documented in `20-av-platform/drive-by-wire/bicycle-kinematic-model.md`) with state `x = [px, py, theta, v]` and control `u = [a, delta]` where a is acceleration and delta is front steering angle.

**System Dynamics (Control-Affine Form):**

```
    [ v * cos(theta) ]       [ 0        0         ]
    [ v * sin(theta) ]       [ 0        0         ]
x_dot = [ v * tan(delta)/L ] + [ 0   v*sec^2(delta)/L ] * [a_cmd    ]
    [ 0              ]       [ 1        0         ]   [delta_cmd]
         f(x)                     g(x)                    u

Note: This formulation separates the state-dependent drift f(x) from the 
control-dependent term g(x)*u. However, the steering angle delta appears 
in both f(x) and g(x), making this a quasi-control-affine system.
```

**Practical Simplification for CBF:** For the low-speed airside regime (5-25 km/h), we treat steering as a state that evolves slowly and compute the CBF constraint with respect to acceleration only, yielding a scalar QP:

```
State:   x = [px, py, theta, v]
Control: u = a (longitudinal acceleration)
         delta treated as slowly-varying parameter

Simplified dynamics:
  px_dot = v * cos(theta)
  py_dot = v * sin(theta)
  theta_dot = v * tan(delta) / L
  v_dot = a

f(x) = [v*cos(theta), v*sin(theta), v*tan(delta)/L, 0]^T
g(x) = [0, 0, 0, 1]^T
```

This simplification is valid because:
1. At low speeds, longitudinal braking is the primary safety action
2. Steering response has significant delay (hydraulic actuators on ADT3)
3. Emergency braking is always achievable via acceleration control alone

For the full 2D CBF with both acceleration and steering, see Section 1.5 (Higher-Order CBF).

**ADT3 Parameters (from `20-av-platform/drive-by-wire/bicycle-kinematic-model.md`):**

```python
ADT3_PARAMS = {
    'wheelbase': 3.15,              # meters (L_eff)
    'max_steering_angle': 0.8762,   # radians (50.2 degrees)
    'max_speed': 6.67,              # m/s (24 km/h)
    'max_acceleration': 1.0,        # m/s^2
    'max_deceleration': 2.0,        # m/s^2 (hydraulic braking)
    'vehicle_length': 5.5,          # meters
    'vehicle_width': 2.0,           # meters
    'min_turning_radius': 2.63,     # meters (at max steer)
}
```

### 1.4 Higher-Order Control Barrier Functions (HOCBF)

Many practical safety constraints have **relative degree > 1** with respect to the control input. This means the control does not directly appear in the first time derivative of h.

**Example:** For an obstacle avoidance CBF `h(x) = ||p_ego - p_obs||^2 - d_safe^2`, the first derivative h_dot depends on velocity (not acceleration). The control input (acceleration) only appears in h_ddot. This is a relative degree 2 system.

**Relative Degree.** A function h has relative degree r with respect to u if:

```
L_g L_f^k h(x) = 0    for k = 0, 1, ..., r-2
L_g L_f^(r-1) h(x) != 0
```

For the bicycle model with acceleration control:
- Position-based constraints (obstacle avoidance): relative degree 2
- Velocity-based constraints (speed limits): relative degree 1
- Acceleration-based constraints: relative degree 0 (directly constrained by u)

**HOCBF Definition.** For a system with relative degree r, define a sequence of functions:

```
psi_0(x) = h(x)
psi_1(x) = psi_0_dot(x) + alpha_1(psi_0(x))
psi_2(x) = psi_1_dot(x) + alpha_2(psi_1(x))
...
psi_r(x) = psi_(r-1)_dot(x) + alpha_r(psi_(r-1)(x))
```

where alpha_1, ..., alpha_r are class-K functions.

**HOCBF Constraint:** The safety condition becomes:

```
L_f^r h(x) + L_g L_f^(r-1) h(x) * u + O(h, h_dot, ...) >= -alpha_r(psi_(r-1)(x))
```

**For Relative Degree 2 (most common airside case):**

```
h(x) >= 0                                    -- safe set
h_dot(x) + alpha_1 * h(x) >= 0               -- first-order condition
h_ddot(x, u) + alpha_2 * (h_dot + alpha_1*h) >= 0  -- second-order condition (contains u)

The QP constraint is on the last inequality only, which is linear in u.
```

**Worked Example: Obstacle Avoidance HOCBF with Bicycle Model**

```
h(x) = (px - ox)^2 + (py - oy)^2 - d_safe^2

where (ox, oy) is obstacle position (assumed stationary for now)

h_dot = 2*(px-ox)*vx + 2*(py-oy)*vy
      = 2*(px-ox)*v*cos(theta) + 2*(py-oy)*v*sin(theta)
      = 2 * delta_p^T * v_ego

This depends on velocity but not acceleration. Relative degree = 2.

h_ddot = 2*v_ego^T * v_ego + 2*delta_p^T * a_ego
       = 2*v^2 + 2*[(px-ox)*cos(theta) + (py-oy)*sin(theta)] * a
         + 2*v^2 * [(px-ox)*(-sin(theta)) + (py-oy)*cos(theta)] * tan(delta)/L

The control 'a' appears linearly in h_ddot.
```

### 1.5 Exponential Control Barrier Functions (ECBF)

Exponential CBFs provide smoother behavior near the safe set boundary, avoiding the jerky corrections that standard CBFs can produce.

**ECBF Condition (for relative degree r):**

```
L_f^r h(x) + L_g L_f^(r-1) h(x) * u + K_alpha * eta(x) >= 0

where:
  eta(x) = [h(x), h_dot(x), ..., h^(r-1)(x)]^T
  K_alpha = [alpha_r * ... * alpha_1, ..., alpha_r + alpha_(r-1), alpha_r]
```

The coefficients K_alpha are chosen so that the dynamics of h resemble a stable linear system:

```
h^(r) + alpha_r * h^(r-1) + ... + alpha_1 * h >= 0
```

This is equivalent to requiring the poles of the "barrier dynamics" to be in the left half-plane.

**For relative degree 2 with equal poles at -p:**

```
h_ddot + 2p * h_dot + p^2 * h >= 0

Choosing p = 1.0-3.0 gives smooth convergence back to the safe set interior.
```

**Advantage over standard HOCBF:** ECBFs prevent oscillatory behavior near the boundary and provide a more predictable, comfortable vehicle response -- important for airport operations where smooth driving is required near aircraft and personnel.

### 1.6 Input-Constrained CBF

Real actuators have limits. The ADT3 has:
- Acceleration: [-2.0, 1.0] m/s^2
- Steering rate: approximately [-0.5, 0.5] rad/s (hydraulic limitation)

**Problem:** If the actuator limits are too tight, the CBF-QP may become **infeasible** -- there is no control input within the allowed range that satisfies the safety constraint. This means the vehicle cannot maintain safety with its available control authority.

**Input-Constrained CBF (IcCBF):** The safe set must be restricted to states from which safety can be maintained given input constraints:

```
C_feasible = { x in C : exists u in U such that L_f h(x) + L_g h(x) * u >= -alpha(h(x)) }
```

**Practical implication for airside:** The CBF must account for braking distance. At v = 6.67 m/s (24 km/h) with max deceleration 2.0 m/s^2, the minimum stopping distance is:

```
d_stop = v^2 / (2 * a_max) = 6.67^2 / (2 * 2.0) = 11.12 m
```

Add reaction time (0.1s for CBF computation + 0.2s for actuator response):

```
d_react = v * t_react = 6.67 * 0.3 = 2.0 m
d_total = 11.12 + 2.0 = 13.12 m
```

The obstacle avoidance CBF's safe distance must be at least 13.12 m at maximum speed. For the typical airside speed of 15 km/h (4.17 m/s), this reduces to:

```
d_total = 4.17^2 / (2*2.0) + 4.17*0.3 = 4.34 + 1.25 = 5.59 m
```

**Adaptive Safe Distance:**

```python
def adaptive_safe_distance(v_ego, a_max_brake=2.0, t_react=0.3, d_margin=1.0):
    """Compute speed-dependent safe distance for CBF.
    
    Args:
        v_ego: Current ego velocity [m/s]
        a_max_brake: Maximum braking deceleration [m/s^2]
        t_react: Total reaction time (compute + actuator) [s]
        d_margin: Fixed safety margin [m]
    
    Returns:
        Minimum safe distance [m]
    """
    d_brake = v_ego**2 / (2 * a_max_brake)
    d_react = v_ego * t_react
    return d_brake + d_react + d_margin
```

---

## 2. CBF for Airside Safety Constraints

Airport airside presents a unique set of safety constraints that map naturally to Control Barrier Functions. Each constraint defines a safe set; the intersection of all safe sets defines the overall safe operating region.

### 2.1 Obstacle Avoidance CBF

The most fundamental safety constraint: maintain minimum distance from all detected obstacles.

**Barrier Function:**

```
h_obs(x, o_i) = ||p_ego - p_obs_i||^2 - d_safe(v_ego, class_i)^2

where:
  p_ego = [px, py]          -- ego vehicle position
  p_obs_i = [ox_i, oy_i]   -- i-th obstacle position
  d_safe(v, c) = adaptive safe distance (speed and class dependent)
  class_i in {aircraft, GSE, personnel, FOD, structure}
```

**Class-Dependent Safe Distances (airside):**

| Obstacle Class | Base Distance | At 15 km/h | At 24 km/h | Justification |
|---------------|--------------|------------|------------|---------------|
| Aircraft surface | 0.5 m | 6.09 m | 14.12 m | ISO 3691-4 + airline GSA requirements |
| Personnel (standing) | 2.0 m | 7.59 m | 15.12 m | 27,000 ramp accidents/yr -- maximum caution |
| Personnel (crouching) | 3.0 m | 8.59 m | 16.12 m | Harder to detect, slower to react |
| Other GSE | 1.0 m | 6.59 m | 14.12 m | Standard inter-vehicle clearance |
| Fixed structure | 0.5 m | 6.09 m | 14.12 m | Known position, no sudden motion |
| FOD | 0.3 m | 5.89 m | 13.42 m | Small objects, may need to stop or avoid |

**For Moving Obstacles (relative velocity formulation):**

```
h_obs_moving(x) = ||p_ego - p_obs||^2 - d_safe^2

h_dot = 2*(p_ego - p_obs)^T * (v_ego - v_obs)

For the HOCBF, the relative velocity term means we must also account for
the obstacle's predicted motion. If obstacle velocity is estimated from 
tracking (CenterPoint/SimpleTrack), the CBF naturally becomes more 
conservative when closing on a moving target.
```

### 2.2 Aircraft Clearance CBF

Aircraft are the highest-value assets on the apron ($100M-$400M). Damage from GSE averages $250K per incident and can reach $35M per engine or $139M+ for structural damage. The clearance CBF must model aircraft geometry, not just a point.

**Ellipsoidal Approximation:**

```
Aircraft fuselage: major semi-axis a (half-length), minor semi-axis b (half-width)
  Boeing 737:  a = 19.4 m, b = 1.85 m
  Airbus A320: a = 18.7 m, b = 1.95 m
  Regional jet: a = 15.0 m, b = 1.5 m

h_aircraft(x) = ((px-ax)*cos(theta_ac) + (py-ay)*sin(theta_ac))^2 / (a + d_clear)^2
              + ((px-ax)*sin(theta_ac) - (py-ay)*cos(theta_ac))^2 / (b + d_clear)^2
              - 1

where:
  (ax, ay, theta_ac) -- aircraft position and heading
  d_clear = 0.5 m    -- minimum clearance (airline/airport requirement)
  
h_aircraft >= 0 means the ego vehicle is outside the expanded ellipsoid.
```

**Wing and Engine Pod CBFs:** Wings and engine nacelles extend beyond the fuselage ellipsoid. Additional CBFs are needed:

```
h_wing_L(x) = signed_distance(p_ego, wing_left_polygon) - d_clear
h_wing_R(x) = signed_distance(p_ego, wing_right_polygon) - d_clear
h_engine_L(x) = ||p_ego - p_engine_L||^2 - (r_engine + d_clear)^2
h_engine_R(x) = ||p_ego - p_engine_R||^2 - (r_engine + d_clear)^2
```

Aircraft geometry can be obtained from aircraft type codes (via A-CDM/ACRIS data) and known parking stand positions. The CBF updates when aircraft type or position changes.

### 2.3 Geofence CBF

Airport airside has hard boundaries that must never be crossed: active runways, ILS critical areas, restricted taxiways, and construction zones.

**Signed Distance Geofence:**

```
h_geofence(x) = signed_distance(p_ego, boundary)

where signed_distance > 0 inside the allowed area, < 0 outside.
```

For polygonal geofences (the common case), the signed distance is computed as:

```python
def signed_distance_polygon(point, polygon_vertices):
    """Signed distance from point to polygon boundary.
    
    Returns:
        Positive if inside polygon, negative if outside.
        Magnitude is distance to nearest edge.
    """
    # Find nearest edge
    min_dist = float('inf')
    for i in range(len(polygon_vertices)):
        j = (i + 1) % len(polygon_vertices)
        edge_dist = point_to_segment_distance(point, 
                                               polygon_vertices[i], 
                                               polygon_vertices[j])
        min_dist = min(min_dist, edge_dist)
    
    # Sign: positive inside, negative outside
    sign = 1.0 if point_in_polygon(point, polygon_vertices) else -1.0
    return sign * min_dist
```

**Runway Protection Zone CBF:**

```
h_runway(x) = -signed_distance(p_ego, runway_protection_zone)

The runway protection zone is the active runway + 30m lateral buffer + 
300m approach/departure extensions. h_runway >= 0 means we are OUTSIDE 
the protection zone.

This is the highest-priority CBF -- violation means potential conflict with 
aircraft on runway.
```

**ILS Critical Area CBF:**

```
h_ils(x) = -signed_distance(p_ego, ils_critical_area)

ILS critical areas are active when instrument approaches are in use.
The CBF can be dynamically enabled/disabled based on ATIS/NOTAM data.
```

### 2.4 Speed Zone CBF

Different areas of the apron have different speed limits, typically enforced by airport authority rules.

```
h_speed(x) = v_max(zone(p_ego)) - v_ego

where:
  v_max(zone) returns the speed limit for the zone containing p_ego
  v_ego = current ego velocity

Typical airside speed zones:
  Taxiway: 25 km/h (6.94 m/s)
  Apron main: 20 km/h (5.56 m/s)
  Near aircraft stand: 10 km/h (2.78 m/s)
  Passenger boarding area: 5 km/h (1.39 m/s)
```

This is a **relative degree 1** CBF (velocity directly depends on acceleration):

```
h_dot_speed = -a_ego

CBF constraint: -a_ego >= -alpha * (v_max - v_ego)
             => a_ego <= alpha * (v_max - v_ego)

When approaching the speed limit, acceleration is capped proportionally
to the remaining speed margin.
```

### 2.5 Jet Blast Zone CBF

Jet engine exhaust creates invisible but dangerous zones. Blast velocities exceed 50 km/h up to 60-100m behind large aircraft during taxi power. This is a unique airside hazard with no road-driving equivalent.

```
h_jetblast(x) = distance_to_blast_cone(p_ego, engine_pos, engine_heading, blast_params) - d_safe

Blast cone geometry (approximation):
  - Origin: engine exhaust nozzle position
  - Direction: opposite to engine heading (i.e., behind the aircraft)
  - Half-angle: 15-25 degrees (depends on power setting)
  - Length: 60m (idle), 120m (breakaway), 200m+ (takeoff)
  - Safe distance from cone boundary: 5m minimum

Power setting estimation:
  - Parked, engines off: no blast zone (CBF disabled)
  - Idle/taxi power: 60m cone, 15-degree half-angle
  - Breakaway thrust: 120m cone, 20-degree half-angle
  - If unknown: assume worst case (breakaway)
```

**Dynamic Activation:** The jet blast CBF is only active when:
1. Aircraft engines are running (detected via thermal camera, ADS-B engine status, or ground handler communication)
2. Aircraft is in pushback completion, taxi-out, or run-up hold
3. The ego vehicle is within 200m of the aircraft tail

### 2.6 Personnel Proximity CBF

Personnel are the most vulnerable and unpredictable agents on the apron. The CBF must handle multiple people simultaneously with speed-dependent margins.

**Multi-Person CBF (closest N people):**

```
h_personnel_i(x) = ||p_ego - p_person_i||^2 - d_safe_personnel(v_ego)^2

for i = 1, 2, ..., N_nearest

where:
  N_nearest = min(N_detected, 10)  -- track up to 10 nearest people
  d_safe_personnel(v) = max(3.0, v^2/(2*a_max) + v*t_react + 2.0)
  
The 2.0m additive margin accounts for:
  - Personnel sudden movement (up to 2 m/s sprint start)
  - Perception latency and localization error
  - Vehicle footprint (ego is not a point)
```

**Crouching Personnel:** Ground crew frequently kneel or crouch near aircraft wheels, cargo doors, and fueling points. These poses are harder to detect (84-88% AEB failure rate for hi-vis at night per the safety research). The CBF uses an inflated distance:

```
h_crouch_i(x) = ||p_ego - p_crouch_i||^2 - (1.5 * d_safe_personnel(v_ego))^2
```

### 2.7 Composing Multiple CBFs

The real system must satisfy **all** safety constraints simultaneously. Multiple CBFs are composed in the QP by stacking their constraints.

**Multi-Constraint CBF-QP:**

```
u* = argmin_u  (1/2) * ||u - u_nom||^2

subject to:
  L_f h_1(x) + L_g h_1(x) * u >= -alpha_1(h_1(x))    -- obstacle 1
  L_f h_2(x) + L_g h_2(x) * u >= -alpha_2(h_2(x))    -- obstacle 2
  ...
  L_f h_k(x) + L_g h_k(x) * u >= -alpha_k(h_k(x))    -- obstacle k
  L_f h_geo(x) + L_g h_geo(x) * u >= -alpha_geo(h_geo(x))  -- geofence
  L_f h_speed(x) + L_g h_speed(x) * u >= -alpha_speed(h_speed(x))  -- speed
  u_min <= u <= u_max                                    -- actuator limits
```

**Priority-Based Relaxation:** When the QP becomes infeasible (conflicting constraints), we use a prioritized relaxation scheme with slack variables:

```
Priority 1 (NEVER violate):  Personnel proximity, runway boundary
Priority 2 (STRONGLY avoid): Aircraft clearance, geofence
Priority 3 (PREFER to keep): Speed limits, comfort bounds
Priority 4 (NICE to have):   Nominal trajectory tracking

u* = argmin_u  (1/2)*||u - u_nom||^2 + w1*s1^2 + w2*s2^2 + w3*s3^2

subject to:
  CBF_priority_1 constraints (no slack -- hard constraints)
  CBF_priority_2 constraints + s1 >= 0  (with large penalty w1 = 1e6)
  CBF_priority_3 constraints + s2 >= 0  (with medium penalty w2 = 1e3)
  CBF_priority_4 constraints + s3 >= 0  (with small penalty w3 = 1.0)
  u_min <= u <= u_max
  s1, s2, s3 >= 0
```

**Code: Multi-CBF QP Solver**

```python
import numpy as np
from scipy.optimize import minimize

class AirsideCBFFilter:
    """CBF safety filter for airside autonomous vehicle.
    
    Solves the CBF-QP to find the minimally invasive safe control input.
    Designed for Aurrigo ADT3 with bicycle kinematic model.
    """
    
    def __init__(self, params):
        self.L = params['wheelbase']           # 3.15 m
        self.a_max = params['max_acceleration'] # 1.0 m/s^2
        self.a_min = -params['max_deceleration'] # -2.0 m/s^2
        self.gamma_obs = 2.0    # CBF gain for obstacles
        self.gamma_geo = 3.0    # CBF gain for geofence
        self.gamma_speed = 1.5  # CBF gain for speed
        self.gamma_personnel = 2.5  # CBF gain for personnel
        self.t_react = 0.3      # Reaction time [s]
    
    def safe_distance(self, v_ego, obj_class='default'):
        """Speed-dependent safe distance by object class."""
        d_brake = v_ego**2 / (2 * abs(self.a_min))
        d_react = v_ego * self.t_react
        
        margins = {
            'aircraft': 0.5,
            'personnel': 2.0,
            'personnel_crouch': 3.0,
            'gse': 1.0,
            'structure': 0.5,
            'fod': 0.3,
            'default': 1.0,
        }
        d_margin = margins.get(obj_class, 1.0)
        return d_brake + d_react + d_margin
    
    def compute_obstacle_cbf(self, ego_state, obs_pos, obs_vel, obj_class):
        """Compute CBF value and constraint for a single obstacle.
        
        Args:
            ego_state: [px, py, theta, v]
            obs_pos: [ox, oy]
            obs_vel: [ovx, ovy] (obstacle velocity, from tracker)
            obj_class: string classification
            
        Returns:
            h: barrier function value
            Lf_h: Lie derivative along f
            Lg_h: Lie derivative along g (coefficient of control u=a)
            alpha_h: class-K function value
        """
        px, py, theta, v = ego_state
        ox, oy = obs_pos
        ovx, ovy = obs_vel
        
        # Relative position
        dx = px - ox
        dy = py - oy
        dist_sq = dx**2 + dy**2
        
        # Safe distance (speed-dependent)
        d_safe = self.safe_distance(v, obj_class)
        
        # Barrier function: h = ||p_ego - p_obs||^2 - d_safe^2
        h = dist_sq - d_safe**2
        
        # Ego velocity components
        vx = v * np.cos(theta)
        vy = v * np.sin(theta)
        
        # Relative velocity
        dvx = vx - ovx
        dvy = vy - ovy
        
        # h_dot = 2*(dx*dvx + dy*dvy) - 2*d_safe * dd_safe/dv * v_dot
        # dd_safe/dv = v / a_max + t_react
        dd_safe_dv = v / abs(self.a_min) + self.t_react
        
        # Lie derivatives (for acceleration control u = a = v_dot)
        # h_dot = 2*(dx*dvx + dy*dvy) - 2*d_safe*dd_safe_dv*a
        # Note: dx*cos(theta) + dy*sin(theta) projects delta_p onto heading
        
        # For HOCBF relative degree 2, we need h_ddot terms
        # Simplified: use first-order CBF on the "velocity-level" barrier
        # psi_1 = h_dot + alpha_1 * h
        
        h_dot_no_u = 2 * (dx * dvx + dy * dvy)
        
        # Coefficient of u (acceleration) in h_dot via d_safe dependence
        Lg_h = -2 * d_safe * dd_safe_dv
        
        Lf_h = h_dot_no_u
        alpha_h = self.gamma_obs * h
        
        return h, Lf_h, Lg_h, alpha_h
    
    def compute_speed_cbf(self, ego_state, v_max_zone):
        """Speed limit CBF: h = v_max - v.
        
        Returns h, Lf_h, Lg_h, alpha_h.
        """
        v = ego_state[3]
        h = v_max_zone - v
        Lf_h = 0.0       # No drift in v_dot without control
        Lg_h = -1.0       # v_dot = a, so dh/du = -1
        alpha_h = self.gamma_speed * h
        return h, Lf_h, Lg_h, alpha_h
    
    def compute_geofence_cbf(self, ego_state, geofence_polygons):
        """Geofence CBF: h = signed_distance to boundary.
        
        Returns h, Lf_h, Lg_h, alpha_h.
        """
        px, py, theta, v = ego_state
        
        # Compute signed distance and gradient for nearest boundary
        min_sd = float('inf')
        best_grad = np.array([0.0, 0.0])
        
        for poly in geofence_polygons:
            sd, grad = signed_distance_with_gradient(
                np.array([px, py]), poly
            )
            if sd < min_sd:
                min_sd = sd
                best_grad = grad
        
        h = min_sd
        
        # h_dot = grad^T * v_ego = grad_x * v*cos(theta) + grad_y * v*sin(theta)
        # This depends on v but not a directly -- relative degree 2
        # Use velocity-level approximation:
        Lf_h = best_grad[0] * v * np.cos(theta) + best_grad[1] * v * np.sin(theta)
        
        # For braking-only control, Lg_h comes from the chain:
        # h depends on position, position depends on velocity, velocity depends on a
        # Approximate: Lg_h ~ -|grad| * t_decel (time to stop contributes to position change)
        Lg_h = 0.0  # First-order approximation -- use HOCBF for full treatment
        
        alpha_h = self.gamma_geo * h
        return h, Lf_h, Lg_h, alpha_h
    
    def solve_cbf_qp(self, ego_state, u_nom, obstacles, v_max_zone, 
                      geofence_polygons):
        """Solve the CBF-QP to find safe acceleration.
        
        Args:
            ego_state: [px, py, theta, v]
            u_nom: nominal acceleration from upstream planner
            obstacles: list of (pos, vel, class) tuples
            v_max_zone: speed limit in current zone [m/s]
            geofence_polygons: list of boundary polygons
            
        Returns:
            u_safe: safe acceleration [m/s^2]
            feasible: whether QP was feasible without relaxation
            active_constraints: list of active CBF names
        """
        constraints = []
        active = []
        
        # Obstacle CBFs (Priority 1 for personnel, Priority 2 for others)
        for i, (pos, vel, cls) in enumerate(obstacles):
            h, Lf, Lg, ah = self.compute_obstacle_cbf(ego_state, pos, vel, cls)
            # Constraint: Lf + Lg * u >= -ah
            # => Lg * u >= -ah - Lf
            # => u >= (-ah - Lf) / Lg  if Lg > 0
            # => u <= (-ah - Lf) / Lg  if Lg < 0
            if abs(Lg) > 1e-8:
                bound = (-ah - Lf) / Lg
                if Lg < 0:
                    # u <= bound is NOT the form we want; constraint is Lg*u >= -ah-Lf
                    constraints.append({
                        'type': 'ineq',
                        'fun': lambda u, Lg=Lg, Lf=Lf, ah=ah: Lg*u[0] + ah + Lf,
                        'name': f'obs_{cls}_{i}',
                        'priority': 1 if 'personnel' in cls else 2,
                    })
                else:
                    constraints.append({
                        'type': 'ineq',
                        'fun': lambda u, Lg=Lg, Lf=Lf, ah=ah: Lg*u[0] + ah + Lf,
                        'name': f'obs_{cls}_{i}',
                        'priority': 1 if 'personnel' in cls else 2,
                    })
        
        # Speed CBF (Priority 3)
        h_s, Lf_s, Lg_s, ah_s = self.compute_speed_cbf(ego_state, v_max_zone)
        if abs(Lg_s) > 1e-8:
            constraints.append({
                'type': 'ineq',
                'fun': lambda u: Lg_s*u[0] + ah_s + Lf_s,
                'name': 'speed_limit',
                'priority': 3,
            })
        
        # Actuator bounds
        bounds = [(self.a_min, self.a_max)]
        
        # Objective: minimize ||u - u_nom||^2
        def objective(u):
            return 0.5 * (u[0] - u_nom)**2
        
        def objective_jac(u):
            return np.array([u[0] - u_nom])
        
        # Solve
        scipy_constraints = [
            {'type': c['type'], 'fun': c['fun']} for c in constraints
        ]
        
        result = minimize(
            objective, x0=np.array([u_nom]), jac=objective_jac,
            method='SLSQP', bounds=bounds, constraints=scipy_constraints,
            options={'maxiter': 50, 'ftol': 1e-9}
        )
        
        u_safe = np.clip(result.x[0], self.a_min, self.a_max)
        feasible = result.success
        
        # Check which constraints are active
        for c in constraints:
            val = c['fun'](np.array([u_safe]))
            if abs(val) < 1e-4:
                active.append(c['name'])
        
        return u_safe, feasible, active
```

**Note on Production Implementation:** The scipy-based solver above is for prototyping. Production deployment uses OSQP (Section 7.1) for deterministic solve times. The mathematical formulation is identical.

---

## 3. Game-Theoretic Interaction Modeling

### 3.1 Why Game Theory for Airside

Airport airside is inherently a multi-agent environment with complex interactions:

| Scenario | Agents Involved | Interaction Type |
|----------|----------------|------------------|
| Multiple GSE at same stand | 3-8 vehicles (belt loader, catering, fuel, lavatory, cargo) | Shared workspace, sequenced access |
| Pushback coordination | Tug + aircraft + following vehicles | Leader-follower with priority |
| Intersection negotiation | 2-4 vehicles at taxiway crossing | Right-of-way game |
| Personnel avoidance | Vehicle + 1-N ground crew | Asymmetric: vehicle must yield |
| Convoy/platoon | 2-5 baggage tractors | Cooperative formation |
| Gate approach | Arriving vehicle + departing vehicle | Timing game |

Classical planners (including Aurrigo's Frenet planner) treat other agents as **static or constant-velocity obstacles**. This leads to:
- **Frozen robot problem:** Vehicle stops because it predicts collision with an agent that would actually yield
- **Overly aggressive behavior:** Vehicle proceeds because it predicts an agent will stay put, but the agent moves
- **Deadlock:** Two vehicles wait for each other indefinitely at an intersection

Game-theoretic planning resolves these by modeling each agent as a rational (or boundedly rational) decision-maker who responds to others' actions.

### 3.2 GameFormer for Airside: Level-k Reasoning

GameFormer (ICCV 2023, Zhiyu Huang et al., NUS) implements level-k reasoning via a hierarchical transformer decoder. The core idea: each agent iteratively refines its predicted trajectory by responding to others' predictions from the previous level.

**Level-k Reasoning for Airside:**

```
Level 0: Each agent predicts independently based on scene context
  - Fuel truck: drive to fueling point
  - Baggage tractor: follow assigned route
  - Ego AV: follow waypoint path

Level 1: Each agent responds to Level-0 predictions
  - Fuel truck sees ego will arrive first --> slows down
  - Ego sees fuel truck will cross path --> adjusts speed
  
Level 2: Each agent responds to Level-1 predictions  
  - Fuel truck sees ego is adjusting --> maintains speed
  - Ego sees fuel truck is slowing --> maintains speed (resolved)

Level 3: Convergence -- predictions stabilize
```

**Airside Adaptation of GameFormer:**

The original GameFormer was designed for road driving (nuPlan, WOMD). Airside requires:

1. **Non-standard agent types:** Aircraft, various GSE types, personnel on foot -- not just cars and pedestrians
2. **Non-standard map:** Apron layout, stand markings, taxiway lines instead of lanes
3. **Priority rules:** Aircraft always have right of way. Emergency vehicles override all GSE.
4. **Schedule awareness:** Flight schedule provides deterministic constraints on when certain agents will appear

```python
class AirsideGameTheoreticPredictor:
    """Game-theoretic multi-agent prediction for airport airside.
    
    Adapts GameFormer's level-k reasoning to airside scenarios with
    airside-specific agent types, priority rules, and schedule data.
    """
    
    # Agent type hierarchy (higher number = higher priority)
    PRIORITY = {
        'aircraft': 100,        # Always highest priority
        'emergency_vehicle': 90,
        'follow_me_car': 80,
        'fuel_truck': 50,       # Hazardous cargo
        'pushback_tug': 60,     # Connected to aircraft
        'catering_truck': 40,
        'belt_loader': 40,
        'baggage_tractor': 30,
        'ego_av': 35,           # Our autonomous vehicle
        'personnel': 20,        # Unpredictable but low-speed
        'unknown_gse': 25,
    }
    
    def __init__(self, num_levels=3, prediction_horizon=5.0, dt=0.2):
        """
        Args:
            num_levels: Number of game-theoretic reasoning levels (k)
            prediction_horizon: Seconds to predict ahead
            dt: Prediction timestep
        """
        self.K = num_levels
        self.T = prediction_horizon
        self.dt = dt
        self.num_steps = int(prediction_horizon / dt)
    
    def predict(self, ego_state, agent_states, map_context, schedule=None):
        """Run level-k game-theoretic prediction.
        
        Args:
            ego_state: EgoState with pose, velocity, route
            agent_states: List of AgentState with pose, velocity, type, tracked_id
            map_context: Airside map (taxiway graph, stand polygons, markings)
            schedule: Optional flight schedule (gates, ETAs)
        
        Returns:
            predictions: Dict[agent_id -> List[Trajectory]] 
                         (multi-modal predictions per agent)
            ego_plan: Trajectory (ego's planned trajectory at final level)
            interaction_graph: Which agents are interacting
        """
        # Level 0: Independent prediction (no interaction)
        level_0_preds = {}
        for agent in agent_states:
            level_0_preds[agent.id] = self._predict_independent(
                agent, map_context, schedule
            )
        
        ego_level_0 = self._predict_independent(ego_state, map_context, schedule)
        
        # Levels 1 through K: Iterative best-response
        prev_preds = level_0_preds
        prev_ego = ego_level_0
        
        for k in range(1, self.K + 1):
            # Each agent responds to others' level-(k-1) predictions
            curr_preds = {}
            for agent in agent_states:
                others_preds = {
                    aid: pred for aid, pred in prev_preds.items() 
                    if aid != agent.id
                }
                others_preds['ego'] = prev_ego
                
                curr_preds[agent.id] = self._predict_responsive(
                    agent, others_preds, map_context, schedule, level=k
                )
            
            # Ego responds to others' level-(k-1) predictions
            curr_ego = self._predict_responsive(
                ego_state, prev_preds, map_context, schedule, level=k
            )
            
            prev_preds = curr_preds
            prev_ego = curr_ego
        
        # Build interaction graph
        interaction_graph = self._compute_interactions(
            ego_state, agent_states, prev_preds, prev_ego
        )
        
        return prev_preds, prev_ego, interaction_graph
    
    def _predict_independent(self, agent, map_context, schedule):
        """Level-0 prediction: follow route/intent without interaction."""
        if hasattr(agent, 'assigned_route') and agent.assigned_route:
            # Follow assigned route at nominal speed
            return self._follow_route(agent, agent.assigned_route)
        else:
            # Constant velocity + map-constrained
            return self._constant_velocity_map_aware(agent, map_context)
    
    def _predict_responsive(self, agent, others_preds, map_context, 
                             schedule, level):
        """Level-k prediction: respond to others' level-(k-1) behavior."""
        agent_type = getattr(agent, 'agent_type', 'unknown_gse')
        my_priority = self.PRIORITY.get(agent_type, 25)
        
        # Check for potential conflicts with other agents
        conflicts = []
        for other_id, other_traj in others_preds.items():
            conflict = self._check_conflict(agent, other_traj)
            if conflict is not None:
                other_type = conflict['other_type']
                other_priority = self.PRIORITY.get(other_type, 25)
                conflict['priority_diff'] = my_priority - other_priority
                conflicts.append(conflict)
        
        if not conflicts:
            # No conflicts -- maintain independent prediction
            return self._predict_independent(agent, map_context, schedule)
        
        # Resolve conflicts using priority and game theory
        return self._resolve_conflicts(agent, conflicts, map_context)
    
    def _resolve_conflicts(self, agent, conflicts, map_context):
        """Resolve multi-agent conflicts using priority-based game theory."""
        trajectories = []
        
        for conflict in sorted(conflicts, key=lambda c: -abs(c['priority_diff'])):
            if conflict['priority_diff'] < 0:
                # We have lower priority -- yield (Stackelberg follower)
                yield_traj = self._yield_trajectory(
                    agent, conflict, map_context
                )
                trajectories.append(('yield', yield_traj, 0.7))
                
                # Also consider proceeding if gap is large enough
                proceed_traj = self._proceed_trajectory(
                    agent, conflict, map_context
                )
                if proceed_traj is not None:
                    trajectories.append(('proceed', proceed_traj, 0.3))
            
            elif conflict['priority_diff'] > 0:
                # We have higher priority -- proceed (Stackelberg leader)
                proceed_traj = self._proceed_trajectory(
                    agent, conflict, map_context
                )
                trajectories.append(('proceed', proceed_traj, 0.8))
                
                # Defensive option: slow slightly
                cautious_traj = self._cautious_trajectory(
                    agent, conflict, map_context
                )
                trajectories.append(('cautious', cautious_traj, 0.2))
            
            else:
                # Equal priority -- negotiate (Nash)
                negotiate_trajs = self._negotiate_trajectory(
                    agent, conflict, map_context
                )
                trajectories.extend(negotiate_trajs)
        
        return trajectories  # Multi-modal: list of (label, traj, probability)
    
    def _check_conflict(self, agent, other_trajectory):
        """Check if agent's path conflicts with other's predicted trajectory."""
        # Simplified: check if minimum distance < threshold within horizon
        # Production: use swept-volume intersection
        pass  # Implementation depends on trajectory representation
    
    def _yield_trajectory(self, agent, conflict, map_context):
        """Generate trajectory that yields to higher-priority agent."""
        pass
    
    def _proceed_trajectory(self, agent, conflict, map_context):
        """Generate trajectory that proceeds (for higher-priority agent)."""
        pass
    
    def _cautious_trajectory(self, agent, conflict, map_context):
        """Generate cautious proceed trajectory (reduced speed)."""
        pass
    
    def _negotiate_trajectory(self, agent, conflict, map_context):
        """Generate trajectories for equal-priority negotiation."""
        pass
    
    def _compute_interactions(self, ego_state, agent_states, preds, ego_plan):
        """Build interaction graph: which agents are influencing each other."""
        pass
```

### 3.3 Stackelberg Games for Airside

In many airside scenarios, the interaction is inherently **asymmetric**: one agent leads and the other follows. This maps to a Stackelberg game.

**Formal Definition:**

```
Stackelberg Game:
  Leader: agent with higher priority (aircraft, emergency vehicle)
  Follower: agent with lower priority (ego AV)

  Leader chooses u_L to maximize J_L(u_L, u_F*(u_L))
  Follower responds: u_F*(u_L) = argmin_{u_F} J_F(u_L, u_F)

  Key: the leader KNOWS the follower will respond optimally.
  The follower observes the leader's action and best-responds.
```

**Airside Stackelberg Scenarios:**

| Scenario | Leader | Follower | Ego Role |
|----------|--------|----------|----------|
| Aircraft pushback | Pushback tug + aircraft | All GSE | Follower |
| Marshaller directing | Marshaller | Ego AV | Follower |
| Ego approaching stand | Ego AV | Waiting GSE | Leader |
| Fuel truck crossing | Fuel truck (hazmat priority) | Ego AV | Follower |
| Fleet intersection | Higher-ID vehicle | Lower-ID vehicle | Depends on ID |

**Conservative Stackelberg Follower Strategy:**

For safety, the ego AV should almost always act as the **Stackelberg follower** (conservative):

```
Given leader's observed/predicted trajectory tau_L:
  u_ego* = argmin ||tau_ego - tau_nominal||^2
  subject to:
    d(tau_ego(t), tau_L(t)) >= d_safe   for all t in [0, T]
    kinematic constraints (v, a, delta limits)
    geofence constraints

This is a constrained trajectory optimization that can be solved
as a convex program when linearized around the nominal trajectory.
```

### 3.4 Nash Equilibrium for Multi-AV Fleet Coordination

When Aurrigo deploys multiple AVs on the same apron (the target scenario), fleet coordination requires a multi-agent planning solution. If all vehicles use the same priority-based system, equal-priority encounters require Nash equilibrium.

**Fleet Intersection Protocol:**

```
Given N ego AVs approaching an intersection:

1. Each AV broadcasts its intended trajectory and priority
2. Priority assignment:
   - Task urgency (time-critical turnaround phase > routine transfer)
   - Distance to intersection (closer = higher priority, avoids deadlock)
   - Deterministic tiebreaker (vehicle ID)

3. Decentralized Nash: each vehicle optimizes its trajectory given
   others' communicated intentions, iterating until convergence
   or timeout (max 3 iterations, <50ms total)

4. If no convergence: fall back to deterministic priority (vehicle ID)
```

**Potential Game Formulation for Fleet:**

Fleet coordination on a graph (taxiway network) can be formulated as a **potential game** where all agents implicitly optimize a shared potential:

```
Phi(u_1, ..., u_N) = sum_i J_i(u_i) + sum_{i<j} Interaction(u_i, u_j)

where:
  J_i(u_i) = path cost for vehicle i (time + energy)
  Interaction(u_i, u_j) = penalty for proximity between vehicles i and j

A Nash equilibrium of this potential game is a local minimum of Phi.
Since Phi is a single function, standard optimization can find it.
```

### 3.5 Integrating Game Theory with CBF

The game-theoretic predictor provides **predicted trajectories for other agents**. These predictions feed directly into the CBF:

```
Pipeline:
  Perception --> Tracked agents (positions, velocities, types)
       |
       v
  Game-Theoretic Predictor --> Predicted trajectories (multi-modal)
       |
       v
  CBF Construction --> Dynamic obstacle CBFs using predicted positions
       |
       v
  CBF-QP Solver --> Safe control input
```

**Using Prediction Uncertainty in CBF:**

The game-theoretic predictor outputs multi-modal predictions with probabilities. The CBF should be conservative:

```
For each predicted mode m with probability p_m and trajectory tau_m:
  If p_m > p_threshold (e.g., 0.1):
    Add CBF constraint for tau_m with margin scaled by (1 - p_m)
    (lower probability modes get larger safety margins because they
     represent more uncertain scenarios)

Alternatively: use the worst-case (most conflicting) mode for CBF,
ensuring safety even if the agent takes the most adversarial action.
```

---

## 4. CBF + Neural Planner Integration

### 4.1 CBF as Safety Filter on Neural Planner Output

The primary use case: a neural planner (SparseDrive, DiffusionDrive, PlanTF, or future airside-trained model) generates a trajectory, and the CBF filter minimally modifies it to ensure safety.

**Architecture:**

```
Perception ──> Neural Planner ──> Proposed Trajectory (10 Hz)
                                        │
                                        ▼
                                  CBF Safety Filter (100 Hz)
                                  ┌─────────────────────┐
                                  │ For each control     │
                                  │ step along proposed  │
                                  │ trajectory:          │
                                  │                      │
                                  │ u_safe = CBF-QP(     │
                                  │   ego_state,         │
                                  │   u_proposed,        │
                                  │   obstacles,         │
                                  │   geofences,         │
                                  │   speed_limits       │
                                  │ )                    │
                                  └──────────┬──────────┘
                                             │
                                             ▼
                                      Safe Trajectory ──> Actuators
```

**Key Design Decision: Filter at Control Rate, Not Planning Rate**

The neural planner runs at 10 Hz (100 ms cycle). The CBF filter runs at **100 Hz** (10 ms cycle), re-evaluating safety between planning updates. This is critical because:

1. The world changes between planning cycles (agents move, new detections appear)
2. The CBF can react to sudden threats faster than the planner can replan
3. The CBF ensures safety even if the planner is delayed or fails

**Interpolation Between Planning Updates:**

```python
class CBFFilteredController:
    """Runs CBF safety filter at 100 Hz on neural planner output."""
    
    def __init__(self, cbf_filter, planning_rate=10.0, control_rate=100.0):
        self.cbf = cbf_filter
        self.plan_dt = 1.0 / planning_rate
        self.ctrl_dt = 1.0 / control_rate
        self.current_plan = None
        self.plan_timestamp = 0.0
    
    def on_new_plan(self, trajectory, timestamp):
        """Called at 10 Hz when neural planner produces new trajectory."""
        self.current_plan = trajectory
        self.plan_timestamp = timestamp
    
    def control_step(self, ego_state, obstacles, geofences, speed_limits, t):
        """Called at 100 Hz. Returns safe control command."""
        if self.current_plan is None:
            # No plan available -- emergency stop
            return self.cbf.a_min  # Maximum braking
        
        # Interpolate nominal control from planned trajectory
        t_in_plan = t - self.plan_timestamp
        u_nom = self.current_plan.interpolate_control(t_in_plan)
        
        # Apply CBF safety filter
        u_safe, feasible, active = self.cbf.solve_cbf_qp(
            ego_state, u_nom, obstacles, 
            speed_limits.get_limit(ego_state[:2]),
            geofences
        )
        
        if not feasible:
            # CBF-QP infeasible -- trigger Simplex switch
            self.trigger_simplex_switch(reason='cbf_infeasible')
            return self.cbf.a_min  # Emergency braking while switching
        
        return u_safe
```

### 4.2 CBF-QP on NVIDIA Orin: Timing Analysis

The NVIDIA Jetson Orin AGX (275 TOPS) is Aurrigo's deployment platform. The CBF-QP must solve within the 10 ms control budget.

**QP Complexity:**

```
Variables: 1-2 (acceleration, optionally steering rate)
Constraints: N_obstacles + N_geofences + N_speed_zones + 2 (actuator bounds)
             Typical: 5-20 constraints

For a QP with 2 variables and 20 constraints:
  OSQP: 50-200 us (CPU, single core)
  qpOASES: 30-150 us (CPU, single core)
  Custom active-set: 20-100 us (CPU, single core)
  
Total CBF compute (including Lie derivative computation): 200-500 us
Well within the 10 ms budget (2-5% of available time)
```

**Comparison: CBF solve time vs other planning components:**

| Component | Typical Latency | Hardware |
|-----------|----------------|----------|
| CBF-QP solve | 0.05-0.5 ms | CPU (single core) |
| Neural planner inference | 20-50 ms | GPU (TensorRT) |
| Frenet candidate evaluation | 3-8 ms | CPU (multi-core) |
| Perception pipeline | 30-80 ms | GPU |
| Game-theoretic prediction | 10-30 ms | GPU (GameFormer) |

The CBF-QP is negligible in the compute budget. It can run on a dedicated CPU core without impacting other components.

### 4.3 CBF Filter vs Simplex Switching

CBF filtering and Simplex switching are **complementary**, not competing, approaches.

| Property | CBF Safety Filter | Simplex Switching |
|----------|------------------|-------------------|
| What it does | Minimally modifies control input | Switches entire planner |
| Intervention granularity | Continuous (small corrections) | Binary (all or nothing) |
| Provable safety | Yes (if CBF is valid) | Yes (if BC is verified) |
| Impact on performance | Minimal (closest safe input) | Significant (conservative BC) |
| Recovery | Automatic (returns to nominal when safe) | Requires explicit switch-back logic |
| Handles model uncertainty | Via robust CBF formulations | Via conservative BC design |
| Handles planner failure | No (needs valid nominal input) | Yes (BC is independent) |
| Handles sensor failure | No (needs obstacle estimates) | Partially (BC can use degraded mode) |

**Complementary Architecture:**

```
Neural planner provides trajectory
  │
  ├── CBF filter: makes small continuous corrections (99% of the time)
  │   This handles: approaching obstacles, speed zones, geofences
  │
  └── Simplex monitor: switches to BC if CBF becomes infeasible or
      planner fails completely
      This handles: planner crash, gross localization error, 
                    perception blackout, unknown scenarios
```

### 4.4 SafeDreamer: CBF-Constrained World Model Planning

SafeDreamer (ICLR 2024) integrates safety constraints into world model dreaming via Lagrangian optimization. The connection to CBF:

**SafeDreamer + CBF Hybrid:**

```
World Model (DreamerV3 backbone)
  │
  ├── Imagined rollouts: predict future states
  │
  ├── Reward estimation: R(s,a) -- progress, comfort
  │
  ├── Cost estimation: C(s,a) -- safety violations
  │   This is effectively a learned CBF: C(s,a) < 0 means unsafe
  │
  └── Lagrangian optimization:
      max_pi E[sum R] - lambda * max(0, E[sum C] - threshold)
      
      The Lagrange multiplier lambda adaptively balances performance
      and safety, similar to how gamma in CBF controls aggressiveness.
```

**Advantage over pure CBF:** SafeDreamer can reason about safety constraints over a **planning horizon** (5-10 seconds ahead), while instantaneous CBF only considers the current timestep. This means SafeDreamer can preemptively avoid situations where the CBF would require aggressive intervention.

**Practical combination:**
1. SafeDreamer generates a trajectory that is "probably safe" based on learned cost model
2. CBF filter provides a hard safety guarantee on the executed trajectory
3. If SafeDreamer's trajectory requires significant CBF correction, this feeds back as high cost in the next planning cycle

### 4.5 DiffusionDrive + CBF: Filtering Diffusion Samples

DiffusionDrive (documented in `30-autonomy-stack/planning/diffusion-trajectory-planning.md`) generates trajectory samples via truncated diffusion (5 steps, 45 ms on Orin). CBF integration can happen at two levels:

**Level 1: Post-Hoc CBF Filtering (Simple)**

```
DiffusionDrive generates K trajectory samples
  │
  ├── For each sample, evaluate CBF feasibility:
  │   Is there a CBF-safe control sequence that tracks this trajectory?
  │
  ├── Reject infeasible samples
  │
  ├── Among feasible samples, select best by DiffusionDrive's own score
  │
  └── Apply CBF filter during execution for continuous safety
```

**Level 2: CBF-Guided Diffusion (Advanced)**

```
During the denoising process, inject CBF gradient as guidance:

At each diffusion step t:
  x_t = standard denoising update
  
  # CBF guidance: push samples away from unsafe regions
  grad_h = gradient of barrier function w.r.t. trajectory
  x_t = x_t + eta * grad_h   (where eta is guidance strength)

This is analogous to Diffusion-Planner's classifier guidance but
using the CBF as the classifier. The diffusion model naturally
generates safe trajectories without post-hoc filtering.
```

---

## 5. Multi-Agent CBF for Fleet Coordination

### 5.1 Decentralized CBF

When Aurrigo deploys multiple AVs, each vehicle maintains barrier functions with respect to all other vehicles in communication range.

**Pairwise CBF:**

```
For vehicles i and j:
  h_ij(x_i, x_j) = ||p_i - p_j||^2 - d_safe_vehicle^2

Each vehicle i enforces:
  L_f_i h_ij + L_g_i h_ij * u_i >= -alpha(h_ij)

Note: vehicle i can only control u_i (its own input).
The constraint is one-sided: vehicle i ensures safety assuming
vehicle j does nothing helpful.
```

**Problem with Decentralized CBF:** Each vehicle independently tries to maintain safety. This is **doubly conservative** -- if both vehicles brake to avoid each other, they brake twice as hard as needed.

**Solution: Responsibility Sharing**

```
Split the CBF constraint equally:
  Vehicle i: L_f_i h_ij + L_g_i h_ij * u_i >= -(alpha(h_ij)) / 2
  Vehicle j: L_f_j h_ij + L_g_j h_ij * u_j >= -(alpha(h_ij)) / 2

Each vehicle is responsible for half the safety margin.
If both comply, the full constraint is satisfied.
If one vehicle fails, the other still provides half the margin.
```

### 5.2 Communication-Aware CBF

With V2V communication (which Aurrigo's fleet will have via airport 5G/CBRS), the CBF can be relaxed based on communicated intent.

```
Without communication (worst case):
  h_ij(x_i, x_j) = ||p_i - p_j||^2 - d_safe_worst^2
  d_safe_worst includes worst-case acceleration of vehicle j

With communication (shared intent):
  Vehicle j communicates its planned trajectory tau_j
  h_ij(x_i, tau_j) = min_t ||p_i - tau_j(t)|| - d_safe_comm^2
  d_safe_comm < d_safe_worst (tighter, because we know j's intent)
  
With communication + acknowledgment (cooperative):
  Both vehicles agree on who yields
  Only the yielding vehicle enforces the full CBF constraint
  The proceeding vehicle enforces a relaxed constraint
```

**Communication Failure Fallback:**

```
If V2V heartbeat lost (>200 ms timeout):
  Immediately switch to worst-case CBF (no communication assumption)
  This is seamless -- just a parameter change in the QP
```

### 5.3 Priority-Based CBF for Right-of-Way

```python
class MultiAgentCBF:
    """Decentralized multi-agent CBF for Aurrigo fleet coordination.
    
    Each vehicle runs this locally, using communicated state from other
    fleet vehicles and tracked state from non-fleet agents.
    """
    
    def __init__(self, ego_id, params, comm_interface):
        self.ego_id = ego_id
        self.cbf_filter = AirsideCBFFilter(params)
        self.comm = comm_interface
        self.fleet_states = {}      # vehicle_id -> (state, trajectory, timestamp)
        self.d_safe_fleet = 3.0     # Base inter-vehicle distance [m]
        self.d_safe_external = 5.0  # Distance to non-fleet agents [m]
        self.responsibility_share = 0.5  # Each vehicle handles half
    
    def update_fleet_state(self, vehicle_id, state, planned_trajectory):
        """Called when V2V message received from fleet vehicle."""
        self.fleet_states[vehicle_id] = {
            'state': state,
            'trajectory': planned_trajectory,
            'timestamp': time.time(),
            'comm_alive': True,
        }
    
    def check_comm_health(self):
        """Mark vehicles with stale communication."""
        now = time.time()
        for vid, info in self.fleet_states.items():
            if now - info['timestamp'] > 0.2:  # 200 ms timeout
                info['comm_alive'] = False
    
    def compute_fleet_cbf_constraints(self, ego_state):
        """Compute CBF constraints for all fleet vehicles.
        
        Returns list of (Lf_h, Lg_h, alpha_h, priority, name) tuples.
        """
        self.check_comm_health()
        constraints = []
        
        for vid, info in self.fleet_states.items():
            other_state = info['state']
            other_traj = info['trajectory']
            comm_ok = info['comm_alive']
            
            # Determine priority
            ego_priority = self._get_priority(self.ego_id)
            other_priority = self._get_priority(vid)
            
            # Safe distance depends on communication status
            if comm_ok and other_traj is not None:
                # Use communicated trajectory
                d_safe = self.d_safe_fleet
                other_predicted = other_traj.position_at(0)  # Current
            else:
                # Communication lost -- use worst-case
                d_safe = self.d_safe_fleet * 1.5
                other_predicted = other_state[:2]  # Just position
            
            # Compute pairwise CBF
            dx = ego_state[0] - other_predicted[0]
            dy = ego_state[1] - other_predicted[1]
            dist_sq = dx**2 + dy**2
            h = dist_sq - d_safe**2
            
            # Lie derivatives (acceleration control only)
            v = ego_state[3]
            theta = ego_state[2]
            
            Lf_h = 2 * (dx * v * np.cos(theta) + dy * v * np.sin(theta))
            Lg_h = 0  # h_dot doesn't contain a directly; need HOCBF
            
            # For HOCBF relative degree 2, use the velocity-level formulation:
            # psi_1 = h_dot + alpha_1 * h, then constrain psi_1_dot + alpha_2*psi_1 >= 0
            alpha_1 = 1.0
            psi_1 = Lf_h + alpha_1 * h
            
            # psi_1_dot terms involving u = a:
            heading_component = dx * np.cos(theta) + dy * np.sin(theta)
            Lg_psi1 = 2 * heading_component  # d(Lf_h)/da
            Lf_psi1 = 2 * v**2  # Kinetic term (always positive when moving)
            
            alpha_2 = 1.0
            alpha_psi1 = alpha_2 * psi_1
            
            # Responsibility sharing
            if ego_priority < other_priority:
                # We yield -- take full responsibility
                share = 1.0
            elif ego_priority > other_priority:
                # They yield -- we take reduced responsibility
                share = 0.3
            else:
                # Equal priority -- share equally
                share = self.responsibility_share
            
            constraints.append({
                'Lf': Lf_psi1 * share,
                'Lg': Lg_psi1 * share,
                'alpha': alpha_psi1 * share,
                'priority': 1 if not comm_ok else 2,
                'name': f'fleet_{vid}',
                'h_value': h,
            })
        
        return constraints
    
    def solve_fleet_safe_control(self, ego_state, u_nom, external_obstacles,
                                  v_max_zone, geofences):
        """Solve CBF-QP with both fleet and external obstacle constraints.
        
        Args:
            ego_state: [px, py, theta, v]
            u_nom: Nominal acceleration from planner
            external_obstacles: Non-fleet obstacles (aircraft, personnel, etc.)
            v_max_zone: Speed limit [m/s]
            geofences: Geofence polygons
        
        Returns:
            u_safe: Safe acceleration
            feasible: QP feasibility
            active: Active constraints
        """
        # Get fleet CBF constraints
        fleet_constraints = self.compute_fleet_cbf_constraints(ego_state)
        
        # Get external CBF constraints (from base class)
        u_safe, feasible, active = self.cbf_filter.solve_cbf_qp(
            ego_state, u_nom, external_obstacles, v_max_zone, geofences,
            extra_constraints=fleet_constraints
        )
        
        # Broadcast our state and plan to fleet
        self.comm.broadcast(self.ego_id, ego_state, u_safe)
        
        return u_safe, feasible, active
    
    def _get_priority(self, vehicle_id):
        """Get vehicle priority based on task and ID."""
        # In production: query from fleet dispatch system
        # Factors: task urgency, distance to destination, vehicle ID (tiebreaker)
        return hash(vehicle_id) % 100  # Placeholder
```

### 5.4 Deadlock Resolution

Deadlocks occur when two or more vehicles block each other's paths -- common at narrow apron intersections.

**Detection:**

```
Deadlock detected when:
  - Vehicle has been stopped (v < 0.1 m/s) for > T_deadlock seconds (e.g., 5s)
  - AND the CBF constraint is active for another fleet vehicle
  - AND that other vehicle is also stopped with active CBF on us
```

**Resolution Strategies:**

1. **Deterministic Priority:** If deadlock detected, vehicle with lower ID backs up. Simple and guaranteed to resolve.

2. **Potential Function Escape:** Add a repulsive potential to the cost function that pushes vehicles away from the deadlock configuration:

```
V_escape(x) = -K_escape * sum_j 1 / ||p_i - p_j||

This creates a gradient that pushes vehicles apart.
Integrate V_escape into the CBF-QP as a soft cost term.
```

3. **Centralized Resolution:** If V2V communication is available, a fleet-level coordinator can assign a resolution sequence (e.g., "vehicle A proceeds, vehicle B waits, then vehicle B proceeds").

---

## 6. Formal Verification and Safety Proofs

### 6.1 What CBF Proves

Given a valid CBF h(x) for the system x_dot = f(x) + g(x)u, the CBF-QP controller provides the following guarantee:

**Theorem (Safety):** If:
1. h(x) is a valid CBF for the system on C = {x : h(x) >= 0}
2. The CBF-QP is feasible at all states x in C
3. The dynamics model f(x), g(x) exactly represents the true system
4. State measurement x is exact
5. Control u is applied instantaneously (no delay)

Then: if x(0) in C (initial state is safe), then x(t) in C for all t >= 0 (the system remains safe forever).

**This is a strong guarantee.** It means collision avoidance, geofence compliance, and speed limit adherence are mathematically proven -- not just tested or statistically validated.

### 6.2 What Assumptions Break on Airside

In practice, assumptions 2-5 are violated to varying degrees:

| Assumption | Violation on Airside | Severity | Mitigation |
|-----------|---------------------|----------|------------|
| QP always feasible | Vehicle too close to obstacle at speed | Medium | Input-constrained CBF (Section 1.6), E-stop |
| Perfect dynamics model | Tire slip, load variation, actuator delay | Low-Medium | Robust CBF (Section 6.3) |
| Exact state measurement | GPS/IMU noise, perception latency | Medium | ISSf-CBF (Section 6.4) |
| Zero control delay | Actuator latency (50-200 ms hydraulic) | High | Delay-compensated CBF |
| Cooperative agents | Human-driven GSE may not yield | Medium | Worst-case CBF margins |

### 6.3 Robust CBF (rCBF)

When the dynamics model has bounded uncertainty:

```
True dynamics: x_dot = f(x) + g(x)u + d(x, t)
where ||d(x, t)|| <= d_max   (bounded disturbance)

Robust CBF condition:
  L_f h(x) + L_g h(x) * u >= -alpha(h(x)) + ||dh/dx|| * d_max

The additional term ||dh/dx|| * d_max ensures safety even under
worst-case disturbance. This makes the CBF more conservative
(larger safety margins) but provably safe under model uncertainty.
```

**For the ADT3 bicycle model:**
- Tire slip disturbance: d_max ~ 0.1 m/s at low speed
- Actuator delay: modeled as first-order lag, adds ~0.2 m effective distance
- Combined: rCBF adds approximately 0.5-1.0 m to all safe distances

### 6.4 Input-to-State Safe CBF (ISSf-CBF)

ISSf-CBF handles state measurement noise, which is critical when CBF relies on perception (obstacle positions, velocities).

```
True state: x_true = x_measured + e
where ||e|| <= e_max   (bounded measurement error)

ISSf-CBF condition:
  L_f h(x_meas) + L_g h(x_meas) * u >= -alpha(h(x_meas)) + sigma(||e||_max)

where sigma is a class-K function that provides robustness to measurement error.

For obstacle avoidance:
  e_max includes:
  - Ego localization error: ~0.1 m (RTK-GPS + IMU)
  - Obstacle position error: ~0.3 m (LiDAR detection + tracking)
  - Obstacle velocity error: ~0.5 m/s (Kalman filter estimate)
  
  Combined: ISSf adds ~0.5-1.5 m to safe distances depending on
  obstacle velocity and relative geometry.
```

### 6.5 Delay-Compensated CBF

Actuator delay is the most significant practical challenge for CBF on Aurrigo vehicles. The hydraulic steering/braking system has 50-200 ms delay.

**Predictor-Based CBF:**

```
1. Measure current state x(t)
2. Predict state at time of actuation: x_pred = simulate(x(t), delay)
3. Solve CBF-QP at x_pred instead of x(t)

This accounts for the delay by computing the safe control for the
state the vehicle will be in when the control actually takes effect.

For constant delay tau = 0.1s:
  x_pred = x + f(x)*tau + g(x)*u_prev*tau
  
Solve CBF-QP at x_pred:
  L_f h(x_pred) + L_g h(x_pred) * u >= -alpha(h(x_pred))
```

### 6.6 Verification Tools

**Offline Verification (Pre-Deployment):**

| Tool | Type | Use Case | License |
|------|------|----------|---------|
| dReal | SMT solver | Verify CBF validity for polynomial barriers | Apache 2.0 |
| Flow* | Reachability | Compute reachable sets under CBF control | Academic |
| SOSTOOLS | SOS programming | Synthesize polynomial CBFs with guarantees | BSD |
| Barrier certificate synthesis | Optimization | Find valid CBF for given dynamics | Various |
| CORA | Reachability | MATLAB-based reachability analysis | GPL |
| JuliaReach | Reachability | Julia-based, scalable | MIT |

**dReal Example: Verifying Obstacle Avoidance CBF**

```smt2
; Verify: for all states in safe set, CBF constraint is satisfiable
(set-logic QF_NRA_ODE)
(declare-fun px () Real)
(declare-fun py () Real)
(declare-fun theta () Real)
(declare-fun v () Real)
(declare-fun a () Real)  ; control input

; ADT3 parameters
(define-fun L () Real 3.15)
(define-fun a_min () Real -2.0)
(define-fun a_max () Real 1.0)

; Obstacle at (10, 0)
(define-fun ox () Real 10.0)
(define-fun oy () Real 0.0)
(define-fun d_safe () Real 5.0)

; Barrier function
(define-fun h () Real (- (+ (* (- px ox) (- px ox)) (* (- py oy) (- py oy))) 
                         (* d_safe d_safe)))

; State constraints (safe set + operating range)
(assert (>= h 0))           ; In safe set
(assert (>= v 0))           ; Moving forward
(assert (<= v 6.67))        ; Max speed

; Control constraints
(assert (>= a a_min))
(assert (<= a a_max))

; Negate the CBF condition (looking for counterexample)
; If UNSAT: CBF is valid (no state where constraint is unsatisfiable)
(assert (< (+ (* 2 (+ (* (- px ox) (* v (cos theta)))
                      (* (- py oy) (* v (sin theta)))))
              (* 2.0 h))   ; -alpha(h) with alpha(h) = 2*h
           0))

(check-sat)
```

### 6.7 Connection to ISO 3691-4 and SOTIF

**ISO 3691-4:2023** requires Performance Level d (PLd) for personnel detection and braking. CBF directly addresses this by providing:

1. **Deterministic braking guarantee:** The CBF constraint ensures braking is always initiated with sufficient margin. This is a stronger guarantee than probabilistic testing.

2. **Quantified safe distances:** The CBF parameters (d_safe, gamma, t_react) can be directly mapped to the required safe distance tables in ISO 3691-4 Annex C.

3. **Compositional safety argument:** Each CBF constraint addresses a specific hazard. The composition via QP ensures all hazards are addressed simultaneously. This maps to the systematic hazard analysis required by the standard.

**SOTIF (ISO 21448)** addresses safety of the intended functionality -- what happens when perception or planning makes mistakes. CBF + SOTIF integration:

```
SOTIF Triggering Conditions → CBF Response:
  
  Perception failure (missed obstacle):
  → CBF cannot help (no obstacle in its model)
  → Mitigation: redundant perception, conservative default CBF margins
  
  Perception degradation (noisy obstacle position):
  → ISSf-CBF handles bounded measurement noise
  → Mitigation: increase CBF margins in degraded perception mode
  
  Planning failure (neural planner produces unsafe trajectory):
  → CBF filter corrects the unsafe trajectory
  → This IS the primary SOTIF mitigation for planning
  
  Unexpected agent behavior:
  → Robust CBF with worst-case agent assumption
  → Game-theoretic prediction reduces conservatism
```

---

## 7. Practical Implementation

### 7.1 CBF-QP Solver Options

| Solver | Language | License | Solve Time (2 vars, 20 constraints) | Embedded Friendly | Notes |
|--------|----------|---------|--------------------------------------|-------------------|-------|
| OSQP | C (with Python/C++ wrappers) | Apache 2.0 | 50-200 us | Yes | Best general-purpose choice. Code-generated for real-time |
| qpOASES | C++ | LGPL 2.1 | 30-150 us | Yes | Active-set method, warm-starting, used in MPC |
| ECOS | C | GPL 3.0 | 100-500 us | Yes | Conic solver, handles SOCPs too |
| cvxpy | Python | Apache 2.0 | 1-5 ms | No | Prototyping only. Overhead from parsing |
| Custom active-set | C/C++ | N/A | 20-100 us | Yes | Fastest, but development effort |
| Clarabel | Rust/C | Apache 2.0 | 50-300 us | Yes | Modern interior-point, well-maintained |

**Recommendation for Aurrigo:**
- **Prototyping:** cvxpy with OSQP backend (Python, fast iteration)
- **ROS integration:** OSQP C library called from C++ nodelet
- **Production:** qpOASES or custom active-set solver for deterministic timing

**OSQP Integration Code (C++):**

```cpp
#include <osqp/osqp.h>

class CBFQPSolver {
public:
    /**
     * Solve CBF-QP: min 0.5 * ||u - u_nom||^2
     *               s.t. A * u >= b  (CBF constraints)
     *                    u_min <= u <= u_max
     * 
     * @param u_nom Nominal control input [a, delta_dot] or just [a]
     * @param A     CBF constraint matrix (N_constraints x N_controls)
     * @param b     CBF constraint bounds (N_constraints)
     * @param u_min Lower actuator bound
     * @param u_max Upper actuator bound
     * @return Safe control input u*
     */
    Eigen::VectorXd solve(
        const Eigen::VectorXd& u_nom,
        const Eigen::MatrixXd& A_cbf,
        const Eigen::VectorXd& b_cbf,
        const Eigen::VectorXd& u_min,
        const Eigen::VectorXd& u_max
    ) {
        int n = u_nom.size();     // Number of control variables
        int m = A_cbf.rows() + n; // CBF constraints + box constraints
        
        // OSQP problem formulation:
        // min 0.5 * x^T P x + q^T x
        // s.t. l <= Ax <= u
        
        // P = I (identity -- minimize ||u - u_nom||^2)
        // q = -u_nom
        // A = [A_cbf; I]
        // l = [b_cbf; u_min]
        // u = [inf; u_max]
        
        // Setup OSQP workspace
        OSQPSettings settings;
        osqp_set_default_settings(&settings);
        settings.eps_abs = 1e-6;
        settings.eps_rel = 1e-6;
        settings.max_iter = 100;    // Enough for small QPs
        settings.verbose = false;
        settings.warm_starting = true;  // Exploit temporal coherence
        
        // [OSQP setup and solve -- omitted for brevity]
        // See OSQP documentation for full CSC matrix construction
        
        OSQPWorkspace* work;
        // osqp_setup(&work, P_csc, q, A_csc, l, u, m, n, &settings);
        // osqp_solve(work);
        // Extract: work->solution->x
        
        Eigen::VectorXd u_safe(n);
        // u_safe = Eigen::Map<...>(work->solution->x, n);
        
        // osqp_cleanup(work);
        return u_safe;
    }
};
```

### 7.2 ROS Integration Architecture

The CBF safety filter integrates as a ROS node between the planner and the vehicle interface.

```
ROS Node Graph:
                                                              
  /perception/tracked_objects ──┐                              
  /localization/ego_state ──────┤                              
  /map_server/geofences ────────┤                              
  /planner/trajectory ──────────┤       ┌──────────────────┐   
                                ├──────>│  /cbf_safety_     │   
  /fleet_comm/vehicle_states ───┤       │   filter_node     │   
  /airport/speed_zones ─────────┤       │                   │   
  /airport/active_engines ──────┘       │  Rate: 100 Hz     │   
                                        │  Priority: RT     │   
                                        └────────┬─────────┘   
                                                 │              
                                    /cbf/safe_command           
                                                 │              
                                        ┌────────v─────────┐   
                                        │  /vehicle_        │   
                                        │   interface_node  │   
                                        │  (CAN gateway)    │   
                                        └──────────────────┘   
                                                              
  Diagnostic topics:                                          
  /cbf/diagnostics          -- feasibility, active constraints
  /cbf/barrier_values       -- current h(x) for all CBFs     
  /cbf/safe_set_margin      -- min h(x) across all constraints
```

**ROS Node Implementation (C++ Nodelet):**

```cpp
#include <ros/ros.h>
#include <nodelet/nodelet.h>
#include <nav_msgs/Odometry.h>
#include <geometry_msgs/TwistStamped.h>

namespace aurrigo_safety {

class CBFSafetyFilterNodelet : public nodelet::Nodelet {
public:
    void onInit() override {
        nh_ = getNodeHandle();
        pnh_ = getPrivateNodeHandle();
        
        // Parameters
        pnh_.param("control_rate", control_rate_, 100.0);
        pnh_.param("gamma_obstacle", gamma_obs_, 2.0);
        pnh_.param("gamma_personnel", gamma_pers_, 2.5);
        pnh_.param("gamma_geofence", gamma_geo_, 3.0);
        pnh_.param("reaction_time", t_react_, 0.3);
        
        // Initialize CBF solver
        solver_ = std::make_unique<CBFQPSolver>();
        
        // Subscribers
        ego_sub_ = nh_.subscribe("/localization/ego_state", 1,
            &CBFSafetyFilterNodelet::egoCallback, this);
        obstacles_sub_ = nh_.subscribe("/perception/tracked_objects", 1,
            &CBFSafetyFilterNodelet::obstaclesCallback, this);
        plan_sub_ = nh_.subscribe("/planner/trajectory", 1,
            &CBFSafetyFilterNodelet::planCallback, this);
        
        // Publisher
        safe_cmd_pub_ = nh_.advertise<geometry_msgs::TwistStamped>(
            "/cbf/safe_command", 1);
        diag_pub_ = nh_.advertise<diagnostic_msgs::DiagnosticArray>(
            "/cbf/diagnostics", 1);
        
        // Timer at control rate
        timer_ = nh_.createTimer(
            ros::Duration(1.0 / control_rate_),
            &CBFSafetyFilterNodelet::controlLoop, this);
        
        NODELET_INFO("CBF Safety Filter initialized at %.0f Hz", control_rate_);
    }

private:
    void controlLoop(const ros::TimerEvent& event) {
        if (!ego_state_valid_ || !plan_valid_) {
            // No valid data -- emergency stop
            publishEmergencyStop();
            return;
        }
        
        auto start = ros::WallTime::now();
        
        // Get nominal control from current plan
        double u_nom = interpolatePlan(ros::Time::now());
        
        // Build CBF constraints
        auto [A, b] = buildCBFConstraints();
        
        // Solve QP
        Eigen::VectorXd u_safe = solver_->solve(
            Eigen::VectorXd::Constant(1, u_nom),
            A, b,
            Eigen::VectorXd::Constant(1, -2.0),  // a_min
            Eigen::VectorXd::Constant(1, 1.0)     // a_max
        );
        
        auto elapsed = (ros::WallTime::now() - start).toSec() * 1000.0;
        
        // Publish safe command
        geometry_msgs::TwistStamped cmd;
        cmd.header.stamp = ros::Time::now();
        cmd.twist.linear.x = u_safe(0);  // Safe acceleration
        safe_cmd_pub_.publish(cmd);
        
        // Diagnostics
        publishDiagnostics(u_nom, u_safe(0), elapsed);
    }
    
    // ... callback implementations, constraint building, etc.
    
    ros::NodeHandle nh_, pnh_;
    double control_rate_;
    double gamma_obs_, gamma_pers_, gamma_geo_, t_react_;
    std::unique_ptr<CBFQPSolver> solver_;
    ros::Subscriber ego_sub_, obstacles_sub_, plan_sub_;
    ros::Publisher safe_cmd_pub_, diag_pub_;
    ros::Timer timer_;
    bool ego_state_valid_ = false, plan_valid_ = false;
};

} // namespace aurrigo_safety

#include <pluginlib/class_list_macros.h>
PLUGINLIB_EXPORT_CLASS(aurrigo_safety::CBFSafetyFilterNodelet, nodelet::Nodelet)
```

### 7.3 Latency Budget

```
CBF Safety Filter Timing Budget (per 100 Hz cycle = 10 ms):

Component                          Time (us)    Notes
─────────────────────────────────────────────────────────────
State interpolation                 5-20        Ego state at current time
Obstacle transform                 10-50        Transform to ego frame, N obstacles
Lie derivative computation         20-100       For all N CBF constraints
QP matrix construction             10-30        Build A, b, P, q for OSQP
QP solve (OSQP)                    50-200       Warm-started, 20 constraints
Safe command computation            5-10        Apply result, clip to limits
Diagnostic publishing              10-30        Optional, can be throttled
─────────────────────────────────────────────────────────────
Total                             110-440       Well within 10 ms budget

Worst case with 50 obstacles:     300-800       Still within budget
```

### 7.4 Airside-Specific Tuning

**Speed Regime:** Airside vehicles operate at 5-25 km/h (1.4-6.9 m/s). This is much slower than road driving, which affects CBF tuning:

| Parameter | Road Driving (50-120 km/h) | Airside (5-25 km/h) | Implication |
|-----------|---------------------------|---------------------|-------------|
| CBF gamma | 1.0-5.0 | 1.5-3.0 | Lower gamma OK due to lower speeds |
| Safe distance | 5-100 m | 2-15 m | Much shorter, more precise control needed |
| Reaction time | 0.5-1.0 s | 0.2-0.4 s | Shorter for slower, more predictable ops |
| Update rate | 10-50 Hz | 50-100 Hz | Higher rate because closer to obstacles |
| QP variables | 2 (accel + steer) | 1 (accel) or 2 | Steering less urgent at low speed |

**Heavy Vehicle Dynamics:** Aurrigo vehicles weigh 2-5 tonnes. This affects:

```
Effective braking distance: 
  2-tonne vehicle (empty ADT3): d_brake = v^2 / (2*2.0) standard
  5-tonne vehicle (loaded):     d_brake = v^2 / (2*1.5) degraded braking
  
  CBF must use the CURRENT vehicle weight estimate to compute safe distances.
  Weight estimation from suspension sensors or load cell data.
```

**Crab Steering Mode (ADT3 Special):** The ADT3 supports crab steering (all four wheels steer in the same direction for lateral translation). The CBF must be aware of the steering mode:

```
Normal (Ackermann): bicycle model, CBF as described
Crab mode: lateral velocity is the primary control
  x_dot = v_lat * sin(theta_crab) + v_lon * cos(theta)
  y_dot = v_lat * cos(theta_crab) + v_lon * sin(theta)
  
  CBF constraints must account for lateral motion capability.
  Safe set may be different in crab mode (can dodge laterally).
```

### 7.5 Testing and Validation

**Unit Tests:**

```python
def test_cbf_barrier_invariance():
    """Verify that CBF maintains h(x) >= 0 over time."""
    cbf = AirsideCBFFilter(ADT3_PARAMS)
    
    # Start near an obstacle
    ego = [0, 0, 0, 5.0]          # Moving at 5 m/s toward obstacle
    obstacle = ([15, 0], [0, 0], 'gse')  # Stationary obstacle at 15m
    
    dt = 0.01
    for _ in range(1000):  # 10 seconds
        u_nom = 0.5  # Trying to accelerate toward obstacle
        u_safe, feasible, _ = cbf.solve_cbf_qp(
            ego, u_nom, [obstacle], 6.67, []
        )
        
        # Simulate forward
        ego[0] += ego[3] * np.cos(ego[2]) * dt
        ego[1] += ego[3] * np.sin(ego[2]) * dt
        ego[3] += u_safe * dt
        ego[3] = max(0, ego[3])  # No reverse
        
        # Check barrier value
        dx = ego[0] - obstacle[0][0]
        dy = ego[1] - obstacle[0][1]
        dist = np.sqrt(dx**2 + dy**2)
        d_safe = cbf.safe_distance(ego[3], 'gse')
        
        assert dist >= d_safe * 0.95, \
            f"Safety violated: dist={dist:.2f} < d_safe={d_safe:.2f}"

def test_cbf_minimal_intervention():
    """Verify CBF does not modify already-safe inputs."""
    cbf = AirsideCBFFilter(ADT3_PARAMS)
    
    # Far from any obstacle
    ego = [0, 0, 0, 3.0]
    obstacle = ([100, 0], [0, 0], 'gse')  # Very far
    
    u_nom = 0.5
    u_safe, feasible, active = cbf.solve_cbf_qp(
        ego, u_nom, [obstacle], 6.67, []
    )
    
    assert abs(u_safe - u_nom) < 1e-4, \
        f"CBF modified safe input: u_nom={u_nom}, u_safe={u_safe}"
    assert len(active) == 0, "No constraints should be active"

def test_cbf_emergency_braking():
    """Verify CBF triggers full braking when critically close."""
    cbf = AirsideCBFFilter(ADT3_PARAMS)
    
    # Very close to obstacle, moving fast
    ego = [0, 0, 0, 6.0]  # 6 m/s
    obstacle = ([8, 0], [0, 0], 'personnel')  # Close personnel
    
    u_nom = 0.5  # Trying to accelerate (very bad idea)
    u_safe, feasible, active = cbf.solve_cbf_qp(
        ego, u_nom, [obstacle], 6.67, []
    )
    
    assert u_safe < -1.0, \
        f"CBF should brake hard: u_safe={u_safe}"
    assert 'obs_personnel_0' in active, \
        "Personnel constraint should be active"
```

**Simulation Tests (using Aurrigo's pysim):**

```
Test scenarios for CBF validation:

1. Approach and stop: Ego drives toward stationary obstacle.
   Pass criteria: comes to full stop with >= d_safe clearance.

2. Crossing pedestrian: Personnel walks across ego's path.
   Pass criteria: ego slows/stops, never enters personnel safe zone.

3. Multiple obstacles: Navigate through cluttered apron.
   Pass criteria: all CBF constraints satisfied, no collisions.

4. Speed zone transition: Ego enters lower speed zone.
   Pass criteria: decelerates before entering zone, never exceeds limit.

5. Geofence approach: Ego approaches runway boundary.
   Pass criteria: never crosses geofence boundary.

6. Fleet intersection: Two ego AVs approach intersection.
   Pass criteria: one yields, no inter-vehicle collision, no deadlock.

7. Pushback avoidance: Aircraft pushes back into ego's path.
   Pass criteria: ego stops with >= 0.5m aircraft clearance.

8. Jet blast zone: Ego approaches active engine exhaust.
   Pass criteria: ego does not enter jet blast cone.
```

---

## 8. Integration with Simplex Architecture

### 8.1 Current Architecture

The current Aurrigo Simplex architecture (documented in `synthesis/design-spec.md`):

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────────────────┐         ┌───────────────────────┐       │
│  │  AC: Neural Planner   │         │  BC: Frenet Planner   │       │
│  │  (High Performance)   │         │  (Verified Safe)      │       │
│  │                       │         │                       │       │
│  │  - World model pred.  │         │  - 420 candidates     │       │
│  │  - Game-theoretic     │         │  - Stanley control    │       │
│  │  - DiffusionDrive     │         │  - Conservative       │       │
│  └──────────┬────────────┘         └──────────┬────────────┘       │
│             │                                  │                    │
│             ▼                                  ▼                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Decision Module                            │  │
│  │                                                              │  │
│  │  Switching criteria:                                         │  │
│  │  - AC trajectory feasibility                                 │  │
│  │  - OOD detection score                                       │  │
│  │  - RSS safe distance check                                   │  │
│  │  - Confidence calibration                                    │  │
│  │  - Watchdog / heartbeat                                      │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│                     Vehicle Actuators                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Enhanced Architecture with CBF

The key insight: add CBF safety filtering on **both** paths. This provides formal safety guarantees regardless of which planner is active.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌────────────────────────┐            ┌────────────────────────┐       │
│  │  AC: Neural Planner    │            │  BC: Frenet Planner    │       │
│  │  (High Performance)    │            │  (Verified Safe)       │       │
│  │                        │            │                        │       │
│  │  - World model pred.   │            │  - 420 candidates      │       │
│  │  - Game-theoretic      │            │  - Stanley control     │       │
│  │  - DiffusionDrive      │            │  - Conservative params │       │
│  └──────────┬─────────────┘            └──────────┬─────────────┘       │
│             │ u_ac                                 │ u_bc                │
│             ▼                                      ▼                     │
│  ┌─────────────────────┐            ┌─────────────────────────┐         │
│  │  CBF Filter (AC)    │            │  CBF Filter (BC)        │         │
│  │                     │            │                         │         │
│  │  Same CBF-QP, same  │            │  Same CBF-QP, same     │         │
│  │  constraints, same  │            │  constraints, same     │         │
│  │  guarantees         │            │  guarantees            │         │
│  │                     │            │                         │         │
│  │  Monitors: h values │            │  Monitors: h values    │         │
│  │  + QP feasibility   │            │  + QP feasibility      │         │
│  └──────────┬──────────┘            └──────────┬──────────────┘         │
│             │ u_ac_safe                         │ u_bc_safe              │
│             ▼                                   ▼                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Enhanced Decision Module                        │  │
│  │                                                                   │  │
│  │  Existing criteria:                                               │  │
│  │  - AC trajectory feasibility                                      │  │
│  │  - OOD detection score                                            │  │
│  │  - Confidence calibration                                         │  │
│  │  - Watchdog / heartbeat                                           │  │
│  │                                                                   │  │
│  │  NEW CBF-based criteria:                                          │  │
│  │  - CBF(AC) feasible AND CBF(BC) feasible  --> Use AC              │  │
│  │  - CBF(AC) infeasible, CBF(BC) feasible   --> Switch to BC        │  │
│  │  - Both infeasible                        --> E-STOP               │  │
│  │  - min(h_i) for AC vs BC                  --> Prefer higher margin │  │
│  │  - CBF intervention magnitude             --> Large = switch to BC │  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
│                               │                                         │
│                               ▼                                         │
│                      Vehicle Actuators                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.3 CBF-Based Switching Criteria

The Decision Module gains new, formally grounded switching criteria:

**Criterion 1: CBF-QP Feasibility**

```
If CBF-QP(AC) is infeasible:
  The neural planner has driven the vehicle into a state where no
  control input within actuator limits can satisfy all safety constraints.
  
  Action: IMMEDIATELY switch to BC.
  
  Reason: The neural planner has failed to maintain sufficient safety
  margins. The Frenet planner's conservative parameters should keep
  the vehicle farther from constraints.
```

**Criterion 2: CBF Intervention Magnitude**

```
intervention = ||u_ac_safe - u_ac||

If intervention > threshold_switch (e.g., 1.0 m/s^2):
  The CBF is making large corrections to the neural planner's output.
  This indicates the neural planner is proposing unsafe trajectories.
  
  Action: Switch to BC after N consecutive large interventions (e.g., N=5).
  
  Reason: Sustained large CBF corrections suggest the neural planner
  is in an OOD regime. The corrections maintain safety but degrade
  the planned trajectory quality.
```

**Criterion 3: Minimum Barrier Value**

```
min_h_ac = min(h_i(x_ac))  -- minimum barrier value across all CBFs for AC path
min_h_bc = min(h_i(x_bc))  -- minimum barrier value for BC path

If min_h_ac < h_critical (e.g., 1.0):
  The AC path is operating too close to the safety boundary.
  
  Action: Prefer BC if min_h_bc > min_h_ac + margin.
  
  Reason: The BC path provides more safety headroom, reducing the
  risk of hitting infeasibility.
```

**Criterion 4: Both Infeasible (E-Stop)**

```
If CBF-QP(AC) infeasible AND CBF-QP(BC) infeasible:
  NO safe control exists within actuator limits.
  The vehicle is in an unrecoverable unsafe state.
  
  Action: EMERGENCY STOP (maximum braking, hazard lights, alert fleet).
  
  This should never happen if CBFs are properly designed with
  input-constrained formulation. If it does, it indicates:
  - A sudden, unpredicted obstacle appearance
  - Catastrophic perception failure
  - CBF parameter misconfiguration
  
  Post-incident: log all data for analysis, flag for review.
```

### 8.4 CBF Filter on Both Paths: Why It Matters

**On the AC (Neural) Path:**
- The neural planner may propose trajectories that violate safety constraints (it has no formal safety guarantee)
- The CBF filter minimally corrects these to ensure safety
- This allows the neural planner to be aggressive/exploratory while still maintaining safety
- If CBF corrections are consistently large, this triggers switch to BC

**On the BC (Frenet) Path:**
- The Frenet planner is already conservative, but it uses hand-tuned safety margins
- These margins may be insufficient in edge cases (e.g., multiple converging obstacles)
- The CBF provides formally verified safety on top of the heuristic margins
- The CBF also handles constraints the Frenet planner does not model (jet blast, ILS zones)

**Defense in Depth:**

```
Layer 1: Planner (AC or BC) produces trajectory considering obstacles
Layer 2: CBF filter formally guarantees safety constraints
Layer 3: Simplex Decision Module switches paths if needed
Layer 4: E-stop if all else fails (independent safety MCU)

Each layer catches failures that the previous layer might miss.
CBF (Layer 2) is the key addition -- it turns statistical safety
into provable safety.
```

### 8.5 Implementation Sequence

**Phase 1: CBF on BC Path Only (2-4 weeks)**

```
- Implement CBF safety filter as ROS nodelet
- Add obstacle avoidance CBF and speed zone CBF
- Insert between Frenet planner and vehicle interface
- Validate: CBF should rarely intervene (Frenet already conservative)
- If CBF intervenes, it reveals edge cases in Frenet planner
```

**Phase 2: CBF on AC Path + Switching (4-8 weeks)**

```
- Add CBF filter to neural planner output
- Implement CBF-based switching criteria in Decision Module
- Add aircraft clearance CBF and geofence CBF
- Validate: CBF should intervene more on AC path than BC path
- Tune CBF parameters for airside-specific scenarios
```

**Phase 3: Multi-Agent CBF for Fleet (8-12 weeks)**

```
- Implement fleet communication protocol (V2V state sharing)
- Add pairwise CBF constraints between fleet vehicles
- Implement responsibility sharing and deadlock resolution
- Test with 2-4 vehicles in simulation, then on apron
```

**Phase 4: Game-Theoretic Prediction + CBF (12-20 weeks)**

```
- Train/adapt GameFormer for airside agent types
- Integrate predicted trajectories into CBF obstacle model
- Add jet blast, ILS, and personnel-specific CBFs
- Full system integration and certification evidence generation
```

### 8.6 Estimated Development Costs

| Phase | Effort | Hardware | Total |
|-------|--------|----------|-------|
| Phase 1: CBF on BC | 2 engineer-months | None (existing Orin) | $30-50K |
| Phase 2: CBF on AC + switching | 3 engineer-months | None | $45-75K |
| Phase 3: Multi-agent CBF | 3 engineer-months | V2V comm modules ($2K) | $47-77K |
| Phase 4: Game theory integration | 4 engineer-months | Training compute ($5K) | $65-105K |
| **Total** | **12 engineer-months** | **$7K** | **$187-307K** |

This is significantly less than the $130K-$380K estimated for ISO 3691-4 certification (documented in `60-safety-validation/standards-certification/iso-3691-4-deep-dive.md`), and the CBF framework directly provides the formal safety evidence that certification requires.

---

## 9. References

### Core CBF Theory

1. Ames, A.D., Coogan, S., Egerstedt, M., Notomista, G., Sreenath, K., and Tabuada, P. (2019). "Control Barrier Functions: Theory and Applications." European Control Conference. -- The foundational survey paper.

2. Ames, A.D., Xu, X., Grizzle, J.W., and Tabuada, P. (2017). "Control Barrier Function Based Quadratic Programs for Safety Critical Systems." IEEE TAC. -- Original CBF-QP formulation.

3. Xiao, W., and Belta, C. (2019). "Control Barrier Functions for Systems with High Relative Degree." IEEE CDC. -- HOCBF theory.

4. Nguyen, Q., and Sreenath, K. (2016). "Exponential Control Barrier Functions for Enforcing High Relative-Degree Safety-Critical Constraints." ACC. -- ECBF formulation.

### CBF for Autonomous Vehicles

5. Ma, H., et al. (2024). "Learning-based safety filters for control barrier functions." Annual Reviews in Control. -- Neural CBF synthesis.

6. Dawson, C., Gao, S., and Fan, C. (2023). "Safe Control with Learned Certificates: A Survey of Neural Lyapunov, Barrier, and Contraction Methods for Robotics and Control." IEEE T-RO. -- Comprehensive survey.

7. Phan, D., et al. (2020). "Neural Simplex Architecture." NFM 2020. -- Neural planner + Simplex + CBF.

8. Luo, W., et al. (2024). "GCBF+: A Neural Graph Control Barrier Function Framework for Distributed Safe Multi-Agent Control." MIT. -- Multi-agent CBF.

### Game-Theoretic Planning

9. Huang, Z., et al. (2023). "GameFormer: Game-theoretic Modeling and Learning of Transformer-based Interactive Prediction and Planning for Autonomous Driving." ICCV 2023 (Oral). -- Level-k reasoning.

10. Geiger, P., et al. (2023). "MARC: Multipolicy and Risk-Aware Contingency Planning for Autonomous Driving." TU Munich. -- Tree-structured contingency plans.

11. Schwarting, W., Pierson, A., Alonso-Mora, J., Karaman, S., and Rus, D. (2019). "Social behavior for autonomous vehicles." PNAS. -- Social value orientation for game-theoretic driving.

12. Fridovich-Keil, D., Ratner, E., et al. (2020). "Efficient Iterative Linear-Quadratic Approximations for Nonlinear Multi-Player General-Sum Differential Games." ICRA. -- Efficient Nash solvers for driving.

### Robust and Verified CBF

13. Jankovic, M. (2018). "Robust Control Barrier Functions for Constrained Stabilization of Nonlinear Systems." Automatica. -- Robust CBF theory.

14. Kolathaya, S., and Ames, A.D. (2019). "Input-to-State Safety with Control Barrier Functions." IEEE CSL. -- ISSf-CBF.

15. Kang, H., et al. (2024). "Verification and Synthesis of Robust Control Barrier Functions." CDC. -- Formal verification of CBFs.

### Solvers and Implementation

16. Stellato, B., et al. (2020). "OSQP: An Operator Splitting Solver for Quadratic Programs." Mathematical Programming Computation. -- OSQP solver.

17. Ferreau, H.J., et al. (2014). "qpOASES: A parametric active-set algorithm for quadratic programming." Mathematical Programming Computation. -- qpOASES solver.

### Airside Safety Standards

18. ISO 3691-4:2023. "Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks and their systems."

19. ISO 21448:2022. "Road vehicles -- Safety of the intended functionality (SOTIF)."

20. FAA CertAlert 24-02. "Safe Integration of Autonomous Ground Vehicles on Airports."
