# Knowledge Base Section Overviews Design

Date: 2026-05-10

## Context

The repository is a Markdown-first VitePress knowledge base for autonomous
vehicle and autonomy research. `10-knowledge-base/` contains first-principles
foundation material across probability/statistics, optimization, numerical
linear algebra, geometry, mapping, state estimation, sensors, signal
processing, controls, robotics, systems engineering, and machine learning.

Only `10-knowledge-base/machine-learning/overview.md` currently acts as a
section-level teaching guide. The other folders contain strong atomic pages, but
readers must infer the folder purpose, prerequisite order, and autonomy-stack
role from individual filenames and local "Related docs" sections.

The user wants every knowledge-base section, excluding `_assets`, to have an
overview that explains the foundation itself and the role it plays in autonomy:
what problem the field helps solve, how it supports perception, SLAM, mapping,
planning, controls, validation, runtime systems, and operations, and what can
go wrong when the foundation is misunderstood.

## Goal

Add canonical `overview.md` pages for every public `10-knowledge-base` folder
except `_assets`, using the existing machine-learning overview as the quality
bar but not as a rigid template.

Each overview should be a full teaching guide that leads with the autonomy
problem, then explains the foundation. The reader should quickly understand:

- what the field studies from first principles,
- why an autonomy system needs it,
- which autonomy problems it helps solve,
- where it appears in the stack,
- which pages to read for different engineering tasks,
- how it differs from neighboring foundation sections,
- what failure modes it helps reviewers detect.

## Non-Goals

- Do not add new atomic topic pages in this pass.
- Do not rewrite every child page to match a new template.
- Do not turn the overviews into broad link dumps or duplicate `INDEX.md`.
- Do not create a new visual system; reuse the current curated visual contract.
- Do not perform a fresh web research sweep. Use the existing corpus and durable
  source references already present in the section pages.
- Do not make airside the default lens. Airside can remain a detailed reference
  ODD, but the overviews should frame transferable autonomy foundations.
- Do not implement all overview content, visuals, navigation changes, tests,
  `README.md`/`INDEX.md` updates, and the machine-learning revision as one
  oversized implementation plan.
- Do not reorganize child pages, rename folders, or change the knowledge-base
  taxonomy beyond the overview, navigation, and visual assignments needed here.

## Target Pages

Create exactly 11 new overview pages:

```text
10-knowledge-base/controls/overview.md
10-knowledge-base/geometry-3d/overview.md
10-knowledge-base/mapping/overview.md
10-knowledge-base/numerical-linear-algebra/overview.md
10-knowledge-base/optimization/overview.md
10-knowledge-base/probability-statistics/overview.md
10-knowledge-base/robotics/overview.md
10-knowledge-base/sensors/overview.md
10-knowledge-base/signal-processing/overview.md
10-knowledge-base/state-estimation/overview.md
10-knowledge-base/systems-engineering/overview.md
```

Keep `10-knowledge-base/machine-learning/overview.md` as the existing overview
page, but revise it to the same reader-facing contract as the new pages. Its
current perception-heavy framing should broaden to autonomy as a whole:
perception, prediction, world models, planning-facing learned objectives,
validation, runtime monitoring, and deployment failure modes.

## Overview Page Contract

Each of the 12 public knowledge-base overview pages, including the revised
machine-learning overview, is a normal knowledge-base page. Each must have:

- an H1 of the form `# <Section> Foundations for Autonomy`,
- exactly one curated `kb-visual` block immediately after the H1,
- one SVG under `10-knowledge-base/_assets/visuals/`,
- one explicit taxonomy assignment in `tools/knowledge-base/visual-taxonomy.mjs`,
- valid local Markdown links,
- a `## Core Sources` section containing only sources directly used by the
  overview prose.

The required reader-facing structure is:

```markdown
# <Section> Foundations for Autonomy

<!-- kb-visual:start -->
![<Section> Foundations for Autonomy curated visual](../_assets/visuals/<section>-overview.svg)

*Visual: <caption explaining the section-level autonomy role>.*
<!-- kb-visual:end -->

## Why This Foundation Exists

## What This Field Studies From First Principles

## Autonomy Problem Map

## Core Mental Model

## What This Foundation Lets You Review

## Problem-Class Coverage

## Reading Paths By Task

## Dependency Map

## Interfaces, Artifacts, and Failure Modes

## Boundaries With Neighboring Foundations

## Pages In This Section

## Core Sources
```

