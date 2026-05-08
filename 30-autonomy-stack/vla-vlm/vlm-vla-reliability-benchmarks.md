# VLM/VLA Reliability Benchmarks for Autonomous Driving

> **Key Takeaway:** Driving VLMs and VLAs are useful only when their visual grounding, corruption robustness, text sensitivity, and action validity are measured explicitly. Current benchmarks such as DriveBench, CODA-LM, DriveLM, and RoboDriveBench show that models can produce plausible but visually ungrounded answers, degrade under sensor corruption, and exploit text priors. For airside autonomy, a VLM/VLA benchmark must include text-only controls, wrong-context prompts, sensor corruptions, operational-rule questions, and closed-loop action checks.

---

## Reliability Question

VLM/VLA driving systems promise semantic reasoning, instruction following, explanations, and direct trajectory generation. The safety question is not "can the model answer driving questions?" but:

- Did it look at the right visual evidence?
- Did it ignore misleading text priors?
- Did it remain consistent under corruption, missing frames, and prompt errors?
- Did its explanation match the action it proposed?
- Did the proposed action obey the domain rules and remain controllable?

These questions require reliability benchmarks beyond standard VQA or open-loop planning scores.

---

## Benchmark Taxonomy

| Benchmark class | What it measures | Example benchmarks |
|---|---|---|
| Driving VQA and reasoning | Scene, prediction, planning, behavior, explanation QA | DriveLM, LingoQA, nuScenes-QA |
| Corner-case VLM evaluation | Rare or safety-critical driving scenes | CODA-LM |
| Visual grounding and hallucination | Whether answers depend on actual image/video evidence | DriveBench text-only and corruption settings |
| Sensor/prompt robustness | Performance under weather, sensor, motion, transmission, and prompt corruption | DriveBench, RoboDriveBench |
| VLA trajectory/action validity | Whether VLM/VLA outputs safe trajectories or controls | RoboDriveBench, LMDrive/Bench2Drive-style closed-loop |
| Explanation-action consistency | Whether rationale matches planned action and scene facts | DriveLM, DriveBench, CoT-style rubrics |
| Domain-specific operational reasoning | Rules and procedures for the operating domain | Airside benchmark extension needed |

---

## Key Benchmarks and Lessons

### DriveBench

DriveBench evaluates VLM reliability across clean, corrupted, and text-only settings. It covers perception, prediction, planning, and behavior/explanation tasks with 19,200 frames and 20,498 QA pairs. Its most important lesson is that VLMs can generate plausible driving responses from text cues or dataset priors even when visual evidence is degraded or missing.

Recommended use:

- Use text-only controls to estimate language-prior leakage.
- Report clean/corrupted/text-only deltas, not only absolute scores.
- Include multiple question types: multiple choice, open-ended, and visual grounding.
- Track whether a model localizes the relevant object or simply answers generically.

### CODA-LM

CODA-LM targets self-driving corner cases and provides automated evaluation for large VLMs on general perception, regional perception, and driving suggestions. It is valuable because corner-case evaluation is closer to safety-critical deployment than average-case captioning.

Recommended use:

- Build domain-specific corner-case suites rather than only normal scenes.
- Separate global scene understanding from regional/localized perception.
- Use evaluator models carefully and calibrate them against human judgment.

### DriveLM

DriveLM frames driving as graph visual question answering. It connects perception, prediction, planning, behavior, and motion tasks through human-written reasoning logic. It is useful for evaluating whether a model can preserve structured dependencies from "what is present" to "what will happen" to "what should ego do."

Recommended use:

- Use graph dependencies to detect inconsistent answers.
- Keep questions tied to object IDs, spatial relationships, and future intent.
- Evaluate planning explanations separately from final action quality.

### RoboDriveBench / RoboDriveVLM

RoboDriveBench focuses on robust VLM-based end-to-end trajectory prediction. It introduces simulated sensor corruption and prompt corruption categories and evaluates trajectory prediction cases at scale. Its core lesson is that VLA reliability must be measured in action space, not only language space.

Recommended use:

- Include both sensor and prompt corruption.
- Measure trajectory error, collision risk, and rule compliance.
- Test cross-modal recovery using LiDAR/radar where available.

---

## Reliability Metrics

