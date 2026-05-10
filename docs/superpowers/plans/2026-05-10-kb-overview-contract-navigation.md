# Knowledge Base Overview Contract And Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the mechanical sidebar behavior and reusable overview contract tests needed before writing the new section overviews.

**Architecture:** Directories with an `overview.md` become navigable sidebar groups, and the overview page is emitted before both subdirectories and regular files. The content contract test starts with an empty activation list so this phase lands green; each content batch expands that list for the overview pages it creates.

**Tech Stack:** Node.js test runner, VitePress sidebar config in `.vitepress/navigation.mjs`, Markdown smoke tests in `tests/content-smoke.test.mjs`.

---

## Files

- Modify: `.vitepress/navigation.mjs`
- Modify: `tests/navigation.test.mjs`
- Modify: `tests/content-smoke.test.mjs`
- Reference: `docs/superpowers/specs/2026-05-10-knowledge-base-section-overviews-design.md`

## Task 1: Add Overview-First Sidebar Tests

**Files:**
- Modify: `tests/navigation.test.mjs`

- [ ] **Step 1: Add direct knowledge-base folder helper**

Add after `collectSidebarLinks`:

```js
function directKnowledgeBaseFoldersWithOverview(root) {
  const knowledgeBaseDir = path.join(root, '10-knowledge-base')
  return fs
    .readdirSync(knowledgeBaseDir, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory() || entry.name === '_assets') return false
      return fs.existsSync(path.join(knowledgeBaseDir, entry.name, 'overview.md'))
    })
    .map((entry) => entry.name)
    .sort()
}
```

- [ ] **Step 2: Add failing navigation test**

Add after `includes every public architecture page in the sidebar`:

```js
test('knowledge-base overview pages are group links and first children', () => {
  const sidebar = buildSidebar(repoRoot)
  const knowledgeBase = sidebar.find((section) => section.text === 'Knowledge Base')
  assert.ok(knowledgeBase, 'Knowledge Base sidebar group should exist')

  for (const folder of directKnowledgeBaseFoldersWithOverview(repoRoot)) {
    const folderItem = knowledgeBase.items.find((item) => item.text === titleFromPath(folder))
    const overviewLink = `/10-knowledge-base/${folder}/overview`

    assert.ok(folderItem, `${folder} sidebar group should exist`)
    assert.equal(folderItem.link, overviewLink, `${folder} group should link to overview`)
    assert.equal(folderItem.items?.[0]?.link, overviewLink, `${folder} first child should be overview`)
  }
})
```

- [ ] **Step 3: Run the focused test and confirm red**

Run:

```text
node --test tests/navigation.test.mjs
```

Expected: FAIL because `machine-learning/overview.md` exists, but the folder group does not link to it and it is not sorted first.

## Task 2: Implement Overview Sidebar Behavior

**Files:**
- Modify: `.vitepress/navigation.mjs`

- [ ] **Step 1: Add overview detection helper**

Add after `linkForMarkdown`:

```js
function overviewFileRel(root, relDir) {
  const candidate = joinRel(relDir, 'overview.md')
  return pathExists(root, candidate) ? candidate : null
}
```

- [ ] **Step 2: Split `overview.md` from regular Markdown files**

Replace the existing `files` assignment in `buildDirectoryItems` with:

```js
  const files = entries
    .filter((entry) => entry.isFile() && isMarkdownFile(entry.name))
    .sort((a, b) => {
      return a.name.localeCompare(b.name, 'en')
    })
  const overviewFile = files.find((entry) => entry.name === 'overview.md') ?? null
  const regularFiles = files.filter((entry) => entry.name !== 'overview.md')
```

- [ ] **Step 3: Replace file item construction**

Replace the existing `fileItems` assignment with:

```js
  const fileItems = regularFiles.map((entry) => {
    const fileRel = joinRel(relDir, entry.name)
    return {
      text: titleForFile(root, fileRel),
      link: linkForMarkdown(fileRel)
    }
  })

  const overviewItem = overviewFile
    ? {
        text: titleForFile(root, joinRel(relDir, overviewFile.name)),
        link: linkForMarkdown(joinRel(relDir, overviewFile.name))
      }
    : null
```

- [ ] **Step 4: Add overview links to directory groups**

Replace the directory item object returned inside `directoryItems` with:

```js
      const item = {
        text: titleFromPath(entry.name),
        collapsed: true,
        items: childItems
      }

      const overviewRel = overviewFileRel(root, childRel)
      if (overviewRel) item.link = linkForMarkdown(overviewRel)

      return item
```

- [ ] **Step 5: Return overview before directories and regular files**

Replace the final return statement in `buildDirectoryItems` with:

```js
  return [overviewItem].concat(directoryItems, fileItems).filter(Boolean)
```

- [ ] **Step 6: Run the navigation test and confirm green**

Run:

```text
node --test tests/navigation.test.mjs
```

Expected: PASS. This should also keep overview pages first if a folder later gains subdirectories.

## Task 3: Add Dormant Overview Contract Test

**Files:**
- Modify: `tests/content-smoke.test.mjs`

- [ ] **Step 1: Add overview contract constants**

Add after `maxKnowledgeBasePagesPerDiagramKind`:

```js
const overviewFoldersWithContract = []
const legacyOverviewContractExceptions = new Set(['machine-learning'])

const requiredOverviewHeadings = [
  'Why This Foundation Exists',
  'What This Field Studies From First Principles',
  'Autonomy Problem Map',
  'Core Mental Model',
  'What This Foundation Lets You Review',
  'Problem-Class Coverage',
  'Reading Paths By Task',
  'Dependency Map',
  'Interfaces, Artifacts, and Failure Modes',
  'Boundaries With Neighboring Foundations',
  'Pages In This Section',
  'Core Sources'
]

const requiredProblemClasses = [
  'Perception and scene understanding',
  'Localization, SLAM, and state estimation',
  'Mapping and spatial memory',
  'Prediction and world modeling',
  'Planning and decision making',
  'Control and actuation',
  'Safety, validation, and assurance',
  'Runtime systems and operations'
]
```

- [ ] **Step 2: Add contract helper functions**

Add after `readMarkdownFiles`:

```js
function directPublicKnowledgeBaseFolders(root) {
  const knowledgeBaseDir = path.join(root, '10-knowledge-base')
  return fs
    .readdirSync(knowledgeBaseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_assets')
    .map((entry) => entry.name)
    .sort()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function h2Index(markdown, heading) {
  return markdown.match(new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, 'm'))?.index ?? -1
}
```

- [ ] **Step 3: Add overview registration guard**

Add before the overview contract test:

```js
test('existing knowledge-base overview pages are registered for the contract', () => {
  const unregistered = directPublicKnowledgeBaseFolders(repoRoot)
    .filter((folder) => fs.existsSync(path.join(repoRoot, '10-knowledge-base', folder, 'overview.md')))
    .filter((folder) => !legacyOverviewContractExceptions.has(folder))
    .filter((folder) => !overviewFoldersWithContract.includes(folder))

  assert.deepEqual(unregistered, [])
})
```

- [ ] **Step 4: Add contract test**

Add before `knowledge-base pages include one curated replacement visual`:

```js
test('completed knowledge-base section overviews follow the overview contract', () => {
  const failures = []

  for (const folder of overviewFoldersWithContract) {
    const relPath = `10-knowledge-base/${folder}/overview.md`
    const absPath = path.join(repoRoot, relPath)

    if (!fs.existsSync(absPath)) {
      failures.push(`${relPath}: missing overview page`)
      continue
    }

    const markdown = fs.readFileSync(absPath, 'utf8')
    const h1Match = markdown.match(/^# .+ Foundations for Autonomy$/m)
    assert.ok(h1Match, `${relPath}: should use the autonomy H1`)

    const afterH1 = markdown.slice(h1Match.index + h1Match[0].length).trimStart()
    assert.ok(afterH1.startsWith('<!-- kb-visual:start -->'), `${relPath}: visual block should appear immediately after H1`)

    let lastHeadingIndex = -1
    for (const heading of requiredOverviewHeadings) {
      const headingIndex = h2Index(markdown, heading)
      if (headingIndex < 0) {
        failures.push(`${relPath}: missing heading ${heading}`)
        continue
      }
      if (headingIndex < lastHeadingIndex) {
        failures.push(`${relPath}: heading ${heading} is out of order`)
      }
      lastHeadingIndex = headingIndex
    }

    const problemHeader = '| Problem Class | Role Of This Foundation | Representative Applied Pages |'
    if (!markdown.includes(problemHeader)) {
      failures.push(`${relPath}: missing required problem-class table header`)
    }

    for (const problemClass of requiredProblemClasses) {
      if (!markdown.includes(`| ${problemClass} |`)) {
        failures.push(`${relPath}: missing problem-class row ${problemClass}`)
      }
    }

    const reviewQuestionCount = (markdown.match(/^- .+\?$/gm) ?? []).length
    if (reviewQuestionCount < 3 || reviewQuestionCount > 5) {
      failures.push(`${relPath}: expected 3-5 review questions`)
    }

    const appliedLinks = new Set(
      Array.from(markdown.matchAll(/\]\((\.\.\/\.\.\/(?!10-knowledge-base\/)[^)]+\.md(?:#[^)]+)?)\)/g))
        .map((match) => match[1])
    )
    if (appliedLinks.size < 3 || appliedLinks.size > 5) {
      failures.push(`${relPath}: expected 3-5 unique applied links outside 10-knowledge-base`)
    }

    if (!/Diagnostic case:/i.test(markdown)) {
      failures.push(`${relPath}: missing diagnostic micro-case`)
    }
  }

  assert.deepEqual(failures, [])
})
```

- [ ] **Step 5: Run focused content test and confirm green**

Run:

```text
node --test tests/content-smoke.test.mjs
```

Expected: PASS because no folders are activated in `overviewFoldersWithContract` yet.

## Task 4: Verify And Commit Phase 1

**Files:**
- Modify: `.vitepress/navigation.mjs`
- Modify: `tests/navigation.test.mjs`
- Modify: `tests/content-smoke.test.mjs`

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
git add .vitepress/navigation.mjs tests/navigation.test.mjs tests/content-smoke.test.mjs
git commit -m "test: define knowledge base overview contract"
```
