# Airside AGVS Regulatory Approval Playbook

**Last updated:** 2026-05-09

## Why It Matters

Autonomous ground vehicle systems (AGVS) at airports are not yet treated by FAA as ordinary ground vehicles. FAA's May 2025 Emerging Entrants Bulletin says AGVS, including remotely operated equipment, should be limited to testing and demonstration in non-movement areas, certain remote areas, and landside areas until FAA research is complete and formal standards are established. It also makes the airport sponsor the approval authority for testing at its facility and points sponsors to early coordination with FAA regional airport certification, safety, and ADO contacts.

That framing changes the approval strategy. A vendor cannot walk in with a generic AGV certificate and ask to operate on the ramp. The approval artifact must look like a controlled airport test program: defined routes, sponsor authorization, human-monitor takeover, emergency response, stakeholder notification, radio-frequency review where applicable, and airport-specific training. IATA's AHM 908 provides an industry standard anchor for autonomous GSE, but FAA approval still turns on the airport sponsor's safety duties, Part 139 context, grant assurances for federally obligated airports, and local operating procedures.

## Evidence Model

Build the approval pack as a route-specific safety dossier rather than a vehicle brochure.

1. **Operational design domain and route package.** Include maps for every planned route, staging zone, depot, charging location, aircraft-stand boundary, gate-adjacent route, and service-road segment. Mark movement areas, safety areas, object free areas, ILS critical areas, and any closed areas. Show speed limits, stop points, geofences, manual takeover points, wireless coverage assumptions, and areas where the AGVS must always yield to aircraft, pedestrians, and emergency vehicles.

2. **Sponsor and FAA coordination record.** Record the airport sponsor's approval, the FAA office contacted, dates, action owners, and open conditions. For Part 139 airports, include the Airport Certification and Safety Inspector interface. For federally obligated general aviation airports, include the Regional Airports Division or Airports District Office interface. Keep a decision log for any FAA Form 7460-1 aeronautical study determination.

3. **Human-monitor control case.** FAA treats day-to-day use as testing if a human remains capable of instantaneous control after automation failure. Define onboard or remote monitor roles, training, credentialing, SIDA/driving privileges, communications, control latency, and the exact command path used to stop or recover the vehicle.

4. **Emergency and abnormal operations.** Provide lost-link behavior, safe-stop behavior, malfunction reporting, breakdown recovery, removal/tow procedures, ARFF familiarization, fuel or battery isolation, and immediate notification procedures for airport operations, ATCT, ARFF, and affected tenants.

5. **Radio-frequency and infrastructure case.** If the AGVS or its associated infrastructure emits RF, document proposed frequencies, powers, antennas, towers, charging infrastructure, beacons, and communications nodes. The dossier should show whether FAA Form 7460-1 is required and whether an FCC authorization, license, or exemption rationale is in place.

6. **Industry standard mapping.** Map the use case to IATA AHM 908 autonomous GSE guidance, local ground vehicle rules, AC 150/5210-20A training and pedestrian-control expectations, and any airport tenant operating rules.

## Acceptance Checks

- Airport sponsor has approved the test or demonstration in writing and knows the AGVS appearance, safety features, route, location, points of contact, and notification cadence.
- FAA regional/ADO coordination is complete before testing, with open conditions tracked to closure.
- The test area is non-movement, remote, landside, or a closed movement-area/safety-area segment with explicit risk controls and airport sponsor coordination.
- Human monitor can stop the AGVS immediately and has completed airport-approved driver training and local policy familiarization.
- ATC, ARFF, tenants near the route, airport operations, and mutual-aid contacts have been notified where relevant.
- Lost-link, off-course, breakdown, emergency-stop, and recovery procedures have been rehearsed before live airside testing.
- RF emitters and associated ground infrastructure have the required aeronautical study, determination, and FCC basis before operation.
- The AGVS obeys local speed limits, uses required airport vehicle marking and lighting, and carries required insurance.
- A NOTAM or equivalent airport situational-awareness notice is issued when the sponsor requires it.

## Failure Modes

- Treating a low-speed autonomous baggage route as production service when FAA still expects a test or demonstration basis with human takeover.
- Route creep from a controlled apron route into movement areas, object free areas, or ILS critical areas without new sponsor and FAA review.
- Assuming vendor RF equipment is exempt and installing antennas, beacons, or command links without aeronautical study screening.
- Training the vendor operator on the vehicle but not on airport driving, SIDA limits, local radio discipline, or emergency notification.
- Lost-link behavior that stops the vehicle but leaves it blocking an aircraft path, emergency route, or fuel-truck lane.
- Stakeholders recognizing the vehicle but not knowing who can stop it, who to call, or what it does during malfunction.
- Using IATA AHM 908 as the only approval argument without mapping it to FAA, sponsor, and airport-specific rules.

## Related Repository Docs

- [Production Safety Certification for Autonomous Vehicles](certification-guide.md)
- [ISO 3691-4 Deep Dive](iso-3691-4-deep-dive.md)
- [Airside Scenario Taxonomy](../verification-validation/airside-scenario-taxonomy.md)
- [Ground Safety](../safety-case/ground-safety.md)
- [FOD and Jetblast](../../70-operations-domains/airside/operations/fod-and-jetblast.md)

## Sources

- FAA, [Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- FAA, [Emerging Entrants Bulletin 25-02: Testing and Demonstrating AGVS at Federally Obligated Airports](https://www.faa.gov/airports/new_entrants/bulletins/25_02)
- FAA, [Part 139 CertAlert 24-02: AGVS Technology on Airports](https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02)
- FAA, [AC 150/5210-20A: Ground Vehicle Operations to include Taxiing or Towing an Aircraft on Airports](https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5210-20A.pdf)
- IATA, [Airport Handling Manual (AHM)](https://www.iata.org/ahm)
- IATA, [Ground Ops of the Future: Autonomous Vehicles](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-ops-of-the-future/)
- IATA, [Ground Support Equipment](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-support-equipment/)
