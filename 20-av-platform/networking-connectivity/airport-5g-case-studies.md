# Airport 5G & Private Wireless Case Studies

Deep-dive reference on specific airport connectivity deployments, CBRS spectrum mechanics, and private 5G hardware platforms relevant to autonomous airside vehicle operations.

---

## 1. DFW International Airport -- AT&T / Nokia / Cisco

### Contract Overview

- **Contract value**: $10 million
- **Contract duration**: 5 years (announced May 2023)
- **Prime contractor**: AT&T
- **Equipment vendors**: Nokia (CBRS radios), Cisco (WiFi APs)
- **Systems integrator for early PoCs**: Betacom (deployed initial CBRS trials); Airspan Open RAN radios also used in the gate A9 baggage trial
- **Network ownership**: DFW owns the core network and runs it on-premises inside the airport

### Infrastructure

| Component | Count | Details |
|-----------|-------|---------|
| Nokia CBRS transmission sites | ~33 | Outdoor and select indoor macro/micro cells covering the 27 sq mi campus |
| New Cisco WiFi access points | ~200 | Added for terminal passenger coverage |
| Existing WiFi APs upgraded | ~800 | Firmware and hardware refresh for faster public WiFi |

The airport adopted a **converged access architecture**: private 5G CBRS traffic and WiFi traffic are routed through a single management platform, giving DFW unified visibility across both networks.

### Spectrum

- **Band**: 3550-3700 MHz CBRS (Band 48)
- **Access tier**: General Authorized Access (GAA) -- no PAL licenses purchased
- **SAS coordination**: required for all CBSD radios; DFW's deployment registers each of the 33 sites with an FCC-certified SAS administrator

### Coverage Design

DFW is approximately the size of Manhattan (~27 square miles), with 5 terminals, 7 runways, and 168 gates. The CBRS network provides outdoor campus-wide coverage across the entire airside footprint. Indoor coverage rollout is acknowledged as more challenging due to building penetration losses and the need for field router dongles on older devices.

### Applications

**Currently operational:**
- Monitoring 160+ concessionaires (open/closed status via IoT sensors)
- Tracking 180 conveyances (escalators, moving walkways) for instant breakdown notification
- Security cameras in remote outdoor locations connected over CBRS
- Baggage handling support -- a CBRS network deployed at American Airlines gate A9 for baggage sorting coming off aircraft
- Cargo asset tracking via private CBRS
- Digital signage infrastructure
- ~800-900 iPad users on the private network
- 40+ outdoor security cameras

**In trial / planned:**
- Autonomous shuttles in parking garages (piloted)
- Autonomous drone operations
- Vehicle tracking across the ramp
- Lighting sensors for airside safety
- Solar-powered LIDAR surveillance
- Facial recognition cameras
- Real-time data analytics and digital twin

### Measured Performance

- Transaction speeds on the private CBRS network were **50-70% faster** than public cellular networks in early commercial pilots
- PoCs in ramp, cargo, and terminal services demonstrated that CBRS "coverage, throughput, latency and reliability improvements fundamentally improved the efficiency of services such as baggage handling"
- The CBRS network delivered the low latency and high bandwidth that American Airlines required for the gate A9 baggage sorting trial
- DFW was able to stand up a proof-of-concept private wireless network **within approximately two hours** during vendor evaluation

### Lessons Learned

1. **WiFi alone is insufficient**: existing WiFi infrastructure could not provide comprehensive mobile coverage; sensor devices monitoring escalators, parking areas, and restrooms experienced connectivity failures during high-traffic periods
2. **Converged management matters**: routing CBRS and WiFi through a single platform reduced operational complexity
3. **Indoor is harder than outdoor**: outdoor CBRS rollout was straightforward; indoor deployment required additional planning for building materials and legacy device compatibility
4. **Device compatibility**: older devices needed field router dongles to connect to the CBRS network
5. **Airport-owned core is key**: DFW owning the core network gave them control over security policy, network slicing, and future vendor flexibility

---

## 2. Amsterdam Schiphol Airport -- Ericsson

### Deployment Overview

- **Announced**: October 2024
- **Technology partner**: Ericsson (Private 5G)
- **Spectrum**: Dedicated spectrum allocated by the Netherlands Authority for Consumers and Markets (ACM) -- not CBRS (which is US-only), but a comparable local-license model
- **Network**: Ericsson Private 5G with single-server dual-mode core (4G + 5G)
- **Status**: Pilot phase, exploring use cases for full deployment

