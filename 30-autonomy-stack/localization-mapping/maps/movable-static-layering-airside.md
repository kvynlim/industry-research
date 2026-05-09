# Movable-Static Layering for Airside Maps

**Last updated:** 2026-05-09

## Why It Matters

Airside maps fail when they use a binary static/dynamic split. Many apron objects are stationary during a pass but should not become permanent localization anchors: parked aircraft, belt loaders, baggage carts, tugs, stairs, cones, chocks, dollies, fuel trucks, buses, snow piles, and temporary barriers.

The practical answer is a layered map policy. Permanent static infrastructure supports localization and planning. Movable-static objects are tracked, reviewed, and used for current operations where appropriate, but they are not promoted into the canonical static map without explicit approval.

## Layer Model

| Layer | Examples | Lifetime | Used for localization? | Update authority |
|---|---|---|---|---|
| Permanent static | Terminal walls, poles, blast fences, curbs, fixed signs, approved markings | Months-years | Yes, after QA | Survey/map authority |
| Regulatory/static-operational | movement-area boundaries, stop bars, service-road graph, speed zones | AIRAC/local ops cycle | Yes for planning rules, cautiously for localization | Airport/AIRAC/ops source |
| Movable-static | parked aircraft, staged GSE, carts, stairs, cones, temporary barriers | Minutes-days | No by default | Fleet evidence plus ops review |
| Current dynamic | moving aircraft, vehicles, workers, wildlife | Seconds-minutes | No | Live perception |
| FOD/hazard | debris, loose tools, foreign material, spills | Until removed | No | Live alert and inspection workflow |
| Artifact/unknown | reflections, rain spray, bad segmentation, unresolved cluster | Unknown | No | QA or discard |

## Decision Table

| Observed object/state | Map action | Planner action | Review action |
|---|---|---|---|
| Fixed wall or pole repeats across sessions | Promote/retain permanent static | Treat as hard obstacle | Periodic QA only |
| Stand marking shifted after repaint | Candidate geometry update | Use current perception until approved | Human review and map regression |
| Aircraft parked at stand | Movable-static current occupancy | Avoid using live obstacle layer | No static promotion |
| Belt loader parked overnight | Movable-static with persistence counter | Avoid or route around if blocking | Review if repeated in same place |
| Temporary construction barrier | Live restriction, then change candidate if persistent | Treat as blocked route | Require ops confirmation |
| Cone line for work area | Movable-static or temporary restriction | Block if inside route | Expire by schedule or review |
| FOD-like object | Hazard alert, not map feature | Stop/avoid per safety policy | Inspection/removal ticket |
| Missing static feature | Deletion candidate only | Do not assume free space from one pass | Occlusion and multi-pass check |

## Promotion Rules

| Candidate | Minimum evidence before promotion |
|---|---|
| New permanent structure | Multi-session observation, good pose quality, no aircraft/GSE class, ops confirmation |
| Repainted marking | Multiple clean views, dry/visible surface, human or survey approval near stands/hold points |
| Removed permanent object | Repeated absence from viewpoints that should see it, occlusion ruled out, approval for safety-critical areas |
| Temporary barrier to static restriction | Work order/NOTAM/airport ops confirmation plus observed geometry |
| Movable-static to asset map | Explicit airport asset record; otherwise keep outside static localization map |

## Feature Attributes

| Attribute | Purpose |
|---|---|
| `layer` | Permanent static, regulatory, movable-static, dynamic, hazard, artifact, unknown |
| `source` | Survey, AMDB/AIXM, fleet observation, ops feed, reviewer, synthetic benchmark |
| `first_seen` / `last_seen` | Persistence and expiry |
| `observation_count` | Evidence strength across passes/vehicles |
| `pose_quality` | Prevent map edits from poor localization |
| `semantic_class` | Aircraft, tug, cart, cone, barrier, marking, wall, debris, etc. |
| `promotion_state` | observed, quarantined, reviewed, approved, rejected, expired |
| `static_anchor_allowed` | Explicit gate for localization map use |
| `review_reason` | Why human approval is needed |

## Airside Operating Guidance

1. Default every object class that can reasonably move to movable-static, even if it is stationary in the current scan.
2. Treat FOD and small hazards as live safety alerts, not as map-cleaning noise and not as permanent map features.
3. Separate current occupancy from permanent obstruction. A parked aircraft blocks a path today but should not become a wall in the base map.
4. Require authoritative confirmation for regulatory or route-topology changes. Fleet observations can trigger review but should not override airport data.
5. Use time-to-live values for movable-static layers so stale equipment occupancy does not persist after shift changes.
6. Publish map diffs only after localization regression confirms the static layer remains stable.
7. Keep rejected movable-static evidence for audit and future training rather than silently discarding it.

## Benchmark Implications

| Benchmark label | Required output |
|---|---|
| Permanent static retained | Static map point/element survives cleaning |
| Movable-static suppressed | Object excluded from permanent map but optionally available as current occupancy |
| Hazard retained as alert | FOD-like object is not erased from operational awareness |
| Dynamic removed | Moving object traces do not pollute map |
| Artifact rejected | Sensor/registration artifacts do not enter any operational layer |
| Unknown escalated | Ambiguous clusters go to QA instead of automatic promotion |

## Sources

- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- AIT Apron Dataset: https://publications.ait.ac.at/de/datasets/apron-dataset/
- AIT Apron paper: https://openaccess.thecvf.com/content/ACCV2022W/MLCSA/papers/Steininger_Towards_Scene_Understanding_for_Autonomous_Operations_on_Airport_Aprons_ACCVW_2022_paper.pdf
- Local context: [Airside Dynamic Map Cleaning Benchmark](../../../60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md)
- Local context: [LT-Mapper, Khronos, and Lifelong Mapping](../slam-methods/lt-mapper-khronos-lifelong-mapping.md)
