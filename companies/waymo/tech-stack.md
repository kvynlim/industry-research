# Waymo: Comprehensive Autonomous Vehicle Technology Stack

*Last updated: March 2026*

---

## Table of Contents

1. [Company Overview](#1-company-overview)
2. [Vehicle Platform](#2-vehicle-platform)
3. [Sensor Suite](#3-sensor-suite)
4. [Onboard Compute](#4-onboard-compute)
5. [Autonomy Software Stack](#5-autonomy-software-stack)
6. [Machine Learning & AI](#6-machine-learning--ai)
7. [Mapping & Localization](#7-mapping--localization)
8. [Simulation Platform](#8-simulation-platform)
9. [Cloud & Data Infrastructure](#9-cloud--data-infrastructure)
10. [Programming Languages & Tools](#10-programming-languages--tools)
11. [Safety & Redundancy Architecture](#11-safety--redundancy-architecture)
12. [Fleet Operations & Ride-Hailing](#12-fleet-operations--ride-hailing)
13. [Regulatory & Safety Record](#13-regulatory--safety-record)
14. [Key Partnerships & Suppliers](#14-key-partnerships--suppliers)
15. [Research & Publications](#15-research--publications)
16. [Engineering Organization](#16-engineering-organization)
17. [Competitive Differentiators](#17-competitive-differentiators)
18. [Open Source & Datasets](#18-open-source--datasets)

---

## 1. Company Overview

### Corporate Identity

| Attribute | Detail |
|---|---|
| **Legal Name** | Waymo LLC |
| **Parent Company** | Alphabet Inc. (majority owner) |
| **Headquarters** | Mountain View, California, USA |
| **Founded** | January 17, 2009 (as Google Self-Driving Car Project); spun out as Waymo in December 2016 |
| **Employees** | ~3,776 (as of early 2026) |
| **Valuation** | $126 billion (post-money, February 2026) |
| **Annual Revenue Run Rate** | ~$350 million (late 2025) |
| **Co-CEOs** | Dmitri Dolgov (technology), Tekedra Mawakana (business) |

### Funding History

| Round | Date | Amount Raised | Post-Money Valuation | Lead Investors |
|---|---|---|---|---|
| Series A | March 2020 | $2.25B (grew to $3.2B) | ~$30B | Silver Lake, Mubadala, Magna, Andreessen Horowitz |
| Series B | June 2021 | $2.5B | ~$30B | Alphabet and external investors |
| Series C | October 2024 | $5.6B | $45B | Alphabet, Andreessen Horowitz, Silver Lake, Fidelity, Tiger Global, T. Rowe Price |
| Series D | February 2026 | $16B | $126B | Dragoneer, DST Global, Sequoia Capital, Alphabet |
| **Total Raised** | | **~$27.1B** | | |

### Key Milestones

| Year | Milestone |
|---|---|
| 2009 | Google Self-Driving Car Project launched at Google X by Sebastian Thrun |
| 2010 | Project publicly revealed by the New York Times (Oct 9) |
| 2012 | First autonomous vehicle licensed in Nevada (modified Prius) |
| 2015 | First fully driverless ride on public roads (Austin, TX; no steering wheel) |
| 2016 | Spun out from Google X as "Waymo" under Alphabet |
| 2017 | Launched Early Rider Program in Phoenix metro with Chrysler Pacificas |
| 2018 | Launched Waymo One commercial ride-hailing in Phoenix (with safety drivers) |
| 2019 | Surpassed 10 billion simulated miles |
| 2020 | Fully driverless (rider-only) rides began in Phoenix; 5th-gen hardware unveiled |
| 2021 | Rider-only rides in San Francisco begin; co-CEO structure established |
| 2022 | Expanded rider-only operations in SF; began Waymo One rides in SF |
| 2023 | Waymo Via trucking unit closed to focus on robotaxis; retired Chrysler Pacifica fleet |
| 2024 | Launched in Los Angeles; 6th-gen Waymo Driver announced; surpassed 100K weekly paid rides |
| 2025 | Launched in Austin and Atlanta; 450K+ weekly rides; 2,500 robotaxis in service; Magna factory opened in Mesa, AZ |
| 2026 | 6th-gen Waymo Driver begins autonomous operations; $16B raised; Waymo World Model unveiled; 200M autonomous miles logged; expansion to 10+ cities |

---

## 2. Vehicle Platform

### Vehicle Generations

| Vehicle | Partner OEM | Generation | Status | Battery | Architecture | Approx. Fleet Count |
|---|---|---|---|---|---|---|
| **Toyota Prius** | Toyota | Gen 1-2 | Retired (2009-2012) | Hybrid | N/A | ~12 |
| **Lexus RX450h** | Toyota/Lexus | Gen 3 | Retired (2012-2017) | Hybrid | N/A | ~30 |
| **Chrysler Pacifica Hybrid** | FCA/Stellantis | Gen 4 | Retired (2017-2023) | 16 kWh PHEV (33 mi EV range) | N/A | ~1,000 |
| **Jaguar I-PACE** | Jaguar Land Rover | Gen 5 | Active | 90 kWh Li-ion, 234 mi EPA range | 400V | ~1,500+ (scaling to 3,500 by end 2026) |
| **Waymo Ojai (Zeekr RT)** | Geely/Zeekr | Gen 6 | Active (Feb 2026) | 93 kWh LFP, 800V | 800V | Initial deployments; ramping through 2026 |

### Jaguar I-PACE (5th Generation Waymo Driver)

The all-electric Jaguar I-PACE has served as Waymo's primary commercial vehicle since 2020. Key specifications:

- **Drivetrain**: Dual-motor AWD, 394 hp combined
- **Battery**: 90 kWh liquid-cooled LG Chem lithium-ion
- **EPA Range**: 234 miles (377 km)
- **Charging**: 100 kW DC fast charge (0-80% in ~40 min)
- **Body**: Aluminum-intensive monocoque
- **Sensor Hardware**: 5th-gen Waymo Driver with 29 cameras, 5 LiDAR, 6 radar, external audio receivers
- **Sensor Pod**: Roof-mounted pod with spinning LiDAR (Laser Bear Honeycomb evolution), plus front/rear bumper pods containing cameras and radar. The pod design features overlapping fields of view for full 360-degree coverage.
- **Waymo received its final Jaguar I-PACE delivery** and plans to retrofit 2,000+ additional I-PACE vehicles through 2026 at the Magna Mesa factory.

### Waymo Ojai / Zeekr RT (6th Generation Waymo Driver)

The purpose-built robotaxi developed with Geely's Zeekr brand represents the first mass-produced vehicle designed from the ground up for autonomous ride-hailing.

- **Official Name**: Waymo Ojai (named after the California city; internally "Zeekr RT")
- **OEM Partner**: Zeekr (majority owned by Geely, parent of Volvo Cars)
- **Design Origin**: Designed in Sweden, manufactured in China (Zeekr), integrated in Mesa, AZ (Magna/Waymo)
- **Drivetrain**: Rear-mounted single motor, 268 hp
- **Battery**: 93 kWh lithium iron phosphate (LFP)
- **Architecture**: 800V electrical architecture (enabling rapid DC fast charging for 24/7 fleet operation)
- **Doors**: Three sliding doors (one driver-side conventional, two sliding passenger doors)
- **Interior**: Purpose-built for passengers -- five seats, center tunnel table, no traditional driver controls in rider cabin
- **Sensor Hardware**: 6th-gen Waymo Driver with 13 cameras, 4 LiDAR, 6 radar, external audio receivers (EARs)
- **Sensor Pod**: Smaller, more integrated sensor package with miniature wipers for camera and LiDAR lens cleaning. Front and rear sensor pods contain cameras, radar, and LiDAR units distributed to maintain 360-degree overlap.
- **Distinguishing Feature**: First mass-produced vehicle purpose-built for autonomous driving (per Zeekr CEO Andy An)

### Chrysler Pacifica Hybrid (Retired)

- **Partnership**: Began May 2016 with FCA (now Stellantis)
- **Fleet Size**: Initially 100 units (Dec 2016), expanded to 600 by 2018, orders placed for up to 62,000
- **Actual Deployments**: ~1,000 converted vehicles served riders before retirement in 2023
- **Modifications**: Custom electrical, powertrain, chassis, and structural engineering for full autonomy
- **Reason for Retirement**: Transition to all-electric fleet (Jaguar I-PACE)

---

## 3. Sensor Suite

### Generation Comparison

| Sensor Type | 5th Gen (I-PACE) | 6th Gen (Ojai) | Change |
|---|---|---|---|
| **Cameras** | 29 | 13 | -55% |
| **LiDAR** | 5 | 4 | -20% |
| **Radar** | 6 | 6 | 0% |
| **External Audio Receivers** | Yes | Yes | -- |
| **Max Detection Range** | >500 m | >500 m | -- |
| **Field of View** | 360 deg overlapping | 360 deg overlapping | -- |

### LiDAR (In-House Design)

Waymo designs and manufactures its own LiDAR sensors, making it one of the only AV companies with fully vertically integrated LiDAR.

**Types of LiDAR (3 distinct categories)**:

1. **Long-Range LiDAR (Roof-Mounted)**
   - Custom "Laser Bear Honeycomb" design evolution
   - 360-degree rotation
   - Range: >300 meters
   - The 5th-gen version featured a 95-degree vertical field of view (VFOV)
   - 6th-gen version: reengineered illumination and internal data processing to better penetrate weather and reduce point cloud distortion near highly reflective signs

2. **Short-Range / Perimeter LiDAR**
   - Positioned at four points around the vehicle sides (5th gen) or optimized placements (6th gen)
   - Provides uninterrupted surround view close to the vehicle body
   - Critical for detecting vulnerable road users (pedestrians, cyclists) at close range
   - Centimeter-scale range accuracy

3. **High-Resolution Forward LiDAR**
   - First-of-its-kind zooming capability to dynamically focus on distant objects
   - Provides detailed point clouds at extended ranges

**Cost Reduction**: Waymo reduced LiDAR unit cost by more than 90% through in-house design (from $75,000+ per unit to an estimated sub-$7,500).

**Core Components**: Designed and built in California. Custom-designed chips and optical elements.

### Cameras

**5th Generation**:
- 29 cameras providing 360-degree coverage with overlapping fields of view
- Capable of identifying stop signs at >500 meters

**6th Generation**:
- 13 cameras (reduced count, higher capability per unit)
- Next-generation 17-megapixel imager
- Exceptional thermal stability across automotive temperature ranges
- Day/night operation with overlapping fields of view up to 500 meters
- Miniature wipers on front sensor pod to clear debris

### Radar (In-House Imaging Radar)

Waymo developed one of the world's first automotive imaging radar systems.

- **Count**: 6 radar units (both 5th and 6th gen)
- **Type**: Custom in-house imaging radar
- **Capabilities**:
  - Dense temporal maps tracking distance, velocity, and size of objects
  - Continuous 360-degree view
  - Tracks targets at >500 meters
  - Operates in all lighting and weather conditions (rain, fog, snow, direct sunlight)
  - Detects static, barely moving, and fully moving objects
  - Higher resolution and enhanced signal processing vs. conventional automotive radar
- **6th-gen Improvements**: New in-house algorithms for improved rain/snow performance; added dense temporal mapping for real-time object speed, size, and trajectory tracking

### External Audio Receivers (EARs)

- Array of microphones positioned around the vehicle exterior
- Detects and localizes emergency vehicle sirens, honking, construction noise
- Enables the Waymo Driver to respond to auditory cues that cameras and LiDAR cannot capture

---

## 4. Onboard Compute

### Compute Architecture

Waymo designs its own onboard compute platform, treating it as a tightly integrated system with its sensor suite.

| Component | Details |
|---|---|
| **Primary Compute** | Custom board combining server-grade CPUs and GPUs |
| **Secondary Compute** | Redundant backup computer running continuously in parallel |
| **CPUs** | Intel Xeon processors (historically confirmed) |
| **GPUs** | NVIDIA GPUs (likely A-series or successor for inference) |
| **FPGAs** | Intel Arria FPGAs for low-latency sensor preprocessing |
| **Connectivity** | Intel XMM LTE/5G modems; Intel Gigabit Ethernet for internal bus |
| **Sensor Data Throughput** | ~20 GB/s aggregate from all sensors |
| **End-to-End Latency** | ~3 ms (sensor input to actuation command) |
| **Redundancy** | Full dual-compute architecture; secondary system can bring vehicle to safe stop |
| **Design** | Entirely in-house by Waymo hardware engineers |

### Redundancy Philosophy

- **Dual compute boards**: Primary and secondary systems run simultaneously; failover is seamless
- **Independent power supplies**: Separate power paths for primary and backup systems
- **Watchdog monitoring**: Hardware watchdogs detect compute failures within milliseconds
- **Graceful degradation**: If primary compute fails, backup system executes a minimal risk condition (MRC) -- typically pulling over and stopping safely

---

## 5. Autonomy Software Stack

The Waymo Driver software is organized as a multi-stage pipeline, though recent developments are pushing toward end-to-end learned approaches.

### Pipeline Architecture

```
Sensors --> Perception --> Prediction --> Planning --> Control --> Actuators
               |               |              |            |
               v               v              v            v
         3D Detection    Behavior        Trajectory    Steering/
         Tracking        Forecasting     Generation    Braking/
         Segmentation    Intent          Optimization  Throttle
         Classification  Recognition     Risk Eval
```

### 5.1 Perception

The perception module fuses data from all sensor modalities (LiDAR, camera, radar, audio) to build a comprehensive understanding of the environment.

**Key capabilities**:
- **3D Object Detection**: Detects 100+ object classes including vehicles, pedestrians, cyclists, scooters, animals, traffic cones, construction equipment
- **Semantic Segmentation**: Per-point LiDAR segmentation and per-pixel camera segmentation
- **Object Tracking**: Temporal association of detected objects across frames with globally unique tracking IDs
- **Lane Detection & Road Graph**: Real-time identification of lane boundaries, crosswalks, curbs
- **Traffic Signal Recognition**: Detection and classification of traffic lights (including arrow signals), stop signs, speed limit signs
- **Free Space Estimation**: Drivable area computation

**Model architectures**:
- Transformer-based models (ViTs) for camera-based perception
- BEV (Bird's Eye View) representations via BEVFormer-style architectures
- PointPillars-derived architectures for LiDAR point cloud processing
- Multi-modal fusion networks combining LiDAR + camera features
- Neural Architecture Search (NAS) for optimized model design: 10,000+ architectures explored, yielding 10% lower error rate at same latency or 20-30% faster inference at same quality

### 5.2 Prediction

The prediction module forecasts the future trajectories and behaviors of all detected agents.

**Key capabilities**:
- Multi-agent trajectory prediction over 8-11 second horizons
- Joint prediction of 100+ agents simultaneously
- Intent recognition (lane change, turn, stop, yield)
- Interaction modeling between agents (e.g., merging, negotiating intersections)

**Model architectures**:
- Graph Neural Networks (GNNs) for modeling agent-to-agent and agent-to-road interactions (VectorNet)
- MultiPath/MultiPath++: Fixed anchor trajectory hypotheses with Gaussian mixture outputs
- Temporal graph networks and diffusion models for motion forecasting
- Scaling laws applied: 10x data/compute yields 20-30% error reduction in forecasting

### 5.3 Planning

The planning module generates safe, comfortable, and efficient trajectories.

**Key capabilities**:
- Trajectory generation with spatiotemporal optimization
- Risk-aware decision making under uncertainty
- Goal fulfillment (follow route, reach destination)
- Negotiation behaviors (unprotected left turns, merges, yielding)
- Comfort optimization (smooth acceleration, deceleration, steering)

**Approach evolution**:
- Historical: Rule-based + optimization-based planning
- Current: ML-driven motion planning using foundation models, shifting from hand-crafted rules to learned policies
- Scaling laws demonstrate power-law gains in trajectory quality with more data and compute

### 5.4 Control

The control module translates planned trajectories into precise actuator commands.

**Key capabilities**:
- Model Predictive Control (MPC) hybridized with neural policies
- Reinforcement learning-derived control policies
- Real-time adaptation to road surface conditions, wind, vehicle load
- Smooth, human-like driving behavior

### 5.5 End-to-End Trends

Waymo is actively developing end-to-end approaches that collapse the traditional pipeline:

- **EMMA (End-to-End Multimodal Model)**: Maps raw camera data directly to planner trajectories, perception outputs, and road graph elements using a single model built on Gemini
- The production Waymo Driver now uses a **foundation model trained end-to-end**, similar in philosophy to approaches by Tesla and Wayve
- Co-training across perception, detection, and planning tasks improves all three domains simultaneously

---

## 6. Machine Learning & AI

### Foundation Models

#### EMMA (End-to-End Multimodal Model for Autonomous Driving)

| Attribute | Detail |
|---|---|
| **Published** | October 2024 (arXiv: 2410.23262); updated September 2025 |
| **Base Model** | Google Gemini (multimodal large language model) |
| **Input** | Raw camera sensor data, navigation instructions, ego vehicle status |
| **Output** | Planner trajectories, 3D object detections, road graph elements |
| **Representation** | All non-sensor inputs/outputs encoded as natural language text |
| **Multi-task** | Co-trained on planning, object detection, and road graph tasks |
| **Performance** | State-of-the-art motion planning on nuScenes; competitive on WOMD and WOD |
| **Limitations** | Processes limited image frames; no LiDAR/radar input; computationally expensive |
| **Venue** | ICLR 2025 |

#### Waymo Foundation Model (Production)

- Single large foundation model powering the production Waymo Driver
- Trained on Google TPU pods (same infrastructure used for Gemini)
- "Generalizable" -- designed to transfer across vehicle platforms and geographies
- Built on JAX framework (same as Google DeepMind's Gemini)

### Training Infrastructure

| Component | Detail |
|---|---|
| **Framework** | JAX (primary), TensorFlow (legacy/supplementary) |
| **Hardware** | Google TPU pods (v4, v5e, likely v6/Trillium); NVIDIA GPUs for some workloads |
| **TPU Efficiency** | Up to 15x more efficient training vs. GPU baselines |
| **Distributed Training** | Custom libraries for job scheduling, resource management, data distribution, model synchronization |
| **Training Data** | Hundreds of millions of real-world driving miles + billions of simulated miles |
| **Data Processing** | Petabytes of complex sensor data processed through scalable pipelines |
| **AutoML/NAS** | Reinforcement learning and random search over 10,000+ architectures; final selection based on accuracy and inference cost |
| **Shared Infrastructure** | Optimizations from Gemini training directly portable to Waymo Driver training |

### Model Architecture Components

| Architecture | Application | Details |
|---|---|---|
| **Vision Transformers (ViTs)** | Camera perception | Self-attention over image patches for object detection and segmentation |
| **BEVFormer** | Multi-camera 3D perception | Generates bird's-eye-view feature maps from surround cameras |
| **PointPillars** | LiDAR 3D detection | Point cloud encoded into vertical pillars, processed by 2D CNN; runs at 62 Hz |
| **VectorNet** | HD map & agent encoding | Hierarchical GNN operating on vectorized map and trajectory representations |
| **MultiPath / MultiPath++** | Behavior prediction | Fixed anchor trajectories with Gaussian mixture outputs; state-of-the-art on WOMD |
| **Diffusion Models** | Motion forecasting & simulation | Used in SceneDiffuser for traffic simulation initialization and rollout |
| **Gemini-based LLM** | End-to-end driving (EMMA) | Multimodal LLM mapping sensor data to driving outputs via natural language |

### AutoML and Neural Architecture Search

Waymo collaborates with Google Brain/DeepMind to apply AutoML to autonomous driving:

- **Process**: Explore 10,000+ architectures using RL and random search; pre-select 100 candidates; choose 1 winner based on accuracy and inference cost
- **Applications**: LiDAR semantic segmentation, traffic lane detection/localization
- **Results**: Architectures with 10% lower error rate at same latency, or 20-30% faster at same quality
- **NAS Cells**: Family of neural network building blocks (NAS cells) composed to build task-specific architectures

---

## 7. Mapping & Localization

### HD Map Creation

Waymo relies on pre-built High-Definition (HD) maps as a core component of its autonomy stack.

**Map Creation Process**:
1. **Manual Survey Drives**: Sensor-equipped vehicles manually driven through every street in a new operational domain
2. **3D LiDAR Reconstruction**: Custom LiDAR paints a detailed 3D picture of the environment
3. **Annotation**: Maps enriched with semantic information -- lane boundaries, traffic signals, stop signs, crosswalks, speed limits, curb heights, driveway locations
4. **Validation**: Automated and manual quality checks ensure centimeter-level accuracy
5. **Updates**: Maps continuously updated as the fleet detects changes in the environment

### Map Specifications

| Attribute | Detail |
|---|---|
| **Accuracy** | Centimeter-level (cm-level) |
| **Content** | 3D geometry, lane-level topology, traffic control devices, crosswalks, speed zones, construction zones |
| **Format** | Proprietary vectorized representation |
| **Coverage** | All operational cities fully mapped before service launch |
| **Update Frequency** | Continuous, driven by fleet observations and dedicated mapping runs |

### Localization

- **Primary Method**: LiDAR-based localization against pre-built HD point cloud maps
- **Supplementary**: GPS/GNSS, IMU, wheel odometry
- **Accuracy**: Centimeter-level position accuracy in 6-DOF (position + orientation)
- **Robustness**: Multi-sensor fusion ensures localization even when individual sensors are degraded (e.g., GPS in urban canyons)
- **SLAM Integration**: LiDAR SLAM used during map creation; real-time localization uses scan-matching against pre-built maps with misalignment correction

---

## 8. Simulation Platform

### Overview

Waymo's simulation infrastructure is among the most extensive in the AV industry, with over 20 billion simulated miles driven (vs. 200+ million real-world autonomous miles).

### SimulationCity

Waymo's primary simulation platform, unveiled in July 2021.

| Feature | Detail |
|---|---|
| **Scale** | Up to 25,000 virtual Waymo vehicles driving up to 10 million miles per day |
| **Fidelity** | Recreates raindrops on sensors, dimming light, solar glare, road surface variations |
| **Data Sources** | 20M+ real autonomous miles, NHTSA Crash Data Systems, Naturalistic Driving Study Data |
| **Scenario Types** | Replay of real-world encounters, procedural generation, adversarial testing, regression testing |
| **Capabilities** | New vehicle platform bring-up, geographic validation, operational refinement |
| **Statistical Modeling** | Draws random outcomes from statistical distributions of real-world behaviors |

### SurfelGAN

- **Published**: CVPR 2020
- **Purpose**: Generate realistic sensor data for novel viewpoints from limited LiDAR + camera data
- **Method**: Texture-mapped surfels for efficient scene reconstruction preserving 3D geometry, appearance, and scene conditions
- **Output**: Photorealistic camera images for novel vehicle positions and orientations
- **Application**: Data augmentation, counterfactual scenario generation

### Waymo World Model (February 2026)

Waymo's most advanced simulation system, built on Google DeepMind's Genie 3.

| Feature | Detail |
|---|---|
| **Foundation** | Google DeepMind's Genie 3 (general-purpose world model for photorealistic 3D environments) |
| **Output** | Multi-sensor: generates both camera AND LiDAR data simultaneously |
| **Control Modes** | (1) Driving action control, (2) Scene layout control, (3) Text prompt control |
| **Rare Event Generation** | Can simulate tornadoes, flooded streets, elephants on the road, and other near-impossible scenarios |
| **Data Conversion** | Converts ordinary dashcam or cell phone videos into full multimodal (camera + LiDAR) simulations |
| **3D Transfer** | Pre-trained on vast 2D video corpus, then post-trained to produce 3D LiDAR outputs matching Waymo's hardware |
| **Use Case** | Every dashcam incident on the internet becomes a potential training scenario |

### SceneDiffuser / SceneDiffuser++

- **SceneDiffuser**: Scene-level diffusion model for traffic simulation initialization and rollout (NeurIPS 2024). Achieves 16x fewer inference steps via amortized denoising. Top open-loop and best closed-loop diffusion performance on Waymo Open Sim Agents Challenge.
- **SceneDiffuser++**: City-scale traffic simulation via generative world model. First end-to-end generative world model capable of point A-to-B simulation at city scale.

### Simulation Scale

| Metric | Value |
|---|---|
| **Total Simulated Miles** | >20 billion |
| **Daily Simulated Miles** | Up to 10 million |
| **Virtual Fleet Size** | Up to 25,000 simultaneous virtual vehicles |
| **Closed-Course Scenarios** | >40,000 unique scenarios |
| **Simulated Driving Per Year** | Billions of miles |

---

## 9. Cloud & Data Infrastructure

### Google Cloud Integration

As an Alphabet subsidiary, Waymo has deep integration with Google Cloud infrastructure.

| Component | Detail |
|---|---|
| **Compute** | Google TPU pods (v4, v5e, Trillium/v6) for training; GPU clusters for inference development |
| **Storage** | Google Cloud Storage (GCS) for petabyte-scale sensor data |
| **Data Warehouse** | BigQuery for structured analytics and metrics |
| **ML Platform** | Vertex AI and custom training orchestration |
| **Networking** | High-bandwidth interconnect between TPU pods (9.6 Tb/s inter-chip, per Ironwood specs) |
| **HBM Per Superpod** | Up to 1.77 PB shared High Bandwidth Memory (9,216-chip Ironwood superpod) |

### Data Pipeline

- **Data Volume**: Many petabytes of complex sensor data (LiDAR point clouds, camera images, radar returns, audio)
- **Pipeline Function**: Raw sensor data ingestion, preprocessing, annotation, training data generation, model evaluation
- **Auto-Labeling**: High-accuracy 3D auto-labeling system generates 3D bounding boxes for road agents
- **Scale**: Data volume "exploding" as Waymo scales to new cities and vehicle platforms
- **Annotation Tools**: Combination of automated labeling (ML-based) and human annotation for ground truth

### Data Flow Architecture

```
Fleet Vehicles (20 GB/s per vehicle)
    |
    v
Cellular Upload (prioritized data selection)
    |
    v
Google Cloud Storage (petabyte-scale raw data)
    |
    v
Data Processing Pipeline (preprocessing, auto-labeling, quality checks)
    |
    v
Training Data Store (curated datasets for ML training)
    |
    v
TPU Pods (distributed training)
    |
    v
Model Registry (versioned models, A/B testing)
    |
    v
OTA Deployment to Fleet
```

---

## 10. Programming Languages & Tools

### Programming Languages

| Language | Primary Use |
|---|---|
| **C++** | Core autonomy stack (perception, planning, control), real-time onboard software, sensor drivers, low-latency inference |
| **Python** | ML model development, training scripts, data analysis, prototyping, tooling |
| **Go** | Backend services, fleet management, cloud infrastructure, APIs |
| **Java** | Some backend services (Alphabet ecosystem compatibility) |
| **Starlark** | Build configuration language (Python dialect for Bazel BUILD files) |

### Build System

| Tool | Detail |
|---|---|
| **Bazel** | Primary build system (open-source version of Google's internal Blaze). Handles multi-language monorepo builds across C++, Python, Go, Java. Hermetic builds ensure reproducibility. |
| **Blaze** | Google-internal predecessor to Bazel; Waymo likely uses Blaze internally given Alphabet's infrastructure |
| **Key Benefits** | Incremental builds, remote caching, remote execution, cross-platform compilation, deterministic outputs |

### Internal Tools and Frameworks

| Tool | Purpose |
|---|---|
| **Custom ML Libraries** | Enhance TensorFlow and JAX for Waymo-specific scalability, reliability, and performance |
| **Training Orchestration** | Custom distributed training infrastructure: job scheduling, resource management, data distribution, model synchronization |
| **Simulation Framework** | SimulationCity and Waymo World Model toolchain |
| **Data Labeling** | Auto-labeling systems + annotation management tools |
| **Fleet Management** | Proprietary vehicle dispatch, routing, monitoring, and remote assistance systems |
| **Map Toolchain** | HD map creation, validation, and update pipeline |
| **CI/CD** | Continuous integration and deployment for both onboard software and cloud services |

### ML Frameworks

| Framework | Usage |
|---|---|
| **JAX** | Primary ML framework (rebuilt entire training stack on JAX); same framework as Google DeepMind's Gemini |
| **TensorFlow** | Legacy training pipelines and some production inference |
| **Flax/Haiku** | Neural network libraries on top of JAX |
| **XLA** | Compiler for optimizing TPU/GPU execution |

---

## 11. Safety & Redundancy Architecture

### Safety Methodology

Waymo employs a multi-layered safety approach organized across three technology layers.

**Three Layers of Safety**:

| Layer | Scope | Methods |
|---|---|---|
| **Hardware (Architecture)** | Sensors, compute, actuators | Redundant sensors, dual compute, backup braking/steering, DFMEA, FTA |
| **ADS Behavior (Software)** | Perception, prediction, planning, control | STPA, scenario-based verification, simulation testing, ML robustness |
| **Operations** | Fleet management, remote assistance, maintenance | Operational Design Domain (ODD) constraints, geo-fencing, remote support |

**Hazard Analysis Methods**:
- **STPA** (Systems-Theoretic Process Analysis): Identifies hazards from control structure interactions
- **FTA** (Fault Tree Analysis): Top-down deductive analysis of failure paths
- **DFMEA** (Design Failure Modes and Effects Analysis): Systematic evaluation of component failure modes
- **Custom Software Safety Analysis**: Waymo-specific safety analysis for ML-based systems

### Hardware Redundancy

| System | Redundancy Approach |
|---|---|
| **Compute** | Dual onboard computers running simultaneously; backup can bring vehicle to safe stop |
| **Braking** | Redundant braking actuators (specified as necessary for driverless operation) |
| **Steering** | Redundant steering actuators |
| **Power** | Independent power paths for primary and backup systems |
| **Sensors** | Overlapping fields of view across LiDAR, cameras, and radar; any single sensor failure covered by remaining sensors |
| **Communication** | Multiple cellular connections for fleet management and remote assistance |

### Testing Portfolio

| Test Type | Scope |
|---|---|
| **Simulation** | Billions of miles; regression testing; rare event coverage; system-level |
| **Closed-Course** | >40,000 unique scenarios; controlled environment testing; hardware-in-the-loop |
| **Public Road** | 200+ million autonomous miles; real-world validation |
| **Unit Tests** | Software component verification |
| **Integration Tests** | Subsystem interaction validation |
| **Bench Tests** | Hardware component testing |
| **Hardware-in-the-Loop (HIL)** | Sensor and compute hardware tested with simulated inputs |

### Safety Readiness Determination

Waymo uses a formal Safety Readiness Determination (SRD) process before deploying in new domains:

1. Hazard analysis and risk assessment
2. Design and development with built-in robustness
3. Scenario-based verification (simulation + closed-course + limited public road)
4. Operational readiness review
5. Phased deployment (safety drivers first, then driverless)

Reference: Waymo's Safety Methodologies and Safety Readiness Determinations (arXiv:2011.00054, published November 2020)

---

## 12. Fleet Operations & Ride-Hailing

### Waymo One Service

| Metric | Value (as of March 2026) |
|---|---|
| **Weekly Paid Rides** | 450,000+ (Dec 2025); targeting 1M by end of 2026 |
| **Fleet Size** | ~2,500 vehicles (Nov 2025); scaling to 3,500+ I-PACEs + Ojai additions |
| **Total Autonomous Miles** | 200+ million (fully autonomous, public roads) |
| **Rider-Only Miles** | 96+ million (no human driver present) |
| **App** | Waymo One (iOS and Android); also available via Uber app in select cities |

### Operational Cities (as of March 2026)

| City | Launch Date | App | Fleet Vehicle | Notes |
|---|---|---|---|---|
| **Phoenix, AZ** | Oct 2020 (driverless) | Waymo One | Jaguar I-PACE | Largest and most mature market |
| **San Francisco, CA** | Mar 2022 (driverless) | Waymo One | Jaguar I-PACE | Major urban deployment |
| **Los Angeles, CA** | 2024 | Waymo One | Jaguar I-PACE | Rapidly expanding service area |
| **Austin, TX** | Early 2025 | Uber app | Jaguar I-PACE | Partnership with Uber for dispatch and fleet ops |
| **Atlanta, GA** | Jun 2025 | Uber app | Jaguar I-PACE | 65 sq mi initial area; Downtown to Buckhead |
| **Miami, FL** | Early 2026 (early access) | Waymo One | Jaguar I-PACE | Moove handles fleet operations |
| **Houston, TX** | 2026 (announced Feb) | TBD | TBD | Initial select riders |
| **Dallas, TX** | 2026 (announced Feb) | TBD | TBD | Rolling access |
| **San Antonio, TX** | 2026 (announced Feb) | TBD | TBD | Rolling access |
| **Orlando, FL** | 2026 (announced Feb) | TBD | TBD | Rolling access |

**Announced future cities**: Washington D.C. (2026), Nashville, Detroit, Las Vegas, San Diego, Denver, and international targets including London and Tokyo.

### Pricing Model

**San Francisco**:
- Base fare: $9.52
- Per mile: $1.66
- Per minute: $0.30
- Average ride cost: ~$20.43

**Los Angeles**:
- Base fare: $5.37
- Per mile: $2.50
- Per minute: $0.32

**Price Comparison (April 2025 data)**:

| Service | Average Ride Cost | Premium vs. Lyft |
|---|---|---|
| Waymo | $20.43 | +41% |
| Uber | $15.58 | +8% |
| Lyft | $14.44 | Baseline |

**Trend**: The pricing gap is narrowing. By late 2025, Waymo's premium dropped to ~12.7% over Uber and ~27.3% over Lyft. Waymo's average cost dropped 3.62% while Uber and Lyft prices increased.

**Subscription**: $29.99/month subscription available, pays for itself in under five rides vs. standard fares.

### Fleet Management Partners

| Partner | Role | Markets |
|---|---|---|
| **Waymo (direct)** | Full fleet operations | Phoenix, SF, LA |
| **Uber** | Dispatch via Uber app, fleet management | Austin, Atlanta |
| **Moove** | Fleet operations, facilities, charging | Miami (planned), Phoenix |
| **Avomo (formerly Moove Cars)** | Fleet management for Uber-dispatched rides | Austin, Atlanta |

---

## 13. Regulatory & Safety Record

### Autonomous Miles and Crash Data

| Metric | Value | Source |
|---|---|---|
| **Total Autonomous Miles (public road)** | 200+ million | Waymo (Feb 2026) |
| **Rider-Only Miles** | 96+ million | Waymo |
| **NHTSA-Reported Incidents** | 1,429 (Jul 2021 - Nov 2025) | NHTSA SGO data |
| **Reported Injuries** | 117 | NHTSA |
| **Fatalities** | 2 (Waymo vehicle involvement) | NHTSA |

### Peer-Reviewed Safety Comparisons

**Study 1: 7.1 Million Rider-Only Miles** (Kusano et al., 2024; published in *Traffic Injury Prevention*):

| Crash Type | Waymo ADS (IPMM) | Human Benchmark (IPMM) | Reduction |
|---|---|---|---|
| Any Injury Reported | 0.41 | 2.80 | -85% (human rate 6.7x higher) |
| Airbag Deployment | Significant reduction | -- | Statistically significant |

**Study 2: 56.7 Million Rider-Only Miles** (Kusano et al., 2025; published in *Traffic Injury Prevention*):
- First statistically significant comparison at the Suspected Serious Injury+ (SSI+) level
- Statistically significant reductions in: Any-Injury-Reported, Airbag Deployment, and SSI+ outcomes
- Disaggregated into 11 crash types for granular analysis

### California DMV Disengagement Reports

| Period | Miles Driven (CA) | Fleet Size (CA) | Notes |
|---|---|---|---|
| Dec 2022 - Nov 2023 | 5,872K km (3,670K mi) | ~430 vehicles | Peak testing mileage |
| Dec 2023 - Nov 2024 | 3,823K km (2,390K mi) | 1,035 vehicles | 35% fewer miles; shift from testing to commercial ops |
| Dec 2024 - Nov 2025 | Part of 9M+ mi industry total | -- | Commercial operations dominate |

**Note**: As Waymo transitions from testing to commercial operations, traditional disengagement reporting becomes less meaningful. Waymo's commercial driverless miles (rider-only) are reported through NHTSA's SGO framework rather than California DMV disengagement reports.

### Regulatory Framework

- **Federal**: Voluntary compliance with NHTSA Standing General Order (SGO) for incident reporting; no federal AV legislation as of March 2026
- **California**: CPUC permit for commercial robotaxi operations; CA DMV autonomous vehicle testing permit
- **Arizona**: Permissive regulatory environment; no specific AV legislation required for operation
- **Other States**: Regulatory engagement underway in Texas, Florida, Georgia, and Washington D.C.

---

## 14. Key Partnerships & Suppliers

### Vehicle Manufacturing Partners

| Partner | Relationship | Vehicle/Component |
|---|---|---|
| **Geely / Zeekr** | OEM partner; designed and manufactures the Zeekr RT (Waymo Ojai) | 6th-gen robotaxi platform |
| **Jaguar Land Rover** | OEM partner (winding down) | Jaguar I-PACE base vehicle |
| **Magna International** | Manufacturing partner; co-operates Mesa, AZ integration facility | Sensor integration, assembly |
| **Stellantis (FCA)** | Former OEM partner | Chrysler Pacifica Hybrid (retired) |

### Ride-Hailing & Fleet Partners

| Partner | Relationship | Details |
|---|---|---|
| **Uber** | Ride-hailing platform integration | Waymo rides available via Uber app in Austin and Atlanta |
| **Moove** | Fleet management | Operations, facilities, and charging in Miami; fleet ops in Phoenix |
| **Avomo** | Fleet management | Depot operations for Uber-dispatched markets |

### Autonomous Trucking Partners

| Partner | Relationship | Status |
|---|---|---|
| **Daimler Trucks** | Strategic partnership for L4 autonomous trucks | Active; Waymo provides autonomy stack for Freightliner Cascadia |
| **J.B. Hunt** | Freight testing partner | Waymo Via closed (2023), but Daimler partnership continues |
| **C.H. Robinson** | 3PL testing partner | Testing completed |
| **UPS** | Freight trial partner | Trial runs in Texas completed |
| **Uber Freight** | Freight platform integration | Exploratory partnership |

### Technology Partners

| Partner | Relationship |
|---|---|
| **Google DeepMind** | Genie 3 world model foundation; shared research |
| **Google Cloud** | TPU infrastructure, storage, compute |
| **Google Brain (now DeepMind)** | AutoML/NAS collaboration for architecture search |
| **Intel** | Historical: Xeon CPUs, Arria FPGAs, XMM modems, Gigabit Ethernet |

---

## 15. Research & Publications

### Publication Statistics

Waymo maintains an active research program with publications at top-tier venues.

| Year | Paper Count |
|---|---|
| 2019 | ~8 |
| 2020 | ~15 |
| 2021 | ~12 |
| 2022 | ~14 |
| 2023 | 16 |
| 2024 | 13 |
| 2025 | 4+ |

### Key Papers by Topic

#### Perception

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **PointPillars: Fast Encoders for Object Detection from Point Clouds** (Lang et al.) | CVPR | 2019 | Pillar-based LiDAR encoding; 62 Hz real-time; 2-4x faster than prior methods |
| **STINet: Spatio-Temporal-Interactive Network for Pedestrian Detection and Trajectory Prediction** (Zhang et al.) | CVPR | 2020 | Joint pedestrian detection + trajectory prediction |
| **Scalability in Perception for Autonomous Driving: Waymo Open Dataset** (Sun et al.) | CVPR | 2020 | Introduced Waymo Open Dataset; benchmark for 3D detection |
| **Depth Estimation Matters Most** | -- | 2020 | Per-object depth estimation for monocular 3D detection and tracking |
| **DeepFusion: Lidar-Camera Deep Fusion for Multi-Modal 3D Object Detection** | CVPR | 2022 | Cross-modal feature fusion for 3D detection |

#### Behavior Prediction

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **MultiPath: Multiple Probabilistic Anchor Trajectory Hypotheses for Behavior Prediction** (Chai et al.) | CoRL | 2019 | Fixed anchor trajectories with Gaussian mixture; one-pass inference |
| **VectorNet: Encoding HD Maps and Agent Dynamics from Vectorized Representation** (Gao et al.) | CVPR | 2020 | Hierarchical GNN on vectorized map/trajectory inputs |
| **MultiPath++: Efficient Information Fusion and Trajectory Aggregation for Behavior Prediction** (Varadarajan et al.) | ICRA | 2022 | State-of-the-art on WOMD and Argoverse |
| **Large Scale Interactive Motion Forecasting for Autonomous Driving: The Waymo Open Motion Dataset** (Ettinger et al.) | ICCV | 2021 | Introduced WOMD; 103K segments |

#### End-to-End Driving

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **EMMA: End-to-End Multimodal Model for Autonomous Driving** (Hwang et al.) | ICLR | 2025 | Gemini-based model mapping raw cameras to trajectories via natural language |

#### Simulation

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **SurfelGAN: Synthesizing Realistic Sensor Data for Autonomous Driving** (Yang et al.) | CVPR | 2020 | Surfel-based scene reconstruction + GAN for novel view synthesis |
| **SceneDiffuser: Efficient and Controllable Driving Simulation** | NeurIPS | 2024 | Diffusion-based traffic simulation; 16x fewer inference steps |
| **SceneDiffuser++: City-Scale Traffic Simulation via a Generative World Model** | -- | 2025 | First end-to-end generative world model for city-scale simulation |

#### Safety

| Paper | Venue | Year | Key Contribution |
|---|---|---|---|
| **Waymo's Safety Methodologies and Safety Readiness Determinations** | arXiv: 2011.00054 | 2020 | Formal safety framework: STPA, FTA, DFMEA, SRD process |
| **Comparison of Waymo Rider-Only Crash Data to Human Benchmarks at 7.1M Miles** (Kusano et al.) | Traffic Injury Prevention | 2024 | 85% crash reduction vs. human benchmark |
| **Comparison of Waymo Rider-Only Crash Rates at 56.7M Miles** (Kusano et al.) | Traffic Injury Prevention | 2025 | First statistically significant SSI+ comparison |

### Conference Presence

Waymo regularly publishes at and sponsors:
- **CVPR** (Computer Vision and Pattern Recognition)
- **NeurIPS** (Neural Information Processing Systems)
- **ICRA** (International Conference on Robotics and Automation)
- **ICLR** (International Conference on Learning Representations)
- **CoRL** (Conference on Robot Learning)
- **ICCV** (International Conference on Computer Vision)
- **ECCV** (European Conference on Computer Vision)
- **RSS** (Robotics: Science and Systems)
- **IV** (Intelligent Vehicles Symposium)

### Patent Portfolio

| Metric | Value |
|---|---|
| **Total Patents Globally** | 3,476 |
| **Unique Patent Families** | 1,077 |
| **USPTO Applications** | 1,237 |
| **USPTO Grants** | 929 |
| **Grant Rate** | 97.07% |
| **Active Patents** | 3,199 |
| **LiDAR Patents** | 626 |
| **Autopilot/Control Patents** | 186 |
| **Citation Impact** | 1.6x higher citation rate than Toyota; 2.3x higher than GM |
| **Core R&D Themes** | Autonomous vehicle, LiDAR sensor, light detection, trajectory planning |

---

## 16. Engineering Organization

### Leadership

| Name | Title | Focus |
|---|---|---|
| **Dmitri Dolgov** | Co-CEO | Technology, engineering, and research. Former CTO and VP of Engineering. PhD in robotics; designed Stanley's perception stack (DARPA Grand Challenge). At the project since 2009. |
| **Tekedra Mawakana** | Co-CEO | Business operations, commercialization, public policy. Joined Waymo in 2017. |
| **Dragomir (Drago) Anguelov** | VP, Head of AI Foundations (Research) | Leads research team focused on ML for autonomous driving. Joined Waymo 2018. Distinguished Scientist. |

### Historical Key Figures

| Name | Role | Contribution |
|---|---|---|
| **Sebastian Thrun** | Founding Lead | Stanford professor; led Project Chauffeur at Google X (2009-2013); built Stanley for DARPA Challenge |
| **Chris Urmson** | Engineering Lead | Led software development; CEO until departure in 2017; co-founded Aurora |
| **Anthony Levandowski** | Co-founder | Built first self-driving test vehicle; departed 2016; founded Otto (acquired by Uber); trade secret lawsuit |
| **John Krafcik** | CEO (2015-2021) | First dedicated CEO; led transition from project to company; launched Waymo One commercial service |
| **Nathaniel Fairfield** | VP, Engineering | Long-tenured engineering leader |

### Team Structure

Waymo's engineering organization is broadly organized into:

- **AI/ML Research** (led by Drago Anguelov): Perception, prediction, planning, simulation research
- **Systems Engineering**: Onboard software, hardware integration, real-time systems
- **Hardware**: Sensor design (LiDAR, radar, cameras), compute platform, vehicle integration
- **Simulation & Testing**: SimulationCity, Waymo World Model, closed-course testing
- **ML Infrastructure**: Training infrastructure, data pipelines, model deployment
- **Fleet Operations Engineering**: Remote assistance, dispatch optimization, fleet monitoring
- **Safety Engineering**: System safety, hazard analysis, validation & verification
- **Mapping**: HD map creation, localization, map maintenance

---

## 17. Competitive Differentiators

### What Makes Waymo Unique

| Differentiator | Detail |
|---|---|
| **Longest Track Record** | 17+ years of continuous AV development (since 2009), more than any competitor |
| **Most Autonomous Miles** | 200+ million real-world autonomous miles + 20+ billion simulated miles |
| **Vertical Integration of Sensors** | In-house LiDAR, radar, and camera design -- not reliant on third-party sensor companies |
| **Google/Alphabet Ecosystem** | Access to TPU pods, DeepMind research, Google Cloud, JAX/Gemini infrastructure |
| **Commercial Operations at Scale** | Only AV company operating commercial rider-only service in multiple major US cities |
| **Multi-Modal Sensor Fusion** | LiDAR + cameras + radar + audio (vs. Tesla's camera-only approach) |
| **HD Map + ML Hybrid** | Combines pre-built HD maps with learned perception/planning (vs. purely map-free or purely map-dependent) |
| **Foundation Model Architecture** | Production system uses end-to-end trained foundation model, benefiting from Gemini ecosystem |
| **Safety Record** | Peer-reviewed studies showing 85%+ crash reduction vs. human drivers |
| **Simulation Depth** | Waymo World Model (Genie 3-based) can generate training scenarios from any video input |

### Comparative Architecture: Waymo vs. Tesla

| Dimension | Waymo | Tesla |
|---|---|---|
| **Sensors** | LiDAR + cameras + radar + audio | Cameras only (vision-only) |
| **Maps** | Pre-built HD maps (cm-level) | No pre-built maps |
| **Deployment Model** | Robotaxi fleet (no private ownership) | Personal vehicle upgrade |
| **Training Data Source** | Own fleet (200M+ miles) + simulation (20B+ miles) | Customer fleet (4M+ vehicles, billions of miles) |
| **Hardware Cost Per Vehicle** | Higher (LiDAR + sensor suite: est. $10-15K) | Lower (cameras only: ~$400) |
| **Operational Domain** | Geo-fenced cities with HD maps | Any road (no geo-fencing) |
| **Autonomy Level** | SAE Level 4 (fully driverless in ODD) | SAE Level 2+ (driver supervision required) |
| **Revenue Model** | Ride-hailing revenue per trip | Software subscription ($99-199/month FSD) |
| **Compute (Training)** | Google TPU pods | Custom Dojo + NVIDIA GPU clusters |
| **Foundation Model** | Gemini-derived (EMMA) | Custom transformer (FSD v12+) |

### Key Advantages Over Competitors

1. **Vs. Cruise (GM)**: Cruise suspended operations in Oct 2023; Waymo has uninterrupted commercial service
2. **Vs. Tesla**: Waymo operates fully driverless (no safety driver); Tesla FSD requires driver supervision
3. **Vs. Baidu Apollo**: Waymo has US regulatory relationships and operates in more diverse US cities
4. **Vs. Zoox (Amazon)**: Waymo has larger fleet, more cities, more autonomous miles
5. **Vs. Mobileye**: Waymo operates its own fleet rather than licensing technology to OEMs only

---

## 18. Open Source & Datasets

### Waymo Open Dataset (WOD)

The Waymo Open Dataset is one of the largest and most diverse autonomous driving datasets publicly available.

**License**: Non-commercial use

#### Perception Dataset

| Attribute | Detail |
|---|---|
| **Segments** | 2,030 segments, each 20 seconds at 10 Hz |
| **Total Frames** | ~390,000 |
| **Cameras** | 5 high-resolution cameras (front, front-left, front-right, side-left, side-right) |
| **LiDAR** | Top LiDAR (100-200K points per sweep) |
| **Annotations** | 3D 7-DOF bounding boxes (vehicles, pedestrians, cyclists, signs) with globally unique tracking IDs |
| **Additional Labels** | 2D bounding boxes, panoptic segmentation, projected LiDAR on camera, per-pixel camera rays |
| **Label Quality** | Independent LiDAR and camera labels (not projections of each other) |
| **Bounding Box Constraints** | Zero pitch, zero roll |
| **Calibration** | Full intrinsic and extrinsic camera calibration provided |

#### Motion Dataset (WOMD)

| Attribute | Detail |
|---|---|
| **Segments** | 103,354 segments, each 20 seconds at 10 Hz |
| **Duration** | 570+ hours of unique data |
| **Road Coverage** | 1,750+ km of roadways |
| **Geographic Coverage** | 6 US cities |
| **Temporal Windows** | 9-second windows (1s history + 8s future) with varying overlap |
| **Auto-Labeling** | High-accuracy 3D auto-labeling system for all road agents |
| **HD Maps** | Corresponding high-definition 3D maps for each scene |
| **Data Format** | Sharded TFRecord files containing protocol buffer data |
| **Split** | 70% training, 15% testing, 15% validation |
| **v1.2.0 Addition** | LiDAR points for first 1 second of each 9-second window |
| **v1.3.1 (Oct 2025)** | Added `sdc_paths` feature indicating valid future routes for the SDC |

#### End-to-End Driving Dataset (WOD-E2E)

| Attribute | Detail |
|---|---|
| **Segments** | 4,021 segments, each 20 seconds |
| **Duration** | ~12 hours |
| **Focus** | Challenging long-tail scenarios (occurrence frequency <0.03%) |
| **Cameras** | 8 JPEG cameras (front, front-left, front-right, side-left, side-right, rear, rear-left, rear-right) at 10 Hz |
| **Resolution** | ~1920x1280 native; typically downsampled to 768x768 |
| **Camera FOV** | 70-90 degrees horizontal per camera; full 360-degree coverage |
| **Includes** | High-level routing information, ego states, 360-degree camera views |
| **Evaluation Metric** | Rater Feedback Score (RFS) -- measures match to human rater trajectory preference labels |
| **2025 Challenge** | WOD-E2E Challenge using held-out test set rater labels |

### Open Challenges

Waymo hosts annual challenges on its datasets:

| Challenge | Dataset | Task |
|---|---|---|
| **3D Detection** | WOD Perception | 3D object detection from LiDAR and/or camera |
| **3D Tracking** | WOD Perception | Multi-object tracking in 3D |
| **Motion Prediction** | WOMD | Multi-agent trajectory forecasting |
| **Sim Agents** | WOMD | Simulating realistic agent behavior |
| **Occupancy & Flow Prediction** | WOMD | Predicting future occupancy grids and flow fields |
| **End-to-End Driving** | WOD-E2E | Vision-based end-to-end driving in long-tail scenarios |

### GitHub Repositories

| Repository | Description |
|---|---|
| [`waymo-research/waymo-open-dataset`](https://github.com/waymo-research/waymo-open-dataset) | Official dataset tools, tutorials, and evaluation code |

### Access

- **Download**: [waymo.com/open/download](https://waymo.com/open/download)
- **Storage**: Google Cloud Storage buckets for programmatic access
- **API**: Python/TensorFlow API with tutorial notebooks
- **Dataset Format**: TFRecord with protocol buffers

---

## Sources

- [Waymo - Wikipedia](https://en.wikipedia.org/wiki/Waymo)
- [Waymo Stats 2025: Funding, Growth, Coverage, Fleet Size & More](https://www.thedriverlessdigest.com/p/waymo-stats-2025-funding-growth-coverage)
- [Waymo Statistics In 2026: Funding, Revenue & Rides Per Cities](https://awisee.com/blog/waymo-statistics/)
- [Waymo's 2025 Year in Review: The Year Robotaxis Scaled](https://www.thedriverlessdigest.com/p/waymos-2025-year-in-review-the-year)
- [Twelve Cities, $16 Billion, One Million Rides: Waymo's 2026 Blitz](https://www.goodcarbadcar.net/twelve-cities-16-billion-one-million-rides-waymos-2026-blitz/)
- [Meet the 6th-generation Waymo Driver](https://waymo.com/blog/2024/08/meet-the-6th-generation-waymo-driver/)
- [Beginning fully autonomous operations with the 6th-generation Waymo Driver](https://waymo.com/blog/2026/02/ro-on-6th-gen-waymo-driver/)
- [Introducing the 5th-generation Waymo Driver](https://waymo.com/blog/2020/03/introducing-5th-generation-waymo-driver/)
- [A look inside the sixth-generation Waymo Driver](https://www.wardsauto.com/news/archive-auto-waymo-6th-generation-driver-autonomous-driving-hardware-robotaxi-lidar-ai/725519/)
- [Zeekr RT, the robotaxi built for Waymo](https://techcrunch.com/2025/01/07/zeekr-rt-the-robotaxi-built-for-waymo-has-the-tiniest-wipers/)
- [Waymo's 6th-Generation Robotaxi Begins Full Autonomous Operations](https://fifthlevelconsulting.com/waymos-6th-generation-robotaxi-ojai/)
- [Scaling our fleet through U.S. manufacturing](https://waymo.com/blog/2025/05/scaling-our-fleet-through-us-manufacturing/)
- [Introducing Waymo's suite of custom-built, self-driving hardware](https://medium.com/waymo/introducing-waymos-suite-of-custom-built-self-driving-hardware-c47d1714563)
- [Sensing Breakdown: Waymo Jaguar I-Pace RoboTaxi](https://www.tangramvision.com/blog/sensing-breakdown-waymo-jaguar-i-pace-robotaxi)
- [EMMA: End-to-End Multimodal Model for Autonomous Driving (arXiv:2410.23262)](https://arxiv.org/abs/2410.23262)
- [Introducing EMMA](https://waymo.com/blog/2024/10/introducing-emma/)
- [AutoML: Automating the design of machine learning models for autonomous driving](https://waymo.com/blog/2019/01/automl-automating-design-of-machine)
- [The Waymo Driver Handbook: Perception](https://waymo.com/blog/2021/10/the-waymo-driver-handbook-perception/)
- [The Waymo Driver Handbook: Mapping](https://waymo.com/blog/2020/09/the-waymo-driver-handbook-mapping)
- [Simulation City](https://waymo.com/blog/2021/07/simulation-city)
- [The Waymo World Model: A New Frontier For Autonomous Driving Simulation](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [SurfelGAN: Synthesizing Realistic Sensor Data for Autonomous Driving](https://waymo.com/research/surfelgan-synthesizing-realistic-sensor-data-for-autonomous-driving/)
- [SceneDiffuser: Efficient and Controllable Driving Simulation](https://waymo.com/research/scenediffuser-efficient-and-controllable-driving-simulation-initialization/)
- [SceneDiffuser++: City-Scale Traffic Simulation](https://waymo.com/research/scenediffuser-city-scale-traffic-simulation-via-a-generative-world-model/)
- [Waymo Safety Report (2021)](https://downloads.ctfassets.net/sv23gofxcuiz/4gZ7ZUxd4SRj1D1W6z3rpR/2ea16814cdb42f9e8eb34cae4f30b35d/2021-03-waymo-safety-report.pdf)
- [Waymo Safety Impact](https://waymo.com/safety/impact/)
- [Waymo's Safety Methodologies and Safety Readiness Determinations (arXiv:2011.00054)](https://arxiv.org/pdf/2011.00054)
- [Comparison of Waymo Rider-Only crash rates at 56.7M miles (Kusano et al., 2025)](https://www.tandfonline.com/doi/full/10.1080/15389588.2025.2499887)
- [Comparison of Waymo rider-only crash data at 7.1M miles (Kusano et al., 2024)](https://www.tandfonline.com/doi/full/10.1080/15389588.2024.2380786)
- [Waymo Accidents | NHTSA Crash Data](https://www.damfirm.com/waymo-accident-statistics.html)
- [Waymo Safety Data Hub](https://waymo.com/blog/2024/09/safety-data-hub/)
- [Waymo and Uber Expand Partnership](https://waymo.com/blog/2024/09/waymo-and-uber-expand-partnership/)
- [Waymo, Magna to jointly build robotaxis at new Arizona factory](https://www.wardsauto.com/news/archive-auto-waymo-magna-to-jointly-build-robotaxis-arizona-facilty/747687/)
- [Daimler Trucks and Waymo partner on L4 autonomous trucks](https://www.daimlertruck.com/en/newsroom/pressrelease/daimler-trucks-and-waymo-partner-on-the-development-of-autonomous-sae-level-4-trucks-47893400)
- [Waymo Via backs away from autonomous trucking](https://www.freightwaves.com/news/waymo-via-backs-away-from-autonomous-trucking)
- [Waymo announces $16 billion funding round](https://www.cnbc.com/2026/02/02/waymo-announced-16-billion-fundraising-round.html)
- [Waymo raises $16B investment round](https://waymo.com/blog/2026/02/waymo-raises-usd16-billion-investment-round/)
- [Waymo Research Publications](https://waymo.com/research/)
- [Waymo Patents - Key Insights & Stats](https://insights.greyb.com/waymo-patents/)
- [About Waymo Open Dataset](https://waymo.com/open/about/)
- [Waymo Open Motion Dataset](https://waymo.com/intl/jp/open/data/motion/)
- [WOD-E2E: Waymo Open Dataset for End-to-End Driving (arXiv:2510.26125)](https://arxiv.org/abs/2510.26125)
- [Waymo Open Dataset GitHub](https://github.com/waymo-research/waymo-open-dataset)
- [PointPillars: Fast Encoders for Object Detection from Point Clouds (CVPR 2019)](https://openaccess.thecvf.com/content_CVPR_2019/html/Lang_PointPillars_Fast_Encoders_for_Object_Detection_From_Point_Clouds_CVPR_2019_paper.html)
- [VectorNet: Encoding HD Maps and Agent Dynamics](https://waymo.com/research/vectornet-encoding-hd-maps-and-agent-dynamics-from-vectorized-representation/)
- [MultiPath: Multiple Probabilistic Anchor Trajectory Hypotheses](https://waymo.com/research/multipath-multiple-probabilistic-anchor-trajectory-hypotheses-for-behavior-prediction/)
- [MultiPath++: Efficient Information Fusion and Trajectory Aggregation](https://waymo.com/research/multipath++-efficient-information-fusion-and-trajectory-aggregation-for-behavior-prediction/)
- [Waymo Trip Pricing](https://support.google.com/waymo/answer/9059184?hl=en)
- [Exclusive: Waymo rides cost more than Uber, Lyft](https://techcrunch.com/2025/06/12/waymo-rides-cost-more-than-uber-or-lyft-and-people-are-paying-anyway/)
- [The price gap between Waymo and Uber is narrowing](https://techcrunch.com/2026/01/27/the-price-gap-between-waymo-and-uber-is-narrowing/)
- [Next stop for Waymo One: Washington, D.C.](https://waymo.com/blog/2025/03/next-stop-for-waymo-one-washingtondc/)
- [Waymo Service Areas in the US: A Definitive Guide](https://fifthlevelconsulting.com/waymo-service-areas-in-the-u-s/)
- [2024 Disengagement Reports from California](https://thelastdriverlicenseholder.com/2025/02/03/2024-disengagement-reports-from-california/)
- [California DMV Disengagement Reports](https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/disengagement-reports/)
- [Waymo Achieves $350 Million Annual Revenue Run Rate](https://blockchain.news/ainews/waymo-achieves-350-million-annual-revenue-run-rate-impact-on-autonomous-vehicle-ai-market)
- [How Waymo went from secret Google project to dominant robotaxi company](https://abc7news.com/post/driverless-cars-waymo-history-secret-google-self-driving-car-project-robotaxi-company-darpa/16775642/)
- [Dmitri Dolgov - Wikipedia](https://en.wikipedia.org/wiki/Dmitri_Dolgov)
- [Tekedra Mawakana - Wikipedia](https://en.wikipedia.org/wiki/Tekedra_Mawakana)
- [Dragomir Anguelov - Waymo VP, Head of Research](https://rocketreach.co/dragomir-anguelov-email_17853130)
- [Google I/O Recap: AI and Self-Driving Cars](https://waymo.com/blog/2018/05/google-io-recap-turning-self-driving-cars-from-scifi-to-reality-with-ai/)
- [Bazel Build System](https://bazel.build/)
- [Tesla vs. Waymo vs. Cruise: Autonomous Vehicle Race](https://patentpc.com/blog/tesla-vs-waymo-vs-cruise-whos-leading-the-autonomous-vehicle-race-market-share-stats)
- [Waymo and Tesla's self-driving systems are more similar than people think](https://www.understandingai.org/p/waymo-and-teslas-self-driving-systems)
