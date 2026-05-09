#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const knowledgeBaseRoot = path.join(repoRoot, '10-knowledge-base')
const visualRoot = path.join(knowledgeBaseRoot, '_assets', 'visuals')
const reassessmentPath = path.join(
  repoRoot,
  'docs',
  'superpowers',
  'notes',
  '2026-05-09-knowledge-base-visual-reassessment-generated-removed.md'
)
const markerStart = '<!-- kb-visual:start -->'
const markerEnd = '<!-- kb-visual:end -->'

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function escapeMarkdown(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
}

function toTitle(value) {
  return String(value)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function wrapText(value, maxChars = 18) {
  const words = toTitle(value).split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && next.length > maxChars) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }

  if (line) lines.push(line)
  return lines
}

function textBlock(value, x, y, options = {}) {
  const lines = wrapText(value, options.maxChars ?? 18).slice(0, options.maxLines ?? 4)
  const size = options.size ?? 18
  const weight = options.weight ?? 700
  const fill = options.fill ?? '#172033'
  const anchor = options.anchor ?? 'middle'
  const lineHeight = options.lineHeight ?? Math.round(size * 1.22)

  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`)
    .join('\n')
}

function label(value, x, y, options = {}) {
  return textBlock(value, x, y, {
    size: options.size ?? 14,
    weight: options.weight ?? 600,
    fill: options.fill ?? '#475569',
    anchor: options.anchor ?? 'middle',
    maxChars: options.maxChars ?? 24,
    maxLines: options.maxLines ?? 3
  })
}

function box(x, y, width, height, title, options = {}) {
  const fill = options.fill ?? '#eff6ff'
  const stroke = options.stroke ?? '#2563eb'
  const titleY = y + height / 2 - (options.subtitle ? 8 : -6)
  const subtitle = options.subtitle
    ? textBlock(options.subtitle, x + width / 2, y + height / 2 + 20, {
      size: 13,
      weight: 600,
      fill: '#64748b',
      maxChars: options.subtitleChars ?? 22,
      maxLines: 2
    })
    : ''

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
${textBlock(title, x + width / 2, titleY, {
  size: options.titleSize ?? 17,
  maxChars: options.titleChars ?? 18,
  maxLines: options.titleLines ?? 2
})}
${subtitle}`
}

function arrow(x1, y1, x2, y2, color = '#2563eb', width = 3) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" marker-end="url(#arrow)"/>`
}

function pathArrow(d, color = '#2563eb', width = 3) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"/>`
}

function frame(spec, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="720" viewBox="0 0 1400 720" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(spec.title)}</title>
  <desc id="desc">${escapeXml(spec.caption)}</desc>
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#2563eb"/>
    </marker>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="#e2e8f0" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1400" height="720" fill="#f8fafc"/>
  <rect x="42" y="38" width="1316" height="644" rx="20" fill="#ffffff" stroke="#d9e2ef" filter="url(#shadow)"/>
  <text x="80" y="88" font-size="30" font-weight="800" fill="#0f172a">${escapeXml(spec.title)}</text>
  <text x="80" y="122" font-size="16" font-weight="600" fill="#475569">${escapeXml(spec.emphasis)}</text>
  <rect x="80" y="144" width="1240" height="2" fill="#dbeafe"/>
${inner}
</svg>
`
}

function palette(index) {
  const fills = ['#eff6ff', '#f0fdf4', '#fff7ed', '#ecfeff', '#f5f3ff', '#ffe4e6', '#f8fafc']
  const strokes = ['#2563eb', '#16a34a', '#ea580c', '#0891b2', '#7c3aed', '#e11d48', '#475569']
  return { fill: fills[index % fills.length], stroke: strokes[index % strokes.length] }
}

function renderPipeline(spec) {
  const nodes = spec.nodes.slice(0, 6)
  const width = 180
  const gap = 34
  const x0 = 88
  const y = 286
  const content = nodes.map((node, index) => {
    const x = x0 + index * (width + gap)
    const colors = palette(index)
    const link = index < nodes.length - 1 ? arrow(x + width + 3, y + 54, x + width + gap - 7, y + 54) : ''
    return `${box(x, y, width, 108, node, { ...colors, titleChars: 17 })}\n${link}`
  }).join('\n')

  const feedback = nodes.length > 3
    ? `${pathArrow(`M${x0 + (nodes.length - 1) * (width + gap) + 90} 420 C${x0 + 650} 560 ${x0 + 210} 560 ${x0 + 90} 420`, '#64748b', 2.5)}
