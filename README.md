# Industry Research

Personal research command center for autonomous vehicle technology, airport airside operations, world models, safety, deployment, and fleet systems.

**Read it as a site:** https://kvynlim.github.io/industry-research/

The repository remains Markdown-first, but the VitePress reader is the intended reading surface: local search, generated sidebar navigation, clean URLs, last-updated metadata, and source links back into the repo.

## Current Shape

| Scope | Count |
|-------|-------|
| Reader pages | 362 |
| Core research documents | 358 |
| Corpus size | 227k+ lines |
| Companies covered | 21 |
| Technology domains | 9 |
| Method-level SLAM files | 59 |
| Method-level perception files | 54 |
| Safety and certification docs | 18 |
| Hardware docs | 20 |
| Synthesis docs | 8 |
| Papers referenced | 400+ |
| Open-source repos evaluated | 50+ |
| Airport deployments documented | 15+ |

## Architecture

The corpus is being organized as an end-to-end AV knowledge base: fundamentals, platform hardware, autonomy stack, runtime systems, cloud/fleet systems, safety validation, operations domains, industry intelligence, and synthesis.

## Start Here

| Need | Open |
|------|------|
| Navigate the whole corpus | [Research Index](INDEX.md) |
| Get the executive view | [Master Synthesis](90-synthesis/master/master-synthesis.md) |
| Start building from the research | [Getting Started](90-synthesis/master/getting-started.md) |
| Pick concrete POCs | [POC Proposals](90-synthesis/poc-roadmaps/poc-proposals.md) |
| Understand readiness and risk | [Technology Readiness](90-synthesis/readiness-risk/technology-readiness.md) |
| Compare the market | [Competitive Landscape](80-industry-intel/market-competitive/competitive-landscape.md) |
| Read the core system architecture | [Design Spec](90-synthesis/decisions/design-spec.md) |
| Go deep on perception methods | [Method-Level Perception Library](30-autonomy-stack/perception/methods/overview.md) |
| Go deep on SLAM methods | [Method-Level SLAM Library](30-autonomy-stack/localization-mapping/slam-methods/overview.md) |
| Check terms and abbreviations | [Glossary](GLOSSARY.md) |
| Understand how the corpus was made | [Methodology](METHODOLOGY.md) |

## High-Leverage Reading Paths

| Path | Best Entry Point | Why |
|------|------------------|-----|
| World models for autonomous driving | [World Models Overview](30-autonomy-stack/world-models/overview.md) | Frames diffusion, occupancy, tokenized, JEPA, RL, and LiDAR-native approaches. |
| Airport airside operations | [Airside Industry Overview](70-operations-domains/airside/operations/industry-overview.md) | Connects the AV stack to pushback, turnaround, FOD, jet blast, airport data systems, and GSE. |
| Safety case and certification | [Certification Guide](60-safety-validation/standards-certification/certification-guide.md) | Pulls together ISO 3691-4, UL 4600, SOTIF, runtime monitoring, fail-operational design, and validation. |
| Production deployment | [Deployment Playbook](70-operations-domains/deployment-playbooks/deployment-playbook.md) | Turns research into staged rollout, shadow mode, OTA, fleet management, and operational procedures. |
| Fleet economics | [Fleet TCO Business Case](70-operations-domains/airside/business-case/fleet-tco-business-case.md) | Tracks vehicle CAPEX, labor savings, certification costs, operator ratios, and break-even logic. |
| Edge hardware choices | [NVIDIA Orin Technical](20-av-platform/compute/nvidia-orin-technical.md) | Grounds model choices in compute, power, TensorRT, DLA, and sensor constraints. |
| Perception stack | [Production Perception Systems](30-autonomy-stack/perception/overview/production-perception-systems.md) | Compares production AV approaches and the perception patterns that transfer to airside autonomy. |
| Method-level perception | [Perception Method Library](30-autonomy-stack/perception/methods/overview.md) | Splits BEV, occupancy, LiDAR MOS, 4D radar, open-world, robust fusion, V2X, latency, and data-engine methods into single-technique research pages. |
| Perception coverage gaps | [Perception Coverage Audit](30-autonomy-stack/perception/overview/coverage-audit-2026.md) | Tracks missing first-class perception pages across BEV, occupancy, LiDAR/radar/thermal, open-world/OOD, V2X, robustness, and benchmarks. |
| Localization and mapping | [Mapping and Localization](30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md) | Covers HD maps, LiDAR SLAM, map-free driving, map maintenance, localization, and occupancy grids. |
| Method-level 3D SLAM | [SLAM Library Overview](30-autonomy-stack/localization-mapping/slam-methods/overview.md) | Breaks classical, LiDAR, visual, dense, neural, Gaussian, and radar SLAM into focused method files. |
| SLAM coverage gaps | [SLAM Coverage Audit](30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md) | Tracks missing first-class SLAM pages, including May 2026 sweeps across LIO, LIVO, 4D radar, Gaussian/foundation SLAM, backends, collaborative SLAM, alternative sensors, and benchmarks. |

