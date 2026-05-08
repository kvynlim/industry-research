# Radar Odometry and Radar SLAM

Related docs: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md), [SLAM benchmarking](benchmarking-metrics-datasets.md), [loop closure and place recognition](loop-closure-place-recognition.md), [factor graphs and iSAM2](factor-graph-isam2-gtsam.md), and [robust state estimation](../overview/robust-state-estimation-multi-sensor.md).

## Executive Summary

Radar odometry and radar SLAM estimate ego-motion and build maps using automotive or scanning radar returns. Radar is sparse, noisy, specular, and harder to interpret than LiDAR, but it measures through darkness, dust, fog, rain, smoke, and many airborne obscurants that degrade cameras and LiDAR. Modern 4D radars also provide elevation and per-detection Doppler velocity, making radar uniquely valuable for adverse-weather autonomy.

This file covers radar-only odometry/SLAM as a method family. It includes classical polar radar image registration, keypoint-based radar odometry, CFEAR-style oriented surface point registration, learning-based radar keypoints, and pose-graph radar SLAM. Radar-only systems are most mature with high-resolution spinning FMCW radars such as Navtech units used in Oxford Radar RobotCar, MulRan, and Boreas. Low-cost automotive 3D/4D radars are improving quickly but remain sparse and more difficult for pure scan matching.

For autonomous vehicles, radar-only odometry is best treated as an adverse-weather fallback and a complementary factor, not the sole localization source. It can preserve motion observability when cameras or LiDAR fail, but production-grade localization still needs IMU, wheel odometry, map priors, GNSS/RTK when valid, and robust fusion.

## Historical Context

Early automotive radar was mainly used for object detection and adaptive cruise control, not SLAM. It provided range, azimuth, and Doppler for a small number of targets, with poor angular resolution and heavy multipath. High-resolution scanning FMCW radars changed the research landscape by producing dense 360-degree polar intensity images. The Oxford Radar RobotCar Dataset made this data widely available and triggered a wave of radar odometry and radar place-recognition work.

Several method families emerged:

- **Image registration:** Convert polar radar images to Cartesian or log-polar form and estimate motion using phase correlation or Fourier-Mellin techniques.
- **Keypoint methods:** Detect repeatable radar landmarks and match descriptors across scans.
- **Learning-based keypoints:** Learn keypoint locations, scores, and descriptors directly for odometry and metric localization, as in "Under the Radar."
- **Sparse oriented-point registration:** Filter radar returns into surface-like points and solve scan matching with robust point-to-line or point-to-surface costs, as in CFEAR.
- **Radar SLAM back ends:** Add keyframes, submaps, loop closure, and pose-graph optimization.

The field is now shifting toward 4D imaging radar, radar-inertial odometry, and radar-LiDAR-inertial fusion because Doppler and elevation improve observability beyond 2D scanning radar intensity images.

## Sensor Assumptions

Radar odometry systems vary significantly by radar type.

Common radar inputs:

- Polar intensity images from high-resolution scanning FMCW radar.
- CFAR detections or radar point clouds.
- Range, azimuth, and sometimes elevation.
- Doppler radial velocity for automotive FMCW and 4D imaging radar.
- Radar cross section or intensity.

Assumptions:

- Static structures produce repeatable returns over time.
- Radar extrinsics and timestamps are known.
- Multipath and sidelobes can be filtered or robustly downweighted.
- Dynamic objects do not dominate the static-scene registration.
- The radar has enough angular resolution for the intended odometry accuracy.
- Vehicle motion during a radar sweep can be compensated or is slow enough to ignore.

For airside autonomy, radar observability depends heavily on static reflectors: buildings, poles, fences, signs, parked infrastructure, terminal facades, service-road edges, and large vertical structures. A completely open apron with few reflectors can be weak for scan matching even though radar remains weather-robust.

## State/Map Representation

Radar-only methods typically estimate planar SE(2) motion for ground vehicles when using 2D spinning radar, or full SE(3) motion when using 4D radar point clouds and a suitable estimator.

Common map representations:

- Polar radar image keyframes.
- Cartesian radar intensity grids.
- Sparse keypoints and descriptors.
- Oriented surface points from filtered radar returns.
- Local submaps of radar detections.
- Pose graphs with odometry and loop-closure edges.
- Radar reflectivity maps for metric localization.

The map is not a dense geometric map in the LiDAR sense. Radar returns depend on material, aspect angle, incidence, multipath, and radar processing. A radar map should be treated as a reflectivity/observability map rather than a literal surface model.

## Algorithm Pipeline

1. **Radar preprocessing**
   - Decode polar radar scans, range-Doppler detections, or radar point clouds.
   - Remove near-field artifacts, sidelobes, ego-vehicle reflections, and low-confidence detections.
   - Apply CFAR, strongest-return filtering, Cartesian conversion, or azimuth-wise filtering.

