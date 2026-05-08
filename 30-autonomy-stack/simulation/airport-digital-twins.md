# Airport Digital Twin Platforms and Autonomous Vehicle Simulation

*Research compiled March 2026*

---

## 1. Existing Airport Digital Twin Platforms

### 1.1 SITA Digital Twin at Hamad International Airport (HIA)

Hamad International Airport launched its Digital Twin initiative in 2022 in partnership with SITA, making it one of the few airports in the world with a functioning, production-grade digital twin. The system provides a real-time 3D view of the airport through an intuitive interface, combining 3D modelling, data analytics, and artificial intelligence.

**Core capabilities:**
- Aircraft stand conflict management and resolution
- Effective alert response and monitoring of critical asset health
- Resource optimization to minimize asset downtime
- Intelligent recommendations via an analytical engine integrating data from multiple airport systems
- Real-time operational decision support

**Recognition:** Won "Smart Solution of the Year" at the Qatar IT Business Awards and "Most Innovative Airport Initiative Award" at FTE Innovate Awards.

**Architecture:** The SITA approach creates a unified operations interface. Their vision, demonstrated on an 86-inch touch-screen at a major U.S. East Coast airport, consolidates fragmented airport data into a single view. The roadmap includes forecasting (feeding flight schedules, weather, and operational metrics to predict congestion), resource optimization (automatically recommending gate shifts, staffing adjustments), and autonomous actions (triggering responses when thresholds are breached, such as dispatching custodial staff when satisfaction scores drop).

SITA's broader digital twin strategy positions the technology as the next-generation airport operations control interface, moving beyond traditional AOCC screens toward 3D-rendered, data-rich operational views.

### 1.2 Dassault Systemes 3DEXPERIENCE Airport Experience

Dassault Systemes offers the **Airport Experience** solution on its 3DEXPERIENCE platform, using what they brand as "Virtual Twin" technology (distinguishing it from static digital twins by emphasizing behavioral simulation).

**Platform capabilities:**
- Virtual twin of the entire airport: a digital replica of the physical airport and its behavior, with a 3D digital representation
- Scenario planning: simulate "what-if" scenarios and explore contingency strategies for future-proofing
- Airside operations modeling, ground handling coordination, passenger flow simulation
- Baggage handling optimization, gate management
- Crisis management and IROPS rehearsal
- Sustainability analysis and terminal design optimization

**Key differentiator:** The 3DEXPERIENCE platform is a collaboration-first approach. Multiple stakeholders (airlines, ground handlers, airport operators, security) can interact with the same virtual environment in real-time. The platform builds on Dassault's deep expertise in aerospace simulation (their Airbus partnership extends virtual twins to next-generation aircraft programs).

**Urban Air Mobility:** Urban-Air Port selected Dassault's 3DEXPERIENCE platform for global vertiport development, using the virtual twin for real-time infrastructure optimization and energy consumption modeling, a signal that the platform scales to new aviation infrastructure types.

**NVIDIA partnership:** Dassault and NVIDIA announced a partnership to build an industrial AI platform powering virtual twins, combining Dassault's simulation expertise with NVIDIA's GPU-accelerated rendering and physics.

### 1.3 Bentley iTwin

Bentley Systems' **iTwin Platform** is an open, scalable cloud platform for creating, visualizing, and analyzing digital twins of infrastructure assets, with strong airport-specific deployments.

**Key airport deployments:**

- **Sydney Airport (Maps@SYD):** Catalogued over 8,500 doors in the international terminal alone through GIS-enabled digital representations. Saved 12,395 hours per year (equivalent to ~7 full-time staff) through streamlined asset management. Uses historical and real-time data from multiple sources, allowing project managers to overlay environmental studies and operational information.

- **Guangzhou Baiyun International Airport:** Used 4D modeling and ProjectWise collaboration tools, achieving zero demolition or rework with a BIM model containing over 3 million components and a 25% jump in construction efficiency.

- **Seattle-Tacoma International Airport:** Used SYNCHRO 4D for construction simulation, achieving placement precision within three-eighths of an inch for the world's longest elevated pedestrian walkway.

**Technical architecture:**
- Built on open APIs and libraries purpose-made for digital twin applications
- Integrates BIM models, reality models (from LiDAR), IoT sensor data
- Web-based asset discovery: any staff member can find any asset (specific door, utility line) instantly
- Supports 4D construction visualization linking schedules to 3D models
- AI-powered infrastructure inspection (e.g., crack detection integrated with iTwin applications reducing manual fieldwork by 75%)

**Strength:** Bentley excels at the infrastructure and construction lifecycle. It is particularly strong for airports undergoing expansion or renovation, where maintaining a living digital twin through the design-build-operate continuum matters most.

### 1.4 Unity: Vancouver International Airport (YVR)

Vancouver International Airport built **the first-to-market real-time 3D digital twin of an airport in North America** using Unity's game engine, launched in 2021 by YVR's Innovation Hub.

**How it was built:**
- Existing CAD drawings were converted to Revit format, then imported into Unity
- 3D modeling firm GeoSims Cities refined terminal and airfield models
- Real-time operational data layered onto the 3D model
- "People-first" design philosophy ensuring frontline workers found the system intuitive

**Data sources integrated:**
- Flight data and schedules
- CATSA (Canadian Air Transport Security Authority) wait times
- High-fidelity camera imagery of the airfield and terminal
- LiDAR sensor data from air and ground transportation
- Maintenance work order systems

**Key tools:**
- **Situational Awareness Tool:** Bird's-eye view with real-time information summaries and anomaly alerts (e.g., curbside vehicle overstay detection from camera feeds)
- **Maintenance and Test Equipment (MTE):** Mobile access to work orders from within the digital twin
- **3D Explorer:** Interior and exterior terminal modeling for disaster preparation and evacuation planning

