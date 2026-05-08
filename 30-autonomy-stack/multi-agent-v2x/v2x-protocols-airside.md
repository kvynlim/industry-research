# V2X Communication Protocols and Message Standards for Airside Autonomous Vehicle Coordination

> **Purpose**: Deep-dive into Vehicle-to-Everything (V2X) communication protocols, message architectures, and custom message standards required for coordinating autonomous GSE fleets on airport aprons. Covers radio access technologies (DSRC, C-V2X, 5G NR V2X), ETSI ITS message sets, airside-specific message extensions, security architecture, bandwidth planning, and integration with airport operational systems (A-CDM, A-SMGCS, ADS-B). Provides field-level message specifications, example payloads, ROS integration patterns, and a standards roadmap.
>
> **Key Takeaway**: No V2X standard exists for airport airside operations --- ICAO, ACI, and SAE have not addressed GSE-to-GSE or GSE-to-infrastructure communication. Road V2X standards (ETSI ITS, SAE J2945) provide a solid architectural foundation but require eight or more custom airside message types (aircraft proximity, jet blast warning, stand operation status, FOD detection, runway incursion prevention, de-icing zone, emergency vehicle priority, GSE task assignment) to handle the unique safety and coordination challenges of apron operations. C-V2X over private 5G/CBRS is the preferred radio access for airports that already have or plan 5G infrastructure (most major airports by 2028), with PC5 sidelink providing a direct V2V fallback when network connectivity drops. A complete V2X message bus for a 50-vehicle fleet requires approximately 8-12 Mbps sustained bandwidth --- well within private 5G capacity but demanding careful congestion management during peak turnaround periods.
>
> **Relation to existing docs**: Extends `fleet-coordination.md` Section 1.1 (V2X overview) and Section 5 (communication architectures) with protocol-level detail. References `airport-5g-cbrs.md` for radio infrastructure, `collaborative-fleet-perception.md` for cooperative perception message content, and `ground-control-instructions.md` for A-CDM/A-SMGCS integration points.

---

## Table of Contents

