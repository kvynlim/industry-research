# Close-Range Proximity and Safety Sensors for Low-Speed AVs

**Last updated:** 2026-05-09

Low-speed autonomy still needs a safety-rated near-field layer. Long-range
LiDAR, cameras, radar, occupancy grids, and learned perception help the vehicle
understand the scene, but they are not a substitute for a certified protective
field around people, pallets, aircraft, docks, forklifts, trailers, and building
edges. The near-field layer should be simple, monitored, and hard for the main
autonomy stack to bypass.

The core architecture is a safety controller that receives safety-rated scanner,
bumper, edge, and proximity inputs; selects protective fields based on vehicle
speed and direction; and directly commands safe stop or speed limitation. The
autonomy stack can consume this state for planning, but it should not be able to
mask a protective stop.

---

## AV, Indoor, Outdoor, and Airside Relevance

| Domain | Close-range hazard | Design implication |
|---|---|---|
| Generic AV | People or objects can enter blind spots below perception sensor height or inside braking distance. | Use independent near-field protective sensing tied to the safety controller. |
| Indoor warehouse | Pallets, racks, glass, dock plates, forklift tines, and pedestrians are close to the vehicle path. | Combine safety laser scanners with ultrasonic, edge, and bumper coverage for blind zones. |
| Outdoor campus and yard | Rain, fog, sunlight, dust, trailers, curbs, and mixed manual traffic affect detection. | Use outdoor-capable scanners or sensor fusion; validate fields in weather and contamination. |
| Airside | Ground crew, aircraft fuselage, tow bars, belt loaders, fuel trucks, cones, and jet blast debris are near the vehicle. | Add field sets for docking, stand maneuvering, wing/fuselage clearance, and apron transit. |

---

## Architecture

```
Safety laser scanners / safety radar / ultrasonic / tactile bumpers
        |
        v
Safety I/O or safety network (OSSD, safety relay, PROFIsafe, FSoE, CAN safety)
        |
        v
Safety PLC / safety MCU
        |
        +--> Field-set selector from speed, direction, steering mode, load state
        +--> Safe-speed and safe-stop logic
        +--> Diagnostics and muting/service-mode policy
        |
        +--> Brake / drive enable / safe torque off / E-stop chain
        |
        +--> Non-safety status to autonomy planner and fleet logs
```

The protective layer is not the same as the perception layer. A safety scanner
can also provide measurement data for navigation, but its safety output must
remain validated as a safety function with documented response time, diagnostic
coverage, and field configuration.

---

## Sensor Modalities

| Modality | Strength | Limitation | Best use |
|---|---|---|---|
| Safety laser scanner | Configurable 2D protective and warning fields, mature PL/SIL products, good for mobile bases. | Can be affected by mounting height, reflectivity, weather, contamination, and occlusion. | Primary personnel protection around AMRs, AGVs, tugs, and low-speed AVs. |
| Outdoor safety laser scanner | Designed for sunlight, rain, snow, fog, and outdoor industrial use. | Higher cost; still needs cleaning and field validation. | Outdoor campus, yard, mining, agriculture, and airside apron routes. |
| Safety radar | More tolerant of dust, fog, rain, steam, and airborne particles. | Lower spatial resolution than laser; object discrimination and field shape can be coarser. | Outdoor zones where optical scanners nuisance-trip or lose availability. |
| Safety-rated ultrasonic | Detects transparent or low-reflectivity objects and short-range geometry; useful in dirty or wet zones. | Acoustic reflections, air turbulence, temperature gradients, and narrow beams require careful placement. | Docking, aircraft clearance, pallet pocket detection, glass or shrink-wrap detection. |
| Tactile bumper / safety edge | Last-resort contact detection; simple, visible, and easy to reason about. | Contact has already occurred; must operate at very low residual energy. | Low-speed final protection on bumpers, doors, carts, and docking faces. |
| Non-safety proximity sensors | Cheap coverage for blind spots and service aids. | Not a safety function by itself. | Advisory planning inputs and diagnostic context. |

---

## Design Details

### Protective Field Design

### Field Sets

Protective fields should change with motion state. A single static field either
creates nuisance stops or leaves unsafe gaps.

