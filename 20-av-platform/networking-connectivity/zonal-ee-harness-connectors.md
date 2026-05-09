# Zonal E/E Harness Connectors

**Last updated:** 2026-05-09

## Why It Matters

Zonal E/E architecture moves wiring decisions from "which domain ECU owns this
function?" to "which physical zone can power, protect, timestamp, and diagnose
this load with the shortest harness?" That matters for autonomous vehicles
because sensors, safety I/O, cleaning systems, thermal loads, high-speed
recorders, and compute all compete for connector space, copper mass, and EMC
margin.

10BASE-T1S makes Ethernet practical for low-bandwidth edge nodes on a
single-pair multidrop segment, while 100BASE-T1, 1000BASE-T1, and higher-speed
links remain the right choices for cameras, LiDAR, zonal uplinks, and compute
backbones. OPEN Alliance TC14 and TC10 specifications make the T1S decision an
automotive implementation and compliance decision, not just a PHY selection.

## Architecture Decisions

| Decision | Practical rule |
|---|---|
| Backbone vs edge bus | Use switched 1000BASE-T1 or faster links between central compute and zonal controllers. Use 10BASE-T1S for local low-rate sensors, switches, lighting, diagnostics, and simple actuators. |
| Connector classes | Use automotive high-speed differential connectors for Ethernet lanes, hybrid power/signal/data connectors for zonal controllers, and sealed connectors for exposed exterior zones. |
| Safety path | Keep brake, E-stop, steering enable, and safe-stop power available through an independent safety controller or safety harness path even when a zone gateway fails. |
| Local protection | Put eFuses or smart high-side switches in each zone so a branch short isolates locally instead of dropping the central autonomy bus. |
| Wake and sleep | Treat OPEN Alliance TC10 sleep/wake and 10BASE-T1S wake behavior as release-controlled configuration. Wake storms are system faults. |
| Serviceability | Key, color-code, and mechanically protect connectors so field replacement cannot swap left/right zones, safety/non-safety ports, or PoDL/non-PoDL branches. |

Harness topology should be versioned as an architecture artifact:

```
Central compute / safety controller
        |
        +-- TSN / high-speed Ethernet backbone
        |
        +-- Front zone controller
        |       +-- 10BASE-T1S edge bus: lights, proximity nodes, diagnostics
        |       +-- 1000BASE-T1 links: front cameras, LiDAR, radar
        |       +-- protected power branches: heaters, washers, sensors
        |
        +-- Rear zone controller
                +-- 10BASE-T1S edge bus: rear I/O, service nodes
                +-- 1000BASE-T1 links: rear sensors
                +-- protected power branches: lamps, actuators, comms
```

Connector selection is part of the safety case. The connector record should
cover impedance, shielding, CPA/secondary locks, ingress rating, mating cycles,
vibration class, temperature range, coding, contact current, crimp tooling,
harness manufacturing controls, and field replacement instructions.

## Evidence Artifacts

- Zonal harness block diagram with every connector, cable length, branch fuse,
  and zone controller port.
- Connector and cable BOM with part numbers, coding keys, seal class, wire
  gauge, temperature rating, and mating-cycle assumptions.
- 10BASE-T1S bus design file: node count, PLCA IDs, segment length, stub
  lengths, termination, EMC components, wake policy, and diagnostics registers.
- Channel compliance reports for T1/T1S links, including return loss, insertion
  loss, common-mode emissions, and crosstalk.
- Power and ground return map showing which loads share shields, chassis ground,
  and safe-stop return paths.
- Harness manufacturing evidence: crimp pull tests, continuity tests, hipot
  where applicable, seal inspection, and automated harness test vectors.
- Vehicle fault-injection results for open circuit, short to battery, short to
  ground, wrong connector, water ingress, and zone controller loss.

## Acceptance Checks

- Each zone can lose one non-safety branch without resetting the zone controller
  or the central compute.
