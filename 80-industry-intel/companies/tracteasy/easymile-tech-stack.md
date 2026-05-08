# EasyMile: Complete Technology Stack Deep Dive

> Last updated: 2026-03-22
> Research scope: EZ10 shuttle, EZTow tow tractor, EZDolly cargo dolly, autonomy stack, safety architecture, partnerships

---

## 1. Company Overview & History

### Founding

- **Founded:** June 2014 in Toulouse, France
- **Co-founders:** Gilbert Gagnaire (CEO) and Philippe Ligier (Board Member)
- **Origin:** Joint venture between **Ligier Group** (French light vehicle manufacturer) and **Robosoft Technology PTE Ltd** (France)
- **Singapore entity:** Incorporated May 8, 2014, originally named Robosoft Technology Pte. Ltd., at 10 Anson Road, International Plaza, Singapore
- **Current HQ:** Toulouse, France; regional offices in **Berlin (Germany)**, **Denver (USA)**, and **Singapore**
- **Employees:** ~281-300 highly-skilled engineers and staff
- **Annual revenue:** ~$75M (as of March 2025)

### Pre-History: VIPAFLEET & CityMobil2

The EZ10 technology traces back to two European research projects:

1. **VIPAFLEET** (2012-2015): FUI project with Clermont Auvergne University (Institut Pascal Lab and LAPSCO Lab). Long-term experimentation at Michelin's "Ladoux" industrial site in Clermont-Ferrand (October 2014 - February 2015) with a fleet of VIPAs (Individual Public Autonomous Vehicles).

2. **CityMobil2** (2012-2016): EU FP7 project, 15M EUR budget (9.5M from EU). Demonstrated low-speed automated shuttles across European cities. EasyMile EZ10 was one of two vehicles deployed (alongside Robosoft Robucity).

### Funding History

| Round | Date | Amount | Lead Investors | Notable Participants |
|-------|------|--------|----------------|---------------------|
| Series A | Jan 2017 | EUR 14M | Alstom | Alstom (minority stake + board seat) |
| Strategic | Jul 2017 | Undisclosed | Continental | Continental (minority stake) |
| Series B | Apr 2021 | EUR 55M (~$66M) | Searchlight Capital Partners | McWin, NextStage AM, Alstom, Bpifrance, Continental |
| **Total raised** | | **~$102M** | | |

---

## 2. Vehicle Platforms

### 2.1 EZ10 Autonomous Shuttle

**Manufacturer:** Ligier Group (body/chassis), EasyMile (autonomy stack + sensors)

#### Physical Specifications

| Parameter | Value |
|-----------|-------|
| Length | 4,020 mm |
| Width | 1,998 mm |
| Height | 2,871 mm |
| Curb weight | 2,050 kg |
| Gross vehicle weight | 3,050 kg |
| Passenger capacity | Up to 12-15 (6 seated + standing, or wheelchair) |
| Door | Single door with double wings + automated wheelchair ramp |
| Autonomy level | SAE Level 4 |

#### Powertrain

| Parameter | Value |
|-----------|-------|
| Motor | Electric, 2 x 8 kW (Gen2 baseline) |
| Battery | Lithium Iron Phosphate (LiFePO4), 30.72 kWh (Gen2); 45 kWh (ABSOLUT upgrade) |
| Max speed (design) | Up to 40 km/h |
| Operational speed | Electronically limited to 16 km/h (typical: 8-16 km/h) |
| Charge time | ~6 hours (plug-in) |
| Operating duration | Up to 16 hours on one charge |

#### Generations

- **Gen1** (2015): Initial production model, deployed from April 2015
- **Gen2** (~2018): New interior design, heating/A/C, automatic wheelchair ramp, cushioned seating, safety belts, capacity up to 15 passengers
- **Gen3** (~2019-2021): Announced at Global Public Transport Summit 2019. Upgraded sensor suite for improved weather resilience. Tested in Hamburg on-demand fleet (2021). Remote control center management

