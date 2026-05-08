# Cooperative V2X End-to-End Driving

> **Key Takeaway:** Cooperative V2X should not stop at perception. The useful E2E target is a jointly optimized perception, mapping, occupancy, prediction, planning, and communication policy that decides what to share, when to trust it, and how it changes the ego trajectory. Current research is moving from cooperative perception benchmarks toward full cooperative planning with UniV2X, V2X-VLM, Coopernaut, V2X-Real, V2X-ReaLO, and M3CAD. Airside autonomy is a natural deployment domain because airports are bounded, low-speed, infrastructure-rich, and centrally governed.

---

## Problem Definition

Classical cooperative perception asks: "Can infrastructure or another vehicle improve my detections?" Cooperative end-to-end driving asks a harder question:

```
multi-agent sensors + maps + messages + ego goal
  -> shared representation
  -> ego trajectory/action
```

The learned system must optimize planning performance under realistic communication limits, not only maximize mAP. A feature that improves detection but arrives too late, is untrusted, or is irrelevant to the route should not dominate the driving decision.

---

## Method Taxonomy

### Cooperation Level

| Level | Shared content | Planning coupling | Example methods/data |
|---|---|---|---|
| Late fusion | Boxes, tracks, hazards, intent messages | Planner consumes fused outputs | DAIR-V2X TCLF, V2X-ReaLO late-fusion tracks |
| Intermediate fusion | BEV features, sparse queries, compressed latent tokens | Planner consumes fused features or downstream perception | V2X-ViT, Where2comm, FFNet, UniV2X |
| Early fusion | Raw point clouds/images | Planner sees fused perception output after centralized processing | Research upper bound, high bandwidth |
| VLM/VLA fusion | Images/features plus text scene descriptions | Planner/VLA reasons over cooperative context | V2X-VLM |
| End-to-end cooperative policy | Communication and driving jointly optimized | Loss includes perception, mapping, occupancy, and planning | UniV2X, M3CAD baselines |

### Agent Topology

| Topology | Description | Airside analogy |
|---|---|---|
| V2V | Vehicles share perception or intent | Tug-to-tug, baggage train coordination |
| V2I | Vehicle fuses infrastructure sensors | Stand pole sensors, terminal cameras, road-side LiDAR |
| I2I | Infrastructure nodes fuse among themselves | Multi-stand ramp monitoring |
| V2N/MEC | Vehicle and infrastructure send to edge server | Airport 5G/MEC cooperative perception |
| V2P | Personnel devices or wearables broadcast position/status | Ground crew beacons, marshaller safety wearables |

### Planning Integration

| Integration pattern | Description | Strength | Risk |
|---|---|---|---|
| Advisory input | Cooperative output appears as extra obstacle/context | Easy retrofit into modular stacks | Planner may ignore or over-trust data |
| Fused BEV planner | E2E planner consumes fused BEV or occupancy | Better occlusion handling | Sensitive to pose/time errors |
| Communication-aware planner | Planner reasons about latency, confidence, and bandwidth | More deployable | Harder training/evaluation |
| VLA cooperative reasoner | VLM/VLA reasons over multi-view scenes and text | Useful for semantic events | Hallucination and latency risks |
| Simplex-gated cooperative stack | High-performance cooperative stack with onboard-only fallback | Safety case friendly | More integration and evidence work |

---

## Key Research Threads

### Coopernaut

Coopernaut demonstrated end-to-end driving with cooperative perception in networked vehicles. It showed that cross-vehicle perception can improve success rate in challenging scenarios and reduce bandwidth versus earlier V2VNet-style approaches. Its main value today is the framing: cooperation must be evaluated by driving outcomes, not only perception AP.

### UniV2X

UniV2X is a unified end-to-end V2X cooperative driving framework. It integrates perception, online mapping, occupancy prediction, and planning across ego and infrastructure views. Its sparse-dense hybrid transmission design is important because airside deployments cannot assume unlimited bandwidth from every stand sensor to every vehicle.

### V2X-VLM

V2X-VLM adds large vision-language models to vehicle-infrastructure cooperative autonomous driving. It combines vehicle and infrastructure camera views with text scene descriptions and uses contrastive alignment and distillation to improve trajectory planning. This is relevant for airside because cooperative text can encode operational context: pushback clearance, stand phase, jet blast warning, and ramp-control instructions.

