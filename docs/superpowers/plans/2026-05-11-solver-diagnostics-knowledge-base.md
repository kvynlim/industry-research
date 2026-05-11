# Solver Diagnostics Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a solver-diagnostics knowledge-base layer that explains optimization and numerical-linear-algebra concepts by meaning, effect, failure symptom, and diagnostic artifact.

**Architecture:** Add four required knowledge-base pages: one nonlinear solver crosswalk, two optimization concept hubs, and one sparse backend crosswalk. Strengthen existing canonical pages with concept cards and stable anchors, then expose the path through glossary, overviews, README, reading guide, INDEX, and targeted applied backlinks.

**Tech Stack:** Markdown, deterministic SVG generation through `tools/knowledge-base/curated-visuals.mjs`, visual taxonomy in `tools/knowledge-base/visual-taxonomy.mjs`, Node.js `node:test`, VitePress.

---

## File Structure

- Modify: `tests/content-smoke.test.mjs`
  - Adds regression coverage for the four new pages, concept-card fields, glossary terms, and entry-point links.
- Create: `10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md`
  - Owns the end-to-end solver failure route from measurement model to diagnostics.
- Create: `10-knowledge-base/optimization/objective-residual-design-and-audit.md`
  - Owns objective construction, residual meaning, whitening, scale, residual audits, and residual-family diagnostics.
- Create: `10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md`
  - Owns solver choice, step acceptance, damping behavior, convergence diagnosis, and solver telemetry.
- Create: `10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md`
  - Owns sparse backend debugging for rank, conditioning, factorization, Schur, marginalization, covariance recovery, and PCG.
- Modify: `tools/knowledge-base/visual-taxonomy.mjs`
  - Assigns the four new pages to existing diagram kinds.
- Modify: `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`
  - Updates live KB counts from 121 to 125 and adds manifest entries for the four new pages.
- Create generated SVGs:
  - `10-knowledge-base/_assets/visuals/optimization-nonlinear-solver-diagnostics-crosswalk.svg`
  - `10-knowledge-base/_assets/visuals/optimization-objective-residual-design-and-audit.svg`
  - `10-knowledge-base/_assets/visuals/optimization-solver-selection-and-convergence-diagnosis.svg`
  - `10-knowledge-base/_assets/visuals/numerical-linear-algebra-sparse-estimation-backend-crosswalk.svg`
- Modify canonical optimization pages:
  - `10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md`
  - `10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md`
  - `10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md`
  - `10-knowledge-base/optimization/trust-region-line-search-globalization.md`
  - `10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md`
- Modify canonical numerical-linear-algebra pages:
  - `10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md`
  - `10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md`
  - `10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md`
  - `10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md`
  - `10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md`
  - `10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md`
- Modify entry points:
  - `GLOSSARY.md`
  - `README.md`
  - `INDEX.md`
  - `00-start-here/reading-guide.md`
  - `10-knowledge-base/optimization/overview.md`
  - `10-knowledge-base/numerical-linear-algebra/overview.md`
- Modify targeted applied pages:
  - `30-autonomy-stack/localization-mapping/slam-methods/factor-graph-isam2-gtsam.md`
  - `30-autonomy-stack/localization-mapping/slam-methods/graphslam-pose-graph-optimization.md`
  - `30-autonomy-stack/localization-mapping/slam-methods/bundle-adjustment-slam.md`
  - `30-autonomy-stack/localization-mapping/slam-methods/vins-mono-vins-fusion.md`
  - `20-av-platform/sensors/calibration-tracking.md`

---

### Task 1: Add Failing Coverage For The Solver Diagnostics Scope

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Add page and entry-point constants**

Add these constants after `requiredDocs`:

```js
const solverDiagnosticPages = [
  '10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md',
  '10-knowledge-base/optimization/objective-residual-design-and-audit.md',
  '10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md',
  '10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md'
]

const solverDiagnosticEntryPoints = [
  'README.md',
  'INDEX.md',
  '00-start-here/reading-guide.md',
  '10-knowledge-base/optimization/overview.md',
  '10-knowledge-base/numerical-linear-algebra/overview.md'
]
```

- [ ] **Step 2: Extend required docs**

Append the four `solverDiagnosticPages` entries to `requiredDocs` after the robust-losses entry:

```js
  '10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md',
  '10-knowledge-base/optimization/objective-residual-design-and-audit.md',
  '10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md',
  '10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md',
```

- [ ] **Step 3: Add content contract test**

Add this test after the robust-losses test:

```js
test('solver diagnostics pages cover required concepts and diagnostic contracts', () => {
  const requiredTerms = {
    '10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md': [
      'A calibration, map, or plan can fail',
      'Ownership Map',
      'Symptom-First Diagnostic',
      'Damping versus prior versus gauge fix',
      'initial symptom',
      'what not to conclude'
    ],
    '10-knowledge-base/optimization/objective-residual-design-and-audit.md': [
      'Objective and Residual Design Audit',
      'raw residual definition',
      'whitening matrix',
      'expected whitened residual distribution',
      'synthetic zero-residual test',
      'Measurement covariance versus robust weight'
    ],
    '10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md': [
      'Solver Selection and Convergence Diagnosis',
      'trial state',
      'actual against predicted reduction',
      'Rejected steps leave the committed state unchanged',
      'false convergence',
      'solver library choice'
    ],
    '10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md': [
      'Sparse Estimation Backend Crosswalk',
      'rank and nullspaces',
      'sparsity, ordering, and fill-in',
      'Schur complement for solving',
      'marginalization prior',
      'PCG stagnates'
    ]
  }

  const requiredConceptCardFields = [
    'What it means here',
    'Math object',
    'Effect on the solve',
    'What it solves',
    'What it does not solve',
    'Minimal example',
    'Failure symptoms',
    'Diagnostic artifact',
    'Normal vs abnormal artifact',
    'First debugging move',
    'Do not confuse with',
    'Read next'
  ]

  for (const [relPath, terms] of Object.entries(requiredTerms)) {
    const markdown = fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
    for (const term of terms) {
      assert.ok(markdown.includes(term), `${relPath} should include ${term}`)
    }
    for (const field of requiredConceptCardFields) {
      assert.ok(markdown.includes(field), `${relPath} should include concept-card field ${field}`)
    }
  }
})
```

- [ ] **Step 4: Add entry-point and glossary test**

Add this test after the content contract test:

```js
test('solver diagnostics path is discoverable from entry points and glossary', () => {
  for (const relPath of solverDiagnosticEntryPoints) {
    const markdown = fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
    assert.match(
      markdown,
      /nonlinear-solver-diagnostics-crosswalk\.md/,
      `${relPath} should link to the nonlinear solver diagnostics crosswalk`
    )
  }

  const glossary = fs.readFileSync(path.join(repoRoot, 'GLOSSARY.md'), 'utf8')
  assert.ok(glossary.includes('### Optimization and Numerical Linear Algebra'))

  for (const term of [
    'Residual',
    'Whitened residual',
    'Jacobian',
    'Manifold update',
    'Rank deficiency',
    'Schur complement',
    'Marginalization prior',
    'Covariance recovery',
    'PCG'
  ]) {
    assert.match(glossary, new RegExp(`\\*\\*${term}\\*\\*`), `GLOSSARY.md should define ${term}`)
  }
})
```

- [ ] **Step 5: Run the focused smoke test and verify failure**

Run:

```powershell
node --test tests/content-smoke.test.mjs
```

Expected: FAIL with `ENOENT` for `10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md`.

- [ ] **Step 6: Commit the failing coverage**

Run:

```powershell
git add -- tests/content-smoke.test.mjs
git commit -m "test: cover solver diagnostics knowledge base"
```

---

### Task 2: Create The Four New Diagnostic Pages And Visual Assets

**Files:**
- Create: `10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md`
- Create: `10-knowledge-base/optimization/objective-residual-design-and-audit.md`
- Create: `10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md`
- Create: `10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md`
- Modify: `tools/knowledge-base/visual-taxonomy.mjs`
- Modify: `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`
- Create generated SVG files under `10-knowledge-base/_assets/visuals/`

- [ ] **Step 1: Create `nonlinear-solver-diagnostics-crosswalk.md`**

Create `10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md` with:

```markdown
# Nonlinear Solver Diagnostics Crosswalk

<!-- kb-visual:start -->
![Nonlinear Solver Diagnostics Crosswalk curated visual](../_assets/visuals/optimization-nonlinear-solver-diagnostics-crosswalk.svg)

*Visual: pipeline and failure-layer map from measurement model to diagnostic artifact.*
<!-- kb-visual:end -->

## Related docs

- [Objective and Residual Design Audit](objective-residual-design-and-audit.md)
- [Solver Selection and Convergence Diagnosis](solver-selection-and-convergence-diagnosis.md)
- [Sparse Estimation Backend Crosswalk](../numerical-linear-algebra/sparse-estimation-backend-crosswalk.md)
- [Nonlinear Least Squares from First Principles](nonlinear-least-squares-first-principles.md)
- [Jacobians, Autodiff, and Manifold Linearization](jacobians-autodiff-manifold-linearization.md)
- [Eigenvalues, Hessian Conditioning, and Observability](../numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md)

## Why this page exists

Use the motivating sentence verbatim and explain that a low final cost is not evidence that the solved artifact is valid. State that the page routes from symptom to layer to diagnostic artifact.

## Failure spine

Include the five-row table from the spec for residual wrong, Jacobian inconsistent, scale poor, damping brittle, and outside local model.

## Diagnostic pipeline

Show this ordered path:

```text
measurement model -> residual -> whitening and scale -> Jacobian and local coordinates -> linearization -> linear solve -> trial state through retraction -> step acceptance -> committed update -> convergence, rank, and covariance diagnosis
```

## Ownership Map

Include the five-row ownership table from the spec for probability/statistics, geometry, optimization, numerical linear algebra, and state estimation.

## Symptom-First Diagnostic Table

Include the ten symptom families from the spec with columns:

`Symptom | Likely Layer | Common Causes | First Artifact To Inspect | Disambiguating Check | Likely Next Concept Card | Canonical Derivation Link`

## Worked diagnostic examples

Work these examples end-to-end:

1. Calibration: camera-LiDAR yaw or time offset gets absorbed into extrinsics.
2. Mapping or SLAM: false loop closure with overconfident covariance warps a map.
3. Planning or control: cost scaling makes a smooth but unsafe trajectory look optimal.

Each example must use this sequence:

```text
initial symptom -> wrong object or wrong layer -> diagnostic artifact -> interpretation -> what to change -> what not to conclude -> read next
```

## Reading paths

Include the five reading paths from the spec for solver logs, bad output with low cost, linear-solve/covariance failures, runtime/memory explosion, and estimator inconsistency.

## Required disambiguations

Add short boxes for all seven disambiguations in the spec.

## Concept cards

Add concept cards for: residual, whitened residual, Jacobian consistency, local model, manifold update, step acceptance, rank deficiency, covariance recovery.

## Sources

Use the sources already present in the linked canonical pages; do not introduce unsourced new claims.
```

