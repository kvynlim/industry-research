# Spatiotemporal Memory Occupancy Flow

## Executive Summary

- Spatiotemporal memory occupancy flow methods use historical observations to improve 3D occupancy and motion prediction.
- ST-Occ introduces occupancy learning with spatiotemporal memory, uncertainty, and dynamic awareness.
- STCOcc introduces sparse spatial-temporal cascade renovation for joint 3D occupancy and scene-flow prediction.
- Let Occ Flow shows self-supervised camera-based 3D occupancy flow using differentiable rendering, 2D segmentation, and optical-flow cues.
- The common theme is that current occupancy is not enough; temporal memory, uncertainty, and flow are needed for stable dynamic scene understanding.
- For autonomy, this family is most useful when dense space representation must be temporally consistent and motion-aware, not only accurate frame by frame.

## Problem Fit

- Use this family when single-frame occupancy flickers, misses occluded actors, or fails to estimate motion.
- It fits AV planning stacks that need both current occupied space and short-horizon motion of occupied cells.
- It is useful when historical context can disambiguate depth, object extent, and dynamic state.
- It is especially relevant to camera-centric stacks, where temporal parallax and memory can compensate for weak instantaneous depth.
- It is less appropriate when the perception stack only needs static map-like occupancy.
- It should be paired with runtime checks because memory can preserve stale errors after a scene changes.

## Method Mechanics

- ST-Occ maintains a spatiotemporal memory containing historical occupancy representation, uncertainty, and occupancy flow.
- Memory attention conditions the current occupancy representation on extracted historical information.
- ST-Occ updates memory with predicted uncertainty and flow so dynamic-aware temporal fusion is part of the representation.
- STCOcc uses explicit occupied-state guidance rather than relying only on implicit feature learning.
- STCOcc's self-recursive occupancy predictor progressively refines occupied states across stages.
- Its sparse occlusion-aware attention renovates 3D features by using occupied-state and depth information.
- STCOcc also models long-term dynamic information with sparse temporal fusion, reducing memory cost while preserving spatial detail.
- Let Occ Flow combines TPV representation, deformable attention, temporal fusion, 3D refinement, and differentiable rendering of occupancy flow for self-supervised training.

## Inputs and Outputs

- Input: historical multi-view camera images with calibration, timestamps, and ego poses.
- Optional input: LiDAR or generated occupancy labels during supervised training.
- Optional input: optical flow, zero-shot 2D segmentation, or visibility cues for self-supervised training.
- Optional input: previous occupancy memory, uncertainty memory, and flow memory.
- Output: current 3D semantic occupancy grid.
- Output: occupancy flow or scene flow vectors for occupied voxels.
- Optional output: temporal uncertainty, dynamic/static decomposition, and memory diagnostics.
- Optional output: future occupancy predictions when the model is extended into forecasting.

## Assumptions

- Historical observations can be ego-motion compensated into a consistent frame.
- The scene does not change so abruptly that memory becomes misleading before it is updated.
- Camera calibration and pose are accurate; temporal fusion amplifies alignment errors.
- Training labels or self-supervised cues are consistent enough to supervise flow and occupancy together.
- Dynamic objects are observed often enough for the model to learn motion patterns.
- The planner can consume occupancy flow and uncertainty without assuming deterministic cell motion.

## Strengths

- Temporal memory improves stability compared with frame-independent occupancy.
- Occupancy flow adds motion cues that dense occupancy alone lacks.
- Sparse or occupied-state-guided processing reduces memory pressure in mostly empty 3D space.
- Explicit uncertainty helps distinguish confident observed space from temporally inferred space.
- Temporal parallax helps camera-based occupancy recover geometry that single frames miss.
- Joint occupancy and flow training can reduce inconsistency between where objects are and how they move.
- Self-supervised variants reduce dependence on dense 3D labels.

## Limitations and Failure Modes