| Motion state | Field policy |
|---|---|
| Stationary | Close protective field around the vehicle; restart interlock if a person is inside. |
| Forward cruise | Long forward field sized by speed, response time, braking distance, slope, load, and uncertainty. |
| Reverse | Rear field with lower speed limit unless rear coverage equals forward coverage. |
| Turning | Swept-path field on the outside of the turn and side field for tail swing. |
| Crab or lateral motion | Side protective fields become primary; front/rear fields remain warning zones. |
| Docking | Very short protective field, low speed, tactile/ultrasonic close-in confirmation. |
| Trailer/tow/load present | Field expands to include load envelope and hitch articulation. |
| Manual service mode | Reduced speed, hold-to-run, local enable device, explicit field-set indicator. |

### Separation Distance

For non-contact protective devices, field size must account for:

- Sensor response time.
- Safety controller and output response time.
- Drive/brake reaction time.
- Vehicle stopping distance under worst validated load, slope, surface, and tire condition.
- Object approach speed and possible body-part access into the field.
- Sensor resolution, mounting height, blanking/muting, and measurement uncertainty.

The safety case should store the calculation inputs with the scanner field
configuration. A field drawing without a response-time budget is not reviewable.

### Minimum Near-Field Coverage

| Zone | Typical risk | Sensor design |
|---|---|---|
| Front low zone | Feet, cones, tow bars, pallet corners below long-range sensor line of sight | Low-mounted scanner plus bumper/edge coverage. |
| Rear low zone | Reverse into pedestrians, dock edge, aircraft equipment | Rear scanner or dual-corner scanners; low-speed reverse policy. |
| Side sweep | Tail swing, crab motion, articulated load | Side fields linked to steering mode and yaw rate. |
| Docking face | Contact with aircraft, dock, rack, charging target | Ultrasonic/proximity plus tactile bumper and hard speed cap. |
| Underbody | Low obstacles, fallen FOD, chocks, cables | Short-range proximity or mechanical guard; treat as advisory unless safety-rated. |
| Sensor blind regions | Mounting brackets, payload, lift mast, tow load | Redundant fields or speed/geofence constraints. |

---

### Safety Controller Design

### Safety Function Examples

| Safety function | Inputs | Output | Notes |
|---|---|---|---|
| Protective stop | Scanner protective field, bumper, edge, safety radar | Brake request, drive inhibit, safe torque off | Must not depend on autonomy planner approval. |
| Warning speed reduction | Scanner warning field, ultrasonic proximity | Speed limit to DBW/safety controller | Useful before protective stop; still log as near-field event. |
| Restart interlock | Field occupied while stopped | Hold inhibited state | Prevents restart into a person or object. |
| Dynamic field switching | Speed, direction, steering mode, load state | Scanner field-set selection | Field selection must be monitored for plausibility. |
| Service mode | Key switch, enable device, low speed, local operator | Reduced protective behavior with explicit limits | Muting is not free; it is a safety mode with evidence. |

### Interface Rules

- Safety outputs go directly to the safety controller or safety network.
- The autonomy stack receives a read-only mirror of field state, trip cause,
  speed limit, and reset eligibility.
- Safety field configuration is release-controlled and tied to vehicle geometry,
  load geometry, brake performance, and scanner firmware.
- Remote reset is blocked unless the vehicle is stopped, the field is clear, and
  a local or approved remote procedure permits it.
- Muting and blanking require time, location, and state constraints. They should
  be rare, logged, and visible to the operator.

---

## Deployment Notes

1. Validate braking distance with the heaviest load, lowest traction surface,
   battery low-voltage condition, and cold/hot brake behavior expected in the ODD.
2. Commission scanner fields from surveyed vehicle geometry, not from CAD alone.
   Verify with physical test targets at ground level and body-part heights.
3. Test field switching while turning, reversing, crab steering, docking,
   lifting, towing, and driving over slopes or dock plates.
4. Include contamination tests: dust, rain, de-icing mist, mud splash, plastic
   wrap, glass, reflective clothing, and low-dark objects.
5. Log every protective stop with active field set, object range/bearing, vehicle
   speed, brake command, stopping distance, and reset actor.
6. Treat nuisance stops as safety evidence, not just productivity issues. Frequent
   nuisance stops often indicate field sizing, cleaning, mounting, or environment
   problems.
