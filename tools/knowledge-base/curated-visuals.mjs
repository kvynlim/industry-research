#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { visualKindForFile } from './visual-taxonomy.mjs'

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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="720" viewBox="0 0 1400 720" role="img" aria-labelledby="title desc" data-diagram-kind="${escapeXml(spec.diagramKind)}">
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

function nodeName(spec, index, fallback) {
  return spec.nodes[index] ?? fallback
}

function circleNode(x, y, radius, title, options = {}) {
  const fill = options.fill ?? '#eff6ff'
  const stroke = options.stroke ?? '#2563eb'
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${options.strokeWidth ?? 3}"/>
${textBlock(title, x, y + 5, {
  size: options.size ?? 14,
  weight: options.weight ?? 700,
  fill: options.textFill ?? '#172033',
  maxChars: options.maxChars ?? 14,
  maxLines: options.maxLines ?? 2
})}`
}

function squareNode(x, y, size, title, options = {}) {
  return `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="${options.rx ?? 8}" fill="${options.fill ?? '#fff7ed'}" stroke="${options.stroke ?? '#ea580c'}" stroke-width="3"/>
${textBlock(title, x, y + 5, {
  size: options.size ?? 13,
  weight: 800,
  fill: options.textFill ?? '#172033',
  maxChars: options.maxChars ?? 12,
  maxLines: 2
})}`
}

function polyline(points, color = '#2563eb', width = 3, options = {}) {
  const marker = options.arrow ? ' marker-end="url(#arrow)"' : ''
  return `<polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${marker}/>`
}

function curve(points, color = '#2563eb', width = 3, options = {}) {
  const [start, c1, c2, end] = points
  const marker = options.arrow ? ' marker-end="url(#arrow)"' : ''
  return `<path d="M${start[0]} ${start[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${marker}/>`
}

function miniMatrix(x, y, rows, cols, cell, options = {}) {
  const active = options.active ?? ((row, col) => (row === col ? 2 : (row + col) % 4 === 0 ? 1 : 0))
  return matrixGrid(x, y, rows, cols, cell, active, options)
}

function scatterPoints(points, options = {}) {
  return points.map(([x, y, r = 7, fill = options.fill ?? '#2563eb']) => (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${options.opacity ?? 0.82}"/>`
  )).join('\n')
}

function horizontalBlocks(spec, y = 300, options = {}) {
  const nodes = spec.nodes.slice(0, options.count ?? 5)
  const width = options.width ?? 190
  const gap = options.gap ?? 46
  const start = options.start ?? Math.round((1400 - nodes.length * width - (nodes.length - 1) * gap) / 2)
  return nodes.map((node, index) => {
    const x = start + index * (width + gap)
    const colors = palette(index)
    const link = index < nodes.length - 1 ? arrow(x + width + 4, y + 46, x + width + gap - 8, y + 46, '#64748b', 2.6) : ''
    return `${box(x, y, width, 92, node, { ...colors, titleChars: 18, titleSize: 15 })}\n${link}`
  }).join('\n')
}

function laneTimingLayout(spec, options = {}) {
  const labels = options.labels ?? ['sensor', 'clock', 'estimator', 'actuator']
  const x0 = 180
  const y0 = 216
  const laneGap = 82
  const pulses = labels.map((lane, index) => {
    const y = y0 + index * laneGap
    const offset = index * 24
    return `${label(lane, 112, y + 6, { anchor: 'start', maxChars: 16 })}
<line x1="${x0}" y1="${y}" x2="1220" y2="${y}" stroke="#cbd5e1" stroke-width="2"/>
${polyline([[x0 + offset, y], [x0 + 50 + offset, y], [x0 + 50 + offset, y - 26], [x0 + 130 + offset, y - 26], [x0 + 130 + offset, y], [x0 + 260 + offset, y], [x0 + 260 + offset, y - 22], [x0 + 360 + offset, y - 22], [x0 + 360 + offset, y], [x0 + 620 + offset, y], [x0 + 620 + offset, y - 28], [x0 + 740 + offset, y - 28], [x0 + 740 + offset, y]], palette(index).stroke, 3)}`
  }).join('\n')
  return `${pulses}
${arrow(282, 578, 1090, 578, '#0f172a', 4)}
${label(nodeName(spec, 0, 'time base'), 686, 626, { maxChars: 42 })}`
}

function loopControlLayout(spec, options = {}) {
  const nodes = [
    nodeName(spec, 0, 'objective'),
    nodeName(spec, 1, 'planner'),
    nodeName(spec, 2, 'model'),
    nodeName(spec, 3, 'actuator'),
    nodeName(spec, 4, 'measurement')
  ]
  return `${box(154, 278, 210, 90, nodes[0], { ...palette(0), titleChars: 18 })}
${box(430, 210, 210, 90, nodes[1], { ...palette(1), titleChars: 18 })}
${box(760, 210, 210, 90, nodes[2], { ...palette(2), titleChars: 18 })}
${box(1036, 278, 210, 90, nodes[3], { ...palette(3), titleChars: 18 })}
${box(595, 460, 210, 90, nodes[4], { ...palette(4), titleChars: 18 })}
${arrow(366, 323, 426, 266, '#2563eb', 3)}
${arrow(642, 255, 756, 255, '#2563eb', 3)}
${arrow(972, 266, 1032, 323, '#2563eb', 3)}
${curve([[1138, 374], [1072, 560], [846, 614], [704, 552]], '#64748b', 3, { arrow: true })}
${curve([[596, 506], [360, 590], [170, 516], [244, 372]], '#64748b', 3, { arrow: true })}
${curve([[746, 462], [878, 378], [922, 330], [924, 302]], '#16a34a', 2.6, { arrow: true })}
${label(options.label ?? 'closed feedback loop keeps plans tied to measured state', 700, 618, { maxChars: 64 })}`
}

function factorGraphLayout(spec, options = {}) {
  const variables = [
    [270, 254, nodeName(spec, 0, 'pose')],
    [520, 390, nodeName(spec, 1, 'landmark')],
    [780, 254, nodeName(spec, 2, 'bias')],
    [1034, 390, nodeName(spec, 3, 'track')]
  ]
  const factors = [
    [400, 318, nodeName(spec, 4, 'residual')],
    [650, 318, options.middle ?? 'factor'],
    [910, 318, nodeName(spec, 5, 'prior')]
  ]
  const edges = `${arrow(315, 270, 366, 306, '#64748b', 2.2)}
${arrow(438, 334, 486, 376, '#64748b', 2.2)}
${arrow(565, 374, 616, 334, '#64748b', 2.2)}
${arrow(688, 306, 738, 270, '#64748b', 2.2)}
${arrow(826, 270, 876, 306, '#64748b', 2.2)}
${arrow(948, 334, 1000, 376, '#64748b', 2.2)}`
  return `${edges}
${variables.map(([x, y, text], index) => circleNode(x, y, 58, text, { ...palette(index), maxChars: 14 })).join('\n')}
${factors.map(([x, y, text], index) => squareNode(x, y, 74, text, { ...palette(index + 2), maxChars: 12 })).join('\n')}
${label(options.label ?? 'variable nodes and factor residuals expose inference structure', 700, 566, { maxChars: 66 })}`
}

function comparisonColumnsLayout(spec, options = {}) {
  const headings = options.headings ?? ['baseline', 'candidate', 'selected']
  return headings.map((heading, index) => {
    const x = 120 + index * 420
    const colors = palette(index)
    return `<rect x="${x}" y="196" width="320" height="330" rx="16" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="3"/>
${label(heading, x + 160, 236, { fill: colors.stroke, maxChars: 20 })}
${box(x + 54, 272, 212, 72, nodeName(spec, index, heading), { ...colors, titleChars: 18, titleSize: 15 })}
${miniMatrix(x + 90, 372, 4, 5, 32, { strong: colors.stroke, mid: '#dbeafe', active: (row, col) => (row === index || col === row ? 2 : (row + col + index) % 4 === 0 ? 1 : 0) })}
${polyline([[x + 68, 488], [x + 150, 438], [x + 254, 476]], colors.stroke, 4)}`
  }).join('\n')
}

