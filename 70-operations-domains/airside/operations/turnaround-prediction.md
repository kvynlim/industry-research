# Aircraft Turnaround Prediction, GSE Fleet Coordination, and Operational Integration for Airside Autonomous Vehicles

## 1. Aircraft Turnaround Phases

### 1.1 Standard Turnaround Sequence

An aircraft turnaround is the complete ground handling cycle between "chocks on" (arrival at gate) and "chocks off" (pushback for departure). The canonical sequence proceeds as follows:

**Phase 0 — Arrival and Parking**
- Aircraft taxis to stand, guided by marshaller or VDGS (Visual Docking Guidance System)
- Engines shut down, chocks placed, ground power connected
- Typical duration: 2–4 minutes from stop to chocks-on

**Phase 1 — Opening and Initial Access (3–4 minutes)**
- Jet bridge or air stairs positioned and doors opened
- Cargo doors opened, belt loaders and container loaders positioned
- Ground power unit (GPU) and pre-conditioned air (PCA) connected

**Phase 2 — Unloading (8–15 minutes, parallel)**
- Passenger deplaning: ~8 min for 160 pax (narrowbody), 15–25 min for widebody
- Cargo/baggage unloading: ~12 min for 8 ULD containers (narrowbody)
- Bulk cargo unloading: ~4 min for 1,200 lbs
- Wastewater servicing begins simultaneously

**Phase 3 — Servicing (15–25 minutes, parallel, critical path)**
- Cabin cleaning: 8–15 min (narrowbody), 30–45 min (widebody full clean)
- Catering: ~10–13.5 min per galley exchange
- Refueling: ~20 min for 26,000 liters (narrowbody), 30–45 min (widebody)
- Potable water replenishment
- Lavatory servicing
- Refueling is typically the critical-path activity in this phase

**Phase 4 — Loading (12–15 minutes, parallel)**
- Cargo/baggage loading: ~12 min for 8 ULD containers
- Passenger boarding: ~13 min for 160 pax (narrowbody), 25–40 min (widebody)
- Final cargo reconciliation and load sheet preparation

**Phase 5 — Departure Preparation (3–5 minutes)**
- Doors closed, jet bridge retracted
- All GSE removed from safety zone
- Pushback tug connected
- Final headcount verification and safety checks
- ATC clearance requested

**Phase 6 — Pushback and Taxi**
- Chocks removed (chocks off = official departure time)
- Aircraft pushed back from stand
- Engine start during or after pushback

### 1.2 Typical Durations by Aircraft Type

| Aircraft Type | Category | Planned Turnaround | Typical Actual | Key Constraint |
|---|---|---|---|---|
| A320 / B737 | Narrowbody | 35–45 min | 50–70 min | Refueling (~20 min) |
| A321neo / B737 MAX 10 | Large Narrowbody | 40–50 min | 55–75 min | Boarding (~15 min) |
| B787 / A330 | Small Widebody | 75–90 min | 90–120 min | Cargo + Catering |
| B777 | Large Widebody | 90 min | 105–120 min | Multi-galley catering |
| A380 | Super Heavy | 90–105 min | 105–140 min | Dual-deck boarding/cleaning |

Low-cost carriers (Ryanair, Spirit, AirAsia) routinely achieve 25–30 minute narrowbody turnarounds by eliminating catering exchanges, minimizing cleaning scope, and using single-aisle rapid boarding. Full-service carriers typically plan 45–65 minutes for narrowbody domestic turns.

OAG data from March 2023 shows actual performance variance:
- Southwest: 52 min planned, 59 min actual (13% variance)
- United Airlines: 62 min planned, 68 min actual (10% variance)
- JetBlue: 63 min planned, 75 min actual (19% variance)
- B777 turnarounds showed the worst variance: American Airlines experienced 56% variance from plan

### 1.3 IATA AHM Ground Handling Standards

The **IATA Airport Handling Manual (AHM)**, now in its 46th edition (2026), establishes policy-level standards for passenger, cargo, mail, and aircraft handling, load control, safety management, ground handling agreements, GSE management, and training. The AHM defines "what to do."

The **IATA Ground Operations Manual (IGOM)**, now in its 14th edition (2026), is the complementary procedural manual defining "how to do" — standardized procedures for turnaround actions, chocking, safety briefings, special cargo handling, and passenger processes.

Key IATA standards relevant to turnaround coordination:
- **AHM Chapter 610**: Ground handling agreements (Standard Ground Handling Agreement — SGHA)
- **AHM Chapter 810**: GSE specifications and management requirements
- **IGOM Chapter 4**: Aircraft turnaround actions, standardized chocking procedures, safety briefings
- **IATA Enhanced GSE Recognition Program**: Launched 2024, 98 ground handling fleets registered and 28 stations recognized as of May 2025
- **IATA Autonomous GSE Guidelines**: Published recommended practices for testing and implementing autonomous GSE, addressing unique challenges of the ramp operating environment

---

## 2. Turnaround Prediction

### 2.1 Predicting Phase Transitions

Turnaround prediction aims to forecast when each sub-process will begin and end, culminating in accurate prediction of the Target Off-Block Time (TOBT). This is critical for Airport Collaborative Decision Making (A-CDM), where accurate TOBT feeds into the pre-departure sequencer to generate Target Start-up Approval Time (TSAT) and Target Take-Off Time (TTOT).

The challenge is inherently sequential-stochastic: turnaround sub-processes are partially ordered, partially parallel, and each has variable duration depending on aircraft type, load factor, ground handler performance, weather, and upstream delays.

