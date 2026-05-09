# Airside Map Hygiene Regulatory Evidence

**Last updated:** 2026-05-09

Airside map hygiene is not only a mapping quality topic. For autonomous ground vehicle systems (AGVS), a map release can affect the airport sponsor's controlled test envelope, vehicle routes, FOD handling, human monitor assumptions, and evidence that the system does not compromise airport safety.

## Regulatory Context

| Source | Practical reading for map hygiene |
|---|---|
| FAA AGVS on Airports | AGVS applications include airside service vehicles and FOD detection/retrieval; testing should be coordinated with FAA contacts and airport sponsor stakeholders |
| FAA CertAlert 24-02 | AGVS testing/deployment/operation for airside use had not been authorized broadly; FAA supports testing in controlled environments |
| FAA Bulletin 25-02 | AGVS cannot be the sole means of Part 139 compliance until FAA standards are established; human monitor and controlled test planning matter |
| FAA FOD Program | FOD is a continuing safety concern and airport FOD management is an established safety program |
| FAA AC 150/5220-24 | FOD detection equipment guidance provides performance-specification thinking for detecting airport foreign objects |

## Evidence Claims

| Claim | Map-hygiene evidence |
|---|---|
| The AGVS operates inside the approved test envelope. | map version, route/stand scope, geofence, closed-area status, ODD limits |
| The map does not erase safety-critical airport features. | static preservation report, semantic validation, reviewer decisions |
| Dynamic clutter is not promoted into permanent map truth. | dynamic rejection metrics, movable-static lifecycle policy, removed-layer archive |
| FOD evidence is not silently discarded. | FOD retention report, alert/ticket linkage, false-deletion test results |
| The airport sponsor can control risk. | publication gates, canary plan, rollback bundle, operator briefing |
| Human monitor assumptions remain valid. | route map, intervention zones, remote/local control capability, test plan trace |
| RF or infrastructure impacts are identified. | AGVS equipment manifest and FAA Form 7460-1 dependency if applicable |

## Safety Case Structure

| Argument node | Evidence package |
|---|---|
| Context | airport, area, route, stand, vehicle, software, sensor rig, map bundle, ODD |
| Hazards | false-free-space, false deletion, stale map, FOD deletion, coordinate error, semantic break |
| Controls | map publication gates, quarantine, human review, perception priority, rollback, monitor alerts |
| Verification | static preservation, FOD retention, sparse LiDAR, localization replay, Lanelet2 validation |
| Validation | target-airport scenarios, controlled AGVS test plan, busy/quiet stand captures |
| Operations | active map reporting, canary telemetry, FOD workflow, incident log retention |
| Change management | map diff, release approver, rollback target, post-release monitoring window |

## Regulatory Evidence Matrix

| Evidence | Minimum fields | Release gate |
|---|---|---|
| Test/demo plan trace | operating area, route, time, participants, human monitor, communications, fallback | safety release |
| Map package manifest | map ID, checksum, coordinate frame, active layers, compatible vehicle/software | deployment |
| Geofence and route proof | no-go areas, closed areas, route reachability, stand boundaries | semantic validation |
| FOD interface | alert route, inspection ticket, closure status, retained evidence link | FOD retention |
| Sponsor/operator briefing | changed zones, temporary overlays, restrictions, rollback instructions | deployment |
| Post-release monitoring | localization, interventions, map disagreement, FOD tickets, incidents | canary promotion |
| Incident retention | active/prior map IDs, raw logs, removed layers, reviewer records | operations |

## Practical Acceptance Rules

1. Do not present dynamic-object removal as a substitute for airport FOD management.
2. Do not let an AGVS map release expand the approved test area without sponsor and FAA coordination where required.
3. Treat map changes as safety-relevant configuration changes with versioned evidence.
4. Keep raw, removed, and rejected map evidence for incident investigation.
5. Make perception and current-world hazards authoritative over static map assumptions.
6. Document residual risks for sparse sensing, temporary assets, FOD minimum size, and weather/lighting limits.
7. If a release affects human monitor placement or takeover access, update the test/demo plan.

## Source Caveats

FAA AGVS material is guidance and awareness material, not a technical map-cleaning standard. Public datasets and research benchmarks support evidence design, but target-airport validation remains required for any airside safety case.

## Sources

- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Part 139 CertAlert 24-02: https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02
- FAA CertAlert 24-02 PDF: https://www.faa.gov/sites/faa.gov/files/arp-part-139-cert-alert-24-02-AV-AVGS.pdf
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- FAA AC 150/5210-24A, Airport FOD Management: https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5210-24
- FAA AC 150/5220-24, FOD Detection Equipment: https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentNumber/150_5220-24
- Local context: ../verification-validation/map-publication-gates-dynamic-object-removal.md
