# AutoOcc

## What It Is

- AutoOcc is an ICCV 2025 automatic open-ended semantic occupancy annotation pipeline.
- The full title is "AutoOcc: Automatic Open-Ended Semantic Occupancy Annotation via Vision-Language Guided Gaussian Splatting."
- It generates dense semantic occupancy labels from raw multi-view images, optionally with LiDAR constraints.
- It is an annotation and data-engine method, not a runtime safety perception model by itself.
- It supports open-ended semantic categories rather than a fixed closed-set taxonomy.
- The central representation is Vision-Language Guided Gaussian Splatting (VL-GS).

## Core Technical Idea

- Ask a vision-language model to discover or refine a dynamic semantic query list for the scene.
- Extract semantic attention maps from VLMs and visual foundation models.
- Represent semantic scene structure with semantic-aware scalable Gaussians instead of dense voxels or raw point clouds.
- Use self-estimated 3D flow to handle dynamic objects and reduce temporal trailing artifacts.
- Optionally use LiDAR geometry as an additional constraint.
- Convert the Gaussian scene representation into semantic occupancy with cumulative Gaussian-to-voxel splatting.

## Inputs and Outputs

- Input: multi-view camera images.
- Optional input: LiDAR point clouds for geometric constraints.
- Input metadata: camera calibration, ego pose, timestamps, and scene sequence.
- Foundation inputs: VLM semantic attention, SAM-style masks, UniDepth-style depth, and self-estimated flow.
- Output: dense semantic occupancy annotations.
- Output: open-ended category list discovered or refined by the VLM pipeline.
- Output: VL-GS scene representation that can be splatted to different voxel grids.

## Architecture or Pipeline

- Start with raw images and prompt a VLM to list scene objects or categories.
- Build semantic attention maps and masks from VLM/VFM outputs.
- Estimate depth and construct semantic-aware Gaussian primitives.
- Adjust Gaussian scale based on semantic attention and object geometry so large background areas and small objects are represented efficiently.
- Estimate 3D flow for dynamic objects and attach dynamic attributes to moving Gaussians.
- Add LiDAR geometric constraints when available.
- Forward-splat accumulated Gaussians into a semantic occupancy voxel grid.

## Training and Evaluation

- AutoOcc is evaluated on Occ3D-nuScenes and SemanticKITTI.
- On Occ3D-nuScenes, the paper reports AutoOcc-V with 83.01 IoU and 20.92 mIoU using cameras only.
- AutoOcc-M, using camera plus LiDAR, reports 88.62 IoU and 25.84 mIoU.
- In cross-dataset zero-shot evaluation on SemanticKITTI, AutoOcc-M reports 41.23 IoU and 12.76 mIoU.
- The paper reports about 30 GPU hours and 5.0 GB memory for AutoOcc annotation, compared with heavier manual or semi-automatic pipelines.
- Evaluation should include label correctness, open-ended category quality, dynamic-object consistency, and human QA acceptance rate.

## Strengths

- Reduces manual dense occupancy annotation cost.
- Supports category discovery instead of requiring a fixed class list before labeling.
- Gaussian primitives are more efficient than dense voxel annotation intermediates.
- Dynamic flow handling is important for moving vehicles and pedestrians.
- Can run in camera-only mode or use LiDAR constraints when available.
- Useful for bootstrapping occupancy datasets in domains with scarce 3D labels.

## Failure Modes

- VLM category discovery can hallucinate, merge, or split classes inconsistently.
- Open-ended labels need taxonomy normalization before training production models.
- Gaussian reconstruction can be geometrically plausible but wrong in safety-critical clearance zones.
- Foundation-model masks and depth estimates can fail under glare, night lighting, rain, spray, and reflective surfaces.
- Dynamic-object flow errors can smear labels through time.
- Auto-label quality must be audited; it should not be treated as human-reviewed ground truth.

## Airside AV Fit

- Strong data-engine fit because airside semantic occupancy labels are expensive and public datasets are sparse.
- Open-ended category discovery can reveal site-specific GSE, temporary maintenance equipment, cones, chocks, hoses, covers, FOD-like objects, and aircraft parts.
- Camera-only annotation is attractive for historical video logs, while LiDAR-constrained mode should be preferred for clearance-sensitive labels.
- Human review should focus on rare safety-critical classes and adverse conditions.
- Use AutoOcc to create training labels, not as the onboard emergency-stop source.
- Airside deployment needs a controlled taxonomy layer that maps VLM phrases into operational classes.

## Implementation Notes

- Store generated category names, prompts, model versions, and post-normalized taxonomy IDs.
- Keep AutoOcc-V and AutoOcc-M labels separate because their geometry evidence differs.
- Require review for labels near aircraft envelopes, stand boundaries, personnel, FOD, and planned vehicle paths.
- Add negative examples for glare, wet pavement, jet bridges, aircraft reflections, de-icing mist, and night floodlights.
- Measure downstream model performance against manually audited validation sets, not only auto-label agreement.
- Version voxel size, Gaussian parameters, depth model, VLM, SAM model, and LiDAR constraints with every label release.

## Sources

- ICCV 2025 open-access paper: https://openaccess.thecvf.com/content/ICCV2025/papers/Zhou_AutoOcc_Automatic_Open-Ended_Semantic_Occupancy_Annotation_via_Vision-Language_Guided_Gaussian_ICCV_2025_paper.pdf
- ICCV 2025 paper page: https://openaccess.thecvf.com/content/ICCV2025/html/Zhou_AutoOcc_Automatic_Open-Ended_Semantic_Occupancy_Annotation_via_Vision-Language_Guided_Gaussian_ICCV_2025_paper.html
- GroundingOcc follow-on: https://arxiv.org/abs/2508.01197
- Gaussian occupancy context: [GaussianOcc](gaussianocc.md)