**Key prediction targets:**
- Phase transition timestamps (when does unloading end? when does boarding begin?)
- TOBT / Predicted Off-Block Time (POBT)
- Predicted Readiness Time (PRDT)
- Total turnaround time
- Delay propagation risk

### 2.2 ML Approaches

**Cascaded Gradient Boosting (CGBRT)**
A cascaded multi-output Gradient Boosting Regression Tree model dynamically predicts aircraft turnaround milestone times. The cascaded framework incorporates hierarchical information transmission — predictions from earlier milestones feed as features into later milestone predictions. Published results (2025) show initial prediction accuracy above 80% within +/- 5 minutes, improving progressively as turnaround operations advance, with over 60% of activities ultimately attaining prediction accuracy above 95% within the same threshold. The model uses flight-related attributes combined with hierarchical features from preceding milestone predictions.

**Turnaround Sub-Process Fusion Models**
Data-driven fusion models integrate sequential information from the turnaround pattern, considering duration of various sub-processes and their overlapping conditions. Machine learning classification algorithms predict turnaround time incrementally based on real-life data, with results showing enhanced robustness and reliability compared to single-output models.

**Time Transition Petri Net (TTPN) with Bayesian Inference**
A hybrid approach models turnaround operations as a Petri net with 12 transitions (landing through departure), then applies Bayesian inference with Monte Carlo simulation for probabilistic duration prediction. Using data from a major Chinese airport (2023), the model achieved RMSE of 3.75 minutes and MAE of 3.40 minutes across both A320 (C-type) and B777 (D-type) aircraft.

**Probabilistic and Ensemble Methods**
Research across Prague, Geneva, Arlanda, and Fiumicino airports demonstrated that linear regression and elastic nets are effective for turnaround time prediction within the A-CDM framework. Deep learning ensembles combining LSTM and gradient boosting have shown high accuracy, particularly when trained on airport-specific operational data.

**Graph Neural Networks for Temporal-Spatial Modeling**
- Graph Attention Networks stacked with LSTM (GAT-LSTM) capture both spatial dependencies between gates/stands and temporal correlations in turnaround sequences
- Adaptive Airport Graph Neural Networks (AAGNN) model flight sequence prediction for pre-tactical air traffic management
- Dynamic Spatial-Temporal Propagation Neural Networks model delay propagation across airport networks
- Spatiotemporal Propagation Networks (STPN) using space-time separable graph convolutions capture how delays from turnarounds propagate to downstream flights

**Agent-Based Simulation**
Agent-based models simulate aircraft stand operations where individual GSE vehicles, crew members, and aircraft act as agents with defined behaviors, producing ground time predictions through emergent system behavior rather than direct regression.

### 2.3 Data Sources

**A-CDM Milestones**
The A-CDM framework defines 16 milestones tracking flight progress from initial planning to takeoff. Key timestamps:

| Timestamp | Definition |
|---|---|
| ELDT | Estimated Landing Time — predicted touchdown |
| ALDT | Actual Landing Time — observed touchdown |
| EIBT | Estimated In-Block Time — predicted arrival at stand |
| AIBT | Actual In-Block Time — observed chocks-on |
| TOBT | Target Off-Block Time — predicted readiness for pushback |
| TSAT | Target Start-up Approval Time — ATC-allocated startup slot |
| AOBT | Actual Off-Block Time — observed pushback |
| TTOT | Target Take-Off Time — planned takeoff considering TOBT + taxi |
| ATOT | Actual Take-Off Time — observed departure |

The dynamic interplay between TOBT prediction and TSAT allocation forms the core mechanism of A-CDM. Improved TOBT accuracy directly translates to better runway sequencing and reduced taxi-out delays.

**Airport Operational Database (AODB)**
The AODB serves as the airport's central nervous system — a centralized database storing and distributing real-time operational data including flight schedules, gate assignments, baggage system status, and resource allocations. Key integrations:
- Flight Information Display Systems (FIDS)
- Baggage Handling Systems (BHS)
- Resource Management Systems (stand allocation, check-in desks)
- Ground handler dispatch systems
- Air Traffic Control data feeds

Major AODB vendors include Amadeus, TAV Technologies, Veovo, Collins Aerospace, and Framfor. The AODB provides the foundational data layer that turnaround prediction models consume: scheduled times, actual times, aircraft type, airline, origin/destination, gate assignment, and historical performance.

**ADS-B (Automatic Dependent Surveillance-Broadcast)**
ADS-B Out broadcasts aircraft GPS position, altitude, ground speed, and identification once per second. For turnaround prediction, ADS-B provides:
- Accurate Estimated Landing Time (ELDT) from approach trajectory
- Taxi-in time estimation from runway to gate
- Real-time awareness of inbound aircraft for proactive GSE dispatch
- Airport Surface Detection (ASSC/ASDE-X) fuses ADS-B with multilateration to track aircraft and equipped ground vehicles on the surface movement area

**Computer Vision (Apron Cameras)**
Assaia's ApronAI system exemplifies camera-based turnaround monitoring. Strategically placed cameras across aircraft stands, aerobridges, and the apron generate real-time timestamps for turnaround events (door open/close, GSE arrival/departure, boarding start/end). Deployments include:
- Heathrow: 540+ cameras across 116 gates at Terminals 2, 3, and 5
- Calgary: 67 gates
- JFKIAT, Rome Fiumicino, Toronto Pearson

Performance results from Assaia deployments:
- 5-minute reduction in ground delays at JFKIAT
- 17% on-time performance improvement for Alaska Airlines
- 6-minute delay reduction at Rome Fiumicino
- 44% reduction in average taxi-in time at Toronto Pearson

---

## 3. Moonware HALO Platform