| Metric | Definition | Why it matters |
|---|---|---|
| Clean score | Task score on uncorrupted input | Baseline capability |
| Corruption delta | Clean minus corrupted score | Robustness to weather, blur, missing frames, compression, glare |
| Text-only score | Score without visual input | Detects language-prior leakage |
| Grounding accuracy | Whether cited object/region matches the answer | Prevents plausible but ungrounded explanations |
| Hallucination rate | References to nonexistent objects, signals, people, or hazards | Safety-critical for VLM co-pilots |
| Consistency score | Agreement among perception, prediction, planning, and explanation answers | Detects broken reasoning chains |
| Action validity | Trajectory/control obeys constraints | Required for VLA deployment |
| Explanation-action alignment | Explanation supports the selected action | Useful for incident review and trust |
| Calibration / abstention | Confidence matches correctness and model can say unknown | Needed for fallback gating |
| Deadline miss rate | Output arrives after planner deadline | Reasoning that is too late is not usable |

---

## Relevance by Domain

### Generic Road AV

Driving VLMs can help classify rare semantic hazards, explain decisions, and support data mining. They should not bypass geometric perception or safety monitors. Road benchmarks need weather, lighting, missing frames, ambiguous signs, emergency vehicles, and regional rule variations.

### Indoor Autonomy

Indoor VLM/VLA use cases include instruction following, pallet/dock reasoning, worker interaction, and exception handling. Benchmarks should include WMS prompt errors, occluded humans, reflective floors, motion blur, and "unknown object" handling.

### Outdoor Industrial Autonomy

Yards, ports, mines, construction sites, and campuses need VLMs for semantic anomaly detection and operational context. Benchmarks should cover temporary signage, work zones, manual spotters, low-connectivity instructions, and site-specific rules.

### Airside Autonomy

Airside is especially sensitive to language hallucination because operational text can be authoritative. A wrong answer about clearance, aircraft status, jet blast, or marshaller intent can cause a high-severity event. Airside VLMs should advise or constrain a planner, not directly actuate without a safety gate.

---

## Airside Reliability Benchmark Design

### Question Categories

| Category | Example question | Expected evidence |
|---|---|---|
| Object grounding | "Which GSE is blocking the ego route?" | 3D track, image region, map position |
| Aircraft state | "Is the aircraft parked, taxiing, or under pushback?" | Aircraft motion, tug connection, lights, V2X/ops state |
| Personnel risk | "Is any ground crew member likely to enter the ego path?" | Person track, occlusion, current task context |
| Rule compliance | "May the vehicle cross this hold line?" | Clearance message, map zone, default-deny rule |
| FOD reasoning | "Is the object on the apron likely FOD?" | Small-object detection, persistence, classification |
| Jet blast/intake | "Is ego inside an active engine hazard zone?" | Aircraft type, engine state, hazard polygon, thermal/V2X if available |
| Instruction following | "Proceed to stand B7 but avoid de-icing zone D2." | Route map, active zones, task message |
| Explanation | "Why should ego stop here?" | Link to object/rule/hazard that triggered stop |

### Corruption Matrix

| Corruption | Airside examples |
|---|---|
| Visual weather | rain, fog, wet apron reflections, snow/de-icing residue |
| Lighting | night apron lighting, glare from terminal floodlights, low sun |
| Sensor | camera dropout, LiDAR partial dropout, radar ghost targets, calibration drift |
| Motion/transmission | frame loss, compression, stale V2X, delayed airport ops feed |
| Prompt/context | wrong stand ID, stale clearance, contradictory task message, missing NOTAM |
| Domain shift | new aircraft type, unfamiliar GSE, temporary construction layout |

### Evaluation Controls

- Text-only prompts must be included for every safety-relevant question.
- Wrong-context prompts should test whether the model follows invalid instructions.
- "I do not know" must be scored positively when evidence is insufficient.
- Explanations must cite observable evidence or structured inputs.
- VLA action outputs must pass an independent trajectory safety checker.
- Any model that fabricates clearance should fail the scenario, even if the route trajectory is otherwise safe.

---

## Implementation Notes

### Model Integration

Use four deployment modes with different acceptance criteria:

| Mode | Allowed authority | Required benchmark evidence |
|---|---|---|
| Offline labeler | Data curation only | Accuracy and hallucination rate on withheld labels |
| Operator co-pilot | Human-readable advisory | Low false-negative rate for critical hazards, calibrated confidence |
| Planner constraint provider | Can request slow/stop/reroute through safety gate | Grounding, corruption robustness, deadline compliance |
| Direct VLA planner | Outputs trajectory/action | Closed-loop action validity, safety monitor compatibility, fallback behavior |