${label('validation and diagnostics feed the next pass', 700, 586, { maxChars: 54 })}`
    : ''

  return frame(spec, `${content}\n${feedback}`)
}

function renderConceptMap(spec) {
  const nodes = spec.nodes.slice(0, 7)
  const center = box(560, 278, 280, 118, nodes[0] ?? spec.title, {
    fill: '#eef2ff',
    stroke: '#4f46e5',
    titleChars: 23,
    titleSize: 18
  })
  const positions = [
    [140, 190], [420, 178], [900, 178], [1160, 220],
    [190, 486], [590, 512], [980, 486]
  ]
  const satellites = nodes.slice(1).map((node, index) => {
    const [x, y] = positions[index]
    const colors = palette(index)
    const cx = 700
    const cy = 337
    return `${arrow(cx, cy, x + 95, y + 42, '#64748b', 2.4)}
${box(x, y, 190, 86, node, { ...colors, titleChars: 18, titleSize: 15 })}`
  }).join('\n')

  return frame(spec, `${center}\n${satellites}`)
}

function matrixGrid(x, y, rows, cols, cell, active, options = {}) {
  let output = ''
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const state = active(row, col)
      const fill = state === 2 ? (options.strong ?? '#2563eb') : state === 1 ? (options.mid ?? '#bfdbfe') : '#f8fafc'
      output += `<rect x="${x + col * cell}" y="${y + row * cell}" width="${cell - 5}" height="${cell - 5}" rx="5" fill="${fill}" stroke="#cbd5e1"/>\n`
    }
  }
  return output
}

function renderMatrix(spec) {
  const nodes = spec.nodes.slice(0, 6)
  const matrix = matrixGrid(568, 190, 7, 7, 42, (row, col) => {
    if (row === col) return 2
    if (Math.abs(row - col) === 1) return 1
    if ((row + col) % 5 === 0) return 1
    return 0
  })
  const left = nodes.slice(0, 3).map((node, index) => {
    const colors = palette(index)
    return box(112, 190 + index * 126, 270, 82, node, { ...colors, titleChars: 24 })
  }).join('\n')
  const right = nodes.slice(3, 6).map((node, index) => {
    const colors = palette(index + 3)
    return box(1018, 190 + index * 126, 270, 82, node, { ...colors, titleChars: 24 })
  }).join('\n')

  return frame(spec, `
${left}
${arrow(386, 232, 552, 256, '#64748b', 2.5)}
${arrow(386, 358, 552, 326, '#64748b', 2.5)}
${arrow(386, 484, 552, 402, '#64748b', 2.5)}
<rect x="552" y="174" width="312" height="312" rx="14" fill="url(#grid)" stroke="#0f172a" stroke-width="2"/>
${matrix}
${arrow(866, 256, 1014, 232, '#64748b', 2.5)}
${arrow(866, 326, 1014, 358, '#64748b', 2.5)}
${arrow(866, 402, 1014, 484, '#64748b', 2.5)}
${right}
${label('matrix, graph, or score structure exposes hidden numerical behavior', 700, 558, { maxChars: 68 })}
`)
}

function renderGeometry(spec) {
  const nodes = spec.nodes.slice(0, 6)
  const callouts = nodes.map((node, index) => {
    const positions = [[96, 202], [360, 176], [706, 170], [1010, 222], [322, 500], [888, 506]]
    const [x, y] = positions[index]
    const colors = palette(index)
    return box(x, y, 220, 78, node, { ...colors, titleChars: 20, titleSize: 15 })
  }).join('\n')

  return frame(spec, `