### 3.1 Overview and Architecture

Moonware, a Los Angeles-based company, has developed HALO — the world's first AI-powered Ground Traffic Control (GTC) platform. HALO serves as a centralized airside operating system that coordinates, monitors, and manages all ground operations in real time.

**Core Architecture Components:**
- **Centralized Coordination Engine**: Algorithmically dispatches crew and equipment by considering distance, departure/arrival times, crew availability, and real-time schedule changes
- **Three Data Streams**: (1) Real-time flight information from airline and airport systems, (2) crew schedules and task allocation data, (3) ground positions and movement of crew and vehicles via cell phone GPS and low-cost trackers
- **Dynamic Task Allocation**: Automatically assigns and reassigns tasks based on real-time schedule changes, logging precise start/stop times
- **Live Operational Map**: Real-time visualization of aircraft, equipment, and crew locations providing complete operational picture
- **Communication Layer**: Replaces walkie-talkie coordination with digital real-time communication between ground handling control stations and field teams

**Key Capabilities:**
- Dynamic dispatching with live status updates
- End-to-end visibility of turnaround operations
- Timestamped activity tracking fed continuously into planning tools
- Data-driven decision support for long-term process improvements
- Adaptation to fluctuating schedule changes for swift resource allocation

### 3.2 Performance Claims

- **20% reduction in delays** across deployed stations
- **5-minute average decrease** in turnaround time
- Reduced aircraft downtime and optimized gate utilization
- Faster turnarounds, reduced block times, higher flight throughput, and maximized asset utility

### 3.3 Deployments

**JFK Terminal 8 — British Airways / IAG**
Moonware's inaugural major airline deployment, servicing all British Airways flights at JFK in partnership with dnata (Emirates Group subsidiary) as ground handler. HALO coordinates task, crew, vehicle, aircraft, and gate pairings.

**Second US Hub Airport**
HALO is active at a second undisclosed US hub airport with Aerocharter as the ground handling partner.

**Tokyo International Airport (Haneda) — Japan Airlines**
Announced July 2025, Moonware is testing HALO with Japan Airlines (JAL) and JAL Ground Service (JGS) at Tokyo Haneda. Focus areas: below-wing coordination, resource management, and real-time situational awareness. JAL and JGS expect reduced variability in turnaround times and streamlined ground service execution.

### 3.4 Moonware Master Plan — Bridge to Airfield Autonomy

Moonware's roadmap envisions handling aircraft autonomously from touchdown to takeoff across four phases:

1. **Phase 1 — Software Foundation (Current)**: Deploy HALO with existing airlines, ground handlers, and airports to digitize and optimize manual ramp operations
2. **Phase 2 — Autonomous Ramp Services**: Leverage data and insights from Phase 1 to identify where autonomy augments ramp services; pilot autonomous GSE in defense (via NOVA) and emerging markets (Urban Air Mobility)
3. **Phase 3 — Autonomous Ground Service Provider**: Become a full autonomous ground handling operator; interface with ATC for autonomous surface movement of aircraft
4. **Phase 4 — Advanced Air Mobility Integration**: Airport infrastructure designed around service needs of diverse aircraft types including eVTOLs

**Product Portfolio:**
- **HALO**: Commercial airside operating system
- **NOVA**: Military Command-and-Control (C2) platform for flightline management, building on HALO's commercial foundation; tracks asset status, location, and mission phase; lays groundwork for Autonomous Aerospace Ground Equipment (A2GE)
- **ATLAS**: Autonomous and electric pushback tug designed for eVTOL operations

**Funding:** $2.5M pre-seed, followed by $7M seed round to advance automated airfields.

---

## 4. GSE Fleet Coordination

### 4.1 Problem Structure

GSE fleet coordination is a multi-dimensional optimization problem combining:
- **Task allocation**: Assigning ground handling tasks to heterogeneous GSE vehicles
- **Vehicle routing**: Planning efficient paths across the apron with time windows
- **Scheduling**: Sequencing vehicle trips within flight-dictated time constraints
- **Conflict resolution**: Avoiding collisions on shared apron roadways and stand areas

The problem is formally a **Vehicle Routing Problem with Time Windows (VRPTW)** on airport surfaces. A single aircraft turnaround can involve 10–20 different pieces of equipment, and at a busy airport, hundreds of turnarounds occur simultaneously.

### 4.2 GSE Types Requiring Coordination

Nine canonical GSE types in scheduling optimization models:
1. **Passenger stairs / Jet bridge** — First on, last off
2. **Baggage/cargo tractor and dollies** — ULD transport
3. **Belt loader** — Bulk cargo loading/unloading
4. **Fuel truck / hydrant dispenser** — Refueling
5. **Catering truck** — Galley exchange
6. **Potable water truck** — Water replenishment
7. **Lavatory service truck** — Waste removal
8. **Ground power unit (GPU)** — Electrical power
9. **Pushback tug** — Aircraft movement from stand
Additional: de-icing trucks (seasonal), air conditioning units (PCA), cleaning vehicles

### 4.3 Task Allocation Algorithms

**Auction-Based Multi-Agent Allocation**
Recent research (2025) presents a centralized multi-agent task allocation and routing model for autonomous GSE. Ground handling tasks are modeled as single-vehicle pickup-and-delivery problems. The auction mechanism, inspired by temporal sequential single-item auctions, allocates tasks to the GSE vehicle that can service them at lowest cost (time + distance + energy). Each GSE vehicle "bids" on available tasks based on its current position, remaining capacity, and schedule constraints.

