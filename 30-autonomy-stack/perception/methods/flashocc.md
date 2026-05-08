# FlashOcc

## What It Is

- FlashOcc is a fast and memory-efficient camera occupancy method based on a channel-to-height plugin.
- It keeps features in BEV for most computation and only expands channels into height at the output stage.
- The method is designed as a plug-and-play occupancy head for BEVDet-family frameworks.
- It targets deployment constraints where dense 3D voxel networks are too slow or memory-heavy.
- It is a semantic occupancy method, not a 3D detection method, though it can share BEVDet features.

## Core Technical Idea

- Avoid expensive dense 3D feature processing for occupancy.
- Keep the main representation as a BEV feature map so efficient 2D convolutions do most of the work.
- Predict output channels that encode height slices and semantic logits.
- Apply a channel-to-height transform to reshape BEV logits into a 3D occupancy volume.
- Use the BEVDet/BEVDepth/BEVStereo family as the image-to-BEV front end.
- The core insight is that height can be represented in channels until the final logits are needed.
- This trades some 3D interaction capacity for major runtime and memory savings.

## Inputs and Outputs

- Inputs: surround camera images, camera intrinsics/extrinsics, and BEVDet-style geometry metadata.
- Optional inputs: temporal frames if using BEVDetOCC-4D-Stereo or related backbones.
- Training inputs: Occ3D-nuScenes or compatible semantic occupancy labels.
- Output: 3D semantic occupancy grid after channel-to-height reshaping.
- Intermediate output: BEV feature map refined by 2D convolutions.
- It does not inherently produce instance IDs, object tracks, or box detections unless paired with other heads.

## Architecture

- Front end: BEVDet-style image backbone, depth/view transform, and BEV pooling.
- BEV encoder: 2D convolutional feature extraction in top-down space.
- Occupancy head: predicts a channel tensor whose channels correspond to height and class combinations.
- Channel-to-height plugin: reshapes or maps channel groups into vertical voxel logits.
- Temporal/stereo variants can use BEVDetOCC-4D-Stereo or stronger image backbones.
- Panoptic-FlashOcc adds panoptic occupancy through instance-center modeling, but base FlashOcc is semantic occupancy.
- Official repository includes training code, TensorRT testing code, and later FlashOccV2/Panoptic-FlashOcc updates.

## Training and Evaluation

- Primary benchmark: Occ3D-nuScenes semantic occupancy.
- Metrics include mIoU, FPS, FLOPs, and parameter count.
- The arXiv paper reports better precision, runtime efficiency, and memory cost than previous occupancy baselines under its settings.
- Official README reports FlashOCC R50 256x704 variants at about 31.95 to 32.08 mIoU with 152.7 to 197.6 FPS in TensorRT FP16 on RTX 3090.
- The README reports FlashOCC-4D-Stereo variants improving BEVDetOCC-4D-Stereo, including a Swin-B setting at 43.52 mIoU.
- The repo notes a 2024 technical report where FlashOcc can be inserted into BEVDet with about 1.1 ms consumption.
- Evaluation must disclose backend because PyTorch FPS and TensorRT FP16 FPS are not comparable.

## Strengths

- Very deployment-oriented compared with dense 3D occupancy networks.
- Uses mature BEVDet-family components and avoids many 3D custom kernels.
- 2D convolutional BEV processing maps well to common accelerators.
- Can improve occupancy without fully replacing an existing BEV detector stack.
- Strong option when latency and memory are first-order constraints.
- Simple conceptual interface: BEV features in, voxel logits out.

## Failure Modes

- Channel-to-height has limited explicit 3D neighborhood reasoning before output.
- Vertical ambiguity can be compressed into channels and may be harder to correct than in true 3D convolutions.
- Thin or overhanging objects may suffer if BEV features do not preserve enough height evidence.
- Occupancy quality depends heavily on the front-end depth/view transform.
- Reported FPS may rely on TensorRT FP16 and specific hardware, so direct deployment may be slower.
- The method can overfit to Occ3D-nuScenes height/range conventions if not retuned.

## Airside AV Fit

- Strong practical fit for airside vehicles that need occupancy-like output on embedded compute.
- BEV-first processing matches apron planning grids and low-speed vehicle control.
- Needs careful validation for vertical hazards: wings, loader booms, stairs, jet bridges, and service equipment.
- Channel-to-height may be sufficient for ground-level GSE but risky for aircraft overhang clearance without LiDAR validation.
- Good candidate for a camera fallback occupancy stream when LiDAR is degraded.
- Must include night, glare, wet pavement, and camera contamination tests before operational use.

## Implementation Notes

- Start from an existing BEVDetOCC or BEVDepth-compatible config to avoid geometry plumbing errors.
- Treat the channel-to-height mapping as part of the model contract; changing height bins requires head changes.
- Benchmark both PyTorch and TensorRT on target hardware.
- Check memory bandwidth, not only FLOPs, because BEV reshaping and logits can dominate.
- For airside, increase or retune vertical bins around aircraft and equipment height ranges.
- Add visibility and uncertainty masks if the planner consumes the dense occupancy grid directly.
- Keep base FlashOcc separate from Panoptic-FlashOcc in documentation and metrics.

## Sources

- FlashOcc paper: https://arxiv.org/abs/2311.12058
- Official FlashOCC repository: https://github.com/Yzichen/FlashOCC
- BEVDet paper: https://arxiv.org/abs/2112.11790
- Occ3D benchmark paper: https://arxiv.org/abs/2304.14365
