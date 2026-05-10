# Knowledge Base Overview Batch B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the dense math, geometry, estimation, and systems overview pages with visuals, taxonomy assignments, manifest updates, and active contract tests.

**Architecture:** This phase extends the active contract list to `geometry-3d`, `numerical-linear-algebra`, `probability-statistics`, `state-estimation`, and `systems-engineering`. The pages emphasize boundaries among probability, optimization, linear algebra, geometry, estimation, mapping, sensors, controls, and systems integration.

**Tech Stack:** Markdown, curated SVG assets, `tools/knowledge-base/visual-taxonomy.mjs`, Node.js tests, VitePress docs build.

---

## Files

- Create: `10-knowledge-base/geometry-3d/overview.md`
- Create: `10-knowledge-base/numerical-linear-algebra/overview.md`
- Create: `10-knowledge-base/probability-statistics/overview.md`
- Create: `10-knowledge-base/state-estimation/overview.md`
- Create: `10-knowledge-base/systems-engineering/overview.md`
- Create: `10-knowledge-base/_assets/visuals/geometry-3d-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/numerical-linear-algebra-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/probability-statistics-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/state-estimation-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/systems-engineering-overview.svg`
- Modify: `tests/content-smoke.test.mjs`
- Modify: `tools/knowledge-base/visual-taxonomy.mjs`
- Modify: `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`

## Batch Page Briefs

| File | H1 | Visual file | Diagram kind | Core role | Diagnostic micro-case |
|---|---|---|---|---|---|
| `10-knowledge-base/geometry-3d/overview.md` | `# 3D Geometry Foundations for Autonomy` | `geometry-3d-overview.svg` | `transform-tree` | Frames, transforms, projection, Lie geometry, sensor geometry, calibration geometry, and registration geometry. | A correct detector appears misaligned because map, base, sensor, and image-frame transforms are composed in the wrong order. |
| `10-knowledge-base/numerical-linear-algebra/overview.md` | `# Numerical Linear Algebra Foundations for Autonomy` | `numerical-linear-algebra-overview.svg` | `matrix-structure` | Factorization, conditioning, rank, nullspaces, sparsity, ordering, Schur complements, covariance recovery, and PCG. | A SLAM backend reports a pose update but hides a weak yaw mode because normal equations squared the condition number. |
| `10-knowledge-base/probability-statistics/overview.md` | `# Probability and Statistics Foundations for Autonomy` | `probability-statistics-overview.svg` | `information-map` | Uncertainty semantics, likelihoods, priors, calibration, robust statistics, hypothesis testing, and thresholds. | A tracker swaps identities because gates use covariance values that are numerically present but not statistically calibrated. |
| `10-knowledge-base/state-estimation/overview.md` | `# State Estimation Foundations for Autonomy` | `state-estimation-overview.svg` | `state-estimation-chain` | Time-evolving latent state, prediction/update cycles, smoothing, fusion, association, observability, and integrity. | A localizer is trusted after a GNSS outage because covariance remains finite even though observable constraints no longer justify lane-level confidence. |
| `10-knowledge-base/systems-engineering/overview.md` | `# Systems Engineering Foundations for Autonomy` | `systems-engineering-overview.svg` | `systems-map` | Timing, latency, validation metrics, release gates, observability, architecture contracts, operational error budgets, and evidence flow. | A perception model passes offline metrics but fails release because replay timing, data lineage, and runtime monitoring do not support the safety claim. |

## Boundary Requirements

Use these boundaries in `Boundaries With Neighboring Foundations`:

```text
geometry-3d: Own frames, transforms, projection, Lie geometry, sensor geometry, calibration geometry, and registration geometry. Registration remains geometry until committed into persistent map state.
numerical-linear-algebra: Own factorization, conditioning, rank, nullspaces, sparsity, ordering, fill-in, Schur complements, marginalization algebra, covariance recovery, and PCG. Do not present it as an estimator or solver-library guide.
probability-statistics: Own belief, evidence, uncertainty semantics, likelihoods, priors, calibration, hypothesis testing, robust statistics, and thresholds. Do not move solver algorithms into this foundation.
state-estimation: Own time-evolving latent state, prediction/update, smoothing, fusion, association, out-of-sequence data, observability, and integrity. Probability explains Mahalanobis/NIS/NEES statistics; state estimation explains where they live in fusion, tracking, SLAM, and integrity.
systems-engineering: Own cross-cutting integration contracts: timing, latency, metrics, release gates, architecture tradeoffs, observability, operational error budgets, and evidence flow. Do not re-explain each foundation's local failure modes.
```

