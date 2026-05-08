# Safety Case Evidence Traceability

**Last updated:** 2026-05-09

A safety case is only useful if its claims, assumptions, hazards, requirements, tests, field evidence, and change decisions can be traced. Autonomous systems change continuously through software, model, map, configuration, calibration, ODD, and operating-procedure updates. The safety case must therefore be a living evidence graph, not a static PDF assembled for a single audit.

## Practical Evidence and Artifact Model

Use stable evidence IDs across the repository, issue tracker, CI, data lake, model registry, map registry, incident system, and release system.

| Artifact | Minimum fields | Links to |
|---|---|---|
| Claim record | Claim ID, statement, scope, owner, confidence, status, review date | Parent/child claims, evidence, assumptions |
| Hazard record | Hazard ID, operational scenario, severity, exposure, controllability or risk class, mitigations | Requirements, tests, incidents |
| Requirement record | Requirement ID, source, safety/security/ML/system type, acceptance criteria | Hazards, design, tests, releases |
| Assumption record | Assumption ID, rationale, validity condition, monitor, expiry/review trigger | Claims and operating evidence |
| Evidence record | Evidence ID, type, source, date, version, quality rating, result, limitations | Claims, requirements, release |
| Scenario record | Scenario ID, ODD slice, parameters, coverage rationale, pass/fail criteria | Hazards, tests, datasets |
| Dataset record | Dataset ID, source clips, labeling policy, redaction state, split, coverage, exclusions | ML claims and model releases |
| Model/map/config record | Artifact ID, manifest, validation bundle, deployment cohorts, rollback | Requirements and release |
| Incident record | Incident ID, timeline, active artifact versions, root cause, CAPA | Hazards, assumptions, tests |
| Change impact record | Change ID, affected claims, required evidence refresh, approval | SUMS and safety board |

Evidence should be rated for quality. A track test with calibrated measurement and pass/fail criteria is stronger than an informal demo video. A simulation campaign is only useful if scenario coverage, simulator validity, and pass/fail criteria are explicit.

## Traceability Model

The minimum trace graph:

```text
ODD -> Hazard -> Safety goal -> Requirement -> Design control
    -> Verification/validation evidence -> Release decision
    -> Field monitoring evidence -> Safety-case update
```

For ML components:

```text
System safety requirement -> ML safety requirement -> Data requirement
    -> Dataset version -> Training run -> Model artifact -> Verification set
    -> Integration test -> Shadow/canary evidence -> Field monitor
```

For maps and configuration:

```text
Site ODD assumption -> Map/config requirement -> Map diff/config change
    -> Replay/site validation -> Release approval -> Vehicle active manifest
    -> Field disagreement/incident monitor
```

## Deployment Operations

### 1. Baseline the safety case at each release

Every production release should freeze:

- Top-level safety claims and claim status.
- Active hazard list and mitigations.
- Requirements included in the release.
- Evidence versions used for release approval.
- Known limitations and accepted residual risks.
- Active ODD and site assumptions.
- Vehicle/software/model/map/config/calibration manifests.

The baseline does not stop future work. It gives incident investigators and auditors a precise answer to "what was believed and approved at the time?"

### 2. Require change impact analysis

Changes that can affect safety-case evidence include:

- Code, firmware, model, map, configuration, calibration, or parameter changes.
- ODD expansion, new site, new route, new vehicle variant, new sensor mount.
- New operator workflow, teleoperation mode, dispatch rule, or maintenance procedure.
- Field evidence showing an assumption is false or weaker than expected.
- Supplier component, vulnerability, or cybersecurity architecture change.

The change impact record should name affected claims and either attach refreshed evidence or explicitly justify why existing evidence remains valid.

### 3. Automate trace checks

At minimum, CI or release tooling should fail or warn when:

- A safety requirement has no verification evidence.
- A high-severity hazard has no mitigated residual-risk decision.
- A model release lacks dataset lineage and verification results.
- A map release lacks semantic diff and validation report.
- An incident CAPA references no hazard, requirement, or safety-case change.
- Evidence is older than its review interval.
- A claim depends on an expired assumption.

