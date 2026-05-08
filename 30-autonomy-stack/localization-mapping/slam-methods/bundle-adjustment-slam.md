# Bundle Adjustment SLAM

## Executive Summary

Bundle adjustment is the maximum-likelihood optimization of camera poses, 3D landmarks, and often camera calibration parameters from image measurements. In visual SLAM, it is the core backend that refines keyframe poses and sparse map points by minimizing reprojection error. Local bundle adjustment keeps real-time visual SLAM accurate over a sliding set of keyframes; global bundle adjustment is used after loop closure, map merging, or offline reconstruction.

Bundle adjustment is essential for camera-centric SLAM, structure from motion, and visual-inertial systems. It is less suitable as the primary map builder for LiDAR-first airside autonomy, but it remains valuable for visual validation, semantic landmark mapping, inspection cameras, low-cost indoor platforms, AR-style localization, and offline reconstruction from survey imagery. The practical AV pattern is not "BA versus LiDAR SLAM"; it is BA for visual constraints plus factor/pose graph optimization for multi-sensor global consistency.

## Historical Context

Bundle adjustment originates in photogrammetry, where "bundles" of camera rays are adjusted to best intersect 3D scene points. Triggs, McLauchlan, Hartley, and Fitzgibbon's "Bundle Adjustment - A Modern Synthesis" made the method accessible to computer vision and remains the canonical reference.

In robotics, bundle adjustment became central as feature-based visual SLAM matured. MonoSLAM used filtering, but keyframe-based systems increasingly adopted nonlinear optimization. PTAM demonstrated real-time tracking with a separate mapping thread and local BA. ORB-SLAM and ORB-SLAM2 made feature-based visual SLAM robust across monocular, stereo, and RGB-D configurations using local BA, pose graph optimization, place recognition, and loop closure. ORB-SLAM3 extended this to visual-inertial and multi-map operation.

Today, bundle adjustment is implemented in Ceres, g2o, GTSAM, COLMAP, ORB-SLAM, and many VIO systems. It is the visual counterpart to pose graph optimization: pose graphs optimize summarized relative transforms, while BA goes back to the original image feature measurements.

## Sensor Assumptions

Bundle adjustment assumes visual measurements provide repeatable correspondences across frames:

- Monocular, stereo, RGB-D, fisheye, or multi-camera images.
- Calibrated camera intrinsics and distortion, or intrinsics included in the optimized state.
- Sufficient texture and parallax for triangulation.
- Mostly static scene points.
- Time synchronization with IMU or other sensors if fused.
- A camera projection model that is differentiable.

Measurement types:

- 2D keypoint observations of 3D landmarks.
- Stereo disparity or right-image observations.
- RGB-D depth constraints.
- Fiducial corner measurements.
- Line or plane features in extended formulations.
- IMU preintegration factors in visual-inertial BA.

Monocular BA alone has scale ambiguity. Metric scale requires stereo baseline, RGB-D depth, IMU excitation, wheel/odometry constraints, known object sizes, GPS/RTK, or map priors.

## State and Map Representation

The standard BA state is:

```text
Camera/keyframe states:
  T_wc_i in SE(3)
  optional velocity v_i
  optional IMU bias b_i
  optional camera intrinsics K
  optional extrinsics T_body_camera

Map states:
  3D landmarks p_j in R^3
  or inverse-depth landmarks anchored to keyframes
```

The observation graph is bipartite:

```text
camera/keyframe i  <->  image observation z_ij  <->  landmark j
```

Sparse structure is strong: each reprojection factor touches one camera and one landmark. Eliminating landmarks with the Schur complement leaves a reduced camera-only system. This is why BA scales to large reconstructions when implemented properly.

Visual SLAM systems typically use multiple BA scopes:

- **Motion-only BA:** Optimize the current pose against fixed landmarks.
- **Local BA:** Optimize recent keyframes and local landmarks.
- **Global BA:** Optimize all keyframes and landmarks after loop closure.
- **Visual-inertial BA:** Add velocities, IMU biases, preintegration factors, and gravity/scale constraints.

## Algorithm Pipeline

1. **Image preprocessing.** Undistort or rectify images, apply photometric normalization if needed.

2. **Feature extraction or direct alignment.** Extract ORB/SIFT/SURF/SuperPoint-like features, or use dense/direct photometric residuals.

3. **Data association.** Match features across frames using descriptors, optical flow, epipolar constraints, or BoW place recognition.

4. **Initial pose estimation.** Estimate motion using PnP, essential matrix, homography, stereo constraints, or inertial propagation.

5. **Triangulate landmarks.** Create 3D points from multi-view correspondences with enough baseline and positive depth.

6. **Run motion-only BA.** Refine the current camera pose for tracking.

7. **Select keyframes.** Add a keyframe based on parallax, tracked landmark count, time, or scene change.

