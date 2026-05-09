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
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true/)
  assert.match(workflow, /contents: read/)
  assert.match(workflow, /pages: write/)
  assert.match(workflow, /id-token: write/)
  assert.match(workflow, /actions\/checkout@v6/)
  assert.match(workflow, /actions\/setup-node@v6/)
  assert.match(workflow, /node-version: 24/)
  assert.match(workflow, /cache: npm/)
  assert.match(workflow, /actions\/configure-pages@v6/)
  assert.match(workflow, /run: npm ci/)
  assert.match(workflow, /run: npm run docs:build/)
  assert.match(workflow, /actions\/upload-pages-artifact@v5/)
  assert.match(workflow, /path: \.vitepress\/dist/)
  assert.match(workflow, /needs: build/)
  assert.match(workflow, /environment:/)
  assert.match(workflow, /name: github-pages/)
  assert.match(workflow, /actions\/deploy-pages@v5/)
})
