#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { buildMoveMap, isTargetPath, normalizeRelPath } from './path-map.mjs'

const SKIP_PREFIXES = [
  'node_modules/',
  '.git/',
  '.vitepress/dist/',
  'docs/superpowers/'
]

const BATCHES = new Map([
  ['knowledge-platform', ['foundations/', 'hardware/']],
  ['autonomy', ['technology/']],
  ['runtime-cloud-safety-ops', ['cross-cutting/', 'operations/']],
  ['industry-synthesis', ['companies/', 'synthesis/']],
  ['all', null]
])

const MODES = new Set(['--print-map', '--move', '--rewrite-links', '--check-stale'])

function usage() {
  console.error('Usage: node tools/restructure/migrate.mjs (--print-map|--move|--rewrite-links|--check-stale) [--batch <name>]')
  console.error(`Supported batches: ${Array.from(BATCHES.keys()).join(', ')}`)
}

function parseArgs(argv) {
  let mode = null
  let batch = 'all'

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (MODES.has(arg)) {
      if (mode) {
        throw new Error(`Only one mode may be provided; saw ${mode} and ${arg}`)
      }
      mode = arg
    } else if (arg === '--batch') {
      batch = argv[i + 1]
      i += 1
      if (!batch) {
        throw new Error('--batch requires a value')
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!mode) {
    throw new Error('Missing mode')
  }
  if (!BATCHES.has(batch)) {
    throw new Error(`Unsupported batch: ${batch}`)
  }

  return { mode, batch }
}

function isSkipped(relPath) {
  const normalized = normalizeRelPath(relPath)
  return SKIP_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))
}

function isMarkdown(relPath) {
  return normalizeRelPath(relPath).toLowerCase().endsWith('.md')
}

function listGitMarkdownFiles() {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' })
  } catch {
    return []
  }

  try {
    const output = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map(normalizeRelPath)
      .filter((relPath) => !isSkipped(relPath))
  } catch (error) {
    console.warn(`Warning: git ls-files failed: ${error.message}`)
    return []
  }
}

function listFilesystemMarkdownFiles(dir = '.', results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    const relPath = normalizeRelPath(path.relative('.', entryPath))
    if (isSkipped(relPath)) {
      continue
    }
    if (entry.isDirectory()) {
      listFilesystemMarkdownFiles(entryPath, results)
    } else if (entry.isFile() && isMarkdown(relPath)) {
      results.push(relPath)
    }
  }
  return results
}

function candidateOldPaths() {
  return Array.from(new Set([
    ...listGitMarkdownFiles(),
    ...listFilesystemMarkdownFiles()
  ])).sort()
}

function filterMoveMapForBatch(moveMap, batch) {
  const prefixes = BATCHES.get(batch)
  if (!prefixes) {
    return new Map(Array.from(moveMap.entries()).sort(([left], [right]) => left.localeCompare(right)))
  }

  return new Map(
    Array.from(moveMap.entries())
      .filter(([oldPath]) => prefixes.some((prefix) => oldPath.startsWith(prefix)))
      .sort(([left], [right]) => left.localeCompare(right))
  )
}

function moveMaps(batch) {
  const fullMoveMap = buildMoveMap(candidateOldPaths())
  return {
    fullMoveMap,
    batchMoveMap: filterMoveMapForBatch(fullMoveMap, batch)
  }
}

function printMap(moveMap) {
  for (const [oldPath, newPath] of moveMap) {
    console.log(`${oldPath} -> ${newPath}`)
  }
}

function moveFiles(moveMap) {
  let moved = 0
  let alreadyMoved = 0
  let missing = 0

  for (const [oldPath, newPath] of moveMap) {
    if (fs.existsSync(oldPath)) {
      if (fs.existsSync(newPath)) {
        throw new Error(`Refusing to overwrite existing target: ${newPath}`)
      }
      fs.mkdirSync(path.dirname(newPath), { recursive: true })
      fs.renameSync(oldPath, newPath)
      moved += 1
    } else if (fs.existsSync(newPath)) {
      alreadyMoved += 1
    } else {
      console.warn(`Missing source and target: ${oldPath} -> ${newPath}`)
      missing += 1
    }
  }

  console.log(`Moved: ${moved}`)
  console.log(`Already moved: ${alreadyMoved}`)
  console.log(`Missing: ${missing}`)
}

