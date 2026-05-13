# Photoreal City-Scale 4D Reconstruction

Photoreal city-scale 4D reconstruction sits between SLAM, mapping, neural rendering, simulation, and world modeling. The key engineering question is not whether a method can render a convincing view. The key question is what role its output can safely play: pose source, reconstruction asset, digital twin, map QA layer, simulator scene, or planner-facing map.

This page is the cross-section entry point for Gaussian, NeRF, and feed-forward reconstruction methods that matter to autonomous driving and airside digital twins. It links the SLAM method library and first-principles knowledge base to existing perception, simulation, and world-model pages.

## Read This First

Use this page to separate four claims:

| Claim | What proves it | What does not prove it |
|---|---|---|
| Render quality | held-out RGB/depth/LiDAR render metrics, novel-view inspection, dynamic-region metrics | a visually impressive training-view video |
| Metric geometry | depth error, LiDAR residuals, surface accuracy, Chamfer/F-score, survey or RTK comparison | PSNR alone |
| Pose/localization quality | ATE/RPE, drift per distance/time, covariance or health behavior, loop-closure validation | a Gaussian map that looks aligned locally |
| Planner-safe occupancy | explicit free/occupied/unknown semantics, uncertainty, validation gates, safety-case evidence | a radiance field or Gaussian opacity map by itself |

## Method Role Taxonomy

| Role | Methods | Local starting point | How to use |
|---|---|---|---|
| Metric SLAM with Gaussian maps | Gaussian-LIC, Gaussian-LIC2, GS-LIVM, VIGS-SLAM, Splat-LOAM | [Gaussian-LIC and Gaussian-LIC2](../slam-methods/gaussian-lic.md) | Evaluate pose, timing, calibration, and Gaussian map quality separately. |
| Foundation/dense visual SLAM | SLAM3R, VGGT-SLAM, VGGT-SLAM++, MASt3R-SLAM, ViSTA-SLAM | [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md) | Use for reconstruction, visual map QA, and research baselines; do not assume safety localization. |
| Dynamic street 4D reconstruction | Street Gaussians, DrivingGaussian, OmniRe, S3Gaussian, PVG, OG-Gaussian, EmerNeRF | [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md) | Use for digital twins, replay, map cleaning, and simulation-support assets. |
| Feed-forward splatting and reconstruction | VGGT, AnySplat, pixelSplat, MVSplat-style methods | [Feed-Forward 3D Reconstruction and Splatting](../../../10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md) | Use for priors, initialization, quick reconstruction, and QA; audit hallucination and metric ambiguity. |
| Supporting first principles | volume rendering, 3DGS, neural implicit SLAM, continuous-time trajectories, calibration/timing | [Volume Rendering, Radiance Fields, and Gaussian Splatting](../../../10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md) | Use to debug why rendering, geometry, pose, and occupancy claims diverge. |

## Requested Method Coverage

| Method | Family | Current repo handling | Coverage action |
|---|---|---|---|
| Street Gaussians | tracked-object dynamic 3DGS | Covered in simulation/world-model pages | Summarized in the dynamic reconstruction KB taxonomy and linked from this hub. |
| OmniRe | omni dynamic urban 3DGS | Missing | Covered in the dynamic reconstruction KB taxonomy as full dynamic actor reconstruction. |
| S3Gaussian | self-supervised street 3DGS | Covered in simulation pages | Summarized in the dynamic reconstruction KB taxonomy. |
| EmerNeRF | self-supervised dynamic NeRF | Covered in simulation/world-model pages | Summarized in the dynamic reconstruction KB taxonomy as a NeRF-side decomposition baseline. |
| OG-Gaussian | occupancy-guided street Gaussian | Thin mention | Covered in the dynamic reconstruction KB taxonomy as occupancy-guided initialization and decomposition. |
| PVG | periodic vibration Gaussian | Covered in simulation/Gaussian overview pages | Summarized in the dynamic reconstruction KB taxonomy. |
| DrivingGaussian | composite surround-view 3DGS | Dedicated perception method page | Linked as the canonical atomic method page. |
| Gaussian-LIC | LiDAR-inertial-camera Gaussian SLAM | Dedicated SLAM method page | Linked as the metric Gaussian-SLAM baseline. |
| Gaussian-LIC2 | continuous-time LIC Gaussian SLAM | Covered in Gaussian-LIC page | Linked as the stronger continuous-time extension. |
| VGGT | feed-forward visual geometry model | Covered through VGGT-SLAM page | Covered in the feed-forward KB page and linked to foundation SLAM. |
| AnySplat | feed-forward 3DGS from unconstrained views | Missing | Covered in the feed-forward KB page. |
| pixelSplat | image-pair feed-forward 3DGS | Missing | Covered in the feed-forward KB page. |

## Reading Path By Intent

| Intent | Read in this order |
|---|---|
| I need a pose or SLAM method | [Production LiDAR Map Localization](production-lidar-map-localization.md) -> [Gaussian-LIC and Gaussian-LIC2](../slam-methods/gaussian-lic.md) -> [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md) -> [Dynamic 4D Gaussian SLAM](../slam-methods/dynamic-4d-gaussian-slam.md) |
| I need a photoreal digital twin | [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md) -> [3DGS Digital Twin Pipeline](../../simulation/3dgs-digital-twin.md) -> [Neural Scene Reconstruction](../../simulation/neural-scene-reconstruction.md) |
| I need feed-forward initialization or priors | [Feed-Forward 3D Reconstruction and Splatting](../../../10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md) -> [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md) |
| I need math and failure modes | [Volume Rendering, Radiance Fields, and Gaussian Splatting](../../../10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md) -> [Neural Implicit SLAM and Differentiable Mapping](../../../10-knowledge-base/mapping/neural-implicit-slam-differentiable-mapping-first-principles.md) -> [Continuous-Time Trajectory Splines and GP Priors](../../../10-knowledge-base/state-estimation/continuous-time-trajectory-splines-gp-priors.md) |
| I need occupancy or world-model context | [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md) -> [Occupancy Flow and 4D Scenes](../../world-models/occupancy-flow-4d-scenes.md) -> [DrivingGaussian](../../perception/methods/drivinggaussian.md) -> [SplatFlow](../../perception/methods/splatflow.md) |

