# Dynamic Occupancy Freespace

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "mapping"]
  reason: "Dynamic Occupancy Freespace is rated for BEV, occupancy, or freespace modeling that feeds planning-facing autonomy stacks."
method-priority:end -->

## Executive Summary

- Dynamic occupancy freespace models predict both what space is occupied and what space is free now or in the future.
- The recent research line includes implicit 4D occupancy-flow world models, self-supervised LiDAR occupancy fields, and unified forecasting benchmarks.
- DIO decomposes dynamic scenes into instance-aware implicit 4D occupancy-flow components.
- UnO learns unsupervised 4D occupancy fields from LiDAR, using depth and free-space rendering objectives to learn perception and forecasting without manual object labels.
- UniOcc standardizes occupancy prediction and forecasting across datasets and adds per-voxel flow annotations, making it useful for comparing dynamic occupancy methods.
- For autonomy, the key value is not only future occupied cells; it is knowing which rays and regions are observed free, unknown, occluded, or expected to become occupied.

## Problem Fit

- Use this method family when planning needs explicit free-space and future occupancy rather than only tracked object trajectories.
- It fits dynamic scenes where objects are partly occluded, not well detected as boxes, or not represented by a fixed object class list.
- It is useful for safety buffers because occupancy can represent object extent, swept volume, and unmodeled obstacles.
- It is especially relevant to low-speed autonomy around pedestrians, baggage trains, forklifts, carts, loading equipment, and vehicles that perform non-lane-following maneuvers.
- It is less suitable as a standalone semantic detector; many methods emphasize geometry and motion more than fine class labeling.
- It should be paired with uncertainty estimates because future freespace can be safety-critical and wrong in asymmetric ways.

## Method Mechanics

- A dynamic occupancy model maintains a spatial representation of occupied, free, and unknown space over time.
- DIO represents the world as a decomposable implicit 4D occupancy-flow model, using instance prompts to complete current shapes and forecast occupancy-flow evolution.
- DIO can take prompts from detectors, so it bridges explicit object proposals with dense implicit shape and motion fields.
- UnO trains from LiDAR self-supervision rather than human object labels, learning an occupancy field that can render depth and free-space evidence along LiDAR rays.
- UnO's balanced occupancy sampling is important because naive free-space-heavy training can become under-confident about occupied actors.
- UniOcc provides a unified benchmark for current-frame occupancy prediction and future occupancy forecasting across real-world and simulated datasets.
- Radar-centric dynamic occupancy grid mapping adapts inverse sensor models, field-of-view handling, and state computation to radar measurements rather than LiDAR assumptions.
- Practical systems usually need two coupled products: a current freespace layer for immediate collision checking and a future occupancy layer for planning.

## Inputs and Outputs

- Input: historical LiDAR sweeps, camera features, radar returns, tracked object prompts, or BEV features depending on the method.
- Input: ego pose and timestamp history for motion compensation.
- Input: sensor rays or visibility masks for free-space supervision.
- Optional input: 3D detector instance prompts, map lanes, route intent, or cooperative sensor data.
- Output: current occupancy or freespace grid in BEV or 3D.
- Output: future occupancy over multiple horizons.
- Output: occupancy flow or scene flow vectors for dynamic cells.
- Optional output: instance-conditioned occupancy fields, semantic occupancy, visibility confidence, and unknown/occluded masks.

## Assumptions

- Sensor pose and timing are accurate enough to align historical observations.
- The training data contains enough dynamic examples to learn non-trivial motion, not only static completion.
- Free-space labels from LiDAR rays are reliable; they prove observed emptiness only along visible rays, not behind occluders.
- Instance prompts from detectors are useful but may be incomplete; DIO-style decomposition depends on prompt quality.
- Future occupancy is conditioned on recent motion and scene context, but it cannot infer hidden intent with certainty.
- The planner understands that free, unknown, and future occupied have different safety meanings.

## Strengths

- Occupancy captures object extent and non-object hazards better than point tracks alone.
- Freespace supervision from sensor rays can scale with raw logs and reduce dependence on manual labels.
- Occupancy flow gives planners a compact dynamic field for swept-volume reasoning.
- Implicit 4D fields can represent continuous space and time more flexibly than fixed grid rollouts.
- Decomposable instance prompting helps connect dense occupancy to detector and tracker outputs.
- Unified benchmarks make cross-method comparison less dependent on private label-generation pipelines.
- Radar or LiDAR dynamic occupancy grids can run as interpretable safety layers alongside learned models.

## Limitations and Failure Modes

