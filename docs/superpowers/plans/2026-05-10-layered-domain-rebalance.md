# Layered Domain Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance the corpus framing so it reads as a generic AV knowledge base with airside as a well-developed reference ODD, while preserving tag-scoped ratings and valid airside depth.

**Architecture:** Keep generated rating tables and hidden method metadata stable. Add a small read-only domain-balance audit tool, then update only pattern-setting docs and overview prose around the generated blocks. Treat airside-specific pages as valid reference-ODD content, but change generic rubrics from "Airside Fit" to "Domain Fit."

**Tech Stack:** Markdown, Node.js ESM, Node test runner, VitePress, existing npm scripts.

---

## Pre-Flight Notes

- Before implementation, run Task 0 and treat any existing worktree changes as user-owned. Do not overwrite or stage unrelated files.
- Do not manually edit generated table content between `<!-- priority-table:start -->` and `<!-- priority-table:end -->`.
- Do not change hidden `method-priority` blocks in individual method pages.
- Commit after each task so review can isolate regressions.

## File Structure

Create:

- `tools/domain-balance/audit.mjs`: read-only domain signal audit. Exports functions for tests and prints deterministic Markdown tables when run as a CLI.
- `tests/domain-balance.test.mjs`: unit tests for audit scope, counts, deterministic formatting, and no file writes.

Modify:

- `package.json`: add `domain:audit` script and include `tests/domain-balance.test.mjs` in `test`.
- `README.md`: global framing and cross-domain reading path.
- `METHODOLOGY.md`: domain stance, Phase 10 rubric wording, quality control, limitation, extension guidance.
- `00-start-here/repo-map.md`: operations-domain description aligned to canonical domain vocabulary.
- `30-autonomy-stack/perception/methods/overview.md`: rating guidance, Domain Fit guidance, file-boundary rule, standard page shape.
- `30-autonomy-stack/localization-mapping/slam-methods/overview.md`: opening framing, rating guidance, Domain Fit guidance.
- `90-synthesis/readiness-risk/continuous-research-loop.md`: promotion rule language.
- `90-synthesis/readiness-risk/technology-readiness.md`: TRL table lens.
- `90-synthesis/master/master-synthesis.md`: title/scope and airside-as-reference framing.
- `90-synthesis/decisions/design-spec.md`: title/scope and "domain-aware" language.
- Up to five high-impact generic overview pages if their intro/summary defaults to airside. Start with:
  - `30-autonomy-stack/perception/overview/production-perception-systems.md`
  - `30-autonomy-stack/world-models/overview.md`
  - `90-synthesis/master/getting-started.md`

---

### Task 0: Confirm Clean Scope

**Files:**
- Inspect only: git status and relevant diffs.

- [ ] **Step 1: Check worktree state**

Run:

```powershell
git status --short
```

Expected:

```text
# no output at the time this plan was written
```

If files are listed, inspect the relevant diff before editing and record them as user-owned unless they belong to this task.

- [ ] **Step 2: Commit checkpoint**

No commit for this task. It is a guardrail checkpoint only.

---

### Task 1: Add Domain-Balance Audit Tool

**Files:**
- Create: `tools/domain-balance/audit.mjs`
- Create: `tests/domain-balance.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain-balance.test.mjs` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  auditDomainBalance,
  formatAuditReport,
  publicMarkdownFiles
} from '../tools/domain-balance/audit.mjs'

function writeFile(root, relPath, content) {
  const absPath = path.join(root, relPath)
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(absPath, content, 'utf8')
}

function listFiles(root) {
  const files = []
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absPath = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(absPath)
      if (entry.isFile()) files.push(path.relative(root, absPath).replace(/\\/g, '/'))
    }
  }
  walk(root)
  return files
}

test('publicMarkdownFiles includes reader Markdown and excludes internal artifacts', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-balance-scope-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  writeFile(root, 'README.md', '# Home\nAirside and road AV.\n')
  writeFile(root, 'INDEX.md', '# Index\n')
  writeFile(root, 'METHODOLOGY.md', '# Methodology\n')
  writeFile(root, 'GLOSSARY.md', '# Glossary\n')
  writeFile(root, '30-autonomy-stack/perception/example.md', '# Example\nwarehouse robot\n')
  writeFile(root, 'docs/superpowers/specs/internal.md', '# Internal\nairside airside airside\n')
  writeFile(root, '.vitepress/dist/generated.md', '# Generated\nroad road\n')
  writeFile(root, 'tools/domain-balance/readme.md', '# Tool\nmining\n')
  writeFile(root, 'tests/fixture.md', '# Fixture\nport\n')

  assert.deepEqual(publicMarkdownFiles(root), [
    'README.md',
    'INDEX.md',
    'METHODOLOGY.md',
    'GLOSSARY.md',
    '30-autonomy-stack/perception/example.md'
  ])
})

