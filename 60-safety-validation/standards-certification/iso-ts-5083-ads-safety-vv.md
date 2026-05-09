# ISO/TS 5083 ADS Safety V&V

**Last updated:** 2026-05-09

## Why It Matters

ISO/TS 5083:2025 is the current ISO technical specification for safety of automated driving systems (ADS), covering safety by design, verification and validation, post-deployment activities, and cybersecurity considerations for level 3 and level 4 ADS features in road vehicles. It replaced ISO/TR 4804:2020 and was published in April 2025.

Airport autonomous GSE is not the road-vehicle target of ISO/TS 5083, and a baggage tug should not claim direct road ADS conformity from this document alone. The value is methodological: ISO/TS 5083 gives a modern ADS safety structure that can strengthen an airside safety case alongside ISO 3691-4, ISO 13849-1, IEC 62061, FAA AGVS guidance, and IATA AHM 908. Use it to organize safety objectives, ODD definition, scenario-based V&V, cybersecurity interfaces, post-deployment monitoring, and evidence traceability for autonomous behaviors that exceed traditional AGV route following.

## Evidence Model

1. **Applicability statement.** Start each use of ISO/TS 5083 with a boundary statement: the vehicle is airport GSE or an industrial truck, not a public-road ADS. Identify which concepts are adopted by analogy and which requirements are satisfied by other standards or local rules.

2. **Top-level safety objectives.** Define objectives for no collision with people, aircraft, GSE, infrastructure, FOD, and restricted areas; no unsafe route departure; no unsafe speed; no unsafe interaction with emergency vehicles; and no unsafe behavior after sensor, compute, communications, or localization degradation.

3. **Operational design domain.** Describe airside ODD in measurable terms: route classes, apron/gate geometry, allowed traffic participants, operating speeds, lighting, weather, surface condition, GNSS availability, wireless coverage, aircraft-stand constraints, towing/load limits, and excluded areas such as active runways or movement areas unless separately approved.

4. **Scenario-based V&V.** Build a functional/logical/concrete scenario catalog for airside operations. Include nominal routes, route blockage, pedestrian crossing, marshaller signals if relevant, aircraft pushback adjacency, emergency vehicle priority, temporary works, cone lines, reflective rain surfaces, lost localization, remote-assist takeover, and FOD/jetblast zones. Link each scenario to safety objectives and pass/fail criteria.

5. **Layered verification.** Use analysis, simulation, closed-course tests, depot tests, shadow-mode route runs, supervised airside trials, and post-deployment monitoring. The evidence should show correlation between simulation and physical tests, coverage of ODD slices, regression stability across software releases, and clear exit criteria for expanding the ODD.

6. **Cybersecurity and data interfaces.** Treat ADS safety and cybersecurity together where compromise can affect safety: remote command, maps, route dispatch, OTA updates, perception models, time synchronization, V2X or fleet communications, and maintenance ports.

7. **Post-deployment safety management.** Define field monitoring, incident triage, anomaly capture, fleet-wide rollback, ODD restriction, and safety-case update triggers before deployment.

## Acceptance Checks

- The safety case explicitly states ISO/TS 5083 is applied by analogy and does not replace ISO 3691-4, FAA sponsor approval, or IATA AHM 908 obligations.
- Every ADS behavior has a top-level safety objective, scenario coverage, verification method, responsible owner, and evidence artifact.
- ODD limits are machine-enforceable where practical: route polygons, speed maps, weather limits, wireless minimums, localization quality, and load/tow configuration.
- Simulation results are not used alone for release unless correlated with real airside or representative physical tests.
- V&V includes negative and degraded cases, not only successful route completion.
- Scenario coverage is tracked by ODD slice and risk priority; untested slices produce an ODD restriction or explicit residual-risk decision.
- Cybersecurity assumptions that affect motion control, maps, safety monitors, or remote stop are linked to safety hazards.
- Post-deployment monitoring has thresholds for rollback, route suspension, model freeze, or reverting to manual/human-monitored operation.

## Failure Modes

- Presenting ISO/TS 5083 as a certification basis for airport GSE without explaining its road-vehicle scope.
- Defining ODD in prose only, leaving the vehicle unable to enforce weather, route, speed, or localization limits.
- Running many nominal route miles while missing rare but severe scenarios such as aircraft-stand intrusion, emergency vehicle conflict, or lost-link recovery.
- Treating simulation as complete proof despite unvalidated sensor artifacts, apron reflections, unusual lighting, and aircraft geometry.
- Expanding from remote closed-area testing to mixed ramp traffic without a new scenario coverage argument.
- Omitting cybersecurity from safety because it is handled by a different team.
- Capturing field anomalies but failing to connect them to release gates, ODD restrictions, or safety-case updates.

## Related Repository Docs

- [Airside Scenario Taxonomy](../verification-validation/airside-scenario-taxonomy.md)
- [Testing Validation Methodology](../verification-validation/testing-validation-methodology.md)
- [Shadow Mode](../verification-validation/shadow-mode.md)
- [Weather Adaptive ODD Management](../runtime-assurance/weather-adaptive-odd-management.md)
- [Runtime Verification Monitoring](../runtime-assurance/runtime-verification-monitoring.md)
- [Cybersecurity Airside AV](../cybersecurity/cybersecurity-airside-av.md)

## Sources

- ISO, [ISO/TS 5083:2025 - Safety for automated driving systems](https://www.iso.org/standard/81920.html)
- ISO, [ISO/TR 4804:2020 - Previous ADS safety and cybersecurity specification](https://www.iso.org/standard/80363.html)
- ISO, [ISO 3691-4:2023 - Driverless industrial trucks and their systems](https://www.iso.org/standard/83545.html)
- FAA, [Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- IATA, [Ground Ops of the Future: Autonomous Vehicles](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-ops-of-the-future/)
