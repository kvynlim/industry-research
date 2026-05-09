# Radar Teach-Repeat Localization

## Summary

Radar teach-repeat localization lets a robot record a route during a teaching pass and later repeat that route using radar-based localization against the taught experience. It is route-following localization, not general radar odometry. Radar odometry estimates frame-to-frame motion from live radar scans; radar teach-repeat localizes the live robot to a stored route graph or taught keyframes and uses that relative pose to follow the route.

Recent systems include Radar Teach and Repeat, CFEAR-Teach-and-Repeat, and cross-modal LiDAR Teach, Radar Repeat. VT&R3 provides the broader teach-and-repeat software architecture with radar and radar-LiDAR pipeline support.

## What It Is

Teach-and-repeat navigation separates route learning from route execution:

- **Teach:** drive a route while building a graph of keyframes, path geometry, and local sensor data.
- **Repeat:** localize against the taught graph and track the route without requiring global GNSS or a full global HD map.

Radar teach-repeat replaces or augments the usual camera/LiDAR localization sensor with radar. It is especially relevant when the repeat phase must work in dust, fog, smoke, rain, snow, darkness, or vegetation/scene changes that degrade optical sensors.

## Core Idea

The system stores radar experiences along a route, then localizes each live radar scan against nearby taught keyframes and/or recent live keyframes. CFEAR-TR uses sparse oriented surface points from Doppler-compensated spinning radar measurements and aligns live scans jointly to stored scans and a sliding window of live keyframes. Radar Teach and Repeat integrates radar localization into a full closed-loop route-following system. Cross-modal LiDAR Teach, Radar Repeat teaches with precise LiDAR structure and repeats with 4D millimeter-wave radar for degraded conditions.

The important distinction from radar odometry:

- Radar odometry can drift indefinitely because it integrates live scan-to-scan motion.
- Radar teach-repeat constrains motion to a taught route and estimates relative pose to stored route experiences.
- It may use radar odometry internally, but the navigation objective is repeatable path following.

## Inputs and Outputs

| Item | Role |
|---|---|
| Taught route graph | Keyframes, path geometry, and traversal topology. |
| Stored radar scans or radar features | Localization reference during repeat. |
| Live radar scans | Current observations for route-relative localization. |
| IMU/gyro/wheel odometry | Short-term motion prior and controller support. |
| Optional LiDAR teach map | Used in cross-modal LiDAR-teach/radar-repeat systems. |
| Relative pose to route | Lateral, longitudinal, yaw, and sometimes full SE(3) correction. |
| Path-tracking command | Steering/speed command or pose target for the controller. |
| Localization health | Match score, inlier count, route ambiguity, and covariance. |

## Pipeline

1. **Teach pass**
   - Drive the intended route manually or under supervised autonomy.
   - Record radar scans, odometry, IMU, route topology, and controller-relevant path geometry.

2. **Experience graph construction**
   - Select keyframes and store local radar representations.
   - Add odometric edges, loop closures, and route branches if the framework supports a network.

3. **Repeat initialization**
   - Start near a known route segment or use retrieval to identify the current place.
   - Initialize the live robot relative to the taught graph.

4. **Radar localization**
   - Align live radar scans to nearby taught keyframes.
   - Optionally align to recent live keyframes for short-term consistency.
   - Reject ambiguous or low-inlier matches.

5. **Route tracking**
   - Convert route-relative pose into path-following commands.
   - Use gyro/wheel/IMU for smooth control between radar updates.

6. **Experience management**
   - Add new experiences when route appearance changes.
   - Retain enough seasonal/weather diversity to avoid overfitting one teach run.

## Strengths

- Works without global GNSS on previously taught routes.
- Radar is robust to darkness, dust, smoke, fog, rain, and some vegetation/appearance changes.
- Route-relative localization can be easier than full global map localization.
- Taught graph limits search space and reduces false global matches.
- CFEAR-style oriented surface points make radar scans more registration-friendly.
- Cross-modal teaching can exploit high-quality LiDAR in good conditions and radar in degraded repeat conditions.

## Failure Modes

- The robot must remain on or near taught routes; it is not an open-world planner by itself.
- Open areas with weak radar reflectors can produce poor route-relative constraints.
- Specular radar landmarks can change with approach angle, wet surfaces, metal objects, and multipath.
- Repeated gates, service roads, rows of poles, or similar off-road corridors can cause route aliasing.
- Dynamic objects can dominate radar returns during repeat.
- Structural changes along the route can invalidate stored experiences.
- A route taught in one sensor configuration may not transfer cleanly after radar firmware, mounting, or calibration changes.
- Cross-modal LiDAR-teach/radar-repeat needs careful representation alignment between LiDAR structure and radar observability.

## Airside/AV Fit

Radar teach-repeat is well matched to fixed operational routes: depot-to-stand routes, baggage loops, perimeter roads, snow-removal paths, and service corridors. Airports often need repeatable path following in adverse weather and at night, and a taught-route system can reduce dependency on global GNSS in terminal-adjacent multipath.

Airside recommendations:

- Teach routes in multiple stand occupancy states and weather conditions.
- Avoid relying on aircraft surfaces as route landmarks.
- Add fixed radar-observable landmarks where open-apron structure is insufficient and operations allow it.
- Use route health metrics to slow or stop when radar localization is weak.
- Keep route graphs versioned with airport construction and operational changes.
- Fuse radar teach-repeat with wheel odometry, IMU, LiDAR/GNSS when healthy, and geofenced route constraints.

For road AVs, radar teach-repeat is most useful for constrained routes, depots, mines, ports, campuses, agriculture, and low-speed autonomy. It is less suitable for arbitrary urban driving where the vehicle must choose new routes dynamically.

## Implementation Notes

- Store raw scans or reprocessable features so route maps can be regenerated after algorithm updates.
- Keep teach and repeat calibration metadata; radar mounting and timing changes affect localization.
- Build explicit route-version management and operational rollback.
- Use local route-relative metrics in addition to global ATE: lateral error, heading error, along-track error, intervention rate, and path-tracking RMSE.
- Test route segments with decreasing structure, not only visually distinctive areas.
- Keep radar odometry, route localization, and path-tracking health separate in telemetry.
- Treat radar teach-repeat as a route autonomy layer inside a broader safety system, not as a complete perception stack.

## Sources

- CFEAR-Teach-and-Repeat: https://arxiv.org/abs/2603.06501
- Radar Teach and Repeat: https://arxiv.org/abs/2409.10491
- LiDAR Teach, Radar Repeat: https://arxiv.org/abs/2605.02809
- VT&R3 official repository: https://github.com/utiasASRL/vtr3
- Local context: [radar odometry and radar SLAM](radar-odometry-radar-slam.md), [radar-inertial odometry](radar-inertial-odometry.md), [radar-LiDAR-inertial fusion](radar-lidar-inertial-fusion.md)
