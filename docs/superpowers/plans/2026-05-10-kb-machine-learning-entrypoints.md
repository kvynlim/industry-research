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

## Preconditions

- `docs/superpowers/plans/2026-05-10-kb-overview-contract-navigation.md` has landed.
- `docs/superpowers/plans/2026-05-10-kb-overviews-batch-a.md` has landed.
- `docs/superpowers/plans/2026-05-10-kb-overviews-batch-b.md` has landed.
- The 11 non-ML overview pages, visuals, taxonomy entries, manifest lines, and active contract tests are present. If any are missing, stop and execute the earlier plan first.

## Task 1: Activate Final Overview Contract

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Replace `overviewFoldersWithContract`**

If `overviewFoldersWithContract` or `legacyOverviewContractExceptions` is absent, stop and run the contract/navigation plan first.

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

- [ ] **Step 2: Clear legacy exceptions**

Replace the legacy exception set with:

```js
const legacyOverviewContractExceptions = new Set()
```

- [ ] **Step 3: Add final overview coverage test**

Add after `existing knowledge-base overview pages are registered for the contract`:

```js
test('every public knowledge-base folder has an overview page', () => {
  const missing = directPublicKnowledgeBaseFolders(repoRoot)
    .filter((folder) => !fs.existsSync(path.join(repoRoot, '10-knowledge-base', folder, 'overview.md')))

  assert.deepEqual(missing, [])
})
```

- [ ] **Step 4: Run focused content test and confirm red**

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

- [ ] **Step 4: Add complete opening sections**

Write concrete prose for `Why This Foundation Exists`, `What This Field Studies From First Principles`, `Autonomy Problem Map`, and `Core Mental Model`. Include this wrong-mental-model sentence:

```markdown
Wrong mental model: machine learning is not just choosing the newest model family; it is the discipline of designing learned representations, objectives, data contracts, evaluation evidence, and deployment behavior that remain meaningful inside an autonomy stack.
```

- [ ] **Step 5: Add ML review questions**

Include these questions under `What This Foundation Lets You Review`:

```markdown
- Is the model learning a deployable representation or exploiting leakage, shortcuts, or label artifacts?
- Are losses, logits, probabilities, thresholds, and calibration interpreted consistently across training, validation, and runtime monitors?
- Do architecture choices match the spatial, temporal, and compute constraints of the autonomy task?
- Are world-model or prediction objectives evaluated against closed-loop planning utility rather than open-loop loss alone?
- Which failure belongs to ML foundations, and which should be handed to probability, optimization, controls, systems engineering, or MLOps?
```

- [ ] **Step 6: Add `Problem-Class Coverage` table**

Use this exact table shape and all eight required rows. The representative pages must use correct relative links from `10-knowledge-base/machine-learning/overview.md`.

```markdown
| Problem Class | Role Of This Foundation | Representative Applied Pages |
|---|---|---|
| Perception and scene understanding | primary - learned encoders, detectors, segmenters, calibration, and leakage review define whether perception evidence is reliable. | [Production Perception Systems](../../30-autonomy-stack/perception/overview/production-perception-systems.md) for deployment review. |
| Localization, SLAM, and state estimation | supporting - learned features, descriptors, depth, place recognition, and learned priors can feed estimators, but estimator consistency is owned elsewhere. | [Robust State Estimation and Multi-Sensor Localization Fusion](../../30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md) for estimator handoff. |
| Mapping and spatial memory | supporting - learned occupancy, semantics, implicit fields, and world-model priors shape map evidence without owning persistent map policy. | [World Models Overview](../../30-autonomy-stack/world-models/overview.md) for learned scene memory. |
| Prediction and world modeling | primary - sequence models, latent dynamics, generative rollouts, and world-model objectives define learned future-state evidence. | [World Models Overview](../../30-autonomy-stack/world-models/overview.md) for rollout review. |
| Planning and decision making | supporting - learned costs, policies, imitation, and world models influence planning, but feasibility and safety constraints need planning/control review. | [Neural Motion Planning](../../30-autonomy-stack/planning/neural-motion-planning.md) for planning-facing objective review. |
| Control and actuation | not central - ML may estimate latent state or learned dynamics, but closed-loop command feasibility belongs to controls. | [Neural Motion Planning](../../30-autonomy-stack/planning/neural-motion-planning.md) for learning-to-planning handoff before control review. |
| Safety, validation, and assurance | primary - data splits, leakage, calibration, robustness, confidence intervals, and model comparison are central to ML safety evidence. | [Production ML Deployment](../../40-runtime-systems/ml-deployment/production-ml-deployment.md) for release and monitoring evidence. |
| Runtime systems and operations | supporting - model size, batching, precision, determinism, monitoring, and fallback behavior affect runtime operations, but system ownership sits in deployment and operations. | [Production ML Deployment](../../40-runtime-systems/ml-deployment/production-ml-deployment.md) for runtime model contract review. |
```

