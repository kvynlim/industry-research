# Active Frontier Source Registry

This registry tracks where to monitor the active autonomy research frontier and how to query each source. It is a manual-first operating page for perception, SLAM/mapping, world models, VLA/VLM, datasets/benchmarks, and validation.

It owns source discovery metadata only. Candidate status remains in the canonical owners: [Perception Coverage Audit](../../30-autonomy-stack/perception/overview/coverage-audit-2026.md), [SLAM Coverage Audit](../../30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md), [Knowledge Gap Backlog](knowledge-gap-backlog.md), and [Continuous Research Loop](continuous-research-loop.md).

## How To Use This Registry

1. Scan a source or saved query at its review cadence.
2. Verify the primary source before routing: paper, project page, dataset page, benchmark page, release note, standard, or official repository.
3. Dedupe against existing registry rows, audits, canonical pages, and gap backlogs.
4. Route manually:
   - `route-to-backlog`: durable gap belongs in [Knowledge Gap Backlog](knowledge-gap-backlog.md).
   - `route-to-audit`: perception or SLAM evidence belongs in the relevant audit.
   - `route-to-loop`: process or cadence change belongs in [Continuous Research Loop](continuous-research-loop.md).
   - `watch`: relevant but not yet actionable; if it creates ongoing research work, place it in the canonical watchlist/P2 row.
   - `ignore`: out of scope, duplicate, superseded, or insufficiently primary.
5. Link the registry row to the canonical destination instead of restating the backlog item.

## Scope

| Included track | Watch for |
|---|---|
| `perception` | 3D detection, BEV, occupancy, open-world/OOD, sensor fusion, radar, event, thermal, and robustness methods. |
| `slam-mapping` | LiDAR-inertial, visual-inertial, radar, Gaussian/neural SLAM, loop closure, pose graphs, lifelong mapping, and map-change methods. |
| `world-models` | Occupancy world models, scene generation, neural simulation, 4D forecasting, diffusion planning, and closed-loop simulation. |
| `vla-vlm` | Driving VLM/VLA reliability, spatial reasoning, grounded language, action heads, and closed-loop evaluation. |
| `datasets-benchmarks` | Driving, adverse-weather, corruption, FOD, V2X, 4D radar, occupancy, and SLAM datasets/benchmarks. |
| `validation` | Closed-loop evaluation, scenario testing, uncertainty calibration, runtime monitoring, safety evidence, and fault injection. |

Out of scope: broad company tracking, market intelligence, general operations, and platform maintenance unless they directly affect one of the six active frontier tracks.

## Registry Content Model

Each source row uses stable IDs and parseable fields so a future Node checker can validate the page without changing the document model.

| Field | Purpose |
|---|---|
| `Source ID` | Stable machine-readable identifier. |
| `Source` | Human-readable source name. |
| `Source Type` | Controlled source class such as `preprint`, `venue`, `publisher-index`, `dataset`, `benchmark`, `code`, `model`, `standard`, `regulator`, `industry-lab`, or `weak-signal`. |
| `Authority Tier` | `T1`, `T2`, `T3`, or `T4`. |
| `Source Role` | Discovery role: primary evidence, aggregator, code artifact, benchmark, dataset, weak signal, or standards source. |
| `Frontier Tracks` | Comma-separated track IDs. |
| `Evidence Objects` | Expected primary evidence: paper, DOI, arXiv/OpenReview ID, repo, project page, dataset page, benchmark page, standard, release note. |
| `Native Filters` | Native categories, venue filters, search operators, alert options, or API parameters. |
| `Manual Query Pattern` | Human-readable query seed. |
| `Watch Method` | RSS, API, email alert, saved search, page watch, manual page review, or issue digest. |
| `Cadence` | Weekly, monthly, quarterly, event-driven, or conference-cycle. |
| `Last Checked` | ISO date. |
| `Next Review` | ISO date. |
| `Source Health` | Controlled health value. |
| `Automation` | `high`, `medium`, `low`, or `none`. |
| `Verification Rule` | Required primary-source check before routing. |
| `Caveats` | Short source-specific warnings. |

