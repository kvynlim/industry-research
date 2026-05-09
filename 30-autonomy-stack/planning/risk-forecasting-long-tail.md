# Risk Forecasting for Long-Tail Planning

**Last updated:** 2026-05-09

## Why It Matters

Long-tail failures often appear before collision as an interaction risk pattern: an occluded actor accelerates, a merge becomes ambiguous, a worker steps behind GSE, or two vehicles enter a constrained zone with incompatible intentions. A planner needs forecasted risk fields, not only current object boxes and time-to-collision.

RiskNet is the strongest pattern for this page: combine deterministic interaction-risk modeling with probabilistic behavior prediction so risk is forecast across time under multi-agent uncertainty. RiskBench adds the benchmark discipline: risk algorithms should be tested for detection/location, anticipation, and decision support under a scenario taxonomy and augmentation pipeline. RiskMap provides the deployable representation idea: a differentiable, interpretable risk field that can feed downstream planning as a cost prior.

## Evaluation/Design Pattern

Use risk forecasting as planner middleware:

```text
sensors + map + V2X + intent
  -> multi-agent state and uncertainty
  -> probabilistic trajectory hypotheses
  -> spatiotemporal risk field / risk map
  -> behavior planner cost, constraints, and fallback triggers
  -> trajectory validation and explanation log
```

Minimum outputs:

| Output | Meaning | Planner Use |
|---|---|---|
| `risk_grid[t]` | Spatial risk field over future horizon | Penalize or prohibit candidate trajectories |
| `agent_risk[t, id]` | Per-agent contribution and confidence | Explain yield/hold decisions |
| `risk_source` | Interaction, infrastructure, map, occlusion, uncertainty, rule | Route to correct safety monitor |
| `time_to_peak_risk` | When the risk becomes highest | Early braking and fallback timing |
| `uncertainty_bounds` | Confidence/entropy over risk and motion modes | Margin inflation and abstention |

Evaluation should include:

- Risk identification: detect and localize present risk.
- Risk anticipation: detect risk before collision or near miss.
- Decision usefulness: safer behavior when risk output is injected into planning.
- Directional sensitivity: risk should distinguish front, rear, lateral, and crossing exposure.
- Long-tail generalization: held-out scenarios, unseen layouts, and rare interactions.
- Runtime: forecasting must meet the planner cycle budget.

## Airside Transfer

Airside risk fields should cover zones that road-centric TTC misses:

| Airside Risk Field | Forecast Target |
|---|---|
| Aircraft clearance field | Future nose/tail/wingtip envelope and tug-pushback sweep |
| Personnel occlusion field | Worker emergence from behind carts, loaders, aircraft, or baggage trains |
| GSE interaction field | Merges, reversing vehicles, stand-entry conflicts, service-road priority |
| Jet blast/intake field | Time-varying engine-state hazard and downwind blast exposure |
| Authority risk field | Hold-line, geofence, movement-area, and stale-clearance violation probability |
| FOD persistence field | Small-object path intersection, debris movement, false-positive confidence |

Risk should not be a monolithic scalar. For airside release gates, separate "collision/clearance risk", "rule/authority risk", "personnel risk", and "operational disruption risk". A baggage tractor may accept delay risk but must not accept aircraft-clearance or personnel-contact risk.

## Acceptance Checks

- The risk forecast consumes actor uncertainty and multimodal future hypotheses, not only current distance.
- Risk output is time-indexed and spatially aligned to the planner frame and map version.
- The planner can explain which risk source changed a behavior decision.
- RiskBench-style tests cover detection/location, anticipation, and decision-support impact.
- RiskMap-style fields are bounded, interpretable, and checked for calibration against scenario outcomes.
- Long-tail evaluation includes rare merges, occlusions, cut-ins/crossings, reversing vehicles, and non-nominal authority states.
- Risk thresholds are tied to behavior: margin inflation, yield, stop, reroute, remote assistance, or ODD exit.
- Runtime and stale-output handling are measured under full-stack load.

## Failure Modes

| Failure Mode | Example | Control |
|---|---|---|
| Scalar risk collapse | High lateral crossing risk is averaged away | Per-source and directional risk channels |
| Short-horizon blindness | Planner detects risk only after braking is impossible | Multi-horizon forecast and time-to-peak metrics |
| Overconfident prediction | One future mode hides a worker/GSE alternative | Multimodal trajectory hypotheses and uncertainty calibration |
| Risk-map frame error | Risk field is shifted from the map or ego frame | Frame IDs, timestamp checks, and map-version binding |
| No decision benefit | Risk model scores well offline but does not improve behavior | Decision-support evaluation in closed loop |
| Conservative deadlock | Inflated risk blocks stand operations indefinitely | Priority rules, reservation logic, and operator escalation |
| Long-tail overfit | Model works on benchmark scenes but not airport layouts | Held-out airport scenarios and domain randomization |
| Unclear authority boundary | Risk score competes with hard hold-line rule | Hard constraints for authority; risk as advisory cost |

## Related Repository Docs

- [Motion Prediction](motion-prediction.md)
- [Joint Prediction-Planning](joint-prediction-planning.md)
- [Behavior Planning and Maneuver Arbitration](behavior-planning-maneuver-arbitration.md)
- [Safety-Critical Planning and CBF](safety-critical-planning-cbf.md)
- [Airside Closed-Loop Planning Benchmark](airside-closed-loop-planning-benchmark.md)
- [Ramp Traffic Conflict Detection and Deadlock Prevention](../multi-agent-v2x/ramp-traffic-conflict-deadlock-prevention.md)
- [Airside Scenario Taxonomy](../../60-safety-validation/verification-validation/airside-scenario-taxonomy.md)
- [Failure Modes Analysis](../../60-safety-validation/safety-case/failure-modes-analysis.md)

## Sources

- RiskNet: Interaction-Aware Risk Forecasting for Autonomous Driving in Long-Tail Scenarios: https://arxiv.org/abs/2504.15541
- RiskBench: A Scenario-based Benchmark for Risk Identification: https://arxiv.org/abs/2312.01659
- RiskBench project page: https://hcis-lab.github.io/RiskBench/
- RiskMap: A Unified Driving Context Representation for Autonomous Motion Planning in Urban Driving Environment: https://arxiv.org/abs/2406.04451
- Risk Map As Middleware: Towards Interpretable Cooperative End-to-end Autonomous Driving for Risk-Aware Planning: https://arxiv.org/abs/2508.07686
