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

Keep `10-knowledge-base/machine-learning/overview.md`, revising it only where
needed for consistency with the shared overview contract, especially autonomy
problem coverage and boundaries with neighboring sections.

## Overview Page Contract

Each overview is a normal knowledge-base page. It must have:

- a specific H1, usually `# <Section> Foundations for Autonomy`,
- exactly one curated `kb-visual` block immediately after the H1,
- one SVG under `10-knowledge-base/_assets/visuals/`,
- one explicit taxonomy assignment in `tools/knowledge-base/visual-taxonomy.mjs`,
- valid local Markdown links,
- durable source references where the overview cites external foundations.

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

This is a required heading shape, but it should not become boilerplate. For
sparse folders such as `sensors` or `robotics`, sections can be brief and the
`Pages In This Section` inventory can be compact. For dense folders such as
`state-estimation`, `geometry-3d`, `machine-learning`,
`probability-statistics`, and `numerical-linear-algebra`, the sections should
carry more teaching detail.

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

## Problem-Class Coverage

Every overview should include the same compact coverage table so the sections
are comparable across the autonomy stack:

```markdown
| Problem Class | Role Of This Foundation | Representative Applied Pages |
|---|---|---|
| Perception and scene understanding | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
| Localization, SLAM, and state estimation | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
| Mapping and spatial memory | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
| Prediction and world modeling | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
| Planning and decision making | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
| Control and actuation | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
| Safety, validation, and assurance | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
| Runtime systems and operations | primary/supporting/not central plus the section-specific role | 0-2 curated links with reasons |
```

Rows can mark the role as `primary`, `supporting`, or `not central`, but rows
should not be omitted casually. The point is to make it clear how each
foundation relates to the same autonomy problem classes, even when the answer is
"supporting" or "not central."

Representative applied links should be curated. Each overview should usually
link to 3-5 applied pages outside `10-knowledge-base`, with a short reason for
each link. A link qualifies only if the reader would use this foundation to
review or debug that applied page.

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
  rules, globalization, autodiff/Jacobians, and solver selection. It should
  reference probability for residual meaning and numerical linear algebra for
  the linear solve.
- `numerical-linear-algebra` owns factorization, conditioning, rank,
  nullspaces, sparsity, Schur complements, marginalization algebra, and PCG. It
  should not become an estimator or solver-library guide.
- `state-estimation` owns time-evolving latent state, prediction/update cycles,
  smoothing, fusion architecture, association in context, out-of-sequence data,
  observability in deployed estimators, and integrity.
- `geometry-3d` owns frames, transforms, projection, Lie geometry, sensor
  geometry, calibration geometry, and registration geometry. It should not own
  persistent map semantics or estimator lifecycle.
- `mapping` owns persistent environment representation: occupancy, semantic
  layers, TSDF/ESDF/surfels, map fusion, update policy, dynamic/static
  separation, and map QA.
- `signal-processing` owns raw-to-feature transforms: sampling, filtering, FFT,
  radar range-Doppler-angle processing, CFAR, windowing, aliasing, and clutter
  suppression.
- `sensors` owns measurement physics, modality error budgets, observability
  limits, degradation modes, and likelihood contracts emitted to the stack.
- `controls` owns turning plans and beliefs into dynamically feasible commands:
  tracking, MPC, iLQR, constraints, stability, vehicle dynamics, actuator
  limits, and safety filters.
- `robotics` owns robot/task vocabulary, autonomy problem decomposition,
  planning layers, map formats such as Lanelet2, embodiment assumptions, and
  behavior/motion planning framing.
- `systems-engineering` owns cross-cutting integration contracts: timing,
  latency, validation metrics, release gates, architecture tradeoffs,
  observability, operational error budgets, and evidence flow.
- `machine-learning` owns learned representations, objectives, architectures,
  model calibration/leakage, world-model learning, and deployment failure modes.

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

## Navigation Design

Adding `overview.md` files is not enough by itself, because the current
VitePress sidebar generator treats `overview.md` as an ordinary alphabetized
file. The implementation should update navigation behavior so every
`overview.md` appears first within its folder.

Preferred behavior:

- folder sidebar entries link to `/10-knowledge-base/<folder>/overview`,
- `overview.md` remains visible as the first child if VitePress displays it
  naturally.

Acceptable fallback:

- folder headings remain non-clickable,
- `overview.md` appears first as a child entry with a clear title.

Navigation tests should assert the chosen behavior.

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
caps how many pages can share one diagram kind.

If `tools/knowledge-base/curated-visuals.mjs` is used, update the reassessment
manifest note it reads so visual regeneration continues to match the live
knowledge-base inventory.

## Index And Entry-Point Updates

Update high-level entry points so readers discover the overviews:

- `README.md` should point "First-principles estimator math" and related
  reading paths to the new overview pages where appropriate.
- `INDEX.md` should add or adjust mathematical-foundation rows so primary links
  point to overview pages, with atomic pages listed as supporting links.

These should be targeted updates, not a broad rewrite.

## Data Flow

Implementation should proceed in this order:

1. Add or revise overview Markdown pages.
2. Add visual assets and visual blocks.
3. Update visual taxonomy and generator manifest if needed.
4. Update VitePress navigation ordering/link behavior.
5. Add navigation/content tests for overview coverage and ordering.
6. Update `README.md` and `INDEX.md` entry points.
7. Run tests and docs build.

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
- Every public `10-knowledge-base` folder except `_assets` has one overview.
- Each overview opens with a clear explanation of why the foundation exists,
  what it studies from first principles, and what autonomy problems it solves.
- Every overview includes the shared problem-class coverage table.
- Applied links are curated, reasoned, and not broad dumps of related pages.
- Boundary sections clearly distinguish neighboring foundations.
- `overview.md` appears first in each knowledge-base folder sidebar.
- If folder heading links are adopted, folder headings link to their overview.
- Every new overview satisfies the curated visual and taxonomy tests.
- `README.md` and `INDEX.md` point readers to overview entry points.
- `npm test`, `npm run links:check`, and `npm run docs:build` pass.
