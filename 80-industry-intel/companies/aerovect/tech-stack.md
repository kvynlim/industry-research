# AeroVect -- Competitor Deep Dive

> Last updated: 2026-03-22
> Classification: Competitor Intelligence

---

## 1. Company Overview

| Field | Detail |
|---|---|
| Legal name | AeroVect Technologies Inc. |
| Founded | June 2020 (incorporated); garage prototype built spring 2020 in Bay Area |
| HQ | South San Francisco, CA |
| Headcount | ~50 (as of early 2026) |
| Total funding | $27.1 M |
| Stage | Series A |
| Core product | **AeroVect Driver** -- autonomous driving platform for airport ground support equipment |

AeroVect builds software-defined retrofit autonomy for airside GSE. The company's thesis is that airports and ground handlers should not need to purchase new vehicles to gain autonomy; instead, the AeroVect Driver kit can be bolted onto any OEM's existing baggage/cargo tractors. This OEM-agnostic retrofit model is the central differentiator versus purpose-built competitors like reference airside AV stack.

---

## 2. Founding & Team

### Co-founders

**Raymond Wang (CEO)** -- Born in China, raised in Vancouver. Earned A.B. in Computer Science from Harvard SEAS (class of 2020). As a high-schooler, designed airflow technology for aircraft cabins that reduces disease transmission (2015 Intel ISEF); the patent was later commercialized by a cabin interiors manufacturer. Summer internships at Delta Air Lines and Microsoft during Harvard years. Co-founded AeroVect during his final semester.

**Eugenio Donati (Co-founder)** -- Grew up in a small town in Italy. Studied Economics at Harvard, cross-registered at MIT's International Center for Air Transportation (ICAT). Met Raymond Wang through a mutual friend while trying to start a transportation club at Harvard.

Both founders were named to **Forbes 30 Under 30 -- Manufacturing & Industry (2022)**.

### Origin story

Wang and Donati moved to the San Francisco Bay Area in spring 2020. They bought a secondhand baggage tractor from Indiana, shipped it to the garage of a rented house, and built their first autonomous prototype for under $200K (per Xfund spotlight). One of the company's earliest investors was **Xfund**, a VC firm with close ties to Harvard SEAS.

### Key hires / team composition

The engineering team is drawn from Argo AI, Apple, Cruise, Aurora, Ford, with academic backgrounds from Harvard, Stanford, and MIT. Notable:

- **Aaron Botwick -- Head of Safety.** Previously at Cruise and Aurora. Expertise in system safety, safety cases, and curriculum development. Joined PAVE (Partners for Automated Vehicle Education) on AeroVect's behalf. Credited with pioneering "driver-out safety cases" for airside operations.

### Y Combinator status

Despite being widely described as "YC-backed" in industry circles, direct confirmation of a specific YC batch (W21 or S21) could not be verified through YC's public directory or Crunchbase. Raymond Wang's Harvard alumni profile references participation in a "W20 program at Y Combinator," but the YC company page for AeroVect returns a 404. It is possible the company participated in YC but is no longer listed publicly, or the association is informal (e.g., via YC-affiliated investors like Liquid 2 Ventures, which was co-founded by Joe Montana and is a known YC ecosystem fund).

---

## 3. Funding History

| Round | Date | Amount | Lead Investor | Notes |
|---|---|---|---|---|
| Pre-seed / Xfund | 2020-2021 | Undisclosed | Xfund | Harvard-affiliated VC; earliest backer |
| Seed | 2022 | Undisclosed | Graphene Ventures | |
| Series A | Sept 19, 2024 | $18 M | Nava Ventures | 7 investors in round |
| Seed VC-IV | Apr 1, 2025 | Undisclosed | -- | Per Tracxn |
| **Total raised** | | **$27.1 M** | | 13 known investors total |

**Known investors:** Nava Ventures, Graphene Ventures, Liquid 2 Ventures, Gold House Ventures, Xfund, Bain & Company (strategic). Additional unnamed investors bring the total to 13.

---

## 4. Technology Stack

### 4.1 Sensor Suite

The AeroVect Driver retrofit kit equips existing GSE with sensors "commonly found in self-driving cars":