8. **Run local BA.** Optimize active keyframes and landmarks; keep older keyframes fixed or marginalized.

9. **Cull landmarks and keyframes.** Remove points with low observation count, high reprojection error, poor triangulation angle, or repeated failures.

10. **Loop closure and map reuse.** Detect revisits with BoW or learned place recognition; estimate Sim(3) or SE(3) correction; run pose graph and global BA.

11. **Export map products.** Sparse landmarks, camera trajectory, dense MVS/TSDF reconstruction, or localization map.

## Formulation

For camera pose `T_i`, landmark `P_j`, camera intrinsics `K`, and observed pixel `z_ij`, the reprojection residual is:

```text
e_ij = z_ij - pi(K, T_i^-1 P_j)
```

Bundle adjustment solves:

```text
min_{T_i, P_j, K} sum_(i,j in observations) rho( e_ij^T Sigma_ij^-1 e_ij )
```

where:

- `pi(.)` is the camera projection model.
- `Sigma_ij` is the image measurement covariance.
- `rho(.)` is often a robust loss such as Huber or Cauchy.

Linearization gives a sparse block system:

```text
[B  E] [dx_c] = [v]
[E^T C] [dx_p]   [w]
```

`B` covers camera-camera blocks, `C` covers point-point blocks, and `E` covers camera-point coupling. Because landmarks are conditionally independent given cameras, `C` is block diagonal. The Schur complement eliminates landmarks:

```text
(B - E C^-1 E^T) dx_c = v - E C^-1 w
```

Then landmark updates are recovered by back-substitution. This is the key computational trick behind large-scale BA.

Visual-inertial BA adds factors such as:

```text
IMU residual between states i and j:
e_imu(X_i, v_i, b_i, X_j, v_j, b_j)
```

The full objective becomes a factor graph with reprojection, inertial, prior, loop, and sometimes GPS/wheel factors.

## Failure Modes

**Low texture and repetitive texture.** Feature-based BA needs stable correspondences. Blank walls, wet tarmac, repetitive gate structures, and night scenes reduce reliability.

**Dynamic objects.** Moving vehicles, people, jet bridges, baggage carts, and aircraft can create false landmarks.

**Scale ambiguity.** Monocular BA has no metric scale without additional information.

**Poor parallax.** Forward motion with distant features gives weak depth estimates; landmarks can drift toward infinity.

**Rolling shutter and motion blur.** Fast motion or vibration violates the global-shutter projection model.

**Bad calibration.** Intrinsic, extrinsic, or timestamp errors appear as systematic reprojection residuals and can distort the map.

**Outlier correspondences.** Wrong feature matches create high-leverage residuals. Robust losses help but cannot fully replace geometric validation.

**Local minima.** BA is nonlinear and needs reasonable initialization.

**Compute spikes.** Global BA can be expensive; local BA windows and keyframe culling are required for real-time operation.

## AV Relevance

Bundle adjustment is relevant wherever cameras contribute geometry:

- Visual odometry and visual-inertial odometry.
- Camera-to-LiDAR calibration refinement.
- Sparse semantic landmark maps.
- Low-cost fallback localization.
- Dense reconstruction from survey imagery.
- Inspection tasks around aircraft stands or indoor facilities.

For road and airside AVs, BA alone is rarely enough. LiDAR, radar, RTK, wheel odometry, and IMU are needed for robustness. BA should provide visual factors into a broader graph rather than act as the only estimator.

Compared with LiDAR pose graph SLAM, BA has two strengths:

- High angular resolution and semantic richness.
- Strong constraints in textured environments.

And three weaknesses:

- Sensitivity to lighting/weather.
- Need for texture and feature persistence.
- Monocular scale ambiguity.

## Indoor/Outdoor Relevance

**Indoor:** BA-based RGB-D, stereo, and visual-inertial SLAM can work very well in textured interiors. Artificial fiducials make it highly reliable.

**Outdoor:** Stereo and visual-inertial BA are useful outdoors but need robust exposure handling, dynamic object rejection, and weather/night mitigation.

**Large-scale mapping:** Offline BA is excellent for imagery-rich reconstruction, but LiDAR/RTK constraints are usually needed for metric, globally aligned maps.

## Airside Deployment Notes

Airside visual BA is challenging:

- Aprons contain large low-texture regions.
- Adjacent stands and markings repeat.
- Night lighting, glare, rain, and de-icing spray degrade images.
- Aircraft and GSE are dynamic and can dominate the view.
- Monocular scale is unacceptable for safety-critical localization.

Use BA in controlled airside roles:

- Stereo or visual-inertial validation against LiDAR/RTK pose.
- Fiducial-based docking and calibration targets.
- Visual semantic landmarks such as signs, stand identifiers, and painted markings.
- Offline survey image reconstruction to enrich HD maps.
- Local camera tracking in terminal interiors or maintenance bays.

