import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(import.meta.url)

export const repoRoot = path.resolve(path.dirname(modulePath), '../..')

export const TARGET_DIRS = [
  '30-autonomy-stack/perception/methods',
  '30-autonomy-stack/localization-mapping/slam-methods'
]

export const ALLOWED_TYPE_VALUES = ['method', 'method-family', 'architecture-pattern', 'benchmark']
export const ALLOWED_STAGE_VALUES = [
  'foundation',
  'classic-baseline',
  'modern-core',
  'deployment-pattern',
  'frontier',
  'reference'
]
export const ALLOWED_MATURITY_VALUES = [
  'fielded-pattern',
  'pilot-proven',
  'prototype',
  'research',
  'watchlist',
  'historical'
]
export const ALLOWED_TAGS = [
  'road-av',
  'airside',
  'warehouse',
  'logistics-yard',
  'port',
  'outdoor-campus',
  'mining',
  'agriculture',
  'construction',
  'delivery-robot',
  'perception',
  'slam',
  'mapping',
  'runtime-localization',
  'fallback',
  'validation',
  'data-engine',
  'simulation',
  'indoor',
  'outdoor',
  'gnss-denied',
  'adverse-weather'
]

const REQUIRED_PRIORITY_FIELDS = ['learning', 'deployment', 'type', 'stage', 'maturity', 'tags', 'reason']
const ALLOWED_PRIORITY_FIELDS = new Set(REQUIRED_PRIORITY_FIELDS)

const priorityBlockPattern =
  /<!--\s*method-priority:start\s*\r?\n([\s\S]*?)\r?\nmethod-priority:end\s*-->/g
const priorityStartMarkerPattern = /<!--\s*method-priority:start\b/g
const priorityEndMarkerPattern = /^method-priority:end\s*-->/gm

export function normalizeRelPath(filePath, root = repoRoot) {
  return path.relative(root, filePath).replace(/\\/g, '/')
}

export function extractPriorityBlocks(markdown, relPath) {
  const startMarkers = [...markdown.matchAll(priorityStartMarkerPattern)].length
  const endMarkers = [...markdown.matchAll(priorityEndMarkerPattern)].length
  const blocks = [...markdown.matchAll(priorityBlockPattern)].map((match) => ({
    body: match[1],
    index: match.index ?? -1
  }))

  if (startMarkers !== endMarkers || blocks.length !== startMarkers) {
    throw new Error(`${relPath}: malformed method-priority block markers`)
  }

  if (blocks.length > 1) {
    throw new Error(`${relPath}: expected at most one method-priority block, found ${blocks.length}`)
  }

  const h1Match = /^#\s+.+$/m.exec(markdown)
  if (blocks.length === 1 && (!h1Match || blocks[0].index < h1Match.index + h1Match[0].length)) {
    throw new Error(`${relPath}: method-priority block must appear after the H1 heading`)
  }

  const firstSection = markdown.search(/^##\s+/m)
  if (blocks.length === 1 && firstSection !== -1 && blocks[0].index > firstSection) {
    throw new Error(`${relPath}: method-priority block must appear before the first ## heading`)
  }

  return blocks
}

function parseScalar(rawValue, relPath, key) {
  const raw = rawValue.trim()
  if (/^\d+$/.test(raw)) return Number(raw)
  if (/^"[^"]*"$/.test(raw)) return raw.slice(1, -1)
  if (/^\[[^\]]*\]$/.test(raw)) {
    const inner = raw.slice(1, -1).trim()
    if (inner === '') return []
    return inner.split(',').map((item) => {
      const value = item.trim()
      if (!/^"[^"]+"$/.test(value)) {
        throw new Error(`${relPath}: ${key} list values must be quoted strings`)
      }
      return value.slice(1, -1)
    })
  }
  throw new Error(`${relPath}: unsupported value for ${key}: ${raw}`)
}

export function parsePriorityYaml(body, relPath = 'priority block') {
  const lines = body.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines[0]?.trim() !== 'priority:') {
    throw new Error(`${relPath}: priority block must start with "priority:"`)
  }

  const priority = {}
  for (const line of lines.slice(1)) {
    const match = line.match(/^  ([a-z_]+):\s*(.+)$/)
    if (!match) {
      throw new Error(`${relPath}: unsupported priority line "${line}"`)
    }
    const [, key, rawValue] = match
    if (key in priority) {
      throw new Error(`${relPath}: duplicate field ${key}`)
    }
    priority[key] = parseScalar(rawValue, relPath, key)
  }
  return priority
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length
}