The final page should contain finished explanatory prose under each heading and should not retain planning phrases such as "Use the motivating sentence" or "Include the five-row table." Keep the headings and required tables.

- [ ] **Step 2: Create `objective-residual-design-and-audit.md`**

Create `10-knowledge-base/optimization/objective-residual-design-and-audit.md` with:

```markdown
# Objective and Residual Design Audit

<!-- kb-visual:start -->
![Objective and Residual Design Audit curated visual](../_assets/visuals/optimization-objective-residual-design-and-audit.svg)

*Visual: residual audit flow from measurement model to whitened residual and diagnostics.*
<!-- kb-visual:end -->

## Related docs

- [Nonlinear Solver Diagnostics Crosswalk](nonlinear-solver-diagnostics-crosswalk.md)
- [Nonlinear Least Squares from First Principles](nonlinear-least-squares-first-principles.md)
- [Robust Losses and M-Estimators](../probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md)
- [Gaussian Noise, Covariance, Information, Whitening, and Uncertainty Ellipses](../probability-statistics/gaussian-noise-covariance-information.md)
- [Coordinate Frames, Projections, and SE(3)](../geometry-3d/coordinate-frames-projections-se3.md)

## What an objective is

Explain objective construction as the process of turning measurements, priors, constraints, and model assumptions into residual terms and weights.

## Residual-family audit checklist

Include the full checklist from the spec: raw residual definition, sign convention, frame convention, units, dimension, covariance source, whitening matrix, robust loss order, expected whitened residual distribution, synthetic zero-residual test, sign perturbation test, tangent finite-difference Jacobian test, per-factor residual histogram.

## Scale, covariance, information, and robust weights

Distinguish measurement covariance, information, square-root information, robust weights, posterior covariance, marginal covariance, and gauge-dependent covariance.

## Worked examples

Include camera reprojection, LiDAR point-to-plane, GNSS prior, loop closure, IMU preintegration, and planner cost examples.

## Concept cards

Add cards for: objective, residual, residual block, whitened residual, measurement covariance, information matrix, robust weight, prior, gauge anchor.

## Diagnostics

Include synthetic zero-residual tests, sign perturbation tests, finite-difference checks, whitened residual histograms, per-factor chi-square contribution, and residual-family dominance checks.

## Sources

Use existing linked canonical sources.
```

- [ ] **Step 3: Create `solver-selection-and-convergence-diagnosis.md`**

Create `10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md` with:

```markdown
# Solver Selection and Convergence Diagnosis

<!-- kb-visual:start -->
![Solver Selection and Convergence Diagnosis curated visual](../_assets/visuals/optimization-solver-selection-and-convergence-diagnosis.svg)

*Visual: solver choice matrix and convergence symptom routing.*
<!-- kb-visual:end -->

## Related docs

- [Nonlinear Solver Diagnostics Crosswalk](nonlinear-solver-diagnostics-crosswalk.md)
- [Gauss-Newton, Levenberg-Marquardt, and Dogleg](gauss-newton-levenberg-marquardt-dogleg.md)
- [Trust Region and Line Search Globalization](trust-region-line-search-globalization.md)
- [Factor-Graph Solver Patterns](factor-graph-solver-patterns-ceres-gtsam-g2o.md)
- [Sparse Estimation Backend Crosswalk](../numerical-linear-algebra/sparse-estimation-backend-crosswalk.md)

## Trial-state lifecycle

State that a nonlinear iteration forms a tangent step, retracts to a trial state, evaluates actual cost at that trial state, compares actual against predicted reduction, and only then accepts or rejects the update. State that rejected steps leave the committed state unchanged while damping, trust-region radius, or line-search length changes.

## Solver selection matrix

Add a matrix with columns: problem condition, expected symptoms, nonlinear method, linear backend, avoid when, confirming telemetry.

## Convergence diagnostics

Cover cost reduction, gradient norm, step norm, accepted/rejected steps, gain ratio, damping value, trust-region radius, line-search length, linear solve residual, and iteration budget.

## Failure modes

Cover false convergence, huge damping with tiny steps, repeated rejected steps, oscillation, local minimum, stale Jacobians, poor initialization, and robust-loss threshold mismatch.

## Concept cards

Add cards for: Gauss-Newton, Levenberg-Marquardt damping, dogleg, trust-region ratio, line-search step length, step acceptance, convergence criterion, solver library choice.

## Sources

Use existing linked canonical sources.
```

