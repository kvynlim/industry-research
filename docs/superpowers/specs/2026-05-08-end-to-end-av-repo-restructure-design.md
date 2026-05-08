# End-to-End AV Repo Restructure Design

## Purpose

Restructure this repository from a collection of research topic folders into a long-term end-to-end autonomous-vehicle knowledge architecture. The repo should support generic AV applications across road, airside, indoor, outdoor campus, and warehouse domains. It should cover the whole stack: fundamentals, vehicle hardware, sensors, onboard autonomy software, runtime systems, cloud/fleet systems, mapping, safety, validation, operations, industry intelligence, and synthesis.

The restructure is a physical file move. Existing Markdown files should move into a cleaner directory tree, with links, navigation, counts, and methodology updated afterward.

## Current Problem

The current top-level layout is useful but underspecified for the repo's expanded purpose:

```text
companies/
cross-cutting/
foundations/
hardware/
operations/
synthesis/
technology/
```

This creates several issues:

- `technology/` has become too broad and now contains autonomy algorithms, runtime software, mapping, simulation, world models, VLA/VLM, perception methods, planning, and multi-agent systems.
- `cross-cutting/` mixes runtime implementation, cloud data platforms, datasets, ROS, Autoware, and data-engine concepts.
- `operations/` mixes airside operations, deployment, safety, certification, teleoperation, and workforce topics.
- `foundations/` is valuable but should become a broader knowledge base for fundamental principles that support the whole stack.
- Indoor/outdoor mapping and operations need room as first-class domains instead of being buried under localization.
- The repo is becoming an AV stack reference, not only a research dump.

## Design Goals

1. Make the directory tree match the end-to-end AV stack.
2. Preserve method-level research pages for perception and SLAM.
3. Create a durable `10-knowledge-base/` area for fundamentals and principles.
4. Separate onboard autonomy, runtime systems, cloud/fleet systems, safety validation, operations domains, and industry intelligence.
5. Keep root-level `README.md`, `INDEX.md`, `METHODOLOGY.md`, and `GLOSSARY.md` as stable entry points for GitHub and VitePress.
6. Make future additions easy to classify without reviving a vague `cross-cutting/` bucket.
7. Support generic AV applications, including airside, road AV, indoor warehouse, outdoor campus, and mapping across indoor/outdoor contexts.

## Non-Goals

- Do not rewrite all research content during the restructure.
- Do not collapse method-level perception or SLAM files back into broad overview files.
- Do not introduce a database or non-Markdown content model.
- Do not optimize the visual design of the VitePress site in this restructure.
- Do not remove historical company or deployment research; move it into a clearer industry/domain structure.

## Target Top-Level Structure

```text
00-start-here/
10-knowledge-base/
20-av-platform/
30-autonomy-stack/
40-runtime-systems/
50-cloud-fleet/
60-safety-validation/
70-operations-domains/
80-industry-intel/
90-synthesis/
README.md
INDEX.md
METHODOLOGY.md
GLOSSARY.md
package.json
tests/
.vitepress/
.github/
docs/superpowers/
```

The numeric prefixes make the reading order clear and keep the generated sidebar stable.

## Directory Responsibilities

### 00-start-here

Entry and orientation material that explains how to read the corpus.

```text
00-start-here/
  reading-guide.md
  repo-map.md
  methodology.md
  glossary.md
```

Root-level `README.md`, `INDEX.md`, `METHODOLOGY.md`, and `GLOSSARY.md` remain as compatibility entry points. They may duplicate or link to the canonical files in `00-start-here/`.

### 10-knowledge-base

Fundamental principles that support the entire stack. This replaces and expands the current `foundations/` role.

```text
10-knowledge-base/
  robotics/
  state-estimation/
  optimization/
  controls/
  machine-learning/
  geometry-3d/
  safety-engineering/
  systems-engineering/
```

Examples:

- GTSAM factor graphs -> `10-knowledge-base/state-estimation/`
- Frenet math -> `10-knowledge-base/controls/`
- Diffusion models -> `10-knowledge-base/machine-learning/`
- PointPillars first principles -> `10-knowledge-base/geometry-3d/`
- CAN bus and DBW fundamentals -> `10-knowledge-base/systems-engineering/`

### 20-av-platform

Physical and embedded platform elements.

```text
20-av-platform/
  vehicle-platform/
  sensors/
  compute/
  networking-connectivity/
  drive-by-wire/
  power-thermal/
```

