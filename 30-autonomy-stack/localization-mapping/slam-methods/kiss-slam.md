# KISS-SLAM

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "KISS-SLAM is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [KISS-ICP](kiss-icp.md), [KISS-Matcher](kiss-matcher.md), [GLIM](glim.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Executive Summary

KISS-SLAM is a LiDAR-only 3D SLAM system from the same PRBonn/IPB lineage as KISS-ICP. It follows the "Keep It Small and Simple" principle, but extends the scope from odometry to SLAM: it builds local maps, detects/matches local-map revisits, and optimizes the trajectory in a pose graph.

The distinction from KISS-ICP is important. KISS-ICP is a local odometry front end with a rolling voxel map and no loop closure. KISS-SLAM uses LiDAR odometry as the motion backbone, then adds local mapping, map matching, and pose-graph optimization for global consistency. It remains LiDAR-only, deliberately avoiding IMU, GNSS, wheel odometry, semantic mapping, and heavy multi-sensor calibration.

For AVs, KISS-SLAM is a strong LiDAR-only global-consistency baseline and a useful survey-mapping tool. It is not a production localization system by itself because it does not solve fixed-map localization, safety monitoring, dynamic-object reasoning, calibrated uncertainty, or multi-sensor fault handling.

## Sensor, Noise, and Calibration Assumptions

KISS-SLAM assumes only a stream of 3D LiDAR scans. Like KISS-ICP, it benefits from per-point timing or a scan timing model for motion compensation, but it deliberately avoids IMU, GNSS, wheel odometry, and camera calibration.

The main noise assumptions are geometric: scans must contain enough static 3D structure for odometry, local-map matching, and loop registration. Repeated geometry, moving objects, sparse point clouds, bad timestamps, or aggressive motion can create wrong odometry or false loop constraints. On a vehicle, LiDAR-to-base extrinsics still matter if the output is fused with other sensors or used to build a map in the vehicle frame.

## Core Idea

KISS-SLAM asks how far a simple LiDAR-only SLAM design can go when built around robust odometry and best practices in graph-based SLAM.

The core design is:

```text
KISS-ICP-style LiDAR odometry
  -> split trajectory into local maps/submaps
  -> detect and match revisits between local maps
  -> add relative constraints
  -> optimize a pose graph
  -> output a globally more consistent trajectory and map
```

The paper emphasizes broad generalization across environments, sensors, and motion profiles with little parameter tuning. The open-source repository states that the implementation builds on KISS-ICP, MapClosures, and g2o.

## Pipeline

1. Receive sequential 3D LiDAR scans.
2. Run LiDAR-only odometry using the KISS-ICP design philosophy.
3. Maintain local maps from consecutive scans or trajectory segments.
4. Split the trajectory into local-map units suitable for matching.
5. Search for loop candidates or revisits between local maps.
6. Register local maps to estimate loop or inter-map constraints.
7. Reject inconsistent constraints with geometric checks.
8. Build a pose graph over local-map/keyframe poses.
9. Optimize the graph with odometry and loop constraints.
10. Update the trajectory and map using optimized poses.
11. Export or visualize the final consistent point-cloud map.

The system deliberately keeps the sensor model simple: 3D LiDAR in, trajectory and map out.

## Strengths

- Adds loop/global consistency to the KISS-ICP family without abandoning the simple LiDAR-only philosophy.
- Does not require IMU, GNSS, wheel odometry, cameras, or semantic labels.
- Suitable as a strong baseline for LiDAR-only SLAM, not just local odometry.
- Modern open-source implementation with Python packaging.
- MIT license in the reference repository.
- Built on well-known components: KISS-ICP for odometry, MapClosures for local-map matching, and g2o for pose-graph optimization.
- Useful for map building where local KISS-ICP drift would be unacceptable.
- Easier to inspect than large multi-sensor SLAM frameworks.

## Limitations

- LiDAR-only global consistency still depends on enough geometric distinctiveness for loop detection and registration.
- No IMU means scan deskewing and motion priors inherit KISS-ICP-style constant-velocity assumptions.
- No GNSS/RTK, wheel odometry, or vehicle model in the base scope.
- No camera texture or semantic cues for repeated geometry.
- Pose-graph corrections can move the map globally; production online localization must isolate such corrections from control outputs.
- Dynamic objects can corrupt local maps and false loop matches.
- Open apron, highway, and other low-structure areas can remain underconstrained.
- The system is new relative to older production-tested SLAM packages, so long-term maintenance and edge-case behavior need validation.

## AV Relevance

KISS-SLAM is relevant to AV teams for three main reasons.

First, it is a clean baseline for LiDAR-only SLAM. If a more complicated stack cannot beat KISS-SLAM on accuracy, runtime, and robustness, the extra complexity needs justification.

Second, it clarifies the KISS-ICP boundary. KISS-ICP is excellent local odometry, but long routes drift because there is no loop closure. KISS-SLAM is the corresponding system when map consistency and loop correction are in scope.

Third, it can support survey or research map generation where IMU/GNSS/camera integration is unavailable or intentionally excluded for ablation testing.