The H2 headings above are mandatory and should appear in this order. "Not
boilerplate" means the prose, examples, table entries, reading paths, and
diagnostic cases should be section-specific; it does not mean headings may be
renamed or omitted. For sparse folders such as `sensors` or `robotics`,
sections can be brief and the `Pages In This Section` inventory can be compact.
For dense folders such as `state-estimation`, `geometry-3d`,
`machine-learning`, `probability-statistics`, and
`numerical-linear-algebra`, the sections should carry more teaching detail.

### Opening Sections

The first four sections are mandatory and should be explicit, not implied:

- `Why This Foundation Exists`: explain the autonomy problem that makes the
  foundation necessary. This section should answer "what problem does this help
  solve?" before listing pages.
- `What This Field Studies From First Principles`: name the core objects,
  operations, assumptions, and questions of the field.
- `Autonomy Problem Map`: connect the field to concrete autonomy problems such
  as perception uncertainty, SLAM observability, map update semantics,
  trajectory feasibility, release evidence, or runtime timing.
- `Core Mental Model`: compress the section into a durable model a reviewer can
  carry into system design and incident review.

For example, the numerical-linear-algebra overview should explain that autonomy
systems repeatedly turn geometry, probability, sensor models, and motion
constraints into linear systems. It should state that solver correctness depends
on how matrices are formed, scaled, ordered, factorized, solved, marginalized,
and interpreted, not only on whether the residual model is conceptually right.

Each overview should include a "wrong mental model" sentence in the opening
sections. Example: "Numerical linear algebra is not just solver implementation;
it is where observability, conditioning, rank, sparsity, and marginalization
become visible."

`What This Foundation Lets You Review` should include 3-5 concrete review
questions that a reader can use in design review, incident review, or debugging.
Each page should make clear that after reading it the reader can review one
class of design decision, debug one class of failure, and know when to hand off
to a neighboring foundation.

## Problem-Class Coverage

Every overview should include the same compact coverage table so the sections
are comparable across the autonomy stack:

```markdown
| Problem Class | Role Of This Foundation | Representative Applied Pages |
|---|---|---|
| Perception and scene understanding | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
| Localization, SLAM, and state estimation | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
| Mapping and spatial memory | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
| Prediction and world modeling | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
| Planning and decision making | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
| Control and actuation | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
| Safety, validation, and assurance | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
| Runtime systems and operations | primary/supporting/not central plus the section-specific role | optional curated links with reasons |
```

Rows can mark the role as `primary`, `supporting`, or `not central`, but rows
should not be omitted casually. The point is to make it clear how each
foundation relates to the same autonomy problem classes, even when the answer is
"supporting" or "not central." A `not central` row can be one concise sentence
and does not need an applied link.

Across the whole coverage table, each overview should link to 3-5 unique
applied pages outside `10-knowledge-base`. Links may repeat across rows only
when the same applied page is genuinely the best diagnostic example for
multiple problem classes. A link qualifies only if the reader would use this
foundation to review or debug that applied page.

## Reading Paths

`Reading Paths By Task` should be organized by engineering intent rather than
only by difficulty. Examples:

- "debug scan matching or SLAM degeneracy,"
- "review tracking covariance and association gates,"
- "validate planner-controller feasibility,"
- "audit sensor timing and synchronization,"
- "review model calibration and leakage risk,"
- "triage map-change or dynamic-object-removal failures."

For linear sections, a ladder is fine. For graph-shaped sections such as
geometry, state estimation, systems engineering, and robotics, use multiple
paths: estimator path, mapping path, planning/control path, validation path, or
operations path.

`Pages In This Section` should group local pages by learning role, not by raw
alphabetical order. Use group labels such as `core primitives`, `diagnostics`,
`implementation patterns`, `applied bridges`, or section-specific equivalents.

## Dependency Maps

Each overview should include an ASCII dependency map. The map should show both
internal concept order and cross-folder dependencies where relevant.

Important cross-folder examples:

```text
probability/statistics -> optimization -> numerical linear algebra -> state estimation
geometry + sensors + signal processing -> state estimation -> mapping and localization
robotics -> planning and decision framing -> controls
machine learning -> perception, prediction, world models, validation, and runtime monitoring
systems engineering -> timing, evidence, release, observability, and operations
```

The map should not become another full page list. It should explain concept
flow.

## Boundary Rules

Each overview must include `Boundaries With Neighboring Foundations` to reduce
repetition across the knowledge base.

Use these ownership rules:

- `probability-statistics` owns belief, evidence, uncertainty semantics,
  likelihoods, priors, calibration, hypothesis testing, robust statistics, and
  decision thresholds. It should not prescribe solver algorithms except as
  motivation.
