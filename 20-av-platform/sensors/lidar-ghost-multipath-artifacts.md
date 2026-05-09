# LiDAR Ghost and Multipath Artifacts

## Executive Summary

LiDAR ghost and multipath artifacts are false or distorted points caused by reflective surfaces, transparent materials, wet ground, high-intensity targets, receiver saturation, edge discontinuities, or external optical interference. They matter because they can create false objects, erase real surfaces, pollute static maps, and corrupt scan matching. On airside vehicles, these artifacts are common around wet aprons, terminal glass, polished aircraft skin, retroreflective markings, signs, cones, and high-visibility clothing.

Ghost handling belongs in the sensor layer and must feed perception, localization, mapping, and safety monitoring. It is not just a point-cloud cleanup step.

## Artifact Taxonomy

| Artifact | Mechanism | Point-cloud symptom | Airside examples |
|---|---|---|---|
| Multipath ghost | Laser reflects through one or more specular paths before returning | Object appears behind glass, below ground, or mirrored from a reflective plane | Terminal glass, wet apron, polished fuselage, service building windows. |
| Reflective dropout | Beam reflects away from receiver | Holes in expected surfaces | Standing water, glass, glossy painted markings. |
| Retroreflector blooming | Very high return overloads receiver or adjacent processing | Inflated target extent or nearby false points | Retroreflective signs, cones, vests, stand markings, vehicle plates. |
| Receiver saturation | Strong light or return exceeds useful measurement range | Angular dropout, clipped intensity, false range | Low sun, reflective aircraft, close reflectors. |
| Edge shadow points | Mixed returns near discontinuities | Ghost points near object edges | Aircraft gear, tow bars, poles, carts, fences. |
| Wet-surface mirror | Ground reflection creates indirect path | Below-ground points, mirrored obstacle fragments, missing ground | Rain puddles, wet concrete, de-icing fluid on apron. |
| Inter-sensor or external optical interference | Another emitter contaminates receiver timing or intensity | Sparse unexplained points or sector noise | Dense autonomous fleet, survey LiDARs, active optical beacons. |

## Detection Signals

| Signal | What to check | Strength |
|---|---|---|
| Ray consistency | Does a point sit behind a known reflective surface or outside a feasible ray path? | Strong for maps with glass/wet-surface priors. |
| Ground consistency | Is a point below a surveyed or estimated ground plane? | Strong for wet-surface multipath. |
| Intensity saturation | Are intensity or reflectivity values clipped or extreme? | Strong for retroreflector bloom but hardware-specific. |
| Sector coverage | Are returns missing or corrupted in an angular sector? | Strong for blockage, sun, and receiver issues. |
| Temporal stability | Does the point persist as the ego pose changes? | Strong for moving ghosts; weak for persistent glass ghosts. |
| Multi-return/waveform | Are there multiple peaks or abnormal pulse shapes? | Strong where hardware exposes the data. |
| Cross-sensor agreement | Do radar, camera, thermal, or map evidence support the point? | Critical for safety decisions. |

## Removal and Mitigation Techniques

| Technique | Best fit | Limitation |
|---|---|---|
| PCL ShadowPoints or edge-aware filtering | Edge ghost points around discontinuities | Does not solve glass or wet-ground multipath. |
| Reflective-plane modeling | Glass, mirrors, wet surfaces with known planes | Needs geometry and may miss curved aircraft surfaces. |
| Full-waveform ghost classification | Multi-path ghosts where waveform LiDAR is available | Not available on many automotive LiDARs. |
| Ground-model rejection | Below-ground wet-surface returns | Can delete valid curb/ramp/grade transitions if map is wrong. |
| Temporal occupancy and ray clearing | Ghosts that do not persist across viewpoints | Can remove thin valid structure. |
| Retroreflector extent gating | Bloom around known reflective signs or cones | Needs known size/shape priors and intensity calibration. |
| Sensor health diagnostics | Blockage, dust, sun sectors, saturation | Detects degradation but does not classify every ghost point. |
| Radar/camera/thermal confirmation | Safety-critical obstacle decisions | Each modality has its own failure modes. |

## Deployment Decision Rules

| Condition | Action |
|---|---|
| Ghost point is outside physically plausible space and unsupported by other sensors | Remove or downweight; log as ghost candidate. |
| Ghost point could be a small obstacle in the near field | Keep as low-confidence obstacle unless radar/camera/thermal or temporal evidence rejects it. |
| Reflective artifact degrades localization map matching | Exclude from scan-to-map residuals and add a map-quality annotation. |
| Retroreflective bloom expands a known sign/cone/vest | Clip object extent using geometry, not intensity footprint alone. |
| Sector saturation or blockage is detected | Trigger sensor degradation state; do not treat denoising as recovery. |
| Wet apron creates below-ground returns | Use ground-model and cross-sensor checks; avoid updating persistent maps with affected points. |

## Failure Modes

- Ghost is accepted as a real obstacle, causing unnecessary braking or route blockage.
- Real person or chock is rejected as a ghost because it is sparse, low, or near a reflective surface.
- Static map accumulates mirrored structures, creating persistent localization bias.
- Scan matching aligns to a reflective artifact or ghost vehicle.
- Bloom around high-visibility clothing changes perceived pedestrian size.
- Filtered point cloud hides receiver saturation that should have triggered an ODD restriction.

## Airside-Specific Validation Guidance

Build a test matrix around:

- Wet concrete and standing water at shallow scan angles.
- Retroreflective cones, signs, vests, stand markings, and vehicle plates.
- Aircraft fuselage and engine nacelle reflections.
- Terminal glass and jet bridge glass.
- Low sun with wet apron reflections.
- Night floodlights and reflective markings.
- De-icing fluid film and steam near aircraft.

Metrics:

- Ghost precision/recall by artifact type.
- False deletion rate for people, cones, chocks, tow bars, and aircraft gear.
- Detector false positives behind glass or below ground.
- Localization residual changes with reflective regions masked/unmasked.
- Static map ghost rate after repeated sessions.
- Sensor health response latency for saturation and blockage.

## Implementation Notes

- Treat ghost removal as a candidate mask, not an irreversible delete, until safety validation is complete.
- Preserve raw, filtered, and ghost-candidate clouds in logs.
- Maintain per-sensor intensity calibration and saturation thresholds.
- Add map annotations for known glass, reflective signs, and wet-prone apron zones.
- Use radar as an independent confirmation source in fog, mist, spray, and wet-surface cases, while remembering radar also has multipath.
- Do not use a ghost filter to compensate for poor sensor placement; add near-field coverage or redundant sensors where required.

## Sources

- Ghost-FWL project page: https://keio-csg.github.io/Ghost-FWL/
- PCL filters module, including ShadowPoints: https://pointclouds.org/documentation/group__filters.html
- PCL ShadowPoints reference: https://docs.ros.org/hydro/api/pcl/html/classpcl_1_1ShadowPoints.html
- Ill-reflecting surface robustness study: https://arxiv.org/abs/2309.10504
- Reflective noise filtering: https://www.mdpi.com/2072-4292/13/16/3058
- Autoware blockage diagnostics: https://autowarefoundation.github.io/autoware_universe/pr-10077/sensing/autoware_pointcloud_preprocessor/docs/blockage-diag/
