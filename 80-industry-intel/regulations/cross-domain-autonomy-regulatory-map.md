# Cross-Domain Autonomy Regulatory Map

**Last updated:** 2026-05-09

## Why It Matters

Autonomy regulation is fragmented by operating domain. An airside baggage tractor, warehouse AMR, mine truck, sidewalk robot, and public-road ADS may use similar perception, planning, remote-assistance, and fleet tooling, but they are accepted through different authorities and evidence packages.

This map turns the regulatory landscape into a practical routing tool: identify the domain, identify the authority, then build the right evidence package instead of assuming one certification story transfers everywhere.

## Evidence/Map

| Domain | Primary gate | Evidence expected | Reporting or post-market posture | Practical consequence |
|---|---|---|---|---|
| U.S. airport airside AGVS | FAA airport sponsor coordination under CertAlert 24-02 and Emerging Entrants Bulletin 25-02. | Controlled environment, route/test plan, stakeholder coordination, trained human monitor, ability to take control, RF/FAA Form 7460-1 and FCC checks where applicable. | Not a full operating approval regime yet; FAA is still developing standards and guidance. | Treat U.S. airside operations as testing/demonstration unless a specific FAA-coordinated path says otherwise. |
| Singapore airport airside AVs | CAAS AC 139-7-7 through the aerodrome operator's ANR-139 processes. | Scope, routes, milestones, training, onboard/remote operator competence, AV behavior, V&V, cybersecurity, contingency plans, data recording, safety indicators. | Monthly safety data, reporting/investigation, and stop/restart criteria after incidents. | Most practical airside template for a production-grade AV safety case today. |
| Warehouses and industrial mobile robots | ISO 3691-4 for driverless industrial trucks; ANSI/A3 R15.08-2 for industrial mobile robot systems and applications. | Site/application risk assessment, protective fields, speed/separation, pedestrian interaction, load handling, fleet traffic rules, maintenance, and validation. | Usually enforced through workplace safety, purchaser requirements, insurer expectations, and conformity assessment rather than a road-style vehicle agency. | Best path for AMRs, AGVs, autonomous forklifts, and many yard robots in controlled facilities. |
| U.S. public-road ADS | FMVSS self-certification unless an exemption is needed; state/local permissions for road operations; NHTSA defect authority. | FMVSS compliance or exemption case, safety case, ODD, crash/incident data, cybersecurity, remote support, state permit evidence. | NHTSA Standing General Order requires named entities to report qualifying ADS and Level 2 ADAS crashes; AV STEP is a proposed voluntary framework, not a substitute for current legal duties. | There is no general federal pre-approval for FMVSS-compliant ADS operations; reporting and recall/defect enforcement matter. |
| EU public-road fully automated vehicles | EU type-approval under Implementing Regulation 2022/1426, amended by 2026/481. | ODD, ADS architecture, nominal/critical/failure scenarios, safety concept, MRM/MRC, cyber and software update evidence, data storage, in-service monitoring, technical-service assessment. | In-use monitoring and type-approval authority oversight; Member States still regulate circulation and service operation details. | Stronger upfront technical approval than the U.S. model, but tightly scoped to vehicle type, ADS feature, and ODD. |
| EU AI/product safety overlay | EU AI Act plus sectoral product safety law, where applicable. | Risk management, data governance, technical documentation, logging, human oversight, accuracy/robustness/cybersecurity, post-market monitoring. | Market surveillance and AI Act enforcement. | Do not treat type approval as the whole compliance story if the autonomy stack includes high-risk AI components. |
| UK public-road automated vehicles | Automated Vehicles Act 2024 framework and secondary legislation. | Self-driving authorization, safety principles, authorized self-driving entity (ASDE), user-in-charge/no-user-in-charge roles, information duties, marketing restrictions. | ASDE remains responsible for authorized self-driving behavior and ongoing regulatory obligations. | Useful comparative model for assigning post-deployment responsibility to a named legal entity. |

