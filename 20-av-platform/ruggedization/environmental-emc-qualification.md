# Environmental and EMC Qualification for AV Platform Hardware

**Last updated:** 2026-05-09

Autonomy hardware is safety-relevant only if it survives the environment where
the vehicle actually works. A perception stack that is validated on clean lab
power and office-temperature hardware can still fail in service because a sealed
enclosure breathes humid air, a connector frets under vibration, a sensor heater
pulls a rail below its brownout margin, or a motor inverter injects RF noise into
the time-sync and perception harness.

Qualification should be planned as a vehicle-level design verification plan and
report (DVP&R), not as a late compliance checklist. Component datasheets give
starting points; the deployed AV needs a matrix that maps each subsystem to
temperature, humidity, dust, water, vibration, shock, corrosion, chemicals, ESD,
conducted transients, radiated emissions, radiated immunity, and service abuse.

---

## AV, Indoor, Outdoor, and Airside Relevance

| Domain | Environmental problem | Qualification implication |
|---|---|---|
| Generic AV | Compute, sensors, PDU, DBW, and networking must operate under temperature, vibration, water, dust, and electrical transients. | Use ISO 16750 and automotive EMC as the baseline for vehicle-mounted electronics. |
| Indoor warehouse | Washdown, pallet impacts, forklift vibration, concrete expansion joints, reflective glass, and dust are common. | Validate IP rating, impact protection, scanner contamination, and cable strain relief. |
| Outdoor campus and yard | Rain, sun, cold start, mud, salt, charging, radio systems, and long harnesses dominate. | Add UV, corrosion, thermal cycling, EMC, and connector ingress tests. |
| Airside | De-icing fluid, jet blast debris, high RF density, ground power units, apron washdown, and FOD exposure are normal ODD inputs. | Add chemical compatibility, airside contamination, RF coexistence, and post-event inspection criteria. |

---

## Qualification Architecture

```
ODD and site environment
        |
        v
Subsystem exposure map
        |
        +--> Compute enclosure
        +--> Sensor pods and windows
        +--> PDU / DC/DC / battery interface
        +--> DBW ECUs and actuator wiring
        +--> TSN/CAN networking and antennas
        +--> Safety scanners, bumpers, E-stops
        |
        v
Qualification matrix
        |
        +--> Environmental tests
        +--> Mechanical tests
        +--> Ingress and washdown tests
        +--> EMC emissions and immunity
        +--> Electrical transient tests
        +--> Chemical and contamination tests
        |
        v
DVP&R evidence + production controls + service inspection criteria
```

Each row in the qualification matrix should have an owner, test method, severity
level, sample count, pass/fail criteria, instrumentation, recovery procedure,
and link to the safety case. "No visible damage" is not enough. Pass/fail should
include functional behavior: sensor frame quality, timestamp quality, DTCs,
power branch faults, network packet loss, brake/steer command latency, and
post-test calibration drift.

---

## Qualification Matrix

| Stress | Baseline standards or method | AV-specific pass criteria |
|---|---|---|
| Electrical loads | ISO 16750-2, plus vehicle-specific charger and DC/DC events | No unsafe reset; safety rail reserve valid; DTCs capture brownout and recovery. |
| Vibration and shock | ISO 16750-3, site road-load profiles, transport drop tests | No connector fretting, sensor extrinsic shift beyond tolerance, or intermittent power/network faults. |
| Climatic loads | ISO 16750-4, thermal chamber, solar load, cold soak | Boot, mission, safe-stop, logging, and diagnostics work at ODD limits. |
| Ingress protection | ISO 20653 / IEC 60529-derived IP tests, washdown tests | No water/dust ingress that changes electrical safety, sensor quality, or serviceability. |
| ESD | ISO 10605 for modules and vehicle touch points | No unsafe actuation, no lost DTC/event evidence, graceful recovery. |
| Radiated RF immunity | ISO 11452 series at component level; site RF surveys | No perception, timebase, DBW, or safety I/O disruption under expected RF fields. |
| Conducted/radiated emissions | CISPR 25 for onboard receiver protection and vehicle-specific limits | No interference with GNSS, Wi-Fi/5G, V2X, radios, safety scanners, or airport systems. |
| Chemical exposure | De-icing fluids, glycol, fuel residue, hydraulic fluids, washer fluid, cleaning agents | No lens coating damage, seal swelling, cable jacket cracking, or false health recovery. |
| Service abuse | Connector mate cycles, pressure wash angle, technician ESD, battery disconnects | Maintainer actions do not create latent faults; service-mode diagnostics detect misassembly. |