**Integer Linear Programming (ILP)**
Classical formulation: minimize total service cost (travel time + waiting time + energy consumption) subject to:
- Each flight's GSE requirements must be met within its service time window
- Each GSE vehicle serves one task at a time
- Travel times between stands are respected
- Vehicle capacity and type constraints are enforced

**Multi-Objective Optimization**
Bi-objective models for electric GSE scheduling jointly minimize:
- Service time deviations (tasks completed within target windows)
- Energy consumption and emissions
- Fleet utilization balance

Solution algorithms include exhaustive methods, Clarke-Wright savings, column generation, genetic algorithms (GA), particle swarm optimization (PSO), and variable neighborhood search.

**Multi-Agent Reinforcement Learning (MARL)**
MARL approaches treat each GSE vehicle as an autonomous agent learning to coordinate through shared or independent reward signals:
- Multi-Agent Deep Deterministic Policy Gradient (MADDPG) handles simultaneous target assignment and path planning
- Multi-Agent Proximal Policy Optimization (MAPPO) addresses shared autonomous vehicle scheduling
- Agents learn collision avoidance, task prioritization, and cooperative behavior through simulated training environments

### 4.4 Multi-Vehicle Routing on Apron

**Path Planning for Large Agents**
Prioritized Safe Interval Path Planning (SIPP) plans collision-free paths for large physical agents (GSE vehicles with significant footprint) on the apron. Unlike point-agent path planning, this accounts for vehicle dimensions, turning radii, and kinematic constraints.

**Conflict-Free Scheduling**
- Temporal constraints: GSE must arrive at stand within service window (e.g., fuel truck after passengers deplane but before boarding)
- Spatial constraints: Limited stand area means only certain GSE combinations can operate simultaneously
- Precedence constraints: Some tasks must complete before others begin (e.g., deplaning before cleaning)
- Safety zones: GSE must clear the aircraft safety perimeter before pushback

**Digital Twin Approaches**
Multi-strategy cooperative scheduling based on digital twins creates a virtual replica of the apron environment, enabling real-time simulation of GSE movements, conflict detection, and schedule optimization before executing in the physical world.

### 4.5 Stand Sequencing

Stand sequencing determines the order in which aircraft are assigned to gates/stands, directly impacting GSE routing efficiency. Optimal stand assignment minimizes:
- Total GSE travel distance between consecutive assignments
- Towing requirements for remote stands
- Passenger walking distance
- Gate conflicts and buffer time requirements

---

## 5. Just-in-Time GSE Dispatch

### 5.1 Concept

Just-in-time (JIT) GSE dispatch aims to send each piece of ground support equipment to the stand precisely when needed — not too early (wasting equipment capacity and creating apron congestion) and not too late (delaying the turnaround and risking cascading delays). GSE scheduling inefficiencies are identified as the second most common cause of flight delays after air traffic control issues.

### 5.2 Predicting When Each GSE Type Is Needed

The prediction pipeline for JIT dispatch combines:

**Flight-Level Predictions:**
- ELDT from ADS-B trajectory analysis triggers pre-positioning of arrival GSE
- EIBT prediction (ELDT + estimated taxi-in time) provides the GSE dispatch target
- Aircraft type determines specific GSE requirements (e.g., widebody requires high-loader vs. belt loader)
- Load factor and cargo manifest predict unloading duration

**Turnaround Phase Predictions:**
- Cascaded milestone prediction models estimate when each sub-process will complete
- Completion of deplaning triggers cleaning and catering dispatch
- Fuel order confirmation triggers fuel truck dispatch
- Boarding completion prediction triggers pushback tug dispatch

**Pattern-Based Scheduling:**
- Historical turnaround patterns by airline, aircraft type, time of day, and day of week
- Seasonal adjustments (de-icing in winter, extended cooling in summer)
- Ground handler staffing level correlation with turnaround duration

### 5.3 Reducing Idle Time and Apron Congestion

**Telematics-Driven Fleet Management:**
Real-time GPS tracking of all GSE reveals usage patterns enabling:
- Fleet right-sizing: Determine optimal number of each GSE type per terminal
- Deadhead trip minimization: Route GSE directly between consecutive assignments
- Predictive maintenance: IoT sensors detect anomalies and predict failures, reducing unplanned downtime by up to 40%
- Charging optimization for electric GSE fleets: Schedule charging during predicted idle windows

**Cooperative Scheduling Under Uncertainty:**
Flight schedules are inherently uncertain. Models that incorporate flight delay distributions and stochastic service times produce more robust GSE schedules. Cooperative scheduling algorithms adjust dynamically as actual flight times deviate from plan, reassigning GSE to maintain service levels.

**Mixed Fleet Optimization:**
With the industry shift toward electric GSE (3,000+ electric units ordered globally in 2024-25), scheduling must account for:
- Battery state-of-charge and range limitations
- Charging station locations and availability
- Mixed fuel/electric fleet operations during transition periods
- Energy and emissions minimization alongside time objectives

**GSE Pooling:**
Rather than each ground handler maintaining a dedicated fleet, pooled GSE models allow airport-wide sharing. Benefits include:
- Economies of scale and fleet standardization
- Simplified maintenance and training
- Natural platform for introducing autonomous GSE under a single operating system
- Reduced total fleet size through improved utilization

---

## 6. Integration with World Model

### 6.1 Turnaround Phase as Context for Prediction

For an airside autonomous vehicle (AV), the aircraft turnaround phase is critical contextual information that fundamentally changes the prediction landscape:

**Phase-Dependent Scene Dynamics:**
- **Arrival phase**: High inbound traffic — marshalling vehicles, follow-me cars, arriving baggage trains approaching the stand. The AV must predict convergence patterns toward the assigned gate.
- **Unloading phase**: Belt loaders and cargo tractors active on the stand apron; passenger buses or jet bridge in use. GSE movement is concentrated and relatively predictable.
- **Servicing phase**: Maximum GSE density at stand — fuel truck, catering truck, water/lavatory vehicles, cleaning crews. The AV must navigate around a congested workspace with constrained sight lines.
- **Loading phase**: Renewed cargo tractor activity; passenger flow resuming. Vehicles begin departing the stand area.
- **Departure phase**: Rapid GSE withdrawal from safety zone, pushback tug positioning. High urgency movements with tight coordination requirements.

**World Model Implications:**
The world model should encode turnaround phase as a discrete latent variable that modulates:
- Expected agent density and types at each stand
- Typical motion patterns (arrival vs. departure flow directions)
- Urgency and right-of-way expectations (pushback tug has priority)
- No-go zones that change dynamically (safety perimeter enforcement)

### 6.2 Flight Schedule Priors

Flight schedules provide strong priors for the world model's prediction of future scene states:

**Structured Temporal Priors:**
- AODB flight schedule gives exact expected arrival/departure times for every gate
- Known aircraft type determines expected GSE ensemble and turnaround duration
- Schedule patterns are highly regular (same flights at same gates at same times daily)
- Delay propagation models predict how upstream delays cascade to local operations

**Multi-Scale Temporal Reasoning:**
- **Minutes-scale**: Which turnaround phase is active at each gate? What GSE movements are imminent?
- **Tens-of-minutes-scale**: When will the next aircraft arrive at an adjacent stand? How will apron traffic patterns shift?
- **Hours-scale**: What is the overall traffic density trend? Are we approaching a departure bank or arrival wave?

**Conditional Generation:**
The world model can condition its future scene predictions on flight schedule information:
```
P(scene_t+k | scene_t, flight_schedule, turnaround_phases)
```
This is substantially more informative than unconditional prediction. A world model that knows Flight BA117 is scheduled to push back from Gate B22 in 8 minutes can anticipate pushback tug approach, GSE withdrawal, and jet bridge retraction — even before observing these events.

### 6.3 Temporal Reasoning Architecture

**Hierarchical Temporal Model:**
The world model should maintain multiple temporal representations:

1. **Immediate horizon (0–10s)**: Physics-based motion prediction for all visible agents (vehicles, pedestrians, GSE). Standard BEV occupancy prediction and trajectory forecasting.

2. **Near horizon (10s–5min)**: Activity-conditioned prediction. Given the current turnaround phase, predict likely GSE arrivals/departures. Attention mechanisms over the turnaround activity graph.

3. **Planning horizon (5–60min)**: Schedule-conditioned prediction. Given the flight schedule and current state, predict the evolution of the operational scene. This enables proactive route planning that avoids future congestion.

**Graph-Based Turnaround Representation:**
Model the turnaround as a temporal activity graph where:
- Nodes represent turnaround sub-processes (deplaning, fueling, catering, etc.)
- Edges represent precedence and parallelism relationships
- Node states encode progress (not started / in progress / completed)
- Edge weights represent predicted transition times
- The graph evolves over time as milestones are reached

This turnaround graph can be encoded via a Graph Neural Network (GNN) and fused with the world model's spatial scene representation, providing structured temporal context that raw sensor data alone cannot capture.

**Delay Propagation Awareness:**
Spatiotemporal graph models (GAT-LSTM, STPN) from the aviation domain demonstrate how delays propagate across the airport network. The world model can incorporate these patterns to predict how a delayed arrival at one gate will cascade to affect adjacent gates, taxiways, and apron traffic patterns over the next hour.

---

## 7. Communication Infrastructure and Fleet Coordination

### 7.1 V2X for GSE Fleet

Vehicle-to-Everything (V2X) communication enables GSE vehicles and autonomous AVs to share position, speed, intent, and status with each other and with infrastructure. Two competing standards exist:

**DSRC (Dedicated Short-Range Communications)**
- IEEE 802.11p-based, operating at 5.9 GHz
- Range: 300–1,000 meters
- Latency: <10ms
- Designed for ad-hoc, distributed operation
- Well-suited for direct vehicle-to-vehicle (V2V) safety messages on the apron
- No cellular infrastructure dependency

**C-V2X (Cellular V2X)**
- 3GPP standard (LTE-V2X in Release 14, 5G NR-V2X in Release 16)
- Two interfaces: PC5 (direct short-range) and Uu (cellular network)
- PC5 provides DSRC-comparable latency for safety-critical V2V messages
- Uu interface leverages existing cellular infrastructure for V2N (vehicle-to-network) communication
- 5G NR C-V2X offers ultra-low latency (<5ms), high reliability (99.999%), and greater capacity

**Airport-Specific V2X Considerations:**
- Apron environment is geographically bounded — infrastructure can be purpose-built
- Mixed traffic: autonomous vehicles, human-driven GSE, pedestrians, aircraft
- Safety criticality: runway incursion prevention, pushback coordination
- Dense vehicle operations at stands require reliable short-range communication
- C-V2X PC5 mode is advantageous for direct GSE-to-GSE coordination without network dependency
- Hybrid DSRC/C-V2X architectures proposed for comprehensive coverage

### 7.2 5G/CBRS Airport Deployments

Citizens Broadband Radio Service (CBRS) in the 3.5 GHz band enables airports to deploy private 5G networks without licensed spectrum costs, providing dedicated, secure, low-latency connectivity for airside operations.

