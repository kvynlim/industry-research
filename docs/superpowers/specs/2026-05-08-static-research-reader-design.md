# Static Research Reader Design

## Context

The repository is a public-ready autonomous vehicle industry research library with 247 Markdown documents across companies, technology, operations, hardware, foundations, cross-cutting topics, and synthesis material. The current reading experience is repository-centric: users navigate folders and raw Markdown files rather than a browser-optimized documentation portal.

The selected direction is a public static documentation portal that can be deployed on GitHub Pages and accessed anywhere. The research Markdown files remain the source of truth.

## Goals

- Publish the research as a static website from a public GitHub repository.
- Preserve the existing Markdown-first repo structure and avoid materially rewriting research content.
- Provide a documentation-style reading experience with persistent navigation, search, article rendering, and table of contents.
- Support local preview during authoring and automated deployment to GitHub Pages on push.
- Keep runtime hosting backend-free so the site works on GitHub Pages.

## Non-Goals

- Do not build a custom backend, database, authentication system, or CMS.
- Do not build a dashboard-first analytics app for the first release.
- Do not replace the existing Markdown documents with a new content format.
- Do not make public/private access controls part of the site itself; GitHub repository visibility controls publication.

## Architecture

Use a static documentation framework, with VitePress as the recommended implementation choice. VitePress is documentation-native, handles Markdown well, supports static generation, has a straightforward GitHub Pages deployment path, and fits the selected documentation portal UX.

Build-time processing scans the repository Markdown files, renders them into static pages, generates navigation metadata, and builds a static search index. Runtime behavior is entirely browser-side: the GitHub Pages site serves prebuilt HTML, CSS, JavaScript, navigation data, and search assets.

The expected public URL shape is:

```text
https://<github-username>.github.io/industry-research/
```

The site configuration must therefore account for the `/industry-research/` base path.

## Components

### Docs Shell

The shell provides the main browser UI:

- Top navigation with site title and search.
- Persistent left sidebar on desktop.
- Main article reading area.
- Right-side table of contents on desktop.
- Collapsed sidebar and table of contents controls on mobile.

### Generated Navigation

Navigation should map the existing repository structure into clear sections:

- Synthesis
- Companies
- Technology
- Operations
- Hardware
- Foundations
- Cross-Cutting
- Glossary
- Methodology
- Index

The initial implementation can generate or configure sidebar groups from the directory structure. Document titles should come from the first Markdown `#` heading when available, with a filename-derived fallback when a heading is missing.

### Reader Pages

Each Markdown document renders as an article page with:

- Heading anchors.
- Table support.
- Code block support.
- Previous and next navigation where available.
- A source link back to the GitHub file.
- Stable routing that works under the GitHub Pages base path.

### Search

Search must be static and client-side. It should index:

- Document title.
- Document path.
- Headings.
- Body text snippets.

Known search terms for acceptance testing include `Waymo`, `world models`, `ISO 3691-4`, and `Orin`.

### Homepage

The homepage should stay documentation-portal oriented rather than dashboard-heavy. It should provide:

- A concise project introduction.
- Start-here links based on the existing `README.md` quick start section.
- Category links for the major research areas.
- Links to `INDEX.md`, `synthesis/master-synthesis.md`, and `synthesis/getting-started.md`.

## Data Flow

Build-time flow:

```text
Markdown files
  -> static site generator
  -> sidebar/navigation metadata
  -> rendered static pages
  -> static search index
  -> GitHub Pages artifact
```

Runtime flow:

```text
Browser opens GitHub Pages URL
  -> loads static shell
  -> loads current article/page assets
  -> search reads local static index
  -> navigation changes routes without backend calls
```

Internal links should resolve across existing Markdown files. Links that break under the static-site routing rules should either be fixed in the source Markdown or handled by a link transform during build.

## Error Handling And UX States

- Provide a 404 page with a search affordance and links back to `README.md`, `INDEX.md`, and `synthesis/master-synthesis.md`.
- Enable build-time broken-link checks where the framework supports them.
- For missing page titles, use the first `#` heading and fall back to the filename.
- Keep the right-side table of contents sticky and scrollable for long documents.
- Provide a clear empty state when search returns no results.
- Ensure mobile navigation collapses cleanly and preserves readable article text.

## Deployment

GitHub Actions should build the static site on pushes to the main branch and publish it to GitHub Pages. Local development remains available for preview, but site access should not depend on `npm run dev` after deployment.

The deployment must:

- Build with the GitHub Pages base path.
- Upload only the generated static site artifact.
- Avoid committing generated build output unless the chosen deployment method requires it.

## Testing And Acceptance

The implementation is complete when:

- The local development server renders the portal.
- The production build succeeds.
- The GitHub Pages workflow exists and is configured for the repository.
- Top-level docs are reachable: `README.md`, `INDEX.md`, `GLOSSARY.md`, and `METHODOLOGY.md`.
- Representative nested docs render correctly from `synthesis/`, `companies/`, `technology/`, `operations/`, `hardware/`, `foundations/`, and `cross-cutting/`.
- Search works for `Waymo`, `world models`, `ISO 3691-4`, and `Orin`.
- Internal links work under the `/industry-research/` base path.
- A mobile viewport provides usable navigation and readable article text.
- No source research content is deleted or materially rewritten.

Recommended verification commands and checks:

- Install dependencies.
- Run the local development server for a smoke check.
- Run the production build.
- Review link and build warnings.
- Optionally run a Playwright desktop and mobile screenshot check once the portal exists.

## Risks And Decisions

- The main publication risk is not technical; making the repository public exposes all current documents and repository history.
- Search index size should be watched because the repo is large. The index should be compact enough for browser use.
- VitePress is selected for the first implementation because it matches the documentation-portal direction and minimizes custom UI work.
- A dashboard or explorer layer can be added later if the documentation portal proves insufficient for discovery.
