# Trajectory Tracking Control

> **Purpose**: Map the boundary between planning and control for autonomous vehicles, covering nominal path/trajectory tracking, vehicle dynamics models, controller families, safety filters, and deployment tests for indoor, outdoor, and airside operations.
>
> **Key Takeaway**: A planner is only deployable if its trajectory can be tracked under actuator delay, saturation, tire slip, localization noise, payload variation, degraded surfaces, and emergency fallback. Airside vehicles should treat tracking control as a safety-critical subsystem with its own metrics, fault injection, and Simplex-compatible fallback, not as a generic PID afterthought.
>
> **Research current as of:** 2026-05-09

---

## Problem Framing

Planning answers "where and when should the vehicle go?" Control answers "what steering, throttle, brake, and gear commands make the vehicle actually do that?" The interface looks simple: a trajectory of poses, velocities, accelerations, and timestamps. In deployment, this is where most physical assumptions become visible.

For airside vehicles, the control problem is dominated by low-speed precision, frequent stop-and-go operation, tight turning near aircraft, heavy or changing payloads, hydraulic/electric actuator delay, wet apron surfaces, GNSS/localization covariance, and the need for predictable comfortable motion around workers. Tracking error is not just a comfort issue: a 0.5 m lateral miss can be acceptable on a wide road and unacceptable near a cargo door, belt loader, or aircraft safety envelope.

The controller should therefore be evaluated as part of the autonomy stack:

- Can it track nominal trajectories within clearance margins?
- Does it expose when a planned trajectory is not physically trackable?
- Does it degrade safely under delay, saturation, model mismatch, low friction, or actuator faults?
- Does the safety monitor know when to slow, replan, switch controllers, or stop?

---

## Method and Architecture Taxonomy

### Planner-Control Interface

```text
Planner output
  -> time-indexed trajectory: pose, heading, velocity, acceleration, curvature
  -> semantic tags: stop point, yield point, docking phase, reverse phase, no-go margin
  -> feasibility envelope: max curvature, speed, acceleration, jerk, tracking margin

Controller input
  -> trajectory
  -> current state estimate and covariance
  -> vehicle dynamics parameters
  -> actuator state and health
  -> surface / payload / ODD mode

Controller output
  -> steering, throttle/brake, gear, optional control horizon
  -> predicted tracking rollout
  -> health and confidence flags
```

Autoware's trajectory follower pattern is a useful production reference: lateral control can be MPC or pure pursuit, longitudinal control is typically PID, and debug topics expose predicted trajectories and errors. Airside deployments should preserve this observability and add domain-specific stop, docking, and low-speed reverse metrics.

### Vehicle Models

| Model | Use | Strength | Limit |
|---|---|---|---|
| Kinematic bicycle | Low-speed path tracking and planning feasibility | Simple, interpretable, fast | Ignores tire slip, load transfer, actuator dynamics |
| Dynamic bicycle | Higher speed, low-friction, payload-sensitive control | Captures lateral dynamics and slip | Needs tire/cornering parameters and careful identification |
| Actuator-delay model | Steering/brake/throttle lag compensation | Directly addresses deployment mismatch | Must be measured per platform and maintained |
| Learned residual model | Corrects systematic model error | Useful for buses, tugs, heavy payloads, worn actuators | Needs bounded use and fallback |
| Full multibody / tire model | Offline simulation, edge cases, certification evidence | High fidelity | Too expensive and parameter-sensitive for normal control loop |

### Controller Families

