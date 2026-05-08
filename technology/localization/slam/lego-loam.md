# LeGO-LOAM: Lightweight and Ground-Optimized LiDAR Odometry and Mapping

Related localization docs: [SLAM algorithms](../lidar-slam-algorithms.md), [production LiDAR map localization](../production-lidar-map-localization.md), and [map construction pipeline](../map-construction-pipeline.md).

## Executive Summary

LeGO-LOAM is a ground-vehicle-focused descendant of LOAM. Introduced by Tixiao Shan and Brendan Englot at IROS 2018, it keeps the LOAM feature-registration idea but adds range-image segmentation, explicit ground separation, a lightweight two-step Levenberg-Marquardt odometry update, and a pose-graph mapping layer. The name means Lightweight and Ground-Optimized LOAM.

The method was designed for small unmanned ground vehicles with limited compute and a horizontally mounted Velodyne VLP-16. Its main insight is that ground vehicles usually observe a ground plane, and that ground returns should be separated before feature extraction. This removes many unstable features from grass, leaves, and noisy surfaces while using ground planes to stabilize roll, pitch, and vertical motion.

For autonomous vehicle work, LeGO-LOAM is important because it bridges original LOAM and modern factor-graph LiDAR-inertial systems such as LIO-SAM. It is more practical than original LOAM for low-channel ground robots, but its assumptions are narrow: horizontal LiDAR, visible ground plane, ROS1-era dependencies, naive loop closure, and hard-coded sensor expectations. For airside mapping, it can be useful as an embedded survey baseline for GSE-like platforms, but it should be validated against stronger LiDAR-inertial or scan-to-map systems.

## Historical Context

LOAM showed that sparse edge and planar features could provide real-time LiDAR odometry. LeGO-LOAM adapted that idea to lower-cost UGVs, where a 16-channel LiDAR and an embedded computer were more realistic than a high-end 64-channel sensor and workstation.

The IROS 2018 paper targeted variable-terrain ground vehicles. The authors argued that many raw LiDAR returns in such environments are unreliable: grass, leaves, and noisy ground returns can be selected as features, yet are not repeatably observed in later scans. LeGO-LOAM introduced segmentation before feature extraction and used the ground plane in the optimization. The open-source release became widely used in ROS robotics, especially on Clearpath Jackal-like platforms.

LeGO-LOAM also helped popularize GTSAM/iSAM2 in LiDAR SLAM workflows. Its follow-on, LIO-SAM, moved from loose optional IMU usage toward a tightly coupled LiDAR-inertial factor graph, while preserving the LOAM feature vocabulary.

## Sensor Assumptions

LeGO-LOAM's public implementation is intentionally specific.

Primary assumptions:

- A Velodyne VLP-16 or similar multi-beam spinning LiDAR.
- The LiDAR is mounted horizontally on a ground vehicle.
- The scan contains a visible ground plane.
- The platform motion is mostly ground-vehicle motion, not free-flying 6-DoF motion.
- Optional IMU data is available, but the original package is not a tightly coupled LIO system.
- Range-image projection parameters match the LiDAR channel count and vertical angles.

These assumptions matter. If the LiDAR is pitched, mounted high with limited ground visibility, installed vertically, or replaced with a non-repetitive solid-state sensor, the default segmentation and ground extraction can fail. Multi-LiDAR vehicle rigs also require preprocessing or a redesigned front end because LeGO-LOAM expects a single organized scan.

## Map Representation

LeGO-LOAM uses several representations:

- **Range image:** The raw scan is projected into a 2D range image indexed by ring and horizontal angle.
- **Ground mask:** Adjacent scan-line geometry is used to identify ground points.
- **Segmented cloud:** Connected-component segmentation removes small or unreliable clusters before feature extraction.
- **Feature clouds:** Edge and planar features are extracted from the segmented cloud.
- **Local feature map:** Odometry and mapping match current features into recent feature clouds or local map features.
- **Pose graph:** Loop closure constraints and odometry constraints are added to a GTSAM/iSAM2 graph in the SLAM layer.

The final map is a registered 3D point cloud or feature cloud corrected by the optimized pose graph. Like LOAM, it is not an occupancy-grid planner map by itself; it is a geometric survey product that still needs post-processing for HD map use.

## Algorithm Pipeline

1. **Range-image projection**
   - Convert the incoming LiDAR cloud into a matrix of range values.
   - Preserve ring, column, and range relationships for fast neighbor access.

2. **Ground extraction**
   - Compare neighboring scan lines to estimate whether adjacent points lie on the ground.
   - Mark ground points separately before feature extraction.

3. **Point cloud segmentation**
   - Segment non-ground points into connected components in the range image.
   - Remove very small clusters and unreliable returns.
   - Keep labels so feature extraction avoids unstable regions.

