# Autonomy Method Priority Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated priority metadata and generated priority overview tables for method-level perception and SLAM pages.

**Architecture:** Method pages remain Markdown source of truth. A small Node parser reads hidden `method-priority` comments, validates the seven-field schema, and a generator writes deterministic Markdown priority tables into the perception and SLAM overview pages. Seed metadata is added to 15 perception and 15 SLAM pages first; missing metadata remains allowed during rollout.

**Tech Stack:** Node 20 ESM, built-in `node:test`, Markdown files, no new runtime dependency.

---

## File Structure

- Create `tools/autonomy-priority/priority-metadata.mjs`: parser, schema constants, validation helpers, repository scanner, and CLI `--check`.
- Create `tools/autonomy-priority/generate-overviews.mjs`: reads valid metadata and rewrites priority table marker blocks in both overview pages.
- Create `tests/autonomy-priority.test.mjs`: parser, validator, scanner, and table-generation tests.
- Modify `package.json`: add `priority:check`, `priority:generate`, and include the new test file in `npm test`.
- Modify `30-autonomy-stack/perception/methods/overview.md`: add the rating explanation and generated table marker block.
- Modify `30-autonomy-stack/localization-mapping/slam-methods/overview.md`: add the rating explanation and generated table marker block.
- Modify 15 perception method pages and 15 SLAM method pages: insert hidden priority metadata after H1 and before the first `##`.

## Seed Rating Set

SLAM seed pages:

| File | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |
|---|---:|---:|---|---|---|---|---|
| `ekf-slam.md` | 5 | 2 | `method-family` | `foundation` | `historical` | `slam`, `indoor` | Foundation for estimator thinking, but rarely the direct modern AV stack. |
| `graphslam-pose-graph-optimization.md` | 5 | 4 | `method-family` | `foundation` | `fielded-pattern` | `slam`, `mapping`, `runtime-localization` | Core graph formulation behind mapping, loop closure, and smoothing. |
| `icp.md` | 5 | 5 | `method-family` | `foundation` | `fielded-pattern` | `slam`, `mapping`, `runtime-localization` | Core registration primitive behind LiDAR odometry and scan-to-map localization. |
| `ndt.md` | 4 | 5 | `method` | `deployment-pattern` | `fielded-pattern` | `runtime-localization`, `road-av`, `outdoor` | Mature scan-to-map localization pattern used in AV and robotics stacks. |
| `kiss-icp.md` | 4 | 4 | `method` | `modern-core` | `prototype` | `slam`, `mapping`, `outdoor` | Strong LiDAR-only odometry baseline for evaluating registration stacks. |
| `fast-lio-fast-lio2.md` | 4 | 5 | `method-family` | `modern-core` | `fielded-pattern` | `slam`, `mapping`, `runtime-localization`, `outdoor` | Core LiDAR-inertial baseline for mapping and localization fallback. |
| `lio-sam.md` | 4 | 5 | `method` | `modern-core` | `fielded-pattern` | `slam`, `mapping`, `runtime-localization` | Canonical factor-graph LIO reference for LiDAR, IMU, GPS, and loop factors. |
| `factor-graph-isam2-gtsam.md` | 5 | 4 | `architecture-pattern` | `foundation` | `fielded-pattern` | `slam`, `mapping`, `runtime-localization` | Backend pattern for smoothing, loop closure, and multi-sensor pose estimation. |
| `orb-slam2-orb-slam3.md` | 4 | 3 | `method-family` | `classic-baseline` | `fielded-pattern` | `slam`, `indoor`, `outdoor` | Strong visual SLAM baseline, but not a primary AV localization backbone. |
| `openvins.md` | 4 | 4 | `method` | `modern-core` | `fielded-pattern` | `slam`, `fallback`, `indoor` | Practical VIO baseline for camera-IMU state estimation and fallback odometry. |
| `vins-mono-vins-fusion.md` | 4 | 4 | `method-family` | `modern-core` | `fielded-pattern` | `slam`, `fallback`, `gnss-denied` | Widely used visual-inertial baseline for GNSS-denied motion estimation. |
| `scan-context-family.md` | 4 | 5 | `method-family` | `deployment-pattern` | `fielded-pattern` | `slam`, `runtime-localization`, `mapping` | Core LiDAR place-recognition pattern for loop closure and relocalization. |
| `cartographer-3d.md` | 3 | 4 | `method` | `classic-baseline` | `fielded-pattern` | `slam`, `mapping`, `indoor` | Mature submap SLAM reference for indoor and robotics mapping. |
| `rtab-map.md` | 3 | 4 | `method` | `deployment-pattern` | `fielded-pattern` | `slam`, `mapping`, `indoor` | Practical multi-sensor robotics SLAM stack with broad deployment use. |
| `splat-slam.md` | 3 | 2 | `method` | `frontier` | `research` | `slam`, `mapping`, `simulation` | Useful Gaussian SLAM reference, but not a runtime pose backbone. |