function validateEnum(errors, priority, key, allowed, relPath) {
  if (!allowed.includes(priority[key])) {
    errors.push(`${relPath}: ${key} must be one of ${allowed.join(', ')}`)
  }
}

export function validatePriority(priority, relPath) {
  const errors = []
  for (const key of REQUIRED_PRIORITY_FIELDS) {
    if (!(key in priority)) errors.push(`${relPath}: missing required field ${key}`)
  }
  for (const key of Object.keys(priority)) {
    if (!ALLOWED_PRIORITY_FIELDS.has(key)) errors.push(`${relPath}: unexpected field ${key}`)
  }

  for (const key of ['learning', 'deployment']) {
    if (!Number.isInteger(priority[key]) || priority[key] < 1 || priority[key] > 5) {
      errors.push(`${relPath}: ${key} must be an integer from 1 to 5`)
    }
  }

  validateEnum(errors, priority, 'type', ALLOWED_TYPE_VALUES, relPath)
  validateEnum(errors, priority, 'stage', ALLOWED_STAGE_VALUES, relPath)
  validateEnum(errors, priority, 'maturity', ALLOWED_MATURITY_VALUES, relPath)

  if (!Array.isArray(priority.tags)) {
    errors.push(`${relPath}: tags must be an array`)
  } else {
    if (priority.tags.length < 2 || priority.tags.length > 6) {
      errors.push(`${relPath}: tags must contain 2-6 values`)
    }
    if (hasDuplicates(priority.tags)) {
      errors.push(`${relPath}: tags must be unique`)
    }
    for (const tag of priority.tags) {
      if (!ALLOWED_TAGS.includes(tag)) errors.push(`${relPath}: unknown tag ${tag}`)
    }
  }

  if (typeof priority.reason !== 'string' || priority.reason.length < 40 || priority.reason.length > 180) {
    errors.push(`${relPath}: reason must be 40-180 characters`)
  }

  return { errors }
}

export function readMarkdownFiles(dir) {
  const files = []
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...readMarkdownFiles(absPath))
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(absPath)
  }
  return files
}

export function readPriorityFromFile(filePath, root = repoRoot) {
  const relPath = normalizeRelPath(filePath, root)
  const markdown = fs.readFileSync(filePath, 'utf8')
  const blocks = extractPriorityBlocks(markdown, relPath)
  if (blocks.length === 0) return { relPath, priority: null, errors: [] }

  const priority = parsePriorityYaml(blocks[0].body, relPath)
  const { errors } = validatePriority(priority, relPath)
  return { relPath, priority, errors }
}

export function scanPriorityMetadata(root = repoRoot) {
  const results = []
  for (const relDir of TARGET_DIRS) {
    for (const file of readMarkdownFiles(path.join(root, relDir))) {
      results.push(readPriorityFromFile(file, root))
    }
  }
  return results
}

export function titleFromMarkdown(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : path.basename(fallback, '.md')
}

export function priorityRowsForDirectory(relDir, root = repoRoot) {
  const entries = scanPriorityMetadata(root).filter((entry) => entry.relPath.startsWith(`${relDir}/`))
  const validationErrors = entries
    .filter((entry) => entry.priority && entry.errors.length > 0)
    .flatMap((entry) => entry.errors)

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join('\n'))
  }

  return entries
    .filter((entry) => entry.priority)
    .map((entry) => {
      const markdown = fs.readFileSync(path.join(root, entry.relPath), 'utf8')
      return { ...entry, title: titleFromMarkdown(markdown, entry.relPath) }
    })
    .sort((a, b) =>
      b.priority.deployment - a.priority.deployment ||
      b.priority.learning - a.priority.learning ||
      a.title.localeCompare(b.title, 'en')
    )
}

export function checkPriorityMetadata(root = repoRoot) {
  const errors = []
  for (const relDir of TARGET_DIRS) {
    for (const file of readMarkdownFiles(path.join(root, relDir))) {
      try {
        const entry = readPriorityFromFile(file, root)
        errors.push(...entry.errors)
      } catch (error) {
        errors.push(error.message)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

if (process.argv[1] === modulePath && process.argv.includes('--check')) {
  const result = checkPriorityMetadata()
  for (const error of result.errors) console.error(error)
  process.exit(result.ok ? 0 : 1)
}