4. **Feature extraction**
   - Compute smoothness along scan lines.
   - Select edge features from high-curvature regions.
   - Select planar features from low-curvature ground and surface regions.
   - Distribute features across scan sectors.

5. **Two-step LiDAR odometry**
   - Use planar/ground features to estimate components strongly constrained by the ground.
   - Use edge features and remaining planar features to estimate the full 6-DoF transform.
   - Solve with Levenberg-Marquardt in a reduced, staged problem for speed.

6. **Mapping**
   - Match selected features into a local map.
   - Refine the pose and insert new features.

7. **Loop closure and pose graph**
   - Detect loop candidates.
   - Use ICP to create loop constraints.
   - Optimize the graph with iSAM2.
   - Correct poses and the map after graph updates.

The public repository notes that the loop closure is a naive ICP-based method and can fail when odometry drift is large. Scan Context variants such as SC-LeGO-LOAM were later created to improve loop detection.

## Formulation

LeGO-LOAM inherits LOAM's feature residuals but changes the front end and optimization structure.

For edge features:

```text
r_edge(T) = distance(T * p_i, line(q_j, q_k))
```

For planar and ground features:

```text
r_plane(T) = n^T * (T * p_i - q_plane)
```

The pose update is estimated by minimizing a weighted sum:

```text
T* = arg min_T sum_i rho(r_edge_i(T)^2) + sum_j rho(r_plane_j(T)^2)
```

The distinctive part is the staged solve. Ground and planar features first constrain the pose dimensions that are most observable from the ground plane. Edge and non-ground planar features then complete the transform. This reduces compute and improves stability for UGV motion, but it also encodes a strong ground-vehicle prior.

The SLAM layer adds pose graph constraints:

```text
X* = arg min_X sum odom_edges || e_ij(X_i, X_j, Z_ij) ||^2
              + sum loop_edges || e_ij(X_i, X_j, Z_ij) ||^2
```

where odometry edges come from feature registration and loop edges come from ICP-based revisits.

## Failure Modes

- **No visible ground plane:** The method loses one of its main stabilizers.
- **Non-horizontal LiDAR mounting:** Default ground segmentation can misclassify most of the scan.
- **Steep ramps, banked roads, or curbs:** Ground extraction can confuse slope changes with obstacles or vice versa.
- **Open flat areas:** Ground alone cannot constrain yaw or horizontal translation well.
- **Sparse 16-channel geometry:** Low vertical resolution limits feature repeatability in open environments.
- **Naive loop closure:** ICP loop closure may fail if drift is large or the revisit geometry is repetitive.
- **Dynamic scenes:** Moving GSE, aircraft, baggage carts, and pedestrians can become unstable map features.
- **Vegetation and surface clutter:** LeGO-LOAM reduces but does not eliminate unstable features from grass, leaves, and small objects.
- **Sensor-specific parameters:** Vertical angles, ring count, ground scan indices, and segmentation thresholds often need retuning.
- **ROS1 dependency profile:** The original package is not a modern ROS2 production component.

## AV Relevance

LeGO-LOAM is relevant to AVs mainly as a lightweight UGV mapping and odometry baseline.

Strengths:

- Efficient on embedded hardware compared with original LOAM.
- Designed for ground vehicles.
- Better handling of low-channel LiDAR than original LOAM.
- Useful segmentation stage before feature extraction.
- Integrates loop closure and GTSAM-style graph optimization in the public workflow.

Limitations:

- It is not a tightly coupled LiDAR-inertial smoother.
- It assumes the ground plane is available and useful.
- It does not solve production localization against a prebuilt HD map.
- It lacks robust semantic filtering and modern dynamic-object handling.
- Its loop closure should not be relied on without validation.

For AV stacks, LeGO-LOAM is most useful as a bridge concept: it shows how to exploit ground constraints and segmentation, but production systems should use stronger factor graphs, better scan-to-map localization, and explicit health monitoring.

## Indoor/Outdoor Relevance

**Indoor:** LeGO-LOAM can work well in warehouses, corridors, parking structures, and hangars if the floor is visible and the LiDAR is horizontally mounted. Its floor prior helps stabilize roll, pitch, and height. However, repeated corridors and glass-heavy interiors can create false matches.

**Outdoor:** The method was designed for outdoor UGV variable terrain. It performs best when there are ground returns plus vertical objects such as building facades, poles, trees, barriers, or parked vehicles. It is weaker in open fields, large car parks, wide aprons, and roads without vertical structure.

**Mixed environments:** LeGO-LOAM is suitable for robot survey experiments that move between indoor floor-rich areas and outdoor ground-vehicle scenes. It needs additional anchoring for global consistency.

## Airside Deployment Notes