## Task 1: Activate Batch B Contract Tests

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Replace `overviewFoldersWithContract`**

Use this value:

```js
const overviewFoldersWithContract = [
  'controls',
  'geometry-3d',
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

Expected: FAIL with missing overview pages for the five newly activated folders.

## Task 2: Write Batch B Overview Pages

**Files:**
- Create the five `overview.md` files listed in the file map.

- [ ] **Step 1: Use the required H2 contract**

Use this H2 sequence on every page:

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

Use these problem-class row labels exactly:

```markdown
| Perception and scene understanding |
| Localization, SLAM, and state estimation |
| Mapping and spatial memory |
| Prediction and world modeling |
| Planning and decision making |
| Control and actuation |
| Safety, validation, and assurance |
| Runtime systems and operations |
```

- [ ] **Step 2: Add section-specific review questions**

Under `What This Foundation Lets You Review`, add 3-5 questions per page. Cover these review focuses:

```text
geometry-3d: frame conventions, transform composition, projection model validity, Lie update usage, calibration/registration observability.
numerical-linear-algebra: rank, conditioning, sparsity, fill-in, Schur complements, marginalization algebra, covariance recovery.
probability-statistics: likelihood semantics, priors, calibration, robust statistics, gates, thresholds, confidence claims.
state-estimation: prediction/update contracts, smoothing, fusion, data association, out-of-sequence data, observability, integrity.
systems-engineering: timing, latency, architecture contracts, validation metrics, release evidence, observability, operational budgets.
```

- [ ] **Step 3: Add local inventories in `Pages In This Section`**

Use these exact page inventories:

```text
geometry-3d: 3d-object-detection-losses-assignment-first-principles.md, camera-imaging-noise-calibration.md, camera-projective-geometry-pnp-triangulation.md, coordinate-frames-projections-se3.md, correspondence-search-data-structures.md, event-thermal-camera-models.md, geodesy-map-projections-datums.md, lidar-working-principles-noise-models.md, lie-groups-se3-so3-jacobians.md, multi-sensor-calibration-observability.md, point-cloud-registration-math-icp-ndt-gicp.md, point-cloud-segmentation-losses-metrics-first-principles.md, pointpillars.md, rolling-shutter-lidar-deskew-motion-distortion.md, sensor-calibration-time-synchronization.md, volume-rendering-radiance-fields-gaussian-splatting.md
numerical-linear-algebra: cholesky-ldlt-normal-equations.md, eigenvalues-hessian-conditioning-observability.md, qr-svd-rank-revealing-solvers.md, schur-complement-marginalization-pcg.md, sparse-matrices-fill-in-ordering.md, square-root-information-and-covariance-recovery.md
probability-statistics: detection-theory-roc-pr-operating-points.md, gaussian-noise-covariance-information.md, information-theory-for-perception-ml.md, likelihood-map-mle-least-squares.md, mahalanobis-chi-square-gating.md, mixture-models-multimodal-beliefs.md, probabilistic-graphical-models-message-passing.md, robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md, robust-statistics-ransac-hypothesis-testing.md, uncertainty-quantification-calibration-conformal.md
state-estimation: bayesian-filtering-and-eskf.md, continuous-time-trajectory-splines-gp-priors.md, data-association-and-gating.md, fusion-unknown-correlations-covariance-intersection.md, gnss-rtk-error-models.md, gtsam-factor-graphs.md, imu-error-models-preintegration.md, information-filters-and-smoothers.md, localization-integrity-protection-levels-raim.md, loop-closure-place-recognition-first-principles.md, multi-sensor-fusion-measurement-models-first-principles.md, out-of-sequence-measurements-fixed-lag-smoothing.md, particle-filters-and-hypothesis-management.md, probabilistic-multi-object-association.md, rtk-gps-imu-localization.md, slam-vio-observability-fej-nullspace-consistency.md, tracking-motion-models-track-lifecycle-metrics.md, wheel-odometry-encoder-models.md
systems-engineering: architecture-innovations.md, benchmarking-metrics-statistical-validity.md, signal-processing-weather.md, theoretical-foundations.md, time-sync-ptp-timestamping-latency-models.md, time-synchronization-error-budgets.md
```

- [ ] **Step 4: Add applied links outside `10-knowledge-base`**

Use 3-5 applied links per page with a reason phrase. Start from these targets:

```text
geometry-3d: 30-autonomy-stack/perception/overview/fusion-geometric.md, 30-autonomy-stack/localization-mapping/slam-methods/vins-mono-vins-fusion.md, 40-runtime-systems/software-operations/sensor-calibration-fleet-ops.md
numerical-linear-algebra: 30-autonomy-stack/localization-mapping/slam-methods/factor-graph-isam2-gtsam.md, 30-autonomy-stack/localization-mapping/slam-methods/graphslam-pose-graph-optimization.md, 30-autonomy-stack/localization-mapping/slam-methods/bundle-adjustment-slam.md
probability-statistics: 30-autonomy-stack/perception/overview/uncertainty-quantification-calibration.md, 30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md, 30-autonomy-stack/perception/methods/conformal-boxes.md
state-estimation: 30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md, 30-autonomy-stack/localization-mapping/slam-methods/factor-graph-isam2-gtsam.md, 30-autonomy-stack/perception/overview/multi-object-tracking.md
systems-engineering: 40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md, 40-runtime-systems/middleware/topic-freshness-and-stale-data-contracts.md, 40-runtime-systems/monitoring-observability/ros2-timing-diagnostics-observability.md
```

- [ ] **Step 5: Run link checker**

Run:

```text
npm run links:check
```

Expected: PASS.

## Task 3: Add Batch B Visuals And Taxonomy

**Files:**
- Create the five SVG files listed in the file map.
- Modify: `tools/knowledge-base/visual-taxonomy.mjs`

- [ ] **Step 1: Create SVG assets**

Each SVG must use `width="1400"`, `height="720"`, `viewBox="0 0 1400 720"`, `role="img"`, a `<title>`, a `<desc>`, the matching `data-diagram-kind`, and a layout comment matching its assigned kind such as `<!-- layout:matrix-structure -->` for `numerical-linear-algebra-overview.svg`.

- [ ] **Step 2: Add taxonomy entries**

Insert these entries in `PAGE_DIAGRAM_KIND`:

```js
'10-knowledge-base/geometry-3d/overview.md': 'transform-tree',
'10-knowledge-base/numerical-linear-algebra/overview.md': 'matrix-structure',
'10-knowledge-base/probability-statistics/overview.md': 'information-map',
'10-knowledge-base/state-estimation/overview.md': 'state-estimation-chain',
'10-knowledge-base/systems-engineering/overview.md': 'systems-map',
```

- [ ] **Step 3: Run content smoke test**

Run:

```text
node --test tests/content-smoke.test.mjs
```

Expected: PASS.

## Task 4: Update Visual Manifest

**Files:**
- Modify: `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`

- [ ] **Step 1: Add manifest lines**

Add these lines to the matching section inventory:

```text
- `10-knowledge-base/geometry-3d/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing 3D geometry foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/numerical-linear-algebra/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing numerical linear algebra foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/probability-statistics/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing probability and statistics foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/state-estimation/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing state-estimation foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/systems-engineering/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing systems-engineering foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
```

- [ ] **Step 2: Update manifest counts**

Run:

```powershell
(rg --files 10-knowledge-base -g '*.md' | Measure-Object).Count
```

Expected: `121` if no other Markdown pages were added after Batch A. Set visible manifest count lines to the command output.

## Task 5: Verify And Commit Batch B

**Files:**
- Add and modify all files from Tasks 1-4.

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
git add 10-knowledge-base tests/content-smoke.test.mjs tools/knowledge-base/visual-taxonomy.mjs docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md
git commit -m "docs: add dense knowledge base section overviews"
```
