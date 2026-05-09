#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const figureRoot = path.join(repoRoot, '10-knowledge-base', '_assets', 'figures')
const markerStart = '<!-- kb-figure:start -->'
const markerEnd = '<!-- kb-figure:end -->'

const figures = [
  {
    file: '10-knowledge-base/geometry-3d/pointpillars.md',
    asset: 'geometry-3d-pointpillars.svg',
    title: 'PointPillars tensor path',
    alt: 'PointPillars tensor path from points to BEV outputs',
    caption: 'PointPillars converts raw point clouds into bounded pillar tensors, pooled pillar features, a BEV pseudo-image, and detector or world-model outputs.',
    render: renderPointPillars
  },
  {
    file: '10-knowledge-base/systems-engineering/signal-processing-weather.md',
    asset: 'systems-engineering-signal-processing-weather.svg',
    title: 'Weather signal-processing chain',
    alt: 'Weather processing chain from evidence to degraded response',
    caption: 'The weather-processing recommendations form a chain from dual-return evidence through DSOR and LIOR cleanup, temporal filtering, severity classification, and degraded-mode response.',
    render: renderWeather
  },
  {
    file: '10-knowledge-base/systems-engineering/theoretical-foundations.md',
    asset: 'systems-engineering-theoretical-foundations.svg',
    title: 'World-model theory map',
    alt: 'World-model formalism connected to theoretical foundations',
    caption: 'The theoretical foundations page connects world-model formalism to predictive coding, representation theory, causality, control, games, and safety-critical ML evidence.',
    render: renderTheoreticalFoundations
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md',
    asset: 'numerical-linear-algebra-cholesky-ldlt-normal-equations.svg',
    title: 'Normal-equation factorization path',
    alt: 'Normal equations with SPD checks and Cholesky or LDLT factorization',
    caption: 'Normal equations turn residual Jacobians into an SPD system only when the problem is well constrained; Cholesky and LDLT expose conditioning and indefiniteness.',
    render: renderCholeskyLdlt
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md',
    asset: 'numerical-linear-algebra-eigenvalues-hessian-conditioning-observability.svg',
    title: 'Hessian spectrum and observability',
    alt: 'Hessian spectrum separating constrained directions and nullspaces',
    caption: 'The Hessian spectrum separates well-constrained directions, weakly constrained directions, and nullspaces that require damping, priors, or better excitation.',
    render: renderHessianSpectrum
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md',
    asset: 'numerical-linear-algebra-qr-svd-rank-revealing-solvers.svg',
    title: 'Rank-revealing least-squares solvers',
    alt: 'QR and SVD rank-revealing least-squares solver choices',
    caption: 'QR and SVD solve least-squares problems while exposing rank and nullspace structure that normal equations can hide.',
    render: renderQrSvd
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md',
    asset: 'numerical-linear-algebra-schur-complement-marginalization-pcg.svg',
    title: 'Schur complement reduction',
    alt: 'Schur complement eliminating nuisance states into a reduced system',
    caption: 'The Schur complement removes landmarks or nuisance states to produce a smaller reduced system for pose solving, marginalization, or PCG.',
    render: renderSchurComplement
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md',
    asset: 'numerical-linear-algebra-sparse-matrices-fill-in-ordering.svg',
    title: 'Sparse ordering and fill-in',
    alt: 'Sparse matrix ordering changes fill-in during factorization',
    caption: 'Variable ordering changes fill-in during sparse factorization, directly affecting memory, runtime, and whether real-time SLAM remains feasible.',
    render: renderSparseOrdering
  },
  {
    file: '10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md',
    asset: 'numerical-linear-algebra-square-root-information-and-covariance-recovery.svg',
    title: 'Square-root information workflow',
    alt: 'Square-root information factors and selected covariance recovery',
    caption: 'Square-root information methods preserve numerical stability by carrying factored information matrices and recovering selected marginal covariances only when needed.',
    render: renderSquareRootInfo
  }
]

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