- [ ] **Step 4: Create `sparse-estimation-backend-crosswalk.md`**

Create `10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md` with:

```markdown
# Sparse Estimation Backend Crosswalk

<!-- kb-visual:start -->
![Sparse Estimation Backend Crosswalk curated visual](../_assets/visuals/numerical-linear-algebra-sparse-estimation-backend-crosswalk.svg)

*Visual: sparse backend decision map from Jacobian structure to factorization, Schur, marginalization, covariance, and PCG.*
<!-- kb-visual:end -->

## Related docs

- [Nonlinear Solver Diagnostics Crosswalk](../optimization/nonlinear-solver-diagnostics-crosswalk.md)
- [Cholesky, LDLT, and Normal Equations](cholesky-ldlt-normal-equations.md)
- [QR, SVD, and Rank-Revealing Solvers](qr-svd-rank-revealing-solvers.md)
- [Eigenvalues, Hessian Conditioning, and Observability](eigenvalues-hessian-conditioning-observability.md)
- [Sparse Matrices, Fill-In, and Ordering](sparse-matrices-fill-in-ordering.md)
- [Schur Complement, Marginalization, and PCG](schur-complement-marginalization-pcg.md)
- [Square-Root Information and Covariance Recovery](square-root-information-and-covariance-recovery.md)

## Backend decision matrix

Add a matrix covering Cholesky, LDLT, QR, SVD, Schur, and PCG by SPD assumptions, rank robustness, sparsity/fill behavior, covariance-recovery implications, runtime and memory behavior, and diagnostic value.

## Rank, nullspaces, and conditioning

Explain rank deficiency, nullspaces, weak modes, condition number, and why state estimation owns physical observability interpretation.

## Sparsity, ordering, and fill-in

Explain how graph structure becomes matrix structure and why ordering changes runtime, memory, and marginalization density.

## Schur, marginalization, covariance, and PCG

Distinguish Schur complement for solving from marginalization prior construction. Explain square-root information, covariance recovery, marginal versus conditional covariance, PCG SPD requirements, preconditioners, residual norms, stopping tolerance, and stagnation symptoms.

## Concept cards

Add cards for: rank deficiency, nullspace, gauge freedom, condition number, sparsity, fill-in, ordering, Cholesky, LDLT, QR, SVD, Schur complement, marginalization prior, square-root information, covariance recovery, PCG, preconditioner.

## Sources

Use existing linked canonical sources.
```

- [ ] **Step 5: Add taxonomy assignments**

In `tools/knowledge-base/visual-taxonomy.mjs`, add these entries after the existing optimization and numerical-linear-algebra entries:

```js
  '10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md': 'matrix-structure',
  '10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md': 'solver-loop',
  '10-knowledge-base/optimization/objective-residual-design-and-audit.md': 'objective-landscape',
  '10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md': 'optimization-step-geometry',
```

- [ ] **Step 6: Update visual reassessment manifest counts**

In `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`, replace:

```markdown
Scope: `10-knowledge-base` only. This reassessment covers all 121 live Markdown research files.
```

with:

```markdown
Scope: `10-knowledge-base` only. This reassessment covers all 125 live Markdown research files.
```

Replace:

```markdown
- Live knowledge-base Markdown files: 121.
- Files requiring a replacement visual if generated figures are removed: 121.
```

with:

```markdown
- Live knowledge-base Markdown files: 125.
- Files requiring a replacement visual if generated figures are removed: 125.
```

- [ ] **Step 7: Add visual reassessment manifest entries**

Under `### Numerical Linear Algebra`, add:

```markdown
- `10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md` - Visual needed: yes. Replacement visual: sparse backend decision map from Jacobian structure to factorization, Schur, marginalization, covariance, and PCG.
```

Under `### Optimization`, add:

```markdown
- `10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md` - Visual needed: yes. Replacement visual: pipeline and failure-layer map from measurement model to diagnostic artifact.
- `10-knowledge-base/optimization/objective-residual-design-and-audit.md` - Visual needed: yes. Replacement visual: residual audit flow from measurement model to whitened residual and diagnostics.
- `10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md` - Visual needed: yes. Replacement visual: solver choice matrix and convergence symptom routing.
```

- [ ] **Step 8: Generate curated visuals**

Run:

```powershell
node tools/knowledge-base/curated-visuals.mjs
```

Expected output:

```text
Wrote 125 curated knowledge-base visuals.
```

- [ ] **Step 9: Run focused smoke tests**

Run:

```powershell
node --test tests/content-smoke.test.mjs
```

