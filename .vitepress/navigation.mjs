import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(configDir, '..')

const SECTION_ORDER = [
  { dir: 'synthesis', text: 'Synthesis', collapsed: false },
  { dir: 'companies', text: 'Companies', collapsed: true },
  { dir: 'technology', text: 'Technology', collapsed: true },
  { dir: 'operations', text: 'Operations', collapsed: true },
  { dir: 'hardware', text: 'Hardware', collapsed: true },
  { dir: 'foundations', text: 'Foundations', collapsed: true },
  { dir: 'cross-cutting', text: 'Cross-Cutting', collapsed: true }
]

const START_FILES = [
  { rel: 'README.md', text: 'Home', link: '/' },
  { rel: 'INDEX.md', text: 'Research Index' },
  { rel: 'GLOSSARY.md', text: 'Glossary' },
  { rel: 'METHODOLOGY.md', text: 'Methodology' }
]

const ACRONYMS = new Map([
  ['ai', 'AI'],
  ['av', 'AV'],
  ['bev', 'BEV'],
  ['can', 'CAN'],
  ['cbrs', 'CBRS'],
  ['ci', 'CI'],
  ['cicd', 'CI/CD'],
  ['dbw', 'DBW'],
  ['e2e', 'E2E'],
  ['ev', 'EV'],
  ['faa', 'FAA'],
  ['fod', 'FOD'],
  ['gse', 'GSE'],
  ['gps', 'GPS'],
  ['gtsam', 'GTSAM'],
  ['hd', 'HD'],
  ['hmi', 'HMI'],
  ['imu', 'IMU'],
  ['ir', 'IR'],
  ['iso', 'ISO'],
  ['jepa', 'JEPA'],
  ['lidar', 'LiDAR'],
  ['llm', 'LLM'],
  ['ml', 'ML'],
  ['nvidia', 'NVIDIA'],
  ['odd', 'ODD'],
  ['orin', 'Orin'],
  ['ota', 'OTA'],
  ['poc', 'POC'],
  ['rl', 'RL'],
  ['ros2', 'ROS 2'],
  ['rtk', 'RTK'],
  ['slam', 'SLAM'],
  ['sota', 'SOTA'],
  ['tco', 'TCO'],
  ['tsn', 'TSN'],
  ['v2x', 'V2X'],
  ['vla', 'VLA'],
  ['vlm', 'VLM']
])

function joinRel(...parts) {
  return parts.filter(Boolean).join('/')
}

function isMarkdownFile(name) {
  return name.toLowerCase().endsWith('.md')
}

function pathExists(root, rel) {
  return fs.existsSync(path.join(root, rel))
}

export function titleFromPath(relPath) {
  const normalized = relPath.replace(/\\/g, '/')
  const base = path.posix.basename(normalized, path.posix.extname(normalized))

  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => ACRONYMS.get(word.toLowerCase()) ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function titleFromMarkdown(markdown, fallbackPath) {
  const h1 = markdown.match(/^#\s+(.+)$/m)
  if (!h1) return titleFromPath(fallbackPath)

  return h1[1].replace(/\s+#*$/, '').trim()
}

export function titleForFile(root, relPath) {
  const absPath = path.join(root, relPath)
  const markdown = fs.readFileSync(absPath, 'utf8')
  return titleFromMarkdown(markdown, relPath)
}

export function linkForMarkdown(relPath) {
  const normalized = relPath.replace(/\\/g, '/')
  if (normalized.toLowerCase() === 'readme.md') return '/'
  if (normalized === 'INDEX.md') return '/INDEX/'
  return `/${normalized.replace(/\.md$/i, '')}`
}

function directoryEntries(root, relDir) {
  const absDir = path.join(root, relDir)
  if (!fs.existsSync(absDir)) return []

  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

export function buildDirectoryItems(root, relDir) {
  const entries = directoryEntries(root, relDir)
  const directories = entries.filter((entry) => entry.isDirectory())
  const files = entries.filter((entry) => entry.isFile() && isMarkdownFile(entry.name))

  const directoryItems = directories
    .map((entry) => {
      const childRel = joinRel(relDir, entry.name)
      const childItems = buildDirectoryItems(root, childRel)
      if (childItems.length === 0) return null

      return {
        text: titleFromPath(entry.name),
        collapsed: true,
        items: childItems
      }
    })
    .filter(Boolean)

  const fileItems = files.map((entry) => {
    const fileRel = joinRel(relDir, entry.name)
    return {
      text: titleForFile(root, fileRel),
      link: linkForMarkdown(fileRel)
    }
  })

  return [...directoryItems, ...fileItems]
}

export function buildSidebar(root = repoRoot) {
  for (const section of SECTION_ORDER) {
    const absDir = path.join(root, section.dir)
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
      throw new Error(`Missing required documentation directory: ${section.dir}`)
    }
  }

  const startItems = START_FILES
    .filter((file) => pathExists(root, file.rel))
    .map((file) => ({
      text: file.text ?? titleForFile(root, file.rel),
      link: file.link ?? linkForMarkdown(file.rel)
    }))

  const sidebar = [
    {
      text: 'Start Here',
      collapsed: false,
      items: startItems
    }
  ]

  for (const section of SECTION_ORDER) {
    const items = buildDirectoryItems(root, section.dir)
    if (items.length > 0) {
      sidebar.push({
        text: section.text,
        collapsed: section.collapsed,
        items
      })
    }
  }

  return sidebar
}

export function buildNav() {
  return [
    { text: 'Home', link: '/' },
    { text: 'Index', link: '/INDEX/' },
    { text: 'Synthesis', link: '/synthesis/master-synthesis' },
    { text: 'GitHub', link: 'https://github.com/kvynlim/industry-research' }
  ]
}
