# LASP

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "LASP is rated for operational perception validation, calibration, or safety-screening workflows."
method-priority:end -->

## What It Is

LASP is a latency-aware streaming perception method for autonomous driving.

The paper title is "Latency-Aware Spatial-Temporal Perception Network for Autonomous Driving."

It targets online 3D object detection when image frames, history features, and inference outputs are affected by latency.

The paper also proposes a streaming evaluation benchmark based on nuScenes.

## Core Technical Idea

LASP treats latency as part of the perception problem.

Instead of assuming that all sensor frames are available at the same ideal timestamp, it models how historical information should be integrated when data arrives with variable delay.

The method has two key ideas:

- Latency-aware history integration through an object-query linear ODE formulation.
- Predictive detection that uses intention queries and future trajectories to compensate for delay.

The goal is to produce detections at the current decision time, not at the stale sensor-capture time.

## Inputs and Outputs

Inputs:

- Streaming camera frames.
- Historical object queries or temporal features.
- Ego motion information.
- Frame timestamps.
- Latency or delay observations.
- Future-oriented intention queries during prediction.

Outputs:

- Online 3D object detections.
- Current-time object states adjusted for latency.
- Optional future-aware predictions used to reduce stale-output error.

The original work is camera-oriented and evaluated in a nuScenes streaming setting.

## Architecture or Benchmark Protocol

LASP builds on query-based 3D perception.

Architecture concepts:

- Maintain object queries across time.
- Integrate historical queries with a continuous-time or latency-aware update.
- Predict current or near-future object states from delayed observations.
- Use trajectory-informed intention queries for better online estimates.

Benchmark protocol:

- Adapt nuScenes into a streaming perception setting.
- Use frame timing and device latency assumptions.
- Evaluate on edge-device-relevant settings such as NVIDIA Jetson AGX Orin.
- Report online metrics rather than only offline detection metrics.

## Training and Evaluation

Training uses nuScenes-style 3D detection supervision with temporal sequences.

Evaluation reports online 3D detection quality under latency.

Metrics include standard nuScenes-style detection scores, such as mAP and NDS, applied to streaming outputs.

The paper reports that LASP improves online perception under variable latency compared with prior temporal perception baselines.

The benchmark includes 165,280 training samples and 35,364 validation samples derived from 12 Hz nuScenes sweeps, according to the arXiv abstract.

## Strengths

- Makes latency a modeled variable instead of a hidden deployment artifact.
- Works at the perception-output level needed by planners.
- Query-based history integration is compatible with modern transformer-style detectors.
- Predictive detection is useful when output deadlines are strict.
- Benchmarking on edge-device latency is more realistic than offline server timing.
- Good conceptual bridge between perception and real-time autonomy.

## Failure Modes

- Prediction can create confident wrong boxes when actors change intent.
- Camera-only or camera-heavy designs can fail in night glare, rain, or low texture.
- nuScenes timing and traffic patterns do not match airport low-speed operations.
- Modeling latency does not remove hard compute deadlines.
- Continuous-time query integration still depends on accurate ego motion and timestamps.
- Long occlusions may require cooperative or map-based priors beyond LASP.

## Airside AV Fit

LASP is relevant to airside AVs because low speed does not eliminate latency risk.

Airport autonomy still needs bounded-time perception for stop decisions near workers, tugs, and aircraft.

Transfer opportunities:

- Model delayed camera detections near stand entries.
- Predict current position of slow GSE from delayed frames.
- Benchmark perception on actual onboard hardware rather than workstation logs.
- Combine with V2X-ReaLO-style cooperative latency evaluation.

For airside use, extend the benchmark with low-speed stop-start motion, long stationary objects, night floodlights, rain reflections, aircraft occlusion, and strict operational zones.

## Implementation Notes

- Log sensor capture time, preprocessing time, network transfer time, inference finish time, and planner consume time.
- Evaluate stale-output distance error in meters, not just AP.
- Add deadlines tied to vehicle speed and braking distance.
- Keep a non-predictive baseline; prediction should be accepted only when it reduces safety-relevant error.
- For airport trials, evaluate under real edge hardware thermal and power limits.
- Pair LASP with a fallback that marks predictions uncertain after prolonged occlusion.

## Sources

- arXiv paper: https://arxiv.org/abs/2504.19115
- arXiv PDF: https://arxiv.org/pdf/2504.19115
- ar5iv HTML: https://ar5iv.labs.arxiv.org/html/2504.19115
