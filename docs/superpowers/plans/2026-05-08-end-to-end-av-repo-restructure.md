# End-to-End AV Repo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Physically move the research corpus into the approved end-to-end AV knowledge architecture while preserving root entry points, method libraries, Markdown links, VitePress navigation, tests, and deployment behavior.

**Architecture:** Use a small migration toolchain to build a deterministic old-path to new-path map, move files in verified batches, rewrite Markdown links, and check for stale paths. The final repository uses numbered top-level knowledge areas: start-here, knowledge-base, AV platform, autonomy stack, runtime systems, cloud/fleet, safety/validation, operations domains, industry intel, and synthesis.

**Tech Stack:** Markdown, Node.js ESM scripts, PowerShell commands, VitePress, node:test, Git, GitHub Pages.

---

## Source Spec

Implementation follows:

- `docs/superpowers/specs/2026-05-08-end-to-end-av-repo-restructure-design.md`

## Current Invariants

- Root entry files stay present: `README.md`, `INDEX.md`, `METHODOLOGY.md`, `GLOSSARY.md`.
- Internal planning docs under `docs/superpowers/**` stay excluded from VitePress.
- Method-level perception pages stay atomic.
- Method-level SLAM pages stay atomic.
- Verification command is `npm run verify`.
- Worktree must be clean before each commit checkpoint.

## Target Top-Level Content Directories

```text
00-start-here/
10-knowledge-base/
20-av-platform/
30-autonomy-stack/
40-runtime-systems/
50-cloud-fleet/
60-safety-validation/
70-operations-domains/
80-industry-intel/
90-synthesis/
```

## File Structure Changes

### Create

- `00-start-here/reading-guide.md`
- `00-start-here/repo-map.md`
- `00-start-here/methodology.md`
- `00-start-here/glossary.md`
- `tools/restructure/path-map.mjs`
- `tools/restructure/migrate.mjs`
- `tools/restructure/check-links.mjs`
- `tests/restructure-map.test.mjs`

### Modify

- `.vitepress/config.mjs`
- `.vitepress/navigation.mjs`
- `tests/navigation.test.mjs`
- `tests/site-config.test.mjs`
- `tests/content-smoke.test.mjs`
- `package.json`
- `README.md`
- `INDEX.md`
- `METHODOLOGY.md`
- `GLOSSARY.md`

### Move

- `foundations/**` -> `10-knowledge-base/**`
- `hardware/**` -> `20-av-platform/**`
- `technology/**` -> `30-autonomy-stack/**` and selected robustness content under `60-safety-validation/**`
- `cross-cutting/**` -> `30-autonomy-stack/**`, `40-runtime-systems/**`, `50-cloud-fleet/**`, `60-safety-validation/**`, or `10-knowledge-base/**`
- `operations/**` -> `40-runtime-systems/**`, `50-cloud-fleet/**`, `60-safety-validation/**`, or `70-operations-domains/**`
- `companies/**` -> `80-industry-intel/companies/**`
- `synthesis/**` -> `90-synthesis/**`

## Migration Path Rules

The implementation must encode these rules in `tools/restructure/path-map.mjs`.

### Direct Directory Rules

| Old path prefix | New path prefix |
|---|---|
| `companies/` | `80-industry-intel/companies/` |
| `hardware/compute/` | `20-av-platform/compute/` |
| `hardware/connectivity/` | `20-av-platform/networking-connectivity/` |
| `hardware/sensors/` | `20-av-platform/sensors/` |
| `hardware/vehicle/` | `20-av-platform/drive-by-wire/` |
| `technology/perception/methods/` | `30-autonomy-stack/perception/methods/` |
| `technology/perception/` | `30-autonomy-stack/perception/overview/` |
| `technology/localization/slam/` | `30-autonomy-stack/localization-mapping/slam-methods/` |
| `technology/planning/` | `30-autonomy-stack/planning/` |
| `technology/world-models/` | `30-autonomy-stack/world-models/` |
| `technology/vla/` | `30-autonomy-stack/vla-vlm/` |
| `technology/multi-agent/` | `30-autonomy-stack/multi-agent-v2x/` |
| `technology/simulation/` | `30-autonomy-stack/simulation/` |
| `technology/e2e-driving/` | `30-autonomy-stack/end-to-end-driving/` |
| `operations/airside/` | `70-operations-domains/airside/operations/` |
| `companies/` | `80-industry-intel/companies/` |

### Exact File Rules

The following exact file moves override direct directory rules.

