# Active Labeling and Budget Operations

**Last updated:** 2026-05-09

## Why It Matters

Fleet learning is constrained twice: vehicles cannot upload everything, and humans cannot label everything that reaches the cloud. Active labeling operations decide which samples earn bandwidth, which uploaded samples earn annotation spend, which predictions can be reviewed instead of labeled from scratch, and which labels are good enough to promote into training or safety evidence.

This page covers budgeted labeling operations for perception, prediction, planning replay, and data-quality review.

## Operating Model

1. Maintain separate budgets for upload, auto-label inference, human annotation, expert review, and label QA. Do not spend human review on clips that are blocked by privacy, corruption, missing calibration, or duplicate coverage.
2. Score candidates in two stages. On vehicle or edge storage, select clips under bandwidth and retention constraints. In the cloud, select from uploaded data under a global annotation budget.
3. Balance uncertainty, diversity, coverage, and operational risk. DUAL frames this as distributed upload plus active labeling for resource-constrained fleets; the practical lesson is to avoid spending the global label budget on redundant local uploads.
4. Use FiftyOne or equivalent dataset tooling to inspect embeddings, near-duplicates, hard examples, label mistakes, and model predictions before creating annotation tasks.
5. Use Label Studio or equivalent annotation tooling for pre-annotations, ML backend predictions, interactive labeling, and human review. Predictions are not ground truth until reviewed and submitted.
6. Promote labels by state: `candidate`, `pre_labeled`, `human_labeled`, `qa_passed`, `approved_for_training`, `approved_for_safety_evidence`, `rejected`.

## Evidence Artifacts

| Artifact | Minimum contents | Owner |
|---|---|---|
| Budget ledger | Budget type, allocation, spend, remaining quota, owner, period | Label operations |
| Candidate score record | Source clip, score components, selected/not selected reason, dedupe cluster | Data platform |
| Upload selection manifest | Vehicle, local model version, storage constraint, selected sample IDs | Fleet data |
| Annotation batch | Task IDs, label schema, instructions, source data snapshots, pre-label model | Label operations |
| Pre-annotation record | Model version, prediction score, Label Studio prediction payload, review status | MLOps |
| QA report | Inter-annotator checks, reviewer decisions, defect taxonomy, rework rate | Label QA |
| Promotion record | Approved label snapshot, allowed use, expiry, downstream dataset IDs | Data steward |

## Acceptance Checks

- Selection decisions are reproducible from stored scores, budgets, and source snapshots.
- The annotation batch has a fixed label schema, task instructions, and ODD scope.
- Pre-labels are clearly distinguished from reviewed labels in storage and downstream manifests.
- Label QA samples cover high-risk classes, rare classes, new airports, night/weather slices, and model-disagreement cases.
- Duplicate and near-duplicate samples are controlled before spending annotation budget.
- Labels promoted to safety evidence have stricter QA than labels used only for exploratory training.
- Budget reports expose cost per accepted label, defect rate, rework rate, and downstream model or replay impact.

## Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Label budget follows upload volume | Common routes consume all annotation spend | Global cloud selection with diversity and risk weighting |
| Unreviewed predictions enter training | Model reinforces its own errors | Separate `pre_labeled` from `qa_passed` states |
| Active learning chases only uncertainty | Dataset fills with outliers and corrupt samples | Combine uncertainty with quality, diversity, and ODD coverage |
| Label instructions drift | Annotators create incompatible labels | Version task instructions and schema with each batch |
| QA samples are random only | Rare safety classes are under-reviewed | Risk-weight QA sampling |
| Duplicate clips are labeled repeatedly | Budget waste and biased training distribution | Near-duplicate detection before task creation |
| Promotion has no allowed-use scope | Exploratory labels become safety evidence by accident | Require explicit promotion state and data steward approval |

## Related Repository Docs

- `50-cloud-fleet/mlops/data-flywheel-airside.md`
- `50-cloud-fleet/data-platform/fleet-data-pipeline.md`
- `50-cloud-fleet/data-platform/3d-annotation-tools.md`
- `50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md`
- `30-autonomy-stack/perception/datasets-benchmarks/fod-and-airport-apron-detection-datasets.md`
- `60-safety-validation/verification-validation/evaluation-benchmarks.md`
- `60-safety-validation/verification-validation/knowledge-base-evaluation-protocol.md`

## Sources

- Akcin, Goel, Zhao, and Chinchali, "Distributed Upload and Active Labeling for Resource-Constrained Fleet Learning," Proceedings of Machine Learning Research 305, 2025. https://proceedings.mlr.press/v305/akcin25a.html
- FiftyOne documentation. https://docs.voxel51.com/
- FiftyOne, "Annotating Datasets." https://docs.voxel51.com/integrations/annotation.html
- Label Studio, "Integrate Label Studio into your machine learning pipeline." https://labelstud.io/guide/ml.html
- Label Studio, "Import pre-annotated data into Label Studio." https://labelstud.io/guide/predictions
- ASAM OpenLABEL. https://www.asam.net/standards/detail/openlabel/
