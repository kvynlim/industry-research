import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const batch1ExpectedFigures = [
  {
    file: '10-knowledge-base/geometry-3d/pointpillars.md',
    asset: 'geometry-3d-pointpillars.svg',
    caption: 'PointPillars converts raw point clouds into bounded pillar tensors, pooled pillar features, a BEV pseudo-image, and detector or world-model outputs.'
  },
  {
    file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
    asset: 'systems-engineering-signal-processing-weather.svg',
    caption: 'The weather-processing recommendations form a chain from dual-return evidence through DSOR and LIOR cleanup, temporal filtering, severity classification, and degraded-mode response.'
  },
  {
    file: '10-knowledge-base/systems-engineering/theoretical-foundations.md',
    asset: 'systems-engineering-theoretical-foundations.svg',
    caption: 'The theoretical foundations page connects world-model formalism to predictive coding, representation theory, causality, control, games, and safety-critical ML evidence.'
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md',
    asset: 'numerical-linear-algebra-cholesky-ldlt-normal-equations.svg',
    caption: 'Normal equations turn residual Jacobians into an SPD system only when the problem is well constrained; Cholesky and LDLT expose conditioning and indefiniteness.'
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md',
    asset: 'numerical-linear-algebra-eigenvalues-hessian-conditioning-observability.svg',
    caption: 'The Hessian spectrum separates well-constrained directions, weakly constrained directions, and nullspaces that require damping, priors, or better excitation.'
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md',
    asset: 'numerical-linear-algebra-qr-svd-rank-revealing-solvers.svg',
    caption: 'QR and SVD solve least-squares problems while exposing rank and nullspace structure that normal equations can hide.'
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md',
    asset: 'numerical-linear-algebra-schur-complement-marginalization-pcg.svg',
    caption: 'The Schur complement removes landmarks or nuisance states to produce a smaller reduced system for pose solving, marginalization, or PCG.'
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md',
    asset: 'numerical-linear-algebra-sparse-matrices-fill-in-ordering.svg',
    caption: 'Variable ordering changes fill-in during sparse factorization, directly affecting memory, runtime, and whether real-time SLAM remains feasible.'
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md',
    asset: 'numerical-linear-algebra-square-root-information-and-covariance-recovery.svg',
    caption: 'Square-root information methods preserve numerical stability by carrying factored information matrices and recovering selected marginal covariances only when needed.'
  }
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

test('knowledge-base pages include local explanatory figures', () => {
  const knowledgeBaseDir = path.join(repoRoot, '10-knowledge-base')
  const markdownFiles = readMarkdownFiles(knowledgeBaseDir)
  const missing = []

  for (const absPath of markdownFiles) {
    const relPath = path.relative(repoRoot, absPath).replace(/\\/g, '/')
    const markdown = fs.readFileSync(absPath, 'utf8')
    const imageMatch = markdown.match(/!\[[^\]]+\]\((\.\.\/_assets\/figures\/[^)]+\.svg)\)/)
    const hasCaption = /\*Figure: .+\*/.test(markdown)

    if (!imageMatch) {
      missing.push(`${relPath}: missing local SVG figure`)
      continue
    }

    if (!hasCaption) {
      missing.push(`${relPath}: missing figure caption`)
      continue
    }

    const imagePath = path.resolve(path.dirname(absPath), imageMatch[1])
    if (!fs.existsSync(imagePath)) {
      missing.push(`${relPath}: figure asset does not exist at ${path.relative(repoRoot, imagePath)}`)
    }
  }

  assert.deepEqual(missing, [])
})

test('batch 1 curated knowledge-base figures keep targeted captions', () => {
  const genericCaptionPatterns = [
    /\*Figure: how /i,
    /shows the tradeoff or curve shape behind/i,
    /shows the section flow from design choice -> tuning knob -> runtime check -> log signal/i,
    /shows the matrix or attention structure behind/i,
    /shows the layered responsibilities from state -> action -> observation -> belief update/i,
    /shows the geometric relationship among input evidence ->/i,
    /shows the geometric relationship among laser pulse -> time of flight -> beam angle -> reflectance/i,
    /shows the temporal ordering from state -> action -> observation -> belief update/i
  ]

  const failures = []

  for (const expected of batch1ExpectedFigures) {
    const absPath = path.join(repoRoot, expected.file)
    const markdown = fs.readFileSync(absPath, 'utf8')
    const blocks = [...markdown.matchAll(/<!-- kb-figure:start -->[\s\S]*?<!-- kb-figure:end -->/g)]
    const block = blocks
      .map((match) => match[0])
      .find((candidate) => candidate.includes(`](../_assets/figures/${expected.asset})`))

    if (!block) {
      failures.push(`${expected.file}: missing figure block for ${expected.asset}`)
      continue
    }

    if (!block.includes(`*Figure: ${expected.caption}*`)) {
      failures.push(`${expected.file}: ${expected.asset} missing curated caption`)
    }

    if (genericCaptionPatterns.some((pattern) => pattern.test(block))) {
      failures.push(`${expected.file}: ${expected.asset} still has a generic caption`)
    }
  }

  assert.deepEqual(failures, [])
})

test('batch 1 curated SVG assets keep accessible metadata', () => {
  const failures = []
  const rawAmpersandPattern = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/

  for (const expected of batch1ExpectedFigures) {
    const assetPath = path.join(repoRoot, '10-knowledge-base', '_assets', 'figures', expected.asset)

    if (!fs.existsSync(assetPath)) {
      failures.push(`${expected.asset}: missing SVG asset`)
      continue
    }

    const svg = fs.readFileSync(assetPath, 'utf8')
    const svgRootCount = (svg.match(/<svg\b/g) ?? []).length
    const titleCount = (svg.match(/<title\b/g) ?? []).length
    const descMatches = [...svg.matchAll(/<desc\b[^>]*>([\s\S]*?)<\/desc>/g)]
    const descCount = descMatches.length

    if (svgRootCount !== 1 || !svg.trimEnd().endsWith('</svg>')) {
      failures.push(`${expected.asset}: expected one complete root SVG element`)
    }

    if (titleCount !== 1) {
      failures.push(`${expected.asset}: expected one title element`)
    }

    if (descCount !== 1) {
      failures.push(`${expected.asset}: expected one desc element`)
    }

    if (!descMatches.some((match) => match[1].includes(expected.caption))) {
      failures.push(`${expected.asset}: desc should include the curated caption`)
    }

    if (rawAmpersandPattern.test(svg)) {
      failures.push(`${expected.asset}: contains an unescaped ampersand`)
    }
  }

  assert.deepEqual(failures, [])
})
