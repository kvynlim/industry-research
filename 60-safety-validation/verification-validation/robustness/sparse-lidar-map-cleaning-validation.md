# Sparse LiDAR Map Cleaning Validation

**Last updated:** 2026-05-09

Sparse LiDAR makes map cleaning harder because missing evidence can look like empty space, dynamic artifacts can leak through moving objects, and aggressive cleaners can erase valid structure. Airside sites amplify the problem: open aprons have few vertical landmarks, long ranges, reflective aircraft surfaces, low fixtures, and temporary equipment.

## Validation Claim

For the validated LiDAR configuration and airport zones, the map-cleaning pipeline remains conservative under sparse observations: it removes dynamic artifacts only when supported by geometric, temporal, radiometric, or review evidence, and it preserves localization-critical static structure.

## Sparse Failure Modes

| Failure | Sparse-data cause | Airside example | Safety impact |
|---|---|---|---|
| Dynamic artifact retained | rays pass through/around moving object and hit background | tug or bus crossing a stand survey | ghost structure pollutes localization map |
| Static erosion | cleaner overreacts to missing returns | pole, sign, chock, curb, terminal edge | lost localization or boundary evidence |
| False free space | unobserved cells treated as empty | aircraft-occluded service lane | planner assumes clearance it does not have |
| Intensity misclassification | range, incidence, wet surface, or sensor aging shifts intensity | reflective markings or aircraft skin | valid asset deleted or ghost retained |
| Reversion failure | removed static points are not restored | low vertical fixtures and sparse poles | map quality degrades silently |
| Parameter brittleness | thresholds tuned on dense road LiDAR | 16/32 beam apron pass | cleaner does not transfer |

## Test Matrix

| Dimension | Required slices | Acceptance focus |
|---|---|---|
| LiDAR density | nominal, degraded beam count, packet drop, lower-resolution sensor | metric stability and safe degradation |
| Range | near, mid, long range to terminal edge and stands | static retention by range bin |
| Incidence angle | shallow ground, vertical edges, curved aircraft surfaces | intensity and geometry residual robustness |
| Weather/surface | dry, wet, night lighting, glare, de-icing residue if in ODD | false deletion and false retention changes |
| Object motion | moving GSE, parked-then-removed GSE, aircraft present/absent | dynamic rejection without static erosion |
| Pose quality | nominal, bounded jitter, time offset, GNSS-denied replay | cleaner sensitivity to registration error |
| Scene structure | open apron, terminal edge, service road, gate equipment cluster | localization observability after cleaning |

## Metrics

| Metric | Definition | Gate use |
|---|---|---|
| Sparse static preservation | static retention by range, beam, and incidence bin | blocks over-cleaning in weak-observation zones |
| Dynamic artifact rejection | removed dynamic/artifact labels divided by all artifact labels | confirms cleaner still works under sparsity |
| Unknown-not-free rate | unobserved or occluded cells retained as unknown instead of free | protects planning semantics |
| Intensity residual stability | calibrated intensity disagreement by material/range | checks RI-DVP-style radiometric assumptions |
| Reversion recovery | valid static points restored after aggressive candidate removal | catches one-way deletion bugs |
| Localization health | NDT/ICP score, covariance, inliers, residuals, relocalization success | final safety-relevant map quality signal |
| Reviewer escalation | percentage of sparse decisions sent to human review | confirms uncertainty is exposed |

## Gate Rules

| Gate | Pass condition | Blocker |
|---|---|---|
| Sparse input declaration | LiDAR model, channel count, scan pattern, range limits, packet loss, and mounting are recorded | candidate uses untracked sensor assumptions |
| Conservative unknown handling | unobserved space cannot become free space without positive evidence | cleaner converts missing data into clearance |
| Cross-session evidence | removals in sparse zones are supported by repeated observations or review | one noisy pass drives permanent deletion |
| Localization replay | sparse-zone replay remains within release thresholds | residual or covariance worsens in open apron |
| Parameter lock | thresholds are frozen before holdout sparse tests | post-hoc tuning on acceptance set |
| Fallback path | sparse-data warning can block publication or require overlay review | silent acceptance of low-evidence tiles |

## Practical Procedure

1. Build dense-reference labels where possible using repeated slow passes, static survey, or manual inspection.
2. Downsample and corrupt the same sequences to emulate sparse sensor modes.
3. Run ERASOR, Removert, MapCleaner, RI-DVP-style, or production cleaner variants on the same inputs.
4. Compare retained static, removed dynamic, restored static, unknown, and rejected layers.
5. Replay localization on every candidate map and inspect the weak-feature apron zones first.
6. Treat sparse disagreement as a publication risk, not as a visualization issue.

## Sources

- RI-DVP sparse LiDAR map-cleaning article: https://www.mdpi.com/2072-4292/18/5/821
- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- ERASOR paper: https://arxiv.org/abs/2103.04316
- Removert repository: https://github.com/gisbi-kim/removert
- MapCleaner article: https://www.mdpi.com/2072-4292/14/18/4496
- Autoware NDT scan matcher: https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- Local context: lidar-artifact-removal-validation.md
- Local context: ../airside-dynamic-map-cleaning-benchmark.md
