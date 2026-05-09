# Perception-SLAM Statistical Validity Protocol

**Last updated:** 2026-05-09

## Purpose

This protocol defines how to make defensible statistical claims about perception-SLAM and map reliability for airside autonomous ground vehicles. It prevents common validation failures: aggregate-only pass rates, reused test sets, silent cherry-picking, correlated traversals treated as independent samples, and release decisions based on mileage alone.

It supports the top-level [perception-SLAM map reliability evidence case](perception-slam-map-reliability-evidence-case.md), the [SLAM map benchmark protocol](slam-map-benchmark-protocol.md), the [uncertainty calibration release gates](uncertainty-calibration-perception-slam-release-gates.md), and the [perception-SLAM fleet data contract](../../50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md).

## Statistical Claims

Every release claim must be written before the campaign starts:

| Claim type | Example claim | Required statistical form |
|---|---|---|
| Reliability | "False-free-space defects are below the release threshold in protected apron zones" | One-sided upper confidence bound or Bayesian credible upper bound |
| Performance | "ATE p95 is below 0.20 m on service-road routes" | Quantile estimate with confidence interval by ODD slice |
| Robustness | "Severe rain corruption causes no more than 15 percent degradation in localization availability" | Paired comparison against clean baseline |
| Calibration | "90 percent pose uncertainty sets contain the true pose at least 88 percent of the time" | Coverage interval and binomial/hierarchical test |
| Regression | "Release candidate is not worse than production by more than delta" | Non-inferiority test with pre-set margin |

## Units of Analysis

Do not count every frame as an independent sample. Perception and SLAM errors are temporally and spatially correlated.

| Unit | Use for | Independence rule |
|---|---|---|
| Frame | Object-level perception, calibration bins, point-cloud quality | Use cluster-robust intervals grouped by scenario/session |
| Segment | 10-60 second slice around an event or route feature | Preferred unit for detection, relocalization, corruption tests |
| Traverse | Full route, stand approach, or depot mission | Preferred unit for map/localization reliability |
| Map tile | Map publication and quarantine decisions | Tile is independent only if source traversals and route context differ |
| Scenario family | ISO 34502-style functional/logical scenario | Used for coverage and safety argument completeness |
| Airport-day | Fleet post-release monitoring | Used for drift, weather, and operational exposure |

## Stratification Plan

At minimum, all headline metrics are reported by:

| Dimension | Required bins |
|---|---|
| Zone | stand, apron service road, depot, taxiway crossing support, maintenance area |
| Lighting | day, dusk/dawn, night, glare |
| Weather/surface | dry, wet, heavy rain, fog/low visibility if in ODD, snow/ice if in ODD |
| Traffic density | quiet, normal turnaround, congested |
| Aircraft state | absent, parked, servicing, pushback/taxi adjacency |
| Sensor health | nominal, reduced point density, camera degraded, GNSS degraded, time-sync warning |
| Map age | newly surveyed, less than 7 days, 7-30 days, more than 30 days, changed since last survey |
| Release phase | offline benchmark, closed-course, shadow mode, limited autonomous, production watch |

Aggregate release decisions are invalid if any safety-critical slice fails or lacks enough exposure for the intended ODD.

## Metrics and Decision Rules

| Metric | Primary decision rule | Minimum reporting |
|---|---|---|
| False-free-space critical defects | Zero observed in release-critical protected zones; if any observed, release blocked until fixed and re-tested | Count, exposure denominator, root cause, residual risk |
| ATE / RPE | p95 and p99 upper confidence bounds below route-specific thresholds | Median, p95, p99, CI, worst segment |
| Localization availability | Lower confidence bound above threshold by ODD slice | Availability, dropouts/hour, longest outage |
| Relocalization latency | p95 upper confidence bound below allowed time/distance budget | Latency distribution and failed recoveries |
| Scan-to-map residual | Candidate distribution non-inferior to production | Paired delta, drift by map age |
| Ghost rate | Upper bound below map publication threshold | Ghosts per 100 m or per stand/tile |
| Static preservation | Lower bound above threshold | Lost-feature categories and impact |
| Calibration coverage | Empirical coverage interval includes nominal target within tolerance | Reliability diagram by risk bin |
| Robustness degradation | Paired performance drop below corruption-specific limit | Clean vs corrupt paired table |

## Sample Size Rules

### Zero-Failure Claims

When claiming a rare-event upper bound with zero observed failures, use the rule:

```
N >= ln(alpha) / ln(1 - p*)
```

Where `p*` is the maximum acceptable event probability per independent unit and `1 - alpha` is confidence. Example: to show fewer than 1 critical false-free-space defect per 1,000 independent protected-zone segments at 95 percent confidence with zero observed failures, use `N >= ln(0.05) / ln(0.999) = 2,995` independent segments.

This does not prove system safety by itself. RAND's "Driving to Safety" shows why road-mile accumulation alone becomes impractical for rare fatality-level claims. Use scenario-based, accelerated, simulation, closed-course, and fleet evidence together.

### Non-Zero Defect Claims

For defect rates with observed failures, report an exact binomial confidence interval or a beta-binomial hierarchical model when data are clustered by airport, route, or weather. Use one-sided upper bounds for safety release decisions.

