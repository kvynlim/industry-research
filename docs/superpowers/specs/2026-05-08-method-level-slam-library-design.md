# Method-Level SLAM Library Design

## Goal

Add a detailed SLAM research library where each major classical, LiDAR, visual, dense, neural, Gaussian, and radar SLAM method earns its own focused Markdown research file.

## Scope

Create the library under `technology/localization/slam/`. The existing broad SLAM documents remain intact and become parent/context references. New files should avoid copying whole sections from the existing docs; they should deepen individual methods and cross-link back to existing localization, GTSAM, map construction, place recognition, and Gaussian mapping documents.

## Structure

Every method file should follow this shape:

1. One-paragraph executive summary.
2. Method family and historical context.
3. Sensor assumptions and inputs.
4. State, map, or scene representation.
5. Algorithm pipeline.
6. Optimization or filtering formulation.
7. Failure modes and degeneracy.
8. Autonomous-vehicle relevance.
9. Indoor/outdoor relevance.
10. Airside deployment notes.
11. Benchmarks, datasets, and evaluation metrics.
12. Open-source implementations.
13. Practical recommendation.
14. Sources.

Top-level files should organize the library:

- `overview.md`
- `av-indoor-outdoor-decision-matrix.md`
- `benchmarking-metrics-datasets.md`
- `open-source-stack-comparison.md`

Method files should be grouped by filename and sidebar order through VitePress' generated directory sidebar.

## File Set

Classical foundations:

- `ekf-slam.md`
- `fastslam-particle-slam.md`
- `graphslam-pose-graph-optimization.md`
- `bundle-adjustment-slam.md`
- `factor-graph-isam2-gtsam.md`
- `loop-closure-place-recognition.md`
- `occupancy-grid-tsdf-esdf-mapping.md`

Point-cloud registration:

- `icp.md`
- `point-to-plane-icp.md`
- `gicp-vgicp.md`
- `ndt.md`
- `continuous-time-registration.md`

3D LiDAR SLAM:

- `loam.md`
- `lego-loam.md`
- `hdl-graph-slam.md`
- `kiss-icp.md`
- `ct-icp.md`
- `lio-sam.md`
- `fast-lio-fast-lio2.md`
- `point-lio.md`
- `cartographer-3d.md`
- `suma.md`

Visual and visual-inertial SLAM:

- `orb-slam2-orb-slam3.md`
- `lsd-slam-dso.md`
- `svo.md`
- `vins-mono-vins-fusion.md`
- `openvins.md`
- `kimera-vio.md`
- `droid-slam.md`
- `dpvo.md`
- `mast3r-slam.md`

Indoor, RGB-D, and dense SLAM:

- `kinectfusion.md`
- `elasticfusion.md`
- `bundlefusion.md`
- `rtab-map.md`
- `imap.md`
- `nice-slam.md`
- `co-slam-eslam.md`
- `nerf-slam.md`

Neural, semantic, Gaussian, and radar SLAM:

- `lo-net-learned-lidar-odometry.md`
- `regformer-learned-registration.md`
- `semantic-slam.md`
- `dynamic-object-aware-slam.md`
- `object-level-slam.md`
- `splatam.md`
- `gs-slam-monogs.md`
- `photo-slam.md`
- `gigaslam.md`
- `wildgs-slam.md`
- `splat-loam.md`
- `radar-odometry-radar-slam.md`
- `radar-inertial-odometry.md`
- `radar-lidar-inertial-fusion.md`

## Quality Bar

Each file must be a research note, not a stub. It should include enough method detail to decide whether the method belongs in an autonomous-vehicle or indoor/outdoor robotics stack. Sources should prefer papers, official project pages, official docs, official GitHub repositories, and benchmark/dataset pages.

No file should end with placeholder text. If a method is mostly historical or not AV-ready, say so directly and explain why.
