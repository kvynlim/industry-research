# POD FMCW LiDAR Predictive Detection

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "prototype"
  tags: ["perception", "fallback", "validation", "adverse-weather", "road-av"]
  reason: "POD FMCW LiDAR Predictive Detection is rated for alternative-sensor perception and adverse-weather fallback evaluation."
method-priority:end -->

## What It Is

- POD is a 2025 predictive object detection framework for single-frame FMCW LiDAR point clouds.
- It extends standard 3D detection from current object boxes to short-term future object boxes using only the current FMCW frame.
- The method exploits per-point radial velocity, a core advantage of FMCW LiDAR over conventional time-of-flight LiDAR.
- It is a predictive detector, not a full scene-flow method, tracker, or dense occupancy forecaster.
- It is related to [AevaScenes](aevascenes.md) because public FMCW LiDAR data makes this class of method easier to study, but the POD paper reports experiments on an in-house dataset.

## Core Idea

- Use FMCW LiDAR radial velocity at each reflected point as immediate motion evidence.
- Generate virtual future points from the current frame using a ray-casting mechanism.
- Build a virtual two-frame point cloud consisting of current points and predicted future points.
- Encode the virtual two-frame cloud with a sparse 4D encoder.
- Split encoded temporal features back into BEV features for current detection and future predictive detection.
- Avoid waiting for historical multi-frame context so the detector can react faster to emerging hazards.
- Treat prediction as part of detection rather than a downstream tracker-only task.

## Inputs and Outputs

- Input: a single FMCW LiDAR point cloud.
- Required point fields: 3D position and radial velocity; intensity or reflectivity may also be available depending on the sensor.
- Input metadata: sensor calibration, ego-motion state, timestamp, and coordinate frame definition.
- Training input: current 3D boxes and short-term future boxes or labels aligned to the prediction horizon.
- Output: current-frame 3D object detections.
- Output: short-term future 3D object detections, including predicted future location and dimensions.
- It does not natively output dense semantic occupancy, instance tracks, or full 3D scene flow.

## Architecture or Pipeline

- Ingest a single FMCW LiDAR point cloud with radial velocity measurements.
- Use ray casting to propagate current points into a virtual future point set.
- Concatenate or organize current and virtual future points as a two-time-step point cloud.
- Voxelize the virtual two-frame point cloud.
- Apply a sparse 4D encoder to learn spatiotemporal voxel features.
- Separate encoded features by temporal index and remap them into two BEV feature maps.
- Decode one BEV map for standard current detection and the other for predictive future detection.

## Training and Evaluation

- The POD paper evaluates on an in-house FMCW LiDAR dataset.
- Reported tasks include both standard current-frame detection and predictive object detection.
- The paper frames POD as short-term future localization and dimension prediction from current observations only.
- Evaluation should compare against conventional single-frame detectors, multi-frame detectors, tracker-plus-predictor baselines, and ablations without radial velocity.
- Metrics should report current detection accuracy and future detection accuracy separately.
- Latency matters: the claimed operational value comes from avoiding historical context, so wall-clock response time must be measured.
- Public [AevaScenes](aevascenes.md) data can support follow-on validation, but it should not be assumed equivalent to the in-house POD dataset.

## Strengths

- Uses direct per-point velocity rather than estimating all motion from frame-to-frame displacement.
- Can predict short-term future boxes from one frame, reducing startup latency for newly observed moving objects.
- Sparse 4D encoding gives the model a structured way to use virtual current/future geometry.
- Current and future heads share early features while keeping outputs separable.
- Particularly relevant for fast-reacting hazard detection when history is unavailable or stale.
- Complements scene-flow methods by producing object-level future boxes that are easier to consume in existing AV stacks.

## Failure Modes

- FMCW radial velocity observes line-of-sight motion; lateral motion remains underconstrained from velocity alone.
- Ray-cast virtual future points can be wrong under turning, acceleration, articulation, or ego-motion error.
- Future box dimensions may be unstable for partially observed objects.
- Single-frame prediction has limited ability to infer intent, yielding, coupling, or planned turns.
- Sensor-specific FMCW noise, ghost returns, and velocity ambiguity can create false future hazards.
- In-house-dataset results may not transfer to other FMCW LiDAR vendors or mounting geometries.

## Airside AV Fit

- Strong fit for early warning around moving tugs, buses, service vehicles, and baggage trains.
- Single-frame velocity is valuable when an actor emerges from behind equipment or an aircraft and no track history exists.
- Useful for apron scenarios with slow ego speed but complex cross traffic.
- Needs special validation for lateral movers crossing the sensor's line of sight, because radial velocity can be small.
- Future boxes should be combined with dense occupancy for aircraft clearance and irregular equipment shapes.
- Airport deployment should include wet pavement, reflective aircraft skin, rotating beacons, jet bridges, and close-range personnel.

## Implementation Notes

- Preserve radial velocity in the point-cloud schema; dropping it reduces POD to an ordinary LiDAR detector.
- Define the prediction horizon explicitly and train/evaluate all models at the same horizon.
- Correct for ego-motion before ray casting virtual future points.
- Keep current and future detections distinguishable in downstream APIs to avoid planner confusion.
- Add uncertainty or confidence calibration for future boxes; single-frame prediction can be overconfident.
- Benchmark against a tracker warm-start case and a no-history case separately.
- When using Aeva hardware or [AevaScenes](aevascenes.md), verify field names, units, velocity sign convention, and timestamp semantics before porting the model.

## Sources

- POD arXiv paper: https://arxiv.org/abs/2504.05649
- Official AevaScenes site: https://scenes.aeva.com/
- Aeva GitHub organization: https://github.com/aevainc
- AevaScenes method page: [AevaScenes](aevascenes.md)
