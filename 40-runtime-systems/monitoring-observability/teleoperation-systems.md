# Teleoperation Systems for Autonomous Vehicles

The fallback mechanism that makes production-grade autonomous vehicle deployment viable. When autonomy reaches its limits, teleoperation bridges the gap between full self-driving capability and real-world operational demands.

---

## Table of Contents

1. [Fernride](#1-fernride)
2. [Ottopia](#2-ottopia)
3. [Waymo Remote Assistance](#3-waymo-remote-assistance)
4. [Cruise Remote Assistance](#4-cruise-remote-assistance)
5. [Zoox Teleoperation](#5-zoox-teleoperation)
6. [DriveU.auto](#6-driveuauto)
7. [Phantom Auto](#7-phantom-auto)
8. [Technical Requirements](#8-technical-requirements)
9. [Network Architecture](#9-network-architecture)
10. [Operator Interface Design](#10-operator-interface-design)
11. [Staffing Model](#11-staffing-model)
12. [Regulatory Requirements](#12-regulatory-requirements)
13. [Airside-Specific Teleoperation](#13-airside-specific-teleoperation)

---

## 1. Fernride

**Company:** German-based autonomy company focused on yard logistics, container terminals, and defense. Partners include DB Schenker, Volkswagen, HHLA, Terberg, NVIDIA, and Krone.

### Platform Architecture

Fernride's approach is **gradual autonomy** — start with teleoperation, progressively increase autonomous capability. The platform comprises three core subsystems:

**Vehicle Kit (FERNRIDE Vehicle Kit)**
- Drive-by-wire integration with redundant power supplies and emergency stop systems
- Retrofit or factory-fit installation options
- Sensor suite: LiDARs, radars, cameras with heated and self-cleaning lenses
- Operating range: -30C to +60C in rain, fog, snow, darkness
- Redundant compute: Linux-based high-performance processing paired with QNX-based safety-critical ECU
- Dual routers with VPN/LTE failover, TLS 1.3 encryption
- Optional Starlink connectivity integration

**Operations Control Station (Teleoperation Workstation)**
- Ergonomic controls: steering wheel, pedals, CE-certified safety button
- Multi-vehicle monitoring and control interface
- Low-latency secure connection with seamless handover protocols
- Real-time camera and sensor data displayed on monitors
- Exception handling workflow for edge cases

**FERNRIDE Driver (Autonomy Stack)**
- Multi-sensor fusion localization: vSLAM + GPS + LiDAR for centimeter-level accuracy
- Real-time object detection, classification, and trajectory prediction
- Dynamic route optimization with collision avoidance
- Independent safety layer validating all autonomy commands
- Continuous learning from operational data

### Latency and Connectivity

- End-to-end latency: under 100ms on 4G/LTE
- Connectivity: dual redundant modems with LTE/5G and WiFi support
- Thorough site assessments before deployment to ensure bandwidth and latency standards
- Constant monitoring of bandwidth and latency during operations

### Deployments and Applications

- **HHLA TK Estonia (Tallinn):** Three autonomous tractors running driverless container operations. TUV SUD certified. Structured rollout to full driverless operations.
- **DB Schenker (Nuremberg):** Teleoperators remotely controlling electric E-Wiesel trucks for yard operations.
- **Terberg Partnership:** Fernride hardware kit integrated into Terberg YT Series drive-by-wire terminal tractors. First 100 trucks for container terminals, production plants, and distribution centers. Series production began 2024.

### Airport Relevance

Fernride's application domains include container terminals, yard operations, defense logistics, and open-road trucking. The container terminal and yard operations use cases map directly to airport cargo handling and baggage transport. Their gradual autonomy approach (teleoperation first, then increasing autonomy) is well-suited for the phased introduction of autonomous GSE on airside environments.

### Certification

TUV SUD certification under the EU Machinery Directive. 99.9% reported operational reliability.

---

## 2. Ottopia

**Company:** Tel Aviv-based teleoperation platform provider, founded 2018 by CEO Amit Rosenzweig. Total funding: $26.5M across four rounds (latest: $14.5M Series A in January 2023). Ottopia has **not** been acquired — it remains an independent private company. The user's question about a Waymo acquisition is unconfirmed; no evidence of such an acquisition exists in public records.

### Platform Architecture

Ottopia provides a five-component technology stack:

**1. Hardware Solutions**
- Vehicle-mounted compute platforms
- 8x GMSL2 camera inputs with M12 connectors
- 16TB onboard storage
- IP67 and MIL-STD-810H rated (military-grade environmental testing)

**2. Network Optimization**
- AI-Based Real-Time Network Prediction — proprietary algorithm that predicts network conditions and adapts dynamically
- Cross-channel forward error correction
- Smart bonding of satellite, RF, cellular, and WiFi communications
- Requires only two modems where competitors need three or four

**3. Adaptive Streaming**
- AI-based super-resolution technology for video enhancement
- Reduces bandwidth by 20% compared to next-best commercial solution
- Augmented reality overlays displaying speed, heading, and latency

**4. Safety and Security**
- Military-grade DTLS encryption
- Multi-phase authentication
- Role-based access control
- 18+ patents protecting the technology

**5. Applications Layer (OttopiaOS)**
- Seamless transitions between manual driving, autonomous operation, and remote driving modes
- Purpose-built interfaces for commercial and defense sectors

### Remote Assistance vs. Remote Driving Distinction

Ottopia explicitly supports both paradigms:

**Tele-Assistance (Indirect Control)**
- Operator chooses a path for the vehicle to take
- Operator draws a new path on a map/screen
- Operator overrides a policy decision
- Vehicle retains dynamic driving task responsibility
- Used primarily for robotaxis and public-road shuttles

**Remote Driving (Direct Control)**
- Operator directly controls steering, acceleration, and braking
- Full dynamic driving task performed remotely
- Used for yard logistics, low-speed environments, and off-road scenarios

### ATAS (Advanced Teleoperator Assistance Systems)

Ottopia's proprietary safety layer, analogous to ADAS but for remote operators:

- **Collision Warning:** Real-time alerts when operator actions risk collision
- **Collision Avoidance:** Proactive automated braking that overrides operator commands
- **Dynamic Trajectory Computation:** Computes safe trajectories factoring in latency parameters
- **Bespoke Braking Algorithm:** Accounts for network latency when determining braking distance

### Partnerships

BMW, Denso, Hyundai, Magna International, Deutsche Telekom, Bestmile, EasyMile, Innoviz, Gaussin, Via, May Mobility, Motional, Serve Robotics, NVIDIA.

---

## 3. Waymo Remote Assistance

Waymo operates the most transparent and best-documented remote assistance system in the autonomous vehicle industry.

### Core Philosophy: "Advice, Not Control"

The Waymo Driver (their automated driving system) is **always** in control of the vehicle. Remote Assistance agents provide advisory information that the system can accept or reject. This is fundamentally different from remote driving.

### How It Works

1. The Waymo Driver encounters a situation it wants additional context for (e.g., unusual construction, unclear lane markings, confusing traffic patterns, blocked routes)
2. The vehicle stops and initiates a request to a Fleet Response Agent
3. The agent reviews the situation using camera feeds and sensor data
4. The agent provides high-level guidance — **not** direct vehicle control commands
5. The Waymo Driver decides whether to use or reject the guidance

### What Operators Can Do

- Indicate lane closures and road condition changes
- Explicitly suggest a particular lane for the vehicle to use
- In complex scenarios, propose a specific path for the vehicle to consider
- Coordinate with emergency responders (Event Response Team only)
- Manage post-collision protocols (Event Response Team only)

### What Operators Cannot Do

- Steer the vehicle
- Control acceleration or braking
- Override the Waymo Driver's safety decisions
- Continuously monitor vehicles (they respond only to requests)

### Staffing and Distribution

- **Total agents on duty worldwide:** ~70 at any given time
- **Fleet size:** ~3,000 vehicles
- **Ratio:** Approximately 1 agent per 41 vehicles
- **Geographic distribution:** Four geographically redundant centers
  - Arizona (US)
  - Michigan (US)
  - Two cities in the Philippines
  - Approximately half US-based, half Philippines-based
- **Event Response Team (ERT):** Exclusively US-based, handles complex scenarios (emergency coordination, post-collision management)

### Latency

- US operations centers: ~150ms median one-way latency
- Philippines operations centers: ~250ms median one-way latency

### Operator Requirements

All Fleet Response Agents must:
- Hold a valid passenger car or van license
- Pass comprehensive driving history review (reviewed for traffic violations, infractions, and driving-related convictions)
- Pass criminal background checks
- Submit to random drug testing (initial and ongoing)
- Pass color blindness assessments
- Pass spatial recognition assessments

### Scale of Operations

- Over 400,000 weekly rides
- More than 4 million miles driven
- The vast majority of situations are resolved by the Waymo Driver autonomously without any human assistance

### Known Incident

In January 2024, a remote operator provided incorrect guidance that resulted in a Waymo robotaxi proceeding through a red light, causing a moped driver to take defensive action. This incident demonstrates that even "advisory" remote assistance carries real safety consequences.

---

## 4. Cruise Remote Assistance

Cruise (GM's autonomous vehicle subsidiary) serves as the industry's most significant cautionary tale about teleoperation overreliance.

### System Architecture

- Remote assistance sessions triggered roughly every **4 to 5 miles** of driverless operation
- Response time: >98% of sessions answered within 3 seconds
- Vehicles only actively receiving remote assistance 2-4% of total road time
- Remote operators relied on camera feeds as primary source of truth
- Error messaging system designed by engineers but difficult for operators to interpret

### Staffing Ratio

- Before operations were suspended: approximately 1 remote assistant agent per 15-20 driverless vehicles
- Media reports cited 1.5 total support workers per vehicle when including all support functions (not just remote assistance)
- Cruise acknowledged being "intentionally overstaffed" for their small fleet size, expecting to handle bursts with a smaller ratio at larger scale

### The Pedestrian Dragging Incident (October 2, 2023)

This event fundamentally altered the industry's approach to remote assistance:

**What Happened:**
1. A woman was struck by a human-driven vehicle in an adjacent lane
2. She was thrown into the path of a Cruise robotaxi
3. The Cruise AV struck her in what it misdiagnosed as a side collision (it was actually a frontal impact)
4. Instead of stopping in place, the robotaxi executed a pull-over maneuver, dragging the pedestrian approximately 20 feet at 7.7 mph
5. The vehicle had a location error and failed to identify it was already in the curb lane
6. The woman's feet and legs were visible in the left-side camera throughout, but the system failed to classify or track her

**Remote Assistance Failures:**
- The vehicle sent a crash alert to the remote operations center
- The vehicle **did not wait** for a remote operator response before initiating the pull-over maneuver
- The autonomous system was not configured to require remote confirmation before moving after a pedestrian collision
- The error messaging system provided information that made sense to engineers but was difficult for remote operators to interpret rapidly

**Regulatory Consequences:**
- California DMV immediately suspended Cruise's robotaxi permit
- CPUC pulled Cruise's commercial permit
- Cruise was accused of withholding key details from regulators
- Cruise recalled its entire fleet
- Cruise ultimately suspended all driverless operations

### Lessons Learned

1. **The vehicle must know what it doesn't know.** The AV failed to recognize the severity of the situation and acted on an incorrect assessment before waiting for human verification.

2. **Post-collision behavior must be conservative.** The system should have stopped in place and waited for remote operator confirmation before any movement.

3. **Camera visibility does not equal detection.** The pedestrian was visible in camera feeds but the perception system failed to classify and track her.

4. **Remote assistance frequency is a signal, not a feature.** Needing human help every 4-5 miles indicates fundamental autonomy limitations, not a well-functioning human-machine system.

5. **The "advice only" framing masks real safety responsibility.** When remote operators' inputs influence driving decisions, they bear safety responsibility regardless of how the role is marketed.

6. **Transparency with regulators is non-negotiable.** Cruise's attempt to downplay the dragging portion of the incident destroyed trust and led to far more severe regulatory action.

7. **In-vehicle safety drivers may still be needed.** More conservative operational approaches — including retaining safety drivers for still-developing technology — could have prevented the dragging entirely.

---

## 5. Zoox Teleoperation

Zoox (acquired by Amazon in 2020) operates a purpose-built robotaxi with a distinctive approach to remote intervention.

### TeleGuidance System

Zoox calls their remote assistance system **TeleGuidance**. It is explicitly not remote driving.

**How It Works:**
- When a Zoox vehicle encounters a scenario it cannot confidently handle (e.g., unmarked construction zone, unusual obstacle), it sends an alert to the command center
- A TeleGuidance tactician receives the alert as a short message in a colored window on their computer screen
- The tactician assesses the situation using camera feeds and sensor data
- Rather than controlling the vehicle, the tactician provides **waypoints** (described internally as "breadcrumbs") for the vehicle to follow
- The tactician can draw a new path on screen using their mouse
- The vehicle executes the path autonomously, maintaining full safety responsibility
- The entire process happens "within seconds" — riders typically don't notice

**Key Capabilities:**
- Path drawing: operator draws alternative routes around obstacles
- Object reclassification: operator can reclassify objects (e.g., marking a parked work truck as "stationary" when the AV thinks it's an active vehicle)
- Waypoint navigation: providing a "set of breadcrumbs" to guide the vehicle through unfamiliar situations

### Three Operational Teams

**1. Mission Operations**
- Fleet oversight team monitoring vehicle health
- Tracks tire pressure, battery levels, cabin temperature, coolant temperatures
- Handles logistics: rerouting around street closures, reallocating fleet during weather events

**2. TeleGuidance**
- Provides "human assurance" rather than remote control
- Tacticians assess complex situations and suggest navigation paths
- All guidance occurs rapidly — "riders wouldn't even know this is happening"

**3. Rider Support**
- Customer service for in-ride experience
- Pre-ride and post-ride checks (seatbelts buckled, no belongings left behind)
- Responds to in-app messages and emergency button activations

### Key Distinction

Zoox explicitly states: "We are not in full control of the vehicle. We are providing guidance." The vehicle retains full responsibility for passenger safety and continues to drive autonomously at all times while acting on TeleGuidance information.

---

## 6. DriveU.auto

**Company:** Israel-based startup providing a software connectivity platform for teleoperation of autonomous vehicles and robots. Technology derived from LiveU, a world leader in high-performance video transmission.

### Core Technology

**Cellular Bonding**
- Aggregates multiple cellular network connections (LTE, 5G, WiFi)
- Handles unreliable networks with choppy uplink throughput, delay, jitter, packet loss, and coverage gaps
- Dynamic adaptation to real-time network conditions

**Dynamic Video Encoding**
- Tightly coupled H.265 (HEVC) video encoding and transmission
- Minimizes system latency while maintaining video quality
- Also supports AV1 encoding on NVIDIA Jetson Orin platform (industry first)
- Encoding bitrate: 4-10 Mbps for high-quality video with H.265

### Product Lines

**DriveU 100 Series**
- Target: Low-speed delivery robots, lawnmowers, logistics robots
- Glass-to-glass latency: 250ms
- HD video transmission
- Lower compute footprint

**DriveU 300 Series**
- Target: Autonomous trucks, shuttles, robotaxis, heavy machinery
- Supports continuous 4K video streams
- Multiple simultaneous camera feeds
- Transmits video, audio, sensor data, CAN Bus data, and control commands
- Open APIs for integration
- Software-only option available (installs on existing vehicle ECUs/computers)
- Hardware-agnostic: reuses existing cameras, processors, modems, and sensors

### Teleoperation Taxonomy

DriveU.auto published an industry teleoperation taxonomy with six levels:

| Level | Mode | Description |
|-------|------|-------------|
| T0 | Full Remote Driving | Operator performs entire DDT, no vehicle automation |
| T1 | Remote Driving with Automation Assist | Operator drives, vehicle provides some automated functions |
| T2 | Shared Remote Driving | Automation handles some DDT elements, operator handles others |
| T3 | Tele-Assist with Commands | AV operates autonomously, operator provides high-level commands when requested |
| T4 | Tele-Assist with Approval | AV operates autonomously, operator approves/rejects AV-proposed actions |
| T5 | Full Autonomy | No human involvement |

**Safety Responsibility:** In all levels except T0, safety responsibility rests with the autonomous driver. This requires minimum autonomy capable of maintaining safe distance, performing emergency maneuvers, and emergency braking.

### Deployment

Platform deployed on roads in the EU, US, China, Japan, and Israel. Customers include autonomous vehicle developers (cars, trucks, shuttles), delivery robot manufacturers, OEMs, and Tier 1 suppliers.

---

## 7. Phantom Auto

**Company:** Founded 2017 in Palo Alto, California. Originally focused on autonomous vehicle safety nets, pivoted to logistics vehicle teleoperation. Total funding includes a $42M round with purchase orders for thousands of Phantom-powered forklifts.

### Platform Architecture

**Software-Based Remote Operation**
- Patented network aggregation: seamlessly combines LTE, WiFi, 5G, and other available networks
- Dynamic adaptation to network fluctuations in real-time
- End-to-end encryption
- SOC-2 and ISO-27001 certified
- Real-time video and audio streaming from vehicle to operator

**Control Center Platform**
- Interoperable across multiple vehicle types and sites
- Operators can "teleport" between different vehicles at different locations with one click
- Multi-fleet management from a single interface
- Web-based interface accessible from standard office computers

### Vehicle Types Supported

- **Forklifts:** Partnership with Mitsubishi Logisnext Americas (UniCarriers and Mitsubishi brands) and Fenwick-Linde
- **Tuggers:** Warehouse material handling
- **Yard Trucks:** Outdoor logistics operations
- **Warehouse Robots:** Automated material handling
- **Delivery Robots:** Sidewalk and curbside delivery
- **Autonomous Vehicles:** Originally the core market, now secondary focus

### Key Deployments

- **GEODIS + Fenwick-Linde:** First remotely operated forklift, tested in France (Levallois and Le Mans)
- **ArcBest:** Purchase orders for Phantom-powered forklifts
- **NFI Industries:** Purchase orders for thousands of units
- **Kenco Logistics:** Deployed remotely operated forklifts

### Operational Model

- One remote operator can control multiple forklifts across multiple warehouses at different times of day
- Workers moved from hazardous warehouse floors to office environments
- Workers' compensation premiums reduced by up to 85%
- Remote employees no longer need to be within commuting distance — an operator in Ohio can control a vehicle in California
- Unlocks previously inaccessible labor pools

### Airport Relevance

Phantom Auto's multi-vehicle-type support (forklifts, tuggers, yard trucks) maps directly to common GSE types found on airport ramps. Their ability to teleport operators between sites and vehicle types could enable centralized remote operation of airport GSE fleets across multiple airports.

---

## 8. Technical Requirements

### Latency Thresholds

Latency is the single most critical technical parameter for teleoperation. Research establishes the following thresholds:

| Latency Range | Impact on Teleoperation |
|---------------|------------------------|
| < 100ms | Optimal. Near-transparent to operator. |
| < 170ms | Minor impact. Easily manageable by trained operators. |
| 170-300ms | Acceptable with adaptation. Operators can generally adjust to this range. |
| 300-500ms | Challenging. Significant operator difficulty, especially at low speeds. |
| > 700ms | Nearly impossible for effective direct teleoperation. |

**Glass-to-glass latency** (the time from real-world event capture by vehicle camera to display on operator's monitor) should be **100ms or less** for proper remote driving. For remote assistance (advisory), higher latencies are acceptable since the operator is not performing the dynamic driving task.

### End-to-End Latency Breakdown

| Component | Typical Range |
|-----------|---------------|
| Camera capture | 17-33ms |
| Data encoding | 17-50ms |
| Transmission uplink (vehicle to cloud) | 25-50ms |
| Video decoding | 17-32ms |
| Display refresh | ~44ms |
| Control command transmission (cloud to vehicle) | ~32ms |
| Actuator response | ~50ms |
| **Total round-trip** | **~200-290ms** |

### Bandwidth Requirements

**Uplink (Vehicle to Operator) — the bottleneck:**
- Camera data alone: ~8 Mbps
- Typical requirement across studies: 3-32 Mbps
- High-end with multiple sensors: up to 50 Mbps
- LiDAR data without compression: nearly impossible over current networks

**Downlink (Operator to Vehicle):**
- Control commands require minimal bandwidth: 0.25-5 Mbps
- Typical: 0.3-1 Mbps

The asymmetry exists because sensor data (cameras, LiDAR, radar) consumes far more bandwidth than control commands.

### Video Quality Specifications

| Parameter | Minimum | Recommended |
|-----------|---------|-------------|
| Resolution | 640x480 (VGA) | 1280x720 (HD) to 3840x2160 (4K) |
| Frame rate | 25 fps | 30 fps |
| Field of view | 150 degrees | 360-degree coverage via multiple cameras |
| Encoding | H.264 | H.265 (HEVC) or AV1 |
| Encoding bitrate | 4 Mbps | 4-10 Mbps per stream |

### Control Responsiveness

- Control command round-trip: ideally < 100ms
- Maximum acceptable control latency for remote driving: 250-300ms
- For remote assistance (advisory only): latency is less critical since the AV handles real-time control
- Actuator response time: ~50ms from command receipt to physical actuation

### Operational Speed Limits

- Most teleoperation research focuses on speeds < 50 km/h
- For airside GSE operations: typical speeds 10-25 km/h, well within safe teleoperation range
- Maximum viable teleoperated speed (theoretical): 100-250 km/h, but performance degrades significantly above 50 km/h

### Distance Capabilities

Teleoperation has been demonstrated over:
- 5,200 km (documented test)
- 19,000 km (extended test)
- Waymo operates from Philippines to US (~13,000 km) with 250ms one-way latency

Distance is not the primary constraint — network quality and latency are.

---

## 9. Network Architecture

### Network Technology Comparison

| Parameter | 4G/LTE | 5G (Sub-6 GHz) | 5G (mmWave) | Private 5G |
|-----------|--------|-----------------|-------------|------------|
| Latency | ~100ms average | 11-13ms typical | < 5ms | < 10ms |
| User data rate | 3-8 Mbps | 4-8 Mbps typical | Up to 10 Gbps | Dedicated bandwidth |
| Coverage | 5-50 km | Several km | < 1 km | Site-specific |
| Reliability | Moderate | High | Very high (limited range) | Very high |
| Suitability | Basic remote assistance | Remote driving viable | Ideal but range-limited | Best for fixed-site operations |

**4G/LTE:** "Just able to support the necessary infrastructure for basic remote driving capabilities." Adequate for remote assistance (advisory) but latency presents challenges for real-time control responsiveness.

**5G:** "Significantly enhances remote driving capabilities with ultra-low latency (on the order of 10ms), high data rates (up to 10 Gbps), and significantly improved reliability."

**Key limitation:** Streaming multiple camera feeds and LiDAR data simultaneously strains even 5G Standalone architecture. Without aggressive compression, streaming LiDAR over current 5G networks is "nearly impossible."

### Redundancy and Failover

**Network-Level Redundancy:**
- Cellular bonding: aggregate multiple network connections (used by Fernride, DriveU.auto, Phantom Auto, Ottopia)
- Dual SIM / dual modem configurations (industry standard)
- Fernride uses dual routers with VPN/LTE failover plus optional Starlink
- Ottopia achieves effective operation with 2 modems using AI-based network prediction (competitors require 3-4)

**Infrastructure-Level Redundancy:**
- Multi-access Edge Computing (MEC) architecture with failover between edge servers
- Network slicing: virtualized independent logical networks on the same physical infrastructure
- 5G NR sidelink as failover when primary 5G connection drops
- Geographically redundant operations centers (Waymo operates from 4 locations across 2 countries)

**Vehicle-Level Failover:**
- If connectivity is lost entirely, the vehicle must execute a **Minimum Risk Condition (MRC)**
- BSI Flex 1886 recommends ADS maintain autonomous capability to perform a minimal risk maneuver when connectivity is compromised
- The vehicle must be able to perform a controlled stop-in-path at all points of operation
- MRC = bringing the vehicle to a safe stop, maintaining power to decelerate and stop completely

### Airport-Specific Connectivity

**Private 5G Networks** are the optimal solution for airside teleoperation:

- The "sweetspot" for private cellular networks is centered around the airside, where airport operations converge
- Ericsson and Pattern Labs deployed private 5G at Purdue University Airport for autonomous vehicle testing — enabling ultra-high speeds and low latency for accurate driving
- Nokia provides end-to-end private wireless networks designed for commercial airports (deployed at Brussels, Vienna, San Sebastian, Miami, Los Angeles)
- MCA (Nokia partner) delivers industrial-grade private wireless infrastructure tailored for aviation needs
- A single operator can monitor up to 100 vehicles simultaneously on a properly designed private 5G network
- Private 5G provides dedicated bandwidth (no contention with public users), predictable latency, and full coverage of the airside area

### Recommended Network Architecture for Airside Deployment

```
[Vehicle Fleet]
     |
     | Private 5G (primary)
     | WiFi 6 (backup in terminal buildings)
     | LTE (tertiary fallback)
     |
[On-Site MEC Server] ---- [Cloud Backup]
     |
     | Low-latency fiber
     |
[On-Airport Operations Center] ---- [Remote Operations Center (failover)]
```

**Network Quality Requirements for Reliable Teleoperation:**
- Bandwidth: 30-100 MHz (depending on environment and number of vehicles)
- Throughput: > 3 Mbps per vehicle
- Uplink service reliability: 99%
- Downlink service reliability: 99.999%
- Vehicle density capacity: ~10 vehicles per km^2

---

## 10. Operator Interface Design

### The Core Challenge

Teleoperation faces inherently **reduced situational awareness** compared to in-vehicle driving. The operator lacks vestibular feedback (no sense of acceleration/turning), has limited field of view, experiences communication latency, and relies entirely on processed sensor data rather than direct perception.

### What the Remote Operator Sees

**Video Feeds:**
- Multiple camera views covering 360 degrees around the vehicle
- Typically 4-8 simultaneous camera feeds
- Primary forward-facing view plus side and rear cameras
- Bird's-eye / top-down synthesized view from multiple cameras

**Augmented Reality Overlays:**
- Vehicle speed, heading, and GPS position
- Current latency indicator (critical for operator awareness of control delay)
- Planned path / trajectory visualization
- Object detection bounding boxes from the perception system
- Collision warning indicators
- Lane markings and road boundary visualization

**Sensor Data Displays:**
- LiDAR point cloud visualization (when bandwidth permits)
- Radar detection overlays
- Vehicle health metrics (battery, tire pressure, temperature)
- Map view showing vehicle position and planned route

### Controls Available

**Remote Driving (Direct Control):**
- Steering wheel (physical or virtual)
- Acceleration and brake pedals
- Gear selection
- Turn signals and hazard lights
- Horn
- Emergency stop button (CE-certified, hardwired)

**Remote Assistance (Indirect Control):**
- Path drawing on map/screen (Zoox "breadcrumb" model)
- Waypoint placement
- Lane selection commands
- Object reclassification tools
- Policy override buttons
- Route approval/rejection
- Free-text or structured communication with the AV system

### Situational Awareness Enhancement

Research identifies three levels of situational awareness for teleoperation:
1. **Perception:** Operator perceives environmental elements and events
2. **Comprehension:** Operator understands the meaning and relevance of what they perceive
3. **Projection:** Operator anticipates future states and developments

**Design Principles:**
- Situational awareness is "not simply about providing more information — it is about combining that information and visualizing it in a way that helps the user think and act effectively"
- Dynamic GUI adapts displayed elements according to teleoperation phase
- Multimodal feedback (visual, auditory, haptic) supports awareness without excessive cognitive load
- Predictive path overlays and hazard highlighting reduce cognitive processing requirements

### Advanced Interface Features

**Dynamic Task-Based Overlays:**
- Context-sensitive information presentation based on current task
- Reduces information overload during routine operations
- Increases detail during critical interventions

**Physiological Monitoring:**
- Systems that detect early signs of fatigue or attention lapses in operators
- Adaptive workload management adjusting operator-to-vehicle ratios based on real-time complexity metrics
- These systems have reduced operator error rates by 67% and extended effective work sessions by up to 3 hours in studies

**Haptic Feedback:**
- Simulated road feel and vehicle dynamics transmitted through steering wheel
- Force feedback indicating proximity to obstacles
- Vibration alerts for collision warnings

---

## 11. Staffing Model

### Industry Benchmarks

| Company | Ratio (Operators : Vehicles) | Mode | Notes |
|---------|------------------------------|------|-------|
| Waymo | 1:41 | Remote Assistance | 70 agents for 3,000 vehicles. Advisory only. |
| Cruise (pre-suspension) | 1:15-20 | Remote Assistance | Self-reported. Media reported 1.5 total support workers per vehicle. |
| Fernride | ~1:1 (teleop phase) | Remote Driving | During initial teleoperation phase, moving toward higher ratios with increasing autonomy. |
| Airport GSE (projected) | 1:100 | Remote Monitoring | With private 5G, single operator monitoring fleet with intervention-on-demand. |

### Staffing Model Tiers

**Tier 1: Remote Driving (1:1 to 1:3)**
- Operator actively drives one vehicle at a time
- May oversee 2-3 vehicles with task switching during idle periods
- Required when vehicles have limited autonomy
- Highest labor cost per vehicle

**Tier 2: Remote Assistance (1:15 to 1:50)**
- Operator responds to requests from multiple vehicles
- Not continuously monitoring any single vehicle
- Intervenes only when the AV requests help
- Scalable — ratio improves as autonomy improves
- Waymo's current operational model

**Tier 3: Fleet Oversight (1:50 to 1:100+)**
- Operator monitors fleet health and logistics
- Handles exceptions only when escalated
- Manages rerouting, resource allocation, weather responses
- Zoox's Mission Operations model

### Shift Patterns

No standardized industry shift patterns exist, but operational principles include:

- **24/7 coverage required** for commercial deployment (Waymo, Zoox operate around the clock)
- **Geographic redundancy:** Multiple operations centers in different time zones reduces overnight shift requirements (Waymo uses Philippines for timezone coverage)
- **Rotation between active monitoring and standby** to prevent vigilance decrement
- **Maximum continuous active monitoring:** Research suggests 2-3 hour blocks with breaks, based on air traffic control fatigue research analogies
- **Typical shift length:** 8-12 hours with structured breaks

### Training Requirements

**Industry Certification Programs:**
- The **Teleoperation Professional (TP) Credentialing Program** (Teleoperation Consortium + The Next Education) provides vendor-neutral certification covering vehicle communications, intelligent transportation best practices, in-vehicle safety, infrastructure, communication protocols, and security
- **Pima Community College** offers a one-semester Autonomous Vehicle Driver & Operations Specialist certificate (requires existing Class A CDL)
- **UL 4600 Certified Autonomy Safety Professional** training for safety-critical systems

**Company-Specific Training:**
- Waymo requires valid driver's license, driving history review, criminal background check, drug testing, color blindness testing, and spatial recognition assessment
- Designated Driver offers teleoperation-as-a-service including trained and certified remote operators
- Most companies develop proprietary training programs for their specific systems

**No Universal Standard Exists Yet.** The industry lacks a unified certification framework for teleoperation operators, creating variability in qualification standards across companies.

### Human Factors Considerations

- **Vigilance decrement:** Extended low-activity monitoring degrades operator attention
- **Mode confusion:** Operators may lose track of which mode (monitoring vs. active control) they are in
- **Complacency:** Over-trust in automation can reduce operator engagement
- **Startle response:** Sudden transitions from monitoring to active intervention can cause errors
- **Skill degradation:** Operators who rarely intervene may lose proficiency in active control

---

## 12. Regulatory Requirements

### United States

**NHTSA (Federal Level):**
- January 2025: NHTSA proposed the ADS-equipped Vehicle Safety, Transparency, and Evaluation Program (AV STEP)
- Establishes a framework for reviewing and overseeing vehicles equipped with automated driving systems
- Federal Motor Vehicle Safety Standards (FMVSS) set baseline vehicle performance requirements
- No specific federal teleoperation regulations exist yet — it falls under general ADS oversight
- April 2025: NHTSA announced additional policies promoting autonomous vehicles

**FAA (Airport-Specific):**
- FAA CertAlert 24-02 (February 2024): Guidance on AGVS technology at airports
- Emerging Entrants Bulletin 25-02 (May 2025): Testing and demonstrations at federally obligated airports
- FAA supports AGVS testing in "controlled environments" — non-movement areas (aprons, gate areas, parking areas)
- Movement areas, safety areas, and object-free areas are **not** currently considered controlled environments for AGVS
- Part 139 airports must coordinate with FAA Airport Certification and Safety Inspector
- All autonomous/teleoperated vehicles require explicit ATC clearances to enter or cross runways

**State Level (California as benchmark):**
- CPUC licensing required for passenger-carrying autonomous vehicles
- DMV autonomous vehicle testing permits required
- Significant variation between states in liability, insurance, and operational requirements

### European Union

- **EU Machinery Directive:** Fernride's system certified by TUV SUD under this framework
- **EASA:** Advocates ICAO-level framework development for autonomous airside vehicles
- No specific EU-wide teleoperation regulation yet, but individual member states developing frameworks

### International Standards

**UNECE / WP.29:**
- GRVA (Working Party on Automated/Autonomous and Connected Vehicles) adopted draft Global Technical Regulation on ADS in January 2026
- Submitted to WP.29 for adoption at June 2026 session
- Key principle: "ADS must be free from unreasonable safety risk and perform at least at the level of a competent and careful human driver"
- Requires lifecycle-based safety management covering development, production, deployment, and post-deployment monitoring
- Does not yet contain specific teleoperation provisions

**BSI (British Standards Institution):**
- PAS 1883: Operational Design Domain taxonomy for ADS (became basis for ISO 34503)
- BSI Flex 1886: Recommends ADS maintain autonomous capabilities for minimal risk maneuver when connectivity is compromised
- CAV standards programme includes teleoperation projects

**SAE J3016:**
- Defines Levels of Driving Automation
- Level 4 and 5 vehicles must reach Minimum Risk Condition before ADS disengagement
- AVSC (Autonomous Vehicle Standards Committee) distinguishes between Remote Assistance and Remote Driving

**ISO 34503:**
- Based on BSI PAS 1883
- International standard for ODD taxonomy
- Developed with US, Germany, Japan, China, France, and 8 other countries

### Liability Questions

1. **Who is liable when a teleoperated vehicle causes harm?** The shift from "driver" to "operator" to "passenger" fundamentally alters centuries of legal precedent. No clear consensus exists.

2. **Does remote assistance constitute "driving"?** The industry exploits the SAE distinction between assistance and driving to argue that advisors without steering wheels aren't "really driving." Critics (notably Prof. Phil Koopman at CMU) argue this enables accountability evasion.

3. **Jurisdictional complexity:** When a Philippines-based operator provides guidance to a US-based vehicle, which jurisdiction's laws apply? What if the guidance causes an incident?

4. **Recommended accountability measures (Koopman):**
   - Valid commercial driver's license for all remote operators
   - Defined training procedures with periodic skill evaluations
   - Geographic jurisdiction requirements for operator accountability
   - Auditable logs documenting each remote interaction
   - Manufacturer designated as primary responsible party
   - Computer drivers treated as "drivers" with matching accountability

### Cybersecurity Requirements

- Communication between vehicle and teleoperation center must use strong encryption and authentication
- Public-key infrastructure for mutual authentication between vehicle and operator station
- Encryption for data at rest and in transit
- Multi-layered defense: preventive, detective, and responsive security tools
- Security measures must not introduce latency that compromises real-time responsiveness
- Phantom Auto achieves SOC-2 and ISO-27001 certification
- Ottopia uses military-grade DTLS encryption with multi-phase authentication
- Fernride uses TLS 1.3 encryption with VPN tunneling

---

## 13. Airside-Specific Teleoperation

### Unique Requirements for Airport Operations

Airport airside environments present fundamentally different challenges from public roads:

**1. Aircraft Proximity**
- GSE operates within meters of aircraft worth $50M-$400M+
- Damage tolerance is zero — even minor contact with aircraft skin can ground a plane for inspection
- Jet blast zones create dynamic hazard areas
- Wingtip clearance requirements are measured in centimeters during pushback

**2. Apron Awareness**
- No lane markings in most apron areas — vehicles navigate by spatial awareness and airport markings
- Dynamic obstacles: other GSE, passengers (including on-foot tarmac boarding), fuel trucks, catering vehicles
- Painted stand markings and equipment positioning lines are the primary navigation references
- Vehicles must avoid jet bridges, fuel hydrants, ground power units, and pre-conditioned air hoses

**3. ATC Coordination**
- Explicit ATC clearance required to enter or cross any runway, regardless of runway status
- Real-time vehicle tracking in the movement area required
- Communication protocols must be compatible with airport radio systems
- Autonomous/teleoperated vehicles must be identifiable and locatable by ATC at all times

**4. Foreign Object Debris (FOD)**
- Autonomous vehicles must detect FOD on the ramp
- FOD ingestion by aircraft engines causes catastrophic damage
- Vehicles themselves must not generate FOD

**5. Weather and Visibility**
- Operations continue in conditions that would halt public-road AV operation
- Rain, snow, fog, darkness, standing water, ice, crosswinds
- Aurrigo developed specialized rain-sensing algorithms for operations in 50mm/hr rainfall

**6. Security Zone Restrictions**
- Airside is a restricted security zone
- All personnel and equipment require authorization
- Remote operators must be security-cleared even though they're not physically on site
- Data transmission must meet aviation security standards

### Current Airside Deployments

| Deployment | Airport | Vehicle Type | Status |
|-----------|---------|-------------|--------|
| SATS / TractEasy | Singapore Changi | EZTow baggage tractor | Level 3 operational, Level 4 planned 2026 |
| Aurrigo Auto-DollyTug | Stuttgart, Frankfurt, Inverness | Baggage tractor | Trials in progress |
| Fraport / Aurrigo | Frankfurt | Cargo and baggage tractors | Initial tests completed |
| Hactl | Hong Kong | Cargo tractors | Developing fully autonomous ramp operations |
| dnata | Multiple | Various GSE | Rolling out autonomous vehicles |
| Pattern Labs / Ericsson | Purdue University Airport | Autonomous baggage vehicles | Private 5G testbed |

### Autonomous GSE Types for Airside

- **Auto-DollyTug:** Fully electric baggage tractor with automatic load/unload (Aurrigo)
- **Auto-Dolly:** Baggage transport dolly (Aurrigo)
- **Auto-Shuttle:** Passenger and crew bus (Aurrigo)
- **Auto-Cargo:** Pallet and ULD transport vehicle (Aurrigo)
- **EZTow / TractEasy:** Autonomous baggage towing system (SATS)
- **Terberg AutoTUG:** Terminal tractor with Fernride teleoperation kit

### Implementing Teleoperation for an Airside GSE Fleet

#### Phase 1: Teleoperation-First Deployment

**Network Infrastructure:**
- Deploy private 5G network covering entire airside area (partner: Ericsson or Nokia)
- WiFi 6 backup in terminal and hangar areas
- LTE as tertiary fallback
- On-site MEC server for ultra-low latency processing
- Redundant fiber backhaul to operations center

**Operations Center:**
- Located on-airport (ideally with view of apron for verification)
- Equipped with multi-monitor workstations showing camera feeds, map view, fleet status
- Direct communication link to ATC (radio or digital)
- Direct communication link to ramp control / ground handling coordinator
- Backup remote operations center at a separate location

**Vehicle Fleet:**
- Start with baggage tractors (lowest complexity, most repetitive routes)
- Equip with Fernride-style vehicle kit: cameras, LiDAR, radar, drive-by-wire, dual connectivity
- Implement geo-fencing to prevent vehicles from entering movement areas
- Aircraft proximity sensors with hard-stop safety limits

**Operator Model:**
- Initial phase: 1 operator per 1-3 vehicles (direct teleoperation)
- Operators must hold airside driving permits and security clearances
- Training on aircraft types, stand layouts, FOD awareness, emergency procedures
- ATC communication training equivalent to existing airside driver training

#### Phase 2: Increasing Autonomy

**Autonomous Capability Expansion:**
- Vehicles learn routes and standard procedures from teleoperation data
- Transition from direct control to remote assistance (approval-based)
- Operator ratio improves to 1:10-15
- Vehicles handle routine transits autonomously, request help for exceptions

**Safety Systems:**
- Independent safety layer (like Ottopia ATAS) preventing collisions with aircraft
- Automatic stop if proximity sensor detects aircraft within defined clearance
- Mandatory remote operator confirmation before any movement within 5m of aircraft
- FOD detection and reporting integrated into perception stack

#### Phase 3: Scaled Autonomous Operations

**Fleet-Level Autonomy:**
- 1 operator overseeing 20-50+ vehicles
- Intervention only for genuine edge cases
- Autonomous coordination between vehicles (traffic management)
- Integration with airport CDM (Collaborative Decision Making) systems
- Automatic scheduling based on flight plans and gate assignments

**ATC Integration:**
- Digital communication between autonomous fleet management and ATC
- Automatic clearance requests for runway crossings
- Real-time vehicle position reporting to airport surface detection equipment (A-SMGCS)

### Airside Teleoperation Technical Specifications

| Parameter | Requirement | Rationale |
|-----------|-------------|-----------|
| Glass-to-glass latency | < 100ms | Aircraft proximity demands immediate response |
| Network availability | 99.99% | Cannot afford connectivity gaps near aircraft |
| Position accuracy | < 10cm | Centimeter-level precision for stand operations |
| Emergency stop response | < 200ms total | Including network round-trip and actuator response |
| Video resolution | Minimum HD, preferably 4K | Must identify small FOD items and ground markings |
| Camera coverage | 360 degrees | Blind spots unacceptable near aircraft |
| Operating temperature | -30C to +60C | Outdoor ramp conditions year-round |
| Weather rating | IP67 minimum | Rain, snow, standing water exposure |

### Regulatory Path for Airside Teleoperation

1. **Engage FAA early:** CertAlert 24-02 requires coordination with regional Airport Certification and Safety Inspector before any testing
2. **Start in non-movement areas:** Aprons, gate areas, and baggage handling areas qualify as "controlled environments" under current FAA guidance
3. **Movement area access:** Currently not authorized for autonomous testing at Part 139 airports — requires separate approval process
4. **EASA coordination:** For international airports, engage with EASA's autonomous vehicle framework development
5. **ICAO standards:** Push for ICAO-level framework to ensure global consistency across airports
6. **Safety case documentation:** Follow BSI PAS 1881 / PAS 1883 methodology for safety case assessment

---

## Summary: Key Takeaways for Airside AV Deployment

1. **Teleoperation is not optional** — every production AV deployment requires it as a fallback. The question is not whether to implement teleoperation, but how to implement it effectively.

2. **Remote assistance (advisory) scales better than remote driving.** Waymo's 1:41 ratio vs. Cruise's 1:15-20 demonstrates the operational advantage of building vehicles capable enough to only need advice rather than direct control.

3. **Cruise's failure is the essential case study.** Over-reliance on remote operators, combined with a system that didn't wait for human confirmation after a pedestrian collision, led to catastrophic consequences. The lesson: the vehicle must be able to reach a safe state independently, and remote operators must be able to intervene before the vehicle takes potentially harmful action.

4. **Private 5G is the right network for airside.** Public cellular networks introduce unacceptable variability for aircraft-proximity operations. Private 5G provides dedicated bandwidth, predictable latency, and full coverage of the operational area.

5. **Gradual autonomy is the pragmatic path.** Fernride's approach — start with teleoperation, progressively increase autonomy — is well-suited for airside deployment where the operational environment is more controlled than public roads but the consequences of failure (aircraft damage) are severe.

6. **Regulatory frameworks are evolving but incomplete.** The FAA's CertAlert 24-02 provides initial guidance, but comprehensive regulations for airside autonomous vehicles do not yet exist. Early engagement with regulators is essential.

7. **The staffing economics work.** At scale, a single operator overseeing 20-100 vehicles makes teleoperation cost-effective compared to dedicated drivers, while maintaining the safety net that regulators and insurers require.

8. **Cybersecurity is a first-class requirement.** A compromised teleoperation link at an airport creates both safety and security risks. TLS 1.3 encryption, mutual authentication, and multi-layered defense are baseline requirements.