<rect x="170" y="442" width="230" height="72" rx="16" fill="#1e293b"/>
<circle cx="224" cy="522" r="24" fill="#0f172a"/>
<circle cx="350" cy="522" r="24" fill="#0f172a"/>
<polygon points="400,454 980,208 980,520" fill="#dbeafe" opacity="0.45" stroke="#2563eb" stroke-width="3"/>
<line x1="400" y1="454" x2="1045" y2="350" stroke="#2563eb" stroke-width="4" marker-end="url(#arrow)"/>
<circle cx="1045" cy="350" r="17" fill="#ef4444"/>
<line x1="286" y1="442" x2="286" y2="300" stroke="#0f766e" stroke-width="4" marker-end="url(#arrow)"/>
<line x1="286" y1="442" x2="445" y2="442" stroke="#0f766e" stroke-width="4" marker-end="url(#arrow)"/>
${callouts}
${label('geometry makes frames, rays, timing, and residuals inspectable', 700, 606, { maxChars: 62 })}
`)
}

function renderTimeline(spec) {
  const nodes = spec.nodes.slice(0, 6)
  const startX = 150
  const gap = 220
  const y = 356
  const events = nodes.map((node, index) => {
    const x = startX + index * gap
    const boxY = index % 2 === 0 ? 202 : 456
    const colors = palette(index)
    return `<line x1="${x}" y1="${y}" x2="${x}" y2="${boxY + 40}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 8"/>
<circle cx="${x}" cy="${y}" r="14" fill="#2563eb"/>
${box(x - 92, boxY, 184, 80, node, { ...colors, titleChars: 18, titleSize: 15 })}`
  }).join('\n')

  return frame(spec, `