Expected: FAIL only on missing glossary, entry-point links, or concept-card fields that will be added in later tasks. No failure should mention missing pages, missing visual assets, or missing taxonomy assignments.

- [ ] **Step 10: Commit the new pages and visuals**

Run:

```powershell
git add -- 10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md 10-knowledge-base/optimization/objective-residual-design-and-audit.md 10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md 10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md 10-knowledge-base/_assets/visuals/optimization-nonlinear-solver-diagnostics-crosswalk.svg 10-knowledge-base/_assets/visuals/optimization-objective-residual-design-and-audit.svg 10-knowledge-base/_assets/visuals/optimization-solver-selection-and-convergence-diagnosis.svg 10-knowledge-base/_assets/visuals/numerical-linear-algebra-sparse-estimation-backend-crosswalk.svg tools/knowledge-base/visual-taxonomy.mjs docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md
git commit -m "docs: add solver diagnostics crosswalk pages"
```

---

### Task 3: Strengthen Canonical Optimization Pages

**Files:**
- Modify: `10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md`
- Modify: `10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md`
- Modify: `10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md`
- Modify: `10-knowledge-base/optimization/trust-region-line-search-globalization.md`
- Modify: `10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md`

- [ ] **Step 1: Add backlinks to new pages**

In each file's `## Related docs`, add the most relevant links:

```markdown
- [Nonlinear Solver Diagnostics Crosswalk](./nonlinear-solver-diagnostics-crosswalk.md)
- [Objective and Residual Design Audit](./objective-residual-design-and-audit.md)
- [Solver Selection and Convergence Diagnosis](./solver-selection-and-convergence-diagnosis.md)
```

Use only the relevant subset in each file. For example, `jacobians-autodiff-manifold-linearization.md` should link to the crosswalk and residual audit; `trust-region-line-search-globalization.md` should link to the crosswalk and solver selection page.

- [ ] **Step 2: Add concept cards to nonlinear least squares**

In `nonlinear-least-squares-first-principles.md`, add a `## Concept Cards` section before `## Sources` with cards for:

- Residual.
- Whitened residual.
- Linearization.
- Normal equations.

Each card must use all fields from the concept-card contract and link to `objective-residual-design-and-audit.md` or `nonlinear-solver-diagnostics-crosswalk.md`.

- [ ] **Step 3: Add concept cards to Jacobians and manifold linearization**

In `jacobians-autodiff-manifold-linearization.md`, add cards for:

- Jacobian consistency.
- Local coordinates.
- Manifold update.
- Tangent finite-difference check.

Include this exact rule in the section:

```markdown
All Jacobian checks on manifold variables must perturb through the same `Plus`, `boxplus`, or `retract` operation used by the solver. The derivative being checked must state whether it is for the raw residual or the whitened residual.
```

- [ ] **Step 4: Add concept cards to GN/LM/dogleg**

In `gauss-newton-levenberg-marquardt-dogleg.md`, add cards for:

- Gauss-Newton step.
- Levenberg-Marquardt damping.
- Dogleg step.
- False convergence.

Include a "Do not confuse with" note stating that damping stabilizes a numerical step but does not add real sensor information or replace a prior.

- [ ] **Step 5: Add concept cards to trust-region and line-search page**

In `trust-region-line-search-globalization.md`, add cards for:

- Trust-region ratio.
- Line-search step length.
- Step acceptance.
- Local model validity.

Include the trial-state lifecycle language from the spec.

- [ ] **Step 6: Add concept card to solver library patterns**

In `factor-graph-solver-patterns-ceres-gtsam-g2o.md`, add one focused concept card:

- Solver method versus solver library.

The card should state that Gauss-Newton, LM, dogleg, QR, Cholesky, Schur, and PCG are method/backend choices, while Ceres, GTSAM, and g2o are libraries that expose different APIs and defaults.

- [ ] **Step 7: Run focused smoke and link checks**

Run:

```powershell
node --test tests/content-smoke.test.mjs
npm run links:check
```

Expected: content smoke may still fail on numerical-linear-algebra concept-card coverage or entry-point links if not yet implemented. Link check should pass for files touched in this task.

- [ ] **Step 8: Commit optimization-page strengthening**

Run:

```powershell
git add -- 10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md 10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md 10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md 10-knowledge-base/optimization/trust-region-line-search-globalization.md 10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md
git commit -m "docs: strengthen optimization solver diagnostics"
```

---

### Task 4: Strengthen Numerical Linear Algebra Pages

**Files:**
- Modify: `10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md`
- Modify: `10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md`
- Modify: `10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md`
- Modify: `10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md`
- Modify: `10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md`
- Modify: `10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md`

- [ ] **Step 1: Add backlinks to sparse backend crosswalk**

In each file's `## Related docs`, add:

```markdown
- [Sparse Estimation Backend Crosswalk](sparse-estimation-backend-crosswalk.md)
```

Also add:

```markdown
- [Nonlinear Solver Diagnostics Crosswalk](../optimization/nonlinear-solver-diagnostics-crosswalk.md)
```

where the page discusses nonlinear solver symptoms.

