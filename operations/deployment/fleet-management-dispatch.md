# Fleet Management and Dispatch Systems for Autonomous Vehicle Operations at Airports

## 1. Fleet Management Platforms for Autonomous Vehicles

### 1.1 NVIDIA Fleet Command

NVIDIA Fleet Command is a hybrid-cloud platform for securely and remotely deploying, managing, and scaling AI workloads across edge devices — from dozens to thousands of systems. While not purpose-built for autonomous vehicle dispatch, it serves as the infrastructure layer that AV companies use to manage the software lifecycle of their vehicle fleets.

**Architecture and capabilities:**
- Built on zero-trust architecture with layered security designed for edge environments
- Centralized control plane accessible via browser — administrators of any skill level can manage and monitor their entire edge fleet
- Managed container orchestration that simplifies distributed computing environments with cloud-scale resiliency
- Private application registry, data encryption in transit and at rest, secure and measured boot

**Deployment and OTA updates:**
- New devices provisioned in minutes rather than weeks
- Deployments created in a few clicks and pushed across thousands of locations
- Over-the-air (OTA) software stack updates applied to all systems at a location simultaneously
- Remote access to systems and applications for troubleshooting

**Monitoring:**
- Custom dashboard monitoring for system and application health
- System and application logging with alerting capabilities
- Remote troubleshooting with direct system/application access
- Constant automated bug fixes and security patches

**Relevance to airport AV fleets:** Fleet Command is the operational backbone for managing the AI/ML models running on autonomous vehicles. When an airport deploys 20+ autonomous baggage tractors, each running perception and planning stacks on NVIDIA Jetson or DRIVE hardware, Fleet Command provides the mechanism to push model updates, monitor inference health, and ensure all vehicles are running consistent software versions. It does not handle dispatch or routing — those are handled by higher-level fleet management systems.

### 1.2 AWS IoT FleetWise

AWS IoT FleetWise is a managed service for collecting, transforming, and transferring vehicle data to the cloud. It is a data ingestion and telemetry platform rather than a dispatch system, but it provides the foundational data layer that fleet management systems depend on.

**Core architecture:**
- Edge Agent deployed on vehicles collects data from CAN bus sensors, cameras, radars, and lidars
- Signal catalog standardizes data from different vehicle protocols and formats into human-readable values
- Data collection campaigns define rules for what data to collect and when to transfer it (event-triggered or time-based)
- Intelligent data collection minimizes bandwidth by collecting only relevant data based on configurable parameters (speed, temperature, location, vehicle state)
- Edge storage allows data buffering until optimal transfer conditions (e.g., Wi-Fi availability at depot)

**Fleet management data use cases:**
- EV battery health and charge level monitoring across the fleet
- Predictive maintenance through pattern detection in sensor data
- Training data collection for improving autonomous driving ML models
- Remote state tracking for each vehicle in the fleet
- Compliance and regulatory data logging

**Integration:**
- Amazon Timestream for time-series vehicle telemetry
- Amazon S3 for long-term data storage and ML training pipelines
- AWS IoT Core for device registration and remote command execution

**Important limitation:** FleetWise explicitly cannot be used to control or operate vehicle functions. Data is informational only. It feeds into fleet management systems but does not replace them.

### 1.3 RobOps / Fleet Operations Platforms

The emerging "RobOps" (Robotics Operations) category includes platforms purpose-built for managing fleets of autonomous robots and vehicles in operational environments.

**Autofleet** is the most relevant platform for autonomous vehicle fleet operations, offering:
- AI-powered dispatch and routing using predictive and real-time traffic data
- Unified data layer normalizing signals from multiple AV OEMs into a common schema
- Real-time visibility into sensor data, battery level, speed, with live tracking, geofencing, and anomaly detection
- Safety driver app with route directions, incident reporting, disengagement metrics, and shift management
- Fleet Planning Simulator for testing operational strategies before deployment
- 30+ KPI tracking across fleet performance, utilization, and autonomous driving metrics
- Automated depot workflow sequencing — charging, cleaning, inspections, software updates
- White-labeled passenger app for booking and tracking

**Other notable platforms:**
- **Boston Dynamics Orbit** — fleet management for mobile robots with mission scheduling, anomaly detection, and site mapping
- **SYNAOS** — mobile robot fleet management (MRFM) with vendor-agnostic orchestration
- **KINEXON** — centralized AMR/AGV orchestration with VDA 5050 standard support
- **Meili FMS** — universal fleet manager supporting multiple robot brands from one platform
- **ASI Mobius** — OEM-agnostic fleet management for autonomous industrial vehicles, supporting both full automation and remote-controlled operation

---

## 2. How Waymo Manages Its Fleet

Waymo operates the world's largest commercial autonomous ride-hailing fleet, with approximately 2,500-3,000 vehicles across Phoenix, San Francisco, Los Angeles, Austin, and expanding cities. Understanding their operational model provides a benchmark for any AV fleet operation.

### 2.1 Fleet Distribution and Partners

