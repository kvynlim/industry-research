# SOLOFusion

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "architecture-pattern"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "SOLOFusion is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## What It Is

- SOLOFusion is the method introduced in "Time Will Tell" for temporal multi-view 3D object detection.
- It is a camera-only BEV detector focused on long-history temporal fusion.
- The paper argues that prior temporal detectors used too little history and treated temporal fusion as coarse stereo.
- SOLOFusion combines long-term coarse matching with short-term fine-grained matching.
- It remains a 3D object detection method, not an occupancy or mapping method.

## Core Technical Idea

- Reinterpret temporal multi-view camera detection as temporal stereo matching.
- Analyze localization potential to show that the best temporal difference varies by pixel and depth.
- Use many historical image observations so at least some frames provide useful parallax for each location.
- Generate a cost volume from long-term image history at efficient coarse resolution.
- Keep per-frame monocular depth predictions for long-term matching.
- Add short-term, fine-grained matching to recover detail that coarse long-term matching misses.
- Fuse long-term and short-term depth cues before BEV pooling and detection.
- The method is named around the idea that time history improves localization when used deliberately.

## Inputs and Outputs

- Inputs: current multi-camera images and a long sequence of historical multi-camera observations.
- Inputs also include camera calibration, ego poses, and temporal ordering.
- Training inputs: nuScenes 3D detection labels and depth or detection supervision used by the BEVDepth-style base.
- Output: 3D object boxes with class, score, dimensions, yaw, center, and velocity.
- Intermediate output: long-term cost volume and short-term temporal matching features.
- The method assumes sequential processing and cannot be treated as a stateless single-image detector.

## Architecture

- Backbone: BEVDepth/BEVDet-style image encoder and BEV detector stack.
- Long-term fusion: constructs a cost volume from historical image observations.
- Short-term fusion: performs fine-grained temporal matching over nearby frames.
- Depth branch: uses monocular depth predictions augmented by temporal evidence.
- BEV view transform: lifts improved image features into a BEV representation.
- BEV encoder: applies 2D top-down convolutional reasoning.
- Detection head: predicts nuScenes 3D boxes from BEV features.
- Official implementation is built on MMDetection3D-style infrastructure and must process samples sequentially for inference.

## Training and Evaluation

- Primary benchmark: nuScenes camera-only 3D detection.
- The official repository reports 54.0% mAP and 61.9% NDS on the nuScenes camera-only detection task.
- The OpenReview paper states the method reached first place on the nuScenes test set at release time.
- The paper reports outperforming the previous best by 5.2% mAP and 3.7% NDS on validation.
- Official model zoo includes R50 short-only, long-only, combined SOLOFusion, and SOLOFusion plus CBGS configurations.
- The repo trains long-term fusion in two phases, similar in spirit to staged reconstruction systems.
- Inference in the official README is single-GPU and single-batch because samples must be processed sequentially.

## Strengths

- Strong demonstration that long temporal history matters for camera-only 3D localization.
- Long-term and short-term fusion are complementary rather than redundant.
- Uses camera history to improve depth without requiring runtime LiDAR.
- Fits BEV detection pipelines and can inherit BEVDepth tooling.
- Provides useful analysis vocabulary for temporal gap, parallax, and matching granularity.
- Good benchmark for comparing recurrent or streaming camera detectors.

## Failure Modes

- Sequential state makes inference and recovery from dropped frames more complex.
- Long history can propagate stale information after abrupt scene changes or occlusions.
- Temporal matching can fail during low-parallax stop-and-go movement.
- Dynamic objects violate the static assumptions behind many matching cues.
- Memory and latency depend on retained history length and cost-volume design.
- The detector still abstracts objects as boxes and does not solve dense freespace.

## Airside AV Fit

- Airside vehicles often move slowly with repeated viewpoints, making temporal history attractive.
- The same slow motion can limit parallax, so long-term history must be tuned around maneuver speed.
- Useful for tracking ground equipment and vehicles across apron approaches where single-frame depth is weak.
- Needs validation around aircraft pushback, parked aircraft, service vehicles crossing behind occluders, and personnel near stands.
- Long-history fusion should be reset or downweighted after camera faults, hard turns, or localization discontinuities.
- Use as a camera temporal detector, not as the only source for clearance under wings or around engine hazard zones.

## Implementation Notes

- Build the dataloader and inference loop around chronological order; random sample inference is misleading.
- Store per-sequence state with explicit reset conditions at scene boundaries and localization faults.
- Tune history length by speed profile and available compute, not by road-driving defaults.
- Track latency, memory, and detection quality separately for short-only, long-only, and combined variants.
- Validate behavior after frame loss because official inference assumptions are more restrictive than simple batch testing.
- For airside, add metrics for temporal stability, false persistence, and recovery after occlusion.
- Compare to BEVStereo with the same backbone to separate long-history value from stereo-depth value.

## Sources

- SOLOFusion paper on arXiv: https://arxiv.org/abs/2210.02443
- ICLR 2023 OpenReview paper: https://openreview.net/forum?id=H3HcEJA2Um
- Official SOLOFusion repository: https://github.com/Divadi/SOLOFusion
- nuScenes detection benchmark: https://www.nuscenes.org/object-detection