**Scale:** 200 airport operations staff use the runtime application; situational awareness extends to over 600 employees.

**Real-world impact:** During summer 2022's travel surge, YVR's guest experience team used the digital twin to coordinate measures relieving passenger congestion at security checkpoints. The airport also uses it to build a first-to-market calculation model tracking aircraft carbon emissions from landing to takeoff.

**Commercialization:** YVR and Unity signed an MOU to commercialize the Digital Twin platform, offering it to other airports worldwide.

### 1.5 NVIDIA Omniverse for Airport Simulation

NVIDIA Omniverse is not a single airport product but a collection of libraries and microservices for building physically accurate digital twins, with strong relevance to airport simulation.

**Core technology stack:**
- **OpenUSD (Universal Scene Description):** Open, extensible framework for describing, composing, simulating, and collaborating in 3D worlds. Serves as the foundational data format enabling interoperability across tools
- **NVIDIA PhysX and Warp:** GPU-accelerated physics libraries for scalable simulation and modeling
- **RTX rendering:** Physically-based, real-time rendering for generating sensor datasets at scale
- **Omniverse Sensor RTX:** APIs for rendering camera, radar, and lidar data for autonomy applications
- **NuRec (Neural Reconstruction):** APIs and tools for reconstructing high-fidelity digital twins from real-world fleet data using 3D Gaussian Splatting, then rendering sensor datasets from novel viewpoints
- **NuRec Fixer:** Transformer-based model that inpaints and resolves reconstruction artifacts for novel-view synthesis
- **Cosmos World Foundation Models:** Diffusion-based generative models for scene diversity (Cosmos Transfer for scene variation, Cosmos Reason for spatial understanding, Cosmos Predict for future state forecasting)

**Rendering quality:** Omniverse achieves photorealistic rendering through RTX ray tracing. Material properties are applied to ensure the environment interacts with light rays, radio waves, and lidar rays identically to how real sensors interact with the physical world. The system supports HDR rendering with lens-accurate camera models.

**Physics engine:** PhysX provides rigid body dynamics, vehicle dynamics models, collision detection. NVIDIA DRIVE Sim (built on Omniverse) handles vehicle models using a plugin system with included PhysX models or third-party vehicle dynamics models.

**Industrial digital twin deployments** (non-airport but architecturally relevant):
- BMW Group: digital twins of factories for greenfield planning (up to 30% efficiency gains)
- Siemens Teamcenter Digital Reality Viewer for photorealistic digital twin collaboration
- Rockwell Automation Emulate3D: physics-based digital twins for automation simulation
- Amazon Devices & Services: training robotic systems via digital twins

**Airport relevance:** While NVIDIA has not announced a dedicated airport digital twin product, the Omniverse stack is the most technically capable platform for building one. The combination of OpenUSD interoperability, PhysX physics, RTX sensor simulation, and NuRec neural reconstruction provides all the building blocks needed for a high-fidelity airport digital twin suitable for AV testing.

---

## 2. Autonoma AutoVerse

### 2.1 Overview

Autonoma, based in Auburn, Alabama, has built **AutoVerse**, the only digital twin platform purpose-built for airside operations. Founded by CEO Will Bryan, the company positions AutoVerse not as a visualization tool but as a **validation layer** where AI-driven decisions can be tested, stressed, and compared against reality before live deployment.

### 2.2 Architecture and How It Works

AutoVerse is a high-fidelity, three-dimensional simulation of complex airport environments that:
- Ingests both historical and live data from sensors, aircraft, and ground vehicles
- Creates a photorealistic, physics-accurate replica of the airfield
- Enables operators to run hundreds or thousands of scenarios and compare outcomes before committing to a plan
- Continuously tightens variance accuracy by comparing simulated predictions to actual outcomes

The platform supports **procedural scene generation** for creating scenario-rich environments with diverse weather conditions, traffic patterns, and edge cases. A feature called **Copilot** enables non-technical users to interact with and modify complex environments using natural-language commands.

**Key distinction (per Bryan):** "This isn't drone footage. This isn't real?" -- emphasizing that AutoVerse is software-based simulation grounded in real physics, weather, geometry, and operational constraints, not just video flythrough.

### 2.3 Core Use Cases

| Use Case | Description |
|----------|-------------|
| **Airside Operations Planning** | Run tomorrow's full schedule in simulation today; test gate assignments, vehicle routing, equipment staging |
| **Turnaround Optimization** | Simulate full arrival-to-pushback turnaround: fueling, catering, baggage, ground services coordination |
| **Surge & Event Readiness** | Model realistic traffic volumes, identify bottlenecks before major events or seasonal peaks |
| **Capital Projects** | Simulate impact of construction on live operations; test phased construction scenarios alongside active operations |
| **Safety & IROPS** | Rehearse safety-critical and irregular operations scenarios impossible to test in reality |
| **Autonomous Systems** | Safe, scalable testing for autonomous airside vehicle technology, including LiDAR integration simulation |

### 2.4 Customers

- **Delta Air Lines:** Full airport simulation integrating Delta's live and historical data. Addresses ground-level delays (gates, crews, service vehicles) that cascade through flight operations. (Delta operates at ~60% on-time performance, with many delays originating on the ramp.)
- **US Air Force and US Navy:** Defense applications where validation and consequence management are equally critical
- **Cisco, Auburn University, Technical University of Munich:** Research partnerships
- **Augusta Regional Airport:** Smaller airport deployment

A research lead from Technical University of Munich stated: "We gathered more high-quality data in the first day than in months" of traditional testing.

### 2.5 Competitive Position