function attentionLayout(spec, options = {}) {
  const tokenLabels = spec.nodes.slice(0, 5)
  const tokens = tokenLabels.map((node, index) => box(116 + index * 136, 216, 116, 58, node, { ...palette(index), titleChars: 12, titleSize: 13 })).join('\n')
  const heat = miniMatrix(278, 338, 6, 6, 42, {
    strong: '#7c3aed',
    mid: '#ddd6fe',
    active: (row, col) => (row === col || row + col === 5 ? 2 : (row * 2 + col) % 4 === 0 ? 1 : 0)
  })
  const heads = [0, 1, 2].map((index) => {
    const y = 254 + index * 94
    return `${label(`head ${index + 1}`, 1040, y + 8, { anchor: 'start', maxChars: 12 })}
${curve([[842, 368 + index * 16], [918, y - 70], [1020, y - 40], [1164, y]], palette(index + 3).stroke, 3, { arrow: true })}`
  }).join('\n')
  return `${tokens}
<rect x="260" y="320" width="280" height="280" rx="14" fill="url(#grid)" stroke="#4c1d95" stroke-width="3"/>
${heat}
${heads}
${circleNode(1190, 254, 46, nodeName(spec, 0, 'query'), { ...palette(3), maxChars: 12 })}
${circleNode(1190, 348, 46, nodeName(spec, 1, 'key'), { ...palette(4), maxChars: 12 })}
${circleNode(1190, 442, 46, nodeName(spec, 2, 'value'), { ...palette(5), maxChars: 12 })}
${label(options.label ?? 'tokens route context through patterned attention weights', 790, 626, { maxChars: 58 })}`
}

function radarLayout(spec, options = {}) {
  const waveform = polyline([[116, 376], [170, 320], [224, 376], [278, 432], [332, 376], [386, 320], [440, 376]], '#0891b2', 4)
  const spectrum = [0, 1, 2, 3, 4, 5, 6].map((index) => {
    const h = [60, 118, 84, 178, 94, 132, 70][index]
    return `<rect x="${568 + index * 46}" y="${500 - h}" width="26" height="${h}" rx="5" fill="${index === 3 ? '#e11d48' : '#38bdf8'}"/>`
  }).join('\n')
  const doppler = miniMatrix(902, 264, 7, 7, 38, {
    strong: '#e11d48',
    mid: '#bae6fd',
    active: (row, col) => (row === 4 && col === 3 ? 2 : Math.abs(row - col) <= 1 ? 1 : (row + col) % 6 === 0 ? 1 : 0)
  })
  return `<rect x="96" y="260" width="380" height="230" rx="14" fill="#ecfeff" stroke="#0891b2" stroke-width="3"/>
${waveform}
${label(nodeName(spec, 0, 'chirp waveform'), 286, 536, { maxChars: 30 })}
<rect x="530" y="260" width="300" height="230" rx="14" fill="#f8fafc" stroke="#475569" stroke-width="3"/>
${spectrum}
${label(options.spectrum ?? 'FFT peaks', 680, 536, { maxChars: 28 })}
<rect x="884" y="246" width="310" height="310" rx="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
${doppler}
${label(nodeName(spec, 1, 'range doppler map'), 1040, 606, { maxChars: 32 })}
${arrow(478, 376, 526, 376, '#64748b', 3)}
${arrow(832, 376, 880, 376, '#64748b', 3)}`
}

function roadGeometryLayout(spec, options = {}) {
  const laneColor = options.laneColor ?? '#16a34a'
  return `<path d="M190 590 C310 450 382 318 468 170" fill="none" stroke="#cbd5e1" stroke-width="96" stroke-linecap="round"/>
<path d="M378 604 C504 448 594 318 736 176" fill="none" stroke="#dbeafe" stroke-width="96" stroke-linecap="round"/>
<path d="M190 590 C310 450 382 318 468 170" fill="none" stroke="${laneColor}" stroke-width="5" stroke-dasharray="22 18"/>
<path d="M378 604 C504 448 594 318 736 176" fill="none" stroke="${laneColor}" stroke-width="5" stroke-dasharray="22 18"/>
<rect x="356" y="470" width="150" height="74" rx="14" fill="#1e293b"/>
<circle cx="392" cy="550" r="18" fill="#0f172a"/>
<circle cx="470" cy="550" r="18" fill="#0f172a"/>
${curve([[506, 496], [680, 358], [804, 304], [990, 266]], '#2563eb', 4, { arrow: true })}
${circleNode(1044, 258, 54, nodeName(spec, 0, 'target'), { ...palette(2), maxChars: 13 })}
${box(940, 438, 248, 86, nodeName(spec, 1, 'corridor'), { ...palette(1), titleChars: 22 })}
${label(options.label ?? 'road-aligned geometry keeps trajectories inside reachable space', 700, 632, { maxChars: 66 })}`
}

function probabilityLayout(spec, options = {}) {
  const bars = [60, 96, 152, 220, 170, 110, 68].map((height, index) => (
    `<rect x="${186 + index * 58}" y="${502 - height}" width="38" height="${height}" rx="8" fill="${index >= 3 ? '#bfdbfe' : '#e2e8f0'}"/>`
  )).join('\n')
  return `<line x1="140" y1="506" x2="604" y2="506" stroke="#0f172a" stroke-width="3"/>
${bars}
<line x1="392" y1="222" x2="392" y2="512" stroke="#e11d48" stroke-width="4" stroke-dasharray="12 10"/>
${label(options.threshold ?? 'decision threshold', 392, 194, { fill: '#e11d48', maxChars: 24 })}
${curve([[730, 470], [790, 260], [916, 242], [976, 470]], '#16a34a', 4)}
${curve([[850, 470], [910, 304], [1038, 292], [1108, 470]], '#2563eb', 4)}
${circleNode(864, 330, 50, nodeName(spec, 0, 'accept'), { ...palette(1), maxChars: 13 })}
${circleNode(1050, 366, 50, nodeName(spec, 1, 'reject'), { ...palette(0), maxChars: 13 })}
${label(options.label ?? 'probability mass, gates, and thresholds define operating points', 760, 606, { maxChars: 66 })}`
}

function landscapeLayout(spec, options = {}) {
  const contours = [0, 1, 2, 3].map((index) => (
    `<ellipse cx="${420 + index * 24}" cy="${370 + index * 10}" rx="${230 - index * 38}" ry="${128 - index * 20}" fill="none" stroke="${palette(index).stroke}" stroke-width="3" opacity="0.78"/>`
  )).join('\n')
  return `<rect x="120" y="202" width="560" height="360" rx="16" fill="url(#grid)" stroke="#94a3b8" stroke-width="2"/>
${contours}
${polyline([[224, 488], [302, 438], [366, 414], [428, 378], [506, 350]], '#e11d48', 5, { arrow: true })}
${circleNode(506, 350, 34, nodeName(spec, 0, 'opt'), { ...palette(5), maxChars: 9 })}
${box(780, 224, 230, 84, nodeName(spec, 1, 'loss'), { ...palette(2), titleChars: 20 })}
${box(940, 386, 230, 84, nodeName(spec, 2, 'gradient'), { ...palette(3), titleChars: 20 })}
${arrow(1010, 310, 1010, 382, '#64748b', 3)}
${label(options.label ?? 'objective geometry shows descent, curvature, and basins', 790, 604, { maxChars: 58 })}`
}

