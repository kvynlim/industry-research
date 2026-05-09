# Knowledge Base Taxonomy Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 99 knowledge-base SVG visuals around explicit taxonomy-based diagram kinds so the pages no longer look like the same template with renamed labels.

**Architecture:** Keep the public Markdown visual contract stable, preserve existing asset names, and refactor the deterministic generator around a new taxonomy module. Tests import the taxonomy without executing the generator, then generated SVGs expose matching `data-diagram-kind` metadata.

**Tech Stack:** Node.js ESM, `node:test`, Markdown, inline SVG, VitePress.

---

## File Structure

- Create: `tools/knowledge-base/visual-taxonomy.mjs`
  - Owns the explicit page-to-diagram-kind mapping.
  - Exports `DIAGRAM_KINDS`, `PAGE_DIAGRAM_KIND`, and `visualKindForFile(file)`.
  - Has no filesystem side effects, so tests can import it safely.
- Modify: `tools/knowledge-base/curated-visuals.mjs`
  - Imports `visualKindForFile`.
  - Adds `diagramKind` to each parsed visual spec.
  - Replaces the regex-only `chooseRenderer` path with diagram-kind renderer dispatch.
  - Writes `data-diagram-kind="<kind>"` on each root SVG.
- Modify: `tests/content-smoke.test.mjs`
  - Imports the taxonomy module.
  - Adds coverage tests for exact live-file assignment, taxonomy variety, and SVG kind metadata.
- Modify: existing `10-knowledge-base/_assets/visuals/*.svg`
  - Regenerated in place with the same filenames and more varied compositions.
- Keep unchanged unless captions require normalization: existing `10-knowledge-base/**/*.md`
  - The current `kb-visual` blocks and asset paths should remain stable.

---

### Task 1: Add RED Tests For Taxonomy Coverage And Metadata

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Import the taxonomy module at the top of the test file**

Add this import after the existing Node imports:

```js
import { DIAGRAM_KINDS, PAGE_DIAGRAM_KIND } from '../tools/knowledge-base/visual-taxonomy.mjs'
```

- [ ] **Step 2: Add a taxonomy assignment test**

Append this test after `knowledge-base pages include one curated replacement visual`:

```js
test('knowledge-base pages have explicit taxonomy visual assignments', () => {
  const knowledgeBaseDir = path.join(repoRoot, '10-knowledge-base')
  const markdownFiles = readMarkdownFiles(knowledgeBaseDir)
    .map((file) => path.relative(repoRoot, file).replace(/\\/g, '/'))
    .sort()
  const assignedFiles = Object.keys(PAGE_DIAGRAM_KIND).sort()
  const allowedKinds = new Set(DIAGRAM_KINDS)
  const failures = []
  const usage = new Map()

  assert.deepEqual(assignedFiles, markdownFiles)

  for (const [file, kind] of Object.entries(PAGE_DIAGRAM_KIND)) {
    if (!allowedKinds.has(kind)) {
      failures.push(`${file}: unknown diagram kind ${kind}`)
      continue
    }

    usage.set(kind, (usage.get(kind) ?? 0) + 1)
  }

  const dominantKinds = [...usage.entries()]
    .filter(([, count]) => count > 7)
    .map(([kind, count]) => `${kind}:${count}`)

  assert.ok(usage.size >= 30, `expected at least 30 diagram kinds, got ${usage.size}`)
  assert.deepEqual(dominantKinds, [])
  assert.deepEqual(failures, [])
})
```

- [ ] **Step 3: Strengthen SVG metadata checks**

Inside `curated knowledge-base visual assets keep accessible metadata`, after `const svg = fs.readFileSync(imagePath, 'utf8')`, add:

```js
    const expectedKind = PAGE_DIAGRAM_KIND[relPath]
    const diagramKind = svg.match(/data-diagram-kind="([^"]+)"/)?.[1]
```

After the `<desc>` checks, add:

```js
    if (!expectedKind) {
      failures.push(`${relPath}: missing taxonomy assignment`)
    }

    if (diagramKind !== expectedKind) {
      failures.push(`${relPath}: SVG diagram kind ${diagramKind ?? 'missing'} should match ${expectedKind}`)
    }
```

- [ ] **Step 4: Run focused tests to verify RED**

Run:

```powershell
node --test tests/content-smoke.test.mjs
```

