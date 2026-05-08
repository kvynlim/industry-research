# EU AI Act and Machinery Compliance Dossier

**Last updated:** 2026-05-09

This dossier model is for autonomous machinery and vehicle-like systems deployed in the EU or sold into EU-regulated supply chains: autonomous GSE, warehouse AMRs, yard tractors, port vehicles, construction/mining/agriculture machines, delivery robots, and similar products with AI, software updates, connectivity, and safety functions.

It maps the EU AI Act, Machinery Regulation, Cyber Resilience Act, revised Product Liability Directive, and sector safety standards into one operational evidence package.

## Date-Sensitive Regulatory Baseline

| Instrument | Key dates as of 2026-05-09 | Practical implication |
|---|---|---|
| EU AI Act, Regulation (EU) 2024/1689 | Entered into force 2024-08-01. The Commission FAQ states most AI Act rules apply 2026-08-02, with high-risk AI systems embedded in regulated products covered by Union harmonisation legislation listed in the AI Act's Annex I applying 2027-08-02 under the original timeline. | Maintain AI classification, risk management, technical documentation, logging, human oversight, accuracy/robustness/cybersecurity, post-market monitoring, and incident reporting evidence. |
| AI Omnibus political agreement | On 2026-05-07 the Commission, Council, and Parliament announced a provisional agreement. The announced dates are 2027-12-02 for stand-alone high-risk AI systems and 2028-08-02 for high-risk AI systems embedded in products. The Council also says the provisional agreement would exempt the Machinery Regulation from direct applicability of the AI Act, with AI-related machinery requirements handled through delegated acts under the Machinery Regulation. | Treat this as a regulatory watch item until formal adoption and Official Journal publication. Do not delete AI Act preparation work; map it to Machinery and sector dossiers. |
| Machinery Regulation, Regulation (EU) 2023/1230 | Applies from 2027-01-20, with limited provisions applying earlier from 2023-07-19. | Autonomous mobile machinery needs a technical file, risk assessment, essential health and safety requirement evidence, instructions, declaration, and CE marking path. |
| Cyber Resilience Act, Regulation (EU) 2024/2847 | Entered into force 2024-12-10. Article 14 reporting obligations apply from 2026-09-11. Full application is 2027-12-11. | Connected products with digital elements need cybersecurity risk assessment, vulnerability handling, security support period, reporting, conformity assessment, and CE-linked documentation. |
| Product Liability Directive, Directive (EU) 2024/2853 | Entered into force 2024-12-09. Applies to products placed on the market or put into service after 2026-12-09. | Software and AI can be treated as products. Keep evidence for defect, warnings, updates, foreseeable use/misuse, and post-market actions. |

## Practical Evidence and Artifact Model

| Dossier section | Evidence to keep |
|---|---|
| Product identity | Product name, variants, serial ranges, intended purpose, users, operating environments, remote processing dependencies |
| Classification | Machinery category, AI system classification, product-with-digital-elements classification, sector rules, exclusions and rationale |
| ODD and use conditions | Site classes, speed, payload, terrain, weather, lighting, connectivity, human interaction, prohibited uses |
| Risk assessment | ISO 12100 machinery risk assessment, HARA/STPA/SOTIF where relevant, cybersecurity TARA, misuse analysis |
| Essential health and safety requirements | Machinery Regulation Annex III evidence, safety functions, protective measures, warnings, instructions |
| AI risk management | Hazards from AI outputs, known limitations, ODD monitors, data/model lifecycle controls, human oversight, logging |
| Data governance | Training/validation/test data requirements, provenance, representativeness, bias and coverage analysis, privacy controls |
| Technical documentation | Architecture, algorithms, model cards, datasets, test reports, logs, change records, post-market monitoring plan |
| Cybersecurity | CRA risk assessment, SBOM, vulnerability handling process, security updates, support period, secure-by-default configuration |
| SUMS/change management | Update classification, impact analysis, release approvals, rollback, field monitoring, customer/site notices |
| Conformity route | Harmonized standards, common specifications, notified body if required, internal production control or third-party assessment |
| Declarations and labels | EU Declaration of Conformity, CE marking, instructions for use, support contacts, incident/vulnerability reporting contacts |
| Post-market monitoring | Complaints, incidents, serious incidents, near misses, safety performance indicators, corrective actions |
| Liability defense file | Design decisions, warnings, foreseeable misuse controls, update history, field monitoring, corrective actions |

## Deployment Operations

### 1. Start with product and system boundaries

Define whether the deliverable is:

- A complete autonomous machine.
- A safety component.
- Software placed separately on the market.
- A cloud service required for a product function.
- A retrofit autonomy kit.
- A fleet operation service rather than a product sale.

This boundary drives manufacturer/importer/distributor roles, technical-file obligations, CRA scope, AI Act provider/deployer obligations, and liability evidence.

### 2. Maintain a regulatory applicability matrix

For each product variant and deployment model, maintain:

