# Ground Crew and Pedestrian Safety for Autonomous Airside Vehicles

> The most critical safety concern in airside autonomy. Ground crew work in close proximity to moving vehicles, often under time pressure, in poor visibility, and with significant noise masking. Any autonomous vehicle operating on the apron must exceed human driver safety performance for personnel protection or it will never achieve regulatory approval or industry acceptance.

---

## 1. The Scale of the Problem: Airport Ramp Accident Statistics

### 1.1 Global Accident Numbers

The Flight Safety Foundation and IATA estimate that **27,000 ramp accidents and incidents occur worldwide every year** -- one per 1,000 departures -- resulting in approximately **243,000 injuries** (9 injuries per 1,000 departures). The annual cost to the industry is **at least US$10 billion** in schedule disruption, out-of-service aircraft, and employee medical treatment.

To put the financial impact in perspective: worldwide, the dollar equivalent of **fifteen Boeing 747-400s is lost each year** to equipment damage during ramp operations alone. With airline insurance deductible limits between $500,000 and $1 million, **insurance does not cover over 90% of the cost** of these accidents.

Sources:
- [Flight Safety Foundation -- Ground Accident Prevention (GAP)](https://flightsafety.org/toolkits-resources/past-safety-initiatives/ground-accident-prevention-gap/)
- [IATA -- Ground Ops Safety](https://www.iata.org/en/programs/ops-infra/ground-operations/safety/)

### 1.2 GSE as the Primary Cause

Ground Support Equipment operations are the **dominant cause of aircraft ground damage**:

| Damage Category | Percentage |
|---|---|
| Belt-loaders, cargo-loaders, passenger stairs, boarding bridges | 40% of total ground damage incidents |
| Aircraft contact with GSE/ground vehicles | 26% |
| Aircraft towing/pushback | 25% |
| Aircraft contact with immovable objects (buildings, light posts) | 15% |
| Aircraft-to-aircraft contact | 10% |

The widebody aircraft ground damage rate is **10x higher than narrowbody aircraft**, with 35 incidents per 10,000 departures vs. the industry average of 6.2. The 2022 IATA Ground Damage Report warns that without proactive intervention, annual ground damage costs could **double to nearly $10 billion by 2035**.

According to McLarens (global loss-adjusting company), **64% of worldwide aviation incidents** (excluding light aircraft) occurred on the ground in 2023.

The injury rate to employees of scheduled airlines is **3.5 times worse than among miners**, and the vast majority of airline workers' injuries occur on the airside.

Sources:
- [IATA Enhanced GSE Recognition Program](https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/what-you-need-to-know-about-the-iata-enhanced-gse-recognition-program/)
- [Global Aerospace -- Rising Trends in Ground Incidents](https://www.global-aero.com/from-the-hangar-to-the-tarmac-rising-trends-in-ground-incidents/)
- [IATA Ground Ops Safety](https://www.iata.org/en/programs/ops-infra/ground-operations/safety/)

### 1.3 Ground Crew Fatalities

An NTSB study covering 1983-2004 recorded **80 ground crew accidents** involving commercial aircraft, at a rate of 0.47 per million departures. Of these:
- **26% resulted in ground crew fatalities**
- **43%** were collisions between aircraft and ground vehicles
- **34%** involved moving aircraft equipment (propellers, nose gear)
- **11%** resulted from jet blast or fires

The FAA identified **11 fatal struck-by injuries since 1985**, though only two occurred after 1995, suggesting some improvement.

Sources:
- [PubMed -- Ground crew injuries and fatalities in U.S. commercial aviation, 1983-2004](https://pubmed.ncbi.nlm.nih.gov/16313136/)
- [FAA -- Report to Congress: Injuries and Fatalities of Workers Struck by Vehicles](https://www.faa.gov/sites/faa.gov/files/airports/resources/publications/reports/vehicle_injuries.pdf)

---

## 2. Types of Ground Crew Injuries from GSE

### 2.1 Injury Categories

The most frequently reported injury categories for ramp workers, ranked by frequency:

1. **Slips, trips, and falls** -- over 40% of all ramp personnel accidents (most common)
2. **Struck against object** -- contact with GSE, tow bars, dollies
3. **Lift/carry injuries** -- musculoskeletal disorders from baggage and cargo handling
4. **Push/pull injuries** -- manual handling of equipment and cargo
5. **Falls from height** -- least frequent but **most severe**; from catering trucks, open aircraft doors, belt loaders, and servicing equipment

### 2.2 GSE-Specific Struck-By and Run-Over Scenarios

The most relevant injury types for autonomous vehicle safety are:

- **Struck-by moving GSE**: Worker on foot hit by baggage tractor, tug, belt loader, or pushback tug. Often occurs in blind spots or when vehicles reverse. These are the scenarios autonomous vehicles must eliminate entirely.
- **Run-over/crush**: Worker trapped between GSE and aircraft, between two pieces of GSE, or run over by a tow tractor towing dollies. Dolly trains create extended blind zones behind the towing vehicle.
- **Crushing/pinch-point injuries**: Worker caught between docking GSE (loaders, bridges) and aircraft fuselage. IATA has introduced "no-touch zones" and mandatory brake checks in IGOM updates to address these.
- **Reversing incidents**: GSE backing into personnel. Particularly dangerous with large equipment where the driver has limited rear visibility.

### 2.3 Contributing Factors

- **Time pressure**: Turnaround times of 25-45 minutes create urgency that overrides caution
- **Noise**: Jet engines, APUs, and GSE engines mask auditory warnings
- **Poor visibility**: Night operations, rain, jet blast heat shimmer, glare from aircraft lighting
- **Congestion**: Up to 10-15 different GSE vehicles servicing a single aircraft simultaneously
- **Fatigue**: Shift work, often in extreme heat or cold conditions
- **Post-pandemic workforce shortages**: Less experienced labor entering the workforce

Sources:
- [PubMed -- Common accidents among airport ground personnel](https://pubmed.ncbi.nlm.nih.gov/8747615/)
- [HSE -- Air Transport Safety Topics](https://www.hse.gov.uk/airtransport/index.htm)
- [Improving Ground Safety While Cutting Costs](https://jetwhine.com/2025/10/improving-ground-safety-while-cutting-costs-practical-innovations-for-airports-and-fbos/)

---

## 3. Regulatory Framework: OSHA, HSE, FAA, CAAS, and IATA

### 3.1 United States: OSHA and FAA Jurisdiction

Jurisdiction over airport ramp safety is **split and sometimes ambiguous** between OSHA and the FAA:

- **OSHA** has primary jurisdiction over ground personnel workplace safety (cargo handlers, fuelers, loaders, caterers, marshallers, maintenance workers) unless the FAA exercises jurisdiction over a specific function
- **FAA** regulates certificated entities (airlines, pilots, mechanics, repair stations) and can indirectly control contractors through requirements that flow down from airlines
- There is **no general industry exemption from OSHA** workplace standards for airport ground workers
- A 2000 FAA-OSHA MOU established coordination, but **neither MOU addressed ground personnel jurisdiction directly**

**Key OSHA standards applicable to ramp operations:**
- Hazard communication
- Bloodborne pathogens
- Noise exposure
- Baggage Tug and Carts Fact Sheet (hazard identification and solutions)
- Belt loader safety guidance
- Fall protection (1910.29)

**Key FAA guidance:**
- AC 150/5210-20: Ground Vehicle Operations on Airports
- FAA Guide to Ground Vehicle Operations
- CertAlert 24-02: Autonomous Ground Vehicle Systems (AGVS) Technology on Airports (Feb 2024)
- Emerging Entrants Bulletin 25-02: Testing AGVS at Federally Obligated Airports (May 2025)

Sources:
- [Adams and Reese -- Airport Ramp Safety: FAA or OSHA Jurisdiction?](https://www.adamsandreese.com/liftoff/workplace-safety-on-the-airport-ramp-faa-or-osha-jurisdiction)
- [OSHA Airline Ground Safety Panel](https://www.osha.gov/alliances/airline-group/airline-group)
- [FAA -- AGVS on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)

### 3.2 United Kingdom: HSE and CAA

- **HSE** enforces health and safety legislation for all work activities in Great Britain, including airport operations
- **HSE and CAA** have agreed guidelines delineating roles for occupational health and safety in relation to aircraft on the ground and in the air
- **HSG209 Aircraft Turnround** (published 2000) provides guidance on the Management of Health & Safety at Work Regulations 1999
- **HSE Industry Strategy Group (ISG)** comprises airports, airlines, ground handlers, and trade unions -- identifies priority risks including vehicle management
- Key risk areas identified: falls from height (catering vehicles, aircraft doors), musculoskeletal disorders in baggage handling, **vehicle management**, slips/trips/falls
- Heathrow's Operational Safety Instruction (OSI 008) sets detailed requirements for vehicles and equipment airside, including driver training, qualifications, medical fitness, and vehicle standards

Sources:
- [HSE -- Air Transport](https://www.hse.gov.uk/airtransport/index.htm)
- [HSE and CAA](https://www.hse.gov.uk/airtransport/hse-and-caa.htm)
- [Heathrow -- Vehicle and Equipment Airside Requirements](https://www.heathrow.com/content/dam/heathrow/web/common/documents/company/team-heathrow/airside/operational-safety-insttructions/ASDRVE_OSI_008_Vehicle_and_Equipment_Airside_Requirements_v6-1.pdf)

### 3.3 Singapore: CAAS AC 139-7-7

The **Civil Aviation Authority of Singapore (CAAS)** issued **Advisory Circular AC 139-7-7** (10 May 2023) -- the most comprehensive regulatory guidance globally for autonomous vehicles at the airside. This is particularly significant because Singapore's Changi Airport operates the world's most mature autonomous airside vehicle deployment.

**Key requirements from AC 139-7-7:**

**Operations Framework (Section 2):**
- Aerodrome operators must establish a complete AV operations framework covering safety assessment, training, coordination, maintenance, monitoring, and documentation
- Must complement Airport By-Laws and existing airside regulations

**Evaluation and Approval (Section 3):**
- AV system must be safe under fault-free conditions, random hardware/technical faults, AND various environmental/traffic conditions (heavy rain, hot climate, road user behaviour)
- Must evaluate proposed routes considering: vehicular traffic volume, aerodrome operations complexity, weather/visibility, AV size, and operational complexity
- Must justify safety distances and collision avoidance manoeuvres
- Contingency plans required for driving/detection system failures
- AV must obtain vehicle safety inspection from an accredited assessment body
- Required certifications include compliance with **Singapore Technical Reference TR68**

**Personnel Requirements (Section 4):**
- Onboard or remote AV driver must have Airfield Driving Permit
- Must complete manufacturer training program
- Must be assessed competent by the AV developer

**Safety Performance Monitoring (Section 7):**
- Data recorder required, capturing at minimum 2Hz
- Must record: date/time, GPS location, speed, operating mode (manual/autonomous/teleoperation), driver overrides, steering/braking/acceleration data, camera footage (internal and external), weather conditions
- Quarterly safety performance reviews required
- All AV malfunctions and incidents must be reported

**Appendix B -- Performance Requirements for AV Operations at the Airside:**

Speed:
- Must adhere to airside speed limits at all times
- Must adjust speed for crossing pedestrians, road surface, sensor detection capability, and visibility
- Must not collide with any road or airside user

Safety Distance:
- Must maintain pre-determined safety distances from all objects and personnel
- At stop lines, foremost point of AV must not exceed 1.5m from the line
- Must respond proactively to vehicles cutting into its lane

Pedestrian Interactions:
- **Must give way to pedestrians at all crossings**
- Must slow down and prepare to stop if a pedestrian appears from outside field of vision or occlusion
- Must proceed only after confirming the pedestrian has left the road

Hand/Traffic Signals:
- Must detect and respond to hand signals from other road users
- Must respond to Stop/Go boards from traffic works personnel
- Must follow instructions from authorised officers (Airport Group, Emergency Services, Airport Police)

Right of Way:
- Must always yield to aircraft taxiing, on tow, or on pushback
- Must always yield to emergency vehicles

Malfunction:
- Must be able to safe-stop in a parking area or along the kerb

Source: [CAAS AC 139-7-7](https://www.caas.gov.sg/docs/default-source/docs---srg/ac-139-7-7-guidance-on-use-of-autonomous-vehicles-at-the-airside.pdf)

### 3.4 FAA Approach to Autonomous Ground Vehicles

The FAA's current stance (as of 2025) is developmental rather than prescriptive:

- **Supports AGVS testing only in "controlled environments"**: non-movement areas (aprons, gates, parking areas, remote/landside areas)
- **Does not currently consider active movement areas** (runways, taxiways, safety areas) as controlled environments for AGVS testing
- **Requires a human monitor** physically located in/near the AGVS when operating around moving aircraft and airport employees not involved in testing
- Airports must contact regional FAA Airport Certification and Safety Inspector early in planning
- The FAA is "currently exploring various approaches to researching this technology with the intent of developing standards and guidance"

Sources:
- [FAA -- AGVS on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [FAA CertAlert 24-02](https://www.faa.gov/sites/faa.gov/files/arp-part-139-cert-alert-24-02-AV-AVGS.pdf)

### 3.5 IATA Standards

- **IATA Ground Operations Manual (IGOM)**: Standardizes ground handling processes to reduce complexity and drive safety. Includes ramp safety procedures, hand signals (Chapter 3), no-touch zones, mandatory brake checks, safer pushback procedures
- **Enhanced GSE Recognition Program**: Encourages proximity sensors, anti-collision technology, and inching technology on GSE to improve vehicle control and docking accuracy
- **Airside Speed Limits**: Typically **15 mph (24 km/h)** on ramps and taxiways, reduced to **5 mph (8 km/h)** within the "Circle of Safety" around an aircraft

Sources:
- [IATA -- IGOM](https://www.iata.org/en/publications/manuals/iata-ground-operations-manual/)
- [IATA -- Enhanced GSE](https://airlines.iata.org/2022/12/07/enhanced-gse-improve-safety-and-reduce-cost)

---

## 4. Autonomous GSE: Current Deployments and Safety Systems

### 4.1 TractEasy / EasyMile (EZTow)

**Overview:** The most-deployed autonomous tow tractor globally, operating since 2018 across Europe, Asia, and North America. Manufactured by TLD with EasyMile providing the autonomous driving technology.

**Sensor Suite:**
- Multiple LiDARs (redundant coverage)
- Stereo cameras
- Radars
- IMU (Inertial Measurement Unit)
- GPS with centimeter-level precision (RTK)
- Wheel encoders
- 4G/Wi-Fi connectivity
- V2X on-board units

**Safety Architecture:**
- SAE Level 4 autonomous operation
- Redundant obstacle detection function with multi-layer sensor coverage
- Constant self-monitoring of all sensors for correct functioning
- Fail-safe and redundant braking systems
- Anti-collision software integrated with hardware safety chain
- Three response modes to obstacles: adapt speed/trajectory, controlled braking, or emergency stop
- **Localization accuracy: at least 5 cm**
- Maximum speed: 25 km/h
- Maximum towing load: 25 tonnes (EZTow), 20 tonnes (earlier models)

**Key Deployments:**
- Changi Airport (Singapore) -- earliest large-scale airport deployment
- Toulouse-Blagnac Airport -- went fully driverless and extended route
- Kansai International Airport (Japan) -- first Level 4 autonomous baggage towing

Sources:
- [TractEasy](https://tracteasy.com/)
- [EasyMile -- How It Works](https://easymile.com/technology/how-it-works)
- [EasyMile Safety Report 2023](https://easymile.com/sites/default/files/easymile_safety_report_2023_1.pdf)

### 4.2 Aurrigo (Auto-DollyTug, Auto-Cargo, Auto-Dolly)

**Overview:** UK-based company with autonomous airside vehicles now operational at six airports. Recently won a global aviation prize for the Auto-DollyTug.

**Sensor Suite:**
- LiDAR sensors
- 360-degree cameras
- 8 ultrasonic sensors (development platform)
- Sensor fusion combining all inputs into unified perception

**Safety Architecture:**
- **Auto-Stack** autonomous driving software controlling steering, braking, drive power, sensor integration, safety, localization, and navigation
- Obstacle detection with sensor fusion creating a "safety bubble" -- when objects enter this zone, the system determines how to react
- Wheel covers to protect pedestrians from wheel contact
- Safety operator present during testing phases
- 360-degree tank turn capability and sideways drive reduce manoeuvring in tight spaces, reducing collision risk

**Auto-DollyTug Specifications:**
- Carries 1 ULD on board while towing up to 4 ULDs
- Bi-directional robotic arms for autonomous loading/unloading
- End-to-end autonomous solution (world's first)
- Currently testing at Amsterdam Schiphol with KLM

Sources:
- [Aurrigo Aviation](https://aurrigo.com/airport/)
- [Aurrigo Auto-DollyTug Breakthrough](https://aurrigo.com/aurrigos-smart-airside-solution-wins-global-aviation-prize-with-auto-dollytug-breakthrough/)
- [Auto-DollyTug at Schiphol](https://aurrigo.com/auto-dollytug-aims-to-streamline-baggage-transfer-with-schiphol/)

### 4.3 UISEE

**Overview:** Chinese autonomous driving company supplying vehicles to multiple major airports. Uses its fifth-generation **U-Drive** intelligent driving system.

**Sensor Suite:**
- Multiple LiDARs (including Hesai sensors)
- Cameras
- GPS
- Multiple safety protection mechanisms

**Safety Architecture:**
- Capable of 24/7 operation in various weather conditions
- Remote monitoring and teleoperation capability
- Multiple safety protection mechanisms for complex environments and severe weather
- Automated charging, automatic uncoupling

**Key Certifications (for Changi deployment):**
- ISO 21434 Road Vehicle Cybersecurity Process Certification
- ISO 27001 Information Security Management Certification
- Singapore Technical Reference TR68 compliance

**Key Deployments:**
- **Singapore Changi Airport** -- first fully autonomous tractor fleet (2 vehicles live, expanding to 24 by 2027)
- Hong Kong International Airport -- autonomous patrol cars and shuttle buses
- Hamad International Airport (Qatar) -- pilot program

Sources:
- [UISEE -- Autonomous Driving at Airport](https://www.uisee.com/en/solution-airports.html)
- [UISEE -- Changi Airport Partnership](https://www.uisee.com/en/article226-news1.html)
- [Hesai -- UISEE Partnership](https://www.hesaitech.com/how-does-uisee-become-the-ai-driver-of-the-world/)

---

## 5. Pedestrian Detection Technologies

### 5.1 LiDAR-Based Detection

**Detection Range Performance:**

LiDAR detection capability is fundamentally determined by target reflectivity:

| Target Reflectivity | Typical Detection Range |
|---|---|
| 90% (highly reflective) | 750m |
| 40% (moderate) | 500m |
| 10% (dark clothing) | 250m |

For pedestrian-sized targets, practical detection ranges with current automotive LiDAR (e.g., Hesai AT128 at 200m/10% reflectivity, OT128 optimized for autonomous shuttles):
- **Clear conditions**: Reliable detection at 80-150m for pedestrians, depending on clothing
- **Night**: Performance equivalent to daytime -- LiDAR is unaffected by lighting conditions
- **Rain (moderate, <25 mm/h)**: Minimal degradation; range reduction of ~10-15%
- **Rain (heavy, 45 mm/h)**: Maximum recognition distance decreases by approximately **30% (~5m reduction)** from clear-day baseline; range measurements become unreliable (up to 20cm error)
- **Fog (mild to moderate)**: LiDAR maintains reliable detection even when cameras fail at 50m; 7x more optical power density than visible light at 100m
- **Fog (dense)**: Significant degradation, similar to heavy rain

**Key Challenge -- False Positives in Rain:**
Raindrops create phantom detections at short ranges (0-50m), becoming less common at medium ranges (50-100m), but the system simultaneously gets worse at detecting actual objects as rainfall increases. This is a critical design consideration for airside operations where rain is frequent.

Sources:
- [Cepton -- Reading LiDAR Specs](https://www.cepton.com/driving-lidar/reading-lidar-specs-part-i-what-they-do-and-dont-tell-you)
- [PMC -- Empirical Analysis of LiDAR Performance Degradation in Rain and Fog](https://pmc.ncbi.nlm.nih.gov/articles/PMC10051412/)
- [YellowScan -- How Weather Affects LiDAR Performance](https://www.yellowscan.com/knowledge/how-weather-really-affects-lidar-performance/)
- [Hesai AT128](https://www.hesaitech.com/product/at128/)

### 5.2 The Hi-Vis Paradox

A critical finding for airside operations where all personnel wear high-visibility clothing:

**Counterintuitively, reflective high-visibility clothing can degrade camera-based pedestrian detection systems.** IIHS testing found that when pedestrians wore ANSI Class 3 high-visibility clothing:
- During daytime: no negative effect on detection
- At night: some camera-based AEB systems **completely lost detection ability** -- vehicles hit the test dummy in 84-88% of test runs with reflective clothing, while neither vehicle even slowed down when the dummy wore clothing with reflective limb strips

This appears to result from retro-reflective strips saturating camera sensors and confusing classification algorithms trained primarily on non-reflective pedestrian appearances.

**For LiDAR**, high-reflectivity clothing actually increases the number of return points, which should improve detection. However, this has not been extensively validated in airside-specific conditions.

**Implication for airside AV design:** Systems cannot rely solely on camera-based pedestrian detection. LiDAR and thermal sensors are essential complements, particularly at night when all ground crew wear hi-vis.

Sources:
- [The Drive -- Reflective Clothing Could Make You Invisible to Pedestrian Detection Systems](https://www.thedrive.com/news/reflective-clothing-could-make-you-invisible-to-pedestrian-detection-systems-iihs)
- [AAA -- Pedestrian Detection Tech](https://magazine.northeast.aaa.com/daily/newsroom/pedestrian-detection-tech-has-improved-significantly-but-still-isnt-foolproof/)

### 5.3 Thermal/LWIR Camera Detection

Thermal cameras operating in the Long-Wave Infrared (LWIR) spectrum detect body heat rather than reflected light, providing unique advantages:

**Performance characteristics:**
- Detects and classifies pedestrians, vehicles, animals, and cyclists in **complete darkness**
- Sees through sun glare, headlight glare, most fog, dust, smog, and light rain
- Detection range **up to 4x farther than headlights** illuminate in darkness
- Demonstrated **superior performance** over LiDAR and RGB cameras in foggy conditions
- Completely passive sensor -- no emitted signal to interfere with other systems
- Unaffected by sun/headlight glare (a significant issue on reflective apron surfaces)

**Key product: Teledyne FLIR Tura**
- First ASIL-B (Automotive Safety Integrity Level) thermal LWIR camera
- ISO 26262 functional safety compliant
- 640 x 512 resolution far-infrared sensor
- Purpose-built for ADAS and autonomous vehicle night vision

**AEB Testing Results:**
- Thermal-fused AEB systems passed **all FMVSS No. 127 tests** -- day and night
- Three leading 2024-model camera-only AEB systems **failed one or more night testing scenarios**

**Implication for airside operations:** Thermal cameras are arguably the most valuable sensor for airside crew detection. Airport ramps operate 24/7, often in rain and fog. Crew body heat provides a reliable detection signature regardless of clothing, lighting, or weather.

Sources:
- [Teledyne FLIR OEM -- Tura Camera](https://oem.flir.com/about/news/teledyne-flir-oem-debuts-tura-automotive-qualified-thermal-camera-at-ces-for-avs-and-adas/)
- [FLIR -- Thermal Cameras for Safer AEB](https://oem.flir.com/learn/discover/Thermal-Cameras-and-Pedestrian-Detection-and-Automatic-Emergency-Braking-System/)
- [Lynred -- Nighttime Pedestrian Detection](https://www.lynred.com/blog/how-thermal-imaging-contributing-development-new-generation-nighttime-pedestrian-detection)
- [ADASKY](https://www.adasky.com/)

### 5.4 Comparison of Detection Approaches

| Approach | Strengths | Weaknesses | Airside Relevance |
|---|---|---|---|
| **LiDAR clustering (DBSCAN, K-means)** | Simple to implement, no training data needed, real-time capable, lighting-independent | Prone to threshold errors, poor in rain/fog, cannot classify object type, struggles with partial occlusion | Good for initial obstacle detection; insufficient alone for crew safety |
| **LiDAR deep learning (PointPillars, CenterPoint)** | Higher accuracy (F1 ~0.84), can classify pedestrians vs. objects, works at long range (TimePillars to 200m), lighting-independent | Requires large training datasets, pedestrians/cyclists commonly misclassified, reduced point density at range | Best LiDAR approach for crew detection; needs airside-specific training data |
| **Camera deep learning (YOLO, Faster R-CNN)** | High classification accuracy, can identify PPE/uniforms, reads signs and markings, mature technology | Fails in darkness, degraded by rain/glare, **paradoxical failure with hi-vis clothing at night**, requires good lighting | Useful during daylight; unreliable as primary night sensor |
| **Thermal/LWIR camera** | Works in complete darkness, sees through fog/rain/glare, detects body heat regardless of clothing, passive sensor | Lower resolution than RGB, cannot read text/signs, higher cost, limited classification detail | **Highest value for 24/7 airside operations** |
| **Radar (4D imaging)** | Works in all weather, long range, measures velocity directly, penetrates rain/fog | Lower angular resolution, poor at classifying pedestrians, limited height information | Good complement for velocity measurement and all-weather backup |
| **Sensor fusion (LiDAR + camera + thermal + radar)** | Combines strengths of all modalities, redundant detection, highest reliability | System complexity, synchronization challenges, higher cost, more failure modes to manage | **Required approach for safety-critical airside operations** |

Sources:
- [PMC -- Comparison of Pedestrian Detectors for LiDAR](https://pmc.ncbi.nlm.nih.gov/articles/PMC9504167/)
- [MDPI -- Deep Learning-Based Pedestrian Detection in Autonomous Vehicles](https://www.mdpi.com/2079-9292/11/21/3551)
- [Tech Briefs -- Add LiDAR to ADAS for Pedestrian Safety](https://www.techbriefs.com/component/content/article/38630-add-lidar-to-adas-for-pedestrian-safety)

---

## 6. VRU (Vulnerable Road User) Detection Standards

### 6.1 Euro NCAP VRU Protection Protocol

Euro NCAP provides the most mature testing framework for VRU detection, now influencing airside AV design:

**Test scenarios include:**
- Adult pedestrian crossing from driver's side (running)
- Adult pedestrian crossing from passenger's side (walking) -- two test variants
- Child running from between parked vehicles
- Pedestrian walking in same direction as vehicle
- Pedestrian crossing into turning path
- Pedestrian behind reversing vehicle
- Tests performed in **both daylight and darkness**

**Performance requirements:**
- Detection of pedestrians walking as slow as **3 km/h**
- AEB must function across varying speeds and impact angles
- Night testing with low ambient lighting conditions
- Specially designed articulated pedestrian target replicating human walking motion

### 6.2 ISO 3691-4: Driverless Industrial Trucks

The most directly applicable safety standard for autonomous airside vehicles:

- Specifies safety guidelines for AGVs, AMRs, and similar driverless industrial trucks
- Includes **"Test for the Detection of Persons"** to validate obstacle detection
- Safety-Related Parts of Control Systems for Personnel Detection must comply with **ISO 13849-1**
- Defines operating zones with speed limits: **0.3 m/s to 1.2 m/s** depending on zone type
- **Operating zones**: where humans may be present
- **Restricted zones**: where no humans are allowed
- **Key limitation**: does not account for dynamic environments (e.g., detecting personnel while vehicle is turning) -- a significant gap for airside operations

### 6.3 Other Relevant Standards

| Standard | Scope |
|---|---|
| ISO 26262 | Road vehicles -- Functional safety |
| ISO/PAS 21448:2019 | Road vehicles -- Safety of the intended functionality (SOTIF) |
| ISO 21434 | Road vehicle cybersecurity |
| Singapore TR68 | Autonomous vehicles (vehicle behaviour, functional safety, cybersecurity, data formats) |
| IEC 61508 | Functional safety of electrical/electronic/programmable systems |
| ISO 45001 | Occupational health and safety management |
| ANSI/RIA R15.08 | Industrial mobile robots (complementary to ISO 3691-4) |

Sources:
- [Euro NCAP -- VRU Protection](https://www.euroncap.com/en/car-safety/the-ratings-explained/vulnerable-road-user-vru-protection/)
- [Euro NCAP -- AEB Pedestrian](https://www.euroncap.com/en/car-safety/the-ratings-explained/vulnerable-road-user-vru-protection/aeb-pedestrian/)
- [ISO 3691-4 Overview](https://jlcrobotics.com/iso-3691-4/)
- [3Laws -- ISO 3691-4 Explained](https://3laws.io/iso-3691-4-what-it-means-for-your-products/)

---

## 7. PPE Detection: Hi-Vis Vest and Hard Hat Recognition

### 7.1 Current State of the Art

Computer vision systems can now detect personal protective equipment in real-time using deep learning:

**Detection performance (by model):**
- **Faster R-CNN** (fine-tuned): Overall mAP of 77.1%; high-visibility vest detection at **81.5% mAP**, person detection at **86.6% mAP**
- **YOLOv8**: Rapid detection of helmets, vests, and goggles; economical and field-friendly
- **YOLOv7 + ViTPose + InternImage-L**: Modern framework combining worker detection, pose estimation, and PPE recognition -- handles shadows, partial occlusions, and densely grouped workers

**Detection classes typically include:**
- Hard hat / safety helmet (presence and colour)
- High-visibility vest / safety vest
- Safety goggles / eye protection
- Gloves
- Safety boots (less reliable due to occlusion)

### 7.2 Airside Application

For autonomous airside vehicles, PPE detection serves two functions:

1. **Crew identification**: Distinguishing ground crew (hi-vis, hard hat, ear protection) from passengers, visitors, or unauthorized personnel. Different PPE configurations indicate different roles and expected behaviours.

2. **Safety verification**: Confirming that personnel in work zones are properly equipped, which could trigger different AV behaviours (e.g., slower speed around workers without ear protection who may not hear the vehicle).

**Challenges specific to airside:**
- All personnel wear hi-vis, reducing its discriminative value
- Multiple PPE configurations for different roles (marshaller, loader, fueler)
- Ear protection (muffs or plugs) invisible at distance but critical for safety assessment
- Wet/dirty/faded hi-vis in operational conditions

Sources:
- [MDPI -- Personal Protective Equipment Detection](https://www.mdpi.com/2071-1050/15/18/13990)
- [Encord -- PPE Detection Using Computer Vision](https://encord.com/blog/ppe-detection-using-computer-vision/)
- [Protex AI -- Hi-Vis Detection](https://www.protex.ai/glossary/hi-vis-detection)
- [Oxford Academic -- Deep Learning Framework for PPE Monitoring](https://academic.oup.com/jcde/article/10/2/905/7069329)

---

## 8. Behavioral Prediction for Ground Crew

### 8.1 Why Airport Ground Crew Are Different from Road Pedestrians

Ground crew behaviour is fundamentally different from urban pedestrian behaviour, and this matters for prediction models:

**Structured procedures**: Ground crew follow highly procedural workflows:
- **Marshalling**: Standardized hand signals guiding aircraft to parking position; marshaller walks backward toward the aircraft following painted lines
- **Chocking**: Immediately after aircraft stops, designated crew places chocks forward and aft of nose gear -- this requires approaching the aircraft from specific angles
- **Loading/unloading**: Crew positions at belt loader, cargo door, and dolly train in predictable patterns
- **Fueling**: Fueler approaches underwing fuel points following specific paths
- **Pushback**: Crew attaches tow bar and signals for brake release; positions are highly standardized

**Predictable trajectories**: Unlike urban pedestrians who may dart unpredictably, ground crew largely follow:
- Painted taxiway/apron markings
- Equipment approach paths
- Standard operating procedures (SOPs) for each phase of aircraft turnaround
- Defined roles with defined positions relative to the aircraft

**However -- critical exceptions exist:**
- Dropped items requiring quick retrieval
- Equipment malfunctions requiring improvised responses
- Communication breakdowns causing unexpected movements
- Time pressure causing shortcuts through hazard zones
- FOD (Foreign Object Debris) walks requiring ground-level scanning

### 8.2 Activity Recognition and Prediction Technology

**Marshalling Signal Recognition:**
- Convolutional Pose Machine + Random Forest/MLP classifiers can recognize marshalling gestures from video
- Skeleton-based action recognition using graph convolutional networks can classify ground crew actions
- These systems can increase autonomy by allowing AVs to respond to marshaller instructions rather than requiring radio commands

**Turnaround Activity Detection:**
- CNN-based video analytic frameworks can monitor entire aircraft turnaround processes
- Object detection, tracking, activity detection, and push-back prediction
- Can detect which phase of turnaround is active, informing the AV about expected crew positions and movements

**Trajectory Prediction Models:**
- LSTM and GRU-based recurrent neural networks model pedestrian motion sequences
- Social force models combined with decision models anticipate pedestrian-vehicle interactions
- Context-aware models combine past trajectory, local features (individual behaviour), and global features (signs, markings)
- For airside: procedural context (turnaround phase) could dramatically improve prediction accuracy vs. generic pedestrian models

### 8.3 Implications for Airside AV Design

An airside AV with turnaround-phase awareness could:
- Know that a marshaller will be walking backward along a centerline during aircraft arrival
- Predict that crew will approach nose gear area immediately after aircraft stops
- Anticipate belt loader approach paths during loading phase
- Expect fuel truck approach from underwing direction
- Understand that pushback crew will be near the nose wheel area

This is a significant advantage over urban autonomous driving, where pedestrian behaviour is largely unpredictable.

Sources:
- [MDPI -- Adaptive Refined Graph Convolutional Action Recognition for UAV Ground Crew Marshalling](https://www.mdpi.com/2504-446X/9/12/819)
- [ScienceDirect -- Turnaround Control System Using Deep Learning](https://www.sciencedirect.com/science/article/abs/pii/S0952197622002056)
- [Springer -- Real-Time Visual Recognition of Ramp Hand Signals](https://link.springer.com/content/pdf/10.1007/s10846-023-01832-3.pdf)
- [ScienceDirect -- Pedestrian and Vehicle Behaviour Prediction Review](https://www.sciencedirect.com/science/article/pii/S0957417423024855)

---

## 9. Geofencing and Work Zone Management

### 9.1 Geofencing Principles for Airside Operations

Geofencing creates virtual boundaries that constrain or modify autonomous vehicle behaviour:

**Static geofences:**
- Permanent no-go zones (fuel storage areas, terminal buildings, runway safety areas)
- Speed-restricted zones (near gates, in baggage halls)
- Preferred route corridors

**Dynamic geofences:**
- Active aircraft stands (vehicle exclusion during arrival/departure phases)
- Active work zones (fueling operations, maintenance areas)
- Emergency exclusion zones (spill containment, incident response)
- Weather-adaptive zones (reduced operational areas during low visibility)

### 9.2 Implementation for Autonomous Airside Vehicles

**CAAS AC 139-7-7** requires that AV zone markings be painted on the airside at Changi Airport, establishing dedicated vehicle pathways visible to both autonomous systems and human operators.

Key design principles:
- AVs are limited to areas where the operator has properly mapped the environment
- Temporary micro-zones can be created for activities like road repair or construction
- If satellite or cellular connectivity is lost, the AV falls back to onboard mapping within its geofenced area
- 3D geofencing (including height restrictions) prevents entry into areas under elevated equipment

**Airport-specific geofencing requirements:**
- Must integrate with airport operations databases (AODB) to know which stands are active
- Must receive real-time updates as turnaround phases change
- Must create exclusion zones around active fueling operations
- Must expand safety buffers during low-visibility conditions
- Must yield to dynamically created emergency zones

Sources:
- [SKYbrary -- Geofencing Basics](https://skybrary.aero/articles/geofencing-basics)
- [APEX.one -- Geofences for Autonomous Cars](https://www.apex.one/articles/geofences-the-invisible-walls-surrounding-autonomous-cars/)
- [Geotab -- What is Geofencing](https://www.geotab.com/blog/what-is-geofencing/)
- [CAAS AC 139-7-7](https://www.caas.gov.sg/docs/default-source/docs---srg/ac-139-7-7-guidance-on-use-of-autonomous-vehicles-at-the-airside.pdf)

---

## 10. Personal Transponders and Beacons for Crew Detection

### 10.1 UWB-Based Real-Time Location Systems (RTLS)

Ultra-Wideband (UWB) technology offers the highest precision for personnel tracking and can serve as a cooperative detection layer complementing the AV's onboard sensors:

**Technical performance:**
- **Accuracy: 10-30 cm** with live updates every second
- Wearable form factors: wristbands, ID badges, belt clips, helmet-integrated tags
- Tag-to-tag proximity detection with **inch-level precision**
- Can trigger actions based on distance thresholds between AV and personnel

**Safety features:**
- Acoustic, visual, and physical (vibration) alerts on both the vehicle and the personal tag
- Fall detection and lack-of-movement detection can trigger immediate alarms
- Exact position transmitted to a central system for rescue/response
- Works indoors and outdoors (critical for airside where vehicles move between terminal buildings and apron)

**Industrial precedents:**
- Mining: wristband tags communicate directly with vehicles using UWB, triggering proximity warnings
- Construction: RTLS-based proximity warning systems on construction sites reduce accident risk
- Warehousing: forklift collision avoidance systems using UWB tags on pedestrians

### 10.2 Proximity Warning Systems

Purpose-built collision avoidance systems combine vehicle-mounted sensors with personnel-worn tags:

**PROXIMITY PLUS (Ubiquicom):**
- Vehicle-mounted UWB radar detects personal tags
- Creates acoustic-visual alerts on the vehicle
- Creates acoustic-mechanical alarms (vibration) on the personal tag
- Identifies reciprocal position of vehicles, people, and fixed obstacles with extreme precision
- Suitable for safety-relevant environments (factories, warehouses, mines)

**ZoneSafe:**
- UWB-based forklift proximity warning system
- Active wearable tags alert operators and pedestrians when entering the same hazard zone
- Configurable warning zones with multiple distance thresholds

### 10.3 V2P (Vehicle-to-Pedestrian) Communication

C-V2X (Cellular Vehicle-to-Everything) technology extends cooperative detection:

- **Vehicle-to-Pedestrian (V2P)** enables communication between AVs and personnel through wearable devices
- Uses PC5 sidelink interface for direct device-to-device communication (no cellular infrastructure needed)
- Can integrate with smartwatches, purpose-built wearable devices, or smartphone apps
- Enables VRU (Vulnerable Road User) scenario detection for pedestrians and cyclists

### 10.4 Airside-Specific Considerations

**Advantages of cooperative detection for airside:**
- Detects crew even when occluded by equipment (behind a dolly train, inside a cargo hold)
- Provides identification -- knows who is where, enabling role-based safety behaviour
- Works in all weather and lighting conditions
- Can integrate with turnaround management systems to verify expected vs. actual crew positions

**Challenges:**
- Requires 100% compliance -- every person must wear a tag
- Battery life management across shifts
- RF interference from aircraft systems, radar, and communications equipment
- Must not interfere with radio communications and air navigation systems (required by CAAS AC 139-7-7)
- Visitors, contractors, and non-regular personnel must also be tagged

Sources:
- [Ubiquicom -- PROXIMITY PLUS](https://www.ubiquicom.com/en/proximity-plus/)
- [Pozyx UWB RTLS](https://www.pozyx.io/products/pozyx-uwb-rtls)
- [Metratec -- Personnel Safety with RTLS](https://www.metratec.com/applications/rtls/personnel-safety/)
- [PMC -- UWB-Based Proximity Warning System](https://pmc.ncbi.nlm.nih.gov/articles/PMC10747065/)
- [Qualcomm -- C-V2X](https://www.qualcomm.com/products/automotive/c-v2x)

---

## 11. Emergency Braking and Stop Distance

### 11.1 Autonomous Emergency Braking (AEB) Performance

**Reaction time advantages:**
- Computer-controlled AEB systems react in approximately **150 milliseconds** to apply full command pressure
- Human reaction time is typically **1,000 milliseconds** (1 second) -- 6.7x slower
- This difference alone can reduce stopping distance by several meters at typical airside speeds

**At airside speeds (15 mph / 24 km/h):**
- At 24 km/h with 150ms AEB reaction time: ~1m traveled before braking begins
- With emergency deceleration of ~6 m/s^2: additional ~3.6m to stop
- **Total emergency stop distance: approximately 4-5 meters** from detection

**At reduced speed near aircraft (5 mph / 8 km/h):**
- At 8 km/h with 150ms reaction time: ~0.3m traveled before braking
- Emergency braking distance: ~0.4m
- **Total emergency stop distance: approximately 0.7-1.0 meters**

### 11.2 Multi-Stage Deceleration for Airside

Research on improved AEB algorithms for AGVs has produced multi-stage deceleration approaches that:
- Reduce the average emergency stop rate by **42.5%** compared to traditional emergency braking
- Provide smoother deceleration that prevents cargo damage and dolly train jackknifing
- Balance braking smoothness with rapid response to sudden obstructions

**Key challenge for airside:** Tow tractors pulling loaded dolly trains have significantly longer stopping distances due to trailing mass. The inertia of 4 loaded dollies (up to 25 tonnes total) at 24 km/h creates substantial stopping distance even with maximum braking on the tractor.

Sources:
- [PMC -- Improved AEB Algorithm for AGVs](https://pmc.ncbi.nlm.nih.gov/articles/PMC11991318/)
- [Wiley -- Systematic Review of AEB Systems](https://onlinelibrary.wiley.com/doi/10.1155/2022/1188089)
- [Autoware -- Autonomous Emergency Braking](https://autowarefoundation.github.io/autoware_universe/main/control/autoware_autonomous_emergency_braking/)

---

## 12. Case Study: Changi Airport -- 20,000+ km Accident-Free

### 12.1 Program Overview

Singapore Changi Airport has achieved the most advanced autonomous airside vehicle deployment globally, providing the clearest evidence that autonomous vehicles can operate safely among ground crew.

**Timeline:**
- Trials began in 2023 with TractEasy/EasyMile autonomous baggage tractors
- Nearly a year of rigorous trials covering **more than 5,000 test trips**
- Accumulated **over 20,000 km without any safety incidents**
- January 2026: Live deployment of first fully driverless autonomous tractors (UISEE)
- Currently: 2 autonomous tractors operating between Terminal 1 and Terminal 4
- 2026 plan: 6 additional vehicles at Terminal 2
- **2027 target: Fleet of 24 driverless tractors across the airside**

### 12.2 Safety Management Approach

**Technology layer:**
- More than **10 sensors and cameras** on each tractor
- Sensor suite enables safe navigation in all conditions -- day, night, and rain
- Multiple LiDARs and cameras working in coordination
- UISEE U-Drive fifth-generation autonomous driving system

**Operational layer:**
- **Control center monitoring** during all operations
- Remote operator can intervene immediately when human intervention is required
- **Clear AV zone markings** painted on the airside establishing dedicated pathways
- **Clear labels** attached to all AVs for visibility and identification
- Airside community informed of AV operations for overall awareness

**Regulatory layer:**
- CAAS AC 139-7-7 provides comprehensive governance framework
- Required certifications: ISO 21434 (cybersecurity), ISO 27001 (information security), TR68 (AV safety)
- Data recorder on each AV capturing position, speed, mode, and camera footage at minimum 2Hz
- Quarterly safety performance reviews
- Mandatory reporting and investigation of any AV incident
- Immediate suspension assessment after any incident

### 12.3 How Ground Crew Safety Is Managed

1. **Physical separation**: Dedicated AV travel zones marked on the apron separate autonomous vehicle paths from primary crew work areas
2. **Speed management**: AVs adjust speed based on pedestrian presence, visibility, and sensor detection capability
3. **Yielding behaviour**: AVs always give way to pedestrians at crossings, slow and prepare to stop for pedestrians appearing from occlusion, and proceed only after confirming the pedestrian has left the road
4. **Human override**: Remote operators monitor via control center and can take immediate control
5. **Crew awareness**: Airside community is informed of AV operations including time, location, description, and emergency contacts
6. **Hand signal recognition**: AVs must detect and respond to hand signals from road users and Stop/Go boards from traffic works personnel
7. **Right-of-way hierarchy**: AVs yield to aircraft (taxiing, tow, pushback) and emergency vehicles at all times

### 12.4 Lessons Learned

- **Progressive deployment works**: Starting with controlled trials, expanding to supervised driverless, then fully autonomous operation allowed incremental safety validation
- **Regulatory frameworks enable innovation**: CAAS AC 139-7-7 provided clarity that encouraged deployment while maintaining safety standards
- **Physical and digital boundaries complement each other**: Painted AV zone markings plus digital geofencing create redundant safety boundaries
- **Workforce integration matters**: Ground crew acceptance requires communication, training, and demonstration that AVs free them from driving tasks to focus on higher-value work
- **20,000 km accident-free is meaningful but not sufficient**: Statistical significance for safety claims requires millions of km; however, zero incidents across 5,000+ trips is a strong positive signal

Sources:
- [UISEE -- Changi Airport Partnership](https://www.uisee.com/en/article226-news1.html)
- [Future Travel Experience -- Changi Airport Deploys Autonomous Tractors](https://www.futuretravelexperience.com/2026/01/changi-airport-deploys-autonomous-tractors-in-major-step-towards-airside-automation/)
- [Passenger Terminal Today -- Changi Airport Autonomous Tractors](https://www.passengerterminaltoday.com/news/ground-support/changi-airport-deploys-autonomous-tractors-in-airside-baggage-operations.html)
- [ACI Asia-Pacific -- Changi Airport Rolls Out Autonomous Tractors](https://www.aci-asiapac.aero/media-centre/news/changi-airport-rolls-out-autonomous-tractors-in-a-major-step-towards-airside-automation)

---

## 13. Recommended Safety Architecture for Airside AVs

Based on the research above, a comprehensive ground crew safety system should include:

### 13.1 Detection Stack (Layered, Redundant)

| Layer | Technology | Purpose | Detection Range |
|---|---|---|---|
| Primary perception | Multi-beam LiDAR (e.g., Hesai AT128/OT128) | 3D point cloud for pedestrian detection/tracking | 80-200m |
| Visual classification | Multi-camera array (360-degree) | PPE identification, hand signal recognition, activity classification | 30-100m |
| All-weather detection | Thermal/LWIR camera (e.g., FLIR Tura) | Body heat detection in darkness, fog, rain, glare | 50-200m |
| Velocity measurement | 4D imaging radar | Speed/direction of approaching personnel, all-weather | 50-150m |
| Close-range safety | Ultrasonic sensors + safety bumpers | Last-resort detection and contact sensing | 0-5m |
| Cooperative detection | UWB RTLS tags on all personnel | Detection through occlusion, identification, position verification | Site-wide |
| Remote monitoring | Control center with camera feeds | Human oversight and intervention capability | Site-wide |

### 13.2 Behavioral Safety Logic

1. **Speed adaptation**: Reduce speed when any person detected within 30m; crawl speed (<5 km/h) within 10m
2. **Predictive slowdown**: When turnaround phase indicates crew activity expected on AV route, preemptively reduce speed
3. **Emergency stop**: Immediate stop when person detected within safety envelope (speed-dependent, minimum 2m)
4. **Occlusion handling**: Slow and prepare to stop when sensor occlusion detected near crossings or work areas
5. **Post-stop behaviour**: After stopping for a person, proceed only after confirming the person has cleared the path
6. **Geofence compliance**: Dynamic geofences around active work zones; AV must reroute or wait

### 13.3 Operational Safety Measures

- Dedicated AV travel lanes with physical and painted markings
- AV zone awareness training for all airside personnel
- Emergency contact information displayed on each AV
- Data recorder capturing sensor data, decisions, and camera footage at minimum 2Hz
- Quarterly safety performance reviews with regulatory authority
- Mandatory incident reporting and investigation
- Remote operator capability with immediate intervention authority

---

## 14. Open Research Questions

1. **Statistical safety validation**: How many million km of accident-free operation are needed to demonstrate that autonomous airside vehicles are safer than human-driven GSE? Current deployments (20,000 km) are orders of magnitude short of statistical significance.

2. **Hi-vis detection paradox**: Can deep learning models be specifically trained to handle the spectral characteristics of retro-reflective clothing under artificial lighting conditions common on airport aprons?

3. **Dolly train stopping distance**: What are the actual emergency stopping distances for autonomous tow tractors pulling 2, 3, and 4 loaded dollies at various speeds on wet apron surfaces?

4. **Crew prediction models**: Can turnaround-phase-aware trajectory prediction models achieve significantly higher accuracy than generic pedestrian prediction models in airside environments?

5. **UWB interference**: Do UWB personnel tags interfere with aircraft navigation or communication systems, and what frequencies/power levels are safe for airside deployment?

6. **Multi-AV coordination**: As fleets scale to 24+ vehicles (Changi 2027 target), how do multiple AVs coordinate to avoid creating congestion or conflicting paths around the same aircraft stand?

7. **Edge cases**: What happens when a crew member is lying on the ground (injured, working under equipment), sitting on a dolly, or moving at non-standard speeds?

---

## Sources Summary

### Accident Statistics and Industry Data
- [Flight Safety Foundation -- GAP](https://flightsafety.org/toolkits-resources/past-safety-initiatives/ground-accident-prevention-gap/)
- [IATA -- Ground Ops Safety](https://www.iata.org/en/programs/ops-infra/ground-operations/safety/)
- [IATA -- Enhanced GSE Recognition Program](https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/what-you-need-to-know-about-the-iata-enhanced-gse-recognition-program/)
- [Global Aerospace -- Rising Trends in Ground Incidents](https://www.global-aero.com/from-the-hangar-to-the-tarmac-rising-trends-in-ground-incidents/)
- [Improving Ground Safety While Cutting Costs](https://jetwhine.com/2025/10/improving-ground-safety-while-cutting-costs-practical-innovations-for-airports-and-fbos/)

### Regulatory and Standards
- [FAA -- AGVS on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [FAA CertAlert 24-02](https://www.faa.gov/sites/faa.gov/files/arp-part-139-cert-alert-24-02-AV-AVGS.pdf)
- [OSHA -- FAA or OSHA Jurisdiction](https://www.adamsandreese.com/liftoff/workplace-safety-on-the-airport-ramp-faa-or-osha-jurisdiction)
- [CAAS AC 139-7-7](https://www.caas.gov.sg/docs/default-source/docs---srg/ac-139-7-7-guidance-on-use-of-autonomous-vehicles-at-the-airside.pdf)
- [HSE -- Air Transport](https://www.hse.gov.uk/airtransport/index.htm)
- [Euro NCAP -- VRU Protection](https://www.euroncap.com/en/car-safety/the-ratings-explained/vulnerable-road-user-vru-protection/)
- [ISO 3691-4](https://jlcrobotics.com/iso-3691-4/)
- [Singapore TR68](https://www.lta.gov.sg/content/ltagov/en/newsroom/2021/9/news-releases/enhanced-national-standards-for-the-safe-deployment-of-autonomou.html)
- [IATA -- IGOM](https://www.iata.org/en/publications/manuals/iata-ground-operations-manual/)

### Autonomous GSE Deployments
- [TractEasy](https://tracteasy.com/)
- [EasyMile](https://easymile.com/technology/how-it-works)
- [Aurrigo Aviation](https://aurrigo.com/airport/)
- [UISEE Airports](https://www.uisee.com/en/solution-airports.html)
- [UISEE -- Changi Partnership](https://www.uisee.com/en/article226-news1.html)
- [Future Travel Experience -- Changi Deployment](https://www.futuretravelexperience.com/2026/01/changi-airport-deploys-autonomous-tractors-in-major-step-towards-airside-automation/)

### Detection Technology
- [Hesai AT128](https://www.hesaitech.com/product/at128/)
- [Teledyne FLIR Tura](https://oem.flir.com/about/news/teledyne-flir-oem-debuts-tura-automotive-qualified-thermal-camera-at-ces-for-avs-and-adas/)
- [FLIR -- Thermal Cameras for AEB](https://oem.flir.com/learn/discover/Thermal-Cameras-and-Pedestrian-Detection-and-Automatic-Emergency-Braking-System/)
- [PMC -- LiDAR Performance in Rain and Fog](https://pmc.ncbi.nlm.nih.gov/articles/PMC10051412/)
- [IIHS -- Reflective Clothing Detection Problem](https://www.thedrive.com/news/reflective-clothing-could-make-you-invisible-to-pedestrian-detection-systems-iihs)
- [Cepton -- LiDAR Specs](https://www.cepton.com/driving-lidar/reading-lidar-specs-part-i-what-they-do-and-dont-tell-you)

### PPE Detection
- [MDPI -- PPE Detection Deep Learning](https://www.mdpi.com/2071-1050/15/18/13990)
- [Encord -- PPE Detection Using Computer Vision](https://encord.com/blog/ppe-detection-using-computer-vision/)

### Behavioral Prediction
- [MDPI -- Ground Crew Marshalling Action Recognition](https://www.mdpi.com/2504-446X/9/12/819)
- [ScienceDirect -- Turnaround Control System](https://www.sciencedirect.com/science/article/abs/pii/S0952197622002056)
- [ScienceDirect -- Pedestrian and Vehicle Behaviour Prediction Review](https://www.sciencedirect.com/science/article/pii/S0957417423024855)

### Proximity Detection and Transponders
- [Ubiquicom -- PROXIMITY PLUS](https://www.ubiquicom.com/en/proximity-plus/)
- [Pozyx UWB RTLS](https://www.pozyx.io/products/pozyx-uwb-rtls)
- [Metratec -- Personnel Safety](https://www.metratec.com/applications/rtls/personnel-safety/)
- [PMC -- UWB Proximity Warning System](https://pmc.ncbi.nlm.nih.gov/articles/PMC10747065/)
- [Qualcomm -- C-V2X](https://www.qualcomm.com/products/automotive/c-v2x)

### Emergency Braking
- [PMC -- Improved AEB Algorithm for AGVs](https://pmc.ncbi.nlm.nih.gov/articles/PMC11991318/)
- [Autoware -- AEB](https://autowarefoundation.github.io/autoware_universe/main/control/autoware_autonomous_emergency_braking/)
