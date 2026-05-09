# Research Methodology

## How This Corpus Was Created

---

## Overview

This research corpus began as a 24-hour intensive research session on **2026-03-21/22** using Claude Opus 4.6 with a 1M context window, augmented by parallel web-searching research agents. It has since been expanded and reorganized into a 524-document research corpus, surfaced as 532 VitePress reader pages.

The current reading surface is the static VitePress portal at https://kvynlim.github.io/industry-research/. The Markdown files remain the source of truth; the site adds search, generated navigation, clean URLs, last-updated metadata, and browser-friendly reading across 247k+ lines of Markdown.

## Research Process

### Phase 1: Foundational Research (20 parallel agents)
- **Method:** 20 specialized research agents launched simultaneously, each covering a distinct topic domain
- **Scope:** World models, VLAs, diffusion models, RL, 3DGS/NeRF, occupancy prediction, JEPA, LLM reasoning, motion prediction, multi-agent coordination, datasets/benchmarks, safety certification, compute hardware, perception foundation models, mapping/localization, robustness, and company strategies
- **Sources:** WebSearch across academic papers (arXiv, conference proceedings), company websites, developer documentation, GitHub repositories, press releases, regulatory documents
- **Output:** 20 research reports, ~13,000 lines

### Phase 2: Design & Brainstorming
- **Method:** Explored reference AV stack patterns and operational constraints to understand the target system architecture
- **Output:** Design specification (891 lines, spec-reviewed with automated review agent), POC proposals, master synthesis

### Phase 3: Execution Guides (20 parallel agents)
- **Method:** 20 agents focused on practical, implementation-ready knowledge
- **Topics:** BEV encoding, OccWorld setup, data engine from ROS bags, Simplex safety architecture, MLOps, Alpamayo, Cosmos, 3DGS digital twin, airport data APIs, transfer learning, ROS 2 migration, Frenet planner augmentation, OpenPCDet/CenterPoint, Dreamer RL, open-source ecosystem, shadow mode, FOD/jet blast, turnaround prediction, open-vocab detection, E2E pipeline
- **Output:** 20 execution guides, ~13,000 lines

### Phase 4: Production Deployment (15 parallel agents)
- **Method:** 15 agents researching real-world deployment case studies
- **Companies:** TractEasy, comma.ai, Waymo, Tesla, Changi programme
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
- **Method:** Reorganized from the early flat/topic-based corpus into the final numbered end-to-end knowledge architecture: `00-start-here/`, `10-knowledge-base/`, `20-av-platform/`, `30-autonomy-stack/`, `40-runtime-systems/`, `50-cloud-fleet/`, `60-safety-validation/`, `70-operations-domains/`, `80-industry-intel/`, and `90-synthesis/`.
- **Output:** Root navigation, competitive landscape, technology readiness, getting-started guide, risk register, cross-references, and numbered reader paths

### Phase 8: Method-Level SLAM Expansion and Coverage Audit
- **Method:** Parallel web-search agents audited LiDAR, visual, dense/RGB-D, LiDAR-visual-inertial, radar, registration, loop-closure, and backend SLAM coverage against the existing method library
- **Output:** Dedicated [GLIM](30-autonomy-stack/localization-mapping/slam-methods/glim.md) method file plus [SLAM Coverage Audit and Backlog](30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md), with P0/P1/P2 missing-method queues, 2026-05-08 latest-method and gap-discovery sweeps, and source links

### Phase 9: Perception Stack Coverage Audit
- **Method:** Multiple rounds of parallel research agents audited camera BEV, occupancy, LiDAR/radar/thermal/event perception, open-world/OOD perception, temporal tracking, cooperative/V2X perception, robustness, deployment validation, and benchmarks
- **Output:** [Perception Coverage Audit and Backlog](30-autonomy-stack/perception/overview/coverage-audit-2026.md), with P0/P1/P2 missing-method queues, benchmark gaps, discoverability fixes, and source links

### Phase 10: Method-Level Perception Library
- **Method:** Five parallel writing agents split the perception coverage audit into atomic, one-method research files across camera BEV/occupancy, LiDAR/radar/event/FMCW perception, open-world/open-vocabulary perception, robust fusion/validation, and cooperative/latency/data-engine methods
- **Output:** [Perception Method Library](30-autonomy-stack/perception/methods/overview.md), initially with 54 single-technique method files and now expanded to 76 atomic method files that follow a shared structure for core idea, inputs/outputs, architecture, training/evaluation, strengths, failure modes, airside fit, implementation notes, and sources

