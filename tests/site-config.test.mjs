import test from 'node:test'
import assert from 'node:assert/strict'

import configModule from '../.vitepress/config.mjs'

const config = configModule.default ?? configModule

test('sets GitHub Pages base path and clean URLs', () => {
  assert.equal(config.base, '/industry-research/')
  assert.equal(config.cleanUrls, true)
})

test('rewrites README as homepage and INDEX as a directory route', () => {
  assert.deepEqual(config.rewrites, {
    'README.md': 'index.md',
    'INDEX.md': 'INDEX/index.md'
  })
})

test('disables markdown attrs so math braces in research notes render as text', () => {
  assert.equal(config.markdown.attrs.disable, true)
})

test('excludes non-public implementation and planning files from page generation', () => {
  assert.ok(config.srcExclude.includes('docs/superpowers/**'))
  assert.ok(config.srcExclude.includes('.claude/**'))
  assert.ok(config.srcExclude.includes('.superpowers/**'))
  assert.ok(config.srcExclude.includes('node_modules/**'))
})

test('enables local static search', () => {
  assert.equal(config.themeConfig.search.provider, 'local')
  assert.equal(config.themeConfig.search.options.miniSearch.searchOptions.prefix, true)
  assert.equal(config.themeConfig.search.options.miniSearch.searchOptions.boost.title, 4)
})

test('configures repository source links', () => {
  assert.equal(
    config.themeConfig.editLink.pattern,
    'https://github.com/kvynlim/industry-research/blob/main/:path'
  )
  assert.equal(config.themeConfig.editLink.text, 'View source on GitHub')
})

test('provides sidebar and top nav entries', () => {
  assert.ok(config.themeConfig.nav.some((item) => item.link === '/INDEX/'))
  assert.ok(config.themeConfig.sidebar.some((section) => section.text === 'Technology'))
})
