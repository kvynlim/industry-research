# Waymo Production Autonomous Driving Deployment

## Deep Research Report — March 2026

---

## 1. Current Scale

### Fleet Size
- **~3,000 vehicles** in active service as of February 2026 (up from ~700 in early 2024)
- Fleet comprises primarily Jaguar I-PACE vehicles (5th-gen Waymo Driver), with 6th-gen Ojai (Zeekr RT) vehicles beginning deployment in February 2026
- Manufacturing facility in Mesa, Arizona (239,000 sq ft, partnership with Magna) targeting capacity of **tens of thousands of units per year**
- Hyundai IONIQ 5 vehicles with 6th-gen Waymo Driver in testing, potential 50,000-unit order

### Operating Cities (as of early 2026)
- **Active commercial service**: Phoenix, San Francisco Bay Area, Los Angeles, Atlanta, Austin, Miami
- **Fully autonomous operations beginning**: Dallas, Houston, San Antonio, Orlando
- **2026 expansion targets**: Las Vegas, San Diego, Detroit, Denver, Nashville, Washington DC, London, Tokyo — aiming for **20+ cities total**

### Ride Volume
- **450,000+ rides per week** (December 2025), approximately **64,000 rides/day**
- **14 million trips** in 2025 alone (3x growth from ~4.5M in 2024)
- **20+ million lifetime trips** by end of 2025
- Crossed **1 million fully autonomous rides per month** in spring 2025
- Target: **1 million rides per week** by end of 2026

### Autonomous Miles
- **200 million miles** driven fully autonomously on public roads (as of February 2026)
- **20+ billion miles** in simulation
- Each vehicle averages ~25 trips per day, ~15 minutes per trip

### Revenue
- **~$355M annualized revenue** run rate as of February 2026 (up from ~$125M end of 2024)
- Average fare: ~$18 per trip
- $16 billion Series D funding round closed February 2026 at ~$126B valuation ($13B from Alphabet)
- Total funding raised: ~$27 billion

---

## 2. Technology Stack in Production

### Sensor Suite — 6th Generation Waymo Driver

The 6th-gen system represents a 42% reduction in sensor count from the 5th generation while improving performance:

| Component | 5th Gen (Jaguar I-PACE) | 6th Gen (Ojai / IONIQ 5) |
|-----------|------------------------|--------------------------|
| Cameras | 29 | 13 |
| LiDAR | 5 | 4 |
| Radar | 6 | 6 |
| Audio (EARs) | Yes | Yes |
| Detection range | ~300m | **~500m** |

**Vision System**: Next-generation 17-megapixel imagers with exceptional thermal stability. Integrated cleaning systems handle rain, road grime, and ice. Enhanced camera-radar surround view.

**LiDAR**: Redesigned illumination for increased detection range, improved fidelity, and lower manufacturing cost. Better robustness in adverse weather.

**Radar**: New in-house machine-learned models for improved rain/snow performance. Builds on 5th-gen foundation with significantly better all-weather capability.

**External Audio Receivers (EARs)**: Detect sirens, railroad crossings, and other safety-critical audio cues.

### Compute Hardware

- Combines **server-grade CPUs and GPUs** with **custom proprietary silicon chips**
- Greater processing complexity pushed into custom chips for efficiency and scalability
- Alphabet likely mixes **NVIDIA GPUs with custom Broadcom-designed TPUs**
- System-on-Chip (SoC) architecture optimized for power efficiency and low latency
- Training infrastructure leverages Google's TPU clusters (thousands of accelerators)
- Onboard compute designed to mirror the Waymo Foundation Model structure via knowledge distillation

### Vehicle Platforms

| Platform | Vehicle | Battery | Architecture | Status |
|----------|---------|---------|-------------|--------|
| 5th Gen | Jaguar I-PACE | 90 kWh | 400V | Current fleet workhorse |
| 6th Gen | **Ojai** (Zeekr RT) | 93 kWh LFP | **800V** | Deploying February 2026 |
| 6th Gen | Hyundai IONIQ 5 | 84 kWh | **800V** | Testing, production 2026+ |

**Ojai (Zeekr RT)**: Purpose-built robotaxi — flat floor, high ceiling, sliding doors, lower step height. 268 HP rear motor. 800V architecture enables 10-80% charge in ~18 minutes. Cost target: **under $100,000 per unit** (down from $150-200K for equipped I-PACE). Manufactured by Zeekr (Geely subsidiary).

