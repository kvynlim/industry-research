# Movable Static Asset Lifecycle Policy

**Last updated:** 2026-05-09

Movable-static assets are stationary during a capture but should not automatically become permanent map truth. On the airside, cones, chocks, barriers, staged carts, belt loaders, buses, tow bars, stairs, and parked GSE can dominate a map build. The lifecycle policy keeps these objects useful without letting them corrupt the permanent localization or semantic map.

## Asset States

| State | Definition | Map treatment | Exit condition |
|---|---|---|---|
| observed | object appears in fleet or survey data | candidate review layer | classify or dismiss |
| temporary | expected to move or expire | temporary overlay with owner and expiry | removed, renewed, or escalated |
| operational fixture | movable but intentionally deployed for operations | controlled overlay | approved procedure changes |
| persistent infrastructure | repeatedly observed and approved as site structure | permanent map layer | formal change request |
| removed | no longer present or no longer valid | retire from active overlays | closure evidence archived |
| unknown | insufficient evidence or conflicting observations | quarantine tile or block publication | review decision |

## Classification Rules

| Asset | Default state | Publication rule |
|---|---|---|
| cone line | temporary | overlay only; expiry required |
| aircraft chock | temporary or operational fixture | never permanent unless a fixed chock station is surveyed |
| portable barrier | temporary | no-go or speed overlay with owner |
| staged GSE | movable-static | exclude from permanent localization map |
| parked bus/cart | movable-static | exclude unless approved as an operational fixture |
| fixed cabinet/light/pole | persistent infrastructure | preserve after static-asset validation |
| construction barrier | temporary | overlay plus work-order reference |
| FOD object | hazard | hazard workflow, not a map asset |

## Lifecycle Workflow

| Step | Action | Required record |
|---|---|---|
| detect | fleet, survey, operator, or work-order report identifies asset | observation ID, location, source, timestamp |
| classify | assign asset state and safety relevance | class, confidence, reviewer, evidence |
| decide | retain, overlay, quarantine, ignore, or escalate | decision and approver |
| publish | include overlay or permanent change in signed map bundle | map ID, overlay ID, expiry, rollback |
| monitor | compare perception and map state in operation | disagreement telemetry and alerts |
| retire | remove expired or no-longer-present asset | closure evidence and audit trail |

## Ownership And SLAs

| Asset class | Owner | SLA |
|---|---|---|
| safety barriers and closures | airport ops or safety | review before route use |
| cones/chocks near stands | ramp operations | same shift or before publication |
| construction assets | project/work-zone owner | expiry date mandatory |
| GSE staging | ground handler or fleet ops | review if persistent beyond policy window |
| unknown safety-critical object | map release approver | quarantine until disposition |
| permanent infrastructure proposal | map owner plus safety reviewer | formal map change request |

## Publication Gates

| Gate | Pass condition | Blocker |
|---|---|---|
| state assigned | every movable-static candidate has a state | unclassified object in active route tile |
| owner assigned | temporary and operational fixtures have named owners | no accountable owner |
| expiry set | temporary overlays have expiry and review cadence | open-ended temporary object |
| localization checked | permanent promotion does not harm localization | static erosion or ghost dependency |
| perception priority | runtime obstacle perception overrides map assumption | static map used to ignore current obstacle |
| rollback ready | overlay and base map can be reverted independently | coupled release cannot be rolled back |

## Release Checklist

1. Keep movable-static assets out of the permanent map by default.
2. Publish approved temporary assets as overlays with owner, reason, and expiry.
3. Require cross-session evidence and reviewer approval before permanent promotion.
4. Treat absence of an object as a change request, not as automatic free space.
5. Include movable-static state in map diffs and operator briefings.
6. Alert on perception-map disagreement for operational fixtures and temporary closures.

## Sources

- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- Autoware map component design: https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture/map/
- Autoware Lanelet2 map validator: https://github.com/tier4/autoware_lanelet2_map_validator
- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- Local context: hd-map-lifecycle-operations.md
- Local context: ../../60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md
