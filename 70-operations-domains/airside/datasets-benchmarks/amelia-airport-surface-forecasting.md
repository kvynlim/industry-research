# Amelia Airport Surface Forecasting

**Last updated:** 2026-05-09

Amelia is a CMU dataset, toolkit, and forecasting benchmark for airport surface movement. It is the most directly airside-relevant dataset in this batch because it uses FAA SWIM/SMES surface movement reports, airport geofences, and semantic routing graphs rather than road-vehicle perception data.

**Related pages:** [aircraft turnaround prediction](../operations/turnaround-prediction.md), [airport data integration](../operations/airport-data-integration.md), [fleet task allocation and scheduling](../../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md)

---

## Scope

| Item | Amelia coverage |
|---|---|
| Primary domain | Airport surface movement forecasting |
| Raw dataset | Amelia-42, more than two years of SWIM/SMES data across 42 US airports and TRACON facilities |
| Raw scale | About 9.19 TB of raw data in the current project description |
| Processed sample | Amelia42-Mini, 15 processed days per airport |
| Benchmark subset | Amelia10-Bench, one month of trajectory data for each of 10 airports |
| Model baseline | Amelia-TF, transformer-based multi-agent multi-airport trajectory forecasting |

The dataset is for operational movement, not onboard perception. Its strength is topology, traffic interaction, and multi-airport generalization.

---

## Data And Labels

| Asset | Notes |
|---|---|
| Raw source | FAA System Wide Information Management Surface Movement Event Service reports |
| Geofences | Airport-specific movement-area and runway-extension limits |
| Trajectory data | Clean tabular 1 Hz position reports after processing |
| Map assets | OpenStreetMap-derived airport maps and extents |
| Semantic graphs | Vectorized airport routing graphs with semantic attributes |
| Processed files | Hourly airport CSVs under processed trajectory folders |
| Tools | Amelia SWIM, Maps, DataTools, Scenes, TF, and Inference repositories are linked from the project site |

The processed release gives a practical structure for training trajectory models and graph-aware predictors without rebuilding the whole raw SWIM ingestion stack.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Multi-agent trajectory forecasting | ADE/FDE over prediction horizons and airport splits |
| Topology-aware forecasting | Off-graph distance, route-compliance error, wrong-turn rate |
| Conflict and anomaly detection | Missed conflict rate, false alarm rate, time-to-alert |
| Taxi-out and flow prediction | Error in taxi-out time, queue delay, and route progression |
| Airport transfer | Seen-airport versus unseen-airport degradation |

For autonomous GSE, add metrics that are not standard aircraft forecasting metrics: stand-zone conflict probability, service-road occupancy, crossing arrival time, and no-go-zone incursion prediction.

---

## Best Use

Use Amelia to:

- build prior forecasts for aircraft and surface vehicle movement;
- train and evaluate multi-agent prediction on real airport topology;
- test airport-to-airport generalization;
- generate operational context for autonomous GSE dispatch and routing;
- mine unusual movement patterns for scenario libraries.

Amelia should sit upstream of vehicle autonomy: it can forecast where aircraft and tracked surface actors are likely to move, while onboard perception handles local obstacle and personnel safety.

---

## Airside Transfer

The transfer is direct for airport surface operations:

- semantic graphs map naturally to service roads, taxiways, runways, and stand access routes;
- multi-agent forecasting supports tug, baggage tractor, and inspection vehicle risk assessment;
- topology-conditioned prediction helps detect route deviations and possible incursions;
- multi-airport splits match the deployment problem of adapting to a new airport layout.

For a ground-vehicle stack, Amelia should be fused with local perception logs, AODB/A-CDM milestones, stand assignments, NOTAM/closure state, and GSE telematics. SWIM trajectories do not replace onboard sensing.

---

## Limitations

- It is trajectory and operations data, not camera/LiDAR/radar perception data.
- SWIM/SMES coverage and accuracy depend on surveillance infrastructure and reporting behavior.
- Ground support equipment that is not visible in the source feeds may be missing.
- Forecasting metrics can look good while rare safety-critical anomalies remain underrepresented.
- Current public subsets are processed samples; full raw ingestion requires more storage and tooling.

---

## Sources

- [Amelia project page](https://ameliacmu.github.io/)
- [Amelia-42 dataset page](https://ameliacmu.github.io/amelia-dataset/)
- [Amelia arXiv paper](https://arxiv.org/abs/2407.21185)
- [Amelia42-Mini on Hugging Face](https://huggingface.co/datasets/AmeliaCMU/Amelia42-Mini)
- [Amelia10-Bench on Hugging Face](https://huggingface.co/datasets/AmeliaCMU/Amelia10-Bench)