## SLAM Versus Reconstruction Boundary

SLAM estimates trajectory and map state together. Dynamic Gaussian or radiance-field reconstruction may consume externally estimated poses, object tracks, camera calibrations, LiDAR priors, or dataset annotations and then optimize a renderable scene. That distinction determines whether a method belongs in the SLAM library or in reconstruction/simulation coverage.

Use this split:

| Output | Treat as |
|---|---|
| Real-time pose estimate plus map update loop | SLAM or odometry method |
| Renderable static/dynamic scene from known poses | reconstruction asset |
| RGB/depth/LiDAR novel views | simulator or QA artifact |
| Static-only layer after dynamic removal | map-cleaning candidate requiring validation |
| Occupancy, freespace, or traversability | planner-facing map only after explicit semantic and uncertainty validation |

## City-Scale Constraints

City-scale or airport-scale 4D reconstruction requires more than a good paper implementation.

| Constraint | Why it matters |
|---|---|
| Tiling and level of detail | One monolithic Gaussian scene will not scale to long routes, terminals, or full airport aprons. |
| Pose provenance | Reconstruction quality depends on whether poses came from SLAM, RTK/INS, LiDAR-inertial odometry, or dataset ground truth. |
| Calibration provenance | Camera-LiDAR-IMU errors can become duplicated surfaces, floaters, or dynamic-object ghosts. |
| Dynamic-layer lifecycle | Parked aircraft, parked GSE, cones, chocks, and shadows need policy before they become persistent infrastructure. |
| Held-out-view evaluation | Training-view render quality can hide overfitting and geometry errors. |
| Geometric checks | RGB metrics must be paired with depth, LiDAR, mesh, or survey comparisons. |
| Source-log lineage | Every rendered or edited asset needs route, timestamp, calibration, model, and edit provenance. |

## Airside And AV Deployment Cautions

- Use Gaussian/radiance reconstructions for simulation, visual QA, map cleaning research, and operator-facing digital twins before using them as autonomy authority.
- Keep a conservative multi-sensor localization stack as the pose authority until Gaussian map factors have calibrated health behavior.
- Validate reflective aircraft, wet pavement, glass, night floodlights, heat shimmer, rain, sparse geometry, parked movable objects, and repeated terminal structures separately.
- Separate observed real objects from edited or inserted simulated objects in metadata.
- Pair photoreal scene assets with occupancy/free-space validation when planners consume the output.

## Related Local Pages

- [Gaussian-LIC and Gaussian-LIC2](../slam-methods/gaussian-lic.md)
- [SLAM3R and VGGT Foundation SLAM](../slam-methods/slam3r-vggt-foundation-slam.md)
- [Dynamic 4D Gaussian SLAM](../slam-methods/dynamic-4d-gaussian-slam.md)
- [Feed-Forward 3D Reconstruction and Splatting](../../../10-knowledge-base/geometry-3d/feed-forward-3d-reconstruction-and-splatting.md)
- [Dynamic 4D Neural/Gaussian Reconstruction](../../../10-knowledge-base/mapping/dynamic-4d-neural-gaussian-reconstruction.md)
- [Volume Rendering, Radiance Fields, and Gaussian Splatting](../../../10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md)
- [Neural Implicit SLAM and Differentiable Mapping](../../../10-knowledge-base/mapping/neural-implicit-slam-differentiable-mapping-first-principles.md)
- [DrivingGaussian](../../perception/methods/drivinggaussian.md)
- [SplatFlow](../../perception/methods/splatflow.md)
- [Neural Scene Reconstruction](../../simulation/neural-scene-reconstruction.md)
- [3DGS Digital Twin Pipeline](../../simulation/3dgs-digital-twin.md)
- [Occupancy Flow and 4D Scenes](../../world-models/occupancy-flow-4d-scenes.md)

## Sources

- Gaussian-LIC repository: https://github.com/APRIL-ZJU/Gaussian-LIC
- Gaussian-LIC project page: https://xingxingzuo.github.io/gaussian_lic/
- Gaussian-LIC2 project page: https://xingxingzuo.github.io/gaussian_lic2/
- Street Gaussians: https://arxiv.org/abs/2401.01339
- S3Gaussian: https://arxiv.org/abs/2405.20323
- EmerNeRF ICLR 2024 page: https://proceedings.iclr.cc/paper_files/paper/2024/hash/47fc64d05a394955b1ae2487bfef1ab0-Abstract-Conference.html
- OmniRe: https://arxiv.org/abs/2408.16760
- PVG: https://arxiv.org/abs/2311.18561
- OG-Gaussian: https://arxiv.org/abs/2502.14235
- DrivingGaussian CVPR 2024: https://openaccess.thecvf.com/content/CVPR2024/html/Zhou_DrivingGaussian_Composite_Gaussian_Splatting_for_Surrounding_Dynamic_Autonomous_Driving_Scenes_CVPR_2024_paper.html
- VGGT: https://arxiv.org/abs/2503.11651
- AnySplat: https://arxiv.org/abs/2505.23716
- pixelSplat CVPR 2024: https://cvpr.thecvf.com/virtual/2024/poster/30256