<line x1="112" y1="${y}" x2="1288" y2="${y}" stroke="#0f172a" stroke-width="5" stroke-linecap="round" marker-end="url(#arrow)"/>
${events}
${label('ordered state changes explain memory, synchronization, and update timing', 700, 620, { maxChars: 70 })}
`)
}

function chooseRenderer(spec) {
  const text = `${spec.file} ${spec.caption}`.toLowerCase()
  if (/matrix|hessian|eigen|qr|svd|cholesky|ldlt|schur|sparse|covariance|information|attention matrix|confusion|assignment|roc|pr curve|score/.test(text)) return renderMatrix
  if (/geometry|coordinate|frame|projection|ray|camera|lidar|gnss|rtk|ellipse|map|lanelet|trajectory|wheel|frenet|point cloud/.test(text)) return renderGeometry
  if (/timeline|sequence|time|temporal|sync|preintegration|recurrent|bptt|rollout|diffusion|sampling|scan/.test(text)) return renderTimeline
  if (/theory|dependency|graph|belief|message|factor|causal|architecture|objective|decision/.test(text)) return renderConceptMap
  return renderPipeline
}

function listMarkdownFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_assets') continue
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listMarkdownFiles(absPath, files)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(path.relative(repoRoot, absPath).replace(/\\/g, '/'))
    }
  }
  return files.sort()
}

function parseReassessment() {
  if (!fs.existsSync(reassessmentPath)) {
    throw new Error(`Missing reassessment file: ${path.relative(repoRoot, reassessmentPath)}`)
  }

  const markdown = fs.readFileSync(reassessmentPath, 'utf8')
  const entries = [...markdown.matchAll(/^- `(10-knowledge-base\/[^`]+\.md)` - Visual needed: yes\. Replacement visual: ([^\r\n]+)$/gm)]
  return entries.map((match) => {
    const file = match[1]
    const caption = match[2].trim()
    const markdownPath = path.join(repoRoot, file)
    if (!fs.existsSync(markdownPath)) throw new Error(`Missing knowledge-base file: ${file}`)

    const source = fs.readFileSync(markdownPath, 'utf8')
    const h1 = source.match(/^#\s+(.+)$/m)?.[1]?.trim()
    if (!h1) throw new Error(`Missing H1 in ${file}`)

    const slug = file
      .replace(/^10-knowledge-base\//, '')
      .replace(/\.md$/, '')
      .replaceAll('/', '-')
    const asset = `${slug}.svg`
    const nodes = extractNodes(caption, h1)

    return {
      file,
      asset,
      title: visualTitle(h1, caption),
      alt: `${h1} curated visual`,
      caption,
      emphasis: emphasisFromCaption(caption),
      nodes
    }
  })
}

function visualTitle(h1, caption) {
  const cleanTitle = toTitle(h1).replace(/: First Principles$/, '')
  const cue = caption.match(/^([^,.;]+?)(?: showing| comparing| contrasting| linking| connecting| covering| from| with|$)/i)?.[1]
  const prefix = cue ? toTitle(cue) : cleanTitle
  if (prefix.length > 54) return cleanTitle.slice(0, 54)
  return prefix
}

function emphasisFromCaption(caption) {
  const clean = toTitle(caption)
  return clean.length > 150 ? `${clean.slice(0, 147).trim()}...` : clean
}

function extractNodes(caption, h1) {
  const afterCue = caption
    .replace(/^.*?\b(showing|comparing|contrasting|linking|connecting|covering)\b\s+/i, '')
    .replace(/^.*?\bfrom\b\s+/i, '')
  const rawParts = afterCue
    .replace(/\.$/, '')
    .split(/,\s+|\s+and\s+|\s+to\s+|\s+with\s+|\s+versus\s+|\s+vs\.\s+/i)
    .map((part) => toTitle(part)
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((part) => part.length >= 3 && part.length <= 48)

  const unique = []
  for (const part of rawParts) {
    if (!unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      unique.push(part)
    }
  }

  const titleParts = toTitle(h1)
    .split(/,|:| and | for | from /i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && part.length <= 42)

  for (const part of titleParts) {
    if (unique.length >= 6) break
    if (!unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) unique.push(part)
  }

  return unique.slice(0, 6)
}

function validateManifestAgainstLiveFiles(specs) {
  const liveFiles = listMarkdownFiles(knowledgeBaseRoot)
  const specFiles = specs.map((spec) => spec.file).sort()
  const missing = liveFiles.filter((file) => !specFiles.includes(file))
  const extra = specFiles.filter((file) => !liveFiles.includes(file))
  const duplicates = specFiles.filter((file, index) => specFiles.indexOf(file) !== index)

  if (missing.length > 0 || extra.length > 0 || duplicates.length > 0) {
    throw new Error([
      'Curated visual manifest does not match live knowledge-base inventory.',
      `Missing specs: ${missing.join(', ') || 'none'}`,
      `Extra specs: ${extra.join(', ') || 'none'}`,
      `Duplicate specs: ${[...new Set(duplicates)].join(', ') || 'none'}`
    ].join('\n'))
  }
}

function visualBlock(spec) {
  return `${markerStart}
![${escapeMarkdown(spec.alt)}](../_assets/visuals/${spec.asset})

*Visual: ${spec.caption}*
${markerEnd}`
}

function insertOrReplaceVisualBlock(markdown, block, file) {
  const blockPattern = /<!-- kb-visual:start -->[\s\S]*?<!-- kb-visual:end -->/g
  const matches = [...markdown.matchAll(blockPattern)]

  if (matches.length > 1) {
    throw new Error(`${file}: expected at most one kb-visual block, found ${matches.length}`)
  }

  if (matches.length === 1) {
    const match = matches[0]
    return `${markdown.slice(0, match.index)}${block}${markdown.slice(match.index + match[0].length)}`
  }

  const h1 = markdown.match(/^#\s+.+$/m)
  if (!h1) throw new Error(`${file}: cannot insert visual block without H1`)

  const insertAt = h1.index + h1[0].length
  return `${markdown.slice(0, insertAt).trimEnd()}\n\n${block}\n\n${markdown.slice(insertAt).trimStart()}`
}

const specs = parseReassessment()
validateManifestAgainstLiveFiles(specs)
fs.mkdirSync(visualRoot, { recursive: true })

for (const spec of specs) {
  const renderer = chooseRenderer(spec)
  const svg = renderer(spec)
  const assetPath = path.join(visualRoot, spec.asset)
  const markdownPath = path.join(repoRoot, spec.file)
  const markdown = fs.readFileSync(markdownPath, 'utf8')
  const updatedMarkdown = insertOrReplaceVisualBlock(markdown, visualBlock(spec), spec.file)

  fs.writeFileSync(assetPath, svg, 'utf8')
  fs.writeFileSync(markdownPath, updatedMarkdown, 'utf8')
}

console.log(`Wrote ${specs.length} curated knowledge-base visuals.`)
