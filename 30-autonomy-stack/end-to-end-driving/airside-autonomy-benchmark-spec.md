# Airside Autonomy Benchmark and Dataset Specification

> **Key Takeaway:** Airside autonomy needs its own benchmark. Road datasets and indoor AMR benchmarks do not cover aircraft priority, apron geometry, ground support equipment, stand operations, jet blast, FOD, marshalling, A-SMGCS context, or airport sponsor approval constraints. The practical benchmark should combine logged multi-sensor data, NAVSIM-style pseudo-simulation, closed-loop digital-twin routes, and controlled real-world evidence.

---

## Scope and Goal

This specification defines a benchmark for autonomous ground vehicle systems operating on airport airside surfaces: aprons, stands, service roads, cargo areas, baggage routes, de-icing zones, and controlled crossings near taxiways. It is intended for generic autonomy stacks, not only one vehicle type.

Target vehicles:

- Baggage tractors and autonomous dollies.
- Cargo tugs and ULD movers.
- Follow-me, inspection, FOD retrieval, and perimeter vehicles.
- Autonomous service vehicles operating around aircraft stands.
- Low-speed passenger or crew shuttles in restricted airside zones.

The benchmark should measure full autonomy behavior, not only perception. It must support modular stacks, end-to-end driving policies, VLA planners, cooperative V2X policies, and world-model-based planners through a common route/task interface.

---

## Benchmark Taxonomy

### Evaluation Tiers

| Tier | Name | Purpose | Execution mode |
|---|---|---|---|
| T0 | Dataset quality and coverage audit | Check sensor sync, labels, scenario balance, map validity | Offline |
| T1 | Component evaluation | Perception, tracking, occupancy, prediction, VLM reasoning | Offline |
| T2 | Logged trajectory evaluation | NAVSIM-style path scoring on real missions | Offline/non-reactive |
| T3 | Pseudo-simulation | Perturb ego endpoint and render/score nearby observations | Offline/pseudo-closed-loop |
| T4 | Closed-loop digital twin | Interactive route and scenario simulation | Simulator |
| T5 | Shadow-mode replay | Run model on real vehicle logs without control authority | On-vehicle/offline replay |
| T6 | Controlled-site operational test | Safety-driver or monitor-backed airport test | Real-world evidence |

### Task Families

| Task family | Examples | Required metrics |
|---|---|---|
| Route transit | Depot to stand, stand to cargo, service-road loop | Progress, speed limits, route adherence, smoothness |
| Stand approach | Approach aircraft stand with active GSE and personnel | Aircraft clearance, stand zone compliance, personnel safety |
| Pushback interaction | Yield to pushback, cross after clearance, follow tow path | Aircraft priority, swept-volume avoidance, clearance state |
| GSE sequencing | Merge with baggage trains, pass belt loader, convoy with tugs | Deadlock, right-of-way, gap acceptance, V2X intent use |
| FOD encounter | Detect, avoid, report, or retrieve debris | FOD recall, false alarm, stop/reroute correctness |
| Jet blast and engine hazards | Avoid active blast zones and engine intake zones | Hazard-zone compliance, fallback if no engine-state message |
| Communication-dependent operation | A-SMGCS/ramp-control instruction, V2X task update, link loss | Default-deny behavior, stale-message rejection, fallback |
| Adverse conditions | Rain, glare, night, fog, wet apron, de-icing residue | Robustness deltas and ODD state transitions |

### Data Modalities

| Modality | Required? | Notes |
|---|---|---|
| Surround cameras | Required | At least 6 views for E2E/VLA and inspection tasks |
| 3D LiDAR | Required | Metric obstacle and aircraft geometry |
| 4D radar | Strongly recommended | Weather/night fallback and Doppler velocity |
| IMU/GNSS/RTK | Required | Pose, speed, and localization provenance |
| Wheel odometry / steering / actuator state | Required | Control and tracking diagnostics |
| V2X messages | Required for cooperative tracks | CAM-like awareness, task assignment, clearance, stand status, jet blast, FOD |
| Airport operational feeds | Recommended | AODB/A-CDM/A-SMGCS, stand assignment, aircraft movement status |
| Maps | Required | Lanelet2 or airport graph plus AMDB-style surfaces, stands, zones, speed limits |

---

## Dataset Schema

### Scene Record

Each scenario clip should include:

- `scenario_id`, `airport_id`, `stand_or_zone_id`, and `route_id`.
- ODD metadata: weather, visibility, lighting, surface condition, construction/de-icing state.
- Sensor packets with original timestamps and clock-domain provenance.
- Ego state and control state at sensor and control rates.
- Map version and geofence/zone version.
- V2X and airport-system messages with publish, receive, and consume timestamps.
- Ground-truth annotations or derived labels.
- Safety monitor events and human intervention markers.