| Sensor type | Role | Notes |
|---|---|---|
| **3D LiDAR** | Obstacle detection, 3D mapping, object classification | Multiple units for 360-degree coverage |
| **Cameras** | Lane-keeping, object classification, scene understanding | Multi-camera array |
| **Radar** | Object detection (likely for weather robustness) | Confirmed by perception intern job posting requirements |
| **GNSS/GPS-RTK** | Centimeter-level positioning | Powered by **Point One Navigation** RTK corrections; network of thousands of ground reference stations; 99.9% uptime |

The system provides **360-degree perception with real-time data feeds** and is described as having "unmatched driving environment awareness and rules-based behavior."

### 4.2 Positioning & Localization

AeroVect uses **Point One Navigation's Real-Time Kinematic (RTK) corrections** for centimeter-level accuracy. Traditional GPS provides only meter-level precision, which is insufficient for safe airside navigation near aircraft and jet bridges. Point One's RTK network leverages thousands of ground-based reference stations transmitting real-time correction data.

### 4.3 Software Stack

Inferred from job postings and technical descriptions:

| Layer | Technology |
|---|---|
| **Languages** | C++, Python |
| **Deep learning** | PyTorch, TensorRT (NVIDIA inference optimization) |
| **Middleware** | ROS2 (Robot Operating System 2) |
| **OS** | Linux |
| **Perception modules** | Object detection, tracking, sensor fusion (multi-modal: camera + LiDAR + radar), scene understanding |
| **Planning & control** | Rules-based behavior engine + ML-based driving policy |
| **Data pipeline** | Proprietary; trained on "world's largest airside driving dataset" |

The software architecture follows a standard autonomous driving stack: **perception -> localization -> prediction -> planning -> control**. The perception team works across computer vision, sensor processing, sensor fusion, and machine learning.

### 4.4 AeroVect Explorer (Mapping Kit)

A separate hardware kit that can be installed on any vehicle to rapidly build a **digital twin** of an airport:

- Creates a complete 3D map of a major airport in **under 2 hours**
- Has mapped **half of America's top 10 airports**
- Captures data across diverse geographies, weather (sun, rain, snow), and times of day
- Feeds into the "world's largest proprietary dataset of airside driving data" accumulated over 18+ months

### 4.5 Retrofit Approach

The AeroVect Driver is designed as a **bolt-on kit** using commercially available components:

- OEM-agnostic: retrofitted platforms from all leading GSE manufacturers
- No new vehicle purchase required -- installs on existing baggage/cargo tractors
- AeroVect engineers visit the site, perform 3D mapping, then install the sensor/compute unit
- System is "trained to recognize ground support equipment, aircraft, runway markings, and navigate active taxiways"

### 4.6 Compute Platform

Not publicly disclosed. Given TensorRT usage, the compute platform is almost certainly **NVIDIA-based** (likely Jetson AGX Orin or NVIDIA DRIVE series). The use of TensorRT for inference optimization is a strong signal of NVIDIA GPU hardware.

---

## 5. Product Capabilities

### AeroVect Driver -- Key capabilities

- Autonomous point-to-point transport of baggage and cargo on airport ramps
- Navigation of active taxiways including **live aircraft crossings** (tens of thousands completed)
- Operation in diverse conditions: day, night, fog, rain, snow
- In foggy conditions, AeroVect's system safely navigated the airfield when human drivers could not see clearly
- Object detection and classification: aircraft, other GSE vehicles, people, runway markings
- Lane-keeping within designated driving corridors
- Rules-based behavioral engine for airside-specific scenarios

### Operational readiness

- Described as "deployed today in production operations" (per AeroVect website)
- Has completed "tens of thousands of live aircraft crossings"
- Currently operates with safety operators in the loop (autonomous GSE operator roles posted for Atlanta)
- Working toward fully "driver-out" operations; Aaron Botwick's team is building the safety case

---

## 6. Airport Deployments & Partnerships

### Major partnerships

