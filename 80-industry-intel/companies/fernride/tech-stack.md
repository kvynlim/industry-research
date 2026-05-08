# Fernride: Comprehensive Company & Technology Report

*Last updated: 2026-03-22*

---

## 1. Company Overview

**Fernride** is a Munich-based autonomous trucking company specializing in human-assisted autonomy for industrial logistics. Unlike pure-autonomy companies chasing full driverless operation from day one, Fernride takes a teleoperation-first approach -- deploying revenue-generating driverless operations today while progressively increasing autonomy over time.

- **Founded:** 2019, Munich, Germany
- **Origin:** Spin-off from 10 years of teleoperation research at the Technical University of Munich (TUM), Chair of Automotive Engineering
- **Headquarters:** Munich, with additional office in Wolfsburg
- **Employees:** 130+ (as of 2023)
- **Total funding raised:** ~EUR 75M+ (~$87.4M across 7 rounds)
- **Acquired:** December 17, 2025 by Quantum Systems (European AI-powered unmanned systems leader)

---

## 2. Founding Team & Leadership

### Co-Founders

| Name | Role | Background |
|------|------|------------|
| **Hendrik Kramer** | CEO & Co-Founder | Industrial engineering at TUM and Stanford. Forbes 30 Under 30. Logistics Leader of the Year 2024. Master's in Entrepreneurship & Autonomous Driving. |
| **Dr. Maximilian Fisser** | COO & Co-Founder | TUM School of Engineering and Design / TUM School of Management. |
| **Jean-Michael Georg** | CTO & Co-Founder | Bachelor's in Mechanical Engineering and Master's from RWTH Aachen. PhD in teleoperation at TUM's leading chair for autonomous driving. Research Associate at FTM Institute of Automotive Technology, TUM. |

### Executive Team

| Name | Role | Background |
|------|------|------------|
| **Thomas Bock** | CTO & COO | 15+ years at Audi developing L2/L3/L4 autonomous systems |
| **Dr. Volker Hartmann** | General Counsel | 15+ years automotive/mobility technology law |
| **Guenter Schmidmeir** | CRO | Maritime and logistics automation expertise |
| **Candice Manatsa** | Executive Director, People & Culture | 15+ years at Goldman Sachs, Barclays, Forto |
| **Ciaran Murphy** | VP of Engineering | Former Intel/Mobileye, AID GmbH, Argo AI |

### Board & Advisors

| Name | Role |
|------|------|
| **Klaus Kleinfeld** | Chairman of the Board. Former Siemens CEO. |
| **Holger Mandel** | Board Member. 30+ years leadership at VW/MAN, Caterpillar, Volvo. |
| **Thomas Mueller** | Board Member / Advisor. Former CEO of Hensoldt, Board Member of Airbus Defense. |
| **Alexandre Haag** | Investor & Advisory Board Member. Former Argo, Zoox, Tesla. |

Senior management recruited expertise from BMW, MAN, Mobileye, and Argo AI.

---

## 3. Funding History

| Round | Date | Amount | Key Investors |
|-------|------|--------|---------------|
| **Seed** | 2020 | ~EUR 10M+ | Speedinvest, Fly Ventures, UnternehmerTUM |
| **Series A (1st close)** | June 2023 | $31M | 10x Founders, Promus Ventures, Fly Ventures, Speedinvest, Push Ventures; Corporate: HHLA Next, DB Schenker (Schenker Ventures), Krone |
| **Series A (2nd close)** | September 2023 | $19M | Deep Tech and Climate Fonds (DTCF, $1B German government fund), Munich Re Ventures, Bayern Kapital, Klaus Kleinfeld |
| **Series A Extension** | September 2025 | EUR 18M | Lead: Helantic. Joined by dual-use defense investors including Thomas Mueller (former Hensoldt CEO). Family offices and existing shareholders. |
| **Total** | -- | **~EUR 75M+ ($87.4M)** | 20+ investors across 7 rounds (including 1 grant/prize round) |