Perception seed pages:

| File | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |
|---|---:|---:|---|---|---|---|---|
| `bevdet.md` | 4 | 4 | `method` | `modern-core` | `prototype` | `perception`, `road-av` | Baseline camera BEV detector that organizes many later BEV methods. |
| `bevdepth.md` | 4 | 4 | `method` | `modern-core` | `prototype` | `perception`, `road-av` | Important depth-aware BEV bridge for camera-only 3D perception. |
| `sparse4d.md` | 3 | 4 | `method-family` | `modern-core` | `prototype` | `perception`, `road-av` | Practical sparse-query direction for camera 3D detection and tracking. |
| `surroundocc.md` | 4 | 4 | `method` | `modern-core` | `prototype` | `perception`, `road-av`, `validation` | Foundational camera occupancy reference for planning-facing perception. |
| `lidar-mos.md` | 4 | 5 | `method-family` | `deployment-pattern` | `prototype` | `perception`, `mapping`, `validation` | Moving-object segmentation is central to map hygiene and dynamic-scene handling. |
| `4dmos.md` | 3 | 4 | `method` | `modern-core` | `prototype` | `perception`, `mapping`, `validation` | Extends LiDAR motion segmentation with temporal 4D reasoning. |
| `radarpillars.md` | 4 | 4 | `method` | `classic-baseline` | `prototype` | `perception`, `adverse-weather` | Core radar-native detection baseline for weather-robust perception. |
| `k-radar.md` | 3 | 4 | `benchmark` | `modern-core` | `fielded-pattern` | `perception`, `adverse-weather`, `validation` | Key 4D radar dataset and benchmark for all-weather perception evaluation. |
| `cvfusion.md` | 3 | 4 | `method` | `modern-core` | `prototype` | `perception`, `adverse-weather` | Important radar-camera fusion method for degraded visual conditions. |
| `availability-aware-sensor-fusion.md` | 4 | 5 | `architecture-pattern` | `deployment-pattern` | `prototype` | `perception`, `fallback`, `validation` | Directly targets sensor degradation and availability-aware fusion. |
| `mome.md` | 3 | 4 | `method` | `modern-core` | `prototype` | `perception`, `fallback`, `validation` | Useful resilient fusion pattern for adverse sensor failure cases. |
| `conformal-boxes.md` | 4 | 4 | `method` | `deployment-pattern` | `prototype` | `perception`, `validation` | Practical uncertainty wrapper for detection risk and release gates. |
| `openad.md` | 4 | 4 | `benchmark` | `modern-core` | `fielded-pattern` | `perception`, `validation`, `data-engine` | Open-world benchmark for corner cases and unseen categories. |
| `clipomaly.md` | 3 | 3 | `method` | `frontier` | `research` | `perception`, `validation`, `data-engine` | Useful anomaly-detection reference for long-tail discovery workflows. |
| `rcooper.md` | 3 | 3 | `benchmark` | `frontier` | `fielded-pattern` | `perception`, `validation`, `road-av` | Cooperative-perception dataset relevant to infrastructure-assisted sensing. |

### Task 1: Priority Parser Tests

**Files:**
- Create: `tests/autonomy-priority.test.mjs`

