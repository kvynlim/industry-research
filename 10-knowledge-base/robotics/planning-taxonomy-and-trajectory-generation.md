# Planning Taxonomy and Trajectory Generation

Autonomous planning is a layered decision pipeline. Different stacks use
different names, but the same responsibilities keep appearing: choose a route,
choose a maneuver, generate feasible motion, assign speed over time, validate
safety, and hand an executable trajectory to control.

This page provides shared vocabulary for road AVs, indoor robots, outdoor
industrial vehicles, and airport airside autonomy.

---

## 1. AV, Indoor, Outdoor, and Airside Relevance

| Domain | Planning emphasis | Example |
|---|---|---|
| Road AV | Route graph, traffic rules, lane changes, merges, intersections, comfort, prediction-aware motion. | Behavior planner selects yield/creep/turn while motion planner produces a collision-free trajectory. |
| Indoor AMR / forklift | Warehouse graph, aisle constraints, pallet/dock interaction, pedestrian safety, fleet traffic management. | Planner reserves a narrow aisle and generates a reverse docking trajectory. |
| Outdoor yard / mine / campus | Large site routes, trailer/container/task constraints, uneven surfaces, mixed manual/autonomous traffic. | Yard tractor chooses a trailer move route and slows for blind corners and poor GNSS. |
| Airside AV | Stands, service roads, taxiway crossings, aircraft priority, jet-blast/FOD zones, ground-control instructions. | Vehicle routes from baggage hall to stand, yields to aircraft movement, and enters a docking controller near the aircraft. |

---

## 2. Layered Planning Vocabulary

| Layer | Question answered | Typical input | Typical output | Rate |
|---|---|---|---|---|
| Mission / task planning | What job should this vehicle do? | fleet requests, schedule, operator commands | task assignment and goal | seconds to minutes |
| Route planning | Which corridor or graph path reaches the goal? | HD map, routing graph, closures, traffic rules | route or lane/area sequence | 0.1-1 Hz |
| Behavior planning | What maneuver should happen now? | route, scene, prediction, rules, right-of-way | maneuver state and constraints | 1-10 Hz |
| Motion planning | What geometric path or trajectory avoids obstacles? | behavior goal, drivable area, obstacles | candidate path or trajectory | 5-20 Hz |
| Speed planning | How fast along the path? | curvature, obstacles, comfort, signals, stop lines | velocity/acceleration profile | 5-20 Hz |
| Trajectory validation | Is the plan safe and executable? | trajectory, predictions, vehicle limits, monitors | approved trajectory or fallback | every plan cycle |
| Control | What actuator command follows it? | trajectory and vehicle state | steering, throttle, brake | 20-100 Hz |

The boundaries are not universal. Some systems combine behavior and motion in
MPC. Learned planners may output trajectories directly. The interface contract
still needs to make these responsibilities explicit.

---

## 3. Route and Map-Level Planning

Route planning operates over a graph:

```
nodes/edges = lanes, lanelets, areas, aisles, zones, docking approach segments
costs       = distance, time, lane change, closure, congestion, risk, energy
constraints = vehicle type, one-way rules, clearance, access, ODD state
```

For road and airside applications, Lanelet2-style maps split physical geometry
from traffic/routing interpretation. For warehouses and yards, the graph may
be built from aisles, staging zones, charging stations, trailer bays, and
one-way operational rules.

Route output should not be just a polyline. It should preserve semantic context:

- lane or area IDs
- regulatory elements and stop/yield lines
- speed zones
- keepout zones
- docking or handoff waypoints
- closure and temporary restriction metadata

---

## 4. Behavior Planning

Behavior planning turns route intent and world state into maneuver intent.

Common behavior states:

- lane follow / corridor follow
- stop at line or goal
- yield / creep / proceed
- lane change or aisle change
- overtake or pass obstacle
- merge
- reverse
- dock / undock
- pull over / minimal-risk condition
- wait for clearance

Behavior planning must arbitrate between:

- traffic or site rules
- predicted agent motion
- operator or ground-control instructions
- fleet coordination reservations
- ODD restrictions
- fallback and safety policies

For airside autonomy, behavior planning should explicitly encode aircraft
priority, stand-entry rules, runway/taxiway clearance boundaries, jet-blast
keepouts, FOD zones, marshalling/ground-control instructions, and mixed GSE
right-of-way policy.

---

## 5. Motion Planning Families

