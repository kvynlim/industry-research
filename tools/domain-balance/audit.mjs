import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const ROOT_MARKDOWN_FILES = ['README.md', 'INDEX.md', 'METHODOLOGY.md', 'GLOSSARY.md']

export const CONTENT_DIRS = [
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
]

export const DOMAIN_BUCKETS = [
  {
    id: 'airside',
    regex: /\b(airside|airport|apron|ramp|gse|pushback|fod|jet\s*blast|turnaround|changi|caas)\b/gi
  },
  {
    id: 'road',
    regex: /\b(road|roadway|highway|street|urban driving|robotaxi|waymo|cruise|adas|ads|road av)\b/gi
  },
  {
    id: 'warehouse',
    regex: /\b(warehouse|indoor logistics|fulfillment|amr|forklift|iso 3691-4)\b/gi
  },
  {
    id: 'logistics-yard',
    regex: /\b(logistics yard|yard truck|yard tractor|trailer yard|distribution yard)\b/gi
  },
  {
    id: 'port',
    regex: /\b(port|terminal tractor|container terminal|container yard|yard crane|straddle carrier)\b/gi
  },
  {
    id: 'mining',
    regex: /\b(mining|mine|haul truck|quarry)\b/gi
  },
  {
    id: 'construction',
    regex: /\b(construction|earthmoving|excavator|bulldozer|jobsite)\b/gi
  },
  {
    id: 'agriculture',
    regex: /\b(agriculture|farm|tractor|sprayer|harvester|orchard|field robotics)\b/gi
  },
  {
    id: 'delivery-robot',
    regex: /\b(delivery robot|sidewalk robot|sidewalk delivery|last-mile|last mile)\b/gi
  },
  {
    id: 'outdoor-campus',
    regex: /\b(outdoor campus|campus shuttle|campus autonomy|private campus)\b/gi
  }
]

export function publicMarkdownFiles(root = repoRoot) {
  const rootFiles = ROOT_MARKDOWN_FILES.filter((file) => fs.existsSync(path.join(root, file)))
  const contentFiles = []

  for (const dir of CONTENT_DIRS) {
    const absDir = path.join(root, dir)
    if (!fs.existsSync(absDir)) continue
    contentFiles.push(...recursiveMarkdownFiles(root, absDir))
  }

  return [...rootFiles, ...contentFiles]
}

export function auditDomainBalance(root = repoRoot) {
  const files = publicMarkdownFiles(root)
  const domains = Object.fromEntries(DOMAIN_BUCKETS.map(({ id }) => [id, { files: 0, mentions: 0 }]))
  const folders = {}

  for (const relPath of files) {
    const markdown = fs.readFileSync(path.join(root, relPath), 'utf8')
    const folder = topLevelFolder(relPath)
    const folderSummary = ensureFolderSummary(folders, folder)
    folderSummary.files += 1

    for (const bucket of DOMAIN_BUCKETS) {
      const mentions = countMatches(markdown, bucket.regex)
      if (mentions > 0) {
        domains[bucket.id].files += 1
        domains[bucket.id].mentions += mentions
      }
      folderSummary.domains[bucket.id] += mentions
    }
  }

  return {
    totalFiles: files.length,
    domains,
    folders
  }
}

export function formatAuditReport(report) {
  const lines = [
    '# Domain Balance Audit',
    '',
    `Source Markdown files: ${report.totalFiles}`,
    '',
    '## Domain Summary',
    '',
    '| Domain | Files | Mentions |',
    '|---|---:|---:|'
  ]

  for (const { id } of DOMAIN_BUCKETS) {
    const domain = report.domains[id]
    lines.push(`| ${id} | ${domain.files} | ${domain.mentions} |`)
  }

  lines.push(
    '',
    '## Top-Level Folder Summary',
    '',
    `| Folder | Files | ${DOMAIN_BUCKETS.map(({ id }) => titleCaseDomain(id)).join(' | ')} |`,
    `|---|---:${'|---:'.repeat(DOMAIN_BUCKETS.length)}|`
  )

  for (const [folder, summary] of Object.entries(report.folders)) {
    const counts = DOMAIN_BUCKETS.map(({ id }) => summary.domains[id])
    lines.push(`| ${folder} | ${summary.files} | ${counts.join(' | ')} |`)
  }

  return lines.join('\n')
}

function recursiveMarkdownFiles(root, dir) {
  const files = []
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...recursiveMarkdownFiles(root, absPath))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(path.relative(root, absPath).replace(/\\/g, '/'))
    }
  }

  return files
}

function topLevelFolder(relPath) {
  return relPath.includes('/') ? relPath.split('/')[0] : 'root'
}

function ensureFolderSummary(folders, folder) {
  if (!folders[folder]) {
    folders[folder] = {
      files: 0,
      domains: Object.fromEntries(DOMAIN_BUCKETS.map(({ id }) => [id, 0]))
    }
  }

  return folders[folder]
}

function countMatches(markdown, regex) {
  regex.lastIndex = 0
  return [...markdown.matchAll(regex)].length
}

function titleCaseDomain(domain) {
  return `${domain[0].toUpperCase()}${domain.slice(1)}`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(formatAuditReport(auditDomainBalance()))
}
