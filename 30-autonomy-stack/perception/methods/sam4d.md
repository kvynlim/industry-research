# SAM4D

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "SAM4D is rated for open-world perception, annotation leverage, and long-tail validation workflows."
method-priority:end -->

## What It Is

- SAM4D is an ICCV 2025 promptable segmentation model for camera and LiDAR streams.
- The full title is "SAM4D: Segment Anything in Camera and LiDAR Streams."
- It extends segment-anything-style prompting from images and videos into synchronized autonomous-driving camera and LiDAR sequences.
- It targets stream object segmentation and scalable multimodal annotation, not only single-frame image masks.
- The method introduces Waymo-4DSeg for evaluation.
- It is best understood as a multimodal data-engine and segmentation foundation layer rather than a complete detector or planner.

## Core Technical Idea

- Align camera and LiDAR features in a shared 3D-aware representation.
- Use Unified Multi-modal Positional Encoding (UMPE) so camera pixels and LiDAR points can interact through common spatial cues.
- Use Motion-aware Cross-modal Memory Attention (MCMA) to retrieve long-horizon features across time.
- Apply ego-motion compensation so historical camera and LiDAR memories remain spatially meaningful.
- Support cross-modal prompting: image evidence can help LiDAR segmentation and LiDAR evidence can stabilize image masks.
- Generate camera-LiDAR aligned pseudo-labels with an automated data engine combining video masklets, 4D reconstruction, and cross-modal masklet fusion.

## Inputs and Outputs

- Input: synchronized multi-camera image streams.
- Input: LiDAR point cloud streams.
- Input metadata: camera intrinsics, extrinsics, LiDAR-camera calibration, ego pose, and timestamps.
- Prompt input: first-frame object prompts, masks, points, or boxes depending on the use case.
- Output: temporally consistent object masks in camera frames.
- Output: object segmentation over LiDAR points or point-cloud frames.
- Output for data pipelines: camera-LiDAR aligned pseudo-labels and masklets across time.

## Architecture or Pipeline

- Encode camera and LiDAR observations with modality-specific front ends.
- Apply UMPE to put image and point features into a shared 3D spatial reference.
- Store historical image features, LiDAR features, positions, and object pointers in temporal memory.
- Use MCMA to attend from the current frame into motion-compensated cross-modal memory.
- Decode prompt-conditioned masks for both modalities.
- For auto-labeling, use visual foundation model masklets, reconstruct spatiotemporal 4D geometry, and fuse masklets across camera and LiDAR.
- Evaluate segmentation consistency over streams rather than isolated frames.

## Training and Evaluation

- SAM4D is evaluated on the constructed Waymo-4DSeg benchmark.
- The ICCV paper reports strong cross-modal segmentation ability and data-annotation potential.
- The authors state that the automated data engine generates aligned pseudo-labels orders of magnitude faster than manual annotation while preserving semantic fidelity from visual foundation models.
- Evaluation should separate image mask quality, LiDAR mask quality, temporal consistency, prompt robustness, and annotation throughput.
- For deployment decisions, measure whether prompts transfer to unusual categories and whether segmentation remains stable through occlusion.
- Runtime use should be benchmarked separately from offline annotation use.

## Strengths

- Gives a shared segmentation interface over images and LiDAR points.
- Cross-modal prompting can recover objects that are weak in one modality but visible in the other.
- Temporal memory reduces flicker compared with single-frame mask propagation.
- Ego-motion compensation makes the memory design closer to driving deployment than generic video segmentation.
- Useful for bootstrapping labeled LiDAR-camera datasets.
- Supports long-tail data engine workflows where new object categories are prompted and then reviewed.

## Failure Modes

- Depends on accurate synchronization and camera-LiDAR calibration.
- Promptable segmentation can produce plausible masks without reliable object identity or safety semantics.
- VFM-derived pseudo-labels inherit 2D foundation-model biases.
- LiDAR point sparsity can make small or distant objects hard to segment.
- Dynamic scenes can break masklet fusion if motion compensation or object association is wrong.
- It does not provide calibrated freespace, occupancy, or object trajectory forecasts by itself.

## Airside AV Fit

- Very useful for annotating airside video and LiDAR logs with GSE, aircraft parts, cones, chocks, tow bars, hoses, and ground crew.
- Cross-modal masks can improve training data around reflective aircraft skin where image appearance and LiDAR geometry fail differently.
- Promptable workflows are useful for rare equipment types that are not in road-driving taxonomies.
- It should run primarily in the data engine or slow safety-audit path unless latency is proven on target hardware.
- Airside prompts need object-part granularity for wings, engines, landing gear, jet bridges, belt loaders, dollies, and FOD-like objects.
- Any pseudo-labels used for safety-critical classes need human QA and adverse-condition slices.

## Implementation Notes

- Maintain strict timestamp and calibration versioning for every generated masklet.
- Store prompt provenance: prompt type, frame index, object text if used, and reviewer status.
- Use LiDAR masks to check image masks near aircraft edges and overhangs, but do not assume LiDAR point absence means free space.
- Add active-review queues for masks with low cross-modal agreement.
- Track label drift across lighting, weather, gate layout, and aircraft type.
- Use SAM4D labels to train smaller deployable segmentation or occupancy models.

## Sources

- ICCV 2025 paper page: https://openaccess.thecvf.com/content/ICCV2025/html/Xu_SAM4D_Segment_Anything_in_Camera_and_LiDAR_Streams_ICCV_2025_paper.html
- ICCV 2025 open-access paper: https://openaccess.thecvf.com/content/ICCV2025/papers/Xu_SAM4D_Segment_Anything_in_Camera_and_LiDAR_Streams_ICCV_2025_paper.pdf
- arXiv paper: https://arxiv.org/abs/2506.21547
- Related method page: [SAMFusion](samfusion.md)