test('auditDomainBalance counts domains by file and mention without writing files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-balance-counts-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  writeFile(root, 'README.md', '# Home\nAirside apron GSE. Road AV and robotaxi.\n')
  writeFile(root, 'INDEX.md', '# Index\nWarehouse AMR. Port terminal tractor. Mine haul truck.\n')
  writeFile(root, 'METHODOLOGY.md', '# Methodology\nDelivery robot on outdoor campus.\n')
  writeFile(root, 'GLOSSARY.md', '# Glossary\n')
  writeFile(root, '70-operations-domains/airside/ops.md', '# Ops\nFOD, jet blast, pushback, turnaround.\n')

  const before = listFiles(root)
  const report = auditDomainBalance(root)
  const after = listFiles(root)

  assert.deepEqual(after, before)
  assert.equal(report.totalFiles, 5)
  assert.equal(report.domains.find((row) => row.domain === 'airside').files, 2)
  assert.equal(report.domains.find((row) => row.domain === 'airside').mentions, 7)
  assert.equal(report.domains.find((row) => row.domain === 'road').files, 1)
  assert.equal(report.domains.find((row) => row.domain === 'warehouse').files, 1)
  assert.equal(report.domains.find((row) => row.domain === 'port').files, 1)
  assert.equal(report.domains.find((row) => row.domain === 'mining').files, 1)
  assert.equal(report.domains.find((row) => row.domain === 'delivery-robot').files, 1)
  assert.equal(report.domains.find((row) => row.domain === 'outdoor-campus').files, 1)
})

