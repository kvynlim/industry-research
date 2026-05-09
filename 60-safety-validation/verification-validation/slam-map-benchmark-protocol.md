# SLAM Map Benchmark Protocol

**Last updated:** 2026-05-09

## Purpose

This protocol defines a repeatable benchmark for SLAM, localization, map construction, and map-update pipelines used by airside autonomous ground vehicles. It combines public SLAM benchmarks for comparability with internal airside datasets for release evidence.

The benchmark supports the [perception-SLAM evidence case](perception-slam-map-reliability-evidence-case.md), [statistical validity protocol](perception-slam-statistical-validity-protocol.md), [uncertainty calibration release gates](uncertainty-calibration-perception-slam-release-gates.md), [corruption and fault injection protocol](robustness/perception-slam-corruption-fault-injection-protocol.md), and [airside dynamic map cleaning benchmark](airside-dynamic-map-cleaning-benchmark.md).

## Benchmark Tiers

| Tier | Dataset type | Purpose | Release use |
|---|---|---|---|
| B0 smoke | Short internal routes and synthetic checks | Detect pipeline/config regressions quickly | Required for every build |
| B1 public comparability | KITTI, TUM RGB-D, Oxford RobotCar, Boreas, SLAMBench-compatible data | Compare against known methods and stress basic generalization | Supporting evidence only |
| B2 airside replay | Logged airport routes with ground truth and labels | Measure ODD-relevant performance | Required for release |
| B3 closed-course | Instrumented test track with fixtures/FOD/GSE/aircraft mockups | Measure safety-critical geometry and edge cases | Required for new ODD or major change |
| B4 shadow mode | Real operational route exposure under supervision | Confirm operational distribution and long-tail alerts | Required before autonomous expansion |

## Public Benchmark Anchors

| Benchmark | What it contributes | Limitation for airside release |
|---|---|---|
| KITTI odometry | Standard visual/LiDAR odometry metrics across urban driving sequences | Road domain; limited airport-specific actors/weather |
| TUM RGB-D | Ground-truth visual/RGB-D SLAM and ATE/RPE evaluation tooling | Indoor/small-scale; not representative of outdoor apron geometry |
| Oxford RobotCar | Repeated route over long time, appearance change, urban dynamics | Road domain; useful for long-term localization and map aging |
| Boreas | Repeated route with seasonal/weather changes, LiDAR/radar/camera and ground truth | Road domain; strong proxy for adverse weather and multi-season drift |
| SLAMBench | Reproducible SLAM benchmarking with accuracy/performance/energy focus | Primarily research harness; adapt carefully to production stack |
| MapBench | Robustness of HD map construction under sensor corruptions | Road HD map domain; useful for corruption thinking |

Public datasets cannot prove airside safety. They are used to catch generic regressions, maintain reproducibility, and compare algorithms before internal airside release testing.

## Internal Airside Dataset Requirements

| Dataset slice | Minimum content |
|---|---|
| Route repeats | Same route across day/night, dry/wet, quiet/busy operations |
| Stand pairs | Aircraft absent/present, GSE staged/removed, chocks/cones/FOD present/absent |
| Depot changes | Frequent temporary-object changes and parked-fleet clutter |
| Taxiway crossing support | Weak-feature open areas, geofence boundaries, clearance-state context |
| Weather | Heavy rain/wet surface if in ODD; fog/snow/ice/de-icing if in ODD |
| Ground truth | Survey, RTK/INS, total station, overhead tracking, or human-adjudicated labels |
| Map lifecycle | Source traversals, map build date, tile hashes, reviewer decisions, publication state |

## Metrics

### Localization and SLAM

| Metric | Definition | Report by |
|---|---|---|
| ATE | Absolute trajectory error after alignment appropriate to use case | Route, zone, weather, map age |
| RPE | Relative pose error over fixed distance/time windows | Speed, turn class, surface |
| Drift rate | Translation/yaw error per 100 m or per minute | Feature density and GNSS status |
| Loop-closure error | Residual before/after loop closure and wrong-loop incidence | Route repeat and map tile |
| Relocalization success | Recovery after deliberate localization loss or start from unknown pose | Zone and initial uncertainty |
| Localization availability | Time pose remains valid inside error envelope | Mission and ODD slice |
| Runtime | CPU/GPU/memory/latency and dropped-frame rate | Hardware config and logging tier |

### Map Quality

| Metric | Definition | Safety use |
|---|---|---|
| Map alignment error | Difference between map features and surveyed/reference geometry | Protects geofence and path alignment |
| Static preservation | Valid permanent features retained | Prevents loss of localization anchors |
| Dynamic rejection | Dynamic actor points excluded from permanent static layer | Prevents ghosts |
| False-free-space rate | Occupied/hazardous space marked traversable | Critical release blocker |
| Unknown-space conservatism | Correctly marks insufficiently observed areas unknown | Prevents optimistic maps |
| Movable-static routing | Temporary objects sent to review/quarantine | Prevents unsafe map publication |
| Tile consistency | Seam continuity, frame consistency, no duplicate/stale tile | Protects runtime map lookup |

