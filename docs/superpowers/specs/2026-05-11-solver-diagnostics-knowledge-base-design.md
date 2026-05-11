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

Create a second bridge page if the numerical-linear-algebra backend discussion
would make the first bridge page too large:

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

The second bridge page is required if the implementation cannot cover these
backend topics clearly within the optimization bridge without becoming too long.
It should live in `numerical-linear-algebra`, not in a new folder.

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

Optional later page:

```text
10-knowledge-base/numerical-linear-algebra/pcg-and-preconditioning.md
```

Only add this if PCG needs treatment beyond the existing Schur complement,
marginalization, and PCG page. It is not part of the initial required scope.

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
| Failure symptom | The log, plot, artifact, or behavior that appears when it is wrong. |
| Diagnostic artifact | The concrete thing to inspect: finite differences, residual histogram, gain ratio, eigenvectors, condition estimate, fill report, PCG residual, covariance block, etc. |
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

## Cross-Linking

Update targeted links from:

- `10-knowledge-base/optimization/overview.md`
- `10-knowledge-base/numerical-linear-algebra/overview.md`
- `00-start-here/reading-guide.md`
- `INDEX.md`
- relevant existing optimization pages
- relevant existing numerical linear algebra pages
- high-value applied SLAM pages that already discuss solver behavior, such as
  factor-graph, GraphSLAM, bundle adjustment, VINS, and calibration pages

Links should help readers move from symptom to concept to canonical derivation.
Do not force links into unrelated method pages.

## Visual Contract

Every new `10-knowledge-base` Markdown page must follow the existing curated
visual contract:

- exactly one `kb-visual` block after the H1;
- one SVG asset under `10-knowledge-base/_assets/visuals/`;
- one explicit taxonomy assignment in `tools/knowledge-base/visual-taxonomy.mjs`;
- renderer support in `tools/knowledge-base/curated-visuals.mjs` if the diagram
  type is new.

Recommended visuals:

- `optimization-nonlinear-solver-diagnostics-crosswalk.svg`: pipeline and
  failure-layer map from measurement model to diagnostic artifact.
- `numerical-linear-algebra-sparse-estimation-backend-crosswalk.svg`, if the
  optional backend bridge page is created: sparse backend decision map from
  Jacobian structure to factorization, Schur, marginalization, covariance, and
  PCG.
- `optimization-objective-residual-design-and-audit.svg`: residual audit flow
  from measurement model to whitened residual and diagnostics.
- `optimization-solver-selection-and-convergence-diagnosis.svg`: solver choice
  matrix and convergence symptom routing.

## Data Flow

Implementation should follow this order:

1. Add the approved new Markdown pages with visual blocks.
2. Add or generate the required SVG assets and taxonomy mappings.
3. Add concept-card sections and stable anchors to existing canonical pages.
4. Update `GLOSSARY.md` with the technical glossary section.
5. Update overviews, reading guide, `INDEX.md`, and targeted related-doc links.
6. Run tests and docs build.

## Error Handling

Expected risks and responses:

- If the scope grows too large, keep the primary bridge page and two concept hub
  pages as the required deliverable; create the backend bridge only if the
  backend material cannot remain clear inside the primary bridge and
  strengthened numerical-linear-algebra pages.
- If a new page duplicates an existing derivation, convert the duplicate into a
  concept-card summary and link to the canonical page.
- If visual taxonomy tests fail, add or correct the visual assignment and SVG
  asset.
- If link checks fail, correct relative links and anchor names.
- If a concept has no stable anchor, add a heading to the owning page rather
  than linking to a broad page top.

## Testing

Run:

```text
npm test
npm run priority:check
npm run docs:build
```

Before claiming implementation completion, run:

```text
npm run verify
```

## Review Criteria

The implementation is acceptable when:

- The main bridge page directly explains the motivating failure sentence.
- The architecture adds bridge and concept-hub depth without one-page-per-term
  sprawl.
- Every named concept has either a glossary link, a concept card, a strengthened
  existing section, or a new hub section.
- Existing canonical pages remain the derivation homes.
- New pages have visual blocks, SVG assets, and taxonomy assignments.
- Overviews, reading guide, and `INDEX.md` expose the new diagnostic path.
- Links from applied SLAM or calibration pages are targeted and useful.
- Tests, priority check, docs build, and final verify pass.
