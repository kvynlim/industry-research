# MM-LINS

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "runtime-localization", "outdoor"]
  reason: "MM-LINS is rated for LiDAR odometry, mapping, or scan-matching coverage in AV localization stacks."
method-priority:end -->

Related docs: [FAST-LIO / FAST-LIO2](fast-lio-fast-lio2.md), [LIO-SAM](lio-sam.md), [GLIM](glim.md), [MOLA](mola.md), [factor graphs and iSAM2](factor-graph-isam2-gtsam.md), [robust PGO](robust-pgo-gnc-risam.md), [LiDAR place recognition](../overview/lidar-place-recognition-relocalization.md), [production LiDAR map localization](../overview/production-lidar-map-localization.md), and [LiDAR sensors](../../../20-av-platform/sensors/robosense-lidar.md).

## Executive Summary

MM-LINS is a Multi-Map LiDAR-Inertial System for over-degenerate environments. Its target failure mode is sharper than ordinary LiDAR degeneracy: not just a hallway or planar scene where some pose axes are weak, but an interval so degraded that continuing to update the same active map causes drift and map corruption. The system detects over-degeneracy, stores the current active map as a sleeping map, dynamically initializes a new map after the robot exits the bad region, and later fuses maps when Scan Context detects overlap.

The core idea is operationally useful: when localization is not well constrained, stop pretending that one continuous local map is healthy. Preserve the last trustworthy map, restart mapping when observability returns, then fuse maps with explicit constraints. This is directly relevant to indoor logistics, tunnels, smoke/dust scenes, and airside open-apron or terminal-edge areas where LiDAR can become temporarily underconstrained.

MM-LINS is not a new sensor modality. It is a robustness method layered on LiDAR-inertial odometry, map management, loop recognition, and pose-graph/map fusion.

## Problem Fit

MM-LINS fits:

- Long corridors, tunnels, parking garages, warehouses, and service roads with repeated geometry.
- Scenes where smoke, dust, plastic bags, crowds, or occlusion reduce effective LiDAR density.
- Robots that may leave a degenerate zone and later re-enter an already mapped zone.
- Operations where map quality matters, not only short-term odometry.

It is a poor fit when:

- There is no chance of later overlap between maps.
- The robot needs globally referenced pose through the degraded zone without external aiding.
- The scene is dominated by moving objects for long periods.
- The platform cannot tolerate pose discontinuity or reinitialization events.

## Sensor Model

MM-LINS assumes:

- A 3D LiDAR, often mechanical or solid-state.
- A 6-axis IMU.
- Known LiDAR-IMU extrinsics.
- Sufficient time alignment for LiDAR deskewing.
- A LiDAR-inertial front end capable of producing state covariance or degeneracy indicators.

The front-end state is standard LIO:

```text
x = [R, p, v, b_g, b_a, g]
```

The map state is multi-map:

```text
S = { M_active, M_sleeping_1, ..., M_sleeping_N }
```

Each map has its own local frame, local trajectory segment, and point/feature representation. The back end estimates transformations among maps when overlap is recognized.

## Pipeline

1. **LiDAR-inertial front end**
   - Deskew LiDAR scans using IMU.
   - Run iterated error-state Kalman filtering or a FAST-LIO-like update.
   - Produce pose, covariance, residuals, and local map updates.

2. **Degeneracy evaluation**
   - Monitor observability/uncertainty indicators over time.
   - If over-degeneracy persists, freeze the current active map as a sleeping map.

3. **Dynamic reinitialization**
   - Continue trying to initialize a new active map while moving through the degraded region.
   - Resume ordinary LIO once enough geometric constraint returns.

4. **Inter-map recognition**
   - Use Scan Context descriptors to detect overlap between active and sleeping maps.
   - Reject weak matches with geometric verification.

5. **Constraint-enhanced fusion**
   - Use overlapping trajectory/map regions to estimate the transform between maps.
   - Add constraints near the edge of the prior map where drift accumulated.
   - Fuse maps into a more accurate global structure.

6. **Output**
   - Publish current local odometry, map state, degeneracy state, and global map correction when available.

## Mathematical Mechanics

The LIO update can be represented as:

```text
x_k = f(x_k-1, u_imu) + noise
z_lidar = h(x_k, M_active) + noise
```

The iterated ESKF update repeatedly linearizes LiDAR residuals:

```text
r_i = n_i^T ( R_k p_i + t_k - q_i )
delta_x* = arg min_delta sum_i rho(|| r_i + H_i delta_x ||^2)
```

Degeneracy can be judged from the update information/covariance. In generic terms:

```text
P_update or H^T R^-1 H -> eigenvalues / singular values
```

If uncertainty grows beyond a threshold for a sustained duration, the system marks over-degeneracy:

```text
over_degenerate = max_eigen(P_pose) > tau for T seconds
```

Map fusion introduces inter-map constraints:

```text
T_ab* = arg min_T sum_j rho( d( T * p_j^a, M_b )^2 )
```

Then a pose graph can optimize local trajectory segments and map-frame transforms:

```text
Y* = arg min_Y
    sum_lio       || r_lio(y_i, y_j) ||^2
  + sum_loop      rho(|| r_scan_context(y_a, y_b) ||^2)
  + sum_map_edge  rho(|| r_overlap(T_ab, M_a, M_b) ||^2)
```

The distinctive part is the map lifecycle policy: active maps, sleeping maps, and delayed fusion.

## Assumptions