- [ ] **Step 1: Write failing parser and validator tests**

Create `tests/autonomy-priority.test.mjs` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALLOWED_STAGE_VALUES,
  ALLOWED_TAGS,
  ALLOWED_TYPE_VALUES,
  extractPriorityBlocks,
  parsePriorityYaml,
  validatePriority
} from '../tools/autonomy-priority/priority-metadata.mjs'

const validMarkdown = `# FAST-LIO and FAST-LIO2

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "Core LiDAR-inertial baseline for mapping and localization fallback."
method-priority:end -->

## Executive Summary
Body.
`

test('extracts one hidden priority block before the first section', () => {
  const blocks = extractPriorityBlocks(validMarkdown, 'fast-lio-fast-lio2.md')
  assert.equal(blocks.length, 1)
  assert.match(blocks[0].body, /learning: 4/)
})

test('parses the priority YAML subset', () => {
  const [block] = extractPriorityBlocks(validMarkdown, 'fast-lio-fast-lio2.md')
  assert.deepEqual(parsePriorityYaml(block.body), {
    learning: 4,
    deployment: 5,
    type: 'method-family',
    stage: 'modern-core',
    maturity: 'fielded-pattern',
    tags: ['slam', 'mapping', 'runtime-localization', 'outdoor'],
    reason: 'Core LiDAR-inertial baseline for mapping and localization fallback.'
  })
})

test('validates the balanced seven-field schema', () => {
  const [block] = extractPriorityBlocks(validMarkdown, 'fast-lio-fast-lio2.md')
  const result = validatePriority(parsePriorityYaml(block.body), 'fast-lio-fast-lio2.md')
  assert.deepEqual(result.errors, [])
})

test('rejects duplicate blocks', () => {
  const markdown = `${validMarkdown}\n${validMarkdown}`
  assert.throws(
    () => extractPriorityBlocks(markdown, 'duplicate.md'),
    /duplicate.md: expected at most one method-priority block/
  )
})

test('rejects malformed values', () => {
  const priority = {
    learning: 6,
    deployment: 5,
    type: 'paper',
    stage: 'modern-core',
    maturity: 'fielded-pattern',
    tags: ['slam', 'unknown-tag'],
    reason: 'Too short.'
  }
  const result = validatePriority(priority, 'bad.md')
  assert.ok(result.errors.some((error) => error.includes('learning must be an integer from 1 to 5')))
  assert.ok(result.errors.some((error) => error.includes('type must be one of')))
  assert.ok(result.errors.some((error) => error.includes('unknown tag unknown-tag')))
  assert.ok(result.errors.some((error) => error.includes('reason must be 40-180 characters')))
})

test('exports stable enum sets for documentation and generation', () => {
  assert.ok(ALLOWED_TYPE_VALUES.includes('method-family'))
  assert.ok(ALLOWED_STAGE_VALUES.includes('deployment-pattern'))
  assert.ok(ALLOWED_TAGS.includes('runtime-localization'))
})
```

- [ ] **Step 2: Run the parser tests and verify they fail**

Run: `node --test tests/autonomy-priority.test.mjs`

Expected: FAIL with `Cannot find module '../tools/autonomy-priority/priority-metadata.mjs'`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/autonomy-priority.test.mjs
git commit -m "test: cover autonomy priority metadata parsing"
```

### Task 2: Priority Parser And Validator

**Files:**
- Create: `tools/autonomy-priority/priority-metadata.mjs`
- Test: `tests/autonomy-priority.test.mjs`

- [ ] **Step 1: Implement the parser module**

Create `tools/autonomy-priority/priority-metadata.mjs` with:

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const TARGET_DIRS = [
  '30-autonomy-stack/perception/methods',
  '30-autonomy-stack/localization-mapping/slam-methods'
]

