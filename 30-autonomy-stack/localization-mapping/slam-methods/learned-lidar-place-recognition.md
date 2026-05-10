# Learned LiDAR Place Recognition

<!-- method-priority:start
priority:
  learning: 5
  deployment: 4
  type: "architecture-pattern"
  stage: "foundation"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "validation"]
  reason: "Learned LiDAR Place Recognition is rated for foundational SLAM modeling, optimization, registration, or mapping concepts."
method-priority:end -->

Related docs: [Scan Context Family](scan-context-family.md), [Loop Closure and Place Recognition](loop-closure-place-recognition.md), [BEV-LIO(LC)](bev-lio-lc.md), [LiDAR map cleaning](lidar-map-cleaning-dynamic-removal.md), and [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md).

**Last updated:** 2026-05-09

## Executive Summary

Learned LiDAR place recognition turns scans or local submaps into descriptors for loop closure, relocalization, and global localization. Representative methods include LCDNet, MinkLoc3D, LoGG3D-Net, and BEVPlace++. They differ in representation, but share the same operational role: produce candidate matches that must be verified before adding graph constraints.

LCDNet jointly detects loop closures and estimates 6-DOF relative transforms. MinkLoc3D uses sparse voxelized point clouds and sparse 3D convolutions for efficient global descriptors. LoGG3D-Net guides local feature repeatability to improve global descriptors. BEVPlace++ projects LiDAR into BEV images, uses lightweight CNNs, and performs place recognition followed by 3-DOF pose estimation.

For AVs and airside vehicles, learned LiDAR place recognition is useful because loop closure and relocalization are central to map maintenance and drift control. The production rule remains strict: descriptor matches are retrieval candidates, not proof of place identity.

## Method Families

| Method | Representation | Output | Practical role |
|---|---|---|---|
| LCDNet | Point-cloud network with shared encoder | Global descriptor plus 6-DOF relative pose | Loop detection and registration candidate |
| MinkLoc3D | Sparse voxelized point cloud with sparse 3D CNN | Global descriptor | Efficient large-scale retrieval |
| LoGG3D-Net | Local features guided by local consistency loss | Repeatable global descriptor | Robust 3D place recognition |
| BEVPlace++ | LiDAR BEV image with CNN, REM/REIN, NetVLAD | Global descriptor plus 3-DOF pose | Lightweight UGV global localization |

## Inputs and Outputs

Inputs:

- Single LiDAR scans or accumulated local submaps.
- Optional intensity, spherical, or BEV projections depending on method.
- Training data with place labels, positives/negatives, or relative pose supervision.

Outputs:

- Compact place descriptor.
- Top-K database candidates.
- Optional yaw, 3-DOF, or 6-DOF relative pose estimate.
- Candidate loop or relocalization measurement for a SLAM backend.

## Core Technical Ideas

LCDNet combines retrieval and registration in one network. A shared encoder feeds a place-recognition head for global descriptors and a relative-pose head based on differentiable unbalanced optimal transport.

MinkLoc3D replaces unordered PointNet-style aggregation with sparse voxelization and sparse 3D convolutions. This gives the descriptor network a better way to capture local geometric structure.

LoGG3D-Net adds a local consistency loss so local features remain repeatable across revisits. More repeatable local features improve the resulting global descriptor.

BEVPlace++ uses image-like BEV projections and lightweight CNNs. It adds rotation equivariant and invariant modules so local features support pose estimation while global descriptors support retrieval.

## Pipeline

1. Select LiDAR keyframes or local submaps.
2. Preprocess the scan into the method representation: voxel grid, raw point set, spherical/range view, or BEV image.
3. Extract a learned global descriptor.
4. Search a descriptor database for top-K candidates.
5. Apply temporal, route, GNSS, map-zone, and heading gates.
6. Estimate relative pose if the method supports it.
7. Run geometric verification with ICP, GICP, NDT, TEASER-style registration, or method-specific registration.
8. Add a loop or relocalization factor to a robust graph only after verification.

## Strengths

- More expressive than simple handcrafted descriptors in many environments.
- Can learn invariances to viewpoint, rotation, season, and sensor patterns when trained well.
- Compact descriptors support fast retrieval and map databases.
- Some methods provide pose initialization, reducing registration burden.
- BEV methods can be lightweight and UGV-friendly.
- Sparse convolution methods are efficient on large point clouds compared with dense grids.

## Failure Modes

- Training-domain bias can be severe across LiDAR models, mounting heights, airports, and seasons.
- Learned descriptors can be overconfident in repeated geometry.
- Dynamic objects can become descriptor features.
- Top-K recall does not measure false graph-factor risk.
- BEV projections can lose vertical discriminative structure.
- Single-scan descriptors may be weak in sparse or open environments.
- Pose heads can fail silently under reverse loops or poor overlap.

## Airside, Indoor, and Outdoor Fit

**Indoor:** Useful in warehouses, terminals, and hangars. Repetitive corridors and symmetric layouts require stronger gates and verification.

**Outdoor:** Strong fit for urban roads, campuses, industrial yards, and service roads with stable 3D structure.

**Airside:** Useful for map relocalization, route replay, multi-session map merging, and loop candidate retrieval. Hard cases include open aprons, repeated gate rows, aircraft movements, temporary cones/barriers, and large metallic surfaces. A production airside stack should combine learned descriptors with Scan Context-style baselines, GNSS/RTK gates, semantic filtering, and robust PGO.

## Implementation Notes

- Evaluate retrieval and backend impact separately.
- Report precision-recall, top-K recall, registration success after retrieval, false-positive loops after all gates, and trajectory improvement.
- Build hard-negative sets from repeated gates, similar stands, parallel service roads, and depot aisles.
- Train or fine-tune on the actual LiDAR model and mounting geometry when possible.
- Remove dynamic objects before descriptor extraction for persistent maps.
- Keep descriptor databases versioned with map tiles and route zones.
- Use descriptor matches to initialize registration, not to bypass it.

## Sources

- Cattaneo, Vaghi, and Valada, "LCDNet: Deep Loop Closure Detection and Point Cloud Registration for LiDAR SLAM." https://arxiv.org/abs/2103.05056
- Komorowski, "MinkLoc3D: Point Cloud Based Large-Scale Place Recognition." https://arxiv.org/abs/2011.04530
- Official MinkLoc3D repository. https://github.com/jac99/MinkLoc3D
- Vidanapathirana et al., "LoGG3D-Net: Locally Guided Global Descriptor Learning for 3D Place Recognition." https://arxiv.org/abs/2109.08336
- Official LoGG3D-Net repository. https://github.com/csiro-robotics/LoGG3D-Net
- Luo et al., "BEVPlace++: Fast, Robust, and Lightweight LiDAR Global Localization for Unmanned Ground Vehicles." https://arxiv.org/abs/2408.01841
- Official BEVPlace repository. https://github.com/zjuluolun/BEVPlace
