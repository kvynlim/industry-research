import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const requiredDocs = [
  'README.md',
  'INDEX.md',
  'GLOSSARY.md',
  'METHODOLOGY.md',
  'synthesis/master-synthesis.md',
  'synthesis/getting-started.md',
  'companies/waymo/tech-stack.md',
  'technology/world-models/overview.md',
  'operations/safety/iso-3691-4-deep-dive.md',
  'hardware/compute/nvidia-orin-technical.md',
  'foundations/pointpillars.md',
  'cross-cutting/sensor-fusion-architectures.md'
]

function readMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'node_modules') continue

    const absPath = path.join(dir, entry.name)
    const relPath = path.relative(repoRoot, absPath).replace(/\\/g, '/')
    if (relPath.startsWith('docs/superpowers/')) continue

    if (entry.isDirectory()) {
      files.push(...readMarkdownFiles(absPath))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absPath)
    }
  }

  return files
}

test('required top-level and representative nested docs exist', () => {
  for (const relPath of requiredDocs) {
    assert.ok(fs.existsSync(path.join(repoRoot, relPath)), `${relPath} should exist`)
  }
})

test('required docs have H1 headings for page titles', () => {
  for (const relPath of requiredDocs) {
    const markdown = fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
    assert.match(markdown, /^#\s+.+$/m, `${relPath} should have an H1`)
  }
})

test('repository corpus contains acceptance search terms', () => {
  const corpus = readMarkdownFiles(repoRoot)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n')

  for (const term of ['Waymo', 'world models', 'ISO 3691-4', 'Orin']) {
    assert.ok(corpus.toLowerCase().includes(term.toLowerCase()), `corpus should contain ${term}`)
  }
})
