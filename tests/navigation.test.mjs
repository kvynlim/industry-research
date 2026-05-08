import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildNav,
  buildSidebar,
  linkForMarkdown,
  titleFromMarkdown,
  titleFromPath
} from '../.vitepress/navigation.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('extracts the first H1 as the document title', () => {
  assert.equal(
    titleFromMarkdown('# World Models\n\nBody text', 'fallback-file.md'),
    'World Models'
  )
})

test('falls back to readable filename title when H1 is missing', () => {
  assert.equal(titleFromMarkdown('Body only', 'nvidia-drive-thor.md'), 'NVIDIA Drive Thor')
  assert.equal(titleFromPath('iso-3691-4-deep-dive.md'), 'ISO 3691 4 Deep Dive')
})

test('normalizes windows-style paths before deriving readable titles', () => {
  assert.equal(titleFromPath('technology\\world-models\\overview.md'), 'Overview')
})

test('converts markdown file paths into VitePress links', () => {
  assert.equal(linkForMarkdown('README.md'), '/')
  assert.equal(linkForMarkdown('INDEX.md'), '/INDEX/')
  assert.equal(
    linkForMarkdown('technology/world-models/overview.md'),
    '/technology/world-models/overview'
  )
})

test('builds top navigation for the public portal', () => {
  assert.deepEqual(buildNav(), [
    { text: 'Home', link: '/' },
    { text: 'Index', link: '/INDEX/' },
    { text: 'Synthesis', link: '/synthesis/master-synthesis' },
    { text: 'GitHub', link: 'https://github.com/kvynlim/industry-research' }
  ])
})

test('builds sidebar groups from the existing repository folders', () => {
  const sidebar = buildSidebar(repoRoot)
  const sectionNames = sidebar.map((section) => section.text)

  assert.deepEqual(sectionNames, [
    'Start Here',
    'Synthesis',
    'Companies',
    'Technology',
    'Operations',
    'Hardware',
    'Foundations',
    'Cross-Cutting'
  ])

  const startHere = sidebar.find((section) => section.text === 'Start Here')
  assert.ok(startHere.items.some((item) => item.link === '/'))
  assert.ok(startHere.items.some((item) => item.link === '/INDEX/'))
  assert.ok(startHere.items.some((item) => item.link === '/GLOSSARY'))
  assert.ok(startHere.items.some((item) => item.link === '/METHODOLOGY'))

  const technology = sidebar.find((section) => section.text === 'Technology')
  assert.ok(technology.items.some((item) => item.text === 'World Models'))
  assert.ok(technology.items.some((item) => item.text === 'Perception'))
})

test('does not include planning/spec files as public research pages', () => {
  const sidebarJson = JSON.stringify(buildSidebar(repoRoot))
  assert.equal(sidebarJson.includes('superpowers'), false)
})

test('required source directories exist before navigation is generated', () => {
  for (const dir of ['companies', 'technology', 'operations', 'hardware', 'foundations', 'cross-cutting', 'synthesis']) {
    assert.ok(fs.existsSync(path.join(repoRoot, dir)), `${dir} should exist`)
  }
})

test('throws when required source directories are missing', () => {
  const missingRoot = path.join(repoRoot, 'not-a-real-root')

  assert.throws(
    () => buildSidebar(missingRoot),
    /Missing required documentation directory: synthesis/
  )
})
