# Active Frontier Source Registry Design

Date: 2026-05-12
Status: Ready for user review

## Summary

Add a manual-first source registry for the repository's active research frontier:
perception, SLAM/mapping, world models, VLA/VLM, datasets/benchmarks, and
validation.

The registry will list where to monitor new research, which filters and query
patterns to use, how often to review each source, and whether later
semi-automation is feasible. It will not become a second backlog. Durable
candidate status remains in the existing canonical owners: the perception audit,
the SLAM audit, the cross-domain knowledge gap backlog, and the continuous
research loop.

## Context

The repository already has a repeatable research process:

- `90-synthesis/readiness-risk/continuous-research-loop.md` defines discovery,
  triage, promotion, cross-linking, verification, and repeat stages.
- `30-autonomy-stack/perception/overview/coverage-audit-2026.md` owns perception
  coverage gaps.
- `30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md`
  owns SLAM, odometry, localization, mapping, and SLAM benchmark gaps.
- `90-synthesis/readiness-risk/knowledge-gap-backlog.md` owns cross-architecture
  and non-dedicated frontier gaps.

The missing artifact is an operator-facing registry that answers: which sources
should be checked, which keywords should be used, how often they should be
reviewed, and which sources could later feed a semi-automated scan note.

## Goals

1. Create a source-monitoring page for the active technical frontier.
2. Provide concrete source categories, filters, and query banks for manual
   scanning.
3. Make rows structured enough for future Node validation without requiring
   automation now.
4. Define canonical routing so candidates move into existing audits/backlogs
   instead of staying in the registry.
5. Record automation feasibility honestly, including API, CI, security,
   copyright, and failure boundaries.

## Non-Goals

- Do not build the automation pipeline in this change.
- Do not create a durable candidate ledger in the registry.
- Do not auto-promote, auto-rank, or auto-edit research backlog files.
- Do not cover the whole repository scope. Regulations, companies, operations,
  and platform topics are included only when they directly affect the active
  frontier tracks.

## Placement And Links

Add the registry page at:

`90-synthesis/readiness-risk/active-frontier-source-registry.md`

Link it from:

- `90-synthesis/readiness-risk/continuous-research-loop.md`
- `90-synthesis/readiness-risk/knowledge-gap-backlog.md`
- `README.md`
- `INDEX.md`

The page should be reader-facing enough for the VitePress site, but operational
rather than narrative. It should function as a working checklist for maintaining
research freshness.

## Page Structure

The registry page will contain:

1. `How To Use This Registry`
   - Manual scan workflow.
   - Scope boundaries.
   - Routing rules.
2. `Registry Content Model`
   - Controlled values.
   - Source row schema.
   - Source health states.
3. `Source Categories`
   - Broad source taxonomy across preprints, conferences, publishers, scholarly
     indexes, datasets, code/model artifacts, simulation/validation
     infrastructure, industry research, sensor frontier, and weak-signal
     sources.
4. `Source Registry`
   - Concrete source rows with native filters, manual query pattern, cadence,
     automation feasibility, and caveats.
5. `Active Frontier Query Bank`
   - Reusable query groups for perception, SLAM/mapping, world models, VLA/VLM,
     datasets/benchmarks, and validation.
6. `Candidate Routing`
   - Canonical owner table and status rules.
7. `Workflow And Automation`
   - Manual-first workflow, phased automation feasibility, CI boundaries,
     failure handling, credentials/security, copyright/robots/terms, and test
     split.

## Source Coverage

The registry should cover these source categories:

| Category | Example sources | Role |
|---|---|---|
| Preprints and metadata | arXiv, OpenReview, Semantic Scholar, OpenAlex, Crossref, DBLP | Early discovery and metadata cross-checking. |
| Core venues | CVPR, ICCV, ECCV, WACV, NeurIPS, ICML, ICLR, CoRL, RSS, ICRA, IROS, IEEE IV, ITSC | Accepted paper and workshop tracking. |
| Publisher indexes | IEEE Xplore, ACM Digital Library, SpringerLink, ScienceDirect, SAGE/IJRR, SAE | Final proceedings, journals, robotics/control/sensor papers. |
| Datasets and benchmarks | Waymo Open Dataset, nuScenes, Argoverse, KITTI/SemanticKITTI, nuPlan, CARLA Leaderboard, NAVSIM, Bench2Drive, OpenLane/OpenLane-V2, V2X, adverse-weather, corruption, and SLAM benchmarks | Dataset and evaluation freshness. |
| Code and model artifacts | GitHub, Hugging Face, official project pages, OpenMMLab, OpenPCDet, Autoware/ROS ecosystems | Reproducibility and release signals. |
| Simulation and validation infrastructure | CARLA, CommonRoad, Scenic, MetaDrive, Waymax, ASAM OpenSCENARIO, ASAM OpenODD, ASAM OpenDRIVE | Closed-loop and scenario-evidence monitoring. |
| Safety and regulatory frontier | ISO 21448/SOTIF, ISO 26262, UL 4600, SAE, UNECE, NHTSA ADS materials | Validation, assurance, and standards signals. |
| Industry research | Waymo, NVIDIA, Waabi, Toyota/Woven, Mobileye, Bosch, Aurora, Zoox, Tesla AI | Production-adjacent technical signals. |
| Sensor frontier | LiDAR, 4D radar, FMCW LiDAR, event-camera, and thermal vendors; SPIE/SAE/IEEE sensor papers; patents and application notes | Hardware-driven perception and SLAM frontier signals. |
| Weak signals | Lab pages, newsletters, challenge pages, curated GitHub lists, social/community posts | Discovery only; never sufficient for promotion. |

## Registry Content Model

Each source row should use stable IDs and parseable fields:

| Field | Purpose |
|---|---|
| `Source ID` | Stable machine-readable identifier. |
| `Source` | Human-readable source name. |
| `Source Type` | Controlled source class, such as `preprint`, `venue`, `publisher-index`, `dataset`, `benchmark`, `code`, `model`, `standard`, `regulator`, `industry-lab`, `weak-signal`. |
| `Authority Tier` | `T1`, `T2`, `T3`, or `T4`. |
| `Source Role` | Discovery role: primary evidence, aggregator, code artifact, benchmark, dataset, weak signal, or standards source. |
| `Frontier Tracks` | Comma-separated track IDs. |
| `Evidence Objects` | Expected primary evidence: paper, DOI, arXiv/OpenReview ID, repo, project page, dataset page, benchmark page, standard, release note. |
| `Native Filters` | Native categories, venue filters, search operators, alert options, or API parameters. |
| `Manual Query Pattern` | Human-readable query seed. |
| `Watch Method` | RSS, API, email alert, saved search, page watch, manual page review, or issue digest. |
| `Cadence` | Weekly, monthly, quarterly, event-driven, or conference-cycle. |
| `Last Checked` | ISO date. |
| `Next Review` | ISO date. |
| `Source Health` | Controlled health value. |
| `Automation` | `high`, `medium`, `low`, or `none`. |
| `Verification Rule` | Required primary-source check before routing. |
| `Caveats` | Short source-specific warnings. |

Authority tiers:

- `T1`: peer-reviewed venue, official benchmark/dataset, official standard, or
  regulator source.
- `T2`: author/lab page, official repository/model release, industry technical
  report, or preprint with artifacts.
- `T3`: scholarly aggregator or metadata index.
- `T4`: social, newsletter, community, vendor, or other weak signal.

Automation values:

- `high`: stable API, RSS, export, or predictable identifiers.
- `medium`: stable pages, but scraping/page-diff/manual query shaping likely.
- `low`: useful manually, brittle for scripts.
- `none`: manual-only.

Source health values:

- `active`: source works and returns relevant frontier material.
- `degraded`: filters, feeds, or result quality have weakened but remain useful.
- `paused`: temporarily noisy, unavailable, or off-cycle.
- `retired`: no longer useful; replacement or rationale belongs in caveats.
- `moved`: source appears relocated; keep old URL until manually verified.
- `stale`: review date has expired; content is not automatically wrong.
- `unreachable`: last check failed; requires retry or manual review.
- `withdrawn-or-retracted`: only set after primary-source confirmation.
- `license-or-access-limited`: source exists but use or redistribution is
  constrained.
- `unknown`: automation could not determine status.

## Query Bank

Queries are grouped by track and use stable IDs:

| Field | Purpose |
|---|---|
| `Query ID` | Stable machine-readable query identifier. |
| `Track` | One frontier track. |
| `Source IDs` | Source IDs where the query applies. |
| `Query Pattern` | Human-readable search pattern. |
| `Native Filters` | Source-specific categories/operators. |
| `Intent` | What the query is trying to find. |
| `Cadence` | Review frequency. |

Track IDs:

- `perception`
- `slam-mapping`
- `world-models`
- `vla-vlm`
- `datasets-benchmarks`
- `validation`