```text
foundations/architecture-innovations.md -> 10-knowledge-base/systems-engineering/architecture-innovations.md
foundations/diffusion-models.md -> 10-knowledge-base/machine-learning/diffusion-models.md
foundations/frenet-trajectory-math.md -> 10-knowledge-base/controls/frenet-trajectory-math.md
foundations/gtsam-factor-graphs.md -> 10-knowledge-base/state-estimation/gtsam-factor-graphs.md
foundations/lanelet2-maps.md -> 10-knowledge-base/robotics/lanelet2-maps.md
foundations/mamba-ssm-for-driving.md -> 10-knowledge-base/machine-learning/mamba-ssm-for-driving.md
foundations/pointpillars.md -> 10-knowledge-base/geometry-3d/pointpillars.md
foundations/rtk-gps-imu-localization.md -> 10-knowledge-base/state-estimation/rtk-gps-imu-localization.md
foundations/sparse-attention-3d-perception.md -> 10-knowledge-base/machine-learning/sparse-attention-3d-perception.md
foundations/theoretical-foundations.md -> 10-knowledge-base/systems-engineering/theoretical-foundations.md
foundations/transformer-world-models.md -> 10-knowledge-base/machine-learning/transformer-world-models.md
foundations/vqvae-tokenization.md -> 10-knowledge-base/machine-learning/vqvae-tokenization.md

cross-cutting/3d-annotation-tools.md -> 50-cloud-fleet/data-platform/3d-annotation-tools.md
cross-cutting/autoware-universe-deep-dive.md -> 40-runtime-systems/ros-autoware/autoware-universe-deep-dive.md
cross-cutting/calibration-tracking.md -> 20-av-platform/sensors/calibration-tracking.md
cross-cutting/cloud-backend-infrastructure.md -> 50-cloud-fleet/data-platform/cloud-backend-infrastructure.md
cross-cutting/continual-learning.md -> 50-cloud-fleet/mlops/continual-learning.md
cross-cutting/data-engine-from-bags.md -> 50-cloud-fleet/data-platform/data-engine-from-bags.md
cross-cutting/data-engines-datasets.md -> 50-cloud-fleet/data-platform/data-engines-datasets.md
cross-cutting/data-flywheel-airside.md -> 50-cloud-fleet/mlops/data-flywheel-airside.md
cross-cutting/embodied-ai-crossover.md -> 10-knowledge-base/robotics/embodied-ai-crossover.md
cross-cutting/evaluation-benchmarks.md -> 60-safety-validation/verification-validation/evaluation-benchmarks.md
cross-cutting/federated-learning-fleet.md -> 50-cloud-fleet/mlops/federated-learning-fleet.md
cross-cutting/fleet-data-pipeline.md -> 50-cloud-fleet/data-platform/fleet-data-pipeline.md
cross-cutting/formal-methods-regulatory.md -> 60-safety-validation/standards-certification/formal-methods-regulatory.md
cross-cutting/fusion-geometric.md -> 30-autonomy-stack/perception/overview/fusion-geometric.md
cross-cutting/ground-safety.md -> 60-safety-validation/safety-case/ground-safety.md
cross-cutting/isaac-ros-for-airside.md -> 40-runtime-systems/ros-autoware/isaac-ros-for-airside.md
cross-cutting/lidar-data-augmentation.md -> 50-cloud-fleet/mlops/lidar-data-augmentation.md
cross-cutting/nuscenes-waymo-practical-guide.md -> 30-autonomy-stack/perception/datasets-benchmarks/nuscenes-waymo-practical-guide.md
cross-cutting/on-vehicle-data-triage-selective-upload.md -> 40-runtime-systems/data-logging/on-vehicle-data-triage-selective-upload.md
cross-cutting/opensource-ecosystem.md -> 40-runtime-systems/ml-deployment/opensource-ecosystem.md
cross-cutting/radar-lidar-fusion-adverse-weather.md -> 30-autonomy-stack/perception/overview/radar-lidar-fusion-adverse-weather.md
cross-cutting/ros2-migration.md -> 40-runtime-systems/ros-autoware/ros2-migration.md
cross-cutting/sensor-fusion-architectures.md -> 30-autonomy-stack/perception/overview/sensor-fusion-architectures.md
cross-cutting/signal-processing-weather.md -> 10-knowledge-base/systems-engineering/signal-processing-weather.md
cross-cutting/synthetic-data-generation.md -> 50-cloud-fleet/data-platform/synthetic-data-generation.md
cross-cutting/transfer-learning.md -> 50-cloud-fleet/mlops/transfer-learning.md

operations/deployment/av-cicd-devops-pipeline.md -> 40-runtime-systems/ml-deployment/av-cicd-devops-pipeline.md
operations/deployment/deployment-playbook.md -> 70-operations-domains/deployment-playbooks/deployment-playbook.md
operations/deployment/ev-fleet-energy-co-optimization.md -> 50-cloud-fleet/fleet-management/ev-fleet-energy-co-optimization.md
operations/deployment/fleet-anomaly-root-cause-attribution.md -> 50-cloud-fleet/observability/fleet-anomaly-root-cause-attribution.md
operations/deployment/fleet-management-dispatch.md -> 50-cloud-fleet/fleet-management/fleet-management-dispatch.md
operations/deployment/fleet-predictive-maintenance.md -> 50-cloud-fleet/fleet-management/fleet-predictive-maintenance.md
operations/deployment/fleet-tco-business-case.md -> 70-operations-domains/airside/business-case/fleet-tco-business-case.md
operations/deployment/hmi-operator-interface.md -> 40-runtime-systems/monitoring-observability/hmi-operator-interface.md
operations/deployment/multi-airport-adaptation.md -> 70-operations-domains/deployment-playbooks/multi-airport-adaptation.md
operations/deployment/ota-fleet-management.md -> 50-cloud-fleet/ota/ota-fleet-management.md
operations/deployment/production-ml-deployment.md -> 40-runtime-systems/ml-deployment/production-ml-deployment.md
operations/deployment/shadow-mode.md -> 60-safety-validation/verification-validation/shadow-mode.md
operations/deployment/workforce-transition.md -> 70-operations-domains/deployment-playbooks/workforce-transition.md

operations/safety/airside-scenario-taxonomy.md -> 60-safety-validation/verification-validation/airside-scenario-taxonomy.md
operations/safety/certification-guide.md -> 60-safety-validation/standards-certification/certification-guide.md
operations/safety/cybersecurity-airside-av.md -> 60-safety-validation/cybersecurity/cybersecurity-airside-av.md
operations/safety/fail-operational-architecture.md -> 60-safety-validation/runtime-assurance/fail-operational-architecture.md
operations/safety/failure-modes-analysis.md -> 60-safety-validation/safety-case/failure-modes-analysis.md
operations/safety/formal-verification-neural-networks.md -> 60-safety-validation/verification-validation/formal-verification-neural-networks.md
operations/safety/functional-safety-software.md -> 60-safety-validation/standards-certification/functional-safety-software.md
operations/safety/ground-crew-pedestrian-safety.md -> 70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md
operations/safety/insurance-liability-airside.md -> 80-industry-intel/regulations/insurance-liability-airside.md
operations/safety/iso-3691-4-deep-dive.md -> 60-safety-validation/standards-certification/iso-3691-4-deep-dive.md
operations/safety/online-perception-monitoring-odd-enforcement.md -> 60-safety-validation/runtime-assurance/online-perception-monitoring-odd-enforcement.md
operations/safety/regulatory-trajectory-deep-dive.md -> 80-industry-intel/regulations/regulatory-trajectory-deep-dive.md
operations/safety/runtime-verification-monitoring.md -> 60-safety-validation/runtime-assurance/runtime-verification-monitoring.md
operations/safety/safety-incidents-lessons.md -> 60-safety-validation/safety-case/safety-incidents-lessons.md
operations/safety/safety-verification-certification.md -> 60-safety-validation/standards-certification/safety-verification-certification.md
operations/safety/simplex-safety-architecture.md -> 60-safety-validation/runtime-assurance/simplex-safety-architecture.md
operations/safety/testing-validation-methodology.md -> 60-safety-validation/verification-validation/testing-validation-methodology.md
operations/safety/weather-adaptive-odd-management.md -> 60-safety-validation/runtime-assurance/weather-adaptive-odd-management.md
operations/teleoperation/teleoperation-systems.md -> 40-runtime-systems/monitoring-observability/teleoperation-systems.md

technology/localization/hd-map-change-detection-maintenance.md -> 30-autonomy-stack/localization-mapping/maps/hd-map-change-detection-maintenance.md
technology/localization/hd-map-standards-airside.md -> 30-autonomy-stack/localization-mapping/maps/hd-map-standards-airside.md
technology/localization/lidar-place-recognition-relocalization.md -> 30-autonomy-stack/localization-mapping/overview/lidar-place-recognition-relocalization.md
technology/localization/lidar-slam-algorithms.md -> 30-autonomy-stack/localization-mapping/overview/lidar-slam-algorithms.md
technology/localization/map-construction-pipeline.md -> 30-autonomy-stack/localization-mapping/maps/map-construction-pipeline.md
technology/localization/map-free-driving.md -> 30-autonomy-stack/localization-mapping/maps/map-free-driving.md
technology/localization/map-tile-versioning-distribution.md -> 30-autonomy-stack/localization-mapping/maps/map-tile-versioning-distribution.md
technology/localization/mapping-and-localization.md -> 30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md
technology/localization/neural-online-mapping-sota.md -> 30-autonomy-stack/localization-mapping/maps/neural-online-mapping-sota.md
technology/localization/production-lidar-map-localization.md -> 30-autonomy-stack/localization-mapping/overview/production-lidar-map-localization.md
technology/localization/realtime-occupancy-grid-mapping.md -> 30-autonomy-stack/localization-mapping/maps/realtime-occupancy-grid-mapping.md
technology/localization/robust-state-estimation-multi-sensor.md -> 30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md
technology/localization/semantic-mapping-learned-priors.md -> 30-autonomy-stack/localization-mapping/maps/semantic-mapping-learned-priors.md

technology/robustness/adverse-conditions.md -> 60-safety-validation/verification-validation/robustness/adverse-conditions.md
technology/robustness/airside-adverse-conditions.md -> 60-safety-validation/verification-validation/robustness/airside-adverse-conditions.md
technology/robustness/test-time-adaptation-airside.md -> 30-autonomy-stack/perception/overview/test-time-adaptation-airside.md
technology/robustness/test-time-training-airport-onboarding.md -> 30-autonomy-stack/perception/overview/test-time-training-airport-onboarding.md

synthesis/master-synthesis.md -> 90-synthesis/master/master-synthesis.md
synthesis/getting-started.md -> 90-synthesis/master/getting-started.md
synthesis/design-spec.md -> 90-synthesis/decisions/design-spec.md
synthesis/decision-framework.md -> 90-synthesis/decisions/decision-framework.md
synthesis/poc-proposals.md -> 90-synthesis/poc-roadmaps/poc-proposals.md
synthesis/technology-readiness.md -> 90-synthesis/readiness-risk/technology-readiness.md
synthesis/risk-register.md -> 90-synthesis/readiness-risk/risk-register.md
synthesis/competitive-landscape.md -> 80-industry-intel/market-competitive/competitive-landscape.md
```