AutoVerse is the only simulation platform that combines:
1. Airport-specific domain knowledge (turnaround workflows, GSE routing, stand allocation)
2. High-fidelity 3D simulation with physics
3. Integration of live and historical operational data
4. Validation-first design (predicting outcomes and measuring variance against reality)

This makes it directly relevant as a validation platform for autonomous airside vehicles, where running thousands of simulated scenarios is the only safe path to regulatory acceptance.

---

## 3. Airlines and Airports Using Digital Twins for Turnaround Optimization

### 3.1 The Turnaround Problem

Aircraft turnaround encompasses nearly 20 ground service segments: boarding-bridge connection, cabin cleaning, refueling, catering replenishment, baggage loading/unloading, water servicing, lavatory servicing, pushback, and more. These operations are the primary source of controllable delays. Research shows that compared to manually coordinated operations, **automated turnaround operations using digital twin technology can reduce single-flight turnaround time by approximately 24.53%**.

### 3.2 Aberdeen International Airport (FIWARE Architecture)

A validated digital twin architecture at Aberdeen International Airport uses FIWARE Generic Enablers and NGSI-LD (Next Generation Service Interfaces-Linked Data) standards.

**Architecture:**
- **Context Broker (Orion-LD):** Central piece managing entity lifecycle (updates, queries, registrations, subscriptions) via publish-subscribe
- **Draco GE:** Data transformation from heterogeneous sources into NGSI-LD compliance, with configurable processors
- **Data sources:** Azinq Chroma API (REST-based, 1-minute polling), Plane Finder (TCP socket with TLS 1.2)
- **Storage:** MongoDB for historical data supporting future ML applications

**Data models (FIWARE SmartAeronautics domain):**
- Flight model: scheduling, state, passenger counts, turnaround timings (Off-Block Time, Take-Off Time, Landing Time, In-Block Time)
- Aircraft model: position, speed, heading, registration
- FlightNotification model: event logging with task states
- Supporting entities: AircraftModel, Airline, Airport

**Visualization:** Web-based platform using Babylon.js rendering with live updates via Context Broker subscriptions, plus a dispatcher mobile application with Gantt diagrams and task-specific screens (designed through 5 participatory sessions with 7 airport stakeholders).

### 3.3 Amsterdam Schiphol Airport (Agent-Based Model)

A high-fidelity digital twin developed for Schiphol enables simulation of entire aircraft ground handling activities over a full day. All stakeholders and decision units are represented as agents:
- Aircraft agents with arrival/departure schedules
- Parking stand agents with capacity and type constraints
- GSE agents (fuel trucks, catering vehicles, baggage carts, pushback tugs)
- Ground handler agents performing specific activities
- Each agent performs activities aligned with collaborative decision-making objectives

This agent-based approach enables testing of scheduling changes, resource allocation strategies, and the impact of delayed arrivals on downstream operations.

### 3.4 Motional Digital Twin for Airports

Motional Digital Twins are real-time digital representations of the airport environment that track the movement of people, equipment, and aircraft, processing live spatial data from 3D sensors such as LiDAR. These twins improve flow efficiency and non-aeronautical performance by providing visibility into actual movement patterns versus assumed patterns.

### 3.5 AWS Reference Architecture

AWS provides a reference architecture for building airport digital twins that integrates:
- **IoT Core** for device connectivity, **IoT Greengrass** for edge ML processing
- **AWS Panorama** for deploying ML models on cameras for local inference
- **Kinesis Data Streams** for real-time data flows
- **IoT TwinMaker** with prebuilt templates for digital twin creation
- **SageMaker** for predictive maintenance modeling

Use cases covered: passenger flow monitoring, baggage handling optimization, predictive maintenance, movable asset tracking, aircraft turnaround acceleration, and building management system integration.

---

## 4. NVIDIA Omniverse for Airport Simulation (Deep Dive)

### 4.1 OpenUSD as the Foundation

Universal Scene Description (OpenUSD) is the open standard that makes Omniverse digital twins interoperable and scalable. Originally developed by Pixar for film production, OpenUSD has been adopted as the lingua franca of industrial digital twins.

**Why OpenUSD matters for airport digital twins:**
- Compose scenes from multiple data sources (BIM models, LiDAR scans, CAD files, IoT feeds) into a single coherent scene graph
- Non-destructive layering: operational data, sensor feeds, simulation states can overlay the base geometry without modifying it
- Extensible schemas for custom airport-specific data (flight status, stand allocation, GSE positions)
- The Alliance for OpenUSD (AOUSD) now includes Siemens, Accenture, Esri, PTC, and Renault, signaling broad industry adoption

### 4.2 Physics Engine

- **NVIDIA PhysX:** Rigid body dynamics, collision detection, vehicle dynamics. Supports plugin-based vehicle models allowing third-party dynamics integrations
- **NVIDIA Warp:** Python-based GPU simulation framework for custom physics (fluid dynamics, soft body, cloth)
- **MuJoCo bridge:** New software bridges connect MuJoCo physics engine to OpenUSD, enabling over 250,000 robot learning developers to simulate across platforms

### 4.3 Rendering Quality

- **RTX ray tracing:** Physically accurate light transport including global illumination, reflections, refractions, and shadows
- **Material fidelity:** Materials interact with light rays, radio waves, and lidar rays identically to real-world sensor interactions
- **HDR pipeline:** Camera rendering starts with HDR images warped according to lens properties of the specific camera model
- **Real-time performance:** GPU-accelerated rendering enables interactive framerates even for complex scenes
- **1,200x faster simulations** compared to traditional approaches when using NVIDIA acceleration libraries with physics-AI frameworks

### 4.4 Sensor Simulation for AV Testing

