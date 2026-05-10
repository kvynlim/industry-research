# ForeSight

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "validation", "road-av"]
  reason: "ForeSight is rated as a supporting perception method for autonomy-stack triage and follow-up reading."
method-priority:end -->

## What It Is

- ForeSight is an ICCV 2025 multi-view streaming framework for joint 3D object detection and trajectory forecasting.
- It uses surround-camera streams and keeps detection and forecasting inside one query-memory system.
- The method is tracking-free: it does not require explicit object association before forecasting.
- It is designed for online streaming inference rather than offline full-sequence processing.
- It is most relevant to stacks that want object detection and short-horizon motion priors from a shared temporal representation.
- It complements sparse query detection methods such as [Sparse4D](sparse4d.md) and temporal perception pages such as [StreamingFlow](streamingflow.md).

## Core Technical Idea

- Detection and forecasting should exchange information instead of running as a strict detect-then-track-then-predict chain.
- Use a shared bidirectional memory that stores detections, forecasts, and query states over time.
- A forecast-aware detection transformer uses multiple-hypothesis forecast memory to improve current spatial reasoning.
- A streaming forecast transformer uses refined detections and past forecasts to improve temporal consistency.
- Avoid explicit tracking to reduce error propagation from wrong associations.
- Propagate motion hypotheses forward so current perception benefits from likely future actor states.

## Inputs and Outputs

- Input: multi-view camera images over time.
- Input metadata: camera intrinsics, extrinsics, ego pose, timestamps, and temporal ordering.
- Optional input: previous query memory from the streaming state.
- Training input: 3D boxes and trajectory annotations from nuScenes-style data.
- Output: current-frame 3D object detections.
- Output: multi-modal or multiple-hypothesis trajectory forecasts.
- Output: streaming memory state for the next frame.

## Architecture or Pipeline

- Multi-view image encoders extract camera features.
- Detection queries and forecast queries interact with current image features and historical memory.
- A multiple-hypothesis forecast memory queue stores future motion candidates from prior frames.
- The forecast-aware detection transformer feeds forecast context back into detection.
- The streaming forecast transformer refines trajectories using current detections and past forecast states.
- Memory is updated frame by frame and reused without an external tracker.
- The output can feed both prediction and planning, but it does not replace dense freespace or occupancy.

## Training and Evaluation

- The main benchmark is nuScenes.
- ForeSight reports an end-to-end prediction accuracy (EPA) of 54.9%.
- The paper reports a +9.3 percentage point EPA gain over previous methods.
- The project page reports a +2.1 percentage point mAP gain over StreamPETR while remaining efficient for streaming inference.
- The paper also reports best mAP and minADE among compared multi-view detection and forecasting models.
- Evaluation should include detection metrics, forecast metrics, latency, memory reset behavior, and performance through occlusions.

## Strengths

- Tightly couples perception and prediction without a brittle tracking handoff.
- Forecast memory can help detect partially occluded or temporarily weak objects.
- Streaming state is closer to deployment than offline sequence aggregation.
- Multiple forecast hypotheses are more useful for planning than one deterministic future.
- Camera-only input can be attractive when LiDAR is unavailable or used as an independent safety layer.
- Query memory is lighter than dense BEV history for many edge deployments.

## Failure Modes

- Camera-only depth and motion remain fragile under glare, darkness, rain, spray, and heavy occlusion.
- Tracking-free does not mean identity-free risk disappears; planners still need stable actor IDs or state continuity.
- Forecasts can reinforce false detections if the memory is not reset after scene cuts, localization jumps, or sensor faults.
- Road-driving motion priors may not match apron choreography, pushback operations, baggage trains, or personnel near aircraft.
- It does not output dense freespace, aircraft clearance envelopes, or FOD occupancy.
- EPA and minADE can hide rare but safety-critical false negatives near the ego path.

## Airside AV Fit

- Useful for joint detection and short-horizon motion forecasting of tugs, buses, baggage tractors, carts, service trucks, and personnel.
- The memory architecture is relevant to objects that vanish briefly behind aircraft, GSE, jet bridges, or baggage trains.
- Airside adaptation needs trajectory classes for coupled motion, such as tug-aircraft pushback, baggage train articulation, and belt-loader positioning.
- Forecast outputs should be treated as planning priors, not as the only collision-avoidance layer.
- Pair with LiDAR/radar occupancy for near-field clearance around wings, engines, cones, chocks, and FOD.
- Validate by turnaround phase, occlusion duration, gate geometry, and nighttime/floodlight conditions.

## Implementation Notes

- Define explicit memory reset conditions for dropped frames, localization jumps, route changes, and camera faults.
- Measure current-frame latency and forecast horizon accuracy together; delayed forecasts can be worse than simpler low-latency models.
- Add class-specific forecast modes for slow GSE, pedestrian, aircraft, and articulated baggage carts.
- Expose forecast uncertainty and multi-hypothesis weights to planning.
- Keep a separate multi-object tracker if downstream modules require persistent IDs.
- Validate against constant-velocity, static-object, and track-then-predict baselines before adopting the full model.

## Sources

- ForeSight project page: https://foresight-iccv.github.io/
- ForeSight arXiv paper: https://arxiv.org/abs/2508.07089
- Official repository: https://github.com/TRAILab/ForeSight
- Sparse query context: [Sparse4D](sparse4d.md)
