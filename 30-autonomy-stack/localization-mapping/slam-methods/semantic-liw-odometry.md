# Semantic-LiDAR-Inertial-Wheel Odometry

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "Semantic-LiDAR-Inertial-Wheel Odometry is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [semantic SLAM](semantic-slam.md), [dynamic-object-aware SLAM](dynamic-object-aware-slam.md), [FAST-LIO2](fast-lio-fast-lio2.md), [LiDAR map cleaning and dynamic removal](lidar-map-cleaning-dynamic-removal.md), and [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md).

**Last updated:** 2026-05-09

## Executive Summary

Semantic-LiDAR-Inertial-Wheel Odometry is a tightly coupled LiDAR-IMU-wheel localization framework for large-scale dynamic environments, demonstrated on automated port operations. The method combines semantic map structure, LiDAR scan matching, inertial propagation, and wheel odometry inside an iterative error-state Kalman filter.

The main contribution is using a semantic-voxel global map to reduce long-term drift in places where raw geometry alone is ambiguous or polluted by dynamic actors. Wheel odometry is not trusted uniformly: a 3D adaptive scaling strategy changes the measurement weights to handle terrain variation and dynamic movement.

## What It Adds

- Semantic-voxel map representation for global semantic scan matching.
- Tightly coupled LiDAR, IMU, and wheel odometry in an iESKF.
- Wheel-odometry weighting that adapts to terrain and motion conditions.
- Real operational evaluation at port scale: about one million square meters, 3,575 hours, and 35 intelligent guided vehicles in the reported study.
- A useful pattern for logistics yards, terminals, warehouses, and airside GSE routes where dynamic vehicles dominate the raw point cloud.

## Sensor and Map Model

Sensor suite:

- 3D LiDAR.
- IMU.
- Wheel odometry.
- Semantic perception or a semantic map-building pipeline.

The map is not just a point cloud. It carries semantic voxel information so the scan matcher can prefer persistent class structure over transient clutter. For port and airside deployments, candidate persistent classes include buildings, poles, curbs, lane/stand markings, barriers, fixed equipment, and facade geometry. Dynamic or movable classes should be downweighted or excluded from the persistent localization layer.

## Fusion Mechanics

A practical abstraction:

```text
x_k^- = propagate_imu(x_k-1, imu)
x_k^+ = iESKF_update(x_k^-,
                     r_semantic_lidar,
                     r_wheel_scaled,
                     r_nonholonomic)
```

The semantic LiDAR residual aligns current observations to a semantic voxel map. The wheel residual uses adaptive scaling so the filter can reduce trust during slip, rough terrain, or motion regimes that violate the wheel model.

## Timing and Calibration

Required calibration:

- LiDAR-IMU extrinsics and time offset.
- Wheel frame to IMU/body frame.
- Wheel scale, track width, and encoder latency.
- Semantic map frame to operational/global frame.

Because semantic maps can be updated separately from the odometry stack, map versioning matters. A vehicle should know exactly which semantic voxel map produced its localization output.

## Dynamic and Degenerate Scenes

This method is most relevant when dynamics and repeated industrial structure create raw scan-matching ambiguity:

- automated ports with IGVs, trucks, containers, cranes, and changing cargo layouts,
- logistics yards and warehouses with movable pallets and racks,
- airports with tugs, dollies, buses, aircraft, cones, and temporary equipment.

Semantic constraints help only if the semantic layer is reliable and if dynamic classes are not allowed to become permanent map anchors. False semantics can be worse than no semantics because they create structured, repeatable outliers.

## Evaluation Guidance

Track:

- ATE/RPE over long operational routes.
- Drift by map tile and semantic class availability.
- Relocalization success after dynamic occlusion.
- Wheel slip residual and adaptive weight history.
- Semantic false-positive and false-negative impact on scan matching.
- Map aging: performance before and after layout changes.
- Runtime and memory for semantic voxel lookup on target compute.

## Integration Readiness

The system is a useful production design signal because it was evaluated in a real port-scale setting rather than only in short public sequences. Integration still requires a semantic map lifecycle, annotation/change control, dynamic-object policy, and regression tests whenever perception classes or map-generation rules change.

## Limitations

- Depends on reliable semantic labeling and a maintained semantic map.
- Semantic classes transfer poorly across domains unless retrained or remapped.
- Wheel odometry still fails under severe slip, lift, or wheel-ground loss.
- Dynamic objects can corrupt both the live scan and the semantic map.
- Public reproducibility depends on whether operational data and implementation details are available.

## Sources

- Semantic-LiDAR-Inertial-Wheel Odometry arXiv paper: https://arxiv.org/abs/2509.14999
- Semantic SLAM background: https://arxiv.org/abs/2209.10854
- Dynamic map-cleaning benchmark context: https://kth-rpl.github.io/DynamicMap_Benchmark/
