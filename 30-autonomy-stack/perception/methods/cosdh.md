# CoSDH

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "validation", "road-av"]
  reason: "CoSDH is rated as a supporting perception method for autonomy-stack triage and follow-up reading."
method-priority:end -->

## What It Is

CoSDH is a CVPR 2025 cooperative perception method for communication-efficient 3D object detection.

The name stands for supply-demand awareness and intermediate-late hybridization.

It is designed for bandwidth-constrained collaborative perception, where agents should share only information that is useful to another agent.

The method focuses on LiDAR-based cooperative 3D detection across connected vehicles or V2X agents.

## Core Technical Idea

CoSDH models cooperation as a supply-demand problem.

The ego agent estimates where it needs help.

The cooperating agent estimates what useful information it can supply.

Instead of broadcasting dense feature maps, CoSDH exchanges compact demand and supply cues to select useful regions.

It then combines:

- Intermediate fusion for selected feature regions.
- Late fusion for object-level predictions.

This hybrid design tries to preserve the accuracy of intermediate fusion while keeping communication closer to late-fusion budgets.

## Inputs and Outputs

Inputs:

- LiDAR point clouds from ego and cooperative agents.
- Agent poses and relative transforms.
- Feature maps from a 3D detection backbone.
- Demand maps from the ego agent.
- Supply maps from cooperative agents.
- Optional object-level detections for late fusion.

Outputs:

- Cooperative 3D bounding boxes.
- Confidence scores and class labels.
- Selected communication masks or regions.
- Intermediate fused features for high-value regions.

The primary output is 3D object detection, not occupancy or tracking.

## Architecture or Benchmark Protocol

The paper uses a PointPillars-style backbone in its main implementation.

Main components:

- Ego demand generator.
- Cooperative supply generator.
- Sparse or selected intermediate feature communication.
- Intermediate feature fusion in high-value regions.
- Confidence-aware late fusion of detected objects.

The benchmark compares CoSDH against no-fusion, late-fusion, and intermediate-fusion cooperative detection methods.

Datasets include common cooperative perception benchmarks such as OPV2V, V2X-Sim, DAIR-V2X, and V2V4Real in the reported experiments.

## Training and Evaluation

Training optimizes cooperative 3D detection while learning where communication is valuable.

Evaluation emphasizes:

- 3D detection AP at standard IoU thresholds.
- Communication volume in megabits per second or equivalent payload size.
- Performance under bandwidth limits.
- Robustness under latency.
- Comparison against dense intermediate fusion and object-level late fusion.

The paper reports strong accuracy with substantially reduced communication, including results under DSRC-style bandwidth constraints.

## Strengths

- Communication budget is built into the method, not treated as an afterthought.
- Demand and supply maps make cooperation more targeted.
- Hybrid intermediate-late fusion balances detail and payload size.
- Works with standard LiDAR 3D detection backbones.
- Evaluated across multiple cooperative perception datasets.
- Especially relevant where network bandwidth is variable or regulated.

## Failure Modes

- Demand estimation can fail when the ego agent is confidently wrong.
- Supply estimation can miss useful regions if the cooperative agent has poor local perception.
- Two-stage or multi-message cooperation can be sensitive to latency.
- Pose errors can make selected regions misalign.
- Late-fusion confidence can over-trust stale or duplicated objects.
- LiDAR-centered evaluation does not cover camera-only or radar-heavy deployments.
- Road-driving datasets underrepresent airport equipment and aircraft occlusion geometry.

## Airside AV Fit

CoSDH is a strong fit for airside V2X where bandwidth must be rationed.

Airport private networks may support high throughput, but safety-critical links still need bounded payloads and deadlines.

Airside uses:

- Ego vehicle asks infrastructure for help near aircraft blind zones.
- Fixed mast supplies only stand-entry conflict regions.
- Multiple GSE vehicles cooperate without saturating wireless links.
- Cooperative perception prioritizes workers, tugs, and under-wing areas.

The method is most useful if demand maps are safety-aware, not just confidence-aware.

## Implementation Notes

- Reproduce CoSDH on one public cooperative dataset before airport adaptation.
- Log payload size, message count, and end-to-end latency separately.
- Add hard region priorities for airside zones: stand safety envelope, aircraft nose gear, service-road crossings, and pedestrian lanes.
- Evaluate false negatives inside requested demand regions.
- Test degraded calibration and 100 ms to 300 ms latency because selected regions age quickly.
- Consider replacing road classes with an airside object taxonomy and rare-object weighting.

## Sources

- CVPR 2025 paper: https://openaccess.thecvf.com/content/CVPR2025/html/Xu_CoSDH_Communication-Efficient_Collaborative_Perception_via_Supply-Demand_Awareness_and_Intermediate-Late_Hybridization_CVPR_2025_paper.html
- CVPR 2025 PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Xu_CoSDH_Communication-Efficient_Collaborative_Perception_via_Supply-Demand_Awareness_and_Intermediate-Late_Hybridization_CVPR_2025_paper.pdf
- arXiv: https://arxiv.org/abs/2405.04597