The Krone Group also made a direct financial investment as part of their strategic partnership.

---

## 4. Progressive Autonomy Approach (Teleoperation-First)

Fernride's core thesis: **full autonomy is years away from reliable, revenue-generating industrial deployment. Teleoperation bridges the gap today.**

### The Three-Stage Model

```
Stage 1: Tele-DRIVE (Supervised Driving / Remote Operation)
  |
  |  Teleoperator has full control of the vehicle from a remote cockpit
  |  with steering wheel, pedals, handles, and HD screens showing
  |  camera feeds from every direction. One operator per vehicle.
  |
  v
Stage 2: Tele-ASSIST (On-Demand Human Assistance)
  |
  |  Vehicle operates semi-autonomously. Teleoperator only intervenes
  |  when the AV encounters an incident it cannot resolve. Operator
  |  resolves the edge case, then restores autonomy. Ratio: 1 operator
  |  to up to 4 vehicles (current) scaling toward 50 vehicles.
  |
  v
Stage 3: Full Autonomy (with Remote Oversight)
  |
  |  Vehicle operates at Level 4. Remote human oversight remains for
  |  monitoring and exception handling. Human oversight will "always
  |  be required" per Fernride's philosophy.
```

### Why This Matters vs. Pure-Autonomy Companies

| Dimension | Fernride (Teleoperation-First) | Pure-Autonomy Companies |
|-----------|-------------------------------|------------------------|
| **Time to revenue** | Immediate -- generates commercial revenue today | Years of development before deployment |
| **Edge case handling** | Human teleoperator resolves in real-time | Must solve algorithmically or disengage |
| **Safety certification** | Already TUV SUD certified (EU Machinery Directive) | Most lack equivalent safety certification |
| **Driver in vehicle** | No -- truly driverless cabin | Many U.S. AV companies still use safety drivers |
| **Deployment risk** | Low -- integrates into existing workflows without disruption | High -- requires complete operational redesign |
| **Data collection** | Every teleoperator intervention becomes training data for autonomy stack | Requires expensive dedicated test fleets |
| **Cost scaling** | 1:4 ratio today, targeting 1:50 as autonomy improves | Fixed cost per vehicle until L4 achieved |

Fernride's approach: *"Rather than chasing full autonomy, which remains technologically and economically distant for most industrial use cases, human-assisted autonomy strikes a balance between innovation and operational realism."*

CEO Hendrik Kramer: *"Our human-assisted approach works right away, solves all the possible edge cases, and delivers the reliability the industry requires."*

---

## 5. Technology Stack

### 5.1 Sensor Suite

| Sensor Type | Details |
|-------------|---------|
| **LiDAR** | 3D point cloud generation for obstacle detection and precise navigation. Laser-based distance measurement. |
| **Radar** | Continental ARS430 Long Range Radar -- real-time environmental detection using advanced signal processing and smart antenna design. Functions in fog, rain, snow, darkness. Detects small or unexpectedly moving objects. |
| **Cameras** | Continental FSC336 Far Look Satellite Cameras (extended-range imaging) + Continental SVC331 Surround View Cameras (360-degree visibility, low-light capable). Heated and self-cleaning lenses for all-weather operation. |
| **Ultrasonic** | Close-range obstacle detection |
| **IMU** | Inertial measurement unit for positioning |
| **GPS** | Satellite-based positioning |

**Sensor Fusion:** Multi-sensor fusion architecture combining vSLAM (visual Simultaneous Localization and Mapping), GPS, and LiDAR for centimeter-level positioning accuracy.

### 5.2 Compute Hardware

| Component | Details |
|-----------|---------|
| **Primary compute** | Linux-based high-performance system |
| **Safety ECU** | QNX-based redundant safety controller |
| **Redundancy** | Dual-compute architecture with independent safety validation layer |
| **Partners** | NVIDIA (listed as technology partner), Intel, NXP |
| **Operating range** | -30C to +60C |

