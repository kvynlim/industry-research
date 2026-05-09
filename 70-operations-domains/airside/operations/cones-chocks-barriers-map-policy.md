# Cones, Chocks, and Barriers Map Policy

**Last updated:** 2026-05-09

Cones, chocks, and portable barriers are safety-relevant airside objects, but they are usually not permanent map structure. They should be handled as current-world obstacles, temporary overlays, or operational fixtures with ownership and expiry. Promoting them into the permanent map by default creates stale-map and false-free-space risk when they move.

## Policy Summary

| Object | Default treatment | Permanent map rule |
|---|---|---|
| traffic cone | temporary overlay or current obstacle | never permanent unless installed as fixed infrastructure |
| aircraft chock | current obstacle or operational fixture | chock storage/station can be mapped; individual chock is not permanent |
| portable barrier | temporary no-go/speed overlay | permanent only after work-zone change is formalized |
| barrier base/weight | temporary obstacle | not permanent unless surveyed as fixed equipment |
| tow bar/hose/cable | current obstacle or hazard | not a map asset |
| fixed bollard/guard rail | permanent static | preserve after survey validation |

## Decision Matrix

| Condition | Map action | Ops action |
|---|---|---|
| object appears once in survey | mark movable-static review | do not publish permanent change |
| object is part of active closure | publish temporary overlay with owner and expiry | brief operators and affected routes |
| object protects unsafe area | no-go overlay or speed restriction | require safety owner approval |
| object moved from prior location | retire old overlay and create new observation | verify route impact |
| object conflicts with map route | perception has priority; map route blocked | create map/ops ticket |
| object is repeatedly present | evaluate as operational fixture | require formal approval before map promotion |
| object may be FOD or loose equipment | hazard/review layer | inspect or ticket under FOD process |

## Field Procedure

1. Record object type, location, route/stand, timestamp, source, and photo or point-cloud evidence.
2. Assign owner: ramp operations, safety, construction, ground handler, or map operations.
3. Select map treatment: current obstacle, temporary overlay, no-go zone, speed zone, quarantine, or no map action.
4. Set expiry for every temporary overlay and define renewal criteria.
5. Brief affected operators and vehicles before activating route-relevant overlays.
6. Remove or renew overlays when the field condition changes.
7. Preserve evidence when an object causes intervention, route blockage, FOD alert, or incident.

## Map Layer Rules

| Layer | Allowed content | Forbidden content |
|---|---|---|
| permanent static | fixed surveyed infrastructure | routine cones, chocks, portable barriers |
| temporary overlay | closures, barriers, cone lines, work zones, speed restrictions | unowned or non-expiring objects |
| current obstacle | perceived object in live scene | stale historical obstacle |
| FOD/hazard | loose, unexpected, or unsafe small objects | normal approved closure geometry |
| unknown/quarantine | ambiguous or conflicting evidence | silently assumed free space |

## Publication And Monitoring

| Check | Required evidence |
|---|---|
| overlay owner | person/team accountable for object and expiry |
| expiry | timestamp and renewal rule |
| route impact | affected stands, service roads, geofence, and dispatch constraints |
| perception priority | vehicle stops or avoids if object exists regardless of map expectation |
| rollback | overlay can be removed without changing base map |
| monitor | perception-map disagreement and interventions by overlay ID |

## Safety Notes

Cones and barriers can indicate a hazard that is more important than the object itself. The map policy must preserve the operational meaning: closure, restriction, work zone, aircraft protection, pedestrian separation, or FOD/hazard response.

Do not use absence from the map as permission to ignore a currently perceived cone, chock, or barrier. Current perception and airport operating instructions override static map assumptions.

## Sources

- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Part 139 CertAlert 24-02: https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- Autoware map component design: https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture/map/
- Local context: ../../../50-cloud-fleet/map-operations/movable-static-asset-lifecycle-policy.md
- Local context: fod-and-jetblast.md
