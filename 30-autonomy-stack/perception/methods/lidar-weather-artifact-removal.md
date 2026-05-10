# LiDAR Weather Artifact Removal

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["perception", "adverse-weather", "validation", "fallback", "mapping"]
  reason: "LiDAR Weather Artifact Removal is rated for cleaning, stress testing, or failure detection in degraded perception conditions."
method-priority:end -->

## What It Is

LiDAR weather artifact removal is the preprocessing and validation layer that separates real obstacles from returns caused by precipitation, aerosols, spray, steam, reflective ground, and receiver saturation. It is broader than snow denoising and broader than LIORNet. A production stack needs a weather-artifact family covering snow, rain, fog, dust, road spray, de-icing mist or steam, wet-surface multipath, retroreflector blooming, and sun or receiver saturation.

The objective is not to make the cloud visually clean. The objective is to prevent false obstacles while preserving safety-critical real objects, especially people, cones, tow bars, chocks, baggage carts, and aircraft ground-contact structure.

## Core Technical Idea

Weather artifacts differ by physical mechanism:

- Particles and droplets create short-lived sparse or dense returns.
- Fog and mist attenuate real returns and add volumetric backscatter.
- Wet surfaces and glass create specular reflection, dropouts, or ghost points.
- Retroreflectors and highly reflective markings can saturate or bloom in range/intensity space.
- Direct sun or receiver saturation can create angular sectors with missing or corrupted returns.

No single filter handles all of these. A robust stack composes classical outlier filters, intensity/range models, temporal persistence, sensor health monitoring, multi-return or waveform cues, and cross-sensor checks against radar, camera, thermal, map priors, and odometry.

## Inputs and Outputs

| Input | Why it matters |
|---|---|
| XYZ, intensity, ring, timestamp | Minimum for range, intensity, sector, and temporal filtering. |
| Multi-return or waveform data | Helps separate near particles, real surfaces, and multipath ghosts where available. |
| Weather state | Selects rain, snow, fog, dust, spray, or de-icing policies. |
| Vehicle speed and ego motion | Road spray and temporal accumulation depend on relative motion. |
| Map and ground model | Needed to detect below-ground wet-surface artifacts and persistent map disagreement. |
| Radar/camera/thermal tracks | Critical independent confirmation before removing safety-relevant points. |

Outputs:

- Cleaned cloud for downstream perception.
- Removed weather/artifact cloud.
- Per-artifact diagnostic ratios by range, sector, height, and intensity.
- Degradation state used by ODD management and sensor cleaning.

## Artifact Family Taxonomy

| Artifact family | Typical signature | Good removal signals | Airside concern |
|---|---|---|---|
| Snowflakes | Low-intensity near points, sparse or clustered, often above ground | DROR, DSOR, LIOR, DDIOR, DVIOR, IDSOR, SDOR, LIDSOR, LIORNet | Can hide personnel legs and tow bars; falling and accumulated snow differ. |
| Rain drops | Sparse near false returns plus range attenuation | DROR/DSOR variants, temporal persistence, multi-return gating | Tropical downpours and apron spray can be denser than road datasets. |
| Fog | Volumetric backscatter, reduced max range and intensity | Range-intensity health metrics, radar fallback, conservative ODD limits | Thick fog can reduce localization features and obstacle range. |
| Dust and FOD clouds | Dense low or variable intensity, often wind-driven | Sector health, temporal inconsistency, radar/camera cross-check | Jet blast and prop wash can lift debris near aircraft. |
| Road spray | Near-field fan-shaped returns behind tires or vehicles | Ego-relative motion, temporal consistency, radar confirmation | Wet apron operations and high-flow service roads. |
| De-icing mist/steam | Local fog-like plume, chemical residue on cover | Weather/geofence policy, sensor cleaning, radar-primary mode | Glycol film may persist after plume disappears. |
| Wet-surface multipath | Below-ground or mirrored returns, ground holes | Ground model residual, ray consistency, camera/radar context | Wet concrete and painted markings are common. |
| Retroreflector blooming | Enlarged high-intensity target footprint or adjacent false points | Intensity saturation checks, target whitelist, geometry bounds | Apron signs, markings, cones, vests, and reflective tape. |
| Sun/receiver saturation | Angular sectors with dropout or false noise | Per-sector point count, intensity histograms, sensor health | Low sun over flat apron, reflective aircraft skin. |

## Architecture or Pipeline

1. Detect sensor health and blockage before denoising. A blocked LiDAR should not be "fixed" by filtering.
2. Classify the likely artifact mode using weather, sector statistics, intensity, max range, and cross-sensor evidence.
3. Apply the least aggressive filter that controls false positives for the active mode.
4. Protect near-field safety zones with redundant confirmation before deletion.
5. Maintain temporal hysteresis so single-frame artifacts do not produce planner oscillation.
6. Feed degradation state to runtime assurance: normal, reduced speed, radar-primary, minimum speed, controlled stop.
7. Save both raw and filtered clouds for safety investigation and retraining.

