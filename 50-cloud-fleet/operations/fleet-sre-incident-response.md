# Fleet SRE and Incident Response for Autonomous Vehicle Fleets

**Last updated:** 2026-05-09

Fleet SRE is the operating discipline that keeps an autonomous vehicle fleet safe, observable, and recoverable after deployment. It sits between vehicle runtime monitoring, fleet operations, safety assurance, cybersecurity response, and customer/site operations. For AVs, the unit of reliability is not only a cloud service; it is the combined system of vehicles, operators, maps, models, networks, charging, depots, and local site procedures.

## Practical Evidence and Artifact Model

Every production fleet should be able to reconstruct who knew what, when, what authority was exercised, and what evidence supports the final root-cause conclusion. The minimum incident artifact set is:

| Artifact | Contents | Owner | Retention |
|---|---|---|---|
| Incident record | Incident ID, severity, site, affected vehicles, first alert, commander, safety officer, communications lead, current status | Incident commander | Permanent |
| Impact statement | Safety impact, service impact, vehicles stopped, missions aborted, ODD restrictions, affected customers/site stakeholders | Operations lead | Permanent |
| Timeline | Alert, acknowledgement, mitigations, fleet-stop decisions, rollbacks, regulator/customer notifications, recovery | Scribe | Permanent |
| Fleet state snapshot | Vehicle IDs, software/model/map/config/calibration versions, battery state, mission state, ODD state, network state | Fleet SRE | Permanent for reportable events |
| Evidence manifest | Links to rosbags/MCAPs, telemetry windows, logs, traces, operator actions, video, map diffs, OTA records, feature flags | Fleet SRE | Same as source data or legal hold |
| Decision log | Fleet stop, site stop, ODD reduction, rollback, teleoperation disablement, dispatch suspension, evidence freeze | Incident commander and safety officer | Permanent |
| Regulator/customer log | Reportability assessment, deadlines, submission IDs, external communications, follow-up questions | Safety or regulatory owner | Permanent |
| Corrective action plan | Root cause, contributing factors, containment, long-term fixes, verification evidence, assigned owners and due dates | Incident owner | Permanent |
| Safety-case delta | Claims impacted, assumptions invalidated, evidence superseded, residual risk decision | Safety case owner | Permanent |

Incident records should use stable IDs that link to telemetry, deployment manifests, map releases, model registry entries, and safety-case evidence IDs. Do not rely on chat history as the system of record.

## Severity Taxonomy

Severity should be based on safety risk and operational blast radius, not only service uptime.

| Severity | AV fleet trigger | Required response |
|---|---|---|
| SEV-0 Safety critical | Injury, collision with aircraft/person/critical asset, uncontrolled motion, safety monitor defeated, credible cyber control compromise, or regulator-notifiable crash/incident | Immediate fleet or site stop authority available; incident commander, safety officer, security lead, executive, and site authority engaged |
| SEV-1 Major operational safety | Repeated near misses, loss of localization/map validity in an active zone, unsafe OTA regression, systemic remote assistance failure, telemetry loss that prevents supervision | Coordinated incident response; stop or restrict affected cohort; preserve data; start reportability clock assessment |
| SEV-2 Degraded fleet | Mission success, intervention rate, or availability outside SLO; one site or cohort degraded but safety envelope intact | On-call response; rollback or restrict if trend worsens; post-incident review required |
| SEV-3 Component issue | Single vehicle, sensor, charger, depot gateway, or data pipeline problem with bounded impact | Service-owner response; ticket and trend tracking |

When severity is uncertain, classify high, stabilize, and downgrade only after evidence review. PagerDuty's public incident response guidance makes the same operational point: an incident is not the right time to litigate severity.

## Deployment Operations

### 1. Prepare before launch

- Define explicit authority for fleet stop, site stop, ODD restriction, software rollback, map rollback, model disablement, and return-to-service.
- Maintain on-call rotations for fleet SRE, vehicle runtime, maps, OTA, data platform, safety, cybersecurity, and site operations.
- Store runbooks next to dashboards and alerts. Each alert should name the owner, first triage query, likely mitigations, and escalation path.
- Drill SEV-0 and SEV-1 scenarios quarterly: loss of telemetry, bad OTA, stale map, cyber key compromise, unsafe behavior spike, and reportable collision.
- Treat cloud observability and robotics evidence as separate but linked streams: traces/metrics/logs for services, plus rosbags/MCAP/video/diagnostics for vehicle behavior.

### 2. Detect on symptoms

Alert on user-visible and safety-visible symptoms first:

| Signal | Example alert |
|---|---|
| Safety monitor | Safety-envelope violation, emergency stop, hard brake above baseline, near-miss trigger |
| Fleet outcome | Mission failure rate, intervention rate, remote-assistance requests, rider/customer cancellations |
| Vehicle health | Localization covariance, point-cloud density, camera/lidar/radar heartbeat, actuator faults, thermal throttling |
| Operations | Vehicle stuck, charging failure, depot queue, site dispatch backlog, operator overload |
| Cloud and network | Telemetry ingest delay, command acknowledgement latency, map/config distribution failure |
| Change correlation | Regression after software, model, map, calibration, or config release |

