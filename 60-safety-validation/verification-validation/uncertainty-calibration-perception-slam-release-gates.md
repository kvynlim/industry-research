# Uncertainty Calibration for Perception-SLAM Release Gates

**Last updated:** 2026-05-09

## Purpose

This protocol defines the release gates for uncertainty estimates produced by perception, localization, SLAM, and map-change systems. Airside autonomy cannot rely only on point estimates. The stack must know when it is uncertain, surface that uncertainty to runtime monitors, and avoid confident wrong answers near aircraft, people, geofence boundaries, FOD, temporary GSE, and stale map regions.

This file is used by the [perception-SLAM evidence case](perception-slam-map-reliability-evidence-case.md), the [statistical validity protocol](perception-slam-statistical-validity-protocol.md), the [corruption and fault injection protocol](robustness/perception-slam-corruption-fault-injection-protocol.md), and [online perception monitoring and ODD enforcement](../runtime-assurance/online-perception-monitoring-odd-enforcement.md).

## Calibration Scope

| Output | Uncertainty signal | Ground truth |
|---|---|---|
| Ego pose | Covariance, particle dispersion, factor-graph marginal, scan-match score | Surveyed trajectory, RTK/INS reference, motion-capture/test-track reference |
| Relative motion | Odometry covariance, IMU preintegration residual, wheel-slip indicator | Ground-truth relative transform over fixed windows |
| Object detection | Class probability, bounding-box covariance, track existence probability | Human labels, fused multi-sensor labels, adjudicated critical labels |
| Free-space/occupancy | Occupancy probability, unknown probability, map confidence | Surveyed occupancy, labeled obstacles/FOD, closed-course fixtures |
| Map change | Change probability, persistence score, reviewer priority | Cross-session map labels and human map QA |
| Sensor health | Degradation score, dropout probability, contamination score | Fault injection label, environmental logs, sensor diagnostics |

## Release Gate Philosophy

Calibration is a safety gate only when it changes behavior. A probability estimate that is not consumed by the planner, monitor, map publisher, or fleet triage system is diagnostic, not safety evidence.

For each uncertainty output, the release package must show:

1. The consumer of the uncertainty signal.
2. The action triggered by high uncertainty.
3. The calibration partition used to set thresholds.
4. The locked test partition used to measure calibration.
5. The ODD slices where calibration is valid.
6. The fallback behavior when calibration is out of scope.

## Metrics

| Metric | Use | Release interpretation |
|---|---|---|
| Expected calibration error (ECE) | Binned confidence vs empirical correctness | Detects broad miscalibration; report by ODD slice |
| Maximum calibration error (MCE) | Worst-bin confidence gap | Blocks release when a high-risk bin is overconfident |
| Negative log likelihood (NLL) | Proper scoring rule for probabilistic outputs | Penalizes confident wrong predictions |
| Brier score | Proper scoring rule for binary/multiclass probabilities | Useful for event probabilities such as map-change or occupancy |
| Reliability diagram | Visual audit of confidence bins | Required for safety board review |
| Coverage | Fraction of true values inside predicted set/interval | Core metric for pose/object/free-space uncertainty |
| Sharpness | Size of confidence set/interval | Prevents trivially wide but useless uncertainty |
| Risk-coverage curve | Error rate as uncertain samples are rejected | Shows whether abstention/degraded mode is meaningful |
| Calibration under corruption | Metric delta under fault injection | Detects silent overconfidence under sensor/weather faults |

## Calibration Methods

| Method | Use | Constraints |
|---|---|---|
| Temperature scaling | Neural classifier and detector class probabilities | Use independent calibration data; do not tune on locked test |
| Vector/matrix scaling | Multiclass outputs with class-specific bias | Requires more calibration data than temperature scaling |
| Isotonic or histogram calibration | Event probabilities with enough samples per bin | Avoid when bins are sparse |
| Gaussian covariance scaling | Pose and bounding-box covariance | Validate with normalized estimation error squared or coverage |
| Ensemble/dropout uncertainty | Model epistemic uncertainty | Must be validated against held-out route/airport slices |
| Conformal prediction | Distribution-free coverage sets under exchangeability | Use slice-aware calibration; do not claim conditional coverage unless tested |
| Mondrian/sliced conformal | Coverage by risk group or ODD bin | Use when high-risk airside slices differ materially |

## Gates