| Controller | Best Fit | Deployment Notes |
|---|---|---|
| PID / cruise control | Longitudinal speed and stop-point tracking | Needs feedforward, anti-windup, saturation handling, and grade/load compensation |
| Pure pursuit | Simple low-speed lateral tracking | Stable and easy to tune; can cut corners and oscillate if lookahead is wrong |
| Stanley | Cross-track plus heading correction | Good for lane/path tracking; gain scheduling needed at very low speed |
| LQR | Linearized tracking around a reference | Transparent and fast; sensitive to model validity |
| MPC / NMPC | Constraint-aware tracking with actuator limits | Best general-purpose controller when compute and model quality are sufficient |
| MPPI / sampling MPC | Nonlinear and nonconvex costs, multiple constraints | Useful for difficult dynamics; sampling count and GPU budget matter |
| iLQR / smart MPC | Fast trajectory optimization with learned residuals | Attractive for vehicles whose true dynamics differ from nominal |
| CBF / safety filter | Last-mile invariant safety constraint enforcement | Should sit around or below nominal control, not replace planning |
| Simplex tracking | High-performance controller plus verified baseline | Lets learned/adaptive control run while a high-assurance fallback remains available |

### Nominal Airside Stack

```text
Behavior / motion planner
  -> trajectory validator
  -> MPC or pure-pursuit + PID nominal controller
  -> CBF / collision and envelope safety filter
  -> command gate / DBW interface
  -> actuator health monitor
  -> controller evaluator
  -> planner feedback: trackable, degraded, stop, replan
```

A practical starting point for low-speed airside vehicles is MPC lateral control plus PID longitudinal control, with pure pursuit as a simple fallback and CBF/Simplex monitoring for safety-critical envelopes. Smart MPC or learned residuals are useful after collecting enough platform-specific data to identify actuator delay, payload effects, and surface-dependent slip.

---

## Evaluation and Deployment Notes

### Metrics

| Category | Metrics |
|---|---|
| Accuracy | lateral error, heading error, speed error, stop-point error, docking final pose error |
| Stability | oscillation, overshoot, settling time, sign changes in steering, recovery after disturbance |
| Comfort | longitudinal/lateral acceleration, jerk, yaw rate, steering-rate limits |
| Feasibility | curvature limit violations, acceleration/brake saturation, reverse/gear transition correctness |
| Safety | minimum clearance after tracking error, CBF interventions, emergency stop distance, watchdog trips |
| Robustness | score under delay, low friction, payload change, localization covariance, actuator derate |
| Operations | controller faults per hour, degraded-mode time, manual takeover / remote assistance triggers |

### Test Matrix

1. **SIL regression**: replay planned trajectories through a vehicle model with injected delay/noise.
2. **Controller-in-the-loop**: run the real control node against simulated odometry and actuator dynamics.
3. **HIL/DBW bench**: verify command timing, saturation, watchdogs, command gate, and fault flags.
4. **Closed-course tests**: straight, curve, S-curve, stop line, docking, reverse, wet surface, payload variants.
5. **Airside supervised tests**: stand approach, service-road turns, hold-short stops, interaction with human-driven GSE.

For each release, the planner should be checked against the controller envelope. A trajectory that requires curvature, acceleration, jerk, or stop accuracy outside the controller's validated envelope should be rejected before actuation.

### Deployment Practices

- Identify steering, brake, and throttle delay from bag data and re-check after maintenance.
- Use timestamp provenance and controller deadlines; stale trajectory or odometry should trigger controlled stop.
- Keep lateral and longitudinal controllers synchronized; mismatched command ages can produce unsafe combined motion.
- Log planned trajectory, executed trajectory, actuator commands, saturations, and controller state on every run.
- Separate "planner unsafe" from "controller unable to track" in incident root-cause labels.
- Tune by ODD mode: indoor dock, outdoor yard, apron transit, stand approach, reverse docking, degraded weather.
- Add command-gate limits for max speed, steering rate, acceleration, deceleration, and jerk by zone.

---

## Indoor / Outdoor / Airside Fit

| Domain | Fit | Controller Emphasis |
|---|---|---|
| Indoor AMR / forklift | Very high | Low-speed precision, pallet/load stability, tight aisle turns, certified safety scanner stops |
| Outdoor industrial yard | Very high | Trailer/payload variation, uneven surfaces, GNSS covariance, rain/snow traction |
| Public-road AV | High | Higher-speed lateral stability, lane keeping, traffic speed control, comfort |
| Airside apron | Very high | Stand clearance, repeated stop-go, aircraft proximity, wet apron, ground crew comfort |
| Movement area / runway-adjacent | High with strict gates | Stop-line accuracy, authority-dependent speed caps, default safe stop on command uncertainty |

