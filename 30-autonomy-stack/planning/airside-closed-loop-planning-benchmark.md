# Airside Closed-Loop Planning Benchmark and Metrics

> **Purpose**: Define a planning benchmark for autonomous vehicles that operate in airport airside environments, with metrics that capture safety, rule compliance, progress, comfort, throughput, and deployability. The focus is the planning stack from behavior decision through trajectory generation, not only perception accuracy or open-loop imitation.
>
> **Key Takeaway**: Airside planning cannot be validated with L2 trajectory error alone. A useful benchmark must replay realistic stand, apron, service-road, and movement-area scenarios in closed loop, score binary safety gates before weighted performance metrics, and expose failure modes that matter to airport operators: aircraft contact, personnel proximity, hold-short violations, jet-blast/no-go-zone entry, blocked turnaround flow, and uncomfortable or untrackable trajectories.
>
> **Research current as of:** 2026-05-09

---

## Problem Framing

Road-driving benchmarks such as nuPlan, NAVSIM, and Bench2Drive moved planning evaluation away from static open-loop imitation toward simulation-based scoring. That shift is directly relevant to airside autonomy: a planner can match human trajectories in logs while still deadlocking at a baggage-road pinch point, crossing a hold-short line without clearance, or producing a trajectory that the controller cannot track around an aircraft stand.

The airside gap is domain-specific, not just data-volume-specific. Airport vehicles operate at lower speed than road AVs, but the environment contains large aircraft footprints, tight stand clearances, task sequencing constraints, ground crew, GSE with unusual kinematics, ramp-control instructions, FOD, jet blast, de-icing zones, and movement-area authority rules. A closed-loop benchmark therefore needs to model operational state and rule authority alongside geometry.

The target benchmark should answer four questions:

1. Can the planner complete the mission without violating hard safety or authority constraints?
2. Does it make progress without causing avoidable stand or service-road blockage?
3. Are trajectories smooth and trackable by the vehicle controller under delay and saturation?
4. Does performance degrade predictably when perception, map, V2X, weather, or actor behavior is imperfect?

---

## Method and Architecture Taxonomy

### Evaluation Modes

| Mode | What It Measures | Strength | Limit |
|---|---|---|---|
| Open-loop log replay | Distance from expert trajectory, rule labels, comfort from planned path | Fast, cheap, useful for imitation training regression tests | Does not reveal compounding errors or agent reactions |
| Pseudo closed loop | Ego plan is unrolled against logged or non-reactive actors, NAVSIM-style | Scalable over real logs, lower sim gap than synthetic-only | Other actors do not react to ego mistakes |
| Reactive closed-loop simulation | Ego and actors interact in a simulator or digital twin | Reveals deadlock, yielding, blocking, and recovery behavior | Requires credible actor models and calibrated maps |
| Scenario / fault injection | Hand-authored or generated rare cases such as FOD, emergency vehicle priority, V2X dropout | Covers safety-critical long tail | Easy to overfit if scenario set is small |
| HIL / test-track replay | Controller, DBW, timing, and compute stack run against simulated or controlled physical scenarios | Catches actuator and latency problems | Lower throughput and higher operating cost |

### Airside Scenario Suite

The benchmark should use short, scenario-focused routes rather than only long aggregate missions. Bench2Drive's short-route design is a better pattern than a single long "airport lap" because it separates abilities and reduces score variance.

| Scenario Family | Examples | Primary Stress |
|---|---|---|
| Stand approach and docking | Belt loader or tug approaches aircraft service zone | Precision, clearance envelopes, low-speed control |
| Stand exit and clear-out | GSE clears before TOBT / pushback | Task progress, schedule constraints, right-of-way |
| Pushback interaction | Autonomous vehicle yields to tug and aircraft tail sweep | Large dynamic obstacle geometry, priority rules |
| Service-road routing | Narrow bidirectional service roads and one-vehicle pinch points | Deadlock prevention, reservation compliance |
| Hold-short and movement-area access | Vehicle approaches taxiway/runway hold line | Default-deny authority, clearance expiry |
| Occluded pedestrian/GSE | Worker or tug emerges from behind aircraft or loader | Prediction, cautious progress, V2X/infrastructure value |
| FOD / spill / jet-blast zone | Planner must avoid or stop before invisible or semantic hazards | Hazard-map and V2X integration |
| Emergency priority | Rescue vehicle or ramp-control override interrupts mission | Arbitration, replanning, fail-safe behavior |
| Adverse conditions | Rain, night, glare, low visibility, wet apron, GNSS multipath | ODD boundaries and degradation policy |

### Metric Stack

