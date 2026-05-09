# Scene Flow for Dynamic Object Removal

## What It Is

- Scene flow estimates a 3D motion vector for each point between successive LiDAR sweeps.
- For world models, the key use is not only motion prediction but also selective removal: dynamic points can be excluded from static maps, and static background can be excluded when isolating moving actors.
- It is a flow-based complement to binary MOS methods such as [LiDAR-MOS](../perception/methods/lidar-mos.md), [4DMOS](../perception/methods/4dmos.md), [InsMOS](../perception/methods/insmos.md), and [StreamMOS](../perception/methods/streammos.md).
- It can also feed future occupancy and flow models such as [StreamingFlow](../perception/methods/streamingflow.md).
- The output is valuable for map hygiene, occupancy clearing, actor extraction, and replay simulation.

## Core Idea

- Remove ego motion first, then estimate residual point motion between two LiDAR sweeps.
- Points with coherent residual motion become dynamic candidates.
- Points with near-zero residual motion and persistent occupancy become static-map candidates.
- The dynamic mask removes ghosting from map fusion; the static mask can be subtracted to isolate moving objects for tracking or behavior modeling.
- Scene flow keeps velocity direction and magnitude, so the world model can reason about where removed dynamic objects are going rather than only that they are moving.

## Inputs/Outputs

- Input: two consecutive LiDAR sweeps or a short temporal sequence.
- Input: ego poses, calibration, timestamps, and de-skewing metadata.
- Optional input: ground masks, semantic masks, object tracks, radar Doppler, or MOS masks.
- Output: per-point `flow_tx_m`, `flow_ty_m`, and `flow_tz_m` style displacement vectors.
- Output: `is_dynamic` or equivalent moving/static point label.
- Output: static-only cloud for mapping and localization.
- Output: dynamic-only cloud for actor extraction, tracking, occupancy flow, or simulation.

## Pipeline

- Synchronize LiDAR sweeps and interpolate ego poses.
- De-skew rotating scans and transform sweeps into a consistent frame.
- Estimate scene flow with an offline teacher such as [Neural Scene Flow Priors](../perception/methods/neural-scene-flow-priors.md), a distilled student such as ZeroFlow, or a supervised/self-supervised model such as DeFlow.
- Convert residual flow to dynamic/static labels using magnitude, temporal consistency, and object-level clustering.
- Fuse low-motion persistent points into the static map.
- Route high-motion points to trackers, occupancy-flow prediction, or dynamic obstacle layers.
- Keep confidence and audit logs so removed points can be reviewed when map quality or safety behavior changes.

## Evaluation

- Argoverse 2 scene flow uses 0.1 s LiDAR sweeps and object tracks to derive piecewise-rigid flow labels.
- Its submission format includes per-point flow components and an `is_dynamic` boolean.
- Argoverse 2 treats a point as dynamic when its ego-motion-removed ground-truth flow norm is greater than 0.05 m.
- Flow metrics should include endpoint error, accuracy, outlier rate, and dynamic/static classification quality.
- Removal metrics should include static map completeness, dynamic ghost reduction, and false removal of fixed structures.
- Always report whether labels come from human/object annotations, offline NSFP-style pseudo-labels, ZeroFlow-style distillation, or a production tracker.

## Strengths

- Class-agnostic: it can flag motion for objects not present in the road-object taxonomy.
- Produces velocity vectors, not just moving/static labels.
- Supports both dynamic object removal for map building and static background removal for actor isolation.
- Can use unlabeled logs through NSFP or ZeroFlow-style pseudo-labeling.
- Works naturally with occupancy flow and world-model prediction.
- Gives a direct way to audit whether a static map contains moving-object ghosts.

## Failure Modes

- Ego-pose, timestamp, or scan de-skew errors can become false scene flow.
- Slow apron motion may fall below a generic dynamic threshold.
- Newly revealed static surfaces can look dynamic because no correspondence existed in the previous sweep.
- Occlusions, sparse far-range points, reflective aircraft surfaces, and repeated structures can produce wrong correspondences.
- Removing all dynamic-looking points can erase useful structure from aircraft, doors, service equipment, or temporarily moved static assets.
- Flow does not provide semantic intent; a moving baggage cart and a rolling loose object both need downstream interpretation.

## Airside fit

- High fit for maintaining static maps around stands, service roads, baggage halls, and pushback corridors.
- Useful for removing tug, cart, bus, personnel, and aircraft-motion ghosts from repeated mapping runs.
- Thresholds must be tuned for low-speed operations; a road benchmark dynamic cutoff can miss inching tugs or creeping belt loaders.
- Aircraft are special: parked aircraft can be static map context, while pushback or taxi motion must be removed from static layers.
- Radar Doppler and track logic should cross-check dynamic declarations in rain, spray, glare, and partial occlusion.
- Store both removed and retained point layers so safety review can reconstruct why the world model changed.

## Sources

- Argoverse 2 scene-flow task: https://argoverse.github.io/user-guide/tasks/3d_scene_flow.html
- Neural Scene Flow Prior: https://arxiv.org/abs/2111.01253
- ZeroFlow: https://arxiv.org/abs/2305.10424
- ZeroFlow project page: https://vedder.io/zeroflow.html
- DeFlow: https://arxiv.org/abs/2401.16122
- DeFlow repository: https://github.com/KTH-RPL/DeFlow
- LiDAR-MOS lineage paper: https://arxiv.org/abs/2105.08971
