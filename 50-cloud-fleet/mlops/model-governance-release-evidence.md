# Model Governance and Release Evidence

**Last updated:** 2026-05-09

## Why It Matters

An autonomy model release is not just a better checkpoint. It is a controlled change to vehicle behavior, data assumptions, safety evidence, runtime compatibility, and rollback posture. The release system must prove which model version is approved, what data and tests support it, where it is allowed to run, and how the fleet can return to the previous safe version.

Use this page for model release evidence. It does not replace OTA controls, software supply-chain evidence, or the safety case; it is the MLOps evidence packet that those systems consume.

## Operating Model

1. Register every deployable model in a model registry before release review. Use immutable model versions and mutable aliases such as `candidate`, `shadow`, `champion`, and `rollback` for deployment routing.
2. Attach release metadata to the model version: training run ID, code commit, dataset snapshots, label schema, feature schema, calibration package, runtime container, hardware target, and ODD scope.
3. Treat release approval as a claims-and-evidence review. The release claim states what improved, what did not regress, which ODD is covered, and which operational risk is being reduced.
4. Require named approval from the model owner, data owner, runtime owner, safety owner, and fleet operations owner before moving the `champion` alias.
5. Move through gates: offline metrics, scenario replay, shadow execution, limited canary, fleet expansion. Each gate either promotes, holds, or rejects the exact model version.
6. Keep rollback executable. The rollback model must be compatible with the active runtime, map schema, calibration schema, and config bundle.

## Evidence Artifacts

| Artifact | Minimum contents | Owner |
|---|---|---|
| Model registry record | Registered model, immutable version, aliases, tags, release notes | MLOps |
| Training provenance | Run ID, code commit, dependency lock, training config, random seeds, hardware | Model owner |
| Dataset manifest | Iceberg/DVC snapshot IDs, label schema, excluded data, leakage checks | Data owner |
| Evaluation report | Primary metrics, calibration, uncertainty, class slices, airport and weather slices | Model owner |
| Scenario replay report | Required scenario suite, new mined scenarios, failures, waivers | Safety validation |
| Shadow-mode report | Disagreement with champion, intervention correlation, latency and resource use | Fleet operations |
| Safety case link | Claim IDs supported by this release and evidence IDs attached to each claim | Safety owner |
| Release decision record | Approvers, residual risks, rollout plan, rollback trigger, expiry date | Release manager |

## Acceptance Checks

- The model can be loaded by registry alias and by immutable version.
- The model version has dataset, code, config, and runtime provenance sufficient to rebuild or explain the release.
- The evaluation report includes both aggregate metrics and operational slices for airport zone, lighting, weather, vehicle platform, and object class.
- No critical scenario replay regression is open without an approved safety waiver and an explicit operational mitigation.
- Shadow-mode evidence covers the same ODD requested for release.
- The release packet states which previous model version is the rollback target and verifies runtime compatibility.
- The deployment decision references the relevant safety case claims and technical documentation record.

## Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Alias moved without evidence | Fleet runs a model that was not reviewed | Require signed release decision before alias mutation |
| Metric-only approval | Model improves averages while regressing rare safety cases | Gate on scenario replay and ODD slices |
| Dataset snapshot missing | Release cannot be reproduced or audited | Block release unless dataset IDs are immutable |
| Shadow evidence from a different ODD | Approval does not support target deployment | Tie evidence to airport, route, weather, and vehicle class |
| Runtime incompatibility | Model passes offline tests but fails on vehicle | Validate TensorRT/ONNX/runtime bundle before canary |
| Rollback model not executable | Recovery depends on a manual hotfix | Keep `rollback` alias and compatible artifact bundle current |
| Approval expires silently | Old evidence is reused after data or ODD drift | Require evidence expiry and periodic revalidation |

## Related Repository Docs

- `40-runtime-systems/ml-deployment/production-ml-deployment.md`
- `40-runtime-systems/ml-deployment/av-cicd-devops-pipeline.md`
- `50-cloud-fleet/mlops/data-flywheel-airside.md`
- `50-cloud-fleet/ota/software-update-management-system-ops.md`
- `60-safety-validation/safety-case/safety-case-evidence-traceability.md`
- `60-safety-validation/verification-validation/testing-validation-methodology.md`
- `60-safety-validation/standards-certification/eu-ai-act-machinery-compliance-dossier.md`

## Sources

- MLflow, "Model Registry Workflows." https://www.mlflow.org/docs/latest/ml/model-registry/workflow/
- Waymo, "Safe to Deploy: How We Know The Waymo Driver Is Ready For The Road," 2025-06. https://waymo.com/blog/2025/06/safe-to-deploy/
- Waymo, "Building a credible case for safety: Waymo's approach for the determination of absence of unreasonable risk." https://waymo.com/research/building-a-credible-case-for-safety-waymos-appro/
- Regulation (EU) 2024/1689, Artificial Intelligence Act, Articles 10-12 and Annex IV. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689
- ISO/IEC 5259-5:2025, "Artificial intelligence - Data quality for analytics and machine learning (ML) - Part 5: Data quality governance framework." https://www.iso.org/standard/84150.html
