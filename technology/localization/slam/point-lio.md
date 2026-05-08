# Point-LIO

## Executive Summary

Point-LIO is a high-bandwidth LiDAR-inertial odometry method that updates the state at individual LiDAR point timestamps instead of waiting for a full scan. Its main contribution is latency and motion bandwidth: the paper and repository report 4-8 kHz odometry output, robustness to severe vibration, and experiments with angular velocity around 75 rad/s. This makes Point-LIO important for aggressive UAVs, fast spinning robots, and control loops that need very fresh odometry.

For airside autonomous ground vehicles, Point-LIO is usually more specialized than necessary. Ground support equipment moves slowly compared with racing drones, and a robust 10-100 Hz scan-level LIO front end is usually adequate. Point-LIO is still worth documenting because its point-by-point formulation removes artificial in-scan motion distortion and because its stochastic-process-augmented IMU model addresses saturation and vibration regimes that standard LIO can mishandle. Related stack context is in [Modern LiDAR SLAM and Odometry Algorithms](../lidar-slam-algorithms.md), [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md), and [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Historical Context

Point-LIO was published in Advanced Intelligent Systems in 2023 by He, Xu, Chen, Kong, Yuan, and Zhang from the same HKU MARS Lab lineage as FAST-LIO and FAST-LIO2. It responds to a limitation of scan-batch LIO: even if the estimator itself is fast, a spinning LiDAR scan may represent tens of milliseconds of motion, and the system usually outputs only one odometry update per scan or packet group.

FAST-LIO2 already removed feature extraction and made direct raw-point LIO practical. Point-LIO pushes the idea further by treating each point as a measurement event. Instead of deskewing a scan as a preprocessing step and then solving one scan-to-map update, it performs a small EKF update as points arrive.

The method is best understood as a high-bandwidth filter design, not a graph SLAM system. It does not replace a global backend; it is an aggressive-motion odometry front end.

## Sensor Assumptions

Point-LIO requires accurate LiDAR point timestamps. The repository explicitly warns that a missing point `time` field matters because the system processes at each LiDAR point's sampling time. For Livox sensors, the repository recommends the custom Livox message path because it exposes per-point time.

The method assumes tight LiDAR-IMU synchronization, known extrinsic calibration, and known IMU saturation limits. The configuration includes IMU accelerometer and gyroscope saturation parameters and acceleration norm settings. The README recommends setting extrinsic estimation off when a trusted extrinsic is given.

Supported sensors in the repository include Livox serial LiDARs and examples for Velodyne/Ouster-style PointCloud2 data when timestamp units, scan lines, topics, and extrinsics are configured correctly. The repository also mentions a no-IMU mode, but the method's core contribution is LiDAR-inertial fusion, so no-IMU operation should be treated as a degraded fallback rather than the intended mode.

## State/Map Representation

Point-LIO uses an EKF state on a manifold and augments the motion model compared with conventional LIO. The paper describes a stochastic-process-augmented kinematic model that treats IMU measurements as outputs rather than simply as direct inputs to be integrated.

A simplified view is:

```text
Nominal state:
  pose and velocity
  IMU biases
  gravity
  motion terms used to model high-bandwidth angular/linear motion

Map:
  incremental point map used for nearest-neighbor and local-plane residuals
  maintained online, similar in spirit to FAST-LIO-family maps

Update unit:
  one LiDAR point or a very small point group, not one full scan
```

The important distinction is temporal. In scan-based LIO, the state is updated once per scan after point accumulation and deskewing. In Point-LIO, the estimator state is propagated and corrected at point timestamps, so the map and odometry stream track intra-scan motion directly.

## Algorithm Pipeline

1. Receive high-rate IMU samples and sequential LiDAR points with timestamps.
2. Propagate the state from the last update time to the current point time.
3. Transform the current LiDAR point into the map frame using the current state and extrinsics.
4. Search the local map for neighboring points.
5. Fit or retrieve a local plane and compute a point-to-plane residual.
6. Run a small EKF update for the current point measurement.
7. Publish odometry at high rate, optionally throttled to avoid overwhelming downstream ROS/TF consumers.
8. Insert accepted points into the map according to downsampling and map management rules.

Because each point is handled at its own timestamp, there is no separate full-scan motion compensation step in the usual sense. Motion distortion is removed by construction if timestamps, IMU propagation, and extrinsics are correct.

## Formulation

The point measurement residual follows the direct LIO family:

```text
r_i(x_t) = n_i^T * (T(x_t) * p_i - q_i)

p_i   : LiDAR point sampled at time t
x_t   : state propagated to time t
n_i   : normal of local map plane
q_i   : point on local map plane
T(.)  : pose transform from LiDAR frame to map frame
```

The EKF update is small because one point contributes one scalar residual. This allows high output frequency even though the total point rate can be very high.

The distinctive model is the stochastic-process-augmented kinematic model. Rather than assuming IMU readings are always within range and usable as direct integration inputs, the model accounts for aggressive motions and IMU saturation by modeling IMU measurement behavior more explicitly. In practice, this is why the implementation asks for saturation limits and why the paper emphasizes robustness when IMU measurements saturate mid-motion.

Point-LIO is still a local estimator. It does not solve:

```text
global pose graph + loop closure + map versioning + GNSS/wheel factors
```

Those belong in a backend such as the graph stack described in [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md).

## Failure Modes

- Missing per-point timestamps invalidate the point-by-point update premise.
- LiDAR/IMU time offset causes high-rate but systematically wrong updates.
- Wrong IMU saturation limits can make aggressive-motion handling unreliable.
- Extrinsic errors are especially damaging because they affect every point update.
- Processing every point can overload CPU, ROS, TF, or logging if output is not throttled.
- Repetitive or flat scenes still create geometric degeneracy; high update rate does not create new observability.
- Dynamic objects can be inserted into the map unless filtered.
- No loop closure means long-term drift remains.
- Downstream controllers may not need or safely consume kHz odometry unless the whole timing architecture is designed for it.
- Noisy individual point residuals can make the estimator sensitive to outlier handling and map quality.

## AV Relevance

Point-LIO is most relevant to AV subproblems that need low-latency state updates: high-speed off-road platforms, small robots, drones, vibration-heavy platforms, and tightly coupled perception-control loops. It can also be a diagnostic reference for understanding how much latency is introduced by scan accumulation in conventional LIO.

For road or airside ground AVs, the relevance is narrower. A vehicle moving at 10 km/h moves about 28 cm during a 100 ms scan; good deskewing and a 50-100 Hz estimator are usually sufficient. The main AV lesson from Point-LIO is not that every ground vehicle needs kHz odometry, but that timestamp fidelity and high-bandwidth inertial modeling matter when motion violates scan-level assumptions.

## Indoor/Outdoor Relevance

Indoors, Point-LIO is useful for handheld, UAV, and fast-moving platforms that rotate quickly near walls, shelves, columns, and equipment. It reduces scan tearing when the sensor undergoes rapid angular acceleration.

Outdoors, it is most useful for aggressive UAVs, rapid rotations, and severe vibration. It does not automatically solve sparse outdoor geometry, long straight highways, or open apron degeneracy. In open scenes, it still needs enough stable map structure to define point-to-plane residuals.

## Airside Deployment Notes

Point-LIO should not be the first-choice airside localization method for slow GSE. Its computational and integration complexity is hard to justify when standard LIO plus wheel odometry, RTK, and map matching provide enough latency.

It may be worth evaluating for special airside cases:

- Vehicles with severe mechanical vibration affecting IMU readings.
- Emergency braking or impact-like jerk events where scan-level deskewing fails.
- Small inspection drones operating in hangars or around aircraft.
- Sensor rigs with high angular motion during calibration or survey operations.

If used on airside ground vehicles, publish a downsampled odometry stream for the main fusion stack while retaining high-rate internal states for diagnostics. Add map outlier filtering for moving aircraft, belt loaders, tugs, and personnel. Keep a robust backend in control of absolute pose and map frame consistency.

## Datasets/Metrics

The paper reports high-frequency odometry at 4-8 kHz, bandwidth above 150 Hz, aggressive motion with angular velocity around 75 rad/s, and benchmark comparisons on 12 sequences from open LiDAR datasets. The repository provides example datasets for aggressive motions, racing drone operation, and a self-rotating UAV.

Useful metrics include:

- ATE/RPE against benchmark or motion-capture ground truth.
- Odometry output frequency and end-to-end latency.
- Motion bandwidth from controlled excitation tests.
- Performance under IMU saturation.
- Map tearing or ghosting during fast rotations.
- CPU load per point and total CPU budget.
- Failure rate with missing timestamps or degraded synchronization.

For airside testing, focus less on kHz headline rate and more on whether Point-LIO improves pose availability during vibration, abrupt stops, and GNSS-denied segments compared with FAST-LIO2.

## Open-Source Implementations

- `hku-mars/Point-LIO`: primary ROS/C++ implementation.
- The repository includes configurations for Livox Avia and Velodyne/Ouster-style setups.
- It depends on ROS, PCL/Eigen-style point cloud infrastructure, and Livox driver paths for Livox data.
- The repository has no release package on GitHub at the time of review and should be treated as research code.

Licensing, maintenance, and dependency review are required before product integration.

## Practical Recommendation

Do not adopt Point-LIO as the default airside ground-vehicle SLAM front end. Use FAST-LIO2 or another scan-level LIO for general odometry, then fuse it with wheel odometry, RTK, and map-matching in a robust estimator.

Keep Point-LIO on the shortlist for aggressive-motion vehicles, UAVs, and vibration-specific experiments. Its per-point formulation is technically valuable, but its operational value depends on whether the platform truly needs kHz state updates and can maintain the timestamp discipline required to make them correct.

## Sources

- He, D., Xu, W., Chen, N., Kong, F., Yuan, C., and Zhang, F. "Point-LIO: Robust High-Bandwidth LiDAR-Inertial Odometry." Advanced Intelligent Systems, 2023. https://hub.hku.hk/handle/10722/331147
- Point-LIO full-text PDF hosted by HKU Scholars Hub. https://hub.hku.hk/bitstream/10722/331147/1/content.pdf
- Original Point-LIO repository and README. https://github.com/hku-mars/Point-LIO
- Local context: [Modern LiDAR SLAM and Odometry Algorithms](../lidar-slam-algorithms.md)
- Local context: [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md)
- Local context: [GTSAM Factor Graph Optimization](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