- [ ] **Step 7: Add the diagnostic micro-case**

Include this text under `Interfaces, Artifacts, and Failure Modes`:

```markdown
Diagnostic case: a self-supervised perception backbone improves validation mAP but degrades closed-loop behavior after deployment. The ML review starts with split hygiene, representation shortcuts, calibration, task-loss weighting, and temporal context. If the failure is caused by timestamp drift, the handoff is systems engineering; if the issue is threshold calibration, the handoff is probability/statistics; if actuator feasibility is the limiting factor, the handoff is controls.
```

- [ ] **Step 8: Preserve and generalize existing review content**

Preserve and generalize the existing diagnostic bullets from `Why This Ladder Exists` and `How To Use These Notes In AV Reviews`. Move them into `Core Mental Model`, `What This Foundation Lets You Review`, and `Interfaces, Artifacts, and Failure Modes` rather than deleting them.

- [ ] **Step 9: Preserve the useful ML reading ladder**

Move the existing learning ladder content under `Reading Paths By Task`. Broaden the path labels so they cover perception, prediction, learned world models, planning-facing losses, evaluation, calibration, and deployment review.

- [ ] **Step 10: Add complete local inventory**

Group every local ML page under `Pages In This Section` by learning role. Use these exact filenames:

```text
linear decisions and classification: perceptron-linear-classifiers.md, logistic-softmax-cross-entropy.md
differentiable representation learning: multilayer-perceptrons-activations.md, backprop-computational-graphs-autodiff.md, convolutional-neural-networks.md, recurrent-neural-networks-lstm-gru.md
training dynamics and regularization: optimization-training-dynamics.md, initialization-normalization-regularization.md, multi-task-losses-and-objectives-first-principles.md
attention and sequence architectures: attention-transformers-first-principles.md, vision-transformers-first-principles.md, sequence-models-rnn-ssm-attention-first-principles.md, state-space-models-s4-mamba-first-principles.md, mamba-ssm-for-driving.md, sparse-attention-3d-perception.md
self-supervision and representation objectives: self-supervised-learning-first-principles.md, contrastive-learning-infonsce-first-principles.md, masked-modeling-first-principles.md, jepa-latent-predictive-learning.md, foundation-model-training-first-principles.md
latent and generative models: autoencoders-vae-and-latent-variable-models-first-principles.md, vqvae-tokenization.md, diffusion-models.md, diffusion-score-flow-samplers-first-principles.md, energy-based-models-first-principles.md
tokenization and spatial-temporal encoding: tokenization-and-discretization-first-principles.md, positional-encodings-and-coordinate-tokenization-first-principles.md
world models and planning-facing evaluation: world-models-first-principles.md, transformer-world-models.md, world-model-evaluation-and-planning-objectives-first-principles.md
evaluation and deployment evidence: evaluation-calibration-and-data-leakage-first-principles.md
```

- [ ] **Step 11: Add ML boundary text**

Under `Boundaries With Neighboring Foundations`, state this boundary:

```markdown
Machine learning owns learned representations, learned objectives, architectures, calibration/leakage review, world-model learning, evaluation, and deployment failure modes. Probability owns the semantics of uncertainty and statistical evidence; optimization owns solver mechanics and residual updates; controls owns closed-loop command feasibility; systems engineering owns timing, release gates, runtime observability, and operational evidence.
```

- [ ] **Step 12: Set `Core Sources` policy**