Expected: FAIL because `tools/knowledge-base/visual-taxonomy.mjs` does not exist yet.

---

### Task 2: Add The Explicit Visual Taxonomy Module

**Files:**
- Create: `tools/knowledge-base/visual-taxonomy.mjs`

- [ ] **Step 1: Create the taxonomy module**

Create `tools/knowledge-base/visual-taxonomy.mjs` with this content:

```js
export const DIAGRAM_KINDS = Object.freeze([
  'architecture-comparison',
  'attention-matrix',
  'beam-noise-model',
  'belief-update-loop',
  'benchmark-split-firewall',
  'closed-loop-control',
  'computational-graph',
  'decision-boundary',
  'density-mixture',
  'dynamics-model-ladder',
  'embedding-space',
  'error-budget',
  'evaluation-firewall',
  'factor-graph',
  'filter-update-loop',
  'generative-trajectory',
  'geodesy-chain',
  'information-map',
  'latent-architecture',
  'learning-roadmap',
  'manifold-linearization',
  'map-and-planning-stack',
  'matrix-structure',
  'measurement-chain',
  'numerical-factorization',
  'objective-landscape',
  'occupancy-map-update',
  'optimization-step-geometry',
  'probability-thresholds',
  'projection-rays',
  'radar-map',
  'receptive-field',
  'registration-comparison',
  'rendering-comparison',
  'representation-comparison',
  'road-corridor-geometry',
  'search-and-gating',
  'sequence-memory',
  'signal-flow-depth',
  'signal-processing-chain',
  'solver-loop',
  'sparse-attention-map',
  'state-estimation-chain',
  'systems-map',
  'tensor-pipeline',
  'timing-sync',
  'token-grid',
  'training-lifecycle',
  'transform-tree',
  'uncertainty-geometry',
  'world-model-rollout'
])

export const PAGE_DIAGRAM_KIND = Object.freeze({
  '10-knowledge-base/controls/constrained-optimization-mpc-ilqr-first-principles.md': 'closed-loop-control',
  '10-knowledge-base/controls/frenet-trajectory-math.md': 'road-corridor-geometry',
  '10-knowledge-base/controls/mdp-pomdp-belief-space-rl-first-principles.md': 'belief-update-loop',
  '10-knowledge-base/controls/vehicle-dynamics-and-control.md': 'dynamics-model-ladder',
  '10-knowledge-base/geometry-3d/camera-imaging-noise-calibration.md': 'measurement-chain',
  '10-knowledge-base/geometry-3d/camera-projective-geometry-pnp-triangulation.md': 'projection-rays',
  '10-knowledge-base/geometry-3d/coordinate-frames-projections-se3.md': 'transform-tree',
  '10-knowledge-base/geometry-3d/correspondence-search-data-structures.md': 'search-and-gating',
  '10-knowledge-base/geometry-3d/event-thermal-camera-models.md': 'timing-sync',
  '10-knowledge-base/geometry-3d/geodesy-map-projections-datums.md': 'geodesy-chain',
  '10-knowledge-base/geometry-3d/lidar-working-principles-noise-models.md': 'beam-noise-model',
  '10-knowledge-base/geometry-3d/lie-groups-se3-so3-jacobians.md': 'manifold-linearization',
  '10-knowledge-base/geometry-3d/multi-sensor-calibration-observability.md': 'factor-graph',
  '10-knowledge-base/geometry-3d/point-cloud-registration-math-icp-ndt-gicp.md': 'registration-comparison',
  '10-knowledge-base/geometry-3d/pointpillars.md': 'tensor-pipeline',
  '10-knowledge-base/geometry-3d/rolling-shutter-lidar-deskew-motion-distortion.md': 'timing-sync',
  '10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md': 'timing-sync',
  '10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md': 'rendering-comparison',
  '10-knowledge-base/machine-learning/attention-transformers-first-principles.md': 'attention-matrix',
  '10-knowledge-base/machine-learning/autoencoders-vae-and-latent-variable-models-first-principles.md': 'latent-architecture',
  '10-knowledge-base/machine-learning/backprop-computational-graphs-autodiff.md': 'computational-graph',
  '10-knowledge-base/machine-learning/contrastive-learning-infonsce-first-principles.md': 'embedding-space',
  '10-knowledge-base/machine-learning/convolutional-neural-networks.md': 'receptive-field',
  '10-knowledge-base/machine-learning/diffusion-models.md': 'generative-trajectory',
  '10-knowledge-base/machine-learning/diffusion-score-flow-samplers-first-principles.md': 'generative-trajectory',
  '10-knowledge-base/machine-learning/energy-based-models-first-principles.md': 'objective-landscape',
  '10-knowledge-base/machine-learning/evaluation-calibration-and-data-leakage-first-principles.md': 'evaluation-firewall',
  '10-knowledge-base/machine-learning/foundation-model-training-first-principles.md': 'training-lifecycle',
  '10-knowledge-base/machine-learning/initialization-normalization-regularization.md': 'signal-flow-depth',
  '10-knowledge-base/machine-learning/jepa-latent-predictive-learning.md': 'latent-architecture',
  '10-knowledge-base/machine-learning/logistic-softmax-cross-entropy.md': 'probability-thresholds',
  '10-knowledge-base/machine-learning/mamba-ssm-for-driving.md': 'sequence-memory',
  '10-knowledge-base/machine-learning/masked-modeling-first-principles.md': 'token-grid',
  '10-knowledge-base/machine-learning/multi-task-losses-and-objectives-first-principles.md': 'objective-landscape',
  '10-knowledge-base/machine-learning/multilayer-perceptrons-activations.md': 'decision-boundary',
  '10-knowledge-base/machine-learning/optimization-training-dynamics.md': 'optimization-step-geometry',
  '10-knowledge-base/machine-learning/overview.md': 'learning-roadmap',
  '10-knowledge-base/machine-learning/perceptron-linear-classifiers.md': 'decision-boundary',
  '10-knowledge-base/machine-learning/positional-encodings-and-coordinate-tokenization-first-principles.md': 'token-grid',
  '10-knowledge-base/machine-learning/recurrent-neural-networks-lstm-gru.md': 'sequence-memory',
  '10-knowledge-base/machine-learning/self-supervised-learning-first-principles.md': 'architecture-comparison',
  '10-knowledge-base/machine-learning/sequence-models-rnn-ssm-attention-first-principles.md': 'architecture-comparison',
  '10-knowledge-base/machine-learning/sparse-attention-3d-perception.md': 'sparse-attention-map',
  '10-knowledge-base/machine-learning/state-space-models-s4-mamba-first-principles.md': 'sequence-memory',
  '10-knowledge-base/machine-learning/tokenization-and-discretization-first-principles.md': 'token-grid',
  '10-knowledge-base/machine-learning/transformer-world-models.md': 'world-model-rollout',
  '10-knowledge-base/machine-learning/vision-transformers-first-principles.md': 'tensor-pipeline',
  '10-knowledge-base/machine-learning/vqvae-tokenization.md': 'latent-architecture',
  '10-knowledge-base/machine-learning/world-model-evaluation-and-planning-objectives-first-principles.md': 'world-model-rollout',
  '10-knowledge-base/machine-learning/world-models-first-principles.md': 'world-model-rollout',
  '10-knowledge-base/mapping/occupancy-bayes-evidential-dynamic-grids.md': 'occupancy-map-update',
  '10-knowledge-base/mapping/volumetric-map-representations-tsdf-esdf-octree-surfels.md': 'representation-comparison',
  '10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md': 'numerical-factorization',
  '10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md': 'matrix-structure',
  '10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md': 'numerical-factorization',
  '10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md': 'matrix-structure',
  '10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md': 'matrix-structure',
  '10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md': 'numerical-factorization',
  '10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md': 'factor-graph',
  '10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md': 'optimization-step-geometry',
  '10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md': 'manifold-linearization',
  '10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md': 'solver-loop',
  '10-knowledge-base/optimization/trust-region-line-search-globalization.md': 'optimization-step-geometry',
  '10-knowledge-base/probability-statistics/detection-theory-roc-pr-operating-points.md': 'probability-thresholds',
  '10-knowledge-base/probability-statistics/gaussian-noise-covariance-information.md': 'uncertainty-geometry',
  '10-knowledge-base/probability-statistics/information-theory-for-perception-ml.md': 'information-map',
  '10-knowledge-base/probability-statistics/likelihood-map-mle-least-squares.md': 'objective-landscape',
  '10-knowledge-base/probability-statistics/mahalanobis-chi-square-gating.md': 'uncertainty-geometry',
  '10-knowledge-base/probability-statistics/mixture-models-multimodal-beliefs.md': 'density-mixture',
  '10-knowledge-base/probability-statistics/probabilistic-graphical-models-message-passing.md': 'factor-graph',
  '10-knowledge-base/probability-statistics/robust-statistics-ransac-hypothesis-testing.md': 'probability-thresholds',
  '10-knowledge-base/probability-statistics/uncertainty-quantification-calibration-conformal.md': 'uncertainty-geometry',
  '10-knowledge-base/robotics/embodied-ai-crossover.md': 'systems-map',
  '10-knowledge-base/robotics/lanelet2-maps.md': 'map-and-planning-stack',
  '10-knowledge-base/robotics/planning-taxonomy-and-trajectory-generation.md': 'map-and-planning-stack',
  '10-knowledge-base/sensors/sensor-likelihoods-noise-error-budgets.md': 'error-budget',
  '10-knowledge-base/signal-processing/cfar-detection-thresholding.md': 'signal-processing-chain',
  '10-knowledge-base/signal-processing/radar-ambiguity-chirp-design-doppler-limits.md': 'radar-map',
  '10-knowledge-base/signal-processing/radar-fmcw-mimo-doppler.md': 'radar-map',
  '10-knowledge-base/signal-processing/sampling-fft-windowing-filtering.md': 'signal-processing-chain',
  '10-knowledge-base/signal-processing/sensor-filtering-alpha-beta-kalman-complementary.md': 'filter-update-loop',
  '10-knowledge-base/state-estimation/bayesian-filtering-and-eskf.md': 'filter-update-loop',
  '10-knowledge-base/state-estimation/continuous-time-trajectory-splines-gp-priors.md': 'state-estimation-chain',
  '10-knowledge-base/state-estimation/data-association-and-gating.md': 'search-and-gating',
  '10-knowledge-base/state-estimation/gnss-rtk-error-models.md': 'error-budget',
  '10-knowledge-base/state-estimation/gtsam-factor-graphs.md': 'factor-graph',
  '10-knowledge-base/state-estimation/imu-error-models-preintegration.md': 'timing-sync',
  '10-knowledge-base/state-estimation/information-filters-and-smoothers.md': 'factor-graph',
  '10-knowledge-base/state-estimation/particle-filters-and-hypothesis-management.md': 'density-mixture',
  '10-knowledge-base/state-estimation/probabilistic-multi-object-association.md': 'search-and-gating',
  '10-knowledge-base/state-estimation/rtk-gps-imu-localization.md': 'state-estimation-chain',
  '10-knowledge-base/state-estimation/tracking-motion-models-track-lifecycle-metrics.md': 'state-estimation-chain',
  '10-knowledge-base/state-estimation/wheel-odometry-encoder-models.md': 'state-estimation-chain',
  '10-knowledge-base/systems-engineering/architecture-innovations.md': 'systems-map',
  '10-knowledge-base/systems-engineering/benchmarking-metrics-statistical-validity.md': 'benchmark-split-firewall',
  '10-knowledge-base/systems-engineering/signal-processing-weather.md': 'error-budget',
  '10-knowledge-base/systems-engineering/theoretical-foundations.md': 'information-map',
  '10-knowledge-base/systems-engineering/time-sync-ptp-timestamping-latency-models.md': 'timing-sync',
  '10-knowledge-base/systems-engineering/time-synchronization-error-budgets.md': 'error-budget'
})

export function visualKindForFile(file) {
  const normalized = String(file).replace(/\\/g, '/')
  const kind = PAGE_DIAGRAM_KIND[normalized]
  if (!kind) {
    throw new Error(`Missing visual taxonomy assignment for ${normalized}`)
  }
  return kind
}
```