### V2X-Real and V2X-ReaLO

V2X-Real provides real-world multi-agent, multi-modal cooperative perception data with two vehicles and two infrastructure units. V2X-ReaLO shifts evaluation from offline cooperative AP to online replay with latency, synchronization, communication, and real-time fusion as first-class metrics. Airside V2X should adopt this online framing early.

### M3CAD

M3CAD is a generic cooperative autonomous driving benchmark with 204 sequences and 30,000 frames, supporting object detection/tracking, mapping, motion forecasting, occupancy prediction, and path planning. Its importance is breadth: it moves cooperative autonomy toward multi-task planning benchmarks rather than isolated perception.

---

## Relevance by Domain

### Generic Road AV

V2X E2E driving is most useful for occluded intersections, emergency vehicles, blind merges, and infrastructure-assisted work zones. Public-road deployment faces fragmented infrastructure ownership and heterogeneous trust, so safety cases must assume unreliable participation.

### Indoor Autonomy

Indoor fleets already rely on infrastructure and dispatch systems. Cooperative E2E concepts transfer to AMR/forklift interactions through shared maps, aisle occupancy, dock-door status, and WMS task messages. Wireless latency and localization drift still need explicit evaluation.

### Outdoor Industrial Autonomy

Yards, ports, mining, and campuses are strong fits. They have bounded sites, private networks, central task systems, and recurring occlusions from trailers, containers, equipment, buildings, and stockpiles. Cooperative autonomy can improve both throughput and safety.

### Airside Autonomy

Airports are one of the strongest fits for cooperative E2E autonomy:

- The airport authority can govern infrastructure, maps, PKI, and network access.
- Stand-level sensors can see around aircraft and GSE.
- Operational messages carry safety-critical context that onboard sensors cannot infer.
- Low speed makes 100 to 200 ms cooperative latency more tolerable than highway driving.
- V2X can encode default-deny clearances for hold-short and movement-area boundaries.

---

## Airside Architecture Pattern

```
Infrastructure sensors:
  stand LiDAR/cameras/radar, A-SMGCS, ADS-B, CCTV, FOD sensors

V2X / airport messages:
  cooperative features, object tracks, stand status, task assignment,
  pushback intent, jet blast warning, runway/taxiway clearance

Vehicle stack:
  onboard perception -> ego BEV / occupancy
  V2X receiver -> time/pose compensation -> trust scoring
  cooperative fusion -> future occupancy / intent
  E2E planner or VLA reasoner -> candidate trajectory
  Simplex safety gate -> control or fallback
```

### Required Runtime Metadata

Every cooperative message used by the planner should carry:

- Sensor capture timestamp.
- Publish, receive, and planner-consume timestamps.
- Source identity and certificate/trust state.
- Coordinate frame and pose covariance.
- Staleness deadline.
- Compression/fusion mode.
- Confidence and uncertainty.
- Degradation/fallback policy if the message disappears.

---

## Implementation and Evaluation Notes

### Training

- Train ego-only, late-fusion, intermediate-fusion, and cooperative-E2E baselines on the same scenario split.
- Include communication dropout, latency jitter, pose noise, and malicious/stale messages during training and validation.
- Use planning loss in addition to perception, mapping, and occupancy losses.
- For VLM/VLA variants, include text-only and wrong-text controls to detect language leakage.
- Keep a vehicle-only fallback policy trained and evaluated separately.

### Evaluation

| Metric | Why it matters |
|---|---|
| Planning score delta over ego-only | Shows whether cooperation changes actual driving behavior |
| Deadline-aware AP / occupancy IoU | Measures perception improvement before data becomes stale |
| Latency-to-impact curve | Shows how performance degrades at 50, 100, 200, 500 ms |
| Bandwidth per vehicle and per stand | Determines network feasibility |
| Stale-message rejection | Prevents replayed clearances or old tracks from driving actions |
| Pose-error robustness | Airside infrastructure and vehicle frames drift |
| Fallback correctness | Vehicle must remain safe without V2X |
| Safety-gate failures | Aircraft/personnel/GSE/hazard-zone violations must be visible |

### Airside Test Scenarios