function wrapText(value, maxChars = 18) {
  const lines = []
  let line = ''

  for (const word of String(value).split(/\s+/)) {
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
  const size = options.size ?? 17
  const weight = options.weight ?? 700
  const fill = options.fill ?? '#172033'
  const anchor = options.anchor ?? 'middle'
  const lineHeight = options.lineHeight ?? Math.round(size * 1.22)
  const lines = wrapText(value, options.maxChars ?? 18).slice(0, options.maxLines ?? 4)

  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`)
    .join('\n')
}

function label(value, x, y, options = {}) {
  return textBlock(value, x, y, {
    fill: options.fill ?? '#475569',
    size: options.size ?? 14,
    weight: options.weight ?? 600,
    maxChars: options.maxChars ?? 24,
    maxLines: options.maxLines ?? 3,
    anchor: options.anchor ?? 'middle'
  })
}

function box(x, y, w, h, title, subtitle = '', options = {}) {
  const fill = options.fill ?? '#eef5ff'
  const stroke = options.stroke ?? '#2f6fd6'
  const rx = options.rx ?? 12
  const titleY = y + (subtitle ? 30 : h / 2 + 6)
  const subtitleY = y + 55

  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${options.strokeWidth ?? 2}"/>
${textBlock(title, x + w / 2, titleY, { size: options.titleSize ?? 17, maxChars: options.titleChars ?? 18, maxLines: 2 })}
${subtitle ? textBlock(subtitle, x + w / 2, subtitleY, { size: options.subtitleSize ?? 13, weight: 600, fill: '#475569', maxChars: options.subtitleChars ?? 20, maxLines: 2 }) : ''}`
}

function pill(x, y, w, h, text, fill = '#f8fafc') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="#94a3b8"/>
${textBlock(text, x + w / 2, y + h / 2 + 5, { size: 13, weight: 700, fill: '#334155', maxChars: 18, maxLines: 1 })}`
}

function arrow(x1, y1, x2, y2, color = '#2563eb', width = 3) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" marker-end="url(#arrow)"/>`
}

function pathArrow(d, color = '#2563eb', width = 3) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"/>`
}

function frame(spec, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(spec.title)}</title>
  <desc id="desc">${escapeXml(spec.caption)}</desc>
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#2563eb"/>
    </marker>
    <pattern id="fineGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#e2e8f0" stroke-width="1"/>
    </pattern>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="1200" height="620" fill="#f8fafc"/>
  <rect x="38" y="34" width="1124" height="552" rx="18" fill="#ffffff" stroke="#d9e2ef" filter="url(#shadow)"/>
  <text x="70" y="84" font-size="30" font-weight="800" fill="#0f172a">${escapeXml(spec.title)}</text>
  <rect x="70" y="104" width="1060" height="2" fill="#dbeafe"/>
${inner}
</svg>
`
}

function matrixGrid(x, y, rows, cols, cell, active, options = {}) {
  let out = ''
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const state = active(r, c)
      const fill = state === 2 ? (options.strong ?? '#2563eb') : state === 1 ? (options.mid ?? '#bfdbfe') : '#f8fafc'
      out += `<rect x="${x + c * cell}" y="${y + r * cell}" width="${cell - 4}" height="${cell - 4}" rx="5" fill="${fill}" stroke="#cbd5e1"/>\n`
    }
  }
  return out
}

function smallSparkline(points, color = '#2563eb') {
  return `<polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
}