function architectureStackLayout(spec, options = {}) {
  return [0, 1, 2, 3, 4].map((index) => {
    const y = 188 + index * 78
    const width = 760 - index * 58
    const x = 320 + index * 29
    const colors = palette(index)
    return `${box(x, y, width, 58, nodeName(spec, index, options.layers?.[index] ?? `layer ${index + 1}`), { ...colors, titleChars: 42, titleSize: 14 })}
${index < 4 ? arrow(700, y + 60, 700, y + 74, '#64748b', 2.4) : ''}`
  }).join('\n')
}

function learningTokensLayout(spec, options = {}) {
  const grid = miniMatrix(174, 246, 5, 8, 44, {
    strong: '#2563eb',
    mid: '#bfdbfe',
    active: (row, col) => (row === 2 || col === 3 ? 2 : (row + col) % 3 === 0 ? 1 : 0)
  })
  return `<rect x="152" y="224" width="384" height="250" rx="16" fill="#f8fafc" stroke="#2563eb" stroke-width="3"/>
${grid}
${arrow(550, 350, 704, 350, '#64748b', 3)}
${box(720, 266, 210, 82, nodeName(spec, 0, 'encoder'), { ...palette(3), titleChars: 18 })}
${box(720, 420, 210, 82, nodeName(spec, 1, 'decoder'), { ...palette(4), titleChars: 18 })}
${arrow(824, 352, 824, 416, '#64748b', 3)}
${curve([[932, 307], [1050, 230], [1150, 272], [1178, 362]], '#16a34a', 3, { arrow: true })}
${box(1054, 382, 210, 82, nodeName(spec, 2, options.output ?? 'prediction'), { ...palette(1), titleChars: 18 })}
${label(options.label ?? 'token grids pass through learned bottlenecks and predictions', 700, 604, { maxChars: 64 })}`
}

function systemMapLayout(spec, options = {}) {
  const core = circleNode(700, 354, 70, nodeName(spec, 0, 'system'), { fill: '#eef2ff', stroke: '#4f46e5', maxChars: 15 })
  const positions = [[250, 228], [470, 520], [930, 520], [1150, 228], [700, 198]]
  const satellites = positions.map(([x, y], index) => {
    const colors = palette(index)
    return `${arrow(700, 354, x, y, '#64748b', 2.4)}
${box(x - 104, y - 38, 208, 76, nodeName(spec, index + 1, options.nodes?.[index] ?? `module ${index + 1}`), { ...colors, titleChars: 18, titleSize: 15 })}`
  }).join('\n')
  return `${core}
${satellites}
${label(options.label ?? 'system map separates responsibilities while showing interfaces', 700, 622, { maxChars: 62 })}`
}

function renderArchitectureComparison(spec) {
  return frame(spec, `
<!-- layout:architecture-comparison -->
${comparisonColumnsLayout(spec, { headings: ['sequence model', 'state space', 'attention'] })}
`)
}

function renderAttentionMatrix(spec) {
  return frame(spec, `
<!-- layout:attention-matrix -->
${attentionLayout(spec)}
`)
}

function renderBeamNoiseModel(spec) {
  return frame(spec, `
<!-- layout:beam-noise-model -->
<polygon points="194,474 1040,220 1040,538" fill="#ecfeff" stroke="#0891b2" stroke-width="3" opacity="0.72"/>
${polyline([[194, 474], [520, 410], [780, 328], [1040, 220]], '#0891b2', 3)}
${polyline([[194, 474], [530, 484], [780, 502], [1040, 538]], '#0891b2', 3)}
${scatterPoints([[744, 344, 8, '#e11d48'], [842, 404, 6, '#e11d48'], [920, 502, 7, '#e11d48'], [660, 474, 5, '#475569'], [1006, 356, 5, '#475569']])}
${box(120, 430, 148, 88, nodeName(spec, 0, 'sensor'), { ...palette(3), titleChars: 14 })}
${box(940, 584, 220, 58, nodeName(spec, 1, 'noise returns'), { ...palette(5), titleChars: 20, titleSize: 14 })}
`)
}

function renderBeliefUpdateLoop(spec) {
  return frame(spec, `
<!-- layout:belief-update-loop -->
${loopControlLayout(spec, { label: 'belief updates cycle prediction, evidence, and policy choice' })}
`)
}

function renderBenchmarkSplitFirewall(spec) {
  return frame(spec, `
<!-- layout:benchmark-split-firewall -->
${box(130, 258, 230, 90, nodeName(spec, 0, 'train split'), { ...palette(0), titleChars: 20 })}
${box(130, 426, 230, 90, nodeName(spec, 1, 'validation'), { ...palette(1), titleChars: 20 })}
<rect x="534" y="196" width="64" height="380" rx="16" fill="#fee2e2" stroke="#e11d48" stroke-width="4"/>
${label('firewall', 566, 392, { fill: '#991b1b', maxChars: 10 })}
${box(750, 258, 230, 90, nodeName(spec, 2, 'test set'), { ...palette(2), titleChars: 20 })}
${box(1010, 426, 230, 90, nodeName(spec, 3, 'report'), { ...palette(3), titleChars: 20 })}
${arrow(362, 303, 530, 303, '#64748b', 3)}
${arrow(598, 303, 746, 303, '#64748b', 3)}
${arrow(982, 303, 1074, 422, '#64748b', 3)}
${curve([[244, 426], [388, 552], [820, 606], [1080, 518]], '#16a34a', 3, { arrow: true })}
`)
}

function renderClosedLoopControl(spec) {
  return frame(spec, `
<!-- layout:closed-loop-control -->
${loopControlLayout(spec)}
`)
}

function renderComputationalGraph(spec) {
  return frame(spec, `
<!-- layout:computational-graph -->
${circleNode(240, 286, 54, nodeName(spec, 0, 'input'), { ...palette(0) })}
${squareNode(456, 246, 76, nodeName(spec, 1, 'op'), { ...palette(2) })}
${squareNode(456, 408, 76, nodeName(spec, 2, 'op'), { ...palette(3) })}
${circleNode(700, 346, 58, nodeName(spec, 3, 'loss'), { ...palette(4) })}
${circleNode(990, 346, 58, nodeName(spec, 4, 'grad'), { ...palette(5) })}
${arrow(296, 286, 416, 254, '#2563eb', 3)}
${arrow(296, 286, 416, 408, '#2563eb', 3)}
${arrow(496, 260, 652, 328, '#2563eb', 3)}
${arrow(496, 408, 652, 362, '#2563eb', 3)}
${arrow(760, 346, 930, 346, '#e11d48', 3)}
${curve([[930, 390], [760, 562], [470, 560], [456, 448]], '#e11d48', 3, { arrow: true })}
`)
}

function renderDecisionBoundary(spec) {
  return frame(spec, `
<!-- layout:decision-boundary -->
<rect x="150" y="196" width="620" height="390" rx="16" fill="url(#grid)" stroke="#94a3b8" stroke-width="2"/>
<path d="M208 520 C332 380 420 422 512 304 C590 206 682 240 734 204" fill="none" stroke="#e11d48" stroke-width="5"/>
${scatterPoints([[250, 468, 9, '#2563eb'], [326, 410, 9, '#2563eb'], [512, 466, 9, '#2563eb'], [616, 380, 9, '#2563eb'], [322, 262, 9, '#16a34a'], [440, 310, 9, '#16a34a'], [620, 248, 9, '#16a34a'], [690, 300, 9, '#16a34a']])}
${box(884, 250, 260, 82, nodeName(spec, 0, 'features'), { ...palette(0), titleChars: 22 })}
${box(996, 414, 260, 82, nodeName(spec, 1, 'classifier'), { ...palette(5), titleChars: 22 })}
${arrow(770, 390, 880, 292, '#64748b', 3)}
${arrow(1010, 336, 1064, 410, '#64748b', 3)}
`)
}

function renderDensityMixture(spec) {
  return frame(spec, `
<!-- layout:density-mixture -->
${probabilityLayout(spec, { threshold: 'mixture weights', label: 'multiple density modes preserve competing hypotheses' })}
`)
}