Schiphol is the world's third-busiest airport by international passenger numbers and processes approximately 31,000 pieces of transfer baggage daily.

### Spectrum & Regulatory

The Netherlands implemented a dedicated spectrum framework allowing enterprises to obtain their own licensed spectrum from ACM. Schiphol secured its own allocation, giving the airport full control over network performance, reliability, and security -- reducing dependency on public or shared networks.

### Applications Under Exploration

- IoT-based monitoring of infrastructure and equipment
- Real-time safety systems
- Predictive maintenance solutions
- Support for autonomous ground vehicle operations

### Autonomous Vehicle Trials at Schiphol

Schiphol is running multiple parallel AV programs, each with different connectivity approaches:

**1. reference airside AV stack autonomous baggage/cargo tug (with KLM)**
- **Started**: August 2024 (Phase 1); February 2025 (Phase 2, pier driving)
- **Function**: Autonomous electric baggage tractor with robotic arms for fully autonomous ULD loading/unloading
- **Sensors**: LiDAR, 360-degree cameras, 3D cameras for environment mapping
- **Route**: From temporary baggage storage to baggage hall; expanding to aircraft stands
- **Connectivity**: Not publicly specified whether using the Ericsson private 5G or a separate link; an operator remains present in the vehicle during trials

**2. Ohmio Autonomous Buses (with KLM Cityhopper)**
- **Function**: Shuttling cabin crew from apron to terminal
- **Challenge**: GPS unavailable in covered areas; Ohmio developed LiDAR-based positioning as a fallback
- **Connectivity**: operational details not disclosed

**3. Autonomous Baggage Tractors**
- Testing self-driving baggage tractors on the apron for safety and integration with mixed traffic

### Vision

Schiphol targets a fully autonomous, emission-free airside vehicle fleet by 2050.

---

## 3. Singapore Changi Airport -- Singtel / UISEE

### 5G Aviation Testbed

- **Launched**: March 2023
- **Duration**: 2-year testbed program
- **Operator**: Singtel (not M1/Nokia -- the testbed is a Singtel initiative with CAAS and Changi Airport Group)
- **Location**: Terminal 3 airside
- **Planned coverage extension**: Singtel gradually extending 5G to public areas in all terminals by end of 2025
- **Telco upgrades**: ~4,000 Singtel corporate mobile lines received complimentary 4G-to-5G upgrades
- **Edge computing**: Singtel Mobile Edge Computing deployed for on-site processing

### Safety Considerations

Transmission power and antenna angles are restricted in the airside environment to avoid interference with aircraft systems.

### UISEE Autonomous Tractor Fleet

