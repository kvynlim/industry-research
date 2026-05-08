# Research Methodology

## How This Corpus Was Created

---

## Overview

This research corpus began as a 24-hour intensive research session on **2026-03-21/22** using Claude Opus 4.6 with a 1M context window, augmented by parallel web-searching research agents. It has since been expanded and reorganized into a 243-document research corpus, surfaced as 247 VitePress reader pages.

The current reading surface is the static VitePress portal at https://kvynlim.github.io/industry-research/. The Markdown files remain the source of truth; the site adds search, generated navigation, clean URLs, and browser-friendly reading.

## Research Process

### Phase 1: Foundational Research (20 parallel agents)
- **Method:** 20 specialized research agents launched simultaneously, each covering a distinct topic domain
- **Scope:** World models, VLAs, diffusion models, RL, 3DGS/NeRF, occupancy prediction, JEPA, LLM reasoning, motion prediction, multi-agent coordination, datasets/benchmarks, safety certification, compute hardware, perception foundation models, mapping/localization, robustness, and company strategies
- **Sources:** WebSearch across academic papers (arXiv, conference proceedings), company websites, developer documentation, GitHub repositories, press releases, regulatory documents
- **Output:** 20 research reports, ~13,000 lines

### Phase 2: Design & Brainstorming
- **Method:** Explored the Aurrigo ROS workspace (`~/ubuntu_20-04/z-aurrigo-ws/`) to understand the current AV stack (22 packages analyzed)
- **Output:** Design specification (891 lines, spec-reviewed with automated review agent), POC proposals, master synthesis

### Phase 3: Execution Guides (20 parallel agents)
- **Method:** 20 agents focused on practical, implementation-ready knowledge
- **Topics:** BEV encoding, OccWorld setup, data engine from ROS bags, Simplex safety architecture, MLOps, Alpamayo, Cosmos, 3DGS digital twin, airport data APIs, transfer learning, ROS 2 migration, Frenet planner augmentation, OpenPCDet/CenterPoint, Dreamer RL, open-source ecosystem, shadow mode, FOD/jet blast, turnaround prediction, open-vocab detection, E2E pipeline
- **Output:** 20 execution guides, ~13,000 lines

### Phase 4: Production Deployment (15 parallel agents)
- **Method:** 15 agents researching real-world deployment case studies
- **Companies:** TractEasy, Aurrigo, comma.ai, Waymo, Tesla, Changi programme
- **Topics:** Safety incidents, OTA fleet management, safety certification, teleoperation, 5G connectivity, production perception, Moonware HALO, deployment playbook, production ML deployment
- **Output:** 15 deployment reports, ~13,000 lines

### Phase 5: First Principles (6 written + 9 agents)
- **Method:** Deep first-principles derivations for core technologies
- **Topics:** PointPillars (tensor shapes), VQ-VAE/FSQ tokenization, transformer world models, bicycle kinematic model, diffusion models, RTK-GPS/IMU localization, GTSAM factor graphs, Lanelet2 maps, Frenet trajectory math, CAN bus DBW, Mamba SSM
- **Output:** 11 foundation documents, ~7,000 lines

### Phase 6: Gap-Filling Deep Dives (20 parallel agents)
- **Method:** Targeted deep dives on specific gaps identified in the corpus
- **Topics:** ISO 3691-4 certification, Waymo safety methodology, airport data systems (real API endpoints), nuScenes/Waymo practical guide, TensorRT deployment, Autoware Universe, airport 5G case studies, Mamba SSM, ground crew safety, occupancy networks comparison (20 methods), simulators for airside, regulatory trajectory, open-source world model repos (21 evaluated), pushback systems, insurance/liability, comma.ai codebase analysis, 4D radar, DINOv2 for driving, airport digital twins, fleet management dispatch
- **Output:** 20 deep-dive reports

### Phase 7: Restructuring & Synthesis
- **Method:** Reorganized from flat/topic-based to domain-organized directory structure
- **Output:** INDEX.md, competitive landscape, technology readiness, getting-started guide, risk register, cross-references

## Quality Controls

1. **Spec Review:** Design specification reviewed by automated spec-review agent with factual corrections
2. **Factual Corrections:** Known inaccuracies identified and propagated across all documents (V-JEPA 240x→~15x, Alpamayo naming/licensing, Copilot4D parameter count)
3. **Cross-Referencing:** Synthesis documents cross-reference each other and the detailed research
4. **Source Attribution:** Each research document includes a Sources section with paper references, URLs, and datasets
5. **Direct Verification:** Aurrigo tech stack analyzed from actual source code, not secondary sources

## Limitations

1. **Web search rate limits:** Some agents hit API rate limits during research. Affected topics were written from training knowledge rather than live web search.
2. **Point-in-time:** Research reflects the state of the field as of March 2026. Fast-moving areas (world models, VLAs) may have newer developments.
3. **Airside data gap:** No public airside driving datasets exist, so comparative analysis relies on published deployment reports rather than reproducible benchmarks.
4. **Company information:** Some companies (UISEE, AeroVect) have limited public technical information. Claims are attributed but not all independently verified.
5. **Regulatory predictions:** Timeline predictions for FAA/EASA standards are based on published roadmaps and industry trends, not official commitments.

## Corpus Statistics

| Metric | Value |
|--------|-------|
| Core research documents | 243 |
| Reader pages | 247 |
| Total lines | ~211,000+ |
| Research agents spawned | 100+ |
| Companies researched | 21 |
| Papers referenced | 400+ |
| GitHub repos evaluated | 50+ |
| API endpoints documented | 15+ |
| Airport deployments documented | 15+ |
| Static reader | VitePress on GitHub Pages |
| Initial research sprint | ~24 hours |

## How to Extend This Research

1. **Add a new company:** Create `companies/<name>/tech-stack.md`, update `INDEX.md` and `README.md`
2. **Add a new technology:** Create in appropriate `technology/<domain>/` directory
3. **Update a finding:** Edit the document, run `rg` to find all references to the finding across the corpus, update all
4. **Add a new POC:** Add to `synthesis/poc-proposals.md` and `synthesis/technology-readiness.md`
5. **Track regulatory changes:** Update `operations/safety/regulatory-trajectory-deep-dive.md`