1. [Why V2X for Airside Operations](#1-why-v2x-for-airside-operations)
2. [Radio Access Technologies: C-V2X vs DSRC for Airports](#2-radio-access-technologies)
3. [ETSI ITS Message Architecture](#3-etsi-its-message-architecture)
4. [Airside-Specific Message Extensions](#4-airside-specific-message-extensions)
5. [Message Format Specification](#5-message-format-specification)
6. [Integration with Airport Systems](#6-integration-with-airport-systems)
7. [Bandwidth and Capacity Planning](#7-bandwidth-and-capacity-planning)
8. [Security and Authentication](#8-security-and-authentication)
9. [Cooperative Perception via V2X](#9-cooperative-perception-via-v2x)
10. [Implementation Architecture](#10-implementation-architecture)
11. [Standards Landscape and Roadmap](#11-standards-landscape-and-roadmap)
12. [Key Takeaways](#12-key-takeaways)

---

## 1. Why V2X for Airside Operations

### 1.1 The Coordination Problem

Airport aprons present a coordination challenge fundamentally different from road driving. On roads, vehicles follow lane markings, traffic signals, and right-of-way rules that are standardized, static, and well-understood by all participants. On airport aprons:

- **Dynamic right-of-way**: Priority changes based on aircraft status (pushback has absolute priority), turnaround phase, and ATC instructions. A baggage tractor that had right-of-way 30 seconds ago must now yield because an aircraft door opened.
- **Mixed-mode operations**: Autonomous GSE share space with human-driven vehicles, ground crew on foot, aircraft under tow, fuel trucks, catering vehicles, and emergency responders --- all with different communication capabilities.
- **Tight spatial constraints**: Aircraft stands have 3-5 meter clearances between wing tips and obstacles. Equipment must sequence through narrow corridors between fuselages without collision.
- **Time-critical sequencing**: Turnaround operations have strict precedence constraints (fuel before catering, GPU before pushback disconnect) with delays costing airlines $50-150 per minute.
- **Invisible hazards**: Jet blast zones, de-icing chemical boundaries, and fuel vapor concentrations are not directly observable by onboard sensors alone.

Single-vehicle perception and planning cannot solve these problems. A vehicle approaching an aircraft stand cannot see the fuel truck on the opposite side of the fuselage. It cannot know that pushback has been cleared by ATC unless that information is communicated. It cannot detect the de-icing spray boundary from 200 meters away.

### 1.2 What V2X Enables on the Apron

V2X communication provides four capabilities that onboard sensing cannot:

```
1. BEYOND-LINE-OF-SIGHT AWARENESS
   - Vehicles behind aircraft fuselages
   - Personnel in occluded zones
   - Equipment approaching from adjacent stands

2. SEMANTIC INTENT SHARING
   - "I am about to begin pushback" (not just: I am moving slowly)
   - "This zone is contaminated with de-icing fluid"
   - "Emergency vehicle approaching from Taxiway Alpha"

3. OPERATIONAL CONTEXT
   - Current turnaround phase at Stand B7
   - ATC clearance status for movement area
   - NOTAM-based route restrictions

4. COOPERATIVE PERCEPTION
   - Shared LiDAR features for collective detection
   - Multi-viewpoint FOD detection
   - Fleet-level situational awareness
```

### 1.3 Road V2X vs Airside V2X: Key Differences

The fundamental gap is that road V2X has mature standards while airside V2X has none. But the requirements also differ in important ways:

| Dimension | Road V2X | Airside V2X |
|-----------|----------|-------------|
| **Participants** | Cars, trucks, pedestrians, infrastructure | GSE, aircraft, ground crew, airport systems, ATC |
| **Speed regime** | 0-130 km/h | 0-25 km/h (GSE), 0-30 km/h (aircraft taxi) |
| **Coordination mode** | Mostly implicit (traffic rules) | Explicit (task assignment, sequencing) |
| **Hazard types** | Collision, road conditions | Collision, jet blast, chemical exposure, FOD, runway incursion |
| **Latency tolerance** | 20-100 ms for safety | 20 ms for safety-critical (aircraft proximity), 100-500 ms for coordination |
| **Network topology** | Open (any vehicle) | Closed (fleet + airport systems) |
| **Standards** | IEEE 802.11p, ETSI ITS, SAE J2945 | None (gap) |
| **Trust model** | PKI with pseudonym certificates | Airport-managed PKI, known fleet |
| **Update frequency** | 10 Hz CAM standard | 10 Hz position, up to 50 Hz for cooperative perception |
| **Infrastructure integration** | Traffic signals, RSUs | A-CDM, A-SMGCS, ADS-B, AODB, AMAN/DMAN |
| **Regulatory authority** | National road authorities | ICAO, national CAAs, airport operator |
| **Fleet size per site** | Hundreds to thousands | 10-200 (bounded by airport size) |

### 1.4 The Case for Custom Message Standards

Standard ETSI ITS messages (CAM, DENM, CPM, MCM) cover perhaps 40% of airside communication needs. The remaining 60% requires custom message types that encode:

- **Aircraft-specific semantics**: Door status, engine state, pushback phase, aircraft type (determines blast zones and clearance requirements)
- **Turnaround sequencing**: Which equipment is at which stand, what phase the turnaround is in, what equipment is expected next
- **Airside-specific hazards**: Jet blast polygons, de-icing chemical drift, FOD locations, fuel spill boundaries
- **ATC integration**: Hold-short status, movement area clearance, runway incursion prevention
- **Task management**: Route assignments, time windows, priority changes, conflict resolution decisions

These are not minor extensions --- they represent entirely new message categories that must be designed, specified, and implemented. This document provides those specifications.

### 1.5 Current State of Competitor Communication

No airside AV competitor has published V2X protocol specifications:

| Competitor | Communication Approach | V2X? |
|-----------|----------------------|------|
| **UISEE** | Proprietary fleet management over 5G, vehicle-to-cloud-to-vehicle | No direct V2V |
| **TractEasy** | WiFi-based fleet management, teleoperation link | No V2X |
| **AeroVect** | Cloud-based task dispatch, teleoperation fallback | No V2X |
| **reference airside AV stack (current)** | ROS topics over WiFi within each vehicle | No V2X |

All competitors use a centralized cloud/server model where vehicles communicate through a fleet management server rather than directly with each other. This creates a single point of failure and adds latency (vehicle-to-cloud-to-vehicle: 50-200 ms vs V2V direct: 5-20 ms). Building native V2X capability is a potential competitive differentiator.

---

## 2. Radio Access Technologies

### 2.1 DSRC (IEEE 802.11p / ETSI ITS-G5)

Dedicated Short-Range Communications was the first technology specifically designed for V2X:

**Technical Specifications:**

| Parameter | Value |
|-----------|-------|
| Standard | IEEE 802.11p (US) / ETSI EN 302 663 (EU) |
| Frequency band | 5.850-5.925 GHz (US), 5.855-5.925 GHz (EU) |
| Channel bandwidth | 10 MHz (default), 20 MHz optional |
| Data rate | 3-27 Mbps (OFDM, 6 Mbps default for safety) |
| Range | 300-1000 m (LOS), 100-300 m (NLOS) |
| Latency | 1-5 ms (single hop) |
| Access method | CSMA/CA (contention-based) |
| Modulation | BPSK, QPSK, 16-QAM, 64-QAM |
| Max TX power | 33 dBm (EIRP) in US |
| Channel count | 7 channels (US), 5 channels (EU) |

**Advantages for airports:**
- Sub-5 ms latency without network dependency
- Mature standard with 15+ years of development
- Direct V2V without infrastructure (ad-hoc mode)
- Well-understood security (IEEE 1609.2)

**Disadvantages for airports:**
- Limited bandwidth (6 Mbps at safety-reliable modulation)
- CSMA/CA degrades under high vehicle density (>50 nodes contending)
- 5.9 GHz band potentially shared with WiFi 6E (FCC R&O 20-305 opened 5.925-7.125 GHz to unlicensed, ongoing interference concerns)
- No QoS guarantee (contention-based access)
- Separate hardware required (OBUs and RSUs)
- Spectrum allocation uncertain in some jurisdictions

**Airport-specific concerns:**
- 5.9 GHz band may experience interference from airport radar and communications systems, particularly ASR (Airport Surveillance Radar) operating at 2.7-2.9 GHz (harmonics) and SSR at 1030/1090 MHz (intermodulation products near other airport RF systems)
- Indoor-to-outdoor transitions at terminal buildings create multipath issues
- Aircraft fuselages create severe NLOS conditions

### 2.2 C-V2X (3GPP Release 14/15)

Cellular V2X was standardized in 3GPP Release 14 (2017) as an LTE-based alternative to DSRC:

**Technical Specifications:**

| Parameter | Value |
|-----------|-------|
| Standard | 3GPP TS 36.300 (Rel-14/15) |
| Frequency band | 5.9 GHz (ITS band) + cellular bands |
| Channel bandwidth | 10/20 MHz (PC5), cellular (Uu) |
| Data rate | Up to 50 Mbps (PC5), LTE rates (Uu) |
| Range | 500-1500 m (PC5), cellular (Uu) |
| Latency | 10-20 ms (PC5 Mode 4), 20-100 ms (Uu) |
| Access method | SC-FDMA (scheduled, Mode 3) or SPS (autonomous, Mode 4) |
| Modulation | QPSK, 16-QAM |
| Duplex | Half-duplex FDD or TDD |

**Two communication interfaces:**
- **PC5 (sidelink)**: Direct device-to-device communication, no network required
  - **Mode 3**: Network-scheduled --- eNB allocates resources. Requires cellular coverage. Lower latency, better QoS.
  - **Mode 4**: Autonomous --- devices self-schedule using Sensing-Based Semi-Persistent Scheduling (SB-SPS). No network required. Higher latency, potential collisions.
- **Uu (uplink)**: Traditional cellular path through base station. Higher latency but unlimited range via network.

**Advantages over DSRC:**
- SC-FDMA provides better spectrum efficiency than OFDMA under high load
- Mode 3 eliminates contention (network-scheduled)
- Turbo coding + HARQ retransmission provides superior reliability (BLER < 10^-5 at 20 dB SNR)
- Path toward 5G NR V2X (backward compatible)
- Can reuse existing cellular infrastructure (Uu path)

**Disadvantages:**
- PC5 Mode 4 half-duplex creates hidden node problems
- Mode 3 requires network coverage (single point of failure without Mode 4 fallback)
- Higher power consumption than DSRC
- Less mature ecosystem (fewer deployed OBUs)

### 2.3 5G NR V2X (3GPP Release 16+)

5G New Radio V2X represents a generational leap, designed specifically for advanced V2X use cases:

**Technical Specifications:**

| Parameter | Value |
|-----------|-------|
| Standard | 3GPP TS 38.300 (Rel-16/17/18) |
| Frequency band | Sub-6 GHz (FR1), mmWave (FR2, 24-52 GHz) |
| Channel bandwidth | 10-100 MHz (FR1), up to 400 MHz (FR2) |
| Data rate | 1+ Gbps (downlink), 500+ Mbps (uplink) |
| Range | 500-1500 m (FR1), 100-300 m (FR2) |
| Latency | <1 ms (URLLC), 1-4 ms (eMBB) |
| Access method | Grant-free (configured grant), scheduled |
| Modulation | QPSK to 256-QAM, CP-OFDM |
| MIMO | Up to 8 layers (FR1), 2 layers (FR2) |
| Reliability | 99.999% (URLLC, 32 bytes, 1 ms) |

**Key improvements over LTE C-V2X:**
- **URLLC (Ultra-Reliable Low-Latency Communication)**: <1 ms latency with 99.999% reliability --- sufficient for safety-critical messages
- **Groupcast and broadcast**: Native support for group communication (fleet-level messaging)
- **NR sidelink**: Enhanced PC5 with feedback channel, HARQ, 64-QAM support
- **Network slicing**: Dedicated slice for V2X traffic, isolated from other airport 5G users
- **MEC (Multi-access Edge Computing)**: Process cooperative perception at the edge, <10 ms round-trip
- **Positioning**: NR positioning accuracy <1 m (Release 16), <0.3 m (Release 17) --- supplementary to GTSAM

**5G NR V2X service types (3GPP TS 22.186):**

| Service Type | Latency | Reliability | Data Rate | Example |
|-------------|---------|-------------|-----------|---------|
| Group 1 (Basic Safety) | 3-10 ms | 99.99% | 10-50 kbps | Position broadcast, collision warning |
| Group 2 (Advanced Driving) | 3-10 ms | 99.999% | 10-50 Mbps | Cooperative perception, platooning |
| Group 3 (Extended Sensors) | 10-100 ms | 99.99% | 10-1000 Mbps | Sensor sharing, video stream |
| Group 4 (Remote Driving) | 5-20 ms | 99.999% | 25 Mbps UL | Teleoperation |

### 2.4 Airport-Specific Decision Framework

Given the three technology options, airports face a technology selection decision. The key factors:

```
DECISION TREE: V2X RADIO ACCESS FOR AIRSIDE

Does the airport have or plan private 5G/CBRS?
├── YES (most major airports by 2028)
│   ├── 5G NR V2X over Uu (primary path)
│   │   - Uses existing 5G infrastructure
│   │   - URLLC slice for safety messages
│   │   - MEC for cooperative perception
│   │   - Network slicing isolates V2X traffic
│   ├── NR PC5 sidelink (V2V fallback)
│   │   - Direct vehicle-to-vehicle when network drops
│   │   - Pre-configured resource pools
│   │   - Essential for safety-critical messages
│   └── Recommendation: 5G NR V2X (Uu primary + PC5 fallback)
│
└── NO (smaller regional airports)
    ├── LTE C-V2X PC5 Mode 4 (primary)
    │   - No infrastructure required
    │   - Self-organizing mesh
    │   - Sufficient for <50 vehicle fleets
    ├── DSRC (alternative)
    │   - Lower latency, simpler deployment
    │   - But limited bandwidth, uncertain spectrum future
    └── Recommendation: C-V2X PC5 Mode 4 with WiFi backhaul
```

**Comparison matrix for airport deployment:**

| Factor | DSRC | LTE C-V2X | 5G NR V2X |
|--------|------|-----------|-----------|
| **Latency** | 1-5 ms | 10-20 ms (PC5) | <1 ms (URLLC) |
| **Bandwidth** | 3-27 Mbps | Up to 50 Mbps | 1+ Gbps |
| **Infrastructure needed** | RSUs ($5-15K each) | eNB or standalone | 5G gNB (shared) |
| **Cooperative perception** | Marginal (6 Mbps limit) | Possible (compressed features) | Full (raw features viable) |
| **Airport 5G synergy** | None (separate system) | Partial (LTE reuse) | Full (shared infrastructure) |
| **Network slicing** | No | No | Yes |
| **MEC integration** | No | Limited | Native |
| **Indoor/outdoor** | Poor (5.9 GHz penetration) | Moderate (Uu path) | Good (FR1 + network handover) |
| **Spectrum certainty** | Uncertain (US) | 5.9 GHz + cellular | Cellular bands + ITS |
| **Vehicle hardware cost** | $500-1500 (OBU) | $300-800 (C-V2X module) | $200-600 (integrated 5G modem) |
| **Ecosystem maturity** | High | Medium | Growing |
| **Teleoperation support** | No (bandwidth) | Limited | Yes (URLLC + eMBB) |
| **Recommended for** | Legacy installs | Budget deployments | New airport deployments |

### 2.5 Hybrid Architecture: The Practical Choice

For the reference airside AV stack's deployment timeline (2026-2030), the practical architecture is hybrid:

```
┌─────────────────────────────────────────────────────┐
│                  V2X HYBRID STACK                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                │
│  │  5G NR Uu   │    │  NR PC5     │                │
│  │  (Primary)  │    │  Sidelink   │                │
│  │             │    │  (Fallback) │                │
│  │ - URLLC for │    │ - Direct    │                │
│  │   safety    │    │   V2V       │                │
│  │ - eMBB for  │    │ - No network│                │
│  │   perception│    │   needed    │                │
│  │ - Network   │    │ - Safety    │                │
│  │   slicing   │    │   messages  │                │
│  └──────┬──────┘    └──────┬──────┘                │
│         │                  │                        │
│         ▼                  ▼                        │
│  ┌──────────────────────────────┐                  │
│  │    V2X Protocol Stack       │                   │
│  │  ┌────────────────────────┐ │                   │
│  │  │ Application Layer      │ │                   │
│  │  │ (ETSI ITS + Airside)   │ │                   │
│  │  ├────────────────────────┤ │                   │
│  │  │ Facilities Layer       │ │                   │
│  │  │ (Message encoding,     │ │                   │
│  │  │  congestion control)   │ │                   │
│  │  ├────────────────────────┤ │                   │
│  │  │ Network/Transport      │ │                   │
│  │  │ (GeoNetworking/BTP or  │ │                   │
│  │  │  IP/UDP)               │ │                   │
│  │  ├────────────────────────┤ │                   │
│  │  │ Access Layer           │ │                   │
│  │  │ (5G NR / NR PC5)      │ │                   │
│  │  └────────────────────────┘ │                   │
│  └──────────────────────────────┘                  │
│                                                     │
│  Fallback chain:                                   │
│  5G URLLC → NR PC5 sidelink → WiFi (degraded)     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Fallback behavior:**
1. **5G URLLC available**: Full V2X messaging, cooperative perception, teleoperation capable
2. **5G down, PC5 available**: Safety messages (position, aircraft proximity, emergency) only. Cooperative perception paused. Reduced operational speed.
3. **All V2X down**: Vehicle operates on onboard sensors only. Speed reduced to 5 km/h. Safety stop if in aircraft proximity zone. Immediate teleoperation request if available via WiFi.

### 2.6 Airport RF Environment Challenges

Airports present unique RF challenges (detailed in `airport-5g-cbrs.md`):

| Challenge | Impact on V2X | Mitigation |
|-----------|---------------|------------|
| **ASR/SSR radar** | Potential interference at 5.9 GHz harmonics | Frequency planning, filtering |
| **Aircraft comm (VHF/UHF)** | Minimal direct interference but regulatory sensitivity | Certification of V2X equipment for airside use |
| **Jet engines** | Electromagnetic interference during run-up | Shielding, increased TX power margin |
| **Metal surfaces** | Severe multipath from aircraft and terminal buildings | MIMO diversity, beamforming |
| **Indoor/outdoor transitions** | Signal loss at terminal building boundaries | Handover planning, PC5 bridge |
| **Concurrent airport WiFi** | 2.4/5 GHz congestion | Use cellular bands, avoid WiFi for safety |
| **Weather radar** | 5.6 GHz (near V2X 5.9 GHz band) | Band-pass filtering |
| **De-icing fluid** | Signal attenuation through spray | Link budget margin (+10 dB) |

**Link budget for worst case (aircraft fuselage obstruction):**

```
TX power (5G NR, gNB):             +46 dBm
Antenna gain (gNB):                +18 dBi
Cable/connector loss:               -3 dB
EIRP:                              +61 dBm

Path loss (200m, 3.5 GHz, NLOS):  -95 dB
Aircraft fuselage attenuation:     -15 to -25 dB
De-icing spray attenuation:         -5 dB
Fading margin:                     -10 dB

Received power:                    -64 to -74 dBm
Receiver sensitivity (5G NR):     -100 dBm (QPSK, 10 MHz)
Link margin:                       +26 to +36 dB  ← Sufficient
```

---

## 3. ETSI ITS Message Architecture

### 3.1 Overview of ETSI ITS-G5 Message Set

The European Telecommunications Standards Institute (ETSI) has defined a comprehensive message architecture for Intelligent Transport Systems. While designed for road vehicles, this architecture provides the foundation for airside V2X:

```
ETSI ITS MESSAGE HIERARCHY

┌──────────────────────────────────────────────────────┐
│                APPLICATION LAYER                      │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  │ CAM  │  │ DENM │  │ CPM  │  │ MCM  │  │ IVIM │ │
│  │      │  │      │  │      │  │      │  │      │ │
│  │Aware-│  │Event │  │Percep│  │Maneu-│  │Infra │ │
│  │ness  │  │Notif.│  │tion  │  │ver   │  │Info  │ │
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘ │
│     │         │         │         │         │      │
│  ┌──┴─────────┴─────────┴─────────┴─────────┴───┐  │
│  │            FACILITIES LAYER                    │  │
│  │  - Message management (encoding/decoding)     │  │
│  │  - DCC (Decentralized Congestion Control)     │  │
│  │  - Security (sign/verify)                     │  │
│  │  - LDM (Local Dynamic Map)                    │  │
│  └──────────────────────┬────────────────────────┘  │
│                         │                            │
│  ┌──────────────────────┴────────────────────────┐  │
│  │         NETWORK / TRANSPORT LAYER             │  │
│  │  - GeoNetworking (geographic routing)         │  │
│  │  - BTP (Basic Transport Protocol)             │  │
│  │  - or IP/UDP for network path                 │  │
│  └──────────────────────┬────────────────────────┘  │
│                         │                            │
│  ┌──────────────────────┴────────────────────────┐  │
│  │              ACCESS LAYER                      │  │
│  │  ITS-G5 / C-V2X / 5G NR                      │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 3.2 CAM (Cooperative Awareness Message)

**Standard**: ETSI EN 302 637-2

The CAM is the heartbeat of V2X --- every vehicle broadcasts its state at 1-10 Hz (dynamically adjusted based on speed and heading change):

**CAM structure:**

| Container | Field | Type | Size (bits) | Description |
|-----------|-------|------|-------------|-------------|
| **Header** | protocolVersion | INTEGER | 8 | Currently 2 |
| | messageID | INTEGER | 8 | 2 for CAM |
| | stationID | INTEGER | 32 | Unique vehicle ID |
| **Basic** | generationDeltaTime | INTEGER | 16 | ms since 2004-01-01T00:00:00Z mod 65536 |
| **High-freq** | heading | INTEGER | 16 | 0.1 degree resolution |
| | speed | INTEGER | 16 | 0.01 m/s resolution |
| | driveDirection | ENUM | 2 | forward, backward |
| | vehicleLength | INTEGER | 13 | 0.1 m resolution |
| | vehicleWidth | INTEGER | 10 | 0.1 m resolution |
| | longitudinalAcceleration | INTEGER | 16 | 0.1 m/s^2 |
| | curvature | INTEGER | 16 | 1/30000 m^-1 |
| | yawRate | INTEGER | 16 | 0.01 deg/s |
| **Position** | latitude | INTEGER | 32 | 10^-7 degree (WGS84) |
| | longitude | INTEGER | 32 | 10^-7 degree (WGS84) |
| | altitude | INTEGER | 32 | 0.01 m resolution |
| | positionConfidence | INTEGER | 16 | Semi-major/minor axes |
| **Low-freq** | vehicleRole | ENUM | 8 | See below |
| | pathHistory | SEQUENCE | var | Up to 40 path points |
| | exteriorLights | BIT STRING | 8 | Left/right indicators, etc. |

**CAM encoding**: ASN.1 UPER (Unaligned Packed Encoding Rules)
**Typical size**: 200-400 bytes
**Generation frequency**: 1-10 Hz (T_GenCam_Dcc: minimum 100 ms, maximum 1000 ms)

**CAM generation rules (ETSI EN 302 637-2, Section 6.1.3):**
- Heading change > 4 degrees since last CAM
- Position change > 4 m since last CAM
- Speed change > 0.5 m/s since last CAM
- Maximum inter-CAM time: 1000 ms
- Minimum inter-CAM time: 100 ms (subject to DCC)

**VehicleRole values relevant to airside:**

| Value | Role | Airside Mapping |
|-------|------|-----------------|
| 0 | default | Standard GSE |
| 1 | publicTransport | Passenger bus/shuttle |
| 5 | specialTransport | Oversized cargo loader |
| 6 | dangerousGoods | Fuel truck |
| 7 | roadWork | Maintenance vehicle |
| 11 | emergency | Fire/rescue (ARFF) |
| 15 | agriculture | (repurpose for) Tow tractor |

Note: ETSI vehicleRole does not cover airside-specific roles. A custom extension is needed (see Section 4).

### 3.3 DENM (Decentralized Environmental Notification Message)

**Standard**: ETSI EN 302 637-3

DENMs are event-triggered messages that warn about hazards or unusual conditions:

**DENM structure:**

| Container | Field | Type | Description |
|-----------|-------|------|-------------|
| **Header** | protocolVersion | INTEGER | Currently 2 |
| | messageID | INTEGER | 1 for DENM |
| | stationID | INTEGER | Originating station |
| **Management** | actionID | SEQUENCE | stationID + sequenceNumber (unique event ID) |
| | detectionTime | INTEGER | When event was detected |
| | referenceTime | INTEGER | When DENM was generated |
| | eventPosition | SEQUENCE | Lat/lon/alt of event |
| | relevanceDistance | ENUM | How far the event is relevant |
| | relevanceTrafficDirection | ENUM | Direction of relevance |
| | validityDuration | INTEGER | Seconds until event expires |
| | stationType | INTEGER | Type of originating station |
| **Situation** | informationQuality | INTEGER | 0-7, confidence in event |
| | causeCode | INTEGER | Main event category |
| | subCauseCode | INTEGER | Specific event type |
| **Location** | eventSpeed | INTEGER | Speed at event location |
| | eventPositionHeading | INTEGER | Heading at event |
| | traces | SEQUENCE | Path traces to/through event |
| **A la carte** | lanePosition | INTEGER | Lane identifier |
| | impactReduction | SEQUENCE | Vehicle action taken |
| | externalTemperature | INTEGER | Temperature at event |

**DENM cause codes relevant to airside:**

| causeCode | Name | Airside Use |
|-----------|------|-------------|
| 1 | trafficCondition | Apron congestion |
| 2 | accident | GSE collision |
| 3 | roadworks | Construction zone on apron |
| 6 | adverseWeatherCondition-Adhesion | Icy apron surface |
| 9 | hazardousLocation-SurfaceCondition | FOD, fuel spill |
| 12 | humanPresenceOnTheRoad | Ground crew in vehicle path |
| 14 | emergencyVehicleApproaching | ARFF vehicle |
| 91-95 | (reserved for extension) | Jet blast, de-icing, pushback |
| 97 | dangerousSituation | General airside hazard |

**Typical size**: 300-800 bytes
**Generation**: Event-triggered (not periodic)
**Repetition**: Re-broadcast at configurable interval while event is active (typically 500 ms - 1 s)

### 3.4 CPM (Collective Perception Message)

**Standard**: ETSI TR 103 562 (pre-standard), ETSI TS 103 324 (Release 2)

CPMs share detected objects between vehicles, enabling cooperative perception:

**CPM structure:**

| Container | Field | Type | Description |
|-----------|-------|------|-------------|
| **Header** | Standard ITS header | --- | Protocol version, message ID, station ID |
| **Management** | referenceTime | INTEGER | Generation timestamp |
| | referencePosition | SEQUENCE | Sender position (lat/lon/alt) |
| **Station Data** | stationaryVehicleContainer | OPTIONAL | If sender is stationary |
| | originatingVehicleContainer | OPTIONAL | Sender dynamics |
| **Sensor Info** | sensorInformationContainer | SEQUENCE OF | Each sensor's type, position, FoV |
| | sensorID | INTEGER | Unique per-vehicle sensor ID |
| | sensorType | ENUM | radar, lidar, camera, fusion |
| | detectionArea | CHOICE | Polygon, radial, or range |
| **Perceived Objects** | numberOfPerceivedObjects | INTEGER | Count |
| | perceivedObjectContainer | SEQUENCE OF | Detected object list |
| | objectID | INTEGER | Tracker-consistent ID |
| | measurementDeltaTime | INTEGER | Time offset from reference |
| | position | SEQUENCE | Relative position (x, y, z) |
| | velocity | SEQUENCE | (vx, vy) or (speed, heading) |
| | acceleration | SEQUENCE | (ax, ay) optional |
| | objectDimensionX/Y/Z | INTEGER | Bounding box (cm resolution) |
| | objectAge | INTEGER | Tracking age (ms) |
| | objectConfidence | INTEGER | 0-15 (detection confidence) |
| | classification | SEQUENCE | Object class + confidence |
| **Free Space** | freeSpaceAddendumContainer | SEQUENCE OF | Free-space boundaries |

**CPM object classification types relevant to airside:**

| classID | Standard Name | Airside Extension |
|---------|--------------|-------------------|
| 0 | unknown | Unknown object |
| 1 | vehicle | GSE vehicle |
| 2 | person | Ground crew |
| 3 | animal | Wildlife (FOD) |
| 4 | other | FOD (non-wildlife) |
| 8 | motorcycle | (unused) |
| 10 | specialVehicle | Emergency/ARFF |
| --- | (extension needed) | Aircraft |
| --- | (extension needed) | Pushback tractor + aircraft |
| --- | (extension needed) | Jet bridge |
| --- | (extension needed) | Fuel truck (distinct from generic) |

**Typical size**: 500-2000 bytes (depends on number of perceived objects; 20 objects is typical maximum per CPM)
**Generation frequency**: 1-10 Hz (typically 2-5 Hz for perception sharing)

**CPM generation rules (ETSI TS 103 324):**
- Object state changed significantly since last inclusion
- Object not included in previous N CPMs
- Object classified as vulnerable road user (always include) --- maps to ground crew on airside
- Maximum inter-CPM time: 1000 ms
- Minimum inter-CPM time: 100 ms

### 3.5 MCM (Maneuver Coordination Message)

**Standard**: ETSI TR 103 578 (study), not yet fully standardized

MCMs share planned trajectories and coordinate maneuvers between vehicles:

**MCM structure (draft):**

| Container | Field | Type | Description |
|-----------|-------|------|-------------|
| **Header** | Standard ITS header | --- | |
| **Vehicle State** | position | SEQUENCE | Current position |
| | heading, speed | INTEGER | Current dynamics |
| **Planned Trajectory** | trajectory | SEQUENCE OF | List of future waypoints |
| | deltaTime | INTEGER | Time offset from now (ms) |
| | deltaPosition | SEQUENCE | (dx, dy) from reference |
| | speed | INTEGER | Planned speed at waypoint |
| **Desired Maneuver** | maneuverType | ENUM | straightCrossing, laneChange, stop, yield, etc. |
| | targetLane | INTEGER | Target lane/path ID |
| | safetyMargin | INTEGER | Required clearance |
| **Cooperation** | cooperationType | ENUM | request, offer, accept, reject |
| | partnerID | INTEGER | Station ID of cooperation partner |
| | urgency | INTEGER | 0-7, higher = more urgent |

**Typical size**: 300-600 bytes
**Generation frequency**: 2-5 Hz when coordinating, 0 Hz when isolated

MCMs are particularly relevant for airside because explicit maneuver coordination is required at stand entry/exit, stand sequencing, and pushback clearance --- situations where implicit coordination (traffic rules) is insufficient.

### 3.6 Encoding: ASN.1 UPER

All ETSI ITS messages use ASN.1 with Unaligned Packed Encoding Rules (UPER):

**Why UPER:**
- Bit-level packing (no byte alignment overhead) --- 30-50% smaller than aligned encoding
- Deterministic encoding (same input always produces same output) --- critical for digital signatures
- Self-describing schema --- decoder can validate against ASN.1 definition
- Well-supported tooling (asn1c, asn1tools, pyasn1)

**Example: CAM position encoding in UPER:**

```
Latitude:  51.5074 degrees (London)
Binary:    515074000 (in 10^-7 degree units)
UPER:      32 bits, signed integer
           = 0x1EB2B2E0 (big-endian, packed)

Longitude: -0.1278 degrees
Binary:    -1278000
UPER:      32 bits, signed integer
           = 0xFFEC97B0

Total position: 64 bits = 8 bytes (vs. 16 bytes for JSON "lat":51.5074)
```

**Size comparison for typical CAM:**

| Encoding | Size |
|----------|------|
| ASN.1 UPER | 200-300 bytes |
| ASN.1 BER | 350-500 bytes |
| Protobuf | 250-400 bytes |
| JSON | 800-1200 bytes |
| XML | 1500-2500 bytes |

For V2X where bandwidth is constrained and every millisecond of serialization matters, UPER is the standard choice. However, for internal ROS messaging and airport IT integration, protobuf or JSON may be more practical (see Section 10).

---

## 4. Airside-Specific Message Extensions

### 4.1 Why Standard Messages Are Insufficient

Standard ETSI ITS messages cover vehicle awareness (CAM), hazard notification (DENM), object sharing (CPM), and maneuver coordination (MCM). For airside operations, eight additional message types are needed:

```
STANDARD MESSAGES          AIRSIDE EXTENSIONS
(cover ~40% of needs)      (cover remaining ~60%)

┌──────────┐               ┌──────────────────────────┐
│   CAM    │──────────────▶│ Airside Station Role Ext │
│          │               │ (GSE type, airline, task) │
├──────────┤               ├──────────────────────────┤
│   DENM   │──────────────▶│ APA - Aircraft Proximity │
│          │               │ JBW - Jet Blast Warning  │
│          │               │ DZN - De-icing Zone      │
│          │               │ FDA - FOD Detection      │
│          │               │ RIP - Runway Incursion   │
│          │               │ EVP - Emergency Priority │
├──────────┤               ├──────────────────────────┤
│   CPM    │               │ (Extended classifications)│
├──────────┤               ├──────────────────────────┤
│   MCM    │──────────────▶│ SOS - Stand Operation    │
│          │               │ GTA - GSE Task Assignment│
└──────────┘               └──────────────────────────┘
```

### 4.2 APA: Aircraft Proximity Alert

Purpose: Broadcast aircraft movement status and proximity zones to all nearby vehicles. Aircraft themselves do not carry V2X equipment, so this message is generated by airport infrastructure (A-SMGCS, ADS-B receiver, or stand management system) and broadcast to nearby GSE.

**APA message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| **Header** | | | |
| messageType | UINT8 | 1 B | 0x80 (APA) |
| version | UINT8 | 1 B | Protocol version |
| senderID | UINT32 | 4 B | Infrastructure node ID |
| timestamp | UINT64 | 8 B | Unix time, microseconds |
| sequenceNum | UINT32 | 4 B | Monotonic counter |
| **Aircraft Identity** | | | |
| icaoAddress | UINT32 | 3 B | 24-bit ICAO transponder code |
| flightID | CHAR[8] | 8 B | IATA flight number (e.g., "BA0256") |
| aircraftType | CHAR[4] | 4 B | ICAO type designator (e.g., "A320") |
| wingSpan | UINT16 | 2 B | Wingspan in cm |
| **Position** | | | |
| latitude | INT32 | 4 B | WGS84, 10^-7 degrees |
| longitude | INT32 | 4 B | WGS84, 10^-7 degrees |
| heading | UINT16 | 2 B | 0.01 degrees |
| speed | UINT16 | 2 B | 0.01 m/s |
| positionSource | UINT8 | 1 B | ENUM: ADS-B, MLAT, SMR, MANUAL |
| positionAccuracy | UINT8 | 1 B | NACp category (0-11) |
| **Movement Status** | | | |
| movementPhase | UINT8 | 1 B | See enum below |
| pushbackActive | BOOL | 1 bit | Pushback in progress |
| enginesRunning | UINT8 | 1 B | Bitmask (engine 1-4) |
| doorStatus | UINT8 | 1 B | Bitmask: L1, L2, R1, R2, cargo fwd, cargo aft |
| jetBridgeConnected | BOOL | 1 bit | Jet bridge status |
| gpuConnected | BOOL | 1 bit | Ground power unit status |
| **Proximity Zones** | | | |
| noseZoneRadius | UINT16 | 2 B | cm (intake danger zone) |
| exhaustZoneLength | UINT16 | 2 B | cm (jet blast danger zone) |
| exhaustZoneWidth | UINT16 | 2 B | cm (jet blast lateral extent) |
| wingClearance | UINT16 | 2 B | cm (required wing tip clearance) |
| **Stand Info** | | | |
| standID | CHAR[6] | 6 B | Stand identifier (e.g., "B07") |
| standOccupied | BOOL | 1 bit | Aircraft on stand |
| expectedDeparture | UINT32 | 4 B | Unix time (seconds) |
| **Security** | | | |
| signature | BYTES | 64 B | ECDSA-256 signature |

**Total size**: ~130 bytes (header + payload + signature)

**Movement phase enum:**

| Value | Phase | V2X Implication |
|-------|-------|-----------------|
| 0 | PARKED_ENGINES_OFF | Normal stand operations, GSE may approach |
| 1 | BOARDING | Doors open, crew present, caution near doors |
| 2 | CARGO_LOADING | Cargo doors open, loader vehicles active |
| 3 | FUELING | Fuel truck connected, fire risk zone active |
| 4 | PUSHBACK_REQUESTED | Pushback imminent, clear stand area |
| 5 | PUSHBACK_ACTIVE | Absolute priority, all GSE must clear |
| 6 | ENGINES_STARTING | Jet blast zones activate |
| 7 | TAXI_OUT | Aircraft moving under own power |
| 8 | TAXI_IN | Aircraft approaching stand |
| 9 | ARRIVED_CHOCKS_ON | Aircraft stopped, chocks placed, safe to approach |
| 10 | DE-ICING | De-icing in progress, chemical zone active |
| 11 | EMERGENCY | Aircraft emergency, ARFF response |

**Update frequency**: 2 Hz (parked), 5 Hz (pushback/taxi), 10 Hz (emergency)

### 4.3 SOS: Stand Operation Status

Purpose: Broadcast the current state of turnaround operations at a specific stand. Enables GSE to know which equipment is present, what phase the turnaround is in, and when their service window opens.

**SOS message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| messageType | UINT8 | 1 B | 0x81 (SOS) |
| version | UINT8 | 1 B | |
| senderID | UINT32 | 4 B | Stand management system ID |
| timestamp | UINT64 | 8 B | |
| sequenceNum | UINT32 | 4 B | |
| standID | CHAR[6] | 6 B | Stand identifier |
| **Turnaround Phase** | | | |
| turnaroundPhase | UINT8 | 1 B | Current phase (see enum) |
| phaseStartTime | UINT32 | 4 B | When current phase started |
| estimatedPhaseEnd | UINT32 | 4 B | Expected phase completion |
| **Equipment Present** | | | |
| equipmentBitmask | UINT16 | 2 B | Which GSE types are present |
| equipmentCount | UINT8 | 1 B | Number of GSE at stand |
| **Equipment Detail** (repeated) | | | |
| gseType | UINT8 | 1 B | GSE type enum |
| gseID | UINT32 | 4 B | Vehicle/equipment ID |
| gsePosition | UINT8 | 1 B | Stand-relative position enum |
| **A-CDM Milestones** | | | |
| TOBT | UINT32 | 4 B | Target Off-Block Time |
| TSAT | UINT32 | 4 B | Target Start-up Approval Time |
| EOBT | UINT32 | 4 B | Estimated Off-Block Time |
| AIBT | UINT32 | 4 B | Actual In-Block Time |
| **Pending Services** | | | |
| pendingServiceBitmask | UINT16 | 2 B | Services yet to arrive |
| nextExpectedService | UINT8 | 1 B | Next GSE type expected |
| nextServiceETA | UINT16 | 2 B | Seconds until next service |
| signature | BYTES | 64 B | ECDSA-256 |

**Turnaround phase enum:**

| Value | Phase | GSE Relevance |
|-------|-------|---------------|
| 0 | STAND_EMPTY | Stand available |
| 1 | AIRCRAFT_ARRIVING | Clear stand, position marshaller |
| 2 | CHOCKS_ON | Bridge connecting, GPU connecting |
| 3 | DOORS_OPEN | PAX deplaning, cargo unloading begins |
| 4 | TURNAROUND_ACTIVE | Multiple GSE servicing simultaneously |
| 5 | FUELING_ACTIVE | Restricted zone, fire safety rules apply |
| 6 | BOARDING | PAX boarding, catering final, cleaning finishing |
| 7 | DOORS_CLOSED | Remove bridge, disconnect GPU |
| 8 | PUSHBACK_CLEARANCE | All GSE must vacate, pushback crew in position |
| 9 | PUSHBACK_ACTIVE | Aircraft moving, absolute exclusion zone |
| 10 | STAND_VACATED | Aircraft departed, stand available for next arrival |

**Equipment bitmask positions:**

| Bit | GSE Type |
|-----|----------|
| 0 | Jet bridge |
| 1 | GPU (Ground Power Unit) |
| 2 | ACU (Air Conditioning Unit) |
| 3 | Baggage belt loader |
| 4 | Baggage tractor + dollies |
| 5 | Fuel truck |
| 6 | Catering truck |
| 7 | Cleaning vehicle |
| 8 | Water service |
| 9 | Lavatory service |
| 10 | Pushback tractor |
| 11 | De-icing truck |
| 12 | Cargo loader (ULD) |
| 13 | Passenger bus/shuttle |
| 14 | Fire/ARFF |
| 15 | Maintenance vehicle |

**Update frequency**: 1 Hz (normal), 2 Hz (during phase transitions)

### 4.4 GTA: GSE Task Assignment

Purpose: Assign specific tasks and routes to autonomous GSE. Generated by fleet management system, directed to individual vehicles.

**GTA message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| messageType | UINT8 | 1 B | 0x82 (GTA) |
| version | UINT8 | 1 B | |
| senderID | UINT32 | 4 B | Fleet management system ID |
| timestamp | UINT64 | 8 B | |
| sequenceNum | UINT32 | 4 B | |
| **Target Vehicle** | | | |
| targetVehicleID | UINT32 | 4 B | Destination vehicle |
| **Task Specification** | | | |
| taskID | UINT64 | 8 B | Unique task identifier |
| taskType | UINT8 | 1 B | Task type enum |
| priority | UINT8 | 1 B | 0-255 (255 = highest) |
| airline | CHAR[3] | 3 B | IATA airline code |
| flightID | CHAR[8] | 8 B | Flight number |
| **Route** | | | |
| originStand | CHAR[6] | 6 B | Origin stand/depot |
| destinationStand | CHAR[6] | 6 B | Destination stand |
| waypointCount | UINT8 | 1 B | Number of route waypoints |
| waypoints | SEQUENCE | var | (lat, lon, speed_limit, zone_type) per waypoint |
| **Timing** | | | |
| earliestStart | UINT32 | 4 B | Do not depart before |
| latestArrival | UINT32 | 4 B | Must arrive by |
| estimatedDuration | UINT16 | 2 B | Seconds |
| **Constraints** | | | |
| maxSpeed | UINT8 | 1 B | km/h |
| loadType | UINT8 | 1 B | Empty, loaded, hazmat |
| escortRequired | BOOL | 1 bit | Human escort needed |
| **Acknowledgement** | | | |
| requiresAck | BOOL | 1 bit | Vehicle must acknowledge |
| ackDeadline | UINT16 | 2 B | Seconds to acknowledge |
| signature | BYTES | 64 B | ECDSA-256 |

**Task type enum:**

| Value | Task |
|-------|------|
| 0 | BAGGAGE_DELIVERY |
| 1 | BAGGAGE_PICKUP |
| 2 | CARGO_DELIVERY |
| 3 | CARGO_PICKUP |
| 4 | PASSENGER_TRANSPORT |
| 5 | FUEL_DELIVERY |
| 6 | PUSHBACK |
| 7 | REPOSITIONING |
| 8 | RETURN_TO_DEPOT |
| 9 | CHARGING |
| 10 | MAINTENANCE |
| 11 | FOD_INSPECTION |
| 12 | ESCORT_DUTY |

**Update frequency**: Event-driven (new task, task modification, cancellation)

### 4.5 DZN: De-Icing Zone Notification

Purpose: Broadcast active de-icing zones with chemical spray boundaries and wind-drift estimates. Critical for avoiding chemical contamination of vehicles and personnel.

**DZN message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| messageType | UINT8 | 1 B | 0x83 (DZN) |
| version | UINT8 | 1 B | |
| senderID | UINT32 | 4 B | De-icing operations system ID |
| timestamp | UINT64 | 8 B | |
| sequenceNum | UINT32 | 4 B | |
| **Zone Definition** | | | |
| zoneID | UINT16 | 2 B | Unique zone identifier |
| zoneActive | BOOL | 1 bit | Currently spraying |
| zoneType | UINT8 | 1 B | ENUM: type_I, type_II, type_III, type_IV |
| **Zone Polygon** | | | |
| vertexCount | UINT8 | 1 B | Polygon vertices (3-16) |
| vertices | SEQUENCE | var | (lat, lon) per vertex |
| **Chemical Spray Boundary** | | | |
| sprayActive | BOOL | 1 bit | Spray guns active |
| sprayBoundaryVertexCount | UINT8 | 1 B | Spray polygon vertices |
| sprayBoundaryVertices | SEQUENCE | var | (lat, lon) per vertex |
| **Wind Drift** | | | |
| windSpeed | UINT16 | 2 B | 0.01 m/s at zone |
| windDirection | UINT16 | 2 B | 0.1 degrees (from) |
| driftBoundaryVertexCount | UINT8 | 1 B | Drift polygon vertices |
| driftBoundaryVertices | SEQUENCE | var | (lat, lon) adjusted for wind |
| **Safety** | | | |
| excludeAllVehicles | BOOL | 1 bit | Full exclusion zone |
| excludePersonnel | BOOL | 1 bit | Personnel exclusion |
| minimumClearance | UINT16 | 2 B | cm from spray boundary |
| chemicalType | UINT8 | 1 B | Glycol type |
| **Timing** | | | |
| estimatedEndTime | UINT32 | 4 B | When de-icing expected to finish |
| holdoverTime | UINT16 | 2 B | Minutes of protection remaining |
| signature | BYTES | 64 B | ECDSA-256 |

**Update frequency**: 2 Hz (when active), 0.5 Hz (defined but inactive)

### 4.6 EVP: Emergency Vehicle Priority

Purpose: Broadcast emergency vehicle presence, planned path, and yield requirements to all vehicles in the area.

**EVP message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| messageType | UINT8 | 1 B | 0x84 (EVP) |
| version | UINT8 | 1 B | |
| senderID | UINT32 | 4 B | Emergency vehicle or ATC ID |
| timestamp | UINT64 | 8 B | |
| sequenceNum | UINT32 | 4 B | |
| **Emergency Type** | | | |
| emergencyType | UINT8 | 1 B | ENUM: ARFF, MEDICAL, SECURITY, POLICE, HAZMAT |
| emergencyLevel | UINT8 | 1 B | 1 (low) to 5 (critical) |
| **Vehicle** | | | |
| emergencyVehicleID | UINT32 | 4 B | Vehicle identifier |
| vehicleType | UINT8 | 1 B | Engine type, ambulance, etc. |
| latitude | INT32 | 4 B | Current position |
| longitude | INT32 | 4 B | |
| heading | UINT16 | 2 B | |
| speed | UINT16 | 2 B | |
| **Planned Path** | | | |
| pathWaypointCount | UINT8 | 1 B | |
| pathWaypoints | SEQUENCE | var | (lat, lon, ETA) per waypoint |
| **Yield Requirements** | | | |
| yieldRadius | UINT16 | 2 B | cm --- all vehicles must yield within this radius |
| clearPathWidth | UINT16 | 2 B | cm --- required clear corridor |
| yieldAction | UINT8 | 1 B | ENUM: stop_and_hold, move_right, clear_path, immediate_stop |
| **Affected Zone** | | | |
| affectedStands | SEQUENCE | var | Stand IDs that must halt operations |
| affectedRouteSegments | SEQUENCE | var | Route segment IDs to avoid |
| signature | BYTES | 64 B | ECDSA-256 |

**Update frequency**: 10 Hz (active emergency), 2 Hz (en route)

### 4.7 RIP: Runway Incursion Prevention

Purpose: Broadcast hold-short line status and ATC clearance information to prevent runway/taxiway incursions by autonomous GSE. Generated by airport A-SMGCS or ground controller interface.

**RIP message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| messageType | UINT8 | 1 B | 0x85 (RIP) |
| version | UINT8 | 1 B | |
| senderID | UINT32 | 4 B | A-SMGCS system ID |
| timestamp | UINT64 | 8 B | |
| sequenceNum | UINT32 | 4 B | |
| **Hold-Short Line** | | | |
| holdShortID | UINT16 | 2 B | Hold-short line identifier |
| runwayID | CHAR[4] | 4 B | Runway designator (e.g., "09L") |
| taxiwayID | CHAR[4] | 4 B | Taxiway identifier |
| holdLineLatitude | INT32 | 4 B | Hold line center position |
| holdLineLongitude | INT32 | 4 B | |
| holdLineHeading | UINT16 | 2 B | Line orientation |
| **Clearance Status** | | | |
| clearanceStatus | UINT8 | 1 B | ENUM: HOLD, CLEARED, CONDITIONAL |
| clearedVehicleID | UINT32 | 4 B | Which vehicle is cleared (0 = none) |
| clearanceExpiry | UINT32 | 4 B | Clearance valid until |
| **Runway Status** | | | |
| runwayActive | BOOL | 1 bit | Runway in use |
| runwayOccupied | BOOL | 1 bit | Aircraft/vehicle on runway |
| lastClearanceCheck | UINT32 | 4 B | Last ATC confirmation time |
| **Traffic Information** | | | |
| approachingAircraftCount | UINT8 | 1 B | Aircraft on approach/departure |
| nearestAircraftDistance | UINT32 | 4 B | cm to nearest aircraft |
| nearestAircraftETA | UINT16 | 2 B | Seconds to threshold |
| **Safety Override** | | | |
| hardStop | BOOL | 1 bit | Absolute stop, no override possible |
| safetyAlert | BOOL | 1 bit | Conflict detected, immediate stop |
| signature | BYTES | 64 B | ECDSA-256 |

**Update frequency**: 5 Hz (vehicles near hold lines), 1 Hz (general broadcast)

**Critical design principle**: The RIP message implements a "default deny" policy. A vehicle must receive an explicit CLEARED status addressed to its vehicle ID before crossing any hold-short line. If no RIP message is received or if the clearance has expired, the vehicle must HOLD. Network failure = HOLD.

### 4.8 FDA: FOD Detection Alert

Purpose: Share detected Foreign Object Debris locations between vehicles and with airport operations for cleanup dispatch.

**FDA message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| messageType | UINT8 | 1 B | 0x86 (FDA) |
| version | UINT8 | 1 B | |
| senderID | UINT32 | 4 B | Detecting vehicle or infrastructure |
| timestamp | UINT64 | 8 B | |
| sequenceNum | UINT32 | 4 B | |
| **Detection** | | | |
| fodID | UINT32 | 4 B | Unique FOD event ID |
| detectionTime | UINT64 | 8 B | When first detected |
| detectionConfidence | UINT8 | 1 B | 0-100% |
| detectorType | UINT8 | 1 B | ENUM: lidar, camera, radar, human |
| **Location** | | | |
| latitude | INT32 | 4 B | FOD position |
| longitude | INT32 | 4 B | |
| positionUncertainty | UINT16 | 2 B | cm (circular error probable) |
| surfaceType | UINT8 | 1 B | ENUM: taxiway, apron, runway, gate_area |
| **Classification** | | | |
| fodClass | UINT8 | 1 B | See enum |
| estimatedSize | UINT16 | 2 B | cm (max dimension) |
| estimatedHeight | UINT16 | 2 B | cm above surface |
| hazardLevel | UINT8 | 1 B | 1-5 (5 = engine damage risk) |
| **Confirmation** | | | |
| confirmedBy | UINT8 | 1 B | Number of independent detections |
| confirmerIDs | SEQUENCE | var | Station IDs of confirming vehicles |
| **Status** | | | |
| cleanupRequested | BOOL | 1 bit | Cleanup dispatched |
| cleanupAssignedTo | UINT32 | 4 B | Assigned cleanup vehicle/team |
| resolved | BOOL | 1 bit | FOD removed |
| signature | BYTES | 64 B | ECDSA-256 |

**FOD class enum:**

| Value | Class | Typical Hazard Level |
|-------|-------|---------------------|
| 0 | UNKNOWN | 3 (default caution) |
| 1 | METAL_DEBRIS | 5 (engine damage) |
| 2 | FASTENER_BOLT | 5 (engine damage) |
| 3 | PLASTIC_FRAGMENT | 2 |
| 4 | RUBBER_TIRE_FRAGMENT | 3 |
| 5 | LUGGAGE_ITEM | 3 |
| 6 | PAPER_FABRIC | 1 |
| 7 | TOOL | 4 |
| 8 | WILDLIFE | 4 (bird/animal) |
| 9 | ICE_CHUNK | 3 |
| 10 | FUEL_SPILL | 5 |
| 11 | CHEMICAL_SPILL | 5 |
| 12 | CARGO_FRAGMENT | 3 |
| 13 | CONSTRUCTION_DEBRIS | 4 |

**Update frequency**: Event-triggered, then 1 Hz until resolved
**Multi-vehicle confirmation**: FOD confidence increases with independent detections (see `collaborative-fleet-perception.md` Section 8 on collective FOD detection: P(detect) rises from 0.3-0.6 single vehicle to 0.95-0.99 with fleet of 5)

### 4.9 JBW: Jet Blast Warning

Purpose: Broadcast active jet blast zones with polygonal boundaries based on engine type, thrust setting, and wind conditions. Jet blast is invisible to LiDAR and camera --- only thermal cameras can detect it, so V2X broadcast is the primary safety mechanism.

**JBW message fields:**

| Field | Type | Size | Description |
|-------|------|------|-------------|
| messageType | UINT8 | 1 B | 0x87 (JBW) |
| version | UINT8 | 1 B | |
| senderID | UINT32 | 4 B | Stand system or ATC |
| timestamp | UINT64 | 8 B | |
| sequenceNum | UINT32 | 4 B | |
| **Aircraft** | | | |
| icaoAddress | UINT32 | 3 B | Aircraft ICAO address |
| aircraftType | CHAR[4] | 4 B | ICAO type designator |
| engineType | UINT8 | 1 B | ENUM: turbofan_low, turbofan_high, turboprop, APU_only |
| engineCount | UINT8 | 1 B | 1-4 |
| **Engine Status** | | | |
| enginesRunning | UINT8 | 1 B | Bitmask (engine 1-4) |
| thrustSetting | UINT8 | 1 B | ENUM: idle, taxi, takeoff, reverse |
| **Blast Zone** | | | |
| blastZoneCount | UINT8 | 1 B | Number of zones (per engine) |
| blastZones | SEQUENCE | var | Per-zone polygon + severity |
| zoneVertexCount | UINT8 | 1 B | Polygon vertices |
| zoneVertices | SEQUENCE | var | (lat, lon) per vertex |
| zoneSeverity | UINT8 | 1 B | See severity enum |
| windSpeed_kph | UINT16 | 2 B | 0.01 m/s |
| zoneVelocity_kph | UINT16 | 2 B | Estimated blast velocity at zone boundary |
| **Safety Limits** | | | |
| personnelExclusionZone | BOOL | 1 bit | Zone unsafe for pedestrians |
| vehicleExclusionZone | BOOL | 1 bit | Zone unsafe for light vehicles |
| heavyVehicleExclusionZone | BOOL | 1 bit | Zone unsafe for all vehicles |
| **Wind Adjustment** | | | |
| ambientWindSpeed | UINT16 | 2 B | 0.01 m/s |
| ambientWindDirection | UINT16 | 2 B | 0.1 degrees (from) |
| crosswindAdjustment | BOOL | 1 bit | Zone adjusted for crosswind |
| signature | BYTES | 64 B | ECDSA-256 |

**Zone severity enum:**

| Value | Severity | Blast Velocity | Effect |
|-------|----------|---------------|--------|
| 0 | NONE | <15 km/h | No hazard |
| 1 | CAUTION | 15-35 km/h | Light objects may be displaced |
| 2 | MODERATE | 35-55 km/h | Personnel unstable, light GSE affected |
| 3 | SEVERE | 55-100 km/h | Personnel danger, vehicle control affected |
| 4 | EXTREME | >100 km/h | Fatal to personnel, vehicle overturning risk |

**Reference distances (A320, idle thrust):**

```
             AIRCRAFT NOSE
                 │
    ┌────────────┼────────────┐
    │            │            │
    │   INTAKE   │   INTAKE   │   5m exclusion (intake)
    │   DANGER   │   DANGER   │
    │            │            │
    ├────────────┴────────────┤
    │        FUSELAGE         │
    │                         │
    └────────┬───────┬────────┘
             │       │
      ┌──────┘       └──────┐
      │    ENGINE            │    ENGINE
      │                      │
      └──────────────────────┘
                 │
    Idle:        ▼ 60-100m CAUTION zone
    Taxi:        ▼ 100-200m MODERATE zone  
    Breakaway:   ▼ 200-500m SEVERE zone
    Full thrust: ▼ 500-1800m EXTREME zone (runway only)
```

**Update frequency**: 5 Hz (engines running), 1 Hz (parked, engines off but APU running)

### 4.10 Message Type Registry

Complete registry of standard and airside-specific message types:

| Message ID | Abbreviation | Name | Source |
|-----------|-------------|------|--------|
| 0x01 | DENM | Decentralized Environmental Notification | ETSI standard |
| 0x02 | CAM | Cooperative Awareness Message | ETSI standard |
| 0x03 | CPM | Collective Perception Message | ETSI standard |
| 0x04 | MCM | Maneuver Coordination Message | ETSI draft |
| 0x05 | IVIM | Infrastructure to Vehicle Info | ETSI standard |
| 0x80 | APA | Aircraft Proximity Alert | Airside extension |
| 0x81 | SOS | Stand Operation Status | Airside extension |
| 0x82 | GTA | GSE Task Assignment | Airside extension |
| 0x83 | DZN | De-Icing Zone Notification | Airside extension |
| 0x84 | EVP | Emergency Vehicle Priority | Airside extension |
| 0x85 | RIP | Runway Incursion Prevention | Airside extension |
| 0x86 | FDA | FOD Detection Alert | Airside extension |
| 0x87 | JBW | Jet Blast Warning | Airside extension |

**Range 0x80-0xFF reserved for airside extensions**, following the ETSI convention of using the upper range for profile-specific messages.

---

## 5. Message Format Specification

### 5.1 Common Header

All airside V2X messages share a common header:

```protobuf
// Common V2X message header (protobuf definition)
message V2XHeader {
  uint32 version = 1;           // Protocol version (currently 1)
  uint32 message_type = 2;      // Message type ID (0x00-0xFF)
  uint32 sender_id = 3;         // Unique sender station ID
  uint64 timestamp_us = 4;      // Unix time in microseconds
  uint32 sequence_number = 5;   // Monotonic per-sender counter
  
  // Sender position (for geographic routing)
  int32 latitude = 6;           // WGS84, 10^-7 degrees
  int32 longitude = 7;          // WGS84, 10^-7 degrees
  
  // Security
  bytes signature = 15;         // ECDSA-256 signature over entire message
  bytes certificate_id = 16;    // Certificate hash for lookup
}
```

### 5.2 Example Messages in JSON

While the wire format uses protobuf (or ASN.1 UPER for ETSI-standard messages), JSON is used for debugging, logging, and airport IT system integration.

**Example CAM (extended for airside):**

```json
{
  "header": {
    "version": 1,
    "messageType": "CAM",
    "messageTypeId": 2,
    "senderId": "GSE-third-generation tug-007",
    "senderStationId": 3007,
    "timestamp": "2026-04-11T14:23:45.123456Z",
    "timestampUs": 1744381425123456,
    "sequenceNumber": 458923
  },
  "basicContainer": {
    "stationType": "gse_baggage_tractor",
    "referencePosition": {
      "latitude": 51.4706710,
      "longitude": -0.4619350,
      "altitude": 25.40,
      "positionConfidence": {
        "semiMajorAxisLength": 0.05,
        "semiMinorAxisLength": 0.05,
        "semiMajorOrientation": 0
      }
    }
  },
  "highFrequencyContainer": {
    "heading": 127.5,
    "headingConfidence": 1.0,
    "speed": 4.72,
    "speedConfidence": 0.1,
    "driveDirection": "forward",
    "longitudinalAcceleration": 0.3,
    "curvature": 0.002,
    "yawRate": 1.2,
    "vehicleLength": 6.50,
    "vehicleWidth": 2.10
  },
  "lowFrequencyContainer": {
    "vehicleRole": "gse_baggage_tractor",
    "pathHistory": [
      {"deltaLatitude": -0.0000050, "deltaLongitude": 0.0000030, "deltaTime": -100},
      {"deltaLatitude": -0.0000095, "deltaLongitude": 0.0000058, "deltaTime": -200}
    ],
    "exteriorLights": {
      "lowBeam": true,
      "beacon": true
    }
  },
  "airsideExtension": {
    "airlineCode": "BA",
    "currentTaskId": "TASK-2026041114-00892",
    "taskType": "BAGGAGE_DELIVERY",
    "destinationStand": "B07",
    "loadStatus": "loaded",
    "dolliesAttached": 3,
    "operationalMode": "autonomous",
    "autonomyLevel": 4,
    "safetyOperatorPresent": false,
    "batteryLevel": 72,
    "nextChargingTime": "2026-04-11T16:30:00Z"
  }
}
```

**Example APA (Aircraft Proximity Alert):**

```json
{
  "header": {
    "version": 1,
    "messageType": "APA",
    "messageTypeId": 128,
    "senderId": "ASMGCS-LHR-STAND-B07",
    "senderStationId": 50207,
    "timestamp": "2026-04-11T14:23:45.100000Z",
    "timestampUs": 1744381425100000,
    "sequenceNumber": 12847
  },
  "aircraftIdentity": {
    "icaoAddress": "40621D",
    "flightId": "BA0256",
    "aircraftType": "A320",
    "wingSpan": 35.80,
    "fuselageLength": 37.57
  },
  "position": {
    "latitude": 51.4706500,
    "longitude": -0.4619100,
    "heading": 270.0,
    "speed": 0.00,
    "positionSource": "MLAT",
    "positionAccuracy": "NACp_8"
  },
  "movementStatus": {
    "movementPhase": "BOARDING",
    "pushbackActive": false,
    "enginesRunning": [],
    "doorStatus": {
      "L1_forward": "open",
      "L2_aft": "closed",
      "R1_forward": "closed",
      "R2_aft": "closed",
      "cargoForward": "open",
      "cargoAft": "closed"
    },
    "jetBridgeConnected": true,
    "gpuConnected": true,
    "apuRunning": false
  },
  "proximityZones": {
    "noseZoneRadius": 5.0,
    "exhaustZoneLength": 0.0,
    "exhaustZoneWidth": 0.0,
    "wingClearance": 3.0,
    "safeApproachVectors": [
      {"angle": 90, "minDistance": 3.0, "status": "clear"},
      {"angle": 180, "minDistance": 5.0, "status": "cargo_loader_present"},
      {"angle": 270, "minDistance": 3.0, "status": "fuel_truck_present"}
    ]
  },
  "standInfo": {
    "standId": "B07",
    "standOccupied": true,
    "arrivalTime": "2026-04-11T13:45:00Z",
    "scheduledDeparture": "2026-04-11T15:30:00Z",
    "turnaroundPhase": "TURNAROUND_ACTIVE",
    "TOBT": "2026-04-11T15:25:00Z",
    "TSAT": "2026-04-11T15:28:00Z"
  }
}
```

**Example JBW (Jet Blast Warning):**

```json
{
  "header": {
    "version": 1,
    "messageType": "JBW",
    "messageTypeId": 135,
    "senderId": "ASMGCS-LHR-STAND-C12",
    "senderStationId": 50312,
    "timestamp": "2026-04-11T14:23:45.050000Z",
    "timestampUs": 1744381425050000,
    "sequenceNumber": 5621
  },
  "aircraft": {
    "icaoAddress": "4BA8C3",
    "aircraftType": "B77W",
    "engineType": "turbofan_high",
    "engineCount": 2,
    "engineModel": "GE90-115B"
  },
  "engineStatus": {
    "enginesRunning": [1, 2],
    "thrustSetting": "idle",
    "estimatedN1": 22
  },
  "blastZones": [
    {
      "engineNumber": 1,
      "severity": "MODERATE",
      "polygon": [
        {"lat": 51.470500, "lon": -0.462100},
        {"lat": 51.470480, "lon": -0.462080},
        {"lat": 51.469900, "lon": -0.462050},
        {"lat": 51.469880, "lon": -0.462130},
        {"lat": 51.470500, "lon": -0.462130}
      ],
      "blastVelocityAtBoundary_kmh": 45,
      "zoneLength_m": 120,
      "zoneWidth_m": 30,
      "personnelExclusion": true,
      "vehicleExclusion": false,
      "heavyVehicleExclusion": false
    },
    {
      "engineNumber": 2,
      "severity": "MODERATE",
      "polygon": [
        {"lat": 51.470500, "lon": -0.461700},
        {"lat": 51.470480, "lon": -0.461680},
        {"lat": 51.469900, "lon": -0.461650},
        {"lat": 51.469880, "lon": -0.461730},
        {"lat": 51.470500, "lon": -0.461730}
      ],
      "blastVelocityAtBoundary_kmh": 45,
      "zoneLength_m": 120,
      "zoneWidth_m": 30,
      "personnelExclusion": true,
      "vehicleExclusion": false,
      "heavyVehicleExclusion": false
    }
  ],
  "windAdjustment": {
    "ambientWindSpeed_ms": 5.2,
    "ambientWindDirection_deg": 240,
    "crosswindAdjusted": true
  },
  "safeApproachInfo": {
    "safeApproachHeadings": [0, 45, 315],
    "minimumApproachDistance_m": 50,
    "noseIntakeExclusion_m": 10
  }
}
```

**Example FDA (FOD Detection Alert):**

```json
{
  "header": {
    "version": 1,
    "messageType": "FDA",
    "messageTypeId": 134,
    "senderId": "GSE-third-generation tug-012",
    "senderStationId": 3012,
    "timestamp": "2026-04-11T14:23:44.800000Z",
    "timestampUs": 1744381424800000,
    "sequenceNumber": 89012
  },
  "detection": {
    "fodId": "FOD-2026041114-00047",
    "detectionTime": "2026-04-11T14:23:42.500000Z",
    "detectionConfidence": 78,
    "detectorType": "lidar",
    "detectingVehicle": "GSE-third-generation tug-012",
    "sensorDetails": {
      "sensorModel": "RoboSense_RSHELIOS",
      "sensorMountPosition": "front_top",
      "detectionRange_m": 35.2,
      "pointsOnObject": 12
    }
  },
  "location": {
    "latitude": 51.4708200,
    "longitude": -0.4615800,
    "positionUncertainty_m": 0.30,
    "surfaceType": "apron",
    "nearestStand": "B09",
    "distanceFromStand_m": 45.0,
    "onServiceRoad": true
  },
  "classification": {
    "fodClass": "TOOL",
    "estimatedSize_cm": 25,
    "estimatedHeight_cm": 5,
    "hazardLevel": 4,
    "description": "Elongated metallic object, possible wrench or ratchet"
  },
  "confirmation": {
    "confirmedBy": 2,
    "confirmations": [
      {"vehicleId": "GSE-third-generation tug-012", "time": "2026-04-11T14:23:42.500Z", "confidence": 78},
      {"vehicleId": "GSE-small tug platform-003", "time": "2026-04-11T14:23:43.100Z", "confidence": 85}
    ]
  },
  "status": {
    "cleanupRequested": true,
    "cleanupAssignedTo": "MAINT-CREW-04",
    "estimatedCleanupTime": "2026-04-11T14:28:00Z",
    "resolved": false
  }
}
```

### 5.3 Protobuf Schema Definition

For on-wire encoding within the reference airside fleet (non-ETSI messages), protobuf is recommended over ASN.1 for practical reasons: better tooling, ROS compatibility, and developer familiarity.

```protobuf
syntax = "proto3";
package airside_av.v2x;

// Timestamp in microseconds since Unix epoch
message Timestamp {
  uint64 microseconds = 1;
}

// WGS84 position
message Position {
  int32 latitude_e7 = 1;     // degrees * 10^7
  int32 longitude_e7 = 2;    // degrees * 10^7
  int32 altitude_cm = 3;     // cm above WGS84 ellipsoid
  uint16 accuracy_cm = 4;    // circular error probable
}

// Polygon zone definition
message PolygonZone {
  repeated Position vertices = 1;  // 3-16 vertices
}

// =========================================
// AIRSIDE V2X MESSAGES
// =========================================

message AircraftProximityAlert {
  V2XHeader header = 1;
  
  // Aircraft identity
  string icao_address = 10;
  string flight_id = 11;
  string aircraft_type = 12;    // ICAO type designator
  uint32 wing_span_cm = 13;
  
  // Position
  Position position = 20;
  uint32 heading_cdeg = 21;     // centidegrees
  uint32 speed_cms = 22;        // cm/s
  
  enum PositionSource {
    ADSB = 0;
    MLAT = 1;
    SMR = 2;
    MANUAL = 3;
    GNSS_GROUND = 4;
  }
  PositionSource position_source = 23;
  
  // Movement status
  enum MovementPhase {
    PARKED_ENGINES_OFF = 0;
    BOARDING = 1;
    CARGO_LOADING = 2;
    FUELING = 3;
    PUSHBACK_REQUESTED = 4;
    PUSHBACK_ACTIVE = 5;
    ENGINES_STARTING = 6;
    TAXI_OUT = 7;
    TAXI_IN = 8;
    ARRIVED_CHOCKS_ON = 9;
    DEICING = 10;
    EMERGENCY = 11;
  }
  MovementPhase movement_phase = 30;
  bool pushback_active = 31;
  uint32 engines_running_mask = 32;  // bitmask
  uint32 door_status_mask = 33;      // bitmask
  bool jet_bridge_connected = 34;
  bool gpu_connected = 35;
  
  // Proximity zones (meters)
  float nose_zone_radius_m = 40;
  float exhaust_zone_length_m = 41;
  float exhaust_zone_width_m = 42;
  float wing_clearance_m = 43;
  
  // Stand info
  string stand_id = 50;
  Timestamp expected_departure = 51;
}

message StandOperationStatus {
  V2XHeader header = 1;
  
  string stand_id = 10;
  
  enum TurnaroundPhase {
    STAND_EMPTY = 0;
    AIRCRAFT_ARRIVING = 1;
    CHOCKS_ON = 2;
    DOORS_OPEN = 3;
    TURNAROUND_ACTIVE = 4;
    FUELING_ACTIVE = 5;
    BOARDING = 6;
    DOORS_CLOSED = 7;
    PUSHBACK_CLEARANCE = 8;
    PUSHBACK_ACTIVE = 9;
    STAND_VACATED = 10;
  }
  TurnaroundPhase turnaround_phase = 20;
  Timestamp phase_start_time = 21;
  Timestamp estimated_phase_end = 22;
  
  // Equipment present
  uint32 equipment_bitmask = 30;
  message EquipmentDetail {
    uint32 gse_type = 1;
    uint32 gse_id = 2;
    string gse_position = 3;   // stand-relative
  }
  repeated EquipmentDetail equipment = 31;
  
  // A-CDM milestones
  Timestamp tobt = 40;
  Timestamp tsat = 41;
  Timestamp eobt = 42;
  Timestamp aibt = 43;
  
  // Pending services
  uint32 pending_service_bitmask = 50;
  uint32 next_expected_service_type = 51;
  uint32 next_service_eta_seconds = 52;
}

message GSETaskAssignment {
  V2XHeader header = 1;
  
  uint32 target_vehicle_id = 10;
  uint64 task_id = 11;
  
  enum TaskType {
    BAGGAGE_DELIVERY = 0;
    BAGGAGE_PICKUP = 1;
    CARGO_DELIVERY = 2;
    CARGO_PICKUP = 3;
    PASSENGER_TRANSPORT = 4;
    FUEL_DELIVERY = 5;
    PUSHBACK = 6;
    REPOSITIONING = 7;
    RETURN_TO_DEPOT = 8;
    CHARGING = 9;
    MAINTENANCE = 10;
    FOD_INSPECTION = 11;
    ESCORT_DUTY = 12;
  }
  TaskType task_type = 12;
  uint32 priority = 13;           // 0-255
  string airline_code = 14;       // IATA 2-letter
  string flight_id = 15;
  
  // Route
  string origin_stand = 20;
  string destination_stand = 21;
  repeated Position waypoints = 22;
  repeated uint32 waypoint_speed_limits_kmh = 23;
  
  // Timing
  Timestamp earliest_start = 30;
  Timestamp latest_arrival = 31;
  uint32 estimated_duration_seconds = 32;
  
  // Constraints
  uint32 max_speed_kmh = 40;
  bool escort_required = 41;
  bool requires_ack = 42;
  uint32 ack_deadline_seconds = 43;
}

message JetBlastWarning {
  V2XHeader header = 1;
  
  string icao_address = 10;
  string aircraft_type = 11;
  
  enum EngineType {
    TURBOFAN_LOW_BYPASS = 0;
    TURBOFAN_HIGH_BYPASS = 1;
    TURBOPROP = 2;
    APU_ONLY = 3;
  }
  EngineType engine_type = 12;
  uint32 engine_count = 13;
  uint32 engines_running_mask = 14;
  
  enum ThrustSetting {
    IDLE = 0;
    TAXI = 1;
    TAKEOFF = 2;
    REVERSE = 3;
  }
  ThrustSetting thrust_setting = 15;
  
  message BlastZone {
    uint32 engine_number = 1;
    enum Severity {
      NONE = 0;
      CAUTION = 1;
      MODERATE = 2;
      SEVERE = 3;
      EXTREME = 4;
    }
    Severity severity = 2;
    PolygonZone zone_polygon = 3;
    float blast_velocity_kmh = 4;
    bool personnel_exclusion = 5;
    bool vehicle_exclusion = 6;
    bool heavy_vehicle_exclusion = 7;
  }
  repeated BlastZone blast_zones = 20;
  
  // Wind adjustment
  float ambient_wind_speed_ms = 30;
  float ambient_wind_direction_deg = 31;
  bool crosswind_adjusted = 32;
}

message FODDetectionAlert {
  V2XHeader header = 1;
  
  string fod_id = 10;
  Timestamp detection_time = 11;
  uint32 detection_confidence_pct = 12;
  
  enum DetectorType {
    LIDAR = 0;
    CAMERA = 1;
    RADAR = 2;
    HUMAN_REPORT = 3;
    THERMAL = 4;
  }
  DetectorType detector_type = 13;
  
  // Location
  Position location = 20;
  string surface_type = 21;
  string nearest_stand = 22;
  
  // Classification
  enum FODClass {
    UNKNOWN = 0;
    METAL_DEBRIS = 1;
    FASTENER_BOLT = 2;
    PLASTIC_FRAGMENT = 3;
    RUBBER_TIRE = 4;
    LUGGAGE_ITEM = 5;
    PAPER_FABRIC = 6;
    TOOL = 7;
    WILDLIFE = 8;
    ICE_CHUNK = 9;
    FUEL_SPILL = 10;
    CHEMICAL_SPILL = 11;
    CARGO_FRAGMENT = 12;
    CONSTRUCTION_DEBRIS = 13;
  }
  FODClass fod_class = 30;
  uint32 estimated_size_cm = 31;
  uint32 estimated_height_cm = 32;
  uint32 hazard_level = 33;       // 1-5
  
  // Confirmation
  uint32 confirmed_by_count = 40;
  repeated uint32 confirmer_station_ids = 41;
  
  // Status
  bool cleanup_requested = 50;
  uint32 cleanup_assigned_to = 51;
  bool resolved = 52;
}

// Envelope message for multiplexing
message V2XMessage {
  oneof payload {
    AircraftProximityAlert apa = 1;
    StandOperationStatus sos = 2;
    GSETaskAssignment gta = 3;
    // DZN, EVP, RIP defined similarly
    JetBlastWarning jbw = 4;
    FODDetectionAlert fda = 5;
  }
}
```

### 5.4 Update Frequencies and Latency Requirements

**Message frequency by type and criticality:**

| Message | Normal Rate | Active/Critical Rate | Max Latency | Criticality |
|---------|------------|---------------------|-------------|-------------|
| **CAM** | 2 Hz | 10 Hz (speed > 5 km/h) | 100 ms | Safety-critical |
| **DENM** | Event-triggered | 2 Hz (active event) | 50 ms | Safety-critical |
| **CPM** | 2 Hz | 5 Hz (cooperative mode) | 100 ms | Safety-important |
| **MCM** | 0 Hz (isolated) | 5 Hz (coordinating) | 50 ms | Safety-critical |
| **APA** | 2 Hz (parked) | 10 Hz (pushback/taxi) | 20 ms | Safety-critical |
| **SOS** | 1 Hz | 2 Hz (phase change) | 500 ms | Operational |
| **GTA** | Event-triggered | --- | 200 ms | Operational |
| **DZN** | 0.5 Hz (inactive) | 2 Hz (active) | 200 ms | Safety-important |
| **EVP** | 2 Hz (en route) | 10 Hz (active response) | 20 ms | Safety-critical |
| **RIP** | 1 Hz (no traffic) | 5 Hz (vehicle near) | 20 ms | Safety-critical |
| **FDA** | Event-triggered | 1 Hz (active) | 500 ms | Safety-important |
| **JBW** | 1 Hz (APU) | 5 Hz (engines running) | 50 ms | Safety-critical |

**Latency budget breakdown (end-to-end, safety-critical path):**

```
LATENCY BUDGET: SAFETY-CRITICAL MESSAGE (20 ms total)

Sender-side:
  Sensor/system detection:           0 ms (pre-computed)
  Message construction:              0.5 ms
  Protobuf serialization:            0.2 ms
  Security (ECDSA sign):             1.0 ms
  V2X stack processing:              0.5 ms
  Radio transmission:                1.0 ms (5G URLLC)
  
Network:
  Air interface:                     0.5 ms (URLLC)
  Core network (MEC):               1.0 ms
  
Receiver-side:
  Radio reception:                   0.5 ms
  V2X stack processing:              0.5 ms
  Security (ECDSA verify):           1.0 ms
  Protobuf deserialization:          0.2 ms
  Application processing:            0.5 ms
  
Total one-way:                      ~7.4 ms
Margin:                             12.6 ms
═══════════════════════════════════════
Budget:                             20 ms ← Achievable
```

---

## 6. Integration with Airport Systems

### 6.1 Airport Systems Landscape

Airports operate a complex ecosystem of interconnected systems. V2X must bridge the vehicle network with airport IT:

```
AIRPORT SYSTEMS INTEGRATION MAP

┌─────────────────────────────────────────────────────────┐
│                    AIRPORT IT LAYER                      │
│                                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │A-CDM │  │AODB  │  │A-SMGCS│  │AMAN/ │  │Airport│   │
│  │      │  │      │  │      │  │DMAN  │  │ MET  │   │
│  │TOBT  │  │Flight│  │Surveil│  │Seqnce│  │Weather│   │
│  │TSAT  │  │Status│  │Route  │  │      │  │      │   │
│  │EOBT  │  │Gates │  │Guide  │  │      │  │      │   │
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘   │
│     │         │         │         │         │         │
│  ┌──┴─────────┴─────────┴─────────┴─────────┴───┐     │
│  │          AIRPORT MESSAGE BUS / SWIM           │     │
│  │  (AMQP / MQTT / SWIM-compliant feeds)        │     │
│  └──────────────────────┬────────────────────────┘     │
│                         │                              │
└─────────────────────────┼──────────────────────────────┘
                          │
                   ┌──────┴──────┐
                   │  V2X BRIDGE  │
                   │  (MEC Node)  │
                   │              │
                   │ - Protocol   │
                   │   translation│
                   │ - Rate       │
                   │   adaptation │
                   │ - Security   │
                   │   gateway    │
                   │ - Semantic   │
                   │   mapping    │
                   └──────┬──────┘
                          │
              ┌───────────┴───────────┐
              │   V2X MESSAGE BUS     │
              │   (5G NR / PC5)       │
              │                       │
              │  ┌───┐ ┌───┐ ┌───┐  │
              │  │GSE│ │GSE│ │GSE│  │
              │  │ 1 │ │ 2 │ │ n │  │
              │  └───┘ └───┘ └───┘  │
              └───────────────────────┘
```

### 6.2 A-CDM Integration

Airport Collaborative Decision Making provides turnaround milestones that drive GSE scheduling. Key data flows:

**A-CDM data consumed by V2X:**

| A-CDM Milestone | Field | V2X Use |
|----------------|-------|---------|
| TOBT (Target Off-Block Time) | Time | Schedule pushback tractor dispatch |
| TSAT (Target Start-up Approval Time) | Time | Trigger pushback preparation sequence |
| EOBT (Estimated Off-Block Time) | Time | Plan stand clearance |
| AIBT (Actual In-Block Time) | Time | Dispatch baggage/cargo GSE to stand |
| ELDT (Estimated Landing Time) | Time | Pre-position GSE at assigned stand |
| SIBT (Scheduled In-Block Time) | Time | Long-range fleet planning |
| SOBT (Scheduled Off-Block Time) | Time | Long-range fleet planning |

**Integration pattern**: A-CDM systems typically expose data via AMQP or SWIM (System-Wide Information Management) feeds. The V2X bridge subscribes to milestone updates and translates them into SOS and GTA messages.

```python
# Pseudocode: A-CDM to V2X bridge
class ACDMBridge:
    def on_milestone_update(self, milestone: ACDMMilestone):
        """Called when A-CDM system publishes a milestone update."""
        
        if milestone.type == "AIBT":
            # Aircraft arrived - dispatch baggage GSE
            sos = StandOperationStatus(
                stand_id=milestone.stand_id,
                turnaround_phase=TurnaroundPhase.ARRIVED_CHOCKS_ON,
                aibt=milestone.timestamp,
                tobt=milestone.associated_tobt,
            )
            self.v2x_publish(sos)
            
            # Trigger task assignment for baggage delivery
            gta = GSETaskAssignment(
                task_type=TaskType.BAGGAGE_DELIVERY,
                destination_stand=milestone.stand_id,
                flight_id=milestone.flight_id,
                airline_code=milestone.airline,
                earliest_start=milestone.timestamp + timedelta(minutes=2),
                latest_arrival=milestone.timestamp + timedelta(minutes=15),
                priority=200,  # High priority
            )
            self.fleet_manager.dispatch(gta)
        
        elif milestone.type == "TSAT":
            # Start-up approval imminent - clear stand
            sos = StandOperationStatus(
                stand_id=milestone.stand_id,
                turnaround_phase=TurnaroundPhase.PUSHBACK_CLEARANCE,
                tsat=milestone.timestamp,
            )
            self.v2x_publish(sos)
            
            # Issue clear-stand command to all GSE at stand
            self.fleet_manager.clear_stand(
                milestone.stand_id,
                deadline=milestone.timestamp - timedelta(minutes=3)
            )
```

**Auto-dispatch timing** (reference `ground-control-instructions.md` Section 2):
- Baggage delivery: AIBT + 2 minutes
- Fuel truck: AIBT + 5 minutes (after doors open verification)
- Catering: AIBT + 10 minutes
- Pushback tractor: TOBT - 10 minutes
- All GSE clear: TSAT - 3 minutes

### 6.3 A-SMGCS Integration

A-SMGCS (Advanced Surface Movement Guidance and Control System) provides four levels of service:

| Level | Service | V2X Integration |
|-------|---------|-----------------|
| **I** | Surveillance | Aircraft/vehicle positions → APA messages |
| **II** | Routing | Taxi routes → GTA waypoints |
| **III** | Guidance | Follow-the-greens → V2X route guidance |
| **IV** | Control | Automated conflict resolution → RIP, EVP messages |

**A-SMGCS data sources feeding V2X:**

1. **SMR (Surface Movement Radar)**: Primary aircraft position on movement area. 1-second update rate. Feeds APA position field.
2. **MLAT (Multilateration)**: Higher accuracy than SMR (±7.5 m). Preferred position source for APA when available.
3. **ADS-B ground receivers**: Aircraft-broadcast position (NACp-dependent accuracy). Lowest latency position source.
4. **Vehicle transponders**: RFID or GPS-based vehicle tracking already deployed at many airports.

**Surveillance data fusion for APA generation:**

```
SMR Track ─────┐
               ├──► TRACK FUSION ──► APA Message Generator
MLAT Track ────┤    (Kalman filter,
               │     position + velocity
ADS-B Track ───┘     association)

Update rate: Max(SMR_rate, MLAT_rate, ADSB_rate) ≈ 1-2 Hz
Position accuracy: Fused ±3-5 m (apron), ±7.5 m (taxiway)
```

### 6.4 ADS-B Integration

ADS-B (Automatic Dependent Surveillance-Broadcast) is the primary aircraft position/intent source:

**ADS-B OUT message fields relevant to V2X:**

| ADS-B Field | V2X Message | V2X Field |
|-------------|------------|-----------|
| ICAO address (24-bit) | APA | icaoAddress |
| Position (lat/lon) | APA | position |
| Altitude | APA | altitude |
| Velocity (speed + heading) | APA | speed, heading |
| NACp (position accuracy) | APA | positionAccuracy |
| SIL (integrity level) | APA | (trustworthiness flag) |
| Flight ID (callsign) | APA | flightId |
| Aircraft category | APA | aircraftType (cross-reference) |
| Emergency/priority | EVP | (trigger for ARFF) |
| On-ground flag | APA | (taxi vs. airborne filter) |

**ADS-B to V2X latency**: ADS-B OUT broadcasts at 1-2 Hz. Ground receiver decodes in <10 ms. V2X bridge formats APA in <1 ms. Total ADS-B → V2X pipeline: 500-1000 ms (dominated by ADS-B broadcast interval).

**Limitation**: ADS-B provides aircraft position but not door status, engine state, or pushback phase. These must come from A-CDM, A-SMGCS Level IV, or manual input.

### 6.5 AMAN/DMAN Integration

AMAN (Arrival Manager) and DMAN (Departure Manager) provide look-ahead scheduling:

| System | Look-Ahead | V2X Use |
|--------|-----------|---------|
| AMAN | 30-180 minutes | Pre-position GSE at assigned stand before arrival |
| DMAN | 10-40 minutes | Schedule pushback sequence, departure queue |

**AMAN → V2X flow:**
1. AMAN assigns arrival slot: "BA256 arriving Stand B07 at 13:45"
2. V2X bridge generates SOS (AIRCRAFT_ARRIVING) at 13:35
3. Fleet manager dispatches GTA for pre-positioning GSE
4. Vehicles navigate to staging positions near B07

**DMAN → V2X flow:**
1. DMAN assigns departure slot: "BA256 TOBT 15:25, TSAT 15:28"
2. V2X bridge generates SOS (PUSHBACK_CLEARANCE) at 15:22
3. All non-pushback GSE receive "clear stand" GTA
4. Pushback tractor receives GTA for pushback at 15:24

### 6.6 AODB Integration

The Airport Operational Database provides flight and gate information:

| AODB Data | Update Rate | V2X Use |
|-----------|-------------|---------|
| Flight schedule | Every 1-5 min | Long-range fleet planning |
| Gate assignments | Event-driven | Destination for GTA messages |
| Flight status (on-time, delayed) | Event-driven | Adjust GTA timing |
| Aircraft type per flight | At scheduling | Determine blast zones, clearances |
| Airline assignment | At scheduling | Route to correct baggage area |

**AODB → V2X data flow:**

```
AODB REST API
   │
   ├── GET /flights?status=arriving&eta_within=60min
   │   → Returns flights arriving in next 60 minutes
   │   → Used to generate SOS + GTA pre-positioning
   │
   ├── GET /flights/{id}/gate
   │   → Returns current gate assignment
   │   → Used as destination in GTA
   │
   ├── GET /flights/{id}/aircraft
   │   → Returns aircraft type (e.g., "A320")
   │   → Used to populate APA wingspan, blast zones
   │
   └── WebSocket /flights/events
       → Real-time flight status changes
       → Triggers SOS phase transitions
```

### 6.7 Bridge Architecture: Airport IT to V2X

The V2X Bridge is a critical component that translates between airport IT protocols and V2X messages:

```
┌─────────────────────────────────────────────────────────┐
│                    V2X BRIDGE (MEC Node)                 │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────────────┐    │
│  │ Airport Adapters │    │ V2X Message Generator   │    │
│  │                  │    │                          │    │
│  │ ┌──────────────┐│    │ ┌──────────────────────┐│    │
│  │ │ A-CDM (AMQP) ││───▶│ │ SOS Generator        ││    │
│  │ └──────────────┘│    │ └──────────────────────┘│    │
│  │ ┌──────────────┐│    │ ┌──────────────────────┐│    │
│  │ │ A-SMGCS      ││───▶│ │ APA Generator        ││    │
│  │ │ (ASTERIX)    ││    │ └──────────────────────┘│    │
│  │ └──────────────┘│    │ ┌──────────────────────┐│    │
│  │ ┌──────────────┐│    │ │ RIP Generator        ││    │
│  │ │ ADS-B        ││───▶│ └──────────────────────┘│    │
│  │ │ (Beast/SBS)  ││    │ ┌──────────────────────┐│    │
│  │ └──────────────┘│    │ │ EVP Generator        ││    │
│  │ ┌──────────────┐│    │ └──────────────────────┘│    │
│  │ │ AODB (REST)  ││───▶│ ┌──────────────────────┐│    │
│  │ └──────────────┘│    │ │ GTA Generator        ││    │
│  │ ┌──────────────┐│    │ └──────────────────────┘│    │
│  │ │ MET (METAR)  ││───▶│ │ Wind → JBW/DZN adj. ││    │
│  │ └──────────────┘│    │ └──────────────────────┘│    │
│  └─────────────────┘    └────────────┬────────────┘    │
│                                      │                  │
│  ┌───────────────────────────────────▼────────────┐    │
│  │           V2X Protocol Stack                    │    │
│  │  ┌────────────┐  ┌──────────────┐              │    │
│  │  │ Protobuf   │  │ ASN.1 UPER   │              │    │
│  │  │ (airside)  │  │ (ETSI std)   │              │    │
│  │  └─────┬──────┘  └──────┬───────┘              │    │
│  │        │                │                       │    │
│  │  ┌─────┴────────────────┴───────┐              │    │
│  │  │   Security (sign/encrypt)    │              │    │
│  │  └──────────────┬───────────────┘              │    │
│  │                 │                               │    │
│  │  ┌──────────────┴───────────────┐              │    │
│  │  │ 5G NR Uu / NR PC5 broadcast │              │    │
│  │  └──────────────────────────────┘              │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  Hardware: x86 server at MEC site                      │
│  OS: Ubuntu 22.04 + Docker                             │
│  Latency: <5 ms airport-IT-to-V2X                      │
│  Redundancy: Active-standby pair                        │
└─────────────────────────────────────────────────────────┘
```

**A-SMGCS ASTERIX protocol note**: Many A-SMGCS systems use EUROCONTROL ASTERIX (All Purpose Structured EUROCONTROL Surveillance Information Exchange) binary format for surveillance data. Category 010 (monosensor surface movement data), Category 011 (multi-sensor surface movement), and Category 062 (system track data) are relevant. The V2X bridge must include an ASTERIX decoder.

---

## 7. Bandwidth and Capacity Planning

### 7.1 Per-Vehicle Message Rates

Each autonomous GSE generates the following V2X traffic:

| Message | Frequency | Avg Size | Bandwidth |
|---------|-----------|----------|-----------|
| CAM (position broadcast) | 10 Hz | 300 B | 24 kbps |
| CPM (perceived objects) | 2 Hz | 1200 B | 19.2 kbps |
| MCM (planned trajectory) | 2 Hz | 400 B | 6.4 kbps |
| GTA acknowledgements | 0.1 Hz | 200 B | 0.16 kbps |
| FDA (FOD detection) | 0.01 Hz | 400 B | 0.03 kbps |
| **Total outbound** | | | **~50 kbps** |

Additionally, each vehicle receives:

| Message | Frequency | Avg Size | Bandwidth |
|---------|-----------|----------|-----------|
| CAM from N other vehicles | 10 * N Hz | 300 B | 24N kbps |
| CPM from N other vehicles | 2 * N Hz | 1200 B | 19.2N kbps |
| APA (aircraft proximity) | 5 Hz per aircraft | 130 B | 5.2 kbps/aircraft |
| SOS (stand status) | 1 Hz per stand | 100 B | 0.8 kbps/stand |
| JBW (jet blast) | 5 Hz per aircraft | 300 B | 12 kbps/aircraft |
| RIP (runway incursion) | 5 Hz | 120 B | 4.8 kbps |
| EVP (emergency) | 0 Hz (rare) | 200 B | ~0 kbps |
| DZN (de-icing) | 0 Hz (seasonal) | 200 B | ~0 kbps |
| GTA (task assignment) | 0.01 Hz | 200 B | 0.016 kbps |

### 7.2 Fleet-Level Bandwidth Calculations

**Formula for total V2X bandwidth:**

```
B_total = N_vehicles * B_out + N_vehicles * B_in

Where:
  B_out = per-vehicle outbound (≈ 50 kbps)
  B_in  = Σ(messages from all other sources)
        = (N_vehicles - 1) * (B_cam + B_cpm) 
          + N_aircraft * (B_apa + B_jbw)
          + N_stands * B_sos
          + B_rip + B_evp + B_dzn + B_gta
```

**Scenario calculations:**

**Small fleet (10 vehicles, 5 aircraft, 8 stands):**

```
Per-vehicle outbound:    10 * 50 kbps      = 500 kbps
CAM reception per veh:   9 * 24 kbps       = 216 kbps
CPM reception per veh:   9 * 19.2 kbps     = 172.8 kbps
APA per vehicle:         5 * 5.2 kbps      = 26 kbps
JBW per vehicle:         5 * 12 kbps       = 60 kbps (worst case, all engines running)
SOS per vehicle:         8 * 0.8 kbps      = 6.4 kbps
RIP per vehicle:         4.8 kbps          = 4.8 kbps
─────────────────────────────────────────────
Per-vehicle inbound:                        ≈ 486 kbps
Total per vehicle:       50 + 486           = 536 kbps
Total fleet:             10 * 536 kbps      ≈ 5.4 Mbps

5G capacity (single cell):                  ≈ 100 Mbps (DL)
Utilization:                                ≈ 5.4%  ← Comfortable
```

**Medium fleet (50 vehicles, 15 aircraft, 30 stands):**

```
Per-vehicle outbound:    50 * 50 kbps      = 2,500 kbps
CAM reception per veh:   49 * 24 kbps      = 1,176 kbps
CPM reception per veh:   49 * 19.2 kbps    = 940.8 kbps
APA per vehicle:         15 * 5.2 kbps     = 78 kbps
JBW per vehicle:         15 * 12 kbps      = 180 kbps
SOS per vehicle:         30 * 0.8 kbps     = 24 kbps
RIP per vehicle:         4.8 kbps          = 4.8 kbps
─────────────────────────────────────────────
Per-vehicle inbound:                        ≈ 2,404 kbps
Total per vehicle:       50 + 2,404        = 2,454 kbps
Total fleet:             50 * 2,454 kbps   ≈ 123 Mbps

5G capacity (multiple cells):              ≈ 500 Mbps (aggregate)
Utilization:                               ≈ 24.6%  ← Manageable
```

**Large fleet (200 vehicles, 40 aircraft, 100 stands):**

```
Per-vehicle outbound:    200 * 50 kbps     = 10,000 kbps
CAM reception per veh:   199 * 24 kbps     = 4,776 kbps
CPM reception per veh:   199 * 19.2 kbps   = 3,820.8 kbps
APA per vehicle:         40 * 5.2 kbps     = 208 kbps
JBW per vehicle:         40 * 12 kbps      = 480 kbps
SOS per vehicle:         100 * 0.8 kbps    = 80 kbps
RIP per vehicle:         4.8 kbps          = 4.8 kbps
─────────────────────────────────────────────
Per-vehicle inbound:                        ≈ 9,370 kbps
Total per vehicle:       50 + 9,370        = 9,420 kbps
Total fleet:             200 * 9,420 kbps  ≈ 1,884 Mbps

5G capacity (20+ cells):                  ≈ 2,000 Mbps (aggregate)
Utilization:                               ≈ 94%  ← CRITICAL
```

**Key finding**: At 200 vehicles, raw broadcast V2X is at the limits of 5G capacity. This requires geographic filtering and congestion control (see Section 7.3).

### 7.3 Congestion Management

**DCC (Decentralized Congestion Control):**

ETSI TS 102 687 defines DCC for V2X. The principle: when channel load exceeds thresholds, reduce message frequency and power:

| Channel Busy Ratio (CBR) | State | Action |
|--------------------------|-------|--------|
| < 30% | Relaxed | Max TX rate (10 Hz CAM), max power |
| 30-60% | Active | Reduce TX rate (5 Hz), reduce power |
| 60-80% | Restrictive | Min TX rate (2 Hz), min power |
| > 80% | Emergency | Safety messages only, all non-critical suspended |

**Geographic filtering (GeoNetworking):**

For large fleets, not every vehicle needs every message. GeoNetworking (ETSI EN 302 636) enables geographic routing:

```
GEOGRAPHIC FILTERING FOR AIRSIDE V2X

Vehicle only receives messages relevant to its geographic zone:

┌─────────────────────────────────────────────────────┐
│                    AIRPORT APRON                     │
│                                                      │
│   Zone A (Terminal 1)    Zone B (Terminal 2)         │
│   ┌─────────────────┐    ┌─────────────────┐        │
│   │ 10 GSE          │    │ 15 GSE          │        │
│   │ 3 aircraft      │    │ 5 aircraft      │        │
│   │                  │    │                  │        │
│   │ V2X: 10+3 nodes │    │ V2X: 15+5 nodes │        │
│   │ = zone-local     │    │ = zone-local     │        │
│   └─────────────────┘    └─────────────────┘        │
│                                                      │
│   Zone C (Cargo)         Zone D (Taxiway/Runway)    │
│   ┌─────────────────┐    ┌─────────────────┐        │
│   │ 8 GSE           │    │ RIP only        │        │
│   │ 2 aircraft      │    │ EVP only        │        │
│   │                  │    │ APA (taxi)      │        │
│   └─────────────────┘    └─────────────────┘        │
│                                                      │
│   Cross-zone messages: EVP, RIP (always broadcast)  │
│   Zone-local messages: CAM, CPM, SOS, GTA, DZN      │
│   Proximity messages: APA, JBW, FDA (geo-filtered)  │
└─────────────────────────────────────────────────────┘
```

**Bandwidth with geographic filtering (200 vehicles, 4 zones of ~50 vehicles):**

```
Per-vehicle inbound (zone-local):
  CAM:    49 * 24 kbps        = 1,176 kbps
  CPM:    49 * 19.2 kbps      = 940.8 kbps
  APA:    10 * 5.2 kbps       = 52 kbps
  JBW:    10 * 12 kbps        = 120 kbps
  SOS:    25 * 0.8 kbps       = 20 kbps
  RIP:    4.8 kbps            = 4.8 kbps  (cross-zone)
  EVP:    1 * 12 kbps         = 12 kbps   (cross-zone)
  ────────────────────────────────────
  Total per vehicle:           ≈ 2,376 kbps  (vs 9,370 kbps without filtering)
  
Bandwidth reduction:          75% ← Makes 200-vehicle fleet viable
Total fleet bandwidth:        200 * 2,426 ≈ 485 Mbps ← Manageable
```

### 7.4 Cooperative Perception Bandwidth

Cooperative perception (CPM with features, not just detections) is the largest bandwidth consumer. Reference `collaborative-fleet-perception.md` Section 4:

| Fusion Level | Data Shared | Per-Message Size | Rate | Bandwidth/Vehicle |
|-------------|-------------|-----------------|------|-------------------|
| **Late fusion** (detections only) | Bounding boxes + class | 50-200 B/object | 2 Hz | 2-8 kbps |
| **Feature-level (Where2comm)** | Spatial confidence map + selected features | 1-5 KB | 2 Hz | 16-80 kbps |
| **Feature-level (CoBEVT)** | BEV feature tiles | 5-50 KB | 2 Hz | 80-800 kbps |
| **Raw sharing** | Point cloud / image | 500 KB-5 MB | 2 Hz | 8-80 Mbps |

**Where2comm bandwidth selection** (from `collaborative-fleet-perception.md`):
- 95.3% of full-sharing performance at 1/64 bandwidth
- 160 KB/frame → 2.56 Mbps at 2 Hz
- This is the recommended cooperative perception mode for V2X

**Edge processing alternative:**
Instead of direct V2V feature sharing, vehicles upload features to MEC (edge server), which performs fusion and broadcasts results:

```
Vehicle A → MEC: 160 KB features (2 Hz)    = 2.56 Mbps UL
Vehicle B → MEC: 160 KB features (2 Hz)    = 2.56 Mbps UL
...
Vehicle N → MEC: 160 KB features (2 Hz)    = 2.56 Mbps UL
MEC → All:       200 KB fused result (2 Hz) = 3.2 Mbps DL (broadcast)

Total uplink:    N * 2.56 Mbps
Total downlink:  3.2 Mbps (broadcast, not per-vehicle)

For N=50 vehicles in zone:
  Uplink:   128 Mbps (within 5G UL capacity)
  Downlink: 3.2 Mbps (trivial)
```

This is more bandwidth-efficient than direct V2V sharing when N > ~5 vehicles, because the fused result is broadcast once rather than sharing N individual feature maps.

### 7.5 Peak Load Analysis

Worst-case bandwidth occurs during coordinated events:

| Event | Duration | Additional Messages | Bandwidth Spike |
|-------|---------|-------------------|----------------|
| **Pushback** | 3-5 min | APA 10 Hz, MCM 5 Hz, JBW 5 Hz | +80 kbps/vehicle in zone |
| **Emergency (ARFF)** | 5-30 min | EVP 10 Hz (all zones), all CAMs 10 Hz | +200% baseline |
| **De-icing** | 15-30 min | DZN 2 Hz, wind updates 1 Hz | +30 kbps/vehicle in zone |
| **Runway incursion alert** | 10-60 sec | RIP 10 Hz, all vehicles stop | +50 kbps/vehicle |
| **Multi-stand departure wave** | 10-20 min | 5-8 pushbacks simultaneously | +400 kbps/vehicle |

**Mitigation**: During peak events, DCC reduces non-safety message rates. GTA and SOS drop to 0.5 Hz. CPM drops to 1 Hz. Safety messages (APA, EVP, RIP) maintain full rate.

---

## 8. Security and Authentication

### 8.1 Threat Model for Airside V2X

Airport V2X operates in a semi-trusted environment (closed fleet, controlled access) but faces unique threats:

| Threat | Risk | Impact |
|--------|------|--------|
| **Position spoofing** | Medium | False vehicle position → collision with real vehicle |
| **Ghost vehicle injection** | Medium | Phantom vehicles cause unnecessary stops |
| **Message replay** | Low-Medium | Stale clearance used after expiry → runway incursion |
| **Denial of service** | Medium | Jam V2X → loss of cooperative awareness |
| **Insider threat** | Low-Medium | Compromised ground staff device injects false messages |
| **Eavesdropping** | Low | Operational intelligence leakage (airline scheduling) |
| **Man-in-the-middle** | Low | Altered task assignments → vehicle misdirected |
| **Compromised vehicle** | Low | One vehicle broadcasts false perception data |
| **Supply chain** | Low | Tampered V2X module in vehicle |

**Airport-specific threats:**
- **RF jamming near radar**: Airports have powerful RF emitters. Intentional or unintentional jamming of V2X bands is higher-probability than on roads.
- **ADS-B spoofing**: False ADS-B signals could generate false APA messages. Mitigation: cross-reference with A-SMGCS (SMR/MLAT independent of ADS-B).
- **Ground staff devices**: If V2X is extended to handheld devices for ground crew awareness, stolen/compromised devices become a vector.

### 8.2 PKI Architecture for Airside V2X

**IEEE 1609.2 / ETSI TS 103 097 security framework:**

```
AIRSIDE V2X PKI HIERARCHY

┌────────────────────────────────┐
│         ROOT CA                │
│   (Airport Authority or       │
│    National CA)                │
│                                │
│   Key: ECDSA P-256             │
│   Validity: 10+ years          │
│   Offline, HSM-protected       │
└────────────┬───────────────────┘
             │
     ┌───────┴────────┐
     ▼                 ▼
┌──────────┐    ┌──────────┐
│Enrollment│    │Enrollment│
│CA (Fleet)│    │CA (Infra)│
│          │    │          │
│Issues    │    │Issues    │
│enrollment│    │enrollment│
│certs to  │    │certs to  │
│vehicles  │    │infra     │
│          │    │nodes     │
└────┬─────┘    └────┬─────┘
     │               │
     ▼               ▼
┌──────────┐    ┌──────────┐
│ Pseudonym│    │ Infra    │
│CA (Fleet)│    │ Auth CA  │
│          │    │          │
│Issues    │    │Issues    │
│short-life│    │long-life │
│pseudonym │    │certs to  │
│certs to  │    │V2X bridge│
│vehicles  │    │RSUs, MEC │
└──────────┘    └──────────┘
```

**Certificate types:**

| Certificate Type | Issued To | Validity | Purpose |
|-----------------|-----------|----------|---------|
| **Enrollment Certificate (EC)** | Individual vehicle | 1-3 years | Identifies vehicle to PKI system |
| **Authorization Ticket (AT)** / Pseudonym Certificate | Vehicle (rotating) | 1 week | Signs V2X messages, privacy-preserving |
| **Infrastructure Certificate** | V2X bridge, RSU | 1 year | Signs APA, SOS, RIP, EVP |
| **CA Certificate** | CA entities | 5-10 years | Signs other certificates |

### 8.3 Message Security

**Every V2X message is signed:**

```
┌──────────────────────────────────────────────┐
│              V2X MESSAGE                      │
│  ┌────────────────────────────────────────┐  │
│  │           PAYLOAD                       │  │
│  │  (CAM, APA, JBW, etc.)                │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │         SECURITY HEADER                 │  │
│  │  - Signer info (certificate hash)      │  │
│  │  - Generation time                      │  │
│  │  - Signature algorithm (ECDSA P-256)   │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │         SIGNATURE                       │  │
│  │  - ECDSA-256 signature (64 bytes)      │  │
│  │  - Signs: payload + security header    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**ECDSA P-256 performance on Orin:**

| Operation | Time | Notes |
|-----------|------|-------|
| Sign | 0.8-1.2 ms | GPU-accelerated |
| Verify | 1.0-1.5 ms | GPU-accelerated |
| Batch verify (10 messages) | 3-5 ms | Amortized via batching |

**At 10 Hz CAM + 2 Hz CPM from 49 neighbors + infrastructure messages:**
- ~510 messages/second to verify
- At 1.2 ms/verify sequential: 612 ms/second → **too slow**
- Batch verification (10-message batches): ~150 ms/second → feasible
- GPU-accelerated batch: ~50 ms/second → comfortable

### 8.4 Pseudonym Certificate Rotation

For privacy on roads, vehicles rotate pseudonym certificates to prevent tracking. On airport aprons, privacy from other vehicles is less important (closed fleet), but defense-in-depth still benefits from rotation:

**Rotation policy for airside:**

| Environment | Rotation Interval | Rationale |
|-------------|-------------------|-----------|
| Road V2X (standard) | Every 5 minutes | Strong privacy |
| Airside V2X (recommended) | Every 1 hour | Balance: tracking within fleet OK, limit exposure if certificate compromised |
| Airside V2X (minimum) | Every shift (8-12 hours) | Simpler management, acceptable for closed fleet |

**Certificate pool**: Each vehicle pre-loads ~100 pseudonym certificates per week. At hourly rotation, 168 certificates needed per week. 100-certificate pool with weekly refresh provides adequate coverage with margin.

### 8.5 Replay Attack Prevention

Replay attacks are particularly dangerous for RIP (runway incursion prevention) and EVP (emergency priority) messages:

**Countermeasures:**

1. **Timestamp validation**: Messages older than 500 ms are rejected. Clock synchronization via PTP (IEEE 1588) or 5G-derived timing.

2. **Sequence number tracking**: Per-sender sequence numbers must be monotonically increasing. Gap detection triggers alert.

3. **Position plausibility**: Received position must be consistent with previous positions (maximum acceleration-based displacement check).

```python
# Replay/plausibility check pseudocode
def validate_message(msg, sender_state):
    # Timestamp freshness
    age_ms = current_time_us() - msg.timestamp_us
    if age_ms > MAX_MESSAGE_AGE_US[msg.message_type]:
        return REJECT_STALE
    
    # Sequence number
    if msg.sequence_number <= sender_state.last_seq:
        return REJECT_REPLAY
    
    # Position plausibility (CAM only)
    if msg.message_type == CAM:
        dt = (msg.timestamp_us - sender_state.last_timestamp_us) / 1e6
        max_displacement = sender_state.last_speed * dt + 0.5 * MAX_ACCEL * dt**2
        actual_displacement = distance(msg.position, sender_state.last_position)
        if actual_displacement > max_displacement * 1.5:  # 50% margin
            return REJECT_IMPLAUSIBLE
    
    return ACCEPT
```

### 8.6 Misbehavior Detection

Detecting compromised or malfunctioning V2X participants:

| Check | Detection Method | Response |
|-------|-----------------|----------|
| **Ghost vehicle** | No corresponding sensor detection after N seconds | Flag + report to fleet management |
| **Position drift** | V2X position diverges >5m from sensor-tracked position | Use sensor position, flag sender |
| **Impossible kinematics** | Speed/acceleration exceeds vehicle capability | Ignore messages from sender |
| **Sensor disagreement** | CPM objects not confirmed by local perception | Reduce trust weight for sender |
| **Certificate anomaly** | Revoked certificate, invalid chain | Reject all messages, report |
| **Flood attack** | Sender exceeds max message rate by 2x | Rate-limit processing of sender |

**Trust scoring:**

```
TRUST SCORE SYSTEM

Each V2X sender has a trust score [0.0, 1.0]:

Initial trust: 0.8 (known fleet vehicle)
              0.5 (infrastructure node, first contact)
              0.3 (unknown sender)

Trust updates:
  +0.01 per message that passes all validation checks
  -0.10 per failed plausibility check
  -0.50 per failed signature verification
  -1.00 per confirmed misbehavior

Actions:
  Trust > 0.7:  Full weight in cooperative perception fusion
  Trust 0.3-0.7: Reduced weight, logged for review
  Trust < 0.3:  Messages ignored, reported to fleet management
  Trust = 0.0:  Sender blacklisted (until manual review)
```

### 8.7 Encryption for Sensitive Messages

Most V2X messages are signed but not encrypted (broadcast). Some airside messages contain operationally sensitive data:

| Message | Encrypted? | Rationale |
|---------|-----------|-----------|
| CAM | No | Position must be public for safety |
| DENM | No | Hazard warnings must be public |
| CPM | No | Perception data is safety-relevant |
| APA | No | Aircraft status is safety-relevant |
| **GTA** | **Yes** | Contains airline task assignments, competitive info |
| **SOS** | Signed only | Turnaround status could be commercially sensitive |
| RIP | No | Safety-critical, must be universally readable |
| EVP | No | Emergency info must be universally readable |
| JBW | No | Safety-critical |
| FDA | No | FOD detection is safety-relevant |
| DZN | No | Safety-critical |

**GTA encryption**: AES-128-GCM with per-vehicle symmetric keys derived from enrollment certificates. Only the target vehicle can decrypt its task assignments.

---

## 9. Cooperative Perception via V2X

### 9.1 Relationship to Existing Cooperative Perception

This section bridges V2X protocols with cooperative perception algorithms. See `collaborative-fleet-perception.md` for full algorithm details.

**Three levels of cooperative perception over V2X:**

```
LEVEL 1: LATE FUSION (via CPM)
─────────────────────────────────
Vehicle A: [Detection list] ──CPM──▶ Vehicle B: Merge detections
Bandwidth: 2-8 kbps/vehicle
Benefit: +5-10% mAP
Latency tolerance: 200 ms

LEVEL 2: INTERMEDIATE FUSION (via feature CPM / custom msg)
─────────────────────────────────
Vehicle A: [BEV features] ──feature msg──▶ MEC: Fuse ──▶ All vehicles
Bandwidth: 80-800 kbps/vehicle (Where2comm: 160 KB/frame)
Benefit: +15-25% mAP  (DAIR-V2X results)
Latency tolerance: 100 ms

LEVEL 3: RAW SHARING (via 5G eMBB)
─────────────────────────────────
Vehicle A: [Point cloud / image] ──5G──▶ MEC: Full reprocess
Bandwidth: 8-80 Mbps/vehicle
Benefit: +20-30% mAP (theoretical maximum)
Latency tolerance: 50 ms
Only viable with 5G NR, edge computing
```

### 9.2 Where2comm Integration

Where2comm (from `collaborative-fleet-perception.md` Section 4) selects which spatial regions to share based on a learned confidence map:

**V2X message for Where2comm feature sharing:**

```protobuf
message CooperativeFeatureMessage {
  V2XHeader header = 1;
  
  // Spatial region definition
  float bev_origin_x = 10;     // BEV grid origin (ego-relative, meters)
  float bev_origin_y = 11;
  float bev_resolution = 12;   // meters per cell
  uint32 bev_width = 13;       // cells
  uint32 bev_height = 14;      // cells
  
  // Confidence map (which regions are informative)
  bytes confidence_map = 20;    // Quantized uint8, one per BEV cell
  
  // Selected feature regions (sparse)
  message FeatureRegion {
    uint32 x_start = 1;
    uint32 y_start = 2;
    uint32 width = 3;
    uint32 height = 4;
    bytes features = 5;         // FP16 or INT8 quantized feature tensor
  }
  repeated FeatureRegion selected_regions = 30;
  
  // Pose for alignment
  float ego_x = 40;
  float ego_y = 41;
  float ego_heading = 42;
  uint64 pose_timestamp_us = 43;
}
```

**Size calculation:**
- Confidence map: 200x200 BEV at uint8 = 40 KB
- Selected features: ~20% of 200x200 at 128 channels, FP16 = 200*200*0.2*128*2 = 2.05 MB
- With INT8 quantization: ~1 MB
- With further compression (learned codebook): ~100-300 KB
- Target: **160 KB/frame** (Where2comm benchmark)

### 9.3 Asynchronous Fusion with CoBEVFlow

V2X messages arrive with variable delay. CoBEVFlow (from `collaborative-fleet-perception.md` Section 5) compensates for temporal misalignment:

```
Vehicle A feature (t=0ms) ──────────────▶ arrives at B (t=120ms)
                                          │
                                          ▼
                                   CoBEVFlow compensates
                                   120ms of motion
                                          │
                                          ▼
Vehicle B feature (t=120ms) ────────▶ Fused result (t=120ms)
```

**Tolerable delays for cooperative perception:**

| Delay | Impact | Compensation |
|-------|--------|-------------|
| <50 ms | Negligible | None needed |
| 50-100 ms | Minor (<1% mAP loss) | Linear motion compensation |
| 100-200 ms | Moderate (1-3% mAP loss) | CoBEVFlow learned compensation |
| 200-500 ms | Significant (3-8% mAP loss) | CoBEVFlow with uncertainty inflation |
| >500 ms | Severe | Discard or use for occupancy only (not tracking) |

**Airside advantage**: Vehicle speeds are 0-25 km/h (0-7 m/s). At 200 ms delay, maximum displacement is 1.4 m. This is far more forgiving than road V2X where 200 ms at highway speed means 5.6 m displacement. CoBEVFlow compensation is therefore more effective on airport aprons.

### 9.4 Heterogeneous Agent Fusion

reference airside fleet includes third-generation tug, small tug platform, POD, and ACA1 with different sensor configurations. HEAL (from `collaborative-fleet-perception.md` Section 6) handles this:

```
third-generation tug (4x RoboSense RSHELIOS) ──▶ ┌──────────────┐
                                   │              │
small tug platform (8x RoboSense RSBP)    ──▶  │   HEAL       │ ──▶ Unified BEV
                                   │   Alignment  │
POD  (2x RoboSense + cameras)──▶  │   Modules    │
                                   │              │
Infrastructure (CCTV + radar) ──▶  └──────────────┘
```

**Key**: Each agent type has a learnable alignment module that maps its feature representation to a common intermediate space. New agent types can be added without retraining existing agents.

---

## 10. Implementation Architecture

### 10.1 V2X ROS Node Architecture

Integration with the reference ROS Noetic airside stack:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          REFERENCE AIRSIDE AV STACK VEHICLE                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    ROS NOETIC                                 │  │
│  │                                                               │  │
│  │  Existing Nodes:                                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │  │ LiDAR    │ │ GTSAM    │ │ Frenet   │ │ Stanley  │       │  │
│  │  │ Percep.  │ │ Localiz. │ │ Planner  │ │ Control  │       │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┘       │  │
│  │       │             │            │                            │  │
│  │  New V2X Nodes:     │            │                            │  │
│  │  ┌──────────────────┴────────────┴──────────┐                │  │
│  │  │           /v2x_manager                    │                │  │
│  │  │                                           │                │  │
│  │  │  - Publishes: /v2x/received/*             │                │  │
│  │  │  - Subscribes: /v2x/outbound/*            │                │  │
│  │  │  - Message validation + trust scoring     │                │  │
│  │  │  - DCC (congestion control)               │                │  │
│  │  │  - Security (sign/verify)                 │                │  │
│  │  └───────────┬───────────────────────────────┘                │  │
│  │              │                                                 │  │
│  │  ┌───────────┴───────────────┐                                │  │
│  │  │    /v2x_radio_interface   │                                │  │
│  │  │                           │                                │  │
│  │  │  - 5G modem control       │                                │  │
│  │  │  - PC5 sidelink control   │                                │  │
│  │  │  - Protobuf ↔ wire format │                                │  │
│  │  │  - Link monitoring        │                                │  │
│  │  └───────────┬───────────────┘                                │  │
│  │              │                                                 │  │
│  └──────────────┼────────────────────────────────────────────────┘  │
│                 │                                                    │
│  ┌──────────────┴──────────────┐                                   │
│  │    5G/NR Modem Hardware     │                                   │
│  │    (Qualcomm 9205/9150)     │                                   │
│  └─────────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 ROS Topic Structure

```
/v2x/
├── outbound/
│   ├── cam              # Vehicle's own CAM (published by localization + vehicle state)
│   ├── cpm              # Vehicle's perceived objects (published by perception)
│   ├── mcm              # Vehicle's planned trajectory (published by planner)
│   └── fda              # FOD detections (published by perception)
│
├── received/
│   ├── cam              # CAMs from other vehicles
│   ├── cpm              # CPMs from other vehicles
│   ├── mcm              # MCMs from other vehicles
│   ├── apa              # Aircraft Proximity Alerts (from infrastructure)
│   ├── sos              # Stand Operation Status (from infrastructure)
│   ├── gta              # Task assignments (from fleet management)
│   ├── dzn              # De-icing zone notifications
│   ├── evp              # Emergency vehicle priority
│   ├── rip              # Runway incursion prevention
│   ├── jbw              # Jet blast warnings
│   └── fda              # FOD alerts from other vehicles
│
├── cooperative_perception/
│   ├── features_in      # Received cooperative perception features
│   ├── features_out     # Outbound cooperative perception features
│   └── fused_objects    # Result of cooperative perception fusion
│
├── status/
│   ├── link_quality     # V2X link status (5G RSRP/RSRQ, PC5 RSSI)
│   ├── connectivity     # Connected/degraded/disconnected
│   ├── neighbors        # List of known V2X neighbors with trust scores
│   └── congestion       # DCC state (relaxed/active/restrictive)
│
└── diagnostics/
    ├── message_stats    # Message counts, rates, errors
    ├── security_events  # Failed verifications, misbehavior detections
    └── latency         # End-to-end message latency statistics
```

### 10.3 Message Serialization Strategy

**Dual-format approach:**

```
WIRE FORMAT (vehicle-to-vehicle/infrastructure):
  Standard messages (CAM, DENM, CPM, MCM): ASN.1 UPER
  Airside extensions (APA, SOS, GTA, etc.): Protobuf
  
INTERNAL FORMAT (within ROS):
  All messages: ROS message types (generated from protobuf)
  
AIRPORT IT FORMAT (bridge to airport systems):
  JSON over MQTT/AMQP

LOGGING FORMAT:
  JSON (human-readable) + binary (protobuf, space-efficient)
```

**Why protobuf for airside extensions (not ASN.1):**
1. Better tooling for ROS integration (protobuf → ROS msg generation is straightforward)
2. Simpler schema evolution (field numbering, optional fields)
3. Developer familiarity (team already uses protobuf for internal services)
4. Performance (protobuf encode/decode: 50-100 us; ASN.1 UPER: 100-300 us)
5. Standard ETSI messages still use ASN.1 UPER for interoperability

### 10.4 MQTT/DDS Bridge for Airport IT

Airport IT systems typically use MQTT or AMQP. ROS 2 uses DDS natively, but ROS 1 (Noetic) needs a bridge:

```python
# MQTT bridge for airport IT integration (Python, runs alongside ROS)
import paho.mqtt.client as mqtt
import rospy
from airside_v2x.msg import StandOperationStatus, AircraftProximityAlert

class AirportMQTTBridge:
    """Bridges airport MQTT topics to ROS V2X topics."""
    
    def __init__(self):
        # MQTT connection to airport message bus
        self.mqtt_client = mqtt.Client(client_id="airside-v2x-bridge")
        self.mqtt_client.tls_set(
            ca_certs="/etc/v2x/airport_ca.pem",
            certfile="/etc/v2x/bridge_cert.pem",
            keyfile="/etc/v2x/bridge_key.pem"
        )
        self.mqtt_client.connect("airport-mqtt.example.com", 8883)
        
        # Subscribe to airport topics
        self.mqtt_client.subscribe("airport/acdm/milestones/#")
        self.mqtt_client.subscribe("airport/asmgcs/tracks/#")
        self.mqtt_client.subscribe("airport/adsb/aircraft/#")
        self.mqtt_client.subscribe("airport/met/wind/#")
        self.mqtt_client.message_callback_add(
            "airport/acdm/milestones/#", self.on_acdm_milestone
        )
        self.mqtt_client.message_callback_add(
            "airport/asmgcs/tracks/#", self.on_asmgcs_track
        )
        
        # ROS publishers
        self.apa_pub = rospy.Publisher(
            "/v2x/received/apa", AircraftProximityAlert, queue_size=10
        )
        self.sos_pub = rospy.Publisher(
            "/v2x/received/sos", StandOperationStatus, queue_size=10
        )
    
    def on_acdm_milestone(self, client, userdata, msg):
        """Convert A-CDM milestone to SOS message."""
        data = json.loads(msg.payload)
        sos = StandOperationStatus()
        sos.header.stamp = rospy.Time.now()
        sos.stand_id = data["standId"]
        sos.turnaround_phase = self.map_acdm_phase(data["milestone"])
        sos.tobt = rospy.Time.from_sec(data.get("tobt", 0))
        sos.tsat = rospy.Time.from_sec(data.get("tsat", 0))
        self.sos_pub.publish(sos)
    
    def on_asmgcs_track(self, client, userdata, msg):
        """Convert A-SMGCS track to APA message."""
        data = json.loads(msg.payload)
        if data["trackType"] != "aircraft":
            return
        apa = AircraftProximityAlert()
        apa.header.stamp = rospy.Time.now()
        apa.icao_address = data["icaoAddress"]
        apa.position.latitude = data["latitude"]
        apa.position.longitude = data["longitude"]
        apa.heading = data["heading"]
        apa.speed = data["groundSpeed"]
        apa.movement_phase = self.infer_movement_phase(data)
        self.apa_pub.publish(apa)
```

### 10.5 Fallback Behavior When V2X Drops

V2X connectivity loss must be handled gracefully:

```
V2X CONNECTIVITY STATE MACHINE

┌──────────────────┐
│    CONNECTED      │◄──── V2X link quality > threshold
│                   │      for > 5 seconds
│  Full operations: │
│  - All V2X msgs   │
│  - Coop perception│
│  - Full speed     │
│  (25 km/h)        │
└────────┬──────────┘
         │ Link quality below threshold
         │ OR no messages received for 2 seconds
         ▼
┌──────────────────┐
│    DEGRADED       │◄──── PC5 sidelink still works
│                   │      OR intermittent 5G
│  Limited ops:     │
│  - Safety msgs    │
│  - No coop percep│
│  - Reduced speed  │
│  (15 km/h)        │
│  - Increased      │
│    sensor margins │
└────────┬──────────┘
         │ No V2X messages for 10 seconds
         │ AND no PC5 sidelink
         ▼
┌──────────────────┐
│  DISCONNECTED     │
│                   │
│  Onboard-only:    │
│  - No V2X at all  │
│  - Speed: 5 km/h  │
│  - Safety stop if │
│    near aircraft   │
│  - Request teleop │
│    via WiFi if avail│
│  - If no comms:   │
│    stop and wait   │
└──────────────────┘
```

**Fallback planning integration**: When V2X drops, the Frenet planner must:
1. Inflate all obstacle margins by 2x (no cooperative perception)
2. Treat all stand areas as potentially occupied (no SOS data)
3. Assume worst-case jet blast zones for all parked aircraft (no JBW data)
4. Hold at any hold-short line indefinitely (no RIP clearance)
5. Yield to any approaching vehicle until visual confirmation of intent (no MCM data)

### 10.6 Simulation and Testing

**SUMO + CARLA co-simulation for V2X testing:**

```
┌─────────────────────────────────┐
│        SUMO (Traffic Sim)       │
│  - Fleet-level routing          │
│  - Task assignment              │
│  - A-CDM milestone generation   │
│  - Traffic flow                 │
└──────────┬──────────────────────┘
           │ Vehicle positions,
           │ task events
           ▼
┌──────────────────────────────────┐
│    V2X NETWORK SIMULATOR         │
│  (ns-3 / OpenC2X / Artery)      │
│  - Channel model (airport RF)   │
│  - Message delivery/loss/delay  │
│  - DCC simulation               │
│  - Security overhead             │
└──────────┬───────────────────────┘
           │ Delivered V2X messages
           │ with realistic timing
           ▼
┌──────────────────────────────────┐
│       CARLA (Sensor Sim)         │
│  - LiDAR point clouds           │
│  - Camera images                 │
│  - Vehicle dynamics              │
│  - Airport environment model    │
└──────────┬───────────────────────┘
           │ Sensor data +
           │ V2X messages
           ▼
┌──────────────────────────────────┐
│    ROS NOETIC (Vehicle Stack)    │
│  - Perception                    │
│  - V2X manager                   │
│  - Cooperative perception fusion │
│  - Planning with V2X input       │
│  - Same code as real vehicle     │
└──────────────────────────────────┘
```

**V2X-specific test scenarios:**

| Test ID | Scenario | V2X Messages | Pass Criteria |
|---------|----------|-------------|---------------|
| V2X-001 | V2X total loss during approach to stand | All messages stop | Vehicle stops within 5 m |
| V2X-002 | Spoofed ghost vehicle in path | False CAM | Vehicle detects misbehavior, trusts sensors |
| V2X-003 | Stale RIP clearance (replay) | Old RIP | Vehicle rejects stale message, holds |
| V2X-004 | Pushback APA while vehicle at stand | APA phase change | Vehicle clears stand within 30 seconds |
| V2X-005 | JBW activation while vehicle in zone | JBW severity change | Vehicle routes around blast zone |
| V2X-006 | EVP during mission execution | EVP with clear path | Vehicle yields within 5 seconds |
| V2X-007 | DCC kicks in during peak operations | CAM rate reduced | Safety messages maintained, non-safety reduced |
| V2X-008 | Multi-vehicle conflict at stand entry | MCM + CAM from 3 vehicles | Orderly sequencing, no deadlock |
| V2X-009 | FOD detected by fleet (multi-confirm) | FDA from 3 vehicles | Cleanup dispatched, vehicles route around |
| V2X-010 | 5G to PC5 sidelink handover | Loss of Uu, PC5 active | Safety messages continue within 100 ms |

---

## 11. Standards Landscape and Roadmap

### 11.1 Current Standards Applicable to Airside V2X

**No airside-specific V2X standard exists.** The following road/general standards form the foundation:

| Standard | Scope | Airside Applicability | Gap |
|----------|-------|----------------------|-----|
| **IEEE 802.11p** | DSRC PHY/MAC | Radio access (alternative) | No airside message definitions |
| **ETSI EN 302 637-2** | CAM specification | Vehicle awareness (core) | Missing airside vehicle roles |
| **ETSI EN 302 637-3** | DENM specification | Hazard notification (core) | Missing airside hazard types |
| **ETSI TS 103 324** | CPM specification | Cooperative perception (core) | Missing airside object classes |
| **ETSI TR 103 578** | MCM study | Maneuver coordination (partial) | Not yet standardized |
| **3GPP TS 22.186** | V2X service requirements | Service requirements (reference) | Road-focused scenarios |
| **3GPP TS 38.300** | NR V2X | Radio access (primary) | No airside profile |
| **IEEE 1609.2** | V2X security | Security framework (core) | PKI adapted for closed fleet |
| **SAE J2735** | BSM message set | US message format (reference) | No airside extensions |
| **SAE J2945** | V2V/V2I application | Application guidelines (reference) | Road-only |
| **SAE J3161** | C-V2X for BSM | C-V2X application | Road-only |
| **ISO 3691-4** | AGV safety | Safety requirements | Communication requirements minimal |
| **ICAO Annex 14** | Aerodrome design | Airport reference | No V2X provisions |
| **ICAO Doc 9830** | A-SMGCS manual | Surface movement | Covers surveillance, not V2X |

### 11.2 Standardization Gaps

**Critical gaps that must be filled for airside V2X:**

| Gap | Description | Who Should Standardize | Priority |
|-----|-------------|----------------------|----------|
| **Airside V2X message set** | APA, SOS, GTA, JBW, DZN, RIP, EVP, FDA | EUROCAE WG-107 or SAE | Critical |
| **Airside vehicle role taxonomy** | GSE types, aircraft, ground crew | EUROCAE / ACI | High |
| **Airside object classification** | Aircraft subtypes, GSE subtypes, FOD classes | ETSI / ISO | High |
| **A-CDM to V2X interface** | Standard data mapping from A-CDM to V2X messages | EUROCAE / ACI | High |
| **A-SMGCS to V2X interface** | ASTERIX/SWIM to V2X bridge specification | EUROCONTROL / EUROCAE | Medium |
| **Airside DCC profile** | Congestion control tuned for apron traffic patterns | ETSI | Medium |
| **Airside PKI governance** | Who operates CA, certificate policies | National CAAs | Medium |
| **Airside V2X testing profile** | Test scenarios, acceptance criteria | SAE / ISO | Medium |
| **Jet blast zone V2X encoding** | Standardized blast zone polygon format | ICAO / EUROCAE | High |
| **De-icing zone V2X encoding** | Chemical spray boundary encoding | ACI / EUROCAE | Medium |

### 11.3 Relevant Industry Bodies

| Organization | Role | V2X Relevance |
|-------------|------|---------------|
| **ICAO** | Global aviation standards | Could mandate airside V2X in Annex 14 amendment |
| **EUROCONTROL** | European ATM | A-SMGCS, ASTERIX, SWIM integration |
| **EUROCAE** | European aviation equipment standards | WG-107 (UAS/automated vehicles in aviation) could extend to GSE V2X |
| **ACI** (Airports Council International) | Airport operator association | Digitalization initiatives, could champion V2X requirements |
| **ETSI** | European telecom standards | ITS message sets, already has V2X expertise |
| **SAE** | US automotive standards | J2735/J2945, could create airport V2X profile |
| **3GPP** | Cellular standards | 5G NR V2X technical specifications |
| **IEEE** | General standards | 802.11p, 1609.x series |
| **ISO TC 110** | Industrial trucks | ISO 3691-4 AGV safety |
| **ISO TC 204** | ITS | ISO 17429 (V2X), ISO 22418 (C-ITS) |
| **FAA** | US aviation authority | CertAlert 24-02, future AV guidance |
| **EASA** | EU aviation authority | Future AMC for automated vehicles airside |

### 11.4 Predicted Standardization Timeline

Based on current industry activity and regulatory trajectories (reference `80-industry-intel/regulations/regulatory-trajectory-deep-dive.md`):

```
AIRSIDE V2X STANDARDIZATION TIMELINE (PREDICTED)

2024 ─── Current state
         │ ■ No airside V2X standard exists
         │ ■ Road V2X (ETSI ITS, SAE J2735) mature
         │ ■ Proprietary approaches by UISEE, TractEasy
         │
2025 ─── Early activity
         │ ■ ACI digital apron working group discussions
         │ ■ EUROCAE WG-107 scoping automated ground vehicles
         │ ■ 3GPP Rel-18 completes (advanced V2X features)
         │
2026 ─── Industry proposals
         │ ■ First industry white papers on airside V2X
         │ ■ reference airside AV stack/UISEE/TractEasy begin publishing approaches
         │ ■ ETSI opens study item on airport ITS profile
         │ ■ Changi driverless deployment generates requirement pull
         │
2027 ─── Standards development begins
         │ ■ EUROCAE WG on airside automated vehicle communications
         │ ■ ETSI TS for airport ITS message extensions (work item)
         │ ■ EU Machinery Regulation drives interoperability need
         │ ■ First draft airport V2X message specifications
         │
2028-2029 ─── Draft standards
         │ ■ ETSI TR/TS on airport V2X message set
         │ ■ FAA Advisory Circular references airside V2X
         │ ■ EASA AMC includes V2X communication requirements
         │ ■ SAE J3400-series for airport V2X (US profile)
         │
2030-2032 ─── Mature standards
         │ ■ ICAO Annex 14 amendment includes V2X provisions
         │ ■ ISO standard for AGV V2X in industrial/airport settings
         │ ■ Interoperability testing between manufacturers
         │ ■ Airport V2X certification frameworks
         │
2033+ ─── Mandated
           ■ Major airports require V2X for autonomous GSE
           ■ Regulatory compliance verified via V2X message logs
           ■ Interoperability between different GSE manufacturers
```

### 11.5 De Facto Standardization Strategy

Given the long timeline for formal standards, the practical strategy is:

1. **Build on ETSI ITS foundation**: Use CAM, DENM, CPM, MCM as-is for standard messages. Add airside extensions in the reserved range (0x80-0xFF).

2. **Publish specifications openly**: Release airside message specifications as open documents. If the reference airside AV stack's specifications become the basis for the eventual standard, significant competitive advantage.

3. **Engage with EUROCAE WG-107**: Provide input from deployment experience. Shape the standard rather than react to it.

4. **Design for migration**: Today's protobuf-based airside extensions should be designed to migrate to ASN.1 UPER when the formal standard is published. Keep field semantics stable even if encoding changes.

5. **Interoperability testing with competitors**: Propose joint V2X testing with other airside AV manufacturers at neutral airports. This accelerates standardization and demonstrates safety maturity.

### 11.6 ISO 3691-4 Communication Requirements

ISO 3691-4 (Safety of industrial trucks --- Driverless industrial trucks) includes minimal communication requirements:

| ISO 3691-4 Clause | Requirement | V2X Coverage |
|-------------------|-------------|-------------|
| 5.4 (Communication) | Reliable communication between AGV and control system | V2X provides this + V2V |
| 5.4.2 (Loss of communication) | Vehicle must stop safely on communication loss | V2X fallback state machine (Section 10.5) |
| 5.4.3 (Communication security) | Protection against unauthorized access | PKI + signed messages (Section 8) |
| 5.10 (Warning signals) | Visual/audible warnings for personnel | V2X extends to digital warnings (P2V) |

**Gap**: ISO 3691-4 does not specify V2X message formats, frequencies, or latency requirements. These are left to the manufacturer's risk assessment. The specifications in this document exceed ISO 3691-4 requirements and could form the basis of a compliance argument.

---

## 12. Key Takeaways

1. **No V2X standard exists for airport airside operations.** ICAO, ACI, SAE, and ETSI have not addressed GSE-to-GSE or GSE-to-infrastructure communication. This is both a risk (no compliance path) and an opportunity (first-mover defines the de facto standard).

2. **Road V2X standards (ETSI ITS) cover approximately 40% of airside needs.** CAM, DENM, CPM, and MCM provide the architectural foundation for vehicle awareness, hazard notification, cooperative perception, and maneuver coordination. The remaining 60% requires eight custom airside message types.

3. **C-V2X over private 5G/CBRS is the recommended radio access.** Airports deploying private 5G (DFW, Changi, and most major airports by 2028) can reuse that infrastructure for V2X. 5G NR V2X provides sub-millisecond URLLC latency, 1+ Gbps bandwidth, native network slicing, and MEC integration --- all superior to DSRC for airport use.

4. **Eight airside-specific message types are defined.** APA (Aircraft Proximity Alert), SOS (Stand Operation Status), GTA (GSE Task Assignment), DZN (De-Icing Zone), EVP (Emergency Vehicle Priority), RIP (Runway Incursion Prevention), FDA (FOD Detection Alert), and JBW (Jet Blast Warning) cover the unique coordination and safety requirements of apron operations.

5. **Safety-critical messages require <20 ms end-to-end latency.** RIP, APA (during pushback/taxi), and EVP demand the lowest latency. This is achievable with 5G URLLC (total pipeline ~7.4 ms) but not with standard LTE C-V2X Uu path (20-100 ms).

6. **A 50-vehicle fleet requires approximately 123 Mbps total V2X bandwidth.** This is within private 5G aggregate capacity but requires geographic zone filtering for fleets larger than ~100 vehicles to prevent congestion. At 200 vehicles without filtering, bandwidth approaches 1.9 Gbps --- necessitating DCC and zone-based message routing.

7. **Jet blast zones are the highest-criticality airside V2X message.** Jet blast is invisible to LiDAR and cameras (only thermal can detect it). V2X broadcast of JBW messages is the primary safety mechanism to keep vehicles and personnel out of blast zones. Default behavior when JBW is unavailable must assume worst-case exclusion zones.

8. **RIP implements a default-deny clearance model.** A vehicle must receive an explicit, non-expired, addressed CLEARED status before crossing any hold-short line. No RIP message = HOLD. Network failure = HOLD. This is the most safety-critical V2X message type.

9. **PKI architecture uses airport-managed certificate hierarchy.** Unlike road V2X where vehicles from different manufacturers and fleets share a national PKI, airside V2X operates in a closed fleet with airport-managed enrollment and pseudonym CAs. This simplifies trust management but requires per-airport PKI deployment.

10. **Cooperative perception over V2X adds 15-25% detection AP.** Where2comm feature sharing at 160 KB/frame achieves 95.3% of full raw-data sharing performance. Edge processing (MEC) is more bandwidth-efficient than direct V2V sharing for fleets larger than 5 vehicles.

11. **V2X bridge between airport IT and V2X bus is a critical integration component.** A-CDM milestones, A-SMGCS surveillance tracks, ADS-B aircraft positions, and AODB flight data must be translated into V2X messages. This bridge (running on MEC hardware) handles protocol translation (ASTERIX, AMQP, REST to protobuf/ASN.1), security gateway, and rate adaptation.

12. **Fallback behavior must be safe without V2X.** When V2X connectivity is lost, the vehicle must reduce speed (25 km/h to 5 km/h), inflate safety margins (2x), hold at all hold-short lines, and assume worst-case for all unobservable hazards (jet blast, stand occupancy). This matches the existing Simplex safety architecture.

13. **Protobuf is recommended over ASN.1 for airside extensions.** While ETSI standard messages use ASN.1 UPER for interoperability, airside-specific messages benefit from protobuf's superior tooling, ROS integration, schema evolution, and developer familiarity. Migration to ASN.1 can occur when formal standards are published.

14. **Formal standards are predicted to emerge around 2028-2030.** EUROCAE WG-107 activity, EU Machinery Regulation 2027 interoperability requirements, and growing deployment experience will drive standardization. Publishing the reference airside AV stack's V2X specifications openly could influence the emerging standard.

15. **Misbehavior detection and trust scoring are essential for safety.** Even in a closed fleet, sensor degradation, software bugs, and (less likely) compromise can cause a vehicle to broadcast incorrect V2X data. Trust scores (0.0-1.0) with automatic demotion on validation failure prevent cascading errors.

16. **V2X connectivity enables a step-change in operational capability.** Beyond incremental safety improvement, V2X enables capabilities that onboard-only perception cannot: A-CDM-driven auto-dispatch within 2 minutes of aircraft arrival, fleet-wide FOD detection at 95%+ probability, coordinated multi-stand departure waves, and real-time runway incursion prevention.

17. **Implementation cost estimate: $120-200K over 16-20 weeks** for Phase 1 (CAM + APA + SOS + GTA + RIP + basic security). Phase 2 (CPM + cooperative perception + JBW + DZN + FDA + EVP + full PKI): additional $150-250K over 16-24 weeks. Total: $270-450K for full V2X capability. Hardware per vehicle: $200-600 for integrated 5G modem (assuming airport provides 5G infrastructure).

18. **Multi-vehicle FOD confirmation via FDA messages dramatically improves detection reliability.** Single-vehicle FOD detection has 30-60% probability. With fleet V2X, three independent confirmations from different viewing angles raise probability to 95-99% (reference `collaborative-fleet-perception.md` Section 8). The FDA message enables this multi-confirmation workflow.

19. **Asynchronous fusion is highly forgiving on airside.** At 25 km/h maximum speed, 200 ms V2X delay causes only 1.4 m displacement versus 5.6 m at highway speed. CoBEVFlow temporal compensation is therefore more effective, and the accuracy penalty for V2X latency is smaller than on roads.

20. **Building airside V2X capability now creates a competitive moat.** No competitor has published V2X specifications. All use centralized cloud-mediated communication (50-200 ms latency, single point of failure). Native V2X with direct V2V and infrastructure integration provides safety and operational advantages that are difficult to replicate quickly.

---

## References

### Standards Documents
- ETSI EN 302 637-2: Cooperative Awareness Basic Service (CAM)
- ETSI EN 302 637-3: Decentralized Environmental Notification Basic Service (DENM)
- ETSI TS 103 324: Collective Perception Service (CPM)
- ETSI TR 103 578: Maneuver Coordination Service (MCM)
- ETSI TS 102 687: Decentralized Congestion Control (DCC)
- ETSI EN 302 636: GeoNetworking
- ETSI TS 103 097: Security header and certificate formats
- IEEE 802.11p: WAVE (Wireless Access in Vehicular Environments)
- IEEE 1609.2: Security Services for Applications and Management Messages
- 3GPP TS 22.186: Enhancement of 3GPP Support for V2X Scenarios
- 3GPP TS 36.300: E-UTRA and E-UTRAN Overall Description (C-V2X)
- 3GPP TS 38.300: NR and NG-RAN Overall Description (NR V2X)
- SAE J2735: V2X Communications Message Set Dictionary
- SAE J2945: V2V and V2I Application Requirements
- ISO 3691-4: Driverless Industrial Trucks Safety
- ICAO Annex 14: Aerodromes
- ICAO Doc 9830: Advanced Surface Movement Guidance and Control Systems

### Related Repository Documents
- `30-autonomy-stack/multi-agent-v2x/fleet-coordination.md` --- Multi-agent coordination overview
- `30-autonomy-stack/perception/overview/collaborative-fleet-perception.md` --- V2V cooperative perception algorithms
- `20-av-platform/networking-connectivity/airport-5g-cbrs.md` --- Airport 5G/CBRS infrastructure
- `70-operations-domains/airside/operations/ground-control-instructions.md` --- A-CDM, A-SMGCS, ATC integration
- `60-safety-validation/cybersecurity/cybersecurity-airside-av.md` --- Cybersecurity for airside AVs
- `70-operations-domains/airside/operations/turnaround-prediction.md` --- Turnaround sequencing
- `60-safety-validation/standards-certification/iso-3691-4-deep-dive.md` --- ISO 3691-4 compliance
- `60-safety-validation/verification-validation/airside-scenario-taxonomy.md` --- Test scenarios
- `30-autonomy-stack/planning/safety-critical-planning-cbf.md` --- CBF safety filters
- `40-runtime-systems/ros-autoware/ros2-migration.md` --- ROS 2 migration (DDS native V2X integration)