- [ ] **Step 2: Run focused tests to verify the import error is resolved and SVG metadata is still RED**

Run:

```powershell
node --test tests/content-smoke.test.mjs
```

Expected: FAIL with SVG metadata failures such as `SVG diagram kind missing should match closed-loop-control`.

---

### Task 3: Refactor Generator Dispatch And SVG Metadata

**Files:**
- Modify: `tools/knowledge-base/curated-visuals.mjs`

- [ ] **Step 1: Import the taxonomy**

Add this import with the other imports:

```js
import { visualKindForFile } from './visual-taxonomy.mjs'
```

- [ ] **Step 2: Add `diagramKind` to parsed specs**

In `parseReassessment()`, add this field to the returned object:

```js
      diagramKind: visualKindForFile(file),
```

- [ ] **Step 3: Add diagram-kind metadata to the root SVG**

Change the opening `<svg>` in `frame(spec, inner)` from:

```js
return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="720" viewBox="0 0 1400 720" role="img" aria-labelledby="title desc">
```

to:

```js
return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="720" viewBox="0 0 1400 720" role="img" aria-labelledby="title desc" data-diagram-kind="${escapeXml(spec.diagramKind)}">
```

- [ ] **Step 4: Replace regex renderer selection with taxonomy dispatch**

Delete the existing `chooseRenderer(spec)` implementation and replace it with:

```js
const KIND_RENDERER = {
  'architecture-comparison': renderArchitectureComparison,
  'attention-matrix': renderAttentionMatrix,
  'beam-noise-model': renderBeamNoiseModel,
  'belief-update-loop': renderBeliefUpdateLoop,
  'benchmark-split-firewall': renderBenchmarkSplitFirewall,
  'closed-loop-control': renderClosedLoopControl,
  'computational-graph': renderComputationalGraph,
  'decision-boundary': renderDecisionBoundary,
  'density-mixture': renderDensityMixture,
  'dynamics-model-ladder': renderDynamicsModelLadder,
  'embedding-space': renderEmbeddingSpace,
  'error-budget': renderErrorBudget,
  'evaluation-firewall': renderEvaluationFirewall,
  'factor-graph': renderFactorGraph,
  'filter-update-loop': renderFilterUpdateLoop,
  'generative-trajectory': renderGenerativeTrajectory,
  'geodesy-chain': renderGeodesyChain,
  'information-map': renderInformationMap,
  'latent-architecture': renderLatentArchitecture,
  'learning-roadmap': renderLearningRoadmap,
  'manifold-linearization': renderManifoldLinearization,
  'map-and-planning-stack': renderMapAndPlanningStack,
  'matrix-structure': renderMatrixStructure,
  'measurement-chain': renderMeasurementChain,
  'numerical-factorization': renderNumericalFactorization,
  'objective-landscape': renderObjectiveLandscape,
  'occupancy-map-update': renderOccupancyMapUpdate,
  'optimization-step-geometry': renderOptimizationStepGeometry,
  'probability-thresholds': renderProbabilityThresholds,
  'projection-rays': renderProjectionRays,
  'radar-map': renderRadarMap,
  'receptive-field': renderReceptiveField,
  'registration-comparison': renderRegistrationComparison,
  'rendering-comparison': renderRenderingComparison,
  'representation-comparison': renderRepresentationComparison,
  'road-corridor-geometry': renderRoadCorridorGeometry,
  'search-and-gating': renderSearchAndGating,
  'sequence-memory': renderSequenceMemory,
  'signal-flow-depth': renderSignalFlowDepth,
  'signal-processing-chain': renderSignalProcessingChain,
  'solver-loop': renderSolverLoop,
  'sparse-attention-map': renderSparseAttentionMap,
  'state-estimation-chain': renderStateEstimationChain,
  'systems-map': renderSystemsMap,
  'tensor-pipeline': renderTensorPipeline,
  'timing-sync': renderTimingSync,
  'token-grid': renderTokenGrid,
  'training-lifecycle': renderTrainingLifecycle,
  'transform-tree': renderTransformTree,
  'uncertainty-geometry': renderUncertaintyGeometry,
  'world-model-rollout': renderWorldModelRollout
}

function chooseRenderer(spec) {
  const renderer = KIND_RENDERER[spec.diagramKind]
  if (!renderer) throw new Error(`${spec.file}: missing renderer for ${spec.diagramKind}`)
  return renderer
}
```

