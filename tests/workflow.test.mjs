import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workflowPath = path.join(repoRoot, '.github/workflows/deploy.yml')

test('GitHub Pages workflow exists', () => {
  assert.ok(fs.existsSync(workflowPath))
})

test('GitHub Pages workflow builds and deploys the VitePress artifact', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8')

  assert.match(workflow, /name: Deploy VitePress site to Pages/)
  assert.match(workflow, /branches: \[main\]/)
  assert.match(workflow, /pages: write/)
  assert.match(workflow, /id-token: write/)
  assert.match(workflow, /node-version: 24/)
  assert.match(workflow, /run: npm ci/)
  assert.match(workflow, /run: npm run docs:build/)
  assert.match(workflow, /path: \.vitepress\/dist/)
  assert.match(workflow, /actions\/deploy-pages@v4/)
})
