import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DIAGRAM_KINDS, PAGE_DIAGRAM_KIND, visualKindForFile } from '../tools/knowledge-base/visual-taxonomy.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const minKnowledgeBaseDiagramKinds = 30
const maxKnowledgeBasePagesPerDiagramKind = 7

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

test('knowledge-base pages do not include generated figure placeholders', () => {
  const knowledgeBaseDir = path.join(repoRoot, '10-knowledge-base')
  const markdownFiles = readMarkdownFiles(knowledgeBaseDir)
  const generated = []

  for (const absPath of markdownFiles) {
    const relPath = path.relative(repoRoot, absPath).replace(/\\/g, '/')
    const markdown = fs.readFileSync(absPath, 'utf8')

    if (markdown.includes('<!-- kb-figure:start -->') || markdown.includes('<!-- kb-figure:end -->')) {
      generated.push(`${relPath}: contains generated kb-figure markers`)
    }

    if (/\]\(\.\.\/_assets\/figures\/[^)]+\.svg\)/.test(markdown)) {
      generated.push(`${relPath}: references generated knowledge-base figure assets`)
    }
  }

  assert.deepEqual(generated, [])
})

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

    if (!imageMatch) {
      failures.push(`${relPath}: curated visual must reference ../_assets/visuals/*.svg`)
    }

    if (!hasCaption) {
      failures.push(`${relPath}: curated visual must include a Visual caption`)
    }

    if (/generic|placeholder|auto-generated/i.test(block)) {
      failures.push(`${relPath}: curated visual block still uses generic placeholder wording`)
    }
  }

  assert.deepEqual(failures, [])
})

test('knowledge-base pages have explicit taxonomy visual assignments', () => {
  const knowledgeBaseDir = path.join(repoRoot, '10-knowledge-base')
  const markdownFiles = readMarkdownFiles(knowledgeBaseDir)
    .map((file) => path.relative(repoRoot, file).replace(/\\/g, '/'))
    .sort()
  const assignedFiles = Object.keys(PAGE_DIAGRAM_KIND).sort()
  const allowedKinds = new Set(DIAGRAM_KINDS)
  const failures = []
  const usage = new Map()

  assert.deepEqual(assignedFiles, markdownFiles)

  for (const [file, kind] of Object.entries(PAGE_DIAGRAM_KIND)) {
    if (!allowedKinds.has(kind)) {
      failures.push(`${file}: unknown diagram kind ${kind}`)
      continue
    }

    usage.set(kind, (usage.get(kind) ?? 0) + 1)
  }

  const dominantKinds = [...usage.entries()]
    .filter(([, count]) => count > maxKnowledgeBasePagesPerDiagramKind)
    .map(([kind, count]) => `${kind}:${count}`)

  assert.equal(new Set(DIAGRAM_KINDS).size, DIAGRAM_KINDS.length)
  assert.ok(
    usage.size >= minKnowledgeBaseDiagramKinds,
    `expected at least ${minKnowledgeBaseDiagramKinds} diagram kinds, got ${usage.size}`
  )
  assert.deepEqual(dominantKinds, [])
  assert.deepEqual(failures, [])
})

test('visual taxonomy helper normalizes expected knowledge-base paths', () => {
  assert.equal(
    visualKindForFile('10-knowledge-base/controls/frenet-trajectory-math.md'),
    'road-corridor-geometry'
  )
  assert.equal(
    visualKindForFile('10-knowledge-base\\controls\\frenet-trajectory-math.md'),
    'road-corridor-geometry'
  )
  assert.equal(
    visualKindForFile('./10-knowledge-base/controls/frenet-trajectory-math.md'),
    'road-corridor-geometry'
  )
  assert.equal(
    visualKindForFile(path.join(repoRoot, '10-knowledge-base/controls/frenet-trajectory-math.md')),
    'road-corridor-geometry'
  )
  assert.throws(
    () => visualKindForFile('10-knowledge-base/missing.md'),
    /Missing visual taxonomy assignment for 10-knowledge-base\/missing\.md/
  )
})