- The degeneracy detector is conservative enough to trigger before severe map corruption.
- IMU propagation remains usable across the degraded interval.
- A new map can be initialized after observability returns.
- Sleeping and active maps eventually share recognizable overlap.
- Scan Context descriptors remain discriminative in repeated structures.
- The platform can tolerate local map switching and later global correction.
- Dynamic-object filtering is good enough that overlapping regions represent static structure.

## Strengths

- Addresses a real failure mode in LIO: continuing to map while observability has collapsed.
- Keeps degraded intervals from poisoning the whole map.
- Works with LiDAR-IMU hardware already common on robots and AVs.
- Scan Context gives a lightweight inter-map recognition mechanism.
- Map fusion can recover consistency after temporary localization loss.
- The concept is easy to combine with FAST-LIO2, LIO-SAM, GLIM, MOLA, or other LIO front ends.

## Limitations

- Reinitialization does not magically provide accurate pose through the degenerate interval.
- If there is no overlap after recovery, map segments may remain disconnected.
- Scan Context can alias in repeated corridors, parking levels, or apron service roads.
- Threshold-based degeneracy logic can oscillate if not hysteretic.
- Pose discontinuities need careful handling by planning/control.
- Map fusion can be wrong if dynamic objects dominate overlap.
- It remains LiDAR-dependent and does not solve fog, heavy spray, or severe dust alone.

## Datasets and Benchmarks

MM-LINS uses both public datasets with induced/observed degeneracy and real-world indoor/outdoor experiments. The official repository references:

- **M2DGR:** multi-sensor ground robot sequences.
- **NCLT:** long-term campus robot dataset.
- **UTBM Robocar:** urban driving dataset with multi-sensor data.
- **UrbanLoco:** urban localization sequences.
- **Author indoor/outdoor bags:** field data for over-degenerate conditions.

Additional useful tests:

- Long featureless tunnels and corridors.
- Warehouses with repeated aisles.
- Open apron loops with sparse vertical structure.
- Smoke/fog/dust LiDAR degradation intervals.
- Synthetic occlusion intervals where only IMU propagation remains.

Metrics:

- Degeneracy detection precision/recall.
- Drift before and after map sleeping.
- Reinitialization latency.
- Map fusion success rate and false-positive rate.
- ATE/RPE by segment and across fused maps.
- Map edge consistency at overlap boundaries.
- Number and duration of disconnected maps.

## AV Relevance

MM-LINS is relevant to AV localization because overconfidence during degeneracy is dangerous. A system that can explicitly mark a map as untrustworthy, suspend mapping, and resume later is more operationally honest than one that keeps integrating bad scans.

For AVs, MM-LINS should be augmented with:

- Wheel odometry and nonholonomic constraints.
- GNSS/RTK where valid.
- Radar or camera aiding in LiDAR-degraded zones.
- A supervisor that slows or stops the vehicle when local pose is disconnected from the global map.
- A map-quality flag that prevents corrupted segments from entering the production HD map.

## Indoor/Outdoor Relevance

**Indoor:** Very strong fit for corridors, tunnels, hospitals, warehouses, mines, and parking structures. Repeated geometry and temporary occlusion are common.

**Outdoor:** Useful in urban canyons, service roads, ports, campuses, and apron zones, especially where LiDAR geometry alternates between rich and sparse.

**Mixed indoor/outdoor:** Strong for transitions through doors, covered roads, terminal underpasses, and hangar exits where sensor observability changes sharply.

## Airside Deployment Notes

Airside environments include both rich structure and severe degeneracy:

- Terminal walls, poles, gates, and signs provide strong LiDAR constraints.
- Open apron areas can be sparse and planar.
- Aircraft fuselages create large smooth surfaces and occlusions.
- Wet tarmac and weather artifacts can reduce useful returns.
- Dynamic GSE can dominate local scans during turns and stand operations.

MM-LINS-like behavior is useful as a map lifecycle policy:

- Mark open-apron traversal as weakly constrained when geometry is insufficient.
- Avoid adding temporary aircraft/GSE geometry to persistent maps.
- Sleep a local map before it becomes corrupted.
- Resume mapping at terminal/stand structure.
- Fuse back when a known gate, pole cluster, curb, or terminal facade is revisited.

It should not be the only recovery mechanism. Airside stacks need RTK/GNSS, wheel odometry, radar, surveyed landmarks, and operational slow/stop rules.

## Validation Checklist

- Tune degeneracy thresholds on held-out routes, not only author demos.
- Verify that map sleeping triggers before visible map bending.
- Test false positives: good geometry should not repeatedly fragment maps.
- Test false negatives: corridors and open planes should be detected.
- Validate Scan Context loop candidates with geometric checks.
- Log all map state transitions with timestamps and pose uncertainty.
- Confirm downstream consumers handle pose jumps and map-frame changes.
- Compare against FAST-LIO2/LIO-SAM baseline without multi-map logic.
- Run dynamic-object stress tests with people, vehicles, and temporary occluders.

## Sources

- Ma et al., "MM-LINS: a Multi-Map LiDAR-Inertial System for Over-Degenerate Environments," arXiv, 2025: https://arxiv.org/abs/2503.19506
- Official MM-LINS implementation: https://github.com/lian-yue0515/MM-LINS
- MMLOAM related multi-LiDAR-inertial implementation: https://github.com/TIERS/multi-modal-loam
- FAST-LIO2 baseline: https://github.com/hku-mars/FAST_LIO
- Scan Context place recognition: https://github.com/gisbi-kim/scancontext