export const ALLOWED_TYPE_VALUES = ['method', 'method-family', 'architecture-pattern', 'benchmark']
export const ALLOWED_STAGE_VALUES = [
  'foundation',
  'classic-baseline',
  'modern-core',
  'deployment-pattern',
  'frontier',
  'reference'
]
export const ALLOWED_MATURITY_VALUES = [
  'fielded-pattern',
  'pilot-proven',
  'prototype',
  'research',
  'watchlist',
  'historical'
]
export const ALLOWED_TAGS = [
  'road-av',
  'airside',
  'warehouse',
  'logistics-yard',
  'port',
  'outdoor-campus',
  'mining',
  'agriculture',
  'construction',
  'delivery-robot',
  'perception',
  'slam',
  'mapping',
  'runtime-localization',
  'fallback',
  'validation',
  'data-engine',
  'simulation',
  'indoor',
  'outdoor',
  'gnss-denied',
  'adverse-weather'
]

const priorityBlockPattern =
  /<!--\s*method-priority:start\s*\r?\n([\s\S]*?)\r?\nmethod-priority:end\s*-->/g

export function normalizeRelPath(filePath, root = repoRoot) {
  return path.relative(root, filePath).replace(/\\/g, '/')
}

export function extractPriorityBlocks(markdown, relPath) {
  const blocks = [...markdown.matchAll(priorityBlockPattern)].map((match) => ({
    body: match[1],
    index: match.index ?? -1
  }))

  if (blocks.length > 1) {
    throw new Error(`${relPath}: expected at most one method-priority block, found ${blocks.length}`)
  }

  const firstSection = markdown.search(/^##\s+/m)
  if (blocks.length === 1 && firstSection !== -1 && blocks[0].index > firstSection) {
    throw new Error(`${relPath}: method-priority block must appear before the first ## heading`)
  }

  return blocks
}

function parseScalar(rawValue, relPath, key) {
  const raw = rawValue.trim()
  if (/^\d+$/.test(raw)) return Number(raw)
  if (/^"[^"]*"$/.test(raw)) return raw.slice(1, -1)
  if (/^\[[^\]]*\]$/.test(raw)) {
    const inner = raw.slice(1, -1).trim()
    if (inner === '') return []
    return inner.split(',').map((item) => {
      const value = item.trim()
      if (!/^"[^"]+"$/.test(value)) {
        throw new Error(`${relPath}: ${key} list values must be quoted strings`)
      }
      return value.slice(1, -1)
    })
  }
  throw new Error(`${relPath}: unsupported value for ${key}: ${raw}`)
}

export function parsePriorityYaml(body, relPath = 'priority block') {
  const lines = body.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines[0]?.trim() !== 'priority:') {
    throw new Error(`${relPath}: priority block must start with "priority:"`)
  }

  const priority = {}
  for (const line of lines.slice(1)) {
    const match = line.match(/^  ([a-z_]+):\s*(.+)$/)
    if (!match) {
      throw new Error(`${relPath}: unsupported priority line "${line}"`)
    }
    const [, key, rawValue] = match
    priority[key] = parseScalar(rawValue, relPath, key)
  }
  return priority
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length
}

function validateEnum(errors, priority, key, allowed, relPath) {
  if (!allowed.includes(priority[key])) {
    errors.push(`${relPath}: ${key} must be one of ${allowed.join(', ')}`)
  }
}

export function validatePriority(priority, relPath) {
  const errors = []
  const required = ['learning', 'deployment', 'type', 'stage', 'maturity', 'tags', 'reason']
  for (const key of required) {
    if (!(key in priority)) errors.push(`${relPath}: missing required field ${key}`)
  }

  for (const key of ['learning', 'deployment']) {
    if (!Number.isInteger(priority[key]) || priority[key] < 1 || priority[key] > 5) {
      errors.push(`${relPath}: ${key} must be an integer from 1 to 5`)
    }
  }

  validateEnum(errors, priority, 'type', ALLOWED_TYPE_VALUES, relPath)
  validateEnum(errors, priority, 'stage', ALLOWED_STAGE_VALUES, relPath)
  validateEnum(errors, priority, 'maturity', ALLOWED_MATURITY_VALUES, relPath)

  if (!Array.isArray(priority.tags)) {
    errors.push(`${relPath}: tags must be an array`)
  } else {
    if (priority.tags.length < 2 || priority.tags.length > 6) {
      errors.push(`${relPath}: tags must contain 2-6 values`)
    }
    if (hasDuplicates(priority.tags)) {
      errors.push(`${relPath}: tags must be unique`)
    }
    for (const tag of priority.tags) {
      if (!ALLOWED_TAGS.includes(tag)) errors.push(`${relPath}: unknown tag ${tag}`)
    }
  }

  if (typeof priority.reason !== 'string' || priority.reason.length < 40 || priority.reason.length > 180) {
    errors.push(`${relPath}: reason must be 40-180 characters`)
  }
  return { errors }
}

