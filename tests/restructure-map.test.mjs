import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildMoveMap,
  normalizeRelPath,
  shouldMove,
  targetPathFor
} from '../tools/restructure/path-map.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrateScript = path.join(repoRoot, 'tools/restructure/migrate.mjs')
const checkLinksScript = path.join(repoRoot, 'tools/restructure/check-links.mjs')

test('maps knowledge-base fundamentals', () => {
  assert.equal(
    targetPathFor('foundations/gtsam-factor-graphs.md'),
    '10-knowledge-base/state-estimation/gtsam-factor-graphs.md'
  )
  assert.equal(
    targetPathFor('foundations/pointpillars.md'),
    '10-knowledge-base/geometry-3d/pointpillars.md'
  )
})

test('maps AV platform hardware', () => {
  assert.equal(
    targetPathFor('hardware/compute/nvidia-orin-technical.md'),
    '20-av-platform/compute/nvidia-orin-technical.md'
  )
  assert.equal(
    targetPathFor('hardware/connectivity/airport-5g-cbrs.md'),
    '20-av-platform/networking-connectivity/airport-5g-cbrs.md'
  )
  assert.equal(
    targetPathFor('hardware/vehicle/can-bus-dbw.md'),
    '20-av-platform/drive-by-wire/can-bus-dbw.md'
  )
})

test('maps autonomy stack method libraries', () => {
  assert.equal(
    targetPathFor('technology/perception/methods/bevdepth.md'),
    '30-autonomy-stack/perception/methods/bevdepth.md'
  )
  assert.equal(
    targetPathFor('technology/localization/slam/glim.md'),
    '30-autonomy-stack/localization-mapping/slam-methods/glim.md'
  )
})

test('maps runtime, cloud, safety, operations, industry, and synthesis split files', () => {
  assert.equal(
    targetPathFor('cross-cutting/ros2-migration.md'),
    '40-runtime-systems/ros-autoware/ros2-migration.md'
  )
  assert.equal(
    targetPathFor('cross-cutting/cloud-backend-infrastructure.md'),
    '50-cloud-fleet/data-platform/cloud-backend-infrastructure.md'
  )
  assert.equal(
    targetPathFor('operations/safety/iso-3691-4-deep-dive.md'),
    '60-safety-validation/standards-certification/iso-3691-4-deep-dive.md'
  )
  assert.equal(
    targetPathFor('operations/airside/fod-and-jetblast.md'),
    '70-operations-domains/airside/operations/fod-and-jetblast.md'
  )
  assert.equal(
    targetPathFor('companies/waymo/tech-stack.md'),
    '80-industry-intel/companies/waymo/tech-stack.md'
  )
  assert.equal(
    targetPathFor('synthesis/master-synthesis.md'),
    '90-synthesis/master/master-synthesis.md'
  )
})

test('normalizes paths and only moves Markdown under old content roots', () => {
  assert.equal(normalizeRelPath('.\\.\\foundations\\pointpillars.md'), 'foundations/pointpillars.md')
  assert.equal(shouldMove('foundations/pointpillars.md'), true)
  assert.equal(shouldMove('README.md'), false)
  assert.equal(shouldMove('docs/superpowers/plans/example.md'), false)
  assert.equal(shouldMove('foundations/not-markdown.txt'), false)
  assert.throws(
    () => targetPathFor('operations/deployment/unmapped.md'),
    /No restructure target for operations\/deployment\/unmapped\.md/
  )
})

test('builds move maps only for paths with restructure targets', () => {
  const moveMap = buildMoveMap([
    './README.md',
    'foundations\\pointpillars.md',
    '10-knowledge-base/state-estimation/gtsam-factor-graphs.md',
    'hardware/vehicle/can-bus-dbw.md',
    'technology/perception/methods/bevdepth.md'
  ])

  assert.deepEqual(Array.from(moveMap.entries()), [
    ['foundations/pointpillars.md', '10-knowledge-base/geometry-3d/pointpillars.md'],
    ['foundations/gtsam-factor-graphs.md', '10-knowledge-base/state-estimation/gtsam-factor-graphs.md'],
    ['hardware/vehicle/can-bus-dbw.md', '20-av-platform/drive-by-wire/can-bus-dbw.md'],
    ['technology/perception/methods/bevdepth.md', '30-autonomy-stack/perception/methods/bevdepth.md']
  ])
})