NVIDIA DRIVE Sim (built on Omniverse) provides the most mature sensor simulation pipeline:

- **Camera sensors:** HDR image rendering with lens-accurate warping, rolling shutter modeling, exposure simulation
- **LiDAR sensors:** Physically based ray-traced lidar using RTX GPUs in real time. Neural lidar fields use neural rendering to simulate realistic lidar scans from novel viewpoints, accurately reproducing beam divergence, secondary returns, and ray dropping
- **Radar sensors:** Physically based radar simulation using ray tracing with material-aware reflections
- **Ansys integration:** AVxcelerate Sensors augments DRIVE Sim with predictively accurate physics solvers for camera, lidar, and radar

### 4.5 Neural Reconstruction (NuRec)

The NuRec pipeline enables creating digital twins directly from sensor data:

1. **Data preparation:** Sensor data standardization across different vehicle platforms
2. **3D reconstruction:** Using Gaussian Splatting representations from fleet data
3. **Rendering:** Gaussian-based rendering with ray tracing for simulation integration
4. **Artifact correction:** NuRec Fixer (transformer-based) inpaints reconstruction gaps
5. **Scene variation:** Cosmos Transfer generates weather, lighting, and environmental variations from text prompts

This pipeline is directly applicable to airport environments: capture LiDAR and camera data from a vehicle traversing the ramp, reconstruct a Gaussian Splat digital twin, then simulate autonomous operations within it.

---

## 5. Building an Airport Digital Twin from LiDAR Scans

### 5.1 Pipeline: PCD to Interactive Environment

The typical pipeline from raw LiDAR point cloud data to an interactive digital twin follows several paths:

**Path A: Point Cloud to Mesh (Traditional)**
1. **Acquisition:** Terrestrial/mobile LiDAR scanning of airfield, terminal, and surrounding infrastructure
2. **Registration:** Align multiple scans using ICP (Iterative Closest Point) or feature-based registration (e.g., Autodesk ReCap)
3. **Surface reconstruction:** Poisson Reconstruction (smooth, continuous surfaces) or Delaunay Triangulation (faster, simpler geometries)
4. **Mesh refinement:** Edge-stitching, hole-filling, and geometric consistency checks
5. **Texturing:** Project camera imagery onto mesh surfaces
6. **Import into engine:** Load textured mesh into Unity, Unreal Engine, or Omniverse via FBX/USD
7. **Add operational data layers:** IoT feeds, flight data, GSE positions

**Path B: Point Cloud to 3D Gaussian Splatting (Neural)**
1. **Acquisition:** LiDAR + camera data capture (vehicle-mounted or drone-based)
2. **SfM processing:** Structure from Motion (COLMAP) generates initial point clouds and camera poses
3. **LiDAR-assisted initialization:** Li-GS method uses dynamic voxel filtering to downsample distinct point cloud regions based on image feature distribution
4. **Gaussian optimization:** Iterative refinement of Gaussian positions, sizes, and colors comparing rendered views against photographs
5. **Depth regularization:** LiDGS approach introduces geometric anchors and adaptive Gaussian densification for accurate large-scale reconstruction
6. **Result:** Millions of refined Gaussians achieving photorealistic rendering at real-time framerates

**Path C: Hybrid LiDAR + Camera Fusion**
- Novel UAV-based approaches achieve 31.25% improvement in geometric accuracy with PSNR exceeding 30 dB
- Direct LiDAR-supervised surface-aligned 3DGS constrains Gaussian positions and shapes without converting LiDAR to depth maps
- Multi-view depth-guided pruning strategies ensure geometric consistency

### 5.2 Accuracy Benchmarks

| Environment | Method | Mean Error | Std Dev |
|------------|--------|------------|---------|
| Medium-scale (100 m2) | 3DGS from professional LiDAR | 3.49 cm | 5.6 cm |
| Large object (4.7 m) | 3DGS from professional LiDAR | 1.32 cm | 2.5 cm |
| Large-scale facility (5000 m2) | 3DGS from professional LiDAR | 7.82 cm | 11.49 cm |
| Medium-scale (100 m2) | iPhone 12 Pro LiDAR | 7.01 cm | -- |

For airside operations, the 7-12 cm accuracy at large scale is sufficient for vehicle routing and operational simulation but may require supplementation for precision docking or automated bridge alignment scenarios.

### 5.3 Practical Considerations for Airport Environments

- **Security restrictions:** Airside scanning requires coordination with airport security and regulatory bodies (TSA/CAA equivalent)
- **Scale:** A typical medium airport ramp area is 500,000+ m2, requiring systematic scanning campaigns
- **Dynamic elements:** Scanning must account for or exclude aircraft, GSE, and personnel (which will be added as dynamic agents later)
- **Surface materials:** Concrete, asphalt, glass, and metal surfaces have varying reconstruction quality; reflective surfaces degrade 3DGS accuracy
- **Temporal updates:** The physical environment changes with construction, seasonal variation, and equipment changes; re-scanning cadence must be planned

---

## 6. Real-Time Digital Twin vs. Offline Digital Twin

### 6.1 Fundamental Distinction

| Dimension | Real-Time Digital Twin | Offline Digital Twin |
|-----------|----------------------|---------------------|
| **Data processing** | Streaming telemetry analyzed as it flows in | Data collected, stored, analyzed later |
| **Model currency** | Evolves continuously with physical counterpart | Accurate at one point, potentially obsolete next |
| **Actionability** | Immediate action (e.g., reroute GSE, reassign gate) | Retrospective analysis, planning |
| **Architecture** | In-memory computing, event-driven, pub-sub | Batch processing, data warehouse |
| **Latency** | Sub-second to seconds | Minutes to hours |
| **Use cases** | Operational control, anomaly detection, live optimization | Scenario planning, design validation, training |
| **Cost** | Higher (streaming infrastructure, real-time compute) | Lower (batch compute, storage-centric) |

