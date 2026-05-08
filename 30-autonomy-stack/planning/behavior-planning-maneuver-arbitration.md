# Behavior Planning and Maneuver Arbitration

> **Purpose**: Define the tactical planning layer that converts mission goals, maps, traffic rules, operational instructions, V2X, prediction, and fallback policy into maneuvers that a motion planner and controller can execute.
>
> **Key Takeaway**: Behavior planning is the layer that prevents a route follower from becoming unsafe or operationally naive. It must arbitrate between progress, yielding, stopping, avoiding, rerouting, docking, remote approval, V2X advice, and safe fallback. For airside AVs, this layer must encode airport authority and task state as first-class inputs, not only road-style lane-change and obstacle-avoidance logic.
>
> **Research current as of:** 2026-05-09

---

## Problem Framing

An autonomous vehicle route says "go to Stand B7." A motion planner can generate a smooth path along a lane or reference line. Neither is enough to decide whether the vehicle should yield to a pushback tug, wait for ramp-control clearance, pass a stopped baggage cart, hold outside a jet-blast polygon, pull over for an emergency vehicle, or abort a docking approach because tracking error is too high.

Behavior planning is the tactical decision layer between route/mission planning and trajectory generation. Its output should be more than a path: it should include maneuver intent, drivable area, stop/yield decisions, approval requirements, and reasoning tags that downstream validation and operators can inspect.

For airside deployments, behavior arbitration has to combine:

- Static rules: airport driving rules, speed zones, stand boundaries, hold-short rules.
- Dynamic authority: A-CDM milestones, ramp-control instructions, movement-area clearance, NOTAMs.
- Scene state: aircraft, GSE, personnel, FOD, de-icing zones, blocked service roads.
- Prediction and interaction: whether nearby agents are yielding, crossing, docking, or pushing back.
- System state: localization confidence, V2X health, controller trackability, degraded modes.

---

## Method and Architecture Taxonomy

### Tactical Maneuver Set

| Maneuver | Road Analogue | Airside / Industrial Extension |
|---|---|---|
| Lane / corridor follow | Lane keeping | Service-road, taxi-lane-adjacent, warehouse aisle following |
| Stop / hold | Stop line, red light | Hold-short line, stand-access gate, clearance timeout |
| Yield / proceed | Intersection negotiation | Aircraft always priority, pushback priority, emergency GSE |
| Avoid / pass | Obstacle avoidance | Pass parked loader only if stand envelope and task zone allow |
| Lane change / side shift | Lane change | Shift within wide apron corridor or around temporary closure |
| Pull over / clear lane | Shoulder pull-over | Clear stand before pushback or emergency route |
| Pull out / merge | Parking departure | Leave staging bay, charger, hangar, or stand pocket |
| Dock / precision approach | Parking | Belt loader, tug, dolly, charging, aircraft-service-point approach |
| Reverse / multi-point maneuver | Parking reverse | Tight stand repositioning and tug/dolly alignment |
| Convoy / follow | Car following | Follow-me vehicle, tug convoy, baggage-cart train |
| Abort / safe stop | Minimum-risk maneuver | Loss of clearance, V2X trust failure, controller infeasibility |

### Arbitration Architectures

| Architecture | Pattern | Strength | Limit |
|---|---|---|---|
| FSM / scenario-stage-task | Explicit scenario states and transitions | Auditable, deterministic, common in production stacks | State explosion and brittle corner cases |
| Behavior tree | Prioritized modular behaviors | Good for safety overrides and fallback logic | Needs careful priority design to avoid starvation |
| Rule engine | Feasible behavior set plus resolution policy | Explainable and field-tunable | Rule conflicts and hidden interactions accumulate |
| Utility / cost arbitration | Score candidate maneuvers by safety, progress, comfort, priority | Smooth tradeoffs and easy ranking | Hard constraints must be separated from soft costs |
| Optimization-based integrated behavior/control | Solve maneuver and motion together under rules | Fewer interface mismatches | More complex, harder to certify and debug |
| Game-theoretic / joint prediction-planning | Models mutual influence between agents | Better at negotiation and dense interactions | Compute and data demand, unclear guarantees |
| Learned / LLM/VLM behavior planner | Uses data and commonsense reasoning for long-tail decisions | Flexible and interpretable when aligned to decision states | Needs constrained output space and safety monitor |
| Simplex / dual-stack arbitration | Advanced behavior source plus conservative baseline | Practical path to deploy learned modules | Requires a correct monitor and clear switching semantics |

