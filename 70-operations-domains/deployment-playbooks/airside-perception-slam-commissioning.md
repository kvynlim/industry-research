# Airside Perception-SLAM Commissioning Playbook

**Last updated:** 2026-05-09

## Purpose

This playbook defines the commissioning sequence for airside perception, SLAM/localization, mapping, calibration, runtime monitors, dashboards, and operational response. It starts after a site has an approved concept of operations and ends when the site owner, safety lead, fleet operations, and runtime owners accept autonomous operation for a defined route/ODD slice.

## Entry Criteria

| Item | Required before vehicle commissioning |
|---|---|
| Site authority | Airport sponsor/site owner approval, safety management process, stakeholder communication plan |
| CONOPS | Route, mission type, speed, ODD limits, supervision mode, MRC, stop authority |
| Regulatory scan | FAA/CAA/airport guidance, airside rules, insurance, SMS integration |
| Safety baseline | Hazards, risk controls, safety-case claim IDs, incident reporting workflow |
| Runtime baseline | Signed software/model/map/calibration/config manifest and rollback set |
| Data permissions | Logging, upload, privacy, retention, and access control approval |

## Phase 1: Site Survey and Instrumentation

| Task | Acceptance check |
|---|---|
| Survey route, stands, depot, charging, emergency access, no-go zones | Route graph and protected zones reviewed by operations and safety |
| Identify weak-feature, GNSS-shadow, glare, wet-surface, jet-blast, FOD, and pedestrian hotspots | Hotspots become ODD slices and test waypoints |
| Establish ground control and map datum | Survey package and uncertainty model stored |
| Validate communications and time infrastructure | PTP/GNSS/PPS or site clock plan documented |
| Install observability tags | Vehicle/site/route/map/calibration IDs join in telemetry |

## Phase 2: Vehicle and Sensor Readiness

| Task | Acceptance check |
|---|---|
| Verify sensor serials, firmware, timestamp mode, mounting, cleaning state | Vehicle inventory matches compatibility manifest |
| Apply baseline calibration package | Intrinsics, extrinsics, time offsets, TF tree hash stored |
| Run stationary and route calibration checks | Residuals inside commissioning threshold |
| Validate diagnostics graph | Critical sensor, timing, calibration, localization, perception, map, and runtime nodes present |
| Run local stop/MRC checks | Vehicle executes controlled stop under monitor red state |

## Phase 3: Map Capture and Map QA

| Task | Acceptance check |
|---|---|
| Capture multiple route passes | Day/night and operational traffic slices represented where in ODD |
| Build map bundle and semantic layers | Permanent, movable-static, dynamic, hazard, unknown, route/geofence layers separated |
| Review temporary assets | Cones, chocks, parked GSE, aircraft, barriers classified or overlaid with expiry |
| Run source-session timing and calibration checks | Red/unknown sessions excluded from automatic map publication |
| Run map publication gates | No false-free-space, frame, tile, overlay, or route mismatch blocker |

## Phase 4: Closed-Course and Controlled Route Tests

| Test | Gate |
|---|---|
| Localization start/relocalization | Pose valid inside route threshold before motion |
| Free-space fixtures | Aircraft/GSE/person/FOD/cone/chock fixtures are not marked traversable |
| Unknown-object fixtures | Novel/unknown objects trigger conservative action |
| Timing/calibration perturbation | Monitors detect fault before unsafe planner consumption |
| Wet/night/glare/adverse slice if in ODD | Metrics pass by slice, not only aggregate |
| Emergency stop and remote-assist workflow | Operator response time and evidence preservation pass |

## Phase 5: Shadow Mode

| Requirement | Pass rule |
|---|---|
| Exposure | Representative route windows, traffic states, weather/lighting, and operational tempo |
| Metric envelope | Localization residual, intervention proxy, unknown/OOD rate, free-space disagreement, latency, diagnostics state inside baseline |
| Operator workflow | Alerts reach the right role and produce correct acknowledgement/action |
| Evidence | Every shadow run joins vehicle, route, map, calibration, build, bag/MCAP, and operator notes |
| Exit | Safety lead and site owner accept remaining restrictions |

## Phase 6: Canary Operations

| Step | Promotion gate |
|---|---|
| One vehicle, low-risk window | No P0/P1 perception-SLAM alert; manual override available |
| One operational route | Mission success and safety metrics inside shadow envelope |
| Extended operating windows | No unresolved disagreement cluster, calibration drift, or unknown-object cluster |
| Multiple vehicles | Fleet dashboards and incident joins scale without missing fields |
| Steady state | Maintenance, map update, calibration, OTA, and alert runbooks exercised |

## Stop-Work Triggers

| Trigger | Action |
|---|---|
| False-free-space in protected zone | Stop autonomous testing; preserve evidence; safety review |
| Pose red without vehicle response | Stop testing; runtime assurance defect |
| Unknown/OOD object suppressed in route corridor | Stop promotion; model/monitor/planner review |
| Wrong map/calibration/model active | Stop dispatch; compatibility manifest audit |
| Diagnostic graph missing critical node | Treat site evidence as incomplete until fixed |
| Airport operations change route/stand rules | Re-run impact analysis and affected tests |

## Handover Package

| Artifact | Owner |
|---|---|
| Commissioning report and route/ODD approval | Deployment lead |
| Active manifest and rollback set | Release manager |
| Map QA and source-session provenance | Mapping owner |
| Calibration package and drift thresholds | Calibration owner |
| Safety-case delta and residual risk decision | Safety lead |
| Alert runbook, escalation roster, and training record | Fleet operations |
| Dashboard screenshots/sample event joins | Fleet SRE |
| Maintenance and recalibration SOP | Maintenance lead |

## Related Repository Docs

- `70-operations-domains/deployment-playbooks/deployment-playbook.md`
- `70-operations-domains/deployment-playbooks/multi-airport-adaptation.md`
- `70-operations-domains/airside/operations/ground-control-instructions.md`
- `50-cloud-fleet/map-operations/map-publication-gates-airside-hygiene.md`
- `40-runtime-systems/software-operations/sensor-calibration-fleet-ops.md`
- `50-cloud-fleet/observability/perception-slam-alert-runbooks.md`

## Sources

- FAA Part 139 CertAlert 24-02, Autonomous Ground Vehicle Systems Technology on Airports: https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02
- FAA New and Emerging Entrants, Autonomous Ground Vehicle Systems on Airports: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- IATA Airport Handling Manual: https://www.iata.org/ahm
- ISO 3691-4:2023, Driverless industrial trucks and their systems: https://www.iso.org/standard/83545.html
- ISO/TS 5083:2025, ADS safety design, verification and validation: https://www.iso.org/standard/81920.html
- Autoware/TIER IV CalibrationTools guide: https://autowarefoundation.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/creating-vehicle-and-sensor-model/calibrating-sensors/calibration-tools/
- Waymo, "Safety Methodologies and Safety Readiness Determinations": https://arxiv.org/abs/2011.00054
