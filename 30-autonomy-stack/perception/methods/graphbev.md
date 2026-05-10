# GraphBEV

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "GraphBEV is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- GraphBEV is a robust BEV feature alignment framework for camera-LiDAR 3D object detection.
- The full paper title is "GraphBEV: Towards Robust BEV Feature Alignment for Multi-Modal 3D Object Detection."
- It was released as an ECCV 2024 work with an official GitHub implementation.
- The method focuses on feature misalignment caused by imperfect camera-LiDAR calibration.
- It targets BEVFusion-style detectors that project camera features into BEV using LiDAR depth supervision.
- The goal is to preserve detection quality when calibration noise perturbs local and global alignment.

## Core Technical Idea

- GraphBEV splits misalignment into local depth misalignment and global BEV feature offset.
- LocalAlign improves camera-to-BEV lifting by using neighbor-aware depth features.
- Neighbor depths are constructed with graph matching and KD-tree nearest-neighbor relations over projected LiDAR points.
- A Dual Transform and DepthNet fuse projected depth, neighbor depth, and image context.
- GlobalAlign learns offsets between camera BEV and LiDAR BEV features.
- Offset noise is added during training to simulate global misalignment.
- During inference, learned offsets align BEV features without injecting artificial noise.

## Inputs and Outputs

- Inputs are six nuScenes-style camera images, a LiDAR point cloud, and camera-LiDAR calibration matrices.
- Camera features are produced with a Swin Transformer plus FPN in the reported implementation.
- LiDAR BEV features are produced with a SECOND-style encoder.
- Intermediate outputs include depth-aware camera BEV features and aligned fused BEV features.
- Final outputs are 3D object detections in BEV and 3D box space.
- The method assumes the sensors are approximately calibrated and share enough overlap for neighbor construction.
- It is not a targetless calibration method; it is a detector-side robustness layer.

## Architecture or Benchmark Protocol

- The baseline architecture is BEVFusion.
- LocalAlign is inserted into the view transformation path of the camera branch.
- Projected LiDAR points provide pixel depths, but GraphBEV augments each depth with nearby projected depths.
- The augmented depth representation reduces sensitivity to projection matrix error.
- The LiDAR branch compresses voxel features along height into a 2D BEV tensor.
- GlobalAlign concatenates LiDAR BEV and camera BEV features, learns spatial offsets, and grid-samples aligned features.
- A dense detection head produces final boxes after fusion.
- The official code is built on BEVFusion, OpenPCDet, PyTorch, and mmdetection3d-style tooling.

## Training and Evaluation

- Evaluation uses the nuScenes 3D object detection benchmark.
- Primary metrics are mAP and nuScenes Detection Score.
- The paper reports 70.1 mAP and 72.9 NDS on nuScenes validation.
- Robustness is measured with simulated camera-LiDAR projection misalignment noise.
- GraphBEV reports an 8.3 point mAP gain over BEVFusion under noisy misalignment settings.
- The implementation uses common BEVFusion training augmentations: flips, rotations, translations, scaling, and CBGS.
- Latency and resource results are measured on GPU workstations, not embedded automotive compute.

## Strengths

- It addresses a silent failure mode: good-looking sensors with slightly wrong extrinsics.
- Local and global alignment are handled separately, which matches the failure physics.
- It can improve clean-set accuracy while also improving noisy alignment robustness.
- The method is compatible with BEVFusion-like designs already used in research stacks.
- Neighbor-aware depth is practical because LiDAR projection errors often land on nearby pixels.
- It does not require online recalibration or a calibration target at inference.

## Failure Modes

- Large extrinsic errors can move projected points outside the correct neighborhood.
- LocalAlign depends on available LiDAR points; sparse long-range regions may remain weak.
- GlobalAlign learns offsets from training distributions and can overfit to synthetic noise patterns.
- The method does not fix temporal skew, rolling shutter, or sensor dropouts.
- It assumes the camera and LiDAR observations describe the same scene region.
- KD-tree neighbor construction and alignment modules add engineering complexity.
- It is evaluated mainly on road scenes, not aircraft aprons or industrial yards.

## Airside AV Fit

- GraphBEV is highly relevant for airport vehicles because vibration, maintenance, and sensor replacement can cause small calibration drift.
- Aprons include large flat surfaces where small BEV alignment errors can shift cones, chocks, or pedestrians into unsafe positions.
- The method could reduce nuisance perception drops after minor calibration drift.
- Airside evaluation must include long-range empty tarmac, reflective aircraft bodies, jet blast vibration, and low-texture pavement.
- It is not enough for a safety case by itself; the system still needs calibration monitoring and periodic calibration checks.
- Use it as a robustness margin around a calibrated sensor suite, not as permission to run with unknown extrinsics.

## Implementation Notes

- Reproduce from the official GraphBEV repository before porting modules into another BEVFusion fork.
- Preserve access to intermediate offset maps; they are useful for diagnosing calibration drift.
- Build test sets with known extrinsic perturbations and compare performance by object class and range.
- Include near-field apron obstacles because small BEV offsets have high operational consequence there.
- Combine with offline calibration tools such as SOAC or RC-AutoCalib for actual extrinsic correction.
- Benchmark embedded latency if deploying on Orin-class hardware.

## Sources

- arXiv paper: https://arxiv.org/abs/2403.11848
- Full ar5iv text: https://ar5iv.labs.arxiv.org/html/2403.11848v4
- Official implementation: https://github.com/adept-thu/GraphBEV