### Evaluation Harness

1. Freeze prompts and structured context format.
2. Run clean, corrupted, text-only, and wrong-context variants.
3. Record answer, rationale, cited objects/regions, confidence, and latency.
4. Convert VLA outputs to a standard trajectory format.
5. Run independent safety and rule checkers.
6. Report per-category results, not only an aggregate score.

### Acceptance Thresholds for Airside POC

Early-stage thresholds should be conservative:

- Zero fabricated clearances in safety-hard evaluation.
- Text-only performance no better than an abstention baseline on visual questions.
- Critical hazard recall above operator-defined threshold before advisory use.
- Corruption delta explicitly bounded for each ODD condition.
- All VLA trajectories must pass independent collision, zone, and control-envelope checks.

---

## Failure Modes

| Failure mode | Example | Mitigation |
|---|---|---|
| Visual hallucination | Mentions traffic light or pedestrian that is not visible | Text-only controls and grounding labels |
| Language-prior leakage | Guesses common driving answer from question wording | Balanced labels and text-only score reporting |
| Prompt over-trust | Obeys stale "cleared to cross" text despite no valid clearance | Structured clearance schema and safety checker |
| Corruption brittleness | Water splash or glare changes planning answer | Corruption matrix and ODD-aware fallback |
| Spatial reasoning error | Misidentifies left/right side of aircraft or object distance | 3D grounding and map-coordinate questions |
| Explanation mismatch | Says "stopping for worker" but trajectory proceeds | Explanation-action alignment check |
| Latency miss | Correct answer arrives after planner deadline | Deadline-aware scoring |
| Overconfident wrong answer | High confidence on unknown object or occluded zone | Calibration and abstention scoring |
| Direct-control misuse | VLA emits unsafe trajectory | Simplex safety gate and independent planner/controller checks |

---

## Related Repo Docs

| Document | Relevance |
|---|---|
| [Vision-Language Models for Airside Scene Understanding](vlm-scene-understanding.md) | VLM deployment patterns and airside applications |
| [VLA Models for Driving](vla-for-driving.md) | VLA architecture and action-head context |
| [VLA Distillation and Scaling](vla-distillation-scaling.md) | Distilling large reasoners into deployable models |
| [Spatial Foundation Models for Airport](spatial-foundation-models-airport.md) | Spatial reasoning and airport adaptation |
| [Evaluation Benchmarks: NAVSIM and Bench2Drive](../end-to-end-driving/evaluation-benchmarks-navsim-bench2drive.md) | E2E planning benchmark context |
| [Airside Autonomy Benchmark Spec](../end-to-end-driving/airside-autonomy-benchmark-spec.md) | Domain-specific VLM/VLA test track |
| [End-to-End World Model Pipeline](../end-to-end-driving/e2e-world-model-pipeline.md) | VLA integration as slow reasoner |
| [Online Perception Monitoring and ODD Enforcement](../../60-safety-validation/runtime-assurance/online-perception-monitoring-odd-enforcement.md) | Runtime gating and fallback |
| [Simplex Safety Architecture](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md) | Authority boundaries for VLM/VLA outputs |

---

## Sources

- [DriveBench project page](https://drive-bench.github.io/)
- [Are VLMs Ready for Autonomous Driving?](https://arxiv.org/abs/2501.04003)
- [CODA-LM: Automated Evaluation of Large Vision-Language Models on Self-Driving Corner Cases](https://openaccess.thecvf.com/content/WACV2025/html/Chen_Automated_Evaluation_of_Large_Vision-Language_Models_on_Self-Driving_Corner_Cases_WACV_2025_paper.html)
- [CODA-LM arXiv](https://arxiv.org/abs/2404.10595)
- [DriveLM GitHub repository](https://github.com/OpenDriveLab/DriveLM)
- [DriveLM paper](https://arxiv.org/abs/2312.14150)
- [RoboDriveVLM / RoboDriveBench](https://arxiv.org/abs/2512.01300)
- [LingoQA: Video Question Answering for Autonomous Driving](https://arxiv.org/abs/2312.14115)
- [OpenDriveVLA](https://arxiv.org/abs/2503.23463)
- [LMDrive](https://arxiv.org/abs/2312.07488)
