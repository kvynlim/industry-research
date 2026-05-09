# Knowledge Base Curated Figures Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the most mismatched knowledge-base SVG figures with targeted diagrams for the highest-impact pages identified in the May 9 audit.

**Architecture:** Add a deterministic Node-based generator for a curated batch of SVG diagrams and Markdown figure-block replacements. Tests define the contract for priority pages: they must keep valid local SVG figure blocks and must not use generic template captions in the targeted figure set.

**Tech Stack:** Node.js ESM scripts, Markdown files, inline SVG assets, `node:test`, VitePress content smoke tests.

**Execution note:** The current knowledge-base files use unkeyed `<!-- kb-figure:start -->` / `<!-- kb-figure:end -->` markers and one primary figure block per target page. Batch 1 execution therefore matches figure blocks by existing asset path, keeps the current asset basenames stable, and validates nine targeted page-level captions rather than marker-specific multi-figure replacements.

---

## File Structure

- Create: `tools/knowledge-base/curated-figures-batch-1.mjs`
  - Owns the curated batch specs, SVG rendering helpers, and Markdown figure-block replacement logic.
  - Writes only the assets and figure blocks listed in this plan.
- Modify: `tests/content-smoke.test.mjs`
  - Adds regression checks for the priority pages so generic captions cannot silently return.
- Modify: priority Markdown pages:
  - `10-knowledge-base/geometry-3d/pointpillars.md`
  - `10-knowledge-base/systems-engineering/signal-processing-weather.md`
  - `10-knowledge-base/systems-engineering/theoretical-foundations.md`
  - `10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md`
  - `10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md`
  - `10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md`
  - `10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md`
  - `10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md`
  - `10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md`
- Modify/create SVG assets under: `10-knowledge-base/_assets/figures/`
  - Use the existing file names referenced by the targeted Markdown blocks where possible, so links stay stable.

---

### Task 1: Add Failing Regression Checks For Batch 1 Curated Captions

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Add the failing test**

Append this test after `knowledge-base pages include local explanatory figures`:

```js
test('batch 1 curated knowledge-base figures keep targeted captions', () => {
  const expectedFigures = [
    {
      file: '10-knowledge-base/geometry-3d/pointpillars.md',
      marker: 'pointpillars-from-point-cloud-to-bev-features-every-step-with-tensor-shapes-1',
      caption: 'PointPillars converts raw `(N, 4)` points into bounded pillar tensors, pooled pillar features, a BEV pseudo-image, and detector or world-model outputs.'
    },
    {
      file: '10-knowledge-base/geometry-3d/pointpillars.md',
      marker: 'pointpillars-core-insight-2',
      caption: 'The core speedup is to pool points inside vertical pillars first, then run efficient 2D convolution on the scattered BEV pseudo-image.'
    },
    {
      file: '10-knowledge-base/geometry-3d/pointpillars.md',
      marker: 'pointpillars-architecture-step-by-step-3',
      caption: 'The architecture stages line up with concrete tensor operations: augmented point features, PFN encoding, order-invariant pooling, BEV scatter, and detection heads.'
    },
    {
      file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
      marker: 'signal-processing-weather-methodology-1',
      caption: 'The weather-processing recommendations form a chain from dual-return evidence through DSOR/LIOR cleanup, temporal filtering, severity classification, and degraded-mode response.'
    },
    {
      file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
      marker: 'signal-processing-weather-recommendation-5-intensity-calibration-and-range-normalization-3',
      caption: 'Weather severity should be represented as a hysteretic state machine so SOR, LIOR, range limits, and planner behavior change only after stable evidence.'
    },
    {
      file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
      marker: 'signal-processing-weather-recommendation-30-jet-blast-and-engine-exhaust-zone-modeling-4',
      caption: 'Jet-exhaust filtering should combine a configured engine cone with low-intensity and temporal-flicker evidence before downweighting points.'
    },
    {
      file: '10-knowledge-base/systems-engineering/theoretical-foundations.md',
      marker: 'theoretical-foundations-mathematical-frameworks-formal-results-and-theoretical-analysis-1',
      caption: 'The theoretical foundations page connects world-model formalism to predictive coding, representation theory, causality, control, games, and safety-critical ML evidence.'
    },
    {
      file: '10-knowledge-base/systems-engineering/theoretical-foundations.md',
      marker: 'theoretical-foundations-predictive-coding-and-active-inference-3',
      caption: 'Predictive coding closes a loop among latent state, predicted observations, prediction error, state updates, and action selection.'
    },
    {
      file: '10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md',
      marker: 'cholesky-ldlt-normal-equations-why-it-matters-for-av-perception-slam-and-mapping-1',
      caption: 'Normal equations turn residual Jacobians into an SPD system only when the problem is well constrained; Cholesky and LDLT expose conditioning and indefiniteness.'
    },
    {
      file: '10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md',
      marker: 'eigenvalues-hessian-conditioning-observability-why-it-matters-for-av-perception-slam-and-mapping-1',
      caption: 'The Hessian spectrum separates well-constrained directions, weakly constrained directions, and nullspaces that require damping, priors, or better excitation.'
    },
    {
      file: '10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md',
      marker: 'qr-svd-rank-revealing-solvers-why-it-matters-for-av-perception-slam-and-mapping-1',
      caption: 'QR and SVD solve least-squares problems while exposing rank and nullspace structure that normal equations can hide.'
    },
    {
      file: '10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md',
      marker: 'schur-complement-marginalization-pcg-why-it-matters-for-av-perception-slam-and-mapping-1',
      caption: 'The Schur complement removes landmarks or nuisance states to produce a smaller reduced system for pose solving, marginalization, or PCG.'
    },
    {
      file: '10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md',
      marker: 'sparse-matrices-fill-in-ordering-why-it-matters-for-av-perception-slam-and-mapping-1',
      caption: 'Variable ordering changes fill-in during sparse factorization, directly affecting memory, runtime, and whether real-time SLAM remains feasible.'
    },
    {
      file: '10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md',
      marker: 'square-root-information-and-covariance-recovery-why-it-matters-for-av-perception-slam-and-mapping-1',
      caption: 'Square-root information methods preserve numerical stability by carrying factored information matrices and recovering selected marginal covariances only when needed.'
    }
  ]

  const genericCaptionPatterns = [
    /shows the tradeoff or curve shape behind/i,
    /shows the section flow from design choice -> tuning knob -> runtime check -> log signal/i,
    /shows the matrix or attention structure behind/i,
    /shows the layered responsibilities from state -> action -> observation -> belief update/i,
    /shows the geometric relationship among input evidence ->/i,
    /shows the geometric relationship among laser pulse -> time of flight -> beam angle -> reflectance/i,
    /shows the temporal ordering from state -> action -> observation -> belief update/i
  ]

  const failures = []

  for (const expected of expectedFigures) {
    const absPath = path.join(repoRoot, expected.file)
    const markdown = fs.readFileSync(absPath, 'utf8')
    const blockPattern = new RegExp(`<!-- kb-figure:start ${expected.marker} -->[\\s\\S]*?<!-- kb-figure:end -->`)
    const block = markdown.match(blockPattern)?.[0]

    if (!block) {
      failures.push(`${expected.file}: missing figure marker ${expected.marker}`)
      continue
    }

    if (!block.includes(`*Figure: ${expected.caption}*`)) {
      failures.push(`${expected.file}: marker ${expected.marker} missing curated caption`)
    }

    if (genericCaptionPatterns.some((pattern) => pattern.test(block))) {
      failures.push(`${expected.file}: marker ${expected.marker} still has a generic caption`)
    }
  }

  assert.deepEqual(failures, [])
})
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm test -- tests/content-smoke.test.mjs
```

Expected: FAIL. At least `pointpillars.md`, `signal-processing-weather.md`, `theoretical-foundations.md`, and the numerical linear algebra pages should report generic captions.

---

### Task 2: Create The Curated Batch Generator Skeleton

**Files:**
- Create: `tools/knowledge-base/curated-figures-batch-1.mjs`

- [ ] **Step 1: Write the generator skeleton**

Create the file with this initial content:

```js
#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const figureRoot = path.join(repoRoot, '10-knowledge-base', '_assets', 'figures')

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function wrapText(value, maxChars = 20) {
  const words = String(value).split(/\s+/)
  const lines = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, 3)
}

function textLines(label, x, y, options = {}) {
  const size = options.size ?? 18
  const weight = options.weight ?? 700
  const fill = options.fill ?? '#111827'
  const anchor = options.anchor ?? 'middle'
  return wrapText(label, options.maxChars ?? 18)
    .map((line, index) => `<text x="${x}" y="${y + index * size * 1.18}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`)
    .join('\n')
}

function box(x, y, width, height, label, fill = '#e0f2fe') {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${fill}" stroke="#1f2937" stroke-width="1.8"/>
${textLines(label, x + width / 2, y + height / 2 - 6, { maxChars: 18 })}`
}

function arrow(x1, y1, x2, y2, color = '#2563eb') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3.5" stroke-linecap="round" marker-end="url(#arrow)"/>`
}