Waymo has adopted a distributed fleet management model, outsourcing physical operations to specialized partners:
- **Moove** — fleet management for Phoenix, Austin, Atlanta, and Miami
- **Lyft Flexdrive** — end-to-end fleet management in Nashville including vehicle maintenance, infrastructure, and depot operations
- **Avis** — infrastructure, vehicle readiness, maintenance, and depot management in Dallas

This model separates the autonomous driving technology (Waymo) from the physical fleet operations (partners), allowing Waymo to scale without building depot infrastructure in every city.

### 2.2 Dispatch and Ride Assignment

Waymo's dispatch system solves a multi-objective optimization problem:
- **Ride matching:** When a rider requests a trip, the system evaluates available vehicles based on proximity, battery level, current heading, and estimated pickup time
- **Vehicle rebalancing:** Idle vehicles are repositioned to high-demand areas based on predicted demand patterns
- **Charging scheduling:** Vehicles with low battery are directed to charging depots, balanced against demand coverage needs

Academic research on robo-taxi dispatch (including work directly modeling Waymo-scale fleets) formulates this as a discrete-time Markov Decision Process. The state-of-the-art approach decomposes fleet dispatch into atomic actions — each vehicle receives one action from a fixed-size set: fulfill a trip, reposition to a region, charge, or idle. This reduces action-space complexity from exponential (in fleet size) to constant per vehicle. On NYC taxi data with 300 vehicles, Atomic-PPO achieved 91% of the theoretical upper bound versus 71% for baseline methods.

### 2.3 Charging and Depot Operations

