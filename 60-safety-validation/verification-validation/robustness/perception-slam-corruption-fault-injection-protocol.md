# Perception-SLAM Corruption and Fault Injection Protocol

**Last updated:** 2026-05-09

## Purpose

This protocol defines the robustness campaign for perception, localization, SLAM, and map-change systems under credible airside corruptions and injected faults. The goal is not only to measure accuracy loss. The campaign must show that failures are detected, uncertainty rises, safety monitors react, map publication is blocked when needed, and fleet telemetry preserves enough evidence for root cause analysis.

This protocol feeds the [perception-SLAM evidence case](../perception-slam-map-reliability-evidence-case.md), [uncertainty calibration release gates](../uncertainty-calibration-perception-slam-release-gates.md), [SLAM map benchmark protocol](../slam-map-benchmark-protocol.md), [airside adverse conditions validation](airside-adverse-conditions.md), and [online perception monitoring and ODD enforcement](../../runtime-assurance/online-perception-monitoring-odd-enforcement.md).

## Campaign Inputs

| Input | Required content |
|---|---|
| Candidate build | Software hash, model weights, runtime parameters, safety monitor thresholds |
| Map package | Tile hashes, semantic layers, coordinate frames, source traversals |
| Sensor calibration | Intrinsics, extrinsics, time-sync model, calibration date, residual report |
| Data manifest | Clean logs, closed-course logs, public/proxy datasets, airside scenario tags |
| Fault matrix | Corruptions, severity levels, random seeds, expected monitor response |
| Release thresholds | Metric degradation limits, safety action requirements, block conditions |

## Corruption Matrix

| Category | Faults/corruptions | Airside relevance | Required severity levels |
|---|---|---|---|
| LiDAR weather | Rain attenuation, fog backscatter, snow/spray points, wet-ground specular loss | Tropical rain, de-icing spray, fog, standing water | light, moderate, severe |
| LiDAR hardware | Beam dropout, channel bias, crosstalk, range noise, intensity drift, partial occlusion | Damaged/dirty sensor, connector issues, lens contamination | 5, 15, 30, 50 percent affected |
| Camera | Motion blur, low light, glare, lens dirt, over/under exposure, compression artifacts | Night apron lighting, wet glare, depot offload compression | 3-5 severity steps |
| Radar | False tracks, missed tracks, multipath, velocity noise | Jet exhaust zones, wet apron, metallic clutter | nominal plus degraded modes |
| GNSS/INS | Dropout, multipath bias, heading drift, wheel slip, IMU bias | Terminal multipath, indoor/depot, wet surface | bounded bias and outage duration grid |
| Time synchronization | Sensor timestamp skew, jitter, dropped frames, reordering | PTP/NTP failure, bus congestion | 10 ms to safety-critical threshold |
| Extrinsics | Camera/LiDAR yaw/pitch/roll shift, LiDAR/IMU offset, sensor mount vibration | Maintenance error, impact, thermal/mechanical drift | small detectable to unsafe |
| Map faults | Stale tile, wrong tile, shifted tile, missing layer, dynamic object promoted static | Construction, aircraft/GSE ghosts, bad map update | tile-level and feature-level |
| Dynamic scene | Aircraft/GSE/person/FOD injection, occlusion, temporary barriers | Apron operations and stand turnaround | single actor, dense actors, occluded |
| Compute/runtime | Delayed node, CPU/GPU saturation, memory pressure, dropped diagnostics | Edge compute overload during logging or adverse weather | p95 latency to timeout |

## Fault Injection Rules

1. Faults must be deterministic under recorded random seeds.
2. Clean and corrupted runs must use the same logs and build unless the test is a hardware-in-loop or closed-course injection.
3. Injected faults must preserve physically plausible timing and coordinate frames unless the test explicitly targets malformed data handling.
4. Sensor corruptions must affect raw or near-raw inputs where possible, not only final detections.
5. Map faults must include publication-path tests: candidate map, quarantine state, rollback, and runtime lookup.
6. Each fault has an expected safe response: continue, degrade, stop, quarantine, alert, or block release.

## Metrics

| Metric | Definition | Robustness interpretation |
|---|---|---|
| Corruption error ratio | Metric under corruption divided by clean metric | Measures degradation relative to same scenario |
| Relative robustness | Average retained performance across severities | Used for model comparison, not safety alone |
| Localization availability | Fraction of time pose is valid and within error envelope | Must degrade gracefully under faults |
| Silent failure rate | Fault cases where output is wrong and confidence/monitor does not flag | Release-blocking for high-risk slices |
| Detection latency | Time from injected fault to monitor alert/action | Must be within safety budget |
| False-free-space under fault | Fault cases creating traversable output where occupied/hazardous | Zero tolerance in protected zones |
| Map quarantine recall | Fraction of unsafe map changes blocked before publication | Critical for fleet map operations |
| Recovery time | Time from fault end to stable nominal operation | Required for operational availability |
| Evidence completeness | Fraction of fault runs with required logs/diagnostics/events | Required for root cause and safety case |

