# Zoox Autonomous Vehicle Technology Stack — Deep Dive

> Compiled March 2026 from zoox.com, NHTSA filings, California DMV reports, AWS re:Invent talks,
> Amazon Science publications, NVIDIA blog posts, patent filings, job postings, and trade press.

---

## Table of Contents

1. [Company Overview](#company-overview)
2. [Vehicle Platform](#vehicle-platform)
3. [Sensor Suite](#sensor-suite)
4. [Onboard Compute](#onboard-compute)
5. [Autonomy Software Stack](#autonomy-software-stack)
6. [Machine Learning & AI](#machine-learning--ai)
7. [Mapping & Localization](#mapping--localization)
8. [Simulation Platform](#simulation-platform)
9. [Cloud & Data Infrastructure](#cloud--data-infrastructure)
10. [Programming Languages & Tools](#programming-languages--tools)
11. [Safety & Redundancy Architecture](#safety--redundancy-architecture)
12. [Manufacturing & End-of-Line Testing](#manufacturing--end-of-line-testing)
13. [Fleet Operations & Teleoperation](#fleet-operations--teleoperation)
14. [Regulatory & Safety Record](#regulatory--safety-record)
15. [Key Partnerships & Suppliers](#key-partnerships--suppliers)
16. [Competitive Comparison](#competitive-comparison)
17. [Research & Publications](#research--publications)
18. [Engineering Organization](#engineering-organization)
19. [Sources](#sources)

---

## Company Overview

| Attribute | Detail |
|---|---|
| **Founded** | 2014 |
| **Founders** | Jesse Levinson (CTO), Tim Kentley-Klay |
| **CEO** | Aicha Evans (joined 2019; formerly Chief Strategy Officer at Intel) |
| **CTO** | Jesse Levinson — Ph.D. Stanford CS; algorithms for the $1M-winning 2007 DARPA Urban Challenge entry |
| **Acquired by Amazon** | June 2020, ~$1.2B + $100M retention |
| **Pre-acquisition funding** | $990M across 6 rounds; last valuation $3.2B (2018) |
| **Employees** | ~2,300 (late 2025) |
| **HQ** | 1149 Chess Drive, Foster City, CA 94404 |
| **Other offices** | San Francisco, Las Vegas, Boston (Strio.AI acquisition 2022), San Diego |
| **Manufacturing** | Hayward, CA (220,000 sq ft, opened June 2025); Fremont, CA (test fleet) |

### Key Milestones

- **2015** — First autonomous trip
- **2016** — Four-wheel steering validated
- **2017** — Urban autonomous driving in San Francisco; NVIDIA partnership begins
- **2019** — Testing begins in Las Vegas; first crash test iteration
- **2020** — CA DMV driverless testing permit (4th company ever); Amazon acquisition; vehicle revealed
- **2021** — Testing expands to Seattle
- **2022** — Strio.AI acquired (Boston robotics/AI)
- **2023** — First fully autonomous public road journey with passengers; NeurIPS paper (Scenario Diffusion)
- **2024** — Deployed on SF streets and Las Vegas Strip
- **2025 Sep** — Las Vegas public robotaxi service launches (free rides)
- **2025 Nov** — San Francisco public launch ("Zoox Explorers" program)
- **2025 Aug** — First-ever NHTSA demonstration exemption for American-built AVs

---

## Vehicle Platform

Zoox is the **only robotaxi company operating a ground-up purpose-built vehicle** — not a retrofit.

| Specification | Value |
|---|---|
| **Classification** | Passenger car (49 CFR Part 571.3) |
| **Design** | Bidirectional, symmetrical — no fixed front or rear |
| **SAE Level** | Designed for Level 5; operating as Level 4 (geo-fenced) |
| **Length** | 3,630 mm / 142.9 in (~12 ft) |
| **Width** | ~1,830 mm (~6 ft) |
| **Height** | 1,936 mm / 76.2 in (~6.3 ft) |
| **Curb weight** | ~5,400 lbs (2,449 kg) |
| **Top speed** | 75 mph (121 km/h) — achievable in either direction |
| **Turning circle** | 8.6 m (28.2 ft) |
| **Steering** | ZF four-wheel steering — bidirectional, tight-space maneuvering |
| **Braking** | ZF Integrated Brake Control (IBC) — electro-hydraulic, redundant fallback |
| **Seating** | 4 passengers, face-to-face carriage-style |
| **Controls** | None — no steering wheel, no pedals, no mirrors |
| **Battery** | 133 kWh — two independent packs (one under each seat row) |
| **Battery cells** | Panasonic Energy 2170-format cylindrical Li-ion (multi-year deal, starting early 2026) |
| **Range** | Up to 16 continuous hours on a single charge |
| **Drivetrain** | Dual electric motors, all-wheel drive, fully redundant |
| **Shape** | "Squircle" — rounded, symmetrical |

### Interior

- Touchscreen at every seat
- Wireless charging at every seat
- Individual climate controls per seat
- Spatial audio system
- Ambient cabin lighting
- Automatic carriage-style sliding doors
- Moonroof / skylight
- Two-way audio with Rider Support

---

## Sensor Suite

Five sensor modalities in **identical pods at each of the four vehicle corners**, providing overlapping 360-degree coverage. Each corner achieves 270-degree FOV.

| Sensor | Supplier | Key Specs | Role |
|---|---|---|---|
| **LiDAR** | Hesai Technology | Multiple units per vehicle; likely AT128 (128-ch, 200m range, 1.53M pts/sec) | 3D geometry, precise distance measurement |
| **Cameras** | Not disclosed | ~28 RGB cameras; wide and telephoto lenses | Color, traffic lights, pedestrian gestures, classification |
| **LWIR / Thermal** | Teledyne FLIR | Boson modules (640×512, 12μm uncooled, 30/60 Hz); Intel Movidius Myriad 2 VPU | Heat signatures — people/animals, day and night |
| **Radar** | Not disclosed | Units at each corner | Velocity, long-range, adverse weather, penetrates occlusions |
| **Microphones** | Not disclosed | Directional audio | Emergency vehicle sirens, approach direction |

**Additional sensors for localization:** GPS, accelerometers, gyroscopes, wheel speed sensors, steering angle sensors.

**Total sensor count:** ~64 sensors across the vehicle (described as "dozens").

**Detection range:** 150–200+ meters in all directions.

**Sensor fusion approach:** **Early fusion** — raw data from all modalities combined before independent object detection (not late fusion of separate detections). Temporal information incorporated for velocity estimation and scene flow.

### Sensor Staleness Innovation (deployed summer 2025)

Zoox developed a model-agnostic framework adding timestamp features to every data point for fine-grained temporal awareness. Trained using synthetic stale data from real-world logs.

- Pedestrian detection precision **doubled**
- Recall increased **~600%**
- Near-zero latency impact

---

## Onboard Compute

| Component | Detail |
|---|---|
| **GPUs** | Multiple NVIDIA GPUs on the **NVIDIA DRIVE** platform |
| **CPUs** | 4× Intel Xeon processors |
| **Original platform** | NVIDIA DRIVE PX Pegasus (320+ TOPS) |
| **Current platform** | Likely DRIVE AGX Orin or Thor generation (exact model undisclosed) |
| **Architecture** | Centralized — all perception, prediction, planning, and control on one compute platform |
| **Redundancy** | Dual mirrored computer systems in vehicle floor with cross-verified logic domains |
| **Data generation** | Up to **4 TB/hour** of raw sensor data per vehicle |
| **OTA updates** | Continuous over-the-air neural network and software updates (typically every few weeks) |

CTO Jesse Levinson: *"We've been using NVIDIA hardware since the very start... a couple of orders more magnitude of computation done with the same amount of power"* over the past decade.

---

## Autonomy Software Stack

### Pipeline: Perception → Localization → Prediction → Planning → Control

### Perception (Three Independent Parallel Systems)

| System | Type | Description |
|---|---|---|
| **Main AI System** | ML-based | Detection, classification, tracking, segmentation across all 5 sensor modalities |
| **Geometric Collision Avoidance** | Non-ML / interpretable | Direct path-obstruction detection using geometric algorithms; 360-degree, low latency |
| **"Safety Net"** | ML-based | Independent collision-avoidance with short-horizon prediction; triggers emergency stop when collision probability exceeds thresholds |

### Prediction

| Attribute | Detail |
|---|---|
| **Legacy system** | UAP (Unified Active Prediction) — graph-based neural network |
| **Current system** | QTP (Query-centric Trajectory Prediction) — data-driven behavior modeling |
| **Neural networks** | CNNs for bird's-eye-view scene (~60 semantic channels); GNNs for agent interaction via message passing |
| **Prediction horizon** | Up to **8 seconds** into the future |
| **Update rate** | Recalculated every **100 milliseconds** |
| **Training data** | Billions of real-world samples; self-supervised (actual future trajectories as ground truth) |
| **Conditional prediction** | Predicts how other agents respond to Zoox's planned actions |

### Planning

| Attribute | Detail |
|---|---|
| **Framework** | Cost-based multi-objective optimization |
| **Objectives** | Safety, rules of the road, journey completion, efficiency, rider comfort |
| **Approach** | Hybrid — traditional motion planning + ML-based trajectory generation |
| **Hard constraints** | Override all cost calculations (cannot leave drivable surface, wrong-way, etc.) |
| **Update frequency** | Multiple times per second |
| **Training inputs** | Professional driver "ideal driving" datasets + simulation-refined policies |
| **Backup** | Independent Collision Avoidance System (CAS) — millisecond-level response, assumes full control if primary planner fails |

---

## Machine Learning & AI

### Foundation Model (presented AWS re:Invent 2025)

| Attribute | Detail |
|---|---|
| **Architecture** | Multimodal language-action model with LLM core |
| **Base model** | **Qwen 2/3 VL** (vision-language model) |
| **Inputs** | Camera/video (pre-trained vision encoders), LiDAR, radar, text prompts, existing perception outputs |
| **Outputs** | Robotic controls (acceleration, braking, steering), 3D detections, generative responses |
| **Model sizes** | 400M → 7B → 32B parameters |
| **Training Stage 1** | Large-scale supervised fine-tuning (behavior cloning on tens of thousands of hours of human driving) |
| **Training Stage 2** | High-quality SFT (rare objects, difficult scenarios, synthetic chain-of-thought) |
| **Training Stage 3** | Reinforcement learning using **GRPO** and **DAPO** techniques |

### ML Frameworks & Training

| Tool | Use |
|---|---|
| **PyTorch** | Primary deep learning framework |
| **TensorFlow / Keras** | Secondary ML framework |
| **JAX** | Research / experimentation |
| **NeMo / Megatron** | Large model training |
| **Ray** | Scalable distributed AI computation |
| **DeepSpeed** | Distributed training optimization |
| **Comet ML** | Experiment tracking |
| **Mosaic Data Streaming (MDS)** | Deterministic, resumable data loading with mid-epoch resumption |

### Distributed Training Configuration

- **HSDP** (Hybrid Sharded Data Parallel) + **DDP** across nodes
- **FSDP** (Fully Sharded Data Parallel) within nodes
- **Tensor parallelism** for large models
- **BF16 precision** with **gradient checkpointing**
- **torch.compile** for graph optimization
- 64+ GPUs per training run; 500+ node clusters supported
- **95% GPU utilization** achieved after optimization

### Model Inference

| Tool | Context |
|---|---|
| **vLLM** | Offline model serving |
| **TensorRT LLM** | Online / on-vehicle inference (in development) |

### Key Model Architectures

- **CNNs** — Bird's-eye-view perception (~60 semantic channels)
- **GNNs** — Agent interaction modeling via message passing
- **Latent Diffusion Models** — "Scenario Diffusion" for synthetic scenario generation (NeurIPS 2023)
- **Gaussian Splatting / NeRFs** — Neural rendering for 3D scene reconstruction in simulation

### Annotation & Labeling

- Dedicated **Perception Labeling & Tools** team
- **Auto-labeling algorithms** reduce manual burden
- Self-supervised prediction training (actual future trajectories as labels)
- Web-based labeling tools (React/Angular/Vue + Python backends)

---

## Mapping & Localization

### CLAMS (Calibration, Localization, and Mapping Simultaneously)

- Drives Toyota Highlander survey vehicles through target areas
- ML-based dynamic object removal (people, vehicles, temporary objects)
- Produces HD 3D point-cloud maps from overlapping sensor data
- **Infrastructure-free calibration** — uses natural environmental features (building edges, tree trunks aligned between camera gradients and LiDAR depth edges)

### ZRN (Zoox Road Network)

- Semantic layer atop HD 3D maps
- Encodes: speed limits, traffic signals, stop signs, bike lanes, one-way streets, keep-clear zones
- **ZRN Monitor** — real-time detection of discrepancies between map and real world (construction, moved lane markings); alerts fleet and engineering

### Localization

| Attribute | Detail |
|---|---|
| **Position accuracy** | Within **a few centimeters** |
| **Heading accuracy** | Within **a fraction of a degree** |
| **Update rate** | **200 times per second** |
| **Sensors used** | LiDAR, cameras, GPS, accelerometers, gyroscopes, wheel speed, steering angle |
| **Method** | Matches real-time sensor data against HD maps |

---

## Simulation Platform

| Attribute | Detail |
|---|---|
| **Engine** | Custom-built **C++ simulator** |
| **Scale** | **Millions of scenarios daily** |
| **Scenario types** | Engineered (human-designed), log-based (real-world replay), system-generated (procedural) |
| **Generative models** | **Scenario Diffusion** (latent diffusion) — generates synthetic driving scenarios from noise in ~1 sec/scenario on a single GPU |
| **Adversarial testing** | Automated adversarial simulations for safety-critical edge cases |
| **World creation** | Procedural environments with **Houdini** |
| **Neural rendering** | **Gaussian Splatting**, **NeRFs** for 3D reconstruction |
| **Compute** | Large GPU clusters; can reserve 2,000 GPUs via AWS EC2 Capacity Blocks |

### Physical Testing — Altamont Test Track

- **Main track** — high-speed testing
- **Inner loop** — city intersection simulation
- **Test pad** — lateral movement testing

### Hardware-in-the-Loop (LabBot)

- **DynoBot** — full driving components + dynamometers simulating real-world movement
- **GoldenBot** — stationary electrical architecture integration testing
- Fault injection (software bugs, brake failures), millisecond-precision logging

---

## Cloud & Data Infrastructure

### Hybrid Architecture: On-Premises + AWS

#### On-Premises

| Component | Detail |
|---|---|
| **GPU cluster** | Thousands of NVIDIA GPUs (supercomputer class) |
| **Storage** | **Quobyte** parallel filesystem — 3 clusters, **30 PB**, tens of thousands of concurrent clients (migrated from **Ceph**) |
| **Tiering** | SSD → disk drives → cloud |
| **Training cadence** | ~Every two weeks |

#### AWS Services

| Service | Use |
|---|---|
| **EC2** (P5, P6N GPU instances) | ML training compute |
| **EC2 Capacity Blocks** | Reserve up to **2,000 GPUs** for simulation/training |
| **SageMaker HyperPod** | Distributed training with auto-recovery and health checks |
| **EKS** | Kubernetes orchestration (thousands of instances) |
| **S3** | Primary object storage — tens of PB active, **~1 exabyte cold** |
| **FSx for Lustre** | High-performance parallel filesystem for training |
| **EFS** | Shared filesystem |
| **CloudWatch** | Monitoring |
| **Managed Grafana + Prometheus** | Observability stack |
| **EFA** (Elastic Fabric Adapter) | **3,200 Gbps/node** inter-node networking |
| **AWS Data Transfer Terminals** | Physical upload at up to **400 Gbps** from vehicles |

#### Orchestration

- **Slurm** (SchedMD) — current workload manager
- Transitioning to **EKS-based SageMaker HyperPod**
- Can spin up **1,000 nodes** within a single AWS Region for burst

#### Scale

- **~1 exabyte** of total data (cold + active)
- **4 TB/hour** generated per vehicle
- **500+ node** training clusters
- **95% GPU utilization** achieved

---

## Programming Languages & Tools

### Languages

| Language | Usage |
|---|---|
| **C++** (modern) | Core autonomy stack, middleware, simulator, real-time embedded, safety-critical systems |
| **Python** | ML training, data pipelines, backend services (FastAPI, Django, Flask), scripting |
| **TypeScript / JavaScript** | Web tools, operational dashboards, 3D visualization (React, Vue.js) |
| **Java** | Mentioned in interview requirements |
| **SQL** | Data querying across platforms |

### Build & Dev Tools

| Tool | Use |
|---|---|
| **Bazel** | Primary build system |
| **Git** | Version control |
| **Docker** | Containerization |
| **Terraform** | Infrastructure as code |
| **Kubernetes / EKS** | Orchestration |

### Data Engineering

| Tool | Use |
|---|---|
| **Apache Spark / Databricks** | Large-scale data processing |
| **Apache Airflow** | Workflow orchestration |
| **Kafka / Kinesis** | Streaming data |
| **Ray** | Distributed compute |

### Frontend / Visualization

| Tool | Use |
|---|---|
| **React** (primary), Vue.js, Angular | Web frontends for internal tools |
| **three.js / Babylon.js** | 3D rendering |
| **Vulkan / OpenGL** | 3D graphics APIs |

### Monitoring & Observability

| Tool | Use |
|---|---|
| **Prometheus + Grafana** | Metrics and dashboards |
| **NVIDIA DCGM Exporter** | GPU-level monitoring |
| **CloudWatch** | AWS monitoring |

### RTOS & Embedded

- **FreeRTOS**, **SafeRTOS**, **QNX**, **Linux**

### Systems Engineering

- **DOORS**, **JAMA**, **Polarion** (requirements management)
- **SysML** (system modeling)

### Middleware

Zoox develops **proprietary custom middleware** (not ROS in production):
- Robot state machine
- Software and message interfaces
- Task schedulers and data transport layers
- Diagnostic reporting
- On-vehicle C++ in a real-time Unix-like environment

---

## Safety & Redundancy Architecture

### Design Philosophy: Fail-Operational (not merely Fail-Safe)

Inspired by **aviation safety standards** (ARP4754A, ARP4761). The vehicle continues operating safely through faults, rather than simply shutting down.

**Safety standards referenced:** FMVSS, ISO 26262, ISO 21448 (SOTIF), ISO 12207, DO-178, SPICE/ASPICE.

### Redundancy Matrix

| System | Redundancy Approach |
|---|---|
| **Steering** | Dual steering platforms (primary + backup) for bidirectional control |
| **Braking** | Multiple backup functions, multi-technology approach, third independent emergency brake |
| **Power** | Two independent battery packs + redundant power converters + two additional 12V backup batteries |
| **Compute** | Dual mirrored computer systems in vehicle floor with cross-verified logic domains |
| **Sensors** | 360° overlapping FOV; operational if individual sensors fail |
| **Connectivity** | Three cellular modems operating simultaneously with load balancing |
| **Autonomy** | Main driving stack + independent Collision Avoidance System |
| **Drivetrain** | Two independent electric motors |

**Post-failure capability:** Vehicle can pull over safely, activate hazard lights, open doors, and shut down HVAC even with battery or converter failure.

### Crash Safety

- **100+ safety innovations** not found in conventional vehicles
- **Horseshoe (U-shaped) airbag system** — wraps 180° around passengers; protects from front and side (industry first for carriage seating)
- Five distinct airbag types: horseshoe curtain, frontal (split head/neck/chest), rear, side head, seat side
- **Intelligent deployment** — control unit detects collision direction and severity; deploys only relevant airbags in sequence
- **Novel crumple zones** — driving module and motor assembly dissipate energy before reaching passenger carriage
- **Smart seatbelts** with monitoring
- **Safety-focused active suspension** — continuously adapts to road conditions
- Target: **five-star equivalent** crash safety for every occupant
- CAE simulation run thousands of times before physical prototyping (crash duration ~300 ms)

---

## Manufacturing & End-of-Line Testing

### Hayward Production Facility (opened June 2025)

| Attribute | Detail |
|---|---|
| **Size** | 220,000 sq ft |
| **Capacity** | 10,000+ robotaxis/year at full scale |
| **Current rate** | ~1 vehicle/day; target 3/hour |
| **Workforce** | ~100 technicians (growing to hundreds) |
| **Assembly time** | ~20 minutes per vehicle |
| **Approach** | Modular — major components pre-assembled by suppliers; Zoox does final integration |
| **Automation** | Robots handle adhesive dispensing, AGVs transport vehicles; humans do most assembly |
| **Notable** | No welding, cutting, or painting on-site — low power draw vs. traditional auto plants |

### End-of-Line Testing Sequence

1. **Sensor calibration bay** — automated turntable, halogen lights, radar targets; calibrates LiDAR, cameras, IR, radar
2. **Wheel & headlight alignment** — both ends (bidirectional); active suspension calibration; electronic steering zeroed
3. **Dynamometer testing** — autonomous stress tests up to 75 mph; laser-based lateral drift correction
4. **Water leak / rain simulation** — validates seals and sensor cleaning system (water spray + air blasts)
5. **Light tunnel & appearance** — exterior lights, doors, speakers, touchscreens
6. **Factory Static Test** — VIN verification, safety faults, seatbelts, emergency release, two-way audio, NHTSA label
7. **Buzz/Squeak/Rattle** on outdoor test track
8. **Factory Dynamic Test** — extended autonomous closed-loop driving (hours), both clockwise and counterclockwise

---

## Fleet Operations & Teleoperation

### Three Operations Teams (Foster City HQ)

| Team | Role |
|---|---|
| **Mission Operations** | "Air traffic controllers" — fleet health (tire pressure, battery, cabin/coolant temps), rerouting around street closures, demand-based fleet reallocation, weather advisories |
| **TeleGuidance** | Not remote driving — when vehicle encounters unfamiliar scenario, tactician draws waypoint "breadcrumbs" on screen; vehicle follows path autonomously while maintaining its own safety responsibility; response within seconds |
| **Rider Support** | Full ride lifecycle — start/end checks, seatbelt verification, lost belongings, in-app messaging, emergency button response |

### Ride-Hailing App

- iOS and Android
- Request ride → estimated wait time and trip duration
- Physical "Zoox concierge" staff at pickup points
- In-vehicle touchscreen for trip progress, music, temperature
- One-tap live support
- Currently free; paid rides planned Las Vegas early 2026, SF later 2026

### Operational Cities

| Status | Cities |
|---|---|
| **Public service** | Las Vegas (Sep 2025), San Francisco (Nov 2025) |
| **Testing** | Austin, Miami, Seattle, Atlanta, Los Angeles, Washington D.C., Columbus OH |
| **Next launches** | Austin, Miami |

**Fleet size:** ~50 purpose-built robotaxis + hundreds of Toyota Highlander test vehicles.

---

## Regulatory & Safety Record

### NHTSA Exemptions

| Exemption | Detail |
|---|---|
| **Demonstration Exemption** (Aug 4, 2025) | First-ever for American-built AVs under expanded AVEP; up to 2,500 vehicles/year |
| **Temporary Exemption** (filed Jun 2025) | Pending; requests exemption from FMVSS 103, 104, 108, 111, 135, 201, 205, 208 (human-driving aids inapplicable to driverless bidirectional vehicle) |

### NHTSA Recalls

| Recall | Date | Vehicles | Issue | Remedy |
|---|---|---|---|---|
| **25E-019** | Mar 2025 | 258 | Over-cautious hard braking for bicyclists near crosswalks; incorrect collision anticipation from rear | OTA update to v24.32 |
| **25E-037** | May 2025 | 270 | At <0.5 m/s, failure to detect prone VRU immediately adjacent | OTA update (deployed May 21, 2025) |
| **25E-090** | Dec 2025 | 332 | Unnecessary lane-line crossing at/near intersections (62 instances, zero collisions) | Two-phase OTA update |

**Fleet growth from recalls:** 258 → 270 → 332 vehicles over 2025.

### California DMV Testing Data

| Period | Registered Vehicles | Miles (safety driver) | Driverless Miles | Disengagements | Miles/Disengagement |
|---|---|---|---|---|---|
| **2023** (Dec 2022 – Nov 2023) | 281 | 710,409 | 11,263 | 4 | ~177,602 |
| **2024** (Dec 2023 – Nov 2024) | 380 | 951,871 | 37,804 | — | — |

### Safety Record

- **100+ million** fully autonomous miles accumulated
- As of Jan 2026: 116 NHTSA-logged incidents in autonomous mode (small number resulted in injury/property damage)
- May 2024: NHTSA investigation after two rear-end collisions with motorcycles

---

## Key Partnerships & Suppliers

| Partner | Role |
|---|---|
| **Amazon** | Parent company (acquired 2020, ~$1.3B); AWS infrastructure |
| **NVIDIA** | DRIVE platform GPUs (on-vehicle + data center); partnership since 2017 |
| **Hesai Technology** | LiDAR sensors (multi-year partnership) |
| **Teledyne FLIR** | Longwave infrared (thermal) cameras |
| **Panasonic Energy** | 2170-format Li-ion battery cells (multi-year deal, starting early 2026) |
| **ZF** | Four-wheel steering, chassis modules, occupant safety/protection systems |
| **Intel** | Xeon CPUs (4 per vehicle); Movidius VPU in FLIR modules |
| **Microchip** | Automotive chips |
| **Formula One Williams Racing** | Multi-season partnership (simulation expertise sharing) |
| **Las Vegas Golden Knights** | Multi-year collaboration |
| **Strio.AI** | Acquired 2022 for robotics/AI automation (Boston R&D) |

---

## Competitive Comparison

| Dimension | Zoox | Waymo | Tesla | Cruise |
|---|---|---|---|---|
| **Vehicle** | Purpose-built, no steering wheel | Retrofitted Jaguar I-Pace | Modified Model Y (CyberCab planned) | Retrofitted Chevy Bolt EV (paused) |
| **Sensors** | LiDAR + radar + cameras + LWIR + mics (~64) | 13 cameras, 4 LiDARs, 6 radars, audio | Camera-only (Tesla Vision) | LiDAR + radar + cameras |
| **Unique sensor** | LWIR thermal cameras (first in industry) | — | — | — |
| **Autonomy level** | L4 geo-fenced | L4 geo-fenced | L4 geo-fenced (Austin pilot) | L4 geo-fenced (paused) |
| **Operational cities** | 2 (LV, SF) | 4+ (Phoenix, LA, SF, Austin) | 1 (Austin pilot) | Paused after 2023 incident |
| **Fleet size** | ~50 robotaxis + hundreds of test vehicles | 700+ | Consumer vehicles | GM-owned fleet (paused) |
| **Pricing** | Free (paid 2026) | ~$20/trip | ~$4/ride (Austin) | N/A |
| **Backing** | Amazon | Alphabet | Tesla | GM (scaled back) |
| **Perception** | Triple-redundant (AI + geometric + safety net) | Multi-modal fusion | Neural net vision-only | Multi-modal fusion |
| **Vehicle design** | Full vertical integration | Retrofit + custom sensor pod | Mass-market vehicle + software | Retrofit |

### Key Zoox Differentiators

1. Only company with a **purpose-built vehicle** (no retrofit compromises)
2. Only company using **LWIR thermal cameras** in the sensor stack
3. **Triple-redundant perception** (AI + geometric + safety net)
4. **Bidirectional driving** eliminates three-point turns
5. **Full vertical integration** from vehicle design through fleet operations
6. **Amazon/AWS infrastructure** advantage for simulation and data processing
7. **Fail-operational** (not just fail-safe) — aviation-inspired redundancy

---

## Research & Publications

| Publication | Venue | Topic |
|---|---|---|
| **Scenario Diffusion** | NeurIPS 2023 | Controllable driving scenario generation with latent diffusion models; autoencoder + diffusion architecture; ~1 sec/scenario on single GPU |
| **Sensor Staleness Framework** | Amazon Science 2025 | Model-agnostic temporal feature engineering; pedestrian precision 2×, recall 6× improvement |
| **QTP (Query-centric Trajectory Prediction)** | Amazon Science | Data-driven behavior prediction replacing UAP |
| **CLAMS Localization** | Amazon Science | Infrastructure-free calibration using natural features |
| **Foundation Model for AV** | AWS re:Invent 2025 (AMZ304) | Multimodal language-action model (Qwen VL base) outputting robotic controls |

### Conference Appearances

- **AWS re:Invent 2025** — "Building Machine Learning Infrastructure for Autonomous Vehicles" (AMZ304)
- **NVIDIA GTC 2024** — CTO Jesse Levinson on NVIDIA partnership and simulation
- Research published under the **Amazon Science** umbrella

---

## Engineering Organization

### Major Divisions

| Division | Key Leaders |
|---|---|
| **Autonomy Software** | VP: Marc Wimmershoff |
| **Perception** | Director: Bat-El Shlomo; also Ruijie He (Strio.AI) |
| **Prediction** | — |
| **Planning & Control** | — |
| **Simulation** | Scenario frameworks, 3D sensor sim, sim data platform, sim infra |
| **ML Infrastructure** | CPU/GPU resources, HPC |
| **Driving Tools** | Real-time operational tools, 3D visualization |
| **Developer Platforms** | — |
| **SDMA** (Systems Design & Mission Assurance) | V&V, safety metrics, safety clearance |
| **Firmware** | Embedded systems |
| **Manufacturing Operations** | Hayward and Fremont facilities |
| **Safety Strategy & Operations** | Standards compliance, safety cases |
| **Homologation** | Regulatory filings |
| **User Experience** | App, in-vehicle experience |

**Locations:** Foster City (HQ), San Francisco, Las Vegas, Boston (R&D), San Diego.

---

## Sources

### Official Zoox
- [zoox.com](https://zoox.com/) — Homepage, /about, /vehicle, /autonomy, /safety, /careers
- [Zoox Journal](https://zoox.com/journal) — Technical articles on redundancy, planner, perception, end-of-line testing, operational safety, mapping, prediction
- [Zoox Vehicle Brochure (PDF)](https://zoox.com/common/files/galcpo3qq8khj63lhpqhiw-202507-zoox-vehicle-brochure-pdf.pdf)

### Amazon Science
- [How Zoox vehicles find themselves](https://www.amazon.science/latest-news/how-zoox-vehicles-find-themselves-in-an-ever-changing-world)
- [How the Zoox robotaxi predicts everything](https://www.amazon.science/latest-news/how-the-zoox-robotaxi-predicts-everything-everywhere-all-at-once)
- [Scenario Diffusion](https://www.amazon.science/blog/scenario-diffusion-helps-zoox-vehicles-navigate-safety-critical-situations)

### AWS & NVIDIA
- [AWS re:Invent 2025 AMZ304](https://dev.to/kazuya_dev/aws-reinvent-2025-zoox-building-machine-learning-infrastructure-for-autonomous-vehicles-amz304-3e6m)
- [Zoox AWS Case Study](https://aws.amazon.com/solutions/case-studies/zoox/)
- [NVIDIA Blog: Zoox Autonomous Robotaxi](https://blogs.nvidia.com/blog/zoox-autonomous-robotaxi-powered-by-nvidia/)
- [NVIDIA Blog: Zoox Ride-Hailing](https://blogs.nvidia.com/blog/nvidia-zoox-autonomous-ride-hailing/)

### Regulatory
- [NHTSA Recall 25E-019](https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E019-8103.PDF)
- [NHTSA Recall 25E-037](https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E037-4912.pdf)
- [NHTSA Recall 25E-090](https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E090-1680.pdf)
- [NHTSA Demonstration Exemption Press Release](https://www.nhtsa.gov/press-releases/nhtsa-issues-first-ever-demonstration-exemption-american-built-automated-vehicles)
- [Federal Register: FMVSS Exemption (Docket NHTSA-2025-0523)](https://www.federalregister.gov/documents/2025/09/25/2025-18668/)
- [California DMV Disengagement Reports](https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/disengagement-reports/)

### Infrastructure
- [Quobyte + Zoox](https://blocksandfiles.com/2025/07/01/quobyte-zoox-robotaxi-training/)

### Trade Press
- [TechCrunch: Zoox production facility](https://techcrunch.com/2025/06/18/amazons-zoox-opens-its-first-major-robotaxi-production-facility/)
- [TechCrunch: Zoox crash safety](https://techcrunch.com/2021/06/22/how-amazon-owned-zoox-designed-its-self-driving-vehicles-to-prevent-crashes-and-protect-if-they-do/)
- [Electrek: Zoox battery](https://electrek.co/2020/12/14/amazons-zoox-unveils-autonomous-electric-vehicle-battery-pack/)
- [InsideEVs: Robotaxi first ride](https://insideevs.com/reviews/754542/zoox-robotaxi-first-ride-test/)
- [Assembly Magazine: Factory](https://www.assemblymag.com/articles/99351-zoox-opens-california-factory-to-assemble-robotaxis)
- [CNBC: Zoox robotaxi production](https://www.cnbc.com/2025/06/18/amazon-zoox-robotaxi.html)
- [The Robot Report: Simulation](https://www.therobotreport.com/how-zoox-uses-simulation-to-ensure-its-robotaxis-are-ready-for-the-road/)

---

*Compiled from 7 parallel research agents scanning 60+ sources across zoox.com, NHTSA, California DMV, Amazon Science, NVIDIA, AWS, patent databases, job postings, and trade publications.*
