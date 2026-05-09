# Closed-Loop VLM/VLA Evaluation

**Last updated:** 2026-05-09

## Why It Matters

VLM/VLA driving models can answer scene questions, explain maneuvers, and propose actions, but open-loop QA accuracy is not enough for safety use. Bench2ADVLM identifies the core problem: static open-loop evaluation misses interactive behavior, feedback resilience, and real-world safety. The model must be tested while its outputs change the future state.

Closed-loop evaluation also separates semantic competence from deployable action quality. SafeVL shows how VLM reasoning can be used as a safety evaluator and trajectory filter. DSBench broadens safety evaluation beyond one scene type by testing external and in-cabin risks. DriveAction adds action-level labels and an action-rooted evaluation tree, which is closer to what a planner actually needs than generic captioning.

## Evaluation/Design Pattern

Use a four-layer harness:

| Layer | Purpose | Evidence |
|---|---|---|
| Scene understanding | Check perception, grounding, rules, and risk recognition | Object/region grounding, hallucination rate, abstention quality |
| Safety reasoning | Check whether the model identifies unsafe or uncertain states | Safe/unsafe classification, rationale quality, counterfactual sensitivity |
| Action selection | Check high-level action and maneuver choice | Discrete action accuracy, action-tree node scores, wrong-action classes |
| Closed-loop rollout | Check cumulative behavior after model outputs affect the world | Collision, route completion, rule violations, intervention, latency |

Bench2ADVLM's hierarchical pattern is useful: let the target ADVLM emit high-level driving commands, translate them into standardized mid-level actions, then execute them in simulation or through a physical abstraction layer. Keep this abstraction explicit so different VLM/VLA models are compared on the same action contract.

Evaluation slices:

- Clean rollout versus corrupted sensor/context rollout.
- Text-only and wrong-context controls to catch language-prior leakage.
- Safety-critical scenario subset, not only average driving.
- Explanation-action consistency: the rationale must support the selected action.
- Independent safety checker after model output, before any actuation.
- Latency and missed-deadline reporting, because correct late answers are not usable.

## Airside Transfer

Airside VLM/VLA evaluation should restrict authority by deployment mode:

| Mode | Allowed Use | Required Closed-Loop Check |
|---|---|---|
| Offline labeler | Mine logs, annotate hazards, propose scenario variants | Label quality and hallucination audit |
| Operator copilot | Advisory explanation and exception triage | False-negative rate on critical hazards and calibrated abstention |
| Planner constraint provider | Request slow, stop, hold, reroute, or ask-operator | Independent rule and trajectory validator |
| Direct VLA proposal | Produce candidate maneuver or trajectory | Closed-loop pass under Simplex safety gate and fallback monitor |

Airside task families should include aircraft-state reasoning, marshaller and ground-crew intent, FOD detection confidence, jet-blast/intake zone awareness, hold-line authority, stale task messages, wrong stand IDs, and temporary closures. DSBench's split between external environment and in-cabin behavior does not transfer directly, but its pattern of explicit safety categories and subcategories should be reused for external airside hazards and remote-operator/workforce state.

## Acceptance Checks

- The model is evaluated in closed loop on scenario families where its output changes future observations.
- Every VLA output is normalized into a bounded action or trajectory contract before execution.
- The benchmark reports task score, safety score, collision/clearance violations, rule violations, intervention rate, and latency.
- Text-only, wrong-context, and corrupted-input controls are included for every safety-critical slice.
- Safe/unsafe judgments are checked against scenario oracles, not only model-written explanations.
- Action-level evaluation follows an action tree or equivalent taxonomy, so failures identify the wrong decision level.
- The harness logs input frames, prompts, structured context, model output, translated action, validator result, and rollout outcome.
- No VLM/VLA output bypasses an independent safety monitor or authority rule checker.

## Failure Modes

| Failure Mode | Example | Control |
|---|---|---|
| Open-loop optimism | Model answers correctly but crashes after acting on its answer | Closed-loop rollouts with cumulative state |
| Language-prior leakage | "Hold short" answer inferred from prompt wording rather than scene evidence | Text-only and balanced wrong-context controls |
| Unsafe but fluent explanation | Rationale sounds plausible while trajectory enters a hazard zone | Explanation-action consistency and safety validator |
| Action abstraction mismatch | Model says "proceed carefully" but simulator/controller interprets it aggressively | Fixed action schema and bounded translator |
| Safety evaluator blind spot | SafeVL-style filter misses a rare airside hazard absent from counterfactual data | Airside counterfactual generation and golden scenarios |
| Category dilution | Aggregate score hides aircraft-clearance failures | Per-hazard reporting and zero-tolerance critical classes |
| Late reasoning | Model produces the right stop after the control deadline | Deadline-aware scoring and fallback |
| Direct-control misuse | VLA trajectory is treated as certified control | Simplex gate, independent planner/controller checks |

## Related Repository Docs

- [VLM/VLA Reliability Benchmarks for Autonomous Driving](vlm-vla-reliability-benchmarks.md)
- [VLA Models for Driving](vla-for-driving.md)
- [Vision-Language Models for Airside Scene Understanding](vlm-scene-understanding.md)
- [VLA Distillation and Scaling](vla-distillation-scaling.md)
- [Evaluation Benchmarks: NAVSIM and Bench2Drive](../end-to-end-driving/evaluation-benchmarks-navsim-bench2drive.md)
- [Airside Closed-Loop Planning Benchmark](../planning/airside-closed-loop-planning-benchmark.md)
- [Evaluation Benchmarks](../../60-safety-validation/verification-validation/evaluation-benchmarks.md)
- [Simplex Safety Architecture](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md)

## Sources

- Bench2ADVLM: A Closed-Loop Benchmark for Vision-language Models in Autonomous Driving: https://arxiv.org/abs/2508.02028
- SafeVL: Driving Safety Evaluation via Meticulous Reasoning in Vision Language Models: https://safevl.github.io/
- DSBench, Is Your VLM for Autonomous Driving Safety-Ready?: https://arxiv.org/abs/2511.14592
- DriveAction: A Benchmark for Exploring Human-like Driving Decisions in VLA Models: https://arxiv.org/abs/2506.05667
