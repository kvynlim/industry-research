# Perception-SLAM Leaderboard Interpretation

**Last updated:** 2026-05-09

## Purpose

Public perception and SLAM leaderboards are useful for comparability, regression detection, and method selection. They are not release evidence by themselves for airside autonomy. This guide explains how to interpret KITTI, nuScenes, Waymo Open Dataset, OpenAD/OOD, Hilti, and internal airside benchmark metrics when deciding whether a perception-SLAM stack is ready for deployment.

## Interpretation Rules

1. Treat public leaderboard scores as B1 evidence: useful, reproducible, and comparable, but not ODD-specific.
2. Require internal airside B2/B3/B4 evidence before release.
3. Compare candidate against the current production baseline under the same code, inputs, runtime, and post-processing where possible.
4. Report metrics by ODD slice, class, range, weather, lighting, map age, sensor kit, and route zone.
5. Include runtime latency, memory, dropped frames, calibration sensitivity, and monitor actions. Accuracy without deployability is not release-ready.
6. Never convert a single headline score into a safety claim.

## Public Metrics and Pitfalls

| Source | Metric anchor | Useful for | Pitfall |
|---|---|---|---|
| KITTI object | AP/AOS, class IoU thresholds, easy/moderate/hard | Basic detection regression and historical comparability | Road-domain, limited airside objects, small test set by modern standards |
| KITTI odometry | Translational error percent and rotational error over subsequences | Odometry drift comparability | Does not cover airside weak-feature aprons or map-change operations |
| nuScenes detection | mAP plus NDS with translation/scale/orientation/velocity/attribute errors | Multi-sensor 3D detection quality beyond AP | NDS weighting may not match safety cost of false-free-space or aircraft clearance |
| nuScenes tracking | AMOTA/AMOTP plus MOTA/MOTP/IDS/FP/FN | Tracking stability and identity behavior | Confidence-threshold optimization can hide safety-specific low-recall issues |
| Waymo Open Dataset | 2D/3D detection, tracking, segmentation, motion/e2e tasks | Large-scale, diverse perception comparison | Waymo states dataset is for research, not real-life vehicle performance evaluation |
| OpenAD | Open-world 3D object detection and corner cases | Open-set and cross-dataset capability | Still road-centric and benchmark ontology may not include airside hazards |
| ProOOD/OOD occupancy | OOD voxel/object scoring, occupancy mIoU, AUPR/AUROC-style OOD metrics | Unknown/novel occupancy risk thinking | Research method evidence, not a certified monitor |
| Hilti SLAM | Multi-session SLAM across sensor constellations | Robust SLAM and calibration stress outside road domain | Construction-site geometry differs from apron operations |

## Release Translation

| Leaderboard observation | Release interpretation |
|---|---|
| Candidate improves public AP/NDS but regresses internal FOD recall | Block or restrict; airside critical slice wins |
| Candidate improves ATE but increases relocalization failures near stands | Block affected route/zone |
| Candidate improves OOD AUROC but planner does not consume unknown state | Diagnostic only; not safety evidence |
| Candidate wins latency but drops small-object recall | Require safety review; do not trade away protected-zone recall silently |
| Candidate passes aggregate metrics but fails wet/night/personnel-zone slice | Exclude slice or block release |
| Candidate score improves by less than confidence interval | Treat as inconclusive; do not claim improvement |

## Metric Pack for Release Reviews

| Area | Required metrics |
|---|---|
| Object detection | AP/recall/precision by class, range, occlusion, size, route zone; critical false negatives |
| Tracking | Track fragmentation, ID switches, missed tracks, time-to-detect, persistence under occlusion |
| Free-space/occupancy | False-free-space, unknown conservatism, occupied/free/unknown confusion, protected-zone failures |
| OOD/unknown | AUROC/AUPR/FPR at target recall, unknown-object action rate, false suppression review |
| SLAM/localization | ATE, RPE, drift rate, relocalization success, integrity coverage, map tile residual |
| Map quality | Static preservation, dynamic rejection, FOD retention, map-perception disagreement |
| Robustness | Corruption/fault-injection deltas, timing skew, dropout, calibration drift, adverse weather |
| Runtime | p50/p95/p99/p99.9 latency, memory, GPU/CPU, thermal throttling, dropped frames |
| Operations | Interventions, remote assists, alert precision, operator workload, incident joins |

## Scorecard Template

| Section | Required answer |
|---|---|
| Benchmark scope | Dataset versions, splits, routes, ODD slices, exclusions |
| Candidate | Build, model, map, calibration, config, runtime, hardware |
| Baseline | Production-compatible comparator and manifest |
| Metric deltas | Score delta, confidence interval, pass/fail by slice |
| Safety-critical failures | Event-level review, not only averages |
| Runtime impact | Latency/resource deltas and deployment feasibility |
| Monitor action | Whether uncertainty/OOD/free-space signals changed behavior |
| Recommendation | Pass, pass with ODD restriction, inconclusive, block |

## Anti-Patterns

- Reporting only mAP/NDS while ignoring false-free-space and critical false negatives.
- Comparing a public leaderboard result to an internal model with different sensors, runtime, or post-processing.
- Treating open-world/OOD benchmark performance as proof that all unknown airside objects are safe.
- Averaging across airports or routes when commissioning a new site.
- Hiding a runtime regression behind an accuracy improvement.
- Tuning thresholds on the locked test set or incident replay without a new validation split.

## Related Repository Docs

- `60-safety-validation/verification-validation/slam-map-benchmark-protocol.md`
- `60-safety-validation/verification-validation/perception-slam-statistical-validity-protocol.md`
- `60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md`
- `60-safety-validation/verification-validation/multi-sensor-calibration-release-benchmark.md`
- `30-autonomy-stack/perception/datasets-benchmarks/nuscenes-waymo-practical-guide.md`
- `30-autonomy-stack/localization-mapping/slam-methods/benchmarking-metrics-datasets.md`

## Sources

- KITTI object detection benchmark: https://www.cvlibs.net/datasets/kitti/eval_object.php
- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- nuScenes detection evaluation README: https://github.com/nutonomy/nuscenes-devkit/blob/master/python-sdk/nuscenes/eval/detection/README.md
- nuScenes tracking evaluation README: https://github.com/nutonomy/nuscenes-devkit/blob/master/python-sdk/nuscenes/eval/tracking/README.md
- Waymo Open Dataset overview: https://waymo.com/intl/jp/open/about/
- Waymo Open Dataset repository: https://github.com/waymo-research/waymo-open-dataset
- OpenAD benchmark repository: https://github.com/VDIGPKU/OpenAD
- ProOOD paper: https://arxiv.org/abs/2604.01081
- Hilti SLAM Challenge 2023 dataset: https://www.hilti-challenge.com/dataset-2023