**6th-gen Waymo Driver hardware target cost**: Under $20,000 per unit on top of vehicle cost.

### Software Architecture — Production System

Waymo runs a **modular architecture** in production, not end-to-end:

```
Sensors (Camera + LiDAR + Radar + Audio)
    |
    v
Perception (Object detection, tracking, classification — 100+ object classes)
    |
    v
Prediction (Trajectory forecasting for all detected road users)
    |
    v
Planning (Route planning, behavior planning, motion planning)
    |
    v
Control (Steering, acceleration, braking)
    |
    v
Onboard Validation Layer (Independent safety checks on planned trajectories)
```

**Waymo Foundation Model — "Think Fast and Think Slow" Architecture**:

1. **System 1 — Sensor Fusion Encoder**: Rapid reactions using fused camera, LiDAR, and radar data. Low-latency path for immediate driving decisions.

2. **System 2 — Driving VLM**: Complex semantic reasoning using camera data, fine-tuned on Waymo's driving data, leveraging Gemini's world knowledge. Handles novel situations requiring deeper understanding.

3. **World Decoder**: Both encoders feed into this component, which predicts road user behaviors, produces HD maps, generates trajectories, and signals for trajectory validation.

**Knowledge Distillation Pipeline**: Large "Teacher" models (trained with full compute) are distilled into efficient "Student" models optimized for real-time onboard deployment. This allows massive foundation models to inform on-vehicle decisions within latency constraints.

**Key architectural insight from Waymo**: A few large, well-defined components is preferable to either a monolithic end-to-end system or a highly fragmented modular stack. The monolithic approach "makes it easy to get started but is inadequate for full autonomy safely and at scale."

---

## 3. EMMA Model Status

### What EMMA Is

EMMA (End-to-End Multimodal Model for Autonomous Driving) was introduced as a research paper in October 2024. Built on Google's Gemini foundation model, it directly maps raw camera sensor data to driving outputs including:
- Planner trajectories
- Perception objects
- Road graph elements

EMMA learns all intermediate representations (perception, prediction, planning) jointly and implicitly, avoiding the error accumulation seen in modular pipelines.

### Current Status: Research Only

**As of early 2026, EMMA is NOT deployed in production vehicles.** Waymo has not announced if or when EMMA will be integrated into the Waymo Driver.

**Key limitations preventing production deployment**:
- Processes only camera frames — **does not incorporate LiDAR or radar**
- Can only handle a small number of image frames
- Computationally expensive — not suitable for real-time onboard inference
- No accurate 3D sensing modality integration

### Production Architecture Reality

The production Waymo Driver uses the modular Foundation Model architecture described above, not EMMA. EMMA represents research into what future architectures might look like. The Foundation Model's "Think Fast / Think Slow" approach with Driving VLM components represents Waymo's actual strategy for incorporating large model capabilities into production, using distillation to meet real-time constraints.

---

## 4. Simulation and Testing

### Simulation Scale

- **20+ billion simulated miles** to date (as of 2025)
- Billions of simulated miles added per year — more than any other AV developer
- Simulation is a critical part of the development flywheel: real-world data feeds simulation, simulation validates software changes before deployment

### SimulationCity

Waymo's internal simulation platform, introduced in 2021, serves as the "everything engine":
- Automatically synthesizes entire journeys to assess Waymo Driver performance
- Tests new vehicle platforms and new geographies virtually before real deployment
- Creates hundreds of variations of real-world scenarios in seconds
- Powered by 200M+ autonomous miles of real-world data, NHTSA crash databases, and naturalistic driving studies

### Waymax (Open-Source Research Simulator)

Released October 2023, Waymax is a lightweight, data-driven simulator for AV research:
- Written entirely in **JAX** — runs on GPUs and TPUs with JIT compilation
- Based on the **Waymo Open Motion Dataset** (570+ hours of driving from multiple cities)
- Supports both hardware acceleration and "in-graph" training (training + simulation on same accelerator)
- Models vehicles as bounding boxes for distilled behavior research
- Provides stateless (Brax-like) and stateful (dm-env) simulation interfaces
- Evaluation metrics: log divergence, collision detection, off-road detection
- Open-source under non-commercial license at github.com/waymo-research/waymax

### SceneDiffuser++ (CVPR 2025)

First end-to-end generative world model for city-scale traffic simulation:
- Uses denoising diffusion probabilistic models (DDPMs) with Transformer-based denoising
- Handles dynamic agent generation (spawning/removal), occlusion reasoning, traffic light simulation
- Takes in a large map region with start/end points, simulates everything in between
- Evaluated on augmented Waymo Open Motion Dataset with larger map regions