## Task 1: Add Migration Map Tests

**Files:**

- Create: `tests/restructure-map.test.mjs`
- Test: `npm test -- tests/restructure-map.test.mjs`

- [ ] **Step 1: Create failing tests for representative path mapping**

Use `apply_patch` to create `tests/restructure-map.test.mjs` with this content:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { targetPathFor } from '../tools/restructure/path-map.mjs'

test('maps knowledge-base fundamentals', () => {
  assert.equal(
    targetPathFor('foundations/gtsam-factor-graphs.md'),
    '10-knowledge-base/state-estimation/gtsam-factor-graphs.md'
  )
  assert.equal(
    targetPathFor('foundations/pointpillars.md'),
    '10-knowledge-base/geometry-3d/pointpillars.md'
  )
})

test('maps AV platform hardware', () => {
  assert.equal(
    targetPathFor('hardware/compute/nvidia-orin-technical.md'),
    '20-av-platform/compute/nvidia-orin-technical.md'
  )
  assert.equal(
    targetPathFor('hardware/connectivity/airport-5g-cbrs.md'),
    '20-av-platform/networking-connectivity/airport-5g-cbrs.md'
  )
  assert.equal(
    targetPathFor('hardware/vehicle/can-bus-dbw.md'),
    '20-av-platform/drive-by-wire/can-bus-dbw.md'
  )
})

