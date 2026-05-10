import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { formatPriorityTable, replaceGeneratedBlock } from '../tools/autonomy-priority/generate-overviews.mjs'
import {
  ALLOWED_MATURITY_VALUES,
  ALLOWED_STAGE_VALUES,
  ALLOWED_TAGS,
  ALLOWED_TYPE_VALUES,
  checkPriorityMetadata,
  extractPriorityBlocks,
  parsePriorityYaml,
  priorityRowsForDirectory,
  validatePriority
} from '../tools/autonomy-priority/priority-metadata.mjs'

const validPriority = {
  learning: 4,
  deployment: 5,
  type: 'method-family',
  stage: 'modern-core',
  maturity: 'fielded-pattern',
  tags: ['slam', 'mapping', 'runtime-localization', 'outdoor'],
  reason: 'Core LiDAR-inertial baseline for mapping and localization fallback.'
}

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

test('formats priority rows as deterministic Markdown', () => {
  const table = formatPriorityTable(
    [
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
    ],
    '30-autonomy-stack/perception/methods'
  )

  assert.equal(
    table,
    [
      '| Method | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |',
      '|---|---:|---:|---|---|---|---|---|',
      '| [BEVDet](bevdet.md) | 4 | 4 | `method` | `modern-core` | `prototype` | `perception`, `road-av` | Baseline camera BEV detector that organizes many later BEV methods. |'
    ].join('\n')
  )
})

test('formats empty priority rows as a placeholder message', () => {
  assert.equal(formatPriorityTable([], '30-autonomy-stack/perception/methods'), 'No rated method pages yet.')
})