### Waymo World Model (February 2026)

Built on **Google DeepMind's Genie 3** — the most advanced general-purpose world model:
- Generates **high-fidelity, multi-sensor outputs** including both camera AND LiDAR data
- Transfers Genie 3's broad world knowledge from 2D video into 3D LiDAR outputs matching Waymo's hardware
- Renders 720p, real-time interactive worlds at 20-24 FPS

**Controllability mechanisms**:
1. **Driving action control**: "What if" counterfactual scenarios to test alternative decisions
2. **Scene layout control**: Customize road layouts, traffic signals, road user behaviors
3. **Language control**: Adjust weather, time-of-day, environmental conditions via natural language prompts

**Scenario capabilities**:
- Extreme weather: tornadoes, floods, snow, fire
- Rare safety-critical events: wrong-way drivers, malfunctioned vehicles
- Long-tail objects: elephants, lions, oversized tumbleweeds, planes landing on freeways
- Converts dashcam/standard videos into multimodal simulations
- Extended scene simulations through efficient longer rollout variants

**Pipeline role**: Used for training and testing, NOT in production vehicles. The World Model enables proactive preparation for rare edge cases before they occur on real roads.

### How Simulation Informs Production

Waymo's "Driver, Simulator, Critic" flywheel:

1. **Driver** operates in real world, collects data
2. **Critic** (automated system) analyzes driving logs, flags suboptimal behaviors
3. **Simulator** generates alternative scenarios and validates improvements
4. Validated improvements are deployed to fleet via OTA updates
5. Inner loop: RL training in simulation with reward/penalty signals
6. Outer loop: Real-world data continuously improves all components

### Scaling Laws (June 2025 Paper)

Using a **500,000-hour driving dataset**, Waymo established scaling laws for autonomous driving:
- Model performance improves as a **power-law function of total compute budget** (similar to LLMs)
- Strong correlation between training loss and real-world evaluation metrics
- **Data scaling is critical** — optimal AV models tend to be smaller than LLMs but require significantly more data
- As compute budget grows, optimal scaling requires increasing model size **1.5x faster** than dataset size
- Closed-loop (real-world) performance follows the same scaling trend as open-loop metrics
- Implication: More data + more compute = predictably better autonomous driving

---

## 5. Safety Record

### Published Safety Data (Through December 2025)

**170.7 million rider-only miles** analyzed across:
- Phoenix: 68.6M miles
- San Francisco Bay Area: 53.5M miles
- Los Angeles: 37.9M miles
- Austin: 10.7M miles

### Crash Rate Reductions vs. Human Drivers

| Metric | Reduction vs. Human Benchmark |
|--------|-------------------------------|
| Serious injury or worse crashes | **92% fewer** (35 fewer incidents) |
| Airbag deployment crashes | **83% fewer** (230 fewer) |
| Any injury-causing crashes | **82% fewer** (544 fewer) |
| Pedestrian injury crashes | **92% fewer** (62 fewer) |
| Cyclist injury crashes | **85% fewer** (39 fewer) |
| Motorcycle injury crashes | **81% fewer** (25 fewer) |

**Incident rates per million miles**:
- Serious Injury or Worse: Waymo 0.02 vs. Human 0.22
- Any-Injury-Reported: Waymo 0.71 vs. Human 3.90
- Airbag Deployment: Waymo 0.28 vs. Human 1.63

### Peer-Reviewed Studies

1. **7.1 million miles study** (2023): 85% reduction in any-injury crashes (0.41 vs 2.80 per million miles), 55% reduction in police-reported crashes
2. **56.7 million miles study** (2025, published in *Traffic Injury Prevention*): Statistically significant reductions across all crash categories. V2V intersection crashes showed 96% reduction in any-injury-reported outcomes.

### Notable Incidents and Recalls

- **Total incidents**: 1,429 Waymo-involved accidents reported July 2021 – November 2025 (not all Waymo-caused)
- **Injuries**: 117 reported; **Fatalities**: 2 resulting from collisions involving Waymo vehicles
- **School bus recall (December 2025)**: Voluntary recall of 3,067 vehicles after vehicles were found passing stopped school buses with red lights flashing in Austin. NHTSA opened investigation PE25013. Software update deployed November 17, 2025.
- **Utility pole recall (May 2024)**: Voluntary recall of 672 vehicles after a vehicle collided with a wooden utility pole in Phoenix. Software + mapping update deployed.