function dirnamePosix(relPath) {
  const dir = path.posix.dirname(relPath)
  return dir === '.' ? '' : dir
}

function isExternalDestination(destination) {
  return /^[a-z][a-z0-9+.-]*:/i.test(destination) || destination.startsWith('//')
}

function splitAnchor(destination) {
  const hashIndex = destination.indexOf('#')
  if (hashIndex === -1) {
    return { pathPart: destination, anchor: '' }
  }
  return {
    pathPart: destination.slice(0, hashIndex),
    anchor: destination.slice(hashIndex)
  }
}

function splitLinkDestination(rawDestination) {
  if (rawDestination.startsWith('<')) {
    const closeIndex = rawDestination.indexOf('>')
    if (closeIndex !== -1) {
      return {
        destination: rawDestination.slice(1, closeIndex),
        suffix: rawDestination.slice(closeIndex + 1),
        angleWrapped: true
      }
    }
  }

  const match = rawDestination.match(/^(\S+)(.*)$/s)
  if (!match) {
    return null
  }

  return {
    destination: match[1],
    suffix: match[2],
    angleWrapped: false
  }
}

function resolveOldLinkTarget(oldSourcePath, linkedPath) {
  const normalizedLinkedPath = normalizeRelPath(linkedPath)
  if (normalizedLinkedPath.startsWith('/')) {
    return normalizeRelPath(path.posix.normalize(normalizedLinkedPath.slice(1)))
  }

  return normalizeRelPath(path.posix.normalize(path.posix.join(dirnamePosix(oldSourcePath), normalizedLinkedPath)))
}

function relativeLink(fromFilePath, targetPath) {
  const fromDir = dirnamePosix(fromFilePath)
  const relative = normalizeRelPath(path.posix.relative(fromDir || '.', targetPath))
  return relative || path.posix.basename(targetPath)
}

function moveTargetIsAvailable(oldPath, batchMoveMap, fullMoveMap) {
  const targetPath = fullMoveMap.get(oldPath)
  return Boolean(targetPath && (batchMoveMap.has(oldPath) || fs.existsSync(targetPath)))
}

function finalTargetForLink(oldSourcePath, currentPath, linkedPath, batchMoveMap, fullMoveMap) {
  const oldResolvedPath = resolveOldLinkTarget(oldSourcePath, linkedPath)
  const currentResolvedPath = resolveOldLinkTarget(currentPath, linkedPath)

  if (moveTargetIsAvailable(oldResolvedPath, batchMoveMap, fullMoveMap)) {
    return fullMoveMap.get(oldResolvedPath)
  }
  if (moveTargetIsAvailable(currentResolvedPath, batchMoveMap, fullMoveMap)) {
    return fullMoveMap.get(currentResolvedPath)
  }
  if (isTargetPath(oldResolvedPath) && fs.existsSync(oldResolvedPath)) {
    return oldResolvedPath
  }
  if (isTargetPath(currentResolvedPath) && fs.existsSync(currentResolvedPath)) {
    return currentResolvedPath
  }
  if (fs.existsSync(oldResolvedPath)) {
    return oldResolvedPath
  }
  if (fs.existsSync(currentResolvedPath)) {
    return currentResolvedPath
  }

  return undefined
}

function rewriteMarkdownLinks(content, currentPath, batchMoveMap, fullMoveMap, inverseMoveMap) {
  const oldSourcePath = inverseMoveMap.get(currentPath) ?? currentPath

  return content.replace(/(\]\()([^)]+)(\))/g, (match, open, rawDestination, close) => {
    const parsed = splitLinkDestination(rawDestination)
    if (!parsed) {
      return match
    }

    const { destination, suffix, angleWrapped } = parsed
    if (!destination || destination.startsWith('#') || isExternalDestination(destination)) {
      return match
    }

    const { pathPart, anchor } = splitAnchor(destination)
    if (!pathPart.toLowerCase().endsWith('.md')) {
      return match
    }

    const newTargetPath = finalTargetForLink(oldSourcePath, currentPath, pathPart, batchMoveMap, fullMoveMap)
    if (!newTargetPath) {
      return match
    }

    const rewritten = `${relativeLink(currentPath, newTargetPath)}${anchor}`
    const nextDestination = angleWrapped ? `<${rewritten}>${suffix}` : `${rewritten}${suffix}`
    return `${open}${nextDestination}${close}`
  })
}

