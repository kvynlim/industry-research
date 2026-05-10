# StreamingFlow

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "mapping", "validation", "road-av"]
  reason: "StreamingFlow is rated for motion segmentation, scene flow, or dynamic-object perception workflows."
method-priority:end -->

## What It Is

- StreamingFlow is a CVPR 2024 streaming occupancy forecasting framework.
- It targets asynchronous multi-modal sensor streams rather than synchronized sensor packets.
- The method predicts future BEV occupancy and flow at arbitrary future timestamps.
- It is designed for camera and LiDAR streams that arrive at different rates and times.
- The key operational concern is perception latency: update as soon as a sensor feature arrives.
- It is a continuous-time occupancy-flow method, not a Gaussian world model.

## Core Technical Idea

- Encode each incoming sensor observation into a BEV feature.
- Maintain a hidden BEV state that evolves continuously over time.
- Use a SpatialGRU-ODE module to learn derivatives of BEV features and propagate the state between observations.
- Fuse incoming modality features by triggering an update when the data arrives, instead of waiting for synchronized camera-LiDAR pairs.
- Decode the propagated BEV state into occupancy and flow at requested future timestamps.
- Train from sparse, uniformly sampled labels while allowing dense streaming inference.
- The design directly attacks the timing mismatch between sensor streams, labels, and planner query times.

## Inputs and Outputs

- Input: asynchronous camera image stream with timestamps and calibration.
- Input: asynchronous LiDAR point cloud stream with timestamps and ego-motion metadata.
- Input: requested prediction horizon or evaluation interval.
- Training input: BEV occupancy-flow labels sampled at discrete dataset times.
- Output: future BEV instance occupancy grids.
- Output: future flow/displacement fields for occupied BEV cells.
- Output can be queried at intervals such as 0.05 s, 0.1 s, 0.25 s, or other application-defined timestamps.

## Architecture or Pipeline

- Camera branch converts perspective image features into BEV features.
- LiDAR branch encodes point clouds with a pillar-style BEV encoder.
- A shared BEV state starts from an initialized hidden representation.
- SpatialGRU-ODE performs two roles: update when a measurement arrives, and predict when the system needs a future state.
- The update stage handles asynchronous multi-sensor fusion on the timeline.
- The prediction stage propagates the BEV state with variable ODE steps to the requested timestamp.
- Decoders follow FIERY-style occupancy forecasting heads for segmentation, centers, offsets, future flow, and instances.

## Training and Evaluation

- Main datasets: nuScenes and Lyft L5.
- The paper evaluates prediction of future occupancy and flow rather than only current perception.
- The official repo reports a past-1s, future-2s setting with camera at 2 Hz, LiDAR at 5 Hz, variable ODE steps, and 53.7 IoU / 50.7 VPQ.
- The repo includes scripts for standard evaluation, streaming interval evaluation, and data-stream interval evaluation.
- Experiments include unseen future horizons out to 8 s and prediction intervals down to 0.05 s.
- Training losses include occupancy/segmentation terms, spatial regression terms, and an auxiliary probabilistic KLD term between updated BEV features and latent observations.
- Evaluation should always disclose sensor stream rates, requested forecast interval, and whether the ODE step is fixed or variable.

## Strengths

- Directly models sensor timing, which matters more in deployed systems than in frame-synchronized benchmarks.
- Can reduce planner latency by producing a forecast at the time the planner asks, not only at dataset keyframes.
- Handles different camera and LiDAR frequencies without forcing artificial synchronization.
- Continuous-time BEV state gives a clean abstraction for event-driven perception pipelines.
- Supports long-horizon stress tests and dense interval visualization.
- Fusion is naturally compatible with sensor-drop and sensor-delay experiments.

## Failure Modes

- Learned continuous dynamics can look smooth while being wrong under sudden braking, turning, or occlusion emergence.
- ODE propagation may hide timestamp bugs because output is always available at any requested time.
- BEV occupancy-flow labels from boxes do not fully represent unusual shapes or static clutter.
- Long-horizon forecasts degrade and can become overconfident without calibrated uncertainty.
- Performance depends on accurate ego-motion compensation between asynchronous streams.
- Camera and LiDAR branch latency must be measured separately; algorithmic streaming does not eliminate encoder runtime.

## Airside AV Fit

- Strong fit for airside systems where cameras, radars, LiDARs, and trackers often run at different rates.
- Useful for low-latency planning around service roads, stand crossings, and pushback corridors.
- The method's trigger-update framing maps well to radar-first updates during rain, fog, or spray.
- Airport deployment should add radar as another asynchronous BEV feature stream, not assume camera-LiDAR only.
- Future occupancy is valuable around baggage trains, tugs, buses, and personnel moving between occlusions.
- Must be validated against airport-specific timing cases: dropped frames, delayed network cameras, rolling-shutter exposure, and sensor time-base drift.

## Implementation Notes

- Treat timestamps as first-class data; do not round all sensors to the nearest keyframe during preprocessing.
- Log encoder completion time separately from sensor capture time and planner query time.
- Use replay tests with deliberately shifted sensor streams to verify latency robustness.
- Preserve ego-pose interpolation across the full asynchronous timeline.
- Add metrics for "time-to-usable-forecast" in addition to IoU, VPQ, PQ, SQ, and RQ.
- Use fixed-rate synchronized baselines to prove the streaming machinery is buying real latency or accuracy.
- Stress test ODE step settings after TensorRT or other deployment conversion because numerical behavior can change.

## Sources

- CVPR 2024 paper PDF: https://openaccess.thecvf.com/content/CVPR2024/papers/Shi_StreamingFlow_Streaming_Occupancy_Forecasting_with_Asynchronous_Multi-modal_Data_Streams_via_CVPR_2024_paper.pdf
- arXiv paper: https://arxiv.org/abs/2302.09585
- Official StreamingFlow repository: https://github.com/synsin0/StreamingFlow
- FIERY project: https://anthonyhu.github.io/fiery
- nuScenes dataset: https://www.nuscenes.org/nuscenes
- Lyft Level 5 dataset: https://level-5.global/data/
