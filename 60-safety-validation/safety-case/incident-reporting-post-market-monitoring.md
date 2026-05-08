# Incident Reporting and Post-Market Monitoring

**Last updated:** 2026-05-09

Post-market monitoring is how the safety case stays alive after launch. It captures incidents, near misses, field performance, misuse, ODD drift, cybersecurity events, customer/site reports, and corrective actions. Incident reporting is the regulated subset of that system. The operational rule is simple: collect and preserve enough evidence to decide reportability quickly, report on time when required, and feed the lessons back into the safety case and release gates.

## Practical Evidence and Artifact Model

| Artifact | Contents | Purpose |
|---|---|---|
| Incident intake record | Event ID, time, site, vehicles, people/assets involved, initial severity, reporter, system state | Starts traceable handling |
| Reportability matrix | Jurisdiction, regulator/customer contract, trigger criteria, deadline, owner, submission status | Prevents missed reporting clocks |
| Forensic evidence package | Vehicle manifest, active map/model/config/calibration, rosbags/MCAPs, video, telemetry, operator actions, cloud logs | Supports investigation and external reports |
| Near-miss record | Trigger, closest approach, safety margin, intervention, ODD condition, contributing factors | Leading indicator for safety improvement |
| Post-market monitoring plan | Signals monitored, thresholds, sampling, review cadence, escalation criteria, safety-case linkage | Meets continuous assurance expectations |
| Trend review | Periodic incident and near-miss rates by site, vehicle, ODD, version, map tile, operator, weather | Detects drift and recurring hazards |
| Corrective and preventive action | Root cause, containment, long-term action, verification, owner, due date | Closes the loop |
| Safety-case change request | Claims, assumptions, hazards, requirements, or evidence affected | Keeps assurance current |
| External communication log | Regulator, airport/site authority, customer, insurer, public statement, timestamps | Preserves transparency record |

The incident evidence package should be immutable after preservation. Investigators may derive working copies, but raw evidence and the active deployment manifest must remain unchanged.

## Reporting and Monitoring Obligations

### United States road AV reporting

NHTSA Standing General Order 2021-01 was first issued on 2021-06-29 and has been amended in 2021, 2023, and 2025. NHTSA's public SGO page states that identified manufacturers and operators must report certain crashes involving ADS or SAE Level 2 ADAS. The current reporting form and trigger definitions should be checked directly before making a submission because the order and data elements have changed over time.

### U.S. airport AGVS coordination

FAA Part 139 CertAlert 24-02, published on 2024-02-15, addresses autonomous ground vehicle systems technology on certificated airports. It emphasizes early FAA coordination for airport AGVS activities. For airside fleets, reportability may also arise from airport SMS, tenant contracts, airport operations procedures, insurer terms, and local civil aviation authority requirements, even when no road-vehicle SGO applies.

### EU AI Act post-market monitoring and incidents

Regulation (EU) 2024/1689 entered into force on 2024-08-01. Article 72 establishes post-market monitoring for high-risk AI systems, and Article 73 establishes serious incident reporting. The European Commission published draft guidance and a reporting template for serious AI incidents on 2025-09-26, with consultation closing on 2025-11-07.

As of 2026-05-09, a political agreement announced on 2026-05-07 would delay high-risk AI obligations to 2027-12-02 for stand-alone high-risk AI systems and 2028-08-02 for high-risk AI systems embedded in products. The Council press release says the agreement is provisional and still requires endorsement, legal-linguistic revision, and formal adoption. Until the final legal text is published, keep both the current AI Act dates and the provisional amended dates in the regulatory watch log.

### SOTIF and aviation AI monitoring

ISO 21448:2022 includes activities during the operation phase needed to achieve and maintain SOTIF. EASA's AI Roadmap 2.0 was published on 2023-05-10, and EASA NPA 2025-07 was published on 2025-11-10 to propose detailed specifications and AMC/GM for AI trustworthiness in aviation in response to the EU AI Act.

## Deployment Operations

### 1. Define reportable and internally reportable events

Use a two-layer taxonomy:

| Layer | Examples |
|---|---|
| Externally reportable candidates | Injury, fatality, tow-away or asset-damage threshold, vulnerable road user involvement, aircraft/critical infrastructure strike, serious AI incident, airport SMS reportable event, cybersecurity incident |
| Internally reportable leading indicators | Near miss, hard brake, MRC activation, emergency stop, remote intervention, ODD exit, perception-map disagreement, repeated rule violation, operator confusion |

Do not wait for final root cause before preserving evidence or starting the reportability clock assessment.

