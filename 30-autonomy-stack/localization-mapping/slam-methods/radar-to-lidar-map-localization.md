# Radar-to-LiDAR Map Localization

Related docs: [production LiDAR map localization](../overview/production-lidar-map-localization.md), [LiDAR place recognition](../overview/lidar-place-recognition-relocalization.md), [radar teach-and-repeat localization](radar-teach-repeat-localization.md), [radar odometry and radar SLAM](radar-odometry-radar-slam.md), [radar-inertial odometry](radar-inertial-odometry.md), [radar-LiDAR-inertial fusion](radar-lidar-inertial-fusion.md), [4D imaging radar](../../../20-av-platform/sensors/4d-radar.md), and [radar FMCW/MIMO/Doppler](../../../10-knowledge-base/signal-processing/radar-fmcw-mimo-doppler.md).

## Executive Summary

Radar-to-LiDAR map localization asks a practical question: can a vehicle localize using live radar against an existing LiDAR-built map? This is attractive because LiDAR maps are common, precise, and already used by AV localization stacks, while radar is more robust in fog, rain, snow, dust, darkness, and glare. Building and maintaining separate radar maps is expensive, so cross-modal localization tries to reuse LiDAR map infrastructure.

Representative methods include Radar-on-LiDAR, RaLL, learned ICP weighting for radar-LiDAR localization, RoLM/FMCW radar on LiDAR map localization, UnLoc, and the 2026 RLPR radar-to-LiDAR place recognition work. The methods range from classical Monte Carlo localization with radar-to-pseudo-LiDAR translation, to differentiable neural measurement models, to cross-modal place recognition and learned registration weighting.

For AVs and airside autonomy, this is highly relevant as an adverse-weather global localization layer. The main risk is cross-modal mismatch: radar sees multipath, Doppler/RCS-dependent returns, and low-resolution structure, while LiDAR maps encode optical geometry. A robust system needs uncertainty, gating, and fallback rather than blindly treating radar as LiDAR.

## Problem Fit

Radar-to-LiDAR localization fits:

- Existing LiDAR HD maps with no radar map.
- Weather or lighting conditions where LiDAR/camera localization degrades.
- Long-term route repeats in road, port, campus, mine, and airport environments.
- Global relocalization/place recognition under sensor failure.
- Fallback localization during LiDAR partial blockage or fog/spray artifacts.

It is weaker when:

- The LiDAR map has few radar-visible structures.
- Radar multipath dominates the live scan.
- Map changes are large or temporary objects cover the static structure.
- The method was trained on a different radar type and does not generalize.
- High-precision lateral localization is required from radar alone.

## Sensor and Map Model

Inputs:

- Live radar scan, image, point cloud, or BEV raster.
- Prior LiDAR map: 2D occupancy, 3D point cloud, intensity map, semantic map, or BEV raster.
- Optional radar odometry, IMU, wheel odometry, GNSS prior, or particle-filter prior.

Radar measurements may include:

```text
z_R = [range, azimuth, elevation, Doppler, RCS]
```

LiDAR map elements may include:

```text
M_L = { points, planes, voxels, occupancy, intensity, semantic landmarks }
```

The target estimate is usually a local or global pose:

```text
T_map_vehicle = [R, t]
```

Some systems estimate only 2D pose `(x, y, yaw)`, while newer 4D radar/LiDAR methods may support 3D or 6-DoF pose.

## Pipeline Families

### Classical / Probabilistic

1. Convert radar scan to points or pseudo-LiDAR representation.
2. Use radar odometry or IMU/wheel/GNSS for a motion prior.
3. Score candidate poses against the LiDAR map.
4. Update a particle filter, Monte Carlo localization, EKF, or factor graph.

Radar-on-LiDAR is representative: radar data is transformed into a LiDAR-like representation, radar odometry provides a prior, and a measurement model scores radar against a 2D LiDAR map.

### Learned Measurement Model

1. Embed radar and LiDAR map crops into a shared feature space.
2. Evaluate multiple pose offsets or correlations.
3. Produce pose likelihood/regression.
4. Insert the learned measurement into a Kalman filter or sequential estimator.

