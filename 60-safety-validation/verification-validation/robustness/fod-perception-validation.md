# FOD Perception Validation

**Last updated:** 2026-05-09

Foreign object debris perception is a safety-relevant function when an autonomous vehicle or inspection system uses sensors to declare a runway, taxiway, stand, service road, or apron path clear. Validation must prove that the perception chain can detect hazardous debris early enough for the operational response, while controlling false alarms that can disrupt airport operations.

This page is validation-focused. It does not describe airport FOD program operations or dynamic map-cleaning benchmarks.

---

## Safety Claim

Within the validated airside ODD, the FOD perception system detects, localizes, and reports hazardous foreign object debris in the vehicle or inspection corridor with sufficient confidence, latency, and spatial accuracy for the defined operational response, and it enters a monitored degraded state when sensing conditions are outside the validated envelope.

The claim is intentionally bounded. FOD perception does not prove the airport is free of debris; it proves performance for specified sensors, operating speeds, inspection geometry, object classes, environmental conditions, and response procedures.

---

## Hazards And Failures

| Failure | Cause | Safety consequence | Required evidence |
|---|---|---|---|
| False clear | FOD missed or suppressed as background | Vehicle proceeds over debris or aircraft hazard remains undetected | Miss-rate and false-clear analysis by object, size, material, range, and lighting. |
| Late detection | Detection occurs after stopping or avoidance distance | Insufficient response time | Time-to-detect and distance-to-detect at operating speeds. |
| Poor localization | Box/mask does not map to correct ground position | Planner or inspector looks in wrong place | Ground-plane error and corridor-overlap metrics. |
| False alarm | Markings, rubber deposits, shadows, cracks, reflections, or normal hardware flagged as FOD | Operational disruption and alarm fatigue | False positives per inspection distance/hour and hard-negative testing. |
| Small-object blind spot | Object below pixel/point/radar resolution or contrast threshold | System exceeds sensor capability silently | Minimum detectable size by range and material. |
| Environmental domain shift | Rain, wet pavement, night lighting, glare, snow, de-icing residue, dust | Unvalidated performance loss | Environmental slice coverage and degraded-state triggers. |
| Taxonomy gap | New debris type not in training set | Unknown object ignored or misclassified | Open-set and unknown-object tests. |
| Sensor degradation | Dirty lens, blocked LiDAR window, radar interference, bad calibration | Hidden perception insufficiency | Sensor health monitoring and fallback evidence. |

---

## Evidence Required

| Evidence type | Minimum content |
|---|---|
| Dataset manifest | Object type, material, dimensions, color/reflectivity, placement, background, lighting, weather, range, sensor mounting, and timestamp. |
| Public benchmark evidence | FOD-A or equivalent small-FOD results, including environmental slices and AP-small/recall. |
| Target-airport holdout | Site-specific pavement, markings, rubber, lighting, weather, equipment, and debris types not used for tuning. |
| Physical test campaign | Placed FOD articles with known ground-truth positions and dimensions. |
| Hard-negative campaign | No-FOD scenes with markings, shadows, reflections, cracks, rubber deposits, standing water, cones, chocks, and normal hardware. |
| Sensor health evidence | Dirty/blocked sensor, defocus, exposure failure, calibration drift, and missing-frame detection. |
| Runtime logs | Raw sensor data, detections, confidence, tracks, removed candidates, health state, ODD state, and operator/planner response. |
| Change-control records | Model, threshold, sensor, mount, calibration, and post-processing versions tied to test results. |

---

## Metrics

| Layer | Metrics |
|---|---|
| Detection | Recall by hazard class, AP-small, mAP, false negatives by size/material/range, false positives per image or kilometer. |
| Localization | Ground-plane center error, box/mask IoU, corridor overlap, range-bearing error, recovery-position error for inspection. |
| Timing | Time-to-detect, distance-to-detect, end-to-end latency p50/p95/p99, track confirmation latency. |
| Safety outcome | False-clear rate, hazardous-FOD miss rate, successful stop/avoid/alert rate, alarm handling success. |
| Robustness | Metric degradation by light, wet/dry, rain, glare, night, pavement type, sensor contamination, and calibration drift. |
| Monitor performance | Degraded-state precision/recall, sensor-cleaning trigger accuracy, fallback transition latency. |

The safety review should prioritize false-clear and hazardous-FOD miss rate over aggregate AP. A low AP on harmless nuisance objects may be acceptable; a missed metal object in the operating corridor may not be.

---

## Acceptance Rules

| Rule | Rationale |
|---|---|
| Define hazardous FOD before testing. | Acceptance depends on object size, material, location, and operational response. |
| No acceptance from public datasets alone. | Public data cannot cover a specific airport's pavement, lighting, debris, and procedures. |
| Lock thresholds before the target holdout run. | Prevents optimistic post-hoc tuning. |
| Report false clear separately from general false negatives. | The operational risk is path clearance with a hazard present. |
| Validate minimum detectable size by range. | Sensor resolution imposes hard limits that model metrics can obscure. |
| Require hard-negative performance. | Excessive false alarms can make the system operationally unusable. |
| Log raw evidence and rejected candidates. | Missed detections and false suppressions must be auditable. |
| Revalidate after sensor, mount, calibration, model, or post-processing changes. | FOD perception is sensitive to imaging geometry and thresholds. |

Acceptance thresholds should be set by the safety case and airport operation, not copied from public leaderboards. At minimum, each threshold must specify the object class/size, corridor, range, operating speed, sensor state, environmental slice, and response action.

---

## Test Matrix

| Dimension | Required slices |
|---|---|
| Object type | Metal hardware, rubber, plastic, fabric/strap, paper/plastic film, tools, luggage/baggage items, aircraft servicing items. |
| Size | Below threshold, near threshold, expected hazardous size, large obvious object. |
| Material/appearance | Dark, bright, reflective, transparent/translucent, wet, low contrast, thermal contrast. |
| Placement | Centerline/path, edge of corridor, near markings, near cracks, in shadow, partly occluded, adjacent to legitimate equipment. |
| Background | Runway/taxiway pavement, apron concrete, stand markings, rubber deposits, wet pavement, snow/slush where in ODD. |
| Lighting | Day, dusk/dawn, night apron lighting, glare, backlight, flashing beacons. |
| Weather/condition | Dry, wet, rain, fog/mist if in ODD, de-icing residue, dust/jet-blast residue where applicable. |
| Sensor state | Clean, dirty lens/window, partial blockage, exposure failure, LiDAR point loss, calibration drift, missing frame. |
| Operational mode | Inspection speed, autonomous transit speed, stop-and-confirm, remote operator review, degraded fallback. |

---

## Traceability

| Artifact | Trace to |
|---|---|
| Safety claim | ODD, operating speed, response procedure, sensor configuration, and airport FOD management interface. |
| Hazard analysis | False clear, late detection, false alarm, localization error, sensor degradation, and domain shift hazards. |
| Requirements | Detectable object definitions, latency limits, localization limits, false-clear limits, false-alarm limits, and monitor behavior. |
| Tests | Public benchmark, target holdout, physical placed-object campaign, hard negatives, sensor degradation, and replay/regression. |
| Results | Per-slice metric tables, raw logs, threshold configuration, model version, calibration version, and residual risk disposition. |
| Operations | Alert routing, operator review, vehicle response, maintenance triggers, and retraining/change-control loop. |

Each production release should include a FOD perception evidence package: dataset manifest, locked test plan, metric report, unresolved residual risks, and trace links from failures to mitigations.

---

## Sources

- [FAA Foreign Object Debris Program](https://www.faa.gov/airports/airport_safety/fod)
- [FAA AC 150/5220-24, Foreign Object Debris Detection Equipment](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentNumber/150_5220-24)
- [FAA AC 150/5210-24A, Airport Foreign Object Debris Management](https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5210-24)
- [FOD-A GitHub repository](https://github.com/FOD-UNOmaha/FOD-data)
- [FOD-A arXiv paper](https://arxiv.org/abs/2110.03072)
- [Small-Scale Foreign Object Debris Detection Using Deep Learning and Dual Light Modes](https://www.mdpi.com/2076-3417/14/5/2162)