### Quantile Claims

For p95/p99 ATE, RPE, relocalization time, and residual distributions:

- Use bootstrap confidence intervals over independent segments or traverses, not frames.
- Preserve scenario grouping during bootstrap resampling.
- Report the worst ODD slice even when aggregate metrics pass.
- Use non-parametric intervals unless a distributional model is justified and checked.

### Regression Claims

For candidate vs production:

- Use paired comparisons when both stacks run on the same logs.
- Define a non-inferiority margin before testing.
- Block release if the candidate improves aggregate performance while degrading any critical ODD slice beyond the margin.

## Data Partitioning

| Partition | Purpose | Rules |
|---|---|---|
| Development | Tuning, debugging, ablation | May be reused; never used for release claims |
| Calibration | Temperature scaling, uncertainty thresholds, conformal quantiles | Frozen before final evaluation |
| Validation | Model and map selection | Can choose between candidates; cannot serve as final release evidence |
| Locked test | Release claim | Read-only; access logged; no tuning after inspection |
| Shadow-mode watch | Operational confirmation | Used for post-release monitoring and future test-set design |

No sequence may appear in more than one partition through near-duplicate route, time, or map-tile leakage. For repeated airport routes, split by day/session/map version where possible, not random frames.

## Sequential Testing and Stopping

Validation teams may use sequential release testing only if the stopping rule is pre-registered:

| Situation | Allowed stopping rule |
|---|---|
| Critical defect observed | Stop immediately, block release, open safety defect |
| Sufficient evidence accumulated | Stop only when pre-defined confidence/coverage criteria are met |
| Time or budget exhausted | Report inconclusive; do not convert to pass |
| Candidate underperforms production | Stop for futility if pre-defined non-inferiority cannot be achieved |

Repeated looks at the data require alpha spending, Bayesian monitoring with pre-specified priors, or a fixed holdout untouched until final analysis.

## Scenario Coverage

Use ISO 34502-style functional, logical, and concrete scenario decomposition. For this airside domain, the statistical report must include:

- Coverage matrix from [airside scenario taxonomy](airside-scenario-taxonomy.md) to benchmark logs.
- Route and map-tile coverage from [SLAM map benchmark protocol](slam-map-benchmark-protocol.md).
- Corruption severity coverage from [perception-SLAM corruption and fault injection protocol](robustness/perception-slam-corruption-fault-injection-protocol.md).
- Fleet exposure coverage from [perception-SLAM fleet data contract](../../50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md).

## Bias and Validity Controls

| Risk | Control |
|---|---|
| Test-set contamination | Locked manifests, hash-based duplicate detection, access logging |
| Correlated samples inflated as independent | Cluster by segment/traverse/tile/airport-day |
| Weather/lighting under-sampled | Stratified minimums and inconclusive status for missing ODD slices |
| Overfitting to public benchmarks | Public benchmark used only as external comparability, not release proof |
| Simulation over-trusted | Simulation results discounted unless sim-to-real gap is measured |
| Human labels inconsistent | Inter-annotator agreement and adjudication for critical labels |
| Map survey error | Survey uncertainty propagated into ATE/map-layer thresholds |
| Survivorship bias in fleet data | Include failures, aborted missions, upload failures, and quarantined bags |

## Release Decision Template

Each statistical report must include:

1. Candidate build, map, calibration, and data manifest IDs.
2. Pre-registered claims and thresholds.
3. Partitions and leakage checks.
4. Sample counts by independent unit and ODD slice.
5. Metric tables with confidence intervals.
6. Failed, inconclusive, or waived slices.
7. Comparison to production baseline.
8. Safety defect references and disposition.
9. Final recommendation: pass, pass with ODD restriction, inconclusive, or block.

## Owner Handoffs

| Owner | Responsibility |
|---|---|
| V&V statistician | Pre-registration, sample size, intervals, final statistical decision |
| Perception/SLAM owner | Metric implementation, baseline comparison, failure triage |
| Mapping owner | Map tile sample frame, survey uncertainty, map-change status |
| Data platform owner | Dataset manifests, partition enforcement, duplicate detection |
| Safety lead | Criticality thresholds, release interpretation, waiver control |
| Fleet operations | Shadow-mode exposure and event completeness |

## Sources

- ISO 34502:2022, scenario-based safety evaluation framework: https://www.iso.org/standard/78951.html
- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
- RAND, "Driving to Safety": https://www.rand.org/content/dam/rand/pubs/research_reports/RR1400/RR1478/RAND_RR1478.pdf
- Waymo Safety Methodologies and Safety Readiness Determinations: https://arxiv.org/abs/2011.00054
- Waymo Safety Impact Hub methodology context: https://waymo.com/safety/impact/
- NHTSA Standing General Order on Crash Reporting: https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting
- Guo et al., "On Calibration of Modern Neural Networks": https://arxiv.org/abs/1706.04599
- Angelopoulos and Bates, "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification": https://arxiv.org/abs/2107.07511
- Lei et al., "Distribution-Free Predictive Inference for Regression": https://arxiv.org/abs/1604.04173
