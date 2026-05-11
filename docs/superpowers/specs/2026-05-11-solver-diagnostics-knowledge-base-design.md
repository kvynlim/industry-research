# Solver Diagnostics Knowledge Base Design

Date: 2026-05-11

## Context

The repository already has first-principles coverage for nonlinear optimization
and numerical linear algebra under:

- `10-knowledge-base/optimization/`
- `10-knowledge-base/numerical-linear-algebra/`

Those sections already include pages for nonlinear least squares, Jacobians,
manifold linearization, Gauss-Newton, Levenberg-Marquardt, dogleg, trust
regions, line search, solver-library patterns, Cholesky, LDLT, QR, SVD, rank,
conditioning, sparsity, ordering, Schur complements, marginalization, PCG,
square-root information, and covariance recovery.

The gap is not topic existence. The gap is a learner-facing and reviewer-facing
diagnostic layer. A reader should be able to answer:

- What does this concept mean in calibration, SLAM, mapping, planning, or solver
  review?
- What object is it in the math or implementation?
- What effect does it have on the solve?
- What problem does it solve?
- What problem does it not solve?
- What failure symptoms appear when it is wrong?
- Which diagnostic artifact should be inspected?

The motivating sentence is:

```text
A calibration, map, or plan can fail because the residual is wrong, the
Jacobian is inconsistent, the scale is poor, the damping strategy is brittle,
or the solver is operating outside its local model.
```

The design must explain this sentence directly while preserving the existing
canonical first-principles pages.

## Goal

Add a diagnostic and concept-discovery layer over the existing optimization and
numerical linear algebra foundations.

The result should give readers three depths:

1. A bridge page that explains how solver failures propagate through the whole
   stack.
2. A small number of workflow-owned concept hub pages for topics that are
   currently spread across multiple foundations.
3. Glossary entries and concept-card sections that make specific terms easy to
   find without creating one page per noun.

## Non-Goals

- Do not add one standalone page for every term.
- Do not duplicate derivations already owned by canonical first-principles
  pages.
- Do not create a new top-level `concepts/`, `bridges/`, or `concept-cards/`
  folder.
- Do not move or rename existing foundation pages.
- Do not overload `GLOSSARY.md` with long explanations. It should remain a
  lookup surface with links to canonical pages.
- Do not treat damping as a prior, Schur elimination for solving as identical to
  marginalization, or covariance as global uncertainty outside the local
  tangent-space assumptions.

## Target Pages

The initial implementation should create exactly four new knowledge-base pages:

```text
10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md
10-knowledge-base/optimization/objective-residual-design-and-audit.md
10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md
10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md
```

The first three pages provide the optimization-side diagnostic path. The fourth
page is required because the requested backend topics - rank, conditioning,
sparsity, factorization, Schur complements, marginalization, covariance
recovery, and PCG - are too large to treat as side notes inside the nonlinear
solver bridge.

Do not create this page in the initial implementation:

```text
10-knowledge-base/numerical-linear-algebra/pcg-and-preconditioning.md
```

PCG and preconditioning should be strengthened in
`schur-complement-marginalization-pcg.md` and routed through the sparse backend
crosswalk. A standalone PCG page can be proposed in a later design only if the
strengthened canonical page becomes too large or too implementation-specific.

## Architecture

### Layer 1: Bridge Pages

Create:

```text
10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md
```

H1:

```text
# Nonlinear Solver Diagnostics Crosswalk
```

This is the primary bridge page. It owns the end-to-end diagnostic route:

```text
measurement model
-> residual
-> whitening and scale
-> Jacobian and local coordinates
-> linearization
-> linear solve
-> damping, trust region, or line search
-> manifold update
-> convergence, rank, and covariance diagnosis
```

The page should be a routing and diagnosis page, not another derivation page.
It should include:

- An ownership map across probability, geometry, optimization, numerical linear
  algebra, and state estimation.