Use hard safety gates first, then weighted performance. A high progress score should never compensate for aircraft contact or unauthorized movement-area entry.

| Metric Layer | Example Metrics | Notes |
|---|---|---|
| Safety gates | No aircraft contact, no personnel collision, no GSE collision, no runway/taxiway incursion, no jet-blast/no-go-zone entry | Binary or severity-gated multipliers |
| Authority and rule compliance | Hold-short compliance, clearance TTL, speed zones, stand-access permissions, A-CDM/ramp-control state | Must be evaluated against time-stamped operational truth |
| Progress and mission success | Route completion, task completion, missed deadline, turnaround blocking time | Score per scenario family and aggregate |
| Interaction quality | Unnecessary stops, deadlock/livelock, courtesy/yield correctness, predicted TTC margins | Critical for dense ramp operations |
| Comfort and trackability | Longitudinal/lateral acceleration, jerk, yaw rate, curvature continuity, controller tracking error | Planned path and executed path should both be scored |
| Robustness | Score under sensor delay, map drift, V2X dropout, actor model mismatch, weather, localization covariance | Report as degradation curves, not only one number |
| Operations | Intervention rate, remote-assistance calls, safe-stop rate, recovery time, blocked-zone occupancy | Bridges benchmark results to deployment readiness |

### Reference Architecture

```text
Scenario definition
  -> map and operational truth
  -> actors, aircraft state, GSE tasks, V2X messages, weather, faults
  -> planner API
  -> closed-loop simulator / pseudo simulator / HIL runner
  -> executed trajectory and event log
  -> safety gates
  -> weighted planning metrics
  -> root-cause tags and replay bundle
```

The planner API should accept perception/tracking outputs, localization state, map context, mission route, authority state, and V2X/infrastructure messages. It should output a trajectory plus semantic intent: maneuver class, reason for stops, drivable area, expected yielding agents, and fallback state. Those annotations make failures diagnosable and align with Autoware's planning-factor concept.

---

## Evaluation and Deployment Notes

The first benchmark release should avoid claiming "airside autonomy solved." It should be a deployment gate and a regression harness. A practical thresholding approach is:

1. **Developer gate**: thousands of pseudo-closed-loop log snippets, quick enough for nightly CI.
2. **Release gate**: curated reactive simulation suite with fixed seeds plus randomized variants.
3. **Site gate**: airport-specific map, routes, stand layouts, procedures, and weather/lighting profiles.
4. **Operational gate**: supervised dry runs, shadow-mode comparison to human or production stack, then constrained autonomous missions.

Scenario files need stable identifiers and versioned ground truth. Each failure should produce a replay bundle containing inputs, planned trajectory, executed trajectory, controller commands, map version, V2X messages, random seeds, and metric breakdown. Without this, benchmark scores become unactionable.

Recommended reporting:

- Report score by scenario family, not just one aggregate number.
- Publish safety-gate pass rates separately from performance scores.
- Include confidence intervals across seeds and randomized actor policies.
- Track "planner caused stop" vs. "safety monitor caused stop" vs. "controller could not track".
- Keep a hidden site-specific set to prevent overfitting.
- Add new scenarios from every real incident, near miss, remote-assistance call, and blocked-mission replay.

The metric design should reuse proven road-driving ideas where possible: NAVSIM's PDMS/EPDMS style of hard multipliers plus progress/TTC/comfort terms, Bench2Drive's short-route success and driving-score protocol, and nuPlan's reactive closed-loop simulation philosophy. The airside additions are aircraft geometry, airport authority state, apron task state, and operations-level blockage metrics.

---

## Indoor / Outdoor / Airside Fit

| Domain | Fit | Adaptation |
|---|---|---|
| Indoor warehouse / factory | High for low-speed AMRs and forklifts | Replace aircraft and ramp rules with aisle, dock-door, pedestrian-zone, WMS, and load-stability constraints |
| Outdoor yards / depots | High | Reuse service-road, blocked-route, trailer/container, GNSS, weather, and teleoperation metrics |
| Public-road AV | Medium | Road benchmarks already exist; this framework is useful mainly for industrial/private-road ODDs |
| Airside apron and stand | Very high | Primary target: aircraft separation, pushback priority, stand sequencing, A-CDM/A-SMGCS/ramp-control context |
| Movement area / runway-adjacent | High but stricter | Requires default-deny authority, tower/ramp clearance truth, runway-incursion severity scoring, and regulator-reviewed test cases |

Airside is unusually benchmark-friendly because the airport is a bounded, mapped, single-operator environment. It is also benchmark-risky because rare failures have severe consequences and local procedures differ across airports. The benchmark therefore needs site adapters rather than a single universal score.

