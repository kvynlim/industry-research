# StreamMOS

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "mapping", "validation", "road-av"]
  reason: "StreamMOS is rated for motion segmentation, scene flow, or dynamic-object perception workflows."
method-priority:end -->

## What It Is

- StreamMOS is a streaming LiDAR moving object segmentation method.
- It was accepted to IEEE Robotics and Automation Letters and released on arXiv in 2024.
- The method addresses temporal inconsistency across independent MOS inferences.
- It uses memory across inferences rather than only fusing scans inside a single inference window.
- The target task remains point-wise moving object segmentation.
- It is especially relevant when a vehicle must produce continuous high-rate dynamic masks.

## Core Technical Idea

- Maintain short-term memory of historical features.
- Treat those features as spatial priors for moving objects in current inference.
- Maintain long-term memory of previous predictions.
- Refine current predictions at voxel and instance levels through voting over stored predictions.
- Use a multi-view encoder with cascaded projection and asymmetric convolution.
- Link feature propagation and prediction refinement so the same object is less likely to flicker between frames.

## Inputs and Outputs

- Input: streaming LiDAR scans.
- Input: temporal context from previous inference states.
- Input: derived multi-view representations rather than only one projection.
- Output: point-wise moving/static labels for the current frame.
- Output: stateful feature and prediction memory used by later frames.
- Assumption: stream ordering, timestamps, and memory resets are handled correctly by the runtime.

## Architecture or Dataset/Pipeline

- The architecture combines a multi-view motion encoder with dual-span memory.
- Short-term memory transfers feature-level information across nearby frames.
- Long-term memory stores previous segmentation predictions for later voting.
- Cascaded projection extracts complementary representations from LiDAR data.
- Asymmetric convolution targets motion features with lower compute than heavy full 4D processing.
- Instance-level voting improves object integrity when predictions are noisy.

## Training and Evaluation

- The paper evaluates on SemanticKITTI and the Sipailou Campus dataset.
- Reported results show competitive MOS performance with improved temporal continuity.
- The method is designed for online use where consecutive predictions are not independent.
- Training still relies on labeled MOS sequences.
- Evaluation should include both point-level MOS metrics and temporal consistency checks.
- The official paper states code will be released at the NEU-REAL StreamMOS repository.

## Strengths

- Directly targets the flicker problem seen in frame-independent MOS.
- Memory is useful for briefly occluded or sparse moving objects.
- More runtime-friendly than methods that require large 4D windows for every frame.
- Long-term voting can stabilize segmentation without a separate tracker.
- Multi-view encoding reduces reliance on any single projection geometry.
- Conceptually close to production streaming perception requirements.

## Failure Modes

- Memory can propagate false positives after an object stops or leaves the scene.
- Stateful inference creates reset, synchronization, and recovery concerns.
- Drift in ego-motion or object alignment can corrupt memory.
- Long-term voting may lag abrupt start/stop events.
- Dataset performance may not transfer to low-speed apron motion without retraining.
- Debugging is harder than stateless MOS because errors can be caused by prior frames.

## Airside AV Fit

- Good fit for continuous dynamic masks around stands where objects are often temporarily occluded.
- Useful when baggage carts or personnel pass behind aircraft gear and reappear.
- Needs explicit memory invalidation around localization jumps, route resets, and sensor dropouts.
- Airport apron speeds are low, so temporal consistency must not hide subtle starts.
- Long-term memory should be bounded near aircraft to avoid stale dynamic masks on static fuselage points.
- Best used with radar Doppler or track confirmation for safety-critical moving-object declarations.

## Implementation Notes

- Treat the memory state as part of the runtime safety contract.
- Add diagnostics for memory age, reset events, and number of active dynamic voxels.
- Run offline replay tests with dropped frames and out-of-order timestamps.
- Compare against stateless 4DMOS on identical clips to measure consistency gain.
- Publish dynamic-mask confidence and memory confidence separately.
- Keep a deterministic fallback that clears memory on localization discontinuity.

## Sources

- Paper: https://arxiv.org/abs/2407.17905
- Preprint PDF mirror linked by authors: https://3bobo.github.io/files/StreamMOS.pdf
- Planned official repository: https://github.com/NEU-REAL/StreamMOS
- SemanticKITTI dataset: https://semantic-kitti.org/index