### Phase 11: Cross-Architecture Knowledge Gap Audit
- **Method:** Six parallel research agents audited the post-restructure architecture across foundations, AV platform, autonomy stack, runtime/cloud, safety/validation, and operations/industry. One autonomy agent was split into two narrower replacement agents after exceeding context, preserving coverage without overloading the review.
- **Output:** [End-to-End AV Knowledge Gap Backlog](90-synthesis/readiness-risk/knowledge-gap-backlog.md), with P0/P1/P2 missing-file queues across reusable fundamentals, platform power/thermal/diagnostics, planning/control/V2X, runtime/cloud operations, safety evidence, and non-airside operations domains.

### Phase 12: P0 Knowledge Gap Research Wave
- **Method:** Six parallel writing agents plus one follow-up agent converted the P0 gap backlog into first-class research files. Each agent owned a disjoint write scope: foundations, AV platform, planning/control/V2X, E2E/VLA/world models, runtime/cloud+safety evidence, operations domains, and delivery robots.
- **Output:** 35 source-backed P0 gap files across `10-knowledge-base/`, `20-av-platform/`, `30-autonomy-stack/`, `40-runtime-systems/`, `50-cloud-fleet/`, `60-safety-validation/`, and `70-operations-domains/`.

### Phase 13: Perception, SLAM, and Sensor Deep-Dive Loop
- **Method:** Parallel discovery agents re-audited perception, SLAM, Gaussian/3DGS methods, and sensor fundamentals, then six writing agents promoted the highest-value gaps into atomic files. The wave explicitly covered SplatAD and other Gaussian/4DGS methods, production-relevant LIVO/SLAM stacks, radar/Gaussian SLAM, and sensor measurement/noise models for perception, SLAM, and mapping.
- **Output:** 33 source-backed files: 9 perception method pages, 13 SLAM method pages, 9 knowledge-base sensor/state-estimation fundamentals, 2 platform sensor hardware pages, plus a [Continuous Research Loop](90-synthesis/readiness-risk/continuous-research-loop.md) to keep the next gap queue active.

### Phase 14: First-Principles Foundations Expansion
- **Method:** Five parallel web/discovery rounds audited probability/statistics, nonlinear optimization, numerical linear algebra, association/tracking, and broader AV robotics foundations. Five writing agents then promoted the selected gaps into atomic first-principles KB files with disjoint ownership.
- **Output:** 33 source-backed knowledge-base files across probability/statistics, optimization, numerical linear algebra, geometry, mapping, state estimation, sensors, signal processing, and systems engineering. The wave covers Gaussian noise, Mahalanobis gating, MAP/MLE, robust statistics, mixtures, Gauss-Newton, Levenberg-Marquardt, Cholesky, QR/SVD, sparse solvers, Lie groups, PnP, ICP/GICP/NDT, occupancy grids, data association, JPDA/MHT/RFS, filters, sensor likelihoods, radar ambiguity, CFAR, timestamping, and statistical benchmarking.

### Phase 15: LIORNet, LiDAR Removal, and Machine-Learning Foundations
- **Method:** Parallel discovery agents audited LIORNet, adverse-weather LiDAR denoising, classical outlier removal, map-cleaning methods, weather datasets, and first-principles ML gaps. Five writing agents then promoted the selected work into disjoint file groups: learned LiDAR denoisers, broad removal and map-cleaning techniques, weather robustness datasets, classical ML foundations, and modern ML foundations.
- **Output:** 41 source-backed files: LIORNet and adjacent denoising methods, classical LiDAR outlier and weather artifact removal, LiDAR ghost/multipath artifacts, artifact-removal validation, ERASOR/Removert/map-cleaning pages, weather robustness dataset pages, and a machine-learning ladder from perceptrons, logits, backprop, optimization, CNNs, and RNNs to transformers, Mamba, JEPA, foundation-model training, and world-model first principles.

### Phase 16: Dynamic/Static Object Removal and ML Objective Foundations
- **Method:** Parallel discovery and writing agents expanded the removal topic from weather/noise filtering into dynamic-object removal, static-but-wrong-object removal, scene flow, MOS, map-change datasets, and map-cleaning benchmarks. A parallel ML wave filled first-principles gaps around representation objectives, EBMs, masked modeling, diffusion/flow sampling, tokenization, positional encodings, calibration, leakage, multi-task losses, and world-model evaluation.
- **Output:** 26 source-backed files: MapCleaner, ERASOR++, 4dNDF, FreeDOM, STATIC-LIO dynamic-point removal, MotionSeg3D, MambaMOS, neural scene-flow priors, moving/static separation datasets, moved-object map-change datasets, 4D occupancy and scene-flow benchmarks, an airside dynamic map-cleaning benchmark, and 11 machine-learning foundation notes that bridge classical neural-network training to modern transformer, Mamba, diffusion, JEPA, and world-model pipelines.