**Note on NVIDIA Partnership:** NVIDIA is listed as a technology partner on Fernride's platform page and appears in Fernride's "Trusted by industry leaders" section. A LinkedIn post from an investor references "FERNRIDE and NVIDIA partner on autonomous driving." However, the specific details of the NVIDIA compute integration (e.g., whether Fernride uses NVIDIA DRIVE AGX, Jetson AGX Orin, or another platform) have not been publicly detailed in available sources. NVIDIA does not list Fernride on its official DRIVE partner ecosystem page, suggesting the relationship may be through NVIDIA's Inception startup program or a more targeted integration arrangement rather than a marquee platform partnership.

### 5.3 Connectivity & Network

| Component | Details |
|-----------|---------|
| **Primary network** | 4G/LTE with 5G-ready architecture |
| **Protocol** | uRLLC (ultra Reliable and Low Latency Communication) -- proprietary protocol for real-time video and vehicle data over existing LTE networks |
| **Latency** | **End-to-end < 100ms on 4G/LTE** (video stream + control commands round-trip) |
| **Encryption** | TLS 1.3 encrypted link |
| **Redundancy** | Dual routers with VPN/LTE failover capability |
| **Satellite backup** | Starlink optional integration |
| **Site assessment** | Fernride conducts thorough connectivity assessment before deployment; constantly monitors bandwidth and latency; uses redundant modems |

### 5.4 Autonomy Software Stack ("FERNRIDE Driver")

The AI-powered autonomy stack includes:

- **Localization:** Multi-sensor fusion (vSLAM/GPS/LiDAR) with centimeter-level accuracy
- **Perception:** Real-time object detection and classification using camera, LiDAR, and radar fusion
- **Prediction:** Trajectory prediction for detected objects
- **Planning:** Dynamic path planning with collision avoidance
- **Safety layer:** Independent safety validation layer (separate from planning/control)
- **Hazard zone monitor:** Detects obstacles and automatically adjusts vehicle speed adaptively (one of 10 integrated safety functions identified during TUV SUD certification)

### 5.5 Fleet Management Suite

Three core modules:

1. **Task Manager** -- Manages transport assignments with three TOS interaction modes:
   - *Direct Dispatch:* TOS assigns individual tasks; Fernride executes and reports
   - *Batch Scheduling:* TOS provides task sets; Fernride schedules and dispatches
   - *Just-in-Time:* TOS specifies delivery windows; Fernride times arrivals precisely
2. **Traffic Manager** -- Coordinates vehicle movements across the operational area
3. **Fleet Manager** -- Monitors vehicle health, operator assignments, and operational status

Open API integration with existing logistics IT systems, Terminal Operating Systems (TOS), and Equipment Control Systems (ECS).

### 5.6 Vehicle Kit (Hardware)

The Fernride Vehicle Kit is the hardware package installed on partner vehicles:

- Drive-by-wire actuators (interfaces with existing vehicle DBW systems)
- Sensor suite (cameras, LiDAR, radar, ultrasonic)
- Processing unit (dual-compute: Linux + QNX safety ECU)
- Connectivity module (dual routers, LTE/5G modems)
- Emergency stop systems (red e-stop buttons on every side of vehicle)
- Redundant power supplies
- **Installation options:** Retrofit existing vehicles OR factory-fit at OEM assembly line (e.g., Terberg)

---

## 6. Teleoperation Platform Architecture

### Remote Operator Station

The teleoperator workstation is a cockpit-style setup:

- **Controls:** Steering wheel, accelerator pedal, brake pedal, joystick, control handles
- **Displays:** Multiple high-definition screens replacing traditional windows and mirrors, providing 360-degree view from vehicle cameras
- **Safety:** CE-certified safety button, wheel, and pedals
- **Situational awareness:** Extended field-of-vision beyond what a physical driver would have (cameras cover blind spots)
- **Handover protocols:** Seamless transition between teleoperation and autonomous mode