- A mis-mated or missing connector is detected before mission start, not inferred
  later from missing sensor data.
- 10BASE-T1S segments meet node count, PLCA timing, wake, and EMC constraints
  under cold start, hot soak, charger transition, and motor inverter operation.
- High-bandwidth sensors are not placed on multidrop T1S segments; they have
  dedicated point-to-point links or a switched zonal uplink.
- Harness voltage drop remains inside the load budget at worst-case current,
  temperature, and connector aging.
- Connector coding prevents swapping safety-critical and non-safety ports during
  service.
- Field replacement can restore a zone using documented harness assemblies
  without custom pin extraction or undocumented service splices.

## Failure Modes

| Failure mode | Detection | Containment |
|---|---|---|
| Water ingress or seal damage | Insulation trend, link errors, branch leakage, connector inspection | Derate affected zone, isolate branch, require service before wet-ODD operation. |
| Fretting or partial latch | Intermittent link loss, current spikes, vibration-correlated diagnostics | Use CPA/secondary locks, log connector location, stop relying on affected sensor. |
| T1S termination or stub error | PLCA errors, high packet loss, EMC test failure | Block release until bus design and harness build match approved config. |
| Common-mode noise from inverter or heater | Burst link errors, gPTP offset spikes, sensor dropouts | Improve routing, shielding, filtering, grounding, and physical separation. |
| Wrong harness revision installed | Config ID mismatch, missing expected ports, pinout test failure | Refuse mission until BOM, harness, and software configuration align. |
| Zone controller reset | Heartbeat loss, branch status stale, network topology change | Enter degraded ODD or safe stop based on lost coverage and safety function. |
| Wake storm or sleep failure | Unexpected current draw, repeated wake events, TC10 diagnostics | Keep vehicle in service mode, isolate wake source, preserve safe-stop rail. |

## Related Repository Docs

- [Deterministic Real-Time Networking (TSN)](deterministic-networking-tsn.md)
- [Autonomy Power Distribution and Safe-Stop Energy](../power-electrical/autonomy-power-distribution.md)
- [Environmental and EMC Qualification](../ruggedization/environmental-emc-qualification.md)
- [CAN Bus Communication and Drive-by-Wire Interfaces](../drive-by-wire/can-bus-dbw.md)
- [Functional Diagnostics, UDS, DoIP, and SOVD](../diagnostics/functional-diagnostics-uds-doip-sovd.md)
- [Close-Range Proximity Safety Sensors](../sensors/close-range-proximity-safety-sensors.md)

## Sources

- OPEN Alliance, [Automotive Ethernet Specifications](https://opensig.org/Automotive-Ethernet-Specifications/)
- OPEN Alliance TC14, [Interoperability and Compliance Tests for 10BASE-T1S PHYs](https://opensig.org/tech-committee/tc14-interoperability-compliance-tests-for-10base-t1s-phys/)
- OPEN Alliance, [10BASE-T1S System Implementation Specification](https://opensig.org/specification/10base-t1s-system-implementation-specification/)
- Analog Devices, [How 10BASE-T1S Ethernet Simplifies Zonal Architectures in Automotive Applications](https://www.analog.com/en/resources/analog-dialogue/articles/how-10base-t1s-ethernet-simplifies-zonal-architectures.html)
- Molex, [Automotive Zonal Architecture](https://www.molex.com/en-us/industries-applications/automotive-connectivity/zonal-architecture)
- TE Connectivity, [Next Generation E/E Architecture](https://www.te.com/en/products/connectors/automotive-connectors/intersection/next-generation-e-e-zonal-architecture-products.html)
- Rosenberger, [H-MTD High-Speed Modular Twisted-Pair Data](https://www.rosenberger.com/product/h-mtd/)
- IEEE, [IEEE 802.1AS-2025 Timing and Synchronization for Time-Sensitive Applications](https://standards.ieee.org/ieee/802.1AS/11968/)
