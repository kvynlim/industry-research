# Airside AGVS FAA/CAAS Regulatory Map

**Last updated:** 2026-05-09

## Why It Matters

Airside AGVS regulation has moved from "no clear authorization" toward controlled testing and structured acceptance, but the U.S. and Singapore are not in the same place. FAA guidance is still mainly a coordination and testing posture. CAAS AC 139-7-7 is a much more prescriptive operating framework for aerodrome operators evaluating autonomous vehicles at the airside.

For deployment planning, the useful move is to build one evidence package that satisfies CAAS-level rigor while mapping each item to the FAA's current testing and demonstration expectations.

## Evidence/Map

| Topic | FAA posture | CAAS posture | Practical artifact |
|---|---|---|---|
| Baseline authority | CertAlert 24-02 said AGVS testing, deployment, and operation for airside use had not been authorized at Part 139 certificated and federally obligated airports. | AC 139-7-7 Rev 1 provides guidance for experimentation and use of autonomous vehicles at the airside under ANR-139. | Regulatory basis memo with jurisdiction, airport class, area, route, and proposed activity. |
| 2025 update | Bulletin 25-02 supports testing/demonstrations in non-movement, remote, and landside areas until FAA standards/guidance are established. It also treats some day-to-day use as testing if a human operator can regain instantaneous control. | CAAS sets staged evaluation expectations, including AV trials, operational behavior, training, V&V, coordination, infrastructure, cybersecurity, reporting, contingency planning, and safety performance monitoring. | Phase plan: closed test, supervised route, live route, remote operations, expansion criteria. |
| Movement area | FAA does not treat active movement areas, safety areas, or object-free areas as controlled environments. FAA FAQs allow operational testing in movement areas only when closed to aircraft operations, with grant-assurance and safety-risk coordination. | CAAS guidance addresses airside operations broadly through aerodrome-operator controls, local rules, driver/operator competence, right-of-way, and performance validation. | Area classification: landside, remote airfield, non-movement area, closed movement area, active movement area. |
| Human control | FAA recommends a human monitor physically in or near the AGVS around moving aircraft, employees, vehicles, or equipment; the monitor should be badged/trained and able to take control at any time. | CAAS defines onboard safety driver and remote operator roles, requires training and competency checks, and tests hazard response, handover, emergency response, and situation awareness. | Operator concept: onboard, chase, remote monitor, remote controller, response time, handover protocol. |
| RF and infrastructure | Bulletin 25-02 requires FAA Form 7460-1 aeronautical study for AGVS RF emitters or related ground infrastructure, plus FCC authorization/license analysis where required. | CAAS includes infrastructure and cybersecurity considerations, including standards such as ISO/SAE 21434, TR68 Part 3, and ISO 27001. | RF/cyber annex: frequencies, power, antenna locations, FCC/FAA status, cyber controls, remote-link degradation behavior. |
| Data and incidents | FAA asks sponsors to request vehicle overview, test plan, RF/FCC evidence, FAA aeronautical determination if applicable, and use a safety-considerations checklist. | CAAS Appendix A specifies minimum recorder data, including time, location, speed, mode, overrides, steering/braking/acceleration, front/rear video, weather, network parameters, faults, and incident windows. | Data contract: logs, video, overrides, faults, remote commands, retention, incident export, privacy/security controls. |
| Stop/restart | FAA guidance is less prescriptive and relies on sponsor oversight and FAA coordination. | CAAS says if preliminary findings indicate autonomous driving directly caused an accident or incident, trials or operations with the same model should stop, and restart only after safety issues are resolved or the cause is shown not to be AV-contributed or fleet-systematic. | Incident decision tree with stop thresholds, fleet quarantine, root-cause review, corrective action, and restart approval. |

## Practical Use

For a U.S. Part 139 airport pilot, start with the FAA package:

- Contact the regional Airport Certification Safety Inspector or ADO early.
- Define the activity as testing or demonstration unless a stronger written authorization exists.
- Keep the initial ODD in a remote, landside, or non-movement area.
- Add route maps, operating hours, stakeholder notifications, ATC/ARFF coordination, human monitor controls, training records, emergency stop/recovery procedures, and grant-assurance review if closures are involved.
- File FAA Form 7460-1 for AGVS RF emitters or AGVS-related ground infrastructure when applicable.

For a Singapore-style or globally portable airside package, add CAAS-level evidence:

- Staged trial plan with entry/exit criteria.
- Onboard safety driver and remote operator competency tests.
- AV behavior requirements for speed, separation, lane discipline, stop lines, pedestrian crossings, aircraft/tow/pushback right-of-way, emergency vehicles, malfunction, rain, night operations, and ODD exits.
- Data recorder specification and monthly safety performance indicators.
- Contingency plan for malfunction, cyberattack, fire, collision, operator absence, external system failure, weather, and remote-control center failure.

## Failure Modes or Caveats

- FAA Bulletin 25-02 is not a production certification standard. It is a testing/demonstration coordination framework while FAA research and standards work continues.
- "Controlled environment" does not mean ATC-controlled airspace. It means lower-risk operating areas such as non-movement, remote, or landside areas.
- Closing movement areas solely for AGVS tests can create access and grant-assurance issues.
- A safety driver or remote operator weakens claims of full autonomy but strengthens the regulatory case for early deployment.
- CAAS evidence is portable as best practice, but CAAS acceptance does not authorize U.S., EU, or other airport operations.
- Airside autonomy must respect aircraft priority, jet blast/FOD controls, airport security rules, tenant coordination, and existing airside vehicle training requirements.

## Related Repository Docs

- [Regulatory Trajectory Deep Dive](./regulatory-trajectory-deep-dive.md)
- [Insurance Liability Airside](./insurance-liability-airside.md)
- [Cross-Domain Autonomy Regulatory Map](./cross-domain-autonomy-regulatory-map.md)
- [Changi Autonomous GSE Programme](../companies/changi-programme/autonomous-gse-programme.md)
- [Aviation Ground Operations Ecosystem](../../70-operations-domains/airside/operations/aviation-ground-ops-ecosystem.md)
- [Ground Control Instructions](../../70-operations-domains/airside/operations/ground-control-instructions.md)
- [Ground Crew Pedestrian Safety](../../70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md)
- [Cybersecurity Airside AV](../../60-safety-validation/cybersecurity/cybersecurity-airside-av.md)

## Sources

- FAA, [Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- FAA, [Part 139 CertAlert 24-02: Autonomous Ground Vehicle Systems Technology on Airports](https://www.faa.gov/sites/faa.gov/files/arp-part-139-cert-alert-24-02-AV-AVGS.pdf)
- FAA, [Emerging Entrants Bulletin 25-02: Testing and Demonstrating AGVS at Federally Obligated Airports](https://www.faa.gov/airports/new_entrants/bulletins/25_02)
- CAAS, [AC 139-7-7 Rev 1: Guidance on the Use of Autonomous Vehicles at the Airside](https://www.caas.gov.sg/docs/default-source/docs---srg/ac-139-7-7%281%29-guidance-on-use-of-autonomous-vehicles-at-the-airside%28rev1%29--final.pdf)
- CAAS, [Aerodrome Advisory Circulars](https://www.caas.gov.sg/legislation-regulations/guidelines-advisory/aerodrome)
- UISEE, [Changi Airport Autonomous Tractor Fleet Launch](https://www.uisee.com/en/article226-news2.html)
