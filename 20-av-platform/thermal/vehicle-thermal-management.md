# Vehicle Thermal Management

**Last updated:** 2026-05-09

## Why It Matters

Thermal management is an autonomy availability and safety issue, not a comfort
feature. Compute throttling changes perception latency, hot SSDs drop write
performance, cold sensors drift or fog, LiDAR windows ice over, and sealed
electronics can fail from condensation after washdown or de-icing exposure.

AV platforms should treat heat as a first-class resource alongside power,
network bandwidth, and compute. The thermal system needs a budget, sensors,
derating ladder, service procedure, and evidence that worst-case ODD conditions
do not silently invalidate timing, recording, or perception assumptions.

## Architecture Decisions

| Decision | Practical rule |
|---|---|
| Thermal zoning | Separate compute/recorder cooling, sensor-window conditioning, battery/HV cooling, cabin/service electronics, and environmental enclosure control. |
| Cooling method | Use passive or fanless conduction for low-power sealed controllers, forced air only where filtered service access is acceptable, and liquid cooling for dense GPU/recorder loads. |
| Derating | Tie thermal state to ODD restrictions: reduce model rate, disable nonessential logging, shed heaters, reduce speed, or safe stop before watchdog budgets are violated. |
| Condensation | Monitor humidity and dew point inside sealed enclosures; use venting, heaters, conformal coating, drains, and warm-up rules where required. |
| Sensor windows | Heat and clean optical surfaces based on visibility need, not a static timer. Thermal camera, visible camera, LiDAR, and radar covers have different failure signatures. |
| Storage | Keep NVMe drives inside a temperature and airflow/liquid-cooling envelope that preserves sustained write during event capture. |
| Service | Make coolant, fan, filter, pump, and heat-spreader maintenance visible in diagnostics and fleet scheduling. |

Thermal control should publish a typed state used by autonomy and fleet
operations:

```
NORMAL -> WATCH -> DERATED -> SAFE_STOP -> SERVICE_REQUIRED

Inputs:
SoC temp, GPU clocks, SSD temp, coolant inlet/outlet, pump tach,
fan tach, enclosure humidity, branch current, sensor-window temp,
ambient temp, solar load estimate, and heater state.
```

## Evidence Artifacts

- Thermal budget for every heat source: compute, network switches, recorders,
  sensors, heaters, pumps, DC/DC converters, chargers, and sealed enclosures.
- Cooling architecture drawing with heat paths, cold plates, TIM stackups,
  airflow, coolant lines, pumps, radiators, filters, drains, and leak sensors.
- Hot-soak and cold-start test reports for the full mission profile, including
  idle, low-speed operation, charging, logging burst, and sensor cleaning.
- SoC, GPU, DLA, SSD, and network-switch telemetry traces under maximum
  perception, planning, and recording load.
- Derating ladder validation proving warnings occur before throttling breaks
  control or logging latency budgets.
- Condensation and washdown test evidence for sealed compute and sensor
  enclosures.
- Maintenance evidence: filter interval, coolant service interval, pump/fan
  lifetime, and leak-detection response.

## Acceptance Checks

- Worst-case ODD thermal profile runs without uncontrolled compute throttling or
  recorder write collapse.
- Any thermal derate produces an explicit autonomy state change and fleet alert.
- Safe-stop timing remains valid during hot soak, cold start, and power-limited
  operation.
- Sensor-window heaters can clear expected fog, frost, ice, or water film within
  the approved ODD startup time.
- A pump, fan, or coolant-flow fault is detected before temperatures exceed the
  approved operating envelope.
- Condensation inside sealed electronics is either prevented or detected before
  power-up into a high-risk state.
- Thermal service tasks are tied to logged counters, not only calendar time.

## Failure Modes

| Failure mode | Detection | Safe response |
|---|---|---|
| Compute thermal throttling | SoC temp, clock-rate drop, over-current or TDP throttle flag | Reduce nonessential workloads and speed; safe stop if timing budget is at risk. |
| SSD write cliff | Drive temp, SMART data, write latency, recorder queue growth | Reduce bulk logging, preserve DSSAD/event stream, alert fleet. |
| Pump or coolant failure | Flow sensor, pump tach, inlet/outlet delta, leak sensor | Derate compute, stop mission if cooling reserve is insufficient. |
| Fan or filter blockage | Fan tach, pressure/airflow proxy, rising enclosure temp | Shed load, schedule service, avoid dusty/wet ODD if coverage depends on it. |
| Condensation | Humidity/dew point, enclosure temp crossing, leakage current | Delay startup, warm enclosure, block mission if safety electronics are affected. |
| Sensor heater stuck on | Branch current high, local temperature high | Isolate heater, restrict adverse-weather ODD, inspect window and branch wiring. |
| Sensor heater stuck off | Window temp low, perception quality degradation, current low | Restrict fog/ice/rain ODD and route to service. |
| Solar load underestimation | Ambient/enclosure divergence, repeated derates during idle | Update ODD thermal model and add shielding or cooling margin. |

## Related Repository Docs

- [NVIDIA Orin Technical](../compute/nvidia-orin-technical.md)
- [Energy-Efficient Inference for 24/7 Airport GSE Fleet Operations](../compute/energy-efficient-inference-24-7.md)
- [Autonomy Power Distribution and Safe-Stop Energy](../power-electrical/autonomy-power-distribution.md)
- [Environmental and EMC Qualification](../ruggedization/environmental-emc-qualification.md)
- [Thermal IR Cameras](../sensors/thermal-ir-cameras.md)
- [Automated Sensor Cleaning and Physical Self-Maintenance](../sensors/automated-sensor-cleaning.md)
- [On-Vehicle Data Triage and Selective Upload Prioritization](../../40-runtime-systems/data-logging/on-vehicle-data-triage-selective-upload.md)
- [Weather-Adaptive ODD Management](../../60-safety-validation/runtime-assurance/weather-adaptive-odd-management.md)

## Sources

- NVIDIA Jetson Linux Developer Guide, [Jetson Orin NX Series and Jetson AGX Orin Series Power and Performance](https://docs.nvidia.com/jetson/archives/r35.1/DeveloperGuide/text/SD/PlatformPowerAndPerformance/JetsonOrinNxSeriesAndJetsonAgxOrinSeries.html)
- NVIDIA, [Jetson AGX Orin for Next-Gen Robotics](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-agx-orin/)
- Eurotech, [DynaCOR 40-35 Rugged High Performance Data Logger](https://www.eurotech.com/products/dynacor-40-35/)
- Eurotech, [ADAS Edge Hardware Portfolio](https://www.eurotech.com/adas/)
- Eurotech, [DynaCOR 61-10 ADAS/HIL Logger Edition](https://www.eurotech.com/products/dynacor-61-10-adas-hil-logger-edition/)
- OnLogic, [Karbon 802 Spec Sheet](https://static.onlogic.com/resources/spec-sheets/OnLogic-K802-Spec-Sheet-V3.pdf)
- ISO, [ISO 16750-4 Road vehicles - Environmental conditions and testing - Climatic loads](https://www.iso.org/standard/71580.html)
- IEC, [IEC 60068 Environmental testing](https://www.iec.ch/ords/f?p=103:23:0::::FSP_ORG_ID,FSP_LANG_ID:1244,25)
