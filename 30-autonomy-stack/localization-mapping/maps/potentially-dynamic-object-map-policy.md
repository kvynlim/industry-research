# Potentially Dynamic Object Map Policy

**Last updated:** 2026-05-09

## Why It Matters

Potentially dynamic objects are objects that may be stationary now but can move later. In road mapping this includes parked vehicles. In airside mapping it includes aircraft, tugs, carts, stairs, loaders, buses, cones, chocks, dollies, FOD equipment, and temporary barriers.

The policy goal is not simply "remove dynamic objects." It is to prevent movable objects from contaminating the permanent static map while still preserving current hazards and operational blockages for the planner and safety system.

## Source Lessons

| Source | Technical lesson | Policy lesson |
|---|---|---|
| No More Potentially Dynamic Objects | Use 3D object detection, ground segmentation, and projection to build static point-cloud maps without parked vehicles | Object classes that can move should not become static anchors |
| YOLO-based potential dynamic removal | Camera detection plus LiDAR/NDT mapping can improve localization in traffic-heavy scenes | Multi-modal semantic filtering can outperform raw LiDAR segmentation alone |
| Dynamic map cleaning benchmark | Cleaning must preserve static infrastructure and FOD/hazard awareness | Map cleaning is a safety-validation problem |
| FAA FOD guidance | FOD is safety-critical when in an inappropriate location | Do not erase small hazards as "noise" |
| AIT Apron Dataset | Apron object detection needs domain-specific classes and environmental slices | Road vehicle classes are insufficient for airport policy |

## Policy Matrix

| Class | Potentially dynamic? | Permanent static map | Live map / planner | Notes |
|---|---:|---|---|---|
| Building, terminal edge, fixed pole | No | Keep/promote after QA | Hard obstacle | Primary localization candidates |
| Painted stand/service-road marking | No, but can be repainted | Keep/update after review | Route and alignment cue | Needs visibility/weather checks |
| Parked aircraft | Yes | Exclude | Occupancy obstacle and stand state | Never use as permanent localization anchor |
| GSE vehicle or cart | Yes | Exclude | Obstacle or route blockage | May be movable-static if parked |
| Cone/barrier line | Yes, unless work-zone approved | Exclude or temporary restriction | Block/slow/re-route | Promote only with ops confirmation |
| FOD/debris/tool | Yes/hazard | Exclude | Alert, stop, or avoid | Must not be cleaned away silently |
| Pedestrian/worker | Yes | Exclude | Dynamic actor | Person safety dominates map update |
| Snow/rain spray/reflection | Artifact/condition | Exclude | Condition-dependent caution | Keep evidence for QA if persistent |

## Processing Pipeline

| Step | Action | Failure to avoid |
|---|---|---|
| Semantic detection | Detect known movable classes in camera/LiDAR | Treating parked objects as walls |
| Ground reasoning | Segment ground and project/remove object points where appropriate | Creating holes in navigable ground |
| Static preservation | Preserve fixed infrastructure behind/around removed objects | Removing terminal edges or poles with object masks |
| Hazard branch | Route FOD-like small objects to live alert workflow | Erasing safety hazards as map noise |
| Persistence tracking | Count sightings by tile, object class, and pose quality | Promoting one-pass observations |
| QA gate | Review candidate static changes before publication | Automatic deletion under occlusion |
| Regression | Run localization and route tests on updated tile | Cleaner improves appearance but harms localization |

## Airside Class Policy

| Object family | Default layer | Static promotion condition |
|---|---|---|
| Aircraft | Movable-static/current occupancy | Never, unless modeling a fixed static mockup or permanently installed exhibit outside ODD |
| Tugs, belt loaders, buses, carts | Movable-static/current occupancy | Never by default |
| Passenger stairs, dollies, ULD racks | Movable-static | Only if airport defines fixed storage infrastructure, not individual movable assets |
| Cones, temporary signs, portable barriers | Temporary restriction or movable-static | Work order/ops approval plus schedule |
| Chocks, tools, debris | FOD/hazard | Never; create inspection/removal event |
| Fixed signs, lights, poles | Permanent static | Multi-session observation and map QA |
| Pavement markings | Permanent static/regulatory | Multi-view evidence and approval when safety-critical |

## Acceptance Metrics

| Metric | Target behavior |
|---|---|
| Movable-object rejection | High removal from permanent map |
| Static-feature preservation | No loss of fixed features behind movable objects |
| Ground continuity | Removed object footprints do not create false obstacles or holes |
| Hazard retention | FOD-like items appear as alerts, not map features and not discarded noise |
| Localization delta | Map cleaning improves or preserves scan-to-map localization |
| False-free-space rate | No claimed free space where a hazard or blocked route exists |
| Reviewer burden | Candidate static updates remain actionable per shift/stand |

## Implementation Guidance

1. Maintain two outputs from dynamic removal: a cleaned static candidate and a rejected-object evidence layer.
2. Use semantic class policy before geometry policy. A parked aircraft should be excluded even if it is observed consistently for many hours.
3. For 3D object detection methods, retain ground projection carefully so the map remains traversable but not falsely clear of live obstacles.
4. For camera-guided YOLO removal, log lighting/weather confidence because apron perception degrades at night, in glare, rain, fog, and de-icing conditions.
5. Never use a potentially dynamic removal model as the sole source of FOD clearance.
6. Tie all permanent-map promotions to source evidence, persistence, reviewer approval, and localization regression.

## Sources

- No More Potentially Dynamic Objects arXiv: https://arxiv.org/abs/2407.01073
- Enhancing LiDAR Mapping with YOLO-Based Potential Dynamic Object Removal: https://www.mdpi.com/1424-8220/24/23/7578
- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- FAA AC 150/5210-24A document page: https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5210-24
- AIT Apron Dataset: https://publications.ait.ac.at/de/datasets/apron-dataset/
- Local context: [Movable-Static Layering for Airside Maps](movable-static-layering-airside.md)
- Local context: [Airside Dynamic Map Cleaning Benchmark](../../../60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md)