- [ ] **Step 5: Keep the generator runnable after dispatch changes**

Before adding the full renderer set in the next task, temporarily map all new renderer names to the nearest existing renderer so syntax and dispatch can be tested:

```js
const renderArchitectureComparison = renderConceptMap
const renderAttentionMatrix = renderMatrix
const renderBeamNoiseModel = renderGeometry
const renderBeliefUpdateLoop = renderConceptMap
const renderBenchmarkSplitFirewall = renderPipeline
const renderClosedLoopControl = renderPipeline
const renderComputationalGraph = renderConceptMap
const renderDecisionBoundary = renderGeometry
const renderDensityMixture = renderGeometry
const renderDynamicsModelLadder = renderPipeline
const renderEmbeddingSpace = renderGeometry
const renderErrorBudget = renderPipeline
const renderEvaluationFirewall = renderPipeline
const renderFactorGraph = renderConceptMap
const renderFilterUpdateLoop = renderConceptMap
const renderGenerativeTrajectory = renderTimeline
const renderGeodesyChain = renderGeometry
const renderInformationMap = renderConceptMap
const renderLatentArchitecture = renderPipeline
const renderLearningRoadmap = renderPipeline
const renderManifoldLinearization = renderGeometry
const renderMapAndPlanningStack = renderPipeline
const renderMatrixStructure = renderMatrix
const renderMeasurementChain = renderPipeline
const renderNumericalFactorization = renderMatrix
const renderObjectiveLandscape = renderGeometry
const renderOccupancyMapUpdate = renderGeometry
const renderOptimizationStepGeometry = renderGeometry
const renderProbabilityThresholds = renderMatrix
const renderProjectionRays = renderGeometry
const renderRadarMap = renderMatrix
const renderReceptiveField = renderMatrix
const renderRegistrationComparison = renderGeometry
const renderRenderingComparison = renderGeometry
const renderRepresentationComparison = renderConceptMap
const renderRoadCorridorGeometry = renderGeometry
const renderSearchAndGating = renderGeometry
const renderSequenceMemory = renderTimeline
const renderSignalFlowDepth = renderPipeline
const renderSignalProcessingChain = renderPipeline
const renderSolverLoop = renderPipeline
const renderSparseAttentionMap = renderMatrix
const renderStateEstimationChain = renderPipeline
const renderSystemsMap = renderConceptMap
const renderTensorPipeline = renderPipeline
const renderTimingSync = renderTimeline
const renderTokenGrid = renderMatrix
const renderTrainingLifecycle = renderPipeline
const renderTransformTree = renderConceptMap
const renderUncertaintyGeometry = renderGeometry
const renderWorldModelRollout = renderTimeline
```