### Safety Methodology

- Uses NHTSA Standing General Order data for Waymo crash counts
- 32% underreporting correction applied to human benchmark data for injury crashes
- Dynamic spatial benchmarking (accounts for where Waymo actually drives)
- 95% Poisson confidence intervals
- Raw CSV data published for independent verification
- **First AV company** to complete independent third-party audits (by TUV SUD) of both safety case and remote assistance programs
- Compliant with AVSC Best Practice for Safety Case Assessment and ISO 15026-2

---

## 6. Operational Procedures

### Remote Assistance ("Fleet Response")

**Architecture**: Air traffic control model, NOT remote driving.

When the Waymo Driver encounters an ambiguous situation:
1. Vehicle enters a safe state (slows down, moves to side of lane if possible)
2. Transmits sensor data to remote fleet response agent
3. Agent reviews situation and provides contextual guidance (e.g., "lane 2 is safely passable")
4. Waymo Driver software evaluates the guidance against its own perceptions
5. Vehicle decides whether to accept guidance — **the ADS remains in control at all times**

**Remote agents do NOT control steering, braking, or acceleration.**

### Staffing and Infrastructure

- **~70 remote assistance agents** on duty worldwide at any given time for ~3,000 vehicles
- **4 operations centers** across 2 countries (US and Philippines)
- ~50% US-based, ~50% Philippines-based (two cities: Luzon and Visayas regions)
- Philippines operations provide geographic redundancy and 24/7 coverage
- Median one-way latency: **~150ms** (US centers), **~250ms** (Philippines centers)

### Agent Qualifications

- Licensed drivers
- Background checks and driving record reviews
- Drug screening
- Training on local traffic rules and emergency scenarios

### Edge Case Handling

Typical scenarios requiring fleet response:
- Construction zones with ambiguous lane markings
- Irregular cone placement
- Non-standard traffic control (police directing traffic)
- Emergency vehicle encounters
- Infrastructure failures (power outages, broken signals)

### Dispatch System

- Riders request via **Waymo One app** or **Uber app** (in Atlanta and Austin)
- System matches riders to nearest available vehicle
- Fleet management handles routing, charging scheduling, and depot returns
- Waymo takes 100% of fare on Waymo One; revenue sharing with Uber in partnership cities

### Depot Operations

- **Distributed depot model** — smaller, strategically located depots rather than few large hubs
- Example: Inglewood depot near LAX and SoFi Stadium (partnership with Terawatt)
- San Francisco depot: 19 charging stations, each capable of charging 2 vehicles
- Staff at depots: plug in vehicles for charging, perform cleaning, inspections, minor maintenance
- Vehicles autonomously return to depots for charging/servicing

### Independent Audits

TUV SUD completed comprehensive audits of:
1. **Safety case program**: Policy documentation, claim creation, evidence identification, operational management
2. **Remote assistance program**: Multi-day site visit, training practices, compliance verification

---

## 7. Scaling Challenges

### What Broke Going from 100 to 3,000+ Vehicles

**Fleet Response Bottleneck — SF Blackout (December 2025)**:
The most visible scaling failure. A PG&E outage knocked out 7,000 traffic signals across San Francisco. Waymo's system treats dead signals as four-way stops (correct behavior), but vehicles sent "confirmation requests" to fleet response. With hundreds of vehicles simultaneously requesting guidance, the system experienced a **concentrated spike** that overwhelmed operators. Vehicles froze, causing traffic congestion.

Root cause: The confirmation-request system was designed "out of an abundance of caution during early deployment" and hadn't been scaled for correlated failure scenarios. Waymo deployed fleet-wide OTA update adding "regional outage context" so vehicles navigate more decisively without requiring human confirmation.

**Vehicle Maintenance at Scale**:
- Turnover between riders is minutes, not days — insufficient time for cleaning
- Complaints about dirty vehicles became common after opening to public in mid-2024
- Required building out depot infrastructure with dedicated cleaning staff

**Manufacturing Economics**:
- 5th-gen equipped I-PACE: ~$150-200K per vehicle
- At scale, amortized technology cost must be lower than paying a human driver
- Drove development of 6th-gen hardware (target <$100K per vehicle) and Magna partnership
- Opened dedicated manufacturing facility (Mesa, AZ) — previously relied on manual integration

**Mapping and City Onboarding**:
- Each new city requires extensive HD mapping
- Regulatory approvals vary by state/city
- Depot and charging infrastructure must be established
- Local traffic patterns, driving norms, and road geometry must be learned
- International expansion adds left-hand driving (UK, Japan), different road signage, local regulations

