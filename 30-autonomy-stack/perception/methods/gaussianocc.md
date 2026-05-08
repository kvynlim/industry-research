# GaussianOcc

## What It Is

- GaussianOcc is an ICCV 2025 method for fully self-supervised 3D occupancy estimation with Gaussian splatting.
- It targets surround-view camera occupancy without requiring ground-truth 3D occupancy labels for training.
- It also removes the need for ground-truth 6D ego pose during training by learning pose through a Gaussian Splatting for Projection stage.
- The method is important because dense 3D occupancy labels are expensive, dataset-specific, and often unavailable in new domains such as airport airside operations.
- It is closely related to [3D Gaussian Splatting for Driving](../overview/gaussian-splatting-driving.md), [Self-Supervised Pretraining](../overview/self-supervised-pretraining-driving.md), and [Occupancy World Models](../../world-models/occupancy-world-models.md).

## Core Technical Idea

- Train occupancy from 2D supervision signals and adjacent-frame consistency instead of dense 3D voxel labels.
- Use Gaussian Splatting for Projection (GSP) to learn scale-aware 6D pose for adjacent-view projection.
- Use Gaussian Splatting from Voxel space (GSV) to render signals from a 3D voxel representation faster than conventional volume rendering.
- Lift image features into a 3D voxel space, then use Gaussian rendering to project predicted geometry back into 2D.
- Supervise with 2D depth and semantic maps while reserving 3D occupancy labels mainly for validation.
- The label-scarcity argument is central: manual voxel labels are costly in road scenes and almost nonexistent for airside object taxonomies.

## Inputs and Outputs

- Input at inference: surround camera images and calibrated camera intrinsics/extrinsics.
- Training input: image sequences, spatial camera extrinsics, 2D semantic annotation or generated semantic maps, and depth-related supervision signals.
- Training does not require ground-truth occupancy labels.
- Training does not require ground-truth 6D ego pose in the method's fully self-supervised setting.
- Output: semantic 3D occupancy prediction over a voxel volume.
- Intermediate output: learned 6D pose estimates from Stage 1 and rendered depth or semantic views from the Gaussian renderer.
- Validation input in the official setup can include Occ3D/nuscenes occupancy labels for evaluation only.

## Architecture or Pipeline

- Stage 1 trains a scale-aware 6D pose network.
- Stage 1 uses a U-Net-style network to predict Gaussian attributes in the 2D image grid for cross-view Gaussian splatting.
- The GSP module supplies scale information for adjacent-view projection and avoids relying on ground-truth ego pose.
- Stage 2 performs self-supervised 3D occupancy estimation.
- The model lifts 2D features into 3D voxel space.
- The GSV module renders from voxel space using Gaussian splatting rather than slower volume rendering.
- Rendered depth and semantic outputs are compared with 2D signals to train the 3D occupancy representation.

## Training and Evaluation

- The project evaluates on nuScenes and DDAD.
- The official repository uses nuScenes V1.0, Occ3D labels for validation, generated ground-truth depth maps for validation, and generated 2D semantic labels.
- The paper reports competitive self-supervised occupancy performance with lower computational cost.
- Reported efficiency gains are 2.7 times faster training and 5 times faster rendering relative to volume-rendering-based alternatives in the authors' setting.
- Metrics include IoU and mIoU for 3D occupancy plus depth-estimation comparisons in scale-aware settings.
- Results should be separated from fully supervised occupancy methods because the supervision budget is different.
- The codebase uses custom differentiable Gaussian rasterization submodules, so reproducing results requires matching CUDA, PyTorch, and data-preparation details.

## Strengths

- Directly attacks the main blocker for domain transfer: lack of dense 3D occupancy labels.
- Reduces dependence on expensive pose supervision during training.
- Gaussian rendering is faster than NeRF-style volume rendering for the self-supervised projection loss.
- The two-stage design separates pose-scale learning from occupancy learning, making failure analysis cleaner.
- Suitable for bootstrapping occupancy in domains where only camera logs and 2D labels or foundation-model masks are initially available.
- The repository includes code, dataset instructions, and pretrained checkpoint references.

## Failure Modes

- Self-supervised geometry can converge to plausible but wrong 3D structure when 2D projections are ambiguous.
- 2D semantic maps from foundation models or generated labels can inject systematic class errors into 3D occupancy.
- Learned pose or scale drift can contaminate Stage 2 occupancy training.
- Camera-only supervision struggles with invisible backsides, occluded ground contact, black surfaces, glass, and specular aircraft fuselage.
- Validation on road datasets does not prove reliability for airside long-tail objects or unusual camera viewpoints.
- The output is still a voxel occupancy grid, so final resolution and range choices can erase small FOD or thin tow bars.

## Airside AV Fit

- High research fit for airside because dense airside occupancy labels are unlikely to exist at useful scale.
- Useful for bootstrapping camera-based occupancy from operational logs before a full annotation program exists.
- Needs strong quality gates around generated 2D semantic labels for aircraft, GSE, personnel, cones, chocks, pavement markings, and FOD.
- Should be trained with synchronized LiDAR where possible, even if LiDAR is used only for validation or auxiliary depth checks.
- Not sufficient alone for safety-critical clearance near aircraft; use as a semantic occupancy layer fused with LiDAR/radar and maps.
- Most useful early deliverable is an annotation-efficient occupancy prior for planners, simulation, and anomaly review.

## Implementation Notes

- Reproduce official nuScenes or DDAD runs before changing the domain.
- Keep Stage 1 pose-scale diagnostics separate from Stage 2 occupancy metrics.
- Store the source and version of every 2D semantic label generator; changes in masks will change 3D occupancy behavior.
- Use held-out LiDAR and manual airside spot labels to audit self-supervised geometry, especially at object boundaries.
- Add airside validation slices for reflective aircraft, wet pavement, floodlights, night operations, snow or de-icing residue, and apron clutter.
- Avoid treating lack of 3D labels as lack of validation; self-supervised methods need stronger independent audits.
- Compare against simpler label-efficient baselines such as RenderOcc and SelfOcc before adopting GaussianOcc as the default.

## Sources

- ICCV 2025 paper page: https://openaccess.thecvf.com/content/ICCV2025/html/Gan_GaussianOcc_Fully_Self-supervised_and_Efficient_3D_Occupancy_Estimation_with_Gaussian_ICCV_2025_paper.html
- ICCV 2025 paper PDF: https://openaccess.thecvf.com/content/ICCV2025/papers/Gan_GaussianOcc_Fully_Self-supervised_and_Efficient_3D_Occupancy_Estimation_with_Gaussian_ICCV_2025_paper.pdf
- Official project page: https://ganwanshui.github.io/GaussianOcc/
- Official repository: https://github.com/GANWANSHUI/GaussianOcc
- arXiv paper: https://arxiv.org/abs/2408.11447
