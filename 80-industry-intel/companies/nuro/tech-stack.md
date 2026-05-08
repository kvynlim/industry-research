# Nuro: Autonomous Vehicle Technology Stack — Exhaustive Technical Writeup

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
10. [Safety Architecture](#10-safety-architecture)
11. [Fleet Operations](#11-fleet-operations)
12. [Key Partnerships](#12-key-partnerships)
13. [Regulatory](#13-regulatory)
14. [Pivot / Restructuring](#14-pivot--restructuring)
15. [Research & Publications](#15-research--publications)
16. [Competitive Position](#16-competitive-position)

---

## 1. Company Overview

### Founding & Leadership

| Detail | Value |
|---|---|
| **Founded** | September 2016 |
| **Founders** | Dave Ferguson & Jiajun Zhu |
| **HQ** | 1300 Terra Bella Avenue, Mountain View, CA |
| **Employees** | ~1,009 (January 2026) |
| **Peak Headcount** | ~1,400 (late 2022) |
| **Total Funding** | ~$2.34 billion across 7 rounds |
| **Current Valuation** | $6 billion (April 2025) |
| **Peak Valuation** | $8.6 billion (2021) |

**Dave Ferguson** — Co-founder and Co-CEO. Holds an MS and PhD in Robotics from Carnegie Mellon University and a BS in Computer Science and Mathematics from the University of Otago (New Zealand). Joined Google's self-driving car project (now Waymo) in 2011 as Principal Machine Learning Engineer. Led the planning group for CMU's winning team in the 2007 DARPA Urban Grand Challenge. Holds over 100 patents and has published over 60 academic papers with 24,600+ citations. One of his planning algorithms is currently used for long-range autonomy on NASA's Mars Rovers.

**Jiajun Zhu** — Co-founder and Co-CEO. Holds an MS in Computer Science from the University of Virginia and a BS from Fudan University. Was a founding team member of Google's self-driving car project, serving as Principal Software Engineer from 2008 to 2016. Led perception technology development and built/led Waymo's simulation efforts. Holds over 100 patents.

### Funding History

| Round | Date | Amount | Lead / Key Investors | Post-Money Valuation |
|---|---|---|---|---|
| Series A | June 2017 | $92M | Greylock, Banyan; NetEase founder Ding Lei | — |
| Series B | February 2019 | $940M | SoftBank Vision Fund | $2.7B |
| Series C | November 2020 | $500M | T. Rowe Price | $5.0B |
| Series D | November 2021 | $600M | Tiger Global, Google, Kroger | $8.6B |
| Series E (initial) | April 2025 | $106M | Kindred Ventures and others | ~$6.0B |
| Series E (close) | August 2025 | $97M + NVIDIA/Uber investment totaling $203M | Uber, NVIDIA | $6.0B |

Notable investors include: SoftBank Vision Fund, T. Rowe Price, Tiger Global, Fidelity, Greylock Partners, Google, Kroger, NVIDIA, and Uber.

### Key Milestones

| Year | Milestone |
|---|---|
| 2016 | Company founded by ex-Waymo engineers |
| 2018 (Jan) | First product launch: electric self-driving delivery vehicle concept with $92M funding |
| 2018 (Jun) | First partnership announced (Kroger) |
| 2018 (Aug) | First pilot: autonomous grocery delivery in Scottsdale, AZ (Toyota Prius + R1) |
| 2019 (Feb) | $940M Series B from SoftBank |
| 2020 (Feb) | First-ever NHTSA autonomous vehicle exemption granted (R2) |
| 2020 (Feb) | R2 begins testing in Houston, TX |
| 2021 (Aug) | $40M investment in southern Nevada manufacturing and test facilities |
| 2022 (Jan) | R3 unveiled with external airbag; BYD manufacturing partnership announced |
| 2022 (Sep) | 10-year autonomous delivery deal with Uber Eats |
| 2022–2023 | Multiple rounds of layoffs (~30% workforce reduction) |
| 2024 (Sep) | Business pivot: from delivery bot manufacturer to autonomy technology licensor |
| 2025 (Mar) | Lenovo partnership for autonomous driving on NVIDIA DRIVE |
| 2025 (Jul) | Nuro-Uber-Lucid robotaxi partnership announced (20,000+ vehicles) |
| 2025 (Aug) | $203M Series E close; NVIDIA and Uber invest |
| 2026 (Jan) | Lucid-Nuro-Uber robotaxi unveiled at CES 2026; autonomous on-road testing begins |

---

## 2. Vehicle Platform

Nuro pioneered the purpose-built, zero-occupant autonomous delivery vehicle — a form factor with no passenger compartment, approximately half the width of a standard sedan, designed exclusively for goods transport.

### Generation Comparison

| Specification | R1 (Gen 1) | R2 (Gen 2) | R3 (Gen 3) |
|---|---|---|---|
| **Year Introduced** | 2018 | 2020 | 2022 |
| **Status** | Retired prototype | Deployed | Paused (pivot) |
| **Length** | ~6 ft (1.8 m) | 108 in (274 cm) | ~20% smaller than avg passenger car |
| **Width** | ~Half a sedan | 43 in (110 cm) | Similar to R2 |
| **Height** | ~6 ft (1.8 m) | 73 in (186 cm) | — |
| **Weight** | ~1,500 lb (680 kg) | 2,535 lb (1,150 kg) | — |
| **Max Payload** | ~12 grocery bags | 419 lb (190 kg) | 500 lb (227 kg) / 24 bags |
| **Cargo Volume** | Baseline | Baseline | 2x R2 |
| **Max Speed** | Low-speed | 25 mph (40 km/h) | 45 mph (72 km/h) |
| **Battery** | — | 31 kWh (custom; all-day operation) | All-day single charge |
| **Drivetrain** | Electric | Electric | Electric (BYD Blade Battery) |
| **External Airbag** | No | No | Yes (Autoliv) |
| **Thermal Compartments** | No | Limited | Yes (heating/cooling) |
| **Manufacturing** | In-house | In-house | BYD (Lancaster, CA) + Nuro (NV) |
| **NHTSA Exemption** | No | Yes (first ever) | Planned but paused |

### R1 — First Generation

The R1 was Nuro's proof-of-concept prototype, demonstrating the world's first goods-only autonomous vehicle on public roads. It weighed approximately 1,500 lb, stood just over 6 feet tall, and was about half the width of a sedan. It had capacity for roughly 12 grocery bags. It was first deployed alongside modified Toyota Prius vehicles in the 2018 Kroger/Fry's pilot in Scottsdale, Arizona.

### R2 — Second Generation

The R2 was Nuro's first production-intent vehicle and the first autonomous vehicle to receive a federal exemption from NHTSA. Key design features:

- **Zero-occupant design**: No steering wheel, pedals, mirrors, or windshield wipers
- **Compact footprint**: 108 in long x 43 in wide x 73 in high — narrower than a standard vehicle lane
- **Dual compartments**: Two reconfigurable cargo bays with heating/cooling
- **Sensor array**: 12 high-definition cameras (360-degree overlapping FOV), roof-mounted LiDAR, and 14 additional LiDAR/radar units
- **Custom 31 kWh battery**: Nearly double the size of the R1 battery, enabling all-day operation
- **Redundant systems**: Dual computing, braking, steering, power, and sensor systems
- **SAE Level 4 autonomy**: Fully driverless within its operational design domain
- **Energy-absorbing front panel**: Purpose-designed crumple structure for pedestrian protection

### R3 — Third Generation

Unveiled in January 2022, the R3 was designed to be the first automotive-grade delivery vehicle produced at scale. Key advances:

- **Doubled cargo volume** vs R2 with modular storage inserts
- **500 lb payload capacity** with temperature-controlled compartments
- **45 mph top speed** (up from R2's 25 mph), enabling operation on more road types
- **External pedestrian airbag** by Autoliv — inflates across the entire front of the vehicle upon imminent collision detection
- **Multi-modal sensor suite** including cameras, radar, LiDAR, and thermal cameras with redundant 360-degree coverage
- **BYD manufacturing partnership**: BYD provides the Blade Battery, electric motors, electronic controls, and displays; assembles the hardware platform at its Lancaster, CA plant; Nuro completes autonomy system integration at its Nevada facility

R3 production was paused following the September 2024 business pivot.

### Post-Pivot: Robotaxi Platform (Lucid Gravity)

Following the 2024 pivot, Nuro's technology is being integrated into passenger vehicles. The flagship program is the Nuro-Uber-Lucid robotaxi:

- **Base vehicle**: Lucid Gravity SUV
- **Seating**: Up to 6 passengers with generous luggage space
- **Sensor integration**: High-resolution cameras, LiDAR, and radar with 360-degree awareness; sensors integrated into the vehicle body and a low-profile roof-mounted "Halo" module
- **Compute**: NVIDIA DRIVE AGX Thor
- **Autonomy**: Nuro Driver Level 4 self-driving system
- **Fleet commitment**: 20,000+ vehicles across dozens of US and international markets
- **Timeline**: On-road testing began early 2026; first rides via Uber app expected late 2026

---

## 3. Sensor Suite

Nuro employs a multi-modal sensing architecture designed for maximum redundancy and pedestrian safety. The suite has evolved through vehicle generations, with the latest next-generation architecture moving from traditional rotary LiDAR to distributed solid-state sensors.

### Sensor Modalities

| Sensor Type | Role | Key Characteristics |
|---|---|---|
| **Solid-State LiDAR** | Precise 3D depth measurement, object detection | Small form factor; no moving parts; enhanced long-range detection; improved side and rear visibility vs rotary LiDAR |
| **Automotive Cameras** | Object classification, semantic understanding | High-definition; 360-degree overlapping coverage (R2: 12 cameras); differentiate vehicles, pedestrians, cyclists, etc. |
| **Imaging Radar** | Distance/velocity measurement, inclement weather operation | Long-range; elevation data; improved velocity and angular resolution; detect small/distant objects in rain, fog, and snow |
| **Thermal Camera** | Pedestrian detection via infrared (heat) | Detects body heat instead of visible light; particularly effective at night and for partially occluded pedestrians; front-facing |
| **Microphone** | Emergency vehicle siren detection | Enhanced audio processing for directional siren identification |
| **IMU** | Inertial navigation, vehicle state estimation | Upgraded to ASIL-D rated (highest automotive safety integrity level) |

### R2 Sensor Configuration

- 12 high-definition cameras with 360-degree overlapping field of view
- 1 roof-mounted primary LiDAR
- 14 additional LiDAR/radar sensors for object detection and velocity estimation
- Thermal camera (front-facing)

### Next-Generation Sensor Architecture (Nuro Driver Platform)

The next-generation architecture was designed for cross-platform deployment (delivery bots, robotaxis, passenger vehicles):

- **Distributed solid-state LiDAR**: Replaces single rotary unit; multiple small sensors mounted around the vehicle perimeter for enhanced coverage and reliability; fewer moving parts for better manufacturing and durability
- **Automotive-grade cameras**: Arranged for redundant 360-degree FOV with overlapping coverage zones
- **Long-range imaging radar**: High-resolution sensors for detecting distance and depth of small, distant objects including road debris, animals, and vulnerable road users
- **Thermal cameras**: Independent pedestrian detection modality
- **Halo module** (robotaxi): Low-profile roof-mounted sensor pod integrating cameras, LiDAR, and radar into the vehicle body design

The unified perception system ingests synchronized data from approximately 30 individual sensors, including multiple long-range and short-range cameras, LiDARs, and radars.

All sensors demonstrated significant improvements in challenging weather conditions and long-distance detection of road debris, animals, and vulnerable road users (cyclists, pedestrians) during validation testing.

---

## 4. Onboard Compute

### Current Platform: NVIDIA DRIVE AGX Thor

In March 2024, Nuro announced that the next generation of its Nuro Driver system would be built on the NVIDIA DRIVE Thor compute platform.

| Specification | Detail |
|---|---|
| **SoC** | NVIDIA DRIVE Thor |
| **Architecture** | NVIDIA Blackwell (designed for transformer, LLM, and generative AI workloads) |
| **AI Compute (single SoC)** | Up to 1,000 TFLOPS (FP8/INT8) |
| **AI Compute (dual SoC)** | Up to 2,000 TFLOPS (FP8/INT8) |
| **Operating System** | NVIDIA DriveOS (safety-certified) |
| **Functional Safety** | Designed for highest levels of automotive functional safety; 15,000+ engineering years invested by NVIDIA across the full stack |
| **Consolidation** | Sensor processing, AI-first autonomy, and safety-critical components unified on a single centralized compute unit |

### Architecture Design Rationale

By building on DRIVE Thor, Nuro consolidates all intelligent vehicle functions — sensor processing, AI inference, planning, and safety monitoring — into a centralized SoC. This eliminates the need for multiple discrete compute modules, reducing system complexity, weight, power consumption, and cost.

The Blackwell architecture is purpose-designed for the large transformer and foundation model workloads that form the core of Nuro's AI-first autonomy approach. The platform supports:

- Real-time multi-sensor fusion across ~30 sensors
- Unified perception foundation model inference
- Prediction and planning model execution
- Safety monitoring and fallback systems
- Vehicle control and actuation

### Lenovo AD1 Domain Controller

Through the Lenovo partnership (March 2025), Nuro's autonomy software is also being integrated with Lenovo's AD1 domain controller, which is itself built on the NVIDIA DRIVE AGX platform featuring the DRIVE AGX Thor SoC and DriveOS. This provides an additional hardware pathway for OEM customers.

### FTL Model Compiler Framework

Nuro developed the **Faster Than Light (FTL) Compiler Framework**, a custom ML model optimization toolchain for deploying models to onboard compute:

- Ingests models from multiple training frameworks (TensorFlow, PyTorch)
- Applies multiple industry compilers in a single compilation pass within a customizable Python environment
- Supports **multi-GPU inference** using pipeline parallelism (splits model via subgraphs across devices)
- Supports **quantization** for reduced precision inference
- Has delivered significant reductions in CPU compute utilization, GPU compute utilization, and GPU memory consumption
- Provides a unified optimization platform — a single code change delivers performance improvements to all models
- Enables non-ML-infra teams (e.g., onboard performance) to optimize CPU utilization and upgrade CUDA APIs

### Redundancy

All vehicle platforms feature redundant computing, braking, steering, power, and sensor systems to ensure the vehicle can safely come to a controlled stop if any single system fails.

---

## 5. Autonomy Software Stack

The core autonomy platform is called **Nuro Driver** — a complete Level 4 self-driving system that integrates perception, prediction, planning, and control. It has been successfully integrated into seven different vehicle platforms including delivery robots, passenger vehicles, and trucks, and has been proven on roads across three US states.

### Stack Components

```
┌─────────────────────────────────────────────────────┐
│                   NURO DRIVER                       │
├──────────┬──────────┬───────────┬──────────────────┤
│ Percep-  │ Predic-  │ Planning  │ Vehicle          │
│ tion     │ tion     │           │ Control          │
├──────────┴──────────┴───────────┴──────────────────┤
│          Unified Perception Foundation Model        │
├────────────────────────────────────────────────────-┤
│          Sensor Fusion (Voxel Feature Space)        │
├──────────┬──────────┬───────────┬──────────────────┤
│ Camera   │ LiDAR    │ Radar     │ Thermal /        │
│ Encoder  │ Encoder  │ Encoder   │ Other Encoders   │
├──────────┴──────────┴───────────┴──────────────────┤
│          HD Map & Localization Layer                │
├─────────────────────────────────────────────────────┤
│          NVIDIA DRIVE Thor / DriveOS               │
└─────────────────────────────────────────────────────┘
```

### Perception

Nuro's perception system uses an **ML-first architecture with robust fallbacks**. It fuses data from cameras, LiDAR, radar, and thermal sensors to detect and track objects including pedestrians, vehicles, cyclists, animals, and road debris.

Key characteristics:
- **Unified Perception Model**: A single foundation model processes all sensor inputs rather than separate per-sensor pipelines
- **Independent multimodal sensor encoders** feed into a **unified voxel feature space**
- **Sensor fusion module** transforms features from native formats into the shared voxel representation
- **Temporal modeling** aligns spatial features across time steps (T to T-n) and generates spatial-temporal features with stateful temporal consistency
- Input from ~30 individual sensors (multiple long-range and short-range cameras, LiDARs, radars)
- Vision Transformer (ViT) architecture integration (boosted emergency vehicle detection by 5%)

### Prediction

The prediction module analyzes the intents of other traffic agents (vehicles, pedestrians, cyclists) and forecasts their future behavior using machine learning models. This is critical for the delivery use case where the vehicle frequently operates in residential neighborhoods with less predictable pedestrian behavior (children, pets, etc.).

### Planning

The planning system determines the vehicle's path and actions based on perceived environment state and predicted agent behaviors. Key features:
- **Reinforcement learning-assisted plan selection**: Improved pullover and pullout maneuvers for smoother operation
- **Human feedback reward models**: Incorporated into behavior models with active learning to encourage safer driving in various conditions
- **Delivery-specific priorities**: Optimized for frequent stops, residential navigation, curbside approaches, and double-parking avoidance — different from passenger AV planning which prioritizes route efficiency and passenger comfort
- **Zero-occupant advantage**: The vehicle can maneuver and brake in ways that would be uncomfortable or unsafe for passengers (e.g., harder emergency braking), reducing collision risk

### Control

Low-level vehicle control translating planned trajectories into actuator commands (steering, acceleration, braking). The zero-occupant form factor allows more aggressive safety maneuvers since there is no concern about passenger comfort or injury from abrupt movements.

### AI-First Architecture

Nuro describes its approach as "AI-first," meaning:
- One to two very large foundational AI models perform many tasks (mapping, localization, perception, prediction, planning) in a single integrated architecture
- This contrasts with traditional AV stacks that use many separate, hand-tuned modules
- The approach enables rapid adaptation to new environments, vehicle types, and functions
- Significantly reduces deployment timelines for new OEM customers

---

## 6. Machine Learning & AI

### Unified Perception Foundation Model

Nuro's core ML architecture centers on a **Unified Perception Foundation Model** — a single large model that processes all sensor modalities and outputs multiple perception tasks simultaneously.

**Architecture details:**

1. **Independent Multimodal Sensor Encoders**: Each sensor modality (camera, LiDAR, radar) has its own encoder that processes raw sensor data into intermediate features
2. **Image Encoder Pretraining**: The image encoder is pretrained on large-scale image datasets, improving performance on all downstream tasks and facilitating integration with other foundation models
3. **Sensor Fusion Module**: Transforms encoded features from native sensor formats into a **unified voxel feature space**, generating multi-modal spatial features
4. **Temporal Module**: Aligns spatial features from time T to T-n and fuses them into spatial-temporal features; performs stateful temporal modeling for consistency, conditioning on spatial-temporal features at T and task features/queries from T-1 to T-n
5. **Task Heads**: Downstream task-specific heads for detection, tracking, classification, segmentation, etc.

**Design goals:**
- Cross-platform compatibility: A single foundational model can be trained once and exported/deployed across different vehicle platforms with efficient post-training adaptation
- Open vocabulary capabilities being integrated using feature extractors from multimodal language models (VLMs)
- End goal: a fully end-to-end learnable autonomy system meeting L4 performance and safety requirements

### Reinforcement Learning

Nuro has built a scalable RL training infrastructure for autonomous driving:

- **Distributed training**: Scales across GPU/TPU resources and parallel simulations
- **Training throughput**: Can train models on decades worth of driving experience in hours
- **Abstracted communication and simulation**: Researchers can plug in new agent architectures and algorithms to test state-of-the-art RL methods
- **Closed-loop training**: RL agents train in simulation with realistic dynamics and traffic
- **Applications**: Plan selection (pullover/pullout), behavior modeling, driving policy refinement
- **Human feedback**: Reward models incorporate human preferences via active learning for safer driving behavior

### Training Infrastructure

| Component | Detail |
|---|---|
| **Accelerators** | NVIDIA V100, A100, H100 GPUs; Google TPUs |
| **Preferred for transformers** | TPUs (more cost-effective for XLA-compatible transformer models) |
| **Hosting** | Google Kubernetes Engine (GKE) |
| **Scheduling** | Custom **Nuro ML Scheduler** |
| **Training type** | Large-scale distributed training; many jobs per day |

**Nuro ML Scheduler** features:
- Accepts training jobs from users and allocates appropriate accelerator resources
- Complements (does not replace) the Kubernetes scheduler
- Intelligently preempts jobs to yield to higher-priority work and enforce group quotas
- Automatically selects the best accelerator type per job based on quota and resource availability
- Handles multi-accelerator job placement across heterogeneous hardware

### Model Deployment Pipeline

1. **Training** on cloud TPU/GPU clusters via Nuro ML Scheduler
2. **Compilation** through FTL Model Compiler Framework (supports TensorFlow, PyTorch)
3. **Optimization** including quantization, multi-GPU pipeline parallelism
4. **Deployment** to onboard NVIDIA DRIVE Thor compute
5. **Validation** through simulation and closed-course testing before road deployment

---

## 7. Mapping & Localization

### HD Mapping Pipeline

Nuro builds its own high-definition maps for all operational areas through an automated cloud-based pipeline:

| Aspect | Detail |
|---|---|
| **Generation method** | Automated pipeline combining robotics, ML, and human verification |
| **Resolution** | Centimeter-level detail |
| **Content** | Lanes, traffic lights, crosswalks, road features, curbs, driveways |
| **Data sources** | On-road sensor data (collected via Prius sensor stacks and AV fleet), aerial imagery, satellite data |
| **Scalability** | Designed to support rapid expansion to new delivery areas and cities |

### Scalable HD Mapping Approach

Nuro introduced a novel approach that **fuses offline map priors with online sensor data**:

- The model consumes both out-of-date offline semantic map features and real-time online sensor measurements
- It learns to **pass through the offline HD map prior when correct** but remains robust to map changes and low-quality labeling
- This addresses the fundamental challenge of HD map maintenance — maps become stale as road infrastructure changes

### Geospatial Foundation Model

Nuro is developing a **geospatial foundation model** for mapping and localization:

- Combines real-time perception data with low-cost map priors
- Enables:
  - **Precision global localization** (centimeter-level position tracking at all times)
  - **Online map feature inference** (real-time map updates from sensor data)
  - **Real-time sensor calibration**

### Learned Localization

The localization architecture features:

- **Online encoder**: Consumes onboard LiDAR point cloud data
- **Geospatial encoder**: Consumes aerial digital surface models (DSM) and/or satellite imagery
- **Cross-correlation alignment**: Embedding images are aligned by computing cross-correlation over a search window of possible x, y, and theta offsets
- This "aerial-ground" localization approach bridges satellite/aerial map data with street-level sensor data, reducing dependence on expensive HD map maintenance

---

## 8. Simulation Platform

Nuro employs a three-tier testing methodology: virtual simulation, closed-course physical testing, and real-world on-road validation.

### Virtual Simulation

| Capability | Detail |
|---|---|
| **Data source** | Previously collected real-world sensor data from public roads |
| **Environment** | Virtual reconstruction of real environments using sensor data |
| **Augmentation** | Synthetic augmentation of real data to enhance realism and scenario coverage |
| **Smart agents** | AI-driven traffic participants with realistic behavior |
| **Fault injection** | Ability to inject faults and measure latency for "what if" scenarios |
| **Metrics** | 2,000+ user-configurable autonomy metrics for evaluation and analytics |
| **Scale** | Millions of test scenarios generated automatically |

### Foretellix Partnership

In January 2024, Nuro partnered with **Foretellix** (now part of NVIDIA) for advanced virtual testing:

- Automatically generates millions of relevant and meaningful test scenarios
- Ensures proper **Operational Design Domain (ODD) coverage**
- Uncovers edge cases that might pose safety risks
- Reduces R&D costs through more efficient virtual validation
- Leverages Foretellix's scenario-based testing standards

### Closed-Course Testing Facility

Nuro invested $40M in facilities in southern Nevada, including a world-class closed-course track:

| Facility Detail | Specification |
|---|---|
| **Location** | Las Vegas Motor Speedway, NV |
| **Size** | 74 acres |
| **Scenario types** | Pedestrian avoidance, pet avoidance, cyclist interaction, shared roadway navigation |
| **Additional testing** | Environmental tests, vehicle systems validation |
| **Purpose** | Bridge between simulation and real-world deployment |

### Real-World Validation

- L4 driverless releases undergo testing across **40 validation categories** before public road approval
- Strict control and risk assessment procedures govern all deployments
- **Safety Committee** conducts daily performance and safety monitoring
- Crash reporting within 24 hours (NHTSA requirement)

### Testing Pipeline

```
Simulation (millions of scenarios)
    → Closed-Course (controlled physical tests)
        → Limited Real-World (geofenced ODD)
            → Expanded Deployment (validated ODD)
```

---

## 9. Cloud & Data Infrastructure

### Cloud Platform

Nuro's cloud infrastructure runs primarily on **Google Cloud Platform (GCP)**:

| Component | Technology |
|---|---|
| **Compute orchestration** | Google Kubernetes Engine (GKE) |
| **ML training accelerators** | NVIDIA V100, A100, H100 GPUs; Google Cloud TPUs |
| **ML job scheduling** | Custom Nuro ML Scheduler (on top of Kubernetes) |
| **Simulation** | Cloud-based replay and scenario generation |
| **HD map pipeline** | Automated cloud pipeline (robotics + ML + human verification) |
| **Data storage** | Large-scale sensor data lakes (camera, LiDAR, radar logs from fleet) |
| **Evaluation tooling** | 2,000+ configurable metrics computed at scale from on-road and simulation logs |

### Data Pipeline

1. **Collection**: Fleet vehicles collect multi-sensor data (camera, LiDAR, radar, IMU, GPS) during all on-road operations
2. **Upload**: Data transferred to cloud storage infrastructure
3. **Processing**: Automated pipelines process raw sensor data for training, mapping, and evaluation
4. **Training**: ML models trained on cloud GPU/TPU clusters via Nuro ML Scheduler
5. **Evaluation**: Simulation re-plays real-world scenarios with new model versions; 2,000+ metrics computed
6. **Deployment**: Validated models compiled via FTL and pushed to vehicle fleet

### Resource Management

The Nuro ML Scheduler provides sophisticated resource management:
- Multi-tenant scheduling across heterogeneous accelerator types
- Priority-based preemption for critical training jobs
- Quota enforcement across engineering groups
- Automatic accelerator type selection based on model architecture and availability
- Support for distributed training across multiple nodes

---

## 10. Safety Architecture

Nuro's safety philosophy is fundamentally shaped by its **zero-occupant vehicle design** — eliminating the most vulnerable person in any vehicle collision (the passenger) allows radical re-optimization of the entire safety envelope toward protecting people outside the vehicle.

### Zero-Occupant Safety Advantages

| Advantage | Explanation |
|---|---|
| **No passenger risk** | Zero occupants means no risk of passenger injury in any scenario |
| **Aggressive braking** | Vehicle can execute emergency stops that would injure passengers in a conventional car |
| **Sacrificial maneuvers** | Vehicle can prioritize external safety even at cost of vehicle damage |
| **Lower mass** | Lighter vehicle = lower kinetic energy in collision |
| **Lower speed** | Purpose-built for 25-45 mph operation (R2/R3) |
| **No human error** | Eliminates distracted/impaired/fatigued driving |

### External Pedestrian Airbag (R3)

The R3 features an industry-first **exterior pedestrian airbag** developed in partnership with **Autoliv** (global automotive safety supplier):

- Airbag covers the **entire front surface** of the vehicle when inflated
- Triggers upon detection of imminent frontal collision
- Optimized to reduce the force of impact on pedestrians and cyclists
- Supported by Nuro's network of self-cleaning sensors providing 360-degree awareness
- Complements the energy-absorbing front panel crumple structure

### Energy-Absorbing Front Panel

All Nuro vehicles feature a purpose-designed front structure that absorbs collision energy, reducing force transmitted to a struck pedestrian. Unlike passenger vehicles where the front structure must also protect occupants, Nuro's entire front can be optimized exclusively for external impact absorption.

### System Redundancy

| System | Redundancy |
|---|---|
| **Computing** | Dual compute systems |
| **Braking** | Redundant braking |
| **Steering** | Redundant steering |
| **Power** | Redundant power supply |
| **Sensors** | Overlapping sensor coverage from multiple modalities |

If any primary system fails, redundant systems ensure the vehicle can execute a safe stop.

### Safety Testing & Validation

- 40 validation categories tested before every L4 driverless release
- Safety Committee conducts daily performance monitoring
- Partnership with Foretellix for automated edge-case scenario discovery
- Closed-course testing at 74-acre Las Vegas facility for physical scenario validation
- 24-hour crash reporting to NHTSA
- Regular meetings with NHTSA during exemption periods
- Community outreach in deployment areas

### IMU Safety Rating

The next-generation sensor architecture includes an upgraded inertial measurement unit rated at **ASIL-D** (Automotive Safety Integrity Level D) — the highest safety integrity level defined in ISO 26262 for automotive functional safety.

---

## 11. Fleet Operations

### Deployment History

| Location | Period | Status | Partners | Notes |
|---|---|---|---|---|
| **Scottsdale, AZ** | Aug 2018 – 2019 | Closed | Kroger/Fry's | First pilot; Toyota Prius + R1 vehicles |
| **Phoenix, AZ** | 2018 – Oct 2022 | Closed | Kroger | Depot closed Oct 2022; removed from commercial roadmap |
| **Houston, TX** | Apr 2019 – present | Active | Kroger, Walmart, Domino's, FedEx, Uber Eats | Primary operational hub; R2 deployment; 70% increase in deployment linear miles |
| **Mountain View / Palo Alto, CA** | 2020 – present | Active | Uber Eats | HQ area operations; 83% increase in deployment linear miles |
| **San Francisco Bay Area** | 2026 – present | Testing | Uber/Lucid robotaxi | Robotaxi prototype testing with safety operators |

### Operational Capabilities

- **Driverless operation**: Fully autonomous Level 4 delivery service without safety drivers in approved areas
- **Delivery workflow**: Customer orders online, vehicle navigates to store, store staff loads cargo, vehicle delivers to customer address, customer retrieves from compartment via app
- **Temperature control**: Heated and cooled compartments keep food fresh
- **All-day operation**: Custom battery enables full-day operation on a single charge
- **Tens of thousands of deliveries** completed for partners including Kroger and Uber Eats

### Expansion Post-Pivot

Following the 2024 pivot, Nuro's fleet operations are transitioning:
- **Delivery operations**: Continue in Houston and Mountain View/Palo Alto
- **Robotaxi testing**: Engineering prototypes with safety operators in San Francisco Bay Area (early 2026)
- **Future robotaxi launch**: First Uber-native robotaxi rides expected in a major US city via the Uber app in late 2026, with plans for dozens of US and international markets

---

## 12. Key Partnerships

### Retail & Delivery Partners

| Partner | Year | Relationship | Details |
|---|---|---|---|
| **Kroger** | 2018 | Strategic grocery delivery | First commercial partner; pilot at Fry's in Scottsdale, AZ; expanded to Houston; Kroger also a Series D investor |
| **Domino's** | 2019 | Pizza delivery | Pilot in Houston; autonomous R2 pizza delivery |
| **Walmart** | 2019 | Grocery delivery | Pilot in Houston using R2 and Toyota Prius vehicles; customer opt-in program |
| **CVS Pharmacy** | 2020 | Prescription delivery | Autonomous prescription delivery pilot |
| **FedEx** | 2021 | Parcel logistics | Pilot in Houston; Nuro's first foray into package/parcel delivery |
| **Uber Eats** | 2022 | Food delivery (10-year deal) | Autonomous delivery service in California and Texas |

### Technology & Manufacturing Partners

| Partner | Year | Relationship | Details |
|---|---|---|---|
| **BYD** | 2022 | R3 manufacturing | BYD provides Blade Battery, motors, electronics; assembles at Lancaster, CA plant; Nuro completes autonomy integration in NV. Partnership paused in 2024 pivot. |
| **NVIDIA** | 2024 | Compute platform & investor | DRIVE Thor SoC for Nuro Driver; NVIDIA invested in Series E; 15,000+ engineering years of safety development in DRIVE platform |
| **Autoliv** | 2022 | External airbag | Designed and supplies exterior pedestrian airbag for R3 |
| **Foretellix** | 2024 | Simulation & testing | Automated scenario generation for virtual validation; ODD coverage assurance |
| **Lenovo** | 2025 | Domain controller & go-to-market | AD1 domain controller on NVIDIA DRIVE AGX; accelerating commercial AV deployment for OEMs |

### Mobility & Robotaxi Partners

| Partner | Year | Relationship | Details |
|---|---|---|---|
| **Uber** | 2022 / 2025 | Delivery + robotaxi | 10-year delivery deal (2022); $300M investment in Lucid for robotaxi program (2025); committed to 20,000+ robotaxis; investor in Nuro Series E |
| **Lucid Motors** | 2025 | Robotaxi vehicle platform | Lucid Gravity SUV as base platform; Uber investing $300M in Lucid; unveiled at CES 2026; testing began early 2026 |

### Serve Robotics Clarification

Nuro and **Serve Robotics** (NASDAQ: SERV) are **separate, competing companies** in the autonomous delivery space. Serve Robotics originated as Postmates X (Postmates' robotics division, founded 2017), was acquired by Uber with Postmates in 2020, and spun out as an independent company in 2021. Serve focuses on smaller sidewalk robots operating at low speeds within a 2-mile radius, while Nuro operates larger road vehicles at higher speeds. Both companies have relationships with Uber but are independent competitors.

---

## 13. Regulatory

### NHTSA Exemption (February 2020) — First Ever

Nuro's R2 became the **first autonomous vehicle in history** to receive a federal exemption from the National Highway Traffic Safety Administration (NHTSA).

| Detail | Specification |
|---|---|
| **Vehicle** | R2 (R2X designation in filing) |
| **SAE Level** | Level 4 (highly automated) |
| **Max speed** | 25 mph |
| **Drivetrain** | Electric |
| **Occupants** | Zero (no human occupant by design) |
| **Exempted standard** | FMVSS No. 500 (low-speed vehicle requirements) |
| **Exemption basis** | (1) Facilitates development of low-emission vehicle without unreasonably lowering safety; (2) Compliance would prevent sale of a vehicle with equal or better overall safety |
| **Production limit** | No more than 5,000 R2 vehicles during 2-year exemption period |
| **Reporting requirements** | 24-hour crash reporting; regular NHTSA meetings; community outreach in operational areas |
| **Significance** | First time NHTSA granted exemption for an autonomous vehicle without standard safety/control equipment (steering wheel, pedals, mirrors, etc.) |

### What Was Exempted

The R2 lacks conventional vehicle controls because it has no human occupant:
- No steering wheel or control column
- No brake/accelerator pedals
- No side mirrors
- No windshield wipers
- No standard occupant protection (airbags, seatbelts)

These absences would normally violate Federal Motor Vehicle Safety Standards, but NHTSA determined the overall safety level was at least equal to conventional vehicles given the zero-occupant design and comprehensive AV safety systems.

### California DMV Permits

| Permit | Significance |
|---|---|
| **Driverless testing permit** | One of only 6 companies approved for driverless testing in California |
| **Autonomous vehicle deployment permit** | First-ever CA DMV AV deployment permit for commercial delivery service |
| **Commercial operations** | One of only 3 companies with permits allowing commercial autonomous operations in CA (alongside Mercedes-Benz and Waymo) |

### Texas Operations

Texas has a more permissive regulatory framework for autonomous vehicles, allowing Nuro to operate with fewer permit restrictions. Nuro has conducted commercial deployments and driverless testing in Houston and surrounding areas.

---

## 14. Pivot / Restructuring

### Timeline of Changes

| Date | Event |
|---|---|
| **Late 2022** | First round of layoffs; headcount begins declining from ~1,400 peak |
| **2023** | Multiple additional layoff rounds; ~30% (340 employees) cut in largest single reduction |
| **2024 (early)** | R3 production with BYD paused |
| **September 2024** | Formal business pivot announced |
| **2025–2026** | New partnerships (NVIDIA, Uber, Lucid, Lenovo) under new strategy |

### From Builder to Licensor

**Before the pivot** (2016–2024):
- Nuro designed, manufactured, and operated its own custom delivery robots
- End-to-end vertical integration: vehicle design, sensor suite, autonomy software, fleet operations
- Revenue model: delivery service fees from retail partners

**After the pivot** (September 2024–present):
- Nuro licenses its **Nuro Driver** autonomous driving software and sensor platform to OEMs, suppliers, and mobility providers
- No longer manufactures its own vehicles
- Paused BYD partnership for R3 production
- Workforce stabilized at ~1,000 employees (down from 1,400 peak)

### Two Go-to-Market Strategies

1. **Full L4 Autonomous Driving Product**: Complete self-driving system for goods delivery and passenger mobility services (e.g., Uber robotaxi program)
2. **OEM/Supplier Licensing**: Working with automakers and Tier 1 suppliers to build automated driving products for consumer vehicles ranging from Level 2 to Level 4

### Rationale

The pivot reflects the reality that building and operating a custom delivery vehicle fleet is extremely capital-intensive. By licensing technology, Nuro can:
- Reach massive scale through OEM production volumes (20,000+ Lucid robotaxis vs hundreds of R2s)
- Reduce capex requirements (no manufacturing)
- Access new markets (passenger vehicles, trucks, consumer cars)
- Generate recurring software licensing revenue
- Leverage the Nuro Driver's proven cross-platform adaptability (integrated into 7 vehicle platforms)

---

## 15. Research & Publications

### Founders' Academic Background

**Dave Ferguson:**
- PhD and MS in Robotics, Carnegie Mellon University
- BS in Computer Science and Mathematics, University of Otago
- 60+ peer-reviewed academic publications
- 100+ patents
- 24,600+ citations on Google Scholar
- Led CMU's planning group for the winning 2007 DARPA Urban Grand Challenge entry
- Algorithm currently used for Mars Rover long-range autonomy (NASA)
- Research areas: motion planning, path planning, field robotics, machine learning for robotics

**Jiajun Zhu:**
- MS in Computer Science, University of Virginia
- BS from Fudan University
- 100+ patents
- Founding team member of Google's self-driving car project (Waymo)
- Research areas: perception systems, simulation for autonomous vehicles

### Published Technical Blog Posts

Nuro's engineering team has published detailed technical content on their approaches:

| Topic | Key Content |
|---|---|
| **The Nuro Autonomy Stack** | End-to-end description of perception, prediction, planning, control |
| **Unified Perception Model** | Foundation model architecture with voxel representations and multimodal sensor encoders |
| **Scaling ML Training at Nuro** | Nuro ML Scheduler, TPU/GPU infrastructure, distributed training |
| **FTL Model Compiler Framework** | Custom ML inference optimization, multi-GPU pipeline parallelism, quantization |
| **Exploring HD Mapping that Scales** | Offline-online map fusion, scalable HD map generation |
| **Learned Localization** | Aerial-ground localization bridging satellite imagery with LiDAR |
| **Enabling Reinforcement Learning at Scale** | Distributed RL training, closed-loop simulation, decades of experience in hours |
| **Safety @ Nuro: Our Vehicles** | Redundancy design, pedestrian safety philosophy |
| **Safety @ Nuro: Testing** | Three-tier testing methodology (simulation, closed-course, real-world) |
| **Next-Generation Sensor Architecture** | Solid-state LiDAR, ASIL-D IMU, distributed sensor design |

### Patent Portfolio

Both co-founders hold 100+ patents each (200+ combined), covering:
- Autonomous vehicle perception and detection
- Motion planning and trajectory optimization
- Simulation and virtual testing
- Sensor fusion architectures
- Delivery vehicle design and safety systems
- HD mapping and localization

---

## 16. Competitive Position

### Autonomous Delivery Landscape

| Company | Vehicle Type | Operating Surface | Speed | Status (as of early 2026) |
|---|---|---|---|---|
| **Nuro** | Half-width road vehicle / Robotaxi platform | Public roads | 25–45 mph | Active (pivoted to licensing); robotaxi testing underway |
| **Starship Technologies** | Small 6-wheeled robot | Sidewalks | ~4 mph | Active; 2,000+ bots deployed; 8M+ deliveries completed globally |
| **Amazon Scout** | Small 6-wheeled robot | Sidewalks | Low | **Discontinued** (2022); failed to meet performance targets |
| **Serve Robotics** (SERV) | Small sidewalk robot | Sidewalks | Low | Active; publicly traded (NASDAQ: SERV); Uber Eats partnership |
| **Kiwibot** | Small sidewalk robot | Sidewalks | Low | Active; university campus focus |
| **Waymo (via partners)** | Full-size passenger vehicles | Public roads | Full speed | Active in ride-hailing; exploring delivery |
| **Gatik** | Box trucks | Public roads | Full speed | Active; middle-mile B2B delivery |

### Nuro's Competitive Advantages

1. **First-mover on NHTSA exemption**: Only company to receive federal autonomous vehicle exemption; regulatory credibility with NHTSA and California DMV
2. **Purpose-built zero-occupant design**: Enables unique safety optimizations (external airbag, aggressive braking, pedestrian-first design) impossible in passenger vehicles
3. **Road operation (not sidewalk)**: Operates at vehicle speeds on public roads, enabling faster delivery over longer distances than sidewalk bots
4. **L4 technology platform**: Proven autonomy system integrated across 7 vehicle platforms; licensable to OEMs
5. **Deep partnerships**: 10-year Uber Eats deal; 20,000+ vehicle Uber/Lucid robotaxi commitment; NVIDIA strategic investment; Lenovo go-to-market collaboration
6. **Founder pedigree**: Both co-founders are senior Waymo alumni with deep AV expertise; combined 200+ patents
7. **Pivot to platform play**: Licensing model allows scale through OEM manufacturing rather than capital-intensive self-manufacturing

### Nuro's Challenges

1. **Valuation decline**: Down from $8.6B peak (2021) to $6B (2025) — a 30% reduction
2. **Workforce reduction**: From ~1,400 to ~1,000 employees through multiple layoff rounds
3. **R3 not in production**: Third-generation delivery vehicle paused; BYD partnership suspended
4. **Limited delivery fleet**: R2 fleet remains small compared to Starship's 2,000+ deployed bots
5. **Pivot risk**: Transitioning from vehicle builder to technology licensor is a fundamental business model change
6. **Competition from Waymo**: Waymo's scale, Google backing, and proven robotaxi operations represent a major competitive threat in the licensing/platform space
7. **Revenue generation**: The company has raised $2.34B but has not demonstrated sustained revenue at scale

### Strategic Position

Nuro has transformed from a purpose-built delivery robot company into an **autonomous driving technology platform**. The Uber-Lucid robotaxi program (20,000+ vehicles, late 2026 launch) represents the most significant test of this strategy. If successful, it would make Nuro one of the largest autonomous driving technology suppliers globally, alongside Waymo and Cruise's technology stacks.

The company's core technical differentiators — the AI-first unified perception model, the cross-platform Nuro Driver system, and the NVIDIA DRIVE Thor integration — position it as a viable autonomy supplier for OEMs seeking to add L2-L4 capabilities without developing the technology in-house.

---

## Sources

- [Nuro — Wikipedia](https://en.wikipedia.org/wiki/Nuro)
- [Nuro Official Website](https://www.nuro.ai/)
- [Nuro Company Page](https://www.nuro.ai/company)
- [Nuro Driver Platform](https://www.nuro.ai/nuro-driver)
- [Nuro Technology](https://www.nuro.ai/technology)
- [Nuro Safety](https://www.nuro.ai/safety)
- [Nuro Solutions](https://www.nuro.ai/solutions)
- [Nuro-Lucid-Uber Robotaxi](https://www.nuro.ai/nuro-lucid-uber-robotaxi)
- [Nuro $203M Series E Announcement](https://www.nuro.ai/blog/nuro-closes-203-million-series-e-financing-to-advance-its-ai-first-self-driving-technology-and-commercial-partnerships)
- [TechCrunch — Nuro's $106M Raise](https://techcrunch.com/2025/04/09/nuros-106m-raise-backs-its-shift-from-delivery-robots-to-licensing-autonomy-tech/)
- [TechCrunch — Nuro Pivots to License Self-Driving Tech](https://techcrunch.com/2024/09/11/nuro-pivots-to-license-self-driving-tech-to-carmakers-mobility-companies/)
- [TechCrunch — Nuro Gearing Up for Comeback](https://techcrunch.com/2024/07/27/autonomous-delivery-startup-nuro-is-gearing-up-for-a-comeback/)
- [TechCrunch — Nuro EC1: Origin Story](https://techcrunch.com/2021/08/16/nuro-ec1-origin/)
- [TechCrunch — Nuro EC1: Partnerships](https://techcrunch.com/2021/08/16/nuro-ec1-partnerships/)
- [TechCrunch — Uber's New Robotaxi from Lucid and Nuro](https://techcrunch.com/2026/01/05/this-is-ubers-new-robotaxi-from-lucid-and-nuro/)
- [TechCrunch — Nuro Foretellix Deal](https://techcrunch.com/2024/01/04/nuro-av-safety-simulation-foretellix-deal/)
- [Lucid Motors — Robotaxi CES 2026 Announcement](https://media.lucidmotors.com/en/newsitem/1061-lucid-nuro-and-uber-unveil-global-robotaxi-at-ces-announce-autonomous-on-road-testing)
- [Uber Investor Relations — Lucid-Nuro-Uber Partnership](https://investor.uber.com/news-events/news/press-release-details/2025/Lucid-Nuro-and-Uber-Partner-on-Next-Generation-Autonomous-Robotaxi-Program/default.aspx)
- [NVIDIA — Nuro Partner Page](https://www.nvidia.com/en-us/solutions/autonomous-vehicles/partners/nuro/)
- [NVIDIA Newsroom — DRIVE Powers Next Gen Transportation](https://nvidianews.nvidia.com/news/nvidia-drive-powers-next-generation-transportation)
- [Lenovo — Nuro Collaboration Announcement](https://news.lenovo.com/pressroom/press-releases/lenovo-and-nuro-forge-collaboration-to-accelerate-autonomous-driving-built-on-nvidia-drive/)
- [NHTSA — Nuro Exemption Press Release](https://www.nhtsa.gov/press-releases/nhtsa-grants-nuro-exemption-petition-low-speed-driverless-vehicle)
- [Federal Register — Nuro Exemption Grant](https://www.federalregister.gov/documents/2020/02/11/2020-02668/nuro-inc-grant-of-temporary-exemption-for-a-low-speed-vehicle-with-an-automated-driving-system)
- [BYD — Nuro Manufacturing Partnership](https://en.byd.com/news/byd-partners-with-nuro-to-manufacture-all-electric-autonomous-delivery-vehicle/)
- [Autoliv — Exterior Airbag for Nuro](https://www.autoliv.com/press/autoliv-provides-exterior-airbag-nuros-autonomous-vehicle-1990769)
- [Nuro Blog — The Nuro Autonomy Stack](https://www.nuro.ai/blog/the-nuro-autonomy-stack)
- [Nuro Blog — Unified Perception Model](https://www.nuro.ai/blogs/unified-perception-model)
- [Nuro Blog — Scaling ML Training at Nuro](https://www.nuro.ai/blog/scaling-ml-training-at-nuro)
- [Nuro Blog — FTL Model Compiler Framework](https://www.nuro.ai/blog/ftl-model-compiler-framework)
- [Nuro Blog — Exploring HD Mapping that Scales](https://www.nuro.ai/blogs/exploring-hd-mapping-that-scales)
- [Nuro Blog — Learned Localization](https://www.nuro.ai/blog/learned-localization-bridging-the-aerial-ground-divide)
- [Nuro Blog — Enabling Reinforcement Learning at Scale](https://www.nuro.ai/blog/enabling-reinforcement-learning-at-scale)
- [Nuro Blog — Next-Generation Sensor Architecture](https://www.nuro.ai/blog/introducing-the-nuro-drivers-next-generation-sensor-architecture)
- [Nuro Blog — Safety: Our Vehicles](https://www.nuro.ai/blog/safety-nuro-our-vehicles)
- [Nuro Blog — Safety: Testing](https://medium.com/nuro/safety-nuro-testing-5f7ba299c3b9)
- [Nuro Blog — Las Vegas Testing Facility](https://www.nuro.ai/blog/how-nuro-tests-for-the-real-world-inside-our-las-vegas-closed-course-facility)
- [Nuro Blog — Nevada Manufacturing Facility](https://medium.com/nuro/introducing-our-new-manufacturing-facility-and-test-track-bbee738d0ec8)
- [Nuro Blog — Meet Our Fleet](https://medium.com/nuro/meet-our-fleet-1364aea6be98)
- [Nuro Blog — California DMV Deployment Permit](https://www.nuro.ai/blog/nuro-receives-the-first-ever-autonomous-vehicle-deployment-permit-from-california-dmv-to-launch-self-driving-delivery-service-in-the-state)
- [Nuro Blog — Nuro Selects NVIDIA DRIVE Thor](https://medium.com/nuro/nuro-selects-nvidia-drive-thor-to-power-its-nuro-driver-autonomous-driving-system-689e8931d49e)
- [Nuro R2 Spec Sheet](https://nuro.sfo3.digitaloceanspaces.com/Nuro-R2-Spec-Sheet-Letter.pdf)
- [Nuro R2 Dimensions](https://www.dimensions.com/element/nuro-r2)
- [Dave Ferguson — Google Scholar](https://scholar.google.com/citations?user=MkztWIoAAAAJ&hl=en)
- [Contrary Research — Nuro Business Breakdown](https://research.contrary.com/company/nuro)
- [Boring Sage — Decoding Nuro](https://www.boringsage.com/post/decoding-nuro-from-last-mile-delivery-to-scaled-autonomy)
- [Sacra — Nuro Valuation](https://sacra.com/c/nuro/)
- [Nuro Release Notes](https://www.nuro.ai/release-notes)