## Technique Fit

| Technique | Weather fit | Deployment note |
|---|---|---|
| SOR/ROR | Light isolated points | Baseline only; not enough for dense weather. |
| DROR/DSOR | Snow and rain with range-dependent sparsity | Strong classical baseline on WADS-style snow. |
| LIOR/DDIOR/D-LIOR | Snow with useful intensity separation | Requires per-LiDAR intensity calibration. |
| IDSOR | Rain and snow with range-dependent empirical weather model | Useful when target-site weather data exists. |
| DVIOR | Snow where vertical and low-intensity cues help | Check ramps, aircraft gear, and overhanging equipment. |
| SDOR | Snow, rain, fog with real-time sectorization | Good candidate for high-rate large clouds. |
| LIDSOR | Rain and snow with intensity plus spatial distribution | Good research baseline; validate thresholds per sensor. |
| LIORNet | Learned snow removal from self-supervised pseudo-labels | Promising, but should be validated against classical baselines and airside negatives. |
| Full-waveform ghost removal | Multipath and glass ghosts | Hardware dependent; valuable for reflective terminals and wet surfaces. |
| Radar fallback | Fog, rain, dust, de-icing mist | Essential independent modality for airside safety. |

## Training and Evaluation

Weather removal should be evaluated at three levels:

- Point level: noise precision, noise recall, static preservation, and per-artifact confusion.
- Perception level: object detection, tracking stability, false obstacle rate, and missed obstacle rate.
- System level: localization residual, planner interventions, ODD state transitions, and sensor cleaning triggers.

Recommended datasets and references include WADS, CADC, RADIATE, Weather-KITTI-style weather benchmarks, Ghost-FWL for multipath/ghost reasoning, and HeLiMOS-style moving-object labels for dynamic clutter. Public road datasets are not enough for airside operation; add airport captures for glycol mist, wet concrete, reflective stands, aircraft fuselage, service vehicles, cones, chocks, and personnel.

## Strengths

- Reduces false obstacles from weather and sensor artifacts.
- Improves scan matching by reducing transient returns.
- Enables explicit sensor degradation reporting.
- Provides interpretable safety-case evidence when raw and removed clouds are archived.
- Helps keep static maps free of weather traces and dynamic clutter.

## Failure Modes

- Filtering removes real small obstacles because they look like sparse noise.
- Learned denoisers overfit to road snow and miss airport-specific glycol, steam, or spray.
- Intensity thresholds fail after sensor replacement, firmware change, cover contamination, or temperature shift.
- Dense spray/fog passes as a coherent surface.
- Radar fallback is treated as universal even though radar has its own multipath and angular-resolution limits.
- A "clean" cloud hides the fact that range and coverage are no longer sufficient for the current speed.

## Airside AV Fit

Airside vehicles should use weather artifact removal as part of an ODD-aware perception contract:

- Clear weather: light classical filtering plus diagnostics.
- Light rain/snow: DROR/DSOR/SDOR-style filtering with radar cross-check.
- Heavy rain/fog/de-icing mist: radar-primary perception, reduced speed, and stricter LiDAR health thresholds.
- Wet apron: ground-model multipath detection and conservative treatment of below-ground returns.
- Retroreflective apron regions: whitelist known signs and markings; do not train detectors to treat bloom as object extent.
- Sensor contamination: trigger cleaning and validation before returning to normal mode.

## Implementation Notes

- Keep raw, cleaned, and removed clouds synchronized in logs.
- Tune filters per LiDAR model, mounting height, cover material, and cleaning system.
- Separate weather artifacts from dynamic object removal. A moving baggage cart is not weather noise.
- Do not use filter success on snow as evidence for fog, dust, steam, or wet-surface multipath.
- Track the removal budget. If more than a configured fraction of near-field points is removed, degrade the ODD state.
- For safety, validate "no obstacle deleted" scenarios as hard as "false obstacle removed" scenarios.

## Sources

- Classical outlier baselines: https://www.open3d.org/docs/latest/tutorial/Advanced/pointcloud_outlier_removal.html
- PCL filters: https://pointclouds.org/documentation/group__filters.html
- DSOR and WADS: https://arxiv.org/abs/2109.07078
- DDIOR: https://www.mdpi.com/2072-4292/14/6/1468
- DVIOR: https://www.mdpi.com/2079-9292/14/18/3662
- IDSOR: https://arxiv.org/abs/2602.05876
- SDOR: https://www.nature.com/articles/s41598-026-38674-6
- LIORNet: https://arxiv.org/abs/2603.19936
- LIDSOR: https://isprs-archives.copernicus.org/articles/XLVIII-1-W2-2023/733/2023/
- Ghost-FWL: https://keio-csg.github.io/Ghost-FWL/
- Autoware blockage diagnostics: https://autowarefoundation.github.io/autoware_universe/pr-10077/sensing/autoware_pointcloud_preprocessor/docs/blockage-diag/