function renderDynamicsModelLadder(spec) {
  return frame(spec, `
<!-- layout:dynamics-model-ladder -->
${architectureStackLayout(spec, { layers: ['kinematics', 'tire forces', 'actuation', 'constraints', 'controller'] })}
`)
}

function renderEmbeddingSpace(spec) {
  return frame(spec, `
<!-- layout:embedding-space -->
<rect x="158" y="198" width="700" height="390" rx="16" fill="url(#grid)" stroke="#94a3b8" stroke-width="2"/>
${scatterPoints([[270, 430, 9, '#2563eb'], [320, 390, 8, '#2563eb'], [362, 454, 8, '#2563eb'], [618, 288, 9, '#16a34a'], [676, 330, 8, '#16a34a'], [710, 260, 8, '#16a34a'], [504, 470, 8, '#e11d48'], [560, 512, 9, '#e11d48']])}
<ellipse cx="320" cy="422" rx="114" ry="82" fill="none" stroke="#2563eb" stroke-width="3"/>
<ellipse cx="666" cy="294" rx="118" ry="86" fill="none" stroke="#16a34a" stroke-width="3"/>
${arrow(872, 390, 1010, 390, '#64748b', 3)}
${box(1018, 344, 220, 92, nodeName(spec, 0, 'contrast'), { ...palette(2), titleChars: 20 })}
`)
}

function renderErrorBudget(spec) {
  return frame(spec, `
<!-- layout:error-budget -->
${horizontalBlocks(spec, 232, { count: 4, width: 210 })}
${[0, 1, 2, 3].map((index) => `<rect x="${214 + index * 258}" y="${446 - [78, 126, 170, 104][index]}" width="118" height="${[78, 126, 170, 104][index]}" rx="8" fill="${palette(index).stroke}" opacity="0.78"/>`).join('\n')}
<line x1="166" y1="446" x2="1120" y2="446" stroke="#0f172a" stroke-width="3"/>
${label('budget accumulation', 642, 548, { maxChars: 28 })}
`)
}

function renderEvaluationFirewall(spec) {
  return frame(spec, `
<!-- layout:evaluation-firewall -->
${box(148, 238, 236, 90, nodeName(spec, 0, 'training'), { ...palette(0), titleChars: 22 })}
${box(148, 430, 236, 90, nodeName(spec, 1, 'calibration'), { ...palette(1), titleChars: 22 })}
<rect x="568" y="196" width="70" height="380" rx="18" fill="#fee2e2" stroke="#e11d48" stroke-width="4"/>
${label('no leakage', 604, 392, { fill: '#991b1b', maxChars: 12 })}
${box(792, 250, 236, 90, nodeName(spec, 2, 'holdout'), { ...palette(2), titleChars: 22 })}
${box(1010, 440, 236, 90, nodeName(spec, 3, 'metric'), { ...palette(3), titleChars: 22 })}
${arrow(386, 283, 564, 283, '#64748b', 3)}
${arrow(640, 283, 788, 294, '#64748b', 3)}
${curve([[910, 342], [930, 420], [980, 456], [1008, 470]], '#2563eb', 3, { arrow: true })}
`)
}

function renderFactorGraph(spec) {
  return frame(spec, `
<!-- layout:factor-graph -->
${factorGraphLayout(spec)}
`)
}

function renderFilterUpdateLoop(spec) {
  return frame(spec, `
<!-- layout:filter-update-loop -->
${loopControlLayout(spec, { label: 'prediction and correction close the filtering loop' })}
`)
}

function renderGenerativeTrajectory(spec) {
  return frame(spec, `
<!-- layout:generative-trajectory -->
${laneTimingLayout(spec, { labels: ['noise', 'denoise', 'sample', 'trajectory'] })}
${curve([[226, 242], [464, 162], [790, 166], [1074, 240]], '#7c3aed', 3, { arrow: true })}
`)
}

function renderGeodesyChain(spec) {
  return frame(spec, `
<!-- layout:geodesy-chain -->
${horizontalBlocks(spec, 318, { count: 5, width: 180, gap: 42 })}
<path d="M206 532 C420 440 620 590 828 500 C980 434 1078 482 1186 390" fill="none" stroke="#16a34a" stroke-width="5" stroke-dasharray="18 14"/>
${label('earth frame to local map chain', 700, 604, { maxChars: 36 })}
`)
}

function renderInformationMap(spec) {
  return frame(spec, `
<!-- layout:information-map -->
${systemMapLayout(spec, { label: 'information flow connects evidence, uncertainty, and decisions' })}
`)
}

function renderLatentArchitecture(spec) {
  return frame(spec, `
<!-- layout:latent-architecture -->
${box(148, 320, 220, 92, nodeName(spec, 0, 'input'), { ...palette(0), titleChars: 18 })}
${box(470, 246, 220, 92, nodeName(spec, 1, 'encoder'), { ...palette(3), titleChars: 18 })}
${circleNode(700, 436, 54, nodeName(spec, 2, 'latent'), { ...palette(4), maxChars: 12 })}
${box(830, 246, 220, 92, nodeName(spec, 3, 'decoder'), { ...palette(2), titleChars: 18 })}
${box(1110, 320, 180, 92, nodeName(spec, 4, 'output'), { ...palette(1), titleChars: 16 })}
${arrow(370, 366, 466, 294, '#64748b', 3)}
${arrow(584, 340, 672, 400, '#64748b', 3)}
${arrow(730, 400, 840, 340, '#64748b', 3)}
${arrow(1052, 294, 1106, 354, '#64748b', 3)}
`)
}

function renderLearningRoadmap(spec) {
  return frame(spec, `
<!-- layout:learning-roadmap -->
${learningTokensLayout(spec, { output: 'roadmap', label: 'learning topics progress from data to objectives and evaluation' })}
`)
}

function renderManifoldLinearization(spec) {
  return frame(spec, `
<!-- layout:manifold-linearization -->
<path d="M172 472 C350 304 600 248 804 330 C924 378 1040 492 1210 420" fill="none" stroke="#bfdbfe" stroke-width="64" stroke-linecap="round"/>
<path d="M172 472 C350 304 600 248 804 330 C924 378 1040 492 1210 420" fill="none" stroke="#2563eb" stroke-width="5"/>
${arrow(636, 320, 806, 246, '#e11d48', 4)}
${arrow(636, 320, 712, 484, '#16a34a', 4)}
${circleNode(636, 320, 44, nodeName(spec, 0, 'state'), { ...palette(4), maxChars: 10 })}
${box(900, 202, 260, 84, nodeName(spec, 1, 'tangent update'), { ...palette(2), titleChars: 22 })}
`)
}

function renderMapAndPlanningStack(spec) {
  return frame(spec, `
<!-- layout:map-and-planning-stack -->
${architectureStackLayout(spec, { layers: ['map layer', 'route layer', 'behavior layer', 'trajectory layer', 'control layer'] })}
`)
}

function renderMatrixStructure(spec) {
  if (spec.file.endsWith('sparse-estimation-backend-crosswalk.md')) {
    return renderSparseEstimationBackendCrosswalk(spec)
  }

  return frame(spec, `
<!-- layout:matrix-structure -->
<rect x="222" y="196" width="378" height="378" rx="16" fill="url(#grid)" stroke="#0f172a" stroke-width="3"/>
${miniMatrix(246, 220, 8, 8, 42, { active: (row, col) => (row === col ? 2 : Math.abs(row - col) <= 1 || (row < 3 && col > 5) ? 1 : 0) })}
${box(766, 236, 250, 82, nodeName(spec, 0, 'ordering'), { ...palette(3), titleChars: 22 })}
${box(886, 416, 250, 82, nodeName(spec, 1, 'fill in'), { ...palette(2), titleChars: 22 })}
${arrow(602, 344, 762, 278, '#64748b', 3)}
${arrow(602, 410, 882, 458, '#64748b', 3)}
`)
}