| Partner | Type | Status | Details |
|---|---|---|---|
| **GAT Airline Ground Support** | Ground handler (72 US/Canada locations) | Active | First US partnership of its kind; pilot at SFO completed 2022; target of 50 AeroVect-equipped vehicles across GAT stations |
| **dnata** | Global ground handler (Emirates Group) | Active | First major international handler to pilot autonomous GSE; initial US airport pilot spring 2023; target of 100 vehicles worldwide including DXB and DWC |
| **Delta Air Lines** | Airline | Pilot completed | Formal evaluation at Atlanta (ATL) in October 2022; tested across shifts, day/night, various weather; "tractor performed well" |
| **Unnamed US legacy carrier** | Airline | Partnership announced (pending public disclosure as of early 2023) | Referenced in Airside International profile |

### Known airport deployments / test sites

| Airport | Year | Partner | Activity |
|---|---|---|---|
| **SFO** (San Francisco International) | 2022 | GAT | Initial pilot; baggage tractor bag room to aircraft |
| **ATL** (Hartsfield-Jackson Atlanta) | 2022 | Delta Air Lines | Formal technology evaluation |
| **DXB** (Dubai International) | 2023+ | dnata | Planned deployment |
| **DWC** (Dubai World Central / Al Maktoum) | 2023+ | dnata | Planned deployment |
| Multiple additional US airports | 2022-present | Various | Mapped "half of America's top 10 airports" |

Note: dnata later deployed **TractEasy EZTow** autonomous tractors at DWC in July 2025 (6 vehicles). This may indicate AeroVect's dnata relationship evolved, or that dnata is evaluating multiple autonomous GSE providers simultaneously.

---

## 7. Business Model

### Revenue model: Automation-as-a-Service

AeroVect operates as a **turnkey automation provider**, not a vehicle manufacturer:

- **Does NOT sell vehicles** -- retrofits existing customer-owned GSE fleets
- Revenue likely structured as recurring software/service fees (SaaS-like model)
- Value proposition framed as: "reduces and locks in predictable operating cost, insulating from future labor market volatility and staffing shortages, while enabling growth without increasing headcount"
- Specific pricing not publicly disclosed

### Retrofit vs. new-build thesis

AeroVect explicitly positions against the new-build approach:

> "We don't want people to buy new vehicles or new GSE just to make them autonomous."

This is a deliberate contrast to reference airside AV stack (purpose-built autonomous baggage/cargo tug) and TractEasy/TLD (purpose-built EZTow). The retrofit model offers:

- Lower upfront CAPEX for customers (no new vehicle purchase)
- Faster fleet-wide adoption (upgrade existing assets vs. procurement cycles)
- OEM agnosticism reduces vendor lock-in
- Trade-off: less hardware optimization than purpose-built platforms

---

## 8. Competitive Landscape Comparison

### AeroVect vs. reference airside AV stack

| Dimension | AeroVect | reference airside AV stack |
|---|---|---|
| **Approach** | Software retrofit kit for existing GSE | Purpose-built autonomous vehicle (autonomous baggage/cargo tug) |
| **Vehicle** | Any OEM baggage/cargo tractor | Custom "clean sheet" design with robotic arms, tank-turn, sideways drive |
| **Autonomy origin** | "Born in Silicon Valley" -- software-first | UK engineering/manufacturing company -- hardware-first |
| **Loading/unloading** | Manual (human loads/unloads; vehicle drives autonomously) | Autonomous via bi-directional robotic arms |
| **CAPEX for customer** | Low (retrofit existing fleet) | High (purchase new purpose-built vehicles) |
| **Scalability** | High (bolt onto any tractor) | Lower (each unit is a new vehicle purchase) |
| **Deployment footprint** | US-focused (SFO, ATL, expanding); dnata international | 6 airports globally; Changi, Schiphol, Teesside, others |
| **Sensor stack** | LiDAR + cameras + radar + GPS-RTK | LiDAR + 360-degree cameras |
| **Weather handling** | Demonstrated in fog, rain, snow | "Rainfall algorithm" for up to 50mm/hr precipitation |
| **Stage** | Series A ($27.1M raised) | Public company (LSE: AURR); ~GBP 30M market cap |

### AeroVect vs. TractEasy (EasyMile/TLD)

