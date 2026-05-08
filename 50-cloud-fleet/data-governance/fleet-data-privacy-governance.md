# Fleet Data Privacy Governance

**Last updated:** 2026-05-09

Autonomous vehicle fleets collect sensitive operational data by default: precise location, facility layouts, worker movements, passenger/rider behavior, faces, license plates, aircraft and cargo activity, operator actions, telemetry, and incident video. Privacy governance is therefore part of fleet safety and operational readiness. It determines what the fleet may collect, why it may collect it, how long it may retain it, who may access it, and how deletion or restriction propagates into training datasets and incident archives.

## Practical Evidence and Artifact Model

The governance system should produce reviewable artifacts, not only policy text:

| Artifact | Contents | Trigger |
|---|---|---|
| Data inventory | Signal name, source, sample rate, personal/sensitive classification, site, storage, consumers, retention | New sensor, topic, camera, fleet API, or data product |
| Data Protection Impact Assessment or PIA | Processing purpose, legal basis, risks to people, mitigations, residual risk, approval | New personal-data use, new jurisdiction, new analytics/training use |
| Collection campaign approval | Data requested, purpose, minimization rationale, geographic/ODD limits, upload budget, expiry | Any targeted collection or edge-case mining campaign |
| Redaction/anonymization manifest | Faces, plates, badges, audio, operator IDs, location granularity, applied tool/version, QA sample | Camera/audio/human-observable data before broad use |
| Access control record | Roles, approval ticket, dataset/project scope, expiry, privileged access review | Granting access to raw or sensitive fleet data |
| Retention schedule | Hot/warm/cold tiers, legal hold exception, incident retention, training-set retention, deletion owner | Dataset registration |
| Deletion propagation record | Raw data, derived clips, labels, embeddings, training splits, model cards affected | Data subject request, contract expiry, site offboarding |
| Vendor and transfer record | Processor/controller roles, DPA, cross-border transfer mechanism, subprocessors, security review | External tooling, annotation, cloud, analytics, support |
| Dataset lineage | Source clips, labels, redaction state, consent/contract scope, split membership, model versions trained | Model training or validation release |

Each high-value dataset should have a data sheet that says whether it can be used for safety analysis, model training, product analytics, customer reporting, regulator response, or only incident forensics.

## Data Classification for AV Fleets

| Class | Examples | Default handling |
|---|---|---|
| Public or non-sensitive | Synthetic maps, public road signs, open benchmark datasets | Normal engineering controls |
| Operational confidential | Site maps, routes, depot layouts, flight/stand schedules, cargo workflows | Need-to-know access, contractual restrictions |
| Personal data | Faces, bodies, voices, badges, operator IDs, precise trip/location traces | Purpose limitation, access approval, minimization, retention limits |
| Sensitive or high-risk personal data | Biometrics, union/employment signals, health/disability indicators, religious/political location inference | Avoid collection unless strictly necessary and legally approved |
| Safety/legal hold data | Crash, near miss, regulator-reportable incident, security event | Immutable retention with restricted access and legal owner |
| Security secrets | Credentials, certificates, private keys, tokens captured in logs | Never intentionally collect; redact and rotate if exposed |

The FTC warned on 14 May 2024 that connected cars can collect biometric, telematic, geolocation, video, and other personal information, and specifically identified persistent precise geolocation as sensitive. Fleet operators should assume regulators will scrutinize secondary uses, monetization, and undisclosed sharing of vehicle data.

## Deployment Operations

### 1. Privacy intake for new data

Any new sensor, ROS topic, log field, model output, dashboard, annotation project, or customer report should pass an intake check:

1. What decision or safety claim requires the data?
2. Can the same purpose be met with lower rate, lower resolution, shorter window, on-device aggregation, or synthetic data?
3. Does the data identify people directly or indirectly?
4. Which jurisdiction, contract, airport/site rule, or customer policy applies?
5. Who can approve raw access, and when does access expire?
6. How will deletion and retention propagate to derived data?

### 2. Minimize at the edge

Use vehicle-side controls before upload:

- Tiered recording instead of full-fidelity always-on logging.
- Event-triggered clips with pre/post windows instead of full shifts.
- On-device face/plate/badge redaction when camera data is not needed for raw forensic review.
- Location coarsening for product analytics.
- Hash or pseudonymize operator IDs except where accountable safety operations require identity.
- Separate incident legal-hold data from normal training data.

### 3. Control dataset access

Raw fleet data access should be time-bounded and purpose-bounded. Annotation vendors, MLOps notebooks, and analytics warehouses should receive the minimum derivative needed for the job. Access reviews should check dormant accounts, contractors, annotation tools, exported files, and local downloads.

### 4. Govern training and evaluation reuse

Fleet logs often move from operations into ML training. That transition needs its own release gate:

| Gate | Evidence |
|---|---|
| Scope | The collection purpose permits training or validation reuse |
| Redaction | Required redaction completed and QA sampled |
| Lineage | Source clips and labels are traceable |
| Split integrity | No privacy-deleted or legally restricted clips in train/val/test |
| Vendor controls | Annotation and labeling processors have approved DPAs and security controls |
| Retention | Dataset and derived model retention are defined |

### 5. Monitor platform changes

Cloud service status can affect governance. AWS announced that AWS IoT FleetWise stopped accepting new customers as of 2026-04-30, while existing customers can continue without new feature development. A fleet selecting a vehicle-data service after that date should document why it chose an existing managed service, a modular connected mobility architecture, or an in-house ingestion stack, including privacy controls and exit strategy.

## Risks and Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Collecting everything "for safety" | Over-retention and secondary-use liability | Purpose-based campaigns and minimization review |
| Raw clips leak to broad engineering tools | Faces, badges, site layouts, and route data exposed | Raw-data enclave, scoped exports, audit logs |
| Deletion does not reach derived data | Non-compliance and model lineage contamination | Deletion propagation to clips, labels, embeddings, splits, and model cards |
| Incident data mixed with training data | Legal hold or regulator data used beyond approved purpose | Separate evidence bucket and release gate |
| Re-identification from "anonymous" telemetry | Persistent route and shift patterns identify workers | k-anonymity thresholds, location coarsening, aggregation |
| Vendor annotation over-collection | Data leaves the controlled environment | DPA, secure annotation workspace, no local download, watermarking |
| Secrets captured in logs | Fleet compromise | Secret scanning, redaction, credential rotation playbook |
| Law enforcement or customer request mishandled | Unlawful disclosure or site trust loss | Request intake, legal review, disclosure log |

## Related Repository Docs

- `50-cloud-fleet/data-platform/fleet-data-pipeline.md`
- `50-cloud-fleet/data-platform/data-engine-from-bags.md`
- `40-runtime-systems/data-logging/on-vehicle-data-triage-selective-upload.md`
- `50-cloud-fleet/mlops/data-flywheel-airside.md`
- `50-cloud-fleet/mlops/federated-learning-fleet.md`
- `60-safety-validation/cybersecurity/cybersecurity-airside-av.md`
- `60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md`

## Sources

- FTC, "Cars & Consumer Data: On Unlawful Collection & Use," 2024-05-14. https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/05/cars-consumer-data-unlawful-collection-use
- FTC, "FTC Takes Action Against General Motors for Sharing Drivers' Precise Location and Driving Behavior Data Without Consent," 2025-01. https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-takes-action-against-general-motors-sharing-drivers-precise-location-driving-behavior-data
- European Data Protection Board, "Guidelines 01/2020 on processing personal data in the context of connected vehicles and mobility related applications," adopted 2021-03-09. https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-012020-processing-personal-data-context_en
- European Commission, GDPR legal framework. https://commission.europa.eu/law/law-topic/data-protection/legal-framework-eu-data-protection_en
- NIST Privacy Framework. https://www.nist.gov/privacy-framework
- AWS IoT FleetWise availability change, 2026-04-30. https://docs.aws.amazon.com/iot-fleetwise/latest/developerguide/iotfleetwise-availability-change.html
- AWS IoT FleetWise developer guide, "What is AWS IoT FleetWise?" https://docs.aws.amazon.com/iot-fleetwise/latest/developerguide/what-is-iotfleetwise.html
- CISA, Software Bill of Materials. https://www.cisa.gov/sbom