RaLL is representative: radar and LiDAR-map modalities are embedded jointly, offset hypotheses are evaluated, and the differentiable measurement model is trained with the sequential filter.

### Learned Registration / ICP Weighting

1. Preprocess radar points with a learned weighting network.
2. Downweight artifacts, vehicles, and unhelpful returns.
3. Run radar-to-LiDAR ICP or point-to-map registration.
4. Use the result as a pose factor.

This family keeps an analytical registration core while learning which radar points are trustworthy.

### Cross-Modal Place Recognition

1. Compute radar descriptor from the live scan.
2. Compute/query LiDAR map descriptors.
3. Retrieve candidate places.
4. Refine pose with registration or local measurement scoring.

RLPR is representative of the current direction: train radar and LiDAR branches to align structural features across radar types, with emphasis on zero-shot generalization.

### Universal Multi-Modal Localization

UnLoc-style systems accept LiDAR, radar, and/or camera input and learn a unified localization representation. These are useful as research baselines but require careful validation before safety use.

## Mathematical Mechanics

Bayesian localization:

```text
p(x_t | z_1:t, u_1:t) proportional
    p(z_t | x_t, M_L, radar) *
    integral p(x_t | x_t-1, u_t) p(x_t-1) dx_t-1
```

The hard part is the cross-modal likelihood:

```text
p(z_R | x, M_L)
```

Radar-on-LiDAR approximates this by translating or filtering radar into a map-compatible representation and scoring it against the LiDAR map.

RaLL learns:

```text
phi_R(z_R), phi_L(M_L crop)
score(delta) = similarity(phi_R, shift(phi_L, delta))
```

then uses the score as a differentiable measurement model inside sequential localization.

ICP-style methods solve:

```text
T* = arg min_T sum_i w_i rho( d( T p_i^R, M_L )^2 )
```

where `w_i` may be learned from radar context and `d` is point-to-point, point-to-plane, occupancy, or distance-transform distance.

Place-recognition methods optimize descriptor alignment:

```text
q* = arg max_q sim( f_R(scan_R), f_L(map_crop_q) )
```

then pass the candidate to metric refinement.

## Assumptions

- The LiDAR map contains structures that radar can observe.
- Radar and LiDAR map frames are calibrated to a common vehicle/map frame.
- Radar returns from dynamic objects can be filtered or downweighted.
- Training data covers the radar type, weather, and scene geometry, or the method generalizes.
- The motion prior keeps local registration within convergence basin, unless place recognition is used.
- Map age and construction-zone changes are handled by map lifecycle processes.
- The output likelihood is calibrated enough for fusion with other localization factors.

## Strengths

- Reuses precise LiDAR maps instead of building new radar maps.
- Provides adverse-weather global localization when LiDAR/camera are weak.
- Cross-modal place recognition can recover from odometry drift.
- Learned point weighting can improve classical registration without fully black-boxing the estimator.
- Works with existing AV localization architecture: measurement factor + motion prior.
- Radar can see some structures through obscurants that block LiDAR/camera.

## Limitations

- Radar and LiDAR observe different physics; correspondence is not guaranteed.
- Multipath can align confidently to the wrong map structure.
- Learned methods may fail under sensor/domain shift.
- 2D radar-on-2D maps may ignore height structure important near ramps, curbs, and aircraft.
- Radar angular resolution can limit lateral precision.
- Live radar may see vehicles or aircraft absent from the LiDAR map.
- A good average recall score does not guarantee safety-critical pose covariance calibration.

## Datasets and Benchmarks

Useful datasets:

- **Oxford Radar RobotCar:** long-term radar route repeats; core for Radar-on-LiDAR and radar localization work.
- **MulRan:** radar/LiDAR urban place recognition and localization.
- **Boreas:** seasonal radar/LiDAR/camera/IMU/GNSS data.
- **Coloradar:** 4D radar, LiDAR, camera, IMU, and ground truth.
- **ApolloSouthBay / Perth-WA:** used in UnLoc-style localization evaluation.
- **K-Radar and 4D radar datasets:** useful for radar-type generalization.
- **Custom airside LiDAR maps + live radar:** required for terminal glass/metal, aircraft multipath, open apron, and weather.