Authority tiers:

- `T1`: peer-reviewed venue, official benchmark/dataset, official standard, or regulator source.
- `T2`: author/lab page, official repository/model release, industry technical report, or preprint with artifacts.
- `T3`: scholarly aggregator or metadata index.
- `T4`: social, newsletter, community, vendor, or other weak signal.

Automation values:

- `high`: stable API, RSS, export, or predictable identifiers.
- `medium`: stable pages, but scraping/page-diff/manual query shaping likely.
- `low`: useful manually, brittle for scripts.
- `none`: manual-only.

Source health values:

- `active`: source works and returns relevant frontier material.
- `degraded`: filters, feeds, or result quality have weakened but remain useful.
- `paused`: temporarily noisy, unavailable, or off-cycle.
- `retired`: no longer useful; replacement or rationale belongs in caveats.
- `moved`: source appears relocated; keep old URL until manually verified.
- `stale`: review date has expired; content is not automatically wrong.
- `unreachable`: last check failed; requires retry or manual review.
- `withdrawn-or-retracted`: only set after primary-source confirmation.
- `license-or-access-limited`: source exists but use or redistribution is constrained.
- `unknown`: automation could not determine status.

## Source Categories

| Category | Example sources | Role |
|---|---|---|
| Preprints and metadata | arXiv, OpenReview, Semantic Scholar, OpenAlex, Crossref, DBLP | Early discovery and metadata cross-checking. |
| Core venues | CVPR, ICCV, ECCV, WACV, NeurIPS, ICML, ICLR, CoRL, RSS, ICRA, IROS, IEEE IV, ITSC | Accepted paper and workshop tracking. |
| Publisher indexes | IEEE Xplore, ACM Digital Library, SpringerLink, ScienceDirect, SAGE/IJRR, SAE | Final proceedings, journals, robotics/control/sensor papers. |
| Datasets and benchmarks | Waymo Open Dataset, nuScenes, Argoverse, KITTI/SemanticKITTI, nuPlan, CARLA Leaderboard, NAVSIM, Bench2Drive, OpenLane/OpenLane-V2, V2X, adverse-weather, corruption, and SLAM benchmarks | Dataset and evaluation freshness. |
| Code and model artifacts | GitHub, Hugging Face, official project pages, OpenMMLab, OpenPCDet, Autoware/ROS ecosystems | Reproducibility and release signals. |
| Simulation and validation infrastructure | CARLA, CommonRoad, Scenic, MetaDrive, Waymax, ASAM OpenSCENARIO, ASAM OpenODD, ASAM OpenDRIVE | Closed-loop and scenario-evidence monitoring. |
| Safety and regulatory frontier | ISO 21448/SOTIF, ISO 26262, UL 4600, SAE, UNECE, NHTSA ADS materials | Validation, assurance, and standards signals. |
| Industry research | Waymo, NVIDIA, Waabi, Toyota/Woven, Mobileye, Bosch, Aurora, Zoox, Tesla AI | Production-adjacent technical signals. |
| Sensor frontier | LiDAR, 4D radar, FMCW LiDAR, event-camera, and thermal vendors; SPIE/SAE/IEEE sensor papers; patents and application notes | Hardware-driven perception and SLAM frontier signals. |
| Weak signals | Lab pages, newsletters, challenge pages, curated GitHub lists, social/community posts | Discovery only; never sufficient for promotion. |

## Source Registry