- **Go-live date**: January 20, 2026
- **Pre-deployment testing**: Nearly 1 year, 5,000+ trial runs
- **Safety record**: 20,000+ km accident-free operation
- **Current fleet**: 2 autonomous tractors
- **Planned expansion**: 6 additional units later in 2026; 24 total by 2027
- **Route**: 7 km between Terminal 1 and Terminal 4 baggage handling areas
- **Capacity**: Each tractor tows up to 4 baggage containers, combined weight up to 10 tonnes
- **Sensor suite**: 10+ sensors and cameras per vehicle (LiDAR, cameras)
- **Operating conditions**: Day, night, rain
- **Remote monitoring**: Control center with remote operator who can intervene immediately
- **Autonomous level**: L4 (UISEE's fifth-generation U-Drive intelligent driving system)
- **Certifications**: ISO 21434 (cybersecurity), ISO 27001 (information security), Singapore TR68

### UISEE Connectivity Architecture

Per UISEE's published solution architecture:
- **Vehicle-to-cloud**: 4G/5G network connectivity for reporting vehicle status
- **Road Side Units (RSU)**: Transmit environmental sensor data to the cloud platform
- **Monitoring center**: Connected via WiFi/Ethernet
- **Cloud platform functions**: Real-time vehicle state monitoring, remote HD video, exception notification, remote human intervention

### Testbed Applications

1. **AV tele-operations**: Real-time HD video streams with low latency and high transmission stability for remote supervision of autonomous vehicles
2. **Secure flight data transfer**: Singapore Airlines transmitting weather and airport data to aircraft via 5G (replacing fiber optic cables)
3. **Remote aircraft inspection** (under exploration)
4. **Video analytics / AI** for predicting aircraft turnaround times (under exploration)

### Latency Context

While the specific 10-17ms latency figures referenced in early Nokia/M1 discussions have not been confirmed in public Changi sources, the operational context is:
- The Singtel 5G testbed is designed for "ultra-low latency" autonomous vehicle teleoperation
- Industry benchmarks from comparable airport private 5G deployments show:
  - **20 ms average latency** for AV operations (UK airport reference deployment)
  - **50+ ms spikes** at cell boundaries during handover, reducible to **25 ms** with handover threshold optimization
  - Acceptable teleoperation threshold: < 250-300 ms end-to-end
  - Ideal uplink latency for AV teleoperation: 50-120 ms; ideal downlink: 20-80 ms
  - Sub-10 ms latency enables effectively real-time teleoperation

---

## 4. LAX -- Lufthansa Cargo / Ericsson Private 5G

### Deployment Overview

- **Location**: Lufthansa Cargo warehouse facility at LAX
- **Technology**: Ericsson Private 5G
- **Deployment partner**: Lufthansa Industry Solutions (IT consulting subsidiary)
- **Spectrum**: CBRS (GAA -- free, unlicensed)
- **Timeline**: Nearly 1 year PoC, then full deployment

### Infrastructure

| Before | After |
|--------|-------|
| 17 WiFi access points | 2 Ericsson 5G radios |
| Frequent disconnections, manual reauthentication | Continuous coverage, single wide-area cell, zero roaming |

The two Ericsson radios provide a single wide-area cellular cell that eliminated roaming altogether -- a critical improvement for mobile warehouse scanners.

### Performance Results

| Metric | Improvement |
|--------|-------------|
| Process speed | **70-80% faster** |
| Scanning delays | **97% reduction** |
| Unplanned downtime | **Effectively eliminated** |

**Root cause of WiFi problems**: When a warehouse scanner lost WiFi connection, the system reset and workers had to log back in manually. A 5-second scanning task would become a 2.5-minute ordeal. With private 5G, reauthentication happens automatically within the core, and the application restarts immediately.

### Future Plans

Lufthansa Cargo is evaluating broader US rollout at:
- JFK (New York)
- ATL (Atlanta)
- ORD (Chicago)

CBRS spectrum availability makes these expansions cost-effective since no spectrum licensing fees are required.

---

## 5. Hamburg -- Lufthansa Technik / Nokia Private 5G

### Deployment Overview

- **Location**: Lufthansa Technik MRO facility, Hamburg, Germany
- **Technology**: Nokia 5G private wireless (5G Standalone)
- **Frequency band**: 3.7-3.8 GHz (German local-license band)
- **Spectrum license**: Fixed 10-year license from Germany's Federal Network Agency (BNetzA), obtained late 2021
- **Operational since**: 2020 (trial), moved to permanent commercial deployment June 2021
- **Expansion**: Extended from one engine overhaul workshop (CFM56, V2500) to a second facility (LEAP, CF6-80 engines) in early 2022

### Performance Specifications

- **Capacity**: > 1 Gbps
- **Latency**: < 10 milliseconds
- **Standard**: 5G Standalone (SA)

### Applications

**1. Virtual Table Inspection (VTI)**
- High-resolution video streams enable remote examination of engine parts by customers worldwide
- Fully integrated into AVIATAR Digital Operations Suite (2021)
- Eliminated need for customers to travel to Hamburg for in-person inspections
- Became business-critical during COVID when travel was restricted

**2. Boroscopy Services**
- Remote digital inspection of hard-to-reach engine cavities
- Precision measurement capability: can identify scratches as small as **0.3 mm in length**
- Scheduling reduced from weeks-long planning to "very short notice"

### Relevance to Airport AV Operations

While this is an MRO facility rather than airside AV, it demonstrates:
- Nokia private 5G achieving sub-10ms latency in an airport-adjacent industrial environment
- The German local-license spectrum model (3.7-3.8 GHz) as an alternative to CBRS
- Long-term viability of private 5G with a 10-year spectrum license

---

## 6. Purdue University Airport -- Ericsson / Saab

### Deployment Overview

- **Announced**: Q1 2023
- **Partners**: Ericsson (network), Saab (aviation platforms), Purdue University
- **Concept**: "Lab to Life" -- real airport serving as a living research site for the aviation industry
- **Airport scale**: 125,000+ aircraft operations annually; Indiana's second-busiest airport
- **Award**: 2024 TeckNexus Award for "Private Network Excellence in Airports"

### Network Architecture

- **Core**: 4G + 5G dual-mode core
- **Spectrum**: CBRS General Authorized Access (GAA)
- **Backhaul**: Fiber network
- **Coverage**: Full airport operational area

### Saab Platform Integration

- **Aerobahn**: Airport efficiency platform for airlines and ramp management
- **SAFE Event Management**: Security platform for airport operation centers
- **ADS-B sensors**: Aircraft tracking throughout the airport area

### Applications

- Real-time data analytics for baggage and passenger flow
- Security monitoring and threat detection
- Flight status and operations management
- Autonomous systems research
- Drone detection
- Electric aircraft charging infrastructure connectivity

### Measured Results

- **Productivity gains**: Up to **30%** improvement in airport operations
- **Cost reductions** documented (specific figures not publicly disclosed)
- **Safety improvements** from real-time connectivity
- Ericsson's Connected Aviation report finds **20-40% performance gains** for airport operations with private 5G broadly

---

## 7. CBRS Spectrum Technical Reference

### Band Plan

| Parameter | Value |
|-----------|-------|
| Frequency range | 3550-3700 MHz (150 MHz total) |
| 3GPP band | Band 48 (n48 for 5G NR) |
| Channel bandwidth | 10 MHz per PAL; GAA can use full 150 MHz |
| Duplex mode | TDD |
| Max EIRP (GAA outdoor) | 47 dBm / 30 dBm/10MHz |
| Max EIRP (GAA indoor) | 23 dBm |

### Three-Tier Access Framework

**Tier 1 -- Incumbent Access**
- Federal users (primarily US Navy radar): highest priority
- Fixed Satellite Service (FSS) earth stations: 3600-3650 MHz
- Grandfathered wireless broadband licensees: 3650-3700 MHz (legacy, being phased out)
- All lower tiers must protect incumbents

**Tier 2 -- Priority Access Licenses (PAL)**
- Licensed via competitive auction (Auction 105, July 2020)
- County-by-county geographic licensing
- 10 MHz channel blocks within 3550-3650 MHz (up to 7 PALs per county)
- 10-year renewable license terms
- Maximum 4 PALs per entity per county
- Must accept interference from Tier 1; protected from Tier 3

**Tier 3 -- General Authorized Access (GAA)**
- License-by-rule: no auction, no license fee
- Operates across full 3550-3700 MHz band
- Must not interfere with Tier 1 or Tier 2
- Must accept interference from both higher tiers
- Most airport deployments use GAA (DFW, Purdue, LAX Lufthansa Cargo)

### Auction 105 Results (PAL Pricing Reference)

- **Total raised**: $4.58 billion (76 rounds, July 2020)
- **Licenses offered**: 22,631 PALs nationwide
- **Average price**: $0.217 per MHz-POP
- **High-cost markets**: Los Angeles County $0.53/MHz-POP, New York $0.63/MHz-POP, Washington DC $0.85/MHz-POP
- **Minimum bid**: $0.02 per MHz-POP ($1,000 minimum per license block)
- **Airport implication**: most airports use GAA to avoid these costs; PAL provides interference protection but at significant expense in metro areas

### Spectrum Access System (SAS)

The SAS is the automated frequency coordinator mandated by the FCC to manage the three-tier framework.

**How it works:**
1. Each CBRS Device (CBSD) must register with a certified SAS before transmitting
2. Registration requires precise latitude, longitude, and antenna height
3. SAS assigns frequency channels and authorized transmit power levels
4. SAS continuously monitors for incumbent activity (via Environmental Sensing Capability / ESC sensors) and can dynamically reassign or shut down lower-tier users
5. All channel assignments are dynamic -- the SAS can change them in real time

**FCC-Certified SAS Administrators (as of 2025):**

| Administrator | Status |
|--------------|--------|
| Google | Active |
| Federated Wireless | Active |
| Sony | Active (formerly Sony's SSP) |
| Amdocs | Active (authorized for commercial operation) |
| CommScope | Withdrew in 2022; continues to operate ESC network with Google |

**CPI Requirement**: Outdoor CBRS devices (Category B CBSDs) must be installed by a Certified Professional Installer (CPI). Nokia, CommScope, Federated Wireless, and Google are approved CPI Training Program Administrators.

---

## 8. Private 5G Hardware Vendors for Airport Deployments

### Nokia Digital Automation Cloud (DAC)

**Product tiers:**

| Product | Target | Key Specs |
|---------|--------|-----------|
| Nokia DAC PW Compact | Small/mid-sized facilities | Based on AirScale small cells; OPEX-based pricing; deploys in minutes; initially US-only on CBRS |
| Nokia DAC (full) | Large campuses (airports) | mRRH (outdoor/high-ceiling indoor) + pRRH (indoor); MX Industrial Edge for on-prem core; cloud-based DAC Manager |
| Nokia Modular Private Wireless (MPW) | Enterprise-grade | Carrier-grade 4G/5G radios; IP/MPLS transport; scalable |

**Four components of Nokia DAC:**
1. Portfolio of indoor/outdoor 4.9G/LTE and 5G radios (mRRH for hangars/airports, pRRH for warehouses/factory floors)
2. MX Industrial Edge (ruggedized on-prem edge compute running core network + industrial applications)
3. IP transport to interconnect components
4. Cloud-based Nokia DAC Manager (single-pane management)

**Airport-specific capabilities:**
- Centimeter-level indoor positioning and GNSS-enhanced outdoor tracking
- Ultra-low latency with deterministic QoS
- Coverage design for hangars, tarmacs, baggage tunnels
- Airports using Nokia: Brussels, Vienna, San Sebastian, Miami, DFW (CBRS radios)

### Ericsson Private 5G

**Architecture:**
- Single-server dual-mode core (4G + 5G)
- Pre-integrated for rapid time-to-service
- CBRS support in the US (GAA and PAL)
- mmWave support for high-density areas

**Deployment models:**
- Industry Connect: optimized for smaller deployments, CBRS-based
- Scaled-down macro network: for larger campus deployments, can use mmWave

**Airport deployments:**
- Schiphol (dedicated spectrum, Netherlands)
- Purdue University Airport (CBRS GAA)
- Lufthansa Cargo LAX (CBRS GAA)
- UK airport reference (unnamed, achieved 20ms AV latency)

**Key claim**: 20-40% operational performance gains for airports (Connected Aviation Report, 2022)

### Samsung Private 5G

**Architecture:**
- Virtualized private network platform consolidating DU, CU, UPF, and virtual switch into a single server
- Compact Core: one-box solution for immediate coverage
- Carrier-grade capabilities in a simplified form factor

**Target verticals**: Manufacturing, utilities, logistics, government -- no major public airport deployments documented yet, but Samsung positions the platform for aviation

**Notable reference**: Hyundai Motor Company private 5G for production inspection using RedCap devices

---

## 9. Typical Airport Deployment: Timeline & Cost

### Cost Framework

| Component | Typical Range | Notes |
|-----------|--------------|-------|
| Small site (warehouse, single building) | $50K - $100K | Comparable to Lufthansa Cargo LAX (2 radios replacing 17 APs) |
| Mid-size campus (regional airport) | $100K - $500K | Purdue-scale; 5-20 base stations |
| Large campus (major hub) | $1M - $10M+ | DFW-scale; 33+ CBRS sites plus WiFi overlay |
| Base station (macro site) | $100K - $200K per site | Including radio, backhaul, installation |
| Small cell | $10K - $50K per unit | Indoor pRRH or compact outdoor unit |
| CBRS spectrum (GAA) | $0 | Free; no license fee |
| CBRS spectrum (PAL) | Varies widely | $0.02-$0.85 per MHz-POP depending on market |
| SAS registration | Included or nominal | Part of vendor service agreements |
| Annual OPEX | 15-20% of initial CAPEX | Network management, monitoring, SAS fees, maintenance |

### ROI Timeline

- Most enterprises see ROI within **12-24 months** through reduced downtime, improved efficiency, and eliminated WiFi reliability issues
- Lufthansa Cargo LAX: process speed improved 70-80% after replacing WiFi with 2 CBRS radios
- Ericsson claims 18-36 month payback for airport private 5G deployments

### Deployment Timeline

| Phase | Duration | Scope |
|-------|----------|-------|
| Site survey & RF planning | 2-4 weeks | Coverage design, spectrum assessment, SAS registration |
| Small indoor deployment (1-3 cells) | Days to 1 week | Single building, warehouse, gate area |
| Campus deployment (5-20 base stations) | 2-6 weeks | Regional airport or single terminal |
| Full hub deployment (30+ sites) | 3-6 months | Multi-terminal, airside + landside |
| PoC / trial phase | 3-12 months | DFW ran 3 PoCs; Lufthansa Cargo tested for nearly a year |
| CPI installation (outdoor CBSDs) | Per-site, included above | Requires Certified Professional Installer |

### Key Decision Points for Airport Deployments

1. **GAA vs PAL**: Most airports choose GAA (free) for initial deployments. PAL provides interference protection but at significant cost in metro markets. DFW, Purdue, and Lufthansa Cargo all used GAA.

2. **Own the core vs managed service**: DFW chose to own and run the core on-premises for maximum control. Alternatives include 5G-as-a-Service (5GaaS) models from Betacom and others.

3. **Converged vs separate networks**: DFW's converged WiFi + CBRS architecture through a single management platform is emerging as best practice.

4. **Indoor vs outdoor priority**: Outdoor airside coverage is straightforward with CBRS macro/micro cells. Indoor terminal coverage is more complex and may still require WiFi overlay.

5. **Autonomous vehicle readiness**: For AV teleoperation, target sub-25ms latency with handover optimization at cell boundaries. Private 5G consistently outperforms WiFi for this use case due to deterministic QoS, seamless handover, and no roaming disruption.

---

## 10. Performance Benchmarks: Private 5G for Airport Operations

### Measured Data from Deployments

| Metric | Value | Source |
|--------|-------|--------|
| AV teleoperation average latency | 20 ms | UK airport private 5G deployment |
| AV handover spike (before optimization) | 50+ ms | UK airport, at cell boundaries |
| AV handover spike (after optimization) | 25 ms | UK airport, handover threshold tuning |
| Baggage scanning latency (WiFi baseline) | 55 ms | Industry reference |
| Baggage scanning latency (private 5G) | 20 ms | 64% reduction |
| Baggage processing speed increase | 40% | 1,800 to 2,520 bags/hour |
| Lost bags per 1,000 reduction | 39% | 8.3 to 5.1 |
| System downtime reduction | 83% | 12 hrs/month to 2 hrs/month |
| Warehouse process speed (Lufthansa LAX) | 70-80% faster | After WiFi-to-5G migration |
| Scanner delay reduction (Lufthansa LAX) | 97% | 2.5 min to seconds |
| DFW transaction speed vs public cellular | 50-70% faster | CBRS private network |
| General airport productivity gain | 20-40% | Ericsson Connected Aviation Report |
| Purdue airport productivity gain | Up to 30% | Ericsson/Saab/Purdue deployment |
| Aircraft turnaround time reduction | >33% | Major international hub |
| Lufthansa Technik 5G SA latency | <10 ms | Nokia 5G SA, Hamburg |
| Lufthansa Technik 5G SA throughput | >1 Gbps | Nokia 5G SA, Hamburg |

### Private 5G Network Specifications (Typical Airport Deployment)

| Parameter | Specification |
|-----------|--------------|
| Connection density | 1 million devices per sq km |
| Spectrum efficiency | 3-5x better than 4G |
| Uptime guarantee | 99.5% minimum |
| Speed range | 100 Mbps - 1 Gbps |
| E2E latency (ideal) | <20 ms downlink, <100 ms uplink |
| AV teleoperation threshold | <250-300 ms acceptable; <50 ms preferred |

---

## Sources

- [How AT&T won DFW's $10M private 5G business -- Light Reading](https://www.lightreading.com/private-networks/how-at-t-won-dfw-s-10m-private-5g-business)
- [Private Wireless Revolution: CBRS at DFW Airport -- OnGo Alliance](https://ongoalliance.org/private-wireless-revolution-cbrs-at-dfw-airport/)
- [DFW Airport and AT&T Boost Connectivity -- TeckNexus](https://tecknexus.com/5gusecase/dfw-airport-and-att-boost-connectivity-with-private-5g-network/)
- [Dallas Fort Worth (DFW) -- Airspan](https://airspan.com/project/airport-dfw/)
- [CBRS-based Private 5G Clear for Takeoff at DFW -- Inside Towers](https://insidetowers.com/cbrs-based-private-5g-clear-for-takeoff-at-dfw/)
- [DFW Airport ponders a decade-long private wireless contract -- Light Reading](https://www.lightreading.com/private-networks/dfw-airport-ponders-a-decade-long-private-wireless-contract)
- [Ericsson Private 5G pilot takes off at Schiphol](https://www.ericsson.com/en/news/2024/10/ericsson-private-5g-pilot-takes-off-at-schiphol)
- [Private 5G takes off at Schiphol airport -- Computer Weekly](https://www.computerweekly.com/news/366613034/Private-5G-takes-off-at-Schiphol-airport)
- [Schiphol Airport's 2050 autonomous airside target -- Airside International](https://airsideint.com/schiphol-airports-2050-autonomous-airside-target/)
- [5G Aviation Testbed Launched at Changi Airport Airside -- CAAS](https://www.caas.gov.sg/who-we-are/newsroom/Detail/5g-aviation-testbed-launched-at-changi-airport-airside)
- [Changi Airport deploys autonomous tractors -- FTE](https://www.futuretravelexperience.com/2026/01/changi-airport-deploys-autonomous-tractors-in-major-step-towards-airside-automation/)
- [UISEE Changi Airport partnership announcement](https://www.uisee.com/en/article226-news1.html)
- [UISEE Airport Solutions](https://www.uisee.com/en/solution-airports.html)
- [Singtel 5G Aviation Testbed at Changi](https://www.singtel.com/about-us/media-centre/news-releases/5g-aviation-testbed-launched-at-changi-airport-airside)
- [How Lufthansa Cargo Replaced Wi-Fi with Private 5G at LAX](https://www.privatelteand5g.com/how-lufthansa-cargo-replaced-wi-fi-with-private-5g-to-accelerate-warehouse-operations-at-lax/)
- [Lufthansa Cargo uses Ericsson private 5G in warehouse](https://www.ericsson.com/en/cases/2026/lufthansa-cargo-ericsson-private-5g)
- [Lufthansa and Ericsson transform logistics with private 5G](https://www.ericsson.com/en/blog/2025/8/how-lufthansa-industry-solutions-ericsson-transform-logistics-with-private-5g)
- [Nokia 5G private wireless for Lufthansa Technik -- Nokia](https://www.nokia.com/about-us/news/releases/2021/06/21/nokia-5g-private-wireless-networking-moves-from-trial-to-permanent-deployment-for-lufthansa-technik/)
- [Lufthansa Technik expands 5G campus network in Hamburg](https://www.lufthansa-technik.com/en/lufthansa-technik-expands-its-proven-5g-campus-network-in-hamburg-1369d00337071944)
- [Saab, Purdue and Ericsson: Private 5G Shaping Smart Airports](https://www.ericsson.com/en/blog/2025/1/revolutionizing-aviation-how-saab-purdue-and-ericssons-private-5g-network-is-shaping-the-future-of-airports)
- [Ericsson, Saab and Purdue University 5G announcement -- Purdue](https://www.purdue.edu/newsroom/2023/Q1/ericsson-saab-and-purdue-university-announce-lab-to-life-innovative-5g-network-to-make-purdue-airport-accessible-as-a-real-life-research-site-for-aviation-industry/)
- [Building 5G private networks in airports using CBRS -- Ericsson](https://www.ericsson.com/en/blog/north-america/2022/cbrs-private-networks-airports)
- [Connected Aviation powered by Ericsson Private 5G](https://www.ericsson.com/en/enterprise/reports/connected-aviation)
- [FCC 3.5 GHz Band Overview](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/35-ghz-band/35-ghz-band-overview)
- [CBRS SAS Administrators -- WINNF](https://cbrs.wirelessinnovation.org/sas-administrators)
- [Nokia DAC private wireless](https://www.dac.nokia.com/connectivity-solutions/private-wireless/)
- [Nokia private wireless for airports](https://www.nokia.com/networks/go-allwhere/private-wireless/airports/)
- [Nokia DAC PW Compact announcement](https://www.nokia.com/about-us/news/releases/2023/10/04/nokia-brings-5g-private-wireless-to-small-industrial-sites-with-compact-dac/)
- [Private Wireless for Airports -- Nokia + MCA Aviation](https://callmc.com/private-wireless-airports/)
- [Samsung Private Networks](https://www.samsung.com/global/business/networks/solutions/private-networks/)
- [How Much Does a Private Cellular Network Cost? -- Metro Wireless](https://www.metrowireless.com/blog/private-cellular-network-cost-breaking)
- [Private 5G for Business: Airport Efficiency Revolution -- Pazel Magazine](https://www.pazelmagazine.com/how-private-5g-for-business-transforms-airport-operations-a-data-driven-analysis/)