- A symptom-to-cause triage table.
- A solver selection decision matrix.
- A direct explanation of the motivating failure sentence.
- Repeated autonomy examples from calibration, mapping or SLAM, and planning or
  control.
- Disambiguation boxes for concepts readers commonly confuse.

Create:

```text
10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md
```

H1:

```text
# Sparse Estimation Backend Crosswalk
```

This page owns backend design and debugging choices:

- rank and nullspaces;
- conditioning and scaling;
- sparsity, ordering, and fill-in;
- factorization choice;
- Schur complement use for solving;
- marginalization prior construction;
- square-root information forms;
- covariance recovery;
- PCG and preconditioning.

This page is required in the initial implementation. It should live in
`numerical-linear-algebra`, not in a new folder.

### Ownership Map Contract

The primary bridge page must include an ownership map with these boundaries:

| Domain | Owns | Does Not Own | Diagnostic Artifacts |
|---|---|---|---|
| Probability/statistics | Likelihoods, noise models, measurement covariance, information, whitening, Mahalanobis and chi-square meaning, robust-loss statistical interpretation. | Solver damping, factorization mechanics, estimator lifecycle. | Raw and whitened residual distributions, NIS/NEES, covariance validation, gate statistics. |
| Geometry | Frames, measurement geometry, SE(3)/SO(3), Exp/Log, adjoints, local coordinates, tangent conventions. | Noise validity, nonlinear method choice, backend solve. | Frame tests, adjoint tests, tangent finite differences, projection or registration sanity cases. |
| Optimization | Objective assembly, residual blocks as functions, Jacobian consistency, linearization loop, GN/LM/dogleg, trust-region, line-search, convergence. | Raw probability semantics, low-level factorization, estimator integrity policy. | Cost history, gradient and step norms, gain ratio, damping or radius, rejected steps. |
| Numerical linear algebra | `J`/`H` structure, rank, conditioning, sparsity, ordering, factorization, Schur algebra, PCG, covariance recovery mechanics. | Physical observability claims, association, estimator lifecycle. | Spectra, pivots, condition estimates, fill reports, factor failures, PCG residuals. |
| State estimation | State definition, process and measurement lifecycle, association, smoothing/windowing, marginalization policy, gauge, observability, consistency, integrity. | Raw probability semantics, low-level linear solve details. | Expected gauge dimension, FEJ/nullspace tests, prior audits, NIS/NEES, replay checks. |

The bridge should explicitly say that observability is not only matrix rank.
Rank and nullspaces expose local numerical structure, while state estimation
owns the interpretation of those modes as estimator consistency, gauge policy,
and integrity evidence.

### Required Disambiguation Boxes

The bridge and concept hub pages must include short disambiguation boxes for:

- Damping versus prior versus gauge fix.
- Schur complement for solving versus marginalization prior construction.
- Measurement covariance versus robust weight versus posterior or marginal
  covariance.
- Rank deficiency and nullspace versus poor conditioning and weak modes.
- Tangent local coordinates versus ambient parameter storage.
- Solver method versus solver library.
- Marginal covariance versus conditional covariance versus inverse diagonal
  information block.

### Layer 2: New Concept Hub Pages

Create:

```text
10-knowledge-base/optimization/objective-residual-design-and-audit.md
```

H1:

```text
# Objective and Residual Design Audit
```

This page owns the workflow of deciding whether the objective represents the
right problem. It should cover:

- objective construction;
- measurement models;
- raw residuals versus whitened residuals;
- units and scale;
- covariance, information, and weights;
- robust loss order relative to whitening;
- priors and gauge anchoring as modeling choices;
- residual-family diagnostics;
- small synthetic tests for residual blocks.

For each residual family, the page should require an audit checklist:

```text
raw residual definition
sign convention
frame convention
units
dimension
covariance source
whitening matrix
robust loss order
expected whitened residual distribution
synthetic zero-residual test
sign perturbation test
tangent finite-difference Jacobian test
per-factor residual histogram
```