function renderNonlinearSolverDiagnosticsCrosswalk(spec) {
  const stages = [
    ['measurement /\nobjective', 92, 'wrong target'],
    ['residual', 260, 'wrong sign'],
    ['scale /\nwhitening', 428, 'bad units'],
    ['Jacobian /\nlinearization', 596, 'bad derivative'],
    ['damping /\nstep acceptance /\nlocal model', 764, 'bad trial'],
    ['rank /\nconditioning /\nbackend', 932, 'singular mode'],
    ['covariance /\nartifact diagnostics', 1100, 'bad evidence']
  ]

  const pipeline = stages.map(([title, x, failure], index) => {
    const colors = palette(index)
    const next = index < stages.length - 1 ? arrow(x + 142, 278, x + 166, 278, '#64748b', 2.5) : ''
    return `${box(x, 226, 142, 104, title, { ...colors, titleChars: 15, titleLines: 3, titleSize: 14 })}
${label(failure, x + 71, 358, { fill: colors.stroke, maxChars: 18 })}
${next}`
  }).join('\n')

  return frame(spec, `
<!-- layout:solver-loop -->
${pipeline}
<rect x="112" y="414" width="1160" height="118" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
${textBlock('Symptom-first routing', 160, 452, { anchor: 'start', size: 18, weight: 800, maxChars: 26 })}
${label('low cost but bad output', 274, 494, { maxChars: 26 })}
${arrow(384, 486, 492, 486, '#e11d48', 3)}
${label('rejected steps', 594, 494, { maxChars: 22 })}
${arrow(694, 486, 802, 486, '#ea580c', 3)}
${label('factor failure / PCG stagnation', 940, 494, { maxChars: 30 })}
${arrow(1088, 486, 1192, 486, '#2563eb', 3)}
${label('inspect concrete artifact', 1138, 574, { maxChars: 30 })}
${pathArrow('M1194 502 C1178 546 1152 560 1138 564', '#2563eb', 3)}
${label('residual histograms, finite differences, gain ratio, spectra, fill, covariance', 700, 620, { maxChars: 82 })}
`)
}

function renderObjectiveResidualAudit(spec) {
  const stages = [
    ['measurement\nmodel', 112, 248],
    ['raw\nresidual', 310, 248],
    ['covariance /\nwhitening', 508, 248],
    ['robust\nweight', 706, 248],
    ['Jacobian\ncheck', 904, 248],
    ['residual\ndiagnostics', 1102, 248]
  ]

  const flow = stages.map(([title, x, y], index) => {
    const colors = palette(index)
    const next = index < stages.length - 1 ? arrow(x + 144, y + 48, x + 190, y + 48, '#64748b', 2.5) : ''
    return `${box(x, y, 144, 96, title, { ...colors, titleChars: 16, titleLines: 2, titleSize: 15 })}
${next}`
  }).join('\n')

  return frame(spec, `
<!-- layout:objective-landscape -->
${flow}
<rect x="150" y="432" width="300" height="130" rx="14" fill="#f0fdf4" stroke="#16a34a" stroke-width="3"/>
${textBlock('synthetic zero residual', 300, 468, { size: 16, maxChars: 24 })}
${polyline([[206, 514], [258, 514], [286, 490], [332, 538], [392, 486]], '#16a34a', 4)}
<rect x="550" y="432" width="300" height="130" rx="14" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
${textBlock('whitened histogram', 700, 468, { size: 16, maxChars: 24 })}
<rect x="610" y="526" width="28" height="22" rx="4" fill="#bfdbfe"/>
<rect x="650" y="494" width="28" height="54" rx="4" fill="#60a5fa"/>
<rect x="690" y="476" width="28" height="72" rx="4" fill="#2563eb"/>
<rect x="730" y="498" width="28" height="50" rx="4" fill="#60a5fa"/>
<rect x="770" y="528" width="28" height="20" rx="4" fill="#bfdbfe"/>
<rect x="950" y="432" width="300" height="130" rx="14" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
${textBlock('per-family cost share', 1100, 468, { size: 16, maxChars: 24 })}
<circle cx="1026" cy="522" r="34" fill="#fed7aa"/>
<path d="M1026 522 L1026 488 A34 34 0 0 1 1056 538 Z" fill="#ea580c"/>
<circle cx="1120" cy="522" r="34" fill="#dbeafe"/>
<path d="M1120 522 L1120 488 A34 34 0 1 1 1096 546 Z" fill="#2563eb"/>
${label('audit artifacts prove scale, signs, outliers, and derivatives before solver tuning', 700, 624, { maxChars: 82 })}
`)
}

function renderSolverSelectionConvergence(spec) {
  return frame(spec, `
<!-- layout:optimization-step-geometry -->
<rect x="108" y="202" width="342" height="340" rx="16" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
${textBlock('Solver choice', 138, 238, { anchor: 'start', size: 18, weight: 800, maxChars: 22 })}
${box(148, 268, 112, 68, 'GN', { ...palette(0), titleChars: 8, titleSize: 18 })}
${box(292, 268, 112, 68, 'LM /\ndogleg', { ...palette(1), titleChars: 10, titleLines: 2, titleSize: 15 })}
${box(148, 368, 112, 68, 'backend\nchoice', { ...palette(2), titleChars: 12, titleLines: 2, titleSize: 15 })}
${box(292, 368, 112, 68, 'QR/SVD /\nSchur/PCG', { ...palette(3), titleChars: 12, titleLines: 2, titleSize: 14 })}
<rect x="528" y="202" width="344" height="340" rx="16" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
${textBlock('Trial-state lifecycle', 558, 238, { anchor: 'start', size: 18, weight: 800, maxChars: 28 })}
${box(578, 276, 104, 64, 'committed\nstate', { ...palette(0), titleChars: 13, titleLines: 2, titleSize: 14 })}
${arrow(686, 308, 728, 308, '#64748b', 3)}
${box(734, 276, 104, 64, 'trial\nstate', { ...palette(4), titleChars: 10, titleLines: 2, titleSize: 14 })}
${pathArrow('M786 344 C808 380 810 414 786 450', '#16a34a', 3)}
${textBlock('accept', 826, 402, { size: 13, weight: 800, fill: '#16a34a', maxChars: 10 })}
${pathArrow('M734 450 C672 424 646 376 650 344', '#e11d48', 3)}
${textBlock('reject: state unchanged', 572, 430, { anchor: 'start', size: 13, weight: 800, fill: '#e11d48', maxChars: 24 })}
${box(610, 474, 198, 52, 'actual vs predicted reduction', { ...palette(5), titleChars: 28, titleSize: 13 })}
<rect x="948" y="202" width="342" height="340" rx="16" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
${textBlock('Symptom routing', 978, 238, { anchor: 'start', size: 18, weight: 800, maxChars: 24 })}
${label('trust-region ratio', 1118, 292, { maxChars: 22 })}
${polyline([[998, 314], [1058, 292], [1118, 320], [1178, 272], [1240, 300]], '#2563eb', 4)}
${label('line-search step length', 1118, 376, { maxChars: 26 })}
<line x1="998" y1="398" x2="1240" y2="398" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round"/>
<circle cx="1068" cy="398" r="13" fill="#ea580c"/>
<circle cx="1198" cy="398" r="13" fill="#16a34a"/>
${label('convergence / false convergence telemetry', 1118, 478, { maxChars: 38 })}
${label('cost, gradient, step norm, damping, accepted/rejected counts', 700, 620, { maxChars: 76 })}
`)
}

