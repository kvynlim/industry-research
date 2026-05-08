# Industry Research

Personal research command center for autonomous vehicle technology, airport airside operations, world models, safety, deployment, and fleet systems.

**Read it as a site:** https://kvynlim.github.io/industry-research/

The repository remains Markdown-first, but the VitePress reader is the intended reading surface: local search, generated sidebar navigation, clean URLs, last-updated metadata, and source links back into the repo.

## Current Shape

| Scope | Count |
|-------|-------|
| Reader pages | 306 |
| Core research documents | 302 |
| Corpus size | 221k+ lines |
| Companies covered | 21 |
| Technology domains | 9 |
| Method-level SLAM files | 59 |
| Safety and certification docs | 18 |
| Hardware docs | 20 |
| Synthesis docs | 8 |
| Papers referenced | 400+ |
| Open-source repos evaluated | 50+ |
| Airport deployments documented | 15+ |

## Start Here

| Need | Open |
|------|------|
| Navigate the whole corpus | [Research Index](INDEX.md) |
| Get the executive view | [Master Synthesis](synthesis/master-synthesis.md) |
| Start building from the research | [Getting Started](synthesis/getting-started.md) |
| Pick concrete POCs | [POC Proposals](synthesis/poc-proposals.md) |
| Understand readiness and risk | [Technology Readiness](synthesis/technology-readiness.md) |
| Compare the market | [Competitive Landscape](synthesis/competitive-landscape.md) |
| Read the core system architecture | [Design Spec](synthesis/design-spec.md) |
| Go deep on SLAM methods | [Method-Level SLAM Library](technology/localization/slam/overview.md) |
| Check terms and abbreviations | [Glossary](GLOSSARY.md) |
| Understand how the corpus was made | [Methodology](METHODOLOGY.md) |

## High-Leverage Reading Paths

| Path | Best Entry Point | Why |
|------|------------------|-----|
| World models for autonomous driving | [World Models Overview](technology/world-models/overview.md) | Frames diffusion, occupancy, tokenized, JEPA, RL, and LiDAR-native approaches. |
| Airport airside operations | [Airside Industry Overview](operations/airside/industry-overview.md) | Connects the AV stack to pushback, turnaround, FOD, jet blast, airport data systems, and GSE. |
| Safety case and certification | [Certification Guide](operations/safety/certification-guide.md) | Pulls together ISO 3691-4, UL 4600, SOTIF, runtime monitoring, fail-operational design, and validation. |
| Production deployment | [Deployment Playbook](operations/deployment/deployment-playbook.md) | Turns research into staged rollout, shadow mode, OTA, fleet management, and operational procedures. |
| Fleet economics | [Fleet TCO Business Case](operations/deployment/fleet-tco-business-case.md) | Tracks vehicle CAPEX, labor savings, certification costs, operator ratios, and break-even logic. |
| Edge hardware choices | [NVIDIA Orin Technical](hardware/compute/nvidia-orin-technical.md) | Grounds model choices in compute, power, TensorRT, DLA, and sensor constraints. |
| Perception stack | [Production Perception Systems](technology/perception/production-perception-systems.md) | Compares production AV approaches and the perception patterns that transfer to airside autonomy. |
| Localization and mapping | [Mapping and Localization](technology/localization/mapping-and-localization.md) | Covers HD maps, LiDAR SLAM, map-free driving, map maintenance, localization, and occupancy grids. |
| Method-level 3D SLAM | [SLAM Library Overview](technology/localization/slam/overview.md) | Breaks classical, LiDAR, visual, dense, neural, Gaussian, and radar SLAM into focused method files. |
| SLAM coverage gaps | [SLAM Coverage Audit](technology/localization/slam/coverage-audit-2026.md) | Tracks missing first-class SLAM pages, including May 2026 sweeps across LIO, LIVO, 4D radar, Gaussian/foundation SLAM, backends, collaborative SLAM, alternative sensors, and benchmarks. |

## Corpus Map

| Section | Docs | Start At | What It Holds |
|---------|------|----------|---------------|
| `synthesis/` | 8 | [Master Synthesis](synthesis/master-synthesis.md) | Executive synthesis, POCs, readiness, competitive landscape, risk, decision framework, and architecture. |
| `companies/` | 53 | [Company Index](INDEX.md#a-specific-company) | AV, airside, simulation, teleoperation, and autonomy company profiles. |
| `technology/` | 141 | [World Models Overview](technology/world-models/overview.md) | World models, perception, planning, localization, SLAM, simulation, VLA/VLM, robustness, E2E driving, and multi-agent systems. |
| `operations/` | 42 | [Airside Industry Overview](operations/airside/industry-overview.md) | Airside operations, deployment, safety, certification, teleoperation, workforce, and fleet management. |
| `hardware/` | 20 | [NVIDIA Orin Technical](hardware/compute/nvidia-orin-technical.md) | Compute, sensors, connectivity, vehicle interfaces, power, and edge-cloud architecture. |
| `foundations/` | 12 | [Theoretical Foundations](foundations/theoretical-foundations.md) | First-principles technical notes: diffusion, transformers, GTSAM, Frenet math, Lanelet2, Mamba, PointPillars, and more. |
| `cross-cutting/` | 26 | [Sensor Fusion Architectures](cross-cutting/sensor-fusion-architectures.md) | Data engines, ROS 2, Autoware, synthetic data, evaluation, transfer learning, formal methods, and fleet data loops. |

## Domain Snapshot

| Technology | Docs |
|------------|------|
| World models | 13 |
| Perception | 20 |
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
