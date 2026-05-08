# Insurance, Liability, and Risk Management for Autonomous Vehicles on Airport Airside

**Last Updated:** 2026-03-22
**Scope:** Autonomous ground support equipment (GSE) and autonomous ground vehicle systems (AGVS) operating on airport airside (aprons, taxiways, ramp areas)

---

## Table of Contents

1. [Liability Framework: Who Is Liable When Autonomous GSE Causes Damage?](#1-liability-framework)
2. [Current Insurance Products for Autonomous Vehicles](#2-current-insurance-products-for-autonomous-vehicles)
3. [Airport Liability Insurance Requirements](#3-airport-liability-insurance-requirements)
4. [Product Liability for Autonomous Systems](#4-product-liability-for-autonomous-systems)
5. [Aviation-Specific Insurance Considerations](#5-aviation-specific-insurance-considerations)
6. [Vendor Insurance Approaches: TractEasy and UISEE](#6-vendor-insurance-approaches)
7. [Cyber Insurance for Autonomous Vehicles](#7-cyber-insurance-for-autonomous-vehicles)
8. [Data Breach Liability for Sensor Recordings at Airports](#8-data-breach-liability-for-sensor-recordings)
9. [Indemnification Clauses in Autonomous Vehicle Contracts](#9-indemnification-clauses)
10. [Regulatory Requirements for Insurance (FAA/EASA/CAAS)](#10-regulatory-requirements)
11. [Structuring Insurance for Phased Deployment](#11-structuring-insurance-for-phased-deployment)
12. [Comparison with Road AV Insurance Landscape](#12-comparison-with-road-av-insurance)
13. [Recommendations for an Airside AV Operator](#13-recommendations)
14. [Sources](#14-sources)

---

## 1. Liability Framework: Who Is Liable When Autonomous GSE Causes Damage? {#1-liability-framework}

### The Multi-Party Liability Chain

When an autonomous GSE vehicle causes damage on airport airside, liability potentially extends across a complex chain of parties. Unlike traditional GSE operations where the ground handler's employee is clearly at fault, autonomous operations fragment responsibility across:

| Party | Potential Liability Basis | Typical Exposure |
|-------|--------------------------|------------------|
| **Vehicle OEM / Hardware Manufacturer** | Product liability for mechanical/hardware defects; manufacturing defects in chassis, braking systems, steering | Design defect, manufacturing defect, failure to warn |
| **Autonomy Software Provider** | Product liability for software defects; algorithmic failures; sensor fusion errors; inadequate obstacle detection | Software defect, negligent design of perception/planning stack |
| **Sensor/Component Suppliers** | Product liability for defective LiDAR, cameras, radar, GPS modules | Defective component contributing to system failure |
| **Airport Operator** | Premises liability; failure to maintain safe airside environment; inadequate oversight of autonomous operations | Negligence in supervision, failure to enforce safety protocols |
| **Ground Handler / Fleet Operator** | Operational negligence; failure to properly maintain, configure, or supervise autonomous vehicles | Vicarious liability, negligent maintenance, improper deployment |
| **Airline** | Contractual liability under ground handling agreements; may bear residual risk for damage to own aircraft | Contractual allocation under SGHA or bespoke agreements |
| **Connectivity/Telecom Provider** | If V2X or remote monitoring failure contributed to incident | Network failure leading to loss of remote supervision capability |

### Liability Shift with Autonomy Level

The fundamental principle emerging across jurisdictions is that **as autonomy increases, liability shifts from the human operator to the technology provider**:

- **Level 0-2 (driver assist):** Liability remains primarily with the human operator/ground handler. The driver is "in the loop" and responsible for vehicle control.
- **Level 3 (conditional automation):** Liability becomes shared. When the system is engaged and operating within its ODD (Operational Design Domain), the technology provider bears primary responsibility. When the system issues a transition demand and the human fails to respond, the human bears responsibility.
- **Level 4 (high automation, no driver required within ODD):** Liability shifts substantially to the OEM/software provider. Since no human driver is required within the defined operational domain, the technology creator bears primary product liability. This is the level at which most airside autonomous GSE operates (TractEasy and UISEE both target L4).
- **Level 5 (full automation):** Liability rests almost entirely with the manufacturer/software provider.

### Key Legal Precedent

In August 2025, a federal jury found Tesla partially liable for a 2019 crash involving Autopilot, awarding $43 million in compensatory damages and $200 million in punitive damages. While this involved road vehicles, it establishes the principle that technology providers cannot disclaim liability when their autonomous systems are engaged.

### Airport-Specific Liability Complexity

Airside operations add unique liability dimensions not present in road AV deployments:

- **Aircraft damage exposure:** A single GSE-to-aircraft collision can result in $1M-$139M+ in damages (see Section 5), creating catastrophic liability scenarios far exceeding typical road AV incidents.
- **Multi-tenant environment:** Airlines, ground handlers, airport operators, and fuel companies all operate on the same apron, creating overlapping duty-of-care obligations.
- **IATA SGHA framework:** The Standard Ground Handling Agreement caps ground handler liability at the lower of USD 1.5 million or the carrier's hull insurance deductible. This cap does NOT apply in cases of gross negligence or recklessness. An autonomous system failure causing aircraft damage raises the question of whether a software defect constitutes "recklessness with knowledge" -- potentially removing the liability cap entirely.
- **No clear regulatory assignment:** Neither the FAA nor EASA has yet issued definitive guidance on liability allocation for autonomous GSE incidents on airside.

---

## 2. Current Insurance Products for Autonomous Vehicles

### Major Reinsurer Programs

#### Munich Re

Munich Re, through its subsidiary Hartford Steam Boiler (HSB), has positioned itself as a key player in autonomous vehicle risk:

- **Liability framework:** Munich Re identifies that "the vehicle keeper's liability is not affected by the vehicle's automation," but manufacturer liability becomes increasingly relevant when automated systems malfunction.
- **Risk assessment approach:** Distinguishes between risks reduced by automation (human error: impaired driving, fatigue, distraction) and new risks created (programming errors, cyber vulnerabilities, cross-border legal inconsistencies).
- **Key position:** Acknowledges "extensive legal uncertainty in the case of accidents involving automated vehicles" will persist during early adoption phases.
- **No dedicated airside product identified** as of early 2026.

#### Swiss Re

Swiss Re has been more active in developing AV-specific tools:

- **ADAS Risk Score:** Jointly developed with BMW Group, this vehicle-specific insurance rating helps primary insurers assess risk for vehicles with advanced driver assistance systems. Extended through partnership with Toyota Insurance Services.
- **Waymo collaboration:** Swiss Re's empirical study with Waymo found autonomous vehicles demonstrate **88% fewer property damage claims** and **92% fewer bodily injury claims** across 25 million fully autonomous miles -- powerful data for actuarial modeling.
- **Three-step framework:** Swiss Re identifies three stages of AV insurance evolution: (1) current ADAS risk scoring, (2) emerging business models for shared mobility, (3) new data partnerships between OEMs and insurers.
- **No dedicated airside product identified** as of early 2026.

#### Lloyd's of London

Lloyd's syndicates have historically been the primary market for aviation and specialty risks. Koop Technologies (see below) places autonomous vehicle coverage through Lloyd's.

### Specialty AV Insurers

#### Koop Technologies (founded 2020, Jersey City, NJ)

Koop is currently the most focused insurer for autonomous vehicle and robotics coverage:

- **Singularity Package** covers:
  - General Liability (defects, accidents at facilities, warehouses, test fields)
  - Errors & Omissions (technical mistakes, system behavior errors)
  - Cyber Liability (network attacks, data breach losses)
  - Commercial Auto (third-party damages, occupant injuries)
  - Equipment Coverage (in-transit and storage damage)
  - Excess Liability (additional limits beyond underlying policies)
- **Coverage limits:** $1M to $25M per occurrence for commercial AV fleets
- **Risk categories addressed:** bodily injury, property damage, business interruption, data loss, software deficiency, hardware malfunction, cybersecurity vulnerabilities, operational negligence
- **Technology integration:** API-based automated vehicle/robot data sharing, risk management software for performance monitoring, compliance automation
- **OEM-agnostic:** Covers autonomous vehicles across all leading manufacturers
- **Off-road and logistics:** Explicitly covers autonomous logistics, construction, mining, agriculture, and maritime -- making it potentially applicable to airside GSE operations
- **No specific airport/airside product identified**, but the off-road robotics and logistics coverage categories are highly relevant.

#### Travelers Insurance

Travelers offers coverage specifically designed for autonomous vehicle technology companies:

- **Target clients:** AV stack component developers, passengerless delivery services, platooning technology providers, passenger shuttle operators, vehicle retrofitters, remote monitoring service providers
- **Products:** Property, General Liability, Business Auto, Workers Compensation, Inland Marine, CyberRisk Tech (includes technology E&O, breach response, cyber crime, business loss), Global Companion Plus+
- **Relevance:** The "remote monitoring service providers" and "passenger shuttle operators" categories could extend to airside autonomous operations.

### Traditional Aviation Insurance Brokers

The major aviation insurance brokers have not yet launched dedicated autonomous airside vehicle products, but their existing airside liability frameworks are the starting point:

- **Marsh:** Airside Liability Insurance Scheme with coverage from GBP 1M to GBP 100M; 900+ policies sold; delegated authority using AM Best A++ rated insurers. Covers "all restricted areas of the airport, including aprons, taxiways, runways, areas beyond passport control."
- **WTW (Willis Towers Watson):** Tailored third-party liability for entities required by airports to carry aviation insurance for airside activities. Global Aerospace Practice supports airports, ground handlers, and refuellers.
- **Aon:** Aviation and risk management covering commercial operators, manufacturers, and increasingly unmanned/autonomous systems.
- **Global Aerospace:** Airport liability and ground handler insurance with general liability, premises, products, hangarkeepers, mobile equipment, and war/allied perils coverage.
- **Chubb:** Aerospace insurance including airport operations.

---

## 3. Airport Liability Insurance Requirements

### Typical Coverage Amounts for Airside Operations

Airport operators set their own insurance requirements for tenants and operators on airside. Based on ACI-NA survey data and individual airport requirements:

| Airport Category | Typical Airside Auto Liability Requirement | Range |
|-----------------|-------------------------------------------|-------|
| Major hub airports | $10M - $50M+ per occurrence | Up to $100M |
| Mid-size commercial airports | $5M - $10M per occurrence | $5M - $25M |
| Smaller commercial airports | $1M - $5M per occurrence | $1M - $10M |

**Key statistics:**
- **64% of surveyed airports** require between $5M and $10M in airside auto liability limits
- **Minimum** observed: $1M
- **Maximum** observed: $100M
- Most companies carry $1M in primary auto liability and need $9M+ in excess/umbrella coverage to meet airport requirements

**Example: Denver International Airport** requires a minimum of $10M auto liability for unescorted airside driving privileges.

**UK airports:** Marsh's scheme offers third-party liability limits from GBP 1M to GBP 100M, with most airports requiring at least GBP 10M.

### Insurance Types Required for Airside Operations

Operators on airport airside typically must carry:

1. **Aviation/Airside Liability Insurance** -- Standard motor insurance policies do NOT respond to airside incidents. A dedicated aviation liability or airside liability policy is required.
2. **Commercial General Liability (CGL)** -- Covers bodily injury and property damage arising from operations.
3. **Commercial Auto Liability** -- Covers vehicle operations; must be aviation-rated for airside use.
4. **Workers' Compensation** -- For employee injuries.
5. **Property/Equipment Insurance** -- For owned GSE and equipment.
6. **Excess/Umbrella Liability** -- To meet airport-mandated minimum limits above primary policy levels.
7. **Aviation Products Liability** -- If manufacturing or modifying equipment used near aircraft.
8. **Hangarkeepers Liability** -- If operating in or near hangar facilities.
9. **Environmental Liability** -- Particularly for fueling operations, but also relevant for battery-electric autonomous GSE.

### Ground Handler Insurance Under IATA SGHA

The IATA Standard Ground Handling Agreement establishes the baseline contractual insurance framework:

- **Liability cap for aircraft damage:** Lower of USD 1,500,000 or the carrier's hull insurance deductible (minimum USD 3,000)
- **Cargo claims:** Montreal Convention limits, approximately USD 31/kg, maximum USD 1,000,000 (minimum USD 500 per claim)
- **Exclusions from cap:** Gross negligence or "recklessness with knowledge that damage would probably result" removes the liability cap
- **No coverage for:** Passenger delay/injury/death; consequential losses; business interruption
- **Trend:** Airlines increasingly negotiate amendments replacing the "recklessness" standard with simple negligence, expanding handler liability exposure

### Hull All Risk Insurance (Airline Side)

Airlines purchase hull all risk insurance covering damage to their aircraft, with typical deductibles:

| Aircraft Category | Typical Hull Deductible |
|-------------------|------------------------|
| Narrowbody (A320, B737) | $500,000 |
| Hybrid aircraft | $750,000 |
| Widebody (A350, B777, A380) | $1,000,000 |

Insurers cover property damage only -- **not** business interruption or consequential losses. Aviation insurers pick up approximately **15% of annual ground damage costs**; the remaining 85% falls on airlines' balance sheets.

---

## 4. Product Liability for Autonomous Systems

### Traditional Product Liability Framework Applied to AVs

Product liability claims against autonomous vehicle manufacturers and software providers can be brought under three theories:

1. **Design Defect:** The autonomous system's design is inherently unsafe -- e.g., the perception algorithm cannot reliably detect certain obstacle types, the planning system makes unsafe path choices, or the ODD definition is insufficiently conservative.

2. **Manufacturing Defect:** A specific unit deviates from its intended design -- e.g., a faulty LiDAR sensor, improperly calibrated camera, or corrupted firmware in a specific vehicle.

3. **Failure to Warn:** Inadequate warnings about system limitations -- e.g., failure to disclose that the autonomous system cannot operate safely in heavy rain, at night, or in areas with poor GPS reception.

### Software as a Product: The Evolving Legal Landscape

Historically, software was treated as a service rather than a product, potentially shielding developers from strict product liability. This is changing rapidly:

**EU Product Liability Directive (2024/2853)** -- Effective December 9, 2024; Member States must transpose by December 9, 2026:

- **Software explicitly classified as a "product"** for the first time, including embedded, standalone, and cloud-based software, OTA updates, and AI systems
- **Cybersecurity failures constitute product defects** -- failure to patch known vulnerabilities creates strict liability even after market placement
- **AI behavioral changes create liability** -- harm caused by autonomous or adaptive AI behavior, including post-sale machine learning changes or OTA updates, is covered
- **Claimant-favorable presumptions:**
  - Defect presumed if manufacturer fails to disclose evidence
  - Defect presumed if product violates mandatory safety requirements
  - Defect presumed on "obvious malfunction"
  - Causation presumed when defect and damage type typically correlate
  - Both defect AND causation presumed when case involves "excessive difficulties due to technical or scientific complexity" -- a scenario almost certainly present in AV litigation
- **Expanded liable parties:** Cascading hierarchy: manufacturer -> EU importer -> authorized representative -> fulfillment service provider. Anyone who "substantially modifies" a product through software changes is deemed a "manufacturer."
- **Extended liability periods:** 10 years standard; 25 years for latent injuries
- **State-of-the-art defense:** Member States may opt to eliminate this defense, meaning manufacturers could be liable even if a defect was undiscoverable at time of sale

**UK Automated Vehicles Act 2024:**

- **User immunity:** Users of AVs are protected from criminal and civil liability when automated features are engaged (with exceptions for failure to respond to transition demands)
- **Insurer primary liability:** Insurers of AVs are directly liable to those who suffer losses from AV accidents when the vehicle is driving itself
- **Data sharing obligations:** Organizations must disclose safety data to support liability allocation
- **Manufacturer/operator backstop:** Ultimate liability sits with manufacturer or operator, not the user

### Implications for Airside Autonomous GSE

Product liability exposure for airside autonomous GSE is particularly acute because:

- **Catastrophic damage potential:** Aircraft damage from GSE collision can be $10M-$139M+, dwarfing typical road AV claims
- **Strict liability applies:** No need to prove negligence -- only that the product was defective and caused harm
- **Multiple claimants:** Airlines, passengers (delay claims), airport operators, other ground handlers, and injured workers could all bring claims from a single incident
- **Joint and several liability:** All parties in the liability chain (OEM, software provider, sensor supplier, integrator) could be jointly liable for the full amount
- **Recall risk:** A systemic software defect could ground an entire fleet of autonomous GSE, creating massive business interruption exposure

---

## 5. Aviation-Specific Insurance Considerations

### The Scale of Ground Damage Exposure

Ground damage to aircraft represents a massive financial burden:

- **US annual direct costs:** Over $1.2 billion
- **US total costs (including indirect):** Nearly $5 billion
- **Global annual costs:** $4 billion to $8 billion; IATA projects this could reach **$10 billion annually by 2035** without intervention
- **Frequency:** Approximately 1 incident per 1,000 departures
- **Cause attribution:** 61% of ground damage incidents are caused by ground servicing equipment (GSE)
- **Widebody vulnerability:** Widebody aircraft are 10x more likely to be damaged on the ground

### Individual Incident Cost Scenarios

| Damage Type | Typical Cost | Worst Case |
|-------------|-------------|------------|
| Minor fuselage dent/scratch | $5,000 - $50,000 | -- |
| Traditional metal wingtip repair | ~$50,000 | -- |
| Composite wingtip repair (modern aircraft) | ~$1,500,000 | -- |
| Average ramp accident (all types) | ~$250,000 | -- |
| Significant structural damage (narrowbody) | $500K - $3M | $5M+ |
| Engine FOD/ingestion from GSE debris | $1M - $35M per engine | -- |
| Widebody major structural damage | $3M - $20M | -- |
| A380 engine replacement (Trent 900) | ~$35M per engine | -- |
| Aircraft write-off (widebody) | -- | $100M - $400M+ |
| Business interruption (widebody AOG) | $100K - $500K/day | -- |

**Real-world example:** Repairs to a Qantas A380 following a major engine incident were estimated at approximately $139 million.

**Key insight for autonomous GSE:** A single autonomous baggage tractor collision with a widebody aircraft engine nacelle could easily generate a $35M-$100M+ claim -- far exceeding the SGHA liability cap and most primary insurance policies.

### Insurance Coverage Gaps in Aviation Ground Damage

The current insurance structure leaves massive gaps:

- **SGHA cap:** Ground handler liability capped at USD 1.5M (or hull deductible)
- **Hull all risk deductibles:** $500K-$1M, meaning airlines absorb the first $500K-$1M
- **Business interruption:** NOT covered by standard hull policies or ground handler agreements
- **Consequential losses:** Schedule disruptions, crew repositioning, passenger compensation, reputational damage -- all uninsured
- **Net result:** Aviation insurers cover approximately **15%** of annual ground damage costs

### Aircraft Damage from Autonomous GSE: Unique Risk Factors

Autonomous GSE introduces new risk dimensions to aircraft ground damage:

- **Sensor degradation:** LiDAR/camera performance in rain, fog, jet blast, de-icing fluid spray, or reflected glare from aircraft surfaces
- **Novel failure modes:** Software crashes, sensor fusion errors, incorrect obstacle classification (e.g., classifying an aircraft wing as a static structure rather than a fragile obstacle)
- **Behavioral unpredictability:** Edge cases in path planning near aircraft with complex geometries (engine nacelles, pitot tubes, open cargo doors)
- **No human judgment backstop:** L4 autonomous operation means no human driver to exercise judgment in ambiguous situations
- **Simultaneous fleet failure:** A software bug or cyber attack could affect all autonomous vehicles simultaneously, unlike human-driven GSE incidents that are statistically independent

---

## 6. Vendor Insurance Approaches: TractEasy and UISEE

### TractEasy (EZTow)

**Background:** Joint venture of Alvest Group (via TLD and Smart Airport Systems) and EasyMile. Targets L4 autonomous baggage and cargo towing.

**Deployments:**
- Changi Airport, Singapore (3 autonomous tractors; operational)
- Narita International Airport, Japan (Level 4 autonomous baggage towing)
- Greenville-Spartanburg International Airport (GSP), USA (demonstration, Sept 2024)
- Toulouse-Blagnac Airport, France (trial deployment)

**Insurance approach:**
- No public disclosure of specific insurance arrangements
- EasyMile (autonomy partner) has extensive experience with insurance for autonomous shuttle deployments in public environments
- Likely structured with product liability coverage held by TLD/EasyMile, supplemented by airport operator's airside liability requirements
- At Changi: must comply with Singapore's TR68 safety standards and CAAS AC-139-7-7 guidance, which likely mandate specific insurance provisions

### UISEE

**Background:** Chinese autonomous driving technology company. Deployed at 20+ major airports worldwide with 2M+ km of fully autonomous airside driving.

**Deployments:**
- Singapore Changi Airport (fully autonomous tractor fleet; 20,000+ km accident-free; commenced Jan 2025)
- Beijing Daxing International Airport (North China's first apron autonomous driving pilot)
- Hangzhou Xiaoshan International Airport (L4 autonomous baggage tractors)
- Hong Kong International Airport (Cathay Cargo Terminal)
- Hamad International Airport, Qatar (trial operations)
- Shanghai Pudong International Airport
- Guangzhou Baiyun Airport

**Insurance and safety certifications:**
- **ISO 21434** -- Road Vehicle Cybersecurity Process Certification
- **ISO 27001** -- Information Security Management Certification
- **Singapore TR68** compliance -- National autonomous vehicle safety standards
- **CAAS AC-139-7-7** compliance (for Singapore operations)
- At Changi: underwent nearly one year of rigorous testing and 5,000+ trial runs before operational approval
- No public disclosure of specific insurance structures or coverage amounts

### Common Patterns Across Vendors

1. **No vendor publicly discloses insurance arrangements** -- this is typically proprietary and negotiated per deployment
2. **Insurance responsibility is shared:** Vendors carry product liability; airport operators carry premises liability; ground handler clients carry operational liability
3. **Safety certification is emphasized over insurance disclosure:** Vendors highlight ISO certifications, safety records (accident-free km), and regulatory compliance rather than insurance structures
4. **Phased deployment reduces initial risk:** All vendors follow a shadow mode -> supervised -> autonomous progression, which aligns with graduated insurance coverage
5. **Airport-specific requirements dominate:** Each airport dictates its own insurance minimums, and vendors must comply through their own policies or their clients' policies

---

## 7. Cyber Insurance for Autonomous Vehicles

### The Cyber Risk Surface

Autonomous vehicles represent a dramatically expanded cyber attack surface:

- **Code complexity:** Modern vehicles contain approximately 100 million lines of code; autonomous vehicles require significantly more
- **Connectivity vectors:** V2X communication, remote monitoring/teleoperation, OTA update channels, GPS/GNSS spoofing, Wi-Fi/cellular connections
- **Physical consequences:** Unlike typical IT cyber attacks, vehicle hacking can cause physical damage, injury, and death
- **Fleet-wide vulnerability:** A single software exploit could potentially compromise an entire fleet simultaneously
- **Airport-specific amplification:** Airside cyber attacks could damage aircraft (catastrophic financial exposure) or disrupt airport operations (national security implications)

### Cyber Insurance Coverage for Autonomous Vehicles

**Coverage types needed:**

| Coverage | Purpose | Typical Limits |
|----------|---------|---------------|
| Cyber Liability (first-party) | Data breach response costs, forensic investigation, notification, credit monitoring | $1M - $10M |
| Cyber Liability (third-party) | Claims from affected parties for data breaches, privacy violations | $1M - $10M |
| Network Security Liability | Liability for failure to prevent unauthorized access to systems | $1M - $10M |
| Technology Errors & Omissions | Claims arising from software defects, algorithmic failures | $1M - $25M |
| Business Interruption (cyber) | Lost revenue during system restoration after cyber incident | $1M - $5M |
| Cyber Extortion/Ransomware | Ransom payments, negotiation costs, system restoration | $500K - $5M |
| Regulatory Defense | Costs of defending against regulatory actions post-breach | $1M - $5M |

**Coverage gaps and exclusions:**

- **War exclusion:** Most cyber policies exclude acts of war and state-sponsored attacks; given that airport infrastructure is a potential state-actor target, this exclusion is significant
- **Infrastructure failure:** Some policies exclude losses from critical infrastructure failure (power grid, telecommunications)
- **Large-scale coordinated attack:** If a mass cyber attack affects thousands of AVs simultaneously, existing insurance capacity may be insufficient
- **Physical damage from cyber:** Many cyber policies exclude bodily injury and property damage -- precisely the consequences of hacking an autonomous vehicle. This creates a coverage gap between cyber and auto/liability policies
- **Known vulnerability exclusion:** Insurers increasingly exclude claims arising from unpatched known vulnerabilities

**Emerging solutions:**

- **Koop Technologies** includes cyber liability as part of its Singularity Package for autonomous vehicles
- **Travelers CyberRisk Tech** covers technology E&O, breach response, cyber crime, and business loss for AV technology companies
- **ISO's Commercial Auto Hacking Expense Coverage Endorsement** provides a framework for auto policies to include cyber-related expenses

### Airport-Specific Cyber Insurance Considerations

- Autonomous GSE operating airside captures sensor data (cameras, LiDAR) that may include images of aircraft, security infrastructure, and restricted areas -- creating national security-sensitive data breach scenarios
- Airport operators increasingly require cyber insurance as a condition of airside operating permits
- Integration with airport IT/OT networks (ATC, baggage handling, flight information systems) creates systemic risk exposure

---

## 8. Data Breach Liability for Sensor Recordings at Airports

### Data Collection Scope

Autonomous vehicles operating airside continuously generate massive amounts of data:

- **Volume:** Up to 19 terabytes per hour of sensor data per vehicle, depending on autonomy level
- **Types:** Camera images/video, LiDAR point clouds, radar returns, GPS tracks, V2X communications, system logs, decision records
- **Sensitive content captured:**
  - Aircraft registration numbers, liveries, and configurations
  - Airport security infrastructure (fences, gates, cameras, patrol patterns)
  - Personnel faces and identification badges
  - Ground handler operational procedures
  - Aircraft loading configurations and cargo details
  - Runway and taxiway layouts and conditions

### Privacy and Data Protection Regulations

**GDPR (EU/UK):**
- Faces and license plates captured by AV sensors constitute personal data under Article 4
- Data controller (likely the AV operator or fleet owner) must have a lawful basis for processing
- Data Protection Impact Assessment (DPIA) required for large-scale systematic monitoring
- Data subjects have right of access, erasure, and portability
- Anonymization (blurring faces, removing identifiers) exempts data from GDPR, but must be performed before data leaves the vehicle or before storage
- **Penalties:** Up to 4% of annual global turnover or EUR 20 million

**Airport Security Data:**
- Sensor recordings of secure airside areas may be classified as security-sensitive
- National aviation security regulations (TSA in US, DfT in UK, national authorities elsewhere) may restrict storage, transmission, and access to such data
- Data recorded by autonomous GSE could be subject to discovery in litigation, creating tension with security classification

**US Privacy Landscape:**
- No federal AV data privacy law; state-by-state patchwork
- California Consumer Privacy Act (CCPA) and state biometric privacy laws (Illinois BIPA) may apply to sensor data
- Airport security data subject to TSA regulations (49 CFR Part 1542)

### Liability for Data Breaches

- **OEM/Software provider liability:** Under the EU PLD 2024/2853, manufacturers are strictly liable if cybersecurity vulnerabilities in their products lead to data breaches
- **Operator liability:** The entity collecting and processing data (ground handler or AV fleet operator) bears data controller responsibility
- **Airport operator liability:** As the entity granting airside access and potentially providing network infrastructure
- **Evidence preservation:** Autonomous vehicles log extensive sensor and control data. Preserving this data is critical for liability determination after incidents, but retention creates ongoing data breach exposure. Some systems overwrite data after short periods, and manufacturers may resist disclosure by claiming trade secret protection.

### Recommended Data Governance for Airside AV Operations

1. Implement real-time anonymization of personal data (face/badge blurring) before storage or transmission
2. Classify and segregate security-sensitive airside recordings
3. Establish clear data retention policies aligned with both safety investigation needs and privacy obligations
4. Define data ownership and access rights in vendor contracts
5. Ensure data processing agreements cover cross-border transfers (relevant for vendors like UISEE headquartered in China processing EU airport data)

---

## 9. Indemnification Clauses in Autonomous Vehicle Contracts

### Typical Contract Structure

Autonomous vehicle deployment contracts for airside operations should address liability allocation through layered indemnification provisions:

**Technology Provider (OEM/Software) Indemnification:**
- Indemnifies the customer (ground handler/airport) against claims arising from:
  - Product defects (hardware and software)
  - System malfunctions during autonomous operation within the defined ODD
  - Cybersecurity breaches attributable to the technology
  - IP infringement claims
  - Failure to meet warranted safety performance metrics

**Customer (Ground Handler/Airport Operator) Indemnification:**
- Indemnifies the technology provider against claims arising from:
  - Improper use outside the defined ODD
  - Failure to perform required maintenance
  - Modifications or integrations not authorized by the technology provider
  - Failure to implement required software updates
  - Negligent supervision during supervised autonomy phases
  - Third-party claims arising from customer's own negligence

### Key Contractual Provisions

**Liability caps:**
- Most contracts include financial liability caps for indirect/consequential damages
- **Typically uncapped:** Intentional misconduct, gross negligence, IP infringement, confidentiality breaches, data protection violations
- **Recommendation for airside:** Given the catastrophic aircraft damage exposure ($10M-$100M+), liability caps must be carefully calibrated. A cap that is too low leaves the operator exposed; a cap that is too high may be commercially unacceptable to the technology provider.

**Warranty provisions:**
- Hardware durability and expected lifespan
- Software compatibility and performance
- Security performance (cybersecurity)
- Regulatory compliance (functional safety standards: ISO 26262, ISO 21448 SOTIF, ISO 21434 cybersecurity)
- System uptime and availability guarantees

**Insurance-backed indemnification:**
- Technology providers should be required to maintain:
  - Product liability insurance: $10M-$50M minimum
  - Professional indemnity/E&O: $5M-$10M minimum
  - Cyber liability: $5M-$10M minimum
  - Commercial general liability: $5M-$10M minimum
- Evidence of coverage should be provided via certificates of insurance with the customer named as additional insured

**Data and evidence provisions:**
- Contractual obligation to preserve event data (sensor logs, decision records, system state) for a defined period after any incident
- Defined protocols for data access during incident investigation
- Prohibition on automatic data deletion before defined retention period
- Clear allocation of data ownership and processing responsibilities

### SGHA Interaction

For ground handlers deploying autonomous GSE under IATA SGHA contracts with airlines:
- The SGHA's USD 1.5M liability cap applies to handler liability for aircraft damage caused by handler negligence
- The handler's contract with the AV technology provider should include back-to-back indemnification -- i.e., the technology provider indemnifies the handler for product defect claims that the handler must in turn satisfy to the airline
- If the autonomous system failure is deemed "reckless," the SGHA cap is removed, and the handler faces potentially unlimited liability -- making technology provider indemnification critical

---

## 10. Regulatory Requirements for Insurance (FAA/EASA/CAAS)

### FAA (United States)

**Current status:** No specific insurance mandate for autonomous GSE on airside.

- **AC 150/5210-20 (Ground Vehicle Operations on Airports):** Requires that "all vehicles operated on the airside must have vehicle liability insurance, as required by the airport operator." The FAA defers to individual airport operators to set minimum coverage amounts.
- **Part 139 CertAlert 24-02 (February 2024):** Addresses AGVS technology at Part 139 certificated airports. Testing, deployment, and operation of AGVS have NOT been "authorized" by the FAA at Part 139 airports, but the FAA "does support testing of AGVS by airports when conducted in a controlled environment." Testing should occur in "remote areas of the airport or landside locations" providing "a more controlled, less-congested, and low-speed environment."
- **Bulletin 25-02 (May 2025):** Updated guidance permitting AGVS operational testing in closed movement areas and safety zones, provided airport sponsors "ensure that associated risks with AGVS are understood, properly considered, and mitigated."
- **Key gap:** "There are no regulations, standards or guidance for stakeholders to follow" regarding autonomous vehicles on airside. The FAA is "currently exploring various approaches to developing standards and guidance."
- **Insurance implication:** In the absence of FAA mandates, airport operators bear responsibility for setting insurance requirements for autonomous GSE. This creates inconsistency across airports.

### EASA (European Union)

**Current status:** No specific regulation for autonomous ground vehicles on airside.

- **Commission Regulation (EU) No 139/2014:** Requires aerodrome operators to operate within a performance-based regulatory framework emphasizing proactive risk management. Ground handling safety and airside operations management are covered, but autonomous vehicles are not specifically addressed.
- **EASA Aerodrome Airside Safety framework:** Covers hazards including FOD, wildlife strikes, and vehicle movements, but does not have specific provisions for autonomous vehicles.
- **EU Product Liability Directive 2024/2853:** While not aviation-specific, applies to autonomous vehicle software and AI systems with strict liability provisions (see Section 4).
- **Insurance implication:** Individual EU Member State aviation authorities and individual airports set insurance requirements. The EU PLD creates a continent-wide product liability framework that autonomous GSE manufacturers must account for.

### CAAS (Singapore)

**Most advanced regulatory framework for airside autonomous vehicles:**

- **AC-139-7-7 (Effective May 10, 2023):** "Guidance on Use of Autonomous Vehicles at the Airside" -- the most comprehensive national guidance document identified. Covers:
  1. Establishment of AV Operations Framework at the Airside
  2. Evaluation and Approval of AV Operations
  3. Training and Competency Requirements
  4. Coordination with Relevant Parties
  5. Maintenance of AV
  6. Safety Performance Monitoring and Data Recording
  7. Reporting and Investigation of Incidents/Accidents
  8. Documentation
- **TR68 (Technical Reference 68):** National autonomous vehicle safety standards covering vehicle behavior, functional safety, cybersecurity, and data formats. UISEE has obtained TR68 compliance for its Changi Airport deployment.
- **Insurance implication:** While specific insurance amounts are not published, CAAS requires comprehensive safety documentation and risk assessment. Insurance requirements are embedded in the operational approval process.

### Other Jurisdictions

- **Australia (CASA):** AC 139.C-14 v1.0 "Airside Vehicle Control" (June 2023) provides guidance on airside vehicle operations but does not specifically address autonomous vehicles.
- **Japan:** Narita Airport's deployment of TractEasy EZTow operates under Japan's Road Transport Vehicle Act and airport-specific safety requirements. Japan has been progressive in allowing L4 autonomous operations.
- **Qatar:** UISEE trial at Hamad International Airport operates under Qatar Civil Aviation Authority requirements.

### Summary of Regulatory Insurance Requirements

| Jurisdiction | Specific AV Insurance Mandate? | Insurance Amount Set By | Key Standard/Guidance |
|-------------|-------------------------------|------------------------|----------------------|
| FAA (US) | No | Individual airport operators | AC 150/5210-20; CertAlert 24-02 |
| EASA (EU) | No (but EU PLD applies) | Member State authorities + airports | Reg 139/2014; PLD 2024/2853 |
| CAAS (Singapore) | Part of operational approval | CAAS + airport operator | AC-139-7-7; TR68 |
| UK CAA | No (but AVA 2024 applies) | Airport operators | Automated Vehicles Act 2024 |
| JCAB (Japan) | No specific AV mandate | Airport operators | Airport-specific approvals |

---

## 11. Structuring Insurance for Phased Deployment

### Phase 1: Shadow Mode / Data Collection (No Autonomous Control)

**Operational profile:** Autonomous system is installed and running but does NOT control the vehicle. Human driver operates normally. System records sensor data and makes "virtual" decisions that are logged but not executed.

**Insurance requirements:**
- Standard airside vehicle liability insurance (per airport requirements, typically $5M-$10M)
- Standard commercial auto coverage
- Workers' compensation for human drivers
- Equipment/property insurance for AV hardware installed on vehicle
- Cyber liability for data collection systems
- **Key consideration:** Primary liability risk remains with the human driver and ground handler. The AV system adds modest incremental risk (additional equipment value, data breach exposure) but no autonomous operation risk.

**Estimated incremental cost over standard GSE insurance:** Minimal (5-15% premium increase for equipment and cyber riders).

### Phase 2: Supervised Autonomy (Safety Driver Present)

**Operational profile:** Autonomous system controls the vehicle within defined ODD. A trained safety operator rides in/on the vehicle or monitors remotely with ability to intervene immediately.

**Insurance requirements:**
- All Phase 1 coverages, PLUS:
- **Enhanced airside liability** with higher limits (recommend $10M-$25M minimum)
- **Product liability coverage** (from AV technology provider, naming ground handler as additional insured)
- **Technology E&O coverage** (from AV technology provider)
- **Enhanced cyber liability** (system is now actively controlling vehicle, increasing cyber-physical risk)
- **Hybrid coverage policy** recommended: splits coverage between human operator (when intervening) and technology provider (when system is in autonomous mode)
- **Key consideration:** The "dual mode" operation creates complex liability allocation. Clear protocols must define when the system is "in control" vs. when the human has taken over. Black box/EDR data must be preserved to determine mode at time of any incident.

**Estimated incremental cost over standard GSE insurance:** Significant (50-150% premium increase, depending on insurer assessment of autonomous technology risk and deployment parameters).

### Phase 3: Fully Autonomous Operation (No Safety Driver)

**Operational profile:** Vehicle operates fully autonomously within defined ODD. May have remote monitoring/teleoperation capability but no human on board.

**Insurance requirements:**
- All Phase 2 coverages, PLUS:
- **Maximum airside liability limits** (recommend $25M-$50M+ given aircraft damage exposure)
- **Dedicated autonomous vehicle liability policy** (not a standard auto policy)
- **Manufacturer/technology provider product liability** must be primary, not excess
- **Remote monitoring/teleoperation coverage** if applicable
- **Comprehensive cyber-physical coverage** bridging cyber and auto/liability policies
- **Business interruption coverage** for fleet-wide autonomous system failures
- **Regulatory compliance coverage** for costs of responding to regulatory investigations after incidents
- **Key consideration:** At L4 with no safety driver, liability shifts substantially to the technology provider. Insurance structure should reflect this with the technology provider carrying primary product liability coverage and the ground handler/operator carrying operational and premises liability.

**Estimated incremental cost over standard GSE insurance:** Substantial (200-500%+ premium increase initially; expected to decrease as operational data demonstrates safety performance).

### Insurance Structure Across Phases

```
Phase 1 (Shadow Mode)
|-- Standard Airside Liability ($5-10M)
|-- Commercial Auto
|-- Workers' Comp
|-- Equipment Insurance
|-- Cyber Liability (basic)
|
Phase 2 (Supervised Autonomy)
|-- Enhanced Airside Liability ($10-25M)
|-- Hybrid Auto/Product Liability
|-- Technology E&O (from vendor)
|-- Product Liability (from vendor)
|-- Enhanced Cyber Liability
|-- Workers' Comp
|
Phase 3 (Full Autonomy)
|-- Maximum Airside Liability ($25-50M+)
|-- Dedicated AV Liability Policy
|-- Product Liability (vendor primary)
|-- Comprehensive Cyber-Physical
|-- Business Interruption
|-- Remote Monitoring Coverage
|-- Regulatory Investigation Coverage
```

### Using Safety Data to Reduce Premiums

Following Swiss Re's empirical approach with Waymo (demonstrating 88% fewer property damage claims for autonomous vs. human-driven vehicles):

1. **Collect and share operational data** from Phase 1 and 2 deployments with insurers
2. **Demonstrate safety performance metrics:** miles/hours between incidents, near-miss frequency, system availability, successful obstacle avoidance events
3. **Benchmark against human-driven GSE:** Use data to quantify safety improvement over human drivers
4. **Negotiate performance-based premium adjustments:** Tie premiums to demonstrated safety outcomes rather than theoretical risk models
5. **Build actuarial credibility:** 12-24 months of clean operational data significantly strengthens negotiating position

---

## 12. Comparison with Road AV Insurance Landscape

### US State Requirements

| Jurisdiction | Insurance Requirement | AV-Specific Provisions |
|-------------|----------------------|----------------------|
| **California** | $5M bond/insurance/self-insurance for AV testing and deployment permits (DMV requirement) | Mandatory crash and disengagement reporting; insurer must disclose AV claim handling procedures |
| **Arizona** | Standard state minimums apply; no AV-specific enhancement | Executive order permitting AV testing; standard registration/insurance requirements |
| **Texas** | Standard state minimums apply | Permits AV operation without human driver; no enhanced insurance requirement |
| **Florida** | Standard state minimums apply | Permits AV operation without human driver |
| **Nevada** | $5M bond/insurance for AV testing | First state to permit AV testing (2011) |
| **42 states + DC** | Various AV legislation enacted | Requirements vary; most defer to standard insurance minimums |

### UK Framework

The UK's Automated Vehicles Act 2024, building on the Automated and Electric Vehicles Act 2018 (AEVA):
- Insurers of AVs are **directly liable** to those who suffer losses from AV accidents when the vehicle is driving itself
- Users are protected from criminal and civil liability during autonomous operation
- Creates the most explicitly manufacturer/insurer-focused liability framework globally
- Insurance policies must cover the vehicle in both manual and autonomous modes

### Key Differences: Road AV vs. Airside AV Insurance

| Dimension | Road AV | Airside AV |
|-----------|---------|------------|
| **Regulatory framework** | Extensive (DMV/state regulations, NHTSA guidelines, EU type approval) | Minimal (no specific FAA/EASA standards; CAAS AC-139-7-7 is most advanced) |
| **Insurance minimums** | Defined by state law ($5M in California for testing) | Defined by individual airport operators ($1M-$100M) |
| **Third-party exposure** | Pedestrians, other vehicles, property -- typically $1M-$10M per incident | Aircraft, airport infrastructure, personnel -- potentially $10M-$400M+ per incident |
| **Policy type** | Commercial auto or personal auto with AV endorsement | Aviation/airside liability (standard auto policies do not respond) |
| **Market maturity** | Emerging but growing (Koop, Waymo fleet insurance, state frameworks) | Very early (no dedicated products; adapted from traditional aviation liability) |
| **Safety data availability** | Growing (Waymo 25M+ miles, Cruise data, NHTSA AV crash reports) | Very limited (UISEE 2M+ km is largest dataset; few published safety studies) |
| **Actuarial modeling** | Developing (Swiss Re ADAS Risk Score, Waymo data) | Non-existent for autonomous operations (traditional GSE data available) |
| **Cyber risk amplification** | Urban environment with many connected systems | Airport critical infrastructure environment with national security implications |
| **Product liability jurisdiction** | Varies by state/country; EU PLD 2024 for EU | Same product liability frameworks apply, but aviation-specific damages dramatically increase exposure |
| **Claims frequency expectation** | Moderate (urban driving is high-exposure) | Low frequency but extreme severity (confined ODD, low speed, but catastrophic damage potential) |

### Lessons from Road AV Insurance for Airside Deployment

1. **California's $5M requirement** is a useful reference point but likely insufficient for airside operations given aircraft damage exposure. Airside AV operators should target $10M-$50M+ depending on aircraft types served.
2. **Hybrid coverage models** being developed for road AVs (splitting human/autonomous mode liability) are directly applicable to supervised autonomy phases on airside.
3. **Fleet insurance models** (Waymo's approach) are more appropriate for airside AV operations than individual vehicle policies.
4. **OEM/software provider product liability** is emerging as the primary coverage for L4+ operations on roads -- the same principle should apply to airside L4 autonomous GSE.
5. **Data-driven premium reduction** (Swiss Re/Waymo model) is the path to affordable insurance for airside autonomous operations.

---

## 13. Recommendations for an Airside AV Operator

### Insurance Strategy

1. **Engage an aviation specialty broker early** -- Marsh, WTW, or Aon aviation practices have airside liability expertise. Supplement with Koop Technologies for AV-specific coverage components.

2. **Layer coverage across multiple policies:**
   - Primary: Airside liability ($10M minimum, aviation-rated)
   - Product liability: Require AV technology vendor to maintain $10M-$25M product liability with your organization named as additional insured
   - Cyber: $5M-$10M cyber-physical coverage bridging the gap between cyber and auto/liability policies
   - Excess/umbrella: Sufficient to meet airport requirements (potentially $25M-$50M+)
   - Workers' comp and equipment insurance as appropriate

3. **Negotiate insurance-backed indemnification** with AV technology provider:
   - Technology provider should be primary for software/hardware defect claims
   - Back-to-back indemnification structure if operating under SGHA with airlines
   - Uncapped indemnification for gross negligence/recklessness to match SGHA exposure

4. **Structure insurance for phased deployment** as outlined in Section 11, with coverage expanding as autonomy level increases.

5. **Build safety data portfolio** from day one:
   - Instrument shadow mode deployments for comprehensive data collection
   - Track and report safety metrics that insurers can use for actuarial modeling
   - Engage target insurers during pilot phase to establish baseline expectations

### Risk Management

6. **Develop a comprehensive safety case** before deployment, including:
   - Hazard Analysis and Risk Assessment (HARA) per ISO 26262 / ISO 21448 (SOTIF)
   - Operational Design Domain definition with clear boundaries
   - Minimum risk condition (MRC) and fallback procedures
   - Remote monitoring and teleoperation protocols

7. **Implement aircraft proximity safeguards:**
   - Geofenced exclusion zones around aircraft (especially engines, control surfaces, pitot tubes)
   - Speed limiting near aircraft (1-3 mph approach speed)
   - Mandatory stop-and-verify before entering aircraft service area
   - Redundant obstacle detection systems for aircraft proximity operations

8. **Establish incident response protocols:**
   - Automated data preservation on any anomaly or incident
   - Chain of custody procedures for sensor logs and decision records
   - Immediate notification procedures for airport operator, airline, and FAA/national authority
   - Evidence preservation protocols that comply with both safety investigation and litigation requirements

9. **Address cyber risk proactively:**
   - Network segmentation between AV systems and airport IT/OT
   - Regular penetration testing and vulnerability assessment
   - Incident response plan specifically addressing vehicle hacking scenarios
   - Compliance with ISO 21434 (cybersecurity) and relevant national standards

10. **Manage data breach risk:**
    - Implement on-vehicle data anonymization before cloud upload
    - Minimize storage of security-sensitive airside imagery
    - Maintain GDPR/CCPA compliance programs for sensor data
    - Define data retention policies balancing safety investigation needs with privacy obligations

### Regulatory Engagement

11. **Engage proactively with aviation regulators:**
    - Contact FAA Airport Certification and Safety Inspector or EASA/national authority early
    - Participate in industry working groups developing autonomous GSE standards
    - Share safety data to support development of evidence-based regulations
    - Anticipate that future regulations will likely require specific insurance minimums for autonomous airside operations

12. **Monitor regulatory developments:**
    - FAA standards and guidance for AGVS (in development)
    - EASA aerodrome safety framework updates
    - EU Product Liability Directive transposition by Member States (deadline: December 9, 2026)
    - UK AV Act 2024 implementing regulations
    - CAAS AC-139-7-7 updates and Singapore TR68 evolution

---

## 14. Sources

### Liability and Legal Framework
- [Autonomous Vehicles and Liability Law - Oxford Academic](https://academic.oup.com/ajcl/article/70/Supplement_1/i39/6655619)
- [Navigating Liability in the Age of Autonomous Vehicles - WSHB Law](https://www.wshblaw.com/publication-navigating-liability-in-the-age-of-autonomous-vehicles)
- [Autonomous Trucking Faces Growing Product Liability Risks - FreightWaves](https://www.freightwaves.com/news/autonomous-trucking-faces-growing-product-liability-risks)
- [Self-Driving Car Liability - Wikipedia](https://en.wikipedia.org/wiki/Self-driving_car_liability)
- [Navigating Liability in IoT and Autonomous Vehicle Contracts - Global Law Experts](https://globallawexperts.com/navigating-liability-in-iot-and-autonomous-vehicle-contracts-practical-tips-for-effective-risk-management/)
- [UK Automated Vehicles Act 2024 - 39 Essex Chambers](https://www.39essex.com/our-thinking/insights/uks-automated-vehicles-act-2024-comprehensive-overview/)
- [UK AV Act 2024 Implementation - GOV.UK](https://www.gov.uk/government/speeches/automated-vehicles-act-2024-implementation)

### EU Product Liability Directive
- [New EU Product Liability Directive: Key Implications for Automotive and AV Companies - Reed Smith](https://www.reedsmith.com/en/perspectives/2025/10/the-new-eu-product-liability-key-implications-autonomous-vehicle)
- [EU Product Liability Directive 2024: Impact on the Automotive Industry - CyEQT](https://www.cyeqt.com/en/new-eu-product-liability-directive-2024-automotive-industry/)
- [EU Directive 2024/2853 - EUR-Lex](https://eur-lex.europa.eu/eli/dir/2024/2853/oj/eng)

### Insurance Products and Reinsurers
- [Liability for Autonomous Vehicles - Munich Re](https://www.munichre.com/en/insights/mobility-and-transport/liability-autonomous-vehicles.html)
- [Modern Mobility and Transport Risks - Munich Re](https://www.munichre.com/en/risks/mobility-transport.html)
- [Emerging Business Models for Autonomous Vehicles - Swiss Re](https://www.swissre.com/institute/research/topics-and-risk-dialogues/digital-business-model-and-cyber-risk/emerging-business-models-autonomous-vehicles.html)
- [Waymo Shows 90% Fewer Claims - Swiss Re / Reinsurance News](https://www.reinsurancene.ws/waymo-shows-90-fewer-claims-than-advanced-human-driven-vehicles-swiss-re/)
- [BMW and Swiss Re Insurance Concept - BMW Group Press](https://www.press.bmwgroup.com/global/article/detail/T0284965EN/bmw-group-and-swiss-re-develop-ground-breaking-car-insurance-concept)
- [Insurance for Autonomous Vehicles and Robotics - Koop / Autonomy.Insurance](https://www.autonomy.insurance/)
- [Insurance for AV Technology Companies - Travelers](https://www.travelers.com/business-insurance/technology/autonomous-vehicle-technology-companies)
- [Autonomous Vehicle Insurance Predictions - Deloitte](https://www.deloitte.com/us/en/insights/industry/financial-services/fsi-autonomous-vehicle-insurance-predictions.html)

### Airport and Aviation Insurance
- [Airport Liability Insurance - Global Aerospace](https://www.global-aero.com/aviation-insurance-coverage/airport-insurance-ground-handler-insurance/)
- [Airside Liability Insurance - Marsh](https://www.marsh.com/en/industries/aviation-space/expertise/airside-liability-insurance-coverage-for-contractors-and-concessionaires.html)
- [Airports, Ground Handlers Insurance - Marsh](https://www.marsh.com/en/industries/aviation-space/expertise/airports-air-navigation-service-providers-ground-handlers-refuellers-insurance.html)
- [Aviation Insurance Broking - WTW](https://www.wtwco.com/en-us/solutions/services/aerospace)
- [Aviation Insurance and Risk Management - Aon](https://www.aon.com/en/capabilities/risk-transfer/aviation-insurance-and-risk-management)
- [ACI-NA Airport Operating/Use Agreement Insurance Requirements](https://airportscouncil.org/wp-content/uploads/2018/11/AOA-Requirements.pdf)
- [AirsideDrive Program - Denver International Airport](https://www.flydenver.com/business-and-community/airsidedrive-program/)

### Ground Damage and GSE
- [The Costs of Ground Damage - Aviation Pros](https://www.aviationpros.com/aircraft/maintenance-providers/article/21279424/the-costs-of-ground-damage)
- [The Impacts of Insurance on Ground Service - Aviation Pros](https://www.aviationpros.com/ground-handling/ground-handlers-service-providers/ramp-services/article/21163823/the-impacts-of-insurance-on-ground-service)
- [Ground Damage: Who Pays? - Airline Routes & Ground Services](https://airlinergs.com/issue-article/ground-damage-who-pays/)
- [Liability Exposures for Ground Handlers - Deinon](https://deinon.ae/liability-exposures-for-ground-handlers/)
- [Ground Handling: Liability & Indemnity - McLarens](https://www.mclarens.com/ground-handling-liability-indemnity/)
- [IATA SGHA - What Has Changed - IATA](https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/what-is-the-iata-standard-ground-handling-agreement-sgha-and-what-has-changed-in-the-latest-edition/)
- [IATA: Annual Cost of Ground Damage Could Reach $10 Billion - Simple Flying](https://simpleflying.com/iata-cost-of-ground-damage-aircraft-10-billion/)

### Autonomous GSE Vendors
- [TractEasy](https://tracteasy.com/)
- [TractEasy Greenville-Spartanburg Deployment](https://tracteasy.com/news/eztow-autonomous-tow-tractor-deployed-at-greenville-spartanburg-international-airport/)
- [TractEasy Level 4 Autonomous Baggage Towing in Japan](https://tracteasy.com/news/tracteasy-announces-first-level-4-autonomous-baggage-towing-in-japan/)
- [UISEE Changi Airport Autonomous Tractor Fleet](https://www.uisee.com/en/article226-news1.html)
- [UISEE Beijing Daxing Airport Pilot](https://autonews.gasgoo.com/icv/70036759.html)
- [UISEE Hamad International Airport Trial](https://autonews.gasgoo.com/icv/70036036.html)
- [Autonomous GSE: The Shape of Things to Come - Airports International](https://www.airportsinternational.com/article/autonomous-gse-shape-things-come)

### Cyber Insurance and Data Privacy
- [Automotive Hacking: The Cyber Risk - Insurance Business America](https://www.insurancebusinessmag.com/us/news/cyber/automotive-hacking--the-cyber-risk-auto-insurers-must-consider-416511.aspx)
- [When Autonomous Vehicles Are Hacked, Who Is Liable? - RAND](https://www.rand.org/pubs/research_reports/RR2654.html)
- [Insuring Cyber Risks of Connected and Autonomous Vehicles - AXA](https://www.axa.com/en/insights/insuring-the-cyber-risks-of-connected-and-autonomous-vehicles)
- [Cyber Risk for Vehicles - Marsh McLennan](https://www.marshmclennan.com/insights/publications/2022/april/cyber-risk-for-vehicles.html)
- [Data Privacy in Autonomous Vehicles - Gallio](https://gallio.pro/blog/data-privacy-in-autonomous-vehicles/)
- [Autonomous Driving and Data Protection - Taylor Wessing](https://www.taylorwessing.com/en/interface/2024/onwards-and-upwards/autonomous-driving-and-data-protection)

### Regulatory
- [FAA Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [FAA AC 150/5210-20 Ground Vehicle Operations on Airports](https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5210_20_chg1.doc)
- [FAA Part 139 CertAlert 24-02: AGVS Technology](https://www.faa.gov/sites/faa.gov/files/arp-part-139-cert-alert-24-02-AV-AVGS.pdf)
- [CAAS AC-139-7-7 Guidance on Autonomous Vehicles at Airside](https://www.caas.gov.sg/docs/default-source/docs---srg/ac-139-7-7-guidance-on-use-of-autonomous-vehicles-at-the-airside.pdf)
- [Singapore TR68 Enhanced Standards for AVs - LTA](https://www.lta.gov.sg/content/ltagov/en/newsroom/2021/9/news-releases/enhanced-national-standards-for-the-safe-deployment-of-autonomou.html)
- [California DMV Autonomous Vehicle Testing](https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/testing-autonomous-vehicles-with-a-driver/)
- [NAIC Insurance Topics: Autonomous Vehicles](https://content.naic.org/insurance-topics/autonomous-vehicles)
- [EASA Aerodromes & Ground Handling](https://www.easa.europa.eu/light/topics/aerodromes-ground-handling)

### Road AV Insurance Comparison
- [How Autonomous Vehicles Will Change Car Insurance - S&P Global](https://www.spglobal.com/automotive-insights/en/blogs/2025/08/autonomous-vehicles-future-of-car-insurance)
- [California 2025 Self-Driving Car Insurance Rules - Pronto Insurance](https://www.prontoinsurance.com/blog/california-2025-self-driving-car-insurance-rules/)
- [Impact of Autonomous Vehicles on Auto Insurance 2025 - Inszone Insurance](https://inszoneinsurance.com/blog/impact-of-av-on-auto-insurance)
- [Self-Driving Cars and Insurance - Progressive](https://www.progressive.com/answers/insurance-for-driverless-cars/)
- [Background on Self-Driving Cars and Insurance - III](https://www.iii.org/article/background-on-self-driving-cars-and-insurance)
- [Goldman Sachs Predicts AV Insurance Costs - Fortune](https://fortune.com/2025/06/11/goldman-sachs-autonomous-cars-insurance-costs-fault-accidents/)
- [Autonomous Vehicles and the Future of Auto Insurance - RAND](https://www.rand.org/pubs/research_reports/RRA878-1.html)

### Aviation Insurance Market
- [Aviation Risk, Claims and Insurance Outlook 2024 - Allianz](https://commercial.allianz.com/news-and-insights/news/aviation-trends-2024.html)
- [2025 Aviation Insurance Landscape - Atlantic Jet Partners](https://atlanticjetpartners.com/the-2025-aviation-insurance-landscape-key-trends-and-what-they-mean-for-you/)
- [State of the Insurance Market 2025: Aviation - Risk Strategies](https://www.risk-strategies.com/state-of-the-insurance-market-2025-outlook-aviation)