## Quality Controls

1. **Spec Review:** Design specification reviewed by automated spec-review agent with factual corrections
2. **Factual Corrections:** Known inaccuracies identified and propagated across all documents (V-JEPA 240x→~15x, Alpamayo naming/licensing, Copilot4D parameter count)
3. **Cross-Referencing:** Synthesis documents cross-reference each other and the detailed research
4. **Source Attribution:** Each research document includes a Sources section with paper references, URLs, and datasets
5. **Primary-Source Preference:** Implementation claims are checked against primary artifacts where available, with company-specific claims kept attributed
6. **Coverage Audits:** Broad method libraries now include explicit backlog documents for missing first-class pages, starting with SLAM and perception
7. **Atomic Method Pages:** SLAM and perception now separate overview synthesis from one-method research files, so individual techniques can be updated and compared without burying them inside family documents
8. **Cross-Architecture Gap Tracking:** The synthesis layer now tracks P0/P1/P2 research gaps outside the dedicated SLAM and perception audits
9. **P0 Gap Promotion:** High-priority cross-architecture gaps are promoted into first-class files before P1/P2 backlog work begins
10. **Continuous Research Loop:** Discovery, triage, promotion, cross-linking, verification, and next-queue selection are now documented as a repeatable loop
11. **First-Principles Layering:** Applied perception, SLAM, mapping, and sensor files now link back to reusable math primitives instead of repeating estimator fundamentals inline
12. **Removal Safety Separation:** LiDAR artifact removal now separates nuisance-point deletion, ghost/multipath diagnosis, dynamic-map cleaning, and safety validation so filtering does not become an unexamined hazard-deletion step

## Limitations

1. **Web search rate limits:** Some agents hit API rate limits during research. Affected topics were written from training knowledge rather than live web search.
2. **Point-in-time:** Research broadly reflects the state of the field as of March 2026, with 2026-05-08 and 2026-05-09 refreshes for SLAM, perception, Gaussian/3DGS methods, sensor fundamentals, first-principles estimator math, LIORNet/adverse-weather LiDAR removal, dynamic/static object removal, scene-flow/MOS benchmarks, moved-object map-change datasets, weather datasets, and machine-learning foundations. Fast-moving areas (world models, VLAs, neural/Gaussian SLAM, open-world perception, dynamic map cleaning, adverse-weather denoising, and 4D radar) may have newer developments.
3. **Airside data gap:** No public airside driving datasets exist, so comparative analysis relies on published deployment reports rather than reproducible benchmarks.
4. **Company information:** Some companies (UISEE, AeroVect) have limited public technical information. Claims are attributed but not all independently verified.
5. **Regulatory predictions:** Timeline predictions for FAA/EASA standards are based on published roadmaps and industry trends, not official commitments.

## Corpus Statistics

| Metric | Value |
|--------|-------|
| Core research documents | 524 |
| Reader pages | 532 |
| Total lines | 247k+ |
| Research agents spawned | 170+ |
| Companies researched | 20 |
| Method-level SLAM library | 80 method files + overview |
| Method-level perception files | 76 |
| Papers referenced | 550+ |
| GitHub repos evaluated | 70+ |
| API endpoints documented | 15+ |
| Airport deployments documented | 15+ |
| Static reader | VitePress on GitHub Pages |
| Initial research sprint | ~24 hours |

## How to Extend This Research

1. **Add a new company:** Create `80-industry-intel/companies/<name>/tech-stack.md`, update `INDEX.md` and `README.md`
2. **Add new platform research:** Create it in the appropriate `20-av-platform/<domain>/` directory for compute, sensors, networking/connectivity, or drive-by-wire material.
3. **Add new autonomy-stack research:** Create it in the appropriate `30-autonomy-stack/<domain>/` directory for world models, perception, planning, localization/mapping, simulation, VLA/VLM, E2E driving, or multi-agent/V2X material.
4. **Add safety, validation, or robustness research:** Create it in the appropriate `60-safety-validation/<domain>/` directory.
5. **Add operational or industry research:** Use `70-operations-domains/` for airside/deployment/business-case material and `80-industry-intel/` for companies, market intelligence, and regulations.
6. **Update a finding:** Edit the document, run `rg` to find all references to the finding across the corpus, update all
7. **Add a new POC:** Add to `90-synthesis/poc-roadmaps/poc-proposals.md` and `90-synthesis/readiness-risk/technology-readiness.md`
8. **Track regulatory changes:** Update `80-industry-intel/regulations/regulatory-trajectory-deep-dive.md`
