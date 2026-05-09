# Safety Functions PLd/SIL Validation

**Last updated:** 2026-05-09

## Why It Matters

Airside autonomy certification is won or lost on safety functions, not on autonomy demos. ISO 3691-4:2023 is the primary driverless-industrial-truck standard for AGVs, AMRs, carts, tugger-like vehicles, and related systems; it specifies safety requirements and verification means for driverless trucks and their systems. ISO 13849-1:2023 provides the design methodology for safety-related parts of control systems (SRP/CS), including software, in high-demand or continuous modes. IEC 62061:2021 provides a machinery-sector functional-safety route for safety-related control systems and validation under the IEC 61508 framework.

For an autonomous baggage tug, cargo tug, or apron vehicle, the assessor needs more than "the vehicle stopped in the trial." The evidence must show which hazardous event the safety function mitigates, which target integrity level applies, which sensors, logic, and actuators implement the function, and how diagnostic coverage and fault behavior were validated. PLd and SIL claims should therefore be treated as release gates for the independent safety layer: braking, speed supervision, emergency stop, personnel detection, geofence enforcement, lost-link stop, steering inhibit, and safe-mode transitions.

## Evidence Model

1. **Hazard-to-function traceability.** Start with a hazard record for each credible airside event: pedestrian in tow path, aircraft stand intrusion, overspeed near equipment, lost communications, incorrect route, load instability, or emergency vehicle conflict. Link each hazard to one or more safety functions and identify the safety state.

2. **Target integrity rationale.** Record the required Performance Level (PLr) or SIL target using the applicable Type-C standard, airport risk assessment, and severity/exposure/avoidance assumptions. Do not copy PLd or SIL 2 labels across functions without a hazard rationale. Braking and personnel protection normally require the strongest argument because demand rates are high and harm can be severe.

3. **Function definition.** For every safety function, define trigger condition, sensor inputs, logic path, output actuator, maximum response time, diagnostic tests, fault reaction, degraded mode, reset behavior, manual override rules, and proof-test interval. Include the behavior when the autonomy stack sends stale, invalid, or unsafe commands.

4. **Architecture calculation.** For ISO 13849-1, maintain the SRP/CS block diagram, category, MTTFd, diagnostic coverage, common-cause-failure measures, software class assumptions, and achieved PL. For IEC 62061, maintain the safety-related control system design, PFHd calculation, maximum SIL claim, subsystem limits, configuration management, parametrization controls, and validation independence.

5. **Validation evidence.** Combine analysis with physical testing. Use worst-case payload, slope, tire condition, battery state, surface friction, speed, lighting, rain/fog if in ODD, and sensor contamination. Validate stopping distance, protective field sizing, response time, false-safe and false-danger behavior, and recovery from injected faults.

6. **Lifecycle control.** Tie every safety parameter to version control, approval, and revalidation rules. A scanner field, speed map, brake controller parameter, watchdog timeout, or geofence polygon is safety configuration and must not be changed through ordinary operations tooling.

## Acceptance Checks

- Every safety function has one owner, one requirement ID, one hazard link, one PLr/SIL target, and one achieved-integrity claim.
- The safety function is implemented in an SRP/CS or safety-related control system that remains effective when the autonomy computer crashes, hangs, publishes stale commands, or loses network connectivity.
- Stopping performance is proven for the highest allowed speed, heaviest allowed tow/load case, lowest expected friction, and maximum allowed route slope.
- Personnel-detection fields cover the vehicle, load envelope, turning geometry, and trailer or cart sweep where applicable.
- Emergency stop, remote stop, lost-link stop, overspeed stop, and geofence violation stop are tested as separate functions, not only as a combined system demonstration.
- Diagnostic faults produce a defined safe state and cannot be cleared without authorized reset, inspection, or maintenance action where the hazard requires it.
- Components with third-party functional-safety certificates are used within their certified assumptions, environmental limits, and proof-test intervals.
- Software verification, validation, and independence are documented for the logic that affects the safety output.

## Failure Modes

- Treating the neural perception stack as a safety function without independent monitoring, deterministic fallback, or a validated non-AI protective layer.
- Validating brakes at nominal load and clean concrete, then approving routes with wet apron surfaces, slopes, worn tires, or towed baggage carts.
- Claiming PLd or SIL from component certificates while the integrated sensor-logic-actuator path does not meet response time, diagnostics, or common-cause-failure assumptions.
- Allowing operations staff to edit route speeds, scanner zones, or geofences without configuration control and revalidation.
- Testing emergency stop only from a button press and missing remote-stop latency, wireless loss, watchdog timeout, or controller brownout.
- Ignoring mechanical and hydraulic failure modes because the calculation only covered electronics and software.
- Letting a bypass, maintenance mode, or manual recovery mode move the vehicle without speed, zone, and presence-detection constraints.

## Related Repository Docs

- [ISO 3691-4 Deep Dive](iso-3691-4-deep-dive.md)
- [Functional Safety Software](functional-safety-software.md)
- [Safety Verification Certification](safety-verification-certification.md)
- [Simplex Safety Architecture](../runtime-assurance/simplex-safety-architecture.md)
- [Failure Modes Analysis](../safety-case/failure-modes-analysis.md)
- [Safety Case Evidence Traceability](../safety-case/safety-case-evidence-traceability.md)

## Sources

- ISO, [ISO 3691-4:2023 - Driverless industrial trucks and their systems](https://www.iso.org/standard/83545.html)
- ISO, [ISO 13849-1:2023 - Safety-related parts of control systems](https://www.iso.org/standard/73481.html)
- IEC, [IEC 62061:2021 - Functional safety of safety-related control systems](https://webstore.iec.ch/en/publication/59927)
- IEC, [IEC 62061:2021+AMD1:2024 CSV](https://webstore.iec.ch/en/publication/93654)
- FAA, [Emerging Entrants Bulletin 25-02: AGVS Safety Considerations Checklist](https://www.faa.gov/airports/new_entrants/bulletins/25_02)
