# Airside Map Hygiene Ground Truth Protocol

**Last updated:** 2026-05-09

Map hygiene validation needs ground truth that separates permanent static structure, movable-static assets, current dynamic actors, FOD/hazards, artifacts, and unknown space. Without that separation, a benchmark can reward a cleaner for deleting the very evidence needed for safety review.

## Ground Truth Goals

| Goal | Practical requirement |
|---|---|
| Measure false deletion | labels cover static assets and FOD-like hazards, not only moving actors |
| Measure ghost retention | dynamic and transient traces are labeled in accumulated maps |
| Support release review | labels are linked to map tile, route, stand, source frames, and reviewer |
| Support auditability | raw evidence and rejected/kept decisions can be traced after publication |
| Support transfer analysis | public benchmark classes map to airside-specific classes |

## Label Taxonomy

| Label | Definition | Examples | Map use |
|---|---|---|---|
| permanent_static | approved, persistent site structure | terminal edge, pole, curb, fixed cabinet, stand paint | retain |
| safety_static | static feature tied to rules or margins | stop bar, service-road edge, restricted area | retain and validate semantically |
| movable_static | stationary now but not permanent | cone, chock, barrier, parked GSE, cart | overlay or review |
| dynamic_actor | moving during capture or operationally transient | aircraft, tug, bus, worker, vehicle | remove from permanent map |
| fod_hazard | debris or small unsafe object | bolt, strap, rubber, plastic, tool | hazard/review layer |
| artifact | sensor or registration artifact | multipath, rain/spray, ghost, packet issue | remove or mark diagnostic |
| unknown | insufficient evidence | occluded, sparse, ambiguous, unobserved | quarantine or review |

## Capture Plan

| Capture | Purpose | Minimum slices |
|---|---|---|
| quiet survey | high-confidence static reference | low traffic, slow pass, full route/stand coverage |
| busy operation | dynamic and movable-static clutter | aircraft present, GSE staged, personnel/vehicles nearby |
| change pair | distinguish moved assets from permanent structure | object present and absent across sessions |
| FOD placement | small-hazard retention | controlled articles by size/material/location |
| sparse/degraded | weak-observation evidence | range bins, beam dropout, night/wet if in ODD |
| hard negative | false alert and false deletion control | markings, cracks, drains, rubber deposits, shadows |

## Annotation Requirements

| Field | Requirement |
|---|---|
| object_id | stable ID across frames, map layers, and review exports |
| label_class | one taxonomy class plus optional subclass |
| geometry | 3D cuboid, polygon, point cluster, semantic mask, or map cell set |
| coordinate_system | map frame plus sensor frame transforms where labels originate |
| temporal_extent | first/last observation, session ID, permanence evidence |
| source_evidence | raw frame IDs, image crops, LiDAR cluster IDs, reviewer notes |
| confidence | label confidence and reason for unknown/review |
| disposition | retain, remove, overlay, hazard alert, quarantine, or ignore |

ASAM OpenLABEL is a good exchange format because it supports multi-sensor labels, coordinate systems, object annotations, scenario tags, and extensible taxonomies. Use an airport-specific ontology for classes that public road datasets do not cover.

## QA And Split Rules

| Rule | Rationale |
|---|---|
| Double-label safety-critical static assets and FOD. | false deletion claims need high label quality |
| Keep acceptance zones separate from tuning zones. | prevents threshold overfit |
| Label unknown explicitly. | unobserved space must not become assumed free space |
| Preserve reviewer disagreement. | disagreement identifies taxonomy or evidence gaps |
| Include site-specific hard negatives. | public datasets miss local pavement, lighting, and equipment |
| Version labels with map and cleaner releases. | changing ground truth changes acceptance history |

## Acceptance Outputs

| Output | Consumer |
|---|---|
| labeled static and dynamic point sets | map-cleaning metric pipeline |
| FOD/hazard ground truth | safety case and FOD workflow |
| movable-static inventory | map operations lifecycle |
| unknown/quarantine polygons | publication gate |
| annotation manifest | audit, replay, and regression |
| benchmark split manifest | repeatable release testing |

## Sources

- ASAM OpenLABEL: https://www.asam.net/standards/detail/openlabel/
- FOD-A paper: https://arxiv.org/abs/2110.03072
- FOD-A repository: https://github.com/FOD-UNOmaha/FOD-data
- AIT Apron Dataset: https://publications.ait.ac.at/de/datasets/apron-dataset/
- AIT Apron repository: https://github.com/apronai/apron-dataset
- KTH Dynamic Map Benchmark: https://kth-rpl.github.io/DynamicMap_Benchmark/
- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- Local context: airside-dynamic-map-cleaning-benchmark.md
