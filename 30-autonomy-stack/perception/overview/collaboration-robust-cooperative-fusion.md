# Collaboration-Robust Cooperative Fusion

## What It Covers

- Cooperative perception improves range and occlusion handling by sharing information across vehicles or infrastructure.
- Collaboration-robust fusion focuses on the failures that happen after cooperation starts: bandwidth limits, pose errors, calibration mismatch, delays, packet loss, and low-quality collaborators.
- This page covers mmCooper, CoST, CoopDETR, and QuantV2X as current examples.
- It complements [Collaborative Fleet Perception](collaborative-fleet-perception.md) and [Infrastructure Cooperative Perception](infrastructure-cooperative-perception.md).
- The key airside question is not whether cooperation improves average AP; it is whether bad or stale shared evidence can be safely gated.

## Core Technical Ideas

- mmCooper uses a multi-agent, multi-stage framework that balances intermediate feature sharing and late detection-result sharing.
- mmCooper filters low-confidence sensing information before transmission and refines received detections to reduce damage from misalignment and calibration errors.
- CoST treats historical agents as time-delayed copies of current agents in a unified spatiotemporal representation.
- CoST combines Spatio-temporal Transmission (STT), Unified Spatio-temporal Fusion (USTF), and Multi-Agent Deformable Attention (MADA).
- CoopDETR transmits object queries instead of dense region-level features, then performs spatial query matching and object query aggregation.
- QuantV2X quantizes both neural network computation and transmitted feature messages to reduce latency, memory, and bandwidth.

## Inputs and Outputs

- Input: ego-vehicle perception features, detections, object queries, or BEV features.
- Input from collaborators: transmitted feature tokens, object queries, boxes, tracks, confidence maps, timestamps, and poses.
- Required metadata: sender ID, timestamp, pose, pose covariance, calibration version, sensor-health status, and message type.
- Optional input: communication quality, packet loss, age of information, trust score, and collaborator role.
- Output: fused detections, fused BEV features, cooperative occupancy, or cooperative tracks.
- Monitoring output: accepted/rejected collaborators, stale-message count, bandwidth, latency, fusion weights, and disagreement score.

## Benchmark Signals

- mmCooper is an ICCV 2025 paper evaluated on real-world and simulated cooperative datasets.
- CoST reports on V2V4Real, V2XSet, and DAIR-V2X.
- CoST reports 22.908 ms inference time, 9.790M parameters, 70.96 AP@0.5, and 43.97 AP@0.7 on V2V4Real.
- CoST reports strong robustness under injected latency and localization or heading noise.
- CoopDETR reports state-of-the-art results on OPV2V and V2XSet while reducing transmission cost to 1/782 of previous methods.
- QuantV2X reports a 3.2x system-level latency reduction and +9.5 mAP30 improvement over full-precision baselines under deployment-oriented metrics.
- Benchmarks should include no-collaboration baselines, late fusion, intermediate fusion, bandwidth budgets, delays, pose noise, and collaborator dropout.

## Deployment Risks

- Shared features can be spatially wrong if sender pose or calibration is stale.
- Communication delay can turn a correct remote observation into a dangerous stale obstacle state.
- Dense feature sharing may exceed airport network budgets during fleet peaks.
- Low-confidence or corrupted collaborators can degrade ego perception if fusion weights are not gated.
- Quantization can change uncertainty and confidence calibration.
- Cooperative perception creates security and data-provenance requirements; anonymous feature blobs are not acceptable for safety.
- Multi-agent benchmarks often assume friendlier networking and trust than an airport deployment provides.

## Airside AV Fit

- Strong fit for aircraft-stand occlusions where one vehicle can see around fuselage, service trucks, dollies, or jet bridges.
- Fleet cooperation can improve personnel and GSE awareness in dense turnaround operations.
- Infrastructure-to-vehicle cooperation is useful at gates, blind service-road corners, hangars, and baggage areas.
- Airside networks should prioritize sparse object queries or selected tokens over raw sensor sharing.
- The planner must know whether a hazard is ego-observed, collaborator-observed, stale, or map-inferred.
- Cooperative evidence should expand caution zones before it authorizes motion into spaces the ego sensors cannot verify.

## Implementation Guidance

- Start with late fusion of detections and tracks before deploying intermediate feature fusion.
- Add object-query or sparse-token sharing for bandwidth-limited private 5G or Wi-Fi networks.
- Require pose covariance and timestamp in every cooperative message.
- Drop or downweight messages beyond an age-of-information threshold.
- Use consistency checks between ego observations, map constraints, and collaborator evidence.
- Quantize only after measuring calibration drift in confidence, uncertainty, and downstream planning behavior.
- Log all cooperative inputs so incident review can reconstruct which agent influenced a decision.

## Safety Contract

- Every cooperative output should carry source provenance.
- A remote-only obstacle inside the path should slow or stop the vehicle unless ego sensing clears it with high confidence.
- A remote-only freespace claim should never override an ego obstacle, map no-go zone, or uncertainty gate.
- Collaborator trust should degrade on repeated pose mismatch, stale data, inconsistent detections, or failed authentication.
- Cooperative perception should fail back to single-vehicle perception with a clear operating-mode change.

## Sources

- mmCooper ICCV 2025 paper page: https://openaccess.thecvf.com/content/ICCV2025/html/Liu_mmCooper_A_Multi-agent_Multi-stage_Communication-efficient_and_Collaboration-robust_Cooperative_Perception_Framework_ICCV_2025_paper.html
- mmCooper arXiv paper: https://arxiv.org/abs/2501.12263
- CoST ICCV 2025 paper: https://openaccess.thecvf.com/content/ICCV2025/papers/Tang_CoST_Efficient_Collaborative_Perception_From_Unified_Spatiotemporal_Perspective_ICCV_2025_paper.pdf
- CoopDETR arXiv paper: https://arxiv.org/abs/2502.19313
- QuantV2X arXiv paper: https://arxiv.org/abs/2509.03704
- QuantV2X repository: https://github.com/ucla-mobility/QuantV2X
- Existing fleet overview: [Collaborative Fleet Perception](collaborative-fleet-perception.md)