**Social Norms vs. Traffic Laws**:
- Following all traffic rules to the letter can be dangerous — other drivers don't expect perfect compliance
- Waymo learned that unspoken social norms (e.g., the "California roll," aggressive merging) required specific behavioral tuning
- AV behavior that's technically legal but socially unexpected causes conflicts

**Correlated Failures**:
- Power outages, severe weather events, and natural disasters can affect the entire fleet simultaneously
- Single-vehicle edge cases become fleet-wide emergencies at scale
- Required building fleet-level situational awareness, not just vehicle-level

### Infrastructure Needs at Scale

- **Charging**: Private depot networks with high-power chargers. 800V architecture (6th gen) critical for fleet utilization
- **Manufacturing**: Dedicated facility with automated assembly line capability
- **Operations centers**: Multiple redundant centers across time zones
- **Connectivity**: Low-latency network infrastructure for remote assistance
- **Data pipeline**: Ingesting and processing data from 3,000+ vehicles driving continuously

---

## 8. Regulatory Approvals

### Arizona

- **Framework**: Executive Order 2015-09 (Governor Ducey, 2015) — self-certification process
- Companies self-certify their AV systems; no extensive pre-approval required
- Separate TNC (Transportation Network Company) license required for commercial ride-hailing
- Waymo has operated in Phoenix area since 2018; driverless service since 2019
- Service area: 315 square miles in greater Phoenix metro
- Liability: Operators acknowledge they may receive traffic citations for AV moving violations

### California

- **DMV permits**: Testing (with and without safety driver) and deployment permits required
- **November 2025**: DMV approved massive expansion covering nearly all of Southern California to the Mexican border, entire Bay Area, and Sacramento
- **CPUC (California Public Utilities Commission)**: Separate approval required for each commercial market before paid rides begin
- **May 2025**: CPUC approved expansion into San Jose and South Bay
- Original CPUC commercial permit for SF approved August 2023
- Airport permits: SFO (September 2025 testing permit, January 2026 commercial), SJC (September 2025)

### Texas

- Minimal regulatory barriers; state has AV-friendly framework
- Austin operations launched early 2025 (via Uber partnership)
- Dallas, Houston, San Antonio targeting commercial launch in 2026
- School bus incidents in Austin triggered NHTSA attention but state regulatory framework remained unchanged

### Georgia

- Atlanta operations launched 2025 via Uber partnership
- State has permissive AV framework

### NHTSA Federal Interactions

- **Standing General Order (SGO)**: Requires reporting of crashes involving ADS-equipped vehicles
- **PE25013 Investigation**: Opened October 2025 regarding school bus stop-arm violations. Deadline January 20, 2026 for Waymo response.
- **Voluntary recalls**: Waymo has used NHTSA recall framework for software updates (school bus fix: 3,067 vehicles; utility pole fix: 672 vehicles)
- Waymo publishes safety data through NHTSA SGO framework and provides raw data for verification

### International

- **London (UK)**: Data-gathering phase with manually driven vehicles underway. Driverless pilot planned April 2026. Commercial launch target September 2026. UK planning to allow small-scale driverless services spring 2026, full commercial by 2027. Partnership with fleet operator Moove.
- **Tokyo (Japan)**: Testing and mapping phase. Partnership with Nihon Kotsu and Go for fleet operations and regulatory navigation. Adapting to left-hand driving, Japanese road design, and local traffic patterns.

---

## 9. World Model Usage

### Waymo World Model (Announced February 2026)

**Built on Google DeepMind's Genie 3** — a frontier generative model for photorealistic, interactive 3D environments.

**How it's used — Testing and Training, NOT Production**:

The Waymo World Model is used in the **simulation and training pipeline**, not deployed on production vehicles. Its role:

1. **Edge case preparation**: Generate scenarios the fleet has never encountered (tornadoes, animals on road, wrong-way drivers) and train the Waymo Driver on them before they happen in reality
2. **Counterfactual testing**: "What if the vehicle had turned left instead of right?" — explore alternative decisions safely
3. **New city preparation**: Generate driving scenarios matching target city conditions before real-world deployment
4. **Regression testing**: Validate software changes against diverse simulated scenarios before OTA deployment
5. **Safety validation**: Test against rare but safety-critical scenarios that can't be reliably reproduced in real-world testing