The page must distinguish measurement covariance, information and square-root
information, robust weights, posterior covariance, marginal covariance, and
gauge-dependent covariance. These objects can interact in one solve, but they
answer different questions.

Create:

```text
10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md
```

H1:

```text
# Solver Selection and Convergence Diagnosis
```

This page owns the workflow of selecting and diagnosing a nonlinear solver
configuration. It should cover:

- nonlinear method choice: Gauss-Newton, LM, dogleg, trust-region, line-search;
- linear backend choice: Cholesky, QR, SVD, Schur, PCG;
- solver library choice as a separate decision from method choice;
- convergence criteria;
- step acceptance;
- damping policy behavior;
- false convergence;
- rejected-step patterns;
- telemetry expected in solver summaries;
- when to change residual design, initialization, nonlinear method, linear
  backend, ordering, damping, or covariance strategy.

The page must state the trial-state lifecycle explicitly: a nonlinear iteration
forms a tangent step, retracts to a trial state, evaluates actual cost at that
trial state, compares actual against predicted reduction, and only then accepts
or rejects the update. Rejected steps leave the committed state unchanged while
damping, trust-region radius, or line-search length changes.

The solver selection matrix should include rows for problem condition, expected
symptoms, nonlinear method, linear backend, avoid-when guidance, and telemetry
that confirms the choice.

Deferred out-of-scope page:

```text
10-knowledge-base/numerical-linear-algebra/pcg-and-preconditioning.md
```

Do not add this page in the initial implementation. PCG diagnostics belong in
`schur-complement-marginalization-pcg.md` and the required sparse backend
crosswalk for this pass.

### Layer 3: Strengthen Canonical Pages

Existing canonical pages should remain the home for detailed derivations and
technical depth. Strengthen them with explicit concept-card sections and stable
anchors instead of splitting every term into its own file.

Required strengthening targets:

| Existing Page | Concepts To Strengthen |
|---|---|
| `optimization/nonlinear-least-squares-first-principles.md` | residuals, whitening, scale, linearization, normal equations |
| `optimization/jacobians-autodiff-manifold-linearization.md` | Jacobian consistency, finite-difference checks, perturbation conventions, tangent coordinates, manifold updates |
| `optimization/gauss-newton-levenberg-marquardt-dogleg.md` | damping, LM behavior, dogleg behavior, false convergence |
| `optimization/trust-region-line-search-globalization.md` | local model validity, step acceptance, gain ratio, line-search step length |
| `optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md` | solver-library choice versus method choice |
| `numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md` | rank, nullspaces, weak modes, conditioning, observability |
| `numerical-linear-algebra/qr-svd-rank-revealing-solvers.md` | rank diagnostics, singular vectors, pivoting, rank thresholds |
| `numerical-linear-algebra/cholesky-ldlt-normal-equations.md` | normal-equation risks, positive definiteness, factorization failure |
| `numerical-linear-algebra/sparse-matrices-fill-in-ordering.md` | sparsity, ordering, fill-in, symbolic versus numeric phases |
| `numerical-linear-algebra/schur-complement-marginalization-pcg.md` | Schur solve, marginalization, stale linearization, PCG behavior |
| `numerical-linear-algebra/square-root-information-and-covariance-recovery.md` | square-root forms, covariance recovery, tangent-space covariance |

All Jacobian checks on manifold variables must perturb through the same
`Plus`, `boxplus`, or `retract` operation used by the solver. The strengthened
Jacobian page must state the left/right perturbation convention, tangent
coordinate order, quaternion storage order, and whether the checked derivative
is for the raw residual or the whitened residual.

The sparse backend crosswalk and strengthened numerical-linear-algebra pages
must include a backend decision matrix covering Cholesky, LDLT, QR, SVD, Schur,
and PCG by:

- positive-definite or indefinite assumptions;
- rank robustness;
- sparsity and fill behavior;
- covariance-recovery implications;
- runtime and memory behavior;
- diagnostic value.

