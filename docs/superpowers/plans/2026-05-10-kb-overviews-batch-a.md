# Knowledge Base Overview Batch A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first six section overview pages with visuals, taxonomy assignments, manifest lines, and active contract tests.

**Architecture:** This phase activates the overview contract only for `controls`, `mapping`, `optimization`, `robotics`, `sensors`, and `signal-processing`. Each page gets one curated SVG, one taxonomy entry, one manifest entry, full local page inventory, applied links outside `10-knowledge-base`, review questions, and a diagnostic micro-case.

**Tech Stack:** Markdown, curated SVG assets, `tools/knowledge-base/visual-taxonomy.mjs`, Node.js tests, VitePress docs build.

---

## Files

- Create: `10-knowledge-base/controls/overview.md`
- Create: `10-knowledge-base/mapping/overview.md`
- Create: `10-knowledge-base/optimization/overview.md`
- Create: `10-knowledge-base/robotics/overview.md`
- Create: `10-knowledge-base/sensors/overview.md`
- Create: `10-knowledge-base/signal-processing/overview.md`
- Create: `10-knowledge-base/_assets/visuals/controls-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/mapping-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/optimization-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/robotics-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/sensors-overview.svg`
- Create: `10-knowledge-base/_assets/visuals/signal-processing-overview.svg`
- Modify: `tests/content-smoke.test.mjs`
- Modify: `tools/knowledge-base/visual-taxonomy.mjs`
- Modify: `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md`

## Preconditions

- `docs/superpowers/plans/2026-05-10-kb-overview-contract-navigation.md` has landed.
- `tests/content-smoke.test.mjs` defines `overviewFoldersWithContract`, `legacyOverviewContractExceptions`, `requiredOverviewHeadings`, `requiredProblemClasses`, `directPublicKnowledgeBaseFolders`, and the overview contract tests.
- `.vitepress/navigation.mjs` already links folder groups to `overview.md` when present.

## Required Page Contract

Every page in this batch must use this exact H2 order:

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

Every `Problem-Class Coverage` table must use this exact table shape:

```markdown
| Problem Class | Role Of This Foundation | Representative Applied Pages |
|---|---|---|
```

Every table must include these row labels exactly once:

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

In `Role Of This Foundation`, start every cell with `primary`, `supporting`, or `not central`, then add a section-specific explanation. Across the table, include 3-5 unique applied links outside `10-knowledge-base`; each applied link must include a reason phrase tied to review or debugging.

The `Core Sources` section must contain only sources directly used while writing the overview. If the overview is synthesized only from existing pages in the folder and no additional external source is opened, use this sentence:

```markdown
This overview synthesizes the section pages listed above; no additional external sources were used.
```

## Batch Page Briefs

| File | H1 | Visual file | Diagram kind | Core role | Diagnostic micro-case |
|---|---|---|---|---|---|
| `10-knowledge-base/controls/overview.md` | `# Control Foundations for Autonomy` | `controls-overview.svg` | `closed-loop-control` | Vehicle dynamics, trajectory tracking, MPC/iLQR, constraints, actuator limits, and safety filters. | A feasible-looking trajectory fails at the vehicle because curvature, acceleration, actuator delay, and tire limits were not represented in the controller contract. |
| `10-knowledge-base/mapping/overview.md` | `# Mapping Foundations for Autonomy` | `mapping-overview.svg` | `map-and-planning-stack` | Persistent environment representation, occupancy, semantic and volumetric maps, fusion, update policy, dynamic/static separation, and map QA. | A moved baggage cart becomes static infrastructure because map update policy lacks provenance and dynamic/static separation. |
| `10-knowledge-base/optimization/overview.md` | `# Optimization Foundations for Autonomy` | `optimization-overview.svg` | `solver-loop` | Objective construction, residuals, Jacobians, damping, trust regions, autodiff, manifold updates, and solver selection. | A calibration solve diverges because residual scales are inconsistent and the optimizer accepts steps outside the local linearization regime. |
| `10-knowledge-base/robotics/overview.md` | `# Robotics Foundations for Autonomy` | `robotics-overview.svg` | `systems-map` | Robot/task vocabulary, route/behavior/motion-planning layers, Lanelet2 concepts, embodiment assumptions, and planning handoff contracts. | A planner/controller bug is misdiagnosed because route selection, behavior choice, motion generation, and tracking control are treated as one planning block. |
| `10-knowledge-base/sensors/overview.md` | `# Sensor Foundations for Autonomy` | `sensors-overview.svg` | `error-budget` | Cross-modality measurement likelihoods, error budgets, observability limits, degradation modes, and likelihood contracts. | A fusion stack gates out valid LiDAR returns in rain because the range-noise model and confidence contract were copied from dry-road data. |
| `10-knowledge-base/signal-processing/overview.md` | `# Signal Processing Foundations for Autonomy` | `signal-processing-overview.svg` | `signal-processing-chain` | Sampling, filtering, FFT, radar range-Doppler-angle processing, CFAR, aliasing, windowing, clutter suppression, and raw-to-feature contracts. | A radar detector misses crossing traffic because chirp/FFT/CFAR assumptions produce a blind spot in velocity or clutter conditions. |