| Gate | Pass condition | Block condition |
|---|---|---|
| U0 provenance | Calibration, validation, and test partitions are versioned and leakage-checked | Any tuning on locked test data |
| U1 nominal calibration | ECE/NLL/Brier and coverage pass thresholds on nominal ODD slices | Overconfidence in any critical class or zone |
| U2 high-risk slice calibration | People, aircraft, FOD, geofence, wet/night, and stale-map slices pass | Aggregate pass hides high-risk slice failure |
| U3 uncertainty actionability | High uncertainty triggers a defined runtime or fleet action | Uncertainty is logged but unused for safety behavior |
| U4 corruption calibration | Under credible corruptions, uncertainty increases before or with error rate | Silent overconfidence under rain, beam loss, time skew, or extrinsic drift |
| U5 conformal coverage | Empirical coverage meets target within tolerance by approved slice | Coverage fails in an ODD slice intended for release |
| U6 operational watch | Post-release confidence/error distributions match validation envelope | Drift alert unresolved beyond watch window |

## Suggested Threshold Pattern

Exact thresholds are program-specific and must be approved in the release plan. A defensible default pattern:

| Output | Example target |
|---|---|
| Pose 95 percent confidence region | At least 93 percent empirical coverage by approved ODD slice |
| Pose covariance consistency | Normalized error not persistently above chi-square envelope |
| Object class confidence | ECE below agreed threshold; no high-confidence false negative for people/aircraft/FOD in locked test |
| Occupancy/free-space | High-confidence free-space false positive is zero in protected zones |
| Map-change probability | High-risk changes prioritize review with high recall, accepting moderate false positives |
| Sensor degradation score | Severe injected faults detected before planner consumes stale/confident output |

## Runtime Actions

| Trigger | Required action |
|---|---|
| Pose uncertainty above route threshold | Reduce speed, increase following/clearance margins, prepare controlled stop |
| Pose uncertainty above hard threshold | Controlled stop or remote-assist handoff |
| Object class uncertainty near aircraft/person | Treat as obstacle or request review; do not suppress as low confidence |
| Free-space uncertainty in protected zone | Mark unknown/blocked, not free |
| Map-change uncertainty high | Quarantine tile or create temporary override pending review |
| Calibration out-of-scope ODD detected | Enforce ODD restriction or degraded mode |
| Sensor uncertainty rises under corruption | Switch modality, reduce speed, and log event for fleet triage |

## Airside Failure Modes

| Failure mode | Calibration symptom | Required evidence |
|---|---|---|
| Wet apron reflection marked as free space | High confidence free-space error | Wet-ground reliability diagram and false-free-space table |
| Aircraft surface produces poor scan match | Pose covariance remains small while residual rises | Residual-to-error calibration and aircraft-present slice |
| GNSS multipath near terminal | Localization reports stable pose with wrong global alignment | GNSS degraded slice and cross-sensor consistency check |
| Temporary GSE added to permanent map | Map-change score underestimates persistence uncertainty | Cross-session map-change calibration |
| FOD suppressed as noise | Low object confidence despite safety relevance | Critical-object false-negative review |
| Beam dropout in rain | Detector confidence unchanged as point density falls | Corruption calibration campaign |
| Camera/LiDAR extrinsic drift | Fusion confidence high despite cross-modal misalignment | Miscalibration fault injection |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Calibration manifest | Data partitions, map versions, vehicle configs, sensor configs, ODD slices |
| Metric report | ECE, NLL, Brier, coverage, sharpness, risk-coverage by output and slice |
| Reliability diagrams | Confidence bins for nominal, high-risk, and corrupted slices |
| Threshold file | Runtime thresholds with owners, review date, and linked evidence |
| Runtime integration proof | Tests showing monitor/planner/map publisher consumes uncertainty correctly |
| Drift dashboard | Post-release confidence distributions and alert thresholds |
| Defect log | Overconfidence incidents, root cause, mitigation, re-test evidence |

## Owner Handoffs

| Owner | Responsibility |
|---|---|
| Perception/SLAM owner | Produce uncertainty signals and calibration models |
| Runtime assurance owner | Consume uncertainty and enforce degraded-mode actions |
| V&V owner | Lock partitions, run calibration gates, publish report |
| Data platform owner | Maintain calibration/test data lineage and fleet monitoring fields |
| Safety lead | Approve high-risk thresholds and residual risk |
| Fleet operations | Monitor drift and trigger post-release rollback/quarantine |

## Sources

- Guo et al., "On Calibration of Modern Neural Networks": https://arxiv.org/abs/1706.04599
- PMLR paper page for Guo et al.: https://proceedings.mlr.press/v70/guo17a.html
- Angelopoulos and Bates, "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification": https://arxiv.org/abs/2107.07511
- Lei et al., "Distribution-Free Predictive Inference for Regression": https://arxiv.org/abs/1604.04173
- Vovk et al., "Nonparametric predictive distributions based on conformal prediction": https://link.springer.com/article/10.1007/s10994-018-5755-8
- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
- UL 4600 Ed. 3, Evaluation of Autonomous Products: https://webstore.ansi.org/standards/ul/ul4600ed2023
- Waymo Safety Methodologies and Safety Readiness Determinations: https://arxiv.org/abs/2011.00054