- [ ] **Step 6: Generate visuals and run focused tests**

Run:

```powershell
node tools/knowledge-base/curated-visuals.mjs
node --test tests/content-smoke.test.mjs
```

Expected: PASS. This proves the taxonomy contract and metadata work before visual variety is improved.

---

### Task 4: Replace Temporary Renderer Aliases With Distinct Taxonomy Layouts

**Files:**
- Modify: `tools/knowledge-base/curated-visuals.mjs`
- Regenerate: `10-knowledge-base/_assets/visuals/*.svg`

- [ ] **Step 1: Add shared low-level SVG primitives**

Add helpers near the existing `box`, `arrow`, and `pathArrow` helpers:

```js
function circleNode(cx, cy, r, title, options = {}) {
  const fill = options.fill ?? '#eff6ff'
  const stroke = options.stroke ?? '#2563eb'
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
${textBlock(title, cx, cy + 5, {
  size: options.titleSize ?? 14,
  weight: options.weight ?? 700,
  fill: options.fillText ?? '#172033',
  maxChars: options.titleChars ?? 12,
  maxLines: options.titleLines ?? 2
})}`
}

function polyline(points, color = '#2563eb', width = 3) {
  return `<polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function curve(d, color = '#2563eb', width = 3, marker = false) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${marker ? ' marker-end="url(#arrow)"' : ''}/>`
}