Airside control is forgiving in speed but unforgiving in geometry. Low speed creates time for validation and fallback, but the clearance envelope near aircraft, equipment, and personnel makes tracking-error budgets smaller than they appear from road-AV intuition.

---

## Failure Modes

| Failure Mode | Symptom | Mitigation |
|---|---|---|
| Actuator delay not modeled | Overshoot at stop points, corner cutting, late braking | Delay identification, feedforward, MPC delay compensation |
| Saturation ignored | Controller cannot achieve planned curvature or deceleration | Planner-controller envelope check and command limiting |
| Localization covariance spike | Controller chases noisy pose or diverges near buildings | Covariance-aware gains, speed reduction, fallback localization policy |
| Low-friction apron | ABS/traction events, lateral slip, longer stopping distance | Surface mode, friction estimation, inflated braking margins |
| Payload / tow change | Understeer, slow acceleration, poor stop accuracy | Payload-aware parameters, adaptive/residual model with bounds |
| Reverse or docking mode bugs | Wrong sign on steering, poor final alignment | Dedicated low-speed reverse controller and mode-specific tests |
| Controller fights safety filter | Oscillation between nominal command and safety override | Explicit priority architecture and post-filter predicted rollout |
| Planner emits untrackable trajectory | High controller effort, repeated replans, emergency stop | Feasibility validation before trajectory acceptance |
| Stale input data | Commands based on old trajectory or odometry | Timestamp checks, timeout thresholds, controlled stop |
| Learned controller out of distribution | Smooth behavior in training set, unsafe in rare cases | Simplex architecture, ODD monitor, high-assurance fallback |

---

## Related Repo Docs

- [Bicycle Kinematic Model](../../20-av-platform/drive-by-wire/bicycle-kinematic-model.md)
- [Frenet Trajectory Math](../../10-knowledge-base/controls/frenet-trajectory-math.md)
- [Frenet Planner Augmentation](frenet-planner-augmentation.md)
- [Safety-Critical Planning with CBFs](safety-critical-planning-cbf.md)
- [Simplex Architecture, Safety, and Shadow Mode](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md)
- [ROS 2 Migration](../../40-runtime-systems/ros-autoware/ros2-migration.md)
- [CAN Bus and Drive-by-Wire](../../20-av-platform/drive-by-wire/can-bus-dbw.md)
- [Airside Closed-Loop Planning Benchmark](airside-closed-loop-planning-benchmark.md)
- [Autonomous Docking and Precision Positioning](autonomous-docking-precision-positioning.md)

---

## Sources

- Autoware Universe, Trajectory Follower Nodes: https://autowarefoundation.github.io/autoware_universe/pr-10077/control/autoware_trajectory_follower_node/
- Autoware Universe, Smart MPC Trajectory Follower: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_smart_mpc_trajectory_follower/
- Autoware IV, MPC follower description: https://tier4.github.io/autoware.iv/tree/main/control/mpc_follower/
- Autoware.Auto, Pure Pursuit nodes: https://autowareauto.readthedocs.io/en/release/pure-pursuit-nodes.html
- Towards Safe Path Tracking Using the Simplex Architecture: https://arxiv.org/abs/2503.10559
- A Comprehensive Survey of PID and Pure Pursuit Control Algorithms for Autonomous Vehicle Navigation: https://arxiv.org/abs/2409.09848
- A Parameter Adaptive Trajectory Tracking and Motion Control Framework for Autonomous Vehicle: https://arxiv.org/abs/2411.17745
- Robust Trajectory Tracking Error Model-Based Predictive Control for Unmanned Ground Vehicles: https://arxiv.org/abs/2103.16782
- Time-Optimal Trajectory Planning and Tracking for Autonomous Vehicles, Sensors 2024: https://www.mdpi.com/1424-8220/24/11/3281
- Model predictive approach to integrated path planning and tracking for autonomous vehicles: https://arxiv.org/abs/1905.03444
