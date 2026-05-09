# LiDAR Artifact Removal Techniques

## Executive Summary

LiDAR artifact removal is a layered stack, not a single filter. It covers classical outlier removal, weather denoising, sensor health diagnostics, ghost and multipath suppression, dynamic-object masking, and static-map cleaning. The correct safety question is not "which method removes the most points?" but "which method removes false measurements without hiding real hazards or weakening localization observability?"

For airside autonomous vehicles, the broad removal layer should include:

- Classical filters: SOR, ROR, DROR, DSOR, LIOR, DDIOR, D-LIOR, IDSOR, DVIOR, SDOR, LIDSOR.
- Learned weather removal where supported: LIORNet and related denoisers, validated against classical baselines.
- Sensor artifact handling: ghost, multipath, retroreflector blooming, sun/receiver saturation, blockage, and dust.
- Dynamic map cleaning: ERASOR, Removert, MapCleaner, ERASOR++, 4dNDF, and MOS-style evaluation.
- Safety validation: raw-vs-filtered evidence, target-domain labels, SOTIF argumentation, and ODD degradation rules.

## Repo Cross-Links

| Topic | Link | Role |
|---|---|---|
| Classical filters | [Classical LiDAR Outlier Removal](../methods/classical-lidar-outlier-removal.md) | Baseline and deterministic weather filters. |
| Weather artifacts | [LiDAR Weather Artifact Removal](../methods/lidar-weather-artifact-removal.md) | Snow, rain, fog, dust, spray, mist, and wet-surface artifacts. |
| Sensor ghosts | [LiDAR Ghost and Multipath Artifacts](../../../20-av-platform/sensors/lidar-ghost-multipath-artifacts.md) | Reflective surfaces, multipath, bloom, and saturation. |
| Safety validation | [LiDAR Artifact Removal Validation](../../../60-safety-validation/verification-validation/robustness/lidar-artifact-removal-validation.md) | Evidence plan and airside validation gates. |
| Dynamic map cleaning | [LiDAR Map Cleaning and Dynamic Removal](../../localization-mapping/slam-methods/lidar-map-cleaning-dynamic-removal.md) | Static map construction and dynamic clutter removal. |
| ERASOR | [ERASOR](../../localization-mapping/slam-methods/erasor.md) | Pseudo-occupancy dynamic object removal. |
| Removert | [Removert](../../localization-mapping/slam-methods/removert.md) | Remove-then-revert static map cleaning. |

## Artifact Taxonomy

| Artifact class | Examples | Primary symptom | Best first response |
|---|---|---|---|
| Isolated statistical outliers | Random invalid returns, edge speckle | Sparse points away from surfaces | SOR/ROR with diagnostics. |
| Weather particles | Snow, rain, dust, spray | Near-field false points, attenuation, low persistence | DROR/DSOR/SDOR/LIOR variants plus temporal checks. |
| Aerosol volume | Fog, steam, de-icing mist | Range collapse, volumetric backscatter | ODD degradation and radar-primary mode. |
| Reflective ghosts | Glass, wet ground, polished aircraft skin | Mirrored or behind-surface points | Reflective-surface reasoning, waveform/multi-return, map consistency. |
| Saturation/bloom | Retroreflective signs, vests, markings, direct sun | Inflated target, angular dropout, high intensity | Per-sector intensity and receiver health checks. |
| Sensor blockage | Dirt, glycol film, ice, bug splat | No-return sectors, depth-image holes | Autoware-style blockage diagnostics and cleaning. |
| Dynamic objects | Aircraft, tugs, carts, buses, people | Trails in accumulated maps, scan-to-map residuals | MOS, ERASOR, Removert, MapCleaner, 4dNDF. |
| Map staleness | Construction, moved stand equipment | Persistent disagreement with map | Change detection and map lifecycle workflow. |

## Technique Taxonomy

| Layer | Techniques | Output | Safety role |
|---|---|---|---|
| Input sanity | NaN removal, crop boxes, min/max range, vehicle-body masking | Valid raw cloud | Prevents impossible data from entering the stack. |
| Classical filtering | SOR, ROR, DROR, DSOR, LIOR, DDIOR, D-LIOR, IDSOR, DVIOR, SDOR, LIDSOR | Clean cloud plus removed cloud | Explainable baseline and weather control. |
| Learned denoising | LIORNet, WeatherNet-style, 4D temporal denoisers | Per-point noise probability | Better complex weather handling, but needs validation and uncertainty. |
| Sensor health | Blockage, dust, sector coverage, intensity drift, max range | Degradation state | Drives cleaning, speed limiting, and ODD enforcement. |
| Ghost handling | Reflective plane detection, full-waveform ghost removal, PCL ShadowPoints | Ghost mask | Prevents false objects and false map structure. |
| Dynamic masks | LiDAR-MOS, 4DMOS, HeLiMOS-style MOS | Moving/static labels | Protects localization and maps from moving actors. |
| Static map cleaning | ERASOR, Removert, MapCleaner, ERASOR++, 4dNDF | Static map plus rejected dynamic layer | Creates long-term localization maps. |

