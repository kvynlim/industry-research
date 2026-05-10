import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DIAGRAM_KINDS, PAGE_DIAGRAM_KIND, visualKindForFile } from '../tools/knowledge-base/visual-taxonomy.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const minKnowledgeBaseDiagramKinds = 30
const maxKnowledgeBasePagesPerDiagramKind = 7
const overviewFoldersWithContract = [
  'controls',
  'geometry-3d',
  'machine-learning',
  'mapping',
  'numerical-linear-algebra',
  'optimization',
  'probability-statistics',
  'robotics',
  'sensors',
  'signal-processing',
  'state-estimation',
  'systems-engineering'
]
const legacyOverviewContractExceptions = new Set()

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
  '10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md',
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

test('robust losses knowledge-base page covers canonical estimators and links', () => {
  const robustLossPage = '10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md'
  const robustLossPath = path.join(repoRoot, robustLossPage)
  const markdown = fs.readFileSync(robustLossPath, 'utf8')
  const requiredTerms = [
    'Huber',
    'Cauchy',
    'Tukey',
    'Geman-McClure',
    'M-estimator',
    'influence function',
    'IRLS',
    'whitened'
  ]

  for (const term of requiredTerms) {
    assert.ok(markdown.includes(term), `${robustLossPage} should include ${term}`)
  }

  const linkTargets = [
    '10-knowledge-base/probability-statistics/robust-statistics-ransac-hypothesis-testing.md',
    '10-knowledge-base/probability-statistics/likelihood-map-mle-least-squares.md',
    '10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md',
    '10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md',
    '10-knowledge-base/state-estimation/gtsam-factor-graphs.md',
    '30-autonomy-stack/localization-mapping/slam-methods/icp.md',
    '30-autonomy-stack/localization-mapping/slam-methods/point-to-plane-icp.md',
    '30-autonomy-stack/localization-mapping/slam-methods/graphslam-pose-graph-optimization.md',
    '30-autonomy-stack/localization-mapping/slam-methods/bundle-adjustment-slam.md',
    '30-autonomy-stack/localization-mapping/slam-methods/robust-pgo-gnc-risam.md',
    '30-autonomy-stack/perception/methods/overview.md',
    '30-autonomy-stack/perception/methods/adverse-weather-radar-lidar-3d-detection.md'
  ]

  for (const relPath of linkTargets) {
    const source = fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
    assert.match(
      source,
      /\]\([^)]*robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure\.md(?:#[^)]*)?\)/,
      `${relPath} should link to the robust losses page`
    )
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

test('existing knowledge-base overview pages are registered for the contract', () => {
  const unregistered = directPublicKnowledgeBaseFolders(repoRoot)
    .filter((folder) => fs.existsSync(path.join(repoRoot, '10-knowledge-base', folder, 'overview.md')))
    .filter((folder) => !legacyOverviewContractExceptions.has(folder))
    .filter((folder) => !overviewFoldersWithContract.includes(folder))

  assert.deepEqual(unregistered, [])
})

test('every public knowledge-base folder has an overview page', () => {
  const missing = directPublicKnowledgeBaseFolders(repoRoot)
    .filter((folder) => !fs.existsSync(path.join(repoRoot, '10-knowledge-base', folder, 'overview.md')))

  assert.deepEqual(missing, [])
})

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
