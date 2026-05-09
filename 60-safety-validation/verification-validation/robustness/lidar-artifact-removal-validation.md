# LiDAR Artifact Removal Validation

## Executive Summary

LiDAR artifact removal changes the sensor evidence available to perception, localization, mapping, and planning. That makes it a safety-relevant function. Validation must prove both sides of the tradeoff: the removal layer suppresses false measurements, and it does not hide real hazards or remove localization-critical static structure.

For SOTIF-style safety argumentation, the central claim should be narrow: artifact removal reduces unreasonable risk from foreseeable LiDAR insufficiencies under the validated ODD, while monitored degradation states trigger fallback behavior when the filtered cloud is no longer sufficient.

## Validation Scope

| Scope item | Include | Exclude from claim |
|---|---|---|
| Classical filtering | SOR, ROR, DROR, DSOR, LIOR, DDIOR, D-LIOR, IDSOR, DVIOR, SDOR, LIDSOR | Unvalidated transfer to new LiDARs or cover materials. |
| Learned weather removal | LIORNet-style learned denoising where evaluated | Using learned confidence as safety truth without independent checks. |
| Sensor artifacts | Ghosts, multipath, retroreflector bloom, saturation, blockage, dust | Hardware faults covered by a separate diagnostic case. |
| Dynamic map cleaning | ERASOR, Removert, MapCleaner, ERASOR++, 4dNDF, FreeDOM, STATIC-LIO-style dynamic-point removal | Runtime deletion of obstacles from the planning world without tracking/fusion. |
| Airside ODD | Rain, snow, fog, dust, road spray, de-icing mist, wet apron, reflective equipment | Public-road-only results as final airport evidence. |

## Hazard and Failure Taxonomy

| Hazard | Cause | Safety consequence | Required evidence |
|---|---|---|---|
| False obstacle retained | Weather or ghost point survives filtering | Unnecessary stop, route blockage, planner instability | False-positive rate by artifact type and scenario. |
| Real obstacle removed | Filter classifies person/object as artifact | Collision risk | False deletion rate on safety-critical classes. |
| Localization observability loss | Filter removes too much static structure | Pose error, wrong scan match, degraded recovery | Static inlier count, residuals, degeneracy, pose error. |
| Map pollution | Dynamic or ghost points enter static map | Future localization or planning errors | Map ghost rate and static preservation metrics. |
| Silent sensor degradation | Filter hides blockage or saturation | Operation outside safe perception envelope | Health monitor detection and ODD transition logs. |
| Domain transfer failure | Filter tuned on road snow used on airport mist/spray | Unknown perception failure | Target-domain validation and change-control records. |

## Artifact Test Matrix

| Family | Test examples | Required labels |
|---|---|---|
| Snow | Falling snow, accumulated snow, plowed snow banks | Noise, static, dynamic, safety-critical object. |
| Rain | Light, heavy, tropical downpour, road spray | Rain/spray points and real obstacle points. |
| Fog/mist/steam | Natural fog, de-icing mist, engine/APU steam | Backscatter, attenuated real surfaces, objects behind plume. |
| Dust/FOD | Jet blast dust, prop wash dust, rubber debris | Dust cloud, solid FOD, static background. |
| Wet surfaces | Standing water, wet concrete, glycol film | Ground, below-ground multipath, true obstacles. |
| Reflectors | Cones, vests, signs, apron markings | True object extent, bloom points, saturation sectors. |
| Ghost/multipath | Terminal glass, aircraft skin, wet mirrors | Physical object, reflective surface, ghost point. |
| Dynamic map clutter | Aircraft, tugs, buses, carts, people | Static, dynamic, movable-static, unknown. |

## Metrics

| Layer | Metrics |
|---|---|
| Point filtering | Artifact precision/recall, static preservation rate, safety-critical false deletion rate, removal ratio by range/sector/intensity. |
| Detection/tracking | False obstacle rate, missed object rate, track fragmentation, track latency, class-specific performance. |
| Localization | ICP/NDT/VGICP inliers, residual distribution, Hessian degeneracy, ATE/RPE, relocalization success. |
| Mapping | Ghost trail rate, dynamic rejection rate, static preservation rate, map completeness, map thickness, cross-session consistency. |
| Runtime assurance | ODD state transition accuracy, sensor cleaning trigger precision/recall, controlled-stop latency, radar-primary transition behavior. |
| Compute | Runtime percentile, memory, queue delay, worst-case latency under dense weather. |