## Deployment Decision Rules

| Situation | Recommended behavior | Avoid |
|---|---|---|
| Clear weather, healthy sensor | Light SOR/ROR and artifact diagnostics. | Aggressive weather filters that reduce useful map geometry. |
| Light snow or rain | Range-aware DROR/DSOR/SDOR plus intensity-aware checks. | Fixed global ROR/SOR thresholds as the only protection. |
| Heavy snow, fog, dust, or de-icing mist | Reduced speed, radar-primary perception, sensor health alerts. | Claiming LiDAR is clean because a denoiser returned a dense-looking cloud. |
| Wet apron or reflective terminal area | Ground-model and multipath diagnostics, camera/radar agreement. | Treating below-ground points as real obstacles or deleting all low returns. |
| Retroreflective apron markings | Intensity saturation checks and known-object geometry bounds. | Letting bloom enlarge object boxes or map features. |
| Static map build | Combine dynamic masks, ERASOR/Removert/MapCleaner, multi-session consensus. | Building a localization map from a single busy shift. |
| Runtime localization | Downweight dynamic/artifact points but monitor static inlier count. | Removing so many points that scan matching becomes unobservable. |

## Failure Modes

- False deletion of small real obstacles under aggressive weather filtering.
- False retention of coherent artifacts such as spray sheets, glass ghosts, or wet-surface mirrors.
- Intensity threshold transfer failure across sensor vendors or sensor covers.
- Removing dynamic objects from maps but accidentally eroding static ground, poles, gate equipment, and aircraft stand features.
- Cleaner-induced domain shift for detectors trained on raw clouds.
- ODD monitor blind spot: the filter removes many points but no one notices the sensor is no longer adequate for the vehicle speed.
- Map lifecycle error: temporary parked aircraft or GSE is promoted into the long-term static map.

## Airside-Specific Validation Guidance

Airside validation needs target-domain clips and point labels. Include:

- Weather: heavy rain, snowfall, fog, dust, road spray, de-icing mist, steam, and glycol cover contamination.
- Reflective conditions: wet concrete, painted stand markings, retroreflective signs, cones, high-vis clothing, aircraft fuselage, terminal glass.
- Dynamic scenes: moving and parked aircraft, tugs, buses, belt loaders, dollies, fuel trucks, chocks, cones, and ground crew.
- Localization stress: open apron, repeated gates, terminal-edge multipath, wet night operations, and GNSS-challenged areas.
- Map lifecycle: same stand across shifts, aircraft present/absent, construction, temporary barriers, and seasonal snow banks.

Minimum evidence package:

- Raw, filtered, and removed point clouds.
- Per-artifact confusion matrix.
- Detector and tracker before/after metrics.
- Localization inlier, residual, and degeneracy metrics.
- Static map ghost rate and static preservation rate.
- ODD transition logs showing speed reduction, radar-primary mode, cleaning, or controlled stop.

## Practical Recommendation

Build removal in layers:

1. Keep raw data and diagnostics.
2. Apply conservative classical filters.
3. Add weather-specific filters with explicit activation conditions.
4. Detect sensor blockage and saturation independently from denoising.
5. Use radar/camera/thermal confirmation for safety-critical deletion.
6. Clean maps offline with multi-session evidence.
7. Validate against airside-labeled artifacts before using removal as safety evidence.

## Sources

- Open3D outlier removal: https://www.open3d.org/docs/latest/tutorial/Advanced/pointcloud_outlier_removal.html
- PCL filters: https://pointclouds.org/documentation/group__filters.html
- DSOR and WADS: https://arxiv.org/abs/2109.07078
- DDIOR: https://www.mdpi.com/2072-4292/14/6/1468
- DVIOR: https://www.mdpi.com/2079-9292/14/18/3662
- IDSOR: https://arxiv.org/abs/2602.05876
- SDOR: https://www.nature.com/articles/s41598-026-38674-6
- LIORNet: https://arxiv.org/abs/2603.19936
- ERASOR: https://arxiv.org/abs/2103.04316
- ERASOR repository: https://github.com/LimHyungTae/ERASOR
- Removert repository: https://github.com/gisbi-kim/removert
- 4dNDF: https://arxiv.org/abs/2405.03388
- 4dNDF repository: https://github.com/PRBonn/4dNDF
- HeLiMOS dataset: https://sites.google.com/view/helimos/dataset
- HeLiMOS toolbox: https://github.com/url-kaist/HeLiMOS-PointCloud-Toolbox
- Autoware blockage diagnostics: https://autowarefoundation.github.io/autoware_universe/pr-10077/sensing/autoware_pointcloud_preprocessor/docs/blockage-diag/
- ISO 21448 SOTIF: https://www.iso.org/standard/77490.html
