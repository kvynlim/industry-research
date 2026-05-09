# Airside Dynamic Map Cleaning Benchmark

**Last updated:** 2026-05-09

## Why It Matters

Airside dynamic map cleaning is a safety validation problem, not only a perception benchmark. A cleaned map can affect localization, route availability, obstacle expectations, and safety-case evidence for Autonomous Ground Vehicle Systems (AGVS). The validation set must therefore combine map-cleaning metrics with airside hazards such as FOD, ground crew, aircraft, baggage carts, tugs, temporary barriers, and apron lighting/weather.

FAA material makes the operating context explicit: FOD is a continuing airport safety concern, AGVS include FOD detection/retrieval and airside service vehicles, and AGVS testing must be coordinated and controlled before moving toward autonomy without human supervision.

## Dataset/Benchmark Table

| Source / benchmark input | Source URL | What it provides | How to use in an airside map-cleaning benchmark | Limitation |
|---|---|---|---|---|
| FAA Foreign Object Debris Program | https://www.faa.gov/airports/airport_safety/fod | Authoritative FOD safety definition and references to FOD management and detection equipment advisory circulars | Define hazard taxonomy, object-size/material classes, inspection expectations, and false-free-space severity | Not an ML dataset; use as safety and acceptance guidance |
| FAA automated FOD detection system evaluation | https://www.airporttech.tc.faa.gov/Airport-Safety-OLD/Airport-Safety-and-Surveillance-Sensors/Automated-Foreign-Object-Debris-FOD-Detection-System-Evaluation | Historical FAA evaluation context for radar/electro-optical FOD detection systems | Borrow detection-probability, false-alarm, response-time, and operational-coverage thinking for autonomy perception | Focused on FOD systems, not dynamic map cleaning |
| FOD-A | https://github.com/FOD-UNOmaha/FOD-data | Airport runway/taxiway FOD images with bounding boxes plus light-level and weather annotations | Validate FOD visual detection and negative controls for map cleaning around small objects | Camera image dataset; no 3D map labels, localization, or LiDAR occupancy |
| AIT Apron Dataset | https://publications.ait.ac.at/de/datasets/apron-dataset/ | Airport-apron logistics image dataset with bounding boxes, object categories, and environmental meta-parameters | Build airside object taxonomy and detection robustness slices for GSE/personnel/apron objects | Image-focused; does not provide dynamic 3D map ground truth |
| FAA AGVS on Airports | https://www.faa.gov/airports/new_entrants/agvs_on_airports | Current FAA AGVS context, applications, contacts, and published information, including Bulletin 25-02 and CertAlert 24-02 | Define regulatory validation envelope, test-plan evidence, and controlled-environment constraints | Does not define technical perception metrics |
| FAA Emerging Entrants Bulletin 25-02 | https://www.faa.gov/airports/new_entrants/bulletins/25_02 | Guidance for testing/demonstrating AGVS, including human monitor, control capability, route/test plan, RF/aeronautical-study considerations | Convert benchmark runs into safety-case evidence with test plans, roles, mitigations, and human takeover assumptions | Guidance is operational/regulatory, not a benchmark dataset |

## Metrics

| Metric | Definition | Airside acceptance use |
|---|---|---|
| Dynamic rejection rate | Fraction of dynamic/transient LiDAR or map points removed from the static map layer | Prevent aircraft, GSE, and people from becoming localization map ghosts |
| Static preservation rate | Fraction of valid static infrastructure retained | Protect stand geometry, terminal edges, poles, markings, curbs, and docking features used by localization |
| FOD retention / alert rate | Fraction of FOD-like objects preserved as current hazards or surfaced as alerts rather than cleaned away as noise | Do not let map cleaning erase small safety-critical debris |
| Movable-static classification accuracy | Correctly classify parked aircraft/GSE, temporary barriers, cones, chocks, and staged carts as movable-static or review-required | Avoid promoting temporary objects into the permanent map |
| False-free-space rate | Rate at which cleaned maps or occupancy outputs imply free space where a hazard exists | Core safety metric for planner and safety-case review |
| Ghost rate per stand | Remaining transient dynamic points per stand, gate, route segment, or 100 m | Practical map QA metric for apron operations |
| Localization delta | ATE/RPE, scan-to-map residual, inlier ratio, degeneracy, and relocalization success before and after cleaning | Cleaning must not reduce localization integrity |
| Reviewer burden | Alerts or manual QA minutes per stand/km and percentage accepted by reviewers | Ensures the fleet map workflow can scale |
| Operational latency | Time from capture to quarantine/update decision and time to publish a safe map package | Supports controlled AGVS test plans and map-change response |

## Airside/Indoor/Outdoor Transfer

| Proxy data | What it can teach | What must be collected airside |
|---|---|---|
| FOD-A | FOD object categories, image detection under light and weather tags | 3D LiDAR/camera/radar FOD labels on actual apron concrete and taxiway surfaces |
| AIT Apron | Airport-apron object taxonomy and environmental slices | Full sensor-suite logs, calibrated LiDAR/camera/radar, ego poses, and map-layer labels |
| KTH/SemanticKITTI-derived map-cleaning benchmarks | PR/RR style map-cleaning metrics and reproducible cleaner comparisons | Aircraft-present/absent route pairs, GSE staging changes, stand-closure changes, wet/night/de-icing captures |
| Indoor moved-object datasets | Added/removed/moved object logic and object persistence | Outdoor geodetic alignment, GNSS/INS failure zones, and aircraft-scale occlusion |
| FAA AGVS guidance | Controlled test envelope, human monitor, test-plan evidence, safety responsibilities | Technical pass/fail thresholds agreed with airport sponsor and safety authority |

## Validation Guidance

1. Define map layers before testing: permanent static, movable-static, current dynamic, FOD/hazard, artifact, and unknown/review.
2. Build paired captures for each stand: quiet survey, busy operation, aircraft present, aircraft absent, GSE staged, GSE removed, wet/dry, day/night, and representative weather.
3. Run at least two independent cleaners and compare disagreement. Candidate baselines should include ERASOR, Removert, MapCleaner, and a MOS-pre-filtered variant.
4. Preserve FOD and small hazards as current-world alerts even if they should not enter the permanent static map.
5. Tie every benchmark run to a safety-case artifact: route, ODD, participants, human monitor assumption, takeover path, sensor configuration, RF status if relevant, and map version.
6. Quarantine changed map tiles until cross-session evidence or human review confirms update, removal, or temporary override.
7. Set stricter thresholds near aircraft movement, pedestrian zones, docking areas, and blind-corner service roads than in open apron transit zones.

## Sources

- FAA Foreign Object Debris Program: https://www.faa.gov/airports/airport_safety/fod
- FAA AC 150/5210-24, Airport Foreign Object Debris Management: https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5210_24.pdf
- FAA automated FOD detection system evaluation: https://www.airporttech.tc.faa.gov/Airport-Safety-OLD/Airport-Safety-and-Surveillance-Sensors/Automated-Foreign-Object-Debris-FOD-Detection-System-Evaluation
- FOD-A repository: https://github.com/FOD-UNOmaha/FOD-data
- FOD-A paper: https://arxiv.org/abs/2110.03072
- AIT Apron Dataset: https://publications.ait.ac.at/de/datasets/apron-dataset/
- AIT Apron repository: https://github.com/apronai/apron-dataset
- FAA AGVS on Airports: https://www.faa.gov/airports/new_entrants/agvs_on_airports
- FAA Emerging Entrants Bulletin 25-02: https://www.faa.gov/airports/new_entrants/bulletins/25_02
- FAA Part 139 CertAlert 24-02: https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02