test('rewrites links correctly through staged migration batches', () => {
  const fixtureDir = makeFixture({
    'foundations/gtsam-factor-graphs.md': '# GTSAM\n',
    'technology/perception/production-perception-systems.md': [
      '# Perception',
      '',
      '[GTSAM](../../foundations/gtsam-factor-graphs.md)'
    ].join('\n'),
    'companies/comma-ai/production-world-model.md': '# Comma world model\n'
  })

  runMigrate(fixtureDir, '--move', 'knowledge-platform')
  runMigrate(fixtureDir, '--rewrite-links', 'knowledge-platform')
  runMigrate(fixtureDir, '--move', 'autonomy')
  runMigrate(fixtureDir, '--rewrite-links', 'autonomy')

  const movedPerception = path.join(
    fixtureDir,
    '30-autonomy-stack/perception/overview/production-perception-systems.md'
  )
  assert.match(
    fs.readFileSync(movedPerception, 'utf8'),
    /\[GTSAM\]\(\.\.\/\.\.\/\.\.\/10-knowledge-base\/state-estimation\/gtsam-factor-graphs\.md\)/
  )

  execFileSync(process.execPath, [checkLinksScript], { cwd: fixtureDir })
})

test('does not double-rewrite company links inside already rewritten Markdown destinations', () => {
  const fixtureDir = makeFixture({
    'companies/comma-ai/production-world-model.md': '# Comma world model\n',
    'synthesis/master-synthesis.md': [
      '# Master synthesis',
      '',
      '[Comma](../companies/comma-ai/production-world-model.md)',
      '',
      'Already final: 80-industry-intel/companies/comma-ai/production-world-model.md'
    ].join('\n')
  })

  runMigrate(fixtureDir, '--move', 'industry-synthesis')
  runMigrate(fixtureDir, '--rewrite-links', 'industry-synthesis')

  const movedSynthesis = path.join(fixtureDir, '90-synthesis/master/master-synthesis.md')
  const content = fs.readFileSync(movedSynthesis, 'utf8')
  assert.match(
    content,
    /\[Comma\]\(\.\.\/\.\.\/80-industry-intel\/companies\/comma-ai\/production-world-model\.md\)/
  )
  assert.doesNotMatch(content, /80-industry-intel\/80-industry-intel/)

  execFileSync(process.execPath, [checkLinksScript], { cwd: fixtureDir })
})

test('rewrites relative stale old paths outside moved batches', () => {
  const fixtureDir = makeFixture({
    'hardware/compute/foo.md': '# Compute\n',
    'hardware/connectivity/airport-5g-cbrs.md': '# Airport 5G\n',
    'operations/deployment/ev-fleet-energy-co-optimization.md': [
      '# EV fleet energy',
      '',
      '[../../hardware/connectivity/airport-5g-cbrs.md](../../hardware/connectivity/airport-5g-cbrs.md)',
      '',
      '`../../hardware/compute/foo.md`'
    ].join('\n')
  })

  runMigrate(fixtureDir, '--move', 'knowledge-platform')
  runMigrate(fixtureDir, '--rewrite-links', 'knowledge-platform')
  runMigrate(fixtureDir, '--check-stale', 'knowledge-platform')

  const sourcePath = path.join(fixtureDir, 'operations/deployment/ev-fleet-energy-co-optimization.md')
  const content = fs.readFileSync(sourcePath, 'utf8')
  assert.doesNotMatch(content, /hardware\/connectivity\/airport-5g-cbrs\.md/)
  assert.doesNotMatch(content, /hardware\/compute\/foo\.md/)
  assert.match(
    content,
    /\[\.\.\/\.\.\/20-av-platform\/networking-connectivity\/airport-5g-cbrs\.md\]\(\.\.\/\.\.\/20-av-platform\/networking-connectivity\/airport-5g-cbrs\.md\)/
  )
  assert.match(content, /`\.\.\/\.\.\/20-av-platform\/compute\/foo\.md`/)

  execFileSync(process.execPath, [checkLinksScript], { cwd: fixtureDir })
})

function makeFixture(files) {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restructure-map-'))
  for (const [relPath, content] of Object.entries(files)) {
    const filePath = path.join(fixtureDir, relPath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }
  return fixtureDir
}

function runMigrate(cwd, mode, batch) {
  execFileSync(process.execPath, [migrateScript, mode, '--batch', batch], { cwd })
}
