# MOLA, MOLA-LO, and MOLA-LIO

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "MOLA, MOLA-LO, and MOLA-LIO is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [KISS-ICP](kiss-icp.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [GLIM](glim.md), [GICP and VGICP](gicp-vgicp.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Executive Summary

MOLA is the Modular Optimization framework for Localization and mApping. It is not a single SLAM algorithm in the narrow sense; it is a modular C++ and ROS 2 ecosystem for building localization, mapping, LiDAR odometry, LiDAR-inertial odometry, relocalization, map manipulation, and sensor-fusion pipelines.

MOLA-LO is the main LiDAR odometry and localization component. It uses configurable `mp2p_icp` filtering and ICP/GICP/NDT-style local-map pipelines, with 2D and 3D LiDAR support. When synchronized IMU data is available, MOLA can operate in LIO mode for better motion compensation and state estimation. MOLA also includes smoother-based fusion paths for LO/LIO, GNSS, IMU, and kinematic data.

For AV and airside work, MOLA is production-relevant because it separates mapping, localization, map formats, relocalization, state estimation, ROS 2 integration, and diagnostics more explicitly than many academic SLAM packages. It is still not a turnkey safety-certified localization stack: deployment needs calibrated sensor timing, map QA, robust dynamic-object filtering, covariance validation, fallback logic, and legal review of GPL-family licensing.

## Sensor, Noise, and Calibration Assumptions

MOLA-LO can operate from 2D or 3D LiDAR point clouds, and MOLA-LIO adds a synchronized IMU stream when available. The smoother-based state-estimation path can also use wheel odometry, GNSS, and vehicle kinematic constraints.

The practical assumptions are standard scan-matching assumptions: enough overlap between scans, enough static geometry, bounded motion during a scan, stable sensor extrinsics, and point-cloud noise that is compatible with the selected ICP/GICP/NDT pipeline. IMU use requires time alignment, correct gravity initialization, and realistic noise/bias settings. Vehicle use should treat LiDAR-to-base, IMU-to-base, wheel-odometry frame, and map georeference transforms as controlled calibration artifacts.

## Core Idea

MOLA treats localization and mapping as a modular system architecture rather than a fixed front-end/backend recipe. A MOLA system is assembled from modules: sensor sources, observation filters, local maps, odometry estimators, map servers, relocalizers, visualization tools, and optional smoother-based state estimators.

The key production-oriented ideas are:

- **Configurable pipelines:** LiDAR preprocessing, map layers, ICP matchers, and output behavior are configured through YAML rather than hard-coded per dataset.
- **Metric-map ecosystem:** MOLA uses MRPT-style metric maps such as point clouds, voxel maps, grids, and keyframe/simple-map files.
- **LO and localization separation:** MOLA-LO can build maps or run in localization-only mode against a prebuilt map with map updates disabled.
- **Relocalization support:** startup pose uncertainty is treated as a separate relocalization problem rather than hidden inside odometry.
- **Smoother-based fusion:** a sliding-window estimator can combine odometry sources, IMU, GNSS, and kinematic constraints.
- **ROS 2 first integration:** current documentation and demos target ROS 2 launch, diagnostics, services, and topic conventions.

MOLA-LO is therefore closer to an engineering framework for localization/mapping workflows than to a minimal benchmark implementation.

## Pipeline

1. Read LiDAR point clouds from ROS 2, dataset adapters, rosbags, or CLI inputs.
2. Apply configurable point-cloud filtering and downsampling pipelines.
3. Predict motion using the chosen state estimator, from simple odometry state through smoother-based fusion.
4. Deskew or compensate scans when timing and optional IMU data are available.
5. Match the current scan against a configurable local metric map using ICP, GICP, or NDT-like pairings.
6. Update the local map if mapping is enabled.
7. Save map artifacts, typically metric-map files and keyframe/simple-map files.
8. Optionally post-process keyframe maps for downsampling, loop closure, and globally consistent metric-map generation.
9. For localization-only operation, load a prebuilt map and keep map updates disabled.
10. Use relocalization services or initial-pose inputs before activating scan matching when the initial pose is uncertain.
11. Optionally fuse LO/LIO outputs with GNSS, IMU, wheel odometry, and kinematic constraints in the smoother.
12. Publish odometry, map-frame localization, TF, diagnostics, and visualization outputs.