test('formatAuditReport is deterministic Markdown', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-balance-format-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  writeFile(root, 'README.md', '# Home\nAirside apron.\n')
  writeFile(root, 'INDEX.md', '# Index\nRoad AV. Warehouse.\n')
  writeFile(root, 'METHODOLOGY.md', '# Methodology\n')
  writeFile(root, 'GLOSSARY.md', '# Glossary\n')

  assert.equal(
    formatAuditReport(auditDomainBalance(root)),
    [
      '# Domain Balance Audit',
      '',
      'Source Markdown files: 4',
      '',
      '## Domain Summary',
      '',
      '| Domain | Files | Mentions |',
      '|---|---:|---:|',
      '| airside | 1 | 2 |',
      '| road | 1 | 1 |',
      '| warehouse | 1 | 1 |',
      '| logistics-yard | 0 | 0 |',
      '| port | 0 | 0 |',
      '| mining | 0 | 0 |',
      '| construction | 0 | 0 |',
      '| agriculture | 0 | 0 |',
      '| delivery-robot | 0 | 0 |',
      '| outdoor-campus | 0 | 0 |',
      '',
      '## Top-Level Folder Summary',
      '',
      '| Folder | Files | Airside | Road | Warehouse | Logistics-yard | Port | Mining | Construction | Agriculture | Delivery-robot | Outdoor-campus |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
      '| root | 4 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |'
    ].join('\n')
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test tests/domain-balance.test.mjs
```

Expected: FAIL with a module-not-found error for `tools/domain-balance/audit.mjs`.

- [ ] **Step 3: Implement the audit tool**

Create `tools/domain-balance/audit.mjs` with:

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(import.meta.url)

export const repoRoot = path.resolve(path.dirname(modulePath), '../..')

export const ROOT_MARKDOWN_FILES = ['README.md', 'INDEX.md', 'METHODOLOGY.md', 'GLOSSARY.md']

export const CONTENT_DIRS = [
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

export const DOMAIN_BUCKETS = [
  {
    domain: 'airside',
    pattern: /\b(airside|airport|apron|ramp|gse|pushback|fod|jet\s*blast|turnaround|changi|caas)\b/gi
  },
  {
    domain: 'road',
    pattern: /\b(road|roadway|highway|street|urban driving|robotaxi|waymo|cruise|adas|ads|road av)\b/gi
  },
  {
    domain: 'warehouse',
    pattern: /\b(warehouse|indoor logistics|fulfillment|amr|forklift|iso 3691-4)\b/gi
  },
  {
    domain: 'logistics-yard',
    pattern: /\b(logistics yard|yard truck|yard tractor|trailer yard|distribution yard)\b/gi
  },
  {
    domain: 'port',
    pattern: /\b(port|terminal tractor|container terminal|container yard|yard crane|straddle carrier)\b/gi
  },
  {
    domain: 'mining',
    pattern: /\b(mining|mine|haul truck|quarry)\b/gi
  },
  {
    domain: 'construction',
    pattern: /\b(construction|earthmoving|excavator|bulldozer|jobsite)\b/gi
  },
  {
    domain: 'agriculture',
    pattern: /\b(agriculture|farm|tractor|sprayer|harvester|orchard|field robotics)\b/gi
  },
  {
    domain: 'delivery-robot',
    pattern: /\b(delivery robot|sidewalk robot|sidewalk delivery|last-mile|last mile)\b/gi
  },
  {
    domain: 'outdoor-campus',
    pattern: /\b(outdoor campus|campus shuttle|campus autonomy|private campus)\b/gi
  }
]

function isMarkdownFile(filePath) {
  return filePath.toLowerCase().endsWith('.md')
}

function normalizeRelPath(filePath) {
  return filePath.replace(/\\/g, '/')
}

function readMarkdownFiles(absDir, relDir) {
  if (!fs.existsSync(absDir)) return []

  const files = []
  const entries = fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

  for (const entry of entries) {
    const childAbs = path.join(absDir, entry.name)
    const childRel = normalizeRelPath(path.posix.join(relDir.replace(/\\/g, '/'), entry.name))
    if (entry.isDirectory()) files.push(...readMarkdownFiles(childAbs, childRel))
    if (entry.isFile() && isMarkdownFile(entry.name)) files.push(childRel)
  }

  return files
}

export function publicMarkdownFiles(root = repoRoot) {
  const rootFiles = ROOT_MARKDOWN_FILES.filter((relPath) => fs.existsSync(path.join(root, relPath)))
  const contentFiles = CONTENT_DIRS.flatMap((relDir) => readMarkdownFiles(path.join(root, relDir), relDir))
  return [...rootFiles, ...contentFiles]
}

function countMatches(text, pattern) {
  const regex = new RegExp(pattern.source, pattern.flags)
  return [...text.matchAll(regex)].length
}

function folderFor(relPath) {
  const normalized = normalizeRelPath(relPath)
  if (!normalized.includes('/')) return 'root'
  return normalized.split('/')[0]
}

export function auditDomainBalance(root = repoRoot) {
  const files = publicMarkdownFiles(root)
  const domainTotals = new Map(DOMAIN_BUCKETS.map((bucket) => [bucket.domain, { domain: bucket.domain, files: 0, mentions: 0 }]))
  const folderTotals = new Map()

  for (const relPath of files) {
    const text = fs.readFileSync(path.join(root, relPath), 'utf8')
    const folder = folderFor(relPath)
    if (!folderTotals.has(folder)) {
      folderTotals.set(folder, {
        folder,
        files: 0,
        domains: Object.fromEntries(DOMAIN_BUCKETS.map((bucket) => [bucket.domain, 0]))
      })
    }

    const folderRow = folderTotals.get(folder)
    folderRow.files += 1

    for (const bucket of DOMAIN_BUCKETS) {
      const matches = countMatches(text, bucket.pattern)
      if (matches === 0) continue
      const domainRow = domainTotals.get(bucket.domain)
      domainRow.files += 1
      domainRow.mentions += matches
      folderRow.domains[bucket.domain] += matches
    }
  }

  return {
    totalFiles: files.length,
    domains: DOMAIN_BUCKETS.map((bucket) => domainTotals.get(bucket.domain)),
    folders: [...folderTotals.values()].sort((a, b) => a.folder.localeCompare(b.folder, 'en'))
  }
}

export function formatAuditReport(report) {
  const lines = [
    '# Domain Balance Audit',
    '',
    `Source Markdown files: ${report.totalFiles}`,
    '',
    '## Domain Summary',
    '',
    '| Domain | Files | Mentions |',
    '|---|---:|---:|'
  ]

  for (const row of report.domains) {
    lines.push(`| ${row.domain} | ${row.files} | ${row.mentions} |`)
  }

  lines.push(
    '',
    '## Top-Level Folder Summary',
    '',
    '| Folder | Files | Airside | Road | Warehouse | Logistics-yard | Port | Mining | Construction | Agriculture | Delivery-robot | Outdoor-campus |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
  )

  for (const row of report.folders) {
    lines.push(
      `| ${row.folder} | ${row.files} | ` +
        `${row.domains.airside} | ` +
        `${row.domains.road} | ` +
        `${row.domains.warehouse} | ` +
        `${row.domains['logistics-yard']} | ` +
        `${row.domains.port} | ` +
        `${row.domains.mining} | ` +
        `${row.domains.construction} | ` +
        `${row.domains.agriculture} | ` +
        `${row.domains['delivery-robot']} | ` +
        `${row.domains['outdoor-campus']} |`
    )
  }

  return lines.join('\n')
}

if (process.argv[1] === modulePath) {
  console.log(formatAuditReport(auditDomainBalance()))
}
```

- [ ] **Step 4: Add npm scripts**

Modify `package.json` scripts:

```json
"links:check": "node tools/restructure/check-links.mjs",
"domain:audit": "node tools/domain-balance/audit.mjs",
"priority:check": "node tools/autonomy-priority/priority-metadata.mjs --check",
```

Modify the `test` script to include the new test file:

```json
"test": "node --test tests/navigation.test.mjs tests/site-config.test.mjs tests/content-smoke.test.mjs tests/workflow.test.mjs tests/restructure-map.test.mjs tests/autonomy-priority.test.mjs tests/domain-balance.test.mjs",
```

Do not add `domain:audit` to `verify`; the audit is informational, not a hard CI gate.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
node --test tests/domain-balance.test.mjs
npm run domain:audit
```

Expected: tests PASS; audit prints Markdown tables and does not modify files.

- [ ] **Step 6: Commit**

Run:

```powershell
git add package.json tools/domain-balance/audit.mjs tests/domain-balance.test.mjs
git commit -m "feat: add domain balance audit"
```

---

### Task 2: Update Repo-Level Framing Docs

**Files:**
- Modify: `README.md`
- Modify: `METHODOLOGY.md`
- Modify: `00-start-here/repo-map.md`

- [ ] **Step 1: Update README opening and architecture**

In `README.md`, replace the second paragraph:

```md
Personal research command center for autonomous vehicle technology, airport airside operations, world models, safety, deployment, and fleet systems.
```

with:

```md
Markdown-first knowledge base for autonomous vehicle technology across road, airside, warehouse, logistics yard, port, mining, construction, agriculture, delivery robot, and outdoor campus domains. Airside autonomous vehicles remain the best-developed reference ODD, not the default evaluation lens.
```

After the `## Architecture` paragraph, add:

```md
Airside is used as a detailed reference ODD where the corpus has the deepest deployment evidence. Generic autonomy-stack methods, ratings, and synthesis pages should still state how ideas transfer across road AVs, warehouses, yards, ports, mines, construction sites, farms, delivery robots, and campus systems.
```

- [ ] **Step 2: Add cross-domain reading path**

In `README.md`, add this row in `## High-Leverage Reading Paths` immediately after `Airport airside operations`:

```md
| Cross-domain deployment signals | [2024-2026 Autonomy Deployment Index](80-industry-intel/deployments/2024-2026-autonomy-deployment-index.md) | Compares airside, yard, warehouse, mining, delivery, and road ADS deployment evidence without treating one ODD as the default. |
```

In the `Perception stack` row, replace:

```md
Compares production AV approaches and the perception patterns that transfer to airside autonomy.
```

with:

```md
Compares production AV approaches and the perception patterns that transfer across road, airside, and managed-site autonomy.
```

- [ ] **Step 3: Update methodology domain stance**

In `METHODOLOGY.md`, after the paragraph ending with `334k+ lines of Markdown.`, insert:

```md
Domain stance: the corpus is a generic AV knowledge base. Airside autonomous vehicles are the most developed reference ODD because the current research base is deepest there, but method ratings and generic stack pages should not treat airside as the default deployment context.
```

In Phase 10, replace:

```md
airside fit, implementation notes, and sources
```

with:

```md
domain fit, transfer notes for explicitly scoped ODDs, implementation notes, and sources
```

In `## Quality Controls`, add a new item after item 12:

```md
13. **Domain Fit Rebalance:** Generic method and synthesis pages should use Domain Fit language across canonical AV domains, while airside-specific pages remain airside-first with transfer notes where relevant.
```

In `## Limitations`, replace limitation 3:

```md
3. **Airside data gap:** No public airside driving datasets exist, so comparative analysis relies on published deployment reports rather than reproducible benchmarks.
```

with:

```md
3. **Reference-ODD imbalance:** Airside has the deepest current coverage and no public large-scale airside driving datasets, so some deployment comparisons rely on published reports rather than reproducible benchmarks. Generic method pages should separate airside-specific evidence from broader AV deployment relevance.
```

In `## How to Extend This Research`, replace item 5:

```md
5. **Add operational or industry research:** Use `70-operations-domains/` for airside/deployment/business-case material and `80-industry-intel/` for companies, market intelligence, and regulations.
```

with:

```md
5. **Add operational or industry research:** Use `70-operations-domains/` for domain operations across airside, warehouse, logistics yard, port, mining, construction, agriculture, road AV, delivery robot, and outdoor campus material. Use `80-industry-intel/` for companies, market intelligence, regulations, and cross-domain deployment evidence.
```

- [ ] **Step 4: Update repo map**

In `00-start-here/repo-map.md`, replace the `70-operations-domains/` row with:

```md
| `70-operations-domains/` | Domain operations for airside, warehouse, logistics yard, port, mining, construction, agriculture, road AV, delivery robot, outdoor campus, and deployment playbooks. |
```

- [ ] **Step 5: Verify focused prose**

Run:

```powershell
rg -n "default evaluation lens|Domain Fit Rebalance|domain fit|airside fit|Cross-domain deployment signals" README.md METHODOLOGY.md 00-start-here/repo-map.md
```

Expected:

- README contains `default evaluation lens` and `Cross-domain deployment signals`.
- METHODOLOGY contains `Domain Fit Rebalance` and `domain fit`.
- No `airside fit` match remains in `METHODOLOGY.md`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add README.md METHODOLOGY.md 00-start-here/repo-map.md
git commit -m "docs: clarify generic av framing"
```

---

### Task 3: Update Rating Overviews And Rubric Guidance

**Files:**
- Modify: `30-autonomy-stack/perception/methods/overview.md`
- Modify: `30-autonomy-stack/localization-mapping/slam-methods/overview.md`
- Modify: `90-synthesis/readiness-risk/continuous-research-loop.md`
- Modify: `90-synthesis/readiness-risk/technology-readiness.md`

- [ ] **Step 1: Update perception method overview prose**

In `30-autonomy-stack/perception/methods/overview.md`, replace the opening paragraph with:

```md
This directory is the method-level perception library. Each page should represent one technique, method, benchmark, or dataset-backed evaluation primitive. Broad synthesis pages in `30-autonomy-stack/perception/overview/` remain useful for system design, but this library is where individual methods get enough space for architecture, data, benchmarks, failure modes, deployment fit, Domain Fit, transfer notes for explicitly scoped ODDs, and sources.
```

Replace the priority-ratings paragraph with:

```md
Priority ratings are editorial reading and deployment triage signals. `Learning` answers what to read early for general autonomy understanding. `Deployment` answers what to evaluate early for AV deployment in the tagged context; it is not a certification, product-readiness, or all-domain average claim. If a method's deployment score is driven by a specific domain or stack role, the reason text should name that context.
```

Immediately after `<!-- priority-table:end -->`, insert:

```md
## Domain Fit Guidance

Generic method pages should use `Domain Fit`, not `Airside Fit`, as the default deployment lens. Use three to six compact rows or bullets rather than a large matrix.

| Domain | Fit | Note |
|---|---|---|
| Road AV | strong / conditional / weak / insufficient evidence | State whether the method has road-scale evidence, actor coverage, and runtime maturity. |
| Airside | strong / conditional / weak / insufficient evidence | Include apron, GSE, FOD, aircraft-proximity, and weather relevance only when supported by the method evidence. |
| Warehouse / logistics yard / port / mining / construction / agriculture / delivery robot / outdoor campus | strong / conditional / weak / insufficient evidence | Add only the domains where the method assumptions or validation signals materially transfer. |

Airside-specific pages may stay airside-first, but generic pages should not make airside the only deployment lens.
```

Replace the file-boundary rule row:

```md
| Airside fit is mandatory | Every page should explicitly say what transfers to airport apron autonomy, what does not, and what evidence would be required before using it in a safety case. |
```

with:

```md
| Domain fit is mandatory for generic pages | Generic method pages should state the domains where the method is a strong, conditional, weak, or insufficient-evidence fit. Airside-specific pages may use a transfer note instead. |
```

In `## Standard Page Shape`, replace item 8:

```md
8. Airside autonomous-vehicle fit.
```

with:

```md
8. Domain Fit, or an airside transfer note when the page is explicitly airside-specific.
```

- [ ] **Step 2: Update SLAM method overview prose**

In `30-autonomy-stack/localization-mapping/slam-methods/overview.md`, replace question 2:

```md
2. Which method family should be evaluated for a given AV, indoor, or outdoor environment?
```

with:

```md
2. Which method family should be evaluated for a given road, airside, warehouse, yard, port, mining, construction, agriculture, delivery, or campus environment?
```

Replace the paragraph beginning `For airside autonomous vehicles` with:

```md
For production AVs, the practical answer is usually not "run SLAM online forever." The stack should separate offline map construction, online scan-to-map localization, high-rate state estimation, and loop-closure/relocalization. Airside remains a useful reference ODD for this separation, but the same decision pattern also applies to road AVs, warehouses, logistics yards, ports, mines, construction sites, and campuses with different sensor and operational constraints.
```

Replace the priority-ratings paragraph with:

```md
Priority ratings are editorial reading and deployment triage signals. `Learning` answers what to read early for SLAM/localization understanding. `Deployment` answers what to evaluate early for AV deployment in the tagged context; it is not a certification, product-readiness, or all-domain average claim. If a method's deployment score is driven by a specific domain or stack role, the reason text should name that context.
```

Immediately after `<!-- priority-table:end -->`, insert:

```md
## Domain Fit Guidance

Generic SLAM method pages should use `Domain Fit`, not `Airside Fit`, as the default deployment lens. Keep the section compact and focus on where method assumptions match the operating domain.

| Domain | Fit | Note |
|---|---|---|
| Road AV | strong / conditional / weak / insufficient evidence | Check speed, map freshness, GNSS availability, and road-scale validation evidence. |
| Airside | strong / conditional / weak / insufficient evidence | Check open-apron geometry, aircraft/GSE dynamics, low-speed routes, FOD, and airport map operations. |
| Warehouse / logistics yard / port / mining / construction / agriculture / delivery robot / outdoor campus | strong / conditional / weak / insufficient evidence | Add only the domains where sensor, map, localization, and operational assumptions materially transfer. |

Airside-specific pages may stay airside-first, but generic pages should not make airside the only deployment lens.
```

- [ ] **Step 3: Update continuous research loop**

In `90-synthesis/readiness-risk/continuous-research-loop.md`, replace promotion rule 4:

```md
4. Every method page should state inputs, outputs, assumptions, failure modes, AV relevance, indoor/outdoor transfer, and airside fit where relevant.
```

with:

```md
4. Every generic method page should state inputs, outputs, assumptions, failure modes, AV relevance, and Domain Fit across the relevant canonical domains. Domain-specific pages should state their primary ODD and include transfer notes when the idea generalizes.
```

- [ ] **Step 4: Update technology readiness lens**

In `90-synthesis/readiness-risk/technology-readiness.md`, replace the TRL table with:

```md
| TRL | Definition | Deployment Evidence Lens |
|-----|-----------|--------------------------|
| 1 | Basic principles observed | Research paper, standard, or credible technical principle published |
| 2 | Technology concept formulated | Architecture or operating concept defined for an explicit ODD |
| 3 | Proof of concept | Works on recorded data, benchmark data, or a narrow offline prototype |
| 4 | Lab validation | Works in simulation, bench test, or controlled replay with measurable criteria |
| 5 | Relevant environment validation | Works on vehicle, robot, or field equipment in shadow mode or supervised trials |
| 6 | Prototype demonstrated | Performs the target task autonomously in a controlled area with fallback controls |
| 7 | System prototype in operational environment | Runs in the real ODD with operational monitors, evidence logging, and stakeholder acceptance |
| 8 | System complete and qualified | Safety case, operating procedure, and release evidence accepted for the scoped deployment |
| 9 | System proven in operations | Multi-site or fleet-scale operation with post-market monitoring and incident learning |
```

- [ ] **Step 5: Run focused checks**

Run:

```powershell
rg -n "Airside fit is mandatory|Airside autonomous-vehicle fit|For Airside AV|airside fit" 30-autonomy-stack/perception/methods/overview.md 30-autonomy-stack/localization-mapping/slam-methods/overview.md 90-synthesis/readiness-risk/continuous-research-loop.md 90-synthesis/readiness-risk/technology-readiness.md
npm run priority:check
```

Expected:

- First command returns no matches in these pattern-setting files.
- `npm run priority:check` passes.

- [ ] **Step 6: Commit**

Run:

```powershell
git add 30-autonomy-stack/perception/methods/overview.md 30-autonomy-stack/localization-mapping/slam-methods/overview.md 90-synthesis/readiness-risk/continuous-research-loop.md 90-synthesis/readiness-risk/technology-readiness.md
git commit -m "docs: add domain fit rating guidance"
```

---

### Task 4: Retrofit Synthesis And Generic Overview Framing

**Files:**
- Modify: `90-synthesis/master/master-synthesis.md`
- Modify: `90-synthesis/decisions/design-spec.md`
- Modify: `30-autonomy-stack/perception/overview/production-perception-systems.md`
- Modify: `30-autonomy-stack/world-models/overview.md`
- Modify: `90-synthesis/master/getting-started.md`

- [ ] **Step 1: Update master synthesis title and scope**

In `90-synthesis/master/master-synthesis.md`, replace the H1:

```md
# World Models & AI for Airside Autonomous Vehicles: Master Synthesis
```

with:

```md
# World Models & AI for Autonomous Vehicles: Airside Reference ODD Master Synthesis
```

Replace the scope line:

```md
**Scope:** Comprehensive research survey across 20 deep-dive reports covering world models, VLAs, simulation, end-to-end driving, and their applicability to autonomous vehicles operating on airport airside.
```

with:

```md
**Scope:** Comprehensive research survey across 20 deep-dive reports covering world models, VLAs, simulation, end-to-end driving, and their applicability to autonomous vehicles. Airport airside operations are the detailed reference ODD in this synthesis, not the default lens for the whole repository.
```

After `## 1. Executive Summary`, insert:

```md
Read this page as an airside reference case for a generic AV stack. The same stack questions should be re-evaluated for road AVs, warehouses, logistics yards, ports, mines, construction sites, farms, delivery robots, and campuses before deployment claims are transferred.
```

Replace the table column header:

```md
| Approach | Maturity | Key Systems | Airside Fit |
```

with:

```md
| Approach | Maturity | Key Systems | Domain Fit Notes |
```

Replace the separator line immediately below it with:

```md
|----------|----------|-------------|------------------|
```

- [ ] **Step 2: Update design spec scope**

In `90-synthesis/decisions/design-spec.md`, replace the H1:

```md
# World-Model-Powered Airside Autonomous Vehicle Stack
```

with:

```md
# World-Model-Powered Autonomous Vehicle Stack: Airside Reference ODD
```

Replace metadata lines:

```md
**Type:** Research Design — Next-Generation AV Stack for Airport Airside Operations
**Context:** Greenfield parallel track alongside existing reference airside AV stack ROS Noetic stack (Simplex architecture)
**Approach:** Dual-Track Foundation (Data Engine + World Model Stack)
```

with:

```md
**Type:** Research Design — Next-Generation AV Stack with Airport Airside as Reference ODD
**Context:** Greenfield parallel track alongside existing reference airside AV stack ROS Noetic stack (Simplex architecture)
**Approach:** Dual-Track Foundation (Data Engine + World Model Stack)
**Domain stance:** The concrete examples are airside because that is the best-developed reference ODD. The architecture should keep domain context explicit so the same stack can be re-evaluated for road, warehouse, yard, port, mining, construction, agriculture, delivery robot, and campus deployments.
```

In `### 2.2 Design Principles`, replace item 5:

```md
5. **Airport-aware:** Unlike road AV stacks, this system integrates with airport data sources (A-CDM, NOTAM, ADS-B, A-SMGCS) as first-class inputs.
```

with:

```md
5. **Domain-aware:** The stack accepts domain context as first-class input. For airside this means A-CDM, NOTAM, ADS-B, and A-SMGCS; for other domains it may mean WMS/TMS systems, yard-management systems, mine dispatch, port TOS, farm boundaries, or road maps and traffic rules.
```

- [ ] **Step 3: Update production perception overview**

In `30-autonomy-stack/perception/overview/production-perception-systems.md`, replace the Overview paragraph:

```md
This report analyzes perception systems deployed in production autonomous vehicles -- not research prototypes, but systems carrying real passengers and cargo on public roads and airport aprons. The goal is to extract concrete lessons for airside AV development from companies that have solved (or failed to solve) real-world perception at scale.
```

with:

```md
This report analyzes perception systems deployed in production autonomous vehicles -- not research prototypes, but systems carrying real passengers and cargo on public roads, airport aprons, and managed sites. The goal is to extract concrete perception lessons that transfer across AV domains, with airside autonomy treated as one reference ODD rather than the default deployment lens.
```

- [ ] **Step 4: Update world-model overview table of contents and domain note**

In `30-autonomy-stack/world-models/overview.md`, replace table-of-contents item 4:

```md
4. [Airside (Airport Tarmac) Operations](#4-specific-considerations-for-airside-airport-tarmac-operations)
```

with:

```md
4. [Domain Transfer: Airside Reference ODD](#4-domain-transfer-airside-reference-odd)
```

Find the heading for section 4 and replace it with:

```md
## 4. Domain Transfer: Airside Reference ODD

Airside airport operations are a detailed transfer case for world models because the domain combines low-speed autonomy, managed routes, unusual actors, infrastructure data, and safety-case pressure. The same transfer logic should be repeated for road AVs, warehouses, logistics yards, ports, mines, construction sites, agriculture, delivery robots, and outdoor campuses before claiming deployment relevance.
```

Keep the existing airside-specific paragraphs below this new heading; they are valid reference-ODD content.

- [ ] **Step 5: Clarify getting-started scope**

In `90-synthesis/master/getting-started.md`, insert immediately after the H1:

```md
This guide is an airside-reference implementation path. It is useful because the repo has concrete airside ROS bag, GSE, FOD, and jet-blast examples, but it should not be read as the default path for every AV domain.
```

- [ ] **Step 6: Focused verification**

Run:

```powershell
rg -n "primary reference deployment case|Airside Fit|For Airside AV|default deployment lens|reference ODD|Domain Fit Notes|Domain-aware" 90-synthesis/master/master-synthesis.md 90-synthesis/decisions/design-spec.md 30-autonomy-stack/perception/overview/production-perception-systems.md 30-autonomy-stack/world-models/overview.md 90-synthesis/master/getting-started.md
```

Expected:

- No `primary reference deployment case`.
- `reference ODD` appears in updated scope notes.
- `Domain Fit Notes` appears in `master-synthesis.md`.
- `Domain-aware` appears in `design-spec.md`.

- [ ] **Step 7: Commit**

Run:

```powershell
git add 90-synthesis/master/master-synthesis.md 90-synthesis/decisions/design-spec.md 30-autonomy-stack/perception/overview/production-perception-systems.md 30-autonomy-stack/world-models/overview.md 90-synthesis/master/getting-started.md
git commit -m "docs: reframe airside as reference odd"
```

---

### Task 5: Full Verification And Final Review

**Files:**
- No planned source edits unless verification exposes a defect.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run priority:check
npm run links:check
npm run docs:build
npm run domain:audit
git diff --check
```

Expected:

- `npm test`: PASS. If it fails because of pre-existing unrelated worktree changes discovered in Task 0, stop and report that context instead of reverting them.
- `npm run priority:check`: PASS.
- `npm run links:check`: PASS.
- `npm run docs:build`: PASS.
- `npm run domain:audit`: prints a Markdown audit report and writes no files.
- `git diff --check`: no whitespace errors.

- [ ] **Step 2: Confirm generated priority blocks were not manually changed**

Run:

```powershell
git diff HEAD~4..HEAD -- 30-autonomy-stack/perception/methods/overview.md 30-autonomy-stack/localization-mapping/slam-methods/overview.md | rg -n "priority-table:start|priority-table:end|^[-+]\\| \\["
```

Expected:

- The command should show marker context at most, but no added or removed generated method rows.
- If generated method rows changed, inspect whether `npm run priority:generate` was run accidentally or metadata changed. Revert only your generated-row edits, not unrelated user changes.

- [ ] **Step 3: Check pattern-setting language**

Run:

```powershell
rg -n "Airside fit is mandatory|Airside autonomous-vehicle fit|For Airside AV|airside fit" README.md METHODOLOGY.md 00-start-here/repo-map.md 30-autonomy-stack/perception/methods/overview.md 30-autonomy-stack/localization-mapping/slam-methods/overview.md 90-synthesis/readiness-risk/continuous-research-loop.md 90-synthesis/readiness-risk/technology-readiness.md 90-synthesis/master/master-synthesis.md 90-synthesis/decisions/design-spec.md
```

Expected: no matches in this targeted pattern-setting file set.

- [ ] **Step 4: Review remaining worktree changes**

Run:

```powershell
git status --short
```

Expected:

```text
# no output
```

The worktree should be clean after implementation commits. If Task 0 recorded unrelated pre-existing files, those may remain; do not stage or revert them.

- [ ] **Step 5: Final commit if verification edits were needed**

If Task 5 required fixes, commit only those fixes:

```powershell
git add <files fixed during verification>
git commit -m "fix: complete domain rebalance verification"
```

If no edits were needed, do not create an empty commit.