function renderPointPillars(spec) {
  const points = [
    [98, 270], [125, 230], [154, 295], [172, 248], [206, 282], [228, 220], [246, 306],
    [102, 374], [138, 336], [176, 392], [214, 350], [250, 382]
  ].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 5 : 4}" fill="${i % 2 ? '#0f766e' : '#2563eb'}"/>`).join('\n')

  let grid = ''
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      const fill = [[0, 1], [1, 3], [2, 2], [3, 0], [4, 4]].some(([rr, cc]) => rr === r && cc === c) ? '#bfdbfe' : '#f8fafc'
      grid += `<rect x="${324 + c * 28}" y="${220 + r * 28}" width="25" height="25" fill="${fill}" stroke="#94a3b8"/>\n`
    }
  }
  const pillars = [0, 1, 2, 3].map((i) => `<rect x="${356 + i * 24}" y="${316 - i * 18}" width="20" height="${54 + i * 18}" fill="#60a5fa" opacity="0.82" stroke="#1d4ed8"/>`).join('\n')

  const bev = matrixGrid(720, 205, 6, 7, 30, (r, c) => ((r + c) % 5 === 0 ? 2 : (r * c) % 4 === 0 ? 1 : 0), { strong: '#0f766e', mid: '#bbf7d0' })

  return frame(spec, `
${box(74, 168, 205, 270, 'Raw point cloud', 'x, y, z, intensity', { fill: '#eff6ff' })}
${points}
${pill(100, 406, 152, 30, 'unordered points', '#e0f2fe')}
${arrow(280, 300, 322, 300)}
${box(320, 168, 190, 270, 'Bounded pillar tensor', 'M x P x D', { fill: '#f0fdf4', stroke: '#16a34a' })}
${grid}
${pillars}
${arrow(512, 300, 554, 300)}
${box(556, 210, 120, 96, 'PFN', 'shared MLP', { fill: '#fff7ed', stroke: '#ea580c' })}
${box(556, 332, 120, 82, 'Max pool', 'per pillar', { fill: '#fff7ed', stroke: '#ea580c' })}
${arrow(616, 307, 616, 330, '#ea580c')}
${arrow(678, 300, 718, 300)}
${box(718, 168, 245, 270, 'BEV pseudo-image', 'scatter C x H x W', { fill: '#ecfeff', stroke: '#0891b2' })}
${bev}
${pathArrow('M965 260 C1010 245 1022 220 1044 198')}
${pathArrow('M965 340 C1012 352 1028 382 1046 414')}
${box(1042, 148, 96, 92, '2D CNN backbone', '', { fill: '#f5f3ff', stroke: '#7c3aed', titleSize: 15, titleChars: 10 })}
${box(1030, 390, 118, 88, 'Detector / world model', '', { fill: '#ffe4e6', stroke: '#e11d48', titleSize: 15, titleChars: 12 })}
${label('vertical columns keep height evidence inside features', 600, 508, { size: 15, maxChars: 52 })}
`)
}

function renderWeather(spec) {
  return frame(spec, `
${box(74, 214, 150, 126, 'Dual returns', 'range + intensity checks', { fill: '#eff6ff' })}
${box(258, 214, 150, 126, 'DSOR', 'range-adaptive density cleanup', { fill: '#f0fdf4', stroke: '#16a34a' })}
${box(442, 214, 150, 126, 'LIOR', 'low-intensity outlier removal', { fill: '#fff7ed', stroke: '#ea580c' })}
${box(626, 214, 150, 126, 'Temporal filter', 'persistence across scans', { fill: '#ecfeff', stroke: '#0891b2' })}
${box(810, 214, 150, 126, 'Weather state', 'clear / rain / fog / exhaust', { fill: '#f5f3ff', stroke: '#7c3aed' })}
${box(994, 214, 128, 126, 'Degraded response', 'planner + health monitor', { fill: '#ffe4e6', stroke: '#e11d48', titleChars: 12 })}
${arrow(226, 277, 256, 277)}
${arrow(410, 277, 440, 277)}
${arrow(594, 277, 624, 277)}
${arrow(778, 277, 808, 277)}
${arrow(962, 277, 992, 277)}
${pill(82, 378, 126, 32, 'first/last gap', '#dbeafe')}
${pill(268, 378, 128, 32, 'density vs range', '#dcfce7')}
${pill(454, 378, 126, 32, 'weak returns', '#fed7aa')}
${pill(632, 378, 138, 32, 'N-frame evidence', '#cffafe')}
${pill(824, 378, 122, 32, 'hysteresis', '#ede9fe')}
${pill(1000, 378, 116, 32, 'slow/stop mode', '#ffe4e6')}
${pathArrow('M885 212 C872 166 746 152 666 182', '#64748b', 2.5)}
${label('state feeds adaptive thresholds back into cleanup', 760, 154, { size: 14, maxChars: 48 })}
${smallSparkline([[96, 480], [142, 456], [188, 466], [234, 432], [280, 446], [326, 404]], '#2563eb')}
${smallSparkline([[414, 480], [460, 478], [506, 458], [552, 430], [598, 428], [644, 392]], '#0f766e')}
${label('noisy evidence becomes a stable operational state', 390, 520, { size: 15, maxChars: 56 })}
`)
}

