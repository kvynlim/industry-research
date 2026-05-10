# Knowledge Base Machine Learning And Entry Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the existing machine-learning overview to the shared autonomy contract and update top-level repository entry points.

**Architecture:** The existing ML overview keeps its ladder structure but broadens from AV perception to autonomy-wide learned systems: perception, prediction, planning-facing objectives, world models, validation, runtime monitoring, and deployment failure modes. The final contract list activates all twelve overview folders so future drift is caught by the smoke tests.

**Tech Stack:** Markdown, existing curated SVG metadata, README and INDEX docs, Node.js tests, VitePress docs build.

---

## Files

- Modify: `10-knowledge-base/machine-learning/overview.md`
- Modify: `10-knowledge-base/_assets/visuals/machine-learning-overview.svg`
- Modify: `tests/content-smoke.test.mjs`
- Modify: `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`
- Modify: `README.md`
- Modify: `INDEX.md`

## Task 1: Activate Final Overview Contract

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Replace `overviewFoldersWithContract`**

Use this final value:

```js
const overviewFoldersWithContract = [
  'controls',
  'geometry-3d',
  'machine-learning',
  'mapping',
  'numerical-linear-algebra',
  'optimization',
  'probability-statistics',
  'robotics',
  'sensors',
  'signal-processing',
  'state-estimation',
  'systems-engineering'
]
```

- [ ] **Step 2: Run focused content test and confirm red**

Run:

```text
node --test tests/content-smoke.test.mjs
```

Expected: FAIL for `10-knowledge-base/machine-learning/overview.md` contract gaps.

## Task 2: Revise Machine Learning Overview

**Files:**
- Modify: `10-knowledge-base/machine-learning/overview.md`

- [ ] **Step 1: Replace the H1**

Use:

```markdown
# Machine Learning Foundations for Autonomy
```

- [ ] **Step 2: Keep the visual block immediately after H1**

Use this image line and caption:

```markdown
<!-- kb-visual:start -->
![Machine Learning Foundations for Autonomy curated visual](../_assets/visuals/machine-learning-overview.svg)

*Visual: machine-learning foundation ladder from linear models and gradients to sequence models, self-supervision, world models, evaluation, and autonomy review.*
<!-- kb-visual:end -->
```

- [ ] **Step 3: Rewrite to the required H2 order**

Use this H2 sequence:

```markdown
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

- [ ] **Step 4: Add ML review questions**

Include these questions under `What This Foundation Lets You Review`:

```markdown
- Is the model learning a deployable representation or exploiting leakage, shortcuts, or label artifacts?
- Are losses, logits, probabilities, thresholds, and calibration interpreted consistently across training, validation, and runtime monitors?
- Do architecture choices match the spatial, temporal, and compute constraints of the autonomy task?
- Are world-model or prediction objectives evaluated against closed-loop planning utility rather than open-loop loss alone?
- Which failure belongs to ML foundations, and which should be handed to probability, optimization, controls, systems engineering, or MLOps?
```

- [ ] **Step 5: Add the diagnostic micro-case**

Include this text under `Interfaces, Artifacts, and Failure Modes`:

```markdown
Diagnostic case: a self-supervised perception backbone improves validation mAP but degrades closed-loop behavior after deployment. The ML review starts with split hygiene, representation shortcuts, calibration, task-loss weighting, and temporal context. If the failure is caused by timestamp drift, the handoff is systems engineering; if the issue is threshold calibration, the handoff is probability/statistics; if actuator feasibility is the limiting factor, the handoff is controls.
```

- [ ] **Step 6: Preserve the useful ML reading ladder**

Move the existing learning ladder content under `Reading Paths By Task`. Broaden the path labels so they cover perception, prediction, learned world models, planning-facing losses, evaluation, calibration, and deployment review.

- [ ] **Step 7: Add ML boundary text**

Under `Boundaries With Neighboring Foundations`, state this boundary:

```markdown
Machine learning owns learned representations, learned objectives, architectures, calibration/leakage review, world-model learning, evaluation, and deployment failure modes. Probability owns the semantics of uncertainty and statistical evidence; optimization owns solver mechanics and residual updates; controls owns closed-loop command feasibility; systems engineering owns timing, release gates, runtime observability, and operational evidence.
```

- [ ] **Step 8: Run content smoke test**

Run:

```text
node --test tests/content-smoke.test.mjs
```

Expected: PASS.

## Task 3: Update ML Visual Metadata And Manifest

**Files:**
- Modify: `10-knowledge-base/_assets/visuals/machine-learning-overview.svg`
- Modify: `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`

- [ ] **Step 1: Update SVG metadata**

Keep these markers:

```xml
data-diagram-kind="learning-roadmap"
<!-- layout:learning-roadmap -->
```

Set the SVG title to `Machine Learning Foundations for Autonomy`. Set the SVG description to match the revised visual caption from Task 2.

- [ ] **Step 2: Update manifest line**

Replace the `10-knowledge-base/machine-learning/overview.md` replacement visual text with:

```text
- `10-knowledge-base/machine-learning/overview.md` - Visual needed: yes. Replacement visual: machine-learning foundation ladder from linear models and gradients to sequence models, self-supervision, world models, evaluation, and autonomy review.
```

- [ ] **Step 3: Run content smoke test**

Run:

```text
node --test tests/content-smoke.test.mjs
```

Expected: PASS.

## Task 4: Update README And INDEX Entry Points

**Files:**
- Modify: `README.md`
- Modify: `INDEX.md`

- [ ] **Step 1: Update README high-leverage paths**

In `README.md`, adjust foundation links so primary entries point to overview pages where available:

```markdown
| First-principles estimator math | [Probability and Statistics Foundations](10-knowledge-base/probability-statistics/overview.md) | Starts the foundations path for uncertainty, likelihoods, gating, robust statistics, nonlinear optimization, numerical linear algebra, state estimation, and covariance diagnostics. |
| Machine learning foundations | [Machine Learning Foundations](10-knowledge-base/machine-learning/overview.md) | Starts from linear models and gradients through CNN/RNN/transformer/SSM foundations, self-supervision, world models, calibration, evaluation, and deployment review. |
```

- [ ] **Step 2: Update INDEX foundation rows**

In `INDEX.md`, add or update rows under foundation-related sections so major foundation groups have overview links:

```markdown
| Probability and statistics foundations | `10-knowledge-base/probability-statistics/overview.md` | Uncertainty, likelihoods, covariance, gates, robust statistics, calibration, and decision thresholds |
| Optimization foundations | `10-knowledge-base/optimization/overview.md` | Residual objectives, Jacobians, manifold linearization, globalization, and solver patterns |
| Numerical linear algebra foundations | `10-knowledge-base/numerical-linear-algebra/overview.md` | Factorization, conditioning, rank, sparsity, Schur complements, marginalization, and covariance recovery |
| State estimation foundations | `10-knowledge-base/state-estimation/overview.md` | Filtering, smoothing, fusion, association, observability, integrity, and deployed estimator lifecycle |
| Geometry and sensor foundations | `10-knowledge-base/geometry-3d/overview.md` | Frames, projection, Lie groups, registration, calibration, and sensor geometry |
| Controls foundations | `10-knowledge-base/controls/overview.md` | Closed-loop tracking, vehicle dynamics, MPC/iLQR, constraints, actuator limits, and safety filters |
| Systems engineering foundations | `10-knowledge-base/systems-engineering/overview.md` | Timing, latency, validation metrics, release gates, observability, architecture contracts, and evidence flow |
```

- [ ] **Step 3: Run link checker and docs build**

Run:

```text
npm run links:check
npm run docs:build
```

Expected: PASS for both commands.

## Task 5: Final Verification And Commit

**Files:**
- Modify all files from Tasks 1-4.

- [ ] **Step 1: Run full verification**

Run:

```text
npm test
npm run links:check
npm run docs:build
```

Expected: PASS for all commands.

- [ ] **Step 2: Commit**

Run:

```text
git add 10-knowledge-base tests/content-smoke.test.mjs README.md INDEX.md docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md
git commit -m "docs: align machine learning overview and foundation entry points"
```
