# GenZ-ICP and GenZ-LIO

Related docs: [ICP](icp.md), [Point-to-Plane ICP](point-to-plane-icp.md), [KISS-ICP](kiss-icp.md), [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md), [GEODE Degenerate LiDAR Benchmark](geode-degenerate-lidar-benchmark.md), and [Production LiDAR-to-Map Localization](../overview/production-lidar-map-localization.md).

**Last updated:** 2026-05-09

## Executive Summary

GenZ-ICP and GenZ-LIO are degeneracy- and generalization-focused LiDAR odometry methods from the POSTECH line of work. GenZ-ICP revisits ICP residual design and adaptively blends point-to-plane and point-to-point metrics based on scene geometry. GenZ-LIO extends the idea into LiDAR-inertial odometry for indoor, outdoor, and transition scenes by regulating voxel size, using hybrid residuals in the state update, and pruning correspondence search.

The practical motivation is familiar to airport and industrial autonomy: LiDAR odometry that performs well in one scene scale can degrade in another. Corridors, tunnels, open aprons, hangars, and terminal exits all change point density and observability. A fixed voxel size or a single residual metric is often too brittle.

For airside autonomy, the GenZ line is relevant as a robust front-end design pattern. It does not remove the need for RTK, IMU, wheel odometry, map localization, or loop closure, but it directly targets degeneracy and indoor-outdoor transition problems that airport vehicles encounter.

## What They Add

| Method | Core contribution | Where it helps |
|---|---|---|
| GenZ-ICP | Adaptive weighting between point-to-plane and point-to-point ICP residuals | Long corridors and scene-dependent degeneracy |
| GenZ-LIO | PID-inspired adaptive voxel sizing, hybrid-metric state update, voxel-pruned search | Indoor-outdoor transitions and changing point density |

## Core Technical Idea

Point-to-plane ICP is efficient and accurate when local planar structure constrains motion well. It can become ill-posed when the environment lacks constraints in one direction, such as a long corridor. Point-to-point residuals can add complementary constraints but are more expensive and noisier if used indiscriminately.

GenZ-ICP adaptively weights the two residual families based on the observed geometry:

```text
registration error = w_plane * point_to_plane + w_point * point_to_point
```

GenZ-LIO brings this into an inertial estimator and adds adaptive voxelization. Instead of fixing a downsampling voxel size, it uses feedback inspired by PID control to drive the voxelized point count toward a scene-scale-aware target. This keeps computation and map density more stable as the robot moves between confined and open spaces.

## Inputs and Outputs

Inputs:

- GenZ-ICP: LiDAR scans or local submaps.
- GenZ-LIO: LiDAR scans plus IMU measurements.
- Time synchronization and extrinsic calibration for LIO mode.

Outputs:

- GenZ-ICP: LiDAR odometry or relative scan/submap registration.
- GenZ-LIO: LiDAR-inertial state estimates and local map updates.
- Degeneracy-robust registration updates suitable for a larger SLAM or localization stack.

## Pipeline

GenZ-ICP:

1. Preprocess and optionally downsample the LiDAR scan.
2. Estimate local geometry and residual observability.
3. Build point-to-plane and point-to-point candidate residuals.
4. Adaptively weight residual types based on geometric conditions.
5. Optimize the relative pose.
6. Update the local odometry trajectory.

GenZ-LIO:

1. Propagate state with IMU.
2. Analyze LiDAR scene scale and point range distribution.
3. Adapt downsampling voxel size through feedback control.
4. Build hybrid point-to-plane and point-to-point update residuals.
5. Prune non-promising voxel candidates during correspondence search.
6. Run LiDAR-inertial state update.
7. Update the map and publish odometry.

## Strengths

- Directly addresses geometric degeneracy rather than only detecting it afterward.
- Better suited to indoor-outdoor transitions than fixed-parameter LIO.
- Hybrid residuals can improve corridor and weak-observability behavior.
- Adaptive voxel size helps stabilize runtime and feature count across scale changes.
- GenZ-ICP has public code and ROS integration.
- Conceptually compatible with production localization as a front-end registration module.

## Failure Modes

- Hybrid residuals still cannot create observability where no stable structure exists.
- Open aprons may remain weak in yaw or lateral constraints.
- Point-to-point residuals can be misled by dynamic objects or unmodeled distortion.
- Adaptive voxel control adds tuning and failure modes.
- Degeneracy mitigation does not replace covariance consistency checks.
- LIO mode still depends on IMU calibration, bias handling, deskewing, and timing.

## Airside, Indoor, and Outdoor Fit

**Indoor:** Strong fit for corridors, terminals, warehouses, hangars, and tunnels where degeneracy is common.

**Outdoor:** Strong fit for mixed urban/industrial scenes and route segments with changing range distribution. Open fields or aprons still require external constraints.

**Airside:** Very relevant for terminal-to-apron transitions, hangar exits, service roads, under-bridge areas, and long straight corridors. Pair with RTK/GNSS, wheel odometry, map matching, and degeneracy-aware covariance inflation for open apron segments.

## Implementation Notes

- Benchmark against KISS-ICP, FAST-LIO2, Point-LIO, and GLIM using the same deskewing and voxel policies.
- Track residual conditioning, Hessian eigenvalues, inlier geometry, runtime, and drift per meter.
- For GenZ-LIO, validate voxel adaptation during abrupt transitions from indoor to open outdoor scenes.
- Use dynamic-object filtering before point-to-point matching in busy airside scenes.
- Do not accept low registration residuals as proof of strong observability; inspect directional uncertainty.
- Keep a fallback hierarchy for weak geometry: map constraints, RTK/GNSS, wheel/IMU dead reckoning, and safe stop.

## Sources

- Lee, Lim, and Han, "GenZ-ICP: Generalizable and Degeneracy-Robust LiDAR Odometry Using an Adaptive Weighting." https://arxiv.org/abs/2411.06766
- Official GenZ-ICP repository. https://github.com/cocel-postech/genz-icp
- Lee et al., "GenZ-LIO: Generalizable LiDAR-Inertial Odometry Beyond Indoor--Outdoor Boundaries." https://arxiv.org/abs/2603.16273
- Local context: [GEODE Degenerate LiDAR Benchmark](geode-degenerate-lidar-benchmark.md)
- Local context: [Production LiDAR-to-Map Localization](../overview/production-lidar-map-localization.md)
