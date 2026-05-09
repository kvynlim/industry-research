# Map Publication Gates for Airside Hygiene

**Last updated:** 2026-05-09

Airside map publication must combine map quality, operational approval, safety evidence, and rollout control. The goal is to prevent stale maps, over-cleaned maps, hidden FOD, and temporary assets from reaching vehicles as if they were permanent ground truth.

## Release States

| State | Meaning | Allowed use |
|---|---|---|
| draft | candidate map or overlay under construction | offline validation only |
| validation | automated and human checks running | replay, simulation, non-operational vehicle |
| quarantined | unresolved safety or evidence issue | not deployable |
| canary | signed release to limited zone/cohort | monitored operation inside approved envelope |
| active | production map for approved vehicles/routes | normal dispatch |
| rolled_back | superseded due to issue | incident/replay only |
| retired | no vehicle may use it | archive and legal hold as needed |

## Publication Gate Table

| Gate | Evidence | Required approver |
|---|---|---|
| source provenance | raw logs, survey dates, calibration, control points, coordinate frame | map owner |
| hygiene validation | dynamic rejection, static preservation, FOD retention, unknown/quarantine report | V&V lead |
| semantic integrity | Lanelet2/vector validation, route reachability, geofence, speed/no-go overlays | autonomy lead |
| operational fit | stand/route availability, closure/work-zone status, sponsor constraints | airport ops |
| safety case delta | hazard impact, residual risk, FAA AGVS/test-plan trace if applicable | safety lead |
| deployment readiness | signed bundle, compatible vehicle/software, rollback cache, canary monitors | fleet ops |
| post-release review | monitoring window, interventions, map disagreements, FOD tickets | release manager |

## Map Hygiene Checks

| Check | Pass signal | Blocker |
|---|---|---|
| dynamic object removal | ghost rate below zone threshold | aircraft/GSE ghosts in localization layer |
| static preservation | no unresolved deletion of safety-critical assets | eroded stand marking, curb, pole, or boundary |
| FOD retention | FOD-like candidates retained as hazard/review evidence | small hazard deleted as noise |
| movable-static policy | temporary assets published only as overlays | cone/barrier/GSE promoted without approval |
| sparse LiDAR handling | weak evidence marked unknown or reviewed | unobserved area marked free |
| localization replay | NDT/ICP health neutral or improved | residual, covariance, or recovery regression |

## Release Checklist

1. Bundle point-cloud, semantic, projection, overlay, and validation artifacts atomically.
2. Include map ID and active layer IDs in every vehicle mission log.
3. Sign the bundle and record compatible software, sensor, and model versions.
4. Confirm rollback bundle availability before canary deployment.
5. Canary by zone, route, stand, and vehicle cohort, not by percentage alone.
6. Monitor localization, route failures, map disagreement, FOD tickets, and interventions.
7. Promote only after the monitoring window covers relevant conditions such as shift handover, night, rain, or busy stand operations.
8. Retire superseded bundles only after all vehicles report leaving the old version.

## Operational Overrides

| Override | Rule |
|---|---|
| emergency no-go | fast publish allowed; post-change review within one business day |
| temporary work zone | owner, reason, expiry, and briefing required |
| FOD hazard | hazard alert can block route without permanent map edit |
| construction change | quarantine affected tile until source evidence and route checks pass |
| airport sponsor restriction | override map route availability immediately |

## Sources

- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Part 139 CertAlert 24-02: https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- Autoware map component design: https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture/map/
- Autoware map loader: https://autowarefoundation.github.io/autoware_core/latest/map/autoware_map_loader/
- Local context: hd-map-lifecycle-operations.md
- Local context: movable-static-asset-lifecycle-policy.md
