# Deployment Playbook: Autonomous Vehicles at Airports

## From First Test to Full Operations

---

## Table of Contents

1. [Pre-Deployment Phase](#1-pre-deployment-phase)
2. [Mapping and Route Planning](#2-mapping-and-route-planning)
3. [Vehicle Preparation](#3-vehicle-preparation)
4. [Testing Phases](#4-testing-phases)
5. [Pilot Operations](#5-pilot-operations)
6. [Safety Validation](#6-safety-validation)
7. [Scaling from Pilot to Operations](#7-scaling-from-pilot-to-operations)
8. [Airport Stakeholder Management](#8-airport-stakeholder-management)
9. [Training](#9-training)
10. [Maintenance and Support](#10-maintenance-and-support)
11. [Operational Procedures](#11-operational-procedures)
12. [KPIs and Reporting](#12-kpis-and-reporting)
13. [Multi-Airport Expansion](#13-multi-airport-expansion)
14. [Insurance and Liability](#14-insurance-and-liability)
15. [Master Deployment Checklist](#15-master-deployment-checklist)

---

## 1. Pre-Deployment Phase

### 1.1 Site Survey

The site survey is the foundation of every airport deployment. It must capture the physical, operational, and regulatory characteristics of the airside environment before any vehicle arrives on site.

**Physical Environment Assessment:**
- Measure all roadways, taxilanes, apron areas, and service roads with centimeter-level precision
- Document surface types (asphalt, concrete, painted markings, expansion joints)
- Record gradient changes, camber, drainage features, speed bumps, and bollards
- Photograph and geolocate all signage, markings, lighting infrastructure, and physical barriers
- Identify GPS shadow zones caused by terminal buildings, hangars, jet bridges, and other structures
- Map Wi-Fi/cellular coverage across the operational area using signal strength surveys
- Identify areas with electromagnetic interference (radar installations, ILS equipment, power lines)
- Document weather exposure patterns: prevailing wind directions, flood-prone areas, ice accumulation zones

**Operational Environment Assessment:**
- Map all vehicle traffic flows: GSE movements, fuel trucks, catering vehicles, de-icing units
- Document aircraft push-back zones, taxi routes, and jet blast areas
- Identify pedestrian crossing patterns and high-density personnel areas (gate areas, crew walkways)
- Record peak traffic periods correlated to flight schedules
- Identify FOD (Foreign Object Debris) hotspots and debris accumulation patterns
- Document existing vehicle speed limits and traffic control measures
- Map emergency vehicle access routes and staging areas

**Infrastructure Assessment:**
- Locate available power supply for charging stations (voltage, amperage, proximity)
- Identify suitable locations for edge compute infrastructure and communication base stations
- Assess existing CCTV and surveillance coverage for integration opportunities
- Document available facilities for vehicle staging, maintenance, and storage
- Evaluate network infrastructure: fiber runs, switch locations, available bandwidth

### 1.2 Stakeholder Engagement

**Internal Stakeholders (Airport Operator):**
- Airport CEO / Managing Director: Strategic alignment and board-level sponsorship
- VP Operations / Airside Operations Director: Operational integration and safety culture owner
- Safety Manager / SMS Coordinator: Safety case development and risk management
- IT / Technology Director: Infrastructure, connectivity, and cybersecurity
- Finance: Business case, capex/opex modeling, ROI tracking
- Legal / Compliance: Contracts, liability, regulatory compliance
- HR / Training: Workforce transition, operator recruitment, training programs
- Communications / PR: Internal and external messaging

**External Stakeholders:**
- FAA Regional Airport Certification Safety Inspector (Part 139 airports) or FAA Airports District Office (GA airports)
- National aviation authority (CAA, EASA, CAAS, GCAA depending on jurisdiction)
- Air Traffic Control (ATC) / Tower
- Airlines operating at the airport
- Ground handling companies
- Fuel companies
- Catering operators
- Airport security / police
- Local emergency services (fire, ambulance)
- Insurance providers
- Local government / planning authority
- Neighboring communities (for landside operations)

**Engagement Sequence:**
1. **Month 1-2:** Internal alignment meeting with airport leadership. Build the business case. Identify executive sponsor.
2. **Month 2-3:** Informal engagement with FAA/CAA. Reference FAA CertAlert 24-02 for AGVS technology guidance. Discuss intended operational design domain (ODD).
3. **Month 3-4:** Formal notification to the FAA regional office or Airport Certification Safety Inspector. Present concept of operations (CONOPS).
4. **Month 4-5:** Stakeholder briefings with airlines, ground handlers, ATC. Collect concerns and requirements.
5. **Month 5-6:** Safety Management System (SMS) integration. Begin formal safety assessment.

### 1.3 Airport Authority Meetings

**First Meeting (Concept Introduction):**
- Present the technology overview: vehicle capabilities, automation level (SAE Level 3-4), operational concept
- Define the proposed operational design domain (ODD): routes, areas, times, weather limitations
- Present relevant case studies (CVG, Changi, Teesside, Schiphol)
- Discuss regulatory pathway and FAA/CAA guidance
- Identify the approval process and decision-makers
- Agree on communication cadence

**Second Meeting (Safety and Integration):**
- Present preliminary hazard analysis
- Discuss integration with existing Airport Emergency Plan (per 14 CFR 139.325)
- Address ATC coordination requirements
- Present proposed testing phases and timeline
- Discuss insurance and liability framework
- Review infrastructure requirements and costs

**Third Meeting (Approval to Test):**
- Present completed Safety Risk Assessment (SRA)
- Submit formal test plan with go/no-go criteria
- Present the risk register with mitigations
- Agree on monitoring and reporting requirements
- Obtain written approval to proceed to testing phase

### 1.4 Safety Assessment

**Hazard Identification Process:**
Conduct a structured hazard identification (HAZID) workshop with cross-functional participation including airport operations, ATC, ground handlers, AV engineering, and safety specialists.

**Key Hazard Categories for Airport AV Operations:**

| Hazard Category | Example Hazards |
|---|---|
| Vehicle-Aircraft Interaction | Collision with taxiing aircraft, entering active taxi lane, jet blast exposure |
| Vehicle-Vehicle Interaction | Collision with manned GSE, fuel trucks, emergency vehicles |
| Vehicle-Person Interaction | Collision with ramp agents, passengers, maintenance crew |
| Infrastructure Damage | Collision with jet bridges, terminal buildings, lighting masts |
| FOD Generation | Vehicle component detachment, cargo spillage |
| Communication Failure | Loss of teleoperation link, loss of V2X connectivity |
| Sensor Degradation | Fog, heavy rain, glare, snow, sensor contamination |
| Cybersecurity | Remote vehicle compromise, GPS spoofing, data breach |
| Software Failure | Perception error, planning failure, localization drift |
| Operational | Incorrect route, unauthorized area entry, wrong cargo delivery |

**Safety Risk Assessment (SRA) Matrix:**

Use the ICAO/FAA 5x5 risk matrix:

- **Severity:** Catastrophic (A), Hazardous (B), Major (C), Minor (D), Negligible (E)
- **Likelihood:** Frequent (5), Occasional (4), Remote (3), Improbable (2), Extremely Improbable (1)

All risks rated as "Unacceptable" (red zone) must be mitigated before operations begin. Risks rated "Tolerable" (yellow zone) require documented mitigation plans and ongoing monitoring.

### 1.5 Risk Register

The risk register is a living document that must be reviewed monthly during deployment and quarterly during steady-state operations.

**Risk Register Structure:**

| Field | Description |
|---|---|
| Risk ID | Unique identifier (e.g., AV-R-001) |
| Hazard Description | Clear description of the hazard |
| Cause | Root cause or contributing factors |
| Consequence | Potential outcome if the hazard materializes |
| Pre-Mitigation Severity | A-E rating |
| Pre-Mitigation Likelihood | 1-5 rating |
| Pre-Mitigation Risk Level | Calculated risk level |
| Mitigation Measures | Specific controls to reduce risk |
| Post-Mitigation Severity | A-E rating after controls |
| Post-Mitigation Likelihood | 1-5 rating after controls |
| Post-Mitigation Risk Level | Residual risk level |
| Risk Owner | Named individual responsible |
| Review Date | Next scheduled review |
| Status | Open / Mitigated / Closed / Accepted |

**Sample Risk Register Entries:**

| Risk ID | Hazard | Pre-Mit Risk | Mitigation | Post-Mit Risk |
|---|---|---|---|---|
| AV-R-001 | AV enters active taxiway | 5A (Unacceptable) | Geofencing with redundant GNSS + INS, physical barriers, ATC coordination protocol | 2C (Tolerable) |
| AV-R-002 | AV collision with ramp agent | 4B (Unacceptable) | LiDAR + camera pedestrian detection, 360-degree coverage, speed limiting in personnel zones, audible warnings | 2D (Acceptable) |
| AV-R-003 | Loss of communication link | 4C (Unacceptable) | Dual-SIM cellular, dedicated Wi-Fi mesh, automatic safe-stop on comms loss, 30-second timeout | 2D (Acceptable) |
| AV-R-004 | Sensor degradation in heavy rain | 4C (Unacceptable) | Rain-sensing algorithms (rated to 50mm/h per Changi trials), automatic speed reduction, safe-stop in extreme conditions | 3D (Tolerable) |
| AV-R-005 | Cybersecurity breach | 3B (Unacceptable) | Network segmentation, encrypted V2X, OTA update authentication per UN R155/R156, vSOC monitoring | 2D (Acceptable) |
| AV-R-006 | Software perception error | 4B (Unacceptable) | Redundant perception pipeline, sensor fusion validation, conservative planning margins, safety operator override | 2C (Tolerable) |

---

## 2. Mapping and Route Planning

### 2.1 How to Map an Airport for Autonomous Operations

Airport mapping for AV operations requires significantly higher accuracy than standard airport surveys. The goal is to create a centimeter-accurate digital twin of the operational environment.

**Mapping Technology Stack:**
- **Primary LiDAR:** Vehicle-mounted 3D LiDAR (e.g., Velodyne Alpha Prime, Ouster OS1-128) for point cloud capture
- **RTK-GNSS:** Real-Time Kinematic corrections achieving 1-4 cm horizontal accuracy (e.g., Point One Navigation, Trimble, u-blox)
- **IMU:** High-grade Inertial Measurement Unit for dead-reckoning in GNSS-denied areas
- **Cameras:** Calibrated stereo or multi-camera system for visual feature extraction and texture mapping
- **Odometry:** Wheel encoders for ground-truth distance measurement

**Mapping Process:**

**Step 1: Reference Network Establishment (1-2 days)**
- Establish ground control points (GCPs) across the operational area using survey-grade GNSS
- Install or identify permanent reference markers for ongoing calibration
- Validate RTK correction service coverage and accuracy across the site
- Target accuracy: horizontal 2 cm, vertical 3 cm

**Step 2: Data Collection Drives (1-3 days)**
- Drive the mapping vehicle along all intended routes and adjacent areas
- Capture multiple passes at different times of day (varying lighting conditions)
- Ensure coverage of all intersections, turning areas, parking positions, and charging locations
- Collect data in both directions of travel
- AeroVect has demonstrated digital twin creation of a major airport in under 2 hours using their Explorer mapping tool, though comprehensive mapping for operational deployment typically takes longer

**Step 3: Point Cloud Processing (3-7 days)**
- Register and align point cloud data using SLAM (Simultaneous Localization and Mapping)
- Apply RTK corrections for absolute positioning
- Filter noise, remove dynamic objects (vehicles, aircraft, people)
- Generate clean, geo-referenced 3D point cloud map

**Step 4: Feature Extraction and Annotation (5-10 days)**
- Extract road boundaries, lane markings, stop lines, crosswalks
- Identify and classify static objects: buildings, bollards, light poles, fences, signs
- Annotate aircraft stand positions, gate numbers, and stand boundaries
- Map speed zones, no-go areas, and transition zones
- Create the three-layer HD map structure:
  - **Road Model:** Road topology, elevation, surface type, gradient
  - **Lane Model:** Lane boundaries, speed limits, directionality, permitted vehicle types
  - **Localization Model:** Static features used for real-time localization (buildings, poles, curbs)

**Step 5: Map Validation (2-3 days)**
- Drive validation routes with the AV stack in localization-only mode
- Verify localization accuracy meets target (<10 cm lateral, <20 cm longitudinal)
- Identify and resolve areas with poor localization (featureless zones, GPS shadows)
- Document map accuracy metrics for the safety case

**Step 6: Map Maintenance Plan**
- Schedule re-mapping after any construction or infrastructure changes
- Implement incremental map updates from operational driving data
- Define map version control and deployment procedures
- Establish quarterly full-map validation drives

### 2.2 Waypoint Creation

**Waypoint Types:**
- **Route Waypoints:** Define the driving path with 0.5-1.0 m spacing on straight segments, 0.2-0.5 m spacing on curves
- **Stop Waypoints:** Precise positions for loading/unloading, charging, maintenance stops
- **Decision Waypoints:** Points where the vehicle must evaluate conditions (intersections, merge points, aircraft stand entry)
- **Speed Transition Waypoints:** Locations where speed limits change
- **Safety Waypoints:** Emergency stop positions, safe harbor locations, pull-over zones

**Waypoint Attributes:**
Each waypoint should include:
- Latitude, longitude, altitude (WGS84)
- Heading (desired vehicle orientation)
- Maximum speed at this point
- Allowed/required behaviors (stop, yield, proceed, wait for clearance)
- Associated geofence zone ID
- Lane assignment
- Special conditions (e.g., "yield to aircraft," "check for jet blast," "pedestrian zone")

### 2.3 Geofencing

Geofencing is the primary safety boundary mechanism for airport AV operations. It operates at multiple layers.

**Geofence Layer Structure:**

| Layer | Purpose | Action on Breach |
|---|---|---|
| **Hard Boundary** | Absolute no-go zone (runways, taxiways, restricted areas) | Immediate emergency stop |
| **Soft Boundary** | Operational limit (edge of permitted route with buffer) | Speed reduction + alert to operator |
| **Speed Zone** | Area-specific speed limit | Automatic speed enforcement |
| **Operational Zone** | Permitted operational area | Normal operations within zone |
| **Dynamic Zone** | Temporary restriction (aircraft on stand, maintenance area) | Route recalculation or hold |

**Geofence Implementation Requirements:**
- Redundant positioning: GNSS + INS + visual localization. No single-source dependency.
- Geofence check rate: minimum 10 Hz (every 100 ms)
- Position uncertainty must be factored into geofence margins (if position uncertainty is 0.5 m, geofence buffer must be >0.5 m from the actual boundary)
- Geofence violations must be logged, time-stamped, and reported
- Dynamic geofence updates must propagate to all vehicles within 5 seconds

**Critical Geofence Zones for Airports:**
- Runway and taxiway boundaries (absolute no-go)
- Active aircraft stand zones (dynamic, based on flight schedule)
- Jet blast exclusion zones (dynamic, based on aircraft engine status)
- Fuel farm perimeter
- ILS critical and sensitive areas
- Construction zones (dynamic)
- Emergency vehicle staging areas

### 2.4 NOTAM Integration

NOTAMs (Notices to Air Missions) contain real-time operational status information that directly affects AV route planning. Legacy NOTAM systems are text-based and not well-suited for automated parsing, but modern APIs enable integration.

**NOTAM Integration Architecture:**
1. **Data Source:** Connect to FAA NOTAM Search API or commercial NOTAM parsing service (e.g., Notamify API with Atomic Elements for structured data)
2. **Parsing Engine:** Automated classification of NOTAMs relevant to ground operations:
   - Runway/taxiway closures affecting crossing routes
   - Construction activities on or near AV routes
   - Temporary obstacles or hazards
   - Changed radio frequencies or communication procedures
   - Airfield lighting outages
3. **Route Impact Assessment:** Automated evaluation of whether active NOTAMs affect any planned AV routes
4. **Dynamic Route Adjustment:** Automatic rerouting or operational hold when NOTAM impacts are detected
5. **Operator Notification:** Alert to human supervisor for NOTAMs requiring operational decisions

**Integration with Flight Data:**
- Connect to Airport Collaborative Decision Making (A-CDM) system for real-time flight status
- Correlate aircraft arrival/departure times with AV routing to avoid conflicts
- Integrate with gate management system for stand allocation awareness
- Use flight schedule data to predict peak traffic periods and adjust AV operations accordingly

---

## 3. Vehicle Preparation

### 3.1 Sensor Mounting

**Sensor Suite for Airport Airside Operations:**

| Sensor | Quantity | Placement | Purpose |
|---|---|---|---|
| 3D LiDAR (long range) | 1-2 | Roof center/front | Primary perception, 200+ m range |
| 3D LiDAR (short range) | 2-4 | Corners, low mount | Close-range 360-degree coverage, blind spot elimination |
| Camera (forward) | 1-2 | Windshield area | Forward perception, traffic light/sign recognition |
| Camera (surround) | 4-8 | Distributed around vehicle | 360-degree visual perception |
| Radar (forward) | 1-2 | Front bumper | Long-range velocity detection, weather resilience |
| Radar (rear/side) | 2-4 | Bumper/fender | Side/rear object detection |
| Ultrasonic | 8-12 | Bumper perimeter | Very close-range parking/docking |
| GNSS antenna | 2 | Roof (dual antenna) | Position + heading from RTK-GNSS |
| IMU | 1 | Vehicle center of mass | Dead reckoning, orientation |
| Thermal camera | 1-2 | Front/rear | Jet blast detection, personnel detection in low visibility |
| V2X antenna | 1-2 | Roof | Vehicle-to-everything communication |

**Mounting Standards:**
- All sensor mounts must be vibration-isolated and thermally managed
- Mounting brackets must withstand airport operating conditions: jet blast (up to 35 mph sustained), rain, temperature extremes (-20C to +50C)
- Sensor positions must not increase vehicle height beyond airport clearance limits
- Mounting must allow field replacement of individual sensors without full recalibration
- All electrical connections must be waterproof (IP67 minimum for external sensors)
- Cable routing must avoid pinch points, heat sources, and moving parts

### 3.2 Calibration

**Intrinsic Calibration (per sensor):**
- Camera: lens distortion parameters, focal length, principal point
- LiDAR: beam angle offsets, range calibration, intensity calibration
- Radar: beam pattern verification, range/velocity accuracy
- IMU: bias estimation, scale factor, cross-axis sensitivity
- Frequency: At installation, after any sensor replacement, and monthly verification

**Extrinsic Calibration (sensor-to-sensor and sensor-to-vehicle):**
- LiDAR-to-camera: 6-DOF transformation using calibration targets. Target accuracy: <1 degree rotation, <2 cm translation
- LiDAR-to-LiDAR: Point cloud registration between multiple LiDAR units
- LiDAR-to-vehicle: Alignment to vehicle coordinate frame using ground plane and known reference points
- Camera-to-camera: Multi-camera rig calibration for consistent surround view
- GNSS antenna-to-IMU: Lever arm measurement with survey-grade accuracy
- Frequency: At installation, after any physical impact, and monthly verification

**Calibration Validation:**
- Drive a calibration route with known reference points
- Verify cross-sensor object position agreement (<5 cm at 30 m range)
- Verify LiDAR-camera projection accuracy (<3 pixels at 50 m)
- Automated calibration health monitoring during operation
- Alert and safe-stop if calibration drift exceeds thresholds

### 3.3 Compute Installation

**Compute Hardware Requirements:**

| Component | Specification | Example |
|---|---|---|
| Primary compute | GPU-accelerated AI inference, 200+ TOPS | NVIDIA DRIVE AGX Orin/Thor |
| Secondary compute | Safety controller, redundant path | ARM-based safety MCU |
| Storage | High-speed SSD for data logging | 2-4 TB NVMe |
| Network switch | In-vehicle Ethernet backbone | Automotive Ethernet (1000BASE-T1) |
| Power supply | Regulated DC-DC converter | 12V/24V to compute voltages |

**Installation Requirements:**
- Compute unit must be mounted in a sealed, climate-controlled enclosure
- Operating temperature range: -20C to +70C (with active cooling)
- Vibration rating: MIL-STD-810G or equivalent
- IP67 enclosure rating for external mounting, IP54 minimum for in-cabin
- Dedicated power circuit with battery backup (minimum 60 seconds for safe shutdown)
- EMI shielding to prevent interference with aircraft navigation systems (DO-160G or equivalent testing)
- Heat dissipation: ensure compute does not overheat in direct sunlight on hot tarmac (up to 60C+ surface temperatures)

**Functional Safety Architecture:**
- Primary compute runs perception, planning, and control
- Independent safety controller monitors primary compute outputs and can override
- Watchdog timer: if primary compute fails to send heartbeat within 100 ms, safety controller triggers safe stop
- Dual-redundant power paths to compute system
- Compliant with ISO 26262 ASIL-D for safety-critical functions

### 3.4 Communication Setup

**Communication Stack:**

| Link | Technology | Purpose | Latency Target |
|---|---|---|---|
| Primary cellular | 5G / LTE | Teleoperation, fleet management, OTA updates | <100 ms |
| Secondary cellular | Different carrier (dual-SIM) | Redundant connectivity | <100 ms |
| Wi-Fi mesh | 802.11ax (Wi-Fi 6) | High-bandwidth data offload, local connectivity | <20 ms |
| V2X | C-V2X (PC5 sidelink) | Direct vehicle-to-vehicle and vehicle-to-infrastructure | <20 ms |
| DSRC | 802.11p (5.9 GHz) | Legacy V2X compatibility if required | <20 ms |
| Satellite | L-band backup | Emergency position reporting | <2000 ms |

**Communication Requirements:**
- Minimum 10 Mbps uplink for 4K video streaming to remote operations center
- Minimum 2 Mbps downlink for commands and map updates
- Maximum acceptable round-trip latency for teleoperation: 150 ms (100 ms target)
- Automatic failover between communication paths within 2 seconds
- If all communication is lost, vehicle must execute safe-stop procedure within 5 seconds
- Communication encryption: TLS 1.3 minimum for all links
- Communication link quality monitoring at 1 Hz with alerts on degradation

**Remote Operations Center (ROC) Requirements:**
- Dedicated monitoring stations with multi-screen displays (minimum 3 screens per operator)
- Real-time video feeds from all active vehicles
- Fleet management dashboard showing vehicle positions, status, and alerts
- One-click emergency stop capability for any vehicle
- Voice communication with field personnel
- Secure, redundant network connectivity to ROC
- UPS backup power for ROC (minimum 4 hours)
- Operator-to-vehicle ratio: start at 1:1 during pilot, target 1:3 to 1:5 at scale

### 3.5 Safety Systems Validation

**Emergency Stop (E-Stop) Systems:**

| E-Stop Type | Trigger | Response Time | Action |
|---|---|---|---|
| Hardware E-Stop button | Manual press by safety operator | <100 ms | Immediate brake application, power to drive motors cut |
| Software E-Stop | Autonomous detection of unsafe condition | <200 ms | Controlled deceleration to stop |
| Remote E-Stop | Operator command from ROC | <500 ms (includes comms latency) | Controlled deceleration to stop |
| Geofence E-Stop | Hard geofence boundary breach | <200 ms | Immediate brake application |
| Watchdog E-Stop | Compute heartbeat timeout (100 ms) | <300 ms | Controlled deceleration to stop |
| Communication loss E-Stop | All comms lost for >5 seconds | <200 ms after timeout | Controlled deceleration to stop |

**Validation Testing Requirements:**
- Test each E-Stop mechanism independently: minimum 10 activations each
- Test at maximum operating speed
- Measure and record actual response times
- Verify braking distance at maximum speed and maximum payload
- Test E-Stop under degraded conditions (wet surface, slope, partial brake failure)
- Verify vehicle is safe and stable after E-Stop (no rollaway, hazard lights activated)
- Document all results in the safety case

---

## 4. Testing Phases

### 4.1 Factory Acceptance Test (FAT)

The FAT is conducted at the vehicle manufacturer's or integrator's facility before the vehicle ships to the airport. It validates that the vehicle meets specifications and is ready for site testing.

**FAT Checklist:**

**Mechanical Systems:**
- [ ] Vehicle dimensions and weight within specification
- [ ] Steering system: full lock-to-lock operation, no binding
- [ ] Brake system: service brake and parking brake functional
- [ ] Suspension: no abnormal noises or leaks
- [ ] Tires: correct specification, pressure, condition
- [ ] Lighting: headlights, taillights, turn signals, hazard lights, beacon
- [ ] Horn / audible warning system functional
- [ ] Towing attachment / cargo interface functional
- [ ] All body panels secure, no sharp edges

**Electrical Systems:**
- [ ] Battery capacity test: meets range specification (with margin)
- [ ] Charging system: compatible with planned charger, charges to full
- [ ] 12V/24V auxiliary systems functional
- [ ] All fuses and circuit breakers correctly rated
- [ ] Emergency power-off functional
- [ ] Wiring harness: no chafing, all connectors secure

**Sensor Systems:**
- [ ] All sensors powered and returning data
- [ ] Intrinsic calibration verified for each sensor
- [ ] Extrinsic calibration verified (sensor-to-sensor alignment)
- [ ] LiDAR: point cloud clean, no blind spots in coverage
- [ ] Cameras: image quality, no lens defects, correct exposure
- [ ] Radar: target detection verified at specified ranges
- [ ] GNSS: position fix acquired, RTK corrections working
- [ ] IMU: drift rates within specification

**Compute and Software:**
- [ ] Compute system boots successfully, all processes start
- [ ] Perception pipeline: detects objects in test environment
- [ ] Planning module: generates valid trajectories
- [ ] Control module: vehicle follows trajectories smoothly
- [ ] Localization: converges on HD map in test area
- [ ] Data logging: all sensor data recorded correctly
- [ ] Software version matches release specification

**Communication:**
- [ ] Cellular connectivity: both SIMs connect
- [ ] Wi-Fi: connects to test network
- [ ] V2X: transmits and receives messages
- [ ] Remote operations interface: video streaming, command reception
- [ ] Remote E-Stop: functional via ROC

**Safety Systems:**
- [ ] Hardware E-Stop: tested from all button locations
- [ ] Software E-Stop: triggered by test conditions
- [ ] Geofence: vehicle stops at test geofence boundary
- [ ] Watchdog: triggers on simulated compute failure
- [ ] Communication loss: safe-stop on simulated comms failure
- [ ] Collision avoidance: AEB triggers on test targets

**Documentation:**
- [ ] Vehicle build record complete
- [ ] Sensor serial numbers and calibration certificates
- [ ] Software version and configuration record
- [ ] Test results documented and signed
- [ ] Known issues list (if any) with severity ratings
- [ ] Spare parts list provided
- [ ] Maintenance manual provided

### 4.2 Site Acceptance Test (SAT)

The SAT is conducted at the airport after vehicle delivery. It validates that the vehicle operates correctly in the actual deployment environment.

**SAT Pre-Conditions:**
- Airport authority approval for testing obtained
- Test area secured and access controlled
- Safety operator trained and certified
- ROC set up and communication verified
- HD map of test area loaded and validated
- Emergency response plan in place
- Weather conditions within operational limits

**SAT Test Sequence:**

**Phase 1: Static Tests (Day 1)**
- [ ] GNSS position accuracy at 10+ locations across test area (<5 cm with RTK)
- [ ] Cellular signal strength survey across test area
- [ ] Sensor health checks at multiple positions
- [ ] HD map localization convergence test
- [ ] Communication link quality to ROC verified
- [ ] E-Stop tests at the airport site (all types)

**Phase 2: Low-Speed Controlled Driving (Days 2-3)**
- [ ] Manual driving through all planned routes to verify drivability
- [ ] Autonomous driving on straight segments at 5 km/h
- [ ] Autonomous driving through curves at 5 km/h
- [ ] Stop-and-go at designated waypoints
- [ ] Obstacle detection: static object placed in path
- [ ] Pedestrian detection: person walking in front of vehicle
- [ ] Geofence compliance: vehicle approaches boundary and stops

**Phase 3: Operational Speed Testing (Days 4-5)**
- [ ] Autonomous driving at planned operational speed (typically 15-25 km/h for airside)
- [ ] Lane keeping accuracy on straight and curved sections
- [ ] Intersection handling: yield, stop, proceed
- [ ] Dynamic obstacle avoidance: vehicle or person entering path
- [ ] Multi-vehicle interaction (if multiple vehicles available)
- [ ] Night driving test (if night operations planned)
- [ ] Cargo loading/unloading docking accuracy

**Phase 4: Stress Testing (Days 6-7)**
- [ ] Continuous operation for 4+ hours
- [ ] Operation during different weather conditions (if available during test window)
- [ ] Repeated route execution: 20+ consecutive runs
- [ ] Edge case testing: tight turns, narrow passages, uneven surfaces
- [ ] Communication degradation testing: measure performance with reduced signal
- [ ] Recovery from safe-stop: vehicle resumes operations correctly

### 4.3 Integration Testing

Integration testing validates that the AV system works correctly within the broader airport operational ecosystem.

**Integration Test Areas:**

| Test Category | Test Items |
|---|---|
| Fleet Management | Vehicle assignment, route dispatch, status monitoring, multi-vehicle coordination |
| A-CDM Integration | Flight data reception, schedule-based route timing, gate allocation awareness |
| NOTAM Integration | NOTAM parsing, route impact assessment, dynamic rerouting |
| Airport Systems | FIDS integration, gate management, resource planning |
| Ground Handler Systems | Task assignment, cargo tracking, turnaround coordination |
| Communication | ROC-to-vehicle, vehicle-to-vehicle, vehicle-to-infrastructure |
| Data Pipeline | Operational data collection, cloud upload, analytics dashboard |
| Charging Infrastructure | Automated charging initiation, charge management, scheduling |

### 4.4 Operational Readiness Review (ORR)

The ORR is a formal gate review before transitioning from testing to pilot operations. It requires sign-off from all key stakeholders.

**ORR Go/No-Go Criteria:**

| Category | Criteria | Status |
|---|---|---|
| **Safety** | All unacceptable risks mitigated to tolerable or acceptable | [ ] Go / [ ] No-Go |
| **Safety** | Safety case document complete and reviewed | [ ] Go / [ ] No-Go |
| **Safety** | Emergency response plan tested and approved | [ ] Go / [ ] No-Go |
| **Technical** | All FAT items passed | [ ] Go / [ ] No-Go |
| **Technical** | All SAT items passed | [ ] Go / [ ] No-Go |
| **Technical** | Integration testing complete, no critical issues open | [ ] Go / [ ] No-Go |
| **Technical** | HD map validated, localization accuracy confirmed | [ ] Go / [ ] No-Go |
| **Operational** | Safety operators trained and certified | [ ] Go / [ ] No-Go |
| **Operational** | ROC staffed and operational procedures documented | [ ] Go / [ ] No-Go |
| **Operational** | Maintenance plan in place, spares available | [ ] Go / [ ] No-Go |
| **Regulatory** | Airport authority written approval for pilot operations | [ ] Go / [ ] No-Go |
| **Regulatory** | FAA/CAA notification complete (if required) | [ ] Go / [ ] No-Go |
| **Regulatory** | Insurance coverage active and sufficient | [ ] Go / [ ] No-Go |
| **Stakeholder** | Airlines and ground handlers briefed and acknowledged | [ ] Go / [ ] No-Go |
| **Stakeholder** | ATC coordination protocol agreed | [ ] Go / [ ] No-Go |
| **Support** | Incident reporting system in place | [ ] Go / [ ] No-Go |
| **Support** | Escalation procedures documented | [ ] Go / [ ] No-Go |

**Decision:** All criteria must be "Go" to proceed. Any "No-Go" requires documented remediation plan with timeline.

---

## 5. Pilot Operations

### 5.1 How to Run a Pilot (1-3 Vehicles)

**Pilot Scope Definition:**

| Parameter | Recommended Pilot Scope |
|---|---|
| Fleet size | 1-3 vehicles |
| Duration | 6-12 months |
| Operating hours | Defined shift (e.g., 06:00-22:00), expanding over time |
| Routes | 1-3 fixed routes, well-characterized |
| Speed | Conservative (10-20 km/h, below site maximum) |
| Weather limits | Clear to moderate conditions initially |
| Cargo/payload | Non-critical loads initially (training baggage, non-time-sensitive cargo) |
| Automation level | SAE Level 3-4 with human safety operator on or near vehicle |

**Phased Pilot Approach:**

**Phase A: Shadow Mode (Weeks 1-4)**
- Vehicle operates with a safety driver who controls the vehicle manually
- Autonomous system runs in parallel, making decisions but not controlling the vehicle
- Compare autonomous decisions to human driver actions
- Identify edge cases and system limitations
- Target: 200+ operational hours in shadow mode

**Phase B: Supervised Autonomy (Weeks 5-16)**
- Vehicle operates autonomously with safety operator in the vehicle
- Safety operator can intervene at any time via steering wheel, brake, or E-Stop
- Document all interventions (disengagements) with detailed root cause analysis
- Target: Demonstrate improving disengagement rate (industry benchmark trend: ~16.7% reduction per year of testing)
- Initial target: <1 disengagement per 10 km, improving to <1 per 50 km

**Phase C: Remote Supervision (Weeks 17-26)**
- Safety operator moves from vehicle to a follow vehicle or fixed observation point
- Remote operator monitors via ROC with intervention capability
- Safety operator remains within line-of-sight initially, then moves to ROC-only
- Requires demonstrated reliability: <1 disengagement per 100 km
- Airport authority approval required for this transition

**Phase D: Routine Operations (Weeks 27-52)**
- Vehicle operates with ROC monitoring only (no on-site safety operator per vehicle)
- 1 safety operator available as roving support for 1-3 vehicles
- Formal performance reporting to airport authority (monthly)
- Continuous improvement based on data analysis

### 5.2 Scope Limitations

During pilot operations, the following limitations should be clearly defined and communicated:

- **No mixed traffic with aircraft under power:** Initially, do not operate in areas where aircraft are actively taxiing under their own power
- **No runway crossings:** Even if the route conceptually requires it, avoid runway crossings during pilot phase
- **Weather restrictions:** Define clear weather minimums (e.g., visibility >500 m, wind <40 km/h, no active thunderstorm, rain intensity <50 mm/h)
- **Time restrictions:** Avoid peak traffic periods initially; operate during off-peak hours
- **Cargo restrictions:** No dangerous goods, no live animals, no high-value or time-critical cargo
- **Speed restrictions:** Maximum 15-20 km/h during pilot, regardless of route speed limits
- **Passenger restrictions:** No passengers in/on the vehicle during initial pilot

### 5.3 Human Supervision Requirements

**FAA Guidance (per CertAlert 24-02 and Bulletin 25-02):**
- A human operator must remain capable of regaining instantaneous control of the AGVS should the automated system fail
- When operating around moving aircraft, airport employees, vehicles, and equipment, a human monitor should be physically located in/near the AGVS
- The human monitor must be properly badged/escorted by the airport and trained in airport policies

**Supervision Ratio Progression:**

| Phase | Ratio (Operator:Vehicle) | Operator Location |
|---|---|---|
| Shadow Mode | 1:1 | In vehicle |
| Supervised Autonomy | 1:1 | In vehicle |
| Remote Supervision (early) | 1:1 | Follow vehicle / observation point |
| Remote Supervision (mature) | 1:2 | ROC + roving field support |
| Routine Operations | 1:3 to 1:5 | ROC + roving field support |
| Full Scale | 1:5 to 1:10 | ROC only + on-call field support |

### 5.4 Data Collection

**Operational Data (Collected Continuously):**
- Vehicle telemetry: position, speed, heading, steering angle, brake pressure, motor torque
- Sensor data: raw LiDAR, camera, radar data (stored for replay and analysis)
- Perception outputs: detected objects, classifications, tracked trajectories
- Planning outputs: planned trajectories, decision points, yield/go decisions
- Control outputs: steering commands, throttle/brake commands, actual vs. planned deviation
- Communication metrics: signal strength, latency, packet loss, failover events
- System health: compute temperature, memory usage, sensor status, battery state

**Safety-Critical Events (Flagged and Reviewed Within 24 Hours):**
- All disengagements (human takeover) with categorization:
  - Safety disengagement: intervention to prevent unsafe condition
  - Non-safety disengagement: intervention for comfort, efficiency, or operational reasons
  - System-initiated disengagement: vehicle requested human takeover
- All E-Stop activations
- All near-miss events (object detected within safety margin)
- All geofence alerts
- All communication loss events
- All perception anomalies (false positive/negative detections)

**Performance Metrics (Calculated Daily):**
- Distance driven (autonomous vs. manual)
- Hours operated (autonomous vs. manual)
- Missions completed vs. assigned
- Disengagement rate per km and per hour
- Average speed (moving vs. overall)
- On-time performance for scheduled missions
- Energy consumption per km

---

## 6. Safety Validation

### 6.1 How Many Hours/Km for Safety Case

The RAND Corporation's landmark study "Driving to Safety" (Kalra & Paddock, 2016) established that demonstrating AV safety purely through miles driven is statistically impractical for rare events like fatalities, requiring hundreds of billions of miles. However, airport operations differ fundamentally from public roads:

**Airport-Specific Safety Case Approach:**

Rather than attempting to demonstrate statistical safety through mileage alone, airport AV safety cases should use a multi-pillar approach:

| Pillar | Description | Minimum Threshold |
|---|---|---|
| **Simulation Testing** | Virtual testing of perception, planning, and control | 100,000+ simulated scenarios covering all identified hazards |
| **Closed-Course Testing** | Track testing of safety-critical scenarios | 500+ structured test cases, all passed |
| **Operational Testing** | Real-world driving in the airport environment | 5,000+ autonomous km with <1 safety disengagement per 500 km |
| **Safety Audit** | Independent review of safety processes, design, and operations | Complete audit with no critical findings |
| **In-Service Monitoring** | Continuous monitoring during operations | Ongoing, with defined escalation triggers |

**Recommended Minimum Operational Testing Before Moving to Unsupervised Operations:**
- 10,000 autonomous km without a safety-critical disengagement
- 2,000 operational hours without a safety-critical incident
- 500+ loading/unloading cycles without a safety event
- 50+ successful adverse weather operations (rain, low visibility, wind)
- Zero collisions with aircraft, vehicles, infrastructure, or personnel
- Demonstrated improvement trend in disengagement rate over time

**Note:** These thresholds are guidelines based on industry practice. The actual requirements will be determined through negotiation with the airport authority and aviation regulator, informed by the specific risk profile of the operational design domain.

### 6.2 Scenario Testing Requirements

**Scenario Categories and Example Tests:**

**Category 1: Normal Operations**
- Drive full route from start to destination at operational speed
- Navigate all intersections and yield points
- Complete loading/unloading at designated positions
- Return to charging station and initiate charging
- Operate for full shift duration

**Category 2: Dynamic Object Interaction**
- Pedestrian crossing path at various distances and speeds
- Vehicle crossing path at intersection
- Vehicle approaching from behind (overtaking scenario)
- Stationary obstacle in lane (parked vehicle, equipment, FOD)
- Multiple simultaneous objects requiring priority decision
- Aircraft pushback across AV route

**Category 3: Degraded Conditions**
- Rain (light, moderate, heavy up to 50 mm/h)
- Fog (visibility 200 m, 500 m, 1000 m)
- Night operations (with and without apron lighting)
- Wet surface (reduced traction)
- Glare (sun angle, reflections from aircraft)
- Wind gusts (30-50 km/h)
- Single sensor failure (LiDAR, camera, radar, GNSS)
- Single communication link failure
- Partial compute degradation

**Category 4: Emergency Scenarios**
- E-Stop from all trigger sources
- Loss of all communication
- Complete GNSS failure
- Multiple simultaneous sensor failures
- Vehicle mechanical failure (tire, steering, brake warning)
- Fire or smoke detection on vehicle
- Airport emergency (aircraft emergency, security incident)
- Power failure at charging station

**Category 5: Edge Cases (Airport-Specific)**
- Jet blast encounter (thermal and aerodynamic detection)
- FOD on driving surface
- Water pooling on apron
- Ice or snow on driving surface
- Construction zone with changed layout
- Unusual vehicle (oversized load, emergency vehicle with lights)
- Aircraft under tow crossing path
- Personnel running (emergency evacuation scenario)
- Flocks of birds on apron

### 6.3 Incident Response Plan

**Incident Classification:**

| Level | Description | Response Time | Notification |
|---|---|---|---|
| **Level 1: Critical** | Collision with aircraft, vehicle, person, or infrastructure causing injury or significant damage | Immediate | Airport Ops, Emergency Services, ATC, AV Company CEO, Regulator (within 2 hours) |
| **Level 2: Serious** | Near-miss with aircraft or person, property damage without injury, vehicle fire | <15 minutes | Airport Ops, AV Operations Manager, Safety Manager (within 4 hours) |
| **Level 3: Moderate** | Vehicle stops unexpectedly blocking operations, cargo damage, minor vehicle damage | <30 minutes | AV Operations Manager, Airport Ops (within 24 hours) |
| **Level 4: Minor** | System anomaly, unexpected disengagement, communication loss recovered | <2 hours | AV Operations Team (within 24 hours) |

**Incident Response Procedure:**

**Immediate Actions (first 5 minutes):**
1. Activate E-Stop if not already triggered
2. Ensure safety of all personnel in the area
3. Notify Airport Operations Control (radio channel designated for AV operations)
4. If injury: call emergency services, begin first aid
5. If blocking aircraft operations: notify ATC immediately
6. Secure the scene, prevent further damage
7. Activate vehicle hazard lights and deploy warning cones

**Short-Term Actions (5-60 minutes):**
1. Deploy incident response team to scene
2. Document the scene: photographs, measurements, witness statements
3. Preserve all vehicle data logs (do not power cycle unless necessary for safety)
4. If vehicle can be moved safely: relocate to non-operational area
5. If vehicle cannot be moved: arrange towing and notify affected operations
6. Begin preliminary incident report
7. Notify insurance provider (for Level 1 and 2 incidents)

**Investigation Phase (1-7 days):**
1. Download and preserve all sensor data, logs, and telemetry
2. Reconstruct the incident using data replay tools
3. Identify root cause and contributing factors
4. Determine if the incident reveals a systemic issue
5. If systemic: suspend operations pending resolution
6. If isolated: document corrective actions and resume with enhanced monitoring

**Post-Incident Actions:**
1. Complete formal incident report
2. Update risk register with new or revised risk entries
3. Implement corrective actions
4. Conduct lessons-learned session with all stakeholders
5. Submit regulatory notifications as required
6. Update training materials if needed
7. Resume operations with formal approval from Safety Manager

**Operational Pause Triggers (Suspend All AV Operations Immediately):**
- Any collision with an aircraft
- Any injury to a person caused by the AV
- Multiple Level 2 incidents within 7 days
- Systemic software or hardware failure affecting safety functions
- Regulator direction to cease operations
- Airport authority direction to cease operations

---

## 7. Scaling from Pilot to Operations

### 7.1 Adding Vehicles

**Fleet Expansion Criteria (Prerequisites Before Adding Each Batch):**
- Current fleet achieving target KPIs for 30 consecutive days
- No open Level 1 or Level 2 incidents
- Disengagement rate below target threshold
- ROC capacity and operator staffing sufficient for expanded fleet
- Charging infrastructure sufficient for expanded fleet
- Maintenance capacity (tools, spares, trained technicians) scaled
- Insurance coverage updated for expanded fleet
- Airport authority approval for expansion

**Recommended Expansion Schedule:**

| Phase | Fleet Size | Duration | Key Milestone |
|---|---|---|---|
| Pilot Phase A | 1 vehicle | Months 1-3 | Complete SAT, begin shadow mode |
| Pilot Phase B | 1-2 vehicles | Months 4-6 | Supervised autonomy, first disengagement targets met |
| Pilot Phase C | 2-3 vehicles | Months 7-12 | Remote supervision, routine operations demonstrated |
| Early Operations | 3-5 vehicles | Months 13-18 | Multiple routes, off-peak hours |
| Growing Operations | 5-10 vehicles | Months 19-24 | Extended hours, peak period introduction |
| Full Operations | 10-20+ vehicles | Months 25+ | 24/7 capability, full route network |

### 7.2 Expanding Routes

**Route Expansion Process:**
1. **Survey:** Map new route area using established mapping process
2. **Risk Assessment:** Conduct SRA for new route, update risk register
3. **Geofencing:** Define and validate geofences for new area
4. **Testing:** Run SAT test sequence on new route (abbreviated version, 2-3 days)
5. **Shadow Mode:** Operate in shadow mode on new route (1-2 weeks)
6. **Supervised:** Transition to supervised autonomy on new route
7. **Integration:** Add new route to fleet management system and operational schedule
8. **Approval:** Obtain airport authority sign-off for new route
9. **Operational:** Begin routine operations on new route

### 7.3 Reducing Human Supervision

**Supervision Reduction Decision Framework:**

| Metric | Threshold for Supervision Reduction |
|---|---|
| Autonomous km since last safety disengagement | >2,000 km |
| Operational hours since last safety disengagement | >500 hours |
| Total non-safety disengagement rate | <1 per 200 km |
| E-Stop activations | Zero in last 30 days |
| Near-miss events | <1 per 1,000 km |
| System availability (uptime) | >95% |
| Communication link availability | >99.5% |
| Airport authority comfort level | Documented approval |

**Supervision reduction must be approved by:**
1. AV Safety Manager
2. Airport Operations Manager
3. Airport Safety Manager
4. FAA/CAA (if required by terms of approval)

### 7.4 Fleet Management

**Fleet Management System Requirements:**

- **Real-time vehicle tracking:** Position, speed, heading, status for all vehicles on a single dashboard
- **Mission management:** Automated task assignment based on demand, vehicle availability, and route optimization
- **Charging management:** Automated charge scheduling to ensure vehicle availability while minimizing energy costs
- **Health monitoring:** Continuous vehicle health tracking with predictive maintenance alerts
- **Data management:** Centralized collection, storage, and analysis of all operational data
- **Reporting:** Automated daily, weekly, and monthly performance reports
- **Alerting:** Tiered alert system with escalation to appropriate personnel
- **Map management:** Version-controlled HD map deployment to fleet
- **Software management:** Staged OTA software deployment with rollback capability
- **Compliance:** Audit trail for all operational decisions and system changes

**Fleet Operations Center Staffing:**

| Shift | Fleet Size 1-3 | Fleet Size 4-10 | Fleet Size 11-20 | Fleet Size 20+ |
|---|---|---|---|---|
| Day (peak) | 1 operator | 2 operators + 1 supervisor | 3 operators + 1 supervisor | 4+ operators + 1 supervisor |
| Evening | 1 operator | 1 operator | 2 operators + 1 supervisor | 3+ operators + 1 supervisor |
| Night (if 24/7) | 1 operator | 1 operator | 1 operator + 1 on-call | 2 operators + 1 on-call |
| Field support | 1 roving | 1 roving | 2 roving | 1 per 10 vehicles |

---

## 8. Airport Stakeholder Management

### 8.1 Who Needs to Approve What

**Approval Matrix:**

| Stakeholder | What They Approve | When Needed | How to Engage |
|---|---|---|---|
| **Airport Authority / Operator** | Overall permission to operate on airport property; specific areas, routes, and times; access to airside | Before any on-airport activity | Formal meetings, written agreements, regular progress reports |
| **FAA (Part 139 airports)** | Review and awareness of AGVS operations; may require modifications to Airport Certification Manual (ACM) | Before testing in movement areas; early notification for non-movement areas | Contact Regional Airport Certification Safety Inspector per CertAlert 24-02 |
| **National CAA (non-US)** | Regulatory approval depending on jurisdiction; may require formal safety case submission | Varies by country; engage early | Formal application process; reference ICAO standards |
| **ATC / Tower** | Coordination procedures for areas near movement areas; communication protocols | Before any operations near taxiways or runways | Joint meetings, agreed communication protocol document |
| **Airlines** | Acknowledgment of AV operations; integration with turnaround process; data sharing for A-CDM | Before pilot operations on routes serving their gates | Airline station manager briefings; written notification |
| **Ground Handling Companies** | Integration with ground handling workflows; deconfliction of movements; personnel safety briefing | Before pilot operations on shared apron areas | Joint operational procedures; training for GH staff |
| **Fuel Companies** | Deconfliction of fuel truck movements; safety in fuel zones | Before operations near fuel hydrant systems or fuel farms | Safety briefing; operating procedure agreement |
| **Airport Security** | Vehicle access credentials; background checks for operators; cybersecurity review | Before first vehicle enters airside | Security department engagement; compliance documentation |
| **Airport Fire Service** | Emergency response procedures for AV incidents; vehicle familiarization | Before pilot operations | Fire service briefing; familiarization session with AV |
| **Insurance Provider** | Coverage for AV operations; liability terms | Before first operational movement | Policy negotiation; risk assessment submission |
| **Local Regulator (vehicles)** | Vehicle registration or exemption (if operating on public roads to access airport) | If AV transits public roads | Application per local AV regulations |

### 8.2 Stakeholder Communication Plan

**Regular Communications:**

| Communication | Audience | Frequency | Content |
|---|---|---|---|
| Progress Report | Airport Authority, FAA/CAA | Monthly | KPIs, incidents, upcoming milestones |
| Operations Brief | Airlines, Ground Handlers | Bi-weekly during pilot, monthly at scale | Schedule changes, route expansions, lessons learned |
| Safety Report | Airport Safety Committee | Quarterly | Safety metrics, risk register updates, incident analysis |
| Executive Update | Airport CEO, AV Company leadership | Quarterly | Strategic progress, business case tracking, expansion plans |
| ATC Coordination | ATC / Tower | As needed, minimum monthly | Route changes, schedule changes, communication protocol updates |
| Awareness Notice | All airport tenants and personnel | Before each major phase change | What to expect, safety information, contact details |

---

## 9. Training

### 9.1 Operator Training

**Safety Operator / Vehicle Operator Training Program:**

| Module | Duration | Content |
|---|---|---|
| **Module 1: Airport Fundamentals** | 8 hours | Airside safety, ramp rules, FOD awareness, emergency procedures, radio communications, badge requirements |
| **Module 2: Vehicle Systems** | 16 hours | AV architecture overview, sensor systems, compute system, communication systems, E-Stop systems, manual driving controls |
| **Module 3: Autonomous Operations** | 16 hours | How the AV perceives, plans, and acts; understanding system limitations; recognizing degraded performance; ODD boundaries |
| **Module 4: Intervention and Takeover** | 16 hours | When and how to intervene; disengagement procedures; manual override techniques; practice scenarios on closed course |
| **Module 5: Normal Operations** | 8 hours | Pre-trip checks, startup/shutdown, mission management, charging procedures, shift handover, data reporting |
| **Module 6: Emergency Procedures** | 8 hours | E-Stop activation, incident response, vehicle recovery, emergency communication, airport emergency plan integration |
| **Module 7: ROC Operations** | 8 hours | Remote monitoring interface, teleoperation (if applicable), fleet management dashboard, alert handling, escalation |
| **Module 8: Practical Assessment** | 16 hours | Supervised operation of AV on actual routes; emergency scenario exercises; written and practical examination |

**Total Training Duration:** 96 hours (approximately 12 days)

**Certification Requirements:**
- Pass written examination (minimum 80% score)
- Pass practical assessment (assessed by qualified examiner)
- Complete 40 hours of supervised operational experience
- Recertification annually with 8-hour refresher course
- Additional training required when new routes, vehicles, or software versions are introduced

### 9.2 Maintenance Training

**Maintenance Technician Training Program:**

| Module | Duration | Content |
|---|---|---|
| Electrical Vehicle Systems | 16 hours | High-voltage safety, battery management, charging systems, 12V/24V systems |
| Sensor Systems | 16 hours | LiDAR maintenance and cleaning, camera systems, radar, GNSS, sensor replacement procedures |
| Calibration | 8 hours | Intrinsic and extrinsic calibration procedures, calibration validation, tools and targets |
| Compute Systems | 8 hours | Compute hardware, storage, networking, software update procedures, log extraction |
| Mechanical Systems | 8 hours | Brakes, steering, suspension, tires, body, cargo interface |
| Diagnostic Tools | 8 hours | Vehicle diagnostic interface, health monitoring dashboard, common fault codes, troubleshooting trees |
| Safety Procedures | 4 hours | Lockout/tagout, high-voltage isolation, safe lifting, PPE requirements |

**Total Duration:** 68 hours (approximately 8.5 days)

### 9.3 Incident Response Training

**For all AV operations personnel (operators, maintenance, managers):**
- 4-hour initial incident response training
- Tabletop exercise simulating Level 1 and Level 2 incidents
- Practical exercise with controlled scenario annually
- Joint exercise with airport fire service annually
- Debrief and lessons learned after every real incident

### 9.4 Airport Staff Awareness

**For all airport personnel who may encounter AVs (ground handlers, airline staff, security, fire service):**

**Awareness Briefing (30-60 minutes):**
- What the AV looks like and where it operates
- How the AV behaves (what to expect: speed, sounds, lights, yielding behavior)
- What the AV can and cannot detect
- How to behave around the AV (do not obstruct, maintain distance, use designated crossings)
- How to identify if the AV is in autonomous or manual mode (indicator lights)
- What to do if the AV behaves unexpectedly (do not approach, contact Airport Ops)
- Emergency stop: location and use of external E-Stop button (if equipped)
- Contact information for AV operations team

**Delivery Method:**
- Include in existing airside safety induction for new personnel
- Distribute as safety briefing document to all affected organizations
- Post awareness signage at AV route crossing points
- Brief via toolbox talks before AV operations begin in a new area
- Annual refresher included in airside safety recertification

---

## 10. Maintenance and Support

### 10.1 Preventive Maintenance Schedule

| Task | Frequency | Duration | Performed By |
|---|---|---|---|
| **Daily CIL (Clean, Inspect, Lubricate)** | Every shift start | 15-30 min | Operator |
| Sensor lens/window cleaning | Daily (more in dusty/wet conditions) | 10 min | Operator |
| Visual inspection of body, tires, lights | Daily | 10 min | Operator |
| Check for FOD damage, fluid leaks | Daily | 5 min | Operator |
| E-Stop function test | Daily | 2 min | Operator |
| **Weekly Checks** | Weekly | 1-2 hours | Technician |
| Tire pressure and condition check | Weekly | 15 min | Technician |
| Brake system inspection | Weekly | 20 min | Technician |
| Battery health check (state of health, cell balance) | Weekly | 15 min | Technician |
| Communication system test (all links) | Weekly | 15 min | Technician |
| Data download and log review | Weekly | 30 min | Technician |
| **Monthly Checks** | Monthly | 4-6 hours | Technician |
| Sensor calibration verification | Monthly | 2 hours | Technician |
| Full extrinsic calibration check | Monthly | 1 hour | Technician |
| Steering alignment check | Monthly | 30 min | Technician |
| Suspension inspection | Monthly | 30 min | Technician |
| Wiring and connector inspection | Monthly | 30 min | Technician |
| Software diagnostic review | Monthly | 30 min | Technician |
| Cleaning of all sensor apertures with approved materials | Monthly (deep clean) | 30 min | Technician |
| **Quarterly Service** | Quarterly | Full day | Technician |
| Full brake service (pads, fluid, lines) | Quarterly | 2 hours | Technician |
| Full calibration (intrinsic + extrinsic) | Quarterly | 3 hours | Technician |
| Battery deep diagnostic | Quarterly | 1 hour | Technician |
| Charging system inspection | Quarterly | 1 hour | Technician |
| HD map accuracy validation drive | Quarterly | 2 hours | Technician + Operator |
| **Semi-Annual Service** | Every 6 months | 1-2 days | Technician |
| Full vehicle service per manufacturer schedule | Semi-annual | Full day | Technician |
| Sensor hardware health assessment | Semi-annual | 4 hours | Technician |
| Compute hardware inspection (fans, thermal paste, storage health) | Semi-annual | 2 hours | Technician |
| Safety system comprehensive test | Semi-annual | 4 hours | Technician |
| **Annual Service** | Annually | 2-3 days | Technician + Specialist |
| Full vehicle inspection and certification | Annual | Full day | Technician |
| Independent safety audit | Annual | 1-2 days | External auditor |
| Comprehensive sensor replacement assessment | Annual | 4 hours | Specialist |
| Insurance renewal inspection | Annual | Half day | Technician + Insurer |

### 10.2 Sensor Cleaning

**Cleaning Materials:**
- Denatured alcohol or sensor-specific cleaning solution (manufacturer approved)
- Lint-free microfiber cloths
- Compressed air (oil-free, filtered)
- Soft-bristle brush for loose debris removal

**Do NOT Use:**
- Paper towels, tissue, or abrasive cloths
- Household glass cleaners (may damage optical coatings)
- High-pressure water jets on sensor apertures
- Solvents not approved by sensor manufacturer

**Automated Cleaning Systems:**
- Consider integrating automated lens cleaning systems that use fluid-based nozzles or mechanical wipers
- Automated systems trigger when 15-30% dirt coverage is detected
- Image processing software should differentiate between rain, dust, and debris for targeted cleaning

**Cleaning Triggers:**
- Scheduled: at start of each shift
- Condition-based: when perception system reports degraded detection confidence (<95% target)
- Weather-driven: after rain, dust storm, snow, or bird strike
- Incident-driven: after any off-normal event

### 10.3 Calibration Checks

**Field Calibration Validation (Monthly):**
1. Drive the calibration validation route (defined section of operational route with known reference points)
2. Verify LiDAR point cloud alignment between multiple sensors (<2 cm disagreement)
3. Verify LiDAR-to-camera projection accuracy (<3 pixels at 50 m)
4. Verify localization accuracy against ground truth markers (<10 cm)
5. Check object detection confidence at known distances (>95% at operational range)
6. Document results in calibration log

**Full Recalibration Triggers:**
- Any physical impact to the vehicle
- Sensor replacement
- Monthly validation shows drift beyond threshold
- After any major maintenance involving sensor mounting

### 10.4 Software Updates

**OTA Update Process:**
1. Software team develops and tests update in simulation and staging environments
2. Update package is cryptographically signed and validated (per UN R155/R156)
3. Update is deployed to 1 vehicle first (canary deployment)
4. Canary vehicle runs in shadow mode for 24-48 hours with new software
5. If no issues: deploy to remaining fleet in rolling update (one vehicle at a time)
6. Each vehicle runs in shadow mode for 4 hours after update before returning to autonomous operations
7. Rollback capability: ability to revert to previous software version within 30 minutes

**Update Categories:**
- **Critical safety patch:** Deploy within 24 hours, may require operational pause
- **Bug fix:** Deploy within 1 week
- **Feature enhancement:** Deploy in next scheduled maintenance window
- **HD map update:** Deploy within 48 hours of map change, shadow mode validation required

**Geofenced Rollout:**
- Updates are first tested on a small group of vehicles and gradually rolled out
- Monitoring period between batches to verify stability
- Full fleet update within 2 weeks of initial canary deployment

---

## 11. Operational Procedures

### 11.1 Daily Pre-Flight Checks

**Pre-Shift Vehicle Inspection Checklist (15-30 minutes per vehicle):**

**Exterior Inspection:**
- [ ] Walk around vehicle: check for damage, leaks, FOD attached to vehicle
- [ ] Tires: visual condition check, no cuts or bulges
- [ ] Lights: headlights, taillights, turn signals, hazard lights, beacon -- all functional
- [ ] Sensors: all sensor lenses/windows clean and undamaged
- [ ] Sensor mounts: secure, no visible misalignment
- [ ] Body panels: secure, no loose parts
- [ ] Cargo area / dolly interface: secure, functional
- [ ] Charging connector: undamaged, clean
- [ ] E-Stop buttons: accessible, not damaged, covers in place

**Interior / System Checks:**
- [ ] Battery State of Charge: above minimum threshold for planned missions (typically >40%)
- [ ] Compute system: powered on, all processes running, no error alerts
- [ ] Sensor health dashboard: all sensors reporting, no degradation warnings
- [ ] Communication: cellular signal confirmed, ROC connection verified
- [ ] GNSS: position fix acquired, RTK corrections active, position accuracy <5 cm
- [ ] Localization: converged on HD map, localization confidence >95%
- [ ] E-Stop test: activate and deactivate hardware E-Stop, verify system response
- [ ] Geofence: verify current geofence configuration loaded
- [ ] Software version: matches approved operational version
- [ ] NOTAM check: review current NOTAMs for route impact (automated or manual)

**Confirmation:**
- [ ] Pre-shift inspection recorded in fleet management system
- [ ] Any defects reported and categorized (ground vehicle / return to service)
- [ ] Vehicle status set to "Ready for Operations" or "Not Available" with reason

### 11.2 Start-Up / Shutdown Procedures

**Start-Up Sequence:**
1. Complete pre-shift inspection checklist
2. Log into fleet management system with operator credentials
3. Verify ROC operator is on duty and monitoring
4. Confirm with Airport Operations that AV operations are clear to commence
5. Select first mission from dispatch queue
6. Verify route is clear (check for NOTAMs, construction, known obstructions)
7. Confirm weather conditions within operational limits
8. Transition vehicle to autonomous mode
9. Monitor first 2 minutes of operation closely for any anomalies
10. Confirm successful mission start to ROC

**Shutdown Sequence:**
1. Complete current mission or navigate to designated safe parking area
2. Transition vehicle to manual mode
3. Park vehicle in designated position
4. Apply parking brake
5. If charging needed: connect to charger, verify charging initiated
6. Run post-trip inspection:
   - [ ] New damage check (compare to pre-trip condition)
   - [ ] Fluid leak check
   - [ ] Sensor condition check
   - [ ] Log any anomalies observed during operations
7. Upload remaining data logs
8. Set vehicle status to "Parked" or "Charging" in fleet management system
9. Complete shift report
10. Hand over to incoming operator (if shift change) with verbal briefing on:
    - Vehicle condition
    - Any issues encountered
    - Remaining mission queue
    - Weather forecast for next shift

### 11.3 Emergency Procedures

**AV Emergency Stop:**
1. Activate nearest E-Stop (hardware button on vehicle, remote from ROC, or software)
2. Vehicle stops and engages parking brake
3. Hazard lights activate automatically
4. Notify Airport Ops immediately via radio
5. Assess the situation from a safe distance
6. If safe to approach: deploy warning cones around vehicle
7. Follow incident response procedure based on severity level

**Communication Loss:**
1. Vehicle automatically executes safe-stop after 5-second timeout
2. ROC operator alerts field support
3. Field support travels to vehicle location
4. Field support assesses communication status
5. If comms restored: resume operations from ROC after system health check
6. If comms not restored: manual drive to maintenance area

**Vehicle Fire:**
1. Activate E-Stop (if not already)
2. Evacuate all personnel from 50 m radius
3. Notify Airport Fire Service immediately
4. Do NOT attempt to fight a battery fire with water (use Class D extinguisher or dry chemical)
5. Airport Fire Service responds per airport emergency plan
6. AV operations team provides vehicle technical briefing to fire crew (battery location, high-voltage isolation procedure)

**Aircraft Emergency on Airport:**
1. ROC operator receives airport emergency notification
2. All AVs immediately execute safe-stop and move to shoulder/edge of route
3. AVs must not impede emergency vehicle access routes
4. Operations remain suspended until airport declares "all clear"
5. Post-emergency: verify all AVs safe and operational before resuming

**Adverse Weather Procedures:**

| Condition | Threshold | Action |
|---|---|---|
| Rain (light) | <10 mm/h | Normal operations, increased sensor cleaning |
| Rain (moderate) | 10-25 mm/h | Reduce speed by 30%, increase following distance |
| Rain (heavy) | 25-50 mm/h | Reduce speed by 50%, restrict to essential routes |
| Rain (extreme) | >50 mm/h | Suspend operations, vehicles safe-stop |
| Fog | Visibility 500-1000 m | Reduce speed by 30% |
| Fog (dense) | Visibility <500 m | Suspend operations |
| Wind | 30-50 km/h | Reduce speed by 20%, monitor stability |
| Wind (strong) | >50 km/h | Suspend operations |
| Snow / Ice | Any accumulation on route | Suspend operations (unless specifically validated) |
| Thunderstorm | Within 10 km | Suspend operations, vehicles safe-stop in protected area |
| Dust storm | Visibility <500 m | Suspend operations |

**Weather Monitoring:**
- Integrate with airport METAR/AWOS feeds for automated weather monitoring
- Define automatic weather alerts in fleet management system
- ROC operator has authority to suspend operations for weather at any time
- Operations resume only after weather conditions return to limits for 30 minutes

---

## 12. KPIs and Reporting

### 12.1 What to Measure

**Safety KPIs:**

| KPI | Definition | Target (Pilot) | Target (Operations) |
|---|---|---|---|
| Safety Disengagement Rate | Safety disengagements per 1,000 autonomous km | <2.0 | <0.2 |
| Non-Safety Disengagement Rate | Non-safety disengagements per 1,000 autonomous km | <10.0 | <1.0 |
| Collision Rate | Collisions per 100,000 autonomous km | 0 | 0 |
| Near-Miss Rate | Near-miss events per 1,000 autonomous km | <5.0 | <1.0 |
| E-Stop Activations | E-Stop events per 1,000 autonomous km | <1.0 | <0.1 |
| Geofence Violations | Soft boundary alerts per 1,000 autonomous km | <0.5 | <0.1 |
| Incident Count | Level 1-2 incidents per month | 0 | 0 |
| Mean Distance Between Disengagements | Autonomous km per disengagement | >500 km | >5,000 km |

**Operational KPIs:**

| KPI | Definition | Target |
|---|---|---|
| System Availability | % of scheduled operating time vehicle is available | >90% (pilot), >95% (ops) |
| Mission Completion Rate | % of assigned missions completed successfully | >95% (pilot), >99% (ops) |
| On-Time Performance | % of missions completed within schedule window | >85% (pilot), >95% (ops) |
| Average Speed | Average moving speed as % of allowed speed | >70% |
| Vehicle Utilization | % of available hours vehicle is on mission | >40% (pilot), >70% (ops) |
| Communication Availability | % of time at least one comms link is active | >99.0% (pilot), >99.9% (ops) |
| Charging Efficiency | % of charging sessions completing without issue | >95% |
| Localization Accuracy | 95th percentile position error (cm) | <15 cm |

**Maintenance KPIs:**

| KPI | Definition | Target |
|---|---|---|
| Preventive Maintenance Compliance | % of scheduled PM tasks completed on time | >95% |
| Mean Time Between Failures (MTBF) | Average hours between unplanned maintenance | >200 hours (pilot), >500 hours (ops) |
| Mean Time to Repair (MTTR) | Average hours to return vehicle to service | <4 hours |
| Sensor Replacement Rate | Sensor replacements per vehicle per quarter | <2 |
| Software Update Success Rate | % of OTA updates applied successfully | >99% |

### 12.2 How to Report to Airport Authority

**Monthly Operational Report (Required):**

1. **Executive Summary** (1 page)
   - Key metrics dashboard
   - Notable achievements and milestones
   - Issues and remediation status

2. **Safety Performance** (2-3 pages)
   - All KPIs from safety table above, with trend graphs
   - All incidents and near-misses with root cause analysis
   - Risk register updates
   - Safety improvement actions taken

3. **Operational Performance** (2-3 pages)
   - Autonomous km and hours driven
   - Mission volume and completion rates
   - Route performance comparison
   - Weather-related operational impacts

4. **Maintenance and Reliability** (1-2 pages)
   - Vehicle availability and downtime causes
   - Maintenance activities completed
   - Software updates deployed
   - Hardware issues and replacements

5. **Upcoming Plans** (1 page)
   - Next month's operational plan
   - Route or fleet changes planned
   - Software updates scheduled
   - Training activities planned

**Quarterly Safety Review (Formal Presentation):**
- Present to Airport Safety Committee
- Comprehensive safety trend analysis
- Risk register review (all items)
- Safety case update
- External incident benchmarking
- Safety improvement roadmap

### 12.3 Continuous Improvement Loop

**Data-Driven Improvement Cycle:**

```
Collect Data --> Analyze Performance --> Identify Gaps -->
Root Cause Analysis --> Implement Changes --> Validate Impact -->
Update Procedures --> Collect Data (repeat)
```

**Key Improvement Processes:**

1. **Daily Data Review:** Operations team reviews all disengagements, near-misses, and anomalies from previous 24 hours. Categorize by root cause. Feed into weekly analysis.

2. **Weekly Performance Review:** Operations manager reviews KPI trends, identifies degradation, prioritizes improvements. Feed critical issues to engineering team.

3. **Monthly Safety Review:** Safety manager reviews all safety KPIs, incident trends, risk register. Prepare monthly report for airport authority.

4. **Quarterly Strategic Review:** Leadership reviews overall program performance, business case tracking, expansion readiness, stakeholder satisfaction.

5. **Continuous Scenario Learning:** Every disengagement and near-miss becomes a new test scenario. Replay in simulation. Validate software fix. Add to regression test suite. Deploy improvement. This creates a virtuous cycle where operational experience directly improves system capability.

---

## 13. Multi-Airport Expansion

### 13.1 Adapting to New Airports

**New Airport Assessment Checklist:**

| Assessment Area | Key Questions |
|---|---|
| Regulatory | Different country/jurisdiction? What aviation authority? What autonomous vehicle regulations? |
| Infrastructure | GNSS coverage quality? Cellular coverage? Power availability? Weather conditions? |
| Layout | Apron configuration? Gate types? Vehicle traffic patterns? Surface conditions? |
| Operations | Different ground handlers? Different airlines? Different flight mix? Different peak patterns? |
| Climate | Temperature extremes? Precipitation types and frequency? Wind patterns? Visibility patterns? |
| Stakeholders | Different airport authority expectations? Different ATC procedures? Different security requirements? |

### 13.2 What's Reusable

| Component | Reusability | Notes |
|---|---|---|
| Vehicle hardware | **100% reusable** | Same vehicle operates at any airport (adjust for local regulations) |
| Perception software | **95% reusable** | Core algorithms transfer; may need retraining for local GSE types, aircraft mix |
| Planning software | **90% reusable** | Core planner transfers; speed profiles and intersection logic may need adjustment |
| Control software | **95% reusable** | Vehicle dynamics same; surface conditions may differ |
| Fleet management system | **95% reusable** | Same platform; configure for local routes and schedules |
| ROC systems | **90% reusable** | Same interface; configure for local operations |
| Safety case framework | **80% reusable** | Same methodology; hazard analysis must be site-specific |
| Training curriculum | **85% reusable** | Same core content; airport-specific module must be updated |
| Maintenance procedures | **95% reusable** | Same vehicle, same procedures |
| Operational procedures | **70% reusable** | Core procedures transfer; site-specific procedures needed |
| KPI framework | **95% reusable** | Same metrics; targets may differ based on site complexity |
| Insurance framework | **60% reusable** | Policy structure reusable; coverage and terms site-specific |

### 13.3 What Needs to Be Redone

| Activity | Effort (% of first site) | Duration |
|---|---|---|
| Site survey | 100% | 1-2 weeks |
| HD mapping | 100% | 1-2 weeks |
| Waypoint creation and geofencing | 100% | 1-2 weeks |
| Stakeholder engagement | 80% | 2-3 months |
| Airport authority approval | 80% | 2-4 months |
| Risk assessment (site-specific) | 70% | 2-4 weeks |
| SAT testing | 60% | 1-2 weeks (streamlined from first site) |
| Pilot operations | 50% | 3-6 months (can be accelerated with proven track record) |
| Training (airport-specific module) | 30% | 1 week |
| Communication setup | 80% | 1-2 weeks |
| Charging infrastructure | 100% | 4-8 weeks |

**Expected Timeline for Second Airport:** 6-9 months from site survey to routine operations (compared to 12-18 months for first airport)

**Expected Timeline for Third+ Airport:** 4-6 months (further streamlined with reusable tooling and experienced team)

### 13.4 Multi-Airport Fleet Management

- Centralized ROC capable of monitoring vehicles across multiple airports
- Standardized software deployment pipeline across all sites
- Shared incident database and lessons-learned repository
- Cross-airport performance benchmarking
- Centralized spare parts inventory with logistics to each site
- Traveling deployment team for new site setup
- Site-specific operations teams for day-to-day management

---

## 14. Insurance and Liability

### 14.1 Who's Liable

**Liability Framework for Airport AV Operations:**

| Scenario | Primary Liability | Contributing Liability |
|---|---|---|
| AV collides with aircraft | AV operator/deployer | AV manufacturer (if system defect) |
| AV collides with person | AV operator/deployer | AV manufacturer (if perception failure) |
| AV collides with vehicle | AV operator/deployer | Other vehicle operator (if at fault) |
| AV collides with infrastructure | AV operator/deployer | Airport (if infrastructure defect) |
| Software defect causes incident | AV manufacturer | AV operator (if known defect, failed to update) |
| Sensor failure causes incident | Sensor manufacturer | AV integrator (if integration defect) |
| Cyber attack causes incident | AV operator (duty of care) | Attacker (criminal liability) |
| Cargo damage during transport | AV operator | Ground handler (if loading error) |
| Operator error (wrong mode, wrong route) | AV operator | Training provider (if inadequate training) |

**Key Liability Principles:**
- The entity deploying the AV (typically the airport operator or the AV service provider) holds primary operational liability
- Product liability may shift to the AV manufacturer for defects in design, manufacturing, or failure to warn
- Joint liability may apply when multiple parties contribute to an incident
- Strict liability applies in some jurisdictions: the AV operator is liable regardless of fault
- Contractual allocation of liability between airport and AV provider should be clearly defined in the operating agreement

### 14.2 Insurance Requirements

**Required Insurance Policies:**

| Policy Type | Purpose | Recommended Coverage |
|---|---|---|
| **Commercial General Liability (CGL)** | Third-party bodily injury and property damage | $10-25 million per occurrence |
| **Automobile Liability** | Vehicle-specific liability for AV operations | $5-10 million per occurrence |
| **Product Liability** | Defects in AV technology | $10-25 million aggregate (held by manufacturer) |
| **Cyber Liability** | Data breach, cyber attack, system compromise | $5-10 million per occurrence |
| **Airport Operator's Liability** | Airport-specific coverage (held by airport) | Per airport's existing policy |
| **Professional Liability (E&O)** | Errors in AV system design, deployment, operations | $5-10 million aggregate |
| **Workers' Compensation** | Injury to AV operators and technicians | Per local statutory requirements |
| **Property / Equipment** | AV vehicle damage, sensor damage, compute equipment | Replacement value per vehicle |
| **Business Interruption** | Loss of revenue due to operational suspension | 6-12 months operating costs |

**Note on Coverage Amounts:**
- Coverage amounts vary significantly based on airport size, traffic volume, and jurisdiction
- California requires $5 million minimum for AV testing; Florida requires $1 million minimum
- Airport operators typically require tenants to carry $10-25 million CGL as standard
- Commercial AV operators often carry $5 million or more per vehicle
- Consult with an aviation insurance broker specializing in airport operations for site-specific guidance

### 14.3 Claims Handling

**Claims Process:**
1. **Immediate:** Activate incident response procedure (see Section 6.3)
2. **Within 24 hours:** Notify insurance provider with preliminary incident report
3. **Within 48 hours:** Preserve all evidence (vehicle data, sensor logs, CCTV footage, witness statements)
4. **Within 7 days:** Submit formal claim with detailed incident report and supporting documentation
5. **Investigation:** Cooperate fully with insurer's investigation team; provide data access
6. **Resolution:** Work with insurer and legal counsel to resolve claims

**Data Preservation for Claims:**
- All vehicle sensor data (LiDAR, camera, radar) for 1 hour before and after incident
- All vehicle telemetry data for 24 hours before and after incident
- All communication logs between vehicle, ROC, and field personnel
- All system health data and error logs
- Airport CCTV footage (request from airport security within 24 hours)
- Weather data at time of incident
- NOTAM data at time of incident
- HD map version and geofence configuration at time of incident

**Retain all incident data for minimum 7 years** (or longer per local statute of limitations for personal injury claims).

---

## 15. Master Deployment Checklist

### Phase 0: Preparation (Months 1-4)

**Business Case and Strategy:**
- [ ] Build business case with ROI model
- [ ] Identify executive sponsor
- [ ] Secure initial funding
- [ ] Select AV technology partner/vendor
- [ ] Define target operational design domain (routes, areas, times)

**Regulatory Engagement:**
- [ ] Identify applicable aviation authority (FAA, CAA, EASA, etc.)
- [ ] Review FAA CertAlert 24-02 and Bulletin 25-02 (US) or equivalent guidance
- [ ] Contact FAA Regional Airport Certification Safety Inspector (Part 139) or Airports District Office
- [ ] Understand approval pathway and timeline
- [ ] Engage legal counsel on regulatory compliance

**Site Survey:**
- [ ] Complete physical environment assessment
- [ ] Complete operational environment assessment
- [ ] Complete infrastructure assessment
- [ ] Identify communication coverage gaps
- [ ] Document GPS shadow zones
- [ ] Produce site survey report

**Stakeholder Engagement:**
- [ ] Conduct internal alignment meeting
- [ ] Brief airport authority leadership
- [ ] Engage FAA/CAA informally
- [ ] Identify all affected external stakeholders
- [ ] Create stakeholder communication plan
- [ ] Begin airline and ground handler engagement

### Phase 1: Mapping and Vehicle Preparation (Months 4-7)

**Mapping:**
- [ ] Establish ground control point reference network
- [ ] Conduct mapping data collection drives
- [ ] Process point cloud data
- [ ] Extract and annotate features
- [ ] Build HD map (Road Model, Lane Model, Localization Model)
- [ ] Validate HD map with test drives
- [ ] Define waypoints for all planned routes
- [ ] Implement geofence boundaries (hard, soft, speed, dynamic)
- [ ] Set up NOTAM integration

**Vehicle Preparation:**
- [ ] Complete sensor mounting and wiring
- [ ] Perform intrinsic calibration of all sensors
- [ ] Perform extrinsic calibration (sensor-to-sensor, sensor-to-vehicle)
- [ ] Install compute hardware with safety architecture
- [ ] Set up communication stack (cellular, Wi-Fi, V2X)
- [ ] Install and test E-Stop systems (all types)
- [ ] Conduct Factory Acceptance Test (FAT)
- [ ] Ship vehicle to airport site

**Infrastructure:**
- [ ] Install charging infrastructure
- [ ] Set up edge compute / communication base stations (if needed)
- [ ] Set up Remote Operations Center (ROC)
- [ ] Verify communication coverage across operational area
- [ ] Install any required physical infrastructure (signage, markings, barriers)

### Phase 2: Testing (Months 7-9)

**Site Acceptance Test:**
- [ ] Complete SAT Phase 1: Static tests
- [ ] Complete SAT Phase 2: Low-speed controlled driving
- [ ] Complete SAT Phase 3: Operational speed testing
- [ ] Complete SAT Phase 4: Stress testing
- [ ] Document all SAT results

**Integration Testing:**
- [ ] Test fleet management system integration
- [ ] Test A-CDM / flight data integration
- [ ] Test NOTAM integration
- [ ] Test charging system integration
- [ ] Test ROC monitoring and control
- [ ] Test data pipeline end-to-end

**Safety Preparation:**
- [ ] Complete Hazard Identification (HAZID) workshop
- [ ] Complete Safety Risk Assessment (SRA)
- [ ] Create risk register with all identified hazards
- [ ] Develop incident response plan
- [ ] Develop emergency procedures
- [ ] Conduct tabletop emergency exercise
- [ ] Compile safety case document

**Approvals:**
- [ ] Submit safety case to airport authority
- [ ] Obtain written approval for pilot operations
- [ ] Confirm FAA/CAA notification complete
- [ ] Confirm insurance coverage active
- [ ] Confirm airline and ground handler acknowledgment

### Phase 3: Training (Months 8-9)

- [ ] Complete operator training (96 hours per operator)
- [ ] Complete maintenance technician training (68 hours per technician)
- [ ] Complete incident response training (all personnel)
- [ ] Conduct airport staff awareness briefings
- [ ] Brief airport fire service on AV emergency procedures
- [ ] Certify all operators (written + practical exam)
- [ ] Brief ATC on AV operations and coordination protocol

### Phase 4: Pilot Operations (Months 9-18)

- [ ] Conduct Operational Readiness Review (ORR)
- [ ] All ORR criteria passed: formal Go decision
- [ ] Begin Phase A: Shadow mode (4 weeks)
- [ ] Review shadow mode data, confirm readiness
- [ ] Begin Phase B: Supervised autonomy (12 weeks)
- [ ] Achieve disengagement rate target
- [ ] Airport authority review at mid-pilot point
- [ ] Begin Phase C: Remote supervision (10 weeks)
- [ ] Demonstrate reliability for remote supervision reduction
- [ ] Begin Phase D: Routine operations (26 weeks)
- [ ] Submit monthly operational reports to airport authority
- [ ] Conduct quarterly safety reviews

### Phase 5: Scaling (Months 18+)

**Fleet Expansion:**
- [ ] Achieve target KPIs for 30 consecutive days
- [ ] Obtain airport authority approval for expansion
- [ ] Scale ROC staffing for expanded fleet
- [ ] Scale maintenance capacity
- [ ] Scale charging infrastructure
- [ ] Update insurance coverage
- [ ] Add vehicles per expansion schedule

**Route Expansion:**
- [ ] Map and validate new routes
- [ ] Conduct SRA for new routes
- [ ] Complete abbreviated SAT on new routes
- [ ] Shadow mode on new routes
- [ ] Transition to supervised, then routine operations

**Supervision Reduction:**
- [ ] Achieve supervision reduction metrics
- [ ] Obtain approvals (Safety Manager, Airport Ops, Airport Safety, FAA/CAA)
- [ ] Implement new supervision model
- [ ] Monitor closely for 30 days after change
- [ ] Document results and update safety case

**Continuous Improvement:**
- [ ] Daily data review and anomaly categorization
- [ ] Weekly performance review
- [ ] Monthly safety and operational reports
- [ ] Quarterly strategic reviews
- [ ] Annual safety audit
- [ ] Annual insurance review
- [ ] Ongoing scenario learning from operational data

### Phase 6: Multi-Airport Expansion (When Ready)

- [ ] Complete new airport assessment checklist
- [ ] Identify site-specific requirements and delta from first site
- [ ] Engage new airport authority and regulator
- [ ] Conduct site survey and mapping
- [ ] Deploy vehicles to new site
- [ ] Execute streamlined testing and pilot program
- [ ] Establish local operations team
- [ ] Integrate into centralized fleet management
- [ ] Begin operations (target: 6-9 months for second site, 4-6 months for subsequent)

---

## Appendix A: Key Regulatory References

| Reference | Title | Relevance |
|---|---|---|
| FAA CertAlert 24-02 | Autonomous Ground Vehicle Systems (AGVS) Technology on Airports | Primary US guidance on AGVS at airports |
| FAA Bulletin 25-02 | AGVS Testing in Closed Movement Areas | US guidance on testing in movement areas |
| AC 150/5210-20A | Ground Vehicle Operations on Airports | General airport ground vehicle rules |
| AC 150/5220-26 | Airport Ground Vehicle Automatic Dependent Surveillance | VMAT transponder requirements |
| 14 CFR Part 139 | Certification of Airports | Airport certification standards |
| ICAO Annex 14 | Aerodromes | International aerodrome standards |
| IATA AHM 908 | Autonomous Vehicle Standards | Ground handling autonomous vehicle protocols |
| SAE J3016 | Taxonomy of Automated Driving | Automation level definitions |
| ISO 26262 | Functional Safety for Road Vehicles | Safety engineering standard |
| ISO 21448 (SOTIF) | Safety of the Intended Functionality | Addresses limitations and foreseeable misuse |
| UL 4600 | Safety for Autonomous Products | Safety case framework for autonomous systems |
| UN R155/R156 | Cybersecurity and Software Updates | OTA update security requirements |
| ACRP Research Report 219 | Advanced Ground Vehicle Technologies for Airside Operations | Comprehensive ACRP research on airside AV |

## Appendix B: Key Industry Deployments (Reference Cases)

| Airport | Technology | Operator | Status | Key Learning |
|---|---|---|---|---|
| Cincinnati/Northern Kentucky (CVG) | Auto-DollyTug (Aurrigo) | CVG + airlines | Operational testing | 2,163 km over 3 weeks; 81.3% zero-disengagement mission rate; 13.2 km per disengagement |
| Singapore Changi | Auto-DollyTug (Aurrigo) | Changi Airport Group | Phase 2 trials (at aircraft stand) | Rain-sensing algorithm validated to 50 mm/h; multi-phase testing approach |
| Teesside International | Auto-DollyTug + passenger shuttle | Aurrigo | Testing from Jan 2026, airside from 2027 | World's first combined cargo + passenger autonomous airport vehicles |
| Amsterdam Schiphol | Autonomous baggage tug | Multiple trials | Advanced trials | Large hub complexity; mixed traffic management |
| Dubai (DXB) | TractEasy autonomous tug | dnata + EasyMile | Level 3 operational, Level 4 from 2026 | Created new UAE regulatory framework for airport AV; GCAA collaboration |
| East Midlands (UK) | Auto-DollyTug (Aurrigo) | Aurrigo | Ground handling license issued | Proving ground strategy before multi-site expansion |
| Phoenix Sky Harbor | Waymo robotaxi (landside) | Waymo + PHX | Operational | Landside rideshare to terminal; different use case but demonstrates airport AV acceptance |

## Appendix C: Glossary

| Term | Definition |
|---|---|
| A-CDM | Airport Collaborative Decision Making |
| ADS-B | Automatic Dependent Surveillance-Broadcast |
| AGVS | Autonomous Ground Vehicle Systems |
| AHM | Airport Handling Manual (IATA) |
| ASIL | Automotive Safety Integrity Level |
| ATC | Air Traffic Control |
| AWOS | Automated Weather Observing System |
| CIL | Clean, Inspect, Lubricate |
| CONOPS | Concept of Operations |
| C-V2X | Cellular Vehicle-to-Everything |
| DSRC | Dedicated Short-Range Communications |
| E-Stop | Emergency Stop |
| FAT | Factory Acceptance Test |
| FIDS | Flight Information Display System |
| FOD | Foreign Object Debris |
| GNSS | Global Navigation Satellite System |
| GSE | Ground Support Equipment |
| HAZID | Hazard Identification |
| HD Map | High-Definition Map |
| ILS | Instrument Landing System |
| IMU | Inertial Measurement Unit |
| INS | Inertial Navigation System |
| LiDAR | Light Detection and Ranging |
| METAR | Meteorological Terminal Air Report |
| MTBF | Mean Time Between Failures |
| MTTR | Mean Time to Repair |
| NOTAM | Notice to Air Missions |
| ODD | Operational Design Domain |
| ORR | Operational Readiness Review |
| OTA | Over-the-Air (software update) |
| ROC | Remote Operations Center |
| RTK | Real-Time Kinematic (GNSS corrections) |
| SAE | Society of Automotive Engineers |
| SAT | Site Acceptance Test |
| SLAM | Simultaneous Localization and Mapping |
| SMS | Safety Management System |
| SOTIF | Safety of the Intended Functionality |
| SRA | Safety Risk Assessment |
| V2X | Vehicle-to-Everything |
| VMAT | Vehicle Movement Area Transmitter |
| vSOC | Vehicle Security Operations Center |

---

*This playbook is based on research conducted in March 2026, incorporating guidance from the FAA, ICAO, IATA, and lessons learned from deployments at CVG, Singapore Changi, Teesside, Dubai, Schiphol, and East Midlands airports. Regulatory frameworks for airport autonomous vehicles are evolving rapidly. Always verify current requirements with your aviation authority before proceeding.*
