# ISO 3691-4 Deep Dive: Driverless Industrial Trucks Safety Standard

## Complete Technical Analysis for Airport Autonomous Vehicle Deployment

This document provides a detailed technical breakdown of ISO 3691-4:2020 and its 2023 revision -- the primary safety standard used by TractEasy (EasyMile/TLD) and reference airside AV stack for autonomous vehicle deployment at airports. It supplements the overview in [certification-guide.md](certification-guide.md) with clause-level detail, exact Performance Level requirements, audit procedures, and practical guidance for handling AI/ML components under a standard not originally designed for them.

---

## Table of Contents

1. [Standard Identity and Status](#1-standard-identity-and-status)
2. [Complete Clause Structure](#2-complete-clause-structure)
3. [Safety Functions and Performance Levels (Table 1)](#3-safety-functions-and-performance-levels-table-1)
4. [Operating Zones (Annex A)](#4-operating-zones-annex-a)
5. [Hazard List (Annex B)](#5-hazard-list-annex-b)
6. [Verification Methods (Clause 5 and Annex E)](#6-verification-methods-clause-5-and-annex-e)
7. [Documentation Requirements (Clause 6)](#7-documentation-requirements-clause-6)
8. [Compliance Audit Process Step by Step](#8-compliance-audit-process-step-by-step)
9. [Notified Bodies and Assessment Organizations](#9-notified-bodies-and-assessment-organizations)
10. [Cost Breakdown and Timeline](#10-cost-breakdown-and-timeline)
11. [How TractEasy Meets the Requirements](#11-how-tracteasy-meets-the-requirements)
12. [How reference airside AV stack Meets the Requirements](#12-how-airside-meets-the-requirements)
13. [Differences Between 2020 and 2023 Editions](#13-differences-between-2020-and-2023-editions)
14. [Required Documentation Package](#14-required-documentation-package)
15. [Handling AI/ML Components Under ISO 3691-4](#15-handling-aiml-components-under-iso-3691-4)
16. [Relationship with Machinery Directive and Machinery Regulation](#16-relationship-with-machinery-directive-and-machinery-regulation)
17. [Related Standards Ecosystem](#17-related-standards-ecosystem)

---

## 1. Standard Identity and Status

**Full Title:** ISO 3691-4:2023 -- Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks and their systems

**Type:** Type-C standard per ISO 12100 (specific machine safety standard)

**Replaces:** EN 1525:1997 (Safety of industrial trucks -- Driverless trucks and their systems)

**Current Edition:** Second edition, published June 2023 (replaces 2020 first edition)

**Page Count:** 82 pages, six main clauses, five annexes

**Standard Cost:** $200 USD (ANSI members) / $250 USD (non-members) via ANSI Webstore

**Harmonization Status:** Harmonized with EU Machinery Directive 2006/42/EC as of May 2024 (published in the Official Journal of the European Union). This gives the standard "presumption of conformity" -- compliance with ISO 3691-4 creates a legal presumption that the essential health and safety requirements (EHSRs) of the Machinery Directive are satisfied.

**Scope Includes:**
- Automated guided vehicles (AGVs)
- Autonomous mobile robots (AMRs)
- Automated guided carts (AGCs)
- Autonomous tow tractors (e.g., TractEasy EZTow)
- Autonomous baggage dollies (e.g., reference airside AV stack autonomous baggage/cargo tug)
- Tunnel tuggers, under carts, and similar driverless platforms
- Vehicles with automatic modes, rider transport capability, and maintenance modes

**Scope Excludes:**
- Vehicles guided solely by mechanical means (rails, guides)
- Remotely controlled trucks without autonomous capability
- Public road vehicles, military vehicles
- Explosive atmosphere environments
- Noise, vibration, and radiation hazards (addressed by other standards)
- Hazardous load transport

---

## 2. Complete Clause Structure

### Clause 1 -- Scope
Defines the boundaries of the standard's applicability. Specifies that the document covers driverless industrial trucks as defined in ISO 5053-1, including AGVs and AMRs.

### Clause 2 -- Normative References
Lists all standards required for compliance. Key referenced standards include:
- **ISO 12100:2010** -- Safety of machinery, general principles for design, risk assessment and risk reduction
- **ISO 13849-1** -- Safety-related parts of control systems (Performance Level approach)
- **ISO 13849-2** -- Validation of safety-related parts
- **ISO 13850:2015** -- Emergency stop function requirements
- **EN 1175:2020** -- Electrical requirements for industrial trucks
- **IEC 60204-1** -- Electrical equipment of machines
- **IEC 61496** -- Electro-sensitive protective equipment (safety light curtains, scanners)
- **IEC 62998 series** -- Safety-related sensors used for protection of persons (newer, allows more sensor types)

### Clause 3 -- Terms and Definitions
Key terms defined in the standard (2023 edition added "active detection field" and "operational stop"):
- **Driverless industrial truck**: Powered truck designed to operate automatically without a driver
- **Operating zone**: Area in which the truck operates during automatic mode
- **Restricted zone**: Physically separated area accessible only to authorized personnel
- **Confined zone**: Perimeter-safeguarded area allowing any operating speed
- **Active detection field** (new in 2023): The sensing area used for personnel detection
- **Operational stop** (new in 2023): A controlled stop that brings the truck to a standstill while maintaining readiness for restart
- **Safety-related parts of control systems (SRP/CS)**: Parts whose failure can lead to hazardous situations

### Clause 4 -- Safety Requirements (Core Technical Requirements)

This is the most substantial clause, covering all technical safety requirements. Key subclauses include:

| Subclause | Topic | Key Requirements |
|-----------|-------|------------------|
| 4.1 | General | Design shall avoid hazards and mitigate risks per ISO 12100 |
| 4.2 | Braking system | Service brake PLd; must stop before contact with stationary objects; automatic activation on power/control loss |
| 4.3 | Speed control | Speed monitoring required; emergency stop if speed exceeds rated maximum; stability monitoring during all operating conditions |
| 4.4 | Energy supply | Battery and charging safety; safeguards for automatic charging above 60 VDC or 25 VAC |
| 4.5 | Mechanical hazards | Sharp edge prohibition; ground clearance to prevent foot entrapment; guard requirements |
| 4.6 | Steering | Safety-related steering control; PL requirements per Table 1 item 13 |
| 4.7 | Stability | Stability requirements under all operating conditions and load configurations; rated capacity determination per Annex C |
| 4.8 | Stop functions | 4.8.1: Emergency stop per ISO 13850:2015; 4.8.2: Normal stop; operational stop (2023) |
| 4.9 | Control devices | Mode selection requirements; automatic/manual/maintenance mode switching |
| 4.10 | Personnel detection | Detection in direction of travel for full width of truck plus load; zone-specific detection requirements |
| 4.11 | Safety functions table | Table 1: Complete list of 27 safety functions with minimum PLr per ISO 13849-1 |

**Critical Subclause Details:**

**4.2 Braking System:**
- Service brake must achieve PLd (Performance Level d)
- Must stop the truck before contact with any stationary object
- Brake must automatically engage on power failure or control system failure
- Braking distance calculations required for all load conditions and speeds
- Deceleration rates must be documented and verified

**4.3 Speed Control:**
- Continuous speed monitoring is mandatory
- Emergency stop activation required if speed exceeds manufacturer's rated maximum
- Speed must be monitored to ensure stability during all operating conditions
- Speed monitoring during load-handling movements, including emergency or protective stops
- Speed limits dependent on zone type (see Annex A tables)

**4.8 Stop Functions:**
- Emergency stop must conform to ISO 13850:2015
- E-stop devices must be within 600 mm of any hazardous point on the vehicle
- Maximum distance between E-stop buttons on the vehicle is now specified (2023 edition)
- All movements must cease upon E-stop activation
- Operational stop (2023): brings truck to controlled standstill with restart capability

**4.10 Personnel Detection:**
- Must detect persons in the intended path for the entire width of truck and load
- Safety field must extend with maximum gap of 180 mm between edge of safety fields
- Detection must achieve stop function within 600 mm (stopping distance from detection boundary)
- Side monitoring required: speed must reduce when lateral clearance drops below 0.5 m
- Automatic restart prohibited when insufficient side clearance exists after safety-field-triggered stop
- Directional safety fields required for all movement directions, including turning (a significant upgrade from EN 1525, which only required forward-facing fields)

### Clause 5 -- Verification of Safety Requirements
Specifies test methods and procedures for validating compliance. See Section 6 below.

### Clause 6 -- Information for Use
Documentation and instruction manual requirements. See Section 7 below.

### Annexes

| Annex | Type | Content |
|-------|------|---------|
| A | Normative | Preparation of operating zones -- zone types, clearance requirements, speed tables |
| B | Informative | List of significant hazards -- hazard identification reference for risk assessment |
| C | Normative | Rated capacity determination methodology |
| D | Informative | Load transfer operation guidance |
| E | Normative | Verification methods table -- maps each subclause to required verification method(s) |

---

## 3. Safety Functions and Performance Levels (Table 1)

Table 1 in Clause 4.11 is the central reference for functional safety compliance. It lists 27 safety functions with their associated hazards (cross-referenced to Annex B) and minimum required Performance Level (PLr) per ISO 13849-1.

### Performance Level Scale (ISO 13849-1)

| Level | Probability of Dangerous Failure (PFHd) | Reliability |
|-------|----------------------------------------|-------------|
| PLa | >= 10^-5 to < 10^-4 per hour | Lowest |
| PLb | >= 3 x 10^-6 to < 10^-5 per hour | Low |
| PLc | >= 10^-6 to < 3 x 10^-6 per hour | Medium |
| PLd | >= 10^-7 to < 10^-6 per hour | High |
| PLe | < 10^-7 per hour | Highest |

### Key Safety Functions and Their Required PLr

**Confirmed from standard and TUV Rheinland whitepaper analysis:**

| SF# | Safety Function | Min PLr | Clause Ref | Primary Hazard |
|-----|----------------|---------|------------|----------------|
| 1 | Braking system control (deceleration) | **PLd** | 4.2 | Collision with persons |
| 2 | Parking braking system control | **PLb** | 4.2 | Unintended motion / collision |
| 3 | Speed monitoring / overspeed detection | **PLc** | 4.3 | Collision due to excessive speed |
| 4 | Personnel detection -- forward travel (automatic mode) | **PLd** | 4.10 | Collision with persons in path |
| 5-9 | Additional directional detection functions | **PLd** | 4.10 | Collision with persons (various directions) |
| 10-12 | Load handling -- lift / tilt / side-shift control | **PLc** | 4.5, 4.7 | Falling/shifting load |
| 13 | Steering system control | **PLc** | 4.6 | Loss of directional control |
| 14 | Speed reduction in limited clearance zones | **PLc** | 4.3, Annex A | Crushing due to inadequate clearance |
| 15 | Emergency stop function | **PLd** | 4.8.1 | Inability to stop in emergency |
| 16-17 | Personnel detection -- turning / lateral movement | **PLd** | 4.10 | Collision during maneuvers |
| 18-19 | Mode selection and transition control | **PLc** | 4.9 | Unintended mode change |
| 20 | Detection muting / bypass control | **PLd** | 4.10 | Bypassed safety during transitions |
| 21-27 | Application-specific functions (battery monitoring, communication loss, path deviation, etc.) | **PLb-PLc** | Various | Various application hazards |

**Key Observations:**
- All personnel detection functions require **PLd** -- the second-highest level
- Braking requires **PLd**, while parking brake requires only **PLb** (lower risk of injury from static condition)
- Emergency stop requires **PLd**
- Load handling and steering functions require **PLc** (moderate reliability)
- The PL requirements are derived from the hazard risk assessment in Annex B using the risk graph method of ISO 13849-1

### Architectural Requirements for Achieving PLd

To achieve PLd, the system architecture must meet at minimum one of:
- **Category 2, HFT=0**: Single-channel with diagnostic monitoring (diagnostic coverage >= 90%)
- **Category 3, HFT=1**: Dual-channel (redundant) with cross-monitoring

Most implementations in practice use **Category 3** with redundant safety controllers (dual-channel architecture) for the critical PLd functions, as this provides greater fault tolerance.

---

## 4. Operating Zones (Annex A)

Annex A (normative) defines five zone types with distinct requirements:

### Zone Types

**1. Operating Zone**
- Normal area where truck operates in automatic mode alongside personnel
- Minimum clearance: 0.5 m wide on both sides of path, to a height of 2.1 m
- Full personnel detection required
- Restart protocols required after safety stops
- Acoustic and/or optical warnings required

**2. Operating Hazard Zone**
- Area with inadequate clearance or unprotected personnel exposure
- Speed restrictions per Tables A.1 and A.2 apply
- Additional acoustic/optical warnings mandatory
- Personnel detection must identify persons within 180 mm from edge of safety fields
- Enhanced risk assessment required

**3. Restricted Zone**
- Physically separated space accessible only to authorized personnel
- Speed limits per Tables A.1 and A.2
- Supplemental warning systems required
- 2023 edition allows higher speeds with detailed hazard analysis and additional protective measures
- Speed <= 0.3 m/s with muted detection capability

**4. Confined Zone**
- Perimeter-safeguarded operating space
- Any speed is permitted within the zone
- Interlocking devices must stop trucks upon door/access point opening
- Physical barriers (fencing, walls) required
- Access control mandatory

**5. Load Transfer Zone**
- Specific area where load transfer operations occur
- Additional requirements per Annex D
- Separate risk assessment for transfer operations

### Speed Requirements

Annex A Tables A.1 and A.2 define maximum allowable speeds based on zone type and clearance dimensions. The general principle: less clearance or more personnel exposure = lower speed limit.

### Environmental Conditions

Standard operating conditions:
- Temperature: -20 C to +40 C
- Maximum altitude: 2,000 m
- Normal climatic conditions per referenced standards

---

## 5. Hazard List (Annex B)

Annex B (informative) provides a comprehensive list of significant hazards that the standard addresses. This list is used to:
- Drive the risk assessment process per ISO 12100
- Determine the required Performance Levels in Table 1
- Identify which safety functions are needed for a specific vehicle design

**Hazard Categories:**

| Category | Examples |
|----------|----------|
| Mechanical | Crushing, shearing, cutting, entanglement, drawing-in, impact, stabbing/puncture, friction/abrasion |
| Electrical | Direct/indirect contact, electrostatic phenomena, thermal radiation from short circuits |
| Thermal | Burns from hot/cold surfaces or materials |
| Noise | Hearing damage (noted but excluded from standard's scope) |
| Vibration | Whole-body/hand-arm vibration (noted but excluded from scope) |
| Radiation | Non-ionizing radiation from electronic components |
| Material/substance | Contact with or inhalation of harmful materials (battery gases, etc.) |
| Ergonomic | Postures, human effort (for maintenance mode interactions) |
| Operating environment | Inadequate lighting, slip/trip hazards, dust, electromagnetic interference |
| Unexpected start-up | Power restoration, mode transition failures |
| Failure to stop | Brake failure, control system failure |
| Speed variation | Overspeed, uncontrolled acceleration |
| Stability loss | Tip-over, load shift |
| Falling objects | Dropped loads, detached components |

**2023 Addition:** The revised edition added additional hazards including transport-related hazards, temperature extremes, emissions, and electrostatic phenomena -- reflecting broader operational experience with deployed AGV/AMR systems.

---

## 6. Verification Methods (Clause 5 and Annex E)

### Clause 5 -- Verification of Safety Requirements and Protective Measures

Clause 5 specifies the testing and verification procedures to validate that all safety requirements from Clause 4 are met. This section is primarily used by OEMs during design verification and by auditors during third-party assessment.

### Verification Method Types

Annex E (normative) maps every subclause in Clause 4 to one or more required verification methods:

| Method Code | Method | Description |
|-------------|--------|-------------|
| A | Analysis | Engineering analysis, calculations, FMEA, fault tree analysis |
| D | Drawing review | Review of design drawings, schematics, layouts |
| F | Functional test | Operational testing of safety functions under specified conditions |
| I | Inspection | Physical inspection of the manufactured product |
| T | Type test | Standardized test to a defined protocol (e.g., detection test, braking test) |
| M | Measurement | Quantitative measurement of parameters (distances, forces, speeds) |

### Key Verification Tests

**Test for Detection of Persons (Clause 5.x):**
- Standardized test objects placed in the vehicle's path
- Vehicle must detect and stop within specified distances
- Tested for all travel directions, including turning
- Must cover the full width of the vehicle plus load
- Test conditions specified for various environmental scenarios

**Braking Performance Test:**
- Measured stopping distances at various speeds and load conditions
- Brake performance on gradients
- Brake performance under single-fault conditions (one brake circuit failed)
- Verification of automatic brake engagement on power loss

**Stability Testing:**
- Static and dynamic stability tests per rated capacity
- Tests at maximum speed, maximum load, maximum gradient
- Cornering stability verification

**EMC Testing:**
- Electromagnetic compatibility per relevant IEC/EN standards
- Ensures safety systems are not affected by electromagnetic interference
- Critical for airport environments with high RF activity

---

## 7. Documentation Requirements (Clause 6)

ISO 3691-4 Clause 6 specifies comprehensive documentation requirements that go beyond earlier standards, explicitly referencing ISO 12100:2010 for risk assessment documentation.

### Required Documentation Categories

**Instruction Manual Must Include:**
- Complete vehicle specifications (dimensions, weight, capacity)
- Operational limits (max speed, gradient, load)
- Environmental operating conditions (temperature, altitude, humidity)
- PPE requirements for personnel in operating zones
- Safety guidelines for all operational modes
- Maintenance procedures and schedules
- Zone preparation instructions per Annex A
- Emergency procedures and E-stop locations
- Residual risk information

**Technical Construction File (TCF) Must Include:**
- General description of the machinery
- Overall drawing of the machinery plus control circuit diagrams
- Detailed drawings with calculations, test results, certificates
- Risk assessment documentation per ISO 12100
- List of all applicable standards (ISO 3691-4, ISO 13849-1, etc.)
- List of essential health and safety requirements addressed
- Description of protective measures implemented
- Test reports and test results
- Instructions for use (copy of the instruction manual)
- Declaration of Incorporation for partly completed machinery or Declaration of Conformity
- Declarations of Conformity for all incorporated safety components

---

## 8. Compliance Audit Process Step by Step

### Phase 1: Pre-Assessment (Manufacturer Internal -- 2-6 months)

1. **Purchase and study the standard** -- Obtain ISO 3691-4:2023 ($200-250 USD)
2. **Conduct risk assessment** -- Full hazard analysis per ISO 12100, identify all applicable hazards from Annex B
3. **Define safety functions** -- Map vehicle functions to Table 1, determine required PLr for each
4. **Design safety architecture** -- Design SRP/CS to meet required PL per ISO 13849-1 (select appropriate category and architecture)
5. **Implement and verify** -- Build prototype, conduct internal verification per Annex E methods
6. **Validate Performance Levels** -- Validate achieved PL per ISO 13849-2 (parts count, FMEA, fault simulation)
7. **Compile Technical Construction File** -- Assemble all documentation per Clause 6 and Machinery Directive Annex VII

### Phase 2: Certification Body Engagement (1-2 months)

8. **Select a certification body** -- TUV Rheinland, TUV SUD, SGS, Bureau Veritas, Applus+, or other accredited body
9. **Submit Technical Construction File** -- Provide complete TCF for initial review
10. **Scope agreement** -- Define the scope of assessment (which vehicle variants, which operating modes, which zones)
11. **Assessment plan** -- Certification body issues a plan covering document review, testing schedule, and audit dates

### Phase 3: Document Review (1-3 months)

12. **TCF review** -- Auditors review the entire Technical Construction File:
    - Risk assessment completeness and methodology
    - Safety function identification and PL assignment
    - Electrical and functional diagrams
    - Calculation reports (braking distances, stability, PL verification)
    - Compliance matrix (standard clauses vs. evidence)
13. **Gap analysis** -- Auditors identify non-conformities or missing evidence
14. **Corrective actions** -- Manufacturer addresses all identified gaps

### Phase 4: Testing (1-2 months)

15. **Physical inspection** -- On-site inspection of the manufactured product
16. **Functional testing** -- Test all safety functions in operational conditions:
    - Personnel detection test (standardized test objects)
    - Braking performance test (loaded and unloaded)
    - Speed monitoring and overspeed response
    - Emergency stop function from all positions
    - Mode transition tests
    - Stability tests
17. **EMC testing** -- Electromagnetic compatibility testing (often at a test laboratory)
18. **Electrical safety testing** -- Compliance with EN 1175 electrical requirements
19. **Software assessment** -- Control software reliability evaluation

### Phase 5: Certification Decision (2-4 weeks)

20. **Final review** -- Certification body reviews all test reports, document review results, and corrective action evidence
21. **Certification decision** -- Formal decision to issue or withhold certification
22. **Test report / certificate issuance** -- Formal test report and/or certificate issued
23. **Manufacturer issues Declaration of Conformity** -- Based on the positive assessment
24. **CE marking** -- Manufacturer affixes CE mark to the vehicle

### Phase 6: Surveillance (Ongoing)

25. **Periodic review** -- Some certification bodies require periodic surveillance audits
26. **Design change management** -- Any significant design changes require re-assessment
27. **Field feedback monitoring** -- Track incidents and near-misses for continuous improvement

---

## 9. Notified Bodies and Assessment Organizations

### Primary Certification Bodies for ISO 3691-4

**TUV Rheinland**
- Global leader in AGV/AMR certification
- Published the definitive whitepaper on ISO 3691-4:2020
- Services: Functional safety review, certification, field evaluation, test reports
- Standards covered: ISO 3691-4, EN 1175-1, ISO 13849-1/2
- Also offers cTUVus mark for North American market
- Robotics-specific division with dedicated AGV expertise
- Contact: robotics@tuv.com

**TUV SUD**
- Significant presence in AGV/AMR testing globally
- Offers combined ISO 3691-4 + ISO 13849 assessment packages
- Strong in automotive-adjacent functional safety (ISO 26262)
- Offices across Europe, Asia, and North America

**SGS**
- One of the world's largest testing, inspection, and certification companies
- Offers ISO 3691-4 compliance testing
- Strong presence in the EU Machinery Regulation 2023/1230 transition
- Growing robotics certification capability

**Bureau Veritas**
- Major certification body with broad industrial scope
- CE marking assessment services
- Machinery Directive compliance expertise
- Less specialized in AGV/AMR than TUV but fully capable

**Applus+ Laboratories**
- Specialized ISO 3691-4:2023 compliance testing
- Offers EMC testing in large chambers (10m measurement distance)
- Risk assessment services
- Electrical safety testing
- Software assessment
- Currently pursuing specific ISO 3691-4:2023 accreditation
- Good option for combined EMC + safety testing

**Pilz**
- Not a Notified Body but a significant safety consulting and component supplier
- Provides ISO 3691-4 training and integration services
- Manufactures safety controllers and sensors used to achieve required PLs
- Publishes excellent guidance on ISO 3691-4 changes

### Selection Criteria

| Factor | Consideration |
|--------|---------------|
| Geographic presence | Choose a body with offices near your manufacturing and test facilities |
| Standard expertise | Verify specific ISO 3691-4 experience (not just general machinery) |
| Turnaround time | Some bodies have 3-6 month backlogs for AGV assessments |
| Scope | Ensure they can cover EMC, electrical safety, functional safety, and mechanical tests |
| Market access | If targeting both EU and North American markets, TUV Rheinland's cTUVus is valuable |
| Cost | Request quotes from at least 2-3 bodies; costs vary significantly |

---

## 10. Cost Breakdown and Timeline

### Cost Estimates

| Item | Estimated Cost | Notes |
|------|---------------|-------|
| ISO 3691-4:2023 standard purchase | $200-250 USD | Via ANSI Webstore |
| ISO 13849-1 standard purchase | $200-250 USD | Required companion standard |
| Additional referenced standards | $500-1,500 USD | ISO 12100, ISO 13850, EN 1175, IEC 61496, etc. |
| Internal risk assessment effort | $20,000-50,000 USD | Engineering time for hazard analysis, safety function definition, PL calculations |
| Safety architecture design | $30,000-80,000 USD | SRP/CS design, component selection, redundancy architecture |
| Functional safety validation (internal) | $15,000-40,000 USD | ISO 13849-2 validation, FMEA, fault simulation |
| Third-party certification assessment | $50,000-150,000 USD | Document review + testing + certification decision |
| EMC testing (external lab) | $10,000-30,000 USD | If not included in main assessment |
| Corrective action engineering | $5,000-30,000 USD | Addressing non-conformities found during audit |
| **Total estimated range** | **$130,000-380,000 USD** | First certification of a new product |

**Recurring Costs:**
- Annual surveillance (if required): $5,000-15,000 USD
- Design change re-assessment: $10,000-50,000 USD per change
- Re-certification to new standard edition: $30,000-80,000 USD

### Timeline Estimates

| Phase | Duration | Prerequisites |
|-------|----------|---------------|
| Standard study and gap analysis | 1-2 months | Product concept defined |
| Risk assessment and safety design | 3-6 months | Prototype or detailed design available |
| Internal verification and testing | 2-4 months | Safety systems implemented |
| TCF compilation | 1-2 months | All internal testing complete |
| Certification body engagement | 1-2 months | TCF ready for submission |
| Document review | 1-3 months | TCF submitted |
| Physical testing by certification body | 1-2 months | Vehicle available for testing |
| Corrective actions and closure | 1-3 months | Depending on findings |
| **Total: Design to CE Mark** | **12-24 months** | For a new product from scratch |
| **Certification process only** | **3-8 months** | Product already designed to standard |

---

## 11. How TractEasy Meets the Requirements

### Company Structure
TractEasy is a joint venture between:
- **TLD** (Alvest Group subsidiary) -- world-leading ground support equipment manufacturer, provides the vehicle platform
- **EasyMile** -- driverless technology provider, supplies the autonomous driving stack
- **Smart Airport Systems (SAS)** -- airport operations expertise

### Certification Status
- **CE marked** -- Both EZTow and EZDolly carry CE marking
- **ISO 13849-1 PLd compliance** -- Safety-related parts of control systems achieve Performance Level d
- **ISO 26262 ASIL D** -- EasyMile's Functional Safety Management process is certified to ASIL D (highest automotive safety integrity level), verified by CertX. This covers ISO 26262 Parts 2 and 8
- **ISO 3691-4 compliance** -- Designed to meet ISO 3691-4 requirements as a driverless industrial truck
- **ISO 12100 / ISO 21448 (SOTIF)** -- Referenced in EasyMile's safety framework

### Safety Architecture
EasyMile's autonomous driving stack implements a layered safety approach:

**Sensor Suite (360-degree perception):**
- Multiple LiDAR sensors for navigation and obstacle detection
- High-definition cameras for visual perception
- Radar sensors for all-weather detection
- GPS/GNSS for localization
- 4G/Wi-Fi connectivity for fleet management and remote monitoring

**Safety Chain:**
- Redundant braking paths (dual-channel braking architecture -- meets Category 3 / PLd)
- Certified safety PLCs (programmable logic controllers) for safety function execution
- Continuous self-diagnostics monitoring system health
- Independent safety controller separate from the navigation/planning system
- Hardware and software safety chain guarantees controlled, predictable responses

**Functional Safety Standards Compliance:**
- ISO 13849-1 PLd for critical safety functions (braking, personnel detection)
- ISO 26262 process certification ensures systematic safety throughout development
- ISO 21448 (SOTIF) -- Safety of the Intended Functionality, addressing perception limitations

### Airport Deployments Using This Certification

| Airport | Status | Operations |
|---------|--------|------------|
| Toulouse-Blagnac (France) | Operational, fully driverless | Baggage transport, extended route |
| Narita International (Japan) | Operational | Baggage/cargo transport |
| Changi Airport (Singapore) | Operational | ULD transport, driverless operations |
| Greenville-Spartanburg (USA) | Deployed | Baggage transport |
| Schiphol (Netherlands) | Testing | Baggage tractor trials |

**Operational Record:**
- Zero accidents reported across deployments
- Over 95% autonomous mission success rate
- Level 4 autonomy in live environments
- First driverless technology provider in Europe authorized for Level 4 on public roads

### How EZTow Meets Specific ISO 3691-4 Requirements

| Requirement | How Met |
|------------|---------|
| SF1: Braking PLd | Redundant braking paths with dual-channel architecture; certified safety PLC monitors brake function |
| SF2: Parking brake PLb | Mechanical parking brake with electronic release; fail-safe (engages on power loss) |
| SF3: Speed monitoring PLc | Continuous speed monitoring via encoders; automatic stop on overspeed |
| SF4+: Personnel detection PLd | Safety-rated LiDAR scanners covering all travel directions; 360-degree detection |
| SF15: Emergency stop PLd | E-stop buttons on vehicle; wireless remote E-stop capability; conforms to ISO 13850 |
| Zone management | Operating zone clearance maintained; speed reduction in limited clearance areas |
| Documentation | Full TCF maintained; instruction manuals for airport operators |

---

## 12. How reference airside AV stack Meets the Requirements

### Company Background
reference airside AV vendor is a UK-based autonomous vehicle company specializing in aviation ground support. Their key products:
- **autonomous baggage dolly**: Autonomous baggage dolly with bi-directional movement
- **autonomous baggage/cargo tug**: Autonomous tug with ULD loading/unloading capability and dolly towing

### Certification Approach
the reference airside AV stack's certification information is less publicly detailed than TractEasy's, but based on available information:

- Products are designed to comply with applicable safety standards for deployment at airports
- Safety validation through extensive phased trial programs at airports
- Autonomous Drive System (ADS) is programmed with rules ensuring safety compliance
- Currently operating with safety driver on board during testing phases

### Safety Systems

**Sensor Suite:**
- LiDAR sensors for environment mapping and obstacle detection
- 360-degree cameras for comprehensive situational awareness
- Stereo color cameras for depth perception and object recognition
- Additional sensor suite for close-quarter operations at aircraft stands

**Autonomous Drive System:**
- Rules-based safety system ensuring compliance with operational requirements
- Obstacle detection with multi-mode response (stop, speed reduction, lane change)
- Real-time environment mapping and route following
- fleet integration platform fleet management platform for scheduling and monitoring

### Airport Deployments and Testing Phases

| Airport | Phase | Details |
|---------|-------|---------|
| Changi Airport (Singapore) | Phase 2B+ | Leading customer; initial deployment Feb 2022; Mk3 vehicle shipped Sep 2023; fleet of 4 vehicles |
| CVG (Cincinnati, USA) | Deployment | First US deployment, spring 2024 |
| Schiphol (Netherlands) | Testing | Contract for test deployment |
| Stuttgart (Germany) | Testing | Contract for test deployment |
| UK airport (unnamed, IAG contract) | Deployment | Via International Airlines Group contract |

**Testing Methodology:**
- Phase 2A: Vehicle operations in wet weather, heat, humidity; baggage transfer and close-quarter maneuvers at aircraft stands
- Phase 2B: Fleet communication testing via fleet integration platform platform; scheduling and monitoring for wide-body flight turnaround
- Progressive autonomy: currently with safety driver; moving toward fully driverless operations

### Compliance Path

the reference airside AV stack's approach to ISO 3691-4 compliance appears to follow a deployment-validation model:
1. Design vehicle with safety systems informed by the standard's requirements
2. Deploy with safety driver during trial phases
3. Collect operational data demonstrating safety performance
4. Progress through phased testing at each airport
5. Build compliance evidence through operational track record
6. Seek formal certification once operational maturity is demonstrated

This contrasts with TractEasy's approach of obtaining formal CE marking and ISO certification before deploying at Level 4 autonomy.

---

## 13. Differences Between 2020 and 2023 Editions

The 2023 edition (ISO 3691-4:2023) is the current version and includes significant updates. Here is a detailed comparison:

### New Terminology (Clause 3)

| Term | Status | Description |
|------|--------|-------------|
| Active detection field | **New** | Defines the specific sensing area used for personnel detection, providing clearer requirements for sensor configuration |
| Operational stop | **New** | Controlled stop bringing truck to standstill while maintaining system readiness for restart; distinct from emergency stop |

### Clause 4 Updates (Safety Requirements)

| Area | Change |
|------|--------|
| Active detection field | Detailed requirements added for configuring and validating the detection field geometry and performance |
| Stop functions | More precise definition of stop functions; maximum distances between emergency stop devices now specified |
| Passenger protection | Updated requirements for access and protection of passengers/riders on AGVs |
| Restricted zone operations | Framework for higher-speed operation in restricted zones, requiring detailed hazard analysis and additional protective measures |
| Maintenance mode speeds | Maximum permissible speeds now defined for maintenance mode in certain situations |
| Electrical requirements | Better correlation with EN 1175:2020 electrical requirements |

### Clause 5 Updates (Verification)

| Change | Detail |
|--------|--------|
| Updated test procedures | Verification methods updated to reflect new requirements |
| Detection test refinements | More specific test procedures for active detection field validation |

### Clause 6 Updates (Documentation)

| Change | Detail |
|--------|--------|
| Expanded documentation | Requirements updated to reflect new safety functions and zone concepts |

### Annex Updates

| Annex | Change |
|-------|--------|
| A (Zones) | Updated zone requirements and speed tables |
| B (Hazards) | Additional hazards added: transport-related hazards, temperature extremes, emissions, electrostatic phenomena |
| C (Rated Capacity) | Updated methodology |

### Additional 2023 Changes

- **Normative references updated** to include most recent editions of all referenced standards
- **Hazards not covered**: New section listing significant hazards explicitly outside the standard's scope
- **Vehicles with drivers/riders**: Additional requirements added for driverless trucks that can also carry personnel
- **Page count**: Expanded from approximately 60 pages (2020) to 82 pages (2023)

### Impact on Existing Certifications

Products certified to ISO 3691-4:2020 should be re-assessed against the 2023 edition, particularly:
- Active detection field configuration and validation
- Emergency stop device placement distances
- Maintenance mode speed limits
- Additional hazard coverage
- Passenger/rider protection measures

---

## 14. Required Documentation Package

### Risk Assessment Package

**ISO 12100 Risk Assessment Document:**
- Scope definition (machine limits, intended use, foreseeable misuse)
- Hazard identification using Annex B as reference
- Risk estimation for each identified hazard (severity, exposure, avoidability)
- Risk evaluation and determination of required risk reduction
- Risk reduction measures implemented (inherent design, safeguarding, information)
- Residual risk assessment and documentation

**Safety Function List:**
- Complete list of all safety functions identified for the vehicle
- Cross-reference to Table 1 safety function numbers
- Required PLr for each function
- Achieved PL for each function (with evidence)
- Architecture category selected (Cat 2, Cat 3, or Cat 4)
- Component reliability data (MTTFd, DC, CCF measures)

**FMEA (Failure Mode and Effects Analysis):**
- Systematic analysis of failure modes for all safety-related components
- Severity, occurrence, and detection ratings
- Risk priority numbers and mitigation actions

### Technical Construction File Contents

```
Technical Construction File (TCF)
|
|-- 1. General Description
|   |-- Machine description and intended use
|   |-- Photographs and general arrangement drawings
|   |-- Operating zone descriptions
|
|-- 2. Detailed Design Documentation
|   |-- Mechanical design drawings
|   |-- Electrical schematics and wiring diagrams
|   |-- Hydraulic/pneumatic circuit diagrams (if applicable)
|   |-- Control system architecture diagrams
|   |-- Software architecture documentation
|
|-- 3. Risk Assessment
|   |-- ISO 12100 risk assessment document
|   |-- Safety function list with PL assignments
|   |-- FMEA reports
|   |-- Fault tree analyses (where applicable)
|
|-- 4. Standards Compliance
|   |-- List of all applied standards
|   |-- Clause-by-clause compliance matrix
|   |-- Gap analysis for any non-covered requirements
|
|-- 5. Safety System Verification
|   |-- ISO 13849-1 PL calculation reports
|   |-- ISO 13849-2 validation reports
|   |-- Component reliability data sheets
|   |-- Safety PLC configuration documentation
|   |-- Safety sensor specifications and certificates
|
|-- 6. Test Reports
|   |-- Personnel detection test results
|   |-- Braking performance test results
|   |-- Stability test results
|   |-- EMC test reports
|   |-- Electrical safety test reports
|   |-- Speed monitoring verification
|   |-- Emergency stop function tests
|
|-- 7. Component Certifications
|   |-- Declarations of Conformity for safety components
|   |-- Safety sensor certificates (SIL/PL ratings)
|   |-- Safety PLC certificates
|   |-- Brake component certifications
|
|-- 8. Instructions for Use
|   |-- Operator instruction manual
|   |-- Maintenance manual
|   |-- Installation/commissioning guide
|   |-- Zone preparation instructions
|
|-- 9. Declaration of Conformity
|   |-- EU Declaration of Conformity (or Declaration of Incorporation)
|   |-- List of applicable directives
|   |-- Signature of authorized representative
```

---

## 15. Handling AI/ML Components Under ISO 3691-4

### The Fundamental Challenge

ISO 3691-4 was written with deterministic safety systems in mind. Its Performance Level framework (via ISO 13849-1) assumes:
- **Deterministic behavior**: Given the same input, the system always produces the same output
- **Quantifiable failure rates**: Components have known, measurable failure probabilities (MTTFd)
- **Binary fault detection**: Faults can be detected and the system brought to a safe state
- **Architecture categories**: Hardware redundancy patterns (Cat 1-4) assume conventional components

Modern autonomous vehicles (including TractEasy and reference airside AV stack) use AI/ML components that violate these assumptions:
- **Neural networks** for object detection and classification are non-deterministic
- **Learned perception models** have opaque failure modes that cannot be enumerated via FMEA
- **Distribution shift** means real-world inputs may differ from training data
- **Adversarial vulnerabilities** are not covered by conventional functional safety analysis

### Current Industry Approach: Safety Architecture Separation

The established pattern (used by EasyMile and others) is to separate the AI/ML components from the safety-critical control path:

```
+---------------------------+     +---------------------------+
|   NAVIGATION/PLANNING     |     |   SAFETY SYSTEM           |
|   (AI/ML components)      |     |   (Deterministic,         |
|                           |     |    ISO 13849 compliant)    |
|   - Neural net perception |     |                           |
|   - Path planning         |     |   - Safety-rated LiDAR    |
|   - Behavior prediction   |     |     scanners (IEC 61496   |
|   - Route optimization    |     |     or IEC 62998)         |
|                           |     |   - Certified safety PLC  |
|   NOT safety-rated        |     |   - Redundant braking     |
|   Handles: "where to go"  |     |   - E-stop circuits       |
+---------------------------+     |   - Speed monitoring      |
            |                     |                           |
            | Commands            |   PLd-rated throughout    |
            v                     |   Handles: "stop safely"  |
+---------------------------+     +---------------------------+
|   VEHICLE CONTROL         |                |
|   - Motor control         |<---------------+
|   - Steering              |   Safety override
|   - Speed regulation      |   (always wins)
+---------------------------+
```

**Key Principle:** The AI/ML system decides where to go and how fast, but the safety system has independent authority to stop the vehicle. The safety system uses only deterministic, certifiable sensors (safety-rated LiDAR scanners certified to IEC 61496 or IEC 62998) and certified safety PLCs, and can override any command from the AI/ML layer.

### Specific Challenges and Mitigations

**Challenge 1: Personnel Detection**
- ISO 3691-4 requires PLd for personnel detection
- AI/ML-based camera perception cannot achieve PLd certification under ISO 13849-1
- **Mitigation**: Use safety-rated laser scanners (SICK, Pilz, Leuze) certified to IEC 61496 or IEC 62998 as the PLd-rated detection system. The AI/ML camera system provides supplementary perception for navigation but is not relied upon for safety-critical personnel detection

**Challenge 2: Navigation Failure**
- If the AI/ML navigation system loses localization or makes a path planning error, the vehicle could enter an unsafe area
- **Mitigation**: Independent safety monitoring of speed, position boundaries (geofencing via safety PLC), and clearance zones. The safety system triggers a controlled stop if the vehicle deviates from its authorized operating zone

**Challenge 3: Perception Edge Cases**
- AI/ML systems may fail to detect unusual objects, unusual lighting conditions, or novel scenarios not in training data
- **Mitigation**: Defense-in-depth approach:
  - Primary: Safety-rated laser scanners (deterministic, certifiable)
  - Secondary: AI/ML camera/LiDAR perception (additional detection capability)
  - Tertiary: Speed limiting in areas with higher risk
  - Quaternary: Operating zone design (physical barriers, access control)

**Challenge 4: Software Updates**
- AI/ML models are updated through training, which can change behavior in unpredictable ways
- **Mitigation**: Version control and regression testing of all ML model updates. Re-validation of safety functions after any software change. Safety system software updates follow IEC 62443 / ISO 13849 change management processes

### Emerging Standards for AI Safety

The gap between ISO 3691-4 (deterministic safety) and AI/ML perception is being addressed by several emerging standards:

| Standard | Scope | Status |
|----------|-------|--------|
| **ISO/PAS 8800:2024** | Safety and AI for road vehicles -- ML lifecycle, functional insufficiency of ML models, systematic and random faults of AI elements | Published December 2024 |
| **ISO 21448 (SOTIF)** | Safety of the Intended Functionality -- addresses perception limitations and triggering conditions | Published (EasyMile cites compliance) |
| **IEC 62998 series** | Safety-related sensors for protection of persons -- more flexible than IEC 61496, potentially accommodating newer sensor technologies | Published, referenced in ISO 3691-4:2023 |
| **EU AI Act** | Risk-based regulation of AI systems -- autonomous vehicles classified as high-risk AI | Entered into force August 2024 |
| **ISO/CD 3691-4 (next revision)** | Committee draft for next major revision -- may incorporate guidance on AI/ML components | Under development (ISO project 88615) |

### Practical Recommendation for Airport AV Developers

1. **Keep safety-critical functions on deterministic, certifiable systems** -- do not rely on AI/ML for any PLd function
2. **Use AI/ML for non-safety functions** (route optimization, traffic management, load planning) and for supplementary perception that enhances but does not replace safety-rated sensors
3. **Document the AI/ML architecture explicitly** in the risk assessment, showing the separation between AI/ML and safety-critical paths
4. **Apply ISO 21448 (SOTIF)** methodology to systematically identify scenarios where AI/ML perception may produce insufficient or incorrect outputs
5. **Apply ISO/PAS 8800** lifecycle guidance for the AI/ML development process
6. **Anticipate the Machinery Regulation 2023/1230** requirements for AI (see next section)

---

## 16. Relationship with Machinery Directive and Machinery Regulation

### Current: Machinery Directive 2006/42/EC

**Status:** In force until January 19, 2027

**Relationship to ISO 3691-4:**
- ISO 3691-4:2023 was harmonized with the Machinery Directive in May 2024
- Compliance with ISO 3691-4 creates a "presumption of conformity" with the Directive's Essential Health and Safety Requirements (EHSRs)
- The AGV itself is considered "machinery" under the Directive (some earlier interpretations treated it as "partly completed machinery")
- CE marking applies to the AGV only -- not to the complete AGV system (integrator responsible for system-level conformity)

**Conformity Assessment Procedure:**
- For most AGVs: **Manufacturer self-declaration** is permitted when harmonized standards (including ISO 3691-4) are applied and cover all relevant EHSRs
- For high-risk machinery listed in **Annex IV**: If harmonized standards are not applied, or do not cover all EHSRs, a Notified Body must be involved
- AGVs are not explicitly listed in Annex IV of the current Machinery Directive, so manufacturer self-declaration with harmonized standards is the typical path
- However, many manufacturers voluntarily engage a certification body (TUV, etc.) for credibility and market confidence

**Required Documentation:**
- Technical Construction File (Annex VII)
- EU Declaration of Conformity (Annex II)
- CE marking on the product

### Future: Machinery Regulation (EU) 2023/1230

**Status:** Fully applicable from January 20, 2027 (replaces Machinery Directive)

**Key Differences for AGV/AMR Manufacturers:**

| Area | Current Directive | New Regulation |
|------|-------------------|----------------|
| Legal form | Directive (requires national transposition) | Regulation (directly applicable in all EU member states) |
| AI provisions | None | Explicit requirements for self-evolving AI behavior |
| Cybersecurity | Not addressed | Mandatory protection against cyber threats |
| Digital instructions | Paper manual required | Digital-only instructions permitted for professional use |
| High-risk category | Annex IV list | New Annex I Part A with updated high-risk machinery list |
| Conformity for high-risk AI | Not specified | Third-party conformity assessment mandatory for AI-based high-risk machinery |

**New AI-Specific Requirements (Critical for Autonomous Vehicles):**

1. **Human oversight and control**: Machinery must allow operators to override or shut down AI-based functions. Safe fallback modes are mandatory
2. **Explainability and transparency**: AI decision-making processes must be understandable for operators, maintenance personnel, and incident investigators
3. **Self-evolving behavior**: Machinery using self-evolving AI algorithms (where outcomes are not fully predictable at design time) falls into a new "high-risk machinery products" category requiring **mandatory third-party conformity assessment** -- manufacturer self-declaration is NOT sufficient
4. **Safety decision logging**: All safety-related decisions by AI systems must be logged
5. **AI updateability**: AI control systems must be updateable at any time to address safety issues
6. **Cybersecurity**: Systems capable of remote updates require protection against cyber threats, tampering, and data manipulation

**Impact on Airport Autonomous Vehicles:**

Autonomous AGVs/AMRs using AI for navigation and perception will almost certainly be classified as high-risk machinery under the new Regulation if they employ self-evolving AI. This means:
- **Third-party conformity assessment becomes mandatory** (no more self-declaration for AI-based AGVs)
- Additional documentation for AI components (training data versions, software update logs, explainability documentation)
- Cybersecurity assessment required (aligned with the Cyber Resilience Act, effective mid-2026)
- Human override capability must be demonstrated

**Timeline for Preparation:**
- **Now-2026**: Understand new requirements, begin updating documentation and processes
- **Mid-2026**: Cyber Resilience Act requirements come into effect
- **January 2027**: Machinery Regulation fully applicable; all new products must comply
- Products placed on the market before January 2027 under the Directive remain valid

---

## 17. Related Standards Ecosystem

### Standards Directly Referenced by ISO 3691-4

| Standard | Scope | Relationship |
|----------|-------|-------------|
| ISO 12100:2010 | Safety of machinery -- risk assessment and risk reduction | Foundation for risk assessment methodology |
| ISO 13849-1 | Safety-related parts of control systems -- design | Defines Performance Levels (PL) used throughout ISO 3691-4 |
| ISO 13849-2 | Safety-related parts of control systems -- validation | Required for validating achieved PL |
| ISO 13850:2015 | Emergency stop function | Emergency stop design requirements |
| EN 1175:2020 | Electrical requirements for industrial trucks | Electrical safety for AGVs |
| IEC 60204-1 | Electrical equipment of machines | General electrical safety |
| IEC 61496 | Electro-sensitive protective equipment | Safety laser scanners, light curtains |
| IEC 62998 series | Safety-related sensors for person protection | Newer sensor standard; allows more sensor types |
| ISO 5053-1 | Industrial trucks -- terminology | Defines "driverless industrial truck" |

### Complementary Safety Standards

| Standard | Scope | When to Apply |
|----------|-------|---------------|
| ISO 26262 | Functional safety for road vehicles | When vehicle also operates on roads or when ASIL-based process is desired |
| ISO 21448 (SOTIF) | Safety of the Intended Functionality | For addressing perception limitations in autonomous systems |
| ISO/PAS 8800:2024 | Safety and AI for road vehicles | For AI/ML lifecycle management in safety-critical applications |
| UL 4600 | Safety evaluation of autonomous products | For building comprehensive safety cases |
| ANSI/RIA R15.08 | Industrial mobile robots | North American market; complements ISO 3691-4 for robot-specific guidance |
| ANSI/ITSDF B56.5 | Safety standard for driverless AGVs | North American equivalent/complement to ISO 3691-4 |
| IEC 61508 | Functional safety of E/E/PE systems | Alternative to ISO 13849 using Safety Integrity Levels (SIL) |
| IEC 62443 | Industrial cybersecurity | Security requirements for control systems -- relevant for Machinery Regulation 2023/1230 |

### SIL-PL Equivalence

| SIL (IEC 61508/62061) | PL (ISO 13849-1) | Notes |
|------------------------|-------------------|-------|
| SIL 1 | PLc | Approximate equivalence |
| SIL 2 | PLd | Most AGV safety functions target this level |
| SIL 3 | PLe | Highest practical level for AGV applications |

---

## Key Takeaways for Airport AV Development

1. **ISO 3691-4 is the right standard** for autonomous tow tractors and baggage vehicles at airports -- both TractEasy and reference airside AV stack reference it for their deployments.

2. **PLd for braking and personnel detection is confirmed** -- these are the most critical safety functions requiring high-reliability dual-channel architectures.

3. **PLb for parking brake is confirmed** -- lower requirement reflecting the lower risk from a stationary hold condition.

4. **The standard was harmonized in May 2024** with the Machinery Directive, giving it legal presumption of conformity in the EU. This is a significant change from the pre-2024 situation.

5. **AI/ML components are handled through architectural separation** -- keep safety-critical functions on deterministic, certifiable subsystems. Use AI/ML for non-safety functions and supplementary perception.

6. **The 2027 Machinery Regulation will significantly impact AI-based AGVs** -- mandatory third-party assessment for self-evolving AI, cybersecurity requirements, and explainability obligations. Start preparing now.

7. **Total certification cost ranges from $130K-380K** for a new product, with 12-24 months from design start to CE mark. The certification assessment alone takes 3-8 months.

8. **TUV Rheinland is the leading certification body** for AGV/AMR assessment under ISO 3691-4, followed by TUV SUD, SGS, Bureau Veritas, and Applus+.

---

*Last updated: 2026-03-22*
*Companion document to: [certification-guide.md](certification-guide.md)*