| Question | Evidence |
|---|---|
| Is the product machinery under Regulation (EU) 2023/1230? | Classification rationale and standards list |
| Does it include an AI system or safety component using AI? | AI system inventory and intended purpose |
| Is it high risk under AI Act Article 6 or sector rules? | Classification decision tree and legal review |
| Is it a product with digital elements under the CRA? | Connectivity and remote processing assessment |
| Does software update alter safety/compliance characteristics? | SUMS impact classification |
| Which actors are manufacturer, importer, distributor, deployer, operator, and site owner? | Contract and responsibility matrix |

### 3. Build the technical file continuously

Do not assemble the dossier after the design is complete. The file should be built from release evidence:

- Requirements and risk controls.
- Architecture and safety functions.
- ML/data evidence.
- Cybersecurity risk assessment and SBOM.
- Test reports from simulation, lab, track, and field.
- Map and site acceptance evidence.
- Update and rollback evidence.
- Incident and post-market monitoring evidence.

### 4. Align AI, machinery, and cybersecurity changes

A single OTA release may trigger multiple dossiers:

| Change | Dossier impact |
|---|---|
| Perception model retrain | AI technical documentation, data governance, validation, post-market monitoring |
| New geofence or speed-zone logic | Machinery risk controls, safety case, SUMS |
| Remote assistance feature | Human oversight, cybersecurity, operator instructions, privacy |
| New cloud dependency | CRA remote processing, availability assumptions, incident response |
| Vulnerability patch | CRA vulnerability handling, SUMS, product support record |
| ODD expansion | Machinery risk assessment, AI risk management, site instructions, safety case |

### 5. Run regulatory watch as an operations process

Track:

- EU AI Act implementing acts, harmonized standards, common specifications, and the 2026 AI Omnibus formal adoption status.
- Machinery Regulation delegated acts related to high-risk AI systems.
- CRA harmonized standards, reporting platform details, and vulnerability reporting guidance.
- Sector-specific aviation, airport, industrial truck, road, or workplace safety guidance.

## Risks and Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Assuming the 2026 AI Omnibus is final before adoption | Missed obligations if final text changes | Regulatory watch log with "provisional" status |
| Treating Machinery and AI Act as separate silos | Duplicate or contradictory evidence | Unified dossier and crosswalk |
| Misclassifying retrofit kit roles | Wrong party holds manufacturer/provider duties | Role matrix in contracts and technical file |
| Missing CRA remote processing scope | Cloud component excluded from cybersecurity evidence | Product-with-digital-elements assessment |
| No post-market monitoring plan | Cannot show continuing conformity or field learning | Article 72/SOTIF-style monitoring plan |
| Poor data provenance | AI verification and incident defense weakened | Dataset lineage and model release evidence |
| Update changes product safety without dossier update | CE/safety case stale | SUMS impact gate and change impact analysis |
| Instructions omit foreseeable misuse | Product liability exposure | Misuse analysis and warnings validation |

## Related Repository Docs

- `60-safety-validation/standards-certification/certification-guide.md`
- `60-safety-validation/standards-certification/iso-3691-4-deep-dive.md`
- `60-safety-validation/standards-certification/safety-verification-certification.md`
- `60-safety-validation/safety-case/safety-case-evidence-traceability.md`
- `60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md`
- `60-safety-validation/cybersecurity/cybersecurity-airside-av.md`
- `50-cloud-fleet/ota/software-update-management-system-ops.md`
- `40-runtime-systems/software-operations/on-vehicle-supply-chain-runtime-security.md`

## Sources

- Regulation (EU) 2024/1689, Artificial Intelligence Act. https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng
- European Commission, "Navigating the AI Act." https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act
- European Commission, AI Act simplification political agreement, 2026-05-07. https://digital-strategy.ec.europa.eu/en/news/eu-agrees-simplify-ai-rules-boost-innovation-and-ban-nudification-apps-protect-citizens
- Council of the EU, "Artificial Intelligence: Council and Parliament agree to simplify and streamline rules," 2026-05-07. https://www.consilium.europa.eu/en/press/press-releases/2026/05/07/artificial-intelligence-council-and-parliament-agree-to-simplify-and-streamline-rules/pdf/
- Regulation (EU) 2023/1230, machinery safety requirements summary. https://eur-lex.europa.eu/EN/legal-content/summary/machinery-safety-requirements.html
- Regulation (EU) 2024/2847, Cyber Resilience Act. https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- European Commission, Cyber Resilience Act summary and dates. https://digital-strategy.ec.europa.eu/en/policies/cra-summary
- Directive (EU) 2024/2853, Product Liability Directive. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024L2853
- ISO/PAS 8800:2024, "Road vehicles - Safety and artificial intelligence." https://www.iso.org/standard/83303.html
- ISO 3691-4:2023, "Industrial trucks - Safety requirements and verification - Part 4: Driverless industrial trucks and their systems." https://www.iso.org/standard/83545.html
- EASA NPA 2025-07, Artificial intelligence trustworthiness, published 2025-11-10. https://www.easa.europa.eu/en/document-library/notices-of-proposed-amendment/npa-2025-07