### Required Labels

| Label type | Contents |
|---|---|
| 3D object boxes/tracks | Aircraft, GSE, road vehicles, personnel, FOD, cones/barriers, jetbridge, static equipment |
| Semantic occupancy | Drivable apron, stand safety envelope, no-go zone, aircraft swept area, jet blast zone, unknown/occluded |
| Map elements | Service roads, hold lines, stand markings, taxiway boundaries, crossings, parking/staging zones |
| Agent intent/state | Aircraft parked/taxi/pushback, GSE loading/unloading/reversing, personnel walking/marshalling |
| Event labels | Clearance granted/revoked, pushback start, FOD detected, intervention, e-stop, network loss |
| VLM/VLA QA labels | Safety-relevant scene questions, rule questions, instruction-following labels |

### Splits

| Split | Purpose | Anti-leakage rule |
|---|---|---|
| `train_normal` | Model training on routine operations | Exclude hard safety events |
| `train_augmented` | Synthetic and replay perturbations | Mark synthetic provenance explicitly |
| `val_site_seen` | Routine validation at known airport/site | No overlap by route/time clip |
| `val_site_unseen` | Generalization to new stands or airport areas | Hold out stands/zones |
| `test_public` | Public reproducibility | Limited edge cases, fixed evaluator |
| `test_private` | Leaderboard overfitting guard | Hidden routes and event mix |
| `test_safety_hard` | Release gating | Withheld high-severity events and rare weather |

---

## Metric Taxonomy

### Composite Airside PDM Score

An airside PDM-style score should multiply hard safety gates by weighted quality scores:

```
AirsideScore = SafetyGatesProduct * WeightedQualityScore
```

Hard safety gates:

- No aircraft contact.
- No personnel collision.
- No GSE/static-object collision.
- No entry into active jet blast or engine intake zone.
- No unauthorized hold-short/taxiway/runway-area crossing.
- No stand safety-envelope violation.
- No unsafe response to communication loss or stale clearance.

Weighted quality scores:

- Task progress and route completion.
- Aircraft/personnel/GSE clearance margins.
- Comfort and payload stability.
- Speed compliance by zone.
- Rule compliance and right-of-way.
- Operational efficiency, including avoidable delay and deadlock.
- V2X usage correctness when available.

### Component Metrics

| Component | Metrics |
|---|---|
| Perception | mAP/NDS-style object detection, per-class recall, FOD recall, personnel recall under occlusion |
| Occupancy | Semantic IoU, free-space precision, unknown-space calibration, future occupancy IoU |
| Tracking | MOTA/HOTA/ID switches, velocity error, track latency |
| Prediction | minADE/minFDE, brier-minFDE, occupancy flow error, swept-volume miss rate |
| Planning | Collision rate, progress, comfort, rule compliance, intervention rate |
| V2X | Deadline miss rate, stale-message rejection, pose/time alignment error, fallback correctness |
| VLM/VLA | Visual grounding, hallucination rate, text-only leakage, corruption robustness, action validity |

---

## Relevance by Domain

### Generic AV

The benchmark creates a reusable pattern for non-road autonomy: scenario-driven evaluation with operational rules, not only lane-following. It can inform robotaxi depots, industrial campuses, ports, and private roads.

### Indoor Autonomy

Indoor AMR and forklift benchmarks can borrow the task-progress, near-field personnel, communication-loss, and facility-map governance patterns. Replace aircraft/stand concepts with dock doors, aisles, pallets, and WMS tasks.

### Outdoor Industrial Autonomy

Logistics yards, ports, mining roads, construction sites, and campuses share low-to-medium speed operation, mixed manual/autonomous traffic, private maps, and central dispatch. Airside evaluation patterns transfer well to their route/task scoring.

### Airside Autonomy

This is the primary domain. Airside operations need explicit modeling of aircraft, turnaround state, right-of-way, ramp-control instructions, FOD, jet blast, and no-go zones. These are not optional edge cases; they are core operating constraints.

---

## Implementation Notes

### Minimum Viable Benchmark

Start with:

- 50 to 100 hours of synchronized camera, LiDAR, radar, GNSS/IMU, odometry, and V2X logs from one controlled airside area.
- 20 scenario types, each with at least 10 real examples or high-fidelity digital-twin variants.
- A baseline modular stack and one E2E/VLA baseline.
- NAVSIM-style offline trajectory scoring.
- A closed-loop digital-twin evaluator for 5 to 10 interaction-heavy scenarios.

### Recommended Architecture