2. **Feature or surface extraction**
   - Extract keypoints/descriptors from radar images, or
   - Convert detections into oriented surface points, or
   - Build a local radar occupancy/reflectivity grid.

3. **Motion compensation**
   - Compensate sweep distortion if the radar scan is not instantaneous.
   - Use a motion prior from the previous odometry, wheel odometry, or IMU if available.

4. **Scan registration**
   - Match keypoints, align images, or minimize point-to-line/point-to-surface residuals.
   - Use robust losses to suppress dynamic returns and multipath.

5. **Keyframe/submap management**
   - Insert accepted scans into a local history or submap.
   - Register the newest scan to multiple recent keyframes to reduce drift.

6. **Loop closure and graph optimization**
   - Detect revisits using radar descriptors or learned retrieval.
   - Verify candidate loops geometrically.
   - Optimize the pose graph and update the radar map.

7. **Output**
   - Radar odometry, radar map, loop closures, and health metrics.

## Formulation

CFEAR-style radar odometry filters radar returns and estimates motion by registering oriented surface points. A simplified scan-to-map objective is:

```text
T* = arg min_T sum_i rho( d_line(T * p_i, L_i)^2 )
```

where `p_i` is a filtered radar point, `L_i` is a local line or oriented surface element from the keyframe history, and `rho` is a robust loss such as Huber.

Image-registration methods estimate planar shifts and rotations by correlating radar images:

```text
delta_x, delta_y, delta_yaw = phase_correlation(I_t, I_ref)
```

Learning-based keypoint methods optimize keypoint detection and matching for odometry:

```text
T* = motion_solver( match( f_theta(I_t), f_theta(I_ref) ) )
```

Radar SLAM adds pose-graph constraints:

```text
X* = arg min_X sum_odom || e_ij(X_i, X_j, Z_ij) ||_Omega^2
              + sum_loop || e_lm(X_l, X_m, Z_lm) ||_Omega^2
```

The defining challenge is that radar residuals are not simple geometric distances to true surfaces. They are measurements of electromagnetic reflectivity, so outlier modeling is central rather than optional.

## Failure Modes

- **Multipath and ghost returns:** Aircraft fuselages, terminal glass, wet ground, fences, and metal equipment can create false structures.
- **Specular aspect dependence:** A good landmark from one approach angle may disappear from another.
- **Sparse or weak static returns:** Open aprons, flat roads, fields, and tunnels with smooth walls may not provide enough distinct radar structure.
- **Dynamic clutter:** Cars, buses, aircraft, GSE, pedestrians, and baggage carts create strong returns that can overpower static landmarks.
- **Radar interference:** Multiple radars operating nearby can raise noise or create artifacts.
- **Sweep distortion:** Spinning radar scans over time; vehicle motion during a sweep can bias registration.
- **Poor elevation observability:** 2D scanning radar cannot distinguish overhanging structures, ground clutter, and vertical layout.
- **Ambiguous repeated structure:** Similar gates, poles, service roads, and barriers can create false loops.
- **Weather is not free:** Radar is robust to many weather conditions, but heavy wet surfaces, standing water, and precipitation clutter can still change returns.
- **Calibration/timing errors:** Radar-to-vehicle extrinsics and timestamps strongly affect scan matching and map consistency.

## AV Relevance

Radar odometry is relevant because it provides a sensing mode that remains available when camera and LiDAR confidence drops. For AVs, its strongest roles are:

- Adverse-weather fallback odometry.
- Cross-check against LiDAR/camera localization.
- Velocity and motion observability when visual features are unavailable.
- Radar-reflectivity map localization in known routes.
- Place recognition under lighting and weather changes.

Radar-only SLAM is not yet a complete production AV localization solution. It lacks LiDAR-like dense geometry, struggles with multipath, and can be overconfident in open or repetitive scenes. The production pattern should be:

```text
radar odometry / radar SLAM factor
  -> robust sensor-fusion backend
  -> health monitoring and covariance inflation
  -> map, IMU, wheel, GNSS, and LiDAR/camera cross-checks
```

## Indoor/Outdoor Relevance

**Indoor:** Radar can work in smoke, dust, and low light, but indoor multipath is severe. Corridors, metal racks, glass, and tight spaces can produce ghosts. Short-range 4D radar may be more useful than long-range scanning radar indoors.

**Outdoor:** Strong fit for roads, campuses, yards, ports, mines, farms, and airports where weather and lighting robustness matter. High-resolution spinning radar performs well on structured routes with buildings, poles, parked vehicles, and barriers.

