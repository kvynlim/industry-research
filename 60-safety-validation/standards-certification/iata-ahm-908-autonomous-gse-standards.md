# IATA AHM 908 Autonomous GSE Standards

**Last updated:** 2026-05-09

## Why It Matters

IATA's Airport Handling Manual (AHM) is the policy-oriented ground operations manual: it focuses on what must be standardized, while IGOM focuses on how frontline procedures are performed. AHM Chapter 9 covers airport handling ground support equipment specifications. IATA introduced AHM 908 in the 2023 AHM edition as autonomous-vehicle guidance for airside operation, with a risk assessment included in the toolbox. For the 2026 AHM, IATA notes that AHM 908 introduced new categories for equipment with and without human involvement.

That makes AHM 908 the practical industry bridge between autonomous GSE pilots and airline/ground-handler acceptance. It is not a substitute for FAA approval, airport sponsor authorization, ISO 3691-4 machinery safety, or functional-safety validation. It is the ground-operations standard a GHSP, airline, or airport can use to ask consistent questions: what is the use case, what is the human role, what minimum capabilities are present, what risk assessment was done, what trials prove readiness, and how will the operation be managed after go-live?

## Evidence Model

1. **Use-case definition.** State whether the autonomous GSE performs depot-to-stand transit, baggage-cart towing, cargo movement, FOD patrol, equipment repositioning, aircraft-stand maneuvering, or another bounded task. Identify whether it operates near aircraft, inside an equipment restraint area, across service roads, or only in segregated zones.

2. **Human-involvement category.** Map the operation to the applicable AHM 908 category for equipment with or without human involvement. Define onboard operator, remote monitor, remote controller, dispatcher, marshaller, maintenance technician, and airport operations roles. Record which person can stop the vehicle and which person owns restart authority.

3. **Risk assessment.** Include ground damage, personnel injury, aircraft contact, towing/load instability, route obstruction, lost link, emergency response, cybersecurity, battery/fuel hazard, abnormal weather, degraded sensing, and interaction with conventional GSE. The risk assessment should produce controls, not only a risk matrix.

4. **Minimum capability evidence.** Demonstrate controlled speed, route containment, obstacle/person detection, emergency stop, remote stop if used, audible/visual warning, lighting/marking, safe degraded state, event logging, manual recovery, maintenance diagnostics, and data capture for investigation.

5. **Operational trial plan.** Follow IATA's action sequence for autonomous vehicles: review guidance, verify implementation preparedness, perform operational trials, and prepare the implementation plan. Trials should cover representative shifts, aircraft-stand states, route obstructions, communications degradation, emergency stop activation, handover between automation and humans, and interactions with conventional ramp traffic.

6. **Implementation and oversight.** Define training, competence, maintenance, inspection, calibration, software update, incident reporting, operational restrictions, and interfaces with airline, GHSP, airport, ARFF, ATC, and local regulator processes. Where Enhanced GSE anti-collision features are present, connect them to AHM/GSE fleet validation evidence.

## Acceptance Checks

- The implementation pack cites the exact AHM edition used and identifies the AHM 908 category for the operation.
- The autonomous task is bounded by route, speed, equipment type, load/tow configuration, aircraft-stand condition, weather, lighting, and human-supervision model.
- Risk assessment covers aircraft damage, personnel injury, conventional GSE interaction, emergency vehicles, lost link, degraded sensing, and recovery.
- A trained person can stop the vehicle immediately, and stakeholders know how to trigger or request that stop.
- Trials include representative ramp conditions, not only empty-apron or depot tests.
- Operational procedures explain dispatch, start, pause, stop, restart, manual recovery, blocked route, incident notification, maintenance release, and software update controls.
- Training covers both vehicle-specific behavior and local airport/airline/GHSP rules.
- Maintenance and calibration intervals are defined for sensors, brakes, steering, warning devices, batteries, tires, towing hardware, and safety configuration.
- The final implementation plan integrates AHM 908 with FAA/local regulator, airport sponsor, ISO 3691-4, ISO 13849-1 or IEC 62061, and cybersecurity evidence.

## Failure Modes

- Treating AHM 908 as a full engineering design standard instead of an operational standard that must be paired with machinery safety and functional-safety evidence.
- Failing to classify the human role, leaving ambiguity over who monitors, who controls, who stops, and who restarts.
- Running trials on simplified routes that exclude aircraft proximity, stand equipment clutter, pedestrians, weather, reflective surfaces, and mixed GSE traffic.
- Documenting risk assessment but not tying each risk to a procedure, training control, technical control, or trial result.
- Releasing autonomous GSE into pooled or multi-tenant operations without clear ownership for dispatch, maintenance, incident response, and data review.
- Updating autonomy software, maps, or perception models without notifying operations teams or repeating the relevant AHM 908 acceptance checks.
- Assuming Enhanced GSE anti-collision recognition automatically covers autonomous behavior, remote monitoring, route dispatch, and lost-link recovery.

## Related Repository Docs

- [Airside AGVS Regulatory Approval Playbook](airside-agvs-regulatory-approval-playbook.md)
- [ISO 3691-4 Deep Dive](iso-3691-4-deep-dive.md)
- [Safety Functions PLd/SIL Validation](safety-functions-pld-sil-validation.md)
- [Ground Crew Pedestrian Safety](../../70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md)
- [Ground Safety](../safety-case/ground-safety.md)
- [Incident Reporting Post Market Monitoring](../safety-case/incident-reporting-post-market-monitoring.md)

## Sources

- IATA, [Airport Handling Manual (AHM)](https://www.iata.org/ahm)
- IATA, [Ground Operations Standards](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-ops-standards/)
- IATA, [Ground Support Equipment](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-support-equipment/)
- IATA, [Ground Ops of the Future: Autonomous Vehicles](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-ops-of-the-future/)
- IATA, [What's new in the 2023 IATA manuals](https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/cargo-ground-ops-regulation-manuals-annual-significant-changes/)
- IATA, [Enhanced GSE Recognition Program](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-support-equipment/enhanced-gse-recognition-program/)