---

## Design Details

### Environmental

### Temperature and Thermal Cycling

Autonomy hardware needs three separate thermal arguments:

1. **Survival:** Storage and transport temperatures do not damage sensors,
   batteries, seals, displays, optics, or compute modules.
2. **Operation:** The vehicle can run at validated ODD temperatures without
   missing latency budgets or losing safety margins.
3. **Transition:** Cold start, hot restart, charger docking, rain after sun load,
   and washdown after operation do not create condensation or rapid-expansion
   seal failures.

Design controls:

- Use heat paths that do not draw contaminated air through compute or sensor
  enclosures unless filters are serviceable and monitored.
- Add dew-point logic for sealed enclosures with vents or desiccant.
- Record enclosure temperature, board temperature, fan/Peltier/heater state,
  and thermal throttling events as diagnostics.
- Validate thermal soak with the real software load, not only with static power
  resistors.

### Ingress and Washdown

Ingress protection is not one number for the whole vehicle. A top-mounted LiDAR,
a lower bumper sensor, a PDU under a deck plate, and a service connector all see
different water and dust exposure.

Design controls:

- Specify IP targets per enclosure and connector, including the "K" variants
  commonly used for road-vehicle high-pressure/high-temperature washdown.
- Avoid horizontal connector faces where water pools.
- Use pressure equalization vents that are compatible with de-icing fluids and
  cleaning chemicals.
- Define service-port caps as safety-relevant parts if a missing cap can expose
  diagnostic or power pins to water.
- Retest ingress after vibration and thermal cycling; seals fail after movement,
  not in a fresh lab assembly.

### Vibration, Shock, and Calibration Drift

AV hardware must pass both electrical continuity and perception-quality checks.
For sensors, vibration can preserve electrical health while invalidating
extrinsics.

Design controls:

- Lock connector families, wire bend radii, clamp spacing, and strain relief into
  the harness drawing.
- Use witness marks, torque recording, and mechanical keying on adjustable
  sensor brackets.
- Run pre/post vibration calibration checks and frame-overlap metrics for LiDAR,
  camera, radar, and safety scanners.
- Include road-load data from the actual vehicle and site: apron slabs, dock
  plates, pallet impacts, speed bumps, and yard potholes are not equivalent.

### Chemical and Contamination Exposure

Airside and industrial AVs see contaminants that automotive highway tests may
not cover directly:

- Aircraft de-icing and anti-icing fluids.
- Fuel residue and hydraulic fluids.
- Rubber dust, brake dust, concrete dust, salt, fertilizer, and mud.
- Cleaning agents, degreasers, and pressure-wash additives.

Design controls:

- Test sensor windows, coatings, wipers, seals, adhesives, cable jackets, labels,
  and breathable vents with representative fluids.
- Define "cleaned and recovered" pass/fail by sensor health metrics, not visual
  appearance.
- Record chemical-exposure assumptions in the ODD and service manual.

---

### EMC

### Emissions

Radiated and conducted emissions matter because AVs carry sensitive receivers:
GNSS, RTK, Wi-Fi/5G, V2X, radios, radar, safety scanners, and time-sync networks.
They may also operate near airport radio, ground power, baggage systems, and
industrial wireless infrastructure.

Design controls:

- Keep inverter, motor, DC/DC, heater, pump, compute, and RF antenna harnesses
  physically separated where possible.
- Use shield termination drawings with exact connector backshell and chassis
  bonding requirements.
- Measure emissions with representative software load: GPU inference, sensor
  streaming, TSN traffic, 5G uplink, heaters, cleaning pumps, and actuator motion.
- Verify that the vehicle does not self-jam GNSS/RTK or degrade timebase
  stability during high-current events.

### Immunity

Immunity tests should include performance monitoring, not just "device did not
reset." Pass/fail examples:

- No unintended brake, steering, drive, lift, or cleaning actuation.
- Safety outputs remain in the correct state or go safe.
- gPTP offset and packet-loss metrics remain inside the timing budget or produce
  a clear DTC.
- Perception health either remains valid or degrades into a documented fallback.
- Event logs preserve the disturbance timestamp and recovery path.

### ESD and Service Interfaces

External connectors, service tablets, E-stop devices, charging contacts, doors,
and sensor cleaning interfaces are common ESD paths. Service procedures should
include:

- Protected connector pinout and shrouding.
- ESD handling rules for replaceable sensor heads and storage media.
- Diagnostic proof that a replaced module has correct configuration and
  calibration before release.

---

## Deployment Notes

1. Start with a site exposure survey: temperatures, washdown methods, chemicals,
   floor/road roughness, RF systems, charger types, maintenance practices, and
   shift length.
2. Build a per-subsystem qualification matrix. Do not apply the same severity to
   a roof sensor, underbody PDU, and cabin service display.
3. Run pre-compliance EMC early, before harness routing and enclosure bonding
   are frozen.
4. Include powered operation during environmental tests. Many faults occur only
   under traffic, inference load, heater cycles, or actuator motion.
5. Validate diagnostics during stress. A rugged component that fails silently is
   not acceptable for AV deployment.
6. Define post-event inspection triggers: flood exposure, jet blast debris hit,
   chemical spill, dropped sensor, hard curb strike, charger arc, or repeated
   overcurrent.
7. Preserve all qualification deviations and waivers as safety-case evidence.

---

## Failure Modes

| Failure mode | Detection | Mitigation |
|---|---|---|
| Condensation inside compute enclosure | Humidity sensor, board temperature crossing dew point, corrosion inspection | Vent/desiccant redesign, controlled warm-up, sealed heat path. |
| Water ingress through service connector | IP test failure, corrosion, intermittent diagnostic link | Better cap/keying, connector relocation, service inspection gate. |
| Vibration-induced sensor shift | Pre/post calibration residuals, cross-sensor inconsistency | Bracket redesign, torque control, calibration-required DTC. |
| Connector fretting | Intermittent resets, packet loss, branch current spikes | Automotive/industrial connector upgrade, harness clamp changes. |
| Radiated immunity upset | RF test causes timebase drift, packet loss, false detection, ECU reset | Shielding, filtering, bonding, watchdog and DTC improvements. |
| Conducted transient resets safety-adjacent ECU | ISO 16750-2 style pulse test, brownout logs | DC/DC filtering, hold-up, reset sequencing, safer load shedding. |
| Chemical swelling or coating damage | Post-exposure lens health loss, seal dimensional change | Material substitution, sensor cover redesign, cleaning procedure update. |
| Jet blast debris impact | Sensor health drop, cracked cover, bracket witness mark | Shielding, sacrificial cover, route/geofence rule, inspection trigger. |
| Washdown pushes water past seals after vibration | Sequential vibration plus IP failure | Retest after mechanical stress; redesign gasket compression. |

---

## Related Repository Documents

- [Autonomy Power Distribution and Safe-Stop Energy](../power-electrical/autonomy-power-distribution.md)
- [Automated Sensor Cleaning and Physical Self-Maintenance](../sensors/automated-sensor-cleaning.md)
- [Sensor Degradation Detection and Health Monitoring](../sensors/sensor-degradation-health-monitoring.md)
- [Close-Range Proximity and Safety Sensors](../sensors/close-range-proximity-safety-sensors.md)
- [Deterministic Real-Time Networking (TSN)](../networking-connectivity/deterministic-networking-tsn.md)
- [Airside Adverse Conditions](../../60-safety-validation/verification-validation/robustness/airside-adverse-conditions.md)
- [FOD and Jet Blast](../../70-operations-domains/airside/operations/fod-and-jetblast.md)
- [Ground Crew and Pedestrian Safety](../../70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md)
- [Functional Safety Software](../../60-safety-validation/standards-certification/functional-safety-software.md)

---

## Sources

- ISO, [ISO 16750-2:2023 Electrical loads](https://www.iso.org/standard/76119.html)
- ISO, [ISO 16750-3:2023 Mechanical loads](https://www.iso.org/standard/77579.html)
- ISO, [ISO 16750-4:2023 Climatic loads](https://www.iso.org/standard/77580.html)
- ISO, [ISO 20653:2023 Road vehicles - IP code for electrical equipment](https://www.iso.org/standard/76116.html)
- ISO, [ISO 10605:2023 Road vehicles - Electrostatic discharge test methods](https://www.iso.org/standard/79094.html)
- ISO, [ISO 11452-1:2025 Component test methods for radiated electromagnetic immunity](https://www.iso.org/standard/83225.html)
- IEC, [CISPR 25:2021 Vehicle radio disturbance characteristics](https://webstore.iec.ch/en/publication/64645)
- FAA, [AC 150/5300-14D Design of Aircraft Deicing Facilities](https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5300-14)
