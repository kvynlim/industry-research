# Knowledge Base Purpose-Built Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the removed generic knowledge-base visuals with one purpose-built curated visual per knowledge-base Markdown file.

**Architecture:** Keep the old generated `kb-figure` contract retired. Add a new curated visual contract using `kb-visual` markers, stable assets under `10-knowledge-base/_assets/visuals/`, and a deterministic generator driven by the reassessment spec. Tests must reject the old generated placeholders and require the new curated replacement visual for every live knowledge-base file.

**Tech Stack:** Node.js ESM scripts, Markdown files, inline SVG assets, `node:test`, VitePress content smoke tests.

---

## File Structure

- Modify: `tests/content-smoke.test.mjs`
  - Keep the existing check that rejects old `kb-figure` markers and old `../_assets/figures/*.svg` links.
  - Add checks that every `10-knowledge-base/*.md` file has exactly one `kb-visual` block pointing at `../_assets/visuals/*.svg`.
  - Add checks that every curated SVG exists, has one root `<svg>`, one `<title>`, one `<desc>`, and does not contain old generic placeholder wording.
- Create: `tools/knowledge-base/curated-visuals.mjs`
  - Reads a manifest of 99 purpose-built visual specs.
  - Writes SVGs under `10-knowledge-base/_assets/visuals/`.
  - Inserts or replaces one `kb-visual` block in each knowledge-base Markdown file.
  - Fails loudly on missing files, duplicate visual blocks, or manifest/live inventory mismatch.
- Modify: all 99 Markdown files under `10-knowledge-base/`
  - Add one `kb-visual` block after the H1/frontmatter area.
- Create: 99 SVG assets under `10-knowledge-base/_assets/visuals/`
  - One stable asset per knowledge-base Markdown file.

---

### Task 1: Add RED Coverage For Curated Replacement Visuals

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [x] **Step 1: Add failing tests**

Add tests that:

```js
test('knowledge-base pages include one curated replacement visual', () => {
  const knowledgeBaseDir = path.join(repoRoot, '10-knowledge-base')
  const markdownFiles = readMarkdownFiles(knowledgeBaseDir)
  const failures = []

  for (const absPath of markdownFiles) {
    const relPath = path.relative(repoRoot, absPath).replace(/\\/g, '/')
    const markdown = fs.readFileSync(absPath, 'utf8')
    const blocks = [...markdown.matchAll(/<!-- kb-visual:start -->[\s\S]*?<!-- kb-visual:end -->/g)]

    if (blocks.length !== 1) {
      failures.push(`${relPath}: expected exactly one curated kb-visual block`)
      continue
    }

    const block = blocks[0][0]
    const imageMatch = block.match(/!\[[^\]]+\]\((\.\.\/_assets\/visuals\/[^)]+\.svg)\)/)
    const hasCaption = /\*Visual: .+\*/.test(block)

    if (!imageMatch) failures.push(`${relPath}: curated visual must reference ../_assets/visuals/*.svg`)
    if (!hasCaption) failures.push(`${relPath}: curated visual must include a Visual caption`)
  }

  assert.deepEqual(failures, [])
})
```

Add an SVG metadata test that resolves each referenced visual asset and asserts:

```js
const svgRootCount = (svg.match(/<svg\b/g) ?? []).length
const titleCount = (svg.match(/<title\b/g) ?? []).length
const descCount = (svg.match(/<desc\b/g) ?? []).length
assert.equal(svgRootCount, 1)
assert.equal(titleCount, 1)
assert.equal(descCount, 1)
```

- [x] **Step 2: Verify RED**

Run:

```powershell
node --test tests/content-smoke.test.mjs
```

Expected: FAIL because the generated visuals were removed and no `kb-visual` blocks exist yet.

---

### Task 2: Build The Curated Visual Generator

**Files:**
- Create: `tools/knowledge-base/curated-visuals.mjs`

- [x] **Step 1: Implement generator skeleton**

Create an ESM Node script that:

```js
#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const knowledgeBaseRoot = path.join(repoRoot, '10-knowledge-base')
const visualRoot = path.join(knowledgeBaseRoot, '_assets', 'visuals')
const markerStart = '<!-- kb-visual:start -->'
const markerEnd = '<!-- kb-visual:end -->'
```

The script must include helpers for:

- `escapeXml(value)`
- `escapeMarkdown(value)`
- `wrapText(value, maxChars)`
- SVG primitives such as `frame`, `box`, `arrow`, `matrixGrid`, `axis`, and `label`
- `listMarkdownFiles(dir)`
- `insertOrReplaceVisualBlock(markdown, block)`
- `validateManifestAgainstLiveFiles(specs)`

- [x] **Step 2: Add the 99-entry manifest source**

Use `docs/superpowers/notes/2026-05-09-knowledge-base-visual-reassessment-generated-removed.md` as the source of truth. The generator parses each reassessment entry into:

```js
{
  file: '10-knowledge-base/<folder>/<slug>.md',
  asset: '<folder>-<slug>.svg',
  title: '<file-specific visual title>',
  alt: '<file-specific alt text>',
  caption: '<short Visual caption>',
  nodes: ['specific', 'diagram', 'labels'],
  emphasis: '<what the visual teaches>'
}
```

Renderer type is selected deterministically from the file path and caption so the manifest remains the human-readable reassessment note. Do not use vague labels such as `input`, `process`, `output` unless the file topic actually uses those terms.

- [x] **Step 3: Render and insert**

For each spec:

1. Write `10-knowledge-base/_assets/visuals/<asset>`.
2. Insert or replace:

```markdown
<!-- kb-visual:start -->
![<alt>](../_assets/visuals/<asset>)

*Visual: <caption>*
<!-- kb-visual:end -->
```

3. Preserve the rest of the Markdown file unchanged.

---

### Task 3: Verify And Review

**Files:**
- `tests/content-smoke.test.mjs`
- `tools/knowledge-base/curated-visuals.mjs`
- all generated Markdown visual blocks and SVG assets

- [x] **Step 1: Run generator**

```powershell
node tools/knowledge-base/curated-visuals.mjs
```

Expected: prints that 99 curated visuals were written.

- [x] **Step 2: Run focused tests**

```powershell
node --test tests/content-smoke.test.mjs
```

Expected: PASS.

- [x] **Step 3: Run full verification**

```powershell
npm test
npm run docs:build
git diff --check
```

Expected: all commands exit 0. VitePress may keep existing syntax-highlighting/chunk-size warnings.

---

## Self-Review

- Spec coverage: covers the corrected assumption that generated figures are removed and all 99 pages need replacement visuals.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: uses `kb-visual` markers and `_assets/visuals` consistently, leaving old `kb-figure` markers retired.