function miniMatrix(x, y, rows, cols, cell, active) {
  return matrixGrid(x, y, rows, cols, cell, active, {
    strong: '#2563eb',
    mid: '#bfdbfe'
  })
}
```

- [ ] **Step 2: Replace temporary aliases with named renderer functions**

Replace the temporary alias block from Task 3 with functions that use distinct compositions. Use the existing `frame(spec, inner)` wrapper, but vary the interior structure by kind:

```js
function renderClosedLoopControl(spec) {
  const nodes = spec.nodes
  return frame(spec, `
${box(114, 260, 190, 96, nodes[0] ?? 'state estimate', palette(0))}
${box(392, 190, 210, 92, nodes[1] ?? 'prediction model', palette(1))}
${box(676, 190, 210, 92, nodes[2] ?? 'constraints', palette(2))}
${box(958, 260, 220, 96, nodes[3] ?? 'QP/NLP solve', palette(3))}
${box(650, 454, 220, 96, nodes[4] ?? 'first control', palette(4))}
${arrow(304, 308, 388, 238)}
${arrow(604, 236, 672, 236)}
${arrow(888, 238, 954, 306)}
${pathArrow('M1068 358 C1030 500 864 520 874 502', '#16a34a', 3)}
${pathArrow('M650 502 C420 570 168 470 204 358', '#64748b', 2.5)}
${label('receding horizon closes the loop after each applied control', 700, 620, { maxChars: 68 })}
`)
}
```

Implement every renderer below as a real `function renderX(spec) { return frame(spec, `...`) }` declaration. Each function must include at least one SVG comment marker in its returned `inner` string using `<!-- layout:<diagram-kind> -->`, and no function in this list may simply return `renderPipeline(spec)`, `renderMatrix(spec)`, `renderGeometry(spec)`, `renderTimeline(spec)`, or `renderConceptMap(spec)`.

Required layout contents for each renderer:

- `renderRoadCorridorGeometry`: curved centerline, Frenet axes, sampled offset bands, vehicle envelope, collision corridor.
- `renderBeliefUpdateLoop`: hidden state, action, observation, Bayes update, belief distribution, policy/value loop.
- `renderDynamicsModelLadder`: stacked model-fidelity ladder with tire/slip branch and controller diagnostics.
- `renderMeasurementChain`: left-to-right physical sensor chain with noise injection and covariance output.
- `renderProjectionRays`: camera frustum, landmark rays, PnP pose triangle, reprojection residual ticks.
- `renderTransformTree`: tree layout with map/odom/base/sensor/image nodes and transform arrows.
- `renderSearchAndGating`: query point, spatial buckets/KD partitions, gate ellipse, accepted/rejected candidates.
- `renderTimingSync`: multi-lane timing diagram with staggered sensor events and offset correction.
- `renderGeodesyChain`: WGS84/ECEF/ENU/projection chain over a map grid with distortion callout.
- `renderBeamNoiseModel`: emitted beam, return path, incidence/weather dropout, range-noise distribution.
- `renderManifoldLinearization`: manifold surface, tangent plane, Exp/log arrows, residual Jacobian.
- `renderFactorGraph`: variable circles and factor squares with elimination/marginalization highlight.
- `renderRegistrationComparison`: three columns for ICP, GICP, and NDT with residual arrows.
- `renderTensorPipeline`: point/token input, grid/tensor, pooling, BEV/patch map, head output.
- `renderRenderingComparison`: split NeRF ray sampling and Gaussian splat rasterization.
- `renderAttentionMatrix`: Q/K/V lanes, score matrix, mask, softmax, value mixing.
- `renderLatentArchitecture`: encoder, latent bottleneck/codebook, decoder, loss terms.
- `renderComputationalGraph`: forward DAG with reverse gradient arrows and graph-break marker.
- `renderEmbeddingSpace`: 2D embedding scatter with anchor-positive-negative and similarity matrix.
- `renderReceptiveField`: kernel over grid, stride/padding, dilation, feature-pyramid growth.
- `renderGenerativeTrajectory`: noise-to-data trajectory with forward/reverse arrows and sampler steps.
- `renderObjectiveLandscape`: contour landscape with trajectory, minima, negatives, or loss terms.
- `renderEvaluationFirewall`: train/validation/test/calibration partitions with leakage arrows blocked.
- `renderTrainingLifecycle`: data mixture, tokenizer, pretraining, adaptation, evaluation, contamination control.
- `renderSignalFlowDepth`: depth stack with activation/gradient variance ribbons.
- `renderTokenGrid`: patch/voxel/token grid with mask, position encoding, and quantization cells.
- `renderDecisionBoundary`: feature-space points, separating hyperplane, margin/update vector.
- `renderArchitectureComparison`: side-by-side mechanisms with shared input/output anchors.
- `renderSparseAttentionMap`: 3D point/voxel windows with sparse neighbor links and BEV aggregation.
- `renderWorldModelRollout`: sense-latent-dynamics-imagination-planner loop with future rollouts.
- `renderOccupancyMapUpdate`: ray traversal over grid, log-odds update, dynamic cells.
- `renderRepresentationComparison`: four representation panels for occupancy, TSDF/ESDF, octree, surfels.
- `renderNumericalFactorization`: residual/Jacobian to factorization to triangular solve path.
- `renderMatrixStructure`: sparse matrix/fill/eigenspectrum layout with highlighted modes.
- `renderSolverLoop`: residual, linearization, sparse solve, update, convergence loop.
- `renderOptimizationStepGeometry`: trust-region or LM step geometry with accept/reject ratio.
- `renderProbabilityThresholds`: score distributions, threshold line, confusion matrix, ROC/PR curve.
- `renderUncertaintyGeometry`: covariance ellipse, whitening transform, gate, calibrated interval.
- `renderInformationMap`: relationship graph for entropy, KL, MI, compression, value.
- `renderDensityMixture`: multimodal density curve, component weights, collapse warning.
- `renderMapAndPlanningStack`: layered route/behavior/motion/map/regulatory stack.
- `renderSignalProcessingChain`: waveform/samples/FFT/filter/threshold pipeline.
- `renderRadarMap`: chirp/range-Doppler/angle map with ambiguity region.
- `renderFilterUpdateLoop`: predict/update loop with prior, measurement, posterior.
- `renderStateEstimationChain`: sensor residuals, factors, smoother/filter, state/covariance.
- `renderSystemsMap`: architecture dependency map with operational/assurance feedback.
- `renderBenchmarkSplitFirewall`: dataset split firewall with metrics and statistical validity checks.
- `renderErrorBudget`: source-to-budget-to-fusion-to-diagnostic propagation.
```

