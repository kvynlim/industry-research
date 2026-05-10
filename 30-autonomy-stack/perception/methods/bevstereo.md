# BEVStereo

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "BEVStereo is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- BEVStereo is a temporal multi-view 3D detector that improves camera BEV depth using dynamic temporal stereo.
- It builds on the BEVDepth family and keeps the final task as camera-only 3D box detection.
- The method treats historical frames as stereo partners for the current frame.
- It is designed for outdoor driving where naive multi-view stereo is expensive and dynamic objects violate static-scene assumptions.
- It is a method for depth-enhanced BEV detection, not a general stereo depth benchmark.

## Core Technical Idea

- Use temporal image observations to reduce monocular depth ambiguity.
- Construct stereo matching candidates between the current frame and historical frames after ego-motion alignment.
- Dynamically select the scale or range of matching candidates to reduce computation.
- Iteratively update valuable candidates so moving objects and imperfect correspondences do not dominate matching.
- Combine temporal stereo depth cues with BEVDepth-style supervised depth and BEV pooling.
- The detector benefits because object centers in BEV depend heavily on accurate depth.
- The method argues that outdoor temporal stereo must be adaptive rather than dense all-view matching.

## Inputs and Outputs

- Inputs: current surround images, selected historical sweep or key-frame images, calibration, and ego-motion transforms.
- Training inputs: nuScenes 3D boxes and LiDAR-projected depth targets, as in BEVDepth-style training.
- Output: 3D bounding boxes in ego BEV coordinates with class scores and motion attributes.
- Intermediate output: refined depth distributions informed by temporal stereo.
- Intermediate output: BEV features pooled from depth-aware camera features.
- It does not output dense occupancy, semantic voxels, or explicit freespace.

## Architecture

- Image backbone and neck encode each camera image.
- Depth branch predicts monocular depth distributions.
- Temporal stereo branch aligns historical features to the current view.
- Dynamic candidate selection chooses efficient matching hypotheses rather than evaluating all possible depths.
- Iterative update refines candidate sets to handle outdoor motion and hard correspondences.
- View transformer lifts image features with the improved depth distribution.
- Efficient voxel pooling aggregates lifted features into BEV.
- BEV encoder and detection head follow BEVDepth/BEVDet conventions.

## Training and Evaluation

- Primary benchmark: nuScenes camera-only 3D detection.
- Official arXiv abstract reports 52.5% mAP and 61.0% NDS on the nuScenes camera-only track.
- Official repository reports R50 validation configurations with key+sweep or key+key temporal settings.
- The repo includes depth-ground-truth generation, training, and evaluation scripts inherited from BEVDepth.
- Ablations compare temporal stereo against contemporary MVS approaches and against monocular-depth baselines.
- The method should be evaluated with explicit frame selection, temporal gap, EMA, CBGS, and image size.
- Latency is affected by candidate count, frame count, and whether custom voxel pooling kernels are optimized.

## Strengths

- Improves metric depth without relying only on larger image backbones.
- Uses temporal parallax, which is valuable when a vehicle moves slowly through a scene.
- Dynamic candidate selection reduces the cost of full temporal MVS.
- Iterative candidate updates make it more practical for dynamic driving scenes than static-scene stereo.
- Strong fit as a detection backbone for later occupancy methods needing depth-aware BEV features.
- Official code is available and closely aligned with BEVDepth, easing comparison.

## Failure Modes

- Temporal stereo is weak when ego motion is too small, too rotational, or poorly estimated.
- Moving objects can still break correspondences, especially with non-rigid pedestrians or articulated GSE.
- Rolling shutter, dropped frames, and camera timestamp skew can corrupt the stereo cue.
- Textureless apron pavement gives little photometric evidence for matching.
- Historical-frame dependence adds statefulness and complicates real-time failover.
- Box-only output still misses irregular hazards and overhanging aircraft structure.

## Airside AV Fit

- Potentially useful for low-speed apron vehicles because temporal history is abundant and scene geometry changes slowly.
- The same low-speed regime can also reduce parallax, so evaluation must include stop-and-creep trajectories.
- Airside temporal matching must handle large dynamic aircraft, pushback tugs, belt loaders, loaders, pedestrians, and parked equipment.
- Open pavement, repeated markings, reflective surfaces, and floodlights are hard cases for stereo matching.
- Should not be treated as a replacement for LiDAR/radar near aircraft clearance zones.
- Best use is as a camera-depth improvement feeding detection, occupancy, or redundancy monitoring.

## Implementation Notes

- Implement strict frame buffering with ego-pose interpolation and health checks for missing historical frames.
- Tune temporal gap policies by speed; fixed gaps from road driving may be wrong for apron vehicles.
- Profile the stereo branch separately from BEV pooling to understand deployment bottlenecks.
- Validate dynamic-object cases with per-class localization error, not only aggregate NDS.
- Use calibration drift tests because temporal stereo magnifies small extrinsic errors.
- For airside data, include long stationary periods and tight stand maneuvers in the validation split.
- Keep BEVStereo metrics separate from BEVDepth and SOLOFusion because all use temporal cues differently.

## Sources

- BEVStereo paper: https://arxiv.org/abs/2209.10248
- Official BEVStereo repository: https://github.com/Megvii-BaseDetection/BEVStereo
- BEVDepth repository with BEVStereo benchmark table: https://github.com/Megvii-BaseDetection/BEVDepth
- nuScenes detection benchmark: https://www.nuscenes.org/object-detection
