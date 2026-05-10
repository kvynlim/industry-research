# BEVDepth

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av"]
  reason: "Important depth-aware BEV bridge for camera-only 3D perception."
method-priority:end -->

## What It Is

- BEVDepth is a camera-only multi-view 3D object detector built to fix unreliable depth in BEV lifting.
- It extends the BEVDet/LSS family with explicit depth supervision and camera-aware depth estimation.
- The method targets the observation that BEV camera detectors are depth-limited even when the BEV head is strong.
- It remains a BEV detector, not a dense occupancy method.
- The paper and official code established a common baseline for later temporal stereo and occupancy systems.

## Core Technical Idea

- Supervise the image-to-BEV lift with depth targets projected from LiDAR.
- Predict depth distributions that are aware of camera intrinsics and extrinsics, rather than treating every camera equally.
- Lift image features through the supervised depth distribution into a frustum.
- Use efficient voxel pooling to aggregate lifted features into BEV without excessive memory overhead.
- Add a depth refinement module to reduce artifacts from imprecise feature unprojection.
- Fuse multiple frames for stronger temporal cues while keeping the detection head in BEV.
- The key claim is that better depth estimation improves BEV detection more reliably than only scaling the detector head.

## Inputs and Outputs

- Inputs at inference: surround camera images, calibrated camera intrinsics, camera-to-ego extrinsics, and ego-motion metadata.
- Inputs at training: the above plus 3D box labels and LiDAR-derived depth maps or depth points.
- Output: nuScenes-style 3D boxes in ego coordinates with class scores and velocity estimates.
- Intermediate output: per-camera dense or binned depth probability maps.
- Intermediate output: BEV feature map after efficient voxel pooling.
- The model does not natively output dense semantic occupancy or freespace confidence.

## Architecture

- Image encoder extracts multi-scale image features for each camera.
- Camera-aware depth module conditions depth prediction on camera parameters.
- View transformer lifts per-pixel features into depth bins and projects them to ego-frame voxels.
- Efficient voxel pooling aggregates projected features into BEV with lower memory and latency than naive splatting.
- Depth refinement module improves lifted features after projection.
- BEV encoder applies 2D convolutional processing over the fused top-down map.
- Detection head follows the CenterPoint/BEVDet style for class heatmaps and box regression.
- Multi-frame variants align historical BEV features or inputs using ego motion.

## Training and Evaluation

- Primary benchmark: nuScenes camera-only 3D object detection.
- Uses 3D detection losses plus an explicit depth loss from LiDAR-projected depth supervision.
- Official code expects nuScenes data preparation and generated depth ground truth.
- The paper reports 60.9% NDS on the nuScenes test set while maintaining high efficiency.
- The official repository reports BEVDepth/BEVStereo validation configurations with mAP, NDS, mATE, mASE, mAOE, mAVE, and mAAE.
- Ablations isolate depth supervision, camera-aware depth, depth refinement, efficient pooling, and multi-frame use.
- Evaluation should disclose backbone, image size, CBGS, EMA, and frame count because these materially change results.

## Strengths

- Directly addresses the central weakness of camera-only 3D detection: metric depth.
- LiDAR-projected depth supervision is practical on road datasets where LiDAR exists during training.
- Efficient voxel pooling makes the method more deployable than dense 3D projection approaches.
- Camera-aware depth improves robustness across different camera views and optics.
- BEV output remains easy to fuse with map priors, planning, and tracking.
- Strong baseline for downstream occupancy heads that need good camera-to-3D lifting.

## Failure Modes

- Requires LiDAR-derived depth supervision during training; pure camera-only data collection is not enough to reproduce the original recipe.
- Sparse LiDAR depth leaves holes, especially at long range and on reflective surfaces.
- Camera-aware depth can overfit to a fixed rig and degrade after camera replacement or recalibration drift.
- Moving objects can create depth-label noise when LiDAR and camera timestamps are imperfect.
- Depth refinement cannot fully recover geometry behind occluders.
- The detector still uses boxes, so irregular airside objects remain underrepresented.

## Airside AV Fit

- Good candidate when an airside fleet can collect LiDAR during training but wants a camera-heavy runtime stack.
- Useful for aprons where object classes have strong geometry but camera depth is ambiguous on open pavement.
- Needs new depth supervision for aircraft-scale geometry, tow bars, belt loaders, dollies, and personnel around stands.
- Wet concrete, glass terminal facades, reflective aircraft, and night floodlights should be explicit validation slices.
- Camera-only depth should not be the sole safety basis for clearance near aircraft wings or engine zones.
- Pair with LiDAR/radar, map constraints, and conservative uncertainty gates for operational use.

## Implementation Notes

- Preserve exact camera intrinsics/extrinsics in data pipelines; depth bins are sensitive to calibration conventions.
- Generate depth ground truth with timestamp compensation and dynamic-object filtering where possible.
- Tune depth-bin range and resolution for airside stopping distance, not only nuScenes defaults.
- Track depth loss separately by camera, range, and class to find rig-specific failures.
- Validate inference after TensorRT or ONNX export because voxel pooling often involves custom CUDA kernels.
- Compare against BEVDet with identical backbone, image size, and schedule to quantify the value of depth supervision.
- If extending to occupancy, keep the depth head and replace or supplement the detection head with voxel/height logits.

## Sources

- BEVDepth paper: https://arxiv.org/abs/2206.10092
- Official BEVDepth repository: https://github.com/Megvii-BaseDetection/BEVDepth
- BEVDet paper: https://arxiv.org/abs/2112.11790
- nuScenes detection benchmark: https://www.nuscenes.org/object-detection
