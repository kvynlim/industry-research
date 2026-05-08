# Evaluation Benchmarks for End-to-End Driving: NAVSIM, Bench2Drive, and Airside Transfer

> **Key Takeaway:** End-to-end driving systems should not be judged only by open-loop trajectory imitation. NAVSIM and Bench2Drive represent two complementary directions: NAVSIM scales real-data evaluation with non-reactive and pseudo-simulation metrics, while Bench2Drive stresses policies in closed-loop CARLA routes with multi-ability scenarios. For airside autonomy, the right pattern is a three-tier suite: logged-data pseudo-simulation for fast iteration, closed-loop digital-twin routes for interaction safety, and controlled-site tests for regulatory evidence.

---

## Why This Matters

Open-loop metrics such as L2 trajectory error and collision checks against logged actors are useful regression tests, but they do not measure recovery from distribution shift, compounding error, deadlock, comfort, or interaction with agents that respond to the ego vehicle. End-to-end driving models, VLA planners, and world-model planners need evaluation that answers four questions:

1. Does the predicted trajectory remain legal and safe when it deviates from the human log?
2. Does the model make progress without exploiting metric loopholes such as stopping forever?
3. Does the model recover from slightly off-expert states?
4. Does the benchmark expose which capability failed: perception, mapping, interaction, rule compliance, comfort, or control?

NAVSIM and Bench2Drive are the most useful open references for building that evaluation discipline today.

---

## Benchmark Taxonomy

| Evaluation class | Typical examples | Strength | Main gap |
|---|---|---|---|
| Open-loop imitation | nuScenes planning, Waymo motion planning, logged ego trajectory L2 | Cheap, reproducible, works with real data | Weak correlation with closed-loop safety and progress |
| Non-reactive simulation | NAVSIM v1 PDM-style scoring | Tests a predicted path in a real scene without full simulator cost | Background agents do not respond to ego behavior |
| Pseudo-simulation | NAVSIM v2 | Adds synthetic observations near candidate trajectory endpoints and better approximates closed-loop correlation | Still not fully interactive and depends on reconstruction quality |
| Closed-loop simulation | Bench2Drive, CARLA Leaderboard, AlpaSim | Measures route completion, infractions, interaction, recovery | Sim-to-real and behavior-agent realism gaps |
| Scenario-level safety validation | NeuroNCAP-style, ISO 3450x, airside digital twins | Targets rare/high-severity hazards | Needs domain-specific scenario libraries and evidence governance |
| Real-world shadow/controlled testing | Fleet replay, safety driver trials, AGVS airport tests | Highest fidelity | Expensive, hard to repeat, limited rare-event statistics |

---

## NAVSIM

### What It Is

NAVSIM is a data-driven AV planning benchmark intended to sit between open-loop replay and full closed-loop simulation. NAVSIM v1 introduced non-reactive simulation on real scenes. NAVSIM v2 adds pseudo-simulation, where synthetic observations near planned trajectory endpoints support scalable metric computation without running an interactive simulator sequentially.

The main branch of the official NAVSIM repository is now NAVSIM v2, used for the 2025 NAVSIM challenge. The v1 branch is still available for the original NeurIPS 2024 benchmark.

### Method Taxonomy

| NAVSIM component | Role | Notes |
|---|---|---|
| Real-scene input | Uses logged sensor and annotation data | Keeps domain closer to real driving than pure CARLA |
| Planner submission | Model outputs a trajectory | Easier to evaluate than full stack execution |
| PDM / EPDMS scoring | Scores no-collision, drivable-area compliance, progress, comfort, and related penalties | NAVSIM v2 extends the original PDM score |
| Pseudo-simulation | Uses synthetic observations near the planned trajectory | Reported to correlate better with closed-loop simulation than conventional open-loop metrics |
| Human filter / false-positive filtering | Reduces unfair penalties where the human driver also violates a rule or scene data is ambiguous | Important for real-log benchmark fairness |

### Strengths

- Uses real-world observations rather than fully synthetic roads.
- Scales faster than full closed-loop simulation.
- Rewards progress and comfort rather than only matching the expert path.
- Exposes common E2E failure modes: off-road drift, static collisions, poor progress, and comfort violations.
- Provides an Apache-2.0 codebase and public challenge infrastructure.

### Limitations

- It is not a full interactive simulator; other agents are only approximated.
- It evaluates a trajectory interface, not every possible runtime integration issue.
- Synthetic observations inherit reconstruction, rendering, and sensor-domain errors.
- Road-driving maps and rules do not directly cover warehouses, yards, ports, or airport aprons.
- A high NAVSIM score is useful evidence, not deployment proof.

---

## Bench2Drive

### What It Is