- [ ] **Step 2: Add rank and conditioning concept cards**

In `eigenvalues-hessian-conditioning-observability.md`, add cards for:

- Rank deficiency.
- Nullspace.
- Gauge freedom.
- Condition number.

Include a sentence that state estimation owns physical observability and integrity interpretation; numerical linear algebra exposes local matrix structure.

- [ ] **Step 3: Add QR/SVD diagnostic concept cards**

In `qr-svd-rank-revealing-solvers.md`, add cards for:

- Column-pivoted QR.
- SVD singular vector.
- Rank threshold.
- Minimum-norm solution.

Each card should map the diagnostic artifact back to variable keys and tangent coordinates.

- [ ] **Step 4: Add factorization concept cards**

In `cholesky-ldlt-normal-equations.md`, add cards for:

- Cholesky.
- LDLT.
- Normal-equation conditioning.
- Positive definiteness failure.

Include a normal versus abnormal artifact note for factorization warnings and `J^T J` condition-number squaring.

- [ ] **Step 5: Add sparsity and ordering concept cards**

In `sparse-matrices-fill-in-ordering.md`, add cards for:

- Sparsity pattern.
- Fill-in.
- Ordering.
- Symbolic versus numeric factorization.

Include runtime and memory symptoms.

- [ ] **Step 6: Add Schur, marginalization, and PCG concept cards**

In `schur-complement-marginalization-pcg.md`, add cards for:

- Schur complement for solving.
- Marginalization prior.
- Stale linearization.
- PCG.
- Preconditioner.

The PCG card must state: SPD requirement, preconditioner used, unpreconditioned and preconditioned residual norms, iteration count, stopping tolerance, nonlinear progress coupling, symmetry test for matrix-vector products, stagnation symptoms, and comparison against explicit Schur or direct solve on a small representative case.

- [ ] **Step 7: Add square-root and covariance concept cards**

In `square-root-information-and-covariance-recovery.md`, add cards for:

- Square-root information.
- Marginal covariance.
- Conditional covariance.
- Covariance recovery.

Include a "Do not confuse with" note for marginal covariance versus conditional covariance versus inverse diagonal information.

- [ ] **Step 8: Run focused checks**

Run:

```powershell
node --test tests/content-smoke.test.mjs
npm run links:check
```

Expected: content smoke may still fail only on glossary or entry-point discoverability if those are not yet implemented. Link check should pass.

- [ ] **Step 9: Commit numerical-linear-algebra strengthening**

Run:

```powershell
git add -- 10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md 10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md 10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md 10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md 10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md 10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md
git commit -m "docs: strengthen sparse backend diagnostics"
```

---

### Task 5: Add Glossary And Entry-Point Discoverability

**Files:**
- Modify: `GLOSSARY.md`
- Modify: `README.md`
- Modify: `INDEX.md`
- Modify: `00-start-here/reading-guide.md`
- Modify: `10-knowledge-base/optimization/overview.md`
- Modify: `10-knowledge-base/numerical-linear-algebra/overview.md`

- [ ] **Step 1: Add glossary section**

In `GLOSSARY.md`, add this section after `### AI / ML`:

```markdown
### Optimization and Numerical Linear Algebra

| Term | Definition |
|------|-----------|
| **Objective** | Function minimized by a solver; in autonomy it combines residuals, priors, weights, and constraints. See [Objective and Residual Design Audit](10-knowledge-base/optimization/objective-residual-design-and-audit.md). |
| **Residual** | Difference between a predicted measurement and an observed measurement, expressed in the correct frame and units. See [Nonlinear Least Squares](10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md). |
| **Whitened residual** | Residual premultiplied by square-root information so its components are in normalized noise units. See [Objective and Residual Design Audit](10-knowledge-base/optimization/objective-residual-design-and-audit.md). |
| **Jacobian** | Derivative of a residual with respect to a local state perturbation. See [Jacobians, Autodiff, and Manifold Linearization](10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md). |
| **Manifold update** | Tangent-space update retracted back to a constrained state such as SO(3), SE(3), or a unit quaternion. See [Jacobians, Autodiff, and Manifold Linearization](10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md). |
| **Rank deficiency** | Condition where a Jacobian or Hessian has unobservable or redundant directions. See [Eigenvalues, Hessian Conditioning, and Observability](10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md). |
| **Schur complement** | Block elimination algebra used to solve reduced systems or form marginalization priors, with different interpretation in each use. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Marginalization prior** | Prior produced by eliminating old variables from a fixed-lag or reduced estimator while preserving their linearized information on remaining variables. See [Schur Complement, Marginalization, and PCG](10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md). |
| **Covariance recovery** | Process of extracting selected uncertainty blocks from a solved information or square-root system. See [Square-Root Information and Covariance Recovery](10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md). |
| **PCG** | Preconditioned conjugate gradients, an iterative method for large symmetric positive definite systems. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
```

Add these rows to the same table:

```markdown
| **Linearization** | Local first-order approximation of residuals around the current estimate. See [Nonlinear Least Squares](10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md). |
| **Local coordinates** | Tangent-space coordinates used to perturb manifold states during linearization. See [Jacobians, Autodiff, and Manifold Linearization](10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md). |
| **Normal equations** | Linear system `J^T J delta = -J^T r` formed from a least-squares linearization; fast but can square conditioning. See [Cholesky, LDLT, and Normal Equations](10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md). |
| **Damping** | Numerical regularization that changes a nonlinear step to improve local stability; it is not a physical prior. See [Solver Selection and Convergence Diagnosis](10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md). |
| **Trust-region ratio** | Actual reduction divided by predicted reduction, used to accept or reject trial steps and update the trust region. See [Trust Region and Line Search Globalization](10-knowledge-base/optimization/trust-region-line-search-globalization.md). |
| **Line-search step length** | Scalar step multiplier selected to reduce the objective along a chosen direction. See [Trust Region and Line Search Globalization](10-knowledge-base/optimization/trust-region-line-search-globalization.md). |
| **Convergence criterion** | Stopping rule based on cost change, gradient norm, step norm, solver status, or iteration budget. See [Solver Selection and Convergence Diagnosis](10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md). |
| **Nullspace** | State direction that does not change the linearized residual. See [Eigenvalues, Hessian Conditioning, and Observability](10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md). |
| **Gauge freedom** | Model symmetry such as global pose or scale that measurements cannot determine without a chosen gauge or prior. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Condition number** | Ratio describing how sensitive a linear solve is to perturbations. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Sparsity** | Matrix structure where most entries are zero because factors touch only a few variables. See [Sparse Matrices, Fill-In, and Ordering](10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md). |
| **Fill-in** | New nonzero entries created during sparse elimination. See [Sparse Matrices, Fill-In, and Ordering](10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md). |
| **Ordering** | Variable elimination order that changes fill-in, runtime, memory, and sometimes diagnostic visibility. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Cholesky** | Factorization for symmetric positive definite systems, often used on normal equations. See [Cholesky, LDLT, and Normal Equations](10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md). |
| **LDLT** | Symmetric factorization that can expose indefinite or semidefinite behavior more directly than plain Cholesky. See [Cholesky, LDLT, and Normal Equations](10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md). |
| **QR** | Least-squares factorization that works directly on `J` and avoids explicitly forming `J^T J`. See [QR, SVD, and Rank-Revealing Solvers](10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md). |
| **SVD** | Singular value decomposition used to expose rank, weak modes, and nullspace directions. See [QR, SVD, and Rank-Revealing Solvers](10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md). |
| **Square-root information** | Factor whose transpose times itself is the information matrix, commonly used for stable residual whitening and priors. See [Square-Root Information and Covariance Recovery](10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md). |
| **Marginal covariance** | Uncertainty block for selected variables after accounting for eliminated or unqueried variables. See [Square-Root Information and Covariance Recovery](10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md). |
| **Preconditioner** | Approximate inverse or scaling that improves PCG convergence. See [Schur Complement, Marginalization, and PCG](10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md). |
```

- [ ] **Step 2: Update optimization overview**

In `10-knowledge-base/optimization/overview.md`:

- Add `Nonlinear Solver Diagnostics Crosswalk`, `Objective and Residual Design Audit`, and `Solver Selection and Convergence Diagnosis` to `Pages In This Section`.
- Add a reading path sentence: `For solver failure triage, start with [Nonlinear Solver Diagnostics Crosswalk](nonlinear-solver-diagnostics-crosswalk.md), then use [Objective and Residual Design Audit](objective-residual-design-and-audit.md) or [Solver Selection and Convergence Diagnosis](solver-selection-and-convergence-diagnosis.md).`
- Add one sentence in `Interfaces, Artifacts, and Failure Modes` linking the motivating failure sentence to the crosswalk.

- [ ] **Step 3: Update numerical-linear-algebra overview**

In `10-knowledge-base/numerical-linear-algebra/overview.md`:

- Add `Sparse Estimation Backend Crosswalk` to `Pages In This Section`.
- Add a reading path sentence: `For sparse backend triage, start with [Sparse Estimation Backend Crosswalk](sparse-estimation-backend-crosswalk.md), then follow rank, factorization, Schur, covariance, or PCG links.`
- Add a boundary sentence stating that state estimation owns physical observability interpretation while numerical linear algebra exposes rank and conditioning structure.

- [ ] **Step 4: Update README and reading guide**

In `README.md`, update the estimator math reading row to link to the nonlinear solver diagnostics crosswalk and update any manual KB count from 121 to 125 if present.

In `00-start-here/reading-guide.md`, add a row or bullet for solver diagnostics:

```markdown
| Solver diagnostics for calibration, SLAM, maps, and planning | [Nonlinear Solver Diagnostics Crosswalk](../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md) | Use when residuals, Jacobians, scaling, damping, rank, covariance, or backend choices may be the failure source. |
```

- [ ] **Step 5: Update INDEX**

In `INDEX.md`, update:

- the foundation overview rows around optimization and numerical linear algebra;
- the mathematical-foundations rows for nonlinear optimization and numerical linear algebra;
- any first-principles wave summary if it lists page counts or page sets.