- Memory can keep stale occupancy after an object leaves or a hidden actor appears.
- Ego-pose or calibration drift can smear occupancy through time.
- Flow labels and optical-flow cues can be wrong under occlusion, reflections, rolling shutter, or low texture.
- Sparse occupied-state refinement can miss newly appearing objects if the sparse candidate set is too narrow.
- Long-term temporal fusion can smooth sudden motion changes.
- Camera-only memory remains vulnerable to darkness, glare, rain, fog, spray, and dirty lenses.
- Occupancy flow is not intent prediction; it should not replace behavior forecasting for actors with decision-making.

## Evaluation Notes

- Evaluate per-frame occupancy, temporal consistency, and occupancy-flow quality separately.
- Report RayIoU, mIoU, flow endpoint error or mAVE, and temporal stability metrics where available.
- Split dynamic and static voxels; strong static performance can hide weak dynamic flow.
- Include memory reset, dropped-frame, delayed-frame, and ego-pose-noise tests.
- Evaluate under occlusion emergence and disappearance, not only smooth actor motion.
- Compare with non-temporal occupancy, short-memory, long-memory, and explicit-flow ablations.
- For self-supervised methods, evaluate against supervised labels and inspect failure cases where 2D segmentation or optical flow is unreliable.

## AV and Indoor/Outdoor Relevance

- On-road AVs: high relevance for stable camera-centric occupancy and motion-aware planning.
- Airport AVs: high relevance for baggage trains, tugs, buses, personnel, and service vehicles moving around occlusions and aircraft stands.
- Indoor robots: useful for humans, carts, forklifts, doors, shelves, and blind corners, especially with RGB-D or fisheye camera memory.
- Outdoor industrial robots: useful for ports, yards, and mines with moving machinery and intermittent occlusions.
- Low-speed autonomy benefits from temporally stable occupancy but must be conservative when memory conflicts with current sensor evidence.
- Airport use should add radar or LiDAR evidence during poor visibility because camera memory alone can become stale or overconfident.

## Implementation/Validation Checklist

- Define memory state contents: features, occupancy, uncertainty, flow, timestamps, and coordinate frame.
- Validate ego-motion compensation with static-scene replay before training.
- Add explicit memory-aging or confidence decay so stale observations do not persist indefinitely.
- Log memory reads and writes for debugging.
- Include frame-drop, frame-delay, calibration-shift, and pose-noise tests.
- Evaluate flow and occupancy consistency: advected occupancy should agree with the next observed occupancy.
- Add dynamic/static class splits and near-field safety metrics.
- For airport deployment, include occlusion under aircraft wings, around buses, behind belt loaders, and near jet bridges.

## Local Cross-Links

- Temporal occupancy and forecasting: [StreamingFlow](streamingflow.md), [TrackOcc](trackocc.md), [Cam4DOcc](cam4docc.md).
- Scene flow methods: [SplatFlow](splatflow.md), [Neural Scene Flow Priors](neural-scene-flow-priors.md), [Cross-Domain LiDAR Scene Flow](cross-domain-lidar-scene-flow.md).
- Camera occupancy foundations: [TPVFormer](tpvformer.md), [SparseOcc](sparseocc.md), [SurroundOcc](surroundocc.md).
- Dynamic occupancy and freespace: [Dynamic Occupancy Freespace](dynamic-occupancy-freespace.md).

## Sources

- ST-Occ ICCV 2025 paper: https://openaccess.thecvf.com/content/ICCV2025/papers/Leng_Occupancy_Learning_with_Spatiotemporal_Memory_ICCV_2025_paper.pdf
- STCOcc CVPR 2025 open-access page: https://openaccess.thecvf.com/content/CVPR2025/html/Liao_STCOcc_Sparse_Spatial-Temporal_Cascade_Renovation_for_3D_Occupancy_and_Scene_CVPR_2025_paper.html
- STCOcc arXiv paper: https://arxiv.org/abs/2504.19749
- STCOcc official repository: https://github.com/lzzzzzm/STCOcc
- Let Occ Flow arXiv paper: https://arxiv.org/abs/2407.07587
- Let Occ Flow official repository: https://github.com/eliliu2233/occ-flow
- CVT-Occ temporal fusion paper: https://arxiv.org/abs/2409.13430
