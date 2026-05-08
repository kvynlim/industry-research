# V2X-ReaLO

## What It Is

V2X-ReaLO is an online framework and dataset for real-world V2X cooperative perception.

The name expands the V2X-Real line of work toward online evaluation.

It targets a practical gap in cooperative perception: many methods report offline accuracy, but deployed systems must handle latency, synchronization, communication, and real-time fusion.

The arXiv paper presents both a unified online framework and an annotated synchronized ROS-bag dataset.

## Core Technical Idea

V2X-ReaLO evaluates cooperative perception as an online system rather than as a static benchmark.

The framework supports multiple fusion modes under one evaluation harness:

- Early fusion.
- Late fusion.
- Intermediate fusion.

The key idea is to measure accuracy together with communication and processing latency.

The system replays synchronized real-world V2X data through an online pipeline, so perception results are evaluated at the time they would actually be consumed.

This shifts the question from "does cooperation improve AP offline" to "does cooperation improve perception before the information is stale."

## Inputs and Outputs

Inputs:

- Time-synchronized vehicle and infrastructure sensor streams.
- ROS-bag data for online replay.
- Calibration and pose information for cooperative alignment.
- Communication path assumptions for V2X exchange.
- Annotated keyframes for detection evaluation.

Outputs:

- Online cooperative 3D object detections.
- Per-fusion-mode accuracy results.
- Latency and communication measurements.
- Evidence of online feasibility for intermediate fusion.

The paper reports 25,028 synchronized test frames and 6,850 manually annotated keyframes in the V2X-ReaLO dataset.

## Architecture or Benchmark Protocol

V2X-ReaLO is best read as a benchmark harness and online system design.

Protocol:

- Replay real synchronized V2X sequences.
- Run ego-only, early-fusion, late-fusion, and intermediate-fusion pipelines under comparable conditions.
- Account for sensor, processing, and communication timing.
- Measure whether fused messages arrive in time to improve current-frame perception.
- Report accuracy and latency together.

The online framing is the main contribution; it exposes methods that look strong offline but cannot deliver useful results in real time.

## Training and Evaluation

Training can reuse cooperative perception backbones from V2X-Real-style methods.

Evaluation uses annotated V2X-ReaLO keyframes and online replay.

Important evaluation signals:

- Online 3D detection accuracy.
- End-to-end latency.
- Communication volume.
- Accuracy degradation when cooperative data arrives late.
- Comparison among early, late, and intermediate fusion.

The paper reports a practical online intermediate-fusion demonstration, which is important because intermediate fusion often gives strong accuracy but has harder communication and timing requirements.

## Strengths

- Directly targets online V2X deployment rather than offline AP only.
- Uses real-world synchronized V2X data.
- Provides a unified comparison across fusion modes.
- Makes latency a first-class metric.
- ROS-bag format lowers the barrier for replay and integration testing.
- Helps separate useful cooperation from stale cooperation.

## Failure Modes

- Dataset scale is smaller than mature offline datasets.
- Keyframe annotations may miss continuous-time failures between labels.
- Real-time performance depends on hardware, middleware, and network stack choices.
- Online results may not transfer across communication technologies.
- Urban road scenes do not cover airport stand behavior.
- If transforms or clocks are optimistic, latency-aware conclusions may be too favorable.

## Airside AV Fit

V2X-ReaLO is directly relevant to airport autonomous vehicles because airside V2X must be online.

Airport vehicles cannot use infrastructure detections after they are stale, even at low speed.

Airside applications:

- Vehicle-infrastructure fusion for service-road crossings.
- Infrastructure assistance when aircraft or equipment blocks onboard sensors.
- Online validation of private 5G or Wi-Fi communication budgets.
- Latency-aware fallback policies when cooperative data arrives too late.

For airport use, the benchmark should add apron-speed profiles, stop-and-go operations, stand-specific occlusions, and network handoff or dropouts near terminal structures.

## Implementation Notes

- Reproduce the online replay loop before comparing models.
- Log every timestamp separately: sensor capture, message publish, receive, fusion, inference finish, and planner consume.
- Treat stale cooperative data as a safety-relevant state, not just a missed frame.
- Add deadline-based metrics such as AP before 100 ms, 200 ms, and 500 ms.
- For airside transfer, replay real apron rosbags through the same online protocol.
- Keep a vehicle-only fallback in the benchmark to quantify when cooperation is worth the latency cost.

## Sources

- arXiv paper: https://arxiv.org/abs/2504.16043
- arXiv PDF: https://arxiv.org/pdf/2504.16043
- V2X-Real project page: https://mobility-lab.seas.ucla.edu/v2x-real/