OpenTelemetry should carry correlation IDs from fleet APIs through dispatch, OTA, data ingestion, and operator tools. Vehicle data systems should add the same incident IDs to bag/MCAP metadata so cloud traces can be joined with physical evidence.

### 3. Respond with named roles

Use an incident command structure adapted to fleet operations:

| Role | Responsibility |
|---|---|
| Incident commander | Owns response pace, role assignment, decisions, and closure |
| Safety officer | Can veto unsafe recovery; owns fleet-stop and return-to-service risk posture |
| Operations liaison | Coordinates depot/site/airport/warehouse/customer operations |
| Vehicle/runtime lead | Diagnoses vehicle stack, sensors, actuators, runtime monitors |
| Cloud SRE lead | Diagnoses APIs, telemetry, dispatch, OTA, data platform |
| Security lead | Handles compromise assessment, credential containment, forensic preservation |
| Communications lead | Sends internal and external updates with approved facts |
| Scribe | Maintains timeline, decisions, links, and evidence manifest |

### 4. Stabilize before diagnosing

The first operational objective is to remove active risk:

1. Freeze the affected vehicle or cohort if there is credible safety risk.
2. Preserve volatile data before power cycling or overwriting logs.
3. Stop new dispatches into the affected ODD, route, map tile, software cohort, or site zone.
4. Roll back only when the rollback target is known compatible with map/model/config/calibration and has a current safety assessment.
5. Declare return-to-service only after the safety officer accepts residual risk and evidence links are attached.

### 5. Learn without hiding operational factors

Post-incident reviews should cover detection, mitigation, communication, evidence quality, safety-case impact, and recurrence prevention. They should not stop at the proximate code bug. For AV fleets, common contributing factors include site layout changes, map freshness, operator training, weather, comms, maintenance, and release governance.

## Risks and Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| No explicit fleet-stop authority | Operators debate while vehicles continue unsafe work | Written authority matrix, drills, and one-click fleet/site stop paths |
| Alerting on causes instead of symptoms | Real customer or safety impact is missed | SLO and safety indicator alerts at fleet/site/cohort layers |
| Missing vehicle evidence | Root cause cannot be proven; regulator trust degrades | Event ring buffers, immutable upload manifests, legal hold workflow |
| Chat-only incident record | Timeline and decisions are incomplete | Incident tool as system of record; chat mirrors only |
| Rollback creates new mismatch | Older software incompatible with current map/model/config | Compatibility matrix and signed release manifests |
| Cloud incident disables safety operations | Vehicles cannot be supervised or commanded | Local safe-stop policy, degraded offline mode, independent emergency channel |
| Over-broad fleet stop | Unnecessary operational loss and alert desensitization | Cohort/site/ODD-scoped stop options with escalation rules |
| Under-broad containment | Systemic defect remains active in another site or cohort | Blast-radius query by artifact version, site, hardware, and ODD |
| Blame-oriented postmortem | Near misses stop being reported | Just-culture review format and anonymous reporting path |

## Related Repository Docs

- `50-cloud-fleet/observability/fleet-anomaly-root-cause-attribution.md`
- `50-cloud-fleet/fleet-management/fleet-management-dispatch.md`
- `50-cloud-fleet/ota/ota-fleet-management.md`
- `40-runtime-systems/data-logging/on-vehicle-data-triage-selective-upload.md`
- `40-runtime-systems/monitoring-observability/hmi-operator-interface.md`
- `60-safety-validation/safety-case/safety-incidents-lessons.md`
- `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`
- `60-safety-validation/cybersecurity/cybersecurity-airside-av.md`

## Sources

- Google Site Reliability Engineering, "Incident Management Guide." https://static.googleusercontent.com/media/sre.google/en//static/pdf/IncidentManagementGuide.pdf
- NIST SP 800-61 Revision 3, "Incident Response Recommendations and Considerations for Cybersecurity Risk Management," April 2025. https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r3.pdf
- PagerDuty Incident Response Documentation, "Severity Levels." https://response.pagerduty.com/before/severity_levels/
- OpenTelemetry, "What is OpenTelemetry?" https://opentelemetry.io/docs/what-is-opentelemetry/
- Foxglove Docs, "Connecting to data" and robotics observability workflows. https://docs.foxglove.dev/docs/connecting-to-data/introduction
- ROS 2 `diagnostic_aggregator` documentation. https://docs.ros.org/en/ros2_packages/rolling/api/diagnostic_aggregator/
- Waymo Safety. https://www.waymo.com/safety/
- NHTSA Standing General Order on Crash Reporting. https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting
