# Airside Map Hygiene Ground Truth Protocol

**Last updated:** 2026-05-09

## Why It Matters

Map hygiene ground truth defines what belongs in the permanent map, what belongs only in the live operational layer, and what should trigger review or inspection. Without this protocol, dynamic removal and map-change benchmarks can score well while erasing FOD, preserving parked GSE as infrastructure, or deleting safety-critical markings under occlusion.

The protocol below is designed for airport AGVS and fleet map maintenance. It turns raw captures into auditable labels, map-patch decisions, and safety-case evidence.

## Ground Truth Layers

| Layer | Label | Include | Exclude |
|---|---|---|---|
| Permanent static | `static_keep` | Fixed infrastructure, fixed signs, terminal edges, approved markings | Aircraft, GSE, temporary objects |
| Static change candidate | `static_change` | New/removed/shifted fixed features pending approval | One-pass occlusion or perception artifacts |
| Movable-static | `movable_static` | Parked aircraft, staged GSE, carts, stairs, cones, barriers | Permanent localization anchors |
| Current dynamic | `dynamic` | Moving vehicles, people, aircraft under tow, wildlife | Base map elements |
| FOD/hazard | `hazard` | Debris, tools, loose material, spills, unsafe objects | Static-map features |
| Artifact | `artifact` | Rain spray, reflections, bad registration, sensor noise | Operational obstacles unless persistent/confirmed |
| Unknown/review | `unknown_review` | Ambiguous clusters or conflicting evidence | Automatic promotion/deletion |

## Capture Plan

| Capture slice | Minimum requirement | Purpose |
|---|---|---|
| Quiet baseline | Low-traffic pass with clear sight lines | Permanent static reference |
| Busy operation | Normal aircraft/GSE activity | Movable-static and dynamic separation |
| Aircraft present/absent | Same stand in both states where possible | Prevent aircraft from entering static map |
| GSE staged/removed | Same route with equipment changes | Movable-static policy labels |
| Day/night | Representative lighting | Detection robustness |
| Wet/dry/weather | Surface condition variation | Marking visibility and artifact control |
| Construction/closure | Work-zone capture with ops record | Temporary restriction and static-change labels |
| FOD drill or inspection record | Controlled objects or verified inspection outcomes | Hazard handling validation |

## Annotation Units

| Unit | Required fields |
|---|---|
| Point/voxel | layer label, source capture, timestamp, pose quality, reviewer ID |
| Object instance | class, bounding geometry, movable flag, current state, persistence |
| Map element | element ID, prior version, new geometry, change type, approval state |
| Tile | map version, capture set, QA status, localization regression result |
| Hazard ticket | object class, location, image/point evidence, response status, clearance time |

## Labeling Workflow

1. Register all captures into the airport ENU map frame and record pose-quality flags.
2. Build a quiet baseline candidate from high-quality passes only.
3. Annotate obvious permanent infrastructure and approved markings as `static_keep`.
4. Annotate aircraft, GSE, workers, carts, cones, and other movable classes as `movable_static` or `dynamic` based on motion/state.
5. Route debris, loose tools, foreign material, and spills to `hazard` even if the static map cleaner would remove them.
6. Compare current captures against the approved prior map and label candidate additions/removals/edits as `static_change`.
7. Require reviewer decision for every safety-critical deletion and every route/topology change.
8. Run localization and route regression on the cleaned candidate map before promoting a tile.

## Reviewer Decision Table

| Evidence pattern | Label | Decision |
|---|---|---|
| Fixed feature visible across independent passes | `static_keep` | Keep/promote |
| Prior feature absent in one view but occluded by aircraft/GSE | `unknown_review` | No deletion |
| Prior marking absent in clear dry multi-view evidence | `static_change` | Review deletion/repaint |
| New barrier appears with active work-zone record | `static_change` or temporary restriction | Add restriction; promote only if permanent |
| New cone line appears without ops record | `movable_static` | Live restriction, expire/review |
| Small debris visible in route | `hazard` | Alert/inspection, not map feature |
| Moving object trail in accumulated map | `dynamic` | Remove from static map |
| Sensor ghost or registration streak | `artifact` | Reject from map and benchmark positives |

## QA Gates

| Gate | Pass condition |
|---|---|
| Sensor calibration | Camera/LiDAR/radar extrinsics current and versioned |
| Pose quality | GNSS/INS/SLAM residuals within map-build threshold |
| Inter-session alignment | Control points and static landmarks agree within tolerance |
| Static preservation | Fixed landmarks retained after cleaning |
| Movable rejection | Aircraft/GSE not present in permanent layer |
| Hazard handling | FOD/hazard labels preserved as alerts |
| Localization regression | No unacceptable scan-to-map residual or relocalization degradation |
| Route regression | No route graph change without approval |
| Audit completeness | Every promoted/deleted element has evidence and reviewer state |

## Dataset Splits

| Split | Content | Rule |
|---|---|---|
| Train | Common stands/routes and routine GSE variation | May include synthetic edits after real-label seed |
| Validation | Held-out stands/routes at same airport | Tune thresholds and reviewer burden |
| Test | Held-out terminal/airport or real operational changes | Final airside transfer evidence |
| Safety cases | FOD, work zones, hold points, aircraft-present edges | Report separately from aggregate metrics |

## Metrics

| Metric | Report by |
|---|---|
| Static preservation rate | feature class, tile, stand |
| Movable-static rejection rate | aircraft, GSE, cones/barriers |
| Hazard retention/alert recall | FOD type, size, surface, lighting/weather |
| False-free-space rate | route segment, stand, safety-critical zone |
| Change precision/recall | insertion, deletion, geometry edit, topology edit |
| Reviewer burden | alerts per stand/km/shift and approval rate |
| Time to decision | capture to quarantine, review, publish, rollback |
| Localization impact | ATE/RPE, scan residual, inlier ratio, relocalization success |

## Sources

- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- FAA AC 150/5210-24A document page: https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5210-24
- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- AIT Apron Dataset: https://publications.ait.ac.at/de/datasets/apron-dataset/
- AIT Apron paper: https://openaccess.thecvf.com/content/ACCV2022W/MLCSA/papers/Steininger_Towards_Scene_Understanding_for_Autonomous_Operations_on_Airport_Aprons_ACCVW_2022_paper.pdf
- Local context: [Movable-Static Layering for Airside Maps](movable-static-layering-airside.md)
- Local context: [Potentially Dynamic Object Map Policy](potentially-dynamic-object-map-policy.md)
- Local context: [Airside Dynamic Map Cleaning Benchmark](../../../60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md)