This task is complete only when the temporary aliases are gone and each renderer function exists as a real `function renderX(spec) { ... }` declaration.

- [ ] **Step 3: Generate visuals**

Run:

```powershell
node tools/knowledge-base/curated-visuals.mjs
```

Expected output:

```text
Wrote 99 curated knowledge-base visuals.
```

- [ ] **Step 4: Inspect representative SVGs for structural variety**

Open or inspect these assets:

```powershell
Get-Content 10-knowledge-base\_assets\visuals\controls-constrained-optimization-mpc-ilqr-first-principles.svg -TotalCount 80
Get-Content 10-knowledge-base\_assets\visuals\machine-learning-attention-transformers-first-principles.svg -TotalCount 80
Get-Content 10-knowledge-base\_assets\visuals\signal-processing-radar-fmcw-mimo-doppler.svg -TotalCount 80
Get-Content 10-knowledge-base\_assets\visuals\state-estimation-gtsam-factor-graphs.svg -TotalCount 80
```

Expected: root SVGs all have `data-diagram-kind`, and the interior markup is structurally different across the samples.

---

### Task 5: Verify, Commit, Push, And Redeploy

**Files:**
- All changed files from Tasks 1-4.

- [ ] **Step 1: Run focused content tests**

Run:

```powershell
node --test tests/content-smoke.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm test
```

Expected: PASS with 38 or more tests, depending on the final test count.

- [ ] **Step 3: Run the docs build**

Run:

```powershell
npm run docs:build
```

Expected: PASS. Existing warnings for `dbc`, `smt2`, and large chunks are acceptable if the process exits 0.

- [ ] **Step 4: Run staged whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. Windows CRLF notices are acceptable only if the command exits 0.

- [ ] **Step 5: Commit the taxonomy visual rebuild**

Run:

```powershell
git status --short
git add tests/content-smoke.test.mjs tools/knowledge-base/visual-taxonomy.mjs tools/knowledge-base/curated-visuals.mjs 10-knowledge-base/_assets/visuals docs/superpowers/plans/2026-05-09-knowledge-base-taxonomy-visuals.md
git commit -m "docs: diversify knowledge base visuals"
```

Expected: commit succeeds and includes the taxonomy module, generator refactor, regenerated SVGs, tests, and this plan.

- [ ] **Step 6: Push and watch redeploy**

Run:

```powershell
git push origin main
gh run list --branch main --limit 3
```

Find the new `Deploy VitePress site to Pages` run ID, then run:

```powershell
gh run watch <run-id> --exit-status
```

Expected: deploy workflow completes with `success`.

---

## Self-Review

- Spec coverage: covers explicit taxonomy mapping, stable Markdown contract, same SVG asset paths, metadata, tests, deterministic generation, and Pages redeploy.
- Scope check: one subsystem only, the knowledge-base visual generator and generated SVGs.
- Test-first coverage: Task 1 adds RED tests before taxonomy and renderer changes.
- No page URL changes: plan preserves all Markdown file paths and SVG filenames.
- No raster images: all output remains inline SVG.