### 6.2 For Airport AV Testing

Both modes serve distinct purposes:

**Real-time mode** is essential for:
- Live monitoring of autonomous vehicle operations on the ramp
- Immediate intervention if AV behavior deviates from expected patterns
- Real-time traffic deconfliction between autonomous and manual vehicles
- Streaming sensor fusion validation (comparing digital twin state to AV perception)

**Offline mode** is essential for:
- Scenario generation and replay for edge case testing
- Training perception and planning models on diverse conditions
- Regulatory validation (demonstrating safety across thousands of simulated hours)
- Design iteration on AV behavior policies before deployment

The most effective approach combines both: an offline digital twin for development and validation, with a real-time twin for operational monitoring once AVs are deployed.

### 6.3 Integration with A-CDM/AODB for Live Operational State

**Airport Collaborative Decision Making (A-CDM)** and the **Airport Operational Database (AODB)** are the backbone of real-time airport operations data.

**AODB** is the central repository for all operative systems, providing flight-related data in real-time. It integrates:
- Flight schedules and actual times (SIBT, SOBT, AIBT, AOBT)
- Gate and stand assignments
- Airline operational data
- Ground handler schedules
- Baggage system status

**A-CDM** layer provides collaborative situational awareness:
- Milestone approach tracking (from initial flight plan to off-block time)
- Target times for each turnaround milestone
- Collaborative updates from airlines, ground handlers, ATC, and airport operations
- ADS-B integration for aircraft position tracking
- Surface movement radar data

**Integration architecture for a live airport digital twin:**
1. AODB provides the flight schedule backbone and real-time flight status updates
2. A-CDM provides milestone events and collaborative updates
3. ADS-B and surface radar provide aircraft position and movement
4. IoT sensors (cameras, LiDAR) provide GSE and personnel positions
5. FIDS (Flight Information Display System) provides passenger-facing status
6. BMS (Building Management System) provides facility status

The digital twin consumes these feeds through standardized interfaces (ACRIS Semantic Model, SWIM, or custom APIs) and renders the live airport state in 3D, providing the operational context that autonomous vehicles need to understand their environment.

---

## 7. 3DGS vs. NeRF vs. Mesh-Based Digital Twins for AV Testing

### 7.1 Comparison Matrix

| Dimension | 3D Gaussian Splatting | NeRF | Traditional Mesh |
|-----------|----------------------|------|-----------------|
| **Rendering speed** | 100+ FPS real-time | ~5 FPS (too slow for real-time) | 60+ FPS (engine-dependent) |
| **Training time** | Minutes to hours | Hours to days | N/A (manual creation: weeks/months) |
| **Visual quality** | Photorealistic (near NeRF quality) | Highest photorealism | Variable (depends on artist skill and texture quality) |
| **Storage/file size** | Compact point-based | Very compact (network weights) | Large (geometry + textures) |
| **Editability** | Limited (Gaussian manipulation is unintuitive) | Very limited (implicit representation) | Excellent (mature tooling for sculpting, rigging, animation) |
| **Relighting** | Not supported (lighting baked into spherical harmonics) | Not supported (lighting baked) | Fully supported (dynamic lighting, PBR materials) |
| **Dynamic objects** | Emerging (3DTGS, DrivingGaussian, MaGS) | Limited research (D-NeRF) | Mature (skeletal animation, physics-driven) |
| **Sensor simulation** | Camera: excellent; LiDAR: emerging (SplatAD) | Camera: good; LiDAR: emerging | Camera: good; LiDAR: good (ray-traced) |
| **Scene scale** | Challenging at very large scale (artifacts increase) | Poor at large scale | Scales well with LOD systems |
| **Creation from data** | Automated from photos/LiDAR | Automated from photos | Manual or semi-automated from LiDAR/photogrammetry |

### 7.2 SplatAD: State-of-the-Art for AV Sensor Simulation

SplatAD (CVPR 2025) is the first 3DGS-based method for realistic, real-time rendering of dynamic autonomous driving scenes for both camera and lidar data.

**Technical innovations:**
- Models rolling shutter effects for lidar (each sweep takes ~100 ms during which ego moves several meters)
- Simulates lidar intensity and ray dropouts
- Handles 360-degree lidar views (unlike cameras which capture dense, regularly spaced pixels)

**Performance:** +2 PSNR for novel view synthesis, +3 PSNR for reconstruction versus NeRF baselines, with an order of magnitude faster rendering.

### 7.3 GSAVS: Gaussian Splatting AV Simulator

GSAVS integrates 3DGS assets within Unity, using Gaussians for photorealistic rendering and the classical 3D engine for physics, collision detection, and agent control.

**Performance benchmarks:**

| Scene | FPS | GPU Usage | VRAM |
|-------|-----|-----------|------|
| Small scene (straight) | 28 | 36.3% | 25.2% |
| Large scene (turn) | 25 | 41.4% | 31.3% |
| With dynamic agents | 30 | 38.6% | 28.6% |

Doubling drivable area increased GPU usage only ~5%, demonstrating 3DGS efficiency. RL training across 250,000 episodes achieved 86% accuracy on straight-line driving, 68% on turns, and 81% on obstacle avoidance.

**Current limitation:** No LiDAR simulation due to 3DGS reconstruction errors. Future work requires methods like Li-GS (incorporating depth data) for sensor fusion.

### 7.4 Recommendations for Airport AV Testing

**For development and perception training:** Use 3DGS (fast iteration, photorealistic, automated creation from sensor data). The SplatAD approach provides both camera and lidar simulation in a single framework.