**Dallas Fort Worth International Airport (DFW)**
- 200+ access points deployed with private 5G backbone
- Supports asset tracking, autonomous vehicle trials, and digital twins
- Autonomous tugs, computer vision, and AI-driven maintenance deployed
- Completed three comprehensive proofs of concept in ramp, cargo, and terminal services before full buildout

**Purdue University Airport (Ericsson Partnership)**
- Private 5G network over CBRS deployed in collaboration with Ericsson and Saab
- Supports flight coordination, real-time security, drone detection, and autonomous ground equipment
- Reported up to 30% productivity gains with measurable safety improvements
- Serves as innovation hub for aviation technology testing

**Singapore Changi Airport (Nokia Partnership)**
- Nokia and Changi Airport Group partnered with M1 Limited for private 5G network (rolled out 2024)
- Supports autonomous ground vehicles, baggage handling systems, drone-based maintenance inspections
- Edge computing for predictive maintenance and real-time asset tracking
- Digital twin operations and intelligent maintenance
- First fleet of fully driverless autonomous tractors deployed following 5,000+ test trips
- Two autonomous tractors operational for baggage transfer between T1 and T4; fleet expanding to 24 by 2027

**Amsterdam Schiphol**
- Private 5G pilot supporting IoT-enabled predictive maintenance, smart baggage handling, and autonomous ground vehicles

**Los Angeles (LAX) — Lufthansa Cargo**
- Replaced Wi-Fi with private 5G to accelerate warehouse operations

**CBRS Technical Characteristics for Airport Use:**
- Supports connected assets, integrated real-time communication, digital load control
- Remote uploading/offloading of data
- Secure, dedicated spectrum avoiding interference from public cellular
- Sufficient bandwidth for video analytics, real-time tracking, and autonomous vehicle telemetry

### 7.3 Coordination Protocols

**Fleet Management System Architecture:**
A centralized fleet management system for airside autonomous vehicles typically includes:

1. **Central Coordinator**: Receives tasks from AODB/ground handler dispatch systems, runs optimization algorithms, and issues assignments to vehicles
2. **Vehicle Agents**: Each autonomous vehicle runs local perception, planning, and control; communicates position, status, and task progress to coordinator
3. **Infrastructure Layer**: Smart intersections, stand occupancy sensors, and ADS-B receivers provide situational awareness
4. **Communication Bus**: 5G/CBRS for reliable wide-area coverage; C-V2X PC5 for direct V2V safety messages; Wi-Fi 6E as backup

**Coordination Message Types:**
- **Task Assignment**: Central coordinator dispatches vehicle to specific stand for specific service
- **Position Broadcast**: Vehicles broadcast position, heading, speed at 10 Hz for collision avoidance
- **Intent Sharing**: Vehicles share planned trajectories for cooperative path planning
- **Status Updates**: Task progress (en route, arrived, servicing, complete) for schedule tracking
- **Emergency Stop**: Safety-critical broadcast for immediate halt of all vehicles in vicinity

### 7.4 Moonware, EVIE, and reference airside AV stack Integration

**Moonware HALO as Orchestration Layer:**
HALO's centralized coordination engine is architecturally positioned to serve as the dispatch and orchestration layer for autonomous GSE fleets. Its real-time task allocation, schedule integration, and timestamped activity tracking provide the command interface that autonomous vehicles require. Moonware's Phase 2 roadmap explicitly targets autonomous ramp services, leveraging HALO data to inform where autonomy augments operations.

**reference airside AV stack autonomous baggage/cargo tug:**
- All-electric autonomous baggage/cargo tractor combining tractor and dolly functions
- Unique sideways drive system enables rotation on the spot and lateral movement
- Bi-directional robotic arms for autonomous ULD loading/unloading
- Tested at six global airports including Changi, Schiphol, and CVG (Cincinnati)
- Partnership with Aviation Solutions for global commercialization
- IAG program commenced at Cincinnati/Northern Kentucky International Airport
- LiDAR, radar, and camera sensor suite for airside navigation
- Integration requires fleet management API for task receipt and status reporting

**EVIE Autonomous:**
- Electric modular chassis platform with multiple pod configurations (Airside Pod, Cargo Pod, Shuttle)
- LiDAR providing 360-degree view, real-time radar for velocity estimation, high-resolution cameras with AI object classification
- Designed to integrate with existing airport GSE, enabling retrofit of self-driving capability
- Cargo Pod handles aircraft brakes (baggage containers) and ULDs on a single platform
- Addresses airport staffing challenges with reliable autonomous airside operations

**Integration Architecture for Autonomous GSE Fleet:**

```
┌─────────────────────────────────────────────────────┐
│              AODB / Flight Schedule                  │
│        (Flight times, gate assignments, A-CDM)       │
└──────────────┬──────────────────────────┬───────────┘
               │                          │
               v                          v
┌──────────────────────┐   ┌──────────────────────────┐
│   Moonware HALO      │   │  Turnaround Prediction   │
│  Ground Traffic       │   │  (Cascaded GBRT, GNN,    │
│  Control Platform     │   │   Computer Vision)       │
│  - Task allocation    │◄──│  - Phase detection       │
│  - Crew dispatch      │   │  - TOBT prediction       │
│  - Schedule mgmt      │   │  - GSE timing forecast   │
└──────────┬───────────┘   └──────────────────────────┘
           │
           v
┌──────────────────────────────────────────────┐
│        Fleet Management / Dispatch            │
│  - JIT GSE assignment                         │
│  - Multi-vehicle routing (VRPTW)             │
│  - Conflict-free scheduling                   │
│  - Dynamic re-planning on delay              │
└──────┬──────────┬──────────┬─────────────────┘
       │          │          │
       v          v          v
┌──────────┐ ┌──────────┐ ┌──────────┐
│ reference airside AV stack  │ │  EVIE    │ │ Legacy   │
│ Auto-    │ │ Airside  │ │ Human-   │
│ DollyTug │ │ Pod      │ │ Driven   │
│          │ │          │ │ GSE      │
└──────────┘ └──────────┘ └──────────┘
       │          │          │
       └──────────┴──────────┘
                  │
           5G / C-V2X / CBRS
        (Position, status, intent)
```