test('escapes generated Markdown table and link content', () => {
  const table = formatPriorityTable(
    [
      {
        relPath: '30-autonomy-stack/perception/methods/grid-bev-fusion.md',
        title: 'Grid [BEV]|Fusion',
        priority: {
          learning: 3,
          deployment: 2,
          type: 'method',
          stage: 'frontier',
          maturity: 'research',
          tags: ['perception|vision', 'road-av'],
          reason: 'Compares camera | radar fusion while retaining bracketed [context].'
        }
      }
    ],
    '30-autonomy-stack/perception/methods'
  )

  assert.equal(
    table,
    [
      '| Method | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |',
      '|---|---:|---:|---|---|---|---|---|',
      '| [Grid \\[BEV\\]\\|Fusion](grid-bev-fusion.md) | 3 | 2 | `method` | `frontier` | `research` | `perception\\|vision`, `road-av` | Compares camera \\| radar fusion while retaining bracketed [context]. |'
    ].join('\n')
  )
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

test('rejects missing generated priority table markers', () => {
  assert.throws(
    () => replaceGeneratedBlock('# Overview\n\nNo marker block.\n', 'new table'),
    /missing priority-table marker block/
  )
})

test('rejects duplicate generated priority table markers', () => {
  const source = `# Overview

<!-- priority-table:start -->
old
<!-- priority-table:end -->

<!-- priority-table:start -->
older
<!-- priority-table:end -->
`
  assert.throws(() => replaceGeneratedBlock(source, 'new table'), /duplicate priority-table marker block/)
})

test('rejects generated priority table start markers without end markers', () => {
  const source = `# Overview

<!-- priority-table:start -->
old
`
  assert.throws(() => replaceGeneratedBlock(source, 'new table'), /start marker without end marker/)
})

test('rejects generated priority table end markers without start markers', () => {
  const source = `# Overview

old
<!-- priority-table:end -->
`
  assert.throws(() => replaceGeneratedBlock(source, 'new table'), /end marker without start marker/)
})

test('rejects reversed generated priority table markers', () => {
  const source = `# Overview

<!-- priority-table:end -->
old
<!-- priority-table:start -->
`
  assert.throws(() => replaceGeneratedBlock(source, 'new table'), /priority-table start marker must appear before end marker/)
})

test('extracts one hidden priority block before the first section', () => {
  const blocks = extractPriorityBlocks(validMarkdown, 'fast-lio-fast-lio2.md')
  assert.equal(blocks.length, 1)
  assert.match(blocks[0].body, /learning: 4/)
})

test('parses the priority YAML subset', () => {
  const [block] = extractPriorityBlocks(validMarkdown, 'fast-lio-fast-lio2.md')
  assert.deepEqual(parsePriorityYaml(block.body), validPriority)
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

test('rejects priority blocks after the first section', () => {
  const markdown = `# Late Priority

## Executive Summary
Body.

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping"]
  reason: "Core baseline used to validate placement for hidden priority metadata."
method-priority:end -->
`
  assert.throws(
    () => extractPriorityBlocks(markdown, 'late.md'),
    /method-priority block must appear before the first ## heading/
  )
})

test('rejects priority blocks before the H1 heading', () => {
  const markdown = `<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping"]
  reason: "Core baseline used to validate placement after the page H1 heading."
method-priority:end -->

# Early Priority

## Executive Summary
Body.
`
  assert.throws(
    () => extractPriorityBlocks(markdown, 'early.md'),
    /early.md: method-priority block must appear after the H1 heading/
  )
})

test('rejects malformed priority YAML subset', () => {
  assert.throws(
    () => parsePriorityYaml('learning: 4\n', 'bad-yaml.md'),
    /bad-yaml.md: priority block must start with "priority:"/
  )
})

test('rejects duplicate priority YAML keys', () => {
  assert.throws(
    () => parsePriorityYaml('priority:\n  learning: 4\n  learning: 5\n', 'duplicate-field.md'),
    /duplicate-field.md: duplicate field learning/
  )
})

test('rejects malformed and missing values', () => {
  const priority = {
    learning: 6,
    deployment: 0,
    type: 'paper',
    stage: 'unknown-stage',
    maturity: 'unknown-maturity',
    tags: ['slam', 'unknown-tag'],
    reason: 'Too short.'
  }
  const result = validatePriority(priority, 'bad.md')
  assert.ok(result.errors.some((error) => error.includes('learning must be an integer from 1 to 5')))
  assert.ok(result.errors.some((error) => error.includes('deployment must be an integer from 1 to 5')))
  assert.ok(result.errors.some((error) => error.includes('type must be one of')))
  assert.ok(result.errors.some((error) => error.includes('stage must be one of')))
  assert.ok(result.errors.some((error) => error.includes('maturity must be one of')))
  assert.ok(result.errors.some((error) => error.includes('unknown tag unknown-tag')))
  assert.ok(result.errors.some((error) => error.includes('reason must be 40-180 characters')))

  const missing = validatePriority({}, 'missing.md')
  for (const field of ['learning', 'deployment', 'type', 'stage', 'maturity', 'tags', 'reason']) {
    assert.ok(missing.errors.some((error) => error.includes(`missing required field ${field}`)))
  }
})

test('rejects invalid tag schema', () => {
  const notArray = validatePriority({ ...validPriority, tags: 'slam' }, 'bad-tags.md')
  assert.ok(notArray.errors.some((error) => error.includes('tags must be an array')))

  const tooFew = validatePriority({ ...validPriority, tags: ['slam'] }, 'bad-tags.md')
  assert.ok(tooFew.errors.some((error) => error.includes('tags must contain 2-6 values')))

  const tooMany = validatePriority(
    { ...validPriority, tags: ['road-av', 'perception', 'slam', 'mapping', 'fallback', 'validation', 'outdoor'] },
    'bad-tags.md'
  )
  assert.ok(tooMany.errors.some((error) => error.includes('tags must contain 2-6 values')))

  const duplicate = validatePriority({ ...validPriority, tags: ['slam', 'mapping', 'slam'] }, 'bad-tags.md')
  assert.ok(duplicate.errors.some((error) => error.includes('tags must be unique')))
})

test('rejects unknown priority fields', () => {
  const result = validatePriority({ ...validPriority, source: 'manual' }, 'unknown-field.md')
  assert.ok(result.errors.some((error) => error.includes('unexpected field source')))
})

test('reports checker errors for malformed priority blocks without throwing', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-metadata-'))
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const methodsDir = path.join(tempRoot, '30-autonomy-stack/perception/methods')
  const slamDir = path.join(tempRoot, '30-autonomy-stack/localization-mapping/slam-methods')
  fs.mkdirSync(methodsDir, { recursive: true })
  fs.mkdirSync(slamDir, { recursive: true })
  fs.writeFileSync(
    path.join(methodsDir, 'bad.md'),
    `# Bad Metadata

<!-- method-priority:start
learning: 4
method-priority:end -->
`,
    'utf8'
  )

  const result = checkPriorityMetadata(tempRoot)
  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, [
    '30-autonomy-stack/perception/methods/bad.md: priority block must start with "priority:"'
  ])
})

test('reports checker errors for unmatched priority block markers', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-markers-'))
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const methodsDir = path.join(tempRoot, '30-autonomy-stack/perception/methods')
  const slamDir = path.join(tempRoot, '30-autonomy-stack/localization-mapping/slam-methods')
  fs.mkdirSync(methodsDir, { recursive: true })
  fs.mkdirSync(slamDir, { recursive: true })
  fs.writeFileSync(
    path.join(methodsDir, 'bad-markers.md'),
    `# Bad Markers

<!-- method-priority:start
priority:
  learning: 4
`,
    'utf8'
  )

  const result = checkPriorityMetadata(tempRoot)
  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, [
    '30-autonomy-stack/perception/methods/bad-markers.md: malformed method-priority block markers'
  ])
})