Metrics:

- Place-recognition recall at top-K and recall within radius.
- Metric pose error: lateral, longitudinal, yaw, and vertical where applicable.
- Localization availability during adverse weather.
- False positive localization rate under perceptual aliasing.
- Innovation consistency when fused with wheel/IMU/GNSS.
- Registration convergence basin.
- Runtime and map-query latency.
- Cross-radar zero-shot transfer.

## AV Relevance

This family maps cleanly to AV localization architectures:

- LiDAR map remains the governed production map.
- Radar provides a weather-robust measurement against that map.
- Wheel/IMU/GNSS provide motion priors.
- The central estimator fuses radar-to-map likelihoods with other factors.

The production challenge is calibration and monitoring. Radar-to-LiDAR measurements should carry confidence that reflects actual cross-modal uncertainty. A false high-confidence global localization update is worse than no update.

## Indoor/Outdoor Relevance

**Indoor:** Useful in smoke/dust/darkness if a LiDAR map exists, but multipath is severe in metal-rich corridors, warehouses, and hangars.

**Outdoor:** Strongest fit for roads, ports, campuses, mines, airports, and yards where LiDAR maps already exist.

**Mixed indoor/outdoor:** Useful at transitions where GNSS drops and LiDAR/camera may degrade. Needs separate tuning for enclosed multipath and open sparse areas.

## Airside Deployment Notes

Airside is a compelling but difficult use case:

- A LiDAR HD map can represent terminal edges, stand markings, poles, signs, curbs, and service roads.
- Radar can localize against this map in rain, fog, night, and de-icing spray.
- Aircraft, wet ground, jet bridges, fences, and terminal glass create strong multipath and transient returns.
- Open apron areas may lack enough stable radar-visible map structure.

Recommended pattern:

- Use radar-to-LiDAR localization as a global fallback factor.
- Constrain updates with wheel/IMU prediction and map-zone priors.
- Add surveyed radar reflectors or radar-visible landmarks in open zones if allowed.
- Reject aircraft and temporary GSE as map correspondences unless explicitly modeled.
- Validate with active aircraft, wet tarmac, night lighting, precipitation, and seasonal operations.

## Validation Checklist

- Build a LiDAR map with explicit static/dynamic filtering.
- Verify radar-LiDAR extrinsics and map frame alignment.
- Test radar point/BEV preprocessing across weather and sensor temperatures.
- Measure false localizations in repeated terminal/stand structures.
- Evaluate with dynamic aircraft and GSE not present in the map.
- Calibrate output covariance or likelihood scores against real errors.
- Test cross-radar and firmware changes if learned features are used.
- Compare against LiDAR-to-LiDAR localization, radar-only localization, and GNSS/RTK.
- Run long-term route repeats in different weather and lighting.
- Validate safe behavior when radar-to-map confidence collapses.

## Sources

- Yin, Wang, Tang, Xiong, "Radar-on-Lidar: metric radar localization on prior lidar maps," arXiv, 2020: https://arxiv.org/abs/2005.04644
- Yin, Chen, Wang, Xiong, "RaLL: End-to-end Radar Localization on Lidar Map Using Differentiable Measurement Model," arXiv/T-ITS, 2020/2021: https://arxiv.org/abs/2009.07061
- Lisus et al., "Pointing the Way: Refining Radar-Lidar Localization Using Learned ICP Weights," arXiv, 2023: https://arxiv.org/abs/2309.08731
- Ibrahim et al., "UnLoc: A Universal Localization Method for Autonomous Vehicles using LiDAR, Radar and/or Camera Input," arXiv/IROS, 2023: https://arxiv.org/abs/2307.00741
- Qi et al., "RLPR: Radar-to-LiDAR Place Recognition via Two-Stage Asymmetric Cross-Modal Alignment for Autonomous Driving," arXiv, 2026: https://arxiv.org/abs/2603.07920
- Oxford Radar RobotCar dataset: https://oxford-robotics-institute.github.io/radar-robotcar-dataset/
- MulRan dataset: https://sites.google.com/view/mulran-pr/home
