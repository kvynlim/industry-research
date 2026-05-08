# Autonomy Power Distribution and Safe-Stop Energy

**Last updated:** 2026-05-09

Autonomous vehicles need a power architecture that treats perception, compute,
drive-by-wire, diagnostics, cleaning, and safety I/O as controlled loads rather
than accessories hung from a generic auxiliary bus. The power system must keep
the safety controller, braking path, time source, event logger, communications
link, and the minimum sensor set alive long enough to reach a controlled stop
when the traction battery, charger interface, DC/DC converter, harness branch,
or high-current load misbehaves.

The practical target is a zonal, observable low-voltage distribution network:
a high-voltage or traction source feeds isolated DC/DC conversion, a 48 V or
24 V autonomy backbone feeds local 12 V/24 V zones, and every safety-relevant
branch is protected by resettable solid-state switching with current telemetry.
Melting fuses are still useful for hard backup protection, but the autonomy
control path needs electronic isolation, fault memory, remote reset policy, and
deterministic load shedding.

---

## AV, Indoor, Outdoor, and Airside Relevance

| Domain | Power distribution concern | Design implication |
|---|---|---|
| Generic AV | Perception and planning can fail unsafe if compute brownouts are partial or silent. | Separate safety-stop energy from high-performance compute energy; instrument every critical branch. |
| Indoor warehouse | Driverless trucks and AMRs transition between opportunity charging, high current lift loads, doors, and people-rich aisles. | Ride through charger contact bounce and lift/mast transients; keep safety scanners and the safety PLC alive during brownouts. |
| Outdoor campus and yard | Rain, dust, heat, cold starts, GNSS/communications loads, and long cable runs stress low-voltage rails. | Use sealed zonal PDUs, local point-of-load conversion, surge protection, and branch current trending. |
| Airside | De-icing, jet blast, washdown, ground crew proximity, and long shifts make power faults operationally likely. | Keep brake, E-stop, timebase, event recorder, lights, and minimum near-field sensing powered through safe stop and incident capture. |

---

## Architecture

### Power Tree

```
Traction battery / charger inlet
        |
        v
HV contactors + precharge + isolation monitoring
        |
        v
Primary DC/DC conversion
        |
        +--> 48 V autonomy backbone
        |        |
        |        +--> Zone PDU front: LiDAR, cameras, radar, heaters, scanner
        |        +--> Zone PDU rear: sensors, lights, cleaning, comms
        |        +--> Compute PDU: Orin/HPC, storage, Ethernet switches
        |
        +--> 24 V / 12 V legacy bus
        |        |
        |        +--> CAN ECUs, relays, lighting, service tools
        |
        +--> Safe-stop energy rail
                 |
                 +--> Safety MCU / safety PLC
                 +--> Brake release/actuation path
                 +--> E-stop and contactor control
                 +--> Event logger + trusted clock holdover
                 +--> Minimal comms beacon
```

The safe-stop rail should not depend on the high-performance compute PDU. It can
be fed through ideal-diode ORing from the DC/DC output and a small auxiliary
battery or supercapacitor pack. Its load list is intentionally short: the safety
controller, the brake or safe-torque-off chain, time/event recording, and enough
communications or visual signaling to support recovery.

### Load Criticality

| Load group | Typical rail | Criticality | Power policy |
|---|---:|---|---|
| Safety MCU / safety PLC, E-stop, contactors | 12 V/24 V safe rail | Safety-critical | Always powered in mission; hold up through safe stop. |
| Brake controller, steering controller, drive inverter control power | 12 V/24 V | Safety-critical or mission-critical | Powered until stopped; torque-producing energy removed only by controlled sequence. |
| Time source, event recorder, diagnostic gateway | 12 V/24 V safe rail | Safety evidence | Hold up after stop to preserve event context. |
| TSN switch, CAN gateway, safety sensors | 12 V/24 V or PoE-like local rails | Mission-critical | Keep minimum coverage until stopped; shed nonessential ports first. |
| Autonomy compute, GPU, high-speed storage | 12 V/19 V/48 V | Mission-critical | Graceful brownout handling; shut down before corrupting logs or models. |
| LiDAR, radar, cameras, thermal, cleaning and heaters | 12 V/24 V/48 V zones | ODD-dependent | Shed by coverage and weather priority; heaters may outrank nonessential cameras in winter. |
| Telemetry, 5G/Wi-Fi, service modem | 12 V | Operational | Keep minimal emergency beacon; shed high-bandwidth modem modes. |
| Comfort, convenience, depot accessories | 12 V/24 V | Noncritical | First shed during undervoltage or thermal overload. |

### Zonal Protected Distribution

Use a protected power-distribution unit per vehicle zone instead of one large
central fuse box when sensor and actuator loads are distributed across the
vehicle. Each protected output should provide:

- Configured current limit matched to the wire gauge, connector, and load inrush.
- Fast short-circuit isolation, with upstream fuse coordination.
- Current measurement for load trending, stuck-on detection, and health models.
- Open-load and short-to-battery/ground diagnostics where the switch supports it.
- A reset policy: latch off for safety paths; controlled retry for nuisance-prone
  noncritical loads; remote reset only after diagnostic preconditions pass.
- A versioned configuration artifact tied to the vehicle BOM, harness revision,
  software release, and safety case.

Modern automotive eFuse and smart high-side switch families are useful because
they combine solid-state switching, I2t-style wire protection, configurable
overcurrent thresholds, soft-start, thermal protection, and diagnostic feedback.
They do not remove the need for wiring protection analysis; they make the branch
observable and software-governed.

### Ride-Through and Hold-Up

Safe-stop hold-up should be allocated explicitly, not discovered during testing.
For each load in the safe-stop rail:

```
required_energy_Wh = load_power_W * required_time_s / (3600 * usable_efficiency)
```

Example safe-stop budget:

| Load | Power | Required time | Energy before margin |
|---|---:|---:|---:|
| Safety MCU / safety PLC + I/O | 12 W | 180 s | 0.60 Wh |
| Brake controller control power | 20 W | 120 s | 0.67 Wh |
| TSN/CAN gateway and one safety scanner | 18 W | 120 s | 0.60 Wh |
| Event logger + clock holdover | 8 W | 300 s | 0.67 Wh |
| Minimal comms and warning lamps | 15 W | 180 s | 0.75 Wh |
| **Subtotal** | | | **3.29 Wh** |

With converter losses, cold-temperature derating, cell aging, and validation
margin, a 10 Wh to 25 Wh auxiliary energy store is often more realistic than
the arithmetic subtotal. The exact value is vehicle-specific: a tug with an
electrohydraulic brake release path needs a different margin than a small AMR
with spring-applied brakes.

### Load-Shedding Ladder

| Stage | Trigger | Automatic action | Vehicle behavior |
|---|---|---|---|
| Normal | Rails within limits | All mission loads available. | Full ODD. |
| Watch | Rail sag, branch current trend, DC/DC thermal derate | Warn, freeze nonessential power-mode changes, raise log rate. | Continue if safety margins remain. |
| Degraded | Repeated brownout, one zone PDU fault, low safe-stop reserve | Shed noncritical loads: spare cameras, cleaning pumps, high-bandwidth logging, comfort loads. | Reduce speed and restrict ODD. |
| Safe-stop | Safety rail undervoltage risk, brake/steer power fault, DC/DC loss | Preserve safety rail; command controlled stop; disable new missions. | Stop in place or nearest safe refuge. |
| Post-stop evidence | Vehicle stopped or E-stop active | Keep event recorder, time source, diagnostics, and minimal comms powered. | Await service or remote triage. |

The autonomy stack should receive a typed power-state message, not infer power
health from missing sensor frames. A degraded power state is a first-class ODD
constraint.

---

## Design Details

### Rail Policy

- **48 V backbone:** Useful for high-current sensors, compute, heaters, and long
  harness runs because lower current reduces copper mass and voltage drop.
- **24 V industrial rail:** Common for safety scanners, PLC I/O, relays, valves,
  and industrial sensors in warehouse and airside machines.
- **12 V legacy rail:** Common for automotive ECUs, lighting, service tools, and
  low-cost accessories.
- **Point-of-load conversion:** Place conversion near compute and sensors with
  telemetry, enable pins, and thermal derating visible to diagnostics.
- **Safe-stop rail:** Kept electrically and logically separate from best-effort
  autonomy loads; test it as a safety function.

### Charger and Battery Transitions

Opportunity charging introduces contactor sequencing, precharge, ground faults,
charger negotiation delays, and transient brownouts. The power manager should
model these as explicit states:

1. **Approach charger:** Restrict high-current nonessential loads and warm up
   diagnostics for charger handshake capture.
2. **Docked and precharge:** Freeze OTA writes unless hold-up is sufficient.
3. **Charging active:** Allow compute throttling, sensor standby, and thermal
   soak monitoring.
4. **Undock:** Confirm DC/DC rails, safety rail reserve, timebase, and PDU
   branch health before accepting a mission.
5. **Faulted charger session:** Preserve safe-stop rail and record the charging
   fault as a diagnosable event, not just a fleet dispatch failure.

### Grounding, Isolation, and EMC

Power architecture and EMC are coupled. Long sensor harnesses, DC/DC converters,
motor inverters, cleaning pumps, and heaters create conducted and radiated noise
that can look like sensor or network faults. Design rules:

- Separate HV, traction inverter, auxiliary power, safety I/O, and sensor network
  harnesses physically where possible.
- Use star or zonal grounding deliberately; avoid accidental high-current returns
  through sensor shields.
- Keep safety rail return paths documented and tested under single-point faults.
- Validate load dump, cranking-like sags, reverse polarity, conducted transients,
  ESD, and RF immunity at the branch level and at the vehicle level.
- Treat shield termination choices as configuration items in the qualification
  package, not build-shop folklore.

### Telemetry Schema

Minimum power telemetry for every critical branch:

| Field | Why it matters |
|---|---|
| `rail_voltage_v` | Detect sag, DC/DC derate, wiring drop, charger transitions. |
| `branch_current_a` | Estimate load health, detect blocked heaters/fans/pumps, size fuses. |
| `switch_state` | Distinguish commanded off, protection off, and hardware fault. |
| `fault_reason` | Preserve overcurrent, overtemperature, open-load, short-to-ground, short-to-battery. |
| `reset_counter` | Find flapping loads and bad connectors. |
| `safe_stop_reserve_wh` | Make fallback decisions explicit. |
| `config_id` | Tie behavior to the approved PDU configuration and safety case. |

---

## Deployment Notes

1. Build a measured power inventory before freezing the PDU design. Capture cold
   start, hot restart, sensor warmup, heater operation, cleaning pump startup,
   charger dock/undock, and emergency stop.
2. Validate worst-case safe-stop with the traction source disabled, not only with
   a bench supply. Include cold-soaked auxiliary storage and aged capacity.
3. Run branch fault injection: short to ground, open load, stuck-on load, brownout,
   noisy current sense, and failed PDU communication.
4. Treat PDU configuration as release-controlled software. A current-limit change
   can invalidate wire protection and functional-safety assumptions.
5. Define remote reset rules. Operators may reset noncritical loads after the
   vehicle is stopped and diagnostics indicate the branch is safe; safety-critical
   branches should require local inspection or a formal service mode.
6. Keep post-stop evidence power available long enough to upload or preserve the
   event bundle: power faults are exactly when logs tend to be lost.

---

## Failure Modes

| Failure mode | Detection | Safe response |
|---|---|---|
| Primary DC/DC converter loss | Rail undervoltage, DC/DC heartbeat loss, PDU brownout flags | Enter safe-stop on reserve rail; shed compute and nonessential sensors. |
| Single branch short | eFuse/high-side overcurrent and thermal flags | Isolate branch; continue only if coverage and safety case allow. |
| Safety rail reserve depleted | Coulomb count, voltage under load, auxiliary pack health | Refuse mission; route to depot or hold stopped. |
| Compute brownout without safety fault | Orin reset counter, storage error, missing heartbeat | Safety controller stops vehicle; diagnostics records brownout root cause. |
| Heater or cleaning pump stuck on | Branch current high while commanded off; thermal rise | Disable branch, restrict adverse-weather ODD, schedule maintenance. |
| PDU communication loss | Missing status frames, stale branch telemetry | Freeze last safe command, avoid remote resets, transition based on local safety logic. |
| Charger transition transient | Voltage sag during dock/undock, isolation/precharge fault | Hold mission start; keep event recorder and diagnostic gateway online. |
| Ground fault or insulation degradation | Isolation monitor, leakage current trend | Stop or refuse charge/mission depending on HV safety policy. |
| Misconfigured current limit | PDU config mismatch, nuisance trips, harness overheating risk | Block release if config ID does not match approved harness/BOM. |

---

## Related Repository Documents

- [Energy-Efficient Inference for 24/7 Airport GSE Fleet Operations](../compute/energy-efficient-inference-24-7.md)
- [NVIDIA Orin Technical](../compute/nvidia-orin-technical.md)
- [CAN Bus Communication and Drive-by-Wire Interfaces](../drive-by-wire/can-bus-dbw.md)
- [Deterministic Real-Time Networking (TSN)](../networking-connectivity/deterministic-networking-tsn.md)
- [Automated Sensor Cleaning and Physical Self-Maintenance](../sensors/automated-sensor-cleaning.md)
- [Battery Charging Infrastructure](../../70-operations-domains/airside/operations/battery-charging-infrastructure.md)
- [Fail-Operational Architecture](../../60-safety-validation/runtime-assurance/fail-operational-architecture.md)
- [Failure Modes Analysis](../../60-safety-validation/safety-case/failure-modes-analysis.md)

---

## Sources

- Infineon, [eFuse and PROFET Wire Guard automotive power distribution](https://www.infineon.com/products/power/smart-power-switches/efuses)
- Infineon, [High-side switches for automotive, commercial, construction, and agricultural vehicles](https://www.infineon.com/products/power/smart-power-switches/high-side-switches)
- Vicor, [Future-Proof Advanced EVs by Adopting 48V Zonal Architectures](https://www.vicorpower.com/resource-library/articles/automotive/future-proof-advanced-evs)
- ISO, [ISO 16750-2:2023 Road vehicles - Environmental conditions and testing - Electrical loads](https://www.iso.org/standard/76119.html)
- ISO, [ISO 6469-3:2021 Electrically propelled road vehicles - Electrical safety](https://www.iso.org/standard/81746.html)
- ISO, [ISO/SAE 21434:2021 Road vehicles - Cybersecurity engineering](https://www.iso.org/standard/70918.html)
- ISO, [ISO 26262-1:2018 Road vehicles - Functional safety vocabulary](https://www.iso.org/standard/68383.html)