### Semantic and Safety Layers

| Layer | Required checks |
|---|---|
| Permanent static | Buildings, poles, curbs, terminal edges, fixed markings, fixtures |
| Movable-static | Cones, barriers, parked carts, parked aircraft/GSE, chocks |
| Dynamic | People, moving GSE, aircraft movement, service vehicles |
| FOD/hazard | Small objects preserved as current hazards, not cleaned away |
| Geofence/route | No mismatch between map, route graph, and restricted zones |
| Unknown/review | Ambiguous regions are not promoted to free space |

## Benchmark Procedure

1. Freeze candidate build, map package, calibration, and benchmark manifest.
2. Run B0 smoke checks on every build.
3. Run B1 public benchmark suite for algorithm comparability and regression detection.
4. Run B2 airside replay using locked partitions and pre-defined ODD slices.
5. Run B3 closed-course tests for critical geometry, FOD, temporary objects, and sensor degradation.
6. Run B4 shadow-mode route exposure for operational confirmation.
7. Produce metric report, failure packets, and release recommendation.
8. Quarantine any map tile with unresolved critical defects.

## Statistical Decision Rules

Use [perception-SLAM statistical validity protocol](perception-slam-statistical-validity-protocol.md) for confidence intervals and sample independence. Benchmark-specific rules:

| Decision | Rule |
|---|---|
| Public benchmark regression | Candidate must not regress beyond pre-set tolerance against production baseline |
| Airside release | Each critical ODD slice must pass; aggregate pass is insufficient |
| Map tile publication | Tile passes only if source traversals, geometry, semantic layers, and review status pass |
| New airport | Treat as new B2/B3/B4 campaign; do not rely on another airport's sample counts |
| Inconclusive slice | Release excludes that slice or campaign continues |

## Failure Modes and Diagnostics

| Failure mode | Diagnostic |
|---|---|
| Wrong global alignment | ATE spike, geofence mismatch, survey residual |
| Local drift in weak-feature area | RPE/drift rate by feature density |
| Wrong loop closure | Topological inconsistency, residual jump, route discontinuity |
| Dynamic object ghost | Aircraft/GSE/person points in permanent layer |
| Map changed after survey | Scan-to-map residual trend and map-change detector |
| False-free-space | Occupancy/semantic layer comparison against labels/fixtures |
| Over-cleaning small hazards | FOD/chock/cone missing from hazard/current-world layer |
| Runtime overload | Latency, dropped frames, stale pose consumed by planner |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Benchmark manifest | Build/map/calibration IDs, dataset partitions, route/tile list |
| Ground-truth package | Survey files, RTK/INS logs, label files, uncertainty model |
| Metric report | Tables, plots, confidence intervals, public and internal benchmark results |
| Map QA report | Tile status, semantic-layer checks, reviewer decisions |
| Failure packet | Reproducible log slice, seed/config, expected vs actual, defect ID |
| Runtime report | Latency, memory, CPU/GPU, dropped frames, watchdog events |
| Release recommendation | Pass, pass with ODD restriction, inconclusive, or block |

## Owner Handoffs

| Owner | Responsibility |
|---|---|
| Benchmark owner | Manifest, harness, reproducibility, metric report |
| Mapping owner | Map build, tile QA, source traversals, publication readiness |
| Perception/SLAM owner | Candidate stack, metrics, root cause analysis |
| Data platform owner | Dataset curation, partition locks, storage, metadata |
| Safety lead | Critical thresholds and release interpretation |
| Fleet operations | Shadow-mode execution and route/airport exposure |

## Sources

- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- TUM RGB-D SLAM Dataset and Benchmark: https://cvg.cit.tum.de/data/datasets/rgbd-dataset
- Oxford RobotCar Dataset: https://robotcar-dataset.robots.ox.ac.uk/
- Oxford RobotCar IJRR paper: https://robotcar-dataset.robots.ox.ac.uk/images/robotcar_ijrr.pdf
- Boreas multi-season autonomous driving dataset: https://www.boreas.utias.utoronto.ca/
- Boreas paper: https://arxiv.org/abs/2203.10168
- SLAMBench repository: https://github.com/pamela-project/slambench
- SLAMBench paper: https://arxiv.org/abs/1410.2167
- SLAMBench2 paper: https://arxiv.org/abs/1808.06820
- MapBench project: https://mapbench.github.io/
- Waymo Open Dataset: https://waymo.com/open/
- ISO 34502:2022, scenario-based safety evaluation framework: https://www.iso.org/standard/78951.html
