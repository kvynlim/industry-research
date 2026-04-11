# Cybersecurity for Autonomous Vehicles on Airport Airside

## Threat Models, Standards, Defenses, and Incident Response for Autonomous GSE

**Last updated:** 2026-03-23

---

## Table of Contents

1. [Threat Model for Airside Autonomous GSE](#1-threat-model-for-airside-autonomous-gse)
2. [Aviation-Specific Cyber Threats](#2-aviation-specific-cyber-threats)
3. [ISO/SAE 21434 -- Automotive Cybersecurity Engineering](#3-isosae-21434----automotive-cybersecurity-engineering)
4. [EASA Cybersecurity Requirements](#4-easa-cybersecurity-requirements)
5. [Secure Communication](#5-secure-communication)
6. [Sensor Security](#6-sensor-security)
7. [Software Supply Chain Security](#7-software-supply-chain-security)
8. [Data Security and Privacy](#8-data-security-and-privacy)
9. [Incident Response](#9-incident-response)
10. [Published Attacks on AV Systems](#10-published-attacks-on-av-systems)
11. [Competitor Cybersecurity Approaches](#11-competitor-cybersecurity-approaches)
12. [Recommendations for Airside AV Operators](#12-recommendations-for-airside-av-operators)
13. [References](#13-references)

---

## 1. Threat Model for Airside Autonomous GSE

### 1.1 Why Airside is a Uniquely High-Value Target

Autonomous ground support equipment (GSE) operating airside at airports represents a cybersecurity target with characteristics that differ fundamentally from road-going autonomous vehicles:

- **Proximity to aircraft**: Compromised GSE could physically damage aircraft worth $100M-$400M each, or cause mass-casualty events
- **Critical infrastructure designation**: Airports are classified as critical national infrastructure in most jurisdictions (US: TSA/CISA Critical Infrastructure; EU: NIS2 Directive; UK: CNI designation)
- **Operational disruption amplification**: A single compromised autonomous tractor at a hub airport could halt turnaround operations across multiple stands, cascading delays across the network
- **Co-located sensitive systems**: Autonomous GSE shares the ramp environment with ADS-B transponders, ILS/MLS navigation aids, fuel systems, and aircraft maintenance networks
- **State-level threat actors**: Airports are targets for nation-state adversaries, not just opportunistic attackers -- the threat model must account for APT-grade capabilities
- **Mixed trust domains**: Airport IT (passenger-facing), airport OT (baggage, fuel, lighting), airline systems, ground handler systems, and AV operator systems all converge on the apron

### 1.2 Attack Surface Enumeration

#### 1.2.1 Vehicle-Level Attack Surfaces

**CAN Bus Injection**

CAN (Controller Area Network) provides no authentication, encryption, or source identification by default. Any node on the bus can transmit any message ID, and all nodes receive all messages. For autonomous GSE with drive-by-wire interfaces, this means:

- **Physical access attack**: An attacker with momentary physical access to the vehicle (e.g., during maintenance, charging, or while parked in a GSE yard) can connect a CAN transceiver to inject arbitrary steering, throttle, and braking commands. The OBD-II diagnostic port, if present, provides direct CAN access. On GSE platforms, service connectors and exposed wiring harnesses in engine bays or undercarriage provide additional access points.
- **Compromised ECU pivot**: If any ECU on the CAN bus is compromised (e.g., the infotainment unit, telematics module, or a third-party aftermarket device), it can inject messages onto the bus to control safety-critical actuators. The 2015 Jeep Cherokee attack by Miller and Valasek demonstrated this attack chain: cellular modem to head unit to CAN bus to steering/braking.
- **Replay attacks**: CAN messages have no sequence numbers or timestamps. An attacker can record legitimate CAN traffic and replay it to reproduce specific vehicle behaviors.
- **Bus-off attacks**: By continuously transmitting dominant bits, an attacker can force legitimate ECUs into a bus-off error state, effectively disabling critical controllers.
- **Airside-specific risk**: GSE vehicles are often parked in semi-secure areas (GSE yards, charging stations) accessible to hundreds of ground handling personnel with airside badges. Physical access control is weaker than for aircraft or terminal systems.

**GPS/GNSS Spoofing**

Autonomous GSE relies on RTK-GNSS for centimeter-level localization. GPS spoofing attacks can:

- **Shift position estimate**: Gradually introduce position offsets to steer the vehicle off its planned path -- potentially into an aircraft, fuel hydrant, or jet blast zone. RTK-GNSS uses correction signals from a base station, but if the rover receiver's L1/L2 signals are spoofed, the RTK solution can be corrupted.
- **Time manipulation**: GPS provides the primary time source for many vehicle systems. Time spoofing can desynchronize sensor fusion timestamps, corrupt dead reckoning, and invalidate TLS certificate validity checks.
- **Coordinated multi-vehicle attack**: All autonomous GSE at an airport likely share the same GNSS constellation view. A single sufficiently powerful spoofer could simultaneously affect the entire fleet.
- **Cost of attack**: Commercial GPS spoofers capable of affecting civilian L1 receivers are available for under $500. More sophisticated L1/L2 spoofers that can defeat basic anti-spoofing (RAIM) cost $5,000-$50,000 -- well within the budget of state-level actors or organized groups.
- **Airside-specific risk**: Airport aprons are open-air environments with clear sky view, making GPS reception strong but also making spoofing effective. The flat, unobstructed terrain provides ideal conditions for a spoofer positioned in a nearby vehicle or building.

**Sensor Spoofing (LiDAR, Camera, Radar)**

Covered in detail in [Section 6](#6-sensor-security) and [Section 10](#10-published-attacks-on-av-systems).

**OTA Update Tampering**

Autonomous GSE receives over-the-air updates for perception models, planning algorithms, HD maps, and system software. Attack vectors include:

- **Man-in-the-middle on update channel**: Intercepting the update download and substituting a modified binary. If TLS is properly implemented with certificate pinning, this requires compromising the update server or a trusted CA.
- **Compromised update server**: Gaining access to the OTA backend infrastructure to push malicious updates fleet-wide. This is the highest-impact attack -- a single compromise can affect every vehicle simultaneously.
- **Rollback attacks**: Forcing the vehicle to revert to an older, known-vulnerable software version by manipulating version metadata.
- **Partial update corruption**: Corrupting an update mid-transfer to leave the vehicle in an inconsistent state, potentially with mismatched perception model and planning algorithm versions.
- **Supply chain injection**: Inserting malicious code or model weights during the CI/CD pipeline before the update is signed and distributed. This may occur at the developer workstation, build server, model training pipeline, or artifact repository.

**Cloud/Fleet Management API Compromise**

The fleet management backend (dispatch, teleoperation, monitoring) represents a centralized point of compromise:

- **API authentication bypass**: Gaining unauthorized access to fleet management APIs to issue commands (dispatch, emergency stop, route changes) to the entire fleet.
- **Teleoperation session hijack**: Taking over a teleoperation session to gain direct control of a vehicle. If the teleoperation link uses TLS 1.3 (as Fernride does), this requires compromising the teleoperator's workstation or the session management backend.
- **Geofence manipulation**: Modifying geofence boundaries in the fleet management system to allow vehicles to enter prohibited areas (active runways, fuel farms, restricted security zones).
- **Mission injection**: Creating fraudulent missions to direct vehicles to specific locations or along specific routes that conflict with aircraft movements.

#### 1.2.2 Network-Level Attack Surfaces

**5G/LTE Man-in-the-Middle**

Airport private 5G networks (e.g., DFW's Nokia CBRS deployment, Changi's private 5G for UISEE tractors) introduce network-level attack surfaces:

- **Rogue base station (IMSI catcher)**: A fake base station can force vehicles to downgrade from 5G to 4G or 3G, where encryption is weaker or optional. 5G's SUCI (Subscription Concealed Identifier) mitigates IMSI catching but does not prevent all downgrade attacks.
- **GTP tunnel manipulation**: In the 5G core network, GTP (GPRS Tunneling Protocol) tunnels carry user plane data. Compromise of the UPF (User Plane Function) or SMF (Session Management Function) could allow traffic interception.
- **MEC (Multi-access Edge Computing) compromise**: If the autonomous GSE stack uses MEC for offloaded computation (e.g., HD map updates, fleet coordination), compromising the MEC node provides access to vehicle data streams and the ability to inject modified data.
- **Network slicing attacks**: If the airport's private 5G uses network slicing to isolate AV traffic from passenger WiFi and IoT traffic, a misconfigured slice boundary could allow cross-slice data leakage.

**WiFi Attacks**

Many airports use WiFi 6/6E for backup or primary vehicle connectivity:

- **Evil twin AP**: Setting up a rogue access point with the same SSID as the legitimate airport WiFi to intercept vehicle traffic. WPA3-Enterprise with 802.1X and certificate-based authentication mitigates this, but many airport WiFi deployments still use WPA2.
- **Deauthentication attacks**: Flooding the vehicle's WiFi connection with deauth frames to force disconnection. WiFi 6 with Protected Management Frames (PMF/802.11w) mitigates this but does not eliminate it.
- **RF jamming**: The 2.4 GHz and 5 GHz bands are susceptible to broadband jamming. An attacker with a wideband jammer could disrupt all WiFi-connected vehicles simultaneously.

#### 1.2.3 Application-Level Attack Surfaces

**ROS/ROS2 Communication**

Most autonomous vehicle stacks (including those built on ROS Noetic or ROS2) use DDS (Data Distribution Service) or TCPROS for inter-process communication. By default:

- **ROS1 (Noetic)**: No built-in authentication or encryption. Any process that can reach the ROS master can subscribe to any topic (including `/vehicle/cmd_twist`) and publish to any topic (including injecting fake sensor data or control commands). Network access to the vehicle's internal network is sufficient for full control.
- **ROS2**: DDS supports SROS2 (Secure ROS2) with access control, authentication, and encryption via DDS Security plugins. However, SROS2 is rarely enabled in production due to performance overhead (10-30% latency increase on high-bandwidth topics like pointcloud data) and complexity of PKI management.
- **Airside-specific risk**: If the vehicle's internal network is reachable via the 5G/WiFi link (no proper network segmentation), a remote attacker could directly interact with ROS topics.

**Container/Orchestration Layer**

Modern AV stacks increasingly use Docker/Kubernetes for software deployment:

- **Container escape**: A vulnerability in the container runtime (e.g., CVE-2024-21626 in runc) could allow an attacker to escape from a compromised container to the host OS, gaining access to hardware interfaces including CAN bus.
- **Privileged containers**: AV containers frequently run in privileged mode or with `--net=host` to access hardware interfaces (CAN, serial ports, GPUs). This eliminates container isolation.
- **Image tampering**: If container images are pulled from a registry without content trust verification, a compromised registry can serve malicious images.

---

## 2. Aviation-Specific Cyber Threats

### 2.1 ADS-B Vulnerabilities and Proximity to Aircraft Systems

ADS-B (Automatic Dependent Surveillance -- Broadcast) is the primary surveillance system for air traffic control, and it operates on 1090 MHz without any authentication or encryption. This is a well-documented vulnerability:

- **ADS-B has no authentication**: Any device can broadcast ADS-B messages. An attacker can inject phantom aircraft into ATC displays, modify the apparent position of real aircraft, or suppress legitimate ADS-B signals.
- **Relevance to autonomous GSE**: Autonomous GSE may consume ADS-B data (directly or via A-CDM/SWIM feeds) to determine aircraft positions, predict taxi movements, and avoid active runways. If the GSE's situational awareness relies on ADS-B-derived data, spoofed ADS-B could cause the GSE to believe an aircraft is not present when it is (deletion attack) or that an aircraft is present where it is not (injection attack).
- **Research demonstrations**: Costin and Francillon (2012) demonstrated ADS-B spoofing using $2,000 of software-defined radio (SDR) equipment. Subsequent research has shown ghost aircraft injection, aircraft disappearance attacks, and flood denial-of-service against ADS-B receivers.
- **ICAO position**: ICAO has acknowledged ADS-B security vulnerabilities but has not mandated authentication, citing backward compatibility and cost constraints. The FAA's NextGen program and EUROCONTROL's SESAR do not include ADS-B authentication in current mandates.

### 2.2 Airport IT/OT Convergence

Modern airports are converging historically separate IT and OT networks, creating new attack paths:

**IT Systems (Airport Operations)**
- A-CDM (Airport Collaborative Decision Making) platforms
- Flight Information Display Systems (FIDS)
- Passenger processing (check-in, boarding, baggage)
- Airport operational databases (AODB)
- SWIM (System Wide Information Management) feeds

**OT Systems (Airside Operations)**
- Airfield lighting control (AGL)
- Fuel hydrant monitoring and control
- Baggage handling systems (BHS)
- Ground power units and pre-conditioned air
- Visual docking guidance systems (VDGS)
- Autonomous GSE fleet management

**Convergence risks:**
- **Shared network infrastructure**: If the autonomous GSE fleet management system shares network infrastructure with other OT systems (e.g., baggage handling, fuel control), compromise of one system could enable lateral movement to others. The DFW deployment explicitly uses a converged access approach routing both private 5G CBRS traffic and WiFi traffic through a single management platform.
- **A-CDM data feeds**: Autonomous GSE consumes turnaround data from A-CDM systems (TOBT, TSAT, stand allocation). If an attacker manipulates A-CDM data, they can misdirect autonomous vehicles to incorrect stands or activate them at incorrect times.
- **AODB integration**: Fleet management systems that integrate with the Airport Operational Database inherit the AODB's security posture. Many AODBs were designed decades ago without modern security considerations.

### 2.3 Insider Threat

The insider threat at airports is uniquely severe:

- **Scale of access**: A large hub airport may issue 50,000-100,000 airside badges. Every badge holder has physical proximity to autonomous GSE.
- **Contractor ecosystem**: Ground handling is performed by third-party contractors (Swissport, Menzies, dnata, etc.) with high staff turnover. Background checks vary by jurisdiction.
- **Maintenance personnel**: Vehicle maintenance staff have direct physical access to CAN buses, diagnostic ports, compute hardware, and network interfaces.
- **Social engineering**: Airport staff operate under time pressure during turnarounds, making them susceptible to social engineering attacks that could provide access to fleet management interfaces.

### 2.4 Electromagnetic Interference (EMI) Environment

Airport aprons are among the most RF-hostile environments:

- **Radar installations**: Airport surface detection equipment (ASDE), approach radar, and weather radar generate high-power RF emissions in bands that can interfere with vehicle sensors and communication systems.
- **Aircraft systems**: Active aircraft transponders, weather radar, TCAS, and communication radios create a dense RF environment.
- **Ground-based navigation aids**: ILS localizer and glide slope transmitters, VOR/DME, are high-power RF sources near runways and taxiways.
- **De-icing equipment**: Some de-icing systems use RF heating, adding to the interference environment.

While EMI is not a cyber attack per se, the noisy RF environment complicates the deployment of wireless security measures and can mask intentional jamming attacks within the ambient noise floor.

---

## 3. ISO/SAE 21434 -- Automotive Cybersecurity Engineering

### 3.1 Standard Overview

ISO/SAE 21434:2021, "Road vehicles -- Cybersecurity engineering," is the primary international standard for automotive cybersecurity. It was jointly developed by ISO and SAE International and published in August 2021. The standard defines cybersecurity requirements across the entire vehicle lifecycle -- from concept through development, production, operation, maintenance, and decommissioning.

**Key characteristics:**
- **Process-oriented**: Like ISO 26262 for functional safety, ISO 21434 is a process standard, not a prescriptive technical standard. It defines *what* must be done (risk assessment, security requirements, verification) but not *how* (no mandated encryption algorithms, key lengths, or specific technical solutions).
- **Risk-based**: The standard centers on TARA (Threat Analysis and Risk Assessment) as the core methodology for identifying, evaluating, and treating cybersecurity risks.
- **Lifecycle coverage**: Requirements span concept, development, production, operations, maintenance, and decommissioning.
- **Organizational requirements**: Mandates cybersecurity governance, including a cybersecurity management system, roles and responsibilities, competency requirements, and continuous improvement.
- **Supply chain**: Addresses distributed development across the automotive supply chain, requiring cybersecurity interface agreements between OEMs and suppliers.

### 3.2 Relationship to UNECE WP.29 R155/R156

ISO 21434 provides the technical framework for compliance with UNECE Regulation No. 155 (Cybersecurity and Cybersecurity Management System) and Regulation No. 156 (Software Update and Software Update Management System):

- **R155**: Requires vehicle manufacturers to implement a Cybersecurity Management System (CSMS) and demonstrate cybersecurity risk management for type approval. Mandatory for all new vehicle types in the EU since July 2022, and for all new vehicles produced since July 2024.
- **R156**: Requires a Software Update Management System (SUMS) covering OTA and physical update processes. Mandates secure update mechanisms including integrity verification, authenticity checks, and rollback protection.
- **Applicability to GSE**: UNECE R155/R156 formally apply to vehicles requiring type approval for road use. Airport GSE typically does not require road-type approval. However, airports and regulators increasingly reference these standards as benchmarks. Singapore's TR68 standard for autonomous vehicles explicitly requires ISO 21434 compliance. UISEE obtained ISO 21434 certification for its Changi Airport deployment.

### 3.3 TARA Methodology

TARA (Threat Analysis and Risk Assessment) is the central methodology of ISO 21434. It provides a structured process for identifying cybersecurity threats, assessing their risk, and determining appropriate treatments.

#### Step 1: Asset Identification

Identify all assets requiring cybersecurity protection:

| Asset Category | Examples for Autonomous GSE |
|---------------|---------------------------|
| **Safety-critical functions** | Steering, braking, throttle control, emergency stop |
| **Sensors** | LiDAR point clouds, camera images, radar returns, IMU data, GNSS signals |
| **Communication channels** | CAN bus, Ethernet backbone, 5G/WiFi uplink, teleoperation link |
| **Software** | Perception models, planning algorithms, localization, fleet management client |
| **Data** | HD maps, geofence definitions, operational logs, sensor recordings |
| **Cryptographic material** | TLS certificates, code signing keys, SecOC keys, API tokens |
| **Actuator interfaces** | Drive-by-wire commands, steering angle, brake pressure, indicator controls |

#### Step 2: Threat Identification

For each asset, identify potential threats using attack trees or STRIDE methodology:

**STRIDE applied to autonomous GSE:**

| Threat Category | Example |
|----------------|---------|
| **S**poofing | GPS spoofing to shift position; ADS-B spoofing to inject phantom aircraft; rogue base station impersonating legitimate 5G |
| **T**ampering | CAN bus message injection; OTA update modification; HD map corruption; adversarial patches on road markings |
| **R**epudiation | Denial of teleoperation commands sent; falsified operational logs to evade incident investigation |
| **I**nformation Disclosure | Exfiltration of airport layout data, aircraft positions, security patrol routes from sensor recordings |
| **D**enial of Service | RF jamming of 5G/WiFi; CAN bus flooding; DDoS on fleet management API; sensor blinding |
| **E**levation of Privilege | Container escape to host OS; ROS topic injection via network access; compromise of fleet management admin account |

#### Step 3: Impact Assessment

ISO 21434 defines four impact categories, each rated on a severity scale:

| Impact Category | Rating Scale | Autonomous GSE Considerations |
|----------------|-------------|-------------------------------|
| **Safety** | Negligible / Moderate / Major / Severe | Aircraft collision = Severe. Personnel injury = Major/Severe. Vehicle damage only = Moderate. |
| **Financial** | Negligible / Moderate / Major / Severe | Aircraft damage = Severe ($100M+). Fleet-wide operational halt = Major. Single vehicle downtime = Moderate. |
| **Operational** | Negligible / Moderate / Major / Severe | Airport-wide ground stop = Severe. Multi-stand disruption = Major. Single stand delay = Moderate. |
| **Privacy** | Negligible / Moderate / Major / Severe | Aircraft security footage leaked = Major. Passenger images captured = Moderate (GDPR). |

#### Step 4: Attack Feasibility Assessment

ISO 21434 offers multiple methods for assessing attack feasibility. The most commonly used is the attack potential-based approach, evaluating:

| Factor | Values |
|--------|--------|
| **Elapsed time** | < 1 day / < 1 week / < 1 month / < 6 months / > 6 months |
| **Specialist expertise** | Layman / Proficient / Expert / Multiple experts |
| **Knowledge of target** | Public / Restricted / Confidential / Strictly confidential |
| **Window of opportunity** | Unlimited / Easy / Moderate / Difficult |
| **Equipment** | Standard / Specialized / Bespoke / Multiple bespoke |

Each factor is scored, and the sum determines the attack feasibility level: High / Medium / Low / Very Low.

**Example TARA entry for autonomous GSE:**

| Threat | Asset | Impact (S/F/O/P) | Feasibility | Risk Level | Treatment |
|--------|-------|-------------------|-------------|------------|-----------|
| CAN bus injection via diagnostic port | Steering actuator | Severe/Severe/Major/Neg | Medium (physical access required, standard equipment, expert knowledge) | Critical | SecOC, physical port lockout, CAN IDS |
| GPS spoofing | RTK-GNSS localization | Severe/Major/Major/Neg | High (commodity hardware, public knowledge, unlimited opportunity) | Critical | Multi-constellation, IMU cross-check, map-based anomaly detection |
| OTA update tampering | Perception model | Severe/Major/Major/Neg | Low (requires server compromise or MITM with valid cert) | High | Code signing, dual-signature, hash chain verification |
| Teleoperation hijack | Vehicle control | Severe/Severe/Major/Neg | Medium (requires session token or credential theft) | Critical | TLS 1.3, mutual authentication, session binding |
| ADS-B data spoofing | Aircraft position awareness | Severe/Severe/Severe/Neg | High (commodity SDR, public protocol, unlimited opportunity) | Critical | Multi-source correlation, visual/LiDAR cross-validation |
| Rogue 5G base station | Fleet communication | Major/Major/Major/Moderate | Medium (specialized equipment, expert knowledge) | High | SIM-based mutual auth, network monitoring, certificate pinning |
| Adversarial LiDAR spoofing | Obstacle detection | Severe/Major/Major/Neg | Medium (specialized equipment, expert knowledge, limited window) | High | Multi-sensor cross-validation, temporal consistency checks |
| Fleet API credential theft | Fleet management | Major/Major/Severe/Neg | Medium (phishing, credential stuffing) | High | MFA, API key rotation, IP allowlisting, RBAC |

#### Step 5: Risk Treatment

ISO 21434 defines four treatment options:
1. **Avoid**: Eliminate the threat by removing the vulnerable asset or function
2. **Reduce**: Implement cybersecurity controls to lower risk (most common)
3. **Transfer**: Share risk through insurance, contractual agreements, or third-party services
4. **Accept**: Acknowledge and document residual risk (requires justification)

### 3.4 Applicability to Airport GSE

ISO 21434 is formally scoped to "road vehicles" (Section 1, Scope). Airport GSE is not a road vehicle. However:

- **Singapore TR68** explicitly requires ISO 21434 compliance for autonomous vehicles, including those operating at airports. UISEE obtained ISO 21434 certification for its Changi deployment.
- **UNECE R155** is referenced by EU type-approval regulations. While GSE does not require road-type approval, airport operators and insurers increasingly require ISO 21434 as a baseline cybersecurity assurance.
- **ISO 3691-4** (driverless industrial trucks) does not address cybersecurity in depth. ISO 21434 fills this gap.
- **Voluntary adoption**: Just as ISO 26262 (formally scoped to road vehicles) is voluntarily adopted for airport GSE safety engineering, ISO 21434 should be voluntarily adopted for cybersecurity engineering. The TARA methodology is directly applicable regardless of the vehicle's operating domain.

### 3.5 Cybersecurity Management System (CSMS)

ISO 21434 requires an organization-level CSMS that includes:

- **Cybersecurity policy**: Management commitment, scope, objectives
- **Organizational rules and processes**: Defined roles (Cybersecurity Manager, Cybersecurity Architect), training requirements, competency management
- **Cybersecurity culture**: Awareness programs, reporting mechanisms, lessons learned
- **Information sharing**: Participation in Auto-ISAC (Automotive Information Sharing and Analysis Center) or equivalent aviation-sector ISACs
- **Cybersecurity monitoring**: Continuous monitoring for new vulnerabilities (CVE tracking), threat intelligence feeds, field incident analysis
- **Incident response**: Defined procedures for cybersecurity incident detection, analysis, containment, and recovery (see [Section 9](#9-incident-response))

---

## 4. EASA Cybersecurity Requirements

### 4.1 Current Regulatory Landscape

EASA (European Union Aviation Safety Agency) has been progressively developing cybersecurity requirements for aviation systems:

**Part-IS (Information Security) -- Regulation (EU) 2023/203:**

Published in February 2023, Part-IS establishes information security requirements for aviation organizations. Key provisions:

- **Scope**: Applies to organizations involved in civil aviation -- airlines, airports, ATM/ANS providers, and design/production organizations. The regulation covers the protection of information and information systems from cybersecurity threats that could affect aviation safety.
- **Information Security Management System (ISMS)**: Organizations must establish, implement, maintain, and continuously improve an ISMS. This aligns with ISO 27001 but is tailored to aviation-specific risks.
- **Risk assessment**: Organizations must identify information security risks to aviation safety and implement proportionate measures. The risk assessment must consider threats to the confidentiality, integrity, and availability of data and systems.
- **Incident reporting**: Mandatory reporting of information security incidents that have or could have an impact on aviation safety. Reports go to the competent authority (national aviation authority) and EASA.
- **Supply chain**: Organizations must ensure that their suppliers and subcontractors meet information security requirements through contractual agreements and oversight.
- **Compliance timeline**: Large organizations -- compliance required by February 2025. Small organizations -- compliance required by February 2026.

**Applicability to autonomous GSE:**
- Part-IS applies to "organisations involved in civil aviation." An autonomous GSE operator providing services at an airport falls within scope if the airport authority or national aviation authority determines that the GSE operation could affect aviation safety.
- An autonomous tractor operating near aircraft with no human on board almost certainly falls within scope -- a cybersecurity compromise leading to loss of vehicle control poses a direct threat to aircraft safety.
- The regulation's risk-based approach means that the depth of ISMS requirements scales with the risk profile. Autonomous GSE near aircraft = high risk = comprehensive ISMS required.

### 4.2 EASA AI Trustworthiness Framework

EASA is developing an AI trustworthiness framework through rulemaking task RMT.0742:

- **NPA 2025-07** (Notice of Proposed Amendment): Published in 2025, provides technical guidance for AI trustworthiness aligned with the EU AI Act. Focuses on airborne AI systems initially but establishes principles applicable across aviation domains.
- **Cybersecurity of AI/ML**: NPA 2025-07 addresses the cybersecurity of AI/ML systems specifically, including:
  - Adversarial robustness of ML models (resistance to adversarial inputs)
  - Data integrity for training and inference data
  - Model integrity verification (detecting tampering with model weights)
  - Secure model deployment and update mechanisms
- **Timeline**: Second NPA planned for 2026 to extend the framework to specific aviation domain regulations. Consolidation expected by 2028.

### 4.3 EU NIS2 Directive

The NIS2 Directive (Directive (EU) 2022/2555), which entered into force in January 2023 with member state transposition required by October 2024, significantly expands cybersecurity requirements for critical infrastructure:

- **Transport sector**: Air transport is explicitly listed as a sector of high criticality. This covers airports, air carriers, and traffic management.
- **Supply chain security**: NIS2 requires covered entities to address cybersecurity risks in their supply chains. An airport covered by NIS2 must assess the cybersecurity posture of its autonomous GSE operator as part of its supply chain risk management.
- **Incident reporting**: Mandatory reporting of significant cybersecurity incidents within 24 hours (early warning), 72 hours (incident notification), and 1 month (final report).
- **Management accountability**: Senior management of covered entities can be held personally liable for cybersecurity failures.
- **Penalties**: Up to EUR 10 million or 2% of annual global turnover for essential entities.

### 4.4 EU Cyber Resilience Act (CRA)

The Cyber Resilience Act (Regulation (EU) 2024/2847), adopted in late 2024, establishes horizontal cybersecurity requirements for products with digital elements:

- **Scope**: Applies to hardware and software products placed on the EU market. Autonomous GSE with connected software components falls within scope.
- **Security by design**: Manufacturers must design products with security in mind, conduct risk assessments, and provide security updates for the expected product lifetime (minimum 5 years or the product's lifetime, whichever is longer).
- **Vulnerability handling**: Manufacturers must establish a coordinated vulnerability disclosure process and actively monitor for vulnerabilities throughout the product lifecycle.
- **Compliance**: Conformity assessment required before products can be placed on the market. Critical products (Class II) require third-party assessment.
- **Timeline**: Application begins in 2027, with vulnerability reporting obligations starting in 2026.

---

## 5. Secure Communication

### 5.1 TLS 1.3 for Teleoperation and Fleet Management

TLS 1.3 (RFC 8446, published August 2018) is the minimum acceptable transport layer security for autonomous GSE communication. Key improvements over TLS 1.2:

**Performance:**
- **1-RTT handshake**: TLS 1.3 completes the handshake in a single round-trip (versus 2 RTTs for TLS 1.2), reducing connection setup latency by 50-100ms -- critical for teleoperation where end-to-end latency budgets are under 100ms.
- **0-RTT resumption**: For reconnections (e.g., after brief network interruptions during vehicle movement between coverage zones), TLS 1.3 supports 0-RTT data transmission using pre-shared keys. The vehicle can resume sending telemetry immediately without waiting for a full handshake. Caveat: 0-RTT data is susceptible to replay attacks and should not be used for control commands.

**Security:**
- **Removed weak algorithms**: TLS 1.3 eliminates RC4, DES, 3DES, MD5, SHA-1, static RSA key exchange, and CBC-mode ciphers. Only AEAD cipher suites are permitted: AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305.
- **Forward secrecy mandatory**: All TLS 1.3 connections use ephemeral Diffie-Hellman (ECDHE or DHE) key exchange, ensuring that compromise of long-term keys does not compromise past session data. This is critical for protecting recorded teleoperation sessions.
- **Encrypted handshake**: Server certificate and extensions are encrypted, preventing passive observation of which server the vehicle is connecting to.

**Implementation for autonomous GSE:**

| Communication Path | TLS Configuration | Authentication |
|-------------------|-------------------|----------------|
| Vehicle to fleet management API | TLS 1.3 with mutual authentication (mTLS) | Client certificate per vehicle + server certificate |
| Vehicle to teleoperation station | TLS 1.3 with mTLS + session binding | Client certificate + session token + operator authentication |
| Vehicle to OTA update server | TLS 1.3 with certificate pinning | Pinned server certificate + code signing on payload |
| Fleet management dashboard (web) | TLS 1.3 | Server certificate + operator MFA |
| Vehicle-to-vehicle (V2V) | DTLS 1.3 (datagram TLS) or TLS 1.3 over QUIC | Mutual certificate authentication |

**Fernride's implementation**: Fernride uses TLS 1.3 for all communication between their vehicle kit and the operations control station. Their uRLLC protocol runs over this encrypted link, achieving end-to-end latency under 100ms on 4G/LTE. Dual routers with VPN/LTE failover ensure connectivity redundancy without compromising encryption.

### 5.2 Encrypted CAN (AUTOSAR SecOC)

AUTOSAR Secure Onboard Communication (SecOC) adds authentication to CAN bus messages without requiring a complete redesign of the CAN architecture:

**How SecOC works:**
- Each CAN message is appended with a truncated Message Authentication Code (MAC), typically 24-64 bits, computed using a shared symmetric key (typically AES-128-CMAC).
- A monotonic freshness counter prevents replay attacks. The freshness value is either transmitted explicitly or synchronized between sender and receiver.
- The receiver verifies the MAC before processing the message. Messages with invalid MACs are discarded and logged.

**Limitations:**
- **Bandwidth overhead**: The MAC and freshness value consume 3-8 bytes of the already limited 8-byte CAN payload (Classic CAN) or 64-byte CAN FD payload. CAN FD is strongly recommended for SecOC deployment.
- **Latency**: MAC computation and verification add 50-200 microseconds per message, depending on hardware cryptographic accelerator availability.
- **Key management**: Symmetric keys must be provisioned to every ECU and rotated periodically. Key compromise on any ECU exposes the key for all messages that ECU authenticates.
- **Legacy ECU compatibility**: SecOC requires ECU firmware updates. Legacy ECUs that cannot be updated remain unprotected attack surfaces.

**Applicability to autonomous GSE:**
- GSE platforms are often based on industrial vehicle platforms (e.g., TLD tow tractors) with simple CAN architectures. Retrofitting SecOC requires updating the ECU firmware on all CAN nodes, which may be impractical for legacy platforms.
- For new-build autonomous GSE, SecOC should be specified as a requirement for all safety-critical CAN communication (steering, braking, throttle).
- CAN FD adoption is recommended to accommodate SecOC overhead without sacrificing payload capacity for vehicle data.

### 5.3 Automotive Ethernet Security

Modern autonomous vehicles increasingly use Automotive Ethernet (100BASE-T1, 1000BASE-T1) for high-bandwidth sensor data (cameras, LiDAR). Security options include:

- **MACsec (IEEE 802.1AE)**: Link-layer encryption and authentication for Ethernet. Provides hop-by-hop security with AES-GCM-256 encryption and integrity protection. Minimal latency overhead (< 1 microsecond per frame on hardware-accelerated switches).
- **IPsec**: Network-layer encryption for IP traffic. Higher overhead than MACsec but provides end-to-end security across multiple network segments.
- **Network segmentation (VLANs)**: Separating safety-critical vehicle control traffic from non-critical traffic (diagnostics, logging, infotainment) using IEEE 802.1Q VLANs with strict access control lists.

### 5.4 5G Security Features

Private 5G networks deployed at airports (DFW, Changi) provide several built-in security mechanisms:

| Feature | Description | Relevance to Autonomous GSE |
|---------|-------------|---------------------------|
| **SUCI** | Subscription Concealed Identifier -- encrypts IMSI to prevent tracking | Prevents attacker from identifying specific vehicles by their cellular identity |
| **256-bit encryption** | 5G supports NEA1 (SNOW), NEA2 (AES), NEA3 (ZUC) with 256-bit keys | Stronger than 4G's 128-bit encryption for user plane data |
| **Integrity protection (UP)** | 5G optionally supports user plane integrity protection (NIA algorithms) | Prevents modification of in-transit data -- critical for teleoperation commands |
| **Network slicing isolation** | Logical separation of network resources per slice | Isolates AV traffic from passenger WiFi and IoT devices |
| **SEPP** | Security Edge Protection Proxy -- secures inter-PLMN communication | Relevant if vehicles roam between airport's private network and public MNO |
| **SBA security** | Service-Based Architecture with OAuth 2.0 between network functions | Secures the 5G core network against internal compromise |

**Recommendation for airport private 5G:**
- Enable user plane integrity protection (disabled by default in many deployments due to performance impact)
- Deploy a dedicated network slice for autonomous GSE with strict QoS and security policies
- Implement SIM-based mutual authentication with per-vehicle SIM profiles
- Monitor for rogue base stations using RF spectrum scanning

### 5.5 Certificate Management

A PKI (Public Key Infrastructure) is required to manage certificates for TLS, code signing, SecOC key distribution, and device identity:

**Certificate hierarchy for autonomous GSE fleet:**

```
Root CA (offline, HSM-protected)
├── Vehicle Issuing CA
│   ├── Vehicle 001 client certificate (mTLS)
│   ├── Vehicle 002 client certificate (mTLS)
│   └── ...
├── Server Issuing CA
│   ├── Fleet management API server certificate
│   ├── OTA update server certificate
│   └── Teleoperation relay server certificate
├── Code Signing CA
│   ├── Software release signing key
│   └── Model release signing key
└── Operator Issuing CA
    ├── Teleoperator 001 client certificate
    ├── Teleoperator 002 client certificate
    └── ...
```

**Key management requirements:**
- **Hardware Security Modules (HSMs)**: Root CA and issuing CA private keys must be stored in FIPS 140-2 Level 3 (or higher) HSMs. Vehicle-side, a TPM (Trusted Platform Module) or secure element should store the vehicle's private key.
- **Certificate rotation**: Vehicle certificates should be rotated at least annually. Short-lived certificates (30-90 days) with automated renewal via ACME protocol or EST (Enrollment over Secure Transport) reduce the window of exposure from key compromise.
- **Certificate revocation**: OCSP (Online Certificate Status Protocol) stapling for server certificates. For vehicle certificates, CRL (Certificate Revocation List) distribution via the OTA channel with delta CRL updates.
- **Offline operation**: Vehicles must be able to authenticate locally (e.g., using cached OCSP responses or CRLs) when network connectivity is temporarily unavailable. Certificate validity periods must account for the maximum expected offline duration.

---

## 6. Sensor Security

### 6.1 LiDAR Spoofing Attacks

LiDAR spoofing is the most extensively researched sensor attack against autonomous vehicles. The attack exploits the fact that LiDAR sensors measure distance by emitting laser pulses and timing the return -- an attacker can inject additional laser pulses that the sensor interprets as legitimate returns.

**Attack mechanisms:**

| Attack Type | Method | Effect | Demonstrated By |
|------------|--------|--------|----------------|
| **Relay attack** | Capture legitimate LiDAR pulses and retransmit them with modified timing | Inject phantom objects at arbitrary distances | Shin et al. (2017), "Illusion and Dazzle" |
| **Saturation attack** | Flood the sensor with high-intensity laser light | Blind the sensor, creating a shadow region where real objects are invisible | Petit et al. (2015) |
| **Spoofed point injection** | Synchronize with the LiDAR's scan pattern and inject pulses at precise timings | Create phantom 3D objects (e.g., fake vehicles, pedestrians, walls) | Cao et al. (2019), "Adversarial Objects Against LiDAR-Based AV Perception" |
| **Object removal** | Inject points that cause the perception system to merge a real object with background | Remove real objects from the perception output | Sun et al. (2020) |
| **Adversarial point cloud** | Inject carefully crafted point patterns that exploit ML model vulnerabilities | Cause misclassification (e.g., vehicle classified as background) | Tu et al. (2020), "Physically Realizable Adversarial Examples" |

**Key research results:**

- **Cao et al. (2019)**: Demonstrated spoofing attacks against LiDAR-based perception in Baidu Apollo. Successfully injected phantom obstacles at distances of 5-15 meters, causing the AV to emergency brake. Also demonstrated removal of real obstacles from perception output.
- **Sun et al. (2020)**: Showed that adversarial point cloud perturbations could cause PointPillars and PointRCNN detectors to miss real vehicles. The attack required injecting only 20-60 adversarial points.
- **Jin et al. (2023)**: Demonstrated "PLA-LiDAR" -- a physically realizable LiDAR spoofing attack using a commercial laser and photodetector to inject up to 100 spoofed points per scan at distances up to 100 meters. The attack successfully fooled Velodyne VLP-16 and achieved a 90%+ success rate against PointPillars detection.
- **Hau et al. (2021)**: Introduced "Shadow-Catcher," demonstrating that LiDAR spoofing can create persistent shadow artifacts that confuse temporal fusion algorithms (multi-frame detection).

**Defenses:**

| Defense | Mechanism | Effectiveness | Limitations |
|---------|-----------|---------------|-------------|
| **Pulse fingerprinting** | Each LiDAR unit has unique pulse characteristics; verify returning pulses match emitted ones | High against relay attacks | Requires hardware modification; does not defend against sophisticated spoofers that replicate pulse characteristics |
| **Randomized scan patterns** | Randomize the firing sequence of LiDAR channels to prevent synchronization | Moderate | Reduces attacker's ability to predict timing; some scan randomization already used in Hesai and Ouster sensors |
| **Multi-sensor cross-validation** | Compare LiDAR detections with camera and radar detections; flag objects seen by LiDAR only | High | Requires robust fusion pipeline; can be defeated if multiple sensors are simultaneously attacked |
| **Temporal consistency** | Track objects across multiple frames; flag sudden appearances/disappearances | Moderate-High | Legitimate sudden appearances (e.g., vehicle emerging from behind aircraft) must be handled |
| **SVDD (Support Vector Data Description)** | Train an anomaly detector on legitimate point cloud characteristics | Moderate | May false-positive on unusual but legitimate objects (FOD, unusual GSE) |
| **Physical shielding** | Optical filters that pass only the LiDAR's specific wavelength | Low-Moderate | Attackers can use the same wavelength; filters reduce field of view |

**Airside-specific considerations:**
- Airport aprons have relatively controlled traffic patterns, making temporal consistency checks more effective -- an object appearing suddenly in the middle of an open stand area is more anomalous than the same event on a public road.
- The geofenced operating environment allows tighter anomaly detection thresholds -- a "phantom vehicle" outside of known vehicle paths can be flagged with higher confidence.
- Multi-sensor cross-validation is the strongest defense. If a LiDAR detects an object but the camera and radar do not corroborate it, the perception system should flag it as potentially spoofed rather than treating it as ground truth.

### 6.2 Camera Adversarial Attacks

Camera-based perception is vulnerable to both physical and digital adversarial attacks:

**Physical adversarial attacks:**

| Attack | Method | Effect | Reference |
|--------|--------|--------|-----------|
| **Adversarial patches** | Printed patches placed on objects to cause misclassification | Stop sign classified as speed limit sign; pedestrian rendered invisible | Eykholt et al. (2018), "Robust Physical-World Attacks on Deep Learning Models" |
| **Adversarial projections** | Projected light patterns on road surfaces or objects | Create phantom lane markings, fake traffic signs | Nassi et al. (2020), "Phantom of the ADAS" |
| **Adversarial textures** | Modified object textures that fool 3D object detectors | Vehicle rendered invisible to camera-based detection | Wang et al. (2021) |
| **Infrared attacks** | IR LED arrays invisible to human eye but visible to cameras | Create phantom or mask real objects in camera feeds | Zhou et al. (2018) |

**Airside-specific risks:**
- **Adversarial patches on GSE**: An attacker could apply adversarial patches to equipment or surfaces in the GSE operating area to cause misclassification. Unlike public roads where adversarial patches must survive weather and viewing angle variation, the controlled airport environment with known camera positions makes attacks more precise.
- **Reflective aircraft surfaces**: Aircraft fuselage reflections can create strong visual artifacts. While not adversarial attacks, they share similar failure modes with adversarial perturbations and can be exploited by an attacker who understands the perception system's vulnerabilities.
- **High-visibility vest exploitation**: Ground crew wear high-visibility clothing that creates strong visual features. An adversarial attack exploiting these patterns could potentially cause a pedestrian detector to fail on a specific vest pattern.

**Defenses:**
- **Adversarial training**: Include adversarial examples in the training dataset to improve model robustness. Models trained with PGD (Projected Gradient Descent) adversarial training show 30-50% improvement in robustness, but with a 1-3% decrease in clean accuracy.
- **Input preprocessing**: JPEG compression, spatial smoothing, and feature squeezing can destroy adversarial perturbations, but also degrade legitimate image quality.
- **Multi-view consistency**: If multiple cameras observe the same object, adversarial patches effective from one viewing angle are typically ineffective from others. BEV-based perception architectures that fuse multiple camera views inherently provide this defense.
- **Certified defenses**: Randomized smoothing provides provable robustness guarantees within a certified radius, but the certified radius is typically too small to defend against large physical perturbations.

### 6.3 Radar Jamming and Spoofing

Automotive radar (77-81 GHz FMCW) is considered the most difficult sensor to spoof due to the complexity of generating coherent FMCW waveforms. However:

- **Jamming**: Broadband noise generators can effectively blind radar sensors. The 77-81 GHz band is relatively narrow, and jamming equipment is commercially available.
- **Relay spoofing**: Capturing and retransmitting radar signals with modified delay to inject phantom targets at specific ranges. Demonstrated by Yan et al. (2016).
- **FMCW slope spoofing**: Generating a signal with the same chirp slope as the victim radar but with a modified start frequency to create phantom targets with arbitrary range and velocity. More sophisticated than simple jamming but demonstrated in laboratory conditions.

**Radar's advantage as a defense**: Radar is less susceptible to spoofing than LiDAR or GPS because:
- The 77-81 GHz band requires specialized hardware to generate coherent signals
- FMCW waveform parameters (chirp slope, bandwidth, repetition rate) vary between manufacturers
- Radar is unaffected by adversarial patches, lighting conditions, and most weather
- Radar provides independent velocity measurement via Doppler, which is difficult to spoof consistently with position

This makes radar the strongest cross-validation sensor against LiDAR and camera spoofing attacks.

### 6.4 Multi-Sensor Cross-Validation as Defense

The strongest defense against sensor spoofing is cross-validation between heterogeneous sensor modalities. An object that appears in one sensor modality but not others is suspicious; an object that appears consistently across all modalities is very likely real.

**Cross-validation matrix:**

| Detection | LiDAR Confirms | Camera Confirms | Radar Confirms | Confidence |
|-----------|---------------|-----------------|----------------|------------|
| LiDAR only | N/A | No | No | Low -- potential spoofing or sensor artifact |
| Camera only | No | N/A | No | Low -- potential adversarial attack or visual artifact |
| Radar only | No | No | N/A | Low -- potential ghost return or multipath |
| LiDAR + Camera | Yes | Yes | No | Medium-High -- radar may not detect (small object, low RCS) |
| LiDAR + Radar | Yes | No | Yes | Medium-High -- camera may miss (occlusion, lighting) |
| Camera + Radar | No | Yes | Yes | Medium-High -- LiDAR may miss (dark surface, range) |
| All three | Yes | Yes | Yes | Very High -- extremely difficult to simultaneously spoof |

**Implementation approach:**
1. Run independent detection pipelines for each sensor modality
2. Associate detections across modalities using spatial and temporal alignment
3. Assign a spoofing confidence score based on cross-modal consistency
4. For objects detected by only one modality, apply additional scrutiny: temporal consistency (tracked across multiple frames?), physical plausibility (consistent velocity, realistic size?), contextual plausibility (expected in this location given the airport layout?)
5. Safety-critical decisions (emergency stop, path deviation) should require corroboration from at least two independent sensor modalities

---

## 7. Software Supply Chain Security

### 7.1 The Expanding Attack Surface

The software supply chain for autonomous vehicles is extraordinarily complex:

- **ML frameworks**: PyTorch, TensorFlow, ONNX Runtime -- each with thousands of transitive dependencies
- **Perception model dependencies**: Pre-trained backbone models (ResNet, ViT), tokenizers, custom CUDA kernels
- **ROS ecosystem**: Hundreds of ROS packages from community repositories
- **Operating system**: Ubuntu/Linux kernel, device drivers, firmware
- **Container infrastructure**: Docker images, base images, runtime libraries
- **Third-party data**: HD maps, traffic rules databases, airport layout databases

The 2020 SolarWinds attack and the 2021 Log4Shell vulnerability demonstrated that supply chain attacks can compromise even well-secured organizations. For autonomous vehicles, a supply chain compromise could introduce vulnerabilities into safety-critical systems.

### 7.2 Dependency Management

**Pinning and locking:**
- All dependencies must be pinned to exact versions (no floating version ranges like `^1.2.3` or `>=2.0`)
- Use lockfiles (`poetry.lock`, `Pipfile.lock`, `package-lock.json`) committed to version control
- Verify dependency integrity using cryptographic hashes (pip `--require-hashes`, npm `integrity` field)

**Vulnerability scanning:**
- Continuous automated scanning of all dependencies against CVE databases (NVD, OSV, GitHub Advisory Database)
- Tools: Snyk, Grype, Trivy, `pip-audit`, `npm audit`
- Define a maximum allowable vulnerability age: critical CVEs must be patched within 48 hours; high CVEs within 7 days; medium CVEs within 30 days

**Private registry:**
- Host critical dependencies in a private artifact repository (Artifactory, Nexus, AWS CodeArtifact)
- Proxy public registries through the private registry with integrity verification
- Prevent dependency confusion attacks by reserving internal package names on public registries

### 7.3 Container Security

**Image hardening:**
- Use minimal base images (distroless, Alpine) to reduce attack surface
- Run containers as non-root users wherever possible (note: many AV containers require root or privileged access for hardware interfaces -- minimize and document these exceptions)
- Use read-only filesystem mounts for application code
- Scan container images for vulnerabilities before deployment (Trivy, Clair, Snyk Container)

**Runtime security:**
- Deploy container runtime security (Falco, Sysdig Secure) to detect anomalous behavior (unexpected process execution, file access, network connections)
- Use seccomp profiles and AppArmor/SELinux policies to restrict container capabilities
- Monitor for container escape attempts (unexpected host namespace access, privileged escalation)

**Supply chain integrity:**
- Sign container images using Cosign (Sigstore) or Docker Content Trust (Notary)
- Enforce image signature verification at deployment time -- reject unsigned or untrusted images
- Maintain a Software Bill of Materials (SBOM) for every deployed container image in SPDX or CycloneDX format

### 7.4 Model Integrity Verification

ML model weights are a unique supply chain risk. A tampered model could pass standard functional tests while containing backdoors that activate only on specific inputs:

**Threats:**
- **Backdoor attacks (Trojans)**: An attacker modifies the training data or training process to embed a backdoor trigger. When the trigger pattern appears in inference input, the model produces attacker-controlled output. Example: a perception model that ignores pedestrians wearing a specific pattern.
- **Weight tampering**: Direct modification of model weight files to introduce subtle behavior changes that are difficult to detect through standard test suites.
- **Training data poisoning**: Corrupting training data to bias the model. For autonomous GSE, poisoning could cause the model to systematically misjudge distances to aircraft or fail to detect specific GSE types.

**Defenses:**
- **Cryptographic hashing**: Compute SHA-256 hashes of model weight files at training time and verify before deployment. Store hashes in a tamper-evident log (append-only database or blockchain-anchored timestamp).
- **Code signing for models**: Sign model artifacts using the Code Signing CA. Verify signatures on-vehicle before loading models into inference engines.
- **Neural Cleanse and similar backdoor detection**: Run automated backdoor detection tools on trained models before deployment. Neural Cleanse (Wang et al., 2019) identifies potential trigger patterns by reverse-engineering minimal input perturbations that cause class changes.
- **Model behavioral monitoring**: Continuously monitor model outputs in production for distribution shifts that could indicate tampering. Compare production inference distributions against validated reference distributions.
- **Reproducible training**: Maintain deterministic training pipelines so that models can be independently reproduced from source data and code. Any discrepancy between reproduced and deployed model weights indicates potential tampering.

### 7.5 Code Signing and Secure Boot

**Secure boot chain:**

```
1. Hardware Root of Trust (TPM / Secure Element)
   ├── Verifies: UEFI firmware signature
   │
2. UEFI Firmware
   ├── Verifies: Bootloader signature (GRUB / systemd-boot)
   │
3. Bootloader
   ├── Verifies: Linux kernel signature + initramfs hash
   │
4. Linux Kernel
   ├── Verifies: Kernel module signatures (dm-verity for rootfs)
   │
5. Init System
   ├── Verifies: Container image signatures
   │
6. AV Application Stack
   ├── Verifies: Model weight hashes + configuration signatures
   │
7. OTA Update Agent
   └── Verifies: Update package dual-signature (developer + release manager)
```

**Dual-signature OTA updates**: Require two independent signatures for any OTA update -- one from the development team (CI/CD pipeline) and one from the release management team. This prevents a single compromised credential from pushing malicious updates fleet-wide.

---

## 8. Data Security and Privacy

### 8.1 Sensitive Data Captured by Airside AVs

Autonomous GSE operating on airport aprons continuously captures sensor data that may include:

| Data Type | Sensitivity | Regulatory Concern |
|-----------|------------|-------------------|
| **Aircraft positions and movements** | High -- reveals airline operations, military aircraft presence, VIP movements | National security; export control (ITAR for some airports); airline commercial confidentiality |
| **Security patrol patterns** | High -- reveals airport security coverage gaps and response times | Airport security; could be exploited for physical attack planning |
| **Passenger images** | Medium-High -- passengers boarding/deplaning may be captured by vehicle cameras | GDPR Article 6 (lawful basis for processing); GDPR Article 9 if biometric data extracted |
| **Ground crew identification** | Medium -- faces, badge numbers, and movements of ground crew | GDPR; employment law; union agreements |
| **Aircraft registration and livery** | Medium -- identifies specific aircraft and operators | Commercial confidentiality; some military/government aircraft registrations are sensitive |
| **Fuel operations** | Medium -- reveals fuel delivery patterns, volumes, and infrastructure | Critical infrastructure protection |
| **Baggage and cargo handling** | Medium -- may capture baggage tag data, cargo labels | Data protection; customs regulations |
| **Airport infrastructure layout** | Medium -- detailed 3D mapping of airside infrastructure | Physical security; classified in some jurisdictions |

### 8.2 GDPR and Data Protection

For operations in the EU/UK, GDPR imposes strict requirements on processing personal data:

**Lawful basis for processing:**
- **Legitimate interests (Article 6(1)(f))**: The AV operator can argue that sensor data capture is necessary for the legitimate interest of safe autonomous operation. A Legitimate Interest Assessment (LIA) must be documented, weighing the operator's interest against the data subjects' privacy rights.
- **Data minimization (Article 5(1)(c))**: Capture only the data necessary for safe operation. If high-resolution camera images are not required for the perception task, reduce resolution. If facial features are not needed, apply real-time anonymization (face blurring) before storage.
- **Purpose limitation (Article 5(1)(b))**: Data captured for safe vehicle operation must not be repurposed for surveillance, employee monitoring, or marketing without separate lawful basis.
- **Storage limitation (Article 5(1)(e))**: Define and enforce data retention periods. Sensor data not flagged for safety review or model training should be deleted within 72 hours to 30 days, depending on the data type and retention policy.

**Data Protection Impact Assessment (DPIA):**
- GDPR Article 35 requires a DPIA for processing that is "likely to result in a high risk to the rights and freedoms of natural persons."
- Systematic monitoring of publicly accessible areas (airport apron) by an autonomous vehicle fleet qualifies as high-risk processing -- a DPIA is mandatory.
- The DPIA must assess risks, propose mitigations (anonymization, access controls, retention limits), and be reviewed before deployment.

### 8.3 Data Anonymization and Pseudonymization

**Real-time anonymization pipeline:**

```
Raw sensor data → On-vehicle anonymization → Encrypted storage → Upload
                                                                    ↓
                  ┌─────────────────────────────────────────────────┘
                  ↓
            Cloud storage (encrypted at rest, AES-256)
                  ↓
            Access-controlled data lake
                  ↓
            ML training pipeline (with differential privacy)
```

**Anonymization techniques:**
- **Face blurring**: Apply face detection (e.g., MTCNN, RetinaFace) and Gaussian blur to all detected faces in camera images before storage. Must balance privacy (aggressive blur) with perception model training utility (some facial features needed for pedestrian detection training).
- **License plate redaction**: Detect and redact vehicle license plates. Less critical airside (most GSE does not have standard plates) but relevant for staff vehicles and service vehicles.
- **Point cloud anonymization**: Remove or downsample point cloud regions corresponding to individuals. Less studied than image anonymization; current approaches use 3D bounding box detection and point removal.
- **Metadata stripping**: Remove EXIF data, precise timestamps, and GPS coordinates from data before export or sharing.

### 8.4 Data Retention Policies

| Data Category | Retention Period | Justification |
|--------------|-----------------|---------------|
| **Real-time sensor streams** | 72 hours (rolling buffer) | Overwritten unless flagged for incident review |
| **Flagged incidents** | 5 years | Required for safety investigation, regulatory compliance, and insurance |
| **Anonymized training data** | Duration of model lifecycle + 2 years | Required for model retraining, debugging, and regulatory audit |
| **Fleet telemetry (position, speed, mode)** | 1 year | Operational analysis, safety metrics |
| **Teleoperation recordings** | 90 days | Operator training, quality assurance, incident review |
| **System logs (software, errors)** | 1 year | Debugging, cybersecurity forensics |
| **Cybersecurity event logs** | 3 years | SIEM analysis, forensic investigation, regulatory compliance |

### 8.5 Data-at-Rest and Data-in-Transit Encryption

- **At rest**: AES-256-XTS for full-disk encryption on vehicle compute storage. AES-256-GCM for cloud storage (AWS S3 SSE-KMS, Azure Storage Service Encryption, or equivalent).
- **In transit**: TLS 1.3 for all network communication (see [Section 5.1](#51-tls-13-for-teleoperation-and-fleet-management)).
- **Key management**: Use a cloud KMS (Key Management Service) with customer-managed keys for cloud data. On-vehicle, use TPM-sealed encryption keys that are bound to the specific hardware -- data cannot be decrypted if the storage device is removed from the vehicle.

### 8.6 Airport-Specific Data Agreements

Operating airside requires data agreements with the airport authority and potentially airlines:

- **Airport data processing agreement**: Defines what data the AV operator may capture, store, and process within the airport's airside environment. May restrict data export off-premises or to non-approved cloud regions.
- **Airline confidentiality**: Airlines may require confidentiality agreements regarding their operations, fleet movements, and turnaround procedures captured by AV sensors.
- **Government/military restrictions**: Some airports host government or military operations. Sensor data capturing military aircraft or government VIP movements may be classified and subject to national security regulations.
- **Data sovereignty**: Many countries require that airport operational data remain within national borders. Cloud storage and processing must comply with data localization requirements (e.g., EU data within EU data centers).

---

## 9. Incident Response

### 9.1 Cyber Incident Playbook for Autonomous GSE Fleet

A cybersecurity incident involving autonomous GSE airside requires coordination between the AV operator, airport security operations center (SOC), airlines, and potentially national cybersecurity agencies.

#### Severity Classification

| Severity | Definition | Examples | Response Time |
|----------|-----------|----------|---------------|
| **P1 -- Critical** | Immediate threat to safety of life or aircraft | Vehicle control compromised; fleet-wide unauthorized movement; active collision risk | Immediate (minutes) |
| **P2 -- High** | Potential threat to safety or significant operational disruption | Suspected sensor spoofing on active vehicle; fleet management API breach; OTA update integrity failure | < 1 hour |
| **P3 -- Medium** | No immediate safety threat but security control bypassed | Unauthorized access attempt detected and blocked; anomalous network traffic; failed authentication spike | < 4 hours |
| **P4 -- Low** | Security event requiring investigation but no active threat | Vulnerability scan detected; policy violation; routine audit finding | < 24 hours |

#### P1 Response Procedure (Safety-Critical Cyber Incident)

```
MINUTE 0-2: IMMEDIATE CONTAINMENT
├── Trigger fleet-wide SAFE STOP (all vehicles decelerate to stop and engage parking brake)
├── Notify Airport SOC via emergency channel (phone, not network-dependent)
├── Notify airline operations for affected stands
├── Disable all remote access to fleet management systems
└── Physical isolation: disconnect vehicle 5G/WiFi modems if accessible

MINUTE 2-15: INITIAL ASSESSMENT
├── Identify scope: single vehicle, subset, or entire fleet?
├── Identify attack vector: network, physical, supply chain?
├── Assess immediate safety: are any vehicles in proximity to aircraft or personnel?
├── Begin forensic evidence preservation: snapshot system state, capture logs
└── Escalate to national CSIRT (Computer Security Incident Response Team) if warranted

MINUTE 15-60: CONTAINMENT AND COORDINATION
├── If single vehicle: physically isolate and power down
├── If fleet-wide: maintain safe stop; do NOT restart vehicles until root cause identified
├── Coordinate with airport SOC on airside impact assessment
├── Notify affected airlines and ground handlers
├── Begin CAN bus and network traffic forensic capture
└── Engage external incident response team if needed

HOUR 1-24: INVESTIGATION AND RECOVERY
├── Full forensic analysis of compromised systems
├── Identify indicators of compromise (IOCs) and share with airport SOC
├── Develop and test remediation (patch, configuration change, key rotation)
├── Phased fleet recovery: single vehicle test → subset → full fleet
├── Enhanced monitoring during recovery period
└── Preliminary incident report to management and regulators

DAY 1-30: POST-INCIDENT
├── Complete root cause analysis (RCA)
├── Update TARA with lessons learned
├── Implement permanent fixes and additional controls
├── Regulatory reporting (EASA Part-IS, NIS2, airport authority)
├── Conduct post-incident review with airport SOC and stakeholders
└── Update incident response playbook
```

### 9.2 Coordination with Airport SOC

Most major airports operate a Security Operations Center (SOC) or integrate cybersecurity monitoring into their Airport Operations Center (AOC). Coordination requirements:

- **Pre-incident**: Establish communication channels, share contact lists, define escalation procedures, and conduct joint tabletop exercises at least annually.
- **Shared threat intelligence**: Exchange IOCs and threat intelligence between the AV operator and airport SOC. Autonomous GSE sensors may detect physical security anomalies (unauthorized personnel, unusual vehicle movements) that are relevant to the airport's security posture.
- **Network visibility**: Grant the airport SOC read-only visibility into the AV fleet's network traffic via a SPAN port or network tap. This allows the airport to monitor for threats originating from or targeting the AV fleet without requiring access to vehicle systems.
- **Joint exercises**: Conduct cybersecurity exercises (red team/blue team) that include autonomous GSE scenarios. Test the P1 response procedure with live vehicle safe-stop capabilities.

### 9.3 Regulatory Reporting Requirements

| Regulation | Reporting Timeline | Authority | Content |
|-----------|-------------------|-----------|---------|
| **EASA Part-IS** | Without undue delay | National aviation authority + EASA | Incident description, impact on aviation safety, mitigation measures |
| **EU NIS2** | 24 hours (early warning), 72 hours (notification), 1 month (final report) | National CSIRT and competent authority | Nature of incident, impact, cross-border effects, mitigation |
| **GDPR** (if personal data breach) | 72 hours to DPA, without undue delay to data subjects if high risk | Data Protection Authority | Nature of breach, categories and number of data subjects, measures taken |
| **Airport authority** | Immediately (for safety-affecting incidents) | Airport security / operations | Operational impact, containment measures, recovery timeline |
| **UK CAA** (if operating in UK) | As soon as practicable | Civil Aviation Authority | Incident description, impact, corrective actions |

### 9.4 Forensic Evidence Preservation

For cybersecurity incidents involving autonomous vehicles, forensic evidence includes:

- **Vehicle data recorder**: All sensor data, control commands, system state, and diagnostic data for 72 hours before and after the incident. Equivalent to an aviation CVR/FDR but for ground vehicles.
- **Network traffic captures**: Full packet capture from the vehicle's network interfaces (internal Ethernet, CAN bus, 5G/WiFi uplink).
- **System logs**: Application logs, kernel logs, container runtime logs, authentication logs, OTA update logs.
- **Fleet management logs**: API access logs, dispatch records, teleoperation session logs, geofence modification history.
- **Airport CCTV**: Request CCTV footage from the airport security team for the affected area within 24 hours of the incident (retention policies vary; footage may be overwritten after 7-30 days).
- **Chain of custody**: Maintain a documented chain of custody for all digital evidence. Use write-blocking tools for disk imaging. Store forensic images in tamper-evident containers.

---

## 10. Published Attacks on AV Systems

### 10.1 Landmark Research Attacks

#### Miller and Valasek -- Jeep Cherokee (2015)

The foundational automotive cybersecurity research. Charlie Miller and Chris Valasek demonstrated remote exploitation of a 2014 Jeep Cherokee:

- **Attack chain**: Exploited the Uconnect infotainment system's cellular connection (Sprint network) to gain remote code execution on the head unit. From there, they reflashed the CAN gateway ECU firmware to allow CAN message injection. They then sent CAN messages to control steering, braking, and transmission.
- **Impact**: Chrysler recalled 1.4 million vehicles. The attack demonstrated that a single network-accessible ECU could provide a path to safety-critical vehicle functions.
- **Relevance to autonomous GSE**: Autonomous GSE has a similar architecture -- a network-connected compute system (for fleet management, teleoperation, OTA) connected to a CAN bus controlling actuators. The attack chain (network to compute to CAN to actuators) is directly applicable.

#### Tencent Keen Security Lab -- Tesla (2016-2019)

Multiple demonstrated attacks against Tesla vehicles:

- **2016**: Remote compromise of Tesla Model S via WiFi/cellular. Gained root access to the CAN bus gateway and could control brakes, door locks, dashboard display, and trunk while the car was in motion at up to 12 miles away.
- **2017**: Remote attack on Tesla Model X via a malicious WiFi access point. Demonstrated CAN bus message injection to control braking, indicators, and seats.
- **2019**: Demonstrated adversarial attacks against Tesla Autopilot's lane detection. By placing small adversarial stickers on the road surface, they caused the Autopilot to steer into oncoming traffic lanes.
- **Tesla's response**: Tesla implemented code signing for CAN gateway firmware, introduced CAN message authentication, and established a bug bounty program. These security improvements were deployed via OTA updates.

#### McAfee Advanced Threat Research -- Tesla Speed Limit (2020)

- **Attack**: Placed a small adhesive strip on a speed limit sign, changing "35" to "85." Tesla Autopilot's Mobileye-based camera system read the modified sign and accelerated the vehicle.
- **Significance**: Demonstrated that physical adversarial attacks on traffic signs could affect vehicle behavior. The attack was simple, inexpensive, and undetectable to casual observation.
- **Airside relevance**: Airport signage (stand numbers, speed limits, taxiway designators) could be similarly modified to affect autonomous GSE behavior if the perception system relies on sign reading.

### 10.2 LiDAR Spoofing Research

#### Petit et al. (2015) -- "Remote Attacks on Automated Vehicles Sensors"

- First systematic study of LiDAR spoofing attacks. Demonstrated relay, replay, and saturation attacks against IBEO LUX LiDAR using a custom transceiver.
- Showed that injecting spoofed returns at specific timings could create phantom obstacles.
- Cost of attack equipment: approximately $60 for basic components.

#### Cao et al. (2019) -- "Adversarial Objects Against LiDAR-Based AV Perception"

- Demonstrated spoofed 3D point cloud injection against Baidu Apollo's perception system.
- Created phantom obstacles that triggered emergency braking.
- Also demonstrated object removal attacks that could hide real vehicles from perception.
- Attack success rate: 75% for object injection, 90% for object removal (in controlled conditions).

#### Sato et al. (2023) -- "LiDAR Spoofing Meets the New-Gen"

- Studied LiDAR spoofing against newer generation LiDARs with potential countermeasures.
- Found that randomized pulse timing (a proposed defense) could be partially defeated by adaptive spoofing algorithms.
- Concluded that no single sensor-level defense is sufficient; system-level multi-sensor fusion is required.

### 10.3 Camera and Perception Attacks

#### Eykholt et al. (2018) -- "Robust Physical-World Attacks on Deep Learning Models"

- Created adversarial perturbations on stop signs that caused misclassification as speed limit signs.
- Perturbations were robust to varying distance, angle, and lighting conditions.
- Achieved 100% attack success rate in drive-by experiments with physical signs.

#### Nassi et al. (2020) -- "Phantom of the ADAS"

- Projected phantom road signs and pedestrians using a commercial projector onto road surfaces and nearby objects.
- Tesla Autopilot and Mobileye 630 PRO both responded to the phantom images as if they were real.
- Demonstrated that even brief (125ms) phantom projections could trigger responses.

#### Boloor et al. (2020) -- "Attacking Vision-based Perception in End-to-End AVs"

- Demonstrated adversarial attacks against end-to-end driving models (NVIDIA DAVE-2 architecture).
- Small perturbations to input images caused the model to output incorrect steering angles.
- Showed that end-to-end architectures, while simpler, concentrate the attack surface in a single model.

### 10.4 GPS/GNSS Spoofing

#### Humphreys et al. (2008-2012) -- University of Texas GPS Spoofing

- Demonstrated the first publicly acknowledged GPS spoofing attacks.
- In 2012, demonstrated GPS spoofing of a superyacht, causing it to deviate from its course without triggering any alarms.
- Cost of the GPS spoofing hardware: approximately $3,000.
- Showed that civilian GPS receivers have no authentication mechanism and are fundamentally vulnerable to spoofing.

#### Zeng et al. (2018) -- "All Your GPS Are Belong To Us"

- Demonstrated GPS spoofing attacks against road navigation systems.
- Caused vehicles to deviate from their intended route by gradually shifting the spoofed GPS position.
- Proposed a "ghost location" attack that provides consistent but incorrect position data, avoiding detection by simple consistency checks.
- Achieved 95% success rate in causing vehicles to take wrong turns.

### 10.5 Key Takeaways for Airside AV Operators

1. **Every demonstrated attack is relevant**: The attack vectors demonstrated on road vehicles (CAN injection, GPS spoofing, LiDAR spoofing, camera adversarial attacks) apply equally to autonomous GSE. The lower speed of GSE does not reduce the severity -- the proximity to aircraft and personnel means that even a low-speed collision can be catastrophic.

2. **Attack costs are decreasing**: GPS spoofers cost $3,000 in 2012; LiDAR spoofing equipment cost $60 in 2015; adversarial patches cost pennies. The barrier to entry for sensor attacks is now within reach of individual malicious actors.

3. **Defense requires depth**: No single defense mechanism has proven sufficient. The research consensus is that multi-layer defense (sensor-level, perception-level, planning-level, network-level) with multi-sensor cross-validation is the only robust approach.

4. **OEMs have responded**: Tesla's iterative security improvements (CAN message authentication, gateway code signing, OTA security patches) demonstrate that cybersecurity is an ongoing process, not a one-time certification.

---

## 11. Competitor Cybersecurity Approaches

### 11.1 UISEE

UISEE has the most comprehensive publicly documented cybersecurity posture of any airside autonomous GSE operator:

**Certifications:**
- **ISO/SAE 21434** -- Road Vehicle Cybersecurity Process. UISEE obtained this certification, demonstrating a compliant CSMS and TARA-based risk management process.
- **ISO 27001** -- Information Security Management System. This is the international gold standard for organizational information security management.
- **ISO/IEC Level 3** -- Classified Protection (China). China's national information security classification system.
- **Singapore TR68** -- Comprehensive AV safety standard covering vehicle behavior, functional safety, cybersecurity, and data formats. Required for Changi Airport deployment.

**Architecture:**
- UISEE operates a cloud-based fleet management platform (U-Station) with remote monitoring capabilities.
- The U-Drive system (fifth generation) includes multi-level failure monitoring and response mechanisms with 100+ safety strategies covering approximately 1,000 potential risk scenarios.
- Vehicles operate with 4G/5G cellular connectivity to a monitoring center with Road Side Units (RSU) as additional communication infrastructure.

**Significance**: UISEE's quad-certification (21434 + 27001 + Classified Protection + TR68) sets the benchmark that other airside autonomous GSE operators will be measured against. The Changi Airport deployment required nearly one year of rigorous testing (5,000+ trial runs, 20,000+ km) before operational approval -- cybersecurity was explicitly part of the approval criteria.

### 11.2 Fernride

Fernride's cybersecurity approach centers on securing the teleoperation link, which is the primary attack surface for their teleoperation-first architecture:

**Communication security:**
- **TLS 1.3 encryption**: All communication between the vehicle kit and the operations control station uses TLS 1.3 encryption. This covers video streams (HD camera feeds from every direction), vehicle telemetry, and control commands (steering, throttle, braking).
- **uRLLC protocol**: Fernride's proprietary ultra-Reliable Low-Latency Communication protocol runs over the TLS 1.3 encrypted link, achieving end-to-end latency under 100ms on 4G/LTE.
- **Dual routers with VPN/LTE failover**: Redundant connectivity with VPN tunneling ensures that the encrypted link is maintained even during network transitions.

**Compute architecture:**
- **Redundant compute**: Linux-based high-performance processing paired with QNX-based safety-critical ECU. The QNX safety ECU operates independently and can bring the vehicle to a safe stop even if the Linux system is compromised.
- **Independent safety layer**: Validates all autonomy commands before they reach actuators, providing a hardware-enforced security boundary.

**Operational security:**
- CE-certified safety button on teleoperation workstations
- Multi-vehicle monitoring interface with exception handling workflows
- Thorough site connectivity assessment before deployment

**Gap**: Fernride has not publicly announced ISO 21434 or ISO 27001 certification. Their December 2025 acquisition by Quantum Systems (European AI-powered unmanned systems) may accelerate cybersecurity certification through Quantum Systems' defense industry security practices.

### 11.3 TractEasy (EasyMile)

TractEasy's cybersecurity posture is rooted in EasyMile's dual-computer safety architecture:

**Dual-computer architecture:**
- **Decision-making computer**: Runs the high-level autonomous driving stack (path planning, decision-making).
- **Dedicated safety computer**: Runs separate safety-critical software with SIL 3 certified safety PLCs (IEC 61508) and PLe certified systems (ISO 13849). This computer operates independently and can override the decision-making computer.
- **Cybersecurity implication**: Even if an attacker compromises the decision-making computer (Linux-based, larger attack surface), the safety computer (embedded PLC, minimal attack surface, no network connectivity) provides a hard security boundary. The safety computer monitors for anomalous behavior and triggers safe stop independently.

**Sensor redundancy as security:**
- Four 2D safety LiDARs (270 degrees each) provide 360-degree redundant obstacle detection. These are connected directly to the Safety Chain (hardware safety layer), not through the decision-making computer.
- Even if the perception software on the decision-making computer is compromised (e.g., through adversarial attacks on the 3D LiDARs), the 2D safety LiDARs provide an independent detection layer.

**Standards compliance:**
- EasyMile's EZ10 platform (which shares the autonomy stack with the EZTow/TractEasy) has been certified across multiple regulatory frameworks with 400+ deployments.
- EasyMile conducts SOTIF (Safety of the Intended Functionality) analysis for sensor/algorithm safety, which includes analysis of adversarial failure modes.

**Gap**: TractEasy/EasyMile has not publicly announced ISO 21434 or ISO 27001 certification. Their safety architecture provides strong defense-in-depth but lacks the organizational cybersecurity management framework that ISO 21434/27001 provides.

### 11.4 Comparative Analysis

| Capability | UISEE | Fernride | TractEasy/EasyMile |
|-----------|-------|----------|-------------------|
| **ISO 21434 (Cybersecurity Process)** | Certified | Not announced | Not announced |
| **ISO 27001 (Info Security Management)** | Certified | Not announced | Not announced |
| **Communication encryption** | 4G/5G cellular (details not public) | TLS 1.3, uRLLC, dual-router VPN | Not detailed publicly |
| **Compute architecture** | Multi-level failure monitoring, 100+ safety strategies | Linux + QNX dual-compute, independent safety layer | Dual-computer (decision + safety PLC), SIL 3 |
| **Hardware safety boundary** | Multi-level monitoring | QNX safety ECU independent of Linux | Safety PLC independent of decision computer |
| **Sensor security** | 10+ sensors per tractor | LiDARs, radars, cameras with heated lenses | 4x 2D safety LiDARs on independent Safety Chain |
| **Safety certifications** | ISO 26262, IATF 16949, TR68 | CE certification | IEC 61508 SIL 3, ISO 13849 PLe |
| **OTA security** | Cloud-based U-Station platform | Fernride Driver updates | EZFleet management |
| **Regulatory coverage** | China + Singapore + International | EU (CE) | EU (CE), France, Japan |

### 11.5 Other Industry Reference Points

**Kodiak Robotics:**
- Claims ASIL-D compliance for their Autonomous Compute Engine (ACE), the highest ASIL level in ISO 26262
- Hardware-enforced safety domains with separate compute for safety-critical functions

**Zoox:**
- Cites ISO 26262, SOTIF, and ARP4754A in their safety framework
- Custom-built vehicle with security-by-design approach
- Redundant compute, networking, and sensor systems

**Waymo:**
- Bug bounty program for vulnerability disclosure
- Multiple layers of redundancy in compute, sensors, and communication
- Centralized fleet management with robust access controls

---

## 12. Recommendations for Airside AV Operators

### 12.1 Minimum Viable Security Posture

For any autonomous GSE operating airside, the following are non-negotiable baseline requirements:

1. **TLS 1.3 with mutual authentication** for all vehicle-to-cloud, vehicle-to-teleoperation, and vehicle-to-OTA communication. No exceptions, no fallback to TLS 1.2.

2. **Code-signed OTA updates** with dual-signature requirements. All software, model weights, and configuration updates must be signed and verified before deployment.

3. **Hardware safety boundary** -- a physically or logically separate safety system (safety PLC, QNX safety ECU, or equivalent) that cannot be compromised through the autonomy stack. This system must be able to bring the vehicle to a safe stop independently.

4. **Multi-sensor cross-validation** for all safety-critical detections. No single sensor should be trusted in isolation for collision avoidance decisions.

5. **Network segmentation** between the vehicle's internal network (CAN bus, sensor Ethernet) and external network (5G/WiFi uplink). No direct routing from the external network to the CAN bus.

6. **Encrypted storage** for all sensor data on-vehicle (full-disk encryption with TPM-sealed keys).

7. **Fleet-wide safe stop capability** that can be triggered independently of the primary communication channel (e.g., hardware-level cellular modem command, or physical kill-switch accessible to ground crew).

### 12.2 Target Security Posture (12-18 Month Horizon)

1. **ISO 21434 certification** -- implement a CSMS, conduct TARA for all vehicle systems, and undergo third-party audit.

2. **ISO 27001 certification** for the organization's information security management system.

3. **SecOC on CAN bus** for all safety-critical messages (steering, braking, throttle, emergency stop).

4. **Automated vulnerability management** with continuous dependency scanning, container image scanning, and CVE tracking with defined SLAs for remediation.

5. **Cyber incident response plan** coordinated with the airport SOC, tested through tabletop exercises at least annually.

6. **SBOM (Software Bill of Materials)** maintained for all deployed software, shared with airport authorities and regulators upon request.

7. **Secure boot chain** from hardware root of trust through application stack, with dm-verity integrity verification for the root filesystem.

8. **Data protection framework** including DPIA, anonymization pipeline, retention policies, and data processing agreements with the airport authority.

### 12.3 Strategic Security Investments

1. **Automotive Ethernet with MACsec** to replace CAN for high-bandwidth sensor data, providing link-layer encryption with negligible latency impact.

2. **Sensor fingerprinting** research to detect LiDAR and radar spoofing at the hardware level by validating pulse characteristics.

3. **Adversarial robustness testing** integrated into the ML model validation pipeline. No perception model should be deployed without adversarial robustness evaluation.

4. **Zero-trust network architecture** where every communication is authenticated and authorized regardless of network location. Vehicles should not trust the network they are connected to.

5. **AI-based anomaly detection** on CAN bus traffic and network traffic to detect novel attack patterns that signature-based IDS cannot identify.

---

## 13. References

### Standards and Regulations

- ISO/SAE 21434:2021 -- Road vehicles -- Cybersecurity engineering
- ISO 27001:2022 -- Information security management systems
- UNECE Regulation No. 155 -- Cybersecurity and Cybersecurity Management System
- UNECE Regulation No. 156 -- Software Update and Software Update Management System
- EASA Part-IS -- Regulation (EU) 2023/203 -- Information Security
- EASA NPA 2025-07 -- AI Trustworthiness in Aviation
- EU NIS2 Directive -- Directive (EU) 2022/2555
- EU Cyber Resilience Act -- Regulation (EU) 2024/2847
- Singapore TR68 -- Technical Reference for Autonomous Vehicles
- ISO 3691-4:2023 -- Driverless Industrial Trucks
- AUTOSAR Secure Onboard Communication (SecOC) -- AUTOSAR SWS SecOC R22-11

### Published Research

- Miller, C. and Valasek, C. (2015). "Remote Exploitation of an Unaltered Passenger Vehicle." Black Hat USA.
- Petit, J. et al. (2015). "Remote Attacks on Automated Vehicles Sensors: Experiments on Camera and LiDAR." Black Hat Europe.
- Shin, H. et al. (2017). "Illusion and Dazzle: Adversarial Optical Channel Exploits Against Lidars for Automotive Applications." CHES.
- Eykholt, K. et al. (2018). "Robust Physical-World Attacks on Deep Learning Models." CVPR.
- Humphreys, T. et al. (2008). "Assessing the Spoofing Threat: Development of a Portable GPS Civilian Spoofer." ION GNSS.
- Zeng, K. et al. (2018). "All Your GPS Are Belong To Us: Towards Stealthy Manipulation of Road Navigation Systems." IEEE S&P.
- Cao, Y. et al. (2019). "Adversarial Objects Against LiDAR-Based Autonomous Driving Systems." CCS.
- Sun, J. et al. (2020). "Adversarial Attacks on LiDAR-based 3D Object Detection." arXiv:2006.01790.
- Tu, J. et al. (2020). "Physically Realizable Adversarial Examples for LiDAR Object Detection." CVPR.
- Nassi, B. et al. (2020). "Phantom of the ADAS: Securing Advanced Driver-Assistance Systems from Split-Second Phantom Attacks." CCS.
- Wang, B. et al. (2019). "Neural Cleanse: Identifying and Mitigating Backdoor Attacks in Neural Networks." IEEE S&P.
- Boloor, A. et al. (2020). "Attacking Vision-based Perception in End-to-End Autonomous Driving Models." JSys.
- Hau, Z. et al. (2021). "Shadow-Catcher: Looking into Shadows to Detect Ghost Objects in AV 3D Sensing." ESORICS.
- Jin, T. et al. (2023). "PLA-LiDAR: Physical Laser Attacks against LiDAR-based 3D Object Detection in Autonomous Vehicles." IEEE S&P.
- Sato, T. et al. (2023). "LiDAR Spoofing Meets the New-Gen: Capability Improvements, Broken Assumptions, and New Attack Strategies." NDSS.
- Costin, A. and Francillon, A. (2012). "Ghost in the Air(Traffic): On Insecurity of ADS-B Protocol and Practical Attacks on ADS-B Devices." Black Hat USA.
- Yan, C. et al. (2016). "Can You Trust Autonomous Vehicles: Contactless Attacks against Sensors of Self-driving Vehicles." DEF CON.

### Industry Sources

- UISEE ISO 21434 and ISO 27001 certifications: UISEE HK IPO Prospectus (May 2025)
- Fernride TLS 1.3 and dual-router architecture: Fernride technical documentation and press releases
- TractEasy/EasyMile dual-computer architecture: EasyMile technical specifications and patent filings (US 10,962,649)
- DFW Airport CBRS deployment: DFW/AT&T press releases (2023)
- Changi Airport UISEE deployment: CAAS/Changi Airport Group announcements (2025-2026)
- Auto-ISAC: Automotive Information Sharing and Analysis Center (https://automotiveisac.com/)
- EASA Part-IS guidance: EASA Easy Access Rules for Information Security