- `optimization` owns objective construction, residual linearization, update
  rules, damping, trust regions, globalization, autodiff/Jacobians, and solver
  selection. It should reference probability for residual meaning and numerical
  linear algebra for the linear solve.
- `numerical-linear-algebra` owns factorization, conditioning, rank,
  nullspaces, sparsity, ordering, fill-in, Schur complements, marginalization
  algebra, covariance recovery, and PCG. It should not become an estimator or
  solver-library guide.
- `state-estimation` owns time-evolving latent state, prediction/update cycles,
  smoothing, fusion architecture, association in context, out-of-sequence data,
  observability in deployed estimators, and integrity. Probability explains
  statistics such as Mahalanobis distance, NIS, and NEES; state estimation
  explains where those checks live in fusion, tracking, SLAM, and integrity
  monitors.
- `geometry-3d` owns frames, transforms, projection, Lie geometry, sensor
  geometry, calibration geometry, and registration geometry. It should not own
  persistent map semantics or estimator lifecycle. Registration remains
  geometry until its result is committed into persistent map state.
- `mapping` owns persistent environment representation: occupancy, semantic
  layers, TSDF/ESDF/surfels, map fusion, update policy, dynamic/static
  separation, and map QA.
- `signal-processing` owns raw-to-feature transforms: sampling, filtering, FFT,
  radar range-Doppler-angle processing, CFAR, windowing, aliasing, and clutter
  suppression.
- `sensors` owns cross-modality measurement likelihoods, error-budget
  contracts, observability limits, degradation modes, and modality handoff
  assumptions. Geometry owns projection and calibration geometry;
  signal-processing owns waveform and raw-to-feature transforms.
- `controls` owns turning plans and beliefs into dynamically feasible commands:
  closed-loop tracking, MPC, iLQR, constraints, stability, vehicle dynamics,
  receding-horizon command generation, actuator limits, and safety filters.
- `robotics` owns robot/task vocabulary, autonomy problem decomposition,
  route/behavior/motion-planning vocabulary, handoff contracts, map formats
  such as Lanelet2, embodiment assumptions, and behavior/motion planning
  framing.
- `systems-engineering` owns cross-cutting integration contracts: timing,
  latency, validation metrics, release gates, architecture tradeoffs,
  observability, operational error budgets, and evidence flow. It should not
  re-explain each foundation's local failure modes.
- `machine-learning` owns learned representations, objectives, architectures,
  model calibration/leakage, world-model learning, and deployment failure modes.

Each overview should include one short diagnostic micro-case showing how a
wrong mental model for the foundation can produce an autonomy bug. The case can
be a few sentences or a small bullet list, but it should connect a concrete
symptom to the foundation and to the neighboring section that owns the next
layer of diagnosis.

## Applied Stack Links

Avoid broad link farms. Keep link purposes separate:

- `Reading Paths By Task`: internal learning order.
- `Dependency Map`: prerequisites and downstream foundations.
- `Problem-Class Coverage`: curated applied examples outside
  `10-knowledge-base`.
- `Pages In This Section`: complete local inventory, grouped by learning role.
- `Core Sources`: external canonical references only.

Applied links should use role labels such as `Primary consumer`, `Diagnostic
use`, `Implementation example`, or `Validation hook`, and each link should state
the review question it helps answer.

`Core Sources` should use canonical books, papers, documentation, or surveys
already represented in child pages where possible. Do not add a fresh source
audit unless an existing child page exposes an obvious source gap. Internal
applied-stack links belong in the problem-class table, not in `Core Sources`.

## Navigation Design

Adding `overview.md` files is not enough by itself. The current VitePress
sidebar generator sorts directory entries by name, emits directory groups
before Markdown file entries, and treats `overview.md` like any other file
within a folder. Implementation must explicitly prioritize `overview.md` inside
each folder.

Adopt this behavior:

- each direct public `10-knowledge-base/<folder>` sidebar group links to
  `/10-knowledge-base/<folder>/overview`,
- the same `overview.md` page remains visible as the first child item in that
  group,
- navigation tests assert both the folder-group link and first-child ordering
  for every public knowledge-base folder except `_assets`.

## Visual Contract

Every new overview requires a curated visual. Use filenames such as:

```text
10-knowledge-base/_assets/visuals/controls-overview.svg
10-knowledge-base/_assets/visuals/geometry-3d-overview.svg
10-knowledge-base/_assets/visuals/mapping-overview.svg
10-knowledge-base/_assets/visuals/numerical-linear-algebra-overview.svg
10-knowledge-base/_assets/visuals/optimization-overview.svg
10-knowledge-base/_assets/visuals/probability-statistics-overview.svg
10-knowledge-base/_assets/visuals/robotics-overview.svg
10-knowledge-base/_assets/visuals/sensors-overview.svg
10-knowledge-base/_assets/visuals/signal-processing-overview.svg
10-knowledge-base/_assets/visuals/state-estimation-overview.svg
10-knowledge-base/_assets/visuals/systems-engineering-overview.svg
```

Diagram kinds should be distributed semantically. Do not assign all overview
pages to one generic kind such as `learning-roadmap`, because the test suite
caps how many pages can share one diagram kind. Check current diagram-kind
usage before assigning the 11 new overview visuals.

Update
`docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`,
because `tools/knowledge-base/curated-visuals.mjs` parses that note as the
full live visual manifest and validates it against every live
`10-knowledge-base/**/*.md` file. After adding the 11 overview pages, update the
note's scope and live-file counts to the new actual inventory, and add one exact
manifest line for each new overview using the existing format:

```text
- `10-knowledge-base/<folder>/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram for <folder>.
```

## Index And Entry-Point Updates

Update high-level entry points so readers discover the overviews:

- `README.md` should point "First-principles estimator math" and related
  reading paths to the new overview pages where appropriate.
- `INDEX.md` should add or adjust mathematical-foundation rows so primary links
  point to overview pages, with atomic pages listed as supporting links.

These should be targeted updates, not a broad rewrite.

## Implementation Phasing

This parent spec should become phased implementation plans. No single plan
should attempt all 11 new overviews, the machine-learning revision, visuals,
navigation, tests, `README.md`, and `INDEX.md` at once.

1. Contract/navigation phase:
   - add tests for overview coverage, required heading order, curated visual
     coverage, taxonomy assignment coverage, the eight problem-class rows, and
     sidebar ordering;
   - update VitePress navigation so `overview.md` appears first and folder
     headings link to overview pages.

2. First content batch:
   - add overview pages, visuals, taxonomy assignments, manifest entries, and
     link checks for smaller sections: `sensors`, `robotics`, `mapping`,
     `controls`, `signal-processing`, and `optimization`.

3. Second content batch:
   - add overview pages, visuals, taxonomy assignments, manifest entries, and
     link checks for dense foundation sections: `probability-statistics`,
     `numerical-linear-algebra`, `geometry-3d`, `state-estimation`, and
     `systems-engineering`.

4. Existing overview and entry-point phase:
   - revise `machine-learning/overview.md` to the shared contract;
   - update `README.md` and `INDEX.md` after final overview titles and slugs
     are stable.

Each phase should end with `npm test`, `npm run links:check`, and
`npm run docs:build`, unless the phase is intentionally a red/green test phase.

## Testing

Run:

```text
npm test
npm run links:check
npm run docs:build
```

`npm run verify` is useful, but it does not currently run `links:check`, so the
explicit link checker should be part of completion.

## Acceptance Criteria

- Exactly 11 new `10-knowledge-base/*/overview.md` pages exist, excluding the
  existing `machine-learning/overview.md`.
- There are exactly 12 `10-knowledge-base/*/overview.md` pages total: the 11 new
  pages plus the revised machine-learning overview.
- Every public `10-knowledge-base` folder except `_assets` has one overview.
- All 12 public overview pages use the required H2 headings in order.
- `machine-learning/overview.md` conforms to the same reader-facing contract and
  broader autonomy framing unless this spec is updated with an explicit
  exception.
- Each overview opens with a clear explanation of why the foundation exists,
  what it studies from first principles, and what autonomy problems it solves.
- Every overview includes the shared problem-class coverage table.
- Every overview includes 3-5 concrete review questions and one diagnostic
  micro-case.
- Applied links are curated, reasoned, and not broad dumps of related pages.
- Boundary sections clearly distinguish neighboring foundations.
- `overview.md` appears first in each knowledge-base folder sidebar.
- Folder sidebar groups link to their overview pages.
- Every new overview satisfies the curated visual and taxonomy tests.
- The visual reassessment manifest note is updated so the deterministic visual
  generator's live-inventory validation remains true.
- `README.md` and `INDEX.md` point readers to overview entry points.
- `npm test`, `npm run links:check`, and `npm run docs:build` pass.
- The implementation is split into phased plans; no single implementation plan
  attempts all overview content, visual, navigation, test, README/INDEX, and
  machine-learning changes at once.
