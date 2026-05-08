import { defineConfig } from 'vitepress'
import { buildNav, buildSidebar } from './navigation.mjs'

export default defineConfig({
  lang: 'en-US',
  title: 'Industry Research',
  description: 'Autonomous vehicle technology and airport airside operations research library.',
  base: '/industry-research/',
  cleanUrls: true,
  rewrites: {
    'README.md': 'index.md',
    'INDEX.md': 'INDEX/index.md'
  },
  srcExclude: [
    'docs/superpowers/**',
    '.claude/**',
    '.superpowers/**',
    'node_modules/**'
  ],
  markdown: {
    attrs: {
      disable: true
    }
  },
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#0f172a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Industry Research' }],
    ['meta', { property: 'og:description', content: 'Autonomous vehicle technology and airport airside operations research library.' }]
  ],
  themeConfig: {
    nav: buildNav(),
    sidebar: buildSidebar(),
    outline: {
      level: [2, 3],
      label: 'On this page'
    },
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: {
              title: 4,
              text: 2,
              titles: 1
            }
          }
        }
      }
    },
    editLink: {
      pattern: 'https://github.com/kvynlim/industry-research/blob/main/:path',
      text: 'View source on GitHub'
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next'
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/kvynlim/industry-research' }
    ],
    footer: {
      message: 'Public research notes collected from public sources.',
      copyright: 'Copyright © 2026 kvynlim'
    }
  }
})
