# RCooper

## What It Is

RCooper is a CVPR 2024 real-world dataset and benchmark for roadside cooperative perception.

The atomic unit is infrastructure-to-infrastructure cooperation: multiple roadside sensor units observe the same road scene and share perception information.

It is not a vehicle-to-vehicle method and not a pure simulation benchmark.

The dataset targets two difficult road layouts:

- Intersections with heavy occlusion and crossing traffic.
- Corridors where long-range perception depends on distributed roadside views.

The paper positions RCooper as a gap-filler between simulated cooperative perception datasets and real vehicle-infrastructure datasets.

## Core Technical Idea

RCooper treats fixed roadside sensors as cooperative agents.

Each agent has its own local view, local coordinate frame, calibration, and occlusion pattern.

Cooperation is evaluated by fusing observations from multiple roadside agents into a common perception result.

The core research question is whether distributed infrastructure views can recover objects that are weak, distant, or occluded from one agent.

The benchmark supports comparison of:

- Single-agent perception.
- Early fusion of raw or low-level observations.
- Intermediate feature fusion.
- Late fusion of object-level predictions.

This makes RCooper useful as a controlled testbed for roadside V2X perception, especially when ego-vehicle sensors are absent or treated as secondary.

## Inputs and Outputs

Inputs:

- Synchronized roadside camera images.
- Synchronized roadside LiDAR point clouds.
- Sensor calibration and extrinsic transforms.
- Agent identities and scene timestamps.
- 3D bounding-box annotations in a shared coordinate frame.

Outputs:

- Cooperative 3D object detections.
- Cooperative multi-object tracks.
- Per-agent or fused predictions, depending on the baseline.

The object taxonomy follows road traffic rather than airport taxonomy, so airside use requires remapping classes.

## Architecture or Benchmark Protocol

RCooper is primarily a dataset and protocol, not a single neural architecture.

The paper evaluates representative cooperative perception baselines to establish the benchmark.

Protocol elements:

- Keep each roadside unit as a distinct cooperative agent.
- Transform observations or predictions into a shared frame before fusion.
- Compare single-agent performance against cooperative fusion performance.
- Evaluate both detection and tracking.
- Separate intersection and corridor settings because they stress different occlusion and range patterns.

The benchmark is especially relevant for methods such as F-Cooper, AttFuse, Where2Comm, CoBEVT, and other intermediate-fusion designs.

## Training and Evaluation

Training uses the released annotated roadside data splits.

Evaluation focuses on cooperative perception quality under real calibration, synchronization, and occlusion conditions.

Typical metrics include:

- 3D detection average precision.
- BEV or 3D IoU thresholds.
- Tracking quality metrics for identity continuity.
- Comparison between no-cooperation and cooperation modes.

The important signal is not only absolute AP; it is the recovery of objects that are hard for a single roadside unit.

## Strengths

- Real-world roadside data rather than simulated V2X scenes.
- Infrastructure-to-infrastructure cooperation is a clean match for fixed sensor deployments.
- Intersection and corridor subsets cover two common infrastructure perception regimes.
- Detection and tracking support make it useful beyond static object recall.
- The dataset makes calibration and time alignment practical issues instead of hidden assumptions.

## Failure Modes

- Results depend strongly on extrinsic calibration between roadside units.
- Clock drift or timestamp mismatch can corrupt fusion during dynamic traffic.
- Roadside mounting geometry may not transfer to airport stands, gates, or service roads.
- Public-road classes miss airside-specific actors such as aircraft, belt loaders, tugs, dollies, cones, and ground crew.
- Static infrastructure views can still be blind behind large occluders.
- Cooperative gains may disappear when agents see highly redundant views.

## Airside AV Fit

RCooper is a strong conceptual fit for airport infrastructure perception.

Airport stands already have plausible fixed mounting points: terminal facades, light poles, jet bridge structures, and perimeter masts.

The most transferable pattern is infrastructure-to-infrastructure fusion around occluders.

Airside examples:

- Recover a baggage cart hidden from one mast by an aircraft fuselage.
- Track a tug through a stand entry conflict zone.
- Fuse long-range apron views from multiple fixed LiDARs.

Before using RCooper-style evidence in an airside safety case, collect an airport-specific dataset with airport classes, low-speed interactions, night lighting, wet pavement, engine blast zones, and operational hold lines.

## Implementation Notes

- Start with the official RCooper release and reproduce one baseline before adapting models.
- Preserve the agent abstraction; do not flatten all sensors into one monolithic rig too early.
- Keep per-agent latency, dropped-frame, and calibration-error logs because these are deployment-critical.
- For airside transfer, define a shared airport world frame tied to surveyed stand geometry.
- Add airport classes before retraining: aircraft, tug, belt loader, stairs, container loader, dolly, bus, fuel truck, cone, worker, and FOD candidate.
- Evaluate per-occlusion-zone recall, not only global AP.

## Sources

- CVPR 2024 paper: https://openaccess.thecvf.com/content/CVPR2024/html/Hao_RCooper_A_Real-world_Large-scale_Dataset_for_Roadside_Cooperative_Perception_CVPR_2024_paper.html
- CVPR 2024 PDF: https://openaccess.thecvf.com/content/CVPR2024/papers/Hao_RCooper_A_Real-world_Large-scale_Dataset_for_Roadside_Cooperative_Perception_CVPR_2024_paper.pdf
- Official GitHub: https://github.com/AIR-THU/DAIR-RCooper
- Project page: https://thudair.baai.ac.cn/cooptest/index
