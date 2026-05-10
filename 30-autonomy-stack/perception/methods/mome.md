# MoME

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "fallback", "validation"]
  reason: "Useful resilient fusion pattern for adverse sensor failure cases."
method-priority:end -->

## What It Is

- MoME is a camera-LiDAR 3D object detection architecture for resilient sensor fusion.
- The full paper title is "Resilient Sensor Fusion Under Adverse Sensor Failures via Multi-Modal Expert Fusion."
- It was accepted at CVPR 2025 and released with an official implementation.
- The target problem is cascading failure in joint fusion models when one modality becomes unreliable.
- The method is designed for nuScenes-style multi-camera plus LiDAR perception.
- It treats sensor failure as an architectural problem, not only as data augmentation.

## Core Technical Idea

- Replace a single fused decoder with multiple expert decoders.
- Maintain one camera expert, one LiDAR expert, and one multi-modal expert.
- Route each object query to the most suitable expert using an Adaptive Query Router.
- Estimate routing probabilities from modality-specific feature quality.
- Decode each query with only one selected expert, keeping decoder cost close to a single-decoder model.
- Decouple modality dependence so a bad modality is less likely to contaminate every query.
- Preserve cross-modal complementarity when both sensors are valid.

## Inputs and Outputs

- Inputs are synchronized multi-view camera images and a LiDAR point cloud.
- The paper uses a VoxelNet-style LiDAR encoder for point clouds.
- Camera inputs are encoded into image features for Transformer-based detection.
- Intermediate outputs are modality-specific query features and router scores.
- Final outputs are 3D bounding boxes, classes, confidence scores, and nuScenes detection metrics.
- The method assumes approximate calibration and timing remain usable.
- It does not consume radar or explicit sensor-health telemetry in the reported setup.

## Architecture or Benchmark Protocol

- The base detector follows a Transformer fusion lineage and is implemented on top of MEFormer-style code.
- A feature encoder extracts camera and LiDAR features separately.
- A shared query set represents candidate objects.
- Three parallel expert decoders process queries with camera-only, LiDAR-only, or fused evidence.
- The Adaptive Query Router predicts which expert should own each query.
- The router is trained to prefer the decoder that gives the strongest detection signal under current feature quality.
- Single-expert routing avoids running all decoders for every query at inference.
- The architecture can be inserted into other Transformer-based fusion detectors if their decoder interface is compatible.

## Training and Evaluation

- Training follows the detector's standard detection losses for classification and box regression.
- The robustness protocol follows nuScenes-R sensor failure scenarios.
- Reported nuScenes-R cases include beam reduction, LiDAR drop, limited FOV, object failure, camera view drop, and occlusion.
- The repository also references nuScenes-C for common corruptions and extreme weather.
- The GitHub qualitative table reports clean NDS of 73.6 and degraded NDS values across failure modes.
- The paper reports gains over CMT in LiDAR-drop, camera-drop, and limited-FOV scenarios.
- The key evaluation signal is whether performance degrades gracefully when one modality fails.

## Strengths

- Query-level routing is more granular than choosing one global fusion mode per frame.
- Expert specialization gives the model a clean path when one modality is unreliable.
- The compute overhead is controlled because each query uses one expert.
- It directly targets failures that are common in real deployments: dropped views, sparse LiDAR, occlusion, and reduced FOV.
- The implementation is public and anchored in common 3D detection toolchains.
- The design is easy to explain to safety reviewers as a controlled fallback inside the detector.

## Failure Modes

- The router can select the wrong expert if feature quality is misleading.
- If both camera and LiDAR are degraded in the same region, expert selection cannot recover missing evidence.
- The method does not replace independent sensor-health monitoring.
- The reported setup does not cover radar, thermal, event cameras, or infrastructure sensors.
- It assumes failures resemble nuScenes-R and nuScenes-C perturbations.
- It may still fail under calibration drift, time skew, or adversarial sensor artifacts.
- Extra expert parameters increase model memory and training complexity.

## Airside AV Fit

- MoME is relevant for apron vehicles that must survive temporary camera blockage, water spray, or LiDAR sparsity.
- Query-level fallback maps well to airside scenes where only part of the sensor suite may be blinded by jet wash or glare.
- It is less complete for airport GSE fleets that rely on radar for adverse weather redundancy.
- Airside validation should add aircraft, cones, tugs, belt loaders, tow bars, and ground crew under sensor faults.
- A safety case would need logged apron failures, not only nuScenes-R synthetic failures.
- It is best treated as a perception robustness layer beneath a separate ODD and sensor-health policy.

## Implementation Notes

- Start from the official MoME repository only for research replication; production systems need integration review.
- Keep router outputs available for telemetry so planners can see which modality expert was used.
- Test against real dropouts, stale frames, dirty lenses, partial LiDAR beam loss, and sun glare.
- Do not use MoME as the only fallback policy; pair it with health monitors and conservative planning envelopes.
- Compare against simpler sensor-dropout training to measure whether expert routing adds enough value.
- For airside work, extend the architecture to radar or add an external radar fallback detector.

## Sources

- CVPR 2025 paper: https://openaccess.thecvf.com/content/CVPR2025/papers/Park_Resilient_Sensor_Fusion_Under_Adverse_Sensor_Failures_via_Multi-Modal_Expert_CVPR_2025_paper.pdf
- Official implementation: https://github.com/konyul/MoME
- arXiv abstract: https://arxiv.org/abs/2503.19776
