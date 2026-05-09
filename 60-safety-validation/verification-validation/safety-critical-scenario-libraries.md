# Safety-Critical Scenario Libraries

**Last updated:** 2026-05-09

## Why It Matters

Safety validation needs a managed scenario library, not a loose folder of simulator cases. Safety2Drive frames the gap clearly: common closed-loop benchmarks underrepresent real accidents and do not by themselves provide regulatory-compliant safety-critical scenario libraries. Its useful pattern is a library that maps safety requirements to executable scenarios, supports generalization with natural-environment corruptions and adversarial camera/LiDAR threats, and evaluates both full-stack driving and perception subtasks.

For airside autonomy, this becomes the backbone of the evidence case. The library should make every high-consequence hazard traceable: aircraft proximity, stand incursion, personnel occlusion, FOD, jet blast, stale clearance, geofence violation, and service-road conflict. ISO 34504 provides the scenario-tagging discipline; ISO 34505 turns scenarios into test cases with identifiers, objectives, inputs, steps, platforms, and expected results; ASAM OpenSCENARIO DSL gives the executable description layer for reusable abstract, logical, and concrete scenarios.

## Evaluation/Design Pattern

Treat the library as a versioned safety asset with this minimum schema:

| Field | Practical Use |
|---|---|
| `scenario_id` | Stable identifier used in reports, regressions, and safety-case traceability |
| `hazard_id` | Link to HARA/STPA/SOTIF hazard and safety goal |
| `iso_34504_tags` | Actor, environment, dynamic entity, road/airside zone, maneuver, and scenario-context tags |
| `test_objective` | Observable safety claim being tested |
| `abstract_scenario` | Natural-language scenario family |
| `logical_parameters` | Ranges, distributions, constraints, and coverage targets |
| `concrete_instances` | Executable cases with fixed initial state and expected result |
| `corruption_set` | Weather, lighting, sensor dropout, latency, calibration, prompt/context, or adversarial perturbations |
| `oracle` | Collision, clearance, rule, comfort, fallback, and perception/task-specific checks |
| `evidence_state` | Draft, validated in simulation, validated in HIL, validated physically, retired |

Scenario construction flow:

1. Start from hazards and operating rules, not from available logs alone.
2. Assign ISO 34504-style tags before simulator implementation.
3. Define an abstract scenario and a logical parameter space.
4. Generate prioritized concrete test cases using ISO 34505 criteria: frequency, criticality, complexity, OD coverage, requirement coverage, and optimization of the selected test set.
5. Encode reusable scenario families in ASAM OpenSCENARIO DSL, with airside domain extensions for aircraft, GSE, personnel, stands, taxiway crossings, and temporary closures.
6. Attach corruptions and adversarial variants as first-class children of the base scenario.
7. Promote only reviewed, reproducible cases into the release-gating regression suite.

## Airside Transfer

Airside scenarios should be grouped by operational zone and consequence:

| Library Family | Airside Examples |
|---|---|
| Aircraft clearance | Nose/tail/wingtip clearance, tug-pushback sweep, stand-entry envelope |
| Personnel interaction | Marshaller crossing, crouched worker near wheel well, baggage crew occluded by carts |
| Dynamic GSE conflict | Baggage tractor merge, fuel truck priority, belt loader reversing, bus stop-and-go |
| Authority boundary | Hold line, service-road crossing, movement-area geofence, stale proceed instruction |
| Environmental degradation | Wet apron reflections, night floodlights, fog, rain, de-icing residue |
| Sensor and system faults | Camera glare, LiDAR dropout, radar ghost, GNSS multipath, V2X delay |
| FOD and debris | Small object in lane, debris blown by jet blast, false-positive bag/cart fragment |
| Jet blast/intake | Active-engine hazard polygon, engine-state ambiguity, blast-zone reroute |

Use closed-loop simulation for scale, HIL for timing and interface fidelity, and physical tests for the golden set. Keep airport-specific parameters separate from reusable scenario intent so the same scenario family can be instantiated at multiple airports.

## Acceptance Checks

- Every scenario links to at least one hazard, safety requirement, operational rule, or known incident class.
- Every release-gating scenario has a stable ID, owner, parameter range, expected result, oracle, and evidence state.
- ISO 34504-style tags are complete enough to filter by actor, zone, weather/lighting, maneuver, and failure trigger.
- ISO 34505-style test cases include objective, inputs, steps, platform, expected results, and prioritization rationale.
- ASAM OpenSCENARIO assets are parseable and replayable in the approved simulator toolchain.
- Critical scenarios include corruption variants for sensor, environment, map, timing, and communication degradation.
- The golden set is immutable by default; removal requires safety-owner approval and replacement coverage.
- Scenario results are reported by family and hazard, not only as a single aggregate pass rate.

## Failure Modes

| Failure Mode | Practical Consequence | Control |
|---|---|---|
| Scenario-library drift | Tests no longer match the active ODD or airport layout | Map-version and ODD-version binding |
| Weak tagging | Coverage dashboards look complete while key hazards are missing | Required tag schema and review checklist |
| Overfitting to concrete cases | Stack memorizes a few simulator setups | Logical-parameter generation and held-out variants |
| Synthetic-only confidence | Simulator pass rates overstate field readiness | HIL, physical golden tests, and shadow-mode comparison |
| Missing corruptions | Stack passes nominal scenes but fails under glare, rain, or dropout | Corruption matrix attached to each critical family |
| Ambiguous oracle | Test result depends on reviewer judgment | Machine-checkable clearance, collision, rule, and fallback predicates |
| Untraceable edits | Scenario changes cannot be defended in an audit | Versioned scenario IDs, changelog, and evidence state |
| Incomplete airside actors | Aircraft/GSE/personnel behavior is road-vehicle-shaped | Airside actor ontology and domain-specific parameter constraints |

## Related Repository Docs

- [Testing and Validation Methodology](testing-validation-methodology.md)
- [Airside Scenario Taxonomy](airside-scenario-taxonomy.md)
- [Evaluation Benchmarks](evaluation-benchmarks.md)
- [Perception/SLAM Statistical Validity Protocol](perception-slam-statistical-validity-protocol.md)
- [Safety Case Evidence Traceability](../safety-case/safety-case-evidence-traceability.md)
- [Failure Modes Analysis](../safety-case/failure-modes-analysis.md)
- [Airside Autonomy Benchmark Spec](../../30-autonomy-stack/end-to-end-driving/airside-autonomy-benchmark-spec.md)
- [Simulators for Airside](../../30-autonomy-stack/simulation/simulators-for-airside.md)

## Sources

- Safety2Drive: Safety-Critical Scenario Benchmark for the Evaluation of Autonomous Driving: https://arxiv.org/abs/2505.13872
- ISO 34504:2024, Road vehicles - Test scenarios for automated driving systems - Scenario categorization: https://www.iso.org/standard/78953.html
- ISO 34505:2025, Road vehicles - Test scenarios for automated driving systems - Scenario evaluation and test case generation: https://www.iso.org/standard/78954.html
- ASAM OpenSCENARIO DSL: https://www.asam.net/standards/detail/openscenario-dsl/
- ASAM OpenSCENARIO DSL online specification: https://publications.pages.asam.net/standards/ASAM_OpenSCENARIO/ASAM_OpenSCENARIO_DSL/latest/index.html