Bench2Drive is a closed-loop CARLA-based benchmark for multi-ability evaluation of end-to-end autonomous driving. Its project page describes 2 million fully annotated frames collected from 13,638 clips by the Think2Drive world-model RL expert, distributed across 44 interactive scenarios, 23 weather settings, and 12 towns. The evaluation protocol uses 220 routes to disentangle driving capabilities under different situations.

### Method Taxonomy

| Bench2Drive component | Role | Notes |
|---|---|---|
| World-model RL expert | Generates training clips and expert behavior | Makes the dataset richer than hand-authored fixed routes |
| CARLA Leaderboard v2 environment | Runs closed-loop routes | Lets ego actions affect future observations |
| Multi-sensor observations | Cameras, LiDAR, radar, IMU/GNSS, maps and annotations | Useful for camera-only, fusion, VLA, and privileged baselines |
| Interactive scenarios | Cut-in, overtaking, detour, construction, door opening, parking, etc. | Tests multiple driving abilities rather than a single route score |
| Driving Score / success / ability metrics | Summarize performance and per-skill breakdown | Better diagnostic value than a single L2 number |

### Strengths

- Measures closed-loop behavior directly.
- Covers many interactive scenarios and weather conditions.
- Provides rich annotations for perception, mapping, and planning analysis.
- Includes radar in the sensor suite, which is valuable for adverse-condition and fusion research.
- Lets methods fail through runtime decisions, not only through logged trajectory mismatch.

### Limitations

- CARLA behavior and sensor models still differ from real domains.
- Route completion can hide narrow safety-margin failures unless scenario metrics are inspected.
- Simulator crashes and runtime variability can affect evaluation cost.
- Road scenario taxonomy does not include stands, aircraft, GSE, jet blast, FOD, marshalling, or airport operations.
- License and dataset size constraints make full use heavier than NAVSIM-style evaluation.

---

## Benchmark Comparison

| Dimension | NAVSIM v2 | Bench2Drive | Airside benchmark implication |
|---|---|---|---|
| Core paradigm | Real-data pseudo-simulation | Closed-loop simulation in CARLA | Use both: logged-airside pseudo-sim for iteration, digital-twin closed loop for safety cases |
| Interaction | Approximate/non-sequential | Interactive simulation | Airside pushback, stand entry, and GSE conflicts require closed-loop coverage |
| Cost | Lower | Higher | Use NAVSIM-like stage in CI; reserve closed-loop for release gates |
| Main metric | EPDMS/PDM-style trajectory score | Driving score, success, multi-ability metrics | Build airside EPDMS with no-aircraft-contact and personnel-safety gates |
| Domain | Public-road driving | Public-road driving | Needs airside object classes, rules, maps, and hazards |
| Failure visibility | Good for trajectory quality | Good for runtime interaction | Combine logs, metric traces, and scenario labels |

---

## Relevance by Domain

### Generic Road AV

NAVSIM is useful as a scalable planning benchmark on real data; Bench2Drive is useful as a closed-loop stress test for interactive behavior. A production road AV program should maintain both types and report them separately.

### Indoor Autonomy

Indoor AMRs and forklifts do not need road traffic-light metrics, but the pattern transfers well. Replace drivable-area compliance with aisle, dock, and safety-zone compliance; replace route progress with task progress; add near-field personnel and pallet occlusion scenarios.

### Outdoor Industrial Autonomy

Yards, ports, mining sites, and campuses need mixed reactive simulation and operational-rule scoring. NAVSIM-like pseudo-simulation can score logged yard missions quickly, while Bench2Drive-like closed-loop routes should cover blind corners, trailer moves, loading-zone conflicts, and degraded GNSS.

### Airside Autonomy

Airside vehicles need an airside-specific evaluation suite. Road benchmarks do not model aircraft priority, pushback swept volumes, jet blast, FOD, stand markings, marshaller signals, A-SMGCS context, or airport sponsor approval constraints. NAVSIM and Bench2Drive provide methodology, not sufficient domain coverage.

---

## Airside Evaluation Notes

### Suggested Metric Stack

| Layer | Metric family | Airside adaptation |
|---|---|---|
| Safety gates | Binary or ternary multipliers | No aircraft contact, no personnel collision, no GSE collision, no runway/taxiway clearance violation, no jet-blast-zone entry |
| Route/task progress | Weighted score | Complete baggage route, stand approach, service-road crossing, tow route, or FOD retrieval task |
| Rule compliance | Penalty or gate | Aircraft right-of-way, hold-short/default-deny clearance, stand exclusion zones, speed-by-zone, marshaller/ramp-control instructions |
| Comfort/control | Weighted score | Acceleration, jerk, steering rate, load shift, dolly stability, towbar stress |
| Perception dependency | Diagnostic score | Was failure caused by missed aircraft/GSE/personnel/FOD, stale V2X, map error, or planner choice? |
| Robustness | Scenario variants | Rain, glare, night, fog, wet apron, de-icing residue, GPS multipath, terminal shadow, network dropout |