export function readMarkdownFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...readMarkdownFiles(absPath))
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(absPath)
  }
  return files
}

export function readPriorityFromFile(filePath, root = repoRoot) {
  const relPath = normalizeRelPath(filePath, root)
  const markdown = fs.readFileSync(filePath, 'utf8')
  const blocks = extractPriorityBlocks(markdown, relPath)
  if (blocks.length === 0) return { relPath, priority: null, errors: [] }

  const priority = parsePriorityYaml(blocks[0].body, relPath)
  const { errors } = validatePriority(priority, relPath)
  return { relPath, priority, errors }
}

export function scanPriorityMetadata(root = repoRoot) {
  const results = []
  for (const relDir of TARGET_DIRS) {
    for (const file of readMarkdownFiles(path.join(root, relDir))) {
      results.push(readPriorityFromFile(file, root))
    }
  }
  return results
}

export function titleFromMarkdown(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : path.basename(fallback, '.md')
}

export function priorityRowsForDirectory(relDir, root = repoRoot) {
  return scanPriorityMetadata(root)
    .filter((entry) => entry.priority && entry.relPath.startsWith(`${relDir}/`))
    .map((entry) => {
      const markdown = fs.readFileSync(path.join(root, entry.relPath), 'utf8')
      return { ...entry, title: titleFromMarkdown(markdown, entry.relPath) }
    })
    .sort((a, b) =>
      b.priority.deployment - a.priority.deployment ||
      b.priority.learning - a.priority.learning ||
      a.title.localeCompare(b.title, 'en')
    )
}

export function checkPriorityMetadata(root = repoRoot) {
  const errors = []
  for (const entry of scanPriorityMetadata(root)) errors.push(...entry.errors)
  return { ok: errors.length === 0, errors }
}

if (process.argv.includes('--check')) {
  const result = checkPriorityMetadata()
  for (const error of result.errors) console.error(error)
  process.exit(result.ok ? 0 : 1)
}
```

- [ ] **Step 2: Run parser tests**

Run: `node --test tests/autonomy-priority.test.mjs`

Expected: PASS.

- [ ] **Step 3: Commit parser implementation**

```bash
git add tools/autonomy-priority/priority-metadata.mjs tests/autonomy-priority.test.mjs
git commit -m "feat: add autonomy priority metadata parser"
```

### Task 3: Validation Script Wiring

**Files:**
- Modify: `package.json`
- Test: `tests/autonomy-priority.test.mjs`

- [ ] **Step 1: Add package scripts and test entry**

Modify `package.json` scripts to:

```json
{
  "docs:dev": "vitepress dev . --host 127.0.0.1",
  "docs:build": "vitepress build .",
  "docs:preview": "vitepress preview . --host 127.0.0.1",
  "restructure:print-map": "node tools/restructure/migrate.mjs --print-map",
  "restructure:move": "node tools/restructure/migrate.mjs --move",
  "restructure:rewrite-links": "node tools/restructure/migrate.mjs --rewrite-links",
  "restructure:check-stale": "node tools/restructure/migrate.mjs --check-stale",
  "links:check": "node tools/restructure/check-links.mjs",
  "priority:check": "node tools/autonomy-priority/priority-metadata.mjs --check",
  "priority:generate": "node tools/autonomy-priority/generate-overviews.mjs",
  "test": "node --test tests/navigation.test.mjs tests/site-config.test.mjs tests/content-smoke.test.mjs tests/workflow.test.mjs tests/restructure-map.test.mjs tests/autonomy-priority.test.mjs",
  "verify": "npm test && npm run priority:check && npm run docs:build"
}
```

- [ ] **Step 2: Run validation before metadata exists**

Run: `npm run priority:check`

Expected: PASS with no output, because missing metadata is allowed during rollout.

- [ ] **Step 3: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Commit script wiring**

```bash
git add package.json
git commit -m "chore: wire autonomy priority validation scripts"
```

### Task 4: Overview Generator

**Files:**
- Create: `tools/autonomy-priority/generate-overviews.mjs`
- Modify: `tests/autonomy-priority.test.mjs`

- [ ] **Step 1: Add generator tests**

Append to `tests/autonomy-priority.test.mjs`:

```js
import { formatPriorityTable, replaceGeneratedBlock } from '../tools/autonomy-priority/generate-overviews.mjs'

