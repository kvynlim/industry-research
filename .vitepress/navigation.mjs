import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(configDir, '..')

const SECTION_ORDER = [
  { dir: '10-knowledge-base', text: 'Knowledge Base', collapsed: true },
  { dir: '20-av-platform', text: 'AV Platform', collapsed: true },
  { dir: '30-autonomy-stack', text: 'Autonomy Stack', collapsed: true },
  { dir: '40-runtime-systems', text: 'Runtime Systems', collapsed: true },
  { dir: '50-cloud-fleet', text: 'Cloud Fleet', collapsed: true },
  { dir: '60-safety-validation', text: 'Safety Validation', collapsed: true },
  { dir: '70-operations-domains', text: 'Operations Domains', collapsed: true },
  { dir: '80-industry-intel', text: 'Industry Intel', collapsed: true },
  { dir: '90-synthesis', text: 'Synthesis', collapsed: false }
]

const START_FILES = [
  { rel: 'README.md', text: 'Home', link: '/' },
  { rel: '00-start-here/reading-guide.md', text: 'Reading Guide' },
  { rel: '00-start-here/repo-map.md', text: 'Repository Map' },
  { rel: '00-start-here/glossary.md', text: 'Glossary Entry Point' },
  { rel: '00-start-here/methodology.md', text: 'Methodology Entry Point' },
  { rel: 'INDEX.md', text: 'Research Index' },
  { rel: 'GLOSSARY.md', text: 'Glossary' },
  { rel: 'METHODOLOGY.md', text: 'Methodology' }
]

const PRIORITY_RATING_LINKS = [
  {
    text: 'Perception Method Ratings',
    link: '/30-autonomy-stack/perception/methods/overview'
  },
  {
    text: 'SLAM Method Ratings',
    link: '/30-autonomy-stack/localization-mapping/slam-methods/overview'
  }
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

function overviewFileRel(root, relDir) {
  const candidate = joinRel(relDir, 'overview.md')
  return pathExists(root, candidate) ? candidate : null
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
  const files = entries
    .filter((entry) => entry.isFile() && isMarkdownFile(entry.name))
    .sort((a, b) => {
      return a.name.localeCompare(b.name, 'en')
    })
  const overviewFile = files.find((entry) => entry.name === 'overview.md') ?? null
  const regularFiles = files.filter((entry) => entry.name !== 'overview.md')

  const directoryItems = directories
    .map((entry) => {
      const childRel = joinRel(relDir, entry.name)
      const childItems = buildDirectoryItems(root, childRel)
      if (childItems.length === 0) return null

      const item = {
        text: titleFromPath(entry.name),
        collapsed: true,
        items: childItems
      }

      const overviewRel = overviewFileRel(root, childRel)
      if (overviewRel) item.link = linkForMarkdown(overviewRel)

      return item
    })
    .filter(Boolean)

  const fileItems = regularFiles.map((entry) => {
    const fileRel = joinRel(relDir, entry.name)
    return {
      text: titleForFile(root, fileRel),
      link: linkForMarkdown(fileRel)
    }
  })

  const overviewItem = overviewFile
    ? {
        text: titleForFile(root, joinRel(relDir, overviewFile.name)),
        link: linkForMarkdown(joinRel(relDir, overviewFile.name))
      }
    : null

  return [overviewItem].concat(directoryItems, fileItems).filter(Boolean)
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
    },
    {
      text: 'Priority Ratings',
      collapsed: false,
      items: PRIORITY_RATING_LINKS
    }
  ]

  for (const section of SECTION_ORDER) {
    const items = buildDirectoryItems(root, section.dir)
    sidebar.push({
      text: section.text,
      collapsed: section.collapsed,
      items
    })
  }

  return sidebar
}

export function buildNav() {
  return [
    { text: 'Home', link: '/' },
    { text: 'Index', link: '/INDEX/' },
    {
      text: 'Autonomy Stack',
      link: '/30-autonomy-stack/perception/overview/production-perception-systems'
    },
    { text: 'Synthesis', link: '/90-synthesis/master/master-synthesis' },
    { text: 'GitHub', link: 'https://github.com/kvynlim/industry-research' }
  ]
}