Airside GSE platforms match LeGO-LOAM's ground-vehicle assumption, but airport geometry creates both opportunities and risks.

Useful conditions:

- Low-speed vehicle motion.
- Stable ground plane on aprons, service roads, and stands.
- Terminal walls, poles, blast fences, baggage infrastructure, and jet bridge supports near stands.
- Compute-limited embedded platforms where lightweight odometry matters.

Problem conditions:

- Very open apron regions with only concrete ground returns.
- Aircraft and GSE creating dynamic, non-repeatable structure.
- Sloped drainage surfaces, ramps, dock plates, and stand transitions.
- LiDAR installations optimized for perception rather than horizontal ground segmentation.
- Safety-critical localization requirements that demand quantified covariance and fallback behavior.

Deployment guidance:

- Do not use LeGO-LOAM alone as the production pose source.
- Use it as a survey-mapping baseline or secondary odometry comparison.
- Validate against RTK/INS, ground control points, and scan-to-map localization.
- Disable or heavily filter dynamic object insertion during mapping.
- Retune range-image and ground parameters for the actual LiDAR model and mounting.
- Prefer LIO-SAM, FAST-LIO2, KISS-ICP plus graph fusion, or a production VGICP localizer for deployed autonomy.

## Datasets/Metrics

Primary evaluation contexts:

- Variable-terrain UGV datasets collected by the authors.
- KITTI sequence experiments.
- Embedded runtime testing on NVIDIA Jetson-class hardware.
- Comparisons with LOAM on return-to-start and trajectory-error metrics.

The paper reports that LeGO-LOAM can achieve similar or better accuracy than LOAM while reducing computational cost, including real-time performance on embedded hardware after downsampling high-resolution KITTI scans to a VLP-16-like range image.

Recommended metrics:

- KITTI relative translation error and relative rotation error.
- Return-to-start translation and rotation error.
- Absolute trajectory error against RTK/INS.
- Ground-plane residual and map thickness.
- Feature counts by class: ground plane, non-ground plane, edge.
- Segmentation rejection rate for dynamic and small clusters.
- Runtime per stage on target hardware.
- Loop closure precision/recall and graph correction magnitude.

Airside-specific metrics should separately score apron-only driving, terminal-edge driving, stand approach, under-jet-bridge operation, and GNSS-denied segments.

## Open-Source Implementations

- **RobustFieldAutonomyLab/LeGO-LOAM:** The primary public implementation, BSD-3-Clause, ROS compatible, tested around VLP-16-style ground vehicles.
- **SC-LeGO-LOAM:** A Scan Context enhanced variant with stronger loop detection.
- **LIO-SAM:** The successor direction from the same research line, adding tightly coupled IMU preintegration and factor-graph smoothing.
- **Derivative ROS forks:** Many community forks exist for Noetic, Ouster, Livox, and custom vertical-angle configurations; these require careful validation because they change the sensor assumptions.

## Practical Recommendation

Use LeGO-LOAM when the task is to evaluate lightweight ground-vehicle LiDAR SLAM or to understand ground-optimized LOAM design. It is a reasonable baseline for a single horizontal spinning LiDAR on a low-speed UGV.

For airside 3D LiDAR SLAM Part A:

- Keep LeGO-LOAM as a baseline and historical bridge to LIO-SAM.
- Do not choose it as the default production mapper for a multi-LiDAR GSE platform.
- Do not rely on its naive ICP loop closure for global map quality.
- Use it to test whether ground segmentation and staged optimization help in apron and stand datasets.
- Prefer modern LiDAR-inertial or scan-to-map pipelines for operational deployment.

The practical verdict is "useful reference and embedded baseline, not a final production airside localization method."

## Sources

- Tixiao Shan and Brendan Englot, "LeGO-LOAM: Lightweight and Ground-Optimized Lidar Odometry and Mapping on Variable Terrain," IROS 2018. https://personal.stevens.edu/~benglot/Shan_Englot_IROS_2018_Preprint.pdf
- RobustFieldAutonomyLab/LeGO-LOAM repository. https://github.com/RobustFieldAutonomyLab/LeGO-LOAM
- LeGO-LOAM DOI entry, IEEE IROS 2018, DOI 10.1109/IROS.2018.8594299. https://doi.org/10.1109/IROS.2018.8594299
- SC-LeGO-LOAM repository. https://github.com/irapkaist/SC-LeGO-LOAM
- Tixiao Shan et al., LIO-SAM repository and paper links. https://github.com/TixiaoShan/LIO-SAM
- Ji Zhang and Sanjiv Singh, "LOAM: Lidar Odometry and Mapping in Real-time," RSS 2014. https://www.ri.cmu.edu/publications/loam-lidar-odometry-and-mapping-in-real-time/
