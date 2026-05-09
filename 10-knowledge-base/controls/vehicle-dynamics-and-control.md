# Vehicle Dynamics and Control Fundamentals

Planning decides where the vehicle should go. Control makes that motion happen
through tires, motors, brakes, steering actuators, hydraulics, and software
limits. The planner-controller boundary is where latency, saturation, slip,
comfort, and safety constraints become real.

This page covers the vehicle models and control methods needed to turn
trajectories into executable commands for road AVs, indoor AMRs, outdoor
industrial vehicles, and airport ground vehicles.

---

## 1. AV, Indoor, Outdoor, and Airside Relevance

| Domain | Dynamics/control concern | Example |
|---|---|---|
| Road AV | Higher speeds, tire slip, lane tracking, comfort, actuator delay, fail-operational steering/braking. | MPC tracks a 10 Hz trajectory while compensating steering delay and curvature limits. |
| Indoor AMR / forklift | Low-speed nonholonomic motion, reversing, payload changes, tight docking, safety-rated stops. | A forklift with load changes its braking distance and rear-swing envelope. |
| Outdoor yard / mine / campus | Uneven ground, tire-soil interaction, dust/rain, heavy vehicles, grade, limited friction. | A yard tractor slips on wet painted markings and must reduce speed and curvature. |
| Airside AV | Low-speed precision near aircraft, wet tarmac, jet-blast zones, stand entry, mixed GSE traffic, strict passenger/crew comfort. | A baggage tractor must track a stand approach path smoothly while preserving emergency-stop margin. |

---

## 2. Model Hierarchy

| Model | State detail | Best use | Limit |
|---|---|---|---|
| Point mass | position, velocity, acceleration | Speed planning, rough feasibility, comfort envelopes. | No heading, steering, or nonholonomic constraint. |
| Unicycle | `x, y, yaw, v` | Simple mobile robots and early planning. | Does not represent Ackermann steering geometry. |
| Kinematic bicycle | rear/front axle pose, steering angle, speed | Low-to-moderate-speed path tracking and trajectory feasibility. | Ignores tire slip and load transfer. |
| Dynamic bicycle | lateral velocity, yaw rate, tire forces | Higher-speed control and friction-limited maneuvers. | Needs tire parameters and accurate velocity/slip estimation. |
| Double-track / multibody | four wheels, suspension, load transfer | High-fidelity simulation, validation, extreme maneuvers. | Too complex for most real-time control loops. |
| Learned residual model | model error correction | Compensates delay, tire/terrain effects, payload. | Must be bounded and monitored for safety. |

Use the simplest model that captures the dominant risk at the operating speed
and surface. Airside baggage tractors and indoor AMRs are often low speed, but
payload, wet surfaces, reversing, and docking precision still make model
selection important.

---

## 3. Kinematic Bicycle Model

For an Ackermann-steered vehicle with wheelbase `L`, speed `v`, steering angle
`delta`, and heading `theta`:

```
x_dot     = v * cos(theta)
y_dot     = v * sin(theta)
theta_dot = v * tan(delta) / L
v_dot     = a
```

Curvature is:

```
kappa = tan(delta) / L
delta = atan(L * kappa)
```

Physical steering limits become curvature limits:

```
|delta| <= delta_max
|kappa| <= tan(delta_max) / L
```

Steering actuator limits also impose curvature-rate limits:

```
|delta_dot| <= delta_dot_max
```

This model is usually sufficient for:

- low-speed airside and warehouse vehicles
- Frenet trajectory feasibility checks
- pure pursuit, Stanley, LQR, and many MPC controllers
- simulation smoke tests

It becomes weak when side slip, high lateral acceleration, rough terrain, or
heavy load transfer dominate.

---

## 4. Dynamic Bicycle Model

The dynamic bicycle model adds lateral velocity and yaw-rate dynamics. A common
state is:

```
[x, y, yaw, v_x, v_y, r]
```

where:

- `v_x`: longitudinal velocity in body frame
- `v_y`: lateral velocity in body frame
- `r`: yaw rate

Approximate tire slip angles:

```
alpha_f = delta - atan((v_y + l_f * r) / v_x)
alpha_r =       - atan((v_y - l_r * r) / v_x)
```

