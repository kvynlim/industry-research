# LSD-SLAM and DSO

## Executive Summary

LSD-SLAM and DSO are the canonical direct-method visual odometry/SLAM systems from the TUM direct visual SLAM line. They contrast sharply with feature-based systems such as [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md): instead of extracting descriptors and minimizing feature reprojection error, they align images by minimizing photometric error over selected pixels.

LSD-SLAM is a large-scale direct monocular SLAM system. It tracks camera motion by direct image alignment, estimates semi-dense depth maps for keyframes, and maintains a pose graph that is aware of monocular scale drift. It was important historically because it showed that direct monocular SLAM could build large semi-dense maps, not just sparse feature maps.

DSO is a later direct sparse odometry system. It reduced the map to carefully selected high-gradient pixels and optimized a sliding window with a full photometric calibration model including exposure time, vignetting, camera response, and affine brightness terms. DSO is usually more accurate and efficient than LSD-SLAM as an odometry front-end, but the original DSO is not a complete SLAM system: it has no built-in loop closure or relocalization. LDSO extends DSO with loop closure.

For autonomous vehicle work, the direct family is valuable as a precision visual odometry baseline under controlled camera calibration and lighting. For airside deployment, direct methods are fragile as primary localization sources because airports contain low-texture pavement, harsh illumination transitions, wet reflections, dynamic objects, and camera exposure challenges. They are best treated as research baselines or auxiliary visual odometry signals feeding [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md), not as standalone navigation systems.

## Historical Context

The visual SLAM literature historically split into feature-based and direct methods. Feature-based systems detect repeatable points or corners, match descriptors, and optimize geometry. Direct methods instead use pixel intensity consistency. This can exploit image information that feature pipelines discard, but it requires stronger assumptions about photometric calibration, exposure, and brightness constancy.

LSD-SLAM, introduced at ECCV 2014 by Engel, Schops, and Cremers, was a key direct monocular SLAM milestone. It used direct tracking and semi-dense depth estimation for keyframes, then connected keyframes in a scale-drift aware pose graph. The result was more visually informative than sparse landmark maps, while still running in real time.

DSO, introduced in 2016 and later published in TPAMI, changed the emphasis from semi-dense mapping to sparse but highly optimized photometric odometry. It selected a small set of high-gradient points and jointly optimized camera poses, inverse depths, and photometric calibration parameters over a sliding window. The related TUM monoVO dataset was created to evaluate photometrically calibrated monocular VO across indoor and outdoor sequences.

LDSO later added loop closure and pose-graph optimization to DSO, addressing one of the original DSO system's major limitations. Stereo DSO and visual-inertial DSO variants further explored scale recovery and IMU coupling. Even so, the most widely known classical distinction remains: LSD-SLAM is direct semi-dense monocular SLAM, while DSO is direct sparse monocular odometry.

## Sensor Assumptions

Both methods are primarily monocular in their original forms:

- LSD-SLAM assumes a calibrated monocular camera and enough image gradient structure for direct alignment and depth filtering.
- DSO assumes a calibrated monocular camera and benefits strongly from photometric calibration: exposure times, vignetting, and camera response.
- Global-shutter cameras are preferred. Rolling-shutter effects violate the rigid-frame model unless explicitly handled.
- Brightness constancy is a core assumption. Auto-exposure, aperture changes, motion blur, flicker, reflections, and non-Lambertian surfaces can break it.
- Camera motion must generate usable parallax. Pure rotation or near-pure forward motion through weak texture is difficult, especially during initialization.
- The observed scene should be mostly static.
- Monocular scale is not directly observable. LSD-SLAM handles scale drift in a Sim(3) graph, while DSO's original monocular odometry remains up to scale unless augmented by stereo, IMU, or external scale.

For an airside vehicle, these assumptions are difficult but not impossible. Cameras mounted to look at terminal facades, painted signs, baggage infrastructure, or textured building edges provide better input than cameras pointed mostly at smooth pavement, sky, or aircraft fuselages.

