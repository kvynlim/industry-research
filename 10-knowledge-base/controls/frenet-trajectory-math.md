# Frenet-Frame Trajectory Planning: Complete Mathematical Foundations

## 1. The Frenet-Serret Frame

### 1.1 Definition

The Frenet-Serret frame (also called the TNB frame or moving trihedron) is an orthonormal coordinate system that travels along a smooth curve in three-dimensional Euclidean space. It provides a natural, intrinsic description of a curve's geometry independent of the choice of parameterization.

Given a curve **r**(t) parameterized by arc length s, the frame consists of three mutually orthogonal unit vectors:

**Tangent vector T(s):**

```
T(s) = dr/ds
```

The unit tangent vector points in the direction of increasing arc length. For an arbitrary parameterization r(t):

```
T(t) = r'(t) / ||r'(t)||
```

**Principal normal vector N(s):**

```
N(s) = (dT/ds) / ||dT/ds||
```

N points toward the center of curvature --- the direction in which the curve is turning. It is always perpendicular to T.

**Binormal vector B(s):**

```
B(s) = T(s) x N(s)
```

B is the cross product of T and N, completing the right-handed orthonormal basis. It is perpendicular to the osculating plane (the plane spanned by T and N).

### 1.2 Curvature and Torsion

**Curvature kappa** measures the rate at which the curve deviates from a straight line:

```
kappa(s) = ||dT/ds|| = ||r''(s)||
```

Geometrically, kappa = 1/R where R is the radius of the osculating circle. For an arbitrary parameterization:

```
kappa = ||r'(t) x r''(t)|| / ||r'(t)||^3
```

**Torsion tau** measures how the curve deviates from being planar (i.e., the rate at which the osculating plane rotates about the tangent):

```
tau(s) = -dB/ds . N(s)
```

For an arbitrary parameterization:

```
tau = (r'(t) x r''(t)) . r'''(t) / ||r'(t) x r''(t)||^2
```

### 1.3 Frenet-Serret Formulas (Matrix Form)

The fundamental equations relating the derivatives of the frame vectors to curvature and torsion:

```
d/ds [T]   [ 0      kappa   0   ] [T]
     [N] = [-kappa  0       tau ] [N]
     [B]   [ 0     -tau     0   ] [B]
```

Written component-wise:

```
dT/ds =  kappa * N
dN/ds = -kappa * T + tau * B
dB/ds = -tau * N
```

The matrix is **skew-symmetric**, which is a consequence of the orthonormality of {T, N, B} and ensures that the frame remains orthonormal as it evolves along the curve.

**Key interpretive insight:** Curvature kappa measures the failure of a curve to be a straight line, while torsion tau measures the failure of a curve to be planar. Together, they completely determine a space curve up to rigid motion (the Fundamental Theorem of Space Curves).

### 1.4 Reduction to 2D for Road Geometry

In autonomous driving, the reference path lies in a plane (the road surface), so torsion tau = 0. The Frenet frame reduces to:

```
dT/ds =  kappa * N
dN/ds = -kappa * T
```

The frame becomes the pair {T(s), N(s)} along the reference centerline, where:
- T(s) points along the road direction at arc length s
- N(s) points to the left (perpendicular to the road, in the positive lateral direction)
- kappa(s) is the road curvature at that point

---

## 2. Frenet Coordinate System for Road-Aligned Planning

### 2.1 Coordinate Definition

In the Frenet frame for road planning, a vehicle's position is described by two coordinates:

- **s** (longitudinal): the arc length along the reference path from some origin point
- **d** (lateral): the signed perpendicular distance from the reference path (positive = left of path direction)

This natural decomposition separates the planning problem into two independent one-dimensional subproblems.

### 2.2 Cartesian-to-Frenet Transformation

Given a point P = (x, y) in Cartesian coordinates and a reference path R(s) = (x_r(s), y_r(s)):

**Step 1: Find the closest point.** Solve for s* such that the vector from R(s*) to P is orthogonal to the tangent T(s*):

```
(P - R(s*)) . T(s*) = 0
```