| Source ID | Source | Source Type | Authority Tier | Source Role | Frontier Tracks | Evidence Objects | Native Filters | Manual Query Pattern | Watch Method | Cadence | Last Checked | Next Review | Source Health | Automation | Verification Rule | Caveats |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `arxiv-cs-cv` | [arXiv cs.CV](https://arxiv.org/list/cs.CV/recent) | `preprint` | `T2` | preprint discovery | `perception`, `world-models`, `vla-vlm`, `datasets-benchmarks` | paper, arXiv ID, project page, repo | `cat:cs.CV`, recent submissions | `autonomous driving` plus occupancy, BEV, 3D detection, OOD, VLM, world model | RSS/API | weekly | 2026-05-12 | 2026-05-19 | `active` | `high` | Verify paper page and artifact links before routing. | Preprint quality varies; dedupe against conference versions. |
| `arxiv-cs-ro` | [arXiv cs.RO](https://arxiv.org/list/cs.RO/recent) | `preprint` | `T2` | preprint discovery | `slam-mapping`, `validation`, `datasets-benchmarks` | paper, arXiv ID, repo, dataset page | `cat:cs.RO`, recent submissions | SLAM, odometry, mapping, pose graph, closed-loop evaluation, benchmark | RSS/API | weekly | 2026-05-12 | 2026-05-19 | `active` | `high` | Verify robotics relevance and primary artifacts before routing. | Many generic robotics papers need AV relevance filters. |
| `arxiv-eess-iv` | [arXiv eess.IV](https://arxiv.org/list/eess.IV/recent) | `preprint` | `T2` | preprint discovery | `perception`, `datasets-benchmarks` | paper, arXiv ID, repo | `cat:eess.IV`, recent submissions | image/video perception, event camera, thermal, sensor fusion, driving scenes | RSS/API | weekly | 2026-05-12 | 2026-05-19 | `active` | `high` | Verify driving or robotic perception fit before routing. | Medical and generic image papers require negative filtering. |
| `arxiv-eess-sy` | [arXiv eess.SY](https://arxiv.org/list/eess.SY/recent) | `preprint` | `T2` | preprint discovery | `validation`, `slam-mapping` | paper, arXiv ID, repo | `cat:eess.SY`, recent submissions | control, safety, runtime verification, uncertainty, fault injection, localization | RSS/API | weekly | 2026-05-12 | 2026-05-19 | `active` | `high` | Verify autonomy or safety-case relevance before routing. | Broad systems/control category can be noisy. |
| `openreview-venues` | [OpenReview venues](https://openreview.net/venues) | `venue` | `T1` | open-review venue discovery | `world-models`, `vla-vlm`, `perception`, `validation` | paper, OpenReview ID, decision, reviews | venue invitation, title, abstract, decision | ICLR, ICML, NeurIPS, CoRL with driving, embodied, world model, VLA, robustness | API/manual | weekly | 2026-05-12 | 2026-05-19 | `active` | `medium` | Verify venue decision and official paper page before routing. | Venue fields differ and API versions vary. |
| `cvf-openaccess` | [CVF Open Access](https://openaccess.thecvf.com/menu) | `venue` | `T1` | proceedings discovery | `perception`, `world-models`, `vla-vlm`, `datasets-benchmarks` | paper, proceedings page, project page, repo | conference year, title search | CVPR, ICCV, ECCV, WACV with occupancy, BEV, 3D, driving, VLM, dataset | manual/page watch | conference-cycle | 2026-05-12 | 2026-08-12 | `active` | `medium` | Verify official CVF page and artifact links before routing. | Static pages are stable but not a clean API. |
| `pmlr-proceedings` | [PMLR Proceedings](https://proceedings.mlr.press/) | `venue` | `T1` | proceedings discovery | `world-models`, `vla-vlm`, `validation` | paper, proceedings page, PDF | proceedings volume, title search | CoRL, ICML, AISTATS with robotics, driving, world model, policy, evaluation | manual/page watch | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify proceedings record and project artifacts before routing. | Some relevant venues use OpenReview instead. |
| `rss-proceedings` | [Robotics: Science and Systems](https://roboticsconference.org/) | `venue` | `T1` | proceedings discovery | `slam-mapping`, `validation`, `datasets-benchmarks` | paper, proceedings page, project page, repo | conference year, title search | SLAM, mapping, localization, multi-robot, benchmark, field robotics | manual/page watch | conference-cycle | 2026-05-12 | 2026-08-12 | `active` | `medium` | Verify official RSS paper page before routing. | Proceedings page structure changes by year. |
| `icra` | [IEEE RAS ICRA](https://www.ieee-ras.org/conferences-workshops/fully-sponsored/icra) | `venue` | `T1` | proceedings discovery | `slam-mapping`, `perception`, `validation`, `datasets-benchmarks` | paper, DOI, IEEE record, project page | program, title, keywords, IEEE Xplore | SLAM, odometry, mapping, field robotics, planning, evaluation, datasets | manual/page watch | conference-cycle | 2026-05-12 | 2026-08-12 | `active` | `low` | Verify official program or IEEE record before routing. | Final metadata often lands in IEEE Xplore. |
| `iros` | [IEEE RAS IROS](https://www.ieee-ras.org/conferences-workshops/financially-co-sponsored/iros) | `venue` | `T1` | proceedings discovery | `slam-mapping`, `perception`, `validation` | paper, DOI, IEEE record, project page | program, title, keywords, IEEE Xplore | robust perception, SLAM, localization, mapping, multi-robot, safety | manual/page watch | conference-cycle | 2026-05-12 | 2026-08-12 | `active` | `low` | Verify official program or IEEE record before routing. | Program pages and accepted-paper lists vary by year. |
| `ieee-xplore` | [IEEE Xplore](https://ieeexplore.ieee.org/Xplore/home.jsp) | `publisher-index` | `T1` | publisher record | `perception`, `slam-mapping`, `validation`, `datasets-benchmarks` | DOI, publisher page, abstract, venue | publication title, year, author, IEEE terms | IV, ITSC, ICRA, IROS, T-RO, RA-L with driving, SLAM, sensor fusion, safety | saved search/API | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify publisher record and avoid relying on abstract-only claims. | API access requires credentials; many records are paywalled. |
| `acm-dl` | [ACM Digital Library](https://dl.acm.org/) | `publisher-index` | `T1` | publisher record | `vla-vlm`, `world-models`, `validation` | DOI, publisher page, conference page | title, abstract, venue, date | embodied AI, HRI, simulation, evaluation, foundation models, safety | saved search/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `low` | Verify DOI and official paper page before routing. | Less central for AV but useful for HRI and embodied-AI overlap. |
| `semantic-scholar` | [Semantic Scholar](https://www.semanticscholar.org/) | `publisher-index` | `T3` | metadata aggregator | `perception`, `slam-mapping`, `world-models`, `vla-vlm`, `validation` | paper metadata, DOI, arXiv ID, citations | query, field of study, date | exact method names, citation trails, related work, code links | API/manual | weekly | 2026-05-12 | 2026-05-19 | `active` | `medium` | Use only to discover or cross-check primary sources. | Aggregator metadata can lag or merge records incorrectly. |
| `openalex` | [OpenAlex](https://openalex.org/) | `publisher-index` | `T3` | metadata aggregator | `perception`, `slam-mapping`, `world-models`, `validation` | DOI, venue, authors, concepts | works search, concept, date | topic discovery, publication date checks, DOI lookup | API/manual | weekly | 2026-05-12 | 2026-05-19 | `active` | `high` | Use only to discover or cross-check primary sources. | Concept tags are broad and require manual validation. |
| `dblp` | [DBLP](https://dblp.org/search) | `publisher-index` | `T3` | bibliographic index | `perception`, `slam-mapping`, `world-models`, `vla-vlm` | venue record, author record, DOI link | author, title, venue, year | venue completeness, author/lab follow-up, accepted paper cross-check | manual/API | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Use for bibliographic cross-checking, not promotion alone. | Does not provide technical evidence. |
| `github-search` | [GitHub Search](https://github.com/search) | `code` | `T2` | code artifact discovery | `perception`, `slam-mapping`, `world-models`, `vla-vlm`, `datasets-benchmarks` | repo, release, license, README, issues | topic, language, stars, pushed date | autonomous-driving occupancy SLAM VLM dataset benchmark stars pushed | API/manual | weekly | 2026-05-12 | 2026-05-19 | `active` | `high` | Verify official repo link from paper/project page before routing. | Stars are weak evidence; do not clone arbitrary repos in CI. |
| `huggingface-papers` | [Hugging Face Papers](https://huggingface.co/papers) | `model` | `T3` | model and paper discovery | `world-models`, `vla-vlm`, `perception`, `datasets-benchmarks` | paper, model card, dataset card, license | papers, models, datasets, date | driving VLM, robot foundation model, world model, occupancy, dataset | manual/API | weekly | 2026-05-12 | 2026-05-19 | `active` | `medium` | Verify canonical paper and license before routing. | Trending pages are discovery signals only. |
| `waymo-open` | [Waymo Open Dataset](https://waymo.com/open/) | `dataset` | `T1` | dataset and challenge source | `datasets-benchmarks`, `perception`, `world-models`, `validation` | dataset page, challenge page, paper, license | challenge, task, release note | 3D detection, motion, occupancy, E2E, simulation, challenge updates | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify official release notes and task definitions before routing. | Terms and benchmark splits matter for claims. |
| `nuscenes` | [nuScenes](https://www.nuscenes.org/) | `dataset` | `T1` | dataset and benchmark source | `perception`, `datasets-benchmarks`, `validation` | dataset page, benchmark, devkit, license | task, benchmark, release | detection, tracking, prediction, occupancy, map, sensor fusion | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify benchmark task and devkit version before routing. | Older but still central; watch for derivative benchmarks. |
| `argoverse` | [Argoverse](https://www.argoverse.org/) | `dataset` | `T1` | dataset and benchmark source | `datasets-benchmarks`, `perception`, `world-models`, `validation` | dataset page, benchmark, paper, license | task, benchmark, release | motion forecasting, sensor dataset, maps, E2E, scenario mining | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify official task page before routing. | Derivative papers may use outdated versions. |
| `kitti` | [KITTI](https://www.cvlibs.net/datasets/kitti/) | `dataset` | `T1` | legacy benchmark source | `perception`, `slam-mapping`, `datasets-benchmarks` | dataset page, benchmark page, paper | task, benchmark, raw data | odometry, object detection, tracking, semantic scene completion | manual | quarterly | 2026-05-12 | 2026-08-12 | `active` | `low` | Verify task relevance and avoid over-weighting legacy leaderboard claims. | Useful baseline but not representative of modern AV stacks alone. |
| `carla-leaderboard` | [CARLA Leaderboard](https://leaderboard.carla.org/) | `benchmark` | `T1` | closed-loop benchmark source | `validation`, `world-models`, `vla-vlm` | benchmark page, paper, code, scenario definitions | leaderboard, challenge, route, scenario | closed-loop driving, leaderboard, agent robustness, scenario evaluation | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify scenario version and leaderboard rules before routing. | Synthetic benchmark claims need real-world caveats. |
| `navsim` | [NAVSIM](https://navsim.github.io/) | `benchmark` | `T1` | closed-loop evaluation source | `validation`, `world-models`, `vla-vlm` | benchmark page, paper, code | task, metric, release | open-loop and closed-loop planning, E2E evaluation, driving score | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify official task and metric definitions before routing. | Benchmark versions can change quickly. |
| `bench2drive` | [Bench2Drive](https://bench2drive.github.io/) | `benchmark` | `T1` | closed-loop benchmark source | `validation`, `vla-vlm`, `world-models` | benchmark page, paper, code | task, metric, scenario | closed-loop driving, VLM/VLA evaluation, long-tail scenarios | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify official benchmark page and code before routing. | CARLA-based results need sim-to-real caveats. |
| `asam-openx` | [ASAM Standards](https://www.asam.net/standards/) | `standard` | `T1` | scenario and ODD standard source | `validation`, `datasets-benchmarks` | standard page, release notes, schema | OpenSCENARIO, OpenODD, OpenDRIVE | scenario testing, ODD, road network, simulation evidence | page watch/manual | quarterly | 2026-05-12 | 2026-08-12 | `active` | `low` | Verify official standard version before routing. | Access and versioning differ across standards. |
| `nhtsa-ads` | [NHTSA Automated Vehicles Safety](https://www.nhtsa.gov/vehicle-safety/automated-vehicles-safety) | `regulator` | `T1` | regulator source | `validation` | official guidance, rulemaking, reporting page | ADS, crash reporting, guidance, exemptions | ADS safety, reporting, post-market monitoring, incident evidence | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `low` | Verify official docket, rule, or guidance page before routing. | Date-sensitive; do not infer final rules from proposals. |
| `nvidia-research` | [NVIDIA Research](https://research.nvidia.com/) | `industry-lab` | `T2` | industry research source | `perception`, `world-models`, `vla-vlm`, `validation` | paper, project page, code, dataset, model | publication page, project page, date | Cosmos, simulation, 3D perception, world models, autonomous driving | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify paper/project artifacts and license before routing. | Product pages and research pages should not be mixed. |
| `waymo-research` | [Waymo Research](https://waymo.com/research/) | `industry-lab` | `T2` | industry research source | `perception`, `world-models`, `datasets-benchmarks`, `validation` | paper, dataset, benchmark, technical report | publication page, date, topic | safety, simulation, datasets, planning, perception, E2E driving | page watch/manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `medium` | Verify official paper or dataset page before routing. | Company claims should stay attributed. |
| `researchgate` | [ResearchGate](https://www.researchgate.net/) | `weak-signal` | `T4` | author follow-up source | `perception`, `slam-mapping`, `world-models`, `vla-vlm`, `datasets-benchmarks`, `validation` | author page, project update, paper pointer | author, topic, project | exact author or method follow-up after primary source discovery | manual | monthly | 2026-05-12 | 2026-06-12 | `active` | `none` | Use only to find a primary source elsewhere. | Not reliable as canonical evidence and not suitable for automation. |

## Active Frontier Query Bank

| Query ID | Track | Source IDs | Query Pattern | Native Filters | Intent | Cadence |
|---|---|---|---|---|---|---|
| `perception-occupancy` | `perception` | `arxiv-cs-cv`, `cvf-openaccess`, `openreview-venues`, `semantic-scholar` | `"occupancy" AND "autonomous driving"` plus `BEV`, `panoptic`, `semantic occupancy`, `open occupancy` | `cat:cs.CV`, CVPR/ICCV/WACV, recent date | Find occupancy perception methods and benchmarks. | weekly |
| `perception-open-world` | `perception` | `arxiv-cs-cv`, `cvf-openaccess`, `huggingface-papers`, `github-search` | `"open-vocabulary 3D"` OR `"open-world" OR "OOD" OR "anomaly segmentation"` plus driving | `cat:cs.CV`, project/repo links | Find open-world, OOD, and rare-object perception methods. | weekly |
| `perception-radar-sensor` | `perception` | `arxiv-eess-iv`, `ieee-xplore`, `icra`, `iros` | `"4D radar"` OR `"FMCW LiDAR"` OR `"event camera"` OR `"thermal"` plus driving or robotics | `cat:eess.IV`, IEEE IV/ITSC/ICRA/IROS | Find sensor-frontier perception and fusion work. | weekly |
| `slam-lio-radar` | `slam-mapping` | `arxiv-cs-ro`, `icra`, `iros`, `rss-proceedings`, `ieee-xplore` | `"LiDAR-inertial odometry"` OR `"radar odometry"` OR `"visual-inertial SLAM"` plus benchmark | `cat:cs.RO`, ICRA/IROS/RSS, T-RO/RA-L | Find SLAM, odometry, and localization methods. | weekly |
| `slam-map-change` | `slam-mapping` | `arxiv-cs-ro`, `rss-proceedings`, `semantic-scholar`, `github-search` | `"lifelong mapping"` OR `"map change detection"` OR `"dynamic object removal"` OR `"pose graph optimization"` | `cat:cs.RO`, recent date, repo links | Find map hygiene, lifelong mapping, and backend gaps. | weekly |
| `world-models-driving` | `world-models` | `arxiv-cs-cv`, `openreview-venues`, `cvf-openaccess`, `pmlr-proceedings`, `nvidia-research` | `"driving world model"` OR `"occupancy world model"` OR `"4D occupancy forecasting"` OR `"neural simulation"` | `cat:cs.CV`, OpenReview venues, CVF | Find frontier driving world-model and simulation papers. | weekly |
| `vla-vlm-driving` | `vla-vlm` | `arxiv-cs-cv`, `openreview-venues`, `huggingface-papers`, `github-search` | `"driving VLM"` OR `"vision-language-action"` OR `"spatial reasoning"` OR `"action head"` plus driving or robot | `cat:cs.CV`, OpenReview, model cards | Find driving VLM/VLA methods and reliability benchmarks. | weekly |
| `datasets-adverse-fod` | `datasets-benchmarks` | `waymo-open`, `nuscenes`, `argoverse`, `kitti`, `arxiv-cs-cv`, `semantic-scholar` | `"adverse weather dataset"` OR `"sensor corruption"` OR `"FOD"` OR `"V2X dataset"` OR `"4D radar dataset"` | dataset release pages, benchmark pages | Find datasets and benchmarks that should feed audits. | monthly |
| `validation-closed-loop` | `validation` | `carla-leaderboard`, `navsim`, `bench2drive`, `openreview-venues`, `pmlr-proceedings` | `"closed-loop evaluation"` OR `"scenario testing"` OR `"distribution shift"` OR `"fault injection"` | benchmark task, metrics, recent date | Find validation protocols and closed-loop benchmarks. | monthly |
| `validation-standards` | `validation` | `asam-openx`, `nhtsa-ads`, `ieee-xplore` | `"OpenSCENARIO"` OR `"OpenODD"` OR `"ADS safety"` OR `"runtime monitor"` OR `"safety case"` | standard version, official guidance, publication date | Find scenario-evidence, safety, and regulatory updates. | monthly |

Cross-cutting modifiers:

- `autonomous driving`
- `self-driving`
- `ego vehicle`
- `driving scenes`
- `closed-loop`
- `ODD`
- `sim-to-real`
- `long-tail`
- `safety-critical`

Negative filters:

- Add `NOT medical` when image or segmentation queries return medical imaging.
- Add `NOT satellite` when perception queries return remote-sensing papers.
- Add `NOT generic LLM` when VLM queries lose driving or robotics grounding.
- Add `NOT manipulation` when robotics queries are unrelated to vehicle autonomy.

## Candidate Routing

This registry owns source discovery only. Candidate status is maintained in the canonical owner, not in this page.

| Candidate type | Canonical owner after triage |
|---|---|
| Perception methods, perception robustness, perception datasets | [Perception Coverage Audit](../../30-autonomy-stack/perception/overview/coverage-audit-2026.md) |
| SLAM, odometry, localization, mapping methods, SLAM benchmarks | [SLAM Coverage Audit](../../30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md) |
| World models, VLA/VLM, end-to-end driving, simulation frontier | [Knowledge Gap Backlog](knowledge-gap-backlog.md) until a dedicated audit exists |
| Cross-track datasets and benchmarks | Owning domain audit if method-specific; otherwise [Knowledge Gap Backlog](knowledge-gap-backlog.md) |
| Validation, safety evidence, evaluation protocols | [Knowledge Gap Backlog](knowledge-gap-backlog.md) or relevant `60-safety-validation/` page |

Promotion rule:

A candidate can be promoted only after primary-source verification: canonical paper/DOI/arXiv/OpenReview ID, official repo or project page where available, dataset/benchmark page if relevant, artifact/license/access notes, validation or benchmark claim, and at least one caveat.

Candidate flow:

`source scan -> primary-source verification -> dedupe -> canonical backlog/audit -> atomic page or watchlist`

## Workflow And Automation

### Manual-First Boundary

The registry is a manual-first intake surface. Automation may validate structure, report diagnostics, and produce candidate digests. It must not edit canonical backlogs, route candidates, delete sources, promote work, or replace primary-source evidence with aggregator metadata.

### Review Cadence And Gates

- Weekly: review new candidates and automation notes, dedupe them, and assign a routing decision.
- Monthly: prune stale `watch` traces, confirm canonical links still resolve, and close entries that have been routed.
- Quarterly: review whether source categories, scope boundaries, or automation checks need adjustment in [Continuous Research Loop](continuous-research-loop.md).

Human review is required before any source changes canonical backlog, audit, or loop content. A source may be routed only after primary-source verification and dedupe are complete.

### Automation Phases

- Phase 0: Markdown-only registry.
- Phase 1: offline Node checker validates IDs, enums, required fields, ISO dates, duplicate IDs/URLs, source-health values, stale review dates, and canonical links.
- Phase 2: opt-in Node scanner creates review artifacts only: dated Markdown digest, raw-result manifest/cache, and skipped/error summary.
- Phase 3: scheduled GitHub Action may open a review issue or upload artifacts. It must not commit edits or modify canonical files.

### CI And Fetch Policy

Normal PR checks stay offline and deterministic: schema checks, internal links, tests, and VitePress build.

Live source fetching runs only through manual commands or scheduled jobs. Scheduled fetches must use provider allowlists, short timeouts, bounded retries, low concurrency, per-provider budgets, stable user-agent strings, cached responses where permitted, and secrets only from GitHub Actions or local environment variables.

Missing API keys skip that provider rather than failing the build.

### Failure, Security, And Terms

External failures produce diagnostics, not content changes. API outages, 403/429 responses, DNS/TLS failures, malformed data, and schema drift should be recorded as `unknown` or `unreachable` until manually reviewed.

No API keys, cookies, signed URLs, or tokens belong in Markdown, VitePress output, logs, or PR jobs. Scheduled jobs should use least permissions, such as `contents: read` and `issues: write`.

Use official APIs where possible. Do not store copied abstracts, paper bodies, README bodies, fetched PDFs, dataset contents, or large scraped text. Store metadata, URLs, license/access notes, and human-written review notes.

### Testing Split

Run on PRs:

- Registry schema validation.
- Internal link checks.
- VitePress build.
- Fixture-based parser tests.
- Deterministic diagnostic snapshots.
- Secret-pattern checks.

Run only manually or on schedule:

- Live provider smoke tests.
- Freshness scans.
- Source-health reports.
- Candidate discovery digests.

## Later Automation Feasibility

Initial high-feasibility automation sources:

- arXiv API/RSS
- GitHub Search API
- OpenAlex API

Medium-feasibility sources:

- Semantic Scholar API
- OpenReview API
- CVF static proceedings pages
- stable dataset/benchmark pages

Manual-only or weak automation sources:

- vendor blogs
- benchmark leaderboards with changing HTML
- standards pages behind access controls
- ResearchGate
- social/news/community sources

Provider limits must be configuration, not hidden constants. arXiv expects polite delays and bounded slices; GitHub search uses separate rate buckets and secondary limits; Semantic Scholar and OpenAlex have key-dependent throughput; OpenReview has venue-specific fields and API-version differences.

## Sources

- arXiv API user manual: https://info.arxiv.org/help/api/user-manual.html
- arXiv RSS help: https://info.arxiv.org/help/rss.html
- arXiv category taxonomy: https://arxiv.org/category_taxonomy
- OpenReview API: https://docs.openreview.net/getting-started/using-the-api
- IEEE developer API documentation: https://developer.ieee.org/docs/read/Home
- GitHub Search API: https://docs.github.com/en/rest/search/search
- OpenAlex API: https://docs.openalex.org/
- Semantic Scholar API: https://api.semanticscholar.org/api-docs/
- CVF Open Access: https://openaccess.thecvf.com/menu
- ASAM OpenSCENARIO: https://publications.pages.asam.net/standards/ASAM_OpenSCENARIO/ASAM_OpenSCENARIO_XML/latest/00_preface/01_introduction.html
- ASAM OpenODD: https://www.asam.net/standards/detail/openodd/
- NHTSA automated vehicles safety: https://www.nhtsa.gov/vehicle-safety/automated-vehicles-safety
- ISO 21448: https://www.iso.org/standard/77490.html