PCG coverage must state the SPD requirement, preconditioner used,
unpreconditioned and preconditioned residual norms, iteration count, stopping
tolerance, coupling to nonlinear progress, symmetry test for matrix-vector
products, stagnation symptoms, and comparison against explicit Schur or a direct
solve on a small representative case.

## Concept Card Contract

Every new bridge or concept hub page should use concept cards. Existing pages
should receive concept cards for the concepts they own.

Use this structure:

```markdown
### <Concept>

| Field | Explanation |
|---|---|
| What it means here | Definition in autonomy optimization, calibration, SLAM, mapping, planning, or solver review. |
| Math object | Residual vector, Jacobian block, Hessian, damping term, covariance block, nullspace vector, ordering, factor, or solver state. |
| Effect on the solve | How it changes a step, acceptance decision, observability, runtime, memory, covariance, or output validity. |
| What it solves | The problem this concept is meant to address. |
| What it does not solve | The common overclaim or misuse. |
| Minimal example | One concrete calibration, SLAM/mapping, planning/control, or solver-log example showing the concept in use or failure. |
| Failure symptoms | Two or three logs, plots, artifacts, or behaviors that appear when the concept is wrong. |
| Diagnostic artifact | The concrete thing to inspect: finite differences, residual histogram, gain ratio, eigenvectors, condition estimate, fill report, PCG residual, covariance block, etc. |
| Normal vs abnormal artifact | What the diagnostic artifact looks like when healthy and when suspicious. |
| First debugging move | The first concrete check a reviewer should perform. |
| Do not confuse with | A nearby concept that is often mixed up. |
| Read next | Canonical page links. |
```

Concept cards should be concise. The deeper derivation should remain in the
owning page body.

## Glossary Strategy

Update root `GLOSSARY.md` with a section:

```text
### Optimization and Numerical Linear Algebra
```

The glossary entries should be one sentence each plus a canonical page link.
The glossary should not become the detailed concept-card surface.

Initial glossary terms:

- objective;
- residual;
- whitened residual;
- Jacobian;
- linearization;
- manifold update;
- local coordinates;
- normal equations;
- damping;
- trust-region ratio;
- line-search step length;
- convergence criterion;
- rank deficiency;
- nullspace;
- gauge freedom;
- condition number;
- sparsity;
- fill-in;
- ordering;
- Cholesky;
- LDLT;
- QR;
- SVD;
- Schur complement;
- marginalization prior;
- square-root information;
- marginal covariance;
- covariance recovery;
- PCG;
- preconditioner.

Each entry should link to the most specific stable heading available. If an
entry needs an anchor that does not yet exist, add a clear heading to the
owning page during implementation.

## Symptom-First Diagnostic Contract

The primary bridge page must include a symptom-to-diagnostic table with these
columns:

| Column | Meaning |
|---|---|
| Symptom | What the engineer sees first in logs, maps, calibration output, covariance, or planner behavior. |
| Likely Layer | Residual, scale, Jacobian, local model, nonlinear policy, linear backend, marginalization, covariance, or estimator interpretation. |
| Common Causes | The most likely implementation or modeling causes. |
| First Artifact To Inspect | The concrete diagnostic output to open first. |
| Disambiguating Check | The fastest check that separates two similar causes. |
| Likely Next Concept Card | The concept card that should be read next. |
| Canonical Derivation Link | The first-principles page that owns the deeper math. |

The table should include at least these symptom families:

- Cost decreases but the calibration, map, or plan gets worse.
- Many LM, dogleg, trust-region, or line-search steps are rejected.
- Damping grows large and the step norm becomes tiny.
- A sensor or residual family dominates the objective.
- Cholesky or LDLT fails.
- Rank appears full but covariance is nonsensical.
- Covariance looks overconfident in a weakly observed mode.
- Runtime or memory explodes after graph growth.
- PCG stagnates or reaches the iteration limit.
- A trajectory is smooth but physically unsafe or behaviorally wrong.