### Data Flow Architecture

```
Vehicle                                    Operator Station
+------------------+                      +------------------+
| Cameras (HD)     |                      | HD Displays      |
| LiDAR            |  <-- uRLLC over -->  | Steering/Pedals  |
| Radar            |  <-- LTE/5G    -->   | Joystick         |
| Vehicle Sensors  |  <-- TLS 1.3  -->    | E-Stop           |
| Processing Unit  |  <-- <100ms   -->    | Fleet Dashboard   |
| Connectivity Mod |                      |                  |
+------------------+                      +------------------+
         |                                         |
         v                                         v
    +--------------------------------------------------+
    |           Cloud Management Suite                  |
    |  (Task Manager / Traffic Manager / Fleet Manager) |
    +--------------------------------------------------+
```

### Latency Performance

- **End-to-end latency:** < 100ms on 4G/LTE
- **Includes:** Camera capture -> encoding -> transmission -> decoding -> display + operator input -> encoding -> transmission -> vehicle actuation
- **Future optimization:** Will further improve when 5G becomes standard
- **Connectivity guarantee:** Redundant modems, continuous bandwidth/latency monitoring, thorough pre-deployment site assessment

### Operator-to-Vehicle Ratios

| Mode | Ratio | Description |
|------|-------|-------------|
| Tele-DRIVE | 1:1 | Full remote driving, one operator per vehicle |
| Tele-ASSIST (current) | 1:4 | One operator monitors 4 autonomous trucks, intervening only for exceptions |
| Tele-ASSIST (target) | 1:50 | As autonomy matures, single operator managing fleet of up to 50 vehicles |

---

## 7. TUV SUD Certification

**Milestone:** Fernride became the first company in Europe to receive TUV SUD certification for an autonomous terminal tractor (July 2025).

### Certification Details

| Aspect | Detail |
|--------|--------|
| **Standard** | EU Machinery Directive (2006/42/EC) |
| **Scope** | Complete autonomous vehicle platform: vehicle, sensors, computers, and software |
| **Areas validated** | Safety, Cybersecurity, System reliability |
| **Safety functions** | 10 integrated safety functions identified and validated (e.g., "hazard zone monitor" that detects obstacles and adjusts speed adaptively) |
| **Process** | Risk scenario identification -> mitigation strategy development -> implementation -> extensive field testing -> statistical reliability proof -> independent third-party audit |
| **Significance** | Establishes pathway for CE compliance and industrial deployment across all EU member states |

Benedikt Pulver, Head of Machine Safety at TUV SUD: *"FERNRIDE is the first to receive TUV SUD certification for a specific port application involving autonomous trucks. This milestone could establish a new benchmark for safety and compliance in autonomous trucking for terminal applications."*

### What This Enables

- Operations without safety drivers in the vehicle cabin (truly driverless)
- Commercial revenue generation (not just piloting/testing)
- Scalable deployment across European container terminals
- Regulatory pathway for broader EU certification

---

## 8. Deployments & Customer Operations

### 8.1 HHLA TK Estonia (Container Terminal -- Flagship)

| Aspect | Detail |
|--------|--------|
| **Location** | Muuga seaport, near Tallinn, Estonia |
| **Start** | Collaboration began January 2023; validation phase from April 2023 |
| **Status** | Operational transition to driverless operations (post TUV SUD certification, July 2025) |
| **Vehicles** | 2-3 automated terminal tractors in full operations |
| **Use case** | Horizontal container transport in mixed-traffic terminal |
| **Operating environment** | Unfenced mixed-traffic area with manual trucks, external vehicles, equipment, pedestrians. Includes RoRo and train track areas. Extreme weather: strong winds, heavy rain, snowfall, prolonged cold. |
| **Operator model** | 1:4 ratio -- one remote operator monitoring 4 autonomous trucks |
| **Target autonomy** | 80-90% autonomous operation |
| **Milestone** | First European company to operate terminal tractors without safety drivers while generating commercial revenue |
| **Integration** | "Fully integrated into operations and invisible to daily workflows" -- no major effort required from operations team |

