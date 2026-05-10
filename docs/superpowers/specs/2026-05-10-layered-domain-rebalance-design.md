# Layered Domain Rebalance Design

## Context

The repository has a real content bias toward airport airside autonomous vehicles. This is partly intentional: airside has been the strongest reference operating design domain, with deep material on GSE, FOD, jet blast, turnaround operations, CAAS/FAA pathways, airport data systems, and fleet economics. The problem is that this reference domain has started to read like the default evaluation lens for generic autonomy-stack material.

This design keeps the useful airside depth, but adds a generic AV framing layer above it so future ratings, method pages, and synthesis pages do not silently equate deployment relevance with airside relevance.

## Goal

Reframe the public documentation and method-page rubric as:

> Generic autonomous-vehicle knowledge base first; airside remains a well-developed reference ODD, not the default evaluation lens.

The change should make road AV, warehouse, logistics yard, port, mining, construction, agriculture, delivery robot, and outdoor campus applicability visible without requiring full content parity in this pass.

## Non-Goals

- Do not erase airside-specific research.
- Do not mass-rewrite every airside mention.
- Do not expand every non-airside domain to match airside depth in this pass.
- Do not add more rating columns.
- Do not rescore the full method library.
- Do not make the domain-balance audit a hard CI gate.

## Recommended Approach

Use a layered rebalance:

1. Repo-level framing says the corpus is generic AV research with airside as a reference ODD.
2. Default rubric language changes from "Airside Fit" to "Domain Fit."
3. Method and SLAM ratings keep two axes: Learning and Deployment.
4. Deployment rating remains scoped to the page's explicit domain tags, reason text, or stated page scope.
5. Generic pages make cross-domain applicability visible in prose instead of treating airside as the default context.
6. Airside-specific pages remain airside-first, but add short transfer notes when the idea generalizes.
7. A lightweight audit script reports domain signal counts by folder so future work can notice drift.

## Content Model

### Global Framing

Update public entry points to establish the hierarchy:

- Generic AV knowledge base.
- Airside as reference ODD.
- Other domains as first-class transfer targets.

Primary targets:

- `README.md`
- `METHODOLOGY.md`
- `00-start-here/repo-map.md`
- the `90-synthesis/` files listed in Targeted Page Retrofit

### Domain Fit Rubric

Replace generic "Airside Fit" rubric language with "Domain Fit." Use one canonical domain vocabulary instead of grouped prose-only labels.

### Canonical Domain Vocabulary

Use these display labels in prose and reuse existing metadata tags where priority metadata is involved.

| Display label | Metadata tag | Audit bucket |
|---|---|---|
| Road AV | `road-av` | road |
| Airside | `airside` | airside |
| Warehouse | `warehouse` | warehouse |
| Logistics yard | `logistics-yard` | logistics-yard |
| Port | `port` | port |
| Mining | `mining` | mining |
| Construction | `construction` | construction |
| Agriculture | `agriculture` | agriculture |
| Delivery robot | `delivery-robot` | delivery-robot |
| Outdoor campus | `outdoor-campus` | outdoor-campus |

Treat `indoor`, `outdoor`, `gnss-denied`, and `adverse-weather` as operating conditions or setting tags, not primary deployment domains.

### Fit Judgments

The rubric should be compact. Pages can use a small table or bullets with one of four judgments:

- `strong fit`: method assumptions, sensors, operating speeds, actors, and validation evidence substantially match the domain.
- `conditional fit`: reusable pattern, but needs domain data, sensor changes, safety evidence, or operational constraints before deployment use.
- `weak fit`: conceptually related, but core assumptions do not match normal domain operation.
- `insufficient evidence`: not enough source material to make a domain-fit claim.

The goal is not to discuss every domain deeply. The goal is to stop generic method pages from having only one deployment lens.

Generic method pages and rating overview pages should include a compact `Domain Fit` section with three to six rows or bullets when the page sets an authoring pattern. Include airside when relevant, but do not make it the only deployment lens.

Suggested shape:

| Domain | Fit | Note |
|---|---|---|
| Road AV | conditional fit | Needs road-scale validation and actor coverage. |
| Airside | strong fit | Useful for apron mapping, FOD, or GSE routes when evidence supports it. |
| Warehouse | weak fit | Sensor/range assumptions may not match indoor AMR operation. |

### Airside-Specific Pages

A page is domain-specific when its primary research question is about one operating domain's operations, regulation, safety case, datasets, economics, or deployment procedure. Keyword presence alone is not enough. A LiDAR method evaluated on airport data can still be a generic method page; a FOD validation protocol is airside-specific.

Pages whose actual scope is airside, airport, apron, FOD, GSE, CAAS, FAA airside, pushback, jet blast, or turnaround can stay airside-first. These pages should only add a short "transfer note" when the idea has obvious reuse in another domain.

Example:

> Transfer note: The dispatch and evidence-model pattern also applies to logistics yards and ports, but aircraft priority, FOD, and apron safety zones remain airside-specific.

## Rating Model

The generated priority tables remain concise:

- Method
- Rating
- Stage
- Maturity
- Reason

The `Rating` cell continues to display:

- Learning stars
- Deployment stars

Interpretation:

- `learning`: value for understanding autonomy-stack concepts, independent of one deployment domain.
- `deployment`: practical AV deployment relevance in the page's tagged or explicitly scoped domain or domains. Generic pages should make cross-domain applicability visible in the reason text or nearby prose. Do not average across all AV domains, and do not use airside as the default context.

Generated tables stay concise. Because tags are not visible columns, any non-general Deployment score should include its domain or stack-role qualifier in the `Reason` cell. Domain specificity belongs in metadata tags, page prose, and reason text, not in extra visible rating columns.

Hidden `method-priority` metadata blocks are not part of this pass unless the implementation plan explicitly calls out a narrow metadata edit. The default implementation should update guidance and prose, not rescore the method library.

## Implementation Units

### 1. Framing Docs

Update the main entry points to clarify the corpus identity and prevent airside from reading as the default domain.

Expected edits:

- README intro and reading-path language.
- Methodology statements that currently name "airside fit" as a default method-page field.
- Repo map wording where useful.
- Synthesis overview language that frames generic stack decisions through airside only.

### 2. Rating Guidance

Update rating overview prose and nearby metadata guidance so deployment stars remain tag-scoped AV deployment signals, not broad all-domain averages. Generated rating table shape should remain unchanged.

### 3. Rubric Migration

Change pattern-setting rubric language:

- "airside fit" becomes "domain fit" in generic method guidance.
- "For Airside AV" style table headings become broader where the table is not truly airside-only.
- Pages that set future authoring patterns should show the compact domain-fit model.
- Do not manually edit generated rating table blocks between `<!-- priority-table:start -->` and `<!-- priority-table:end -->`. Edit surrounding prose only unless metadata changes are explicitly in scope.

### 4. Targeted Page Retrofit

Do not attempt a full corpus rewrite. The implementation allowlist is authoritative unless the implementation plan narrows it further:

- `30-autonomy-stack/perception/methods/overview.md`
- `30-autonomy-stack/localization-mapping/slam-methods/overview.md`
- `90-synthesis/master/master-synthesis.md`
- `90-synthesis/readiness-risk/technology-readiness.md`
- `90-synthesis/readiness-risk/continuous-research-loop.md`
- `90-synthesis/decisions/design-spec.md` where generic architecture is framed as airside-only

Also scan for generic-titled overview or synthesis entry points where the intro, summary, or recommendation section defaults to airside. Update only the highest-impact pattern-setting pages in this pass, with a cap of five additional files. Candidate examples include:

- `30-autonomy-stack/perception/overview/production-perception-systems.md`
- `30-autonomy-stack/world-models/overview.md`
- `90-synthesis/master/getting-started.md`

Individual method pages are out of scope unless a specific page is needed to fix a broken pattern in an overview.

### 5. Bias Audit

Add an informational audit command that counts domain signals across reader-source Markdown, grouped by top-level folder and domain. It should report drift without failing CI.

Implementation target:

- script: `tools/domain-balance/audit.mjs`
- command: `npm run domain:audit`
- test: `tests/domain-balance.test.mjs`

Audit scope:

- include root `README.md`, `INDEX.md`, `METHODOLOGY.md`, and `GLOSSARY.md`
- include reader-source Markdown under `00-start-here/` through `90-synthesis/`
- exclude `docs/superpowers/`, `.vitepress/`, `node_modules/`, build output, tests, and tool source

Audit buckets:

- airside
- road
- warehouse
- logistics-yard
- port
- mining
- construction
- agriculture
- delivery-robot
- outdoor-campus

This script should be intentionally simple and transparent. It should print deterministic tables, avoid file writes, and act as a visibility tool, not a correctness oracle.

## Guardrails

- Keep valid airside details.
- Avoid search-and-replace rewrites that remove useful domain context.
- Do not increase table metadata density.
- Keep VitePress sidebar links to the perception and SLAM overview pages unchanged unless a link is broken.
- Keep generated rating tables stable except for intentional overview prose changes.
- Do not manually edit generated priority table blocks.
- Do not change hidden `method-priority` blocks unless the implementation plan explicitly scopes that work.
- Keep the audit informational, not blocking.

## Verification

Run existing tests after implementation:

- `npm test`
- `npm run priority:check`
- `npm run links:check`
- `npm run docs:build`
- `npm run domain:audit`

If generated rating tables or metadata are touched, also run `npm run priority:generate` and inspect the diff. Generated priority-table blocks should have no unexpected changes.

Run `git diff --check` before committing. Confirm the new audit command prints domain counts without changing files.

## Success Criteria

- Public entry points describe the repo as generic AV research with airside as a reference ODD.
- Generic method guidance no longer defaults to "Airside Fit."
- Rating guidance preserves tag-scoped Deployment semantics and explicitly prevents airside from becoming the default context.
- Airside-specific pages still read naturally and are not diluted.
- The rating tables remain concise and readable.
- Future contributors have a visible domain-balance report.
- Grep checks for `Airside Fit`, `airside fit`, and `For Airside AV` show only airside-specific pages or intentional exceptions after the targeted retrofit.