The bridge page must also include reading paths:

- If you have solver logs, start with convergence, damping, gain ratio, rejected
  steps, and gradient/step norms.
- If the output is physically wrong despite low cost, start with residual
  design, whitening, and Jacobian consistency.
- If the linear solve fails or covariance is suspicious, start with rank,
  conditioning, factorization, nullspaces, and covariance recovery.
- If runtime or memory explodes, start with sparsity, ordering, fill-in, Schur,
  and PCG.
- If the estimator appears inconsistent, start with gauge policy, observability,
  marginalization, NIS/NEES, and state-estimation integrity pages.

## Bridge Page Failure Spine

The primary bridge page should include a table that explains the motivating
sentence:

| Failure Clause | Plain Meaning | Effect | Diagnostic |
|---|---|---|---|
| Residual is wrong | The objective encodes the wrong physical or probabilistic error. | The solver optimizes the wrong problem and may report low cost. | Inspect residual definitions, signs, units, and synthetic residual tests. |
| Jacobian is inconsistent | The derivative does not match the residual, perturbation convention, or manifold update. | Predicted reduction differs from actual reduction; steps are rejected or biased. | Compare analytic Jacobians with autodiff or finite differences in local coordinates. |
| Scale is poor | Residuals, covariances, or variables are not comparable. | One sensor, factor, or state dimension dominates the solve. | Inspect whitened residual histograms, per-factor chi-square, condition estimates, and column scaling. |
| Damping is brittle | Step control only works in a narrow operating regime. | The solver diverges, crawls, or falsely converges. | Inspect damping values, accepted/rejected step counts, gain ratio, and gradient norm. |
| Outside local model | The linearized model is invalid at the current state. | The solver follows a bad approximation or falls into the wrong basin. | Inspect initialization, association changes, actual versus predicted reduction, and local residual smoothness. |

Use the same three recurring examples across bridge sections:

- Calibration: camera-LiDAR yaw or time offset gets absorbed into extrinsics.
- Mapping or SLAM: false loop closure with overconfident covariance warps a map.
- Planning or control: cost scaling makes a smooth but unsafe trajectory look
  optimal.

Each recurring example must be worked end-to-end at least once:

```text
initial symptom
-> wrong object or wrong layer
-> diagnostic artifact
-> interpretation
-> what to change
-> what not to conclude
-> read next
```

## Cross-Linking

Update targeted links from:

- `10-knowledge-base/optimization/overview.md`
- `10-knowledge-base/numerical-linear-algebra/overview.md`
- `00-start-here/reading-guide.md`
- `README.md`
- `INDEX.md`
- relevant existing optimization pages
- relevant existing numerical linear algebra pages
- high-value applied SLAM pages that already discuss solver behavior, such as
  factor-graph, GraphSLAM, bundle adjustment, VINS, and calibration pages

Links should help readers move from symptom to concept to canonical derivation.
Do not force links into unrelated method pages.

No `.vitepress/navigation.mjs` change is expected. Sidebar navigation is
directory-driven and will pick up the new Markdown files automatically.
Prominence should come from `overview.md` reading paths, `README.md`, `INDEX.md`,
`00-start-here/reading-guide.md`, and targeted related-doc links.

## Visual Contract

Every new `10-knowledge-base` Markdown page must follow the existing curated
visual contract:

- exactly one `kb-visual` block after the H1;
- one SVG asset under `10-knowledge-base/_assets/visuals/`;
- one explicit taxonomy assignment in `tools/knowledge-base/visual-taxonomy.mjs`;
- renderer support in `tools/knowledge-base/curated-visuals.mjs` if the diagram
  type is new;
- matching SVG `data-diagram-kind`;
- SVG `<desc>` content that matches the visual caption's teaching intent;
- no generic, placeholder, or auto-generated wording.

Use existing diagram kinds unless a new diagram kind is clearly justified:

| Page | Diagram Kind |
|---|---|
| `optimization/nonlinear-solver-diagnostics-crosswalk.md` | `solver-loop` |
| `optimization/objective-residual-design-and-audit.md` | `objective-landscape` |
| `optimization/solver-selection-and-convergence-diagnosis.md` | `optimization-step-geometry` |
| `numerical-linear-algebra/sparse-estimation-backend-crosswalk.md` | `matrix-structure` |

Recommended visuals:

- `optimization-nonlinear-solver-diagnostics-crosswalk.svg`: pipeline and
  failure-layer map from measurement model to diagnostic artifact.
- `numerical-linear-algebra-sparse-estimation-backend-crosswalk.svg`: sparse
  backend decision map from Jacobian structure to factorization, Schur,
  marginalization, covariance, and PCG.
- `optimization-objective-residual-design-and-audit.svg`: residual audit flow
  from measurement model to whitened residual and diagnostics.
- `optimization-solver-selection-and-convergence-diagnosis.svg`: solver choice
  matrix and convergence symptom routing.

Update the visual reassessment manifest:

```text
docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md
```

The live knowledge-base Markdown count should move from 121 to 125 after the
four required pages are added, and the file-by-file reassessment should include
one replacement-visual description for each new page.

## Data Flow

Implementation should follow this order:

1. Add the four required new Markdown pages with visual blocks.
2. Add or generate the required SVG assets and taxonomy mappings.
3. Update the visual reassessment manifest and live KB counts from 121 to 125.
4. Add concept-card sections and stable anchors to existing canonical pages.
5. Update `GLOSSARY.md` with the technical glossary section.
6. Update overviews, `README.md`, reading guide, `INDEX.md`, and targeted
   related-doc links.
7. Run tests, link checks, and docs build.

## Error Handling

Expected risks and responses:

- If the scope grows too large, keep the four target pages as the required
  deliverable and reduce only optional cross-links or later deepening. Do not
  drop the sparse backend crosswalk from the initial scope.
- If a new page duplicates an existing derivation, convert the duplicate into a
  concept-card summary and link to the canonical page.
- If visual taxonomy tests fail, add or correct the visual assignment and SVG
  asset, then update the visual reassessment manifest if a page was added.
- If link checks fail, correct relative links and anchor names.
- If a concept has no stable anchor, add a heading to the owning page rather
  than linking to a broad page top.

## Testing

Run:

```text
npm test
npm run priority:check
npm run links:check
npm run docs:build
```

Before claiming implementation completion, run:

```text
npm run verify
npm run links:check
```

## Review Criteria

The implementation is acceptable when:

- The main bridge page directly explains the motivating failure sentence.
- The bridge page includes both cause-first and symptom-first diagnostic
  tables.
- At least three recurring examples are worked through the diagnostic route.
- The architecture adds bridge and concept-hub depth without one-page-per-term
  sprawl.
- Every named concept has a glossary link and at least one concept card,
  strengthened canonical section, or new hub section. A glossary link alone is
  not sufficient for major concepts such as PCG, rank deficiency, covariance
  recovery, Schur complement, or marginalization.
- Major concept cards include minimal examples, normal/abnormal diagnostic
  artifact guidance, and first debugging moves.
- The bridge page provides explicit reading paths for learners starting from
  symptoms, logs, bad outputs, backend failures, or estimator inconsistency.
- The required sparse backend crosswalk exists and covers rank, conditioning,
  sparsity, factorization, Schur, marginalization, covariance recovery, and PCG.
- Existing canonical pages remain the derivation homes.
- New pages have visual blocks, SVG assets, taxonomy assignments, and visual
  reassessment manifest entries.
- Overviews, `README.md`, reading guide, and `INDEX.md` expose the new
  diagnostic path.
- Links from applied SLAM or calibration pages are targeted and useful.
- Tests, priority check, link check, docs build, and final verify pass.
