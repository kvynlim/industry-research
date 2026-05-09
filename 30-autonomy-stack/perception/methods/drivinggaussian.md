# DrivingGaussian

## What It Is

- DrivingGaussian is a CVPR 2024 method for reconstructing surrounding dynamic autonomous-driving scenes with 3D Gaussian Splatting.
- It is a neural scene reconstruction and simulation method, not an online detector, tracker, or localization backend.
- The key contribution is Composite Gaussian Splatting: a static-background Gaussian model plus a dynamic Gaussian graph for moving objects.
- It targets sparse, outward-facing multi-camera driving rigs where camera overlap is limited and dynamic actors create occlusion and temporal inconsistency.
- It uses LiDAR as a geometric prior when available, but the paper reports that the framework remains usable without LiDAR prior.
- It belongs with simulation-oriented 3DGS methods such as [SplatAD](splatad.md) and the broader [3D Gaussian Splatting for Driving](../overview/gaussian-splatting-driving.md) page.

## Core Technical Idea

- Decompose the scene into a large static background and multiple dynamic foreground objects.
- Build the static background progressively as the ego vehicle moves, instead of trying to optimize the entire unbounded scene at once.
- Use incremental static 3D Gaussians so distant, newly visible background is added in depth/time bins with overlapping multi-camera views as alignment cues.
- Use a composite dynamic Gaussian graph where each moving object is reconstructed in its own local object representation.
- Compose dynamic object Gaussians back into the global scene at the correct timestamp to preserve position and occlusion relationships.
- Initialize or regularize geometry with LiDAR priors so background surfaces and object shapes have better metric anchors than RGB-only splatting.
- Render all static and dynamic Gaussians jointly so the final surround-view image respects real occlusions among background and actors.

## Inputs and Outputs

- Inputs: synchronized surround-view images, camera intrinsics, camera extrinsics, ego poses, and optional LiDAR point clouds.
- Dynamic-object input: dataset-provided or detector/tracker-predicted 3D boxes and object IDs for foreground decomposition.
- Training output: optimized static Gaussian background and object-level dynamic Gaussian graph.
- Rendering output: photorealistic multi-camera RGB views from logged or edited viewpoints.
- Simulation output: edited scenes where dynamic objects can be inserted, removed, or moved for corner-case replay.
- Non-output: DrivingGaussian does not directly output planner-facing semantic occupancy, freespace, calibrated object tracks, or a safety-certified static map.

## Architecture or Pipeline

- Divide static scene construction into sequential bins using the ego trajectory and LiDAR or depth prior.
- Initialize visible static Gaussians from LiDAR points or other 3D priors.
- Optimize Gaussian positions, anisotropic covariances, opacities, and view-dependent color from surround camera supervision.
- Carry forward previous-bin Gaussians and add newly visible regions as the vehicle moves.
- Use overlapping image regions and weighted multi-view color integration to reduce front/rear camera appearance inconsistencies.
- Extract dynamic foregrounds with object boxes and identities.
- Reconstruct each dynamic object with object-local Gaussians, then attach it to a node in the dynamic Gaussian graph.
- Transform object Gaussians into the world frame at each timestamp and jointly rasterize static plus dynamic Gaussians.
- Use the composed scene for surrounding view synthesis, long-term dynamic reconstruction, and corner-case object editing.

## Training and Evaluation

- The paper evaluates dynamic driving-scene reconstruction and novel view synthesis on public autonomous-driving data.
- Metrics include PSNR, SSIM, and LPIPS for rendered images, with qualitative checks for dynamic object quality and multi-camera consistency.
- Ablations test the effect of LiDAR priors and the composite static/dynamic decomposition.
- The paper emphasizes that naive static 3DGS produces artifacts in unbounded dynamic scenes and that NeRF-style methods struggle with efficiency and long dynamic sequences.
- The official repository provides setup, training, and rendering scripts, but code access historically required signing an application while pretrained weights were released.
- Results should be interpreted as reconstruction/rendering quality, not perception accuracy or closed-loop safety performance.

## Strengths

- Strong static/dynamic separation makes it useful for dynamic-object removal and static-background extraction in mapping logs.
- Object-local dynamic Gaussians support controllable edits such as insertion, relocation, or removal of actors.
- LiDAR priors improve map hygiene by anchoring geometry and reducing hallucinated surfaces from sparse camera views.
- Joint rendering preserves occlusion relationships better than treating static background and actors as independent overlays.
- Surround-view design is closer to AV sensor rigs than single-front-camera urban NeRF methods.
- Useful for simulation asset generation, log replay, perception regression testing, and visual QA of dynamic-scene contamination.

## Failure Modes

- Dynamic decomposition depends on object boxes, tracks, and identities; bad tracking can create duplicated, smeared, or missing actors.
- Static objects that later move, such as parked GSE or baggage carts, can be baked into the wrong layer if temporal coverage is insufficient.
- LiDAR prior quality depends on calibration, timestamping, ego poses, and point-cloud density.
- Object-box assumptions are weak for articulated airside assets such as belt loaders, baggage trains, dollies, tow bars, jet bridges, and aircraft under pushback.
- The method optimizes for photorealistic rendering, not calibrated occupancy probabilities or physical contact constraints.
- Large extrapolations outside the logged trajectory remain risky, especially near reflective aircraft, wet pavement, glass, and night lighting.

## Airside AV Fit

- High fit for offline airside digital-twin construction and map cleaning from repeated stand, apron, and service-road logs.
- Dynamic object removal is valuable for producing clean static maps where temporary GSE, people, cones, chocks, and carts should not become infrastructure.
- Dynamic object insertion can create airside corner cases: a baggage tractor crossing, a fallen worker, a misplaced cone, or a GSE vehicle suddenly occluding a stand lead-in path.
- LiDAR-anchored reconstruction is important around aircraft because RGB-only methods can hallucinate smooth fuselage, glass, and wet-ground geometry.
- For airside use, separate static infrastructure, long-parked movable assets, active vehicles, personnel, aircraft, and shadows/weather artifacts in metadata.
- Treat DrivingGaussian outputs as simulation and QA artifacts; do not feed them directly into a safety case as authoritative occupancy or localization maps.

## Implementation Notes

- Keep static-background Gaussians versioned separately from dynamic-object Gaussian graphs.
- Store source log IDs, calibration versions, pose source, detector/tracker version, and LiDAR prior settings with every reconstructed scene.
- Add a review step that renders the static-only layer to catch dynamic-object ghosts before using it for map QA.
- For airport adaptation, define policies for stopped dynamic assets: parked belt loaders and parked aircraft are operationally movable, not permanent infrastructure.
- Evaluate scene edits with both visual metrics and geometric checks against LiDAR returns.
- Use explicit object provenance so simulated dynamic insertions cannot be confused with real observed obstacles.
- Pair the output with planner-facing occupancy methods rather than using photorealistic RGB render quality as a proxy for collision safety.

## Sources

- CVPR 2024 paper page: https://openaccess.thecvf.com/content/CVPR2024/html/Zhou_DrivingGaussian_Composite_Gaussian_Splatting_for_Surrounding_Dynamic_Autonomous_Driving_Scenes_CVPR_2024_paper.html
- CVPR 2024 paper PDF: https://openaccess.thecvf.com/content/CVPR2024/papers/Zhou_DrivingGaussian_Composite_Gaussian_Splatting_for_Surrounding_Dynamic_Autonomous_Driving_Scenes_CVPR_2024_paper.pdf
- Official repository: https://github.com/VDIGPKU/DrivingGaussian
- 3D Gaussian Splatting foundation paper: https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
