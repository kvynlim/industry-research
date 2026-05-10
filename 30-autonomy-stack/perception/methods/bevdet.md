# BEVDet

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av"]
  reason: "Baseline camera BEV detector that organizes many later BEV methods."
method-priority:end -->

## What It Is

- BEVDet is a camera-only, multi-camera 3D object detector that predicts boxes in bird's-eye view.
- The method reframes surround-view detection around a BEV feature map instead of per-camera 3D box heads.
- It is a representative Lift-Splat-Shoot style detector: image features are lifted with depth bins and pooled into BEV.
- The paper's main contribution is not a new backbone, but a practical detection paradigm with BEV-space augmentation and NMS.
- It is useful as the baseline ancestor for BEVDepth, BEVStereo, FlashOcc, and many occupancy heads.

## Core Technical Idea

- Move the detection head to BEV, where 3D centers, yaw, velocity, and planning geometry are naturally defined.
- Extract image features independently for each surround camera.
- Predict a per-pixel depth distribution to lift 2D features into a camera frustum.
- Transform frustum features into the ego-vehicle coordinate frame using calibrated intrinsics and extrinsics.
- Pool or splat the transformed features into a shared BEV grid.
- Run a BEV encoder and center-based 3D detection head on the fused top-down tensor.
- Add BEV-space data augmentation so geometric transforms remain consistent across all cameras and labels.
- Replace vanilla NMS with BEV-aware post-processing to reduce duplicate boxes from multi-camera overlap.

## Inputs and Outputs

- Inputs: synchronized surround camera images, camera intrinsics, camera-to-ego extrinsics, and ego pose metadata.
- Optional training input: LiDAR-derived or box-derived depth supervision if inherited from later variants, but original BEVDet is primarily detection-supervised.
- Output: class-labeled 3D bounding boxes in ego coordinates.
- Output fields generally include center, dimensions, yaw, velocity, confidence, and category.
- The representation assumes a fixed BEV range and voxel or grid resolution around the ego vehicle.
- It does not output dense freespace, semantic occupancy, or instance masks by itself.

## Architecture

- Image backbone: standard 2D CNN such as ResNet, usually with an FPN-style neck.
- View transform: LSS-style lift from 2D features to a discrete depth frustum.
- Geometry transform: camera frustum samples are mapped into ego-frame 3D coordinates.
- BEV pooling: features that fall into the same BEV cell are aggregated.
- BEV backbone: 2D convolutions refine the fused top-down feature map.
- Detection head: CenterPoint-like BEV head predicts class heatmaps and box regression targets.
- The implementation lineage is close to MMDetection3D and CenterPoint-style training code.
- BEVDet4D extends the single-frame model with temporal BEV feature alignment, but the base page should be read as the BEVDet paradigm.

## Training and Evaluation

- Dataset focus: nuScenes multi-camera 3D detection.
- Training labels are 3D boxes with nuScenes detection classes and attributes.
- Losses are typical center-based detection losses: heatmap focal loss plus box regression losses.
- The paper reports BEVDet-Tiny at 31.2% mAP and 39.2% NDS on nuScenes validation.
- BEVDet-Tiny is reported as using only about 11% of FCOS3D's computational budget and running at 15.6 FPS.
- BEVDet-Base is reported at 39.3% mAP and 47.2% NDS on nuScenes validation.
- The reported value proposition is a speed/accuracy tradeoff rather than best possible long-term temporal accuracy.
- Evaluation should separate single-frame BEVDet from later temporal or depth-supervised descendants.

## Strengths

- Simple, modular, and reproducible baseline for camera-only BEV detection.
- BEV coordinates make downstream fusion with planning, maps, and motion prediction straightforward.
- Efficient because the heavy spatial reasoning happens in 2D BEV convolutions, not dense 3D volumes.
- Multi-camera fusion is explicit and geometry-aware.
- The architecture is easy to extend with temporal frames, better depth, radar, LiDAR, or occupancy heads.
- Mature open-source lineage makes it a practical reference for config structure and deployment experiments.

## Failure Modes

- Depth ambiguity remains the main weakness because lifting depends on monocular depth distributions.
- Thin, low-texture, or distant objects can be placed at the wrong range.
- BEV pooling may smear vertical structure because height is compressed for detection.
- Calibration errors directly corrupt the camera-to-BEV projection.
- Occluded objects and non-box-shaped hazards are poorly represented by a box-only head.
- Performance can degrade sharply under night glare, wet apron reflections, lens contamination, or camera dropout.

## Airside AV Fit

- Good fit as a low-cost camera BEV detector for GSE, vehicles, personnel, cones, and service carts.
- Useful as a fallback perception stream when LiDAR is degraded or unavailable.
- The box-only output is insufficient for aircraft wings, tow bars, hoses, chocks, jet blast cones, and FOD.
- Airside deployment needs class remapping, larger object extents, and long-range validation on open apron geometry.
- It should be paired with LiDAR/radar or occupancy for safety-critical freespace and overhang reasoning.
- Treat BEVDet as a baseline architecture, not a final safety case for aircraft-stand operations.

## Implementation Notes

- Verify camera calibration and timestamp alignment before tuning model capacity.
- Keep BEV range and grid resolution tied to vehicle stopping distance and stand-approach envelope.
- Use airside-specific augmentations: night floodlights, wet concrete, reflective aircraft skin, service-road markings, and unusual object scales.
- Add explicit camera health checks because BEV projection failures can look like confident empty space.
- For runtime, export the image backbone, view transform, and BEV head separately to profile memory movement.
- If dense occupancy is required, use BEVDet as a feature backbone but add an occupancy-specific head such as FlashOcc.
- Avoid mixing BEVDet, BEVDet4D, BEVDepth, and BEVStereo metrics unless the temporal and depth-supervision settings match.

## Sources

- BEVDet paper: https://arxiv.org/abs/2112.11790
- Official BEVDet repository: https://github.com/HuangJunJie2017/BEVDet
- Lift-Splat-Shoot paper: https://arxiv.org/abs/2008.05711
- nuScenes detection benchmark: https://www.nuscenes.org/object-detection