---

## Failure Modes

| Failure Mode | Why It Matters | Mitigation in Benchmark |
|---|---|---|
| Open-loop overconfidence | Low L2 error hides closed-loop collapse | Require closed-loop and pseudo-closed-loop scores |
| Non-reactive actor optimism | Logged actors do not respond to ego blocking or creeping | Include reactive actor models and adversarial yield/non-yield variants |
| Aircraft geometry simplification | Bounding boxes miss wingtip, tail sweep, engine intake, and jet blast zones | Use aircraft-specific swept volumes and semantic hazard polygons |
| Rule-truth mismatch | Planner appears wrong because benchmark does not encode the actual clearance state | Version A-CDM, ramp-control, NOTAM, and hold-short authority data |
| Controller-blind scoring | Planner emits a path that is mathematically safe but physically untrackable | Score executed trajectory and controller tracking error |
| Map and zone drift | Construction, stand reconfiguration, or temporary closures invalidate truth | Include map versioning and dynamic restrictions |
| V2X dependence without fallback | Planner succeeds only when cooperative messages are perfect | Inject packet loss, latency, stale messages, bad actors, and total dropout |
| Scenario overfitting | Teams tune to a fixed scenario list | Use hidden scenarios, random seeds, procedural variants, and incident-derived additions |
| Missing operations metrics | Planner is safe but blocks turnaround flow | Score blocked-zone time, mission lateness, deadlock, and remote-assistance rate |

---

## Related Repo Docs

- [Evaluation Benchmarks](../../60-safety-validation/verification-validation/evaluation-benchmarks.md)
- [Airside Scenario Taxonomy](../../60-safety-validation/verification-validation/airside-scenario-taxonomy.md)
- [Simulators for Airside](../simulation/simulators-for-airside.md)
- [Airport Digital Twins](../simulation/airport-digital-twins.md)
- [Sim-to-Real Transfer Airside](../simulation/sim-to-real-transfer-airside.md)
- [Frenet Planner Augmentation](frenet-planner-augmentation.md)
- [Joint Prediction-Planning](joint-prediction-planning.md)
- [Safety-Critical Planning with CBFs](safety-critical-planning-cbf.md)
- [Ramp Traffic Conflict Detection and Deadlock Prevention](../multi-agent-v2x/ramp-traffic-conflict-deadlock-prevention.md)
- [Ground Control Instruction Understanding](../../70-operations-domains/airside/operations/ground-control-instructions.md)
- [FOD and Jetblast](../../70-operations-domains/airside/operations/fod-and-jetblast.md)

---

## Sources

- NAVSIM: Data-Driven Non-Reactive Autonomous Vehicle Simulation and Benchmarking, NeurIPS 2024: https://research.nvidia.com/labs/avg/publication/dauner.hallgarten.etal.neurips2024/
- NAVSIM metrics documentation: https://github.com/autonomousvision/navsim/blob/main/docs/metrics.md
- NAVSIM arXiv paper: https://arxiv.org/abs/2406.15349
- Bench2Drive: Towards Multi-Ability Benchmarking of Closed-Loop End-To-End Autonomous Driving: https://arxiv.org/abs/2406.03877
- nuPlan: A closed-loop ML-based planning benchmark for autonomous vehicles: https://arxiv.org/abs/2106.11810
- Towards learning-based planning: The nuPlan benchmark for real-world autonomous driving: https://arxiv.org/abs/2403.04133
- Bench2Drive-R: Turning Real World Data into Reactive Closed-Loop Autonomous Driving Benchmark by Generative Model: https://arxiv.org/abs/2412.09647
- FAA, Autonomous Ground Vehicle Systems on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA AC 150/5210-20A, Ground Vehicle Operations to include Taxiing or Towing an Aircraft on Airports: https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.information/documentID/1028089
- IATA Ground Support Equipment program: https://www.iata.org/en/programs/ops-infra/ground-operations/ground-support-equipment/
- Airport Ground Support Equipment Analysis Data, NREL / DOE Data Explorer: https://www.osti.gov/dataexplorer/biblio/dataset/2575705
- Integrated optimization of scheduling for unmanned follow-me cars on airport surface, Scientific Reports 2024: https://www.nature.com/articles/s41598-024-58918-7
- Detection and Control Framework for Unpiloted Ground Support Equipment within the Aircraft Stand, Sensors 2024: https://www.mdpi.com/1424-8220/24/1/205
- CAST Vehicle Ground Handling simulation software: https://arc.de/cast-simulation-software/cast-vehicle-ground-handling/