## Corpus Map

| Section | Docs | Start At | What It Holds |
|---------|------|----------|---------------|
| `90-synthesis/` | 8 | [Master Synthesis](90-synthesis/master/master-synthesis.md) | Executive synthesis, POCs, readiness, competitive landscape, risk, decision framework, and architecture. |
| `80-industry-intel/companies/` | 53 | [Company Index](INDEX.md#a-specific-company) | AV, airside, simulation, teleoperation, and autonomy company profiles. |
| `30-autonomy-stack/` | 195 | [World Models Overview](30-autonomy-stack/world-models/overview.md) | World models, perception, method-level perception, planning, localization, SLAM, simulation, VLA/VLM, E2E driving, and multi-agent systems. |
| `70-operations-domains/` | 15 | [Airside Industry Overview](70-operations-domains/airside/operations/industry-overview.md) | Airside operations, deployment playbooks, business case, and domain-specific safety. |
| `hardware/` | 20 | [NVIDIA Orin Technical](20-av-platform/compute/nvidia-orin-technical.md) | Compute, sensors, connectivity, vehicle interfaces, power, and edge-cloud architecture. |
| `foundations/` | 12 | [Theoretical Foundations](10-knowledge-base/systems-engineering/theoretical-foundations.md) | First-principles technical notes: diffusion, transformers, GTSAM, Frenet math, Lanelet2, Mamba, PointPillars, and more. |
| `50-cloud-fleet/` | 16 | [Cloud Backend Infrastructure](50-cloud-fleet/data-platform/cloud-backend-infrastructure.md) | Data engines, fleet data loops, MLOps, OTA, observability, and fleet management. |

## Domain Snapshot

| Technology | Docs |
|------------|------|
| World models | 13 |
| Perception | 76 |
| Method-level perception library | 54 |
| Planning | 12 |
| Localization and mapping | 72 |
| Method-level SLAM library | 59 |
| Simulation | 7 |
| VLA / VLM | 5 |
| Multi-agent and fleet coordination | 5 |
| Robustness | 4 |
| E2E driving | 3 |

| Operations | Docs |
|------------|------|
| Safety and certification | 18 |
| Deployment | 13 |
| Airside operations | 10 |
| Teleoperation | 1 |

| Hardware | Docs |
|----------|------|
| Compute | 7 |
| Sensors | 8 |
| Connectivity | 3 |
| Vehicle interfaces | 2 |

## Reader Notes

- The static reader is generated from this repository with VitePress and deployed through GitHub Pages.
- `README.md` becomes the site home page.
- `INDEX.md` is served as `/INDEX/` in the reader to avoid a Windows case-insensitive output collision with the homepage.
- Research content is source-of-truth Markdown; the generated site is just a browser-friendly layer over the same files.
- Internal implementation notes under `docs/superpowers/`, `.claude/`, and `.superpowers/` are excluded from the static reader.