**Key differentiator from traditional simulation**: The World Model generates photorealistic, physics-consistent multi-sensor outputs (camera + LiDAR) from language prompts, enabling testing of scenarios that would be impossible or unethical to create in the real world.

### SceneDiffuser++ (Research, CVPR 2025)

Waymo's research on city-scale traffic simulation using diffusion models. Enables end-to-end simulation of entire trips with dynamic agent generation, occlusion reasoning, and traffic light simulation. Represents the research frontier feeding into production simulation infrastructure.

### How World Models Fit in the Pipeline

```
Real-World Fleet Data (200M+ miles)
    |
    v
World Model / SimulationCity (generates billions of simulated scenarios)
    |
    v
Critic (evaluates Waymo Driver performance in simulated scenarios)
    |
    v
Training (RL in simulation, supervised learning from real data)
    |
    v
Validation (extensive sim + closed-course + limited real-world testing)
    |
    v
OTA Deployment to Fleet
```

The World Model's primary value is in the **long tail** — the rare scenarios that make up a tiny fraction of driving but represent the majority of remaining safety challenges. By generating these scenarios synthetically, Waymo can train for them without waiting to encounter them on public roads.

---

## 10. Fleet Management

### OTA Updates

- Software updates deployed **over-the-air** to the entire fleet
- Updates validated through simulation and structured testing before deployment
- Fleet-wide updates can be pushed rapidly when needed (e.g., school bus fix, power outage context)
- Vehicles return to depots or pull over safely during updates when necessary

### Software Development and Validation Process

1. **Real-world data collection**: Fleet generates continuous driving data
2. **Scenario identification**: Automated systems flag interesting/challenging encounters
3. **Fix development**: Engineers develop improvements
4. **Closed-course testing**: Physical testing at private facility
5. **Simulation validation**: Hundreds of scenario variations tested in simulation
6. **Staged deployment**: Updates pushed to fleet (specific staging/canary details not publicly disclosed)
7. **Monitoring**: Continuous performance monitoring post-deployment

### Model Versioning

- Waymo uses **teacher-student distillation** for model deployment: large teacher models trained offline, distilled into efficient student models for onboard deployment
- Training infrastructure uses Google TPU clusters with TensorFlow and JAX
- ML Infrastructure team maintains libraries for scalability, reliability, and accelerator efficiency
- Fleet learning enables OTA model updates approximately weekly

### Fleet Operations Partners

| City | Fleet Operations Partner | Responsibilities |
|------|------------------------|------------------|
| Phoenix | Waymo (direct) | Full fleet ops |
| San Francisco | Waymo (direct) | Full fleet ops |
| Los Angeles | Waymo (direct) | Full fleet ops |
| Austin | Uber (Flexdrive) | Vehicle maintenance, depot ops |
| Atlanta | Uber (Flexdrive) | Vehicle maintenance, depot ops |
| Miami | Moove | Fleet ops, facilities, charging |
| London (planned) | Moove | Fleet ops |
| Nashville (planned) | Lyft (Flexdrive) | End-to-end fleet management |
| Tokyo (planned) | Nihon Kotsu / Go | Fleet ops, regulatory |

### Charging and Energy

- All-electric fleet (Jaguar I-PACE, Ojai, IONIQ 5)
- Private depot charging networks — Waymo does not manage public chargers
- 6th-gen vehicles (800V architecture) charge 10-80% in ~18 minutes
- Over 18 million kg of CO2 emissions avoided in 2025 (3x increase from 2024)
- Partnership with Terawatt for charging infrastructure at some locations

### Hardware Lifecycle

- 5th-gen Jaguar I-PACE fleet: being maintained and expanded through Mesa facility (2,000+ vehicles by end 2026)
- 6th-gen Ojai: production beginning at Mesa facility, targeting scale-up through 2026-2027
- 6th-gen IONIQ 5: assembled at Hyundai Metaplant America (Georgia), Waymo Driver integrated separately
- Sensor and compute components designed for field serviceability and swap at depots

---

## 11. Lessons for Airside Airport Operations

### Directly Transferable Operational Patterns

**1. Remote Assistance Architecture**
Waymo's "air traffic control" model for remote assistance translates directly to airside operations. The key insight: the vehicle remains autonomous and in control; remote operators provide **contextual information**, not direct control. For airport ground vehicles, this means:
- Vehicles handle normal taxiway/ramp operations autonomously
- Remote operators provide context for unusual situations (maintenance vehicles in unexpected positions, temporary closures, non-standard aircraft parking)
- Median latency of 150-250ms is acceptable — airside speeds are much lower than highway

