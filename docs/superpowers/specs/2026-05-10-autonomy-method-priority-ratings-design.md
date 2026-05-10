# Autonomy Method Priority Ratings Design

## Purpose

Add a small priority signal to autonomy method pages so readers can decide what to view first. The system answers two questions:

1. What is worth reading early for general learning?
2. What is worth evaluating early for autonomous-vehicle deployment?

The scope is broad AV autonomy, not only airside. Airside is one tag alongside road AVs, warehouses, ports, yards, mining, agriculture, construction, delivery robots, campuses, and other domains represented in the repo.

## Scope

Initial scope:

- Method-level perception pages under `30-autonomy-stack/perception/methods/`.
- Method-level SLAM/localization pages under `30-autonomy-stack/localization-mapping/slam-methods/`.
- Generated overview tables that surface high-priority entries.

Out of scope:

- A full recommendation engine.
- Per-domain score matrices.
- Full prerequisite graphs.
- Any claim that a high score means a method is safety-certified or product-ready.

## Balanced Metadata

Each rated page gets one hidden block with seven fields. This is enough to disambiguate the score without turning each page into a mini database.

```yaml
<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["road-av", "airside", "mapping", "runtime-localization"]
  reason: "Core LiDAR-inertial baseline for mapping and localization fallback."
method-priority:end -->
```

Rules:

- `learning` and `deployment` are required integers from 1 to 5.
- `type`, `stage`, and `maturity` are required short enums.
- `tags` is a compact routing list, not a full taxonomy. Use 2-6 tags.
- `reason` is one short sentence, 40-180 characters.
- Do not add prerequisites, per-context scores, or extra reason fields in the first pass.

The block must appear after the H1 and before the first `##`. It is one HTML comment, so it is parsed by tooling and hidden from normal page content.

## Score Semantics

Learning score:

| Score | Meaning |
|---:|---|
| 5 | Read early; foundational or field-organizing. |
| 4 | Read soon; important method family or strong conceptual bridge. |
| 3 | Read when entering that subtopic. |
| 2 | Specialist, historical, or comparative reference. |
| 1 | Optional or watchlist-level reference. |

Deployment score:

| Score | Meaning |
|---:|---|
| 5 | Evaluate early for at least one tagged AV domain or stack role. |
| 4 | Strong candidate or important deployment pattern in the tagged context. |
| 3 | Useful for specific domains, fallback modes, offline workflows, or validation. |
| 2 | Limited near-term deployment role; mostly research or secondary use. |
| 1 | Watchlist, historical, or unlikely to affect stack decisions soon. |

`deployment` is scoped by `tags` and `reason`. Do not average across all AV domains. A warehouse-only localization method can be `deployment: 5` if it is critical for warehouse autonomy and tagged accordingly.

## Type, Stage, And Maturity

These fields keep the two scores interpretable while staying compact.

Allowed `type` values:

- `method`
- `method-family`
- `architecture-pattern`
- `benchmark`

Allowed `stage` values:

- `foundation`
- `classic-baseline`
- `modern-core`
- `deployment-pattern`
- `frontier`
- `reference`

Allowed `maturity` values:

- `fielded-pattern`
- `pilot-proven`
- `prototype`
- `research`
- `watchlist`
- `historical`

## Tags

Keep tags short and practical. They exist for filtering and table scanning, not for modeling every nuance.

Allowed domain tags:

- `road-av`
- `airside`
- `warehouse`
- `logistics-yard`
- `port`
- `outdoor-campus`
- `mining`
- `agriculture`
- `construction`
- `delivery-robot`

Allowed role and condition tags:

- `perception`
- `slam`
- `mapping`
- `runtime-localization`
- `fallback`
- `validation`
- `data-engine`
- `simulation`
- `indoor`
- `outdoor`
- `gnss-denied`
- `adverse-weather`

Add tags only when they explain the score. For example, avoid tagging every LiDAR method with every possible outdoor domain.

## Calibration Examples

| Method type | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |
|---|---:|---:|---|---|---|---|---|
| EKF-SLAM | 5 | 2 | `method-family` | `foundation` | `historical` | `slam`, `indoor` | Foundation for estimator thinking, but rarely the direct modern AV stack. |
| FAST-LIO2 / LIO family | 4 | 5 | `method-family` | `modern-core` | `fielded-pattern` | `slam`, `mapping`, `runtime-localization`, `outdoor` | Core LiDAR-inertial pattern for mapping and localization fallback. |
| Production LiDAR scan-to-map localization | 4 | 5 | `architecture-pattern` | `deployment-pattern` | `fielded-pattern` | `runtime-localization`, `road-av`, `airside` | Central deployment pattern for mapped AV operation. |
| Neural/Gaussian SLAM | 3 | 3 | `method-family` | `frontier` | `research` | `slam`, `mapping`, `simulation` | Useful for map QA and simulation, but not primary runtime localization. |
| Open-world perception methods | 4 | 4 | `method-family` | `modern-core` | `prototype` | `perception`, `validation`, `data-engine` | Important for long-tail perception and deployment-risk discovery. |

## Display Behavior

Method pages and generated overview tables should show the same concise fields:

```text
Learning: 4/5
Deployment: 5/5
Type: method-family
Stage: modern-core
Maturity: fielded-pattern
Tags: road-av, airside, mapping, runtime-localization
Reason: Core LiDAR-inertial baseline for mapping and localization fallback.
```

Overview tables should be static Markdown in the first pass, generated from page metadata and sorted by `deployment desc`, then `learning desc`, then title.

## Governance

Ratings are editorial guidance, not benchmark scores.

Rules:

- Do not rate a method highly only because it is new.
- Do not use leaderboard results as the only reason for a high deployment score.
- High deployment scores require practical relevance in the tagged context: sensor availability, calibration, latency, maintainability, licensing, observability, failure detection, or safety-case evidence.
- High learning scores require reusable conceptual value, not popularity or ease.
- If the reason cannot justify both scores, lower one score or revise the tags.

## Implementation Plan Shape

Phase 1 must add parser and validation tooling before any rating batch:

- Parse `method-priority` marker comments.
- Validate required fields, integer score range, enum values, allowed tags, unique tags, and reason length.
- Fail on malformed present metadata.
- Tolerate missing metadata during partial rollout.

Phase 2 rates a seed set:

- 15-25 SLAM/localization pages.
- 15-25 perception pages.
- Include examples across high-learning, high-deployment, frontier, historical, and watchlist cases.

Phase 3 backfills remaining method pages in batches, starting with pages linked from the overview tables and coverage audits.

## Acceptance Criteria

- The repo defines the balanced seven-field rating block.
- Perception and SLAM overview pages explain the score meanings.
- Parser tests cover valid, missing, duplicate, and malformed metadata.
- Generated overview tables identify high-priority learning and deployment entries.
- Missing ratings do not break the reader or navigation; malformed present ratings fail validation.
