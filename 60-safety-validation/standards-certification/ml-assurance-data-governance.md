# ML Assurance and Data Governance

**Last updated:** 2026-05-09

## Why It Matters

Machine-learning assurance is now a governance problem, not only a model-evaluation problem. ISO/IEC 42001:2023 establishes requirements for an AI management system, including continual improvement and organization-wide controls. ISO/IEC 23894:2023 gives guidance for managing AI-specific risk. ISO/IEC TR 5469:2024 describes risk factors and methods for AI used inside safety-related functions, non-AI safety functions protecting AI-controlled equipment, and AI used to develop safety-related functions. ISO/IEC 5259-5:2025 brings data-quality governance into the management layer for analytics and ML.

For airside autonomy, this matters because perception and prediction failures rarely look like clean component faults. They show up as bad labels, missing night/rain data, apron-specific class imbalance, untracked synthetic data, stale calibration, overconfident detections, or a model retrained without scenario coverage. The safety case should therefore prove that the organization can govern AI risk, data quality, model release, and post-deployment monitoring with the same discipline used for mechanical and functional-safety evidence.

## Evidence Model

1. **AI management-system scope.** Define which AI/ML components are in scope: obstacle detection, aircraft-stand scene understanding, FOD detection, localization, semantic mapping, intent prediction, remote-assist triage, or fleet optimization. Assign accountable owners, risk acceptance authority, release authority, and escalation paths.

2. **AI risk register.** Maintain a risk record for each model and dataset. Include intended use, prohibited use, ODD, known limitations, affected hazards, safety monitors, misuse scenarios, security exposure, human-oversight assumptions, and residual risk. Map the register to NIST AI RMF functions: Govern, Map, Measure, and Manage.

3. **Data-quality governance.** Keep a governed inventory for raw data, labels, derived features, simulation data, synthetic data, third-party data, and operational logs. The inventory should track source, consent or license basis, sensor configuration, collection site, weather, lighting, airport geometry, actor classes, label ontology, review status, and retention rules.

4. **Dataset lifecycle controls.** Separate training, validation, test, regression, and release-gate datasets. Track dataset version hashes, labeler instructions, inter-annotator agreement, adjudication results, rejected data, known gaps, and leakage checks. Treat ODD slices as explicit coverage units: aircraft stand, service road, gate pushback zone, baggage make-up area, rain, glare, cones, reflective vests, dollies, belt loaders, aircraft shadows, and jetblast/FOD zones.

5. **Model assurance case.** For each model release, include architecture, training code version, data version, hyperparameters, calibration, confidence behavior, slice metrics, stress tests, OOD tests, ablation results, robustness tests, and comparison against the prior release. Link each metric to an operational threshold or safety monitor action.

6. **Runtime governance.** Monitor drift, confidence distribution, false-positive and false-negative cases, operator interventions, disengagements, near misses, and safety monitor activations. Define retraining triggers and emergency rollback triggers before deployment.

## Acceptance Checks

- AI/ML systems have named owners, approved intended uses, prohibited uses, and risk acceptance records.
- Every production model has a model card or equivalent release note with dataset versions, ODD scope, limitations, metrics by scenario slice, and rollback instructions.
- Data used for release gates is independent from training data and protected from uncontrolled edits.
- Label taxonomy covers airside-specific objects and states, including people in high-visibility clothing, aircraft servicing equipment, tow bars, cones, chocks, carts, belt loaders, fuel trucks, FOD, and temporary works.
- Performance thresholds are defined per safety-relevant slice, not only as aggregate precision/recall or mean average precision.
- Synthetic and simulated data are tagged, justified, and validated against real airside data before they support a safety claim.
- Model updates trigger impact analysis for safety monitors, ODD limits, datasets, calibration, and downstream planning behavior.
- Post-deployment monitoring has clear owners, review cadence, incident intake, triage severity, corrective actions, and field rollback authority.

## Failure Modes

- A model passes aggregate metrics while failing at dusk, in rain, near aircraft shadows, or around reflective airport markings.
- Training and validation sets share near-duplicate frames from the same route run, hiding leakage and overstating performance.
- A label ontology changes but old labels remain in the dataset without migration or review.
- Synthetic rare-event data dominates the validation claim without correlation to real sensor artifacts.
- Model confidence is treated as calibrated when no calibration or OOD evidence exists.
- Data rights, retention, or provenance are unclear, making the evidence unusable in an audit.
- A retrain improves one class but degrades pedestrian, cone, or GSE detection in a safety-critical slice.
- AI output silently becomes part of the safety function even though the certified safety layer assumes it is advisory only.

## Related Repository Docs

- [Knowledge Base Evaluation Protocol](../verification-validation/knowledge-base-evaluation-protocol.md)
- [Perception SLAM Statistical Validity Protocol](../verification-validation/perception-slam-statistical-validity-protocol.md)
- [Uncertainty Calibration Perception SLAM Release Gates](../verification-validation/uncertainty-calibration-perception-slam-release-gates.md)
- [Online Perception Monitoring ODD Enforcement](../runtime-assurance/online-perception-monitoring-odd-enforcement.md)
- [Formal Methods Regulatory](formal-methods-regulatory.md)
- [Safety Case Evidence Traceability](../safety-case/safety-case-evidence-traceability.md)

## Sources

- ISO, [ISO/IEC 42001:2023 - AI management systems](https://www.iso.org/standard/42001)
- ISO, [ISO/IEC 23894:2023 - AI guidance on risk management](https://www.iso.org/standard/77304.html)
- ISO, [ISO/IEC TR 5469:2024 - Functional safety and AI systems](https://www.iso.org/standard/81283.html)
- ISO, [ISO/IEC 5259-5:2025 - Data quality governance framework](https://www.iso.org/standard/84150.html)
- NIST, [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- NIST AIRC, [AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- NIST, [AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook)
