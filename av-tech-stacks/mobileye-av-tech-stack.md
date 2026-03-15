# Mobileye: Comprehensive AV/ADAS Technology Stack

*Last updated: March 2026*

---

## Table of Contents

1. [Company Overview](#1-company-overview)
2. [Product Lines](#2-product-lines)
3. [Chip Architecture — EyeQ Lineage](#3-chip-architecture--eyeq-lineage)
4. [Sensor Strategy — True Redundancy](#4-sensor-strategy--true-redundancy)
5. [Autonomy Software Stack](#5-autonomy-software-stack)
6. [Machine Learning & AI](#6-machine-learning--ai)
7. [Mapping — REM (Road Experience Management)](#7-mapping--rem-road-experience-management)
8. [Simulation & Virtual Validation](#8-simulation--virtual-validation)
9. [Cloud & Data Infrastructure](#9-cloud--data-infrastructure)
10. [Safety Architecture — RSS](#10-safety-architecture--rss)
11. [OEM Partnerships](#11-oem-partnerships)
12. [Fleet Operations & Robotaxi Deployments](#12-fleet-operations--robotaxi-deployments)
13. [Regulatory & Certification](#13-regulatory--certification)
14. [Key Publications & Patents](#14-key-publications--patents)
15. [Competitive Position](#15-competitive-position)

---

## 1. Company Overview

### Founding & History

Mobileye Global Inc. was founded in **1999** by **Prof. Amnon Shashua** and **Ziv Aviram** in Jerusalem, Israel. Shashua, a professor of computer science at the Hebrew University of Jerusalem, built the company on the then-radical premise that a single camera, powered by computer vision algorithms, could enable safe, scalable driver assistance — eliminating the need for expensive active sensors for basic ADAS functions.

### Corporate Milestones

| Year | Milestone |
|------|-----------|
| 1999 | Founded by Amnon Shashua and Ziv Aviram |
| 2004 | First EyeQ1 silicon sampled |
| 2007 | Partnership with BMW for series production |
| 2008 | EyeQ1 commercial launch |
| 2014 | IPO on NYSE — raised $890M, largest Israeli IPO in U.S. history at the time |
| 2017 | Intel acquisition for **$15.3 billion** — largest-ever Israeli tech acquisition |
| 2017 | RSS (Responsibility-Sensitive Safety) model published |
| 2020 | REM mapping wins PACE Award |
| 2021 | First AV test drives in New York City and Tokyo |
| 2022 | Re-IPO on Nasdaq (ticker: **MBLY**) at $21/share, valued at ~$17B |
| 2024 | 200 millionth EyeQ chip shipped; ended internal FMCW LiDAR development |
| 2025 | VW Group 10M-unit order; Intel reduces stake to ~80% |
| 2026 | Acquisition of Mentee Robotics for $900M; 9M-chip deal with major U.S. OEM; Robotaxi deployments commence |

### Key Leadership

| Name | Role | Background |
|------|------|------------|
| **Prof. Amnon Shashua** | President & CEO | Co-founder; Hebrew University professor; 160+ publications, 94+ patents |
| **Prof. Shai Shalev-Shwartz** | Chief Technology Officer | Machine learning theorist; leads ADAS/AV/RSS/REM development |
| **Moran Shemesh Rojansky** | Chief Financial Officer | — |
| **Johann Jungwirth** | SVP, Autonomous Vehicles | Former VW Group CDO |
| **Liz Cohen-Yerushalmi** | General Counsel | Head of Legal |
| **Diane Be'ery** | VP, Marketing | — |

### Corporate Facts

- **Headquarters:** Jerusalem, Israel
- **Employees:** ~3,800 (post-December 2025 layoff of ~200, representing 5% of workforce)
- **Stock:** Nasdaq: MBLY (Intel retains ~80% ownership as of mid-2025)
- **2024 Revenue:** $1.7 billion
- **2025 Revenue Guidance:** $1.845B–$1.885B (12–14% YoY growth)
- **2024 EyeQ Shipments:** ~29 million units
- **Cumulative EyeQ Shipments:** 200+ million (as of 2024)
- **Installed Base:** 150+ million vehicles worldwide built with Mobileye technology

---

## 2. Product Lines

Mobileye offers a modular product portfolio spanning L0/L1 ADAS through full L4 driverless operation. All three advanced platforms share a common ECU form factor and software core, enabling OEMs to plan upgrade paths across their vehicle lineups.

### Product Hierarchy

| Product | Automation Level | Key Capability | Chip(s) | Sensors |
|---------|-----------------|----------------|---------|---------|
| **EyeQ-based ADAS** | L0–L2 | FCW, LDW, AEB, TSR | 1x EyeQ4/EyeQ6L | 1 front camera (+optional radar) |
| **Surround ADAS** | L2+ | 360-degree perception, integrated parking, hands-off/eyes-on highway | 1x EyeQ6H | Multiple cameras + radars |
| **SuperVision** | L2++ | Hands-off highway navigation, lane changes, overtaking; eyes-on | 2x EyeQ5 or 2x EyeQ6H | 11 cameras (seven 8MP) + radar |
| **Chauffeur** | L2++/L3 | Eyes-off driving at up to 130 km/h on highways; geographically scalable | 3x EyeQ6H | 11+ cameras + surround imaging radar + front LiDAR |
| **Drive** | L4 | Fully driverless MaaS/robotaxi in geofenced domains | 4x EyeQ6H | Up to 13 cameras + imaging radars + LiDARs (27 sensors total on ID.Buzz AD) |

### SuperVision

SuperVision is the most widely deployed advanced platform, currently in production with Zeekr (Geely Group), Porsche (upcoming), and other VW Group brands. It provides:

- 360-degree surround perception via 11 cameras (including seven 8-megapixel units)
- Hands-off highway navigation with automatic lane changes and overtaking
- REM crowdsourced mapping integration for localization
- RSS driving policy for safety-critical decisions
- OTA (over-the-air) update capability for continuous feature rollout

### Chauffeur

Chauffeur extends SuperVision with a redundant active-sensor channel (imaging radar + front LiDAR) to enable **eyes-off** operation. A secondary computing board with an additional EyeQ6H chip provides hardware/software redundancy. Designed for speeds up to **80 mph (130 km/h)** on all regular road types.

### Drive

Drive is the full Level 4 platform for driverless Mobility-as-a-Service. It powers the **VW ID.Buzz AD** and is the basis for Lyft/Marubeni robotaxi deployments. The ECU contains **4x EyeQ6H** chips connected to up to 13 cameras, multiple imaging radars, and LiDARs. Moovit (an Intel subsidiary) provides the rider-facing platform, fleet management tools, and tele-operations.

### ECU Series Architecture

All three advanced platforms (SuperVision, Chauffeur, Drive) share:
- A **common primary board** with 2x EyeQ6H + integrated MCU
- Identical form factor, interface, and connectivity
- Common software core

OEMs can move between platforms by adding or removing a **secondary computing board** and sensor modules, dramatically reducing engineering effort for product-line planning.

---

## 3. Chip Architecture — EyeQ Lineage

Mobileye has designed and shipped **six generations** of EyeQ system-on-chip (SoC) processors, with over **200 million units** shipped cumulatively. The chips are purpose-built for vision processing and deep learning inference in automotive-grade environments.

### EyeQ Generation Summary

| Generation | Year | Process | Performance | Power | CPU Cores | Key Features |
|-----------|------|---------|-------------|-------|-----------|-------------|
| **EyeQ1** | 2008 | 180 nm | — | — | — | First SoC; LDW, FCW, TSR, AHC |
| **EyeQ2** | 2010 | — | 6x EyeQ1 | — | — | Pedestrian detection, full AEB |
| **EyeQ3** | 2014 | — | 6x EyeQ2 | — | — | L2 capability, higher resolution |
| **EyeQ4** | 2018 | **28 nm FD-SOI** (STMicro) | **2.5 TOPS** | **~4.5 W** | 4 MIPS cores | Multi-sensor fusion (up to 8 sensors), 10x EyeQ3 |
| **EyeQ5** | 2021 | **7 nm FinFET** (TSMC) | **24 TOPS** (peak) | **<5 W** (typical) | 8 CPU cores | 18 vision processor cores, 4 accelerator classes, up to 20 sensors |
| **EyeQ6L** | 2024 | **7 nm** | ~11 TOPS | ~low | Optimized | 4.5x EyeQ4M compute at half the die area; front-camera ADAS |
| **EyeQ6H** | 2025 | **7 nm** | 3x EyeQ5H | ~6.25 W | — | 1,000+ FPS on pixel-labeling NNs; built-in ISP, GPU, video encoder |
| **EyeQ Ultra** | 2025+ | **5 nm** | **176 TOPS** | **<100 W** | 12 RISC-V (dual-threaded) | L4 single-chip AV; 16 CNN accelerators, 64 total cores |

### EyeQ4 — The Mass-Market Workhorse

- **Process:** STMicroelectronics 28 nm FD-SOI
- **Performance:** 2.5 TOPS
- **Power:** ~4.5 W (EyeQ4H)
- **Architecture:** 4 MIPS CPU cores + proprietary vision processing accelerators
- **Sensors:** Fuses up to 8 sensors
- **Deployment:** Tens of millions shipped; powers basic ADAS across dozens of OEMs

### EyeQ5 — The SuperVision Backbone

- **Process:** TSMC 7 nm FinFET (15 metal layers)
- **Performance:** Up to 24 TOPS deep learning; 12 TOPS in typical workloads
- **Power:** <5 W (typical operating)
- **Architecture:**
  - 8 CPU cores
  - 18 vision processor cores
  - **4 classes of proprietary accelerators:**
    - **XNN** — Dedicated deep learning / CNN accelerator
    - **PMA** — Programmable Macro Array (CGRA)
    - **VMP** — Vector Microcode Processor (SIMD VLIW)
    - **MPC** — Multi-thread Processor Cluster (barrel-threaded CPU cores)
- **Sensors:** Fuses up to 20 sensors
- **Variants:** EyeQ5 Mid (4.6 DL TOPS int8) and EyeQ5 High

### EyeQ6L — Cost-Optimized ADAS

- **Process:** 7 nm
- **Performance:** 4.5x the compute of EyeQ4M at roughly half the physical footprint
- **Power:** Similar to EyeQ4M
- **Target:** L1–L2 front-camera ADAS (replacement for EyeQ4 in new designs)
- **Camera Support:** 8 MP camera with 120-degree lateral FOV (20-degree improvement over EyeQ4M)
- **Status:** In production as of April 2024

### EyeQ6H — High-Performance ADAS/AV

- **Process:** 7 nm
- **Performance:** 3x the compute power of EyeQ5H, consuming only 25% more power
- **Built-in blocks:** Dedicated ISP, GPU, video encoder
- **Real-world benchmark:** >1,000 FPS on pixel-labeling neural networks
- **Status:** Launched early 2025; basis for new ECU series

### EyeQ Ultra — The L4 AV-on-a-Chip

- **Process:** **5 nm** (fabricated by TSMC on Intel's behalf)
- **Performance:** **176 TOPS** — equivalent to 10x EyeQ5
- **Power:** <100 W
- **CPU:** 12 dual-threaded cores on **RISC-V ISA** (first EyeQ to abandon MIPS)
- **Accelerators:** 64 total cores including:
  - 16 CNN accelerators (XNN class)
  - PMA, VMP, MPC classes retained
- **GPU:** Arm GPU at up to **256 GFLOPS**
- **Additional blocks:** Vision Processing Unit (VPU), Image Signal Processor (ISP), H.264/H.265 video encoding cores
- **Target:** Single-chip solution for full L4 autonomous driving
- **Status:** First silicon late 2023; automotive-grade production targeted for 2025

---

## 4. Sensor Strategy — True Redundancy

### Philosophy

Mobileye's sensor architecture is built on a principle called **True Redundancy**, which is fundamentally different from the industry-standard approach of sensor fusion.

| Approach | How It Works | Validation Burden |
|----------|-------------|-------------------|
| **Sensor Fusion** (industry standard) | Multiple sensors are fused into a **single** world model; sensors are complementary | Very high — millions of hours needed to validate the single fused pipeline |
| **True Redundancy** (Mobileye) | Two **independent** subsystems each build a **complete** world model; either can achieve safety alone | Much lower — tens of thousands of hours per channel suffice |

### Two Independent Subsystems

1. **Camera-Only Subsystem:** Processes data from surround cameras (up to 13) using deep learning perception on EyeQ chips. This subsystem must independently achieve safety-level perception — detecting all road users, lanes, drivable paths, traffic signs, and signals from cameras alone.

2. **Radar/LiDAR Subsystem:** Processes data from imaging radar and (optionally) LiDAR sensors. This subsystem must also independently achieve safety-level perception, with no camera input.

In production, the camera subsystem serves as the primary backbone, while the radar/LiDAR subsystem provides a **diversified, redundant safety backup**. Mobileye operates two separate developmental AV fleets: one camera-only, one radar/LiDAR-only.

### Camera Specifications

- **SuperVision:** 11 cameras (seven 8 MP, four 2 MP), 360-degree surround coverage
- **Chauffeur:** 11+ cameras with surround radar and front LiDAR overlay
- **Drive (ID.Buzz AD):** 13 cameras + 9 LiDARs + 5 radars = 27 total sensors
- **Sensor type:** High-dynamic-range CMOS; operational in low light and high-glare conditions
- **Resolution:** Up to 8 megapixels per camera

### Imaging Radar

Mobileye developed a proprietary **software-defined imaging radar** SoC:

- **Configuration:** 2,304 virtual channels (48 Tx x 48 Rx)
- **Range:** Detection of vehicles, pedestrians, and objects at up to **1,000 feet (~300 m)**
- **Capability:** Detects motorcycles beyond 200 m; old tire on road at 140 m; low-profile hazards
- **Processing:** Custom SoC with proprietary algorithms; 12x resolution increase without proportional compute increase
- **Production partner:** WNC (manufacturing collaboration)
- **Status:** Meeting performance specifications on B-samples; on track for production

### LiDAR Strategy

Mobileye had been developing a proprietary **FMCW (Frequency-Modulated Continuous-Wave) LiDAR-on-a-chip**:

- **Specification:** 4D velocity + position measurements up to 300 m range; 600 points per degree; 2 million laser pulses per second
- **Advantage:** FMCW measures velocity directly (unlike ToF LiDAR); compact chip-scale form factor

**Strategic pivot (September 2024):** Mobileye ended internal FMCW LiDAR development, citing that advances in camera perception (EyeQ6-based) and imaging radar performance made proprietary FMCW LiDAR "less essential" to the eyes-off roadmap. The ~100-person LiDAR division was shut down.

**Current approach:** Mobileye partnered with **Innoviz Technologies** to supply third-party LiDARs for the Drive (L4) platform, with SOP in 2026. The imaging radar remains a proprietary, in-house development.

---

## 5. Autonomy Software Stack

### Architecture Overview

Mobileye's autonomy software is organized into three main layers — **Perception**, **Planning/Policy**, and **Actuation** — each developed and refined independently for modularity. Two cross-cutting frameworks (RSS and REM) are woven through the stack.

```
+---------------------------------------------------------------+
|                     Cloud Services                             |
|  (REM Roadbook, VLSA slow-think models, OTA updates)          |
+---------------------------------------------------------------+
        |                    |                    |
+---------------+   +-----------------+   +----------------+
|  Perception   |   |   Planning /    |   |   Actuation    |
|               |   |   Driving       |   |   Control      |
| - Camera CNN  |   |   Policy        |   |                |
| - Radar proc  |   |                 |   | - Longitudinal |
| - LiDAR proc  |   | - RSS safety    |   | - Lateral      |
| - ViDAR       |   |   layer         |   | - Comfort      |
| - Fusion      |   | - Path planning |   |   constraints  |
| - Free space  |   | - REM map       |   |                |
| - Semantic    |   |   localization  |   |                |
|   labeling    |   |                 |   |                |
+---------------+   +-----------------+   +----------------+
```

### Perception Pipeline

The perception system runs at **10 Hz** (10 cycles per second) and produces:

- **Object detection & classification:** Vehicles, pedestrians, cyclists, animals, debris
- **Lane detection & road geometry:** Lane markings, road edges, drivable paths
- **Traffic infrastructure:** Signs, signals, construction zones
- **Free-space estimation:** Drivable area mapping
- **Semantic pixel labeling:** Dense per-pixel scene understanding (>1,000 FPS on EyeQ6H)
- **Depth estimation (ViDAR):** Camera-based 3D point cloud generation ("Visual LiDAR")

Under True Redundancy, the camera and radar/LiDAR channels each produce their own independent world model. These are compared/combined only at the planning layer.

### ViDAR — Vision as Virtual LiDAR

ViDAR is Mobileye's technique for generating **LiDAR-like 3D point clouds from camera data alone**. Using deep neural networks trained on paired camera + LiDAR data, the system learns to predict dense depth maps and 3D structure from monocular or multi-camera images. This enables the camera-only subsystem to reason about 3D geometry without any active sensors.

### Driving Policy — RSS Integration

The planning layer uses the **RSS (Responsibility-Sensitive Safety)** model as a formal safety envelope. The RSS module:

1. Takes the perception output (object list with positions, velocities, classifications)
2. Creates "constellations" — pairwise relationships between the ego vehicle and each detected object
3. Computes safe following distances (longitudinal and lateral) per constellation
4. Determines if the current state is "dangerous" (distance < minimum safe distance)
5. Calculates a "proper response" — acceleration/deceleration limits that will restore safety
6. Combines all per-object responses into a single actuation constraint

The planner is free to optimize for comfort, efficiency, and passenger experience within the safety envelope defined by RSS.

### AV 2.0 / Compound AI Architecture

At CES 2025-2026, Mobileye unveiled its next-generation software architecture called **Compound AI**, which replaces the monolithic end-to-end approach with a modular, multi-model system:

#### Fast-Think / Slow-Think Split

| Layer | Frequency | Function | Compute Location |
|-------|-----------|----------|-----------------|
| **Fast-Think** | High (~10 Hz) | Reflexive safety decisions; RSS enforcement; immediate obstacle avoidance | On-vehicle (EyeQ chips) |
| **Slow-Think** | Low (~1 Hz) | Scene-level reasoning; complex semantic understanding; edge-case resolution | On-vehicle + **cloud** (VLMs) |

#### VLSA (Vision-Language-Semantic-Action) Model

The slow-think layer uses a **Vision-Language-Semantic-Action** model that:

- Processes deep scene semantics using vision-language foundations
- Provides **structured semantic guidance** to the planner (not direct vehicle control)
- Does NOT sit in the safety loop — safety remains in the fast-think system governed by RSS
- Can run partly in the cloud, calling powerful VLMs at lower frequency
- In many cases, can replace human remote operators for edge-case resolution

This architecture improves **mean time between interventions** while keeping safety-critical control deterministic and formally verified.

---

## 6. Machine Learning & AI

### Training Infrastructure

- **Data scale:** 200+ petabytes of driving data collected from production vehicles
- **Processing:** 500,000 peak CPU cores on AWS; processes 50 million datasets/month (~100 PB/month, equivalent to ~500,000 hours of driving)
- **Training compute:** Uses Amazon EC2 DL1 instances (Habana Gaudi accelerators) for deep learning training, reducing costs compared to GPU-based training
- **Hard mining:** State-of-the-art computer vision coupled with natural language models enables mining of the 200 PB dataset for rare scenarios and edge cases

### Neural Network Architecture

Mobileye employs multiple specialized neural network architectures rather than a single monolithic model:

1. **Object detection networks** — Multi-class detection and tracking
2. **Semantic segmentation networks** — Per-pixel scene labeling (>1,000 FPS on EyeQ6H)
3. **Lane and road geometry networks** — Structured output for lane topology
4. **Depth estimation / ViDAR networks** — Monocular and multi-view depth prediction
5. **VLSA networks** — Vision-language models for scene-level semantic reasoning

All inference runs on the proprietary EyeQ accelerator stack (XNN, PMA, VMP, MPC), which provides extreme power efficiency compared to general-purpose GPUs.

### Compound AI vs. End-to-End

Mobileye explicitly rejects pure end-to-end learning for safety-critical AV operation. Their **Compound AI** approach:

- Combines **purpose-built, verifiable algorithms** (RSS, geometric reasoning) with learned components
- Keeps safety-critical decisions in deterministic, formally provable layers
- Uses learned perception for flexibility and generalization
- Avoids placing generative AI models in the safety loop
- Achieves **explainability** — each module's contribution to a driving decision can be traced

### Bias-Variance Tradeoff in Autonomy

Mobileye frames the AV challenge as a bias-variance tradeoff:

- **High-bias** (rule-based) systems are safe but inflexible
- **High-variance** (pure ML) systems are flexible but unpredictable
- Compound AI balances both by using formal safety rules as constraints on learned behavior

---

## 7. Mapping — REM (Road Experience Management)

### Overview

REM is Mobileye's proprietary **crowdsourced, continuously updated HD mapping** system. Unlike traditional HD mapping (which uses dedicated LiDAR survey vehicles), REM harvests map data from **millions of production vehicles** already on the road equipped with Mobileye cameras and EyeQ chips.

### How It Works

```
Production Vehicle               Cloud                    Consumer
(EyeQ + Camera)                 (AWS)                    (Roadbook)
     |                            |                          |
     | 1. Drives normally         |                          |
     | 2. EyeQ extracts           |                          |
     |    landmarks, geometry     |                          |
     | 3. Compresses to           |                          |
     |    ~10 KB/km               |                          |
     |--------------------------->|                          |
     |    Upload anonymized       | 4. Aggregates millions   |
     |    data packets            |    of drives             |
     |                            | 5. Builds/updates        |
     |                            |    Roadbook              |
     |                            |------------------------->|
     |                            |    Distribute updated    |
     |                            |    maps via OTA          |
```

### Key Technical Specifications

| Parameter | Value |
|-----------|-------|
| **Data footprint** | ~10 KB per kilometer |
| **Accuracy** | Centimeter-level for vehicle localization and surrounding objects |
| **Coverage** | Mapped all of Japan (25,000 km of roads) in 24 hours; 400 MB total |
| **Update frequency** | Continuous — map freshness measured in hours/days, not months |
| **Data source** | 150+ million vehicles with Mobileye technology |
| **Processing** | AWS (Amazon EKS, Amazon S3, Apache Spark) |

### Roadbook

The **Roadbook** is the output of the REM pipeline — a compressed, highly precise HD map database containing:

- Lane-level geometry and topology
- Road signs and markings (text, colors, positions)
- Traffic signal locations and types
- Guardrails, barriers, and road boundaries
- Landmarks for centimeter-accurate localization
- Traffic patterns and historical driving behavior

### Applications

1. **Autonomous Vehicles:** Primary localization and planning map for SuperVision, Chauffeur, and Drive
2. **Cloud-Enhanced ADAS:** Even non-autonomous vehicles can receive REM data for enhanced warnings (e.g., curve speed warnings based on crowdsourced data, construction zone alerts)
3. **Infrastructure monitoring:** Road authorities can leverage REM data for pothole detection, sign condition, and traffic pattern analysis

---

## 8. Simulation & Virtual Validation

### Approach

Mobileye's validation philosophy combines three pillars:

1. **Formal safety proofs (RSS):** Mathematical guarantees that the driving policy is safe, independent of simulation or real-world testing
2. **Massive simulation:** Generative models of human driving behavior (including reckless drivers) using GAN-like techniques to create realistic traffic scenarios
3. **Real-world validation:** Dedicated test fleets operating in multiple geographies

### Simulation Technology

- **Sensor emulation:** Multi-layered, real-time image sensor emulation models that satisfy ECU validity checks and produce video streams eliciting behavior from the perception layer similar to real-world driving
- **Hardware-in-the-Loop (HiL):** SuperVision's 11-camera system requires HiL setups capable of scaling to accommodate simultaneous simulated sensors while maintaining real-time performance
- **Scenario generation:** Uses RSS parameters to define the space of dangerous scenarios, then generates edge cases within that space
- **Coverage:** True Redundancy reduces the validation burden — each independent channel needs only tens of thousands of hours of validation (vs. millions for a fused system)

### Safety Validation Tools

- **Synopsys:** Mobileye adopted Synopsys automotive functional safety verification solutions for ISO 26262 compliance of next-generation ADAS SoCs
- **RSS on NHTSA scenarios:** Mobileye has published an analysis implementing RSS on all 37 NHTSA pre-crash scenario types, demonstrating that RSS-compliant driving avoids at-fault collisions in every category

---

## 9. Cloud & Data Infrastructure

### AWS Partnership

Mobileye selected **Amazon Web Services (AWS)** as its preferred public cloud provider in November 2018. The infrastructure underpins REM mapping, ML training, simulation, and OTA updates.

### Scale

| Metric | Value |
|--------|-------|
| **Peak compute** | 500,000 CPU cores (via Amazon EKS) |
| **Concurrent instances** | 400,000+ vCPUs on thousands of EC2 instances |
| **Monthly processing** | 50 million datasets (~100 PB/month) |
| **Total data store** | 200+ petabytes |
| **Driving hours processed/month** | ~500,000 |
| **Contributing vehicles** | 150+ million with Mobileye technology installed |

### Technology Stack

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Container orchestration | Amazon EKS (Elastic Kubernetes Service) | Core compute orchestration |
| Auto-scaling | Karpenter | Intelligent node provisioning |
| Storage | Amazon S3 | Data lake for hundreds of PB of sensor data |
| ML training | Amazon EC2 DL1 (Habana Gaudi) | Deep learning model training |
| ML inference (REM) | AWS Graviton (Arm-based) + Triton | Cost-optimized REM map inference |
| Big data processing | Apache Spark on Amazon EKS | HD map creation pipeline |

### Efficiency Gains

- **50% reduction** in developer overhead after migrating to Amazon EKS
- Graviton-based inference for REM achieved significant cost reduction vs. x86
- Spark-on-EKS architecture enabled scalable, containerized HD map processing

---

## 10. Safety Architecture — RSS

### Responsibility-Sensitive Safety (RSS)

RSS is a **mathematically formal safety model** for multi-agent driving, published by Shashua and Shalev-Shwartz in 2017. It translates human "common sense" driving rules into rigorous mathematical formulas that are transparent, verifiable, and provably safe.

### Design Goals

1. **Soundness:** The interpretation of "safe driving" must align with how humans interpret traffic law (formalized from Tort law's "Duty of Care")
2. **Usefulness:** The model must produce agile driving behavior, not overly defensive driving
3. **Scalability:** Safety guarantees must hold regardless of geography or traffic density

### The Five Rules

| Rule | Name | Description |
|------|------|-------------|
| **1** | Do not hit the car in front | Mathematical formulation of the "two-second rule"; defines minimum longitudinal safe following distance |
| **2** | Do not cut in recklessly | Applies the same safe-distance principle laterally; defines minimum lateral clearance |
| **3** | Right of way is given, not taken | Even when the AV has right-of-way, it must account for other drivers who may not yield |
| **4** | Be cautious with limited visibility | Absence of sensor detection does not mean the path is clear; assume potential hazards in occluded areas |
| **5** | If you can avoid a crash without causing another, you must | Ultimate collision-avoidance obligation; permits rule violations (e.g., crossing a lane marking) if necessary to prevent a collision |

### Mathematical Formulation

**Longitudinal Safe Distance (Rule 1):**

The minimum safe following distance `d_min` between a following vehicle (ego) and a leading vehicle is defined such that even if the leading vehicle applies maximum braking force instantaneously, the ego vehicle — after a bounded reaction time `rho` — can apply its own maximum braking and come to a stop without collision.

Key parameters:
- `v_r` — velocity of rear (ego) vehicle
- `v_f` — velocity of front vehicle
- `rho` — response time
- `a_max_accel` — maximum acceleration during response time
- `a_min_brake` — minimum braking deceleration of rear vehicle
- `a_max_brake` — maximum braking deceleration of front vehicle

**Lateral Safe Distance (Rule 2):**

An analogous formula defines the minimum lateral gap, accounting for lateral velocities, response times, and lateral braking capabilities.

**Proper Response:**

When the distance between vehicles drops below `d_min`, the AV must execute the **proper response**: braking (longitudinally or laterally) until a safe following distance is restored or the vehicle comes to a complete stop. The proper response is expressed as acceleration limits: `[a_min, a_max]` for both longitudinal and lateral dimensions.

### Implementation

- **Input:** Object list from perception (position, velocity, classification of all detected objects)
- **Per-object processing:** For each object, RSS creates a "constellation" (geometric relationship with ego) and computes safe distances
- **Aggregation:** Individual proper responses are combined into a single actuation constraint (longitudinal and lateral acceleration bounds)
- **Output:** The planner must operate within these bounds; any trajectory satisfying the constraints is provably safe

### Standards Adoption

- **IEEE P2846:** Technology-neutral standard for AV safety assumptions, developed with significant Mobileye/RSS influence
- **Open-source implementation:** [intel/ad-rss-lib](https://github.com/intel/ad-rss-lib) on GitHub
- RSS has gained traction with regulatory bodies in the EU, China, and Japan

---

## 11. OEM Partnerships

### Major OEM Relationships

| OEM / Group | Products | Details | Volume / Timeline |
|-------------|----------|---------|-------------------|
| **Volkswagen Group** | Surround ADAS, SuperVision, Drive | 10M-unit EyeQ order (March 2025); VW MQB platform; ID.Buzz AD robotaxi | 10M units; series production 2026–2027 |
| **Porsche** | SuperVision | SuperVision for future models (announced May 2023); EyeQ6H-based; brand-tuned integration | Production TBD |
| **Audi, Bentley, Lamborghini** | SuperVision (via VW Group) | Mobileye SuperVision available as platform solution within VW Group | — |
| **Geely Group / Zeekr** | SuperVision | Zeekr 001 (110,000 vehicles updated via OTA), Zeekr 009; 3 additional Geely brands (incl. Polestar) | In production; expanding |
| **Ford** | ADAS | Driver-assist technology supply agreement (2020) | — |
| **NIO** | AV development | Partnership for consumer AV development in China and other markets (2019) | Development stage |
| **Mahindra** | SuperVision + Surround ADAS | Selected for at least 6 future vehicle models | SOP 2027 |
| **Major U.S. OEM** (likely GM) | EyeQ6H ADAS | 9 million chip deal announced at CES 2026 | ~9M chips |
| **FAW Group** | ADAS | Chinese OEM partnership | In production |
| **smart** | SuperVision | Advanced driving automation for smart brand | Announced |
| **BMW** | ADAS | Long-standing partnership; early EyeQ adopter | In production |

### Market Reach

- Mobileye technology is in vehicles from **50+ OEMs** worldwide
- **~29 million** EyeQ units shipped in 2024; **32–34 million** expected in 2025
- Cumulative: **200+ million** EyeQ chips shipped through 2024

---

## 12. Fleet Operations & Robotaxi Deployments

### Active Test & Deployment Locations

| Location | Status | Partner | Vehicle |
|----------|--------|---------|---------|
| **Munich, Germany** | Testing | Sixt / Moovit | — |
| **Hamburg, Germany** | Commercial launch 2026 | VW / MOIA | ID.Buzz AD |
| **Berlin, Germany** | Testing (BVG) | VW / MOIA | ID.Buzz AD (near-series prototypes) |
| **Dallas, Texas** | Commercial launch 2026 | Lyft / Marubeni | TBD |
| **Los Angeles, California** | Commercial launch 2026 | Uber / VW | ID.Buzz AD |
| **Austin, Texas** | R&D testing | Mobileye | Development fleet |
| **Detroit, Michigan** | R&D testing | Mobileye | Development fleet |
| **New York City** | Testing | Mobileye | Development fleet |
| **Tokyo, Japan** | Testing | Mobileye | Development fleet |

### Key Robotaxi Partnerships

#### Lyft / Marubeni (U.S.)
- **Announced:** February 2025
- **Launch:** Dallas, TX — as soon as 2026
- **Structure:** Marubeni (Japanese conglomerate; 900,000+ vehicle fleet globally) owns and finances the vehicles; Lyft provides the ride-hailing platform and fleet management via Flexdrive
- **Scale:** Plan to expand to thousands of vehicles across multiple U.S. cities after Dallas debut

#### Volkswagen / MOIA (Europe & U.S.)
- **Vehicle:** ID.Buzz AD — SAE Level 4; 27 sensors (13 cameras, 9 LiDARs, 5 radars)
- **Hamburg launch:** 500+ vehicles during 2026 (initially with safety drivers)
- **LA launch:** Partnership with Uber for 2026
- **Expansion target:** 6 cities by end of 2027; 100,000+ self-driving vehicles by 2033
- **Pre-series production:** VW Commercial Vehicles ramped up in March 2026

#### Moovit Integration
Moovit (Intel subsidiary) provides the full robotaxi service layer:
- Rider-facing mobile app
- Fleet management tools
- Tele-operations system
- Mobility intelligence for route optimization and deployment planning
- Rider-experience services

Customers can order rides through Sixt and Moovit mobile apps.

---

## 13. Regulatory & Certification

### Safety Methodology

Mobileye published the industry's **first formal safety model for AVs** (RSS) in 2017 and has built a comprehensive safety methodology around it:

1. **RSS formal safety layer** — Mathematical guarantees of collision avoidance
2. **True Redundancy** — Independent sensor channels each meeting safety independently
3. **SDoV (Safety of the Driving Vehicle)** — Mobileye's internal safety framework ensuring the AV meets global standards and is engineered to be safer than human drivers
4. **Comprehensive validation** — Combination of formal proofs, simulation, and real-world testing

### Standards & Certifications

| Standard | Relevance |
|----------|-----------|
| **IEEE P2846** | Mobileye-influenced standard defining minimum reasonable assumptions for AV safety models |
| **ISO 26262** | Functional safety for automotive electronics; EyeQ chips designed to ASIL-B/D compliance |
| **EU GSR (General Safety Regulation)** | Mobileye launched the world's first **vision-only Intelligent Speed Assist (ISA)** certified across all 27 EU countries + Norway, Switzerland, Turkey |
| **UN R157** | Automated Lane Keeping Systems regulation (relevant to Chauffeur L3 operation) |
| **NHTSA pre-crash scenarios** | Mobileye published RSS implementation analysis across all 37 NHTSA pre-crash types |

### Regulatory Engagement

- Active participant in IEEE, SAE, and ISO working groups
- Engaged with regulators in the EU, U.S., China, Japan, and Israel
- Proponent of performance-based (not prescriptive) AV regulation
- RSS open-sourced to encourage industry-wide adoption as a safety baseline

---

## 14. Key Publications & Patents

### Amnon Shashua — Academic Output

- **160+ peer-reviewed papers** in computer vision and machine learning
- **94+ patents** in computer vision, ADAS, and autonomous driving
- **European Inventor Award finalist** (2019, European Patent Office)
- **Automotive Hall of Fame** inductee

### Foundational Papers

| Paper | Authors | Year | Venue | Significance |
|-------|---------|------|-------|--------------|
| *On a Formal Model of Safe and Scalable Self-driving Cars* | Shalev-Shwartz, Shammah, Shashua | 2017 | arXiv:1708.06374 | Introduces RSS; foundational safety model |
| *Safe, Multi-Agent, Reinforcement Learning for Autonomous Driving* | Shalev-Shwartz, Shammah, Shashua | 2016 | arXiv:1610.03295 | Multi-agent RL framework for AV safety |
| *Implementing the RSS Model on NHTSA Pre-Crash Scenarios* | Mobileye | — | Technical report | Validates RSS against all 37 NHTSA scenario types |
| *Responsibility-Sensitive Safety* (extended) | Mobileye | 2022 | arXiv:2206.03418 | Comprehensive RSS technical specification |
| *A Safety Architecture for Self-Driving Systems* | Mobileye | — | Technical whitepaper | Full SDoV safety architecture |

### Open-Source Projects

- **[intel/ad-rss-lib](https://github.com/intel/ad-rss-lib)** — C++ library implementing the RSS model for autonomous vehicles; includes situation analysis, response computation, and integration examples

### Key Patent Areas

- Monocular and multi-camera depth estimation
- Crowdsourced HD map construction from sparse visual landmarks
- Formal safety envelope computation for multi-agent driving
- Low-power CNN accelerator architectures
- Camera-based free-space estimation
- Real-time semantic segmentation on custom SoCs

---

## 15. Competitive Position

### ADAS Market Dominance

Mobileye commands an estimated **65–70% market share** in vehicles equipped with ADAS vision systems, making it the single largest supplier of production ADAS technology globally. With **200+ million chips shipped** and **~29 million units in 2024 alone**, no competitor matches its installed-base scale.

### Revenue Model

Unlike Waymo (fleet-based) or Tesla (consumer product), Mobileye operates a **licensing/royalty model**:
- Sells EyeQ chips and perception software to OEMs
- Earns revenue per vehicle shipped
- No capital-intensive fleet ownership burden
- Scales with global vehicle production

### Competitive Comparison

| Dimension | Mobileye | Waymo | Tesla | Qualcomm (Snapdragon Ride) | NVIDIA (Drive Orin/Thor) |
|-----------|----------|-------|-------|---------------------------|------------------------|
| **Business model** | Chip + SW supplier to OEMs | Fleet operator (robotaxi) | Vertically integrated OEM | Chip supplier to OEMs | Chip supplier to OEMs |
| **ADAS market share** | ~65–70% | N/A (no ADAS product) | In-house only (Tesla vehicles) | Growing | Growing |
| **AV approach** | True Redundancy; RSS formal safety | Sensor fusion; simulation-heavy | Vision-only; end-to-end ML | Platform-agnostic SoC | Platform-agnostic SoC |
| **Sensor philosophy** | Camera primary + radar/LiDAR redundancy | Heavy LiDAR + camera + radar fusion | Camera-only | OEM choice | OEM choice |
| **Safety model** | RSS (formal, mathematical) | Internal metrics + simulation | No published formal model | None proprietary | None proprietary |
| **Mapping** | REM (crowdsourced, 150M+ vehicles) | Proprietary survey mapping | None (real-time only) | Depends on OEM | Depends on OEM |
| **Custom silicon** | Yes (EyeQ, 6 generations) | No (uses commercial HW) | Yes (FSD chip, HW3/HW4) | Yes (Snapdragon Ride) | Yes (Orin, Thor) |
| **OEM partners** | 50+ | None (fleet only) | None (Tesla only) | BMW, Hyundai, others | Mercedes, JLR, BYD, others |
| **Robotaxi fleet** | Via partners (Lyft, Uber, MOIA) | Owned & operated | Planned | N/A | N/A |

### Strengths

- **Unmatched scale:** 200M+ chips shipped; 150M+ vehicles contributing REM data
- **Formal safety framework:** RSS provides regulatory and liability clarity
- **Full-stack from chip to cloud:** Custom silicon + software + mapping + safety model
- **OEM diversity:** Not dependent on any single automaker
- **Cost efficiency:** EyeQ chips deliver high performance at low power and cost

### Challenges

- **OEM in-housing:** Some major automakers developing proprietary ADAS (Tesla, Chinese OEMs)
- **Competitive silicon:** NVIDIA Drive Thor and Qualcomm Snapdragon Ride gaining OEM traction
- **Robotaxi timing:** Behind Waymo in commercial driverless operations
- **Revenue concentration:** Dependent on automotive cycle; 2024 saw 20% volume decline due to OEM inventory corrections
- **Stock performance:** Trading below 2022 IPO price as of mid-2025

### Recent Strategic Moves

- **Mentee Robotics acquisition ($900M, January 2026):** Expands into humanoid robotics; leverages AV AI stack for physical AI. MenteeBot uses camera-only sensing, Sim2Real learning, and proprietary electric motors. Initial commercial deployment targeted for 2028.
- **9M-chip U.S. OEM deal (CES 2026):** Major validation of EyeQ6H platform
- **VW Group 10M-unit order (2025):** Largest single ADAS order; spans MQB platform
- **Lyft/Marubeni robotaxi partnership:** Asset-light model for U.S. robotaxi expansion
- **Compound AI / VLSA architecture:** Positions Mobileye to reduce reliance on human tele-operators

---

## Appendix: Financial Summary

| Metric | 2023 | 2024 | 2025 (Guidance) |
|--------|------|------|-----------------|
| Revenue | ~$2.1B | $1.7B | $1.845B–$1.885B |
| EyeQ shipments | 37.4M | 29.0M | 32M–34M |
| Cumulative EyeQ shipped | ~170M+ | 200M+ | 232M–234M+ |
| Headcount | ~4,000 | ~3,800 | ~3,600 (est.) |

---

*Sources: Mobileye corporate disclosures, SEC filings, CES 2025/2026 presentations, IEEE publications, arXiv papers, AWS case studies, OEM press releases, and industry analyses.*
