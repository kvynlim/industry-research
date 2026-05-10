import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { repoRoot, priorityRowsForDirectory } from './priority-metadata.mjs'

const OVERVIEWS = [
  {
    relDir: '30-autonomy-stack/perception/methods',
    overview: '30-autonomy-stack/perception/methods/overview.md'
  },
  {
    relDir: '30-autonomy-stack/localization-mapping/slam-methods',
    overview: '30-autonomy-stack/localization-mapping/slam-methods/overview.md'
  }
]

const startMarkerPattern = /^[ \t]*<!-- priority-table:start -->[ \t]*\r?$/gm
const endMarkerPattern = /^[ \t]*<!-- priority-table:end -->[ \t]*\r?$/gm

function escapeTableCell(value) {
  return String(value).replaceAll('|', '\\|')
}

function escapeLinkText(value) {
  return escapeTableCell(value).replaceAll('[', '\\[').replaceAll(']', '\\]')
}

export function formatPriorityTable(rows, relDir) {
  if (rows.length === 0) return 'No rated method pages yet.'

  const lines = [
    '| Method | Learning | Deployment | Type | Stage | Maturity | Tags | Reason |',
    '|---|---:|---:|---|---|---|---|---|'
  ]

  for (const row of rows) {
    const href = path.posix.relative(relDir, row.relPath)
    const title = escapeLinkText(row.title)
    const tags = row.priority.tags.map((tag) => `\`${escapeTableCell(tag)}\``).join(', ')
    const reason = escapeTableCell(row.priority.reason)
    lines.push(
      `| [${title}](${href}) | ${row.priority.learning} | ${row.priority.deployment} | ` +
        `\`${escapeTableCell(row.priority.type)}\` | ` +
        `\`${escapeTableCell(row.priority.stage)}\` | ` +
        `\`${escapeTableCell(row.priority.maturity)}\` | ` +
        `${tags} | ${reason} |`
    )
  }
  return lines.join('\n')
}

export function replaceGeneratedBlock(markdown, table) {
  const startMarkers = [...markdown.matchAll(startMarkerPattern)]
  const endMarkers = [...markdown.matchAll(endMarkerPattern)]

  if (startMarkers.length === 0 && endMarkers.length === 0) {
    throw new Error('overview page is missing priority-table marker block')
  }
  if (startMarkers.length > 1 || endMarkers.length > 1) {
    throw new Error('overview page has duplicate priority-table marker block')
  }
  if (startMarkers.length === 0) {
    throw new Error('overview page has priority-table end marker without start marker')
  }
  if (endMarkers.length === 0) {
    throw new Error('overview page has priority-table start marker without end marker')
  }

  const startMarker = startMarkers[0]
  const endMarker = endMarkers[0]
  if (startMarker.index > endMarker.index) {
    throw new Error('overview page priority-table start marker must appear before end marker')
  }

  const replacement = `<!-- priority-table:start -->\n${table}\n<!-- priority-table:end -->`
  return markdown.slice(0, startMarker.index) + replacement + markdown.slice(endMarker.index + endMarker[0].length)
}

function prepareOverviewUpdate({ relDir, overview }, root) {
  const overviewPath = path.join(root, overview)
  const markdown = fs.readFileSync(overviewPath, 'utf8')
  const table = formatPriorityTable(priorityRowsForDirectory(relDir, root), relDir)
  return { overviewPath, markdown: replaceGeneratedBlock(markdown, table) }
}

export function updateOverview(config, root = repoRoot) {
  const { overviewPath, markdown } = prepareOverviewUpdate(config, root)
  fs.writeFileSync(overviewPath, markdown, 'utf8')
}

export function updateAllOverviews(root = repoRoot) {
  const updates = OVERVIEWS.map((config) => prepareOverviewUpdate(config, root))
  for (const { overviewPath, markdown } of updates) {
    fs.writeFileSync(overviewPath, markdown, 'utf8')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateAllOverviews()
}
