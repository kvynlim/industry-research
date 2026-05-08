#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const SKIP_PREFIXES = [
  'node_modules/',
  '.git/',
  '.vitepress/dist/',
  'docs/superpowers/'
]

function normalizeRelPath(relPath) {
  let normalized = String(relPath).replaceAll(path.win32.sep, path.posix.sep)
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  return normalized
}

function isSkipped(relPath) {
  const normalized = normalizeRelPath(relPath)
  return SKIP_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))
}

function listMarkdownFiles(dir = '.', results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    const relPath = normalizeRelPath(path.relative('.', entryPath))
    if (isSkipped(relPath)) {
      continue
    }
    if (entry.isDirectory()) {
      listMarkdownFiles(entryPath, results)
    } else if (entry.isFile() && relPath.toLowerCase().endsWith('.md')) {
      results.push(relPath)
    }
  }
  return results
}

function isExternalDestination(destination) {
  return /^[a-z][a-z0-9+.-]*:/i.test(destination) || destination.startsWith('//')
}

function splitDestination(rawDestination) {
  if (rawDestination.startsWith('<')) {
    const closeIndex = rawDestination.indexOf('>')
    if (closeIndex !== -1) {
      return rawDestination.slice(1, closeIndex)
    }
  }

  const match = rawDestination.match(/^(\S+)/)
  return match?.[1] ?? ''
}

function stripAnchor(destination) {
  const hashIndex = destination.indexOf('#')
  return hashIndex === -1 ? destination : destination.slice(0, hashIndex)
}

function dirnamePosix(relPath) {
  const dir = path.posix.dirname(relPath)
  return dir === '.' ? '' : dir
}

function resolveLocalTarget(sourcePath, linkedPath) {
  const normalizedLinkedPath = normalizeRelPath(linkedPath)
  if (normalizedLinkedPath.startsWith('/')) {
    return normalizeRelPath(path.posix.normalize(normalizedLinkedPath.slice(1)))
  }
  return normalizeRelPath(path.posix.normalize(path.posix.join(dirnamePosix(sourcePath), normalizedLinkedPath)))
}

const missing = []

for (const sourcePath of listMarkdownFiles().sort()) {
  const content = fs.readFileSync(sourcePath, 'utf8')
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const destination = splitDestination(match[1])
    if (!destination || destination.startsWith('#') || isExternalDestination(destination)) {
      continue
    }

    const linkedPath = stripAnchor(destination)
    if (!linkedPath.toLowerCase().endsWith('.md')) {
      continue
    }

    const targetPath = resolveLocalTarget(sourcePath, linkedPath)
    if (!fs.existsSync(targetPath)) {
      missing.push(`${sourcePath}: ${destination} -> ${targetPath}`)
    }
  }
}

if (missing.length > 0) {
  console.error('Missing local Markdown link targets:')
  for (const item of missing) {
    console.error(item)
  }
  process.exitCode = 1
} else {
  console.log('No missing local Markdown link targets.')
}