**ABSOLUT Project Upgrade** (research): 50 kW motor at 48V, 45 kWh underfloor battery, new suspension with increased track width, additional sensor suite (Ibeo lidar, Ouster lidar, Continental radar)

### 2.2 EZTow Autonomous Tow Tractor

**Manufacturer:** TLD (vehicle platform), EasyMile (autonomy stack)

| Parameter | Value |
|-----------|-------|
| Towing capacity | Up to 20 tonnes |
| Drawbar pull | 2,000 daN (4,500 lbf) |
| Autonomous speed | Up to 15 km/h |
| Operation modes | Manual to full driverless |
| Duty cycle | 24/7 capable |
| Connectivity | LiDAR, HD cameras, GPS, 4G, Wi-Fi |
| Infrastructure needed | None (no magnetic tape, transponders, or reflectors) |
| Navigation | Centimeter-level precision, indoor/outdoor |

### 2.3 EZDolly Autonomous Cargo Dolly

**Manufacturer:** TLD (based on "TF" transporter platform), EasyMile (autonomy)

| Parameter | Value |
|-----------|-------|
| Max load capacity | 7 metric tonnes |
| ULD support | Full width (96") ULD containers and pallets, all major upper/lower deck types |
| Driveline | iBS-powered driveline and cargo conveying system |
| Maneuverability | 360-degree |
| Operation | 24/7 automated, indoor/outdoor |
| Fleet management | EZFleet control + API integration to Airport Operations Management Systems |
| Production start | 2025 |

### 2.4 EZTug (Port Terminal Tractor)

Autonomous terminal tractor for container operations, deployed at Port of Helsingborg. Based on **Terberg YT203EV** electric tractor platform with EasyMile autonomy stack.

---

## 3. Sensor Suite

### 3.1 EZ10 Standard Configuration

The EZ10 uses a multi-layer sensor architecture with redundancy:

#### 2D Safety LiDARs (LMS)

- **Quantity:** 4 units, one at each corner of the vehicle
- **Mounting:** 12 inches (~30 cm) above ground level
- **Field of view:** 270 degrees horizontal each
- **Coverage:** 360-degree redundant perception (overlapping FOV)
- **Range:** ~40 meters (130 feet)
- **Purpose:** Obstacle detection by both high-level software AND the Safety Chain (hardware safety layer)
- **Note:** Referenced as "LMS safety LIDARs" in documentation -- the designation "LMS" is consistent with SICK LMS series safety laser scanners, though EasyMile does not publicly name the brand

#### 3D LiDARs

- **Supplier:** Velodyne Lidar (3-year supply agreement signed April 2020)
- **Models:** Velodyne Puck (VLP-16) and Ultra Puck
- **Quantity (Gen2 baseline):** 2 units -- one front, one rear
- **Specifications (VLP-16):**
  - 16 channels
  - Range: ~80 meters (260 feet)
  - Horizontal FOV: 360 degrees (mounted with ~180 degrees effective per unit)
  - Vertical FOV: 30-32 degrees
  - ~300,000 points/second
- **Purpose:** Navigation + obstacle detection, 3D environmental mapping
- **Claimed detection range:** Up to 250 meters (system-level, with all sensors fused)

#### Cameras

- Indoor and outdoor cameras
- Used for obstacle detection, position estimation, road sign/traffic signal identification
- Specific models not publicly disclosed

#### Radar

- Radar scanning for objects, vehicles, animals, and people
- Specific brand/model not publicly disclosed for standard EZ10
- Continental contributed radar sensors in research projects (ABSOLUT, CUbE)

#### GPS/GNSS

- Differential GPS communicating with base stations
- Uses RTK correction provider (referenced as "SmartNet") for centimeter-level accuracy

#### IMU (Inertial Measurement Unit)

- Integrated in sensor array for dead reckoning and sensor fusion

#### Wheel Odometry

- Sensors on each wheel measuring displacement and speed
- Reconstructs overall vehicle movement

### 3.2 ABSOLUT Research Project Sensor Configuration

The ABSOLUT project (Leipzig, Germany) added research-grade sensors to the EZ10 Gen2:

- **Ibeo LiDAR** (front-facing)
- **Ouster LiDAR** (front, roof-mounted)
- **Continental radar** sensors (extended perception)
- **Additional cameras** (front-facing)
- Roof-mounted sensor pods with two additional LiDAR sensors
- Multilayer 360-degree LiDAR and radar at each corner

### 3.3 EZTow / TractEasy Sensors

- LiDAR sensors (specific models not publicly disclosed)
- High-definition cameras
- GPS
- 4G and Wi-Fi connectivity
- Same autonomy stack as EZ10, adapted for tow tractor operations

---

## 4. Compute Platform

### Safety-Critical ECU (MicroSys Electronics)

EasyMile has a long-term partnership with **MicroSys Electronics** (Germany) for safety-critical compute hardware:

- **System-on-Module:** MicroSys miriac SOM
- **Processor:** NXP S32 family vehicle network processors
  - Up to 8x Arm Cortex-A53 cores (application processing)
  - Up to 4x Arm Cortex-M7 dual-core lockstep pairs (real-time safety processing)
  - Combined architecture processes LiDAR and video data alongside functionally safe vehicle control
- **Safety certification:** ASIL D capable (ISO 26262)
- **ECU:** Custom Electronic Control Unit designed to EasyMile's specifications, manufactured by MicroSys
- **Scalability:** SOM-based architecture allows performance scaling by module replacement
- **Key advantage:** Addresses a large variety of interfaces and protocols, enabling uniform safety integrity across different vehicle platforms (EZ10, EZTow, EZTug, EZDolly)

### Safety PLC

- **Certification:** SIL 3 per IEC 61508, PLe per ISO 13849
- **Role:** Independent safety chain monitoring, emergency stop triggering, continuous self-diagnostics
- **Brand:** Not publicly disclosed (PLC brand is proprietary to EasyMile's safety chain implementation)

---

## 5. Software Architecture

### Overview

EasyMile's autonomous driving stack is **entirely developed in-house**, giving the company full control over performance, safety, and integration. It is **platform-agnostic**, deployed across shuttles (EZ10), tow tractors (EZTow), cargo dollies (EZDolly), terminal tractors (EZTug), and full-size buses (Iveco Bus).

### Technology Stack (from job postings and public information)

| Component | Technology |
|-----------|-----------|
| Primary language | C++ (core autonomous stack) |
| Robotics framework | ROS (Robot Operating System) |
| Build system | CMake |
| Version control | Git |
| CI/CD | Jenkins / GitLab CI |
| Testing | Unit testing, simulation testing, vehicle track testing, log analysis |
| Networking | TCP/UDP, HTTP, VPN, SSH, OAuth, cloud services |
| R&D team size | 50-80+ engineers |

### Functional Modules

1. **Perception:** Sensor fusion of LiDAR, cameras, radar for 360-degree environmental awareness. Object detection and classification of people, vehicles, obstacles in real time.

2. **Localization:** Particle filter algorithm fusing LiDAR point clouds, camera data, GNSS/RTK, odometry, and IMU against a pre-built map. Achieves centimeter-level positioning accuracy. Referred to internally as "micro localization."

3. **Mapping:** Pre-mapping of operational area required before deployment. Map serves as reference for particle filter localization.

4. **Path Planning & Navigation:** Evaluates traffic situation and determines safest, most efficient trajectory. Decisions governed by certified safety logic. Supports obstacle avoidance, predictive control, intersection decisions, pedestrian crossing behavior.

5. **V2X Communication:** Vehicle-to-Everything communication for enhanced navigation. Data from V2X instructs braking system (hydraulic pump applies brake pressure). Supports intersection and pedestrian crossing scenarios. Specific protocol (ITS-G5 / C-V2X) not publicly disclosed, though European deployments suggest ITS-G5 compatibility.

6. **Safety Chain:** Independent hardware/software safety layer (see Section 6).

7. **Fleet Management (EZFleet):** Cloud-based supervision platform (see Section 8).

### Deep Learning / AI

EasyMile describes its technology as "robotics, computer vision and vehicle dynamics powered by deep learning." Specific neural network architectures or training approaches are not publicly documented. The company has 80+ R&D engineers working on the autonomous stack.

---

## 6. Safety Architecture

### Design Philosophy: Safety by Design

EasyMile's approach is based on an **independent safety layer** called the **Safety Chain**, which operates separately from the main autonomy stack. This architecture mitigates the risk of processing unit failure due to hardware or operating system faults.

### Safety Chain Architecture

```
[Autonomy Stack (NXP S32G ECU)]  <-->  [Safety PLC (SIL3/PLe)]
         |                                      |
    Perception                            Safety LiDARs (4x LMS)
    Localization                          Emergency stop buttons
    Path Planning                         Brake system monitoring
    V2X                                   Battery monitoring
                                          Continuous self-diagnostics
```

**Key elements:**

- **Safety PLC:** SIL 3 certified (IEC 61508), PLe certified (ISO 13849). Continuously monitors emergency stop buttons; triggers E-Stop on error detection.
- **Redundant braking:** Multiple independent braking systems. Architecture mitigates risk of failure in two braking systems AND complete loss of electric power.
- **Redundant sensor coverage:** Four LMS safety LiDARs (270 deg each) providing 360-degree redundant obstacle detection. Sourced from different suppliers than the 3D perception LiDARs.
- **Obstacle detection:** Divided into two independent subsystems: anti-collision software (autonomy stack) and safety system (Safety Chain hardware).

### Standards Compliance

| Standard | Scope |
|----------|-------|
| ISO 26262 | Functional Safety for Road Vehicles |
| ISO 12100 | Safety of Machinery -- General principles |
| ISO 13849-1 | Safety of Machinery -- Safety-related control systems (PLe) |
| IEC 61508 | Functional Safety (SIL 3) |
| ISO 3691-4 | Driverless Industrial Trucks -- Safety Requirements |
| ISO 21448 (SOTIF) | Safety of the Intended Functionality |
| CE marking | European Conformity |

### Formal Verification (STARTREC Project)

EasyMile coordinated the **STARTREC project** (April 2021, 2 years) in partnership with:
- **TrustInSoft** -- formal verification of embedded C/C++ code using TrustInSoft Analyzer
- **CEA-Tech** -- commissariat for atomic energy research
- **StatInf** -- statistical inference methods
- **Inria** -- French national research institute

**Key achievement:** Formally proved an emergency anti-collision function using mathematical techniques (formal methods), equivalent to billions of tests. This verifies, with high certainty, that the anti-collision system behaves correctly in all possible scenarios.

### Safety Analysis Tools

- **Ansys medini analyze:** Used for functional safety analysis. Supports HAZOP, HARA, FTA, FMEA, FMEDA. Applied to EZ10 and EZTow. Deployed with **CADFEM France** as integration partner. Single model used for all safety activities across platforms, shortening development cycles.

---

## 7. Localization & Navigation Approach

### Map-Based Localization with Particle Filter

EasyMile does **not** use real-time SLAM for production operations. Instead:

1. **Pre-mapping phase:** The operational area is mapped in advance (driven at 5-16 km/h during mapping). This creates a reference map of the environment.

2. **Runtime localization:** A **particle filter** algorithm fuses real-time sensor data (LiDAR, cameras, GPS/GNSS, odometry, IMU) against the pre-built map to determine the vehicle's exact position with centimeter accuracy.

3. **GNSS/RTK augmentation:** When available, differential GPS with RTK corrections (via services like SmartNet) refines position estimate.

4. **Route following:** Vehicle follows pre-defined routes on the pre-mapped area, with dynamic obstacle avoidance and trajectory optimization within the route corridor.

### Navigation Features

- Obstacle avoidance (dynamic replanning)
- V2X communication integration (traffic light, intersection awareness)
- Predictive control
- Decision-making at intersections and pedestrian crossings
- Docking precision: <10 cm at stations (demonstrated on Iveco Bus at 40+ km/h)
- Demonstrated localization effectiveness at autonomous speeds over 70 km/h (Iveco Bus tests)

---

## 8. Fleet Management & Supervision

### EZFleet Platform

EasyMile's fleet management system:

- **Scope:** Manages all types of autonomous vehicles on a site
- **Real-time monitoring:** Vehicle positions, assigned routes, ETA, destinations, vehicle status parameters
- **Multi-vehicle supervision:** Single operator can supervise multiple vehicles from anywhere
- **Adaptability:** Different operating scenarios and customer needs
- **API integration:** APIs for third-party system integration (e.g., Airport Operations Management Systems)
- **Communication:** 4G data connection for V2X and supervision center communication

### Remote Supervision (Level 4 Operations)

EasyMile was the **first company to deploy fully driverless at Level 4** (no human on board):

- **Site Control Center:** Provided with all EasyMile solutions. Enables remote monitoring, supervision, real-time communication with vehicles and passengers.
- **Teleoperation partner:** **DriveU.auto** (Israel) -- deployed for remote piloting capabilities
  - Patented cellular bonding technology
  - Dynamic video encoding
  - Low-latency algorithms
  - Software-based connectivity platform (SDK integrated into vehicle computers)
  - Industry's lowest latency and highest reliability claimed
- **Operational model:** Customers operate their own vehicles, using the vehicle's existing sensor suite and hardware

---

## 9. Simulation & Verification Tools

| Tool | Purpose | Partner |
|------|---------|---------|
| Ansys medini analyze | Functional safety analysis (FMEA, FTA, HARA, HAZOP) | Ansys / CADFEM France |
| TrustInSoft Analyzer | Formal verification of embedded C/C++ code | TrustInSoft |
| In-house simulation | Unit testing, simulation testing | Internal R&D |
| Physical test track | Vehicle integration testing | EasyMile test track (Toulouse) |
| Field log analysis | Post-deployment analysis and bug fixing | Internal R&D |

EasyMile uses simulation testing as part of their CI/CD pipeline (Jenkins/GitLab CI). The exact simulation frameworks are not publicly disclosed, but the job postings reference "simulation testing" as a core development practice.

---

## 10. Key Patents

EasyMile has filed a modest patent portfolio (publicly confirmed: 4+ patents). Known patents:

### US 10,962,649 -- Blind Sector Handling in Redundant Sensors

- **Inventors:** Benoit Perrin, Cyril Roussillon, Arnaud Dumerat, Manon Monnerie, Arnaud Telinge
- **Subject:** Method and system for handling blind sectors in redundant sensors. If blind sectors qualify as "large blind sectors" and intersect within a monitored zone extending from the vehicle, a critical signal is sent to the navigation system (autonomous) or driver.
- **Significance:** Core to EasyMile's redundant sensor safety architecture where four 270-degree LiDARs provide overlapping coverage with monitored blind sector analysis.

Additional patents are filed under EasyMile SAS at patent offices including USPTO and EPO. The company's patent strategy appears focused on safety-critical systems, sensor redundancy, and autonomous navigation rather than broad autonomous driving claims.

---

## 11. Academic Publications & Research Projects

### EU-Funded Research Projects

| Project | Funding | Period | Focus |
|---------|---------|--------|-------|
| VIPAFLEET | FUI (France) | 2012-2015 | Original EZ10 development, Clermont Auvergne Univ. |
| CityMobil2 | EU FP7, EUR 15M | 2012-2016 | Automated shuttle demonstrations across Europe |
| STAR | French R&D | ~2017-2021 | Iveco Bus 12m autonomous city bus (with ISAE-SUPAERO, Inria, Michelin, Transpolis, Univ. Gustave Eiffel) |
| AWARD | EU H2020, EUR ~20M | ~2020-2024 | All-Weather Autonomous Real logistics Demonstrations. 29 partners, 12 countries. Airport, port, warehouse, hub-to-hub use cases |
| STARTREC | Bpifrance + Occitanie | 2021-2023 | Formal verification of safety-critical embedded systems (with TrustInSoft, CEA-Tech, StatInf, Inria) |
| KelRide | BMDV (Germany), EUR 10.5M | 2021-2024 | Europe's largest autonomous shuttle operating area, Kelheim. All-weather operations |
| SAFESTREAM | BMWK (Germany), EUR 8.9M + EUR 6.9M consortium | 2023-ongoing | SAE Level 4 in public transport without safety attendant. Kelheim + Monheim am Rhein (with T-Systems, TUV Rheinland, P3, TU Munich) |
| ABSOLUT | German funding | Ongoing | High-speed EZ10 (70 km/h) with enhanced sensor suite. Leipzig S-Bahn to BMW plant |
| Mach2 (Chateauroux) | French Ministry + Bpifrance | Ongoing-2026 | Fully autonomous minibuses in public transport (with Keolis, Alstom, Renault, Equans, StatInf) |

### Notable Academic Studies Involving EZ10

- UNC Charlotte Autonomous Shuttle Pilot (2023): 825 trips, 565 passengers, 2.2-mile mixed-traffic campus route
- University of Denver Autonomous Vehicle Shuttle: Detailed safety report to DOT/NHTSA
- Multiple user acceptance studies on ResearchGate examining passenger comfort, safety perception, and adoption factors
- "Driverless shuttle pilots: Lessons for automated transit technology deployment" (ScienceDirect)
- ACM study: "Capacity Management in an Automated Shuttle Bus" (AutomotiveUI 2020)

---

## 12. Key Partnerships

### Vehicle Platform Partners

| Partner | Vehicle | Relationship |
|---------|---------|-------------|
| **Ligier Group** | EZ10 shuttle | Chassis/body manufacturer. Co-founder Philippe Ligier |
| **TLD** (Alvest Group) | EZTow, EZDolly | GSE manufacturer. Joint venture TractEasy (launched June 2024) |
| **Smart Airport Systems (SAS)** | Airport distribution | Alvest Group sister company, aviation expertise for TractEasy JV |
| **Iveco Bus** | 12m autonomous city bus | STAR project -- autonomous BRT bus |
| **Terberg Special Vehicles** | YT203EV terminal tractor | EZTug for port operations |
| **Renault Group** | 6m electric minibus | Mach2/Chateauroux project -- robotized minibus platform |

### Technology Partners

| Partner | Domain |
|---------|--------|
| **MicroSys Electronics** | Safety-critical ECU / System-on-Module (NXP S32G) |
| **Velodyne Lidar** (now Ouster) | 3D LiDAR sensors (Puck, Ultra Puck) |
| **Continental** | Investor + radar/LiDAR sensors, ADAS technology, brake concepts |
| **Alstom** | Investor + connected safety infrastructure, communication protocols |
| **DriveU.auto** | Teleoperation / remote supervision connectivity |
| **Ansys / CADFEM France** | Functional safety analysis (medini analyze) |
| **TrustInSoft** | Formal code verification |
| **Sono Motors** | Solar cell integration (CES 2021 prototype) |

### Operator / Deployment Partners

| Partner | Context |
|---------|---------|
| **Keolis** | Public transport operations (Chateauroux, others) |
| **Menzies Aviation** | Airport ground handling (DFW) |
| **Alyzia** | Airport ground handling (Toulouse-Blagnac) |
| **Piedmont Airlines** | Baggage handling (GSP Airport) |
| **ioki** (Deutsche Bahn) | On-demand transit platform (Germany) |
| **CleverShuttle** | Ride-sharing operations (Germany) |
| **Via** | On-demand transit platform (KelRide) |

### Airport Deployments (EZTow/TractEasy)

| Airport | Country | Status | Details |
|---------|---------|--------|---------|
| **Toulouse-Blagnac** | France | Active (since Nov 2022) | Level 4, 2 km route, baggage towing. Partner: Alyzia |
| **Changi** | Singapore | Active | 3 autonomous tractors, ULD transport between baggage handling area and aircraft bay |
| **Narita International** | Japan | Active | Baggage transport between terminal and satellite |
| **Dallas Fort Worth (DFW)** | USA | Completed trial | Half-mile cargo loop, West Cargo airfield. Partner: Menzies Aviation |
| **Greenville-Spartanburg (GSP)** | USA | Active (since Sep 2024) | 1-mile mixed-traffic route, cargo + baggage handling. Partner: Piedmont Airlines |
| **Schiphol** | Netherlands | Deployed | Details limited |

---

## 13. Regulatory Milestones

- **2018:** First company to launch commercial autonomous vehicles with comprehensive homologations by independent assessors
- **2020 (Feb):** NHTSA temporarily suspended US passenger operations after emergency braking incident in Columbus, Ohio (passenger fell from seat at 7.1 mph). Resumed after Safety Passenger Enhancement Plan (seatbelts, signage, audio announcements)
- **2022:** NHTSA recall 22V-924 for Gen2 EZ10 48V battery defect (4 vehicles)
- **2023:** Authorized at Level 4 on public roads in Europe (first in Europe)
- **Ongoing:** Fully driverless operations (no human on board) at Toulouse-Blagnac airport, Kelheim, and other sites

---

## 14. Deployment Scale

As of late 2025:

- **400+ deployment locations** worldwide
- **30+ countries**
- **1,000,000+ km driven autonomously** at Level 4
- **180+ vehicles deployed** (EZ10 claimed as most-deployed driverless shuttle globally)
- EZTow claimed as **most-deployed autonomous tow tractor globally**
- EasyMile claims **~60% share** of the autonomous shuttle market

---

## 15. Key Technical Unknowns (Not Publicly Disclosed)

Despite extensive research, the following remain proprietary/undisclosed:

1. **Safety PLC brand/model** -- SIL3/PLe certified, but manufacturer not named (likely Pilz, Siemens, or Beckhoff based on European industrial safety market)
2. **2D Safety LiDAR brand** -- Referenced as "LMS" in documentation, consistent with SICK LMS series but never explicitly confirmed
3. **Specific neural network architectures** -- Company references "deep learning" but no published model architectures or training details
4. **Operating system** -- Likely Linux-based (C++/ROS stack, CMake build system), but not confirmed
5. **V2X protocol** -- Supports V2X but specific standard (ITS-G5/C-V2X/DSRC) not disclosed
6. **Simulation framework** -- Internal simulation testing exists but specific tools unknown beyond Ansys medini
7. **Camera models and specifications** -- Not publicly documented
8. **Radar specifications** -- Brand/model not disclosed for production vehicles
9. **Specific NXP S32G variant** -- MicroSys partnership confirmed NXP S32 family but exact variant (S32G2, S32G3) not specified

---

## Sources

- [EasyMile - About Us](https://easymile.com/about-us)
- [EasyMile - Technology](https://easymile.com/en/technology)
- [EasyMile - Safety by Design](https://easymile.com/technology/safety-by-design)
- [EasyMile EZ10 - Wikipedia](https://en.wikipedia.org/wiki/EasyMile_EZ10)
- [EasyMile EZ10 - Land Transport Guru](https://landtransportguru.net/easymile-ez10/)
- [Velodyne Lidar Announces Agreement with EasyMile](https://www.businesswire.com/news/home/20200428005241/en/Velodyne-Lidar-Announces-Agreement-with-EasyMile)
- [MicroSys and EasyMile Collaboration](https://microsys.de/news/microsys-and-easymile-collaborate-on-the-development-of-safety-critical-technology-for-autonomous-driving/)
- [Ansys Helps Drive EasyMile Safety](https://www.ansys.com/news-center/press-releases/1-5-22-ansys-helps-drive-electric-autonomous-vehicle-safety-for-easymile)
- [DriveU.auto in EasyMile Level 4 Operations](https://driveu.auto/blog/driveu-autos-solution-deployed-in-level-4-autonomous-shuttle-operations/)
- [TrustInSoft and EasyMile - STARTREC Project](https://www.trust-in-soft.com/success-stories/automotive/easymile)
- [EasyMile STARTREC Project Completion](https://easymile.com/news/easymile-completes-major-technology-project-verify-critical-embedded-systems-its-autonomous)
- [Continental Invests in EasyMile](https://www.continental.com/en/press/press-releases/continental-is-investing-in-easymile/)
- [Alstom Invests in EasyMile](https://www.alstom.com/press-releases-news/2017/1/alstom-invests-in-easymile-a-start-up-developing-electric-driverless-shuttles)
- [EasyMile Series B - EUR 55M](https://easymile.com/news/easymile-raises-55-million-series-b-round-commercially-scale-autonomous-solutions)
- [Alvest Group and EasyMile Launch TractEasy JV](https://easymile.com/news/alvest-group-and-easymile-officially-launch-joint-venture)
- [TractEasy - Official Site](https://tracteasy.com/)
- [EZTow at Greenville-Spartanburg Airport](https://easymile.com/news/eztow-autonomous-tow-tractor-deployed-greenville-spartanburg-international-airport)
- [DFW Airport Autonomous Towing](https://easymile.com/success-stories/Dallas-Fort-Worth-International-Airport)
- [Autonomous Baggage Tractor at Toulouse-Blagnac](https://easymile.com/news/autonomous-baggage-tractor-toulouse-blagnac-airport-goes-fully-driverless-and-extends-route)
- [SAFESTREAM Project Launch](https://easymile.com/news/safestream-project-accelerate-autonomous-driving-sae-level-4-public-transport-germany-launched)
- [KelRide Project Success](https://easymile.com/news/kelride-paves-way-weatherproof-autonomous-public-transport-germany)
- [AWARD H2020 Project](https://easymile.com/news/driverless-technology-indooroutdoor-towing-airports-showcased-award-h2020-project)
- [Iveco Bus and EasyMile Autonomous City Bus](https://easymile.com/news/iveco-bus-and-easymile-reach-next-stage-autonomous-standard-city-bus)
- [Chateauroux Mach2 Project](https://easymile.com/news/first-public-transport-french-consortium-deploy-fully-autonomous-mini-buses-downtown)
- [ABSOLUT Project - Vehicle Work Package](https://www.absolut-project.com/work-packages/vehicle/)
- [University of Denver AV Shuttle Report](https://www.transportation.gov/sites/dot.gov/files/docs/policy-initiatives/automated-vehicles/351416/69-university-denver.pdf)
- [EasyMile Patents - Justia](https://patents.justia.com/assignee/easymile)
- [EasyMile Job Postings](https://www.welcometothejungle.com/en/companies/easymile/jobs)
- [Terberg and EasyMile Terminal Tractor](https://easymile.com/ez-experts/terberg-and-easymile-prepare-autonomous-terminal-tractor-real-life-test-2022)
- [EasyMile and Sono Motors Solar Shuttle](https://easymile.com/news/easymile-and-sono-motors-reveal-collaboration-autonomous-solar-powered-passenger-shuttle)
- [MicroSys NXP S32G SOMs](https://microsys.de/somnxps32g/)
- [Ligier Group - EZ10](https://www.ligiergroup.com/our-ranges/ez10.html)
- [EasyMile Impact Report 2023](https://easymile.com/sites/default/files/easymile_impact_report_2023.pdf)
- [TractEasy - EZDolly](https://tracteasy.com/ezdolly/)