### 2. Preserve evidence immediately

For SEV-0 and SEV-1 events:

1. Freeze vehicle deployment manifest and active map/model/config/calibration IDs.
2. Preserve pre-event and post-event sensor data, telemetry, logs, operator UI actions, remote-assistance sessions, and cloud traces.
3. Preserve site context: weather, lighting, traffic, work orders, NOTAMs, construction, shift handover, maintenance state.
4. Lock evidence against deletion and overwriting.
5. Assign a reportability owner and a safety investigation owner.

### 3. Review field data on a cadence

Post-market monitoring should include:

- Daily safety operations review for severe events and open containment actions.
- Weekly trend review for near misses, interventions, ODD exits, and version correlations.
- Monthly safety performance indicator review by site and vehicle type.
- Release-specific enhanced monitoring after OTA/model/map/config changes.
- Quarterly safety-case review of assumptions that field evidence has weakened or confirmed.

### 4. Feed corrective actions back into release gates

Every closed incident should answer:

- Did the incident invalidate an ODD assumption?
- Did a safety monitor miss or detect late?
- Should a scenario be added to simulation or track testing?
- Does a model dataset need new coverage?
- Does a map or site procedure need change?
- Does operator training or HMI wording need change?
- Does SUMS require a new release gate?

## Risks and Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Reporting clock missed | Regulatory penalty and trust loss | Reportability matrix and named owner on every severe event |
| Severity downplayed too early | Evidence lost or reporting delayed | Classify high until evidence supports downgrade |
| Near misses ignored | Leading indicators never become fixes | Near-miss thresholds and trend reviews |
| Privacy conflicts with evidence retention | Evidence is deleted or over-shared | Legal hold path plus restricted access and redaction policy |
| Root cause stops at "operator error" | System contributors remain | Human factors and system-factor review |
| External narratives diverge from evidence | Regulator/customer trust degrades | Single source of truth, communications lead, decision log |
| Post-market data not linked to safety case | Assurance becomes stale | Safety-case change requests for incidents and trends |
| Multiple reporting regimes conflict | Late, duplicate, or inconsistent reports | Regulator/customer matrix and legal/regulatory review |

## Related Repository Docs

- `60-safety-validation/safety-case/safety-incidents-lessons.md`
- `60-safety-validation/safety-case/safety-case-evidence-traceability.md`
- `50-cloud-fleet/operations/fleet-sre-incident-response.md`
- `50-cloud-fleet/observability/fleet-anomaly-root-cause-attribution.md`
- `40-runtime-systems/data-logging/on-vehicle-data-triage-selective-upload.md`
- `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`
- `60-safety-validation/standards-certification/certification-guide.md`

## Sources

- NHTSA, Standing General Order on Crash Reporting. https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting
- NHTSA, Standing General Order 2021-01 document page. https://www.nhtsa.gov/document/sgo-crash-reporting-adas-ads
- FAA, Part 139 CertAlert 24-02, "Autonomous Ground Vehicle Systems (AGVS) Technology on Airports," 2024-02-15. https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02
- FAA, Autonomous Ground Vehicle Systems on Airports. https://www.faa.gov/airports/new_entrants/agvs_on_airports
- Regulation (EU) 2024/1689, Artificial Intelligence Act. https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng
- European Commission, draft Article 73 AI Act serious incident guidance and reporting template, 2025-09-26. https://digital-strategy.ec.europa.eu/en/consultations/ai-act-commission-issues-draft-guidance-and-reporting-template-serious-ai-incidents-and-seeks
- European Commission, AI Act simplification political agreement, 2026-05-07. https://digital-strategy.ec.europa.eu/en/news/eu-agrees-simplify-ai-rules-boost-innovation-and-ban-nudification-apps-protect-citizens
- Council of the EU, "Artificial Intelligence: Council and Parliament agree to simplify and streamline rules," 2026-05-07. https://www.consilium.europa.eu/en/press/press-releases/2026/05/07/artificial-intelligence-council-and-parliament-agree-to-simplify-and-streamline-rules/pdf/
- ISO 21448:2022, "Road vehicles - Safety of the intended functionality." https://www.iso.org/standard/77490.html
- EASA AI Roadmap 2.0, published 2023-05-10. https://www.easa.europa.eu/en/newsroom-and-events/news/easa-artificial-intelligence-roadmap-20-published
- EASA NPA 2025-07, Artificial intelligence trustworthiness, published 2025-11-10. https://www.easa.europa.eu/en/document-library/notices-of-proposed-amendment/npa-2025-07