**For physics simulation and planning validation:** Use mesh-based environments (mature physics engines, dynamic lighting for testing varied conditions, robust collision detection).

**For production simulation platform:** Use a hybrid approach:
- Mesh-based static infrastructure (terminal buildings, taxiways, runway geometry) with PBR materials for relighting
- 3DGS for photorealistic background rendering and visual context
- Mesh-based dynamic agents (aircraft, GSE, personnel) with physics-driven animation
- This is essentially the GSAVS approach: 3DGS for visual fidelity, game engine for physics and control

**For regulatory validation:** Mesh-based remains safer because it is fully controllable, editable, and deterministic. Regulators may question the reproducibility of neural-rendered scenarios.

---

## 8. Inserting Dynamic Agents into the Digital Twin

### 8.1 Agent Types for Airport Airside Simulation

Effective airside AV testing requires populating the digital twin with:

- **Aircraft:** Taxiing, parking, pushback operations. Must model wingspan variations (from CRJ-200 to A380), taxi speeds, pushback trajectories, engine blast zones
- **Ground Service Equipment (GSE):** Baggage tractors, belt loaders, fuel trucks, catering trucks, lavatory trucks, potable water trucks, ground power units, pushback tugs, de-icing trucks, crew stairs
- **Personnel:** Ramp agents, wing walkers, marshallers, fueling operators, airline ground staff. Must model FOD walk patterns, safety zone awareness
- **Other vehicles:** Follow-me cars, airport operations vehicles, emergency vehicles, snow removal equipment

### 8.2 Agent Modeling Approaches

**Rule-based agents:** Pre-programmed behaviors following airport SOPs (Standard Operating Procedures). Each GSE follows defined routes from staging areas to assigned stands, performs its service task for a calibrated duration, then returns. This is the approach used in the Schiphol agent-based model.

**Data-driven behavioral models:** ML behavior agents generating realistic outcomes and controllable scenario variation. Applied Intuition's Neural Sim uses this approach, where dynamic actors preserve their original observed behaviors from drive logs. NVIDIA's partnership with Inverted AI provides behavioral conditioning for agent traffic models.

**Multi-strategy cooperative scheduling:** Research at Chinese airports has modeled airport specialized vehicles using digital twin-based cooperative scheduling algorithms, optimizing dispatching of fuel trucks, catering vehicles, and baggage carts simultaneously to minimize turnaround time and reduce conflicts.

**Aurrigo Auto-Sim:** Aurrigo (maker of autonomous GSE) developed Auto-Sim 3D digital twin software that specifically simulates how an airport operates with autonomous vehicles added to the existing mix of manual equipment and personnel, validating autonomous behavior before deployment.

### 8.3 Scenario Generation for Edge Cases

Critical scenarios for airside AV testing that require dynamic agents:

- FOD on taxiway during autonomous baggage tractor transit
- Pushback tug crossing path of autonomous vehicle
- Personnel walking unexpectedly into vehicle path
- Aircraft arriving at wrong stand requiring re-routing of all GSE
- Weather degradation (fog, rain, snow) reducing sensor visibility
- Multiple vehicles converging at stand simultaneously during quick-turn
- Emergency vehicle right-of-way during active ramp operations
- Night operations with reduced lighting
- Construction zone navigation with temporary barriers

---

## 9. Applied Intuition's Neural Sim and Airport Digital Twins

### 9.1 How Neural Sim Works

Applied Intuition's Neural Sim is an AI-powered simulator providing scalable, realistic, closed-loop simulation for ADAS and autonomous driving systems.

**Core pipeline:**
1. **Data ingestion:** Raw fleet drive logs are collected from vehicles
2. **Neural reconstruction:** Automated AI pipelines convert drive logs into dynamic, photorealistic 3D environments in hours (not weeks). Uses radiance fields and Gaussian Splatting for visual fidelity
3. **Static and dynamic reconstruction:** Models both static infrastructure (trees, buildings) and dynamic actors (vehicles, cyclists, pedestrians), preserving original observed behaviors
4. **Sensor simulation:** Generates true-to-life camera, lidar, and radar data from the reconstructed environment
5. **Closed-loop execution:** Unlike open-loop log replay, the system under test can modify ego pose while the simulator renders valid sensor data from the new viewpoint
6. **Scale:** Thousands of neural simulations run daily; engineers can queue entire datasets of old logs for automated processing

**Key advantage over traditional approaches:**
- Log playback: perfect realism but no closed-loop capability
- Synthetic simulation: closed-loop but requires manual environment creation
- Neural Sim: closed-loop AND automated creation from real data

**Realism evaluation framework:** Automatically computed metrics for scene reconstruction accuracy, lighting consistency, and dynamic agent realism, supporting both iterative development and regulatory compliance.

### 9.2 Relevance to Airport Digital Twins

Neural Sim was designed for on-road autonomous driving, not airports. However, the core technology is directly transferable:

**What transfers directly:**
- Neural reconstruction from sensor data (a vehicle driving across the ramp captures the same type of data as one driving on roads)
- Closed-loop sensor simulation (the ego vehicle is an autonomous GSE or baggage tractor instead of a car)
- Dynamic agent modeling (aircraft and GSE replace cars and pedestrians)
- Automated pipeline from drive logs to simulation scenarios

**What would need adaptation:**
- Agent behavioral models would need to be retrained on airport-specific behaviors (pushback trajectories, GSE routing patterns, marshalling signals)
- Sensor configurations differ (airport AVs may use different sensor suites than passenger cars)
- Scenario definitions are airport-specific (turnaround sequences, stand allocation, taxiway right-of-way rules)
- The operational domain is fundamentally different (structured but unpredictable ramp environment vs. public roads)