Waymo operates dedicated charging depots in each service city:
- Mix of Level 2 and DC fast charging stations
- DC fast chargers replenish significant battery capacity in 30-60 minutes
- Automated battery monitoring directs vehicles to depots proactively
- The charging process requires a human technician to physically connect the charging cable (the vehicle navigates to the bay autonomously)
- Flexdrive (Lyft's fleet subsidiary) uses proprietary software with "intelligent charge management to minimize downtime"
- Charging deployment research shows that allocating chargers proportional to ridership patterns requires only 5% of fleet size in chargers, versus 10% with uniform distribution

### 2.4 Fleet Response and Remote Assistance

Waymo's Fleet Response system is the human safety net for ambiguous driving situations:

**What fleet response agents see:**
- Live camera feeds from vehicle exterior cameras
- 3D graphical representation of what the vehicle perceives around it
- Ability to rewind available feeds for scene analysis

**What they do:**
- Respond to specific information requests from the Waymo Driver (ADS)
- Confirm lane closures, interpret construction zones, classify ambiguous objects
- Propose or request specific driving paths
- The ADS evaluates input independently and remains in control of driving — agents provide advice, not commands

**Staffing:**
- Approximately 70 remote assistance agents on duty worldwide at any given time
- Ratio of roughly 1 agent per 41 vehicles
- Four geographically redundant locations: Arizona, Michigan, and two cities in the Philippines
- Approximately half of agents are based in the Philippines
- Event Response Team (US-based only) handles collisions, law enforcement, and regulatory matters

**Trend:** The vast majority of situations are resolved by the Waymo Driver without assistance, and the system's improving performance means it needs less help over time.

---

## 3. Airport-Specific Fleet Operations

### 3.1 TractEasy / EasyMile — Airport Baggage Towing

TractEasy (a joint venture between TLD and EasyMile) produces the EZTow autonomous tow tractor, deployed at multiple airports for Level 4 autonomous baggage transport.

**EZFleet — Fleet Management System:**
- Real-time tracking of all vehicles on site including position, assigned routes, ETA, destinations, and vehicle status
- Route optimization and mission scheduling
- Dynamic mission assignment — can switch between fixed-route and on-demand service
- Integration with Airport Operations Management systems via control APIs
- Data collection, analysis, and reporting for operational insights
- Single operator oversight of multiple driverless vehicles from a remote Site Control Center
- Real-time traffic information integration
- End-to-end secured connectivity
- Mobility-as-a-Service (MaaS) integration capability

**Remote Supervision (EasyMile Supervise):**
- Four 360-degree external cameras (front, rear, both sides) streaming live with monitored latency
- Interior camera for passenger/cargo monitoring
- Intercommunication system with speakers
- Remote control capabilities: talk to passengers, activate/deactivate accessories, rearm, start/resume missions, record logs
- GDPR-compliant video processing

**Airport deployments:**
- **Narita International Airport (Japan):** First Level 4 autonomous baggage towing, driverless vehicles transporting baggage between stations with only remote supervision
- **Changi Airport (Singapore):** Three autonomous tractors equipped with lidar, HD cameras, GPS, 4G/WiFi, transporting up to four unit loading devices between baggage handling area and aircraft bay
- **Greenville-Spartanburg International Airport (USA):** EZTow deployment for autonomous tow tractor operations

### 3.2 UISEE — Airport Autonomous Fleet with TAM Integration

UISEE operates the most deeply integrated autonomous airport fleet, with a cloud-based platform connected to airport management systems.

**Vehicle types:**
- **Autonomous Tractors (T30, T05 series):** Baggage and cargo transport, each towing up to four containers (10 tonnes combined weight)
- **Autonomous Shuttle Bus:** Staff and passenger movement
- **Autonomous Delivery Vehicle (UiBox):** Sample delivery
- **Autonomous Patrol Vehicles:** Border security operations

**Cloud-based management platform:**
- **Operation Monitoring:** Real-time vehicle driving state, remote video feeds, exception notification, and remote human intervention
- **Operation Management:** Vehicle reports, route reports, and operational reporting
- **Network Infrastructure:** 4G/5G communication through Road Side Units (RSU) and Data Collection Units (DCU), on-site monitoring via WiFi/Ethernet

**TAM (Total Airport Management) Integration:**
UISEE achieved a world-first at Shanghai Pudong International Airport by integrating autonomous vehicles with the TAM system. Within the TAM framework:
- The **SURF Agent** and **GMAN Agent** work in tandem with autonomous baggage tractors
- Real-time flight information drives smart scheduling decisions
- Route planning and task assignments are optimized based on live flight data
- Vehicles automatically receive transport tasks from the cloud
- Full-process, round-the-clock unmanned transportation across designated areas

**Changi Airport deployment (launched January 2026):**
- 2 autonomous tractors currently operational on a 7 km route between Terminal 1 and Terminal 4
- 6 additional units launching later in 2026, expanding to 24 by 2027
- Over 5,000 trial runs and 20,000+ kilometers of accident-free operation before launch
- More than 10 sensors and cameras per tractor
- Operates in all conditions: day, night, rain
- Remote monitoring control center with immediate human intervention capability
- ISO 21434 (cybersecurity) and ISO 27001 (information security) certified
- Compliant with Singapore Technical Reference TR68
- Future expansion beyond baggage to cargo and equipment towing

**Other deployments:** Hong Kong Airport, Urumqi Airport, Baiyun Airport, Hamad International Airport (Qatar)

### 3.3 Moonware HALO — Dispatch Layer for Airside Operations

Moonware HALO is the world's first Ground Traffic Control platform, designed to coordinate, monitor, and manage all airside operations from a centralized system. It functions as the "airside OS" that could eventually dispatch autonomous GSE.

**How HALO assigns tasks:**
- Ingests real-time flight data (schedules, gate assignments, arrival/departure times, delays)
- Considers variables: distance, departure and arrival times, crew availability, equipment proximity
- Employs an on-demand model for task distribution — dispatches crew and GSE as needed
- Adapts to real-time changes in the airfield (schedule changes, disruptions, delays)
- Algorithmically coordinates ground operations in real time
- Intelligently matches ground crew and GSE to service flights

**Key capability — disruption response:**
When flight schedules change unexpectedly, HALO redistributes staff and assets in real time. This is a capability the company notes is absent in existing airport operations, where dispatching is typically done via walkie-talkies and static schedules.

**What it tracks:**
- Ground activities are tracked and timestamped continuously
- Data is fed into planning tools for data-driven decisions and long-term process improvements
- Dynamic dispatching with live status updates and end-to-end visibility

**Japan Airlines / Haneda Airport trial:**
- JAL and JAL Ground Service (JGS) trialing HALO at the ground handling control station
- Focus areas: below-wing coordination, resource management, real-time situational awareness
- Enables real-time communication between control station and field teams
- Expected outcomes: reduced turnaround time variability, streamlined ground services execution

**Autonomous GSE integration roadmap:**
HALO is designed to command and control autonomous GSE in the future. Moonware's master plan:
1. First: digitize and optimize human crew and equipment dispatch with HALO
2. Then: integrate autonomous GSE (starting with pushback tugs) as the "body" controlled by HALO's "mind"
3. This creates a software+hardware ecosystem for comprehensive airside automation

---

## 4. Multi-Vehicle Coordination Algorithms

### 4.1 Vehicle Routing Problem with Time Windows (VRPTW)

VRPTW is the foundational optimization framework for fleet dispatch. It determines optimal routes for a fleet of vehicles to serve customers (or tasks), where each must be completed within a specific time window.

**Problem structure:**
- Fleet of heterogeneous vehicles with capacity constraints
- Set of tasks/customers each requiring service within a time window
- Minimize total travel distance/time while satisfying all constraints
- Vehicles must return to a depot (or charging station)

**Solution methods:**
- **Exact methods:** Column generation solving LP relaxation of set partitioning formulation, with feasible columns added by solving shortest path problems with time windows using dynamic programming. Branch-and-bound on the LP solution. Practical for small instances (CPLEX solves small-scale problems optimally)
- **Metaheuristics:** Genetic algorithms, Tabu search, Simulated Annealing, Adaptive Large Neighborhood Search (ALNS). Best metaheuristics reach solutions within 0.5-1% of optimum for instances with hundreds or thousands of delivery points
- **Reinforcement learning:** End-to-end RL frameworks now solve VRPTW with dynamic updates as new orders arrive or conditions change

**Airport relevance:** GSE scheduling is fundamentally a VRPTW problem — baggage tractors must serve specific aircraft within turnaround time windows, refueling trucks must visit gates in sequence, and all vehicles must return for charging/refueling. The "time windows" are the turnaround sub-task windows (e.g., baggage must be delivered within 15 minutes of aircraft arrival). The key difference from classic VRPTW is the high degree of task interdependence and the dynamic nature of flight schedules.

### 4.2 Auction-Based Task Allocation

Market-based methods provide distributed approaches to multi-robot task allocation, where agents bid on tasks based on their capabilities, location, and state.

**Consensus-Based Auction Algorithm (CBAA):**
- Each agent bids on tasks based on estimated cost/value
- Decentralized conflict resolution through local communication
- Converges to a conflict-free allocation

**Consensus-Based Bundle Algorithm (CBBA):**
- Generalization of CBAA to multi-assignment (each agent handles multiple tasks)
- Two-phase iteration: (1) bundle building — each vehicle greedily builds an ordered bundle of tasks; (2) consensus — conflicting assignments resolved through neighbor communication
- Polynomial-time algorithm that scales well with network size and task count
- Guaranteed 50% optimality for the multi-assignment problem
- Developed at MIT Aerospace Controls Laboratory
- Variants handle dynamic environments with local replanning, heterogeneous multi-team scenarios, and communication constraints

**Airport application:** In an autonomous GSE fleet, each vehicle (baggage tractor, fuel truck, pushback tug) is an agent. When a new aircraft arrives, the system broadcasts tasks. Vehicles bid based on proximity, battery level, current task load, and equipment compatibility. The auction resolves who goes where without centralized computation — critical when communication may be intermittent on a busy apron.

### 4.3 Multi-Agent Reinforcement Learning (MARL)

MARL treats each vehicle as an independent learning agent, training them to collectively optimize fleet-level objectives.

**Three paradigms:**
1. **DTDE (Decentralized Training, Decentralized Execution):** Each agent learns independently. Simple but can lead to non-stationary environments as other agents change behavior
2. **CTDE (Centralized Training, Decentralized Execution):** Training uses global information (centralized critic with access to full system state), but execution uses only local observations. Best balance of coordination quality and scalability
3. **CTCE (Centralized Training, Centralized Execution):** Most optimal but requires real-time centralized computation. Doesn't scale well

**CTDE implementation (DDMAC-CTDE):**
- Deep Decentralized Multi-Agent Actor-Critic architecture
- Centralized critic guides each agent's policy during training
- At execution time, each agent operates independently using only local information
- Consistently outperforms standard transportation management baselines
- Produces cost- and risk-efficient policies that respect operational constraints
- Addresses high dimensionality of state and action spaces

**Fleet dispatch applications:**
- Order dispatching for ride-hailing platforms at scale (thousands of vehicles)
- Vehicle repositioning to anticipate demand
- Joint optimization of trip assignment, charging, and rebalancing
- Collaborative spatiotemporal coordination through shared rewards

**Airport relevance:** MARL is particularly promising for airport GSE because the environment has strong spatial structure (fixed gate locations, defined taxiways), temporal patterns (flight schedules), and heterogeneous agents (different GSE types with different capabilities). CTDE allows training in simulation using full operational data, then deploying agents that make fast local decisions without requiring constant connectivity to a central server.

---

## 5. Task Allocation for Airport Turnaround

### 5.1 Turnaround Process and GSE Sequencing

An aircraft turnaround — the period from gate arrival to pushback — consists of up to 12 interdependent sub-processes containing more than 150 individual activities involving up to 30 different actors. A single narrowbody turnaround can require 10-20 different pieces of equipment.

**Typical turnaround timeline (narrowbody, 25-40 minutes):**

| Phase | Equipment Required | Timing | Dependencies |
|-------|-------------------|--------|--------------|
| Chocks and cones | Wheel chocks, safety cones | Immediately on arrival | None |
| Ground power connection | GPU (Ground Power Unit) | Within 2 min of arrival | Chocks placed |
| Jet bridge / stairs | Passenger stairs, jet bridge | Within 2 min | Chocks placed |
| Passenger deplaning | Stairs/jet bridge | Minutes 2-10 | Bridge connected |
| Baggage/cargo unload | Belt loaders, cargo loaders, baggage tractors | Minutes 2-15 | Cargo doors accessible |
| Cabin cleaning | Cleaning cart | After deplaning complete | Deplaning finished |
| Catering | Catering truck (hi-lift) | After deplaning complete | Deplaning finished (physical access constraint) |
| Lavatory service | Lav cart | Can parallel with cleaning | Access to lav panel |
| Water service | Water truck | Can parallel with cleaning | Access to water panel |
| Refueling | Fuel truck / hydrant dispenser | Can start during deplane | Safety zone clearance |
| Baggage/cargo loading | Belt loaders, cargo loaders, baggage tractors | After unload, parallel with boarding | Cargo hold clear |
| Passenger boarding | Stairs/jet bridge | After cleaning + catering | Cabin ready |
| Pushback | Pushback tug / towbarless tractor | After doors closed | All services complete, clearance from ATC |

**Key constraints:**
- Deplaning and catering cannot overlap — catering requires movement of trolleys that conflicts with passenger flow
- Refueling and passenger operations have safety zone requirements
- Many operations can run in parallel but compete for physical space around the aircraft
- Critical path is typically: deplane -> clean -> cater -> board -> pushback

### 5.2 GSE Scheduling as an Optimization Problem

Research models GSE scheduling as a cooperative scheduling problem with these characteristics:
- **Nine key service types:** Ferry, baggage, refueling, garbage, sewage, freshwater, catering, de-icing, towing
- **Interdependencies:** Delays in one operation cascade to others
- **Dual operational models:**
  - Reactive: Equipment allocated on-demand as turnaround teams need specific GSE
  - Planned: Third-party fleet manager pre-positions equipment based on flight schedule, with optional advance booking
- **Optimization objective:** Minimize turnaround time while respecting sequencing constraints and resource availability

**Research findings:**
- Booking GSE in advance significantly reduces delays compared to first-come-first-serve allocation
- Turnaround schedules should be updated 2-3 times per hour to remain responsive
- GPS-based tracking reduces idle time and improves resource visibility
- Inefficiencies in GSE scheduling are the second most common cause of flight delays (after ATC issues)
- Hybrid simulation (agent-based + discrete event) is the preferred modeling approach, with agents representing aircraft, parking stands, GSEs, storage locations, and ground handlers

---

## 6. Charging and Battery Management for Electric GSE Fleets

### 6.1 Charging Strategy Spectrum

Electric GSE fleets must balance vehicle availability against battery health and infrastructure cost. There are three primary approaches, and most airports will use a combination:

**Depot Charging (Centralized):**
- Vehicles return to a central facility for charging between shifts
- Advantages: Simpler infrastructure, concentrated power management, easier maintenance access
- Disadvantages: Vehicles unavailable during charging, travel time to/from depot, requires larger fleet to maintain coverage
- Best for: Overnight charging of vehicles with predictable duty cycles (e.g., pushback tugs with defined shift patterns)

**Opportunity Charging (Distributed, Gate-Area):**
- Charging stations placed near operational areas (gates, baggage halls, cargo areas)
- Vehicles plug in during natural idle periods (e.g., baggage tractor charges between arriving and departing flight handling)
- Advantages: Higher vehicle utilization, smaller required fleet size, leverages natural idle time
- Disadvantages: More infrastructure to install and maintain, potential space conflicts at gates, higher power demand distribution
- Best for: Vehicles with frequent short idle periods (baggage tractors, belt loaders)

**Fast Charging (Strategic Points):**
- DC fast chargers (30-400 kW) at strategic locations for rapid top-ups
- 30-60 minutes for significant battery replenishment
- Best for: High-utilization vehicles that cannot afford extended downtime

### 6.2 Smart Charging Infrastructure

**Multi-port power sharing:**
- Single power supply shared across up to 16 vehicles simultaneously (PosiCharge/Fastcharge systems)
- Reduces infrastructure costs vs. individual charging points for each vehicle
- Smart power-sharing devices unlock existing airport power capacity — many airports have more available power than they realize

**Charging power ranges:**
- Low-voltage DC: 24-96V (PosiCharge Multi Vehicle System) — for smaller GSE
- High-voltage DC: 100-1000V (Fastcharge Sinexcel) — for large tractors and tugs
- Power output: 10 kW to 400 kW depending on application
- Some vehicles can operate a full shift with 220V single-phase opportunity charging

**Infrastructure planning considerations:**
- Charger location: at gates vs. centralized areas. Airports with distributed chargers near operational areas report higher utilization and simpler fleet scheduling
- Power capacity assessment: many airports can leverage existing electrical infrastructure with smart load management
- Dallas Fort Worth International Airport has operated a PosiCharge charger continuously for 24 years, demonstrating infrastructure longevity

### 6.3 Charging Optimization for Autonomous Fleets

For autonomous electric GSE, charging becomes part of the dispatch optimization problem:

**Joint dispatch-charging optimization:**
- Three integrated sub-problems: (1) match vehicles with tasks, (2) relocate empty vehicles to anticipated demand areas, (3) assign low-charge vehicles to chargers based on charger workloads
- Markov Decision Process formulation jointly optimizes charging and task dispatch
- Reinforcement learning approaches fuse centralized task allocation with distributed charging decisions — each vehicle makes autonomous charging decisions based on its unique state and environment

**Key finding from research:** Allocating chargers proportional to operational demand patterns requires only 5% of fleet size in charging infrastructure, versus 10% with uniform distribution. This means a 100-vehicle autonomous GSE fleet needs as few as 5 strategically placed chargers rather than 10 uniformly distributed ones.

**Battery health management:**
- Lithium-ion batteries can be charged at any state of charge without memory effect, enabling opportunity charging
- However, excessive fast charging or charging at improper temperatures accelerates degradation
- Active thermal management and charge rate limiting are essential for fleet battery longevity
- Electric GSE sales are projected to grow at 8% CAGR through 2030

---

## 7. Remote Monitoring and Intervention

### 7.1 Teleoperation Taxonomy

Remote operation of autonomous vehicles encompasses four distinct modes, per BSI PAS 1886:

1. **Remote Monitoring:** Passive observation of vehicle status, health, and environment. No direct vehicle control. Highest vehicle-to-operator ratio.
2. **Remote Assistance:** Providing waypoints, path suggestions, or contextual information (e.g., "the lane is blocked, reroute left"). The ADS evaluates and may accept or reject advice. This is how Waymo operates.
3. **Remote Management:** Higher-level task management — reassigning missions, stopping vehicles, changing operational parameters.
4. **Remote Driving:** Direct joystick/steering control of the vehicle from a remote location. Lowest vehicle-to-operator ratio. Most latency-sensitive.

### 7.2 What the Operator Sees

A typical remote monitoring/assistance station includes:
- **Multiple live camera feeds:** Front, rear, side cameras (EasyMile uses four 360-degree cameras)
- **3D perception visualization:** What the ADS "sees" — detected objects, planned path, lane boundaries (Waymo provides this)
- **Vehicle telemetry:** Speed, battery level, GPS position, system health indicators
- **Interior camera:** For passenger monitoring in shuttle operations
- **Alert dashboard:** Flagged situations requiring attention, prioritized by severity
- **Rewind capability:** Ability to review recent footage for better scene understanding (Waymo)
- **Communication systems:** Intercom to passengers, text/voice to field teams

### 7.3 Vehicles Per Operator

The vehicle-to-operator ratio varies dramatically by operational context:

| Company/Context | Ratio | Notes |
|----------------|-------|-------|
| Waymo (remote assistance) | ~1:41 | 70 agents for ~3,000 vehicles. Agents provide advice only; ADS drives |
| Cruise (pre-shutdown) | ~1:1.5 | Up to 1.5 people per AV including remote operators. Vehicles needed help every 2.5-5 miles |
| EasyMile (Level 4 shuttles) | 1:multiple | Single operator supervises multiple vehicles; demonstrated with 2 shuttles, designed to scale further |
| TractEasy EZFleet | 1:large fleet | Single operator oversees a "large fleet" of driverless vehicles |
| Ideal future state | 1:50+ | Industry target for commercially viable autonomous operations |

**Scaling considerations:**
- Intervention frequency is the key determinant of operator ratio. As ADS improves, interventions become rarer, and each operator can manage more vehicles
- AR-enhanced interfaces with predictive path overlay and hazard highlighting improve operator efficiency
- Adaptive workload management dynamically adjusts vehicle-to-operator ratios based on real-time complexity metrics
- Physiological monitoring detects operator fatigue or attention lapses
- Industry concern (Koopman): economic pressure at scale could incentivize minimal training, offshore labor pools, and inadequate situational awareness

### 7.4 Airport-Specific Remote Operations

Airport autonomous GSE operations differ from public-road robotaxis:
- **Lower speeds** (typically <25 km/h on the apron) reduce urgency of interventions
- **Controlled environment** with defined routes reduces ambiguity
- **Physical security perimeter** limits unexpected actors
- **But:** FOD, jet blast, moving aircraft, and weather create unique hazards
- **Expected ratio:** Airport autonomous GSE should achieve higher vehicle-to-operator ratios than public road AVs due to the structured environment, potentially 1:20+ in early deployments scaling to 1:50+ as systems mature

---

## 8. Fleet Analytics and KPIs

### 8.1 Core Fleet KPIs

Fleet performance metrics fall into four categories:

**Utilization Metrics:**
- **Fleet Utilization Rate:** Percentage of time vehicles are productively working vs. available time. Target: >80% (meaning vehicles productive 80% of available time, with 20% for charging, maintenance, idle)
- **Active Vehicle Ratio:** Percentage of total fleet that is operational (not in maintenance, not deadlined)
- **Revenue-per-Vehicle-Hour (or Task-per-Vehicle-Hour):** Productivity measure per unit

**Throughput Metrics:**
- **Tasks Completed per Vehicle per Shift:** For baggage tractors, this might be deliveries per shift
- **Turnaround Contribution:** Percentage of turnarounds where GSE arrived on time
- **On-Time Task Completion Rate:** Percentage of tasks completed within the required time window

**Downtime Metrics:**
- **Average Maintenance Downtime:** Time vehicles are unavailable due to repairs
- **Mean Time Between Failures (MTBF):** Average operating time between breakdowns
- **Preventive Maintenance Compliance:** Percentage of scheduled maintenance completed on time. Fleets below 85% PM compliance are statistically predictable candidates for expensive unplanned downtime within 90 days
- **Charging Downtime:** Time spent charging as percentage of total available time

**Autonomy-Specific Metrics:**
- **Miles/Hours Per Intervention (MPI):** How far/long the vehicle operates between human interventions
- **Disengagement Rate:** Frequency of fallback to human control. Waymo averages one disengagement per ~13,219 miles
- **Remote Assistance Request Rate:** Frequency of fleet response calls
- **Minimum Risk Condition (MRC) Events:** How often the vehicle stops and requires roadside assistance
- **ODD Compliance Rate:** Percentage of time operating within Operational Design Domain

### 8.2 Airport-Specific Fleet KPIs

Beyond standard fleet metrics, airport operations demand:
- **Turnaround Delay Contribution:** Minutes of delay attributable to GSE availability/timing
- **Gate Dwell Time Reduction:** Impact of improved GSE dispatch on aircraft time at gate
- **Asset Fetch Time:** Time from task assignment to GSE arriving at aircraft stand
- **Asset Store Time:** Time from task completion to GSE returning to staging area
- **Flight Schedule Adherence Impact:** Correlation between GSE performance and OTP (On-Time Performance)
- **Safety Events per 1,000 Operations:** Incidents, near-misses, FOD events

### 8.3 Analytics Platform Requirements

Effective fleet analytics requires:
- Real-time dashboard with 3-4 north star KPIs (utilization, downtime, task completion rate, intervention rate)
- Historical trend analysis for identifying degradation patterns
- Predictive analytics for maintenance scheduling and demand forecasting
- Comparative analysis across vehicle types, routes, and time periods
- Automated alerting for KPI threshold breaches
- Exportable reports for regulatory compliance and SLA tracking

---

## 9. Integration with Airport Operations Systems

### 9.1 A-CDM (Airport Collaborative Decision Making)

A-CDM is the framework through which airport stakeholders (airport operators, airlines, ground handlers, ATC, Network Manager) share information to optimize operations. It is implemented at 34+ European airports and expanding globally.

**Core milestones relevant to GSE dispatch:**

| Milestone | Description | GSE Dispatch Relevance |
|-----------|-------------|----------------------|
| ABI (Actual Block-In) | Aircraft arrives at gate | Triggers all turnaround GSE dispatch |
| EIBT (Estimated In-Block Time) | Predicted arrival time | Pre-positions GSE before aircraft arrives |
| TOBT (Target Off-Block Time) | When ground handler expects aircraft ready for pushback | Drives backward scheduling of all turnaround tasks |
| TSAT (Target Start-up Approval Time) | When ATC will approve engine start | Constrains latest completion time for all ground ops |
| AOBT (Actual Off-Block Time) | Aircraft pushes back | Releases GSE and gate for next operation |

**How A-CDM drives autonomous GSE dispatch:**
- EIBT updates allow GSE pre-positioning 10-15 minutes before aircraft arrival
- TOBT changes (due to delays, maintenance, crew issues) trigger real-time GSE schedule recalculation
- If TOBT slips, autonomous GSE can be reassigned to higher-priority turnarounds
- If TOBT advances (aircraft ready early), GSE can be accelerated from current tasks
- TSAT provides the hard deadline — all GSE must complete service before TSAT
- The TOBT is the essential airline contribution to A-CDM — it communicates when ground handling is expected to be complete

**Integration architecture for autonomous GSE:**
An autonomous GSE fleet management system would subscribe to A-CDM data feeds:
1. Receive EIBT updates → compute GSE arrival schedule per gate
2. Receive gate assignment changes → recompute routes and pre-positioning
3. Receive TOBT updates → adjust task priorities and rebalance fleet
4. Report actual service start/end times back to A-CDM → improving future TOBT predictions
5. Feed turnaround performance data into airport operational analytics

### 9.2 Flight Schedule and Gate Assignment Integration

Beyond A-CDM milestones, autonomous GSE dispatch must integrate with:
- **AODB (Airport Operational Database):** Master source for flight information — airline, aircraft type, gate assignment, schedule
- **Gate Management Systems:** Which gates are allocated to which flights, and when. Gate changes trigger GSE rerouting
- **Baggage Handling Systems (BHS):** Baggage availability times drive baggage tractor dispatch
- **Fuel Management Systems:** Fuel order quantities and delivery schedules
- **Catering Systems:** Meal counts and preparation timelines

**UISEE's TAM integration** at Shanghai Pudong is the most advanced example of this integration in practice — autonomous tractors receive tasks directly from the TAM system based on real-time flight data, with SURF and GMAN agents coordinating scheduling and routing.

**Moonware HALO** aims to be the integration layer that consolidates these data sources and translates them into crew and equipment dispatch decisions, with autonomous GSE as a future execution layer.

---

## 10. Scalability Challenges: From 10 Vehicles to 100

The operational model that works for a 10-vehicle pilot bears little resemblance to what is needed for 100-vehicle production deployment. The following table maps what changes across key dimensions:

| Dimension | 10 Vehicles (Pilot) | 100 Vehicles (Production) |
|-----------|---------------------|---------------------------|
| **Dispatch** | Manual or simple rule-based. Dispatcher can mentally track all vehicles | Algorithmic optimization required. VRPTW/MARL solvers. No human can track 100 vehicles simultaneously |
| **Communication** | Single WiFi network or 4G sufficient | Redundant 4G/5G with edge computing. V2X infrastructure. Latency-critical path planning |
| **Control architecture** | Centralized works fine — one server manages 10 vehicles | Hybrid centralized/decentralized. Central server for global optimization, local agents for real-time decisions. Pure centralization becomes a bottleneck and single point of failure |
| **Charging** | A few chargers, manual scheduling | Smart charging optimization. Charger allocation algorithms. Power load management across airport grid. Minimum 5-10 chargers with dynamic scheduling |
| **Maintenance** | One technician can service all vehicles | Dedicated maintenance facility. Predictive maintenance essential. Spare vehicle pool (10-15% of fleet). Parts inventory management |
| **Remote monitoring** | 1-2 operators cover entire fleet | Tiered monitoring: automated system handles routine, operators handle exceptions. Multiple operator stations. Shift coverage planning |
| **Software updates** | Push updates to 10 vehicles overnight | OTA update orchestration (NVIDIA Fleet Command). Rolling updates to maintain availability. Canary deployments (update 5% of fleet, validate, then roll to remainder) |
| **Data management** | Single database handles all telemetry | Data pipeline architecture. Edge processing to reduce bandwidth. Time-series databases. Data lake for ML training. Multi-OEM data normalization |
| **Safety** | Individual vehicle safety validation | Fleet-level safety case. Systemic failure analysis. Emergency fleet stop capability. Coordinated response to shared hazards (e.g., all vehicles detect FOD simultaneously) |
| **Regulatory** | Pilot permit with limited scope | Full operational approval. Safety Management System (SMS) integration. Incident reporting procedures. Regular audits. Compliance dashboards |
| **Organizational** | Part of R&D team's responsibilities | Dedicated fleet operations team. 24/7 coverage. Defined escalation procedures. SLAs with airport and airlines |
| **Cost structure** | Capital-dominated (vehicle cost) | Operations-dominated (charging, maintenance, insurance, staff). Economy of scale in per-unit costs but absolute operational complexity grows superlinearly |

### Key Scaling Inflection Points

**10 → 25 vehicles:** Dispatch transitions from manual to algorithmic. First dedicated fleet operator needed. Charging scheduling becomes non-trivial.

**25 → 50 vehicles:** Centralized control starts showing strain. Decentralized elements needed. Maintenance becomes a full-time function. Need dedicated charging infrastructure (not shared with other airport equipment). Multi-OEM integration challenges emerge if fleet is heterogeneous.

**50 → 100 vehicles:** Full fleet management platform required (Autofleet-class). Predictive maintenance essential. Regulatory scrutiny intensifies. Safety case must cover fleet-level emergent behaviors. Communication infrastructure must be redundant. Organization needs defined roles: fleet operations manager, maintenance supervisor, remote monitoring shift leads, safety officer.

**100+ vehicles:** Edge computing for local decision-making. Federated learning for model improvement without centralizing all data. Multi-depot operations. Likely need for decentralized coordination algorithms (CBBA-class). Integration with airport-wide systems (A-CDM) becomes mandatory rather than optional.

---

## 11. Synthesis: Architecture of an Airport AV Fleet Management System

Bringing together the research, an effective fleet management and dispatch system for autonomous airport GSE requires the following layered architecture:

```
Layer 5: Airport Integration
├── A-CDM data feeds (EIBT, TOBT, TSAT)
├── AODB (flight schedule, gate assignments)
├── BHS (baggage availability)
└── Gate management system

Layer 4: Fleet Optimization Engine
├── Task allocation (VRPTW / CBBA / MARL)
├── Vehicle-task matching
├── Charging schedule optimization
├── Vehicle rebalancing / pre-positioning
└── Disruption response (real-time replanning)

Layer 3: Fleet Operations Platform
├── Real-time fleet monitoring dashboard
├── Remote supervision stations
├── Maintenance management
├── KPI tracking and analytics
└── Incident management

Layer 2: Vehicle Management
├── OTA software updates (NVIDIA Fleet Command)
├── Vehicle telemetry collection (AWS IoT FleetWise)
├── Health monitoring and diagnostics
└── Edge computing for local autonomy

Layer 1: Vehicle Autonomy
├── Perception (lidar, cameras, radar)
├── Planning and decision-making
├── Vehicle control
└── V2X communication
```

The key insight is that no single product covers the full stack. Current deployments stitch together multiple systems:
- **UISEE** covers Layers 1-3 with TAM integration at Layer 5
- **TractEasy/EasyMile** covers Layers 1-3 with EZFleet
- **Moonware HALO** operates at Layers 4-5 but currently dispatches human crews, not autonomous vehicles
- **Autofleet** operates at Layers 3-4 for ride-hailing AVs
- **NVIDIA Fleet Command** operates at Layer 2
- **AWS IoT FleetWise** operates at Layer 2

The gap is in the tight integration between Layer 4 (optimization) and Layer 5 (airport systems), informed by Layer 1 (real-time vehicle state). UISEE's TAM integration at Pudong is the closest anyone has come to closing this gap for autonomous airport vehicles.