**2. Depot-Centric Fleet Model**
Airside vehicles naturally operate from fixed depots/staging areas. Waymo's depot model (charging, maintenance, cleaning, software updates at centralized facilities) maps perfectly to airport GSE areas. The 800V fast-charging architecture enabling 18-minute charges is directly relevant for maintaining fleet utilization during shift changes.

**3. Geofenced Operations**
Waymo operates within defined service areas with HD maps. Airside operations are inherently geofenced to airport boundaries, with highly structured environments (painted lines, signage, known geometry). This is a simpler problem than urban driving in many respects.

**4. Safety Case Methodology**
Waymo's TUV SUD-audited safety case framework (ISO 15026-2, AVSC best practices) provides a template for demonstrating safety to aviation regulators (FAA, EASA, local airport authorities). The structured approach of claims, evidence, and operational management maps to aviation's existing safety management system (SMS) requirements.

**5. Fleet-Level Situational Awareness**
The SF blackout taught Waymo that vehicle-level autonomy isn't sufficient — you need fleet-level awareness of systemic conditions. For airports: runway closures, weather holds, emergency situations affect the entire fleet simultaneously. Building fleet-level context awareness from day one avoids the scaling pain Waymo experienced.

### Key Differences from Urban Deployment

**6. Controlled Environment Advantage**
Airports are controlled environments with:
- Known, limited set of vehicle types and actors
- Professional (trained) human drivers sharing the space
- Lower speeds (typically 5-25 mph on ramp)
- Centralized traffic management (already exists via ATC/ground control)
- Fewer pedestrians, no cyclists, no unpredictable public behavior

This dramatically reduces the long-tail scenario problem that consumes most of Waymo's simulation and training effort.

**7. Regulatory Path Differs**
Airport operations fall under different regulatory frameworks (FAA Part 139 for US airports, ICAO standards internationally) rather than state DMV/PUC permits. The advantage: airports are single entities that can authorize operations directly, rather than navigating city/state/federal regulatory patchwork.

**8. Sensor Configuration for Airside**
Waymo's sensor suite is optimized for urban driving (long-range detection, pedestrian classification, traffic signal reading). Airside operations may need:
- Aircraft detection and classification at different ranges
- Jet blast zone awareness
- FOD (foreign object debris) detection
- Integration with airport ground radar / A-SMGCS
- Potentially fewer cameras but specialized sensors for aircraft proximity

### Operational Lessons to Apply

**9. Start with Constrained Operational Design Domain**
Waymo started with sunny Phoenix suburbs before expanding to foggy San Francisco. For airside: start with a single ramp area, specific vehicle type, good weather — then expand ODD systematically.

**10. Social Norms Matter Even in Professional Environments**
Waymo learned that following rules perfectly can be dangerous when others don't. On airport ramps, there are established informal practices among ground crews. AV behavior that's technically correct but doesn't match ground crew expectations will cause problems.

**11. Cleaning and Maintenance at Scale is a Real Problem**
Waymo's biggest operational complaints were dirty vehicles. For airside equipment, maintenance and readiness at scale require dedicated infrastructure from day one, not as an afterthought.

**12. World Models for Edge Case Training**
Waymo's World Model approach — generating synthetic scenarios for rare events — is directly applicable. For airports: simulate aircraft arriving at wrong gate, emergency vehicles crossing ramp, fuel spill scenarios, jet bridge malfunctions, all without creating real danger.

**13. Scaling Laws Apply**
Waymo's research shows performance improves as a power law of data and compute. For airside: collecting operational data from day one and continuously training on it will predictably improve performance. The optimal approach is relatively small models trained on large amounts of domain-specific data.

**14. Correlated Failures are the Hardest Problem**
Single-vehicle edge cases are manageable. Fleet-wide events (weather, power outages, system failures) are what break operations at scale. Design for correlated failures from the beginning.

**15. Partner for Fleet Operations**
Waymo partners with Moove, Uber/Flexdrive, and Lyft for fleet operations in different cities. For airport deployment, partnering with established GSE operators or airport ground handling companies provides operational expertise and infrastructure while the AV company focuses on the driving technology.

---

## Sources