test('formats priority rows as deterministic Markdown', () => {
  const table = formatPriorityTable([
    {
      relPath: '30-autonomy-stack/perception/methods/bevdet.md',
      title: 'BEVDet',
      priority: {
        learning: 4,
        deployment: 4,
        type: 'method',
        stage: 'modern-core',
        maturity: 'prototype',
        tags: ['perception', 'road-av'],
        reason: 'Baseline camera BEV detector that organizes many later BEV methods.'
      }
    }
  ], '30-autonomy-stack/perception/methods')

  assert.match(table, /\| \[BEVDet\]\(bevdet\.md\) \| 4 \| 4 \| `method` \| `modern-core` \| `prototype` \| `perception`, `road-av` \|/)
})

test('replaces generated priority table marker blocks', () => {
  const source = `# Overview

## Priority Ratings

<!-- priority-table:start -->
old
<!-- priority-table:end -->
`
  const next = replaceGeneratedBlock(source, 'new table')
  assert.match(next, /<!-- priority-table:start -->\nnew table\n<!-- priority-table:end -->/)
})
```

- [ ] **Step 2: Run generator tests and verify they fail**

Run: `node --test tests/autonomy-priority.test.mjs`

Expected: FAIL with missing export from `generate-overviews.mjs`.

- [ ] **Step 3: Implement overview generator**

Create `tools/autonomy-priority/generate-overviews.mjs` with:

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { repoRoot, priorityRowsForDirectory } from './priority-metadata.mjs'

const OVERVIEWS = [
  {
    relDir: '30-autonomy-stack/perception/methods',
    overview: '30-autonomy-stack/perception/methods/overview.md'
  },
  {
    relDir: '30-autonomy-stack/localization-mapping/slam-methods',
    overview: '30-autonomy-stack/localization-mapping/slam-methods/overview.md'
  }
]

const blockPattern = /<!-- priority-table:start -->[\s\S]*?<!-- priority-table:end -->/

export function formatPriorityTable(rows, relDir) {
  if (rows.length === 0) return 'No rated method pages yet.'

  const lines = [
    '| Method | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |',
    '|---|---:|---:|---|---|---|---|---|'
  ]

  for (const row of rows) {
    const href = path.posix.relative(relDir, row.relPath)
    const tags = row.priority.tags.map((tag) => `\`${tag}\``).join(', ')
    lines.push(
      `| [${row.title}](${href}) | ${row.priority.learning} | ${row.priority.deployment} | ` +
        `\`${row.priority.type}\` | \`${row.priority.stage}\` | \`${row.priority.maturity}\` | ` +
        `${tags} | ${row.priority.reason} |`
    )
  }
  return lines.join('\n')
}

export function replaceGeneratedBlock(markdown, table) {
  if (!blockPattern.test(markdown)) {
    throw new Error('overview page is missing priority-table marker block')
  }
  return markdown.replace(blockPattern, `<!-- priority-table:start -->\n${table}\n<!-- priority-table:end -->`)
}

