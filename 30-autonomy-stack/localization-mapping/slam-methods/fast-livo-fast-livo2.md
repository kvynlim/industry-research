# FAST-LIVO and FAST-LIVO2

<!-- method-priority:start
priority:
  learning: 4
  deployment: 5
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "FAST-LIVO and FAST-LIVO2 is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [LVI-SAM](lvi-sam.md), [R2LIVE and R3LIVE](r2live-r3live.md), [GLIM](glim.md), and [robust state estimation and multi-sensor localization fusion](../overview/robust-state-estimation-multi-sensor.md).

## Executive Summary

FAST-LIVO and FAST-LIVO2 are LiDAR-inertial-visual odometry and mapping systems from the HKU MARS Lab lineage. FAST-LIVO introduced a fast, tightly coupled sparse-direct LIVO approach. FAST-LIVO2 is the newer direct framework: it fuses IMU, LiDAR, and image measurements through an error-state iterated Kalman filter and uses direct methods for both LiDAR and vision.

FAST-LIVO2 removes many feature-engineering steps. The LiDAR module registers raw points without edge/plane feature extraction, and the visual module minimizes direct photometric error rather than relying on ORB or FAST corner features. Both modalities share a unified voxel map: LiDAR builds the geometric structure and the visual module attaches image patches to map points.

For AVs, FAST-LIVO2 is best seen as a high-performance local odometry and mapping front end. It is more tightly integrated than a loose LIO plus VO fusion stack, but it is still not a complete production localization system because it lacks map release management, fixed-map localization policy, dynamic-object semantics, certified timing, and safety monitors.

## Sensor, Noise, and Calibration Assumptions

FAST-LIVO2 assumes tightly synchronized LiDAR, IMU, and camera measurements. The reference repository explicitly emphasizes hard-synchronized equipment and recommends FAST-Calib-style LiDAR-camera extrinsic calibration.

The estimator is sensitive to LiDAR-to-IMU, camera-to-IMU, camera intrinsics, distortion, exposure behavior, IMU noise/bias parameters, and rolling-shutter or time-offset effects. Direct photometric residuals assume brightness consistency after exposure handling, while direct LiDAR residuals assume stable static geometry and usable point timing for deskewing. Dynamic objects, poor overlap between camera and LiDAR, or incorrect calibration can corrupt the shared voxel/patch map.

## Core Idea

FAST-LIVO2 extends the FAST-LIO2 philosophy from LiDAR-inertial odometry to direct LiDAR-inertial-visual odometry.

The main ideas are:

- **Unified ESIKF:** IMU propagation, LiDAR updates, and visual updates share one state-estimation framework.
- **Sequential Kalman updates:** heterogeneous LiDAR and image measurements are fused efficiently despite different dimensions and rates.
- **Direct LiDAR update:** raw LiDAR points are registered to the map without handcrafted edge/plane feature extraction.
- **Direct visual update:** image patches are aligned by minimizing photometric error rather than extracting sparse keypoints.
- **Unified voxel map:** LiDAR creates geometric points/planes; visual patches are attached to LiDAR-supported map points.
- **Plane priors for vision:** LiDAR-derived local planes support image alignment and patch geometry.
- **Exposure handling:** FAST-LIVO2 estimates image exposure time online and uses raycasting to improve robustness.

## Pipeline

1. Receive synchronized LiDAR, IMU, and camera data.
2. Propagate the state with IMU measurements.
3. Deskew LiDAR points using the propagated trajectory.
4. Run the direct LiDAR update against the voxel map.
5. Use the updated state and voxel map to support visual projection.
6. Select or update image patches attached to map points.
7. Minimize photometric residuals for the visual update.
8. Apply sequential ESIKF updates for LiDAR and image measurements.
9. Insert or update map points, voxel structures, and patch references.
10. Estimate or compensate exposure effects when needed.
11. Output odometry, dense map data, and reconstruction products.
12. Optionally use outputs for onboard navigation, airborne mapping, mesh/NeRF-style rendering, or offline reconstruction.

## Strengths

- Tightly couples LiDAR, camera, and IMU in one filter-based estimator.
- Direct LiDAR processing avoids dependence on LOAM-style edge/plane feature extraction.
- Direct visual processing avoids brittle sparse feature extraction in some scenes.
- Unified voxel map lets geometry and appearance support each other.
- FAST-LIO2 heritage gives strong real-time LiDAR-inertial performance.
- Visual updates can help in LiDAR-degenerate geometry when image texture and calibration are good.
- LiDAR geometry can stabilize visual depth and patch geometry.
- Demonstrated for onboard UAV navigation, airborne mapping, and reconstruction-style outputs.
- Reference repository provides hard-synchronized handheld hardware guidance and calibration tooling recommendations.

## Limitations

- Requires strong LiDAR-camera-IMU calibration and synchronization.
- Direct photometric methods are sensitive to exposure changes, rolling shutter, motion blur, lighting, lens contamination, and camera response.
- Camera-LiDAR field-of-view overlap matters.
- Dynamic objects can corrupt both the geometric voxel map and visual patches.
- Filter-based estimation is lower latency than smoothing but less natural for delayed loop closures and global corrections.
- Base FAST-LIVO2 is odometry/mapping, not full global SLAM with production map lifecycle.
- Reference implementation is ROS 1/catkin oriented.
- The repository states GPLv2 for source code and asks commercial users to discuss alternative licensing.

## AV Relevance