**Strategic implication:** An airport AV company could either (a) license Neural Sim and adapt it with airport-specific data and behavioral models, or (b) build a similar pipeline using open-source components (NVIDIA NuRec for reconstruction, CARLA for simulation, custom behavioral models for airport agents). The former is faster but creates vendor dependency; the latter provides more control but requires deeper engineering investment.

---

## 10. Cost and Timeline to Build an Airport Digital Twin

### 10.1 Cost Ranges

| Scale | Cost Range | Scope |
|-------|-----------|-------|
| **Pilot / POC** | $50,000 - $100,000 | Single asset or process (e.g., one terminal gate area, one turnaround workflow) |
| **Departmental** | $100,000 - $500,000 | Multiple assets or departments with system integration; IoT sensors, ERP, and platform connections |
| **Enterprise-wide** | $500,000 - $2,000,000+ | Full airport integration across facilities; deep customization, advanced analytics |
| **Full 3D + Operations** | $1,200,000 - $4,200,000+ | Complete 3D digital twin with operational data integration (extrapolated from commercial building costs: $2/sqft for Grade A office at 600K sqft = $1.2M) |

**Airport-specific cost drivers:**
- **LiDAR scanning:** $50,000 - $200,000 for comprehensive airside and terminal scanning (depends on airport size)
- **3D modeling and reconstruction:** $100,000 - $500,000 for converting scans to usable 3D models
- **Data integration:** $100,000 - $300,000 for connecting AODB, A-CDM, BMS, IoT sensors
- **Platform licensing:** $50,000 - $200,000/year for commercial platforms (Bentley iTwin, Dassault 3DEXPERIENCE, Unity Industry)
- **Custom development:** $200,000 - $1,000,000 for airport-specific features, dashboards, and workflows
- **Hardware:** $50,000 - $200,000 for display systems, edge computing, GPU servers

### 10.2 Hidden and Ongoing Costs

- Data migration from legacy systems
- Employee training and change management
- System downtime during integration
- Scaling expenses as scope expands
- Annual platform licensing and cloud compute
- Re-scanning and model updates (recommended annually or after major construction)
- Maintenance and support (estimated 15-20% of initial build cost annually)

### 10.3 Timeline Estimates

| Phase | Duration | Activities |
|-------|----------|------------|
| **Discovery & planning** | 2-3 months | Requirements gathering, vendor selection, data audit, security clearances |
| **Data acquisition** | 1-3 months | LiDAR scanning, photogrammetry, system integration mapping |
| **3D model creation** | 2-4 months | Point cloud processing, mesh/3DGS reconstruction, texturing |
| **Platform development** | 3-6 months | Data integration, visualization, analytics, custom features |
| **Testing & validation** | 1-2 months | Accuracy validation, user acceptance testing, security audit |
| **Deployment & training** | 1-2 months | Rollout, staff training, operational handoff |
| **Total (pilot)** | 4-6 months | Single-area deployment |
| **Total (enterprise)** | 12-24 months | Full airport deployment |

### 10.4 ROI Indicators

- Sydney Airport: 12,395 hours saved per year (~7 FTE equivalent)
- Guangzhou Baiyun: zero demolition or rework, 25% construction efficiency improvement
- Turnaround optimization: up to 24.53% reduction in single-flight turnaround time
- Average payback period: 6.3 years assuming 10% savings in operational costs
- Benesch (infrastructure firm): 75% reduction in manual fieldwork using AI-powered inspection integrated with iTwin

### 10.5 ACRP Research Finding

The Airport Cooperative Research Program (ACRP) classifies airport digital twins at an **intermediate transformation tier**, meaning airports have process improvement experience but lack widespread deployment knowledge and real-world implementation data. This suggests the technology is past early adoption but not yet standardized, meaning costs and timelines remain variable and dependent on organizational maturity.

---

## 11. Summary: Landscape Map

| Platform | Primary Focus | AV Testing Suitability | Maturity |
|----------|--------------|----------------------|----------|
| **SITA (HIA)** | Operations control, asset management | Low (no physics/sensor sim) | Production |
| **Dassault 3DEXPERIENCE** | Full airport lifecycle, passenger experience | Medium (simulation capable, not AV-specific) | Production |
| **Bentley iTwin** | Infrastructure, construction, asset management | Low (infrastructure-focused, no simulation) | Production |
| **Unity (YVR)** | Real-time operations, situational awareness | Medium (game engine capable of physics/rendering) | Production |
| **NVIDIA Omniverse** | Physics-accurate simulation, sensor rendering | Very High (purpose-built for physical AI) | Platform (build-your-own) |
| **Autonoma AutoVerse** | Airside operations validation, AV testing | Very High (purpose-built for airside) | Growth stage |
| **Applied Intuition Neural Sim** | On-road AV validation | High (adaptable to airport domain) | Production (road); unproven (airport) |

For autonomous vehicle simulation on the airport ramp, the most relevant platforms are **Autonoma AutoVerse** (purpose-built for the domain), **NVIDIA Omniverse** (the most technically capable platform for building custom airport AV simulation), and **Applied Intuition Neural Sim** (the most mature neural reconstruction pipeline, adaptable from roads to ramps).

---

## Sources

