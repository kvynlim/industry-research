# CoopTrack

## What It Is

CoopTrack is an ICCV 2025 cooperative multi-object tracking method.

It targets end-to-end 3D tracking across connected agents.

Unlike cooperative detection methods that fuse dense BEV features and then run a tracker, CoopTrack focuses on sparse instance-level cooperation.

The paper was selected as an ICCV 2025 highlight.

## Core Technical Idea

CoopTrack communicates instance-level features rather than full BEV feature maps.

Each agent extracts sparse features associated with detected or tracked object instances.

The method then performs cross-agent association and aggregation.

The central idea is that tracking needs object identity continuity, so it is wasteful to transmit large spatial feature maps when the relevant information is object-centric.

Core components include:

- Multi-dimensional feature extraction for tracked instances.
- Cross-agent association.
- Feature aggregation through a learnable association structure.
- End-to-end training for cooperative tracking.

## Inputs and Outputs

Inputs:

- Sequential sensor observations from multiple agents.
- Agent poses and relative transforms.
- Per-agent instance features.
- Temporal track state.
- Candidate detections or queries.

Outputs:

- 3D bounding boxes.
- Track identities.
- Track confidence scores.
- Cooperative association results across agents.

The output is a temporal object state, not only frame-level detections.

## Architecture or Benchmark Protocol

CoopTrack is designed around a tracking pipeline rather than a single-frame detector.

The method avoids dense BEV collaboration and instead sends sparse instance messages.

Benchmark protocol:

- Run cooperative 3D multi-object tracking on V2X sequences.
- Compare against tracking-by-detection and cooperative-detection-plus-tracking baselines.
- Measure both object localization and identity continuity.
- Evaluate communication efficiency from sparse feature exchange.

Reported datasets include V2X-Seq and Griffin.

## Training and Evaluation

Training optimizes cooperative tracking with temporal and cross-agent association.

Evaluation uses metrics such as:

- 3D detection AP or mAP.
- AMOTA or related multi-object tracking accuracy.
- Identity-switch behavior.
- Track continuity across occlusion and agent handoff.
- Communication cost relative to dense BEV methods.

The paper reports state-of-the-art results on V2X-Seq, including 39.0 mAP and 32.8 AMOTA in the abstract.

## Strengths

- Directly addresses tracking, a deployment-critical perception output.
- Sparse instance communication is more bandwidth efficient than dense BEV sharing.
- Cross-agent association is learned rather than handled only by post-processing.
- Better suited to long-lived object handoff than frame-only cooperative detection.
- Compatible with scenarios where different agents see the same object at different times.

## Failure Modes

- Requires reliable instance features; missed detections can still break tracks.
- Track identity can drift when objects are close, similar, or mutually occluding.
- Pose and time alignment errors can create false cross-agent associations.
- Sparse instance messages may omit untracked emerging hazards.
- Benchmarks are road-oriented and may not cover long stationary periods.
- Airport equipment often moves slowly or stops, which can confuse motion-based association.

## Airside AV Fit

CoopTrack is highly relevant for airport autonomy because airside risk often depends on identity continuity.

Examples:

- Track a tug from infrastructure view into onboard view.
- Preserve identity of a worker near an aircraft after temporary occlusion.
- Avoid double-counting the same baggage cart seen by two vehicles.
- Maintain long-lived tracks for aircraft pushback, belt loaders, stairs, buses, and dollies.

The method's sparse communication is attractive for apron networks where many vehicles and fixed sensors may share a channel.

## Implementation Notes

- Evaluate identity switches, track fragmentation, and stale-track deletion, not just AP.
- Add airport stationary-object handling; many hazards are parked but still relevant.
- Treat tracks near aircraft as high-priority instances for communication.
- Validate handoff between fixed infrastructure sensors and moving AV sensors.
- Add class-specific track lifetimes for workers, aircraft, GSE, cones, and FOD candidates.
- Include latency in association tests because stale instance features can create wrong identities.

## Sources

- arXiv paper: https://arxiv.org/abs/2503.11870
- arXiv PDF: https://arxiv.org/pdf/2503.11870
- ICCV 2025 Open Access page: https://openaccess.thecvf.com/content/ICCV2025/html/Song_CoopTrack_Cooperative_3D_Multi-Object_Tracking_via_Instance-Level_Feature_Collaboration_ICCV_2025_paper.html
