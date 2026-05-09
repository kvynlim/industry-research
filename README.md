# Industry Research

Personal research command center for autonomous vehicle technology, airport airside operations, world models, safety, deployment, and fleet systems.

**Read it as a site:** https://kvynlim.github.io/industry-research/

The repository remains Markdown-first, but the VitePress reader is the intended reading surface: local search, generated sidebar navigation, clean URLs, last-updated metadata, and source links back into the repo.

## Current Shape

| Scope | Count |
|-------|-------|
| Reader pages | 563 |
| Core research documents | 559 |
| Corpus size | 327k+ lines |
| Companies covered | 20 |
| Technology domains | 9 |
| Method-level SLAM library | 88 method files + overview/audit |
| Method-level perception files | 85 |
| Safety and validation docs | 28 |
| AV platform docs | 28 |
| Synthesis docs | 9 |
| Knowledge base docs | 93 |
| Papers referenced | 650+ |
| Open-source repos evaluated | 80+ |
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
| Prioritize gap-filling research | [Knowledge Gap Backlog](90-synthesis/readiness-risk/knowledge-gap-backlog.md) |
| Continue the research loop | [Continuous Research Loop](90-synthesis/readiness-risk/continuous-research-loop.md) |
| Compare the market | [Competitive Landscape](80-industry-intel/market-competitive/competitive-landscape.md) |
| Read the core system architecture | [Design Spec](90-synthesis/decisions/design-spec.md) |
| Go deep on perception methods | [Method-Level Perception Library](30-autonomy-stack/perception/methods/overview.md) |
| Go deep on SLAM methods | [Method-Level SLAM Library](30-autonomy-stack/localization-mapping/slam-methods/overview.md) |
| Check terms and abbreviations | [Glossary](GLOSSARY.md) |
| Understand how the corpus was made | [Methodology](METHODOLOGY.md) |

## High-Leverage Reading Paths

| Path | Best Entry Point | Why |
|------|------------------|-----|
| World models for autonomous driving | [World Models Overview](30-autonomy-stack/world-models/overview.md) | Frames diffusion, occupancy, self-supervised occupancy flow, UniScene-style occupancy-centric generation, tokenized, JEPA, RL, and LiDAR-native approaches. |
| Airport airside operations | [Airside Industry Overview](70-operations-domains/airside/operations/industry-overview.md) | Connects the AV stack to pushback, turnaround, FOD, jet blast, airport data systems, and GSE. |
| Safety case and certification | [Certification Guide](60-safety-validation/standards-certification/certification-guide.md) | Pulls together ISO 3691-4, UL 4600, SOTIF, runtime monitoring, fail-operational design, and validation. |
| Production deployment | [Deployment Playbook](70-operations-domains/deployment-playbooks/deployment-playbook.md) | Turns research into staged rollout, shadow mode, OTA, fleet management, and operational procedures. |
| Fleet economics | [Fleet TCO Business Case](70-operations-domains/airside/business-case/fleet-tco-business-case.md) | Tracks vehicle CAPEX, labor savings, certification costs, operator ratios, and break-even logic. |
| Edge hardware choices | [NVIDIA Orin Technical](20-av-platform/compute/nvidia-orin-technical.md) | Grounds model choices in compute, power, TensorRT, DLA, and sensor constraints. |
| Perception stack | [Production Perception Systems](30-autonomy-stack/perception/overview/production-perception-systems.md) | Compares production AV approaches and the perception patterns that transfer to airside autonomy. |
| Method-level perception | [Perception Method Library](30-autonomy-stack/perception/methods/overview.md) | Splits BEV, occupancy, dynamic Gaussian/3DGS/4DGS, LiDAR MOS, scene flow, radar-camera, 4D radar-camera occupancy, FMCW LiDAR, open-world, robust fusion, V2X, latency, and data-engine methods into single-technique research pages. |
| LiDAR artifact removal | [LiDAR Artifact Removal Techniques](30-autonomy-stack/perception/overview/lidar-artifact-removal-techniques.md) | Connects LIORNet, learned denoisers, classical outlier filters, weather artifacts, ghost/multipath behavior, map cleaning, datasets, and safety validation. |
| Dynamic and static object removal | [LiDAR Map Cleaning and Dynamic Removal](30-autonomy-stack/localization-mapping/slam-methods/lidar-map-cleaning-dynamic-removal.md) | Connects ERASOR, Removert, MapCleaner, ERASOR++, 4dNDF, FreeDOM, STATIC-LIO, MOVES, RTMap/DUFOMap, LT-mapper/Khronos, MOS/scene-flow methods, moved-object datasets, and false-deletion validation. |
| Perception coverage gaps | [Perception Coverage Audit](30-autonomy-stack/perception/overview/coverage-audit-2026.md) | Tracks missing first-class perception pages across BEV, occupancy, Gaussian/3DGS, LiDAR/radar/thermal, open-world/OOD, V2X, robustness, and benchmarks. |
| Localization and mapping | [Mapping and Localization](30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md) | Covers HD maps, LiDAR SLAM, map-free driving, map maintenance, localization, and occupancy grids. |
| Method-level 3D SLAM | [SLAM Library Overview](30-autonomy-stack/localization-mapping/slam-methods/overview.md) | Breaks classical, LiDAR, LIVO, visual, dense, neural, Gaussian, radar, and multi-sensor SLAM into focused method files. |
| SLAM coverage gaps | [SLAM Coverage Audit](30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md) | Tracks missing first-class SLAM pages, including May 2026 sweeps across LIO, LIVO, 4D radar, Gaussian/foundation SLAM, backends, collaborative SLAM, alternative sensors, and benchmarks. |
| First-principles estimator math | [Gaussian Noise and Covariance](10-knowledge-base/probability-statistics/gaussian-noise-covariance-information.md) | Starts the foundations path for Gaussian noise, Mahalanobis gating, MAP/MLE, graphical models, information theory, calibration/conformal uncertainty, Gauss-Newton, LM, Cholesky, QR/SVD, sparse solvers, association, filters, and uncertainty diagnostics. |
| Machine learning foundations | [ML Foundations Overview](10-knowledge-base/machine-learning/overview.md) | Starts from perceptrons, logits, cross-entropy, backprop, optimization, CNNs, RNNs, transformers, Mamba, JEPA, diffusion/flow objectives, EBMs, tokenization, calibration, and world-model training. |
| Control and decision foundations | [MPC and iLQR First Principles](10-knowledge-base/controls/constrained-optimization-mpc-ilqr-first-principles.md) | Connects constrained optimization, MPC, iLQR, MDPs, POMDPs, belief-space planning, and RL foundations to learned autonomy and safety envelopes. |
| Sensor and estimation fundamentals | [LiDAR Noise Models](10-knowledge-base/geometry-3d/lidar-working-principles-noise-models.md) | Starts the sensor-model foundation path: LiDAR, camera, IMU, GNSS/RTK, radar, event/thermal, timing, calibration, and wheel odometry. |
| Perception validation datasets | [FOD and Airport Apron Detection Datasets](30-autonomy-stack/perception/datasets-benchmarks/fod-and-airport-apron-detection-datasets.md) | Connects MUSES, sensor-corruption benchmarks, open-world/OOD anomaly segmentation, FOD datasets, FOD validation, and knowledge-base evaluation protocols. |
| End-to-end architecture gaps | [Knowledge Gap Backlog](90-synthesis/readiness-risk/knowledge-gap-backlog.md) | Tracks P0/P1/P2 missing research files across fundamentals, platform, autonomy, runtime/cloud, safety, operations, and industry intelligence. |