## Practical Use

Use the map as a first-pass routing checklist:

1. Define the operating surface: airside, private industrial site, sidewalk, public road, mine, yard, or warehouse.
2. Define the legal vehicle class and whether it is a road motor vehicle, industrial truck, airport ground vehicle, or service robot.
3. Identify the acceptance authority: airport sponsor/regulator, workplace safety regime, road vehicle authority, city permit office, or mine/site owner.
4. Build an evidence matrix with six common columns: ODD, hazards, safety controls, V&V results, data/reporting, and operational responsibility.
5. Add the domain-specific evidence: FAA/CAAS airside stakeholder coordination, ISO/ANSI site risk assessment, NHTSA crash reporting, EU type-approval technical-service assessment, or UK ASDE accountability.

## Failure Modes or Caveats

- A standard is not always a legal approval. ISO 3691-4 or ANSI/A3 R15.08-2 can be strong evidence, but the site owner, insurer, purchaser, or regulator still has to accept it.
- A road approval rarely transfers to airside. Airports add aircraft priority, ATC/operations coordination, apron markings, FOD, jet blast, security areas, and tenant interfaces.
- NHTSA AV STEP should be treated as proposed unless a later Federal Register final rule is confirmed. Current U.S. obligations still revolve around FMVSS compliance/exemptions, state/local operating permissions, defect authority, and the Standing General Order for named reporting entities.
- EU type approval does not erase Member State powers over circulation, local service operation, or infrastructure access.
- The EU AI Act can create horizontal obligations that sit on top of vehicle or machinery approvals.

## Related Repository Docs

- [Airside AGVS FAA/CAAS Regulatory Map](./airside-agvs-faa-caas-regulatory-map.md)
- [U.S. Road ADS Approval and Reporting](./us-road-ads-approval-reporting-nhtsa.md)
- [EU ADS Type Approval 2022/1426 and 2026/481](./eu-ads-type-approval-2022-1426-2026-481.md)
- [Regulatory Trajectory Deep Dive](./regulatory-trajectory-deep-dive.md)
- [EU AI Act Machinery Compliance Dossier](../../60-safety-validation/standards-certification/eu-ai-act-machinery-compliance-dossier.md)
- [Certification Guide](../../60-safety-validation/standards-certification/certification-guide.md)
- [Incident Reporting and Post-Market Monitoring](../../60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md)

## Sources

- FAA, [Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- FAA, [Emerging Entrants Bulletin 25-02](https://www.faa.gov/airports/new_entrants/bulletins/25_02)
- FAA, [Part 139 CertAlert 24-02](https://www.faa.gov/sites/faa.gov/files/arp-part-139-cert-alert-24-02-AV-AVGS.pdf)
- CAAS, [AC 139-7-7 Rev 1](https://www.caas.gov.sg/docs/default-source/docs---srg/ac-139-7-7%281%29-guidance-on-use-of-autonomous-vehicles-at-the-airside%28rev1%29--final.pdf)
- ISO, [ISO 3691-4:2023](https://www.iso.org/standard/83545.html)
- ANSI, [ANSI/A3 R15.08-2-2023](https://webstore.ansi.org/standards/ria/ansia3r15082023)
- NHTSA, [Standing General Order on Crash Reporting](https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting)
- NHTSA, [AV STEP NPRM](https://www.nhtsa.gov/document/nprm-ads-equipped-vehicle-safety-transparency-and-evaluation-program)
- EUR-Lex, [Commission Implementing Regulation (EU) 2022/1426](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R1426)
- EUR-Lex, [Commission Implementing Regulation (EU) 2026/481](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32026R0481)
- European Commission, [AI Act Overview](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- UK legislation, [Automated Vehicles Act 2024 Explanatory Notes](https://www.legislation.gov.uk/ukpga/2024/10/notes/division/3/index.htm)