Keep existing external sources that are still directly used in the revised overview. Remove any source that no longer supports retained content. If no new external source is opened while revising the overview, do not add new citations.

- [ ] **Step 13: Run content smoke test**

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

Set the SVG title to `Machine Learning Foundations for Autonomy`. Set the SVG description to match the revised visual caption from Task 2. Update visible title text, visible subtitle text, and node labels so the rendered visual no longer says `actual reading-dependency ladder` or uses AV-only wording.

- [ ] **Step 2: Update manifest line**

Replace the `10-knowledge-base/machine-learning/overview.md` replacement visual text with:

```text
- `10-knowledge-base/machine-learning/overview.md` - Visual needed: yes. Replacement visual: machine-learning foundation ladder from linear models and gradients to sequence models, self-supervision, world models, evaluation, and autonomy review.
```

- [ ] **Step 3: Verify all overview manifest lines and counts**

Run:

```powershell
(rg --files 10-knowledge-base -g '*.md' | Measure-Object).Count
(Select-String -Path docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md -Pattern '^- `10-knowledge-base/.+\.md` - Visual needed: yes').Count
```

Expected: both counts match. Also verify the manifest contains exact lines for all 12 overview pages.

- [ ] **Step 4: Run content smoke test**

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

In `README.md`, adjust foundation links so primary entries point to overview pages where available. Keep atomic pages as supporting links rather than primary entry points:

```markdown
| First-principles estimator math | [Probability and Statistics Foundations](10-knowledge-base/probability-statistics/overview.md) | Starts the foundations path for uncertainty, likelihoods, gating, robust statistics, nonlinear optimization, numerical linear algebra, state estimation, and covariance diagnostics. |
| Machine learning foundations | [Machine Learning Foundations](10-knowledge-base/machine-learning/overview.md) | Starts from linear models and gradients through CNN/RNN/transformer/SSM foundations, self-supervision, world models, calibration, evaluation, and deployment review. |
```

- [ ] **Step 2: Update INDEX foundation rows**

In `INDEX.md`, add or update rows under foundation-related sections so every major foundation group has an overview link:

```markdown
| Probability and statistics foundations | `10-knowledge-base/probability-statistics/overview.md` | Uncertainty, likelihoods, covariance, gates, robust statistics, calibration, and decision thresholds |
| Optimization foundations | `10-knowledge-base/optimization/overview.md` | Residual objectives, Jacobians, manifold linearization, globalization, and solver patterns |
| Numerical linear algebra foundations | `10-knowledge-base/numerical-linear-algebra/overview.md` | Factorization, conditioning, rank, sparsity, Schur complements, marginalization, and covariance recovery |
| State estimation foundations | `10-knowledge-base/state-estimation/overview.md` | Filtering, smoothing, fusion, association, observability, integrity, and deployed estimator lifecycle |
| Geometry and sensor foundations | `10-knowledge-base/geometry-3d/overview.md` | Frames, projection, Lie groups, registration, calibration, and sensor geometry |
| Mapping foundations | `10-knowledge-base/mapping/overview.md` | Occupancy, semantic layers, volumetric maps, fusion policy, dynamic/static separation, and map QA |
| Sensor foundations | `10-knowledge-base/sensors/overview.md` | Measurement likelihoods, error budgets, observability limits, degradation modes, and modality handoff assumptions |
| Signal processing foundations | `10-knowledge-base/signal-processing/overview.md` | Sampling, filtering, FFT, radar processing, CFAR, aliasing, windowing, and clutter contracts |
| Controls foundations | `10-knowledge-base/controls/overview.md` | Closed-loop tracking, vehicle dynamics, MPC/iLQR, constraints, actuator limits, and safety filters |
| Robotics foundations | `10-knowledge-base/robotics/overview.md` | Robot/task vocabulary, route/behavior/motion-planning boundaries, Lanelet2 concepts, and embodiment assumptions |
| Systems engineering foundations | `10-knowledge-base/systems-engineering/overview.md` | Timing, latency, validation metrics, release gates, observability, architecture contracts, and evidence flow |
| Machine learning foundations | `10-knowledge-base/machine-learning/overview.md` | Learned representations, objectives, architectures, self-supervision, world models, evaluation, and deployment failure modes |
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