Seed keyword groups:

| Track | Seed keywords |
|---|---|
| `perception` | `3D object detection`, `BEV`, `occupancy prediction`, `panoptic occupancy`, `open-vocabulary 3D`, `OOD`, `anomaly segmentation`, `sensor fusion`, `4D radar`, `FMCW LiDAR`, `event camera`, `thermal perception` |
| `slam-mapping` | `LiDAR-inertial odometry`, `visual-inertial SLAM`, `Gaussian SLAM`, `neural implicit mapping`, `radar odometry`, `loop closure`, `pose graph optimization`, `lifelong mapping`, `dynamic object removal`, `map change detection` |
| `world-models` | `occupancy world model`, `driving world model`, `scene generation`, `neural simulation`, `4D occupancy forecasting`, `diffusion planning`, `latent dynamics`, `closed-loop simulation` |
| `vla-vlm` | `vision-language-action`, `driving VLM`, `robot foundation model`, `spatial reasoning`, `grounded language`, `closed-loop VLM evaluation`, `hallucination`, `action head` |
| `datasets-benchmarks` | `autonomous driving dataset`, `adverse weather`, `sensor corruption`, `FOD`, `open-world benchmark`, `V2X dataset`, `4D radar dataset`, `SLAM benchmark` |
| `validation` | `closed-loop evaluation`, `scenario testing`, `uncertainty calibration`, `runtime monitor`, `safety case`, `fault injection`, `robustness benchmark`, `distribution shift` |

Cross-cutting modifiers:

- `autonomous driving`
- `self-driving`
- `ego vehicle`
- `driving scenes`
- `closed-loop`
- `ODD`
- `sim-to-real`
- `long-tail`
- `safety-critical`

Negative filters should exclude generic robotics, generic LLM, medical imaging,
and unrelated remote-sensing results when they dominate a query.

## Candidate Routing

This registry owns source discovery only. Candidate status is maintained in the
canonical owner, not in this page.

| Candidate type | Canonical owner after triage |
|---|---|
| Perception methods, perception robustness, perception datasets | Perception Coverage Audit |
| SLAM, odometry, localization, mapping methods, SLAM benchmarks | SLAM Coverage Audit |
| World models, VLA/VLM, end-to-end driving, simulation frontier | Knowledge Gap Backlog until a dedicated audit exists |
| Cross-track datasets and benchmarks | Owning domain audit if method-specific; otherwise Knowledge Gap Backlog |
| Validation, safety evidence, evaluation protocols | Knowledge Gap Backlog or relevant `60-safety-validation/` page |

Routing statuses:

- `route-to-backlog`: durable gap belongs in `knowledge-gap-backlog.md`.
- `route-to-audit`: perception or SLAM evidence belongs in the relevant audit.
- `route-to-loop`: process or cadence change belongs in
  `continuous-research-loop.md`.
- `watch`: relevant but not yet actionable. If it creates ongoing research
  work, place it in the canonical watchlist/P2 row rather than leaving it as a
  registry-only item.
- `ignore`: out of scope, duplicate, superseded, or insufficiently primary.

Promotion rule:

A candidate can be promoted only after primary-source verification: canonical
paper/DOI/arXiv/OpenReview ID, official repo or project page where available,
dataset/benchmark page if relevant, artifact/license/access notes, validation
or benchmark claim, and at least one caveat.

Candidate flow:

`source scan -> primary-source verification -> dedupe -> canonical backlog/audit -> atomic page or watchlist`

## Workflow And Automation

### Manual-First Boundary

The registry is a manual-first intake surface. Automation may validate
structure, report diagnostics, and produce candidate digests. It must not edit
canonical backlogs, route candidates, delete sources, promote work, or replace
primary-source evidence with aggregator metadata.

### Manual Workflow

1. Scan source or query.
2. Verify the primary source: paper, project page, dataset page, benchmark page,
   release note, standard, or official repository.
3. Dedupe against existing registry rows, audits, canonical pages, and gap
   backlogs.
4. Route manually using the statuses above.
5. Link the registry row to the canonical destination instead of restating the
   backlog item.

### Review Cadence And Gates

- Weekly: review new candidates and automation notes, dedupe them, and assign a
  routing decision.
- Monthly: prune stale `watch` traces, confirm canonical links still resolve,
  and close entries that have been routed.
- Quarterly: review whether source categories, scope boundaries, or automation
  checks need adjustment in `continuous-research-loop.md`.

