# Autonomy Method Priority Ratings Design

## Purpose

Add a lightweight priority system to the autonomy method libraries so readers can decide what to read first without treating every perception or SLAM method as equally important.

The ratings must support two different questions:

1. What should a reader learn first to understand the field?
2. What matters most for real autonomous-vehicle deployment?

The system should cover the broader AV corpus, not only airside autonomy. Airside remains an important context tag because the repository uses it as a concrete deployment lens, but the rating model must also support road AVs, warehouse AMRs, yard and port autonomy, campus robots, mining, agriculture, construction, delivery robots, and other operational domains represented in the repo.

## Scope

Initial scope:

- Method-level perception pages under `30-autonomy-stack/perception/methods/`.
- Method-level SLAM/localization pages under `30-autonomy-stack/localization-mapping/slam-methods/`.
- Overview tables that help readers sort or filter high-priority entries.

Out of scope for the first pass:

- Scoring every dataset, benchmark, company, safety case, or foundation page.
- Building a full recommendation engine.
- Claiming that a high rating means a method is safety-certified or product-ready.

## Rating Model

Each rated method should carry two independent 1-5 ratings.

| Metadata key | Meaning |
|---|---|
| `priority.learning` | How early someone should read this method to understand autonomy, robotics, perception, SLAM, or estimator design. |
| `priority.av_deployment` | How relevant the method or method family is to practical AV deployment across operational domains. |

The ratings are deliberately separated because foundational importance and deployment relevance often differ.

Examples:

| Method type | Learning priority | AV deployment priority | Reason |
|---|---:|---:|---|
| EKF-SLAM | 5 | 2 | Foundational estimator learning value, but less common as the direct modern AV architecture. |
| FAST-LIO2 / LIO family | 4 | 5 | Important technical pattern and strong deployment relevance for mapping, odometry, and localization fallback. |
| Production LiDAR scan-to-map localization | 4 | 5 | Essential deployment pattern for mapped AV operation. |
| Neural/Gaussian SLAM | 3 | 3 | Useful future-facing research and map QA direction, but not yet a primary certified pose backbone. |
| Open-world perception / OOD benchmarks | 4 | 4 | Important for both learning long-tail perception limits and validating deployment risk. |

## Star Semantics

Use the same 1-5 scale for both axes, but interpret it in each axis's context.

| Stars | Learning interpretation | AV deployment interpretation |
|---:|---|---|
| 5 | Must-read foundation or organizing concept. | Core production pattern, deployment gate, or high-impact stack component. |
| 4 | High-value method family or strong conceptual bridge. | Strong candidate or widely relevant deployment method. |
| 3 | Useful specialist method once the reader has the basics. | Relevant in specific domains, fallback modes, validation workflows, or data-engine workflows. |
| 2 | Niche, emerging, historical, or mostly comparative. | Limited near-term deployment role, mostly research or secondary use. |
| 1 | Optional reference. | Watchlist-only, historical, or unlikely to affect stack decisions. |

## Metadata Shape

Prefer a compact metadata block near the top of each method page, after title and related-doc links where present. Ratings must be integers from 1 to 5.

```yaml
priority:
  learning: 5
  av_deployment: 4
  contexts: ["road-av", "airside", "warehouse"]
  maturity: "strong-candidate"
  reason: "Core LiDAR-inertial pattern for odometry, survey mapping, and localization fallback."
```

Allowed `maturity` values:

| Value | Meaning |
|---|---|
| `production-pattern` | The method or architecture pattern is common in real deployed AV/robotics systems, even if a specific paper implementation is not used unchanged. |
| `strong-candidate` | Technically credible for prototyping, evaluation, or near-term product integration with validation. |
| `specialist` | Valuable for specific sensors, domains, fallbacks, or workflows. |
| `research-reference` | Useful for understanding the frontier or building offline tools, but not yet deployment-ready. |
| `watchlist` | Track the method, but avoid treating it as a primary stack choice yet. |
| `historical` | Important mainly for learning context or lineage. |

Recommended context tags:

- `road-av`
- `airside`
- `warehouse`
- `yard-port`
- `campus`
- `mining`
- `agriculture`
- `construction`
- `delivery`
- `indoor`
- `outdoor`
- `gnss-denied`
- `adverse-weather`
- `mapping`
- `runtime-localization`
- `fallback`
- `validation`
- `data-engine`
- `simulation`

## Display Behavior

Method pages should render the priority block as a short human-readable line or table:

```text
Learning priority: 5/5
AV deployment relevance: 4/5
Maturity: strong candidate
Best contexts: road AV, airside, warehouse
```

Overview pages should add sortable or scan-friendly columns:

| Method | Learning | AV deployment | Maturity | Contexts |
|---|---:|---:|---|---|
| FAST-LIO2 | 4 | 5 | strong-candidate | mapping, runtime-localization, outdoor |

If the static reader later supports icons, it may render ratings as stars. The Markdown source should keep numeric values so search, validation, and table generation remain simple.

## Rating Governance

Ratings are editorial guidance, not benchmark scores. Each rating must have a short reason so future maintainers can challenge or update it.

Rules:

- Do not rate a method highly only because it is new.
- Do not use leaderboard results as the only reason for a high deployment score.
- Give high deployment ratings to patterns that survive integration constraints: sensor availability, calibration, latency, maintainability, licensing, observability, failure detection, and safety-case evidence.
- Give high learning ratings to methods that teach reusable concepts, even when they are not directly deployed.
- Use context tags to avoid pretending that one global ranking applies equally across all operating domains.

## Rollout Strategy

Phase 1 should add the schema and update the two method-library overview pages with the rating definitions.

Phase 2 should rate a curated seed set instead of all files at once:

- 15-25 core SLAM/localization pages.
- 15-25 core perception pages.
- Include at least one example from each major maturity class.

Phase 3 should backfill the remaining method files in batches, starting with pages already linked from the overview tables and coverage audits.

Phase 4 can add validation tooling if the ratings prove useful:

- Check that priority values are integers from 1 to 5.
- Check that `reason` is present.
- Check that `maturity` uses an allowed value.
- Check that context tags are from an allowed list.

## Data Flow

The Markdown file remains the source of truth. Any generated index or VitePress sidebar should read the metadata from the method page, normalize it, and expose it in overview tables or search metadata.

No runtime state is needed. Missing priority metadata should not break the site; it should render as unrated until the page is backfilled.

## Error Handling

Validation should report, not silently rewrite, these issues:

- Missing `priority` block on pages expected to be rated.
- Rating outside `1-5`.
- Unknown maturity value.
- Empty reason.
- Context tag that is not in the known set.

The reader should tolerate missing or malformed metadata by hiding the priority display for that page and leaving a build-time warning.

## Testing

For the first implementation pass:

- Add or update tests for metadata parsing if a parser exists.
- Add fixture pages for valid, missing, and malformed priority metadata.
- Verify overview generation does not fail when only some method pages are rated.
- Run the existing site/build checks after updating overview pages.

## Acceptance Criteria

- The repo defines the two-axis priority model clearly.
- Perception and SLAM method-library overview pages explain the rating semantics.
- Seed method pages show examples using the agreed metadata shape.
- Overview tables make it possible to identify high-priority learning and high-priority AV deployment methods.
- Missing ratings do not break the reader or navigation.