## Corpus Map

| Section | Docs | Start At | What It Holds |
|---------|------|----------|---------------|
| `00-start-here/` | 4 | [Reading Guide](00-start-here/reading-guide.md) | Reader entry points and orientation material. |
| `10-knowledge-base/` | 93 | [Gaussian Noise and Covariance](10-knowledge-base/probability-statistics/gaussian-noise-covariance-information.md) | First-principles technical notes: probability/statistics, optimization, numerical linear algebra, geometry, mapping, state estimation, sensor likelihoods, signal processing, controls, robotics, ML, calibration, and timing. |
| `20-av-platform/` | 28 | [NVIDIA Orin Technical](20-av-platform/compute/nvidia-orin-technical.md) | Compute, sensors, connectivity, drive-by-wire, power, diagnostics, ruggedization, and edge-cloud architecture. |
| `30-autonomy-stack/` | 291 | [World Models Overview](30-autonomy-stack/world-models/overview.md) | World models, perception, method-level perception, planning, localization, SLAM, simulation, VLA/VLM, E2E driving, and multi-agent systems. |
| `40-runtime-systems/` | 10 | [Production ML Deployment](40-runtime-systems/ml-deployment/production-ml-deployment.md) | ML deployment, ROS/Autoware, observability, teleoperation, software operations, and vehicle-side data logging. |
| `50-cloud-fleet/` | 20 | [Cloud Backend Infrastructure](50-cloud-fleet/data-platform/cloud-backend-infrastructure.md) | Data engines, fleet data loops, MLOps, OTA/SUMS, observability, map operations, data governance, and fleet management. |
| `60-safety-validation/` | 28 | [Certification Guide](60-safety-validation/standards-certification/certification-guide.md) | Safety case, standards, runtime assurance, verification, validation, robustness, cybersecurity, incident reporting, and evidence traceability. |
| `70-operations-domains/` | 24 | [Airside Industry Overview](70-operations-domains/airside/operations/industry-overview.md) | Airside, warehouse, yard, port, mining, agriculture, construction, road AV, delivery robot, deployment, business-case, and safety operations. |
| `80-industry-intel/` | 52 | [Company Index](INDEX.md#a-specific-company) | AV, airside, simulation, teleoperation, autonomy company profiles, market intelligence, and regulations. |
| `90-synthesis/` | 9 | [Master Synthesis](90-synthesis/master/master-synthesis.md) | Executive synthesis, POCs, readiness, risk, decision framework, architecture, gap backlog, and continuous research loop. |

## Domain Snapshot

| Technology | Docs |
|------------|------|
| World models | 18 |
| Perception | 129 |
| Method-level perception library | 85 |
| Planning | 15 |
| Localization and mapping | 104 |
| Method-level SLAM library | 88 method files + overview/audit |
| Simulation | 7 |
| VLA / VLM | 6 |
| Multi-agent and V2X | 6 |
| Robustness validation files | 4 |
| E2E driving | 6 |

| Operations | Docs |
|------------|------|
| Safety and validation | 28 |
| Deployment | 13 |
| Airside operations | 10 |
| Cross-domain operations | 9 |
| Teleoperation | 1 |

| AV Platform | Docs |
|-------------|------|
| Compute | 7 |
| Sensors | 13 |
| Networking/connectivity | 3 |
| Drive-by-wire | 2 |
| Power/electrical | 1 |
| Diagnostics | 1 |
| Ruggedization | 1 |

## Reader Notes

- The static reader is generated from this repository with VitePress and deployed through GitHub Pages.
- `README.md` becomes the site home page.
- `INDEX.md` is served as `/INDEX/` in the reader to avoid a Windows case-insensitive output collision with the homepage.
- Research content is source-of-truth Markdown; the generated site is just a browser-friendly layer over the same files.
- Internal implementation notes under `docs/superpowers/`, `.claude/`, and `.superpowers/` are excluded from the static reader.
