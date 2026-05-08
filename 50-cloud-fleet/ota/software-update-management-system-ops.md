# Software Update Management System Operations

**Last updated:** 2026-05-09

This file covers the operational governance layer for software updates. It complements OTA mechanics by defining how updates are requested, classified, approved, deployed, monitored, rolled back, and audited across code, firmware, models, maps, configuration, calibration, and safety parameters.

For road vehicles subject to type approval, UNECE Regulation No. 156 requires a Software Update Management System (SUMS). Airport, yard, warehouse, port, and campus vehicles may not always be legally in scope, but the SUMS pattern is still the right benchmark because these fleets have the same core risk: a software or data update can change vehicle behavior after deployment.

## Practical Evidence and Artifact Model

| Artifact | Contents | Required for |
|---|---|---|
| SUMS scope register | Vehicle types, ECUs, apps, models, maps, configs, calibration, cloud dependencies, suppliers | Program governance |
| Software/update inventory | Active versions by vehicle, RxSWIN or equivalent software identification, artifact digests, compatibility | Incident response and type/config control |
| Update request | Change purpose, affected artifacts, hazard/security/privacy impact, rollback target, urgency | All production changes |
| Classification record | Safety-related, cybersecurity-related, compliance/type-approval-related, ODD-changing, data-only, emergency | Approval path selection |
| Change impact analysis | Safety case claims, HARA/STPA/SOTIF items, cybersecurity TARA, privacy, operations, training/procedures | Release approval |
| Validation bundle | CI results, SIL/HIL, vehicle tests, simulation, replay, shadow/canary metrics, cybersecurity checks | Release gate |
| Release approval | Safety, security, operations, product/site owner, regulatory if needed | Promotion to production |
| Deployment manifest | Cohorts, windows, prerequisites, package signatures, vehicle eligibility, abort criteria | OTA/fleet ops |
| Rollback plan | Known-good version set, rollback tests, data migration reversibility, cache state | Every non-trivial update |
| Post-deployment report | Activation success, canary metrics, regressions, incidents, final promotion or rollback decision | Closure and audit |

The same manifest must cover behavior-changing models, maps, calibration, and configuration. Many AV incidents are caused by bad combinations, not a single bad binary.

## Update Classification

| Class | Examples | Minimum approval |
|---|---|---|
| Emergency safety/security | Critical vulnerability, unsafe behavior fix, site shutdown workaround | Incident commander, safety officer, security lead, release owner |
| Safety behavior change | Planner, perception, localization, safety monitor, braking, speed, geofence, MRC logic | Safety board or delegated safety authority |
| ODD or site change | New zone, map release, speed zone, operating weather envelope, route class | Site owner, operations, safety |
| Model update | Perception/prediction/planning model, quantization, runtime engine | ML owner, safety, release owner |
| Map/config/calibration | HD map, geofence, sensor calibration, thresholds, feature flags | Maps/calibration owner, operations, safety if behavior-affecting |
| Cloud-only service | Dispatch, telemetry, dashboards, data ingest, user support tooling | Cloud SRE and operations, safety if it affects supervision/control |
| Documentation/training | Operator workflow, maintenance checklist, site SOP | Operations and safety if procedures change |

## Deployment Operations

### 1. Intake and impact analysis

Every update starts with an update request. The first decision is not "can OTA deliver it?" but "what behavior or assurance does it change?" The impact analysis should answer:

- Does this alter a safety function, ODD, safety monitor, map constraint, MRC, or operator control path?
- Does this affect type-approved or CE-marked characteristics for the jurisdiction?
- Does this change cybersecurity posture, cryptographic material, network exposure, or dependency risk?
- Does this change what data is collected, uploaded, retained, or used for ML training?
- Which safety-case claims and evidence IDs are affected?
- Which vehicles are eligible, and which must be excluded due to hardware, calibration, or site constraints?

### 2. Build and package

- Generate signed packages with hashes and compatibility metadata.
- Use release channels: lab, simulation, shadow, internal vehicle, site canary, production.
- Freeze the dependency set for the release candidate.
- Generate SBOM and vulnerability disposition for code and containers.
- Attach model cards or map validation reports for ML/map artifacts.
- Define activation conditions: vehicle parked, brake set, battery threshold, network quality, mission complete, operator acknowledgement if needed.

### 3. Validate before production

Validation should be proportional to update risk:

