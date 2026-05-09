# SceneEdited: 3D HD Map Updating Benchmark

**Last updated:** 2026-05-09

## Why It Matters

SceneEdited moves beyond "detect a map change" and asks whether a method can update a stale 3D point-cloud map using current image evidence. That is the right benchmark shape for autonomy map operations: a stale map is only useful if the system can produce a geometrically consistent replacement or removal proposal.

For airside mapping, this matters because 2D visual discrepancy alone is not enough. A map update must preserve localization landmarks, remove obsolete geometry, add persistent new infrastructure, and avoid turning transient aircraft/GSE into permanent map points.

## Dataset Snapshot

| Item | SceneEdited | Airside relevance |
|---|---|---|
| Task | 3D point-cloud map updating via image-guided change detection | Update stale 3D airport map tiles using current fleet observations |
| Scale | 800+ up-to-date scenes, 73 km driving, about 3 km^2 urban area | Useful city-scale proxy; airport aprons need separate capture |
| Changes | 23,000+ synthesized object changes across 2,000+ outdated versions | Good stress test for additions/removals but not airport-specific operations |
| Objects | Roadside infrastructure, buildings, overpasses, utility poles | Transfers to static infrastructure, not aircraft/GSE/FOD semantics |
| Inputs | Calibrated RGB images, LiDAR scans, change masks | Similar multi-sensor ingredients to fleet map QA |
| Toolkit | ScenePoint-ETK for editing and dataset construction | Template for reproducible stale/current map generation |
| Venue | WACV 2026 accepted paper | Recent benchmark; maturity should be checked before operational reuse |

## Benchmark Framing

| Stage | SceneEdited framing | Airside equivalent |
|---|---|---|
| Up-to-date map | Current static point-cloud scene | Approved current airport localization tile |
| Outdated map | Edited stale point-cloud scene | Previous tile or deliberately staled benchmark tile |
| Current evidence | Geo-referenced RGB images and LiDAR | Vehicle camera/LiDAR/radar logs with pose quality |
| Change mask | Image/3D change annotations | Pixel, point, and map-element labels for changed regions |
| Update output | Revised 3D point cloud | Candidate tile diff with additions/removals |
| Evaluation | Geometry fidelity after update | Localization impact, static preservation, hazard policy, reviewer burden |

## Practical Metrics

| Metric family | What it measures | Airside addition |
|---|---|---|
| Chamfer distance | Average bidirectional point error | Report near docking landmarks and stand markings separately |
| Hausdorff distance | Worst-case geometric deviation | Use to catch protrusions into safety envelopes |
| Modified Hausdorff / median point distance | Robust error summaries | Use for noisy LiDAR and wet-surface artifacts |
| Addition accuracy | Quality of newly reconstructed geometry | Require persistence before static-map promotion |
| Deletion accuracy | Quality of removed obsolete geometry | Require occlusion checks and human review near safety-critical features |
| Static preservation | Damage to unchanged map points | Must be part of airside acceptance even if not the headline metric |
| Localization regression | Pose residual before/after update | Required before publishing any map tile |

## Airside Use Cases

| Use case | How SceneEdited helps | Missing airport evidence |
|---|---|---|
| Construction barrier update | Tests object removal/addition in 3D | Airport barrier classes, cones, closures, NOTAM links |
| New fixed equipment installation | Tests insertion into stale 3D map | Sponsor-approved permanence and asset IDs |
| Removed fixed object | Tests deletion from old map | Multi-pass absence and occlusion reasoning |
| Repainted stand route | Needs image-guided change mask | Surface marking semantics, not just object geometry |
| Aircraft/GSE present | Should not become static map geometry | Movable-static layer policy and object taxonomy |
| FOD detection | Should remain a live hazard alert | Small-object labeling and inspection protocol |

## Implementation Guidance

1. Use SceneEdited as a benchmark pattern for "update the map," not only "detect a mismatch."
2. Reproduce the stale/current/update split for airport tiles: previous approved map, current evidence, and verified target map.
3. Separate added and deleted regions in evaluation. A method that deletes well but adds poorly is useful for map cleanup, not full maintenance.
4. Add airside-specific static-preservation metrics near terminal edges, blast fences, docking templates, stop bars, and stand lead-in lines.
5. Require map hygiene labels before training: permanent static, movable-static, current dynamic, FOD/hazard, artifact, and unknown/review.
6. Do not use image-only update quality as an operational gate. Airport deployment needs LiDAR/geodetic alignment and localization regression.
7. Treat synthetic edits as coverage generation; reserve real operational changes for final acceptance.

## Source Caveats for Use

| Caveat | Impact |
|---|---|
| SceneEdited changes are synthesized | Good for controlled benchmarking; final airport acceptance needs real change captures |
| Urban objects differ from apron objects | Airport-specific taxonomy and sensors are required |
| Project page/repo were under active update when checked | Pin dataset/toolkit versions for reproducible experiments |
| Benchmark focuses on 3D geometry | Does not by itself define regulatory, FOD, or route-closure map policy |

## Sources

- SceneEdited arXiv abstract: https://arxiv.org/abs/2511.15153
- SceneEdited project page: https://chadlin9596.github.io/ScenePoint-ETK/
- ScenePoint-ETK repository: https://github.com/ChadLin9596/ScenePoint-ETK
- WACV 2026 paper page/PDF: https://openaccess.thecvf.com/content/WACV2026/papers/Lin_SceneEdited_A_City-Scale_Benchmark_for_3D_HD_Map_Updating_via_WACV_2026_paper.pdf
- Argoverse 2 overview: https://www.argoverse.org/av2.html
- Local context: [Moved-Object and Map-Change Datasets](moved-object-and-map-change-datasets.md)
- Local context: [Airside Dynamic Map Cleaning Benchmark](../../../60-safety-validation/verification-validation/airside-dynamic-map-cleaning-benchmark.md)
