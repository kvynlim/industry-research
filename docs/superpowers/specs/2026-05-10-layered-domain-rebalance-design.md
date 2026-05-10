# Layered Domain Rebalance Design

## Context

The repository has a real content bias toward airport airside autonomous vehicles. This is partly intentional: airside has been the strongest reference operating design domain, with deep material on GSE, FOD, jet blast, turnaround operations, CAAS/FAA pathways, airport data systems, and fleet economics. The problem is that this reference domain has started to read like the default evaluation lens for generic autonomy-stack material.

This design keeps the useful airside depth, but adds a generic AV framing layer above it so future ratings, method pages, and synthesis pages do not silently equate deployment relevance with airside relevance.

## Goal

Reframe the public documentation and method-page rubric as:

> Generic autonomous-vehicle knowledge base first, airside autonomous vehicles as the primary reference deployment case second.

The change should make road AV, warehouse, logistics yard, port, mining, construction, agriculture, delivery robot, and outdoor campus applicability visible without requiring full content parity in this pass.

## Non-Goals

- Do not erase airside-specific research.
- Do not mass-rewrite every airside mention.
- Do not expand every non-airside domain to match airside depth in this pass.
- Do not add more rating columns.
- Do not make the domain-balance audit a hard CI gate.

## Recommended Approach

Use a layered rebalance:

1. Repo-level framing says the corpus is generic AV research with airside as a reference ODD.
2. Default rubric language changes from "Airside Fit" to "Domain Fit."
3. Method and SLAM ratings keep two axes: Learning and Deployment.
4. Deployment rating means broad AV deployment relevance unless a page is explicitly scoped to a domain.
5. Airside-specific pages remain airside-first, but add short transfer notes when the idea generalizes.
6. A lightweight audit script reports domain signal counts by folder so future work can notice drift.

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
- selected `90-synthesis/` entry points that currently imply airside is the default deployment frame

### Domain Fit Rubric

Replace generic "Airside Fit" rubric language with "Domain Fit." The default domain set is:

- road AV
- airside
- warehouse / indoor
- logistics yard / port
- mining / construction / agriculture
- delivery robot / outdoor campus

The rubric should be compact. Pages can use a small table or bullets with one of four judgments:

- strong fit
- conditional fit
- weak fit
- insufficient evidence

The goal is not to discuss every domain deeply. The goal is to stop generic method pages from having only one deployment lens.

### Airside-Specific Pages

Pages whose title or scope is explicitly airside, airport, apron, FOD, GSE, CAAS, FAA airside, pushback, jet blast, or turnaround can stay airside-first. These pages should only add a short "transfer note" when the idea has obvious reuse in another domain.

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
- `deployment`: broad autonomous-vehicle deployment relevance, unless the page scope is explicitly domain-specific.

Domain specificity belongs in page prose and metadata tags, not in extra visible rating columns.

## Implementation Units

### 1. Framing Docs

Update the main entry points to clarify the corpus identity and prevent airside from reading as the default domain.

Expected edits:

- README intro and reading-path language.
- Methodology statements that currently name "airside fit" as a default method-page field.
- Repo map wording where useful.
- Synthesis overview language that frames generic stack decisions through airside only.

### 2. Rating Guidance

Update rating overview prose and any nearby metadata guidance so deployment stars mean broad AV deployment relevance. Generated rating table shape should remain unchanged.

### 3. Rubric Migration

Change pattern-setting rubric language:

- "airside fit" becomes "domain fit" in generic method guidance.
- "For Airside AV" style table headings become broader where the table is not truly airside-only.
- Pages that set future authoring patterns should show the compact domain-fit model.

### 4. Targeted Page Retrofit

Do not attempt a full corpus rewrite. Update the pages that teach the repo how to think:

- `30-autonomy-stack/perception/methods/overview.md`
- `30-autonomy-stack/localization-mapping/slam-methods/overview.md`
- `90-synthesis/master/master-synthesis.md`
- `90-synthesis/readiness-risk/technology-readiness.md`
- `90-synthesis/readiness-risk/continuous-research-loop.md`
- `90-synthesis/decisions/design-spec.md` where generic architecture is framed as airside-only

### 5. Bias Audit

Add an informational audit command that counts domain signals across source Markdown, grouped by top-level folder and domain. It should report drift without failing CI.

Suggested domain buckets:

- airside
- road
- warehouse
- logistics yard / port
- mining
- construction
- agriculture
- delivery / campus

This script should be intentionally simple and transparent. It is a visibility tool, not a correctness oracle.

## Guardrails

- Keep valid airside details.
- Avoid search-and-replace rewrites that remove useful domain context.
- Do not increase table metadata density.
- Keep the left-sidebar rating entry points unchanged unless a link is broken.
- Keep generated rating tables stable except for intentional overview prose changes.
- Keep the audit informational, not blocking.

## Verification

Run existing tests after implementation:

- `npm test`
- rating metadata check if available through the existing npm scripts or direct node command
- overview generation check if the implementation touches generated rating tables

Run the new audit command and confirm it prints domain counts without changing files.

## Success Criteria

- Public entry points describe the repo as generic AV research with airside as a reference ODD.
- Generic method guidance no longer defaults to "Airside Fit."
- Rating guidance clearly defines Deployment as broad AV deployment relevance.
- Airside-specific pages still read naturally and are not diluted.
- The rating tables remain concise and readable.
- Future contributors have a visible domain-balance report.

