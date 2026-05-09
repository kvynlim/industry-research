# M2-Occ

## What It Is

- M2-Occ is a camera-based 3D semantic occupancy method for incomplete multi-camera inputs.
- The full paper title is "M^2-Occ: Resilient 3D Semantic Occupancy Prediction for Autonomous Driving with Incomplete Camera Inputs."
- It addresses camera dropout, occlusion, hardware faults, and communication failures in surround-view occupancy.
- The method keeps the normal full-camera path but adds missing-view reconstruction and semantic memory.
- It is a robustness method for semantic occupancy, not a camera-failure detector by itself.
- It is especially relevant to production stacks that rely on surround cameras for dense freespace and semantics.

## Core Technical Idea

- Reconstruct missing camera-view representations in feature space rather than generating replacement images.
- Use Multi-view Masked Reconstruction (MMR) to exploit spatial overlap between neighboring cameras.
- Use a Feature Memory Module (FMM) as a learnable bank of class-level semantic prototypes.
- Retrieve global semantic priors from memory to refine ambiguous voxel features when observed image evidence is incomplete.
- Evaluate deterministic single-camera failures and stochastic multi-view dropout instead of only clean full-view validation.
- Preserve full-view performance while improving degraded-view robustness.

## Inputs and Outputs

- Input: multi-view camera images, with one or more views potentially missing.
- Input metadata: camera intrinsics, extrinsics, timestamps, ego pose, image augmentations, and camera availability masks.
- Training input: normal semantic occupancy labels from a SurroundOcc-style nuScenes occupancy benchmark.
- Training corruption: deterministic missing-view cases and random multi-view dropout.
- Output: 3D semantic occupancy grid in ego coordinates.
- Optional output for deployment: missing-view mask, reconstructed feature confidence, and memory-prototype similarity.
- It does not infer LiDAR geometry at runtime unless paired with a separate fusion model.

## Architecture or Pipeline

- Extract image features for each available surround camera.
- Apply view masking during training and evaluation to simulate camera loss.
- MMR reconstructs missing-view feature maps using overlapping field-of-view context from neighboring cameras and learnable mask tokens.
- Lift or aggregate the multi-view features into the occupancy representation used by the underlying model.
- FMM retrieves class-level semantic prototypes from a learnable memory bank.
- Memory-refined voxel features feed the semantic occupancy head.
- The missing-view protocol measures whether geometry and semantics degrade gracefully as cameras disappear.

## Training and Evaluation

- The paper introduces a systematic missing-view evaluation protocol on the nuScenes-based SurroundOcc benchmark.
- Under a missing back-view setting, M2-Occ reports a +4.93 percentage point IoU improvement.
- With five missing camera views, it reports a +5.01 percentage point IoU improvement.
- The reported gains are achieved without compromising full-view performance.
- Evaluation should report clean full-view, single-view loss, multiple-view loss, random dropout, and safety-critical rear/side camera loss separately.
- Aggregate IoU can hide missing-view hallucinations; inspect freespace errors near the ego vehicle and in planned path corridors.

## Strengths

- Directly models an operationally realistic failure: camera views are missing or degraded.
- Feature-space reconstruction avoids expensive image generation and preserves the downstream occupancy architecture.
- Semantic memory helps stabilize classes when the geometric evidence is weak.
- It creates a repeatable evaluation protocol for camera dropout rather than treating it as an ad hoc robustness test.
- The approach can be combined with camera-health diagnostics and modality dropout training.
- It is useful for degraded operation modes where the vehicle must slow down but still reason about the scene.

## Failure Modes

- Missing-view reconstruction can hallucinate occupied or free space if exposed as normal confidence.
- Overlap-based reconstruction is weakest where adjacent cameras do not cover the lost view.
- A memory bank can over-impose road-domain classes onto airport-specific objects.
- Camera-loss robustness does not solve darkness, glare, dirty lenses, or water droplets unless those are included in training.
- Semantic consistency can improve while geometry remains wrong, which is dangerous for clearance-critical planning.
- The system still needs a separate runtime sensor-health signal; the occupancy model should not infer all failures from pixels alone.

## Airside AV Fit

- Strong fit because low-speed apron vehicles often use wide surround camera rigs that can be blocked by rain, dirt, spray, equipment, or aircraft structure.
- Missing rear and side views matter around pushback, stand entry, baggage trains, and service-lane merges.
- Reconstructed features should be used as degraded-mode support, not as proof of freespace near aircraft wings, engines, chocks, cones, or personnel.
- Camera-view masks must be wired to the planner so missing-camera occupancy carries larger buffers.
- Airside taxonomies should add aircraft parts, GSE, hoses, tow bars, cones, chocks, ground crew, and FOD before relying on memory prototypes.
- Pair with LiDAR or radar occupancy for final clearance decisions.

## Implementation Notes

- Feed explicit camera availability and camera-health masks into the model and logs.
- Train with structured dropout patterns that match real rigs: rear-only, left-side pair, front-side pair, and random multi-view loss.
- Keep reconstructed feature confidence as a separate channel for downstream gating.
- Validate on physical occlusions such as dirt, droplets, lens flare, aircraft reflectance, and temporary camera blackout.
- Measure false freespace inside planned path corridors, not only semantic mIoU.
- Add replay tests where the camera returns after dropout to ensure temporal recovery does not flicker.

## Sources

- M2-Occ arXiv paper: https://arxiv.org/abs/2603.09737
- Planned official repository: https://github.com/qixi7up/M2-Occ
- SurroundOcc method context: [SurroundOcc](surroundocc.md)