function frame(title, subtitle, desc, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#2563eb"/>
    </marker>
  </defs>
  <rect width="1200" height="620" fill="#f8fafc"/>
  <rect x="36" y="34" width="1128" height="552" rx="20" fill="#ffffff" stroke="#d1d5db"/>
  <text x="70" y="86" font-size="30" font-weight="800" fill="#111827">${escapeXml(title)}</text>
  <text x="70" y="120" font-size="17" font-weight="600" fill="#475569">${escapeXml(subtitle)}</text>
  <rect x="70" y="140" width="1060" height="2" fill="#dbeafe"/>
  ${inner}
</svg>
`
}

function replaceFigure(markdown, markerId, block) {
  const pattern = new RegExp(`<!-- kb-figure:start ${markerId} -->[\\\\s\\\\S]*?<!-- kb-figure:end -->`)
  if (!pattern.test(markdown)) {
    throw new Error(`Missing figure marker: ${markerId}`)
  }
  return markdown.replace(pattern, block)
}

const figures = []

fs.mkdirSync(figureRoot, { recursive: true })

for (const spec of figures) {
  const markdownPath = path.join(repoRoot, spec.file)
  const assetPath = path.join(repoRoot, spec.asset)
  const markdown = fs.readFileSync(markdownPath, 'utf8')
  const block = `<!-- kb-figure:start ${spec.marker} -->
![${spec.alt}](../_assets/figures/${path.basename(spec.asset)})

*Figure: ${spec.caption}*
<!-- kb-figure:end -->`

  fs.writeFileSync(assetPath, spec.svg, 'utf8')
  fs.writeFileSync(markdownPath, replaceFigure(markdown, spec.marker, block), 'utf8')
}

console.log(`Updated ${figures.length} curated knowledge-base figures.`)
```

- [ ] **Step 2: Run the empty generator**

Run:

```powershell
node tools/knowledge-base/curated-figures-batch-1.mjs
```

Expected: PASS with `Updated 0 curated knowledge-base figures.`

---

### Task 3: Curate PointPillars Figures

**Files:**
- Modify: `tools/knowledge-base/curated-figures-batch-1.mjs`
- Modify: `10-knowledge-base/geometry-3d/pointpillars.md`
- Modify/create:
  - `10-knowledge-base/_assets/figures/geometry-3d-pointpillars-01-from-point-cloud-to-bev-features-every-step-with-tensor-shapes.svg`
  - `10-knowledge-base/_assets/figures/geometry-3d-pointpillars-02-core-insight.svg`
  - `10-knowledge-base/_assets/figures/geometry-3d-pointpillars-03-architecture-step-by-step.svg`

- [ ] **Step 1: Add renderer helpers**

Add these functions before `const figures = []`:

```js
function renderPointPillarsPipeline() {
  const labels = [
    ['Raw points', '(N, 4)'],
    ['Pillarize x-y grid', '(M, P, 9)'],
    ['PFN + max pool', '(M, 64)'],
    ['Scatter to BEV', '(64, H, W)'],
    ['2D backbone', '(384, H/2, W/2)'],
    ['Detection or world model', 'boxes / BEV tokens']
  ]
  const x0 = 78
  const y = 238
  const width = 160
  const gap = 28
  const parts = labels.map(([name, shape], index) => {
    const x = x0 + index * (width + gap)
    const link = index < labels.length - 1 ? arrow(x + width + 4, y + 54, x + width + gap - 6, y + 54) : ''
    return `${box(x, y, width, 108, name, '#dbeafe')}
<text x="${x + width / 2}" y="${y + 84}" text-anchor="middle" font-size="15" font-weight="700" fill="#475569">${escapeXml(shape)}</text>
${link}`
  }).join('\n')
  return frame(
    'PointPillars Tensor Path',
    'PointPillars: First Principles',
    'Raw unordered LiDAR points become fixed-shape pillar tensors, pooled pillar features, a BEV pseudo-image, and either detections or world-model tokens.',
    `${parts}
<text x="600" y="420" text-anchor="middle" font-size="18" font-weight="700" fill="#0f766e">The key compression is vertical: z stays in pillar features while convolution runs in BEV.</text>`
  )
}

function renderPointPillarsCoreInsight() {
  return frame(
    'Pillars Replace 3D Voxels With A BEV Pseudo-Image',
    'PointPillars: First Principles',
    'The model avoids expensive 3D convolutions by pooling each vertical pillar and then using standard 2D convolution over the ground plane.',
    `${box(105, 250, 210, 100, '3D voxel CNN', '#fee2e2')}
${box(495, 185, 210, 100, 'Pillar feature net', '#dbeafe')}
${box(495, 350, 210, 100, 'BEV pseudo-image', '#dcfce7')}
${box(875, 250, 210, 100, '2D CNN detector', '#fef3c7')}
${arrow(318, 300, 490, 235)}
${arrow(600, 288, 600, 348, '#0f766e')}
${arrow(708, 400, 870, 300)}
<text x="210" y="390" text-anchor="middle" font-size="17" font-weight="700" fill="#991b1b">accurate but expensive</text>
<text x="600" y="500" text-anchor="middle" font-size="18" font-weight="700" fill="#166534">fast path: set pooling inside pillars, convolution across BEV cells</text>`
  )
}

function renderPointPillarsArchitecture() {
  const rows = [
    ['Point features', 'x, y, z, intensity, offsets'],
    ['PFN layer', 'linear + BN + ReLU'],
    ['Symmetric pooling', 'order-invariant max over points'],
    ['Scatter', 'pillar coordinates place features'],
    ['Heads', 'classification, box, direction']
  ]
  const parts = rows.map(([left, right], index) => {
    const y = 175 + index * 74
    return `${box(155, y, 270, 58, left, '#e0f2fe')}
${box(650, y, 310, 58, right, '#ecfccb')}
${arrow(430, y + 29, 645, y + 29)}`
  }).join('\n')
  return frame(
    'Architecture Step By Step',
    'PointPillars: First Principles',
    'Each row maps a conceptual stage in the explanation to the tensor operation that implements it.',
    parts
  )
}
```

- [ ] **Step 2: Add PointPillars specs**

Replace `const figures = []` with:

```js
const figures = [
  {
    file: '10-knowledge-base/geometry-3d/pointpillars.md',
    marker: 'pointpillars-from-point-cloud-to-bev-features-every-step-with-tensor-shapes-1',
    asset: '10-knowledge-base/_assets/figures/geometry-3d-pointpillars-01-from-point-cloud-to-bev-features-every-step-with-tensor-shapes.svg',
    alt: 'PointPillars tensor path from raw points to BEV features',
    caption: 'PointPillars converts raw `(N, 4)` points into bounded pillar tensors, pooled pillar features, a BEV pseudo-image, and detector or world-model outputs.',
    svg: renderPointPillarsPipeline()
  },
  {
    file: '10-knowledge-base/geometry-3d/pointpillars.md',
    marker: 'pointpillars-core-insight-2',
    asset: '10-knowledge-base/_assets/figures/geometry-3d-pointpillars-02-core-insight.svg',
    alt: 'PointPillars core insight: pillar pooling before BEV convolution',
    caption: 'The core speedup is to pool points inside vertical pillars first, then run efficient 2D convolution on the scattered BEV pseudo-image.',
    svg: renderPointPillarsCoreInsight()
  },
  {
    file: '10-knowledge-base/geometry-3d/pointpillars.md',
    marker: 'pointpillars-architecture-step-by-step-3',
    asset: '10-knowledge-base/_assets/figures/geometry-3d-pointpillars-03-architecture-step-by-step.svg',
    alt: 'PointPillars architecture stages and tensor operations',
    caption: 'The architecture stages line up with concrete tensor operations: augmented point features, PFN encoding, order-invariant pooling, BEV scatter, and detection heads.',
    svg: renderPointPillarsArchitecture()
  }
]
```

- [ ] **Step 3: Run generator**

Run:

```powershell
node tools/knowledge-base/curated-figures-batch-1.mjs
```

Expected: `Updated 3 curated knowledge-base figures.`

- [ ] **Step 4: Run targeted test**

Run:

```powershell
npm test -- tests/content-smoke.test.mjs
```

Expected: still FAIL, but no failures for `10-knowledge-base/geometry-3d/pointpillars.md`.

---

### Task 4: Curate Systems Engineering Priority Pages

**Files:**
- Modify: `tools/knowledge-base/curated-figures-batch-1.mjs`
- Modify:
  - `10-knowledge-base/systems-engineering/signal-processing-weather.md`
  - `10-knowledge-base/systems-engineering/theoretical-foundations.md`

- [ ] **Step 1: Add systems renderers**

Add these functions before `const figures`:

```js
function renderWeatherChain() {
  const stages = ['RS32 dual returns', 'DSOR / LIOR', 'Temporal filter', 'Weather state', 'Planner / health response']
  const parts = stages.map((stage, index) => {
    const x = 90 + index * 210
    return `${box(x, 250, 170, 92, stage, index % 2 ? '#dcfce7' : '#dbeafe')}
${index < stages.length - 1 ? arrow(x + 174, 296, x + 202, 296) : ''}`
  }).join('\n')
  return frame(
    'Weather-Robust Signal Processing Chain',
    'Signal Processing And Weather Operation',
    'Adverse-weather handling is a chain: preserve useful returns, remove weather artifacts, stabilize over time, classify severity, and publish degraded-mode evidence.',
    `${parts}
<text x="600" y="430" text-anchor="middle" font-size="18" font-weight="700" fill="#0f766e">Filtering decisions become operational evidence, not just cleaner point clouds.</text>`
  )
}

function renderWeatherStateMachine() {
  return frame(
    'Adaptive Weather State Machine',
    'Signal Processing And Weather Operation',
    'Weather state should change through hysteresis so perception parameters do not oscillate when rain, fog, or exhaust signatures fluctuate.',
    `${box(120, 250, 160, 86, 'CLEAR', '#dcfce7')}
${box(390, 180, 180, 86, 'LIGHT PRECIP', '#fef3c7')}
${box(390, 365, 180, 86, 'HEAVY PRECIP', '#fee2e2')}
${box(700, 180, 170, 86, 'FOG', '#e0e7ff')}
${box(700, 365, 170, 86, 'EXHAUST', '#fde68a')}
${box(955, 270, 150, 86, 'DEGRADED MODE', '#fecaca')}
${arrow(282, 292, 386, 223)}
${arrow(282, 292, 386, 408)}
${arrow(573, 223, 696, 223)}
${arrow(573, 408, 696, 408)}
${arrow(873, 223, 950, 303)}
${arrow(873, 408, 950, 325)}
<text x="475" y="145" text-anchor="middle" font-size="16" font-weight="700" fill="#475569">3 high readings enter</text>
<text x="475" y="488" text-anchor="middle" font-size="16" font-weight="700" fill="#475569">5 low readings recover</text>`
  )
}

function renderExhaustZone() {
  return frame(
    'Jet Exhaust Zone Geometry',
    'Signal Processing And Weather Operation',
    'Exhaust filtering combines geometry and signal evidence: only points inside an engine cone with low intensity and low temporal persistence are downweighted.',
    `<rect x="130" y="280" width="230" height="86" rx="16" fill="#d1d5db" stroke="#111827" stroke-width="2"/>
<text x="245" y="330" text-anchor="middle" font-size="20" font-weight="800" fill="#111827">aircraft stand</text>
<circle cx="350" cy="325" r="16" fill="#ef4444"/>
<polygon points="366,325 1030,165 1030,485" fill="#fee2e2" opacity="0.65" stroke="#ef4444" stroke-width="3"/>
${box(520, 190, 180, 76, 'low intensity', '#fef3c7')}
${box(610, 380, 210, 76, 'temporal flicker', '#dbeafe')}
${box(860, 275, 200, 76, 'downweight only in cone', '#dcfce7')}
${arrow(704, 228, 855, 300)}
${arrow(824, 418, 858, 342)}`
  )
}

function renderTheoryMap() {
  return frame(
    'World-Model Theory Dependency Map',
    'Theoretical Foundations Of World Models',
    'The page ties world-model formalism to prediction, representation, causality, game theory, control, and safety evidence.',
    `${box(485, 180, 230, 80, 'World-model formalism', '#dbeafe')}
${box(145, 330, 190, 76, 'Predictive coding', '#dcfce7')}
${box(365, 330, 190, 76, 'Representation theory', '#fef3c7')}
${box(585, 330, 190, 76, 'Causality', '#ede9fe')}
${box(805, 330, 190, 76, 'Control and games', '#fee2e2')}
${box(485, 465, 230, 76, 'Safety-critical ML', '#fecaca')}
${arrow(600, 262, 240, 328)}
${arrow(600, 262, 460, 328)}
${arrow(600, 262, 680, 328)}
${arrow(600, 262, 900, 328)}
${arrow(460, 408, 555, 462)}
${arrow(680, 408, 630, 462)}
${arrow(900, 408, 690, 462)}`
  )
}

function renderPredictiveCodingLoop() {
  return frame(
    'Predictive Coding And Active Inference Loop',
    'Theoretical Foundations Of World Models',
    'A predictive world model repeatedly predicts observations, measures prediction error, updates latent state, and selects actions to reduce expected error.',
    `${box(125, 250, 180, 86, 'latent state', '#dbeafe')}
${box(385, 170, 190, 86, 'predict observation', '#dcfce7')}
${box(650, 250, 190, 86, 'prediction error', '#fef3c7')}
${box(385, 390, 190, 86, 'state update', '#ede9fe')}
${box(900, 250, 170, 86, 'action policy', '#fee2e2')}
${arrow(308, 292, 380, 215)}
${arrow(578, 215, 645, 292)}
${arrow(650, 315, 580, 420)}
${arrow(382, 420, 220, 337)}
${arrow(842, 292, 895, 292)}
<path d="M985 248 C940 120 270 120 215 248" fill="none" stroke="#0f766e" stroke-width="3.5" marker-end="url(#arrow)"/>`
  )
}
```

- [ ] **Step 2: Append systems specs**

Append these objects to `figures`:

```js
{
  file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
  marker: 'signal-processing-weather-methodology-1',
  asset: '10-knowledge-base/_assets/figures/systems-engineering-signal-processing-weather-01-methodology.svg',
  alt: 'Weather robust signal processing chain',
  caption: 'The weather-processing recommendations form a chain from dual-return evidence through DSOR/LIOR cleanup, temporal filtering, severity classification, and degraded-mode response.',
  svg: renderWeatherChain()
},
{
  file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
  marker: 'signal-processing-weather-recommendation-5-intensity-calibration-and-range-normalization-3',
  asset: '10-knowledge-base/_assets/figures/systems-engineering-signal-processing-weather-03-recommendation-5-intensity-calibration-and-range-normalization.svg',
  alt: 'Adaptive weather state machine for perception parameters',
  caption: 'Weather severity should be represented as a hysteretic state machine so SOR, LIOR, range limits, and planner behavior change only after stable evidence.',
  svg: renderWeatherStateMachine()
},
{
  file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
  marker: 'signal-processing-weather-recommendation-30-jet-blast-and-engine-exhaust-zone-modeling-4',
  asset: '10-knowledge-base/_assets/figures/systems-engineering-signal-processing-weather-04-recommendation-30-jet-blast-and-engine-exhaust-zone-modeling.svg',
  alt: 'Jet exhaust cone filtering geometry',
  caption: 'Jet-exhaust filtering should combine a configured engine cone with low-intensity and temporal-flicker evidence before downweighting points.',
  svg: renderExhaustZone()
},
{
  file: '10-knowledge-base/systems-engineering/theoretical-foundations.md',
  marker: 'theoretical-foundations-mathematical-frameworks-formal-results-and-theoretical-analysis-1',
  asset: '10-knowledge-base/_assets/figures/systems-engineering-theoretical-foundations-01-mathematical-frameworks-formal-results-and-theoretical-analysis.svg',
  alt: 'World model theory dependency map',
  caption: 'The theoretical foundations page connects world-model formalism to predictive coding, representation theory, causality, control, games, and safety-critical ML evidence.',
  svg: renderTheoryMap()
},
{
  file: '10-knowledge-base/systems-engineering/theoretical-foundations.md',
  marker: 'theoretical-foundations-predictive-coding-and-active-inference-3',
  asset: '10-knowledge-base/_assets/figures/systems-engineering-theoretical-foundations-03-predictive-coding-and-active-inference.svg',
  alt: 'Predictive coding and active inference loop',
  caption: 'Predictive coding closes a loop among latent state, predicted observations, prediction error, state updates, and action selection.',
  svg: renderPredictiveCodingLoop()
}
```

- [ ] **Step 3: Run generator and targeted test**

Run:

```powershell
node tools/knowledge-base/curated-figures-batch-1.mjs
npm test -- tests/content-smoke.test.mjs
```

Expected: test still FAILS because the numerical linear algebra captions have not been replaced yet.

---

### Task 5: Curate Numerical Linear Algebra Figures

**Files:**
- Modify: `tools/knowledge-base/curated-figures-batch-1.mjs`
- Modify: all six `10-knowledge-base/numerical-linear-algebra/*.md` files

- [ ] **Step 1: Add numerical renderers**

Add reusable renderers:

```js
function renderBlockMatrix(title, subtitle, desc, labels) {
  return frame(
    title,
    subtitle,
    desc,
    `<rect x="145" y="180" width="330" height="260" fill="#f8fafc" stroke="#111827" stroke-width="3"/>
<rect x="145" y="180" width="165" height="130" fill="#dbeafe" stroke="#111827" stroke-width="2"/>
<rect x="310" y="180" width="165" height="130" fill="#fef3c7" stroke="#111827" stroke-width="2"/>
<rect x="145" y="310" width="165" height="130" fill="#fef3c7" stroke="#111827" stroke-width="2"/>
<rect x="310" y="310" width="165" height="130" fill="#dcfce7" stroke="#111827" stroke-width="2"/>
${textLines(labels[0], 228, 255)}
${textLines(labels[1], 393, 255)}
${textLines(labels[2], 228, 385)}
${textLines(labels[3], 393, 385)}
${box(645, 205, 210, 80, labels[4], '#e0f2fe')}
${box(645, 345, 210, 80, labels[5], '#ede9fe')}
${box(930, 275, 160, 80, labels[6], '#fee2e2')}
${arrow(478, 310, 640, 245)}
${arrow(478, 310, 640, 385)}
${arrow(858, 245, 925, 310)}
${arrow(858, 385, 925, 330)}`
  )
}

function renderSpectrum(title, subtitle, desc) {
  return frame(
    title,
    subtitle,
    desc,
    `<line x1="145" y1="455" x2="1040" y2="455" stroke="#111827" stroke-width="4" marker-end="url(#arrow)"/>
<line x1="145" y1="455" x2="145" y2="160" stroke="#111827" stroke-width="4" marker-end="url(#arrow)"/>
<rect x="225" y="210" width="55" height="245" fill="#2563eb"/>
<rect x="355" y="260" width="55" height="195" fill="#2563eb"/>
<rect x="485" y="340" width="55" height="115" fill="#60a5fa"/>
<rect x="615" y="405" width="55" height="50" fill="#f59e0b"/>
<rect x="745" y="435" width="55" height="20" fill="#ef4444"/>
<rect x="875" y="445" width="55" height="10" fill="#991b1b"/>
${box(190, 505, 150, 55, 'well constrained', '#dbeafe')}
${box(575, 505, 150, 55, 'weak direction', '#fef3c7')}
${box(830, 505, 150, 55, 'nullspace risk', '#fee2e2')}`
  )
}
```

- [ ] **Step 2: Append numerical specs**

Append specs that replace the first two figures in each numerical linear algebra page with:

```js
{
  file: '10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md',
  marker: 'cholesky-ldlt-normal-equations-why-it-matters-for-av-perception-slam-and-mapping-1',
  asset: '10-knowledge-base/_assets/figures/numerical-linear-algebra-cholesky-ldlt-normal-equations-01-why-it-matters-for-av-perception-slam-and-mapping.svg',
  alt: 'Normal equation factorization path',
  caption: 'Normal equations turn residual Jacobians into an SPD system only when the problem is well constrained; Cholesky and LDLT expose conditioning and indefiniteness.',
  svg: renderBlockMatrix('Normal Equation Factorization Path', 'Cholesky, LDLT, and Normal Equations', 'Least-squares solvers form J transpose J, check positive definiteness, factor the matrix, and backsolve only when conditioning allows it.', ['JtJ', 'Jtr', 'rhs', 'damping', 'SPD / LDLT check', 'factorization', 'backsolve'])
},
{
  file: '10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md',
  marker: 'eigenvalues-hessian-conditioning-observability-why-it-matters-for-av-perception-slam-and-mapping-1',
  asset: '10-knowledge-base/_assets/figures/numerical-linear-algebra-eigenvalues-hessian-conditioning-observability-01-why-it-matters-for-av-perception-slam-and-mapping.svg',
  alt: 'Hessian spectrum and observability',
  caption: 'The Hessian spectrum separates well-constrained directions, weakly constrained directions, and nullspaces that require damping, priors, or better excitation.',
  svg: renderSpectrum('Hessian Spectrum And Observability', 'Eigenvalues, Hessian Conditioning, and Observability', 'Eigenvalues reveal whether state directions are constrained by the measurement geometry or hidden in the estimator nullspace.')
},
{
  file: '10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md',
  marker: 'qr-svd-rank-revealing-solvers-why-it-matters-for-av-perception-slam-and-mapping-1',
  asset: '10-knowledge-base/_assets/figures/numerical-linear-algebra-qr-svd-rank-revealing-solvers-01-why-it-matters-for-av-perception-slam-and-mapping.svg',
  alt: 'QR and SVD rank revealing solver choices',
  caption: 'QR and SVD solve least-squares problems while exposing rank and nullspace structure that normal equations can hide.',
  svg: renderBlockMatrix('Rank-Revealing Solver Choices', 'QR, SVD, and Rank-Revealing Solvers', 'Rank-revealing solvers factor the Jacobian directly so weak columns and nullspace directions remain visible.', ['J', 'Q', 'R', 'singular values', 'rank threshold', 'least-squares solve', 'nullspace'])
},
{
  file: '10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md',
  marker: 'schur-complement-marginalization-pcg-why-it-matters-for-av-perception-slam-and-mapping-1',
  asset: '10-knowledge-base/_assets/figures/numerical-linear-algebra-schur-complement-marginalization-pcg-01-why-it-matters-for-av-perception-slam-and-mapping.svg',
  alt: 'Schur complement elimination flow',
  caption: 'The Schur complement removes landmarks or nuisance states to produce a smaller reduced system for pose solving, marginalization, or PCG.',
  svg: renderBlockMatrix('Schur Complement Elimination', 'Schur Complement, Marginalization, and PCG', 'Block elimination removes nuisance variables and leaves a smaller reduced system for the states that matter online.', ['pose block', 'cross terms', 'landmark cross', 'landmark block', 'eliminate nuisance', 'reduced system', 'PCG solve'])
},
{
  file: '10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md',
  marker: 'sparse-matrices-fill-in-ordering-why-it-matters-for-av-perception-slam-and-mapping-1',
  asset: '10-knowledge-base/_assets/figures/numerical-linear-algebra-sparse-matrices-fill-in-ordering-01-why-it-matters-for-av-perception-slam-and-mapping.svg',
  alt: 'Sparse matrix fill-in and ordering effect',
  caption: 'Variable ordering changes fill-in during sparse factorization, directly affecting memory, runtime, and whether real-time SLAM remains feasible.',
  svg: renderBlockMatrix('Sparse Fill-In And Ordering', 'Sparse Matrices, Fill-In, and Ordering', 'The same sparse problem can be cheap or expensive depending on the elimination order and the fill-in it creates.', ['sparse graph', 'ordering', 'permutation', 'fill-in', 'eliminate variables', 'factor pattern', 'runtime'])
},
{
  file: '10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md',
  marker: 'square-root-information-and-covariance-recovery-why-it-matters-for-av-perception-slam-and-mapping-1',
  asset: '10-knowledge-base/_assets/figures/numerical-linear-algebra-square-root-information-and-covariance-recovery-01-why-it-matters-for-av-perception-slam-and-mapping.svg',
  alt: 'Square-root information workflow',
  caption: 'Square-root information methods preserve numerical stability by carrying factored information matrices and recovering selected marginal covariances only when needed.',
  svg: renderBlockMatrix('Square-Root Information Workflow', 'Square-Root Information and Covariance Recovery', 'QR factors and square-root information forms make estimation more stable than repeatedly materializing dense covariance.', ['residual J', 'QR factor', 'R matrix', 'sqrt info', 'selected marginal', 'backsolve', 'covariance'])
}
```

- [ ] **Step 3: Run generator and targeted test**

Run:

```powershell
node tools/knowledge-base/curated-figures-batch-1.mjs
npm test -- tests/content-smoke.test.mjs
```

Expected: fewer generic-caption failures. Remaining failures will point to priority pages needing additional replacements.

---

### Task 6: Run Full Verification And Inspect The Focused Diff

**Files:**
**Files:**
- Verify only

- [ ] **Step 1: Run generator and verify GREEN**

Run:

```powershell
node tools/knowledge-base/curated-figures-batch-1.mjs
npm test -- tests/content-smoke.test.mjs
```

Expected: PASS for `tests/content-smoke.test.mjs`.

- [ ] **Step 2: Run full repository verification**

Run:

```powershell
npm test
npm run docs:build
```

Expected:
- `npm test`: 35+ tests pass, 0 fail.
- `npm run docs:build`: exits 0 and renders VitePress without broken local SVG references.

- [ ] **Step 3: Inspect the focused diff**

Run:

```powershell
git diff -- tests/content-smoke.test.mjs tools/knowledge-base/curated-figures-batch-1.mjs 10-knowledge-base/geometry-3d/pointpillars.md 10-knowledge-base/systems-engineering/signal-processing-weather.md 10-knowledge-base/systems-engineering/theoretical-foundations.md 10-knowledge-base/numerical-linear-algebra
```

Expected: diff only contains the test, curated generator, targeted figure block captions/alts, and targeted SVG replacements for this batch.

---

## Self-Review

- Spec coverage: This plan implements the audit's recommended first pass for `pointpillars.md`, two systems-engineering pages, and the numerical linear algebra folder. `sparse-attention-3d-perception.md` and `gtsam-factor-graphs.md` remain for Batch 2 because they need more diagrams and would make this batch too wide.
- Open-ended scan: No task contains vague implementation steps. The test declares exact file, marker, and caption expectations for every Batch 1 figure.
- Type consistency: The generator uses plain objects with `file`, `marker`, `asset`, `alt`, `caption`, and `svg` fields across all tasks.
