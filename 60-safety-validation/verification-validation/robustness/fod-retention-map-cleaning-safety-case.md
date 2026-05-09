# FOD Retention Map-Cleaning Safety Case

**Last updated:** 2026-05-09

Airside map cleaning must not turn "small, transient, and low to the ground" into "safe to delete." Foreign object debris (FOD) is often exactly that: small, temporary, sparse in LiDAR, and safety critical. A static-map cleaner may remove FOD from the permanent localization map, but it must retain the evidence as a current hazard, alert, or review item.

## Safety Claim

Within the validated ODD, the map-cleaning pipeline does not silently erase hazardous FOD-like objects from the operational evidence chain. FOD candidates are either retained in a hazard/review layer, routed to perception/FOD workflow, or explicitly dispositioned by a reviewer.

This claim does not prove the airport is free of FOD. It proves that the cleaning pipeline does not hide FOD evidence it observed.

## Evidence Model

| Evidence item | Minimum content | Why it matters |
|---|---|---|
| Raw sensor evidence | synchronized camera, LiDAR, radar if available, ego pose, calibration, timestamps | supports missed-detection and false-deletion investigation |
| FOD label | object type, size, material, location, confidence, source frame, OpenLABEL ID | distinguishes debris from normal static features |
| Cleaner decision | kept, removed, restored, uncertain, or hazard-layer export | proves FOD was not silently discarded |
| Response link | operator alert, inspection ticket, maintenance closure, or reviewer waiver | connects map hygiene to FOD management |
| Release trace | map tile, route, stand, version, cleaner config, threshold set | supports regression and incident review |

## Hazard Matrix

| Failure | Cause | Consequence | Required mitigation |
|---|---|---|---|
| FOD deleted as noise | low height, few points, intensity outlier | false clear in operational corridor | retain rejected low-object candidates for FOD review |
| FOD treated as dynamic clutter | appears in one session only | hazard absent from current-world layer | separate permanent-map deletion from current-hazard reporting |
| FOD hidden by movable-static object | cone, chock, hose, cart, shadow, aircraft gear | missed small object near aircraft | close-range slices and hard-negative/positive pairs |
| FOD merged into ground | wet pavement, low contrast, sparse LiDAR | no alert and no reviewer evidence | camera/radar cross-check and minimum-size validation |
| Reviewer overload | too many nuisance candidates | alerts ignored or bulk-approved | severity tiers, corridor filters, and sampling audits |
| Dataset transfer gap | FOD-A image evidence used for 3D map claim | unsupported map-cleaning acceptance | target-airport placed-object tests |

## Test Matrix

| Test slice | Objects | Required result |
|---|---|---|
| Minimum-size placed FOD | metal bolt, rubber, plastic, fabric strap, luggage fragment | candidate is detected or appears in rejected evidence with review tag |
| Low contrast | black rubber on wet asphalt, gray metal on concrete | no silent deletion; confidence recorded |
| Reflective and transparent | foil, polished metal, plastic wrap | retained as unknown/hazard if classification uncertain |
| Near legitimate equipment | chock, cone, barrier foot, tow bar, hose | FOD candidate is not merged into the asset |
| High-clutter stand | aircraft present, carts staged, workers nearby | map cleaner separates permanent deletion from current hazard |
| Hard negative | paint chips, cracks, markings, rubber deposits, drains | false alarm rate reported without relaxing FOD retention |

## Metrics And Gates

| Metric | Gate |
|---|---|
| Hazardous-FOD false deletion rate | zero unresolved false deletions in approved test corridor |
| FOD evidence retention | all placed FOD has raw, rejected, kept, or alert evidence trace |
| Ground-plane localization error | within recovery/inspection tolerance for the site workflow |
| Alert latency | within stop, avoid, or operator-review timing budget |
| False alarm burden | below operational limit without suppressing hazardous candidates |
| Unknown disposition time | within map-publication SLA or tile remains quarantined |

## Safety Case Pattern

| Claim element | Practical evidence |
|---|---|
| FOD is treated as a safety hazard | FAA FOD definition, airport FOD program interface, hazard taxonomy |
| Cleaning preserves hazard evidence | rejected-layer audit, OpenLABEL IDs, reviewer disposition |
| Small-object limits are known | FOD-A screening plus target-airport placed-object campaign |
| Operations can act on retained evidence | alert route, inspection ticket, closure status, replayable logs |
| Residual risk is bounded | unresolved classes, minimum detectable size, weather and lighting limits |

## Release Checklist

1. Lock FOD object definitions, corridor limits, and minimum hazardous size before acceptance runs.
2. Preserve raw and rejected points for all low-height candidate objects.
3. Report FOD retention separately from dynamic rejection and static preservation.
4. Run target-airport hard negatives before lowering alert thresholds.
5. Require human disposition for any FOD-like object removed from the candidate static map.
6. Attach FOD evidence to the map release or quarantine the affected tile.

## Sources

- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- FAA AC 150/5210-24A, Airport FOD Management: https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5210-24
- FAA AC 150/5220-24, FOD Detection Equipment: https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentNumber/150_5220-24
- FAA automated FOD detection system evaluation: https://www.airporttech.tc.faa.gov/Airport-Safety/Airport-Design-Technology/Automated-Foreign-Object-Debris-FOD-Detection-System-Evaluation
- FOD-A paper: https://arxiv.org/abs/2110.03072
- FOD-A repository: https://github.com/FOD-UNOmaha/FOD-data
- ASAM OpenLABEL: https://www.asam.net/standards/detail/openlabel/
- Local context: fod-perception-validation.md