```
Raw logs + maps + V2X messages
  -> data validation and synchronization audit
  -> scenario mining and tagging
  -> component labels and derived occupancy
  -> logged replay evaluator
  -> pseudo-simulation renderer
  -> closed-loop digital twin
  -> benchmark report and evidence package
```

### Evaluation Protocol

1. Validate clock sync and transforms before any model score is accepted.
2. Run vehicle-only baseline first.
3. Run modular autonomy baseline second.
4. Run E2E/VLA/world-model submissions through the same route/task interface.
5. Report aggregate score and per-scenario breakdown.
6. Keep all safety-gate failures visible even when the composite score is high.
7. Publish model input assumptions: sensors, maps, V2X, privileged labels, and external data.

### Evidence Artifacts

Each evaluation run should emit:

- Scenario manifest and map version.
- Model version, config, weights, and input modalities.
- Metric JSON and human-readable summary.
- Failure clips and event timeline.
- Sensor/V2X latency histogram.
- Safety monitor state and intervention records.
- ODD assumptions and exclusions.

---

## Failure Modes

| Failure mode | Benchmark risk | Control |
|---|---|---|
| Road benchmark transfer overclaims | Strong NAVSIM/Bench2Drive result is mistaken for airside readiness | Require airside-specific scenario gates |
| Label sparsity for FOD/personnel | Small objects and occluded workers are underrepresented | Oversample safety-hard scenarios and use targeted annotation |
| Synthetic-domain bias | Digital twin makes policies overfit clean textures or scripted agents | Mix real logs, neural reconstructions, and domain-randomized variants |
| Overreliance on V2X | Model behaves unsafely when messages are delayed or missing | Include V2X-loss and stale-message tests |
| Stop-to-win | Model avoids infractions by excessive stopping | Add task progress and operational delay metrics |
| Hidden map leakage | Model sees future route, clearance, or labels unavailable at runtime | Enforce input-modality declarations and evaluator audits |
| Poor clock/transform provenance | Cooperative and multi-sensor scores are invalid | Reject runs with sync/transform QA failures |
| Aggregate metric masking | Aircraft or personnel failures are hidden by high route completion | Safety-gate failures must be reported separately |

---

## Related Repo Docs

| Document | Relevance |
|---|---|
| [Evaluation Benchmarks: NAVSIM and Bench2Drive](evaluation-benchmarks-navsim-bench2drive.md) | Method sources for pseudo-sim and closed-loop scoring |
| [Airside Scenario Taxonomy](../../60-safety-validation/verification-validation/airside-scenario-taxonomy.md) | Scenario library seed |
| [Evaluation Methods and Metrics](../../60-safety-validation/verification-validation/evaluation-benchmarks.md) | General metrics background |
| [Simulators for Airside](../simulation/simulators-for-airside.md) | Candidate simulator stack |
| [Neural Simulation Platforms](../simulation/neural-simulation-platforms.md) | Neural reconstruction and generative sim |
| [Airport Digital Twins](../simulation/airport-digital-twins.md) | Airside digital-twin context |
| [V2X Protocols Airside](../multi-agent-v2x/v2x-protocols-airside.md) | Cooperative message and fallback requirements |
| [Cooperative V2X E2E Driving](cooperative-v2x-e2e-driving.md) | Cooperative benchmark track |
| [VLM/VLA Reliability Benchmarks](../vla-vlm/vlm-vla-reliability-benchmarks.md) | Language reasoning and hallucination tests |
| [Failure Modes Analysis](../../60-safety-validation/safety-case/failure-modes-analysis.md) | Safety evidence and failure taxonomy context |

---

## Sources

- [FAA CertAlert 24-02: Autonomous Ground Vehicle Systems Technology on Airports](https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02)
- [FAA Emerging Entrants Bulletin 25-02](https://www.faa.gov/airports/new_entrants/bulletins/25_02)
- [NVIDIA PhysicalAI Autonomous Vehicles dataset](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles)
- [NVIDIA Alpamayo for Autonomous Vehicle Development](https://www.nvidia.com/alpamayo/)
- [NAVSIM GitHub repository](https://github.com/autonomousvision/navsim)
- [Pseudo-Simulation for Autonomous Driving](https://arxiv.org/abs/2506.04218)
- [Bench2Drive project page](https://thinklab-sjtu.github.io/Bench2Drive/)
- [Bench2Drive paper](https://arxiv.org/abs/2406.03877)
- [CARLA Leaderboard](https://leaderboard.carla.org/)
- [Aurrigo Auto-Sim Gerald R. Ford Airport digital twin announcement](https://aurrigo.com/aurrigo-is-creating-a-digital-twin-of-a-us-airport-that-will-explore-the-viability-of-introducing-autonomous-solutions-to-airside-operations/)