function renderSparseEstimationBackendCrosswalk(spec) {
  return frame(spec, `
<!-- layout:matrix-structure -->
<rect x="100" y="202" width="214" height="214" rx="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
${miniMatrix(126, 228, 6, 6, 28, { strong: '#2563eb', mid: '#bfdbfe', active: (row, col) => (row === col || Math.abs(row - col) === 1 || (row < 2 && col > 3) ? 2 : (row + col) % 5 === 0 ? 1 : 0) })}
${label('Jacobian sparsity', 206, 454, { maxChars: 24 })}
${arrow(318, 304, 392, 304, '#64748b', 3)}
<rect x="404" y="202" width="214" height="214" rx="14" fill="#f8fafc" stroke="#7c3aed" stroke-width="3"/>
${miniMatrix(430, 228, 6, 6, 28, { strong: '#7c3aed', mid: '#ddd6fe', active: (row, col) => (col <= row || row === 0 || col === 5 ? 2 : (row + col) % 4 === 0 ? 1 : 0) })}
${label('ordering / fill-in', 510, 454, { maxChars: 24 })}
${arrow(622, 304, 696, 304, '#64748b', 3)}
<rect x="708" y="202" width="260" height="214" rx="14" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
${textBlock('factorization choice', 838, 236, { size: 16, weight: 800, maxChars: 24 })}
${label('Cholesky / LDLT', 838, 286, { maxChars: 24 })}
${label('QR / SVD', 838, 340, { maxChars: 18 })}
${label('rank robustness vs speed', 838, 392, { maxChars: 28 })}
${arrow(972, 304, 1046, 304, '#64748b', 3)}
<rect x="1058" y="202" width="240" height="214" rx="14" fill="#ecfeff" stroke="#0891b2" stroke-width="3"/>
${textBlock('Schur solve', 1110, 242, { anchor: 'start', size: 16, weight: 800, maxChars: 18 })}
${textBlock('vs', 1168, 306, { size: 18, weight: 900, fill: '#0891b2', maxChars: 4 })}
${textBlock('marginalization prior', 1110, 372, { anchor: 'start', size: 16, weight: 800, maxChars: 24 })}
${pathArrow('M206 466 C248 552 444 570 572 520', '#2563eb', 3)}
${box(572, 494, 218, 72, 'square-root information /\ncovariance recovery', { ...palette(0), titleChars: 28, titleLines: 2, titleSize: 14 })}
${pathArrow('M838 418 C866 538 976 584 1088 532', '#16a34a', 3)}
${box(1010, 494, 236, 72, 'PCG /\npreconditioner /\nstagnation', { ...palette(1), titleChars: 18, titleLines: 3, titleSize: 14 })}
${label('backend diagnostics connect structure, rank, memory, covariance, and iterative residuals', 700, 626, { maxChars: 84 })}
`)
}

function renderMeasurementChain(spec) {
  return frame(spec, `
<!-- layout:measurement-chain -->
${horizontalBlocks(spec, 300, { count: 5, width: 186, gap: 46 })}
${polyline([[166, 516], [332, 470], [502, 516], [678, 470], [856, 516], [1030, 470], [1196, 516]], '#0891b2', 4)}
`)
}

function renderNumericalFactorization(spec) {
  return frame(spec, `
<!-- layout:numerical-factorization -->
<rect x="160" y="250" width="210" height="210" rx="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
${miniMatrix(184, 274, 5, 5, 36, { active: (row, col) => (row >= col ? 2 : 0) })}
${arrow(386, 356, 512, 356, '#64748b', 3)}
<rect x="532" y="250" width="210" height="210" rx="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
${miniMatrix(556, 274, 5, 5, 36, { strong: '#16a34a', active: (row, col) => (row === col ? 2 : row > col ? 1 : 0) })}
${arrow(758, 356, 884, 356, '#64748b', 3)}
<rect x="904" y="250" width="210" height="210" rx="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
${miniMatrix(928, 274, 5, 5, 36, { strong: '#ea580c', active: (row, col) => (row <= col ? 2 : 0) })}
${label(nodeName(spec, 0, 'factorization path'), 642, 552, { maxChars: 34 })}
`)
}

