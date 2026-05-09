# U.S. Road ADS Approval and Reporting: NHTSA

**Last updated:** 2026-05-09

## Why It Matters

The U.S. road ADS regime is not a single "NHTSA approval" pathway. FMVSS-compliant vehicles can generally be introduced under manufacturer self-certification, subject to defect/recall authority and state/local operating rules. Nonconforming ADS-equipped vehicles need an exemption path. Separately, NHTSA's Standing General Order creates mandatory crash reporting for named ADS and Level 2 ADAS manufacturers/operators.

For practical planning, separate four questions: Does the vehicle comply with FMVSS? Does it need a Part 555 or other exemption? Is the operator named under the Standing General Order? What state or local permission is required for the ODD?

## Evidence/Map

| Instrument | Status/use | What it requires or enables | Practical implication |
|---|---|---|---|
| FMVSS self-certification | Baseline U.S. motor-vehicle framework. | Manufacturers certify compliance with applicable Federal Motor Vehicle Safety Standards. NHTSA can investigate defects and require recalls/remedies. | A compliant ADS-equipped vehicle does not generally need NHTSA pre-approval only because it has ADS. |
| Part 555 exemptions | Existing exemption route for vehicles that do not comply with one or more FMVSS. NHTSA announced 2025 process improvements for ADS-related exemptions. | NHTSA can grant time-limited exemptions if statutory criteria are met and the exemption is consistent with public interest and the Safety Act. | Purpose-built driverless vehicles without traditional controls usually need an exemption or a revised FMVSS basis. |
| AV STEP | Proposed in a January 2025 NPRM as a voluntary ADS-equipped Vehicle Safety, Transparency, and Evaluation Program. | Would add application, participation, public reporting, independent assessment, event-triggered reporting, periodic reporting, and possible ADS-tailored exemption processes. | Treat as proposed unless a later final rule is confirmed. It is not a substitute for current FMVSS, exemption, SGO, or state/local obligations. |
| Standing General Order 2021-01, third amended | Effective June 16, 2025 for served manufacturers/operators. | Requires reports for qualifying crashes involving ADS or Level 2 ADAS engaged within 30 seconds before crash onset through crash conclusion. | Mandatory for named entities; not voluntary; violations can carry civil penalties. |
| AV TEST Initiative | Voluntary transparency program and public tracking tool. | States and companies can voluntarily submit testing information. | Useful public signal but not a legal approval and not a substitute for SGO reporting. |

### Standing General Order Reporting Map

| Crash class | Trigger | Timing |
|---|---|---|
| Higher-severity ADS or Level 2 ADAS crash | Publicly accessible U.S. road; ADS or Level 2 ADAS engaged within the 30-second window; fatality, hospital transport, vulnerable road user strike, airbag deployment, or vehicle tow-away when the subject vehicle is ADS-equipped. | Incident report within five calendar days after notice. |
| Lower-severity ADS property damage crash | Publicly accessible U.S. road; ADS engaged within the 30-second window; property damage expected above $1,000, or lower damage where the ADS subject vehicle was the only vehicle involved or struck another vehicle/object. | Monthly report by the fifteenth day of the following month. |
| Updated information | Material new or different information for key report fields such as VIN, engagement status, severity, damage, pre-crash movement, airbag status, data availability, or narrative. | Update by the fifteenth day of the month following receipt of new information. |

## Practical Use

For a U.S. public-road ADS pilot or commercial launch:

1. Classify the vehicle design: conventional FMVSS-compliant vehicle, modified conventional vehicle, imported nonconforming vehicle, domestic nonconforming vehicle, or purpose-built ADS vehicle.
2. Build the FMVSS matrix and identify any standards affected by missing manual controls, unconventional seating, glazing, mirrors, brake controls, lamps, displays, or occupant protection assumptions.
3. If nonconforming, prepare an exemption package and monitor NHTSA's current ADS exemption instructions and AV Framework updates.
4. Build the state/local operating permit map for the ODD.
5. Check whether the manufacturer, ADS developer, fleet operator, or system integrator is served under the SGO.
6. Implement incident data capture before launch: engagement state, 30-second pre-crash window, vehicle damage, VRU involvement, airbag/tow-away/hospital fields, narrative, and update workflow.
7. Keep AV TEST, VSSA-style materials, and public safety reports separate from mandatory reporting obligations.

## Failure Modes or Caveats

- SGO reporting data is not normalized by miles, ODD, fleet size, sensor coverage, or reporting entity data access. Do not rank company safety from raw counts alone.
- A manufacturer with better telemetry can appear to have more incidents simply because it detects and reports more qualifying events.
- AV STEP is an NPRM in the sources checked here; planning should not assume final eligibility, reporting cadence, or exemption mechanics until a final rule is confirmed.
- NHTSA authority does not remove state and local operating constraints.
- SGO applies only to named reporting entities; individual consumers and unrelated dealers are not directly subject to it.
- NHTSA defect authority remains active even when a vehicle is FMVSS-compliant or exempted.

## Related Repository Docs

- [Cross-Domain Autonomy Regulatory Map](./cross-domain-autonomy-regulatory-map.md)
- [EU ADS Type Approval 2022/1426 and 2026/481](./eu-ads-type-approval-2022-1426-2026-481.md)
- [Incident Reporting and Post-Market Monitoring](../../60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md)
- [Robotaxi Service Operations](../../70-operations-domains/road-av/operations/robotaxi-service-operations.md)
- [Autonomous Trucking Lane Operations](../../70-operations-domains/road-av/operations/autonomous-trucking-lane-operations.md)
- [Safety Case Evidence Traceability](../../60-safety-validation/safety-case/safety-case-evidence-traceability.md)
- [Formal Methods Regulatory](../../60-safety-validation/standards-certification/formal-methods-regulatory.md)

## Sources

- NHTSA, [Standing General Order on Crash Reporting](https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting)
- NHTSA, [Third Amended Standing General Order 2021-01](https://www.nhtsa.gov/document/sgo-crash-reporting-adas-ads)
- NHTSA, [AV STEP NPRM](https://www.nhtsa.gov/document/nprm-ads-equipped-vehicle-safety-transparency-and-evaluation-program)
- NHTSA, [Automated Vehicles for Safety](https://www.nhtsa.gov/vehicle-safety/automated-vehicles-safety)
- NHTSA, [Part 555 Letter, June 2025](https://www.nhtsa.gov/sites/nhtsa.gov/files/2025-06/part-555-letter-june-2025.pdf)
- NHTSA, [Report to Congress: Research and Rulemaking Activities on ADS](https://www.nhtsa.gov/document/report-congress-research-and-rulemaking-vehicles-equipped-automated-driving-systems-july)
- NHTSA, [AV TEST Initiative Tracking Tool](https://www.nhtsa.gov/automated-vehicle-test-tracking-tool)
