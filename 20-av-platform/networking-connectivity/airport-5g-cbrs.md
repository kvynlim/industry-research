# Airport Connectivity Infrastructure for Autonomous Vehicles

## Research Report: 5G, CBRS, and Wireless Networking for Airside Autonomous Operations

---

## Table of Contents

1. [DFW Airport 5G --- CBRS Deployment at Scale](#1-dfw-airport-5g--cbrs-deployment-at-scale)
2. [Changi Airport --- Private 5G for Autonomous Tractors](#2-changi-airport--private-5g-for-autonomous-tractors)
3. [CBRS 2.0 --- Regulatory Evolution and Airport Implications](#3-cbrs-20--regulatory-evolution-and-airport-implications)
4. [Private 5G vs Public 5G --- Why Airports Need Dedicated Networks](#4-private-5g-vs-public-5g--why-airports-need-dedicated-networks)
5. [URLLC --- Ultra-Reliable Low-Latency Communication](#5-urllc--ultra-reliable-low-latency-communication)
6. [Network Architecture for Autonomous GSE](#6-network-architecture-for-autonomous-gse)
7. [WiFi 6/6E as Alternative](#7-wifi-66e-as-alternative)
8. [Mesh Networking Between Vehicles](#8-mesh-networking-between-vehicles)
9. [Bandwidth Requirements](#9-bandwidth-requirements)
10. [Redundancy and Failover](#10-redundancy-and-failover)
11. [Airport RF Environment](#11-airport-rf-environment)
12. [Cost Model](#12-cost-model)
13. [Vendors](#13-vendors)

---

## 1. DFW Airport 5G --- CBRS Deployment at Scale

### Overview

Dallas Fort Worth International Airport (DFW) represents the most significant CBRS-based private 5G deployment at any US airport. In 2023, DFW signed a five-year, **$10 million contract with AT&T** to deploy a comprehensive wireless platform combining public WiFi upgrades with a private 5G network across its 27-square-mile campus --- comparable in size to Manhattan.

### Infrastructure Deployed

| Component | Details |
|-----------|---------|
| CBRS transmission sites | ~33 sites (Nokia equipment) |
| WiFi access points | ~200 new Cisco APs + updates to ~800 existing hotspots |
| Coverage area | 27 square miles, indoor and outdoor |
| Deployment timeline | Outdoor deployment completed in under 12 months |
| Network ownership | DFW owns the core; runs it inside the airport |
| Spectrum | CBRS General Authorized Access (GAA) --- no spectrum licensing fees |

### Network Architecture

DFW takes a **converged access approach**, routing both private 5G CBRS traffic and WiFi traffic through a single management platform. This unified architecture simplifies operations and reduces the management overhead of running two parallel wireless networks.

- **Nokia** supplies the CBRS radio access network (33 transmission sites)
- **Cisco** supplies the WiFi access points and the converged management platform
- **AT&T** provides the integration, deployment, and managed services

### What It Enables

DFW completed three comprehensive proofs of concept (PoCs) in ramp, cargo, and terminal services before committing to the full deployment:

- **Concession monitoring**: Tracking whether 160+ concessionaires are open/closed for real-time passenger displays
- **Conveyance tracking**: Monitoring 180 escalators and moving walkways for immediate breakdown alerts
- **Remote camera connectivity**: Solar-powered cameras in remote locations connected without fiber
- **Autonomous shuttle testing**: Tests for autonomous shuttles in parking facilities
- **Cargo asset tracking**: Evaluating CBRS for tracking cargo assets across the airfield
- **Security and baggage handling**: Enhanced monitoring of passenger traffic, security systems, and baggage
- **Digital twins**: Building digital representations of airport operations

### Performance Metrics

- **Transaction speeds**: 50--70% faster than public cellular networks in pilot testing
- **Latency**: "Much lower latency than what we would see using public cellular"
- **Cost advantage**: Under $1,000 per field router vs. $50,000+ per fiber endpoint for remote connectivity
- **Security cameras**: 40+ outdoor cameras operate solely on the private wireless connection

### Key Lessons

- Indoor deployment proved more complex than outdoor, requiring extensive RF mapping and additional hardware
- Device compatibility varies; older equipment may require adapters for CBRS connectivity
- Airport leadership predicts CBRS will evolve from optional technology to **"critical infrastructure"** for modern airport operations

### Sources

- [OnGo Alliance: Private Wireless Revolution at DFW Airport](https://ongoalliance.org/private-wireless-revolution-cbrs-at-dfw-airport/)
- [Light Reading: How AT&T won DFW's $10M private 5G business](https://www.lightreading.com/private-networks/how-at-t-won-dfw-s-10m-private-5g-business)
- [AT&T: DFW Airport Connectivity Announcement](https://about.att.com/story/2023/dfw-connectivity.html)

---

## 2. Changi Airport --- Private 5G for Autonomous Tractors

### 5G Aviation Testbed

Singapore's Changi Airport launched a **5G Aviation Testbed** in March 2023 at Terminal 3's airside, operated by **Singtel** in partnership with the Civil Aviation Authority of Singapore (CAAS), Changi Airport Group (CAG), Singapore Airlines, and IMDA. This two-year testbed enables companies operating airside to leverage 5G's high bandwidth, high-speed connectivity, and ultra-low latency.

Key network details:

- **Provider**: Singtel (Singapore's primary telecommunications operator)
- **Coverage**: Terminal 3 airside initially; plans to extend 5G to public areas in all terminals
- **Upgrades**: ~4,000 Singtel 4G corporate mobile lines at the airside received complimentary 5G upgrades
- **Safety measures**: CAAS established restrictions on transmission power and antenna tilt angle to ensure flight operation safety

### Autonomous Tractor Fleet

In January 2026, Changi deployed its **first fleet of fully driverless autonomous tractors** for airside baggage operations, built by **UISEE** (a Chinese autonomous driving technology company):

| Parameter | Specification |
|-----------|---------------|
| Vehicles in operation | 2 (initial), expanding to 8 in 2026, 24 by 2027 |
| Route | 7 km between Terminal 1 and Terminal 4 baggage handling areas |
| Capacity | Up to 4 baggage containers, ~10 tonnes combined weight |
| Sensors | 10+ per vehicle (LiDAR, cameras, RTK positioning, inertial navigation) |
| Detailed sensor suite (from other UISEE deployments) | 4 LiDAR sensors, 6 HD cameras, RTK high-precision positioning, inertial navigation system |
| Testing | 5,000+ test trips over nearly one year of trials |
| Safety record | 20,000+ km of accident-free operation |
| Conditions | Day, night, and rain operations |
| Certifications | ISO 21434 cybersecurity, ISO 27001 information security, Singapore TR68 compliance |

### 5G's Role in Autonomous Operations

The 5G testbed specifically enables:

- **Real-time teleoperation**: High-definition video streams with low latency and high transmission stability for remote monitoring of AV operations
- **Continuous monitoring**: Operators can supervise AV operations remotely in real-time
- **Secure flight data transfer**: Singapore Airlines uses 5G to transmit critical flight data (weather, airport information) to aircraft, replacing fiber optic cables
- **Remote aircraft inspection**: Advanced video analytics with AI for predicting aircraft turnaround times

### Future Expansion

- 6 additional autonomous tractors deploying on a different route between Terminal 2 and aircraft stands (CAG-SATS collaboration)
- Total fleet expanding to 24 by 2027
- Future applications include autonomous towing of cargo and equipment (not just baggage)
- UISEE also piloting at Hamad International Airport (Qatar) and Beijing Daxing International Airport

### Sources

- [CAAS: 5G Aviation Testbed Launched at Changi Airport Airside](https://www.caas.gov.sg/who-we-are/newsroom/Detail/5g-aviation-testbed-launched-at-changi-airport-airside)
- [Changi Airport: Autonomous Tractors Press Release](https://www.changiairport.com/en/corporate/our-media-hub/newsroom/press-releases.autonomous-tractors.2026.all.html)
- [UISEE: Changi Airport Partnership](https://www.uisee.com/en/article226-cases1.html)
- [Future Travel Experience: Changi Airport Autonomous Tractors](https://www.futuretravelexperience.com/2026/01/changi-airport-deploys-autonomous-tractors-in-major-step-towards-airside-automation/)

---

## 3. CBRS 2.0 --- Regulatory Evolution and Airport Implications

### What is CBRS?

The Citizens Broadband Radio Service operates in 150 MHz of spectrum in the **3.5 GHz band (3550--3700 MHz)**. The FCC established a **three-tiered access framework** managed by a Spectrum Access System (SAS):

| Tier | Name | Details |
|------|------|---------|
| 1 | **Incumbent Access** | Federal users (primarily US Navy radar), Fixed Satellite Service earth stations. Receive full protection from interference. |
| 2 | **Priority Access (PAL)** | Licensed on a county-by-county basis via auction. 10 MHz channels in 3550--3650 MHz. Must protect Tier 1, protected from Tier 3. |
| 3 | **General Authorized Access (GAA)** | License-by-rule, open to all. Can operate across full 3550--3700 MHz band. No interference protection. **Free to use.** |

The SAS is a **cloud-based automated frequency coordinator** that manages spectrum assignments and transmit power to prevent harmful interference to higher-priority users. Approved SAS operators include Federated Wireless, Google, CommScope, Amdocs, and Key Bridge Wireless.

**Environmental Sensing Capability (ESC)** sensors detect transmissions from Department of Defense radar systems and relay that information to the SAS for real-time spectrum management.

### Key CBRS 2.0 Changes (2024--2025)

#### Dynamic Protection Area (DPA) Reduction

In June 2024, the FCC, NTIA, and US Navy collaborated to reduce the size of Dynamic Protection Areas --- zones along coastlines and around federal facilities where Navy radar can displace commercial CBRS users. The changes:

- **Modified the aggregate interference model** used in the 3.5 GHz band
- **Expanded unencumbered CBRS coverage** to approximately 72 million additional Americans
- **Total coverage** now reaches roughly 240 million people nationwide
- **Affected states** include Texas, Pennsylvania, North Carolina, Georgia, and Arizona
- **Airport implication**: Coastal and military-adjacent airports gain more reliable CBRS access with fewer potential interruptions from incumbent users

#### NPRM for Further Changes (August 2024)

The FCC released a **Notice of Proposed Rulemaking** seeking comment on:

- **Higher power CBRS devices**: Whether to add one or more classes of higher-power CBSDs (Citizens Broadband Service Devices)
- **Alignment with 3GPP standards**: Whether to align end-user device power levels with international 3GPP specifications
- **Multiband device approval**: In May 2025, Ericsson and Samsung received conditional waivers to manufacture devices operating in both the 3.5 GHz CBRS band and the 3.7 GHz C-Band --- enabling more flexible, higher-performance equipment
- **Out-of-band emissions**: Whether to align CBRS base station emission limits with those adopted in the 3.7 GHz service
- **ESC sensor modifications**: Changes to Environmental Sensing Capability requirements

#### Controversy: Spectrum Reallocation Proposal

In 2025, the DOD contemplated a proposal (supported by AT&T) to move low-power CBRS users to the lower 3 GHz band to share with DOD users, freeing 3.55--3.7 GHz spectrum for exclusive, high-power 5G mobile use and auctioning it to the highest bidder. This remains contentious --- smaller operators and cable companies oppose higher power levels that could undermine shared spectrum access.

### Implications for Airport Deployments

1. **More reliable coastal airport coverage**: Reduced DPAs mean airports near coastlines (many major hubs) face fewer CBRS interruptions
2. **Higher power = better outdoor coverage**: If approved, higher power levels would improve airfield coverage with fewer access points
3. **Multiband devices**: Equipment operating across both CBRS and C-Band provides fallback spectrum options
4. **Regulatory uncertainty**: The potential reallocation of CBRS spectrum to exclusive auction use poses a risk to airports that have invested in GAA-based private networks

### Sources

- [FCC: 3.5 GHz Band Overview](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/35-ghz-band/35-ghz-band-overview)
- [Light Reading: CBRS gets a boost under new FCC usage rules](https://www.lightreading.com/regulatory-politics/cbrs-gets-a-boost-under-new-fcc-usage-rules)
- [Fierce Network: FCC tees up changes to CBRS rules](https://www.fierce-network.com/wireless/fcc-tees-changes-cbrs-rules)
- [NTIA: Expand 3.5 GHz Spectrum Sharing Framework](https://www.ntia.gov/press-release/2024/ntia-fcc-navy-work-expand-innovative-35-ghz-spectrum-sharing-framework)
- [RCR Wireless: CBRS 2.0 Revolutionizing Spectrum Management](https://www.rcrwireless.com/20250408/spectrum/cbrs-spectrum)

---

## 4. Private 5G vs Public 5G --- Why Airports Need Dedicated Networks

### The Fundamental Problem with Public 5G for Autonomous Operations

Public 5G networks are designed for consumer traffic --- shared bandwidth, best-effort delivery, and coverage optimized for revenue-generating areas. Autonomous vehicles at airports require the opposite: **dedicated bandwidth, guaranteed latency, and coverage in non-public areas** like airfields, taxiways, and remote cargo areas.

### Comparison Matrix

| Attribute | Private 5G | Public 5G |
|-----------|-----------|-----------|
| **Spectrum** | Dedicated (CBRS, licensed, or leased) | Shared with all subscribers |
| **Latency** | Sub-10ms achievable, URLLC capable | 20--50ms typical, variable under load |
| **Reliability** | 99.999% achievable with URLLC | 99--99.9% typical |
| **Coverage control** | Deployed exactly where needed (airfield, ramp, taxiways) | Carrier determines coverage; airfield gaps common |
| **Bandwidth guarantee** | Dedicated capacity; no contention | Shared; degrades with user density |
| **Network slicing** | Full control over slice configuration | Carrier-managed; limited enterprise control |
| **Data sovereignty** | All data stays on-premise | Data traverses carrier infrastructure |
| **Security** | SIM-based authentication; isolated network | Shared infrastructure; potential attack surface |
| **Handoff control** | Tuned for vehicle speeds and routes | Optimized for pedestrian/vehicle patterns |
| **SLA** | Self-managed or contractual with full control | Carrier SLA; limited recourse for airfield coverage |
| **Customization** | QoS policies tailored to AV requirements | One-size-fits-all policies |
| **Cost model** | CapEx + OpEx; owned infrastructure | Per-device/per-GB; recurring carrier fees |

### Why Private Networks Win for Autonomous Airside Operations

1. **Deterministic QoS**: Private 5G uses centralized scheduling to allocate dedicated wireless access to each client. Public networks use contention-based access where devices "fight" for bandwidth. For autonomous vehicles making safety-critical decisions, deterministic access is non-negotiable.

2. **Coverage where it matters**: Public carriers optimize coverage for terminals and parking (passenger revenue areas). Airfields, taxiways, remote stands, and cargo areas --- precisely where autonomous GSE operates --- are often underserved. Private networks deploy coverage exactly where operational needs exist.

3. **Interference protection**: Private 5G on CBRS operates in coordinated spectrum with SAS-managed interference protection. The network is shielded from the consumer traffic spikes that cause public 5G degradation during peak travel hours.

4. **Edge computing co-location**: Private networks allow MEC servers to be deployed on-premise, keeping all vehicle control data within the airport perimeter. Public networks route data through carrier data centers, adding latency.

5. **Regulatory and security**: Airports are security-sensitive environments. Private networks ensure that autonomous vehicle telemetry, video feeds, and control commands never traverse public internet infrastructure.

### Real-World Validation

- **DFW Airport**: Deployed private CBRS specifically because public cellular couldn't deliver the latency and reliability needed for operational applications --- achieving 50--70% faster transaction speeds than public cellular.
- **Lufthansa LAX Cargo**: Private 5G at their cargo facility delivered a 60% reduction in processing time per item by eliminating the latency spikes and dropped connections from WiFi and public cellular.
- **Stanley Robotics (Lyon Airport)**: Private 5G enables management of up to 100 autonomous parking robots simultaneously --- impossible on shared public infrastructure.
- **Port of Liverpool**: Private 5G achieved a **tenfold performance boost** compared to legacy WiFi systems across 100 acres of port operations.

### Sources

- [Celona: Private 5G vs WiFi 6](https://www.celona.io/5g-lan/5g-vs-wi-fi-6)
- [Firecell: Top 8 Use Cases for Private 5G in Ports and Airports](https://firecell.io/use-cases-private-5g-ports-airports/)
- [P1Sec: Private 5G in Airports](https://www.p1sec.com/blog/5g-in-airports-building-smart-connected-aviation-hubs-with-private-mobile-networks)

---

## 5. URLLC --- Ultra-Reliable Low-Latency Communication

### Specification

URLLC is a 5G NR service category defined by 3GPP, targeting mission-critical communications:

| Parameter | Target | Notes |
|-----------|--------|-------|
| **User-plane latency** | 1 ms (one-way) | Radio interface only; end-to-end is higher |
| **Reliability** | 99.999% (five nines) | Packet delivery within latency bound |
| **Availability** | 99.999% | Network uptime |
| **Packet size** | 32 bytes typical | Small control packets |
| **Jitter** | < 1 ms | Consistent latency critical for control loops |

### How URLLC is Achieved

URLLC relies on several enabling technologies:

- **Mini-slot scheduling**: Shorter transmission time intervals (as low as 2 OFDM symbols vs. 14 for standard slots) reduce waiting time
- **Grant-free transmission**: Devices transmit immediately without waiting for scheduling grants
- **Packet duplication**: Same data sent over multiple paths for redundancy
- **Network slicing**: Dedicated virtual network with guaranteed resources isolated from other traffic
- **Edge computing (MEC)**: Processing at the network edge eliminates backhaul latency
- **Robust error correction**: Advanced coding schemes minimize retransmissions

### Practical Reality vs. Theory

The 1ms target is an **air-interface specification**, not an end-to-end guarantee. In practice:

| Measurement | Achievable Today | Context |
|-------------|------------------|---------|
| Radio access RTT | < 4 ms | 5G NR air interface |
| End-to-end (with MEC) | 5--10 ms | Edge server co-located with base station |
| End-to-end (cloud) | 20--50 ms | Data traverses backhaul to remote server |
| Application-level | 40--100 ms | Includes processing, encoding, rendering |

**For autonomous airport GSE operating at 15--25 km/h** (typical airside speeds), end-to-end latency of 10--20ms is sufficient for:

- Teleoperation control commands (target: < 20 ms downlink)
- Collision avoidance alerts (target: < 10 ms)
- Fleet coordination updates (target: < 50 ms)
- Video streaming for remote monitoring (target: < 100 ms glass-to-glass)

### URLLC vs. eMBB Trade-offs

| Factor | URLLC | eMBB |
|--------|-------|------|
| Latency | 1 ms target | 4--10 ms typical |
| Throughput | Lower (focused on small, time-critical packets) | Higher (optimized for data volume) |
| Reliability | 99.999% | 99--99.9% |
| Use case | Vehicle control, emergency stops | Video streaming, sensor data upload |

**Practical approach for autonomous GSE**: Use URLLC slice for control commands and safety-critical messaging, and eMBB slice for video streaming and bulk sensor data upload. Network slicing makes this dual-slice architecture possible on a single physical network.

### Sources

- [3GPP: Ultra Reliable and Low Latency Communications](https://www.3gpp.org/technologies/urlcc-2022)
- [GIGABYTE: Autonomous Vehicles with 5G URLLC](https://www.gigabyte.com/Solutions/urllc)
- [T-Mobile: 5G URLLC for Critical IoT](https://www.t-mobile.com/business/resources/articles/5g-urllc)

---

## 6. Network Architecture for Autonomous GSE

### Reference Architecture

```
                                    CLOUD TIER
                        (Model training, analytics, reporting)
                                      |
                                  WAN/Internet
                                      |
                              ================
                              |  AIRPORT CORE |
                              |  DATA CENTER  |
                              ================
                              |              |
                    +---------+--------+     |
                    |                  |     |
              +-----------+    +-----------+ |
              | MEC Node  |    | MEC Node  | |
              | (Ramp A)  |    | (Ramp B)  | |
              +-----------+    +-----------+ |
                    |                |       |
              +-----+-----+   +-----+-----+ |
              |     |     |   |     |     |  |
             gNB  gNB   gNB gNB  gNB   gNB  |
              |     |     |   |     |     |  |
           [AV1] [AV2] [AV3] [AV4] [AV5] [AV6]
                                                |
                                         +------------+
                                         | Teleop     |
                                         | Control    |
                                         | Center     |
                                         +------------+
```

### Tier 1: Vehicle Edge (On-Vehicle)

Each autonomous GSE vehicle contains:

- **Primary compute**: Onboard AI inference for perception, planning, and control (operates independently of network)
- **5G modem/router**: Dual-modem cellular router (e.g., Peplink MBX) with multi-SIM capability
- **Sensor suite**: LiDAR, cameras, radar, ultrasonic, GNSS/RTK
- **V2X module** (optional): C-V2X PC5 sidelink for direct vehicle-to-vehicle communication
- **Local buffer**: Stores sensor data and telemetry during connectivity gaps

### Tier 2: Multi-Access Edge Computing (MEC)

MEC nodes are deployed at the airport, co-located with or adjacent to 5G base stations:

- **Placement**: Typically in equipment rooms at each ramp area or terminal zone, within 1--2 hops of the gNBs (5G base stations)
- **Functions**:
  - **User Plane Function (UPF)**: Dedicated UPF per network slice, processing vehicle data locally without backhauling to cloud
  - **Teleoperation video processing**: Receives and re-encodes vehicle camera streams for remote operators
  - **Fleet orchestration**: Real-time coordination of vehicle routes, assignments, and conflict resolution
  - **Object detection offload**: Optional computation offload for complex perception tasks
  - **Geofence enforcement**: Monitors vehicle positions against operational boundaries
- **Latency benefit**: Processing at MEC reduces round-trip to < 10 ms vs. 50+ ms for cloud routing

### Tier 3: Airport Core Data Center

- **5G Core Network**: Centralized control plane functions (AMF, SMF, PCF, UDM)
- **Network management**: SAS integration for CBRS spectrum management, network monitoring
- **Data aggregation**: Collects telemetry from all MEC nodes for fleet analytics
- **Model deployment**: Distributes updated ML models to vehicles via MEC nodes
- **Integration hub**: Connects to airport operational databases (A-CDM, AODB)

### Tier 4: Cloud

- **Model training**: Large-scale ML training on collected operational data
- **Long-term analytics**: Historical trend analysis, performance reporting
- **Disaster recovery**: Backup for airport core systems

### Data Flow for Typical Operations

| Data Type | Direction | Latency Req. | Path |
|-----------|-----------|-------------|------|
| Control commands (teleop) | Downlink | < 20 ms | Teleop Center -> MEC -> gNB -> Vehicle |
| Vehicle telemetry | Uplink | < 50 ms | Vehicle -> gNB -> MEC -> Fleet Manager |
| Camera streams (teleop) | Uplink | < 100 ms | Vehicle -> gNB -> MEC -> Teleop Center |
| Collision avoidance | Both | < 10 ms | Vehicle <-> gNB <-> MEC |
| Sensor data (recording) | Uplink | Best effort | Vehicle -> gNB -> MEC -> Core -> Cloud |
| Model updates | Downlink | Best effort | Cloud -> Core -> MEC -> gNB -> Vehicle |
| Fleet coordination | Both | < 50 ms | Vehicle <-> MEC <-> Fleet Manager |

### Sources

- [Verizon: Edge Computing in Autonomous Vehicles](https://www.verizon.com/business/resources/articles/s/edge-computing-in-autonomous-vehicles/)
- [ETSI: Multi-access Edge Computing Standards](https://www.etsi.org/technologies/multi-access-edge-computing)
- [AWS: Private MEC Operational Models](https://aws.amazon.com/blogs/industries/architecting-operational-models-for-private-mec-using-aws-hybrid-and-edge-services-with-verizon-private-5g-networks/)

---

## 7. WiFi 6/6E as Alternative

### Technical Comparison: WiFi 6/6E vs. Private 5G for Airside Operations

| Parameter | WiFi 6/6E | Private 5G (CBRS) |
|-----------|-----------|-------------------|
| **Spectrum** | Unlicensed (2.4, 5, 6 GHz) | Licensed/shared (3.5 GHz CBRS) |
| **Max throughput (theoretical)** | 9.6 Gbps (WiFi 6) | Up to 20 Gbps |
| **Latency** | 5--20 ms typical | 1--10 ms with URLLC |
| **Reliability** | Best-effort; no guaranteed QoS | Deterministic; 99.999% URLLC |
| **Indoor range per AP** | 30--50 meters | 100--200 meters |
| **Outdoor range per AP** | 100--150 meters | 300--1,000 meters (macro) |
| **Coverage efficiency** | 1/5th to 1/30th of 5G coverage per AP | 3--4x indoor, up to 10x outdoor vs. WiFi |
| **Handoff** | Client-driven; 50--200 ms roaming gaps | Network-controlled; seamless < 0ms |
| **Interference** | Unlicensed band; contention from neighboring networks | Coordinated spectrum; SAS-managed protection |
| **QoS** | Best-effort; clients contend for access | Centralized scheduling; dedicated access |
| **Security** | WPA3; password/certificate-based | SIM-based authentication |
| **Device density** | Degrades above ~50 clients per AP | Up to 1 million devices per km^2 |
| **Power per AP** | 15--30 watts | Up to 50 watts per 10 MHz |

### Where WiFi 6/6E Falls Short for Autonomous Vehicles

1. **Roaming gaps**: WiFi handoff between access points is client-driven, causing 50--200 ms connectivity gaps. For a vehicle traveling at 25 km/h, this means potential loss of control signal every time the vehicle crosses an AP boundary. 5G handoffs are network-controlled and seamless.

2. **No QoS guarantees**: WiFi is a contention-based protocol. During peak airport operations (airline shift changes, heavy passenger traffic), WiFi performance degrades unpredictably. 5G provides scheduled, deterministic access.

3. **Outdoor coverage**: Covering a 27-square-mile airport campus with WiFi would require thousands of access points. Private 5G achieves the same coverage with far fewer base stations due to superior range (a single outdoor macrocell covers up to 1 square mile).

4. **Interference susceptibility**: The unlicensed WiFi bands (especially 2.4 and 5 GHz) face interference from passenger devices, airline operations systems, and neighboring networks. The 6 GHz band (WiFi 6E) requires AFC coordination and has restrictions on outdoor use.

### Where WiFi 6/6E Makes Sense

- **Terminal and indoor operations**: Passenger WiFi, staff devices, IoT sensors in controlled indoor environments
- **Supplementary connectivity**: As a backup/secondary network for autonomous vehicles (not primary)
- **Low-mobility applications**: Fixed or slow-moving equipment in hangars, workshops, and maintenance areas
- **Cost-sensitive deployments**: When 5G infrastructure CapEx is not yet justified

### WiFi 6E Specific Considerations

WiFi 6E adds the 6 GHz band (U-NII 5, 6, 7, 8), providing up to 1,200 MHz of additional spectrum. However:

- **Outdoor use requires AFC**: Standard-power outdoor APs must operate under Automated Frequency Coordination, adding complexity
- **Shorter range at 6 GHz**: Higher frequency = shorter propagation distance and more susceptibility to obstacles
- **Coverage continuity**: Best practice is to build contiguous 6 GHz coverage rather than islands, which is challenging across a sprawling airfield

### Recommendation for Airport AV Deployments

**Primary network**: Private 5G (CBRS or licensed spectrum) for all autonomous vehicle operations.
**Secondary/backup**: WiFi 6E in areas with dense AP coverage (terminals, ramp areas near buildings).
**Tertiary**: Public cellular as emergency fallback.

### Sources

- [Celona: Private 5G vs WiFi 6](https://www.celona.io/5g-lan/5g-vs-wi-fi-6)
- [Firecell: 5G or WiFi 6?](https://firecell.io/learn/5g-or-wifi-6/)
- [TechTarget: WiFi 6 vs 5G Deep Dive](https://www.techtarget.com/searchnetworking/feature/A-deep-dive-into-the-differences-between-5G-and-Wi-Fi-6)

---

## 8. Mesh Networking Between Vehicles

### V2X Communication Technologies

Vehicle-to-Everything (V2X) communication enables autonomous vehicles to interact with other vehicles, infrastructure, pedestrians, and the network. Two competing technologies exist:

#### DSRC (Dedicated Short-Range Communication)

| Parameter | Specification |
|-----------|---------------|
| Standard | IEEE 802.11p |
| Frequency | 5.9 GHz |
| Range | 300--1,000 meters |
| Latency | < 5 ms |
| Data rate | 3--27 Mbps |
| Status | Mature but declining adoption |
| Limitation | Small packet sizes; not suited for high-volume data exchange needed by autonomous vehicles |

#### C-V2X (Cellular Vehicle-to-Everything)

| Parameter | Specification |
|-----------|---------------|
| Standard | 3GPP Release 14+ (LTE-V2X), Release 16+ (NR-V2X) |
| Frequency | 5.9 GHz (PC5 sidelink), plus cellular bands (Uu) |
| Range | Up to 1,500+ meters (PC5 direct) |
| Latency | < 5 ms (PC5 direct) |
| Data rate | Up to 1 Gbps (NR-V2X) |
| Communication modes | PC5 (direct, no network needed) + Uu (via cellular network) |
| Status | Actively deployed; FCC approved for connected vehicles in 2023 |

### C-V2X Communication Modes

1. **PC5 Sidelink (Direct)**: Vehicles communicate directly without base station involvement. Works even without cellular coverage. Two sub-modes:
   - **Mode 1**: Base station allocates radio resources for sidelink communication
   - **Mode 2**: Vehicles autonomously select resources (works out-of-coverage)

2. **Uu Interface (Network)**: Communication routed through the cellular network for longer range and cloud integration.

### When is V2V/Mesh Networking Needed for Airport GSE?

| Scenario | V2V Needed? | Why |
|----------|-------------|-----|
| **Collision avoidance** at intersections | Yes | Sub-10ms vehicle-to-vehicle alerts for crossing paths on taxiways |
| **Platooning** (convoy of baggage tractors) | Yes | Tight formation requires < 5ms inter-vehicle latency |
| **Coverage gaps** (remote stands, construction zones) | Yes | PC5 sidelink operates without network infrastructure |
| **Cooperative perception** | Optional | Sharing sensor data between vehicles to extend situational awareness |
| **Fleet coordination** | No | Better handled by centralized MEC-based fleet manager |
| **Teleoperation** | No | Requires network backhaul to control center |

### Airport-Specific Considerations

- **Controlled environment advantage**: Unlike public roads, airports control all vehicles on the airfield. This makes centralized fleet management more practical than distributed mesh networking.
- **Low speeds**: At 15--25 km/h, the urgency of V2V collision avoidance is reduced compared to highway scenarios, though still valuable.
- **Complement, not replace**: V2V/C-V2X is best deployed as a supplement to the private 5G network, providing a safety-critical backup communication path that works independently of network infrastructure.

### Recommendation

Deploy **C-V2X with PC5 sidelink** on all autonomous GSE for:
- Safety-critical collision avoidance (independent of network)
- Operations in temporary coverage gaps
- Cooperative awareness between nearby vehicles

Use the **private 5G network (Uu interface)** for:
- All non-safety-critical communication
- Teleoperation
- Fleet management
- Data upload

### Sources

- [Keysight: V2X Vehicle-to-Everything Communication](https://www.keysight.com/blogs/en/inds/auto/2024/10/03/v2x-post)
- [Autocrypt: DSRC vs C-V2X Detailed Comparison](https://autocrypt.io/dsrc-vs-c-v2x-a-detailed-comparison-of-the-2-types-of-v2x-technologies/)
- [Analog Devices: Enabling 5G and DSRC V2X in Autonomous Driving](https://www.analog.com/en/signals/thought-leadership/enabling-5g-and-dsrc-v2x-in-autonomous-driving-vehicles.html)
- [Wikipedia: Cellular V2X](https://en.wikipedia.org/wiki/Cellular_V2X)

---

## 9. Bandwidth Requirements

### Per-Vehicle Bandwidth Budget

Based on research from teleoperation field trials and academic studies:

#### Uplink (Vehicle to Network)

| Data Stream | Bandwidth | Notes |
|-------------|-----------|-------|
| Single camera (1080p/30fps, H.265) | 8 Mbps | Per camera; H.264 requires ~12 Mbps |
| 4-camera teleoperation suite | 24--32 Mbps | Front, rear, left, right cameras |
| 6-camera panoramic coverage | 36--48 Mbps | Full surround view for teleop |
| LiDAR (64-beam, raw) | 277 Mbps | Impractical to stream raw |
| LiDAR (64-beam, voxel downsampled) | ~51 Mbps | With 0.5m^3 voxel downsampling |
| LiDAR (128-beam, raw) | 307 Mbps | Even less practical |
| Vehicle telemetry (position, speed, status) | 0.1--0.5 Mbps | Low bandwidth |
| Radar data | 1--5 Mbps | Compact data format |
| **Total per vehicle (practical teleop)** | **30--50 Mbps uplink** | 4 cameras + compressed LiDAR + telemetry |
| **Total per vehicle (full sensor upload)** | **100--350 Mbps uplink** | All raw sensor data; for logging, not real-time |

#### Downlink (Network to Vehicle)

| Data Stream | Bandwidth | Notes |
|-------------|-----------|-------|
| Control commands (steering, throttle, brake) | 0.1--0.3 Mbps | Very small packets |
| Fleet coordination messages | 0.1--0.5 Mbps | Route updates, assignments |
| Map/model updates | 1--10 Mbps (burst) | Periodic, not continuous |
| OTA software updates | 10--100 Mbps (burst) | Scheduled during idle periods |
| **Total per vehicle (operational)** | **0.5--1 Mbps downlink** | Continuous operation |

#### Daily Data Volume Estimates

| Metric | Estimate |
|--------|----------|
| Raw sensor data per hour (all sensors) | ~4 TB |
| Compressed operational data per hour | 15--25 GB |
| Teleop-mode data per hour (4 cameras) | 10--15 GB |
| Autonomous-mode uplink per hour | 1--5 GB (telemetry + periodic snapshots) |
| 8-hour shift per vehicle | 8--120 GB depending on mode |

### Fleet-Level Bandwidth Planning

| Fleet Size | Teleop Uplink (worst case) | Autonomous Uplink (typical) | Notes |
|------------|---------------------------|---------------------------|-------|
| 10 vehicles | 300--500 Mbps | 10--50 Mbps | Small initial fleet |
| 25 vehicles | 750 Mbps -- 1.25 Gbps | 25--125 Mbps | Medium fleet (e.g., Changi 2027 target) |
| 50 vehicles | 1.5--2.5 Gbps | 50--250 Mbps | Large airport fleet |
| 100 vehicles | 3--5 Gbps | 100--500 Mbps | Full-scale deployment |

**Critical note**: Not all vehicles require simultaneous teleoperation. A typical ratio is 1 teleoperator per 10--100 vehicles, with most vehicles operating fully autonomously. Realistic simultaneous teleop demand is 5--15% of fleet at any time.

### 5G Network Capacity Considerations

- Standard 5G TDD frame structures require **more than 60 MHz of spectrum** to support teleoperation of even a single vehicle per cell
- The **TDD uplink/downlink asymmetry** in commercial 5G is a key challenge: typical configurations allocate 70--80% of time slots to downlink, but teleoperation needs heavy uplink
- Private 5G allows **custom TDD configurations** optimized for uplink-heavy autonomous vehicle traffic
- Practical 5G uplink throughput in field trials: ~77.7 Mbps per cell (commercial network)

### Practical Research Data (2025 Field Trial)

A 6-month field trial teleoperating autonomous vehicles over commercial 5G (1,748 km of driving):

- Single camera (1080p/30fps/H.265): Median per-frame network delay of 73.5 ms (exceeds 45 ms target)
- Only 0.487% of frames exceeded the 100 ms application-level deadline (acceptable)
- Multiple cameras: 45--48% of frames violated the 45 ms network-level deadline (problematic)
- Command/control: 64.29% of messages met application requirements; median delay 17.29 ms
- Raw LiDAR streaming: Median delay of 2--6 seconds (impractical without heavy compression)

**Key takeaway**: Commercial 5G can support single-camera teleoperation but struggles with multi-camera and LiDAR streaming. Private 5G with custom uplink-optimized TDD configurations and MEC is essential for production-grade autonomous vehicle teleoperation.

### Sources

- [arXiv: Teleoperating Autonomous Vehicles over Commercial 5G Networks](https://arxiv.org/html/2507.20438v1)
- [DriveU: Complete Guide to AV Teleoperation](https://driveu.auto/blog/the-complete-guide-to-av-teleoperation/)
- [Ericsson: 5G Operated Remote Vehicles](https://www.ericsson.com/en/reports-and-papers/mobility-report/articles/remote-monitoring-and-control-of-vehicles)
- [Medium: Autonomous Cars Data Collection](https://medium.com/@autodriveai/autonomous-cars-will-collect-approximately-4-tb-of-data-every-hour-of-driving-3819aba33204)

---

## 10. Redundancy and Failover

### The Fundamental Requirement

For autonomous vehicles, **even one second of downtime can lead to disastrous results**. The connectivity architecture must ensure that no single point of failure can compromise vehicle safety.

### Multi-Layer Redundancy Architecture

```
Layer 1: Onboard Autonomy (no network required)
    |
Layer 2: C-V2X PC5 Sidelink (direct vehicle-to-vehicle/infrastructure)
    |
Layer 3: Primary Private 5G (CBRS / licensed spectrum)
    |
Layer 4: Secondary Cellular (public LTE/5G via different carrier)
    |
Layer 5: Tertiary Backup (WiFi / satellite in extreme cases)
```

### What Happens When Connectivity Drops

#### Behavior Hierarchy

| Connectivity State | Vehicle Behavior |
|-------------------|------------------|
| **Full connectivity** | Normal autonomous operation with teleoperation available |
| **Degraded connectivity** (high latency, packet loss) | Continue autonomous operation; alert fleet manager; buffer telemetry |
| **Teleoperation link lost** | Continue autonomous operation if safe; queue for teleop reconnection |
| **All network lost, V2X available** | Continue with V2X-based cooperative awareness; reduced speed |
| **All external comms lost** | Execute safe stop or continue on pre-planned route (depending on ODD) |
| **Emergency** | Immediate safe stop at current position or nearest safe harbor |

#### Safe Stop Protocol

The vehicle must be capable of independently:
1. Detecting connectivity loss within 1--2 seconds
2. Assessing whether continued operation is safe based on onboard perception
3. If continuing is safe: proceeding at reduced speed to the nearest designated safe stop point
4. If continuing is not safe: executing an immediate controlled stop, activating hazard indicators
5. Maintaining position awareness via GNSS and broadcasting location via any available channel

### Hardware Redundancy Approaches

#### Dual-Modem Router (Recommended for Airport AV)

| Feature | Specification |
|---------|---------------|
| Architecture | Two independent radio modules, active simultaneously |
| Failover speed | Sub-second ("hot standby") |
| SIM configuration | Dual SIM (different carriers/spectrum bands) |
| Bandwidth bonding | Combines both connections for aggregate throughput |
| Technology | SpeedFusion or similar (Peplink, Cradlepoint) |
| Cost | $1,000--$3,000 per vehicle |

#### Comparison of Failover Approaches

| Approach | Failover Time | Pros | Cons |
|----------|--------------|------|------|
| **Dual-Modem (hot standby)** | < 1 second | Seamless; backup always connected | Higher cost; more power draw |
| **Dual-SIM, single modem** | 30--90 seconds | Lower cost | Unacceptable gap for AV operations |
| **Network bonding (active-active)** | 0 seconds | Both links always active; aggregate bandwidth | Highest cost; most complex |
| **WiFi + cellular** | 2--5 seconds | Low incremental cost | WiFi coverage gaps; inconsistent |

### Network Bonding for Teleoperation

Leading AV companies implement **triple-redundant communication networks**:

1. **Primary**: High-bandwidth 5G connection for normal operations
2. **Secondary**: LTE/4G fallback with optimized compression
3. **Tertiary**: Satellite link for emergency connectivity in cellular dead zones

**SpeedFusion technology** (Peplink) enables:
- **Hot Failover**: Seamless transfer to alternative WAN; users may not realize a failover occurred
- **Bandwidth Bonding**: Combines multiple connections into one, using the combined bandwidth of multiple WANs
- **Forward Error Correction**: Cross-channel FEC recovers lost packets without retransmission
- **Adaptive Buffering**: Smooths out connectivity variations

### Buffering Strategy

| Data Type | Buffer Duration | Behavior During Connectivity Loss |
|-----------|----------------|-----------------------------------|
| Control commands | 0 (real-time only) | Vehicle reverts to onboard autonomy |
| Vehicle telemetry | 30--60 seconds | Cached locally; transmitted when connection restores |
| Camera streams | 5--10 seconds | Circular buffer; teleoperator sees frozen frame then reconnects |
| Sensor recordings | Hours | Written to onboard storage; uploaded later |
| Fleet coordination | 10--30 seconds | Vehicle continues last known route plan |

### Sources

- [Peplink: 5G Teleoperation of Autonomous Vehicles](https://www.peplink.com/newsroom/application-of-5g-networks-in-teleoperation-of-autonomous-vehicles/)
- [DriveU: Teleoperation Connectivity Platform](https://driveu.auto/teleoperation/teleoperation-connectivity-platform/)
- [Mobileye: AV Safety Demands True Redundancy](https://www.mobileye.com/blog/av-safety-demands-true-redundancy/)
- [Volvo: Approach to Redundancy in Autonomous Vehicles](https://www.volvoautonomoussolutions.com/en-en/news-and-insights/insights/articles/2024/jul/doubling-down-on-safety.html)

---

## 11. Airport RF Environment

### The Challenge

Airports are among the most complex RF environments in existence. Autonomous vehicle connectivity must coexist with safety-critical aviation systems while dealing with extreme device density and diverse interference sources.

### Aviation Systems and Frequency Bands

| System | Frequency Band | Function | Proximity to CBRS? |
|--------|---------------|----------|---------------------|
| **Radar Altimeters** | 4.2--4.4 GHz | Aircraft altitude measurement during approach/landing | Close to C-Band 5G (3.7--3.98 GHz); NOT close to CBRS (3.5 GHz) |
| **ILS (Instrument Landing System)** | 108--112 MHz (localizer), 329--335 MHz (glideslope) | Precision approach guidance | No conflict |
| **Airport Surveillance Radar (ASR)** | 2.7--2.9 GHz | Aircraft tracking in terminal area | Below CBRS; minimal concern |
| **Surface Movement Radar** | 9.0--9.5 GHz (X-band) | Ground vehicle/aircraft tracking on surface | No conflict |
| **ADS-B** | 1090 MHz / 978 MHz | Aircraft position broadcasting | No conflict |
| **VHF Communications** | 118--137 MHz | Air traffic control voice | No conflict |
| **DME (Distance Measuring Equipment)** | 960--1215 MHz | Navigation distance measurement | No conflict |
| **GNSS (GPS)** | 1176, 1227, 1575 MHz | Satellite navigation | No conflict with CBRS; susceptible to broadband interference |
| **Military Radar (Navy)** | 3550--3700 MHz | Ship-based radar systems | **Direct overlap with CBRS** --- managed by SAS/DPA |

### CBRS (3.5 GHz) vs. C-Band (3.7 GHz) Safety Distinction

**Critical clarification**: The widely publicized 5G-aviation interference controversy involves the **C-Band (3.7--3.98 GHz)**, not CBRS (3.55--3.7 GHz). The C-Band operates much closer to radar altimeter frequencies (4.2--4.4 GHz) and at much higher power levels.

CBRS operates at **lower frequencies and lower power levels** than C-Band, providing greater spectral separation from radar altimeters:

| Parameter | CBRS | C-Band 5G |
|-----------|------|-----------|
| Frequency | 3550--3700 MHz | 3700--3980 MHz |
| Gap to radar altimeters | 500+ MHz | 220 MHz (minimum) |
| Max power (outdoor) | ~50 dBm/10 MHz EIRP (Category B) | Much higher (carrier macro) |
| Interference risk to altimeters | Very low | Documented concern; FAA mitigations required |

### Airport-Specific Interference Considerations

1. **GNSS/RTK vulnerability**: Autonomous vehicles relying on RTK-GNSS for centimeter-level positioning can be disrupted by broadband RF emissions. Mitigation: Use filtered GNSS receivers and multi-constellation (GPS + GLONASS + Galileo + BeiDou) redundancy.

2. **Radar side-lobe interference**: Airport surveillance radar operates at 2.7--2.9 GHz. While not directly overlapping with CBRS, high-power radar side lobes can desensitize nearby receivers. Mitigation: Physical separation and RF filtering.

3. **Passenger device density**: During peak hours, thousands of active cellular and WiFi devices create a high noise floor. Private 5G on dedicated CBRS spectrum is isolated from this by design.

4. **Jet engine EMI**: Jet engines and APUs generate broadband electromagnetic interference. Vehicles operating near running aircraft need hardened radio equipment.

5. **Reflections and multipath**: Large metal aircraft surfaces, hangars, and terminal buildings create severe multipath propagation. 5G NR's beam management and MIMO capabilities handle multipath better than WiFi.

### Regulatory Protections

- **CAAS (Singapore)**: Established restrictions on transmission power and antenna tilt angle for 5G at Changi Airport to ensure flight operation safety
- **FAA (US)**: Developed interference tolerance requirements for radio altimeters; phased retrofit of RF filters on susceptible aircraft
- **FCC/NTIA**: SAS manages CBRS to protect federal incumbents including military radar near airports
- **ICAO**: Working on global guidance for 5G/aviation coexistence

### Sources

- [FAA: Statements on 5G](https://www.faa.gov/newsroom/faa-statements-5g)
- [SKYbrary: Radio Altimeter Interference](https://skybrary.aero/articles/radio-altimeter-interference)
- [Spectrum Control: RF Filters for 5G in Aviation](https://info.spectrumcontrol.com/rf-filters-5g-aviation)
- [NBAA: 5G Interference](https://nbaa.org/aircraft-operations/communications-navigation-surveillance-cns/5g-interference/)

---

## 12. Cost Model

### Infrastructure Cost Breakdown

#### Capital Expenditure (CapEx)

| Component | Cost Range | Notes |
|-----------|-----------|-------|
| **5G Base Station (macro)** | $100,000--$200,000 per site | Outdoor, high-power; covers up to 1 sq mi |
| **Small cells (indoor/outdoor)** | $10,000--$50,000 per unit | Depends on location and mounting infrastructure |
| **5G Core Network** | $100,000--$500,000 | On-premise core; Nokia DAC, Ericsson EP5G, or equivalent |
| **MEC servers** | $50,000--$150,000 per node | Edge compute for each ramp zone |
| **Backhaul (fiber)** | $50,000+ per endpoint | Or leverage existing airport fiber plant |
| **Field routers (vehicles)** | $1,000--$3,000 per vehicle | Dual-modem cellular routers (Peplink, Cradlepoint) |
| **SAS subscription** | $5,000--$15,000/year | Spectrum Access System for CBRS coordination |
| **CBRS spectrum (GAA)** | Free | No licensing fee for General Authorized Access |
| **CBRS spectrum (PAL)** | Varies by county | Priority Access License via auction; provides interference protection |
| **Site surveys and RF design** | $25,000--$100,000 | One-time; scales with campus size |
| **Installation and integration** | $100,000--$500,000 | Professional services; depends on complexity |

#### Deployment Scenarios

| Scenario | Coverage | Infrastructure | Estimated CapEx |
|----------|----------|---------------|----------------|
| **Pilot (single ramp area)** | ~1 sq mi | 3--5 small cells + 1 core | $200K--$500K |
| **Medium (terminal complex)** | ~5 sq mi | 10--15 small cells + 2--3 MEC nodes | $1M--$3M |
| **Full airport (DFW-scale)** | ~27 sq mi | 30+ sites + full core + MEC | $5M--$15M |

**Reference**: DFW's contract with AT&T was **$10 million over 5 years**, covering both private 5G CBRS and WiFi infrastructure across 27 square miles.

#### Operating Expenditure (OpEx)

| Component | Annual Cost | Notes |
|-----------|------------|-------|
| **Network management** | 15--20% of CapEx | 24/7 monitoring, troubleshooting |
| **Software licenses** | $50,000--$200,000 | Core network, management platform, SAS |
| **SIM management** | $5--$15 per device/month | Provisioning, lifecycle management |
| **Power and cooling** | $20,000--$100,000 | For MEC nodes and base stations |
| **Backhaul/internet** | $20,000--$100,000 | Dedicated fiber or leased lines |
| **Staff or managed services** | $150,000--$500,000 | Network engineers or outsourced to provider |
| **Spectrum fees (if PAL)** | Varies | Recurring if using Priority Access Licenses |

### Cost Comparison: Private 5G vs. Alternatives

| Solution | CapEx per sq mi | Annual OpEx | Suitability for AV |
|----------|----------------|-------------|---------------------|
| **Private 5G (CBRS)** | $150K--$400K | $50K--$150K | Excellent |
| **WiFi 6/6E** | $300K--$800K (more APs needed) | $100K--$300K | Poor for outdoor AV |
| **Public cellular** | Near zero | $50--$100/device/month | Insufficient for AV operations |
| **Fiber to each location** | $50K+ per endpoint | $10K--$50K | Not feasible for moving vehicles |

**Key insight from DFW**: CBRS field routers cost under $1,000 each vs. $50,000+ per fiber endpoint for remote connectivity --- a 50x cost advantage for connecting mobile and remote assets.

### ROI Considerations

- Most organizations achieve **ROI within 12--24 months** of private 5G deployment
- Stanley Robotics (Lyon Airport): Private 5G enabled scaling from initial robots to management of **100 robots simultaneously**, with 50% improvement in parking efficiency
- Port of Liverpool: **Tenfold performance boost** vs. legacy WiFi, reducing operational costs by up to 50%
- Automation paired with private 5G connectivity can boost ROI by **up to 178%** (Firecell analysis)

### Sources

- [Metro Wireless: Private Cellular Network Cost](https://www.metrowireless.com/blog/private-cellular-network-cost-breaking)
- [Ericsson/Cradlepoint: ROI and Cost of Private 5G](https://cradlepoint.com/resources/blog/examining-the-roi-and-cost-of-private-5g-and-lte/)
- [PatentPC: 5G Infrastructure Costs](https://patentpc.com/blog/5g-infrastructure-costs-what-telcos-are-paying)
- [Celona: TCO for Private Wireless](https://www.celona.io/5g-lan/demystifying-total-cost-of-ownership-for-a-private-wireless-solution)

---

## 13. Vendors

### Nokia

**Product**: Nokia Digital Automation Cloud (DAC) / Modular Private Wireless (MPW)

| Attribute | Details |
|-----------|---------|
| Offerings | 4G/LTE and 5G private wireless with edge computing |
| Architecture | Radios + MX Industrial Edge (core + applications) + cloud management |
| Spectrum support | Licensed, CBRS, unlicensed |
| Edge platform | MX Industrial Edge --- runs core network and industrial applications |
| Deployment model | Plug-and-play; compact option for smaller sites |
| Airport deployments | DFW Airport (33 CBRS sites via Nokia radios), MCA Aviation partnership for US airports |
| Strengths | Deep industry expertise in mission-critical sectors (ports, airports, mining, utilities); carrier-grade reliability |
| Key feature | Deterministic QoS; centimeter-level indoor positioning; GNSS-enhanced outdoor tracking |
| Note (2025) | Nokia announced plans to restructure its private networking business, potentially selling its Enterprise Campus Edge unit. Mission-critical focus remains. |

### Ericsson

**Product**: Ericsson Private 5G (EP5G)

| Attribute | Details |
|-----------|---------|
| Offerings | 4G and 5G private cellular networks as managed service |
| Architecture | Ericsson Radio System portfolio + enterprise-grade network controllers |
| Management | Cloud-based Ericsson Network Manager (ENM) + self-service portal |
| Deployment sizes | Small, Medium, Large, Extra Large |
| Airport deployments | Paris-Charles de Gaulle / Paris-Orly / Paris-Le Bourget (with Hub One / Air France); Purdue University Airport (with Saab, CBRS GAA) |
| 2025-2026 expansion | Added 33 new radios to EP5G portfolio in 2025; hundreds of enterprise customers across multiple countries |
| Strengths | Largest global cellular infrastructure company; massive R&D; open APIs for IT/OT integration |
| Aviation partnership | Ericsson + Streamwide for MCx (mission-critical) communications at airports |
| Key feature | Connected Aviation vision: private mobile networks for baggage handling automation, connected workers, autonomous systems |

### Samsung

**Product**: Samsung Private 5G Network Solutions

| Attribute | Details |
|-----------|---------|
| Offerings | Compact, Standard, and Premium configurations |
| Architecture | Virtualized platform consolidating DU, CU, UPF, and virtual switch in a single server ("Network in a Server") |
| Compact option | All-in-one-box with RAN and compact core --- simplest deployment |
| Standard option | Multi-site configuration for mid-sized businesses |
| Premium option | Large-scale with high scalability |
| Key hardware | Compact Macro radio --- designed for dense environments including stadiums and airports |
| CBRS | Received FCC conditional waiver (May 2025) for multiband devices operating in both 3.5 GHz CBRS and 3.7 GHz C-Band |
| Strengths | End-to-end solution including baseband, radio, core, and management; URLLC support; carrier-grade capabilities in compact form factors |

### Qualcomm

**Product**: Qualcomm 5G RAN Platform for Small Cells (FSM series)

| Attribute | Details |
|-----------|---------|
| Role | Chipset provider --- powers small cells from multiple OEMs |
| Key platform | FSM200xx --- first 3GPP Release 16 5G Open RAN platform |
| Performance | Up to 8 Gbps with 1 GHz mmWave bandwidth; 200 MHz carrier bandwidth support |
| Process node | 4nm --- energy-efficient enough for Power over Ethernet (PoE) deployment |
| Ecosystem | 5G Private Network Partner Ecosystem Program with documented "blueprints" |
| Airport relevance | Designed for seamless connectivity in crowded environments (airports, venues, hospitals) |
| Partners using FSM | Airspan, Radisys, Globalstar, and multiple other small cell OEMs |
| Strengths | Open RAN leadership; power efficiency; broad ecosystem of partners; competitive cost for small cells |

### Other Notable Vendors

| Vendor | Role | Airport Relevance |
|--------|------|-------------------|
| **Celona** | Private 5G LAN solutions | CBRS-based enterprise 5G with self-service management |
| **Betacom** | Private 5G managed service | Airport-focused private 5G deployments |
| **Peplink** | Vehicle connectivity routers | MBX 5G routers with SpeedFusion bonding/failover for AV teleoperation |
| **Cradlepoint (Ericsson)** | Enterprise routers | 5G/LTE vehicle routers with NetCloud management |
| **Federated Wireless** | SAS provider | Spectrum Access System for CBRS coordination |
| **Cisco** | WiFi + converged management | WiFi APs + unified management (as deployed at DFW) |
| **ORAXIO Telecom** | Private 5G deployment | Partnered with Stanley Robotics for autonomous parking at Lyon Airport |
| **Firecell** | Private 5G platform | Network slicing, edge computing for ports and airports |
| **HPE** | Private 5G + edge compute | End-to-end private 5G with Aruba and edge infrastructure |

### Vendor Selection Framework for Airport AV Deployments

| Criterion | Weight | Considerations |
|-----------|--------|---------------|
| **Airport/aviation experience** | High | Proven deployments in regulated airport environments |
| **CBRS expertise** | High | SAS integration, GAA/PAL management, DPA handling |
| **URLLC support** | High | Network slicing, deterministic QoS for vehicle control |
| **Edge computing integration** | High | MEC platform for local processing of AV data |
| **Managed service option** | Medium | Airport IT teams may lack cellular expertise |
| **Open RAN / interoperability** | Medium | Avoid vendor lock-in; enable best-of-breed components |
| **Vehicle router ecosystem** | Medium | Compatibility with dual-modem vehicle connectivity hardware |
| **Scalability** | Medium | Path from pilot (5 vehicles) to full fleet (100+ vehicles) |
| **Cost model** | Medium | CapEx vs. OpEx; subscription vs. perpetual licensing |

### Sources

- [Nokia DAC: Edge Compute and AI Platform](https://www.dac.nokia.com/)
- [MCA Aviation: Private Wireless for Airports with Nokia](https://callmc.com/private-wireless-airports/)
- [Ericsson: Private 5G](https://www.ericsson.com/en/private-networks/ericsson-private-5g)
- [Ericsson: Connected Aviation](https://www.ericsson.com/en/industries/airports)
- [Samsung: Private Networks](https://www.samsung.com/global/business/networks/solutions/private-networks/)
- [Qualcomm: 5G RAN Platform](https://www.qualcomm.com/news/releases/2020/02/global-cellular-infrastructure-firms-select-qualcomm-5g-ran-technologies)
- [Peplink: 5G Teleoperation of Autonomous Vehicles](https://www.peplink.com/newsroom/application-of-5g-networks-in-teleoperation-of-autonomous-vehicles/)

---

## Summary: Connectivity Architecture Recommendation for Airport Autonomous Vehicles

### Primary Network: Private 5G on CBRS

- Deploy CBRS-based private 5G across the operational airfield
- Use GAA tier initially (no spectrum licensing cost); acquire PAL licenses for critical areas if interference protection is needed
- Place MEC nodes at each major ramp area for sub-10ms latency
- Configure custom TDD frame structure optimized for uplink-heavy AV traffic
- Implement URLLC network slice for control commands, eMBB slice for video/data

### Vehicle Connectivity: Dual-Modem with Network Bonding

- Each vehicle: dual-modem 5G router (e.g., Peplink MBX) with primary on private 5G, secondary on public LTE/5G
- SpeedFusion or equivalent for hot failover and bandwidth bonding
- C-V2X PC5 sidelink module for direct vehicle-to-vehicle safety communication

### Failover Hierarchy

1. Onboard autonomy (always available, no network needed)
2. C-V2X PC5 sidelink (direct, network-independent)
3. Private 5G (CBRS)
4. Public cellular (secondary SIM)
5. WiFi (where available)
6. Safe stop (last resort)

### Bandwidth Planning

- Budget 30--50 Mbps uplink per vehicle in teleoperation mode
- Plan for 5--15% simultaneous teleoperation ratio
- For 25-vehicle fleet: provision ~200--375 Mbps aggregate uplink capacity
- Ensure custom TDD ratio favoring uplink (e.g., 60/40 DL/UL instead of standard 80/20)

### Cost Estimate for Mid-Size Airport Deployment

| Item | Estimated Cost |
|------|---------------|
| Infrastructure (20 small cells + core + 3 MEC nodes) | $2M--$5M |
| Vehicle equipment (25 vehicles x $3K) | $75K |
| Installation and integration | $200K--$500K |
| Annual OpEx (managed service) | $400K--$800K |
| **Total Year 1** | **$2.7M--$6.4M** |
| **5-Year TCO** | **$4.3M--$9.6M** |

---

*Report compiled March 2026. Sources verified as of publication date.*