Human review is required before any source changes canonical backlog, audit, or
loop content. A source may be routed only after primary-source verification and
dedupe are complete.

### Automation Phases

- Phase 0: Markdown-only registry.
- Phase 1: offline Node checker validates IDs, enums, required fields, ISO
  dates, duplicate IDs/URLs, source-health values, stale review dates, and
  canonical links.
- Phase 2: opt-in Node scanner creates review artifacts only: dated Markdown
  digest, raw-result manifest/cache, and skipped/error summary.
- Phase 3: scheduled GitHub Action may open a review issue or upload artifacts.
  It must not commit edits or modify canonical files.

### CI And Fetch Policy

Normal PR checks stay offline and deterministic: schema checks, internal links,
tests, and VitePress build.

Live source fetching runs only through manual commands or scheduled jobs.
Scheduled fetches must use provider allowlists, short timeouts, bounded retries,
low concurrency, per-provider budgets, stable user-agent strings, cached
responses where permitted, and secrets only from GitHub Actions or local
environment variables.

Missing API keys skip that provider rather than failing the build.

### Failure, Security, And Terms

External failures produce diagnostics, not content changes. API outages, 403/429
responses, DNS/TLS failures, malformed data, and schema drift should be recorded
as `unknown` or `unreachable` until manually reviewed.

No API keys, cookies, signed URLs, or tokens belong in Markdown, VitePress
output, logs, or PR jobs. Scheduled jobs should use least permissions, such as
`contents: read` and `issues: write`.

Use official APIs where possible. Do not store copied abstracts, paper bodies,
README bodies, fetched PDFs, dataset contents, or large scraped text. Store
metadata, URLs, license/access notes, and human-written review notes.

### Testing Split

Run on PRs:

- Registry schema validation.
- Internal link checks.
- VitePress build.
- Fixture-based parser tests.
- Deterministic diagnostic snapshots.
- Secret-pattern checks.

Run only manually or on schedule:

- Live provider smoke tests.
- Freshness scans.
- Source-health reports.
- Candidate discovery digests.

## Later Automation Feasibility

Initial high-feasibility automation sources:

- arXiv API/RSS
- GitHub Search API
- OpenAlex API

Medium-feasibility sources:

- Semantic Scholar API
- OpenReview API
- CVF static proceedings pages
- stable dataset/benchmark pages

Manual-only or weak automation sources:

- vendor blogs
- benchmark leaderboards with changing HTML
- standards pages behind access controls
- ResearchGate
- social/news/community sources

Provider limits must be configuration, not hidden constants. arXiv expects
polite delays and bounded slices; GitHub search uses separate rate buckets and
secondary limits; Semantic Scholar and OpenAlex have key-dependent throughput;
OpenReview has venue-specific fields and API-version differences.

## Acceptance Criteria

The implementation is complete when:

1. `active-frontier-source-registry.md` exists at the planned path.
2. The page contains the approved source model, source categories, query bank,
   candidate routing, and workflow/automation boundary.
3. The page includes concrete source rows and query examples for all six active
   frontier tracks.
4. `continuous-research-loop.md`, `knowledge-gap-backlog.md`, `README.md`, and
   `INDEX.md` link to the new registry.
5. Existing tests and VitePress build pass.
6. No automation pipeline is introduced unless separately planned and approved.

## Referenced Source Capabilities

The feasibility notes were informed by current public documentation for:

- arXiv API user manual: https://info.arxiv.org/help/api/user-manual.html
- arXiv RSS help: https://info.arxiv.org/help/rss.html
- arXiv category taxonomy: https://arxiv.org/category_taxonomy
- OpenReview API: https://docs.openreview.net/getting-started/using-the-api
- IEEE developer API documentation: https://developer.ieee.org/docs/read/Home
- GitHub Search API: https://docs.github.com/en/rest/search/search
- OpenAlex API: https://docs.openalex.org/
- Semantic Scholar API: https://api.semanticscholar.org/api-docs/
- CVF Open Access: https://openaccess.thecvf.com/menu
- ASAM OpenSCENARIO: https://publications.pages.asam.net/standards/ASAM_OpenSCENARIO/ASAM_OpenSCENARIO_XML/latest/00_preface/01_introduction.html
- ASAM OpenODD: https://www.asam.net/standards/detail/openodd/
- NHTSA automated vehicles safety: https://www.nhtsa.gov/vehicle-safety/automated-vehicles-safety
- ISO 21448: https://www.iso.org/standard/77490.html