Examples:

- Current `hardware/compute/` -> `20-av-platform/compute/`
- Current `hardware/sensors/` -> `20-av-platform/sensors/`
- Vehicle interface docs -> `20-av-platform/drive-by-wire/`
- Energy and thermal docs -> `20-av-platform/power-thermal/`

### 30-autonomy-stack

Autonomy algorithms and model families that run on or directly support the vehicle.

```text
30-autonomy-stack/
  perception/
    overview/
    methods/
    datasets-benchmarks/
  localization-mapping/
    overview/
    slam-methods/
    maps/
    indoor/
    outdoor/
  prediction/
  planning/
  control/
  world-models/
  vla-vlm/
  multi-agent-v2x/
  simulation/
  end-to-end-driving/
```

Examples:

- Current `technology/perception/methods/` -> `30-autonomy-stack/perception/methods/`
- Current `technology/localization/slam/` -> `30-autonomy-stack/localization-mapping/slam-methods/`
- Current `technology/world-models/` -> `30-autonomy-stack/world-models/`
- Current `technology/planning/` -> `30-autonomy-stack/planning/`
- Current `technology/vla/` -> `30-autonomy-stack/vla-vlm/`
- Current `technology/multi-agent/` -> `30-autonomy-stack/multi-agent-v2x/`
- Current `technology/simulation/` -> `30-autonomy-stack/simulation/`
- Current `technology/e2e-driving/` -> `30-autonomy-stack/end-to-end-driving/`

### 40-runtime-systems

On-vehicle runtime software, deployment, observability, middleware, and operational data capture.

```text
40-runtime-systems/
  ros-autoware/
  middleware/
  edge-inference/
  ml-deployment/
  monitoring-observability/
  data-logging/
```

Examples:

- ROS 2 migration and Autoware docs -> `40-runtime-systems/ros-autoware/`
- TensorRT deployment details -> `40-runtime-systems/edge-inference/`
- On-vehicle data triage -> `40-runtime-systems/data-logging/`
- Online perception monitoring -> `40-runtime-systems/monitoring-observability/` or `60-safety-validation/runtime-assurance/`, depending on safety role

### 50-cloud-fleet

Cloud, fleet, map operations, ML operations, OTA, and backend data systems.

```text
50-cloud-fleet/
  data-platform/
  mlops/
  map-ops/
  fleet-management/
  ota/
  observability/
```

Examples:

- Cloud backend infrastructure -> `50-cloud-fleet/data-platform/`
- Data flywheel and data engines -> `50-cloud-fleet/mlops/` or `50-cloud-fleet/data-platform/`
- Map tile versioning and distribution -> `50-cloud-fleet/map-ops/`
- OTA fleet management -> `50-cloud-fleet/ota/`
- Fleet dispatch and fleet management -> `50-cloud-fleet/fleet-management/`

### 60-safety-validation

Safety case, verification, validation, certification, cybersecurity, runtime assurance, and regulatory safety work.

```text
60-safety-validation/
  safety-case/
  standards-certification/
  verification-validation/
  runtime-assurance/
  cybersecurity/
```

Examples:

- ISO 3691-4, UL 4600, SOTIF -> `60-safety-validation/standards-certification/`
- Testing methodology and scenario taxonomy -> `60-safety-validation/verification-validation/`
- Runtime verification and Simplex -> `60-safety-validation/runtime-assurance/`
- Cybersecurity -> `60-safety-validation/cybersecurity/`
- Safety incidents and lessons -> `60-safety-validation/safety-case/`

### 70-operations-domains

Domain-specific AV operations. Airside is currently the strongest domain, but the tree should support future indoor/outdoor domains.

```text
70-operations-domains/
  airside/
    operations/
    deployment/
    safety/
    business-case/
  indoor-warehouse/
  outdoor-campus/
  road-av/
  deployment-playbooks/
```

Examples:

- Current `operations/airside/` -> `70-operations-domains/airside/operations/`
- Pushback, FOD, jet blast, turnaround -> `70-operations-domains/airside/operations/`
- Airside deployment playbooks -> `70-operations-domains/airside/deployment/`
- Fleet TCO business case -> `70-operations-domains/airside/business-case/` if airside-specific, otherwise `80-industry-intel/market-competitive/`

### 80-industry-intel

Companies, market research, competitive landscape, regulatory trajectory, and deployment intelligence.

