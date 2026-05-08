# Method-Level SLAM Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a method-level SLAM research library under `technology/localization/slam/`, with one focused research file per major method or method family.

**Architecture:** The library is pure Markdown and uses the existing VitePress generated navigation. Writers create disjoint files under `technology/localization/slam/`; the controller then updates public entry points and verifies the site build.

**Tech Stack:** Markdown, VitePress, Node test runner, existing navigation generator.

---

## Shared Writing Template

Every method file must include:

1. Executive summary.
2. Method family and historical context.
3. Sensor assumptions and inputs.
4. State, map, or scene representation.
5. Algorithm pipeline.
6. Optimization, filtering, or learning formulation.
7. Failure modes and degeneracy.
8. Autonomous-vehicle relevance.
9. Indoor/outdoor relevance.
10. Airside deployment notes.
11. Benchmarks, datasets, and metrics.
12. Open-source implementations.
13. Practical recommendation.
14. Sources.

Each top-level organizing file must include explicit cross-links to method files and existing repository docs.

## Worker Assignments

### Task 1: Top-Level SLAM Library Files

**Files:**
- Create: `technology/localization/slam/overview.md`
- Create: `technology/localization/slam/av-indoor-outdoor-decision-matrix.md`
- Create: `technology/localization/slam/benchmarking-metrics-datasets.md`
- Create: `technology/localization/slam/open-source-stack-comparison.md`

- [ ] Write the four files using the shared template where applicable.
- [ ] Cross-link to existing docs: `technology/localization/lidar-slam-algorithms.md`, `technology/localization/production-lidar-map-localization.md`, `technology/localization/lidar-place-recognition-relocalization.md`, `technology/localization/map-construction-pipeline.md`, `technology/localization/robust-state-estimation-multi-sensor.md`, `technology/perception/gaussian-splatting-driving.md`, and `foundations/gtsam-factor-graphs.md`.
- [ ] Include a source section with primary dataset, benchmark, paper, and official project links.

### Task 2: Classical Foundations

**Files:**
- Create: `technology/localization/slam/ekf-slam.md`
- Create: `technology/localization/slam/fastslam-particle-slam.md`
- Create: `technology/localization/slam/graphslam-pose-graph-optimization.md`
- Create: `technology/localization/slam/bundle-adjustment-slam.md`
- Create: `technology/localization/slam/factor-graph-isam2-gtsam.md`
- Create: `technology/localization/slam/loop-closure-place-recognition.md`
- Create: `technology/localization/slam/occupancy-grid-tsdf-esdf-mapping.md`

- [ ] Write each file as a standalone research note.
- [ ] Clearly distinguish historical value from current AV production value.
- [ ] Cross-link to existing GTSAM, place recognition, map construction, occupancy mapping, and robust state estimation docs.

### Task 3: Point Cloud Registration

**Files:**
- Create: `technology/localization/slam/icp.md`
- Create: `technology/localization/slam/point-to-plane-icp.md`
- Create: `technology/localization/slam/gicp-vgicp.md`
- Create: `technology/localization/slam/ndt.md`
- Create: `technology/localization/slam/continuous-time-registration.md`

- [ ] Write each file with equations or pseudo-equations for the registration objective.
- [ ] Explain convergence basin, initialization, degeneracy, runtime cost, and AV deployment role.
- [ ] Cross-link to `production-lidar-map-localization.md` and `lidar-slam-algorithms.md`.

### Task 4: 3D LiDAR SLAM Part A

**Files:**
- Create: `technology/localization/slam/loam.md`
- Create: `technology/localization/slam/lego-loam.md`
- Create: `technology/localization/slam/hdl-graph-slam.md`
- Create: `technology/localization/slam/kiss-icp.md`
- Create: `technology/localization/slam/ct-icp.md`

- [ ] Write one method-level file per method.
- [ ] Compare assumptions about LiDAR type, motion distortion, maps, loop closure, and GNSS/IMU usage.
- [ ] Cross-link to existing LiDAR SLAM and production scan-to-map docs.

### Task 5: 3D LiDAR SLAM Part B

**Files:**
- Create: `technology/localization/slam/lio-sam.md`
- Create: `technology/localization/slam/fast-lio-fast-lio2.md`
- Create: `technology/localization/slam/point-lio.md`
- Create: `technology/localization/slam/cartographer-3d.md`
- Create: `technology/localization/slam/suma.md`