test('maps autonomy stack method libraries', () => {
  assert.equal(
    targetPathFor('technology/perception/methods/bevdepth.md'),
    '30-autonomy-stack/perception/methods/bevdepth.md'
  )
  assert.equal(
    targetPathFor('technology/localization/slam/glim.md'),
    '30-autonomy-stack/localization-mapping/slam-methods/glim.md'
  )
})

test('maps runtime, cloud, safety, operations, industry, and synthesis split files', () => {
  assert.equal(
    targetPathFor('cross-cutting/ros2-migration.md'),
    '40-runtime-systems/ros-autoware/ros2-migration.md'
  )
  assert.equal(
    targetPathFor('cross-cutting/cloud-backend-infrastructure.md'),
    '50-cloud-fleet/data-platform/cloud-backend-infrastructure.md'
  )
  assert.equal(
    targetPathFor('operations/safety/iso-3691-4-deep-dive.md'),
    '60-safety-validation/standards-certification/iso-3691-4-deep-dive.md'
  )
  assert.equal(
    targetPathFor('operations/airside/fod-and-jetblast.md'),
    '70-operations-domains/airside/operations/fod-and-jetblast.md'
  )
  assert.equal(
    targetPathFor('companies/waymo/tech-stack.md'),
    '80-industry-intel/companies/waymo/tech-stack.md'
  )
  assert.equal(
    targetPathFor('synthesis/master-synthesis.md'),
    '90-synthesis/master/master-synthesis.md'
  )
})
```

- [ ] **Step 2: Run the targeted test and confirm it fails because migration tooling does not exist**

Run:

```powershell
node --test tests/restructure-map.test.mjs
```

Expected: FAIL with module resolution error for `tools/restructure/path-map.mjs`.

## Task 2: Add Migration Tooling

**Files:**

- Create: `tools/restructure/path-map.mjs`
- Create: `tools/restructure/migrate.mjs`
- Create: `tools/restructure/check-links.mjs`
- Modify: `package.json`
- Modify: `.vitepress/config.mjs`
- Modify: `tests/site-config.test.mjs`
- Test: `node --test tests/restructure-map.test.mjs`

- [ ] **Step 1: Create `tools/restructure/path-map.mjs`**

Implement these exports:

```js
export const CONTENT_ROOTS = [
  'companies',
  'cross-cutting',
  'foundations',
  'hardware',
  'operations',
  'synthesis',
  'technology'
]