| Scenario | Cooperative value |
|---|---|
| Aircraft fuselage occludes ground crew | Infrastructure view resolves occlusion |
| Pushback starts near ego route | V2X intent and swept-volume prediction alter ego plan |
| Service-road crossing behind terminal corner | Stand or pole sensor gives early detection |
| FOD detected by another vehicle | Fleet-level report changes route and dispatches cleanup |
| Jet blast warning broadcast | Vehicle avoids invisible hazard |
| Ramp-control clearance revoked | Planner defaults to stop/hold |
| V2X link lost during stand approach | Simplex fallback reduces speed and uses onboard-only policy |

---

## Failure Modes

| Failure mode | Description | Mitigation |
|---|---|---|
| Stale cooperation | Planner uses features after the source scene has changed | Deadline checks and feature-flow/time compensation |
| Pose misalignment | Infrastructure features are fused in the wrong map location | Online calibration, pose covariance, map anchoring |
| Bandwidth collapse | Too many sensors publish dense features at peak operations | Where2comm-style selective sharing and DCC policies |
| False trust | Spoofed or faulty source injects wrong object/clearance | PKI, trust scoring, sensor cross-checks, misbehavior detection |
| Overfitting to cooperation | Policy cannot drive safely when V2X is absent | Mandatory ego-only fallback and V2X-loss scenarios |
| Planning-irrelevant perception gain | mAP improves but route safety/progress does not | Planning-coupled metrics |
| Language hallucination | V2X-VLM invents context or over-trusts text | Text-only controls, structured messages, Simplex safety gate |
| Deadlock from polite policies | Multiple vehicles yield forever | Maneuver coordination and task-level priority rules |

---

## Related Repo Docs

| Document | Relevance |
|---|---|
| [V2X Protocols Airside](../multi-agent-v2x/v2x-protocols-airside.md) | Airside message standards and fallback behavior |
| [Infrastructure-Cooperative Perception](../perception/overview/infrastructure-cooperative-perception.md) | Cooperative perception methods and airport deployment |
| [Collaborative Fleet Perception](../perception/overview/collaborative-fleet-perception.md) | Fleet-level perception sharing |
| [V2X-ReaLO](../perception/methods/v2x-realo.md) | Online cooperative perception benchmark pattern |
| [Fleet Coordination](../multi-agent-v2x/fleet-coordination.md) | Multi-agent and fleet dispatch context |
| [Airside Multi-Agent](../multi-agent-v2x/airside-multi-agent.md) | Airside coordination scenarios |
| [Evaluation Benchmarks: NAVSIM and Bench2Drive](evaluation-benchmarks-navsim-bench2drive.md) | E2E evaluation methodology |
| [Airside Autonomy Benchmark Spec](airside-autonomy-benchmark-spec.md) | Domain-specific cooperative benchmark track |
| [VLM/VLA Reliability Benchmarks](../vla-vlm/vlm-vla-reliability-benchmarks.md) | V2X-VLM and VLA reliability controls |
| [Simplex Safety Architecture](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md) | Safety-gated cooperative stack pattern |

---

## Sources

- [Coopernaut: End-to-End Driving with Cooperative Perception for Networked Vehicles](https://arxiv.org/abs/2205.02222)
- [End-to-End Autonomous Driving through V2X Cooperation / UniV2X](https://arxiv.org/abs/2404.00717)
- [V2X-VLM: End-to-End V2X Cooperative Autonomous Driving Through Large Vision-Language Models](https://arxiv.org/abs/2408.09251)
- [V2X-Real project page](https://mobility-lab.seas.ucla.edu/v2x-real/)
- [V2X-Real paper](https://arxiv.org/abs/2403.16034)
- [V2X-ReaLO](https://arxiv.org/abs/2504.16043)
- [M3CAD: Towards Generic Cooperative Autonomous Driving Benchmark](https://arxiv.org/abs/2505.06746)
- [DAIR-V2X dataset](https://arxiv.org/abs/2204.05575)
- [V2X-Sim: Multi-Agent Collaborative Perception Dataset and Benchmark](https://arxiv.org/abs/2202.08449)
- [V2X-Radar: A Multi-modal Dataset with 4D Radar for Cooperative Perception](https://arxiv.org/abs/2411.10962)