Production caveats:

- It should not be used as the only AV localization source.
- It should not replace a fixed-map localizer for runtime autonomy.
- It needs dynamic-object filtering for fleet maps.
- It needs covariance and graph-health outputs before use as a factor in safety-critical fusion.
- It needs external anchoring for georeferenced maps.

## Indoor/Outdoor Notes

**Indoor:** KISS-SLAM is a good fit for warehouses, industrial buildings, campuses, tunnels, and corridors with enough geometric variation. It may struggle in long symmetric corridors, glass-heavy areas, and highly repetitive storage aisles unless loop candidates are strongly validated.

**Outdoor:** It is suitable for structured streets, campuses, forests, yards, and mining or port environments where revisits contain enough 3D structure. It is weaker in open highways, fields, and flat aprons.

**Airside:** KISS-SLAM can be useful for mapping terminal edges, service roads, cargo areas, and structured stands. Open aircraft aprons are harder: large planar surfaces, repeated gate layouts, aircraft movement, and baggage/GSE clutter can cause drift or false associations. Fuse RTK/GNSS, wheel odometry, IMU, and map priors for production airside localization.

## Comparison

| Method | Scope | Sensors | Loop/global consistency | AV interpretation |
|---|---|---|---|---|
| KISS-ICP | Odometry | LiDAR | No loop closure in core | Best simple local LiDAR odometry baseline |
| KISS-SLAM | SLAM | LiDAR | Local-map matching plus pose graph | Best simple LiDAR-only SLAM/global-consistency baseline |
| KISS-Matcher | Registration/relocalization component | Point clouds | Pairwise/global registration, not odometry | Tool for loop, relocalization, map merge |
| FAST-LIO2 | Odometry | LiDAR + IMU | No full graph in base package | Fast LIO front end |
| LIO-SAM | SLAM | LiDAR + IMU, optional GPS | Factor graph with loop/GPS factors | Reference multi-sensor graph SLAM |
| MOLA | Framework | LiDAR, optional IMU/GNSS/kinematics | Configurable map/localization workflows | Engineering framework for localization experiments |

## Evaluation

KISS-SLAM should be evaluated separately from KISS-ICP:

- odometry drift before loop optimization,
- final absolute trajectory error after graph optimization,
- relative pose error over fixed path lengths,
- loop-detection precision and recall,
- false-loop rate in repeated geometry,
- map consistency at revisited areas,
- runtime versus LiDAR frame rate,
- memory growth with route length,
- robustness across LiDAR models and motion profiles,
- behavior after partial odometry failures.

For AV and airside use, add:

- georeferenced map alignment error after anchoring,
- repeated-run consistency across days,
- false loop closures around repeated stands or similar buildings,
- map pollution from aircraft, buses, tugs, and pedestrians,
- ability to create a clean map for a separate fixed-map localizer.

## Implementation Notes

- Use the official `PRBonn/kiss-slam` repository for the reference implementation.
- The repository provides `pip install kiss-slam` and command-line tools such as `kiss_slam_pipeline`.
- Generate and review the default YAML configuration before experiments.
- For indoor work, the repository recommends reducing odometry maximum range and local-map splitting distance to match environment scale.
- Use the `IROS25` tag when reproducing paper results, because active development may diverge from the paper.
- Treat loop-closure outputs as map-building corrections, not low-latency control poses.
- Keep the KISS-ICP configuration and the KISS-SLAM graph/local-map configuration versioned together.
- Add dynamic-object filtering upstream if maps are used for downstream autonomy.
- If using outputs in a fusion system, derive health metrics from registration residuals, loop consistency, graph residuals, and local-map overlap.

## Practical Recommendation

Use KISS-SLAM when you want a simple, modern LiDAR-only SLAM baseline with loop/global consistency. It is especially useful for comparing against multi-sensor systems and for demonstrating how much can be achieved without IMU, GNSS, cameras, or semantics.

For production AV localization, keep KISS-SLAM in the mapping/research lane. Use it to build or validate maps and to benchmark global consistency, then deploy a fixed-map, multi-sensor, monitored localization stack for runtime operation.

## Sources

- Guadagnino, Mersch, Gupta, Vizzo, Grisetti, and Stachniss, "KISS-SLAM: A Simple, Robust, and Accurate 3D LiDAR SLAM System With Enhanced Generalization Capabilities," IROS 2025/arXiv. https://arxiv.org/abs/2503.12660
- KISS-SLAM official repository. https://github.com/PRBonn/kiss-slam
- KISS-SLAM IROS paper PDF. https://www.ipb.uni-bonn.de/wp-content/papercite-data/pdf/kiss2025iros.pdf
- KISS-ICP official repository. https://github.com/PRBonn/kiss-icp
- KISS-ICP paper. https://arxiv.org/abs/2209.15397
- MapClosures repository, cited by KISS-SLAM as a dependency. https://github.com/PRBonn/MapClosures
- g2o repository. https://github.com/RainerKuemmerle/g2o