### 4. Review with independent challenge

Use safety board reviews for major releases and targeted reviews for minor changes. The reviewer should challenge:

- Is the claim scoped tightly enough?
- Does the evidence actually support the claim?
- Are assumptions monitored in the field?
- Are negative results and limitations recorded?
- Did the release change invalidate previous evidence?
- Are cybersecurity and privacy constraints represented where they affect safety?

## Evidence Patterns

| Evidence type | Good evidence | Weak evidence |
|---|---|---|
| Simulation | Scenario catalog, parameter ranges, simulator validity, pass/fail criteria, results | "Ran many miles" without coverage or acceptance criteria |
| Track/site test | Instrumented test, calibrated targets, repeatability, environmental notes | One-off demo |
| Field data | Versioned fleet metrics, exposure denominator, incident/near-miss linkage | Anecdotes or aggregate miles only |
| ML verification | Frozen dataset, coverage analysis, slice metrics, robustness tests, lineage | Single headline accuracy metric |
| Runtime monitor | Requirement-to-monitor mapping, threshold rationale, false positive/negative analysis | Uncalibrated alert |
| Safety analysis | HARA/STPA/FMEA/SOTIF with trace to controls and tests | Spreadsheet detached from design and evidence |
| Cybersecurity | TARA, SBOM/CVE/VEX, penetration or red-team evidence, incident drills | Scanner output with no disposition |

## Risks and Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Static PDF safety case | Release and field evidence drift from claims | Evidence graph with release baselines |
| Orphaned hazards | High-risk items lack requirements or tests | Trace coverage dashboard |
| Argument by volume | Large evidence set hides weak support | Evidence quality rating and claim-level review |
| ML data lineage missing | Model cannot be reproduced or audited | Dataset IDs, split manifests, model registry links |
| Assumptions unmonitored | ODD or site changes silently invalidate claims | Assumption owners, expiry, field monitors |
| Incident CAPA not linked | Lessons do not update assurance | Incident-to-hazard/claim change request |
| Tool links rot | Audit cannot retrieve evidence | Immutable evidence store and stable IDs |
| Security/safety split | Cyber compromise risks omitted from safety case | Shared hazards for security-controlled safety functions |

## Related Repository Docs

- `60-safety-validation/standards-certification/certification-guide.md`
- `60-safety-validation/safety-case/failure-modes-analysis.md`
- `60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md`
- `60-safety-validation/verification-validation/testing-validation-methodology.md`
- `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`
- `50-cloud-fleet/ota/software-update-management-system-ops.md`
- `50-cloud-fleet/map-operations/hd-map-lifecycle-operations.md`
- `40-runtime-systems/ml-deployment/production-ml-deployment.md`

## Sources

- UL 4600 Edition 3 updates and safety case framework. https://www.ul.com/news/ul-4600-edition-3-updates-incorporate-autonomous-trucking
- ANSI/UL 4600 Ed. 1 summary, claim-based safety case. https://webstore.ansi.org/standards/ul/ul4600ed2020
- Phil Koopman, UL 4600 resource page. https://users.ece.cmu.edu/~koopman/ul4600/index.html
- University of York, AMLAS guidance. https://www.york.ac.uk/assuring-autonomy/guidance/amlas/
- AMLAS v1.1 PDF. https://www.york.ac.uk/media/assuring-autonomy/documents/AMLASv1.1.pdf
- ISO/PAS 8800:2024, "Road vehicles - Safety and artificial intelligence." https://www.iso.org/standard/83303.html
- "The Open Autonomy Safety Case Framework," arXiv, 2024-04-08. https://arxiv.org/abs/2404.05444
- Waymo, "Building a Credible Case for Safety," arXiv, 2023. https://arxiv.org/abs/2306.01917
- Goal Structuring Notation Community Standard. https://scsc.uk/gsn