test('allows markdown files with no priority markers', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-missing-'))
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const methodsDir = path.join(tempRoot, '30-autonomy-stack/perception/methods')
  const slamDir = path.join(tempRoot, '30-autonomy-stack/localization-mapping/slam-methods')
  fs.mkdirSync(methodsDir, { recursive: true })
  fs.mkdirSync(slamDir, { recursive: true })
  fs.writeFileSync(
    path.join(methodsDir, 'missing.md'),
    `# Missing Metadata

## Executive Summary
Metadata rollout is still optional for this file.
`,
    'utf8'
  )

  assert.deepEqual(checkPriorityMetadata(tempRoot), { ok: true, errors: [] })
})

test('throws when directory priority rows include invalid metadata', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-rows-'))
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const relDir = '30-autonomy-stack/perception/methods'
  const methodsDir = path.join(tempRoot, relDir)
  const slamDir = path.join(tempRoot, '30-autonomy-stack/localization-mapping/slam-methods')
  fs.mkdirSync(methodsDir, { recursive: true })
  fs.mkdirSync(slamDir, { recursive: true })
  fs.writeFileSync(
    path.join(methodsDir, 'invalid-row.md'),
    `# Invalid Row

<!-- method-priority:start
priority:
  learning: 4
  deployment: 6
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping"]
  reason: "Parseable metadata that should fail validation before row generation."
method-priority:end -->

## Executive Summary
Body.
`,
    'utf8'
  )

  assert.throws(
    () => priorityRowsForDirectory(relDir, tempRoot),
    /30-autonomy-stack\/perception\/methods\/invalid-row.md: deployment must be an integer from 1 to 5/
  )
})

test('does not run the check CLI when imported by a process with --check', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-import-'))
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const modulePath = fileURLToPath(new URL('../tools/autonomy-priority/priority-metadata.mjs', import.meta.url))
  const importer = path.join(tempRoot, 'importer.mjs')
  fs.writeFileSync(
    importer,
    `import ${JSON.stringify(pathToFileURL(modulePath).href)}
console.log('imported')
`,
    'utf8'
  )

  const result = spawnSync(process.execPath, [importer, '--check'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout.trim(), 'imported')
})

test('exports stable enum sets for documentation and generation', () => {
  assert.deepEqual(ALLOWED_TYPE_VALUES, ['method', 'method-family', 'architecture-pattern', 'benchmark'])
  assert.deepEqual(ALLOWED_STAGE_VALUES, [
    'foundation',
    'classic-baseline',
    'modern-core',
    'deployment-pattern',
    'frontier',
    'reference'
  ])
  assert.deepEqual(ALLOWED_MATURITY_VALUES, [
    'fielded-pattern',
    'pilot-proven',
    'prototype',
    'research',
    'watchlist',
    'historical'
  ])
  assert.deepEqual(ALLOWED_TAGS, [
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
  ])
})