### Waymo Official
- [2025 Year in Review](https://waymo.com/blog/2025/12/2025-year-in-review/)
- [6th Generation Waymo Driver](https://waymo.com/blog/2024/08/meet-the-6th-generation-waymo-driver/)
- [6th Gen Fully Autonomous Operations](https://waymo.com/blog/2026/02/ro-on-6th-gen-waymo-driver/)
- [Waymo World Model](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [Safety Impact Data](https://waymo.com/safety/impact/)
- [Demonstrably Safe AI](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)
- [Scaling Laws in Autonomous Driving](https://waymo.com/blog/2025/06/scaling-laws-in-autonomous-driving/)
- [Independent Audits](https://waymo.com/blog/2025/11/independent-audits/)
- [Fleet Response](https://waymo.com/blog/2024/05/fleet-response/)
- [EMMA Research](https://waymo.com/research/emma/)
- [SimulationCity](https://waymo.com/blog/2021/07/simulation-city/)
- [Waymax Simulator](https://waymo.com/blog/2023/10/waymo-advances-ai-research-with-our-multifunctional-waymax-simulator)
- [Scaling Fleet Through US Manufacturing](https://waymo.com/blog/2025/05/scaling-our-fleet-through-us-manufacturing/)
- [SF Power Outage Response](https://waymo.com/blog/2025/12/autonomously-navigating-the-real-world/)
- [London Expansion](https://waymo.com/blog/2025/10/hello-london-your-waymo-ride-is-arriving/)
- [SFO Airport Service](https://waymo.com/blog/2026/01/waymo-rides-at-sfo/)
- [Safe, Routine, Ready: New Cities](https://waymo.com/blog/2025/11/safe-routine-ready-autonomous-driving-in-new-cities/)
- [AI & ML at Waymo](https://waymo.com/blog/2024/10/ai-and-ml-at-waymo/)
- [Hyundai Partnership](https://waymo.com/blog/2024/10/waymo-and-hyundai-enter-partnership/)
- [Remote Assistance Clarification](https://waymo.com/blog/shorts/advice-not-control-the-role-of-remote-assistance/)

### Research Papers
- [EMMA Paper (arXiv)](https://arxiv.org/abs/2410.23262)
- [Scaling Laws Paper (arXiv)](https://arxiv.org/html/2506.08228v1)
- [56.7M Mile Safety Study](https://www.tandfonline.com/doi/full/10.1080/15389588.2025.2499887)
- [7.1M Mile Safety Study (PubMed)](https://pubmed.ncbi.nlm.nih.gov/39485678/)
- [SceneDiffuser++ (CVPR 2025)](https://arxiv.org/abs/2506.21976)
- [Waymax GitHub](https://github.com/waymo-research/waymax)

### News and Analysis
- [CNBC: Waymo Doubles Robotaxi Production](https://www.cnbc.com/2025/05/05/waymo-to-double-robotaxi-production-at-arizona-plant-by-end-of-2026.html)
- [TechCrunch: SFO Airport Robotaxis](https://techcrunch.com/2026/01/29/waymo-sfo-airport-robotaxis/)
- [TechCrunch: SF Blackout Explanation](https://techcrunch.com/2025/12/24/waymo-explains-why-its-robotaxis-got-stuck-during-the-sf-blackout/)
- [NPR: School Bus Recall](https://www.npr.org/2025/12/06/nx-s1-5635614/waymo-school-buses-recall)
- [CNBC: Ojai Deployment](https://www.cnbc.com/2026/02/12/waymo-begins-deploying-next-gen-ojai-robotaxis-to-extend-its-us-lead.html)
- [Electrek: $16B Funding Round](https://electrek.co/2026/02/02/waymo-raises-16-billion-round-at-126-billion-valuation-plans-expansion/)
- [Contrary Research: Waymo Business Breakdown](https://research.contrary.com/company/waymo)
- [CleanTechnica: Philippines Operations](https://cleantechnica.com/2026/02/17/waymos-remote-operations-strategy-highlights-why-the-philippines-is-a-critical-hub/)
- [Driverless Digest: 2025 Year in Review](https://www.thedriverlessdigest.com/p/waymos-2025-year-in-review-the-year)
- [InsideEVs: Waymo Expansion](https://insideevs.com/news/788284/waymo-expansion-tesla-cities-2026/)
- [Waymo Statistics 2026](https://awisee.com/blog/waymo-statistics/)
- [NHTSA PE25013 Investigation](https://static.nhtsa.gov/odi/inv/2025/INOA-PE25013-23069.pdf)

### Regulatory
- [CPUC AV Programs](https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs)
- [Arizona DOT AV Operations](https://azdot.gov/mvd/services/professional-services/autonomous-vehicles-testing-and-operating-state-arizona)