In practice, this is a nearest-point projection (often solved by discretizing the reference path and finding the minimum distance, then refining with Newton's method).

**Step 2: Compute coordinates:**

```
s = s*   (arc length of the projected point)
d = (P - R(s*)) . N(s*)   (signed perpendicular distance)
```

Or equivalently for the position reconstruction:

```
P_C(s, d) = R_C(s) + d * N(s)
```

### 2.3 Velocity and Heading Transformation

Given a vehicle with Cartesian state (x, y, theta, v) and the reference path state at the projected point (theta_r, kappa_r):

**Heading difference:**
```
Delta_theta = theta - theta_r
```

**Longitudinal velocity (time derivative of s):**
```
s_dot = v * cos(Delta_theta) / (1 - kappa_r * d)
```

**Lateral velocity (time derivative of d):**
```
d_dot = v * sin(Delta_theta)
```

**Lateral derivative with respect to arc length:**
```
d' = dd/ds = (1 - kappa_r * d) * tan(Delta_theta)
```

This is the chain rule relationship d' = d_dot / s_dot.

### 2.4 Frenet-to-Cartesian Back-Transformation

Given Frenet state (s, s_dot, d, d_dot):

**Position:**
```
x = x_r(s) + d * cos(theta_r(s) + pi/2)
y = y_r(s) + d * sin(theta_r(s) + pi/2)
```

**Heading:**
```
theta = theta_r + arctan(d' / (1 - kappa_r * d))
```

Where d' = d_dot / s_dot (lateral displacement derivative w.r.t. arc length).

**Speed:**
```
v = sqrt(s_dot^2 * (1 - kappa_r * d)^2 + d_dot^2)
```

### 2.5 Full Frenet State Vector

The complete state in the Frenet frame is:

```
[s, s_dot, s_ddot, d, d', d'']
```

Where derivatives of s are with respect to time, but derivatives of d are with respect to arc length s. This convention (from Werling et al.) is computationally convenient because lateral motion relative to path progress is more natural than lateral motion relative to time.

### 2.6 Acceleration Transformation

The lateral acceleration approximation (assuming s_ddot is small):

```
d_ddot (in time) ≈ d'' * s_dot^2
```

This follows from the chain rule: d_ddot = d'' * s_dot^2 + d' * s_ddot.

---

## 3. Jerk-Optimal Trajectory Derivation

### 3.1 The Optimization Problem

The core insight of Werling et al. (2010) is to generate trajectories that minimize **jerk** --- the time derivative of acceleration. Minimizing jerk produces smooth, comfortable trajectories that are physically realizable and pleasant for passengers.

The cost functional to minimize is:

```
J[x] = integral from t_0 to t_1 of (d^3 x / dt^3)^2 dt
```

This is the integral of the squared jerk over the trajectory duration.

### 3.2 Euler-Lagrange Derivation

Applying the calculus of variations, we seek x(t) that minimizes J[x]. The integrand is:

```
L(x, x', x'', x''') = (x''')^2
```

Since L depends on the third derivative of x, the Euler-Lagrange equation for this higher-order variational problem is:

```
dL/dx - d/dt(dL/dx') + d^2/dt^2(dL/dx'') - d^3/dt^3(dL/dx''') = 0
```

Since L = (x''')^2 depends only on x''', the first three terms are zero:

```
dL/dx = 0
dL/dx' = 0
dL/dx'' = 0
dL/dx''' = 2x'''
```

Therefore:

```
-d^3/dt^3(2x''') = 0
```

```
d^6 x / dt^6 = 0
```

### 3.3 Why Quintic: The Sixth-Order ODE

The Euler-Lagrange equation yields:

```
x^(6)(t) = 0
```

Integrating six times:

```
x^(5)(t) = C_1
x^(4)(t) = C_1 * t + C_2
x'''(t)  = (C_1/2) * t^2 + C_2 * t + C_3
x''(t)   = (C_1/6) * t^3 + (C_2/2) * t^2 + C_3 * t + C_4
x'(t)    = (C_1/24) * t^4 + (C_2/6) * t^3 + (C_3/2) * t^2 + C_4 * t + C_5
x(t)     = (C_1/120) * t^5 + (C_2/24) * t^4 + (C_3/6) * t^3 + (C_4/2) * t^2 + C_5 * t + C_6
```

Renaming constants:

```
x(t) = a_0 + a_1*t + a_2*t^2 + a_3*t^3 + a_4*t^4 + a_5*t^5
```

**This is a quintic (5th-order) polynomial.** The minimum jerk trajectory is necessarily a 5th-order polynomial --- no higher, no lower. This is the fundamental mathematical reason why quintic polynomials appear throughout trajectory planning.

### 3.4 Boundary Conditions (Six Constraints)

A quintic polynomial has six coefficients (a_0 through a_5), requiring six boundary conditions. These are typically position, velocity, and acceleration at both endpoints:

**At t = 0 (initial state):**
```
x(0)   = x_i      -->  a_0 = x_i
x'(0)  = v_i      -->  a_1 = v_i
x''(0) = acc_i    -->  2*a_2 = acc_i  -->  a_2 = acc_i / 2
```

**At t = T (final state):**
```
x(T)   = x_f
x'(T)  = v_f
x''(T) = acc_f
```

### 3.5 Solving for Coefficients

The first three coefficients are determined directly from initial conditions:

```
a_0 = x_i
a_1 = v_i
a_2 = acc_i / 2
```

The remaining three coefficients (a_3, a_4, a_5) are found by solving a 3x3 linear system derived from the final-state boundary conditions:

```
[  T^3      T^4      T^5   ] [a_3]   [ x_f - x_i - v_i*T - 0.5*acc_i*T^2 ]
[ 3T^2     4T^3     5T^4   ] [a_4] = [ v_f - v_i - acc_i*T                ]
[ 6T      12T^2    20T^3   ] [a_5]   [ acc_f - acc_i                       ]
```

This system is always solvable for T > 0 (the matrix is non-singular).

---

## 4. Werling et al. (2010): Optimal Trajectory Generation in a Frenet Frame

### 4.1 Paper Overview

**Full citation:** Werling, M., Ziegler, J., Kammel, S., and Thrun, S. "Optimal Trajectory Generation for Dynamic Street Scenarios in a Frenet Frame." IEEE International Conference on Robotics and Automation (ICRA), 2010.

This paper introduced the now-standard method for trajectory planning in autonomous driving by:

1. Decoupling motion into lateral (d) and longitudinal (s) components in the Frenet frame
2. Generating jerk-optimal polynomial trajectories independently in each dimension
3. Combining them and selecting the best via a cost function
4. Handling dynamic scenarios through time-varying terminal manifolds

### 4.2 Lateral Trajectory Generation (Quintic Polynomial)

For lateral motion, we need to specify position, velocity, and acceleration at both endpoints --- yielding six boundary conditions. A **quintic polynomial** is used:

```
d(t) = c_0 + c_1*t + c_2*t^2 + c_3*t^3 + c_4*t^4 + c_5*t^5
```

**Initial state** D_0 = [d_0, d_dot_0, d_ddot_0]:
- d_0: current lateral offset
- d_dot_0: current lateral velocity
- d_ddot_0: current lateral acceleration

**Terminal state** D_1 = [d_1, 0, 0]:
- d_1: desired lateral offset (sampled across multiple targets)
- d_dot_1 = 0: vehicle should be moving parallel to the reference path
- d_ddot_1 = 0: no lateral acceleration at the end

The terminal conditions d_dot_1 = 0 and d_ddot_1 = 0 enforce that the vehicle has settled into smooth, road-parallel travel by the end of the maneuver.

### 4.3 Longitudinal Trajectory Generation

Two cases arise, requiring different polynomial orders:

**Case 1: Velocity Keeping (Quartic Polynomial)**

When the vehicle simply needs to reach a target velocity (e.g., speed limit) without a specific position target, the final position is unconstrained. This removes one boundary condition, leaving five:

```
s(t) = c_0 + c_1*t + c_2*t^2 + c_3*t^3 + c_4*t^4
```

**Initial state:** [s_0, s_dot_0, s_ddot_0]
**Terminal state:** [s_dot_1, s_ddot_1 = 0] (position s_1 is free)

With one fewer constraint, the Euler-Lagrange equation with a free-endpoint transversality condition yields a **quartic (4th-order) polynomial** as the jerk-optimal solution. The polynomial has five coefficients matching the five boundary conditions.

**Case 2: Following / Stopping / Merging (Quintic Polynomial)**

When a specific final position is required (e.g., stop behind a lead vehicle, reach a merge point), all six boundary conditions are specified:

```
s(t) = c_0 + c_1*t + c_2*t^2 + c_3*t^3 + c_4*t^4 + c_5*t^5
```

**Initial state:** [s_0, s_dot_0, s_ddot_0]
**Terminal state:** [s_1, s_dot_1, s_ddot_1 = 0]

For a following maneuver, s_1 is set behind the leading vehicle at a safety distance governed by the constant time-gap law:

```
s_safe = s_leader - (sigma_0 + tau * v_leader)
```

Where sigma_0 is a minimum standstill distance and tau is the time gap.

### 4.4 Why Quartic for Velocity-Keeping

The mathematical justification follows from the **transversality condition** in calculus of variations. When the endpoint position is free, the variational problem has a natural boundary condition that eliminates one constraint. Applying the Euler-Lagrange equation to:

```
J = integral of (s''')^2 dt   subject to s(T) free
```

yields the transversality condition (ds'''/dt)|_{t=T} = 0, which combined with the remaining five boundary conditions produces a quartic polynomial.

Physically: when you don't care exactly where you end up on the road but only how fast you're going, you have more freedom, and a simpler polynomial suffices.

---

## 5. Trajectory Sampling Strategy

### 5.1 The Sampling Paradigm

Rather than solving a single optimization problem, Werling's method generates a **dense set of candidate trajectories** by discretizing the terminal conditions along three dimensions:

1. **Lateral offset d_1**: target lateral positions
2. **Longitudinal velocity s_dot_1** (or position s_1): target speeds or positions
3. **Time horizon T**: duration to complete the maneuver

Each combination of (d_1, s_dot_1, T) defines a unique pair of lateral and longitudinal boundary conditions, producing one candidate trajectory.

### 5.2 Typical Sampling Parameters

Based on standard implementations (PythonRobotics, MATLAB Navigation Toolbox, and practical deployments):

**Lateral offset samples:**
```
d_1 in {-D_max, ..., -delta_d, 0, +delta_d, ..., +D_max}
```
Example: D_max = 3.0 m, delta_d = 1.0 m --> 7 samples: {-3, -2, -1, 0, 1, 2, 3} m

For lane changes on a road with ~3.5 m lanes, offsets correspond to:
- d = 0: stay in current lane center
- d = +/- 3.5 m: move to adjacent lane center
- Intermediate values: partial lane changes or offset driving

**Time horizon samples:**
```
T in {T_min, T_min + delta_T, ..., T_max}
```
Example: T_min = 1.0 s, T_max = 5.0 s, delta_T ≈ 0.27 s --> 15 samples

Shorter horizons produce more aggressive maneuvers; longer horizons are gentler. The planner evaluates all and lets the cost function decide.

**Velocity target samples:**
```
s_dot_1 in {v_target - n*delta_v, ..., v_target, ..., v_target + n*delta_v}
```
Example: v_target = 30 m/s (speed limit), delta_v = 5/3.6 m/s, n = 1.5 --> 4 samples

### 5.3 Candidate Generation: 420 = 7 x 4 x 15

A concrete configuration that generates 420 candidate trajectories:

| Dimension           | Samples | Values                                                    |
|---------------------|---------|-----------------------------------------------------------|
| Lateral offset d_1  | 7       | {-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0} m                |
| Velocity s_dot_1    | 4       | {v_target - 3, v_target - 1, v_target, v_target + 1} m/s |
| Time horizon T      | 15      | linspace(1.0, 5.0, 15) seconds                            |

Total candidates: 7 * 4 * 15 = **420 trajectories**

Each candidate is fully defined by its boundary conditions and can be computed in closed form (matrix inversion of a 3x3 system), making the entire generation process extremely fast --- typically under 1 ms for all 420 candidates.

### 5.4 Trajectory Combination

Every lateral trajectory d_i(t) is combined with every longitudinal trajectory s_j(t) to form a 2D trajectory in Frenet space (s(t), d(t)). The total number of evaluated combinations is:

```
N_total = N_lateral * N_longitudinal
```

However, in the 420-candidate formulation, the lateral and longitudinal dimensions are already jointly sampled (each triplet defines both lateral and longitudinal components), so the 420 number represents the total candidate count directly.

---

## 6. Cost Function

### 6.1 Lateral Cost

The cost for a lateral trajectory d(t) over duration T:

```
C_d = k_j * J_d + k_t * T + k_d * d_1^2
```

Where:
- **J_d = integral from 0 to T of (d'''(t))^2 dt** --- integral of squared lateral jerk
- **T** --- trajectory duration (penalizes slow maneuvers)
- **d_1^2** --- squared final lateral offset (penalizes deviation from centerline)
- **k_j, k_t, k_d** --- weight coefficients

### 6.2 Longitudinal Cost (Velocity Keeping)

```
C_s = k_j * J_s + k_t * T + k_s * (s_dot_1 - s_dot_desired)^2
```

Where:
- **J_s = integral from 0 to T of (s'''(t))^2 dt** --- integral of squared longitudinal jerk
- **(s_dot_1 - s_dot_desired)^2** --- squared velocity deviation from target

### 6.3 Longitudinal Cost (Position Target: Following/Stopping)

```
C_s = k_j * J_s + k_t * T + k_s * (s_1 - s_desired)^2
```

Where the final term penalizes deviation from the target longitudinal position.

### 6.4 Combined Cost

```
C_total = C_d + k_lon * C_s
```

Where k_lon balances the relative importance of lateral vs. longitudinal objectives.

### 6.5 Computing the Jerk Integral

For a quintic polynomial x(t) = a_0 + a_1*t + a_2*t^2 + a_3*t^3 + a_4*t^4 + a_5*t^5:

The third derivative (jerk) is:
```
x'''(t) = 6*a_3 + 24*a_4*t + 60*a_5*t^2
```

The squared jerk integral has a closed-form solution:
```
J = integral of (x''')^2 dt
  = integral of (6*a_3 + 24*a_4*t + 60*a_5*t^2)^2 dt
  = 36*a_3^2*T + 576*a_3*a_4*T^2/2 + (576*a_4^2 + 720*a_3*a_5)*T^3/3
    + 2880*a_4*a_5*T^4/4 + 3600*a_5^2*T^5/5
```

This is evaluated analytically --- no numerical integration needed.

### 6.6 Reference Weight Values

From the PythonRobotics reference implementation (AtsushiSakai):

```
K_J   = 0.1    # jerk penalty weight
K_T   = 0.1    # time penalty weight
K_D   = 1.0    # lateral deviation penalty weight
K_S   = 1.0    # speed deviation penalty weight (longitudinal)
K_LAT = 1.0    # lateral cost total weight
K_LON = 1.0    # longitudinal cost total weight
```

In the Werling paper, the weights are described as tunable parameters. The ratio between k_j and k_d determines the tradeoff between trajectory smoothness and accuracy of reaching the target offset. Typical practice:

- **k_j << k_d**: Prioritize reaching the target offset precisely, accept jerkier trajectories
- **k_j >> k_d**: Prioritize smoothness, accept imprecise final offset
- **k_t small**: Don't strongly penalize longer maneuver durations
- **k_lon ≈ 1**: Equal weighting of lateral and longitudinal costs is a common starting point

From MATLAB's trajectoryOptimalFrenet defaults:

```
Time weight:                0
ArcLength weight:           0
LateralSmoothness weight:   0
LongitudinalSmoothness:     0
Deviation weight:           1
MaxCurvature:               0.1 m^-1
MaxAcceleration:            2.5 m/s^2
```

---

## 7. Collision Checking

### 7.1 Discretize-and-Check Approach

After generating candidate trajectories, infeasible ones must be eliminated. The standard collision checking pipeline:

**Step 1: Discretize the trajectory in time**

For each candidate trajectory, evaluate the state at discrete timesteps:

```
t_k = k * dt,   k = 0, 1, ..., N
```

where dt is typically 0.1--0.2 s, and N = T / dt.

**Step 2: Compute vehicle footprint at each timestep**

At each t_k, the vehicle occupies a rectangle (or oriented polygon) defined by:
- Center position: (x(t_k), y(t_k)) from the Frenet-to-Cartesian back-transformation
- Heading: theta(t_k)
- Dimensions: vehicle length L_v and width W_v

The four corners of the oriented bounding box (OBB) at time t_k are:

```
corners = center + R(theta) * [+/- L_v/2, +/- W_v/2]^T
```

where R(theta) is the 2D rotation matrix.

### 7.2 Swept Volume

The **swept volume** is the union of all vehicle footprints along the trajectory:

```
SV = union over k of Footprint(t_k)
```

For a more conservative (and continuous) approximation, the convex hull of consecutive footprints can be computed, forming a polygon that covers the vehicle's path between timesteps.

### 7.3 Polygon Intersection Test (SAT)

Collision detection between two convex polygons (the vehicle footprint and each obstacle) is performed using the **Separating Axis Theorem (SAT)**:

Two convex polygons do **not** intersect if and only if there exists a separating axis (a line) such that the projections of the two polygons onto that axis do not overlap. For two rectangles, the candidate separating axes are the four edge normals (two per rectangle).

**Algorithm:**
```
for each candidate axis (edge normal of either polygon):
    project both polygons onto the axis
    if projections do not overlap:
        return NO COLLISION  (separating axis found)
return COLLISION  (no separating axis exists)
```

For two OBBs in 2D, this requires testing at most 4 axes, making it O(1) per pair.

### 7.4 Feasibility Constraints

Beyond collision, trajectories are checked against kinematic and dynamic limits:

```
|kappa(t)| <= kappa_max                    (curvature / steering limit)
|a(t)| <= a_max                            (acceleration limit)
|jerk(t)| <= jerk_max                      (jerk limit, optional)
v_min <= v(t) <= v_max                     (speed bounds)
```

The curvature constraint is particularly important as it enforces the physical turning capability of the vehicle (see Section 11 on Ackermann constraints).

---

## 8. The Stanley Controller

### 8.1 Origins

The Stanley controller was developed by the Stanford Racing Team for their autonomous vehicle "Stanley," which won the 2005 DARPA Grand Challenge. It is a nonlinear feedback controller for lateral path tracking that operates by referencing the front axle position.

### 8.2 Error Definitions

**Cross-track error (e_cte or e(t)):** The lateral distance from the center of the vehicle's front axle to the nearest point on the desired path.

**Heading error (psi_e or theta_e):** The angle between the vehicle's heading and the heading of the path at the nearest point:

```
psi_e = theta_path - theta_vehicle
```

### 8.3 Control Law

The steering angle command is:

```
delta(t) = psi_e(t) + arctan(k * e(t) / v_f(t))
```

Subject to saturation:

```
delta_min <= delta(t) <= delta_max
```

Where:
- **psi_e(t)**: heading error --- corrects heading misalignment
- **arctan(k * e(t) / v_f(t))**: cross-track error correction
- **k**: proportional gain (tuning parameter, typically 1--5)
- **v_f(t)**: forward velocity (speed of the front axle)
- **delta**: steering angle command

### 8.4 Decomposition of the Control Law

**Term 1: Heading correction**

```
delta_heading = psi_e
```

When the vehicle heading is misaligned with the path, this term directly steers toward alignment. If the vehicle is on the path but pointed in the wrong direction, this alone would correct it.

**Term 2: Cross-track error correction**

```
delta_crosstrack = arctan(k * e / v_f)
```

This term steers toward the path when the vehicle is displaced laterally. Key properties:

- The gain k*e/v scales inversely with speed: at high speed, corrections are gentler
- The arctan function bounds the correction to (-pi/2, +pi/2), preventing extreme steering commands
- At zero speed, the argument diverges, so a softening constant k_s is often added: arctan(k * e / (k_s + v_f))

### 8.5 Error Dynamics and Stability

For the front-axle bicycle model, the rate of cross-track error change is:

```
e_dot = -v_f * sin(psi_e - delta)
```

Substituting the Stanley control law and linearizing for small errors:

```
e_dot ≈ -k * e
```

This yields **exponential convergence** with time constant 1/k, **independent of vehicle speed**. This speed-independent convergence rate is a distinguishing advantage of the Stanley controller over pure pursuit, which has speed-dependent convergence.

The controller is **globally stable** for arbitrary initial conditions when operating without steering saturation.

### 8.6 Modified Stanley Controller (Low-Speed Softening)

To handle the singularity at v = 0:

```
delta(t) = psi_e(t) + arctan(k * e(t) / (k_s + v_f(t)))
```

Where k_s > 0 is a small softening constant (e.g., k_s = 0.1 m/s). This prevents division by zero while having minimal effect at normal driving speeds.

---

## 9. Velocity Profiling

### 9.1 Purpose

Velocity profiling determines the speed the vehicle should travel at each point along a planned path. It converts a geometric path into a complete time-parameterized trajectory that respects dynamic constraints.

### 9.2 Trapezoidal Velocity Profile

The simplest approach consists of three phases:

**Phase 1 --- Acceleration:**
```
v(t) = v_0 + a_max * t,    t in [0, t_1]
```

**Phase 2 --- Cruise:**
```
v(t) = v_max,              t in [t_1, t_2]
```

**Phase 3 --- Deceleration:**
```
v(t) = v_max - a_max * (t - t_2),    t in [t_2, t_3]
```

The acceleration is piecewise constant, causing **discontinuous jerk** at the transition points t_1 and t_2. This produces uncomfortable jolts and mechanical stress.

### 9.3 S-Curve Velocity Profile

To eliminate jerk discontinuities, the S-curve profile adds jerk-limited ramp segments. Each acceleration/deceleration phase is subdivided into three sub-phases with constant jerk:

```
Phase 1a: jerk = +j_max    (acceleration increasing)
Phase 1b: jerk = 0         (constant acceleration)
Phase 1c: jerk = -j_max    (acceleration decreasing toward zero)
```

This produces a smooth, S-shaped velocity curve. The acceleration profile is trapezoidal (rather than rectangular as in the simple trapezoidal velocity profile), and jerk is piecewise constant and bounded.

The resulting velocity profile has **continuous acceleration** and **bounded jerk**, making it suitable for comfort-critical applications like passenger vehicles and airport ground vehicles.

### 9.4 Curvature-Constrained Speed

At each point along the path, the maximum safe speed is limited by the path curvature and the maximum allowable lateral acceleration:

```
v_max(s) = sqrt(a_lat_max / |kappa(s)|)
```

Where:
- a_lat_max: maximum comfortable lateral acceleration (typically 2--4 m/s^2 for passenger vehicles, 1--2 m/s^2 for airport vehicles)
- kappa(s): curvature at arc length s

The velocity profile must satisfy v(s) <= v_max(s) at every point.

### 9.5 Integration with Frenet Planning

In the Werling framework, velocity profiling is handled implicitly by the longitudinal trajectory generation. The quartic/quintic polynomial s(t) directly encodes the velocity profile:

```
v(t) = s_dot(t) = c_1 + 2*c_2*t + 3*c_3*t^2 + 4*c_4*t^3 [+ 5*c_5*t^4]
```

The cost function's velocity-deviation term ensures the profile reaches the desired speed, while the jerk term ensures smoothness. Feasibility checking against acceleration and curvature limits further constrains the acceptable profiles.

---

## 10. Complete Algorithm: Frenet-Frame Trajectory Planning

### 10.1 Algorithm Summary

```
Input:  Current state (x, y, theta, v, a), reference path R(s), obstacles
Output: Optimal feasible trajectory (x(t), y(t)) for the next planning horizon

1. TRANSFORM current Cartesian state to Frenet: [s_0, s_dot_0, s_ddot_0, d_0, d_dot_0, d_ddot_0]

2. GENERATE lateral trajectory candidates:
   for each d_1 in lateral_offsets:
       for each T in time_horizons:
           Solve quintic polynomial connecting [d_0, d_dot_0, d_ddot_0] to [d_1, 0, 0] over duration T
           Compute lateral cost: C_d = k_j * J_d + k_t * T + k_d * d_1^2

3. GENERATE longitudinal trajectory candidates:
   for each v_1 in velocity_targets:
       for each T in time_horizons:
           Solve quartic polynomial connecting [s_0, s_dot_0, s_ddot_0] to [v_1, 0] over duration T
           Compute longitudinal cost: C_s = k_j * J_s + k_t * T + k_s * (v_1 - v_desired)^2

4. COMBINE each lateral trajectory with each longitudinal trajectory:
   C_total = C_d + k_lon * C_s

5. SORT all candidates by total cost (ascending)

6. VALIDATE candidates (in cost order):
   a. Transform to Cartesian coordinates
   b. Check curvature: |kappa(t_k)| <= kappa_max for all t_k
   c. Check acceleration: |a(t_k)| <= a_max for all t_k
   d. Check velocity bounds: v_min <= v(t_k) <= v_max
   e. Check collisions: no overlap with obstacle footprints at any t_k

7. SELECT first (lowest-cost) feasible trajectory

8. EXECUTE trajectory via controller (e.g., Stanley) for the current planning cycle

9. REPEAT from step 1 at the next planning cycle
```

### 10.2 Computational Complexity

- Polynomial coefficient computation: O(1) per trajectory (3x3 matrix inversion)
- Jerk integral: O(1) per trajectory (closed-form)
- Feasibility checks: O(N_timesteps * N_obstacles) per trajectory
- Total: O(N_candidates * N_timesteps * N_obstacles)

For 420 candidates, 50 timesteps, and 20 obstacles: ~420,000 collision checks. With SAT (O(1) per check), this is well within real-time constraints (<10 ms on modern hardware).

---

## 11. Ackermann Constraints on Feasible Trajectories

### 11.1 Ackermann Steering Geometry

The Ackermann steering mechanism ensures that the inner and outer front wheels turn at different angles during cornering, so all wheels trace concentric arcs about a common instantaneous center of rotation (ICR).

For an ideal Ackermann geometry:

```
cot(delta_outer) - cot(delta_inner) = W / L
```

Where:
- delta_outer: steering angle of the outer wheel
- delta_inner: steering angle of the inner wheel
- W: track width (distance between left and right wheel centers)
- L: wheelbase (distance between front and rear axle centers)

### 11.2 Bicycle Model Approximation

For trajectory planning, the full four-wheel model is simplified to the **kinematic bicycle model** which uses a single equivalent front steering angle delta:

**State equations:**
```
dx/dt     = v * cos(theta)
dy/dt     = v * sin(theta)
dtheta/dt = v * tan(delta) / L
dv/dt     = a
```

**Curvature-steering relationship:**
```
kappa = tan(delta) / L
```

Equivalently:
```
delta = arctan(kappa * L)
```

**Turning radius:**
```
R = L / tan(delta) = 1 / kappa
```

### 11.3 Maximum Curvature Constraint

The physical steering mechanism has a maximum steering angle delta_max. This imposes a **maximum curvature** on any feasible trajectory:

```
kappa_max = tan(delta_max) / L
```

**Minimum turning radius:**
```
R_min = L / tan(delta_max)
```

Example: For a vehicle with L = 2.7 m and delta_max = 35 degrees:
```
kappa_max = tan(35 deg) / 2.7 = 0.700 / 2.7 = 0.259 m^-1
R_min = 2.7 / tan(35 deg) = 2.7 / 0.700 = 3.86 m
```

For an airport ground vehicle (e.g., Aurrigo-class) with L = 2.0 m and delta_max = 40 degrees:
```
kappa_max = tan(40 deg) / 2.0 = 0.839 / 2.0 = 0.420 m^-1
R_min = 2.0 / 0.839 = 2.38 m
```

### 11.4 Curvature Rate Constraint

The steering actuator has a finite slew rate (maximum rate of steering angle change), imposing a constraint on the curvature rate:

```
|d(kappa)/dt| <= kappa_dot_max
```

Since kappa = tan(delta)/L:

```
d(kappa)/dt = (1 / (L * cos^2(delta))) * (d(delta)/dt)
```

Therefore:

```
kappa_dot_max = delta_dot_max / (L * cos^2(delta_max))
```

This constraint eliminates trajectories that require impossibly fast steering inputs.

### 11.5 Non-Holonomic Constraint

An Ackermann-steered vehicle is **non-holonomic**: it has 2 control inputs (steering angle delta and throttle/brake) but moves in a 3-dimensional configuration space (x, y, theta). This means:

- The vehicle cannot move sideways instantaneously
- It cannot rotate in place (without forward/reverse motion)
- Any trajectory must satisfy the kinematic constraint: dy/dx = tan(theta) at every point

In the Frenet frame, this constraint is automatically enforced as long as the generated trajectory satisfies the curvature bound. The Frenet decomposition naturally respects the non-holonomic nature because lateral displacement d changes only through heading adjustments relative to the reference path.

### 11.6 Filtering Trajectories by Ackermann Feasibility

After generating candidate trajectories, each is checked at every discretized timestep:

```
for each timestep t_k:
    compute kappa(t_k) from the trajectory
    if |kappa(t_k)| > kappa_max:
        REJECT trajectory
    if |kappa(t_k) - kappa(t_{k-1})| / dt > kappa_dot_max:
        REJECT trajectory
```

This ensures every selected trajectory can actually be executed by the vehicle's steering mechanism.

---

## 12. Synthesis: From Mathematics to Implementation

### 12.1 The Mathematical Chain

The complete trajectory planning pipeline connects these mathematical foundations:

```
Differential Geometry (Frenet-Serret)
        |
        v
Curvilinear Coordinates (s, d decomposition)
        |
        v
Calculus of Variations (jerk-optimal = quintic polynomial)
        |
        v
Sampling-Based Optimization (420 candidates)
        |
        v
Cost Function Evaluation (jerk + time + deviation)
        |
        v
Feasibility Filtering (Ackermann curvature, collision)
        |
        v
Path Tracking Control (Stanley controller)
```

### 12.2 Why This Architecture Works

1. **Frenet decomposition** reduces a 2D planning problem to two 1D problems, cutting computational complexity from O(n^2) to O(2n)
2. **Quintic polynomials** have closed-form solutions, enabling all 420 candidates to be computed in <1 ms
3. **Sampling** avoids the pitfalls of local optimization (no gradient computation, no convergence issues)
4. **The cost function** is a simple weighted sum, trivially evaluable
5. **Collision checking** with SAT is O(1) per polygon pair
6. **The Stanley controller** provides robust tracking with provable stability

The result is a trajectory planner that runs comfortably in real-time (typically 5--20 ms per planning cycle at 10 Hz), generates smooth, comfortable trajectories, and handles dynamic environments through replanning.

---

## Sources

- [Werling et al. 2010 - Optimal Trajectory Generation (IEEE)](https://ieeexplore.ieee.org/document/5509799/)
- [Werling et al. 2010 - Paper PDF (Semantic Scholar)](https://www.semanticscholar.org/paper/Optimal-trajectory-generation-for-dynamic-street-in-Werling-Ziegler/6bda8fc13bda8cffb3bb426a73ce5c12cc0a1760)
- [Werling et al. 2012 - Discretized Terminal Manifolds (IJRR)](https://journals.sagepub.com/doi/abs/10.1177/0278364911423042)
- [Frenet-Serret Formulas (Wolfram MathWorld)](https://mathworld.wolfram.com/FrenetFormulas.html)
- [Trajectory Planning in the Frenet Space (Robotics Knowledgebase)](https://roboticsknowledgebase.com/wiki/planning/frenet-frame-planning/)
- [Frenet Frame Path Planning (Chen Peng)](https://caseypen.github.io/posts/2021/01/FrenetFrame/)
- [Kinematic Bicycle Model (Algorithms for Automated Driving)](https://thomasfermi.github.io/Algorithms-for-Automated-Driving/Control/BicycleModel.html)
- [Stanley Controller Derivation (Hoffmann et al., Stanford)](https://ai.stanford.edu/~gabeh/papers/hoffmann_stanley_control07.pdf)
- [Stanley Controller (Self-Driving Cars Course)](https://github.com/qiaoxu123/Self-Driving-Cars/blob/master/Part1-Introduction_to_Self-Driving_Cars/Module6-Vehicle_Lateral_Control/module-6-vehicle-lateral-control.md)
- [PythonRobotics Frenet Optimal Trajectory (AtsushiSakai)](https://github.com/AtsushiSakai/PythonRobotics/blob/master/PathPlanning/FrenetOptimalTrajectory/frenet_optimal_trajectory.py)
- [MATLAB trajectoryOptimalFrenet](https://www.mathworks.com/help/nav/ref/trajectoryoptimalfrenet.html)
- [Quintic Polynomial Solver (Udacity/Werling)](https://github.com/ChenBohan/Robotics-Path-Planning-04-Quintic-Polynomial-Solver)
- [Quintic Polynomial Trajectory Planning (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11679464/)
- [Ackermann Steering Geometry (Wikipedia)](https://en.wikipedia.org/wiki/Ackermann_steering_geometry)
- [Frenet Coordinate Transformer (GitHub)](https://github.com/fjp/frenet)
- [Swept Volume Collision Detection (RSS 2013)](https://www.roboticsproceedings.org/rss09/p31.pdf)
- [Separating Axis Theorem (dyn4j)](https://dyn4j.org/2010/01/sat/)
- [Path Planning Implementation (Udacity)](https://pabaq.github.io/projects/udacity/self-driving-car/2021/07/28/Path-Planning.html)