## Pass/Block Rules

| Rule | Decision |
|---|---|
| Any high-confidence false-free-space result near aircraft, people, FOD, or geofence | Block release |
| Any wrong-pose condition that remains inside nominal uncertainty bounds past safety budget | Block release |
| Any map fault that reaches publication without quarantine/review when it changes protected geometry | Block release |
| Severe corruption causes controlled stop with correct diagnostics and no unsafe motion | Pass with operational availability note |
| Moderate corruption exceeds accuracy threshold but uncertainty and degraded mode trigger correctly | Pass only if ODD restriction or mitigation is approved |
| Fault run lacks required evidence logs | Inconclusive; rerun or block if rerun impossible |

## Test Campaign Phases

| Phase | Environment | Purpose |
|---|---|---|
| R0 static analysis | Config and manifests | Verify all fault hooks, thresholds, and expected monitor actions are defined |
| R1 offline replay | Clean and corrupted logs | High-volume deterministic comparison |
| R2 simulation | Scenario generator and digital twin | Explore rare/dangerous aircraft, FOD, and geofence cases |
| R3 HIL/SIL timing | Vehicle compute and runtime middleware | Validate latency, dropped frames, overloaded nodes, timestamp faults |
| R4 closed course | Instrumented physical test | Validate sensor contamination, GNSS denial, wet surface, FOD fixtures |
| R5 shadow mode | Real airside routes under supervision | Confirm event rates and monitor behavior without autonomous risk |

## Airside Fault Scenarios

| Scenario | Injection | Expected behavior |
|---|---|---|
| Wet stand approach | Ground returns removed/specular, aircraft reflection added | Free space becomes unknown or conservative; no high-confidence clearance |
| Aircraft absent/present map pair | Parked aircraft points promoted into candidate static map | Map QA flags movable-static and blocks permanent publication |
| De-icing adjacency | Spray-like LiDAR/camera corruption and point-density drop | Sensor health rises, speed reduced or ODD excludes zone |
| Taxiway crossing GNSS multipath | GNSS position bias and IMU heading drift | Cross-sensor residual rises, pose covariance inflates, geofence remains conservative |
| Depot dense clutter | Temporary carts and barriers inserted/removed | Map-change workflow quarantines tile or requires review |
| Time-sync fault during moving actors | Camera/LiDAR skew injected while person crosses | Fusion uncertainty rises; no stale detection used as current obstacle |
| Sensor mount drift after maintenance | Extrinsic yaw/pitch offset | Calibration residual detects drift; vehicle held for maintenance |
| Compute overload during event burst | Perception node delayed while logging full-fidelity event | Watchdog/degraded mode engages before stale outputs are consumed |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Fault matrix | Fault type, severity, seed, dataset, expected response |
| Corruption implementation report | Where the fault is injected, validation of physical plausibility, known limitations |
| Run manifest | Build/map/calibration/log IDs and runtime parameters |
| Metric report | Clean vs corrupted metrics, confidence intervals, failed slices |
| Safety action report | Monitor alerts, degraded-mode commands, stops, quarantines, operator notifications |
| Failure packet | Minimal replay data, screenshots/plots, root cause, defect ID |
| Release disposition | Pass/block/inconclusive decision and residual risk |

## Owner Handoffs

| Owner | Responsibility |
|---|---|
| V&V robustness lead | Campaign design, fault matrix, pass/block decision |
| Perception/SLAM owner | Fault hooks, metric implementation, failure triage |
| Runtime assurance owner | Monitor response, degraded-mode verification, watchdog tests |
| Mapping owner | Stale/wrong/shifted map injections and quarantine workflow |
| Data platform owner | Replay data, manifests, logs, evidence retention |
| Fleet operations | Shadow-mode execution and operational safety controls |
| Safety board | Residual risk acceptance and ODD restrictions |

## Sources

- Robo3D, "Towards Robust and Reliable 3D Perception against Corruptions": https://arxiv.org/abs/2303.17597
- Robo3D ICCV paper: https://openaccess.thecvf.com/content/ICCV2023/html/Kong_Robo3D_Towards_Robust_and_Reliable_3D_Perception_against_Corruptions_ICCV_2023_paper.html
- MultiCorrupt repository: https://github.com/ika-rwth-aachen/MultiCorrupt
- MultiCorrupt paper: https://arxiv.org/abs/2402.11677
- MSC-Bench project: https://msc-bench.github.io/
- MSC-Bench paper: https://arxiv.org/abs/2501.01037
- MapBench project: https://mapbench.github.io/
- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- Boreas multi-season autonomous driving dataset: https://www.boreas.utias.utoronto.ca/
- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
- UL 4600 Ed. 3, Evaluation of Autonomous Products: https://webstore.ansi.org/standards/ul/ul4600ed2023
