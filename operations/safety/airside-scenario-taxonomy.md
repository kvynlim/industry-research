# Airside Scenario Taxonomy and Edge Case Catalog for Autonomous Ground Vehicles

> A systematic classification of operational scenarios, hazards, and edge cases for autonomous vehicles operating on airport airside surfaces. Adapted from ISO 34502 (road vehicle scenario-based safety evaluation) and aligned with SOTIF (ISO 21448) for the unique constraints of apron, taxiway, and service road environments. Intended to support safety case development, test planning, and certification evidence for ISO 3691-4 and anticipated FAA Advisory Circulars.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Scenario Classification Framework](#2-scenario-classification-framework)
3. [Operational Phase Taxonomy](#3-operational-phase-taxonomy)
4. [Environmental Conditions Matrix](#4-environmental-conditions-matrix)
5. [Actor Taxonomy](#5-actor-taxonomy)
6. [Hazard Catalog (SOTIF-Aligned)](#6-hazard-catalog-sotif-aligned)
7. [Edge Cases and Long-Tail Scenarios](#7-edge-cases-and-long-tail-scenarios)
8. [Sensor Coverage Analysis per Scenario](#8-sensor-coverage-analysis-per-scenario)
9. [Scenario Frequency and Risk Matrix](#9-scenario-frequency-and-risk-matrix)
10. [Testing Strategy per Scenario](#10-testing-strategy-per-scenario)
11. [Regulatory Mapping](#11-regulatory-mapping)
12. [References](#12-references)

---

## 1. Introduction

### 1.1 Why a Formal Scenario Taxonomy

Airport ramp operations produce approximately 27,000 accidents and incidents annually worldwide, resulting in an estimated 243,000 injuries and at least USD 10 billion in costs (Flight Safety Foundation GAP, IATA Ground Ops Safety). Ground Support Equipment is responsible for 61% of aircraft ground damage (IATA Ground Damage Database), and aircraft-GSE collisions cost the industry USD 5 billion per year -- a figure projected to double to USD 10 billion by 2035 unless preventive action is taken (IATA 2022).

An autonomous vehicle entering this environment must demonstrate safety performance that exceeds the human baseline across every plausible scenario. A scenario taxonomy provides the systematic foundation for three critical activities:

1. **Safety case construction.** ISO 3691-4 (Clause 5) requires verification of safety functions against an identified hazard list. A comprehensive scenario catalog ensures that the hazard list covers all reasonably foreseeable situations, including rare-but-severe edge cases that fall outside routine operating experience.

2. **Test planning and coverage measurement.** Without a structured scenario space, testing is ad hoc and coverage gaps are invisible. The taxonomy defines what must be tested, how many variations exist within each scenario class, and what constitutes sufficient evidence of safe behavior.

3. **Certification evidence.** Anticipated regulatory frameworks -- FAA Advisory Circular (predicted ~2028-2029), EASA AMC (~2028), and ISO/SAE autonomous GSE standards (~2029-2030) -- will require evidence that the AV has been evaluated against a defined set of scenarios. Establishing the taxonomy now positions a manufacturer to provide this evidence on the timeline regulators expect.

### 1.2 Scope

This taxonomy covers autonomous vehicles operating on airport airside surfaces including aprons, service roads, and designated taxiway crossings. It does not cover runway operations (autonomous vehicles should never operate on active runways) or public-road transit between airports.

Vehicle types in scope: autonomous baggage tractors/dolly tugs (Aurrigo Auto-DollyTug, UISEE tractors, EasyMile/TLD TractEasy EZTow), autonomous cargo transporters, and autonomous tow tractors. The taxonomy is extensible to autonomous pushback tugs, autonomous refueling vehicles, and autonomous personnel movers if those vehicle types enter development.

### 1.3 Relationship to Other Documents

| Document | Relationship |
|----------|-------------|
| [failure-modes-analysis.md](failure-modes-analysis.md) | Failure taxonomy for perception, world model, and planning subsystems |
| [ground-crew-pedestrian-safety.md](ground-crew-pedestrian-safety.md) | Detailed analysis of personnel hazard H1 |
| [iso-3691-4-deep-dive.md](iso-3691-4-deep-dive.md) | Standard requirements mapped against this taxonomy |
| [safety-incidents-lessons.md](safety-incidents-lessons.md) | Real-world AV incidents informing edge case identification |
| [simplex-safety-architecture.md](simplex-safety-architecture.md) | Dual-stack architecture providing hazard mitigation |
| [../airside/fod-and-jetblast.md](../airside/fod-and-jetblast.md) | Detection methods for hazards H4 and H5 |
| [../airside/turnaround-prediction.md](../airside/turnaround-prediction.md) | Turnaround phase model underlying Phase 3 scenarios |

---

## 2. Scenario Classification Framework

### 2.1 ISO 34502 Adaptation for Airside

ISO 34502:2022 defines a three-tier scenario abstraction hierarchy for road vehicles. We adapt this hierarchy for the airside operational design domain (ODD):

```
Functional Scenario (natural language, qualitative)
  "AV transits from depot to apron in light rain at night"

    ↓ parameterize

Logical Scenario (parameter ranges, distributions)
  "AV at 10-15 km/h on service road, rain rate 2-10 mm/hr,
   ambient light 0.5-5 lux, 0-3 oncoming GSE vehicles,
   surface friction coefficient 0.5-0.7"

    ↓ instantiate

Concrete Scenario (specific values, executable)
  "AV at 12.3 km/h on service road R7, rain rate 4.2 mm/hr,
   ambient light 1.8 lux, 2 oncoming belt loaders at positions
   (x1,y1) and (x2,y2), friction 0.62"
```

This mirrors ISO 34502's "recognize-judge-operate" decomposition but replaces road-specific elements (lanes, traffic signals, highway merge) with airside-specific elements (stand assignments, turnaround phases, jet blast zones, VDGS guidance).

### 2.2 Scenario Dimensions

Each scenario is characterized along six orthogonal dimensions:

| Dimension | Airside-Specific Elements |
|-----------|--------------------------|
| **Operational phase** | Transit, approach, turnaround support, pushback support, return (Section 3) |
| **Environment** | Weather, lighting, surface condition, visibility, temperature (Section 4) |
| **Actors** | Aircraft state, GSE types, personnel roles, wildlife, emergency vehicles (Section 5) |
| **Infrastructure** | Stand type (contact/remote), taxiway width, service road geometry, AV zone markings |
| **Events** | Planned (turnaround sequence), unplanned (emergency, equipment failure, spill) |
| **Ego state** | Loaded/unloaded, speed, dolly train length, battery level, sensor health |

### 2.3 Scenario Combinatorics

The total scenario space is the Cartesian product of all dimension values. With conservative estimates:

| Dimension | Distinct Values |
|-----------|----------------|
| Operational phase | 5 |
| Weather | 6 |
| Lighting | 4 |
| Surface | 5 |
| Actor configurations | ~50 |
| Infrastructure variants | ~10 |
| Event types | ~20 |
| Ego states | ~8 |

Total functional scenario combinations: ~4.8 million. This is intractable for exhaustive physical testing but manageable for simulation-based evaluation with statistical sampling. The taxonomy's purpose is to identify which regions of this space contain the highest risk and therefore require the most testing attention.

### 2.4 SOTIF Integration

ISO 21448 (SOTIF) defines two categories of unsafe behavior:

- **Known unsafe scenarios (Area 2):** Identified triggering conditions where the system may fail. These must be mitigated to acceptable residual risk.
- **Unknown unsafe scenarios (Area 3):** Not yet identified but potentially hazardous. These must be reduced through systematic exploration (scenario generation, field testing, fleet data).

The hazard catalog (Section 6) maps each hazard to its triggering conditions, placing it in Area 2. Section 7 (edge cases) targets Area 3 -- scenarios that have not been observed in operational data but are physically plausible and must be tested in simulation.

---

## 3. Operational Phase Taxonomy

### 3.1 Phase 1: Transit (Depot to Apron)

| Attribute | Value |
|-----------|-------|
| **Description** | AV travels from maintenance/charging depot to assigned apron area via service roads and taxiway crossings |
| **Typical duration** | 3-15 minutes depending on airport layout |
| **Speed range** | 10-25 km/h (service road limit typically 25-30 km/h) |
| **Actors present** | Other GSE vehicles, occasional ground crew, possibly aircraft taxiing on crossing taxiways |
| **Risk level** | Medium -- higher speed, fewer actors, but taxiway crossings are high-consequence |
| **Key hazards** | Taxiway incursion (H6), collision with oncoming GSE (H3), FOD on service road (H5) |

**Critical sub-scenarios:**
- Taxiway crossing: AV must yield to taxiing aircraft with absolute priority. Detection range must exceed aircraft approach speed x reaction time (aircraft taxi speed 15-30 kt = 8-15 m/s; at 200 m detection range, 13-25 s reaction window).
- Intersection with other GSE at unmarked service road junctions.
- Transition from depot (indoor/covered) to outdoor environment -- sudden lighting and GPS availability change.

### 3.2 Phase 2: Approach (Navigating to Assigned Stand)

| Attribute | Value |
|-----------|-------|
| **Description** | AV navigates from service road to assigned aircraft stand, entering congested apron area |
| **Typical duration** | 1-5 minutes |
| **Speed range** | 5-15 km/h (apron speed limit typically 15-30 km/h, with 10-15 km/h near stands) |
| **Actors present** | Parked aircraft, active GSE at adjacent stands, ground crew, marshallers, passengers (bus transfer) |
| **Risk level** | High -- increasing congestion, proximity to aircraft, narrow clearances |
| **Key hazards** | Aircraft wingtip clearance violation (H8), collision with GSE at adjacent stands (H3), struck personnel (H1) |

**Critical sub-scenarios:**
- Navigating between parked aircraft with clearances as small as 7.5 m (25 ft) between wingtips.
- Arriving at a stand where the turnaround for the previous aircraft is still in progress.
- Stand reassignment while en route -- AV must re-plan to a different stand.
- Following VDGS lead-in lines painted on the apron surface (may be degraded or obscured by water/oil).

### 3.3 Phase 3: Turnaround Support (Operating Around Aircraft)

| Attribute | Value |
|-----------|-------|
| **Description** | AV positions at stand, loads/unloads baggage containers or dollies, operates alongside 8-15 other GSE units |
| **Typical duration** | 25-90 minutes depending on aircraft type and turnaround schedule |
| **Speed range** | 0-5 km/h (positioning), stationary during load/unload |
| **Actors present** | Maximum density: ground crew (6-20 personnel), belt loaders, container loaders, catering trucks, fuel truck, GPU, PCA unit, lavatory service, potable water truck, possibly passenger bus |
| **Risk level** | Very High -- maximum congestion, personnel in blind spots, dynamic environment |
| **Key hazards** | Personnel collision (H1), GSE collision (H3), jet blast during engine start (H4), FOD creation (H5), aircraft clearance (H8) |

**Critical sub-scenarios:**
- Positioning under aircraft fuselage with <1 m clearance to cargo door sill.
- Ground crew walking between AV and belt loader during active loading.
- Adjacent stand pushback commencing while AV is stationary at its own stand.
- Engine start at own stand (pilot initiates engine spool-up while GSE is still clearing).
- Night turnaround with mixed lighting: bright flood lights from one direction, deep shadows from another.

### 3.4 Phase 4: Pushback Support (Coordinating with Pushback Operations)

| Attribute | Value |
|-----------|-------|
| **Description** | AV clears the stand area before/during aircraft pushback, or operates in coordination with pushback tug |
| **Typical duration** | 3-10 minutes |
| **Speed range** | 0-10 km/h (clearing), 0 km/h (waiting at safe position) |
| **Actors present** | Pushback tug, wing walkers, headset-connected ground crew, aircraft with engines starting |
| **Risk level** | Very High -- aircraft in motion on the stand, jet blast increasing, time pressure to clear |
| **Key hazards** | Jet blast exposure (H4), collision with pushback aircraft (H2), personnel collision during evacuation (H1) |

**Critical sub-scenarios:**
- AV must vacate stand within 2-3 minutes of pushback clearance announcement.
- Simultaneous pushback at adjacent stand -- the pushed-back aircraft's tail sweeps into AV's planned egress path.
- Engine start during pushback: CFM56 idle thrust blast reaches 35 kt at 30 m behind aircraft. Larger engines (GE90, Trent XWB) produce higher exhaust velocities.
- Communication failure: AV does not receive pushback notification and is still on stand when pushback begins.

### 3.5 Phase 5: Return (Apron to Depot)

| Attribute | Value |
|-----------|-------|
| **Description** | AV returns to depot for charging, maintenance, or end-of-shift parking |
| **Typical duration** | 3-15 minutes |
| **Speed range** | 10-25 km/h |
| **Actors present** | Similar to Phase 1 but may include shift-change pedestrian traffic |
| **Risk level** | Medium -- similar to transit but potentially at end of battery charge or in adverse weather that has developed |
| **Key hazards** | Low battery causing reduced speed or emergency stop (ego failure), nighttime return with reduced visibility, taxiway incursion (H6) |

**Critical sub-scenarios:**
- Battery critically low -- AV must reach depot before shutdown, but must not sacrifice safety for urgency.
- Return in worsening weather (fog rolled in during shift).
- End-of-shift fatigue parallel: sensor degradation from accumulated dirt/water on LiDAR windows over shift duration.

### 3.6 Phase Summary

| Phase | Duration | Speed (km/h) | Actor Density | Risk Level | Primary Hazard |
|-------|----------|---------------|---------------|------------|----------------|
| Transit | 3-15 min | 10-25 | Low | Medium | H6 (incursion) |
| Approach | 1-5 min | 5-15 | Medium | High | H8 (wingtip) |
| Turnaround | 25-90 min | 0-5 | Very High | Very High | H1 (personnel) |
| Pushback | 3-10 min | 0-10 | High | Very High | H4 (jet blast) |
| Return | 3-15 min | 10-25 | Low-Medium | Medium | H6 (incursion) |

---

## 4. Environmental Conditions Matrix

### 4.1 Weather Conditions

| Condition | Visibility Impact | Surface Impact | Sensor Impact | Frequency |
|-----------|-------------------|----------------|---------------|-----------|
| **Clear** | None | Dry | Nominal | 50-70% of ops |
| **Light rain** (<5 mm/hr) | Slight | Wet, reflective | LiDAR: 5-15% point loss; Camera: rain drops on lens | 10-20% |
| **Heavy rain** (>10 mm/hr) | Moderate | Standing water, hydroplaning risk | LiDAR: 30-50% point loss; Camera: severely degraded | 2-5% |
| **Fog** (vis <500 m) | Severe | Wet | LiDAR: range reduced 30-60%; Camera: contrast loss; Radar: unaffected | 3-8% |
| **Snow/ice** | Moderate-Severe | Slippery, markings obscured | LiDAR: lens accumulation; Camera: contrast loss; All: calibration drift from thermal cycling | 1-10% (varies by latitude) |
| **De-icing operations** | Severe (local) | Chemical spray, glycol on surface | LiDAR: lens contamination in spray zone (sudden point count drop to near-zero); Camera: droplet blur | 2-5% (winter) |
| **Sandstorm/dust** | Severe | Abrasive, reduced friction | LiDAR: rapid degradation; Camera: pitting; Radar: unaffected | <1% (arid airports) |

### 4.2 Lighting Conditions

| Condition | Illumination | Sensor Impact | Frequency |
|-----------|-------------|---------------|-----------|
| **Day (bright)** | >10,000 lux | Camera: possible saturation from apron reflection; LiDAR: solar interference in near-IR band | 40-50% |
| **Day (overcast)** | 1,000-10,000 lux | Camera: good; LiDAR: nominal | 15-25% |
| **Dusk/dawn** | 1-1,000 lux | Camera: rapid dynamic range change; Auto-exposure hunting | 5-10% |
| **Night** | 0.5-50 lux (apron lit) | Camera: noise, reduced resolution; AEB failure rate for hi-vis vest: 84-88%; LiDAR: unaffected; Thermal: optimal | 25-35% |
| **Mixed** | Highly variable | Camera: extreme dynamic range (bright flood lights + deep shadows); HDR needed | Common at night |

### 4.3 Surface Conditions

| Condition | Friction Coefficient | Impact on AV | Detection Method |
|-----------|---------------------|-------------|-----------------|
| **Dry concrete** | 0.7-0.9 | Nominal braking | Default assumption |
| **Wet concrete** | 0.4-0.7 | 20-40% longer braking distance | Rain sensor, camera surface analysis |
| **Icy/frosted** | 0.1-0.3 | 3-7x longer braking distance | Temperature sensor, friction estimation from wheel slip |
| **Oil/fuel spill** | 0.05-0.15 | Near-zero braking traction, fire hazard | Camera (color/sheen detection), infrastructure notification |
| **Painted markings** | 0.5-0.7 (wet: 0.3-0.5) | Reduced traction on wet paint | Map layer (known marking locations) |
| **Expansion joints** | Variable | Bump, possible dolly derailment | Map layer, LiDAR elevation change |
| **Rubber deposits** | 0.3-0.6 | Reduced traction | Map layer (near runway thresholds) |

### 4.4 Visibility Modifiers

| Modifier | Mechanism | Affected Sensors | Mitigation |
|----------|-----------|-----------------|------------|
| **Jet blast shimmer** | Refractive index variation from hot exhaust | Camera: image distortion, blur | Thermal camera detects exhaust boundary; radar unaffected |
| **De-icing spray cloud** | Glycol/water aerosol | LiDAR: backscatter, lens contamination; Camera: obscured | Radar sees through; halt and wait |
| **Heat haze** | Ground-level thermal convection | Camera: image wobble at long range | LiDAR unaffected; use radar at range |
| **Glare (low sun)** | Direct sunlight into camera | Camera: blooming, flare | Sun position prediction; visor/filter; LiDAR unaffected |
| **Aircraft lighting** | Strobe, nav, landing lights | Camera: local overexposure | HDR processing; temporal filtering |

### 4.5 Temperature Effects on Sensors

| Temperature Range | Effect |
|-------------------|--------|
| **-20C to -10C** | LiDAR heater power draw increases; battery capacity reduced 20-40%; rubber seals may stiffen; lubricant viscosity increases |
| **-10C to 0C** | Ice formation on sensor windows possible; condensation on cold-soak sensors moving to warm environment |
| **0C to 35C** | Nominal operating range for most sensors |
| **35C to 45C** | GPU/SoC thermal throttling begins on Orin above ~40C ambient (depending on enclosure); LiDAR may derate |
| **45C to 55C** | Sustained operation at thermal limits; increased failure rate; apron surface temperature can reach 70C+ (burns, tire degradation) |

---

## 5. Actor Taxonomy

### 5.1 Aircraft States

| State | Description | Hazard to AV | Detection Cues |
|-------|-------------|-------------|----------------|
| **Parked, engines off** | Chocked, GPU connected, doors open | Static obstacle (wingtip, landing gear, open cargo doors) | Size, shape, position in map |
| **Parked, APU running** | Pre-departure, exhaust from APU | Mild exhaust (APU outlet typically at tail), noise masking | Thermal signature, sound level |
| **Parked, engines starting** | Pilot initiating engine start | Ingestion zone (15 ft / 4.6 m forward of intake); growing exhaust blast | Rotating beacon ON = engine start signal; thermal bloom |
| **Taxiing (arrival)** | Moving to stand at 5-15 kt | Collision risk, jet blast, ingestion zone | Moving target, size, ADS-B if available |
| **Taxiing (departure)** | Moving from stand to taxiway | Collision risk, increasing thrust/blast | Moving target, departing trajectory |
| **Pushback** | Moving backwards under tug control | Tail sweeps arc, unpredictable from AV perspective | Pushback tug visible, wing walkers present |

### 5.2 GSE Vehicle Types and Behavior Patterns

| GSE Type | Typical Speed | Behavior Pattern | AV-Relevant Hazard |
|----------|---------------|-------------------|---------------------|
| **Baggage tractor + dolly train** | 10-25 km/h | Long articulated train (up to 4-5 dollies), wide turning radius, often driven aggressively under time pressure | Long tail swing; limited rearward visibility; dolly derailment drops baggage (FOD) |
| **Belt loader** | 5-15 km/h | Approaches aircraft, extends conveyor to cargo door, operates at stand for 10-20 min | Extends/retracts: changing footprint; personnel walk around both sides |
| **Container/pallet loader (high-loader)** | 5-10 km/h | Large vehicle, elevating platform to main-deck cargo door | Very large blind zones; personnel underneath during ULD transfer |
| **Catering truck** | 10-20 km/h | Elevating box body to aircraft door; operates 10-15 min | Elevated body obscures camera view of surroundings; personnel between truck and aircraft |
| **Fuel truck/hydrant dispenser** | 5-15 km/h | Approaches aircraft underwing fuel panel; connects hoses | Fuel spill zone around hose connections; NO VEHICLES within 6 m during fueling (safety zone) |
| **Pushback tug** | 5-10 km/h | Connects to nose gear, pushes aircraft backward | Very large combined vehicle; aircraft tail sweeps wide arc |
| **GPU (ground power unit)** | 5-15 km/h | Parks near nose gear, connects cable | Stationary obstacle with trailing cables; trip/snag hazard |
| **PCA (pre-conditioned air)** | 5-15 km/h | Parks near aircraft, connects ducting | Large duct creates temporary obstacle; often left in position |
| **Lavatory service truck** | 10-15 km/h | Services aft of aircraft; hose connections | Waste spill hazard; often operates in low-traffic areas |
| **Potable water truck** | 10-15 km/h | Services forward of aircraft | Spill hazard; small vehicle, may be in AV path |
| **Passenger stairs** | 5-10 km/h | Positions at aircraft door (remote stands) | Large footprint; passengers descending stairs near ground level |
| **Passenger bus** | 10-30 km/h | Transports passengers between terminal and remote stands | Large vehicle; passengers disembarking at stand level near AV |
| **De-icing truck** | 10-15 km/h | Elevated boom spraying glycol; operates pre-departure | Spray cloud degrades sensors; glycol on surface reduces friction |
| **Follow-me car** | 15-30 km/h | Guides aircraft on apron | May change speed/direction unexpectedly; AV should not follow |
| **Maintenance vehicle** | 10-20 km/h | Various sizes; may tow equipment | Unpredictable stopping; equipment may extend beyond vehicle footprint |

### 5.3 Personnel Types

| Personnel Type | Typical Behavior | Visibility | Detection Challenge |
|----------------|------------------|------------|---------------------|
| **Ground crew (ramp agents)** | Moving between GSE and aircraft, carrying items, bending, crouching | Hi-vis vest (84-88% AEB failure rate at night per research data) | Crouching/bending reduces height; occluded by GSE; fast direction changes |
| **Marshallers** | Standing in front of aircraft, using wands/paddles | Hi-vis, reflective wands | Generally visible; but AV must not approach marshalling zone |
| **Wing walkers** | Walking alongside aircraft wingtips during pushback | Hi-vis | Moving with aircraft; AV must maintain clearance from pushback sweep zone |
| **Supervisors/managers** | Walking between stands, sometimes without hi-vis | Variable | May not wear hi-vis; may cross AV path unexpectedly |
| **Passengers (bus transfer)** | Groups of 30-150, walking between bus and aircraft stairs | Civilian clothing, no hi-vis | Large group, unpredictable individual movement, children, mobility-impaired |
| **Fuel handlers** | Near fuel truck and underwing panel | Hi-vis + flame-retardant | Located in fuel safety zone; AV must avoid this zone entirely |
| **Maintenance engineers** | Under aircraft, on ladders, inside engine cowlings | Variable | May be partially occluded by aircraft; may emerge unexpectedly from under fuselage |

### 5.4 Wildlife

| Type | Frequency | Hazard to AV | Detection |
|------|-----------|-------------|-----------|
| **Birds (gulls, starlings)** | Common at coastal/inland airports | FOD risk if struck; bird remains on surface create FOD for aircraft | Camera: good; LiDAR: marginal for small birds |
| **Rabbits/hares** | Common at many European airports | Small, fast-moving; potential collision | LiDAR: detectable >15 m; Radar: possible |
| **Foxes** | Occasional, mostly night | Medium-sized; may freeze in headlights | LiDAR: good; Thermal: excellent |
| **Large animals (deer)** | Rare on apron (perimeter fence breach) | Significant collision risk | All sensors: good |

### 5.5 Emergency Vehicles

| Vehicle | Priority | AV Response Required |
|---------|----------|---------------------|
| **ARFF (Aircraft Rescue and Fire Fighting)** | Absolute priority | Immediate stop and clear path; do not resume until all-clear |
| **Ambulance** | High priority | Yield, stop if in path |
| **Airport operations vehicle** | Context-dependent | Yield if lights/sirens active |
| **Police/security** | Context-dependent | Yield if lights/sirens active |

Emergency vehicles may travel at 60-80 km/h on apron during response -- far exceeding normal GSE speeds. The AV must detect and yield at maximum range.

---

## 6. Hazard Catalog (SOTIF-Aligned)

### 6.1 Hazard Summary Table

| ID | Hazard | Severity | Frequency (per 1M ops) | ASIL-like Rating | Primary Phase |
|----|--------|----------|----------------------|------------------|---------------|
| H1 | Collision with personnel | Catastrophic (S3) | 0.47 fatalities/M departures (NTSB) | D | Turnaround, Pushback |
| H2 | Collision with aircraft | Critical (S2-S3) | 6.2 per 10,000 departures | C-D | Approach, Turnaround |
| H3 | Collision with other GSE | Serious (S2) | ~15 per 10,000 departures | B-C | All phases |
| H4 | Jet blast exposure | Critical-Catastrophic | ~0.5 per 10,000 departures | C | Pushback, Turnaround |
| H5 | FOD creation | Moderate-Critical (S1-S2) | Context-dependent | B | Transit, Turnaround |
| H6 | Runway/taxiway incursion | Catastrophic (S3) | 32 per 1M operations (FAA FY2023) | D | Transit, Return |
| H7 | Fuel spill zone entry | Critical-Catastrophic | Rare | C | Turnaround |
| H8 | Aircraft wingtip clearance violation | Critical (S2) | ~3 per 10,000 departures | C | Approach, Turnaround |

### 6.2 H1: Collision with Personnel

**Description:** AV strikes a ground crew member, passenger, or other person on the apron.

**Triggering conditions:**
- Personnel in AV blind spot (behind dolly train, under vehicle)
- Personnel crouching or bending below LiDAR scan plane
- Personnel emerging from behind GSE or aircraft structure
- Personnel wearing dark clothing at night (hi-vis failure: 84-88% AEB failure rate)
- Personnel making sudden direction change
- Personnel distracted by noise, time pressure, or personal device

**Severity:** Fatal or life-changing injury. NTSB data: 26% of ground crew accidents are fatal. Average cost per fatality: USD 5-12 million (legal settlements, regulatory penalties, operational disruption).

**Frequency estimate:** NTSB historical rate: 0.47 struck-by events per million departures (1983-2004). FAA data: 11 fatal struck-by injuries since 1985. The US GAO reported 6 fatal ramp accidents per year in the US alone (2007).

**Sensor coverage:**
| Sensor | Effectiveness | Limitation |
|--------|--------------|------------|
| LiDAR | Good (>15 m) | Misses crouching personnel <0.5 m; sparse points at range on thin limbs |
| Camera | Good (day) | 84-88% AEB failure rate at night for hi-vis personnel |
| Radar | Fair | Low resolution for person-sized targets; poor classification |
| Thermal | Excellent (night) | Cost; integration complexity; resolution lower than camera |

**Mitigation:**
- 360-degree LiDAR coverage (4-8 sensors, Aurrigo current config)
- Thermal cameras for night operations (FLIR Boson 640, 640x512 @ 60 Hz)
- Conservative speed limits near personnel: max 5 km/h within 5 m of any detected person
- Emergency stop distance < 0.5 m at 5 km/h (requires <0.36 s total reaction time)
- Under-vehicle sensing (ultrasonic or short-range radar) to detect personnel in crush zone
- V2I notification of personnel presence from infrastructure cameras

**Residual risk:** Personnel in complete sensor shadow (behind aircraft landing gear, between stacked containers). Mitigated by infrastructure perception and operational procedures (exclusion zones).

### 6.3 H2: Collision with Aircraft

**Description:** AV contacts aircraft fuselage, landing gear, engine nacelle, or other aircraft structure.

**Triggering conditions:**
- Localization error (GPS multipath near terminal buildings: 2-10 m error)
- Path planning error approaching stand
- Dolly train tail swing contacting aircraft during positioning
- Undetected aircraft position change (pushback initiated without notification)
- Wind gust moving lightweight AV toward aircraft

**Severity:** Aircraft ground damage average cost: USD 75,000-150,000 per incident (IATA). Range: USD 250,000 (minor dent) to USD 139 million+ (structural damage requiring major repair or write-off). Engine damage from GSE collision can reach USD 35 million per engine.

**Frequency estimate:** 22,400 aircraft ground damage incidents per year worldwide (IATA, based on 0.6-0.75 per 1,000 departures, 32 million departures in 2019). GSE causes 61% of these.

**Sensor coverage:**
| Sensor | Effectiveness | Limitation |
|--------|--------------|------------|
| LiDAR | Excellent | Aircraft are large, high-reflectivity targets |
| Camera | Good | Night/glare may reduce detection quality |
| Ultrasonic | Good (close range) | Only effective <3 m; useful for final positioning |

**Mitigation:**
- HD map with precise aircraft stand geometry and expected aircraft envelope per type
- Ultrasonic proximity sensors for final approach to stand (<3 m)
- Dolly train articulation monitoring (prevent tail swing exceeding envelope)
- Real-time aircraft position from ADS-B/MLAT (infrastructure feed)
- Minimum 3 m clearance from aircraft unless in designated approach corridor

**Residual risk:** Aircraft position differs from expected (wrong gate assignment, aircraft parked off-center). Mitigated by LiDAR-based aircraft detection and real-time position estimation.

### 6.4 H3: Collision with Other GSE

**Description:** AV collides with another ground support equipment vehicle.

**Triggering conditions:**
- Other GSE vehicle makes unpredictable maneuver (sudden reverse, U-turn)
- GSE vehicle approaches from behind (AV rear blind spot if dolly train present)
- GSE vehicle obscured by aircraft or other large equipment
- GSE vehicle exceeds apron speed limit (tracked at up to 60% above speed limit per ICAO observations)
- Multiple GSE converging at stand simultaneously during turnaround

**Severity:** Vehicle damage USD 5,000-100,000. Personnel injury possible if occupant ejected or pinned. Cargo damage/delay costs.

**Frequency estimate:** More frequent than aircraft damage -- estimated 15-20 GSE-to-GSE incidents per 10,000 departures based on industry surveys.

**Sensor coverage:** LiDAR and camera provide good detection of GSE-sized objects. Radar effective at all ranges. Primary challenge is prediction of GSE behavior, not detection.

**Mitigation:**
- 360-degree obstacle detection with minimum 50 m range
- GSE trajectory prediction (constant velocity model as baseline; learned model for improved prediction)
- Cooperative awareness via V2V if available (future: all GSE broadcasting position)
- Conservative right-of-way: AV always yields to human-driven GSE

**Residual risk:** GSE reversing into AV at high speed from close range (reaction time insufficient). Mitigated by rear-facing sensors and audible/visual warning systems.

### 6.5 H4: Jet Blast Exposure

**Description:** AV enters jet blast zone and is displaced, overturned, or damaged by engine exhaust.

**Triggering conditions:**
- Aircraft engine start while AV is within blast zone
- AV path crosses behind taxiing aircraft
- Wind direction changes, redirecting blast zone toward AV
- AV does not receive pushback/departure notification

**Severity:** Large jet engines (CF6, GE90, Trent XWB) produce exhaust velocities exceeding 100 kt (185 km/h) at 60 m behind the aircraft at 40% N1 (ground idle). At takeoff thrust, hazardous blast extends to 365 m (1,200 ft). A baggage tractor weighing 3-5 tonnes can be displaced or overturned. Personnel exposure is potentially fatal.

**Jet blast zone dimensions by engine class:**

| Engine Class | Example | Ground Idle (35 kt zone) | Breakaway (50 kt zone) | Takeoff (100 kt zone) |
|-------------|---------|--------------------------|------------------------|----------------------|
| Small turbofan | CFM56-5B | 30 m behind | 45 m behind | 150 m behind |
| Medium turbofan | PW1100G | 35 m behind | 55 m behind | 180 m behind |
| Large turbofan | GE90-115B | 50 m behind | 75 m behind | 250 m behind |
| Very large turbofan | Trent XWB | 55 m behind | 80 m behind | 280 m behind |

**Engine intake ingestion zone:** 4.6 m (15 ft) in front of engine intake. Personnel within this zone risk ingestion -- two fatal engine ingestion incidents occurred in 2022-2023 (Montgomery, Alabama and San Antonio, Texas). AV must never enter the intake zone.

**Sensor coverage:**
| Sensor | Effectiveness | Limitation |
|--------|--------------|------------|
| Thermal camera | Excellent | Only passive sensor that can visualize jet exhaust boundaries |
| LiDAR | Poor | Jet exhaust is invisible to LiDAR; vibration from blast degrades readings |
| Camera | Poor | Exhaust shimmer visible but not reliably detectable |
| Radar | Fair | May detect velocity changes in blast zone particles |
| IMU/accelerometer | Good (reactive) | Detects blast force after exposure begins -- too late for avoidance |

**Mitigation:**
- Aircraft state monitoring via ADS-B, MLAT, or airport A-CDM feed (engine start notification)
- Rotating beacon detection (beacon ON = engines running or about to start)
- Thermal camera for exhaust plume boundary detection
- Predictive blast zone overlay on occupancy grid based on aircraft type and engine state
- Hard geofence: AV may not enter computed blast zone under any circumstances
- Wind direction and speed integration to model blast deflection

**Residual risk:** Unannounced engine start (pilot deviation from procedure). Mitigated by rotating beacon detection and thermal sensing.

### 6.6 H5: FOD Creation

**Description:** AV drops cargo, loses vehicle parts, or creates debris that becomes Foreign Object Debris hazardous to aircraft.

**Triggering conditions:**
- Baggage/cargo shifts on dolly during transit or turn
- Dolly latch failure allows container to slide off
- Vehicle component detaches (wheel cover, mirror, antenna)
- AV drives over and scatters existing FOD (amplification)

**Severity:** FOD costs the aviation industry USD 4 billion annually (Boeing estimate). A single damaged engine fan blade can cost USD 50,000+. 55% of all FOD is discovered in stand/apron areas. Catastrophic engine failure from FOD ingestion can cause hull loss.

**Frequency estimate:** Context-dependent. Higher risk with loaded dollies, on turns, and on rough surfaces.

**Sensor coverage:** Rear-facing cameras can detect dropped items; accelerometers detect dolly latch failure. Self-monitoring of vehicle integrity via BIT (built-in test).

**Mitigation:**
- Dolly latch status monitoring (sensor on latch mechanism)
- Rear-facing camera with dropped-object detection
- Pre-trip vehicle inspection (automated visual check)
- FOD detection on path ahead (LiDAR anomaly detection, see [fod-and-jetblast.md](../airside/fod-and-jetblast.md))
- Speed limits on turns when loaded

**Residual risk:** Small items (single baggage tag, plastic wrap) not detectable by vehicle sensors. Mitigated by periodic FOD sweeps and infrastructure FOD detection systems.

### 6.7 H6: Runway/Taxiway Incursion

**Description:** AV enters an active runway or taxiway without authorization, creating collision risk with aircraft.

**Triggering conditions:**
- Localization failure places AV on wrong side of hold-short line
- Path planning error routes AV across taxiway without clearance
- AV follows another GSE vehicle that has clearance (unauthorized following)
- Map error: hold-short line position incorrect in HD map
- GPS multipath/spoofing near terminal places AV on taxiway

**Severity:** Catastrophic. Aircraft-vehicle collision on taxiway or runway at aircraft taxi speed (15-30 kt) would likely result in fatalities and major aircraft damage. FAA FY2023: 32 incursions per 1 million operations. Vehicle/Pedestrian Deviations (VPDs) are one of three incursion categories. Category A (most severe) incursions involve immediate collision risk.

**Frequency estimate:** FAA FY2024: 9 serious (Category A/B) runway incursions total (all causes), down 59% from 22 in FY2023. VPDs represent approximately 19% of all runway incursions. For airside AVs, taxiway crossings are the primary risk -- no AV should ever operate on a runway.

**Sensor coverage:**
| Sensor | Effectiveness | Limitation |
|--------|--------------|------------|
| GPS/GNSS | Good (open areas) | Multipath near buildings; 2-10 m error possible |
| LiDAR SLAM | Good | Provides independent position check |
| Camera (sign/marking recognition) | Good (day) | Hold-short markings may be worn or obscured |
| ADS-B/MLAT (infrastructure) | Excellent | Provides aircraft positions; AV can check for conflict |

**Mitigation:**
- Multi-source localization: GPS + LiDAR SLAM + wheel odometry (GTSAM fusion, current Aurrigo approach)
- Geofence hard limits: AV physically cannot cross hold-short lines without explicit clearance signal from airport system
- Hold-short line detection via camera and map cross-reference
- ADS-B/MLAT aircraft position feed: AV checks for aircraft on taxiway before crossing
- If localization confidence drops below threshold, AV stops immediately

**Residual risk:** Simultaneous localization failure across all sources (GPS + SLAM + odometry). Probability: extremely low (~10^-9 per hour with independent failure modes). Mitigated by immediate stop on any single-source disagreement.

### 6.8 H7: Fuel Spill Zone Entry

**Description:** AV enters an area where jet fuel (Jet A/A-1) has spilled, creating fire/explosion risk from vehicle electrical systems or friction sparks.

**Triggering conditions:**
- Fuel hose leak or disconnection during refueling
- Wing vent spill (>95% of fuel spills at Phoenix Sky Harbor)
- Fuel truck collision spilling fuel on apron
- AV not informed of fuel spill location

**Severity:** Jet fuel (Jet A) flash point: 38C (100F). Below this temperature, spilled fuel does not easily ignite. Above this temperature (common on hot aprons), vapor-air mixture is flammable. A vehicle's electrical system, ESD, or friction spark could ignite vapors. Consequence: fire/explosion, potential aircraft destruction (>USD 100 million), personnel casualties.

**Sensor coverage:**
| Sensor | Effectiveness | Limitation |
|--------|--------------|------------|
| Camera | Fair | Can detect fuel sheen on wet surface in good lighting |
| LiDAR | Poor | Cannot detect liquid fuel on ground |
| Olfactory sensor | Possible | Hydrocarbon gas detector could detect vapors |
| Infrastructure notification | Best | Airport fuel management system reports spill location |

**Mitigation:**
- Fuel safety zone enforcement: AV maintains minimum 6 m from any active fueling operation
- Infrastructure notification: fuel management system broadcasts spill alerts
- Fuel vapor detector on vehicle (hydrocarbon sensor)
- Camera-based fuel sheen detection (research stage)
- If fuel detected or reported, AV stops and routes around

**Residual risk:** Undetected fuel leak in AV's path. Mitigated by intrinsically safe vehicle electrical design (ATEX/IECEx compliance for vehicles operating in refueling zones).

### 6.9 H8: Aircraft Wingtip Clearance Violation

**Description:** AV or its dolly train passes too close to aircraft wingtip, risking contact.

**Triggering conditions:**
- AV navigating between aircraft at adjacent stands with <7.5 m (25 ft) wingtip separation
- Dolly train tail swing on turn exceeds expected envelope
- Aircraft parked off-center from stand centerline (reduces clearance)
- Wrong aircraft type at stand (larger than expected, e.g., A321neo XLR instead of A320)

**Severity:** Wingtip damage: USD 250,000-2,000,000 depending on extent. Composite wingtip repair can take 2-4 weeks, causing extended aircraft out-of-service costs.

**Frequency estimate:** Wingtip strikes are a subset of the 22,400 annual ground damage incidents. Pushback-related wingtip strikes are specifically documented: multiple incidents of simultaneous pushback from adjacent stands causing tail-to-wingtip contact (SKYbrary records: B737+B737 collision Jan 2018; B767+A320 collision Aug 2017; B767+B737 collision Mar 2018; B787+A350 wingtip-to-stabilizer contact Apr 2024 at Heathrow).

**Sensor coverage:** LiDAR provides precise 3D measurement of wingtip position. Camera provides visual confirmation. Ultrasonic for close-range (<3 m) clearance monitoring.

**Mitigation:**
- HD map contains stand geometry with aircraft type-specific clearance envelopes
- Real-time aircraft type identification (from AMS/AODB feed or LiDAR-based classification)
- Minimum 3 m clearance from nearest aircraft surface enforced by planner
- Dolly train articulation model: compute swept path including all dollies before committing to maneuver
- LiDAR-based wingtip position detection overrides map-based assumptions

**Residual risk:** Aircraft parked with gear failure (lower than expected, wing drooping). Extremely rare; mitigated by LiDAR-based real-time clearance measurement.

---

## 7. Edge Cases and Long-Tail Scenarios

### 7.1 Overview

Edge cases are scenarios that are individually rare (frequency <10^-4 per operating hour) but collectively represent the dominant residual risk after common hazards are mitigated. Per the Pareto principle inverted: the last 1% of scenarios may account for 50% of the remaining safety risk.

### 7.2 Top 20 Edge Cases Ranked by Risk

| Rank | Edge Case | Frequency Estimate | Severity | Risk Score (F x S) | Test Method |
|------|-----------|-------------------|----------|---------------------|-------------|
| 1 | **Simultaneous pushback at adjacent stands with tail sweep into AV path** | 10^-3/hr at busy stands | Aircraft damage + personnel risk | Very High | Simulation + physical (empty aircraft) |
| 2 | **Engine start while AV is within blast zone, no prior notification** | 10^-4/hr | Vehicle overturn, personnel injury | Very High | Simulation only |
| 3 | **Passenger (child) breaks away from group, runs into AV path** | 10^-4/hr at remote stands | Fatality risk | Very High | Simulation + controlled physical (dummy) |
| 4 | **Fuel spill ignition near AV (fire on apron)** | 10^-5/hr | Fire/explosion, catastrophic | Very High | Simulation only |
| 5 | **Bird strike debris field: aircraft hits flock on approach, scatters debris across apron** | 10^-5/hr | FOD damage to AV and other aircraft | High | Simulation only |
| 6 | **Medical emergency: ground crew collapses in AV path** | 10^-4/hr | Fatality if run over | High | Simulation + dummy test |
| 7 | **Aircraft tire blowout during taxi near AV** | 10^-5/hr | Debris projectile, AV damage | High | Simulation only |
| 8 | **Marshaller giving incorrect/contradictory signals** | 10^-3/hr | AV enters wrong zone, collision | High | Simulation + physical (staged) |
| 9 | **GPS spoofing/interference causing localization jump** | 10^-5/hr | Taxiway incursion | High | Injection test (simulated GPS) |
| 10 | **De-icing spray coats all LiDAR and camera lenses simultaneously** | 10^-4/hr (winter) | Complete sensor blindness | High | Controlled spray test |
| 11 | **Two AV units assigned to same stand simultaneously** | 10^-4/hr | AV-AV collision | Medium-High | Fleet simulation + physical test |
| 12 | **Power failure at night: apron lights off, AV loses infrastructure feeds** | 10^-5/hr | Navigation in darkness, no V2I | Medium-High | Controlled blackout test |
| 13 | **Heavy cargo shifts during transit, changing AV center of gravity** | 10^-3/hr | Rollover on turn, loss of steering | Medium-High | Physical test with instrumented load |
| 14 | **Standing water pool on apron reflecting LiDAR (phantom ground plane)** | 10^-3/hr (rain) | False obstacle / navigation error | Medium | Physical test in rain |
| 15 | **Jet fuel vapor cloud drifts over AV (fuel truck overflows nearby)** | 10^-5/hr | Vapor ignition risk from AV electronics | Medium | Simulation only |
| 16 | **Aircraft door opens unexpectedly (maintenance, passenger attempt)** | 10^-4/hr | Changing aircraft envelope, personnel emerging | Medium | Simulation |
| 17 | **Construction zone on apron: barriers, excavation, new routing** | 10^-3/hr | Map mismatch, unexpected obstacles | Medium | Physical test with barrier setup |
| 18 | **Wildlife incursion: large bird (goose/heron) on apron** | 10^-3/hr | Collision, FOD if AV strikes bird | Medium | Simulation + decoy test |
| 19 | **Dolly wheel failure (flat tire/axle break) during transit** | 10^-4/hr | Dolly drags, creates FOD, AV pulls to one side | Medium | Physical test with controlled failure |
| 20 | **Cybersecurity: spoofed command to AV via compromised airport network** | 10^-6/hr | AV diverted to unsafe area | Medium | Penetration testing, see [cybersecurity-airside-av.md](cybersecurity-airside-av.md) |

### 7.3 Scenario Details for Highest-Risk Edge Cases

**Edge Case 1: Simultaneous adjacent pushback.** At busy airports, adjacent-stand pushback is common. The pushback aircraft's tail describes an arc that sweeps into the adjacent stand area. If an AV is at the adjacent stand, it has limited time (30-60 s) to detect the pushback and either evacuate or hold position within a safe zone. Real incidents: B767+A320 at Delhi (Aug 2017), B767+B737 (Mar 2018), B787+A350 at Heathrow (Apr 2024).

**Edge Case 2: Unannounced engine start.** Standard procedure requires all GSE to clear the safety zone before engine start. However, procedural deviations occur. The rotating beacon (anti-collision light) should activate before engine start, providing a visual cue. Detection: camera-based beacon detection; thermal camera detects intake temperature change; infrastructure A-CDM feed provides departure sequence.

**Edge Case 3: Child passenger on apron.** At remote stands, passengers walk from bus to aircraft stairs. A child breaking away from parents moves unpredictably, is smaller than adult personnel, and may not be wearing any visible clothing. Detection: camera-based pedestrian detection with child classification; thermal camera detects regardless of clothing.

### 7.4 Aviation Safety Database Sources for Frequency Estimation

| Database | Coverage | Access |
|----------|----------|--------|
| **IATA Ground Damage Database** | 180+ airlines, standardized damage reports | IATA members only |
| **FAA Runway Incursion Database** | All US towered airports | Public (faa.gov) |
| **ASRS (Aviation Safety Reporting System)** | Voluntary reports, US | Public (asrs.arc.nasa.gov) |
| **EASA Annual Safety Review** | European operations | Public (easa.europa.eu) |
| **SKYbrary Accident Database** | Global, curated by Eurocontrol | Public (skybrary.aero) |
| **NTSB Aviation Accident Database** | US accident investigations | Public (ntsb.gov) |
| **UK AAIB Reports** | UK accident investigations | Public (gov.uk/aaib-reports) |

### 7.5 Simulation-Only Scenarios

The following scenarios cannot be safely tested on a live airfield and must be validated exclusively in simulation:

1. Fuel fire/explosion on apron
2. Aircraft tire blowout debris
3. Bird strike debris field
4. Full power engine blast exposure
5. Multi-vehicle pile-up on service road
6. Cybersecurity attack compromising AV fleet
7. Catastrophic weather event (microburst, hailstorm)
8. Aircraft structural failure (landing gear collapse at stand)

These scenarios require high-fidelity simulation environments (see [../deployment/simulation-validation-strategy.md] if available) with physics-accurate jet blast modeling, fire/fluid simulation, and multi-agent coordination.

---

## 8. Sensor Coverage Analysis per Scenario

### 8.1 Sensor Capability Matrix

| Scenario | LiDAR | Camera (Visible) | Camera (Thermal) | 4D Radar | Ultrasonic | Infrastructure (V2I) |
|----------|-------|-------------------|-------------------|----------|------------|---------------------|
| **Personnel detection (day)** | Good | Good | Fair | Fair | Good (<3m) | Good |
| **Personnel detection (night)** | Good | Poor (84-88% fail) | Excellent | Fair | Good (<3m) | Good |
| **Personnel crouching** | Marginal | Fair | Good | Poor | Good (<3m) | Fair |
| **Aircraft detection** | Excellent | Good | Good | Good | Good (<3m) | Excellent |
| **GSE detection** | Good | Good | Fair | Good | Fair | Good |
| **Jet blast zone** | Fail | Poor (shimmer only) | Excellent | Fair | Fail | Good (A-CDM) |
| **FOD detection (>10 cm)** | Good (<25m) | Good (day) | Poor | Fair | Fail | Good (Tarsier/FODetect) |
| **FOD detection (<3 cm)** | Fail | Marginal (close) | Fail | Fail | Fail | Good (W-band radar) |
| **Fuel spill** | Fail | Fair (sheen) | Fair | Fail | Fail | Good (fuel system) |
| **Taxiway incursion prevention** | Fair (SLAM) | Fair (markings) | Fail | Fail | Fail | Excellent (ADS-B/MLAT) |
| **Wingtip clearance** | Excellent | Good | Fair | Fair | Excellent (<3m) | Good (stand allocation) |
| **Standing water (reflections)** | Marginal | Fair | Fail | Good | Fail | Fail |
| **Heavy rain** | Degraded (-30-50%) | Degraded | Unaffected | Unaffected | Unaffected | Unaffected |
| **Fog** | Degraded (-30-60%) | Fail (<100m) | Unaffected | Unaffected | Unaffected | Unaffected |
| **Snow/ice on sensors** | Fail (if blocked) | Fail (if blocked) | Fail (if blocked) | Unaffected | Unaffected | Unaffected |
| **Night + rain** | Degraded | Fail | Good | Unaffected | Unaffected | Unaffected |
| **De-icing spray** | Fail (contaminated) | Fail (contaminated) | Fail (contaminated) | Unaffected | Unaffected | Unaffected |

### 8.2 Key Findings

1. **No single sensor modality provides adequate coverage across all scenarios.** Minimum viable sensor suite: LiDAR + camera + 4D radar + thermal camera + ultrasonic.

2. **4D radar should be primary (not backup) for airside.** It is the only vehicle-mounted sensor immune to rain, fog, de-icing spray, and jet exhaust. Continental ARS548 provides 300 m range, 4D point cloud, and Doppler velocity.

3. **Thermal cameras are essential, not optional.** They are the only passive sensor that can detect jet blast boundaries, see personnel at night when hi-vis fails, and operate through fog. Recommended: FLIR Boson 640 (640x512, 60 Hz, USD 3-6K, MIPI CSI-2 for direct Orin integration).

4. **Infrastructure perception (V2I) fills critical gaps.** Fuel spill notification, ADS-B aircraft position, A-CDM departure sequence, and FOD detection from fixed sensors all provide information that vehicle-mounted sensors cannot reliably obtain.

5. **The de-icing scenario is the hardest.** Glycol spray can simultaneously blind LiDAR, camera, and thermal sensors. Only radar and infrastructure feeds remain operational. The AV must stop immediately when spray is detected and wait for clearing. Sensor window heating and cleaning systems are essential for winter operations.

### 8.3 Sensor Fusion Requirements per Phase

| Phase | Primary Sensors | Secondary Sensors | Infrastructure Feeds |
|-------|----------------|-------------------|---------------------|
| Transit | LiDAR, Camera, Radar | Thermal | GPS, map, ADS-B for taxiway crossings |
| Approach | LiDAR, Camera, Radar, Ultrasonic | Thermal | Stand allocation, aircraft type, VDGS |
| Turnaround | LiDAR, Camera, Thermal, Ultrasonic | Radar | Personnel tracking, turnaround status, fuel zone |
| Pushback | Thermal (jet blast), LiDAR, Camera | Radar, Ultrasonic | A-CDM departure sequence, pushback notification |
| Return | LiDAR, Camera, Radar | Thermal | GPS, map |

---

## 9. Scenario Frequency and Risk Matrix

### 9.1 FMEA-Style Risk Assessment

Risk Priority Number (RPN) = Severity (S) x Occurrence (O) x Detectability (D)

Scales:
- **Severity (S):** 1 = negligible, 2 = minor injury/damage, 5 = serious injury/significant damage, 8 = life-threatening/major damage, 10 = fatality/catastrophic
- **Occurrence (O):** 1 = extremely rare (<10^-6/hr), 2 = rare (10^-5/hr), 3 = uncommon (10^-4/hr), 5 = occasional (10^-3/hr), 7 = frequent (10^-2/hr), 10 = expected (>10^-1/hr)
- **Detectability (D):** 1 = certain detection, 2 = high detection, 3 = moderate detection, 5 = low detection, 8 = very low detection, 10 = undetectable

### 9.2 Risk Priority Number Table

| Rank | Scenario | S | O | D | RPN | Hazard | Phase |
|------|----------|---|---|---|-----|--------|-------|
| 1 | Personnel struck at night during turnaround | 10 | 5 | 5 | 250 | H1 | Turnaround |
| 2 | AV enters jet blast zone, unannounced engine start | 8 | 3 | 5 | 120 | H4 | Pushback |
| 3 | AV contacts aircraft fuselage during positioning | 8 | 5 | 2 | 80 | H2 | Turnaround |
| 4 | Taxiway incursion, aircraft approaching | 10 | 2 | 3 | 60 | H6 | Transit |
| 5 | Personnel crouching in blind spot, AV reverses | 10 | 3 | 5 | 150 | H1 | Turnaround |
| 6 | Adjacent pushback sweeps into AV position | 8 | 3 | 3 | 72 | H2 | Pushback |
| 7 | Fuel spill ignites near AV | 10 | 1 | 5 | 50 | H7 | Turnaround |
| 8 | AV drops baggage container as FOD | 5 | 5 | 3 | 75 | H5 | Transit |
| 9 | AV contacts wingtip navigating between stands | 8 | 3 | 2 | 48 | H8 | Approach |
| 10 | De-icing spray blinds all sensors | 5 | 3 | 8 | 120 | H1-H3 | All (winter) |
| 11 | Child breaks from passenger group | 10 | 3 | 3 | 90 | H1 | Turnaround |
| 12 | AV-AV collision (fleet coordination failure) | 5 | 3 | 2 | 30 | H3 | All |
| 13 | Heavy rain degrades LiDAR + camera simultaneously | 5 | 5 | 3 | 75 | H1-H3 | All |
| 14 | GPS spoofing/interference | 8 | 2 | 5 | 80 | H6 | Transit |
| 15 | GSE reverses into AV from behind | 5 | 5 | 3 | 75 | H3 | Turnaround |

### 9.3 Risk Reduction Targets

For certification under ISO 3691-4, safety functions must achieve Performance Level d (PLd) or higher for personnel protection functions. This corresponds to:

- Probability of dangerous failure per hour: 10^-7 to 10^-6
- Mean time to dangerous failure (MTTFd): high (30-100 years per component)
- Diagnostic coverage: 99%+
- Category 3 or 4 architecture (redundant with diagnostic monitoring)

The Simplex architecture (production stack as safety baseline + experimental neural stack) inherently provides Category 3 by offering a verified backup controller. See [simplex-safety-architecture.md](simplex-safety-architecture.md).

### 9.4 Top 10 Highest-Risk Scenarios After Mitigation

After applying the mitigations described in Section 6, the residual risk ranking shifts:

| Rank | Scenario | Residual Risk | Limiting Factor |
|------|----------|---------------|-----------------|
| 1 | Personnel in complete sensor shadow (behind aircraft gear) | Medium | No sensor can see around solid obstructions |
| 2 | De-icing spray simultaneous sensor blindness | Medium | Only radar remains; limited resolution |
| 3 | Unannounced engine start in blast zone | Medium | Requires infrastructure notification; sensor detection is reactive |
| 4 | Fuel vapor ignition from AV electronics | Low-Medium | Requires ATEX-rated electrical design |
| 5 | Child running from passenger group at night | Low-Medium | Thermal camera helps but small fast targets are challenging |
| 6 | GPS spoofing causing localization failure | Low-Medium | Multi-source fusion mitigates but coordinated attack possible |
| 7 | Construction zone with no map update | Low-Medium | Camera-based barrier detection helps |
| 8 | Adjacent pushback with simultaneous engine start | Low-Medium | Compound event; each component mitigated individually |
| 9 | Heavy cargo shift causing AV rollover | Low | Load monitoring sensors; speed limits on turns |
| 10 | Cybersecurity attack on fleet management | Low | Network segmentation; vehicle-level authentication |

---

## 10. Testing Strategy per Scenario

### 10.1 Test Method Classification

| Method | Applicable Scenarios | Advantages | Limitations |
|--------|---------------------|------------|------------|
| **Physical test (real vehicle, real airport)** | Common scenarios, nominal operations, sensor performance | Highest fidelity; validates real hardware | Expensive; limited repetitions; cannot test dangerous scenarios |
| **Physical test (closed course)** | Pedestrian detection (dummy), emergency stop, obstacle avoidance | Safe, repeatable; hardware in loop | May not represent full airport complexity |
| **Hardware-in-the-loop (HiL)** | Sensor injection, compute timing, actuator response | Tests real compute stack; repeatable | Requires sensor simulation fidelity |
| **Software-in-the-loop (SiL)** | All scenarios; especially long-tail edge cases | Unlimited scenarios; statistical coverage | Simulation fidelity gap; no hardware validation |
| **Replay testing** | Historical scenarios from recorded data | Uses real sensor data; regression testing | Cannot test unobserved scenarios |
| **Fleet shadow mode** | All scenarios encountered in operation | Real-world coverage; no safety risk (shadow does not control) | Cannot test response to scenarios; only detection |

### 10.2 Minimum Test Repetitions

Statistical confidence for safety-critical functions requires sufficient test repetitions to demonstrate failure rates below the target probability:

For a target failure rate of p = 10^-6 per hour with 95% confidence:
- Required test hours without failure: N = -ln(0.05) / p = 3,000,000 hours
- This is infeasible with physical testing alone (342 years of continuous operation)
- Therefore: simulation must provide the bulk of evidence, with physical testing validating simulation fidelity

**Practical approach (based on TractEasy precedent of 1-6 years per airport approval):**

| Test Type | Minimum Volume | Purpose |
|-----------|----------------|---------|
| Physical on-airport | 10,000 km or 2,000 hours without safety-critical incident | Demonstrates nominal performance |
| Physical closed-course | 500 test runs per critical scenario (e.g., pedestrian emergency stop) | Validates reaction time, stopping distance |
| SiL simulation | 10,000,000 scenario-km covering full taxonomy | Statistical coverage of long-tail scenarios |
| HiL testing | 1,000 hours per sensor modality in degraded conditions | Validates degradation detection |
| Shadow mode | 50,000 km minimum before autonomous operation | Validates perception and planning without risk |

### 10.3 Scenario-to-Test Mapping

| Scenario Category | Physical (Airport) | Physical (Closed) | HiL | SiL | Shadow | Replay |
|-------------------|-------------------|-------------------|-----|-----|--------|--------|
| Nominal transit | Yes | Yes | Yes | Yes | Yes | Yes |
| Nominal approach | Yes | Yes | Yes | Yes | Yes | Yes |
| Nominal turnaround | Yes | Limited | Yes | Yes | Yes | Yes |
| Personnel detection (day) | Yes | Yes (dummy) | Yes | Yes | Yes | Yes |
| Personnel detection (night) | Yes | Yes (dummy) | Yes | Yes | Yes | Yes |
| Emergency stop | Yes | Yes | Yes | Yes | N/A | Yes |
| Jet blast avoidance | No | Limited | Yes | Yes | Yes | No |
| FOD detection | Yes | Yes (placed objects) | Yes | Yes | Yes | Yes |
| Taxiway crossing | Yes (supervised) | No | Yes | Yes | Yes | Yes |
| Fuel spill response | No | No | Yes | Yes | N/A | No |
| Rain/fog operation | Yes (opportunistic) | No | Yes | Yes | Yes | Yes |
| De-icing spray | No | Yes (controlled) | Yes | Yes | No | No |
| Adjacent pushback | No | No | Yes | Yes | Yes | No |
| Engine start blast | No | No | Yes | Yes | Yes | No |
| Emergency vehicle yield | No | Yes (staged) | Yes | Yes | Yes | No |
| Multi-AV coordination | Yes (supervised) | Yes | Yes | Yes | Yes | No |

### 10.4 Scenario Database Format

For systematic scenario management, we recommend adapting OpenSCENARIO DSL (formerly OpenSCENARIO 2.0) for airside scenarios. OpenSCENARIO DSL provides a domain-specific language for defining abstract, logical, and concrete scenarios with constraint-based parameter variation.

**Airside-specific extensions required:**

```
// Airside ODD extensions for OpenSCENARIO DSL

type airside_zone: enum of [apron, service_road, taxiway_crossing, 
                             depot, maintenance_area]

type aircraft_state: enum of [parked_engines_off, parked_apu_on,
                               engines_starting, taxiing_in, 
                               taxiing_out, pushback]

type turnaround_phase: enum of [arrival, unloading, servicing,
                                 loading, departure_prep, pushback]

type gse_type: enum of [baggage_tractor, belt_loader, container_loader,
                         catering_truck, fuel_truck, pushback_tug,
                         gpu, pca, lavatory_truck, water_truck,
                         passenger_stairs, deicing_truck, follow_me]

struct airside_scenario:
    zone: airside_zone
    weather: weather_condition
    lighting: lighting_condition
    aircraft: list of (aircraft_type, aircraft_state)
    gse: list of (gse_type, position, velocity)
    personnel: list of (personnel_type, position, activity)
    ego: ego_vehicle_state
    event: optional airside_event
```

This format enables automated generation of concrete test scenarios from abstract scenario definitions, with coverage tracking against the taxonomy dimensions defined in Section 2.

### 10.5 Regression Test Suite Design

The regression test suite should include:

1. **Golden scenarios (fixed):** 100 concrete scenarios covering each hazard at least 5 times with varying environmental conditions. These never change and provide a consistent safety baseline across software releases.

2. **Parameterized sweep (automated):** For each of the 8 hazard categories, generate 1,000 concrete scenarios by sampling from the logical scenario parameter space. Re-run on every build.

3. **Adversarial scenarios (evolving):** Generated by adversarial scenario search (e.g., Bayesian optimization over scenario parameters to find configurations that cause failures). Add discovered failure scenarios to the golden set permanently.

4. **Field-discovered scenarios (growing):** Every safety-relevant event from fleet operation (shadow mode or autonomous) is converted to a replay test case and added to the regression suite.

---

## 11. Regulatory Mapping

### 11.1 ISO 3691-4 Scenario Requirements

ISO 3691-4:2023 Annex B provides a hazard list for driverless industrial trucks. Mapping to our taxonomy:

| ISO 3691-4 Hazard | Our Taxonomy | Coverage |
|-------------------|-------------|----------|
| Collision with persons (Clause 4.3.1) | H1 | Full |
| Collision with obstacles (Clause 4.3.2) | H2, H3, H8 | Full |
| Uncontrolled movement (Clause 4.3.3) | H4 (blast-induced), H5 (cargo shift) | Partial -- standard does not specifically address jet blast |
| Hazardous zone entry (Clause 4.3.4) | H6, H7 | Partial -- standard addresses general zones, not aviation-specific |
| Electrical hazard (Clause 4.4) | H7 (fuel ignition from electrical) | Partial |
| Environmental conditions (Clause 4.5) | Section 4 (full matrix) | Full |

**Gap:** ISO 3691-4 was designed for warehouse/factory environments. It does not specifically address:
- Jet blast hazards (H4) -- unique to airport operations
- Runway/taxiway incursion (H6) -- unique to airport operations
- Aircraft-specific clearance requirements (H8)
- De-icing operations
- Fuel spill/fire scenarios specific to aviation fuel
- Wildlife on operating surface
- Emergency vehicle right-of-way at airport speeds

These gaps must be addressed through supplementary safety analysis and will likely be covered by future aviation-specific standards.

### 11.2 FAA Advisory Circular (Anticipated ~2028-2029)

Based on FAA CertAlert 24-02 (non-directive, supports controlled testing) and the regulatory trajectory analysis (see [regulatory-trajectory-deep-dive.md](regulatory-trajectory-deep-dive.md)), the anticipated FAA AC will likely require:

| Expected Requirement | Our Taxonomy Coverage |
|---------------------|-----------------------|
| Operational Design Domain definition | Section 2 (dimensions), Section 3 (phases), Section 4 (environment) |
| Hazard analysis per SOTIF principles | Section 6 (full hazard catalog) |
| Scenario-based testing evidence | Section 10 (test strategy) |
| Edge case identification and mitigation | Section 7 (20 edge cases with mitigations) |
| Sensor performance envelope | Section 8 (sensor coverage matrix) |
| Emergency vehicle interaction | Section 5.5, Section 7 (emergency vehicle yield) |
| Runway/taxiway incursion prevention | H6 (Section 6.7) |

### 11.3 EASA AMC (Anticipated ~2028)

EASA's approach, influenced by the EU Machinery Regulation 2027 (which mandates third-party assessment for AI-based autonomous vehicles) and EU Product Liability Directive 2024/2853 (software/AI as "products" subject to strict liability), will likely impose additional requirements:

| Expected EASA Requirement | Our Taxonomy Coverage |
|---------------------------|-----------------------|
| AI/ML safety assurance (per EU AI Act) | Section 8 (sensor/ML limitations), Section 10 (test coverage) |
| Third-party conformity assessment | Section 10 (provides assessor with structured evidence) |
| Continuous safety monitoring | Section 10.5 (regression suite, field-discovered scenarios) |
| Environmental robustness evidence | Section 4 (full environmental matrix) |

### 11.4 ISO/SAE Standards (Anticipated ~2029-2030)

An ISO or SAE standard specifically for autonomous GSE in airport environments is anticipated. This taxonomy is designed to be forward-compatible with such a standard. Key areas that a future standard will need to address:

| Area | Current Gap | This Document's Contribution |
|------|-------------|------------------------------|
| Airport-specific ODD definition | No standard defines airside ODD | Section 2 provides dimension framework |
| Turnaround coordination requirements | Not addressed in any vehicle standard | Section 3.3 defines turnaround phase scenarios |
| Jet blast safety | Not addressed in any vehicle standard | Section 6.5 provides blast zone models |
| Aviation fuel safety zones | Addressed in IATA IGOM but not in vehicle standards | Section 6.8 maps fuel zone requirements |
| Multi-AV fleet coordination | Emerging topic in ISO 3691-4 revision | Section 7 addresses fleet coordination edge cases |

### 11.5 Regulatory Scenario Coverage Summary

| Scenario Category | ISO 3691-4 | FAA AC (predicted) | EASA AMC (predicted) | ISO/SAE (predicted) |
|-------------------|-----------|-------------------|---------------------|---------------------|
| Personnel collision | Required | Required | Required | Required |
| Aircraft collision | Partial | Required | Required | Required |
| GSE collision | Required | Required | Required | Required |
| Jet blast | Not covered | Required | Required | Required |
| FOD creation | Not covered | Likely required | Likely required | Required |
| Taxiway incursion | Not covered | Required | Required | Required |
| Fuel spill zone | Not covered | Required | Required | Required |
| Wingtip clearance | Not covered | Required | Required | Required |
| Weather degradation | General | Detailed | Detailed | Detailed |
| Night operations | General | Detailed | Detailed | Detailed |
| Emergency vehicle | Not covered | Required | Required | Required |
| Cybersecurity | Not covered | Likely required | Required (EU CRA) | Likely required |
| AI/ML assurance | Not covered | Likely required | Required (EU AI Act) | Likely required |

---

## 12. References

### Standards

1. ISO 34502:2022 -- Road vehicles -- Test scenarios for automated driving systems -- Scenario based safety evaluation framework
2. ISO 21448:2022 -- Road vehicles -- Safety of the intended functionality (SOTIF)
3. ISO 3691-4:2023 -- Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks and their systems
4. ISO 12100:2010 -- Safety of machinery -- General principles for design -- Risk assessment and risk reduction
5. ISO 13849-1:2023 -- Safety of machinery -- Safety-related parts of control systems -- Part 1: General principles for design
6. IEC 62998-1:2019 -- Safety of machinery -- Safety-related sensors used for the protection of persons

### Aviation Safety Data

7. IATA Ground Operations Safety Program. https://www.iata.org/en/programs/ops-infra/ground-operations/safety/
8. IATA Ground Damage Database -- ground damage frequency: 0.6-0.75 per 1,000 departures, 22,400 damages/year
9. Flight Safety Foundation -- Ground Accident Prevention (GAP). https://flightsafety.org/toolkits-resources/past-safety-initiatives/ground-accident-prevention-gap/
10. FAA Runway Safety Statistics. https://www.faa.gov/airports/runway_safety/statistics
11. FAA Report to Congress: Injuries and Fatalities of Workers Struck by Vehicles. https://www.faa.gov/sites/faa.gov/files/airports/resources/publications/reports/vehicle_injuries.pdf
12. EASA Annual Safety Review 2024. https://www.easa.europa.eu/en/document-library/general-publications/annual-safety-review-2024
13. SKYbrary -- Ground Collision. https://skybrary.aero/articles/ground-collision
14. SKYbrary -- Wingtip Clearance Hazard. https://skybrary.aero/articles/wingtip-clearance-hazard
15. SKYbrary -- Pushback. https://skybrary.aero/articles/pushback
16. NASA ASRS -- Ramp Safety. https://asrs.arc.nasa.gov/publications/directline/dl8_ramp.htm
17. NASA ASRS -- Ground Jet Blast Hazard. https://asrs.arc.nasa.gov/publications/directline/dl6_blast.htm

### Cost Data

18. IATA: Annual cost of ground damage could reach $10 billion -- https://simpleflying.com/iata-cost-of-ground-damage-aircraft-10-billion/
19. Boeing FOD cost estimate: $4 billion annually -- https://www.fodcontrol.com/what-is-fod/
20. Aviation Pros -- The Costs of Ground Damage. https://www.aviationpros.com/aircraft-maintenance-technology/aircraft-technology/maintenance-providers/article/21279424/the-costs-of-ground-damage
21. Global Aerospace -- Rising Trends in Ground Incidents. https://www.global-aero.com/from-the-hangar-to-the-tarmac-rising-trends-in-ground-incidents/

### Incident Reports

22. NTSB -- Ground crew injuries and fatalities in U.S. commercial aviation, 1983-2004
23. FAA Runway Incursion Mitigation FY2024 Annual Summary Report. https://www.airporttech.tc.faa.gov/Products/Airport-Safety-Papers-Publications/Airport-Safety-Detail/runway-incursion-mitigation-fiscal-year-2024-annual-summary-report
24. SKYbrary -- Accident and Serious Incident Reports: GND. https://www.skybrary.aero/index.php/Accident_and_Serious_Incident_Reports:_GND
25. CBS News -- Airline worker engine ingestion incidents (2022-2023). https://www.cbsnews.com/news/airline-worker-died-sucked-into-plane-engine-ntsb-report/

### Jet Blast and FOD

26. IATA Ground Injury Prevention Program -- Engine Danger Areas (June 2024). https://www.iata.org/contentassets/f135f60f52e9495d9a6bb09aab8e39e7/engine-danger-areas.pdf
27. SKYbrary -- Jet Efflux Hazard. https://skybrary.aero/articles/jet-efflux-hazard
28. FAA AC 150/5220-24 -- FOD Detection Equipment
29. FAA -- Foreign Object Debris Detection System Cost-Benefit Analysis. https://rosap.ntl.bts.gov/view/dot/67541

### Airside AV Deployments

30. Changi Airport autonomous tractor deployment (Jan 2026) -- UISEE. https://www.uisee.com/en/article226-cases1.html
31. TractEasy (EasyMile/TLD) -- https://tracteasy.com/
32. EasyMile Safety Report 2023. https://easymile.com/sites/default/files/easymile_safety_report_2023_1.pdf

### Scenario and Test Standards

33. ASAM OpenSCENARIO DSL. https://www.asam.net/standards/detail/openscenario-dsl/
34. OpenSCENARIO V2.0 Concept Paper. https://releases.asam.net/OpenSCENARIO/2.0-concepts/ASAM_OpenSCENARIO_2-0_Concept_Paper.html

### Apron Design and Operations

35. ICAO Annex 14, Vol I -- Aerodrome Design and Operations
36. FAA AC 150/5300-13A -- Airport Design
37. FAA AC 150/5210-20 -- Ground Vehicle Operations on Airports
38. ICAO Airport Services Manual (Doc 9137) -- Part 8: Airport Operational Services
39. IATA Airport Handling Manual (AHM), 46th Edition (2026)
40. IATA Ground Operations Manual (IGOM), 14th Edition (2026)