### Reference Module Boundary

Autoware's planning architecture is a useful reference decomposition:

```text
Mission planner
  -> route
Scenario planner
  -> behavior planner: path, drivable area, turn signals, planning factors
  -> motion planner: time-parameterized trajectory
Validation
  -> safety-checked trajectory
Control
  -> actuator commands
```

For airside, add an operational authority adapter and a degraded-mode policy:

```text
A-CDM / AODB / ramp control / NOTAM / V2X
  -> authority and task-state model
  -> behavior arbitration
  -> maneuver intent + constraints
  -> trajectory generation
  -> validation and command gate
```

### Decision Inputs and Outputs

| Interface | Required Content |
|---|---|
| Inputs from route / mission | destination, route corridor, task type, deadline, priority |
| Inputs from map | lanelets/corridors, stand polygons, speed zones, no-go zones, hold lines |
| Inputs from perception / prediction | dynamic objects, tracks, predicted occupancy, occlusion zones, uncertainty |
| Inputs from operations | flight phase, stand status, clearances, NOTAMs, emergency priority |
| Inputs from V2X | status, intent, cooperative perception, maneuver requests/advice |
| Inputs from system health | localization confidence, controller envelope, DBW health, connectivity |
| Outputs to motion planner | selected maneuver, path/drivable area, target stop/yield points, speed caps |
| Outputs to validation / HMI | planning factors, approval requests, reason for stop, fallback state |

---

## Evaluation and Deployment Notes

Behavior planning should be evaluated with scenario labels, not only trajectory metrics. A trajectory can be smooth and collision-free while making the wrong tactical choice.

Recommended metrics:

- **Decision correctness**: expected maneuver class, stop/yield/proceed decision, clear/hold response.
- **Rule compliance**: speed zone, hold-short, stand access, aircraft priority, temporary closure compliance.
- **Safety**: collision-free, TTC margin, clearance envelope, no unsafe occlusion entry.
- **Progress**: route completion, unnecessary stop count, blocked-zone time, deadlock/livelock rate.
- **Explainability**: reason tags match actual decision inputs; operator can diagnose "why stopped."
- **Stability**: no rapid oscillation between proceed/stop, avoid/follow, or route alternatives.
- **Fallback**: correct transition to degraded speed, safe stop, remote approval, or reroute.

Deployment should start with a conservative module set:

1. Rule-based lane/corridor following, stop/hold, speed-zone, obstacle avoidance, and clear-stand behaviors.
2. Reservation-aware behavior for service-road pinch points, connected to the fleet traffic manager.
3. V2X intent consumption as advisory first, then agreement-seeking once trust and timing are validated.
4. Learned or LLM/VLM behavior suggestions only inside a constrained action vocabulary and behind a safety monitor.
5. Shadow-mode behavior comparison against human, production, or conservative baseline decisions before activation.

Behavior modules should publish planning factors for every stop, yield, reroute, and failed maneuver candidate. This is essential for remote operations and safety-case evidence.

---

## Indoor / Outdoor / Airside Fit

| Domain | Fit | Behavior-Specific Notes |
|---|---|---|
| Indoor warehouse / factory | Very high | Aisle right-of-way, pedestrian zones, forklift/load constraints, WMS task priority |
| Outdoor yard / depot | Very high | Trailer lanes, gate queues, blocked roads, private-road speed zones, teleoperation fallback |
| Public road | High | Lane change, intersection, crosswalk, traffic light, pull-over, emergency vehicle handling |
| Airside apron | Very high | Stand sequencing, aircraft priority, pushback, jet blast, FOD, clearance and ramp-control state |
| Movement area | High with strict authority | Default-deny hold-short logic and explicit clearance TTL must dominate progress |