Linear tire model:

```
F_yf = C_f * alpha_f
F_yr = C_r * alpha_r
```

Yaw and lateral dynamics:

```
m * (v_y_dot + v_x * r) = F_yf + F_yr
I_z * r_dot             = l_f * F_yf - l_r * F_yr
```

The dynamic model exposes risks hidden by the kinematic model:

- tire saturation
- sideslip
- understeer/oversteer
- payload and center-of-gravity changes
- friction-circle limits

At low speeds, the equations can become numerically sensitive because `v_x`
appears in denominators. Controllers need low-speed handling rather than
blindly applying high-speed dynamic equations near zero velocity.

---

## 5. Actuator and Interface Realities

### 5.1 Command Types

| Command | Typical interface | Hidden complexity |
|---|---|---|
| steering angle | radians or steering wheel angle | steering ratio, offset, slew limit, backlash, calibration. |
| steering rate | radians/s | actuator delay and saturation. |
| acceleration | m/s^2 target | maps to throttle/brake differently by speed, slope, payload. |
| throttle/brake | normalized or torque request | actuator nonlinearity, deadband, regen blending. |
| gear/direction | forward, reverse, neutral | planner must understand nonholonomic reverse motion. |
| emergency stop | safety input or brake command | stopping distance and jerk must be modeled separately from nominal control. |

### 5.2 Delay

A simple delay model:

```
u_applied(t) = u_commanded(t - tau)
```

Delays come from perception, planning, middleware, control, DBW, hydraulics,
brake pressure build-up, and steering mechanics. A controller that ignores
delay will oscillate or cut corners as speed rises.

Practical mitigations:

- timestamp all trajectories and states
- predict vehicle state to actuation time
- include delay in MPC state or command buffer
- identify delay from step-response tests
- set speed limits based on worst-case latency

---

## 6. Controller Families

| Controller | Use | Strength | Risk |
|---|---|---|---|
| PID | longitudinal speed, simple steering loops | Easy to implement and tune. | Windup and poor constraint handling. |
| Pure pursuit | geometric path tracking | Robust and simple at low speed. | Cuts corners; lookahead tuning is speed-dependent. |
| Stanley | lateral path tracking | Handles cross-track and heading error with speed scaling. | Needs low-speed softening and steering saturation handling. |
| LQR | linearized tracking around trajectory | Good stability and efficient compute. | Local validity depends on model and linearization. |
| MPC | constrained multivariable tracking | Handles curvature, acceleration, jerk, delay, and actuator limits. | Requires model quality and solver timing guarantees. |
| iLQR / DDP | nonlinear trajectory optimization/control | Efficient for smooth nonlinear systems. | Constraint handling and warm starts need care. |
| MPPI | sampling-based stochastic control | Handles nonlinear costs and rough models. | Compute and stochastic variability. |
| Safety filter / CBF-QP | last-line constraint enforcement | Enforces safety set over nominal commands. | Feasibility and false interventions must be validated. |

### 6.1 Lateral and Longitudinal Coupling

Even if a stack has separate lateral and longitudinal controllers, the vehicle
does not. Curvature limits speed through lateral acceleration:

```
a_lat = v^2 * |kappa|
v_max = sqrt(a_lat_max / |kappa|)
```

The speed planner must slow down before high curvature, poor friction, docking,
crowds, or uncertain localization. Otherwise the lateral controller is asked to
track an infeasible path.

---

## 7. Practical Deployment Notes

### 7.1 Identification Checklist

Measure or estimate:

- wheelbase and track width
- vehicle reference point
- steering ratio, offset, maximum angle, and maximum rate
- throttle/brake delay and deadband
- maximum acceleration, deceleration, and jerk
- tire/friction assumptions for dry, wet, icy, painted, dusty, or oily surfaces
- loaded vs unloaded mass and center of gravity
- reverse-driving behavior
- controller compute and communication latency

### 7.2 Controller Interface Contract

A trajectory handed to control should include:

- timestamp and frame
- pose, velocity, acceleration, curvature, and optionally curvature rate
- allowed speed and acceleration envelopes
- stop point and emergency fallback point
- validity horizon
- covariance or confidence where available

The controller should report:

- tracking error
- command saturation
- delay estimate
- actuation fault state
- degraded-mode reason
- predicted stopping distance

### 7.3 Airside and Industrial Policy

For airport and industrial vehicles, conservative control policy is usually
more valuable than high dynamic performance:

- cap speed near aircraft, personnel, open holds, baggage carts, and stands
- reduce curvature and jerk on wet or contaminated pavement
- preserve safe-stop energy and braking margin
- use separate docking controllers for final centimeters
- require manual/service checks after actuator saturation or repeated tracking faults

---

## 8. Failure Modes and Risks

| Failure mode | Symptom | Mitigation |
|---|---|---|
| Planner outputs infeasible curvature | Controller saturates steering and cuts path. | Check curvature, curvature rate, and minimum turning radius in planning. |
| Actuator delay ignored | Oscillation, overshoot, or corner cutting. | Identify delay and compensate in state prediction or MPC. |
| Tire slip / low friction | Vehicle understeers, oversteers, or braking distance grows. | Estimate friction, reduce speed, monitor yaw-rate residuals. |
| Integral windup | Longitudinal controller overshoots after saturation. | Anti-windup, saturation-aware PID, or MPC. |
| Low-speed singularity | Dynamic or Stanley-style terms divide by near-zero speed. | Add low-speed modes, softening terms, or geometric docking controllers. |
| Payload change | Braking and steering response change. | Include load state or conservative envelopes. |
| Reverse/crab mode mismatch | Controller assumes forward Ackermann motion. | Explicit mode in state and trajectory contract. |
| Bad localization velocity | Controller chases noisy state estimates. | Filter velocity, validate timestamping, and gate degraded state. |
| Solver overrun | MPC command arrives late or stale. | WCET monitoring, fallback controller, bounded iterations. |
| Safety filter infeasible | Last-line controller cannot find a safe command. | Design reachable fallback states and stop before constraints become impossible. |

---

## Related Repository Documents

- [Frenet-Frame Trajectory Planning](frenet-trajectory-math.md)
- [Planning Taxonomy and Trajectory Generation](../robotics/planning-taxonomy-and-trajectory-generation.md)
- [Bayesian Filtering and ESKF](../state-estimation/bayesian-filtering-and-eskf.md)
- [Coordinate Frames, Projections, and SE(3)](../geometry-3d/coordinate-frames-projections-se3.md)
- [Frenet Planner Augmentation](../../30-autonomy-stack/planning/frenet-planner-augmentation.md)
- [Autonomous Docking and Precision Positioning](../../30-autonomy-stack/planning/autonomous-docking-precision-positioning.md)
- [Safety-Critical Planning with CBFs](../../30-autonomy-stack/planning/safety-critical-planning-cbf.md)
- [Drive-by-Wire CAN Bus](../../20-av-platform/drive-by-wire/can-bus-dbw.md)

---

## Sources

- Paden et al., "A Survey of Motion Planning and Control Techniques for Self-driving Urban Vehicles": https://arxiv.org/abs/1604.07446
- Hoffmann et al., "Autonomous Automobile Trajectory Tracking for Off-Road Driving: Controller Design, Experimental Validation and Racing": https://ai.stanford.edu/~gabeh/papers/hoffmann_stanley_control07.pdf
- Autoware trajectory follower node documentation: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_trajectory_follower_node/
- Autoware smart MPC trajectory follower documentation: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_smart_mpc_trajectory_follower/
- Autoware MPC lateral controller documentation: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_mpc_lateral_controller/
- SAE paper page, "A Survey of Vehicle Dynamics Models for Autonomous Driving": https://saemobilus.sae.org/papers/a-survey-vehicle-dynamics-models-autonomous-driving-2024-01-2325
- Kong, Pfeiffer, Schildbach, and Borrelli, "Kinematic and Dynamic Vehicle Models for Autonomous Driving Control Design": https://borrelli.me.berkeley.edu/pdfpub/IV_KinematicMPC_jason.pdf
- Rajamani, "Vehicle Dynamics and Control" publisher page: https://link.springer.com/book/10.1007/978-1-4614-1433-9
- PythonRobotics path tracking examples: https://github.com/AtsushiSakai/PythonRobotics
- Control barrier function survey: https://arxiv.org/abs/1903.11199