export function updateOverview({ relDir, overview }, root = repoRoot) {
  const overviewPath = path.join(root, overview)
  const markdown = fs.readFileSync(overviewPath, 'utf8')
  const table = formatPriorityTable(priorityRowsForDirectory(relDir, root), relDir)
  fs.writeFileSync(overviewPath, replaceGeneratedBlock(markdown, table))
}

export function updateAllOverviews(root = repoRoot) {
  for (const config of OVERVIEWS) updateOverview(config, root)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateAllOverviews()
}
```

- [ ] **Step 4: Run generator tests**

Run: `node --test tests/autonomy-priority.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit overview generator**

```bash
git add tools/autonomy-priority/generate-overviews.mjs tests/autonomy-priority.test.mjs
git commit -m "feat: generate autonomy priority overview tables"
```

### Task 5: Overview Rating Sections

**Files:**
- Modify: `30-autonomy-stack/perception/methods/overview.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/overview.md`

- [ ] **Step 1: Add the perception priority section**

Insert after the opening paragraph in `30-autonomy-stack/perception/methods/overview.md`:

```md
## Priority Ratings

Priority ratings are editorial reading and deployment triage signals. `Learning` answers what to read early for general autonomy understanding. `Deployment` answers what to evaluate early for AV deployment in the tagged context; it is not a certification or product-readiness claim.

<!-- priority-table:start -->
No rated method pages yet.
<!-- priority-table:end -->
```

- [ ] **Step 2: Add the SLAM priority section**

Insert after the opening production-stack paragraph in `30-autonomy-stack/localization-mapping/slam-methods/overview.md`:

```md
## Priority Ratings

Priority ratings are editorial reading and deployment triage signals. `Learning` answers what to read early for SLAM/localization understanding. `Deployment` answers what to evaluate early for AV deployment in the tagged context; it is not a certification or product-readiness claim.

<!-- priority-table:start -->
No rated method pages yet.
<!-- priority-table:end -->
```

- [ ] **Step 3: Run generator with no seed metadata**

Run: `npm run priority:generate`

Expected: both marker blocks remain with `No rated method pages yet.`

- [ ] **Step 4: Commit overview sections**

```bash
git add 30-autonomy-stack/perception/methods/overview.md 30-autonomy-stack/localization-mapping/slam-methods/overview.md
git commit -m "docs: add autonomy priority rating overview sections"
```

### Task 6: Seed Priority Metadata

**Files:**
- Modify: the 30 seed pages listed in the Seed Rating Set.

- [ ] **Step 1: Insert metadata blocks**

For each seed page, insert this shape after the H1 and before the first `##`, replacing values from the Seed Rating Set:

```yaml
<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "Core LiDAR-inertial baseline for mapping and localization fallback."
method-priority:end -->
```

- [ ] **Step 2: Validate metadata**

Run: `npm run priority:check`

Expected: PASS with no output.

- [ ] **Step 3: Generate overview tables**

Run: `npm run priority:generate`

Expected: perception and SLAM overview marker blocks contain generated Markdown tables sorted by deployment, learning, then title.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit seed metadata and generated tables**

```bash
git add 30-autonomy-stack/perception/methods 30-autonomy-stack/localization-mapping/slam-methods
git commit -m "docs: seed autonomy method priority ratings"
```

### Task 7: Final Verification

**Files:**
- No direct file edits.

- [ ] **Step 1: Run full verification**

Run: `npm run verify`

Expected: `npm test`, `npm run priority:check`, and `vitepress build .` all pass.

- [ ] **Step 2: Inspect generated overview diff**

Run: `git diff -- 30-autonomy-stack/perception/methods/overview.md 30-autonomy-stack/localization-mapping/slam-methods/overview.md`

Expected: only the priority table marker contents changed after generation.

## Self-Review Notes

- Spec coverage: parser/validation, generated overview tables, seed page ratings, broad AV tags, and partial rollout behavior are covered by Tasks 1-7.
- Red-flag scan: the plan contains no banned placeholder tokens or unspecified file paths.
- Type consistency: field names are `learning`, `deployment`, `type`, `stage`, `maturity`, `tags`, and `reason` throughout.
