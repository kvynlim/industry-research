import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  CONTENT_DIRS,
  ROOT_MARKDOWN_FILES,
  auditDomainBalance,
  formatAuditReport,
  publicMarkdownFiles
} from '../tools/domain-balance/audit.mjs'

test('publicMarkdownFiles includes root reader Markdown and reader source directories', (t) => {
  const root = makeFixture({
    'README.md': '# Readme\n',
    'INDEX.md': '# Index\n',
    'METHODOLOGY.md': '# Methodology\n',
    'GLOSSARY.md': '# Glossary\n',
    'NOTES.md': '# Private note\n',
    '00-start-here/overview.md': '# Start\n',
    '00-start-here/deeper/context.md': '# Context\n',
    '90-synthesis/master.md': '# Synthesis\n'
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  assert.deepEqual(ROOT_MARKDOWN_FILES, ['README.md', 'INDEX.md', 'METHODOLOGY.md', 'GLOSSARY.md'])
  assert.deepEqual(CONTENT_DIRS, [
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
  ])
  assert.deepEqual(publicMarkdownFiles(root), [
    'README.md',
    'INDEX.md',
    'METHODOLOGY.md',
    'GLOSSARY.md',
    '00-start-here/deeper/context.md',
    '00-start-here/overview.md',
    '90-synthesis/master.md'
  ])
})

test('publicMarkdownFiles excludes internal artifacts', (t) => {
  const root = makeFixture({
    'README.md': '# Readme\n',
    'docs/superpowers/plan.md': '# Internal\n',
    '.vitepress/config.md': '# Internal\n',
    'tools/domain-balance/readme.md': '# Internal\n',
    'tests/domain-balance.test.md': '# Internal\n',
    '10-knowledge-base/.drafts/hidden.md': '# Hidden\n',
    '10-knowledge-base/state-estimation/gtsam.md': '# Public\n'
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  assert.deepEqual(publicMarkdownFiles(root), ['README.md', '10-knowledge-base/state-estimation/gtsam.md'])
})

test('auditDomainBalance counts canonical domain buckets by file and mention without writing files', (t) => {
  const root = makeFixture({
    'README.md': '# Overview\nAirport apron turnaround.\n',
    'INDEX.md': '# Overview\nWaymo road AV.\n',
    'METHODOLOGY.md': '# Overview\nISO 3691-4 forklift.\n',
    'GLOSSARY.md': '# Empty\nNo domain keyword here.\n'
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const before = snapshotFiles(root)
  const report = auditDomainBalance(root)
  const after = snapshotFiles(root)

  assert.equal(report.totalFiles, 4)
  assert.deepEqual(report.domains.airside, { files: 1, mentions: 3 })
  assert.deepEqual(report.domains.road, { files: 1, mentions: 2 })
  assert.deepEqual(report.domains.warehouse, { files: 1, mentions: 2 })
  assert.deepEqual(report.domains.port, { files: 0, mentions: 0 })
  assert.deepEqual(report.folders.root, {
    files: 4,
    domains: {
      airside: 3,
      road: 2,
      warehouse: 2,
      'logistics-yard': 0,
      port: 0,
      mining: 0,
      construction: 0,
      agriculture: 0,
      'delivery-robot': 0,
      'outdoor-campus': 0
    }
  })
  assert.deepEqual(after, before)
})

test('auditDomainBalance counts ADS-B as airside without road ADS false positives', (t) => {
  const root = makeFixture({
    'README.md': '# Overview\nADS-B surveillance supports airport operations.\n',
    'INDEX.md': '# Overview\nRoad ADS programs evaluate automated driving systems.\n'
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const report = auditDomainBalance(root)

  assert.deepEqual(report.domains.airside, { files: 1, mentions: 2 })
  assert.deepEqual(report.domains.road, { files: 1, mentions: 2 })
  assert.deepEqual(report.folders.root.domains.airside, 2)
  assert.deepEqual(report.folders.root.domains.road, 2)
})

test('formatAuditReport emits deterministic Markdown tables', (t) => {
  const root = makeFixture({
    'README.md': '# Overview\nAirport apron.\n',
    'INDEX.md': '# Overview\nRoad corridors.\n',
    'METHODOLOGY.md': '# Overview\nWarehouse operations.\n',
    'GLOSSARY.md': '# Glossary\nNo domain keyword here.\n'
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

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

function makeFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-balance-'))
  for (const [relPath, content] of Object.entries(files)) {
    const filePath = path.join(root, relPath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf8')
  }
  return root
}

function snapshotFiles(root) {
  const files = []
  collectFiles(root, root, files)
  return files.sort()
}

function collectFiles(root, dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(root, absPath, files)
    } else if (entry.isFile()) {
      const relPath = path.relative(root, absPath).replace(/\\/g, '/')
      const content = fs.readFileSync(absPath, 'utf8')
      files.push(`${relPath}\0${content}`)
    }
  }
}