| Family | Examples | Strength | Risk |
|---|---|---|---|
| Graph search | A*, Dijkstra, hybrid A* | Reliable over maps and grids; easy to debug. | Resolution and heuristic quality affect smoothness and compute. |
| State lattice | motion primitives, lattice planners | Enforces vehicle kinematics by construction. | Primitive library must cover required maneuvers. |
| Sampling-based | RRT, RRT*, PRM | Handles high-dimensional spaces and complex constraints. | Output may need smoothing; narrow passages can be hard. |
| Optimization-based | quadratic programming, nonlinear programming, MPC | Directly handles smoothness and constraints. | Needs good initialization and solver timing bounds. |
| Frenet polynomial | quintic/quartic lateral-longitudinal candidates | Efficient for lane/corridor following. | Depends on a valid reference path and projection. |
| Kinodynamic planning | hybrid A*, trajectory rollout, reachability | Accounts for dynamics and controls. | More compute and modeling effort. |
| Learned/generative | diffusion, imitation, RL, VLA trajectory heads | Can capture human-like interactions and multimodality. | Requires safety envelope, validation, and OOD monitoring. |

Most production-style systems are hybrids: route graph plus behavior state
machine plus motion optimization or lattice/Frenet candidates plus independent
trajectory validation.

---

## 6. Trajectory Generation

### 6.1 Path, Speed, and Trajectory

Definitions:

```
path:       geometric curve, usually x(s), y(s), yaw(s), kappa(s)
speed plan: velocity and acceleration as a function of time or arc length
trajectory: time-parameterized state sequence x(t), y(t), yaw(t), v(t), a(t)
```

A controller needs a trajectory, not merely a path. A path without timing does
not tell the vehicle when to brake, how to respect jerk limits, or how to handle
moving obstacles.

### 6.2 Common Representations

| Representation | Use |
|---|---|
| piecewise linear path | simple route and low-speed initial plans |
| clothoid / curvature-continuous path | road-like steering comfort |
| cubic or quintic splines | smooth interpolation and path smoothing |
| quintic polynomial | boundary-conditioned position/velocity/acceleration trajectory |
| quartic polynomial | velocity keeping with free terminal position |
| Bezier / B-spline | compact smooth curves with control points |
| discrete trajectory samples | controller interface and validation |

### 6.3 Frenet-Style Candidate Generation

For corridor-following, a common pattern is:

1. Project current state onto reference path.
2. Sample target lateral offsets, speeds, and time horizons.
3. Generate lateral and longitudinal polynomial candidates.
4. Convert candidates back to Cartesian coordinates.
5. Reject candidates that violate collision, curvature, acceleration, jerk, or route boundaries.
6. Choose the lowest-cost feasible trajectory.

This is fast and interpretable, but it needs a good reference path and can
struggle with open areas, unstructured aprons, tight docking, and complex
multi-agent negotiation unless augmented.

### 6.4 Speed Planning

Speed planning enforces:

- speed limits and advisory speeds
- stop lines and goal stops
- predicted obstacle interactions
- curvature-limited speed
- comfort acceleration and jerk
- degraded-mode speed caps
- safe-stop distance

Curvature-limited speed:

```
v_max(s) = sqrt(a_lat_max / max(|kappa(s)|, epsilon))
```

For airside and industrial operations, speed should also depend on personnel
proximity, aircraft proximity, load state, surface condition, visibility, and
local site policy.

---

## 7. Trajectory Validation and Runtime Assurance

Every candidate trajectory should be checked against at least:

| Check | What it protects |
|---|---|
| collision and swept volume | static and predicted obstacles |
| drivable area / lane / zone boundaries | map and ODD compliance |
| curvature and curvature rate | steering feasibility |
| velocity, acceleration, jerk | comfort and actuator limits |
| stopping distance | safe fallback margin |
| time validity | stale plans and delayed state |
| rule compliance | stop/yield/clearance/one-way restrictions |
| localization and perception uncertainty | risk margins under uncertainty |
| controller feasibility | tracking limits and command saturation |

Validation should produce a reason when it rejects a plan. That reason is
needed for debugging, operator trust, fleet analytics, and safety-case evidence.

---

## 8. Practical Deployment Notes

### 8.1 Interface Contract

A planner output should include:

- frame and timestamp
- trajectory points with pose, velocity, acceleration, curvature
- route/lane/zone IDs used
- maneuver state
- obstacle assumptions and prediction horizon
- validity duration
- fallback trajectory or stop point
- planner status and rejection reasons

### 8.2 Replanning Policy

Use separate horizons:

- long route/task horizon: seconds to minutes
- behavior horizon: several seconds
- motion horizon: 3-10 seconds for many vehicles, shorter for tight indoor/docking
- control horizon: immediate actuation window

Avoid mode oscillation by using hysteresis, commitment windows, and explicit
abort conditions for maneuvers such as lane changes, merges, docking, and
clearance-required crossings.

### 8.3 Domain-Specific Notes

| Domain | Deployment note |
|---|---|
| Road AV | Use map semantics and prediction uncertainty to avoid behavior oscillation at merges/intersections. |
| Indoor AMR | Model one-way aisles, human work zones, narrow-passage reservations, and docking handoff. |
| Outdoor industrial | Include terrain, grade, traction, dust/weather, trailer swing, and fleet traffic rules. |
| Airside | Treat aircraft and clearance boundaries as first-class constraints, not just obstacles. Keep stand docking separate from corridor following. |

---

## 9. Failure Modes and Risks

| Failure mode | Symptom | Mitigation |
|---|---|---|
| Layer mismatch | Route says proceed, behavior says yield, motion planner oscillates. | Define ownership and priority between route, behavior, motion, and safety layers. |
| Infeasible trajectory | Controller saturates or cannot track. | Validate curvature, acceleration, jerk, delay, and actuator limits before control. |
| Cost-weight brittleness | Planner chooses uncomfortable or risky paths after small tuning changes. | Use hard constraints for safety and regression tests for cost changes. |
| Reference path dependency | Frenet planner fails in open aprons, yards, docks, or unstructured zones. | Switch to area planners, lattice/hybrid A*, or docking-specific planners. |
| Stale map or closure | Route enters blocked or newly restricted area. | Use map versioning, dynamic overlays, and route invalidation. |
| Prediction overconfidence | Planner cuts through an agent's plausible future path. | Use calibrated prediction uncertainty and contingency/fallback planning. |
| Mode oscillation | Vehicle creeps, stops, creeps, or toggles lane-change decisions. | Add hysteresis, commitment, and clear abort criteria. |
| Learned planner OOD | End-to-end model proposes plausible but invalid motion. | Keep rule, feasibility, and safety validation outside the learned proposal. |
| Late plan | Controller tracks stale trajectory. | Timestamp plans, enforce age limits, and provide fallback stop trajectories. |

---

## Related Repository Documents

- [Lanelet2 Map Representation](lanelet2-maps.md)
- [Frenet-Frame Trajectory Planning](../controls/frenet-trajectory-math.md)
- [Vehicle Dynamics and Control](../controls/vehicle-dynamics-and-control.md)
- [Coordinate Frames, Projections, and SE(3)](../geometry-3d/coordinate-frames-projections-se3.md)
- [Frenet Planner Augmentation](../../30-autonomy-stack/planning/frenet-planner-augmentation.md)
- [Neural Motion Planning](../../30-autonomy-stack/planning/neural-motion-planning.md)
- [Joint Prediction and Planning](../../30-autonomy-stack/planning/joint-prediction-planning.md)
- [Safety-Critical Planning with CBFs](../../30-autonomy-stack/planning/safety-critical-planning-cbf.md)
- [Autonomous Docking and Precision Positioning](../../30-autonomy-stack/planning/autonomous-docking-precision-positioning.md)
- [Ramp Traffic Conflict and Deadlock Prevention](../../30-autonomy-stack/multi-agent-v2x/ramp-traffic-conflict-deadlock-prevention.md)

---

## Sources

- Autoware planning architecture: https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture/planning/
- TIER IV Autoware planning architecture: https://tier4.github.io/autoware-documentation/latest/design/autoware-architecture/planning/
- Paden et al., "A Survey of Motion Planning and Control Techniques for Self-driving Urban Vehicles": https://arxiv.org/abs/1604.07446
- Werling et al., "Optimal Trajectory Generation for Dynamic Street Scenarios in a Frenet Frame": https://ieeexplore.ieee.org/document/5509799/
- LaValle, "Planning Algorithms": https://lavalle.pl/planning/
- OMPL documentation: https://ompl.kavrakilab.org/
- Lanelet2 paper, "A high-definition map framework for the future of automated driving": https://ieeexplore.ieee.org/document/8569929
- Lanelet2 routing documentation: https://github.com/fzi-forschungszentrum-informatik/Lanelet2/tree/master/lanelet2_routing
- CommonRoad drivability checker and planning ecosystem: https://commonroad.in.tum.de/
- Survey entry from P0 backlog, arXiv 2402.01443: https://arxiv.org/abs/2402.01443