test('curated visual generator provides real renderer functions for taxonomy kinds', () => {
  const generatorPath = path.join(repoRoot, 'tools/knowledge-base/curated-visuals.mjs')
  const source = fs.readFileSync(generatorPath, 'utf8')
  const broadTemplateNames = ['Pipeline', 'ConceptMap', 'Matrix', 'Geometry', 'Timeline']
  const failures = []

  for (const kind of DIAGRAM_KINDS) {
    const rendererName = `render${kind
      .split('-')
      .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
      .join('')}`
    const functionPattern = new RegExp(`function\\s+${rendererName}\\s*\\(`)

    if (!functionPattern.test(source)) {
      failures.push(`${kind}: missing ${rendererName} function declaration`)
    }

    for (const templateName of broadTemplateNames) {
      const aliasPattern = new RegExp(`const\\s+${rendererName}\\s*=\\s*render${templateName}\\b`)
      if (aliasPattern.test(source)) {
        failures.push(`${kind}: ${rendererName} still aliases render${templateName}`)
      }
    }
  }

  assert.deepEqual(failures, [])
})

test('curated knowledge-base visual assets keep accessible metadata', () => {
  const knowledgeBaseDir = path.join(repoRoot, '10-knowledge-base')
  const markdownFiles = readMarkdownFiles(knowledgeBaseDir)
  const failures = []
  const rawAmpersandPattern = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/

  for (const absPath of markdownFiles) {
    const relPath = path.relative(repoRoot, absPath).replace(/\\/g, '/')
    const markdown = fs.readFileSync(absPath, 'utf8')
    const visualBlock = markdown.match(/<!-- kb-visual:start -->[\s\S]*?<!-- kb-visual:end -->/)?.[0]

    if (!visualBlock) {
      failures.push(`${relPath}: missing curated visual block`)
      continue
    }

    const imageRel = visualBlock.match(/!\[[^\]]+\]\((\.\.\/_assets\/visuals\/[^)]+\.svg)\)/)?.[1]
    const caption = visualBlock.match(/\*Visual: ([^\r\n]+)\*/)?.[1]

    if (!imageRel || !caption) {
      failures.push(`${relPath}: curated visual block is missing image or caption`)
      continue
    }

    const imagePath = path.resolve(path.dirname(absPath), imageRel)
    if (!fs.existsSync(imagePath)) {
      failures.push(`${relPath}: curated visual asset does not exist at ${path.relative(repoRoot, imagePath)}`)
      continue
    }

    const svg = fs.readFileSync(imagePath, 'utf8')
    const expectedKind = PAGE_DIAGRAM_KIND[relPath]
    const rootSvgOpen = svg.match(/<svg\b[^>]*>/)?.[0]
    const diagramKind = rootSvgOpen?.match(/data-diagram-kind="([^"]+)"/)?.[1]
    const svgRootCount = (svg.match(/<svg\b/g) ?? []).length
    const titleCount = (svg.match(/<title\b/g) ?? []).length
    const descMatches = [...svg.matchAll(/<desc\b[^>]*>([\s\S]*?)<\/desc>/g)]

    if (svgRootCount !== 1 || !svg.trimEnd().endsWith('</svg>')) {
      failures.push(`${relPath}: expected one complete root SVG element`)
    }

    if (!rootSvgOpen) {
      failures.push(`${relPath}: expected an opening root SVG element`)
    }

    if (titleCount !== 1) {
      failures.push(`${relPath}: expected one title element`)
    }

    if (descMatches.length !== 1) {
      failures.push(`${relPath}: expected one desc element`)
    }

    if (!descMatches.some((match) => match[1].includes(caption))) {
      failures.push(`${relPath}: SVG desc should include the curated Visual caption`)
    }

    if (!expectedKind) {
      failures.push(`${relPath}: missing taxonomy assignment`)
    }

    if (diagramKind !== expectedKind) {
      failures.push(`${relPath}: SVG diagram kind ${diagramKind ?? 'missing'} should match ${expectedKind}`)
    }

    if (expectedKind && !svg.includes(`<!-- layout:${expectedKind} -->`)) {
      failures.push(`${relPath}: SVG should include layout marker for ${expectedKind}`)
    }

    if (/generic|placeholder|auto-generated/i.test(svg)) {
      failures.push(`${relPath}: SVG still uses generic placeholder wording`)
    }

    if (rawAmpersandPattern.test(svg)) {
      failures.push(`${relPath}: SVG contains an unescaped ampersand`)
    }
  }

  assert.deepEqual(failures, [])
})