- [ ] Write one method-level file per method.
- [ ] Emphasize LiDAR-inertial coupling, factor graph versus filtering, surfel maps, and production limitations.
- [ ] Cross-link to existing LiDAR SLAM, GTSAM, and state estimation docs.

### Task 6: Visual and Visual-Inertial SLAM Part A

**Files:**
- Create: `technology/localization/slam/orb-slam2-orb-slam3.md`
- Create: `technology/localization/slam/lsd-slam-dso.md`
- Create: `technology/localization/slam/svo.md`
- Create: `technology/localization/slam/vins-mono-vins-fusion.md`
- Create: `technology/localization/slam/openvins.md`

- [ ] Write one method-level file per method family.
- [ ] Explain feature-based, direct, semi-direct, and visual-inertial formulation differences.
- [ ] Call out indoor/outdoor and AV limits.

### Task 7: Visual and Visual-Inertial SLAM Part B

**Files:**
- Create: `technology/localization/slam/kimera-vio.md`
- Create: `technology/localization/slam/droid-slam.md`
- Create: `technology/localization/slam/dpvo.md`
- Create: `technology/localization/slam/mast3r-slam.md`

- [ ] Write one method-level file per method.
- [ ] Explain learned dense BA / priors where relevant.
- [ ] Include current readiness and compute constraints.

### Task 8: Indoor, RGB-D, and Neural Implicit SLAM

**Files:**
- Create: `technology/localization/slam/kinectfusion.md`
- Create: `technology/localization/slam/elasticfusion.md`
- Create: `technology/localization/slam/bundlefusion.md`
- Create: `technology/localization/slam/rtab-map.md`
- Create: `technology/localization/slam/imap.md`
- Create: `technology/localization/slam/nice-slam.md`
- Create: `technology/localization/slam/co-slam-eslam.md`
- Create: `technology/localization/slam/nerf-slam.md`

- [ ] Write one method-level file per method or tightly related pair.
- [ ] Explicitly describe indoor value and outdoor/AV transfer limits.
- [ ] Cross-link to Gaussian mapping and simulation/digital-twin docs where relevant.

### Task 9: Learned, Semantic, and Gaussian SLAM

**Files:**
- Create: `technology/localization/slam/lo-net-learned-lidar-odometry.md`
- Create: `technology/localization/slam/regformer-learned-registration.md`
- Create: `technology/localization/slam/semantic-slam.md`
- Create: `technology/localization/slam/dynamic-object-aware-slam.md`
- Create: `technology/localization/slam/object-level-slam.md`
- Create: `technology/localization/slam/splatam.md`
- Create: `technology/localization/slam/gs-slam-monogs.md`
- Create: `technology/localization/slam/photo-slam.md`

- [ ] Write one method-level file per method or concept.
- [ ] State which techniques are usable as production aids versus research-stage primary localization.
- [ ] Cross-link to `technology/perception/gaussian-splatting-driving.md`.

### Task 10: Outdoor Gaussian and Radar SLAM

**Files:**
- Create: `technology/localization/slam/gigaslam.md`
- Create: `technology/localization/slam/wildgs-slam.md`
- Create: `technology/localization/slam/splat-loam.md`
- Create: `technology/localization/slam/radar-odometry-radar-slam.md`
- Create: `technology/localization/slam/radar-inertial-odometry.md`
- Create: `technology/localization/slam/radar-lidar-inertial-fusion.md`

- [ ] Write one method-level file per method or method family.
- [ ] Emphasize outdoor scale, dynamic scenes, adverse weather, radar observability, and AV deployment readiness.
- [ ] Use primary sources for 2025+ Gaussian SLAM methods.

### Task 11: Entry Point Updates

**Files:**
- Modify: `README.md`
- Modify: `INDEX.md`

- [ ] Add the new SLAM library to the README high-leverage reading paths or corpus map.
- [ ] Add a SLAM section to `INDEX.md` with links to the new overview, benchmark, open-source, and core method files.
- [ ] Keep stats consistent with actual file counts.

### Task 12: Verification

**Files:**
- No source edits expected unless verification finds a real issue.

- [ ] Run `npm run verify`.
- [ ] Fix any Markdown/VitePress build issues.
- [ ] Run `npm run verify` again after fixes.
- [ ] Commit and push to `main`.
- [ ] Check the GitHub Pages deploy run and live pages.