## Strengths

- Strong modularity: pipelines, local maps, matchers, and estimators can be swapped without rewriting the whole stack.
- Practical ROS 2 integration with launch files, services, diagnostics, and CLI tools.
- Supports 2D and 3D LiDAR odometry/localization workflows.
- Designed to work across 16- to 128-ring LiDARs, indoor and outdoor environments, and different motion profiles.
- MOLA-LO can run as map builder or localization-only module against a prebuilt map.
- Metric-map and simple-map formats make map inspection, export, filtering, and post-processing first-class tasks.
- Smoother path can combine LO/LIO with GNSS and vehicle kinematic information.
- Relocalization is explicitly recognized as a separate startup problem.
- The configurable `mp2p_icp` pipeline is useful for testing point-to-point, point-to-plane, GICP, and NDT-like registration choices.

## Limitations

- The flexibility also creates integration burden: module selection, YAML configuration, map-layer naming, and TF conventions must be controlled carefully.
- It is a framework, not one frozen algorithm with one canonical behavior.
- Correct time synchronization and LiDAR-to-IMU/vehicle extrinsics remain mandatory for LIO and vehicle deployment.
- The quality of ICP/GICP/NDT localization still depends on scene geometry, dynamic-object filtering, scan overlap, and the quality of the map.
- Long open spaces, highways, aprons, and feature-poor ramps can be weakly constrained by LiDAR alone.
- Loop closure and globally consistent map generation are workflow steps, not magic guarantees.
- Production use must review license terms; the main MOLA repo states GPLv3 except where modules specify otherwise.
- Some documentation sections for advanced fusion and factor-graph details are still evolving.

## AV Relevance

MOLA is relevant to AV localization because it distinguishes between:

- odometry while building a map,
- localization against a fixed prebuilt map,
- relocalization after startup or loss,
- map manipulation and export,
- state fusion with GNSS/IMU/vehicle constraints.

That decomposition matches production needs better than many single-paper SLAM demos. An AV team could use MOLA-LO to prototype LiDAR scan-to-map localization, run repeatable mapping experiments, compare GICP/NDT-style map representations, or evaluate smoother fusion with GNSS and kinematic factors.

For production, MOLA should be wrapped with:

- map release/version management,
- dynamic-object filtering before persistent map generation,
- residual, overlap, and degeneracy monitors,
- calibrated covariance outputs,
- fallback localization sources,
- deterministic latency budgets,
- replayable safety evidence,
- integration with vehicle CAN, wheel odometry, IMU, GNSS/RTK, and perception health signals.

## Indoor/Outdoor Notes

**Indoor:** MOLA-LO is a good fit for warehouses, corridors, labs, hangars, terminals, and industrial buildings where walls, shelving, pillars, doors, and equipment provide LiDAR structure. Startup relocalization and localization-only map loading are particularly useful for robots that begin from uncertain poses.

**Outdoor:** It is relevant for campuses, roads, depots, yards, ports, and airports. Outdoor success depends on enough vertical structure and a map built under comparable conditions.

**Airside:** MOLA is attractive for GSE and airport autonomy because it supports map building, map loading, relocalization, and sensor-fusion-oriented state estimation. The caveat is apron geometry: large flat spaces, repeated stands, moving aircraft, and temporary equipment can make LiDAR-only localization overconfident unless fused with wheel odometry, GNSS/RTK, IMU, and map priors.

## Comparison

