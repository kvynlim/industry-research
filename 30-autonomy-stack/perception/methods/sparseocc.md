# SparseOcc

## What It Is

- SparseOcc is a CVPR 2024 vision-based semantic occupancy network built around sparse 3D latent features.
- It challenges dense voxel, BEV, and TPV representations for occupancy prediction.
- The method keeps the 3D latent representation sparse in COO-style coordinates and processes only active voxels.
- It is inspired by sparse point-cloud processing but uses camera images as input.
- It is an occupancy method, not the separate ECCV 2024 MCG-NJU project with the same SparseOcc name.

## Core Technical Idea

- Start from camera features lifted to 3D with a Lift-Splat-Shoot style view transform.
- Convert the resulting mostly empty 3D tensor into a sparse representation by gathering non-empty voxels.
- Perform latent completion with sparse 3D operations rather than dense 3D convolutions.
- Use a sparse latent diffuser to propagate information from observed non-empty regions to nearby empty regions.
- Build a sparse feature pyramid with interpolation across scales for larger receptive fields.
- Redesign the transformer head as a sparse head that segments occupied voxels instead of every voxel.
- Preserve 3D geometry better than BEV/TPV while avoiding dense cubic cost.

## Inputs and Outputs

- Inputs: monocular or surround camera images, calibration, and view-transform geometry.
- Training inputs: semantic occupancy labels on nuScenes-Occupancy or SemanticKITTI, plus depth supervision for the LSS component.
- Output: dense semantic occupancy after scattering sparse predictions back to the voxel grid.
- Intermediate output: sparse tensor coordinates and features for active voxels.
- Intermediate output: coarse binary non-empty predictions used to filter voxels for the sparse transformer head.
- It does not output object boxes or instance tracks by default.

## Architecture

- 2D encoder: ResNet/FPN-style image feature extractor.
- View transform: LSS lifts image features into 3D using predicted depth.
- Sparse conversion: dense lifted tensor is converted to sparse COO features.
- Sparse latent diffuser: sparse completion block plus contextual aggregation block.
- Kernel decomposition: 3D kernels are decomposed into orthogonal kernels to improve efficiency and shape modeling.
- Sparse feature pyramid: downsampled sparse scales are fused through sparse interpolation.
- Sparse transformer head: Mask2Former-style query head adapted to sparse occupied voxels and a learnable empty token.
- Scatter step reconstructs dense masks from sparse predictions for loss and output.

## Training and Evaluation

- Benchmarks: nuScenes-Occupancy validation and SemanticKITTI semantic scene completion.
- Metrics: occupied IoU for geometry and mIoU for semantic occupancy.
- The paper reports 74.9% FLOP reduction over a dense baseline while improving mIoU from 12.8% to 14.1% on nuScenes-Occupancy.
- The arXiv HTML table reports SparseOcc at 21.8 IoU and 14.1 mIoU on nuScenes-Occupancy validation with 455G FLOPs and 13G memory.
- The same table reports 0.19 s 3D latency and 0.25 s overall latency for the listed setting.
- SemanticKITTI results show competitive mIoU with much lower FLOPs than dense or TPV baselines.
- Losses include mask/class losses with Hungarian assignment, depth loss, and coarse binary segmentation loss.

## Strengths

- Large efficiency gain over dense 3D occupancy models.
- Keeps real 3D coordinates instead of compressing height into BEV.
- Reduces hallucination on empty voxels by not spending model capacity everywhere.
- Sparse feature pyramid gives completion capacity without fully densifying the scene.
- Sparse transformer head targets the expensive part of semantic occupancy directly.
- Good candidate for embedded occupancy when dense 3D volumes are too costly.

## Failure Modes

- Sparse representation depends on the initial lifted features; missed active regions may never be recovered.
- Completion is local and can fail for large occluded objects or long-range invisible space.
- Sparse CUDA and custom ops can complicate deployment on automotive accelerators.
- The empty token and binary filtering can suppress rare small objects if thresholds are poorly tuned.
- LSS depth errors still determine where camera evidence enters 3D.
- Dense output after scatter may look complete while uncertainty remains poorly calibrated.

## Airside AV Fit

- Attractive for airside occupancy because open apron space is mostly empty, so sparse compute should help.
- Better than pure BEV for vertical structures such as stairs, loader masts, wing edges, and jet bridge components.
- Risky for small safety objects such as chocks, cones, hoses, and FOD if initial sparse activation misses them.
- Needs airside-specific sparse label QA around low-height and thin objects.
- Sparse processing could support larger apron ranges than dense 3D volumes under the same compute budget.
- Should be paired with explicit uncertainty and conservative planning masks near aircraft and personnel.

## Implementation Notes

- Do not confuse this method with other projects named SparseOcc; cite VISION-SJTU/Tang et al. for this file.
- Audit coordinate order, voxel size, and sparse tensor backend before comparing results.
- Tune sparse activation thresholds for rare airside objects, not only aggregate mIoU.
- Test custom sparse ops on the target accelerator early.
- Monitor active voxel count by range and class; unexpected densification removes the efficiency benefit.
- Keep the dense scatter path deterministic for reproducible evaluation.
- For airside, add visible/occluded split metrics and thin-object recall.

## Sources

- SparseOcc paper: https://arxiv.org/abs/2404.09502
- CVF open-access paper: https://openaccess.thecvf.com/content/CVPR2024/papers/Tang_SparseOcc_Rethinking_Sparse_Latent_Representation_for_Vision-Based_Semantic_Occupancy_Prediction_CVPR_2024_paper.pdf
- Official SparseOcc repository: https://github.com/VISION-SJTU/SparseOcc
- SparseOcc project page: https://pintang1999.github.io/sparseocc.html