FAST-LIVO2 is relevant for AVs as a local multi-sensor odometry front end:

- it can bridge LiDAR-degenerate and vision-degenerate periods better than single-modality odometry,
- it can provide dense geometric and colorized map products for survey and inspection,
- it is a useful benchmark against LVI-SAM, R3LIVE, and pure FAST-LIO2,
- it highlights the importance of hard synchronization and calibration in LIVO.

Production AV localization usually needs more:

- fixed-map scan-to-map or landmark localization,
- wheel odometry and vehicle kinematic constraints,
- RTK/GNSS with innovation gating,
- map-version governance,
- covariance calibration,
- dynamic-object masking,
- deterministic latency and bounded correction behavior,
- monitoring for image quality, LiDAR degeneracy, IMU saturation, and calibration drift.

## Indoor/Outdoor Notes

**Indoor:** FAST-LIVO2 is strong in textured, structured indoor scenes such as labs, warehouses, hangars, stairwells, and industrial spaces. It can struggle with glass, darkness, overexposure, textureless walls, repetitive patterns, and moving crowds.

**Outdoor:** It is relevant for urban streets, campuses, forests, construction sites, and aerial/ground mapping. Direct visual alignment must handle sunlight, shadows, auto-exposure, rain, dust, and motion blur.

**Airside:** Airside use is promising near terminals, hangars, equipment yards, cargo areas, and service roads where LiDAR geometry and camera texture are both present. Open aprons are harder: LiDAR is geometrically weak, visual texture may be mostly ground markings, and moving aircraft/GSE can dominate observations. Hard synchronization and rugged camera exposure handling are mandatory.

## Comparison

| Method | Sensors | Estimation style | Visual treatment | AV interpretation |
|---|---|---|---|---|
| FAST-LIVO | LiDAR + camera + IMU | Tightly coupled sparse-direct LIVO | Sparse/direct visual constraints | Earlier MARS LIVO lineage |
| FAST-LIVO2 | LiDAR + camera + IMU | ESIKF with sequential updates | Direct photometric patches in unified voxel map | Modern direct LIVO odometry/mapping front end |
| FAST-LIO2 | LiDAR + IMU | ESIKF | None | Fast direct LIO baseline |
| LVI-SAM | LiDAR + camera + IMU | Factor-graph smoothing | Visual features with LiDAR depth | Graph-based LVI reference |
| R3LIVE | LiDAR + camera + IMU | LIO + VIO subsystems | Direct photometric color/radiance mapping | Reconstruction/colorized mapping lineage |
| GLIM | Range + IMU | Factor graph with scan-matching factors | Optional extension path | Mapping workbench rather than direct LIVO |

## Evaluation

Evaluate FAST-LIVO2 against pure LIO and other LIVO systems:

- absolute trajectory error,
- relative pose error and drift per distance,
- runtime and latency per sensor packet,
- LiDAR residual statistics,
- photometric residual statistics,
- map sharpness and color consistency,
- robustness to lighting/exposure changes,
- robustness to LiDAR-degenerate scenes,
- sensitivity to extrinsic and time-offset errors,
- performance with reduced camera-LiDAR overlap,
- recovery behavior after visual or LiDAR update rejection.

For airside evaluation, include apron-only routes, terminal-edge routes, day/night transitions, wet pavement, aircraft occlusion, repeated stand geometry, and moving GSE.

## Implementation Notes

- Use FAST-LIVO2 when hardware can provide accurate time synchronization; the repository explicitly publishes hard-synchronized handheld device resources.
- Use the recommended FAST-Calib-style LiDAR-camera extrinsic calibration workflow or an equivalent validated calibration.
- Configure camera intrinsics, distortion, exposure behavior, LiDAR type, IMU noise, and extrinsics carefully.
- Validate the LiDAR-only and LIO modes before enabling full LIVO.
- Monitor image exposure, feature/patch availability, LiDAR residuals, and IMU saturation.
- Keep dynamic objects out of persistent voxel/patch maps when used for mapping.
- Expect ROS 1 integration work for ROS 2 AV stacks.
- Review GPLv2/commercial licensing before product integration.

## Practical Recommendation

Use FAST-LIVO2 as a modern direct LIVO baseline and as a candidate local odometry engine when high-quality camera-LiDAR-IMU synchronization is available. It is especially valuable for research on dense reconstruction, UAV/UGV mapping, and degraded-environment odometry.

For production AV localization, pair it with a fixed-map, multi-sensor fusion backend that handles GNSS, wheel odometry, map constraints, dynamic objects, calibrated uncertainty, and fault monitoring.

## Sources

- Zheng et al., "FAST-LIVO2: Fast, Direct LiDAR-Inertial-Visual Odometry." https://arxiv.org/abs/2408.14035
- FAST-LIVO2 official repository. https://github.com/hku-mars/FAST-LIVO2
- FAST-LIVO2 T-RO page via repository citation. https://github.com/hku-mars/FAST-LIVO2
- FAST-LIVO, "Fast and Tightly-coupled Sparse-Direct LiDAR-Inertial-Visual Odometry," cited by FAST-LIVO2 repository. https://github.com/hku-mars/FAST-LIVO2
- FAST-LIO2 paper. https://arxiv.org/abs/2107.06829
- FAST-LIO official repository. https://github.com/hku-mars/FAST_LIO
- FAST-Calib repository, recommended by FAST-LIVO2 for LiDAR-camera calibration. https://github.com/hku-mars/FAST-Calib