| Dimension | AeroVect | TractEasy EZTow |
|---|---|---|
| **Approach** | Software retrofit | Purpose-built autonomous tractor (by TLD, autonomy by EasyMile) |
| **Capacity** | Depends on host vehicle | 20-ton load; up to 4 ULDs |
| **Positioning** | GPS-RTK (Point One) | Centimeter-precise localization; V2I communication |
| **Deployment scale** | US-focused + dnata international | "Most widely deployed autonomous tow tractor in the world" -- Narita, Toulouse-Blagnac, Changi, DWC |
| **Maturity** | Production operations (with safety operators) | Driver-out trials at some sites |

### AeroVect vs. ThorDrive

| Dimension | AeroVect | ThorDrive |
|---|---|---|
| **Sensors** | LiDAR + cameras + radar + RTK | Velodyne LiDAR-based |
| **Airport** | SFO, ATL, others | CVG (Cincinnati/Northern Kentucky) |
| **Status** | Active, funded, scaling | Less recent public activity |

### Other competitors

- **Moonware** -- autonomous airport logistics
- **Juvo Robotics** -- autonomous aircraft ground handling with AI/robotics
- **Ghost Robotics** -- listed as competitor (likely for perimeter/security use case overlap)

---

## 9. Regulatory Strategy

### FAA landscape (as of 2025-2026)

The FAA has **not authorized** autonomous vehicle technology for operational use at Part 139 certificated airports. However:

- **Bulletin 25-02 (May 2025):** AGVS may be operationally tested in movement areas that are **closed to aircraft operations** and their associated safety areas
- Remote/low-congestion areas of airports are viewed as safer environments for testing
- Airport sponsors must ensure "associated risks with AGVS are understood, properly considered, and mitigated"
- Airports should not close areas exclusively for AGVS testing

### AeroVect's regulatory approach

- **Safety case methodology:** Led by Aaron Botwick (Head of Safety), formerly of Cruise and Aurora, who "pioneered driver-out safety cases" for airside
- **PAVE membership:** AeroVect joined Partners for Automated Vehicle Education, signaling engagement with the AV policy ecosystem
- **Incremental deployment:** Operating with safety operators present while building the safety case for fully autonomous (driver-out) operations
- **Data-driven justification:** Claims "world's largest airside driving dataset" and "tens of thousands of live aircraft crossings" as evidence base for safety arguments
- **Airport-by-airport:** Regulatory approval is effectively managed at the individual airport level with FAA oversight, not through a single national certification

### Key regulatory insight

There is no FAA "type certification" equivalent for autonomous GSE. The path to deployment runs through individual airport sponsors (who hold the Part 139 certificate) working with their FAA regional inspectors. This creates a fragmented but navigable regulatory landscape where early adopter airports can move ahead of laggards.

---

## 10. Strengths & Risks

### Strengths

1. **Retrofit model is capital-efficient for customers** -- no new vehicle purchase; reduces adoption friction
2. **OEM-agnostic** -- can address the entire installed base of GSE, not just one manufacturer
3. **Largest airside driving dataset** -- significant data moat if claims are accurate
4. **Strong team pedigree** -- Argo AI, Cruise, Aurora, Apple alumni; Harvard/Stanford/MIT academic roots
5. **Production operations** -- already operating at scale at US airports (not just demos)
6. **Software-defined** -- can improve via OTA updates without hardware changes

### Risks / open questions

1. **YC affiliation unclear** -- frequently described as "YC-backed" but direct confirmation is elusive; may be overstated
2. **dnata relationship may have cooled** -- dnata deployed TractEasy EZTow at DWC in July 2025 rather than AeroVect; unclear if the 100-vehicle partnership target is still on track
3. **Driver-out timeline uncertain** -- still operating with safety operators; no public timeline for fully autonomous operations
4. **FAA regulatory headwinds** -- no federal framework for autonomous GSE in active movement areas; each airport is a separate negotiation
5. **Revenue model unproven at scale** -- SaaS pricing for GSE autonomy is novel; unit economics not publicly validated
6. **Sensor hardware undisclosed** -- specific LiDAR, camera, and compute vendors not revealed publicly; makes independent assessment of BOM cost difficult
7. **Small company (50 people)** competing against well-resourced players: reference airside AV stack (public company), TractEasy/TLD (backed by TLD Group, a major GSE OEM), and potentially major AV tech stacks entering the market

