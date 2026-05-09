# Real-to-Sim Closed-Loop Benchmarks

**Last updated:** 2026-05-09

## Why It Matters

Closed-loop benchmark value depends on realism. Manually scripted CARLA scenarios are useful for repeatability, but they can diverge from the actual traffic, geometry, lighting, and interaction distributions seen in operations. Real-to-sim benchmarks close that gap by extracting real scenes and turning them into executable closed-loop tests.

DriveE2E demonstrates a practical benchmark pattern: extract dynamic scenarios from infrastructure video, build digital twin assets for real intersections, and evaluate end-to-end agents in CARLA. RealEngine extends the idea with realistic multi-modal rendering, separate reconstruction of background and foreground actors, flexible scene composition, safety testing, and multi-agent interaction. HUGSIM shows the 3D Gaussian Splatting path: lift captured RGB into a photorealistic closed-loop simulator where ego and actors update from control commands.

## Evaluation/Design Pattern

Use a staged real-to-sim pipeline:

1. Mine real logs for triggers: near miss, hard brake, operator intervention, rule conflict, occlusion, abnormal delay, or safety monitor activation.
2. Reconstruct static context: map, lanes/service roads, surfaces, markings, stands, buildings, lighting, and occluders.
3. Reconstruct dynamic actors: trajectories, dimensions, class, intent, and timing.
4. Calibrate sensor realism: camera, LiDAR, radar, latency, exposure, weather, and time synchronization.
5. Convert to executable scenario: CARLA/Isaac/custom simulator plus ASAM OpenSCENARIO-compatible scenario metadata where feasible.
6. Run closed-loop rollouts: baseline, new stack, corruption variants, counterfactual actor timing, and weather/lighting variants.
7. Compare sim-to-real fidelity: perception deltas, trajectory deltas, interaction timing, collision/near-miss reproduction, and scenario oracle stability.

Benchmark dimensions:

| Dimension | Check |
|---|---|
| Sensor fidelity | Camera/LiDAR appearance and geometry match enough for perception testing |
| Closed-loop freedom | Ego can deviate from the recorded route without simulator collapse |
| Actor reactivity | Other actors can be replayed, scripted, or reactive depending on test objective |
| Counterfactual control | Weather, timing, actors, route, and ego behavior can be varied |
| Oracle consistency | Pass/fail criteria remain stable across replay and generated variants |
| Throughput | Scenarios run fast enough for regression and release gates |

## Airside Transfer

Airside is well suited to real-to-sim because many useful sensors are fixed: apron cameras, stand monitoring, A-SMGCS feeds, GSE telematics, V2X, and airport operational databases. A real-to-sim airside benchmark should start with operational events rather than generic driving cases:

| Source Event | Sim Benchmark |
|---|---|
| Stand-entry slow/stop | Aircraft clearance and worker/GSE occlusion replay |
| Baggage route delay | Service-road merge and blocked-lane counterfactuals |
| Pushback coordination | Tug-aircraft sweep path with GSE hold/yield logic |
| FOD report | Small-object detection, persistence, reroute, and false-positive handling |
| Jet blast restriction | Engine-state hazard polygon and timed route closure |
| Stale task update | Wrong stand or clearance context injected into planner/VLM |

Use photorealistic reconstruction for sensor-facing tests and simpler geometry-first simulation for rule, reservation, and traffic-flow tests. The benchmark should preserve airport-specific geometry while keeping scenario metadata portable enough to instantiate at another airport.

## Acceptance Checks

- Every real-to-sim case links to a source log/event, simulator asset version, and scenario ID.
- Static geometry, actor trajectories, timestamps, and coordinate frames are reviewed before use in release gates.
- Sim-to-real fidelity is measured on perception outputs, localization/map alignment, and interaction timing.
- Ego can take alternate valid actions without breaking rendering, collision checking, or actor logic.
- Counterfactual variants are labeled as generated, not confused with observed reality.
- Dynamic actors have explicit behavior mode: replay-only, scripted, reactive, or learned.
- Safety oracles include collision, clearance, rule compliance, fallback, and mission outcome.
- Benchmark reports include failure reproduction rate and improvement/regression versus the source event.

## Failure Modes

| Failure Mode | Example | Control |
|---|---|---|
| Replay-only benchmark | Ego cannot deviate, so closed-loop behavior is not actually tested | Require off-trajectory support and reactive/safe actor policies |
| Visual realism without physics | Sensor stream looks good but collisions, friction, and braking are wrong | Separate fidelity checks for perception and dynamics |
| Unlabeled counterfactuals | Generated variants are treated as observed operational evidence | Provenance labels and evidence-state separation |
| Actor intent mismatch | Replayed GSE ignores ego deviation and creates unrealistic crash | Reactive actor model or replay-only test flag |
| Simulator asset drift | Digital twin no longer matches current stand layout | Map/asset version binding and periodic rescan |
| Overfit to source sites | Stack passes 15 reconstructed intersections/stands but fails elsewhere | Held-out airports, parameterized geometry, and synthetic variants |
| Missing sensor degradation | Real logs are clear but deployment has glare, rain, fog, or dropout | Corruption matrix and adverse-condition variants |
| Throughput bottleneck | Photorealistic sim cannot run enough cases for CI | Tiered benchmark: fast geometry tests plus slower photorealistic gates |

## Related Repository Docs

- [Simulators for Airside](simulators-for-airside.md)
- [Sim-to-Real Transfer for Airside](sim-to-real-transfer-airside.md)
- [Neural Simulation Platforms](neural-simulation-platforms.md)
- [Neural Scene Reconstruction](neural-scene-reconstruction.md)
- [Airport Digital Twins](airport-digital-twins.md)
- [3DGS Digital Twin](3dgs-digital-twin.md)
- [Airside Closed-Loop Planning Benchmark](../planning/airside-closed-loop-planning-benchmark.md)
- [Testing and Validation Methodology](../../60-safety-validation/verification-validation/testing-validation-methodology.md)

## Sources

- RealEngine: Simulating Autonomous Driving in Realistic Context: https://arxiv.org/abs/2505.16902
- DriveE2E: Closed-Loop Benchmark for End-to-End Autonomous Driving through Real-to-Simulation: https://arxiv.org/abs/2509.23922
- HUGSIM: A Real-Time, Photo-Realistic and Closed-Loop Simulator for Autonomous Driving: https://arxiv.org/abs/2412.01718
- HUGSIM project page: https://xdimlab.github.io/hugsim/
- ASAM OpenSCENARIO DSL: https://www.asam.net/standards/detail/openscenario-dsl/