7. Revalidate fields after sensor replacement, bracket adjustment, tire size
   change, brake service, payload geometry change, or software release changing
   speed limits.

---

## Failure Modes

| Failure mode | Detection | Safe response |
|---|---|---|
| Scanner contamination or blocked window | Scanner diagnostic, reduced signal strength, health monitor, cleaning failure | Degrade speed, trigger cleaning, stop if protective coverage is insufficient. |
| Field-set mismatch | Commanded field does not match speed/direction/load state | Stop or enforce lowest speed field; raise configuration DTC. |
| Blind zone from payload or tow load | Commissioning test, payload state mismatch, sensor occlusion | Expand fields, add sensors, or restrict motion mode. |
| Nuisance trips from dust, rain, snow, or sunlight | High trip rate with no object confirmed; environmental correlation | Use outdoor scanner/radar, cleaning, field tuning, or ODD restriction. |
| Ultrasonic false negative on angled/soft object | Docking test miss, cross-sensor disagreement | Redundant sensor angle, speed cap, tactile backup. |
| Bumper or edge disconnected | Safety input fault, channel discrepancy, test pulse failure | Inhibit motion or limit to service mode. |
| Safety controller network loss | Missing OSSD/safety network heartbeat | Safe stop; planner cannot override. |
| Remote reset into occupied field | Reset request while field occupied or cause unknown | Deny reset; require local inspection if repeated. |
| Protective field too short after brake wear | Stopping test drift, brake DTC, maintenance data | Lower speed limit or require brake service and field recalculation. |

---

## Related Repository Documents

- [Sensor Degradation Detection and Health Monitoring](sensor-degradation-health-monitoring.md)
- [Automated Sensor Cleaning and Physical Self-Maintenance](automated-sensor-cleaning.md)
- [Environmental and EMC Qualification](../ruggedization/environmental-emc-qualification.md)
- [CAN Bus Communication and Drive-by-Wire Interfaces](../drive-by-wire/can-bus-dbw.md)
- [Autonomy Power Distribution and Safe-Stop Energy](../power-electrical/autonomy-power-distribution.md)
- [Simplex Safety Architecture](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md)
- [Runtime Verification and Monitoring](../../60-safety-validation/runtime-assurance/runtime-verification-monitoring.md)
- [Ground Crew and Pedestrian Safety](../../70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md)
- [Failure Modes Analysis](../../60-safety-validation/safety-case/failure-modes-analysis.md)

---

## Sources

- ISO, [ISO 3691-4:2023 Industrial trucks - Safety requirements and verification - Driverless industrial trucks](https://www.iso.org/standard/83545.html)
- ISO, [ISO 13849-1:2023 Safety of machinery - Safety-related parts of control systems](https://www.iso.org/standard/73481.html)
- ISO, [ISO 13855:2024 Safety of machinery - Positioning of safeguards](https://www.iso.org/standard/80590.html)
- IEC, [IEC 61496-1:2020 Electro-sensitive protective equipment - General requirements](https://webstore.iec.ch/en/publication/63115)
- IEC, [IEC 61496-3:2025 Active opto-electronic protective devices responsive to diffuse reflection](https://webstore.iec.ch/en/publication/84133)
- IEC, [IEC TS 62998-1:2019 Safety-related sensors used for protection of persons](https://webstore.iec.ch/en/publication/31009)
- IEC, [IEC TS 62998-3:2023 Sensor technologies and algorithms](https://webstore.iec.ch/en/publication/66191)
- SICK, [outdoorScan3 outdoor safety laser scanner announcement](https://www.sick.com/gb/en/sick-ventures-outdoors-with-worlds-first-safety-laser-scanner-certified-to-iec-ts-62998/w/gb-en-outdoorscan)
- Leuze, [RSL 400 safety laser scanner](https://www.leuze.com/en-uk/products/safety/safety-products/safety-laser-scanners/rsl-400)
- Pilz, [PSENscan safety laser scanner](https://www.pilz.com/en-GB/products/sensor-technology/safety-laser-scanner)
- Pepperl+Fuchs, [USi-industry ultrasonic sensor system](https://www.pepperl-fuchs.com/global/en/USi-industry.htm)
- Mayser, [Safety bumpers for automated guided vehicles](https://www.mayser.com/media/3040/download/AA-SB_EN.pdf?v=2)