---

## 11. Relevance to Our Autonomous Airside Stack

AeroVect is the most directly comparable company to an autonomous airside operation, with several key takeaways:

1. **Retrofit vs. new-build is a strategic choice.** AeroVect chose retrofit to minimize customer CAPEX and accelerate adoption. For our world models work, this means the perception/planning stack must handle diverse vehicle kinematics and sensor mounting positions.

2. **Sensor fusion (LiDAR + camera + radar + RTK) is the consensus stack** for airside autonomy. AeroVect, reference airside AV stack, and TractEasy all converge on LiDAR + cameras + GNSS-RTK as the minimum viable sensor set. Radar is the differentiator AeroVect adds.

3. **The mapping/digital twin approach (AeroVect Explorer)** for rapid airport onboarding is noteworthy -- 2 hours to map a major airport. This suggests HD mapping is considered essential for airside autonomy, rather than pure online perception.

4. **Safety case development** (Aaron Botwick's work) is the regulatory bottleneck. The path to driver-out operations runs through building an accepted safety case, not through a single certification.

5. **Data scale matters.** AeroVect's claim of the "world's largest airside driving dataset" is a competitive moat. Any competitor needs a strategy for accumulating equivalent airside driving data.

---

## Sources

- [AeroVect official website](https://www.aerovect.com/)
- [Point One Navigation -- AeroVect case study](https://pointonenav.com/news/aerovects-autonomous-gse-case-study/)
- [Harvard SEAS -- Raymond Wang alumni profile](https://seas.harvard.edu/news/alumni-profile-raymond-wang-ab-20)
- [Ground Handling International -- "AeroVect: Dreams become a reality"](https://www.groundhandlinginternational.com/content/interviews/aerovect-dreams-become-a-reality)
- [Airside International -- "AeroVect: A start-up success story"](https://airsideint.com/issue-article/aerovect-a-start-up-success-story/)
- [Aviation Pros -- GAT partnership announcement](https://www.aviationpros.com/gse/gse-technology/press-release/21260685/aerovect-technologies-inc-aerovect-and-gat-announce-first-partnership-in-america-to-deploy-autonomous-driving-across-us-airport-tarmacs)
- [Aviation Pros -- dnata partnership announcement](https://www.aviationpros.com/gse/gse-technology/press-release/21280655/aerovect-technologies-inc-aerovect-and-dnata-partner-to-deploy-autonomous-ground-support-equipment-worldwide)
- [Aviation Pros -- "AeroVect's Agnostic Approach to Autonomy"](https://www.aviationpros.com/ground-support-worldwide/gse/gse-technology/article/21282727/aerovects-agnostic-approach-to-autonomy)
- [Crunchbase -- AeroVect Series A](https://www.crunchbase.com/funding_round/aerovect-series-a--1917a15f)
- [Tracxn -- AeroVect funding profile](https://tracxn.com/d/companies/aerovect/__qbnVd053iysIAN6cBBcOzpHi1B4nKrQqjXoihH52Fxg/funding-and-investors)
- [FAA -- Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Xfund -- Founder Spotlight: Raymond Wang and Eugenio Donati](https://blog.xfund.com/xfund-founder-spotlight-raymond-wang-and-eugenio-donati-of-aerovect-4a8163547c43)
- [CargoForwarder Global -- Spotlight on Eugenio Donati (Feb 2026)](https://cargoforwarder.eu/2026/02/22/spotlight-on-eugenio-donati-co-founder-aerovect/)
- [AeroVect perception intern job posting](https://jobs.ashbyhq.com/AeroVect/cb3ec12d-5f24-4047-bdc5-f262b60bd3ad)
- [TractEasy -- EZTow](https://tracteasy.com/)
- [dnata -- autonomous tractor deployment at DWC](https://aerospaceglobalnews.com/news/dnata-deploys-six-autonomous-tractors-at-dwc/)
- [Graphene Ventures -- AeroVect portfolio](https://graphenevc.com/portfolio/aerovect)