- [HIA Digital Twin Initiative](https://dohahamadairport.com/press-releases/news/hamad-international-airport-launches-digital-twin-initiative)
- [HIA Digital Twin Award](https://www.gulf-times.com/article/663313/business/hia-wins-most-innovative-airport-initiative-award-for-digital-twin-technology)
- [SITA Digital Twin Blog](https://www.sita.aero/pressroom/blog/digital-twins-the-airport-operations-control-interface-of-the-future/)
- [Dassault Airport Experience](https://discover.3ds.com/transform-airport-operations)
- [Dassault Airport Resiliency Virtual Twin](https://blog.3ds.com/brands/3dexcite/innovating-through-crisis-airport-resiliency-with-the-virtual-twin/)
- [Dassault-NVIDIA Partnership](https://nvidianews.nvidia.com/news/dassault-systemes-nvidia-industrial-ai)
- [Bentley iTwin Platform](https://www.bentley.com/software/itwin-platform/)
- [Bentley Airport Digital Twins Blog](https://blog.bentley.com/software/digital-transformation-in-airports-improving-efficiency-and-passenger-experience/)
- [Bentley Airport Digital Twins Overview](https://web.bentley.com/cities-airport-digital-twins-1786.html)
- [Unity YVR Case Study](https://unity.com/case-study/vancouver-airport-authority)
- [Unity Airport Digital Twins Blog](https://blog.unity.com/industry/how-digital-twins-are-transforming-large-scale-airports)
- [YVR Digital Twin Commercialization](https://dailyhive.com/vancouver/vancouver-international-airport-yvr-digital-twin-commercialization)
- [NVIDIA Omniverse](https://www.nvidia.com/en-us/omniverse/)
- [NVIDIA OpenUSD Digital Twins](https://blogs.nvidia.com/blog/openusd-digital-twins-industrial-physical-ai/)
- [NVIDIA Omniverse Digital Twins Documentation](https://docs.omniverse.nvidia.com/digital-twins/latest/index.html)
- [NVIDIA Sensor RTX](https://blogs.nvidia.com/blog/omniverse-sensor-rtx-autonomous-machines/)
- [NVIDIA Neural Lidar Fields](https://developer.nvidia.com/blog/sensing-new-frontiers-with-neural-lidar-fields-for-autonomous-vehicle-simulation/)
- [NVIDIA NuRec and World Foundation Models](https://developer.nvidia.com/blog/accelerating-av-simulation-with-neural-reconstruction-and-world-foundation-models/)
- [NVIDIA DRIVE Sim Lidar Validation](https://developer.nvidia.com/blog/validating-active-sensors-in-nvidia-drive-sim/)
- [Autonoma Platform](https://www.autonoma.ai/)
- [Autonoma Airports & Airlines](https://www.autonoma.ai/industries/airports-airlines)
- [Autonoma at ADAS Expo Europe](https://autonomousvehicletechnologyexpo.com/show-news-1/scalable-virtual-world-av-adas-testing-validation)
- [Autonoma Valor VC Profile](https://valor.vc/blog/autonoma-autoverse-aviation-defense-AI-2026)
- [Applied Intuition Neural Sim](https://www.appliedintuition.com/products/neural-sim)
- [Applied Intuition Neural Sim Announced](https://www.appliedintuition.com/blog/neural-sim-announced)
- [Applied Intuition Neural Sim E2E Validation](https://www.appliedintuition.com/blog/neural-sim-end-to-end-sds-validation)
- [Airport Turnaround Digital Twin (Aberdeen)](https://arxiv.org/html/2408.14291v1)
- [Digital Twin for Aircraft Turnaround Efficiency](https://www.sciencedirect.com/science/article/pii/S2949899625000231)
- [Schiphol Agent-Based Digital Twin](https://dx.doi.org/10.2139/ssrn.4806351)
- [Airport GSE Cooperative Scheduling](https://www.nature.com/articles/s41598-024-66350-0)
- [AWS Airport Digital Twin Architecture](https://aws.amazon.com/solutions/guidance/building-a-digital-twin-for-airport-and-airline-operations-on-aws/)
- [ACRP Digital Twin Technology](https://crp.trb.org/acrptransformativetech/technology-focus-articles/digital-twin/)
- [Digital Twin Consortium Airport Operations](https://www.digitaltwinconsortium.org/digital-twin-value-overview-and-use-cases-for-airport-operations/)
- [SplatAD (CVPR 2025)](https://arxiv.org/abs/2411.16816)
- [GSAVS Gaussian Splatting AV Simulator](https://arxiv.org/html/2412.18816v1)
- [3DGS for Digital Twins (Plain Concepts)](https://www.plainconcepts.com/digital-twins-3d-gaussian-splatting/)
- [3DGS vs NeRF Comparison](https://pyimagesearch.com/2024/12/09/3d-gaussian-splatting-vs-nerf-the-end-game-of-3d-reconstruction/)
- [Li-GS LiDAR-assisted 3DGS](https://www.tandfonline.com/doi/full/10.1080/20964471.2025.2479428)
- [LiDGS Framework](https://www.sciencedirect.com/science/article/pii/S1569843225003772)
- [Material-informed 3DGS for Digital Twins](https://arxiv.org/abs/2511.20348)
- [NeRF and 3DGS for Autonomous Driving (Review)](https://www.sciencedirect.com/science/article/pii/S1000934525000975)
- [Ansys-NVIDIA AV Sensor Simulation](https://www.ansys.com/blog/ansys-and-nvidia-collaborate-on-building-a-high-fidelity-av-sens)
- [Aurrigo Autonomous GSE](https://www.airportsinternational.com/article/autonomous-gse-shape-things-come)
- [Digital Twin Implementation Costs](https://thecodework.com/blog/cost-of-implementing-digital-twin-solution/)
- [Real-Time vs Offline Digital Twins](https://www.rtinsights.com/what-differentiates-real-time-digital-twins/)
- [Amadeus AODB](https://amadeus.com/en/airports/products/airport-operational-data-base-aodb)
- [ACI Digital Twin as Real-Time Airport Visualization](https://blog.aci.aero/airport-it/digital-twin-a-real-time-interactive-airport-visualization-tool/)