### Minimum Airside Benchmark Split

| Split | Purpose | Example content |
|---|---|---|
| `airside_train` | Model development | Normal stand transit, service-road driving, baggage tug routes |
| `airside_val` | Tuning and regression | Same scenario families with unseen stands and weather |
| `airside_test_public` | Public leaderboard and reproducibility | Sanitized routes and scenarios |
| `airside_test_private` | Overfitting guard | Withheld stands, aircraft types, route assignments, and edge cases |
| `airside_safety_hard` | Release gate | Pushback, aircraft crossing, FOD, personnel occlusion, jet blast, clearance loss |

### Implementation Pattern

1. Start with a NAVSIM-style logged replay evaluator for recorded airside missions.
2. Add pseudo-sim perturbations around ego trajectory endpoints using 3DGS or neural reconstruction where available.
3. Build closed-loop routes in CARLA/AWSIM/Isaac/airport digital twin for interaction-heavy scenarios.
4. Score E2E policies through the same route/task interface used by modular planners.
5. Keep all metric traces, scenario tags, V2X messages, and safety-monitor events as evidence artifacts.

---

## Failure Modes

| Failure mode | How it appears in benchmark results | Mitigation |
|---|---|---|
| Open-loop overfitting | Low L2 error but poor route completion or collision avoidance | Require NAVSIM/Bench2Drive-style progress and safety metrics |
| Stop-to-win behavior | No collisions but low progress | Use progress floors and task completion gates |
| Simulator exploitation | Policy learns CARLA-specific artifacts | Evaluate on real logs, pseudo-sim, multiple simulators, and controlled real tests |
| Metric masking | Strong aggregate score hides aircraft/proximity hazard | Report per-scenario and per-safety-gate breakdowns |
| Non-reactive optimism | Ego trajectory passes through space an agent would reactively occupy | Use closed-loop digital twin for interaction-heavy cases |
| False-positive penalties | Benchmark punishes necessary deviations from unsafe human logs | Use human-filter logic and scenario review |
| Domain mismatch | Road benchmarks miss airside failure classes | Build airside classes, maps, rules, and hazard metrics |

---

## Related Repo Docs

| Document | Relevance |
|---|---|
| [Evaluation Methods, Benchmarks, and Metrics](../../60-safety-validation/verification-validation/evaluation-benchmarks.md) | Broader benchmark and metric taxonomy |
| [Airside Scenario Taxonomy](../../60-safety-validation/verification-validation/airside-scenario-taxonomy.md) | Candidate airside scenario families |
| [Open-Source Simulators for Airside](../simulation/simulators-for-airside.md) | Simulator choices for closed-loop airside routes |
| [Neural Simulation Platforms](../simulation/neural-simulation-platforms.md) | Neural reconstruction and world-model simulation options |
| [End-to-End Architectures](e2e-architectures.md) | E2E model families that need these benchmarks |
| [End-to-End World Model Pipeline](e2e-world-model-pipeline.md) | World-model planner interfaces and metrics |
| [VLM/VLA Reliability Benchmarks](../vla-vlm/vlm-vla-reliability-benchmarks.md) | Language/reasoning benchmark layer |
| [Airside Autonomy Benchmark Spec](airside-autonomy-benchmark-spec.md) | Proposed domain-specific benchmark design |

---

## Sources

- [NAVSIM GitHub repository](https://github.com/autonomousvision/navsim)
- [NAVSIM: Data-Driven Non-Reactive Autonomous Vehicle Simulation and Benchmarking](https://arxiv.org/abs/2406.15349)
- [Pseudo-Simulation for Autonomous Driving](https://arxiv.org/abs/2506.04218)
- [NAVSIM NeurIPS 2024 project page](https://research.nvidia.com/labs/avg/publication/dauner.hallgarten.etal.neurips2024/)
- [NAVSIM metrics documentation](https://github.com/autonomousvision/navsim/blob/main/docs/metrics.md)
- [Bench2Drive project page](https://thinklab-sjtu.github.io/Bench2Drive/)
- [Bench2Drive GitHub repository](https://github.com/Thinklab-SJTU/Bench2Drive)
- [Bench2Drive paper](https://arxiv.org/abs/2406.03877)
- [CARLA Leaderboard](https://leaderboard.carla.org/)
- [FAA CertAlert 24-02: Autonomous Ground Vehicle Systems Technology on Airports](https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02)