| Evidence | Applies to |
|---|---|
| Unit/integration/CI | All code updates |
| SIL/HIL regression | Runtime, planning, control, localization, perception, safety monitor |
| Scenario replay | Perception, prediction, planning, maps, calibration |
| Shadow mode | Models and behavior-affecting logic where live comparison is useful |
| Site dry run | Map, route, geofence, speed zone, docking/stand changes |
| Security scan and signing verification | All deployable artifacts |
| Rollback drill | Safety/security updates and any schema/data migration |

### 4. Roll out by risk

Recommended production rollout:

1. One non-critical vehicle or lab vehicle.
2. One operational vehicle in low-risk zone or supervised mode.
3. Site canary cohort.
4. Cross-site representative cohort if the release is multi-site.
5. Full production.

Promotion gates should compare against baseline for safety events, interventions, localization residuals, perception confidence, planner infeasibility, command latency, CPU/GPU/thermal load, mission success, and support tickets.

### 5. Monitor and close

The release is not closed at activation. It closes after:

- All targeted vehicles report the expected active manifest.
- Non-updated vehicles are accounted for.
- Canary and full-fleet metrics meet the release gate.
- No safety-case claims require new evidence beyond what was generated.
- Rollback cache and previous manifests remain available for the defined rollback window.
- The post-deployment report is attached to the update record.

## Regulatory Notes

- UNECE Regulation No. 156 governs software updates and SUMS for in-scope road vehicle categories.
- ISO 24089:2023 specifies software update engineering requirements and recommendations at organizational and project levels.
- The UK Vehicle Certification Agency notes that UN R156 is audit-based and that software update management supports continued regulatory compliance, cybersecurity, and vehicle safety. Its page was last updated on 2024-05-14.
- For EU unlimited series M/N/O categories, VCA lists software-updating application dates including 2022-07-06 for new whole-vehicle type approvals in certain cases, 2024-07-07 for new whole-vehicle type approvals, 2026-07-07 for new complete vehicles, and 2029-07-07 for new completed vehicles, subject to the detailed scope notes on that page.
- For non-road autonomous GSE, industrial trucks, and site robots, treat SUMS as best-practice governance even if R156 is not directly applicable.

## Risks and Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Update changes behavior without safety review | Existing safety case becomes stale | Classification and change impact gate |
| Model, map, and code versions drift | Regression appears only in one combination | Compatibility matrix and unified manifest |
| Update during active mission | Vehicle becomes unavailable or unsafe in field | Activation preconditions and maintenance windows |
| Bad migration prevents rollback | Vehicle stuck on failed version | Reversible migration tests and A/B partitioning |
| Canary not representative | Release passes in easy conditions and fails elsewhere | Cohorts stratified by site, route, weather, hardware |
| Emergency patch bypasses evidence | Short-term fix creates long-term audit gap | Emergency approval plus post-release evidence completion |
| Fleet loses update trust root | Vehicles cannot receive patches | Key ceremony, backup, revocation and rotation drills |
| Cloud-only release breaks supervision | Vehicle operations degrade despite no on-vehicle change | Include cloud services in SUMS scope if they affect safe operation |

## Related Repository Docs

- `50-cloud-fleet/ota/ota-fleet-management.md`
- `40-runtime-systems/software-operations/on-vehicle-supply-chain-runtime-security.md`
- `40-runtime-systems/ml-deployment/production-ml-deployment.md`
- `50-cloud-fleet/map-operations/hd-map-lifecycle-operations.md`
- `50-cloud-fleet/observability/fleet-anomaly-root-cause-attribution.md`
- `60-safety-validation/safety-case/safety-case-evidence-traceability.md`
- `60-safety-validation/cybersecurity/cybersecurity-airside-av.md`

## Sources

- UNECE UN Regulation No. 156, software update and software update management system. https://unece.org/transport/documents/2021/03/standards/un-regulation-no-156-software-update-and-software-update
- ISO 24089:2023, "Road vehicles - Software update engineering." https://www.iso.org/standard/77796.html
- Vehicle Certification Agency, "Cyber Security and Software Updating," last updated 2024-05-14. https://www.vehicle-certification-agency.gov.uk/connected-and-automated-vehicles/cyber-security-and-software-updating/
- Uptane Standard 2.0.0. https://uptane.org/docs/2.0.0/standard/uptane-standard
- The Update Framework. https://theupdateframework.org/
- NIST SP 800-218, Secure Software Development Framework. https://csrc.nist.gov/pubs/sp/800/218/final
- ISO/SAE 21434:2021, "Road vehicles - Cybersecurity engineering." https://www.iso.org/standard/70918.html
- Waymo, "Building a Credible Case for Safety," arXiv, 2023. https://arxiv.org/abs/2306.01917