function axisBox(x, y, width, height, title, subtitle = '') {
  const subtitleMarkup = subtitle
    ? `<text x="${x + 18}" y="${y + height - 18}" font-size="12" font-weight="600" fill="#64748b">${escapeXml(subtitle)}</text>`
    : ''

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
<line x1="${x + 36}" y1="${y + height - 42}" x2="${x + width - 22}" y2="${y + height - 42}" stroke="#64748b" stroke-width="2"/>
<line x1="${x + 36}" y1="${y + height - 42}" x2="${x + 36}" y2="${y + 28}" stroke="#64748b" stroke-width="2"/>
<text x="${x + 18}" y="${y + 26}" font-size="15" font-weight="800" fill="#0f172a">${escapeXml(title)}</text>
${subtitleMarkup}`
}

function renderRobustLossComparison(spec) {
  const legend = [
    ['Squared', '#0f172a'],
    ['Huber', '#2563eb'],
    ['Cauchy', '#16a34a'],
    ['Tukey', '#ea580c'],
    ['Geman-McClure', '#7c3aed']
  ].map(([name, color], index) => {
    const x = 116 + index * 228
    return `<line x1="${x}" y1="176" x2="${x + 42}" y2="176" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
<text x="${x + 52}" y="181" font-size="14" font-weight="800" fill="#172033">${escapeXml(name)}</text>`
  }).join('\n')

  return frame(spec, `
<!-- layout:objective-landscape -->
<!-- variant:robust-loss-comparison -->
<text x="80" y="180" font-size="14" font-weight="700" fill="#475569">Scalar view: rho_r(r), psi(r), w(r)=psi(r)/r. Solver APIs often use s=||e||^2 after whitening.</text>
${legend}
${axisBox(92, 214, 380, 190, 'loss rho_r(r)', 'bounded/redescending losses stop growing')}
${polyline([[130, 354], [190, 344], [250, 318], [310, 274], [430, 238]], '#0f172a', 3.5)}
${polyline([[130, 354], [190, 344], [250, 318], [310, 286], [430, 252]], '#2563eb', 3.5)}
${polyline([[130, 354], [190, 346], [250, 326], [310, 302], [430, 284]], '#16a34a', 3.5)}
${polyline([[130, 354], [190, 346], [250, 326], [310, 310], [430, 310]], '#ea580c', 3.5)}
${polyline([[130, 354], [190, 344], [250, 324], [310, 312], [430, 304]], '#7c3aed', 3.5)}
${axisBox(510, 214, 380, 190, 'influence psi(r)', 'large residuals lose pull')}
${polyline([[548, 360], [608, 340], [668, 318], [728, 294], [848, 248]], '#0f172a', 3.5)}
${polyline([[548, 360], [608, 340], [668, 318], [728, 302], [848, 302]], '#2563eb', 3.5)}
${polyline([[548, 360], [608, 342], [668, 324], [728, 320], [848, 338]], '#16a34a', 3.5)}
${polyline([[548, 360], [608, 342], [668, 326], [728, 342], [848, 360]], '#ea580c', 3.5)}
${polyline([[548, 360], [608, 340], [668, 328], [728, 340], [848, 356]], '#7c3aed', 3.5)}
${axisBox(928, 214, 380, 190, 'IRLS weight w(r)', 'downweight or reject outliers')}
${polyline([[966, 260], [1026, 260], [1086, 260], [1146, 260], [1266, 260]], '#0f172a', 3.5)}
${polyline([[966, 260], [1026, 260], [1086, 272], [1146, 304], [1266, 336]], '#2563eb', 3.5)}
${polyline([[966, 260], [1026, 264], [1086, 286], [1146, 322], [1266, 352]], '#16a34a', 3.5)}
${polyline([[966, 260], [1026, 266], [1086, 308], [1146, 354], [1266, 354]], '#ea580c', 3.5)}
${polyline([[966, 260], [1026, 270], [1086, 304], [1146, 338], [1266, 352]], '#7c3aed', 3.5)}
<rect x="108" y="452" width="1184" height="90" rx="14" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
<line x1="158" y1="498" x2="1232" y2="498" stroke="#64748b" stroke-width="4" stroke-linecap="round"/>
<circle cx="318" cy="498" r="13" fill="#16a34a"/>
<circle cx="560" cy="498" r="13" fill="#2563eb"/>
<circle cx="838" cy="498" r="13" fill="#ea580c"/>
<circle cx="1068" cy="498" r="13" fill="#e11d48"/>
${label('whiten first: e=L*r', 252, 570, { maxChars: 28 })}
${label('inlier band near k', 560, 570, { maxChars: 28 })}
${label('soft downweight', 838, 570, { maxChars: 28 })}
${label('redescending rejection', 1068, 570, { maxChars: 30 })}
<text x="116" y="464" font-size="15" font-weight="800" fill="#0f172a">Whitening scale and outlier behavior</text>
<text x="1200" y="526" text-anchor="middle" font-size="13" font-weight="700" fill="#64748b">|r| or sqrt(s)</text>
`)
}

function renderObjectiveLandscape(spec) {
  if (spec.file.endsWith('objective-residual-design-and-audit.md')) {
    return renderObjectiveResidualAudit(spec)
  }

  if (spec.file.endsWith('robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md')) {
    return renderRobustLossComparison(spec)
  }

  return frame(spec, `
<!-- layout:objective-landscape -->
${landscapeLayout(spec)}
`)
}

function renderOccupancyMapUpdate(spec) {
  return frame(spec, `
<!-- layout:occupancy-map-update -->
<rect x="158" y="196" width="416" height="416" rx="16" fill="url(#grid)" stroke="#0f172a" stroke-width="3"/>
${miniMatrix(190, 228, 8, 8, 46, { strong: '#16a34a', mid: '#bbf7d0', active: (row, col) => (row > 4 && col > 3 ? 2 : (row + col) % 3 === 0 ? 1 : 0) })}
${box(750, 244, 240, 86, nodeName(spec, 0, 'prior grid'), { ...palette(0), titleChars: 22 })}
${box(890, 438, 240, 86, nodeName(spec, 1, 'sensor update'), { ...palette(1), titleChars: 22 })}
${arrow(578, 360, 746, 288, '#64748b', 3)}
${arrow(990, 332, 1010, 434, '#64748b', 3)}
`)
}

function renderOptimizationStepGeometry(spec) {
  if (spec.file.endsWith('solver-selection-and-convergence-diagnosis.md')) {
    return renderSolverSelectionConvergence(spec)
  }

  return frame(spec, `
<!-- layout:optimization-step-geometry -->
${landscapeLayout(spec, { label: 'step geometry compares gradient, trust region, and update size' })}
`)
}

function renderProbabilityThresholds(spec) {
  return frame(spec, `
<!-- layout:probability-thresholds -->
${probabilityLayout(spec)}
`)
}

function renderProjectionRays(spec) {
  return frame(spec, `
<!-- layout:projection-rays -->
<rect x="180" y="264" width="160" height="220" rx="12" fill="#1e293b"/>
<circle cx="260" cy="374" r="26" fill="#38bdf8"/>
<rect x="1010" y="210" width="190" height="300" rx="12" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
${polyline([[340, 374], [1010, 250]], '#2563eb', 3)}
${polyline([[340, 374], [1010, 360]], '#2563eb', 3)}
${polyline([[340, 374], [1010, 478]], '#2563eb', 3)}
${circleNode(1048, 250, 24, 'p1', { ...palette(2), maxChars: 4, size: 11 })}
${circleNode(1106, 360, 24, 'p2', { ...palette(3), maxChars: 4, size: 11 })}
${circleNode(1154, 478, 24, 'p3', { ...palette(4), maxChars: 4, size: 11 })}
${label(nodeName(spec, 0, 'camera rays'), 700, 596, { maxChars: 32 })}
`)
}

function renderRadarMap(spec) {
  return frame(spec, `
<!-- layout:radar-map -->
${radarLayout(spec)}
`)
}

function renderReceptiveField(spec) {
  return frame(spec, `
<!-- layout:receptive-field -->
<rect x="150" y="216" width="376" height="376" rx="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
${miniMatrix(178, 244, 7, 7, 46, { active: (row, col) => (row >= 2 && row <= 4 && col >= 2 && col <= 4 ? 2 : 0) })}
${arrow(536, 404, 724, 404, '#64748b', 3)}
<rect x="750" y="258" width="288" height="288" rx="14" fill="#f8fafc" stroke="#2563eb" stroke-width="3"/>
${miniMatrix(784, 292, 4, 4, 56, { strong: '#16a34a', mid: '#bbf7d0', active: (row, col) => (row === 1 && col === 2 ? 2 : row === col ? 1 : 0) })}
${label(nodeName(spec, 0, 'local field to feature map'), 700, 626, { maxChars: 38 })}
`)
}

function renderRegistrationComparison(spec) {
  return frame(spec, `
<!-- layout:registration-comparison -->
${comparisonColumnsLayout(spec, { headings: ['source cloud', 'target cloud', 'aligned residual'] })}
`)
}

function renderRenderingComparison(spec) {
  return frame(spec, `
<!-- layout:rendering-comparison -->
${comparisonColumnsLayout(spec, { headings: ['rays', 'splat field', 'rendered view'] })}
`)
}

function renderRepresentationComparison(spec) {
  return frame(spec, `
<!-- layout:representation-comparison -->
${comparisonColumnsLayout(spec, { headings: ['voxels', 'surfels', 'octree'] })}
`)
}

function renderRoadCorridorGeometry(spec) {
  return frame(spec, `
<!-- layout:road-corridor-geometry -->
${roadGeometryLayout(spec)}
`)
}

function renderSearchAndGating(spec) {
  return frame(spec, `
<!-- layout:search-and-gating -->
<rect x="142" y="210" width="500" height="360" rx="16" fill="url(#grid)" stroke="#94a3b8" stroke-width="2"/>
<ellipse cx="388" cy="386" rx="170" ry="96" fill="#dbeafe" stroke="#2563eb" stroke-width="4" opacity="0.72"/>
${scatterPoints([[330, 378, 9, '#2563eb'], [398, 354, 9, '#16a34a'], [470, 410, 9, '#2563eb'], [232, 260, 8, '#e11d48'], [570, 520, 8, '#e11d48']])}
${box(784, 252, 250, 82, nodeName(spec, 0, 'candidate set'), { ...palette(0), titleChars: 24 })}
${box(910, 436, 250, 82, nodeName(spec, 1, 'gate result'), { ...palette(1), titleChars: 24 })}
${arrow(642, 388, 780, 294, '#64748b', 3)}
${arrow(1034, 334, 1000, 432, '#64748b', 3)}
`)
}

function renderSequenceMemory(spec) {
  return frame(spec, `
<!-- layout:sequence-memory -->
${laneTimingLayout(spec, { labels: ['input', 'hidden', 'gate', 'memory'] })}
`)
}

function renderSignalFlowDepth(spec) {
  return frame(spec, `
<!-- layout:signal-flow-depth -->
${horizontalBlocks(spec, 258, { count: 5, width: 170 })}
${polyline([[180, 520], [300, 480], [420, 536], [540, 470], [660, 530], [780, 486], [900, 526], [1020, 472], [1140, 520]], '#7c3aed', 4)}
${label('activation and gradient signal depth', 700, 608, { maxChars: 40 })}
`)
}

function renderSignalProcessingChain(spec) {
  return frame(spec, `
<!-- layout:signal-processing-chain -->
${radarLayout(spec, { spectrum: 'windowed spectrum' })}
`)
}

function renderSolverLoop(spec) {
  if (spec.file.endsWith('nonlinear-solver-diagnostics-crosswalk.md')) {
    return renderNonlinearSolverDiagnosticsCrosswalk(spec)
  }

  return frame(spec, `
<!-- layout:solver-loop -->
${loopControlLayout(spec, { label: 'solver iterations update residuals until convergence' })}
`)
}

function renderSparseAttentionMap(spec) {
  return frame(spec, `
<!-- layout:sparse-attention-map -->
<rect x="180" y="190" width="390" height="390" rx="16" fill="url(#grid)" stroke="#4c1d95" stroke-width="3"/>
${miniMatrix(206, 216, 8, 8, 44, { strong: '#7c3aed', mid: '#ddd6fe', active: (row, col) => (row === col || (row + col) % 5 === 0 ? 2 : Math.abs(row - col) === 1 ? 1 : 0) })}
${box(760, 270, 230, 82, nodeName(spec, 0, 'local windows'), { ...palette(4), titleChars: 22 })}
${box(910, 442, 230, 82, nodeName(spec, 1, 'global tokens'), { ...palette(0), titleChars: 22 })}
${arrow(574, 340, 756, 312, '#64748b', 3)}
${arrow(574, 438, 906, 482, '#64748b', 3)}
`)
}

function renderStateEstimationChain(spec) {
  return frame(spec, `
<!-- layout:state-estimation-chain -->
${horizontalBlocks(spec, 286, { count: 5, width: 188 })}
${factorGraphLayout(spec, { middle: 'update', label: 'state estimates connect measurements, priors, and smoothing' })}
`)
}

function renderSystemsMap(spec) {
  return frame(spec, `
<!-- layout:systems-map -->
${systemMapLayout(spec)}
`)
}

function renderTensorPipeline(spec) {
  return frame(spec, `
<!-- layout:tensor-pipeline -->
${learningTokensLayout(spec, { output: 'heads', label: 'tensor stages reshape features into task outputs' })}
`)
}

function renderTimingSync(spec) {
  return frame(spec, `
<!-- layout:timing-sync -->
${laneTimingLayout(spec)}
`)
}

function renderTokenGrid(spec) {
  return frame(spec, `
<!-- layout:token-grid -->
${learningTokensLayout(spec, { output: 'tokens', label: 'discrete token grids preserve spatial and sequence context' })}
`)
}

function renderTrainingLifecycle(spec) {
  return frame(spec, `
<!-- layout:training-lifecycle -->
${horizontalBlocks(spec, 258, { count: 5, width: 178 })}
${curve([[262, 470], [430, 596], [920, 596], [1094, 470]], '#16a34a', 3, { arrow: true })}
${label('evaluation feeds the next data and training pass', 700, 622, { maxChars: 50 })}
`)
}

function renderTransformTree(spec) {
  return frame(spec, `
<!-- layout:transform-tree -->
${circleNode(700, 230, 58, nodeName(spec, 0, 'world'), { ...palette(0) })}
${circleNode(430, 390, 54, nodeName(spec, 1, 'map'), { ...palette(1) })}
${circleNode(700, 430, 54, nodeName(spec, 2, 'base'), { ...palette(2) })}
${circleNode(970, 390, 54, nodeName(spec, 3, 'sensor'), { ...palette(3) })}
${circleNode(700, 560, 48, nodeName(spec, 4, 'camera'), { ...palette(4) })}
${arrow(664, 276, 472, 358, '#64748b', 3)}
${arrow(700, 290, 700, 374, '#64748b', 3)}
${arrow(736, 276, 928, 358, '#64748b', 3)}
${arrow(700, 486, 700, 510, '#64748b', 3)}
`)
}

function renderUncertaintyGeometry(spec) {
  return frame(spec, `
<!-- layout:uncertainty-geometry -->
<rect x="156" y="204" width="600" height="380" rx="16" fill="url(#grid)" stroke="#94a3b8" stroke-width="2"/>
<ellipse cx="418" cy="386" rx="190" ry="86" transform="rotate(-22 418 386)" fill="#dbeafe" stroke="#2563eb" stroke-width="4" opacity="0.74"/>
<ellipse cx="418" cy="386" rx="96" ry="44" transform="rotate(-22 418 386)" fill="none" stroke="#1d4ed8" stroke-width="3"/>
${arrow(418, 386, 588, 314, '#e11d48', 4)}
${arrow(418, 386, 482, 510, '#16a34a', 4)}
${box(860, 270, 250, 86, nodeName(spec, 0, 'covariance'), { ...palette(0), titleChars: 24 })}
${box(982, 446, 250, 86, nodeName(spec, 1, 'gate'), { ...palette(1), titleChars: 24 })}
${arrow(756, 386, 856, 314, '#64748b', 3)}
${arrow(1010, 358, 1080, 442, '#64748b', 3)}
`)
}

function renderWorldModelRollout(spec) {
  return frame(spec, `
<!-- layout:world-model-rollout -->
${laneTimingLayout(spec, { labels: ['context', 'latent', 'prediction', 'plan'] })}
${curve([[212, 246], [420, 164], [1000, 164], [1174, 246]], '#16a34a', 3, { arrow: true })}
`)
}

const KIND_RENDERER = {
  'architecture-comparison': renderArchitectureComparison,
  'attention-matrix': renderAttentionMatrix,
  'beam-noise-model': renderBeamNoiseModel,
  'belief-update-loop': renderBeliefUpdateLoop,
  'benchmark-split-firewall': renderBenchmarkSplitFirewall,
  'closed-loop-control': renderClosedLoopControl,
  'computational-graph': renderComputationalGraph,
  'decision-boundary': renderDecisionBoundary,
  'density-mixture': renderDensityMixture,
  'dynamics-model-ladder': renderDynamicsModelLadder,
  'embedding-space': renderEmbeddingSpace,
  'error-budget': renderErrorBudget,
  'evaluation-firewall': renderEvaluationFirewall,
  'factor-graph': renderFactorGraph,
  'filter-update-loop': renderFilterUpdateLoop,
  'generative-trajectory': renderGenerativeTrajectory,
  'geodesy-chain': renderGeodesyChain,
  'information-map': renderInformationMap,
  'latent-architecture': renderLatentArchitecture,
  'learning-roadmap': renderLearningRoadmap,
  'manifold-linearization': renderManifoldLinearization,
  'map-and-planning-stack': renderMapAndPlanningStack,
  'matrix-structure': renderMatrixStructure,
  'measurement-chain': renderMeasurementChain,
  'numerical-factorization': renderNumericalFactorization,
  'objective-landscape': renderObjectiveLandscape,
  'occupancy-map-update': renderOccupancyMapUpdate,
  'optimization-step-geometry': renderOptimizationStepGeometry,
  'probability-thresholds': renderProbabilityThresholds,
  'projection-rays': renderProjectionRays,
  'radar-map': renderRadarMap,
  'receptive-field': renderReceptiveField,
  'registration-comparison': renderRegistrationComparison,
  'rendering-comparison': renderRenderingComparison,
  'representation-comparison': renderRepresentationComparison,
  'road-corridor-geometry': renderRoadCorridorGeometry,
  'search-and-gating': renderSearchAndGating,
  'sequence-memory': renderSequenceMemory,
  'signal-flow-depth': renderSignalFlowDepth,
  'signal-processing-chain': renderSignalProcessingChain,
  'solver-loop': renderSolverLoop,
  'sparse-attention-map': renderSparseAttentionMap,
  'state-estimation-chain': renderStateEstimationChain,
  'systems-map': renderSystemsMap,
  'tensor-pipeline': renderTensorPipeline,
  'timing-sync': renderTimingSync,
  'token-grid': renderTokenGrid,
  'training-lifecycle': renderTrainingLifecycle,
  'transform-tree': renderTransformTree,
  'uncertainty-geometry': renderUncertaintyGeometry,
  'world-model-rollout': renderWorldModelRollout
}

function chooseRenderer(spec) {
  const renderer = KIND_RENDERER[spec.diagramKind]
  if (!renderer) throw new Error(`${spec.file}: missing renderer for ${spec.diagramKind}`)
  return renderer
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
      diagramKind: visualKindForFile(file),
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
