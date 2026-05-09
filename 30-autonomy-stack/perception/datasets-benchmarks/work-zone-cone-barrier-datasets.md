# Work-Zone Cone and Barrier Datasets

**Last updated:** 2026-05-09

## Why It Matters

Temporary traffic-control objects are not just small-object detection targets. Cones, barrels, barricades, barriers, arrow boards, work vehicles, and workers can redefine drivable space, invalidate lane priors, and force temporary map policy changes.

For airside autonomy, the analogous objects are cones, low barriers, chocks, mobile signs, tow bars, staged carts, and temporary closed-area markings. Public roadwork datasets are useful for visual long-tail coverage, but they do not replace apron-specific labels.

## Dataset/Benchmark Table

| Dataset / source | Primary task | Sensors / format | Useful labels | Best use | Main transfer risk |
|---|---|---|---|---|---|
| ROADWork | Work-zone recognition, observation, scene description, and path prediction | Vehicle-mounted images and video snippets from 18 U.S. cities; COCO-like instance data and pathway data in the public code release | Work-zone object instances, scene tags, sign/arrow-board attributes, descriptions, road/sidewalk semantic context, 2D/3D traversable paths | Train and evaluate detectors for cones, drums, barricades, barriers, TTC signs, workers, work vehicles, and scene-level work-zone state | Camera-only road scenes; counts differ between paper and repository releases; no LiDAR/radar or airport object taxonomy |
| ROADWork discovered subset | Work-zone mining from large driving-image corpora | Images mined from BDD100K and Mapillary by ROADWork detector rules | Discovered roadwork images for auxiliary evaluation | Test geographic generalization and open-world work-zone discovery | External images inherit source dataset licenses and may not include the full ROADWork annotation stack |
| RoSA | Road construction-zone instance segmentation | FHD dashcam video frames from Korean roads, reconstructed into image sequences | Area-level construction-zone masks based on cones/barrels and lane geometry | Detect the whole closed or restricted zone rather than only sparse cones or barrels | Focuses on image-space zone masks; paper says a subset will be released and reported frame/split counts need release verification |
| Existing generic driving datasets | Proxy cone/sign appearance and negative examples | Mostly camera, sometimes LiDAR depending on dataset | Sparse cone, sign, lane, vehicle, and pedestrian labels | Pretraining, hard-negative mining, and regression tests | Work-zone-specific barriers, arrow boards, flaggers, and temporary traffic rules are under-labeled |

## ROADWork Practical Notes

| Field | What to capture in an internal benchmark |
|---|---|
| Object vocabulary | Preserve ROADWork-style categories for cones, tubular markers, drums, barricades, barriers, vertical panels, fences, arrow boards, TTC signs, message boards, workers, work vehicles, police actors, and other roadwork objects. |
| Scene state | Label whether temporary objects imply an active work zone, a staged inactive zone, or a stray object that should not alter routing. |
| Sign attributes | Keep text and graphic labels separate; use crop-rescale or text-spotting checks when the sign is small. |
| Pathway target | Store both object masks and a passable path or route decision so the model is not optimized only for pretty segmentation. |
| Geographic split | Split by city, airport terminal area, or stand group to expose local cone/barrier designs and deployment habits. |

ROADWork is the stronger source for object taxonomy and multimodal scene reasoning. It includes rare categories that open-vocabulary models detect poorly and supports downstream work-zone discovery, sign reading, description, and path prediction.

## RoSA Practical Notes

| Field | What to capture in an internal benchmark |
|---|---|
| Label unit | Label a continuous construction area, not every cone as a separate planning primitive. |
| Temporal continuity | Carry zone labels through partial occlusion when the previous frames establish the area boundary. |
| Boundary priority | Measure the nearest boundary relative to the ego vehicle, because that boundary controls immediate lane availability. |
| Object exclusion | Keep the zone ground mask consistent instead of including irregular above-ground vehicles or workers in the same polygon. |
| Model baseline | RoSA reports YOLOv8 segmentation baselines; use them only as a sanity check, not a final autonomy policy. |

RoSA is the better proxy when the operational question is "where is the temporary closed zone?" instead of "which objects are visible?" This maps well to lane closure, stand closure, and temporary exclusion-zone detection.

## Metrics

| Metric | What to report | Why it matters |
|---|---|---|
| Instance AP / mask AP | Per-class AP for cones, barrels, barricades, barriers, signs, workers, and vehicles | Rare work-zone classes are easily hidden by aggregate AP |
| Area IoU | IoU of the construction or exclusion-zone polygon | Planning needs the restricted area, not just object centers |
| Nearest-boundary error | Lateral and longitudinal error of the closest closed-zone edge | A small mask error near the vehicle can create an unsafe path |
| Active-zone precision/recall | Whether a scene truly changes road or apron rules | A cone in storage should not trigger rerouting |
| Sign reading quality | Text/graphic recognition accuracy or normalized edit distance | Arrow boards and TTC signs can reverse the route decision |
| Cross-site performance | Hold out cities, terminals, contractors, or stand groups | Temporary equipment is highly regional and operator-specific |

## Airside Transfer

| Roadwork concept | Airside analog | Transfer use | Required local validation |
|---|---|---|---|
| Cone / barrel line | Cone row, stand closure markers, tow-route markers | Temporary boundary detection and continuity | Cone color, height, spacing, night reflectivity, and occlusion by aircraft/GSE |
| Barrier / barricade | Temporary safety barrier, maintenance cordon | Closed-area segmentation | Low-profile barriers and non-road layouts on open apron concrete |
| Arrow board / TTC sign | Mobile sign, marshaller signal board, stand-closure board | Attribute-aware rule changes | Airport-specific sign vocabulary and procedures |
| Worker / police officer | Ground crew, marshaller, safety escort | Human actor context near temporary zones | PPE, crouched workers, wing/gear occlusion, and low-light operations |
| Work vehicle | Maintenance truck, tug, belt loader, sweeper | Context for temporary work state | GSE geometry and parked-vs-active status |

## Validation Guidance

1. Use ROADWork first for object vocabulary and rare-category robustness; use RoSA-style labels for the contiguous restricted-area mask.
2. Build local splits by terminal, contractor, route, and time of day. Random frame splits will overstate generalization.
3. Evaluate object detection and zone segmentation separately. Missing a cone and misplacing a closed-zone edge are different failures.
4. Preserve sign/arrow-board text and graphic attributes as structured labels instead of compressing them into one sign class.
5. Add negative controls: stored cones, equipment yards, parked work trucks, and barriers outside the active route.
6. For map cleaning, do not let a temporary cone/barrier observation update the permanent static map without multi-session evidence or review.

## Sources

- ROADWork project page: https://www.cs.cmu.edu/~ILIM/roadwork_dataset/
- ROADWork arXiv: https://arxiv.org/abs/2406.07661
- ROADWork repository and data notes: https://github.com/anuragxel/roadwork-dataset
- RoSA OpenReview page: https://openreview.net/forum?id=ygF6aFhdxC
- RoSA PDF: https://openreview.net/pdf?id=ygF6aFhdxC
- Local context: `30-autonomy-stack/perception/datasets-benchmarks/moving-static-separation-mos-datasets.md`
- Local context: `60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md`
