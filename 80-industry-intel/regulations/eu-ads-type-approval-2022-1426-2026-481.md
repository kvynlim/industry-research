# EU ADS Type Approval: 2022/1426 and 2026/481

**Last updated:** 2026-05-09

## Why It Matters

The EU has one of the clearest upfront approval structures for fully automated road vehicles. Implementing Regulation (EU) 2022/1426 created uniform procedures and technical specifications for type-approval of automated driving systems (ADS) in fully automated vehicles. Implementing Regulation (EU) 2026/481 amends that framework and adds an automated valet parking (AVP) path that begins lifting the earlier small-series constraint for that use case.

For deployment teams, the EU model is valuable even outside Europe because it defines what a regulator expects in a serious ADS dossier: ODD, safety concept, scenario validation, minimal-risk behavior, cyber/software-update governance, data recording, in-use monitoring, and operational manuals.

## Evidence/Map

| Topic | 2022/1426 baseline | 2026/481 amendment | Practical implication |
|---|---|---|---|
| Scope | Type-approval of fully automated M and N category vehicles with regard to ADS. Covered use cases include predefined-area transport, hub-to-hub routes, and automated valet parking. | Keeps the 2022/1426 architecture but amends definitions and adds AVP-specific Annex V. | Start by classifying the exact ADS feature and ODD. Approval is not generic "self-driving"; it is feature and ODD specific. |
| Safety target | ADS must be free from unreasonable safety risks to occupants and other road users in the relevant ODD. | AVP gets additional safety performance and validation requirements because the use case is low-speed parking-area operation. | Safety claim needs a comparator, acceptance criteria, and validation targets, not just miles driven. |
| Scenario evidence | Requires nominal, critical, and failure scenario selection and validation evidence. | AVP Annex V adds AVP-specific definitions such as AVP trip, transition location, smallest relevant object, safety distance, permanent/static/dynamic objects. | Build scenario libraries around ODD boundaries and operational insufficiencies, including pedestrians, occlusion, infrastructure, and failures. |
| MRM/MRC | Defines minimal risk manoeuvre and minimal risk condition. | AVP requirements preserve the need for safe fallback behavior in the parking ODD. | Every EU-style dossier needs a clear degraded-state and stop/recovery story. |
| Remote intervention | Remote intervention operator may perform allowed support tasks but does not drive the vehicle; ADS continues to perform the dynamic driving task. | AVP may use external infrastructure, but the ADS feature remains bounded by the ODD and technical specifications. | Avoid describing remote assistance as remote driving unless the legal/technical model actually allows direct control. |
| Cyber and software updates | Information document requires cyber-security type approval, cyber-security management system certificate, software update type approval, software-update management certificate, and ADS software identification. | Safety management obligations were clarified to include arrangements with organizations involved in development, manufacturing, or in-use deployment. | Supplier interfaces and software version traceability are approval artifacts, not back-office details. |
| Scale | 2022 framework operated with small-series limitations for fully automated vehicles. | 2026/481 recitals state the small-series limitation is lifted first for AVP; AVP feature active speed must not exceed 30 km/h. | Do not read AVP scale-up as unlimited approval for all robotaxi or hub-to-hub use cases. |

## Practical Use

Build the EU ADS dossier around these work products:

- ODD definition: geography, infrastructure, speed, weather, lighting, road/parking geometry, traffic participants, and external infrastructure dependencies.
- ADS architecture: sensors, compute, actuators, maps, localization, backend, remote capabilities, and safety-relevant interfaces.
- Safety concept: hazards, unreasonable-risk argument, malfunction behavior, operational insufficiency handling, ODD boundary handling, MRM/MRC triggers, and recovery.
- Scenario plan: nominal, critical, and failure scenarios with traceability to ODD, OEDR, traffic rules, VRUs, infrastructure, and environmental conditions.
- V&V evidence: simulation, track/lab tests, real-world tests, tool credibility, uncertainty, pass/fail criteria, and interpretation of results.
- Cyber/software package: UN cyber/software approvals or equivalent certificates, software identification, update eligibility, rollback/version controls, and supplier controls.
- Data and in-use monitoring: stored data elements, access, security, privacy, field performance, incident learning, and type-approval authority reporting.
- Operating manual: roles of owner, transport service operator, onboard operator, remote intervention operator, maintenance, environmental restrictions, and failure instructions.
- AVP-specific addendum: transition locations, parking ODD, smallest relevant object, safety distance, object classes, traffic flow impact, and <=30 km/h active AVP speed claim.

## Failure Modes or Caveats

- EU type approval is scoped to vehicle type, ADS feature, software identity, and ODD. Changes to software, sensors, ODD, remote operations, or external infrastructure can trigger reassessment.
- Member States are not required to predefine areas, routes, or parking facilities under 2022/1426 and may still regulate circulation and local transport service operation.
- The 2026/481 scale improvement is AVP-specific. It should not be used as evidence that all fully automated vehicle use cases are ready for unlimited series approval.
- "Remote intervention" in 2022/1426 is not remote driving. The ADS remains responsible for the dynamic driving task.
- EU AI Act obligations can apply in parallel where the autonomy system or safety components fall within high-risk AI/product safety rules.
- Approval evidence must include both functional safety and operational safety; testing only nominal driving is not enough.

## Related Repository Docs

- [Cross-Domain Autonomy Regulatory Map](./cross-domain-autonomy-regulatory-map.md)
- [U.S. Road ADS Approval and Reporting](./us-road-ads-approval-reporting-nhtsa.md)
- [EU AI Act Machinery Compliance Dossier](../../60-safety-validation/standards-certification/eu-ai-act-machinery-compliance-dossier.md)
- [Certification Guide](../../60-safety-validation/standards-certification/certification-guide.md)
- [Safety Verification Certification](../../60-safety-validation/standards-certification/safety-verification-certification.md)
- [Safety Case Evidence Traceability](../../60-safety-validation/safety-case/safety-case-evidence-traceability.md)
- [Incident Reporting and Post-Market Monitoring](../../60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md)

## Sources

- EUR-Lex, [Commission Implementing Regulation (EU) 2022/1426](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R1426)
- EUR-Lex, [Commission Implementing Regulation (EU) 2026/481](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32026R0481)
- Publications Office of the EU, [Interpretation of EU Regulation 2022/1426 on ADS Type Approval](https://op.europa.eu/en/publication-detail/-/publication/a4c0a3f1-8c17-11f0-bfe2-01aa75ed71a1/language-en)
- European Commission, [AI Act Overview](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- EUR-Lex, [Regulation (EU) 2019/2144 General Safety Regulation](http://data.europa.eu/eli/reg/2019/2144/oj)