Airside behavior planning is closer to industrial operations than public-road driving in one respect: the planner can rely on bounded maps, fleet identity, task schedules, and a controlling authority. It is harder in another respect: the rule source is multi-layered and operationally dynamic.

---

## Failure Modes

| Failure Mode | Symptom | Mitigation |
|---|---|---|
| Rule conflict | Planner alternates between incompatible modules | Priority hierarchy, hard-vs-soft constraint separation, conflict logging |
| State explosion | FSM cannot cover mixed stand, service-road, and emergency cases | Behavior tree or rule engine with modular predicates |
| Overconservative stop | Vehicle freezes in dense ramp activity | Interaction-aware prediction, courtesy/yield timers, traffic manager reservations |
| Unsafe assertiveness | Planner proceeds through ambiguous right-of-way | Default-deny for authority-critical zones, clearance TTL, safety gates |
| V2X advice overtrusted | Vehicle follows stale or malicious maneuver advice | Trust scoring, freshness checks, cross-check with onboard perception and map |
| Learned behavior hallucination | LLM/VLM emits unrecognized or unsafe action | Constrained action/state vocabulary, validator, Simplex fallback |
| Untrackable maneuver | Behavior selects a maneuver beyond controller envelope | Feasibility query to motion planner/controller before approval |
| Operator opacity | Remote operator cannot understand why vehicle stopped | Planning factors, event replay, reason codes |
| Local optimum deadlock | Pairwise yielding blocks a service road | Fleet-level reservation and deadlock prevention layer |
| Airport-specific procedure mismatch | Behavior is legal at one airport and wrong at another | Site-specific rule packs, map overlays, and approval workflow |

---

## Related Repo Docs

- [Airside Closed-Loop Planning Benchmark](airside-closed-loop-planning-benchmark.md)
- [Joint Prediction-Planning](joint-prediction-planning.md)
- [Motion Prediction](motion-prediction.md)
- [Neural Motion Planning](neural-motion-planning.md)
- [LLM Reasoning Planning](llm-reasoning-planning.md)
- [Safety-Critical Planning with CBFs](safety-critical-planning-cbf.md)
- [Ramp Traffic Conflict Detection and Deadlock Prevention](../multi-agent-v2x/ramp-traffic-conflict-deadlock-prevention.md)
- [V2X Cooperative Planning](../multi-agent-v2x/v2x-cooperative-planning.md)
- [Ground Control Instruction Understanding](../../70-operations-domains/airside/operations/ground-control-instructions.md)
- [Turnaround Prediction](../../70-operations-domains/airside/operations/turnaround-prediction.md)
- [Simplex Architecture, Safety, and Shadow Mode](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md)

---

## Sources

- Autoware Planning Component Design: https://tier4.github.io/autoware-documentation/latest/design/autoware-architecture/planning/
- Autoware Universe, Behavior Path Planner: https://autowarefoundation.github.io/autoware_universe/main/planning/behavior_path_planner/autoware_behavior_path_planner/
- Autoware IV, Behavior Velocity Planner: https://tier4.github.io/autoware.iv/tree/main/planning/scenario_planning/lane_driving/behavior_planning/behavior_velocity_planner/
- Apollo planning module class architecture: https://daobook.github.io/apollo/docs/specs/Class_Architecture_Planning.html
- A Rule-Based Behaviour Planner for Autonomous Driving: https://arxiv.org/abs/2407.00460
- PlanAgent: A Multi-modal Large Language Agent for Closed-loop Vehicle Motion Planning: https://arxiv.org/abs/2406.01587
- DriveMLM: aligning multi-modal large language models with behavioral planning states for autonomous driving: https://link.springer.com/article/10.1007/s44267-025-00095-w
- Integrated Behavior Planning and Motion Control for Autonomous Vehicles with Traffic Rules Compliance: https://arxiv.org/abs/2304.01041
- Motion Planning for Autonomous Driving: The State of the Art and Future Perspectives: https://arxiv.org/abs/2303.09824
- FAA AC 150/5210-20A, Ground Vehicle Operations to include Taxiing or Towing an Aircraft on Airports: https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.information/documentID/1028089
