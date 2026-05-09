# HUGS Urban Gaussians

## What It Is

- HUGS is a CVPR 2024 method for holistic urban 3D scene understanding via Gaussian Splatting.
- It jointly models geometry, appearance, semantics, flow, exposure, and dynamic objects in one Gaussian scene representation.
- It is not only a novel-view synthesis method; it also extracts 2D and 3D semantic outputs and supports dynamic-scene decomposition and editing.
- Unlike methods that require clean 3D boxes for every moving object, HUGS regularizes object motion with physical constraints so it can tolerate noisy dynamic-object localization.
- The method is most relevant to perception research, dynamic map hygiene, semantic scene reconstruction, and simulation support.

## Core Technical Idea

- Represent static background and moving objects with separate Gaussian components.
- Attach semantic logits and additional modalities to Gaussians instead of using them only as RGB radiance primitives.
- Use dynamic object poses but regularize them with a unicycle motion model so optimization remains physically plausible under noisy boxes.
- Optimize geometry, appearance, semantics, motion, optical-flow-related constraints, and camera exposure together.
- Use the explicit Gaussian representation to extract semantic point clouds, not just rendered 2D semantic images.
- Preserve dynamic objects as editable scene components rather than only deleting them as outliers.

## Inputs and Outputs

- Inputs: RGB image sequences, camera calibration, camera poses, semantic cues, and noisy or predicted dynamic-object boxes/tracks where available.
- Optional or derived training signals: 2D semantic labels, optical flow, depth-related supervision, and camera exposure information.
- Output: RGB novel-view renderings.
- Output: rendered 2D semantics and a 3D semantic Gaussian or point-cloud representation.
- Output: decomposed foreground/background scene components for object editing.
- Intermediate output: optimized static Gaussians, dynamic object Gaussians, object poses, exposure parameters, semantic logits, and flow-related state.
- Non-output: HUGS does not directly produce planner-ready occupancy flow or certified object tracks.

## Architecture or Pipeline

- Initialize a Gaussian representation for the observed urban scene.
- Separate static background from dynamic objects.
- Optimize static Gaussians for geometry, color, semantic label distribution, and exposure-aware rendering.
- Optimize dynamic object Gaussians and object poses, using the unicycle model to regularize yaw, translation, and temporal consistency.
- Render RGB, semantics, and related modalities from target views through Gaussian rasterization.
- Use semantic and flow losses as geometric and correspondence cues.
- Extract a semantic point cloud by thresholding or selecting optimized semantic Gaussians.
- Perform scene editing by removing, replacing, translating, or rotating dynamic object components.

## Training and Evaluation

- The paper evaluates on KITTI, KITTI-360, and Virtual KITTI 2.
- Evaluation includes novel-view synthesis quality, semantic synthesis, semantic point-cloud quality, and robustness to noisy 3D boxes.
- Metrics include PSNR, SSIM, LPIPS, depth-related error, and tracking or pose errors in dynamic-object ablations.
- A key ablation injects noise into KITTI 3D boxes and shows that the unicycle constraint improves both rendering quality and 3D tracking accuracy.
- Static-scene ablations show exposure modeling matters under strong exposure variation.
- The paper reports real-time rendering capability for new viewpoints.

## Strengths

- Explicitly connects rendering and scene understanding: geometry, semantics, and dynamics are optimized in one representation.
- Semantic Gaussians are useful for static map QA because labels live in 3D rather than only in projected image space.
- Foreground/background decomposition enables dynamic object removal and clean static-background inspection.
- Physical motion regularization reduces dependence on perfect 3D boxes.
- Scene editing is practical for simulation because dynamic objects remain separated from static infrastructure.
- Exposure modeling is relevant to real AV logs where cameras see different brightness and auto-exposure states.

## Failure Modes

- RGB-centric supervision remains vulnerable to glare, shadows, low texture, rain, spray, and night floodlights.
- The unicycle model fits road vehicles better than articulated GSE, walking workers, aircraft pushback, or multi-trailer baggage carts.
- Semantic Gaussians inherit errors from 2D semantic labels or pseudo-labels.
- Stopped movable objects can be misclassified as static infrastructure if training clips do not capture motion.
- The extracted semantic point cloud is useful for analysis but is not a calibrated occupancy grid.
- Camera-pose and calibration errors can appear as geometry errors, semantic ghosts, or duplicated dynamic assets.

## Airside AV Fit

- Strong research fit for generating semantic static maps from camera logs around stands, gates, terminal frontage, and service roads.
- Useful for dynamic map cleaning: remove people, GSE, temporary cones, and transient vehicles before comparing repeated-day maps.
- The semantic Gaussian layer can highlight map hygiene issues such as ghost vehicles, mislabeled ground markings, or stale temporary equipment.
- Airside transfer would need motion priors beyond unicycle constraints: pushback aircraft arcs, baggage-cart trains, belt-loader articulation, pedestrian motion, and jet-bridge geometry.
- Scene editing can support simulation of GSE placement changes and temporary stand obstruction.
- For safety, use HUGS outputs as offline reconstruction and semantic QA evidence, not as online obstacle authority.

## Implementation Notes

- Keep object-level dynamic components editable and traceable back to source tracks.
- For airside datasets, add classes for aircraft, towbar, chock, cone, dolly, baggage cart, belt loader, fuel truck, catering truck, crew, jet bridge, and ground markings.
- Use static-only renders as a map-cleaning checkpoint before exporting any background asset.
- Add rules for objects that are parked for many minutes but operationally movable.
- Validate 3D semantic point clouds against LiDAR or surveyed map geometry, not only against rendered 2D semantic views.
- If adapting the motion model, preserve a physically interpretable parameterization so optimization cannot explain bad tracks with impossible motion.

## Sources

- CVPR 2024 paper page: https://openaccess.thecvf.com/content/CVPR2024/html/Zhou_HUGS_Holistic_Urban_3D_Scene_Understanding_via_Gaussian_Splatting_CVPR_2024_paper.html
- CVPR 2024 paper PDF: https://openaccess.thecvf.com/content/CVPR2024/papers/Zhou_HUGS_Holistic_Urban_3D_Scene_Understanding_via_Gaussian_Splatting_CVPR_2024_paper.pdf
- Official project page: https://xdimlab.github.io/hugs_website/
- Official repository: https://github.com/hyzhou404/HUGS