- Future freespace can be dangerously overconfident when hidden actors emerge from occlusion.
- Self-supervised LiDAR objectives inherit LiDAR visibility limits and may learn sensor-specific blind spots.
- Detector prompts can cause missed-instance holes in instance-conditioned models.
- Occupancy flow may be smooth and plausible while missing sudden stops, U-turns, or personnel stepping into view.
- Free-space rendering can encourage conservative emptiness near rays but weak object extent in sparse regions.
- Dense 3D forecasting can be expensive at long horizon and high resolution.
- Benchmarks may use road-centric labels and miss indoor, airport, port, or warehouse movement patterns.

## Evaluation Notes

- Evaluate current occupancy, current freespace, future occupancy, and flow separately.
- Include horizon-specific metrics, because a model can be useful at 0.5 s and unreliable at 3 s.
- Report false-free-space rate near the ego path, not only occupancy IoU.
- Split results by dynamic/static cells, occluded/visible cells, actor class, range, and speed.
- Use UniOcc-style unified settings when comparing methods across nuScenes, Waymo, CARLA, and cooperative data.
- Stress test with missing detector prompts, delayed sensors, dropped LiDAR sweeps, radar ghost returns, and unexpected stopped objects.
- For airport validation, add pushback, baggage train turns, service-road crossings, stand-entry maneuvers, workers behind vehicles, and aircraft occlusions.

## AV and Indoor/Outdoor Relevance

- On-road AVs: useful for dense occupancy forecasting around lane changes, turns, occlusions, and unusual objects.
- Airport AVs: very high relevance because movement is often low-speed, non-lane-bound, and filled with irregular equipment.
- Indoor robots: useful for forklifts, humans, doors, carts, shelves, and blind corners when RGB-D or LiDAR rays provide freespace evidence.
- Outdoor yards and ports: useful for containers, trailers, cranes, debris, and mixed human-machine motion.
- Warehouse robots may prioritize 2D/2.5D dynamic occupancy, while airport and road AVs often need 3D clearance around overhangs and aircraft.
- The same representation can support ODD management: slow down when predicted freespace confidence drops or unknown space grows.

## Implementation/Validation Checklist

- Define the difference between free, unknown, occupied, occluded, and future occupied before training labels are generated.
- Preserve sensor ray geometry so free-space labels remain auditable.
- Build a baseline dynamic occupancy grid or raycasting model before adding implicit neural models.
- Validate ego-motion compensation using static-scene replay; drift will appear as false flow.
- Track calibration and time sync as model inputs or gating signals.
- Evaluate false freespace inside braking distance and swept-path envelopes.
- Include a prompt-drop benchmark if using DIO-style detector-conditioned decomposition.
- Include a raw-log self-supervised training path if following UnO-style LiDAR occupancy fields.
- For airport use, define conservative planner behavior for unknown voxels under aircraft wings, near terminal glass, and around parked GSE.

## Local Cross-Links

- Streaming future occupancy: [StreamingFlow](streamingflow.md), [Cam4DOcc](cam4docc.md), [TrackOcc](trackocc.md).
- Scene flow and motion: [Neural Scene Flow Priors](neural-scene-flow-priors.md), [Cross-Domain LiDAR Scene Flow](cross-domain-lidar-scene-flow.md), [SplatFlow](splatflow.md).
- Radar and freespace support: [RadarPillars](radarpillars.md), [4D Radar-Camera Occupancy](4d-radar-camera-occupancy.md), [K-Radar](k-radar.md).
- Occupancy validation context: [MSC-Bench](msc-bench.md), [MultiCorrupt](multicorrupt.md), [Conformal Boxes](conformal-boxes.md).

## Sources

- DIO CVPR 2025 paper: https://openaccess.thecvf.com/content/CVPR2025/papers/Diehl_DIO_Decomposable_Implicit_4D_Occupancy-Flow_World_Model_CVPR_2025_paper.pdf
- DIO CVPR 2025 poster page: https://cvpr.thecvf.com/virtual/2025/poster/32842
- UnO CVPR 2024 paper: https://openaccess.thecvf.com/content/CVPR2024/papers/Agro_UnO_Unsupervised_Occupancy_Fields_for_Perception_and_Forecasting_CVPR_2024_paper.pdf
- UnO arXiv record: https://arxiv.org/abs/2406.08691
- UnO project page: https://waabi.ai/research/uno
- UniOcc benchmark: https://uniocc.github.io/
- UniOcc arXiv record: https://arxiv.org/abs/2503.24381
- Dynamic radar occupancy grids: https://arxiv.org/abs/2402.01488
- Differentiable raycasting for self-supervised occupancy forecasting: https://arxiv.org/abs/2210.01917