function renderTheoreticalFoundations(spec) {
  const center = box(470, 242, 260, 118, 'World-model formalism', 'state, observation, action, prediction', { fill: '#eef2ff', stroke: '#4f46e5', titleSize: 19, titleChars: 22 })
  const nodes = [
    ['Predictive coding', 'prediction error', 142, 148, '#eff6ff', '#2563eb'],
    ['Representation theory', 'latent structure', 500, 142, '#f0fdf4', '#16a34a'],
    ['Causality', 'interventions', 860, 148, '#fff7ed', '#ea580c'],
    ['Control and games', 'agents + feedback', 180, 430, '#ecfeff', '#0891b2'],
    ['Safety-critical ML', 'evidence + assurance', 805, 430, '#ffe4e6', '#e11d48']
  ].map(([title, sub, x, y, fill, stroke]) => box(x, y, 210, 92, title, sub, { fill, stroke, titleChars: 19 }))

  return frame(spec, `
${center}
${nodes.join('\n')}
${arrow(470, 275, 354, 205, '#64748b', 2.5)}
${arrow(584, 242, 594, 236, '#64748b', 2.5)}
${arrow(730, 277, 858, 208, '#64748b', 2.5)}
${arrow(484, 354, 360, 440, '#64748b', 2.5)}
${arrow(724, 354, 810, 440, '#64748b', 2.5)}
${pathArrow('M603 242 C560 205 510 204 458 236', '#7c3aed', 2.5)}
${pathArrow('M733 301 C802 310 846 356 880 430', '#e11d48', 2.5)}
${pill(516, 390, 168, 32, 'learned dynamics', '#ede9fe')}
${pill(500, 434, 200, 32, 'counterfactual rollout', '#ffedd5')}
${label('the page is a dependency graph, not a single theory', 600, 522, { size: 15, maxChars: 58 })}
`)
}

function renderCholeskyLdlt(spec) {
  const jac = matrixGrid(86, 168, 6, 4, 31, (r, c) => ((r + c) % 3 === 0 ? 2 : r === c || c === 1 ? 1 : 0))
  const hess = matrixGrid(336, 168, 5, 5, 34, (r, c) => (r === c ? 2 : Math.abs(r - c) === 1 ? 1 : 0))
  const chol = matrixGrid(640, 168, 5, 5, 34, (r, c) => (r >= c ? (r === c ? 2 : 1) : 0), { strong: '#16a34a', mid: '#bbf7d0' })
  const ldlt = matrixGrid(890, 168, 5, 5, 34, (r, c) => (r === c ? 2 : r > c && r - c <= 1 ? 1 : 0), { strong: '#ea580c', mid: '#fed7aa' })

  return frame(spec, `
${box(72, 138, 150, 248, 'Residual Jacobian J', 'whitened blocks', { fill: '#eff6ff' })}
${jac}
${arrow(224, 260, 304, 260)}
${box(306, 138, 210, 248, 'Normal equations', 'H = J^T J, g = J^T r', { fill: '#f8fafc', stroke: '#475569', titleChars: 18 })}
${hess}
${pill(348, 342, 128, 30, 'condition squared', '#fee2e2')}
${arrow(518, 260, 588, 260)}
${box(590, 138, 210, 248, 'SPD path', 'Cholesky L L^T', { fill: '#f0fdf4', stroke: '#16a34a' })}
${chol}
${pathArrow('M518 304 C576 430 798 430 854 304', '#ea580c', 3)}
${box(840, 138, 242, 248, 'Semidefinite / indefinite signal', 'LDLT pivots', { fill: '#fff7ed', stroke: '#ea580c', titleChars: 22 })}
${ldlt}
${pill(900, 342, 124, 30, 'bad or zero pivots', '#ffedd5')}
${box(430, 446, 340, 72, 'Well constrained systems factor cleanly; gauge freedom and weak excitation do not.', '', { fill: '#f8fafc', stroke: '#94a3b8', titleSize: 16, titleChars: 44 })}
`)
}