### 8.2 DB Schenker (Yard Logistics)

| Aspect | Detail |
|--------|--------|
| **Location** | Nuremberg, Germany (initial); Tilburg, Netherlands (expansion) |
| **Start** | June 2020 (pilot project) |
| **Vehicle** | KAMAG E-Wiesel (electric swap body lift truck, drive-by-wire capable) |
| **Use case** | Driverless yard shunting -- transfer of swap bodies |
| **Technology** | Teleoperation via LTE with uRLLC protocol |
| **Results** | Driverless processes mapped in real-world operations without interference. Teleoperated vehicles matched manual operations in docking/maneuvering accuracy. Safety driver present but never needed to activate. |
| **Relationship** | DB Schenker also invested in Fernride via Schenker Ventures |

### 8.3 Volkswagen Wolfsburg (Production Logistics)

| Aspect | Detail |
|--------|--------|
| **Location** | Volkswagen Wolfsburg Factory (world's largest automotive production plant, 750,000-800,000 vehicles/year) |
| **Start** | 2022 (first productive operations) |
| **Vehicles** | 2 automated trucks |
| **Use case** | Component transportation within manufacturing facility |
| **Quote** | Tobias Rohricht, VW Head of Transport Planning: *"FERNRIDE's approach to autonomy with human-in-the-loop provides a solution that improves operational efficiency without compromising reliability, paving the way towards full automation in the future."* |

### 8.4 ATLAS-L4 (Open Road Autonomous Trucking -- R&D)

| Aspect | Detail |
|--------|--------|
| **Project** | German government-funded initiative (EUR 59.1M from Federal Ministry for Economic Affairs and Climate Action) |
| **Duration** | 2022-2025 (3 years) |
| **Objective** | Deploy autonomous trucks on real-world German highways for the first time |
| **Fernride's role** | Contributed human-assisted autonomy and teleoperation technology for remote oversight and edge case intervention |
| **Consortium** | 12 partners: MAN Truck & Bus (lead), Knorr-Bremse, LEONI, Bosch Automotive Steering, Fernride, BTC Embedded Systems, Fraunhofer AISEC, TU Munich, TU Braunschweig, TUV SUD, Autobahn GmbH, WIVW GmbH (~150 engineers) |
| **Significance** | Established foundation for scaling from controlled environments (yards, terminals) to open-road hub-to-hub logistics |

---

## 9. Key Partnerships

### 9.1 Terberg Special Vehicles (Terminal Tractors)

- **Partnership since:** 2021
- **Scope:** Series production of automated terminal tractors. Terberg manufactures fully electric and diesel-powered terminal tractors with drive-by-wire interface. Fernride's hardware kit (computing, connectivity, sensor suite) integrated on Terberg's assembly line.
- **Vehicle:** Terberg AutoTUG -- architecture provides third-party interface for controlling all relevant vehicle functions
- **Initial rollout:** First 100 trucks to container terminals, production plants, and distribution centers
- **Maintenance:** Leverages Terberg's global maintenance and service network for maximum uptime
- **Production start:** 2024 (series production, ready for gradual autonomy)

### 9.2 Continental (Sensor Technology)

- **Scope:** Advanced sensing technology for autonomous terminal tractors
- **Continental sensors integrated:**
  - ARS430 Long Range Radar (advanced signal processing, smart antenna design)
  - FSC336 Far Look Satellite Cameras (extended-range imaging)
  - SVC331 Surround View Cameras (360-degree, low-light capable)
- **Focus:** Safety in high-density container terminal environments with mixed traffic

### 9.3 Krone Group (Trailer Automation)

- **Partnership since:** September 2022
- **Scope:** Strategic partnership to automate logistics/transport, especially trailers
- **Development:** Automated trailer with secondary function automation (coupling process, door opening/closing, sensory environment analysis)
- **Krone contribution:** International sales, service, and data structures
- **Financial:** Krone also made a direct financial investment in Fernride

### 9.4 KAMAG (Electric Yard Trucks)

- **Vehicle:** KAMAG E-Wiesel (electric swap body lift truck)
- **Scope:** Retrofit of drive-by-wire capable electric trucks with Fernride's teleoperation/autonomy kit
- **Deployed at:** DB Schenker pilot projects

### 9.5 NVIDIA

NVIDIA appears as a technology partner on Fernride's platform page and in the "Trusted by industry leaders" section of Fernride's website. The exact nature of the partnership is not publicly detailed, but Fernride's compute stack includes NVIDIA as a listed partner alongside Intel and NXP. This likely involves NVIDIA GPU compute for perception/AI workloads on the vehicle.

### 9.6 Gaussin

Listed as a vehicle partner on Fernride's company page.

---

## 10. Airport & Port Expansion Context

### Current Port Operations

Fernride's primary operational domain is container terminals and logistics yards -- environments that share significant operational characteristics with airport airside operations:

- Mixed-traffic with pedestrians, manual vehicles, and heavy equipment
- Repetitive point-to-point transport routes
- 24/7 operations in all weather conditions
- Safety-critical environments requiring certification
- Terminal Operating System integration requirements

### Airport Airside Relevance

While Fernride has not made public announcements specifically about airport airside expansion, their technology stack is directly applicable:

- **Terminal tractors** are functionally identical to airport baggage/cargo tractors
- **Terberg** (Fernride's manufacturing partner) produces vehicles used in both port and airport environments
- **Teleoperation architecture** works over standard LTE networks, available at airports
- **TUV SUD certification** under EU Machinery Directive provides a regulatory framework transferable to airport ground operations
- **Vehicle-agnostic retrofit approach** means existing airport GSE (Ground Support Equipment) could be adapted

The broader industry is moving toward autonomous airside operations (e.g., TractEasy EZTow at Singapore Changi Airport for autonomous baggage towing). Fernride's human-assisted autonomy model -- with its proven safety certification and 1:4 operator ratio -- represents a compelling approach for the safety-critical airside environment where pure autonomy faces significant regulatory hurdles.

---

## 11. Defense Expansion & Quantum Systems Acquisition

### Defense Pivot (2025)

In September 2025, Fernride raised EUR 18M to expand into European defense logistics:

- **Rationale:** Personnel shortages in armed forces; need for safer operations in high-risk zones; reallocation of skilled personnel from transport to strategic roles
- **Technology adaptation:** Vehicle-agnostic retrofitting, rapid deployment, human oversight mechanisms transfer directly to military applications
- **Early trials:** Tests conducted with the German Armed Forces (Bundeswehr)
- **Strategic framing:** CEO Kramer: *"Europe urgently needs sovereign autonomy solutions"*

### Quantum Systems Acquisition (December 2025)

- **Acquirer:** Quantum Systems -- Europe's market leader in AI-powered unmanned aerial systems
- **Date:** December 17, 2025
- **Financial terms:** Not disclosed (Fernride had raised EUR 75M+ in VC)
- **Strategic rationale:** Expand from aerial unmanned systems to multi-domain autonomy (air + ground)
- **Integration plan:** Fernride's technology integrated into MOSAIC UXS (Quantum Systems' autonomous mission software) for coordinated air-ground operations
- **Defense application:** Quantum Systems cited operational experience in Ukraine demonstrating value of coordinated air and ground robotics
- **Simultaneous:** Quantum Systems secured a contract with the German Armed Forces alongside the acquisition

---

## 12. Business Model

### Transportation as a Service (TaaS)

Fernride operates a **TaaS (Transportation as a Service)** model, not a traditional hardware sale:

- **One contract** covering: autonomous system hardware, software, integration, and ongoing support
- **Includes:** The right electric truck for the job, equipped with Fernride's teleoperation vehicle kit
- **No infrastructure required:** No civil works, magnetic strips, dedicated lanes, or external sensor placement needed
- **Phased deployment:** Start with 1-2 tractors -> refine -> scale incrementally
- **Revenue drivers:**
  - Per-vehicle or per-operation service fees
  - Fleet management software platform
  - Integration services
  - Ongoing teleoperation support

### Target Market

- **Addressable market:** Yard trucking represents a $25B market opportunity across Europe and North America
- **Market driver:** European truck driver shortage projected to expand from 400,000 to 2 million by 2026
- **Segments:** Container terminals, production logistics, distribution centers, defense logistics, hub-to-hub open road (future)

### Key Customer Value Propositions

1. **Immediate operational ROI** -- works today, not years from now
2. **No infrastructure modification** -- deploys into existing yards/terminals as-is
3. **Driver shortage solution** -- one operator manages multiple vehicles remotely
4. **Claimed 99.9% operational reliability**
5. **Electric vehicles** -- sustainability/emissions reduction
6. **Scalable** -- add vehicles without proportional headcount increase

---

## 13. Competitive Positioning

### Key Differentiators

1. **Only company in Europe with TUV SUD certification** for autonomous terminal tractors
2. **First European company** to operate terminal tractors without safety drivers while generating commercial revenue
3. **Teleoperation-first approach** eliminates the "long tail" problem of edge cases that plagues pure-autonomy companies
4. **Vehicle-agnostic platform** -- works with Terberg, KAMAG, Gaussin, and can retrofit existing fleets
5. **Progressive autonomy** creates a data flywheel: every teleoperator intervention generates training data for the autonomy stack
6. **Series production partnership** with Terberg (not one-off prototypes)
7. **Insurance-grade safety** -- Munich Re Ventures as investor brings insurance industry validation

### Competitive Landscape Context

- **Pure autonomy players** (e.g., TuSimple, Aurora, Gatik in U.S.) pursue full L4 autonomy before commercial deployment -- higher technical risk, longer time to revenue
- **Port automation incumbents** (e.g., Kalmar, ZPMC) use AGV-style automation requiring significant infrastructure modification (magnetic strips, dedicated lanes)
- **Fernride's position:** Near-term revenue from teleoperation today, with a credible technology pathway to full autonomy, and no infrastructure requirements

---

## 14. Timeline of Key Milestones

| Date | Milestone |
|------|-----------|
| 2009-2019 | Decade of teleoperation research at TUM, Chair of Automotive Engineering |
| 2019 | Fernride founded by Kramer, Fisser, and Georg |
| 2020 | Seed funding (~EUR 10M+) from Speedinvest, Fly Ventures, UnternehmerTUM |
| June 2020 | Pilot project with DB Schenker and KAMAG (driverless yard shunting, Nuremberg) |
| 2021 | Terberg partnership initiated |
| 2022 | First productive operations at Volkswagen Wolfsburg (2 automated trucks). Krone strategic partnership signed. ATLAS-L4 project launched. |
| January 2023 | HHLA TK Estonia collaboration begins |
| March 2023 | Terberg series-production partnership announced (first 100 trucks) |
| June 2023 | Series A first close: $31M |
| September 2023 | Series A second close: $19M (total $50M). Klaus Kleinfeld joins as Chairman. |
| April 2023 | HHLA TK Estonia validation phase begins |
| 2024 | Terberg automated terminal tractor series production starts. DB Schenker expansion to Tilburg, Netherlands. |
| July 2025 | TUV SUD certification achieved -- first in Europe for autonomous terminal tractors. Driverless operations begin at HHLA TK Estonia. |
| September 2025 | Series A extension: EUR 18M for defense logistics expansion |
| December 2025 | Acquired by Quantum Systems. Quantum Systems secures German Armed Forces contract. |

---

## Sources

- [Fernride Company Page](https://www.fernride.com/company)
- [Fernride Platform (Technology)](https://www.fernride.com/our-platform)
- [Fernride Teleoperation](https://www.fernride.com/teleoperation)
- [Fernride Container Terminals](https://www.fernride.com/container-terminals)
- [Fernride $50M Series A Announcement](https://www.fernride.com/news/series-a-50m)
- [Fernride $31M Series A First Close](https://www.fernride.com/news/artikel-37)
- [Fernride EUR 18M Defense Expansion](https://www.fernride.com/news/additional-18m-to-expand-into-defence)
- [DB Schenker Case Study: Driverless Yard Shunting](https://www.fernride.com/news/case-study-driverless-yard-shunting)
- [HHLA TK Estonia: Learnings from Over One Year of Live Operations](https://www.fernride.com/news/hhla-tk-estonia-and-fernride-insights-and-learnings)
- [HHLA TK Estonia Driverless Operations Following TUV SUD Certification](https://www.fernride.com/news/fernride-hhla-driverless-machinery-directive)
- [Fernride + Terberg Series Production](https://www.fernride.com/news/artikel-36)
- [Fernride Teleoperation Kit in Terberg AutoTUG](https://www.fernride.com/news/fernride-implements-teleoperation-kit-in-terberg)
- [Fernride + Continental Radar/Camera Integration](https://www.fernride.com/news/how-fernride-and-continental-are-optimizing-horizontal-transport)
- [Krone + Fernride Strategic Partnership](https://www.fernride.com/news/strategic-partnership-for-automated-logistics)
- [ATLAS-L4 Project Conclusion](https://www.fernride.com/news/atlas-l4-project-conclusion)
- [Fernride Autonomous Step Forward (Haag, Murphy hires)](https://www.fernride.com/news/fernride-takes-an-important-step-towards-autonomous-future)
- [Fernride Solving Integration Pain](https://www.fernride.com/news/solving-integration-pain-fernrides-approach-to-autonomous-terminal-tractor-deployment)
- [Fernride Sensor Perception in Ports](https://www.fernride.com/news/understanding-autonomous-vehicles-in-ports-how-do-they-see)
- [TUV SUD Certification -- Tech.eu](https://tech.eu/2025/07/10/certified-safe-proven-real-fernride-becomes-first-to-achieve-tuv-sud-approval-for-autonomous-terminal-tractors/)
- [Fernride EUR 18M Defense -- Tech.eu](https://tech.eu/2025/09/04/fernride-bags-eur18m-series-a-extension-as-it-expands-into-defence/)
- [Quantum Systems Acquires Fernride -- Dronelife](https://dronelife.com/2025/12/17/quantum-systems-acquires-fernride-ground-autonomy/)
- [Quantum Systems Acquires Fernride -- Munich Startup](https://www.munich-startup.de/en/115818/quantum-systems-takes-over-fernride/)
- [Fernride $50M Funding -- Tech.eu](https://tech.eu/2023/09/20/fernrides-50m-funding-boost/)
- [Fernride Series A $19M Extension -- Robotics 24/7](https://www.robotics247.com/article/fernride_gets_another_19m_series_a_funding_autonomous_yard_trucks)
- [VW Praises Fernride -- EV Magazine](https://evmagazine.com/articles/vw-praises-fernrides-autonomous-electric-truck-innovation)
- [DB Schenker Fernride Tilburg -- trans.info](https://trans.info/en/db-schenker-tests-driverless-yard-logistics-with-fernrides-teleoperation-platform-247234)
- [Fernride FreightWaves -- First Driverless Operations](https://www.freightwaves.com/news/fernride-launches-first-driverless-terminal-tractor-operations-in-europe)
- [Terberg AutoTUG Fernride Implementation](https://www.terbergspecialvehicles.com/en/news/fernride-implements-teleoperation-kit-in-terberg-autotug/)
- [EMEA Entrepreneur -- Founder Profiles](https://emeaentrepreneur.com/hendrik-jean-michael-maximilian/)
- [Fernride Crunchbase](https://www.crunchbase.com/organization/fernride)
