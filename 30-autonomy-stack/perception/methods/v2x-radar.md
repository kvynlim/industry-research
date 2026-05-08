# V2X-Radar

## What It Is

- V2X-Radar is a real-world cooperative perception dataset with 4D radar.
- It was accepted as a NeurIPS 2025 Spotlight according to the official repository and arXiv page.
- The dataset covers vehicle-side and infrastructure-side sensing.
- It adds 4D radar to the cooperative perception setting where earlier datasets focused mostly on camera and LiDAR.
- It supports cooperative, roadside-only, and vehicle-only perception benchmarks.
- It is a dataset and benchmark codebase, not a single detector architecture.

## Core Technical Idea

- Collect synchronized data from a connected vehicle platform and an intelligent roadside unit.
- Equip both sides with 4D radar, LiDAR, and multi-view cameras.
- Provide real-world scenes where cooperative perception can extend range and reduce occlusion.
- Include adverse lighting and weather so radar value can be measured in cooperative settings.
- Split the dataset into task-oriented subsets for V2X, infrastructure, and vehicle perception.
- Provide codebase support for several cooperative perception models.

## Inputs and Outputs

- Dataset input: 4D radar point clouds.
- Dataset input: LiDAR point clouds.
- Dataset input: multi-view camera images.
- Dataset input: calibration and metadata for vehicle and roadside agents.
- Labels: 3D bounding boxes across five categories.
- Benchmark output: cooperative or single-agent 3D object detection predictions and AP metrics.

## Architecture or Dataset/Pipeline

- The dataset contains 20K LiDAR frames.
- It contains 40K camera images.
- It contains 20K 4D radar frames.
- It provides about 350K annotated 3D boxes.
- Subsets include V2X-Radar-C for cooperative perception, V2X-Radar-I for roadside perception, and V2X-Radar-V for vehicle perception.
- The official codebase supports cooperative models such as F-Cooper, CoAlign, V2X-ViT, CoBEVT, and HEAL.

## Training and Evaluation

- The arXiv page reports comprehensive benchmarks across the three sub-datasets.
- Scenarios include sunny and rainy weather plus daytime, dusk, and nighttime.
- The repository includes data in OPV2V and KITTI-style formats.
- Cooperative AP is reported by distance ranges such as 0-30 m, 30-50 m, and 50-100 m.
- Evaluation can compare late fusion, intermediate fusion, roadside-only, and vehicle-only settings.
- Dataset revisions and pretrained weights were released in January 2026 according to the repository changelog.

## Strengths

- First large real-world cooperative perception dataset centered on 4D radar.
- Directly useful for studying infrastructure radar under rain and night conditions.
- Includes both single-agent and cooperative benchmarks.
- Public codebase lowers the cost of reproducing V2X baselines.
- Radar point clouds add velocity and weather robustness to V2I perception.
- Strong fit for bounded operational domains with fixed infrastructure.

## Failure Modes

- Roadside geometry differs from airport aprons, stands, gates, and service roads.
- Cooperative perception depends on calibration, time synchronization, communication latency, and packet loss.
- Dataset boxes do not cover airport-specific objects or aircraft clearance envelopes.
- 4D radar point clouds may lose information compared with raw radar tensors.
- Benchmarks may reward average AP while hiding rare safety-critical classes.
- Infrastructure sensors introduce cybersecurity and maintenance requirements.

## Airside AV Fit

- Very high relevance because airports can deploy fixed roadside sensors and private 5G.
- Infrastructure 4D radar is attractive for rain, night, fog, de-icing, and occlusion around aircraft.
- V2X-Radar provides the closest public analogue for vehicle-plus-infrastructure 4D radar perception.
- Airport adaptation needs stand-side sensor placement studies and airside-specific labels.
- Cooperative outputs should enhance, not gate, the vehicle's onboard safety autonomy.
- Best use is a benchmark template for an airside V2I radar dataset.

## Implementation Notes

- Reuse the dataset schema ideas for airport data: vehicle node, infrastructure node, calibration, synchronized radar/LiDAR/camera.
- Add latency traces and packet-loss logs to any airside collection because V2X timing is safety-relevant.
- Keep single-agent baselines so infrastructure value can be quantified.
- Track per-class and per-zone performance, not just aggregate AP.
- Evaluate under night/rain and with aircraft occlusions specifically.
- Separate safety-critical onboard perception from cooperative enhancement in architecture documents.

## Sources

- Paper: https://arxiv.org/abs/2411.10962
- Official repository: https://github.com/yanglei18/V2X-Radar
- Dataset hosting: https://huggingface.co/datasets/yanglei18/V2X-Radar
- OpenReview page: https://openreview.net/forum?id=sTKsFIVqik
