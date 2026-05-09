# Data Catalog, Lineage, and Quality Operations

**Last updated:** 2026-05-09

## Why It Matters

Fleet data becomes useful only when engineers can answer three questions quickly: what does this dataset contain, where did it come from, and is it fit for the model or safety decision being made? A catalog without lineage is a search index. Lineage without quality checks is an audit trail for bad data. Quality checks without ownership decay into dashboards nobody trusts.

This page covers operational controls for curated fleet data products: raw logs, processed events, labels, features, replay sets, training splits, and evaluation datasets.

## Operating Model

1. Define data products with named owners: raw bag archive, normalized telemetry, object labels, scenario clips, model training tables, and evaluation tables.
2. Store large analytical datasets in snapshot-capable tables. Use Apache Iceberg snapshots, schema evolution, partition evolution, and retention policies to preserve reproducibility without freezing all storage forever.
3. Emit lineage events from each pipeline step. OpenLineage concepts of runs, jobs, datasets, and facets map cleanly to bag extraction, decoding, label import, feature generation, and training-set assembly.
4. Attach quality rules to the catalog entry, not only to the pipeline code. Rules should cover completeness, timestamp monotonicity, frame drops, calibration presence, label validity, class balance, schema compatibility, and privacy filters.
5. Promote data by state: `raw`, `decoded`, `validated`, `curated`, `approved_for_training`, `approved_for_safety_evidence`, `deprecated`.
6. Review quality exceptions weekly with data owners and release blockers daily during model-release windows.

## Evidence Artifacts

| Artifact | Minimum contents | Owner |
|---|---|---|
| Catalog entry | Dataset purpose, schema, ODD scope, owner, retention, access class | Data platform |
| Lineage graph | Source datasets, pipeline run IDs, code version, parameters, outputs | Data platform |
| Iceberg snapshot record | Table snapshot ID, schema ID, partition spec ID, branch/tag if used | Data engineer |
| Quality report | Rule results, sample counts, failure rows, waived failures, trend | Data quality owner |
| Data contract | Required fields, units, coordinate frames, timing assumptions, valid ranges | Producer and consumer |
| Label-schema record | Taxonomy, label versions, ontology references, compatibility notes | Label operations |
| Approval decision | Accepted use, restrictions, expiry, approvers, downstream consumers | Data steward |

## Acceptance Checks

- Every training and evaluation dataset resolves to immutable source snapshots.
- Every derived dataset has machine-readable lineage back to raw logs, labels, and processing code.
- Quality checks run before promotion and store both pass/fail status and failure samples.
- Schema changes are reviewed for downstream model, feature, replay, and safety evidence impact.
- Catalog entries identify the data owner, business purpose, access restrictions, retention class, and approved uses.
- Data used in release evidence is marked `approved_for_safety_evidence`, not only `approved_for_training`.
- Waivers have an owner, expiry date, scope, and measurable containment rule.

## Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Dataset name reused for mutable contents | Model release cannot be reproduced | Require snapshot IDs in manifests |
| Pipeline lineage stops at a staging table | Root cause analysis cannot trace bad labels or corrupted logs | Emit lineage at every materialization boundary |
| Quality checks live only in notebooks | Failures are not enforced in production | Move checks into scheduled pipeline gates |
| Schema evolution breaks consumers | Training jobs silently drop or misread fields | Data contract review before schema promotion |
| Catalog has owner gaps | Exceptions are never resolved | Block promotion for ownerless data products |
| Quality rules ignore ODD slices | Dataset passes globally but misses airport-specific defects | Require zone, weather, lighting, sensor, and vehicle slices |
| Retention deletes evidence inputs | Safety case cannot be reconstructed | Lock release evidence snapshots under retention hold |

## Related Repository Docs

- `50-cloud-fleet/data-platform/fleet-data-pipeline.md`
- `50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md`
- `50-cloud-fleet/data-platform/data-engine-from-bags.md`
- `50-cloud-fleet/mlops/data-flywheel-airside.md`
- `50-cloud-fleet/data-governance/fleet-data-privacy-governance.md`
- `60-safety-validation/safety-case/safety-case-evidence-traceability.md`
- `60-safety-validation/verification-validation/perception-slam-statistical-validity-protocol.md`

## Sources

- ISO/IEC 5259-5:2025, "Artificial intelligence - Data quality for analytics and machine learning (ML) - Part 5: Data quality governance framework." https://www.iso.org/standard/84150.html
- OpenLineage, project overview and specification. https://openlineage.io/ and https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md
- Apache Iceberg, "Spec." https://iceberg.apache.org/spec/
- Apache Iceberg, "Evolution." https://iceberg.apache.org/docs/1.4.2/evolution/
- Regulation (EU) 2024/1689, Artificial Intelligence Act, Articles 10-12 and Annex IV. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689