Ensure `INDEX.md` links to both:

```markdown
10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md
10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md
```

- [ ] **Step 6: Run discoverability checks**

Run:

```powershell
node --test tests/content-smoke.test.mjs
npm run links:check
```

Expected: PASS for the solver diagnostics tests added in Task 1. If failures remain, they should be unrelated existing failures and must be recorded before proceeding.

- [ ] **Step 7: Commit discoverability updates**

Run:

```powershell
git add -- GLOSSARY.md README.md INDEX.md 00-start-here/reading-guide.md 10-knowledge-base/optimization/overview.md 10-knowledge-base/numerical-linear-algebra/overview.md
git commit -m "docs: expose solver diagnostics reading path"
```

---

### Task 6: Add Targeted Applied Backlinks

**Files:**
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/factor-graph-isam2-gtsam.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/graphslam-pose-graph-optimization.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/bundle-adjustment-slam.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/vins-mono-vins-fusion.md`
- Modify: `20-av-platform/sensors/calibration-tracking.md`

- [ ] **Step 1: Add factor-graph backlink**

In `factor-graph-isam2-gtsam.md`, add one sentence near solver or diagnostics discussion:

```markdown
For a failure-oriented route through residual design, Jacobian checks, step acceptance, rank, covariance, and backend choices, use the [Nonlinear Solver Diagnostics Crosswalk](../../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md).
```

Adjust the relative link if `npm run links:check` reports it is wrong.

- [ ] **Step 2: Add GraphSLAM backlink**

In `graphslam-pose-graph-optimization.md`, add one sentence near loop closure or optimization failure modes:

```markdown
When a pose graph reports convergence but the map deforms, triage residual scale, Jacobian consistency, rank, and covariance through the [Nonlinear Solver Diagnostics Crosswalk](../../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md).
```

- [ ] **Step 3: Add bundle adjustment backlink**

In `bundle-adjustment-slam.md`, add one sentence near BA degeneracy or covariance discussion:

```markdown
For BA-specific symptoms such as low reprojection cost with weak geometry, use [Objective and Residual Design Audit](../../../10-knowledge-base/optimization/objective-residual-design-and-audit.md) and [Sparse Estimation Backend Crosswalk](../../../10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md).
```

- [ ] **Step 4: Add VINS backlink**

In `vins-mono-vins-fusion.md`, add one sentence near marginalization prior discussion:

```markdown
For fixed-lag symptoms caused by stale linearization, gauge handling, rank, or marginalization priors, use the [Sparse Estimation Backend Crosswalk](../../../10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md).
```

- [ ] **Step 5: Add calibration backlink**

In `20-av-platform/sensors/calibration-tracking.md`, add one sentence near calibration residual or ICP convergence guidance:

```markdown
For calibration failures caused by the wrong residual, inconsistent Jacobian, poor scale, brittle damping, or an invalid local model, start with the [Nonlinear Solver Diagnostics Crosswalk](../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md).
```

- [ ] **Step 6: Run link check**

Run:

```powershell
npm run links:check
```

Expected: PASS. If relative paths are wrong, fix them and rerun.

- [ ] **Step 7: Commit applied backlinks**

Run:

```powershell
git add -- 30-autonomy-stack/localization-mapping/slam-methods/factor-graph-isam2-gtsam.md 30-autonomy-stack/localization-mapping/slam-methods/graphslam-pose-graph-optimization.md 30-autonomy-stack/localization-mapping/slam-methods/bundle-adjustment-slam.md 30-autonomy-stack/localization-mapping/slam-methods/vins-mono-vins-fusion.md 20-av-platform/sensors/calibration-tracking.md
git commit -m "docs: link applied solver failure diagnostics"
```

---

### Task 7: Final Verification And Cleanup

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run content and priority checks**

Run:

```powershell
npm test
npm run priority:check
```

Expected: PASS.

- [ ] **Step 2: Run link check**

Run:

```powershell
npm run links:check
```

Expected: PASS.

- [ ] **Step 3: Run docs build**

Run:

```powershell
npm run docs:build
```

Expected: PASS with a completed VitePress build.

- [ ] **Step 4: Run final verification**

Run:

```powershell
npm run verify
npm run links:check
```

Expected: both commands PASS.

- [ ] **Step 5: Inspect git status**

Run:

```powershell
git status --short
```

Expected: no uncommitted changes. If generated files changed during verification, inspect the diff and either commit legitimate deterministic updates or revert only files produced by the current task that are not part of the desired change.

---

## Self-Review Checklist

- Spec coverage: tasks cover four required pages, required backend crosswalk, ownership map, symptom-first table, worked examples, concept cards, canonical page strengthening, glossary, entry points, visual taxonomy, manifest count, applied backlinks, and verification commands.
- Red-flag scan: this plan leaves no unspecified page names, commands, or file paths.
- Scope check: the deferred `pcg-and-preconditioning.md` page is excluded from implementation; PCG is strengthened in the existing canonical page and routed through the backend crosswalk.