Do not make monocular BA the primary safety-critical airside localization source. Fuse it into the multi-sensor estimator described in [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md) and anchor it to the graph/map infrastructure in [Map Construction Pipeline](../maps/map-construction-pipeline.md).

## Datasets and Metrics

Useful datasets:

- **EuRoC MAV:** Stereo visual-inertial sequences with accurate ground truth.
- **TUM RGB-D:** RGB-D SLAM benchmark with motion-capture trajectories.
- **KITTI odometry:** Stereo outdoor vehicle benchmark.
- **ETH3D SLAM datasets:** RGB-D/visual datasets with geometry emphasis.
- **ICL-NUIM:** Synthetic RGB-D benchmark with trajectory and surface ground truth.
- **Newer College:** LiDAR/vision/inertial dataset for mixed-modality evaluation.

Metrics:

- Reprojection RMSE and robust cost.
- ATE and RPE.
- Scale drift for monocular and visual-inertial systems.
- Landmark track length and triangulation angle.
- Keyframe count and map point survival rate.
- Loop closure precision/recall.
- Runtime for tracking, local BA, and global BA.
- Dense reconstruction completeness and accuracy when a mesh/TSDF is produced.

For airside, add task metrics:

- Docking pose error.
- Stand-ID localization accuracy.
- Visual failure rate under night, rain, glare, and de-icing.
- Consistency with LiDAR/RTK factor graph estimates.

## Open-Source Implementations

- **Ceres Solver:** Widely used nonlinear least-squares solver with BA examples and Schur solvers: https://ceres-solver.org/
- **COLMAP:** Structure-from-motion and multi-view stereo pipeline using BA: https://colmap.github.io/ and https://github.com/colmap/colmap
- **ORB-SLAM2:** Real-time monocular, stereo, and RGB-D SLAM with local BA: https://github.com/raulmur/ORB_SLAM2
- **ORB-SLAM3:** Visual, visual-inertial, and multi-map SLAM: https://github.com/UZ-SLAMLab/ORB_SLAM3
- **g2o:** Graph optimization framework used by many visual SLAM systems: https://github.com/RainerKuemmerle/g2o
- **GTSAM SFM examples:** Factor-graph formulation of structure from motion and BA: https://gtbook.github.io/gtsam-examples/SFMExample.html
- **OpenMVG:** Multiple-view geometry and SfM library: https://github.com/openMVG/openMVG

## Practical Recommendation

Use bundle adjustment when original image measurements matter and when the scene provides stable visual correspondences. In an airside AV stack, BA should be a visual constraint provider and offline reconstruction tool, not the primary localization authority.

Recommended pattern:

- Use stereo or visual-inertial BA, not monocular-only BA, for metric operation.
- Keep BA local for real-time operation; run global BA offline or after confirmed loop closure.
- Reject dynamic objects before feature insertion.
- Fuse BA outputs into a factor graph with LiDAR, IMU, wheel, and RTK constraints.
- Use LiDAR/occupancy representations for planning and safety; see [Real-Time Occupancy Grid Mapping](../maps/realtime-occupancy-grid-mapping.md).

## Related Repository Docs

- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [LiDAR Place Recognition and Re-Localization](../overview/lidar-place-recognition-relocalization.md)
- [Real-Time Occupancy Grid Mapping](../maps/realtime-occupancy-grid-mapping.md)
- [Map Construction Pipeline](../maps/map-construction-pipeline.md)

## Sources

- Triggs, McLauchlan, Hartley, and Fitzgibbon, "Bundle Adjustment - A Modern Synthesis," 2000: https://link.springer.com/chapter/10.1007/3-540-44480-7_21
- Ceres Solver bundle adjustment and nonlinear least squares documentation: https://ceres-solver.org/nnls_solving.html
- COLMAP official documentation and repository: https://colmap.github.io/ and https://github.com/colmap/colmap
- Mur-Artal and Tardos, "ORB-SLAM2: An Open-Source SLAM System for Monocular, Stereo, and RGB-D Cameras," IEEE T-RO, 2017: https://arxiv.org/abs/1610.06475
- ORB-SLAM2 GitHub: https://github.com/raulmur/ORB_SLAM2
- Campos et al., "ORB-SLAM3: An Accurate Open-Source Library for Visual, Visual-Inertial and Multi-Map SLAM": https://arxiv.org/abs/2007.11898
- ORB-SLAM3 GitHub: https://github.com/UZ-SLAMLab/ORB_SLAM3
- EuRoC MAV Dataset: https://projects.asl.ethz.ch/datasets/euroc-mav/
- TUM RGB-D benchmark: https://cvg.cit.tum.de/data/datasets/rgbd-dataset
- KITTI odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php
- ICL-NUIM RGB-D benchmark: https://www.doc.ic.ac.uk/~ahanda/VaFRIC/iclnuim.html
