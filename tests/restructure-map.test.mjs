import test from 'node:test'
import assert from 'node:assert/strict'

import { targetPathFor } from '../tools/restructure/path-map.mjs'

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