## Visual Caption Map

For each overview, use one exact caption string in three places: the Markdown visual-caption line, the SVG `<desc>`, and the reassessment manifest line after `Replacement visual:`. Do not paraphrase between those locations.

```text
controls: section-level autonomy-role diagram showing control foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
mapping: section-level autonomy-role diagram showing mapping foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
optimization: section-level autonomy-role diagram showing optimization foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
robotics: section-level autonomy-role diagram showing robotics foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
sensors: section-level autonomy-role diagram showing sensor foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
signal-processing: section-level autonomy-role diagram showing signal processing foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
```

## Boundary Requirements

Use three bullets per page in `Boundaries With Neighboring Foundations`: `Owns`, `Hands off to`, and `Does not own`. The handoff bullet must name the neighboring foundation and the condition that triggers the handoff.

```text
controls: Own closed-loop tracking, MPC, iLQR, constraints, stability, vehicle dynamics, receding-horizon command generation, actuator limits, and safety filters. Do not reframe controls as behavior planning or as generic optimization.
mapping: Own persistent environment representation: occupancy, semantic layers, TSDF/ESDF/surfels, map fusion, update policy, dynamic/static separation, and map QA. Registration remains geometry until it is committed into persistent map state.
optimization: Own objective construction, residual linearization, updates, damping, trust regions, globalization, autodiff/Jacobians, and solver selection. Reference probability for residual meaning and numerical linear algebra for the linear solve.
robotics: Own robot/task vocabulary, autonomy problem decomposition, route/behavior/motion-planning vocabulary, handoff contracts, Lanelet2, and embodiment assumptions. Do not absorb controls or systems engineering local failure modes.
sensors: Own cross-modality measurement likelihoods, error-budget contracts, observability limits, degradation modes, and modality handoff assumptions. Geometry owns projection/calibration; signal processing owns waveform and raw-to-feature transforms.
signal-processing: Own raw-to-feature transforms: sampling, filtering, FFT, radar range-Doppler-angle, CFAR, windowing, aliasing, and clutter. Do not duplicate sensor hardware likelihoods or perception model semantics.
```

## Task 1: Activate Batch A Contract Tests

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Replace `overviewFoldersWithContract`**

If `overviewFoldersWithContract` is absent, stop and run the contract/navigation plan first.

Use this value:

```js
const overviewFoldersWithContract = [
  'controls',
  'mapping',
  'optimization',
  'robotics',
  'sensors',
  'signal-processing'
]
```

- [ ] **Step 2: Run the focused content test and confirm red**

Run:

```text
node --test tests/content-smoke.test.mjs
```

Expected: FAIL with missing overview pages for the six activated folders.

## Task 2: Write Batch A Overview Pages

**Files:**
- Create the six `overview.md` files listed in the file map.

- [ ] **Step 1: Create each page with the required H1 and visual block**

For every page, put the `kb-visual` block immediately after the H1. Use the image file and diagram title from the batch page briefs, and use the exact caption from the Visual Caption Map.

- [ ] **Step 2: Add section-specific review questions**

Under `What This Foundation Lets You Review`, add 3-5 questions per page. Cover these review focuses:

```text
controls: feasibility, dynamics model fidelity, actuator limits, MPC/iLQR objective design, controller/planner handoff.
mapping: persistence semantics, dynamic/static separation, map update policy, map QA, planning-facing representation.
optimization: residual meaning, scaling, Jacobian correctness, damping/globalization, solver failure diagnosis.
robotics: task decomposition, route/behavior/motion/trajectory/control boundaries, Lanelet2 vocabulary, embodiment assumptions.
sensors: measurement likelihoods, noise/error budgets, observability, degradation, modality handoff.
signal-processing: sampling assumptions, filtering side effects, FFT/windowing, CFAR thresholds, radar raw-to-feature contracts.
```

- [ ] **Step 3: Add local inventories in `Pages In This Section`**

Use these exact page inventories:

```text
controls: constrained-optimization-mpc-ilqr-first-principles.md, frenet-trajectory-math.md, mdp-pomdp-belief-space-rl-first-principles.md, vehicle-dynamics-and-control.md
mapping: neural-implicit-slam-differentiable-mapping-first-principles.md, occupancy-bayes-evidential-dynamic-grids.md, semantic-mapping-and-map-fusion-first-principles.md, volumetric-map-representations-tsdf-esdf-octree-surfels.md
optimization: factor-graph-solver-patterns-ceres-gtsam-g2o.md, gauss-newton-levenberg-marquardt-dogleg.md, jacobians-autodiff-manifold-linearization.md, nonlinear-least-squares-first-principles.md, trust-region-line-search-globalization.md
robotics: embodied-ai-crossover.md, lanelet2-maps.md, planning-taxonomy-and-trajectory-generation.md
sensors: sensor-likelihoods-noise-error-budgets.md
signal-processing: cfar-detection-thresholding.md, radar-ambiguity-chirp-design-doppler-limits.md, radar-fmcw-mimo-doppler.md, sampling-fft-windowing-filtering.md, sensor-filtering-alpha-beta-kalman-complementary.md
```

- [ ] **Step 4: Add applied links outside `10-knowledge-base`**

Use 3-5 applied links per page. These links must include a reason phrase explaining why the foundation matters there:

```text
controls: 30-autonomy-stack/planning/trajectory-tracking-control.md, 30-autonomy-stack/planning/safety-critical-planning-cbf.md, 30-autonomy-stack/planning/frenet-planner-augmentation.md
mapping: 30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md, 30-autonomy-stack/localization-mapping/maps/semantic-mapping-learned-priors.md, 30-autonomy-stack/localization-mapping/maps/map-tile-versioning-distribution.md
optimization: 30-autonomy-stack/localization-mapping/slam-methods/factor-graph-isam2-gtsam.md, 30-autonomy-stack/localization-mapping/slam-methods/graphslam-pose-graph-optimization.md, 30-autonomy-stack/planning/neural-motion-planning.md
robotics: 30-autonomy-stack/planning/behavior-planning-maneuver-arbitration.md, 30-autonomy-stack/planning/frenet-planner-augmentation.md, 30-autonomy-stack/planning/trajectory-tracking-control.md
sensors: 30-autonomy-stack/perception/overview/production-perception-systems.md, 30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md, 40-runtime-systems/software-operations/sensor-calibration-fleet-ops.md
signal-processing: 30-autonomy-stack/perception/methods/k-radar.md, 30-autonomy-stack/perception/overview/radar-lidar-fusion-adverse-weather.md, 30-autonomy-stack/perception/datasets-benchmarks/dual-radar-4d-radar-adverse-weather.md
```

When writing Markdown links from `10-knowledge-base/<folder>/overview.md`, convert every applied repo-relative target to a correct relative link. Example: use `../../30-autonomy-stack/planning/trajectory-tracking-control.md`, not `30-autonomy-stack/planning/trajectory-tracking-control.md`.

- [ ] **Step 5: Run link checker**

Run:

```text
npm run links:check
```

Expected: PASS.

## Task 3: Add Batch A Visuals And Taxonomy

**Files:**
- Create the six SVG files listed in the file map.
- Modify: `tools/knowledge-base/visual-taxonomy.mjs`

- [ ] **Step 1: Create SVG assets**

Each SVG must use `width="1400"`, `height="720"`, `viewBox="0 0 1400 720"`, `role="img"`, a `<title>`, a `<desc>`, the matching `data-diagram-kind`, and a layout comment matching its assigned kind such as `<!-- layout:closed-loop-control -->` for `controls-overview.svg`. The `<desc>` must include the exact caption from the Visual Caption Map.

- [ ] **Step 2: Add taxonomy entries**

Insert these entries in `PAGE_DIAGRAM_KIND`:

```js
'10-knowledge-base/controls/overview.md': 'closed-loop-control',
'10-knowledge-base/mapping/overview.md': 'map-and-planning-stack',
'10-knowledge-base/optimization/overview.md': 'solver-loop',
'10-knowledge-base/robotics/overview.md': 'systems-map',
'10-knowledge-base/sensors/overview.md': 'error-budget',
'10-knowledge-base/signal-processing/overview.md': 'signal-processing-chain',
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
- `10-knowledge-base/controls/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing control foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/mapping/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing mapping foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/optimization/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing optimization foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/robotics/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing robotics foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/sensors/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing sensor foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
- `10-knowledge-base/signal-processing/overview.md` - Visual needed: yes. Replacement visual: section-level autonomy-role diagram showing signal processing foundations, autonomy problem classes, stack interfaces, reading paths, and failure diagnosis.
```

- [ ] **Step 2: Update manifest counts**

Run:

```powershell
(rg --files 10-knowledge-base -g '*.md' | Measure-Object).Count
```

Set visible manifest count lines to the command output. Update the Scope sentence and every Summary count bullet, not only the first count mention.

- [ ] **Step 3: Verify manifest entry count**

Run:

```powershell
(Select-String -Path docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md -Pattern '^- `10-knowledge-base/.+\.md` - Visual needed: yes').Count
```

Expected: the manifest entry count equals the live Markdown count from Step 2.

## Task 5: Verify And Commit Batch A

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
git commit -m "docs: add first knowledge base section overviews"
```