function replaceInlineSegment(content, moveMap, currentPath, oldSourcePath) {
  return content.replace(/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.md/g, (pathToken) => {
    const replacement = inlineReplacementForPathToken(pathToken, moveMap, currentPath, oldSourcePath)
    return replacement ?? pathToken
  })
}

function inlineReplacementForPathToken(pathToken, moveMap, currentPath, oldSourcePath) {
  const normalizedToken = normalizeRelPath(pathToken)
  const candidatePaths = [
    normalizedToken,
    resolveOldLinkTarget(oldSourcePath, normalizedToken),
    resolveOldLinkTarget(currentPath, normalizedToken)
  ]

  for (const oldPath of new Set(candidatePaths)) {
    const newPath = moveMap.get(oldPath)
    if (newPath) {
      return normalizedToken === oldPath ? newPath : relativeLink(currentPath, newPath)
    }
  }

  return undefined
}

function replaceInlineOldPaths(content, moveMap, currentPath, inverseMoveMap) {
  const oldSourcePath = inverseMoveMap.get(currentPath) ?? currentPath
  let rewritten = ''
  let cursor = 0

  for (const match of content.matchAll(/\]\([^)]+\)/g)) {
    const destinationStart = match.index + 2
    const destinationEnd = match.index + match[0].length - 1
    rewritten += replaceInlineSegment(content.slice(cursor, destinationStart), moveMap, currentPath, oldSourcePath)
    rewritten += content.slice(destinationStart, destinationEnd)
    cursor = destinationEnd
  }

  rewritten += replaceInlineSegment(content.slice(cursor), moveMap, currentPath, oldSourcePath)
  return rewritten
}

function availableMoveMap(batchMoveMap, fullMoveMap) {
  return new Map(
    Array.from(fullMoveMap.entries())
      .filter(([oldPath, newPath]) => batchMoveMap.has(oldPath) || fs.existsSync(newPath))
  )
}

function rewriteLinks(batchMoveMap, fullMoveMap) {
  const inverseMoveMap = new Map(Array.from(fullMoveMap.entries()).map(([oldPath, newPath]) => [newPath, oldPath]))
  const inlineMoveMap = availableMoveMap(batchMoveMap, fullMoveMap)
  let changed = 0

  for (const currentPath of listFilesystemMarkdownFiles().sort()) {
    const original = fs.readFileSync(currentPath, 'utf8')
    let rewritten = rewriteMarkdownLinks(original, currentPath, batchMoveMap, fullMoveMap, inverseMoveMap)
    rewritten = replaceInlineOldPaths(rewritten, inlineMoveMap, currentPath, inverseMoveMap)

    if (rewritten !== original) {
      fs.writeFileSync(currentPath, rewritten)
      changed += 1
      console.log(`Rewrote ${currentPath}`)
    }
  }

  console.log(`Files changed: ${changed}`)
}

function checkStale(moveMap) {
  const stale = []
  const oldPaths = Array.from(moveMap.keys()).sort((left, right) => right.length - left.length)

  for (const currentPath of listFilesystemMarkdownFiles().sort()) {
    const content = fs.readFileSync(currentPath, 'utf8')
    for (const oldPath of oldPaths) {
      if (content.includes(oldPath)) {
        stale.push(`${currentPath}: ${oldPath}`)
      }
    }
  }

  if (stale.length > 0) {
    console.error('Stale restructure paths remain:')
    for (const item of stale) {
      console.error(item)
    }
    process.exitCode = 1
  } else {
    console.log('No stale restructure paths found.')
  }
}

try {
  const { mode, batch } = parseArgs(process.argv.slice(2))
  const { fullMoveMap, batchMoveMap } = moveMaps(batch)

  if (mode === '--print-map') {
    printMap(batchMoveMap)
  } else if (mode === '--move') {
    moveFiles(batchMoveMap)
  } else if (mode === '--rewrite-links') {
    rewriteLinks(batchMoveMap, fullMoveMap)
  } else if (mode === '--check-stale') {
    checkStale(batchMoveMap)
  }
} catch (error) {
  console.error(error.message)
  usage()
  process.exitCode = 1
}