## Acceptance Rules

| Rule | Rationale |
|---|---|
| Raw and removed clouds must be logged for every validation run. | Without removed evidence, false deletion cannot be investigated. |
| No filter may be accepted on false-positive reduction alone. | The main safety risk is often deleting real obstacles. |
| Thresholds are LiDAR-model and cover-specific. | Intensity and saturation behavior do not transfer cleanly. |
| Weather-mode activation must be justified by diagnostics or ODD state. | Aggressive filters in clear weather can reduce useful structure. |
| Localization validation must include open apron and reflective terminal-edge cases. | Airside geometry can be sparse and aliased. |
| Static map updates require multi-session evidence. | A parked aircraft or bus is not long-term structure by default. |
| Filtered-cloud sufficiency must be monitored online. | A clean but sparse cloud can still be unsafe. |

## Airside-Specific Validation Guidance

Use airport-specific scenario slices:

- Gate approach with parked aircraft and moving GSE.
- Wet stand at night with retroreflective markings and cones.
- De-icing pad perimeter with steam/mist and glycol residue.
- Jet blast or prop wash dust plume.
- Heavy rain route with road spray from service vehicles.
- Terminal glass and repeated gate geometry.
- Open apron with few vertical features and high sun.
- Snow-covered or partially plowed apron with hidden markings.

Use at least three validation outputs:

- Point-level artifact report for the LiDAR team.
- Perception and localization report for autonomy integration.
- Safety case artifact with ODD decision traces, residual risks, and fallback actions.

## HeLiMOS-Style Evaluation

HeLiMOS is useful as a pattern because it evaluates moving object segmentation across heterogeneous LiDAR sensors and scan patterns. For airside artifact removal, use the same idea:

- Label static, dynamic, movable-static, weather artifact, ghost/multipath, and unknown.
- Preserve per-sensor labels for spinning, solid-state, FMCW, and merged clouds.
- Report metrics per LiDAR type instead of only on the fused cloud.
- Back-propagate labels from merged clouds to individual sensors when needed.
- Include sensor-specific failure cases, not just aggregate F1.

## Safety Case Hooks

For ISO 21448/SOTIF alignment, connect artifact removal to:

- Known hazardous behavior caused by sensor or algorithm performance insufficiency.
- Foreseeable weather, reflectivity, blockage, and dynamic-object scenarios.
- Verification of design measures: filtering, health monitoring, fallback, ODD restriction.
- Validation in target operational conditions.
- Operation-phase monitoring, data collection, and change management.

The claim should remain bounded. Artifact removal can support safe perception; it cannot prove that LiDAR alone is sufficient in all adverse conditions.

For static objects that do not belong in the persistent map, pair this validation file with the [Airside Dynamic Map-Cleaning Benchmark](../airside-dynamic-map-cleaning-benchmark.md). The benchmark separates false retention of transient clutter from false deletion of valid structure, which is the core safety tradeoff in dynamic/static map cleaning.

## Sources

- ISO 21448:2022 SOTIF: https://www.iso.org/standard/77490.html
- Autoware blockage diagnostics: https://autowarefoundation.github.io/autoware_universe/pr-10077/sensing/autoware_pointcloud_preprocessor/docs/blockage-diag/
- Open3D outlier removal: https://www.open3d.org/docs/latest/tutorial/Advanced/pointcloud_outlier_removal.html
- PCL filters: https://pointclouds.org/documentation/group__filters.html
- DSOR and WADS: https://arxiv.org/abs/2109.07078
- DDIOR: https://www.mdpi.com/2072-4292/14/6/1468
- DVIOR: https://www.mdpi.com/2079-9292/14/18/3662
- IDSOR: https://arxiv.org/abs/2602.05876
- SDOR: https://www.nature.com/articles/s41598-026-38674-6
- LIORNet: https://arxiv.org/abs/2603.19936
- ERASOR: https://arxiv.org/abs/2103.04316
- Removert: https://github.com/gisbi-kim/removert
- 4dNDF: https://arxiv.org/abs/2405.03388
- MapCleaner: https://www.mdpi.com/2072-4292/14/18/4496
- ERASOR++: https://arxiv.org/abs/2403.05019
- HeLiMOS dataset: https://sites.google.com/view/helimos/dataset
- HeLiMOS toolbox: https://github.com/url-kaist/HeLiMOS-PointCloud-Toolbox