```text
80-industry-intel/
  companies/
  market-competitive/
  regulations/
  deployments/
```

Examples:

- Current `companies/` -> `80-industry-intel/companies/`
- Competitive landscape -> `80-industry-intel/market-competitive/`
- Regulatory trajectory -> `80-industry-intel/regulations/`
- Airport deployment case studies -> `80-industry-intel/deployments/` or domain-specific deployment folders when operationally detailed

### 90-synthesis

Decision-making, executive summaries, POCs, technology readiness, and cross-stack synthesis.

```text
90-synthesis/
  master/
  decisions/
  poc-roadmaps/
  readiness-risk/
```

Examples:

- Master synthesis -> `90-synthesis/master/`
- Getting started -> `90-synthesis/master/` or `00-start-here/reading-guide.md`
- POC proposals -> `90-synthesis/poc-roadmaps/`
- Technology readiness and risk register -> `90-synthesis/readiness-risk/`
- Decision framework -> `90-synthesis/decisions/`

## Classification Rules

### Rule 1: Fundamentals Go To Knowledge Base

If a document teaches a reusable principle, mathematical tool, or underlying framework, place it in `10-knowledge-base/`.

Examples: factor graphs, Frenet frames, diffusion, transformers, Mamba, DBW/CAN fundamentals, bicycle model.

### Rule 2: Physical Vehicle Stack Goes To AV Platform

If a document concerns sensors, compute, networking, drive-by-wire, power, thermal, or vehicle integration hardware, place it in `20-av-platform/`.

### Rule 3: Autonomy Algorithms Go To Autonomy Stack

If a document is about perception, localization, mapping, planning, control, world models, simulation, VLA/VLM, multi-agent perception, or end-to-end driving, place it in `30-autonomy-stack/`.

### Rule 4: On-Vehicle Software Operations Go To Runtime Systems

If a document is about ROS, Autoware, middleware, inference deployment, on-vehicle logging, monitoring, runtime model management, or edge observability, place it in `40-runtime-systems/`.

### Rule 5: Fleet And Backend Systems Go To Cloud/Fleet

If a document is about cloud storage, MLOps, map ops, fleet dispatch, OTA, backend observability, fleet data loops, or cross-vehicle coordination infrastructure, place it in `50-cloud-fleet/`.

### Rule 6: Safety Argumentation Goes To Safety/Validation

If a document is about certification, standards, hazards, testing, validation, runtime assurance, formal verification, incidents, cybersecurity, or safety cases, place it in `60-safety-validation/`.

### Rule 7: Domain-Specific Operational Knowledge Goes To Operations Domains

If a document is about how AVs operate in airside, indoor warehouse, outdoor campus, road AV, or similar domains, place it in `70-operations-domains/`.

### Rule 8: Market And Company Knowledge Goes To Industry Intel

If a document is primarily about companies, market position, regulations, deployments, or competitive landscape, place it in `80-industry-intel/`.

### Rule 9: Executive Synthesis Goes To Synthesis

If a document helps decide, prioritize, summarize, or plan across multiple stack layers, place it in `90-synthesis/`.

## Method Library Pattern

Method-heavy areas should follow the same layout:

```text
overview/
methods/
datasets-benchmarks/
implementation/
coverage-audit-YYYY.md
```

Apply this to:

- `30-autonomy-stack/perception/`
- `30-autonomy-stack/localization-mapping/`
- `30-autonomy-stack/planning/`
- `30-autonomy-stack/world-models/`
- `30-autonomy-stack/vla-vlm/`
- `60-safety-validation/verification-validation/` where benchmarks and test methods are method-like

One-method files remain atomic. Broad synthesis pages become overview pages that link to methods.

## Root Entry Strategy

Keep these files at root:

```text
README.md
INDEX.md
METHODOLOGY.md
GLOSSARY.md
```

Their role:

- `README.md`: concise site home and top reading paths.
- `INDEX.md`: generated or manually curated full corpus index.
- `METHODOLOGY.md`: research process and corpus statistics.
- `GLOSSARY.md`: quick term lookup.

Canonical detailed versions may also live under `00-start-here/`, but root files remain for GitHub and VitePress convenience.

## Link Migration Strategy

The restructure must update Markdown links after moving files. Safe migration requires:

1. Build a source-to-target path map.
2. Move files with `git mv` or native filesystem moves that preserve history.
3. Rewrite relative Markdown links based on the source-to-target map.
4. Rewrite inline path references in `INDEX.md`, `README.md`, `METHODOLOGY.md`, overview pages, and coverage audits.
5. Run a local Markdown link check for moved files.
6. Run `npm run verify`.
7. Check live GitHub Pages routes after deployment.

The implementation should not rely on manual find/replace alone. A small script should calculate relative paths from old link targets to new locations.

## Migration Batches

The physical move should happen in batches to reduce risk:

### Batch 1: Scaffold And Root Entry Updates

- Create target directories.
- Add short overview pages only where they are needed for navigation.
- Update root `README.md` and `INDEX.md` to explain the target architecture.

### Batch 2: Knowledge Base And AV Platform

- Move `foundations/` into `10-knowledge-base/`.
- Move `hardware/` into `20-av-platform/`.
- Update links.
- Verify.

### Batch 3: Autonomy Stack

- Move `technology/perception/`, `technology/localization/`, `technology/planning/`, `technology/world-models/`, `technology/vla/`, `technology/multi-agent/`, `technology/simulation/`, and `technology/e2e-driving/` into `30-autonomy-stack/`.
- Preserve method subdirectories.
- Update links.
- Verify.

### Batch 4: Runtime, Cloud, And Safety

- Split `cross-cutting/` and selected `operations/deployment/` docs into `40-runtime-systems/`, `50-cloud-fleet/`, and `60-safety-validation/`.
- Move safety docs from `operations/safety/` into `60-safety-validation/`.
- Update links.
- Verify.

### Batch 5: Operations Domains, Industry Intel, And Synthesis

- Move `operations/airside/` and domain playbooks into `70-operations-domains/`.
- Move `companies/` and market/regulation/deployment intel into `80-industry-intel/`.
- Move `synthesis/` into `90-synthesis/`.
- Update links.
- Verify.

### Batch 6: Cleanup And Final Navigation

- Remove empty old directories.
- Update counts and methodology.
- Check generated VitePress sidebar ordering.
- Run final verification and deploy.

## Navigation Expectations

The VitePress sidebar should present the numeric architecture in order. Top navigation should prioritize:

1. Start Here
2. Knowledge Base
3. AV Platform
4. Autonomy Stack
5. Runtime Systems
6. Cloud/Fleet
7. Safety/Validation
8. Operations Domains
9. Industry Intel
10. Synthesis

If the current VitePress navigation generator sorts by filesystem order, numeric prefixes are enough. If it hardcodes domain labels, update the navigation tests and config.

## Testing And Verification

Required verification for implementation:

```powershell
git status --short
git diff --check
npm run verify
```

Additional restructure-specific checks:

- Count moved Markdown files before and after.
- Check no old top-level content directories remain except intentional internal/tooling directories.
- Check local Markdown links for moved files.
- Check `README.md`, `INDEX.md`, `METHODOLOGY.md`, and coverage audits for stale old paths.
- Check representative live routes after GitHub Pages deploy.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Broken relative links after file moves | Use a path-map script and run a link check before commit. |
| VitePress route changes make old bookmarks stale | Keep root entry files stable and accept route changes for internal research pages. Add compatibility links for the most important pages if needed. |
| Over-classifying docs into too many small folders | Use the classification rules and keep each document in the folder matching its primary reader question. |
| `cross-cutting/` content is hard to split | Assign each file by primary operational role: runtime, cloud/fleet, safety, autonomy, or knowledge base. |
| Counts become stale | Recompute counts from filesystem after moves and update README, INDEX, and METHODOLOGY in the same commit batch. |
| Large move is hard to review | Commit by migration batch, with verification after each batch. |

## Acceptance Criteria

The restructure is complete when:

1. The target top-level architecture exists.
2. Current research files are physically moved into the new structure.
3. Root entry files still work.
4. Method-level perception and SLAM libraries remain atomic and discoverable.
5. Indoor/outdoor mapping and domain operations have clear homes.
6. Local Markdown links in moved content resolve.
7. `npm run verify` passes.
8. GitHub Pages deploys successfully.
9. Live checks confirm the new start page and at least one moved deep page load with HTTP 200.

## Approved Direction

The chosen direction is Option C: End-to-End AV Knowledge Architecture. It is a physical restructure into a numbered, stack-oriented directory tree with a new `10-knowledge-base/` foundation area and explicit separation of platform, autonomy, runtime, cloud/fleet, safety, operations domains, industry intelligence, and synthesis.