## State/Map Representation

LSD-SLAM:

- Represents selected keyframes with semi-dense inverse-depth maps.
- Estimates depth primarily for pixels with sufficient gradient.
- Maintains a graph of keyframes and relative Sim(3) constraints, because monocular scale drift is a first-class problem.
- Uses direct image alignment for tracking against a current keyframe or local reference.
- Produces a semi-dense point cloud useful for visualization and coarse scene geometry, but not a dense metric occupancy map.

DSO:

- Maintains a fixed-size sliding window of keyframes.
- Selects sparse high-gradient points distributed across the image.
- Represents point depth as inverse depth anchored in host frames.
- Optimizes camera poses, inverse depths, and photometric parameters jointly.
- Marginalizes old keyframes and points to keep runtime bounded.
- Does not maintain a persistent global map or loop-closure graph in the original release.

LDSO:

- Extends DSO with feature-like place recognition and loop closure.
- Adds a pose graph on top of DSO odometry.
- Makes the method closer to complete SLAM, though the direct odometry front-end remains the core.

Compared with ORB-SLAM's sparse descriptor landmarks, LSD-SLAM's semi-dense maps are more visually interpretable but less semantically structured, and DSO's sparse direct points are selected for photometric utility rather than long-term landmark distinctiveness.

## Algorithm Pipeline

LSD-SLAM pipeline:

1. Track the current frame against a reference keyframe using direct image alignment.
2. Estimate a relative pose by minimizing photometric residuals over semi-dense pixels.
3. Update depth maps through small-baseline stereo comparisons and probabilistic filtering.
4. Create a new keyframe when viewpoint or tracking conditions require it.
5. Add relative constraints between keyframes.
6. Run pose-graph optimization in Sim(3) to reduce drift and handle monocular scale changes.
7. Use the semi-dense depth maps for visualization and map reuse.

DSO pipeline:

1. Photometrically calibrate or compensate images.
2. Select candidate points with strong intensity gradients and spatial distribution.
3. Track new frames against the active window using sparse direct image alignment.
4. Insert keyframes based on motion, visibility, and scene change.
5. Jointly optimize poses, inverse depths, camera intrinsics or calibration-related parameters, and affine brightness parameters.
6. Marginalize old states to maintain a bounded sliding window.
7. Output odometry and sparse point structure.

LDSO adds:

1. Convert selected direct points or additional features into a place-recognition representation.
2. Detect loop candidates.
3. Estimate loop constraints.
4. Optimize a pose graph to correct drift.

## Formulation

The direct-method objective is photometric rather than geometric feature reprojection. A simplified residual for a pixel `p` in host frame `i` observed in target frame `j` is:

```text
p' = project(T_j_i * backproject(p, inverse_depth_p))
r_pj = I_j[p'] - b_j - exp(a_j - a_i) * (I_i[p] - b_i)
```

The optimization minimizes robustified photometric error over selected pixels and small pixel patterns:

```text
min over poses, inverse depths, brightness params:
  sum rho(||r_pj||^2)
```

DSO's formulation is more rigorous than older direct methods because it explicitly models photometric calibration effects. Exposure time, response function, and vignetting are handled when available; affine brightness parameters compensate remaining frame-to-frame brightness variation.

LSD-SLAM also minimizes direct photometric error for tracking, but its mapping uses probabilistic semi-dense depth filtering and its global consistency is handled through keyframe graph optimization. The monocular graph is Sim(3) rather than pure SE(3) so that scale drift can be corrected.

The key contrast with feature-based SLAM:

- Feature-based: extract descriptors, match sparse keypoints, minimize reprojection error.
- Direct sparse: select pixels, warp them using current geometry, minimize brightness error.
- Direct semi-dense: use many gradient-rich pixels and maintain semi-dense depth maps.

## Failure Modes

Direct methods are sensitive to failures that violate brightness constancy or photometric calibration:

- Auto-exposure and gain changes not captured by the brightness model.
- Flickering airport lights, LED signs, headlights, strobes, and rolling illumination.
- Wet pavement, specular reflections, glass, aircraft fuselage reflections, and non-Lambertian materials.
- Motion blur and vibration.
- Rolling shutter under vehicle motion.
- Low-gradient scenes such as uniform tarmac, sky, blank walls, and smooth aircraft bodies.
- Dynamic objects occupying high-gradient regions: workers, baggage carts, belt loaders, tugs, aircraft, and service vehicles.
- Pure rotation or insufficient translation during initialization.
- Fast rotations that move content out of the field of view; the DSO repository explicitly warns that pure VO cannot recover from everything leaving the view because old geometry is marginalized.
- Lack of loop closure in original DSO, causing unbounded drift over long traversals.

In airside scenes, lighting and reflectance are the biggest practical risks. Direct methods can perform well on controlled research datasets and fail abruptly on wet, shiny, high-contrast operational surfaces unless camera exposure and photometric calibration are engineered carefully.

## AV Relevance

Direct methods are relevant to AVs because they can produce precise short-term motion estimates without relying on discrete feature descriptors. They are especially interesting when the camera has stable calibration and the scene has enough texture but feature descriptors are less reliable.

However, their production AV relevance is narrower than feature-based or tightly fused visual-inertial systems:

- Original DSO is odometry, not complete SLAM.
- Uncertainty reporting and health monitoring require additional engineering.
- Photometric assumptions are hard to guarantee on outdoor vehicles.
- Loop closure and relocalization are not built into original DSO.
- Monocular scale remains a problem without stereo, IMU, or external constraints.

For a road or airport AV, direct VO can be a useful measurement source inside a larger estimator. It should be compared with feature-based [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), semi-direct [SVO](svo.md), and VIO systems such as [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md) and [OpenVINS](openvins.md).

## Indoor/Outdoor Relevance

Indoor:

- Strong in textured indoor corridors, offices, labs, warehouses, and baggage halls.
- Can exploit wall/floor texture that may not produce distinctive descriptors.
- Lighting must be stable or calibrated; LED flicker and auto-exposure can still hurt.
- Monocular scale and initialization remain issues unless paired with stereo/IMU.

Outdoor:

- Works on textured urban scenes, building facades, vegetation, and road edges.
- Harder under sunlight changes, shadows, wet roads, reflective surfaces, and wide-open areas.
- Airside outdoor scenes are often less favorable than city streets because there are fewer close vertical features and more uniform pavement.

Direct methods can be useful for indoor/outdoor transition research if the camera sees stable structure across the transition. In practice, the transition should be managed by a multi-sensor estimator that can downweight vision when photometric residuals or tracking quality degrade.

## Airside Deployment Notes

Deployment considerations:

- Use industrial global-shutter cameras with fixed exposure or carefully logged exposure times.
- Prefer views with terminal structure, signs, equipment edges, and markings rather than open pavement.
- Collect calibration data for photometric response and vignetting if evaluating DSO seriously.
- Treat wet pavement and nighttime floodlights as first-class test cases, not edge cases.
- Add dynamic-object masking if using direct methods near active stands.
- Do not depend on original DSO for long-range global localization without loop closure, GNSS, LiDAR, or map matching.
- Feed output into the multi-sensor fusion layer described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md).
- Monitor photometric residual distribution, active point count, tracking iterations, marginalization behavior, initialization status, and dropped frames.
- Validate against operationally relevant metrics: drift per 100 m, drift over a full baggage-hall-to-stand route, recovery after exposure shock, and degradation in rain/night sequences.

Airside suitability is highest for auxiliary odometry in visually structured areas and lowest for primary localization on open aprons or runways.

## Datasets/Metrics

Common datasets:

- TUM monoVO: photometrically calibrated monocular VO dataset created with direct methods in mind; useful for DSO and direct-method studies.
- KITTI Odometry: outdoor driving benchmark; useful for AV-like motion but less airside-specific.
- EuRoC MAV: visual-inertial/stereo dataset often used for comparisons, though original DSO is monocular.
- TUM RGB-D: relevant mainly for comparing visual SLAM behavior, less central to DSO.
- ICL-NUIM and other synthetic RGB-D/monocular sequences: useful for controlled photometric analysis.

Metrics:

- End-to-end drift for closed-loop sequences, common for TUM monoVO.
- ATE/APE after Sim(3) alignment for monocular trajectories.
- RPE over fixed path lengths or time intervals.
- KITTI translational and rotational drift.
- Tracking survival rate and number of resets.
- Photometric residual statistics.
- Runtime per frame and active point count.
- Loop-closure correction size for LSD-SLAM/LDSO.

For airside evaluation, include tests for exposure jumps entering/exiting terminal shadows, wet surface reflectance, nighttime apron lighting, repeated stand geometry, and low-texture taxiway segments.

## Open-Source Implementations

- LSD-SLAM original project and documentation: GPL-family research code from the TUM line, with ROS-era build assumptions.
- DSO official repository: GPLv3 C++ code from Jakob Engel; strong reference implementation for direct sparse monocular odometry.
- TUM monoVO dataset tools: photometric calibration and dataset utilities.
- LDSO: research extension of DSO adding loop closure and pose-graph optimization.
- Stereo DSO and visual-inertial DSO variants: useful for scale and robustness studies, but they should be evaluated separately from original DSO.

Practical implementation notes:

- Reproduce TUM monoVO examples before using custom cameras.
- DSO expects careful image rectification; incorrect black borders or poor undistortion can create outliers.
- Photometric calibration matters. Running DSO without it is possible but weakens the main advantage of the method.
- ROS integration and live-camera use require care because the reference code is dataset-oriented.
- GPLv3 licensing must be reviewed before product integration.

## Practical Recommendation

For visual SLAM Part A, treat LSD-SLAM and DSO as the direct-method baseline family:

- Use LSD-SLAM to understand semi-dense direct monocular SLAM and scale-drift aware pose graphs.
- Use DSO to understand high-accuracy sparse direct odometry and the importance of photometric calibration.
- Use LDSO if the comparison needs direct-method loop closure.

For an airside AV, do not choose LSD-SLAM or original DSO as the primary localization system. They are too sensitive to illumination, reflectance, dynamic content, and monocular scale for safety-critical deployment. The best use is as an auxiliary research signal in structured areas, benchmarked against [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), [SVO](svo.md), [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md), and [OpenVINS](openvins.md). If direct methods are pursued operationally, use stereo or visual-inertial direct variants, strict photometric calibration, dynamic masking, and robust fusion with LiDAR/GNSS/IMU/wheels.

## Sources

### Primary Papers and Project Pages

- Engel, Schops, and Cremers, "LSD-SLAM: Large-Scale Direct Monocular SLAM": https://cvg.cit.tum.de/research/vslam/lsdslam
- LSD-SLAM documentation: https://lsd-slam.readthedocs.io/
- Engel, Koltun, and Cremers, "Direct Sparse Odometry": https://cvg.cit.tum.de/research/vslam/dso
- DSO official repository: https://github.com/JakobEngel/dso
- Engel, Usenko, and Cremers, "A Photometrically Calibrated Benchmark For Monocular Visual Odometry": https://arxiv.org/abs/1607.02555
- Gao, Wang, Demmel, and Cremers, "LDSO: Direct Sparse Odometry with Loop Closure": https://arxiv.org/abs/1808.01111

### Datasets and Benchmarks

- TUM Monocular Visual Odometry Dataset: https://cvg.cit.tum.de/data/datasets/mono-dataset
- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- TUM RGB-D SLAM Dataset and Benchmark: https://cvg.cit.tum.de/data/datasets/rgbd-dataset

### Internal Cross-Links

- [Mapping and Localization](../overview/mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
- [SVO](svo.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [OpenVINS](openvins.md)
