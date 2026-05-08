# CoInfra

## What It Is

CoInfra is a large-scale cooperative infrastructure perception system and dataset.

It focuses on infrastructure-to-infrastructure and vehicle-to-infrastructure perception with real roadside nodes.

The system uses multiple synchronized sensing stations connected through a commercial 5G network.

The dataset includes adverse-weather operation, including rain, heavy snow, and freezing rain.

It is both a system paper and a dataset-backed benchmark.

## Core Technical Idea

CoInfra treats roadside infrastructure as a cooperative perception platform.

Each node collects local LiDAR and camera data, performs edge processing, and exchanges information through networked infrastructure.

The core idea is not just feature fusion; it is a deployable cooperative infrastructure stack:

- Synchronized sensor nodes.
- Edge compute at the roadside.
- 5G data movement.
- HD-map anchoring.
- Global 3D annotation.
- Remote monitoring and operation.

The paper argues that vehicle-only perception can have low visibility in critical frames, while cooperative infrastructure can recover more complete scene coverage.

## Inputs and Outputs

Inputs:

- Roadside LiDAR point clouds.
- Roadside RGB camera images.
- Vehicle-side sensor data for the V2I subset.
- HD map information.
- Sensor extrinsics and global coordinate transforms.
- Network and synchronization metadata.
- Weather and scene condition labels.

Outputs:

- Global 3D object detections.
- Cooperative infrastructure perception results.
- Vehicle-infrastructure perception results.
- Dataset splits for I2I and V2I evaluation.

The annotated classes are road-user classes, not airside operational classes.

## Architecture or Benchmark Protocol

CoInfra has two main benchmark modes.

I2I mode:

- Multiple infrastructure nodes around the same traffic area cooperate.
- The focus is on global roadside perception under weather and occlusion.

V2I mode:

- An ego vehicle cooperates with infrastructure nodes.
- The focus is whether infrastructure improves the vehicle's critical-frame observability.

The reported system includes 14 synchronized infrastructure nodes and an 8-node roundabout subset for the released I2I dataset.

The arXiv v3 abstract reports about 294k LiDAR samples, 589k camera images, and 332k annotated 3D boxes for I2I, plus a V2I subset with about 46k LiDAR samples, 92k images, and 43k annotated boxes.

## Training and Evaluation

Training can use single-node, multi-node, or vehicle-infrastructure inputs depending on the task.

Evaluation emphasizes:

- 3D detection quality.
- Critical-frame completeness.
- Performance under adverse weather.
- Cooperation benefit over vehicle-only or infrastructure-only perception.
- Robustness to realistic networked deployment constraints.

The paper reports that V2I cooperation can raise critical-frame completeness substantially over vehicle-only perception.

## Strengths

- Real deployed infrastructure, not only a curated perception dataset.
- Includes adverse weather, a key gap in many cooperative perception benchmarks.
- Combines sensing, networking, edge compute, and mapping concerns.
- Contains both I2I and V2I settings.
- Commercial 5G operation makes communication constraints more realistic.
- Useful for studying infrastructure perception as a production system.

## Failure Modes

- Roundabout and road-intersection geometry may not transfer cleanly to airport aprons.
- 5G availability and QoS assumptions may differ on secure airport networks.
- Weather improves coverage realism but does not cover jet blast, glare from floodlights, or wet-apron reflections around aircraft.
- Global labels depend on calibration and multi-sensor annotation quality.
- Cooperative benefit may be overstated if infrastructure nodes have unusually good coverage compared with a constrained airport stand.
- Public-road class labels do not cover GSE or aircraft.

## Airside AV Fit

CoInfra is one of the best matches for airside infrastructure perception.

Airports are private, map-rich, and can justify fixed sensors around high-value conflict zones.

The adverse-weather emphasis is directly relevant to airport operations.

Airside transfer targets:

- Stand-level cooperative perception.
- Apron service-road conflict monitoring.
- Pushback lane observability.
- Snow, rain, and low-visibility ground movement support.
- Infrastructure assistance for low-speed autonomous baggage or cargo tractors.

An airside adaptation should measure critical-frame completeness around aircraft and equipment, not just road-user AP.

## Implementation Notes

- Keep network metadata in the data model; do not evaluate perception without latency and packet-loss context.
- Use surveyed airport coordinates and an HD apron map as the global frame.
- Mirror the I2I and V2I split: infrastructure-only stand perception first, then vehicle-infrastructure cooperation.
- Add airport-specific weather and lighting tags: night floodlights, rain glare, snow banks, deicing mist, and low sun.
- Track blind-zone recovery around aircraft fuselage and jet bridge occlusions.
- Validate whether private 5G, Wi-Fi 6/7, or wired backhaul is the right communication layer for each stand.

## Sources

- arXiv paper: https://arxiv.org/abs/2403.10145
- Official GitHub: https://github.com/NingMingHao/CoInfra
- arXiv PDF: https://arxiv.org/pdf/2403.10145