function renderHessianSpectrum(spec) {
  const bars = [
    [170, 245, 58, 170, '#2563eb'], [250, 292, 58, 123, '#2563eb'], [330, 326, 58, 89, '#2563eb'],
    [520, 372, 58, 43, '#f59e0b'], [600, 386, 58, 29, '#f59e0b'],
    [790, 408, 58, 7, '#ef4444'], [870, 410, 58, 5, '#ef4444']
  ].map(([x, y, w, h, fill]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}"/>`).join('\n')

  return frame(spec, `
<line x1="120" y1="416" x2="1018" y2="416" stroke="#0f172a" stroke-width="4" marker-end="url(#arrow)"/>
<line x1="120" y1="416" x2="120" y2="176" stroke="#0f172a" stroke-width="4" marker-end="url(#arrow)"/>
${bars}
${label('eigenvalue magnitude', 150, 158, { anchor: 'start', maxChars: 24 })}
${label('Hessian eigen-directions', 845, 456, { maxChars: 28 })}
${box(132, 132, 270, 80, 'Well-constrained directions', 'stable pose, landmark, calibration modes', { fill: '#eff6ff', stroke: '#2563eb', titleChars: 26 })}
${box(458, 132, 250, 80, 'Weak directions', 'poor baseline or scaling', { fill: '#fef3c7', stroke: '#d97706' })}
${box(748, 132, 250, 80, 'Nullspace', 'gauge or missing prior', { fill: '#fee2e2', stroke: '#dc2626' })}
${pathArrow('M265 418 C265 470 520 480 548 420', '#64748b', 2.5)}
${label('large gap gives high condition number', 410, 506, { size: 15, maxChars: 42 })}
${box(844, 486, 232, 56, 'Response: add damping, priors, or excitation', '', { fill: '#f8fafc', stroke: '#94a3b8', titleSize: 15, titleChars: 34 })}
`)
}

function renderQrSvd(spec) {
  const a = matrixGrid(92, 170, 6, 4, 30, (r, c) => (r === c || (r + c) % 4 === 0 ? 2 : c === 1 ? 1 : 0))
  const q = matrixGrid(332, 178, 5, 4, 28, (r, c) => (r === c ? 2 : (r + c) % 3 === 0 ? 1 : 0), { strong: '#16a34a', mid: '#bbf7d0' })
  const r = matrixGrid(472, 178, 4, 4, 28, (row, col) => (row <= col ? (row === col ? 2 : 1) : 0), { strong: '#16a34a', mid: '#bbf7d0' })
  const u = matrixGrid(704, 178, 5, 4, 24, (row, col) => (row === col ? 2 : (row + col) % 4 === 0 ? 1 : 0), { strong: '#7c3aed', mid: '#ddd6fe' })
  const s = [0, 1, 2, 3].map((i) => `<rect x="${824 + i * 28}" y="${178 + i * 28}" width="22" height="22" rx="4" fill="${i < 3 ? '#7c3aed' : '#ef4444'}"/>`).join('\n')
  const vt = matrixGrid(960, 178, 4, 4, 24, (row, col) => (row === col ? 2 : (row + col) % 4 === 0 ? 1 : 0), { strong: '#7c3aed', mid: '#ddd6fe' })

  return frame(spec, `
${box(72, 134, 180, 300, 'Least-squares system', 'min ||A x - b||', { fill: '#eff6ff' })}
${a}
${arrow(254, 270, 304, 270)}
${box(306, 134, 285, 138, 'QR path', 'orthogonal solve; rank from R diagonal', { fill: '#f0fdf4', stroke: '#16a34a', titleChars: 16 })}
${q}
${textBlock('Q', 392, 344, { size: 17, maxLines: 1 })}
${r}
${textBlock('R', 526, 344, { size: 17, maxLines: 1 })}
${box(306, 330, 285, 104, 'Good default for least squares', 'avoids squaring condition number', { fill: '#f8fafc', stroke: '#94a3b8', titleChars: 28 })}
${arrow(594, 270, 654, 270)}
${box(656, 134, 460, 300, 'SVD path', 'U Sigma V^T shows numerical rank and nullspace', { fill: '#f5f3ff', stroke: '#7c3aed', titleChars: 14, subtitleChars: 34 })}
${u}
${s}
${vt}
${textBlock('U', 750, 344, { size: 17, maxLines: 1 })}
${textBlock('Sigma', 870, 344, { size: 17, maxLines: 1 })}
${textBlock('V^T', 1008, 344, { size: 17, maxLines: 1 })}
${pill(812, 388, 130, 32, 'tiny singular value', '#fee2e2')}
${label('normal equations can hide this rank evidence', 610, 506, { size: 15, maxChars: 52 })}
`)
}

function renderSchurComplement(spec) {
  const full = matrixGrid(90, 170, 6, 6, 32, (r, c) => {
    if (r < 3 && c < 3) return r === c ? 2 : 1
    if (r >= 3 && c >= 3) return r === c ? 2 : 1
    return (r + c) % 2 === 0 ? 1 : 0
  })
  const reduced = matrixGrid(742, 188, 4, 4, 42, (r, c) => (r === c ? 2 : Math.abs(r - c) <= 1 ? 1 : 0), { strong: '#16a34a', mid: '#bbf7d0' })

  return frame(spec, `
${box(70, 134, 270, 310, 'Block linear system', 'poses x and landmarks l', { fill: '#eff6ff', titleChars: 20 })}
${full}
${label('[ Hxx  Hxl ]', 222, 396, { size: 16, maxChars: 20 })}
${label('[ Hlx  Hll ]', 222, 420, { size: 16, maxChars: 20 })}
${arrow(344, 286, 452, 286)}
${box(454, 178, 210, 88, 'Eliminate landmarks', 'S = Hxx - Hxl Hll^-1 Hlx', { fill: '#fff7ed', stroke: '#ea580c', titleChars: 20, subtitleChars: 28 })}
${box(454, 324, 210, 88, 'Marginalize nuisance states', 'keep prior on remaining variables', { fill: '#fef3c7', stroke: '#ca8a04', titleChars: 22 })}
${pathArrow('M560 268 C560 290 560 300 560 322', '#ea580c')}
${arrow(666, 286, 738, 286)}
${box(740, 134, 252, 310, 'Reduced pose system', 'smaller solve for direct or PCG updates', { fill: '#f0fdf4', stroke: '#16a34a', titleChars: 21, subtitleChars: 28 })}
${reduced}
${pill(782, 388, 166, 32, 'pose-only normal matrix', '#dcfce7')}
${box(1018, 220, 96, 132, 'Back substitute or carry prior', '', { fill: '#f8fafc', stroke: '#94a3b8', titleSize: 15, titleChars: 13 })}
${arrow(994, 286, 1016, 286, '#64748b', 2.5)}
${label('used by bundle adjustment, SLAM marginalization, and iterative pose solves', 600, 508, { size: 15, maxChars: 76 })}
`)
}

function renderSparseOrdering(spec) {
  const before = matrixGrid(104, 160, 7, 7, 29, (r, c) => (r === c ? 2 : Math.abs(r - c) === 1 || (r === 0 && c === 5) || (r === 5 && c === 0) ? 1 : 0))
  const afterBad = matrixGrid(470, 160, 7, 7, 29, (r, c) => (r >= c && (r - c < 4 || c < 2) ? (r === c ? 2 : 1) : 0), { strong: '#dc2626', mid: '#fecaca' })
  const afterGood = matrixGrid(836, 160, 7, 7, 29, (r, c) => (r >= c && (r - c < 2 || (r > 4 && c < 2)) ? (r === c ? 2 : 1) : 0), { strong: '#16a34a', mid: '#bbf7d0' })

  return frame(spec, `
${box(74, 128, 260, 310, 'Original sparsity graph', 'variables and local factors', { fill: '#eff6ff', titleChars: 22 })}
${before}
${arrow(336, 282, 430, 222)}
${arrow(336, 310, 430, 382)}
${box(432, 128, 260, 310, 'Poor ordering', 'early dense separators', { fill: '#fff1f2', stroke: '#dc2626', titleChars: 18 })}
${afterBad}
${pill(486, 388, 150, 32, 'more fill-in memory', '#fee2e2')}
${box(798, 128, 260, 310, 'Fill-reducing ordering', 'AMD, COLAMD, nested dissection', { fill: '#f0fdf4', stroke: '#16a34a', titleChars: 24, subtitleChars: 28 })}
${afterGood}
${pill(844, 388, 166, 32, 'smaller factor graph', '#dcfce7')}
${label('same math, different permutation P H P^T before factorization', 600, 510, { size: 15, maxChars: 68 })}
`)
}

function renderSquareRootInfo(spec) {
  const j = matrixGrid(88, 170, 6, 4, 29, (r, c) => (r === c || (r + c) % 3 === 0 ? 2 : c === 2 ? 1 : 0))
  const r = matrixGrid(388, 178, 4, 5, 31, (row, col) => (row <= col ? (row === col ? 2 : 1) : 0), { strong: '#16a34a', mid: '#bbf7d0' })
  const info = matrixGrid(688, 178, 5, 5, 31, (row, col) => (row === col ? 2 : Math.abs(row - col) === 1 ? 1 : 0), { strong: '#0f766e', mid: '#99f6e4' })
  const cov = matrixGrid(956, 192, 4, 4, 31, (row, col) => ((row < 2 && col < 2) || row === col ? (row === col ? 2 : 1) : 0), { strong: '#7c3aed', mid: '#ddd6fe' })

  return frame(spec, `
${box(72, 134, 202, 292, 'Whitened residual Jacobian', 'A x = b', { fill: '#eff6ff', titleChars: 20 })}
${j}
${arrow(276, 280, 340, 280)}
${box(342, 134, 220, 292, 'QR factor', 'A = Q R, carry R', { fill: '#f0fdf4', stroke: '#16a34a', titleChars: 17 })}
${r}
${pill(398, 354, 110, 30, 'square-root form', '#dcfce7')}
${arrow(564, 280, 638, 280)}
${box(640, 134, 220, 292, 'Information factor', 'Lambda = R^T R when needed', { fill: '#ecfeff', stroke: '#0891b2', titleChars: 18 })}
${info}
${arrow(862, 280, 922, 280)}
${box(924, 134, 202, 292, 'Selected covariance recovery', 'only queried marginals', { fill: '#f5f3ff', stroke: '#7c3aed', titleChars: 19 })}
${cov}
${pill(962, 354, 126, 30, 'chosen blocks only', '#ede9fe')}
${pathArrow('M744 424 C690 498 470 500 434 424', '#64748b', 2.5)}
${label('avoid forming dense inverse covariance during normal operation', 594, 520, { size: 15, maxChars: 66 })}
`)
}

function replaceFigureBlock(markdown, block, asset) {
  const blockPattern = /<!-- kb-figure:start -->[\s\S]*?<!-- kb-figure:end -->/g
  const matches = [...markdown.matchAll(blockPattern)]
  const target = `](../_assets/figures/${asset})`
  const matching = matches.filter((match) => match[0].includes(target))

  if (matching.length === 0) {
    throw new Error(`Missing figure block containing ${target}`)
  }

  if (matching.length > 1) {
    throw new Error(`Multiple figure blocks contain ${target}`)
  }

  const match = matching[0]
  return `${markdown.slice(0, match.index)}${block}${markdown.slice(match.index + match[0].length)}`
}

function figureBlock(spec) {
  return `${markerStart}
![${escapeMarkdown(spec.alt)}](../_assets/figures/${spec.asset})

*Figure: ${spec.caption}*
${markerEnd}`
}

fs.mkdirSync(figureRoot, { recursive: true })

for (const spec of figures) {
  const markdownPath = path.join(repoRoot, spec.file)
  const assetPath = path.join(figureRoot, spec.asset)

  if (!fs.existsSync(markdownPath)) {
    throw new Error(`Missing markdown file: ${spec.file}`)
  }

  if (!fs.existsSync(assetPath)) {
    throw new Error(`Missing existing SVG asset: ${path.relative(repoRoot, assetPath).replace(/\\/g, '/')}`)
  }

  const svg = spec.render(spec)
  const markdown = fs.readFileSync(markdownPath, 'utf8')
  const updated = replaceFigureBlock(markdown, figureBlock(spec), spec.asset)

  fs.writeFileSync(assetPath, svg, 'utf8')
  fs.writeFileSync(markdownPath, updated, 'utf8')
}

console.log(`Updated ${figures.length} curated knowledge-base figures.`)