**Key Integration Requirements:**
1. **Standardized Task API**: Common interface for receiving dispatch commands (go to stand X, perform service Y, report completion)
2. **Position and Status Telemetry**: Vehicles report location and task state via 5G/C-V2X at sufficient frequency for fleet-level optimization
3. **Safety Interlock**: Infrastructure-level safety system that can command emergency stops, enforce no-go zones, and manage aircraft safety perimeters
4. **Mixed Fleet Support**: Orchestration layer must handle both autonomous and human-driven vehicles during transition period
5. **A-CDM Feedback Loop**: Actual GSE arrival/service/departure times feed back into turnaround prediction models, improving future forecasts

---

## Summary and Implications for Airside AV World Models

Aircraft turnaround prediction and GSE fleet coordination represent a rich domain of structured temporal context that airside autonomous vehicles can leverage. The key insight is that airport operations are far more predictable than general road traffic — flights follow published schedules, turnarounds follow known sequences, and GSE movements are task-driven rather than free-form.

**For the world model specifically:**
- Turnaround phase should be encoded as a discrete context variable modulating scene predictions
- Flight schedules from AODB provide strong temporal priors over minutes-to-hours horizons
- A-CDM milestone data enables structured prediction of when specific GSE types will appear at specific locations
- Graph neural networks can model both the spatial structure of the apron and the temporal structure of turnaround operations
- Computer vision systems (Assaia ApronAI) provide ground-truth turnaround phase labels for training

**For fleet coordination:**
- JIT GSE dispatch requires tight integration between turnaround prediction and vehicle routing
- Multi-agent path planning with temporal constraints (VRPTW) is the core optimization problem
- Private 5G/CBRS networks provide the communication backbone for real-time fleet coordination
- Moonware HALO provides a proven orchestration architecture that bridges the gap between flight operations and vehicle dispatch
- The transition from human-driven to autonomous GSE (reference airside AV stack, EVIE) requires a software layer that can manage mixed fleets

The convergence of turnaround prediction ML, fleet coordination algorithms, private 5G infrastructure, and autonomous GSE platforms creates a complete stack for intelligent airside operations — one where the autonomous vehicle's world model is informed not just by what it sees, but by the structured operational context of the airport it operates within.

---

## References and Sources