| Method | Main role | Sensors | Global/map behavior | AV interpretation |
|---|---|---|---|---|
| MOLA/MOLA-LO | Modular LiDAR odometry, mapping, and localization framework | LiDAR, optional IMU, optional GNSS/kinematics through state estimation | Prebuilt map loading, metric maps, simple maps, post-processing workflows | Strong prototyping and integration framework |
| FAST-LIO2 | Direct LiDAR-inertial odometry | LiDAR + IMU | No full loop/map operations in base package | Fast online odometry front end |
| KISS-ICP | Simple LiDAR odometry | LiDAR | Local rolling map only | Excellent LiDAR-only baseline |
| KISS-SLAM | Simple LiDAR-only SLAM | LiDAR | Local-map matching and pose-graph optimization | LiDAR-only global-consistency baseline |
| GLIM | Range-inertial mapping framework | Range sensor + IMU | Direct scan-matching factors and global mapping | Heavier mapping/research workbench |
| LIO-SAM | Factor-graph LIO SLAM | LiDAR + IMU, optional GPS | Loop closure and GPS factors | Reference factor-graph architecture |

## Evaluation

Evaluate MOLA in the exact mode intended for deployment: LO mapping, LIO mapping, localization-only, relocalization, or smoother fusion.

Useful metrics:

- absolute trajectory error against RTK/INS, control points, or motion capture,
- relative drift per kilometer and per minute,
- scan-to-map residual distributions,
- localization availability after relocalization,
- false relocalization rate,
- map consistency after revisits and loop closure,
- runtime and latency on target CPU,
- ROS 2 diagnostic status under sensor dropouts,
- sensitivity to LiDAR range, voxel size, and map-layer choices,
- behavior with map updates disabled versus enabled,
- covariance consistency if outputs are fused downstream.

For airside work, add lateral lane/stand error, yaw error near docking areas, repeated-route map alignment across shifts, apron-only drift, and behavior near large moving aircraft or parked GSE.

## Implementation Notes

- Start with the official ROS 2 launch paths unless the use case is offline benchmarking or batch map processing.
- Keep map building and localization-only configurations separate; production localization should not silently update a released map.
- In localization mode, disable map updates and load a validated metric map and, when needed, the keyframe/simple-map file.
- Use relocalization or a trusted initial pose before activating LO when startup uncertainty is large.
- Treat pipeline YAML as code: version it, review it, and lock it per vehicle/sensor configuration.
- Validate all frame conventions around `map`, `odom`, `base_link`, sensor frames, UTM/ENU, and ROS TF publishers.
- For LIO, confirm IMU time alignment, LiDAR point timing, gravity direction, and extrinsics before tuning ICP parameters.
- For wheeled AVs, evaluate smoother fusion with wheel odometry and kinematic factors rather than relying on LiDAR geometry alone.
- Use ROS diagnostics and residual health metrics as inputs to localization fault handling.
- Check license obligations before embedding MOLA modules in commercial products.

## Practical Recommendation

Use MOLA when the goal is to evaluate or build a configurable localization and mapping workflow rather than to run one fixed academic algorithm. It is a strong candidate for AV research infrastructure, survey mapping experiments, LiDAR scan-to-map localization prototypes, and ROS 2-based state-fusion trials.

Do not treat MOLA-LO/LIO alone as a finished production AV localizer. Use it as a well-structured component inside a larger localization stack with map governance, dynamic-object filtering, calibration control, monitoring, fallback estimators, and safety validation.

## Sources

- MOLA official repository. https://github.com/MOLAorg/mola
- MOLA official documentation. https://docs.mola-slam.org/
- MOLA LiDAR odometry documentation. https://docs.mola-slam.org/latest/mola_lidar_odometry.html
- MOLA localization documentation. https://docs.mola-slam.org/latest/localization.html
- MOLA LO/LIO pipeline documentation. https://docs.mola-slam.org/latest/mola_lo_pipelines.html
- MOLA map-and-localize tutorial. https://docs.mola-slam.org/latest/tutorial-mola-lo-map-and-localize.html
- MOLA state-estimator documentation. https://docs.mola-slam.org/latest/mola_state_estimators.html
- Blanco-Claraco, "A Modular Optimization Framework for Localization and Mapping," RSS 2019. https://ingmec.ual.es/~jlblanco/papers/blanco2019mola_rss2019.pdf
- Blanco-Claraco, "A flexible framework for accurate LiDAR odometry, map manipulation, and localization," IJRR 2025. https://doi.org/10.1177/02783649251316881