**Mixed indoor/outdoor:** Radar is attractive for tunnels, covered roads, hangars, and terminal-adjacent areas where lighting and weather change abruptly. The map must handle multipath and scene-dependent reflectivity changes.

## Airside Deployment Notes

Radar is especially relevant airside because operations continue through darkness, rain, fog, mist, dust, and de-icing spray. See the hardware discussion in [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md).

Airside deployment notes:

- Use radar as an availability layer, not as the only pose source.
- Build radar maps from multiple passes, directions, weather states, and stand occupancy states.
- Treat aircraft as dynamic unless operations explicitly mark them as permanent obstacles.
- Add static reflectors or infrastructure landmarks where apron observability is weak.
- Monitor multipath near aircraft, terminal glass, blast fences, and wet pavement.
- Use wheel odometry and IMU to constrain low-speed GSE motion.
- Gate loop closures aggressively near repeated gates and stands.
- Report radar health separately from LiDAR/camera health.

Radar can materially improve safe holdover time when LiDAR/cameras degrade, but a false confident radar pose near aircraft is still unacceptable. The estimator must know when radar geometry is weak.

## Datasets/Metrics

Primary datasets:

- **Oxford Radar RobotCar:** Navtech scanning radar, road-route revisits, adverse weather and long-term conditions.
- **MulRan:** radar and LiDAR sequences for urban routes and place recognition.
- **Boreas:** multi-season driving with Navtech radar, LiDAR, cameras, and centimeter-grade reference poses.
- **RADIATE:** radar, LiDAR, camera, and GPS/IMU data across weather and traffic conditions.
- **Coloradar:** 4D radar, LiDAR, cameras, IMU, and ground truth for radar perception and odometry research.

Metrics:

- Relative Pose Error by distance and time.
- KITTI-style translation and rotation drift for driving routes.
- ATE after stated alignment.
- Loop-closure precision/recall and false positives per kilometer.
- Scan-matching inlier ratio and residual distribution.
- Availability under rain, fog, snow, dust, night, and glare.
- Runtime mean/P95/P99 on target compute.
- Drift during sensor degradation of LiDAR/camera.

Airside-specific metrics should include open-apron drift, stand-revisit ambiguity, radar-map stability with aircraft present/absent, wet-ground performance, and safe fallback duration.

## Open-Source Implementations

- **CFEAR Radarodometry:** learning-free radar odometry based on conservative filtering and robust oriented-point registration; commonly used as a radar odometry baseline.
- **Under the Radar:** learning-based radar keypoint and descriptor framework for radar odometry and metric localization on Oxford Radar RobotCar.
- **Oxford Radar RobotCar SDK/dataset tools:** useful for loading Navtech radar data and benchmark trajectories.
- **MulRan dataset tooling:** radar/LiDAR place-recognition and odometry research ecosystem.
- **Boreas development tools:** useful for radar/LiDAR/camera odometry evaluation with high-quality reference poses.
- **STEAM-ICP radar modes:** provides continuous-time radar-only and radar-inertial odometry variants in a maintained research codebase.

Open-source maturity varies. Many radar SLAM papers provide research code or dataset scripts rather than production ROS2 packages. Before adoption, verify license, ROS version, sensor driver compatibility, and support for the target radar.

## Practical Recommendation

Use radar odometry/radar SLAM as an adverse-weather research and fallback capability. For outdoor AVs and airside vehicles, evaluate CFEAR-style radar odometry and modern 4D radar pipelines on the same routes used for LiDAR localization, then fuse radar as a factor with honest covariance.

Do not deploy radar-only SLAM as the primary localization stack unless the route has been specifically engineered and validated for radar observability. The practical production direction is radar-inertial or radar-LiDAR-inertial fusion, not standalone radar SLAM.

## Sources

- Barnes, D. and Posner, I. "Under the Radar: Learning to Predict Robust Keypoints for Odometry Estimation and Metric Localisation in Radar." ICRA 2020. https://arxiv.org/abs/2001.10789
- Adolfsson, D. et al. "CFEAR Radarodometry - Conservative Filtering for Efficient and Accurate Radar Odometry." IROS 2021. https://arxiv.org/abs/2105.01457
- Adolfsson, D. et al. "Lidar-level localization with radar? The CFEAR approach to accurate, fast and robust large-scale radar odometry in diverse environments." https://arxiv.org/abs/2211.02445
- Oxford Radar RobotCar Dataset. https://ori.ox.ac.uk/datasets/radar-robotcar-dataset
- MulRan Dataset. https://sites.google.com/view/mulran-pr/dataset
- Boreas Dataset. https://www.boreas.utias.utoronto.ca/
- RADIATE Dataset. https://pro.hw.ac.uk/radiate/
- Local context: [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md)