### IATA Standards and Ground Operations
- [IATA Ground Ops Standards](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-ops-standards/)
- [IATA Airport Handling Manual (AHM)](https://www.iata.org/en/publications/manuals/airport-handling-manual/)
- [IATA Ground Operations Manual (IGOM)](https://www.iata.org/en/publications/manuals/iata-ground-operations-manual/)
- [IATA Ground Ops of the Future](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-ops-of-the-future/)
- [IATA Autonomous GSE Webinar](https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/on-demand-webinar-autonomous-gse-a--reality-on-the-ramp/)

### Turnaround Timing and Analysis
- [OAG: Formula One Science in Aircraft Turnarounds](https://www.oag.com/blog/science-aircraft-turnarounds)
- [Simple Flying: Narrowbody Ramp Activities and Turnaround Times](https://simpleflying.com/narrowbody-jets-ramp-activity-turnaround-time-guide/)
- [Simple Flying: Widebody Turnaround Times Analysis](https://simpleflying.com/widebody-aircraft-turnaround-times-analysis/)
- [Emirates A380 Turnaround Application](https://www.emirates.com/media-centre/emirates-develops-innovative-application-to-reduce-aircraft-turnaround-delays-at-dubai-hub/)
- [Key.Aero: Turning Around an A380 in 105 Minutes](https://www.key.aero/article/turning-around-a380-105-minutes)

### Turnaround Prediction Research
- [Cascaded Gradient Boosting for Turnaround Milestone Prediction (ScienceDirect, 2025)](https://www.sciencedirect.com/science/article/abs/pii/S096969972500105X)
- [Probabilistic Prediction of Aircraft Turnaround Time (SESAR, 2023)](https://www.sesarju.eu/sites/default/files/documents/sid/2023/Papers/SIDs_2023_paper_26%20final.pdf)
- [Turnaround Time Prediction via Time Transition Petri Net (PLOS ONE)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0305237)
- [Data-Driven Fusion of Turnaround Sub-Processes (ResearchGate)](https://www.researchgate.net/publication/363153261_Data-driven_fusion_of_turnaround_sub-processes_to_predict_aircraft_ground_time)
- [Agent-Based Simulation for Aircraft Stand Operations (TU Dresden)](https://tu-dresden.de/bu/verkehr/ila/ifl/ressourcen/dateien/professur/news/2021_DASC_Luo_Agent-based-simulation-for-aircraft-stand-operations.pdf)

### A-CDM and Airport Systems
- [Assaia: Can AI Make A-CDM Even Better?](https://www.assaia.com/resources/can-ai-make-a-cdm-even-better)
- [Assaia ApronAI](https://www.assaia.com/solutions/apron-ai)
- [SKYbrary: Airport Collaborative Decision Making](https://skybrary.aero/articles/airport-collaborative-decision-making-cdm)
- [Isarsoft: A-CDM Explained](https://www.isarsoft.com/knowledge-hub/a-cdm)
- [EUROCONTROL A-CDM Specification](https://www.eurocontrol.int/sites/default/files/2024-07/eurocontrol-draft-specification-acdm-ed1-0.pdf)
- [Amadeus Airport Operational Database](https://amadeus.com/en/airports/products/airport-operational-data-base-aodb)

### Graph Neural Networks and Delay Prediction
- [GAT-LSTM for Airport Throughput Prediction (Frontiers)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2022.884485/full)
- [Adaptive Airport Graph Neural Network (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0957417424018803)
- [Spatiotemporal Propagation Learning for Delay Prediction (arXiv)](https://arxiv.org/pdf/2207.06959)
- [GCN Imputation for Flight Ground Service Time (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S1568494622009905)

### Moonware
- [Moonware HALO Platform](https://moonware.com/halo/)
- [Moonware and IAG Partnership at JFK](https://moonware.com/moonware-iag-partnership-jfk/)
- [Moonware $7M Seed Round](https://moonware.com/blog/7-million-seed-round)
- [Moonware Master Plan: Bridge to Airfield Autonomy (Medium)](https://medium.com/moonware/the-bridge-to-airfield-autonomy-moonware-master-plan-bf2abf2a2fb0)
- [Moonware HALO and NOVA](https://moonware.com/blog/optimizing-commercial-and-military-airfield-operations)
- [Moonware Japan Airlines Tokyo Haneda (PR Newswire)](https://www.prnewswire.com/news-releases/moonware-to-test-ground-traffic-control-technology-with-japan-airlines-and-jal-ground-service-at-tokyo-international-airport-302499553.html)
- [TechCrunch: Moonware AI for Ground Crews](https://techcrunch.com/2023/08/03/moonwares-ai-lets-airfield-ground-crews-ditch-the-walkies/)

### GSE Fleet Coordination Research
- [Multi-Agent Task Allocation and Path Planning for Autonomous GSE (ScienceDirect, 2025)](https://www.sciencedirect.com/science/article/pii/S0969699725001188)
- [Multi-Agent Planning for Automated Ground Handling (ScienceDirect, 2023)](https://www.sciencedirect.com/science/article/pii/S0921889023001197)
- [Comprehensive Review of GSE Scheduling (Transportation Research Part E, 2025)](https://www.sciencedirect.com/science/article/abs/pii/S1366554525003825)
- [From Gate to Runway: Systematic Review of Ground Operations Optimization (2026)](https://www.sciencedirect.com/science/article/pii/S0969699726000499)
- [Bi-Objective Optimization for Electric GSE Scheduling (Springer, 2025)](https://link.springer.com/article/10.1007/s40747-025-01815-x)
- [Cooperative Scheduling Under Flight Uncertainty (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0360835222001620)
- [Multi-Strategy Cooperative Scheduling with Digital Twins (Nature, 2024)](https://www.nature.com/articles/s41598-024-66350-0)
- [GSE Pooling Blueprint (AiQ Consulting, 2025)](https://www.aiqconsulting.com/wp-content/uploads/2025/10/AiQ-Blueprint-for-Ground-Support-Equipment-Pooling-Oct-2025.pdf)

### Autonomous GSE Vehicles
- [EVIE Autonomous Airside Pod](https://evieautonomous.com/air-side/)
- [EVIE Technology](https://evieautonomous.com/technology/)
- [Changi Airport Autonomous Tractor Deployment (FTE, 2026)](https://www.futuretravelexperience.com/2026/01/changi-airport-deploys-autonomous-tractors-in-major-step-towards-airside-automation/)

### 5G/CBRS and V2X Communication
- [Ericsson: CBRS Private Networks in Airports](https://www.ericsson.com/en/blog/north-america/2022/cbrs-private-networks-airports)
- [Ericsson-Purdue 5G Aviation Innovation Hub](https://tecknexus.com/5g-network/private-5g-lte-and-cbrs-networks-in-action-transforming-industries/ericsson-purdue-and-saab-create-aviation-innovation-hub-with-private-5g/)
- [ACI: Airport 5G Update — Leveraging CBRS](https://airportscouncil.org/2023/06/09/airport-5g-update-leveraging-cbrs-for-smart-operations/)
- [NTT: Private 5G Networks for Airport Operations](https://services.global.ntt/en-us/insights/blog/cleared-for-takeoff-private-5g-networks-take-airport-operations-to-the-next-level)
- [C-V2X and DSRC Comparison (Autotalks)](https://auto-talks.com/technology/dsrc-vs-c-v2x/)
- [5G in Aviation Market Report (Emergen Research)](https://www.emergenresearch.com/industry-report/5g-in-aviation-market)

### ADS-B and Surface Surveillance
- [FAA ADS-B Airport Surface Surveillance Capability](https://www.faa.gov/air_traffic/technology/adsb/atc/assc)
- [Aireon Space-Based ADS-B](https://aireon.com/)
- [OpenSky Network](https://opensky-network.org/)

### World Models for Autonomous Driving
- [Survey of World Models for Autonomous Driving (arXiv, 2025)](https://arxiv.org/html/2501.11260v4)
- [World Models for Autonomous Driving: Initial Survey (arXiv)](https://arxiv.org/html/2403.02622v3)
- [DriveWorld: 4D Pre-trained Scene Understanding (CVPR 2024)](https://openaccess.thecvf.com/content/CVPR2024/papers/Min_DriveWorld_4D_Pre-trained_Scene_Understanding_via_World_Models_for_Autonomous_CVPR_2024_paper.pdf)
- [MARL for Autonomous Vehicles Survey (Springer, 2022)](https://link.springer.com/article/10.1007/s43684-022-00045-z)