export const TARGET_ROOTS = [
  '00-start-here',
  '10-knowledge-base',
  '20-av-platform',
  '30-autonomy-stack',
  '40-runtime-systems',
  '50-cloud-fleet',
  '60-safety-validation',
  '70-operations-domains',
  '80-industry-intel',
  '90-synthesis'
]
```

The file must also export:

```js
export function normalizeRelPath(relPath)
export function targetPathFor(relPath)
export function buildMoveMap(relPaths)
export function shouldMove(relPath)
```

Required behavior:

- `normalizeRelPath()` converts `\` to `/` and strips leading `./`.
- `shouldMove()` returns true only for Markdown files under `CONTENT_ROOTS`.
- `targetPathFor()` applies the exact file rules first, then the direct directory rules.
- `buildMoveMap()` returns a `Map` of normalized old path to normalized new path for all moved Markdown files.
- If a Markdown path under `CONTENT_ROOTS` has no rule, `targetPathFor()` throws `No restructure target for <path>`.

- [ ] **Step 2: Encode exact and prefix rules**

In `path-map.mjs`, encode every direct directory rule and exact file rule listed in this implementation plan. Store exact rules in a `Map` named `EXACT_MOVES` and prefix rules in an ordered array named `PREFIX_MOVES`.

- [ ] **Step 3: Create `tools/restructure/migrate.mjs`**

This script must support:

```powershell
node tools/restructure/migrate.mjs --print-map [--batch <name>]
node tools/restructure/migrate.mjs --move [--batch <name>]
node tools/restructure/migrate.mjs --rewrite-links [--batch <name>]
node tools/restructure/migrate.mjs --check-stale [--batch <name>]
```

Required behavior:

- Supported batches are `knowledge-platform`, `autonomy`, `runtime-cloud-safety-ops`, `industry-synthesis`, and `all`; default is `all`.
- `knowledge-platform` includes old paths under `foundations/**` and `hardware/**`.
- `autonomy` includes old paths under `technology/**`.
- `runtime-cloud-safety-ops` includes old paths under `cross-cutting/**` and `operations/**`.
- `industry-synthesis` includes old paths under `companies/**` and `synthesis/**`.
- Every command builds the candidate old-path set from the union of `git ls-files '*.md'` and current filesystem Markdown paths, normalized to `/`. This preserves the move map after files are renamed but before the batch is staged.
- `--print-map` prints `old -> new` lines for every moved Markdown file.
- `--move` creates parent directories and renames files from old to new paths using `fs.renameSync`; if an old path is absent and the target path already exists, count it as already moved.
- `--rewrite-links` rewrites Markdown links and inline old path strings across all current filesystem Markdown files using only the selected batch map.
- `--check-stale` scans all current filesystem Markdown files for old path strings from the selected batch map and exits non-zero if any remain.
- The script skips `node_modules/**`, `.git/**`, `.vitepress/dist/**`, and `docs/superpowers/**`.

Link rewrite algorithm:

1. Build `moveMap` and `inverseMoveMap`.
2. For each Markdown file, identify its current path.
3. Derive the old source path using `inverseMoveMap.get(currentPath) ?? currentPath`.
4. Rewrite Markdown links matching `](` where the URL is a local `.md` path.
5. Resolve each local link target against the old source directory.
6. If the target moved, compute a new relative link from the current source directory to the new target path.
7. Preserve anchors after `#`.
8. Replace inline path strings by applying every old path to new path replacement, sorted longest old path first.

- [ ] **Step 4: Create `tools/restructure/check-links.mjs`**

This script must:

- Read all Markdown files except `node_modules/**`, `.git/**`, `.vitepress/dist/**`, and `docs/superpowers/**`.
- Extract local Markdown links from `](...)`.
- Ignore external URLs, mailto links, and pure hash links.
- Resolve relative `.md` links against the containing file.
- Exit with code 1 and print every missing target.
- Exit with code 0 when no missing targets are found.

- [ ] **Step 5: Add npm scripts**

Modify `package.json` scripts:

```json
"restructure:print-map": "node tools/restructure/migrate.mjs --print-map",
"restructure:move": "node tools/restructure/migrate.mjs --move",
"restructure:rewrite-links": "node tools/restructure/migrate.mjs --rewrite-links",
"restructure:check-stale": "node tools/restructure/migrate.mjs --check-stale",
"links:check": "node tools/restructure/check-links.mjs"
```

Keep existing scripts unchanged.

- [ ] **Step 6: Exclude migration tooling from public content**

Add this to `.vitepress/config.mjs` `srcExclude`:

```js
'tools/restructure/**'
```

Update `tests/site-config.test.mjs` to assert:

```js
assert.ok(config.srcExclude.includes('tools/restructure/**'))
```

- [ ] **Step 7: Run map tests**

Run:

```powershell
node --test tests/restructure-map.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit migration tooling**

Run:

```powershell
git add package.json tests/restructure-map.test.mjs tools/restructure .vitepress/config.mjs tests/site-config.test.mjs
git commit -m "chore: add AV restructure migration tooling"
```

## Task 3: Update VitePress Navigation Tests For Target Architecture

**Files:**

- Modify: `.vitepress/navigation.mjs`
- Modify: `tests/navigation.test.mjs`
- Modify: `tests/site-config.test.mjs`
- Modify: `tests/content-smoke.test.mjs`
- Test: `npm test`

- [ ] **Step 1: Update navigation tests first**

Modify `tests/navigation.test.mjs` expectations:

```js
assert.deepEqual(sectionNames, [
  'Start Here',
  'Knowledge Base',
  'AV Platform',
  'Autonomy Stack',
  'Runtime Systems',
  'Cloud Fleet',
  'Safety Validation',
  'Operations Domains',
  'Industry Intel',
  'Synthesis'
])
```

Modify required directory assertions to:

```js
for (const dir of [
  '00-start-here',
  '10-knowledge-base',
  '20-av-platform',
  '30-autonomy-stack',
  '40-runtime-systems',
  '50-cloud-fleet',
  '60-safety-validation',
  '70-operations-domains',
  '80-industry-intel',
  '90-synthesis'
]) {
  assert.ok(fs.existsSync(path.join(repoRoot, dir)), `${dir} should exist`)
}
```

Modify `tests/site-config.test.mjs` to assert that the sidebar includes `Autonomy Stack` instead of `Technology`.

Modify `tests/content-smoke.test.mjs` representative paths after the move:

```js
const requiredDocs = [
  'README.md',
  'INDEX.md',
  'GLOSSARY.md',
  'METHODOLOGY.md',
  '90-synthesis/master/master-synthesis.md',
  '90-synthesis/master/getting-started.md',
  '80-industry-intel/companies/waymo/tech-stack.md',
  '30-autonomy-stack/world-models/overview.md',
  '60-safety-validation/standards-certification/iso-3691-4-deep-dive.md',
  '20-av-platform/compute/nvidia-orin-technical.md',
  '10-knowledge-base/geometry-3d/pointpillars.md',
  '30-autonomy-stack/perception/overview/sensor-fusion-architectures.md'
]
```

- [ ] **Step 2: Run tests and confirm the expected failure**

Run:

```powershell
npm test
```

Expected: FAIL because target directories and navigation do not exist yet.

- [ ] **Step 3: Update `.vitepress/navigation.mjs` section order**

Replace `SECTION_ORDER` with:

```js
const SECTION_ORDER = [
  { dir: '10-knowledge-base', text: 'Knowledge Base', collapsed: true },
  { dir: '20-av-platform', text: 'AV Platform', collapsed: true },
  { dir: '30-autonomy-stack', text: 'Autonomy Stack', collapsed: true },
  { dir: '40-runtime-systems', text: 'Runtime Systems', collapsed: true },
  { dir: '50-cloud-fleet', text: 'Cloud Fleet', collapsed: true },
  { dir: '60-safety-validation', text: 'Safety Validation', collapsed: true },
  { dir: '70-operations-domains', text: 'Operations Domains', collapsed: true },
  { dir: '80-industry-intel', text: 'Industry Intel', collapsed: true },
  { dir: '90-synthesis', text: 'Synthesis', collapsed: false }
]
```

Update `START_FILES` to include the root files only. Keep `README.md`, `INDEX.md`, `GLOSSARY.md`, and `METHODOLOGY.md`.

Update `buildNav()`:

```js
return [
  { text: 'Home', link: '/' },
  { text: 'Index', link: '/INDEX/' },
  { text: 'Autonomy Stack', link: '/30-autonomy-stack/perception/overview/production-perception-systems' },
  { text: 'Synthesis', link: '/90-synthesis/master/master-synthesis' },
  { text: 'GitHub', link: 'https://github.com/kvynlim/industry-research' }
]
```

- [ ] **Step 4: Commit navigation test change only after Batch 1 scaffold exists**

Do not commit this task until Task 4 creates the target directories and start pages. The tests are intentionally failing at this point.

## Task 4: Create Target Scaffold And Start Pages

**Files:**

- Create: `00-start-here/reading-guide.md`
- Create: `00-start-here/repo-map.md`
- Create: `00-start-here/methodology.md`
- Create: `00-start-here/glossary.md`
- Create: target top-level directories listed in this plan
- Modify: `README.md`
- Modify: `INDEX.md`
- Test: `npm test`

- [ ] **Step 1: Create target directories**

Run:

```powershell
$dirs = @(
  '00-start-here',
  '10-knowledge-base',
  '20-av-platform',
  '30-autonomy-stack',
  '40-runtime-systems',
  '50-cloud-fleet',
  '60-safety-validation',
  '70-operations-domains',
  '80-industry-intel',
  '90-synthesis'
)
foreach ($dir in $dirs) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
```

- [ ] **Step 2: Create `00-start-here/reading-guide.md`**

Use this content:

```markdown
# Reading Guide

This repository is an end-to-end autonomous-vehicle research knowledge base. Start with the root README for the shortest overview, then use this guide to choose a path through the stack.

| Need | Start |
|---|---|
| Understand the whole architecture | `90-synthesis/master/master-synthesis.md` |
| Review fundamentals | `10-knowledge-base/` |
| Select hardware and sensors | `20-av-platform/` |
| Study autonomy methods | `30-autonomy-stack/` |
| Deploy on vehicle | `40-runtime-systems/` |
| Build fleet and cloud systems | `50-cloud-fleet/` |
| Build the safety case | `60-safety-validation/` |
| Study operating domains | `70-operations-domains/` |
| Compare companies and markets | `80-industry-intel/` |

## Reading Order

1. Read the root `README.md`.
2. Use `00-start-here/repo-map.md` to understand the directory tree.
3. Use `INDEX.md` when searching for a specific topic.
4. Open the relevant stack layer.
5. For method-heavy areas, read overview pages before individual method pages.
```

- [ ] **Step 3: Create `00-start-here/repo-map.md`**

Use this content:

```markdown
# Repository Map

| Directory | Purpose |
|---|---|
| `10-knowledge-base/` | Reusable fundamentals: robotics, estimation, controls, ML, geometry, safety, systems. |
| `20-av-platform/` | Vehicle hardware, sensors, compute, networking, DBW, power, and thermal systems. |
| `30-autonomy-stack/` | Perception, localization, mapping, planning, control, world models, VLA/VLM, simulation, and multi-agent autonomy. |
| `40-runtime-systems/` | ROS, Autoware, middleware, edge inference, deployment, monitoring, and data logging. |
| `50-cloud-fleet/` | Cloud data platforms, MLOps, map ops, OTA, fleet management, and observability. |
| `60-safety-validation/` | Safety case, standards, certification, verification, validation, runtime assurance, and cybersecurity. |
| `70-operations-domains/` | Domain operations for airside, indoor warehouse, outdoor campus, road AV, and deployment playbooks. |
| `80-industry-intel/` | Company profiles, market research, regulations, and deployments. |
| `90-synthesis/` | Executive synthesis, decisions, POCs, readiness, and risk. |

Root files remain stable entry points for GitHub and the VitePress reader.
```

- [ ] **Step 4: Create `00-start-here/methodology.md` and `00-start-here/glossary.md` as compatibility pointers**

Use this content for `00-start-here/methodology.md`:

```markdown
# Methodology

The canonical methodology page remains at the repository root:

- [Research Methodology](../METHODOLOGY.md)
```

Use this content for `00-start-here/glossary.md`:

```markdown
# Glossary

The canonical glossary remains at the repository root:

- [Glossary](../GLOSSARY.md)
```

- [ ] **Step 5: Update root README architecture text**

Add a short section below `## Current Shape`:

```markdown
## Architecture

The corpus is being organized as an end-to-end AV knowledge base: fundamentals, platform hardware, autonomy stack, runtime systems, cloud/fleet systems, safety validation, operations domains, industry intelligence, and synthesis.
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test
```

Expected: PASS after Task 3 navigation changes and Task 4 scaffold are both present.

- [ ] **Step 7: Commit Batch 1**

Run:

```powershell
git add .vitepress/navigation.mjs tests/navigation.test.mjs tests/site-config.test.mjs tests/content-smoke.test.mjs README.md INDEX.md 00-start-here
git commit -m "docs: scaffold end-to-end AV knowledge architecture"
```

## Task 5: Move Knowledge Base And AV Platform

**Files:**

- Move: `foundations/**`
- Move: `hardware/**`
- Modify: all Markdown links affected by those moves
- Test: `npm run links:check`, `npm run restructure:check-stale`, `npm test`

- [ ] **Step 1: Print the planned move map for this batch**

Run:

```powershell
npm run restructure:print-map -- --batch knowledge-platform
```

Expected: output maps every current `foundations/*.md` and `hardware/**/*.md` file to `10-knowledge-base/**` or `20-av-platform/**`.

- [ ] **Step 2: Run move script**

Run:

```powershell
npm run restructure:move -- --batch knowledge-platform
```

Expected: files are renamed into the new target tree.

- [ ] **Step 3: Rewrite links**

Run:

```powershell
npm run restructure:rewrite-links -- --batch knowledge-platform
```

Expected: Markdown links and inline old path strings are rewritten.

- [ ] **Step 4: Check links and stale paths**

Run:

```powershell
npm run links:check
npm run restructure:check-stale -- --batch knowledge-platform
```

Expected: both commands exit 0.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit Batch 2**

Run:

```powershell
git add 10-knowledge-base 20-av-platform README.md INDEX.md METHODOLOGY.md GLOSSARY.md .vitepress tests
git add -u foundations hardware
git commit -m "docs: move fundamentals and platform docs"
```

## Task 6: Move Autonomy Stack

**Files:**

- Move: `technology/perception/**`
- Move: `technology/localization/**`
- Move: `technology/planning/**`
- Move: `technology/world-models/**`
- Move: `technology/vla/**`
- Move: `technology/multi-agent/**`
- Move: `technology/simulation/**`
- Move: `technology/e2e-driving/**`
- Move: `technology/robustness/**`
- Modify: all Markdown links affected by those moves
- Test: `npm run links:check`, `npm run restructure:check-stale`, `npm test`

- [ ] **Step 1: Inspect planned autonomy moves**

Run:

```powershell
npm run restructure:print-map -- --batch autonomy
```

Expected: all `technology/**.md` files map to `30-autonomy-stack/**` except robustness files explicitly mapped to `60-safety-validation/verification-validation/robustness/`.

- [ ] **Step 2: Move autonomy files**

Run:

```powershell
npm run restructure:move -- --batch autonomy
```

Expected: `technology/` Markdown files are moved according to the path map.

- [ ] **Step 3: Rewrite links**

Run:

```powershell
npm run restructure:rewrite-links -- --batch autonomy
```

Expected: links from moved autonomy docs resolve to new paths.

- [ ] **Step 4: Check method library locations**

Run:

```powershell
Test-Path 30-autonomy-stack/perception/methods/overview.md
Test-Path 30-autonomy-stack/localization-mapping/slam-methods/overview.md
```

Expected: both commands print `True`.

- [ ] **Step 5: Check links, stale paths, and tests**

Run:

```powershell
npm run links:check
npm run restructure:check-stale -- --batch autonomy
npm test
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit Batch 3**

Run:

```powershell
git add 30-autonomy-stack 60-safety-validation README.md INDEX.md METHODOLOGY.md GLOSSARY.md .vitepress tests
git add -u technology
git commit -m "docs: move autonomy stack docs"
```

## Task 7: Move Runtime, Cloud, Safety, And Domain Operations

**Files:**

- Move: `cross-cutting/**`
- Move: `operations/deployment/**`
- Move: `operations/safety/**`
- Move: `operations/teleoperation/**`
- Move: `operations/airside/**`
- Modify: all Markdown links affected by those moves
- Test: `npm run links:check`, `npm run restructure:check-stale`, `npm test`

- [ ] **Step 1: Inspect planned operational moves**

Run:

```powershell
npm run restructure:print-map -- --batch runtime-cloud-safety-ops
```

Expected: every `cross-cutting/**.md` and `operations/**.md` file maps to `40-runtime-systems/**`, `50-cloud-fleet/**`, `60-safety-validation/**`, or `70-operations-domains/**`.

- [ ] **Step 2: Move runtime, cloud, safety, and operations files**

Run:

```powershell
npm run restructure:move -- --batch runtime-cloud-safety-ops
```

Expected: no Markdown files remain under `cross-cutting/` or `operations/`.

- [ ] **Step 3: Rewrite links**

Run:

```powershell
npm run restructure:rewrite-links -- --batch runtime-cloud-safety-ops
```

Expected: old cross-cutting and operations paths are rewritten.

- [ ] **Step 4: Check no old Markdown remains in moved directories**

Run:

```powershell
Get-ChildItem cross-cutting,operations -Recurse -Filter *.md -ErrorAction SilentlyContinue
```

Expected: no output.

- [ ] **Step 5: Check links, stale paths, and tests**

Run:

```powershell
npm run links:check
npm run restructure:check-stale -- --batch runtime-cloud-safety-ops
npm test
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit Batch 4**

Run:

```powershell
git add 40-runtime-systems 50-cloud-fleet 60-safety-validation 70-operations-domains README.md INDEX.md METHODOLOGY.md GLOSSARY.md .vitepress tests
git add -u cross-cutting operations
git commit -m "docs: move runtime cloud safety and operations docs"
```

## Task 8: Move Industry Intel And Synthesis

**Files:**

- Move: `companies/**`
- Move: `synthesis/**`
- Modify: all Markdown links affected by those moves
- Test: `npm run links:check`, `npm run restructure:check-stale`, `npm test`

- [ ] **Step 1: Inspect planned industry and synthesis moves**

Run:

```powershell
npm run restructure:print-map -- --batch industry-synthesis
```

Expected: all company docs map to `80-industry-intel/companies/**`; synthesis docs map to `90-synthesis/**` or `80-industry-intel/market-competitive/competitive-landscape.md`.

- [ ] **Step 2: Move industry and synthesis files**

Run:

```powershell
npm run restructure:move -- --batch industry-synthesis
```

Expected: no Markdown files remain under `companies/` or `synthesis/`.

- [ ] **Step 3: Rewrite links**

Run:

```powershell
npm run restructure:rewrite-links -- --batch industry-synthesis
```

Expected: company and synthesis links resolve to new paths.

- [ ] **Step 4: Check links, stale paths, and tests**

Run:

```powershell
npm run links:check
npm run restructure:check-stale -- --batch industry-synthesis
npm test
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Batch 5**

Run:

```powershell
git add 80-industry-intel 90-synthesis README.md INDEX.md METHODOLOGY.md GLOSSARY.md .vitepress tests
git add -u companies synthesis
git commit -m "docs: move industry intel and synthesis docs"
```

## Task 9: Update Root Docs, Counts, And Corpus Map

**Files:**

- Modify: `README.md`
- Modify: `INDEX.md`
- Modify: `METHODOLOGY.md`
- Modify: `GLOSSARY.md` only if links changed
- Test: `npm run links:check`, `npm test`

- [ ] **Step 1: Recompute counts**

Run:

```powershell
$publicMd = Get-ChildItem -Recurse -Filter *.md | Where-Object {
  $_.FullName -notmatch '\\node_modules\\' -and
  $_.FullName -notmatch '\\docs\\superpowers\\' -and
  $_.FullName -notmatch '\\.git\\'
}
$publicMd.Count
($publicMd | ForEach-Object { (Get-Content $_.FullName | Measure-Object -Line).Lines } | Measure-Object -Sum).Sum
Get-ChildItem 30-autonomy-stack/perception -Recurse -Filter *.md | Measure-Object | Select-Object -ExpandProperty Count
Get-ChildItem 30-autonomy-stack/perception/methods -Filter *.md | Where-Object { $_.Name -ne 'overview.md' } | Measure-Object | Select-Object -ExpandProperty Count
Get-ChildItem 30-autonomy-stack/localization-mapping/slam-methods -Filter *.md | Where-Object { $_.Name -ne 'overview.md' } | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: counts match the moved corpus and method-library counts.

- [ ] **Step 2: Update `README.md`**

Update:

- Current shape counts.
- Start Here links.
- High-Leverage Reading Paths.
- Corpus Map table to list the numbered architecture.
- Domain Snapshot to match new directories.

- [ ] **Step 3: Update `INDEX.md`**

Update:

- Quick navigation paths.
- All moved file path strings.
- Document Statistics.
- Any old top-level section names.

- [ ] **Step 4: Update `METHODOLOGY.md`**

Update:

- Corpus counts.
- Current reading surface description.
- Phase descriptions that reference old directories.
- Extension instructions to use numbered directories.

- [ ] **Step 5: Run checks**

Run:

```powershell
npm run links:check
npm run restructure:check-stale
npm test
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit root docs update**

Run:

```powershell
git add README.md INDEX.md METHODOLOGY.md GLOSSARY.md
git commit -m "docs: update root docs for AV knowledge architecture"
```

## Task 10: Cleanup Old Directories And Verify Full Build

**Files:**

- Remove empty old directories if present: `companies/`, `cross-cutting/`, `foundations/`, `hardware/`, `operations/`, `synthesis/`, `technology/`
- Verify: `.vitepress/config.mjs` excludes `tools/restructure/**`
- Verify: `tests/site-config.test.mjs` asserts the tooling exclusion
- Test: `npm run verify`

- [ ] **Step 1: Remove empty old directories**

Run:

```powershell
foreach ($dir in @('companies','cross-cutting','foundations','hardware','operations','synthesis','technology')) {
  if ((Test-Path $dir) -and -not (Get-ChildItem $dir -Recurse -Force)) {
    Remove-Item -Recurse -Force $dir
  }
}
```

Expected: old content directories no longer exist if empty.

- [ ] **Step 2: Confirm restructure tooling is excluded from public pages**

Run:

```powershell
Select-String -Path .vitepress/config.mjs -Pattern 'tools/restructure/\*\*'
Select-String -Path tests/site-config.test.mjs -Pattern 'tools/restructure/\*\*'
```

Expected: both commands print a match.

- [ ] **Step 3: Check no old top-level content directories remain with Markdown**

Run:

```powershell
Get-ChildItem companies,cross-cutting,foundations,hardware,operations,synthesis,technology -Recurse -Filter *.md -ErrorAction SilentlyContinue
```

Expected: no output.

- [ ] **Step 4: Run final local verification**

Run:

```powershell
git diff --check
npm run links:check
npm run restructure:check-stale
npm run verify
```

Expected: all commands exit 0. Existing VitePress syntax-highlighter warnings for `dbc` and `smt2` are acceptable if the process exits 0.

- [ ] **Step 5: Commit cleanup**

Run:

```powershell
git add .vitepress tests package.json package-lock.json tools README.md INDEX.md METHODOLOGY.md GLOSSARY.md
git add -A
git commit -m "docs: finalize AV knowledge architecture migration"
```

## Task 11: Push And Check GitHub Pages

**Files:**

- No file edits expected.
- Test: GitHub Actions Pages deployment and live route checks.

- [ ] **Step 1: Confirm local status**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: Push**

Run:

```powershell
git push
```

Expected: push succeeds.

- [ ] **Step 3: Find latest Pages run**

Run:

```powershell
gh run list --workflow 'Deploy VitePress site to Pages' --branch main --limit 5
```

Expected: latest run is `Deploy VitePress site to Pages` for the final restructure commit.

- [ ] **Step 4: Watch Pages run**

Run:

```powershell
$runId = gh run list --workflow 'Deploy VitePress site to Pages' --branch main --limit 1 --json databaseId --jq '.[0].databaseId'
$runId
gh run watch $runId --exit-status
```

Expected: build and deploy jobs succeed.

- [ ] **Step 5: Check live root and deep routes**

Run:

```powershell
$urls = @(
  'https://kvynlim.github.io/industry-research/',
  'https://kvynlim.github.io/industry-research/00-start-here/reading-guide',
  'https://kvynlim.github.io/industry-research/30-autonomy-stack/perception/methods/bevdepth',
  'https://kvynlim.github.io/industry-research/30-autonomy-stack/localization-mapping/slam-methods/glim',
  'https://kvynlim.github.io/industry-research/60-safety-validation/standards-certification/iso-3691-4-deep-dive',
  'https://kvynlim.github.io/industry-research/90-synthesis/master/master-synthesis'
)
foreach ($url in $urls) {
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing
  "$($resp.StatusCode) $url"
}
```

Expected: every route returns `200`.

## Task 12: Final Report

**Files:**

- No file edits expected.

- [ ] **Step 1: Gather final evidence**

Run:

```powershell
git log -6 --oneline
git status --short
```

Expected:

- Recent commits show the migration batches.
- `git status --short` has no output.

- [ ] **Step 2: Report outcome**

Final response must include:

- New architecture summary.
- Number of moved docs.
- Verification commands and pass status.
- Commit hash range or final commit hash.
- GitHub Pages run ID and success status.
- Live route examples.
- Any residual risk, such as old external bookmarks changing for deep pages.
